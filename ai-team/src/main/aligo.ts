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

// 알리고는 발신 서버 IP를 고정 1개만 화이트리스트로 허용한다(대역/CIDR 등록 불가 — 2026-08-18
// 알리고 고객센터 확인). 클라우드 루틴은 실행마다 발신 IP가 로테이팅돼 절대 화이트리스트를 통과할
// 수 없으므로, 클라우드 .env에만 ALIGO_CLOUD_DISABLED=true를 심어 API 호출 자체를 건너뛴다 —
// 로컬 PC 상주 앱은 이 값이 없어 그대로 실제 발송한다. 실패로 기록되므로(success=false) PC가
// 켜지면 다음 13시 실행 때 자동으로 재시도된다.
export async function sendSms(receiver: string, message: string): Promise<SendSmsResult> {
  if (process.env.ALIGO_CLOUD_DISABLED === "true") {
    return { ok: false, error: "클라우드에서는 발송 안 함 — 로컬 PC 상주 시 자동 재시도 대기 중" };
  }
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

// 알림톡(카카오 비즈니스 메시지) 발송 — SMS와 달리 발신 IP 화이트리스트 제약이 없다(2026-08-24
// 확인, https://smartsms.aligo.in/alimapi.html). 승인된 템플릿 문구를 변수만 치환해 그대로 보내야
// 하며, 임의로 문구를 바꾸면 카카오 정책 위반으로 발송 거부될 수 있다.
const ALIGO_ALIMTALK_URL = "https://kakaoapi.aligo.in/akv10/alimtalk/send/";

export interface AlimtalkButton {
  name: string;
  linkType: "WL" | "AC" | "DS" | "AL" | "BK" | "MD";
  linkMo?: string;
  linkPc?: string;
}

export interface AlimtalkParams {
  receiver: string;
  tplCode: string;
  subject: string;
  message: string;
  emtitle?: string;
  buttons?: AlimtalkButton[];
  testMode?: boolean;
}

function isAlimtalkConfigured() {
  return !!(process.env.ALIGO_USER_ID && process.env.ALIGO_API_KEY && process.env.ALIGO_SENDER && process.env.ALIGO_SENDER_KEY);
}

export async function sendAlimtalk(params: AlimtalkParams): Promise<SendSmsResult> {
  if (!isAlimtalkConfigured()) {
    return { ok: false, error: "알리고 알림톡 미설정 (.env에 ALIGO_SENDER_KEY 필요)" };
  }
  const digits = params.receiver.replace(/[^0-9]/g, "");
  if (!digits) return { ok: false, error: "받는 사람 번호가 없습니다." };

  const body = new URLSearchParams({
    apikey: process.env.ALIGO_API_KEY!,
    userid: process.env.ALIGO_USER_ID!,
    senderkey: process.env.ALIGO_SENDER_KEY!,
    tpl_code: params.tplCode,
    sender: process.env.ALIGO_SENDER!,
    receiver_1: digits,
    subject_1: params.subject,
    message_1: params.message,
  });
  if (params.emtitle) body.set("emtitle_1", params.emtitle);
  if (params.buttons?.length) body.set("button_1", JSON.stringify({ button: params.buttons }));
  if (params.testMode) body.set("testMode", "Y");

  try {
    const res = await fetch(ALIGO_ALIMTALK_URL, { method: "POST", body });
    const data: any = await res.json();
    if (Number(data.code) !== 0) {
      return { ok: false, error: data.message || `알림톡 발송 실패 (code ${data.code})` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
