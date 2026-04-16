import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import path from "path";
import { eq, and, sql } from "drizzle-orm";
import {
  members,
  trainers,
  trainerSettings,
  ptPackages,
  attendances,
  ptSessionLogs,
} from "../drizzle/schema";

const dbPath = path.join(process.cwd(), "trainer.db");

const client = createClient({ url: `file:${dbPath}` });
export const db = drizzle(client);

export function getDb() {
  return db;
}

// 대시보드 통계
export async function getDashboardStats(trainerId: number) {
  try {
    const [totalMembersResult, activeMembersResult, totalPtResult] = await Promise.all([
      db.select({ count: sql<number>`COUNT(*)` }).from(members).where(eq(members.trainerId, trainerId)),
      db.select({ count: sql<number>`COUNT(*)` }).from(members).where(and(eq(members.trainerId, trainerId), eq(members.status, "active"))),
      db.select({ count: sql<number>`COUNT(*)` }).from(ptSessionLogs).where(eq(ptSessionLogs.trainerId, trainerId)),
    ]);

    const today = new Date().toISOString().split("T")[0];

    const todayAttendancesResult = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(attendances)
      .where(and(eq(attendances.trainerId, trainerId), eq(attendances.status, "attended"), eq(attendances.attendDate, today)));

    const totalMembers = Number(totalMembersResult[0]?.count ?? 0);
    const activeMembers = Number(activeMembersResult[0]?.count ?? 0);
    const totalPtSessions = Number(totalPtResult[0]?.count ?? 0);
    const todayAttendances = Number(todayAttendancesResult[0]?.count ?? 0);

    const trainerSettingsResult = await db
      .select({ settlementRate: trainerSettings.settlementRate })
      .from(trainerSettings)
      .where(eq(trainerSettings.trainerId, trainerId));
    const settlementRate = Number(trainerSettingsResult[0]?.settlementRate ?? 50);

    const todayDate = new Date();
    const monthStart = new Date(todayDate.getFullYear(), todayDate.getMonth(), 1).toISOString().split("T")[0];
    const monthEnd = new Date(todayDate.getFullYear(), todayDate.getMonth() + 1, 1).toISOString().split("T")[0];

    const [monthSettlementResult, todaySettlementResult] = await Promise.all([
      db.select({ totalSettlement: sql<number>`COALESCE(SUM(COALESCE(${ptPackages.pricePerSession}, 0)), 0)` })
        .from(attendances)
        .leftJoin(ptPackages, eq(attendances.memberId, ptPackages.memberId))
        .where(and(eq(attendances.trainerId, trainerId), eq(attendances.status, "attended"), sql`${attendances.attendDate} >= ${monthStart}`, sql`${attendances.attendDate} < ${monthEnd}`)),
      db.select({ totalSettlement: sql<number>`COALESCE(SUM(COALESCE(${ptPackages.pricePerSession}, 0)), 0)` })
        .from(attendances)
        .leftJoin(ptPackages, eq(attendances.memberId, ptPackages.memberId))
        .where(and(eq(attendances.trainerId, trainerId), eq(attendances.status, "attended"), eq(attendances.attendDate, today))),
    ]);

    const monthlySettlement = Math.round((Number(monthSettlementResult[0]?.totalSettlement ?? 0) * settlementRate) / 100);
    const dailySettlement = Math.round((Number(todaySettlementResult[0]?.totalSettlement ?? 0) * settlementRate) / 100);

    return { totalMembers, activeMembers, todayAttendances, totalPtSessions, settlementAmount: monthlySettlement, noShowCount: 0, dailySettlement, monthlySettlement };
  } catch (error) {
    console.error("[getDashboardStats] Error:", error);
    return { totalMembers: 0, activeMembers: 0, todayAttendances: 0, totalPtSessions: 0, settlementAmount: 0, noShowCount: 0, dailySettlement: 0, monthlySettlement: 0 };
  }
}
