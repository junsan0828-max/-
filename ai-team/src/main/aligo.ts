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

// 알림톡(카카오 비즈니스 메시지) 발송. 승인된 템플릿 문구를 변수만 치환해 그대로 보내야 하며,
// 임의로 문구를 바꾸면 카카오 정책 위반으로 발송 거부될 수 있다.
// 2026-08-25 확인: (1) SMS와 마찬가지로 알리고의 발신 IP 화이트리스트에 걸린다 — "IP 제약 없음"은
// testMode=Y가 IP 검사를 건너뛰어서 생긴 착시였다. 클라우드에서는 실발송 안 되고 로컬 PC에서만 된다.
// (2) 더 위험한 문제: 승인 템플릿에 버튼이 있는데 button_1을 안 보내면, 문구가 100% 일치해도
// 카카오가 "메시지가 템플릿과 일치하지않음"으로 조용히 실배송 처리한다 — 그런데 발송 API 자체는
// code:0(정상 접수)로 응답하기 때문에 이 함수만 보면 성공으로 착각한다. 그래서 발송 접수 후
// akv10/history/detail/로 실제 배송 결과(rslt)를 확인하기 전까진 ok:true를 반환하지 않는다.
const ALIGO_ALIMTALK_URL = "https://kakaoapi.aligo.in/akv10/alimtalk/send/";
const ALIGO_ALIMTALK_HISTORY_DETAIL_URL = "https://kakaoapi.aligo.in/akv10/history/detail/";

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

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// 발송 접수(mid) 후 카카오 쪽 실제 배송 결과가 반영되기까지 몇 초 걸린다(직접 확인: 4~6초).
// 최대 6회(약 18초) 재시도하며 rslt가 채워지길 기다린다 — 그래도 안 채워지면 "확인 시간 초과"로
// 실패 취급(재시도 대상으로 남김, 거짓 성공보다 안전한 쪽).
async function verifyAlimtalkDelivery(mid: string): Promise<{ delivered: boolean; error?: string }> {
  for (let attempt = 0; attempt < 6; attempt++) {
    await sleep(3000);
    try {
      const body = new URLSearchParams({
        apikey: process.env.ALIGO_API_KEY!,
        userid: process.env.ALIGO_USER_ID!,
        mid,
      });
      const res = await fetch(ALIGO_ALIMTALK_HISTORY_DETAIL_URL, { method: "POST", body });
      const data: any = await res.json();
      const item = data.list?.[0];
      if (!item || !item.rslt) continue; // 아직 결과 반영 전 — 재시도
      if (item.rslt === "0") return { delivered: true };
      return { delivered: false, error: item.rslt_message || `배송 실패 (rslt ${item.rslt})` };
    } catch {
      // 네트워크 일시 오류 — 재시도
    }
  }
  return { delivered: false, error: "배송 결과 확인 시간 초과(응답 지연) — 다음 실행에서 재시도됨" };
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
    // testMode는 실제 배송이 발생하지 않으므로(알리고 명세) 배송 확인을 건너뛴다 — 진단 전용.
    if (params.testMode) return { ok: true };

    const mid = data.info?.mid;
    if (!mid) return { ok: true };
    const verify = await verifyAlimtalkDelivery(String(mid));
    if (!verify.delivered) return { ok: false, error: verify.error };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
