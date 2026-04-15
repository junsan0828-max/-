import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
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

let db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (db) return db;

  try {
    const connection = await mysql.createPool({
      host: process.env.DB_HOST || "localhost",
      port: parseInt(process.env.DB_PORT || "3306"),
      user: process.env.DB_USER || "root",
      password: process.env.DB_PASSWORD || "",
      database: process.env.DB_NAME || "trainer_app",
    });
    db = drizzle(connection);
    console.log("[DB] Connected successfully");
    return db;
  } catch (error) {
    console.error("[DB] Connection failed:", error);
    return null;
  }
}

// 대시보드 통계
export async function getDashboardStats(trainerId: number) {
  const db = await getDb();
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
    const totalMembersResult = await db
      .select({ count: sql`COUNT(*)` })
      .from(members)
      .where(eq(members.trainerId, trainerId));

    const activeMembersResult = await db
      .select({ count: sql`COUNT(*)` })
      .from(members)
      .where(and(eq(members.trainerId, trainerId), eq(members.status, "active")));

    const totalPtResult = await db
      .select({ count: sql`COUNT(*)` })
      .from(ptSessionLogs)
      .where(eq(ptSessionLogs.trainerId, trainerId));

    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];
    const todayStart = todayStr;
    const todayEnd = new Date(today.getTime() + 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];

    const todayAttendancesResult = await db
      .select({ count: sql`COUNT(*)` })
      .from(attendances)
      .where(
        and(
          eq(attendances.trainerId, trainerId),
          eq(attendances.status, "attended"),
          sql`${attendances.attendDate} >= ${todayStart}`,
          sql`${attendances.attendDate} < ${todayEnd}`
        )
      );

    const totalMembers = Number((totalMembersResult[0] as any)?.count ?? 0);
    const activeMembers = Number((activeMembersResult[0] as any)?.count ?? 0);
    const totalPtSessions = Number((totalPtResult[0] as any)?.count ?? 0);
    const todayAttendances = Number((todayAttendancesResult[0] as any)?.count ?? 0);

    // 트레이너 정산 비율 조회 (기본값: 50%)
    const trainerSettingsResult = await db
      .select({ settlementRate: trainerSettings.settlementRate })
      .from(trainerSettings)
      .where(eq(trainerSettings.trainerId, trainerId));
    const settlementRate = Number(
      (trainerSettingsResult[0] as any)?.settlementRate ?? 50
    );

    // 월 정산금액 계산
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
      .toISOString()
      .split("T")[0];
    const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 1)
      .toISOString()
      .split("T")[0];

    const monthSettlementResult = await db
      .select({
        totalSettlement: sql`COALESCE(SUM(COALESCE(${ptPackages.pricePerSession}, 0)), 0)`,
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
      );

    const totalSettlement = Number(
      (monthSettlementResult[0] as any)?.totalSettlement ?? 0
    );
    const monthlySettlement = Math.round((totalSettlement * settlementRate) / 100);

    // 일일 정산금액 계산
    const todaySettlementResult = await db
      .select({
        totalSettlement: sql`COALESCE(SUM(COALESCE(${ptPackages.pricePerSession}, 0)), 0)`,
      })
      .from(attendances)
      .leftJoin(ptPackages, eq(attendances.memberId, ptPackages.memberId))
      .where(
        and(
          eq(attendances.trainerId, trainerId),
          eq(attendances.status, "attended"),
          sql`${attendances.attendDate} >= ${todayStart}`,
          sql`${attendances.attendDate} < ${todayEnd}`
        )
      );

    const todayTotalSettlement = Number(
      (todaySettlementResult[0] as any)?.totalSettlement ?? 0
    );
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
