import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";

function getYoutubeEmbedUrl(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return `https://www.youtube.com/embed/${match[1]}?rel=0`;
  }
  return null;
}

const levelLabel: Record<string, string> = { beginner: "초급", intermediate: "중급", advanced: "고급" };

export default function GymPlusVideoPlayer({ videoId }: { videoId: number }) {
  const [, navigate] = useLocation();
  const { data: video, isLoading } = trpc.gymPlus.getVideo.useQuery({ id: videoId });

  if (isLoading) {
    return <div className="p-4 text-center text-muted-foreground text-sm">불러오는 중...</div>;
  }
  if (!video) {
    return (
      <div className="p-4 text-center">
        <p className="text-muted-foreground text-sm mb-4">영상을 찾을 수 없습니다</p>
        <Button variant="ghost" size="sm" onClick={() => navigate("/gym-plus/videos")}>목록으로</Button>
      </div>
    );
  }

  const embedUrl = getYoutubeEmbedUrl(video.videoUrl);

  return (
    <div>
      {/* 영상 플레이어 */}
      <div className="w-full bg-black aspect-video">
        {embedUrl ? (
          <iframe
            src={embedUrl}
            className="w-full h-full"
            allowFullScreen
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          />
        ) : (
          <video
            src={video.videoUrl}
            controls
            className="w-full h-full"
            playsInline
          />
        )}
      </div>

      {/* 영상 정보 */}
      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <h1 className="font-bold text-base leading-snug flex-1">{video.title}</h1>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-muted-foreground flex-shrink-0"
            onClick={() => navigate("/gym-plus/videos")}
          >
            목록
          </Button>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {video.level && (
            <span className="text-xs bg-muted px-2 py-0.5 rounded-full">
              {levelLabel[video.level] ?? video.level}
            </span>
          )}
          {video.bodyPart && (
            <span className="text-xs bg-muted px-2 py-0.5 rounded-full">{video.bodyPart}</span>
          )}
          {video.duration && (
            <span className="text-xs text-muted-foreground">⏱ {video.duration}</span>
          )}
        </div>

        {video.description && (
          <div className="bg-muted/50 rounded-xl p-3">
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{video.description}</p>
          </div>
        )}
      </div>
    </div>
  );
}
