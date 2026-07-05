// 영상 제목·설명·태그를 Claude로 자동 작성 (루나/제이와 같은 패턴: 키 없으면 템플릿 폴백).
import Anthropic from "@anthropic-ai/sdk";

const MODEL = process.env.AI_TEAM_MODEL || "claude-sonnet-4-6";

export interface VideoMetadata {
  title: string;
  description: string;
  tags: string[];
}

function fallbackMetadata(topicHint: string): VideoMetadata {
  return {
    title: `자이언트짐 - ${topicHint}`,
    description: `자이언트짐에서 준비한 영상입니다.\n\n${topicHint}\n\n#자이언트짐 #PT #헬스`,
    tags: ["자이언트짐", "PT", "헬스", "운동"],
  };
}

function extractJson(text: string): any {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1] : text;
  const s = body.indexOf("{");
  const e = body.lastIndexOf("}");
  if (s === -1 || e === -1) throw new Error("JSON 파싱 실패");
  return JSON.parse(body.slice(s, e + 1));
}

export async function generateVideoMetadata(topicHint: string): Promise<VideoMetadata> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return fallbackMetadata(topicHint);

  try {
    const client = new Anthropic({ apiKey });
    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: 600,
      system: `너는 자이언트짐(피트니스 센터) 유튜브 채널 담당자다. 검색에 잘 걸리면서도 자연스러운
제목·설명·태그를 만든다. 과장 없이, 클릭하고 싶게. 반드시 다른 설명 없이 JSON 객체 하나만 출력한다.`,
      messages: [
        {
          role: "user",
          content: `영상 주제/힌트: "${topicHint}"

아래 JSON 형식으로만 답해:
{ "title": "60자 이내 제목", "description": "3~5줄 설명 + 관련 해시태그 포함", "tags": ["태그1", "태그2", "..."] }`,
        },
      ],
    });
    const text = msg.content[0]?.type === "text" ? msg.content[0].text : "";
    const parsed = extractJson(text);
    return {
      title: String(parsed.title ?? topicHint).slice(0, 100),
      description: String(parsed.description ?? ""),
      tags: Array.isArray(parsed.tags) ? parsed.tags.map(String) : [],
    };
  } catch (err) {
    console.error("[유튜브] 메타데이터 생성 실패, 템플릿으로 전환:", err instanceof Error ? err.message : err);
    return fallbackMetadata(topicHint);
  }
}
