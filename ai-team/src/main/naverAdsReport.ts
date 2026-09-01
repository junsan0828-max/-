// 네이버 검색광고 주간 리포트 — 지점별(ziantgym1/dreamfitt) 파워링크·플레이스 성과를
// 요약해 대표 카카오톡("나에게 보내기")으로 보낸다. weeklyBrief.ts와 같은 발송 방식 재사용.
import { getNaverAdsAccounts, fetchRangeSummary, fetchKeywordSummary, NaverAdsAccount } from "./naverAds";
import { pushKakaoText } from "./kakao";
import { sendSms } from "./aligo";
import { ADMIN_PHONE, addDays, todayStr } from "./autoMessage";

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
}

export async function runNaverAdsReportJob(): Promise<NaverAdsReportResult> {
  const accounts = getNaverAdsAccounts();
  if (accounts.length === 0) {
    return { ok: false, error: "등록된 네이버 검색광고 계정이 없습니다." };
  }

  const today = todayStr();
  const since = addDays(today, -7);
  const until = addDays(today, -1);

  const sections = await Promise.all(accounts.map((a) => buildAccountSection(a, since, until)));
  const text = `[네이버 광고 주간 리포트 ${since}~${until}]\n\n${sections.join("\n\n")}`;

  const kakao = await pushKakaoText(text);
  if (kakao.ok) return { ok: true, text };

  const sms = await sendSms(ADMIN_PHONE, text);
  if (sms.ok) return { ok: true, text };
  return { ok: false, error: `카카오 실패(${kakao.error}) / SMS 대체도 실패(${sms.error})`, text };
}
