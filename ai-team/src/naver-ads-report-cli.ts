// 사용법: npm run naver-ads-report            → 주간 리포트(직전 7일)
//        npm run naver-ads-report monthly     → 월간 리포트(저번 달 전체)
import * as dotenv from "dotenv";
import { join } from "node:path";
dotenv.config({ path: join(__dirname, "..", ".env") });

import { runNaverAdsReportJob, runNaverAdsMonthlyReportJob } from "./main/naverAdsReport";

async function main() {
  const isMonthly = process.argv[2] === "monthly";
  const result = isMonthly ? await runNaverAdsMonthlyReportJob() : await runNaverAdsReportJob();
  if (result.text) console.log(result.text);
  if (result.notionUrl) console.log(`\n노션 기록 완료: ${result.notionUrl}`);
  else if (result.notionError) console.log(`\n노션 기록 실패: ${result.notionError}`);
  if (!result.ok) {
    console.error(`발송 실패: ${result.error}`);
    process.exit(1);
  }
  console.log("카카오톡 발송 완료");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
