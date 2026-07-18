import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Search, SlidersHorizontal, Users, Clock, Dumbbell, Download, X } from "lucide-react";

const CATEGORY_OPTIONS = ["웨이트 트레이닝", "필라테스", "요가", "크로스핏/기능성", "재활운동", "체형교정", "유산소", "기타"];
const DIFFICULTY_OPTIONS = ["입문", "초급", "중급", "고급"];
const AUDIENCE_OPTIONS = ["일반", "시니어", "산전산후", "재활", "선수/경기력", "체중감량", "근력강화"];

export default function SequenceLibrary() {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [category, setCategory] = useState("");
  const [bodyPart, setBodyPart] = useState("");
  const [targetAudience, setTargetAudience] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [maxMinutes, setMaxMinutes] = useState("");
  const [equipment, setEquipment] = useState("");
  const [sort, setSort] = useState<"latest" | "popular">("latest");
  const [scope, setScope] = useState<"all" | "mine" | "imported">("all");

  const createDraft = trpc.sequenceLab.createDraft.useMutation({
    onSuccess: (res) => setLocation(`/sequences/${res.versionId}/edit`),
    onError: (e) => toast.error(e.message),
  });

  const { data, isLoading } = trpc.sequenceLab.libraryList.useQuery({
    search: search || undefined,
    category: category || undefined,
    bodyPart: bodyPart || undefined,
    targetAudience: targetAudience || undefined,
    difficulty: difficulty || undefined,
    maxMinutes: maxMinutes ? parseInt(maxMinutes) : undefined,
    equipment: equipment || undefined,
    sort,
    scope,
  });

  const activeFilterCount = [category, bodyPart, targetAudience, difficulty, maxMinutes, equipment].filter(Boolean).length;

  return (
    <div className="space-y-4 pb-8">
      <div className="flex items-center gap-3">
        <button onClick={() => setLocation("/sequences")} className="text-muted-foreground hover:text-foreground transition-colors shrink-0">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-lg font-bold">시퀀스 라이브러리</h1>
          <p className="text-xs text-muted-foreground">전문가 리뷰를 통과한 시퀀스를 찾아보세요</p>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="제목, 설명, 태그 검색..."
          className="w-full pl-9 pr-3 py-2.5 text-sm rounded-xl border border-border bg-accent/30 focus:outline-none focus:ring-2 focus:ring-primary/40 placeholder:text-muted-foreground/50"
        />
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
        {([["all", "전체"], ["mine", "내가 작성한"], ["imported", "내가 가져온"]] as const).map(([v, label]) => (
          <button key={v} onClick={() => setScope(v)}
            className={`shrink-0 text-xs font-semibold px-3 py-1.5 rounded-full transition-colors ${scope === v ? "bg-primary text-primary-foreground" : "bg-accent/50 text-muted-foreground hover:bg-accent"}`}>
            {label}
          </button>
        ))}
        <div className="w-px h-4 bg-border shrink-0 mx-0.5" />
        <button onClick={() => setSort(sort === "latest" ? "popular" : "latest")}
          className="shrink-0 text-xs font-semibold px-3 py-1.5 rounded-full bg-accent/50 text-muted-foreground hover:bg-accent transition-colors">
          {sort === "latest" ? "최신순" : "많이 가져온 순"}
        </button>
        <button onClick={() => setFiltersOpen(v => !v)}
          className={`shrink-0 flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-full transition-colors ${activeFilterCount > 0 ? "bg-primary/15 text-primary" : "bg-accent/50 text-muted-foreground hover:bg-accent"}`}>
          <SlidersHorizontal className="h-3 w-3" />필터{activeFilterCount > 0 ? ` ${activeFilterCount}` : ""}
        </button>
      </div>

      {filtersOpen && (
        <div className="rounded-xl border border-border bg-card p-3 space-y-2.5">
          <div className="grid grid-cols-2 gap-2">
            <select value={category} onChange={e => setCategory(e.target.value)} className="h-9 text-xs rounded-lg border border-input bg-background px-2">
              <option value="">운동 분야</option>
              {CATEGORY_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
            <select value={targetAudience} onChange={e => setTargetAudience(e.target.value)} className="h-9 text-xs rounded-lg border border-input bg-background px-2">
              <option value="">대상</option>
              {AUDIENCE_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <select value={difficulty} onChange={e => setDifficulty(e.target.value)} className="h-9 text-xs rounded-lg border border-input bg-background px-2">
              <option value="">난이도</option>
              {DIFFICULTY_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
            <Input value={maxMinutes} onChange={e => setMaxMinutes(e.target.value)} type="number" min="0" placeholder="최대 수업시간(분)" className="h-9 text-xs" />
          </div>
          <div className="flex gap-2">
            <Input value={bodyPart} onChange={e => setBodyPart(e.target.value)} placeholder="신체 부위" className="h-9 text-xs" />
            <Input value={equipment} onChange={e => setEquipment(e.target.value)} placeholder="필요 기구" className="h-9 text-xs" />
          </div>
          {activeFilterCount > 0 && (
            <button onClick={() => { setCategory(""); setBodyPart(""); setTargetAudience(""); setDifficulty(""); setMaxMinutes(""); setEquipment(""); }}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
              <X className="h-3 w-3" />필터 초기화
            </button>
          )}
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground text-center py-10">불러오는 중...</p>
      ) : !data || data.length === 0 ? (
        <div className="text-center py-16 space-y-2">
          <p className="text-sm text-muted-foreground">조건에 맞는 시퀀스가 없어요.</p>
          <button onClick={() => createDraft.mutate()} disabled={createDraft.isPending} className="text-xs font-semibold text-primary disabled:opacity-50">첫 시퀀스를 작성해보세요 →</button>
        </div>
      ) : (
        <div className="space-y-2.5">
          {data.map((seq: any) => (
            <button key={seq.sequenceId} onClick={() => setLocation(`/sequences/library/${seq.sequenceId}`)}
              className="w-full text-left rounded-2xl border border-border bg-card p-4 hover:border-primary/40 transition-colors">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <p className="text-sm font-bold truncate">{seq.title}</p>
                    {seq.isMine && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-primary/15 text-primary shrink-0">내 시퀀스</span>}
                    {seq.hasImported && !seq.isMine && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 shrink-0">가져옴</span>}
                  </div>
                  {seq.shortDescription && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{seq.shortDescription}</p>}
                </div>
                {seq.difficulty && <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-accent/60 text-foreground/70 shrink-0">{seq.difficulty}</span>}
              </div>
              <div className="flex items-center gap-3 mt-2.5 text-[11px] text-muted-foreground flex-wrap">
                <span className="flex items-center gap-1"><Users className="h-3 w-3" />{seq.authorName}</span>
                {seq.estimatedMinutes && <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{seq.estimatedMinutes}분</span>}
                {seq.equipment && <span className="flex items-center gap-1"><Dumbbell className="h-3 w-3" />{seq.equipment}</span>}
                <span className="flex items-center gap-1 ml-auto"><Download className="h-3 w-3" />{seq.importCount}회</span>
              </div>
              {(seq.category || seq.targetAudience) && (
                <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                  {seq.category && <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600">{seq.category}</span>}
                  {seq.targetAudience && <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-600">{seq.targetAudience}</span>}
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
