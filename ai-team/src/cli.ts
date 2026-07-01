// GUI 없이 총괄 AI 뇌만 돌려 검증하는 용도. 실행: npm run brain  (키 없으면 npm run brain:dry)
import "dotenv/config";
import { runOrchestrator, saveResult } from "./main/orchestrator";

const dry = process.argv.includes("--dry");

runOrchestrator({ dry })
  .then((r) => {
    console.log(`\n🧑‍💼 제이(총괄 실장) — ${r.isAI ? "AI 분석" : "규칙 기반"}`);
    console.log(`📅 ${new Date(r.generatedAt).toLocaleString("ko-KR")}`);
    console.log(`\n▶ ${r.headline}\n`);
    console.log("─".repeat(50));
    console.log("도출된 업무:");
    for (const t of r.tasks) {
      const mark = { high: "🔴", normal: "🟡", low: "🟢" }[t.priority];
      const mode = { auto: "완전자동", semi: "반자동", manual: "수동" }[t.mode];
      console.log(`  ${mark} [${t.assigneeRole}] ${t.title}  (${mode})`);
      console.log(`     └ ${t.reason}`);
    }
    console.log("─".repeat(50));
    const path = saveResult(r);
    console.log(`\n📄 저장됨: ${path}`);
  })
  .catch((err) => {
    console.error("❌ 실패:", err.message);
    process.exit(1);
  });
