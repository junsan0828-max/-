import "dotenv/config";
import Anthropic from "@anthropic-ai/sdk";
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

export interface NaverPost {
  title: string;
  /** 본문 (소제목 포함, 문단 사이에 [이미지: 설명] 마커로 이미지 위치 표시) */
  body: string;
  /** 네이버 태그 (# 없이 단어만) */
  tags: string[];
  /** 나중에 이미지 자동 생성용 프롬프트 (v2에서 사용) */
  imagePrompts: string[];
}

const MODEL = process.env.NAVER_MODEL || "claude-sonnet-4-6";

const SYSTEM_PROMPT = `당신은 네이버 블로그 상위노출 경험이 많은 한국어 콘텐츠 작가입니다.
네이버 블로그 검색 로직(C-Rank, D.I.A.)에 맞춰, 사람이 직접 쓴 것처럼 자연스럽고
정보성이 높은 글을 씁니다. 다음 원칙을 지키세요.

- 제목: 핵심 키워드를 앞쪽에 넣되 클릭하고 싶게. 32자 내외.
- 본문: 1,000~1,700자. 도입(공감/문제제기) → 본문(소제목 2~4개로 구분) → 마무리(요약/행동유도).
- 소제목은 짧게, 문단은 2~4줄로 끊어 모바일 가독성 확보.
- 광고 티가 심하지 않게, 정보/경험 중심으로.
- 문단 사이 이미지가 들어가면 좋은 위치에 정확히 [이미지: 무엇을 보여줄지 한글 설명] 형태의 마커를 넣으세요 (2~4개).
- 과장·허위·의료効능 단정 표현 금지.`;

function buildUserPrompt(topic: string, extra?: string) {
  return `아래 주제로 네이버 블로그 글을 작성하세요.

주제/키워드: ${topic}
${extra ? `추가 요청사항: ${extra}\n` : ""}
반드시 아래 JSON 형식으로만 응답하세요. 다른 설명은 붙이지 마세요.

{
  "title": "글 제목",
  "body": "본문 전체 텍스트. 소제목과 [이미지: 설명] 마커 포함. 줄바꿈은 \\n 사용.",
  "tags": ["태그1", "태그2", "..."],
  "imagePrompts": ["본문 [이미지] 마커에 대응하는 영어 이미지 생성 프롬프트", "..."]
}`;
}

function extractJson(text: string): NaverPost {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) {
    throw new Error("Claude 응답에서 JSON을 찾지 못했습니다:\n" + text);
  }
  const parsed = JSON.parse(text.slice(start, end + 1));
  return {
    title: String(parsed.title ?? "").trim(),
    body: String(parsed.body ?? "").trim(),
    tags: Array.isArray(parsed.tags) ? parsed.tags.map(String) : [],
    imagePrompts: Array.isArray(parsed.imagePrompts) ? parsed.imagePrompts.map(String) : [],
  };
}

export async function generateNaverPost(topic: string, extra?: string): Promise<NaverPost> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY 가 없습니다. naver-auto/.env 에 넣어주세요.");
  }

  const client = new Anthropic({ apiKey });
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 3000,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: buildUserPrompt(topic, extra) }],
  });

  const text = message.content[0]?.type === "text" ? message.content[0].text : "";
  return extractJson(text);
}

/** 생성 결과를 output 폴더에 사람이 읽기 좋은 형태로 저장하고 경로를 반환 */
export function savePost(post: NaverPost): string {
  const outDir = new URL("../output/", import.meta.url);
  mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const path = new URL(`${stamp}.md`, outDir);

  const md = [
    `# ${post.title}`,
    ``,
    post.body,
    ``,
    `---`,
    `태그: ${post.tags.map((t) => "#" + t).join(" ")}`,
    ``,
    `이미지 프롬프트:`,
    ...post.imagePrompts.map((p, i) => `${i + 1}. ${p}`),
  ].join("\n");

  writeFileSync(path, md, "utf-8");
  return fileURLToPath(path);
}

// 단독 실행: npm run generate -- "주제"
const isMain = process.argv[1] && import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  const topic = process.argv.slice(2).join(" ").trim();
  if (!topic) {
    console.error('사용법: npm run generate -- "글 주제/키워드"');
    process.exit(1);
  }
  console.log(`✍️  "${topic}" 주제로 글 생성 중... (모델: ${MODEL})`);
  generateNaverPost(topic)
    .then((post) => {
      const path = savePost(post);
      console.log(`\n✅ 제목: ${post.title}`);
      console.log(`📄 저장됨: ${path}`);
      console.log(`🏷️  태그: ${post.tags.join(", ")}`);
    })
    .catch((err) => {
      console.error("❌ 실패:", err.message);
      process.exit(1);
    });
}
