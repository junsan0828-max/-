// 네이버 플레이스 순위 읽기 (읽기 전용 시제품, 저장 없음).
// 실행:
//   npm run place-rank
import "dotenv/config";
import { readPlaceRanks, readFullPlaceRanks, TARGET_PLACE_ID } from "./main/placeRank";

async function main() {
  console.log("=== 네이버 플레이스 순위 읽기 ===\n");
  const args = process.argv.slice(2);
  const full = args.includes("--full"); // '더보기' 전체 목록 읽기
  const argKeywords = args.filter((a) => a !== "--full");
  const results = full
    ? await readFullPlaceRanks(argKeywords)
    : await readPlaceRanks(argKeywords.length ? argKeywords : undefined);
  for (const r of results) {
    console.log(`■ ${r.keyword}`);
    if (r.blocked) {
      console.log(`  ⚠️  ${r.blocked}\n`);
      continue;
    }
    for (const it of r.items) {
      const mark = it.placeId === TARGET_PLACE_ID ? "👉" : "  ";
      console.log(`${mark} ${it.isAd ? "광고" : String(it.rank).padStart(2) + "위"}  ${it.name}`);
    }
    console.log(`  → 자이언트짐 광고 제외 순위: ${r.targetRank ?? "목록 첫 화면에 없음"}\n`);
  }
}

main().catch((err) => {
  console.error("❌", err instanceof Error ? err.message : err);
  process.exit(1);
});
