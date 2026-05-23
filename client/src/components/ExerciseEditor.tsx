import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, Copy, GripVertical, Youtube, X } from "lucide-react";

export type ExSet = { reps: string; weight: string };
export type Exercise = { name: string; sets: ExSet[]; videoUrl?: string };

function newSet(prev?: ExSet): ExSet {
  return prev ? { ...prev } : { reps: "", weight: "" };
}

interface Props {
  exercises: Exercise[];
  onChange: (exs: Exercise[]) => void;
  suggestions?: string[];
  simpleMode?: boolean; // 종목명만 입력 (일지 초안용)
}

export default function ExerciseEditor({ exercises, onChange, suggestions = [], simpleMode = false }: Props) {
  const [focusedExIdx, setFocusedExIdx] = useState<number | null>(null);
  const [videoOpenIdx, setVideoOpenIdx] = useState<number | null>(null);

  const addExercise = () =>
    onChange([...exercises, { name: "", sets: simpleMode ? [] : [{ reps: "", weight: "" }] }]);

  const removeExercise = (i: number) => {
    onChange(exercises.filter((_, idx) => idx !== i));
    if (videoOpenIdx === i) setVideoOpenIdx(null);
  };

  const updateName = (i: number, name: string) =>
    onChange(exercises.map((ex, idx) => (idx === i ? { ...ex, name } : ex)));

  const updateVideoUrl = (i: number, videoUrl: string) =>
    onChange(exercises.map((ex, idx) => (idx === i ? { ...ex, videoUrl } : ex)));

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

  const getFilteredSuggestions = (name: string) => {
    if (!name.trim()) return [];
    const q = name.toLowerCase();
    return suggestions.filter(
      (s) => s.toLowerCase().startsWith(q) && s.toLowerCase() !== q
    );
  };

  return (
    <div className="space-y-2">
      {exercises.map((ex, i) => {
        const filtered = getFilteredSuggestions(ex.name);
        const showSuggestions = focusedExIdx === i && filtered.length > 0;
        const hasVideo = !!ex.videoUrl;
        const videoOpen = videoOpenIdx === i;

        return (
          <div key={i} className={`border border-border rounded-lg bg-accent/10 ${simpleMode ? "px-3 py-2 space-y-2" : "p-3 space-y-2"}`}>
            {simpleMode ? (
              /* ── 단순 모드: 종목명 + 영상 링크 ── */
              <>
                <div className="flex items-center gap-2">
                  <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="relative flex-1">
                    <Input
                      placeholder="운동명 (예: 스쿼트)"
                      value={ex.name}
                      onChange={e => updateName(i, e.target.value)}
                      onFocus={() => setFocusedExIdx(i)}
                      onBlur={() => setTimeout(() => setFocusedExIdx(null), 150)}
                      className="h-9 text-sm w-full border-0 bg-transparent p-0 focus-visible:ring-0 shadow-none"
                    />
                    {showSuggestions && (
                      <div className="absolute left-0 top-full mt-0.5 w-full bg-popover border border-border rounded-lg shadow-lg z-50 overflow-hidden">
                        {filtered.slice(0, 7).map((s) => (
                          <button
                            key={s}
                            onMouseDown={(e) => { e.preventDefault(); updateName(i, s); setFocusedExIdx(null); }}
                            className="w-full text-left px-3 py-1.5 text-sm hover:bg-accent transition-colors truncate"
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {/* 영상 링크 버튼 */}
                  <button
                    type="button"
                    onClick={() => setVideoOpenIdx(videoOpen ? null : i)}
                    className={`shrink-0 transition-colors ${
                      hasVideo
                        ? "text-red-400 hover:text-red-500"
                        : "text-muted-foreground hover:text-red-400"
                    }`}
                    title="운동 영상 링크"
                  >
                    <Youtube className="h-4 w-4" />
                  </button>
                  <button onClick={() => removeExercise(i)} className="text-muted-foreground hover:text-red-400 transition-colors shrink-0">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                {/* 영상 URL 입력 */}
                {videoOpen && (
                  <div className="flex items-center gap-2 pl-6">
                    <Input
                      placeholder="유튜브 링크 입력..."
                      value={ex.videoUrl ?? ""}
                      onChange={e => updateVideoUrl(i, e.target.value)}
                      className="h-8 text-xs flex-1"
                    />
                    {ex.videoUrl && (
                      <button
                        type="button"
                        onClick={() => updateVideoUrl(i, "")}
                        className="text-muted-foreground hover:text-red-400 shrink-0"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                )}
              </>
            ) : (
              /* ── 세트 모드: 기존 방식 ── */
              <>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Input
                      placeholder="운동명 (예: 레그프레스)"
                      value={ex.name}
                      onChange={e => updateName(i, e.target.value)}
                      onFocus={() => setFocusedExIdx(i)}
                      onBlur={() => setTimeout(() => setFocusedExIdx(null), 150)}
                      className="h-8 text-sm w-full"
                    />
                    {showSuggestions && (
                      <div className="absolute left-0 top-full mt-0.5 w-full bg-popover border border-border rounded-lg shadow-lg z-50 overflow-hidden">
                        {filtered.slice(0, 7).map((s) => (
                          <button
                            key={s}
                            onMouseDown={(e) => { e.preventDefault(); updateName(i, s); setFocusedExIdx(null); }}
                            className="w-full text-left px-3 py-1.5 text-sm hover:bg-accent transition-colors truncate"
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {/* 영상 링크 버튼 */}
                  <button
                    type="button"
                    onClick={() => setVideoOpenIdx(videoOpen ? null : i)}
                    className={`shrink-0 transition-colors ${
                      hasVideo
                        ? "text-red-400 hover:text-red-500"
                        : "text-muted-foreground hover:text-red-400"
                    }`}
                    title="운동 영상 링크"
                  >
                    <Youtube className="h-4 w-4" />
                  </button>
                  <button onClick={() => removeExercise(i)} className="text-muted-foreground hover:text-red-400 transition-colors shrink-0">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                {/* 영상 URL 입력 (세트 모드) */}
                {videoOpen && (
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder="유튜브 링크 입력..."
                      value={ex.videoUrl ?? ""}
                      onChange={e => updateVideoUrl(i, e.target.value)}
                      className="h-8 text-xs flex-1"
                    />
                    {ex.videoUrl && (
                      <button
                        type="button"
                        onClick={() => updateVideoUrl(i, "")}
                        className="text-muted-foreground hover:text-red-400 shrink-0"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                )}

                {ex.sets.length > 0 && (
                  <div className="grid grid-cols-[28px_1fr_1fr_48px] gap-1 px-0.5">
                    <span className="text-[10px] text-muted-foreground text-center">세트</span>
                    <span className="text-[10px] text-muted-foreground">횟수</span>
                    <span className="text-[10px] text-muted-foreground">무게(kg)</span>
                    <span />
                  </div>
                )}

                <div className="space-y-1">
                  {ex.sets.map((s, j) => (
                    <div key={j} className="grid grid-cols-[28px_1fr_1fr_48px] gap-1 items-center">
                      <span className="text-xs text-muted-foreground text-center font-medium">{j + 1}</span>
                      <Input placeholder="횟수" value={s.reps} onChange={e => updateSet(i, j, "reps", e.target.value)} className="h-8 text-xs" type="number" min="0" />
                      <Input placeholder="kg" value={s.weight} onChange={e => updateSet(i, j, "weight", e.target.value)} className="h-8 text-xs" type="number" min="0" step="0.5" />
                      <div className="flex gap-0.5 justify-end">
                        <button onClick={() => copySet(i, j)} title="이 세트 복사" className="text-muted-foreground hover:text-primary transition-colors p-1">
                          <Copy className="h-3 w-3" />
                        </button>
                        <button onClick={() => removeSet(i, j)} className="text-muted-foreground hover:text-red-400 transition-colors p-1">
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <button onClick={() => addSet(i)} className="flex items-center gap-1 text-xs text-primary hover:text-primary/70 transition-colors">
                  <Plus className="h-3 w-3" />
                  세트 추가
                </button>
              </>
            )}
          </div>
        );
      })}

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

/** 구 형식({name,sets,reps,weight}) + 신 형식({name,sets:[], videoUrl}) 모두 파싱 */
export function parseExercisesJson(json: string | null | undefined): Exercise[] {
  if (!json) return [];
  try {
    const raw: any[] = JSON.parse(json);
    if (!Array.isArray(raw)) return [];
    return raw.map(item => {
      if (Array.isArray(item.sets)) {
        return { name: item.name ?? "", sets: item.sets as ExSet[], videoUrl: item.videoUrl ?? undefined };
      }
      return {
        name: item.name ?? "",
        sets: [{ reps: item.reps ?? "", weight: item.weight ?? "" }],
        videoUrl: item.videoUrl ?? undefined,
      };
    });
  } catch {
    return [];
  }
}
