import { useState, useMemo, Fragment, useRef, useCallback, useEffect } from "react";
import { trpc } from "../lib/trpc";
import { toast } from "sonner";
import { holidayName } from "../lib/holidays";
import { SKIP_REASON_LABEL } from "../lib/utils";
import { ChevronLeft, ChevronRight, Plus, X, Repeat, Trash2, CheckCircle2, RotateCcw, Package } from "lucide-react";

// 일요일 휴무 — 월~토만 운영한다.
const WEEKDAYS = ["월", "화", "수", "목", "금", "토"];
const SATURDAY = 5;          // WEEKDAYS 인덱스
const SATURDAY_CLOSE = 17;   // 토요일은 오후 5시까지

// 시간표에 깔 시간대. 06~23시.
const HOURS = Array.from({ length: 18 }, (_, i) => i + 6);

/** 그 요일·시간이 영업시간인가 */
function isOpen(weekday: number, hour: number) {
  if (weekday === SATURDAY) return hour < SATURDAY_CLOSE;
  return true;
}

function toYmd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** 그 날짜가 속한 주의 월요일 */
function mondayOf(d: Date) {
  const r = new Date(d);
  const dow = (r.getDay() + 6) % 7; // 월=0
  r.setDate(r.getDate() - dow);
  r.setHours(0, 0, 0, 0);
  return r;
}

/** "19:00" → 19 */
function hourOf(time: string | null) {
  if (!time) return null;
  const h = parseInt(time.slice(0, 2), 10);
  return isNaN(h) ? null : h;
}

type EventType = "pt" | "ballet" | "consultation" | "trial" | "meeting" | "other";

const EVENT_LABELS: Record<EventType, string> = {
  pt: "PT수업",
  ballet: "밸체",
  consultation: "상담",
  trial: "체험",
  meeting: "회의",
  other: "기타",
};

// grid cell colors: [filled bg+border, empty hover border]
const EVENT_COLORS: Record<EventType, { filled: string; empty: string }> = {
  pt:           { filled: "bg-slate-100/10 border-slate-300/35 hover:bg-slate-100/16 text-slate-100",  empty: "border-border/60 border-dashed hover:border-slate-300/40 hover:bg-slate-100/5" },
  ballet:       { filled: "bg-pink-500/20 border-pink-400/50 hover:bg-pink-500/30",           empty: "border-border/60 border-dashed hover:border-pink-500/50 hover:bg-pink-500/5" },
  consultation: { filled: "bg-emerald-500/20 border-emerald-400/50 hover:bg-emerald-500/30",  empty: "border-border/60 border-dashed hover:border-emerald-500/50 hover:bg-emerald-500/5" },
  trial:        { filled: "bg-amber-500/20 border-amber-400/50 hover:bg-amber-500/30",        empty: "border-border/60 border-dashed hover:border-amber-500/50 hover:bg-amber-500/5" },
  meeting:      { filled: "bg-sky-500/20 border-sky-400/50 hover:bg-sky-500/30",              empty: "border-border/60 border-dashed hover:border-sky-400/50 hover:bg-sky-500/5" },
  other:        { filled: "bg-orange-500/20 border-orange-400/50 hover:bg-orange-500/30",     empty: "border-border/60 border-dashed hover:border-orange-500/50 hover:bg-orange-500/5" },
};

// 어드민 전체보기: 트레이너별 색상 팔레트 (id 오름차순으로 순서 고정)
const TRAINER_PALETTE = [
  { cell: "bg-sky-500/20 border-sky-500/50 hover:bg-sky-500/30",         dot: "bg-sky-400" },
  { cell: "bg-emerald-500/20 border-emerald-500/50 hover:bg-emerald-500/30", dot: "bg-emerald-400" },
  { cell: "bg-amber-500/20 border-amber-500/50 hover:bg-amber-500/30",    dot: "bg-amber-400" },
  { cell: "bg-rose-500/20 border-rose-500/50 hover:bg-rose-500/30",       dot: "bg-rose-400" },
  { cell: "bg-violet-500/20 border-violet-500/50 hover:bg-violet-500/30", dot: "bg-violet-400" },
  { cell: "bg-pink-500/20 border-pink-500/50 hover:bg-pink-500/30",       dot: "bg-pink-400" },
  { cell: "bg-teal-500/20 border-teal-500/50 hover:bg-teal-500/30",       dot: "bg-teal-400" },
  { cell: "bg-orange-500/20 border-orange-500/50 hover:bg-orange-500/30", dot: "bg-orange-400" },
];

type Slot = {
  id: number;
  memberId: number | null;
  memberName: string | null;
  trainerId: number;
  trainerName: string | null;
  scheduledDate: string;
  scheduledTime: string | null;
  notes: string | null;
  status: string;
  isRecurring: number;
  branchId: number | null;
  eventType: EventType | null;
};

export default function SchedulePage() {
  const [weekStart, setWeekStart] = useState(() => mondayOf(new Date()));
  // trainerId: 전체보기에서 특정 카드를 눌렀으면 그 트레이너, null이면 새 일정(트레이너 선택 필요)
  const [editing, setEditing] = useState<{ weekday: number; hour: number; slotId?: number; trainerId?: number | null } | null>(null);
  // 관리자 전용: null = 전체 트레이너 보기
  const [trainerFilter, setTrainerFilter] = useState<number | null>(null);
  // 다음 스케줄 잡기에서 넘어온 회원 자동입력
  const [prefillMember, setPrefillMember] = useState<{ memberName: string; memberId: number | null } | null>(null);
  useEffect(() => {
    try {
      const raw = localStorage.getItem("scheduleFor");
      if (raw) { setPrefillMember(JSON.parse(raw)); localStorage.removeItem("scheduleFor"); }
    } catch {}
  }, []);

  const { data: access } = trpc.schedules.myAccess.useQuery();
  const isAdmin = access?.isAdmin ?? false;
  const { data: trainerOptions } = trpc.schedules.trainerOptions.useQuery(undefined, { enabled: isAdmin });
  const { data: branchList } = trpc.schedules.branches.useQuery();
  const viewingAll = isAdmin && trainerFilter === null;

  // branchId → 순서 인덱스 (0=기본 지점, 1=2호점 …)
  const branchIndexMap = useMemo(
    () => new Map((branchList ?? []).map((b, i) => [b.id, i])),
    [branchList]
  );

  const weekDates = useMemo(
    () => Array.from({ length: 6 }, (_, i) => {   // 월~토
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      return d;
    }),
    [weekStart]
  );
  const weekStartYmd = toYmd(weekDates[0]);
  // 조회 범위는 일요일까지 잡아둔다(일요일에 남아있던 예전 일정도 집계에서 빠지지 않도록).
  const weekEndYmd = useMemo(() => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 6);
    return toYmd(d);
  }, [weekStart]);

  const utils = trpc.useUtils();
  const { data: slots, isLoading } = trpc.schedules.listByWeek.useQuery({
    weekStart: weekStartYmd,
    weekEnd: weekEndYmd,
    ...(isAdmin ? { trainerId: trainerFilter } : {}),
  });

  const refresh = () => {
    utils.schedules.listByWeek.invalidate();
    utils.schedules.todayUpcoming.invalidate();
    utils.dashboard.getStats.invalidate();
    utils.dashboard.todayScheduleSummary.invalidate();
  };

  // ── 수업 이동 (Pick & Place) ────────────────────────────────────
  // 꾹 누르면(500ms) 선택 → 빈 칸 탭하면 이동
  const [dragSlotId, setDragSlotId] = useState<number | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pressStartPos = useRef<{ x: number; y: number } | null>(null);
  // 꾹 누른 뒤 손을 떼면 click이 따라오는데, 그 click이 이동모드를 바로 취소하지 않게 한 번 삼킨다
  const longPressFired = useRef(false);
  const swallowClick = () => {
    if (!longPressFired.current) return false;
    longPressFired.current = false;
    return true;
  };

  const moveMutation = trpc.schedules.update.useMutation({
    onSuccess: () => { toast.success("수업을 이동했습니다"); refresh(); },
    onError: e => toast.error(e.message),
  });

  const cancelMove = useCallback(() => {
    setDragSlotId(null);
    if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
    pressStartPos.current = null;
  }, []);

  const commitMove = useCallback((slotId: number, wd: number, h: number) => {
    const targetDate = toYmd(weekDates[wd]);
    const targetTime = `${String(h).padStart(2, "0")}:00`;
    moveMutation.mutate({ scheduleId: slotId, scheduledDate: targetDate, scheduledTime: targetTime });
    cancelMove();
  }, [weekDates, cancelMove, moveMutation]);

  const startLongPress = useCallback((slotId: number, x: number, y: number) => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    pressStartPos.current = { x, y };
    longPressTimer.current = setTimeout(() => {
      longPressFired.current = true;
      setDragSlotId(slotId);
      try { (navigator as any).vibrate?.(40); } catch {}
      longPressTimer.current = null;
    }, 500);
  }, []);

  const cancelLongPress = useCallback((x?: number, y?: number) => {
    if (!longPressTimer.current) return;
    // 10px 이상 이동 시 또는 손 뗄 때 취소
    if (x != null && y != null && pressStartPos.current) {
      const dx = x - pressStartPos.current.x;
      const dy = y - pressStartPos.current.y;
      if (Math.sqrt(dx * dx + dy * dy) < 10) return; // 미세 움직임은 무시
    }
    clearTimeout(longPressTimer.current);
    longPressTimer.current = null;
    pressStartPos.current = null;
  }, []);

  // 요일×시간 격자에 배치. 고정 슬롯은 시작일 이후의 모든 주에 같은 요일로 깔린다.
  const grid = useMemo(() => {
    const g: Record<string, Slot[]> = {};
    for (const s of (slots ?? []) as Slot[]) {
      const h = hourOf(s.scheduledTime);
      if (h == null) continue;
      const d = new Date(s.scheduledDate + "T00:00:00");
      const weekday = (d.getDay() + 6) % 7;
      const key = `${weekday}-${h}`;
      (g[key] ??= []).push(s);
    }
    // 같은 칸에 고정 슬롯과 실제 배정이 겹치면 실제 배정을 앞세운다.
    for (const k of Object.keys(g)) g[k].sort((a, b) => a.isRecurring - b.isRecurring);
    return g;
  }, [slots]);

  // 트레이너 id → 팔레트 인덱스 (id 오름차순, 안정적)
  const trainerColorMap = useMemo(() => {
    const sorted = [...(trainerOptions ?? [])].sort((a, b) => a.id - b.id);
    return new Map(sorted.map((t, i) => [t.id, i % TRAINER_PALETTE.length]));
  }, [trainerOptions]);

  const todayYmd = toYmd(new Date());
  const shiftWeek = (delta: number) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + delta * 7);
    setWeekStart(d);
  };

  // 실제로 수업이 있는 시간대만 보여주되, 최소 범위는 유지해 빈 시간표가 허전하지 않게 한다.
  const usedHours = new Set<number>();
  for (const key of Object.keys(grid)) usedHours.add(Number(key.split("-")[1]));
  const visibleHours = HOURS.filter(h => usedHours.has(h) || (h >= 9 && h <= 22));

  const weekStats = useMemo(() => {
    const all = (slots ?? []) as Slot[];
    const real = all.filter(s => s.isRecurring !== 1 || s.status === "done" || s.status === "cancelled" || s.status === "noshow");
    return {
      done: real.filter(s => s.status === "done").length,
      cancelled: real.filter(s => s.status === "cancelled").length,
      noshow: real.filter(s => s.status === "noshow").length,
      pending: real.filter(s => s.status === "pending").length,
    };
  }, [slots]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold">스케줄 관리</h1>
          <p className="text-xs text-muted-foreground">
            {weekStartYmd} ~ {weekEndYmd}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => shiftWeek(-1)} className="p-1.5 text-muted-foreground hover:text-foreground">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            onClick={() => setWeekStart(mondayOf(new Date()))}
            className="text-xs px-2 py-1 rounded-lg border border-border text-muted-foreground hover:text-foreground"
          >
            이번 주
          </button>
          <button onClick={() => shiftWeek(1)} className="p-1.5 text-muted-foreground hover:text-foreground">
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>

      {isAdmin && (
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setTrainerFilter(null)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
              trainerFilter === null
                ? "bg-accent border-border text-foreground font-medium"
                : "border-border/40 text-muted-foreground hover:text-foreground"
            }`}
          >
            전체
          </button>
          {[...(trainerOptions ?? [])].sort((a, b) => a.id - b.id).map(t => {
            const p = TRAINER_PALETTE[trainerColorMap.get(t.id) ?? 0];
            return (
              <button
                key={t.id}
                onClick={() => setTrainerFilter(t.id)}
                className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-colors ${
                  trainerFilter === t.id
                    ? "bg-accent border-border text-foreground font-medium"
                    : "border-border/40 text-muted-foreground hover:text-foreground"
                }`}
              >
                <span className={`w-2 h-2 rounded-full shrink-0 ${p.dot}`} />
                {t.trainerName}
              </button>
            );
          })}
        </div>
      )}

      {/* 주간 통계 */}
      <div className="flex gap-2">
        {[
          { label: "수업 완료", value: weekStats.done,      color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/25" },
          { label: "캔슬",     value: weekStats.cancelled,  color: "text-amber-400",   bg: "bg-amber-500/10 border-amber-500/25" },
          { label: "노쇼",     value: weekStats.noshow,     color: "text-rose-400",    bg: "bg-rose-500/10 border-rose-500/25" },
          { label: "예정",     value: weekStats.pending,    color: "text-sky-400",     bg: "bg-sky-500/10 border-sky-500/25" },
        ].map(s => (
          <div key={s.label} className={`flex-1 rounded-lg border px-3 py-2 ${s.bg}`}>
            <p className="text-[10px] text-muted-foreground">{s.label}</p>
            <p className={`text-lg font-bold leading-tight ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>
      {/* 캔슬·노쇼 정책 안내 */}
      <p className="text-[11px] text-muted-foreground/60 leading-relaxed -mt-1">
        캔슬(당일 취소) 차감 없음 · 노쇼 PT 1회 차감 · 24시간 전 취소는 삭제 처리 · 환불 요청 시 당일 취소 → 노쇼 전환
      </p>

      {/* 이동 모드 안내 배너 */}
      {dragSlotId != null && (
        <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-primary/15 border border-primary/30 text-xs text-primary">
          <span>이동할 빈 칸을 누르세요 — 카드를 다시 누르면 취소</span>
          <button onClick={cancelMove} className="text-muted-foreground hover:text-foreground px-2 py-0.5 rounded border border-border/40">취소</button>
        </div>
      )}

      {isLoading ? (
        <div className="text-center text-sm text-muted-foreground py-10">불러오는 중...</div>
      ) : (
        /* 단일 flat 그리드: overflow-auto + sticky로 요일헤더(위)·시간열(왼쪽) 고정 */
        <div
          className="overflow-auto rounded-lg"
          style={{ maxHeight: "calc(100dvh - 210px)" }}
        >
          <div
            className="grid"
            style={{
              gridTemplateColumns: "36px repeat(6, minmax(46px, 1fr))",
              gap: "3px",
            }}
          >
            {/* 좌상 코너 */}
            <div className="sticky top-0 left-0 z-30 bg-background" />

            {/* 요일 헤더 (sticky top) */}
            {weekDates.map((d, i) => {
              const ymd = toYmd(d);
              const isToday = ymd === todayYmd;
              const hol = holidayName(ymd);
              return (
                <div key={i} className="sticky top-0 z-20 bg-background pb-0.5">
                  <div className={`text-center text-xs py-1 rounded-lg ${
                    hol ? "bg-red-500/15 text-red-300 font-semibold"
                      : isToday ? "bg-primary/15 text-primary font-semibold"
                      : "text-muted-foreground"
                  }`}>
                    {WEEKDAYS[i]}
                    <span className="block text-[10px] opacity-70">{d.getDate()}</span>
                    {hol && <span className="block text-[9px] leading-tight truncate px-0.5">{hol}</span>}
                  </div>
                </div>
              );
            })}

            {/* 시간 행 */}
            {visibleHours.map(h => (
              <Fragment key={h}>
                {/* 시간 레이블 (sticky left) */}
                <div className="sticky left-0 z-10 bg-background text-[11px] text-muted-foreground text-right pr-1 pt-2 tabular-nums leading-none self-start">
                  {String(h).padStart(2, "0")}시
                </div>

                {weekDates.map((d, wd) => {
                  const cell = grid[`${wd}-${h}`] ?? [];
                  const top = cell[0];
                  const open = isOpen(wd, h);
                  const hol = holidayName(toYmd(d));

                  if (!open && !top) {
                    return <div key={wd} className="min-h-[42px] rounded-lg bg-muted/20 border border-border/30" />;
                  }

                  const isMoveActive = dragSlotId != null;

                  // 이동 모드: 빈 칸 → 이동 대상 표시 (viewingAll보다 먼저 체크해야 클릭 가능)
                  if (isMoveActive && !top && open && !hol) {
                    return (
                      <button
                        key={wd}
                        onClick={() => commitMove(dragSlotId!, wd, h)}
                        className="min-h-[42px] rounded-lg border-2 border-dashed border-primary/50 hover:border-primary hover:bg-primary/15 transition-colors cursor-pointer flex items-center justify-center"
                      >
                        <span className="text-[10px] text-primary/60 font-medium">여기로</span>
                      </button>
                    );
                  }

                  if (viewingAll && !top) {
                    return (
                      <button
                        key={wd}
                        onClick={() => setEditing({ weekday: wd, hour: h, trainerId: null })}
                        className={`min-h-[42px] rounded-lg border border-dashed flex items-center justify-center ${
                          hol ? "border-red-500/25 hover:border-red-500/50" : "border-border/30 hover:border-border/70 hover:bg-accent/30"
                        }`}
                      >
                        <Plus className="h-3 w-3 text-muted-foreground/30" />
                      </button>
                    );
                  }

                  const et = (top?.eventType ?? "pt") as EventType;
                  const colors = EVENT_COLORS[et] ?? EVENT_COLORS.pt;
                  const isDone = top?.status === "done";
                  // 트레이너가 배정된 슬롯은 항상 트레이너 색상 (고정/유동 무관)
                  const tColor = top?.trainerId != null
                    ? TRAINER_PALETTE[trainerColorMap.get(top.trainerId) ?? 0]
                    : null;

                  const isSelected = top != null && dragSlotId === top.id;

                  // 전체보기: 트레이너마다 one-off가 있으면 recurring template 제거(Set 기반 dedup)
                  // 다른 트레이너의 슬롯은 반드시 모두 표시한다.
                  // cell은 이미 isRecurring 오름차순(one-off 먼저) 정렬되어 있어 첫 hit만 남기면 됨.
                  const _seenKey = new Set<string>();
                  const visible = cell.filter(s => {
                    const key = `${s.trainerId ?? "none"}-${s.scheduledTime ?? ""}`;
                    if (_seenKey.has(key)) return false;
                    _seenKey.add(key);
                    return true;
                  });

                  // 관리자·FC 전체보기, 또는 한 칸에 여러 수업: 카드마다 따로 보여주고 따로 누르고 따로 옮긴다
                  if (viewingAll || visible.length > 1) {
                    return (
                      <div key={wd} className="min-h-[42px] rounded-lg flex flex-col gap-[3px]">
                        {visible.map(s => {
                          const p = TRAINER_PALETTE[trainerColorMap.get(s.trainerId) ?? 0];
                          const sEt = (s.eventType ?? "pt") as EventType;
                          const sDone = s.status === "done";
                          const sSelected = dragSlotId === s.id;
                          return (
                            <button
                              key={s.id}
                              onPointerDown={e => {
                                if (sDone || isMoveActive) return;
                                startLongPress(s.id, e.clientX, e.clientY);
                              }}
                              onPointerMove={e => cancelLongPress(e.clientX, e.clientY)}
                              onPointerUp={() => cancelLongPress()}
                              onPointerCancel={() => cancelLongPress()}
                              onContextMenu={e => e.preventDefault()}
                              onClick={() => {
                                if (swallowClick()) return;
                                if (sSelected) { cancelMove(); return; }
                                if (isMoveActive) { commitMove(dragSlotId!, wd, h); return; }
                                setEditing({ weekday: wd, hour: h, slotId: s.id, trainerId: s.trainerId });
                              }}
                              className={`relative w-full rounded-lg border px-1 py-1 text-left text-[11px] leading-tight transition-all select-none ${
                                sSelected ? "ring-2 ring-primary border-primary/60 opacity-70 scale-95"
                                : s.status === "noshow" ? "bg-rose-950/50 border-rose-700/40 text-rose-200/70"
                                : sDone ? "bg-emerald-950/50 border-emerald-700/40 text-emerald-100/80"
                                : p.cell
                              }`}
                            >
                              {sDone && <CheckCircle2 className="h-2.5 w-2.5 absolute top-1 right-1 text-emerald-400/70" />}
                              {viewingAll && (
                                <span className="block truncate text-[10px] text-amber-300/90">{s.trainerName ?? "담당없음"}</span>
                              )}
                              {sEt !== "pt" && <span className="block text-[9px] opacity-60 font-medium">{EVENT_LABELS[sEt]}</span>}
                              <span className="font-medium flex items-baseline gap-0.5 min-w-0">
                                <span className="block truncate">{s.memberName ?? s.notes ?? "미배정"}</span>
                                {(() => { const bi = s.branchId != null ? (branchIndexMap.get(s.branchId) ?? 0) : 0; return bi > 0 ? <span className="text-[9px] text-orange-300/80 font-bold shrink-0">{bi + 1}</span> : null; })()}
                              </span>
                              <span className="opacity-70 flex items-center gap-0.5">
                                {s.scheduledTime}
                                {s.isRecurring === 1 && <Repeat className="h-2.5 w-2.5" />}
                              </span>
                            </button>
                          );
                        })}
                        {/* 같은 시간에 다른 트레이너 일정 추가 */}
                        {viewingAll && !isMoveActive && open && (
                          <button
                            onClick={() => setEditing({ weekday: wd, hour: h, trainerId: null })}
                            className="rounded border border-dashed border-border/30 hover:border-border/70 flex items-center justify-center py-0.5"
                          >
                            <Plus className="h-2.5 w-2.5 text-muted-foreground/40" />
                          </button>
                        )}
                      </div>
                    );
                  }

                  return (
                    <button
                      key={wd}
                      onPointerDown={e => {
                        if (!top || isDone || isMoveActive) return;
                        startLongPress(top.id, e.clientX, e.clientY);
                      }}
                      onPointerMove={e => cancelLongPress(e.clientX, e.clientY)}
                      onPointerUp={() => cancelLongPress()}
                      onPointerCancel={() => cancelLongPress()}
                      onContextMenu={e => e.preventDefault()}
                      onClick={() => {
                        if (swallowClick()) return;
                        if (isSelected) { cancelMove(); return; }
                        if (isMoveActive && top) { commitMove(dragSlotId!, wd, h); return; }
                        if (!isMoveActive) setEditing({ weekday: wd, hour: h });
                      }}
                      className={`min-h-[42px] rounded-lg border text-[11px] px-1 py-1 text-left transition-all relative select-none ${
                        isSelected
                          ? "ring-2 ring-primary border-primary/60 opacity-70 scale-95"
                          : top
                            ? top.status === "noshow"
                              ? "bg-rose-950/50 border-rose-700/40 text-rose-200/70"
                              : isDone
                              ? "bg-emerald-950/50 border-emerald-700/40 text-emerald-100/80"
                              : tColor
                                ? tColor.cell
                                : colors.filled
                            : hol
                              ? "border-red-500/25 border-dashed hover:border-red-500/50 hover:bg-red-500/5"
                              : colors.empty
                      }`}
                    >
                      {top ? (
                        <>
                          {isDone && (
                            <CheckCircle2 className="h-2.5 w-2.5 absolute top-1 right-1 text-emerald-400/70" />
                          )}
                          {viewingAll && (
                            <span className="block truncate text-[10px] text-amber-300/90">
                              {top.trainerName ?? "담당없음"}
                            </span>
                          )}
                          {et !== "pt" && (
                            <span className="block text-[9px] opacity-60 font-medium">
                              {EVENT_LABELS[et]}
                            </span>
                          )}
                          {/* 회의 유형에서 회원이 없으면 이름 행 생략 — 위 뱃지로 충분 */}
                          {(top.memberName || et !== "meeting") && (() => {
                            const bIdx = top.branchId != null ? (branchIndexMap.get(top.branchId) ?? 0) : 0;
                            return (
                              <span className="font-medium flex items-baseline gap-0.5 min-w-0">
                                <span className="truncate">{top.memberName ?? top.notes ?? "미배정"}</span>
                                {bIdx > 0 && (
                                  <span className="text-[9px] text-orange-300/80 font-bold shrink-0 leading-none">{bIdx + 1}</span>
                                )}
                              </span>
                            );
                          })()}
                          <span className="opacity-70 flex items-center gap-0.5">
                            {top.scheduledTime}
                            {top.isRecurring === 1 && <Repeat className="h-2.5 w-2.5" />}
                          </span>
                        </>
                      ) : (
                        <Plus className="h-3 w-3 text-muted-foreground/40" />
                      )}
                    </button>
                  );
                })}
              </Fragment>
            ))}
          </div>
        </div>
      )}

      {/* 다음 스케줄 잡기에서 넘어온 경우: 회원 자동입력 안내 배너 */}
      {prefillMember && !editing && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-40 bg-primary text-primary-foreground text-xs font-medium px-4 py-2 rounded-full shadow-lg whitespace-nowrap">
          {prefillMember.memberName} — 시간을 탭해 스케줄 추가
        </div>
      )}

      {editing && (() => {
        const all = grid[`${editing.weekday}-${editing.hour}`] ?? [];
        const picked = editing.slotId != null ? all.find(s => s.id === editing.slotId) : undefined;
        // 카드를 골랐으면 그 일정(+그것이 덮은 고정 템플릿)만, 새 일정이면 빈 칸으로 연다
        const cell = picked
          ? all.filter(s => s.id === picked.id || (s.trainerId === picked.trainerId && s.scheduledTime === picked.scheduledTime))
          : editing.trainerId === null ? [] : all;
        const targeted = editing.trainerId !== undefined;
        return (
        <SlotEditor
          key={`${editing.weekday}-${editing.hour}-${editing.slotId ?? "new"}`}
          cell={cell}
          date={toYmd(weekDates[editing.weekday])}
          hour={editing.hour}
          viewingAll={targeted ? false : viewingAll}
          trainerId={targeted ? (editing.trainerId ?? null) : trainerFilter}
          trainerOptions={isAdmin ? [...(trainerOptions ?? [])].sort((a, b) => a.id - b.id) : []}
          branchList={branchList ?? []}
          prefillMember={prefillMember}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); setPrefillMember(null); refresh(); }}
        />
        );
      })()}
    </div>
  );
}

function SlotEditor({ cell, date, hour, viewingAll, trainerId, trainerOptions = [], branchList, prefillMember, onClose, onSaved }: {
  cell: Slot[];
  date: string;
  hour: number;
  viewingAll: boolean;
  trainerId: number | null;
  trainerOptions?: { id: number; trainerName: string | null }[];
  branchList: { id: number; name: string }[];
  prefillMember?: { memberName: string; memberId: number | null } | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  // 이 칸의 구성: 고정 슬롯(템플릿)과 이 날짜에 실제로 배정된 수업은 별개다.
  const fixed = cell.find(s => s.isRecurring === 1) ?? null;
  const oneOff = cell.find(s => s.isRecurring === 0 && s.scheduledDate === date) ?? null;

  // 고정 수업은 항상 템플릿을 직접 수정한다 (이 주만 배정 모드 제거)
  const target = oneOff ?? fixed ?? null;
  const isNew = !target;
  const assigningToFixed = false; // 레거시 참조 호환용

  // 관리자·FC가 전체보기 빈 칸에서 새로 만들 때는 트레이너를 직접 고른다
  const needsTrainerPick = isNew && !trainerId && trainerOptions.length > 0;
  const [pickedTrainerId, setPickedTrainerId] = useState<number | null>(trainerId);
  const effTrainerId = pickedTrainerId ?? target?.trainerId ?? null;

  // 지점: 저장된 값 → localStorage 마지막값 → 첫 번째 지점(기본)
  const defaultBranchId = (() => {
    if (target?.branchId) return target.branchId;
    try { const v = localStorage.getItem("lastBranchId"); if (v) return Number(v); } catch {}
    return branchList[0]?.id ?? null;
  })();

  // 신규 수업이면 prefillMember 사용, 기존 수업이면 target 값 사용
  const [memberId, setMemberId] = useState<number | null>(
    target?.memberId ?? (isNew ? (prefillMember?.memberId ?? null) : null)
  );
  const [memberInput, setMemberInput] = useState(
    target?.memberName ?? (isNew ? (prefillMember?.memberName ?? "") : "")
  );
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [time, setTime] = useState(
    target?.scheduledTime ?? fixed?.scheduledTime ?? `${String(hour).padStart(2, "0")}:00`
  );
  const [isRecurring, setIsRecurring] = useState((target?.isRecurring ?? 0) === 1);
  const [eventType, setEventType] = useState<EventType>((target?.eventType ?? "pt") as EventType);
  const [selectedBranchId, setSelectedBranchId] = useState<number | null>(defaultBranchId);
  const [notes, setNotes] = useState(target?.notes ?? "");
  const [editingFixed, setEditingFixed] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState<"none" | "one" | "future" | "all">("none");

  const { data: memberList } = trpc.members.list.useQuery(undefined, { enabled: !viewingAll });
  const { data: memberSummary } = trpc.schedules.memberSummary.useQuery(
    { memberId: memberId! },
    { enabled: !!memberId }
  );

  const suggestions = memberInput.trim().length >= 1
    ? (memberList ?? []).filter((m: any) =>
        m.name.includes(memberInput.trim()) || m.name.replace(/\s/g, "").includes(memberInput.trim().replace(/\s/g, ""))
      ).slice(0, 6)
    : [];

  const handleMemberInput = (val: string) => {
    setMemberInput(val);
    setMemberId(null);
    setShowSuggestions(true);
  };

  const selectSuggestion = (m: any) => {
    setMemberId(m.id);
    setMemberInput(m.name);
    setShowSuggestions(false);
  };

  const createMutation = trpc.schedules.create.useMutation({
    onSuccess: (_data, variables) => {
      const lbl = EVENT_LABELS[variables.eventType ?? "pt"];
      if (variables.status === "cancelled") toast.success("이 일정이 취소됐습니다");
      else toast.success(`${lbl}이 추가되었습니다`);
      onSaved();
    },
    onError: e => toast.error(e.message),
  });
  const updateMutation = trpc.schedules.update.useMutation({
    onSuccess: () => { toast.success("수정되었습니다"); onSaved(); },
    onError: e => toast.error(e.message),
  });
  const deleteMutation = trpc.schedules.delete.useMutation({
    onSuccess: () => { toast.success("삭제되었습니다"); onSaved(); },
    onError: e => toast.error(e.message),
  });
  const cancelCompletionMutation = trpc.schedules.cancelCompletion.useMutation({
    onSuccess: () => { toast.success("완료 취소 — 회차가 복구되었습니다"); onSaved(); },
    onError: e => toast.error(e.message),
  });
  const reportDeduct = (label: string, res: { sessionResult?: { remaining: number } | null; skipReason?: string | null }) => {
    if (res.sessionResult) toast.success(`${label} — PT 1회 차감 (잔여 ${res.sessionResult.remaining}회)`);
    else if (res.skipReason) toast.warning(`${label} 처리됐지만 PT 차감 안 됨: ${SKIP_REASON_LABEL[res.skipReason] ?? res.skipReason}`, { duration: 8000 });
    else toast.success(`${label} 처리됨 (PT 수업 아님 — 차감 없음)`);
  };
  const retryDeductMutation = trpc.schedules.retryDeduct.useMutation({
    onSuccess: (res) => {
      if (res.sessionResult) toast.success(`PT 1회 차감 반영 (잔여 ${res.sessionResult.remaining}회)`);
      else if (res.skipReason === "duplicate") toast.success("이미 차감돼 있습니다 — 추가 차감 없음");
      else toast.warning(`차감 안 됨: ${SKIP_REASON_LABEL[res.skipReason ?? ""] ?? res.skipReason}`, { duration: 8000 });
      onSaved();
    },
    onError: e => toast.error(e.message),
  });
  const checkPastMutation = trpc.schedules.completeWithSignature.useMutation({
    onSuccess: (res) => { reportDeduct("수업 체크", res); onSaved(); },
    onError: e => toast.error(e.message),
  });
  const noShowMutation = trpc.schedules.markNoShow.useMutation({
    onSuccess: (res) => { reportDeduct("노쇼", res); onSaved(); },
    onError: e => toast.error(e.message),
  });
  // 고정 슬롯(assigningToFixed) + 과거 시간: 생성 후 즉시 완료/노쇼 처리
  const createThenCheckMutation = trpc.schedules.create.useMutation({
    onSuccess: (res) => { checkPastMutation.mutate({ scheduleId: res.id, sessionDate: date }); },
    onError: e => toast.error(e.message),
  });
  const createThenNoShowMutation = trpc.schedules.create.useMutation({
    onSuccess: (res) => { noShowMutation.mutate({ scheduleId: res.id, sessionDate: date }); },
    onError: e => toast.error(e.message),
  });

  const checkPastFixed = (mode: "done" | "noshow") => {
    const label = mode === "done" ? "완료" : "노쇼";
    const deductMsg = mode === "done" ? "PT 세션 1회가 차감됩니다." : "노쇼 처리되며 PT 세션 1회가 차감됩니다.";
    if (!confirm(`${date} ${time} 수업을 ${label} 처리합니다. ${deductMsg}`)) return;
    const freeText = !memberId && memberInput.trim() ? memberInput.trim() : undefined;
    const payload = {
      memberId, memberName: freeText,
      scheduledDate: date, scheduledTime: time,
      notes: notes || undefined,
      isRecurring: false,
      eventType,
      branchId: selectedBranchId ?? undefined,
      ...(effTrainerId ? { trainerId: effTrainerId } : {}),
    };
    if (mode === "done") createThenCheckMutation.mutate(payload);
    else createThenNoShowMutation.mutate(payload);
  };

  const busy = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending || cancelCompletionMutation.isPending || checkPastMutation.isPending || noShowMutation.isPending || createThenCheckMutation.isPending || createThenNoShowMutation.isPending;
  // 삭제 버튼은 삭제/취소 관련 mutation이 진행 중일 때만 막음 (저장 중에는 삭제 가능)
  const deleteBusy = deleteMutation.isPending || createMutation.isPending;

  const save = () => {
    // 시간을 직접 고쳐서 영업시간 밖으로 나가는 것도 막는다(칸 잠금만으론 못 막힘).
    const d = new Date(date + "T00:00:00");
    const wd = (d.getDay() + 6) % 7;
    if (wd > SATURDAY) { toast.error("일요일은 휴무입니다."); return; }
    if (!isOpen(wd, parseInt(time.slice(0, 2), 10))) {
      toast.error(`토요일은 ${SATURDAY_CLOSE}시까지만 운영합니다.`);
      return;
    }
    const freeText = !memberId && memberInput.trim() ? memberInput.trim() : undefined;
    // localStorage에 마지막 선택 지점 저장
    try { if (selectedBranchId) localStorage.setItem("lastBranchId", String(selectedBranchId)); } catch {}
    if (needsTrainerPick && !pickedTrainerId) { toast.error("담당 트레이너를 선택해 주세요."); return; }
    if (isNew) {
      createMutation.mutate({
        memberId, memberName: freeText,
        scheduledDate: date, scheduledTime: time,
        notes: notes || undefined,
        isRecurring: assigningToFixed ? false : isRecurring,
        eventType,
        branchId: selectedBranchId ?? undefined,
        ...(effTrainerId ? { trainerId: effTrainerId } : {}),
      });
    } else {
      updateMutation.mutate({
        scheduleId: target!.id, memberId, memberName: freeText ?? null,
        scheduledTime: time, notes: notes || null, isRecurring, eventType,
        branchId: selectedBranchId,
      });
    }
  };

  const holiday = holidayName(date);

  // 전체 트레이너 보기: 어느 트레이너 일정인지 정할 수 없으므로 읽기 전용으로 보여준다.
  if (viewingAll) {
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
        <div className="bg-card border border-border rounded-t-2xl sm:rounded-xl w-full max-w-sm p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm">{date} {String(hour).padStart(2, "0")}시</h3>
            <button onClick={onClose}><X className="h-4 w-4 text-muted-foreground" /></button>
          </div>
          {holiday && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-3 py-2 text-xs text-red-300">
              {holiday} — 공휴일
            </div>
          )}
          {cell.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2">이 시간에 잡힌 수업이 없습니다.</p>
          ) : (
            <div className="space-y-2">
              {cell.map(s => (
                <div key={s.id} className="rounded-lg border border-border bg-background/40 px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-amber-300">{s.trainerName ?? "담당없음"}</span>
                    <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                      {s.scheduledTime}
                      {s.isRecurring === 1 && <Repeat className="h-3 w-3" />}
                    </span>
                  </div>
                  <div className="text-sm font-medium mt-0.5">{s.memberName ?? "회원 미배정"}</div>
                  {s.notes && <div className="text-[11px] text-muted-foreground mt-0.5">{s.notes}</div>}
                </div>
              ))}
            </div>
          )}
          <p className="text-[11px] text-muted-foreground">
            고치려면 위에서 트레이너를 골라 주세요.
          </p>
          <button onClick={onClose} className="w-full py-2 rounded-lg border border-border text-sm text-muted-foreground">
            닫기
          </button>
        </div>
      </div>
    );
  }

  const title = isNew ? `${EVENT_LABELS[eventType]} 추가` : `${EVENT_LABELS[eventType]} 수정`;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); if (!busy) save(); } }}>
      <div className="bg-card border border-border rounded-t-2xl sm:rounded-xl w-full max-w-sm p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm">{title}</h3>
          <button onClick={onClose}><X className="h-4 w-4 text-muted-foreground" /></button>
        </div>

        <p className="text-xs text-muted-foreground">{date}</p>

        {/* 일정 유형 선택 */}
        <div className="flex gap-1 flex-wrap">
          {(Object.keys(EVENT_LABELS) as EventType[]).map(t => (
            <button
              key={t}
              type="button"
              onClick={() => setEventType(t)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                eventType === t
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {EVENT_LABELS[t]}
            </button>
          ))}
        </div>

        {/* 담당 트레이너: 새로 만들 땐 고르고, 기존 일정은 누구 것인지 보여준다 */}
        {needsTrainerPick ? (
          <div className="flex items-start gap-2">
            <span className="text-xs text-muted-foreground shrink-0 pt-1">트레이너</span>
            <div className="flex gap-1 flex-wrap">
              {trainerOptions.map(t => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setPickedTrainerId(t.id)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                    pickedTrainerId === t.id ? "bg-amber-500/80 text-white" : "bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t.trainerName}
                </button>
              ))}
            </div>
          </div>
        ) : trainerOptions.length > 0 && target?.trainerName ? (
          <p className="text-xs text-amber-300/90">담당: {target.trainerName}</p>
        ) : null}

        {/* 지점 선택 — 지점이 2개 이상일 때만 표시 */}
        {branchList.length > 1 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground shrink-0">지점</span>
            <div className="flex gap-1">
              {branchList.map(b => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => setSelectedBranchId(b.id)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                    selectedBranchId === b.id
                      ? "bg-orange-500/80 text-white"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {b.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {holiday && (
          <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-3 py-2 text-xs text-red-300">
            {holiday} — 공휴일입니다. 수업을 잡을 수는 있지만 휴관 여부를 확인하세요.
          </div>
        )}

        {/* 완료 상태 알림 */}
        {target?.status === "done" && (
          <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 px-3 py-2 text-xs text-emerald-300 flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
              수업 완료됨
            </span>
            {target.isRecurring !== 1 && (eventType === "pt") && (
              <button
                type="button"
                onClick={() => retryDeductMutation.mutate({ scheduleId: target.id })}
                disabled={busy || retryDeductMutation.isPending}
                className="ml-auto px-2 py-0.5 rounded-md bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 transition-colors disabled:opacity-50"
              >
                차감 확인
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                if (confirm("완료를 취소하면 PT 세션 1회가 복구됩니다. 진행할까요?")) {
                  cancelCompletionMutation.mutate({ scheduleId: target.id });
                }
              }}
              disabled={busy}
              className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 transition-colors disabled:opacity-50"
            >
              <RotateCcw className="h-3 w-3" />
              완료 취소
            </button>
          </div>
        )}

        {/* 지나간 수업 미체크 — 수업체크 / 노쇼 / 캔슬 버튼
            반복 수업은 이번 주 날짜(date/time)로 과거 여부 판단, one-off 생성으로 처리.
            일반 수업은 target 날짜로 판단, target.id 직접 수정. */}
        {target && !["done","noshow","cancelled"].includes(target.status) && (() => {
          const now = new Date();
          const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
          const nowTimeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
          // 반복 수업은 템플릿 생성일이 아닌 이번 주 수업 날짜/시간으로 판단
          const checkDate = target.isRecurring === 1 ? date : target.scheduledDate;
          const checkTime = target.isRecurring === 1 ? time : (target.scheduledTime ?? "99:00");
          return checkDate < todayStr || (checkDate === todayStr && checkTime <= nowTimeStr);
        })() && (
          <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 px-3 py-2 text-xs text-amber-300 space-y-2">
            <span className="font-medium">지나간 수업 — 처리 선택</span>
            <div className="flex gap-1.5">
              <button type="button" disabled={busy}
                onClick={() => {
                  if (target.isRecurring === 1) {
                    checkPastFixed("done");
                  } else {
                    if (confirm(`${target.scheduledDate} 수업을 완료 처리합니다. PT 세션 1회가 차감됩니다.`))
                      checkPastMutation.mutate({ scheduleId: target.id, sessionDate: target.scheduledDate });
                  }
                }}
                className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-md bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 font-medium transition-colors disabled:opacity-50">
                <CheckCircle2 className="h-3 w-3" /> 수업 체크
              </button>
              <button type="button" disabled={busy}
                onClick={() => {
                  if (target.isRecurring === 1) {
                    checkPastFixed("noshow");
                  } else {
                    if (confirm(`${target.scheduledDate} 수업을 노쇼 처리합니다. PT 세션 1회가 차감됩니다.`))
                      noShowMutation.mutate({ scheduleId: target.id, sessionDate: target.scheduledDate });
                  }
                }}
                className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-md bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 font-medium transition-colors disabled:opacity-50">
                노쇼 (차감)
              </button>
              <button type="button" disabled={busy}
                onClick={() => {
                  if (target.isRecurring === 1) {
                    if (confirm(`${date} 수업을 캔슬(당일 취소·차감 없음) 처리합니다.`)) {
                      const freeText = !memberId && memberInput.trim() ? memberInput.trim() : undefined;
                      createMutation.mutate({ memberId, memberName: freeText, scheduledDate: date, scheduledTime: time, notes: notes || undefined, isRecurring: false, eventType, branchId: selectedBranchId ?? undefined, ...(effTrainerId ? { trainerId: effTrainerId } : {}), status: "cancelled" });
                    }
                  } else {
                    if (confirm(`${target.scheduledDate} 수업을 캔슬(당일 취소·차감 없음) 처리합니다.`))
                      updateMutation.mutate({ scheduleId: target.id, status: "cancelled" });
                  }
                }}
                className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-md bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-medium transition-colors disabled:opacity-50 whitespace-nowrap">
                캔슬(차감X)
              </button>
            </div>
          </div>
        )}

        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground">시간</label>
          <input
            type="time"
            step={600}
            value={time}
            onChange={e => setTime(e.target.value)}
            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm"
          />
        </div>

        <div className="space-y-1.5 relative">
          <label className="text-xs text-muted-foreground">
            {eventType === "meeting" ? "참석자 (선택)" : eventType === "consultation" || eventType === "trial" ? "고객명" : "회원"}
          </label>
          <input
            type="text"
            value={memberInput}
            onChange={e => handleMemberInput(e.target.value)}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            placeholder={eventType === "meeting" ? "비워두거나 이름 입력" : "이름 입력 (없으면 빈칸)"}
            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary"
          />
          {memberId && (
            <span className="absolute right-3 top-7 text-xs text-primary">✓ 회원</span>
          )}
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute z-10 left-0 right-0 bg-card border border-border rounded-lg shadow-lg mt-0.5 overflow-hidden">
              {suggestions.map((m: any) => (
                <button
                  key={m.id}
                  type="button"
                  onMouseDown={() => selectSuggestion(m)}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors flex items-center justify-between"
                >
                  <span>{m.name}</span>
                  <span className="text-xs text-muted-foreground">{m.status === "active" ? "활성" : "종료"}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 회원 패키지 현황 + 주요 타임 인포 카드 */}
        {memberId && memberSummary && (
          <div className="rounded-lg bg-background border border-border/60 px-3 py-2 space-y-1.5">
            {memberSummary.pkg ? (
              <div className="flex items-center gap-1.5 text-xs">
                <Package className="h-3.5 w-3.5 text-primary/70 shrink-0" />
                <span className="text-foreground font-medium">{memberSummary.pkg.packageName}</span>
                <span className="text-muted-foreground">
                  · {memberSummary.pkg.usedSessions}/{memberSummary.pkg.totalSessions}회 완료
                  <span className="ml-1 text-primary">
                    (잔여 {memberSummary.pkg.totalSessions - memberSummary.pkg.usedSessions}회)
                  </span>
                </span>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">활성 PT 패키지 없음</p>
            )}
            {memberSummary.usualTimes.length > 0 && (
              <p className="text-xs text-muted-foreground">
                주로 이용: {memberSummary.usualTimes.map(t => t.label).join(" · ")}
              </p>
            )}
          </div>
        )}

        {!assigningToFixed && (
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isRecurring}
              onChange={e => setIsRecurring(e.target.checked)}
              className="mt-0.5 rounded"
            />
            <span className="text-xs">
              <span className="font-medium">고정 수업</span>
              <span className="block text-muted-foreground">매주 같은 요일·시간에 반복됩니다</span>
            </span>
          </label>
        )}

        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground">메모 (선택)</label>
          <input
            value={notes}
            onChange={e => setNotes(e.target.value)}
            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm"
          />
        </div>

        <div className="flex gap-2 pt-1">
          {!isNew && (
            <button
              onClick={() => setDeleteDialog("none") === undefined && setDeleteDialog("one")}
              disabled={deleteBusy}
              className="px-3 py-2 rounded-lg border border-red-500/40 text-red-400 text-sm disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
          <button onClick={onClose} className="flex-1 py-2 rounded-lg border border-border text-sm text-muted-foreground">
            취소
          </button>
          <button
            onClick={save}
            disabled={busy}
            className="flex-1 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50"
          >
            {busy ? "저장 중..." : "저장"}
          </button>
        </div>
      </div>

      {/* 삭제 다이얼로그 */}
      {deleteDialog !== "none" && target && (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-6">
          <div className="bg-card border border-border rounded-2xl p-5 w-full max-w-xs shadow-xl space-y-4">
            <h3 className="font-semibold text-base">
              {target.isRecurring === 1 ? "반복 일정 삭제" : "일정 삭제"}
            </h3>
            {target.isRecurring === 1 ? (
              <div className="space-y-3">
                {([
                  { value: "one",    label: "이 일정만 취소" },
                  { value: "future", label: "이 일정 및 향후 일정 삭제" },
                  { value: "all",    label: "모든 일정 삭제" },
                ] as const).map(opt => (
                  <label key={opt.value} className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="radio"
                      name="deleteMode"
                      value={opt.value}
                      checked={deleteDialog === opt.value}
                      onChange={() => setDeleteDialog(opt.value)}
                      className="w-4 h-4 accent-primary"
                    />
                    <span className="text-sm">{opt.label}</span>
                  </label>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">이 수업을 삭제합니다.</p>
            )}
            <div className="flex gap-2 pt-1">
              <button onClick={() => setDeleteDialog("none")}
                className="flex-1 py-2 rounded-lg border border-border text-sm text-muted-foreground">
                취소
              </button>
              <button
                disabled={deleteBusy}
                onClick={() => {
                  if (target.isRecurring === 1) {
                    if (deleteDialog === "one") {
                      // 이 주만 취소: 취소 상태 one-off 생성 (recurring template 유지)
                      createMutation.mutate({
                        memberId: target.memberId, memberName: target.memberName ?? undefined,
                        scheduledDate: date, scheduledTime: target.scheduledTime ?? undefined,
                        isRecurring: false, eventType: (target.eventType ?? "pt") as any,
                        branchId: target.branchId ?? undefined, status: "cancelled",
                        ...(effTrainerId ? { trainerId: effTrainerId } : {}),
                      });
                    } else {
                      // 향후 / 전체: 반복 템플릿 삭제
                      deleteMutation.mutate({ scheduleId: fixed!.id });
                    }
                  } else {
                    deleteMutation.mutate({ scheduleId: target.id });
                  }
                  setDeleteDialog("none");
                }}
                className="flex-1 py-2 rounded-lg bg-red-500/80 hover:bg-red-500 text-white text-sm font-medium disabled:opacity-50"
              >
                {deleteBusy ? "처리 중..." : deleteDialog === "one" ? "취소 처리" : "삭제"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
