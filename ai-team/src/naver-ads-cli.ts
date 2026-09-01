import * as dotenv from "dotenv";
import { join } from "node:path";
dotenv.config({ path: join(__dirname, "..", ".env") });

import { getNaverAdsAccounts, fetchDailySummary } from "./main/naverAds";
import { addDays, todayStr } from "./main/autoMessage";

async function main() {
  const dateArg = process.argv[2] ?? addDays(todayStr(), -1);
  const accounts = getNaverAdsAccounts();
  if (accounts.length === 0) {
    console.log("등록된 네이버 검색광고 계정이 없습니다. .env를 확인하세요.");
    return;
  }

  for (const account of accounts) {
    console.log(`\n=== ${account.label} (${account.customerId}) — ${dateArg} ===`);
    try {
      const summary = await fetchDailySummary(account, dateArg);
      if (summary.campaigns.length === 0) {
        console.log("캠페인이 없거나 데이터가 없습니다.");
        continue;
      }
      for (const c of summary.campaigns) {
        console.log(`- ${c.name}: 노출 ${c.impressions} · 클릭 ${c.clicks} · 비용 ${c.cost.toLocaleString()}원 · CTR ${c.ctr.toFixed(2)}% · CPC ${Math.round(c.cpc).toLocaleString()}원`);
      }
      const t = summary.totals;
      console.log(`합계: 노출 ${t.impressions} · 클릭 ${t.clicks} · 비용 ${t.cost.toLocaleString()}원 · CTR ${t.ctr.toFixed(2)}% · CPC ${Math.round(t.cpc).toLocaleString()}원`);
    } catch (err: any) {
      console.log(`오류: ${err?.message ?? err}`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
