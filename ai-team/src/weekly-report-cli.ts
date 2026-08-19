// 매주 월요일 오전 주간 운영 보고 — 카카오톡("나에게 보내기")으로 발송.
// 실행: npm run weekly-report
import "dotenv/config";
import { pushWeeklyBriefingKakao } from "./main/kakao";

async function main() {
  const result = await pushWeeklyBriefingKakao();
  if (result.ok) {
    console.log("✅ 주간 운영 보고 발송 완료");
  } else {
    console.error("❌ 주간 운영 보고 발송 실패:", result.error);
    process.exit(1);
  }
}

main();
