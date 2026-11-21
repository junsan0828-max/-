// 온라인 지부장 2차 검증 자동화.
// "온라인 지부장"은 별도 AI가 아니라 총괄 AI(제이) 자신이 협의실 루틴 안에서 맡는 역할이다
// (협의실 확인 클라우드 루틴 프롬프트에 명시됨). 사람이 서술하는 대신, 원천 DB를 직접 조회해
// 그날의 실제 수치를 협의실에 남긴다. 전일 대비 증감은 계산하지 않는다 — 원본 데이터만 공유한다.
//
// 활성회원 수는 통합운영시스템(railway: remarkable-tenderness-production, 같은 저장소의
// claude/gym-management-system-OnTMC 브랜치, client/src/pages/AdminMembers.tsx, 2026-08-12 커밋
// 58fa091 "회원 통계 정확도 개선")이 확정한 정의를 그대로 쓴다:
//   활성 = status='active' AND (membershipEnd IS NULL OR membershipEnd >= 오늘)
// status만 보면(구버전 정의) membershipEnd가 지났는데 상태만 안 바뀐 회원까지 활성으로 잡혀 실제보다
// 부풀려진다 — 활성+만료+정지가 정확히 전체와 일치하는 걸로 이미 검증된 정의라 그대로 재사용한다.
import { neon } from "@neondatabase/serverless";
import { GymContext } from "./data";
import { todayStr, addDays, findExpiryCandidates, findConsultFollowupCandidates } from "./autoMessage";

function kstDate(offsetDays = 0): string {
  const d = new Date(Date.now() + offsetDays * 864e5);
  return d.toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
}

export interface ScopeSnapshot {
  scope: "전체" | "1호점" | "2호점";
  branchId: number; // 0 = 전체
  activeNow: number; // AdminMembers.tsx와 동일 정의(status='active' AND 미만료)
  contractAmount: number; // 이번달 누계
  monthRevenue: number; // 이번달 누계
  refundAmount: number; // 이번달 누계
  newCount: number; // 이번달 누계
  reRegisterCount: number; // 이번달 누계
}

export interface TodayTransaction {
  subType: string;
  branchId: number | null;
  amount: number;
  paidAmount: number;
  refundAmount: number;
  unpaidAmount: number;
  customerName: string | null;
  phone: string | null;
  programDetail: string | null; // 프로그램명 (예: "헬스 12개월")
  sessions: number | null; // PT라면 등록 회차, 아니면 null
}

export interface ExpiryHistoryItem {
  category: "expiry_d10" | "expiry_d5";
  name: string;
  phone: string | null;
  branchId: number | null;
  membershipEnd: string;
  sent: boolean; // auto_message_log 기준 발송 성공 여부
}

/** 기준일(reference_date)이 이미 지났는데 auto_message_log에 성공 기록이 하나도 없는 만료 안내.
 * 클라우드 실행은 알리고 IP 인증에서 막혀 실패로만 기록되고("인증되지 않는 서버 IP", "클라우드에서는
 * 발송 안 함"), 보통은 로컬 PC가 같은 날 재시도해 성공한다. 그 재시도가 일어나지 않은 날의 대상은
 * 아무 안내도 받지 못한 채 만료일이 지나가는데, 기존 리포트는 "오늘 대상"만 보여줘서 이게 보이지
 * 않았다. 발송은 하지 않고 조회만 한다 — 누락을 매일 눈에 보이게 하는 것이 목적이다. */
export interface MissedSendItem {
  category: "expiry_d10" | "expiry_d5";
  name: string;
  phone: string | null;
  branchId: number | null;
  referenceDate: string; // 발송 기준일(= 회원의 만료일)
  attempts: number; // 실패로 기록된 시도 횟수
  lastError: string | null;
}

export interface ConsultFollowupItem {
  name: string | null;
  phone: string | null;
  consultationDate: string; // 상담일(D0)
  sent: boolean; // D+1 후속 문자 발송 성공 여부
  registered: boolean; // 현재 리드 상태가 등록완료인지
}

export interface VerificationResult {
  asOfDate: string; // KST YYYY-MM-DD
  asOfTimestamp: string; // ISO
  scopes: ScopeSnapshot[];
  activeMethodNote: string; // 활성회원 산정 방식 출처
  todayTransactions: TodayTransaction[];
  unpaidMembersNow: { name: string; phone: string | null; branchId: number | null; unpaid: number }[];
  expiringWithin10: { name: string; phone: string | null; branchId: number | null; membershipEnd: string; daysLeft: number }[];
  expiryHistory: ExpiryHistoryItem[]; // 오늘 기준 D-10·D-5 대상자와 발송 이력
  consultFollowup: ConsultFollowupItem[]; // 어제 상담 완료 → 오늘 D+1 후속 대상, 발송·등록전환 여부
  missedExpirySends: MissedSendItem[]; // 기준일이 지났는데 끝까지 발송 성공 못한 만료 안내(최근 45일)
}

type Sql = ReturnType<typeof neon<false, false>>;
type MoneyRow = { branchId: number | null; amount: string; paidAmount: string; refundAmount: string; subType: string };

async function monthToDate(sql: Sql, monthStart: string, asOfDate: string) {
  const rows = (await sql.query(
    `SELECT "branchId", "subType", amount, "paidAmount", "refundAmount"
     FROM revenue_entries
     WHERE "paymentDate" >= $1 AND "paymentDate" <= $2`,
    [monthStart, asOfDate]
  )) as MoneyRow[];

  const sumFor = (branchId: number | null) => {
    const filtered = branchId === null ? rows : rows.filter((r) => r.branchId === branchId);
    return {
      contractAmount: filtered.reduce((s, r) => s + Number(r.amount || 0), 0),
      monthRevenue: filtered.reduce((s, r) => s + Number(r.paidAmount || 0), 0),
      refundAmount: filtered.reduce((s, r) => s + Number(r.refundAmount || 0), 0),
      newCount: filtered.filter((r) => r.subType === "신규").length,
      reRegisterCount: filtered.filter((r) => r.subType === "재등록").length,
    };
  };

  return [sumFor(null), sumFor(1), sumFor(2)];
}

/** 현재 활성회원 — AdminMembers.tsx(2026-08-12 commit 58fa091)와 동일 정의:
 * status='active' AND (membershipEnd가 없거나 오늘 이후). */
async function activeNow(sql: Sql, todayDate: string, branchId: number | null): Promise<number> {
  const rows = (
    branchId == null
      ? await sql.query(
          `SELECT COUNT(*)::int c FROM members WHERE status = 'active' AND ("membershipEnd" IS NULL OR "membershipEnd" >= $1)`,
          [todayDate]
        )
      : await sql.query(
          `SELECT COUNT(*)::int c FROM members WHERE status = 'active' AND ("membershipEnd" IS NULL OR "membershipEnd" >= $1) AND "branchId" = $2`,
          [todayDate, branchId]
        )
  ) as { c: number }[];
  return Number(rows[0]?.c ?? 0);
}

/** ctx는 반드시 gatherContext()의 실DB 조회 결과(source === "db")여야 한다 — 호출부(verify-cli.ts)에서
 * source 체크 후 호출한다. */
export async function runVerification(ctx: GymContext): Promise<VerificationResult> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL 미설정 — 실 DB 대조 불가");
  const sql = neon(url);

  const today = kstDate(0);
  const monthStart = `${today.slice(0, 7)}-01`;

  const [moneyByScope, activeByScope] = await Promise.all([
    monthToDate(sql, monthStart, today),
    Promise.all([null, 1, 2].map((b) => activeNow(sql, today, b))),
  ]);

  const scopeNames: ScopeSnapshot["scope"][] = ["전체", "1호점", "2호점"];
  const scopeBranchIds = [0, 1, 2];
  const scopes: ScopeSnapshot[] = moneyByScope.map((m, i) => ({
    scope: scopeNames[i],
    branchId: scopeBranchIds[i],
    activeNow: activeByScope[i],
    ...m,
  }));

  const todayTxRows = (await sql.query(
    `SELECT "subType","branchId",amount,"paidAmount","refundAmount","unpaidAmount","customerName",phone,"programDetail",sessions
     FROM revenue_entries WHERE "paymentDate" = $1 ORDER BY "paymentDate"`,
    [today]
  )) as any[];

  const todayTransactions: TodayTransaction[] = todayTxRows.map((r) => ({
    subType: r.subType,
    branchId: r.branchId,
    amount: Number(r.amount),
    paidAmount: Number(r.paidAmount),
    refundAmount: Number(r.refundAmount),
    unpaidAmount: Number(r.unpaidAmount),
    customerName: r.customerName,
    phone: r.phone,
    programDetail: r.programDetail ?? null,
    sessions: r.sessions === null || r.sessions === undefined ? null : Number(r.sessions),
  }));

  const [expiryHistory, consultFollowup, missedExpirySends] = await Promise.all([
    gatherExpiryHistory(sql, today),
    gatherConsultFollowup(sql, today),
    gatherMissedExpirySends(sql),
  ]);

  return {
    asOfDate: today,
    asOfTimestamp: new Date().toISOString(),
    scopes,
    activeMethodNote:
      "activeNow는 통합운영시스템 AdminMembers.tsx(2026-08-12 commit 58fa091)와 동일 정의: status='active' AND (membershipEnd 없음 또는 오늘 이후) — 대표가 실제로 보는 회원관리 화면과 정확히 일치.",
    todayTransactions,
    unpaidMembersNow: ctx.money.unpaidMembers,
    expiringWithin10: ctx.members.expiringSoon
      .filter((m) => m.daysUntilExpiry <= 10)
      .map((m) => ({ name: m.name, phone: m.phone, branchId: m.branchId, membershipEnd: m.membershipEnd, daysLeft: m.daysUntilExpiry })),
    expiryHistory,
    consultFollowup,
    missedExpirySends,
  };
}

/** 기준일이 이미 지났는데 성공 기록이 없는 만료 안내(최근 45일). reference_date는 text 컬럼이라
 * 날짜 비교 전에 형식을 걸러 캐스팅한다. 조회 전용 — 여기서 재발송은 하지 않는다.
 *
 * 2026-11-22: 발송 실패 이후 회원이 이미 연장·재등록한 경우는 제외한다. 안내를 못 보낸 것은
 * 사실이지만 지금 보낼 이유가 없는 대상이라, 섞어서 보여주면 "재발송 필요" 건수가 부풀려진다.
 * (실측: 26건 중 10건이 이미 연장 완료 — 허인회·임수빈·허삼정·권세훈·김영준·안비원·신현식·김은영)
 * 제외 기준은 현재 membershipEnd가 당시 만료일보다 뒤로 밀렸거나, status가 active가 아니거나,
 * 환불·양도 계약이 생긴 경우로, D-10·D-5 발송 대상 조건(findExpiryCandidates)과 같은 기준이다.
 * membershipEnd도 reference_date와 마찬가지로 text 컬럼이라 캐스팅 전에 형식을 걸러야 한다. */
async function gatherMissedExpirySends(sql: Sql): Promise<MissedSendItem[]> {
  const rows = (await sql.query(
    `SELECT a.category, a.reference_date AS "referenceDate", a.name, a.branch_id AS "branchId",
            max(a.phone) AS phone, count(*)::int AS attempts, max(a.error) AS "lastError"
     FROM auto_message_log a
     WHERE a.category IN ('expiry_d10','expiry_d5')
       AND a.reference_date ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
       AND a.reference_date::date BETWEEN (CURRENT_DATE - 45) AND CURRENT_DATE
       AND NOT EXISTS (
         SELECT 1 FROM auto_message_log b
         WHERE b.category = a.category AND b.reference_date = a.reference_date
           AND coalesce(b.member_id, -1) = coalesce(a.member_id, -1)
           AND b.success = true)
       AND NOT EXISTS (
         SELECT 1 FROM members m
         WHERE m.id = a.member_id
           AND ((m."membershipEnd" ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}'
                 AND substring(m."membershipEnd" from 1 for 10)::date > a.reference_date::date)
                OR m.status <> 'active'
                OR EXISTS (SELECT 1 FROM refund_contracts r
                           WHERE r."memberId" = m.id AND r.status IN ('completed', 'pending'))
                OR EXISTS (SELECT 1 FROM transfer_contracts t
                           WHERE t."transferorMemberId" = m.id OR t."transfereeMemberId" = m.id)))
     GROUP BY a.category, a.reference_date, a.name, a.branch_id
     ORDER BY a.reference_date DESC, a.category`,
    []
  )) as any[];

  return rows.map((r) => ({
    category: r.category,
    name: r.name,
    phone: r.phone ?? null,
    branchId: r.branchId ?? null,
    referenceDate: r.referenceDate,
    attempts: Number(r.attempts),
    lastError: r.lastError ?? null,
  }));
}

/** 오늘 기준 D-10·D-5 대상자와 auto_message_log상 발송 성공 여부. 만료 관리는 이 규칙으로만
 * 운영한다(2026-08-20 대표 지시) — 온라인 지부장이 매일 실제 발송 이력을 확인할 수 있어야 한다. */
async function gatherExpiryHistory(sql: Sql, today: string): Promise<ExpiryHistoryItem[]> {
  const d10Target = addDays(today, 10);
  const d5Target = addDays(today, 5);
  const [d10Candidates, d5Candidates, sentRows] = await Promise.all([
    findExpiryCandidates(sql, d10Target),
    findExpiryCandidates(sql, d5Target),
    sql.query(
      `SELECT category, member_id FROM auto_message_log WHERE category IN ('expiry_d10','expiry_d5') AND reference_date = ANY($1) AND success = true`,
      [[d10Target, d5Target]]
    ) as unknown as Promise<{ category: string; member_id: number }[]>,
  ]);

  const sentSet = new Set(sentRows.map((r) => `${r.category}:${r.member_id}`));
  const toItem = (category: "expiry_d10" | "expiry_d5") => (m: { id: number; name: string; phone: string | null; branchId: number | null; membershipEnd: string }): ExpiryHistoryItem => ({
    category,
    name: m.name,
    phone: m.phone,
    branchId: m.branchId,
    membershipEnd: m.membershipEnd,
    sent: sentSet.has(`${category}:${m.id}`),
  });

  return [...d10Candidates.map(toItem("expiry_d10")), ...d5Candidates.map(toItem("expiry_d5"))];
}

/** 어제 상담 완료된 리드 중 오늘 D+1 후속 문자 대상, 발송 성공 여부, 현재 등록전환 여부. */
async function gatherConsultFollowup(sql: Sql, today: string): Promise<ConsultFollowupItem[]> {
  const yesterday = addDays(today, -1);
  const candidates = await findConsultFollowupCandidates(sql, yesterday);
  if (candidates.length === 0) return [];

  const [sentRows, leadRows] = await Promise.all([
    sql.query(
      `SELECT lead_id FROM auto_message_log WHERE category = 'consult_followup' AND reference_date = $1 AND success = true`,
      [yesterday]
    ) as unknown as Promise<{ lead_id: number }[]>,
    sql.query(`SELECT id, status FROM leads WHERE id = ANY($1)`, [candidates.map((c) => c.id)]) as unknown as Promise<
      { id: number; status: string }[]
    >,
  ]);
  const sentSet = new Set(sentRows.map((r) => r.lead_id));
  const statusMap = new Map(leadRows.map((r) => [r.id, r.status]));

  return candidates.map((c) => ({
    name: c.name,
    phone: c.phone,
    consultationDate: yesterday,
    sent: sentSet.has(c.id),
    registered: statusMap.get(c.id) === "registered",
  }));
}
