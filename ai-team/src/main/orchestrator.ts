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
  periodLabel: string; // 이 브리핑이 다루는 기간 ("어제" | "지난주(월~일)")
}

/** 월요일엔 주말 동안 쌓인 지난주 전체를, 화~금요일엔 전날 하루를 브리핑 대상 기간으로 삼는다. */
export function getBriefingPeriod(date = new Date()): { label: string; isWeekly: boolean } {
  const day = date.toLocaleString("en-US", { timeZone: "Asia/Seoul", weekday: "short" });
  if (day === "Mon") return { label: "지난주(월~일)", isWeekly: true };
  return { label: "어제", isWeekly: false };
}

const MODEL = process.env.AI_TEAM_MODEL || "claude-sonnet-4-6";
const CONFIG_DIR = join(__dirname, "..", "..", "config");

function loadJson(name: string) {
  return JSON.parse(readFileSync(join(CONFIG_DIR, name), "utf-8"));
}

export function buildDataSummary(c: GymContext): string {
  const dbStatus = c.meta.dbConnected
    ? `실데이터 (조회시각 ${c.meta.asOfTimestamp})`
    : `샘플 데이터 — DB 연결 실패(${c.meta.queryError ?? "사유 미상"})`;
  const branchLines = c.byBranch
    .map(
      (b) =>
        `  · ${b.branchName}: 활성 ${b.active}, 계약액 ${b.contractAmount.toLocaleString()}원, 실입금 ${b.monthRevenue.toLocaleString()}원, 미수금 ${b.unpaidTotal.toLocaleString()}원, 만료예정 ${b.expiringSoonCount}명, 최근14일만료 ${b.recentlyExpiredCount}명, 신규 ${b.newCount}건, 재등록 ${b.reRegisterCount}건`
    )
    .join("\n");
  // 인건비·임대료 등 주요 비용이 이번 달 것으로 다 반영됐는지 여기선 확인할 수 없어(2026-08-20
  // 대표 지시) — 항상 "순이익"이 아니라 "확인된 현금흐름"으로만 표현한다.
  return `[데이터 기준일 ${c.asOf} · 출처 ${dbStatus}]
- 회원: 전체 ${c.members.total}, 활성 ${c.members.active}, 30일내 만료예정 ${c.members.expiringSoon.length}명(7일이내 ${c.members.expiringBuckets.within7}·8~14일 ${c.members.expiringBuckets.within14}·15~30일 ${c.members.expiringBuckets.within30}), 최근14일만료 ${c.members.recentlyExpired.length}명
- 지점별:
${branchLines}
- 생애흐름(리드): 미상담 ${c.funnel.pending}, 상담 ${c.funnel.consulted}, 등록 ${c.funnel.registered}, 이탈 ${c.funnel.dropped} / 상담전환율 ${c.funnel.consultRate}%, 상담→등록 ${c.funnel.registerRate}%
- 매출(이번달): 계약액 ${c.money.contractAmount.toLocaleString()}원 / 실입금 ${c.money.monthRevenue.toLocaleString()}원 / 환불 ${c.money.refundAmount.toLocaleString()}원 / 최종실현매출 ${c.money.netRevenueThisMonth.toLocaleString()}원 (신규 ${c.money.newCount}건, 재등록 ${c.money.reRegisterCount}건)
- 미수금: 전체누적 ${c.money.unpaidTotal.toLocaleString()}원(${c.money.unpaidMembers.length}명) / 이번달발생분 ${c.money.unpaidThisMonth.toLocaleString()}원
- 확인된 현금흐름(이번달, 인건비·임대료 등 비용 미반영 가능 — "순이익" 아님): 지출입력액 ${c.expense.thisMonthTotal.toLocaleString()}원, 실입금-지출입력액 ${c.expense.netProfitThisMonth.toLocaleString()}원
- 채널별 리드→등록 전환율: ${c.channels.map((ch) => `${ch.channel} ${ch.rate}%(리드${ch.leads}/등록${ch.registered})`).join(", ") || "데이터 없음"}`;
}

// API 키가 없거나 실패해도 항상 결과가 나오도록 규칙 기반으로 업무를 만든다.
function fallbackResult(c: GymContext, periodLabel: string): OrchestratorResult {
  // 만료 회원 접촉은 D-10·D-5 규칙(autoMessage.ts, mode=auto)으로만 운영한다 — "30일 내 전체
  // 연락" 같은 별도 수동 업무를 만들지 않는다. "이탈위험"(최근 만료) 항목과 그 일괄 연락 업무도
  // 일일 브리핑에서 다루지 않는다(2026-08-20 대표 지시).
  const tasks: TeamTask[] = [];
  if (c.money.unpaidTotal > 0)
    tasks.push({
      title: `미수금 ${c.money.unpaidTotal.toLocaleString()}원 수금 확인`,
      assigneeRole: "회원관리",
      priority: "high",
      reason: `미수금 ${c.money.unpaidMembers.length}명. 방치할수록 회수율 하락. 단순 수납 확인이라 직원 업무 — 대표는 최종 정책 결정만.`,
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

  const report = `## 제이의 브리핑 (${periodLabel} · 규칙 기반)\n\n${buildDataSummary(c)}\n\n**오늘 처리해야 할 업무**\n${tasks
    .filter((t) => t.priority === "high")
    .map((t) => `- ${t.title} — ${t.reason}`)
    .join("\n") || "- 급한 항목 없음"}\n`;

  return {
    generatedAt: new Date().toISOString(),
    isAI: false,
    headline: `[${periodLabel} 기준] 만료예정 ${c.members.expiringSoon.length}명·미수금 ${c.money.unpaidTotal.toLocaleString()}원 확인. 오늘 우선업무 ${tasks.filter((t) => t.priority === "high").length}건.`,
    tasks,
    report,
    context: c,
    periodLabel,
  };
}

function extractJson(text: string): any {
  // 모델이 ```json ... ``` 코드블록으로 감싸는 경우를 대비해 먼저 벗겨낸다.
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1] : text;
  const s = body.indexOf("{");
  const e = body.lastIndexOf("}");
  if (s === -1 || e === -1) throw new Error("JSON 파싱 실패: 응답에서 { } 를 찾지 못함");
  return JSON.parse(body.slice(s, e + 1));
}

export async function runOrchestrator(opts: { dry?: boolean } = {}): Promise<OrchestratorResult> {
  const context = await gatherContext();
  const { label: periodLabel, isWeekly } = getBriefingPeriod();
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (opts.dry || !apiKey) return fallbackResult(context, periodLabel);

  const mindmap = loadJson("mindmap.json");
  const team = loadJson("team.json");

  try {
    const client = new Anthropic({ apiKey });
    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: 4000,
      system: `${team.orchestrator.persona}
너는 아래 팀원에게만 업무를 배분한다: ${team.team.map((t: any) => `${t.name}(${t.role})`).join(", ")}.
반드시 다른 설명 없이 JSON 객체 하나만 출력한다. 코드블록(\`\`\`)으로 감싸지 않는다. report는 400자 이내로 간결하게 쓴다.

업무 도출 규칙(2026-08-20 대표 확정):
- "이탈위험"(최근 만료 회원) 항목이나 그 일괄 연락·복귀 캠페인 업무는 절대 만들지 마라. 만료 회원 관리는
  D-10·D-5 자동 문자(이미 자동 발송됨)로만 운영한다. "30일 내 전체 연락", "7일 이내 전체 연락" 같은
  별도 수동 업무도 만들지 마라.
- mode는 실제 업무 성격으로 정한다: 단순 회원 연락·상담·미수금 수납 확인처럼 직원이 처리할 수 있는
  업무는 mode="semi"로 표시하고 "manual"을 쓰지 마라. mode="manual"은 가격·정책·결제·인사·대외발송처럼
  대표의 최종 결정이 실제로 필요한 업무에만 써라.
- 비용(지출) 데이터는 이번 달 것이 전부 입력됐는지 알 수 없다. "순이익"이라는 단어를 쓰지 말고
  "확인된 현금흐름"이라고만 표현해라.`,
      messages: [
        {
          role: "user",
          content: `아래는 자이언트짐의 사업 마인드맵과 오늘 시점 운영 데이터(현재 스냅샷)다.
오늘은 ${isWeekly ? "월요일" : "화~금요일 중 하루"}라서, 이번 브리핑은 "${periodLabel}"를 다루는 브리핑이다.

[사업 구조 마인드맵]
${JSON.stringify(mindmap, null, 0)}

[오늘 시점 데이터]
${buildDataSummary(context)}

이 데이터를 마인드맵의 "고객 생애 흐름"과 "수익/재등록/마케팅" 관점으로 분석해,
"${periodLabel}" 동안 있었던 일을 해석하고, 오늘 당장 처리해야 할 업무를 도출해 팀원에게 배분하라.
(주의: 날짜별로 쪼갠 이력 데이터는 없고 현재 스냅샷만 있으니, 스냅샷 수치를 "${periodLabel}" 기준 해석으로
자연스럽게 풀어 쓰되 없는 사실을 지어내지는 마라.) 아래 JSON 형식으로만 답하라.

{
  "headline": "원장에게 보고할 한 줄 요약 (기간: ${periodLabel})",
  "tasks": [
    { "title": "구체적 업무", "assigneeRole": "회원관리|퍼널분석|마케팅|리포트", "priority": "high|normal|low", "reason": "왜 필요한지", "mode": "auto|semi|manual" }
  ],
  "report": "마크다운 브리핑 — '${periodLabel} 분석'과 '오늘 처리해야 할 업무 리스트' 두 섹션 포함, 데이터 해석 + 우선순위 + 다음 액션"
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
      periodLabel,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[제이] AI 분석 실패, 규칙 기반으로 전환:", message);
    const fb = fallbackResult(context, periodLabel);
    fb.headline = `(AI 호출 실패: ${message.slice(0, 80)} → 규칙 기반) ` + fb.headline;
    return fb;
  }
}

/** 오늘(KST) 이미 분석한 결과가 있으면 돌려준다. 앱을 여러 번 껐다 켜도 같은 날엔 API를 다시 부르지 않기 위함. */
export function loadTodaysResult(): OrchestratorResult | null {
  try {
    const raw = readFileSync(join(__dirname, "..", "..", "output", "latest.json"), "utf-8");
    const result: OrchestratorResult = JSON.parse(raw);
    const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
    const resultDay = new Date(result.generatedAt).toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
    return resultDay === today ? result : null;
  } catch {
    return null;
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
