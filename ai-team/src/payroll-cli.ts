// 급여 정산 AI 단독 테스트.
// 실행:
//   npm run payroll              (전월 기준)
//   npm run payroll -- 2026-06   (특정 월 지정)
import "dotenv/config";
import { runPayroll, writePayrollSheet } from "./main/payroll";
import { pushPayrollReport } from "./main/notion";

async function main() {
  const [yearMonthArg] = process.argv.slice(2);
  const result = yearMonthArg ? await runPayroll(yearMonthArg) : await runPayroll();

  console.log(`\n=== ${result.yearMonth} 급여 정산 ===\n`);

  if (result.issues.length > 0) {
    console.log(`🚨 오류 ${result.issues.length}건 발견 — 정산 중단\n`);
    for (const issue of result.issues) {
      console.log(`- [${issue.trainerName}] ${issue.detail}`);
    }
    console.log(`\n자동 점검 불가 항목 (참고용):`);
    for (const u of result.uncheckable) console.log(`- ${u}`);
    const notion = await pushPayrollReport(result);
    console.log(notion.ok ? `\n노션 보고 완료: ${notion.url}` : `\n노션 보고 안 함: ${notion.error}`);
    return;
  }

  console.log("✅ 단가 오류 없음 / 중복 정산 의심 없음\n");
  for (const t of result.trainers) {
    console.log(
      `${t.trainerName.padEnd(6)} 수업정산 ${t.afterTax.toLocaleString().padStart(10)}원 + 기본급(세후) ${t.basePayAfterTax
        .toLocaleString()
        .padStart(10)}원 = 총 ${t.totalPay.toLocaleString().padStart(10)}원`
    );
  }

  console.log(`\n📊 구글 시트 작성 중...`);
  const { url } = await writePayrollSheet(result);
  console.log(`시트: ${url}`);

  const notion = await pushPayrollReport(result, url);
  console.log(notion.ok ? `노션 보고 완료: ${notion.url}` : `노션 보고 안 함: ${notion.error}`);
}

main().catch((err) => {
  console.error("❌", err instanceof Error ? err.message : err);
  process.exit(1);
});
