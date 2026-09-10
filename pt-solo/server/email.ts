import { Resend } from "resend";

export async function sendVerificationEmail(to: string, code: string): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("⚠️ RESEND_API_KEY가 설정되지 않았습니다.");
    return false;
  }

  const resend = new Resend(apiKey);
  const from = "FIT STEP <onboarding@resend.dev>";

  try {
    const { error } = await resend.emails.send({
      from,
      to,
      subject: "[FIT STEP] 이메일 인증 코드",
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#0f0f0f;color:#fff;border-radius:12px;">
          <h2 style="color:#6366f1;margin-bottom:8px;">FIT STEP</h2>
          <p style="color:#aaa;margin-bottom:24px;">트레이너 계정 이메일 인증</p>
          <div style="background:#1c1c1e;border-radius:8px;padding:24px;text-align:center;margin-bottom:24px;">
            <p style="color:#aaa;font-size:13px;margin-bottom:8px;">인증 코드</p>
            <p style="font-size:36px;font-weight:900;letter-spacing:8px;color:#6366f1;margin:0;">${code}</p>
          </div>
          <p style="color:#888;font-size:12px;">이 코드는 10분간 유효합니다.</p>
          <p style="color:#888;font-size:12px;">본인이 요청하지 않은 경우 이 메일을 무시하세요.</p>
        </div>
      `,
    });
    if (error) {
      console.error("이메일 발송 실패:", error.message);
      return false;
    }
    return true;
  } catch (e: any) {
    console.error("이메일 발송 실패:", e?.message || e);
    return false;
  }
}

export async function sendBookingNotificationEmail(
  to: string,
  trainerName: string,
  booking: { name: string; phone: string; interestType?: string | null; message?: string | null }
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;

  const resend = new Resend(apiKey);
  const now = new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });

  try {
    await resend.emails.send({
      from: "FIT STEP <onboarding@resend.dev>",
      to,
      subject: `[FIT STEP] 새 상담 예약 — ${booking.name}님`,
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#ffffff;border-radius:12px;border:1px solid #e5e7eb;">
          <div style="margin-bottom:24px;">
            <h2 style="margin:0 0 4px;font-size:20px;color:#111827;">📋 새 상담 예약이 들어왔어요</h2>
            <p style="margin:0;font-size:13px;color:#6b7280;">${now} · ${trainerName} 트레이너</p>
          </div>
          <div style="background:#f9fafb;border-radius:8px;padding:20px;margin-bottom:20px;">
            <table style="width:100%;border-collapse:collapse;font-size:14px;">
              <tr><td style="padding:6px 0;color:#6b7280;width:80px;">이름</td><td style="padding:6px 0;font-weight:600;color:#111827;">${booking.name}</td></tr>
              <tr><td style="padding:6px 0;color:#6b7280;">연락처</td><td style="padding:6px 0;font-weight:600;color:#111827;">${booking.phone}</td></tr>
              ${booking.interestType ? `<tr><td style="padding:6px 0;color:#6b7280;">관심 프로그램</td><td style="padding:6px 0;color:#111827;">${booking.interestType}</td></tr>` : ""}
              ${booking.message ? `<tr><td style="padding:6px 0;color:#6b7280;vertical-align:top;">메시지</td><td style="padding:6px 0;color:#111827;">${booking.message}</td></tr>` : ""}
            </table>
          </div>
          <p style="font-size:12px;color:#9ca3af;margin:0;">FIT STEP 브랜드 페이지를 통한 예약 신청입니다.</p>
        </div>
      `,
    });
  } catch (e: any) {
    console.error("예약 알림 이메일 발송 실패:", e?.message || e);
  }
}
