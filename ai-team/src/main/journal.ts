// 사업 일지 — 매일 밤, 그날 앱에서 실제로 진행된 일(지시 이력·업무 체크리스트)과 자이언트짐 데이터를
// 묶어서 "진행한 일 / 성과 / 현황 / 보완할 점 / 내일 할 일" 다섯 항목으로 정리해 노션에 기록한다.
// 총괄 AI 제이가 하루를 마감하며 쓰는 일지라고 보면 된다.
import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildDataSummary, loadTodaysResult } from "./orchestrator";
import { getTaskProgress } from "./taskProgress";
import { getTodaysCommands } from "./commandLog";
import { loadRepoResult, previousYearMonth } from "./repo";

const MODEL = process.env.AI_TEAM_MODEL || "claude-sonnet-4-6";
const CONFIG_DIR = join(__dirname, "..", "..", "config");

export interface JournalEntry {
  dateLabel: string; // YYYY-MM-DD
  isAI: boolean;
  progress: string; // 진행한 일
  achievements: string; // 성과
  status: string; // 현황
  improvements: string; // 보완할 점
  tomorrow: string; // 내일 할 일
}

function todayStr(): string {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
}

function teamNames(): Record<string, string> {
  const team = JSON.parse(readFileSync(join(CONFIG_DIR, "team.json"), "utf-8"));
  const byId: Record<string, string> = { [team.orchestrator.id]: team.orchestrator.name };
  for (const m of team.team) byId[m.id] = m.name;
  return byId;
}

/** 내일 날짜 기준으로 이미 예정된 자동 작업(급여정산 9일 / 리포 1일)을 안내 문구로 만든다. */
function scheduledTomorrow(): string[] {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const day = tomorrow.getDate();
  const items: string[] = [];
  if (day === 9) items.push("지영이 트레이너 급여 정산을 자동 실행함");
  if (day === 1) items.push("리포가 전월 지점별 월간 전략 리포트를 자동 실행함");
  return items;
}

function buildRawMaterial() {
  const names = teamNames();
  const commands = getTodaysCommands();
  const progress = getTaskProgress();
  const jay = loadTodaysResult();
  const repo = loadRepoResult(previousYearMonth());
  const repoGeneratedToday = !!repo && repo.generatedAt.slice(0, 10) === todayStr();

  const commandLines = commands.map(
    (c) => `- [${names[c.agentId] ?? c.agentId}] 지시: ${c.instruction} → 답변: ${c.reply.slice(0, 200)}`
  );

  const doneTasks = (progress?.items ?? []).filter((t) => t.done);
  const undoneTasks = (progress?.items ?? []).filter((t) => !t.done);

  return {
    commandLines,
    doneTasks,
    undoneTasks,
    jayHeadline: jay?.headline ?? null,
    jayDataSummary: jay ? buildDataSummary(jay.context) : null,
    repoGeneratedToday,
    repoExpenseMissing: repo?.expenseMissing ?? false,
    repoYearMonth: repo?.yearMonth ?? null,
    scheduled: scheduledTomorrow(),
  };
}

function fallbackEntry(raw: ReturnType<typeof buildRawMaterial>): JournalEntry {
  const progress =
    raw.commandLines.length > 0 || raw.doneTasks.length > 0
      ? [
          ...raw.doneTasks.map((t) => `- (완료) ${t.title}`),
          ...raw.commandLines,
        ].join("\n")
      : "오늘은 앱에서 별도로 진행된 지시나 완료 업무가 없었습니다.";

  const achievements = raw.jayDataSummary ?? "오늘 분석된 데이터가 없습니다.";

  const status = raw.jayHeadline ?? "오늘 제이의 브리핑이 아직 없습니다.";

  const improvementLines: string[] = [];
  if (raw.undoneTasks.length > 0)
    improvementLines.push(...raw.undoneTasks.filter((t) => t.priority === "high").map((t) => `- 미완료(우선): ${t.title} — ${t.reason}`));
  if (raw.repoGeneratedToday && raw.repoExpenseMissing)
    improvementLines.push(`- ${raw.repoYearMonth} 지출(expense_entries) 미입력 — 운영 시스템에 입력 필요`);
  const improvements = improvementLines.length > 0 ? improvementLines.join("\n") : "특별히 걸리는 리스크는 없습니다.";

  const tomorrowLines = [
    ...raw.undoneTasks.map((t) => `- 이월: ${t.title}`),
    ...raw.scheduled.map((s) => `- 예정: ${s}`),
  ];
  const tomorrow = tomorrowLines.length > 0 ? tomorrowLines.join("\n") : "특별히 예정된 업무가 없습니다.";

  return { dateLabel: todayStr(), isAI: false, progress, achievements, status, improvements, tomorrow };
}

export async function runJournal(): Promise<JournalEntry> {
  const raw = buildRawMaterial();
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return fallbackEntry(raw);

  try {
    const client = new Anthropic({ apiKey });
    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: 2000,
      system:
        "너는 자이언트짐 AI 운영팀의 총괄 실장 제이. 하루를 마감하며 사업 일지를 쓴다. " +
        "지어내지 말고 주어진 사실만 바탕으로 담백하게 정리한다. 반드시 다른 설명 없이 JSON 객체 하나만 출력한다.",
      messages: [
        {
          role: "user",
          content: `아래는 오늘(${todayStr()}) 앱에서 실제로 있었던 일과 데이터다.

[오늘 팀원에게 내려진 지시/답변]
${raw.commandLines.join("\n") || "없음"}

[오늘의 업무 체크리스트 - 완료]
${raw.doneTasks.map((t) => `- ${t.title}`).join("\n") || "없음"}

[오늘의 업무 체크리스트 - 미완료]
${raw.undoneTasks.map((t) => `- [${t.priority}] ${t.title} — ${t.reason}`).join("\n") || "없음"}

[제이의 오늘 브리핑]
${raw.jayHeadline ?? "없음"}
${raw.jayDataSummary ?? ""}

[리포 AI 관련]
${raw.repoGeneratedToday ? `오늘 ${raw.repoYearMonth} 월간 전략 리포트 생성됨. 지출 미입력: ${raw.repoExpenseMissing ? "예" : "아니오"}` : "오늘은 리포 실행 없음"}

[내일 예정된 자동 작업]
${raw.scheduled.join("\n") || "없음"}

이 내용을 바탕으로 아래 JSON 형식으로만 답하라. 각 항목은 200자 이내로 간결하게, 줄바꿈은 "\\n"으로 표현한 불릿 위주로 써라.
{
  "progress": "오늘 진행한 일",
  "achievements": "오늘의 성과 (숫자 위주)",
  "status": "자이언트짐 현재 상황 요약",
  "improvements": "보완할 점 / 리스크",
  "tomorrow": "내일 할 일 (이월 업무 + 예정된 자동 작업 포함)"
}`,
        },
      ],
    });
    const text = msg.content[0]?.type === "text" ? msg.content[0].text : "";
    const s = text.indexOf("{");
    const e = text.lastIndexOf("}");
    const parsed = JSON.parse(text.slice(s, e + 1));
    return {
      dateLabel: todayStr(),
      isAI: true,
      progress: String(parsed.progress ?? ""),
      achievements: String(parsed.achievements ?? ""),
      status: String(parsed.status ?? ""),
      improvements: String(parsed.improvements ?? ""),
      tomorrow: String(parsed.tomorrow ?? ""),
    };
  } catch (err) {
    console.error("[제이] 사업 일지 AI 작성 실패, 규칙 기반으로 전환:", err instanceof Error ? err.message : err);
    return fallbackEntry(raw);
  }
}
