// Notion 연동 — 제이의 일일 브리핑을 Notion 데이터베이스에 자동 기록.
// 집 PC 화면 앞에 있지 않아도 휴대폰 Notion 앱으로 언제든 확인 가능하게 한다.
// 공식 Notion API 사용 (내부 통합 토큰 방식, OAuth 아님 - 개인/팀 용도로 충분).
import { OrchestratorResult } from "./orchestrator";
import { MinaResult } from "./mina";
import { FunnelResult } from "./dataAgent";
import { ContentResult } from "./luna";

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

    const children = [
      heading("🧑‍💼 제이 - 오늘의 헤드라인"),
      paragraph(result.headline),
      heading("도출된 업무"),
      ...result.tasks.map((t) => bullet(`[${t.priority}] ${t.title} — ${t.reason} (담당: ${t.assigneeRole})`)),
      heading("주간 브리핑"),
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
          [titleProp]: { title: [{ text: { content: `자이언트짐 AI 브리핑 - ${dateStr}` } }] },
        },
        children: children.slice(0, 100), // Notion API 한 번 요청당 최대 100 블록
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
