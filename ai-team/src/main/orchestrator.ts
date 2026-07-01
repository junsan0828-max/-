// 총괄 AI "제이" — 마인드맵 + 데이터를 분석해 필요 업무를 도출하고 리포트를 쓴다.
import Anthropic from "@anthropic-ai/sdk";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { gatherContext, GymContext } from "./data";

export type TaskMode = "auto" | "semi" | "manual";
export interface TeamTask {
  title: string;
  assigneeRole: string; // 회원관리 / 퍼널분석 / 마케팅 / 리포트
  priority: "high" | "normal" | "low";
  reason: string;
  mode: TaskMode; // auto=완전자동 / semi=반자동 / manual=사람
}
export interface OrchestratorResult {
  generatedAt: string;
  isAI: boolean;
  headline: string; // 제이의 한 줄 요약
  tasks: TeamTask[];
  report: string; // 마크다운 리포트
  context: GymContext;
}

const MODEL = process.env.AI_TEAM_MODEL || "claude-sonnet-4-6";
const CONFIG_DIR = join(__dirname, "..", "..", "config");

function loadJson(name: string) {
  return JSON.parse(readFileSync(join(CONFIG_DIR, name), "utf-8"));
}

function buildDataSummary(c: GymContext): string {
  return `[데이터 기준일 ${c.asOf} · 출처 ${c.source === "db" ? "실데이터" : "샘플"}]
- 회원: 전체 ${c.members.total}, 활성 ${c.members.active}, 30일내 만료예정 ${c.members.expiringSoon.length}명, 최근14일 만료(이탈위험) ${c.members.recentlyExpired.length}명
- 생애흐름(리드): 미상담 ${c.funnel.pending}, 상담 ${c.funnel.consulted}, 등록 ${c.funnel.registered}, 이탈 ${c.funnel.dropped} / 상담전환율 ${c.funnel.consultRate}%, 상담→등록 ${c.funnel.registerRate}%
- 매출: 이번달 ${c.money.monthRevenue.toLocaleString()}원 (신규 ${c.money.newCount}건, 재등록 ${c.money.reRegisterCount}건), 미수금 ${c.money.unpaidTotal.toLocaleString()}원(${c.money.unpaidMembers.length}명)`;
}

// API 키가 없거나 실패해도 항상 결과가 나오도록 규칙 기반으로 업무를 만든다.
function fallbackResult(c: GymContext): OrchestratorResult {
  const tasks: TeamTask[] = [];
  if (c.members.expiringSoon.length > 0)
    tasks.push({
      title: `만료 예정 ${c.members.expiringSoon.length}명 재등록 안내 문자 발송`,
      assigneeRole: "회원관리",
      priority: "high",
      reason: `30일 내 만료 회원이 ${c.members.expiringSoon.length}명. 만료 전 접촉이 재등록률을 좌우함.`,
      mode: "semi",
    });
  if (c.members.recentlyExpired.length > 0)
    tasks.push({
      title: `최근 만료 ${c.members.recentlyExpired.length}명 복귀 유도 연락`,
      assigneeRole: "회원관리",
      priority: "high",
      reason: "최근 만료 회원은 복귀 확률이 아직 높은 골든타임.",
      mode: "semi",
    });
  if (c.money.unpaidTotal > 0)
    tasks.push({
      title: `미수금 ${c.money.unpaidTotal.toLocaleString()}원 수금 리마인드`,
      assigneeRole: "회원관리",
      priority: "high",
      reason: `미수금 ${c.money.unpaidMembers.length}명. 방치할수록 회수율 하락.`,
      mode: "semi",
    });
  if (c.funnel.registerRate < 40 && c.funnel.consulted + c.funnel.registered > 0)
    tasks.push({
      title: "상담→등록 전환율 개선안 실행 (24시간 내 팔로업)",
      assigneeRole: "퍼널분석",
      priority: "normal",
      reason: `상담→등록 전환율 ${c.funnel.registerRate}%로 낮음.`,
      mode: "manual",
    });
  if (c.funnel.pending > 0)
    tasks.push({
      title: `미상담 리드 ${c.funnel.pending}건 예약 전환 연락`,
      assigneeRole: "퍼널분석",
      priority: "normal",
      reason: "유입은 됐으나 상담 예약이 안 잡힌 리드.",
      mode: "semi",
    });
  tasks.push({
    title: "주간 운영 리포트 정리",
    assigneeRole: "리포트",
    priority: "low",
    reason: "이번 주 매출·전환·업무 실행결과 요약 필요.",
    mode: "auto",
  });

  const report = `## 제이의 주간 브리핑 (규칙 기반)\n\n${buildDataSummary(c)}\n\n**우선 처리**\n${tasks
    .filter((t) => t.priority === "high")
    .map((t) => `- ${t.title} — ${t.reason}`)
    .join("\n") || "- 급한 항목 없음"}\n`;

  return {
    generatedAt: new Date().toISOString(),
    isAI: false,
    headline: `만료예정 ${c.members.expiringSoon.length}명·미수금 ${c.money.unpaidTotal.toLocaleString()}원 확인. 오늘 우선업무 ${tasks.filter((t) => t.priority === "high").length}건.`,
    tasks,
    report,
    context: c,
  };
}

function extractJson(text: string): any {
  const s = text.indexOf("{");
  const e = text.lastIndexOf("}");
  if (s === -1 || e === -1) throw new Error("JSON 파싱 실패");
  return JSON.parse(text.slice(s, e + 1));
}

export async function runOrchestrator(opts: { dry?: boolean } = {}): Promise<OrchestratorResult> {
  const context = await gatherContext();
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (opts.dry || !apiKey) return fallbackResult(context);

  const mindmap = loadJson("mindmap.json");
  const team = loadJson("team.json");

  try {
    const client = new Anthropic({ apiKey });
    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: 2000,
      system: `${team.orchestrator.persona}
너는 아래 팀원에게만 업무를 배분한다: ${team.team.map((t: any) => `${t.name}(${t.role})`).join(", ")}.
반드시 JSON만 출력한다.`,
      messages: [
        {
          role: "user",
          content: `아래는 자이언트짐의 사업 마인드맵과 오늘의 운영 데이터다.

[사업 구조 마인드맵]
${JSON.stringify(mindmap, null, 0)}

[오늘의 데이터]
${buildDataSummary(context)}

이 데이터를 마인드맵의 "고객 생애 흐름"과 "수익/재등록/마케팅" 관점으로 분석해,
지금 당장 필요한 업무를 도출하고 팀원에게 배분하라. 아래 JSON 형식으로만 답하라.

{
  "headline": "원장에게 보고할 한 줄 요약",
  "tasks": [
    { "title": "구체적 업무", "assigneeRole": "회원관리|퍼널분석|마케팅|리포트", "priority": "high|normal|low", "reason": "왜 필요한지", "mode": "auto|semi|manual" }
  ],
  "report": "마크다운 주간 브리핑 (데이터 해석 + 우선순위 + 다음 액션)"
}`,
        },
      ],
    });
    const text = msg.content[0]?.type === "text" ? msg.content[0].text : "";
    const parsed = extractJson(text);
    return {
      generatedAt: new Date().toISOString(),
      isAI: true,
      headline: String(parsed.headline ?? ""),
      tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
      report: String(parsed.report ?? ""),
      context,
    };
  } catch (err) {
    const fb = fallbackResult(context);
    fb.headline = "(AI 호출 실패 → 규칙 기반) " + fb.headline;
    return fb;
  }
}

export function saveResult(result: OrchestratorResult): string {
  const outDir = join(__dirname, "..", "..", "output");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "latest.json"), JSON.stringify(result, null, 2), "utf-8");
  const stamp = result.generatedAt.replace(/[:.]/g, "-").slice(0, 19);
  writeFileSync(join(outDir, `${stamp}.json`), JSON.stringify(result, null, 2), "utf-8");
  return join(outDir, "latest.json");
}
