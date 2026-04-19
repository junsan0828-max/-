import express from "express";
import session from "express-session";
import cors from "cors";
import path from "path";
import fs from "fs";
import bcrypt from "bcryptjs";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "./routers";
import { sqlite, db } from "./db";
import type { AuthUser } from "./auth";
import { users, trainers, trainerSettings } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { syncSheetNow } from "./sheetSync";

const app = express();
const PORT = parseInt(process.env.PORT || "3000");

app.set("trust proxy", 1);
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(
  session({
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

// ─── DB 백업 / 복원 (관리자 전용) ────────────────────────────────────────────

// DB 다운로드
app.get("/api/db-backup", (req, res) => {
  const user = (req.session as any)?.user as AuthUser | undefined;
  if (!user || user.role !== "admin") return res.status(401).json({ error: "관리자만 접근 가능합니다." });
  const dbPath = process.env.DB_PATH ?? path.join(process.cwd(), "trainer.db");
  if (!fs.existsSync(dbPath)) return res.status(404).json({ error: "DB 파일이 없습니다." });
  res.download(dbPath, "trainer_backup.db");
});

// DB 복원 (업로드된 .db 파일로 교체 후 재시작)
app.post("/api/db-restore", express.raw({ type: "*/*", limit: "200mb" }), (req, res) => {
  const user = (req.session as any)?.user as AuthUser | undefined;
  if (!user || user.role !== "admin") return res.status(401).json({ error: "관리자만 접근 가능합니다." });
  const body = req.body as Buffer;
  if (!body || body.length < 100) return res.status(400).json({ error: "유효하지 않은 DB 파일입니다." });
  const dbPath = process.env.DB_PATH ?? path.join(process.cwd(), "trainer.db");
  const backupPath = dbPath + ".bak";
  try {
    // 현재 DB 백업 후 교체
    sqlite.close();
    if (fs.existsSync(dbPath)) fs.copyFileSync(dbPath, backupPath);
    fs.writeFileSync(dbPath, body);
    res.json({ success: true, message: "DB 복원 완료. 서버를 재시작합니다." });
    setTimeout(() => process.exit(0), 500); // Railway가 자동 재시작
  } catch (e: any) {
    res.status(500).json({ error: "복원 실패: " + e.message });
  }
});

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

// DB 초기화: 동기식 (better-sqlite3)
function initDatabase() {
  console.log("🔧 DB 초기화 중...");

  sqlite.exec(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'trainer',
    createdAt TEXT NOT NULL DEFAULT (datetime('now')),
    updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
  )`);

  sqlite.exec(`CREATE TABLE IF NOT EXISTS trainers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER NOT NULL UNIQUE,
    trainerName TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    createdAt TEXT NOT NULL DEFAULT (datetime('now')),
    updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
  )`);

  sqlite.exec(`CREATE TABLE IF NOT EXISTS trainer_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    trainerId INTEGER NOT NULL UNIQUE,
    settlementRate INTEGER NOT NULL DEFAULT 50,
    createdAt TEXT NOT NULL DEFAULT (datetime('now')),
    updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
  )`);

  sqlite.exec(`CREATE TABLE IF NOT EXISTS members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    trainerId INTEGER NOT NULL,
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    birthDate TEXT,
    gender TEXT,
    grade TEXT NOT NULL DEFAULT 'basic',
    status TEXT NOT NULL DEFAULT 'active',
    membershipStart TEXT,
    membershipEnd TEXT,
    profileNote TEXT,
    createdAt TEXT NOT NULL DEFAULT (datetime('now')),
    updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
  )`);

  sqlite.exec(`CREATE TABLE IF NOT EXISTS pt_packages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    memberId INTEGER NOT NULL,
    trainerId INTEGER,
    totalSessions INTEGER NOT NULL,
    usedSessions INTEGER NOT NULL DEFAULT 0,
    packageName TEXT,
    startDate TEXT,
    expiryDate TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    price INTEGER,
    pricePerSession INTEGER,
    paymentAmount INTEGER,
    unpaidAmount INTEGER,
    paymentMethod TEXT,
    paymentMemo TEXT,
    createdAt TEXT NOT NULL DEFAULT (datetime('now')),
    updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
  )`);

  sqlite.exec(`CREATE TABLE IF NOT EXISTS attendances (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    memberId INTEGER NOT NULL,
    trainerId INTEGER NOT NULL,
    attendDate TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'attended',
    createdAt TEXT NOT NULL DEFAULT (datetime('now'))
  )`);

  sqlite.exec(`CREATE TABLE IF NOT EXISTS pt_session_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    memberId INTEGER NOT NULL,
    trainerId INTEGER NOT NULL,
    packageId INTEGER,
    sessionDate TEXT NOT NULL,
    notes TEXT,
    createdAt TEXT NOT NULL DEFAULT (datetime('now'))
  )`);

  sqlite.exec(`CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    memberId INTEGER NOT NULL,
    trainerId INTEGER,
    amount INTEGER NOT NULL,
    paymentDate TEXT,
    paymentMethod TEXT,
    memo TEXT,
    createdAt TEXT NOT NULL DEFAULT (datetime('now'))
  )`);

  sqlite.exec(`CREATE TABLE IF NOT EXISTS workout_memos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    memberId INTEGER NOT NULL,
    trainerId INTEGER NOT NULL,
    memoDate TEXT NOT NULL,
    content TEXT NOT NULL,
    createdAt TEXT NOT NULL DEFAULT (datetime('now'))
  )`);

  sqlite.exec(`CREATE TABLE IF NOT EXISTS attendance_checks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    memberId INTEGER NOT NULL,
    trainerId INTEGER NOT NULL,
    checkDate TEXT NOT NULL,
    checkTime TEXT,
    status TEXT NOT NULL DEFAULT 'attended',
    conditionScore INTEGER,
    sleepHours TEXT,
    energyLevel TEXT,
    diet TEXT,
    painLevel INTEGER,
    painArea TEXT,
    painSide TEXT,
    notes TEXT,
    createdAt TEXT NOT NULL DEFAULT (datetime('now')),
    updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
  )`);

  sqlite.exec(`CREATE TABLE IF NOT EXISTS report_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token TEXT NOT NULL UNIQUE,
    memberId INTEGER NOT NULL,
    trainerId INTEGER NOT NULL,
    createdAt TEXT NOT NULL DEFAULT (datetime('now'))
  )`);

  sqlite.exec(`CREATE TABLE IF NOT EXISTS sheet_sync_config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sheetUrl TEXT NOT NULL,
    columnOffset INTEGER NOT NULL DEFAULT 1,
    lastSyncedCount INTEGER NOT NULL DEFAULT 0,
    mappingJson TEXT NOT NULL DEFAULT '{}',
    enabled INTEGER NOT NULL DEFAULT 1,
    syncedAt TEXT,
    createdAt TEXT NOT NULL DEFAULT (datetime('now'))
  )`);

  sqlite.exec(`CREATE TABLE IF NOT EXISTS sheet_pending_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    birthDate TEXT,
    gender TEXT,
    grade TEXT,
    membershipStart TEXT,
    membershipEnd TEXT,
    profileNote TEXT,
    ptProgram TEXT,
    ptSessions INTEGER,
    paymentAmount INTEGER,
    unpaidAmount INTEGER,
    paymentMethod TEXT,
    sheetRowIndex INTEGER,
    importedAt TEXT NOT NULL DEFAULT (datetime('now'))
  )`);

  sqlite.exec(`CREATE TABLE IF NOT EXISTS par_q (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    memberId INTEGER NOT NULL UNIQUE,
    height TEXT, weight TEXT, muscleMass TEXT, bodyFatPercent TEXT, bodyFatKg TEXT, waistCircumference TEXT,
    systolicBp TEXT, diastolicBp TEXT, totalCholesterol TEXT, hdlCholesterol TEXT, ldlCholesterol TEXT,
    triglycerides TEXT, fastingBloodSugar TEXT, postMealBloodSugar TEXT, hba1c TEXT, boneDensity TEXT,
    occupation TEXT, workEnvironment TEXT, exerciseExperience TEXT, visitRoute TEXT,
    goal1 TEXT, goal2 TEXT, goal3 TEXT,
    dietIssues TEXT, alcoholIssues TEXT, sleepIssues TEXT, activityIssues TEXT,
    chronicDiseases TEXT, musculoskeletalIssues TEXT, posturalIssues TEXT,
    createdAt TEXT NOT NULL DEFAULT (datetime('now')),
    updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
  )`);

  // PT 정지 내역
  sqlite.exec(`CREATE TABLE IF NOT EXISTS pt_pauses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    packageId INTEGER NOT NULL,
    memberId INTEGER NOT NULL,
    pauseStart TEXT NOT NULL,
    pauseEnd TEXT,
    reason TEXT,
    createdAt TEXT NOT NULL DEFAULT (datetime('now'))
  )`);

  // 예약/일정
  sqlite.exec(`CREATE TABLE IF NOT EXISTS schedules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    memberId INTEGER NOT NULL,
    trainerId INTEGER NOT NULL,
    scheduledDate TEXT NOT NULL,
    scheduledTime TEXT,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    createdAt TEXT NOT NULL DEFAULT (datetime('now'))
  )`);

  // 기존 테이블 컬럼 마이그레이션 (ADD COLUMN IF NOT EXISTS 미지원 → try/catch)
  const addCol = (table: string, col: string, def: string) => {
    try { sqlite.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${def}`); } catch {}
  };
  addCol("members", "visitRoute", "TEXT");
  addCol("pt_packages", "paymentDate", "TEXT");
  addCol("pt_session_logs", "bodyPart", "TEXT");
  addCol("pt_session_logs", "exercisesJson", "TEXT");

  console.log("✅ 테이블 준비 완료");

  // 관리자 계정 생성 (없으면 초기 씨드 전체 실행)
  const existingAdmin = sqlite.prepare("SELECT id FROM users WHERE username = ?").get("admin") as { id: number } | undefined;
  if (!existingAdmin) {
    console.log("🌱 초기 데이터 생성 중...");

    const adminPw = bcrypt.hashSync("admin123", 10);
    sqlite.prepare("INSERT INTO users (username, password, role) VALUES (?, ?, ?)").run("admin", adminPw, "admin");
    console.log("✅ 관리자: admin / admin123");

    const trainerPw = bcrypt.hashSync("trainer123", 10);
    const trainerUser = sqlite.prepare("INSERT INTO users (username, password, role) VALUES (?, ?, ?)").run("trainer1", trainerPw, "trainer") as { lastInsertRowid: number };
    const trainerRow = sqlite.prepare("INSERT INTO trainers (userId, trainerName, phone, email) VALUES (?, ?, ?, ?)").run(trainerUser.lastInsertRowid, "김트레이너", "010-1234-5678", "trainer1@example.com") as { lastInsertRowid: number };
    sqlite.prepare("INSERT INTO trainer_settings (trainerId, settlementRate) VALUES (?, ?)").run(trainerRow.lastInsertRowid, 60);
    console.log("✅ 트레이너: trainer1 / trainer123");

    const tid = trainerRow.lastInsertRowid;
    const fmt = (d: Date) => d.toISOString().split("T")[0];
    const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86400000);
    const today = new Date();

    // 샘플 회원 1: 만료 임박 + PT 잔여 있음
    const m1 = sqlite.prepare(
      "INSERT INTO members (trainerId, name, phone, gender, grade, status, membershipStart, membershipEnd, profileNote) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).run(tid, "홍길동", "010-1111-2222", "male", "premium", "active", fmt(today), fmt(addDays(today, 5)), "무릎 부상 주의") as { lastInsertRowid: number };
    sqlite.prepare(
      "INSERT INTO pt_packages (memberId, trainerId, totalSessions, usedSessions, packageName, startDate, expiryDate, pricePerSession, paymentAmount, paymentMethod) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).run(m1.lastInsertRowid, tid, 20, 15, "웨이트PT", fmt(today), fmt(addDays(today, 5)), 50000, 1000000, "카드");

    // 샘플 회원 2: 미수금 있음
    const m2 = sqlite.prepare(
      "INSERT INTO members (trainerId, name, phone, gender, grade, status, membershipStart, membershipEnd) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    ).run(tid, "이영희", "010-3333-4444", "female", "basic", "active", fmt(addDays(today, -30)), fmt(addDays(today, 60))) as { lastInsertRowid: number };
    sqlite.prepare(
      "INSERT INTO pt_packages (memberId, trainerId, totalSessions, usedSessions, packageName, startDate, expiryDate, pricePerSession, paymentAmount, unpaidAmount, paymentMethod, paymentMemo) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).run(m2.lastInsertRowid, tid, 10, 3, "케어PT", fmt(addDays(today, -30)), fmt(addDays(today, 60)), 60000, 400000, 200000, "이체", "분납 중");

    // 샘플 회원 3: 장기 미출석 (마지막 출석 40일 전)
    const m3 = sqlite.prepare(
      "INSERT INTO members (trainerId, name, phone, gender, grade, status, membershipStart, membershipEnd) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    ).run(tid, "박민준", "010-5555-6666", "male", "vip", "active", fmt(addDays(today, -90)), fmt(addDays(today, 90))) as { lastInsertRowid: number };
    sqlite.prepare(
      "INSERT INTO pt_packages (memberId, trainerId, totalSessions, usedSessions, packageName, startDate, expiryDate, pricePerSession, paymentAmount, paymentMethod) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).run(m3.lastInsertRowid, tid, 30, 10, "필라테스", fmt(addDays(today, -90)), fmt(addDays(today, 90)), 70000, 2100000, "현금");
    sqlite.prepare(
      "INSERT INTO attendances (memberId, trainerId, attendDate) VALUES (?, ?, ?)"
    ).run(m3.lastInsertRowid, tid, fmt(addDays(today, -40)));

    console.log("✅ 샘플 회원 3명 생성 (홍길동·이영희·박민준)");
  } else {
    console.log("ℹ️  기존 데이터 유지");
  }

  console.log("✨ DB 초기화 완료!");
}

// 서버 시작
initDatabase();

// 구글시트 자동 동기화 (5분마다)
setInterval(async () => {
  try {
    const result = await syncSheetNow();
    if (result.newMembers > 0) console.log(`📋 시트 동기화: ${result.message}`);
  } catch (e) {
    console.error("시트 동기화 오류:", e);
  }
}, 5 * 60 * 1000);

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
});
