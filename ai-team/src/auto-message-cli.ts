// 13시 자동 문자 발송 단독 실행.
// 실행:
//   npm run auto-message   (헬스권 만료 D-10/D-5 안내 + 관리상담 D+1 후속 안내를 조회해 발송)
import "dotenv/config";
import { runAutoMessageJob } from "./main/autoMessage";

const CATEGORY_LABEL: Record<string, string> = {
  expiry_d10: "헬스권 만료 D-10",
  expiry_d5: "헬스권 만료 D-5",
  consult_followup: "관리상담 D+1 후속",
};

async function main() {
  console.log("=== 13시 자동 문자 발송 시작 ===\n");
  const result = await runAutoMessageJob();

  if (!result.ok) {
    console.log(`❌ 실패: ${result.error}`);
    process.exit(1);
  }

  for (const s of result.summary ?? []) {
    console.log(
      `${CATEGORY_LABEL[s.category] ?? s.category}: 대상 ${s.targeted}건 · 발송 ${s.sent}건 · 실패 ${s.failed}건 · 연락처 확인필요 ${s.skippedInvalidPhone}건`
    );
  }

  const failedOrSkipped = (result.details ?? []).filter((d) => d.result !== "sent");
  if (failedOrSkipped.length > 0) {
    console.log("\n--- 미발송 상세 ---");
    for (const d of failedOrSkipped) {
      console.log(`  [${CATEGORY_LABEL[d.category] ?? d.category}] ${d.name ?? "이름없음"} ${d.phone ?? "연락처없음"} → ${d.result} (${d.error ?? ""})`);
    }
  }

  console.log("\n✅ 완료");
}

main().catch((err) => {
  console.error("❌", err instanceof Error ? err.message : err);
  process.exit(1);
});
