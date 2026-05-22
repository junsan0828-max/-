import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { BookOpen, Plus, Trash2, GripVertical, Video, ChevronLeft, Pencil, Search, Calendar } from "lucide-react";

type Exercise = { name: string; videoUrl?: string };
type ViewMode = "list" | "write" | "detail";

const today = () => new Date().toISOString().substring(0, 10);

function ExerciseRow({
  ex,
  idx,
  onChange,
  onDelete,
}: {
  ex: Exercise;
  idx: number;
  onChange: (idx: number, val: Exercise) => void;
  onDelete: (idx: number) => void;
}) {
  return (
    <div className="flex items-center gap-2 bg-card border border-border rounded-xl px-3 py-3">
      <GripVertical className="w-4 h-4 text-muted-foreground shrink-0" />
      <input
        value={ex.name}
        onChange={e => onChange(idx, { ...ex, name: e.target.value })}
        placeholder="운동명 (예: 스쿼트)"
        className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
      />
      <button
        type="button"
        title="운동 영상 추가"
        onClick={() => {
          const url = window.prompt("영상 URL을 입력하세요 (YouTube 등)", ex.videoUrl ?? "");
          if (url !== null) onChange(idx, { ...ex, videoUrl: url });
        }}
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
  );
}

function ManualForm({
  initial,
  onSave,
  onCancel,
  isLoading,
}: {
  initial?: { title: string; manualDate: string; exercises: Exercise[] };
  onSave: (data: { title: string; manualDate: string; exercises: Exercise[] }) => void;
  onCancel: () => void;
  isLoading: boolean;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [manualDate, setManualDate] = useState(initial?.manualDate ?? today());
  const [exercises, setExercises] = useState<Exercise[]>(initial?.exercises ?? [{ name: "" }]);

  const changeEx = (idx: number, val: Exercise) =>
    setExercises(prev => prev.map((e, i) => (i === idx ? val : e)));
  const deleteEx = (idx: number) =>
    setExercises(prev => prev.filter((_, i) => i !== idx));
  const addEx = () =>
    setExercises(prev => [...prev, { name: "" }]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) { toast.error("제목을 입력해주세요"); return; }
    onSave({ title: title.trim(), manualDate, exercises: exercises.filter(e => e.name.trim()) });
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {/* 제목 + 날짜 */}
      <div className="bg-card border border-border rounded-xl p-4 space-y-3">
        <div>
          <label className="text-xs text-muted-foreground">제목 *</label>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="매뉴얼 제목을 입력하세요"
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
      </div>

      {/* 운동 종목 */}
      <div className="bg-card border border-border rounded-xl p-4 space-y-3">
        <p className="text-sm font-semibold text-foreground">운동 종목</p>
        <div className="space-y-2">
          {exercises.map((ex, idx) => (
            <ExerciseRow key={idx} ex={ex} idx={idx} onChange={changeEx} onDelete={deleteEx} />
          ))}
        </div>
        <button
          type="button"
          onClick={addEx}
          className="w-full py-3 rounded-xl border border-dashed border-primary text-primary text-sm font-medium hover:bg-primary/5 transition-colors flex items-center justify-center gap-1.5"
        >
          <Plus className="w-4 h-4" />
          운동 종목 추가
        </button>
      </div>

      {/* 액션 버튼 */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 py-3 rounded-xl border border-border text-sm text-muted-foreground hover:bg-muted transition-colors"
        >
          취소
        </button>
        <button
          type="submit"
          disabled={isLoading}
          className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-colors"
        >
          {isLoading ? "저장 중..." : "저장"}
        </button>
      </div>
    </form>
  );
}

function ManualDetail({
  id,
  onBack,
  onEdit,
}: {
  id: number;
  onBack: () => void;
  onEdit: () => void;
}) {
  const { data, isLoading } = trpc.trainingManual.get.useQuery({ id });
  const deleteMutation = trpc.trainingManual.delete.useMutation({
    onSuccess: onBack,
    onError: () => toast.error("삭제 실패"),
  });
  const utils = trpc.useUtils();

  if (isLoading) return <div className="text-center py-20 text-muted-foreground text-sm">불러오는 중...</div>;
  if (!data) return null;

  const handleDelete = () => {
    if (!window.confirm("삭제하시겠습니까?")) return;
    deleteMutation.mutate({ id });
    utils.trainingManual.list.invalidate();
  };

  return (
    <div className="space-y-4">
      {/* 헤더 */}
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
          <button
            onClick={handleDelete}
            className="flex items-center gap-1 text-sm text-destructive hover:opacity-80"
          >
            <Trash2 className="w-3.5 h-3.5" />
            삭제
          </button>
        </div>
      </div>

      {/* 제목/날짜 */}
      <div className="bg-card border border-border rounded-xl p-4">
        <h2 className="text-lg font-bold text-foreground">{data.title}</h2>
        <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
          <Calendar className="w-3.5 h-3.5" />
          {data.manualDate}
        </div>
      </div>

      {/* 운동 종목 */}
      {data.exercises.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-4 space-y-2">
          <p className="text-sm font-semibold text-foreground mb-3">운동 종목</p>
          {data.exercises.map((ex, i) => (
            <div key={i} className="flex items-center justify-between bg-background border border-border rounded-lg px-3 py-2.5">
              <span className="text-sm text-foreground">{ex.name}</span>
              {ex.videoUrl && (
                <a
                  href={ex.videoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-primary hover:opacity-80"
                >
                  <Video className="w-3.5 h-3.5" />
                  영상 보기
                </a>
              )}
            </div>
          ))}
        </div>
      )}
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

  const filtered = manuals.filter(m =>
    m.title.toLowerCase().includes(search.toLowerCase())
  );

  // ─── 글쓰기 / 수정 ───────────────────────────────────────────────────────────
  if (view === "write") {
    return (
      <div className="max-w-2xl mx-auto p-4 space-y-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setView("list")}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="w-4 h-4" />
            목록
          </button>
          <h1 className="text-base font-bold text-foreground">
            {editId ? "매뉴얼 수정" : "새 매뉴얼 작성"}
          </h1>
        </div>
        <ManualForm
          initial={editData ? { title: editData.title, manualDate: editData.manualDate, exercises: editData.exercises } : undefined}
          onSave={data => {
            if (editId) {
              updateMutation.mutate({ id: editId, ...data });
            } else {
              createMutation.mutate(data);
            }
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

  // ─── 상세 ────────────────────────────────────────────────────────────────────
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

  // ─── 목록 ────────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-primary" />
          <h1 className="text-lg font-bold text-foreground">교육 매뉴얼</h1>
          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
            {manuals.length}건
          </span>
        </div>
        <button
          onClick={() => { setEditId(null); setView("write"); }}
          className="flex items-center gap-1.5 bg-primary text-primary-foreground text-sm font-medium px-3 py-2 rounded-lg hover:opacity-90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          글쓰기
        </button>
      </div>

      {/* 검색 */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="매뉴얼 검색..."
          className="w-full bg-background border border-border rounded-xl pl-9 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      {/* 목록 */}
      {isLoading ? (
        <div className="text-center py-20 text-muted-foreground text-sm">불러오는 중...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <BookOpen className="w-10 h-10 mx-auto text-muted-foreground mb-3 opacity-40" />
          <p className="text-sm text-muted-foreground">
            {search ? "검색 결과가 없습니다" : "등록된 교육 매뉴얼이 없습니다"}
          </p>
          {!search && (
            <button
              onClick={() => setView("write")}
              className="mt-3 text-sm text-primary hover:underline"
            >
              첫 매뉴얼 작성하기
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((m, i) => (
            <button
              key={m.id}
              onClick={() => { setSelectedId(m.id); setView("detail"); }}
              className="w-full text-left bg-card border border-border rounded-xl p-4 hover:border-primary/50 hover:bg-primary/5 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs text-muted-foreground">{filtered.length - i}</span>
                    <h3 className="text-sm font-semibold text-foreground truncate">{m.title}</h3>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {m.manualDate}
                    </span>
                    {m.exercises.length > 0 && (
                      <span>{m.exercises.length}개 종목</span>
                    )}
                    {m.exercises.some(e => e.videoUrl) && (
                      <span className="flex items-center gap-0.5 text-primary">
                        <Video className="w-3 h-3" />
                        영상
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
