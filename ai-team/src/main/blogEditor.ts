// 네이버 블로그 에디터에 초안을 채운다 (대표님 PC의 별도 크롬 창에 붙어서 동작).
//
// 안전 규칙
//  - 로그인은 대표님이 직접 한다 (전용 프로필 chrome-ai-profile 에 로그인이 남아 있다). 비밀번호는 다루지 않는다.
//  - 제목/본문/이미지/사진 설명/AI 표시/링크/장소만 채운다. 발행·예약·저장 버튼은 절대 누르지 않는다 (최종 발행은 대표님).
//  - 보안 확인(캡차)·로그인 화면이 보이거나, 에디터에 이미 내용이 있으면 즉시 중단한다.
import { spawn } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { extname, join } from "node:path";
import { chromium, type Browser, type Frame, type Page } from "playwright";
import { latestDraftFile, parseDraft } from "./paperBlog";
import { loadBlogCenter } from "./blogCenter";
import { parseCardData, pickPhotos, markPhotosUsed, renderCards, PHOTO_DIR } from "./blogAssets";

// 다른 네이버 계정(2호점 등)은 크롬 창·프로필·포트를 따로 쓴다: BLOG_CHROME_PROFILE + BLOG_CDP_PORT (기본 9222).
const CDP_PORT = Number(process.env.BLOG_CDP_PORT) || 9222;
const CDP = `http://127.0.0.1:${CDP_PORT}`;
const CHROME = process.env.CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const PROFILE = process.env.BLOG_CHROME_PROFILE || join(homedir(), "chrome-ai-profile");
const WRITE_URL = "https://blog.naver.com/GoBlogWrite.naver";
const BODY_FONT_SIZE = process.env.BLOG_BODY_FONT_SIZE === undefined ? 16 : Number(process.env.BLOG_BODY_FONT_SIZE); // 네이버 기본 15보다 한 단계 크게. 끄려면 BLOG_BODY_FONT_SIZE=0

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const rnd = (a: number, b: number) => a + Math.floor(Math.random() * (b - a));
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

async function cdpUp(): Promise<boolean> {
  try {
    const r = await fetch(`${CDP}/json/version`, { signal: AbortSignal.timeout(2500) });
    return r.ok;
  } catch {
    return false;
  }
}

/** 전용 크롬 창이 안 떠 있으면 띄운다 (로그인은 프로필에 남아 있다). */
async function ensureBrowser(): Promise<void> {
  if (await cdpUp()) return;
  if (!existsSync(CHROME)) throw new Error(`크롬을 찾을 수 없습니다: ${CHROME}`);
  const child = spawn(CHROME, [`--remote-debugging-port=${CDP_PORT}`,`--user-data-dir=${PROFILE}`, "https://blog.naver.com/"], { detached: true, stdio: "ignore" });
  child.unref();
  for (let i = 0; i < 30; i++) {
    await sleep(1000);
    if (await cdpUp()) return;
  }
  throw new Error("전용 크롬 창에 연결하지 못했습니다. 바탕화면의 open-blog-editor.bat 을 실행해 주세요.");
}

export async function getEditor(browser: Browser): Promise<{ page: Page; f: Frame }> {
  // 이미 열려 있는 글쓰기 탭(작성 중인 다른 글일 수 있다)은 건드리지 않고, 항상 새 탭에서 새 글로 시작한다.
  const ctx = browser.contexts()[0];
  const page = await ctx.newPage();
  await page.goto(WRITE_URL, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.bringToFront().catch(() => {});
  for (let i = 0; i < 40; i++) {
    if (/nid\.naver\.com|login/i.test(page.url())) throw new Error("네이버 로그인이 풀려 있습니다. 전용 크롬 창에서 로그인한 뒤 다시 시켜 주세요.");
    for (const fr of page.frames()) {
      if (await fr.$(".se-documentTitle").catch(() => null)) return { page, f: fr };
    }
    // '작성 중인 글이 있습니다' 팝업은 새 글로 시작한다
    for (const fr of page.frames()) {
      const cancel = fr.locator('.se-popup-alert button:has-text("취소")').first();
      if (await cancel.count().catch(() => 0)) await cancel.click().catch(() => {});
    }
    await sleep(1000);
  }
  throw new Error("블로그 글쓰기 화면을 찾지 못했습니다.");
}

export interface FillResult {
  draftFile: string;
  title: string;
  images: number;
  places: number;
  notes: string[];
}

export class Editor {
  constructor(public page: Page, public f: Frame) {}
  paras() {
    return this.f.locator(".se-component.se-text:not(.se-documentTitle) .se-text-paragraph");
  }
  /** 마지막 본문 문단을 눌러 커서를 둔다. 선택 영역 레이어(.se-selection)가 클릭을 가로채면 강제로 누른다. */
  async focusLastPara() {
    const last = this.paras().last();
    try {
      await last.click({ timeout: 5000 });
    } catch {
      await last.click({ force: true });
    }
  }
  imgComp(base: string) {
    return this.f.locator(".se-component.se-image").filter({ has: this.f.locator(`img[src*="${base}"]`) }).first();
  }
  imageCount() {
    return this.f.locator(".se-component.se-image").count();
  }
  guard() {
    const u = this.page.url();
    if (/nid\.naver\.com|login/i.test(u)) throw new Error("로그인 화면으로 이동했습니다. 중단합니다.");
  }
  /**
   * 새 글 시작 준비.
   *  - '작성 중인 글이 있습니다' 팝업은 새 글로 시작한다(취소).
   *  - 새 탭 본문에 에디터가 남기는 잔여 글자('ㅅㅅㅅ…', 't')만 있으면 지우고 시작한다.
   *  - 그 밖의 실제 내용이 있으면 덮어쓰지 않고 중단한다.
   */
  async prepare(): Promise<void> {
    await sleep(2500);
    const cancel = this.f.locator('.se-popup-alert button:has-text("취소")').first();
    if (await cancel.count().catch(() => 0)) {
      await cancel.click({ timeout: 5000 }).catch(() => {});
      await sleep(2000);
    }
    const state = await this.f.evaluate(() => ({
      titleEmpty: document.querySelector(".se-documentTitle .se-module-text")?.classList.contains("se-is-empty") ?? true,
      body: Array.from(document.querySelectorAll(".se-component.se-text:not(.se-documentTitle) .se-text-paragraph")).map((p) => {
        const c = p.cloneNode(true) as HTMLElement;
        c.querySelectorAll(".se-placeholder").forEach((x) => x.remove()); // '글감과 함께…' 안내 문구는 내용이 아니다
        return c.textContent ?? "";
      }).join("").replace(/[​\s]/g, ""),
      images: document.querySelectorAll(".se-component.se-image").length,
    }));
    if (!state.titleEmpty || state.images > 0 || (state.body && !/^[tㅅ]+$/.test(state.body))) {
      throw new Error("에디터에 이미 내용이 있습니다. 덮어쓰지 않으려고 중단합니다. 새 글쓰기 창에서 다시 시켜 주세요.");
    }
    if (state.body) {
      await this.paras().first().click();
      await this.page.keyboard.press("Control+A");
      await this.page.keyboard.press("Delete");
      await sleep(800);
      const emptied = await this.f.evaluate(() =>
        Array.from(document.querySelectorAll(".se-component.se-text:not(.se-documentTitle) .se-module-text")).every((m) => m.classList.contains("se-is-empty"))
      );
      if (!emptied) throw new Error("에디터 잔여 글자를 지우지 못했습니다. 새 글쓰기 창을 직접 열어 주세요.");
    }
  }
  async bodyText(): Promise<string[]> {
    return (await this.paras().allInnerTexts()).map((t) => t.trim());
  }
  async typeTitle(t: string) {
    await this.f.locator(".se-documentTitle .se-text-paragraph").click();
    await sleep(400);
    await this.page.keyboard.insertText(t);
    await sleep(600);
    await this.page.keyboard.press("Enter"); // 제목 → 본문
    await sleep(800);
  }
  /** 줄마다 입력 위치(본문 맨 끝)를 다시 잡고, 반영됐는지 확인한다. */
  async typeLines(lines: string[]) {
    for (const l of lines) {
      if (!l) {
        await this.page.keyboard.press("Enter");
        await sleep(rnd(200, 400));
        continue;
      }
      const plain = l.replace(/\*\*/g, "");
      const segs = l.split(/(\*\*[^*]+\*\*)/).filter(Boolean);
      let ok = false;
      for (let a = 0; a < 2 && !ok; a++) {
        await this.focusLastPara();
        await this.page.keyboard.press("Control+End");
        await sleep(250);
        for (const seg of segs) {
          const bold = /^\*\*[^*]+\*\*$/.test(seg);
          const text = bold ? seg.slice(2, -2) : seg;
          if (bold) await this.toggleBold(); // 중요한 부분만 굵게
          // 이모지가 글자와 한 번에 들어가면 네이버 에디터가 글자를 날리고 이모지만 남기므로, 이모지는 따로 입력한다
          for (const chunk of text.split(/(\p{Extended_Pictographic}️?(?:‍\p{Extended_Pictographic}️?)*)/u)) {
            if (!chunk) continue;
            await this.page.keyboard.insertText(chunk);
            await sleep(/\p{Extended_Pictographic}/u.test(chunk) ? 350 : 120);
          }
          // 서식(굵게)을 바꾸기 전에 입력 중인 글자를 확정한다 — 안 하면 앞에 쓴 글자가 새 조각에 다시 들어간다
          if (segs.length > 1) {
            await this.page.keyboard.press("End");
            await sleep(200);
          }
          if (bold) await this.toggleBold();
        }
        await sleep(450);
        const all = await this.bodyText();
        const lastNonEmpty = [...all].reverse().find(Boolean) ?? "";
        ok = lastNonEmpty.includes(plain.slice(0, 8));
      }
      if (!ok) throw new Error(`본문 입력 확인 실패, 중단: ${plain.slice(0, 20)}`);
      await this.page.keyboard.press("Enter");
      await sleep(rnd(300, 650));
      this.guard();
    }
  }
  /** 이미지를 올리면 오른쪽 '라이브러리' 패널이 열려 클릭을 가로막는다 — 열려 있으면 닫는다. */
  async closeSidebar() {
    await this.f.evaluate(() => {
      const btn = document.querySelector(".se-sidebar-panel-header button, .se-sidebar-panel-header .se-sidebar-close, .se-sidebar button[class*='close']") as HTMLElement | null;
      btn?.click();
    }).catch(() => {});
    await sleep(500);
  }
  /** 굵게 켜기/끄기 — 도구 모음 버튼을 직접 누른다 (단축키는 에디터에서 먹지 않는 경우가 있다). */
  async toggleBold(): Promise<void> {
    const ok = await this.f.evaluate(() => {
      const b = document.querySelector("button.se-bold-toolbar-button, .se-toolbar-item-bold button") as HTMLElement | null;
      b?.click();
      return !!b;
    });
    if (!ok) await this.page.keyboard.press("Control+B");
    await sleep(150);
  }
  /** 본문 전체 글자 크기를 바꾼다 (기본 15 → 16). 제목·이미지는 건드리지 않는다. */
  async setBodyFontSize(size: number): Promise<void> {
    await this.closeSidebar();
    await this.paras().first().click();
    await this.page.keyboard.press("Control+A");
    await sleep(400);
    const opened = await this.f.evaluate(() => {
      const b = document.querySelector(".se-font-size-code-toolbar-button, .se-toolbar-item-font-size-code button") as HTMLElement | null;
      b?.click();
      return !!b;
    });
    if (!opened) throw new Error("글자 크기 버튼을 찾지 못했습니다.");
    await sleep(600);
    const picked = await this.f.evaluate((sz) => {
      const direct = document.querySelector(`.se-toolbar-option-font-size-code-fs${sz}-button`) as HTMLElement | null;
      const any = direct ?? (Array.from(document.querySelectorAll("[class*='font-size-code'] button, [class*='font-size-code'] li")).find((e) => (e.textContent ?? "").trim() === String(sz)) as HTMLElement | undefined);
      any?.click();
      return !!any;
    }, size);
    if (!picked) throw new Error(`글자 크기 ${size} 항목을 찾지 못했습니다.`);
    await sleep(700);
    await this.page.keyboard.press("Control+End"); // 선택 해제
  }
  /** 굵게 처리된 글자 조각 수 (확인용). */
  boldCount(): Promise<number> {
    // 네이버 에디터는 굵은 글자를 <span><b>글자</b></span> 로 저장한다
    return this.f.evaluate(() => Array.from(document.querySelectorAll(".se-component.se-text:not(.se-documentTitle) .se-text-paragraph b")).filter((e) => (e.textContent ?? "").replace(/[​\s]/g, "").length > 0).length);
  }

  /** 특정 문단 '앞'에 이미지를 올리고 사진 설명/AI 표시를 설정한다. */
  async insertImage(beforeText: string, file: string, caption: string, ai: boolean) {
    const base = file.replace(/^.*[\\/]/, "").replace(/\.[a-z]+$/i, "");
    const before = await this.imageCount();
    await this.closeSidebar();
    const target = this.paras().filter({ hasText: new RegExp(`^${esc(beforeText)}$`) }).first();
    if (!(await target.count())) throw new Error(`이미지 위치 문단을 찾지 못했습니다: ${beforeText.slice(0, 20)}`);
    await target.scrollIntoViewIfNeeded();
    const box = await target.boundingBox();
    if (!box) throw new Error("문단 위치를 읽지 못했습니다.");
    await this.page.mouse.click(box.x + 6, box.y + 10);
    await this.page.keyboard.press("Home");
    await sleep(400);
    const [chooser] = await Promise.all([
      this.page.waitForEvent("filechooser", { timeout: 10000 }),
      this.f.locator("button.se-image-toolbar-button").first().click(),
    ]);
    await chooser.setFiles(file);
    await sleep(4500);
    await this.closeSidebar();
    if ((await this.imageCount()) !== before + 1) throw new Error(`이미지가 들어가지 않았습니다: ${base}`);
    await this.decorateImage(base, caption, ai);
  }
  async decorateImage(base: string, caption: string, ai: boolean) {
    await this.closeSidebar();
    const comp = this.imgComp(base);
    await comp.scrollIntoViewIfNeeded();
    await comp.locator("img").first().click(); // 선택해야 사진 설명 칸이 나타난다
    await sleep(900);
    const cap = comp.locator(".se-caption .se-text-paragraph").first();
    await cap.click({ timeout: 8000 });
    await sleep(300);
    await this.page.keyboard.insertText(caption);
    await sleep(600);
    if (ai) {
      await comp.locator("img").first().click();
      await sleep(700);
      const tog = comp.locator(".se-set-ai-mark-button-toggle");
      const on = await tog.evaluate((el) => el.classList.contains("se-is-selected"));
      if (!on) {
        await tog.click({ timeout: 8000 });
        await sleep(800);
      }
    }
  }
  async setRepresentative(base: string) {
    const comp = this.imgComp(base);
    await comp.scrollIntoViewIfNeeded();
    await comp.locator("img").first().click();
    await sleep(800);
    await comp.locator("button.se-set-rep-image-button").click({ timeout: 8000 });
    await sleep(900);
  }
  async linkImage(base: string, url: string) {
    const comp = this.imgComp(base);
    await comp.scrollIntoViewIfNeeded();
    await comp.locator("img").first().click();
    await sleep(900);
    await this.f.locator("button.se-property-toolbar-custom-layer-button.se-link-toolbar-button").click({ timeout: 8000 });
    await sleep(900);
    const input = this.f.locator('input[placeholder*="URL"]').first();
    await input.click();
    await sleep(300);
    await this.page.keyboard.insertText(url);
    await this.page.keyboard.press("Enter");
    await sleep(1200);
    const cls = (await this.f.locator("button.se-property-toolbar-custom-layer-button.se-link-toolbar-button").getAttribute("class")) ?? "";
    if (!/se-is-has-value/.test(cls)) throw new Error("배너 링크가 적용되지 않았습니다.");
  }
  async insertPlaces(names: string[]) {
    await this.focusLastPara();
    await this.page.keyboard.press("Control+End");
    await sleep(400);
    await this.f.locator('button:has-text("장소")').first().click();
    await sleep(1800);
    const pop = this.f.locator(".se-popup-placesMap");
    for (const name of names) {
      const input = pop.locator('input[placeholder*="장소명"]');
      await input.click({ clickCount: 3 });
      await sleep(300);
      await this.page.keyboard.insertText(name);
      await this.page.keyboard.press("Enter");
      await sleep(2600);
      const li = pop.locator("li:not(:has-text('장소 삭제'))").filter({ hasText: name }).first();
      if (!(await li.count())) throw new Error(`장소를 찾지 못했습니다: ${name}`);
      await li.click({ timeout: 8000 });
      await sleep(1200);
      await li.locator('button:has-text("추가")').click({ timeout: 8000 });
      await sleep(1800);
    }
    await pop.locator('button:has-text("확인")').click({ timeout: 8000 });
    await sleep(2500);
  }
}

/** 제목 줄처럼 짧고 위아래가 빈 줄인 문장을 소제목으로 본다. */
function findHeadings(lines: string[]): string[] {
  const out: string[] = [];
  lines.forEach((l, i) => {
    if (!l || l.length > 30) return;
    if (/^(•|※|#|✔|📌|📞|💚|🏠|\d+\.\s)/.test(l)) return;
    if (/^안녕하세요/.test(l)) return;
    if ((lines[i - 1] ?? "") !== "" && i !== 0) return;
    if ((lines[i + 1] ?? "") !== "") return;
    out.push(l);
  });
  return out;
}

interface ImageSpec {
  centerPhotos?: boolean; // false 면 센터 사진을 자동으로 넣지 않는다
  cards?: boolean; // false 면 논문 설명 카드(한눈에 보기·근거)를 넣지 않는다
  representative?: number; // images 중 대표 이미지로 쓸 번호(0부터)
  images: { file: string; at: number | string; caption: string; ai: boolean }[];
}

/**
 * 초안의 '## 이미지 지정' JSON 블록을 읽는다 (없으면 undefined).
 *  { "centerPhotos": false, "representative": 0,
 *    "images": [ { "file": "C:\\...\\배너.png", "at": 0, "caption": "AI 제작 이미지 | …", "ai": true } ] }
 * at: 소제목 번호(0~4) | "end"(※ 문구 앞) | 본문 한 줄 전체. 에디터가 파일명으로 이미지를 찾으므로 영문 이름의 임시 복사본으로 올린다.
 */
function parseImageSpec(md: string): ImageSpec | undefined {
  const sec = md.split(/\n##\s*이미지 지정/)[1]?.split(/\n##\s/)[0];
  if (!sec) return undefined;
  const m = sec.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (!m) throw new Error("'이미지 지정'의 JSON 블록을 읽지 못했습니다.");
  const raw = JSON.parse(m[1]) as { centerPhotos?: boolean; cards?: boolean; representative?: number; images?: { file: string; at?: number | string; caption?: string; ai?: boolean }[] };
  const outDir = join(tmpdir(), "ai-team-blog-extra");
  mkdirSync(outDir, { recursive: true });
  const images = (raw.images ?? []).map((x, i) => {
    if (!existsSync(x.file)) throw new Error(`지정한 이미지 파일이 없습니다: ${x.file}`);
    const out = join(outDir, `extra_${i + 1}${extname(x.file).toLowerCase() || ".png"}`);
    copyFileSync(x.file, out);
    return { file: out, at: x.at ?? "end", caption: x.caption ?? "", ai: x.ai ?? false };
  });
  return { centerPhotos: raw.centerPhotos, cards: raw.cards, representative: raw.representative, images };
}

export async function fillBlogEditor(draftFile?: string): Promise<FillResult> {
  const file = draftFile || latestDraftFile();
  const md = readFileSync(file, "utf-8");
  const draft = parseDraft(md);
  const card = parseCardData(md);
  const notes: string[] = [];
  const center = loadBlogCenter();
  const KEYWORDS = center.keywords.map((k) => `${k} ${center.centerName}`);
  const PLACES = center.places;
  const BANNER_FILE = join(PHOTO_DIR, center.bannerFile);
  const BANNER_LINK = process.env.BLOG_BANNER_URL || center.bannerLink;

  // 1) 이미지 준비
  const { tmpdir } = await import("node:os");
  const cardDir = join(tmpdir(), "ai-team-blog-cards");
  // 초안의 '## 이미지 지정'으로 대표가 고른 이미지(광고 배너 등)를 원하는 소제목 앞에 넣는다.
  // centerPhotos:false 면 센터 사진을, cards:false 면 논문 설명 카드(한눈에 보기·근거)를 자동으로 넣지 않는다 (이벤트 글 등).
  const spec = parseImageSpec(md);
  const cards = spec?.cards === false ? undefined : renderCards(card, cardDir, { centerName: center.centerName, steps: center.methodStepsShort });
  // 센터 5단계 카드는 모든 글에서 똑같고 본문의 1~5단계 목록과 겹쳐서 기본으로 쓰지 않는다 (2026-10-19 대표 지적).
  // 카드 자리에는 센터 사진을 한 장 더 넣는다. 예전처럼 쓰려면 .env에 BLOG_STEPS_CARD=1.
  const useStepsCard = process.env.BLOG_STEPS_CARD === "1";
  const wantCenterPhotos = spec?.centerPhotos !== false;
  const photos = wantCenterPhotos ? pickPhotos(useStepsCard ? 3 : 4) : [];
  const kw = (i: number) => KEYWORDS[(i + rnd(0, KEYWORDS.length)) % KEYWORDS.length];
  type Slot = { file: string; caption: string; ai: boolean; at: number | string; kind: string };
  const overviewSlot: Slot | undefined = cards && { file: cards.overview, caption: `AI 제작 이미지 | 논문 한눈에 보기 (${kw(1)})`, ai: true, at: 0, kind: "AI 제작" }; // 소제목 1: 논문 배경
  const evidenceSlot: Slot | undefined = cards && { file: cards.evidence, caption: `AI 제작 이미지 | 근거가 있는 것과 약한 것 (${kw(2)})`, ai: true, at: 2, kind: "AI 제작" }; // 소제목 3: 한계
  const slots: Slot[] = wantCenterPhotos
    ? [
        ...(overviewSlot ? [overviewSlot] : []),
        { file: photos[0].file, caption: `${kw(0)}, ${photos[0].scene}`, ai: false, at: 1, kind: "센터 사진" }, // 소제목 2: 결과
        ...(evidenceSlot ? [evidenceSlot] : []),
        useStepsCard && cards // 소제목 4: 센터 방식 (카드 또는 센터 사진)
          ? { file: cards.steps, caption: `AI 제작 이미지 | ${center.centerName} 트레이닝 5단계 (${kw(0)})`, ai: true, at: 3, kind: "AI 제작" }
          : { file: photos[3]?.file ?? photos[0].file, caption: `${kw(0)}, ${(photos[3] ?? photos[0]).scene}`, ai: false, at: 3, kind: "센터 사진" },
        { file: photos[1].file, caption: `${kw(1)}, ${photos[1].scene}`, ai: false, at: 4, kind: "센터 사진" }, // 소제목 5: 마무리
        { file: photos[2].file, caption: `${kw(2)}, ${photos[2].scene}`, ai: false, at: "end", kind: "센터 사진" }, // 맨 끝(※ 문구 앞)
      ]
    : [...(overviewSlot ? [overviewSlot] : []), ...(evidenceSlot ? [evidenceSlot] : [])];
  for (const x of spec?.images ?? []) slots.push({ file: x.file, caption: x.caption, ai: x.ai, at: x.at, kind: "지정 이미지" });

  // 소제목이 5개로 잡히지 않으면 이미지가 한 칸씩 밀리므로 에디터를 열기 전에 중단한다 (소제목은 30자 이내 한 줄, 앞뒤 빈 줄).
  const preHeadings = findHeadings(draft.lines);
  if (preHeadings.length !== 5) {
    throw new Error(`소제목이 5개로 인식되지 않았습니다(${preHeadings.length}개: ${preHeadings.map((h) => `"${h}"`).join(", ")}). 소제목은 30자 이내 한 줄이고 앞뒤가 빈 줄이어야 합니다. 초안을 고쳐 주세요.`);
  }

  // 2) 브라우저 연결
  await ensureBrowser();
  const browser = await chromium.connectOverCDP(CDP);
  try {
    const { page, f } = await getEditor(browser);
    const ed = new Editor(page, f);
    try {
      await ed.prepare();
    } catch (e) {
      await page.close().catch(() => {}); // 우리가 연 빈 탭은 정리한다
      throw e;
    }

    // 3) 제목 + 본문 (+ AI 안내 문구, 태그)
    const lines = [...draft.lines];
    if (!lines.some((l) => l.includes("AI의 도움"))) lines.push("", "※ 이 글의 초안과 설명 이미지(배너·카드)는 AI의 도움을 받아 제작되었습니다.");
    lines.push("", draft.tags);
    await ed.typeTitle(draft.title);
    await ed.typeLines(lines);
    notes.push(`본문 ${lines.filter(Boolean).length}개 문단 입력, 굵은 글씨 ${await ed.boldCount()}곳`);
    if (BODY_FONT_SIZE) try {
      await ed.setBodyFontSize(BODY_FONT_SIZE);
      notes.push(`본문 글자 크기 ${BODY_FONT_SIZE}`);
    } catch (e) {
      notes.push(`⚠️ 글자 크기는 직접 바꿔 주세요: ${e instanceof Error ? e.message : e}`);
    }

    // 4) 이미지: 소제목 앞에 순서대로 (소제목이 모자라면 '※' 안내 문구 앞)
    const headings = findHeadings(lines);
    const fallback = lines.find((l) => l.startsWith("※")) ?? lines[lines.length - 1];
    for (let i = 0; i < slots.length; i++) {
      const at = slots[i].at;
      const target = at === "end" ? fallback : typeof at === "number" ? (headings[at] ?? fallback) : (lines.find((l) => l === at) ?? fallback);
      await ed.insertImage(target, slots[i].file, slots[i].caption, slots[i].ai);
      notes.push(`이미지 ${i + 1}/${slots.length} (${slots[i].kind}) → "${target.slice(0, 14)}" 앞`);
    }

    // 5) 배너(맨 위, 링크, AI 표시)
    const first = lines.find(Boolean)!;
    await ed.insertImage(first, BANNER_FILE, `AI 제작 이미지 | ${center.keywords.join(" ")} ${center.centerType} ${center.centerName} 안내 배너`, true);
    await ed.linkImage(center.bannerFile.replace(/\.[a-z]+$/i, ""), BANNER_LINK);
    notes.push(`배너 링크: ${BANNER_LINK} (접속 가능한 주소인지 발행 전 미리보기에서 눌러 확인하세요)`);

    // 6) 대표 이미지는 센터 사진, 장소 2곳은 맨 아래
    const repFile = spec?.representative != null && spec.images[spec.representative] ? spec.images[spec.representative].file : photos[0]?.file;
    if (!repFile) throw new Error("대표 이미지로 쓸 이미지가 없습니다.");
    await ed.setRepresentative(repFile.replace(/^.*[\\/]/, "").replace(/\.[a-z]+$/i, ""));
    await ed.insertPlaces(PLACES);
    notes.push(`대표 이미지: ${repFile.replace(/^.*[\\/]/, "")}${spec?.representative != null ? " (지정 이미지)" : " (실제 센터 사진)"}`, "장소 2곳 하단 삽입");

    if (photos.length) markPhotosUsed(photos); // 성공한 글에서만 사진 사용 기록을 남긴다
    const finalCount = await ed.imageCount();
    return { draftFile: file, title: draft.title, images: finalCount, places: PLACES.length, notes };
  } finally {
    await browser.close().catch(() => {}); // 연결만 끊는다 (크롬 창은 그대로 둔다)
  }
}
