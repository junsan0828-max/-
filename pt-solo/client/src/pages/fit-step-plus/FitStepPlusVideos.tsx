import { useState } from "react";
import { useLocation } from "wouter";
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
  const base = `/fit-step-plus/${trainerId}`;
  const [selectedCategory, setSelectedCategory] = useState<number | undefined>();
  const [selectedLevel, setSelectedLevel] = useState<string | undefined>();

  const { data: categories } = trpc.fitStepPlus.listVideoCategories.useQuery({ trainerId });
  const { data: videos, isLoading } = trpc.fitStepPlus.listVideos.useQuery({
    trainerId,
    categoryId: selectedCategory,
    level: selectedLevel,
  });

  return (
    <div className="p-4 space-y-4">
      <h1 className="font-bold text-lg">운동 영상</h1>

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
      ) : !videos || videos.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground text-sm">등록된 영상이 없습니다</div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {videos.map((v) => (
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
                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${levelColor[v.level ?? "beginner"] ?? ""}`}>
                    {levelLabel[v.level ?? "beginner"] ?? v.level}
                  </span>
                  {v.bodyPart && (
                    <span className="text-[9px] text-muted-foreground">{v.bodyPart}</span>
                  )}
                </div>
                {v.duration && (
                  <p className="text-[9px] text-muted-foreground">{v.duration}분</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
