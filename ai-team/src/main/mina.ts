// 회원관리 AI "미나" — 제이가 찾아낸 대상 회원에게 보낼 문자 초안을 만든다.
// 실제 발송은 하지 않는다 (반자동): 사람이 복사해서 문자/카톡으로 직접 보낸다.
import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { GymContext } from "./data";

export type MessageCategory = "만료임박" | "이탈위험" | "미수금";
export interface MemberMessage {
  name: string;
  phone: string | null;
  category: MessageCategory;
  message: string;
}

const MODEL = process.env.AI_TEAM_MODEL || "claude-sonnet-4-6";

function loadTeam() {
  return JSON.parse(readFileSync(join(__dirname, "..", "..", "config", "team.json"), "utf-8"));
}

function templateMessage(name: string, category: MessageCategory, extra?: string): string {
  switch (category) {
    case "만료임박":
      return `안녕하세요 ${name}님! 자이언트짐입니다 😊 회원권 만료가 얼마 남지 않아 안내드려요. 재등록 시 혜택 준비되어 있으니 편하실 때 연락 부탁드립니다!`;
    case "이탈위험":
      return `${name}님, 그동안 뵙지 못해 아쉬웠어요! 자이언트짐에서 다시 함께 운동해요 💪 복귀 회원님을 위한 혜택이 있으니 편하게 연락 주세요.`;
    case "미수금":
      return `안녕하세요 ${name}님, 자이언트짐입니다. 결제 확인 부탁드립니다 (${extra ?? "미수금 확인 필요"}). 편하신 시간에 연락 주시면 빠르게 도와드리겠습니다. 감사합니다!`;
  }
}

function fallbackMessages(c: GymContext): MemberMessage[] {
  const out: MemberMessage[] = [];
  for (const m of c.members.expiringSoon)
    out.push({ name: m.name, phone: m.phone, category: "만료임박", message: templateMessage(m.name, "만료임박") });
  for (const m of c.members.recentlyExpired)
    out.push({ name: m.name, phone: m.phone, category: "이탈위험", message: templateMessage(m.name, "이탈위험") });
  for (const m of c.money.unpaidMembers)
    out.push({
      name: m.name,
      phone: m.phone,
      category: "미수금",
      message: templateMessage(m.name, "미수금", `${m.unpaid.toLocaleString()}원`),
    });
  return out;
}

export interface MinaResult {
  isAI: boolean;
  messages: MemberMessage[];
}

export async function generateMemberMessages(context: GymContext): Promise<MinaResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const targets = [
    ...context.members.expiringSoon.map((m) => ({ name: m.name, phone: m.phone, category: "만료임박" as const })),
    ...context.members.recentlyExpired.map((m) => ({ name: m.name, phone: m.phone, category: "이탈위험" as const })),
    ...context.money.unpaidMembers.map((m) => ({
      name: m.name,
      phone: m.phone,
      category: "미수금" as const,
      unpaid: m.unpaid,
    })),
  ];

  if (targets.length === 0) return { isAI: !!apiKey, messages: [] };
  if (!apiKey) return { isAI: false, messages: fallbackMessages(context) };

  const team = loadTeam();
  const mina = team.team.find((t: any) => t.id === "mina");

  try {
    const client = new Anthropic({ apiKey });
    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: 4000,
      system: `${mina?.persona ?? "너는 자이언트짐 회원관리 담당 AI 미나다."}
각 회원에게 보낼 짧은 문자를 카카오톡/SMS 톤으로 자연스럽게 쓴다. 이모지는 0~2개만. 과하게 영업스럽지 않게, 부담 주지 않는 톤으로.
반드시 다른 설명 없이 JSON 배열 하나만 출력한다. 코드블록으로 감싸지 않는다.`,
      messages: [
        {
          role: "user",
          content: `아래 회원 목록마다 상황(category)에 맞는 개별 문자를 하나씩 작성해줘.
- 만료임박: 회원권 만료 임박, 재등록 유도, 부담 없는 톤
- 이탈위험: 최근 만료됨, 복귀 유도
- 미수금: 정중한 결제 확인 안내 (금액 자연스럽게 포함)

회원 목록:
${JSON.stringify(targets, null, 0)}

아래 JSON 배열 형식으로만 답해:
[{ "name": "이름", "phone": "전화번호 또는 null", "category": "만료임박|이탈위험|미수금", "message": "문자 내용" }]`,
        },
      ],
    });
    const text = msg.content[0]?.type === "text" ? msg.content[0].text : "";
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const body = fenced ? fenced[1] : text;
    const s = body.indexOf("[");
    const e = body.lastIndexOf("]");
    if (s === -1 || e === -1) throw new Error("JSON 배열 파싱 실패: [ ] 를 찾지 못함");
    const parsed = JSON.parse(body.slice(s, e + 1));
    return { isAI: true, messages: parsed };
  } catch (err) {
    console.error("[미나] 문자 초안 생성 실패, 템플릿으로 전환:", err instanceof Error ? err.message : err);
    return { isAI: false, messages: fallbackMessages(context) };
  }
}
