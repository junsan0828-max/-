// 명령창 — 사장님이 자유롭게 지시/질문하면 제이가 데이터를 참고해 답하거나 초안을 작성한다.
// 문자 발송·게시처럼 외부로 나가는 실행은 하지 않는다 (안전을 위해 초안/답변까지만).
import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { gatherContext } from "./data";
import { buildDataSummary } from "./orchestrator";
import { getPayrollChatContext } from "./payroll";
import { appendCommandLog, getRecentCommands } from "./commandLog";
import { CHAT_TOOLS, executeChatTool } from "./chatTools";
import { answerFromData, RULE_BASED_TOPICS } from "./ruleBasedAnswer";

const MAX_TOOL_ROUNDS = 6;

const MODEL = process.env.AI_TEAM_MODEL || "claude-sonnet-4-6";
const CONFIG_DIR = join(__dirname, "..", "..", "config");

function loadJson(name: string) {
  return JSON.parse(readFileSync(join(CONFIG_DIR, name), "utf-8"));
}

export interface CommandResult {
  isAI: boolean;
  reply: string;
}

function formatKST(iso: string): string {
  return new Date(iso).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

/** "최근에 뭐 시켰지", "그거 다시 해줘" 같은 요청에 답할 수 있게 최근 지시 이력을 프롬프트용 텍스트로 만든다. */
function buildHistoryBlock(agentId: string): string {
  const history = getRecentCommands(agentId, 8);
  if (history.length === 0) return "";
  const lines = history.map((h, i) => {
    const replySnippet = h.reply.length > 300 ? h.reply.slice(0, 300) + "…" : h.reply;
    return `${i + 1}. [${formatKST(h.at)}] 지시: ${h.instruction}\n   답변: ${replySnippet}`;
  });
  return `\n[최근 지시 이력 (오래된 순, 마지막이 가장 최근)]\n${lines.join("\n")}\n`;
}

function resolvePersona(team: any, agentId: string): { name: string; persona: string } {
  if (agentId === "jay" || !agentId) {
    return { name: team.orchestrator.name, persona: team.orchestrator.persona };
  }
  const member = team.team.find((m: any) => m.id === agentId);
  if (member?.persona) return { name: member.name, persona: member.persona };
  return { name: team.orchestrator.name, persona: team.orchestrator.persona };
}

export async function runCommand(instruction: string, agentId = "jay"): Promise<CommandResult> {
  const trimmed = instruction.trim();
  if (!trimmed) return { isAI: false, reply: "지시 내용을 입력해주세요." };

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    // AI 키가 없어도 정형화된 조회(매출/미수금/회원수/정산 등)는 규칙 기반으로 바로 답한다.
    const context = await gatherContext();
    const payrollContext = agentId === "jiyoung" ? await getPayrollChatContext().catch(() => null) : null;
    const rule = answerFromData(trimmed, context, payrollContext);
    const reply =
      rule.reply ??
      `AI 키가 없어서 자유로운 질문엔 답을 못 해요. 다만 이런 건 바로 답해드릴 수 있어요: ${RULE_BASED_TOPICS.join(
        ", "
      )}${agentId === "jiyoung" ? ", 급여/정산" : ""}. 다시 물어봐 주세요!`;
    appendCommandLog(agentId, trimmed, reply);
    return { isAI: false, reply };
  }

  try {
    const context = await gatherContext();
    const team = loadJson("team.json");
    const mindmap = loadJson("mindmap.json");
    const { name, persona } = resolvePersona(team, agentId);

    // 지영(급여정산)은 일반 운영 데이터에 트레이너 세션/정산 정보가 없어서, 운영시스템(자이언트짐+ DB)과
    // 구글 드라이브 급여 시트를 직접 조회해 채팅 컨텍스트에 얹어준다. 이게 없으면 매번 "데이터를
    // 공유해달라"고 되묻게 된다.
    const payrollContext = agentId === "jiyoung" ? await getPayrollChatContext() : null;
    const historyBlock = buildHistoryBlock(agentId);

    const client = new Anthropic({ apiKey });
    const system = `${persona}
당신은 ${name}이다. 사장님이 자유롭게 지시하거나 질문하면, 아래 데이터를 참고해 본인 담당 업무 관점에서 답변하거나 요청한 초안(문자·콘텐츠·리스트 등)을 작성한다.
담당 범위를 벗어난 질문이면 "그건 제 담당이 아니라서요, ${team.orchestrator.name}한테 물어봐주세요" 식으로 자연스럽게 안내해도 된다.

중요한 제약:
- 문자 발송(카카오톡 포함), 블로그/인스타 게시처럼 아직 연동 안 된 채널로 실제로 나가는 행동은
  절대 하지 않는다 (할 수도 없다). 그런 요청이면 "초안만 작성해드릴게요"라고 안내하고 초안을 준다.
- 단, 구글 드라이브(파일 검색/읽기, 스프레드시트 생성·읽기·쓰기), 노션(페이지 생성), 유튜브(영상
  업로드)는 실제로 실행 가능한 도구가 주어져 있다. 사장님이 "정리해줘", "시트 만들어줘", "노션에
  올려줘", "유튜브에 올려줘"처럼 실제 작업을 요청하면 도구를 사용해 진짜로 수행하고, 다 끝난 뒤에
  결과(만든 파일 링크, 영상 URL 등)를 알려준다.
  유튜브 업로드는 사장님이 공개(public)로 명확히 요청하지 않는 한 항상 비공개(private)로 올린다.
  도구를 쓰지 않고 "했다"고 말로만 답하지 않는다 — 실제로 실행한 것만 완료했다고 말한다.
  도구 실행이 실패하면(권한, 파일 못 찾음 등) 실패했다고 정확히 알리고 원인을 설명한다.
- 필요한 데이터는 운영시스템(자이언트짐+)과 구글 드라이브에서 이미 자동으로 조회해 아래에 넣어뒀다.
  그 데이터 안에서 답하고, 사장님에게 데이터를 직접 공유해달라고 요청하지 않는다.
- 그럼에도 아래 데이터에 없거나 조회 자체가 실패한 내용은 추측하지 말고, 어떤 조회가 실패했는지
  있는 그대로 알려준다.
- 아래 [최근 지시 이력]을 참고해 "최근에 뭐 시켰지", "저번에 그거 어떻게 됐어" 같은 질문에 답한다.
  "다시 진행해", "그거 다시 해줘"처럼 이전 지시를 다시 하라고 하면, 이력에서 가장 최근 지시(문맥상
  다른 걸 가리키면 그 지시)를 찾아 지금 데이터 기준으로 같은 작업을 다시 수행한다.
- 한국어로, 간결하고 실용적으로 답한다. 마크다운 사용 가능.`;

    const userContent = `[사업 구조 마인드맵]
${JSON.stringify(mindmap, null, 0)}

[오늘의 운영 데이터]
${buildDataSummary(context)}
${payrollContext ? `\n${payrollContext}\n` : ""}
${historyBlock}
[사장님 지시/질문]
${trimmed}`;

    const messages: any[] = [{ role: "user", content: userContent }];
    let reply = "";

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const msg = await client.messages.create({
        model: MODEL,
        max_tokens: 2000,
        system,
        tools: CHAT_TOOLS as any,
        messages,
      });

      const textBlocks = msg.content.filter((b: any) => b.type === "text").map((b: any) => b.text).join("\n");
      if (textBlocks) reply = textBlocks;

      if (msg.stop_reason !== "tool_use") break;

      messages.push({ role: "assistant", content: msg.content });
      const toolUses = msg.content.filter((b: any) => b.type === "tool_use");
      const toolResults = await Promise.all(
        toolUses.map(async (block: any) => {
          let content: string;
          try {
            content = await executeChatTool(block.name, block.input);
          } catch (err: any) {
            content = `오류: ${err?.message ?? err}`;
          }
          return { type: "tool_result", tool_use_id: block.id, content };
        })
      );
      messages.push({ role: "user", content: toolResults });
    }

    reply = reply || "응답을 생성하지 못했어요.";
    appendCommandLog(agentId, trimmed, reply);
    return { isAI: true, reply };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[명령창] 처리 실패:", message);
    return { isAI: false, reply: `요청 처리 중 오류가 발생했어요: ${message}` };
  }
}
