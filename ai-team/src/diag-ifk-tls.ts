// IFK(ifk.co.kr) 접속 오류 원인 진단용 일회성 스크립트. 실제 자동화 코드가 아니라
// 클라우드 샌드박스 안에서 정확한 에러 메시지를 받기 위한 디버깅 도구다.
// 실행: npx tsx src/diag-ifk-tls.ts
import { chromium } from "playwright";

const DESKTOP_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

async function testConfig(name: string, userAgent: string | undefined) {
  console.log(`\n=== TEST: ${name} ===`);
  const proxyServer =
    process.env.HTTPS_PROXY || process.env.https_proxy || process.env.HTTP_PROXY || process.env.http_proxy;
  try {
    const browser = await chromium.launch({
      headless: true,
      args: ["--ignore-certificate-errors"],
      proxy: proxyServer ? { server: proxyServer } : undefined,
      timeout: 30000,
    });
    try {
      const context = await browser.newContext({ ignoreHTTPSErrors: true, userAgent });
      const page = await context.newPage();
      await page.goto("https://www.ifk.co.kr/nad/", { waitUntil: "domcontentloaded", timeout: 20000 });
      const title = await page.title();
      console.log(`SUCCESS — title: "${title}"`);
    } catch (err) {
      console.log(`FAILED: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      await browser.close();
    }
  } catch (err) {
    console.log(`LAUNCH FAILED: ${err instanceof Error ? err.message : String(err)}`);
  }
}

async function main() {
  const proxyServer =
    process.env.HTTPS_PROXY || process.env.https_proxy || process.env.HTTP_PROXY || process.env.http_proxy;
  console.log("proxyServer resolved to:", proxyServer);

  await testConfig("proxy + ignoreHTTPSErrors, default (headless) UA", undefined);
  await testConfig("proxy + ignoreHTTPSErrors + desktop Chrome UA", DESKTOP_UA);
}

main().catch((err) => {
  console.error("TOP-LEVEL ERROR:", err instanceof Error ? err.message : err);
  process.exit(1);
});
