import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";

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

export default function GymPlusEventDetail({ eventId }: { eventId: number }) {
  const [, navigate] = useLocation();
  const { data: event, isLoading } = trpc.gymPlus.getEvent.useQuery({ id: eventId });

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

      {event.eventType === "points" && event.linkUrl && (
        <a
          href={event.linkUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full py-4 rounded-2xl bg-gradient-to-r from-purple-600 to-purple-500 text-white font-bold text-base shadow-lg active:opacity-80 transition-opacity"
        >
          <span className="text-lg">◈</span>
          포인트 적립
          <span className="text-sm opacity-80">→</span>
        </a>
      )}
    </div>
  );
}
