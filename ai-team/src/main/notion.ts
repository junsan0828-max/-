// Notion 연동 — 제이의 일일 브리핑을 Notion 데이터베이스에 자동 기록.
// 집 PC 화면 앞에 있지 않아도 휴대폰 Notion 앱으로 언제든 확인 가능하게 한다.
// 공식 Notion API 사용 (내부 통합 토큰 방식, OAuth 아님 - 개인/팀 용도로 충분).
import { OrchestratorResult } from "./orchestrator";
import { MinaResult } from "./mina";
import { FunnelResult } from "./dataAgent";
import { ContentResult } from "./luna";
import { PayrollResult } from "./payroll";
import { RepoResult } from "./repo";

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

export function isNotionEnabled(): boolean {
  return isConfigured();
}
