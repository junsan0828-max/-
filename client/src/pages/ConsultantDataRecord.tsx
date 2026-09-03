import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { ClipboardList, ChevronLeft, ChevronRight, Save, Megaphone, Building2, ChevronDown, FileText } from "lucide-react";

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

const AD_CHANNELS = ["파워링크", "플레이스", "당근", "블로그"] as const;
const CHANNELS_WITH_INQUIRY = new Set(["플레이스", "당근", "블로그"]);
const CHANNEL_BADGE: Record<string, { label: string; style: string }> = {
  "파워링크": { label: "자동화 작업 중", style: "text-violet-400 bg-violet-400/10" },
  "플레이스": { label: "자동화 작업 중", style: "text-violet-400 bg-violet-400/10" },
  "당근":     { label: "광고 시에만",    style: "text-orange-400 bg-orange-400/10" },
  "블로그":   { label: "방문 데이터",    style: "text-amber-400 bg-amber-400/10" },
};

const CONTENT_PLATFORM_BADGE: Record<string, { label: string; style: string }> = {
  "플레이스": { label: "금요일날 작업",  style: "text-violet-400 bg-violet-400/10" },
  "당근":     { label: "월 이벤트 공유", style: "text-orange-400 bg-orange-400/10" },
  "블로그":   { label: "월수금 작업",    style: "text-green-400 bg-green-400/10" },
};

const PLACE_CHECKS = ["업체정보 상세설명 수정", "업체 사진 추가", "예약상품 수정", "리뷰 댓글 작업"] as const;

type AdValues = Record<string, { impressions: number; clicks: number; visits: number; inquiries: number; notes: string }>;

const INSPECTION_AREAS = ["유산소 기구", "3층 소도구존", "2층 웨이트기구", "PT/케어존", "탈의실", "2층 거울", "3층 거울", "현장 이슈"] as const;
const FACILITY_STATUSES = ["정상", "주의", "이상"] as const;
const HYGIENE_STATUSES = ["양호", "청소 필요", "즉시 조치 필요"] as const;
const ACTION_STATUSES = ["미처리", "진행", "완료"] as const;

type InspectionValues = Record<string, {
  facilityStatus: string; hygieneStatus: string;
  issueNote: string; assignee: string;
  actionStatus: string; actionDate: string;
}>;

const CONTENT_PLATFORMS = ["플레이스", "당근", "블로그"] as const;

type ContentValues = Record<string, {
  published: boolean; publishCount: number; topic: string;
  publishDate: string; assignee: string; completed: boolean;
  autoStatus: string;
}>;

// ── 메인 페이지 ───────────────────────────────────────────────────────────────
export default function ConsultantDataRecordPage() {
  const now = new Date();
  const [mode, setMode] = useState<"ads" | "inspection" | "content">("ads");
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [selectedDate, setSelectedDate] = useState(TODAY);

  const grid = getWeekdayGrid(year, month);

  useEffect(() => {
    const allDays = grid.flatMap(w => w.days).filter(Boolean) as string[];
    if (!allDays.includes(selectedDate)) {
      const todayInMonth = allDays.find(d => d === TODAY);
      setSelectedDate(todayInMonth ?? allDays[allDays.length - 1] ?? TODAY);
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

  const activeDate = selectedDate;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold flex items-center gap-2">
        <ClipboardList className="h-5 w-5 text-primary" />데이터 기록
      </h1>

      {/* 모드 탭 */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
        {([
          { key: "ads" as const, label: "광고", icon: Megaphone },
          { key: "content" as const, label: "콘텐츠", icon: FileText },
          { key: "inspection" as const, label: "센터", icon: Building2 },
        ]).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setMode(key)}
            className={`flex items-center justify-center gap-1 py-2.5 px-3 rounded-xl text-xs font-medium border transition-colors whitespace-nowrap shrink-0 ${
              mode === key
                ? "bg-primary/20 text-primary border-primary/40"
                : "bg-card border-border text-muted-foreground hover:bg-accent"
            }`}
          >
            <Icon className="h-3.5 w-3.5" />{label}
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

      <DailyView
        year={year} month={month} grid={grid}
        selectedDate={selectedDate} onSelectDate={setSelectedDate}
        section={mode}
      />

      {activeDate && mode === "ads" && (
        <AdEntryForm date={selectedDate} />
      )}

      {activeDate && mode === "content" && (
        <ContentForm date={selectedDate} />
      )}

      {activeDate && mode === "inspection" && (
        <InspectionForm date={selectedDate} />
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
  section: "ads" | "inspection" | "content";
}) {
  const { data: adDatesWithData } = trpc.consultantData.getAdDatesWithData.useQuery(
    { year, month },
    { enabled: section === "ads" }
  );
  const { data: inspectionDatesWithData } = trpc.consultantData.getInspectionDatesWithData.useQuery(
    { year, month },
    { enabled: section === "inspection" }
  );
  const { data: contentDatesWithData } = trpc.consultantData.getContentDatesWithData.useQuery(
    { year, month },
    { enabled: section === "content" }
  );
  const dateDotSet = new Set(
    section === "ads" ? (adDatesWithData ?? [])
    : section === "inspection" ? (inspectionDatesWithData ?? [])
    : (contentDatesWithData ?? [])
  );

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
    "파워링크": "border-sky-500/40 bg-sky-500/5",
    "플레이스": "border-emerald-500/40 bg-emerald-500/5",
    "당근": "border-orange-500/40 bg-orange-500/5",
    "블로그": "border-green-500/40 bg-green-500/5",
  };

  const CHANNEL_TEXT: Record<string, string> = {
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

      <div className="flex items-center gap-2 px-1 py-2 rounded-lg bg-amber-400/10 border border-amber-400/30">
        <span className="text-amber-400 text-xs">📅</span>
        <span className="text-xs text-amber-400 font-medium">매주 금요일 작성</span>
      </div>

      <div className="space-y-2">
        {AD_CHANNELS.map(ch => {
          const isOpen = openChannel === ch;
          const v = values[ch] ?? { impressions: 0, clicks: 0, visits: 0, inquiries: 0, notes: "" };
          const hasData = v.impressions > 0 || v.clicks > 0 || v.visits > 0 || v.inquiries > 0 || (v.notes?.length ?? 0) > 0;
          const hasInquiry = CHANNELS_WITH_INQUIRY.has(ch);
          const badge = CHANNEL_BADGE[ch];

          return (
            <div key={ch} className={`rounded-xl border overflow-hidden transition-colors ${isOpen ? CHANNEL_COLORS[ch] : "border-border bg-card"}`}>
              <button
                onClick={() => setOpenChannel(isOpen ? null : ch)}
                className="w-full flex items-center justify-between px-4 py-3"
              >
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-semibold ${isOpen ? CHANNEL_TEXT[ch] : "text-foreground"}`}>{ch}</span>
                  {badge && (
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${badge.style}`}>{badge.label}</span>
                  )}
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

// ── 센터 점검 입력 폼 ─────────────────────────────────────────────────────────
function InspectionForm({ date }: { date: string }) {
  const utils = trpc.useUtils();
  const { data: existing, isLoading } = trpc.consultantData.getInspectionEntries.useQuery({ date });
  const { data: staffList } = trpc.consultantData.listStaff.useQuery();
  const { data: me } = trpc.auth.me.useQuery();
  const isAdmin = ["admin", "sub_admin"].includes((me as any)?.role ?? "");
  const { data: reviewData, refetch: refetchReview } = trpc.consultantData.getInspectionDateReviewStatus.useQuery({ date });
  const reviewStatus = reviewData?.reviewStatus ?? "미점검";
  const setReviewMutation = trpc.consultantData.setInspectionDateReview.useMutation({
    onSuccess: () => { refetchReview(); toast.success("점검 상태 업데이트됨"); },
    onError: () => toast.error("업데이트 실패"),
  });

  const emptyValues = (): InspectionValues => {
    const v: InspectionValues = {};
    for (const area of INSPECTION_AREAS) {
      v[area] = { facilityStatus: "정상", hygieneStatus: "양호", issueNote: "", assignee: "", actionStatus: "", actionDate: "" };
    }
    return v;
  };

  const [values, setValues] = useState<InspectionValues>(emptyValues);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    const v = emptyValues();
    if (existing) {
      for (const e of existing) {
        v[e.area] = {
          facilityStatus: e.facilityStatus ?? "정상",
          hygieneStatus: e.hygieneStatus ?? "양호",
          issueNote: e.issueNote ?? "",
          assignee: e.assignee ?? "",
          actionStatus: e.actionStatus ?? "",
          actionDate: e.actionDate ?? "",
        };
      }
    }
    setValues(v);
    setDirty(false);
  }, [existing, date]);

  const saveMutation = trpc.consultantData.saveInspectionEntries.useMutation({
    onSuccess: () => {
      toast.success("센터 점검 저장됨");
      setDirty(false);
      utils.consultantData.invalidate();
    },
    onError: () => toast.error("저장 실패"),
  });

  function updateField(area: string, field: keyof InspectionValues[string], val: string) {
    setValues(prev => ({
      ...prev,
      [area]: { ...prev[area], [field]: val },
    }));
    setDirty(true);
  }

  function handleSave() {
    const entries = INSPECTION_AREAS.map(area => {
      const v = values[area];
      return {
        area,
        facilityStatus: (v?.facilityStatus ?? "정상") as "정상" | "주의" | "이상",
        hygieneStatus: (v?.hygieneStatus ?? "양호") as "양호" | "청소 필요" | "즉시 조치 필요",
        issueNote: v?.issueNote || undefined,
        assignee: v?.assignee || undefined,
        actionStatus: (v?.actionStatus || undefined) as "미처리" | "진행" | "완료" | undefined,
        actionDate: v?.actionDate || undefined,
      };
    });
    saveMutation.mutate({ date, entries });
  }

  if (isLoading) {
    return <div className="text-center text-muted-foreground py-8 text-sm">불러오는 중...</div>;
  }

  const dateLabel = (() => {
    const d = new Date(date + "T00:00:00");
    return `${d.getMonth() + 1}월 ${d.getDate()}일`;
  })();

  const FACILITY_COLORS: Record<string, string> = {
    "정상": "bg-green-500/20 text-green-400 border-green-500/30",
    "주의": "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    "이상": "bg-red-500/20 text-red-400 border-red-500/30",
  };
  const HYGIENE_COLORS: Record<string, string> = {
    "양호": "bg-green-500/20 text-green-400 border-green-500/30",
    "청소 필요": "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    "즉시 조치 필요": "bg-red-500/20 text-red-400 border-red-500/30",
  };
  const ACTION_COLORS: Record<string, string> = {
    "미처리": "bg-red-500/20 text-red-400 border-red-500/30",
    "진행": "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    "완료": "bg-green-500/20 text-green-400 border-green-500/30",
  };

  function hasIssue(area: string) {
    const v = values[area];
    return v && (v.facilityStatus !== "정상" || v.hygieneStatus !== "양호");
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <p className="text-sm font-semibold text-foreground">{dateLabel} 센터 점검</p>
          {isAdmin ? (
            <button
              onClick={() => setReviewMutation.mutate({ date, status: reviewStatus === "점검완료" ? "미점검" : "점검완료" })}
              disabled={setReviewMutation.isPending}
              className={`text-[10px] px-2 py-0.5 rounded border font-medium transition-colors ${reviewStatus === "점검완료" ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/25" : "bg-amber-500/15 text-amber-400 border-amber-500/30 hover:bg-amber-500/25"}`}
            >
              {reviewStatus}
            </button>
          ) : (
            <span className={`text-[10px] px-2 py-0.5 rounded border font-medium ${reviewStatus === "점검완료" ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" : "bg-amber-500/15 text-amber-400 border-amber-500/30"}`}>
              {reviewStatus}
            </span>
          )}
        </div>
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
        {INSPECTION_AREAS.map(area => {
          const v = values[area] ?? emptyValues()[area];
          const issue = hasIssue(area);

          return (
            <div key={area} className={`rounded-xl border overflow-hidden transition-colors ${
              issue ? "border-yellow-500/40 bg-yellow-500/5" : "border-border bg-card"
            }`}>
              <div className="px-4 py-3 space-y-2.5">
                <span className="text-sm font-semibold text-foreground">{area}</span>
                <div className="flex gap-1.5">
                  {FACILITY_STATUSES.map(s => (
                    <button
                      key={s}
                      onClick={() => updateField(area, "facilityStatus", s)}
                      className={`flex-1 py-1.5 rounded-lg text-[11px] font-medium border transition-colors ${
                        v.facilityStatus === s ? FACILITY_COLORS[s] : "border-border text-muted-foreground hover:bg-accent"
                      }`}
                    >{s}</button>
                  ))}
                </div>
                <div className="flex gap-1.5">
                  {HYGIENE_STATUSES.map(s => (
                    <button
                      key={s}
                      onClick={() => updateField(area, "hygieneStatus", s)}
                      className={`flex-1 py-1.5 rounded-lg text-[11px] font-medium border transition-colors ${
                        v.hygieneStatus === s ? HYGIENE_COLORS[s] : "border-border text-muted-foreground hover:bg-accent"
                      }`}
                    >{s}</button>
                  ))}
                </div>
              </div>

              {issue && (
                <div className="px-4 pb-3 space-y-2.5 border-t border-border/50 pt-2.5">
                  <textarea
                    value={v.issueNote}
                    onChange={e => updateField(area, "issueNote", e.target.value)}
                    placeholder="문제 상세 내용..."
                    rows={2}
                    className="w-full text-sm bg-background border border-border rounded-lg px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                  />
                  <div className="flex gap-2">
                    <select
                      value={v.assignee}
                      onChange={e => updateField(area, "assignee", e.target.value)}
                      className="flex-1 text-sm bg-background border border-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      <option value="">담당자</option>
                      {staffList?.map(s => (
                        <option key={s.id} value={s.name}>{s.name}</option>
                      ))}
                    </select>
                    <div className="flex gap-1">
                      {ACTION_STATUSES.map(s => (
                        <button
                          key={s}
                          onClick={() => updateField(area, "actionStatus", s)}
                          className={`px-2.5 py-2 rounded-lg text-[11px] font-medium border transition-colors ${
                            v.actionStatus === s ? ACTION_COLORS[s] : "border-border text-muted-foreground hover:bg-accent"
                          }`}
                        >{s}</button>
                      ))}
                    </div>
                  </div>
                  {v.actionStatus === "완료" && (
                    <input
                      type="date"
                      value={v.actionDate}
                      onChange={e => updateField(area, "actionDate", e.target.value)}
                      className="w-full text-sm bg-background border border-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  )}
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

// ── 콘텐츠 관리 입력 폼 ───────────────────────────────────────────────────────
function ContentForm({ date }: { date: string }) {
  const utils = trpc.useUtils();
  const { data: existing, isLoading } = trpc.consultantData.getContentEntries.useQuery({ date });
  const { data: staffList } = trpc.consultantData.listStaff.useQuery();

  const emptyValues = (): ContentValues => {
    const v: ContentValues = {};
    for (const p of CONTENT_PLATFORMS) {
      v[p] = { published: false, publishCount: 0, topic: "", publishDate: date, assignee: "", completed: false, autoStatus: "" };
    }
    return v;
  };

  const [values, setValues] = useState<ContentValues>(emptyValues);
  const [dirty, setDirty] = useState(false);
  const [openPlatform, setOpenPlatform] = useState<string | null>(null);

  useEffect(() => {
    const v = emptyValues();
    if (existing) {
      for (const e of existing) {
        v[e.platform] = {
          published: e.published ?? false,
          publishCount: e.publishCount ?? 0,
          topic: e.topic ?? "",
          publishDate: e.publishDate || date,
          assignee: e.assignee ?? "",
          completed: e.completed ?? false,
          autoStatus: e.autoStatus ?? "",
        };
      }
    }
    setValues(v);
    setDirty(false);
  }, [existing, date]);

  const saveMutation = trpc.consultantData.saveContentEntries.useMutation({
    onSuccess: () => {
      toast.success("콘텐츠 데이터 저장됨");
      setDirty(false);
      utils.consultantData.invalidate();
    },
    onError: () => toast.error("저장 실패"),
  });

  function updateField(platform: string, field: keyof ContentValues[string], val: any) {
    setValues(prev => ({
      ...prev,
      [platform]: { ...prev[platform], [field]: val },
    }));
    setDirty(true);
  }

  function handleSave() {
    const entries = CONTENT_PLATFORMS.map(p => {
      const v = values[p];
      return {
        platform: p,
        published: v?.published ?? false,
        publishCount: v?.publishCount ?? 0,
        topic: v?.topic || undefined,
        publishDate: v?.publishDate || undefined,
        assignee: v?.assignee || undefined,
        completed: v?.completed ?? false,
        autoStatus: (v?.autoStatus || undefined) as "정상" | "오류" | undefined,
      };
    });
    saveMutation.mutate({ date, entries });
  }

  if (isLoading) {
    return <div className="text-center text-muted-foreground py-8 text-sm">불러오는 중...</div>;
  }

  const dateLabel = (() => {
    const d = new Date(date + "T00:00:00");
    return `${d.getMonth() + 1}월 ${d.getDate()}일`;
  })();

  const PLATFORM_COLORS: Record<string, string> = {
    "플레이스": "border-emerald-500/40 bg-emerald-500/5",
    "당근": "border-orange-500/40 bg-orange-500/5",
    "블로그": "border-green-500/40 bg-green-500/5",
  };
  const PLATFORM_TEXT: Record<string, string> = {
    "플레이스": "text-emerald-400",
    "당근": "text-orange-400",
    "블로그": "text-green-400",
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-foreground">{dateLabel} 콘텐츠 관리</p>
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
        {CONTENT_PLATFORMS.map(platform => {
          const isOpen = openPlatform === platform;
          const v = values[platform] ?? emptyValues()[platform];
          const hasData = existing?.some(e => e.platform === platform);
          const platformBadge = CONTENT_PLATFORM_BADGE[platform];

          return (
            <div key={platform} className={`rounded-xl border overflow-hidden transition-colors ${isOpen ? PLATFORM_COLORS[platform] : "border-border bg-card"}`}>
              <button
                onClick={() => setOpenPlatform(isOpen ? null : platform)}
                className="w-full flex items-center justify-between px-4 py-3"
              >
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-semibold ${isOpen ? PLATFORM_TEXT[platform] : "text-foreground"}`}>{platform}</span>
                  {platformBadge && (
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${platformBadge.style}`}>{platformBadge.label}</span>
                  )}
                  {hasData && !isOpen && (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  )}
                  {!isOpen && v.completed && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-500/20 text-green-400">완료</span>
                  )}
                  {!isOpen && !v.completed && v.published && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400">발행됨</span>
                  )}
                </div>
                <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
              </button>

              {isOpen && (
                <div className="px-4 pb-4 space-y-3">
                  {/* 발행 여부 */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground font-medium">발행 여부</span>
                    <button
                      onClick={() => updateField(platform, "published", !v.published)}
                      className={`relative w-11 h-6 rounded-full transition-colors ${v.published ? "bg-primary" : "bg-muted"}`}
                    >
                      <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${v.published ? "translate-x-5.5 left-auto right-0.5" : "left-0.5"}`} />
                    </button>
                  </div>

                  {/* 플레이스 전용 체크리스트 */}
                  {platform === "플레이스" && (
                    <div className="space-y-1.5">
                      <span className="text-xs text-muted-foreground font-medium">작업 항목</span>
                      {PLACE_CHECKS.map(item => {
                        const checked = v.topic.split("|").includes(item);
                        return (
                          <button
                            key={item}
                            onClick={() => {
                              const set = new Set(v.topic.split("|").filter(Boolean));
                              if (checked) set.delete(item); else set.add(item);
                              updateField(platform, "topic", [...set].join("|"));
                            }}
                            className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg border text-left transition-colors ${
                              checked
                                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                                : "bg-card border-border text-muted-foreground hover:bg-accent"
                            }`}
                          >
                            <span className={`w-4 h-4 rounded border flex items-center justify-center text-[10px] font-bold shrink-0 ${
                              checked ? "bg-emerald-500 border-emerald-500 text-white" : "border-border"
                            }`}>{checked ? "✓" : ""}</span>
                            <span className="text-xs">{item}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* 발행일 */}
                  <div>
                    <span className="text-xs text-muted-foreground">발행일</span>
                    <input
                      type="date"
                      value={v.publishDate}
                      onChange={e => updateField(platform, "publishDate", e.target.value)}
                      className="mt-1 w-full text-sm bg-background border border-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>

                  {/* 담당자 */}
                  <div>
                    <span className="text-xs text-muted-foreground">담당자</span>
                    <select
                      value={v.assignee}
                      onChange={e => updateField(platform, "assignee", e.target.value)}
                      className="mt-1 w-full text-sm bg-background border border-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      <option value="">선택 안 함</option>
                      {staffList?.map(s => (
                        <option key={s.id} value={s.name}>{s.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* 완료/미완료 */}
                  <div>
                    <span className="text-xs text-muted-foreground font-medium">진행 상태</span>
                    <div className="flex gap-1.5 mt-1.5">
                      {([false, true] as const).map(val => (
                        <button
                          key={String(val)}
                          onClick={() => updateField(platform, "completed", val)}
                          className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-colors ${
                            v.completed === val
                              ? val ? "bg-green-500/20 text-green-400 border-green-500/30" : "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"
                              : "border-border text-muted-foreground hover:bg-accent"
                          }`}
                        >{val ? "완료" : "미완료"}</button>
                      ))}
                    </div>
                  </div>

                  {/* 당근 자동화 상태 */}
                  {platform === "당근" && (
                    <div>
                      <span className="text-xs text-muted-foreground font-medium">자동화 상태</span>
                      <div className="flex gap-1.5 mt-1.5">
                        {(["정상", "오류"] as const).map(s => (
                          <button
                            key={s}
                            onClick={() => updateField(platform, "autoStatus", v.autoStatus === s ? "" : s)}
                            className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-colors ${
                              v.autoStatus === s
                                ? s === "정상" ? "bg-green-500/20 text-green-400 border-green-500/30" : "bg-red-500/20 text-red-400 border-red-500/30"
                                : "border-border text-muted-foreground hover:bg-accent"
                            }`}
                          >{s}</button>
                        ))}
                      </div>
                    </div>
                  )}
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
