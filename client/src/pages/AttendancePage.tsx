import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { CheckCircle, XCircle, Clock, ChevronRight, ChevronLeft } from "lucide-react";
import { ATTENDANCE_STATUS } from "@/lib/memberServices";

function todayStr() {
  return new Date().toISOString().split("T")[0];
}

function formatDateLabel(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return format(d, "yyyy. MM. dd. EEEE", { locale: ko });
}

function prevDay(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() - 1);
  return d.toISOString().split("T")[0];
}

function nextDay(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + 1);
  return d.toISOString().split("T")[0];
}

// 출석 상태 아이콘은 로컬에서만 필요
const STATUS_ICON = {
  attended:  CheckCircle,
  noshow:    XCircle,
  cancelled: Clock,
} as const;

export default function AttendancePage() {
  const [, setLocation] = useLocation();
  const [selectedDate, setSelectedDate] = useState(todayStr());

  const { data: members } = trpc.attendanceChecks.listByDate.useQuery({ date: selectedDate });
  const { data: recent } = trpc.attendanceChecks.recentSummary.useQuery();

  const total = members?.length ?? 0;
  const attended = members?.filter(m => m.check?.status === "attended").length ?? 0;
  const unchecked = members?.filter(m => !m.check).length ?? 0;

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold">출석 체크</h1>

      {/* 날짜 네비게이션 */}
      <div className="flex items-center gap-2 bg-card border border-border rounded-xl px-3 py-2.5">
        <button onClick={() => setSelectedDate(prevDay(selectedDate))} className="text-muted-foreground hover:text-foreground p-1">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button onClick={() => setSelectedDate(todayStr())} className="flex-1 text-sm font-semibold text-center text-foreground">
          {formatDateLabel(selectedDate)}
        </button>
        <button onClick={() => setSelectedDate(nextDay(selectedDate))} className="text-muted-foreground hover:text-foreground p-1">
          <ChevronRight className="h-4 w-4" />
        </button>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="w-px h-px opacity-0 absolute"
          id="date-picker"
        />
      </div>

      {/* 요약 통계 */}
      {total > 0 && (
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-card border border-border rounded-xl p-3 text-center">
            <div className="text-lg font-bold text-foreground">{total}</div>
            <div className="text-xs text-muted-foreground">전체</div>
          </div>
          <div className="bg-card border border-emerald-400/20 rounded-xl p-3 text-center">
            <div className="text-lg font-bold text-emerald-400">{attended}</div>
            <div className="text-xs text-muted-foreground">출석</div>
          </div>
          <div className="bg-card border border-border rounded-xl p-3 text-center">
            <div className="text-lg font-bold text-amber-400">{unchecked}</div>
            <div className="text-xs text-muted-foreground">미체크</div>
          </div>
        </div>
      )}

      {/* 회원 리스트 */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {!members?.length ? (
          <p className="text-center text-sm text-muted-foreground py-12">담당 활성 회원이 없습니다.</p>
        ) : (
          <div className="divide-y divide-border">
            {members.map((m) => {
              const st = (m.check?.status ?? null) as "attended" | "noshow" | "cancelled" | null;
              const cfg = st ? ATTENDANCE_STATUS[st] : null;
              const Icon = st ? STATUS_ICON[st] : null;

              return (
                <button
                  key={m.id}
                  onClick={() => setLocation(`/attendance/${m.id}?date=${selectedDate}`)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors text-left"
                >
                  {/* 아바타 */}
                  <div className={`h-9 w-9 shrink-0 rounded-full flex items-center justify-center text-sm font-bold ${
                    st ? `${cfg!.bg} ${cfg!.text}` : "bg-primary/20 text-primary"
                  }`}>
                    {m.name.charAt(0)}
                  </div>

                  {/* 이름 + 잔여 PT */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{m.name}</p>
                    {m.remainingSessions != null ? (
                      <p className="text-xs text-muted-foreground">잔여 PT {m.remainingSessions}회</p>
                    ) : (
                      <p className="text-xs text-muted-foreground/50">PT 없음</p>
                    )}
                  </div>

                  {/* 출석 상태 / 출석하기 */}
                  {cfg && Icon ? (
                    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${cfg.bg} ${cfg.text} border ${cfg.border}`}>
                      <Icon className="h-3.5 w-3.5" />
                      {cfg.label}
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 text-xs font-semibold text-primary bg-primary/10 border border-primary/20 px-2.5 py-1 rounded-full">
                      출석하기
                    </div>
                  )}

                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 최근 출석 기록 */}
      {recent && recent.length > 0 && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <p className="text-sm font-semibold text-foreground">최근 출석 기록</p>
          </div>
          <div className="divide-y divide-border">
            {recent.map((r) => (
              <button
                key={r.date}
                onClick={() => setSelectedDate(r.date)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors"
              >
                <p className="text-sm text-foreground">{formatDateLabel(r.date)}</p>
                <span className="text-sm font-bold text-primary">{r.count}명</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
