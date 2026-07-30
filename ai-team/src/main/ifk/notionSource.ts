// 피트니스경영신문(ifk.co.kr/nad) 기사 원고 소스 — Notion "피트니스경영신문" DB에서 기사를 가져온다.
// 매일 자동 실행은 오늘(작성일=오늘) 작성된, 아직 게시 안 한(게시완료=false) 기사를 찾고,
// 수동 재실행은 번호로 특정 기사를 지정해서 가져온다(게시완료 여부와 무관하게 강제로 다시 올릴 때 씀).
// 페이지 구성은 [대표이미지] → (기사 정보 — 핵심 키워드 등, 선택) → 부제목 → 본문(기사) → (참고자료, 선택) 순서.
const NOTION_VERSION = "2022-06-28";

export interface IfkArticle {
  pageId: string;
  number: number | null;
  title: string;
  subtitle: string;
  bodyHtml: string;
  keywords: string[];
  image: { buffer: Buffer; filename: string } | null;
}

function isConfigured() {
  return !!(process.env.NOTION_API_KEY && process.env.NOTION_IFK_DATABASE_ID);
}

async function notionFetch(path: string, init?: RequestInit) {
  const res = await fetch(`https://api.notion.com/v1${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${process.env.NOTION_API_KEY}`,
      "Notion-Version": NOTION_VERSION,
      "content-type": "application/json",
      ...(init?.headers || {}),
    },
  });
  const data: any = await res.json();
  if (!res.ok) throw new Error(data?.message || `Notion API 오류 (${res.status})`);
  return data;
}

function todayStr(): string {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
}

async function fetchAllBlocks(pageId: string): Promise<any[]> {
  const blocks: any[] = [];
  let cursor: string | undefined;
  do {
    const qs = cursor ? `?page_size=100&start_cursor=${cursor}` : "?page_size=100";
    const data = await notionFetch(`/blocks/${pageId}/children${qs}`, { method: "GET" });
    blocks.push(...data.results);
    cursor = data.has_more ? data.next_cursor : undefined;
  } while (cursor);
  return blocks;
}

function richTextToHtml(richText: any[]): string {
  return richText
    .map((t) => {
      let text = t.plain_text as string;
      // HTML 특수문자 이스케이프 (링크 삽입 전에 먼저 처리)
      text = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      if (t.annotations?.bold) text = `<b>${text}</b>`;
      if (t.annotations?.italic) text = `<i>${text}</i>`;
      const href = t.href || t.text?.link?.url;
      if (href) text = `<a href="${href}" target="_blank">${text}</a>`;
      return text;
    })
    .join("");
}

function richTextToPlain(richText: any[]): string {
  return richText.map((t: any) => t.plain_text).join("");
}

function headingText(block: any): string | null {
  const type = block.type;
  if (type !== "heading_1" && type !== "heading_2" && type !== "heading_3") return null;
  return richTextToPlain(block[type]?.rich_text ?? []);
}

// paragraph/bulleted_list_item/numbered_list_item 등 텍스트를 담는 블록에서 rich_text를 꺼낸다.
function blockRichText(block: any): any[] | null {
  const type = block.type;
  if (type === "paragraph") return block.paragraph?.rich_text ?? [];
  if (type === "bulleted_list_item") return block.bulleted_list_item?.rich_text ?? [];
  if (type === "numbered_list_item") return block.numbered_list_item?.rich_text ?? [];
  return null;
}

function firstImageUrl(block: any): string | null {
  if (block.type !== "image") return null;
  return block.image.type === "external" ? block.image.external.url : block.image.file.url;
}

async function downloadImage(url: string): Promise<{ buffer: Buffer; filename: string }> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`대표이미지 다운로드 실패 (${res.status})`);
  const buffer = Buffer.from(await res.arrayBuffer());
  const pathname = new URL(url).pathname;
  const rawName = decodeURIComponent(pathname.slice(pathname.lastIndexOf("/") + 1)) || "image.jpg";
  return { buffer, filename: rawName };
}

function guessMime(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase();
  if (ext === "png") return "image/png";
  if (ext === "gif") return "image/gif";
  if (ext === "webp") return "image/webp";
  return "image/jpeg";
}

function parseKeywordsLine(line: string): string[] {
  // "핵심 키워드: 비만치료제 · 헬스장 · 근력관리" 형태에서 콜론 뒤를 "·"/","/"、" 기준으로 분리
  const afterColon = line.split(/[:：]/).slice(1).join(":");
  return afterColon
    .split(/[·,、]/)
    .map((k) => k.trim())
    .filter(Boolean);
}

async function buildArticleFromPage(page: any): Promise<IfkArticle> {
  const titleProp = page.properties?.["제목"]?.title ?? [];
  const title = richTextToPlain(titleProp);
  const number = page.properties?.["번호"]?.number ?? null;

  const blocks = await fetchAllBlocks(page.id);

  let imageUrl: string | null = null;
  const subtitleLines: string[] = [];
  const bodyParagraphs: string[] = [];
  let keywords: string[] = [];
  // "references" 섹션(참고자료)은 감지만 하고 본문에는 포함하지 않는다 (사용자 결정).
  let section: "before" | "info" | "subtitle" | "body" | "references" = "before";

  for (const block of blocks) {
    if (imageUrl === null) {
      const img = firstImageUrl(block);
      if (img) {
        imageUrl = img;
        continue;
      }
    }
    const heading = headingText(block);
    if (heading) {
      if (heading.includes("부제목")) section = "subtitle";
      else if (heading.includes("참고")) section = "references";
      else if (heading.includes("본문")) section = "body";
      else if (heading.includes("기사 정보") || heading.includes("기사정보")) section = "info";
      else section = "before";
      continue;
    }

    const richText = blockRichText(block);
    if (!richText || richText.length === 0) continue;

    if (section === "info") {
      const line = richTextToPlain(richText);
      if (line.includes("키워드")) keywords = parseKeywordsLine(line);
    } else if (section === "subtitle") {
      subtitleLines.push(richTextToPlain(richText));
    } else if (section === "body") {
      bodyParagraphs.push(`<p style="margin:0 0 1em 0;">${richTextToHtml(richText)}</p>`);
    }
  }

  const image = imageUrl ? await downloadImage(imageUrl) : null;

  // 본문 맨 앞에도 대표이미지를 삽입하고, 그 아래에 "이미지=AI" 출처를 표기한다.
  if (image) {
    const dataUri = `data:${guessMime(image.filename)};base64,${image.buffer.toString("base64")}`;
    bodyParagraphs.unshift(
      `<p style="margin:0 0 0.3em 0;"><img src="${dataUri}" style="max-width:100%;max-height:420px;"></p>`,
      `<p style="color:#888;font-size:13px;margin:0 0 1em 0;">이미지=AI</p>`
    );
  }

  return {
    pageId: page.id,
    number,
    title,
    subtitle: subtitleLines.join(" ").trim(),
    bodyHtml: bodyParagraphs.join("\n"),
    keywords,
    image,
  };
}

/** 작성일이 오늘 이하(오늘 포함 과거)이면서 아직 게시완료가 안 된 기사 중 가장 오래된 1건을 찾는다.
 * (예전엔 "작성일=오늘" 정확히 일치만 찾아서, 기사가 마감 시각까지 안 써져 있으면 그날 몫을 영영
 * 놓치는 문제가 있었다 — 2026-07-30. 이제 매시 정각 재시도하면서 밀린 기사를 오래된 순으로 하나씩
 * 자동으로 소진한다. 없으면 null.) */
export async function getNextPendingArticle(): Promise<IfkArticle | null> {
  if (!isConfigured()) {
    throw new Error("피트니스경영신문 노션 연동 미설정 (.env에 NOTION_API_KEY/NOTION_IFK_DATABASE_ID 필요)");
  }
  const databaseId = process.env.NOTION_IFK_DATABASE_ID!;
  const query = await notionFetch(`/databases/${databaseId}/query`, {
    method: "POST",
    body: JSON.stringify({
      filter: {
        and: [
          { property: "작성일", date: { on_or_before: todayStr() } },
          { property: "게시완료", checkbox: { equals: false } },
        ],
      },
      sorts: [{ property: "작성일", direction: "ascending" }],
      page_size: 1,
    }),
  });

  const page = query.results?.[0];
  return page ? buildArticleFromPage(page) : null;
}

/** 번호로 특정 기사를 지정해서 가져온다 (게시완료 여부 무시 — 수정 후 강제 재업로드용). */
export async function getArticleByNumber(number: number): Promise<IfkArticle | null> {
  if (!isConfigured()) {
    throw new Error("피트니스경영신문 노션 연동 미설정 (.env에 NOTION_API_KEY/NOTION_IFK_DATABASE_ID 필요)");
  }
  const databaseId = process.env.NOTION_IFK_DATABASE_ID!;
  const query = await notionFetch(`/databases/${databaseId}/query`, {
    method: "POST",
    body: JSON.stringify({
      filter: { property: "번호", number: { equals: number } },
      page_size: 1,
    }),
  });

  const page = query.results?.[0];
  return page ? buildArticleFromPage(page) : null;
}

/** IFK에 올린 뒤, 다시 올라가지 않도록 노션에서 게시완료 체크한다. */
export async function markPosted(pageId: string): Promise<void> {
  await notionFetch(`/pages/${pageId}`, {
    method: "PATCH",
    body: JSON.stringify({ properties: { "게시완료": { checkbox: true } } }),
  });
}
