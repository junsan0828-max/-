// 범용 카카오톡("나에게 보내기") 발송 커맨드. 다른 자동화가 코드로 붙어있지 않고 클라우드
// 에이전트가 판단해서 알려야 하는 경우(예: 협의실 미해결 안건)에 이 CLI로 텍스트를 넘겨 보낸다.
// 실행: npm run kakao-notify -- "보낼 텍스트"
import "dotenv/config";
import { pushKakaoText } from "./main/kakao";

async function main() {
  const text = process.argv.slice(2).join(" ").trim();
  if (!text) {
    console.error("❌ 보낼 텍스트를 인자로 넘겨주세요. 예: npm run kakao-notify -- \"내용\"");
    process.exit(1);
  }

  const result = await pushKakaoText(text);
  if (result.ok) {
    console.log("✅ 카카오톡 발송 완료");
  } else {
    console.error("❌ 카카오톡 발송 실패:", result.error);
    process.exit(1);
  }
}

main();
