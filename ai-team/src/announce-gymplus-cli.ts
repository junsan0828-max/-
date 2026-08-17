// 자이언트짐+ 오픈 안내 전체 발송 — 1회성 캠페인. 실행: npm run announce-gymplus
// 이미 보낸 회원은 auto_message_log에 기록되어 있어 다시 실행해도 중복 발송되지 않는다.
import "dotenv/config";
import { runGymplusLaunchAnnounce } from "./main/announce";

async function main() {
  console.log("=== 자이언트짐+ 오픈 안내 발송 시작 ===\n");
  const result = await runGymplusLaunchAnnounce();
  if (!result.ok) {
    console.error("❌ 실패:", result.error);
    process.exit(1);
  }
  console.log(`대상 ${result.targeted}명`);
  console.log(`발송 성공 ${result.sent}건`);
  console.log(`발송 실패 ${result.failed}건`);
  console.log(`연락처 확인 필요 ${result.skippedInvalidPhone}건`);
  console.log(`이미 발송됨(중복 제외) ${result.alreadyDone}건`);
}

main().catch((err) => {
  console.error("❌", err instanceof Error ? err.message : err);
  process.exit(1);
});
