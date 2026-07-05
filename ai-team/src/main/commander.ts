// 명령창 — 사장님이 자유롭게 지시/질문하면 제이가 데이터를 참고해 답하거나 초안을 작성한다.
// 문자 발송·게시처럼 외부로 나가는 실행은 하지 않는다 (안전을 위해 초안/답변까지만).
import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { gatherContext } from "./data";
import { buildDataSummary } from "./orchestrator";

const MODEL = process.env.AI_TEAM_MODEL || "claude-sonnet-4-6";
const CONFIG_DIR = join(__dirname, "..", "..", "config");

function loadJson(name: string) {
  return JSON.parse(readFileSync(join(CONFIG_DIR, name), "utf-8"));
}

export interface CommandResult {
  isAI: boolean;
  reply: string;
}

export async function runCommand(instruction: string): Promise<CommandResult> {
  const trimmed = instruction.trim();
  if (!trimmed) return { isAI: false, reply: "지시 내용을 입력해주세요." };

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      isAI: false,
      reply: "자유 지시 기능은 AI 키가 있어야 동작해요. .env의 ANTHROPIC_API_KEY를 확인해주세요.",
    };
  }

  try {
    const context = await gatherContext();
    const team = loadJson("team.json");
    const mindmap = loadJson("mindmap.json");

    const client = new Anthropic({ apiKey });
    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: 2000,
      system: `${team.orchestrator.persona}
사장님이 자유롭게 지시하거나 질문하면, 아래 데이터를 참고해 답변하거나 요청한 초안(문자·콘텐츠·리스트 등)을 작성한다.

중요한 제약:
- 문자 발송, 콘텐츠 게시, 영상 업로드처럼 실제로 외부에 나가는 행동은 절대 하지 않는다 (할 수도 없다).
  그런 요청이면 "초안만 작성해드릴게요"라고 안내하고 초안을 준다.
- 데이터에 없는 내용은 추측하지 말고 모른다고 답한다.
- 한국어로, 간결하고 실용적으로 답한다. 마크다운 사용 가능.`,
      messages: [
        {
          role: "user",
          content: `[사업 구조 마인드맵]
${JSON.stringify(mindmap, null, 0)}

[오늘의 운영 데이터]
${buildDataSummary(context)}

[사장님 지시/질문]
${trimmed}`,
        },
      ],
    });

    const text = msg.content[0]?.type === "text" ? msg.content[0].text : "";
    return { isAI: true, reply: text || "응답을 생성하지 못했어요." };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[명령창] 처리 실패:", message);
    return { isAI: false, reply: `요청 처리 중 오류가 발생했어요: ${message}` };
  }
}
