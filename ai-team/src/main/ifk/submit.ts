// IFK(피트니스경영신문, ifk.co.kr/nad) 관리자 "뉴스등록" 폼에 실제로 로그인해서
// 기사를 등록대기(wr_is_regist=0) 상태로 등록한다. 즉시 게시되지 않고 사람이 검토 후
// 승인해야 노출된다. (임시저장/tmp_save=1은 슬롯이 하나뿐이라 새로 저장할 때마다
// 이전 초안이 사라지는 것으로 확인돼 등록대기로 전환함 — 2026-07-17)
// 본문 에디터(Cheditor)는 제출 시 자동 동기화되지 않아서
// (페이지 자체 jQuery submit 핸들러가 실제 클릭 제출에서만 도는 구조) 직접 재현해야 한다.
// 자세한 내용/검증 과정은 이 기능의 노션 스펙 메모 참고.
import { chromium, Page } from "playwright";
import { IfkArticle } from "./notionSource";
import { IfkReporter } from "./reporters";
import { nextSecondarySection } from "./sectionRotation";

const SECTION_FITNESS_NEWS = "20140925141441_2377"; // 1차섹션 = 피트니스뉴스

// 출력형태: 메인면(main_*) 체크박스만 대상 — 서브면(sub_*)은 사용하지 않기로 함
const MAIN_POSITIONS = [
  "main_headline", "main_realtime", "main_top", "main_right_headline", "main_photo_slide",
  "main_center", "main_todayhot", "main_section_bottom", "main_bottom",
  "main_hot", "main_right_top", "main_movie", "main_right_bottom", "main_photo",
];

export interface IfkSubmitResult {
  ok: boolean;
  error?: string;
}

function pickRandomPositions(count: number): string[] {
  const pool = [...MAIN_POSITIONS];
  const picked: string[] = [];
  while (picked.length < count && pool.length > 0) {
    const i = Math.floor(Math.random() * pool.length);
    picked.push(pool.splice(i, 1)[0]);
  }
  return picked;
}

function guessMime(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase();
  if (ext === "png") return "image/png";
  if (ext === "gif") return "image/gif";
  if (ext === "webp") return "image/webp";
  return "image/jpeg";
}

async function login(page: Page) {
  await page.goto("https://www.ifk.co.kr/nad/");
  await page.fill('input[name="uid"]', process.env.IFK_ADMIN_ID || "");
  await page.fill('input[name="passwd"]', process.env.IFK_ADMIN_PASSWORD || "");
  await Promise.all([
    page.waitForNavigation({ waitUntil: "networkidle" }).catch(() => {}),
    page.evaluate(() => (document.getElementById("AdminLoginFrm") as HTMLFormElement)?.submit()),
  ]);
}

/** 기사 1건을 IFK 관리자 "뉴스등록" 폼에 채우고 등록대기(wr_is_regist=0)로 등록한다. */
export async function submitIfkArticleAsPending(
  article: IfkArticle,
  reporter: IfkReporter
): Promise<IfkSubmitResult> {
  if (!process.env.IFK_ADMIN_ID || !process.env.IFK_ADMIN_PASSWORD) {
    return { ok: false, error: "IFK 관리자 로그인 정보 미설정 (.env에 IFK_ADMIN_ID/IFK_ADMIN_PASSWORD 필요)" };
  }

  // 진짜 원인(2026-07-31 클라우드 진단으로 확정): 인증서 체인 문제가 아니라, 클라우드 샌드박스가
  // 외부 HTTPS 접속을 HTTPS_PROXY 환경변수의 프록시로만 허용하는데 Playwright의 Chromium은 그
  // 환경변수를 자동으로 읽지 않아 직접 접속을 시도하다가 net::ERR_CONNECTION_RESET으로 막혔다.
  // (curl은 HTTPS_PROXY를 자동으로 타서 정상 접속됐던 것 — 그래서 이전엔 "인증서 문제"로 오진단함.)
  // 프록시 환경변수가 있으면 명시적으로 Chromium에 전달한다. 로컬(Windows, 프록시 없음)에서는
  // 아무 값도 안 잡히므로 기존과 동일하게 동작한다. ignoreHTTPSErrors는 ifk.co.kr의 불완전한 TLS
  // 체인(중간 인증서 누락, openssl s_client로 확인) 우회용으로 계속 유지한다.
  const proxyServer =
    process.env.HTTPS_PROXY || process.env.https_proxy || process.env.HTTP_PROXY || process.env.http_proxy;
  const browser = await chromium.launch({
    headless: true,
    args: ["--ignore-certificate-errors"],
    proxy: proxyServer ? { server: proxyServer } : undefined,
  });
  try {
    // 프록시를 명시해도 여전히 ERR_CONNECTION_RESET이 나서(2026-07-31 클라우드 진단), curl은
    // 되는데 헤드리스 크롬만 막히는 상황 — 사이트/WAF가 헤드리스 크롬 특유의 User-Agent
    // ("HeadlessChrome")로 자동화를 탐지해 연결을 끊는 것으로 추정된다. 일반 데스크톱 크롬처럼
    // User-Agent를 지정해 우회를 시도한다.
    const context = await browser.newContext({
      ignoreHTTPSErrors: true,
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    });
    const page = await context.newPage();
    await login(page);
    await page.goto("https://www.ifk.co.kr/nad/news/insert.php", { waitUntil: "networkidle" });
    await page.waitForTimeout(2000); // Cheditor iframe 초기화 대기

    // 뉴스등급 = 주요뉴스 (출력형태 섹션이 이 클릭으로 나타남)
    await page.check("#wr_level_1");

    // 섹션 = 피트니스뉴스(1차) / NEWS·업계소식 순번 로테이션(2차, 1차 선택 후 AJAX로 채워짐)
    await page.selectOption("#wr_code", SECTION_FITNESS_NEWS);
    await page.waitForTimeout(800);
    await page.selectOption("#wr_d_code", nextSecondarySection());

    // 작성자 (로테이션으로 배정된 기존 기자 계정)
    await page.fill("#wr_name", reporter.name);
    const [emailId, emailDomain] = reporter.email.split("@");
    await page.fill("#wr_email_0", emailId || "");
    await page.fill("#wr_email_1", emailDomain || "");

    // 제목/부제목
    await page.fill("#wr_subject", article.title);
    if (article.subtitle) {
      await page.fill('input[name="wr_sub_subject[]"]', article.subtitle);
    }

    // 대표이미지
    if (article.image) {
      await page.setInputFiles("#wr_image", {
        name: article.image.filename,
        mimeType: guessMime(article.image.filename),
        buffer: article.image.buffer,
      });
    } else {
      return { ok: false, error: "대표이미지가 없는 기사입니다 (노션 페이지 상단 이미지 필요)" };
    }

    // 출력형태: 메인면 중 랜덤 2개
    for (const pos of pickRandomPositions(2)) {
      await page.check(`#${pos}`);
    }

    // 조회수: 1회 클릭당 2배수 증가 (기본 조회수 0, 배수만 2로 설정)
    await page.fill("#wr_hit_div", "2");

    // 키워드/해시태그 (노션에 있는 핵심 키워드 + 매체명은 항상 포함)
    const keywords = [...article.keywords];
    if (!keywords.includes("피트니스경영신문")) keywords.push("피트니스경영신문");
    await page.fill("#wr_keyword", keywords.join(","));

    // 등록여부 = 등록대기 (즉시 게시 아님, 사람 검토 후 승인 필요)
    await page.check("#wr_is_regist_0");

    // 본문을 Cheditor 에디터에 로드
    await page.evaluate((html) => {
      (window as any).ed_wr_content.loadContents(html);
    }, article.bodyHtml);
    await page.waitForTimeout(300);

    const navPromise = page.waitForNavigation({ waitUntil: "networkidle", timeout: 20000 }).catch(() => null);

    // 사이트 자체 submit 핸들러 로직 재현: 에디터→textarea 동기화 후 등록대기로 제출
    // (tmp_save는 건드리지 않음 — 기본값 "0" 그대로, 임시저장이 아니라 정식 등록 경로로 감)
    const evalResult = await page.evaluate(() => {
      try {
        (document.getElementById("tx_wr_content") as HTMLTextAreaElement).value = (window as any).ed_wr_content.outputBodyHTML();
        const form = document.getElementById("newsRegistFrm") as HTMLFormElement;
        const valid = (window as any).validate(form);
        if (!valid) return "VALIDATE_FAILED";
        form.submit();
        return "SUBMITTED";
      } catch (e: any) {
        return "ERROR: " + (e?.message ?? String(e));
      }
    });

    if (evalResult !== "SUBMITTED") {
      return { ok: false, error: `IFK 폼 제출 실패: ${evalResult}` };
    }

    await navPromise;
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  } finally {
    await browser.close();
  }
}
