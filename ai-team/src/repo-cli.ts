// 리포 AI(월간 지점별 + 통합 전략 리포트) 단독 실행.
// 실행:
//   npm run repo              (전월 기준)
//   npm run repo -- 2026-06   (특정 월 지정)
import "dotenv/config";
import { runRepo, saveRepoResult } from "./main/repo";
import { pushRepoReport } from "./main/notion";

async function main() {
  const [yearMonthArg] = process.argv.slice(2);
  const result = yearMonthArg ? await runRepo(yearMonthArg) : await runRepo();

  console.log(`\n=== ${result.yearMonth} 월간 전략 리포트 (${result.isAI ? "AI 분석" : "규칙 기반"}) ===\n`);

  if (result.dataNotes.length > 0) {
    console.log("데이터 참고사항:");
    for (const n of result.dataNotes) console.log(`- ${n}`);
    console.log();
  }

  for (const b of result.branches) {
    console.log(`──── [${b.branchName}] ────`);
    console.log(b.operationsReport.slice(0, 300) + (b.operationsReport.length > 300 ? "..." : ""));
    console.log();
  }

  const path = saveRepoResult(result);
  console.log(`\n📄 저장됨: ${path}`);

  const notion = await pushRepoReport(result);
  console.log(notion.ok ? `✅ 노션에 저장됨: ${notion.url}` : `⏭️  건너뜀: ${notion.error}`);
}

main().catch((err) => {
  console.error("❌ 실패:", err instanceof Error ? err.message : err);
  process.exit(1);
});
