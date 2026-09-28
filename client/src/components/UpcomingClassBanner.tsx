import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Bell, CheckCircle, XCircle } from "lucide-react";

function kstMinutesNow() {
  const utc = new Date();
  const kst = new Date(utc.getTime() + 9 * 60 * 60 * 1000);
  return kst.getUTCHours() * 60 + kst.getUTCMinutes();
}

function minutesUntil(timeStr: string) {
  const [h, m] = timeStr.split(":").map(Number);
  return h * 60 + m - kstMinutesNow();
}

export default function UpcomingClassBanner() {
  const utils = trpc.useUtils();
  const { data: upcoming } = trpc.schedules.todayUpcoming.useQuery(undefined, {
    refetchInterval: 30_000,
    staleTime: 0,
  });

  const updateStatus = trpc.schedules.updateStatus.useMutation({
    onSuccess: (_, vars) => {
      utils.schedules.todayUpcoming.invalidate();
      toast.success(vars.status === "done" ? "수업 완료 처리됨" : "수업 취소 처리됨");
    },
    onError: (e) => toast.error(e.message || "상태 변경 실패"),
  });

  if (!upcoming || upcoming.length === 0) return null;

  // -60 ~ +30분 범위의 수업만 표시
  const relevant = upcoming.filter(slot => {
    if (!slot.scheduledTime) return false;
    const diff = minutesUntil(slot.scheduledTime);
    return diff >= -60 && diff <= 30;
  });

  if (relevant.length === 0) return null;

  return (
    <div className="space-y-2">
      {relevant.map(slot => {
        const diff = minutesUntil(slot.scheduledTime!);
        const isOngoing = diff <= 0;
        const label = isOngoing
          ? `수업 진행 중 (${Math.abs(diff)}분 경과)`
          : diff === 0
          ? "지금 수업 시작"
          : `${diff}분 후 수업`;

        return (
          <div
            key={slot.id}
            className={`rounded-xl px-4 py-3 flex items-center gap-3 border ${
              isOngoing
                ? "bg-blue-500/15 border-blue-500/40"
                : "bg-amber-500/15 border-amber-500/40"
            }`}
          >
            <Bell className={`h-4 w-4 shrink-0 ${isOngoing ? "text-blue-400" : "text-amber-400"}`} />
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-semibold ${isOngoing ? "text-blue-300" : "text-amber-300"}`}>
                {isOngoing ? "🔵" : "🔔"} {label}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {slot.scheduledTime}
                {slot.memberName ? ` · ${slot.memberName}` : " · 고정 슬롯"}
                {slot.trainerName ? ` · ${slot.trainerName}` : ""}
                {slot.notes ? ` · ${slot.notes}` : ""}
              </p>
            </div>
            <div className="flex gap-1.5 shrink-0">
              <button
                onClick={() => updateStatus.mutate({ scheduleId: slot.id, status: "done" })}
                disabled={updateStatus.isPending}
                className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors font-medium disabled:opacity-50"
              >
                <CheckCircle className="h-3.5 w-3.5" />
                완료
              </button>
              <button
                onClick={() => updateStatus.mutate({ scheduleId: slot.id, status: "cancelled" })}
                disabled={updateStatus.isPending}
                className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors font-medium disabled:opacity-50"
              >
                <XCircle className="h-3.5 w-3.5" />
                취소
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
