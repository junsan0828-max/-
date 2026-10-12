// 논문 리뷰 블로그 (루나 업무)
//  1) 주제로 논문 후보 찾기   : Europe PMC 공개 API (자동 접속이 허용된 곳)
//  2) 논문 본문 읽기          : Europe PMC 본문(XML) 또는 대표님이 준 PDF
//  3) 글 초안 작성            : Claude Code(구독)로 작성, 검증 메모 포함
// 에디터 입력/발행은 하지 않는다. 최종 발행은 항상 대표님이 한다.
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { askClaudeCode } from "./claudeCli";

const EPMC = "https://www.ebi.ac.uk/europepmc/webservices/rest";
export const DRAFT_DIR = process.env.BLOG_DRAFT_DIR || "C:/Users/junsa/OneDrive/바탕 화면/블로그 초안";

export interface PaperCandidate {
  title: string;
  authors: string;
  journal: string;
  year: string;
  pmid?: string;
  pmcid?: string;
  doi?: string;
  cited: number;
  openAccess: boolean;
}

async function getJson(url: string): Promise<any> {
  const res = await fetch(url, { headers: { "User-Agent": "ai-team-luna/1.0 (gym content research)" } });
  if (!res.ok) throw new Error(`Europe PMC ${res.status}`);
  return res.json();
}

function toCandidate(r: any): PaperCandidate {
  return {
    title: String(r.title ?? "").replace(/<[^>]+>/g, ""),
    authors: r.authorString ?? "",
    journal: r.journalTitle ?? "",
    year: String(r.pubYear ?? ""),
    pmid: r.pmid,
    pmcid: r.pmcid,
    doi: r.doi,
    cited: Number(r.citedByCount ?? 0),
    openAccess: r.isOpenAccess === "Y",
  };
}

/** 한국어 주제를 핵심 영어 개념 2~3개로 바꾼다 (구독으로 짧게 호출). 실패하면 원문 하나만 쓴다. */
async function toConcepts(topic: string): Promise<string[]> {
  if (/^[\x00-\x7F]+$/.test(topic)) return topic.split(/[;,]/).map((s) => s.trim()).filter(Boolean);
  try {
    const out = await askClaudeCode({
      system: "너는 의학 문헌 검색어 번역기다. 입력 주제에서 논문 제목/초록에 꼭 들어갈 핵심 개념 2~3개를 영어 구(phrase)로 뽑아 세미콜론(;)으로 구분해 한 줄로만 출력한다. 예: core stability exercise; low back pain. 설명 금지.",
      prompt: topic,
      timeoutMs: 60000,
    });
    const parts = out.split("\n")[0].replace(/["`]/g, "").split(";").map((s) => s.trim()).filter(Boolean);
    return parts.length ? parts.slice(0, 3) : [topic];
  } catch {
    return [topic];
  }
}

/** 주제로 후보 찾기: 최근 5년, 제목에 체계적 문헌고찰/메타분석, 무료 본문(오픈액세스), 개념 AND 일치. */
export async function findPaperCandidates(topic: string, limit = 5): Promise<{ query: string; items: PaperCandidate[] }> {
  const concepts = await toConcepts(topic);
  const year = new Date().getFullYear();
  const design = `TITLE:("systematic review" OR "meta-analysis" OR "meta analysis")`;
  const base = `(PUB_YEAR:[${year - 5} TO ${year}]) AND (OPEN_ACCESS:y) AND (SRC:MED) AND ${design}`;
  // 모든 개념을 요구한다. 개념마다 단어 단위로 매칭해 너무 엄격하지 않게 하되, 개념을 임의로 빼지는 않는다
  // (빼면 주제에서 벗어난 논문이 나온다). 결과가 없으면 빈 목록을 돌려주고 사람이 주제를 바꾸게 한다.
  const conceptQ = concepts.map((c) => `TITLE_ABS:(${c.split(/\s+/).filter(Boolean).join(" AND ")})`).join(" AND ");
  const q = `${conceptQ} AND ${base}`;
  const data = await getJson(`${EPMC}/search?query=${encodeURIComponent(q)}&format=json&resultType=lite&pageSize=${limit * 2}`);
  const items = ((data.resultList?.result as any[]) ?? []).map(toCandidate).filter((c) => c.pmcid).slice(0, limit);
  return { query: concepts.join(" + "), items };
}

/** PMID/DOI/PMCID 중 하나로 PMCID를 찾는다. */
export async function resolvePmcid(ref: { pmcid?: string; pmid?: string; doi?: string }): Promise<string> {
  if (ref.pmcid) return ref.pmcid.toUpperCase().startsWith("PMC") ? ref.pmcid.toUpperCase() : `PMC${ref.pmcid}`;
  const q = ref.pmid ? `EXT_ID:${ref.pmid} AND SRC:MED` : `DOI:"${ref.doi}"`;
  const data = await getJson(`${EPMC}/search?query=${encodeURIComponent(q)}&format=json&resultType=lite`);
  const r = data.resultList?.result?.[0];
  if (!r?.pmcid) throw new Error("무료 본문(PMC)이 없는 논문입니다. PDF를 직접 주세요 (--pdf).");
  return r.pmcid;
}

export async function fetchFullText(pmcid: string): Promise<{ text: string; meta: string }> {
  const res = await fetch(`${EPMC}/${pmcid}/fullTextXML`, { headers: { "User-Agent": "ai-team-luna/1.0" } });
  if (!res.ok) throw new Error(`본문을 가져오지 못했습니다 (${res.status}). PDF를 직접 주세요.`);
  const xml = await res.text();
  const text = xml
    .replace(/<ref-list[\s\S]*?<\/ref-list>/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
  return { text: text.slice(0, 110000), meta: `${pmcid} (Europe PMC 본문 ${text.length.toLocaleString()}자 중 ${Math.min(text.length, 110000).toLocaleString()}자 사용)` };
}

const SYSTEM = `너는 자이언트짐(맞춤운동센터, 시흥시 정왕동)의 마케팅 AI 루나다. 대표 이준산 이름의 개인 블로그에 올릴 "논문 리뷰" 글 초안을 쓴다.
센터 방식(대표가 알려준 사실만 사용): 체성분 분석과 체형분석기로 체형 분석 → 가동성·안정성 확인 → 기능 회복 운동 → 바른 움직임 연습 → 웨이트트레이닝 추가. 이 외의 센터 사실을 지어내지 않는다.

[반드시 지킬 규칙]
1. 논문 본문에서 직접 확인한 사실과 숫자만 쓴다. 본문에 없으면 쓰지 않는다. 숫자가 서로 모순되거나 불확실하면 숫자를 쓰지 않고 검증 메모에 적는다.
2. 한계(이질성, 추적 기간, 표본, 출판 편향 등)를 반드시 본문에 쓴다.
3. 이 논문이 센터의 진행 순서를 증명했다고 쓰지 않는다. "논문은 방향성의 근거, 구체적 설계는 현장 검사 결과에 맞춘다"로 구분한다.
4. 치료·완치·효과 단정, 의료행위로 읽히는 표현, 회원 후기·전후 사진 언급을 쓰지 않는다. "~로 보고되었다" 형태를 쓴다.
5. 글은 대표 1인칭이며 첫 문장에서 "자이언트짐 대표 이준산"을 밝힌다. 마지막에 AI 활용 문구와 안내 문구를 넣는다.
6. 제목 앞에 [정왕동헬스장] 또는 [정왕동피티]를 붙이고, 키워드(정왕동피티, 정왕동헬스장, 정왕동자세교정피티)는 자연스럽게만 쓴다.
7. 본문은 1,500~2,000자, 소제목은 한 줄 문장으로 쓴다. 마크다운 기호(#, **, -)는 본문에 쓰지 않고 목록은 "• " 또는 "1. "만 쓴다.
8. 본문은 아래 순서로 쓴다. 소제목은 독자에게 묻는 한 줄 문장이다(예: "어떤 논문인가요?").
   ① 도입: "안녕하세요. 시흥 정왕동 맞춤운동센터 자이언트짐 대표 이준산입니다."로 시작하고, 회원들이 자주 묻는 질문을 한두 문장으로 던진 뒤 "근거를 직접 읽고 정리했다"고 잇는다.
   ② 어떤 논문인가요: 학술지·연도·연구 방법(체계적 문헌고찰/메타분석이 무엇인지 한 문장으로 쉽게), 대상, 규모(편수·인원), 포함된 운동.
   ③ 어떤 결과가 나왔나요: "~로 보고했다" 형태. 운동 종류 간 차이가 통계적으로 유의하지 않으면 "어느 운동이 더 낫다"고 쓰지 않는다.
   ④ 읽을 때 함께 볼 한계: 논문이 스스로 밝힌 한계 + 본문에서 확인한 한계를 • 목록으로. 이어서 한 줄 요약("근거가 있는 것 / 아직 확실하지 않은 것").
   ⑤ 센터에서는 이렇게 합니다: 센터 방식 5단계를 1. ~ 5. 번호 목록으로. 뒤이어 "이 순서를 이 논문이 증명한 것은 아니다, 논문은 방향성의 근거, 설계는 검사 결과에 맞춘다"를 분명히 쓴다.
   ⑥ 마무리: 앞으로도 논문을 읽고 한계까지 정리해 올리겠다는 약속(근거가 약한 부분은 약하다고 말한다), 문의 안내.
   ⑦ 맨 끝 고정 블록(그대로 쓴다):
   • 맞춤운동센터 자이언트짐 (시흥시 함송로29번길 5, 바른정형외과 2층)
   • 문의: 0507-1482-3349
   출처: (저자, 제목, 학술지, 연도;권:쪽, doi — 검증 메모의 서지와 동일)
   ※ 이 글은 일반적인 정보 제공이 목적이며 진단이나 치료를 대신하지 않습니다. 통증이 있거나 질환이 의심되면 의료기관의 진료를 받으세요.
   ※ 이 글의 초안은 AI(루나)의 도움을 받아 작성했고, 논문 내용은 대표가 확인했습니다.
9. 어려운 용어(이질성, 메타분석, 무작위 대조 시험 등)는 처음 나올 때 괄호나 한 문장으로 쉽게 풀어 쓴다. 숫자는 본문 표기 그대로, 근거가 되는 문장과 같이 쓴다.
10. 글 전체 말투는 존댓말(~입니다/~해요 혼용 가능), 과장·광고 문구·느낌표 남발을 쓰지 않는다. 센터 홍보는 ⑤와 ⑦에서만 한다.

[출력 형식 — 이대로만 출력]
# [검증 메모 — 게시 금지, 대표님 확인용]
(논문 서지, 확인한 사실, 본문에서 모순/불확실한 숫자, 읽지 못한 부분)

---

# (게시용 초안)

## 제목
(제목 한 줄)

## 본문
(본문)

## 카드 데이터
(설명 카드 2장에 들어갈 내용. 아래 JSON 형식 그대로, 코드블록 안에만 쓴다. 글자 수 제한을 지킨다.)
\`\`\`json
{
  "overview": {
    "title": "이 논문, 한눈에 보기",
    "rows": [["연구 종류", "20자 이내"], ["대상", "20자 이내"], ["규모", "20자 이내"], ["발표", "20자 이내"]],
    "source": "출처: 저자 외, 학술지 연도;권:번호 (60자 이내)"
  },
  "evidence": {
    "title": "무엇이 확실하고, 무엇이 불확실할까",
    "left": { "head": "근거가 있는 것", "lines": ["줄당 10자 이내", "최대 5줄"] },
    "right": { "head": "근거가 약한 것", "lines": ["줄당 10자 이내", "최대 5줄"] }
  }
}
\`\`\`

## 태그
(#태그 10개 안팎, 한 줄)`;

export interface ParsedDraft {
  title: string;
  lines: string[]; // 본문 줄 (빈 줄 = 문단 사이 간격)
  tags: string;
  md: string;
}

/** 초안 파일에서 제목/본문/태그를 읽는다. 본문의 마크다운 기호는 에디터용으로 정리한다. */
export function parseDraft(md: string): ParsedDraft {
  const post = md.includes("# (게시용 초안)") ? md.split("# (게시용 초안)")[1] : md;
  const title = post.match(/##\s*제목\s*\n+(.+)/)?.[1].trim();
  const bodyRaw = post.split(/##\s*본문/)[1]?.split(/\n##\s*(?:카드 데이터|태그|이미지)/)[0];
  const tags = post.split(/##\s*태그/)[1]?.trim().split("\n")[0].trim();
  if (!title || !bodyRaw || !tags) throw new Error("초안에서 제목/본문/태그를 찾지 못했습니다.");
  const raw = bodyRaw.replace(/\r/g, "").split("\n").map((l) => l.replace(/^#{1,6}\s*/, "").replace(/\*\*/g, "").replace(/^[-*]\s+/, "• ").trimEnd());
  const lines: string[] = [];
  let blank = false;
  for (const l of raw) {
    if (!l) { if (!blank && lines.length) lines.push(""); blank = true; } else { lines.push(l); blank = false; }
  }
  while (lines.length && !lines[lines.length - 1]) lines.pop();
  return { title, lines, tags, md };
}

/** 가장 최근에 만든 초안 파일 경로. */
export function latestDraftFile(): string {
  const { readdirSync, statSync } = require("node:fs") as typeof import("node:fs");
  const files = readdirSync(DRAFT_DIR)
    .filter((f) => /^\d{8}_.+\.md$/.test(f))
    .map((f) => ({ f, t: statSync(join(DRAFT_DIR, f)).mtimeMs }))
    .sort((a, b) => b.t - a.t);
  if (!files.length) throw new Error("초안 파일이 없습니다. 먼저 논문으로 초안을 만들어 주세요.");
  return join(DRAFT_DIR, files[0].f);
}

function slug(s: string): string {
  return s.replace(/[^\w가-힣]+/g, "_").slice(0, 40).replace(/^_+|_+$/g, "") || "paper";
}

export interface DraftResult {
  file: string;
  preview: string;
}

/** 본문 텍스트(또는 PDF 경로)로 초안을 만들어 파일로 저장한다. */
export async function draftFromPaper(src: { text?: string; meta?: string; pdf?: string }, label: string): Promise<DraftResult> {
  let prompt: string;
  let tools: string[] | undefined;
  let addDirs: string[] | undefined;
  if (src.pdf) {
    const p = resolve(src.pdf);
    if (!existsSync(p)) throw new Error(`PDF를 찾을 수 없습니다: ${p}`);
    prompt = `다음 PDF 논문을 Read 도구로 끝까지 읽고 규칙대로 글 초안을 써줘.\nPDF 경로: ${p}`;
    tools = ["Read"];
    addDirs = [dirname(p)];
  } else {
    prompt = `아래 논문 본문(${src.meta})을 읽고 규칙대로 글 초안을 써줘.\n\n=== 논문 본문 ===\n${src.text}`;
  }
  const out = await askClaudeCode({ system: SYSTEM, prompt, tools, addDirs, timeoutMs: 600000 });
  mkdirSync(DRAFT_DIR, { recursive: true });
  const d = new Date();
  const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const file = join(DRAFT_DIR, `${stamp}_${slug(label)}.md`);
  writeFileSync(file, out, "utf-8");
  return { file, preview: out.slice(0, 600) };
}
