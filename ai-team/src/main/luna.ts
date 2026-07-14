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

// AI 없이도 매번 똑같은 문구가 나오지 않도록, 그날그날 데이터 신호(재등록/신규/미수금/채널 효율) 중
// 가장 도드라진 걸 골라 주제를 정하고 실제 숫자를 문장에 끼워 넣는다.
function pickBlogAngle(c: GymContext, funnel?: FunnelResult): { title: string; draft: string } {
  const best = funnel?.bestChannel;
  const worst = funnel?.worstChannel;

  if (c.money.reRegisterCount >= c.money.newCount && c.money.reRegisterCount > 0) {
    return {
      title: "재등록 회원님이 많은 이유, 자이언트짐이 답합니다",
      draft: `안녕하세요, 자이언트짐입니다! 이번 달에는 ${c.money.reRegisterCount}분의 회원님이 재등록을 결정해주셨어요.\n\n한 번의 경험으로 끝나지 않고 다시 찾아주신다는 건 그만큼 운동 효과와 만족도가 확실하다는 뜻이겠죠. 재등록 회원님들이 공통적으로 꼽는 이유는 "꾸준히 봐주는 트레이너"와 "부담 없는 분위기"였어요.\n\n[여기에 재등록 회원 인터뷰/변화 사진 추가]\n\n아직 고민 중이시라면, 지금 상담 예약하고 직접 느껴보세요!`,
    };
  }

  if (c.money.newCount > 0) {
    return {
      title: `이번 달 신규 회원 ${c.money.newCount}명이 자이언트짐을 선택한 이유`,
      draft: `안녕하세요, 자이언트짐입니다! 이번 달 ${c.money.newCount}분의 신규 회원님이 함께해주셨어요.${
        best ? ` 특히 ${best}을(를) 통해 많이 찾아주셨는데요,` : ""
      } 처음 시작하는 게 가장 어렵다는 걸 잘 알기에, 첫 상담부터 운동 루틴 설계까지 하나하나 함께합니다.\n\n[여기에 신규 회원 후기/시설 사진 추가]\n\n운동을 망설이고 계셨다면 지금이 시작하기 가장 좋은 타이밍이에요. 상담 예약은 아래 링크에서!`,
    };
  }

  if (worst) {
    return {
      title: "자이언트짐이 자주 받는 질문 모음",
      draft: `안녕하세요, 자이언트짐입니다! 상담을 앞두고 궁금한 점이 많으실 텐데요, 자주 받는 질문들을 모아봤어요.\n\nQ. PT는 얼마나 자주 받아야 하나요?\nQ. 운동복/샤워시설이 있나요?\nQ. 초보자도 괜찮을까요?\n\n[여기에 답변 및 시설 사진 추가]\n\n더 궁금한 점은 편하게 상담 예약으로 물어봐주세요!`,
    };
  }

  return {
    title: "이번 달 자이언트짐 회원님들의 변화 이야기",
    draft: `안녕하세요, 자이언트짐입니다! 이번 달에도 많은 회원님들이 열심히 운동해주셨어요. 꾸준함이 가장 큰 무기라는 걸 다시 느끼는 요즘입니다.\n\n[여기에 회원 후기/변화 사진 추가]\n\n지금 상담 예약하고 나만의 운동 루틴을 시작해보세요!`,
  };
}

const WORKOUT_TIPS = [
  "운동 전 5분 스트레칭만으로도 부상 위험이 크게 줄어들어요.",
  "근력 운동은 같은 부위를 이틀 연속 하지 않는 게 회복에 좋아요.",
  "물은 운동 중에도 조금씩 자주 마시는 게 컨디션 유지에 도움돼요.",
  "운동 후 30분 내 단백질 섭취가 근육 회복 속도를 높여줘요.",
  "숙면이 곧 근성장 — 하루 7시간 수면도 운동의 일부예요.",
];

function pickInstagramCaption(c: GymContext, funnel?: FunnelResult): { title: string; draft: string } {
  const best = funnel?.bestChannel;
  const dayIdx = new Date().getDate() % WORKOUT_TIPS.length;
  const tip = WORKOUT_TIPS[dayIdx];

  if (best) {
    return {
      title: `${best} 채널 유입 회원 후기 강조`,
      draft: `💪 자이언트짐에서 오늘도 구슬땀!\n\n요즘 ${best}(으)로 많이 찾아주고 계세요 — 다녀가신 분들 후기, 궁금하지 않으세요?\n\n지금 프로필 링크로 상담 예약하고 직접 확인해보세요!\n\n#자이언트짐 #PT #헬스 #운동스타그램 #오늘도운동`,
    };
  }

  return {
    title: "이번 주 운동 꿀팁 카드뉴스",
    draft: `💪 오늘의 운동 꿀팁\n\n${tip}\n\n작은 습관이 큰 변화를 만듭니다. 이번 주도 자이언트짐과 함께해요!\n\n#자이언트짐 #PT #헬스 #운동스타그램 #오늘도운동`,
  };
}

function fallbackIdeas(c: GymContext, funnel?: FunnelResult): ContentIdea[] {
  const blog = pickBlogAngle(c, funnel);
  const insta = pickInstagramCaption(c, funnel);
  return [
    { platform: "블로그", title: blog.title, draft: blog.draft },
    { platform: "인스타그램", title: insta.title, draft: insta.draft },
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
