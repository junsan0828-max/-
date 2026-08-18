// 리포 AI(월간 총 데이터 보고) 단독 실행.
// 실행:
//   npm run repo              (전월 기준)
//   npm run repo -- 2026-06   (특정 월 지정)
import "dotenv/config";
import { runMonthlyOverview, saveMonthlyOverview, buildMonthlyKakaoText } from "./main/repo";
import { pushMonthlyReport } from "./main/notion";
import { pushKakaoText } from "./main/kakao";

async function main() {
  const [yearMonthArg] = process.argv.slice(2);
  const result = yearMonthArg ? await runMonthlyOverview(yearMonthArg) : await runMonthlyOverview();

  console.log(`\n=== ${result.yearMonth} 월간 보고 ===\n`);
  console.log(buildMonthlyKakaoText(result));

  if (result.dataNotes.length > 0) {
    console.log("\n데이터 참고사항:");
    for (const n of result.dataNotes) console.log(`- ${n}`);
  }

  const path = saveMonthlyOverview(result);
  console.log(`\n📄 저장됨: ${path}`);

  const notion = await pushMonthlyReport(result);
  console.log(notion.ok ? `✅ 노션에 저장됨: ${notion.url}` : `⏭️  건너뜀: ${notion.error}`);

  const kakao = await pushKakaoText(buildMonthlyKakaoText(result));
  console.log(kakao.ok ? "✅ 카카오톡 발송 완료" : `⏭️  카카오톡 발송 안 함: ${kakao.error}`);
}

main().catch((err) => {
  console.error("❌ 실패:", err instanceof Error ? err.message : err);
  process.exit(1);
});
