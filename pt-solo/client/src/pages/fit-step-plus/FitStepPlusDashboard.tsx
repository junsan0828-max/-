import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

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
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
}

export default function FitStepPlusDashboard({ trainerId }: { trainerId: number }) {
  const [, navigate] = useLocation();
  const base = `/fit-step-plus/${trainerId}`;
  const utils = trpc.useUtils();
  const { data: member } = trpc.fitStepPlus.memberMe.useQuery();
  const { data: events } = trpc.fitStepPlus.listEvents.useQuery({ trainerId });
  const { data: videos } = trpc.fitStepPlus.listVideos.useQuery({ trainerId });
  const { data: logs } = trpc.fitStepPlus.listWorkoutLogs.useQuery({});

  const today = new Date().toISOString().slice(0, 10);
  const thisMonth = today.slice(0, 7);
  const { data: attendance } = trpc.fitStepPlus.member_getAttendance.useQuery({ month: thisMonth });
  const checkedInToday = attendance?.includes(today) ?? false;

  const checkInMutation = trpc.fitStepPlus.member_checkIn.useMutation({
    onSuccess: () => {
      toast.success("출석 체크 완료! 오늘도 화이팅 💪");
      utils.fitStepPlus.member_getAttendance.invalidate();
    },
    onError: (err) => {
      if (err.data?.code === "CONFLICT") toast.info("오늘 이미 출석 체크했습니다.");
      else toast.error(err.message || "출석 체크 실패");
    },
  });

  const todayLog = logs?.find((l) => l.logDate === today);
  const daysLeft = daysUntil(member?.membershipEnd);
  const pinnedEvents = events?.filter((e) => e.isPinned) ?? [];
  const latestEvents = events?.slice(0, 3) ?? [];
  const featuredVideos = videos?.slice(0, 4) ?? [];

  return (
    <div className="p-4 space-y-5">
      {/* 인사 카드 + 출석하기 버튼 */}
      <div className="bg-gradient-to-r from-primary/20 to-primary/5 rounded-2xl p-4 border border-primary/20 flex items-center justify-between">
        <div>
          <p className="text-muted-foreground text-xs mb-1">안녕하세요 👋</p>
          <p className="font-bold text-lg text-foreground">{member?.name ?? "회원"}님</p>
          {member?.membershipType && (
            <span className={`inline-block mt-2 text-xs px-2 py-0.5 rounded-full border ${membershipTypeColor[member.membershipType] ?? ""}`}>
              {membershipTypeLabel[member.membershipType] ?? member.membershipType}
            </span>
          )}
        </div>

        {checkedInToday ? (
          <div className="flex flex-col items-center gap-1 bg-green-500/20 border border-green-500/30 rounded-2xl px-4 py-3 min-w-[72px]">
            <span className="text-2xl">✅</span>
            <span className="text-[10px] text-green-400 font-semibold">출석완료</span>
          </div>
        ) : (
          <button
            onClick={() => checkInMutation.mutate()}
            disabled={checkInMutation.isPending}
            className="flex flex-col items-center gap-1 bg-primary rounded-2xl px-4 py-3 min-w-[72px] active:scale-95 transition-transform"
          >
            <span className="text-2xl">{checkInMutation.isPending ? "⏳" : "👋"}</span>
            <span className="text-[10px] text-primary-foreground font-bold">출석하기</span>
          </button>
        )}
      </div>

      {daysLeft !== null && (
        <div
          className={`rounded-xl p-4 border flex items-center justify-between cursor-pointer ${
            daysLeft <= 7 ? "bg-red-500/10 border-red-500/30" : "bg-card border-border"
          }`}
          onClick={() => navigate(`${base}/membership`)}
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

      <div
        className="bg-card rounded-xl p-4 border border-border cursor-pointer hover:border-primary/50 transition-colors"
        onClick={() => navigate(`${base}/workout`)}
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

      {pinnedEvents.length > 0 && (
        <div>
          <p className="font-semibold text-sm mb-2">📌 공지사항</p>
          <div className="space-y-2">
            {pinnedEvents.map((e) => (
              <div
                key={e.id}
                className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-3 cursor-pointer"
                onClick={() => navigate(`${base}/events/${e.id}`)}
              >
                <p className="text-sm font-medium text-foreground line-clamp-2">{e.title}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="font-semibold text-sm">추천 운동 영상</p>
          <button className="text-xs text-primary" onClick={() => navigate(`${base}/videos`)}>
            전체보기 →
          </button>
        </div>
        {featuredVideos.length === 0 ? (
          <p className="text-muted-foreground text-sm text-center py-4">등록된 영상이 없습니다</p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {featuredVideos.map((v) => (
              <div
                key={v.id}
                className="bg-card border border-border rounded-xl overflow-hidden cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => navigate(`${base}/videos/${v.id}`)}
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
                  {v.duration && <p className="text-[10px] text-muted-foreground mt-0.5">{v.duration}분</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="font-semibold text-sm">이벤트 & 공지</p>
          <button className="text-xs text-primary" onClick={() => navigate(`${base}/events`)}>
            전체보기 →
          </button>
        </div>
        <div className="space-y-2">
          {latestEvents.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-4">등록된 이벤트가 없습니다</p>
          ) : (
            latestEvents.map((e) => (
              <div
                key={e.id}
                className="bg-card border border-border rounded-xl p-3 flex items-center gap-3 cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => navigate(`${base}/events/${e.id}`)}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-sm ${
                  e.eventType === "event" ? "bg-green-500/20" :
                  e.eventType === "promotion" ? "bg-orange-500/20" : "bg-blue-500/20"
                }`}>
                  {e.eventType === "event" ? "🎉" : e.eventType === "promotion" ? "🎁" : "📢"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium line-clamp-1">{e.title}</p>
                  <p className="text-[10px] text-muted-foreground">{e.createdAt?.slice(0, 10)}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
