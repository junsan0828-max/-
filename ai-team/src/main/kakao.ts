// 카카오톡 연동 — "나에게 보내기" API로 제이의 일일 브리핑을 내 카톡으로 직접 보낸다.
// 사업자 등록/알림톡 승인 없이 개인 계정 로그인만으로 쓸 수 있는 공식 기능.
// 최초 1회 `npm run kakao-auth`로 로그인해 refresh token을 받아 .env에 저장해야 동작한다.
import { sendSms } from "./aligo";
import { ADMIN_PHONE } from "./autoMessage";
import { gatherDailyBrief, buildDailyBriefKakaoText } from "./dailyBrief";
import { gatherWeeklyBrief, buildWeeklyBriefKakaoText } from "./weeklyBrief";

export interface KakaoPushResult {
  ok: boolean;
  error?: string;
}

function isConfigured() {
  return !!(process.env.KAKAO_REST_API_KEY && process.env.KAKAO_REFRESH_TOKEN);
}

/** refresh token으로 새 access token 발급 (access token은 몇 시간이면 만료되므로 매번 새로 받는다). */
async function refreshAccessToken(): Promise<string> {
  const res = await fetch("https://kauth.kakao.com/oauth/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: process.env.KAKAO_REST_API_KEY!,
      refresh_token: process.env.KAKAO_REFRESH_TOKEN!,
    }),
  });
  const data: any = await res.json();
  if (!res.ok) throw new Error(data?.error_description || "카카오 토큰 갱신 실패");
  return data.access_token as string;
}

async function sendToMe(accessToken: string, text: string): Promise<void> {
  const templateObject = {
    object_type: "text",
    text: text.slice(0, 200), // 텍스트 템플릿 최대 길이 — 실제로 이 길이를 넘는 조각은 안 만든다(splitForKakao)
    link: { web_url: "https://www.notion.so", mobile_web_url: "https://www.notion.so" },
  };
  const res = await fetch("https://kapi.kakao.com/v2/api/talk/memo/default/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ template_object: JSON.stringify(templateObject) }),
  });
  if (!res.ok) {
    const data: any = await res.json().catch(() => ({}));
    throw new Error(data?.msg || `카카오 발송 실패 (${res.status})`);
  }
}

/** "나에게 보내기"는 개인 계정 무료 API라 여러 통으로 나눠 보내도 비용이 안 든다 — 190자
 * 안에 억지로 압축하지 않고, 줄바꿈 단위로 묶어서 넘치면 자연스럽게 다음 메시지로 이어 보낸다. */
function splitForKakao(text: string, maxLen = 190): string[] {
  const lines = text.split("\n");
  const chunks: string[] = [];
  let current = "";
  for (const line of lines) {
    const candidate = current ? `${current}\n${line}` : line;
    if (candidate.length <= maxLen) {
      current = candidate;
      continue;
    }
    if (current) chunks.push(current);
    // 한 줄 자체가 maxLen보다 길면 그 줄만 강제로 잘라 넣는다.
    current = line.length > maxLen ? line.slice(0, maxLen) : line;
  }
  if (current) chunks.push(current);
  return chunks;
}

/** 오전 9시 브리핑 — "오늘 현황"이 아니라 "어제 하루 운영 결과"를 집계해서 보낸다
 * (2026-08-19 대표 지시, 상세 로직은 dailyBrief.ts). 카카오 발송 실패 시 다른 자동화와
 * 동일하게 대표 번호로 SMS 대체 발송한다. */
export async function pushDailyBriefingKakao(): Promise<KakaoPushResult> {
  let text: string;
  try {
    const brief = await gatherDailyBrief();
    text = buildDailyBriefKakaoText(brief);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }

  const kakao = await pushKakaoText(text);
  if (kakao.ok) return kakao;

  const sms = await sendSms(ADMIN_PHONE, text);
  if (sms.ok) return { ok: true };
  return { ok: false, error: `카카오 실패(${kakao.error}) / SMS 대체도 실패(${sms.error})` };
}

/** 매주 월요일 오전 주간 운영 보고 — 직전 월~토 6일 실적을 전주와 비교해서 보낸다
 * (2026-08-24 대표 지시, 상세 로직은 weeklyBrief.ts). 일일 브리핑과 동일하게 카카오 실패 시
 * SMS로 대체 발송한다. */
export async function pushWeeklyBriefingKakao(): Promise<KakaoPushResult> {
  let text: string;
  try {
    const brief = await gatherWeeklyBrief();
    text = buildWeeklyBriefKakaoText(brief);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }

  const kakao = await pushKakaoText(text);
  if (kakao.ok) return kakao;

  const sms = await sendSms(ADMIN_PHONE, text);
  if (sms.ok) return { ok: true };
  return { ok: false, error: `카카오 실패(${kakao.error}) / SMS 대체도 실패(${sms.error})` };
}

/** 임의의 텍스트를 대표 본인의 카카오톡으로 보낸다 — 급여 정산 완료, 자동문자 발송 요약,
 * 협의실 미해결 안건 등 다른 자동화에서도 재사용하는 범용 발송 함수. 200자 넘으면 여러 통으로
 * 나눠 순서대로 보낸다(무료 API라 통 수는 비용과 무관 — 대표 확인, 2026-08-18). */
export async function pushKakaoText(text: string): Promise<KakaoPushResult> {
  if (!isConfigured()) {
    return { ok: false, error: "카카오 미설정 (.env에 KAKAO_REST_API_KEY/KAKAO_REFRESH_TOKEN 필요)" };
  }
  try {
    const accessToken = await refreshAccessToken();
    const chunks = splitForKakao(text);
    for (let i = 0; i < chunks.length; i++) {
      const body = chunks.length > 1 ? `(${i + 1}/${chunks.length})\n${chunks[i]}` : chunks[i];
      await sendToMe(accessToken, body);
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export function isKakaoEnabled(): boolean {
  return isConfigured();
}
