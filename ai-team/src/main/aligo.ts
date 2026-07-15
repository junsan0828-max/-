// 알리고(Aligo) 문자 발송 연동 — 미나가 만든 문자 초안을 사장님 승인 후 실제로 발송한다.
// https://smartsms.aligo.in API. 바이트 수 기준 90바이트 이하면 SMS, 넘으면 LMS로 자동 판단해 보낸다.
const ALIGO_SEND_URL = "https://apis.aligo.in/send/";

export interface SendSmsResult {
  ok: boolean;
  error?: string;
}

function isConfigured() {
  return !!(process.env.ALIGO_USER_ID && process.env.ALIGO_API_KEY && process.env.ALIGO_SENDER);
}

function byteLength(text: string): number {
  // 한글은 2바이트로 계산 (알리고 SMS/LMS 판단 기준인 EUC-KR 근사치).
  let len = 0;
  for (const ch of text) len += ch.charCodeAt(0) > 127 ? 2 : 1;
  return len;
}

export async function sendSms(receiver: string, message: string): Promise<SendSmsResult> {
  if (!isConfigured()) {
    return { ok: false, error: "알리고 미설정 (.env에 ALIGO_USER_ID/ALIGO_API_KEY/ALIGO_SENDER 필요)" };
  }
  const digits = receiver.replace(/[^0-9]/g, "");
  if (!digits) return { ok: false, error: "받는 사람 번호가 없습니다." };

  const body = new URLSearchParams({
    key: process.env.ALIGO_API_KEY!,
    user_id: process.env.ALIGO_USER_ID!,
    sender: process.env.ALIGO_SENDER!,
    receiver: digits,
    msg: message,
    msg_type: byteLength(message) > 90 ? "LMS" : "SMS",
  });

  try {
    const res = await fetch(ALIGO_SEND_URL, { method: "POST", body });
    const data: any = await res.json();
    if (String(data.result_code) !== "1") {
      return { ok: false, error: data.message || `알리고 발송 실패 (code ${data.result_code})` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export function isAligoEnabled(): boolean {
  return isConfigured();
}
