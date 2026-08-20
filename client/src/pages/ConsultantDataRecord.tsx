import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { ClipboardList, ChevronLeft, ChevronRight, Save, Calendar, BarChart2, Megaphone } from "lucide-react";

// ── 유틸 ──────────────────────────────────────────────────────────────────────
function toDateStr(d: Date) { return d.toISOString().substring(0, 10); }

function getWeekdayGrid(year: number, month: number): { weekKey: string; weekLabel: string; days: (string | null)[] }[] {
  const daysInMonth = new Date(year, month, 0).getDate();
  const weeks: { weekKey: string; weekLabel: string; days: (string | null)[] }[] = [];
  let row: (string | null)[] = [null, null, null, null, null];
  let prevCol = -1;

  for (let d = 1; d <= daysInMonth; d++) {
    const dow = new Date(year, month - 1, d).getDay(); // 0=Sun
    if (dow === 0 || dow === 6) continue;
    const col = dow - 1; // Mon=0 … Fri=4
    const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    if (col <= prevCol) {
      weeks.push({ weekKey: "", weekLabel: "", days: row });
      row = [null, null, null, null, null];
    }
    row[col] = dateStr;
    prevCol = col;
  }
  if (row.some(Boolean)) weeks.push({ weekKey: "", weekLabel: "", days: row });

  return weeks.map((w, idx) => {
    const filled = w.days.filter(Boolean) as string[];
    const first = filled[0].split("-");
    const last = filled[filled.length - 1].split("-");
    const wKey = `${year}-${String(month).padStart(2, "0")}-W${idx + 1}`;
    const wLabel = `${idx + 1}주차 (${parseInt(first[1])}/${parseInt(first[2])} - ${parseInt(last[1])}/${parseInt(last[2])})`;
    return { weekKey: wKey, weekLabel: wLabel, days: w.days };
  });
}

const TODAY = toDateStr(new Date());
const DOW_LABELS = ["월", "화", "수", "목", "금"];

const AD_CHANNELS = ["검색광고", "파워링크", "플레이스", "당근", "블로그"] as const;
const CHANNELS_WITH_INQUIRY = new Set(["플레이스", "당근", "블로그"]);

type AdValues = Record<string, { impressions: number; clicks: number; visits: number; inquiries: number; notes: string }>;

// ── 메인 페이지 ───────────────────────────────────────────────────────────────
export default function ConsultantDataRecordPage() {
  const now = new Date();
  const [mode, setMode] = useState<"daily" | "weekly" | "ads">("daily");
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [selectedDate, setSelectedDate] = useState(TODAY);
  const [selectedWeek, setSelectedWeek] = useState("");

  const grid = getWeekdayGrid(year, month);

  useEffect(() => {
    if (mode === "daily" || mode === "ads") {
      const allDays = grid.flatMap(w => w.days).filter(Boolean) as string[];
      if (!allDays.includes(selectedDate)) {
        const todayInMonth = allDays.find(d => d === TODAY);
        setSelectedDate(todayInMonth ?? allDays[allDays.length - 1] ?? TODAY);
      }
    }
    if (mode === "weekly") {
      if (!grid.find(w => w.weekKey === selectedWeek)) {
        setSelectedWeek(grid[0]?.weekKey ?? "");
      }
    }
  }, [year, month, mode]);

  function prevMonth() {
    if (month === 1) { setYear(y => y - 1); setMonth(12); }
    else setMonth(m => m - 1);
  }
  function nextMonth() {
    if (month === 12) { setYear(y => y + 1); setMonth(1); }
    else setMonth(m => m + 1);
  }

  const activeDate = mode === "weekly" ? selectedWeek : selectedDate;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold flex items-center gap-2">
        <ClipboardList className="h-5 w-5 text-primary" />데이터 기록
      </h1>

      {/* 모드 탭 */}
      <div className="grid grid-cols-3 gap-2">
        {([
          { key: "daily" as const, label: "일일 데이터", icon: Calendar },
          { key: "weekly" as const, label: "주간 데이터", icon: BarChart2 },
          { key: "ads" as const, label: "광고 관리", icon: Megaphone },
        ]).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setMode(key)}
            className={`flex items-center justify-center gap-1.5 py-3 rounded-xl text-xs font-medium border transition-colors ${
              mode === key
                ? "bg-primary/20 text-primary border-primary/40"
                : "bg-card border-border text-muted-foreground hover:bg-accent"
            }`}
          >
            <Icon className="h-4 w-4" />{label}
          </button>
        ))}
      </div>

      {/* 월 이동 */}
      <div className="flex items-center justify-between bg-card border border-border rounded-xl px-4 py-2.5">
        <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <span className="text-sm font-semibold">{year}년 {month}월</span>
        <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {mode === "daily" || mode === "ads" ? (
        <DailyView
          year={year} month={month} grid={grid}
          selectedDate={selectedDate} onSelectDate={setSelectedDate}
          section={mode === "ads" ? "ads" : "daily"}
        />
      ) : (
        <WeeklyView
          year={year} month={month} grid={grid}
          selectedWeek={selectedWeek} onSelectWeek={setSelectedWeek}
        />
      )}

      {activeDate && mode !== "ads" && (
        <EntryForm date={activeDate} section={mode} />
      )}

      {activeDate && mode === "ads" && (
        <AdEntryForm date={selectedDate} />
      )}
    </div>
  );
}

// ── 일일 달력 ──────────────────────────────────────────────────────────────────
function DailyView({
  year, month, grid, selectedDate, onSelectDate, section
}: {
  year: number; month: number;
  grid: ReturnType<typeof getWeekdayGrid>;
  selectedDate: string;
  onSelectDate: (d: string) => void;
  section: "daily" | "ads";
}) {
  const { data: datesWithData } = trpc.consultantData.getDatesWithData.useQuery(
    { year, month, section: "daily" },
    { enabled: section === "daily" }
  );
  const { data: adDatesWithData } = trpc.consultantData.getAdDatesWithData.useQuery(
    { year, month },
    { enabled: section === "ads" }
  );
  const dateDotSet = new Set(section === "ads" ? (adDatesWithData ?? []) : (datesWithData ?? []));

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="grid grid-cols-5 border-b border-border">
        {DOW_LABELS.map(d => (
          <div key={d} className="py-2 text-center text-xs font-medium text-muted-foreground">{d}</div>
        ))}
      </div>
      {grid.map((week, wi) => (
        <div key={wi} className="grid grid-cols-5 border-b border-border last:border-b-0">
          {week.days.map((date, di) => {
            if (!date) return <div key={di} className="py-3" />;
            const day = parseInt(date.split("-")[2]);
            const isSelected = date === selectedDate;
            const isToday = date === TODAY;
            const isFuture = date > TODAY;
            const hasDot = dateDotSet.has(date);
            return (
              <button
                key={di}
                disabled={isFuture}
                onClick={() => onSelectDate(date)}
                className={`flex flex-col items-center justify-center py-2.5 text-xs transition-colors disabled:cursor-not-allowed ${
                  isSelected
                    ? "bg-primary text-primary-foreground"
                    : isFuture
                    ? "text-muted-foreground/30"
                    : isToday
                    ? "text-primary font-semibold hover:bg-accent"
                    : "text-foreground hover:bg-accent"
                }`}
              >
                <span className="font-medium">{day}</span>
                <span className={`w-1.5 h-1.5 rounded-full mt-0.5 ${
                  hasDot && !isSelected ? "bg-emerald-400" : "bg-transparent"
                }`} />
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ── 주간 목록 ──────────────────────────────────────────────────────────────────
function WeeklyView({
  year, month, grid, selectedWeek, onSelectWeek
}: {
  year: number; month: number;
  grid: ReturnType<typeof getWeekdayGrid>;
  selectedWeek: string;
  onSelectWeek: (w: string) => void;
}) {
  const { data: weeksWithData } = trpc.consultantData.getDatesWithData.useQuery(
    { year, month, section: "weekly" }
  );
  const weekDotSet = new Set(weeksWithData ?? []);

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden divide-y divide-border">
      {grid.map((week) => {
        const isSelected = week.weekKey === selectedWeek;
        const hasDot = weekDotSet.has(week.weekKey);
        return (
          <button
            key={week.weekKey}
            onClick={() => onSelectWeek(week.weekKey)}
            className={`w-full flex items-center justify-between px-4 py-3 text-sm transition-colors ${
              isSelected ? "bg-primary/15 text-primary" : "hover:bg-accent text-foreground"
            }`}
          >
            <span className="font-medium">{week.weekLabel}</span>
            {hasDot && !isSelected && (
              <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
            )}
            {isSelected && (
              <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full shrink-0">선택됨</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ── 항목 입력 폼 ───────────────────────────────────────────────────────────────
function EntryForm({ date, section }: { date: string; section: "daily" | "weekly" }) {
  const utils = trpc.useUtils();
  const { data: fields, isLoading: fieldsLoading } = trpc.consultantData.listFields.useQuery({ section });
  const { data: existing, isLoading: entriesLoading } = trpc.consultantData.getEntries.useQuery({ date, section });

  const [values, setValues] = useState<Record<number, string>>({});
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (existing) {
      const map: Record<number, string> = {};
      for (const e of existing) map[e.fieldId] = e.value;
      setValues(map);
    } else {
      setValues({});
    }
    setDirty(false);
  }, [existing, date]);

  const saveMutation = trpc.consultantData.saveEntries.useMutation({
    onSuccess: () => {
      toast.success("저장됐습니다");
      setDirty(false);
      utils.consultantData.invalidate();
    },
    onError: () => toast.error("저장 실패"),
  });

  function setValue(fieldId: number, val: string) {
    setValues(v => ({ ...v, [fieldId]: val }));
    setDirty(true);
  }

  function increment(fieldId: number) {
    const cur = parseInt(values[fieldId] ?? "0") || 0;
    setValue(fieldId, String(cur + 1));
  }
  function decrement(fieldId: number) {
    const cur = parseInt(values[fieldId] ?? "0") || 0;
    if (cur > 0) setValue(fieldId, String(cur - 1));
  }

  function handleSave() {
    if (!fields?.length) return;
    const entries = fields.map(f => ({
      fieldId: f.id,
      value: values[f.id] ?? "0",
    }));
    saveMutation.mutate({ date, entries });
  }

  if (fieldsLoading || entriesLoading) {
    return <div className="text-center text-muted-foreground py-8 text-sm">불러오는 중...</div>;
  }

  if (!fields?.length) {
    return (
      <div className="bg-card border border-border rounded-xl p-6 text-center">
        <p className="text-sm text-muted-foreground">등록된 항목이 없습니다</p>
        <p className="text-xs text-muted-foreground mt-1">관리자에게 데이터 항목 추가를 요청하세요</p>
      </div>
    );
  }

  const dateLabel = section === "daily"
    ? (() => {
        const d = new Date(date + "T00:00:00");
        return `${d.getMonth() + 1}월 ${d.getDate()}일`;
      })()
    : (() => {
        const parts = date.split("-");
        return `${parseInt(parts[1])}월 ${parts[2]}`;
      })();

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-foreground">{dateLabel} 데이터</p>
        {dirty && (
          <button
            onClick={handleSave}
            disabled={saveMutation.isPending}
            className="flex items-center gap-1.5 bg-primary text-primary-foreground px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-primary/90 disabled:opacity-50"
          >
            <Save className="h-3.5 w-3.5" />
            {saveMutation.isPending ? "저장 중..." : "저장"}
          </button>
        )}
      </div>

      <div className="space-y-2">
        {fields.map(f => {
          const val = parseInt(values[f.id] ?? "0") || 0;
          return (
            <div key={f.id} className="flex items-center justify-between bg-card border border-border rounded-xl px-4 py-3">
              <p className="text-sm text-foreground flex-1 min-w-0 truncate pr-3">{f.name}</p>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => decrement(f.id)}
                  className="w-7 h-7 rounded-lg bg-muted text-foreground text-lg font-bold flex items-center justify-center hover:bg-accent transition-colors"
                >−</button>
                <span className="w-16 text-center text-sm font-semibold tabular-nums">
                  {val.toLocaleString()}
                  <span className="text-xs text-muted-foreground ml-0.5">{f.unit}</span>
                </span>
                <button
                  onClick={() => increment(f.id)}
                  className="w-7 h-7 rounded-lg bg-muted text-foreground text-lg font-bold flex items-center justify-center hover:bg-accent transition-colors"
                >+</button>
              </div>
            </div>
          );
        })}
      </div>

      <button
        onClick={handleSave}
        disabled={saveMutation.isPending || !dirty}
        className="w-full py-3 rounded-xl text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <Save className="h-4 w-4 inline mr-1.5" />
        {saveMutation.isPending ? "저장 중..." : dirty ? "저장하기" : "저장됨"}
      </button>
    </div>
  );
}

// ── 광고 데이터 입력 폼 ────────────────────────────────────────────────────────
function AdEntryForm({ date }: { date: string }) {
  const utils = trpc.useUtils();
  const { data: existing, isLoading } = trpc.consultantData.getAdEntries.useQuery({ date });

  const emptyValues = (): AdValues => {
    const v: AdValues = {};
    for (const ch of AD_CHANNELS) {
      v[ch] = { impressions: 0, clicks: 0, visits: 0, inquiries: 0, notes: "" };
    }
    return v;
  };

  const [values, setValues] = useState<AdValues>(emptyValues);
  const [dirty, setDirty] = useState(false);
  const [openChannel, setOpenChannel] = useState<string | null>(null);

  useEffect(() => {
    const v = emptyValues();
    if (existing) {
      for (const e of existing) {
        v[e.channel] = {
          impressions: e.impressions ?? 0,
          clicks: e.clicks ?? 0,
          visits: e.visits ?? 0,
          inquiries: e.inquiries ?? 0,
          notes: e.notes ?? "",
        };
      }
    }
    setValues(v);
    setDirty(false);
  }, [existing, date]);

  const saveMutation = trpc.consultantData.saveAdEntries.useMutation({
    onSuccess: () => {
      toast.success("광고 데이터 저장됨");
      setDirty(false);
      utils.consultantData.invalidate();
    },
    onError: () => toast.error("저장 실패"),
  });

  function updateField(channel: string, field: keyof AdValues[string], val: number | string) {
    setValues(prev => ({
      ...prev,
      [channel]: { ...prev[channel], [field]: val },
    }));
    setDirty(true);
  }

  function handleSave() {
    const entries = AD_CHANNELS.map(ch => ({
      channel: ch,
      impressions: values[ch]?.impressions ?? 0,
      clicks: values[ch]?.clicks ?? 0,
      visits: values[ch]?.visits ?? 0,
      inquiries: values[ch]?.inquiries ?? 0,
      notes: values[ch]?.notes || undefined,
    }));
    saveMutation.mutate({ date, entries });
  }

  if (isLoading) {
    return <div className="text-center text-muted-foreground py-8 text-sm">불러오는 중...</div>;
  }

  const dateLabel = (() => {
    const d = new Date(date + "T00:00:00");
    return `${d.getMonth() + 1}월 ${d.getDate()}일`;
  })();

  const CHANNEL_COLORS: Record<string, string> = {
    "검색광고": "border-blue-500/40 bg-blue-500/5",
    "파워링크": "border-sky-500/40 bg-sky-500/5",
    "플레이스": "border-emerald-500/40 bg-emerald-500/5",
    "당근": "border-orange-500/40 bg-orange-500/5",
    "블로그": "border-green-500/40 bg-green-500/5",
  };

  const CHANNEL_TEXT: Record<string, string> = {
    "검색광고": "text-blue-400",
    "파워링크": "text-sky-400",
    "플레이스": "text-emerald-400",
    "당근": "text-orange-400",
    "블로그": "text-green-400",
  };

  const NUM_FIELDS: { key: "impressions" | "clicks" | "visits" | "inquiries"; label: string; requiresInquiry?: boolean }[] = [
    { key: "impressions", label: "노출 수" },
    { key: "clicks", label: "클릭 수" },
    { key: "visits", label: "방문/유입 수" },
    { key: "inquiries", label: "문의 수", requiresInquiry: true },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-foreground">{dateLabel} 광고 데이터</p>
        {dirty && (
          <button
            onClick={handleSave}
            disabled={saveMutation.isPending}
            className="flex items-center gap-1.5 bg-primary text-primary-foreground px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-primary/90 disabled:opacity-50"
          >
            <Save className="h-3.5 w-3.5" />
            {saveMutation.isPending ? "저장 중..." : "저장"}
          </button>
        )}
      </div>

      <div className="space-y-2">
        {AD_CHANNELS.map(ch => {
          const isOpen = openChannel === ch;
          const v = values[ch] ?? { impressions: 0, clicks: 0, visits: 0, inquiries: 0, notes: "" };
          const hasData = v.impressions > 0 || v.clicks > 0 || v.visits > 0 || v.inquiries > 0 || (v.notes?.length ?? 0) > 0;
          const hasInquiry = CHANNELS_WITH_INQUIRY.has(ch);

          return (
            <div key={ch} className={`rounded-xl border overflow-hidden transition-colors ${isOpen ? CHANNEL_COLORS[ch] : "border-border bg-card"}`}>
              <button
                onClick={() => setOpenChannel(isOpen ? null : ch)}
                className="w-full flex items-center justify-between px-4 py-3"
              >
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-semibold ${isOpen ? CHANNEL_TEXT[ch] : "text-foreground"}`}>{ch}</span>
                  {hasData && !isOpen && (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  )}
                </div>
                <span className={`text-xs transition-transform ${isOpen ? "rotate-180" : ""}`}>▼</span>
              </button>

              {isOpen && (
                <div className="px-4 pb-4 space-y-2.5">
                  {NUM_FIELDS.map(({ key, label, requiresInquiry }) => {
                    if (requiresInquiry && !hasInquiry) return null;
                    const val = (v as any)[key] ?? 0;
                    return (
                      <div key={key} className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">{label}</span>
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => { if (val > 0) updateField(ch, key, val - 1); }}
                            className="w-7 h-7 rounded-lg bg-muted text-foreground text-lg font-bold flex items-center justify-center hover:bg-accent transition-colors"
                          >−</button>
                          <input
                            type="number"
                            min={0}
                            value={val || ""}
                            onChange={e => updateField(ch, key, Math.max(0, parseInt(e.target.value) || 0))}
                            placeholder="0"
                            className="w-20 text-center text-sm font-semibold tabular-nums bg-background border border-border rounded-lg py-1 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                          />
                          <button
                            onClick={() => updateField(ch, key, val + 1)}
                            className="w-7 h-7 rounded-lg bg-muted text-foreground text-lg font-bold flex items-center justify-center hover:bg-accent transition-colors"
                          >+</button>
                        </div>
                      </div>
                    );
                  })}
                  <div className="pt-1">
                    <span className="text-xs text-muted-foreground">특이사항</span>
                    <textarea
                      value={v.notes ?? ""}
                      onChange={e => updateField(ch, "notes", e.target.value)}
                      placeholder="메모 입력..."
                      rows={2}
                      className="mt-1 w-full text-sm bg-background border border-border rounded-lg px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <button
        onClick={handleSave}
        disabled={saveMutation.isPending || !dirty}
        className="w-full py-3 rounded-xl text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <Save className="h-4 w-4 inline mr-1.5" />
        {saveMutation.isPending ? "저장 중..." : dirty ? "저장하기" : "저장됨"}
      </button>
    </div>
  );
}
