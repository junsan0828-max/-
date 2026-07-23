// 유튜브 업로드 인증 — 구글 공식 OAuth. 최초 1회만 브라우저 승인, 이후 완전 자동.
// 사장님 본인 채널에 본인이 로그인하는 것이라 계정정지 리스크가 없다 (봇 로그인 아님).
import { join } from "node:path";
import { getAuthorizedClient as authorize, GoogleAuthConfig, OAuth2Client } from "../google/oauth";

export type { OAuth2Client } from "../google/oauth";

const CONFIG: GoogleAuthConfig = {
  clientSecretPath: join(__dirname, "..", "..", "..", "config", "youtube-client-secret.json"),
  tokenPath: join(__dirname, "..", "..", "..", "output", "youtube-token.json"),
  redirectPort: 53682,
  scopes: [
    "https://www.googleapis.com/auth/youtube.upload",
    "https://www.googleapis.com/auth/youtube.readonly", // 채널 영상 목록(숏츠) 조회용
  ],
  label: "유튜브",
};

export async function getAuthorizedClient(): Promise<OAuth2Client> {
  return authorize(CONFIG);
}
