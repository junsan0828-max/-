import express from "express";
import session from "express-session";
import cors from "cors";
import path from "path";
import fs from "fs";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "./routers";
import { getDb } from "./db";
import type { AuthUser } from "./auth";

const app = express();
const PORT = parseInt(process.env.PORT || "3000");

app.use(
  cors({
    origin: true,
    credentials: true,
  })
);

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

// DB 초기화 + 시드 (첫 실행 시 자동)
async function initDb() {
  try {
    const { db } = await import("./db");
    const { users } = await import("../drizzle/schema");
    const { eq } = await import("drizzle-orm");
    const existing = await db.select({ id: users.id }).from(users).where(eq(users.username, "admin"));
    if (existing.length === 0) {
      console.log("🌱 초기 데이터 생성 중...");
      const { execSync } = await import("child_process");
      execSync("npx tsx server/seed.ts", { stdio: "inherit", cwd: process.cwd() });
    }
  } catch (e) {
    console.error("initDb error:", e);
  }
}

app.listen(PORT, "0.0.0.0", async () => {
  console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
  await initDb();
});
