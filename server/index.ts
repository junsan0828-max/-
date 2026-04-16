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

  console.log("✅ 테이블 준비 완료");

  // 관리자 계정 생성 (없으면)
  const existingAdmin = sqlite.prepare("SELECT id FROM users WHERE username = ?").get("admin");
  if (!existingAdmin) {
    console.log("🌱 초기 데이터 생성 중...");
    const adminPw = bcrypt.hashSync("admin123", 10);
    sqlite.prepare("INSERT INTO users (username, password, role) VALUES (?, ?, ?)").run("admin", adminPw, "admin");
    console.log("✅ 관리자: admin / admin123");

    const trainerPw = bcrypt.hashSync("trainer123", 10);
    const trainerUser = sqlite.prepare("INSERT INTO users (username, password, role) VALUES (?, ?, ?)").run("trainer1", trainerPw, "trainer");
    const trainerRow = sqlite.prepare("INSERT INTO trainers (userId, trainerName, phone, email) VALUES (?, ?, ?, ?)").run(trainerUser.lastInsertRowid, "김트레이너", "010-1234-5678", "trainer1@example.com");
    sqlite.prepare("INSERT INTO trainer_settings (trainerId, settlementRate) VALUES (?, ?)").run(trainerRow.lastInsertRowid, 60);
    console.log("✅ 트레이너: trainer1 / trainer123");
  } else {
    console.log("ℹ️  계정 존재 확인");
  }

  console.log("✨ DB 초기화 완료!");
}

// 서버 시작
initDatabase();

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
});
