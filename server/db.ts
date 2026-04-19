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
} from "../drizzle/schema";

import fs from "fs";

// Railway Volume(/data) 자동 감지: /data 디렉토리가 쓰기 가능하면 영구 스토리지로 사용
function resolveDbPath(): string {
  if (process.env.DB_PATH) return process.env.DB_PATH;
  const volumePath = "/data/trainer.db";
  try {
    if (!fs.existsSync("/data")) fs.mkdirSync("/data", { recursive: true });
    fs.accessSync("/data", fs.constants.W_OK);
    return volumePath; // Railway Volume이 마운트된 경우
  } catch {
    return path.join(process.cwd(), "trainer.db"); // 로컬 개발 환경
  }
}

export const DB_PATH = resolveDbPath();
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

export const sqlite = new Database(DB_PATH);
console.log(`📂 DB 경로: ${DB_PATH}`);
export const db = drizzle(sqlite);

export function getDb() {
  return db;
}

// 대시보드 통계
export function getDashboardStats(trainerId: number) {
  try {
    const today = new Date().toISOString().split("T")[0];
    const todayDate = new Date();
    const monthStart = new Date(todayDate.getFullYear(), todayDate.getMonth(), 1).toISOString().split("T")[0];
    const monthEnd = new Date(todayDate.getFullYear(), todayDate.getMonth() + 1, 1).toISOString().split("T")[0];

    const totalMembersResult = db.select({ count: sql<number>`COUNT(*)` }).from(members).where(eq(members.trainerId, trainerId)).all();
    const activeMembersResult = db.select({ count: sql<number>`COUNT(*)` }).from(members).where(and(eq(members.trainerId, trainerId), eq(members.status, "active"))).all();
    const totalPtResult = db.select({ count: sql<number>`COUNT(*)` }).from(ptSessionLogs).where(eq(ptSessionLogs.trainerId, trainerId)).all();
    const todayAttendancesResult = db.select({ count: sql<number>`COUNT(*)` }).from(attendances).where(and(eq(attendances.trainerId, trainerId), eq(attendances.status, "attended"), eq(attendances.attendDate, today))).all();
    const trainerSettingsResult = db.select({ settlementRate: trainerSettings.settlementRate }).from(trainerSettings).where(eq(trainerSettings.trainerId, trainerId)).all();

    const totalMembers = Number(totalMembersResult[0]?.count ?? 0);
    const activeMembers = Number(activeMembersResult[0]?.count ?? 0);
    const totalPtSessions = Number(totalPtResult[0]?.count ?? 0);
    const todayAttendances = Number(todayAttendancesResult[0]?.count ?? 0);
    const settlementRate = Number(trainerSettingsResult[0]?.settlementRate ?? 50);

    const monthSettlementResult = db.select({ totalSettlement: sql<number>`COALESCE(SUM(COALESCE(${ptPackages.pricePerSession}, 0)), 0)` })
      .from(attendances)
      .leftJoin(ptPackages, eq(attendances.memberId, ptPackages.memberId))
      .where(and(eq(attendances.trainerId, trainerId), eq(attendances.status, "attended"), sql`${attendances.attendDate} >= ${monthStart}`, sql`${attendances.attendDate} < ${monthEnd}`))
      .all();
    const todaySettlementResult = db.select({ totalSettlement: sql<number>`COALESCE(SUM(COALESCE(${ptPackages.pricePerSession}, 0)), 0)` })
      .from(attendances)
      .leftJoin(ptPackages, eq(attendances.memberId, ptPackages.memberId))
      .where(and(eq(attendances.trainerId, trainerId), eq(attendances.status, "attended"), eq(attendances.attendDate, today)))
      .all();

    const monthlySettlement = Math.round((Number(monthSettlementResult[0]?.totalSettlement ?? 0) * settlementRate) / 100);
    const dailySettlement = Math.round((Number(todaySettlementResult[0]?.totalSettlement ?? 0) * settlementRate) / 100);

    return { totalMembers, activeMembers, todayAttendances, totalPtSessions, settlementAmount: monthlySettlement, noShowCount: 0, dailySettlement, monthlySettlement };
  } catch (error) {
    console.error("[getDashboardStats] Error:", error);
    return { totalMembers: 0, activeMembers: 0, todayAttendances: 0, totalPtSessions: 0, settlementAmount: 0, noShowCount: 0, dailySettlement: 0, monthlySettlement: 0 };
  }
}
