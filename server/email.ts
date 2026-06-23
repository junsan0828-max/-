import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

export async function sendPointClaimNotification({
  memberName,
  memberPhone,
  eventTitle,
  pointAmount,
  claimedAt,
}: {
  memberName: string;
  memberPhone: string;
  eventTitle: string;
  pointAmount: number;
  claimedAt: string;
}) {
  const to = process.env.ADMIN_EMAIL;
  if (!to || !process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) return;

  await transporter.sendMail({
    from: `"ZIANTGYM+" <${process.env.GMAIL_USER}>`,
    to,
    subject: `[포인트 신청] ${memberName} 님 · ${eventTitle}`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 12px;">
        <h2 style="font-size: 18px; font-weight: 700; margin: 0 0 16px;">포인트 적립 신청이 왔습니다</h2>
        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
          <tr style="border-bottom: 1px solid #f3f4f6;">
            <td style="padding: 10px 0; color: #6b7280; width: 100px;">회원명</td>
            <td style="padding: 10px 0; font-weight: 600;">${memberName}</td>
          </tr>
          <tr style="border-bottom: 1px solid #f3f4f6;">
            <td style="padding: 10px 0; color: #6b7280;">연락처</td>
            <td style="padding: 10px 0;">${memberPhone || "-"}</td>
          </tr>
          <tr style="border-bottom: 1px solid #f3f4f6;">
            <td style="padding: 10px 0; color: #6b7280;">이벤트</td>
            <td style="padding: 10px 0;">${eventTitle}</td>
          </tr>
          <tr style="border-bottom: 1px solid #f3f4f6;">
            <td style="padding: 10px 0; color: #6b7280;">적립 포인트</td>
            <td style="padding: 10px 0; font-weight: 700; color: #1D4ED8;">+${pointAmount.toLocaleString("ko-KR")}P</td>
          </tr>
          <tr>
            <td style="padding: 10px 0; color: #6b7280;">신청 시각</td>
            <td style="padding: 10px 0;">${claimedAt}</td>
          </tr>
        </table>
        <div style="margin-top: 20px; padding: 12px 16px; background: #f9fafb; border-radius: 8px; font-size: 12px; color: #6b7280;">
          블로그 댓글을 확인 후 관리자 페이지에서 승인/반려 처리해 주세요.
        </div>
      </div>
    `,
  });
}
