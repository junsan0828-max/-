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

function VideoCard({ v, onClick }: { v: any; onClick: () => void }) {
  return (
    <div
      className="bg-card border border-border rounded-xl overflow-hidden cursor-pointer hover:border-primary/50 transition-colors"
      onClick={onClick}
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
          {v.bodyPart && <span className="text-[9px] text-muted-foreground">{v.bodyPart}</span>}
        </div>
        {v.duration && <p className="text-[9px] text-muted-foreground">{v.duration}</p>}
      </div>
    </div>
  );
}

export default function GymPlusVideos() {
  const [, navigate] = useLocation();
  const [tab, setTab] = useState<"gym" | "custom">("gym");
  const [selectedCategory, setSelectedCategory] = useState<number | undefined>();
  const [selectedLevel, setSelectedLevel] = useState<string | undefined>();

  const { data: categories } = trpc.gymPlus.listVideoCategories.useQuery();
  const { data: videos, isLoading } = trpc.gymPlus.listVideos.useQuery({
    categoryId: selectedCategory,
    level: selectedLevel,
  });
  const { data: health } = trpc.gymPlus.getHealth.useQuery();
  const { data: todayRec } = trpc.gymPlus.getTodayRecommendations.useQuery();

  const allMissionsDone = !!(health?.height && health?.weight && health?.parqSubmittedAt && health?.bodyAnalysisRequested);
  const missionCount = [
    !!(health?.height && health?.weight),
    !!health?.parqSubmittedAt,
    !!health?.bodyAnalysisRequested,
  ].filter(Boolean).length;

  return (
    <div className="flex flex-col h-full">
      {/* 탭 헤더 */}
      <div className="flex border-b border-border bg-background sticky top-0 z-10">
        <button
          onClick={() => setTab("gym")}
          className={`flex-1 py-3 text-sm font-medium transition-colors ${
            tab === "gym" ? "text-primary border-b-2 border-primary" : "text-muted-foreground"
          }`}
        >
          자이언트짐 기구운동
        </button>
        <button
          onClick={() => setTab("custom")}
          className={`flex-1 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-1.5 ${
            tab === "custom" ? "text-primary border-b-2 border-primary" : "text-muted-foreground"
          }`}
        >
          맞춤운동
          {!allMissionsDone && (
            <span className="text-[9px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">{missionCount}/3</span>
          )}
        </button>
      </div>

      {/* 자이언트짐 기구운동 탭 */}
      {tab === "gym" && (
        <div className="p-4 space-y-4">
          {/* 카테고리 필터 */}
          {categories && categories.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4">
              <button
                onClick={() => setSelectedCategory(undefined)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  !selectedCategory ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                }`}
              >전체</button>
              {categories.map((c) => (
                <button key={c.id}
                  onClick={() => setSelectedCategory(selectedCategory === c.id ? undefined : c.id)}
                  className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    selectedCategory === c.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  }`}
                >{c.name}</button>
              ))}
            </div>
          )}

          {/* 난이도 필터 */}
          <div className="flex gap-2">
            {([undefined, "beginner", "intermediate", "advanced"] as const).map((level) => (
              <button key={level ?? "all"}
                onClick={() => setSelectedLevel(level)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  selectedLevel === level ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                }`}
              >{level ? levelLabel[level] : "전체"}</button>
            ))}
          </div>

          {/* 영상 목록 */}
          {isLoading ? (
            <div className="text-center py-10 text-muted-foreground text-sm">불러오는 중...</div>
          ) : !videos || videos.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-sm">등록된 영상이 없습니다</div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {videos.map((v) => (
                <VideoCard key={v.id} v={v} onClick={() => navigate(`/gym-plus/videos/${v.id}`)} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* 맞춤운동 탭 */}
      {tab === "custom" && (
        <div className="p-4">
          {!allMissionsDone ? (
            /* 잠금 상태 */
            <div className="space-y-4 pt-2">
              <div className="bg-card border border-border rounded-2xl p-6 flex flex-col items-center gap-3 text-center">
                <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center">
                  <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.8} stroke="currentColor" className="w-7 h-7 text-muted-foreground">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
                  </svg>
                </div>
                <p className="font-bold text-base">맞춤운동 잠금 중</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  내 정보 탭에서 미션 3가지를 완료하면<br />나에게 딱 맞는 맞춤 운동이 열립니다
                </p>
                <div className="w-full bg-muted rounded-full h-2 mt-1">
                  <div
                    className="bg-primary h-2 rounded-full transition-all"
                    style={{ width: `${(missionCount / 3) * 100}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">{missionCount}/3 미션 완료</p>
              </div>

              {/* 미션 진행 상태 */}
              <div className="space-y-2">
                {[
                  { label: "신체정보 입력", done: !!(health?.height && health?.weight) },
                  { label: "사전 건강검사 (PAR-Q)", done: !!health?.parqSubmittedAt },
                  { label: "체형분석 데이터 신청", done: !!health?.bodyAnalysisRequested },
                ].map((m) => (
                  <div key={m.label} className={`flex items-center gap-3 p-3 rounded-xl border ${m.done ? "border-green-500/30 bg-green-500/10" : "border-border bg-card"}`}>
                    <span className={`text-xs font-medium flex-1`}>{m.label}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${m.done ? "bg-green-500/20 text-green-400" : "bg-muted text-muted-foreground"}`}>
                      {m.done ? "완료" : "미완료"}
                    </span>
                  </div>
                ))}
              </div>

              <button
                className="w-full py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold"
                onClick={() => navigate("/gym-plus/profile")}
              >
                내 정보에서 미션 완료하기 →
              </button>
            </div>
          ) : (
            /* 잠금 해제 상태 */
            <div className="space-y-4">
              <div className="bg-gradient-to-r from-primary/20 to-primary/5 rounded-2xl p-4 border border-primary/20">
                <p className="text-[10px] text-primary/80 font-semibold tracking-widest uppercase mb-1">Personalized</p>
                <p className="font-bold text-base">나에게 맞는 운동</p>
                <p className="text-xs text-muted-foreground mt-1">신체정보와 건강데이터를 기반으로 선별된 운동 영상입니다</p>
              </div>

              {todayRec && todayRec.recommendedVideos.length > 0 ? (
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-muted-foreground">오늘의 추천 ({todayRec.recommendedVideos.length}개)</p>
                  <div className="grid grid-cols-2 gap-3">
                    {todayRec.recommendedVideos.map((v: any) => (
                      <VideoCard key={v.id} v={v} onClick={() => navigate(`/gym-plus/videos/${v.id}`)} />
                    ))}
                  </div>
                </div>
              ) : (
                <div className="bg-card border border-dashed border-border rounded-xl p-6 text-center space-y-2">
                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center mx-auto">
                    <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.8} stroke="currentColor" className="w-5 h-5 text-muted-foreground">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                    </svg>
                  </div>
                  <p className="text-sm font-medium">출석체크 후 추천 운동이 표시됩니다</p>
                  <p className="text-xs text-muted-foreground">홈에서 출석체크 후 오늘의 맞춤 운동을 확인하세요</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
