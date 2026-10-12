// PT 출석 체크(회원명 + 날짜 → PT 횟수 차감).
// 대표가 대화창에서 "회원명, 날짜"만 말하면 처리할 수 있도록 트레이너·패키지를 자동으로 정한다
// (2026-09-09 대표 확정): 트레이너는 회원 담당 트레이너(members.trainerId)를 자동 적용,
// 활성 PT 패키지가 여럿이면 남은 횟수가 있는 것 중 가장 오래된 패키지부터 자동 차감.
// pt_session_logs는 실제 앱(트레이너용)이 쓰는 것과 동일한 테이블이라 트레이너 정산(payroll.ts)에
// 그대로 반영된다 — usedSessions는 트리거가 아니라 매번 수동으로 +1 해줘야 한다(실측 확인: 두 값이
// 항상 pt_session_logs 건수와 정확히 일치).
import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

export interface MemberMatch {
  id: number;
  name: string;
  branchId: number | null;
  trainerId: number | null;
}

export interface PtPackageCandidate {
  id: number;
  packageName: string | null;
  usedSessions: number;
  totalSessions: number;
  trainerId: number | null;
}

export interface PtAttendanceResult {
  ok: boolean;
  error?: string;
  needsDisambiguation?: MemberMatch[];
  member?: MemberMatch;
  packageName?: string | null;
  usedSessions?: number;
  totalSessions?: number;
  trainerId?: number;
  sessionLogId?: number;
}

const BRANCH_NAMES: Record<number, string> = { 1: "1호점", 2: "2호점" };

export function branchLabel(branchId: number | null): string {
  return branchId != null ? (BRANCH_NAMES[branchId] ?? `지점${branchId}`) : "지점미지정";
}

export async function findMembersByName(sql: NeonQueryFunction<false, false>, name: string): Promise<MemberMatch[]> {
  return (await sql.query(
    `SELECT id, name, "branchId", "trainerId" FROM members WHERE name = $1 AND status = 'active' ORDER BY id`,
    [name]
  )) as MemberMatch[];
}

export async function findUsablePackage(
  sql: NeonQueryFunction<false, false>,
  memberId: number
): Promise<PtPackageCandidate | null> {
  const rows = (await sql.query(
    `SELECT id, "packageName", "usedSessions", "totalSessions", "trainerId"
     FROM pt_packages
     WHERE "memberId" = $1 AND status = 'active' AND "usedSessions" < "totalSessions"
     ORDER BY COALESCE("startDate", "createdAt") ASC
     LIMIT 1`,
    [memberId]
  )) as PtPackageCandidate[];
  return rows[0] ?? null;
}

/** 이름+날짜로 PT 출석(1회 차감)을 기록한다. 동명이인이면 needsDisambiguation으로 후보를 돌려준다 —
 * 그 경우 checkPtAttendanceForMember를 memberId로 다시 호출해야 한다. */
export async function checkPtAttendanceByName(
  sql: NeonQueryFunction<false, false>,
  name: string,
  sessionDate: string
): Promise<PtAttendanceResult> {
  const matches = await findMembersByName(sql, name);
  if (matches.length === 0) return { ok: false, error: `활성회원 중 "${name}" 이름을 찾을 수 없습니다.` };
  if (matches.length > 1) return { ok: false, error: "동명이인이 있습니다.", needsDisambiguation: matches };
  return checkPtAttendanceForMember(sql, matches[0], sessionDate);
}

export async function checkPtAttendanceForMember(
  sql: NeonQueryFunction<false, false>,
  member: MemberMatch,
  sessionDate: string
): Promise<PtAttendanceResult> {
  const existing = (await sql.query(
    `SELECT id FROM pt_session_logs WHERE "memberId" = $1 AND "sessionDate" = $2 LIMIT 1`,
    [member.id, sessionDate]
  )) as { id: number }[];
  if (existing.length > 0) {
    return { ok: false, error: `${member.name} 회원님은 ${sessionDate}에 이미 PT 출석 기록이 있습니다(중복 방지).` };
  }

  const pkg = await findUsablePackage(sql, member.id);
  if (!pkg) return { ok: false, error: `${member.name} 회원님은 사용 가능한(남은 횟수 있는) 활성 PT 패키지가 없습니다.`, member };

  const trainerId = member.trainerId ?? pkg.trainerId;
  if (!trainerId) return { ok: false, error: `${member.name} 회원님의 담당 트레이너 정보가 없어 자동 기록할 수 없습니다.`, member };

  const inserted = (await sql.query(
    `INSERT INTO pt_session_logs ("memberId", "trainerId", "packageId", "sessionDate")
     VALUES ($1, $2, $3, $4) RETURNING id`,
    [member.id, trainerId, pkg.id, sessionDate]
  )) as { id: number }[];

  await sql.query(
    `UPDATE pt_packages SET "usedSessions" = "usedSessions" + 1, "updatedAt" = (now())::text WHERE id = $1`,
    [pkg.id]
  );

  return {
    ok: true,
    member,
    packageName: pkg.packageName,
    usedSessions: pkg.usedSessions + 1,
    totalSessions: pkg.totalSessions,
    trainerId,
    sessionLogId: inserted[0].id,
  };
}

export function getSql(): NeonQueryFunction<false, false> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL이 설정되어 있지 않습니다.");
  return neon(url);
}
