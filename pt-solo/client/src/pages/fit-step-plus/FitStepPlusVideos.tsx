import { useState, useMemo } from "react";
import { useLocation, useSearch } from "wouter";
import { trpc } from "@/lib/trpc";

const levelLabel: Record<string, string> = {
  beginner: "초급",
  intermediate: "중급",
  advanced: "고급",
};

const levelColor: Record<string, string> = {
  beginner: "bg-green-500/20 text-green-400",
  intermediate: "bg-yellow-500/20 text-yellow-400",
  advanced: "bg-red-500/20 text-red-400",
};

export default function FitStepPlusVideos({ trainerId }: { trainerId: number }) {
  const [, navigate] = useLocation();
  const search = useSearch();
  const base = `/fit-step-plus/${trainerId}`;
  const [selectedCategory, setSelectedCategory] = useState<number | undefined>();
  const [selectedLevel, setSelectedLevel] = useState<string | undefined>();

  const recommendParts = useMemo(() => {
    const raw = new URLSearchParams(search).get("parts");
    return raw ? raw.split(",").filter(Boolean) : [];
  }, [search]);
  const [showRecOnly, setShowRecOnly] = useState(recommendParts.length > 0);

  const { data: categories } = trpc.fitStepPlus.listVideoCategories.useQuery({ trainerId });
  const { data: videos, isLoading } = trpc.fitStepPlus.listVideos.useQuery({
    trainerId,
    categoryId: selectedCategory,
    level: selectedLevel,
  });

  const recommendedVideos = useMemo(() => {
    if (!videos || recommendParts.length === 0) return [];
    return videos.filter(v => v.bodyPart && recommendParts.some(p => v.bodyPart!.includes(p)));
  }, [videos, recommendParts]);

  const displayedVideos = showRecOnly && recommendedVideos.length > 0 ? recommendedVideos : videos;

  return (
    <div className="p-4 space-y-4">
      <h1 className="font-bold text-lg">운동 영상</h1>

      {recommendParts.length > 0 && (
        <div className="rounded-2xl bg-primary/10 border border-primary/20 px-4 py-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-primary">오늘 체크인 기반 추천</p>
            <p className="text-[12px] text-muted-foreground mt-0.5 truncate">{recommendParts.join(" · ")} 관련 영상 {recommendedVideos.length}개</p>
          </div>
          <button
            onClick={() => setShowRecOnly(v => !v)}
            className="shrink-0 text-[12px] font-semibold px-3 py-1.5 rounded-lg bg-primary text-primary-foreground"
          >
            {showRecOnly ? "전체 보기" : "추천만 보기"}
          </button>
        </div>
      )}

      {categories && categories.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4">
          <button
            onClick={() => setSelectedCategory(undefined)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              !selectedCategory ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            }`}
          >
            전체
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedCategory(selectedCategory === c.id ? undefined : c.id)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                selectedCategory === c.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        {[undefined, "beginner", "intermediate", "advanced"].map((level) => (
          <button
            key={level ?? "all"}
            onClick={() => setSelectedLevel(level)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              selectedLevel === level ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            }`}
          >
            {level ? levelLabel[level] : "전체"}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="text-center py-10 text-muted-foreground text-sm">불러오는 중...</div>
      ) : !displayedVideos || displayedVideos.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground text-sm">
          {showRecOnly && recommendParts.length > 0 ? "오늘 부위에 딱 맞는 영상이 아직 없어요. 전체 영상을 둘러보세요." : "등록된 영상이 없습니다"}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {displayedVideos.map((v) => (
            <div
              key={v.id}
              className="bg-card border border-border rounded-xl overflow-hidden cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => navigate(`${base}/videos/${v.id}`)}
            >
              {v.thumbnailUrl ? (
                <img src={v.thumbnailUrl} alt={v.title} className="w-full aspect-video object-cover" />
              ) : (
                <div className="w-full aspect-video bg-muted flex items-center justify-center">
                  <span className="text-3xl">▶</span>
                </div>
              )}
              <div className="p-2 space-y-1">
                <p className="text-xs font-semibold line-clamp-2 leading-snug">{v.title}</p>
                <div className="flex items-center gap-1 flex-wrap">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${levelColor[v.level ?? "beginner"] ?? ""}`}>
                    {levelLabel[v.level ?? "beginner"] ?? v.level}
                  </span>
                  {v.bodyPart && (
                    <span className="text-[10px] text-muted-foreground">{v.bodyPart}</span>
                  )}
                </div>
                {v.duration && (
                  <p className="text-[10px] text-muted-foreground">{v.duration}분</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
