// 채널에 업로드된 숏츠(세로/60초 이하 영상) 목록을 읽어온다.
// YouTube Data API에는 "이거 숏츠임" 필드가 따로 없어서, 업계 통용 기준대로
// 영상 길이 60초 이하를 숏츠로 판단한다.
import { google } from "googleapis";
import { getAuthorizedClient } from "./auth";

export interface ShortVideo {
  videoId: string;
  title: string;
  url: string;
  publishedAt: string; // ISO
  durationSeconds: number;
}

/** ISO 8601 재생시간(PT1M5S 등)을 초 단위로 변환한다. */
function parseDurationSeconds(iso: string): number {
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  const [, h, min, s] = m;
  return (Number(h) || 0) * 3600 + (Number(min) || 0) * 60 + (Number(s) || 0);
}

/** 내 채널에 업로드된 영상 중 최근 것부터 숏츠(60초 이하)만 골라 돌려준다. */
export async function listRecentShorts(maxCount = 20): Promise<ShortVideo[]> {
  const auth = await getAuthorizedClient();
  const youtube = google.youtube({ version: "v3", auth });

  const channelRes = await youtube.channels.list({ part: ["contentDetails"], mine: true });
  const uploadsPlaylistId = channelRes.data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
  if (!uploadsPlaylistId) throw new Error("업로드 재생목록을 찾지 못했습니다 (채널 인증 확인 필요).");

  const shorts: ShortVideo[] = [];
  let pageToken: string | undefined;

  while (shorts.length < maxCount) {
    const itemsRes = await youtube.playlistItems.list({
      part: ["snippet", "contentDetails"],
      playlistId: uploadsPlaylistId,
      maxResults: 50,
      pageToken,
    });

    const videoIds = (itemsRes.data.items ?? [])
      .map((i) => i.contentDetails?.videoId)
      .filter((id): id is string => !!id);
    if (videoIds.length === 0) break;

    const videosRes = await youtube.videos.list({ part: ["contentDetails", "snippet"], id: videoIds });
    for (const v of videosRes.data.items ?? []) {
      const durationSeconds = parseDurationSeconds(v.contentDetails?.duration ?? "");
      if (durationSeconds > 0 && durationSeconds <= 60 && v.id) {
        shorts.push({
          videoId: v.id,
          title: v.snippet?.title ?? "(제목 없음)",
          url: `https://youtube.com/shorts/${v.id}`,
          publishedAt: v.snippet?.publishedAt ?? "",
          durationSeconds,
        });
      }
    }

    pageToken = itemsRes.data.nextPageToken ?? undefined;
    if (!pageToken) break;
  }

  return shorts.slice(0, maxCount);
}
