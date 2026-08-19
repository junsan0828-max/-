// 주간 운영 보고 단독 실행 (2026-08-24 대표 지시로 신설). 매주 월요일 아침 9시 자동 발송용.
// 실행:
//   npm run weekly-report                 (오늘 기준 직전 월~토 집계)
//   npm run weekly-report -- 2026-08-24   (기준일 지정 — 그 기준일 직전 월~토 집계)
import "dotenv/config";
import { runWeeklyBrief, saveWeeklyBrief, buildWeeklyKakaoText } from "./main/weeklyBrief";
import { pushKakaoText } from "./main/kakao";

async function main() {
  const [referenceDateArg] = process.argv.slice(2);
  const result = referenceDateArg ? await runWeeklyBrief(referenceDateArg) : await runWeeklyBrief();

  console.log(`\n=== 주간 운영 보고 (${result.weekStart}~${result.weekEnd}) ===\n`);
  console.log(buildWeeklyKakaoText(result));

  if (result.dataNotes.length > 0) {
    console.log("\n데이터 참고사항:");
    for (const n of result.dataNotes) console.log(`- ${n}`);
  }

  const path = saveWeeklyBrief(result);
  console.log(`\n📄 저장됨: ${path}`);

  const kakao = await pushKakaoText(buildWeeklyKakaoText(result));
  console.log(kakao.ok ? "✅ 카카오톡 발송 완료" : `⏭️  카카오톡 발송 안 함: ${kakao.error}`);
}

main().catch((err) => {
  console.error("❌ 실패:", err instanceof Error ? err.message : err);
  process.exit(1);
});
