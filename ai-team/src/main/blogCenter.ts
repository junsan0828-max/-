// 블로그 글에 들어가는 센터 정보 (이름·주소·전화·링크·진행 단계 …).
// 코드에 박아 두지 않고 config/blog-center.json 에서 읽는다 — 다른 센터/PC는 blog-center.example.json 을 복사해 채우거나,
// docs/share 의 '처음 세팅' 프롬프트로 AI에게 인터뷰를 시켜 만든다.
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

export interface BlogCenter {
  centerName: string;
  centerType: string;
  region: string;
  ownerName: string;
  ownerTitle: string;
  aiName: string;
  titlePrefix: string;
  keywords: string[];
  methodSteps: string[];
  methodStepsShort: string[];
  footer: {
    homepageTitle: string;
    homepageUrl: string;
    introLines: string[];
    bookingTitle: string;
    bookingUrl: string;
    addressTitle: string;
    address: string;
    talkTitle: string;
    talkUrl: string;
    phone: string;
  };
  places: string[];
  bannerFile: string;
  bannerLink: string;
}

const PATH = process.env.BLOG_CENTER_CONFIG || resolve(__dirname, "..", "..", "config", "blog-center.json");
let cached: BlogCenter | undefined;

export function loadBlogCenter(): BlogCenter {
  if (cached) return cached;
  if (!existsSync(PATH)) {
    throw new Error(
      `센터 정보 파일이 없습니다: ${PATH}\nconfig/blog-center.example.json 을 blog-center.json 으로 복사해 채우거나, docs/share/00_처음_세팅_인터뷰_프롬프트.md 로 AI에게 만들게 하세요.`
    );
  }
  const c = JSON.parse(readFileSync(PATH, "utf-8")) as BlogCenter;
  const missing: string[] = [];
  const need = (k: string, v: unknown) => {
    const text = Array.isArray(v) ? v.join() : String(v ?? "");
    if (!text || /\[.*\]/.test(text)) missing.push(k);
  };
  need("centerName", c.centerName);
  need("region", c.region);
  need("ownerName", c.ownerName);
  need("titlePrefix", c.titlePrefix);
  need("keywords", c.keywords);
  need("methodSteps", c.methodSteps);
  need("footer.address", c.footer?.address);
  need("footer.phone", c.footer?.phone);
  need("places", c.places);
  need("bannerFile", c.bannerFile);
  if (c.methodSteps?.length !== 5 || c.methodStepsShort?.length !== 5) missing.push("methodSteps/methodStepsShort (정확히 5개)");
  if (missing.length) throw new Error(`센터 정보 파일에 빈칸이 있습니다 (${PATH}): ${missing.join(", ")}`);
  cached = c;
  return c;
}

/** 글 맨 아래 고정 안내 블록 — 홈페이지 → 소개 → 예약 → 오시는 길 → 톡톡 → 전화. 비어 있는 항목은 건너뛴다. */
export function buildFooter(c: BlogCenter): string {
  const f = c.footer;
  const block = (...lines: (string | undefined)[]) => lines.filter((l) => l && !/^https?:\/\/$/.test(l)).join("\n");
  return [
    block(f.homepageTitle, f.homepageUrl),
    block(...f.introLines),
    block(f.bookingTitle, f.bookingUrl),
    block(f.addressTitle, f.address),
    block(f.talkTitle, f.talkUrl),
    f.phone,
  ]
    .filter(Boolean)
    .join("\n\n");
}
