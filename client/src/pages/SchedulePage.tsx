import { useState, useMemo } from "react";
import { trpc } from "../lib/trpc";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Plus, X, Repeat, Trash2 } from "lucide-react";

const WEEKDAYS = ["월", "화", "수", "목", "금", "토", "일"];

// 시간표에 깔 시간대. 06~23시.
const HOURS = Array.from({ length: 18 }, (_, i) => i + 6);

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

type Slot = {
  id: number;
  memberId: number | null;
  memberName: string | null;
  scheduledDate: string;
  scheduledTime: string | null;
  notes: string | null;
  status: string;
  isRecurring: number;
  branchId: number | null;
};

export default function SchedulePage() {
  const [weekStart, setWeekStart] = useState(() => mondayOf(new Date()));
  const [editing, setEditing] = useState<{ weekday: number; hour: number } | null>(null);

  const weekDates = useMemo(
    () => Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      return d;
    }),
    [weekStart]
  );
  const weekStartYmd = toYmd(weekDates[0]);
  const weekEndYmd = toYmd(weekDates[6]);

  const utils = trpc.useUtils();
  const { data: slots, isLoading } = trpc.schedules.listByWeek.useQuery({
    weekStart: weekStartYmd,
    weekEnd: weekEndYmd,
  });

  const refresh = () => utils.schedules.listByWeek.invalidate();

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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold">수업 시간표</h1>
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

      <p className="text-xs text-muted-foreground">
        빈 칸을 누르면 수업을 넣고, 칸을 누르면 수정·삭제합니다. <Repeat className="h-3 w-3 inline" /> 표시는 매주 반복되는 고정 수업입니다.
      </p>

      {isLoading ? (
        <div className="text-center text-sm text-muted-foreground py-10">불러오는 중...</div>
      ) : (
        <div className="overflow-x-auto -mx-4 px-4">
          <div className="min-w-[560px]">
            {/* 요일 헤더 */}
            <div className="grid grid-cols-[44px_repeat(7,1fr)] gap-1 mb-1">
              <div />
              {weekDates.map((d, i) => {
                const isToday = toYmd(d) === todayYmd;
                return (
                  <div
                    key={i}
                    className={`text-center text-xs py-1 rounded-lg ${isToday ? "bg-primary/15 text-primary font-semibold" : "text-muted-foreground"}`}
                  >
                    {WEEKDAYS[i]}
                    <span className="block text-[10px] opacity-70">{d.getDate()}</span>
                  </div>
                );
              })}
            </div>

            {/* 시간 행 */}
            {visibleHours.map(h => (
              <div key={h} className="grid grid-cols-[44px_repeat(7,1fr)] gap-1 mb-1">
                <div className="text-[11px] text-muted-foreground text-right pr-1 pt-2 tabular-nums">
                  {String(h).padStart(2, "0")}시
                </div>
                {weekDates.map((_, wd) => {
                  const cell = grid[`${wd}-${h}`] ?? [];
                  const top = cell[0];
                  return (
                    <button
                      key={wd}
                      onClick={() => setEditing({ weekday: wd, hour: h })}
                      className={`min-h-[44px] rounded-lg border text-[11px] px-1 py-1 text-left transition-colors ${
                        top
                          ? top.isRecurring
                            ? "bg-violet-500/15 border-violet-500/40 hover:bg-violet-500/25"
                            : "bg-primary/15 border-primary/40 hover:bg-primary/25"
                          : "border-border/60 border-dashed hover:border-primary/50 hover:bg-primary/5"
                      }`}
                    >
                      {top ? (
                        <>
                          <span className="font-medium block truncate">
                            {top.memberName ?? "회원 미배정"}
                          </span>
                          <span className="opacity-70 flex items-center gap-0.5">
                            {top.scheduledTime}
                            {top.isRecurring === 1 && <Repeat className="h-2.5 w-2.5" />}
                          </span>
                          {cell.length > 1 && (
                            <span className="opacity-60">+{cell.length - 1}</span>
                          )}
                        </>
                      ) : (
                        <Plus className="h-3 w-3 text-muted-foreground/40" />
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      {editing && (
        <SlotEditor
          cell={grid[`${editing.weekday}-${editing.hour}`] ?? []}
          date={toYmd(weekDates[editing.weekday])}
          hour={editing.hour}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); refresh(); }}
        />
      )}
    </div>
  );
}

function SlotEditor({ cell, date, hour, onClose, onSaved }: {
  cell: Slot[];
  date: string;
  hour: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  // 이 칸의 구성: 고정 슬롯(템플릿)과 이 날짜에 실제로 배정된 수업은 별개다.
  const fixed = cell.find(s => s.isRecurring === 1) ?? null;
  const oneOff = cell.find(s => s.isRecurring === 0 && s.scheduledDate === date) ?? null;

  // 고정 칸에 아직 이 주 배정이 없으면 → 템플릿을 건드리지 않고 이 날짜에만 새로 만든다.
  const assigningToFixed = !!fixed && !oneOff;
  const target = oneOff ?? (fixed && !assigningToFixed ? fixed : null);
  const isNew = !target;

  const [memberId, setMemberId] = useState<number | null>(target?.memberId ?? null);
  const [time, setTime] = useState(
    target?.scheduledTime ?? fixed?.scheduledTime ?? `${String(hour).padStart(2, "0")}:00`
  );
  const [isRecurring, setIsRecurring] = useState((target?.isRecurring ?? 0) === 1);
  const [notes, setNotes] = useState(target?.notes ?? "");
  const [editingFixed, setEditingFixed] = useState(false);

  const { data: memberList } = trpc.members.list.useQuery();

  const createMutation = trpc.schedules.create.useMutation({
    onSuccess: () => { toast.success(assigningToFixed ? "이 주 수업이 배정되었습니다" : "수업이 추가되었습니다"); onSaved(); },
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

  const busy = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

  const save = () => {
    if (isNew) {
      // 고정 칸에 배정하는 경우엔 반복이 아니라 그 날짜 1회로 만든다.
      createMutation.mutate({
        memberId, scheduledDate: date, scheduledTime: time,
        notes: notes || undefined,
        isRecurring: assigningToFixed ? false : isRecurring,
      });
    } else {
      updateMutation.mutate({
        scheduleId: target!.id, memberId, scheduledTime: time,
        notes: notes || null, isRecurring,
      });
    }
  };

  const title = assigningToFixed ? "이 주 수업 배정" : isNew ? "수업 추가" : "수업 수정";

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-card border border-border rounded-t-2xl sm:rounded-xl w-full max-w-sm p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm">{title}</h3>
          <button onClick={onClose}><X className="h-4 w-4 text-muted-foreground" /></button>
        </div>

        <p className="text-xs text-muted-foreground">{date}</p>

        {assigningToFixed && (
          <div className="rounded-lg bg-violet-500/10 border border-violet-500/30 px-3 py-2 text-xs text-violet-300">
            <Repeat className="h-3 w-3 inline mr-1" />
            고정 수업 시간입니다. 여기서 배정하면 <strong>이 주에만</strong> 적용됩니다.
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

        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground">회원</label>
          <select
            value={memberId ?? ""}
            onChange={e => setMemberId(e.target.value ? Number(e.target.value) : null)}
            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm"
          >
            <option value="">미배정 (시간만 잡아두기)</option>
            {(memberList ?? []).map((m: any) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </div>

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
              onClick={() => { if (confirm("이 수업을 삭제할까요?")) deleteMutation.mutate({ scheduleId: target!.id }); }}
              disabled={busy}
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

        {/* 고정 수업 자체를 손보는 건 실수 방지를 위해 따로 둔다 */}
        {fixed && (
          <div className="pt-2 border-t border-border">
            {!editingFixed ? (
              <button
                onClick={() => setEditingFixed(true)}
                className="text-[11px] text-muted-foreground hover:text-foreground"
              >
                고정 수업 시간 자체를 바꾸거나 없애기
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-muted-foreground flex-1">
                  매주 {fixed.scheduledTime} 반복
                </span>
                <button
                  onClick={() => {
                    if (confirm("이 고정 수업을 없앨까요? 이미 배정된 주의 수업은 남습니다.")) {
                      deleteMutation.mutate({ scheduleId: fixed.id });
                    }
                  }}
                  disabled={busy}
                  className="text-[11px] px-2 py-1 rounded border border-red-500/40 text-red-400 disabled:opacity-50"
                >
                  고정 해제
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
