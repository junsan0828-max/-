// 매일 아침, 트레이너 유튜브 계정들에서 새로 올라온 숏츠를 훑어서
//  1) 노션 "유튜브 숏츠 목록"에 기록하고 (트레이너 구분 포함)
//  2) 제목("날짜 회원이름 운동이름")에서 회원/운동을 뽑아 짐플러스 트레이닝 일지에 반영한다.
// 클라우드 루틴(매일 09:00 KST)으로 PC 없이 실행된다.
import "dotenv/config";
import { listAllAccountsRecentShorts } from "./main/youtube/shorts";
import { pushYoutubeShorts, getKnownYoutubeShortUrls, markTrainingLogSynced } from "./main/notion";
import { attachVideoToGymPlusLog, parseShortTitle } from "./main/gymPlusTrainingLog";

async function main() {
  console.log("=== 유튜브 숏츠 → 트레이닝 일지 동기화 ===\n");

  const knownUrls = await getKnownYoutubeShortUrls();
  const shorts = await listAllAccountsRecentShorts(20, knownUrls);
  console.log(`신규 숏츠 ${shorts.length}건 발견`);
  for (const s of shorts) console.log(`- [${s.accountId}] ${s.title} — ${s.url}`);

  console.log("\n=== 노션에 기록 ===");
  const pushResult = await pushYoutubeShorts(shorts);
  if (!pushResult.ok) {
    console.log(`❌ 노션 기록 실패: ${pushResult.error}`);
    process.exit(1);
  }
  console.log(`✅ 신규 ${pushResult.addedCount}건 기록, 기존 ${pushResult.skippedExisting}건 건너뜀`);

  console.log("\n=== 트레이닝 일지 반영 ===");
  let synced = 0;
  let failed = 0;
  for (const s of shorts) {
    const parsed = parseShortTitle(s.title);
    if (!parsed) {
      console.log(`⚠️ 제목 파싱 실패: "${s.title}" — 건너뜀`);
      failed++;
      continue;
    }
    const logDate = s.publishedAt ? s.publishedAt.slice(0, 10) : new Date().toISOString().slice(0, 10);
    const result = await attachVideoToGymPlusLog({
      memberName: parsed.memberName,
      exerciseName: parsed.exerciseName,
      videoUrl: s.url,
      logDate,
    });
    if (result.ok) {
      console.log(`✅ ${parsed.memberName} (${parsed.exerciseName}) — ${s.url}`);
      await markTrainingLogSynced(s.url, true);
      synced++;
    } else {
      console.log(`❌ ${parsed.memberName}: ${result.error}`);
      failed++;
    }
  }

  console.log(`\n=== 완료: 일지 반영 ${synced}건, 실패/보류 ${failed}건 (노션 신규 ${pushResult.addedCount}건) ===`);
}

main().catch((err) => {
  console.error("❌", err instanceof Error ? err.message : err);
  process.exit(1);
});
