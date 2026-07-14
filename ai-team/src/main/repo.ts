// 리포트 AI "리포" — 매달 지점별(1호점/2호점) + 통합으로 "월 운영 전략" · "회원권 재등록 전략" ·
// "PT 재등록 전략" 세 가지 실전 전략 리포트를 만든다. 숫자 나열이 아니라 다음 달에 뭘 해야 하는지까지 담는다.
// 자이언트짐+ DB(ZIANTGYM+)가 이미 이벤트·PT·재등록 이력을 갖고 있어서(회원권 재등록은 gym_plus_membership_renewals
// 테이블이 비어있어 대신 revenue_entries의 subType='재등록'을 실제 신호로 쓴다) 그걸 기본 소스로 쓰고,
// 구글 드라이브의 "브로제이데이터" 엑셀은 DB에 없는 특이사항 메모만 보조로 참고한다.
import Anthropic from "@anthropic-ai/sdk";
import { Pool } from "pg";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { google } from "googleapis";
import { getAuthorizedClient } from "./drive/auth";
import { searchFiles, readAllTabs } from "./drive/drive";

const MODEL = process.env.AI_TEAM_MODEL || "claude-sonnet-4-6";

export interface BranchStrategy {
  branchId: number | null; // null = 통합(전체)
  branchName: string;
  operationsReport: string; // 월 운영 전략 (마크다운)
  membershipRenewalReport: string; // 회원권 재등록 전략
  ptRenewalReport: string; // PT 재등록 전략
}

export interface RepoResult {
  yearMonth: string;
  generatedAt: string;
  isAI: boolean;
  branches: BranchStrategy[]; // [1호점, 2호점, 전체]
  dataNotes: string[]; // 데이터 품질/한계 안내 (지어내지 않기 위해 남김)
  expenseMissing: boolean; // 이번 달 지출(expense_entries) 입력이 안 된 상태인지
}

function getPool() {
  return new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
}

/** 오늘 기준 "전월" (YYYY-MM). */
export function previousYearMonth(date = new Date()): string {
  const d = new Date(date.getFullYear(), date.getMonth() - 1, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthsBack(yearMonth: string, n: number): string {
  const [y, m] = yearMonth.split("-").map(Number);
  const d = new Date(y, m - 1 - n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

const BRANCH_NAMES: Record<number, string> = { 1: "1호점", 2: "2호점" };

interface RawData {
  revenueByMonth: { branchId: number | null; ym: string; type: string; subType: string; count: number; amount: number }[];
  expenseByMonth: { branchId: number | null; ym: string; category: string; amount: number }[];
  expiringSoon: { branchId: number | null; name: string; membershipEnd: string }[];
  recentlyExpired: { branchId: number | null; name: string; membershipEnd: string }[];
  ptEndingSoon: {
    branchId: number | null;
    memberName: string;
    usedSessions: number;
    totalSessions: number;
    expiryDate: string;
  }[];
  attendanceByMonth: { branchId: number | null; ym: string; count: number }[];
  nullBranchRevenueCount: number;
}

async function gatherRawData(yearMonth: string): Promise<RawData> {
  const pool = getPool();
  try {
    const [y, m] = yearMonth.split("-").map(Number);
    const nextMonth = m === 12 ? 1 : m + 1;
    const nextYear = m === 12 ? y + 1 : y;
    const monthEnd = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`;
    const sixMonthsBack = monthsBack(yearMonth, 5);
    const today = new Date().toISOString().slice(0, 10);
    const in30 = new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10);
    const ago14 = new Date(Date.now() - 14 * 864e5).toISOString().slice(0, 10);

    const [revenue, expense, expiring, expired, ptEnding, attendance, nullBranch] = await Promise.all([
      pool.query<{ branchId: number | null; ym: string; type: string; subType: string; c: string; amt: string }>(
        `SELECT "branchId", substr("paymentDate",1,7) ym, type, "subType", COUNT(*) c, SUM("paidAmount") amt
         FROM revenue_entries WHERE "paymentDate" >= $1 AND "paymentDate" < $2
         GROUP BY 1,2,3,4 ORDER BY 2`,
        [sixMonthsBack, monthEnd]
      ),
      pool.query<{ branchId: number | null; ym: string; category: string; amt: string }>(
        `SELECT "branchId", substr("expenseDate",1,7) ym, category, SUM(amount) amt
         FROM expense_entries WHERE "expenseDate" >= $1 AND "expenseDate" < $2
         GROUP BY 1,2,3 ORDER BY 2`,
        [sixMonthsBack, monthEnd]
      ),
      pool.query<{ branchId: number | null; name: string; membershipEnd: string }>(
        `SELECT "branchId", name, "membershipEnd" FROM members
         WHERE "membershipEnd" IS NOT NULL AND "membershipEnd" >= $1 AND "membershipEnd" <= $2
         ORDER BY "membershipEnd" ASC LIMIT 200`,
        [today, in30]
      ),
      pool.query<{ branchId: number | null; name: string; membershipEnd: string }>(
        `SELECT "branchId", name, "membershipEnd" FROM members
         WHERE "membershipEnd" IS NOT NULL AND "membershipEnd" >= $1 AND "membershipEnd" < $2
         ORDER BY "membershipEnd" DESC LIMIT 200`,
        [ago14, today]
      ),
      pool.query<{
        branchId: number | null;
        memberName: string;
        usedSessions: number;
        totalSessions: number;
        expiryDate: string;
      }>(
        `SELECT m."branchId", p."packageName" || ' - ' || m.name as "memberName", p."usedSessions", p."totalSessions", p."expiryDate"
         FROM pt_packages p JOIN members m ON p."memberId" = m.id
         WHERE p.status = 'active'
           AND (p."expiryDate" BETWEEN $1 AND $2 OR p."usedSessions" >= p."totalSessions" - 2)
         ORDER BY p."expiryDate" ASC LIMIT 200`,
        [today, in30]
      ),
      pool.query<{ branchId: number | null; ym: string; c: string }>(
        `SELECT m."branchId", substr(a."attendDate",1,7) ym, COUNT(*) c
         FROM attendances a JOIN members m ON a."memberId" = m.id
         WHERE a."attendDate" >= $1 AND a."attendDate" < $2
         GROUP BY 1,2 ORDER BY 2`,
        [sixMonthsBack, monthEnd]
      ),
      pool.query<{ c: string }>(
        `SELECT COUNT(*) c FROM revenue_entries WHERE "paymentDate" >= $1 AND "paymentDate" < $2 AND "branchId" IS NULL`,
        [`${yearMonth}-01`, monthEnd]
      ),
    ]);

    return {
      revenueByMonth: revenue.rows.map((r) => ({
        branchId: r.branchId,
        ym: r.ym,
        type: r.type,
        subType: r.subType,
        count: Number(r.c),
        amount: Number(r.amt ?? 0),
      })),
      expenseByMonth: expense.rows.map((r) => ({ branchId: r.branchId, ym: r.ym, category: r.category, amount: Number(r.amt ?? 0) })),
      expiringSoon: expiring.rows,
      recentlyExpired: expired.rows,
      ptEndingSoon: ptEnding.rows.map((r) => ({
        branchId: r.branchId,
        memberName: r.memberName,
        usedSessions: Number(r.usedSessions),
        totalSessions: Number(r.totalSessions),
        expiryDate: r.expiryDate,
      })),
      attendanceByMonth: attendance.rows.map((r) => ({ branchId: r.branchId, ym: r.ym, count: Number(r.c) })),
      nullBranchRevenueCount: Number(nullBranch.rows[0]?.c ?? 0),
    };
  } finally {
    await pool.end();
  }
}

/** 구글 드라이브 "브로제이데이터" 엑셀의 특이사항 메모만 뽑아온다. 실패해도 전체 리포트는 계속 진행한다. */
async function getSpecialNotes(): Promise<string[]> {
  try {
    const found = await searchFiles("브로제이데이터");
    const file = found.find((f) => f.name === "브로제이데이터");
    if (!file) return [];

    const auth = await getAuthorizedClient();
    const drive = google.drive({ version: "v3", auth });
    const copy = await drive.files.copy({
      fileId: file.id,
      requestBody: { name: "브로제이데이터 (리포 임시변환)", mimeType: "application/vnd.google-apps.spreadsheet" },
      fields: "id",
    });
    const tempId = copy.data.id!;
    try {
      const tabs = await readAllTabs(tempId);
      const rows = Object.values(tabs)[0] ?? [];
      if (rows.length === 0) return [];
      const header = rows[0];
      const nameIdx = header.indexOf("이름");
      const noteIdx = header.indexOf("특이사항");
      if (nameIdx === -1 || noteIdx === -1) return [];
      return rows
        .slice(1)
        .filter((r) => r[noteIdx] && r[noteIdx] !== "-")
        .slice(0, 30)
        .map((r) => `${r[nameIdx]}: ${r[noteIdx]}`);
    } finally {
      await drive.files.delete({ fileId: tempId }).catch(() => {});
    }
  } catch (err) {
    console.error("[리포] 브로제이데이터 참고 실패 (계속 진행):", err instanceof Error ? err.message : err);
    return [];
  }
}

function branchLabel(branchId: number | null): string {
  return branchId === null ? "전체(통합)" : BRANCH_NAMES[branchId] ?? `지점${branchId}`;
}

/** branchId(1, 2, 또는 null=통합)에 해당하는 raw 데이터만 골라 요약 텍스트로 만든다. */
function buildBranchSummary(raw: RawData, branchId: number | null, yearMonth: string, notes: string[]): string {
  const matches = (b: number | null) => (branchId === null ? true : b === branchId);

  const revenueThisMonth = raw.revenueByMonth.filter((r) => matches(r.branchId) && r.ym === yearMonth);
  const revenueTrend = Array.from(
    raw.revenueByMonth
      .filter((r) => matches(r.branchId))
      .reduce((acc, r) => {
        acc.set(r.ym, (acc.get(r.ym) ?? 0) + r.amount);
        return acc;
      }, new Map<string, number>())
      .entries()
  ).sort(([a], [b]) => a.localeCompare(b));

  const membershipNew = revenueThisMonth.filter((r) => r.type === "헬스" && r.subType === "신규");
  const membershipRenew = revenueThisMonth.filter((r) => r.type === "헬스" && r.subType === "재등록");
  const ptNew = revenueThisMonth.filter((r) => r.type === "PT" && r.subType === "신규");
  const ptRenew = revenueThisMonth.filter((r) => r.type === "PT" && r.subType === "재등록");

  const expenseThisMonth = raw.expenseByMonth.filter((r) => matches(r.branchId) && r.ym === yearMonth);
  const totalExpense = expenseThisMonth.reduce((s, r) => s + r.amount, 0);
  const totalRevenue = revenueThisMonth.reduce((s, r) => s + r.amount, 0);

  const expiring = raw.expiringSoon.filter((r) => matches(r.branchId));
  const expired = raw.recentlyExpired.filter((r) => matches(r.branchId));
  const ptEnding = raw.ptEndingSoon.filter((r) => matches(r.branchId));

  const attendanceTrend = Array.from(
    raw.attendanceByMonth
      .filter((r) => matches(r.branchId))
      .reduce((acc, r) => {
        acc.set(r.ym, (acc.get(r.ym) ?? 0) + r.count);
        return acc;
      }, new Map<string, number>())
      .entries()
  ).sort(([a], [b]) => a.localeCompare(b));

  return `[${branchLabel(branchId)} · 기준월 ${yearMonth}]
- 이번 달 매출 ${totalRevenue.toLocaleString()}원 / 지출 ${totalExpense.toLocaleString()}원 (순이익 ${(totalRevenue - totalExpense).toLocaleString()}원)
- 최근 매출 추이(월별 합계): ${revenueTrend.map(([ym, amt]) => `${ym}=${amt.toLocaleString()}원`).join(", ") || "데이터 없음"}
- 헬스(회원권): 신규 ${membershipNew.length}건, 재등록 ${membershipRenew.length}건
- PT: 신규 ${ptNew.length}건, 재등록 ${ptRenew.length}건
- 30일 내 회원권 만료 예정 ${expiring.length}명, 최근 14일 내 만료(이탈위험) ${expired.length}명
- PT 패키지 소진 임박(잔여 2회 이하 또는 30일 내 만료) ${ptEnding.length}명
- 출석 추이(월별 방문 횟수 합계): ${attendanceTrend.map(([ym, c]) => `${ym}=${c}회`).join(", ") || "데이터 없음"}
${notes.length > 0 ? `- 참고 메모(브로제이데이터 특이사항 일부): ${notes.slice(0, 10).join(" / ")}` : ""}`;
}

const SECTION_MARKERS = {
  operationsReport: "===운영전략===",
  membershipRenewalReport: "===회원권재등록전략===",
  ptRenewalReport: "===PT재등록전략===",
} as const;

/** 리포트 3개는 마크다운(표, 인용, 줄바꿈)이 많아 JSON으로 받으면 모델이 이스케이프를 놓쳐 파싱이
 * 잘 깨진다. 그래서 구분자로 나눈 순수 텍스트로 받아 문자열 그대로 잘라 쓴다. */
function extractSections(text: string): Record<keyof typeof SECTION_MARKERS, string> {
  const positions = (Object.entries(SECTION_MARKERS) as [keyof typeof SECTION_MARKERS, string][])
    .map(([key, marker]) => ({ key, index: text.indexOf(marker), markerLen: marker.length }))
    .filter((p) => p.index !== -1)
    .sort((a, b) => a.index - b.index);

  if (positions.length < 3) throw new Error(`구분자 파싱 실패: ${positions.length}/3개 섹션만 발견`);

  const result = {} as Record<keyof typeof SECTION_MARKERS, string>;
  positions.forEach((p, i) => {
    const start = p.index + p.markerLen;
    const end = i + 1 < positions.length ? positions[i + 1].index : text.length;
    result[p.key] = text.slice(start, end).trim();
  });
  return result;
}

function fallbackBranch(branchId: number | null, summary: string): BranchStrategy {
  return {
    branchId,
    branchName: branchLabel(branchId),
    operationsReport: `## ${branchLabel(branchId)} 월 운영 전략 (규칙 기반)\n\n${summary}`,
    membershipRenewalReport: "AI 분석 실패로 규칙 기반 요약만 제공합니다. 위 운영 전략 데이터를 참고하세요.",
    ptRenewalReport: "AI 분석 실패로 규칙 기반 요약만 제공합니다. 위 운영 전략 데이터를 참고하세요.",
  };
}

async function analyzeBranch(branchId: number | null, summary: string, apiKey: string): Promise<BranchStrategy> {
  const client = new Anthropic({ apiKey });
  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 6000,
    system: `너는 자이언트짐 AI 운영팀의 리포트 담당 AI "리포"다. 숫자를 나열만 하는 리포트는 의미가 없다.
반드시 "다음 달에 구체적으로 뭘 해야 하는지" 실행 가능한 전략을 제시한다 (예: 언제 누구에게 어떤 이벤트/문자/제안을 할지).
근거 없는 수치나 사실은 지어내지 말고, 데이터가 부족하면 부족하다고 명시한다.
반드시 다른 설명 없이 아래 형식으로만 출력한다 (JSON이나 코드블록으로 감싸지 않는다):
${SECTION_MARKERS.operationsReport}
(월 운영 전략 마크다운)
${SECTION_MARKERS.membershipRenewalReport}
(회원권 재등록 전략 마크다운)
${SECTION_MARKERS.ptRenewalReport}
(PT 재등록 전략 마크다운)`,
    messages: [
      {
        role: "user",
        content: `아래는 ${branchLabel(branchId)}의 이번 달 운영 데이터다.

${summary}

이 데이터로 아래 3개의 전략 리포트를 마크다운으로 작성하라. 각 리포트는 "현황 해석 → 다음 달 실행 전략(구체적 액션)" 순서로 쓴다.
1. 월 운영 전략 — 매출/지출/순이익 추이 해석 + 다음 달 운영 우선순위
2. 회원권 재등록 전략 — 만료 예정/이탈위험 회원을 언제·어떻게 컨택해야 재등록률이 오르는지
3. PT 재등록 전략 — PT 패키지 소진 임박 회원을 어떻게 재등록으로 이어지게 할지, 트레이너 관점 포함

system 프롬프트에서 지정한 구분자 형식 그대로 출력하라.`,
      },
    ],
  });
  const text = msg.content[0]?.type === "text" ? msg.content[0].text : "";
  const sections = extractSections(text);
  return {
    branchId,
    branchName: branchLabel(branchId),
    operationsReport: sections.operationsReport,
    membershipRenewalReport: sections.membershipRenewalReport,
    ptRenewalReport: sections.ptRenewalReport,
  };
}

export async function runRepo(yearMonth: string = previousYearMonth()): Promise<RepoResult> {
  const raw = await gatherRawData(yearMonth);
  const notes = await getSpecialNotes();
  const apiKey = process.env.ANTHROPIC_API_KEY;

  const dataNotes: string[] = [];
  if (raw.nullBranchRevenueCount > 0)
    dataNotes.push(
      `이번 달 매출 기록 중 ${raw.nullBranchRevenueCount}건은 지점 정보가 없어 "전체" 합계에는 포함했지만 지점별 리포트에서는 빠졌습니다. 운영시스템에서 지점 미지정 매출을 확인해주세요.`
    );
  dataNotes.push("목표 매출(revenue_targets)이 아직 설정되어 있지 않아, 이번 리포트는 목표 대비 실적이 아닌 월별 추이로 분석했습니다.");

  const targets: (number | null)[] = [1, 2, null];
  const branches: BranchStrategy[] = [];

  // 브로제이데이터 특이사항은 지점 구분 컬럼이 없어 어느 지점 소속인지 신뢰할 수 없다.
  // 지점별 리포트에 잘못 귀속시키지 않기 위해 통합(전체) 리포트에만 참고 메모로 붙인다.
  const hasExpenseThisMonth = raw.expenseByMonth.some((r) => r.ym === yearMonth);
  if (!hasExpenseThisMonth)
    dataNotes.push(`${yearMonth} 지출(expense_entries) 기록이 아직 없습니다 — 회계 입력이 늦어졌을 수 있어 순이익 수치는 참고만 해주세요.`);

  for (const branchId of targets) {
    const summary = buildBranchSummary(raw, branchId, yearMonth, branchId === null ? notes : []);
    if (!apiKey) {
      branches.push(fallbackBranch(branchId, summary));
      continue;
    }
    try {
      branches.push(await analyzeBranch(branchId, summary, apiKey));
    } catch (err) {
      console.error(`[리포] ${branchLabel(branchId)} AI 분석 실패, 규칙 기반으로 전환:`, err instanceof Error ? err.message : err);
      branches.push(fallbackBranch(branchId, summary));
    }
  }

  return {
    yearMonth,
    generatedAt: new Date().toISOString(),
    isAI: !!apiKey,
    branches,
    dataNotes,
    expenseMissing: !hasExpenseThisMonth,
  };
}

export function saveRepoResult(result: RepoResult): string {
  const outDir = join(__dirname, "..", "..", "output", "repo");
  mkdirSync(outDir, { recursive: true });
  const path = join(outDir, `${result.yearMonth}.json`);
  writeFileSync(path, JSON.stringify(result, null, 2), "utf-8");
  return path;
}

/** 이번 달에 이미 만든 리포트가 있으면 돌려준다 (앱 재시작해도 같은 달엔 API를 다시 부르지 않기 위함). */
export function loadRepoResult(yearMonth: string): RepoResult | null {
  try {
    const path = join(__dirname, "..", "..", "output", "repo", `${yearMonth}.json`);
    return JSON.parse(readFileSync(path, "utf-8"));
  } catch {
    return null;
  }
}
