// 짐플러스 포인트 적립 신청 자동 승인 단독 테스트.
// 실행:
//   npm run point-claims   (대기 중인 신청을 확인해 최근 댓글 있으면 자동 승인)
import "dotenv/config";
import { processPendingPointClaims } from "./main/pointClaims";

async function main() {
  console.log("=== 포인트 적립 신청 자동 승인 확인 ===\n");
  const results = await processPendingPointClaims();

  if (results.length === 0) {
    console.log("대기 중인 신청이 없습니다.");
    return;
  }
  for (const r of results) {
    console.log(`${r.approved ? "✅" : "⏭️ "} claim #${r.claimId}: ${r.reason}`);
  }
}

main().catch((err) => {
  console.error("❌", err instanceof Error ? err.message : err);
  process.exit(1);
});
