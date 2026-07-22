// Notion 연동 — 제이의 일일 브리핑을 Notion 데이터베이스에 자동 기록.
// 집 PC 화면 앞에 있지 않아도 휴대폰 Notion 앱으로 언제든 확인 가능하게 한다.
// 공식 Notion API 사용 (내부 통합 토큰 방식, OAuth 아님 - 개인/팀 용도로 충분).
import { OrchestratorResult, TeamTask } from "./orchestrator";
import { MinaResult } from "./mina";
import { FunnelResult } from "./dataAgent";
import { ContentResult } from "./luna";
import { PayrollResult } from "./payroll";
import { RepoResult } from "./repo";
import { JournalEntry } from "./journal";
import { GymContext } from "./data";

const NOTION_VERSION = "2022-06-28";

export interface NotionPushResult {
  ok: boolean;
  url?: string;
  error?: string;
}

function isConfigured() {
  return !!(process.env.NOTION_API_KEY && process.env.NOTION_DATABASE_ID);
}

async function notionFetch(path: string, init: RequestInit) {
  const res = await fetch(`https://api.notion.com/v1${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${process.env.NOTION_API_KEY}`,
      "Notion-Version": NOTION_VERSION,
      "content-type": "application/json",
      ...(init.headers || {}),
    },
  });
  const data: any = await res.json();
  if (!res.ok) throw new Error(data?.message || `Notion API 오류 (${res.status})`);
  return data;
}

/** 데이터베이스의 title 속성 이름을 찾는다 (사용자가 임의로 지었을 수 있어 동적으로 탐지). */
async function findTitleProperty(databaseId: string): Promise<string> {
  const db = await notionFetch(`/databases/${databaseId}`, { method: "GET" });
  const entry = Object.entries<any>(db.properties).find(([, v]) => v.type === "title");
  if (!entry) throw new Error("데이터베이스에서 제목(title) 속성을 찾지 못했습니다.");
  return entry[0];
}

function paragraph(text: string) {
  return { object: "block", type: "paragraph", paragraph: { rich_text: [{ text: { content: text.slice(0, 2000) } }] } };
}
function heading(text: string) {
  return { object: "block", type: "heading_3", heading_3: { rich_text: [{ text: { content: text.slice(0, 2000) } }] } };
}
function bullet(text: string) {
  return { object: "block", type: "bulleted_list_item", bulleted_list_item: { rich_text: [{ text: { content: text.slice(0, 2000) } }] } };
}
type Block = ReturnType<typeof heading> | ReturnType<typeof paragraph> | ReturnType<typeof bullet>;

/** 100개 넘는 블록을 페이지 생성 후 여러 번에 나눠 이어붙인다 (Notion API는 요청당 최대 100블록). */
async function appendRemainingBlocks(pageId: string, blocks: unknown[]) {
  for (let i = 0; i < blocks.length; i += 100) {
    await notionFetch(`/blocks/${pageId}/children`, {
      method: "PATCH",
      body: JSON.stringify({ children: blocks.slice(i, i + 100) }),
    });
  }
}

function reportToBlocks(report: string) {
  return report
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => {
      const trimmed = line.trim();
      if (trimmed.startsWith("#")) return heading(trimmed.replace(/^#+\s*/, ""));
      if (trimmed.startsWith("-") || trimmed.startsWith("*")) return bullet(trimmed.replace(/^[-*]\s*/, ""));
      return paragraph(trimmed);
    });
}

export async function pushDailyReport(
  result: OrchestratorResult,
  mina?: MinaResult,
  funnel?: FunnelResult,
  content?: ContentResult
): Promise<NotionPushResult> {
  if (!isConfigured()) {
    return { ok: false, error: "Notion 미설정 (.env에 NOTION_API_KEY/NOTION_DATABASE_ID 필요)" };
  }

  try {
    const databaseId = process.env.NOTION_DATABASE_ID!;
    const titleProp = await findTitleProperty(databaseId);
    const dateStr = new Date(result.generatedAt).toLocaleDateString("ko-KR");
    const periodLabel = result.periodLabel || "어제";
    const OWNER_KO: Record<string, string> = { auto: "AI 처리", semi: "AI 처리(확인 필요)", manual: "사장님 처리" };

    // "업무보고" 테이블(제목/오늘 업무/분석 리포트)에 표에서 바로 보이도록 요약을 채운다.
    // 전체 상세 내용은 아래 children 블록으로 페이지 본문에 그대로 남긴다.
    const truncate = (text: string, max = 1900) =>
      text.length > max ? text.slice(0, max) + "\n…(전체 내용은 페이지 본문 참고)" : text;
    const todayTasksSummary = truncate(
      [result.headline, "", ...result.tasks.map((t) => `[${t.priority}] ${t.title} — ${t.reason}`)].join("\n")
    );
    const analysisReportSummary = truncate(result.report);

    const children = [
      heading(`🧑‍💼 제이 - ${periodLabel} 브리핑 헤드라인`),
      paragraph(result.headline),
      heading("오늘 처리해야 할 업무 (AI 처리 / 사장님 처리 구분)"),
      ...result.tasks.map((t) =>
        bullet(`[${t.priority}] ${t.title} — ${t.reason} (담당: ${t.assigneeRole} · ${OWNER_KO[t.mode] ?? t.mode})`)
      ),
      heading(`${periodLabel} 분석`),
      ...reportToBlocks(result.report),
    ];

    if (mina && mina.messages.length > 0) {
      // 회원 이름·전화번호(개인정보)는 올리지 않는다. 건수만 요약해서 기록.
      const byCategory = mina.messages.reduce<Record<string, number>>((acc, m) => {
        acc[m.category] = (acc[m.category] ?? 0) + 1;
        return acc;
      }, {});
      children.push(heading(`🙋‍♀️ 미나 - 문자 대상 ${mina.messages.length}건`));
      children.push(
        ...Object.entries(byCategory).map(([cat, count]) => bullet(`${cat}: ${count}건 (상세는 앱에서 확인)`))
      );
    }
    if (funnel) {
      children.push(heading("📊 데이터 - 퍼널 진단"));
      children.push(...reportToBlocks(funnel.insight));
    }
    if (content && content.ideas.length > 0) {
      children.push(heading("🎨 루나 - 콘텐츠 초안"));
      children.push(...content.ideas.map((i) => bullet(`[${i.platform}] ${i.title}`)));
    }

    const page = await notionFetch("/pages", {
      method: "POST",
      body: JSON.stringify({
        parent: { database_id: databaseId },
        properties: {
          [titleProp]: { title: [{ text: { content: `자이언트짐 AI 브리핑 - ${dateStr} (${periodLabel})` } }] },
          "오늘 업무": { rich_text: [{ text: { content: todayTasksSummary } }] },
          "분석 리포트": { rich_text: [{ text: { content: analysisReportSummary } }] },
        },
        children: children.slice(0, 100), // Notion API 한 번 요청당 최대 100 블록
      }),
    });

    return { ok: true, url: page.url };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/** 급여 정산 AI의 결과를 보고한다. 오류가 있으면 정산 중단 보고, 없으면 완료 보고. */
export async function pushPayrollReport(result: PayrollResult, sheetUrl?: string): Promise<NotionPushResult> {
  if (!isConfigured()) {
    return { ok: false, error: "Notion 미설정 (.env에 NOTION_API_KEY/NOTION_DATABASE_ID 필요)" };
  }

  try {
    const databaseId = process.env.NOTION_DATABASE_ID!;
    const titleProp = await findTitleProperty(databaseId);
    const hasIssues = result.issues.length > 0;

    const children = hasIssues
      ? [
          heading(`🚨 ${result.yearMonth} 급여 정산 진행 중 — 오류 발견`),
          paragraph(`오류 ${result.issues.length}건이 발견되어 정산을 중단했습니다. 수정 후 다시 정산할 수 있습니다.`),
          ...result.issues.map((i) => bullet(`[${i.trainerName}] ${i.detail}`)),
          heading("자동 점검 불가 항목 (참고용, 별도 확인 필요)"),
          ...result.uncheckable.map((u) => bullet(u)),
        ]
      : [
          heading(`✅ ${result.yearMonth} 급여 정산 완료`),
          paragraph("단가 오류: 없음 / 중복 정산 의심: 없음"),
          heading("트레이너별 지급액"),
          ...result.trainers.map((t) =>
            bullet(
              `${t.trainerName} — 수업정산 ${t.afterTax.toLocaleString()}원 + 기본급(세후) ${t.basePayAfterTax.toLocaleString()}원 = 총 ${t.totalPay.toLocaleString()}원`
            )
          ),
          ...(sheetUrl ? [paragraph(`구글 시트: ${sheetUrl}`)] : []),
          heading("자동 점검 불가 항목 (참고용, 별도 확인 필요)"),
          ...result.uncheckable.map((u) => bullet(u)),
        ];

    const page = await notionFetch("/pages", {
      method: "POST",
      body: JSON.stringify({
        parent: { database_id: databaseId },
        properties: {
          [titleProp]: { title: [{ text: { content: `급여 정산 - ${result.yearMonth}` } }] },
        },
        children: children.slice(0, 100),
      }),
    });

    return { ok: true, url: page.url };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/** 채팅에서 팀원이 사장님 지시로 노션에 실제로 페이지를 만들 때 쓴다 (자유 형식 제목+본문). */
export async function createNotionPage(title: string, content: string): Promise<NotionPushResult> {
  if (!isConfigured()) {
    return { ok: false, error: "Notion 미설정 (.env에 NOTION_API_KEY/NOTION_DATABASE_ID 필요)" };
  }

  try {
    const databaseId = process.env.NOTION_DATABASE_ID!;
    const titleProp = await findTitleProperty(databaseId);

    const page = await notionFetch("/pages", {
      method: "POST",
      body: JSON.stringify({
        parent: { database_id: databaseId },
        properties: {
          [titleProp]: { title: [{ text: { content: title.slice(0, 200) } }] },
        },
        children: reportToBlocks(content).slice(0, 100),
      }),
    });

    return { ok: true, url: page.url };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/** 리포 AI의 월간 전략 리포트(지점별 + 통합)를 노션에 기록한다. */
export async function pushRepoReport(result: RepoResult): Promise<NotionPushResult> {
  if (!isConfigured()) {
    return { ok: false, error: "Notion 미설정 (.env에 NOTION_API_KEY/NOTION_DATABASE_ID 필요)" };
  }

  try {
    const databaseId = process.env.NOTION_DATABASE_ID!;
    const titleProp = await findTitleProperty(databaseId);

    const children: Block[] = [
      heading(`🗒️ 리포 - ${result.yearMonth} 월간 전략 리포트`),
      ...(result.dataNotes.length > 0
        ? [heading("데이터 참고사항"), ...result.dataNotes.map((n) => bullet(n))]
        : []),
    ];
    for (const b of result.branches) {
      children.push(
        heading(`[${b.branchName}] 월 운영 전략`),
        ...reportToBlocks(b.operationsReport),
        heading(`[${b.branchName}] 회원권 재등록 전략`),
        ...reportToBlocks(b.membershipRenewalReport),
        heading(`[${b.branchName}] PT 재등록 전략`),
        ...reportToBlocks(b.ptRenewalReport)
      );
    }

    const page = await notionFetch("/pages", {
      method: "POST",
      body: JSON.stringify({
        parent: { database_id: databaseId },
        properties: {
          [titleProp]: { title: [{ text: { content: `월간 전략 리포트 - ${result.yearMonth}` } }] },
        },
        children: children.slice(0, 100),
      }),
    });
    if (children.length > 100) await appendRemainingBlocks(page.id, children.slice(100));

    return { ok: true, url: page.url };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/** 사업 일지를 노션 "사업 일지" 데이터베이스에 하루 한 페이지로 기록한다.
 * 별도 데이터베이스(NOTION_JOURNAL_DATABASE_ID)를 쓴다 — 브리핑/급여/리포용 DB와는 분리. */
export async function pushJournalEntry(entry: JournalEntry): Promise<NotionPushResult> {
  const databaseId = process.env.NOTION_JOURNAL_DATABASE_ID;
  if (!databaseId) {
    return { ok: false, error: "노션 사업 일지 미설정 (.env에 NOTION_JOURNAL_DATABASE_ID 필요)" };
  }

  try {
    const richText = (text: string) => ({ rich_text: [{ text: { content: text.slice(0, 2000) } }] });
    const page = await notionFetch("/pages", {
      method: "POST",
      body: JSON.stringify({
        parent: { database_id: databaseId },
        properties: {
          "제목": { title: [{ text: { content: `${entry.dateLabel} 사업 일지` } }] },
          "날짜": { date: { start: entry.dateLabel } },
          "진행한 일": richText(entry.progress),
          "성과": richText(entry.achievements),
          "현황": richText(entry.status),
          "보완할 점": richText(entry.improvements),
          "내일 할 일": richText(entry.tomorrow),
        },
      }),
    });

    return { ok: true, url: page.url };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// 업무관리/업무 로그 — 브리핑 본문에 업무를 나열하는 것만으로는 "완료"로 치지 않는다.
// 실데이터 기반 상위 업무를 노션 "업무관리" DB에 개별 업무로 만들고, 실행 결과를 "업무 로그"에 남긴다.
// mode(auto/semi/manual)에 따라 담당구분·진행상태를 정한다 — 실행하지 않은 업무는 절대 "완료"로 기록하지 않는다
// (auto=이미 자동 실행됨=완료, semi/manual=AI가 초안/제안만 한 상태이고 실제 처리는 사람 몫=시작 전).
function taskModeToCategory(mode: TeamTask["mode"]): { assigneeCategory: string; status: string } {
  if (mode === "auto") return { assigneeCategory: "자동화 업무", status: "완료" };
  if (mode === "semi") return { assigneeCategory: "AI 업무", status: "시작 전" };
  return { assigneeCategory: "대표 업무", status: "시작 전" };
}

function priorityToKo(p: TeamTask["priority"]): string {
  return { high: "긴급", normal: "보통", low: "낮음" }[p];
}

// 회원 이름·전화번호(개인정보)는 올리지 않는다 — 건수만 요약해서 기록 (pushDailyReport와 동일한 원칙).
function buildTargetSummary(task: TeamTask, context: GymContext): string {
  if (task.assigneeRole === "회원관리") {
    const parts: string[] = [];
    if (context.members.expiringSoon.length > 0) parts.push(`만료예정 ${context.members.expiringSoon.length}명`);
    if (context.members.recentlyExpired.length > 0) parts.push(`이탈위험 ${context.members.recentlyExpired.length}명`);
    if (context.money.unpaidMembers.length > 0) parts.push(`미수금 ${context.money.unpaidMembers.length}명`);
    return parts.length > 0 ? `${parts.join(" / ")} (개인정보 보호를 위해 명단은 앱 내에서 확인)` : "대상자 없음";
  }
  if (task.assigneeRole === "퍼널분석") {
    return context.funnel.pending > 0 ? `미상담 리드 ${context.funnel.pending}건 (앱 내에서 확인)` : "대상자 없음";
  }
  return "특정 대상자 없음 (전사/운영 단위 업무)";
}

export interface TaskRecordResult {
  ok: boolean;
  createdUrls: string[];
  error?: string;
}

/** 브리핑에서 나온 업무 중 우선순위 상위 N개(기본 5개)를 "업무관리" DB에 개별 업무로 만든다. */
export async function createTaskRecords(
  tasks: TeamTask[],
  context: GymContext,
  reportUrl: string | null,
  maxCount = 5
): Promise<TaskRecordResult> {
  const databaseId = process.env.NOTION_TASKS_DATABASE_ID;
  if (!databaseId) return { ok: false, createdUrls: [], error: "미설정 (.env에 NOTION_TASKS_DATABASE_ID 필요)" };

  const weight: Record<TeamTask["priority"], number> = { high: 0, normal: 1, low: 2 };
  const top = [...tasks].sort((a, b) => weight[a.priority] - weight[b.priority]).slice(0, maxCount);
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });

  const createdUrls: string[] = [];
  try {
    for (const t of top) {
      const { assigneeCategory, status } = taskModeToCategory(t.mode);
      const page = await notionFetch("/pages", {
        method: "POST",
        body: JSON.stringify({
          parent: { database_id: databaseId },
          properties: {
            "업무명": { title: [{ text: { content: t.title.slice(0, 200) } }] },
            "지점": { select: { name: "전체" } },
            "담당구분": { select: { name: assigneeCategory } },
            "우선순위": { select: { name: priorityToKo(t.priority) } },
            "진행상태": { status: { name: status } },
            "생성일": { date: { start: today } },
            "마감일": { date: { start: today } },
            "근거데이터": { rich_text: [{ text: { content: t.reason.slice(0, 1900) } }] },
            "대상자목록": { rich_text: [{ text: { content: buildTargetSummary(t, context) } }] },
            ...(reportUrl ? { "관련보고서": { url: reportUrl } } : {}),
          },
        }),
      });
      createdUrls.push(page.url);
    }
    return { ok: true, createdUrls };
  } catch (err) {
    return { ok: false, createdUrls, error: err instanceof Error ? err.message : String(err) };
  }
}

function extractPageId(url: string): string {
  const raw = url.split("-").pop()?.split("?")[0] ?? "";
  const clean = raw.replace(/[^a-f0-9]/gi, "");
  if (clean.length !== 32) return raw;
  return `${clean.slice(0, 8)}-${clean.slice(8, 12)}-${clean.slice(12, 16)}-${clean.slice(16, 20)}-${clean.slice(20)}`;
}

export interface ExecutionLogInput {
  performedBy: string; // 수행자, 예: "제이(총괄 AI) - npm run brain"
  createdTaskUrls: string[]; // 업무관리에 실제로 생성된 업무 페이지 URL들
  outcome: "전체 성공" | "보고서만 생성" | "업무 생성 실패" | "로그 저장만";
  incompleteReason?: string;
}

/** 실행 결과(시각/수행자/생성한 업무/처리결과/미완료사유)를 "업무 로그" DB에 남긴다. */
export async function logTaskExecution(input: ExecutionLogInput): Promise<NotionPushResult> {
  const databaseId = process.env.NOTION_TASK_LOG_DATABASE_ID;
  if (!databaseId) return { ok: false, error: "미설정 (.env에 NOTION_TASK_LOG_DATABASE_ID 필요)" };

  try {
    const nowIso = new Date().toISOString();
    const nowKstLabel = new Date().toLocaleString("sv-SE", { timeZone: "Asia/Seoul" });
    const page = await notionFetch("/pages", {
      method: "POST",
      body: JSON.stringify({
        parent: { database_id: databaseId },
        properties: {
          "제목": { title: [{ text: { content: `실행 로그 - ${nowKstLabel}` } }] },
          "실행시각": { date: { start: nowIso } },
          "수행자": { rich_text: [{ text: { content: input.performedBy } }] },
          "처리결과": { select: { name: input.outcome } },
          ...(input.incompleteReason
            ? { "미완료사유": { rich_text: [{ text: { content: input.incompleteReason.slice(0, 1900) } }] } }
            : {}),
          ...(input.createdTaskUrls.length > 0
            ? { "생성한업무": { relation: input.createdTaskUrls.map((url) => ({ id: extractPageId(url) })) } }
            : {}),
        },
      }),
    });
    return { ok: true, url: page.url };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export function isNotionEnabled(): boolean {
  return isConfigured();
}
