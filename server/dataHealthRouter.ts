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
    //      (사용 0회짜리는 startup 정리가 알아서 지우므로 여기선 수업이 있는 것만 본다)
    const orphanPackage = await pool.query(`
      SELECT p.id AS "패키지ID", m.name AS "회원", p."revenueEntryId" AS "사라진매출ID",
             p."packageName" AS "프로그램", p."totalSessions" AS "총횟수",
             p."usedSessions" AS "사용", p."paymentAmount" AS "결제금액", p.status AS "상태"
      FROM pt_packages p
      JOIN members m ON m.id = p."memberId"
      WHERE p."revenueEntryId" IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM revenue_entries r WHERE r.id = p."revenueEntryId")
        AND p."usedSessions" > 0
      ORDER BY m.name
      LIMIT 50
    `);
    groups.push({
      key: "package_without_revenue",
      title: "패키지는 있는데 매출이 사라짐",
      severity: "critical",
      description: "수업까지 진행된 패키지인데 연결된 매출 기록이 없습니다. 받은 돈이 매출 장부에서 빠져 있습니다.",
      rows: orphanPackage.rows,
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
      description: "결제 기록 없이 만들어진 패키지입니다. 진행 횟수가 0보다 크면 수업까지 했는데 매출이 없다는 뜻이라 먼저 확인해야 합니다. 등록일로 언제 만들어진 건지 추적할 수 있습니다.",
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
      GROUP BY 1, 2, p1.id, p1."packageName", p1."totalSessions",
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
