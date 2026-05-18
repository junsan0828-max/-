import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader } from "@/components/ui/dialog";

const moodLabel: Record<string, string> = {
  great: "최고 💪",
  good: "좋음 😊",
  normal: "보통 😐",
  tired: "피곤 😴",
};

const moodColor: Record<string, string> = {
  great: "bg-green-500/20 text-green-400 border-green-500/30",
  good: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  normal: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  tired: "bg-red-500/20 text-red-400 border-red-500/30",
};

interface Exercise {
  name: string;
  sets: string;
  reps: string;
  weight: string;
}

function ExerciseForm({ exercises, setExercises }: { exercises: Exercise[]; setExercises: (v: Exercise[]) => void }) {
  const add = () => setExercises([...exercises, { name: "", sets: "", reps: "", weight: "" }]);
  const update = (i: number, field: keyof Exercise, val: string) => {
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
            <button onClick={() => remove(i)} className="text-red-400 text-xs flex-shrink-0">✕</button>
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

interface LogFormData {
  logDate: string; title: string; durationMinutes: string;
  caloriesBurned: string; bodyWeight: string; notes: string; mood: string;
}

export default function FitStepPlusWorkout() {
  const today = new Date().toISOString().slice(0, 10);
  const [selectedMonth, setSelectedMonth] = useState(today.slice(0, 7));
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<LogFormData>({ logDate: today, title: "", durationMinutes: "", caloriesBurned: "", bodyWeight: "", notes: "", mood: "good" });
  const [exercises, setExercises] = useState<Exercise[]>([]);

  const utils = trpc.useUtils();
  const { data: logs, isLoading } = trpc.fitStepPlus.listWorkoutLogs.useQuery({ month: selectedMonth });

  const createMutation = trpc.fitStepPlus.createWorkoutLog.useMutation({
    onSuccess: () => { utils.fitStepPlus.listWorkoutLogs.invalidate(); setShowForm(false); resetForm(); toast.success("운동 기록이 저장되었습니다"); },
    onError: (err) => toast.error(err.message),
  });

  const updateMutation = trpc.fitStepPlus.updateWorkoutLog.useMutation({
    onSuccess: () => { utils.fitStepPlus.listWorkoutLogs.invalidate(); setShowForm(false); setEditingId(null); resetForm(); toast.success("운동 기록이 수정되었습니다"); },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = trpc.fitStepPlus.deleteWorkoutLog.useMutation({
    onSuccess: () => { utils.fitStepPlus.listWorkoutLogs.invalidate(); toast.success("운동 기록이 삭제되었습니다"); },
    onError: (err) => toast.error(err.message),
  });

  function resetForm() {
    setForm({ logDate: today, title: "", durationMinutes: "", caloriesBurned: "", bodyWeight: "", notes: "", mood: "good" });
    setExercises([]);
  }

  function openCreate() { resetForm(); setEditingId(null); setShowForm(true); }

  function openEdit(log: any) {
    setForm({ logDate: log.logDate, title: log.title ?? "", durationMinutes: log.durationMinutes?.toString() ?? "", caloriesBurned: log.caloriesBurned?.toString() ?? "", bodyWeight: log.bodyWeight ?? "", notes: log.notes ?? "", mood: log.mood ?? "good" });
    try { setExercises(log.exercisesJson ? JSON.parse(log.exercisesJson) : []); } catch { setExercises([]); }
    setEditingId(log.id);
    setShowForm(true);
  }

  function handleSubmit() {
    const data = { ...form, durationMinutes: form.durationMinutes ? parseInt(form.durationMinutes) : undefined, caloriesBurned: form.caloriesBurned ? parseInt(form.caloriesBurned) : undefined, exercisesJson: exercises.length > 0 ? JSON.stringify(exercises) : undefined };
    if (editingId) { updateMutation.mutate({ id: editingId, ...data }); }
    else { createMutation.mutate(data); }
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

      <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4">
        {months.map((m) => (
          <button key={m} onClick={() => setSelectedMonth(m)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${selectedMonth === m ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
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
            let parsedExercises: Exercise[] = [];
            try { parsedExercises = log.exercisesJson ? JSON.parse(log.exercisesJson) : []; } catch {}
            return (
              <div key={log.id} className="bg-card border border-border rounded-xl p-4 space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">{log.logDate}</p>
                    <p className="font-semibold text-sm">{log.title || "운동 기록"}</p>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(log)} className="text-xs text-muted-foreground px-2 py-1 bg-muted rounded-lg">수정</button>
                    <button onClick={() => { if (confirm("삭제하시겠습니까?")) deleteMutation.mutate({ id: log.id }); }} className="text-xs text-red-400 px-2 py-1 bg-red-500/10 rounded-lg">삭제</button>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {log.mood && <span className={`text-[10px] px-2 py-0.5 rounded-full border ${moodColor[log.mood] ?? "bg-muted text-muted-foreground"}`}>{moodLabel[log.mood] ?? log.mood}</span>}
                  {log.durationMinutes && <span className="text-[10px] text-muted-foreground">⏱ {log.durationMinutes}분</span>}
                  {log.caloriesBurned && <span className="text-[10px] text-muted-foreground">🔥 {log.caloriesBurned}kcal</span>}
                  {log.bodyWeight && <span className="text-[10px] text-muted-foreground">⚖️ {log.bodyWeight}kg</span>}
                </div>
                {parsedExercises.length > 0 && (
                  <div className="space-y-1">
                    {parsedExercises.filter(e => e.name).map((ex, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="text-foreground font-medium">{ex.name}</span>
                        {ex.sets && <span>{ex.sets}세트</span>}
                        {ex.reps && <span>× {ex.reps}회</span>}
                        {ex.weight && <span>{ex.weight}kg</span>}
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

      <Dialog open={showForm} onOpenChange={(o) => { setShowForm(o); if (!o) { setEditingId(null); resetForm(); } }}>
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
              <ExerciseForm exercises={exercises} setExercises={setExercises} />
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
              <Button variant="outline" className="flex-1" onClick={() => { setShowForm(false); setEditingId(null); resetForm(); }}>취소</Button>
              <Button className="flex-1" onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending}>
                {createMutation.isPending || updateMutation.isPending ? "저장 중..." : "저장"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
