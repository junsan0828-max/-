import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader } from "@/components/ui/dialog";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const SLEEP_OPTIONS = ["4h↓", "5h", "6h", "7h", "8h", "9h+"];
const ENERGY_OPTIONS = ["높음", "보통", "낮음"];

// ── 유산소 기구 (센터 보유: 러닝머신, 고정식 입식 사이클) — 속도/강도 자유 조절 ──
const CARDIO_TYPES = ["러닝머신", "고정식 사이클"] as const;
const CARDIO_EMOJI: Record<string, string> = {};

// ACSM 대사공식: 8km/h(=133m/min) 미만은 걷기식, 이상은 달리기식 계산 사용
function treadmillMet(speedKmh: number): number {
  const speedMmin = speedKmh * (1000 / 60);
  const vo2 = speedKmh < 8 ? 0.1 * speedMmin + 3.5 : 0.2 * speedMmin + 3.5;
  return Math.max(1, vo2 / 3.5);
}

// 고정식 사이클: 저항 레벨(1~10)을 MET 3.5~12 구간에 선형 보간
function cycleMet(level: number): number {
  const t = (Math.min(10, Math.max(1, level)) - 1) / 9;
  return 3.5 + t * (12 - 3.5);
}

const BODY_PARTS = [
  "전신", "상체", "하체",
  "등", "어깨", "가슴",
  "복부", "허리", "코어",
  "엉덩이", "대퇴 후면", "대퇴 전면",
  "하퇴", "이두", "삼두",
  "기타",
];

interface ExerciseSet { reps: string; weight: string; }
interface Exercise { name: string; sets: ExerciseSet[]; videoUrl?: string; restSeconds?: number; }

// ── 칼로리 계산 ───────────────────────────────────────────────────────────────
const COMPOUND_KEYWORDS = ["스쿼트", "데드리프트", "벤치", "랫풀", "런지", "로우", "딥스", "풀업", "프레스", "클린", "턱걸이", "친업"];
const LOWER_BODY_PARTS = ["하체", "허벅지", "엉덩이", "대퇴 후면", "대퇴 전면", "하퇴"];
const FULL_BODY_PARTS = ["전신"];

function classifyExercise(name: string): "compound" | "isolation" | "cardio" {
  if (["런닝", "사이클", "로잉", "달리기", "트레드밀", "줄넘기"].some(k => name.includes(k))) return "cardio";
  if (COMPOUND_KEYWORDS.some(k => name.includes(k))) return "compound";
  return "isolation";
}

interface WorkoutStats {
  calories: number;
  totalVolume: number;
  intensity: "LOW" | "MEDIUM" | "HIGH";
  score: number;
  durationMinutes: number;
}

function calculateWorkoutStats(
  exercises: { name: string; sets: ExerciseSet[]; done: boolean }[],
  durationMinutes: number,
  bodyParts: string[],
  bodyWeightKg = 70,
): WorkoutStats {
  const totalVolume = exercises.reduce((sum, ex) =>
    sum + ex.sets.reduce((s2, set) => s2 + (parseFloat(set.reps) || 0) * (parseFloat(set.weight) || 0), 0), 0);

  const hasLower = bodyParts.some(p => LOWER_BODY_PARTS.includes(p));
  const hasFull = bodyParts.some(p => FULL_BODY_PARTS.includes(p));
  const compoundCount = exercises.filter(e => classifyExercise(e.name) === "compound").length;
  const totalSets = exercises.reduce((sum, e) => sum + e.sets.length, 0);
  const weights = exercises.flatMap(e => e.sets.map(s => parseFloat(s.weight) || 0)).filter(w => w > 0);
  const avgWeight = weights.length > 0 ? weights.reduce((a, b) => a + b, 0) / weights.length : 0;

  // 강도 자동 추정
  let intensityScore = 0;
  if (hasFull) intensityScore += 4;
  if (hasLower) intensityScore += 3;
  if (compoundCount >= 3) intensityScore += 3;
  if (totalSets >= 15) intensityScore += 2;
  if (avgWeight >= 60) intensityScore += 2;
  if (durationMinutes >= 60) intensityScore += 1;

  const intensity: "LOW" | "MEDIUM" | "HIGH" =
    intensityScore >= 7 ? "HIGH" : intensityScore >= 3 ? "MEDIUM" : "LOW";

  // MET 기반 칼로리
  const metBase = intensity === "HIGH" ? 8 : intensity === "MEDIUM" ? 5.5 : 3.5;
  let multiplier = 1.0;
  if (hasFull) multiplier += 0.25;
  else if (hasLower) multiplier += 0.20;
  else if (compoundCount >= 2) multiplier += 0.15;

  let calories = metBase * bodyWeightKg * (durationMinutes / 60) * multiplier;
  calories += Math.min(totalVolume / 120, 60); // 볼륨 보너스 (최대 60kcal)
  calories = Math.round(calories);

  // 운동 점수 (100점 만점)
  const completedCount = exercises.filter(e => e.done).length;
  let score = 0;
  score += Math.min(completedCount * 5, 25);
  score += Math.min(Math.floor(totalVolume / 500) * 2, 20);
  score += Math.min(Math.floor(durationMinutes / 10) * 3, 30);
  score += intensity === "HIGH" ? 25 : intensity === "MEDIUM" ? 15 : 5;
  score = Math.min(score, 100);

  return { calories, totalVolume: Math.round(totalVolume), intensity, score, durationMinutes };
}

// ── 유틸 ──────────────────────────────────────────────────────────────────────
function getYoutubeEmbedUrl(url: string): string | null {
  const m = url.match(/(?:(?:www\.|m\.)?youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([^&\n?#]+)/);
  return m ? `https://www.youtube.com/embed/${m[1]}?rel=0` : null;
}

function formatTime(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;

  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// ── 운동 영상 모달 ─────────────────────────────────────────────────────────────
function ExerciseVideoModal({ videoUrl, onClose }: { videoUrl: string; onClose: () => void }) {
  const embedUrl = getYoutubeEmbedUrl(videoUrl);
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-sm p-0 overflow-hidden">
        <div className="w-full bg-black aspect-video">
          {embedUrl ? (
            <iframe src={embedUrl} className="w-full h-full" allowFullScreen
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" />
          ) : (
            <video src={videoUrl} controls className="w-full h-full" playsInline />
          )}
        </div>
        <div className="p-3">
          <Button variant="outline" size="sm" className="w-full h-8 text-xs" onClick={onClose}>닫기</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── 기록 목록 운동 행 ─────────────────────────────────────────────────────────
function ExerciseRowWithVideo({ ex }: { ex: any }) {
  const [showVideo, setShowVideo] = useState(false);
  if (!ex.name) return null;
  const hasSets = Array.isArray(ex.sets) && ex.sets.some((s: any) => s.reps || s.weight);
  return (
    <>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="text-foreground font-medium flex-1">{ex.name}</span>
        {hasSets && (
          <span>{ex.sets.length}세트
            {/* 추천 횟수는 "12~15회"처럼 단위가 이미 붙어 올 수 있어, 숫자만일 때만 '회'를 덧붙인다 */}
            {ex.sets[0]?.reps ? ` × ${ex.sets[0].reps}${/^\d+$/.test(String(ex.sets[0].reps)) ? "회" : ""}` : ""}
            {ex.sets[0]?.weight ? ` ${ex.sets[0].weight}kg` : ""}
            {ex.restSeconds ? ` · 휴식 ${ex.restSeconds}초` : ""}
          </span>
        )}
        {ex.videoUrl && (
          <button onClick={() => setShowVideo(true)}
            className="text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded-full flex-shrink-0">
            ▶ 운동영상
          </button>
        )}
      </div>
      {showVideo && <ExerciseVideoModal videoUrl={ex.videoUrl} onClose={() => setShowVideo(false)} />}
    </>
  );
}

// ── 계획 작성용 종목 입력 (이름만) ────────────────────────────────────────────
function SortableExerciseItem({
  id, ex, index,
  onUpdate, onRemove,
}: {
  id: string; ex: Exercise; index: number;
  onUpdate: (i: number, v: Exercise) => void;
  onRemove: (i: number) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <div ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}
      className="flex items-center gap-2 bg-muted/30 border border-border rounded-xl px-3 py-2.5"
    >
      <button {...attributes} {...listeners}
        className="text-muted-foreground touch-none cursor-grab active:cursor-grabbing text-base flex-shrink-0"
      >⠿</button>
      <Input
        placeholder="운동명 (예: 스쿼트)"
        value={ex.name}
        onChange={(e) => onUpdate(index, { ...ex, name: e.target.value })}
        className="bg-background text-sm h-8 flex-1"
      />
      <button onClick={() => onRemove(index)} className="text-red-400 flex-shrink-0 p-1">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
          <path d="M10 11v6M14 11v6"/>
        </svg>
      </button>
    </div>
  );
}

function ExerciseNameForm({ exercises, setExercises }: { exercises: Exercise[]; setExercises: (v: Exercise[]) => void }) {
  const ids = exercises.map((_, i) => `ex-${i}`);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
  );
  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oi = ids.indexOf(active.id as string);
    const ni = ids.indexOf(over.id as string);
    setExercises(arrayMove(exercises, oi, ni));
  }
  return (
    <div className="space-y-2">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          {exercises.map((ex, i) => (
            <SortableExerciseItem key={ids[i]} id={ids[i]} ex={ex} index={i}
              onUpdate={(idx, v) => { const next = [...exercises]; next[idx] = v; setExercises(next); }}
              onRemove={(idx) => setExercises(exercises.filter((_, j) => j !== idx))}
            />
          ))}
        </SortableContext>
      </DndContext>
      <button
        onClick={() => setExercises([...exercises, { name: "", sets: [] }])}
        className="w-full border border-dashed border-border rounded-xl py-2.5 text-sm text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors"
      >
        + 운동 종목 추가
      </button>
    </div>
  );
}

// ── 운동 부위 선택 ─────────────────────────────────────────────────────────────
function BodyPartSelector({ selected, onChange }: { selected: string[]; onChange: (v: string[]) => void }) {
  function toggle(part: string) {
    if (selected.includes(part)) onChange(selected.filter((p) => p !== part));
    else if (selected.length < 3) onChange([...selected, part]);
  }
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">운동 부위 (최대 3개)</Label>
      <div className="grid grid-cols-3 gap-1.5">
        {BODY_PARTS.map((part) => {
          const active = selected.includes(part);
          const disabled = !active && selected.length >= 3;
          return (
            <button key={part} onClick={() => toggle(part)} disabled={disabled}
              className={`py-2 rounded-xl text-xs font-medium transition-colors border ${
                active ? "bg-primary/20 border-primary text-primary"
                : disabled ? "border-border text-muted-foreground/40"
                : "border-border text-muted-foreground hover:border-primary/40"
              }`}
            >{part}</button>
          );
        })}
      </div>
    </div>
  );
}

// ── 유산소 설정 모달 (속도/강도 자유 조절) ────────────────────────────────────
function CardioSettingsModal({
  defaultWeight,
  onClose,
  onStart,
}: {
  defaultWeight: string;
  onClose: () => void;
  onStart: (type: string, intensityLabel: string, met: number, weight: number) => void;
}) {
  const [type, setType] = useState<typeof CARDIO_TYPES[number]>("러닝머신");
  const [speed, setSpeed] = useState("6.0");   // 러닝머신: km/h
  const [level, setLevel] = useState("5");     // 고정식 사이클: 저항 레벨 1~10
  const [weight, setWeight] = useState(defaultWeight || "70");

  const isTreadmill = type === "러닝머신";
  const speedNum = parseFloat(speed) || 0;
  const levelNum = parseInt(level) || 1;
  const met = isTreadmill ? treadmillMet(speedNum) : cycleMet(levelNum);
  const intensityLabel = isTreadmill ? `${speedNum.toFixed(1)}km/h` : `레벨 ${levelNum}`;
  const valid = isTreadmill ? speedNum > 0 : levelNum >= 1;

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <h2 className="font-bold text-base">유산소운동 설정</h2>
          <p className="text-xs text-muted-foreground">기구를 선택하고 속도/강도를 자유롭게 입력하세요</p>
        </DialogHeader>
        <div className="space-y-4 pt-1">
          {/* 기구 */}
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">기구</p>
            <div className="flex gap-1.5 flex-wrap">
              {CARDIO_TYPES.map(t => (
                <button key={t} type="button"
                  className={`flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-medium border transition-colors ${type === t ? "bg-primary/20 border-primary text-primary" : "border-border text-muted-foreground"}`}
                  onClick={() => setType(t)}
                >
                  <span>{CARDIO_EMOJI[t]}</span> {t}
                </button>
              ))}
            </div>
          </div>

          {/* 속도(러닝머신) / 저항 레벨(사이클) — 실제 기구 표시값을 그대로 입력 */}
          {isTreadmill ? (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">속도 (km/h) — 러닝머신 화면에 표시된 값을 입력하세요</p>
              <div className="flex items-center gap-2">
                <input type="range" min={1} max={18} step={0.1} value={speedNum}
                  onChange={e => setSpeed(e.target.value)}
                  className="flex-1 accent-primary" />
                <Input type="number" step={0.1} min={0} value={speed}
                  onChange={e => setSpeed(e.target.value)}
                  className="bg-input border-border h-9 text-sm w-20 text-center flex-shrink-0" />
                <span className="text-sm text-muted-foreground flex-shrink-0">km/h</span>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">저항 레벨 (1~10) — 사이클 화면에 표시된 레벨을 입력하세요</p>
              <div className="flex items-center gap-2">
                <input type="range" min={1} max={10} step={1} value={levelNum}
                  onChange={e => setLevel(e.target.value)}
                  className="flex-1 accent-primary" />
                <Input type="number" step={1} min={1} max={10} value={level}
                  onChange={e => setLevel(e.target.value)}
                  className="bg-input border-border h-9 text-sm w-20 text-center flex-shrink-0" />
                <span className="text-sm text-muted-foreground flex-shrink-0">Lv</span>
              </div>
            </div>
          )}

          {/* 체중 */}
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground">체중 (칼로리 계산용)</p>
            <div className="flex items-center gap-2">
              <Input type="number" value={weight} onChange={e => setWeight(e.target.value)}
                className="bg-input border-border h-9 text-sm flex-1" />
              <span className="text-sm text-muted-foreground flex-shrink-0">kg</span>
            </div>
          </div>

          {/* 예상 칼로리 미리보기 (30분 기준) */}
          {valid && (
            <div className="bg-primary/5 border border-primary/20 rounded-xl px-3 py-2 text-xs text-center">
              30분 운동 시 예상 소모:
              <span className="font-bold text-primary ml-1">
                {Math.round(met * (parseFloat(weight) || 70) * 0.5)} kcal
              </span>
              <span className="text-muted-foreground ml-1">(MET {met.toFixed(1)})</span>
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <Button variant="outline" className="flex-1 h-9" onClick={onClose}>취소</Button>
            <Button className="flex-1 h-9" disabled={!valid}
              onClick={() => onStart(type, intensityLabel, met, parseFloat(weight) || 70)}
            >시작하기</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── 운동 진행 모달 (타이머 + 세트 기록) ───────────────────────────────────────
interface ActiveSet { reps: string; weight: string; done: boolean; }
interface ActiveExercise { name: string; sets: ActiveSet[]; done: boolean; videoUrl?: string; restSeconds?: number; }

function ActiveWorkoutModal({
  log,
  onClose,
  onCancel,
}: {
  log: any;
  onClose: (durationMinutes: number, updatedExercises: Exercise[], caloriesBurned: number) => void;
  onCancel: () => void;
}) {
  const [step, setStep] = useState<"workout" | "result">("workout");
  const [elapsed, setElapsed] = useState(0);
  const [paused, setPaused] = useState(false);
  const startRef = useRef(Date.now());
  const pausedAtRef = useRef(0);
  const [bodyWeightKg, setBodyWeightKg] = useState("70");
  const [result, setResult] = useState<WorkoutStats | null>(null);
  const [updatedExercises, setUpdatedExercises] = useState<Exercise[]>([]);

  const bodyParts: string[] = (() => {
    try { return log.bodyPartsJson ? JSON.parse(log.bodyPartsJson) : []; } catch { return []; }
  })();

  const [exList, setExList] = useState<ActiveExercise[]>(() => {
    try {
      const parsed: any[] = log.exercisesJson ? JSON.parse(log.exercisesJson) : [];
      return parsed.map((e: any) => ({
        name: e.name ?? "",
        sets: Array.isArray(e.sets) && e.sets.length > 0 ? e.sets.map((s: any) => ({ reps: s.reps ?? "", weight: s.weight ?? "", done: false })) : [{ reps: "", weight: "", done: false }],
        done: false,
        videoUrl: e.videoUrl,
        restSeconds: e.restSeconds,
      }));
    } catch { return []; }
  });
  const [showVideo, setShowVideo] = useState<string | null>(null);

  useEffect(() => {
    const id = setInterval(() => {
      if (!paused) setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [paused]);

  // 화면 복귀 시 경과 시간 즉시 재동기화
  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === "visible" && !paused)
        setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [paused]);

  function togglePause() {
    if (paused) {
      startRef.current += Date.now() - pausedAtRef.current;
      setPaused(false);
    } else {
      pausedAtRef.current = Date.now();
      setPaused(true);
    }
  }

  function toggleSetDone(ei: number, si: number) {
    setExList((prev) => prev.map((e, j) => {
      if (j !== ei) return e;
      const sets = e.sets.map((s, k) => k === si ? { ...s, done: !s.done } : s);
      const done = sets.every(s => s.done);
      return { ...e, sets, done };
    }));
  }

  function updateSet(ei: number, si: number, field: keyof ActiveSet, val: string) {
    setExList((prev) => prev.map((e, j) => {
      if (j !== ei) return e;
      return { ...e, sets: e.sets.map((s, k) => k === si ? { ...s, [field]: val } : s) };
    }));
  }

  function addSet(ei: number) {
    setExList((prev) => prev.map((e, j) => {
      if (j !== ei) return e;
      const last = e.sets[e.sets.length - 1] ?? { reps: "", weight: "", done: false };
      return { ...e, sets: [...e.sets, { ...last, done: false }] };
    }));
  }

  function removeSet(ei: number, si: number) {
    setExList((prev) => prev.map((e, j) => {
      if (j !== ei || e.sets.length <= 1) return e;
      return { ...e, sets: e.sets.filter((_, k) => k !== si) };
    }));
  }

  function handleFinish() {
    const minutes = Math.max(1, Math.round(elapsed / 60));
    const updated: Exercise[] = exList.map((e) => ({ name: e.name, sets: e.sets, videoUrl: e.videoUrl, restSeconds: e.restSeconds }));
    const stats = calculateWorkoutStats(exList, minutes, bodyParts, parseFloat(bodyWeightKg) || 70);
    setResult(stats);
    setUpdatedExercises(updated);
    setStep("result");
  }

  function handleSave() {
    if (!result) return;
    onClose(result.durationMinutes, updatedExercises, result.calories);
  }

  const doneCount = exList.filter((e) => e.done).length;
  const intensityColor = { LOW: "text-blue-400", MEDIUM: "text-yellow-400", HIGH: "text-red-400" };
  const intensityBg = { LOW: "bg-blue-500/10 border-blue-500/30", MEDIUM: "bg-yellow-500/10 border-yellow-500/30", HIGH: "bg-red-500/10 border-red-500/30" };
  const scoreColor = result ? (result.score >= 80 ? "text-green-400" : result.score >= 50 ? "text-yellow-400" : "text-muted-foreground") : "";

  if (step === "result" && result) {
    return (
      <Dialog open onOpenChange={() => {}}>
        <DialogContent className="max-w-sm max-h-[92vh] overflow-y-auto p-0 [&>button]:hidden">
          {/* 결과 헤더 */}
          <div className="bg-green-500/10 border-b border-green-500/20 px-4 py-5 text-center">
            <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.8} stroke="currentColor" className="w-8 h-8 text-green-500 mx-auto mb-1">
              <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
            </svg>
            <p className="font-bold text-lg text-foreground">운동 완료!</p>
            <p className="text-xs text-muted-foreground mt-0.5">{log.title || "운동 기록"}</p>
          </div>

          <div className="p-4 space-y-4">
            {/* 체중 입력 (칼로리 재계산용) */}
            <div className="flex items-center gap-2 bg-muted/40 rounded-xl px-3 py-2.5">
              <span className="text-xs text-muted-foreground flex-1">체중 입력 (칼로리 계산)</span>
              <Input
                type="number"
                value={bodyWeightKg}
                onChange={(e) => {
                  setBodyWeightKg(e.target.value);
                  const w = parseFloat(e.target.value) || 70;
                  const recalc = calculateWorkoutStats(exList, result.durationMinutes, bodyParts, w);
                  setResult(recalc);
                }}
                className="bg-background text-sm h-7 w-20 text-center"
              />
              <span className="text-xs text-muted-foreground">kg</span>
            </div>

            {/* 스탯 카드 */}
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-card border border-border rounded-xl p-3 text-center">
                <p className="text-[10px] text-muted-foreground mb-1">총 운동시간</p>
                <p className="text-xl font-bold text-foreground">{result.durationMinutes}<span className="text-sm font-normal text-muted-foreground">분</span></p>
              </div>
              <div className="bg-card border border-border rounded-xl p-3 text-center">
                <p className="text-[10px] text-muted-foreground mb-1">예상 칼로리</p>
                <p className="text-xl font-bold text-primary">{result.calories.toLocaleString()}<span className="text-sm font-normal text-muted-foreground">kcal</span></p>
              </div>
              <div className={`border rounded-xl p-3 text-center ${intensityBg[result.intensity]}`}>
                <p className="text-[10px] text-muted-foreground mb-1">운동 강도</p>
                <p className={`text-xl font-bold ${intensityColor[result.intensity]}`}>{result.intensity}</p>
              </div>
              <div className="bg-card border border-border rounded-xl p-3 text-center">
                <p className="text-[10px] text-muted-foreground mb-1">총 볼륨</p>
                <p className="text-xl font-bold text-foreground">{result.totalVolume.toLocaleString()}<span className="text-sm font-normal text-muted-foreground">kg</span></p>
              </div>
            </div>

            {/* 운동 점수 */}
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-muted-foreground">운동 점수</p>
                <p className={`text-2xl font-bold ${scoreColor}`}>{result.score}<span className="text-sm font-normal text-muted-foreground">점</span></p>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all ${result.score >= 80 ? "bg-green-500" : result.score >= 50 ? "bg-yellow-500" : "bg-primary"}`}
                  style={{ width: `${result.score}%` }}
                />
              </div>
              <div className="flex justify-between text-[9px] text-muted-foreground mt-1">
                <span>완료 {doneCount}/{exList.length}종목</span>
                <span>{result.durationMinutes}분 · {result.intensity}</span>
              </div>
            </div>

            {/* 운동 부위 태그 */}
            {bodyParts.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {bodyParts.map(p => (
                  <span key={p} className="text-xs bg-primary/10 text-primary px-2.5 py-1 rounded-full border border-primary/20">{p}</span>
                ))}
              </div>
            )}

            <p className="text-[10px] text-muted-foreground text-center">※ 예상 칼로리는 운동 데이터 기반 추정치입니다.</p>

            <Button className="w-full h-11 font-bold" onClick={handleSave}>
              저장하기
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open onOpenChange={() => {}}>
      <DialogContent className="max-w-sm max-h-[92vh] overflow-y-auto p-0 [&>button]:hidden">
        {/* 타이머 헤더 */}
        <div className="bg-primary/10 border-b border-primary/20 px-4 py-4 text-center sticky top-0 z-10">
          <div className="flex items-center justify-between mb-1">
            <button
              onClick={() => { if (confirm("운동을 취소하시겠습니까? 저장되지 않습니다.")) onCancel(); }}
              className="text-xs text-red-400 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/30 hover:bg-red-500/20 font-medium"
            >
              ✕ 취소
            </button>
            <p className={`text-xs font-medium ${paused ? "text-yellow-400" : "text-primary"}`}>
              {paused ? "일시정지" : "운동 중"}
            </p>
            <div className="w-10" />
          </div>
          <p className={`text-4xl font-mono font-bold ${paused ? "text-yellow-400" : "text-foreground"}`}>
            {formatTime(elapsed)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">{doneCount}/{exList.length} 완료</p>
          <button onClick={togglePause}
            className={`mt-2 px-4 py-1.5 rounded-full text-xs font-medium transition-colors border ${
              paused ? "bg-primary/20 border-primary text-primary" : "bg-yellow-500/20 border-yellow-500/50 text-yellow-400"
            }`}
          >
            {paused ? "▶ 재개" : "⏸ 일시정지"}
          </button>
        </div>

        <div className="p-4 space-y-3">
          {exList.map((ex, ei) => {
            const doneSets = ex.sets.filter(s => s.done).length;
            const allDone = doneSets === ex.sets.length;
            return (
              <div key={ei} className={`border rounded-xl overflow-hidden transition-colors ${allDone ? "border-green-500/40 bg-green-500/5" : "border-border bg-card"}`}>
                {/* 종목 헤더 */}
                <div className="flex items-center gap-2 px-3 py-2.5">
                  <div className="flex-1 min-w-0">
                    <span className={`text-sm font-medium ${allDone ? "text-green-400" : "text-foreground"}`}>
                      {ex.name}
                    </span>
                    {ex.restSeconds ? (
                      <p className="text-[10px] text-muted-foreground mt-0.5">세트 간 휴식 {ex.restSeconds}초</p>
                    ) : null}
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${allDone ? "bg-green-500/20 text-green-400" : "bg-muted text-muted-foreground"}`}>
                    {doneSets}/{ex.sets.length} 완료
                  </span>
                  {ex.videoUrl && (
                    <button onClick={() => setShowVideo(ex.videoUrl!)}
                      className="text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded-full flex-shrink-0">
                      ▶ 영상
                    </button>
                  )}
                </div>

                {/* 세트 행 */}
                <div className="px-3 pb-3 space-y-1.5">
                  <div className="flex gap-1.5 text-[10px] text-muted-foreground">
                    <span className="w-7" />
                    <span className="flex-1 text-center">횟수</span>
                    <span className="flex-1 text-center">무게(kg)</span>
                    <span className="w-8 text-center">완료</span>
                    <span className="w-5" />
                  </div>
                  {ex.sets.map((s, si) => (
                    <div key={si} className={`flex items-center gap-1.5 rounded-lg transition-colors ${s.done ? "bg-green-500/10" : ""}`}>
                      <span className="text-xs text-muted-foreground w-7 text-center flex-shrink-0">{si + 1}</span>
                      <Input type="number" placeholder="횟수" value={s.reps}
                        onChange={(e) => updateSet(ei, si, "reps", e.target.value)}
                        className={`text-sm h-8 text-center flex-1 ${s.done ? "bg-green-500/10 border-green-500/30 text-green-400" : "bg-background"}`} />
                      <Input type="number" placeholder="kg" value={s.weight}
                        onChange={(e) => updateSet(ei, si, "weight", e.target.value)}
                        className={`text-sm h-8 text-center flex-1 ${s.done ? "bg-green-500/10 border-green-500/30 text-green-400" : "bg-background"}`} />
                      <button onClick={() => toggleSetDone(ei, si)}
                        className={`w-8 h-8 rounded-lg border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                          s.done ? "bg-green-500 border-green-500 text-white" : "border-muted-foreground text-muted-foreground hover:border-green-500 hover:text-green-400"
                        }`}>
                        <span className="text-xs font-bold">✓</span>
                      </button>
                      <button onClick={() => removeSet(ei, si)} className="text-red-400 p-1 flex-shrink-0 w-5">
                        {ex.sets.length > 1 && (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                          </svg>
                        )}
                      </button>
                    </div>
                  ))}
                  <button onClick={() => addSet(ei)} className="text-xs text-primary font-medium py-0.5 pl-7">
                    + 세트 추가
                  </button>
                </div>
              </div>
            );
          })}

          <Button className="w-full h-12 text-base font-bold mt-2 bg-red-500 hover:bg-red-600 text-white" onClick={handleFinish}>
            운동 종료 · {formatTime(elapsed)}
          </Button>
          <p className="text-xs text-muted-foreground text-center">종료하면 칼로리 리포트를 확인할 수 있어요</p>
          <Button
            variant="outline"
            className="w-full h-11 text-sm font-medium text-muted-foreground border-border hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30"
            onClick={() => { if (confirm("운동을 취소하시겠습니까? 저장되지 않습니다.")) onCancel(); }}
          >
            운동 취소 (저장 안 함)
          </Button>
        </div>

        {showVideo && <ExerciseVideoModal videoUrl={showVideo} onClose={() => setShowVideo(null)} />}
      </DialogContent>
    </Dialog>
  );
}

// ── 메인 컴포넌트 ─────────────────────────────────────────────────────────────
interface LogFormData {
  logDate: string;
  title: string;
  notes: string;
  conditionScore: number | null;
  sleepHours: string;
  energyLevel: string;
}

export default function GymPlusWorkout() {
  const [, navigate] = useLocation();
  const today = new Date().toISOString().slice(0, 10);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<LogFormData>({ logDate: today, title: "", notes: "", conditionScore: null, sleepHours: "", energyLevel: "" });
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [bodyParts, setBodyParts] = useState<string[]>([]);
  const [activeLog, setActiveLog] = useState<any | null>(null);

  // ── 준비운동 상태 ────────────────────────────────────────────────────────────
  const [warmupStatus, setWarmupStatus] = useState<"idle" | "running" | "paused" | "done">("idle");
  const [warmupRemaining, setWarmupRemaining] = useState(600);
  const warmupIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const warmupStartRef = useRef(0);    // 시작 시각 (일시정지 시간 누적 반영)
  const warmupPausedAtRef = useRef(0); // 일시정지된 시각

  function calcWarmupRemaining() {
    return Math.max(0, 600 - Math.floor((Date.now() - warmupStartRef.current) / 1000));
  }
  function startWarmupInterval() {
    warmupIntervalRef.current = setInterval(() => {
      const rem = calcWarmupRemaining();
      setWarmupRemaining(rem);
      if (rem <= 0) { clearInterval(warmupIntervalRef.current!); warmupIntervalRef.current = null; setWarmupStatus("done"); }
    }, 1000);
  }
  function startWarmup() {
    warmupStartRef.current = Date.now();
    setWarmupStatus("running");
    setWarmupRemaining(600);
    startWarmupInterval();
  }
  function pauseWarmup() {
    if (warmupIntervalRef.current) { clearInterval(warmupIntervalRef.current); warmupIntervalRef.current = null; }
    warmupPausedAtRef.current = Date.now();
    setWarmupStatus("paused");
  }
  function resumeWarmup() {
    // 일시정지된 시간만큼 시작 시각을 앞으로 당겨 누적 경과 시간 보정
    warmupStartRef.current += Date.now() - warmupPausedAtRef.current;
    setWarmupStatus("running");
    startWarmupInterval();
  }
  function completeWarmup() {
    if (warmupIntervalRef.current) clearInterval(warmupIntervalRef.current);
    setWarmupStatus("done");
  }
  function resetWarmup() {
    if (warmupIntervalRef.current) clearInterval(warmupIntervalRef.current);
    setWarmupStatus("idle");
    setWarmupRemaining(600);
  }

  // ── 유산소운동 상태 ───────────────────────────────────────────────────────────
  const [cardioStatus, setCardioStatus] = useState<"idle" | "settings" | "running" | "done">("idle");
  const [cardioInfo, setCardioInfo] = useState({ type: "", intensityLabel: "", met: 0, weight: 70 });
  const [cardioElapsed, setCardioElapsed] = useState(0);
  const cardioStartRef = useRef(0);
  const cardioIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [cardioReport, setCardioReport] = useState<{ calories: number; duration: number; type: string; intensityLabel: string } | null>(null);

  function startCardio(type: string, intensityLabel: string, met: number, weight: number) {
    setCardioInfo({ type, intensityLabel, met, weight });
    setCardioElapsed(0);
    cardioStartRef.current = Date.now();
    setCardioStatus("running");
    cardioIntervalRef.current = setInterval(() => {
      setCardioElapsed(Math.floor((Date.now() - cardioStartRef.current) / 1000));
    }, 1000);
  }
  function finishCardio() {
    if (cardioIntervalRef.current) clearInterval(cardioIntervalRef.current);
    const durationMin = Math.max(1, Math.round(cardioElapsed / 60));
    const calories = Math.round(cardioInfo.met * cardioInfo.weight * (durationMin / 60));
    setCardioReport({ calories, duration: durationMin, type: cardioInfo.type, intensityLabel: cardioInfo.intensityLabel });
    setCardioStatus("done");
  }
  function resetCardio() {
    if (cardioIntervalRef.current) clearInterval(cardioIntervalRef.current);
    setCardioStatus("idle");
    setCardioElapsed(0);
    setCardioReport(null);
  }

  // ── 화면 복귀 시 타이머 재동기화 ──────────────────────────────────────────────
  useEffect(() => {
    function onVisible() {
      if (document.visibilityState !== "visible") return;
      if (warmupStatus === "running") {
        const rem = calcWarmupRemaining();
        setWarmupRemaining(rem);
        if (rem <= 0) { setWarmupStatus("done"); if (warmupIntervalRef.current) { clearInterval(warmupIntervalRef.current); warmupIntervalRef.current = null; } }
      }
      if (cardioStatus === "running") {
        setCardioElapsed(Math.floor((Date.now() - cardioStartRef.current) / 1000));
      }
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [warmupStatus, cardioStatus]);

  const utils = trpc.useUtils();
  const { data: health } = trpc.gymPlus.getHealth.useQuery();
  const defaultWeight = health?.weight ?? "70";
  const { data: logs, isLoading } = trpc.gymPlus.listWorkoutLogs.useQuery({});
  const { data: todayRec } = trpc.gymPlus.getTodayRecommendations.useQuery();
  const { data: patternData, isFetching: patternLoading, refetch: refetchPattern } =
    trpc.gymPlus.analyzeWorkoutPattern.useQuery(undefined, { enabled: false });

  const [tab, setTab] = useState<"workout" | "history">("workout");
  const [analysisRequested, setAnalysisRequested] = useState(false);

  function requestAnalysis() {
    setAnalysisRequested(true);
    refetchPattern();
  }

  const createMutation = trpc.gymPlus.createWorkoutLog.useMutation({
    onSuccess: () => { utils.gymPlus.listWorkoutLogs.invalidate(); setShowForm(false); resetForm(); toast.success("운동 계획이 저장되었습니다"); },
    onError: (err) => toast.error(err.message),
  });

  const updateMutation = trpc.gymPlus.updateWorkoutLog.useMutation({
    onSuccess: () => { utils.gymPlus.listWorkoutLogs.invalidate(); setShowForm(false); setEditingId(null); resetForm(); toast.success("저장되었습니다"); },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = trpc.gymPlus.deleteWorkoutLog.useMutation({
    onSuccess: () => { utils.gymPlus.listWorkoutLogs.invalidate(); toast.success("삭제되었습니다"); },
    onError: (err) => toast.error(err.message),
  });

  function resetForm() {
    setForm({ logDate: today, title: "", notes: "", conditionScore: null, sleepHours: "", energyLevel: "" });
    setExercises([]);
    setBodyParts([]);
  }

  function openCreate() { resetForm(); setEditingId(null); setShowForm(true); }

  // 출석체크 시 추천된 운동을 오늘의 본 운동 종목으로 그대로 채워 넣는다.
  // 회원이 종목명을 직접 타이핑할 필요 없이 세트 체크만 하면 되도록 하는 것이 목적.
  const recommendedVideos = todayRec?.recommendedVideos ?? [];
  function startRecommendedWorkout() {
    if (recommendedVideos.length === 0) return;
    const exercises: Exercise[] = recommendedVideos.map((v: any) => ({
      name: v.title,
      videoUrl: v.videoUrl ?? undefined,
      restSeconds: v.restSeconds ?? undefined,
      // 추천 세트 수만큼 세트를 미리 만들어 두고, 목표 횟수를 기본값으로 채운다
      sets: Array.from({ length: v.recommendedSets ?? 3 }, () => ({
        reps: v.recommendedReps ?? "",
        weight: "",
      })),
    }));
    createMutation.mutate({
      logDate: today,
      title: "맞춤 운동",
      exercisesJson: JSON.stringify(exercises),
      bodyPartsJson: todayRec?.checkIn?.bodyPartsJson ?? undefined,
      conditionScore: todayRec?.checkIn?.conditionScore ?? undefined,
      sleepHours: todayRec?.checkIn?.sleepHours ?? undefined,
      energyLevel: todayRec?.checkIn?.energyLevel ?? undefined,
    });
  }

  function openEdit(log: any) {
    setForm({ logDate: log.logDate, title: log.title ?? "", notes: log.notes ?? "", conditionScore: log.conditionScore ?? null, sleepHours: log.sleepHours ?? "", energyLevel: log.energyLevel ?? "" });
    try {
      const parsed = log.exercisesJson ? JSON.parse(log.exercisesJson) : [];
      setExercises(parsed.map((ex: any) => Array.isArray(ex.sets) ? ex : { name: ex.name ?? "", sets: [] }));
    } catch { setExercises([]); }
    try { setBodyParts(log.bodyPartsJson ? JSON.parse(log.bodyPartsJson) : []); } catch { setBodyParts([]); }
    setEditingId(log.id);
    setShowForm(true);
  }

  function handleSubmit() {
    const data = {
      logDate: form.logDate,
      title: form.title || undefined,
      notes: form.notes || undefined,
      conditionScore: form.conditionScore ?? undefined,
      sleepHours: form.sleepHours || undefined,
      energyLevel: form.energyLevel || undefined,
      exercisesJson: exercises.filter(e => e.name).length > 0 ? JSON.stringify(exercises.filter(e => e.name)) : undefined,
      bodyPartsJson: bodyParts.length > 0 ? JSON.stringify(bodyParts) : undefined,
    };
    if (editingId) updateMutation.mutate({ id: editingId, ...data });
    else createMutation.mutate(data);
  }

  function handleWorkoutFinish(durationMinutes: number, updatedExercises: Exercise[], caloriesBurned: number) {
    if (!activeLog) return;
    updateMutation.mutate({
      id: activeLog.id,
      durationMinutes,
      caloriesBurned,
      exercisesJson: JSON.stringify(updatedExercises),
    }, {
      onSuccess: () => {
        setActiveLog(null);
        utils.gymPlus.listWorkoutLogs.invalidate();
        toast.success(`운동 완료! ${durationMinutes}분 · ${caloriesBurned}kcal`);
      },
    });
  }

  // 로그 카드 렌더 (두 탭 공유)
  function formatUploadedAt(createdAt: string | null | undefined) {
    if (!createdAt) return null;
    const d = new Date(createdAt);
    if (isNaN(d.getTime())) return null;
    const y = d.getFullYear(), mo = String(d.getMonth() + 1).padStart(2, "0"), da = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0"), mm = String(d.getMinutes()).padStart(2, "0");
    return `${y}.${mo}.${da} ${hh}:${mm}`;
  }

  function renderLogCard(log: any) {
    let parsedExercises: any[] = [];
    try { parsedExercises = log.exercisesJson ? JSON.parse(log.exercisesJson) : []; } catch {}
    let parsedBodyParts: string[] = [];
    try { parsedBodyParts = (log as any).bodyPartsJson ? JSON.parse((log as any).bodyPartsJson) : []; } catch {}
    const isCheckIn = log.title === "출석체크";
    // 트레이너가 통합운영시스템에서 전송한 기록 여부 (notes에 __src: 마커 포함)
    const isTrainerSent = typeof log.notes === "string" && log.notes.includes("__src:");
    const displayNotes = isTrainerSent
      ? log.notes.replace(/\n?__src:\d+/g, "").trim()
      : log.notes;
    const uploadedAt = formatUploadedAt(log.createdAt);

    return (
      <div key={log.id} className={`bg-card border rounded-xl p-4 space-y-2 ${isTrainerSent ? "border-primary/40" : "border-border"}`}>
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-xs text-muted-foreground">{log.logDate}</p>
              {isTrainerSent && (
                <span className="text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded-full font-medium">트레이너 전송</span>
              )}
            </div>
            <p className="font-semibold text-sm">{log.title || "운동 기록"}</p>
            {uploadedAt && (
              <p className="text-[10px] text-muted-foreground/70 mt-0.5">업로드 {uploadedAt}</p>
            )}
          </div>
          <div className="flex gap-1">
            {!isCheckIn && !isTrainerSent && (
              <button onClick={() => openEdit(log)} className="text-xs text-muted-foreground px-2 py-1 bg-muted rounded-lg">수정</button>
            )}
            <button onClick={() => { if (confirm("삭제하시겠습니까?")) deleteMutation.mutate({ id: log.id }); }}
              className="text-xs text-red-400 px-2 py-1 bg-red-500/10 rounded-lg">삭제</button>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {(log as any).conditionScore && (
            <span className="text-[10px] bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full">컨디션 {(log as any).conditionScore}/5</span>
          )}
          {(log as any).sleepHours && (
            <span className="text-[10px] bg-muted text-muted-foreground px-2 py-0.5 rounded-full">수면 {(log as any).sleepHours}</span>
          )}
          {(log as any).energyLevel && (
            <span className="text-[10px] bg-muted text-muted-foreground px-2 py-0.5 rounded-full">에너지 {(log as any).energyLevel}</span>
          )}
          {parsedBodyParts.map((p) => (
            <span key={p} className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full">{p}</span>
          ))}
          {log.durationMinutes && (
            <span className="text-[10px] bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full">⏱ {log.durationMinutes}분</span>
          )}
          {log.caloriesBurned && (
            <span className="text-[10px] bg-orange-500/20 text-orange-600 px-2 py-0.5 rounded-full">{log.caloriesBurned} kcal</span>
          )}
        </div>

        {parsedExercises.length > 0 && (
          <div className="space-y-1">
            {parsedExercises.filter((e: any) => e.name).map((ex: any, i: number) => (
              <ExerciseRowWithVideo key={i} ex={ex} />
            ))}
          </div>
        )}

        {displayNotes && <p className="text-xs text-muted-foreground border-t border-border pt-2">{displayNotes}</p>}

        {!isCheckIn && parsedExercises.length > 0 && (
          <button
            onClick={() => setActiveLog(log)}
            className="w-full mt-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-bold flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors"
          >
            <span>▶</span> 운동 시작
          </button>
        )}
      </div>
    );
  }

  const todayLogs = (logs ?? []).filter(l => l.logDate === today && l.title !== "출석체크");
  const todayCheckedIn = (logs ?? []).some(l => l.logDate === today && l.title === "출석체크");

  // 출석 체크를 먼저 완료해야 운동 기록을 확인/작성할 수 있다
  if (!isLoading && !todayCheckedIn) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center">
          <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.8} stroke="currentColor" className="w-7 h-7 text-muted-foreground">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
          </svg>
        </div>
        <div className="space-y-1">
          <p className="font-bold text-base">먼저 출석 체크를 해주세요</p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            운동영상 탭에서 출석 체크를 완료하면<br />운동 기록을 확인하고 작성할 수 있어요
          </p>
        </div>
        <Button onClick={() => navigate("/gym-plus/videos")}>출석하러 가기</Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* 탭 헤더 */}
      <div className="flex border-b border-border bg-background sticky top-0 z-10">
        <button
          onClick={() => setTab("workout")}
          className={`flex-1 py-3 text-sm font-medium transition-colors ${
            tab === "workout" ? "text-primary border-b-2 border-primary" : "text-muted-foreground"
          }`}
        >
          오늘 운동
        </button>
        <button
          onClick={() => setTab("history")}
          className={`flex-1 py-3 text-sm font-medium transition-colors ${
            tab === "history" ? "text-primary border-b-2 border-primary" : "text-muted-foreground"
          }`}
        >
          기록
        </button>
      </div>

      {/* ── 오늘 운동 탭 ── */}
      {tab === "workout" && (
        <div className="p-4 space-y-3">

          {/* ── 1. 준비운동 카드 ── */}
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded bg-orange-500/20 text-orange-600 text-[10px] font-bold flex items-center justify-center">준비</span>
                <div>
                  <p className="font-semibold text-sm">준비운동</p>
                  <p className="text-[10px] text-muted-foreground">10분 스트레칭 · 부상 예방</p>
                </div>
              </div>
              <span className={`text-[10px] px-2.5 py-1 rounded-full font-medium ${
                warmupStatus === "done" ? "bg-green-500/20 text-green-400" :
                warmupStatus === "running" ? "bg-primary/20 text-primary" :
                warmupStatus === "paused" ? "bg-yellow-500/20 text-yellow-400" :
                "bg-muted text-muted-foreground"
              }`}>
                {warmupStatus === "done" ? "완료 ✓" : warmupStatus === "running" ? "진행 중" : warmupStatus === "paused" ? "일시정지" : "대기"}
              </span>
            </div>

            <div className="px-4 py-4">
              {warmupStatus === "idle" && (
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">준비운동으로 부상을 예방하세요</p>
                  <button
                    onClick={startWarmup}
                    className="px-5 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
                  >▶ 시작</button>
                </div>
              )}

              {(warmupStatus === "running" || warmupStatus === "paused") && (
                <div className="space-y-3">
                  <div className="text-center">
                    <p className={`text-4xl font-mono font-bold ${warmupRemaining === 0 ? "text-green-400" : warmupStatus === "paused" ? "text-yellow-400" : "text-foreground"}`}>
                      {formatTime(warmupRemaining)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {warmupRemaining === 0 ? "완료! 아래 버튼을 눌러주세요" : warmupStatus === "paused" ? "일시정지됨" : "남은 시간"}
                    </p>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all ${warmupRemaining === 0 ? "bg-green-500" : warmupStatus === "paused" ? "bg-yellow-500" : "bg-primary"}`}
                      style={{ width: `${((600 - warmupRemaining) / 600) * 100}%` }}
                    />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={resetWarmup} className="py-2 px-3 rounded-xl border border-border text-xs text-muted-foreground hover:border-red-500/50 hover:text-red-400 transition-colors">
                      중단
                    </button>
                    {warmupStatus === "running" ? (
                      <button onClick={pauseWarmup} className="py-2 px-3 rounded-xl border border-yellow-500/40 text-xs text-yellow-400 hover:bg-yellow-500/10 transition-colors">
                        ⏸ 일시정지
                      </button>
                    ) : (
                      <button onClick={resumeWarmup} className="py-2 px-3 rounded-xl border border-primary/40 text-xs text-primary hover:bg-primary/10 transition-colors">
                        ▶ 재시작
                      </button>
                    )}
                    <button
                      onClick={completeWarmup}
                      disabled={warmupRemaining > 0}
                      className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-colors ${
                        warmupRemaining === 0
                          ? "bg-green-500 text-white hover:bg-green-400 animate-pulse"
                          : "bg-muted text-muted-foreground cursor-not-allowed opacity-40"
                      }`}
                    >
                      ✓ 완료
                    </button>
                  </div>
                </div>
              )}

              {warmupStatus === "done" && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <svg viewBox="0 0 24 24" fill="none" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5 text-green-500 flex-shrink-0">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                    <div>
                      <p className="text-sm font-semibold text-green-400">준비운동 완료!</p>
                      <p className="text-[10px] text-muted-foreground">근력·유산소 운동을 시작하세요</p>
                    </div>
                  </div>
                  <button onClick={resetWarmup} className="text-xs text-muted-foreground px-3 py-1.5 bg-muted rounded-lg">다시하기</button>
                </div>
              )}
            </div>
          </div>

          {/* ── 2. 본 운동 카드 ── */}
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded bg-primary/20 text-primary text-[10px] font-bold flex items-center justify-center">본</span>
                <div>
                  <p className="font-semibold text-sm">본 운동</p>
                  <p className="text-[10px] text-muted-foreground">맞춤 운동 받기 · 직접 기록</p>
                </div>
              </div>
              {todayLogs.length > 0 && (
                <span className="text-[10px] bg-primary/20 text-primary px-2.5 py-1 rounded-full font-medium">{todayLogs.length}개 등록</span>
              )}
            </div>
            <div className="px-4 py-3 space-y-3">
              {todayLogs.length === 0 ? (
                <>
                  <p className="text-xs text-muted-foreground text-center">오늘 운동을 어떻게 시작할까요?</p>
                  <div className="grid grid-cols-2 gap-2">
                    {/* 맞춤 운동 받기 — 추천 종목·세트·횟수가 자동으로 채워진다 */}
                    <button
                      onClick={startRecommendedWorkout}
                      disabled={recommendedVideos.length === 0 || createMutation.isPending}
                      className="flex flex-col items-center gap-1.5 py-4 px-2 rounded-xl bg-primary text-primary-foreground font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-110 active:scale-95 transition-all"
                    >
                      <span className="text-lg leading-none">✦</span>
                      <span className="text-sm">맞춤 운동 받기</span>
                      <span className="text-[10px] font-normal opacity-80">
                        {recommendedVideos.length > 0 ? `${recommendedVideos.length}개 종목 자동 입력` : "출석체크 후 이용 가능"}
                      </span>
                    </button>
                    {/* 직접 기록 — 기존 방식 */}
                    <button
                      onClick={openCreate}
                      className="flex flex-col items-center gap-1.5 py-4 px-2 rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 hover:bg-primary/10 active:scale-95 transition-all"
                    >
                      <span className="text-primary font-bold text-lg leading-none">+</span>
                      <span className="text-sm font-semibold text-primary">직접 기록하기</span>
                      <span className="text-[10px] text-muted-foreground">종목을 직접 입력</span>
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-2">
                    {todayLogs.map(log => renderLogCard(log))}
                  </div>
                  <button
                    onClick={openCreate}
                    className="w-full py-2.5 rounded-xl border border-dashed border-border text-xs text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors"
                  >
                    + 운동 추가
                  </button>
                </>
              )}
            </div>
          </div>

          {/* ── 3. 유산소운동 카드 ── */}
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded bg-green-500/20 text-green-600 text-[10px] font-bold flex items-center justify-center">유산</span>
                <div>
                  <p className="font-semibold text-sm">유산소운동</p>
                  <p className="text-[10px] text-muted-foreground">걷기 · 조깅 · 러닝 · 고정식 사이클</p>
                </div>
              </div>
              <span className={`text-[10px] px-2.5 py-1 rounded-full font-medium ${
                cardioStatus === "done" ? "bg-green-500/20 text-green-400" :
                cardioStatus === "running" ? "bg-orange-500/20 text-orange-400" :
                "bg-muted text-muted-foreground"
              }`}>
                {cardioStatus === "done" ? "완료 ✓" : cardioStatus === "running" ? "진행 중" : "대기"}
              </span>
            </div>

            <div className="px-4 py-4">
              {cardioStatus === "idle" && (
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">유산소 운동으로 심폐 능력을 키우세요</p>
                  <button
                    onClick={() => setCardioStatus("settings")}
                    className="px-5 py-2 rounded-xl bg-orange-500 text-white text-sm font-semibold hover:bg-orange-400 transition-colors"
                  >▶ 시작</button>
                </div>
              )}

              {cardioStatus === "running" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{CARDIO_EMOJI[cardioInfo.type]} {cardioInfo.type}</span>
                    <span>{cardioInfo.intensityLabel}</span>
                  </div>
                  <div className="text-center">
                    <p className="text-4xl font-mono font-bold text-orange-400">{formatTime(cardioElapsed)}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      예상 소모: <span className="font-bold text-foreground">{Math.round(cardioInfo.met * cardioInfo.weight * (Math.max(1, cardioElapsed) / 3600))} kcal</span>
                    </p>
                  </div>
                  <button
                    onClick={finishCardio}
                    className="w-full py-2.5 rounded-xl bg-green-500 text-white text-sm font-semibold hover:bg-green-400 transition-colors"
                  >✓ 완료</button>
                </div>
              )}

              {cardioStatus === "done" && cardioReport && (
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-3 text-center">
                      <p className="text-[10px] text-muted-foreground">소모 칼로리</p>
                      <p className="text-lg font-bold text-orange-400">{cardioReport.calories}</p>
                      <p className="text-[9px] text-muted-foreground">kcal</p>
                    </div>
                    <div className="bg-muted/30 rounded-xl p-3 text-center">
                      <p className="text-[10px] text-muted-foreground">운동 시간</p>
                      <p className="text-lg font-bold">{cardioReport.duration}</p>
                      <p className="text-[9px] text-muted-foreground">분</p>
                    </div>
                    <div className="bg-muted/30 rounded-xl p-3 text-center">
                      <p className="text-[10px] text-muted-foreground">종류</p>
                      <p className="text-base font-bold">{CARDIO_EMOJI[cardioReport.type]}</p>
                      <p className="text-[9px] text-muted-foreground">{cardioReport.type}</p>
                    </div>
                  </div>
                  <div className="bg-muted/20 rounded-xl px-3 py-2 text-xs text-center text-muted-foreground">
                    {cardioReport.intensityLabel}
                  </div>
                  <button onClick={resetCardio} className="w-full py-2 rounded-xl border border-border text-xs text-muted-foreground hover:border-primary/50 transition-colors">다시하기</button>
                </div>
              )}
            </div>
          </div>

        </div>
      )}

      {/* 유산소 설정 모달 */}
      {cardioStatus === "settings" && (
        <CardioSettingsModal
          defaultWeight={defaultWeight}
          onClose={() => setCardioStatus("idle")}
          onStart={(type, intensityLabel, met, weight) => startCardio(type, intensityLabel, met, weight)}
        />
      )}

      {/* ── 기록 탭 ── */}
      {tab === "history" && (
        <div className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <p className="font-semibold text-sm">운동 기록</p>
            <Button size="sm" className="h-7 text-xs" onClick={openCreate}>+ 추가</Button>
          </div>

          {/* AI 운동 패턴 분석 */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <div className="flex items-center gap-2">
                <span className="text-base">🤖</span>
                <p className="font-semibold text-sm">AI 운동 패턴 분석</p>
                {patternData?.isAI && <span className="text-[9px] bg-primary/20 text-primary px-1.5 py-0.5 rounded-full">AI</span>}
              </div>
              <button
                onClick={requestAnalysis}
                disabled={patternLoading}
                className="text-xs bg-primary text-primary-foreground px-3 py-1.5 rounded-lg font-medium disabled:opacity-50 transition-opacity"
              >
                {patternLoading ? "분석 중..." : analysisRequested ? "재분석" : "분석하기"}
              </button>
            </div>

            {patternLoading && (
              <div className="p-6 text-center space-y-2">
                <div className="w-8 h-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin mx-auto" />
                <p className="text-sm text-muted-foreground">운동 데이터를 분석하고 있어요...</p>
              </div>
            )}

            {!patternLoading && patternData && (
              <div className="p-4 space-y-4">
                {/* 통계 카드 */}
                {patternData.stats && (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-muted/40 rounded-xl p-3 text-center">
                        <p className="text-[10px] text-muted-foreground mb-1">총 운동 횟수</p>
                        <p className="text-xl font-bold text-foreground">{patternData.stats.totalWorkouts}<span className="text-xs font-normal text-muted-foreground">회</span></p>
                      </div>
                      <div className="bg-muted/40 rounded-xl p-3 text-center">
                        <p className="text-[10px] text-muted-foreground mb-1">총 운동 시간</p>
                        <p className="text-xl font-bold text-foreground">{patternData.stats.totalMinutes}<span className="text-xs font-normal text-muted-foreground">분</span></p>
                      </div>
                      <div className="bg-muted/40 rounded-xl p-3 text-center">
                        <p className="text-[10px] text-muted-foreground mb-1">총 소모 칼로리</p>
                        <p className="text-xl font-bold text-orange-400">{patternData.stats.totalCalories.toLocaleString()}<span className="text-xs font-normal text-muted-foreground">kcal</span></p>
                      </div>
                      <div className="bg-muted/40 rounded-xl p-3 text-center">
                        <p className="text-[10px] text-muted-foreground mb-1">총 볼륨</p>
                        <p className="text-xl font-bold text-primary">{(patternData.stats.totalVolume / 1000).toFixed(1)}<span className="text-xs font-normal text-muted-foreground">t</span></p>
                      </div>
                    </div>

                    {/* 자주 훈련한 부위 */}
                    {patternData.stats.topParts.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-muted-foreground">최근 60일 부위별 빈도</p>
                        {patternData.stats.topParts.map(([part, count]: [string, number]) => (
                          <div key={part} className="flex items-center gap-2">
                            <span className="text-xs text-foreground w-16 flex-shrink-0">{part}</span>
                            <div className="flex-1 bg-muted rounded-full h-2">
                              <div
                                className="bg-primary h-2 rounded-full transition-all"
                                style={{ width: `${Math.min((count / (patternData.stats!.totalWorkouts || 1)) * 100, 100)}%` }}
                              />
                            </div>
                            <span className="text-[10px] text-muted-foreground w-8 text-right">{count}회</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* 미훈련 부위 경고 */}
                    {patternData.stats.missingParts.length > 0 && (
                      <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-3">
                        <p className="text-xs font-medium text-yellow-600 mb-1.5">훈련이 부족한 부위</p>
                        <div className="flex flex-wrap gap-1">
                          {patternData.stats.missingParts.map(p => (
                            <span key={p} className="text-[10px] bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded-full">{p}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* AI 분석 텍스트 */}
                {patternData.analysis && (
                  <div className="space-y-2">
                    <div className="h-px bg-border" />
                    <p className="text-xs font-medium text-primary">AI 코치 피드백</p>
                    <div className="text-xs text-foreground leading-relaxed whitespace-pre-wrap">
                      {patternData.analysis}
                    </div>
                  </div>
                )}

                {!patternData.analysis && patternData.stats && (
                  <p className="text-xs text-muted-foreground text-center">ANTHROPIC_API_KEY 설정 시 AI 분석이 활성화됩니다</p>
                )}
              </div>
            )}

            {!patternLoading && !analysisRequested && (
              <div className="p-4 text-center text-xs text-muted-foreground">
                분석하기 버튼을 눌러 최근 60일 운동 패턴을 확인하세요
              </div>
            )}
          </div>

          {isLoading ? (
            <div className="text-center py-10 text-muted-foreground text-sm">불러오는 중...</div>
          ) : !logs || logs.filter(l => l.title !== "출석체크").length === 0 ? (
            <div className="text-center py-10 space-y-3">
              <p className="text-muted-foreground text-sm">아직 운동 기록이 없습니다</p>
              <Button variant="outline" size="sm" onClick={openCreate}>첫 기록 남기기</Button>
            </div>
          ) : (
            <div className="space-y-3">
              {(logs ?? []).filter(l => l.title !== "출석체크").map(log => renderLogCard(log))}
            </div>
          )}
        </div>
      )}

      {/* 기록 작성 폼 */}
      <Dialog open={showForm} onOpenChange={(o) => { setShowForm(o); if (!o) { setEditingId(null); resetForm(); } }}>
        <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <h2 className="font-bold text-base">{editingId ? "운동 기록 수정" : "운동 계획 작성"}</h2>
            <p className="text-xs text-muted-foreground">종목을 입력하고 운동 시작 시 세트/무게를 기록하세요</p>
          </DialogHeader>
          <div className="space-y-4 pb-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">날짜</Label>
              <Input type="date" value={form.logDate}
                onChange={(e) => setForm((p) => ({ ...p, logDate: e.target.value }))}
                className="bg-input border-border text-sm h-9" />
            </div>
            {/* 컨디션 */}
            <div className="space-y-3">
              <p className="text-sm font-semibold text-primary">컨디션 평가</p>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">오늘 컨디션 (1 매우안좋음 → 5 최고)</Label>
                <div className="grid grid-cols-5 gap-1.5">
                  {[1,2,3,4,5].map((n) => (
                    <button key={n}
                      onClick={() => setForm((p) => ({ ...p, conditionScore: p.conditionScore === n ? null : n }))}
                      className={`py-3 rounded-xl text-sm font-bold transition-colors border ${
                        form.conditionScore === n ? "bg-primary/20 border-primary text-primary" : "border-border text-muted-foreground"
                      }`}
                    >{n}</button>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">수면시간</Label>
                <div className="grid grid-cols-6 gap-1">
                  {SLEEP_OPTIONS.map((s) => (
                    <button key={s}
                      onClick={() => setForm((p) => ({ ...p, sleepHours: p.sleepHours === s ? "" : s }))}
                      className={`py-2.5 rounded-xl text-xs font-medium transition-colors border ${
                        form.sleepHours === s ? "bg-primary/20 border-primary text-primary" : "border-border text-muted-foreground"
                      }`}
                    >{s}</button>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">에너지 수준</Label>
                <div className="grid grid-cols-3 gap-2">
                  {ENERGY_OPTIONS.map((e) => (
                    <button key={e}
                      onClick={() => setForm((p) => ({ ...p, energyLevel: p.energyLevel === e ? "" : e }))}
                      className={`py-3 rounded-xl text-sm font-medium transition-colors border ${
                        form.energyLevel === e ? "bg-primary/20 border-primary text-primary" : "border-border text-muted-foreground"
                      }`}
                    >{e}</button>
                  ))}
                </div>
              </div>
            </div>

            <BodyPartSelector selected={bodyParts} onChange={setBodyParts} />

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">운동 종목</Label>
              <ExerciseNameForm exercises={exercises} setExercises={setExercises} />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">메모</Label>
              <textarea placeholder="오늘 운동 메모를 입력하세요..." value={form.notes}
                onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                rows={3}
                className="w-full bg-input border border-border rounded-lg p-2 text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1"
                onClick={() => { setShowForm(false); setEditingId(null); resetForm(); }}>취소</Button>
              <Button className="flex-1" onClick={handleSubmit}
                disabled={createMutation.isPending || updateMutation.isPending}>
                {createMutation.isPending || updateMutation.isPending ? "저장 중..." : "저장"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 운동 진행 모달 */}
      {activeLog && (
        <ActiveWorkoutModal
          log={activeLog}
          onClose={handleWorkoutFinish}
          onCancel={() => setActiveLog(null)}
        />
      )}
    </div>
  );
}
