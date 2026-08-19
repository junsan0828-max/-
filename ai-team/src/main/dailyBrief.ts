// 오전 9시 카카오 브리핑 — "오늘 현황 스냅샷"이 아니라 "어제 하루 운영 결과"를 집계해서 보낸다
// (2026-08-19 대표 지시). 매출은 어제 발생분만, 회원 현황은 오늘 아침 기준 스냅샷,
// 이탈위험은 만료일이 아니라 실제 출석 패턴(attendances)으로 판단한다.
import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { todayStr, addDays, findExpiryCandidates, findLapsedCandidates, findConsultFollowupCandidates } from "./autoMessage";
import { BRANCH_IDS, REVENUE_SUBTYPES, branchLabel, daysBetween, computeChurnRisk, gatherUnpaid, type UnpaidLine } from "./gymShared";

interface RevenueLine {
  branchId: number | null;
  customerName: string;
  program: string;
  paidAmount: number;
  subType: string;
}

interface MemberStatus {
  branchId: number;
  branchName: string;
  active: number;
  newCount: number; // 어제 헬스 신규
  reRegisterCount: number; // 어제 헬스 재등록
  expiringD10: number;
  expiringD5: number;
  churnRisk: number;
  churnRiskAndExpiring: number; // 만료임박(D-10 또는 D-5) 이면서 이탈위험에도 해당
}

interface AutoMessagePreview {
  d10: number;
  d5: number;
  consultFollowup: number;
  lapsedRecover: number;
  total: number;
}

export interface DailyBrief {
  yesterday: string; // YYYY-MM-DD
  today: string;
  revenueByBranch: { branchId: number | null; branchName: string; lines: RevenueLine[] }[];
  memberStatus: MemberStatus[];
  unpaid: { lines: UnpaidLine[]; total: number; memberCount: number };
  changes: string[]; // 전일 브리핑 대비 변화 (없으면 빈 배열)
  autoMessagePreview: AutoMessagePreview;
  noAttendanceLogCount: number; // 출석기록이 아예 없어 이탈위험 판단에서 제외된 활성회원 수
}

async function gatherRevenue(sql: NeonQueryFunction<false, false>, yesterday: string) {
  const rows = (await sql.query(
    `SELECT "branchId", "customerName", type, "subType", "paidAmount", "programDetail", sessions
     FROM revenue_entries
     WHERE "paymentDate" = $1 AND "subType" = ANY($2)
     ORDER BY "branchId" NULLS LAST, id`,
    [yesterday, REVENUE_SUBTYPES]
  )) as {
    branchId: number | null;
    customerName: string | null;
    type: string;
    subType: string;
    paidAmount: number;
    programDetail: string | null;
    sessions: number | null;
  }[];

  const lines: RevenueLine[] = rows.map((r) => ({
    branchId: r.branchId,
    customerName: r.customerName ?? "이름없음",
    program: r.type === "PT" && r.sessions ? `${r.programDetail ?? "PT"} ${r.sessions}회` : r.programDetail ?? r.type,
    paidAmount: Number(r.paidAmount ?? 0),
    subType: r.subType,
  }));

  const byBranch = new Map<number | null, RevenueLine[]>();
  for (const line of lines) {
    if (!byBranch.has(line.branchId)) byBranch.set(line.branchId, []);
    byBranch.get(line.branchId)!.push(line);
  }

  const result: { branchId: number | null; branchName: string; lines: RevenueLine[] }[] = BRANCH_IDS.map((id) => ({
    branchId: id,
    branchName: branchLabel(id),
    lines: byBranch.get(id) ?? [],
  }));
  const unassigned = byBranch.get(null) ?? [];
  if (unassigned.length > 0) result.push({ branchId: null, branchName: branchLabel(null), lines: unassigned });
  return result;
}

async function gatherMemberStatus(sql: NeonQueryFunction<false, false>, yesterday: string, today: string) {
  const [activeByBranch, activeMembers, attendances, d10Candidates, d5Candidates, yesterdayGymRows] = (await Promise.all([
    sql.query(`SELECT "branchId", COUNT(*) c FROM members WHERE status = 'active' GROUP BY "branchId"`),
    sql.query(`SELECT id, "branchId", "membershipStart" FROM members WHERE status = 'active'`),
    sql.query(
      `SELECT a."memberId" AS "memberId", a."attendDate" AS "attendDate"
       FROM attendances a JOIN members m ON a."memberId" = m.id
       WHERE m.status = 'active' AND a."attendDate" >= $1`,
      [addDays(today, -60)]
    ),
    findExpiryCandidates(sql, addDays(today, 10)),
    findExpiryCandidates(sql, addDays(today, 5)),
    sql.query(
      `SELECT "branchId", "subType" FROM revenue_entries WHERE "paymentDate" = $1 AND type = '헬스' AND "subType" IN ('신규','재등록')`,
      [yesterday]
    ),
  ])) as [
    { branchId: number | null; c: string }[],
    { id: number; branchId: number | null; membershipStart: string }[],
    { memberId: number; attendDate: string }[],
    Awaited<ReturnType<typeof findExpiryCandidates>>,
    Awaited<ReturnType<typeof findExpiryCandidates>>,
    { branchId: number | null; subType: string }[]
  ];

  const activeMap = new Map(activeByBranch.map((r) => [r.branchId, Number(r.c)]));
  const { risky: churnRisk, noAttendanceLogCount } = computeChurnRisk(
    activeMembers.map((m) => ({ id: m.id, branchId: m.branchId, membershipStart: m.membershipStart })),
    attendances,
    today
  );
  const churnByBranch = new Map<number, number>();
  const churnAndExpiringByBranch = new Map<number, number>();
  const expiringMemberIdsByBranch = new Map<number, Set<number>>();
  for (const c of [...d10Candidates, ...d5Candidates]) {
    if (c.branchId == null) continue;
    if (!expiringMemberIdsByBranch.has(c.branchId)) expiringMemberIdsByBranch.set(c.branchId, new Set());
    expiringMemberIdsByBranch.get(c.branchId)!.add(c.id);
  }
  for (const m of activeMembers) {
    if (m.branchId == null || !churnRisk.has(m.id)) continue;
    churnByBranch.set(m.branchId, (churnByBranch.get(m.branchId) ?? 0) + 1);
    if (expiringMemberIdsByBranch.get(m.branchId)?.has(m.id)) {
      churnAndExpiringByBranch.set(m.branchId, (churnAndExpiringByBranch.get(m.branchId) ?? 0) + 1);
    }
  }

  const d10ByBranch = new Map<number, number>();
  for (const c of d10Candidates) if (c.branchId != null) d10ByBranch.set(c.branchId, (d10ByBranch.get(c.branchId) ?? 0) + 1);
  const d5ByBranch = new Map<number, number>();
  for (const c of d5Candidates) if (c.branchId != null) d5ByBranch.set(c.branchId, (d5ByBranch.get(c.branchId) ?? 0) + 1);

  const newByBranch = new Map<number, number>();
  const reRegisterByBranch = new Map<number, number>();
  for (const r of yesterdayGymRows) {
    if (r.branchId == null) continue;
    if (r.subType === "신규") newByBranch.set(r.branchId, (newByBranch.get(r.branchId) ?? 0) + 1);
    if (r.subType === "재등록") reRegisterByBranch.set(r.branchId, (reRegisterByBranch.get(r.branchId) ?? 0) + 1);
  }

  const status: MemberStatus[] = BRANCH_IDS.map((id) => ({
    branchId: id,
    branchName: branchLabel(id),
    active: activeMap.get(id) ?? 0,
    newCount: newByBranch.get(id) ?? 0,
    reRegisterCount: reRegisterByBranch.get(id) ?? 0,
    expiringD10: d10ByBranch.get(id) ?? 0,
    expiringD5: d5ByBranch.get(id) ?? 0,
    churnRisk: churnByBranch.get(id) ?? 0,
    churnRiskAndExpiring: churnAndExpiringByBranch.get(id) ?? 0,
  }));

  return { status, churnRiskTotal: churnRisk.size, noAttendanceLogCount };
}

async function gatherAutoMessagePreview(sql: NeonQueryFunction<false, false>, today: string, yesterday: string): Promise<AutoMessagePreview> {
  const [d10, d5, consultFollowup, lapsedRecover] = await Promise.all([
    findExpiryCandidates(sql, addDays(today, 10)),
    findExpiryCandidates(sql, addDays(today, 5)),
    findConsultFollowupCandidates(sql, yesterday),
    findLapsedCandidates(sql, addDays(today, -14), addDays(today, -3)),
  ]);
  return {
    d10: d10.length,
    d5: d5.length,
    consultFollowup: consultFollowup.length,
    lapsedRecover: lapsedRecover.length,
    total: d10.length + d5.length + consultFollowup.length + lapsedRecover.length,
  };
}

interface Snapshot {
  date: string;
  churnRiskTotal: number;
  unpaidMemberCount: number;
  expiringTotal: number;
  reRegisterCount: number;
}

function snapshotPath(date: string): string {
  const dir = join(__dirname, "..", "..", "output", "daily-brief");
  mkdirSync(dir, { recursive: true });
  return join(dir, `${date}.json`);
}

function loadSnapshot(date: string): Snapshot | null {
  try {
    return JSON.parse(readFileSync(snapshotPath(date), "utf-8"));
  } catch {
    return null;
  }
}

function saveSnapshot(snapshot: Snapshot) {
  writeFileSync(snapshotPath(snapshot.date), JSON.stringify(snapshot, null, 2), "utf-8");
}

/** 어제 저장된(오늘 아침 기준 하루 전 실행분) 스냅샷과 비교해 눈에 띄는 변화만 뽑는다.
 * 이전 스냅샷이 없으면(최초 실행) 비교 없이 빈 배열을 돌려준다. */
function computeChanges(today: string, current: Omit<Snapshot, "date">): string[] {
  const prev = loadSnapshot(addDays(today, -1));
  saveSnapshot({ date: today, ...current });
  if (!prev) return [];

  const changes: string[] = [];
  const churnDiff = current.churnRiskTotal - prev.churnRiskTotal;
  if (churnDiff !== 0) changes.push(`이탈위험 ${churnDiff > 0 ? "+" : ""}${churnDiff}명`);

  const unpaidDiff = current.unpaidMemberCount - prev.unpaidMemberCount;
  if (unpaidDiff !== 0) changes.push(`미수금 ${unpaidDiff > 0 ? "+" : ""}${unpaidDiff}건`);

  const expiringDiff = current.expiringTotal - prev.expiringTotal;
  if (expiringDiff > 0) changes.push(`만료임박 회원 증가 (${prev.expiringTotal}명 → ${current.expiringTotal}명)`);

  if (current.reRegisterCount < prev.reRegisterCount) changes.push(`재등록 감소 (${prev.reRegisterCount}건 → ${current.reRegisterCount}건)`);

  return changes;
}

export async function gatherDailyBrief(): Promise<DailyBrief> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL 미설정");

  const sql = neon(url);
  const today = todayStr();
  const yesterday = addDays(today, -1);

  const [revenueByBranch, memberStatusResult, unpaid, autoMessagePreview] = await Promise.all([
    gatherRevenue(sql, yesterday),
    gatherMemberStatus(sql, yesterday, today),
    gatherUnpaid(sql, today),
    gatherAutoMessagePreview(sql, today, yesterday),
  ]);

  const expiringTotal = memberStatusResult.status.reduce((s, b) => s + b.expiringD10 + b.expiringD5, 0);
  const reRegisterCount = memberStatusResult.status.reduce((s, b) => s + b.reRegisterCount, 0);
  const changes = computeChanges(today, {
    churnRiskTotal: memberStatusResult.churnRiskTotal,
    unpaidMemberCount: unpaid.memberCount,
    expiringTotal,
    reRegisterCount,
  });

  return {
    yesterday,
    today,
    revenueByBranch,
    memberStatus: memberStatusResult.status,
    unpaid,
    changes,
    autoMessagePreview,
    noAttendanceLogCount: memberStatusResult.noAttendanceLogCount,
  };
}

function formatDateTitle(ymd: string): string {
  const [, m, d] = ymd.split("-").map(Number);
  return `${m}월 ${d}일`;
}

export function buildDailyBriefKakaoText(brief: DailyBrief): string {
  const lines: string[] = [];

  lines.push(`[${formatDateTitle(brief.yesterday)} 전일 운영 브리핑]`);
  lines.push("");

  // 1. 어제 매출 및 등록 프로그램
  lines.push("어제 매출");
  for (const b of brief.revenueByBranch) {
    lines.push("");
    if (b.lines.length === 0) {
      lines.push(`${b.branchName} : 매출 없음`);
      continue;
    }
    lines.push(b.branchName);
    for (const l of b.lines) {
      lines.push(`${l.customerName} / ${l.program} / ${l.paidAmount.toLocaleString()}원 / ${l.subType}`);
    }
  }
  lines.push("");

  // 2. 회원 현황
  lines.push("회원 현황");
  for (const s of brief.memberStatus) {
    lines.push("");
    lines.push(s.branchName);
    lines.push(`활성 ${s.active}명 · 신규 ${s.newCount} · 재등록 ${s.reRegisterCount}`);
    lines.push(`만료임박 D-10 ${s.expiringD10}명 · D-5 ${s.expiringD5}명`);
    lines.push(`이탈위험 ${s.churnRisk}명 (만료임박 중 ${s.churnRiskAndExpiring}명)`);
  }
  if (brief.noAttendanceLogCount > 0) {
    lines.push("");
    lines.push(`(출석기록 없는 회원 ${brief.noAttendanceLogCount}명은 이탈위험 판단에서 제외)`);
  }
  lines.push("");

  // 3. 미수금 회원 상세
  lines.push("미수금");
  if (brief.unpaid.lines.length === 0) {
    lines.push("미수금 없음");
  } else {
    lines.push(`총 ${brief.unpaid.total.toLocaleString()}원 / ${brief.unpaid.memberCount}명`);
    lines.push("");
    for (const u of brief.unpaid.lines) {
      lines.push(`${u.customerName} / ${u.unpaid.toLocaleString()}원 / ${u.program} / ${u.daysElapsed}일 경과`);
    }
    const overdue = brief.unpaid.lines.filter((u) => u.daysElapsed >= 14);
    if (overdue.length > 0) {
      lines.push("");
      lines.push("미수금 주의 (14일 이상 경과)");
      for (const u of overdue) {
        lines.push(`${u.customerName} / ${u.unpaid.toLocaleString()}원 / ${u.daysElapsed}일 경과`);
      }
    }
  }

  // 4. 주요 변화 및 이상징후 (없으면 생략)
  if (brief.changes.length > 0) {
    lines.push("");
    lines.push("주요 변화");
    for (const c of brief.changes) lines.push(c);
  }

  // 5. 오늘 자동화 예정
  lines.push("");
  lines.push("오늘 예정");
  lines.push("13시 자동문자 발송");
  lines.push(`만료 D-10 ${brief.autoMessagePreview.d10}명 · D-5 ${brief.autoMessagePreview.d5}명`);
  lines.push(`상담 후속 ${brief.autoMessagePreview.consultFollowup}명 · 재등록 유도 ${brief.autoMessagePreview.lapsedRecover}명`);
  lines.push(`총 ${brief.autoMessagePreview.total}명 발송 예정`);

  return lines.join("\n");
}
