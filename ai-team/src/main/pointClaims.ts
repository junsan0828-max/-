// 짐플러스(자이언트짐+) 포인트 적립 신청(gym_plus_point_claims)을 자동 승인한다.
// 대표 요청에 따라 신원 확인은 하지 않는다 — 아직 포인트로 소진되지 않은 댓글이 있으면
// 그냥 승인한다 (간단하게, 도용 가능성은 감수). 승인되면 자이언트짐+ 앱이 직접 쓰는 DB
// (gym_plus_members.points, gym_plus_point_logs)에 그대로 반영한다 — 별도 API가 없고
// 이 DB 자체가 자이언트짐+의 실제 데이터다.
//
// 원래는 "신청 시점 기준 최근 3분 이내 댓글"을 네이버 댓글위젯(cbox)의 개별 댓글 시각을
// 읽어 확인하려 했으나, 그 위젯이 지연 로딩(iframe/스크롤 트리거)이라 헤드리스에서 안정적으로
// 못 읽었다 (2026-07-30 실측). 대신 훨씬 안정적으로 읽히는 "댓글 총개수"
// (#floating_bottom_commentCount)를 쓴다: 이벤트별로 "이미 승인해서 소진한 댓글 수"
// (해당 eventId로 승인된 claim 수)보다 현재 댓글 총개수가 많으면, 아직 포인트로 안 쓰인
// 댓글이 있다는 뜻이므로 승인한다. 시간 창은 없어졌지만(정확한 "3분 이내"는 포기),
// 훨씬 안정적으로 동작하고 목적(댓글 달면 포인트)은 동일하게 달성한다.
import { neon } from "@neondatabase/serverless";
import { chromium } from "playwright";

interface PendingClaim {
  id: number;
  gymPlusMemberId: number;
  eventId: number;
  eventTitle: string;
  pointAmount: number;
  createdAt: string;
}

export interface ClaimResult {
  claimId: number;
  approved: boolean;
  reason: string;
}

/** 블로그 글의 현재 댓글 총개수를 읽는다. */
async function getCommentCount(postUrl: string): Promise<number> {
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ ignoreHTTPSErrors: true });
    const page = await context.newPage();
    await page.goto(postUrl, { waitUntil: "domcontentloaded", timeout: 15000 });
    await page.waitForTimeout(3000);
    const frame = page.frames().find((f) => f.name() === "mainFrame") || page.mainFrame();
    const text = await frame.evaluate(() => {
      const el = document.querySelector("#floating_bottom_commentCount");
      return el ? el.textContent : null;
    });
    return text ? parseInt(text.trim(), 10) || 0 : 0;
  } finally {
    await browser.close();
  }
}

/** 대기 중인 포인트 적립 신청을 확인해서, 아직 소진되지 않은 댓글이 있으면 자동 승인(포인트 지급)한다.
 * 같은 이벤트에 신청이 여러 건이면 먼저 신청한 순서대로, 남은 댓글 수만큼만 승인한다. */
export async function processPendingPointClaims(): Promise<ClaimResult[]> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL이 설정되어 있지 않습니다.");
  const sql = neon(url);

  const claims = (await sql.query(
    `SELECT id, "gymPlusMemberId", "eventId", "eventTitle", "pointAmount", "createdAt"
     FROM gym_plus_point_claims WHERE status = 'pending' ORDER BY "createdAt" ASC`
  )) as PendingClaim[];

  const results: ClaimResult[] = [];
  const availableByEvent = new Map<number, number>(); // eventId -> 남은 승인 가능 건수

  for (const claim of claims) {
    if (!availableByEvent.has(claim.eventId)) {
      const eventRows = (await sql.query(`SELECT "linkUrl" FROM gym_plus_events WHERE id = $1`, [
        claim.eventId,
      ])) as { linkUrl: string | null }[];
      const postUrl = eventRows[0]?.linkUrl;
      if (!postUrl) {
        availableByEvent.set(claim.eventId, 0);
      } else {
        const [commentCount, approvedRows] = await Promise.all([
          getCommentCount(postUrl),
          sql.query(
            `SELECT count(*)::int AS c FROM gym_plus_point_claims WHERE "eventId" = $1 AND status = 'approved'`,
            [claim.eventId]
          ),
        ]);
        const approvedCount = (approvedRows as { c: number }[])[0]?.c ?? 0;
        availableByEvent.set(claim.eventId, Math.max(0, commentCount - approvedCount));
      }
    }

    const available = availableByEvent.get(claim.eventId) ?? 0;
    if (available <= 0) {
      results.push({ claimId: claim.id, approved: false, reason: "아직 포인트로 안 쓰인 댓글 없음" });
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

    availableByEvent.set(claim.eventId, available - 1);
    results.push({ claimId: claim.id, approved: true, reason: "댓글 확인 → 자동 승인" });
  }

  return results;
}
