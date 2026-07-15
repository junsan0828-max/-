// 구글 드라이브 인증 — 유튜브와 같은 구글 OAuth 클라이언트(config/youtube-client-secret.json)를
// 재사용하되, 별도 승인·별도 토큰 파일을 쓴다 (같은 구글 클라우드 프로젝트에서
// Drive API / Sheets API를 사용 설정해두면 추가 파일 없이 그대로 동작).
// 드라이브는 폴더 정리(추가 위치로 넣기)를 위해 읽기/쓰기 스코프를 쓴다.
import { join } from "node:path";
import { getAuthorizedClient as authorize, GoogleAuthConfig, OAuth2Client } from "../google/oauth";

export type { OAuth2Client } from "../google/oauth";

const CONFIG: GoogleAuthConfig = {
  clientSecretPath: join(__dirname, "..", "..", "..", "config", "youtube-client-secret.json"),
  tokenPath: join(__dirname, "..", "..", "..", "output", "drive-token.json"),
  redirectPort: 53683,
  scopes: [
    "https://www.googleapis.com/auth/drive",
    "https://www.googleapis.com/auth/spreadsheets",
  ],
  label: "구글 드라이브",
};

export async function getAuthorizedClient(): Promise<OAuth2Client> {
  return authorize(CONFIG);
}
