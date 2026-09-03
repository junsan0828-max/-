import * as dotenv from "dotenv";
import { join } from "node:path";
dotenv.config({ path: join(__dirname, "..", ".env") });

import { runAdDataSyncJob } from "./main/adDataSync";

async function main() {
  const result = await runAdDataSyncJob();
  if (!result.ok) {
    console.error(`실패: ${result.error}`);
    process.exit(1);
  }
  console.log(`=== ${result.date} 광고 데이터 기록 자동 입력 완료 ===`);
  for (const w of result.written ?? []) {
    console.log(`- ${w.channel}: 노출 ${w.impressions} · 클릭 ${w.clicks}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
