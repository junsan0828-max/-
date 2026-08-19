// 주간 운영 보고 (2026-08-24 대표 지시로 신설) — 매주 월요일 아침 9시, 카카오톡("나에게 보내기")으로 발송.
// 집계 기간은 항상 "직전 월~토 6일"(일요일은 휴관일이라 제외)이고, 비교 기준(전주)도 동일한 방식의
// 그 이전 월~토 6일이다. 기존 오전 9시 일일 브리핑(orchestrator.ts)은 화~토만 나가고 월요일엔 이
// 주간 보고로 대체된다.
// 클라우드 예약실행 환경에서도 동작해야 해서 pg Pool이 아니라 neon() HTTP 방식을 쓴다(다른 잡들과 동일).
import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const BRANCH_NAMES: Record<number, string> = { 1: "1호점", 2: "2호점" };

function todayStr(): string {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00+09:00`);
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
}

/** 대표가 매주 월요일 아침에 실행한다고 가정하고, 직전 월~토(6일)를 이번 주 집계 기간으로,
 * 그 이전 월~토(6일)를 전주 비교 기간으로 잡는다.
 * 예: referenceDate=2026-08-24(월) → 이번주 2026-08-17~2026-08-22, 전주 2026-08-10~2026-08-15. */
export function getWeeklyPeriod(referenceDate: string = todayStr()) {
  const weekStart = addDays(referenceDate, -7);
  const weekEnd = addDays(referenceDate, -2);
  const prevWeekStart = addDays(referenceDate, -14);
  const prevWeekEnd = addDays(referenceDate, -9);
  return { weekStart, weekEnd, prevWeekStart, prevWeekEnd };
}

function branchLabel(branchId: number | null): string {
  return branchId === null ? "지점미지정" : BRANCH_NAMES[branchId] ?? `지점${branchId}`;
}

export interface WeeklyBriefResult {
  weekStart: string;
  weekEnd: string;
  prevWeekStart: string;
  prevWeekEnd: string;
  generatedAt: string;
  revenue: {
    total: number; // 순매출(실입금 - 환불)
    paidAmount: number;
    refundAmount: number;
    prevTotal: number;
    diff: number;
    diffPct: number | null;
    byBranch: { branchId: number | null; branchName: string; amount: number }[];
    byType: { type: string; amount: number }[];
  };
  visits: { total: number; uniqueMembers: number; prevTotal: number };
  registration: { newCount: number; reRegisterCount: number; prevNewCount: number; prevReRegisterCount: number };
  funnel: { newLeads: number; consulted: number; registered: number; consultRate: number; registerRate: number };
  expiringSoon: { count: number; names: string[] };
  attendanceRisk: { count: number; members: { name: string; phone: string | null; branchId: number | null; lastAttendDate: string | null }[] };
  unpaid: {
    total: number;
    memberCount: number;
    longOverdue: { name: string; phone: string | null; unpaid: number; daysOverdue: number }[];
  };
  autoMessage: {
    category: string;
    label: string;
    targeted: number;
    sent: number;
    failed: number;
    skippedInvalidPhone: number;
    converted: number; // 상담연결/재등록연결 (카테고리별 정의는 아래 CATEGORY_LABEL 주석 참고)
  }[];
  dataNotes: string[];
}

const CATEGORY_LABEL: Record<string, string> = {
  expiry_d10: "헬스권 만료 D-10",
  expiry_d5: "헬스권 만료 D-5",
  consult_followup: "관리상담 D+1",
  lapsed_recover: "만료 후 재등록 유도",
  gymplus_launch: "자이언트짐+ 오픈 안내",
};

// member_id 기준 카테고리(만료 안내·재등록 유도)는 "재등록 연결" — 메시지 발송 후 오늘까지
// 해당 회원의 재등록(subType='재등록') 매출 기록이 생겼는지로 판단한다.
const MEMBER_CATEGORIES = new Set(["expiry_d10", "expiry_d5", "lapsed_recover"]);
// lead_id 기준 카테고리(관리상담 후속)는 "등록 연결" — 리드가 실제 회원으로 등록됐는지로 판단한다.
const LEAD_CATEGORIES = new Set(["consult_followup"]);

async function gatherWeeklyData(sql: NeonQueryFunction<false, false>, weekStart: string, weekEnd: string, prevWeekStart: string, prevWeekEnd: string) {
  const today = todayStr();
  const in30 = addDays(today, 30);
  const ago14 = addDays(today, -14);
  const ago30 = addDays(today, -30);
  const weekEndExclusive = addDays(weekEnd, 1);

  const [
    revRows,
    prevRevRows,
    visitRows,
    prevVisitRows,
    leadsRows,
    expiring,
    attendanceRiskRows,
    unpaidRows,
    autoMsgRows,
  ] = (await Promise.all([
    sql.query(
      `SELECT "branchId", type, "subType", "paidAmount", "refundAmount" FROM revenue_entries
       WHERE "paymentDate" >= $1 AND "paymentDate" <= $2`,
      [weekStart, weekEnd]
    ),
    sql.query(
      `SELECT "subType", "paidAmount", "refundAmount" FROM revenue_entries WHERE "paymentDate" >= $1 AND "paymentDate" <= $2`,
      [prevWeekStart, prevWeekEnd]
    ),
    sql.query(
      `SELECT COUNT(*) total, COUNT(DISTINCT "memberId") uniq FROM attendances WHERE "attendDate" >= $1 AND "attendDate" <= $2`,
      [weekStart, weekEnd]
    ),
    sql.query(
      `SELECT COUNT(*) total FROM attendances WHERE "attendDate" >= $1 AND "attendDate" <= $2`,
      [prevWeekStart, prevWeekEnd]
    ),
    sql.query(
      `SELECT status FROM leads WHERE "createdAt" >= $1 AND "createdAt" < $2`,
      [weekStart, weekEndExclusive]
    ),
    sql.query(
      `SELECT "branchId", name FROM members
       WHERE "membershipEnd" IS NOT NULL AND "membershipEnd" >= $1 AND "membershipEnd" <= $2`,
      [today, in30]
    ),
    sql.query(
      `SELECT m.name, m.phone, m."branchId" AS "branchId", MAX(a."attendDate") AS "lastAttendDate"
       FROM members m
       LEFT JOIN attendances a ON a."memberId" = m.id
       WHERE m.status = 'active' AND m."membershipStart" IS NOT NULL AND m."membershipStart" <= $1
       GROUP BY m.id, m.name, m.phone, m."branchId"
       HAVING MAX(a."attendDate") IS NULL OR MAX(a."attendDate") < $1
       ORDER BY "lastAttendDate" ASC NULLS FIRST
       LIMIT 100`,
      [ago14]
    ),
    sql.query(`SELECT "customerName", phone, "unpaidAmount", "paymentDate" FROM revenue_entries WHERE "unpaidAmount" > 0`),
    sql.query(
      `SELECT category, member_id, lead_id, success, error FROM auto_message_log
       WHERE sent_at >= $1 AND sent_at < $2`,
      [weekStart, weekEndExclusive]
    ),
  ])) as [
    { branchId: number | null; type: string; subType: string; paidAmount: number; refundAmount: number }[],
    { subType: string; paidAmount: number; refundAmount: number }[],
    { total: string; uniq: string }[],
    { total: string }[],
    { status: string }[],
    { branchId: number | null; name: string }[],
    { name: string; phone: string | null; branchId: number | null; lastAttendDate: string | null }[],
    { customerName: string | null; phone: string | null; unpaidAmount: number; paymentDate: string }[],
    { category: string; member_id: number | null; lead_id: number | null; success: boolean; error: string | null }[]
  ];

  return {
    revRows,
    prevRevRows,
    visitRows,
    prevVisitRows,
    leadsRows,
    expiring,
    attendanceRiskRows,
    unpaidRows: unpaidRows.map((r) => ({ ...r, unpaidAmount: Number(r.unpaidAmount) })),
    autoMsgRows,
    ago30,
    today,
  };
}

/** 이번 주 발송된 자동문자 대상자 중 오늘까지 재등록/등록으로 이어진 인원을 센다. */
async function computeConversions(
  sql: NeonQueryFunction<false, false>,
  category: string,
  memberIds: number[],
  leadIds: number[],
  weekStart: string,
  today: string
): Promise<number> {
  if (MEMBER_CATEGORIES.has(category)) {
    if (memberIds.length === 0) return 0;
    const rows = (await sql.query(
      `SELECT DISTINCT "memberId" FROM revenue_entries
       WHERE "subType" = '재등록' AND "memberId" = ANY($1::int[]) AND "paymentDate" >= $2 AND "paymentDate" <= $3`,
      [memberIds, weekStart, today]
    )) as { memberId: number }[];
    return rows.length;
  }
  if (LEAD_CATEGORIES.has(category)) {
    if (leadIds.length === 0) return 0;
    const rows = (await sql.query(
      `SELECT id FROM leads WHERE id = ANY($1::int[]) AND status = 'registered'`,
      [leadIds]
    )) as { id: number }[];
    return rows.length;
  }
  return 0;
}

export async function runWeeklyBrief(referenceDate: string = todayStr()): Promise<WeeklyBriefResult> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL이 설정되어 있지 않습니다.");
  const sql = neon(url);
  const { weekStart, weekEnd, prevWeekStart, prevWeekEnd } = getWeeklyPeriod(referenceDate);

  const d = await gatherWeeklyData(sql, weekStart, weekEnd, prevWeekStart, prevWeekEnd);

  // 매출
  const paidAmount = d.revRows.reduce((s, r) => s + Number(r.paidAmount || 0), 0);
  const refundAmount = d.revRows.reduce((s, r) => s + Number(r.refundAmount || 0), 0);
  const total = paidAmount - refundAmount;
  const prevTotal = d.prevRevRows.reduce((s, r) => s + Number(r.paidAmount || 0) - Number(r.refundAmount || 0), 0);
  const diff = total - prevTotal;
  const diffPct = prevTotal > 0 ? Math.round((diff / prevTotal) * 1000) / 10 : null;

  const byBranchMap = new Map<number | null, number>();
  for (const r of d.revRows) byBranchMap.set(r.branchId, (byBranchMap.get(r.branchId) ?? 0) + Number(r.paidAmount || 0) - Number(r.refundAmount || 0));
  const byBranch = Array.from(byBranchMap.entries())
    .map(([branchId, amount]) => ({ branchId, branchName: branchLabel(branchId), amount }))
    .sort((a, b) => (a.branchId ?? 99) - (b.branchId ?? 99));

  const byTypeMap = new Map<string, number>();
  for (const r of d.revRows) byTypeMap.set(r.type, (byTypeMap.get(r.type) ?? 0) + Number(r.paidAmount || 0) - Number(r.refundAmount || 0));
  const byType = Array.from(byTypeMap.entries()).map(([type, amount]) => ({ type, amount }));

  // 방문
  const visitTotal = Number(d.visitRows[0]?.total ?? 0);
  const visitUnique = Number(d.visitRows[0]?.uniq ?? 0);
  const prevVisitTotal = Number(d.prevVisitRows[0]?.total ?? 0);

  // 신규·재등록
  const newCount = d.revRows.filter((r) => r.subType === "신규").length;
  const reRegisterCount = d.revRows.filter((r) => r.subType === "재등록").length;
  const prevNewCount = d.prevRevRows.filter((r) => r.subType === "신규").length;
  const prevReRegisterCount = d.prevRevRows.filter((r) => r.subType === "재등록").length;

  // 상담·등록전환율 (이번 주 신규 유입 리드 기준)
  const newLeads = d.leadsRows.length;
  const consulted = d.leadsRows.filter((r) => r.status === "consulted" || r.status === "registered").length;
  const registered = d.leadsRows.filter((r) => r.status === "registered").length;
  const consultRate = newLeads > 0 ? Math.round((consulted / newLeads) * 100) : 0;
  const registerRate = consulted > 0 ? Math.round((registered / consulted) * 100) : 0;

  // 만료임박 (만료일 기준, 기존 로직과 동일)
  const expiringSoon = { count: d.expiring.length, names: d.expiring.slice(0, 15).map((m) => m.name) };

  // 이탈위험 (실제 출석 패턴 기준 — 최근 14일 미방문 활성회원)
  const attendanceRisk = {
    count: d.attendanceRiskRows.length,
    members: d.attendanceRiskRows.slice(0, 15),
  };

  // 미수금
  const unpaidTotal = d.unpaidRows.reduce((s, r) => s + r.unpaidAmount, 0);
  const longOverdue = d.unpaidRows
    .filter((r) => r.paymentDate <= d.ago30)
    .map((r) => ({
      name: r.customerName ?? "이름없음",
      phone: r.phone,
      unpaid: r.unpaidAmount,
      daysOverdue: Math.round((new Date(d.today).getTime() - new Date(r.paymentDate).getTime()) / 864e5),
    }))
    .sort((a, b) => b.unpaid - a.unpaid);

  // 13시 자동문자 성과
  const categories = Array.from(new Set(d.autoMsgRows.map((r) => r.category)));
  const autoMessage: WeeklyBriefResult["autoMessage"] = [];
  for (const category of categories) {
    const rows = d.autoMsgRows.filter((r) => r.category === category);
    const sent = rows.filter((r) => r.success).length;
    const skippedInvalidPhone = rows.filter((r) => !r.success && r.error === "연락처 누락·확인 필요").length;
    const failed = rows.filter((r) => !r.success && r.error !== "연락처 누락·확인 필요").length;
    const memberIds = Array.from(new Set(rows.filter((r) => r.success && r.member_id != null).map((r) => r.member_id!)));
    const leadIds = Array.from(new Set(rows.filter((r) => r.success && r.lead_id != null).map((r) => r.lead_id!)));
    const converted = await computeConversions(sql, category, memberIds, leadIds, weekStart, d.today);
    autoMessage.push({
      category,
      label: CATEGORY_LABEL[category] ?? category,
      targeted: rows.length,
      sent,
      failed,
      skippedInvalidPhone,
      converted,
    });
  }

  const dataNotes: string[] = [
    "이탈위험(출석 패턴 기준)은 '활성회원 중 가입 14일 이상 경과 + 최근 14일간 출석기록 없음'으로 정의합니다 — 만료일 기준 만료임박과는 별개 지표입니다.",
    "장기미수는 결제일로부터 30일 이상 경과했고 아직 미수금이 남아있는 건입니다.",
    "13시 자동문자 '연결'은 만료안내·재등록유도는 발송 후 오늘까지의 재등록 매출 발생 여부, 관리상담 후속은 리드의 등록 전환 여부로 판단합니다.",
  ];

  return {
    weekStart,
    weekEnd,
    prevWeekStart,
    prevWeekEnd,
    generatedAt: new Date().toISOString(),
    revenue: { total, paidAmount, refundAmount, prevTotal, diff, diffPct, byBranch, byType },
    visits: { total: visitTotal, uniqueMembers: visitUnique, prevTotal: prevVisitTotal },
    registration: { newCount, reRegisterCount, prevNewCount, prevReRegisterCount },
    funnel: { newLeads, consulted, registered, consultRate, registerRate },
    expiringSoon,
    attendanceRisk,
    unpaid: { total: unpaidTotal, memberCount: d.unpaidRows.length, longOverdue },
    autoMessage,
    dataNotes,
  };
}

export function saveWeeklyBrief(result: WeeklyBriefResult): string {
  const outDir = join(__dirname, "..", "..", "output", "weekly-brief");
  mkdirSync(outDir, { recursive: true });
  const path = join(outDir, `${result.weekStart}_${result.weekEnd}.json`);
  writeFileSync(path, JSON.stringify(result, null, 2), "utf-8");
  return path;
}

export function loadWeeklyBrief(weekStart: string, weekEnd: string): WeeklyBriefResult | null {
  try {
    const path = join(__dirname, "..", "..", "output", "weekly-brief", `${weekStart}_${weekEnd}.json`);
    return JSON.parse(readFileSync(path, "utf-8"));
  } catch {
    return null;
  }
}

const man = (n: number) => `${Math.round(n / 10000).toLocaleString()}만`;

function namesList(names: string[], max = 8): string {
  if (names.length === 0) return "없음";
  return names.length <= max ? names.join(", ") : `${names.slice(0, max).join(", ")} 외 ${names.length - max}명`;
}

/** 확인이 필요한 항목만 규칙 기반으로 1~3개 뽑는다 — 대표가 실행 여부를 판단할 항목. */
function buildActionItems(r: WeeklyBriefResult): string[] {
  const items: string[] = [];
  if (r.unpaid.longOverdue.length > 0)
    items.push(`장기미수(30일+) ${r.unpaid.longOverdue.length}명 · ${man(r.unpaid.longOverdue.reduce((s, m) => s + m.unpaid, 0))} — 수금 연락 필요`);
  if (r.attendanceRisk.count > 0)
    items.push(`최근14일 미방문 활성회원 ${r.attendanceRisk.count}명 — 이탈 전 연락 검토`);
  const failedAuto = r.autoMessage.reduce((s, c) => s + c.failed, 0);
  if (failedAuto > 0) items.push(`13시 자동문자 발송 실패 ${failedAuto}건 — 원인 확인 필요`);
  if (items.length < 3 && r.funnel.registerRate < 40 && r.funnel.consulted > 0)
    items.push(`상담→등록 전환율 ${r.funnel.registerRate}%로 낮음 — 팔로업 점검`);
  return items.slice(0, 3);
}

export function buildWeeklyKakaoText(r: WeeklyBriefResult): string {
  const sign = r.revenue.diff >= 0 ? "+" : "";
  const pctText = r.revenue.diffPct === null ? "" : ` ${r.revenue.diffPct >= 0 ? "+" : ""}${r.revenue.diffPct}%`;
  const branchLine = r.revenue.byBranch.map((b) => `${b.branchName} ${man(b.amount)}`).join(" · ");
  const typeLine = r.revenue.byType.map((t) => `${t.type} ${man(t.amount)}`).join(" · ");

  const lines = [
    `🧑‍💼 주간 운영 보고 (${r.weekStart}~${r.weekEnd})`,
    `[매출] ${man(r.revenue.total)} (전주대비 ${sign}${man(r.revenue.diff)}${pctText})`,
    branchLine ? `지점별: ${branchLine}` : "",
    typeLine ? `상품별: ${typeLine}` : "",
    `[방문] 총 ${r.visits.total}회 · 실제방문회원 ${r.visits.uniqueMembers}명 (전주 ${r.visits.prevTotal}회)`,
    `[신규·재등록] 신규 ${r.registration.newCount}건 · 재등록 ${r.registration.reRegisterCount}건 (전주 신규${r.registration.prevNewCount}·재등록${r.registration.prevReRegisterCount})`,
    `[상담전환] 신규리드 ${r.funnel.newLeads} · 상담 ${r.funnel.consulted} · 등록 ${r.funnel.registered} / 상담전환율 ${r.funnel.consultRate}% · 등록전환율 ${r.funnel.registerRate}%`,
    `[만료임박] 30일내 ${r.expiringSoon.count}명`,
    `[이탈위험·출석기준] ${r.attendanceRisk.count}명: ${namesList(r.attendanceRisk.members.map((m) => m.name))}`,
    `[미수금] 총 ${man(r.unpaid.total)}(${r.unpaid.memberCount}명) · 장기미수(30일+) ${r.unpaid.longOverdue.length}명: ${namesList(r.unpaid.longOverdue.map((m) => m.name))}`,
    `[13시자동문자] ${r.autoMessage.map((c) => `${c.label} 대상${c.targeted}·성공${c.sent}·실패${c.failed}·연결${c.converted}`).join(" / ") || "이번 주 발송 없음"}`,
  ];

  const actionItems = buildActionItems(r);
  lines.push(`[확인 필요] ${actionItems.length > 0 ? actionItems.map((a, i) => `${i + 1}) ${a}`).join(" / ") : "특이사항 없음"}`);

  return lines.filter(Boolean).join("\n");
}
