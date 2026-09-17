import { useState, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  ChevronLeft, ChevronRight, Plus, Check, Pencil, Trash2, X, Clock, User, Settings2,
} from "lucide-react";
import TabBanner from "@/components/TabBanner";

// ─── Types ────────────────────────────────────────────────────────────────────
type DayMode = "weekdays" | "weekdays_sat" | "all";
type WeekCount = 1 | 2 | 3 | 4;

interface CalSettings {
  dayMode: DayMode;
  weekCount: WeekCount;
  includePrevWeek: boolean; // only meaningful when weekCount >= 2
}

const DEFAULT_SETTINGS: CalSettings = {
  dayMode: "all",
  weekCount: 1,
  includePrevWeek: false,
};

const DAYS_KO = ["일", "월", "화", "수", "목", "금", "토"];
const STATUS_META: Record<string, { label: string; cls: string }> = {
  pending:   { label: "예정",  cls: "bg-blue-500/15 text-blue-600" },
  completed: { label: "완료",  cls: "bg-green-500/15 text-green-700" },
  cancelled: { label: "취소",  cls: "bg-red-500/15 text-red-500" },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function toDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Monday of the week containing `base` */
function weekMonday(base: Date): Date {
  const d = new Date(base);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  d.setHours(0, 0, 0, 0);
  return d;
}

/** All visible dates given settings and the "anchor" Monday */
function buildVisibleDates(anchorMon: Date, settings: CalSettings): Date[] {
  const { dayMode, weekCount, includePrevWeek } = settings;
  const dayCount = dayMode === "weekdays" ? 5 : dayMode === "weekdays_sat" ? 6 : 7;

  // Determine start Monday
  let startMon = new Date(anchorMon);
  if (weekCount >= 2 && includePrevWeek) {
    startMon = new Date(anchorMon);
    startMon.setDate(anchorMon.getDate() - 7);
  }

  const dates: Date[] = [];
  for (let w = 0; w < weekCount; w++) {
    for (let d = 0; d < dayCount; d++) {
      const date = new Date(startMon);
      date.setDate(startMon.getDate() + w * 7 + d);
      dates.push(date);
    }
  }
  return dates;
}

function loadSettings(): CalSettings {
  try {
    const raw = localStorage.getItem("bookingCalSettings");
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {}
  return { ...DEFAULT_SETTINGS };
}
function saveSettings(s: CalSettings) {
  try { localStorage.setItem("bookingCalSettings", JSON.stringify(s)); } catch {}
}

// ─── Settings Sheet ───────────────────────────────────────────────────────────
function SettingsSheet({
  current,
  onClose,
  onApply,
}: {
  current: CalSettings;
  onClose: () => void;
  onApply: (s: CalSettings) => void;
}) {
  const [draft, setDraft] = useState<CalSettings>({ ...current });

  const dayOptions: { value: DayMode; label: string }[] = [
    { value: "weekdays",     label: "평일만 (월~금)" },
    { value: "weekdays_sat", label: "평일 + 토요일 (월~토)" },
    { value: "all",          label: "전체 (월~일)" },
  ];
  const weekOptions: WeekCount[] = [1, 2, 3, 4];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-t-2xl bg-white pb-8 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <span className="font-semibold text-lg">달력 설정</span>
          <button onClick={onClose}><X size={20} /></button>
        </div>

        <div className="px-6 pt-5 space-y-6">
          {/* Day mode */}
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">표시 요일</p>
            <div className="space-y-2">
              {dayOptions.map((o) => (
                <label key={o.value} className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="dayMode"
                    value={o.value}
                    checked={draft.dayMode === o.value}
                    onChange={() => setDraft((p) => ({ ...p, dayMode: o.value }))}
                    className="accent-indigo-600"
                  />
                  <span className="text-sm">{o.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Week count */}
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">표시 주 수</p>
            <div className="flex gap-2">
              {weekOptions.map((w) => (
                <button
                  key={w}
                  onClick={() => setDraft((p) => ({ ...p, weekCount: w }))}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    draft.weekCount === w
                      ? "bg-indigo-600 text-white border-indigo-600"
                      : "bg-white text-gray-700 border-gray-200"
                  }`}
                >
                  {w}주
                </button>
              ))}
            </div>
          </div>

          {/* Include prev week (only when weekCount >= 2) */}
          {draft.weekCount >= 2 && (
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">주 범위</p>
              <div className="space-y-2">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="prevWeek"
                    checked={!draft.includePrevWeek}
                    onChange={() => setDraft((p) => ({ ...p, includePrevWeek: false }))}
                    className="accent-indigo-600"
                  />
                  <span className="text-sm">이번 주부터 {draft.weekCount}주 앞으로</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="prevWeek"
                    checked={draft.includePrevWeek}
                    onChange={() => setDraft((p) => ({ ...p, includePrevWeek: true }))}
                    className="accent-indigo-600"
                  />
                  <span className="text-sm">지난 주 포함 (전주 + 이번 주{draft.weekCount > 2 ? ` + ${draft.weekCount - 2}주 앞` : ""})</span>
                </label>
              </div>
            </div>
          )}
        </div>

        <div className="px-6 pt-6">
          <Button
            className="w-full"
            onClick={() => { onApply(draft); onClose(); }}
          >
            적용
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Add Schedule Modal ───────────────────────────────────────────────────────
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

// ─── Edit Time Modal ──────────────────────────────────────────────────────────
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

// ─── Action Sheet ─────────────────────────────────────────────────────────────
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
        <div className="px-6 py-4 border-b">
          <p className="font-semibold">{schedule.memberName}</p>
          <p className="text-sm text-gray-500">{schedule.scheduledDate} {schedule.scheduledTime}</p>
        </div>

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
  today.setHours(0, 0, 0, 0);
  const todayStr = toDateStr(today);

  const [settings, setSettings] = useState<CalSettings>(loadSettings);
  const [anchorMon, setAnchorMon] = useState(() => weekMonday(today));
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [showAdd, setShowAdd] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [activeSheet, setActiveSheet] = useState<any>(null);

  const chipRef = useRef<HTMLDivElement>(null);

  const visibleDates = buildVisibleDates(anchorMon, settings);
  const startDate = toDateStr(visibleDates[0]);
  const endDate = toDateStr(visibleDates[visibleDates.length - 1]);

  const { data: schedules = [], refetch } = trpc.trainerSchedules.getByDateRange.useQuery(
    { startDate, endDate },
    { refetchOnWindowFocus: false }
  );

  const { data: members = [] } = trpc.members.list.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });

  // Count per day for badge
  const countByDate: Record<string, number> = {};
  for (const s of schedules as any[]) {
    countByDate[s.scheduledDate] = (countByDate[s.scheduledDate] ?? 0) + 1;
  }

  const daySchedules = (schedules as any[])
    .filter((s) => s.scheduledDate === selectedDate)
    .sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime));

  // Scroll selected chip into view when selection or week changes
  useEffect(() => {
    if (!chipRef.current) return;
    const el = chipRef.current.querySelector("[data-selected='true']") as HTMLElement;
    if (el) el.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [selectedDate, anchorMon, settings]);

  function applySettings(s: CalSettings) {
    setSettings(s);
    saveSettings(s);
  }

  function prevPeriod() {
    const d = new Date(anchorMon);
    d.setDate(d.getDate() - 7);
    setAnchorMon(d);
  }
  function nextPeriod() {
    const d = new Date(anchorMon);
    d.setDate(d.getDate() + 7);
    setAnchorMon(d);
  }
  function goToday() {
    setAnchorMon(weekMonday(today));
    setSelectedDate(todayStr);
  }

  // Header label: show range
  const rangeLabel = (() => {
    const s = visibleDates[0];
    const e = visibleDates[visibleDates.length - 1];
    const sy = s.getFullYear(), sm = s.getMonth() + 1;
    const ey = e.getFullYear(), em = e.getMonth() + 1;
    if (sy === ey && sm === em) return `${sy}년 ${sm}월`;
    if (sy === ey) return `${sy}년 ${sm}월 – ${em}월`;
    return `${sy}.${sm} – ${ey}.${em}`;
  })();

  // Day chip label for multi-week: show month/day if crossing months
  const firstMonth = visibleDates[0].getMonth();
  const multiMonth = visibleDates.some((d) => d.getMonth() !== firstMonth);

  return (
    <div className="min-h-screen bg-gray-50 pb-28">
      <TabBanner tabKey="schedule" />

      {/* Calendar header */}
      <div className="bg-white border-b px-4 pt-4 pb-3 sticky top-0 z-10">
        <div className="flex items-center justify-between mb-3">
          <button onClick={prevPeriod} className="p-1 text-gray-500">
            <ChevronLeft size={20} />
          </button>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm">{rangeLabel}</span>
            <button
              onClick={goToday}
              className="text-xs border border-indigo-300 text-indigo-600 rounded-full px-2 py-0.5"
            >
              오늘
            </button>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowSettings(true)}
              className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100"
              title="달력 설정"
            >
              <Settings2 size={18} />
            </button>
            <button onClick={nextPeriod} className="p-1 text-gray-500">
              <ChevronRight size={20} />
            </button>
          </div>
        </div>

        {/* Day chips — horizontal scroll */}
        <div
          ref={chipRef}
          className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide"
        >
          {visibleDates.map((d) => {
            const ds = toDateStr(d);
            const isSelected = ds === selectedDate;
            const isToday = ds === todayStr;
            const cnt = countByDate[ds] ?? 0;
            const dow = d.getDay();
            return (
              <button
                key={ds}
                data-selected={isSelected}
                onClick={() => setSelectedDate(ds)}
                className={`flex-shrink-0 flex flex-col items-center rounded-xl px-3 py-2 min-w-[44px] transition-colors ${
                  isSelected
                    ? "bg-indigo-600 text-white"
                    : isToday
                    ? "bg-indigo-50 text-indigo-600"
                    : "bg-gray-100 text-gray-700"
                }`}
              >
                {multiMonth && (
                  <span className={`text-[9px] ${isSelected ? "text-indigo-300" : "text-gray-400"}`}>
                    {d.getMonth() + 1}/{d.getDate()}
                  </span>
                )}
                <span
                  className={`text-[10px] ${
                    isSelected
                      ? "text-indigo-200"
                      : dow === 0
                      ? "text-red-400"
                      : dow === 6
                      ? "text-blue-400"
                      : "text-gray-400"
                  }`}
                >
                  {DAYS_KO[dow]}
                </span>
                <span className="text-sm font-semibold">{d.getDate()}</span>
                {cnt > 0 && (
                  <span
                    className={`text-[10px] mt-0.5 font-medium ${
                      isSelected ? "text-indigo-200" : "text-indigo-500"
                    }`}
                  >
                    {cnt}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected day */}
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
                    {s.memo && (
                      <p className="text-xs text-gray-400 mt-0.5 truncate">{s.memo}</p>
                    )}
                  </div>
                  <ChevronRight size={16} className="text-gray-300 flex-shrink-0" />
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Modals */}
      {showSettings && (
        <SettingsSheet
          current={settings}
          onClose={() => setShowSettings(false)}
          onApply={applySettings}
        />
      )}
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
