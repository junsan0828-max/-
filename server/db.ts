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

    const calcPrice = (l: { memberId: number; isServiceSession?: number | null; serviceSessionPrice?: number | null; serviceSamePrice?: number | null; pricePerSession: number | null; paymentAmount: number | null; totalSessions: number | null; paymentMethod?: string | null }) => {
      if (l.isServiceSession === 1 && l.serviceSamePrice !== 1) return l.serviceSessionPrice ?? 0;
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

    const calcTodayPrice = (l: { memberId: number; isServiceSession?: number | null; serviceSessionPrice?: number | null; serviceSamePrice?: number | null; pricePerSession: number | null; paymentAmount: number | null; totalSessions: number | null; paymentMethod?: string | null }) => {
      if (l.isServiceSession === 1 && l.serviceSamePrice !== 1) return l.serviceSessionPrice ?? 0;
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
