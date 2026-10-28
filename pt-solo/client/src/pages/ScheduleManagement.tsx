import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Plus, ChevronLeft, ChevronRight, Check, X, UserX,
  Clock, RotateCcw, Trash2, RefreshCw, CalendarDays,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// ─── 날짜 유틸 ───
const DOW_KO = ["월", "화", "수", "목", "금", "토", "일"];

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day; // adjust to Monday
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function toDateStr(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function todayStr(): string {
  return toDateStr(new Date());
}

// dayOfWeek: 0=Mon~6=Sun
function getDayOfWeek(dateStr: string): number {
  const d = new Date(dateStr + "T00:00:00");
  return d.getDay() === 0 ? 6 : d.getDay() - 1;
}

// ─── 타입 ───
type ScheduleRow = {
  id: number;
  memberId: number;
  memberName: string;
  scheduledDate: string;
  scheduledTime: string;
  status: string;
  memo: string | null;
  isRecurring: number;
  dayOfWeek: number | null;
};

type ActionSheet = {
  item: ScheduleRow;
  isRecurringExpanded?: boolean; // recurring에서 확장된 단건인지
};

// ─── 회원 선택 컴포넌트 ───
function MemberSelect({
  value, onChange, members,
}: {
  value: number | null;
  onChange: (id: number) => void;
  members: any[];
}) {
  const [search, setSearch] = useState("");
  const filtered = search ? members.filter(m => m.name.includes(search)) : [];
  const selected = value ? members.find(m => m.id === value) : null;
  return (
    <div className="space-y-2">
      <Input
        placeholder="이름으로 검색"
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="h-9 text-sm"
      />
      {selected && !search && (
        <div className="flex items-center justify-between px-3 py-2 bg-primary/10 border border-primary/20 rounded-xl">
          <span className="text-sm font-medium text-primary">{selected.name}</span>
          <button onClick={() => onChange(0)} className="text-xs text-muted-foreground">변경</button>
        </div>
      )}
      {search && (
        <div className="max-h-48 overflow-y-auto space-y-1 border border-border rounded-xl p-1">
          {filtered.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-3">검색 결과 없음</p>
          )}
          {filtered.map((m: any) => (
            <button
              key={m.id}
              onClick={() => { onChange(m.id); setSearch(""); }}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                value === m.id ? "bg-primary text-primary-foreground" : "hover:bg-accent/40"
              }`}
            >
              {m.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── 메인 컴포넌트 ───
export default function ScheduleManagement() {
  const utils = trpc.useUtils();
  const [weekOffset, setWeekOffset] = useState(0);
  const [actionSheet, setActionSheet] = useState<ActionSheet | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createDate, setCreateDate] = useState(todayStr());
  const [createTime, setCreateTime] = useState("10:00");
  const [createMemberId, setCreateMemberId] = useState<number | null>(null);
  const [createMemo, setCreateMemo] = useState("");
  const [createRecurring, setCreateRecurring] = useState(false);

  const today = todayStr();
  const weekStart = useMemo(() => {
    const base = new Date();
    base.setDate(base.getDate() + weekOffset * 7);
    return getWeekStart(base);
  }, [weekOffset]);

  const weekDays = useMemo(() =>
    Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  );

  const startDate = toDateStr(weekDays[0]);
  const endDate = toDateStr(weekDays[6]);

  const { data: schedules = [], isLoading } = trpc.trainerSchedules.getByDateRange.useQuery(
    { startDate, endDate },
    { refetchOnWindowFocus: false }
  );

  const { data: recurringList = [] } = trpc.trainerSchedules.listRecurring.useQuery(
    undefined,
    { refetchOnWindowFocus: false }
  );

  const { data: members = [] } = trpc.members.list.useQuery();

  // 반복 일정을 현재 주에 확장
  const expandedRecurring: ScheduleRow[] = useMemo(() => {
    return (recurringList as ScheduleRow[]).map(r => ({
      ...r,
      scheduledDate: toDateStr(weekDays[r.dayOfWeek ?? 0]),
      isRecurring: 1,
    }));
  }, [recurringList, weekDays]);

  // 단건 스케줄과 반복 스케줄 합산 (단건이 있으면 반복 중복 제거)
  const allSchedules: ScheduleRow[] = useMemo(() => {
    const single = (schedules as ScheduleRow[]).filter(s => s.isRecurring === 0);
    // 이미 단건으로 완료/결석된 반복 일정 id 목록
    const handledRecurringIds = new Set(
      (schedules as ScheduleRow[])
        .filter(s => s.isRecurring === 0)
        .map(s => (s as any).recurringId)
        .filter(Boolean)
    );
    const recurring = expandedRecurring.filter(r => !handledRecurringIds.has(r.id));
    return [...single, ...recurring].sort((a, b) =>
      a.scheduledDate.localeCompare(b.scheduledDate) || a.scheduledTime.localeCompare(b.scheduledTime)
    );
  }, [schedules, expandedRecurring]);

  // 날짜별 그룹
  const byDay = useMemo(() => {
    const map: Record<string, ScheduleRow[]> = {};
    weekDays.forEach(d => { map[toDateStr(d)] = []; });
    allSchedules.forEach(s => {
      if (map[s.scheduledDate]) map[s.scheduledDate].push(s);
    });
    return map;
  }, [allSchedules, weekDays]);

  // ─── mutations ───
  const completeMutation = trpc.trainerSchedules.complete.useMutation({
    onSuccess: (data) => {
      if (data.alreadyCompleted) { toast("이미 완료된 수업입니다."); return; }
      const rem = data.remaining;
      toast.success(rem !== null ? `완료! 잔여 ${rem}회` : "완료 처리되었습니다.");
      utils.trainerSchedules.getByDateRange.invalidate();
      setActionSheet(null);
    },
    onError: (e) => toast.error(e.message),
  });

  const noShowMutation = trpc.trainerSchedules.markNoShow.useMutation({
    onSuccess: () => {
      toast("결석 처리되었습니다.");
      utils.trainerSchedules.getByDateRange.invalidate();
      setActionSheet(null);
    },
    onError: (e) => toast.error(e.message),
  });

  const cancelMutation = trpc.trainerSchedules.cancelCompletion.useMutation({
    onSuccess: () => {
      toast("상태가 대기로 변경되었습니다.");
      utils.trainerSchedules.getByDateRange.invalidate();
      setActionSheet(null);
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = trpc.trainerSchedules.delete.useMutation({
    onSuccess: () => {
      toast.success("삭제되었습니다.");
      utils.trainerSchedules.getByDateRange.invalidate();
      utils.trainerSchedules.listRecurring.invalidate();
      setActionSheet(null);
    },
    onError: (e) => toast.error(e.message),
  });

  const createMutation = trpc.trainerSchedules.create.useMutation({
    onSuccess: () => {
      toast.success("스케줄이 등록되었습니다.");
      utils.trainerSchedules.getByDateRange.invalidate();
      setCreateOpen(false);
      resetCreateForm();
    },
    onError: (e) => toast.error(e.message),
  });

  const createRecurringMutation = trpc.trainerSchedules.createRecurring.useMutation({
    onSuccess: () => {
      toast.success("반복 스케줄이 등록되었습니다.");
      utils.trainerSchedules.listRecurring.invalidate();
      setCreateOpen(false);
      resetCreateForm();
    },
    onError: (e) => toast.error(e.message),
  });

  function resetCreateForm() {
    setCreateDate(today);
    setCreateTime("10:00");
    setCreateMemberId(null);
    setCreateMemo("");
    setCreateRecurring(false);
  }

  function handleCreate() {
    if (!createMemberId) { toast.error("회원을 선택하세요."); return; }
    if (createRecurring) {
      createRecurringMutation.mutate({
        memberId: createMemberId,
        dayOfWeek: getDayOfWeek(createDate),
        scheduledTime: createTime,
        memo: createMemo || undefined,
      });
    } else {
      createMutation.mutate({
        memberId: createMemberId,
        scheduledDate: createDate,
        scheduledTime: createTime,
        memo: createMemo || undefined,
      });
    }
  }

  function handleComplete(item: ScheduleRow) {
    if (item.isRecurring === 1) {
      // 반복 일정은 단건 생성 후 완료
      createMutation.mutate({
        memberId: item.memberId,
        scheduledDate: item.scheduledDate,
        scheduledTime: item.scheduledTime,
        memo: item.memo ?? undefined,
      }, {
        onSuccess: (created: any) => {
          completeMutation.mutate({
            id: created.id,
            memberId: item.memberId,
            scheduledDate: item.scheduledDate,
            scheduledTime: item.scheduledTime,
          });
        },
      });
    } else {
      completeMutation.mutate({
        id: item.id,
        memberId: item.memberId,
        scheduledDate: item.scheduledDate,
        scheduledTime: item.scheduledTime,
      });
    }
  }

  function handleNoShow(item: ScheduleRow) {
    if (item.isRecurring === 1) {
      createMutation.mutate({
        memberId: item.memberId,
        scheduledDate: item.scheduledDate,
        scheduledTime: item.scheduledTime,
        memo: item.memo ?? undefined,
      }, {
        onSuccess: (created: any) => {
          noShowMutation.mutate({ id: created.id });
        },
      });
    } else {
      noShowMutation.mutate({ id: item.id });
    }
  }

  // ─── 주간 헤더 텍스트 ───
  const weekLabel = useMemo(() => {
    const s = weekDays[0];
    const e = weekDays[6];
    if (s.getMonth() === e.getMonth()) {
      return `${s.getMonth() + 1}월 ${s.getDate()}일 ~ ${e.getDate()}일`;
    }
    return `${s.getMonth() + 1}/${s.getDate()} ~ ${e.getMonth() + 1}/${e.getDate()}`;
  }, [weekDays]);

  const isCurrentWeek = weekOffset === 0;

  // ─── 오늘의 예정 수업 배너 ───
  const todaySchedules = byDay[today] ?? [];
  const upcomingToday = todaySchedules.filter(s => s.status === "pending");

  return (
    <div className="flex flex-col h-full bg-background">
      {/* 헤더 */}
      <div className="shrink-0 px-4 pt-4 pb-3 border-b border-border space-y-3">
        <div className="flex items-center justify-between">
          <h1 className="text-base font-bold">수업 스케줄</h1>
          <button
            onClick={() => { setCreateDate(today); setCreateOpen(true); }}
            className="flex items-center gap-1.5 bg-primary text-primary-foreground text-xs font-medium px-3 py-1.5 rounded-full"
          >
            <Plus className="h-3.5 w-3.5" />
            등록
          </button>
        </div>

        {/* 주간 네비게이션 */}
        <div className="flex items-center justify-between">
          <button onClick={() => setWeekOffset(o => o - 1)} className="p-1.5 hover:bg-accent/40 rounded-lg transition-colors">
            <ChevronLeft className="h-4 w-4 text-muted-foreground" />
          </button>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{weekLabel}</span>
            {!isCurrentWeek && (
              <button
                onClick={() => setWeekOffset(0)}
                className="text-xs text-primary underline underline-offset-2"
              >
                이번 주
              </button>
            )}
          </div>
          <button onClick={() => setWeekOffset(o => o + 1)} className="p-1.5 hover:bg-accent/40 rounded-lg transition-colors">
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        {/* 요일 탭 */}
        <div className="flex gap-1">
          {weekDays.map((d, i) => {
            const ds = toDateStr(d);
            const isToday = ds === today;
            const count = byDay[ds]?.length ?? 0;
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                <span className={`text-[10px] font-medium ${isToday ? "text-primary" : "text-muted-foreground"}`}>
                  {DOW_KO[i]}
                </span>
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold ${
                  isToday ? "bg-primary text-primary-foreground" : "text-foreground"
                }`}>
                  {d.getDate()}
                </div>
                {count > 0 && (
                  <span className="text-[9px] text-muted-foreground">{count}건</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 오늘 예정 배너 (이번 주 + 오늘 수업 있을 때만) */}
      {isCurrentWeek && upcomingToday.length > 0 && (
        <div className="mx-4 mt-3 bg-primary/10 border border-primary/20 rounded-xl px-4 py-3 flex items-center gap-3">
          <CalendarDays className="h-4 w-4 text-primary shrink-0" />
          <div>
            <p className="text-xs font-semibold text-primary">오늘 예정 수업 {upcomingToday.length}건</p>
            <p className="text-xs text-muted-foreground">
              {upcomingToday.map(s => `${s.scheduledTime} ${s.memberName}`).join(" · ")}
            </p>
          </div>
        </div>
      )}

      {/* 스케줄 목록 */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {isLoading && (
          <div className="text-center py-10 text-sm text-muted-foreground">불러오는 중...</div>
        )}
        {weekDays.map((d, i) => {
          const ds = toDateStr(d);
          const items = byDay[ds] ?? [];
          const isToday = ds === today;
          if (items.length === 0 && !isToday) return null;
          return (
            <div key={ds}>
              <div className="flex items-center gap-2 mb-1.5">
                <span className={`text-xs font-bold ${isToday ? "text-primary" : "text-muted-foreground"}`}>
                  {DOW_KO[i]}요일 {d.getDate()}일
                </span>
                {isToday && (
                  <span className="text-[10px] bg-primary/15 text-primary px-1.5 py-0.5 rounded-full font-medium">오늘</span>
                )}
                {items.length === 0 && (
                  <span className="text-[10px] text-muted-foreground/50">수업 없음</span>
                )}
              </div>
              {items.length > 0 && (
                <div className="space-y-2">
                  {items.map(item => (
                    <ScheduleCard
                      key={`${item.id}-${item.scheduledDate}`}
                      item={item}
                      onTap={() => setActionSheet({ item })}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 액션 바텀시트 */}
      {actionSheet && (
        <div className="fixed inset-0 z-50 flex items-end" onClick={() => setActionSheet(null)}>
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="relative w-full bg-card rounded-t-2xl shadow-2xl pb-safe-4 overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* 핸들 */}
            <div className="flex justify-center pt-2.5 pb-1">
              <div className="w-10 h-1 bg-border rounded-full" />
            </div>
            {/* 수업 정보 */}
            <div className="px-5 py-3 border-b border-border">
              <p className="font-semibold text-sm">{actionSheet.item.memberName}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {actionSheet.item.scheduledDate} {actionSheet.item.scheduledTime}
                {actionSheet.item.isRecurring === 1 && (
                  <span className="ml-1.5 text-[10px] bg-violet-500/15 text-violet-500 px-1.5 py-0.5 rounded-full">반복</span>
                )}
              </p>
              {actionSheet.item.memo && (
                <p className="text-xs text-muted-foreground mt-1 truncate">{actionSheet.item.memo}</p>
              )}
            </div>
            {/* 액션 버튼들 */}
            <div className="px-4 py-3 space-y-2">
              {actionSheet.item.status === "pending" && (
                <>
                  <button
                    onClick={() => handleComplete(actionSheet.item)}
                    disabled={completeMutation.isPending || createMutation.isPending}
                    className="w-full flex items-center gap-3 px-4 py-3 bg-primary/10 hover:bg-primary/20 text-primary rounded-xl transition-colors disabled:opacity-50"
                  >
                    <Check className="h-5 w-5" />
                    <span className="text-sm font-medium">수업 완료</span>
                  </button>
                  <button
                    onClick={() => handleNoShow(actionSheet.item)}
                    disabled={noShowMutation.isPending || createMutation.isPending}
                    className="w-full flex items-center gap-3 px-4 py-3 bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 rounded-xl transition-colors disabled:opacity-50"
                  >
                    <UserX className="h-5 w-5" />
                    <span className="text-sm font-medium">결석</span>
                  </button>
                </>
              )}
              {(actionSheet.item.status === "completed" || actionSheet.item.status === "noshow") && (
                <button
                  onClick={() => cancelMutation.mutate({ id: actionSheet.item.id })}
                  disabled={cancelMutation.isPending}
                  className="w-full flex items-center gap-3 px-4 py-3 bg-muted/60 hover:bg-muted text-foreground rounded-xl transition-colors disabled:opacity-50"
                >
                  <RotateCcw className="h-4 w-4" />
                  <span className="text-sm font-medium">상태 취소 (대기로 되돌리기)</span>
                </button>
              )}
              {actionSheet.item.isRecurring !== 1 && (
                <button
                  onClick={() => {
                    if (confirm(`${actionSheet.item.memberName}의 스케줄을 삭제할까요?`)) {
                      deleteMutation.mutate({ id: actionSheet.item.id });
                    }
                  }}
                  disabled={deleteMutation.isPending}
                  className="w-full flex items-center gap-3 px-4 py-3 text-destructive hover:bg-destructive/10 rounded-xl transition-colors disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4" />
                  <span className="text-sm font-medium">삭제</span>
                </button>
              )}
              {actionSheet.item.isRecurring === 1 && (
                <button
                  onClick={() => {
                    if (confirm(`반복 일정(${actionSheet.item.memberName})을 삭제할까요?\n이번 주 및 이후 모든 반복 수업이 사라집니다.`)) {
                      deleteMutation.mutate({ id: actionSheet.item.id });
                    }
                  }}
                  disabled={deleteMutation.isPending}
                  className="w-full flex items-center gap-3 px-4 py-3 text-destructive hover:bg-destructive/10 rounded-xl transition-colors disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4" />
                  <span className="text-sm font-medium">반복 일정 삭제</span>
                </button>
              )}
            </div>
            <button onClick={() => setActionSheet(null)} className="w-full py-2.5 text-xs text-muted-foreground">닫기</button>
          </div>
        </div>
      )}

      {/* 스케줄 등록 모달 */}
      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-end" onClick={() => setCreateOpen(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="relative w-full bg-card rounded-t-2xl shadow-2xl max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-center pt-2.5 pb-1">
              <div className="w-10 h-1 bg-border rounded-full" />
            </div>
            <div className="px-5 pb-safe-4">
              <div className="flex items-center justify-between py-3 border-b border-border mb-4">
                <h2 className="text-sm font-bold">수업 스케줄 등록</h2>
                <button onClick={() => setCreateOpen(false)} className="text-muted-foreground">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-4">
                {/* 회원 선택 */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">회원</label>
                  <MemberSelect
                    value={createMemberId}
                    onChange={setCreateMemberId}
                    members={members as any[]}
                  />
                </div>

                {/* 날짜 */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">날짜</label>
                  <Input
                    type="date"
                    value={createDate}
                    onChange={e => setCreateDate(e.target.value)}
                    className="h-9 text-sm"
                  />
                </div>

                {/* 시간 */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">시간</label>
                  <Input
                    type="time"
                    value={createTime}
                    onChange={e => setCreateTime(e.target.value)}
                    className="h-9 text-sm"
                  />
                </div>

                {/* 메모 */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">메모 (선택)</label>
                  <Input
                    placeholder="특이사항, 운동 내용 등"
                    value={createMemo}
                    onChange={e => setCreateMemo(e.target.value)}
                    className="h-9 text-sm"
                  />
                </div>

                {/* 반복 설정 */}
                <button
                  onClick={() => setCreateRecurring(v => !v)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors ${
                    createRecurring
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:border-primary/40"
                  }`}
                >
                  <RefreshCw className="h-4 w-4" />
                  <div className="text-left">
                    <p className="text-sm font-medium">매주 반복</p>
                    {createRecurring && (
                      <p className="text-xs opacity-70">
                        매주 {DOW_KO[getDayOfWeek(createDate)]}요일 {createTime}
                      </p>
                    )}
                  </div>
                  {createRecurring && <Check className="h-4 w-4 ml-auto" />}
                </button>

                <Button
                  className="w-full"
                  onClick={handleCreate}
                  disabled={createMutation.isPending || createRecurringMutation.isPending}
                >
                  {(createMutation.isPending || createRecurringMutation.isPending) ? "등록 중..." : "등록하기"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── 스케줄 카드 ───
function ScheduleCard({ item, onTap }: { item: ScheduleRow; onTap: () => void }) {
  const statusInfo = {
    pending: { label: "예정", color: "bg-blue-500/15 text-blue-500" },
    completed: { label: "완료", color: "bg-emerald-500/15 text-emerald-600" },
    noshow: { label: "결석", color: "bg-amber-500/15 text-amber-600" },
  }[item.status] ?? { label: item.status, color: "bg-muted text-muted-foreground" };

  return (
    <button
      onClick={onTap}
      className="w-full flex items-center gap-3 bg-card border border-border rounded-xl px-4 py-3 text-left hover:border-primary/30 transition-colors active:scale-[0.99]"
    >
      <div className="flex flex-col items-center gap-0.5 shrink-0 w-10">
        <Clock className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-[10px] text-muted-foreground font-medium">{item.scheduledTime}</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold truncate">{item.memberName}</p>
          {item.isRecurring === 1 && (
            <RefreshCw className="h-3 w-3 text-violet-500 shrink-0" />
          )}
        </div>
        {item.memo && (
          <p className="text-xs text-muted-foreground truncate mt-0.5">{item.memo}</p>
        )}
      </div>
      <span className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusInfo.color}`}>
        {statusInfo.label}
      </span>
    </button>
  );
}
