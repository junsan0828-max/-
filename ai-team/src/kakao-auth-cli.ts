// 카카오 "나에게 보내기" 최초 1회 로그인 — refresh token을 발급받아 .env에 저장할 값을 알려준다.
// 실행 전 .env에 KAKAO_REST_API_KEY(카카오 디벨로퍼스 앱의 REST API 키)를 먼저 넣어야 한다.
// 실행: npm run kakao-auth
import "dotenv/config";
import { createServer } from "node:http";
import { exec } from "node:child_process";

const PORT = 9325;
const REDIRECT_URI = `http://localhost:${PORT}/kakao/callback`;

async function main() {
  const apiKey = process.env.KAKAO_REST_API_KEY;
  if (!apiKey) {
    console.error("❌ .env에 KAKAO_REST_API_KEY가 없습니다. 카카오 디벨로퍼스에서 REST API 키를 먼저 발급받아 넣어주세요.");
    console.error("   https://developers.kakao.com → 내 애플리케이션 → 앱 만들기 → 앱 키 → REST API 키");
    process.exit(1);
  }

  const authUrl =
    `https://kauth.kakao.com/oauth/authorize?client_id=${apiKey}` +
    `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=talk_message`;

  console.log("⚠️  카카오 디벨로퍼스 앱 설정에 아래 Redirect URI가 정확히 등록되어 있어야 합니다:");
  console.log(`   ${REDIRECT_URI}`);
  console.log("\n브라우저를 엽니다. 안 열리면 아래 링크를 직접 열어주세요:\n");
  console.log(authUrl + "\n");

  const openCmd = process.platform === "win32" ? "start" : process.platform === "darwin" ? "open" : "xdg-open";
  exec(`${openCmd} "${authUrl}"`, () => {});

  const server = createServer(async (req, res) => {
    if (!req.url?.startsWith("/kakao/callback")) {
      res.writeHead(404);
      res.end();
      return;
    }
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const code = url.searchParams.get("code");
    const error = url.searchParams.get("error");

    if (error || !code) {
      res.writeHead(400, { "content-type": "text/html; charset=utf-8" });
      res.end("<h2>로그인 실패. 터미널을 확인하세요.</h2>");
      console.error("❌ 인증 실패:", error || "code 없음");
      server.close();
      process.exit(1);
    }

    try {
      const tokenRes = await fetch("https://kauth.kakao.com/oauth/token", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          client_id: apiKey,
          redirect_uri: REDIRECT_URI,
          code,
        }),
      });
      const data: any = await tokenRes.json();
      if (!tokenRes.ok) throw new Error(data?.error_description || "토큰 발급 실패");

      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end("<h2>로그인 완료! 터미널로 돌아가세요. 이 창은 닫아도 됩니다.</h2>");

      console.log("\n✅ 로그인 성공! 아래 줄을 .env에 추가하세요:\n");
      console.log(`KAKAO_REFRESH_TOKEN=${data.refresh_token}`);
      console.log(`\n(참고: access token은 자동 갱신되니 refresh token만 저장하면 됩니다.)`);
    } catch (err) {
      console.error("❌ 토큰 발급 실패:", err instanceof Error ? err.message : err);
    } finally {
      server.close();
      process.exit(0);
    }
  });

  server.listen(PORT);
}

main();
