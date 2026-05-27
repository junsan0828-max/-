import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Search, Plus, ChevronDown, ChevronUp, Pencil, Trash2, X, Save } from "lucide-react";
import { Button } from "@/components/ui/button";

type Log = {
  id: number;
  memberId: number | null;
  memberName: string | null;
  sessionDate: string;
  goal: string | null;
  bodyPart: string | null;
  exercisesJson: string | null;
  feedback: string | null;
  notes: string | null;
  createdAt: string | null;
};

type LogForm = {
  sessionDate: string;
  goal: string;
  bodyPart: string;
  exercisesJson: string;
  feedback: string;
  notes: string;
};

const BODY_PARTS = ["전신", "상체", "하체", "코어", "어깨", "등", "가슴", "팔", "둔근", "유산소"];

const emptyForm = (): LogForm => ({
  sessionDate: new Date().toISOString().slice(0, 10),
  goal: "",
  bodyPart: "",
  exercisesJson: "",
  feedback: "",
  notes: "",
});

export default function Sessions() {
  const utils = trpc.useUtils();
  const { data: allMembers } = trpc.members.list.useQuery();
  const [search, setSearch] = useState("");
  const [selectedMemberId, setSelectedMemberId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<LogForm>(emptyForm());
  const [expandedId, setExpandedId] = useState<number | null>(null);

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
      setShowForm(false);
      setForm(emptyForm());
    },
    onError: (e) => toast.error(e.message),
  });

  const updateMutation = trpc.pt.updateLog.useMutation({
    onSuccess: () => {
      toast.success("수정되었습니다");
      utils.trainingLog.listAll.invalidate();
      setEditId(null);
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

  function handleSubmit() {
    if (!selectedMemberId) return toast.error("회원을 선택해주세요");
    if (!form.sessionDate) return toast.error("날짜를 입력해주세요");
    if (editId) {
      updateMutation.mutate({ id: editId, ...form });
    } else {
      createMutation.mutate({ memberId: selectedMemberId, ...form });
    }
  }

  function openEdit(log: Log) {
    setEditId(log.id);
    setForm({
      sessionDate: log.sessionDate,
      goal: log.goal ?? "",
      bodyPart: log.bodyPart ?? "",
      exercisesJson: log.exercisesJson ?? "",
      feedback: log.feedback ?? "",
      notes: log.notes ?? "",
    });
    setShowForm(true);
  }

  function cancelForm() {
    setShowForm(false);
    setEditId(null);
    setForm(emptyForm());
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">수업 관리</h1>
      </div>

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
              <button onClick={() => { setSelectedMemberId(null); }} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            {activePackage && (
              <div className="flex items-center gap-3 pt-1 border-t border-primary/15 flex-wrap">
                <span className="text-xs font-medium text-foreground">{activePackage.packageName || "PT"}</span>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="bg-background rounded-full px-2 py-0.5 border border-border font-medium">
                    총 {activePackage.totalSessions}회
                  </span>
                  <span className="text-muted-foreground/50">·</span>
                  <span className="bg-background rounded-full px-2 py-0.5 border border-border font-medium">
                    사용 {activePackage.usedSessions}회
                  </span>
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
      <Button
        onClick={() => { setShowForm(true); setEditId(null); setForm(emptyForm()); }}
        className="w-full gap-2"
        disabled={!selectedMemberId}
      >
        <Plus className="h-4 w-4" />
        트레이닝 일지 작성
      </Button>

      {/* 작성/수정 폼 */}
      {showForm && (
        <div className="border border-border rounded-xl bg-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">{editId ? "일지 수정" : "새 트레이닝 일지"}</p>
            <button onClick={cancelForm} className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">날짜</label>
              <input
                type="date"
                value={form.sessionDate}
                onChange={e => setForm(f => ({ ...f, sessionDate: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">운동 부위</label>
              <select
                value={form.bodyPart}
                onChange={e => setForm(f => ({ ...f, bodyPart: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="">선택</option>
                {BODY_PARTS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">오늘의 목표</label>
            <input
              value={form.goal}
              onChange={e => setForm(f => ({ ...f, goal: e.target.value }))}
              placeholder="예: 스쿼트 자세 교정, 유산소 30분"
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">운동 내용</label>
            <textarea
              value={form.exercisesJson}
              onChange={e => setForm(f => ({ ...f, exercisesJson: e.target.value }))}
              placeholder="스쿼트 4x12, 레그프레스 3x15, ..."
              rows={3}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">피드백 / 코칭 메모</label>
            <textarea
              value={form.feedback}
              onChange={e => setForm(f => ({ ...f, feedback: e.target.value }))}
              placeholder="자세 포인트, 개선사항, 다음 수업 계획 등"
              rows={3}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">추가 메모</label>
            <input
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="회원 컨디션, 특이사항 등"
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          <Button
            className="w-full gap-2"
            onClick={handleSubmit}
            disabled={createMutation.isPending || updateMutation.isPending}
          >
            <Save className="h-4 w-4" />
            {editId ? "수정 저장" : "저장"}
          </Button>
        </div>
      )}

      {/* 트레이닝 일지 목록 */}
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
        ) : logs.map(log => (
          <div key={log.id} className="border border-border rounded-xl bg-card overflow-hidden">
            <button
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-accent/50 transition-colors text-left"
              onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
            >
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">{log.sessionDate}</span>
                  {log.bodyPart && (
                    <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">{log.bodyPart}</span>
                  )}
                  {!selectedMemberId && log.memberName && (
                    <span className="text-xs text-muted-foreground">{log.memberName}</span>
                  )}
                </div>
                {log.goal && <p className="text-xs text-muted-foreground truncate">{log.goal}</p>}
              </div>
              {expandedId === log.id ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
            </button>

            {expandedId === log.id && (
              <div className="px-4 pb-4 space-y-3 border-t border-border pt-3">
                {log.exercisesJson && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">운동 내용</p>
                    <p className="text-sm whitespace-pre-wrap">{log.exercisesJson}</p>
                  </div>
                )}
                {log.feedback && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">피드백 / 코칭 메모</p>
                    <p className="text-sm whitespace-pre-wrap">{log.feedback}</p>
                  </div>
                )}
                {log.notes && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">추가 메모</p>
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
        ))}
      </div>
    </div>
  );
}
