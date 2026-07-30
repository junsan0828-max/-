// IFK(ifk.co.kr) TLS 접속 오류 원인 진단용 일회성 스크립트. 실제 자동화 코드가 아니라
// 클라우드 샌드박스 안에서 정확한 에러 메시지를 받기 위한 디버깅 도구다.
// 실행: npx tsx src/diag-ifk-tls.ts
import { chromium } from "playwright";

async function testConfig(name: string, launchArgs: string[], ctxOpts: { ignoreHTTPSErrors?: boolean }) {
  console.log(`\n=== TEST: ${name} ===`);
  try {
    const browser = await chromium.launch({ headless: true, args: launchArgs, timeout: 30000 });
    try {
      const context = await browser.newContext(ctxOpts);
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
  await testConfig("ignoreHTTPSErrors only (context)", [], { ignoreHTTPSErrors: true });
  await testConfig("--ignore-certificate-errors only (launch arg)", ["--ignore-certificate-errors"], {});
  await testConfig("both combined", ["--ignore-certificate-errors"], { ignoreHTTPSErrors: true });
}

main().catch((err) => {
  console.error("TOP-LEVEL ERROR:", err instanceof Error ? err.message : err);
  process.exit(1);
});
