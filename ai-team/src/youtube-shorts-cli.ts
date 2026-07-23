// 인증해둔 모든 유튜브 계정(트레이너별, 최대 5개)의 최근 숏츠 목록을 읽어서
// 노션 "유튜브 숏츠 목록"에 적는다 (1단계 — 트레이닝 일지 연동은 다음 단계).
// 실행:
//   npm run youtube-shorts              (인증된 모든 계정 조회)
//   npm run youtube-shorts -- 계정이름   (그 계정만 조회 — 처음 쓰는 이름이면 브라우저 인증 1회 뜸, 새 계정 추가용)
import "dotenv/config";
import { listRecentShorts, listAllAccountsRecentShorts } from "./main/youtube/shorts";
import { pushYoutubeShorts } from "./main/notion";

async function main() {
  const [accountId] = process.argv.slice(2);
  console.log("=== 유튜브 숏츠 목록 조회 ===\n");
  const shorts = accountId ? await listRecentShorts(accountId, 20) : await listAllAccountsRecentShorts(20);
  console.log(`숏츠 ${shorts.length}건 발견:`);
  for (const s of shorts) {
    console.log(`- [${s.accountId} · ${s.durationSeconds}초] ${s.title} — ${s.url}`);
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
