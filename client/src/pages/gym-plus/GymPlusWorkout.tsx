import { useState } from "react";
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
  "고관절", "대퇴 후면", "대퇴 전면",
  "하퇴", "발목·발", "이두",
  "삼두", "유산소", "기타",
];

interface ExerciseSet {
  reps: string;
  weight: string;
}

interface Exercise {
  name: string;
  sets: ExerciseSet[];
}

// ── 세트 행 ──────────────────────────────────────────────────────────────────
function SetRow({
  setNum,
  s,
  onUpdate,
  onCopy,
  onRemove,
}: {
  setNum: number;
  s: ExerciseSet;
  onUpdate: (field: keyof ExerciseSet, val: string) => void;
  onCopy: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground w-4 text-center flex-shrink-0">{setNum}</span>
      <Input
        placeholder="횟수"
        value={s.reps}
        onChange={(e) => onUpdate("reps", e.target.value)}
        className="bg-background text-sm h-8 text-center flex-1"
      />
      <Input
        placeholder="kg"
        value={s.weight}
        onChange={(e) => onUpdate("weight", e.target.value)}
        className="bg-background text-sm h-8 text-center flex-1"
      />
      <button onClick={onCopy} className="text-muted-foreground flex-shrink-0 p-1" aria-label="복사">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
      </button>
      <button onClick={onRemove} className="text-red-400 flex-shrink-0 p-1" aria-label="삭제">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>
      </button>
    </div>
  );
}

// ── 드래그 가능한 운동 항목 ────────────────────────────────────────────────────
function SortableExerciseItem({
  id,
  ex,
  index,
  onUpdateExercise,
  onRemoveExercise,
}: {
  id: string;
  ex: Exercise;
  index: number;
  onUpdateExercise: (i: number, updated: Exercise) => void;
  onRemoveExercise: (i: number) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  function updateSet(si: number, field: keyof ExerciseSet, val: string) {
    const newSets = ex.sets.map((s, j) => j === si ? { ...s, [field]: val } : s);
    onUpdateExercise(index, { ...ex, sets: newSets });
  }

  function copySet(si: number) {
    const newSets = [...ex.sets];
    newSets.splice(si + 1, 0, { ...ex.sets[si] });
    onUpdateExercise(index, { ...ex, sets: newSets });
  }

  function removeSet(si: number) {
    if (ex.sets.length <= 1) return;
    onUpdateExercise(index, { ...ex, sets: ex.sets.filter((_, j) => j !== si) });
  }

  function addSet() {
    const last = ex.sets[ex.sets.length - 1] ?? { reps: "", weight: "" };
    onUpdateExercise(index, { ...ex, sets: [...ex.sets, { ...last }] });
  }

  return (
    <div ref={setNodeRef} style={style} className="bg-muted/30 border border-border rounded-xl p-3 space-y-2">
      {/* 운동명 행 */}
      <div className="flex items-center gap-2">
        <button
          {...attributes}
          {...listeners}
          className="text-muted-foreground flex-shrink-0 touch-none cursor-grab active:cursor-grabbing px-1 text-base"
          aria-label="순서 변경"
        >
          ⠿
        </button>
        <Input
          placeholder="운동명 (예: 레그프레스)"
          value={ex.name}
          onChange={(e) => onUpdateExercise(index, { ...ex, name: e.target.value })}
          className="bg-background text-sm h-8 flex-1"
        />
        <button onClick={() => onRemoveExercise(index)} className="text-red-400 flex-shrink-0 p-1" aria-label="운동 삭제">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>
        </button>
      </div>

      {/* 세트 헤더 */}
      <div className="flex items-center gap-2 px-0.5">
        <span className="w-4" />
        <span className="text-[10px] text-muted-foreground flex-1 text-center">세트  횟수</span>
        <span className="text-[10px] text-muted-foreground flex-1 text-center">무게(kg)</span>
        <span className="w-8" />
      </div>

      {/* 세트 목록 */}
      <div className="space-y-1.5">
        {ex.sets.map((s, si) => (
          <SetRow
            key={si}
            setNum={si + 1}
            s={s}
            onUpdate={(field, val) => updateSet(si, field, val)}
            onCopy={() => copySet(si)}
            onRemove={() => removeSet(si)}
          />
        ))}
      </div>

      <button
        onClick={addSet}
        className="text-xs text-primary font-medium py-1"
      >
        + 세트 추가
      </button>
    </div>
  );
}

// ── 운동 폼 ──────────────────────────────────────────────────────────────────
function ExerciseForm({
  exercises,
  setExercises,
}: {
  exercises: Exercise[];
  setExercises: (v: Exercise[]) => void;
}) {
  const ids = exercises.map((_, i) => `exercise-${i}`);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
  );

  function addExercise() {
    setExercises([...exercises, { name: "", sets: [{ reps: "", weight: "" }] }]);
  }

  function updateExercise(i: number, updated: Exercise) {
    const next = [...exercises];
    next[i] = updated;
    setExercises(next);
  }

  function removeExercise(i: number) {
    setExercises(exercises.filter((_, j) => j !== i));
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = ids.indexOf(active.id as string);
    const newIndex = ids.indexOf(over.id as string);
    setExercises(arrayMove(exercises, oldIndex, newIndex));
  }

  return (
    <div className="space-y-2">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          {exercises.map((ex, i) => (
            <SortableExerciseItem
              key={ids[i]}
              id={ids[i]}
              ex={ex}
              index={i}
              onUpdateExercise={updateExercise}
              onRemoveExercise={removeExercise}
            />
          ))}
        </SortableContext>
      </DndContext>
      <button
        onClick={addExercise}
        className="w-full border border-dashed border-border rounded-xl py-2.5 text-sm text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors"
      >
        + 운동 종목 추가
      </button>
    </div>
  );
}

// ── 운동 부위 선택 ────────────────────────────────────────────────────────────
function BodyPartSelector({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (v: string[]) => void;
}) {
  function toggle(part: string) {
    if (selected.includes(part)) {
      onChange(selected.filter((p) => p !== part));
    } else if (selected.length < 3) {
      onChange([...selected, part]);
    }
  }

  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">운동 부위 (최대 3개)</Label>
      <div className="grid grid-cols-3 gap-1.5">
        {BODY_PARTS.map((part) => {
          const active = selected.includes(part);
          const disabled = !active && selected.length >= 3;
          return (
            <button
              key={part}
              onClick={() => toggle(part)}
              disabled={disabled}
              className={`py-2 rounded-xl text-xs font-medium transition-colors border ${
                active
                  ? "bg-primary/20 border-primary text-primary"
                  : disabled
                  ? "border-border text-muted-foreground/40"
                  : "border-border text-muted-foreground hover:border-primary/40"
              }`}
            >
              {part}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── 기록 목록에서 운동 표시 헬퍼 ─────────────────────────────────────────────
function getYoutubeEmbedUrl(url: string): string | null {
  const m = url.match(/(?:(?:www\.|m\.)?youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([^&\n?#]+)/);
  return m ? `https://www.youtube.com/embed/${m[1]}?rel=0` : null;
}

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

function ExerciseRowWithVideo({ ex, i }: { ex: any; i: number }) {
  const [showVideo, setShowVideo] = useState(false);
  const name = ex.name;
  if (!name) return null;

  const setInfo = Array.isArray(ex.sets) ? (
    <>
      <span>{ex.sets.length}세트</span>
      {ex.sets[0]?.reps && <span>× {ex.sets[0].reps}회</span>}
      {ex.sets[0]?.weight && <span>{ex.sets[0].weight}kg</span>}
    </>
  ) : (
    <>
      {ex.sets && <span>{ex.sets}세트</span>}
      {ex.reps && <span>× {ex.reps}회</span>}
      {ex.weight && <span>{ex.weight}kg</span>}
    </>
  );

  return (
    <>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="text-foreground font-medium flex-1">{name}</span>
        {setInfo}
        {ex.videoUrl && (
          <button
            onClick={() => setShowVideo(true)}
            className="text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded-full flex-shrink-0"
          >▶ 운동영상</button>
        )}
      </div>
      {showVideo && <ExerciseVideoModal videoUrl={ex.videoUrl} onClose={() => setShowVideo(false)} />}
    </>
  );
}

// ── 메인 컴포넌트 ─────────────────────────────────────────────────────────────
interface LogFormData {
  logDate: string;
  title: string;
  durationMinutes: string;
  caloriesBurned: string;
  bodyWeight: string;
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
  const [form, setForm] = useState<LogFormData>({
    logDate: today,
    title: "",
    durationMinutes: "",
    caloriesBurned: "",
    bodyWeight: "",
    notes: "",
    conditionScore: null,
    sleepHours: "",
    energyLevel: "",
  });
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [bodyParts, setBodyParts] = useState<string[]>([]);

  const utils = trpc.useUtils();
  const { data: logs, isLoading } = trpc.gymPlus.listWorkoutLogs.useQuery({ month: selectedMonth });

  const createMutation = trpc.gymPlus.createWorkoutLog.useMutation({
    onSuccess: () => {
      utils.gymPlus.listWorkoutLogs.invalidate();
      setShowForm(false);
      resetForm();
      toast.success("운동 기록이 저장되었습니다");
    },
    onError: (err) => toast.error(err.message),
  });

  const updateMutation = trpc.gymPlus.updateWorkoutLog.useMutation({
    onSuccess: () => {
      utils.gymPlus.listWorkoutLogs.invalidate();
      setShowForm(false);
      setEditingId(null);
      resetForm();
      toast.success("운동 기록이 수정되었습니다");
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = trpc.gymPlus.deleteWorkoutLog.useMutation({
    onSuccess: () => {
      utils.gymPlus.listWorkoutLogs.invalidate();
      toast.success("운동 기록이 삭제되었습니다");
    },
    onError: (err) => toast.error(err.message),
  });

  function resetForm() {
    setForm({ logDate: today, title: "", durationMinutes: "", caloriesBurned: "", bodyWeight: "", notes: "", conditionScore: null, sleepHours: "", energyLevel: "" });
    setExercises([]);
    setBodyParts([]);
  }

  function openCreate() {
    resetForm();
    setEditingId(null);
    setShowForm(true);
  }

  function openEdit(log: any) {
    setForm({
      logDate: log.logDate,
      title: log.title ?? "",
      durationMinutes: log.durationMinutes?.toString() ?? "",
      caloriesBurned: log.caloriesBurned?.toString() ?? "",
      bodyWeight: log.bodyWeight ?? "",
      notes: log.notes ?? "",
      conditionScore: log.conditionScore ?? null,
      sleepHours: log.sleepHours ?? "",
      energyLevel: log.energyLevel ?? "",
    });
    try {
      const parsed = log.exercisesJson ? JSON.parse(log.exercisesJson) : [];
      // 구 구조({name,sets,reps,weight}) → 신 구조({name,sets:[{reps,weight}]}) 변환
      const migrated = parsed.map((ex: any) => {
        if (Array.isArray(ex.sets)) return ex as Exercise;
        return {
          name: ex.name ?? "",
          sets: [{ reps: ex.reps ?? "", weight: ex.weight ?? "" }],
        } as Exercise;
      });
      setExercises(migrated);
    } catch {
      setExercises([]);
    }
    try {
      setBodyParts(log.bodyPartsJson ? JSON.parse(log.bodyPartsJson) : []);
    } catch {
      setBodyParts([]);
    }
    setEditingId(log.id);
    setShowForm(true);
  }

  function handleSubmit() {
    const data = {
      logDate: form.logDate,
      title: form.title || undefined,
      durationMinutes: form.durationMinutes ? parseInt(form.durationMinutes) : undefined,
      caloriesBurned: form.caloriesBurned ? parseInt(form.caloriesBurned) : undefined,
      bodyWeight: form.bodyWeight || undefined,
      notes: form.notes || undefined,
      conditionScore: form.conditionScore ?? undefined,
      sleepHours: form.sleepHours || undefined,
      energyLevel: form.energyLevel || undefined,
      exercisesJson: exercises.length > 0 ? JSON.stringify(exercises) : undefined,
      bodyPartsJson: bodyParts.length > 0 ? JSON.stringify(bodyParts) : undefined,
    };
    if (editingId) {
      updateMutation.mutate({ id: editingId, ...data });
    } else {
      createMutation.mutate(data);
    }
  }

  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
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
          <button
            key={m}
            onClick={() => setSelectedMonth(m)}
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
            return (
              <div key={log.id} className="bg-card border border-border rounded-xl p-4 space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">{log.logDate}</p>
                    <p className="font-semibold text-sm">{log.title || "운동 기록"}</p>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(log)} className="text-xs text-muted-foreground px-2 py-1 bg-muted rounded-lg">수정</button>
                    <button
                      onClick={() => { if (confirm("삭제하시겠습니까?")) deleteMutation.mutate({ id: log.id }); }}
                      className="text-xs text-red-400 px-2 py-1 bg-red-500/10 rounded-lg"
                    >
                      삭제
                    </button>
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
                  {log.durationMinutes && <span className="text-[10px] text-muted-foreground">⏱ {log.durationMinutes}분</span>}
                  {log.caloriesBurned && <span className="text-[10px] text-muted-foreground">🔥 {log.caloriesBurned}kcal</span>}
                  {log.bodyWeight && <span className="text-[10px] text-muted-foreground">⚖️ {log.bodyWeight}kg</span>}
                </div>

                {parsedExercises.length > 0 && (
                  <div className="space-y-1">
                    {parsedExercises.filter((e) => e.name).map((ex, i) => (
                      <ExerciseRowWithVideo key={i} ex={ex} i={i} />
                    ))}
                  </div>
                )}

                {log.notes && <p className="text-xs text-muted-foreground border-t border-border pt-2">{log.notes}</p>}
              </div>
            );
          })}
        </div>
      )}

      {/* 기록 폼 다이얼로그 */}
      <Dialog open={showForm} onOpenChange={(o) => { setShowForm(o); if (!o) { setEditingId(null); resetForm(); } }}>
        <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <h2 className="font-bold text-base">{editingId ? "운동 기록 수정" : "운동 기록하기"}</h2>
          </DialogHeader>
          <div className="space-y-4 pb-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">날짜</Label>
              <Input
                type="date"
                value={form.logDate}
                onChange={(e) => setForm((p) => ({ ...p, logDate: e.target.value }))}
                className="bg-input border-border text-sm h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">제목 (선택)</Label>
              <Input
                placeholder="예: 가슴 운동, 하체 데이..."
                value={form.title}
                onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                className="bg-input border-border text-sm h-9"
              />
            </div>

            {/* 컨디션 평가 */}
            <div className="space-y-3">
              <p className="text-sm font-semibold text-primary">컨디션 평가</p>

              {/* 오늘 컨디션 1~5 */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">오늘 컨디션 (1 매우안좋음 → 5 최고)</Label>
                <div className="grid grid-cols-5 gap-1.5">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      onClick={() => setForm((p) => ({ ...p, conditionScore: p.conditionScore === n ? null : n }))}
                      className={`py-3 rounded-xl text-sm font-bold transition-colors border ${
                        form.conditionScore === n
                          ? "bg-primary/20 border-primary text-primary"
                          : "border-border text-muted-foreground"
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              {/* 수면시간 */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">수면시간</Label>
                <div className="grid grid-cols-6 gap-1">
                  {SLEEP_OPTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => setForm((p) => ({ ...p, sleepHours: p.sleepHours === s ? "" : s }))}
                      className={`py-2.5 rounded-xl text-xs font-medium transition-colors border ${
                        form.sleepHours === s
                          ? "bg-primary/20 border-primary text-primary"
                          : "border-border text-muted-foreground"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* 에너지 수준 */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">에너지 수준</Label>
                <div className="grid grid-cols-3 gap-2">
                  {ENERGY_OPTIONS.map((e) => (
                    <button
                      key={e}
                      onClick={() => setForm((p) => ({ ...p, energyLevel: p.energyLevel === e ? "" : e }))}
                      className={`py-3 rounded-xl text-sm font-medium transition-colors border ${
                        form.energyLevel === e
                          ? "bg-primary/20 border-primary text-primary"
                          : "border-border text-muted-foreground"
                      }`}
                    >
                      {e}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* 운동 부위 */}
            <BodyPartSelector selected={bodyParts} onChange={setBodyParts} />

            {/* 운동 종목 */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">운동 종목</Label>
              <ExerciseForm exercises={exercises} setExercises={setExercises} />
            </div>

            {/* 통계 */}
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">운동시간(분)</Label>
                <Input
                  type="number"
                  placeholder="60"
                  value={form.durationMinutes}
                  onChange={(e) => setForm((p) => ({ ...p, durationMinutes: e.target.value }))}
                  className="bg-input border-border text-sm h-8 text-center"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">칼로리(kcal)</Label>
                <Input
                  type="number"
                  placeholder="300"
                  value={form.caloriesBurned}
                  onChange={(e) => setForm((p) => ({ ...p, caloriesBurned: e.target.value }))}
                  className="bg-input border-border text-sm h-8 text-center"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">체중(kg)</Label>
                <Input
                  placeholder="75"
                  value={form.bodyWeight}
                  onChange={(e) => setForm((p) => ({ ...p, bodyWeight: e.target.value }))}
                  className="bg-input border-border text-sm h-8 text-center"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">메모</Label>
              <textarea
                placeholder="오늘 운동 메모를 입력하세요..."
                value={form.notes}
                onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                rows={3}
                className="w-full bg-input border border-border rounded-lg p-2 text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div className="flex gap-2 pt-1">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => { setShowForm(false); setEditingId(null); resetForm(); }}
              >
                취소
              </Button>
              <Button
                className="flex-1"
                onClick={handleSubmit}
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {createMutation.isPending || updateMutation.isPending ? "저장 중..." : "저장"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
