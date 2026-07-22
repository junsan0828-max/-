import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeft, Plus, ChevronUp, ChevronDown, ChevronRight, Save, Send, X, Check, Youtube,
} from "lucide-react";

interface Props {
  versionId: number;
}

type ExerciseForm = { name: string; sets: string; reps: string; videoUrl: string };

const emptyExercise = (): ExerciseForm => ({ name: "", sets: "", reps: "", videoUrl: "" });

import {
  SEQ_CATEGORY_OPTIONS as CATEGORY_OPTIONS,
  SEQ_DIFFICULTY_OPTIONS as DIFFICULTY_OPTIONS,
  SEQ_AUDIENCE_OPTIONS as AUDIENCE_OPTIONS,
  SEQ_STATUS_META as STATUS_META,
} from "@/lib/sequenceLab";

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-foreground/70">{label}</label>
      {children}
      {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function NativeSelect({ value, onChange, options, placeholder }: { value: string; onChange: (v: string) => void; options: string[]; placeholder: string }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
    >
      <option value="">{placeholder}</option>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

export default function SequenceMaker({ versionId }: Props) {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.sequenceLab.getMyVersion.useQuery({ versionId });

  const [form, setForm] = useState({
    title: "", shortDescription: "", publicDescription: "", category: "", bodyParts: "",
    movementType: "", targetAudience: "", difficulty: "", estimatedMinutes: "", equipment: "", tags: "",
    classGoal: "", coachingNotes: "", authorMemo: "",
  });
  const [exercises, setExercises] = useState<ExerciseForm[]>([]);
  const [openExercise, setOpenExercise] = useState<number | null>(null);
  const [dirty, setDirty] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const hydrated = useRef(false);

  useEffect(() => {
    if (!data || hydrated.current) return;
    hydrated.current = true;
    const v = data.version;
    setForm({
      title: v.title ?? "", shortDescription: v.shortDescription ?? "", publicDescription: v.publicDescription ?? "",
      category: v.category ?? "", bodyParts: v.bodyParts ?? "", movementType: v.movementType ?? "",
      targetAudience: v.targetAudience ?? "", difficulty: v.difficulty ?? "",
      estimatedMinutes: v.estimatedMinutes != null ? String(v.estimatedMinutes) : "",
      equipment: v.equipment ?? "", tags: v.tags ?? "", classGoal: v.classGoal ?? "",
      coachingNotes: v.coachingNotes ?? "", authorMemo: v.authorMemo ?? "",
    });
    setExercises(
      data.sections.flatMap((s: any) =>
        s.exercises.map((ex: any) => ({
          name: ex.name ?? "", sets: ex.sets ?? "", reps: ex.reps ?? "", videoUrl: ex.videoUrl ?? "",
        }))
      )
    );
  }, [data]);

  const status: string = data?.version?.status ?? "DRAFT";
  const editable = status === "DRAFT" || status === "CHANGES_REQUESTED";
  const isImportedCopy = !!data?.sequence?.sourceSequenceId;

  // 저장 후 재조회는 불필요 — 로컬 폼이 원본이고 상태 변화는 submit/withdraw에서만 발생
  const updateDraft = trpc.sequenceLab.updateDraft.useMutation({
    onSuccess: () => { setDirty(false); setSavedAt(new Date()); },
    onError: (e) => toast.error(e.message),
  });
  const submitForReview = trpc.sequenceLab.submitForReview.useMutation({
    onSuccess: () => { toast.success("등록 검토를 신청했습니다."); utils.sequenceLab.getMyVersion.invalidate({ versionId }); },
    onError: (e) => toast.error(e.message),
  });
  const withdrawSubmission = trpc.sequenceLab.withdrawSubmission.useMutation({
    onSuccess: () => { toast.success("검토 신청을 철회했습니다."); utils.sequenceLab.getMyVersion.invalidate({ versionId }); },
    onError: (e) => toast.error(e.message),
  });

  function setF<K extends keyof typeof form>(k: K, v: string) { setForm(f => ({ ...f, [k]: v })); setDirty(true); }

  function doSave(showToast = true, onSaved?: () => void) {
    updateDraft.mutate(
      {
        versionId,
        title: form.title, shortDescription: form.shortDescription || undefined, publicDescription: form.publicDescription || undefined,
        category: form.category || undefined, bodyParts: form.bodyParts || undefined, movementType: form.movementType || undefined,
        targetAudience: form.targetAudience || undefined, difficulty: form.difficulty || undefined,
        estimatedMinutes: form.estimatedMinutes ? parseInt(form.estimatedMinutes) : undefined,
        equipment: form.equipment || undefined, tags: form.tags || undefined, classGoal: form.classGoal || undefined,
        coachingNotes: form.coachingNotes || undefined, authorMemo: form.authorMemo || undefined,
        sections: [{ name: "운동 목록", exercises }],
      },
      { onSuccess: () => { if (showToast) toast.success("임시저장했습니다."); onSaved?.(); } }
    );
  }

  // 운동 조작
  function addExercise() { setExercises(ex => [...ex, emptyExercise()]); setDirty(true); }
  function removeExercise(exIdx: number) { setExercises(ex => ex.filter((_, i) => i !== exIdx)); setDirty(true); }
  function moveExercise(exIdx: number, dir: -1 | 1) {
    setExercises(ex => {
      const j = exIdx + dir;
      if (j < 0 || j >= ex.length) return ex;
      const next = [...ex];
      [next[exIdx], next[j]] = [next[j], next[exIdx]];
      return next;
    });
    setDirty(true);
  }
  function updateExercise(exIdx: number, field: keyof ExerciseForm, value: string) {
    setExercises(ex => ex.map((e, i) => i === exIdx ? { ...e, [field]: value } : e));
    setDirty(true);
  }

  if (isLoading || !data) {
    return <div className="py-20 text-center text-sm text-muted-foreground">불러오는 중...</div>;
  }

  return (
    <div className="space-y-4 pb-24">
      {/* 헤더 */}
      <div className="flex items-center gap-3">
        <button onClick={() => setLocation("/sequences/mine")} className="text-muted-foreground hover:text-foreground transition-colors shrink-0">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-bold truncate">{isImportedCopy ? "가져온 시퀀스 수정" : "시퀀스 메이커"}</h1>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_META[status]?.cls ?? ""}`}>{STATUS_META[status]?.label ?? status}</span>
            {savedAt ? (
              <span className="text-[10px] text-emerald-600 flex items-center gap-0.5"><Check className="h-3 w-3" />방금 저장됨</span>
            ) : dirty ? (
              <span className="text-[10px] text-amber-600">저장 안 된 변경사항 있음</span>
            ) : null}
          </div>
        </div>
      </div>

      {isImportedCopy && (
        <div className="rounded-xl bg-accent/40 border border-border px-3.5 py-2.5 text-xs text-muted-foreground">
          이 시퀀스는 다른 트레이너의 시퀀스를 가져온 복사본입니다. 자유롭게 수정해 사용할 수 있지만, 라이브러리에는 등록할 수 없습니다.
        </div>
      )}

      {status === "CHANGES_REQUESTED" && data.reviews?.[0] && (
        <div className="rounded-xl bg-amber-500/8 border border-amber-500/25 px-3.5 py-3 space-y-1">
          <p className="text-xs font-bold text-amber-700">전문가 리뷰 — 수정 요청</p>
          <p className="text-xs text-foreground/80 whitespace-pre-wrap">{data.reviews[0].feedback || "구체적인 피드백이 없습니다."}</p>
        </div>
      )}

      {status === "REJECTED" && data.reviews?.[0] && (
        <div className="rounded-xl bg-red-500/8 border border-red-500/25 px-3.5 py-3 space-y-1">
          <p className="text-xs font-bold text-red-600">전문가 리뷰 — 등록 거절</p>
          <p className="text-xs text-foreground/80 whitespace-pre-wrap">{data.reviews[0].feedback || "구체적인 사유가 없습니다."}</p>
        </div>
      )}

      {status === "SUBMITTED" && (
        <div className="rounded-xl bg-blue-500/8 border border-blue-500/25 px-3.5 py-3 flex items-center justify-between">
          <p className="text-xs text-blue-700">등록 검토 신청됨 — 검토가 끝나면 알려드려요.</p>
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => withdrawSubmission.mutate({ versionId })} disabled={withdrawSubmission.isPending}>
            신청 철회
          </Button>
        </div>
      )}

      <fieldset disabled={!editable} className={!editable ? "opacity-70 pointer-events-none" : ""}>
        {/* 기본정보 */}
        <div className="rounded-2xl bg-card border border-border p-4 space-y-3">
          <p className="text-sm font-bold">기본정보</p>
          <Field label="시퀀스 제목 *">
            <Input value={form.title} onChange={e => setF("title", e.target.value)} placeholder="예: 초보자를 위한 하체 기능 개선 시퀀스" />
          </Field>
          <Field label="한 줄 설명">
            <Input value={form.shortDescription} onChange={e => setF("shortDescription", e.target.value)} placeholder="목록에 표시될 짧은 소개" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="운동 분야"><NativeSelect value={form.category} onChange={v => setF("category", v)} options={CATEGORY_OPTIONS} placeholder="선택" /></Field>
            <Field label="대상"><NativeSelect value={form.targetAudience} onChange={v => setF("targetAudience", v)} options={AUDIENCE_OPTIONS} placeholder="선택" /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="난이도"><NativeSelect value={form.difficulty} onChange={v => setF("difficulty", v)} options={DIFFICULTY_OPTIONS} placeholder="선택" /></Field>
            <Field label="예상 수업시간(분)"><Input type="number" min="0" value={form.estimatedMinutes} onChange={e => setF("estimatedMinutes", e.target.value)} placeholder="45" /></Field>
          </div>
          <Field label="신체 부위 및 움직임 분류">
            <Input value={form.bodyParts} onChange={e => setF("bodyParts", e.target.value)} placeholder="예: 하체, 코어, 스쿼트 패턴" />
          </Field>
          <Field label="필요 기구">
            <Input value={form.equipment} onChange={e => setF("equipment", e.target.value)} placeholder="예: 폼롤러, 밴드, 덤벨" />
          </Field>
          <Field label="태그" hint="쉼표로 구분">
            <Input value={form.tags} onChange={e => setF("tags", e.target.value)} placeholder="예: 초보자, 하체, 재활" />
          </Field>
          <Field label="공개용 대표 설명" hint="라이브러리 상세페이지에 공개되는 설명입니다.">
            <Textarea rows={3} value={form.publicDescription} onChange={e => setF("publicDescription", e.target.value)} />
          </Field>
        </div>

        {/* 수업 설계 */}
        <div className="rounded-2xl bg-card border border-border p-4 space-y-3 mt-4">
          <p className="text-sm font-bold">수업 설계</p>
          <Field label="수업 목표"><Textarea rows={2} value={form.classGoal} onChange={e => setF("classGoal", e.target.value)} /></Field>
          <Field label="주의사항 및 코칭 포인트"><Textarea rows={3} value={form.coachingNotes} onChange={e => setF("coachingNotes", e.target.value)} /></Field>
          <Field label="작성자 메모" hint="검토자에게만 보이는 내부 메모"><Textarea rows={2} value={form.authorMemo} onChange={e => setF("authorMemo", e.target.value)} /></Field>
        </div>

        {/* 운동 항목 */}
        <div className="rounded-2xl bg-card border border-border p-4 space-y-2 mt-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold">운동 항목</p>
            <span className="text-[10px] text-muted-foreground">운동 {exercises.length}개</span>
          </div>

          {exercises.map((ex, ei) => {
            const expanded = openExercise === ei;
            return (
              <div key={ei} className="rounded-xl border border-border overflow-hidden bg-background">
                <div className="flex items-center gap-1.5 px-3 py-2.5">
                  <button onClick={() => setOpenExercise(expanded ? null : ei)} className="shrink-0">
                    <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${expanded ? "rotate-90" : ""}`} />
                  </button>
                  <Input
                    value={ex.name}
                    onChange={e => updateExercise(ei, "name", e.target.value)}
                    placeholder="운동명"
                    className="h-9 text-sm flex-1"
                  />
                  {ex.videoUrl && <Youtube className="h-4 w-4 text-red-500 shrink-0" />}
                  <div className="flex items-center gap-0.5 shrink-0">
                    <button onClick={() => moveExercise(ei, -1)} disabled={ei === 0} className="p-1.5 text-muted-foreground hover:text-foreground disabled:opacity-30"><ChevronUp className="h-3.5 w-3.5" /></button>
                    <button onClick={() => moveExercise(ei, 1)} disabled={ei === exercises.length - 1} className="p-1.5 text-muted-foreground hover:text-foreground disabled:opacity-30"><ChevronDown className="h-3.5 w-3.5" /></button>
                    <button onClick={() => removeExercise(ei)} className="p-1.5 text-muted-foreground hover:text-red-500"><X className="h-3.5 w-3.5" /></button>
                  </div>
                </div>
                {expanded && (
                  <div className="px-3 pb-3 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        value={ex.sets}
                        onChange={e => updateExercise(ei, "sets", e.target.value)}
                        placeholder="세트 (예: 3)"
                        className="h-9 text-xs"
                      />
                      <Input
                        value={ex.reps}
                        onChange={e => updateExercise(ei, "reps", e.target.value)}
                        placeholder="횟수 (예: 12)"
                        className="h-9 text-xs"
                      />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Youtube className="h-4 w-4 text-red-500 shrink-0" />
                      <Input
                        value={ex.videoUrl}
                        onChange={e => updateExercise(ei, "videoUrl", e.target.value)}
                        placeholder="유튜브 링크 (https://youtube.com/watch?v=...)"
                        className="h-9 text-xs flex-1"
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          <button onClick={addExercise} className="w-full flex items-center justify-center gap-1.5 py-2.5 border border-dashed border-primary/40 rounded-xl text-sm text-primary hover:bg-primary/5 transition-colors">
            <Plus className="h-4 w-4" />운동 항목 추가
          </button>
        </div>
      </fieldset>

      {/* 하단 고정 액션바 */}
      {editable && (
        <div className="fixed bottom-16 left-0 right-0 px-4 py-3 bg-background/95 backdrop-blur border-t border-border flex gap-2 max-w-lg mx-auto z-40">
          <Button variant="outline" className="flex-1" onClick={() => doSave(true)} disabled={updateDraft.isPending}>
            <Save className="h-4 w-4 mr-1.5" />임시저장
          </Button>
          <Button className="flex-1"
            onClick={() => doSave(false, () => submitForReview.mutate({ versionId }))}
            disabled={updateDraft.isPending || submitForReview.isPending || isImportedCopy || !form.title.trim()}>
            <Send className="h-4 w-4 mr-1.5" />등록 검토 신청
          </Button>
        </div>
      )}
    </div>
  );
}
