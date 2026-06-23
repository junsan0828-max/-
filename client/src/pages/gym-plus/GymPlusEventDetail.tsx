import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const eventTypeLabel: Record<string, string> = {
  notice: "공지",
  event: "이벤트",
  promotion: "프로모션",
  points: "포인트",
};

const eventTypeStyle: Record<string, string> = {
  notice: "bg-blue-500/20 text-blue-400",
  event: "bg-green-500/20 text-green-400",
  promotion: "bg-orange-500/20 text-orange-400",
  points: "bg-purple-500/20 text-purple-400",
};

const VISITED_KEY = (eventId: number) => `gp_visited_event_${eventId}`;

export default function GymPlusEventDetail({ eventId }: { eventId: number }) {
  const [, navigate] = useLocation();
  const { data: event, isLoading } = trpc.gymPlus.getEvent.useQuery({ id: eventId });
  const { data: myClaims, refetch: refetchClaims } = trpc.gymPlus.getMyPointClaims.useQuery();
  const utils = trpc.useUtils();

  // 블로그 방문 여부 (세션 스토리지 기반)
  const [visited, setVisited] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem(VISITED_KEY(eventId))) setVisited(true);
  }, [eventId]);

  const claimMutation = trpc.gymPlus.claimEventPoints.useMutation({
    onSuccess: () => {
      refetchClaims();
      utils.gymPlus.memberMe.invalidate();
      toast.success("적립 신청이 완료됐습니다. 확인 후 포인트가 지급됩니다.");
    },
    onError: (e) => toast.error(e.message),
  });

  const handleVisitBlog = () => {
    if (!event?.linkUrl) return;
    sessionStorage.setItem(VISITED_KEY(eventId), "1");
    setVisited(true);
    window.open(event.linkUrl, "_blank");
  };

  if (isLoading) {
    return <div className="p-4 text-center text-muted-foreground text-sm">불러오는 중...</div>;
  }
  if (!event) {
    return (
      <div className="p-4 text-center">
        <p className="text-muted-foreground text-sm mb-4">이벤트를 찾을 수 없습니다</p>
        <Button variant="ghost" size="sm" onClick={() => navigate("/gym-plus/events")}>목록으로</Button>
      </div>
    );
  }

  const isPointsEvent = event.eventType === "points";
  const existingClaim = myClaims?.find(c => c.eventId === eventId);
  const claimStatus = existingClaim?.status;

  return (
    <div className="p-4 space-y-4">
      <button
        className="text-sm text-muted-foreground flex items-center gap-1"
        onClick={() => navigate("/gym-plus/events")}
      >
        ← 이벤트 목록
      </button>

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${eventTypeStyle[event.eventType ?? "notice"] ?? "bg-muted text-muted-foreground"}`}>
            {eventTypeLabel[event.eventType ?? "notice"] ?? event.eventType}
          </span>
          {event.isPinned ? <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-medium">고정</span> : null}
          {isPointsEvent && (event.pointAmount ?? 0) > 0 && (
            <span className="text-xs bg-[#1D4ED8]/10 text-[#1D4ED8] px-2 py-0.5 rounded-full font-semibold">
              +{(event.pointAmount ?? 0).toLocaleString("ko-KR")}P
            </span>
          )}
        </div>
        <h1 className="font-bold text-xl leading-snug">{event.title}</h1>
        <p className="text-xs text-muted-foreground">{event.createdAt?.slice(0, 10)}</p>
        {event.startDate && event.endDate && (
          <p className="text-xs text-muted-foreground bg-muted px-3 py-1.5 rounded-lg inline-block">
            기간: {event.startDate} ~ {event.endDate}
          </p>
        )}
      </div>

      {event.imageUrl && (
        <img src={event.imageUrl} alt={event.title} className="w-full rounded-xl object-cover" />
      )}

      <div className="bg-card border border-border rounded-xl p-4">
        <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{event.content}</p>
      </div>

      {/* 포인트 이벤트 전용 영역 */}
      {isPointsEvent && event.linkUrl && (
        <div className="space-y-3">
          {/* 승인됨 */}
          {claimStatus === "approved" && (
            <div className="flex items-center gap-3 bg-green-500/10 border border-green-500/20 rounded-2xl px-5 py-4">
              <svg viewBox="0 0 24 24" fill="none" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-green-500 flex-shrink-0">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
              <div>
                <p className="text-sm font-semibold text-green-600">포인트 적립 완료</p>
                <p className="text-xs text-green-500 mt-0.5">+{(event.pointAmount ?? 0).toLocaleString("ko-KR")}P가 지급됐습니다</p>
              </div>
            </div>
          )}

          {/* 심사 중 */}
          {claimStatus === "pending" && (
            <div className="flex items-center gap-3 bg-muted border border-border rounded-2xl px-5 py-4">
              <svg viewBox="0 0 24 24" fill="none" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-muted-foreground flex-shrink-0">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
              <div>
                <p className="text-sm font-semibold text-foreground">적립 신청 완료</p>
                <p className="text-xs text-muted-foreground mt-0.5">확인 후 포인트가 지급됩니다</p>
              </div>
            </div>
          )}

          {/* 거절됨 */}
          {claimStatus === "rejected" && (
            <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/20 rounded-2xl px-5 py-4">
              <svg viewBox="0 0 24 24" fill="none" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-red-400 flex-shrink-0">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
              </svg>
              <div>
                <p className="text-sm font-semibold text-red-500">적립 반려됨</p>
                <p className="text-xs text-red-400 mt-0.5">블로그 댓글 확인 후 재신청해 주세요</p>
              </div>
            </div>
          )}

          {/* 미신청 상태 */}
          {!claimStatus && (
            !visited ? (
              /* 아직 블로그 미방문 → 적립하기 버튼 */
              <button
                onClick={handleVisitBlog}
                className="flex items-center justify-between w-full px-5 py-4 rounded-2xl bg-[#1D4ED8] text-white active:bg-[#1a44c2] transition-colors"
              >
                <div>
                  <p className="text-[11px] text-white/60 font-medium tracking-wide uppercase">Points</p>
                  <p className="text-[15px] font-bold mt-0.5">포인트 적립하기</p>
                </div>
                <svg viewBox="0 0 24 24" fill="none" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-white/70">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                </svg>
              </button>
            ) : (
              /* 블로그 방문 후 → 신청 버튼 */
              <div className="space-y-2">
                <div className="flex items-center gap-2 px-1">
                  <div className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
                  <p className="text-xs text-muted-foreground">블로그 방문 완료 · 댓글을 남기셨나요?</p>
                </div>
                <button
                  onClick={() => claimMutation.mutate({ eventId })}
                  disabled={claimMutation.isPending}
                  className="flex items-center justify-between w-full px-5 py-4 rounded-2xl bg-foreground text-background active:opacity-80 transition-opacity disabled:opacity-50"
                >
                  <div>
                    <p className="text-[11px] text-background/50 font-medium tracking-wide uppercase">포인트 신청</p>
                    <p className="text-[15px] font-bold mt-0.5">
                      {claimMutation.isPending ? "신청 중..." : "댓글 남겼어요, 적립 신청하기"}
                    </p>
                  </div>
                  <svg viewBox="0 0 24 24" fill="none" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-background/50">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                  </svg>
                </button>
                <button
                  onClick={handleVisitBlog}
                  className="text-xs text-muted-foreground w-full text-center py-1"
                >
                  블로그 다시 방문하기 →
                </button>
              </div>
            )
          )}

          {/* 거절 후 재신청 */}
          {claimStatus === "rejected" && (
            <button
              onClick={handleVisitBlog}
              className="flex items-center justify-between w-full px-5 py-4 rounded-2xl bg-[#1D4ED8] text-white active:bg-[#1a44c2] transition-colors"
            >
              <div>
                <p className="text-[11px] text-white/60 font-medium tracking-wide uppercase">Points</p>
                <p className="text-[15px] font-bold mt-0.5">포인트 적립하기</p>
              </div>
              <svg viewBox="0 0 24 24" fill="none" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-white/70">
                <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
              </svg>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
