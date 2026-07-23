// 유튜브 채널의 최근 숏츠 목록을 읽어서 노션 "유튜브 숏츠 목록"에 적는다 (1단계 — 트레이닝 일지 연동은 다음 단계).
// 실행: npm run youtube-shorts
import "dotenv/config";
import { listRecentShorts } from "./main/youtube/shorts";
import { pushYoutubeShorts } from "./main/notion";

async function main() {
  console.log("=== 유튜브 숏츠 목록 조회 ===\n");
  const shorts = await listRecentShorts(20);
  console.log(`숏츠 ${shorts.length}건 발견:`);
  for (const s of shorts) {
    console.log(`- [${s.durationSeconds}초] ${s.title} — ${s.url}`);
  }

  console.log("\n=== 노션에 기록 ===");
  const result = await pushYoutubeShorts(shorts);
  if (!result.ok) {
    console.log(`❌ 실패: ${result.error}`);
    process.exit(1);
  }
  console.log(`✅ 신규 ${result.addedCount}건 추가, 기존 ${result.skippedExisting}건 건너뜀`);
}

main().catch((err) => {
  console.error("❌", err instanceof Error ? err.message : err);
  process.exit(1);
});
