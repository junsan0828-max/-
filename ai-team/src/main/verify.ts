// 온라인 지부장 2차 검증 자동화.
// "온라인 지부장"은 별도 AI가 아니라 총괄 AI(제이) 자신이 협의실 루틴 안에서 맡는 역할이다
// (협의실 확인 클라우드 루틴 프롬프트에 명시됨). 지금까지는 이 역할이 그때그때 실행된 AI가
// 즉흥적으로 쓰는 서술일 뿐, 전일 대비 증감을 실제로 계산하는 코드가 없었다. 이 모듈이 그 자리를 채운다.
//
// 설계 원칙: 새 테이블/스냅샷을 만들지 않는다. revenue_entries는 paymentDate별 완전한 이벤트
// 원장이라 과거 특정 날짜 기준 누계(계약액/실입금/환불/신규/재등록)는 그 날짜까지로 필터링만 하면
// 그대로 재현된다.
//
// 활성회원 수 — "현재" 값은 통합운영시스템(railway: remarkable-tenderness-production, 같은 저장소의
// claude/gym-management-system-OnTMC 브랜치, client/src/pages/AdminMembers.tsx, 2026-08-12 커밋
// 58fa091 "회원 통계 정확도 개선")이 막 확정한 정의를 그대로 쓴다:
//   활성 = status='active' AND (membershipEnd IS NULL OR membershipEnd >= 오늘)
// status만 보면(구버전 정의) membershipEnd가 지났는데 상태만 안 바뀐 회원까지 활성으로 잡혀 실제보다
// 부풀려진다 — 활성+만료+정지가 정확히 전체와 일치하는 걸로 이미 검증된 정의라 그대로 재사용한다.
//
// "전일 대비 증감"은 이 정확한 정의로는 계산할 수 없다 — status는 이력 없이 제자리에서 바뀌는
// 필드라 과거 시점의 status를 복원할 방법이 없기 때문이다. 그래서 증감만은 status를 아예 안 쓰는
// server/gymRouters.ts의 memberTrend 공식(createdAt < 기준일 AND membershipEnd >= 기준일)으로
// 근사한다 — 이건 정확한 "오늘" 값과는 다른 수치가 나올 수 있는 추세 참고용 근사치라는 걸 명시한다.
import { neon } from "@neondatabase/serverless";
import { GymContext } from "./data";

function kstDate(offsetDays = 0): string {
  const d = new Date(Date.now() + offsetDays * 864e5);
  return d.toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
}

function nextDay(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00Z");
  return new Date(d.getTime() + 864e5).toISOString().slice(0, 10);
}

export interface ScopeMoneyAsOf {
  scope: "전체" | "1호점" | "2호점";
  branchId: number; // 0 = 전체
  contractAmount: number;
  monthRevenue: number;
  refundAmount: number;
  newCount: number;
  reRegisterCount: number;
}

export interface ScopeDelta extends ScopeMoneyAsOf {
  contractAmountDelta: number;
  monthRevenueDelta: number;
  refundAmountDelta: number;
  newCountDelta: number;
  reRegisterCountDelta: number;
  activeNow: number; // 정확한 현재값 — AdminMembers.tsx와 동일 정의(status='active' AND 미만료)
  activeTrendYesterday: number; // 근사치(추세용) — status를 못 쓰므로 날짜범위로만 추정
  activeTrendDelta: number; // activeNow가 아니라 근사 어제값 대비 근사 오늘값의 차이
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
}

export interface VerificationResult {
  asOfDate: string; // KST YYYY-MM-DD
  asOfTimestamp: string; // ISO
  scopes: ScopeDelta[];
  activeMethodNote: string; // 활성회원 산정 방식 출처(통합운영시스템과 동일 공식임을 명시)
  todayTransactions: TodayTransaction[];
  unpaidMembersNow: { name: string; phone: string | null; branchId: number | null; unpaid: number }[];
  expiringWithin10: { name: string; phone: string | null; branchId: number | null; membershipEnd: string; daysLeft: number }[];
}

type Sql = ReturnType<typeof neon<false, false>>;
type MoneyRow = { branchId: number | null; amount: string; paidAmount: string; refundAmount: string; subType: string };

async function monthToDateAsOf(sql: Sql, monthStart: string, asOfDate: string): Promise<ScopeMoneyAsOf[]> {
  const rows = (await sql.query(
    `SELECT "branchId", "subType", amount, "paidAmount", "refundAmount"
     FROM revenue_entries
     WHERE "paymentDate" >= $1 AND "paymentDate" <= $2`,
    [monthStart, asOfDate]
  )) as MoneyRow[];

  const sumFor = (branchId: number | null): ScopeMoneyAsOf => {
    const filtered = branchId === null ? rows : rows.filter((r) => r.branchId === branchId);
    return {
      scope: branchId === null ? "전체" : branchId === 1 ? "1호점" : "2호점",
      branchId: branchId ?? 0,
      contractAmount: filtered.reduce((s, r) => s + Number(r.amount || 0), 0),
      monthRevenue: filtered.reduce((s, r) => s + Number(r.paidAmount || 0), 0),
      refundAmount: filtered.reduce((s, r) => s + Number(r.refundAmount || 0), 0),
      newCount: filtered.filter((r) => r.subType === "신규").length,
      reRegisterCount: filtered.filter((r) => r.subType === "재등록").length,
    };
  };

  return [sumFor(null), sumFor(1), sumFor(2)];
}

/** 정확한 "현재" 활성회원 — AdminMembers.tsx(2026-08-12 commit 58fa091)와 동일 정의:
 * status='active' AND (membershipEnd가 없거나 오늘 이후). status는 현재값만 알 수 있으므로
 * 이 함수는 "오늘"에만 쓴다 — 과거 시점엔 쓸 수 없다(아래 activeTrendAsOfEndOfDay 참고). */
async function activeNowPrecise(sql: Sql, todayDate: string, branchId: number | null): Promise<number> {
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

/** 근사치(추세 참고용) — "gymRouters.ts memberTrend"와 동일 공식: createdAt < cutoff AND
 * membershipEnd >= cutoff. status를 전혀 안 써서 과거 날짜에도 적용 가능하지만, activeNowPrecise와
 * 정의가 달라 같은 날짜에도 두 값이 서로 다를 수 있다(정확한 오늘값은 activeNowPrecise를 본다). */
async function activeTrendAsOfEndOfDay(sql: Sql, date: string, branchId: number | null): Promise<number> {
  const cutoff = nextDay(date);
  const rows = (
    branchId == null
      ? await sql.query(
          `SELECT COUNT(*)::int c FROM members WHERE "createdAt" < $1 AND "membershipEnd" IS NOT NULL AND "membershipEnd" >= $1`,
          [cutoff]
        )
      : await sql.query(
          `SELECT COUNT(*)::int c FROM members WHERE "createdAt" < $1 AND "membershipEnd" IS NOT NULL AND "membershipEnd" >= $1 AND "branchId" = $2`,
          [cutoff, branchId]
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
  const yesterday = kstDate(-1);
  const monthStart = `${today.slice(0, 7)}-01`;

  const [todayScopes, yesterdayScopes, activeNowByScope, activeTrendTodayByScope, activeTrendYesterdayByScope] = await Promise.all([
    monthToDateAsOf(sql, monthStart, today),
    // 이번달 1일이 오늘이면 "어제"는 지난달이라 이번달 누계 관점에서 비교 대상이 없다 — 그 경우 0으로 둔다.
    monthStart <= yesterday
      ? monthToDateAsOf(sql, monthStart, yesterday)
      : monthToDateAsOf(sql, monthStart, monthStart).then((r) =>
          r.map((s) => ({ ...s, contractAmount: 0, monthRevenue: 0, refundAmount: 0, newCount: 0, reRegisterCount: 0 }))
        ),
    Promise.all([null, 1, 2].map((b) => activeNowPrecise(sql, today, b))),
    Promise.all([null, 1, 2].map((b) => activeTrendAsOfEndOfDay(sql, today, b))),
    Promise.all([null, 1, 2].map((b) => activeTrendAsOfEndOfDay(sql, yesterday, b))),
  ]);

  const scopes: ScopeDelta[] = todayScopes.map((s, i) => {
    const prev = yesterdayScopes[i];
    const activeNow = activeNowByScope[i];
    const activeTrendToday = activeTrendTodayByScope[i];
    const activeTrendYesterday = activeTrendYesterdayByScope[i];
    return {
      ...s,
      contractAmountDelta: s.contractAmount - prev.contractAmount,
      monthRevenueDelta: s.monthRevenue - prev.monthRevenue,
      refundAmountDelta: s.refundAmount - prev.refundAmount,
      newCountDelta: s.newCount - prev.newCount,
      reRegisterCountDelta: s.reRegisterCount - prev.reRegisterCount,
      activeNow,
      activeTrendYesterday,
      activeTrendDelta: activeTrendToday - activeTrendYesterday,
    };
  });

  const todayTxRows = (await sql.query(
    `SELECT "subType","branchId",amount,"paidAmount","refundAmount","unpaidAmount","customerName",phone
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
  }));

  return {
    asOfDate: today,
    asOfTimestamp: new Date().toISOString(),
    scopes,
    activeMethodNote:
      "activeNow는 통합운영시스템 AdminMembers.tsx(2026-08-12 commit 58fa091)와 동일 정의: status='active' AND (membershipEnd 없음 또는 오늘 이후) — 대표가 실제로 보는 회원관리 화면과 정확히 일치. activeTrendYesterday/activeTrendDelta는 status 이력이 없어 정확 계산이 불가능하므로 memberTrend 공식(createdAt/membershipEnd 날짜범위)으로 추정한 근사치이며, activeNow와 정의가 달라 같은 날짜라도 값이 다를 수 있음(추세 방향 참고용).",
    todayTransactions,
    unpaidMembersNow: ctx.money.unpaidMembers,
    expiringWithin10: ctx.members.expiringSoon
      .filter((m) => m.daysUntilExpiry <= 10)
      .map((m) => ({ name: m.name, phone: m.phone, branchId: m.branchId, membershipEnd: m.membershipEnd, daysLeft: m.daysUntilExpiry })),
  };
}
