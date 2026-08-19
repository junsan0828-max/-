// 일일/주간 카카오 브리핑이 공통으로 쓰는 지표 로직 — 지점 라벨, 날짜 계산, 이탈위험 판단,
// 미수금 집계. "이탈위험"의 정의(실제 출석 패턴 기준)는 두 브리핑에서 반드시 같아야 하므로
// dailyBrief.ts에서 분리했다(2026-08-24, 주간 보고 추가하며 리팩터링 — 로직 변경 없음).
import type { NeonQueryFunction } from "@neondatabase/serverless";

export const BRANCH_NAMES: Record<number, string> = { 1: "1호점", 2: "2호점" };
export const BRANCH_IDS = [1, 2];

// 실제 매출로 인정하는 등록 유형만 — "미수금"(과거 미수 수납분)과 "환불"은 새로 발생한 등록이
// 아니므로 제외한다. DB에는 신규/재등록/이전 세 가지만 있고 체험전환·업셀은 별도 subType으로
// 구분 저장되지 않아, 있는 그대로의 라벨을 쓴다.
export const REVENUE_SUBTYPES = ["신규", "재등록", "이전"];

export function branchLabel(branchId: number | null): string {
  return branchId === null ? "지점미지정" : BRANCH_NAMES[branchId] ?? `지점${branchId}`;
}

export function daysBetween(fromYmd: string, toYmd: string): number {
  const a = new Date(fromYmd + "T00:00:00Z").getTime();
  const b = new Date(toYmd + "T00:00:00Z").getTime();
  return Math.round((b - a) / 864e5);
}

/** 만료일과 무관하게 실제 이용 패턴으로 이탈위험을 판단한다:
 * 1) 장기간 미방문(21일 이상), 2) 최근 방문횟수 급감(직전 14일 대비 절반 이하),
 * 3) 기존 방문주기 대비 이용 감소(최근 60일 평균 대비 최근 14일이 절반 이하).
 * 가입한 지 21일 미만인 회원은 비교할 이용 이력이 없어 제외한다.
 *
 * 주의(2026-08-19 실데이터 확인): 이 짐은 출석 체크인을 일부만 기록한다 — 활성회원 216명 중
 * 출석기록이 하나라도 있는 회원은 52명뿐이다. 체크인 기록이 전혀 없는 회원까지 "장기간 미방문"으로
 * 잡으면 활성회원의 70%+가 이탈위험으로 뜨는 등 무의미해져서, 출석기록이 1건이라도 있는 회원만
 * 판단 대상으로 삼는다. 기록이 아예 없는 회원 수는 별도로 세어 브리핑에 데이터 공백으로 안내한다. */
export function computeChurnRisk(
  activeMembers: { id: number; branchId: number | null; membershipStart: string }[],
  attendances: { memberId: number; attendDate: string }[],
  today: string
): { risky: Set<number>; noAttendanceLogCount: number } {
  const byMember = new Map<number, string[]>();
  for (const a of attendances) {
    if (!byMember.has(a.memberId)) byMember.set(a.memberId, []);
    byMember.get(a.memberId)!.push(a.attendDate);
  }

  const risky = new Set<number>();
  let noAttendanceLogCount = 0;
  for (const m of activeMembers) {
    const membershipDays = daysBetween(m.membershipStart, today);
    if (membershipDays < 21) continue; // 이용 이력을 판단하기엔 너무 신규

    const dates = (byMember.get(m.id) ?? []).sort();
    if (dates.length === 0) {
      noAttendanceLogCount++;
      continue; // 출석기록 자체가 없으면 판단 불가 — 미방문으로 단정하지 않는다
    }

    const last14 = dates.filter((d) => daysBetween(d, today) <= 13).length;
    const prev14 = dates.filter((d) => daysBetween(d, today) > 13 && daysBetween(d, today) <= 27).length;
    const last60 = dates.filter((d) => daysBetween(d, today) <= 59).length;
    const avgPer14 = (last60 / 60) * 14;

    const lastVisit = dates[dates.length - 1];
    const daysSinceLastVisit = daysBetween(lastVisit, today);

    const longAbsence = daysSinceLastVisit >= 21;
    const sharpDrop = prev14 >= 3 && last14 <= Math.floor(prev14 / 2);
    const patternDecline = avgPer14 >= 3 && last14 <= avgPer14 * 0.5;

    if (longAbsence || sharpDrop || patternDecline) risky.add(m.id);
  }
  return { risky, noAttendanceLogCount };
}

export interface UnpaidLine {
  customerName: string;
  unpaid: number;
  program: string;
  daysElapsed: number;
}

/** 전체 기간 누적 미수금(현재 잔액 기준) — 특정 주/일에 한정되지 않는 운영 중 잔액이라
 * 일일/주간 브리핑 모두 이 함수 하나를 공유한다. */
export async function gatherUnpaid(sql: NeonQueryFunction<false, false>, today: string) {
  const rows = (await sql.query(
    `SELECT "customerName", "unpaidAmount", "programDetail", "paymentDate"
     FROM revenue_entries WHERE "unpaidAmount" > 0 ORDER BY "unpaidAmount" DESC`
  )) as { customerName: string | null; unpaidAmount: number; programDetail: string | null; paymentDate: string }[];

  const lines: UnpaidLine[] = rows.map((r) => ({
    customerName: r.customerName ?? "이름없음",
    unpaid: Number(r.unpaidAmount),
    program: r.programDetail ?? "미확인",
    daysElapsed: daysBetween(r.paymentDate, today),
  }));

  return {
    lines,
    total: lines.reduce((s, l) => s + l.unpaid, 0),
    memberCount: new Set(lines.map((l) => l.customerName)).size,
  };
}
