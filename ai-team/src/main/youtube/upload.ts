// 유튜브 실제 업로드 — 공식 YouTube Data API v3 사용 (봇/브라우저 조작 아님).
import { google } from "googleapis";
import { createReadStream, statSync } from "node:fs";
import { getAuthorizedClient } from "./auth";

export type PrivacyStatus = "private" | "unlisted" | "public";

export interface UploadInput {
  filePath: string;
  title: string;
  description: string;
  tags?: string[];
  privacyStatus?: PrivacyStatus;
}

export interface UploadResult {
  ok: boolean;
  videoId?: string;
  url?: string;
  error?: string;
}

export async function uploadVideo(input: UploadInput): Promise<UploadResult> {
  try {
    statSync(input.filePath); // 파일 존재 확인, 없으면 예외
    const auth = await getAuthorizedClient();
    const youtube = google.youtube({ version: "v3", auth });

    const res = await youtube.videos.insert({
      part: ["snippet", "status"],
      requestBody: {
        snippet: {
          title: input.title.slice(0, 100),
          description: input.description.slice(0, 5000),
          tags: input.tags?.slice(0, 15),
        },
        status: {
          privacyStatus: input.privacyStatus ?? (process.env.YOUTUBE_DEFAULT_PRIVACY as PrivacyStatus) ?? "private",
        },
      },
      media: { body: createReadStream(input.filePath) },
    });

    const videoId = res.data.id;
    if (!videoId) return { ok: false, error: "업로드 응답에 videoId가 없습니다." };
    return { ok: true, videoId, url: `https://youtu.be/${videoId}` };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
