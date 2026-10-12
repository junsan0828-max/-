// 네이버 모바일 검색의 플레이스 목록에서 자이언트짐 순위를 읽는다 (읽기 전용).
// - 로그인/클릭/입력 없음. 키워드당 페이지 1회 로드, 키워드 사이 랜덤 대기.
// - 로그인 확인·캡차가 감지되면 즉시 중단하고 재시도하지 않는다.
import { chromium } from "playwright";

export const TARGET_PLACE_ID = "1472107769"; // 맞춤운동센터 자이언트짐 정왕배곧점
export const DEFAULT_KEYWORDS = ["정왕동피티", "정왕동헬스장", "정왕동 자세교정"];

export interface PlaceRankItem {
  rank: number; // 광고 제외 순번 (광고는 0)
  isAd: boolean;
  placeId: string;
  name: string;
}

export interface KeywordRank {
  keyword: string;
  items: PlaceRankItem[];
  targetRank: number | null; // 광고 제외 순위
  blocked?: string; // 중단 사유
}

const MOBILE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const jitter = (min: number, max: number) => min + Math.floor(Math.random() * (max - min));

// '더보기' 전체 목록(m.place.naver.com/rest/list)을 스크롤해서 광고 제외 순위를 읽는다.
export async function readFullPlaceRanks(keywords: string[], maxScrolls = 6): Promise<KeywordRank[]> {
  const browser = await chromium.launch({ headless: true });
  const results: KeywordRank[] = [];
  try {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
      locale: "ko-KR",
      userAgent: MOBILE_UA,
    });
    const page = await context.newPage();

    for (let i = 0; i < keywords.length; i++) {
      const keyword = keywords[i];
      if (i > 0) await sleep(jitter(6000, 12000));

      await page.goto(
        `https://m.place.naver.com/rest/list?query=${encodeURIComponent(keyword)}&sortingOrder=precision&entry=pll`,
        { waitUntil: "domcontentloaded", timeout: 30000 }
      );
      await page.waitForTimeout(3000);

      const head = await page.evaluate(() => document.body.innerText.slice(0, 3000));
      if (/nid\.naver\.com|captcha|자동입력 방지|비정상적인 접근|보안 확인|실제 사용자임을 확인/i.test(page.url() + head)) {
        results.push({ keyword, items: [], targetRank: null, blocked: "로그인 확인/캡차 감지 - 중단" });
        break;
      }

      for (let s = 0; s < maxScrolls; s++) {
        await page.mouse.wheel(0, 2400);
        await page.waitForTimeout(jitter(1200, 2200));
      }

      const raw = await page.evaluate(() => {
        const out: { placeId: string; name: string; isAd: boolean }[] = [];
        const seen = new Set<string>();
        document.querySelectorAll<HTMLElement>("li").forEach((li) => {
          const a = li.querySelector<HTMLAnchorElement>('a[href*="/place/"]');
          const m = a?.href.match(/\/place\/(\d{6,})/);
          if (!m) return;
          const lines = (li.innerText || "").split("\n").map((l) => l.trim()).filter(Boolean);
          const isAd = lines.includes("광고");
          const name = lines.find((l) => l !== "광고" && l !== "새로오픈") || "";
          const key = m[1] + (isAd ? ":ad" : "");
          if (!name || seen.has(key)) return;
          seen.add(key);
          out.push({ placeId: m[1], name, isAd });
        });
        return out;
      });

      let organic = 0;
      const items: PlaceRankItem[] = raw.map((r) => ({
        rank: r.isAd ? 0 : ++organic,
        isAd: r.isAd,
        placeId: r.placeId,
        name: r.name,
      }));
      const target = items.find((it) => it.placeId === TARGET_PLACE_ID && !it.isAd);
      results.push({ keyword, items, targetRank: target ? target.rank : null });
    }
  } finally {
    await browser.close();
  }
  return results;
}

export async function readPlaceRanks(keywords: string[] = DEFAULT_KEYWORDS): Promise<KeywordRank[]> {
  const browser = await chromium.launch({ headless: true });
  const results: KeywordRank[] = [];
  try {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
      locale: "ko-KR",
      userAgent: MOBILE_UA,
    });
    const page = await context.newPage();

    for (let i = 0; i < keywords.length; i++) {
      const keyword = keywords[i];
      if (i > 0) await sleep(jitter(6000, 12000));

      await page.goto(
        `https://m.search.naver.com/search.naver?query=${encodeURIComponent(keyword)}`,
        { waitUntil: "domcontentloaded", timeout: 30000 }
      );
      await page.waitForTimeout(2500);

      const url = page.url();
      const bodyText = await page.evaluate(() => document.body.innerText.slice(0, 2000));
      if (/nid\.naver\.com|captcha|자동입력 방지|비정상적인 접근|보안 확인|실제 사용자임을 확인/i.test(url + bodyText)) {
        results.push({ keyword, items: [], targetRank: null, blocked: "로그인 확인/캡차 감지 - 중단" });
        break; // 재시도하지 않는다
      }

      const raw = await page.evaluate(() => {
        const seen = new Map<string, { name: string; isAd: boolean; order: number }>();
        const anchors = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href*="m.place.naver.com/place/"]'));
        anchors.forEach((a, idx) => {
          const m = a.href.match(/place\/(\d{6,})/);
          if (!m) return;
          const id = m[1];
          if (seen.has(id)) return;
          // 카드 컨테이너: '전화'와 '공유' 텍스트를 함께 가진 가장 가까운 조상
          let card: HTMLElement | null = a;
          for (let d = 0; d < 10 && card; d++) {
            const t = card.innerText || "";
            if (t.includes("공유") && (t.includes("전화") || t.includes("길찾기"))) break;
            card = card.parentElement;
          }
          const text = card?.innerText ?? "";
          const html = card?.innerHTML ?? "";
          const img = card?.querySelector<HTMLImageElement>("img[alt]:not([alt='프로필'])");
          const name = (img?.alt || a.innerText || "").trim();
          // 광고 카드는 ader.naver.com 추적 링크/nad 식별자를 가진다.
          const isAd = /ader\.naver\.com|nad-a\d{3}/.test(html) || /(^|\s)광고(\s|$)/.test(text);
          seen.set(id, { name, isAd, order: idx });
        });
        return Array.from(seen.entries()).map(([id, v]) => ({ placeId: id, ...v }));
      });

      let organic = 0;
      const items: PlaceRankItem[] = raw
        .filter((r) => r.name)
        .map((r) => ({
          rank: r.isAd ? 0 : ++organic,
          isAd: r.isAd,
          placeId: r.placeId,
          name: r.name,
        }));
      const target = items.find((it) => it.placeId === TARGET_PLACE_ID);
      results.push({ keyword, items, targetRank: target && !target.isAd ? target.rank : null });
    }
  } finally {
    await browser.close();
  }
  return results;
}
