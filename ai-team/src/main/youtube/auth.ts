// 유튜브 업로드 인증 — 구글 공식 OAuth. 최초 1회만 브라우저 승인, 이후 완전 자동.
// 사장님 본인 채널에 본인이 로그인하는 것이라 계정정지 리스크가 없다 (봇 로그인 아님).
import { google } from "googleapis";
import { createServer } from "node:http";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { exec } from "node:child_process";

const CLIENT_SECRET_PATH = join(__dirname, "..", "..", "..", "config", "youtube-client-secret.json");
const TOKEN_PATH = join(__dirname, "..", "..", "..", "output", "youtube-token.json");
const REDIRECT_PORT = 53682;
const REDIRECT_URI = `http://localhost:${REDIRECT_PORT}/oauth2callback`;
const SCOPES = ["https://www.googleapis.com/auth/youtube.upload"];

export type OAuth2Client = InstanceType<typeof google.auth.OAuth2>;

function openBrowser(url: string) {
  const cmd = process.platform === "win32" ? `start "" "${url}"` : process.platform === "darwin" ? `open "${url}"` : `xdg-open "${url}"`;
  exec(cmd);
}

interface ClientSecretFile {
  installed?: { client_id: string; client_secret: string };
  web?: { client_id: string; client_secret: string };
}

function loadClient(): OAuth2Client {
  if (!existsSync(CLIENT_SECRET_PATH)) {
    throw new Error(
      `유튜브 인증 파일이 없습니다: ${CLIENT_SECRET_PATH}\n구글 클라우드에서 발급받은 client_secret.json을 이 경로에 넣어주세요.`
    );
  }
  const raw: ClientSecretFile = JSON.parse(readFileSync(CLIENT_SECRET_PATH, "utf-8"));
  const creds = raw.installed ?? raw.web;
  if (!creds) throw new Error("client_secret.json 형식이 올바르지 않습니다.");
  return new google.auth.OAuth2(creds.client_id, creds.client_secret, REDIRECT_URI);
}

function loadSavedToken(client: OAuth2Client): boolean {
  if (!existsSync(TOKEN_PATH)) return false;
  client.setCredentials(JSON.parse(readFileSync(TOKEN_PATH, "utf-8")));
  return true;
}

function saveToken(tokens: unknown) {
  mkdirSync(join(__dirname, "..", "..", "..", "output"), { recursive: true });
  writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2), "utf-8");
}

/** 최초 1회: 브라우저를 열어 사장님 구글 계정 승인을 받고 토큰을 저장한다. */
function authorizeInteractively(client: OAuth2Client): Promise<void> {
  return new Promise((resolve, reject) => {
    const authUrl = client.generateAuthUrl({ access_type: "offline", scope: SCOPES, prompt: "consent" });

    const server = createServer(async (req, res) => {
      try {
        if (!req.url?.startsWith("/oauth2callback")) return;
        const code = new URL(req.url, REDIRECT_URI).searchParams.get("code");
        res.end("승인 완료! 이 창은 닫으셔도 됩니다. 앱으로 돌아가세요.");
        server.close();
        if (!code) return reject(new Error("인증 코드가 없습니다."));
        const { tokens } = await client.getToken(code);
        client.setCredentials(tokens);
        saveToken(tokens);
        resolve();
      } catch (err) {
        reject(err);
      }
    });

    server.listen(REDIRECT_PORT, () => {
      console.log("\n🔐 유튜브 채널 연결이 필요합니다. 브라우저가 열립니다...");
      console.log(`   (자동으로 안 열리면 이 주소를 직접 여세요: ${authUrl})\n`);
      openBrowser(authUrl);
    });
  });
}

/** 인증된 OAuth2 클라이언트를 돌려준다. 토큰이 없으면 최초 1회 브라우저 승인을 진행한다. */
export async function getAuthorizedClient(): Promise<OAuth2Client> {
  const client = loadClient();
  if (!loadSavedToken(client)) {
    await authorizeInteractively(client);
  }
  // 만료된 access token은 refresh token으로 자동 갱신되고, 갱신된 토큰을 다시 저장한다.
  client.on("tokens", (tokens) => {
    if (tokens.refresh_token || tokens.access_token) {
      const merged = { ...client.credentials, ...tokens };
      saveToken(merged);
    }
  });
  return client;
}
