// 네이버 검색광고(파워링크) API 연동 — 계정별(지점별)로 Customer ID/Access License/Secret Key가
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
  campaignTp: string;
}

interface StatRow {
  id: string;
  impCnt: number;
  clkCnt: number;
  salesAmt: number;
  ctr: number;
  cpc: number;
}

export interface NaverAdsDailySummary {
  account: string;
  customerId: string;
  date: string;
  campaigns: { name: string; impressions: number; clicks: number; cost: number; ctr: number; cpc: number }[];
  totals: { impressions: number; clicks: number; cost: number; ctr: number; cpc: number };
}

export async function fetchDailySummary(account: NaverAdsAccount, dateYmd: string): Promise<NaverAdsDailySummary> {
  const campaigns = await callApi<NccCampaign[]>(account, "GET", "/ncc/campaigns");
  if (campaigns.length === 0) {
    return { account: account.label, customerId: account.customerId, date: dateYmd, campaigns: [], totals: { impressions: 0, clicks: 0, cost: 0, ctr: 0, cpc: 0 } };
  }

  // /stats는 캠페인 하나당 id 하나씩만 받는다(ids 배열 형식은 400 에러) — 캠페인별로 개별 호출.
  const rows = await Promise.all(
    campaigns.map(async (c) => {
      const stats = await callApi<{ data: StatRow[] }>(account, "GET", "/stats", {
        id: c.nccCampaignId,
        fields: JSON.stringify(["impCnt", "clkCnt", "salesAmt", "ctr", "cpc"]),
        timeRange: JSON.stringify({ since: dateYmd, until: dateYmd }),
      });
      const s = stats.data?.[0];
      return {
        name: c.name,
        impressions: s?.impCnt ?? 0,
        clicks: s?.clkCnt ?? 0,
        cost: s?.salesAmt ?? 0,
        ctr: s?.ctr ?? 0,
        cpc: s?.cpc ?? 0,
      };
    })
  );

  const totals = rows.reduce(
    (acc, r) => ({ impressions: acc.impressions + r.impressions, clicks: acc.clicks + r.clicks, cost: acc.cost + r.cost, ctr: 0, cpc: 0 }),
    { impressions: 0, clicks: 0, cost: 0, ctr: 0, cpc: 0 }
  );
  totals.ctr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;
  totals.cpc = totals.clicks > 0 ? totals.cost / totals.clicks : 0;

  return { account: account.label, customerId: account.customerId, date: dateYmd, campaigns: rows, totals };
}
