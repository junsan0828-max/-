// 자이언트짐+ 오픈 안내 — 전체 유효 활성회원에게 1회성으로 보내는 공지 문자.
// D-10/D-5/재등록유도처럼 매일 도는 게 아니라 캠페인성 발송이라, auto_message_log에
// 고정 referenceDate("gymplus_launch_2026")로 기록해 실수로 두 번 실행해도 중복 발송되지 않는다.
// 문구·발송 대상(정확한 유효 활성회원 정의) 2026-08-17 대표 확정.
import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import { sendSms } from "./aligo";
import { pushKakaoText } from "./kakao";
import { ensureLogTable, alreadySent, logAttempt, normalizePhone } from "./autoMessage";

const REFERENCE_DATE = "gymplus_launch_2026";
const ADMIN_PHONE = "01075593111";

export const GYMPLUS_LAUNCH_MESSAGE = `안녕하세요, 자이언트짐입니다.

회원 여러분을 위한 자이언트짐+ 회원전용 앱이 오픈했습니다.

운동영상, 운동기록, 맞춤식단, 이벤트 안내까지 한 곳에서 확인하실 수 있습니다.

센터 방문 출석 체크는 물론, 자이언트짐+ 앱 안에서도 포인트 적립이 가능하며, 적립된 포인트는 사용도 가능합니다.

지금 바로 이용해보세요.
https://ziantgym.com/gym-plus
(아이디: 휴대폰번호 / 비밀번호: 휴대폰번호 뒷자리 4자리)

감사합니다.`;

type TargetRow = { id: number; name: string; phone: string | null; branchId: number | null };

/** 정확한 유효 활성회원: status='active' AND (membershipEnd가 없거나 오늘 이후) —
 * 통합운영시스템 AdminMembers.tsx와 동일한 정의를 그대로 쓴다([[verify.ts]]와 동일). */
async function findValidActiveMembers(sql: NeonQueryFunction<false, false>, today: string): Promise<TargetRow[]> {
  return (await sql.query(
    `SELECT id, name, phone, "branchId" AS "branchId" FROM members
     WHERE status = 'active' AND ("membershipEnd" IS NULL OR "membershipEnd" >= $1)`,
    [today]
  )) as TargetRow[];
}

export interface AnnounceResult {
  ok: boolean;
  error?: string;
  targeted: number;
  sent: number;
  failed: number;
  skippedInvalidPhone: number;
  alreadyDone: number;
}

export async function runGymplusLaunchAnnounce(): Promise<AnnounceResult> {
  const url = process.env.DATABASE_URL;
  if (!url) return { ok: false, error: "DATABASE_URL이 설정되어 있지 않습니다.", targeted: 0, sent: 0, failed: 0, skippedInvalidPhone: 0, alreadyDone: 0 };
  const sql = neon(url);
  await ensureLogTable(sql);

  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
  const candidates = await findValidActiveMembers(sql, today);

  let sent = 0;
  let failed = 0;
  let skippedInvalidPhone = 0;
  let alreadyDone = 0;
  const sentNames: string[] = [];

  for (const m of candidates) {
    if (await alreadySent(sql, "gymplus_launch", "member_id", m.id, REFERENCE_DATE)) {
      alreadyDone++;
      continue;
    }

    const phone = normalizePhone(m.phone);
    if (!phone) {
      skippedInvalidPhone++;
      await logAttempt(sql, {
        category: "gymplus_launch",
        memberId: m.id,
        referenceDate: REFERENCE_DATE,
        name: m.name,
        phone: m.phone,
        branchId: m.branchId,
        success: false,
        error: "연락처 누락·확인 필요",
      });
      continue;
    }

    const result = await sendSms(phone, GYMPLUS_LAUNCH_MESSAGE);
    if (result.ok) {
      sent++;
      sentNames.push(m.name);
    } else {
      failed++;
    }
    await logAttempt(sql, {
      category: "gymplus_launch",
      memberId: m.id,
      referenceDate: REFERENCE_DATE,
      name: m.name,
      phone,
      branchId: m.branchId,
      success: result.ok,
      error: result.error,
    });
  }

  const summaryText =
    `[자이언트짐+ 오픈 안내 발송 완료]\n대상 ${candidates.length}명 · 발송 ${sent} · 실패 ${failed} · 연락처확인 ${skippedInvalidPhone} · 기발송(중복제외) ${alreadyDone}`;
  const kakao = await pushKakaoText(summaryText);
  if (!kakao.ok) {
    await sendSms(ADMIN_PHONE, summaryText).catch(() => {});
  }

  return { ok: true, targeted: candidates.length, sent, failed, skippedInvalidPhone, alreadyDone };
}
