import * as dotenv from "dotenv";
import { join } from "node:path";
dotenv.config({ path: join(__dirname, "..", ".env") });

import { runNaverAdsReportJob } from "./main/naverAdsReport";

async function main() {
  const result = await runNaverAdsReportJob();
  if (result.text) console.log(result.text);
  if (!result.ok) {
    console.error(`발송 실패: ${result.error}`);
    process.exit(1);
  }
  console.log("\n카카오톡 발송 완료");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
