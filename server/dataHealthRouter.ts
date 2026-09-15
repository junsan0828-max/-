import { initTRPC, TRPCError } from "@trpc/server";
import { pool } from "./db";
import type { AuthUser } from "./auth";
import type { Request } from "express";

const t = initTRPC.context<{ user: AuthUser; req: Request }>().create();
const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });
  return next({ ctx: { ...ctx, user: ctx.user } });
});

// 회당 단가 정상 범위. 벗어나면 매출 입력 오류로 본다.
// (이인정 사례: 재등록 20회를 "2회"로 입력해 회당 480,000원 → 정산까지 흔들렸다)
const PRICE_MIN = 10_000;
const PRICE_MAX = 150_000;
// 재등록 상담을 시작해야 하는 잔여 횟수
const REREGISTER_THRESHOLD = 3;

export type AnomalyGroup = {
  key: string;
  title: string;
  /** critical=데이터가 틀림(정산·매출 영향) / warning=확인 필요 / action=영업 액션 */
  severity: "critical" | "warning" | "action";
  description: string;
  rows: Record<string, string | number | null>[];
};

/**
 * 일일 데이터 이상 점검.
 *
 * 2026-08~09 PT 데이터 사고에서 나온 항목들이다. 그때는 대표가 화면을 눈으로 보다가
 * 발견해야만 알 수 있었다 — 완료 처리한 회원이 재시작마다 살아나고, 매출 횟수 오타가
 * 단가를 10배 틀리게 만들고, 중복 회원 때문에 "PT가 사라졌다"고 오인하는 식이었다.
 * 사람이 매번 눈으로 찾는 대신 매일 자동으로 올라오게 한다.
 */
export const dataHealthRouter = t.router({
  getAnomalies: protectedProcedure.query(async ({ ctx }): Promise<{
    groups: AnomalyGroup[];
    totalCount: number;
    checkedAt: string;
  }> => {
    if (!["admin", "sub_admin", "consultant"].includes(ctx.user.role ?? ""))
      throw new TRPCError({ code: "FORBIDDEN", message: "관리자만 조회할 수 있습니다." });

    const groups: AnomalyGroup[] = [];

    // ① PT 매출이 있는데 패키지가 없는 회원 — 등록 버튼이 중간에 실패한 경우.
    //    회원 화면에 PT가 안 보여 "등록했는데 사라졌다"로 이어진다.
    const noPackage = await pool.query(`
      SELECT r.id AS "매출ID", m.name AS "회원", r."subType" AS "구분",
             r.sessions AS "횟수", r.amount AS "금액", r."paymentDate" AS "결제일"
      FROM revenue_entries r
      JOIN members m ON m.id = r."memberId"
      WHERE r.type = 'PT'
        AND r."subType" IS DISTINCT FROM '이전'
        AND NOT EXISTS (SELECT 1 FROM pt_packages p WHERE p."revenueEntryId" = r.id)
        -- 양도로 받은 패키지는 매출 연결 없이 넘어오는 게 정상이라 오탐을 낸다.
        -- 양수인이 아직 쓰고 있는 패키지가 있으면 제외한다(황동성 사례).
        AND NOT EXISTS (
          SELECT 1 FROM transfer_contracts tc
          WHERE tc.status = 'completed'
            AND tc."itemType" = 'pt_package'
            AND tc."transfereeMemberId" = r."memberId"
        )
      ORDER BY r."paymentDate" DESC NULLS LAST
      LIMIT 50
    `);
    groups.push({
      key: "revenue_without_package",
      title: "PT 매출이 있는데 패키지가 없음",
      severity: "critical",
      description: "결제는 받았는데 회원에게 PT 패키지가 안 만들어진 상태입니다. 회원 화면에 PT가 안 보입니다.",
      rows: noPackage.rows,
    });

    // ② 회당 단가 비정상 — 매출 입력 시 횟수 오타.
    //    서비스 세션 패키지(serviceSessions>0)는 무상이라 단가가 원래 이상하므로 제외.
    const badPrice = await pool.query(`
      SELECT p.id AS "패키지ID", m.name AS "회원", p."packageName" AS "프로그램",
             p."totalSessions" AS "횟수", p."paymentAmount" AS "결제금액",
             ROUND(p."paymentAmount"::numeric / NULLIF(p."totalSessions", 0)) AS "회당단가"
      FROM pt_packages p
      JOIN members m ON m.id = p."memberId"
      WHERE COALESCE(p."serviceSessions", 0) = 0
        AND COALESCE(p."totalSessions", 0) > 0
        AND COALESCE(p."paymentAmount", 0) > 0
        AND (
          p."paymentAmount"::numeric / p."totalSessions" > ${PRICE_MAX}
          OR p."paymentAmount"::numeric / p."totalSessions" < ${PRICE_MIN}
        )
      ORDER BY (p."paymentAmount"::numeric / p."totalSessions") DESC
      LIMIT 50
    `);
    groups.push({
      key: "abnormal_price",
      title: "회당 단가가 비정상",
      severity: "critical",
      description: `결제금액 ÷ 횟수가 ${PRICE_MIN.toLocaleString()}원~${PRICE_MAX.toLocaleString()}원 범위를 벗어났습니다. 매출 입력 시 횟수 오타일 가능성이 큽니다. 단가가 틀리면 트레이너 정산도 틀어집니다.`,
      rows: badPrice.rows,
    });

    // ③ 수업일지가 패키지에 연결 안 됨 — 정산 0원 사고의 직접 원인.
    const orphanLogs = await pool.query(`
      SELECT sl.id AS "일지ID", COALESCE(m.name, sl."memberName") AS "회원",
             sl."sessionDate" AS "수업일", t."trainerName" AS "트레이너"
      FROM pt_session_logs sl
      LEFT JOIN members m ON m.id = sl."memberId"
      LEFT JOIN trainers t ON t.id = sl."trainerId"
      WHERE sl."packageId" IS NULL
        AND (sl."isDraft" IS NULL OR sl."isDraft" = 0)
      ORDER BY sl."sessionDate" DESC
      LIMIT 50
    `);
    groups.push({
      key: "orphan_session_logs",
      title: "수업일지가 패키지에 연결 안 됨",
      severity: "critical",
      description: "패키지가 없으면 단가를 못 찾아 트레이너 정산에서 0원으로 잡힙니다.",
      rows: orphanLogs.rows,
    });

    // ④ 이름+전화가 같은 중복 회원 — 등록이 두 레코드로 갈려 "PT가 사라졌다"로 보인다.
    const dupMembers = await pool.query(`
      SELECT m.id AS "회원ID", m.name AS "회원", m.phone AS "연락처",
             m."membershipEnd" AS "회원권만료",
             (SELECT COUNT(*) FROM pt_packages p WHERE p."memberId" = m.id) AS "PT패키지",
             (SELECT COUNT(*) FROM revenue_entries r WHERE r."memberId" = m.id) AS "매출건수"
      FROM members m
      WHERE regexp_replace(COALESCE(m.phone, ''), '[^0-9]', '', 'g') <> ''
        AND (m.name, regexp_replace(COALESCE(m.phone, ''), '[^0-9]', '', 'g')) IN (
          SELECT name, regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g')
          FROM members WHERE phone IS NOT NULL
          GROUP BY 1, 2 HAVING COUNT(*) > 1
        )
      ORDER BY m.name, m.id
      LIMIT 50
    `);
    // ③-2 같은 회원·같은 날짜에 수업일지가 두 건 이상.
    //     수업을 몰아서 입력하는 트레이너가 이미 넣은 날을 다시 넣으면 생긴다
    //     (김현석 트레이너 3건: 당일 입력 후 며칠 뒤 몰아넣기 때 같은 날짜 재입력).
    //     정산은 회원·날짜로 묶어 한 번만 세지만 usedSessions는 로그 수만큼 올라가,
    //     하지 않은 수업이 차감되고 회원 잔여가 실제보다 줄어든다.
    const dupSessionDate = await pool.query(`
      SELECT m.name AS "회원", COALESCE(t."trainerName", '(없음)') AS "트레이너",
             sl."sessionDate" AS "수업일", COUNT(*) AS "중복건수",
             string_agg(sl.id::text || '(' || substring(sl."createdAt", 1, 16) || ' 입력)',
                        ' / ' ORDER BY sl."createdAt") AS "입력내역"
      FROM pt_session_logs sl
      JOIN members m ON m.id = sl."memberId"
      LEFT JOIN trainers t ON t.id = sl."trainerId"
      WHERE (sl."isDraft" IS NULL OR sl."isDraft" = 0)
      GROUP BY m.name, t."trainerName", sl."memberId", sl."sessionDate"
      HAVING COUNT(*) > 1
      ORDER BY COUNT(*) DESC, m.name
      LIMIT 50
    `);
    groups.push({
      key: "duplicate_session_date",
      title: "같은 날짜에 수업일지가 두 건",
      severity: "critical",
      description: "하루에 두 번 수업한 게 아니라면 같은 수업을 두 번 입력한 것입니다. 하지 않은 수업이 차감돼 회원 잔여가 실제보다 줄어듭니다. 수업을 몰아서 입력할 때 자주 생깁니다.",
      rows: dupSessionDate.rows,
    });

    // ③-2 출석체크와 수업일지의 날짜가 어긋난 건.
    //     정산은 회원·날짜로 묶어 세므로, 한쪽에만 있는 날은 단가 폴백을 타거나
    //     아예 빠질 수 있다. (2026-09 확인: 전 트레이너 24건이 정산에서 누락)
    const attLogMismatch = await pool.query(`
      SELECT * FROM (
        SELECT m.name AS "회원", COALESCE(t."trainerName", '(없음)') AS "트레이너",
               ac."checkDate" AS "날짜", '출석체크만 있음 (수업일지 없음)' AS "상태"
        FROM attendance_checks ac
        JOIN members m ON m.id = ac."memberId"
        LEFT JOIN trainers t ON t.id = ac."trainerId"
        WHERE ac.status = 'attended'
          AND NOT EXISTS (
            SELECT 1 FROM pt_session_logs sl
            WHERE sl."memberId" = ac."memberId" AND sl."sessionDate" = ac."checkDate"
              AND (sl."isDraft" IS NULL OR sl."isDraft" = 0))
        UNION ALL
        SELECT m.name, COALESCE(t."trainerName", '(없음)'),
               sl."sessionDate", '수업일지만 있음 (출석체크 없음)'
        FROM pt_session_logs sl
        JOIN members m ON m.id = sl."memberId"
        LEFT JOIN trainers t ON t.id = sl."trainerId"
        WHERE (sl."isDraft" IS NULL OR sl."isDraft" = 0)
          AND NOT EXISTS (
            SELECT 1 FROM attendance_checks ac
            WHERE ac."memberId" = sl."memberId" AND ac."checkDate" = sl."sessionDate"
              AND ac.status = 'attended')
      ) x
      ORDER BY "날짜" DESC, "회원"
      LIMIT 100
    `);
    groups.push({
      key: "attendance_log_mismatch",
      title: "출석체크와 수업일지 날짜가 안 맞음",
      severity: "warning",
      description: "출석체크·수업일지는 같은 수업을 가리켜야 합니다. 한쪽만 있으면 그 수업의 단가를 패키지에서 못 찾아 정산 금액이 어긋납니다. 수업 후 둘 다 기록하도록 하세요.",
      rows: attLogMismatch.rows,
    });

    // ③-3 전량 서비스(무료) 패키지에 결제금액이 붙어 있는 건.
    //     회당 단가가 결제금액÷횟수로 계산돼 무료 수업이 유료로 정산된다.
    //     (2026-09 사고: 서비스 3회 패키지에 138만원이 남아 회당 46만원으로 잡힘)
    const svcPkgWithAmount = await pool.query(`
      SELECT m.name AS "회원", COALESCE(t."trainerName", '(없음)') AS "트레이너",
             p.id AS "패키지ID", p."packageName" AS "프로그램",
             p."totalSessions" AS "총횟수", p."serviceSessions" AS "서비스횟수",
             p."paymentAmount" AS "붙어있는금액",
             ROUND(p."paymentAmount"::numeric / NULLIF(p."totalSessions", 0)) AS "잘못될단가",
             p."serviceSessionPrice" AS "정상서비스단가"
      FROM pt_packages p
      JOIN members m ON m.id = p."memberId"
      LEFT JOIN trainers t ON t.id = p."trainerId"
      WHERE p."serviceSessions" > 0
        AND p."serviceSessions" >= p."totalSessions"
        AND COALESCE(p."paymentAmount", 0) > 0
      ORDER BY p."paymentAmount" DESC
      LIMIT 50
    `);
    groups.push({
      key: "service_package_with_amount",
      title: "무료(서비스) 패키지에 결제금액이 붙음",
      severity: "critical",
      description: "전부 서비스로 준 무료 패키지인데 결제금액이 남아 있습니다. 무료 수업이 회당 수십만원으로 정산될 수 있습니다. 등록 화면에서 금액을 0으로 정정하세요.",
      rows: svcPkgWithAmount.rows,
    });

    // ④-1 양도가 완료됐는데 양도인 패키지가 아직 살아 있음.
    //     양도는 "권리가 넘어가는" 것이라 양도인 쪽은 닫혀야 한다. 안 닫히면 같은 횟수가
    //     두 사람에게 동시에 살아 있어 이중 사용이 가능해진다.
    //     (이한솔 → 황동성 양도 완료 후에도 이한솔에게 40회가 남아 있던 사례)
    const openTransferor = await pool.query(`
      SELECT tc.id AS "양도ID", tc."transferorName" AS "양도인",
             tc."transfereeName" AS "양수인", p.id AS "패키지ID",
             (p."totalSessions" - p."usedSessions") AS "남은횟수",
             m.status AS "회원상태", tc."completedAt" AS "양도완료일"
      FROM transfer_contracts tc
      JOIN members m ON m.id = tc."transferorMemberId"
      JOIN pt_packages p ON p."memberId" = tc."transferorMemberId"
      WHERE tc.status = 'completed'
        AND tc."itemType" = 'pt_package'
        AND p.status = 'active'
        AND p."totalSessions" > p."usedSessions"
      ORDER BY tc."completedAt" DESC
      LIMIT 50
    `);
    groups.push({
      key: "transferor_still_open",
      title: "양도 완료인데 양도인 PT가 살아 있음",
      severity: "critical",
      description: "넘긴 횟수가 양도인에게도 남아 있습니다. 같은 횟수를 두 사람이 쓸 수 있어 매출·정산이 어긋납니다.",
      rows: openTransferor.rows,
    });

    // ④-2 같은 등록이 매출에 두 번 들어감 — 매출 이중계상.
    //     2026-06-12 매출 일괄 재임포트 때 기존 건과 겹쳐 들어간 사고가 있었다.
    //     회원·금액·횟수·시작일이 모두 같으면 같은 등록으로 본다.
    const dupRevenue = await pool.query(`
      SELECT m.name AS "회원", r_new.id AS "나중매출ID", r_old.id AS "먼저매출ID",
             r_new."subType" AS "나중구분", r_old."subType" AS "먼저구분",
             r_new.sessions AS "횟수", r_new.amount AS "금액", r_new."startDate" AS "시작일"
      FROM revenue_entries r_new
      JOIN revenue_entries r_old
        ON r_old."memberId" = r_new."memberId"
       AND r_old.id <> r_new.id
       AND r_old.amount = r_new.amount
       AND r_old.sessions = r_new.sessions
       AND r_old."startDate" = r_new."startDate"
       AND r_old."createdAt" < r_new."createdAt"
      JOIN members m ON m.id = r_new."memberId"
      -- 횟수·시작일·금액이 모두 있어야 "같은 등록"이라 단정할 수 있다.
      -- 이 조건이 없으면 횟수 없는 소액·0원 건(기타 항목 등)이 서로 중복으로 잡힌다.
      WHERE r_new.sessions > 0 AND r_new.amount > 0 AND r_new."startDate" IS NOT NULL
      ORDER BY m.name
      LIMIT 50
    `);
    groups.push({
      key: "duplicate_revenue",
      title: "같은 등록이 매출에 두 번 들어감",
      severity: "critical",
      description: "회원·금액·횟수·시작일이 똑같은 매출이 두 건 있습니다. 매출이 부풀려지고 패키지도 두 개 생겨 잔여 횟수가 실제보다 많아집니다.",
      rows: dupRevenue.rows,
    });

    // ④-3 매출 한 건에 패키지가 두 개 이상 — 등록 버튼 중복 클릭 등으로 생긴다.
    const dupPkgPerRev = await pool.query(`
      SELECT p."revenueEntryId" AS "매출ID", m.name AS "회원",
             COUNT(*) AS "패키지수",
             string_agg(p.id::text || ' (' || p."totalSessions" || '회·' ||
                        p."usedSessions" || '사용)', ' + ' ORDER BY p.id) AS "패키지"
      FROM pt_packages p
      JOIN members m ON m.id = p."memberId"
      WHERE p."revenueEntryId" IS NOT NULL
      GROUP BY p."revenueEntryId", m.name
      HAVING COUNT(*) > 1
      LIMIT 50
    `);
    groups.push({
      key: "multiple_packages_one_revenue",
      title: "매출 한 건에 패키지가 두 개 이상",
      severity: "critical",
      description: "결제 한 번에 패키지가 여러 개 생겼습니다. 잔여 횟수가 실제보다 많아집니다.",
      rows: dupPkgPerRev.rows,
    });

    // ④-3b 패키지는 있는데 연결된 매출이 사라짐 — 매출을 지웠는데 패키지가 남은 경우.
    //      수업까지 진행됐다면 받은 돈이 장부에서 빠진 것이라 매출 누락이다.
    //      사용 0회짜리도 함께 본다: 예전에는 startup이 자동으로 지웠지만, 그 삭제가
    //      "잘못 올린 매출 한 건을 지웠더니 회원 잔여 횟수가 통째로 사라지는" 사고를
    //      만들어서 껐다. 이제 여기 드러내고 사람이 판단한다.
    const orphanPackage = await pool.query(`
      SELECT p.id AS "패키지ID", m.name AS "회원", p."revenueEntryId" AS "사라진매출ID",
             p."packageName" AS "프로그램", p."totalSessions" AS "총횟수",
             p."usedSessions" AS "사용", p."paymentAmount" AS "결제금액", p.status AS "상태"
      FROM pt_packages p
      JOIN members m ON m.id = p."memberId"
      WHERE p."revenueEntryId" IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM revenue_entries r WHERE r.id = p."revenueEntryId")
      ORDER BY p."usedSessions" DESC, m.name
      LIMIT 50
    `);
    groups.push({
      key: "package_without_revenue",
      title: "패키지는 있는데 매출이 사라짐",
      severity: "critical",
      description: "연결된 매출 기록이 없는 패키지입니다. 사용 횟수가 0보다 크면 수업까지 진행된 것이라 받은 돈이 장부에서 빠진 상태입니다. 0회라면 매출을 잘못 지웠거나 패키지가 잘못 만들어진 것이니, 매출을 복구할지 패키지를 지울지 확인해주세요.",
      rows: orphanPackage.rows,
    });

    // ④-3c 회원 담당 트레이너와 패키지 담당 트레이너가 다른 진행 중 패키지.
    //      PT 정산은 패키지의 trainerId 기준이라, 둘이 어긋나면 실적이 엉뚱한 사람에게 잡힌다.
    //      예전에는 startup이 매 부팅마다 회원 담당으로 덮어썼는데, 그게 배포할 때마다
    //      트레이너 실적이 바뀌는 원인이었다(일부러 다르게 둔 배정까지 되돌렸다). 지금은
    //      재배정 시점에만 함께 옮기고, 남은 불일치는 여기서 확인한다.
    const trainerMismatch = await pool.query(`
      SELECT p.id AS "패키지ID", m.name AS "회원",
             tm."trainerName" AS "회원담당", tp."trainerName" AS "패키지담당",
             p."packageName" AS "프로그램", p."totalSessions" AS "총횟수",
             p."usedSessions" AS "사용", p."startDate" AS "시작일"
      FROM pt_packages p
      JOIN members m ON m.id = p."memberId"
      LEFT JOIN trainers tm ON tm.id = m."trainerId"
      LEFT JOIN trainers tp ON tp.id = p."trainerId"
      WHERE p.status = 'active'
        AND m."trainerId" IS NOT NULL
        AND p."trainerId" IS DISTINCT FROM m."trainerId"
      ORDER BY m.name
      LIMIT 50
    `);
    groups.push({
      key: "package_trainer_mismatch",
      title: "회원 담당과 패키지 담당 트레이너가 다름",
      severity: "warning",
      description: "진행 중인 PT 패키지의 담당이 회원 카드의 담당 트레이너와 다릅니다. 정산은 패키지 담당 기준이라 실적이 다른 트레이너에게 잡힙니다. 일부러 그렇게 둔 것이면 그대로 두고, 아니면 회원 정보에서 담당 트레이너를 다시 지정하면 패키지도 함께 옮겨집니다.",
      rows: trainerMismatch.rows,
    });

    // ④-3c-1 패키지 횟수가 "산 횟수"보다 적음 — 자동 보정이 깎았을 수 있는 건.
    //     매출(revenue_entries)의 sessions·serviceSessions는 startup 자동 보정이 건드린
    //     적이 없어서 원본으로 쓸 수 있다. 반대로 pt_packages.totalSessions는 과거
    //     "서비스세션 이중계산 보정"이 재시작마다 반으로 줄이는 버그가 있었다
    //     (8회 → 4회 → 2회). 그 흔적을 여기서 드러낸다.
    const sessionsShort = await pool.query(`
      SELECT m.name AS "회원", COALESCE(t."trainerName",'(없음)') AS "트레이너",
             p.id AS "패키지ID", p."packageName" AS "프로그램",
             p."totalSessions" AS "현재총횟수",
             (COALESCE(r.sessions,0) + COALESCE(r."serviceSessions",0)) AS "매출기준총횟수",
             ((COALESCE(r.sessions,0) + COALESCE(r."serviceSessions",0)) - p."totalSessions") AS "부족한횟수",
             COALESCE(p."usedSessions",0) AS "저장된사용", logs.cnt AS "수업일지",
             p."startDate" AS "시작일", p.status AS "상태"
      FROM pt_packages p
      JOIN members m ON m.id = p."memberId"
      LEFT JOIN trainers t ON t.id = p."trainerId"
      JOIN revenue_entries r ON r.id = p."revenueEntryId"
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int AS cnt FROM pt_session_logs sl
        WHERE sl."packageId" = p.id AND (sl."isDraft" IS NULL OR sl."isDraft" = 0)
      ) logs ON true
      WHERE r.type = 'PT'
        AND p.status <> 'refunded'
        AND (COALESCE(r.sessions,0) + COALESCE(r."serviceSessions",0)) > p."totalSessions"
      ORDER BY ((COALESCE(r.sessions,0) + COALESCE(r."serviceSessions",0)) - p."totalSessions") DESC
      LIMIT 50
    `);
    groups.push({
      key: "package_sessions_short",
      title: "패키지 횟수가 결제한 횟수보다 적음",
      severity: "critical",
      description: "결제 기록에는 더 많은 횟수를 샀는데 패키지에는 적게 들어가 있습니다. 회원이 쓸 수 있는 잔여가 실제보다 적게 나옵니다. '매출기준총횟수'가 결제 근거이고 '현재총횟수'가 지금 값이니, 회원에게 안내한 횟수와 대조해 패키지를 고쳐주세요.",
      rows: sessionsShort.rows,
    });

    // ④-3c-2 서비스세션 패키지 횟수 ↔ 매출에 기록된 서비스 횟수 대조.
    //     서비스세션은 무상이라 패키지에 매출이 안 붙는 경우가 많아 위 대조에서 빠진다.
    //     대신 회원 단위로 "매출에 적힌 서비스 횟수 합"과 비교한다.
    const serviceSessionMismatch = await pool.query(`
      SELECT m.name AS "회원", COALESCE(t."trainerName",'(없음)') AS "트레이너",
             pkg."패키지수", pkg."서비스패키지횟수합", svc."매출서비스횟수합",
             (svc."매출서비스횟수합" - pkg."서비스패키지횟수합") AS "차이",
             pkg."사용합", pkg."가장오래된등록일"
      FROM members m
      LEFT JOIN trainers t ON t.id = m."trainerId"
      JOIN LATERAL (
        SELECT COUNT(*)::int AS "패키지수",
               COALESCE(SUM(p."totalSessions"),0)::int AS "서비스패키지횟수합",
               COALESCE(SUM(p."usedSessions"),0)::int AS "사용합",
               MIN(p."createdAt") AS "가장오래된등록일"
        FROM pt_packages p
        WHERE p."memberId" = m.id AND p."packageName" = '서비스세션' AND p.status <> 'refunded'
      ) pkg ON true
      JOIN LATERAL (
        SELECT COALESCE(SUM(r."serviceSessions"),0)::int AS "매출서비스횟수합"
        FROM revenue_entries r
        WHERE r."memberId" = m.id AND r.type = 'PT'
      ) svc ON true
      WHERE pkg."패키지수" > 0
        AND pkg."서비스패키지횟수합" <> svc."매출서비스횟수합"
      ORDER BY ABS(svc."매출서비스횟수합" - pkg."서비스패키지횟수합") DESC
      LIMIT 50
    `);
    groups.push({
      key: "service_sessions_mismatch",
      title: "서비스 횟수가 등록 기록과 다름",
      severity: "warning",
      description: "무상으로 준 서비스 횟수가 등록 당시 기록과 다릅니다. '매출서비스횟수합'이 등록할 때 적어둔 값이고 '서비스패키지횟수합'이 지금 회원에게 잡혀 있는 값입니다. 차이가 양수면 회원이 받을 횟수가 줄어든 상태입니다. 등록 당시 안내한 서비스 횟수와 대조해주세요.",
      rows: serviceSessionMismatch.rows,
    });

    // ④-3c-3 양도 처리된 패키지의 사용 횟수 검증.
    //     과거 startup에 특정 회원 이름으로 "usedSessions = 총횟수 − 8" 을 매 부팅마다
    //     덮어쓰는 코드가 있었다. 재등록한 새 패키지까지 양도 처리로 바뀌었다.
    //     수업일지 개수와 양도 계약서를 나란히 보여 실제 값과 대조할 수 있게 한다.
    const transferredCheck = await pool.query(`
      SELECT m.name AS "회원", p.id AS "패키지ID", p."packageName" AS "프로그램",
             p."totalSessions" AS "총횟수", COALESCE(p."usedSessions",0) AS "저장된사용",
             logs.cnt AS "수업일지", (COALESCE(p."usedSessions",0) - logs.cnt) AS "차이",
             COALESCE(tc."itemDescription", '(양도 계약서 없음)') AS "양도계약",
             COALESCE(tc.status, '-') AS "계약상태",
             p."startDate" AS "시작일", p."updatedAt" AS "최종변경"
      FROM pt_packages p
      JOIN members m ON m.id = p."memberId"
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int AS cnt FROM pt_session_logs sl
        WHERE sl."packageId" = p.id AND (sl."isDraft" IS NULL OR sl."isDraft" = 0)
      ) logs ON true
      LEFT JOIN transfer_contracts tc
        ON tc."itemType" = 'pt_package' AND tc."itemId" = p.id
      WHERE p.status = 'transferred'
      ORDER BY (tc.id IS NULL) DESC, ABS(COALESCE(p."usedSessions",0) - logs.cnt) DESC
      LIMIT 50
    `);
    groups.push({
      key: "transferred_package_check",
      title: "양도 처리된 패키지 사용 횟수 확인",
      severity: "warning",
      description: "양도로 닫힌 패키지입니다. '양도계약'이 '(양도 계약서 없음)'이면 실제 양도가 아니라 잘못 닫혔을 수 있으니 먼저 보세요. '저장된사용'과 '수업일지'가 다른 것은 정상일 수 있습니다(시스템 도입 전 수업이나 오프라인 수업은 일지가 없습니다) — 양도한 횟수가 맞는지만 계약서와 대조해주세요.",
      rows: transferredCheck.rows,
    });

    // ④-3c-4 같은 날 중복 수업일지 때문에 잔여가 실제보다 적게 깎인 패키지.
    //     정산은 회원·날짜로 묶어 한 번만 세는데, usedSessions 동기화는 로그 건수를
    //     그대로 셌다. 게다가 상향만 하므로(원칙 9) 중복 일지를 나중에 지워도 잔여가
    //     돌아오지 않는다. 동기화 기준은 고쳤지만 이미 부푼 값은 사람이 확인해서 고쳐야
    //     한다(사용 횟수의 원본은 사람이 입력한 값이다 — 원칙 3).
    //     "저장된사용 >= 수업일지건수" 조건으로, 동기화가 부푼 값을 그대로 넣은 건만 본다.
    const inflatedUsed = await pool.query(`
      SELECT m.name AS "회원", COALESCE(t."trainerName",'(없음)') AS "트레이너",
             p.id AS "패키지ID", p."packageName" AS "프로그램",
             p."totalSessions" AS "총횟수",
             COALESCE(p."usedSessions",0) AS "저장된사용",
             l.total AS "수업일지건수", l.days AS "실제수업일수",
             (l.total - l.days) AS "중복건수",
             (p."totalSessions" - COALESCE(p."usedSessions",0)) AS "현재잔여",
             (p."totalSessions" - COALESCE(p."usedSessions",0) + (l.total - l.days)) AS "바로잡은잔여"
      FROM pt_packages p
      JOIN members m ON m.id = p."memberId"
      LEFT JOIN trainers t ON t.id = p."trainerId"
      JOIN LATERAL (
        SELECT COUNT(*)::int AS total, COUNT(DISTINCT sl."sessionDate")::int AS days
        FROM pt_session_logs sl
        WHERE sl."packageId" = p.id AND (sl."isDraft" IS NULL OR sl."isDraft" = 0)
      ) l ON true
      WHERE l.total > l.days
        AND COALESCE(p."usedSessions",0) >= l.total
        AND p.status <> 'refunded'
      ORDER BY (l.total - l.days) DESC, m.name
      LIMIT 50
    `);
    groups.push({
      key: "inflated_used_sessions",
      title: "중복 수업일지로 잔여가 덜 남은 회원",
      severity: "critical",
      description: "같은 날짜에 수업일지가 두 번 이상 들어가, 하지 않은 수업이 잔여에서 차감됐습니다. '바로잡은잔여'가 정상값입니다. 담당 트레이너에게 실제 수업 횟수를 확인한 뒤, 회원 상세에서 사용 횟수를 고쳐주세요. 중복 일지도 함께 정리해야 합니다.",
      rows: inflatedUsed.rows,
    });

    // ④-3c-5 수업일이 패키지 시작일보다 앞선 세션 — 패키지 오배정.
    //     예전 "세션-패키지 재연결" 보정이 회원당 패키지 하나(최신 활성)만 골라
    //     날짜를 보지 않고 몰아넣었다. 그래서 5월 수업이 7월 시작 재등록 패키지에
    //     붙는 일이 생겼다(최문욱 5/12·5/15 → 7/10 시작 패키지).
    //     이전 패키지 잔여는 남고 새 패키지는 시작 전부터 깎여 양쪽이 다 틀어진다.
    //     보정 로직은 날짜 기준으로 고쳤지만, 이미 옮겨진 건은 사람이 확인해야 한다.
    const logBeforeStart = await pool.query(`
      SELECT m.name AS "회원", COALESCE(t."trainerName",'(없음)') AS "트레이너",
             sl.id AS "일지ID", sl."sessionDate" AS "수업일",
             p.id AS "붙은패키지", p."packageName" AS "프로그램",
             p."startDate" AS "패키지시작일",
             (SELECT p2.id FROM pt_packages p2
               WHERE p2."memberId" = sl."memberId"
                 AND (COALESCE(p2."pricePerSession",0) > 0 OR COALESCE(p2."paymentAmount",0) > 0)
                 AND (p2."startDate" IS NULL OR p2."startDate" <= sl."sessionDate")
               ORDER BY p2."startDate" DESC NULLS LAST, p2.id DESC
               LIMIT 1) AS "가야할패키지"
      FROM pt_session_logs sl
      JOIN pt_packages p ON p.id = sl."packageId"
      JOIN members m ON m.id = sl."memberId"
      LEFT JOIN trainers t ON t.id = sl."trainerId"
      WHERE (sl."isDraft" IS NULL OR sl."isDraft" = 0)
        AND sl."sessionDate" IS NOT NULL
        AND p."startDate" IS NOT NULL
        AND sl."sessionDate" < p."startDate"
      ORDER BY m.name, sl."sessionDate"
      LIMIT 50
    `);
    groups.push({
      key: "log_before_package_start",
      title: "수업일이 패키지 시작일보다 앞섬",
      severity: "critical",
      description: "이 수업은 아직 시작하지도 않은 패키지에서 차감되고 있습니다. 이전 패키지 잔여는 남고 새 패키지는 시작 전부터 깎여, 양쪽 잔여가 모두 틀어집니다. '가야할패키지'가 수업일 기준으로 맞는 패키지입니다. 담당 트레이너에게 확인한 뒤 옮기고, 두 패키지의 사용 횟수를 함께 맞춰주세요.",
      rows: logBeforeStart.rows,
    });

    // ④-3c-6 시스템 사용 이후(2026-05~) 패키지인데 사용 횟수가 수업일지보다 많음.
    //     그 이전 패키지는 오프라인·도입 전 수업이라 일지가 없는 게 정상이므로 제외한다
    //     (원칙 9: 수업일지 개수 ≠ 사용 횟수). 2026-05 이후 건은 일지가 있어야 맞다.
    const usedOverLogs = await pool.query(`
      SELECT m.name AS "회원", COALESCE(t."trainerName",'(없음)') AS "트레이너",
             p.id AS "패키지ID", p."packageName" AS "프로그램",
             p."totalSessions" AS "총횟수", COALESCE(p."usedSessions",0) AS "저장된사용",
             l.days AS "수업일지수",
             (COALESCE(p."usedSessions",0) - l.days) AS "근거없는차감",
             (p."totalSessions" - COALESCE(p."usedSessions",0)) AS "현재잔여",
             (p."totalSessions" - l.days) AS "일지기준잔여",
             COALESCE(p."paymentDate", p."startDate", r."paymentDate") AS "결제일",
             p.status AS "상태"
      FROM pt_packages p
      JOIN members m ON m.id = p."memberId"
      LEFT JOIN trainers t ON t.id = p."trainerId"
      LEFT JOIN revenue_entries r ON r.id = p."revenueEntryId"
      JOIN LATERAL (
        SELECT COUNT(DISTINCT sl."sessionDate")::int AS days
        FROM pt_session_logs sl
        WHERE sl."packageId" = p.id AND (sl."isDraft" IS NULL OR sl."isDraft" = 0)
      ) l ON true
      WHERE p.status <> 'refunded'
        AND COALESCE(p."serviceSessions",0) = 0
        AND COALESCE(p."paymentDate", p."startDate", r."paymentDate") >= '2026-05-01'
        AND COALESCE(p."usedSessions",0) > l.days
      ORDER BY (COALESCE(p."usedSessions",0) - l.days) DESC, m.name
      LIMIT 50
    `);
    groups.push({
      key: "used_over_logs",
      title: "수업 기록보다 많이 차감된 패키지",
      severity: "warning",
      description: "시스템을 쓰기 시작한 2026-05 이후에 결제된 패키지인데, 수업일지 수보다 사용 횟수가 많습니다. 그만큼 근거 없이 잔여가 깎여 있습니다. 다만 일지를 안 쓰고 진행한 수업이 있으면 정상이므로, 담당 트레이너에게 확인한 뒤 회원 상세에서 사용 횟수를 고쳐주세요. (2026-04 이전 건은 도입 전 수업이라 일지가 없는 게 정상이므로 제외했습니다.)",
      rows: usedOverLogs.rows,
    });

    // ④-3c-7 다이어트 매출은 있는데 프로그램이 없는 회원.
    //     등록 화면에서 시작 체중을 비운 채 저장하면 예전에는 매출도 프로그램도 만들지
    //     않고 조용히 넘어갔다(지금은 막는다). 매출만 다른 경로로 들어간 경우도 여기 잡힌다.
    //     프로그램이 없으면 회원 앱에 "등록 회원이 아닙니다"만 뜨고 체중 기록도 못 한다.
    const dietRevNoProgram = await pool.query(`
      SELECT m.id AS "회원ID", m.name AS "회원", m.phone AS "연락처",
             r.id AS "매출ID", r."paymentDate" AS "결제일", r.amount AS "금액",
             r."startDate" AS "시작일", r."endDate" AS "종료일"
      FROM revenue_entries r
      JOIN members m ON m.id = r."memberId"
      WHERE r.type = '다이어트'
        AND NOT EXISTS (SELECT 1 FROM diet_programs d WHERE d."memberId" = r."memberId")
      ORDER BY r."paymentDate" DESC
      LIMIT 50
    `);
    groups.push({
      key: "diet_revenue_without_program",
      title: "다이어트 결제는 있는데 프로그램이 없음",
      severity: "critical",
      description: "결제는 받았는데 다이어트 프로그램이 만들어지지 않았습니다. 회원 앱에 '등록 회원이 아닙니다'가 뜨고 체중 기록도 못 합니다. 회원 상세의 다이어트 항목에서 시작일과 시작 체중을 넣어 프로그램을 만들어주세요. (재등록하면 매출이 중복됩니다.)",
      rows: dietRevNoProgram.rows,
    });

    // ④-3d 매출이 아예 연결되지 않은 PT 패키지.
    //      "언제 등록한 건지" 알 수 있게 생성일을 함께 보여준다. 2026-04-23은 기존 회원
    //      일괄 임포트분이고(정수연 사례: 시트상 4/08 등록), 그 외 날짜는 앱에서 수동으로
    //      만든 것이다. 어느 쪽이든 매출 기록이 없으니 받은 돈이 장부에 없다.
    //      양도로 받은 패키지는 매출 없이 넘어오는 게 정상이라 제외한다.
    const noRevenueLink = await pool.query(`
      SELECT m.name AS "회원", COALESCE(t."trainerName", '(없음)') AS "트레이너",
             p.id AS "패키지ID", p."packageName" AS "프로그램",
             p."totalSessions" AS "총횟수", p."usedSessions" AS "진행",
             p."paymentAmount" AS "적힌금액",
             substring(p."createdAt", 1, 10) AS "등록(생성)일"
      FROM pt_packages p
      JOIN members m ON m.id = p."memberId"
      LEFT JOIN trainers t ON t.id = p."trainerId"
      WHERE p."revenueEntryId" IS NULL
        AND COALESCE(p."serviceSessions", 0) = 0
        AND p.status <> 'refunded'
        AND NOT EXISTS (
          SELECT 1 FROM transfer_contracts tc
          WHERE tc.status = 'completed' AND tc."itemType" = 'pt_package'
            AND tc."transfereeMemberId" = p."memberId"
        )
      ORDER BY p."usedSessions" DESC, m.name
      LIMIT 50
    `);
    groups.push({
      key: "package_no_revenue_link",
      title: "매출이 연결되지 않은 PT 패키지",
      severity: "warning",
      description: "이 패키지에 결제 기록이 연결돼 있지 않습니다. 회원에게 다른 매출은 있을 수 있으니 '회원 매출이 없다'는 뜻은 아닙니다. 진행 횟수가 0보다 크면 수업까지 하고 결제가 안 잡힌 것이라 먼저 확인해야 합니다. 등록일로 언제 만들어진 건지 추적할 수 있습니다.",
      rows: noRevenueLink.rows,
    });

    // ④-3c 패키지 총횟수가 매출로 산 횟수보다 많음.
    //      "잔여 = 산 횟수 − 진행한 횟수"가 성립해야 하는데, 매출 근거 없는 패키지가
    //      끼면 잔여가 그만큼 부풀려진다. 정수연 사례에서 매출 없는 10회권이 잡혔고,
    //      거기 붙은 수업 4건은 실제 진행분이라 매출 자체가 누락된 상태였다.
    //      서비스 세션은 무상이라 매출이 없는 게 정상이므로 제외한다.
    const sessionMismatch = await pool.query(`
      SELECT m.name AS "회원", COALESCE(t."trainerName", '(없음)') AS "트레이너",
             rev."산횟수", pkg."패키지총횟수",
             (pkg."패키지총횟수" - rev."산횟수") AS "근거없는횟수",
             logs."진행횟수"
      FROM members m
      LEFT JOIN trainers t ON t.id = m."trainerId"
      JOIN LATERAL (
        -- '이전'(기존 회원 이관분)도 정당한 구매다. 빼면 이관 회원이 전부 오탐으로 잡힌다.
        SELECT COALESCE(SUM(r.sessions), 0)::int AS "산횟수"
        FROM revenue_entries r
        WHERE r."memberId" = m.id AND r.type = 'PT'
      ) rev ON true
      JOIN LATERAL (
        SELECT COALESCE(SUM(p."totalSessions"), 0)::int AS "패키지총횟수"
        FROM pt_packages p
        WHERE p."memberId" = m.id AND COALESCE(p."serviceSessions", 0) = 0
          AND p.status <> 'refunded'
      ) pkg ON true
      JOIN LATERAL (
        SELECT COUNT(*)::int AS "진행횟수"
        FROM pt_session_logs sl
        WHERE sl."memberId" = m.id AND (sl."isDraft" IS NULL OR sl."isDraft" = 0)
      ) logs ON true
      WHERE pkg."패키지총횟수" > rev."산횟수"
      ORDER BY (pkg."패키지총횟수" - rev."산횟수") DESC
      LIMIT 50
    `);
    groups.push({
      key: "package_exceeds_revenue",
      title: "패키지 횟수가 산 횟수보다 많음",
      severity: "critical",
      description: "매출 근거가 없는 횟수가 패키지에 들어가 있습니다. 잔여가 그만큼 부풀려집니다. 수업까지 진행됐다면 매출 자체가 누락된 것입니다.",
      rows: sessionMismatch.rows,
    });

    // ④-4 재등록했는데 이전 패키지가 잔여를 남긴 채 살아 있음.
    //     이전 권을 다 쓰고 재등록하는 게 정상 흐름인데, 이전 권이 안 닫히면
    //     잔여가 부풀려져 재등록 상담 시점을 놓친다(박인애·이인정·김승빈 사례).
    const staleOldPackage = await pool.query(`
      SELECT COALESCE(t."trainerName", '(없음)') AS "트레이너", m.name AS "회원",
             p1.id AS "이전패키지", p1."packageName" AS "프로그램",
             p1."totalSessions" AS "총횟수", p1."usedSessions" AS "사용",
             (p1."totalSessions" - p1."usedSessions") AS "남은횟수",
             p1."startDate" AS "이전시작일",
             MIN(p2."paymentDate") AS "재등록결제일",
             (SELECT SUM(q."totalSessions" - q."usedSessions") FROM pt_packages q
               WHERE q."memberId" = m.id AND q.status = 'active') AS "회원총잔여"
      FROM pt_packages p1
      JOIN members m ON m.id = p1."memberId"
      LEFT JOIN trainers t ON t.id = p1."trainerId"
      -- "새 패키지를 이미 쓰고 있을 때"로 좁히면 놓치는 사고가 있다(서해령 사례).
      -- 재등록 후 수업이 전부 이전 패키지에 계속 기록되면 새 패키지 사용은 0회로 남아
      -- 조건에 안 걸리는데, 정작 잔여는 두 패키지가 합쳐져 부풀려진다(34회로 표시됐다).
      -- 그래서 "나중에 결제된 패키지가 있는가"로 판정한다. 사용 여부는 보지 않는다.
      JOIN pt_packages p2
        ON p2."memberId" = p1."memberId" AND p2.id <> p1.id
       AND COALESCE(p2."serviceSessions", 0) = 0
       AND p2."paymentDate" > COALESCE(p1."paymentDate", '1900-01-01')
      WHERE p1.status = 'active'
        AND COALESCE(p1."serviceSessions", 0) = 0
        AND p1."totalSessions" > p1."usedSessions"
      GROUP BY 1, 2, m.id, p1.id, p1."packageName", p1."totalSessions",
               p1."usedSessions", p1."startDate"
      ORDER BY 1, 2
      LIMIT 100
    `);
    groups.push({
      key: "stale_old_package",
      title: "재등록했는데 이전 패키지가 안 닫힘",
      severity: "warning",
      description: "새 패키지를 쓰고 있는데 이전 패키지에 잔여가 남아 있습니다. 잔여가 부풀려져 재등록 상담 시점을 놓칩니다. 담당 트레이너에게 실제 사용 횟수를 확인해야 합니다.",
      rows: staleOldPackage.rows,
    });

    groups.push({
      key: "duplicate_members",
      title: "중복 회원 (이름·연락처 동일)",
      severity: "warning",
      description: "같은 사람이 두 개 레코드로 나뉘어 있습니다. 매출·수업이 갈려 기록돼 통계가 틀어집니다.",
      rows: dupMembers.rows,
    });

    // ⑤ 회원권은 만료됐는데 PT 잔여가 남음 — 환불·연장·완료 중 하나를 처리해야 한다.
    const expiredWithSessions = await pool.query(`
      SELECT m.name AS "회원", m."membershipEnd" AS "회원권만료",
             p."packageName" AS "프로그램",
             (p."totalSessions" - p."usedSessions") AS "잔여",
             t."trainerName" AS "트레이너"
      FROM pt_packages p
      JOIN members m ON m.id = p."memberId"
      LEFT JOIN trainers t ON t.id = p."trainerId"
      WHERE p.status = 'active'
        AND p."totalSessions" > p."usedSessions"
        AND m."membershipEnd" IS NOT NULL
        AND m."membershipEnd" < CURRENT_DATE::text
      ORDER BY m."membershipEnd"
      LIMIT 50
    `);
    groups.push({
      key: "expired_with_remaining",
      title: "회원권 만료인데 PT 잔여가 남음",
      severity: "warning",
      description: "종료된 회원이면 완료 처리하고, 계속 다닌다면 회원권을 연장해야 합니다. 방치하면 만료 회원이 진행중으로 잡힙니다.",
      rows: expiredWithSessions.rows,
    });

    // ⑥ 재등록 타이밍 — 잔여가 얼마 안 남은 진행중 회원. 이상이 아니라 영업 액션이다.
    const reRegister = await pool.query(`
      SELECT m.name AS "회원",
             (p."totalSessions" - p."usedSessions") AS "잔여",
             p."totalSessions" AS "총횟수",
             t."trainerName" AS "트레이너",
             m."membershipEnd" AS "회원권만료"
      FROM pt_packages p
      JOIN members m ON m.id = p."memberId"
      LEFT JOIN trainers t ON t.id = p."trainerId"
      WHERE p.status = 'active'
        AND COALESCE(p."serviceSessions", 0) = 0
        AND (p."totalSessions" - p."usedSessions") BETWEEN 0 AND ${REREGISTER_THRESHOLD}
        AND (p."startDate" IS NULL OR p."startDate" <= CURRENT_DATE::text)
      ORDER BY (p."totalSessions" - p."usedSessions"), m.name
      LIMIT 50
    `);
    groups.push({
      key: "reregister_due",
      title: `재등록 상담 대상 (잔여 ${REREGISTER_THRESHOLD}회 이하)`,
      severity: "action",
      description: "PT가 곧 끝나는 회원입니다. 마지막 수업 전에 재등록 상담이 들어가야 재등록률이 올라갑니다.",
      rows: reRegister.rows,
    });

    const totalCount = groups.reduce((s, g) => s + g.rows.length, 0);
    return { groups, totalCount, checkedAt: new Date().toISOString() };
  }),
});
