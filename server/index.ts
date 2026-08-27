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
import { users, trainers, trainerSettings, sheetSyncConfig, channels, members, ptPackages, ptSessionLogs, trainerBranches, revenueEntries, healthReports, ptReports } from "../drizzle/schema";
import { eq, and, isNull, sql } from "drizzle-orm";
import { syncSheetNow } from "./sheetSync";
import { startNotionBriefingScheduler } from "./notionBriefing";
import { generateHealthReportHTML } from "./healthReportHTML";
import { generatePTReportHTML } from "./ptReportHTML";
import { createBranchManagerMcpRouter, getBranchManagerProtectedResourceMetadata } from "./branchManagerMcp";

const app = express();
const PORT = parseInt(process.env.PORT || "3000");

const PgSession = connectPgSimple(session);

app.set("trust proxy", 1);
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
const pgStore = new PgSession({
  pool,
  tableName: "session",
  createTableIfMissing: true,
  // disableTouch(false, 기본값): 활동이 있을 때마다 만료시각을 연장한다(rolling session).
  // 예전엔 true였는데, 그러면 로그인 시점 기준 정확히 7일 뒤 활동 여부와 무관하게 무조건
  // 로그아웃되어 "계속 쓰는데도 자꾸 세션 만료" 문제로 이어졌다.
  errorLog: (err: Error) => console.error("session store error:", err.message),
});

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled Rejection:", reason);
});

app.use(
  session({
    store: pgStore,
    secret: process.env.SESSION_SECRET || "trainer-app-secret",
    resave: false,
    saveUninitialized: false,
    // rolling: 요청마다 쿠키를 다시 내려보내 브라우저 쪽 만료시각도 같이 연장한다.
    // 위 pgStore의 touch(서버 쪽 연장)만으로는 부족하다 — 브라우저 쿠키 자체가 로그인 시점
    // 기준 만료로 고정되어 있으면, 서버가 연장해봐야 그 쿠키가 먼저 사라져 소용없다.
    rolling: true,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  })
);

// OAuth 2.1 protected resource metadata for ChatGPT custom MCP registration
app.get(["/.well-known/oauth-protected-resource", "/.well-known/oauth-protected-resource/mcp/branch-manager"], (_req, res) => {
  res.json(getBranchManagerProtectedResourceMetadata());
});

// MCP: 온라인 지부장/제이용 읽기 전용 운영 조회
app.use("/mcp/branch-manager", createBranchManagerMcpRouter());

// REST: 만료 임박 회원 목록 (tRPC 우회)
app.get("/api/expiring-members", async (req, res) => {
  if (!(req.session as any)?.user) return res.status(401).json({ error: "unauthorized" });
  try {
    const now = Date.now() + 9 * 3600000;
    const today = new Date(now).toISOString().substring(0, 10);
    const future = new Date(now + 30 * 86400000).toISOString().substring(0, 10);
    const result = await pool.query(
      `SELECT m.id, m.name, m.phone, m."membershipEnd",
              t."trainerName",
              (m."membershipEnd"::date - $3::date)::int AS days_left
       FROM members m
       LEFT JOIN trainers t ON t.id = m."trainerId"
       WHERE m.status = 'active'
         AND m."membershipEnd" IS NOT NULL
         AND m."membershipEnd" >= $1
         AND m."membershipEnd" <= $2
       ORDER BY m."membershipEnd" ASC`,
      [today, future, today]
    );
    res.json({ today, future, count: result.rows.length, members: result.rows });
  } catch (err: any) {
    console.error("[/api/expiring-members]", err);
    res.status(500).json({ error: err.message });
  }
});

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

// 배너 이미지 서빙 (ETag 기반 캐시 — 이미지 바뀌면 즉시 반영)
app.get("/api/banner-image/:id", async (req, res) => {
  try {
    const result = await pool.query('SELECT "imageData" FROM kiosk_banners WHERE id = $1', [req.params.id]);
    const imageData: string | null = result.rows[0]?.imageData ?? null;
    if (!imageData) return res.status(404).send("Not found");
    const etag = `"${imageData.length}"`;
    if (req.headers["if-none-match"] === etag) return res.status(304).end();
    const typeMatch = imageData.match(/^data:(image\/[\w+]+);base64,/);
    const mimeType = typeMatch?.[1] ?? "image/jpeg";
    const base64 = imageData.replace(/^data:image\/[\w+]+;base64,/, "");
    res.setHeader("Content-Type", mimeType);
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("ETag", etag);
    res.send(Buffer.from(base64, "base64"));
  } catch (e) {
    console.error("banner-image error:", e);
    res.status(500).send("오류");
  }
});

// 건강보고서 공개 페이지 (토큰 기반, 인증 불필요)
app.get("/api/health-report/:token", async (req, res) => {
  try {
    const dbConn = await import("./db").then(m => m.db);
    if (!dbConn) return res.status(503).send("서버 준비 중");
    const [report] = await dbConn.select().from(healthReports).where(eq(healthReports.token, req.params.token));
    if (!report) return res.status(404).send("<h1>보고서를 찾을 수 없습니다</h1>");
    const data = JSON.parse(report.reportData);
    const html = generateHealthReportHTML(data, report.aiText);
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(html);
  } catch (e) {
    console.error(e);
    res.status(500).send("오류가 발생했습니다");
  }
});

// PT 변화 리포트 공개 페이지 (토큰 기반, 인증 불필요)
app.get("/api/pt-report/:token", async (req, res) => {
  try {
    const dbConn = await import("./db").then(m => m.db);
    if (!dbConn) return res.status(503).send("서버 준비 중");
    const [report] = await dbConn.select().from(ptReports).where(eq(ptReports.token, req.params.token));
    if (!report) return res.status(404).send("<h1>보고서를 찾을 수 없습니다</h1>");
    const data = JSON.parse(report.reportData);
    const html = generatePTReportHTML(data, report.aiText);
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(html);
  } catch (e) {
    console.error(e);
    res.status(500).send("오류가 발생했습니다");
  }
});

// 양도양수 계약서 공개 조회 (토큰 기반, 인증 불필요)
app.get("/api/transfer/:token", async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM transfer_contracts WHERE token = $1', [req.params.token]);
    const contract = result.rows[0];
    if (!contract) return res.status(404).json({ error: "계약서를 찾을 수 없습니다" });
    // Remove signatures from response for security (return only metadata)
    const { transferorSignature, transfereeSignature, ...safe } = contract;
    return res.json({
      ...safe,
      transferorSigned: !!transferorSignature,
      transfereeSigned: !!transfereeSignature,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "오류" });
  }
});

// ─── 공개 체형분석 예약 API (자이언트짐++ 랜딩페이지에서 호출) ─────────────────
app.get("/api/booking/ping", (_req, res) => {
  res.json({ status: "ok", version: "v3" });
});

app.post("/api/booking", async (req, res) => {
  const { name, phone, birthDate, gender, height, purpose, experience, concern, privacyAgreed, marketingAgreed, marketingChannels } = req.body;
  if (!name || !phone) return res.status(400).json({ error: "이름과 연락처는 필수입니다." });

  const now = new Date().toISOString();

  // ageGroup 계산
  const ageGroup = (() => {
    if (!birthDate) return null;
    const year = parseInt(String(birthDate).slice(0, 4));
    if (isNaN(year)) return null;
    const age = new Date().getFullYear() - year;
    if (age < 20) return "10대";
    if (age < 30) return "20대";
    if (age < 40) return "30대";
    if (age < 50) return "40대";
    if (age < 60) return "50대";
    return "60대 이상";
  })();

  // 1. 체형분석 예약 저장 (실패해도 leads 삽입은 진행)
  let reservationId: number | null = null;
  try {
    await pool.query(`CREATE TABLE IF NOT EXISTS body_analysis_reservations (
      id SERIAL PRIMARY KEY, name TEXT NOT NULL, phone TEXT NOT NULL,
      "birthDate" TEXT, gender TEXT, height TEXT, purpose TEXT, experience TEXT, concern TEXT,
      "privacyAgreed" INTEGER NOT NULL DEFAULT 0, "marketingAgreed" INTEGER NOT NULL DEFAULT 0,
      "marketingChannels" TEXT, status TEXT NOT NULL DEFAULT 'pending', note TEXT,
      "createdAt" TEXT NOT NULL DEFAULT now()::text
    )`);
    const resResult = await pool.query(
      `INSERT INTO body_analysis_reservations (name, phone, "birthDate", gender, height, purpose, experience, concern, "privacyAgreed", "marketingAgreed", "marketingChannels", status, "createdAt")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'pending',$12) RETURNING id`,
      [name, phone, birthDate ?? null, gender ?? null, height ?? null, purpose ?? null, experience ?? null, concern ?? null, privacyAgreed ? 1 : 0, marketingAgreed ? 1 : 0, marketingChannels ?? null, now]
    );
    reservationId = resResult.rows[0]?.id ?? null;
  } catch (e) {
    console.error("/api/booking - reservation insert error:", e);
  }

  // 2. 상담관리(leads) 카드 자동 생성 (핵심)
  try {
    const memoLines: string[] = [];
    if (height) memoLines.push(`키: ${height}cm`);
    if (experience) memoLines.push(`운동경험: ${experience}`);
    if (concern) memoLines.push(`고민: ${concern}`);
    if (reservationId) memoLines.push(`[체형분석예약 #${reservationId}]`);

    await pool.query(
      `INSERT INTO leads (name, phone, gender, "ageGroup", "consultationType", "consultationSubTypes", "exercisePurpose", memo, status, "createdAt", "updatedAt")
       VALUES ($1,$2,$3,$4,'온라인예약','체형분석예약',$5,$6,'pending',$7,$7)`,
      [name, phone, gender ?? null, ageGroup, purpose ?? null, memoLines.join(" / "), now]
    );
    return res.json({ success: true, id: reservationId });
  } catch (e) {
    console.error("/api/booking - leads insert error:", e);
    return res.status(500).json({ error: "서버 오류" });
  }
});

// ─── 포인트 회원권 연장 (자이언트짐++ → 통합운영) ──────────────────────────────
// 만료일 계산·갱신은 통합운영만 수행한다(CLAUDE.md: 데이터 정의·운영 규칙은 통합운영 소유).
// 자이언트짐++는 승인 시 이 API를 호출하고, 성공 응답을 받은 뒤에만 포인트를 차감해야
// "연장은 됐는데 포인트가 안 깎임"(또는 그 반대) 상태를 피할 수 있다.
const POINT_EXTENSION_MIN_BALANCE = 5000; // 이 미만이면 사용 불가 → 만료 시 재등록 유도
const POINT_EXTENSION_POINTS_PER_DAY = 1000; // 1,000P = 1일 (사용은 1,000P 단위)

app.post("/api/point-extension", async (req, res) => {
  const { gymPlusMemberId, pointBalance, pointsToUse, requestId, approvedBy } = req.body ?? {};
  if (!gymPlusMemberId || !requestId) {
    return res.status(400).json({ error: "gymPlusMemberId와 requestId는 필수입니다." });
  }
  const balance = Number(pointBalance);
  if (!Number.isFinite(balance)) {
    return res.status(400).json({ error: "pointBalance가 올바르지 않습니다." });
  }
  // 사용 기준선: 잔액이 5,000P 미만이면 아예 사용 불가(만료 시 재등록 유도).
  if (balance < POINT_EXTENSION_MIN_BALANCE) {
    return res.status(400).json({
      error: `포인트 ${POINT_EXTENSION_MIN_BALANCE.toLocaleString()}P 이상부터 사용할 수 있습니다. (현재 ${balance.toLocaleString()}P)`,
      code: "INSUFFICIENT_POINTS",
    });
  }
  // 기준선을 넘으면 보유량만큼 쓸 수 있다(1,000P 단위). 미지정 시 사용 가능한 전액.
  const usable = Math.floor(balance / POINT_EXTENSION_POINTS_PER_DAY) * POINT_EXTENSION_POINTS_PER_DAY;
  const points = pointsToUse == null ? usable : Number(pointsToUse);
  if (!Number.isFinite(points) || points <= 0) {
    return res.status(400).json({ error: "pointsToUse가 올바르지 않습니다." });
  }
  if (points % POINT_EXTENSION_POINTS_PER_DAY !== 0) {
    return res.status(400).json({
      error: `포인트는 ${POINT_EXTENSION_POINTS_PER_DAY.toLocaleString()}P 단위로만 사용할 수 있습니다.`,
      code: "INVALID_UNIT",
    });
  }
  if (points < POINT_EXTENSION_MIN_BALANCE) {
    return res.status(400).json({
      error: `한 번에 ${POINT_EXTENSION_MIN_BALANCE.toLocaleString()}P 이상 사용해야 합니다.`,
      code: "BELOW_MIN_USE",
    });
  }
  if (points > balance) {
    return res.status(400).json({
      error: `보유 포인트(${balance.toLocaleString()}P)보다 많이 사용할 수 없습니다.`,
      code: "EXCEEDS_BALANCE",
    });
  }
  const extensionDays = points / POINT_EXTENSION_POINTS_PER_DAY;

  try {
    // 멱등성: 같은 신청(requestId)이 이미 처리됐으면 기존 결과를 그대로 돌려준다.
    // (자이언트짐++ 쪽 재시도/중복 클릭으로 회원권이 두 번 늘어나는 사고 방지)
    const dup = await pool.query(
      `SELECT * FROM point_membership_extensions WHERE "requestId" = $1 LIMIT 1`,
      [requestId]
    );
    if (dup.rows[0]) {
      const r = dup.rows[0];
      return res.json({
        success: true, alreadyProcessed: true,
        extensionDays: r.extensionDays, pointsUsed: r.pointsUsed,
        newMembershipEnd: r.newEnd, memberId: r.memberId,
      });
    }

    const gp = await pool.query(
      `SELECT id, "memberId", name, phone, "membershipEnd" FROM gym_plus_members WHERE id = $1 LIMIT 1`,
      [gymPlusMemberId]
    );
    if (!gp.rows[0]) return res.status(404).json({ error: "회원을 찾을 수 없습니다." });
    const appMember = gp.rows[0];

    // 연결된 통합운영 회원 찾기: memberId 우선, 없으면 이름+전화(숫자만) 매칭
    let linkedMemberId: number | null = appMember.memberId ?? null;
    let opsEnd: string | null = null;
    if (!linkedMemberId && appMember.name && appMember.phone) {
      const m = await pool.query(
        `SELECT id, "membershipEnd" FROM members
         WHERE name = $1
           AND REGEXP_REPLACE(COALESCE(phone,''), '[^0-9]', '', 'g') = REGEXP_REPLACE($2, '[^0-9]', '', 'g')
         LIMIT 1`,
        [appMember.name, appMember.phone]
      );
      if (m.rows[0]) {
        linkedMemberId = m.rows[0].id;
        opsEnd = m.rows[0].membershipEnd ?? null;
        await pool.query(`UPDATE gym_plus_members SET "memberId" = $1 WHERE id = $2`, [linkedMemberId, appMember.id]);
      }
    } else if (linkedMemberId) {
      const m = await pool.query(`SELECT "membershipEnd" FROM members WHERE id = $1 LIMIT 1`, [linkedMemberId]);
      opsEnd = m.rows[0]?.membershipEnd ?? null;
    }

    // 연장 기준일: 통합운영 회원의 만료일이 원본. 아직 안 지났으면 그 날짜에서, 이미
    // 지났으면 오늘(KST)부터 연장한다. UTC로 계산하면 한국 오전에 하루 밀린다.
    const todayKst = new Date(Date.now() + 9 * 3600000).toISOString().substring(0, 10);
    const baseEndStr = opsEnd ?? appMember.membershipEnd ?? null;
    const base = baseEndStr && baseEndStr >= todayKst ? baseEndStr : todayKst;
    const [by, bm, bd] = base.split("-").map(Number);
    const endDate = new Date(Date.UTC(by, bm - 1, bd));
    endDate.setUTCDate(endDate.getUTCDate() + extensionDays);
    const newEnd = endDate.toISOString().substring(0, 10);

    // 이력 먼저 기록(UNIQUE requestId로 동시 중복 요청도 여기서 걸린다)
    await pool.query(
      `INSERT INTO point_membership_extensions
       ("gymPlusMemberId","memberId","customerName","requestId","pointsUsed","extensionDays","previousEnd","newEnd","approvedBy","createdAt")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [appMember.id, linkedMemberId, appMember.name ?? null, requestId,
       points, extensionDays, baseEndStr, newEnd,
       approvedBy ?? null, new Date().toISOString()]
    );

    // 만료일 갱신: 통합운영 회원(원본) + 앱 회원 양쪽
    if (linkedMemberId) {
      await pool.query(
        `UPDATE members SET "membershipEnd" = $1, "updatedAt" = $2 WHERE id = $3`,
        [newEnd, new Date().toISOString(), linkedMemberId]
      );
    }
    await pool.query(`UPDATE gym_plus_members SET "membershipEnd" = $1 WHERE id = $2`, [newEnd, appMember.id]);

    console.log(`🎁 포인트 연장: ${appMember.name ?? gymPlusMemberId} · ${points.toLocaleString()}P → ${extensionDays}일 (${baseEndStr ?? "-"} → ${newEnd})`);
    return res.json({
      success: true,
      extensionDays,
      pointsUsed: points,
      newMembershipEnd: newEnd,
      memberId: linkedMemberId,
    });
  } catch (e: any) {
    // UNIQUE 위반 = 동시에 들어온 중복 요청. 이미 처리된 것으로 응답.
    if (e?.code === "23505") {
      return res.status(409).json({ error: "이미 처리된 신청입니다.", code: "ALREADY_PROCESSED" });
    }
    console.error("/api/point-extension error:", e);
    return res.status(500).json({ error: "서버 오류" });
  }
});

// 프론트엔드 정적 파일 서빙
const clientDistPath = path.join(process.cwd(), "client", "dist");
if (fs.existsSync(clientDistPath)) {
  // 해시된 자산(assets/*)은 장기 캐시, index.html은 no-cache로 항상 최신 페이지 제공
  // → 배포 후 브라우저/CDN이 옛 화면을 계속 띄우는 문제 방지
  app.use(express.static(clientDistPath, {
    setHeaders: (res, filePath) => {
      if (filePath.endsWith("index.html")) {
        res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      } else if (filePath.includes(`${path.sep}assets${path.sep}`)) {
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      }
    },
  }));

  const sendIndexNoCache = (res: express.Response) => {
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.sendFile(path.join(clientDistPath, "index.html"));
  };

  // 키오스크: manifest-kiosk.json 참조하는 별도 HTML 서빙
  app.get("/kiosk", (_req, res) => {
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    try {
      let html = fs.readFileSync(path.join(clientDistPath, "index.html"), "utf8");
      html = html
        .replace('href="/manifest.json"', 'href="/manifest-kiosk.json"')
        .replace('content="ZIANTGYM"', 'content="키오스크"')
        .replace('<title>ZIANTGYM</title>', '<title>ZIANTGYM 키오스크</title>');
      res.type("html").send(html);
    } catch {
      res.sendFile(path.join(clientDistPath, "index.html"));
    }
  });

  app.get("*", (_req, res) => {
    sendIndexNoCache(res);
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
    `CREATE TABLE IF NOT EXISTS refund_contracts (
      id SERIAL PRIMARY KEY,
      token TEXT NOT NULL UNIQUE,
      "memberId" INTEGER,
      "packageId" INTEGER,
      "memberName" TEXT,
      "memberPhone" TEXT,
      "programName" TEXT NOT NULL DEFAULT '',
      "paymentAmount" INTEGER NOT NULL DEFAULT 0,
      "totalSessions" INTEGER NOT NULL DEFAULT 0,
      "usedSessions" INTEGER NOT NULL DEFAULT 0,
      "paymentMethod" TEXT,
      "taxAmount" INTEGER NOT NULL DEFAULT 0,
      "penaltyAmount" INTEGER NOT NULL DEFAULT 0,
      "serviceItems" TEXT,
      "refundItems" TEXT,
      "refundAmount" INTEGER NOT NULL DEFAULT 0,
      reason TEXT,
      "gymName" TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
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
    `ALTER TABLE members ALTER COLUMN "trainerId" DROP NOT NULL`,
    `ALTER TABLE revenue_entries ADD COLUMN IF NOT EXISTS "customerName" TEXT`,
    `ALTER TABLE revenue_entries ADD COLUMN IF NOT EXISTS "phone" TEXT`,
    `ALTER TABLE revenue_entries ADD COLUMN IF NOT EXISTS "programDetail" TEXT`,
    `ALTER TABLE revenue_entries ADD COLUMN IF NOT EXISTS "sessions" INTEGER`,
    `ALTER TABLE revenue_entries ADD COLUMN IF NOT EXISTS "duration" INTEGER`,
    `ALTER TABLE revenue_entries ADD COLUMN IF NOT EXISTS "startDate" TEXT`,
    `ALTER TABLE expense_entries ADD COLUMN IF NOT EXISTS "subCategory" TEXT`,
    `ALTER TABLE expense_entries ADD COLUMN IF NOT EXISTS "paymentMethod" TEXT`,
    `ALTER TABLE expense_entries ADD COLUMN IF NOT EXISTS "isRecurring" INTEGER DEFAULT 0`,
    `ALTER TABLE leads ADD COLUMN IF NOT EXISTS "consultationType" TEXT`,
    `ALTER TABLE leads ADD COLUMN IF NOT EXISTS "consultationSubTypes" TEXT`,
    `ALTER TABLE leads ADD COLUMN IF NOT EXISTS "assignedConsultantId" INTEGER`,
    `ALTER TABLE leads ADD COLUMN IF NOT EXISTS "isViewed" INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE leads ADD COLUMN IF NOT EXISTS "exercisePurpose" TEXT`,
    `ALTER TABLE leads ADD COLUMN IF NOT EXISTS "signatureDataUrl" TEXT`,
    `ALTER TABLE members ADD COLUMN IF NOT EXISTS "renewalIntent" TEXT`,
    `ALTER TABLE pt_packages ADD COLUMN IF NOT EXISTS "serviceSessions" INTEGER DEFAULT 0`,
    `ALTER TABLE revenue_entries ADD COLUMN IF NOT EXISTS "serviceSessions" INTEGER DEFAULT 0`,
    `ALTER TABLE revenue_entries ADD COLUMN IF NOT EXISTS "serviceHealthDuration" INTEGER`,
    `ALTER TABLE revenue_entries ADD COLUMN IF NOT EXISTS "transferAmount" INTEGER`,
    `ALTER TABLE revenue_entries ADD COLUMN IF NOT EXISTS "cardAmount" INTEGER`,
    `ALTER TABLE revenue_entries ADD COLUMN IF NOT EXISTS "pauseDays" INTEGER DEFAULT 0`,
    `ALTER TABLE pt_session_logs ADD COLUMN IF NOT EXISTS "sharedToMember" INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE pt_session_logs ADD COLUMN IF NOT EXISTS "sharedAt" TEXT`,
    `ALTER TABLE pt_session_logs ADD COLUMN IF NOT EXISTS "isDraft" INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE pt_session_logs ADD COLUMN IF NOT EXISTS "memberName" TEXT`,
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
    `CREATE TABLE IF NOT EXISTS health_reports (
      id SERIAL PRIMARY KEY,
      token TEXT NOT NULL UNIQUE,
      "memberId" INTEGER NOT NULL,
      "generatedBy" INTEGER NOT NULL,
      "reportData" TEXT NOT NULL,
      "aiText" TEXT NOT NULL,
      "isAI" INTEGER NOT NULL DEFAULT 0,
      "createdAt" TEXT NOT NULL DEFAULT now()::text
    )`,
    `CREATE TABLE IF NOT EXISTS pt_reports (
      id SERIAL PRIMARY KEY,
      token TEXT NOT NULL UNIQUE,
      "packageId" INTEGER NOT NULL,
      "memberId" INTEGER NOT NULL,
      "generatedBy" INTEGER NOT NULL,
      "reportIndex" INTEGER NOT NULL,
      "milestoneSession" INTEGER NOT NULL,
      "fromSession" INTEGER NOT NULL,
      "reportData" TEXT NOT NULL,
      "aiText" TEXT NOT NULL,
      "isAI" INTEGER NOT NULL DEFAULT 0,
      "createdAt" TEXT NOT NULL DEFAULT now()::text
    )`,
    `ALTER TABLE sheet_pending_members ADD COLUMN IF NOT EXISTS "membershipType" TEXT`,
    `ALTER TABLE kiosk_banners ADD COLUMN IF NOT EXISTS "textAlign" TEXT DEFAULT 'center'`,
    `ALTER TABLE kiosk_banners ADD COLUMN IF NOT EXISTS "textVAlign" TEXT DEFAULT 'center'`,
    `ALTER TABLE kiosk_banners ADD COLUMN IF NOT EXISTS "branchId" INTEGER`,
    `ALTER TABLE kiosk_banners ADD COLUMN IF NOT EXISTS "imageData" TEXT`,
    `ALTER TABLE kiosk_banners ADD COLUMN IF NOT EXISTS "titleFontSize" INTEGER DEFAULT 22`,
    `ALTER TABLE kiosk_banners ADD COLUMN IF NOT EXISTS "bodyFontSize" INTEGER DEFAULT 15`,
    `CREATE TABLE IF NOT EXISTS training_manuals (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      "manualDate" TEXT NOT NULL,
      description TEXT DEFAULT '',
      exercises TEXT NOT NULL DEFAULT '[]',
      "branchId" INTEGER,
      "createdBy" INTEGER NOT NULL,
      "createdAt" TEXT NOT NULL DEFAULT now()::text,
      "updatedAt" TEXT NOT NULL DEFAULT now()::text
    )`,
    `ALTER TABLE training_manuals ADD COLUMN IF NOT EXISTS description TEXT DEFAULT ''`,
    `ALTER TABLE leads ADD COLUMN IF NOT EXISTS "registeredMemberId" INTEGER`,
    `ALTER TABLE members ADD COLUMN IF NOT EXISTS "signatureDataUrl" TEXT`,
    `ALTER TABLE members ADD COLUMN IF NOT EXISTS "consultantId" INTEGER`,
    `ALTER TABLE pt_packages ADD COLUMN IF NOT EXISTS "serviceSessionPrice" INTEGER DEFAULT 0`,
    `ALTER TABLE pt_packages ADD COLUMN IF NOT EXISTS "serviceSamePrice" INTEGER DEFAULT 0`,
    `ALTER TABLE pt_event_programs ADD COLUMN IF NOT EXISTS "serviceSamePrice" INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE pt_event_programs ADD COLUMN IF NOT EXISTS "discountType" TEXT`,
    `ALTER TABLE pt_event_programs ADD COLUMN IF NOT EXISTS "discountValue" INTEGER DEFAULT 0`,
    `ALTER TABLE pt_event_programs ADD COLUMN IF NOT EXISTS "serviceHealthDays" INTEGER DEFAULT 0`,
    `ALTER TABLE pt_event_programs ADD COLUMN IF NOT EXISTS "freeUniform" INTEGER DEFAULT 0`,
    `ALTER TABLE pt_event_programs ADD COLUMN IF NOT EXISTS "freeLocker" INTEGER DEFAULT 0`,
    `ALTER TABLE pt_session_logs ADD COLUMN IF NOT EXISTS "isServiceSession" INTEGER DEFAULT 0`,
    `CREATE TABLE IF NOT EXISTS pt_event_programs (
      id SERIAL PRIMARY KEY,
      type TEXT NOT NULL DEFAULT 'PT',
      name TEXT NOT NULL,
      sessions INTEGER NOT NULL,
      "serviceSessions" INTEGER NOT NULL DEFAULT 0,
      "pricePerSession" INTEGER NOT NULL,
      "serviceSessionPrice" INTEGER NOT NULL DEFAULT 0,
      "isActive" INTEGER NOT NULL DEFAULT 1,
      "startDate" TEXT,
      "endDate" TEXT,
      "createdAt" TEXT NOT NULL DEFAULT NOW()::text
    )`,
    `ALTER TABLE pt_event_programs ADD COLUMN IF NOT EXISTS "startDate" TEXT`,
    `ALTER TABLE pt_event_programs ADD COLUMN IF NOT EXISTS "endDate" TEXT`,
    `ALTER TABLE pt_event_programs ADD COLUMN IF NOT EXISTS "applicableSessions" TEXT`,
    `CREATE TABLE IF NOT EXISTS uniforms (
      id SERIAL PRIMARY KEY,
      "branchId" INTEGER,
      "memberId" INTEGER,
      "memberName" TEXT,
      "memberPhone" TEXT,
      size TEXT,
      quantity INTEGER NOT NULL DEFAULT 1,
      "startDate" TEXT,
      "endDate" TEXT,
      memo TEXT,
      "isActive" INTEGER NOT NULL DEFAULT 1,
      "createdAt" TEXT NOT NULL DEFAULT now()::text,
      "updatedAt" TEXT NOT NULL DEFAULT now()::text
    )`,
    `ALTER TABLE uniforms ADD COLUMN IF NOT EXISTS "memberType" TEXT`,
    `ALTER TABLE uniforms ADD COLUMN IF NOT EXISTS "rentalType" TEXT`,
    `ALTER TABLE uniforms ADD COLUMN IF NOT EXISTS "isPaid" INTEGER DEFAULT 0`,
    `ALTER TABLE uniforms ADD COLUMN IF NOT EXISTS "paymentAmount" INTEGER DEFAULT 0`,
    `ALTER TABLE pt_packages ADD COLUMN IF NOT EXISTS "transferAmount" INTEGER`,
    `ALTER TABLE pt_packages ADD COLUMN IF NOT EXISTS "cardAmount" INTEGER`,
    `ALTER TABLE pt_packages ADD COLUMN IF NOT EXISTS "revenueEntryId" INTEGER`,
    `ALTER TABLE pt_packages ADD COLUMN IF NOT EXISTS "eventId" INTEGER`,
    `ALTER TABLE revenue_entries ADD COLUMN IF NOT EXISTS "eventId" INTEGER`,
    `ALTER TABLE revenue_entries ADD COLUMN IF NOT EXISTS "relatedEntryId" INTEGER`,
    `CREATE TABLE IF NOT EXISTS body_analysis_reservations (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      "birthDate" TEXT,
      gender TEXT,
      height TEXT,
      purpose TEXT,
      experience TEXT,
      concern TEXT,
      "privacyAgreed" INTEGER NOT NULL DEFAULT 0,
      "marketingAgreed" INTEGER NOT NULL DEFAULT 0,
      "marketingChannels" TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      note TEXT,
      "createdAt" TEXT NOT NULL DEFAULT now()::text
    )`,
  ];
  for (const stmt of alterStatements) {
    await pool.query(stmt);
  }

  // ─── 출입 관리 테이블 ──────────────────────────────────────────────────────────
  const accessTables = [
    `CREATE TABLE IF NOT EXISTS locker_categories (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      "branchId" INTEGER,
      color TEXT NOT NULL DEFAULT '#3b82f6',
      "sortOrder" INTEGER NOT NULL DEFAULT 0,
      "createdAt" TEXT NOT NULL DEFAULT now()::text
    )`,
    `CREATE TABLE IF NOT EXISTS lockers (
      id SERIAL PRIMARY KEY,
      "lockerNumber" TEXT NOT NULL,
      "branchId" INTEGER,
      "categoryId" INTEGER,
      "memberId" INTEGER,
      "memberName" TEXT,
      "memberPhone" TEXT,
      "lockerType" TEXT NOT NULL DEFAULT 'personal',
      "isOccupied" INTEGER NOT NULL DEFAULT 0,
      "startDate" TEXT,
      "endDate" TEXT,
      memo TEXT,
      "createdAt" TEXT NOT NULL DEFAULT now()::text,
      "updatedAt" TEXT NOT NULL DEFAULT now()::text
    )`,
    `ALTER TABLE lockers ADD COLUMN IF NOT EXISTS "categoryId" INTEGER`,
    `ALTER TABLE lockers ADD COLUMN IF NOT EXISTS "rentalType" TEXT`,
    // 앱 재등록 신청에 결제 정보를 담아 통합운영으로 전달 (자이언트짐++가 채워 보냄)
    `ALTER TABLE gym_plus_membership_renewals ADD COLUMN IF NOT EXISTS "requestedAmount" INTEGER`,
    `ALTER TABLE gym_plus_membership_renewals ADD COLUMN IF NOT EXISTS "requestedMonths" INTEGER`,
    `ALTER TABLE gym_plus_membership_renewals ADD COLUMN IF NOT EXISTS "paymentMethod" TEXT`,
    `ALTER TABLE gym_plus_membership_renewals ADD COLUMN IF NOT EXISTS "membershipType" TEXT`,
    `ALTER TABLE gym_plus_members ADD COLUMN IF NOT EXISTS "points" INTEGER DEFAULT 0`,
    `CREATE TABLE IF NOT EXISTS access_logs (
      id SERIAL PRIMARY KEY,
      "memberId" INTEGER,
      "memberName" TEXT,
      phone TEXT NOT NULL,
      "branchId" INTEGER,
      "accessResult" TEXT NOT NULL,
      "membershipType" TEXT,
      "membershipEnd" TEXT,
      "lockerNumber" TEXT,
      "accessedAt" TEXT NOT NULL DEFAULT now()::text
    )`,
    `CREATE TABLE IF NOT EXISTS kiosk_banners (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      body TEXT,
      "imageUrl" TEXT,
      "bgColor" TEXT NOT NULL DEFAULT '#1a3a6e',
      "textColor" TEXT NOT NULL DEFAULT '#ffffff',
      "isActive" INTEGER NOT NULL DEFAULT 1,
      "sortOrder" INTEGER NOT NULL DEFAULT 0,
      "startDate" TEXT,
      "endDate" TEXT,
      "createdAt" TEXT NOT NULL DEFAULT now()::text
    )`,
    `CREATE TABLE IF NOT EXISTS transfer_contracts (
      id SERIAL PRIMARY KEY,
      token TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'pending_transferor',
      "transferorMemberId" INTEGER NOT NULL,
      "transferorName" TEXT NOT NULL,
      "transferorPhone" TEXT,
      "transferorSignature" TEXT,
      "transferorSignedAt" TEXT,
      "transfereeMemberId" INTEGER,
      "transfereeName" TEXT,
      "transfereePhone" TEXT,
      "transfereeBirthDate" TEXT,
      "transfereeSignature" TEXT,
      "transfereeSignedAt" TEXT,
      "itemType" TEXT NOT NULL,
      "itemId" INTEGER,
      "itemDescription" TEXT NOT NULL,
      "termsSnapshot" TEXT,
      "createdAt" TEXT NOT NULL DEFAULT now()::text,
      "completedAt" TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS transfer_terms (
      id SERIAL PRIMARY KEY,
      content TEXT NOT NULL,
      "updatedAt" TEXT NOT NULL DEFAULT now()::text
    )`,
    `CREATE TABLE IF NOT EXISTS point_transactions (
      id SERIAL PRIMARY KEY,
      "memberId" INTEGER,
      "gymPlusMemberId" INTEGER,
      type TEXT NOT NULL,
      amount INTEGER NOT NULL,
      balance INTEGER NOT NULL DEFAULT 0,
      description TEXT,
      "referenceType" TEXT,
      "referenceId" INTEGER,
      "createdAt" TEXT NOT NULL DEFAULT now()::text
    )`,
    `CREATE TABLE IF NOT EXISTS point_membership_extensions (
      id SERIAL PRIMARY KEY,
      "gymPlusMemberId" INTEGER NOT NULL,
      "memberId" INTEGER,
      "customerName" TEXT,
      "requestId" INTEGER NOT NULL UNIQUE,
      "pointsUsed" INTEGER NOT NULL,
      "extensionDays" INTEGER NOT NULL,
      "previousEnd" TEXT,
      "newEnd" TEXT NOT NULL,
      "approvedBy" TEXT,
      "createdAt" TEXT NOT NULL DEFAULT now()::text
    )`,
    `CREATE TABLE IF NOT EXISTS gym_plus_membership_renewals (
      id SERIAL PRIMARY KEY,
      "gymPlusMemberId" INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      memo TEXT,
      "adminNote" TEXT,
      "requestedAt" TEXT NOT NULL,
      "processedAt" TEXT,
      "newMembershipEnd" TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS gym_plus_workout_favorites (
      id SERIAL PRIMARY KEY,
      "gymPlusMemberId" INTEGER NOT NULL,
      "contentType" TEXT NOT NULL DEFAULT 'exercise',
      "contentId" INTEGER,
      "contentName" TEXT,
      "createdAt" TEXT NOT NULL DEFAULT now()::text
    )`,
    `CREATE TABLE IF NOT EXISTS gym_plus_saved_meals (
      id SERIAL PRIMARY KEY,
      "gymPlusMemberId" INTEGER NOT NULL,
      "mealName" TEXT NOT NULL,
      "mealsJson" TEXT,
      "totalCalories" INTEGER,
      "createdAt" TEXT NOT NULL DEFAULT now()::text
    )`,
    `CREATE TABLE IF NOT EXISTS gym_plus_saved_videos (
      id SERIAL PRIMARY KEY,
      "gymPlusMemberId" INTEGER NOT NULL,
      "videoId" INTEGER NOT NULL,
      "createdAt" TEXT NOT NULL DEFAULT now()::text,
      UNIQUE("gymPlusMemberId", "videoId")
    )`,
  ];
  for (const stmt of accessTables) {
    await pool.query(stmt);
  }
  console.log("✅ 출입 관리 테이블 준비 완료");

  // ── 랜딩 페이지 테이블 ──────────────────────────────────────────────────────
  const landingTables = [
    `CREATE TABLE IF NOT EXISTS landing_inquiries (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      purpose TEXT,
      message TEXT,
      status TEXT DEFAULT 'new' NOT NULL,
      "createdAt" TEXT NOT NULL DEFAULT now()::text
    )`,
    `CREATE TABLE IF NOT EXISTS landing_events (
      id SERIAL PRIMARY KEY,
      icon TEXT NOT NULL DEFAULT '🎉',
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      "createdAt" TEXT NOT NULL DEFAULT now()::text
    )`,
    `CREATE TABLE IF NOT EXISTS landing_reviews (
      id SERIAL PRIMARY KEY,
      reviewer TEXT NOT NULL,
      rating INTEGER NOT NULL DEFAULT 5,
      content TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      "createdAt" TEXT NOT NULL DEFAULT now()::text
    )`,
    `CREATE TABLE IF NOT EXISTS landing_settings (
      id SERIAL PRIMARY KEY,
      key TEXT NOT NULL UNIQUE,
      value TEXT NOT NULL,
      "updatedAt" TEXT NOT NULL DEFAULT now()::text
    )`,
    `CREATE TABLE IF NOT EXISTS landing_page_stats (
      id SERIAL PRIMARY KEY,
      event TEXT NOT NULL,
      session_id TEXT,
      duration_sec INTEGER,
      "createdAt" TEXT NOT NULL DEFAULT now()::text
    )`,
  ];
  for (const stmt of landingTables) {
    await pool.query(stmt);
  }
  console.log("✅ 랜딩 페이지 테이블 준비 완료");

  // 컨설턴트 데이터 기록 테이블
  await pool.query(`
    CREATE TABLE IF NOT EXISTS consultant_records (
      id SERIAL PRIMARY KEY,
      year INTEGER NOT NULL,
      month INTEGER NOT NULL,
      "branchId" INTEGER,
      "createdBy" INTEGER,
      "blogPosts" INTEGER DEFAULT 0,
      "instagramPosts" INTEGER DEFAULT 0,
      "youtubeVideos" INTEGER DEFAULT 0,
      "offlineEvents" INTEGER DEFAULT 0,
      "referralCount" INTEGER DEFAULT 0,
      "snsFollowers" INTEGER,
      "adSpend" INTEGER DEFAULT 0,
      "churnCount" INTEGER DEFAULT 0,
      "churnReasons" TEXT,
      memo TEXT,
      "createdAt" TEXT NOT NULL DEFAULT now()::text,
      "updatedAt" TEXT NOT NULL DEFAULT now()::text,
      UNIQUE(year, month, "branchId", "createdBy")
    )
  `);
  console.log("✅ 컨설턴트 기록 테이블 준비 완료");

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
      e => e.customerName && e.subType !== "이전"
    );

    for (const entry of toFix) {
      const now = new Date().toISOString();
      const [newMember] = await db.insert(members).values({
        trainerId: entry.trainerId ?? undefined,
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

  // ── 헬스 매출 중 memberId 없는 항목을 기존 회원과 자동 연결 (backfill) ──────
  try {
    const unlinkedHealth = await pool.query<{
      id: number; customerName: string | null; phone: string | null;
    }>(
      `SELECT id, "customerName", phone FROM revenue_entries
       WHERE type = '헬스' AND "memberId" IS NULL AND "customerName" IS NOT NULL`
    );
    for (const entry of unlinkedHealth.rows) {
      if (!entry.customerName) continue;
      const { rows: matched } = await pool.query<{ id: number }>(
        `SELECT id FROM members
         WHERE name = $1
           AND ($2::text IS NULL OR phone = $2 OR phone IS NULL OR $2 = '')
         ORDER BY "membershipEnd" DESC NULLS LAST
         LIMIT 1`,
        [entry.customerName, entry.phone || null]
      );
      if (matched[0]) {
        await pool.query(
          `UPDATE revenue_entries SET "memberId" = $1 WHERE id = $2`,
          [matched[0].id, entry.id]
        );
        console.log(`✅ 헬스 매출 id=${entry.id} → 회원 id=${matched[0].id} (${entry.customerName}) 자동 연결`);
      }
    }
  } catch (e) {
    console.error("헬스 매출 회원 자동 연결 오류:", e);
  }

  // ── 헬스 매출 중 customerName이 NULL인 항목 → 연결된 회원 이름으로 보정 ───
  try {
    const fixed = await pool.query(
      `UPDATE revenue_entries r
       SET "customerName" = m.name
       FROM members m
       WHERE r."memberId" = m.id
         AND r.type = '헬스'
         AND r."customerName" IS NULL
       RETURNING r.id, m.name`
    );
    if (fixed.rowCount && fixed.rowCount > 0) {
      console.log(`✅ 헬스 매출 customerName 보정 ${fixed.rowCount}건:`, fixed.rows.map((r: any) => `id=${r.id}(${r.name})`).join(", "));
    }
  } catch (e) {
    console.error("헬스 매출 customerName 보정 오류:", e);
  }

  // ── 헬스 매출 중 다른 회원(중복)에 연결된 항목 → 올바른 회원으로 재연결 ──
  try {
    // customerName이 있으나, memberId가 가리키는 회원 이름과 다른 경우 재연결
    const mismatchedHealth = await pool.query<{
      id: number; customerName: string; memberId: number; phone: string | null;
    }>(
      `SELECT r.id, r."customerName", r."memberId", r.phone
       FROM revenue_entries r
       JOIN members m ON m.id = r."memberId"
       WHERE r.type = '헬스'
         AND r."customerName" IS NOT NULL
         AND TRIM(r."customerName") != TRIM(m.name)`
    );
    for (const entry of mismatchedHealth.rows) {
      const { rows: matched } = await pool.query<{ id: number }>(
        `SELECT id FROM members
         WHERE TRIM(name) = TRIM($1)
         ORDER BY "membershipEnd" DESC NULLS LAST, id ASC
         LIMIT 1`,
        [entry.customerName]
      );
      if (matched[0] && matched[0].id !== entry.memberId) {
        await pool.query(
          `UPDATE revenue_entries SET "memberId" = $1 WHERE id = $2`,
          [matched[0].id, entry.id]
        );
        console.log(`✅ 헬스 매출 id=${entry.id} 재연결 → 회원 id=${matched[0].id} (${entry.customerName})`);
      }
    }
  } catch (e) {
    console.error("헬스 매출 잘못 연결된 항목 재연결 오류:", e);
  }

  // ── PT 회원에게 잘못 붙은 "헬스 이전 0원" 팬텀 정리 ──────────────────────────
  // PT 패키지나 PT 매출이 있는 회원은 헬스 회원이 아니므로 자동 생성된 헬스 이전을 제거
  try {
    const cleaned = await pool.query(
      `DELETE FROM revenue_entries
       WHERE type = '헬스' AND "subType" = '이전' AND amount = 0
         AND "memberId" IS NOT NULL
         AND ("memberId" IN (SELECT DISTINCT "memberId" FROM pt_packages WHERE "memberId" IS NOT NULL)
              OR "memberId" IN (SELECT DISTINCT "memberId" FROM revenue_entries WHERE type = 'PT' AND "memberId" IS NOT NULL))`
    );
    if ((cleaned.rowCount ?? 0) > 0) console.log(`🧹 PT 회원 헬스 이전 팬텀 정리: ${cleaned.rowCount}건`);
  } catch (e) {
    console.error("헬스 이전 팬텀 정리 오류:", e);
  }

  // ── membershipEnd 있으나 헬스 매출 기록 없는 회원 → 이전 기록 자동 생성 ────
  try {
    const membersWithHealth = await pool.query<{
      id: number; name: string; phone: string | null;
      membershipStart: string | null; membershipEnd: string | null;
    }>(
      // 매출 기록이 아예 없고, PT 패키지도 없는 회원만 = 순수 레거시 헬스 임포트
      // (PT 신규 회원은 PT 횟수로 membershipEnd가 채워지므로 헬스 이전을 만들면 안 됨)
      `SELECT id, name, phone, "membershipStart", "membershipEnd"
       FROM members
       WHERE "membershipEnd" IS NOT NULL
         AND "membershipStart" IS NOT NULL
         AND id NOT IN (
           SELECT DISTINCT "memberId" FROM revenue_entries WHERE "memberId" IS NOT NULL
         )
         AND id NOT IN (
           SELECT DISTINCT "memberId" FROM pt_packages WHERE "memberId" IS NOT NULL
         )`
    );
    for (const m of membersWithHealth.rows) {
      if (!m.membershipStart || !m.membershipEnd) continue;
      const start = new Date(m.membershipStart);
      const end = new Date(m.membershipEnd);
      // 정수 개월 계산
      const months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
      if (months <= 0) continue;
      // 기본 개월 종료일
      const baseEnd = new Date(start);
      baseEnd.setMonth(baseEnd.getMonth() + months);
      // 서비스 일수 = 실제 종료 - 기본 종료
      const serviceDays = Math.round((end.getTime() - baseEnd.getTime()) / 86400000);
      const serviceItems = serviceDays > 0 ? `헬스(${serviceDays}일)` : undefined;
      const today = new Date().toISOString().substring(0, 10);
      await pool.query(
        `INSERT INTO revenue_entries
           ("memberId", "customerName", phone, type, "subType", amount, "discountAmount",
            "paidAmount", "unpaidAmount", "refundAmount", "paymentDate", "startDate",
            duration, "serviceItems", "programDetail", "createdAt", "updatedAt")
         VALUES ($1,$2,$3,'헬스','이전',0,0,0,0,0,$4,$5,$6,$7,$8,now()::text,now()::text)`,
        [m.id, m.name, m.phone || null, today, m.membershipStart,
         months, serviceItems || null, `헬스 ${months}개월`]
      );
      console.log(`✅ 헬스 이전 기록 생성: ${m.name} (id=${m.id}) ${months}개월${serviceDays > 0 ? ` +서비스 ${serviceDays}일` : ""}`);
    }
  } catch (e) {
    console.error("헬스 이전 기록 자동 생성 오류:", e);
  }

  // ── 완전 동일한 중복 매출 정리 (모든 유형) ───────────────────────────────────
  // 저장 버튼 더블클릭 등으로 같은 회원·유형·프로그램·서비스·결제일·금액이 완전히
  // 동일한 매출이 2건 이상 들어간 경우, 가장 먼저 만들어진 1건만 남기고 삭제.
  // 환불은 동일값이 정상적으로 여러 건일 수 있으므로 제외.
  try {
    const dup = await pool.query(`
      DELETE FROM revenue_entries
      WHERE "memberId" IS NOT NULL
        AND COALESCE("subType",'') <> '환불'
        AND id NOT IN (
          SELECT MIN(id) FROM revenue_entries
          WHERE "memberId" IS NOT NULL
            AND COALESCE("subType",'') <> '환불'
          GROUP BY "memberId", type, COALESCE("subType",''), COALESCE("programDetail",''),
                   COALESCE(sessions,0), COALESCE("serviceItems",''),
                   COALESCE("paymentDate",''), COALESCE("startDate",''), COALESCE(duration,0),
                   COALESCE(amount,0), COALESCE("paidAmount",0),
                   COALESCE("unpaidAmount",0), COALESCE("discountAmount",0)
        )
    `);
    if ((dup.rowCount ?? 0) > 0) console.log(`🧹 중복 매출 정리: ${dup.rowCount}건`);
  } catch (e) {
    console.error("중복 매출 정리 오류:", e);
  }

  // ── 빈 "기타" 매출(항목명 없이 헬스/PT 금액이 복제된 유령) 정리 ────────────────
  // 같은 회원·결제일·금액으로 헬스/PT 매출이 별도로 존재하는데, 항목명 없는 기타가
  // 그 금액을 그대로 복제해 잡힌 경우 → 서비스 항목이 있으면 금액만 0으로, 없으면 삭제.
  try {
    // 1) 서비스 항목(운동복/락커)이 있는 복제 기타 → 배지는 유지하고 금액만 0
    const zeroed = await pool.query(`
      UPDATE revenue_entries g
      SET amount = 0, "paidAmount" = 0, "unpaidAmount" = 0, "updatedAt" = now()::text
      WHERE g.type = '기타'
        AND COALESCE(g."programDetail",'') = ''
        AND COALESCE(g.amount,0) > 0
        AND COALESCE(g."serviceItems",'') <> ''
        AND EXISTS (
          SELECT 1 FROM revenue_entries r
          WHERE r.id <> g.id AND r."memberId" = g."memberId"
            AND r.type IN ('헬스','PT')
            AND COALESCE(r."paymentDate",'') = COALESCE(g."paymentDate",'')
            AND COALESCE(r.amount,0) = COALESCE(g.amount,0)
        )
    `);
    // 2) 서비스 항목도 없는 순수 유령 기타 → 삭제
    const deleted = await pool.query(`
      DELETE FROM revenue_entries g
      WHERE g.type = '기타'
        AND COALESCE(g."programDetail",'') = ''
        AND COALESCE(g.amount,0) > 0
        AND COALESCE(g."serviceItems",'') = ''
        AND EXISTS (
          SELECT 1 FROM revenue_entries r
          WHERE r.id <> g.id AND r."memberId" = g."memberId"
            AND r.type IN ('헬스','PT')
            AND COALESCE(r."paymentDate",'') = COALESCE(g."paymentDate",'')
            AND COALESCE(r.amount,0) = COALESCE(g.amount,0)
        )
    `);
    const n = (zeroed.rowCount ?? 0) + (deleted.rowCount ?? 0);
    if (n > 0) console.log(`🧹 빈 기타 복제 매출 정리: 0원화 ${zeroed.rowCount ?? 0}건 / 삭제 ${deleted.rowCount ?? 0}건`);
  } catch (e) {
    console.error("빈 기타 복제 매출 정리 오류:", e);
  }

  // ── 삭제된 매출을 가리키던(고아) usedSessions=0 패키지 정리 ───────────────────
  try {
    await pool.query(`
      DELETE FROM pt_packages p
      WHERE p."usedSessions" = 0
        AND p."revenueEntryId" IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM revenue_entries r WHERE r.id = p."revenueEntryId")
    `);
  } catch (e) {
    console.error("고아 PT 패키지 정리 오류:", e);
  }

  // ── 오등록으로 삭제된 회원("한라희")의 잔여 매출 정리 ──────────────────────
  // 과거 회원 삭제(members.delete)가 revenue_entries는 지우지 않아, 삭제된 회원의 매출이
  // 고아로 남아 매출 목록·합계에 계속 잡히는 사고가 있었다(지금은 delete가 매출도 함께 지움).
  // 이미 삭제된 회원 건은 남아있으므로 이름으로 특정해 1회성 정리. memberId가 실제 존재하는
  // (동명이인) 회원을 가리키는 매출은 절대 건드리지 않는다 — "한다희"는 실존 회원이라 대상에서 제외.
  try {
    const cleaned = await pool.query(`
      DELETE FROM revenue_entries
      WHERE "customerName" = '한라희'
        AND "memberId" IS NOT NULL
        AND "memberId" NOT IN (SELECT id FROM members)
    `);
    if ((cleaned.rowCount ?? 0) > 0) console.log(`🧹 삭제된 회원(한라희) 고아 매출 정리: ${cleaned.rowCount}건`);
  } catch (e) {
    console.error("삭제된 회원 고아 매출 정리 오류:", e);
  }

  // ── 삭제된 회원에게 배정된 채 남은 락커/운동복 정리 ──────────────────────────
  // 과거 회원 삭제가 락커·운동복을 정리하지 않아(지금은 delete가 함께 해제/반납 처리),
  // 존재하지 않는 memberId를 가리키는 배정이 남아 락커 현황·운동복 목록에 유령으로 잡혔다.
  // memberId가 실제 회원 테이블에 없는 배정만 대상으로 하므로 실회원 데이터는 건드리지 않는다.
  try {
    const freedLockers = await pool.query(`
      UPDATE lockers
      SET "memberId" = NULL, "memberName" = NULL, "memberPhone" = NULL,
          "isOccupied" = 0, "startDate" = NULL, "endDate" = NULL, "rentalType" = NULL,
          "updatedAt" = now()::text
      WHERE "memberId" IS NOT NULL
        AND "memberId" NOT IN (SELECT id FROM members)
    `);
    const returnedUniforms = await pool.query(`
      UPDATE uniforms
      SET "isActive" = 0, "updatedAt" = now()::text
      WHERE "isActive" = 1
        AND "memberId" IS NOT NULL
        AND "memberId" NOT IN (SELECT id FROM members)
    `);
    const n = (freedLockers.rowCount ?? 0) + (returnedUniforms.rowCount ?? 0);
    if (n > 0) console.log(`🧹 삭제된 회원 잔여 배정 정리: 락커 해제 ${freedLockers.rowCount ?? 0}건 / 운동복 반납 ${returnedUniforms.rowCount ?? 0}건`);
  } catch (e) {
    console.error("삭제된 회원 잔여 락커/운동복 정리 오류:", e);
  }

  // ── 미수금 수납했는데 원본 매출에 반영 안 된 건 보정 ────────────────────────
  // 미수금 수납(collectUnpaidPayment)이 예전엔 pt_packages.revenueEntryId 링크로만 원본
  // 매출을 찾았는데, gym.register로 만들어진 패키지는 이 링크가 비어 있다. 그래서 패키지
  // 미수금은 줄었는데 매출 미수금은 그대로 남아, 미수금 목록/KPI에 계속 잡히는 사고가
  // 있었다(안종현 사례). 지금은 링크가 없어도 회원 기준으로 찾아 처리한다.
  // 아래는 이미 어긋난 기존 데이터 보정: "수납 기록(subType='미수금')이 실제로 존재하는
  // 회원"에 한해, 매출 미수금을 패키지 미수금까지 낮춘다. 수납 증거가 있는 건만 대상이라
  // 아직 안 받은 미수금을 임의로 지울 위험이 없다.
  try {
    // (1) 패키지↔매출 연결고리가 있는 건 — 가장 확실한 대응이라 이걸 우선한다.
    //     startDate 일치를 조건으로 걸면 안 된다: 매출 쪽 startDate가 비어 있는 경우가 많아
    //     실제 대상(안종현: 매출 startDate=NULL vs 패키지 2026-06-02)이 통째로 걸러진다.
    const fixedLinked = await pool.query(`
      UPDATE revenue_entries r
      SET "unpaidAmount" = p."unpaidAmount", "updatedAt" = now()::text
      FROM pt_packages p
      WHERE p."revenueEntryId" = r.id
        AND COALESCE(r."subType",'') <> '미수금'
        AND COALESCE(r."unpaidAmount",0) > COALESCE(p."unpaidAmount",0)
        AND EXISTS (
          SELECT 1 FROM revenue_entries c
          WHERE c."memberId" = r."memberId" AND c."subType" = '미수금'
        )
    `);
    // (2) 연결고리가 없는 패키지는 시작일·세션수가 모두 맞을 때만 보정한다(오매칭 방지).
    const fixedUnlinked = await pool.query(`
      UPDATE revenue_entries r
      SET "unpaidAmount" = p."unpaidAmount", "updatedAt" = now()::text
      FROM pt_packages p
      WHERE p."revenueEntryId" IS NULL
        AND r."memberId" = p."memberId"
        AND r.type = 'PT'
        AND COALESCE(r."subType",'') <> '미수금'
        AND COALESCE(r."unpaidAmount",0) > COALESCE(p."unpaidAmount",0)
        AND r."startDate" = p."startDate"
        AND r.sessions = p."totalSessions" - COALESCE(p."serviceSessions", 0)
        AND EXISTS (
          SELECT 1 FROM revenue_entries c
          WHERE c."memberId" = r."memberId" AND c."subType" = '미수금'
        )
    `);
    const n = (fixedLinked.rowCount ?? 0) + (fixedUnlinked.rowCount ?? 0);
    if (n > 0) console.log(`💵 수납 반영 누락 미수금 보정: ${n}건`);

    // relatedEntryId 도입 전에 만들어진 미수금 수납 행을 원본 등록 행에 연결한다.
    // 연결이 없으면 "회원 단위"로 대충 합산할 수밖에 없어, 같은 회원에게 등록 건이 여러 개면
    // 장부 검증·등록관리 표시가 부정확해진다. 미납분(정가-할인-실결제)이 수납액과 정확히
    // 일치하는 행만 연결하므로 오연결 위험이 없다.
    const linkedBack = await pool.query(`
      UPDATE revenue_entries c
      SET "relatedEntryId" = r.id
      FROM revenue_entries r
      WHERE c."subType" = '미수금'
        AND c."relatedEntryId" IS NULL
        AND r.id <> c.id
        AND r."memberId" = c."memberId"
        AND COALESCE(r."subType",'') NOT IN ('미수금','환불','이전')
        AND (COALESCE(r.amount,0) - COALESCE(r."discountAmount",0) - COALESCE(r."paidAmount",0))
            = COALESCE(c."paidAmount",0)
    `);
    if ((linkedBack.rowCount ?? 0) > 0) console.log(`🔗 미수금 수납 ↔ 원본 등록 연결: ${linkedBack.rowCount}건`);
  } catch (e) {
    console.error("미수금 수납 반영 보정 오류:", e);
  }

  // ── PT 매출이 있으나 ptPackages 없는 회원에 패키지 자동 생성 ──────────────
  // revenueEntryId로 1:1 연결하여 서버 재시작 시 중복 생성 완전 방지
  try {
    // 1) 기존 패키지에 revenueEntryId 연결 (기존 데이터 마이그레이션)
    await pool.query(`
      UPDATE pt_packages p
      SET "revenueEntryId" = r.id
      FROM revenue_entries r
      WHERE p."revenueEntryId" IS NULL
        AND r.type = 'PT'
        AND r."memberId" = p."memberId"
        AND r."paymentDate" IS NOT NULL
        AND p."paymentDate" IS NOT NULL
        AND r."paymentDate" = p."paymentDate"
        AND r."sessions" IS NOT NULL
        AND r."sessions" = (p."totalSessions" - COALESCE(p."serviceSessions", 0))
    `);

    // 2) revenueEntryId가 없는 패키지는 subType '이전' 제외 PT 매출로 연결 시도 (이름+날짜 기준)
    await pool.query(`
      UPDATE pt_packages p
      SET "revenueEntryId" = r.id
      FROM revenue_entries r
      WHERE p."revenueEntryId" IS NULL
        AND r.type = 'PT'
        AND r."memberId" = p."memberId"
        AND r."subType" IS DISTINCT FROM '이전'
      AND r.id = (
        SELECT id FROM revenue_entries r2
        WHERE r2.type = 'PT' AND r2."memberId" = p."memberId"
          AND r2."subType" IS DISTINCT FROM '이전'
        ORDER BY ABS(EXTRACT(EPOCH FROM (
          (COALESCE(r2."paymentDate", r2."createdAt"))::timestamp
          - (COALESCE(p."paymentDate", p."createdAt"))::timestamp
        )))
        LIMIT 1
      )
    `);

    // 3) 아직도 revenueEntryId 없는 revenue_entries → 새 패키지 생성
    const ptRevs = await db
      .select()
      .from(revenueEntries)
      .where(and(
        eq(revenueEntries.type, "PT"),
        sql`${revenueEntries.memberId} IS NOT NULL`,
        sql`${revenueEntries.sessions} IS NOT NULL`,
        sql`${revenueEntries.subType} IS DISTINCT FROM '이전'`,
      ));

    let created = 0;
    for (const rev of ptRevs) {
      if (!rev.memberId) continue;
      // revenueEntryId로 중복 체크 (NULL-safe)
      const linked = await pool.query<{ count: string }>(
        `SELECT COUNT(*) as count FROM pt_packages WHERE "revenueEntryId" = $1`,
        [rev.id]
      );
      if (parseInt(linked.rows[0]?.count ?? "0", 10) > 0) continue;

      const now = new Date().toISOString();
      const svcSessions = (rev as any).serviceSessions ?? 0;

      // 같은 회원에게 세션 수·시작일이 비슷한 패키지가 이미 있으면 건너뜀 (복제 방지).
      const dupMatch = await pool.query(
        `SELECT 1 FROM pt_packages
         WHERE "memberId" = $1
           AND (
             "totalSessions" = $2
             OR "totalSessions" = $3
           )
           AND (
             "startDate" IS NOT DISTINCT FROM $4
             OR "paymentDate" IS NOT DISTINCT FROM $5
           )
         LIMIT 1`,
        [
          rev.memberId,
          (rev.sessions ?? 0) + svcSessions,
          rev.sessions ?? 0,
          rev.startDate ?? rev.paymentDate ?? null,
          rev.paymentDate ?? null,
        ]
      );
      if (dupMatch.rows.length > 0) {
        await pool.query(
          `UPDATE pt_packages SET "revenueEntryId" = $1
           WHERE id = (
             SELECT id FROM pt_packages
             WHERE "memberId" = $2 AND "revenueEntryId" IS NULL
               AND ("totalSessions" = $3 OR "totalSessions" = $4)
               AND ("startDate" IS NOT DISTINCT FROM $5 OR "paymentDate" IS NOT DISTINCT FROM $6)
             LIMIT 1
           )`,
          [rev.id, rev.memberId, (rev.sessions ?? 0) + svcSessions, rev.sessions ?? 0,
           rev.startDate ?? rev.paymentDate ?? null, rev.paymentDate ?? null]
        );
        continue;
      }
      await pool.query(`
        INSERT INTO pt_packages
          ("memberId","trainerId","totalSessions","serviceSessions","usedSessions",
           "packageName","startDate",status,price,"paymentAmount","unpaidAmount",
           "paymentMethod","paymentDate","revenueEntryId","createdAt","updatedAt")
        VALUES ($1,$2,$3,$4,0,$5,$6,'active',$7,$8,$9,$10,$11,$12,$13,$13)
      `, [
        rev.memberId, rev.trainerId ?? null,
        (rev.sessions ?? 0) + svcSessions, svcSessions,
        rev.programDetail ?? null,
        rev.startDate ?? rev.paymentDate,
        rev.amount, rev.paidAmount, rev.unpaidAmount,
        rev.paymentMethod ?? null, rev.paymentDate,
        rev.id, now,
      ]);
      created++;
    }
    if (created > 0) console.log(`✅ PT 매출 기반 패키지 자동 생성: ${created}건`);
  } catch (e) {
    console.error("PT 패키지 자동 생성 오류:", e);
  }

  // ── 백필이 만든 "결제일자 없는 빈 복제본" PT 패키지 제거 ──────────────────────
  // 조건: usedSessions=0 이고 결제일자가 없는데, 같은 회원·프로그램·횟수·금액으로
  //       결제일자가 "있는" 원본 패키지가 별도로 존재하는 경우 → 복제본만 삭제.
  //       (정상적인 두 건(둘 다 결제일자 있음)은 절대 건드리지 않음)
  try {
    const cleaned = await pool.query(`
      DELETE FROM pt_packages p
      WHERE p."usedSessions" = 0
        AND p."paymentDate" IS NULL
        AND EXISTS (
          SELECT 1 FROM pt_packages q
          WHERE q.id <> p.id
            AND q."memberId" = p."memberId"
            AND COALESCE(q."packageName",'') = COALESCE(p."packageName",'')
            AND q."totalSessions" = p."totalSessions"
            AND COALESCE(q."paymentAmount",0) = COALESCE(p."paymentAmount",0)
            AND q."paymentDate" IS NOT NULL
        )
    `);
    if ((cleaned.rowCount ?? 0) > 0) console.log(`🧹 빈 복제 PT 패키지 정리: ${cleaned.rowCount}건`);
  } catch (e) {
    console.error("빈 복제 PT 패키지 정리 오류:", e);
  }

  // ── 완료된 패키지가 있는데 같은 내용의 active 0회 사용 복제본 제거 ────────────
  // PT 완료 후 서버 재시작 시 매출 기반으로 새 패키지가 생기는 사고 방지.
  // 같은 회원·같은 세션수·같은 시작일로 completed 패키지가 있으면 active 0회 사용본 삭제.
  try {
    const dupActive = await pool.query(`
      DELETE FROM pt_packages p
      WHERE p.status = 'active'
        AND p."usedSessions" = 0
        AND EXISTS (
          SELECT 1 FROM pt_packages q
          WHERE q.id <> p.id
            AND q."memberId" = p."memberId"
            AND q."totalSessions" = p."totalSessions"
            AND q.status IN ('completed','refunded')
            AND COALESCE(q."startDate",'') = COALESCE(p."startDate",'')
        )
    `);
    if ((dupActive.rowCount ?? 0) > 0) console.log(`🧹 완료 패키지 복제본 정리: ${dupActive.rowCount}건`);
  } catch (e) {
    console.error("완료 패키지 복제본 정리 오류:", e);
  }

  // ── 담당 트레이너 변경이 안 따라간 진행 중 PT 패키지 보정 ────────────────────
  // members.trainerId(회원 카드에 보이는 담당 트레이너)와 ptPackages.trainerId(PT 관리
  // 목록이 실제로 필터링하는 값)가 따로 저장돼 있어, 트레이너 재배정 시 과거 코드가 회원만
  // 옮기고 진행 중인 패키지는 안 옮기는 경우가 있었다. 그 결과 회원 카드·출석체크에는
  // 새 트레이너로 보이는데 PT 관리에는 안 뜨는 사고로 이어졌다(양희정 사례).
  // 완료/환불된 과거 패키지는 정산 소급 방지를 위해 건드리지 않는다.
  try {
    const trainerSynced = await pool.query(`
      UPDATE pt_packages p
      SET "trainerId" = m."trainerId", "updatedAt" = now()::text
      FROM members m
      WHERE p."memberId" = m.id
        AND p.status = 'active'
        AND m."trainerId" IS NOT NULL
        AND p."trainerId" IS DISTINCT FROM m."trainerId"
    `);
    if ((trainerSynced.rowCount ?? 0) > 0) console.log(`🔗 PT 패키지 담당 트레이너 동기화: ${trainerSynced.rowCount}건`);
  } catch (e) {
    console.error("PT 패키지 담당 트레이너 동기화 오류:", e);
  }

  // ── PT 세션 ↔ 패키지 연결/단가 보정 (정산 단가 0원 방지) ──────────────────────
  try {
    // 1) 단가 없는 패키지: 결제금액 ÷ 총세션수로 pricePerSession 채우기
    await pool.query(`
      UPDATE pt_packages
      SET "pricePerSession" = ROUND("paymentAmount"::numeric / "totalSessions")
      WHERE COALESCE("pricePerSession",0) = 0
        AND COALESCE("paymentAmount",0) > 0 AND COALESCE("totalSessions",0) > 0
    `);
    // 2) 결제금액 자체가 없는 패키지: 연결된 매출(revenueEntryId)에서 채우기.
    //    금액 기준은 "계약금액"(정가 − 할인)이다. 실수령액을 쓰면 미수금 있는 회원의 단가가
    //    폭락한다(강문영 사례) — 미수금은 unpaidAmount로 따로 관리하므로 여기서 빼면 안 된다.
    await pool.query(`
      UPDATE pt_packages p
      SET "paymentAmount" = GREATEST(0, COALESCE(r.amount,0) - COALESCE(r."discountAmount",0)),
          "pricePerSession" = CASE WHEN COALESCE(p."totalSessions",0) > 0
                                   THEN ROUND(GREATEST(0, COALESCE(r.amount,0) - COALESCE(r."discountAmount",0))::numeric / p."totalSessions")
                                   ELSE p."pricePerSession" END
      FROM revenue_entries r
      WHERE p."revenueEntryId" = r.id
        AND COALESCE(p."paymentAmount",0) = 0
        AND GREATEST(0, COALESCE(r.amount,0) - COALESCE(r."discountAmount",0)) > 0
    `);
    // 2-b) 매출(원본)과 결제금액이 어긋난 패키지 교정 (매출 수정 시 동기화가 과거에 실패했던 건).
    //   매출이 원본이므로 매출→패키지 방향으로만 맞춘다. 값이 다를 때만 갱신(멱등). 혼합결제는
    //   분할금액 기반 별도 단가 로직이 있으므로 건드리지 않는다.
    //   예: 200,000원으로 잘못 등록 후 장부만 2,000,000원으로 고쳤는데 패키지가 안 따라온 경우.
    const resynced = await pool.query(`
      UPDATE pt_packages p
      SET "paymentAmount" = GREATEST(0, COALESCE(r.amount,0) - COALESCE(r."discountAmount",0)),
          "unpaidAmount" = COALESCE(r."unpaidAmount", p."unpaidAmount"),
          "pricePerSession" = CASE
            WHEN p."paymentMethod" IN ('이체','계좌이체')
              THEN ROUND(GREATEST(0, COALESCE(r.amount,0) - COALESCE(r."discountAmount",0))::numeric / p."totalSessions")
            ELSE ROUND((GREATEST(0, COALESCE(r.amount,0) - COALESCE(r."discountAmount",0))::numeric / 1.1) / p."totalSessions")
          END,
          "updatedAt" = now()::text
      FROM revenue_entries r
      WHERE p."revenueEntryId" = r.id
        AND r.type = 'PT'
        AND COALESCE(p."totalSessions",0) > 0
        AND COALESCE(p."paymentMethod",'') <> '혼합'
        AND COALESCE(p."paymentAmount",0) <> GREATEST(0, COALESCE(r.amount,0) - COALESCE(r."discountAmount",0))
    `);
    if ((resynced.rowCount ?? 0) > 0) console.log(`💰 매출-패키지 결제금액 재동기화: ${resynced.rowCount}건`);

    // 2-b-2) 세션수가 명백히 다른 매출에 잘못 연결된 revenueEntryId 해제.
    // 과거 "패키지↔매출 연결" 백필이 회원별로 날짜가 가장 가까운 매출을 고르는 방식이라,
    // 패키지가 여러 개인 회원은 서로 다른 매출에 잘못 엇갈려 연결될 수 있었다(박종범 사례:
    // 케어피티 30회 패키지가 이벤트피티 3회 매출에 연결되어 결제금액이 뒤바뀜). 세션수가
    // 객관적으로 안 맞는 연결만 끊어서, 아래 2-c가 정확한 매출로 다시 이어붙이게 한다.
    const wrongLinks = await pool.query(`
      UPDATE pt_packages p
      SET "revenueEntryId" = NULL
      FROM revenue_entries r
      WHERE p."revenueEntryId" = r.id
        AND r.type = 'PT'
        AND r.sessions IS NOT NULL
        AND r.sessions <> (p."totalSessions" - COALESCE(p."serviceSessions", 0))
    `);
    if ((wrongLinks.rowCount ?? 0) > 0) console.log(`🔓 세션수 불일치 매출-패키지 오연결 해제: ${wrongLinks.rowCount}건`);

    // 2-c) revenueEntryId가 아예 안 걸린 패키지(gym.register 등록 경로로 생긴 패키지는 원래
    // revenueEntryId를 안 채움)도 memberId+시작일+세션수로 매출을 찾아 결제금액을 맞춘다.
    // (양희정 사례: 자동입력된 금액으로 한 번 저장 후 실제 금액으로 재등록했는데 패키지가
    // 예전 금액에 묶여 있던 것 — 이제 재등록 코드 자체는 고쳤고, 이건 기존 데이터 교정용)
    const resynced2 = await pool.query(`
      UPDATE pt_packages p
      SET "paymentAmount" = GREATEST(0, COALESCE(r.amount,0) - COALESCE(r."discountAmount",0)),
          "unpaidAmount" = COALESCE(r."unpaidAmount", p."unpaidAmount"),
          "pricePerSession" = CASE
            WHEN p."paymentMethod" IN ('이체','계좌이체')
              THEN ROUND(GREATEST(0, COALESCE(r.amount,0) - COALESCE(r."discountAmount",0))::numeric / p."totalSessions")
            ELSE ROUND((GREATEST(0, COALESCE(r.amount,0) - COALESCE(r."discountAmount",0))::numeric / 1.1) / p."totalSessions")
          END,
          "updatedAt" = now()::text
      FROM revenue_entries r
      WHERE p."revenueEntryId" IS NULL
        AND r.type = 'PT'
        AND r."memberId" = p."memberId"
        AND r."startDate" = p."startDate"
        AND r.sessions = p."totalSessions" - COALESCE(p."serviceSessions", 0)
        AND COALESCE(p."paymentMethod",'') <> '혼합'
        AND COALESCE(p."totalSessions",0) > 0
        AND COALESCE(p."paymentAmount",0) <> GREATEST(0, COALESCE(r.amount,0) - COALESCE(r."discountAmount",0))
        AND r.id = (
          SELECT r2.id FROM revenue_entries r2
          WHERE r2.type = 'PT' AND r2."memberId" = p."memberId" AND r2."startDate" = p."startDate"
            AND r2.sessions = p."totalSessions" - COALESCE(p."serviceSessions", 0)
          ORDER BY r2."paymentDate" DESC NULLS LAST, r2.id DESC
          LIMIT 1
        )
    `);
    if ((resynced2.rowCount ?? 0) > 0) console.log(`💰 매출-패키지 결제금액 재동기화(시작일·세션수 기준): ${resynced2.rowCount}건`);

    // 3) 세션의 packageId가 NULL/삭제됨/단가없음 → 회원의 "단가 있는 활성 패키지"로 재연결
    // "기타"는 실제 PT 프로그램이 아닌 1회성 부가항목이므로 다른 단가있는 패키지가 있으면 후순위로 둔다.
    const relinked = await pool.query(`
      UPDATE pt_session_logs s
      SET "packageId" = sub.pid
      FROM (
        SELECT DISTINCT ON (p."memberId") p."memberId" AS mid, p.id AS pid
        FROM pt_packages p
        WHERE COALESCE(p."pricePerSession",0) > 0 OR COALESCE(p."paymentAmount",0) > 0
        ORDER BY p."memberId", (p."packageName" IS DISTINCT FROM '기타') DESC, (p.status = 'active') DESC, p."createdAt" DESC
      ) sub
      WHERE s."memberId" = sub.mid
        AND (
          s."packageId" IS NULL
          OR s."packageId" NOT IN (SELECT id FROM pt_packages)
          OR s."packageId" IN (SELECT id FROM pt_packages
                               WHERE COALESCE("pricePerSession",0) = 0 AND COALESCE("paymentAmount",0) = 0)
        )
        AND s."packageId" IS DISTINCT FROM sub.pid
    `);
    if ((relinked.rowCount ?? 0) > 0) console.log(`🔗 PT 세션 패키지 재연결: ${relinked.rowCount}건`);

    // 4) 이미 "기타"(1회성 부가항목) 패키지로 잘못 연결되어 저단가로 정산되던 세션을
    // 같은 회원의 실제 PT 프로그램 패키지로 재연결 (기타 패키지가 활성 상태로 남아 있으면
    // 트레이닝 일지 기록 시 자동연결 로직이 계속 그 패키지를 골라 매번 사고가 재발했음)
    const relinkedFromOther = await pool.query(`
      UPDATE pt_session_logs s
      SET "packageId" = sub.pid
      FROM (
        SELECT DISTINCT ON (p."memberId") p."memberId" AS mid, p.id AS pid
        FROM pt_packages p
        WHERE (COALESCE(p."pricePerSession",0) > 0 OR COALESCE(p."paymentAmount",0) > 0)
          AND p."packageName" IS DISTINCT FROM '기타'
        ORDER BY p."memberId", (p.status = 'active') DESC, p."createdAt" DESC
      ) sub, pt_packages bad
      WHERE bad.id = s."packageId"
        AND bad."packageName" = '기타'
        AND s."memberId" = sub.mid
        AND s."packageId" IS DISTINCT FROM sub.pid
    `);
    if ((relinkedFromOther.rowCount ?? 0) > 0) console.log(`🔗 "기타" 오연결 PT 세션 재연결: ${relinkedFromOther.rowCount}건`);
  } catch (e) {
    console.error("PT 세션-패키지 연결 보정 오류:", e);
  }

  // ── 전체 회원 운동시작일/운동만료일 자동 보정 (전체 적용) ─────────────────
  try {
    const allMembers = await db
      .select({ id: members.id, membershipStart: members.membershipStart })
      .from(members);

    for (const m of allMembers) {
      // 1) 운동시작일: 첫 PT 세션 날짜로 설정 (없으면 유지)
      const firstSession = await db
        .select({ sessionDate: ptSessionLogs.sessionDate })
        .from(ptSessionLogs)
        .where(eq(ptSessionLogs.memberId, m.id))
        .orderBy(ptSessionLogs.sessionDate)
        .limit(1);

      const startDate = firstSession[0]?.sessionDate ?? m.membershipStart;
      if (firstSession[0]?.sessionDate && firstSession[0].sessionDate !== m.membershipStart) {
        await db.update(members).set({ membershipStart: firstSession[0].sessionDate }).where(eq(members.id, m.id));
      }

      // 2) 운동만료일: 운동시작일 + (활성 패키지 totalSessions ÷ 2)주 (10회=5주, 20회=10주...)
      //    - 활성 패키지만 합산(오래된/환불 패키지가 만료일을 부풀리지 않도록)
      //    - 기존 값보다 뒤 날짜일 때만 갱신(GREATEST) → 수동 연장/헬스 만료일을 앞으로 당기지 않음
      if (!startDate) continue;
      const pkgRows = await db
        .select({ totalSessions: ptPackages.totalSessions })
        .from(ptPackages)
        .where(and(eq(ptPackages.memberId, m.id), eq(ptPackages.status, "active")));

      const totalSessions = pkgRows.reduce((s, p) => s + (p.totalSessions ?? 0), 0);
      if (!totalSessions) continue;

      const weeks = Math.round(totalSessions / 2);
      const [yr, mo, dy] = startDate.split("-").map(Number);
      const d = new Date(yr, mo - 1, dy);
      d.setDate(d.getDate() + weeks * 7);
      const newEnd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      await pool.query(
        `UPDATE members SET "membershipEnd" = $1, "updatedAt" = now()::text
         WHERE id = $2 AND ("membershipEnd" IS NULL OR "membershipEnd" < $1)`,
        [newEnd, m.id]
      );
    }

    console.log("✅ 전체 회원 운동시작일/만료일 보정 완료");
  } catch (e) {
    console.warn("⚠️ 운동날짜 보정 실패:", e);
  }

  // ── 헬스 회원 만료일을 "최신 헬스권" 기준으로 보정 (키오스크 마감 오류 방지) ──
  // 새 헬스권 등록 후 members.membershipEnd가 옛 값에 머물러 마감으로 뜨는 문제 해결.
  // 기존 값보다 뒤 날짜일 때만 갱신(GREATEST)하여 수동 연장/PT 만료일을 앞으로 당기지 않음.
  try {
    const healthRows = await pool.query<{
      memberId: number; startDate: string | null; duration: number | null;
      programDetail: string | null; serviceItems: string | null;
    }>(
      `SELECT "memberId", "startDate", duration, "programDetail", "serviceItems"
       FROM revenue_entries
       WHERE type = '헬스' AND "memberId" IS NOT NULL AND "startDate" IS NOT NULL`
    );
    // memberId별 가장 최신(startDate 최대) 헬스 등록 엔트리
    const latest = new Map<number, typeof healthRows.rows[0]>();
    for (const r of healthRows.rows) {
      const prev = latest.get(r.memberId);
      if (!prev || (r.startDate! > prev.startDate!)) latest.set(r.memberId, r);
    }
    let fixed = 0;
    for (const [memberId, r] of latest) {
      let months = r.duration ?? 0;
      if (!months) {
        const m = /^헬스\s*(\d+)개월/.exec(r.programDetail ?? "");
        if (m) months = parseInt(m[1]);
      }
      if (!months) continue;
      const [yr, mo, dy] = r.startDate!.split("-").map(Number);
      const d = new Date(yr, mo - 1, dy);
      d.setMonth(d.getMonth() + months);
      if (r.serviceItems) {
        for (const part of r.serviceItems.split(",").map(s => s.trim())) {
          const moM = /^헬스\((\d+)개월\)$/.exec(part);
          if (moM) { d.setMonth(d.getMonth() + parseInt(moM[1])); continue; }
          const dyM = /^헬스\((\d+)일\)$/.exec(part);
          if (dyM) { d.setDate(d.getDate() + parseInt(dyM[1])); }
        }
      }
      const newEnd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      // 만료일: 기존 값보다 뒤 날짜일 때만 갱신
      const res = await pool.query(
        `UPDATE members SET "membershipEnd" = $1, "updatedAt" = now()::text
         WHERE id = $2 AND ("membershipEnd" IS NULL OR "membershipEnd" < $1)`,
        [newEnd, memberId]
      );
      fixed += res.rowCount ?? 0;
      // 시작일: 현재(최신) 헬스권 시작일로 앞당겨 갱신 → 카드가 누적기간이 아닌 현재 회원권 기간을 표시.
      // PT 회원의 운동시작일(첫 세션일 기준)을 덮지 않도록 PT 없는 회원만 적용.
      await pool.query(
        `UPDATE members SET "membershipStart" = $1, "updatedAt" = now()::text
         WHERE id = $2 AND ("membershipStart" IS NULL OR "membershipStart" < $1)
           AND id NOT IN (SELECT DISTINCT "memberId" FROM pt_packages WHERE "memberId" IS NOT NULL)`,
        [r.startDate, memberId]
      );
    }
    if (fixed > 0) console.log(`✅ 헬스 회원 만료일 최신화: ${fixed}건`);
  } catch (e) {
    console.warn("⚠️ 헬스 만료일 보정 실패:", e);
  }

  // ── PT 매출의 서비스 헬스 기간 → membershipEnd 보정 ───────────────────────
  // PT 등록 시 serviceItems에 헬스(N일/개월)이 포함된 경우 membershipEnd가 반영되지 않던 버그 수정.
  // 기존 값보다 뒤 날짜일 때만 갱신하여 안전.
  try {
    const ptHealthRows = await pool.query<{
      memberId: number; startDate: string; serviceItems: string;
    }>(
      `SELECT "memberId", "startDate", "serviceItems"
       FROM revenue_entries
       WHERE type = 'PT' AND "memberId" IS NOT NULL AND "startDate" IS NOT NULL
         AND "serviceItems" LIKE '%헬스%'`
    );
    let ptFixed = 0;
    for (const r of ptHealthRows.rows) {
      const [yr, mo, dy] = r.startDate.split("-").map(Number);
      const d = new Date(yr, mo - 1, dy);
      let hasHealth = false;
      for (const part of r.serviceItems.split(",").map((s: string) => s.trim())) {
        const moM = /^헬스\((\d+)개월\)$/.exec(part);
        if (moM) { d.setMonth(d.getMonth() + parseInt(moM[1])); hasHealth = true; continue; }
        const dyM = /^헬스\((\d+)일\)$/.exec(part);
        if (dyM) { d.setDate(d.getDate() + parseInt(dyM[1])); hasHealth = true; }
      }
      if (!hasHealth) continue;
      const newEnd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const res = await pool.query(
        `UPDATE members SET "membershipEnd" = $1, "updatedAt" = now()::text
         WHERE id = $2 AND ("membershipEnd" IS NULL OR "membershipEnd" < $1)`,
        [newEnd, r.memberId]
      );
      ptFixed += res.rowCount ?? 0;
    }
    if (ptFixed > 0) console.log(`✅ PT 서비스 헬스 만료일 보정: ${ptFixed}건`);
  } catch (e) {
    console.warn("⚠️ PT 서비스 헬스 만료일 보정 실패:", e);
  }

  // ── 서비스세션 패키지 totalSessions 이중계산 보정 ────────────────────────
  // 2026-08-13 이전 버그: totalSessions = sessionCount + svcSessions 로 2배 기록.
  // 이후 기존 마이그레이션이 serviceSessions = totalSessions 으로 맞춰 둘 다 2배.
  // 조건: 서비스세션 패키지, 둘 다 같고, 짝수이며, 2 초과, 미사용, 버그 기간 생성분만.
  try {
    const svcFixRes = await pool.query(
      `UPDATE pt_packages
       SET "totalSessions" = "totalSessions" / 2,
           "serviceSessions" = "serviceSessions" / 2,
           "updatedAt" = now()::text
       WHERE "packageName" = '서비스세션'
         AND "totalSessions" = "serviceSessions"
         AND "totalSessions" % 2 = 0
         AND "totalSessions" > 2
         AND "usedSessions" = 0
         AND "createdAt"::timestamp < '2026-08-14 00:00:00'`
    );
    if ((svcFixRes.rowCount ?? 0) > 0)
      console.log(`✅ 서비스세션 totalSessions 이중계산 보정: ${svcFixRes.rowCount}건`);
  } catch (e) {
    console.warn("⚠️ 서비스세션 totalSessions 보정 실패:", e);
  }

  // ── (비활성화) PT 없는 회원 담당 트레이너 자동 해제 ─────────────────────────
  // 매 재시작마다 실행되어, PT 패키지가 아직 없는 회원에게 "일부러" 배정한 담당
  // 트레이너까지 지워버리는 문제가 있었다(서나연→김나연 배정이 사라짐).
  // 상담 담당자→트레이너 오지정의 근본 원인은 이미 등록 흐름에서 막았으므로,
  // 이 자동 해제는 끈다. 잘못 배정된 기존 건은 회원 관리에서 수동으로 해제한다.
  // (다시 켜려면 아래 false를 true로)
  if (false as boolean) {
    try {
      await pool.query(`
        UPDATE members SET "trainerId" = NULL, "updatedAt" = now()::text
        WHERE "trainerId" IS NOT NULL
          AND id NOT IN (SELECT DISTINCT "memberId" FROM pt_packages WHERE "memberId" IS NOT NULL)
          AND id NOT IN (SELECT DISTINCT "memberId" FROM revenue_entries WHERE type = 'PT' AND "memberId" IS NOT NULL)
      `);
    } catch (e) {
      console.error("담당 트레이너 오지정 정리 오류:", e);
    }
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
      { name: "전화예약", type: "offline", description: "전화 예약 문의" },
      { name: "기타", type: "offline", description: "기타 채널" },
    ]);
    console.log("✅ 기본 채널 데이터 생성 완료");
  } else {
    // 전화예약 채널이 없으면 추가
    const phoneChannel = await db.select({ id: channels.id }).from(channels).where(eq(channels.name, "전화예약")).limit(1);
    if (!phoneChannel[0]) {
      await db.insert(channels).values({ name: "전화예약", type: "offline", description: "전화 예약 문의" });
      console.log("✅ 전화예약 채널 추가 완료");
    }
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

  // (제거됨) PT 패키지 → revenue_entries 금액 자동 동기화
  // 이 startup 작업은 패키지 금액을 매출 항목에 강제로 덮어써서,
  // 사용자가 장부에서 수정한 금액을 서버 재시작마다 되돌리는 버그를 일으켰다.
  // 매출↔패키지 동기화는 매출 수정 시(gym.revenue.update)에만 수행한다.

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


  // ── 서비스세션 패키지 교정: serviceSessions가 0인 "서비스세션" 패키지 + 세션 로그 isServiceSession 보정 ──
  try {
    const fixedPkgs = await pool.query(`
      UPDATE pt_packages SET "serviceSessions" = "totalSessions"
      WHERE "packageName" = '서비스세션' AND COALESCE("serviceSessions", 0) < "totalSessions"
      RETURNING id, "totalSessions"
    `);
    if (fixedPkgs.rows.length > 0) {
      console.log(`🔧 서비스세션 패키지 ${fixedPkgs.rows.length}건 serviceSessions 교정`);
      const pkgIds = fixedPkgs.rows.map((r: any) => r.id);
      const fixedLogs = await pool.query(`
        UPDATE pt_session_logs SET "isServiceSession" = 1
        WHERE "packageId" = ANY($1) AND COALESCE("isServiceSession", 0) = 0
        RETURNING id
      `, [pkgIds]);
      if (fixedLogs.rows.length > 0)
        console.log(`🔧 세션 로그 ${fixedLogs.rows.length}건 isServiceSession 교정`);
    }
    // serviceSessionPrice 미설정된 서비스세션 패키지에 관리자 설정 단가 적용
    const gsRes = await pool.query(`SELECT "servicePtUnitPrice" FROM gym_settings WHERE id = 1 LIMIT 1`);
    const defPrice = gsRes.rows[0]?.servicePtUnitPrice ?? 0;
    if (defPrice > 0) {
      const fixedPrice = await pool.query(`
        UPDATE pt_packages SET "serviceSessionPrice" = $1
        WHERE "packageName" = '서비스세션' AND COALESCE("serviceSessionPrice", 0) = 0
        RETURNING id
      `, [defPrice]);
      if (fixedPrice.rows.length > 0)
        console.log(`🔧 서비스세션 패키지 ${fixedPrice.rows.length}건 serviceSessionPrice=${defPrice} 설정`);
    }
  } catch (e) {
    console.error("서비스세션 교정 오류:", e);
  }

  // ── 환불 계약서 디버그 로그 ──
  try {
    const rcCount = await pool.query(`SELECT COUNT(*)::int AS c FROM refund_contracts`);
    console.log(`📋 refund_contracts: ${rcCount.rows[0]?.c ?? 0}건`);
    if (rcCount.rows[0]?.c > 0) {
      const rcs = await pool.query(`SELECT id, "memberId", "memberName", "refundAmount", "penaltyAmount", status, "packageId" FROM refund_contracts ORDER BY "createdAt" DESC LIMIT 5`);
      for (const rc of rcs.rows) console.log(`  → #${rc.id} ${rc.memberName} 환불${rc.refundAmount} 위약금${rc.penaltyAmount} pkg${rc.packageId} [${rc.status}]`);
    }
  } catch (e) {
    console.log(`📋 refund_contracts 조회 실패: ${(e as Error).message}`);
  }

  // ── 완료된 양도양수 계약 중 양수인 회원 미생성 건 자동 보정 (initDatabase 실패해도 실행) ──
  try {
    const completedContracts = await pool.query(
      `SELECT id, "transferorMemberId", "transfereeMemberId", "transfereeName",
              "transfereePhone", "transfereeBirthDate", "itemType", "itemId", "completedAt"
       FROM transfer_contracts
       WHERE status = 'completed' AND "transfereeMemberId" IS NULL AND "transfereeName" IS NOT NULL`
    );
    for (const contract of completedContracts.rows) {
      const transferorResult = await pool.query(
        'SELECT "branchId", "trainerId" FROM members WHERE id = $1',
        [contract.transferorMemberId]
      );
      const transferorMember = transferorResult.rows[0];
      if (!transferorMember) continue;

      let branchId = transferorMember.branchId;
      if (!branchId && transferorMember.trainerId) {
        const tbResult = await pool.query(
          'SELECT "branchId" FROM trainer_branches WHERE "trainerId" = $1 LIMIT 1',
          [transferorMember.trainerId]
        );
        branchId = tbResult.rows[0]?.branchId ?? null;
      }

      const now = new Date().toISOString();
      const memberResult = await pool.query(
        `INSERT INTO members ("branchId", "trainerId", name, phone, "birthDate", status, "profileNote", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, 'active', $6, $7, $7) RETURNING id`,
        [
          branchId, transferorMember.trainerId ?? null, contract.transfereeName,
          contract.transfereePhone ?? null, contract.transfereeBirthDate ?? null,
          `양도양수 계약으로 등록 (계약서 ID: ${contract.id})`, now,
        ]
      );
      if (memberResult.rows[0]) {
        const transfereeMemberId = memberResult.rows[0].id;
        await pool.query('UPDATE transfer_contracts SET "transfereeMemberId" = $1 WHERE id = $2', [transfereeMemberId, contract.id]);
        if (contract.itemId) {
          if (contract.itemType === "pt_package") await pool.query('UPDATE pt_packages SET "memberId" = $1 WHERE id = $2', [transfereeMemberId, contract.itemId]);
          else if (contract.itemType === "membership") await pool.query('UPDATE memberships SET "memberId" = $1 WHERE id = $2', [transfereeMemberId, contract.itemId]);
          else if (contract.itemType === "locker") await pool.query('UPDATE lockers SET "memberId" = $1, "memberName" = $2 WHERE id = $3', [transfereeMemberId, contract.transfereeName, contract.itemId]);
          else if (contract.itemType === "uniform") await pool.query('UPDATE uniforms SET "memberId" = $1, "memberName" = $2 WHERE id = $3', [transfereeMemberId, contract.transfereeName, contract.itemId]);
        }
        console.log(`✅ 양도양수 완료 계약 ${contract.id} - 양수인 '${contract.transfereeName}' 회원 자동 생성`);
      }
    }
    if (completedContracts.rows.length > 0) console.log(`✅ 양도양수 양수인 회원 보정 완료 (${completedContracts.rows.length}건 처리)`);
  } catch (e) {
    console.error("양도양수 양수인 회원 자동 보정 오류:", e);
  }

  // ── 중복 회원 자동 병합: 비활성화 ────────────────────────────────────────────
  // 매 재시작마다 실행되며 이름+전화가 같으면 되돌릴 수 없이 병합·삭제하던 로직.
  // 공용/placeholder 번호에서 오병합 위험이 커서 자동 실행을 끈다.
  // 중복 회원 병합은 회원 관리의 "중복 의심 → 병합"(수동)으로만 진행한다.
  const ENABLE_AUTO_MEMBER_MERGE = false;
  try {
    if (!ENABLE_AUTO_MEMBER_MERGE) throw new Error("__skip_auto_merge__");
    const dupResult = await pool.query(`
      SELECT
        trim(name) AS name,
        array_agg(id ORDER BY id ASC) AS ids
      FROM members
      WHERE length(regexp_replace(COALESCE(phone,''), '[^0-9]', '', 'g')) >= 7
      GROUP BY trim(name), regexp_replace(COALESCE(phone,''), '[^0-9]', '', 'g')
      HAVING COUNT(*) > 1
    `);
    let merged = 0;
    for (const row of dupResult.rows) {
      const keepId: number = row.ids[0];
      const deleteIds: number[] = row.ids.slice(1);
      for (const delId of deleteIds) {
        try {
          console.log(`🔄 중복 병합 시도: '${row.name}' ID ${delId} → ${keepId}`);
          // 출석 — 같은 날짜 중복 제거 후 이전
          await pool.query(`
            DELETE FROM attendances
            WHERE "memberId" = $1 AND "attendDate" IN (
              SELECT "attendDate" FROM attendances WHERE "memberId" = $2
            )`, [delId, keepId]);
          await pool.query(`UPDATE attendances SET "memberId" = $1 WHERE "memberId" = $2`, [keepId, delId]);
          console.log(`  ✓ attendances`);

          // 출석체크 — 같은 날짜 중복 제거 후 이전
          await pool.query(`
            DELETE FROM attendance_checks
            WHERE "memberId" = $1 AND "checkDate" IN (
              SELECT "checkDate" FROM attendance_checks WHERE "memberId" = $2
            )`, [delId, keepId]);
          await pool.query(`UPDATE attendance_checks SET "memberId" = $1 WHERE "memberId" = $2`, [keepId, delId]);

          // PAR-Q — unique 제약: 기존 있으면 삭제, 없으면 이전
          const hasParQ = await pool.query(`SELECT id FROM par_q WHERE "memberId" = $1 LIMIT 1`, [keepId]);
          if (hasParQ.rows.length > 0) {
            await pool.query(`DELETE FROM par_q WHERE "memberId" = $1`, [delId]);
          } else {
            await pool.query(`UPDATE par_q SET "memberId" = $1 WHERE "memberId" = $2`, [keepId, delId]);
          }

          // gym_plus_members — 자식 테이블 먼저 정리 후 처리
          const gymPlusTableCheck = await pool.query(`SELECT to_regclass('gym_plus_members') IS NOT NULL AS exists`);
          if (gymPlusTableCheck.rows[0]?.exists) {
            const gymPlusDelRow = await pool.query(`SELECT id FROM gym_plus_members WHERE "memberId" = $1 LIMIT 1`, [delId]);
            if (gymPlusDelRow.rows.length > 0) {
              const gymPlusDelId = gymPlusDelRow.rows[0].id;
              const gymPlusKeepRow = await pool.query(`SELECT id FROM gym_plus_members WHERE "memberId" = $1 LIMIT 1`, [keepId]);
              if (gymPlusKeepRow.rows.length > 0) {
                for (const childTbl of ['gym_plus_messages', 'gym_plus_workout_logs', 'gym_plus_push_subscriptions']) {
                  const tblExists = await pool.query(`SELECT to_regclass($1) IS NOT NULL AS exists`, [childTbl]);
                  if (tblExists.rows[0]?.exists) {
                    await pool.query(`DELETE FROM "${childTbl}" WHERE "gymPlusMemberId" = $1`, [gymPlusDelId]);
                  }
                }
                await pool.query(`DELETE FROM gym_plus_members WHERE id = $1`, [gymPlusDelId]);
              } else {
                await pool.query(`UPDATE gym_plus_members SET "memberId" = $1 WHERE id = $2`, [keepId, gymPlusDelId]);
              }
            }
          }

          console.log(`  ✓ gym_plus_members`);
          // 나머지 테이블 일괄 이전
          for (const [tbl, col] of [
            ["pt_packages", "memberId"],
            ["pt_pauses", "memberId"],
            ["schedules", "memberId"],
            ["pt_session_logs", "memberId"],
            ["workout_memos", "memberId"],
            ["report_tokens", "memberId"],
            ["health_reports", "memberId"],
            ["pt_reports", "memberId"],
            ["payments", "memberId"],
            ["revenue_entries", "memberId"],
            ["lockers", "memberId"],
            ["uniforms", "memberId"],
            ["access_logs", "memberId"],
          ] as const) {
            await pool.query(`UPDATE "${tbl}" SET "${col}" = $1 WHERE "${col}" = $2`, [keepId, delId]);
            console.log(`  ✓ ${tbl}`);
          }
          await pool.query(`UPDATE leads SET "registeredMemberId" = $1 WHERE "registeredMemberId" = $2`, [keepId, delId]);
          await pool.query(`UPDATE transfer_contracts SET "transferorMemberId" = $1 WHERE "transferorMemberId" = $2`, [keepId, delId]);
          await pool.query(`UPDATE transfer_contracts SET "transfereeMemberId" = $1 WHERE "transfereeMemberId" = $2`, [keepId, delId]);
          console.log(`  ✓ leads/transfer_contracts`);
          await pool.query(`DELETE FROM members WHERE id = $1`, [delId]);
          console.log(`  ✓ members DELETE`);
          merged++;
          console.log(`✅ 중복 회원 병합: '${row.name}' ID ${delId} → ${keepId}`);
        } catch (innerErr) {
          console.error(`⚠️ 중복 병합 실패: '${row.name}' ID ${delId} → ${keepId}:`, innerErr);
        }
      }
    }
    if (merged > 0) console.log(`✅ 중복 회원 총 ${merged}건 병합 완료`);
    else console.log("✅ 중복 회원 없음");
  } catch (e: any) {
    if (e?.message === "__skip_auto_merge__") console.log("ℹ️ 중복 회원 자동 병합 비활성화됨 (수동 병합만)");
    else console.error("중복 회원 병합 오류:", e);
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

  // 노션 일일/주간/월간 브리핑 자동 발송 (NOTION_API_TOKEN/NOTION_BRIEFING_PAGE_ID 설정 시에만 동작)
  startNotionBriefingScheduler();
}

start().catch(console.error);
