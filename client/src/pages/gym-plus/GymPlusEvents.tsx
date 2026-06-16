import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";

const eventTypeLabel: Record<string, string> = {
  notice: "공지",
  event: "이벤트",
  promotion: "프로모션",
};

const eventTypeStyle: Record<string, string> = {
  notice: "bg-blue-500/20 text-blue-600",
  event: "bg-green-500/20 text-green-600",
  promotion: "bg-orange-500/20 text-orange-600",
};

const eventTypeShort: Record<string, string> = {
  notice: "공",
  event: "이",
  promotion: "프",
};

export default function GymPlusEvents() {
  const [, navigate] = useLocation();
  const [filter, setFilter] = useState<string | undefined>();

  const { data: events, isLoading } = trpc.gymPlus.listEvents.useQuery(
    filter ? { eventType: filter } : {}
  );

  return (
    <div className="p-4 space-y-4">
      <h1 className="font-bold text-lg">이벤트 & 공지</h1>

      {/* 타입 필터 */}
      <div className="flex gap-2">
        {[undefined, "notice", "event", "promotion"].map((type) => (
          <button
            key={type ?? "all"}
            onClick={() => setFilter(type)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              filter === type ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            }`}
          >
            {type ? eventTypeLabel[type] : "전체"}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="text-center py-10 text-muted-foreground text-sm">불러오는 중...</div>
      ) : !events || events.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground text-sm">등록된 이벤트/공지가 없습니다</div>
      ) : (
        <div className="space-y-3">
          {events.map((e) => (
            <div
              key={e.id}
              className={`bg-card border rounded-xl p-4 cursor-pointer hover:border-primary/50 transition-colors ${
                e.isPinned ? "border-yellow-500/40 bg-yellow-500/5" : "border-border"
              }`}
              onClick={() => navigate(`/gym-plus/events/${e.id}`)}
            >
              <div className="flex items-start gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-xs font-bold ${eventTypeStyle[e.eventType ?? "notice"] ?? "bg-muted"}`}>
                  {eventTypeShort[e.eventType ?? "notice"] ?? "공"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {e.isPinned ? <span className="text-[9px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full font-medium">고정</span> : null}
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${eventTypeStyle[e.eventType ?? "notice"] ?? "bg-muted text-muted-foreground"}`}>
                      {eventTypeLabel[e.eventType ?? "notice"] ?? e.eventType}
                    </span>
                  </div>
                  <p className="font-semibold text-sm leading-snug line-clamp-2">{e.title}</p>
                  {e.startDate && e.endDate && (
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {e.startDate} ~ {e.endDate}
                    </p>
                  )}
                  <p className="text-[10px] text-muted-foreground mt-0.5">{e.createdAt?.slice(0, 10)}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
