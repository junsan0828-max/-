import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader } from "@/components/ui/dialog";
import { GripVertical, Trash2, Plus, X, Video } from "lucide-react";

// ─── Constants ───────────────────────────────────────────

const CONDITION_EMOJI = ["😴", "😑", "😐", "☺️", "💪"];
const SLEEP_OPTIONS = ["4h↓", "5h", "6h", "7h", "8h", "9h+"];
const ENERGY_OPTIONS = ["낮음", "보통", "높음"];
const MAIN_BODY_PARTS = ["전신", "상체", "하체", "코어", "기타"];
const UPPER_BODY_SUBS = ["등", "어깨", "가슴", "팔"];
const LOWER_BODY_SUBS = ["엉덩이", "대퇴 후면", "대퇴 전면", "하퇴"];
const WORKOUT_THEMES = ["유산소 위주", "스트레칭 위주", "근력운동"];

const moodLabel: Record<string, string> = {
  great: "최고 💪", good: "좋음 😊", normal: "보통 😐", tired: "피곤 😴",
};
const moodColor: Record<string, string> = {
  great: "bg-green-500/20 text-green-400 border-green-500/30",
  good: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  normal: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  tired: "bg-red-500/20 text-red-400 border-red-500/30",
};

// ─── Helpers ─────────────────────────────────────────────

function scoreToMood(score: number | undefined): string {
  if (!score) return "normal";
  if (score >= 5) return "great";
  if (score >= 4) return "good";
  if (score >= 3) return "normal";
  return "tired";
}

function energyToIntensity(e: string | undefined): string | undefined {
  if (e === "높음") return "HIGH";
  if (e === "보통") return "MEDIUM";
  if (e === "낮음") return "LOW";
  return undefined;
}

function parseLogExercises(json: string | null | undefined): { name: string; detail: string; videoUrl?: string }[] {
  if (!json) return [];
  try {
    const arr = JSON.parse(json) as any[];
    return arr.map((ex) => {
      if (Array.isArray(ex.sets)) {
        const done = ex.sets.filter((s: any) => s.done);
        const src = done.length > 0 ? done : ex.sets;
        const detail = (src as any[])
          .filter((s) => s.reps || s.weight)
          .map((s) => `${s.reps || "-"}회${s.weight ? ` × ${s.weight}kg` : ""}`)
          .join(", ");
        return { name: ex.name, detail, videoUrl: ex.videoUrl ?? undefined };
      }
      const parts: string[] = [];
      if (ex.sets) parts.push(`${ex.sets}세트`);
      if (ex.reps) parts.push(`${ex.reps}회`);
      if (ex.weight) parts.push(`${ex.weight}kg`);
      return { name: ex.name, detail: parts.join(" × "), videoUrl: ex.videoUrl ?? undefined };
    });
  } catch {
    return [];
  }
}

// ─── Workout Record Modal ─────────────────────────────────

function WorkoutRecordModal({ onClose, onSubmit, isPending }: {
  onClose: () => void;
  onSubmit: (data: {
    exerciseNames: string[];
    conditionScore?: number;
    sleepHours?: string;
    energyLevel?: string;
    bodyParts: string[];
    workoutTheme: string[];
  }) => void;
  isPending: boolean;
}) {
  const [exerciseNames, setExerciseNames] = useState<string[]>([""]);
  const [conditionScore, setConditionScore] = useState<number | undefined>();
  const [sleepHours, setSleepHours] = useState<string | undefined>();
  const [energyLevel, setEnergyLevel] = useState<string | undefined>();
  const [bodyParts, setBodyParts] = useState<string[]>([]);
  const [workoutTheme, setWorkoutTheme] = useState<string[]>([]);

  const showUpperSubs = bodyParts.includes("상체");
  const showLowerSubs = bodyParts.includes("하체");

  function updateName(i: number, v: string) {
    setExerciseNames((p) => { const n = [...p]; n[i] = v; return n; });
  }
  function removeName(i: number) {
    setExerciseNames((p) => p.filter((_, j) => j !== i));
  }

  function toggleMain(p: string) {
    setBodyParts((prev) => {
      if (prev.includes(p)) {
        const subs = p === "상체" ? UPPER_BODY_SUBS : p === "하체" ? LOWER_BODY_SUBS : [];
        return prev.filter((v) => v !== p && !subs.includes(v));
      }
      return [...prev, p];
    });
  }
  function toggleSub(p: string) {
    setBodyParts((prev) => prev.includes(p) ? prev.filter((v) => v !== p) : [...prev, p]);
  }
  function toggleArr<T>(arr: T[], val: T): T[] {
    return arr.includes(val) ? arr.filter((v) => v !== val) : [...arr, val];
  }

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center px-4" onClick={onClose}>
      <div
        className="bg-background w-full max-w-md rounded-3xl max-h-[90vh] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="px-5 pt-5 pb-4 border-b border-border flex items-center justify-between shrink-0">
          <div>
            <h2 className="font-bold text-lg">운동 기록하기</h2>
            <p className="text-xs text-muted-foreground mt-0.5">오늘의 운동을 기록하세요</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 스크롤 콘텐츠 */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

          {/* 운동 종목 */}
          <div>
            <p className="text-sm font-semibold mb-2">운동 종목</p>
            <div className="space-y-2">
              {exerciseNames.map((n, i) => (
                <div key={i} className="flex items-center gap-2 bg-muted/30 border border-border rounded-xl px-3 py-2">
                  <GripVertical className="w-4 h-4 text-muted-foreground/30 shrink-0" />
                  <Input
                    placeholder="예: 스쿼트"
                    value={n}
                    onChange={(e) => updateName(i, e.target.value)}
                    className="bg-transparent border-0 text-sm h-7 p-0 focus-visible:ring-0 placeholder:text-muted-foreground/40"
                  />
                  <button onClick={() => removeName(i)} className="text-red-400/50 hover:text-red-400 shrink-0">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={() => setExerciseNames((p) => [...p, ""])}
              className="mt-2 w-full flex items-center justify-center gap-1.5 border border-dashed border-border/60 text-muted-foreground text-sm py-2.5 rounded-xl hover:border-primary/40 hover:text-primary/80 transition-colors"
            >
              <Plus className="w-4 h-4" /> 운동 종목 추가
            </button>
          </div>

          {/* 오늘 컨디션 */}
          <div>
            <p className="text-sm font-semibold mb-2">오늘 컨디션</p>
            <div className="grid grid-cols-5 gap-2">
              {CONDITION_EMOJI.map((emoji, i) => (
                <button key={i} onClick={() => setConditionScore(conditionScore === i + 1 ? undefined : i + 1)}
                  className={`flex flex-col items-center gap-1 py-3 rounded-2xl border text-xl transition-colors ${conditionScore === i + 1 ? "border-primary bg-primary/10" : "border-border bg-muted/30"}`}>
                  {emoji}
                  <span className="text-[10px] text-muted-foreground">{i + 1}점</span>
                </button>
              ))}
            </div>
          </div>

          {/* 수면 시간 */}
          <div>
            <p className="text-sm font-semibold mb-2">수면 시간</p>
            <div className="grid grid-cols-6 gap-1.5">
              {SLEEP_OPTIONS.map((h) => (
                <button key={h} onClick={() => setSleepHours(sleepHours === h ? undefined : h)}
                  className={`py-2.5 rounded-xl border text-xs font-medium transition-colors ${sleepHours === h ? "border-primary bg-primary/10 text-primary" : "border-border bg-muted/30 text-foreground"}`}>
                  {h}
                </button>
              ))}
            </div>
          </div>

          {/* 에너지 상태 */}
          <div>
            <p className="text-sm font-semibold mb-2">에너지 상태</p>
            <div className="grid grid-cols-3 gap-2">
              {ENERGY_OPTIONS.map((e) => (
                <button key={e} onClick={() => setEnergyLevel(energyLevel === e ? undefined : e)}
                  className={`py-2.5 rounded-2xl border text-sm font-medium transition-colors ${energyLevel === e ? "border-primary bg-primary/10 text-primary" : "border-border bg-muted/30 text-foreground"}`}>
                  {e}
                </button>
              ))}
            </div>
          </div>

          {/* 오늘의 운동 부위 */}
          <div>
            <p className="text-sm font-semibold mb-2">오늘의 운동 부위 <span className="text-xs text-muted-foreground font-normal">(중복 선택 가능)</span></p>
            <div className="flex flex-wrap gap-2">
              {MAIN_BODY_PARTS.map((p) => (
                <button key={p} onClick={() => toggleMain(p)}
                  className={`px-4 py-2 rounded-full border text-sm font-medium transition-colors ${bodyParts.includes(p) ? "border-primary bg-primary/10 text-primary" : "border-border bg-muted/30 text-foreground"}`}>
                  {p}
                </button>
              ))}
            </div>
            {showUpperSubs && (
              <div className="mt-2 pl-3 border-l-2 border-primary/30">
                <p className="text-xs text-muted-foreground mb-1.5">상체 세부 부위</p>
                <div className="flex flex-wrap gap-2">
                  {UPPER_BODY_SUBS.map((p) => (
                    <button key={p} onClick={() => toggleSub(p)}
                      className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-colors ${bodyParts.includes(p) ? "border-primary bg-primary/10 text-primary" : "border-border bg-muted/20 text-foreground"}`}>
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {showLowerSubs && (
              <div className="mt-2 pl-3 border-l-2 border-primary/30">
                <p className="text-xs text-muted-foreground mb-1.5">하체 세부 부위</p>
                <div className="flex flex-wrap gap-2">
                  {LOWER_BODY_SUBS.map((p) => (
                    <button key={p} onClick={() => toggleSub(p)}
                      className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-colors ${bodyParts.includes(p) ? "border-primary bg-primary/10 text-primary" : "border-border bg-muted/20 text-foreground"}`}>
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 오늘의 운동 주제 */}
          <div>
            <p className="text-sm font-semibold mb-2">오늘의 운동 주제 <span className="text-xs text-muted-foreground font-normal">(중복 선택 가능)</span></p>
            <div className="flex flex-wrap gap-2">
              {WORKOUT_THEMES.map((t) => (
                <button key={t} onClick={() => setWorkoutTheme((prev) => toggleArr(prev, t))}
                  className={`px-4 py-2 rounded-full border text-sm font-medium transition-colors ${workoutTheme.includes(t) ? "border-primary bg-primary/10 text-primary" : "border-border bg-muted/30 text-foreground"}`}>
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 하단 버튼 */}
        <div className="px-5 py-4 border-t border-border flex gap-3 shrink-0">
          <button
            onClick={onClose}
            className="flex-1 border border-border rounded-2xl py-3 text-sm font-semibold text-foreground hover:bg-muted/50 transition-colors">
            취소
          </button>
          <button
            onClick={() => onSubmit({ exerciseNames, conditionScore, sleepHours, energyLevel, bodyParts, workoutTheme })}
            disabled={isPending}
            className="flex-1 bg-primary text-primary-foreground font-bold py-3 rounded-2xl text-sm active:scale-95 transition-transform disabled:opacity-60">
            {isPending ? "저장 중..." : "운동 완료"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Manual Entry Exercise Form ───────────────────────────

interface SimpleExercise {
  name: string;
  sets: string;
  reps: string;
  weight: string;
}

function ManualExerciseForm({ exercises, setExercises }: { exercises: SimpleExercise[]; setExercises: (v: SimpleExercise[]) => void }) {
  const add = () => setExercises([...exercises, { name: "", sets: "", reps: "", weight: "" }]);
  const update = (i: number, field: keyof SimpleExercise, val: string) => {
    const next = [...exercises];
    next[i] = { ...next[i], [field]: val };
    setExercises(next);
  };
  const remove = (i: number) => setExercises(exercises.filter((_, j) => j !== i));

  return (
    <div className="space-y-2">
      {exercises.map((ex, i) => (
        <div key={i} className="bg-muted/50 rounded-xl p-3 space-y-2">
          <div className="flex items-center gap-2">
            <Input placeholder="운동명" value={ex.name} onChange={(e) => update(i, "name", e.target.value)}
              className="bg-background text-sm h-8" />
            <button onClick={() => remove(i)} className="text-red-400 shrink-0">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            <div>
              <p className="text-[10px] text-muted-foreground mb-0.5">세트</p>
              <Input placeholder="3" value={ex.sets} onChange={(e) => update(i, "sets", e.target.value)}
                className="bg-background text-sm h-7 text-center" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground mb-0.5">횟수</p>
              <Input placeholder="12" value={ex.reps} onChange={(e) => update(i, "reps", e.target.value)}
                className="bg-background text-sm h-7 text-center" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground mb-0.5">무게(kg)</p>
              <Input placeholder="60" value={ex.weight} onChange={(e) => update(i, "weight", e.target.value)}
                className="bg-background text-sm h-7 text-center" />
            </div>
          </div>
        </div>
      ))}
      <Button variant="outline" size="sm" className="w-full text-xs h-8" onClick={add}>+ 운동 추가</Button>
    </div>
  );
}

// ─── Intensity badge ──────────────────────────────────────

function IntensityBadge({ v }: { v: string }) {
  const cls = v === "HIGH" ? "bg-red-500/20 text-red-400 border-red-500/30"
    : v === "MEDIUM" ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"
    : "bg-blue-500/20 text-blue-400 border-blue-500/30";
  return <span className={`text-[10px] px-2 py-0.5 rounded-full border ${cls}`}>{v}</span>;
}

// ─── Manual log form data ─────────────────────────────────

interface LogFormData {
  logDate: string;
  title: string;
  durationMinutes: string;
  caloriesBurned: string;
  bodyWeight: string;
  notes: string;
  mood: string;
}

// ─── Main Component ───────────────────────────────────────

export default function FitStepPlusWorkout() {
  const today = new Date().toISOString().slice(0, 10);
  const [selectedMonth, setSelectedMonth] = useState(today.slice(0, 7));
  const [showRecordModal, setShowRecordModal] = useState(false);
  const [showManualForm, setShowManualForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<LogFormData>({ logDate: today, title: "", durationMinutes: "", caloriesBurned: "", bodyWeight: "", notes: "", mood: "good" });
  const [manualExercises, setManualExercises] = useState<SimpleExercise[]>([]);

  const utils = trpc.useUtils();
  const { data: logs, isLoading } = trpc.fitStepPlus.listWorkoutLogs.useQuery({ month: selectedMonth });

  const createMutation = trpc.fitStepPlus.createWorkoutLog.useMutation({
    onSuccess: () => {
      utils.fitStepPlus.listWorkoutLogs.invalidate();
      setShowRecordModal(false);
      setShowManualForm(false);
      resetManualForm();
      toast.success("운동 기록이 저장되었습니다 💪");
    },
    onError: (err) => toast.error(err.message),
  });

  const updateMutation = trpc.fitStepPlus.updateWorkoutLog.useMutation({
    onSuccess: () => {
      utils.fitStepPlus.listWorkoutLogs.invalidate();
      setShowManualForm(false);
      setEditingId(null);
      resetManualForm();
      toast.success("운동 기록이 수정되었습니다");
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = trpc.fitStepPlus.deleteWorkoutLog.useMutation({
    onSuccess: () => { utils.fitStepPlus.listWorkoutLogs.invalidate(); toast.success("운동 기록이 삭제되었습니다"); },
    onError: (err) => toast.error(err.message),
  });

  function resetManualForm() {
    setForm({ logDate: today, title: "", durationMinutes: "", caloriesBurned: "", bodyWeight: "", notes: "", mood: "good" });
    setManualExercises([]);
  }

  function openEdit(log: any) {
    setForm({
      logDate: log.logDate, title: log.title ?? "",
      durationMinutes: log.durationMinutes?.toString() ?? "",
      caloriesBurned: log.caloriesBurned?.toString() ?? "",
      bodyWeight: log.bodyWeight ?? "", notes: log.notes ?? "", mood: log.mood ?? "good",
    });
    try {
      const parsed = log.exercisesJson ? JSON.parse(log.exercisesJson) : [];
      if (Array.isArray(parsed) && parsed[0] && Array.isArray(parsed[0].sets)) {
        setManualExercises(parsed.map((ex: any) => ({
          name: ex.name, sets: ex.sets.length.toString(),
          reps: ex.sets[0]?.reps ?? "", weight: ex.sets[0]?.weight ?? "",
        })));
      } else {
        setManualExercises(parsed);
      }
    } catch { setManualExercises([]); }
    setEditingId(log.id);
    setShowManualForm(true);
  }

  function submitManualForm() {
    const data = {
      ...form,
      durationMinutes: form.durationMinutes ? parseInt(form.durationMinutes) : undefined,
      caloriesBurned: form.caloriesBurned ? parseInt(form.caloriesBurned) : undefined,
      exercisesJson: manualExercises.length > 0 ? JSON.stringify(manualExercises) : undefined,
    };
    if (editingId) { updateMutation.mutate({ id: editingId, ...data }); }
    else { createMutation.mutate(data); }
  }

  function handleRecordSubmit(data: {
    exerciseNames: string[];
    conditionScore?: number;
    sleepHours?: string;
    energyLevel?: string;
    bodyParts: string[];
    workoutTheme: string[];
  }) {
    const validNames = data.exerciseNames.filter((n) => n.trim());
    const mood = scoreToMood(data.conditionScore);
    const intensity = energyToIntensity(data.energyLevel);

    const meta: Record<string, any> = {};
    if (data.sleepHours) meta.sleepHours = data.sleepHours;
    if (data.bodyParts.length) meta.bodyParts = data.bodyParts;
    if (data.workoutTheme.length) meta.workoutTheme = data.workoutTheme;

    createMutation.mutate({
      logDate: today,
      title: data.bodyParts.filter((p) => MAIN_BODY_PARTS.includes(p)).join(" + ") || "오늘의 운동",
      exercisesJson: validNames.length > 0 ? JSON.stringify(validNames.map((name) => ({ name }))) : undefined,
      mood,
      intensity,
      notes: Object.keys(meta).length > 0 ? JSON.stringify(meta) : undefined,
    });
  }

  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(); d.setMonth(d.getMonth() - i);
    return d.toISOString().slice(0, 7);
  });

  return (
    <>
      {showRecordModal && (
        <WorkoutRecordModal
          onClose={() => setShowRecordModal(false)}
          onSubmit={handleRecordSubmit}
          isPending={createMutation.isPending}
        />
      )}

      <div className="p-4 space-y-4">
        {/* 운동 시작 카드 */}
        <div className="bg-gradient-to-r from-primary/20 to-primary/5 border border-primary/30 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <p className="font-bold text-base">지금 운동할까요?</p>
            <p className="text-xs text-muted-foreground mt-0.5">종목과 오늘의 컨디션을 기록해요</p>
          </div>
          <button
            onClick={() => setShowRecordModal(true)}
            className="bg-primary text-primary-foreground font-bold text-sm px-4 py-2.5 rounded-xl active:scale-95 transition-transform"
          >
            운동 시작 ▶
          </button>
        </div>

        <div className="flex items-center justify-between">
          <h1 className="font-bold text-base">운동 기록</h1>
          <Button size="sm" className="h-8 text-xs" onClick={() => { resetManualForm(); setEditingId(null); setShowManualForm(true); }}>+ 직접 입력</Button>
        </div>

        {/* 월 탭 */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4">
          {months.map((m) => (
            <button key={m} onClick={() => setSelectedMonth(m)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${selectedMonth === m ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
              {m.replace("-", "년 ")}월
            </button>
          ))}
        </div>

        {/* 기록 목록 */}
        {isLoading ? (
          <div className="text-center py-10 text-muted-foreground text-sm">불러오는 중...</div>
        ) : !logs || logs.length === 0 ? (
          <div className="text-center py-10 space-y-3">
            <p className="text-muted-foreground text-sm">이 달의 운동 기록이 없습니다</p>
            <Button variant="outline" size="sm" onClick={() => setShowRecordModal(true)}>첫 기록 남기기</Button>
          </div>
        ) : (
          <div className="space-y-3">
            {logs.map((log) => {
              const exList = parseLogExercises(log.exercisesJson);
              let meta: any = {};
              try { if (log.notes && log.notes.startsWith("{")) meta = JSON.parse(log.notes); } catch {}
              return (
                <div key={log.id} className="bg-card border border-border rounded-xl p-4 space-y-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">{log.logDate}</p>
                      <p className="font-semibold text-sm mt-0.5">{log.title || "운동 기록"}</p>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => openEdit(log)} className="text-xs text-muted-foreground px-2 py-1 bg-muted rounded-lg">수정</button>
                      <button onClick={() => { if (confirm("삭제하시겠습니까?")) deleteMutation.mutate({ id: log.id }); }} className="text-xs text-red-400 px-2 py-1 bg-red-500/10 rounded-lg">삭제</button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {log.mood && <span className={`text-[10px] px-2 py-0.5 rounded-full border ${moodColor[log.mood] ?? "bg-muted text-muted-foreground"}`}>{moodLabel[log.mood] ?? log.mood}</span>}
                    {(log as any).intensity && <IntensityBadge v={(log as any).intensity} />}
                    {log.durationMinutes && <span className="text-[10px] text-muted-foreground">⏱ {log.durationMinutes}분</span>}
                    {log.caloriesBurned && <span className="text-[10px] text-muted-foreground">🔥 {log.caloriesBurned}kcal</span>}
                    {(log as any).totalVolume > 0 && <span className="text-[10px] text-muted-foreground">🏋️ {((log as any).totalVolume as number).toLocaleString()}kg</span>}
                  </div>
                  {meta.bodyParts?.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {(meta.bodyParts as string[]).map((p) => (
                        <span key={p} className="text-[10px] px-2 py-0.5 bg-primary/10 text-primary rounded-full">{p}</span>
                      ))}
                    </div>
                  )}
                  {exList.length > 0 && (
                    <div className="space-y-1.5">
                      {exList.map((ex, i) => (
                        <div key={i} className="space-y-0.5">
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span className="text-foreground font-medium">{ex.name}</span>
                            {ex.detail && <span>{ex.detail}</span>}
                          </div>
                          {ex.videoUrl && (
                            <a href={ex.videoUrl} target="_blank" rel="noreferrer"
                              className="inline-flex items-center gap-1 text-[11px] text-primary font-medium ml-0.5">
                              <Video className="h-3 w-3" />영상 보기
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  {log.notes && !log.notes.startsWith("{") && (
                    <p className="text-xs text-muted-foreground border-t border-border pt-2">{log.notes}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 직접 입력 다이얼로그 */}
      <Dialog open={showManualForm} onOpenChange={(o) => { setShowManualForm(o); if (!o) { setEditingId(null); resetManualForm(); } }}>
        <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <h2 className="font-bold text-base">{editingId ? "운동 기록 수정" : "운동 기록하기"}</h2>
          </DialogHeader>
          <div className="space-y-4 pb-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">날짜</Label>
              <Input type="date" value={form.logDate} onChange={(e) => setForm((p) => ({ ...p, logDate: e.target.value }))} className="bg-input border-border text-sm h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">제목 (선택)</Label>
              <Input placeholder="예: 가슴 운동, 하체 데이..." value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} className="bg-input border-border text-sm h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">오늘 컨디션</Label>
              <div className="grid grid-cols-4 gap-1.5">
                {Object.entries(moodLabel).map(([k, v]) => (
                  <button key={k} onClick={() => setForm((p) => ({ ...p, mood: k }))}
                    className={`py-1.5 rounded-lg text-xs font-medium transition-colors border ${form.mood === k ? moodColor[k] : "border-border text-muted-foreground"}`}>
                    {v}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">운동 목록</Label>
              <ManualExerciseForm exercises={manualExercises} setExercises={setManualExercises} />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">운동시간(분)</Label>
                <Input type="number" placeholder="60" value={form.durationMinutes} onChange={(e) => setForm((p) => ({ ...p, durationMinutes: e.target.value }))} className="bg-input border-border text-sm h-8 text-center" />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">칼로리(kcal)</Label>
                <Input type="number" placeholder="300" value={form.caloriesBurned} onChange={(e) => setForm((p) => ({ ...p, caloriesBurned: e.target.value }))} className="bg-input border-border text-sm h-8 text-center" />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">체중(kg)</Label>
                <Input placeholder="75" value={form.bodyWeight} onChange={(e) => setForm((p) => ({ ...p, bodyWeight: e.target.value }))} className="bg-input border-border text-sm h-8 text-center" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">메모</Label>
              <textarea placeholder="오늘 운동 메모를 입력하세요..." value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} rows={3}
                className="w-full bg-input border border-border rounded-lg p-2 text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => { setShowManualForm(false); setEditingId(null); resetManualForm(); }}>취소</Button>
              <Button className="flex-1" onClick={submitManualForm} disabled={createMutation.isPending || updateMutation.isPending}>
                {createMutation.isPending || updateMutation.isPending ? "저장 중..." : "저장"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
