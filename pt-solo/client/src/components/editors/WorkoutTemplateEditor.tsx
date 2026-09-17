import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2 } from "lucide-react";

export default function WorkoutTemplateEditor() {
  const utils = trpc.useUtils();
  const { data: templates } = trpc.workoutTemplates.list.useQuery();
  const createMutation = trpc.workoutTemplates.create.useMutation({
    onSuccess: () => { utils.workoutTemplates.list.invalidate(); setShowForm(false); setForm({ name: "", description: "", bodyPart: "", exercises: "" }); toast.success("템플릿이 저장되었습니다."); },
    onError: e => toast.error(e.message),
  });
  const deleteMutation = trpc.workoutTemplates.delete.useMutation({
    onSuccess: () => utils.workoutTemplates.list.invalidate(),
  });
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", bodyPart: "", exercises: "" });

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">자주 사용하는 운동 루틴을 저장해두고 트레이닝 일지 작성 시 불러올 수 있습니다.</p>
      <button onClick={() => setShowForm(v => !v)} className="flex items-center gap-1.5 text-xs text-primary font-medium">
        <Plus className="h-3.5 w-3.5" />{showForm ? "취소" : "새 템플릿 추가"}
      </button>
      {showForm && (
        <div className="bg-accent/20 border border-border rounded-xl p-4 space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">템플릿 이름 *</Label>
            <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="예: 하체 기본 루틴" className="text-sm h-8" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">운동 부위</Label>
            <Input value={form.bodyPart} onChange={e => setForm(p => ({ ...p, bodyPart: e.target.value }))} placeholder="예: 하체, 코어" className="text-sm h-8" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">운동 종목 (줄바꿈으로 구분)</Label>
            <textarea value={form.exercises} onChange={e => setForm(p => ({ ...p, exercises: e.target.value }))}
              rows={5} placeholder={"스쿼트\n레그프레스\n레그컬\n카프레이즈"}
              className="w-full bg-background border border-border rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-primary" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">메모 (선택)</Label>
            <Input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="루틴 설명" className="text-sm h-8" />
          </div>
          <Button size="sm" className="w-full" disabled={!form.name || createMutation.isPending}
            onClick={() => {
              const exercises = form.exercises.split("\n").map(n => n.trim()).filter(Boolean).map(name => ({ name, sets: [] }));
              createMutation.mutate({ name: form.name, description: form.description || undefined, bodyPart: form.bodyPart || undefined, exercisesJson: exercises.length > 0 ? JSON.stringify(exercises) : undefined });
            }}>
            {createMutation.isPending ? "저장 중..." : "저장"}
          </Button>
        </div>
      )}
      <div className="space-y-2">
        {(templates ?? []).length === 0 && <p className="text-xs text-muted-foreground text-center py-4">저장된 템플릿이 없습니다.</p>}
        {(templates ?? []).map((t: any) => (
          <div key={t.id} className="flex items-start justify-between gap-2 bg-accent/10 border border-border rounded-xl p-3">
            <div>
              <p className="text-sm font-medium">{t.name}</p>
              {t.bodyPart && <p className="text-xs text-muted-foreground mt-0.5">{t.bodyPart}</p>}
              {t.exercisesJson && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {JSON.parse(t.exercisesJson).map((e: any) => e.name).join(" · ")}
                </p>
              )}
            </div>
            <button onClick={() => deleteMutation.mutate({ id: t.id })} className="text-muted-foreground hover:text-red-400 shrink-0">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
