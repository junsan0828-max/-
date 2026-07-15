// 카카오톡 연동 — "나에게 보내기" API로 제이의 일일 브리핑을 내 카톡으로 직접 보낸다.
// 사업자 등록/알림톡 승인 없이 개인 계정 로그인만으로 쓸 수 있는 공식 기능.
// 최초 1회 `npm run kakao-auth`로 로그인해 refresh token을 받아 .env에 저장해야 동작한다.
import { OrchestratorResult } from "./orchestrator";
import { MinaResult } from "./mina";
import { FunnelResult } from "./dataAgent";
import { ContentResult } from "./luna";

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
    text: text.slice(0, 190), // 기본 텍스트 템플릿 길이 제한
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

function buildBriefText(
  result: OrchestratorResult,
  mina?: MinaResult,
  funnel?: FunnelResult
): string {
  const lines = [`🧑‍💼 제이 - 오늘의 브리핑`, result.headline, ""];
  const top = result.tasks.slice(0, 3);
  if (top.length > 0) {
    lines.push("오늘 할 일:");
    top.forEach((t) => lines.push(`- ${t.title}`));
  }
  if (mina && mina.messages.length > 0) {
    lines.push(`\n미나: 문자 대상 ${mina.messages.length}건`);
  }
  if (funnel) {
    lines.push(`\n${funnel.insight.split("\n")[0]}`);
  }
  lines.push("\n(자세한 내용은 앱/노션에서 확인)");
  return lines.join("\n");
}

export async function pushDailyBriefingKakao(
  result: OrchestratorResult,
  mina?: MinaResult,
  funnel?: FunnelResult,
  _content?: ContentResult
): Promise<KakaoPushResult> {
  if (!isConfigured()) {
    return { ok: false, error: "카카오 미설정 (.env에 KAKAO_REST_API_KEY/KAKAO_REFRESH_TOKEN 필요)" };
  }
  try {
    const accessToken = await refreshAccessToken();
    await sendToMe(accessToken, buildBriefText(result, mina, funnel));
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export function isKakaoEnabled(): boolean {
  return isConfigured();
}
