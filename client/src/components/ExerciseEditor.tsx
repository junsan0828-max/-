import { Input } from "@/components/ui/input";
import { Plus, Trash2, Copy } from "lucide-react";

export type ExSet = { reps: string; weight: string };
export type Exercise = { name: string; sets: ExSet[] };

function newSet(prev?: ExSet): ExSet {
  return prev ? { ...prev } : { reps: "", weight: "" };
}

interface Props {
  exercises: Exercise[];
  onChange: (exs: Exercise[]) => void;
}

export default function ExerciseEditor({ exercises, onChange }: Props) {
  const addExercise = () =>
    onChange([...exercises, { name: "", sets: [{ reps: "", weight: "" }] }]);

  const removeExercise = (i: number) =>
    onChange(exercises.filter((_, idx) => idx !== i));

  const updateName = (i: number, name: string) =>
    onChange(exercises.map((ex, idx) => (idx === i ? { ...ex, name } : ex)));

  const addSet = (i: number) =>
    onChange(
      exercises.map((ex, idx) =>
        idx !== i
          ? ex
          : { ...ex, sets: [...ex.sets, newSet(ex.sets[ex.sets.length - 1])] }
      )
    );

  const copySet = (i: number, j: number) =>
    onChange(
      exercises.map((ex, idx) => {
        if (idx !== i) return ex;
        const sets = [...ex.sets];
        sets.splice(j + 1, 0, { ...sets[j] });
        return { ...ex, sets };
      })
    );

  const removeSet = (i: number, j: number) =>
    onChange(
      exercises.map((ex, idx) =>
        idx !== i ? ex : { ...ex, sets: ex.sets.filter((_, k) => k !== j) }
      )
    );

  const updateSet = (i: number, j: number, field: keyof ExSet, value: string) =>
    onChange(
      exercises.map((ex, idx) => {
        if (idx !== i) return ex;
        const sets = ex.sets.map((s, k) =>
          k === j ? { ...s, [field]: value } : s
        );
        return { ...ex, sets };
      })
    );

  return (
    <div className="space-y-2">
      {exercises.map((ex, i) => (
        <div key={i} className="border border-border rounded-lg p-3 space-y-2 bg-accent/10">
          {/* 운동명 행 */}
          <div className="flex items-center gap-2">
            <Input
              placeholder="운동명 (예: 레그프레스)"
              value={ex.name}
              onChange={e => updateName(i, e.target.value)}
              className="h-8 text-sm flex-1"
            />
            <button
              onClick={() => removeExercise(i)}
              className="text-muted-foreground hover:text-red-400 transition-colors shrink-0"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>

          {/* 세트 헤더 */}
          {ex.sets.length > 0 && (
            <div className="grid grid-cols-[28px_1fr_1fr_48px] gap-1 px-0.5">
              <span className="text-[10px] text-muted-foreground text-center">세트</span>
              <span className="text-[10px] text-muted-foreground">횟수</span>
              <span className="text-[10px] text-muted-foreground">무게(kg)</span>
              <span />
            </div>
          )}

          {/* 세트 목록 */}
          <div className="space-y-1">
            {ex.sets.map((s, j) => (
              <div key={j} className="grid grid-cols-[28px_1fr_1fr_48px] gap-1 items-center">
                <span className="text-xs text-muted-foreground text-center font-medium">{j + 1}</span>
                <Input
                  placeholder="횟수"
                  value={s.reps}
                  onChange={e => updateSet(i, j, "reps", e.target.value)}
                  className="h-8 text-xs"
                  type="number"
                  min="0"
                />
                <Input
                  placeholder="kg"
                  value={s.weight}
                  onChange={e => updateSet(i, j, "weight", e.target.value)}
                  className="h-8 text-xs"
                  type="number"
                  min="0"
                  step="0.5"
                />
                <div className="flex gap-0.5 justify-end">
                  <button
                    onClick={() => copySet(i, j)}
                    title="이 세트 복사"
                    className="text-muted-foreground hover:text-primary transition-colors p-1"
                  >
                    <Copy className="h-3 w-3" />
                  </button>
                  <button
                    onClick={() => removeSet(i, j)}
                    className="text-muted-foreground hover:text-red-400 transition-colors p-1"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* 세트 추가 */}
          <button
            onClick={() => addSet(i)}
            className="flex items-center gap-1 text-xs text-primary hover:text-primary/70 transition-colors"
          >
            <Plus className="h-3 w-3" />
            세트 추가
          </button>
        </div>
      ))}

      <button
        onClick={addExercise}
        className="w-full flex items-center justify-center gap-1.5 py-2 border border-dashed border-primary/40 rounded-lg text-sm text-primary hover:bg-primary/5 transition-colors"
      >
        <Plus className="h-4 w-4" />
        운동 종목 추가
      </button>
    </div>
  );
}

/** 구 형식({name,sets,reps,weight}) + 신 형식({name,sets:[]}) 모두 파싱 */
export function parseExercisesJson(json: string | null | undefined): Exercise[] {
  if (!json) return [];
  try {
    const raw: any[] = JSON.parse(json);
    if (!Array.isArray(raw)) return [];
    return raw.map(item => {
      if (Array.isArray(item.sets)) {
        return { name: item.name ?? "", sets: item.sets as ExSet[] };
      }
      // 구 형식 → 세트 1행으로 변환
      return {
        name: item.name ?? "",
        sets: [{ reps: item.reps ?? "", weight: item.weight ?? "" }],
      };
    });
  } catch {
    return [];
  }
}
