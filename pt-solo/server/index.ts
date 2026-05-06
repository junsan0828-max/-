import express from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import cors from "cors";
import path from "path";
import fs from "fs";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "./routers";
import { db, pool } from "./db";
import type { AuthUser } from "./auth";
import {
  users,
  trainers,
  trainerSettings,
  members,
  ptPackages,
  ptPauses,
  attendances,
  ptSessionLogs,
  workoutMemos,
  parQ,
  attendanceChecks,
  reportTokens,
  schedules,
  payments,
} from "../drizzle/schema";
import { eq, isNull } from "drizzle-orm";

const app = express();
const PORT = parseInt(process.env.PORT || "3000");

const PgSession = connectPgSimple(session);

app.set("trust proxy", 1);
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(
  session({
    store: new PgSession({
      pool,
      tableName: "session",
      createTableIfMissing: true,
    }),
    secret: process.env.SESSION_SECRET || "pt-solo-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  })
);

app.use(
  "/trpc",
  createExpressMiddleware({
    router: appRouter,
    createContext: ({ req, res }) => ({
      user: (req.session as any)?.user as AuthUser | undefined,
      req,
      res,
    }),
  })
);

const clientDistPath = path.join(process.cwd(), "client", "dist");
if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(clientDistPath, "index.html"));
  });
} else {
  app.get("/", (_req, res) => {
    res.send("클라이언트 빌드가 필요합니다: npm run build");
  });
}

async function initDatabase() {
  console.log("🔧 DB 초기화 중...");

  const tables = [
    `CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'trainer',
      position TEXT,
      "lastLoginAt" TEXT,
      "createdAt" TEXT NOT NULL DEFAULT now()::text,
      "updatedAt" TEXT NOT NULL DEFAULT now()::text
    )`,
    `CREATE TABLE IF NOT EXISTS trainers (
      id SERIAL PRIMARY KEY,
      "userId" INTEGER NOT NULL UNIQUE,
      "trainerName" TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      "createdAt" TEXT NOT NULL DEFAULT now()::text,
      "updatedAt" TEXT NOT NULL DEFAULT now()::text
    )`,
    `CREATE TABLE IF NOT EXISTS trainer_settings (
      id SERIAL PRIMARY KEY,
      "trainerId" INTEGER NOT NULL UNIQUE,
      "settlementRate" INTEGER NOT NULL DEFAULT 50,
      "createdAt" TEXT NOT NULL DEFAULT now()::text,
      "updatedAt" TEXT NOT NULL DEFAULT now()::text
    )`,
    `CREATE TABLE IF NOT EXISTS members (
      id SERIAL PRIMARY KEY,
      "trainerId" INTEGER NOT NULL,
      name TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      "birthDate" TEXT,
      gender TEXT,
      grade TEXT NOT NULL DEFAULT 'basic',
      status TEXT NOT NULL DEFAULT 'active',
      "membershipStart" TEXT,
      "membershipEnd" TEXT,
      "profileNote" TEXT,
      "visitRoute" TEXT,
      "createdAt" TEXT NOT NULL DEFAULT now()::text,
      "updatedAt" TEXT NOT NULL DEFAULT now()::text
    )`,
    `CREATE TABLE IF NOT EXISTS pt_packages (
      id SERIAL PRIMARY KEY,
      "memberId" INTEGER NOT NULL,
      "trainerId" INTEGER,
      "totalSessions" INTEGER NOT NULL,
      "usedSessions" INTEGER NOT NULL DEFAULT 0,
      "packageName" TEXT,
      "startDate" TEXT,
      "expiryDate" TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      price INTEGER,
      "pricePerSession" INTEGER,
      "paymentAmount" INTEGER,
      "unpaidAmount" INTEGER,
      "paymentMethod" TEXT,
      "paymentDate" TEXT,
      "paymentMemo" TEXT,
      "createdAt" TEXT NOT NULL DEFAULT now()::text,
      "updatedAt" TEXT NOT NULL DEFAULT now()::text
    )`,
    `CREATE TABLE IF NOT EXISTS pt_pauses (
      id SERIAL PRIMARY KEY,
      "packageId" INTEGER NOT NULL,
      "memberId" INTEGER NOT NULL,
      "pauseStart" TEXT NOT NULL,
      "pauseEnd" TEXT,
      reason TEXT,
      "createdAt" TEXT NOT NULL DEFAULT now()::text
    )`,
    `CREATE TABLE IF NOT EXISTS schedules (
      id SERIAL PRIMARY KEY,
      "memberId" INTEGER NOT NULL,
      "trainerId" INTEGER NOT NULL,
      "scheduledDate" TEXT NOT NULL,
      "scheduledTime" TEXT,
      notes TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      "createdAt" TEXT NOT NULL DEFAULT now()::text
    )`,
    `CREATE TABLE IF NOT EXISTS attendances (
      id SERIAL PRIMARY KEY,
      "memberId" INTEGER NOT NULL,
      "trainerId" INTEGER NOT NULL,
      "attendDate" TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'attended',
      "createdAt" TEXT NOT NULL DEFAULT now()::text
    )`,
    `CREATE TABLE IF NOT EXISTS pt_session_logs (
      id SERIAL PRIMARY KEY,
      "memberId" INTEGER NOT NULL,
      "trainerId" INTEGER NOT NULL,
      "packageId" INTEGER,
      "sessionDate" TEXT NOT NULL,
      notes TEXT,
      "bodyPart" TEXT,
      "exercisesJson" TEXT,
      goal TEXT,
      feedback TEXT,
      "createdAt" TEXT NOT NULL DEFAULT now()::text
    )`,
    `CREATE TABLE IF NOT EXISTS workout_memos (
      id SERIAL PRIMARY KEY,
      "memberId" INTEGER NOT NULL,
      "trainerId" INTEGER NOT NULL,
      "memoDate" TEXT NOT NULL,
      content TEXT NOT NULL,
      "createdAt" TEXT NOT NULL DEFAULT now()::text
    )`,
    `CREATE TABLE IF NOT EXISTS par_q (
      id SERIAL PRIMARY KEY,
      "memberId" INTEGER NOT NULL UNIQUE,
      height TEXT, weight TEXT, "muscleMass" TEXT, "bodyFatPercent" TEXT, "bodyFatKg" TEXT,
      "waistCircumference" TEXT, "systolicBp" TEXT, "diastolicBp" TEXT,
      "totalCholesterol" TEXT, "hdlCholesterol" TEXT, "ldlCholesterol" TEXT,
      triglycerides TEXT, "fastingBloodSugar" TEXT, "postMealBloodSugar" TEXT,
      "hba1c" TEXT, "boneDensity" TEXT, occupation TEXT, "workEnvironment" TEXT,
      "exerciseExperience" TEXT, "visitRoute" TEXT,
      goal1 TEXT, goal2 TEXT, goal3 TEXT,
      "dietIssues" TEXT, "alcoholIssues" TEXT, "sleepIssues" TEXT, "activityIssues" TEXT,
      "chronicDiseases" TEXT, "musculoskeletalIssues" TEXT, "posturalIssues" TEXT,
      "createdAt" TEXT NOT NULL DEFAULT now()::text,
      "updatedAt" TEXT NOT NULL DEFAULT now()::text
    )`,
    `CREATE TABLE IF NOT EXISTS attendance_checks (
      id SERIAL PRIMARY KEY,
      "memberId" INTEGER NOT NULL,
      "trainerId" INTEGER NOT NULL,
      "checkDate" TEXT NOT NULL,
      "checkTime" TEXT,
      status TEXT NOT NULL DEFAULT 'attended',
      "conditionScore" INTEGER,
      "sleepHours" TEXT,
      "energyLevel" TEXT,
      diet TEXT,
      "painLevel" INTEGER,
      "painArea" TEXT,
      "painSide" TEXT,
      notes TEXT,
      "createdAt" TEXT NOT NULL DEFAULT now()::text,
      "updatedAt" TEXT NOT NULL DEFAULT now()::text
    )`,
    `CREATE TABLE IF NOT EXISTS report_tokens (
      id SERIAL PRIMARY KEY,
      token TEXT NOT NULL UNIQUE,
      "memberId" INTEGER NOT NULL,
      "trainerId" INTEGER NOT NULL,
      "createdAt" TEXT NOT NULL DEFAULT now()::text
    )`,
    `CREATE TABLE IF NOT EXISTS payments (
      id SERIAL PRIMARY KEY,
      "memberId" INTEGER NOT NULL,
      "trainerId" INTEGER,
      amount INTEGER NOT NULL,
      "paymentDate" TEXT,
      "paymentMethod" TEXT,
      memo TEXT,
      "createdAt" TEXT NOT NULL DEFAULT now()::text
    )`,
  ];

  for (const sql of tables) {
    await pool.query(sql);
  }

  console.log("✅ 테이블 준비 완료");

  // 회원권 날짜 자동 보정
  try {
    const noStartMembers = await db.select({ id: members.id }).from(members).where(isNull(members.membershipStart));
    for (const m of noStartMembers) {
      const firstSession = await db
        .select({ sessionDate: ptSessionLogs.sessionDate })
        .from(ptSessionLogs)
        .where(eq(ptSessionLogs.memberId, m.id))
        .orderBy(ptSessionLogs.sessionDate)
        .limit(1);
      if (firstSession[0]?.sessionDate) {
        await db.update(members).set({ membershipStart: firstSession[0].sessionDate }).where(eq(members.id, m.id));
      }
    }
    console.log("✅ 회원권 날짜 보정 완료");
  } catch (e) {
    console.warn("⚠️ 회원권 날짜 보정 실패:", e);
  }

  const existingUsers = await db.select({ id: users.id }).from(users).limit(1);
  if (!existingUsers[0]) {
    console.log("✨ 첫 실행입니다. 브라우저에서 /register 페이지를 방문하여 계정을 생성하세요.");
  }

  console.log("✨ DB 초기화 완료!");
}

async function start() {
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 PT-Solo 서버 실행 중: http://0.0.0.0:${PORT}`);
  });

  try {
    await initDatabase();
  } catch (e) {
    console.error("DB 초기화 오류 (서버는 계속 실행):", e);
  }
}

start().catch(console.error);
