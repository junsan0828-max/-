import nodemailer from "nodemailer";

export function createTransporter() {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || "587");
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    console.warn("⚠️ SMTP 환경변수가 설정되지 않았습니다. 이메일 발송이 비활성화됩니다.");
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });
}

export async function sendVerificationEmail(to: string, code: string): Promise<boolean> {
  const transporter = createTransporter();
  if (!transporter) return false;

  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  try {
    await transporter.sendMail({
      from: `FIT STEP <${from}>`,
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
    return true;
  } catch (e) {
    console.error("이메일 발송 실패:", e);
    return false;
  }
}
