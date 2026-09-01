// 네이버 검색광고 API 연동 — 계정별(지점별)로 Customer ID/Access License/Secret Key가
// 따로 발급된다. 서명 방식: HMAC-SHA256(secretKey, "{timestamp}.{method}.{uri}") → base64.
// https://naver.github.io/searchad-apidoc/
import { createHmac } from "node:crypto";

const BASE_URL = "https://api.searchad.naver.com";

export interface NaverAdsAccount {
  label: string;
  customerId: string;
  accessLicense: string;
  secretKey: string;
}

export function getNaverAdsAccounts(): NaverAdsAccount[] {
  const accounts: NaverAdsAccount[] = [];
  const prefixes = [
    { label: "ziantgym1", env: "NAVER_ADS_ZIANTGYM1" },
    { label: "dreamfitt", env: "NAVER_ADS_DREAMFITT" },
  ];
  for (const { label, env } of prefixes) {
    const customerId = process.env[`${env}_CUSTOMER_ID`];
    const accessLicense = process.env[`${env}_ACCESS_LICENSE`];
    const secretKey = process.env[`${env}_SECRET_KEY`];
    if (customerId && accessLicense && secretKey) {
      accounts.push({ label, customerId, accessLicense, secretKey });
    }
  }
  return accounts;
}

function sign(timestamp: string, method: string, uri: string, secretKey: string): string {
  return createHmac("sha256", secretKey).update(`${timestamp}.${method}.${uri}`).digest("base64");
}

async function callApi<T>(account: NaverAdsAccount, method: "GET" | "POST", uri: string, query?: Record<string, string>): Promise<T> {
  const timestamp = String(Date.now());
  const signature = sign(timestamp, method, uri, account.secretKey);
  const url = new URL(BASE_URL + uri);
  if (query) for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);

  const res = await fetch(url, {
    method,
    headers: {
      "X-Timestamp": timestamp,
      "X-API-KEY": account.accessLicense,
      "X-Customer": account.customerId,
      "X-Signature": signature,
      "Content-Type": "application/json; charset=UTF-8",
    },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`네이버 검색광고 API 오류 (${res.status}): ${text}`);
  return JSON.parse(text) as T;
}

interface NccCampaign {
  nccCampaignId: string;
  name: string;
  status: string;
  campaignTp: string; // WEB_SITE=파워링크, PLACE=플레이스, SHOPPING=쇼핑, 그 외 등
}

// 캠페인 단위로 받을 수 있는 지표. ccnt/crto(전환)는 전환추적(picgtackingMode)이 연결돼 있어야
// 0이 아닌 값이 나온다 — 지금 이 계정들은 TRACKING_DISABLED라 항상 0(2026-09-01 확인).
// avgRnk(평균노출순위)는 캠페인 레벨에서도 나오지만 키워드/소재 단위로 볼 때 더 의미있다.
interface StatRow {
  dateStart: string;
  dateEnd: string;
  impCnt: number;
  clkCnt: number;
  salesAmt: number;
  ccnt: number;
  crto: number;
  avgRnk: number;
}

const CAMPAIGN_TP_LABEL: Record<string, string> = {
  WEB_SITE: "파워링크",
  PLACE: "플레이스",
  SHOPPING: "쇼핑검색",
  POWER_CONTENTS: "파워컨텐츠",
  BRAND_SEARCH: "브랜드검색",
};

export interface CampaignSummary {
  name: string;
  type: string;
  status: string;
  impressions: number;
  clicks: number;
  cost: number;
  ctr: number;
  cpc: number;
  conversions: number;
}

export interface NaverAdsRangeSummary {
  account: string;
  customerId: string;
  since: string;
  until: string;
  campaigns: CampaignSummary[];
  byType: Record<string, { impressions: number; clicks: number; cost: number; ctr: number; cpc: number; conversions: number }>;
  totals: { impressions: number; clicks: number; cost: number; ctr: number; cpc: number; conversions: number };
}

function deriveRate(totals: { impressions: number; clicks: number; cost: number }) {
  return {
    ctr: totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0,
    cpc: totals.clicks > 0 ? totals.cost / totals.clicks : 0,
  };
}

// since~until 기간 전체를 캠페인별로 합산한다(파워링크/플레이스 등 캠페인 종류별로도 묶어서 반환).
// /stats는 캠페인 하나당 id 하나씩만 받고(ids 배열은 400 에러), 기간을 걸면 일별 배열로 돌아오므로
// 여기서 직접 더한다.
export async function fetchRangeSummary(account: NaverAdsAccount, since: string, until: string): Promise<NaverAdsRangeSummary> {
  const campaigns = await callApi<NccCampaign[]>(account, "GET", "/ncc/campaigns");

  const rows: CampaignSummary[] = await Promise.all(
    campaigns.map(async (c) => {
      const stats = await callApi<{ data: StatRow[] }>(account, "GET", "/stats", {
        id: c.nccCampaignId,
        fields: JSON.stringify(["impCnt", "clkCnt", "salesAmt", "ccnt"]),
        timeRange: JSON.stringify({ since, until }),
      });
      const totals = (stats.data ?? []).reduce(
        (acc, d) => ({
          impressions: acc.impressions + (d.impCnt ?? 0),
          clicks: acc.clicks + (d.clkCnt ?? 0),
          cost: acc.cost + (d.salesAmt ?? 0),
          conversions: acc.conversions + (d.ccnt ?? 0),
        }),
        { impressions: 0, clicks: 0, cost: 0, conversions: 0 }
      );
      return {
        name: c.name,
        type: CAMPAIGN_TP_LABEL[c.campaignTp] ?? c.campaignTp,
        status: c.status,
        ...totals,
        ...deriveRate(totals),
      };
    })
  );

  const byType: NaverAdsRangeSummary["byType"] = {};
  for (const r of rows) {
    const bucket = byType[r.type] ?? { impressions: 0, clicks: 0, cost: 0, conversions: 0, ctr: 0, cpc: 0 };
    bucket.impressions += r.impressions;
    bucket.clicks += r.clicks;
    bucket.cost += r.cost;
    bucket.conversions += r.conversions;
    byType[r.type] = bucket;
  }
  for (const type of Object.keys(byType)) {
    Object.assign(byType[type], deriveRate(byType[type]));
  }

  const grand = rows.reduce(
    (acc, r) => ({ impressions: acc.impressions + r.impressions, clicks: acc.clicks + r.clicks, cost: acc.cost + r.cost, conversions: acc.conversions + r.conversions }),
    { impressions: 0, clicks: 0, cost: 0, conversions: 0 }
  );

  return {
    account: account.label,
    customerId: account.customerId,
    since,
    until,
    campaigns: rows,
    byType,
    totals: { ...grand, ...deriveRate(grand) },
  };
}

interface NccAdgroup {
  nccAdgroupId: string;
  nccCampaignId: string;
  name: string;
}

interface NccKeyword {
  nccKeywordId: string;
  nccAdgroupId: string;
  keyword: string;
  bidAmt: number;
  status: string;
  delFlag: boolean;
  nccQi?: { qiGrade: number };
}

export interface KeywordSummary {
  campaign: string;
  adgroup: string;
  keyword: string;
  status: string;
  qiGrade: number | null;
  bidAmt: number;
  impressions: number;
  clicks: number;
  cost: number;
  ctr: number;
  cpc: number;
  avgRnk: number | null;
}

// 파워링크(WEB_SITE) 캠페인의 키워드별 성과. 플레이스(PLACE) 등은 키워드 입찰 구조가 달라
// /ncc/keywords가 비거나 에러가 날 수 있어 캠페인 단위로 조용히 건너뛴다.
export async function fetchKeywordSummary(account: NaverAdsAccount, since: string, until: string): Promise<KeywordSummary[]> {
  const campaigns = (await callApi<NccCampaign[]>(account, "GET", "/ncc/campaigns")).filter((c) => c.campaignTp === "WEB_SITE");

  const results: KeywordSummary[] = [];
  for (const campaign of campaigns) {
    let adgroups: NccAdgroup[];
    try {
      adgroups = await callApi<NccAdgroup[]>(account, "GET", "/ncc/adgroups", { nccCampaignId: campaign.nccCampaignId });
    } catch {
      continue;
    }

    for (const adgroup of adgroups) {
      let keywords: NccKeyword[];
      try {
        keywords = await callApi<NccKeyword[]>(account, "GET", "/ncc/keywords", { nccAdgroupId: adgroup.nccAdgroupId });
      } catch {
        continue;
      }

      const rows = await Promise.all(
        keywords
          .filter((k) => !k.delFlag)
          .map(async (k) => {
            const stats = await callApi<{ data: StatRow[] }>(account, "GET", "/stats", {
              id: k.nccKeywordId,
              fields: JSON.stringify(["impCnt", "clkCnt", "salesAmt", "avgRnk"]),
              timeRange: JSON.stringify({ since, until }),
            });
            const totals = (stats.data ?? []).reduce(
              (acc, d) => ({
                impressions: acc.impressions + (d.impCnt ?? 0),
                clicks: acc.clicks + (d.clkCnt ?? 0),
                cost: acc.cost + (d.salesAmt ?? 0),
                avgRnkSum: acc.avgRnkSum + (d.avgRnk ?? 0) * (d.impCnt ?? 0),
              }),
              { impressions: 0, clicks: 0, cost: 0, avgRnkSum: 0 }
            );
            const row: KeywordSummary = {
              campaign: campaign.name,
              adgroup: adgroup.name,
              keyword: k.keyword,
              status: k.status,
              qiGrade: k.nccQi?.qiGrade ?? null,
              bidAmt: k.bidAmt,
              impressions: totals.impressions,
              clicks: totals.clicks,
              cost: totals.cost,
              ...deriveRate(totals),
              avgRnk: totals.impressions > 0 ? totals.avgRnkSum / totals.impressions : null,
            };
            return row;
          })
      );
      results.push(...rows);
    }
  }

  return results;
}
