// 짐플러스(자이언트짐+) 포인트 적립 신청(gym_plus_point_claims)을 자동 승인한다.
// 대표 요청에 따라 신원 확인은 하지 않는다 — 신청 시점 기준 최근 몇 분 내에 해당 이벤트
// 블로그 글에 댓글이 하나라도 있으면 그냥 승인한다 (간단하게, 도용 가능성은 감수).
// 승인되면 자이언트짐+ 앱이 직접 쓰는 DB(gym_plus_members.points, gym_plus_point_logs)에
// 그대로 반영한다 — 별도 API가 없고 이 DB 자체가 자이언트짐+의 실제 데이터다.
//
// 댓글 존재 확인은 네이버 비공식 JSON API(추가 내부 파라미터 필요, 확보 못 함) 대신
// Playwright로 실제 글 페이지를 열어 네이버 공용 댓글위젯(cbox)의 상대시간 텍스트
// (".u_cbox_date": "방금", "n분 전" 등)를 읽는 방식을 쓴다. 실제 댓글이 달린 사례로
// 아직 검증 못 했으니, 배포 후 테스트 댓글 1건으로 형식이 맞는지 확인 필요 — 2026-07-30.
import { neon } from "@neondatabase/serverless";
import { chromium } from "playwright";

const WITHIN_MINUTES = 3;

interface PendingClaim {
  id: number;
  gymPlusMemberId: number;
  eventId: number;
  eventTitle: string;
  pointAmount: number;
}

export interface ClaimResult {
  claimId: number;
  approved: boolean;
  reason: string;
}

function parseRelativeMinutes(text: string): number | null {
  const t = text.trim();
  if (/^방금/.test(t)) return 0;
  const m = t.match(/(\d+)\s*분\s*전/);
  if (m) return parseInt(m[1], 10);
  const h = t.match(/(\d+)\s*시간\s*전/);
  if (h) return parseInt(h[1], 10) * 60;
  const d = t.match(/(\d+)\s*일\s*전/);
  if (d) return parseInt(d[1], 10) * 60 * 24;
  return null; // 절대 날짜 표기(오래된 댓글)는 "최근"으로 취급하지 않음
}

/** 블로그 글에 최근 N분 이내 댓글이 하나라도 있는지 확인한다 (작성자 신원은 확인하지 않음). */
async function hasRecentComment(postUrl: string, withinMinutes: number): Promise<boolean> {
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ ignoreHTTPSErrors: true });
    const page = await context.newPage();
    await page.goto(postUrl, { waitUntil: "networkidle", timeout: 20000 });
    await page.waitForTimeout(1000);

    const texts: string[] = await page.evaluate(() =>
      Array.from(document.querySelectorAll(".u_cbox_date")).map((el) => el.textContent || "")
    );
    return texts.some((t) => {
      const mins = parseRelativeMinutes(t);
      return mins !== null && mins <= withinMinutes;
    });
  } finally {
    await browser.close();
  }
}

/** 대기 중인 포인트 적립 신청을 확인해서, 최근 댓글이 있으면 자동 승인(포인트 지급)한다. */
export async function processPendingPointClaims(): Promise<ClaimResult[]> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL이 설정되어 있지 않습니다.");
  const sql = neon(url);

  const claims = (await sql.query(
    `SELECT id, "gymPlusMemberId", "eventId", "eventTitle", "pointAmount"
     FROM gym_plus_point_claims WHERE status = 'pending'`
  )) as PendingClaim[];

  const results: ClaimResult[] = [];
  for (const claim of claims) {
    const eventRows = (await sql.query(`SELECT "linkUrl" FROM gym_plus_events WHERE id = $1`, [
      claim.eventId,
    ])) as { linkUrl: string | null }[];
    const postUrl = eventRows[0]?.linkUrl;
    if (!postUrl) {
      results.push({ claimId: claim.id, approved: false, reason: "이벤트에 연결된 블로그 링크 없음" });
      continue;
    }

    const recent = await hasRecentComment(postUrl, WITHIN_MINUTES);
    if (!recent) {
      results.push({ claimId: claim.id, approved: false, reason: `최근 ${WITHIN_MINUTES}분 내 댓글 없음` });
      continue;
    }

    const memberRows = (await sql.query(`SELECT points FROM gym_plus_members WHERE id = $1`, [
      claim.gymPlusMemberId,
    ])) as { points: number | null }[];
    const balanceAfter = (memberRows[0]?.points ?? 0) + claim.pointAmount;

    await sql.query(`UPDATE gym_plus_members SET points = $1, "updatedAt" = (now())::text WHERE id = $2`, [
      balanceAfter,
      claim.gymPlusMemberId,
    ]);
    await sql.query(
      `INSERT INTO gym_plus_point_logs ("gymPlusMemberId", type, amount, "balanceAfter", reason, "relatedId")
       VALUES ($1, 'earn', $2, $3, $4, $5)`,
      [claim.gymPlusMemberId, claim.pointAmount, balanceAfter, claim.eventTitle, claim.id]
    );
    await sql.query(`UPDATE gym_plus_point_claims SET status = 'approved' WHERE id = $1`, [claim.id]);

    results.push({ claimId: claim.id, approved: true, reason: "최근 댓글 확인 → 자동 승인" });
  }

  return results;
}
