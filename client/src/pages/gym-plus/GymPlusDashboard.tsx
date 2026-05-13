import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";

const membershipTypeLabel: Record<string, string> = {
  general: "일반회원",
  premium: "프리미엄",
  vip: "VIP",
};

const membershipTypeColor: Record<string, string> = {
  general: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  premium: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
  vip: "bg-purple-500/10 text-purple-400 border-purple-500/30",
};

function daysUntil(dateStr: string | null | undefined) {
  if (!dateStr) return null;
  const diff = Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
  return diff;
}

export default function GymPlusDashboard() {
  const [, navigate] = useLocation();
  const { data: member } = trpc.gymPlus.memberMe.useQuery();
  const { data: events } = trpc.gymPlus.listEvents.useQuery({});
  const { data: categories } = trpc.gymPlus.listCategories.useQuery();
  const { data: allVideos } = trpc.gymPlus.listVideos.useQuery({});
  const { data: logs } = trpc.gymPlus.listWorkoutLogs.useQuery({});

  const today = new Date().toISOString().slice(0, 10);
  const todayLog = logs?.find((l) => l.logDate === today);
  const daysLeft = daysUntil(member?.membershipEnd);
  const latestEvents = events?.slice(0, 3) ?? [];

  // "기구 안내" 카테고리 찾기 (이름에 "기구" 포함)
  const equipmentCategory = categories?.find(c => c.name.includes("기구"));
  const equipmentVideos = equipmentCategory
    ? (allVideos ?? []).filter(v => v.categoryId === equipmentCategory.id).slice(0, 4)
    : (allVideos ?? []).slice(0, 4);

  return (
    <div className="p-4 space-y-5">

      {/* 이벤트/공지 최상단 배너 */}
      {latestEvents.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="font-semibold text-sm">이벤트 & 공지</p>
            <button className="text-xs text-primary" onClick={() => navigate("/gym-plus/events")}>전체보기 →</button>
          </div>
          <div className="space-y-2">
            {latestEvents.map((e) => (
              <div
                key={e.id}
                className="rounded-xl overflow-hidden cursor-pointer border border-border hover:border-primary/50 transition-colors"
                onClick={() => navigate(`/gym-plus/events/${e.id}`)}
              >
                {e.imageUrl && (
                  <img src={e.imageUrl} alt={e.title} className="w-full object-cover max-h-40" />
                )}
                <div className={`p-3 flex items-center gap-3 ${e.isPinned ? "bg-yellow-500/10" : "bg-card"}`}>
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-sm ${
                    e.eventType === "event" ? "bg-green-500/20" :
                    e.eventType === "promotion" ? "bg-orange-500/20" : "bg-blue-500/20"
                  }`}>
                    {e.eventType === "event" ? "🎉" : e.eventType === "promotion" ? "🎁" : "📢"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      {e.isPinned ? <span className="text-[9px] bg-yellow-500/20 text-yellow-400 px-1 rounded">고정</span> : null}
                      <p className="text-sm font-medium line-clamp-1">{e.title}</p>
                    </div>
                    <p className="text-[10px] text-muted-foreground">{e.createdAt?.slice(0, 10)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 회원 인사 */}
      <div className="bg-gradient-to-r from-primary/20 to-primary/5 rounded-2xl p-4 border border-primary/20">
        <p className="text-muted-foreground text-xs mb-1">안녕하세요 👋</p>
        <p className="font-bold text-lg text-foreground">{member?.name ?? "회원"}님</p>
        {member?.membershipType && (
          <span className={`inline-block mt-2 text-xs px-2 py-0.5 rounded-full border ${membershipTypeColor[member.membershipType] ?? ""}`}>
            {membershipTypeLabel[member.membershipType] ?? member.membershipType}
          </span>
        )}
      </div>

      {/* 회원권 D-day */}
      {daysLeft !== null && (
        <div
          className={`rounded-xl p-4 border flex items-center justify-between cursor-pointer ${
            daysLeft <= 7 ? "bg-red-500/10 border-red-500/30" : "bg-card border-border"
          }`}
          onClick={() => navigate("/gym-plus/membership")}
        >
          <div>
            <p className="text-xs text-muted-foreground">회원권 만료까지</p>
            <p className={`font-bold text-xl ${daysLeft <= 7 ? "text-red-400" : "text-foreground"}`}>
              {daysLeft > 0 ? `D-${daysLeft}` : daysLeft === 0 ? "오늘 만료" : "만료됨"}
            </p>
          </div>
          <span className="text-2xl">◈</span>
        </div>
      )}

      {/* 오늘 운동 */}
      <div
        className="bg-card rounded-xl p-4 border border-border cursor-pointer hover:border-primary/50 transition-colors"
        onClick={() => navigate("/gym-plus/workout")}
      >
        <div className="flex items-center justify-between mb-2">
          <p className="font-semibold text-sm">오늘의 운동</p>
          <span className="text-xs text-primary">기록하기 →</span>
        </div>
        {todayLog ? (
          <div>
            <p className="font-medium text-foreground">{todayLog.title || "운동 완료"}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {todayLog.durationMinutes ? `${todayLog.durationMinutes}분` : ""}
              {todayLog.durationMinutes && todayLog.caloriesBurned ? " · " : ""}
              {todayLog.caloriesBurned ? `${todayLog.caloriesBurned}kcal` : ""}
            </p>
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">아직 오늘 운동 기록이 없어요</p>
        )}
      </div>

      {/* 센터 기구 운동 안내 */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="font-semibold text-sm">센터 기구 운동 안내</p>
          <button className="text-xs text-primary" onClick={() => navigate("/gym-plus/videos")}>
            전체보기 →
          </button>
        </div>
        {equipmentVideos.length === 0 ? (
          <p className="text-muted-foreground text-sm text-center py-4">등록된 영상이 없습니다</p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {equipmentVideos.map((v) => (
              <div
                key={v.id}
                className="bg-card border border-border rounded-xl overflow-hidden cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => navigate(`/gym-plus/videos/${v.id}`)}
              >
                {v.thumbnailUrl ? (
                  <img src={v.thumbnailUrl} alt={v.title} className="w-full aspect-video object-cover" />
                ) : (
                  <div className="w-full aspect-video bg-muted flex items-center justify-center">
                    <span className="text-2xl">▶</span>
                  </div>
                )}
                <div className="p-2">
                  <p className="text-xs font-medium line-clamp-2">{v.title}</p>
                  {v.duration && <p className="text-[10px] text-muted-foreground mt-0.5">{v.duration}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
