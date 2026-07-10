// 구글 OAuth 공통 로직 — 유튜브 업로드, 드라이브 읽기 등 여러 구글 서비스가
// 이 팩토리로 인증 클라이언트를 만든다. 최초 1회만 브라우저 승인, 이후 토큰 자동 갱신.
import { google } from "googleapis";
import { createServer } from "node:http";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { exec } from "node:child_process";

export type OAuth2Client = InstanceType<typeof google.auth.OAuth2>;

export interface GoogleAuthConfig {
  clientSecretPath: string;
  tokenPath: string;
  redirectPort: number;
  scopes: string[];
  label: string; // 인증 안내 메시지에 쓸 서비스 이름 (예: "유튜브", "구글 드라이브")
}

interface ClientSecretFile {
  installed?: { client_id: string; client_secret: string };
  web?: { client_id: string; client_secret: string };
}

function openBrowser(url: string) {
  const cmd =
    process.platform === "win32" ? `start "" "${url}"` : process.platform === "darwin" ? `open "${url}"` : `xdg-open "${url}"`;
  exec(cmd);
}

function loadClient(cfg: GoogleAuthConfig): OAuth2Client {
  if (!existsSync(cfg.clientSecretPath)) {
    throw new Error(
      `${cfg.label} 인증 파일이 없습니다: ${cfg.clientSecretPath}\n구글 클라우드에서 발급받은 client_secret.json을 이 경로에 넣어주세요.`
    );
  }
  const raw: ClientSecretFile = JSON.parse(readFileSync(cfg.clientSecretPath, "utf-8"));
  const creds = raw.installed ?? raw.web;
  if (!creds) throw new Error("client_secret.json 형식이 올바르지 않습니다.");
  return new google.auth.OAuth2(creds.client_id, creds.client_secret, `http://localhost:${cfg.redirectPort}/oauth2callback`);
}

function loadSavedToken(client: OAuth2Client, tokenPath: string): boolean {
  if (!existsSync(tokenPath)) return false;
  client.setCredentials(JSON.parse(readFileSync(tokenPath, "utf-8")));
  return true;
}

function saveToken(tokenPath: string, tokens: unknown) {
  mkdirSync(dirname(tokenPath), { recursive: true });
  writeFileSync(tokenPath, JSON.stringify(tokens, null, 2), "utf-8");
}

/** 최초 1회: 브라우저를 열어 사장님 구글 계정 승인을 받고 토큰을 저장한다. */
function authorizeInteractively(client: OAuth2Client, cfg: GoogleAuthConfig): Promise<void> {
  return new Promise((resolve, reject) => {
    const authUrl = client.generateAuthUrl({ access_type: "offline", scope: cfg.scopes, prompt: "consent" });

    const server = createServer(async (req, res) => {
      try {
        if (!req.url?.startsWith("/oauth2callback")) return;
        const code = new URL(req.url, `http://localhost:${cfg.redirectPort}`).searchParams.get("code");
        res.end("승인 완료! 이 창은 닫으셔도 됩니다. 앱으로 돌아가세요.");
        server.close();
        if (!code) return reject(new Error("인증 코드가 없습니다."));
        const { tokens } = await client.getToken(code);
        client.setCredentials(tokens);
        saveToken(cfg.tokenPath, tokens);
        resolve();
      } catch (err) {
        reject(err);
      }
    });

    server.listen(cfg.redirectPort, () => {
      console.log(`\n🔐 ${cfg.label} 연결이 필요합니다. 브라우저가 열립니다...`);
      console.log(`   (자동으로 안 열리면 이 주소를 직접 여세요: ${authUrl})\n`);
      openBrowser(authUrl);
    });
  });
}

/** 인증된 OAuth2 클라이언트를 돌려준다. 토큰이 없으면 최초 1회 브라우저 승인을 진행한다. */
export async function getAuthorizedClient(cfg: GoogleAuthConfig): Promise<OAuth2Client> {
  const client = loadClient(cfg);
  if (!loadSavedToken(client, cfg.tokenPath)) {
    await authorizeInteractively(client, cfg);
  }
  // 만료된 access token은 refresh token으로 자동 갱신되고, 갱신된 토큰을 다시 저장한다.
  client.on("tokens", (tokens) => {
    if (tokens.refresh_token || tokens.access_token) {
      const merged = { ...client.credentials, ...tokens };
      saveToken(cfg.tokenPath, merged);
    }
  });
  return client;
}
