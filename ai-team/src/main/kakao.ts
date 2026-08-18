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

function buildBriefText(
  result: OrchestratorResult,
  mina?: MinaResult,
  funnel?: FunnelResult
): string {
  // 카카오 "나에게 보내기" 텍스트 템플릿은 200자 제한(sendToMe에서 190자로 컷) — 지점별
  // 구분이 잘리지 않도록 헤드라인/할일 목록보다 지점별 숫자를 우선한다.
  const lines = [`🧑‍💼 제이 - 오늘의 브리핑`];
  for (const b of result.context.byBranch) {
    lines.push(
      `${b.branchName}: 활성${b.active} 신규${b.newCount} 재등록${b.reRegisterCount} 만료임박${b.expiringSoonCount} 이탈위험${b.recentlyExpiredCount} 미수${Math.round(b.unpaidTotal / 10000)}만`
    );
  }
  // result.tasks는 대표/직원이 검토·실행해야 할 제안 목록(mode: semi/manual 위주)이라
  // "AI가 오늘 할 일" 자리에 넣으면 안 됨 — 여긴 AI가 사람 개입 없이 실제로 자동 실행하는 것만 적는다.
  lines.push("▶ 13시 자동문자 발송(만료 D-10/D-5·상담후속 D+1·재등록유도 D+3~14) — AI 자동실행");
  lines.push("(자세한 내용은 앱/노션에서 확인)");
  return lines.join("\n");
}

export async function pushDailyBriefingKakao(
  result: OrchestratorResult,
  mina?: MinaResult,
  funnel?: FunnelResult,
  _content?: ContentResult
): Promise<KakaoPushResult> {
  return pushKakaoText(buildBriefText(result, mina, funnel));
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
