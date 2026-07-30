import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

export interface NotificationRow {
  label: string;
  value: string;
  highlight?: boolean;
}

/**
 * 회원 신청(재등록·포인트 충전·회원권 연장·상품 구매·포인트 적립)이 접수되면 관리자에게 알린다.
 * 관리자 화면의 종 알림만으로는 확인이 늦어져 신청이 방치될 수 있으므로 메일로 함께 통지한다.
 * 메일 발송 실패가 신청 자체를 막아서는 안 되므로 호출부에서 반드시 catch 할 것.
 */
export async function sendRequestNotification({
  kind,
  memberName,
  memberPhone,
  rows,
  actionHint,
  requestedAt,
}: {
  kind: string;
  memberName: string;
  memberPhone: string;
  rows: NotificationRow[];
  actionHint: string;
  requestedAt?: string;
}) {
  // 대표 메일은 항상 받는다. ADMIN_EMAIL로 담당 직원 주소를 추가 지정할 수 있으며,
  // 그 값이 대표 주소와 다르면 함께 발송한다(설정이 잘못돼도 대표가 놓치지 않도록).
  const OWNER_EMAIL = "junsan0828@gmail.com";
  const extra = process.env.ADMIN_EMAIL?.trim();
  const to = extra && extra !== OWNER_EMAIL ? `${OWNER_EMAIL}, ${extra}` : OWNER_EMAIL;

  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) return;

  const at = requestedAt ?? new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
  const allRows: NotificationRow[] = [
    { label: "회원명", value: memberName || "-" },
    { label: "연락처", value: memberPhone || "-" },
    ...rows,
    { label: "신청 시각", value: at },
  ];

  const rowsHtml = allRows
    .map((r, i) => `
      <tr${i < allRows.length - 1 ? ' style="border-bottom: 1px solid #f3f4f6;"' : ""}>
        <td style="padding: 10px 0; color: #6b7280; width: 110px;">${r.label}</td>
        <td style="padding: 10px 0; ${r.highlight ? "font-weight: 700; color: #1D4ED8;" : "font-weight: 500;"}">${r.value}</td>
      </tr>`)
    .join("");

  await transporter.sendMail({
    from: `"ZIANTGYM+" <${process.env.GMAIL_USER}>`,
    to,
    subject: `[${kind}] ${memberName || "회원"} 님 신청`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 12px;">
        <h2 style="font-size: 18px; font-weight: 700; margin: 0 0 16px;">${kind} 신청이 접수되었습니다</h2>
        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">${rowsHtml}</table>
        <div style="margin-top: 20px; padding: 12px 16px; background: #f9fafb; border-radius: 8px; font-size: 12px; color: #6b7280;">
          ${actionHint}
        </div>
      </div>
    `,
  });
}

/** 기존 포인트 적립 신청 알림 (호출부 호환 유지) */
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
  await sendRequestNotification({
    kind: "포인트 적립",
    memberName,
    memberPhone,
    requestedAt: claimedAt,
    rows: [
      { label: "이벤트", value: eventTitle },
      { label: "적립 포인트", value: `+${pointAmount.toLocaleString("ko-KR")}P`, highlight: true },
    ],
    actionHint: "블로그 댓글·리뷰를 확인한 후 관리자 페이지에서 승인/반려 처리해 주세요.",
  });
}
