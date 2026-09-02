// 네이버 검색광고 주간 리포트 — 지점별(ziantgym1/dreamfitt) 파워링크·플레이스 성과를
// 요약해 대표 카카오톡("나에게 보내기")으로 보낸다. weeklyBrief.ts와 같은 발송 방식 재사용.
import { getNaverAdsAccounts, fetchRangeSummary, fetchKeywordSummary, NaverAdsAccount } from "./naverAds";
import { pushKakaoText } from "./kakao";
import { sendSms } from "./aligo";
import { ADMIN_PHONE, addDays, todayStr } from "./autoMessage";
import { createNotionPage } from "./notion";

const ACCOUNT_LABEL: Record<string, string> = { ziantgym1: "ziantgym1(1호점)", dreamfitt: "dreamfitt(2호점)" };

function fmt(n: number) {
  return Math.round(n).toLocaleString();
}

async function buildAccountSection(account: NaverAdsAccount, since: string, until: string): Promise<string> {
  const summary = await fetchRangeSummary(account, since, until);
  const label = ACCOUNT_LABEL[account.label] ?? account.label;
  const lines = [`[${label}]`];

  for (const [type, t] of Object.entries(summary.byType)) {
    lines.push(`${type}: 노출 ${fmt(t.impressions)}·클릭 ${fmt(t.clicks)}·비용 ${fmt(t.cost)}원·CTR ${t.ctr.toFixed(2)}%`);
  }
  const g = summary.totals;
  lines.push(`합계: 노출 ${fmt(g.impressions)}·클릭 ${fmt(g.clicks)}·비용 ${fmt(g.cost)}원`);

  try {
    const keywords = await fetchKeywordSummary(account, since, until);
    const wasted = keywords.filter((k) => k.impressions >= 30 && k.clicks === 0).sort((a, b) => b.impressions - a.impressions).slice(0, 5);
    if (wasted.length > 0) {
      lines.push(`⚠ 노출만 있고 클릭 0: ${wasted.map((k) => `${k.keyword}(${k.impressions})`).join(", ")}`);
    }
  } catch {
    // 파워링크 캠페인이 없거나 키워드 조회 실패해도 리포트 본문(요약)은 그대로 보낸다.
  }

  return lines.join("\n");
}

export interface NaverAdsReportResult {
  ok: boolean;
  error?: string;
  text?: string;
  notionUrl?: string;
  notionError?: string;
}

async function runReport(since: string, until: string, periodLabel: string): Promise<NaverAdsReportResult> {
  const accounts = getNaverAdsAccounts();
  if (accounts.length === 0) {
    return { ok: false, error: "등록된 네이버 검색광고 계정이 없습니다." };
  }

  const sections = await Promise.all(accounts.map((a) => buildAccountSection(a, since, until)));
  const text = `[네이버 광고 ${periodLabel} ${since}~${until}]\n\n${sections.join("\n\n")}`;

  // 노션 기록은 카카오 발송 성패와 무관하게 항상 시도한다 — 리포트 아카이브 목적이라 이력이
  // 남는 게 더 중요하고, 실패해도 카카오 발송(대표 알림)은 그대로 진행되게 한다.
  const notion = await createNotionPage(`네이버 광고 ${periodLabel} - ${since}~${until}`, text);

  const kakao = await pushKakaoText(text);
  if (kakao.ok) return { ok: true, text, notionUrl: notion.url, notionError: notion.ok ? undefined : notion.error };

  const sms = await sendSms(ADMIN_PHONE, text);
  if (sms.ok) return { ok: true, text, notionUrl: notion.url, notionError: notion.ok ? undefined : notion.error };
  return {
    ok: false,
    error: `카카오 실패(${kakao.error}) / SMS 대체도 실패(${sms.error})`,
    text,
    notionUrl: notion.url,
    notionError: notion.ok ? undefined : notion.error,
  };
}

export async function runNaverAdsReportJob(): Promise<NaverAdsReportResult> {
  const today = todayStr();
  const since = addDays(today, -7);
  const until = addDays(today, -1);
  return runReport(since, until, "주간 리포트");
}

// 매월 1일 실행 기준 "저번 달 1일~말일" 전체를 집계한다.
export async function runNaverAdsMonthlyReportJob(): Promise<NaverAdsReportResult> {
  const today = todayStr();
  const thisMonthStart = `${today.slice(0, 7)}-01`;
  const lastMonthEnd = addDays(thisMonthStart, -1);
  const lastMonthStart = `${lastMonthEnd.slice(0, 7)}-01`;
  return runReport(lastMonthStart, lastMonthEnd, "월간 리포트");
}
