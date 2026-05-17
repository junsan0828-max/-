import { useState, useEffect, useRef } from "react";
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

const BODY_PARTS = [
  "전신", "상체", "하체",
  "등", "어깨", "가슴",
  "복부", "허리", "코어",
  "엉덩이", "대퇴 후면", "대퇴 전면",
  "하퇴", "이두", "삼두",
  "기타",
];

interface ExerciseSet { reps: string; weight: string; }
interface Exercise { name: string; sets: ExerciseSet[]; videoUrl?: string; }

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
            {ex.sets[0]?.reps ? ` × ${ex.sets[0].reps}회` : ""}
            {ex.sets[0]?.weight ? ` ${ex.sets[0].weight}kg` : ""}
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

// ── 운동 진행 모달 (타이머 + 세트 기록) ───────────────────────────────────────
interface ActiveSet { reps: string; weight: string; }
interface ActiveExercise { name: string; sets: ActiveSet[]; done: boolean; videoUrl?: string; }

function ActiveWorkoutModal({
  log,
  onClose,
}: {
  log: any;
  onClose: (durationMinutes: number, updatedExercises: Exercise[]) => void;
}) {
  const [elapsed, setElapsed] = useState(0);
  const [paused, setPaused] = useState(false);
  const startRef = useRef(Date.now());
  const pausedAtRef = useRef(0);
  const [exList, setExList] = useState<ActiveExercise[]>(() => {
    try {
      const parsed: any[] = log.exercisesJson ? JSON.parse(log.exercisesJson) : [];
      return parsed.map((e: any) => ({
        name: e.name ?? "",
        sets: Array.isArray(e.sets) && e.sets.length > 0 ? e.sets : [{ reps: "", weight: "" }],
        done: false,
        videoUrl: e.videoUrl,
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

  function togglePause() {
    if (paused) {
      // 재개: 일시정지된 시간만큼 startRef를 앞으로 당김
      startRef.current += Date.now() - pausedAtRef.current;
      setPaused(false);
    } else {
      pausedAtRef.current = Date.now();
      setPaused(true);
    }
  }

  function toggleDone(i: number) {
    setExList((prev) => prev.map((e, j) => j === i ? { ...e, done: !e.done } : e));
  }

  function updateSet(ei: number, si: number, field: keyof ActiveSet, val: string) {
    setExList((prev) => prev.map((e, j) => {
      if (j !== ei) return e;
      const sets = e.sets.map((s, k) => k === si ? { ...s, [field]: val } : s);
      return { ...e, sets };
    }));
  }

  function addSet(ei: number) {
    setExList((prev) => prev.map((e, j) => {
      if (j !== ei) return e;
      const last = e.sets[e.sets.length - 1] ?? { reps: "", weight: "" };
      return { ...e, sets: [...e.sets, { ...last }] };
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
    const updated: Exercise[] = exList.map((e) => ({
      name: e.name,
      sets: e.sets,
      videoUrl: e.videoUrl,
    }));
    onClose(minutes, updated);
  }

  const doneCount = exList.filter((e) => e.done).length;

  return (
    <Dialog open onOpenChange={() => {}}>
      <DialogContent className="max-w-sm max-h-[92vh] overflow-y-auto p-0 [&>button]:hidden">
        {/* 타이머 헤더 */}
        <div className="bg-primary/10 border-b border-primary/20 px-4 py-4 text-center sticky top-0 z-10">
          <p className={`text-xs font-medium mb-1 ${paused ? "text-yellow-400" : "text-primary"}`}>
            {paused ? "일시정지" : "운동 중"}
          </p>
          <p className={`text-4xl font-mono font-bold ${paused ? "text-yellow-400" : "text-foreground"}`}>
            {formatTime(elapsed)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">{doneCount}/{exList.length} 완료</p>
          <button
            onClick={togglePause}
            className={`mt-2 px-4 py-1.5 rounded-full text-xs font-medium transition-colors border ${
              paused
                ? "bg-primary/20 border-primary text-primary"
                : "bg-yellow-500/20 border-yellow-500/50 text-yellow-400"
            }`}
          >
            {paused ? "▶ 재개" : "⏸ 일시정지"}
          </button>
        </div>

        <div className="p-4 space-y-3">
          {exList.map((ex, ei) => (
            <div key={ei} className={`border rounded-xl overflow-hidden transition-colors ${ex.done ? "border-green-500/40 bg-green-500/5" : "border-border bg-card"}`}>
              {/* 종목 헤더 */}
              <div className="flex items-center gap-2 px-3 py-2.5">
                <button
                  onClick={() => toggleDone(ei)}
                  className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                    ex.done ? "bg-green-500 border-green-500 text-white" : "border-muted-foreground"
                  }`}
                >
                  {ex.done && <span className="text-xs">✓</span>}
                </button>
                <span className={`flex-1 text-sm font-medium ${ex.done ? "text-green-400 line-through" : "text-foreground"}`}>
                  {ex.name}
                </span>
                {ex.videoUrl && (
                  <button onClick={() => setShowVideo(ex.videoUrl!)}
                    className="text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded-full flex-shrink-0">
                    ▶ 영상
                  </button>
                )}
              </div>

              {/* 세트 기록 (접히지 않음) */}
              <div className="px-3 pb-3 space-y-1.5">
                {/* 헤더 */}
                <div className="flex gap-2 text-[10px] text-muted-foreground px-7">
                  <span className="flex-1 text-center">세트</span>
                  <span className="flex-1 text-center">횟수</span>
                  <span className="flex-1 text-center">무게(kg)</span>
                  <span className="w-5" />
                </div>
                {ex.sets.map((s, si) => (
                  <div key={si} className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-7 text-center flex-shrink-0">{si + 1}</span>
                    <Input
                      type="number"
                      placeholder="횟수"
                      value={s.reps}
                      onChange={(e) => updateSet(ei, si, "reps", e.target.value)}
                      className="bg-background text-sm h-8 text-center flex-1"
                    />
                    <Input
                      type="number"
                      placeholder="kg"
                      value={s.weight}
                      onChange={(e) => updateSet(ei, si, "weight", e.target.value)}
                      className="bg-background text-sm h-8 text-center flex-1"
                    />
                    <button onClick={() => removeSet(ei, si)}
                      className="text-red-400 p-1 flex-shrink-0 w-5">
                      {ex.sets.length > 1 && (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                      )}
                    </button>
                  </div>
                ))}
                <button onClick={() => addSet(ei)}
                  className="text-xs text-primary font-medium py-0.5 pl-7">
                  + 세트 추가
                </button>
              </div>
            </div>
          ))}

          {/* 운동 종료 */}
          <Button
            className="w-full h-12 text-base font-bold mt-2 bg-red-500 hover:bg-red-600 text-white"
            onClick={handleFinish}
          >
            운동 종료 · {formatTime(elapsed)}
          </Button>
          <p className="text-xs text-muted-foreground text-center">종료하면 운동 시간이 자동으로 기록됩니다</p>
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
  const today = new Date().toISOString().slice(0, 10);
  const [selectedMonth, setSelectedMonth] = useState(today.slice(0, 7));
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<LogFormData>({ logDate: today, title: "", notes: "", conditionScore: null, sleepHours: "", energyLevel: "" });
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [bodyParts, setBodyParts] = useState<string[]>([]);
  const [activeLog, setActiveLog] = useState<any | null>(null);

  const utils = trpc.useUtils();
  const { data: logs, isLoading } = trpc.gymPlus.listWorkoutLogs.useQuery({ month: selectedMonth });

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

  function handleWorkoutFinish(durationMinutes: number, updatedExercises: Exercise[]) {
    if (!activeLog) return;
    updateMutation.mutate({
      id: activeLog.id,
      durationMinutes,
      exercisesJson: JSON.stringify(updatedExercises),
    }, {
      onSuccess: () => {
        setActiveLog(null);
        utils.gymPlus.listWorkoutLogs.invalidate();
        toast.success(`운동 완료! ${durationMinutes}분 기록됨`);
      },
    });
  }

  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(); d.setMonth(d.getMonth() - i);
    return d.toISOString().slice(0, 7);
  });

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-bold text-lg">운동 기록</h1>
        <Button size="sm" className="h-8 text-xs" onClick={openCreate}>+ 기록하기</Button>
      </div>

      {/* 월 선택 */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4">
        {months.map((m) => (
          <button key={m} onClick={() => setSelectedMonth(m)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              selectedMonth === m ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            }`}
          >
            {m.replace("-", "년 ")}월
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="text-center py-10 text-muted-foreground text-sm">불러오는 중...</div>
      ) : !logs || logs.length === 0 ? (
        <div className="text-center py-10 space-y-3">
          <p className="text-muted-foreground text-sm">이 달의 운동 기록이 없습니다</p>
          <Button variant="outline" size="sm" onClick={openCreate}>첫 기록 남기기</Button>
        </div>
      ) : (
        <div className="space-y-3">
          {logs.map((log) => {
            let parsedExercises: any[] = [];
            try { parsedExercises = log.exercisesJson ? JSON.parse(log.exercisesJson) : []; } catch {}
            let parsedBodyParts: string[] = [];
            try { parsedBodyParts = (log as any).bodyPartsJson ? JSON.parse((log as any).bodyPartsJson) : []; } catch {}
            const isCheckIn = log.title === "출석체크";
            return (
              <div key={log.id} className="bg-card border border-border rounded-xl p-4 space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">{log.logDate}</p>
                    <p className="font-semibold text-sm">{log.title || "운동 기록"}</p>
                  </div>
                  <div className="flex gap-1">
                    {!isCheckIn && (
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
                    <span className="text-[10px] bg-muted text-muted-foreground px-2 py-0.5 rounded-full">😴 {(log as any).sleepHours}</span>
                  )}
                  {(log as any).energyLevel && (
                    <span className="text-[10px] bg-muted text-muted-foreground px-2 py-0.5 rounded-full">⚡ {(log as any).energyLevel}</span>
                  )}
                  {parsedBodyParts.map((p) => (
                    <span key={p} className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full">{p}</span>
                  ))}
                  {log.durationMinutes && (
                    <span className="text-[10px] bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full">⏱ {log.durationMinutes}분</span>
                  )}
                </div>

                {parsedExercises.length > 0 && (
                  <div className="space-y-1">
                    {parsedExercises.filter((e) => e.name).map((ex, i) => (
                      <ExerciseRowWithVideo key={i} ex={ex} />
                    ))}
                  </div>
                )}

                {log.notes && <p className="text-xs text-muted-foreground border-t border-border pt-2">{log.notes}</p>}

                {/* 운동 시작 버튼 */}
                {!isCheckIn && parsedExercises.filter(e => e.name).length > 0 && (
                  <button
                    onClick={() => setActiveLog(log)}
                    className="w-full mt-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-bold flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors"
                  >
                    <span>▶</span> 운동 시작
                  </button>
                )}
              </div>
            );
          })}
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
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">제목 (선택)</Label>
              <Input placeholder="예: 가슴 운동, 하체 데이..." value={form.title}
                onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
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
        />
      )}
    </div>
  );
}
