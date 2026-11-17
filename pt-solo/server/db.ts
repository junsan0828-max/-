import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, and, sql } from "drizzle-orm";
import {
  members,
  trainers,
  trainerSettings,
  ptPackages,
  attendances,
  ptSessionLogs,
} from "../drizzle/schema";

if (!process.env.DATABASE_URL) {
  console.error("⚠️  DATABASE_URL 환경변수가 설정되지 않았습니다.");
}

const dbUrl = process.env.DATABASE_URL || "postgresql://localhost/pt_solo";

export const pool = new Pool({
  connectionString: dbUrl,
  ssl: dbUrl.includes("localhost") ? false : { rejectUnauthorized: false },
});

export const db = drizzle(pool);

export function getDb() {
  return db;
}

export async function getDashboardStats(trainerId: number) {
  try {
    const today = new Date().toISOString().split("T")[0];
    const todayDate = new Date();
    const monthStart = new Date(todayDate.getFullYear(), todayDate.getMonth(), 1).toISOString().split("T")[0];
    const monthEnd = new Date(todayDate.getFullYear(), todayDate.getMonth() + 1, 1).toISOString().split("T")[0];

    const todayDow = new Date().getDay() === 0 ? 6 : new Date().getDay() - 1; // 0=Mon~6=Sun
    const [totalMembersResult, activeMembersResult, totalPtResult, monthPtResult, todayAttendancesResult, trainerSettingsResult, todayScheduleResult, todayScheduleRecurringResult] =
      await Promise.all([
        db.select({ count: sql<number>`COUNT(*)` }).from(members).where(eq(members.trainerId, trainerId)),
        db.select({ count: sql<number>`COUNT(*)` }).from(members).where(and(eq(members.trainerId, trainerId), eq(members.status, "active"))),
        db.select({ count: sql<number>`COUNT(*)` }).from(ptSessionLogs).where(eq(ptSessionLogs.trainerId, trainerId)),
        db.select({ count: sql<number>`COUNT(*)` }).from(ptSessionLogs).where(and(eq(ptSessionLogs.trainerId, trainerId), sql`${ptSessionLogs.sessionDate} >= ${monthStart}`, sql`${ptSessionLogs.sessionDate} < ${monthEnd}`)),
        db.select({ count: sql<number>`COUNT(*)` }).from(attendances).where(and(eq(attendances.trainerId, trainerId), eq(attendances.status, "attended"), eq(attendances.attendDate, today))),
        db.select({ settlementRate: trainerSettings.settlementRate }).from(trainerSettings).where(eq(trainerSettings.trainerId, trainerId)).limit(1),
        pool.query<{ count: string; completed: string }>(
          `SELECT COUNT(*) AS count,
                  SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END) AS completed
           FROM trainer_schedules
           WHERE "trainerId"=$1 AND "scheduledDate"=$2 AND "isRecurring"=0`,
          [trainerId, today]
        ),
        pool.query<{ count: string }>(
          `SELECT COUNT(*) AS count FROM trainer_schedules WHERE "trainerId"=$1 AND "isRecurring"=1 AND "dayOfWeek"=$2`,
          [trainerId, todayDow]
        ),
      ]);

    const totalMembers = Number(totalMembersResult[0]?.count ?? 0);
    const activeMembers = Number(activeMembersResult[0]?.count ?? 0);
    const totalPtSessions = Number(totalPtResult[0]?.count ?? 0);
    const monthPtSessions = Number(monthPtResult[0]?.count ?? 0);
    const todayAttendances = Number(todayAttendancesResult[0]?.count ?? 0);
    const settlementRate = Number(trainerSettingsResult[0]?.settlementRate ?? 50);
    const todayScheduleRow = todayScheduleResult.rows[0];
    const todayScheduleSingle = Number(todayScheduleRow?.count ?? 0);
    const todayScheduleCompleted = Number(todayScheduleRow?.completed ?? 0);
    const todayScheduleRecurring = Number(todayScheduleRecurringResult.rows[0]?.count ?? 0);
    const todayScheduleTotal = todayScheduleSingle + todayScheduleRecurring;

    const [monthLogs, todayLogs] = await Promise.all([
      db.select({
        pricePerSession: ptPackages.pricePerSession,
        paymentAmount: ptPackages.paymentAmount,
        totalSessions: ptPackages.totalSessions,
      })
        .from(ptSessionLogs)
        .leftJoin(ptPackages, eq(ptSessionLogs.packageId, ptPackages.id))
        .where(and(
          eq(ptSessionLogs.trainerId, trainerId),
          sql`${ptSessionLogs.sessionDate} >= ${monthStart}`,
          sql`${ptSessionLogs.sessionDate} < ${monthEnd}`,
        )),
      db.select({
        pricePerSession: ptPackages.pricePerSession,
        paymentAmount: ptPackages.paymentAmount,
        totalSessions: ptPackages.totalSessions,
      })
        .from(ptSessionLogs)
        .leftJoin(ptPackages, eq(ptSessionLogs.packageId, ptPackages.id))
        .where(and(
          eq(ptSessionLogs.trainerId, trainerId),
          eq(ptSessionLogs.sessionDate, today),
        )),
    ]);

    const calcPrice = (l: { pricePerSession: number | null; paymentAmount: number | null; totalSessions: number | null }) => {
      if (l.pricePerSession) return l.pricePerSession;
      if (l.paymentAmount && l.totalSessions && l.totalSessions > 0) return Math.round(l.paymentAmount / l.totalSessions);
      return 0;
    };

    const monthRevenue = monthLogs.reduce((s, l) => s + calcPrice(l), 0);
    const todayRevenue = todayLogs.reduce((s, l) => s + calcPrice(l), 0);
    const monthlySettlement = Math.round(monthRevenue * settlementRate / 100);
    const dailySettlement = Math.round(todayRevenue * settlementRate / 100);

    return { totalMembers, activeMembers, todayAttendances, totalPtSessions, monthPtSessions, settlementAmount: monthlySettlement, noShowCount: 0, dailySettlement, monthlySettlement, todayScheduleTotal, todayScheduleCompleted };
  } catch (error) {
    console.error("[getDashboardStats] Error:", error);
    return { totalMembers: 0, activeMembers: 0, todayAttendances: 0, totalPtSessions: 0, monthPtSessions: 0, settlementAmount: 0, noShowCount: 0, dailySettlement: 0, monthlySettlement: 0 };
  }
}
