// 마케팅 AI "루나" — 이번 주 데이터를 바탕으로 채널별 콘텐츠 초안(제목+본문)을 만든다.
// 발행은 하지 않는다 (반자동): 사람이 복사해서 블로그/인스타에 직접 게시.
import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { GymContext } from "./data";
import { buildDataSummary } from "./orchestrator";
import { FunnelResult } from "./dataAgent";

const MODEL = process.env.AI_TEAM_MODEL || "claude-sonnet-4-6";

export type ContentPlatform = "블로그" | "인스타그램";
export interface ContentIdea {
  platform: ContentPlatform;
  title: string;
  draft: string;
}
export interface ContentResult {
  isAI: boolean;
  ideas: ContentIdea[];
}

function loadTeam() {
  return JSON.parse(readFileSync(join(__dirname, "..", "..", "config", "team.json"), "utf-8"));
}

function fallbackIdeas(c: GymContext, funnel?: FunnelResult): ContentIdea[] {
  const best = funnel?.bestChannel;
  return [
    {
      platform: "블로그",
      title: "이번 달 자이언트짐 회원님들의 변화 이야기",
      draft: `안녕하세요, 자이언트짐입니다! 이번 달에도 많은 회원님들이 열심히 운동해주셨는데요.\n\n${
        c.money.newCount > 0 ? `신규로 ${c.money.newCount}분이 함께해주셨고, ` : ""
      }${c.money.reRegisterCount > 0 ? `${c.money.reRegisterCount}분의 회원님이 재등록을 해주셨어요.` : ""} 꾸준함이 가장 큰 무기라는 걸 다시 느끼는 요즘입니다.\n\n[여기에 회원 후기/변화 사진 추가]\n\n지금 상담 예약하고 나만의 운동 루틴을 시작해보세요!`,
    },
    {
      platform: "인스타그램",
      title: best ? `${best} 채널 유입 회원 후기 강조` : "이번 주 운동 꿀팁 카드뉴스",
      draft: `💪 자이언트짐에서 오늘도 구슬땀!\n\n작은 습관이 큰 변화를 만듭니다. 이번 주 회원님들의 운동 모습을 공유해요.\n\n#자이언트짐 #PT #헬스 #운동스타그램 #오늘도운동`,
    },
  ];
}

export async function generateContentIdeas(context: GymContext, funnel?: FunnelResult): Promise<ContentResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { isAI: false, ideas: fallbackIdeas(context, funnel) };

  const team = loadTeam();
  const persona = team.team.find((t: any) => t.id === "luna")?.persona ?? "너는 자이언트짐 마케팅 담당 AI 루나다.";

  try {
    const client = new Anthropic({ apiKey });
    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: 2000,
      system: `${persona} 블로그 1개, 인스타그램 1개의 콘텐츠 초안을 만든다.
블로그는 800~1200자, 정보/후기 중심으로 자연스럽게. 인스타는 짧은 캡션+해시태그 5개 내외.
반드시 다른 설명 없이 JSON 배열 하나만 출력한다. 코드블록으로 감싸지 않는다.`,
      messages: [
        {
          role: "user",
          content: `${buildDataSummary(context)}
${funnel ? `\n[퍼널 진단]\n${funnel.insight}\n효율 좋은 채널: ${funnel.bestChannel ?? "없음"}` : ""}

이 데이터를 참고해 이번 주 콘텐츠 초안을 만들어줘. 아래 JSON 배열 형식으로만 답해:
[{ "platform": "블로그", "title": "제목", "draft": "본문" }, { "platform": "인스타그램", "title": "주제", "draft": "캡션+해시태그" }]`,
        },
      ],
    });
    const text = msg.content[0]?.type === "text" ? msg.content[0].text : "";
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const body = fenced ? fenced[1] : text;
    const s = body.indexOf("[");
    const e = body.lastIndexOf("]");
    if (s === -1 || e === -1) throw new Error("JSON 배열 파싱 실패");
    const parsed = JSON.parse(body.slice(s, e + 1));
    return { isAI: true, ideas: parsed };
  } catch (err) {
    console.error("[루나] 콘텐츠 생성 실패, 템플릿으로 전환:", err instanceof Error ? err.message : err);
    return { isAI: false, ideas: fallbackIdeas(context, funnel) };
  }
}
