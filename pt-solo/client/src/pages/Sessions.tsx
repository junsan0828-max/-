import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Search, Plus, ChevronDown, ChevronUp, Pencil, Trash2, X, LayoutTemplate,
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
  bodyPart: string;
  exercises: Exercise[];
  notes: string;
  goal: string;
  feedback: string;
};

const emptyForm = (): JournalForm => ({
  sessionDate: new Date().toISOString().split("T")[0],
  bodyPart: "",
  exercises: [],
  notes: "",
  goal: "",
  feedback: "",
});

export default function Sessions() {
  const utils = trpc.useUtils();
  const { data: allMembers } = trpc.members.list.useQuery();
  const [search, setSearch] = useState("");
  const [selectedMemberId, setSelectedMemberId] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // 작성 모달
  const [journalOpen, setJournalOpen] = useState(false);
  const [journalForm, setJournalForm] = useState<JournalForm>(emptyForm());

  // 수정 모달
  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState(0);
  const [editForm, setEditForm] = useState<JournalForm>(emptyForm());

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

  const createMutation = trpc.pt.createLog.useMutation({
    onSuccess: () => {
      toast.success("트레이닝 일지가 저장되었습니다");
      utils.trainingLog.listAll.invalidate();
      setJournalOpen(false);
      setJournalForm(emptyForm());
    },
    onError: (e) => toast.error(e.message),
  });

  const updateMutation = trpc.pt.updateLog.useMutation({
    onSuccess: () => {
      toast.success("수정되었습니다");
      utils.trainingLog.listAll.invalidate();
      setEditOpen(false);
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

  const filteredMembers = (allMembers ?? []).filter(m =>
    m.name.includes(search) || (m.phone ?? "").includes(search)
  );

  function openCreate() {
    setJournalForm(emptyForm());
    setJournalOpen(true);
  }

  function openEdit(log: any) {
    setEditId(log.id);
    setEditForm({
      sessionDate: log.sessionDate,
      bodyPart: log.bodyPart ?? "",
      exercises: parseExercisesJson(log.exercisesJson),
      notes: log.notes ?? "",
      goal: log.goal ?? "",
      feedback: log.feedback ?? "",
    });
    setEditOpen(true);
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

  function submitEdit() {
    updateMutation.mutate({
      id: editId,
      sessionDate: editForm.sessionDate || undefined,
      goal: editForm.goal || undefined,
      bodyPart: editForm.bodyPart || undefined,
      exercisesJson: editForm.exercises.length > 0 ? JSON.stringify(editForm.exercises) : undefined,
      feedback: editForm.feedback || undefined,
      notes: editForm.notes || undefined,
    });
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">수업 관리</h1>

      {/* 회원 검색 */}
      <div className="space-y-2">
        <p className="text-sm font-medium text-muted-foreground">회원 선택</p>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="이름 또는 연락처로 검색"
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>

        {search && (
          <div className="border border-border rounded-xl bg-card divide-y divide-border max-h-48 overflow-y-auto">
            {filteredMembers.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">검색 결과 없음</p>
            ) : filteredMembers.map(m => (
              <button
                key={m.id}
                onClick={() => { setSelectedMemberId(m.id); setSearch(""); }}
                className="w-full text-left px-4 py-3 hover:bg-accent transition-colors"
              >
                <span className="text-sm font-medium">{m.name}</span>
                <span className="text-xs text-muted-foreground ml-2">{m.phone}</span>
              </button>
            ))}
          </div>
        )}

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
          const isFuture = log.sessionDate > new Date().toISOString().slice(0, 10);
          return (
            <div key={log.id} className="border border-border rounded-xl bg-card overflow-hidden">
              <button
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-accent/50 transition-colors text-left"
                onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold">{log.sessionDate}</span>
                    {isFuture && (
                      <span className="text-[10px] bg-amber-100 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded-full font-medium">예정</span>
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
                          <div key={i} className="text-sm flex items-start gap-2">
                            <span className="text-muted-foreground">·</span>
                            <span>{ex.name}</span>
                            {ex.sets && ex.sets.length > 0 && (
                              <span className="text-xs text-muted-foreground">
                                {ex.sets.map((s: any) => `${s.reps ?? ""}회${s.weight ? ` ${s.weight}kg` : ""}`).join(", ")}
                              </span>
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
                      onClick={() => openEdit(log)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      수정
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
            <div className="space-y-1.5">
              <Label className="text-xs">날짜</Label>
              <Input
                type="date"
                value={journalForm.sessionDate}
                onChange={e => setJournalForm(p => ({ ...p, sessionDate: e.target.value }))}
                className="h-9 text-sm"
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
                {createMutation.isPending ? "저장 중..." : "저장"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 수정 모달 */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>트레이닝 일지 수정</DialogTitle>
            <DialogDescription>{editForm.sessionDate}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">날짜</Label>
              <Input
                type="date"
                value={editForm.sessionDate}
                onChange={e => setEditForm(p => ({ ...p, sessionDate: e.target.value }))}
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">운동 부위 (최대 3개)</Label>
              <BodyPartPicker value={editForm.bodyPart} onChange={v => setEditForm(p => ({ ...p, bodyPart: v }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">운동 종목</Label>
              <ExerciseEditor
                exercises={editForm.exercises}
                onChange={exs => setEditForm(p => ({ ...p, exercises: exs }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">메모 (선택)</Label>
              <Textarea
                value={editForm.notes}
                onChange={e => setEditForm(p => ({ ...p, notes: e.target.value }))}
                placeholder="특이사항..."
                rows={2}
                className="text-sm resize-none"
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setEditOpen(false)}>취소</Button>
              <Button className="flex-1" disabled={updateMutation.isPending} onClick={submitEdit}>
                {updateMutation.isPending ? "저장 중..." : "저장"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
