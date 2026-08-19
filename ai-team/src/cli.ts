// GUI 없이 총괄 AI 뇌만 돌려 검증하는 용도. 실행: npm run brain  (키 없으면 npm run brain:dry)
import "dotenv/config";
import { runOrchestrator, saveResult } from "./main/orchestrator";
import { generateMemberMessages } from "./main/mina";
import { analyzeFunnel } from "./main/dataAgent";
import { generateContentIdeas } from "./main/luna";
import { pushDailyReport, isNotionEnabled } from "./main/notion";
import { pushDailyBriefingKakao, isKakaoEnabled } from "./main/kakao";

const dry = process.argv.includes("--dry");

runOrchestrator({ dry })
  .then(async (r) => {
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

    const mina = await generateMemberMessages(r.context);
    console.log(`\n🙋‍♀️ 미나(회원관리) — ${mina.isAI ? "AI 작성" : "템플릿"} · 문자 초안 ${mina.messages.length}건`);
    for (const m of mina.messages) {
      console.log(`\n  [${m.category}] ${m.name} (${m.phone ?? "번호없음"})`);
      console.log(`  "${m.message}"`);
    }

    const funnel = await analyzeFunnel(r.context);
    console.log(`\n📊 데이터(퍼널분석) — ${funnel.isAI ? "AI 분석" : "규칙 기반"}`);
    console.log(funnel.insight);

    const content = await generateContentIdeas(r.context, funnel);
    console.log(`\n🎨 루나(마케팅) — ${content.isAI ? "AI 작성" : "템플릿"} · 콘텐츠 초안 ${content.ideas.length}건`);
    for (const idea of content.ideas) {
      console.log(`\n  [${idea.platform}] ${idea.title}`);
      console.log(`  ${idea.draft}`);
    }

    console.log(`\n📓 노션 연동 — ${isNotionEnabled() ? "설정됨" : "꺼짐 (.env에 NOTION_API_KEY/NOTION_DATABASE_ID 필요)"}`);
    const notion = await pushDailyReport(r, mina, funnel, content);
    console.log(notion.ok ? `✅ 브리핑 노션에 저장됨: ${notion.url}` : `⏭️  브리핑 저장 건너뜀: ${notion.error}`);

    // 업무관리/업무 로그 기록 제외 (2026-08-18 대표 지시) — 보고서 저장까지만 하고
    // "업무관리"/"업무 로그" 데이터베이스에는 더 이상 쓰지 않는다.

    console.log(`\n💬 카카오톡 연동 — ${isKakaoEnabled() ? "설정됨" : "꺼짐 (.env에 KAKAO_REST_API_KEY/KAKAO_REFRESH_TOKEN 필요)"}`);
    const kakao = await pushDailyBriefingKakao();
    console.log(kakao.ok ? "✅ 카카오톡으로 브리핑 발송 완료" : `⏭️  카카오톡 발송 건너뜀: ${kakao.error}`);
  })
  .catch((err) => {
    console.error("❌ 실패:", err.message);
    process.exit(1);
  });
