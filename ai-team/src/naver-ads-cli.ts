// 사용법: npm run naver-ads                    → 어제 하루
//        npm run naver-ads week                 → 최근 7일(어제까지)
//        npm run naver-ads month                 → 이번 달 1일~어제
//        npm run naver-ads 2026-08-01 2026-08-31   → 임의 기간
//        npm run naver-ads keywords [week|month|since until]  → 파워링크 키워드별 성과(비용순)
import * as dotenv from "dotenv";
import { join } from "node:path";
dotenv.config({ path: join(__dirname, "..", ".env") });

import { getNaverAdsAccounts, fetchRangeSummary, fetchKeywordSummary } from "./main/naverAds";
import { addDays, todayStr } from "./main/autoMessage";

function resolveRange(args: string[]): { since: string; until: string } {
  const [a, b] = args;
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

async function runSummary(since: string, until: string) {
  const accounts = getNaverAdsAccounts();
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

async function runKeywords(since: string, until: string) {
  const accounts = getNaverAdsAccounts();
  for (const account of accounts) {
    console.log(`\n=== ${account.label} (${account.customerId}) 키워드별 — ${since} ~ ${until} ===`);
    try {
      const rows = await fetchKeywordSummary(account, since, until);
      if (rows.length === 0) {
        console.log("파워링크 키워드가 없습니다.");
        continue;
      }
      const sorted = [...rows].sort((a, b) => b.cost - a.cost);
      for (const r of sorted) {
        console.log(
          `- [${r.campaign}/${r.adgroup}] ${r.keyword} (${r.status}, 입찰가 ${fmt(r.bidAmt)}원, 품질 ${r.qiGrade ?? "-"}): 노출 ${fmt(r.impressions)} · 클릭 ${fmt(r.clicks)} · 비용 ${fmt(r.cost)}원 · CTR ${r.ctr.toFixed(2)}% · 평균순위 ${r.avgRnk ? r.avgRnk.toFixed(1) : "-"}`
        );
      }
      const wasted = sorted.filter((r) => r.impressions > 0 && r.clicks === 0);
      if (wasted.length > 0) {
        console.log(`\n[노출만 있고 클릭 0인 키워드 ${wasted.length}개] ${wasted.map((r) => r.keyword).join(", ")}`);
      }
    } catch (err: any) {
      console.log(`오류: ${err?.message ?? err}`);
    }
  }
}

async function main() {
  const args = process.argv.slice(2);
  if (args[0] === "keywords") {
    const { since, until } = resolveRange(args.slice(1));
    await runKeywords(since, until);
    return;
  }
  const { since, until } = resolveRange(args);
  await runSummary(since, until);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
