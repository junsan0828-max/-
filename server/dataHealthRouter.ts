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
