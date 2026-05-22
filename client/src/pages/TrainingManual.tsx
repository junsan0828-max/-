import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  BookOpen, Plus, Trash2, GripVertical, Video, ChevronLeft, Pencil,
  Search, Calendar, X, ListPlus,
} from "lucide-react";

type SupplementaryExercise = { name: string; videoUrl?: string };
type Exercise = { name: string; videoUrl?: string; supplementary?: SupplementaryExercise[] };
type SubTopic = { title: string; description?: string; exercises: Exercise[] };
type ViewMode = "list" | "write" | "detail";

const today = () => new Date().toISOString().substring(0, 10);
const MAX_SUPPLEMENTARY = 5;

function ordinal(n: number) { return `${n}번째`; }

function normalizeExercises(raw: unknown): SubTopic[] {
  if (!Array.isArray(raw) || raw.length === 0) return [];
  if (typeof (raw[0] as any)?.name === "string") {
    return [{ title: "", exercises: raw as Exercise[] }];
  }
  return raw as SubTopic[];
}

// ── 운동영상 URL 모달 ────────────────────────────────────────────────────────
function VideoUrlModal({ initial, onSave, onClose }: {
  initial: string; onSave: (url: string) => void; onClose: () => void;
}) {
  const [url, setUrl] = useState(initial);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative z-10 w-full max-w-sm bg-card border border-border rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-foreground">운동영상 링크 등록</h3>
          <button onClick={onClose} className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs text-muted-foreground">YouTube 또는 영상 URL을 입력하세요.</p>
        <input
          type="url" value={url} onChange={e => setUrl(e.target.value)}
          placeholder="https://youtube.com/watch?v=..." autoFocus
          onKeyDown={e => { if (e.key === "Enter") { onSave(url); onClose(); } if (e.key === "Escape") onClose(); }}
          className="w-full bg-background border border-border rounded-xl px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary"
        />
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-border text-sm text-muted-foreground hover:bg-accent transition-colors">취소</button>
          <button type="button" onClick={() => { onSave(url); onClose(); }} className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-colors">저장</button>
        </div>
      </div>
    </div>
  );
}

// ── 보완운동 행 ───────────────────────────────────────────────────────────────
function SupplementaryRow({ s, sIdx, onChange, onDelete }: {
  s: SupplementaryExercise;
  sIdx: number;
  onChange: (sIdx: number, val: SupplementaryExercise) => void;
  onDelete: (sIdx: number) => void;
}) {
  const [showModal, setShowModal] = useState(false);
  return (
    <>
      <div className="flex items-center gap-2 bg-background border border-border rounded-lg px-2.5 py-2 min-w-0">
        <span className="text-xs text-muted-foreground shrink-0 w-3.5 text-center font-medium">{sIdx + 1}</span>
        <input
          value={s.name}
          onChange={e => onChange(sIdx, { ...s, name: e.target.value })}
          placeholder="보완 운동명"
          className="flex-1 min-w-0 bg-transparent text-xs text-foreground placeholder:text-muted-foreground outline-none"
        />
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className={`shrink-0 p-1 rounded-md transition-colors ${s.videoUrl ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}
          title="영상 링크"
        >
          <Video className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => onDelete(sIdx)}
          className="shrink-0 p-1 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
      {showModal && (
        <VideoUrlModal
          initial={s.videoUrl ?? ""}
          onSave={url => onChange(sIdx, { ...s, videoUrl: url })}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  );
}

// ── 운동 동작 행 ─────────────────────────────────────────────────────────────
function ExerciseRow({ ex, idx, onChange, onDelete }: {
  ex: Exercise;
  idx: number;
  onChange: (idx: number, val: Exercise) => void;
  onDelete: (idx: number) => void;
}) {
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [showSuppl, setShowSuppl] = useState(false);

  const suppl = ex.supplementary ?? [];
  const hasSuppl = suppl.length > 0;
  const showSection = showSuppl || hasSuppl;

  const addSuppl = () => {
    if (suppl.length >= MAX_SUPPLEMENTARY) return;
    onChange(idx, { ...ex, supplementary: [...suppl, { name: "" }] });
    setShowSuppl(true);
  };
  const changeSuppl = (sIdx: number, val: SupplementaryExercise) =>
    onChange(idx, { ...ex, supplementary: suppl.map((s, i) => (i === sIdx ? val : s)) });
  const deleteSuppl = (sIdx: number) => {
    const next = suppl.filter((_, i) => i !== sIdx);
    onChange(idx, { ...ex, supplementary: next });
    if (next.length === 0) setShowSuppl(false);
  };

  return (
    <>
      <div className="space-y-1">
        <span className="text-xs text-muted-foreground pl-1">{ordinal(idx + 1)} 운동 동작</span>

        {/* 메인 행 */}
        <div className="flex items-center gap-2 bg-background border border-border rounded-xl px-3 py-3 w-full min-w-0">
          <GripVertical className="w-4 h-4 text-muted-foreground shrink-0" />
          <input
            value={ex.name}
            onChange={e => onChange(idx, { ...ex, name: e.target.value })}
            placeholder="운동명"
            className="flex-1 min-w-0 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
          />
          {/* 보완운동 버튼 */}
          <button
            type="button"
            title="보완운동"
            onClick={() => hasSuppl ? undefined : setShowSuppl(v => !v)}
            className={`shrink-0 p-1.5 rounded-lg transition-colors flex items-center gap-0.5 ${
              hasSuppl
                ? "text-emerald-400 bg-emerald-400/10"
                : showSuppl
                ? "text-emerald-400 bg-emerald-400/10"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            <ListPlus className="w-4 h-4" />
            {hasSuppl && <span className="text-[10px] font-bold leading-none">{suppl.length}</span>}
          </button>
          {/* 영상 버튼 */}
          <button
            type="button"
            title="운동 영상 추가"
            onClick={() => setShowVideoModal(true)}
            className={`shrink-0 p-1.5 rounded-lg transition-colors ${ex.videoUrl ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}
          >
            <Video className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => onDelete(idx)}
            className="shrink-0 p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

        {/* 보완운동 섹션 */}
        {showSection && (
          <div className="ml-4 pl-3 border-l-2 border-emerald-500/30 space-y-2 pt-1">
            <div className="flex items-center justify-between">
              <span className="text-xs text-emerald-400 font-semibold">보완운동</span>
              {suppl.length < MAX_SUPPLEMENTARY ? (
                <button
                  type="button"
                  onClick={addSuppl}
                  className="text-xs text-emerald-400 hover:opacity-80 flex items-center gap-0.5 transition-opacity"
                >
                  <Plus className="w-3 h-3" />
                  추가 ({suppl.length}/{MAX_SUPPLEMENTARY})
                </button>
              ) : (
                <span className="text-xs text-muted-foreground">{MAX_SUPPLEMENTARY}/{MAX_SUPPLEMENTARY}</span>
              )}
            </div>

            {suppl.length === 0 ? (
              <button
                type="button"
                onClick={addSuppl}
                className="w-full py-2 rounded-lg border border-dashed border-emerald-500/40 text-emerald-400 text-xs hover:bg-emerald-500/5 transition-colors flex items-center justify-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                보완운동 추가
              </button>
            ) : (
              <div className="space-y-1.5">
                {suppl.map((s, sIdx) => (
                  <SupplementaryRow key={sIdx} s={s} sIdx={sIdx} onChange={changeSuppl} onDelete={deleteSuppl} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {showVideoModal && (
        <VideoUrlModal
          initial={ex.videoUrl ?? ""}
          onSave={url => onChange(idx, { ...ex, videoUrl: url })}
          onClose={() => setShowVideoModal(false)}
        />
      )}
    </>
  );
}

// ── 소주제 카드 ──────────────────────────────────────────────────────────────
function SubTopicCard({ sub, subIdx, onChange, onDelete, canDelete }: {
  sub: SubTopic;
  subIdx: number;
  onChange: (subIdx: number, val: SubTopic) => void;
  onDelete: (subIdx: number) => void;
  canDelete: boolean;
}) {
  const changeEx = (exIdx: number, val: Exercise) =>
    onChange(subIdx, { ...sub, exercises: sub.exercises.map((e, i) => (i === exIdx ? val : e)) });
  const deleteEx = (exIdx: number) =>
    onChange(subIdx, { ...sub, exercises: sub.exercises.filter((_, i) => i !== exIdx) });
  const addEx = () =>
    onChange(subIdx, { ...sub, exercises: [...sub.exercises, { name: "" }] });

  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <input
          value={sub.title}
          onChange={e => onChange(subIdx, { ...sub, title: e.target.value })}
          placeholder="소주제를 입력하세요"
          className="flex-1 min-w-0 bg-background border border-border rounded-lg px-3 py-2 text-sm font-medium text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-primary"
        />
        {canDelete && (
          <button
            type="button"
            onClick={() => onDelete(subIdx)}
            className="shrink-0 p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
      <textarea
        value={sub.description ?? ""}
        onChange={e => onChange(subIdx, { ...sub, description: e.target.value })}
        placeholder="소주제에 대한 설명이나 개념을 입력하세요"
        rows={3}
        className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-primary resize-none"
      />
      <div className="space-y-2">
        {sub.exercises.map((ex, exIdx) => (
          <ExerciseRow key={exIdx} ex={ex} idx={exIdx} onChange={changeEx} onDelete={deleteEx} />
        ))}
      </div>
      <button
        type="button"
        onClick={addEx}
        className="w-full py-2.5 rounded-xl border border-dashed border-border text-muted-foreground text-sm hover:border-primary hover:text-primary transition-colors flex items-center justify-center gap-1.5"
      >
        <Plus className="w-4 h-4" />
        운동 동작 추가
      </button>
    </div>
  );
}

function ManualForm({ initial, onSave, onCancel, isLoading }: {
  initial?: { title: string; manualDate: string; description?: string; exercises: SubTopic[] };
  onSave: (data: { title: string; manualDate: string; description: string; exercises: SubTopic[] }) => void;
  onCancel: () => void;
  isLoading: boolean;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [manualDate, setManualDate] = useState(initial?.manualDate ?? today());
  const [description, setDescription] = useState(initial?.description ?? "");
  const [subTopics, setSubTopics] = useState<SubTopic[]>(
    initial?.exercises ?? [{ title: "", description: "", exercises: [{ name: "" }] }]
  );

  const changeSub = (subIdx: number, val: SubTopic) =>
    setSubTopics(prev => prev.map((s, i) => (i === subIdx ? val : s)));
  const deleteSub = (subIdx: number) =>
    setSubTopics(prev => prev.filter((_, i) => i !== subIdx));
  const addSub = () =>
    setSubTopics(prev => [...prev, { title: "", description: "", exercises: [{ name: "" }] }]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) { toast.error("주제를 입력해주세요"); return; }
    const cleaned = subTopics
      .map(s => ({ ...s, exercises: s.exercises.filter(ex => ex.name.trim()) }))
      .filter(s => s.title.trim() || (s.description ?? "").trim() || s.exercises.length > 0);
    onSave({ title: title.trim(), manualDate, description, exercises: cleaned });
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="bg-card border border-border rounded-xl p-4 space-y-3">
        <div>
          <label className="text-xs text-muted-foreground">주제 *</label>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="매뉴얼 주제를 입력하세요"
            className="w-full mt-1 bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">날짜 *</label>
          <input
            type="date"
            value={manualDate}
            onChange={e => setManualDate(e.target.value)}
            className="w-full mt-1 bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">설명</label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="주제에 대한 설명이나 개념을 입력하세요"
            rows={4}
            className="w-full mt-1 bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-primary resize-none"
          />
        </div>
      </div>

      {subTopics.map((sub, subIdx) => (
        <SubTopicCard
          key={subIdx}
          sub={sub}
          subIdx={subIdx}
          onChange={changeSub}
          onDelete={deleteSub}
          canDelete={subTopics.length > 1}
        />
      ))}

      <button
        type="button"
        onClick={addSub}
        className="w-full py-3 rounded-xl border border-dashed border-primary text-primary text-sm font-medium hover:bg-primary/5 transition-colors flex items-center justify-center gap-1.5"
      >
        <Plus className="w-4 h-4" />
        소주제 추가
      </button>

      <div className="flex gap-2">
        <button type="button" onClick={onCancel} className="flex-1 py-3 rounded-xl border border-border text-sm text-muted-foreground hover:bg-muted transition-colors">취소</button>
        <button type="submit" disabled={isLoading} className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-colors">
          {isLoading ? "저장 중..." : "저장"}
        </button>
      </div>
    </form>
  );
}

function ManualDetail({ id, onBack, onEdit }: { id: number; onBack: () => void; onEdit: () => void; }) {
  const { data, isLoading } = trpc.trainingManual.get.useQuery({ id });
  const deleteMutation = trpc.trainingManual.delete.useMutation({
    onSuccess: onBack,
    onError: () => toast.error("삭제 실패"),
  });
  const utils = trpc.useUtils();

  if (isLoading) return <div className="text-center py-20 text-muted-foreground text-sm">불러오는 중...</div>;
  if (!data) return null;

  const subTopics = normalizeExercises(data.exercises);

  const handleDelete = () => {
    if (!window.confirm("삭제하시겠습니까?")) return;
    deleteMutation.mutate({ id });
    utils.trainingManual.list.invalidate();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeft className="w-4 h-4" />
          목록
        </button>
        <div className="flex gap-2">
          <button onClick={onEdit} className="flex items-center gap-1 text-sm text-primary hover:opacity-80">
            <Pencil className="w-3.5 h-3.5" />
            수정
          </button>
          <button onClick={handleDelete} className="flex items-center gap-1 text-sm text-destructive hover:opacity-80">
            <Trash2 className="w-3.5 h-3.5" />
            삭제
          </button>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-4 space-y-2">
        <h2 className="text-lg font-bold text-foreground">{data.title}</h2>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Calendar className="w-3.5 h-3.5" />
          {data.manualDate}
        </div>
        {data.description && (
          <p className="text-sm text-foreground whitespace-pre-wrap pt-1">{data.description}</p>
        )}
      </div>

      {subTopics.map((sub, subIdx) => (
        <div key={subIdx} className="bg-card border border-border rounded-xl p-4 space-y-3">
          {sub.title && <p className="text-sm font-semibold text-foreground">{sub.title}</p>}
          {sub.description && (
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{sub.description}</p>
          )}
          {sub.exercises.length > 0 && (
            <div className="space-y-2">
              {sub.exercises.map((ex, exIdx) => (
                <div key={exIdx} className="space-y-1.5">
                  {/* 메인 운동 동작 */}
                  <div className="flex items-center justify-between bg-background border border-border rounded-lg px-3 py-2.5 gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs text-muted-foreground shrink-0">{ordinal(exIdx + 1)}</span>
                      <span className="text-sm text-foreground truncate">{ex.name}</span>
                    </div>
                    {ex.videoUrl && (
                      <a
                        href={ex.videoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs text-primary hover:opacity-80 shrink-0"
                      >
                        <Video className="w-3.5 h-3.5" />
                        영상
                      </a>
                    )}
                  </div>

                  {/* 보완운동 */}
                  {(ex.supplementary?.length ?? 0) > 0 && (
                    <div className="ml-4 pl-3 border-l-2 border-emerald-500/30 space-y-1">
                      <span className="text-xs text-emerald-400 font-semibold">보완운동</span>
                      {ex.supplementary!.map((s, sIdx) => (
                        <div key={sIdx} className="flex items-center justify-between bg-background/60 border border-border/60 rounded-lg px-2.5 py-2 gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-xs text-muted-foreground shrink-0 w-3.5 text-center">{sIdx + 1}</span>
                            <span className="text-xs text-foreground truncate">{s.name}</span>
                          </div>
                          {s.videoUrl && (
                            <a
                              href={s.videoUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-xs text-primary hover:opacity-80 shrink-0"
                            >
                              <Video className="w-3 h-3" />
                              영상
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default function TrainingManual() {
  const [view, setView] = useState<ViewMode>("list");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [editId, setEditId] = useState<number | null>(null);
  const [search, setSearch] = useState("");

  const { data: manuals = [], isLoading } = trpc.trainingManual.list.useQuery();
  const utils = trpc.useUtils();

  const createMutation = trpc.trainingManual.create.useMutation({
    onSuccess: () => {
      toast.success("매뉴얼이 저장되었습니다");
      utils.trainingManual.list.invalidate();
      setView("list");
    },
    onError: () => toast.error("저장 실패"),
  });

  const updateMutation = trpc.trainingManual.update.useMutation({
    onSuccess: () => {
      toast.success("수정되었습니다");
      utils.trainingManual.list.invalidate();
      utils.trainingManual.get.invalidate({ id: editId! });
      setView("detail");
      setSelectedId(editId);
      setEditId(null);
    },
    onError: () => toast.error("수정 실패"),
  });

  const editData = manuals.find(m => m.id === editId);
  const filtered = manuals.filter(m => m.title.toLowerCase().includes(search.toLowerCase()));

  if (view === "write") {
    return (
      <div className="max-w-2xl mx-auto p-4 space-y-4">
        <div className="flex items-center gap-3">
          <button onClick={() => setView("list")} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ChevronLeft className="w-4 h-4" />
            목록
          </button>
          <h1 className="text-base font-bold text-foreground">{editId ? "매뉴얼 수정" : "새 매뉴얼 작성"}</h1>
        </div>
        <ManualForm
          initial={editData ? {
            title: editData.title,
            manualDate: editData.manualDate,
            description: editData.description ?? "",
            exercises: normalizeExercises(editData.exercises),
          } : undefined}
          onSave={data => {
            if (editId) updateMutation.mutate({ id: editId, ...data });
            else createMutation.mutate(data);
          }}
          onCancel={() => {
            if (editId) { setView("detail"); setSelectedId(editId); setEditId(null); }
            else setView("list");
          }}
          isLoading={createMutation.isPending || updateMutation.isPending}
        />
      </div>
    );
  }

  if (view === "detail" && selectedId) {
    return (
      <div className="max-w-2xl mx-auto p-4">
        <ManualDetail
          id={selectedId}
          onBack={() => { setView("list"); setSelectedId(null); }}
          onEdit={() => { setEditId(selectedId); setView("write"); }}
        />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-primary" />
          <h1 className="text-lg font-bold text-foreground">교육 매뉴얼</h1>
          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{manuals.length}건</span>
        </div>
        <button
          onClick={() => { setEditId(null); setView("write"); }}
          className="flex items-center gap-1.5 bg-primary text-primary-foreground text-sm font-medium px-3 py-2 rounded-lg hover:opacity-90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          글쓰기
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="매뉴얼 검색..."
          className="w-full bg-background border border-border rounded-xl pl-9 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      {isLoading ? (
        <div className="text-center py-20 text-muted-foreground text-sm">불러오는 중...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <BookOpen className="w-10 h-10 mx-auto text-muted-foreground mb-3 opacity-40" />
          <p className="text-sm text-muted-foreground">{search ? "검색 결과가 없습니다" : "등록된 교육 매뉴얼이 없습니다"}</p>
          {!search && (
            <button onClick={() => setView("write")} className="mt-3 text-sm text-primary hover:underline">
              첫 매뉴얼 작성하기
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((m, i) => {
            const subTopics = normalizeExercises(m.exercises);
            const totalExercises = subTopics.reduce((sum, s) => sum + s.exercises.length, 0);
            const hasVideo = subTopics.some(s => s.exercises.some(e => e.videoUrl || (e.supplementary ?? []).some(sp => sp.videoUrl)));
            return (
              <button
                key={m.id}
                onClick={() => { setSelectedId(m.id); setView("detail"); }}
                className="w-full text-left bg-card border border-border rounded-xl p-4 hover:border-primary/50 hover:bg-primary/5 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs text-muted-foreground">{filtered.length - i}</span>
                    <h3 className="text-sm font-semibold text-foreground truncate">{m.title}</h3>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{m.manualDate}</span>
                    {subTopics.length > 0 && <span>{subTopics.length}개 소주제</span>}
                    {totalExercises > 0 && <span>{totalExercises}개 동작</span>}
                    {hasVideo && <span className="flex items-center gap-0.5 text-primary"><Video className="w-3 h-3" />영상</span>}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
