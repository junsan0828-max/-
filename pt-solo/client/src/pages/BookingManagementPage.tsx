import { useState, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  ChevronLeft, ChevronRight, Plus, Check, Pencil, Trash2, X, Clock, User,
} from "lucide-react";
import TabBanner from "@/components/TabBanner";

const DAYS_KO = ["일", "월", "화", "수", "목", "금", "토"];

function toDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getWeekDates(base: Date): Date[] {
  const dow = base.getDay(); // 0=Sun
  const mon = new Date(base);
  mon.setDate(base.getDate() - ((dow + 6) % 7)); // Monday
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(mon);
    d.setDate(mon.getDate() + i);
    return d;
  });
}

const STATUS_META: Record<string, { label: string; cls: string }> = {
  pending:   { label: "예정",    cls: "bg-blue-500/15 text-blue-600" },
  completed: { label: "완료",    cls: "bg-green-500/15 text-green-700" },
  cancelled: { label: "취소",    cls: "bg-red-500/15 text-red-500" },
};

// ─── Add Schedule Modal ────────────────────────────────────────────────────────
function AddModal({
  defaultDate,
  members,
  onClose,
  onSaved,
}: {
  defaultDate: string;
  members: any[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [memberId, setMemberId] = useState<number | "">("");
  const [date, setDate] = useState(defaultDate);
  const [time, setTime] = useState("10:00");
  const [memo, setMemo] = useState("");
  const [query, setQuery] = useState("");

  const createMutation = trpc.trainerSchedules.create.useMutation({
    onSuccess: () => { toast.success("수업이 추가되었습니다"); onSaved(); onClose(); },
    onError: (e) => toast.error(e.message),
  });

  const filtered = members.filter((m) =>
    !query || m.name.includes(query) || (m.phone && m.phone.includes(query))
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-t-2xl bg-white p-6 pb-8 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <span className="font-semibold text-lg">수업 추가</span>
          <button onClick={onClose}><X size={20} /></button>
        </div>

        {/* Member search */}
        <div>
          <label className="text-xs text-gray-500 mb-1 block">회원 선택</label>
          <input
            className="w-full border rounded-lg px-3 py-2 text-sm"
            placeholder="이름·전화번호 검색"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setMemberId(""); }}
          />
          {query && (
            <div className="border rounded-lg mt-1 max-h-40 overflow-y-auto">
              {filtered.length === 0 && (
                <p className="text-sm text-gray-400 p-3">검색 결과 없음</p>
              )}
              {filtered.map((m) => (
                <button
                  key={m.id}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 ${memberId === m.id ? "bg-indigo-50 font-medium" : ""}`}
                  onClick={() => { setMemberId(m.id); setQuery(m.name); }}
                >
                  {m.name} {m.phone ? `· ${m.phone}` : ""}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Date + Time */}
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="text-xs text-gray-500 mb-1 block">날짜</label>
            <input
              type="date"
              className="w-full border rounded-lg px-3 py-2 text-sm"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div className="flex-1">
            <label className="text-xs text-gray-500 mb-1 block">시간</label>
            <input
              type="time"
              className="w-full border rounded-lg px-3 py-2 text-sm"
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
          </div>
        </div>

        {/* Memo */}
        <div>
          <label className="text-xs text-gray-500 mb-1 block">메모 (선택)</label>
          <textarea
            className="w-full border rounded-lg px-3 py-2 text-sm resize-none"
            rows={2}
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="특이사항, 부위 등"
          />
        </div>

        <Button
          className="w-full"
          disabled={!memberId || !date || !time || createMutation.isPending}
          onClick={() =>
            createMutation.mutate({
              memberId: memberId as number,
              scheduledDate: date,
              scheduledTime: time,
              memo: memo || undefined,
            })
          }
        >
          {createMutation.isPending ? "저장 중…" : "추가"}
        </Button>
      </div>
    </div>
  );
}

// ─── Edit Time Modal ───────────────────────────────────────────────────────────
function EditTimeModal({
  schedule,
  onClose,
  onSaved,
}: {
  schedule: any;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [date, setDate] = useState(schedule.scheduledDate);
  const [time, setTime] = useState(schedule.scheduledTime);

  const updateMutation = trpc.trainerSchedules.update.useMutation({
    onSuccess: () => { toast.success("수정되었습니다"); onSaved(); onClose(); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-t-2xl bg-white p-6 pb-8 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <span className="font-semibold text-lg">시간 변경</span>
          <button onClick={onClose}><X size={20} /></button>
        </div>
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="text-xs text-gray-500 mb-1 block">날짜</label>
            <input
              type="date"
              className="w-full border rounded-lg px-3 py-2 text-sm"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div className="flex-1">
            <label className="text-xs text-gray-500 mb-1 block">시간</label>
            <input
              type="time"
              className="w-full border rounded-lg px-3 py-2 text-sm"
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
          </div>
        </div>
        <Button
          className="w-full"
          disabled={updateMutation.isPending}
          onClick={() => updateMutation.mutate({ id: schedule.id, scheduledDate: date, scheduledTime: time })}
        >
          {updateMutation.isPending ? "저장 중…" : "저장"}
        </Button>
      </div>
    </div>
  );
}

// ─── Action Sheet ──────────────────────────────────────────────────────────────
function ActionSheet({
  schedule,
  onClose,
  onRefresh,
}: {
  schedule: any;
  onClose: () => void;
  onRefresh: () => void;
}) {
  const [showEdit, setShowEdit] = useState(false);

  const completeMutation = trpc.trainerSchedules.complete.useMutation({
    onSuccess: () => { toast.success("수업 완료 처리되었습니다"); onRefresh(); onClose(); },
    onError: (e) => toast.error(e.message),
  });
  const deleteMutation = trpc.trainerSchedules.delete.useMutation({
    onSuccess: () => { toast.success("삭제되었습니다"); onRefresh(); onClose(); },
    onError: (e) => toast.error(e.message),
  });

  if (showEdit) {
    return <EditTimeModal schedule={schedule} onClose={() => setShowEdit(false)} onSaved={onRefresh} />;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-t-2xl bg-white pb-8 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b">
          <p className="font-semibold">{schedule.memberName}</p>
          <p className="text-sm text-gray-500">{schedule.scheduledDate} {schedule.scheduledTime}</p>
        </div>

        {/* Actions */}
        <button
          className="flex items-center gap-3 w-full px-6 py-4 hover:bg-gray-50 text-left"
          onClick={() => setShowEdit(true)}
        >
          <Pencil size={18} className="text-gray-500" />
          <span>시간 변경</span>
        </button>

        {schedule.status !== "completed" && (
          <button
            className="flex items-center gap-3 w-full px-6 py-4 hover:bg-gray-50 text-left"
            disabled={completeMutation.isPending}
            onClick={() =>
              completeMutation.mutate({
                id: schedule.id,
                memberId: schedule.memberId,
                scheduledDate: schedule.scheduledDate,
                scheduledTime: schedule.scheduledTime,
              })
            }
          >
            <Check size={18} className="text-green-600" />
            <span className="text-green-700">수업 완료</span>
          </button>
        )}

        <button
          className="flex items-center gap-3 w-full px-6 py-4 hover:bg-gray-50 text-left"
          disabled={deleteMutation.isPending}
          onClick={() => {
            if (confirm("이 수업을 삭제할까요?")) deleteMutation.mutate({ id: schedule.id });
          }}
        >
          <Trash2 size={18} className="text-red-500" />
          <span className="text-red-500">삭제</span>
        </button>

        <button className="w-full px-6 py-3 text-sm text-gray-400" onClick={onClose}>
          취소
        </button>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function BookingManagementPage() {
  const today = new Date();
  const todayStr = toDateStr(today);

  const [weekBase, setWeekBase] = useState(() => {
    const d = new Date(today);
    return d;
  });
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [showAdd, setShowAdd] = useState(false);
  const [activeSheet, setActiveSheet] = useState<any>(null);

  const weekDates = getWeekDates(weekBase);
  const startDate = toDateStr(weekDates[0]);
  const endDate = toDateStr(weekDates[6]);

  const { data: schedules = [], refetch } = trpc.trainerSchedules.getByDateRange.useQuery(
    { startDate, endDate },
    { refetchOnWindowFocus: false }
  );

  const { data: members = [] } = trpc.members.list.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });

  const daySchedules = (schedules as any[]).filter((s) => s.scheduledDate === selectedDate);
  daySchedules.sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime));

  // Count per day for badge
  const countByDate: Record<string, number> = {};
  for (const s of schedules as any[]) {
    countByDate[s.scheduledDate] = (countByDate[s.scheduledDate] ?? 0) + 1;
  }

  function prevWeek() {
    const d = new Date(weekBase);
    d.setDate(d.getDate() - 7);
    setWeekBase(d);
  }
  function nextWeek() {
    const d = new Date(weekBase);
    d.setDate(d.getDate() + 7);
    setWeekBase(d);
  }
  function goToday() {
    setWeekBase(new Date(today));
    setSelectedDate(todayStr);
  }

  const weekLabel = (() => {
    const y = weekDates[0].getFullYear();
    const m = weekDates[0].getMonth() + 1;
    return `${y}년 ${m}월`;
  })();

  return (
    <div className="min-h-screen bg-gray-50 pb-28">
      <TabBanner tabKey="schedule" />

      {/* Week navigation */}
      <div className="bg-white border-b px-4 pt-4 pb-3 sticky top-0 z-10">
        <div className="flex items-center justify-between mb-3">
          <button onClick={prevWeek} className="p-1"><ChevronLeft size={20} /></button>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm">{weekLabel}</span>
            <button
              onClick={goToday}
              className="text-xs border border-indigo-300 text-indigo-600 rounded-full px-2 py-0.5"
            >
              오늘
            </button>
          </div>
          <button onClick={nextWeek} className="p-1"><ChevronRight size={20} /></button>
        </div>

        {/* Day chips */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
          {weekDates.map((d) => {
            const ds = toDateStr(d);
            const isSelected = ds === selectedDate;
            const isToday = ds === todayStr;
            const cnt = countByDate[ds] ?? 0;
            const dow = d.getDay();
            return (
              <button
                key={ds}
                onClick={() => setSelectedDate(ds)}
                className={`flex-shrink-0 flex flex-col items-center rounded-xl px-3 py-2 min-w-[44px] transition-colors ${
                  isSelected
                    ? "bg-indigo-600 text-white"
                    : isToday
                    ? "bg-indigo-50 text-indigo-600"
                    : "bg-gray-100 text-gray-700"
                }`}
              >
                <span className={`text-[10px] ${isSelected ? "text-indigo-200" : dow === 0 ? "text-red-400" : dow === 6 ? "text-blue-400" : "text-gray-400"}`}>
                  {DAYS_KO[dow]}
                </span>
                <span className="text-sm font-semibold">{d.getDate()}</span>
                {cnt > 0 && (
                  <span className={`text-[10px] mt-0.5 font-medium ${isSelected ? "text-indigo-200" : "text-indigo-500"}`}>
                    {cnt}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected day schedule */}
      <div className="px-4 pt-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-800">
            {selectedDate.replace(/-/g, ".")} 수업
          </h2>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 bg-indigo-600 text-white text-sm rounded-full px-3 py-1.5"
          >
            <Plus size={15} />
            수업 추가
          </button>
        </div>

        {daySchedules.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Clock size={36} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">이 날 예정된 수업이 없습니다</p>
            <button
              onClick={() => setShowAdd(true)}
              className="mt-3 text-indigo-500 text-sm underline"
            >
              수업 추가하기
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {daySchedules.map((s: any) => {
              const meta = STATUS_META[s.status] ?? STATUS_META.pending;
              return (
                <button
                  key={s.id}
                  className="w-full bg-white rounded-xl border p-4 flex items-center gap-4 text-left hover:border-indigo-300 transition-colors"
                  onClick={() => setActiveSheet(s)}
                >
                  <div className="text-center min-w-[42px]">
                    <p className="text-base font-bold text-gray-800">{s.scheduledTime.slice(0, 5)}</p>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <User size={14} className="text-gray-400 flex-shrink-0" />
                      <p className="font-medium text-gray-900 truncate">{s.memberName}</p>
                      <span className={`text-[11px] rounded-full px-2 py-0.5 flex-shrink-0 ${meta.cls}`}>
                        {meta.label}
                      </span>
                    </div>
                    {s.memo && <p className="text-xs text-gray-400 mt-0.5 truncate">{s.memo}</p>}
                  </div>
                  <ChevronRight size={16} className="text-gray-300 flex-shrink-0" />
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Modals */}
      {showAdd && (
        <AddModal
          defaultDate={selectedDate}
          members={members as any[]}
          onClose={() => setShowAdd(false)}
          onSaved={() => refetch()}
        />
      )}
      {activeSheet && (
        <ActionSheet
          schedule={activeSheet}
          onClose={() => setActiveSheet(null)}
          onRefresh={() => refetch()}
        />
      )}
    </div>
  );
}
