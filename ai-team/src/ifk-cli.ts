// 피트니스경영신문(IFK) 자동 등록대기 단독 테스트.
// 실행:
//   npm run ifk           (작성일 도래 + 미게시 기사 중 가장 오래된 1건, 매시 정각 자동 실행과 동일)
//   npm run ifk -- 1      (번호 1 기사를 게시완료 여부 무시하고 강제로 다시 올림 — 수정 후 재업로드용)
import "dotenv/config";
import { runIfkJob, runIfkJobForNumber } from "./main/ifk";

async function main() {
  const [numberArg] = process.argv.slice(2);
  console.log("=== IFK 기사 등록대기 시작 ===\n");
  const result = numberArg ? await runIfkJobForNumber(Number(numberArg)) : await runIfkJob();

  if (result.skipped) {
    console.log(`⏭️  건너뜀: ${result.error}`);
    return;
  }
  if (!result.ok) {
    console.log(`❌ 실패 (${result.title ?? "제목 없음"} / ${result.reporterName ?? "기자 미배정"}): ${result.error}`);
    process.exit(1);
  }
  console.log(`✅ 등록대기 완료: "${result.title}" (작성자: ${result.reporterName})`);
  console.log("IFK 관리자 > 뉴스관리 > 등록대기 뉴스관리에서 확인하세요.");
}

main().catch((err) => {
  console.error("❌", err instanceof Error ? err.message : err);
  process.exit(1);
});
