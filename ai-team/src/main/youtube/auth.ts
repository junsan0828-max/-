// 유튜브 인증 — 구글 공식 OAuth. 최초 1회만 브라우저 승인, 이후 완전 자동.
// 트레이너별로 유튜브 계정이 따로(최대 5개) 있어서, 계정마다 별도 토큰 파일로 관리한다.
// accountId를 안 주면 기존 기본 계정("default", output/youtube-token.json)을 그대로 쓴다.
import { join } from "node:path";
import { readdirSync } from "node:fs";
import { getAuthorizedClient as authorize, GoogleAuthConfig, OAuth2Client } from "../google/oauth";

export type { OAuth2Client } from "../google/oauth";

const OUTPUT_DIR = join(__dirname, "..", "..", "..", "output");
const TOKEN_PREFIX = "youtube-token";

function tokenPathFor(accountId: string): string {
  const fileName = accountId === "default" ? `${TOKEN_PREFIX}.json` : `${TOKEN_PREFIX}-${accountId}.json`;
  return join(OUTPUT_DIR, fileName);
}

function configFor(accountId: string): GoogleAuthConfig {
  return {
    clientSecretPath: join(__dirname, "..", "..", "..", "config", "youtube-client-secret.json"),
    tokenPath: tokenPathFor(accountId),
    redirectPort: 53682,
    scopes: [
      "https://www.googleapis.com/auth/youtube.upload",
      "https://www.googleapis.com/auth/youtube.readonly", // 채널 영상 목록(숏츠) 조회용
    ],
    label: `유튜브(${accountId})`,
  };
}

export async function getAuthorizedClient(accountId = "default"): Promise<OAuth2Client> {
  return authorize(configFor(accountId));
}

/** 이미 인증(로그인)된 계정 id 목록. 새 계정을 추가하려면 그냥 새 accountId로 getAuthorizedClient를 부르면 됨(브라우저 인증 1회). */
export function listConnectedAccountIds(): string[] {
  let files: string[] = [];
  try {
    files = readdirSync(OUTPUT_DIR);
  } catch {
    return [];
  }
  return files
    .filter((f) => f.startsWith(TOKEN_PREFIX) && f.endsWith(".json") && !f.endsWith(".bak"))
    .map((f) => {
      const base = f.replace(/^youtube-token-?/, "").replace(/\.json$/, "");
      return base === "" ? "default" : base;
    });
}
