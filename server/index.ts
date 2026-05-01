import express from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import cors from "cors";
import path from "path";
import fs from "fs";
import bcrypt from "bcryptjs";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "./routers";
import { db, pool } from "./db";
import type { AuthUser } from "./auth";
import { users, trainers, trainerSettings, sheetSyncConfig, channels, members, ptPackages, ptSessionLogs, trainerBranches, revenueEntries } from "../drizzle/schema";
import { eq, and, isNull, sql } from "drizzle-orm";
import { syncSheetNow } from "./sheetSync";

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
    secret: process.env.SESSION_SECRET || "trainer-app-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  })
);

// tRPC API
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

// 프론트엔드 정적 파일 서빙
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

// DB 초기화 (PostgreSQL)
async function initDatabase() {
  console.log("🔧 DB 초기화 중...");

  const tables = [
    `CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'trainer',
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
    `CREATE TABLE IF NOT EXISTS workout_memos (
      id SERIAL PRIMARY KEY,
      "memberId" INTEGER NOT NULL,
      "trainerId" INTEGER NOT NULL,
      "memoDate" TEXT NOT NULL,
      content TEXT NOT NULL,
      "createdAt" TEXT NOT NULL DEFAULT now()::text
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
    `CREATE TABLE IF NOT EXISTS sheet_sync_config (
      id SERIAL PRIMARY KEY,
      "sheetUrl" TEXT NOT NULL,
      "columnOffset" INTEGER NOT NULL DEFAULT 1,
      "lastSyncedCount" INTEGER NOT NULL DEFAULT 0,
      "mappingJson" TEXT NOT NULL DEFAULT '{}',
      enabled INTEGER NOT NULL DEFAULT 1,
      "syncedAt" TEXT,
      "createdAt" TEXT NOT NULL DEFAULT now()::text
    )`,
    `CREATE TABLE IF NOT EXISTS sheet_pending_members (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      "birthDate" TEXT,
      gender TEXT,
      grade TEXT,
      "membershipStart" TEXT,
      "membershipEnd" TEXT,
      "profileNote" TEXT,
      "ptProgram" TEXT,
      "ptSessions" INTEGER,
      "paymentAmount" INTEGER,
      "unpaidAmount" INTEGER,
      "paymentMethod" TEXT,
      "sheetRowIndex" INTEGER,
      "importedAt" TEXT NOT NULL DEFAULT now()::text
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
    // ─── 통합 운영 시스템 테이블 ──────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS channels (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'online',
      description TEXT,
      "isActive" INTEGER NOT NULL DEFAULT 1,
      "createdAt" TEXT NOT NULL DEFAULT now()::text
    )`,
    `CREATE TABLE IF NOT EXISTS leads (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      gender TEXT,
      "ageGroup" TEXT,
      "channelId" INTEGER,
      "branchId" INTEGER,
      status TEXT NOT NULL DEFAULT 'pending',
      "assignedTrainerId" INTEGER,
      "consultationDate" TEXT,
      "consultationNote" TEXT,
      "registeredMemberId" INTEGER,
      "interestType" TEXT,
      memo TEXT,
      "createdAt" TEXT NOT NULL DEFAULT now()::text,
      "updatedAt" TEXT NOT NULL DEFAULT now()::text
    )`,
    `CREATE TABLE IF NOT EXISTS revenue_entries (
      id SERIAL PRIMARY KEY,
      "memberId" INTEGER,
      "leadId" INTEGER,
      "trainerId" INTEGER,
      "branchId" INTEGER,
      "channelId" INTEGER,
      type TEXT NOT NULL,
      "subType" TEXT NOT NULL,
      amount INTEGER NOT NULL,
      "discountAmount" INTEGER NOT NULL DEFAULT 0,
      "paidAmount" INTEGER NOT NULL,
      "unpaidAmount" INTEGER NOT NULL DEFAULT 0,
      "refundAmount" INTEGER NOT NULL DEFAULT 0,
      "paymentMethod" TEXT,
      "paymentDate" TEXT NOT NULL,
      installments INTEGER NOT NULL DEFAULT 1,
      memo TEXT,
      "createdAt" TEXT NOT NULL DEFAULT now()::text,
      "updatedAt" TEXT NOT NULL DEFAULT now()::text
    )`,
    `CREATE TABLE IF NOT EXISTS expense_entries (
      id SERIAL PRIMARY KEY,
      "branchId" INTEGER,
      category TEXT NOT NULL,
      amount INTEGER NOT NULL,
      vendor TEXT,
      "expenseDate" TEXT NOT NULL,
      memo TEXT,
      "createdAt" TEXT NOT NULL DEFAULT now()::text
    )`,
    `CREATE TABLE IF NOT EXISTS revenue_targets (
      id SERIAL PRIMARY KEY,
      "branchId" INTEGER,
      year INTEGER NOT NULL,
      month INTEGER NOT NULL,
      "targetAmount" INTEGER NOT NULL,
      "createdAt" TEXT NOT NULL DEFAULT now()::text
    )`,
  ];

  for (const sql of tables) {
    await pool.query(sql);
  }

  // 신규 컬럼 마이그레이션 (IF NOT EXISTS)
  const alterStatements = [
    `ALTER TABLE pt_session_logs ADD COLUMN IF NOT EXISTS goal TEXT`,
    `ALTER TABLE pt_session_logs ADD COLUMN IF NOT EXISTS feedback TEXT`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS "lastLoginAt" TEXT`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS "position" TEXT`,
    `ALTER TABLE revenue_entries ADD COLUMN IF NOT EXISTS "createdBy" INTEGER`,
    `ALTER TABLE revenue_entries ADD COLUMN IF NOT EXISTS "consultantId" INTEGER`,
    `ALTER TABLE members ADD COLUMN IF NOT EXISTS "branchId" INTEGER`,
    `ALTER TABLE revenue_entries ADD COLUMN IF NOT EXISTS "customerName" TEXT`,
    `ALTER TABLE revenue_entries ADD COLUMN IF NOT EXISTS "phone" TEXT`,
    `ALTER TABLE revenue_entries ADD COLUMN IF NOT EXISTS "programDetail" TEXT`,
    `ALTER TABLE revenue_entries ADD COLUMN IF NOT EXISTS "sessions" INTEGER`,
    `ALTER TABLE revenue_entries ADD COLUMN IF NOT EXISTS "duration" INTEGER`,
    `ALTER TABLE revenue_entries ADD COLUMN IF NOT EXISTS "startDate" TEXT`,
    `ALTER TABLE expense_entries ADD COLUMN IF NOT EXISTS "subCategory" TEXT`,
    `ALTER TABLE expense_entries ADD COLUMN IF NOT EXISTS "paymentMethod" TEXT`,
    `ALTER TABLE leads ADD COLUMN IF NOT EXISTS "consultationType" TEXT`,
    `ALTER TABLE leads ADD COLUMN IF NOT EXISTS "consultationSubTypes" TEXT`,
    `ALTER TABLE leads ADD COLUMN IF NOT EXISTS "assignedConsultantId" INTEGER`,
    `ALTER TABLE leads ADD COLUMN IF NOT EXISTS "exercisePurpose" TEXT`,
    `CREATE TABLE IF NOT EXISTS branches (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      "createdAt" TEXT NOT NULL DEFAULT now()::text
    )`,
    `ALTER TABLE trainers ADD COLUMN IF NOT EXISTS "branchId" INTEGER`,
    `CREATE TABLE IF NOT EXISTS trainer_branches (
      id SERIAL PRIMARY KEY,
      "trainerId" INTEGER NOT NULL,
      "branchId" INTEGER NOT NULL,
      UNIQUE("trainerId", "branchId")
    )`,
    `CREATE TABLE IF NOT EXISTS tasks (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      category TEXT NOT NULL DEFAULT '기타',
      priority TEXT NOT NULL DEFAULT 'normal',
      status TEXT NOT NULL DEFAULT 'pending',
      "assigneeId" INTEGER NOT NULL,
      "assignedById" INTEGER,
      "taskType" TEXT NOT NULL DEFAULT 'daily',
      "taskDate" TEXT,
      "dayOfWeek" INTEGER,
      "dayOfMonth" INTEGER,
      "dueTime" TEXT,
      "isRecurring" INTEGER NOT NULL DEFAULT 0,
      "completedAt" TEXT,
      "completedMemo" TEXT,
      "createdAt" TEXT NOT NULL DEFAULT now()::text,
      "updatedAt" TEXT NOT NULL DEFAULT now()::text
    )`,
    `CREATE TABLE IF NOT EXISTS notices (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      "authorId" INTEGER NOT NULL,
      "targetRole" TEXT NOT NULL DEFAULT 'all',
      priority TEXT NOT NULL DEFAULT 'normal',
      "createdAt" TEXT NOT NULL DEFAULT now()::text
    )`,
    `CREATE TABLE IF NOT EXISTS notice_reads (
      id SERIAL PRIMARY KEY,
      "noticeId" INTEGER NOT NULL,
      "userId" INTEGER NOT NULL,
      "readAt" TEXT NOT NULL DEFAULT now()::text,
      UNIQUE("noticeId", "userId")
    )`,
  ];
  for (const stmt of alterStatements) {
    await pool.query(stmt);
  }

  console.log("✅ 테이블 준비 완료");

  // ── 단일 지점 트레이너 소속 회원 branchId 자동 배정 ──────────────────────
  try {
    // trainerBranches에서 트레이너별 지점 수 집계
    const allTB = await db.select().from(trainerBranches);
    const tbMap = new Map<number, number[]>(); // trainerId → branchIds
    for (const row of allTB) {
      if (!tbMap.has(row.trainerId)) tbMap.set(row.trainerId, []);
      tbMap.get(row.trainerId)!.push(row.branchId);
    }
    // 단일 지점만 속한 트레이너의 회원 중 branchId가 NULL인 경우만 업데이트
    for (const [trainerId, branchIds] of tbMap.entries()) {
      if (branchIds.length === 1) {
        await db.update(members)
          .set({ branchId: branchIds[0] })
          .where(and(eq(members.trainerId, trainerId), isNull(members.branchId)));
      }
    }
    console.log("✅ 단일 지점 트레이너 회원 branchId 자동 배정 완료");
  } catch (e) {
    console.error("branchId 자동 배정 오류:", e);
  }

  // ── PT 매출 등록 시 누락된 회원 자동 생성 (backfill) ──────────────────────
  try {
    const missingMemberEntries = await db
      .select()
      .from(revenueEntries)
      .where(and(
        eq(revenueEntries.type, "PT"),
        isNull(revenueEntries.memberId),
      ));

    const toFix = missingMemberEntries.filter(
      e => e.trainerId !== null && e.customerName && e.subType !== "이전"
    );

    for (const entry of toFix) {
      const now = new Date().toISOString();
      const [newMember] = await db.insert(members).values({
        trainerId: entry.trainerId!,
        name: entry.customerName!,
        phone: entry.phone ?? undefined,
        status: "active",
        grade: "basic",
        createdAt: now,
        updatedAt: now,
      }).returning({ id: members.id });
      if (newMember) {
        await db.update(revenueEntries).set({ memberId: newMember.id }).where(eq(revenueEntries.id, entry.id));
      }
    }

    if (toFix.length > 0) {
      console.log(`✅ PT 매출 누락 회원 ${toFix.length}건 자동 생성 완료`);
    }
  } catch (e) {
    console.error("PT 매출 누락 회원 생성 오류:", e);
  }

  // ── 기존 회원 회원권 시작일/만료일 자동 보정 ──────────────────────────────
  try {
    // 1) membershipStart가 NULL인 회원: 첫 수업일로 설정
    const noStartMembers = await db
      .select({ id: members.id })
      .from(members)
      .where(isNull(members.membershipStart));

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

    // 2) membershipEnd가 NULL인 회원: 패키지 총 세션 합산 → 10회=1개월
    const noEndMembers = await db
      .select({ id: members.id, membershipStart: members.membershipStart })
      .from(members)
      .where(isNull(members.membershipEnd));

    for (const m of noEndMembers) {
      const pkgRows = await db
        .select({ totalSessions: ptPackages.totalSessions, startDate: ptPackages.startDate })
        .from(ptPackages)
        .where(eq(ptPackages.memberId, m.id))
        .orderBy(ptPackages.createdAt);

      if (!pkgRows.length) continue;

      const totalSessions = pkgRows.reduce((s, p) => s + (p.totalSessions ?? 0), 0);
      if (!totalSessions) continue;

      const months = Math.ceil(totalSessions / 10);
      const baseDate = pkgRows[0].startDate || m.membershipStart || new Date().toISOString().substring(0, 10);
      const d = new Date(baseDate);
      d.setMonth(d.getMonth() + months);
      await db.update(members).set({ membershipEnd: d.toISOString().substring(0, 10) }).where(eq(members.id, m.id));
    }

    console.log("✅ 회원권 날짜 보정 완료");
  } catch (e) {
    console.warn("⚠️ 회원권 날짜 보정 실패:", e);
  }

  // 관리자 계정 생성 (없으면 초기 씨드)
  const existingAdmin = await db.select({ id: users.id }).from(users).where(eq(users.username, "admin")).limit(1);
  if (!existingAdmin[0]) {
    console.log("🌱 초기 데이터 생성 중...");

    const adminPw = bcrypt.hashSync("admin123", 10);
    await db.insert(users).values({ username: "admin", password: adminPw, role: "admin" });
    console.log("✅ 관리자: admin / admin123");

    const trainerPw = bcrypt.hashSync("trainer123", 10);
    const [trainerUser] = await db.insert(users).values({ username: "trainer1", password: trainerPw, role: "trainer" }).returning();
    const [trainerRow] = await db.insert(trainers).values({ userId: trainerUser.id, trainerName: "김트레이너", phone: "010-1234-5678", email: "trainer1@example.com" }).returning();
    await db.insert(trainerSettings).values({ trainerId: trainerRow.id, settlementRate: 60 });
    console.log("✅ 트레이너: trainer1 / trainer123");
  } else {
    console.log("ℹ️  기존 데이터 유지");
  }

  // 고정 트레이너 계정 복구 (없으면 생성)
  const fixedTrainers = [
    { username: "trainer1", trainerName: "이준산", settlementRate: 60 },
    { username: "trainer2", trainerName: "최성길", settlementRate: 50 },
    { username: "trainer3", trainerName: "김현석", settlementRate: 50 },
    { username: "trainer4", trainerName: "김나연", settlementRate: 50 },
  ];
  for (const t of fixedTrainers) {
    const existingUser = await db.select({ id: users.id }).from(users).where(eq(users.username, t.username)).limit(1);
    if (!existingUser[0]) {
      const pw = bcrypt.hashSync("123123", 10);
      const [u] = await db.insert(users).values({ username: t.username, password: pw, role: "trainer" }).returning();
      const [tr] = await db.insert(trainers).values({ userId: u.id, trainerName: t.trainerName }).returning();
      await db.insert(trainerSettings).values({ trainerId: tr.id, settlementRate: t.settlementRate });
      console.log(`✅ 트레이너 복구: ${t.trainerName} (${t.username} / 123123)`);
    }
  }

  // 기본 채널 시드 (없으면 생성)
  const existingChannels = await db.select({ id: channels.id }).from(channels).limit(1);
  if (!existingChannels[0]) {
    await db.insert(channels).values([
      { name: "인스타그램", type: "sns", description: "인스타그램 광고/게시물" },
      { name: "네이버 블로그", type: "online", description: "네이버 블로그 검색" },
      { name: "네이버 지도", type: "online", description: "네이버 지도/플레이스" },
      { name: "카카오 광고", type: "online", description: "카카오 채널/광고" },
      { name: "지인 소개", type: "referral", description: "기존 회원 소개" },
      { name: "현수막/전단", type: "offline", description: "오프라인 홍보물" },
      { name: "유튜브", type: "sns", description: "유튜브 채널" },
      { name: "기타", type: "offline", description: "기타 채널" },
    ]);
    console.log("✅ 기본 채널 데이터 생성 완료");
  }

  // 구글시트 URL 고정 설정 (없으면 자동 생성, 있으면 URL만 갱신)
  const FIXED_SHEET_URL = "https://docs.google.com/spreadsheets/d/1jZbMrBQM_vr2PpvxyprpH1qQlfp_w2hQwdortv65C5w/edit?usp=drivesdk";
  const existingConfig = await db.select({ id: sheetSyncConfig.id }).from(sheetSyncConfig).limit(1);
  if (!existingConfig[0]) {
    await db.insert(sheetSyncConfig).values({
      sheetUrl: FIXED_SHEET_URL,
      columnOffset: 1,
      lastSyncedCount: 0,
      mappingJson: "{}",
      enabled: 1,
    });
    console.log("✅ 구글시트 URL 고정 설정 완료");
  } else {
    await db.update(sheetSyncConfig).set({ sheetUrl: FIXED_SHEET_URL });
    console.log("✅ 구글시트 URL 갱신 완료");
  }

  console.log("✨ DB 초기화 완료!");
}

// 서버 시작
async function start() {
  // 헬스체크 통과를 위해 먼저 리슨 시작
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
  });

  try {
    await initDatabase();
  } catch (e) {
    console.error("DB 초기화 오류 (서버는 계속 실행):", e);
  }

  // 구글시트 자동 동기화 (5분마다)
  setInterval(async () => {
    try {
      const result = await syncSheetNow();
      if (result.newMembers > 0) console.log(`📋 시트 동기화: ${result.message}`);
    } catch (e) {
      console.error("시트 동기화 오류:", e);
    }
  }, 5 * 60 * 1000);
}

start().catch(console.error);
