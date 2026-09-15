import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, and, sql, desc, inArray } from "drizzle-orm";
import {
  members,
  trainers,
  trainerSettings,
  ptPackages,
  attendances,
  ptSessionLogs,
  revenueEntries,
} from "../drizzle/schema";

if (!process.env.DATABASE_URL) {
  console.error("⚠️  DATABASE_URL 환경변수가 설정되지 않았습니다. Railway Variables 탭에서 추가하세요.");
}

const dbUrl = process.env.DATABASE_URL || "postgresql://localhost/fallback";

export const pool = new Pool({
  connectionString: dbUrl,
  ssl: dbUrl.includes("localhost") ? false : { rejectUnauthorized: false },
  max: 5,
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 10000,
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
});

pool.on("error", (err) => {
  console.error("pg pool error:", err.message);
});

export const db = drizzle(pool);

export function getDb() {
  return db;
}

// 서비스(무료) 세션 판정 — 정산 화면 전체가 이 하나를 공유한다 (원칙 7).
// 전량 서비스 패키지에 유령 결제금액이 남아 있으면 회당 단가가 폭등하므로,
// 로그 플래그가 빠져 있어도 패키지가 전량 서비스면 서비스로 본다.
export function isServiceLog(l: {
  isServiceSession?: number | null;
  packageName?: string | null;
  serviceSessions?: number | null;
  totalSessions?: number | null;
}) {
  if (l.isServiceSession === 1) return true;
  if (l.packageName === "서비스세션") return true;
  const svc = l.serviceSessions ?? 0;
  const total = l.totalSessions ?? 0;
  return svc > 0 && total > 0 && svc >= total;
}

// 날짜 문자열에 개월을 더한다. JS setMonth는 1/31 + 1개월 = 3/3 으로 넘어가므로
// 말일을 넘지 않게 자른다(1/31 + 1개월 = 2/28).
export function addMonths(dateStr: string, months: number): string {
  const [y, m, d] = dateStr.substring(0, 10).split("-").map(Number);
  const dt = new Date(y, m - 1, 1);
  dt.setMonth(dt.getMonth() + months);
  const lastDay = new Date(dt.getFullYear(), dt.getMonth() + 1, 0).getDate();
  dt.setDate(Math.min(d, lastDay));
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

// 다이어트 페이백 개월을 회원권 만료일에 반영한다 — 이 로직 하나를 공유한다(원칙 7).
//
// 페이백 1개월 = "기존 회원권 만료일 + 1개월"이다. 그래서 절대 날짜로 덮어쓰지 않는다.
// 예전 방식은 "다이어트 시작일 + 12주 + 적립개월"을 계산해 그보다 짧을 때만 반영했다.
// 회원이 더 긴 회원권(예: 헬스 1년권)을 이미 갖고 있으면 조건이 거짓이 되어,
// 3kg을 빼도 만료일이 하루도 늘지 않았다.
//
// 대신 이미 반영한 개월수(appliedMonths)와의 차이만큼만 더하거나 뺀다. 그래서
//  · 재등록 등 다른 연장과 겹쳐도 어긋나지 않고
//  · 체중 기록을 지우거나 고치면 그만큼 되돌아가고
//  · 같은 상태에서 몇 번을 호출해도 결과가 같다(멱등).
// 만료일은 덮어써지는 값이라, 움직일 때마다 diet_payback_grants에 previousEnd/newEnd를
// 남긴다. 그래야 나중에 숫자가 이상할 때 "원래 며칠이었고 누가 언제 왜 바꿨는지"를
// 되짚을 수 있다(point_membership_extensions와 같은 방식).
export async function recalcDietPayback(
  programId: number,
  ctx?: { source?: "member_app" | "admin" | "admin_delete" | "backfill"; actor?: string; note?: string }
) {
  const source = ctx?.source ?? "admin";
  const prog = await pool.query<{ memberId: number; applied: number }>(
    `SELECT "memberId", COALESCE("appliedMonths",0) AS applied FROM diet_programs WHERE id = $1 LIMIT 1`,
    [programId]
  );
  if (!prog.rows[0]) return null;
  const { memberId, applied } = prog.rows[0];

  const sum = await pool.query<{ earned: number }>(
    `SELECT COALESCE(SUM("bonusMonthsEarned"),0)::int AS earned FROM diet_weight_checks WHERE "programId" = $1`,
    [programId]
  );
  const earned = Math.max(0, Math.min(9, sum.rows[0]?.earned ?? 0));
  const delta = earned - applied;
  if (delta === 0) return { earned, applied, delta: 0, changed: false as const };

  const mem = await pool.query<{ membershipEnd: string | null }>(
    `SELECT "membershipEnd" FROM members WHERE id = $1 LIMIT 1`, [memberId]
  );
  const current = mem.rows[0]?.membershipEnd;

  if (!current) {
    // 기준이 될 만료일이 없으면 날짜는 건드리지 않는다(추측해서 만들지 않는다).
    // applied도 올리지 않아, 만료일이 생긴 뒤 다시 반영된다. 시도한 사실만 남긴다.
    await pool.query(
      `INSERT INTO diet_payback_grants
         ("programId","memberId",months,"totalEarned","previousEnd","newEnd",source,actor,note)
       VALUES ($1,$2,$3,$4,NULL,NULL,$5,$6,$7)`,
      [programId, memberId, delta, earned, source, ctx?.actor ?? null,
       "회원권 만료일이 없어 반영하지 못함 — 만료일 입력 후 체중을 다시 저장하면 반영된다"]
    );
    return { earned, applied, delta, changed: false as const, reason: "회원권 만료일 없음" };
  }

  const newEnd = addMonths(current, delta);
  await pool.query(
    `UPDATE members SET "membershipEnd" = $1, "updatedAt" = now()::text WHERE id = $2`,
    [newEnd, memberId]
  );
  await pool.query(
    `UPDATE diet_programs SET "appliedMonths" = $1, "updatedAt" = now()::text WHERE id = $2`,
    [earned, programId]
  );
  await pool.query(
    `INSERT INTO diet_payback_grants
       ("programId","memberId",months,"totalEarned","previousEnd","newEnd",source,actor,note)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [programId, memberId, delta, earned, current, newEnd, source, ctx?.actor ?? null, ctx?.note ?? null]
  );
  return { earned, applied, delta, previousEnd: current, newEnd, changed: true as const };
}

function calcPricePerSession(paymentAmount: number, sessions: number, paymentMethod?: string | null, transferAmount?: number | null, cardAmount?: number | null) {
  if (paymentMethod === "혼합" && transferAmount != null && cardAmount != null) {
    const base = transferAmount + Math.round(cardAmount / 1.1);
    return Math.round(base / sessions);
  }
  const base = (paymentMethod === "이체" || paymentMethod === "계좌이체") ? paymentAmount : Math.round(paymentAmount / 1.1);
  return Math.round(base / sessions);
}

// 대시보드 통계 (async)
export async function getDashboardStats(trainerId: number) {
  try {
    const today = new Date().toISOString().split("T")[0];
    const todayDate = new Date();
    const monthStart = new Date(todayDate.getFullYear(), todayDate.getMonth(), 1).toISOString().split("T")[0];
    const monthEnd = new Date(todayDate.getFullYear(), todayDate.getMonth() + 1, 1).toISOString().split("T")[0];

    const [totalMembersResult, activeMembersResult, todayAttendancesResult, trainerSettingsResult] =
      await Promise.all([
        db.select({ count: sql<number>`COUNT(*)` }).from(members).where(eq(members.trainerId, trainerId)),
        db.select({ count: sql<number>`COUNT(*)` }).from(members).where(and(eq(members.trainerId, trainerId), eq(members.status, "active"))),
        db.select({ count: sql<number>`COUNT(*)` }).from(attendances).where(and(eq(attendances.trainerId, trainerId), eq(attendances.status, "attended"), eq(attendances.attendDate, today))),
        db.select({ settlementRate: trainerSettings.settlementRate }).from(trainerSettings).where(eq(trainerSettings.trainerId, trainerId)).limit(1),
      ]);

    const totalMembers = Number(totalMembersResult[0]?.count ?? 0);
    const activeMembers = Number(activeMembersResult[0]?.count ?? 0);
    const todayAttendances = Number(todayAttendancesResult[0]?.count ?? 0);
    const settlementRate = Number(trainerSettingsResult[0]?.settlementRate ?? 50);

    const sessionFields = {
      memberId: ptSessionLogs.memberId,
      memberNameSnapshot: ptSessionLogs.memberName,
      isServiceSession: ptSessionLogs.isServiceSession,
      pricePerSession: ptPackages.pricePerSession,
      serviceSessionPrice: ptPackages.serviceSessionPrice,
      serviceSamePrice: ptPackages.serviceSamePrice,
      serviceSessions: ptPackages.serviceSessions,
      packageName: ptPackages.packageName,
      paymentAmount: ptPackages.paymentAmount,
      totalSessions: ptPackages.totalSessions,
      paymentMethod: ptPackages.paymentMethod,
    };

    // 정산 페이지와 동일: 세션 로그 + 패키지 join + 회원 join
    const [monthLogs, todayLogs] = await Promise.all([
      db.select({ ...sessionFields, memberNameJoined: members.name })
        .from(ptSessionLogs)
        .leftJoin(ptPackages, eq(ptSessionLogs.packageId, ptPackages.id))
        .leftJoin(members, eq(ptSessionLogs.memberId, members.id))
        .where(and(
          eq(ptSessionLogs.trainerId, trainerId),
          sql`${ptSessionLogs.sessionDate} >= ${monthStart}`,
          sql`${ptSessionLogs.sessionDate} < ${monthEnd}`,
        )),
      db.select({ ...sessionFields, memberNameJoined: members.name })
        .from(ptSessionLogs)
        .leftJoin(ptPackages, eq(ptSessionLogs.packageId, ptPackages.id))
        .leftJoin(members, eq(ptSessionLogs.memberId, members.id))
        .where(and(
          eq(ptSessionLogs.trainerId, trainerId),
          eq(ptSessionLogs.sessionDate, today),
        )),
    ]);

    // 정산 페이지와 동일: 탈퇴회원(이름 없음) 세션 제외
    const validMonthLogs = monthLogs.filter(l => l.memberNameSnapshot != null || l.memberNameJoined != null);
    const validTodayLogs = todayLogs.filter(l => l.memberNameSnapshot != null || l.memberNameJoined != null);

    // 이번달 PT 세션 수 (탈퇴회원 제외)
    const totalPtSessions = validMonthLogs.length;

    // 패키지 없는 세션 폴백: 회원의 활성 패키지에서 단가 조회 (정산 페이지와 동일)
    const allMemberIds = [...new Set(validMonthLogs.filter(l => !l.paymentAmount).map(l => l.memberId))];
    const memberPkgMap: Record<number, { pricePerSession: number | null; paymentAmount: number | null; totalSessions: number | null; paymentMethod: string | null }> = {};
    if (allMemberIds.length > 0) {
      const fallbackPkgs = await db.select({
        memberId: ptPackages.memberId,
        pricePerSession: ptPackages.pricePerSession,
        paymentAmount: ptPackages.paymentAmount,
        totalSessions: ptPackages.totalSessions,
        paymentMethod: ptPackages.paymentMethod,
      }).from(ptPackages).where(and(inArray(ptPackages.memberId, allMemberIds), eq(ptPackages.status, "active"))).orderBy(desc(ptPackages.createdAt));
      for (const p of fallbackPkgs) {
        if (!memberPkgMap[p.memberId]) memberPkgMap[p.memberId] = p;
      }
    }

    // revenue_entries 폴백
    const memberRevenueMap: Record<number, number> = {};
    if (allMemberIds.length > 0) {
      const revRows = await db.select({
        memberId: revenueEntries.memberId,
        paidAmount: revenueEntries.paidAmount,
        sessions: revenueEntries.sessions,
      }).from(revenueEntries).where(and(inArray(revenueEntries.memberId, allMemberIds), eq(revenueEntries.trainerId, trainerId)));
      const totals: Record<number, { paid: number; sessions: number }> = {};
      for (const r of revRows) {
        if (!r.memberId) continue;
        if (!totals[r.memberId]) totals[r.memberId] = { paid: 0, sessions: 0 };
        totals[r.memberId].paid += r.paidAmount ?? 0;
        totals[r.memberId].sessions += r.sessions ?? 0;
      }
      for (const [mid, t] of Object.entries(totals)) {
        if (t.sessions > 0) memberRevenueMap[Number(mid)] = Math.round(t.paid / t.sessions);
      }
    }

    const calcPrice = (l: { memberId: number; isServiceSession?: number | null; serviceSessionPrice?: number | null; serviceSamePrice?: number | null; serviceSessions?: number | null; packageName?: string | null; pricePerSession: number | null; paymentAmount: number | null; totalSessions: number | null; paymentMethod?: string | null }) => {
      if (isServiceLog(l) && l.serviceSamePrice !== 1) return l.serviceSessionPrice ?? 0;
      if (l.paymentMethod === "혼합") return l.pricePerSession ?? 0;
      if (l.paymentAmount && l.totalSessions && l.totalSessions > 0)
        return calcPricePerSession(l.paymentAmount, l.totalSessions, l.paymentMethod);
      if (l.pricePerSession) return l.pricePerSession;
      const fb = memberPkgMap[l.memberId];
      if (fb?.paymentMethod === "혼합") return fb.pricePerSession ?? 0;
      if (fb?.paymentAmount && fb?.totalSessions && fb.totalSessions > 0)
        return calcPricePerSession(fb.paymentAmount, fb.totalSessions, fb.paymentMethod);
      if (fb?.pricePerSession) return fb.pricePerSession;
      return memberRevenueMap[l.memberId] ?? 0;
    };

    // 오늘 폴백도 동일하게
    const todayMemberIds = [...new Set(validTodayLogs.filter(l => !l.paymentAmount).map(l => l.memberId))];
    const todayPkgMap: Record<number, { pricePerSession: number | null; paymentAmount: number | null; totalSessions: number | null; paymentMethod: string | null }> = {};
    if (todayMemberIds.length > 0) {
      const fb = await db.select({
        memberId: ptPackages.memberId,
        pricePerSession: ptPackages.pricePerSession,
        paymentAmount: ptPackages.paymentAmount,
        totalSessions: ptPackages.totalSessions,
        paymentMethod: ptPackages.paymentMethod,
      }).from(ptPackages).where(and(inArray(ptPackages.memberId, todayMemberIds), eq(ptPackages.status, "active"))).orderBy(desc(ptPackages.createdAt));
      for (const p of fb) {
        if (!todayPkgMap[p.memberId]) todayPkgMap[p.memberId] = p;
      }
    }

    const calcTodayPrice = (l: { memberId: number; isServiceSession?: number | null; serviceSessionPrice?: number | null; serviceSamePrice?: number | null; serviceSessions?: number | null; packageName?: string | null; pricePerSession: number | null; paymentAmount: number | null; totalSessions: number | null; paymentMethod?: string | null }) => {
      if (isServiceLog(l) && l.serviceSamePrice !== 1) return l.serviceSessionPrice ?? 0;
      if (l.paymentMethod === "혼합") return l.pricePerSession ?? 0;
      if (l.paymentAmount && l.totalSessions && l.totalSessions > 0)
        return calcPricePerSession(l.paymentAmount, l.totalSessions, l.paymentMethod);
      if (l.pricePerSession) return l.pricePerSession;
      const fb = todayPkgMap[l.memberId];
      if (fb?.paymentMethod === "혼합") return fb.pricePerSession ?? 0;
      if (fb?.paymentAmount && fb?.totalSessions && fb.totalSessions > 0)
        return calcPricePerSession(fb.paymentAmount, fb.totalSessions, fb.paymentMethod);
      if (fb?.pricePerSession) return fb.pricePerSession;
      return 0;
    };

    const monthRevenue = validMonthLogs.reduce((s, l) => s + calcPrice(l), 0);
    const todayRevenue = validTodayLogs.reduce((s, l) => s + calcTodayPrice(l), 0);

    const monthlySettlement = Math.round(monthRevenue * settlementRate / 100);
    const dailySettlement = Math.round(todayRevenue * settlementRate / 100);

    return { totalMembers, activeMembers, todayAttendances, totalPtSessions, settlementAmount: monthlySettlement, noShowCount: 0, dailySettlement, monthlySettlement };
  } catch (error) {
    console.error("[getDashboardStats] Error:", error);
    return { totalMembers: 0, activeMembers: 0, todayAttendances: 0, totalPtSessions: 0, settlementAmount: 0, noShowCount: 0, dailySettlement: 0, monthlySettlement: 0 };
  }
}
