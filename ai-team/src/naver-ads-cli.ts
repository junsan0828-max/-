// 사용법: npm run naver-ads               → 어제 하루
//        npm run naver-ads week            → 최근 7일(어제까지)
//        npm run naver-ads month            → 이번 달 1일~어제
//        npm run naver-ads 2026-08-01 2026-08-31  → 임의 기간
import * as dotenv from "dotenv";
import { join } from "node:path";
dotenv.config({ path: join(__dirname, "..", ".env") });

import { getNaverAdsAccounts, fetchRangeSummary } from "./main/naverAds";
import { addDays, todayStr } from "./main/autoMessage";

function resolveRange(): { since: string; until: string } {
  const [a, b] = process.argv.slice(2);
  const yesterday = addDays(todayStr(), -1);
  if (a === "week") return { since: addDays(todayStr(), -7), until: yesterday };
  if (a === "month") {
    const monthStart = `${todayStr().slice(0, 7)}-01`;
    // 이번 달 1일이면 이번 달 데이터가 아직 없으므로 저번 달 전체로 대체한다.
    if (monthStart > yesterday) {
      const prevMonthEnd = addDays(monthStart, -1);
      return { since: `${prevMonthEnd.slice(0, 7)}-01`, until: prevMonthEnd };
    }
    return { since: monthStart, until: yesterday };
  }
  if (a && b) return { since: a, until: b };
  if (a) return { since: a, until: a };
  return { since: yesterday, until: yesterday };
}

function fmt(n: number) {
  return Math.round(n).toLocaleString();
}

async function main() {
  const { since, until } = resolveRange();
  const accounts = getNaverAdsAccounts();
  if (accounts.length === 0) {
    console.log("등록된 네이버 검색광고 계정이 없습니다. .env를 확인하세요.");
    return;
  }

  for (const account of accounts) {
    console.log(`\n=== ${account.label} (${account.customerId}) — ${since} ~ ${until} ===`);
    try {
      const summary = await fetchRangeSummary(account, since, until);
      if (summary.campaigns.length === 0) {
        console.log("캠페인이 없습니다.");
        continue;
      }
      console.log("[캠페인별]");
      for (const c of summary.campaigns) {
        console.log(
          `- (${c.type}/${c.status}) ${c.name}: 노출 ${fmt(c.impressions)} · 클릭 ${fmt(c.clicks)} · 비용 ${fmt(c.cost)}원 · CTR ${c.ctr.toFixed(2)}% · CPC ${fmt(c.cpc)}원 · 전환 ${c.conversions}`
        );
      }
      console.log("[캠페인 종류별 합계]");
      for (const [type, t] of Object.entries(summary.byType)) {
        console.log(`- ${type}: 노출 ${fmt(t.impressions)} · 클릭 ${fmt(t.clicks)} · 비용 ${fmt(t.cost)}원 · CTR ${t.ctr.toFixed(2)}% · CPC ${fmt(t.cpc)}원 · 전환 ${t.conversions}`);
      }
      const t = summary.totals;
      console.log(`[전체 합계] 노출 ${fmt(t.impressions)} · 클릭 ${fmt(t.clicks)} · 비용 ${fmt(t.cost)}원 · CTR ${t.ctr.toFixed(2)}% · CPC ${fmt(t.cpc)}원 · 전환 ${t.conversions}`);
    } catch (err: any) {
      console.log(`오류: ${err?.message ?? err}`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
