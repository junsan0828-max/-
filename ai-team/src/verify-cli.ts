// 온라인 지부장 2차 검증(DB 실대조) 단독 실행.
// 실행: npm run verify — "협의실 확인" 클라우드 루틴이 하루 4번 이 스크립트를 호출한다.
import "dotenv/config";
import { gatherContext } from "./main/data";
import { runVerification } from "./main/verify";
import { pushVerificationToConsultRoom } from "./main/notion";

async function main() {
  console.log("=== 온라인 지부장 실대조 검증 시작 ===\n");
  const ctx = await gatherContext();
  if (ctx.source !== "db") {
    console.log(`❌ DB 연결 실패 (${ctx.meta.queryError ?? "사유 미상"}) — 실검증 불가, 종료`);
    process.exit(1);
  }

  const result = await runVerification(ctx);
  console.log(`기준일 ${result.asOfDate} · 기준시각 ${result.asOfTimestamp}`);
  for (const s of result.scopes) {
    console.log(
      `[${s.scope}] 활성 ${s.activeNow} · 계약액 ${s.contractAmount.toLocaleString()}원 · 실입금 ${s.monthRevenue.toLocaleString()}원 · 신규 ${s.newCount}건 · 재등록 ${s.reRegisterCount}건`
    );
  }
  console.log(`오늘 거래 ${result.todayTransactions.length}건 · 만료10일이내 ${result.expiringWithin10.length}명 · 미수금 ${result.unpaidMembersNow.length}명`);

  const push = await pushVerificationToConsultRoom(result);
  if (push.ok) {
    console.log(`✅ 노션 반영 완료: ${push.url}`);
  } else {
    console.log(`❌ 노션 반영 실패: ${push.error}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("❌", err instanceof Error ? err.message : err);
  process.exit(1);
});
