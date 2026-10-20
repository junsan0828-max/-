// 블로그 글에 들어갈 이미지 준비.
//  - 설명 카드 3장(짙은 블루)을 ffmpeg로 만든다 → "AI 제작 이미지"로 표시해야 한다.
//  - 센터 사진은 '모자이크가 끝난 승인 사진 폴더'에서만 고른다 (회원 얼굴이 노출되지 않게).
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DRAFT_DIR } from "./paperBlog";

export const PHOTO_DIR = process.env.BLOG_PHOTO_DIR || join(DRAFT_DIR, "사진");
const NAVY = "0x0B2C7A";
const LIGHT = "0xBBD6FF";
const FONT_SRC = "C:/Windows/Fonts/malgunbd.ttf";

export interface CardData {
  overview: { title?: string; rows: [string, string][]; source?: string };
  evidence: { title?: string; left: { head: string; lines: string[] }; right: { head: string; lines: string[] } };
}

export interface PhotoPick {
  file: string; // 절대 경로
  scene: string;
  key?: string; // 사용 기록(used.json)에 남길 승인 사진 이름 (원본을 쓸 때 file 이름과 달라진다)
}

/** 본문에서 '카드 데이터' JSON 블록을 읽는다. */
export function parseCardData(md: string): CardData {
  const sec = md.split(/##\s*카드 데이터/)[1];
  if (!sec) throw new Error("초안에 '카드 데이터' 섹션이 없습니다. 초안을 다시 만들어 주세요.");
  const m = sec.match(/```(?:json)?\s*([\s\S]*?)```/) ?? sec.match(/(\{[\s\S]*\})/);
  if (!m) throw new Error("카드 데이터 JSON을 읽지 못했습니다.");
  return JSON.parse(m[1]);
}

function ffmpeg(args: string[], cwd: string) {
  const r = spawnSync("ffmpeg", args, { cwd, encoding: "utf-8", windowsHide: true });
  if (r.status !== 0) throw new Error(`ffmpeg 실패: ${(r.stderr || r.error?.message || "").slice(-300)}`);
}

function fit(text: string, max: number, base: number): number {
  // 글자가 길면 글씨 크기를 줄여 박스를 넘지 않게 한다.
  return text.length <= max ? base : Math.max(26, Math.floor(base * (max / text.length)));
}

class Filter {
  parts: string[] = [];
  private n = 0;
  constructor(private dir: string) {}
  box(x: number, y: number, w: number, h: number, color: string) {
    this.parts.push(`drawbox=x=${x}:y=${y}:w=${w}:h=${h}:color=${color}:t=fill`);
  }
  text(t: string, color: string, size: number, x: number | string, y: number) {
    const f = `t${++this.n}.txt`;
    writeFileSync(join(this.dir, f), t, "utf-8");
    this.parts.push(`drawtext=textfile=${f}:fontfile=f.ttf:fontcolor=${color}:fontsize=${size}:x=${x}:y=${y}`);
  }
  toString() {
    return this.parts.join(",");
  }
}

export interface CenterCardInfo {
  centerName: string;
  steps: string[]; // 정확히 5개
}

export function renderCards(card: CardData, outDir: string, center: CenterCardInfo): { overview: string; evidence: string; steps: string } {
  mkdirSync(outDir, { recursive: true });
  const work = join(tmpdir(), "ai-team-cards");
  mkdirSync(work, { recursive: true });
  copyFileSync(FONT_SRC, join(work, "f.ttf"));
  const CENTER = "(w-text_w)/2";
  const base = (f: Filter) => f.box(0, 0, 1000, 14, "0x8DBBFF");
  const run = (f: Filter, out: string) =>
    ffmpeg(["-v", "error", "-y", "-f", "lavfi", "-i", `color=c=${NAVY}:s=1000x1000:d=1`, "-vf", f.toString(), "-frames:v", "1", out], work);

  // 카드 A: 논문 한눈에 보기
  const a = new Filter(work);
  base(a);
  a.text(card.overview.title ?? "이 논문, 한눈에 보기", "white", 60, CENTER, 70);
  card.overview.rows.slice(0, 4).forEach(([k, v], i) => {
    const y = 210 + i * 165;
    a.box(70, y, 860, 135, "0x16399A");
    a.text(k, LIGHT, 32, 100, y + 18);
    a.text(v, "white", fit(v, 21, 44), 100, y + 66);
  });
  if (card.overview.source) a.text(card.overview.source.slice(0, 70), LIGHT, 26, CENTER, 925);
  const overview = join(outDir, "card_A_overview.png");
  run(a, overview);

  // 카드 B: 확실한 것 / 불확실한 것
  const b = new Filter(work);
  base(b);
  b.text(card.evidence.title ?? "무엇이 확실하고, 무엇이 불확실할까", "white", 50, CENTER, 70);
  b.box(50, 190, 430, 720, "white");
  b.box(520, 190, 430, 720, "white");
  b.text(card.evidence.left.head, NAVY, 46, 80, 225);
  b.text(card.evidence.right.head, "0x8A3B12", 46, 550, 225);
  for (let i = 0; i < 5; i++) {
    const l = card.evidence.left.lines[i];
    const r = card.evidence.right.lines[i];
    if (l) b.text(l, "0x222222", fit(l, 11, 40), 80, 330 + i * 85);
    if (r) b.text(r, "0x222222", fit(r, 11, 40), 550, 330 + i * 85);
  }
  const evidence = join(outDir, "card_B_evidence.png");
  run(b, evidence);

  // 카드 C: 센터 방식 5단계 (고정)
  const c = new Filter(work);
  base(c);
  c.text(`${center.centerName} 트레이닝 5단계`, "white", 58, CENTER, 60);
  center.steps.slice(0, 5).forEach((s, i) => {
    const y = 170 + i * 140;
    c.box(70, y, 860, 110, "white");
    c.box(70, y, 110, 110, "0x8DBBFF");
    c.text(String(i + 1), NAVY, 64, 112, y + 20);
    c.text(s, NAVY, 48, 215, y + 30);
  });
  c.text("검사 결과에 맞춰 순서를 설계합니다", LIGHT, 34, CENTER, 900);
  const steps = join(outDir, "card_C_steps.png");
  run(c, steps);

  return { overview, evidence, steps };
}

/** 승인된 사진 중 가장 오래전에 쓴(안 쓴) 것부터 n장을 고른다. 직전 글과는 사진이 겹치지 않는다. 사용 기록은 글 입력이 성공한 뒤 markPhotosUsed 로 남긴다. */
export function pickPhotos(n = 3): PhotoPick[] {
  const lib: Record<string, { scene: string }> = JSON.parse(readFileSync(join(PHOTO_DIR, "library.json"), "utf-8"));
  const usedPath = join(PHOTO_DIR, "used.json");
  const used: Record<string, number> = existsSync(usedPath) ? JSON.parse(readFileSync(usedPath, "utf-8")) : {};

  // 대표가 에디터에서 직접 모자이크하겠다고 한 경우(2026-10-20): 승인 사진 대신 '모자이크 전 원본'을 올린다.
  // 이 경우 회원 얼굴이 가려지지 않은 채 에디터에 올라가므로, 대표가 에디터에서 모든 얼굴을 가린 뒤에만 발행해야 한다.
  const useOriginals = process.env.BLOG_USE_ORIGINALS === "1";
  const originals: Record<string, string> = useOriginals && existsSync(join(PHOTO_DIR, "originals.json"))
    ? JSON.parse(readFileSync(join(PHOTO_DIR, "originals.json"), "utf-8"))
    : {};
  const origDir = join(PHOTO_DIR, "..", "사진_원본");
  const files = Object.keys(lib).filter((f) => existsSync(join(PHOTO_DIR, f)) && (!useOriginals || (originals[f] && existsSync(join(origDir, originals[f])))));
  if (files.length < n) throw new Error(`${useOriginals ? "원본이 연결된 " : "승인된 "}사진이 ${files.length}장뿐입니다 (필요 ${n}장). ${useOriginals ? "'사진/originals.json'에 원본 파일을 연결해 주세요." : "'사진' 폴더에 모자이크가 끝난 사진을 더 넣어 주세요."}`);
  const shuffled = files.map((f) => ({ f, r: Math.random() })).sort((a, b) => (used[a.f] ?? 0) - (used[b.f] ?? 0) || a.r - b.r);
  const picks = shuffled.slice(0, n).map((x) => x.f);
  if (!useOriginals) return picks.map((f) => ({ file: join(PHOTO_DIR, f), scene: lib[f].scene }));

  // 에디터가 파일명으로 이미지를 찾으므로 영문 이름의 임시 복사본을 만든다. 다시 인코딩해서 위치·기기 정보(EXIF)는 지운다.
  const outDir = join(tmpdir(), "ai-team-blog-originals");
  mkdirSync(outDir, { recursive: true });
  const py = process.env.BLOG_PYTHON || join(__dirname, "..", "..", "tools", ".venv", "Scripts", "python.exe");
  return picks.map((f) => {
    const out = join(outDir, `orig_${f.replace(/\.[^.]+$/, "")}.jpg`);
    const code = "import sys,cv2,numpy as np\nim=cv2.imdecode(np.fromfile(sys.argv[1],np.uint8),cv2.IMREAD_COLOR)\nassert im is not None\ncv2.imencode('.jpg',im,[cv2.IMWRITE_JPEG_QUALITY,92])[1].tofile(sys.argv[2])";
    const r = spawnSync(py, ["-I", "-c", code, join(origDir, originals[f]), out], { encoding: "utf-8", timeout: 60000 });
    if (r.status !== 0 || !existsSync(out)) throw new Error(`원본 복사본을 만들지 못했습니다(${f}): ${r.stderr || r.error}`);
    return { file: out, scene: lib[f].scene, key: f };
  });
}

/** 이번 글에 실제로 쓴 사진을 기록한다 (실패한 시도가 순번을 소모하지 않도록 성공 후에만 호출). */
export function markPhotosUsed(picks: PhotoPick[]): void {
  const usedPath = join(PHOTO_DIR, "used.json");
  const used: Record<string, number> = existsSync(usedPath) ? JSON.parse(readFileSync(usedPath, "utf-8")) : {};
  const now = Date.now();
  for (const p of picks) used[p.key ?? p.file.replace(/^.*[\\/]/, "")] = now;
  writeFileSync(usedPath, JSON.stringify(used, null, 1), "utf-8");
}
