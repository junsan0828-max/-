import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Plus, ChevronDown, ChevronUp, Trash2, X, LayoutTemplate,
  PlusCircle, ChevronsDown, Send, Save, Dumbbell, Video,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import BodyPartPicker from "@/components/BodyPartPicker";
import ExerciseEditor, { type Exercise, parseExercisesJson } from "@/components/ExerciseEditor";

// 한글 초성 추출
const CHOSUNG_LIST = ['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
const CHOSUNG_DISPLAY = ['ㄱ','ㄴ','ㄷ','ㄹ','ㅁ','ㅂ','ㅅ','ㅇ','ㅈ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
const CHOSUNG_GROUP: Record<string, string[]> = {
  ㄱ: ['ㄱ','ㄲ'], ㄴ: ['ㄴ'], ㄷ: ['ㄷ','ㄸ'], ㄹ: ['ㄹ'],
  ㅁ: ['ㅁ'], ㅂ: ['ㅂ','ㅃ'], ㅅ: ['ㅅ','ㅆ'], ㅇ: ['ㅇ'],
  ㅈ: ['ㅈ','ㅉ'], ㅊ: ['ㅊ'], ㅋ: ['ㅋ'], ㅌ: ['ㅌ'], ㅍ: ['ㅍ'], ㅎ: ['ㅎ'],
};

function getChosung(name: string): string {
  const code = name.charCodeAt(0);
  if (code >= 0xAC00 && code <= 0xD7A3) return CHOSUNG_LIST[Math.floor((code - 0xAC00) / 28 / 21)];
  return name.charAt(0).toUpperCase();
}

function TemplateLoader({ onLoad }: { onLoad: (exs: Exercise[]) => void }) {
  const { data: templates } = trpc.workoutTemplates.list.useQuery();
  const [open, setOpen] = useState(false);
  if (!templates || templates.length === 0) return null;
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 text-xs text-primary mb-1"
      >
        <LayoutTemplate className="h-3.5 w-3.5" />
        템플릿 불러오기
      </button>
      {open && (
        <div className="absolute z-10 top-6 left-0 w-56 bg-card border border-border rounded-xl shadow-lg overflow-hidden">
          {templates.map((t: any) => (
            <button
              key={t.id}
              className="w-full text-left px-3 py-2.5 text-xs hover:bg-accent/30 transition-colors border-b border-border last:border-0"
              onClick={() => {
                const exs: Exercise[] = t.exercisesJson ? JSON.parse(t.exercisesJson) : [];
                onLoad(exs);
                setOpen(false);
                toast.success(`${t.name} 템플릿 적용됨`);
              }}
            >
              <p className="font-medium">{t.name}</p>
              {t.bodyPart && <p className="text-muted-foreground mt-0.5">{t.bodyPart}</p>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

type JournalForm = {
  sessionDate: string;
  datePending: boolean;
  bodyPart: string;
  exercises: Exercise[];
  notes: string;
  goal: string;
  feedback: string;
};

const emptyForm = (): JournalForm => ({
  sessionDate: new Date().toISOString().split("T")[0],
  datePending: false,
  bodyPart: "",
  exercises: [],
  notes: "",
  goal: "",
  feedback: "",
});

export default function Sessions() {
  const utils = trpc.useUtils();
  const { data: allMembers } = trpc.members.list.useQuery();
  const [chosungFilter, setChosungFilter] = useState<string>("전체");
  const [selectedMemberId, setSelectedMemberId] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // 작성 모달
  const [journalOpen, setJournalOpen] = useState(false);
  const [journalForm, setJournalForm] = useState<JournalForm>(emptyForm());

  // 라이브 트레이닝 모달
  const [liveOpen, setLiveOpen] = useState(false);
  const [liveLogId, setLiveLogId] = useState(0);
  const [liveDate, setLiveDate] = useState("");
  const [liveExercises, setLiveExercises] = useState<Exercise[]>([]);
  const [liveMemberId, setLiveMemberId] = useState<number | null>(null);
  const [liveVideoOpenIdx, setLiveVideoOpenIdx] = useState<number | null>(null);

  const selectedMember = allMembers?.find(m => m.id === selectedMemberId);

  const { data: packages } = trpc.pt.listByMember.useQuery(
    { memberId: selectedMemberId! },
    { enabled: !!selectedMemberId }
  );
  const activePackage = packages?.find(p => p.status === "active") ?? packages?.[0];

  const { data: logs } = trpc.trainingLog.listAll.useQuery(
    selectedMemberId ? { memberId: selectedMemberId } : undefined,
    { enabled: true }
  );

  const { data: fspCheck } = trpc.fitStepPlus.trainer_checkMemberFSP.useQuery(
    { memberId: liveMemberId! },
    { enabled: !!liveMemberId }
  );
  const canSendToMember = fspCheck?.registered ?? false;

  const sendSessionMutation = trpc.fitStepPlus.trainer_sendSessionToMember.useMutation({
    onSuccess: () => {
      toast.success("회원 FIT STEP+에 전송되었습니다");
      setLiveOpen(false);
      utils.trainingLog.listAll.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const createMutation = trpc.pt.createLog.useMutation({
    onSuccess: () => {
      toast.success("트레이닝 일지가 저장되었습니다");
      utils.trainingLog.listAll.invalidate();
      setJournalOpen(false);
      setJournalForm(emptyForm());
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = trpc.pt.deleteLog.useMutation({
    onSuccess: () => {
      toast.success("삭제되었습니다");
      utils.trainingLog.listAll.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const liveSaveMutation = trpc.pt.updateLog.useMutation({
    onSuccess: () => {
      utils.trainingLog.listAll.invalidate();
      setLiveOpen(false);
    },
    onError: (e) => toast.error(e.message),
  });

  const sortedMembers = [...(allMembers ?? [])].sort((a, b) => a.name.localeCompare(b.name, "ko"));

  const filteredMembers = sortedMembers.filter(m => {
    if (chosungFilter === "전체") return true;
    const cs = getChosung(m.name);
    return (CHOSUNG_GROUP[chosungFilter] ?? [chosungFilter]).includes(cs);
  });

  // 현재 회원 목록에 존재하는 초성만 표시
  const existingChosung = new Set(sortedMembers.map(m => {
    const cs = getChosung(m.name);
    return CHOSUNG_DISPLAY.find(d => (CHOSUNG_GROUP[d] ?? [d]).includes(cs));
  }).filter(Boolean));

  function openCreate() {
    setJournalForm(emptyForm());
    setJournalOpen(true);
  }

  function submitCreate() {
    if (!selectedMemberId) return toast.error("회원을 선택해주세요");
    createMutation.mutate({
      memberId: selectedMemberId,
      sessionDate: journalForm.sessionDate,
      goal: journalForm.goal || undefined,
      bodyPart: journalForm.bodyPart || undefined,
      exercisesJson: journalForm.exercises.length > 0 ? JSON.stringify(journalForm.exercises) : undefined,
      feedback: journalForm.feedback || undefined,
      notes: journalForm.notes || undefined,
    });
  }

  function openLive(log: any) {
    setLiveLogId(log.id);
    setLiveDate(log.sessionDate);
    setLiveExercises(parseExercisesJson(log.exercisesJson));
    setLiveMemberId(selectedMemberId ?? null);
    setLiveOpen(true);
  }

  function addLiveSet(exIdx: number) {
    setLiveExercises(prev => prev.map((ex, i) => {
      if (i !== exIdx) return ex;
      const last = ex.sets[ex.sets.length - 1];
      return { ...ex, sets: [...ex.sets, last ? { ...last } : { reps: "", weight: "" }] };
    }));
  }

  function updateLiveSet(exIdx: number, setIdx: number, field: "reps" | "weight", value: string) {
    setLiveExercises(prev => prev.map((ex, i) => {
      if (i !== exIdx) return ex;
      return { ...ex, sets: ex.sets.map((s, j) => j !== setIdx ? s : { ...s, [field]: value }) };
    }));
  }

  function removeLiveSet(exIdx: number, setIdx: number) {
    setLiveExercises(prev => prev.map((ex, i) => {
      if (i !== exIdx) return ex;
      return { ...ex, sets: ex.sets.filter((_, j) => j !== setIdx) };
    }));
  }

  function insertLiveExercise(afterIdx: number) {
    setLiveExercises(prev => {
      const next = [...prev];
      next.splice(afterIdx + 1, 0, { name: "", sets: [{ reps: "", weight: "" }] });
      return next;
    });
  }

  function addLiveExercise() {
    setLiveExercises(prev => [...prev, { name: "", sets: [{ reps: "", weight: "" }] }]);
  }

  function updateLiveExerciseName(idx: number, name: string) {
    setLiveExercises(prev => prev.map((ex, i) => i !== idx ? ex : { ...ex, name }));
  }

  function updateLiveVideoUrl(idx: number, videoUrl: string) {
    setLiveExercises(prev => prev.map((ex, i) => i !== idx ? ex : { ...ex, videoUrl: videoUrl || undefined }));
  }

  function removeLiveExercise(idx: number) {
    setLiveExercises(prev => prev.filter((_, i) => i !== idx));
    if (liveVideoOpenIdx === idx) setLiveVideoOpenIdx(null);
  }

  function saveLive() {
    liveSaveMutation.mutate({
      id: liveLogId,
      exercisesJson: liveExercises.length > 0 ? JSON.stringify(liveExercises) : undefined,
    });
    toast.success("저장되었습니다");
  }

  function sendToMember() {
    liveSaveMutation.mutate(
      { id: liveLogId, exercisesJson: liveExercises.length > 0 ? JSON.stringify(liveExercises) : undefined },
      { onSuccess: () => sendSessionMutation.mutate({ sessionLogId: liveLogId }) }
    );
  }


  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">수업 관리</h1>

      {/* 회원 선택 */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-muted-foreground">회원 선택</p>
          {selectedMember && (
            <button onClick={() => setSelectedMemberId(null)} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
              <X className="h-3 w-3" />선택 해제
            </button>
          )}
        </div>

        {/* 초성 필터 - 회원 수 표시 */}
        <div className="flex gap-1.5 flex-wrap">
          {[
            { label: "전체", count: sortedMembers.length },
            ...CHOSUNG_DISPLAY
              .filter(c => existingChosung.has(c))
              .map(c => ({
                label: c,
                count: sortedMembers.filter(m => (CHOSUNG_GROUP[c] ?? [c]).includes(getChosung(m.name))).length,
              }))
          ].map(({ label, count }) => (
            <button
              key={label}
              onClick={() => setChosungFilter(label)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                chosungFilter === label
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border text-muted-foreground hover:border-primary/40"
              }`}
            >
              {label}
              <span className={`text-[10px] font-bold ${chosungFilter === label ? "text-primary-foreground/80" : "text-muted-foreground/60"}`}>
                {count}
              </span>
            </button>
          ))}
        </div>

        {/* 회원 칩 목록 - 4열 컴팩트 */}
        {!allMembers || allMembers.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">등록된 회원이 없습니다.</p>
        ) : filteredMembers.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">해당 초성의 회원이 없습니다.</p>
        ) : (
          <div className="grid grid-cols-4 gap-1.5">
            {filteredMembers.map(m => {
              const isSelected = m.id === selectedMemberId;
              return (
                <button
                  key={m.id}
                  onClick={() => setSelectedMemberId(isSelected ? null : m.id)}
                  className={`flex flex-col items-center gap-1 py-2.5 rounded-xl border transition-colors ${
                    isSelected
                      ? "bg-primary/15 border-primary"
                      : "bg-card border-border hover:border-primary/40"
                  }`}
                >
                  <div className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold ${
                    isSelected ? "bg-primary text-primary-foreground" : "bg-accent/60 text-foreground"
                  }`}>
                    {m.name.charAt(0)}
                  </div>
                  <span className={`text-[11px] font-medium truncate w-full text-center px-0.5 ${isSelected ? "text-primary" : "text-foreground"}`}>
                    {m.name}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* 선택된 회원 패키지 정보 */}
        {selectedMember && (
          <div className="bg-primary/10 border border-primary/20 rounded-xl px-4 py-3 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-semibold text-primary">{selectedMember.name}</span>
                <span className="text-xs text-muted-foreground ml-2">{selectedMember.phone}</span>
              </div>
              <button onClick={() => setSelectedMemberId(null)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            {activePackage && (
              <div className="flex items-center gap-3 pt-1 border-t border-primary/15 flex-wrap">
                <span className="text-xs font-medium text-foreground">{activePackage.packageName || "PT"}</span>
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="bg-background rounded-full px-2 py-0.5 border border-border font-medium">총 {activePackage.totalSessions}회</span>
                  <span className="text-muted-foreground/50">·</span>
                  <span className="bg-background rounded-full px-2 py-0.5 border border-border font-medium">사용 {activePackage.usedSessions}회</span>
                  <span className="text-muted-foreground/50">·</span>
                  <span className="bg-primary/20 text-primary rounded-full px-2 py-0.5 border border-primary/30 font-semibold">
                    잔여 {(activePackage.totalSessions ?? 0) - (activePackage.usedSessions ?? 0)}회
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 새 일지 작성 버튼 */}
      <Button onClick={openCreate} className="w-full gap-2" disabled={!selectedMemberId}>
        <Plus className="h-4 w-4" />
        트레이닝 일지 작성
      </Button>

      {/* 일지 목록 */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">
            {selectedMember ? `${selectedMember.name}님의 트레이닝 일지` : "전체 트레이닝 일지"}
          </p>
          <span className="text-xs text-muted-foreground">{logs?.length ?? 0}건</span>
        </div>

        {!logs || logs.length === 0 ? (
          <div className="text-center py-10 text-sm text-muted-foreground">
            {selectedMemberId ? "작성된 트레이닝 일지가 없습니다" : "회원을 선택하거나 전체 일지를 확인하세요"}
          </div>
        ) : logs.map(log => {
          const exercises = parseExercisesJson(log.exercisesJson);
          const isPending = log.sessionDate === "미정";
          const isFuture = !isPending && log.sessionDate > new Date().toISOString().slice(0, 10);
          return (
            <div key={log.id} className={`border rounded-xl bg-card overflow-hidden ${isPending ? "border-amber-500/30" : "border-border"}`}>
              <button
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-accent/50 transition-colors text-left"
                onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-sm font-semibold ${isPending ? "text-amber-500" : ""}`}>{log.sessionDate}</span>
                    {isPending && (
                      <span className="text-[10px] bg-amber-500/15 text-amber-500 border border-amber-500/30 px-1.5 py-0.5 rounded-full font-medium">날짜 미정</span>
                    )}
                    {isFuture && (
                      <span className="text-[10px] bg-blue-500/15 text-blue-400 border border-blue-500/20 px-1.5 py-0.5 rounded-full font-medium">예정</span>
                    )}
                    {log.bodyPart && log.bodyPart.split(",").map(bp => (
                      <span key={bp} className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">{bp.trim()}</span>
                    ))}
                    {!selectedMemberId && log.memberName && (
                      <span className="text-xs text-muted-foreground">{log.memberName}</span>
                    )}
                  </div>
                  {exercises.length > 0 && (
                    <p className="text-xs text-muted-foreground">{exercises.map(e => e.name).filter(Boolean).join(" · ")}</p>
                  )}
                </div>
                {expandedId === log.id
                  ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
                  : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
              </button>

              {expandedId === log.id && (
                <div className="px-4 pb-4 space-y-3 border-t border-border pt-3">
                  {log.goal && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">목표</p>
                      <p className="text-sm">{log.goal}</p>
                    </div>
                  )}
                  {exercises.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">운동 종목</p>
                      <div className="space-y-1">
                        {exercises.map((ex, i) => (
                          <div key={i} className="text-sm space-y-0.5">
                            <div className="flex items-start gap-2">
                              <span className="text-muted-foreground">·</span>
                              <span>{ex.name}</span>
                              {ex.sets && ex.sets.length > 0 && (
                                <span className="text-xs text-muted-foreground">
                                  {ex.sets.map((s: any) => `${s.reps ?? ""}회${s.weight ? ` ${s.weight}kg` : ""}`).join(", ")}
                                </span>
                              )}
                            </div>
                            {ex.videoUrl && (
                              <a href={ex.videoUrl} target="_blank" rel="noreferrer"
                                className="ml-4 inline-flex items-center gap-1 text-[11px] text-primary hover:underline">
                                <Video className="h-3 w-3" />영상 보기
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {log.feedback && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">피드백</p>
                      <p className="text-sm whitespace-pre-wrap">{log.feedback}</p>
                    </div>
                  )}
                  {log.notes && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">메모</p>
                      <p className="text-sm whitespace-pre-wrap">{log.notes}</p>
                    </div>
                  )}
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => openLive(log)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-primary/30 text-xs text-primary hover:bg-primary/10 transition-colors"
                    >
                      <Dumbbell className="h-3.5 w-3.5" />
                      라이브
                    </button>
                    <button
                      onClick={() => { if (confirm("삭제하시겠습니까?")) deleteMutation.mutate({ id: log.id }); }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:text-red-500 hover:border-red-300 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      삭제
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 작성 모달 */}
      <Dialog open={journalOpen} onOpenChange={setJournalOpen}>
        <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>트레이닝 일지 작성</DialogTitle>
            <DialogDescription>{selectedMember?.name}님의 트레이닝 기록을 작성합니다.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* 날짜 미정 체크박스 */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={journalForm.datePending}
                onChange={e => setJournalForm(p => ({
                  ...p,
                  datePending: e.target.checked,
                  sessionDate: e.target.checked ? "미정" : new Date().toISOString().split("T")[0],
                }))}
                className="w-4 h-4 accent-primary"
              />
              <span className="text-xs text-muted-foreground">날짜 미정 — 나중에 확정</span>
            </label>

            <div className="space-y-1.5">
              <Label className="text-xs">날짜</Label>
              <Input
                type={journalForm.datePending ? "text" : "date"}
                value={journalForm.datePending ? "" : journalForm.sessionDate}
                placeholder={journalForm.datePending ? "미정" : ""}
                disabled={journalForm.datePending}
                onChange={e => setJournalForm(p => ({ ...p, sessionDate: e.target.value }))}
                className="h-9 text-sm disabled:opacity-50"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">운동 부위 (최대 3개)</Label>
              <BodyPartPicker value={journalForm.bodyPart} onChange={v => setJournalForm(p => ({ ...p, bodyPart: v }))} />
            </div>
            <div className="space-y-1.5">
              <TemplateLoader onLoad={exs => setJournalForm(p => ({ ...p, exercises: exs }))} />
              <Label className="text-xs">운동 종목</Label>
              <ExerciseEditor
                exercises={journalForm.exercises}
                onChange={exs => setJournalForm(p => ({ ...p, exercises: exs }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">메모 (선택)</Label>
              <Textarea
                value={journalForm.notes}
                onChange={e => setJournalForm(p => ({ ...p, notes: e.target.value }))}
                placeholder="특이사항..."
                rows={2}
                className="text-sm resize-none"
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setJournalOpen(false)}>취소</Button>
              <Button className="flex-1" disabled={createMutation.isPending} onClick={submitCreate}>
                {createMutation.isPending ? "저장 중..." : journalForm.datePending ? "임시 저장" : "저장"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 라이브 트레이닝 모달 */}
      <Dialog open={liveOpen} onOpenChange={setLiveOpen}>
        <DialogContent className="max-w-sm max-h-[95vh] overflow-y-auto p-0 flex flex-col">
          <DialogHeader className="sticky top-0 bg-card border-b border-border px-4 py-3 shrink-0">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-sm">라이브 트레이닝</DialogTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {liveDate !== "미정" ? liveDate : "날짜 미정"}
                  {selectedMember ? ` · ${selectedMember.name}` : ""}
                </p>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {liveExercises.map((ex, exIdx) => (
              <div key={exIdx} className="border border-border rounded-xl overflow-hidden">
                <div className="bg-accent/30 px-3 py-2 flex items-center gap-2">
                  <span className="text-[10px] font-bold text-muted-foreground w-5 shrink-0">{exIdx + 1}</span>
                  <input
                    value={ex.name}
                    onChange={e => updateLiveExerciseName(exIdx, e.target.value)}
                    placeholder="운동명"
                    className="flex-1 bg-transparent text-sm font-medium focus:outline-none placeholder:text-muted-foreground/40 min-w-0"
                  />
                  <button
                    onClick={() => setLiveVideoOpenIdx(liveVideoOpenIdx === exIdx ? null : exIdx)}
                    title="운동 영상 연결"
                    className={`shrink-0 p-1 rounded-lg transition-colors ${ex.videoUrl ? "text-primary" : "text-muted-foreground hover:text-primary"}`}
                  >
                    <Video className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => removeLiveExercise(exIdx)} className="text-muted-foreground hover:text-red-400 shrink-0">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                {liveVideoOpenIdx === exIdx && (
                  <div className="px-3 py-2 border-b border-border bg-primary/5 flex items-center gap-2">
                    <Video className="h-3.5 w-3.5 text-primary shrink-0" />
                    <input
                      value={ex.videoUrl ?? ""}
                      onChange={e => updateLiveVideoUrl(exIdx, e.target.value)}
                      placeholder="유튜브 링크 붙여넣기"
                      className="flex-1 bg-transparent text-xs focus:outline-none placeholder:text-muted-foreground/50 min-w-0"
                    />
                    {ex.videoUrl && (
                      <button onClick={() => updateLiveVideoUrl(exIdx, "")} className="text-muted-foreground hover:text-red-400 shrink-0">
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                )}

                <div className="px-3 pt-2 pb-1 space-y-1.5">
                  {ex.sets.map((s, setIdx) => (
                    <div key={setIdx} className="flex items-center gap-2">
                      <span className="text-[10px] text-muted-foreground w-8 text-center shrink-0 font-medium">{setIdx + 1}set</span>
                      <input
                        type="number"
                        value={s.reps}
                        onChange={e => updateLiveSet(exIdx, setIdx, "reps", e.target.value)}
                        placeholder="횟수"
                        className="flex-1 bg-muted/50 rounded-lg px-2 py-1.5 text-center text-sm focus:outline-none focus:ring-1 focus:ring-primary/30 min-w-0"
                      />
                      <span className="text-xs text-muted-foreground shrink-0">×</span>
                      <input
                        type="number"
                        value={s.weight}
                        onChange={e => updateLiveSet(exIdx, setIdx, "weight", e.target.value)}
                        placeholder="kg"
                        className="flex-1 bg-muted/50 rounded-lg px-2 py-1.5 text-center text-sm focus:outline-none focus:ring-1 focus:ring-primary/30 min-w-0"
                      />
                      <button onClick={() => removeLiveSet(exIdx, setIdx)} className="text-muted-foreground hover:text-red-400 shrink-0">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="px-3 pb-2.5 flex items-center gap-3">
                  <button
                    onClick={() => addLiveSet(exIdx)}
                    className="flex items-center gap-1 text-xs text-primary hover:text-primary/70 transition-colors"
                  >
                    <PlusCircle className="h-3.5 w-3.5" />
                    세트 추가
                  </button>
                  <button
                    onClick={() => insertLiveExercise(exIdx)}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors ml-auto"
                  >
                    <ChevronsDown className="h-3.5 w-3.5" />
                    운동 삽입
                  </button>
                </div>
              </div>
            ))}

            <button
              onClick={addLiveExercise}
              className="w-full flex items-center justify-center gap-1.5 py-3 rounded-xl border border-dashed border-border text-sm text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors"
            >
              <Plus className="h-4 w-4" />
              운동 추가
            </button>
          </div>

          <div className="sticky bottom-0 bg-card border-t border-border px-4 py-3 flex gap-2 shrink-0">
            {canSendToMember && (
              <Button
                variant="outline"
                className="flex-1 gap-1.5 text-xs"
                onClick={sendToMember}
                disabled={liveSaveMutation.isPending || sendSessionMutation.isPending}
              >
                <Send className="h-3.5 w-3.5" />
                회원 전송
              </Button>
            )}
            <Button
              className={`gap-1.5 text-xs ${canSendToMember ? "flex-1" : "w-full"}`}
              onClick={saveLive}
              disabled={liveSaveMutation.isPending}
            >
              <Save className="h-3.5 w-3.5" />
              저장
            </Button>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
