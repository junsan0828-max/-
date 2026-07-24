// 채널에 업로드된 숏츠 목록을 읽어온다.
// YouTube Data API에는 "이거 숏츠임" 필드가 따로 없다. 재생시간 60초 이하는 필요조건일 뿐 충분조건이
// 아니어서(가로 영상이 짧기만 해도 60초 이하일 수 있음), 실제로는 youtube.com/shorts/{id}에 접속했을 때
// /watch?v=...로 리다이렉트되지 않고 그대로 유지되는지로 진짜 숏츠 여부를 확인한다
// (유튜브가 숏츠로 인식하지 않는 영상은 /shorts/ 경로 접근 시 일반 시청 페이지로 돌려보낸다).
import { google } from "googleapis";
import { getAuthorizedClient, listConnectedAccountIds } from "./auth";

/** youtube.com/shorts/{id}가 리다이렉트 없이 그대로 유지되는지로 진짜 숏츠인지 확인한다. */
async function isActuallyShort(videoId: string): Promise<boolean> {
  try {
    const res = await fetch(`https://www.youtube.com/shorts/${videoId}`, { redirect: "manual" });
    // 리다이렉트가 없으면(200) 숏츠 그대로, 302 등으로 /watch?v=...로 보내면 숏츠 아님.
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location") ?? "";
      return !location.includes("/watch?v=");
    }
    return res.status === 200;
  } catch {
    return false; // 확인 실패 시 안전하게 숏츠 아님으로 처리 (잘못 포함시키는 것보다 낫다)
  }
}

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
 * accountId를 처음 쓰는 경우 브라우저 인증이 1회 뜬다.
 * knownUrls를 주면, 업로드 목록(최신순)을 훑다가 이미 아는 영상을 만나는 순간 멈춘다 — 채널에
 * 영상이 아무리 많이 쌓여도 매번 "지난번 이후 새로 올라온 것"만 훑게 되어 계속 빨라진다. */
export async function listRecentShorts(
  accountId = "default",
  maxCount = 20,
  knownUrls?: Set<string>
): Promise<ShortVideo[]> {
  const auth = await getAuthorizedClient(accountId);
  const youtube = google.youtube({ version: "v3", auth });

  const channelRes = await youtube.channels.list({ part: ["contentDetails"], mine: true });
  const uploadsPlaylistId = channelRes.data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
  if (!uploadsPlaylistId) throw new Error("업로드 재생목록을 찾지 못했습니다 (채널 인증 확인 필요).");

  const shorts: ShortVideo[] = [];
  let pageToken: string | undefined;

  outer: while (shorts.length < maxCount) {
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
      if (!v.id) continue;
      const url = `https://youtube.com/shorts/${v.id}`;
      if (knownUrls?.has(url)) break outer; // 최신순이므로 여기서부턴 전부 이미 본 것들

      const durationSeconds = parseDurationSeconds(v.contentDetails?.duration ?? "");
      // 60초 이하는 필요조건일 뿐이라 실제 /shorts/ 유지 여부까지 확인해야 한다.
      if (durationSeconds > 0 && durationSeconds <= 60 && (await isActuallyShort(v.id))) {
        shorts.push({
          videoId: v.id,
          title: v.snippet?.title ?? "(제목 없음)",
          url,
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
export async function listAllAccountsRecentShorts(maxCountPerAccount = 20, knownUrls?: Set<string>): Promise<ShortVideo[]> {
  const accountIds = listConnectedAccountIds();
  const all: ShortVideo[] = [];
  for (const accountId of accountIds) {
    try {
      const shorts = await listRecentShorts(accountId, maxCountPerAccount, knownUrls);
      all.push(...shorts);
    } catch (err) {
      console.error(`[유튜브 숏츠] ${accountId} 계정 조회 실패:`, err instanceof Error ? err.message : err);
    }
  }
  return all;
}
