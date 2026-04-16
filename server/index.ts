import express from "express";
import session from "express-session";
import cors from "cors";
import path from "path";
import fs from "fs";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "./routers";
import type { AuthUser } from "./auth";

const app = express();
const PORT = parseInt(process.env.PORT || "3000");

app.use(
  cors({
    origin: true, // 동일 서버에서 클라이언트 서빙하므로 모든 origin 허용
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
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7일
    },
  })
);

// 자체 포함 테스트 페이지 (외부 의존성 없음)
app.get("/test", (req, res) => {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(`<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{margin:0;background:#1a1a2e;color:white;font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;text-align:center}</style>
</head><body>
<div>
  <div style="font-size:60px">✅</div>
  <h1 style="color:#4caf50">서버 연결 성공!</h1>
  <p>IP: ${req.ip}</p>
  <p id="js">JavaScript: ❌ 비활성</p>
  <script>document.getElementById('js').innerHTML='JavaScript: ✅ 활성'</script>
</div>
</body></html>`);
});

app.use(
  createExpressMiddleware({
    router: appRouter,
    createContext: ({ req, res }) => ({
      user: (req.session as any)?.user as AuthUser | undefined,
      req,
      res,
    }),
  })
);

// 프론트엔드 정적 파일 서빙 (빌드된 경우)
const clientDistPath = path.join(process.cwd(), "client", "dist");
if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/trpc")) return next();
    res.sendFile(path.join(clientDistPath, "index.html"));
  });
}

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
});
