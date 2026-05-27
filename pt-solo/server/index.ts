import express from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import cors from "cors";
import path from "path";
import fs from "fs";
import cron from "node-cron";
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
app.use(express.json({ limit: "20mb" }));
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
    createContext: async ({ req, res }) => {
      const sessionUser = (req.session as any)?.user as AuthUser | undefined;
      let user = sessionUser;
      if (sessionUser) {
        try {
          const freshRow = await db.select({ role: users.role }).from(users).where(eq(users.id, sessionUser.id)).limit(1);
          if (freshRow[0]) {
            user = { ...sessionUser, role: freshRow[0].role as AuthUser["role"] };
            (req.session as any).user = user;
          }
        } catch {}
      }
      return { user, req, res };
    },
  })
);

// ── Kakao OAuth ───────────────────────────────────────────────────────────────
app.get("/auth/kakao", (_req, res) => {
  const clientId = process.env.KAKAO_CLIENT_ID;
  if (!clientId) return res.redirect("/login?error=kakao_not_configured");
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${process.env.APP_URL || "http://localhost:5000"}/auth/kakao/callback`,
    response_type: "code",
  });
  res.redirect(`https://kauth.kakao.com/oauth/authorize?${params}`);
});

app.get("/auth/kakao/callback", async (req, res) => {
  const code = req.query.code as string;
  if (!code) return res.redirect("/login?error=kakao_cancelled");
  try {
    const tokenRes = await fetch("https://kauth.kakao.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: process.env.KAKAO_CLIENT_ID!,
        redirect_uri: `${process.env.APP_URL || "http://localhost:5000"}/auth/kakao/callback`,
        code,
        ...(process.env.KAKAO_CLIENT_SECRET ? { client_secret: process.env.KAKAO_CLIENT_SECRET } : {}),
      }),
    });
    const tokenData = await tokenRes.json() as any;
    if (!tokenData.access_token) return res.redirect("/login?error=kakao_token_failed");
    const userRes = await fetch("https://kapi.kakao.com/v2/user/me", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const kakaoUser = await userRes.json() as any;
    const name = kakaoUser.kakao_account?.profile?.nickname || kakaoUser.properties?.nickname || "카카오사용자";
    const email = kakaoUser.kakao_account?.email;
    const gender = kakaoUser.kakao_account?.gender;
    const birthYear = kakaoUser.kakao_account?.birthyear;
    const ageRange = kakaoUser.kakao_account?.age_range;
    await handleOAuthLogin(req, res, "kakao", String(kakaoUser.id), name, email, gender, birthYear, ageRange);
  } catch (e) {
    console.error("Kakao OAuth error:", e);
    res.redirect("/login?error=kakao_failed");
  }
});

async function handleOAuthLogin(req: any, res: any, provider: string, providerId: string, name: string, email?: string, gender?: string, birthYear?: string, ageRange?: string) {
  const db2 = getDb();
  // 기존 계정 찾기
  const existing = await pool.query<{ id: number; role: string; position: string | null; trainerId: number | null }>(
    `SELECT u.id, u.role, u.position, t.id AS "trainerId"
     FROM users u LEFT JOIN trainers t ON t."userId"=u.id
     WHERE u.provider=$1 AND u."providerId"=$2 LIMIT 1`,
    [provider, providerId]
  );
  if (existing.rows[0]) {
    const u = existing.rows[0];
    if (u.position === "rejected") return res.redirect("/login?error=rejected");
    // pending 상태라도 소셜 로그인은 active로 자동 승급
    if (u.position === "pending") {
      await pool.query(`UPDATE users SET position='active' WHERE id=$1`, [u.id]);
    }
    // 재로그인 시 카카오 정보 업데이트
    if (u.trainerId) {
      await pool.query(
        `UPDATE trainers SET "trainerName"=$1, email=COALESCE($2, email), gender=COALESCE($3, gender), "birthYear"=COALESCE($4, "birthYear"), "ageRange"=COALESCE($5, "ageRange") WHERE id=$6`,
        [name, email || null, gender || null, birthYear || null, ageRange || null, u.trainerId]
      );
    }
    (req.session as any).user = { id: u.id, username: name, role: u.role, trainerId: u.trainerId ?? undefined };
    await new Promise<void>((resolve, reject) => req.session.save((err: any) => err ? reject(err) : resolve()));
    return res.redirect("/");
  }
  // 신규 가입 — 카카오/소셜 로그인은 즉시 active
  const username = `${provider}_${providerId.slice(0, 8)}`;
  const myCode = Math.random().toString(36).slice(2, 10).toUpperCase();
  const [userRow] = await db2.insert(users).values({ username, password: null as any, role: "trainer", position: "active" }).returning({ id: users.id });
  await pool.query(`UPDATE users SET provider=$1, "providerId"=$2, "referralCode"=$3 WHERE id=$4`, [provider, providerId, myCode, userRow.id]);
  const [trainerRow] = await db2.insert(trainers).values({
    userId: userRow.id,
    trainerName: name,
    email: email || undefined,
    gender: gender || undefined,
    birthYear: birthYear || undefined,
    ageRange: ageRange || undefined,
  }).returning({ id: trainers.id });
  await db2.insert(trainerSettings).values({ trainerId: trainerRow.id, settlementRate: 50 });
  // 신규 가입 즉시 로그인 처리
  (req.session as any).user = { id: userRow.id, username: name, role: "trainer", trainerId: trainerRow.id };
  await new Promise<void>((resolve, reject) => req.session.save((err: any) => err ? reject(err) : resolve()));
  return res.redirect("/");
}

app.get("/.well-known/assetlinks.json", (_req, res) => {
  const sha256 = process.env.TWA_SHA256_CERT_FINGERPRINT || "";
  res.json([
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: {
        namespace: "android_app",
        package_name: process.env.TWA_PACKAGE_NAME || "com.fitstep.app",
        sha256_cert_fingerprints: sha256 ? [sha256] : [],
      },
    },
  ]);
});

app.get("/api/test-smtp", async (_req, res) => {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return res.json({ ok: false, reason: "RESEND_API_KEY missing" });
  res.json({ ok: true, provider: "resend", keyPrefix: apiKey.slice(0, 8) + "..." });
});

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
    `CREATE TABLE IF NOT EXISTS notices (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      "isPinned" BOOLEAN DEFAULT false,
      "isActive" BOOLEAN DEFAULT true,
      "createdAt" TEXT NOT NULL DEFAULT now()::text,
      "updatedAt" TEXT NOT NULL DEFAULT now()::text
    )`,
    `CREATE TABLE IF NOT EXISTS banners (
      id SERIAL PRIMARY KEY,
      text TEXT NOT NULL,
      "subText" TEXT,
      link TEXT,
      "bgColor" TEXT DEFAULT '#6366f1',
      "isActive" BOOLEAN DEFAULT false,
      "createdAt" TEXT NOT NULL DEFAULT now()::text,
      "updatedAt" TEXT NOT NULL DEFAULT now()::text
    )`,
    `CREATE TABLE IF NOT EXISTS tab_banners (
      id SERIAL PRIMARY KEY,
      "tabKey" TEXT NOT NULL UNIQUE,
      text TEXT NOT NULL DEFAULT '',
      "subText" TEXT,
      link TEXT,
      "bgColor" TEXT NOT NULL DEFAULT '#6366f1',
      "isActive" INTEGER NOT NULL DEFAULT 0,
      "updatedAt" TEXT NOT NULL DEFAULT now()::text
    )`,
    `ALTER TABLE tab_banners ADD COLUMN IF NOT EXISTS "imageUrl" TEXT`,
    `ALTER TABLE tab_banners ADD COLUMN IF NOT EXISTS "bannerHeight" TEXT NOT NULL DEFAULT 'medium'`,
    `ALTER TABLE tab_banners ADD COLUMN IF NOT EXISTS "textSize" TEXT NOT NULL DEFAULT 'medium'`,
    `ALTER TABLE tab_banners ADD COLUMN IF NOT EXISTS "textAlign" TEXT NOT NULL DEFAULT 'left'`,
    `CREATE TABLE IF NOT EXISTS verification_codes (
      id SERIAL PRIMARY KEY,
      email TEXT NOT NULL,
      code TEXT NOT NULL,
      "expiresAt" BIGINT NOT NULL,
      "createdAt" TEXT NOT NULL DEFAULT now()::text
    )`,
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
      "trainerId" INTEGER NOT NULL,
      name TEXT NOT NULL,
      phone TEXT,
      gender TEXT,
      "ageGroup" TEXT,
      "channelId" INTEGER,
      status TEXT NOT NULL DEFAULT 'pending',
      "consultationDate" TEXT,
      "consultationType" TEXT,
      "consultationSubTypes" TEXT,
      "consultationNote" TEXT,
      "interestType" TEXT,
      "exercisePurpose" TEXT,
      memo TEXT,
      "registeredMemberId" INTEGER,
      "createdAt" TEXT NOT NULL DEFAULT now()::text,
      "updatedAt" TEXT NOT NULL DEFAULT now()::text
    )`,
    `CREATE TABLE IF NOT EXISTS fit_point_logs (
      id SERIAL PRIMARY KEY,
      "trainerId" INTEGER NOT NULL,
      amount INTEGER NOT NULL,
      type TEXT NOT NULL DEFAULT 'admin_grant',
      memo TEXT,
      status TEXT NOT NULL DEFAULT 'completed',
      "createdAt" TEXT NOT NULL DEFAULT now()::text
    )`,
    `CREATE TABLE IF NOT EXISTS expenses (
      id SERIAL PRIMARY KEY,
      "trainerId" INTEGER NOT NULL,
      amount INTEGER NOT NULL,
      category TEXT NOT NULL DEFAULT '기타',
      memo TEXT,
      "expenseDate" TEXT NOT NULL,
      "createdAt" TEXT NOT NULL DEFAULT now()::text
    )`,
    `CREATE TABLE IF NOT EXISTS fit_step_plus_members (
      id SERIAL PRIMARY KEY,
      "trainerId" INTEGER NOT NULL,
      username TEXT NOT NULL,
      password TEXT NOT NULL,
      name TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      "memberId" INTEGER,
      "membershipType" TEXT NOT NULL DEFAULT 'general',
      "membershipStart" TEXT,
      "membershipEnd" TEXT,
      "isActive" INTEGER NOT NULL DEFAULT 1,
      "createdAt" TEXT NOT NULL DEFAULT now()::text,
      "updatedAt" TEXT NOT NULL DEFAULT now()::text,
      UNIQUE("trainerId", username)
    )`,
    `CREATE TABLE IF NOT EXISTS fit_step_plus_video_categories (
      id SERIAL PRIMARY KEY,
      "trainerId" INTEGER NOT NULL,
      name TEXT NOT NULL,
      "sortOrder" INTEGER NOT NULL DEFAULT 0,
      "createdAt" TEXT NOT NULL DEFAULT now()::text
    )`,
    `CREATE TABLE IF NOT EXISTS fit_step_plus_videos (
      id SERIAL PRIMARY KEY,
      "trainerId" INTEGER NOT NULL,
      "categoryId" INTEGER,
      title TEXT NOT NULL,
      description TEXT,
      "videoUrl" TEXT NOT NULL,
      "thumbnailUrl" TEXT,
      duration INTEGER,
      level TEXT DEFAULT 'beginner',
      "bodyPart" TEXT,
      "isPublished" INTEGER NOT NULL DEFAULT 1,
      "sortOrder" INTEGER NOT NULL DEFAULT 0,
      "createdAt" TEXT NOT NULL DEFAULT now()::text
    )`,
    `CREATE TABLE IF NOT EXISTS fit_step_plus_events (
      id SERIAL PRIMARY KEY,
      "trainerId" INTEGER NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      "imageUrl" TEXT,
      "eventType" TEXT DEFAULT 'notice',
      "startDate" TEXT,
      "endDate" TEXT,
      "isPublished" INTEGER NOT NULL DEFAULT 1,
      "isPinned" INTEGER NOT NULL DEFAULT 0,
      "createdAt" TEXT NOT NULL DEFAULT now()::text
    )`,
    `CREATE TABLE IF NOT EXISTS fit_step_plus_workout_logs (
      id SERIAL PRIMARY KEY,
      "fitStepPlusMemberId" INTEGER NOT NULL,
      "logDate" TEXT NOT NULL,
      title TEXT NOT NULL,
      "exercisesJson" TEXT,
      "durationMinutes" INTEGER,
      "caloriesBurned" INTEGER,
      "bodyWeight" TEXT,
      notes TEXT,
      mood TEXT,
      "createdAt" TEXT NOT NULL DEFAULT now()::text
    )`,
  ];

  for (const sql of tables) {
    await pool.query(sql);
  }

  console.log("✅ 테이블 준비 완료");

  // 기본 채널 시드
  const existingChannels = await pool.query(`SELECT id FROM channels LIMIT 1`);
  if (existingChannels.rows.length === 0) {
    await pool.query(`INSERT INTO channels (name, type) VALUES
      ('네이버 플레이스', 'online'), ('당근마켓 광고', 'online'), ('워크인', 'offline'),
      ('인스타그램', 'sns'), ('전화예약', 'offline'), ('지인 소개', 'referral'), ('기타', 'other')`);
    console.log("✅ 기본 채널 시드 완료");
  } else {
    // 채널 목록을 ZIANTGYM 기준으로 업데이트
    await pool.query(`DELETE FROM channels WHERE name IN ('네이버 블로그', '카카오 플레이스', '지인소개', '현수막/전단지', '직접방문')`);
    const newChannels = [
      { name: '네이버 플레이스', type: 'online' },
      { name: '당근마켓 광고', type: 'online' },
      { name: '워크인', type: 'offline' },
      { name: '전화예약', type: 'offline' },
      { name: '지인 소개', type: 'referral' },
    ];
    for (const ch of newChannels) {
      await pool.query(`INSERT INTO channels (name, type) SELECT $1, $2 WHERE NOT EXISTS (SELECT 1 FROM channels WHERE name = $1)`, [ch.name, ch.type]);
    }
    console.log("✅ 채널 목록 업데이트 완료");
  }

  // trainer_settings 컬럼 추가 (없으면)
  await pool.query(`ALTER TABLE trainers ADD COLUMN IF NOT EXISTS "gender" TEXT`);
  await pool.query(`ALTER TABLE trainers ADD COLUMN IF NOT EXISTS "birthYear" TEXT`);
  await pool.query(`ALTER TABLE trainers ADD COLUMN IF NOT EXISTS "ageRange" TEXT`);
  await pool.query(`ALTER TABLE trainer_settings ADD COLUMN IF NOT EXISTS "subscriptionStatus" TEXT NOT NULL DEFAULT 'trial'`);
  await pool.query(`ALTER TABLE trainer_settings ADD COLUMN IF NOT EXISTS "subscriptionEndDate" TEXT`);
  await pool.query(`ALTER TABLE trainer_settings ADD COLUMN IF NOT EXISTS "adminMemo" TEXT`);
  await pool.query(`ALTER TABLE trainer_settings ADD COLUMN IF NOT EXISTS "termsOfService" TEXT`);
  await pool.query(`ALTER TABLE trainer_settings ADD COLUMN IF NOT EXISTS "privacyPolicy" TEXT`);
  await pool.query(`ALTER TABLE trainer_settings ADD COLUMN IF NOT EXISTS "marketingConsent" TEXT`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS "plan" TEXT NOT NULL DEFAULT 'free'`);
  await pool.query(`ALTER TABLE fit_step_plus_members ADD COLUMN IF NOT EXISTS "trainerId" INTEGER`);
  await pool.query(`ALTER TABLE fit_step_plus_video_categories ADD COLUMN IF NOT EXISTS "trainerId" INTEGER`);
  await pool.query(`ALTER TABLE fit_step_plus_videos ADD COLUMN IF NOT EXISTS "trainerId" INTEGER`);
  await pool.query(`ALTER TABLE fit_step_plus_events ADD COLUMN IF NOT EXISTS "trainerId" INTEGER`);
  await pool.query(`CREATE TABLE IF NOT EXISTS fit_step_plus_attendance (
    id SERIAL PRIMARY KEY,
    "fitStepPlusMemberId" INTEGER NOT NULL,
    "trainerId" INTEGER NOT NULL,
    "attendDate" TEXT NOT NULL,
    "createdAt" TEXT NOT NULL DEFAULT now()::text
  )`);
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS fsp_attendance_member_date ON fit_step_plus_attendance ("fitStepPlusMemberId", "attendDate")`);
  await pool.query(`ALTER TABLE fit_step_plus_attendance ADD COLUMN IF NOT EXISTS "conditionScore" INTEGER`);
  await pool.query(`ALTER TABLE fit_step_plus_attendance ADD COLUMN IF NOT EXISTS "sleepHours" TEXT`);
  await pool.query(`ALTER TABLE fit_step_plus_attendance ADD COLUMN IF NOT EXISTS "energyLevel" TEXT`);
  await pool.query(`ALTER TABLE fit_step_plus_attendance ADD COLUMN IF NOT EXISTS "bodyParts" TEXT`);
  await pool.query(`ALTER TABLE fit_step_plus_attendance ADD COLUMN IF NOT EXISTS "workoutTheme" TEXT`);
  await pool.query(`ALTER TABLE fit_step_plus_attendance ADD COLUMN IF NOT EXISTS "intensity" INTEGER`);

  // 트레이너 상세 프로필 컬럼 추가
  await pool.query(`ALTER TABLE trainers ADD COLUMN IF NOT EXISTS "employmentType" TEXT`);
  await pool.query(`ALTER TABLE trainers ADD COLUMN IF NOT EXISTS "workplaceName" TEXT`);
  await pool.query(`ALTER TABLE trainers ADD COLUMN IF NOT EXISTS "workYears" INTEGER`);
  await pool.query(`ALTER TABLE trainers ADD COLUMN IF NOT EXISTS "specialties" TEXT`);
  await pool.query(`ALTER TABLE trainers ADD COLUMN IF NOT EXISTS "profileBonusGranted" INTEGER NOT NULL DEFAULT 0`);
  await pool.query(`ALTER TABLE trainers ADD COLUMN IF NOT EXISTS "jobType" TEXT`);
  await pool.query(`ALTER TABLE trainers ADD COLUMN IF NOT EXISTS "careerRange" TEXT`);
  await pool.query(`ALTER TABLE trainers ADD COLUMN IF NOT EXISTS "activityArea" TEXT`);
  await pool.query(`ALTER TABLE trainers ADD COLUMN IF NOT EXISTS "profileImage" TEXT`);
  await pool.query(`ALTER TABLE trainers ADD COLUMN IF NOT EXISTS "educationNeeds" TEXT`);
  await pool.query(`ALTER TABLE trainers ADD COLUMN IF NOT EXISTS "onboardingSurveyData" TEXT`);
  await pool.query(`ALTER TABLE trainers ADD COLUMN IF NOT EXISTS "onboardingSurveyDone" INTEGER NOT NULL DEFAULT 0`);
  // OAuth 소셜 로그인
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS "provider" TEXT`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS "providerId" TEXT`);
  await pool.query(`ALTER TABLE users ALTER COLUMN password DROP NOT NULL`);
  // 친구 초대 referral
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS "referralCode" TEXT`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS "referredBy" TEXT`);

  // 브랜드 페이지 컬럼
  await pool.query(`ALTER TABLE trainers ADD COLUMN IF NOT EXISTS "brandBio" TEXT`);
  await pool.query(`ALTER TABLE trainers ADD COLUMN IF NOT EXISTS "brandSpecialties" TEXT`);
  await pool.query(`ALTER TABLE trainers ADD COLUMN IF NOT EXISTS "brandColor" TEXT`);
  await pool.query(`ALTER TABLE trainers ADD COLUMN IF NOT EXISTS "brandInstagram" TEXT`);
  await pool.query(`ALTER TABLE trainers ADD COLUMN IF NOT EXISTS "brandKakao" TEXT`);
  await pool.query(`ALTER TABLE trainers ADD COLUMN IF NOT EXISTS "brandYoutube" TEXT`);
  await pool.query(`ALTER TABLE trainers ADD COLUMN IF NOT EXISTS "brandIsPublic" INTEGER NOT NULL DEFAULT 0`);
  await pool.query(`ALTER TABLE trainers ADD COLUMN IF NOT EXISTS "bookingEnabled" INTEGER NOT NULL DEFAULT 0`);
  await pool.query(`ALTER TABLE trainers ADD COLUMN IF NOT EXISTS "bookingMessage" TEXT`);

  // 상담 예약 테이블
  await pool.query(`CREATE TABLE IF NOT EXISTS consultation_bookings (
    id SERIAL PRIMARY KEY,
    "trainerId" INTEGER NOT NULL,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    "interestType" TEXT,
    message TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TEXT NOT NULL DEFAULT now()::text
  )`);

  // 작업실 기능 잠금해제
  await pool.query(`CREATE TABLE IF NOT EXISTS workshop_unlocks (
    id SERIAL PRIMARY KEY,
    "trainerId" INTEGER NOT NULL,
    feature TEXT NOT NULL,
    "pointsSpent" INTEGER NOT NULL DEFAULT 0,
    "unlockedAt" TEXT NOT NULL DEFAULT now()::text,
    UNIQUE("trainerId", feature)
  )`);

  // 운동 프로그램 템플릿
  await pool.query(`CREATE TABLE IF NOT EXISTS workout_templates (
    id SERIAL PRIMARY KEY,
    "trainerId" INTEGER NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    "bodyPart" TEXT,
    "exercisesJson" TEXT,
    "createdAt" TEXT NOT NULL DEFAULT now()::text
  )`);

  // 맞춤 상담 설문 문항
  await pool.query(`CREATE TABLE IF NOT EXISTS custom_survey_questions (
    id SERIAL PRIMARY KEY,
    "trainerId" INTEGER NOT NULL,
    question TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'text',
    options TEXT,
    "sortOrder" INTEGER DEFAULT 0,
    "isRequired" INTEGER DEFAULT 0,
    "createdAt" TEXT NOT NULL DEFAULT now()::text
  )`);

  // 맞춤 상담 설문 응답
  await pool.query(`CREATE TABLE IF NOT EXISTS custom_survey_responses (
    id SERIAL PRIMARY KEY,
    "trainerId" INTEGER NOT NULL,
    "respondentName" TEXT NOT NULL,
    "respondentPhone" TEXT,
    answers TEXT NOT NULL,
    "createdAt" TEXT NOT NULL DEFAULT now()::text
  )`);
  // 성장 아카데미
  await pool.query(`CREATE TABLE IF NOT EXISTS academy_courses (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    "videoUrl" TEXT,
    "thumbnailUrl" TEXT,
    duration TEXT,
    "courseType" TEXT NOT NULL DEFAULT 'online',
    "pointReward" INTEGER NOT NULL DEFAULT 0,
    "isPublished" INTEGER NOT NULL DEFAULT 0,
    "createdBy" INTEGER NOT NULL,
    "createdAt" TEXT NOT NULL DEFAULT now()::text,
    "updatedAt" TEXT NOT NULL DEFAULT now()::text
  )`);
  // 기존 테이블에 courseType 컬럼 추가 (없을 경우)
  await pool.query(`ALTER TABLE academy_courses ADD COLUMN IF NOT EXISTS "courseType" TEXT NOT NULL DEFAULT 'online'`);
  await pool.query(`CREATE TABLE IF NOT EXISTS academy_completions (
    id SERIAL PRIMARY KEY,
    "courseId" INTEGER NOT NULL,
    "trainerId" INTEGER NOT NULL,
    "completedAt" TEXT NOT NULL DEFAULT now()::text,
    UNIQUE("courseId", "trainerId")
  )`);

  // 기존 유저 중 referralCode 없는 경우 자동 생성
  const noCodeUsers = await pool.query<{ id: number }>(`SELECT id FROM users WHERE "referralCode" IS NULL`);
  for (const u of noCodeUsers.rows) {
    const code = Math.random().toString(36).slice(2, 10).toUpperCase();
    await pool.query(`UPDATE users SET "referralCode"=$1 WHERE id=$2`, [code, u.id]);
  }

  // 포인트 자동 지급 규칙 테이블
  await pool.query(`CREATE TABLE IF NOT EXISTS point_auto_rules (
    id SERIAL PRIMARY KEY,
    event TEXT NOT NULL UNIQUE,
    label TEXT NOT NULL,
    description TEXT,
    amount INTEGER NOT NULL DEFAULT 100,
    "isEnabled" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TEXT NOT NULL DEFAULT now()::text
  )`);
  // 기본 규칙 시드 (없을 때만)
  const ruleCount = await pool.query(`SELECT COUNT(*) FROM point_auto_rules`);
  if (Number(ruleCount.rows[0].count) === 0) {
    await pool.query(`INSERT INTO point_auto_rules (event, label, description, amount, "isEnabled") VALUES
      ('profile_complete', '프로필 완성', '근무형태·근무지·경력·전문분야를 모두 입력한 경우', 200, 1),
      ('registration', '신규 가입 보너스', '트레이너가 처음 가입했을 때', 100, 0),
      ('first_member', '첫 번째 회원 등록', '첫 번째 PT 회원을 등록했을 때', 50, 0),
      ('member_milestone_10', '회원 10명 달성', 'PT 회원이 10명이 되었을 때', 200, 0),
      ('session_milestone_50', 'PT 50회 달성', 'PT 세션 누적 50회를 달성했을 때', 300, 0)
    `);
  }

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

  const existingAdmin = await db.select({ id: users.id, role: users.role }).from(users).where(eq(users.username, "admin")).limit(1);
  if (!existingAdmin[0]) {
    const hash = await (await import("bcryptjs")).default.hash("admin123", 10);
    await db.insert(users).values({ username: "admin", password: hash, role: "admin" });
    console.log("✅ 운영자 계정 생성: admin / admin123");
  } else if (existingAdmin[0].role !== "admin") {
    await db.update(users).set({ role: "admin" }).where(eq(users.username, "admin"));
    console.log("✅ admin 계정 role → admin 으로 업데이트");
  }

  console.log("✨ DB 초기화 완료!");

  // 잘못된 daily_reset으로 적립포인트가 깎인 트레이너 자동 보정 (1회성)
  try {
    const today = new Date().toISOString().slice(0, 10);
    const trainerRows = await pool.query<{ id: number }>(`SELECT id FROM trainers`);
    for (const tr of trainerRows.rows) {
      const totalRow = await pool.query<{ balance: string }>(
        `SELECT COALESCE(SUM(amount),0) AS balance FROM fit_point_logs WHERE "trainerId"=$1 AND status='completed'`, [tr.id]
      );
      const earnedRow = await pool.query<{ balance: string }>(
        `SELECT COALESCE(SUM(amount),0) AS balance FROM fit_point_logs WHERE "trainerId"=$1 AND status='completed' AND type != 'daily_reset'`, [tr.id]
      );
      const total = Number(totalRow.rows[0]?.balance ?? 0);
      const earned = Number(earnedRow.rows[0]?.balance ?? 0);
      const freeHeld = total - earned;
      // 무료포인트가 음수면 적립포인트가 잘못 차감된 것 → 복구
      if (freeHeld < 0) {
        await pool.query(
          `INSERT INTO fit_point_logs ("trainerId", amount, type, memo, status) VALUES ($1,$2,'admin_grant','일일초기화 오류 자동 보정','completed')`,
          [tr.id, -freeHeld]
        );
        console.log(`🔧 포인트 보정: trainerId=${tr.id} +${-freeHeld}P`);
      }
    }
  } catch (e) {
    console.warn("⚠️ 포인트 보정 실패:", e);
  }
}

const DAILY_POINTS: Record<string, number> = { free: 300, pro: 500, elite: 1000 };

async function runDailyPointReset() {
  const today = new Date().toISOString().slice(0, 10);
  const trainerRows = await pool.query<{ id: number; plan: string }>(
    `SELECT t.id, COALESCE(u."plan", 'free') AS plan FROM trainers t LEFT JOIN users u ON u.id = t."userId"`
  );
  let count = 0;
  for (const tr of trainerRows.rows) {
    const alreadyDone = await pool.query(
      `SELECT id FROM fit_point_logs WHERE "trainerId"=$1 AND type='daily_reset' AND "createdAt" >= $2`,
      [tr.id, today + "T00:00:00"]
    );
    if (alreadyDone.rows.length > 0) continue;

    const dailyPoint = DAILY_POINTS[tr.plan] ?? 300;
    const balRow = await pool.query<{ balance: string }>(
      `SELECT COALESCE(SUM(amount),0) AS balance FROM fit_point_logs WHERE "trainerId"=$1 AND status='completed'`,
      [tr.id]
    );
    const earnedRow = await pool.query<{ balance: string }>(
      `SELECT COALESCE(SUM(amount),0) AS balance FROM fit_point_logs WHERE "trainerId"=$1 AND status='completed' AND type != 'daily_reset'`,
      [tr.id]
    );
    const currentBalance = Number(balRow.rows[0]?.balance ?? 0);
    const earnedBalance = Number(earnedRow.rows[0]?.balance ?? 0);
    const targetTotal = earnedBalance + dailyPoint;
    const delta = targetTotal - currentBalance;
    if (delta === 0) continue;
    await pool.query(
      `INSERT INTO fit_point_logs ("trainerId", amount, type, memo, status) VALUES ($1,$2,'daily_reset','일일 무료포인트 충전','completed')`,
      [tr.id, delta]
    );
    count++;
  }
  if (count > 0) console.log(`✅ 일일 FIT POINT 초기화 완료: ${count}명`);
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

  // 매일 자정 FIT POINT 300P 초기화
  cron.schedule("0 0 * * *", () => {
    runDailyPointReset().catch(e => console.error("FIT POINT 초기화 오류:", e));
  }, { timezone: "Asia/Seoul" });

  // 서버 시작 시 당일 초기화 즉시 실행
  runDailyPointReset().catch(e => console.error("FIT POINT 초기화 오류:", e));
}

start().catch(console.error);
