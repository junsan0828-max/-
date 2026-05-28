import { useState, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader } from "@/components/ui/dialog";
import { GripVertical, Trash2, Plus, Check } from "lucide-react";

// ─── Types ───────────────────────────────────────────────

interface ActiveSet {
  reps: string;
  weight: string;
  done: boolean;
}

interface ActiveExercise {
  name: string;
  sets: ActiveSet[];
}

interface LogFormData {
  logDate: string;
  title: string;
  durationMinutes: string;
  caloriesBurned: string;
  bodyWeight: string;
  notes: string;
  mood: string;
}

// ─── Constants ───────────────────────────────────────────

const COMPOUND_KW = ["스쿼트", "데드리프트", "벤치", "랫풀", "런지", "로우", "딥스", "풀업", "프레스", "힙쓰러스트", "바벨"];
const LOWER_KW = ["스쿼트", "런지", "레그", "햄스트링", "종아리", "힙", "글루트", "하체", "대퇴"];
const FULL_KW = ["데드리프트", "클린", "스내치", "버피", "전신"];

const moodLabel: Record<string, string> = {
  great: "최고 💪", good: "좋음 😊", normal: "보통 😐", tired: "피곤 😴",
};
const moodColor: Record<string, string> = {
  great: "bg-green-500/20 text-green-400 border-green-500/30",
  good: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  normal: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  tired: "bg-red-500/20 text-red-400 border-red-500/30",
};

// ─── Calorie / Intensity helpers ──────────────────────────

function hasKw(name: string, kws: string[]): boolean {
  const l = name.toLowerCase();
  return kws.some((k) => l.includes(k.toLowerCase()));
}

function getIntensity(exercises: ActiveExercise[], durationMinutes: number): "LOW" | "MEDIUM" | "HIGH" {
  const done = exercises.flatMap((ex) => ex.sets.filter((s) => s.done));
  if (done.length === 0) return "LOW";
  const weights = done.filter((s) => parseFloat(s.weight) > 0).map((s) => parseFloat(s.weight));
  const avgW = weights.length > 0 ? weights.reduce((a, b) => a + b, 0) / weights.length : 0;
  const spm = done.length / Math.max(durationMinutes, 1);
  const hasLower = exercises.some((ex) => hasKw(ex.name, LOWER_KW));
  const hasFull = exercises.some((ex) => hasKw(ex.name, FULL_KW));
  const hasComp = exercises.some((ex) => hasKw(ex.name, COMPOUND_KW));
  if ((hasFull || hasLower) && (avgW >= 50 || spm >= 0.25)) return "HIGH";
  if (hasComp && avgW >= 30) return "HIGH";
  if (hasComp || avgW >= 20 || spm >= 0.15) return "MEDIUM";
  return "LOW";
}

function calcCalories(exercises: ActiveExercise[], durationMinutes: number, bw: number): number {
  if (bw <= 0 || durationMinutes <= 0) return 0;
  const intensity = getIntensity(exercises, durationMinutes);
  const MET = intensity === "HIGH" ? 8.0 : intensity === "MEDIUM" ? 5.5 : 3.5;
  let mult = 1.0;
  if (exercises.some((ex) => hasKw(ex.name, FULL_KW))) mult = 1.25;
  else if (exercises.some((ex) => hasKw(ex.name, LOWER_KW))) mult = 1.20;
  else if (exercises.some((ex) => hasKw(ex.name, COMPOUND_KW))) mult = 1.15;
  return Math.round(MET * bw * (durationMinutes / 60) * mult);
}

function calcVolume(exercises: ActiveExercise[]): number {
  return Math.round(
    exercises.reduce((t, ex) =>
      t + ex.sets.filter((s) => s.done).reduce((st, s) =>
        st + parseFloat(s.weight || "0") * parseFloat(s.reps || "0"), 0), 0)
  );
}

function calcScore(exercises: ActiveExercise[], durationMinutes: number, intensity: "LOW" | "MEDIUM" | "HIGH"): number {
  const total = exercises.flatMap((ex) => ex.sets).length;
  const done = exercises.flatMap((ex) => ex.sets.filter((s) => s.done)).length;
  const iB = intensity === "HIGH" ? 40 : intensity === "MEDIUM" ? 25 : 10;
  const tB = Math.min(Math.round(durationMinutes / 60 * 35), 35);
  const cB = Math.round((total > 0 ? done / total : 0) * 25);
  return Math.min(iB + tB + cB, 100);
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// ─── Parse saved exercises for display ───────────────────

function parseLogExercises(json: string | null | undefined): { name: string; detail: string }[] {
  if (!json) return [];
  try {
    const arr = JSON.parse(json) as any[];
    return arr.map((ex) => {
      if (Array.isArray(ex.sets)) {
        const doneSets = (ex.sets as ActiveSet[]).filter((s) => s.done);
        const allSets = doneSets.length > 0 ? doneSets : (ex.sets as ActiveSet[]);
        const detail = allSets
          .filter((s) => s.reps || s.weight)
          .map((s) => `${s.reps || "-"}회${s.weight ? ` × ${s.weight}kg` : ""}`)
          .join(", ");
        return { name: ex.name, detail };
      }
      // old format: {name, sets, reps, weight}
      const parts: string[] = [];
      if (ex.sets) parts.push(`${ex.sets}세트`);
      if (ex.reps) parts.push(`${ex.reps}회`);
      if (ex.weight) parts.push(`${ex.weight}kg`);
      return { name: ex.name, detail: parts.join(" × ") };
    });
  } catch {
    return [];
  }
}

// ─── Plan Phase ───────────────────────────────────────────

function PlanPhase({ onStart, onCancel }: { onStart: (names: string[]) => void; onCancel: () => void }) {
  const [names, setNames] = useState<string[]>([""]);

  const update = (i: number, v: string) => setNames((p) => { const n = [...p]; n[i] = v; return n; });
  const add = () => setNames((p) => [...p, ""]);
  const remove = (i: number) => setNames((p) => p.filter((_, j) => j !== i));
  const validNames = names.filter((n) => n.trim());

  return (
    <div className="fixed inset-0 bg-background z-50 flex flex-col">
      <div className="bg-card px-4 py-3 flex items-center justify-between border-b border-border">
        <button onClick={onCancel} className="text-sm text-muted-foreground hover:text-foreground">취소</button>
        <p className="font-semibold text-sm">운동 계획</p>
        <div className="w-8" />
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <p className="text-sm font-semibold">운동 종목</p>
        <div className="space-y-2">
          {names.map((n, i) => (
            <div key={i} className="flex items-center gap-2 bg-muted/30 border border-border rounded-xl px-3 py-2">
              <GripVertical className="w-4 h-4 text-muted-foreground/30 shrink-0" />
              <Input
                placeholder="예: 스쿼트"
                value={n}
                onChange={(e) => update(i, e.target.value)}
                className="bg-transparent border-0 text-sm h-7 p-0 focus-visible:ring-0 placeholder:text-muted-foreground/40"
              />
              <button onClick={() => remove(i)} className="text-red-400/50 hover:text-red-400 shrink-0">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
        <button
          onClick={add}
          className="w-full flex items-center justify-center gap-1.5 border border-dashed border-border/60 text-muted-foreground text-sm py-2.5 rounded-xl hover:border-primary/40 hover:text-primary/80 transition-colors"
        >
          <Plus className="w-4 h-4" /> 운동 종목 추가
        </button>
      </div>

      <div className="p-4 border-t border-border">
        <button
          onClick={() => validNames.length > 0 && onStart(validNames)}
          disabled={validNames.length === 0}
          className="w-full bg-primary text-primary-foreground font-bold py-4 rounded-2xl text-base active:scale-95 transition-transform disabled:opacity-40"
        >
          ▶ 운동 시작
        </button>
      </div>
    </div>
  );
}

// ─── Active Session ───────────────────────────────────────

interface SessionResult {
  exercises: ActiveExercise[];
  durationMinutes: number;
}

function ActiveSession({ initialExercises, onFinish, onCancel }: {
  initialExercises: string[];
  onFinish: (r: SessionResult) => void;
  onCancel: () => void;
}) {
  const [elapsed, setElapsed] = useState(0);
  const [paused, setPaused] = useState(false);
  const [exercises, setExercises] = useState<ActiveExercise[]>(
    initialExercises.map((name) => ({ name, sets: [{ reps: "", weight: "", done: false }] }))
  );
  const startRef = useRef(Date.now());
  const pausedAtRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      if (!paused) setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
    }, 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [paused]);

  const totalSets = exercises.flatMap((ex) => ex.sets).length;
  const doneSets = exercises.flatMap((ex) => ex.sets.filter((s) => s.done)).length;

  function updateSet(exIdx: number, setIdx: number, field: keyof ActiveSet, val: string | boolean) {
    setExercises((prev) => prev.map((ex, i) => {
      if (i !== exIdx) return ex;
      return { ...ex, sets: ex.sets.map((s, j) => j === setIdx ? { ...s, [field]: val } : s) };
    }));
  }

  function addSet(exIdx: number) {
    setExercises((prev) => prev.map((ex, i) => {
      if (i !== exIdx) return ex;
      const last = ex.sets[ex.sets.length - 1];
      return { ...ex, sets: [...ex.sets, { reps: last?.reps ?? "", weight: last?.weight ?? "", done: false }] };
    }));
  }

  function togglePause() {
    if (paused) {
      startRef.current += Date.now() - pausedAtRef.current;
      setPaused(false);
    } else {
      pausedAtRef.current = Date.now();
      setPaused(true);
    }
  }

  return (
    <div className="fixed inset-0 bg-[#0a0f1e] z-50 flex flex-col">
      {/* Timer */}
      <div className="bg-[#0f1929] px-4 py-4 text-center border-b border-white/10 shrink-0">
        <p className="text-xs text-white/40 mb-1">운동 중</p>
        <p className="text-4xl font-mono font-black text-white">{formatTime(elapsed)}</p>
        <p className="text-xs text-white/30 mt-1">{doneSets}/{totalSets} 완료</p>
        <button
          onClick={togglePause}
          className="mt-2 px-4 py-1.5 bg-yellow-500/20 border border-yellow-500/30 rounded-full text-yellow-400 text-xs font-medium"
        >
          {paused ? "▶ 재개" : "⏸ 일시정지"}
        </button>
      </div>

      {/* Exercise cards */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {exercises.map((ex, exIdx) => {
          const exDone = ex.sets.filter((s) => s.done).length;
          return (
            <div key={exIdx} className="bg-[#0f1929] border border-white/10 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="font-semibold text-white text-sm">{ex.name}</p>
                <span className="text-xs text-white/30">{exDone}/{ex.sets.length} 완료</span>
              </div>
              <div className="grid grid-cols-[1.5rem_1fr_1fr_2.5rem] gap-2 mb-1.5 items-center">
                <span />
                <p className="text-[10px] text-white/40 text-center">횟수</p>
                <p className="text-[10px] text-white/40 text-center">무게(kg)</p>
                <p className="text-[10px] text-white/40 text-center">완료</p>
              </div>
              {ex.sets.map((set, setIdx) => (
                <div key={setIdx} className="grid grid-cols-[1.5rem_1fr_1fr_2.5rem] gap-2 mb-1.5 items-center">
                  <span className="text-xs text-white/30 text-center">{setIdx + 1}</span>
                  <Input
                    type="number"
                    placeholder="횟수"
                    value={set.reps}
                    onChange={(e) => updateSet(exIdx, setIdx, "reps", e.target.value)}
                    className="bg-white/5 border-white/10 text-white text-xs h-8 text-center"
                  />
                  <Input
                    type="number"
                    placeholder="kg"
                    value={set.weight}
                    onChange={(e) => updateSet(exIdx, setIdx, "weight", e.target.value)}
                    className="bg-white/5 border-white/10 text-white text-xs h-8 text-center"
                  />
                  <button
                    onClick={() => updateSet(exIdx, setIdx, "done", !set.done)}
                    className={`w-8 h-8 rounded-lg border flex items-center justify-center transition-colors ${
                      set.done
                        ? "bg-primary border-primary text-primary-foreground"
                        : "border-white/20 text-white/20 hover:border-white/40"
                    }`}
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              <button
                onClick={() => addSet(exIdx)}
                className="mt-1.5 text-xs text-primary/60 hover:text-primary flex items-center gap-1 transition-colors"
              >
                <Plus className="w-3 h-3" /> 세트 추가
              </button>
            </div>
          );
        })}
      </div>

      {/* Finish */}
      <div className="p-4 border-t border-white/10 shrink-0">
        <button
          onClick={() => onFinish({ exercises, durationMinutes: Math.max(1, Math.round(elapsed / 60)) })}
          className="w-full bg-red-500 hover:bg-red-600 text-white font-bold py-4 rounded-2xl text-base active:scale-95 transition-all"
        >
          운동 종료 · {formatTime(elapsed)}
        </button>
        <p className="text-center text-xs text-white/20 mt-2">종료하면 칼로리 리포트를 확인할 수 있어요</p>
      </div>
    </div>
  );
}

// ─── Workout Report ───────────────────────────────────────

function WorkoutReport({ exercises, durationMinutes, onSave, isSaving }: {
  exercises: ActiveExercise[];
  durationMinutes: number;
  onSave: (bw: number, calories: number, intensity: string, volume: number, score: number) => void;
  isSaving: boolean;
}) {
  const [bodyWeight, setBodyWeight] = useState("");
  const bw = parseFloat(bodyWeight) || 0;
  const intensity = getIntensity(exercises, durationMinutes);
  const calories = calcCalories(exercises, durationMinutes, bw);
  const volume = calcVolume(exercises);
  const score = calcScore(exercises, durationMinutes, intensity);
  const doneSets = exercises.flatMap((ex) => ex.sets.filter((s) => s.done)).length;
  const totalSets = exercises.flatMap((ex) => ex.sets).length;
  const intensityColor = intensity === "HIGH" ? "text-red-400" : intensity === "MEDIUM" ? "text-yellow-400" : "text-blue-400";

  return (
    <div className="fixed inset-0 bg-[#0a0f1e] z-50 overflow-y-auto">
      <div className="p-6 space-y-4">
        {/* Trophy */}
        <div className="bg-[#0f1929] rounded-3xl p-6 text-center">
          <div className="text-5xl mb-3">🏆</div>
          <p className="text-white font-black text-2xl">운동 완료!</p>
          <p className="text-white/40 text-sm mt-1">운동 기록</p>
        </div>

        {/* Body weight */}
        <div className="bg-[#0f1929] rounded-2xl p-4 border border-white/10">
          <p className="text-white/50 text-xs mb-2">체중 입력 (칼로리 계산)</p>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              placeholder="70"
              value={bodyWeight}
              onChange={(e) => setBodyWeight(e.target.value)}
              className="bg-white/5 border-white/10 text-white text-lg font-bold text-center h-11 flex-1"
            />
            <span className="text-white/50 text-sm shrink-0">kg</span>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-[#0f1929] rounded-2xl p-4 border border-white/10">
            <p className="text-white/40 text-xs">총 운동시간</p>
            <p className="text-white font-black text-2xl mt-1">{durationMinutes}분</p>
          </div>
          <div className="bg-[#0f1929] rounded-2xl p-4 border border-white/10">
            <p className="text-white/40 text-xs">예상 칼로리</p>
            <p className={`font-black text-2xl mt-1 ${bw > 0 ? "text-orange-400" : "text-white/20"}`}>
              {bw > 0 ? `${calories}kcal` : "- kcal"}
            </p>
          </div>
          <div className="bg-[#0f1929] rounded-2xl p-4 border border-white/10">
            <p className="text-white/40 text-xs">운동 강도</p>
            <p className={`font-black text-2xl mt-1 ${intensityColor}`}>{intensity}</p>
          </div>
          <div className="bg-[#0f1929] rounded-2xl p-4 border border-white/10">
            <p className="text-white/40 text-xs">총 볼륨</p>
            <p className="text-white font-black text-2xl mt-1">
              {volume > 0 ? `${volume.toLocaleString()}kg` : "0kg"}
            </p>
          </div>
        </div>

        {/* Score */}
        <div className="bg-[#0f1929] rounded-2xl p-4 border border-white/10">
          <div className="flex items-center justify-between mb-2">
            <p className="text-white/60 text-sm">운동 점수</p>
            <p className="text-white font-bold text-lg">{score}점</p>
          </div>
          <div className="w-full bg-white/10 rounded-full h-2">
            <div className="bg-primary h-2 rounded-full transition-all" style={{ width: `${score}%` }} />
          </div>
          <div className="flex items-center justify-between mt-1.5">
            <p className="text-white/25 text-[10px]">완료 {doneSets}/{totalSets}종목</p>
            <p className="text-white/25 text-[10px]">{durationMinutes}분 · {intensity}</p>
          </div>
        </div>

        <p className="text-center text-white/25 text-[11px]">※ 예상 칼로리는 운동 데이터 기반 추정치입니다.</p>

        <button
          onClick={() => onSave(bw, calories, intensity, volume, score)}
          disabled={isSaving}
          className="w-full bg-primary text-primary-foreground font-bold py-4 rounded-2xl text-base active:scale-95 transition-transform disabled:opacity-60"
        >
          {isSaving ? "저장 중..." : "저장하기"}
        </button>
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
            <button onClick={() => remove(i)} className="text-red-400 text-xs shrink-0">
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

// ─── Main Component ───────────────────────────────────────

type Phase = "list" | "plan" | "active" | "report";

export default function FitStepPlusWorkout() {
  const today = new Date().toISOString().slice(0, 10);
  const [selectedMonth, setSelectedMonth] = useState(today.slice(0, 7));
  const [phase, setPhase] = useState<Phase>("list");
  const [plannedNames, setPlannedNames] = useState<string[]>([]);
  const [sessionResult, setSessionResult] = useState<SessionResult | null>(null);
  const [showManualForm, setShowManualForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<LogFormData>({ logDate: today, title: "", durationMinutes: "", caloriesBurned: "", bodyWeight: "", notes: "", mood: "good" });
  const [manualExercises, setManualExercises] = useState<SimpleExercise[]>([]);

  const utils = trpc.useUtils();
  const { data: logs, isLoading } = trpc.fitStepPlus.listWorkoutLogs.useQuery({ month: selectedMonth });

  const createMutation = trpc.fitStepPlus.createWorkoutLog.useMutation({
    onSuccess: () => {
      utils.fitStepPlus.listWorkoutLogs.invalidate();
      setShowManualForm(false);
      setPhase("list");
      setSessionResult(null);
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
      logDate: log.logDate, title: log.title ?? "", durationMinutes: log.durationMinutes?.toString() ?? "",
      caloriesBurned: log.caloriesBurned?.toString() ?? "", bodyWeight: log.bodyWeight ?? "",
      notes: log.notes ?? "", mood: log.mood ?? "good",
    });
    try {
      const parsed = log.exercisesJson ? JSON.parse(log.exercisesJson) : [];
      if (Array.isArray(parsed) && parsed[0] && Array.isArray(parsed[0].sets)) {
        // new format → flatten for manual edit
        setManualExercises(parsed.map((ex: ActiveExercise) => ({
          name: ex.name,
          sets: ex.sets.length.toString(),
          reps: ex.sets[0]?.reps ?? "",
          weight: ex.sets[0]?.weight ?? "",
        })));
      } else {
        setManualExercises(parsed);
      }
    } catch {
      setManualExercises([]);
    }
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

  function saveSessionReport(bw: number, calories: number, intensity: string, volume: number, score: number) {
    if (!sessionResult) return;
    const { exercises, durationMinutes } = sessionResult;
    createMutation.mutate({
      logDate: today,
      title: "오늘의 운동",
      durationMinutes,
      caloriesBurned: calories > 0 ? calories : undefined,
      bodyWeight: bw > 0 ? bw.toString() : undefined,
      exercisesJson: JSON.stringify(exercises),
      intensity,
      totalVolume: volume > 0 ? volume : undefined,
      mood: "good",
    });
  }

  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(); d.setMonth(d.getMonth() - i);
    return d.toISOString().slice(0, 7);
  });

  // ── Full-screen overlays ──
  if (phase === "plan") {
    return (
      <PlanPhase
        onStart={(names) => { setPlannedNames(names); setPhase("active"); }}
        onCancel={() => setPhase("list")}
      />
    );
  }

  if (phase === "active") {
    return (
      <ActiveSession
        initialExercises={plannedNames}
        onFinish={(result) => { setSessionResult(result); setPhase("report"); }}
        onCancel={() => setPhase("list")}
      />
    );
  }

  if (phase === "report" && sessionResult) {
    return (
      <WorkoutReport
        exercises={sessionResult.exercises}
        durationMinutes={sessionResult.durationMinutes}
        onSave={saveSessionReport}
        isSaving={createMutation.isPending}
      />
    );
  }

  // ── List view ──
  return (
    <>
      <div className="p-4 space-y-4">
        {/* Start card */}
        <div className="bg-gradient-to-r from-primary/20 to-primary/5 border border-primary/30 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <p className="font-bold text-base">지금 운동할까요?</p>
            <p className="text-xs text-muted-foreground mt-0.5">종목을 입력하고 타이머와 함께 기록해요</p>
          </div>
          <button
            onClick={() => setPhase("plan")}
            className="bg-primary text-primary-foreground font-bold text-sm px-4 py-2.5 rounded-xl active:scale-95 transition-transform"
          >
            운동 시작 ▶
          </button>
        </div>

        <div className="flex items-center justify-between">
          <h1 className="font-bold text-base">운동 기록</h1>
          <Button size="sm" className="h-8 text-xs" onClick={() => { resetManualForm(); setEditingId(null); setShowManualForm(true); }}>+ 직접 입력</Button>
        </div>

        {/* Month tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4">
          {months.map((m) => (
            <button key={m} onClick={() => setSelectedMonth(m)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${selectedMonth === m ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
              {m.replace("-", "년 ")}월
            </button>
          ))}
        </div>

        {/* Log list */}
        {isLoading ? (
          <div className="text-center py-10 text-muted-foreground text-sm">불러오는 중...</div>
        ) : !logs || logs.length === 0 ? (
          <div className="text-center py-10 space-y-3">
            <p className="text-muted-foreground text-sm">이 달의 운동 기록이 없습니다</p>
            <Button variant="outline" size="sm" onClick={() => setPhase("plan")}>운동 시작하기</Button>
          </div>
        ) : (
          <div className="space-y-3">
            {logs.map((log) => {
              const exList = parseLogExercises(log.exercisesJson);
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
                    {log.bodyWeight && <span className="text-[10px] text-muted-foreground">⚖️ {log.bodyWeight}kg</span>}
                  </div>
                  {exList.length > 0 && (
                    <div className="space-y-1">
                      {exList.map((ex, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="text-foreground font-medium">{ex.name}</span>
                          {ex.detail && <span>{ex.detail}</span>}
                        </div>
                      ))}
                    </div>
                  )}
                  {log.notes && <p className="text-xs text-muted-foreground border-t border-border pt-2">{log.notes}</p>}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Manual entry dialog */}
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
