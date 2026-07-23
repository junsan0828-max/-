// 채널에 업로드된 숏츠(세로/60초 이하 영상) 목록을 읽어온다.
// YouTube Data API에는 "이거 숏츠임" 필드가 따로 없어서, 업계 통용 기준대로
// 영상 길이 60초 이하를 숏츠로 판단한다.
import { google } from "googleapis";
import { getAuthorizedClient, listConnectedAccountIds } from "./auth";

export interface ShortVideo {
  videoId: string;
  title: string;
  url: string;
  publishedAt: string; // ISO
  durationSeconds: number;
  accountId: string; // 어느 유튜브 계정(트레이너)에서 가져온 영상인지
}

/** ISO 8601 재생시간(PT1M5S 등)을 초 단위로 변환한다. */
function parseDurationSeconds(iso: string): number {
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  const [, h, min, s] = m;
  return (Number(h) || 0) * 3600 + (Number(min) || 0) * 60 + (Number(s) || 0);
}

/** 지정한 계정(accountId)의 채널에 업로드된 영상 중 최근 것부터 숏츠(60초 이하)만 골라 돌려준다.
 * accountId를 처음 쓰는 경우 브라우저 인증이 1회 뜬다. */
export async function listRecentShorts(accountId = "default", maxCount = 20): Promise<ShortVideo[]> {
  const auth = await getAuthorizedClient(accountId);
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
          accountId,
        });
      }
    }

    pageToken = itemsRes.data.nextPageToken ?? undefined;
    if (!pageToken) break;
  }

  return shorts.slice(0, maxCount);
}

/** 지금까지 인증(로그인)해둔 모든 유튜브 계정의 숏츠를 한번에 모아 온다.
 * 계정 하나가 실패해도 나머지는 계속 진행하고, 실패한 계정은 콘솔에 남긴다. */
export async function listAllAccountsRecentShorts(maxCountPerAccount = 20): Promise<ShortVideo[]> {
  const accountIds = listConnectedAccountIds();
  const all: ShortVideo[] = [];
  for (const accountId of accountIds) {
    try {
      const shorts = await listRecentShorts(accountId, maxCountPerAccount);
      all.push(...shorts);
    } catch (err) {
      console.error(`[유튜브 숏츠] ${accountId} 계정 조회 실패:`, err instanceof Error ? err.message : err);
    }
  }
  return all;
}
