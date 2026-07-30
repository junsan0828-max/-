// 네이버 블로그(자이언트짐, blog.naver.com/ziantgym1)에 새 글이 올라오면 자이언트짐+ 앱에
// "블로그 인증 이벤트"로 자동 게시한다. 실제 포인트는 이 잡이 지급하지 않는다 — 회원이 앱에서
// 인증 신청하면 직원이 프론트에서 수동 승인하는 기존 흐름(gym_plus_point_claims → 승인 시
// gym_plus_point_logs 반영)을 그대로 두고, 이 잡은 "이벤트 게시" 한 단계만 자동화한다.
// 클라우드에서도 동작해야 해서 pg Pool이 아니라 neon() HTTP 방식을 쓴다.
import { neon } from "@neondatabase/serverless";

const RSS_URL = "https://rss.blog.naver.com/ziantgym1.xml";
const LAST_SEEN_KEY = "blog_point_event_last_url";
const POINT_AMOUNT = 50; // 블로그 글에 댓글 남기면 50포인트 (기존 짐 포인트 규정)
const EVENT_WINDOW_DAYS = 7;

export interface BlogPost {
  title: string;
  link: string;
}

export interface BlogEventJobResult {
  ok: boolean;
  skipped?: boolean;
  post?: BlogPost;
  error?: string;
}

function extractTag(block: string, tag: string): string | null {
  const m = block.match(new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?</${tag}>`));
  return m ? m[1].trim() : null;
}

/** RSS 피드 맨 위(가장 최근) 글 1건을 가져온다. */
async function fetchLatestPost(): Promise<BlogPost | null> {
  const res = await fetch(RSS_URL, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!res.ok) throw new Error(`블로그 RSS 조회 실패 (${res.status})`);
  const xml = await res.text();
  const itemMatch = xml.match(/<item>([\s\S]*?)<\/item>/);
  if (!itemMatch) return null;
  const block = itemMatch[1];
  const title = extractTag(block, "title");
  const rawLink = extractTag(block, "link");
  if (!title || !rawLink) return null;
  const link = rawLink.split("?")[0]; // ?fromRss=true&trackingCode=rss 제거, 순수 글 링크만 저장
  return { title, link };
}

function todayStr(): string {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00+09:00`);
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
}

/** 새 블로그 글이 있으면 자이언트짐+ 이벤트(포인트 500p 안내, 지급은 직원 수동 승인)로 등록한다.
 * 마지막으로 등록해둔 글과 같은 링크면(새 글 없으면) 건너뛴다. */
export async function runBlogEventJob(): Promise<BlogEventJobResult> {
  const url = process.env.DATABASE_URL;
  if (!url) return { ok: false, error: "DATABASE_URL이 설정되어 있지 않습니다." };
  const sql = neon(url);

  const post = await fetchLatestPost();
  if (!post) return { ok: false, error: "블로그 RSS에서 글을 찾지 못했습니다." };

  const lastRows = (await sql.query(`SELECT value FROM gym_plus_settings WHERE key = $1`, [
    LAST_SEEN_KEY,
  ])) as { value: string }[];
  if (lastRows[0]?.value === post.link) {
    return { ok: false, skipped: true, post, error: "새 글이 없습니다 (마지막 등록 글과 동일)." };
  }

  const start = todayStr();
  const end = addDays(start, EVENT_WINDOW_DAYS);
  const content = `자이언트짐 블로그 글에 댓글을 남기면 ${POINT_AMOUNT}포인트를 드립니다!\n\n"${post.title}"\n${post.link}`;

  await sql.query(
    `INSERT INTO gym_plus_events (title, content, "eventType", "startDate", "endDate", "isPublished", "linkUrl", "pointAmount")
     VALUES ($1, $2, 'points', $3, $4, 1, $5, $6)`,
    [`블로그 댓글 이벤트: ${post.title}`, content, start, end, post.link, POINT_AMOUNT]
  );

  await sql.query(
    `INSERT INTO gym_plus_settings (key, value, "updatedAt") VALUES ($1, $2, (now())::text)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, "updatedAt" = (now())::text`,
    [LAST_SEEN_KEY, post.link]
  );

  return { ok: true, post };
}
