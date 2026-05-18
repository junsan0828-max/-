import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { Search, ChevronRight, Dumbbell, Calendar } from "lucide-react";

export default function TrainingLog() {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const now = new Date();
  const [month, setMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);

  const { data: logs, isLoading } = trpc.trainingLog.listAll.useQuery({ month });
  const { data: members } = trpc.members.list.useQuery();

  const memberOptions = members ?? [];

  const filtered = (logs ?? []).filter(log => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (log.memberName ?? "").toLowerCase().includes(q) ||
      (log.bodyPart ?? "").toLowerCase().includes(q) ||
      (log.notes ?? "").toLowerCase().includes(q);
  });

  // 날짜별 그룹핑
  const grouped: Record<string, typeof filtered> = {};
  for (const log of filtered) {
    const date = log.sessionDate ?? log.createdAt.substring(0, 10);
    if (!grouped[date]) grouped[date] = [];
    grouped[date].push(log);
  }
  const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  const prevMonth = () => {
    const [y, m] = month.split("-").map(Number);
    if (m === 1) setMonth(`${y - 1}-12`);
    else setMonth(`${y}-${String(m - 1).padStart(2, "0")}`);
  };
  const nextMonth = () => {
    const [y, m] = month.split("-").map(Number);
    if (m === 12) setMonth(`${y + 1}-01`);
    else setMonth(`${y}-${String(m + 1).padStart(2, "0")}`);
  };

  const [y, m] = month.split("-").map(Number);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">트레이닝 일지</h1>
        <p className="text-sm text-muted-foreground mt-0.5">총 {logs?.length ?? 0}개 세션</p>
      </div>

      {/* 월 선택 */}
      <div className="flex items-center justify-center gap-3 bg-card border border-border rounded-xl px-4 py-3">
        <button onClick={prevMonth} className="text-muted-foreground hover:text-foreground px-2">‹</button>
        <span className="text-base font-semibold min-w-[100px] text-center">{y}년 {m}월</span>
        <button onClick={nextMonth} className="text-muted-foreground hover:text-foreground px-2">›</button>
      </div>

      {/* 검색 */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="회원명, 부위, 메모 검색..."
          className="w-full bg-card border border-border rounded-lg pl-9 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 rounded-lg bg-card border border-border animate-pulse" />
          ))}
        </div>
      ) : sortedDates.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Dumbbell className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">이 달 트레이닝 기록이 없습니다</p>
        </div>
      ) : (
        <div className="space-y-4">
          {sortedDates.map(date => (
            <div key={date}>
              {/* 날짜 헤더 */}
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-semibold text-muted-foreground">
                  {format(new Date(date), "M월 d일 (EEE)", { locale: ko })}
                </span>
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs text-muted-foreground">{grouped[date].length}건</span>
              </div>

              <div className="space-y-2">
                {grouped[date].map(log => {
                  let exercises: any[] = [];
                  try { exercises = log.exercisesJson ? JSON.parse(log.exercisesJson) : []; } catch {}

                  return (
                    <button
                      key={log.id}
                      onClick={() => setLocation(`/members/${log.memberId}`)}
                      className="w-full text-left bg-card border border-border rounded-xl p-4 hover:border-primary/40 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-sm">{log.memberName ?? "알 수 없음"}</span>
                            {log.bodyPart && (
                              <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">{log.bodyPart}</span>
                            )}
                          </div>
                          {exercises.length > 0 && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {exercises.slice(0, 3).map((e: any) => e.name).join(" · ")}
                              {exercises.length > 3 && ` 외 ${exercises.length - 3}개`}
                            </p>
                          )}
                          {log.notes && (
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{log.notes}</p>
                          )}
                          {log.goal && (
                            <p className="text-xs text-blue-400 mt-1 line-clamp-1">목표: {log.goal}</p>
                          )}
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
