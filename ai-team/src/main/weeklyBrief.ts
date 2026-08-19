// 매주 월요일 오전 카카오 주간 운영 보고 (2026-08-24 대표 지시). 집계 기간은 항상 직전
// 월~토 6일(일요일 휴관일 제외), 비교 기준도 동일하게 그 이전 월~토 6일이다.
// 일일 브리핑(dailyBrief.ts)과 "이탈위험" 정의·미수금 집계 로직을 gymShared.ts로 공유한다.
import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { todayStr, addDays } from "./autoMessage";
import { BRANCH_IDS, REVENUE_SUBTYPES, branchLabel, computeChurnRisk, gatherUnpaid } from "./gymShared";

const AUTO_MESSAGE_CATEGORIES = ["expiry_d10", "expiry_d5", "consult_followup", "lapsed_recover"] as const;
const CATEGORY_LABEL: Record<(typeof AUTO_MESSAGE_CATEGORIES)[number], string> = {
  expiry_d10: "만료 D-10",
  expiry_d5: "만료 D-5",
  consult_followup: "상담 후속",
  lapsed_recover: "재등록 유도",
};

interface RevenueRow {
  branchId: number | null;
  customerName: string | null;
  type: string;
  subType: string;
  paidAmount: number;
  programDetail: string | null;
  sessions: number | null;
}

function dayOfWeek(ymd: string): number {
  return new Date(ymd + "T00:00:00Z").getUTCDay(); // 0=일 ... 6=토
}

/** 오늘(보통 월요일) 기준으로 "직전 월~토 6일"과 "그 이전 월~토 6일"을 계산한다.
 * 월요일이 아닌 날 수동 실행해도 항상 어제 이전의 가장 최근 토요일을 기준으로 역산해
 * 동일한 규칙(월~토)이 적용되도록 한다. */
function computeWeekRanges(today: string) {
  let cursor = addDays(today, -1);
  while (dayOfWeek(cursor) !== 6) cursor = addDays(cursor, -1);
  const weekEnd = cursor;
  const weekStart = addDays(weekEnd, -5);
  const prevWeekEnd = addDays(weekStart, -2);
  const prevWeekStart = addDays(prevWeekEnd, -5);
  return { weekStart, weekEnd, prevWeekStart, prevWeekEnd };
}

function pct(diff: number, base: number): number | null {
  if (base === 0) return null;
  return Math.round((diff / base) * 1000) / 10;
}

function productLabel(r: RevenueRow): string {
  if (r.type === "PT") return `PT ${r.sessions ?? "?"}회`;
  return r.programDetail ?? r.type;
}

async function fetchRevenue(sql: NeonQueryFunction<false, false>, from: string, to: string): Promise<RevenueRow[]> {
  return (await sql.query(
    `SELECT "branchId", "customerName", type, "subType", "paidAmount", "programDetail", sessions
     FROM revenue_entries
     WHERE "paymentDate" >= $1 AND "paymentDate" <= $2 AND "subType" = ANY($3)`,
    [from, to, REVENUE_SUBTYPES]
  )) as RevenueRow[];
}

interface RegistrationCounts {
  newGym: number;
  newPt: number;
  reRegisterGym: number;
  reRegisterPt: number;
}

function countRegistrations(rows: RevenueRow[]): RegistrationCounts {
  return {
    newGym: rows.filter((r) => r.type === "헬스" && r.subType === "신규").length,
    newPt: rows.filter((r) => r.type === "PT" && r.subType === "신규").length,
    reRegisterGym: rows.filter((r) => r.type === "헬스" && r.subType === "재등록").length,
    reRegisterPt: rows.filter((r) => r.type === "PT" && r.subType === "재등록").length,
  };
}

async function gatherVisits(sql: NeonQueryFunction<false, false>, from: string, to: string) {
  const rows = (await sql.query(
    `SELECT a."memberId" AS "memberId", m."branchId" AS "branchId", a."attendDate" AS "attendDate"
     FROM attendances a JOIN members m ON a."memberId" = m.id
     WHERE a."attendDate" >= $1 AND a."attendDate" <= $2`,
    [from, to]
  )) as { memberId: number; branchId: number | null; attendDate: string }[];

  const byBranch = new Map<number, number>();
  for (const r of rows) if (r.branchId != null) byBranch.set(r.branchId, (byBranch.get(r.branchId) ?? 0) + 1);

  return {
    total: rows.length,
    uniqueMembers: new Set(rows.map((r) => r.memberId)).size,
    byBranch: BRANCH_IDS.map((id) => ({ branchId: id, branchName: branchLabel(id), count: byBranch.get(id) ?? 0 })),
  };
}

async function gatherConsulting(sql: NeonQueryFunction<false, false>, from: string, to: string) {
  const rows = (await sql.query(`SELECT status FROM leads WHERE "consultationDate" >= $1 AND "consultationDate" <= $2`, [
    from,
    to,
  ])) as { status: string }[];
  const consulted = rows.length;
  const registered = rows.filter((r) => r.status === "registered").length;
  const rate = consulted > 0 ? Math.round((registered / consulted) * 1000) / 10 : 0;
  return { consulted, registered, notRegistered: consulted - registered, rate };
}

async function gatherRisk(sql: NeonQueryFunction<false, false>, today: string) {
  const [expiringRows, activeMembers, attendances] = (await Promise.all([
    sql.query(
      `SELECT id, "branchId" FROM members WHERE status = 'active' AND "membershipEnd" >= $1 AND "membershipEnd" <= $2`,
      [today, addDays(today, 30)]
    ),
    sql.query(`SELECT id, "branchId", "membershipStart" FROM members WHERE status = 'active'`),
    sql.query(
      `SELECT a."memberId" AS "memberId", a."attendDate" AS "attendDate"
       FROM attendances a JOIN members m ON a."memberId" = m.id
       WHERE m.status = 'active' AND a."attendDate" >= $1`,
      [addDays(today, -60)]
    ),
  ])) as [
    { id: number; branchId: number | null }[],
    { id: number; branchId: number | null; membershipStart: string }[],
    { memberId: number; attendDate: string }[]
  ];

  const { risky: churnRisk, noAttendanceLogCount } = computeChurnRisk(activeMembers, attendances, today);
  const expiringIds = new Set(expiringRows.map((r) => r.id));
  let overlap = 0;
  for (const id of expiringIds) if (churnRisk.has(id)) overlap++;

  return {
    expiringSoon: expiringRows.length,
    churnRisk: churnRisk.size,
    overlap,
    noAttendanceLogCount,
  };
}

interface AutomationCategoryStat {
  category: string;
  label: string;
  targeted: number;
  succeeded: number;
}

async function gatherAutomation(sql: NeonQueryFunction<false, false>, weekStart: string, weekEnd: string) {
  const from = `${weekStart}T00:00:00+09:00`;
  const to = `${addDays(weekEnd, 1)}T00:00:00+09:00`;

  const byCategory = (await sql.query(
    `SELECT category,
       COUNT(DISTINCT COALESCE(member_id, lead_id)) AS targeted,
       COUNT(DISTINCT COALESCE(member_id, lead_id)) FILTER (WHERE success) AS succeeded
     FROM auto_message_log
     WHERE category = ANY($1) AND sent_at >= $2 AND sent_at < $3
     GROUP BY category`,
    [AUTO_MESSAGE_CATEGORIES, from, to]
  )) as { category: string; targeted: string; succeeded: string }[];

  const [consultConnectedRows, reRegisterConnectedRows] = (await Promise.all([
    sql.query(
      `SELECT COUNT(DISTINCT aml.lead_id) c
       FROM auto_message_log aml JOIN leads l ON l.id = aml.lead_id
       WHERE aml.category = 'consult_followup' AND aml.success = true
         AND aml.sent_at >= $1 AND aml.sent_at < $2 AND l.status = 'registered'`,
      [from, to]
    ),
    sql.query(
      `SELECT COUNT(DISTINCT aml.member_id) c
       FROM auto_message_log aml
       WHERE aml.category IN ('expiry_d10','expiry_d5','lapsed_recover') AND aml.success = true
         AND aml.sent_at >= $1 AND aml.sent_at < $2 AND aml.member_id IS NOT NULL
         AND EXISTS (
           SELECT 1 FROM revenue_entries re
           WHERE re."memberId" = aml.member_id AND re."subType" = '재등록'
             AND re."paymentDate" >= to_char(aml.sent_at AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD')
         )`,
      [from, to]
    ),
  ])) as [{ c: string }[], { c: string }[]];

  const statMap = new Map(byCategory.map((r) => [r.category, r]));
  const stats: AutomationCategoryStat[] = AUTO_MESSAGE_CATEGORIES.map((cat) => {
    const row = statMap.get(cat);
    return {
      category: cat,
      label: CATEGORY_LABEL[cat],
      targeted: row ? Number(row.targeted) : 0,
      succeeded: row ? Number(row.succeeded) : 0,
    };
  });

  return {
    byCategory: stats,
    totalTargeted: stats.reduce((s, c) => s + c.targeted, 0),
    totalSucceeded: stats.reduce((s, c) => s + c.succeeded, 0),
    totalFailed: stats.reduce((s, c) => s + (c.targeted - c.succeeded), 0),
    consultConnected: Number(consultConnectedRows[0]?.c ?? 0),
    reRegisterConnected: Number(reRegisterConnectedRows[0]?.c ?? 0),
  };
}

interface Snapshot {
  weekStart: string;
  expiringSoon: number;
  churnRisk: number;
  unpaidTotal: number;
  unpaidCount: number;
}

function snapshotPath(weekStart: string): string {
  const dir = join(__dirname, "..", "..", "output", "weekly-brief");
  mkdirSync(dir, { recursive: true });
  return join(dir, `${weekStart}.json`);
}

function loadSnapshot(weekStart: string): Snapshot | null {
  try {
    return JSON.parse(readFileSync(snapshotPath(weekStart), "utf-8"));
  } catch {
    return null;
  }
}

function saveSnapshot(snapshot: Snapshot) {
  writeFileSync(snapshotPath(snapshot.weekStart), JSON.stringify(snapshot, null, 2), "utf-8");
}

export interface WeeklyBrief {
  weekStart: string;
  weekEnd: string;
  prevWeekStart: string;
  prevWeekEnd: string;
  hasPrevSnapshot: boolean;
  revenue: {
    thisWeek: number;
    prevWeek: number;
    diff: number;
    diffPct: number | null;
    byBranch: { branchId: number; branchName: string; amount: number }[];
    byProduct: { label: string; count: number; amount: number }[];
  };
  visits: {
    totalThisWeek: number;
    totalPrevWeek: number;
    diff: number;
    diffPct: number | null;
    uniqueMembersThisWeek: number;
    uniqueMembersPrevWeek: number;
    diffMembers: number;
    dailyAvgThisWeek: number;
    dailyAvgPrevWeek: number;
    byBranch: { branchId: number; branchName: string; count: number }[];
  };
  registrations: {
    newThisWeek: number;
    newPrevWeek: number;
    reRegisterThisWeek: number;
    reRegisterPrevWeek: number;
    newGym: number;
    newPt: number;
    reRegisterGym: number;
    reRegisterPt: number;
  };
  consulting: { consulted: number; registered: number; notRegistered: number; rate: number; prevRate: number; ratePointDiff: number };
  risk: {
    expiringSoon: number;
    expiringSoonPrev: number | null;
    churnRisk: number;
    churnRiskPrev: number | null;
    overlap: number;
    noAttendanceLogCount: number;
  };
  unpaid: {
    total: number;
    count: number;
    prevTotal: number | null;
    prevCount: number | null;
    longOverdue: { customerName: string; unpaid: number; program: string; daysElapsed: number }[];
  };
  automation: Awaited<ReturnType<typeof gatherAutomation>>;
  attentionItems: string[];
}

function buildAttentionItems(brief: Omit<WeeklyBrief, "attentionItems">): string[] {
  const items: string[] = [];

  if (brief.revenue.diffPct !== null && brief.revenue.diffPct <= -10) {
    items.push(`주간 매출 ${brief.revenue.prevWeek.toLocaleString()}원 → ${brief.revenue.thisWeek.toLocaleString()}원 (${brief.revenue.diffPct}%)`);
  }
  if (brief.registrations.reRegisterThisWeek < brief.registrations.reRegisterPrevWeek) {
    items.push(`재등록 ${brief.registrations.reRegisterPrevWeek}명 → ${brief.registrations.reRegisterThisWeek}명으로 감소`);
  }
  if (brief.risk.churnRiskPrev !== null && brief.risk.churnRisk > brief.risk.churnRiskPrev) {
    items.push(`이탈위험 회원 ${brief.risk.churnRiskPrev}명 → ${brief.risk.churnRisk}명으로 증가`);
  }
  if (brief.unpaid.longOverdue.length > 0) {
    items.push(`장기 미수 회원 ${brief.unpaid.longOverdue.length}명 확인 필요`);
  }

  return items.slice(0, 3);
}

export async function gatherWeeklyBrief(): Promise<WeeklyBrief> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL 미설정");

  const sql = neon(url);
  const today = todayStr();
  const { weekStart, weekEnd, prevWeekStart, prevWeekEnd } = computeWeekRanges(today);

  const [thisWeekRevRows, prevWeekRevRows, visitsThis, visitsPrev, consultingThis, consultingPrev, risk, unpaid, automation] =
    await Promise.all([
      fetchRevenue(sql, weekStart, weekEnd),
      fetchRevenue(sql, prevWeekStart, prevWeekEnd),
      gatherVisits(sql, weekStart, weekEnd),
      gatherVisits(sql, prevWeekStart, prevWeekEnd),
      gatherConsulting(sql, weekStart, weekEnd),
      gatherConsulting(sql, prevWeekStart, prevWeekEnd),
      gatherRisk(sql, today),
      gatherUnpaid(sql, today),
      gatherAutomation(sql, weekStart, weekEnd),
    ]);

  const thisWeekTotal = thisWeekRevRows.reduce((s, r) => s + Number(r.paidAmount ?? 0), 0);
  const prevWeekTotal = prevWeekRevRows.reduce((s, r) => s + Number(r.paidAmount ?? 0), 0);

  const byBranchMap = new Map<number, number>();
  for (const r of thisWeekRevRows) if (r.branchId != null) byBranchMap.set(r.branchId, (byBranchMap.get(r.branchId) ?? 0) + Number(r.paidAmount ?? 0));

  const byProductMap = new Map<string, { count: number; amount: number }>();
  for (const r of thisWeekRevRows) {
    if (r.type !== "헬스" && r.type !== "PT") continue; // 상품별 집계는 핵심 매출원(헬스/PT)만
    const label = productLabel(r);
    const cur = byProductMap.get(label) ?? { count: 0, amount: 0 };
    cur.count++;
    cur.amount += Number(r.paidAmount ?? 0);
    byProductMap.set(label, cur);
  }

  const thisReg = countRegistrations(thisWeekRevRows);
  const prevReg = countRegistrations(prevWeekRevRows);

  const prevSnapshot = loadSnapshot(prevWeekStart);
  saveSnapshot({
    weekStart,
    expiringSoon: risk.expiringSoon,
    churnRisk: risk.churnRisk,
    unpaidTotal: unpaid.total,
    unpaidCount: unpaid.memberCount,
  });

  const brief: Omit<WeeklyBrief, "attentionItems"> = {
    weekStart,
    weekEnd,
    prevWeekStart,
    prevWeekEnd,
    hasPrevSnapshot: prevSnapshot !== null,
    revenue: {
      thisWeek: thisWeekTotal,
      prevWeek: prevWeekTotal,
      diff: thisWeekTotal - prevWeekTotal,
      diffPct: pct(thisWeekTotal - prevWeekTotal, prevWeekTotal),
      byBranch: BRANCH_IDS.map((id) => ({ branchId: id, branchName: branchLabel(id), amount: byBranchMap.get(id) ?? 0 })),
      byProduct: Array.from(byProductMap.entries())
        .map(([label, v]) => ({ label, count: v.count, amount: v.amount }))
        .sort((a, b) => b.amount - a.amount),
    },
    visits: {
      totalThisWeek: visitsThis.total,
      totalPrevWeek: visitsPrev.total,
      diff: visitsThis.total - visitsPrev.total,
      diffPct: pct(visitsThis.total - visitsPrev.total, visitsPrev.total),
      uniqueMembersThisWeek: visitsThis.uniqueMembers,
      uniqueMembersPrevWeek: visitsPrev.uniqueMembers,
      diffMembers: visitsThis.uniqueMembers - visitsPrev.uniqueMembers,
      dailyAvgThisWeek: Math.round((visitsThis.total / 6) * 10) / 10,
      dailyAvgPrevWeek: Math.round((visitsPrev.total / 6) * 10) / 10,
      byBranch: visitsThis.byBranch,
    },
    registrations: {
      newThisWeek: thisReg.newGym + thisReg.newPt,
      newPrevWeek: prevReg.newGym + prevReg.newPt,
      reRegisterThisWeek: thisReg.reRegisterGym + thisReg.reRegisterPt,
      reRegisterPrevWeek: prevReg.reRegisterGym + prevReg.reRegisterPt,
      newGym: thisReg.newGym,
      newPt: thisReg.newPt,
      reRegisterGym: thisReg.reRegisterGym,
      reRegisterPt: thisReg.reRegisterPt,
    },
    consulting: {
      consulted: consultingThis.consulted,
      registered: consultingThis.registered,
      notRegistered: consultingThis.notRegistered,
      rate: consultingThis.rate,
      prevRate: consultingPrev.rate,
      ratePointDiff: Math.round((consultingThis.rate - consultingPrev.rate) * 10) / 10,
    },
    risk: {
      expiringSoon: risk.expiringSoon,
      expiringSoonPrev: prevSnapshot?.expiringSoon ?? null,
      churnRisk: risk.churnRisk,
      churnRiskPrev: prevSnapshot?.churnRisk ?? null,
      overlap: risk.overlap,
      noAttendanceLogCount: risk.noAttendanceLogCount,
    },
    unpaid: {
      total: unpaid.total,
      count: unpaid.memberCount,
      prevTotal: prevSnapshot?.unpaidTotal ?? null,
      prevCount: prevSnapshot?.unpaidCount ?? null,
      longOverdue: unpaid.lines.filter((l) => l.daysElapsed >= 10),
    },
    automation,
  };

  return { ...brief, attentionItems: buildAttentionItems(brief) };
}

function formatWeekTitle(weekStart: string, weekEnd: string): string {
  const [, m1, d1] = weekStart.split("-").map(Number);
  const [, m2, d2] = weekEnd.split("-").map(Number);
  return m1 === m2 ? `${m1}월 ${d1}일~${d2}일` : `${m1}월 ${d1}일~${m2}월 ${d2}일`;
}

function fmt(n: number): string {
  return n.toLocaleString();
}

function signed(n: number): string {
  return n > 0 ? `+${fmt(n)}` : fmt(n);
}

function signedPct(n: number | null): string {
  if (n === null) return "";
  return ` / ${n > 0 ? "+" : ""}${n}%`;
}

export function buildWeeklyBriefKakaoText(b: WeeklyBrief): string {
  const lines: string[] = [];
  lines.push(`[${formatWeekTitle(b.weekStart, b.weekEnd)} 주간 운영 보고]`);
  if (!b.hasPrevSnapshot) lines.push("(첫 주간보고라 이탈위험·만료임박·미수금은 전주 비교 없음)");
  lines.push("");

  // 1. 주간 매출
  lines.push("주간 매출");
  lines.push(`${fmt(b.revenue.thisWeek)}원`);
  lines.push(`전주 ${fmt(b.revenue.prevWeek)}원 → ${signed(b.revenue.diff)}원${signedPct(b.revenue.diffPct)}`);
  lines.push("");
  for (const br of b.revenue.byBranch) lines.push(`${br.branchName} ${fmt(br.amount)}원`);
  if (b.revenue.byProduct.length > 0) {
    lines.push("");
    lines.push("상품별");
    for (const p of b.revenue.byProduct) lines.push(`${p.label} ${p.count}건 / ${fmt(p.amount)}원`);
  }
  lines.push("");

  // 2. 방문
  lines.push("방문");
  lines.push(`총 방문 ${b.visits.totalThisWeek}회 / 전주 ${b.visits.totalPrevWeek}회 → ${signed(b.visits.diff)}회${signedPct(b.visits.diffPct)}`);
  lines.push(`실제 방문회원 ${b.visits.uniqueMembersThisWeek}명 / 전주 ${b.visits.uniqueMembersPrevWeek}명 → ${signed(b.visits.diffMembers)}명`);
  lines.push(`일평균 방문 ${b.visits.dailyAvgThisWeek}회 / 전주 ${b.visits.dailyAvgPrevWeek}회`);
  for (const br of b.visits.byBranch) lines.push(`${br.branchName} ${br.count}회`);
  lines.push("");

  // 3. 신규·재등록
  lines.push("신규·재등록");
  lines.push(
    `신규 ${b.registrations.newThisWeek}명 / 전주 ${b.registrations.newPrevWeek}명 → ${signed(
      b.registrations.newThisWeek - b.registrations.newPrevWeek
    )}명${signedPct(pct(b.registrations.newThisWeek - b.registrations.newPrevWeek, b.registrations.newPrevWeek))}`
  );
  lines.push(
    `재등록 ${b.registrations.reRegisterThisWeek}명 / 전주 ${b.registrations.reRegisterPrevWeek}명 → ${signed(
      b.registrations.reRegisterThisWeek - b.registrations.reRegisterPrevWeek
    )}명${signedPct(pct(b.registrations.reRegisterThisWeek - b.registrations.reRegisterPrevWeek, b.registrations.reRegisterPrevWeek))}`
  );
  lines.push("");
  lines.push(`신규 헬스 ${b.registrations.newGym}명 · 신규 PT ${b.registrations.newPt}명`);
  lines.push(`헬스 재등록 ${b.registrations.reRegisterGym}명 · PT 재등록 ${b.registrations.reRegisterPt}명`);
  lines.push("");

  // 4. 상담 및 등록전환
  lines.push("상담");
  lines.push(`상담 ${b.consulting.consulted}건`);
  lines.push(`등록 ${b.consulting.registered}건 · 미등록 ${b.consulting.notRegistered}건`);
  lines.push(
    `등록률 ${b.consulting.rate}% / 전주 ${b.consulting.prevRate}% → ${b.consulting.ratePointDiff > 0 ? "+" : ""}${b.consulting.ratePointDiff}%p`
  );
  lines.push("");

  // 5. 만료임박·이탈위험
  lines.push("회원 위험");
  lines.push(
    `만료임박 ${b.risk.expiringSoon}명${b.risk.expiringSoonPrev !== null ? ` / 전주 ${b.risk.expiringSoonPrev}명 → ${signed(b.risk.expiringSoon - b.risk.expiringSoonPrev)}명` : ""}`
  );
  lines.push(
    `이탈위험 ${b.risk.churnRisk}명${b.risk.churnRiskPrev !== null ? ` / 전주 ${b.risk.churnRiskPrev}명 → ${signed(b.risk.churnRisk - b.risk.churnRiskPrev)}명` : ""}`
  );
  lines.push(`만료임박+이탈위험 중복 ${b.risk.overlap}명`);
  if (b.risk.noAttendanceLogCount > 0) lines.push(`(출석기록 없는 회원 ${b.risk.noAttendanceLogCount}명은 이탈위험 판단 제외)`);
  lines.push("");

  // 6. 미수금
  lines.push("미수금");
  lines.push(`${fmt(b.unpaid.total)}원 / ${b.unpaid.count}명`);
  if (b.unpaid.prevTotal !== null && b.unpaid.prevCount !== null) {
    lines.push(
      `전주 ${fmt(b.unpaid.prevTotal)}원 / ${b.unpaid.prevCount}명 → ${signed(b.unpaid.total - b.unpaid.prevTotal)}원 / ${signed(b.unpaid.count - b.unpaid.prevCount)}명`
    );
  }
  if (b.unpaid.longOverdue.length > 0) {
    lines.push("");
    lines.push("장기 미수");
    for (const u of b.unpaid.longOverdue) lines.push(`${u.customerName} / ${fmt(u.unpaid)}원 / ${u.program} / ${u.daysElapsed}일 경과`);
  }
  lines.push("");

  // 7. 자동화 성과
  lines.push("자동화 성과");
  lines.push(`대상 ${b.automation.totalTargeted}명 · 성공 ${b.automation.totalSucceeded}명 · 실패 ${b.automation.totalFailed}명`);
  for (const c of b.automation.byCategory) {
    if (c.targeted === 0) continue;
    lines.push(`${c.label} 대상 ${c.targeted} · 성공 ${c.succeeded}`);
  }
  lines.push(`상담 연결 ${b.automation.consultConnected}명 · 재등록 연결 ${b.automation.reRegisterConnected}명`);
  // 회원 응답(수신 확인)은 별도 응답 수집 체계가 없어 추적 불가 — 지어내지 않고 생략.

  // 8. 이번 주 확인 필요 (없으면 생략)
  if (b.attentionItems.length > 0) {
    lines.push("");
    lines.push("이번 주 확인 필요");
    for (const item of b.attentionItems) lines.push(item);
  }

  return lines.join("\n");
}
