import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import path from "path";
import { eq, and, sql } from "drizzle-orm";
import {
  members,
  trainers,
  trainerSettings,
  ptPackages,
  attendances,
  ptSessionLogs,
  payments,
  users,
} from "../drizzle/schema";

let _db: ReturnType<typeof drizzle> | null = null;

export function getDb() {
  if (_db) return _db;
  try {
    const dbPath = path.join(process.cwd(), "trainer.db");
    const sqlite = new Database(dbPath);
    sqlite.pragma("journal_mode = WAL");
    sqlite.pragma("foreign_keys = ON");
    _db = drizzle(sqlite);
    console.log("[DB] SQLite connected:", dbPath);
    return _db;
  } catch (error) {
    console.error("[DB] Connection failed:", error);
    return null;
  }
}

// 대시보드 통계
export function getDashboardStats(trainerId: number) {
  const db = getDb();
  if (!db)
    return {
      totalMembers: 0,
      activeMembers: 0,
      todayAttendances: 0,
      totalPtSessions: 0,
      settlementAmount: 0,
      noShowCount: 0,
      dailySettlement: 0,
      monthlySettlement: 0,
    };

  try {
    const totalMembersResult = db
      .select({ count: sql<number>`COUNT(*)` })
      .from(members)
      .where(eq(members.trainerId, trainerId))
      .all();

    const activeMembersResult = db
      .select({ count: sql<number>`COUNT(*)` })
      .from(members)
      .where(and(eq(members.trainerId, trainerId), eq(members.status, "active")))
      .all();

    const totalPtResult = db
      .select({ count: sql<number>`COUNT(*)` })
      .from(ptSessionLogs)
      .where(eq(ptSessionLogs.trainerId, trainerId))
      .all();

    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];

    const todayAttendancesResult = db
      .select({ count: sql<number>`COUNT(*)` })
      .from(attendances)
      .where(
        and(
          eq(attendances.trainerId, trainerId),
          eq(attendances.status, "attended"),
          eq(attendances.attendDate, todayStr)
        )
      )
      .all();

    const totalMembers = Number(totalMembersResult[0]?.count ?? 0);
    const activeMembers = Number(activeMembersResult[0]?.count ?? 0);
    const totalPtSessions = Number(totalPtResult[0]?.count ?? 0);
    const todayAttendances = Number(todayAttendancesResult[0]?.count ?? 0);

    const trainerSettingsResult = db
      .select({ settlementRate: trainerSettings.settlementRate })
      .from(trainerSettings)
      .where(eq(trainerSettings.trainerId, trainerId))
      .all();
    const settlementRate = Number(trainerSettingsResult[0]?.settlementRate ?? 50);

    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
      .toISOString()
      .split("T")[0];
    const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 1)
      .toISOString()
      .split("T")[0];

    const monthSettlementResult = db
      .select({
        totalSettlement: sql<number>`COALESCE(SUM(COALESCE(${ptPackages.pricePerSession}, 0)), 0)`,
      })
      .from(attendances)
      .leftJoin(ptPackages, eq(attendances.memberId, ptPackages.memberId))
      .where(
        and(
          eq(attendances.trainerId, trainerId),
          eq(attendances.status, "attended"),
          sql`${attendances.attendDate} >= ${monthStart}`,
          sql`${attendances.attendDate} < ${monthEnd}`
        )
      )
      .all();

    const totalSettlement = Number(monthSettlementResult[0]?.totalSettlement ?? 0);
    const monthlySettlement = Math.round((totalSettlement * settlementRate) / 100);

    const todaySettlementResult = db
      .select({
        totalSettlement: sql<number>`COALESCE(SUM(COALESCE(${ptPackages.pricePerSession}, 0)), 0)`,
      })
      .from(attendances)
      .leftJoin(ptPackages, eq(attendances.memberId, ptPackages.memberId))
      .where(
        and(
          eq(attendances.trainerId, trainerId),
          eq(attendances.status, "attended"),
          eq(attendances.attendDate, todayStr)
        )
      )
      .all();

    const todayTotalSettlement = Number(todaySettlementResult[0]?.totalSettlement ?? 0);
    const dailySettlement = Math.round((todayTotalSettlement * settlementRate) / 100);

    return {
      totalMembers,
      activeMembers,
      todayAttendances,
      totalPtSessions,
      settlementAmount: monthlySettlement,
      noShowCount: 0,
      dailySettlement,
      monthlySettlement,
    };
  } catch (error) {
    console.error("[getDashboardStats] Error:", error);
    return {
      totalMembers: 0,
      activeMembers: 0,
      todayAttendances: 0,
      totalPtSessions: 0,
      settlementAmount: 0,
      noShowCount: 0,
      dailySettlement: 0,
      monthlySettlement: 0,
    };
  }
}
