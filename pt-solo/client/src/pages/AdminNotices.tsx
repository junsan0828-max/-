import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Bell, Plus, Pencil, Trash2, Pin, ExternalLink, ImageIcon, X, ClipboardList, ChevronDown, ChevronUp, Users, Check, Info } from "lucide-react";
import { toast } from "sonner";

type Notice = { id: number; title: string; content: string; isPinned: boolean; isActive: boolean; createdAt: string };

const TAB_OPTIONS = [
  { key: "all",        label: "전체 (공통)" },
  { key: "dashboard",  label: "대시보드" },
  { key: "pt",         label: "회원 관리" },
  { key: "sessions",   label: "수업 관리" },
  { key: "leads",      label: "상담실" },
  { key: "workshop",   label: "작업실" },
  { key: "booking",    label: "수업 예약 관리" },
  { key: "settlement", label: "성장분석실" },
  { key: "attendance", label: "출석 체크" },
  { key: "profile",    label: "내 프로필" },
];

function NoticeForm({ initial, onSave, onCancel }: {
  initial?: Notice;
  onSave: (d: { title: string; content: string; isPinned: boolean; isActive: boolean }) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [content, setContent] = useState(initial?.content ?? "");
  const [isPinned, setIsPinned] = useState(initial?.isPinned ?? false);
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);

  return (
    <div className="space-y-3 p-4 rounded-xl border border-primary/30 bg-primary/5">
      <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="제목" className="bg-input border-border" />
      <textarea
        value={content}
        onChange={e => setContent(e.target.value)}
        placeholder="내용"
        rows={4}
        className="w-full text-sm bg-input border border-border rounded-md px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-primary"
      />
      <div className="flex gap-4 text-sm">
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input type="checkbox" checked={isPinned} onChange={e => setIsPinned(e.target.checked)} className="accent-primary" />
          <Pin className="h-3.5 w-3.5 text-primary" />상단 고정
        </label>
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} className="accent-primary" />
          활성화
        </label>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" className="flex-1" onClick={onCancel}>취소</Button>
        <Button size="sm" className="flex-1" onClick={() => {
          if (!title.trim() || !content.trim()) { toast.error("제목과 내용을 입력하세요."); return; }
          onSave({ title, content, isPinned, isActive });
        }}>저장</Button>
      </div>
    </div>
  );
}

const HEIGHT_OPTIONS = [
  { value: "small",  label: "소 (56px)" },
  { value: "medium", label: "중 (96px)" },
  { value: "large",  label: "대 (140px)" },
];

type FieldState = {
  text: string; subText: string; link: string; bgColor: string;
  isActive: boolean; imageUrl: string; bannerHeight: string;
  textSize: string; textAlign: string;
};

function TabBannerManager() {
  const utils = trpc.useUtils();
  const { data: allBanners } = trpc.tabBanner.listAll.useQuery();
  const upsertMutation = trpc.tabBanner.upsert.useMutation({
    onError: e => toast.error(e.message),
  });

  const [selectedTabs, setSelectedTabs] = useState<Set<string>>(new Set(["all"]));
  const [editState, setEditState] = useState<FieldState>({
    text: "", subText: "", link: "", bgColor: "#6366f1",
    isActive: true, imageUrl: "", bannerHeight: "medium", textSize: "medium", textAlign: "left",
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);

  // 탭 선택 시 해당 탭의 기존 데이터 로드 (단일 탭 클릭 시)
  const toggleTab = (key: string) => {
    setSelectedTabs(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        // 처음 선택하는 탭이면 기존 데이터 로드
        if (next.size === 0) {
          const row = allBanners?.find(b => b.tabKey === key);
          if (row) {
            setEditState({
              text: row.text ?? "",
              subText: row.subText ?? "",
              link: row.link ?? "",
              bgColor: row.bgColor ?? "#6366f1",
              isActive: row.isActive === 1,
              imageUrl: (row as any).imageUrl ?? "",
              bannerHeight: (row as any).bannerHeight ?? "medium",
              textSize: (row as any).textSize ?? "medium",
              textAlign: (row as any).textAlign ?? "left",
            });
          }
        }
        next.add(key);
      }
      return next;
    });
  };

  // 단독 클릭(단일 선택 교체): Shift 없이 이미 선택된 탭 하나만 있을 때 다른 탭 클릭
  const selectOnly = (key: string) => {
    const row = allBanners?.find(b => b.tabKey === key);
    if (row) {
      setEditState({
        text: row.text ?? "",
        subText: row.subText ?? "",
        link: row.link ?? "",
        bgColor: row.bgColor ?? "#6366f1",
        isActive: row.isActive === 1,
        imageUrl: (row as any).imageUrl ?? "",
        bannerHeight: (row as any).bannerHeight ?? "medium",
        textSize: (row as any).textSize ?? "medium",
        textAlign: (row as any).textAlign ?? "left",
      });
    } else {
      setEditState({ text: "", subText: "", link: "", bgColor: "#6366f1", isActive: true, imageUrl: "", bannerHeight: "medium", textSize: "medium", textAlign: "left" });
    }
    setSelectedTabs(new Set([key]));
  };

  const patch = (p: Partial<FieldState>) => setEditState(s => ({ ...s, ...p }));

  const heightPx: Record<string, string> = { small: "56px", medium: "96px", large: "140px" };

  const handleImageFile = (file: File) => {
    if (file.size > 5 * 1024 * 1024) { toast.error("이미지는 5MB 이하로 업로드해주세요"); return; }
    const reader = new FileReader();
    reader.onload = (e) => patch({ imageUrl: e.target?.result as string });
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (selectedTabs.size === 0) { toast.error("저장할 탭을 선택해주세요"); return; }
    setSaving(true);
    try {
      await Promise.all(Array.from(selectedTabs).map(tabKey =>
        upsertMutation.mutateAsync({
          tabKey,
          text: editState.text,
          subText: editState.subText || undefined,
          link: editState.link || undefined,
          bgColor: editState.bgColor,
          isActive: editState.isActive,
          imageUrl: editState.imageUrl || "",
          bannerHeight: editState.bannerHeight,
          textSize: editState.textSize,
          textAlign: editState.textAlign,
        })
      ));
      toast.success(`${selectedTabs.size}개 탭에 배너 저장 완료`);
      utils.tabBanner.listAll.invalidate();
      utils.tabBanner.getByTab.invalidate();
    } catch {
      // error already toasted by mutation
    } finally {
      setSaving(false);
    }
  };

  const selectedLabels = Array.from(selectedTabs).map(k => TAB_OPTIONS.find(t => t.key === k)?.label ?? k).join(", ");

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <ExternalLink className="h-4 w-4 text-primary" />탭별 광고 배너
        </CardTitle>
        <p className="text-xs text-muted-foreground">탭을 하나 또는 여러 개 선택하여 같은 배너를 한 번에 저장할 수 있습니다</p>
      </CardHeader>
      <CardContent className="space-y-4">

        {/* 우선순위 안내 */}
        <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20">
          <Info className="h-3.5 w-3.5 text-amber-400 shrink-0 mt-0.5" />
          <p className="text-[11px] text-amber-300 leading-relaxed">
            <span className="font-semibold">우선순위:</span> 특정 탭 배너 &gt; 전체(공통) 배너<br />
            특정 탭에 활성 배너가 있으면 전체 배너는 그 탭에서 표시되지 않습니다.
          </p>
        </div>

        {/* 탭 다중 선택 */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">탭 선택 <span className="text-primary font-semibold">(복수 선택 가능)</span></p>
            {selectedTabs.size > 0 && (
              <button onClick={() => setSelectedTabs(new Set())} className="text-[10px] text-muted-foreground hover:text-foreground">전체 해제</button>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {TAB_OPTIONS.map(t => {
              const row = allBanners?.find(b => b.tabKey === t.key);
              const hasActive = row?.isActive === 1 && ((row as any)?.text || (row as any)?.imageUrl);
              const isSelected = selectedTabs.has(t.key);
              return (
                <button
                  key={t.key}
                  onClick={() => {
                    if (isSelected && selectedTabs.size === 1) {
                      // 이미 단독 선택된 탭 클릭 → 해제 (아무것도 선택 안됨)
                      setSelectedTabs(new Set());
                    } else if (!isSelected && selectedTabs.size === 0) {
                      selectOnly(t.key);
                    } else {
                      toggleTab(t.key);
                    }
                  }}
                  className={`relative px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                    isSelected
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border text-muted-foreground hover:border-primary/40"
                  }`}
                >
                  {isSelected && <Check className="inline h-3 w-3 mr-1" />}
                  {t.label}
                  {hasActive && !isSelected && <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-emerald-400" />}
                </button>
              );
            })}
          </div>
          {selectedTabs.size > 1 && (
            <p className="text-[11px] text-primary font-medium">
              ✓ {selectedTabs.size}개 탭 선택됨 — 저장 시 모든 탭에 동일하게 적용됩니다
            </p>
          )}
        </div>

        {selectedTabs.size === 0 ? (
          <div className="py-6 text-center text-xs text-muted-foreground">탭을 선택하면 배너를 설정할 수 있습니다</div>
        ) : (
          <>
            {/* 미리보기 */}
            <div className="rounded-xl overflow-hidden border border-border/40" style={{ height: heightPx[editState.bannerHeight] ?? "96px" }}>
              {editState.imageUrl ? (
                <img src={editState.imageUrl} alt="미리보기" className="w-full h-auto" style={{ display: "block" }} />
              ) : editState.text ? (
                <div
                  className={`w-full h-full flex items-center gap-3 px-4 ${
                    editState.textAlign === "center" ? "justify-center text-center" : editState.textAlign === "right" ? "justify-end text-right" : "justify-start text-left"
                  }`}
                  style={{ backgroundColor: editState.bgColor }}
                >
                  <div className="flex-1 min-w-0">
                    <p className={`font-bold text-white line-clamp-2 leading-tight ${editState.textSize === "large" ? "text-lg" : editState.textSize === "small" ? "text-xs" : "text-sm"}`}>{editState.text}</p>
                    {editState.subText && <p className="text-xs text-white/80 mt-0.5 line-clamp-2">{editState.subText}</p>}
                  </div>
                  {editState.link && <ExternalLink className="h-4 w-4 text-white/80 shrink-0" />}
                </div>
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-muted/30 text-xs text-muted-foreground">미리보기</div>
              )}
            </div>

            <div className="space-y-3">
              <p className="text-xs font-medium text-muted-foreground">
                {selectedLabels} 배너 설정
              </p>

              {/* 배너 크기 */}
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">배너 크기</label>
                <div className="flex gap-2">
                  {HEIGHT_OPTIONS.map(h => (
                    <button key={h.value} onClick={() => patch({ bannerHeight: h.value })}
                      className={`flex-1 py-1.5 text-xs rounded-lg border transition-colors ${editState.bannerHeight === h.value ? "bg-primary/20 border-primary/40 text-primary" : "border-border text-muted-foreground hover:border-primary/30"}`}>
                      {h.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 글씨 크기 */}
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">글씨 크기</label>
                <div className="flex gap-2">
                  {[{ value: "small", label: "소" }, { value: "medium", label: "중" }, { value: "large", label: "대" }].map(o => (
                    <button key={o.value} onClick={() => patch({ textSize: o.value })}
                      className={`flex-1 py-1.5 text-xs rounded-lg border transition-colors ${editState.textSize === o.value ? "bg-primary/20 border-primary/40 text-primary" : "border-border text-muted-foreground hover:border-primary/30"}`}>
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 글씨 위치 */}
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">글씨 위치</label>
                <div className="flex gap-2">
                  {[{ value: "left", label: "왼쪽" }, { value: "center", label: "가운데" }, { value: "right", label: "오른쪽" }].map(o => (
                    <button key={o.value} onClick={() => patch({ textAlign: o.value })}
                      className={`flex-1 py-1.5 text-xs rounded-lg border transition-colors ${editState.textAlign === o.value ? "bg-primary/20 border-primary/40 text-primary" : "border-border text-muted-foreground hover:border-primary/30"}`}>
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 이미지 업로드 */}
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">배너 이미지 (선택)</label>
                {editState.imageUrl ? (
                  <div className="flex items-center gap-2 p-2 rounded-lg border border-border bg-muted/20">
                    <img src={editState.imageUrl} alt="이미지" className="h-10 w-16 object-cover rounded" />
                    <span className="text-xs text-muted-foreground flex-1">이미지 업로드됨</span>
                    <button onClick={() => patch({ imageUrl: "" })} className="text-muted-foreground hover:text-red-400">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <button onClick={() => fileInputRef.current?.click()}
                    className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg border border-dashed border-border text-muted-foreground hover:border-primary/40 text-sm transition-colors">
                    <ImageIcon className="h-4 w-4 shrink-0" />
                    이미지 파일 첨부 (JPG, PNG, GIF · 5MB 이하)
                  </button>
                )}
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleImageFile(f); e.target.value = ""; }} />
              </div>

              {/* 텍스트 (이미지 없을 때만) */}
              {!editState.imageUrl && (
                <>
                  <Input value={editState.text} onChange={e => patch({ text: e.target.value })}
                    placeholder="배너 텍스트 *" className="bg-input border-border" />
                  <Input value={editState.subText} onChange={e => patch({ subText: e.target.value })}
                    placeholder="서브 텍스트 (선택)" className="bg-input border-border" />
                  <div className="space-y-1.5">
                    <label className="text-xs text-muted-foreground">빠른 색상 선택</label>
                    <div className="grid grid-cols-5 gap-1.5">
                      {[
                        { bg: "#2563eb", label: "블루" }, { bg: "#7c3aed", label: "퍼플" },
                        { bg: "#059669", label: "그린" }, { bg: "#dc2626", label: "레드" },
                        { bg: "#d97706", label: "오렌지" }, { bg: "#0891b2", label: "시안" },
                        { bg: "#be185d", label: "핑크" }, { bg: "#1e293b", label: "다크" },
                        { bg: "#374151", label: "그레이" }, { bg: "#1a3a6e", label: "네이비" },
                      ].map(p => (
                        <button key={p.bg} title={p.label} onClick={() => patch({ bgColor: p.bg })}
                          className={`h-8 rounded-lg border-2 transition-all ${editState.bgColor === p.bg ? "border-white scale-110" : "border-transparent"}`}
                          style={{ backgroundColor: p.bg }} />
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="text-xs text-muted-foreground shrink-0">직접 입력</label>
                    <input type="color" value={editState.bgColor} onChange={e => patch({ bgColor: e.target.value })}
                      className="h-8 w-12 rounded cursor-pointer border-0" />
                    <span className="text-xs text-muted-foreground">{editState.bgColor}</span>
                  </div>
                </>
              )}

              <Input value={editState.link} onChange={e => patch({ link: e.target.value })}
                placeholder="링크 URL (선택)" className="bg-input border-border" />

              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={editState.isActive} onChange={e => patch({ isActive: e.target.checked })} className="accent-primary" />
                배너 활성화
              </label>

              <Button className="w-full" size="sm" onClick={handleSave} disabled={saving}>
                {saving ? "저장 중..." : selectedTabs.size > 1
                  ? `선택한 ${selectedTabs.size}개 탭에 저장`
                  : `"${selectedLabels}" 배너 저장`}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function LegacyBannerManager() {
  const utils = trpc.useUtils();
  const { data: banner } = trpc.banner.get.useQuery();
  const upsertMutation = trpc.banner.upsert.useMutation({
    onSuccess: () => { toast.success("배너 저장 완료"); utils.banner.get.invalidate(); },
    onError: e => toast.error(e.message),
  });

  const [text, setText] = useState("");
  const [subText, setSubText] = useState("");
  const [bgColor, setBgColor] = useState("#6366f1");
  const [isActive, setIsActive] = useState(false);
  const [loaded, setLoaded] = useState(false);

  if (banner && !loaded) {
    setText(banner.text ?? "");
    setSubText(banner.subText ?? "");
    setBgColor(banner.bgColor ?? "#6366f1");
    setIsActive(!!banner.isActive);
    setLoaded(true);
  }

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Bell className="h-4 w-4 text-primary" />대시보드 일반 배너
        </CardTitle>
        <p className="text-xs text-muted-foreground">대시보드 공지사항 영역에 표시되는 배너입니다</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {text && (
          <div className="rounded-xl overflow-hidden border border-border/40">
            <div className="flex items-center gap-3 px-4 py-3" style={{ backgroundColor: bgColor }}>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white truncate">{text}</p>
                {subText && <p className="text-xs text-white/80 mt-0.5 truncate">{subText}</p>}
              </div>
            </div>
          </div>
        )}
        <Input value={text} onChange={e => setText(e.target.value)} placeholder="배너 텍스트" className="bg-input border-border" />
        <Input value={subText} onChange={e => setSubText(e.target.value)} placeholder="서브 텍스트 (선택)" className="bg-input border-border" />
        <div className="flex items-center gap-3">
          <label className="text-xs text-muted-foreground shrink-0">배경색</label>
          <input type="color" value={bgColor} onChange={e => setBgColor(e.target.value)} className="h-8 w-12 rounded cursor-pointer border-0" />
          <span className="text-xs text-muted-foreground">{bgColor}</span>
        </div>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} className="accent-primary" />
          배너 활성화
        </label>
        <Button className="w-full" size="sm" onClick={() => upsertMutation.mutate({ text, subText: subText || undefined, bgColor, isActive })} disabled={upsertMutation.isPending}>
          {upsertMutation.isPending ? "저장 중..." : "배너 저장"}
        </Button>
      </CardContent>
    </Card>
  );
}

const SURVEY_QUESTIONS: { id: string; question: string }[] = [
  { id: "q1", question: "가장 배우고 싶은 분야" },
  { id: "q2", question: "가장 어려운 부분" },
  { id: "q3", question: "현재 활동 형태" },
  { id: "q4", question: "향후 목표" },
  { id: "q5", question: "회원 관리 경험" },
  { id: "q6", question: "선호 교육 형태" },
  { id: "q7", question: "활동하고 싶은 분야" },
  { id: "q8", question: "회원 상담 경험" },
  { id: "q9", question: "SNS/개인 브랜딩 활동" },
  { id: "q10", question: "FIT STEP 기대 기능" },
];

function SurveyManager() {
  const { data: responses, isLoading } = trpc.admin.listSurveyResponses.useQuery();
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [filterQ, setFilterQ] = useState("");

  const filtered = filterQ
    ? responses?.filter(r => {
        const answers = Object.values(r.answers).flat().join(" ");
        return (r.trainerName ?? "").includes(filterQ) || answers.includes(filterQ);
      })
    : responses;

  // 항목별 집계
  const stats: Record<string, Record<string, number>> = {};
  responses?.forEach(r => {
    Object.entries(r.answers).forEach(([qId, opts]) => {
      if (!stats[qId]) stats[qId] = {};
      opts.forEach(o => { stats[qId][o] = (stats[qId][o] ?? 0) + 1; });
    });
  });

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-primary" />온보딩 설문 응답
          {responses && (
            <span className="ml-auto text-xs font-normal text-muted-foreground flex items-center gap-1">
              <Users className="h-3.5 w-3.5" />{responses.length}명 응답
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading && <p className="text-sm text-muted-foreground text-center py-4">불러오는 중...</p>}
        {!isLoading && (!responses || responses.length === 0) && (
          <p className="text-sm text-muted-foreground text-center py-4">아직 설문 응답이 없습니다.</p>
        )}

        {responses && responses.length > 0 && (
          <>
            {/* 집계 통계 */}
            <div className="space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">항목별 집계</p>
              {SURVEY_QUESTIONS.map(q => {
                const qStats = stats[q.id];
                if (!qStats) return null;
                const sorted = Object.entries(qStats).sort((a, b) => b[1] - a[1]);
                const total = sorted.reduce((s, [, v]) => s + v, 0);
                return (
                  <div key={q.id} className="space-y-1.5">
                    <p className="text-xs font-medium text-foreground">{q.question}</p>
                    <div className="space-y-1">
                      {sorted.slice(0, 5).map(([opt, cnt]) => (
                        <div key={opt} className="flex items-center gap-2">
                          <div className="flex-1 h-4 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary/60 rounded-full"
                              style={{ width: `${Math.round((cnt / total) * 100)}%` }}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground w-5 text-right shrink-0">{cnt}</span>
                          <span className="text-xs text-foreground truncate max-w-[140px]">{opt}</span>
                        </div>
                      ))}
                      {sorted.length > 5 && (
                        <p className="text-xs text-muted-foreground pl-1">+ {sorted.length - 5}개 항목 더 있음</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="border-t border-border pt-3 space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">개별 응답 목록</p>
              <Input
                value={filterQ}
                onChange={e => setFilterQ(e.target.value)}
                placeholder="이름 또는 응답 내용으로 검색..."
                className="h-8 text-xs bg-input border-border"
              />
              <div className="space-y-1 max-h-80 overflow-y-auto pr-1">
                {filtered?.map(r => (
                  <div key={r.id} className="rounded-lg border border-border bg-background">
                    <button
                      className="w-full flex items-center justify-between px-3 py-2.5 text-left"
                      onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}
                    >
                      <div>
                        <p className="text-sm font-medium">{r.trainerName ?? "이름 없음"}</p>
                        <p className="text-xs text-muted-foreground">{r.phone ?? r.email ?? ""} · {r.createdAt?.slice(0, 10)}</p>
                      </div>
                      {expandedId === r.id
                        ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
                        : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                      }
                    </button>
                    {expandedId === r.id && (
                      <div className="px-3 pb-3 space-y-2 border-t border-border">
                        {SURVEY_QUESTIONS.map(q => {
                          const ans = r.answers[q.id];
                          if (!ans || ans.length === 0) return null;
                          return (
                            <div key={q.id}>
                              <p className="text-xs text-muted-foreground mt-2">{q.question}</p>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {ans.map(a => (
                                  <span key={a} className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">{a}</span>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default function AdminNotices() {
  const utils = trpc.useUtils();
  const { data: notices } = trpc.notices.listAll.useQuery();
  const { data: surveyResponses } = trpc.admin.listSurveyResponses.useQuery();

  const [tab, setTab] = useState<"survey" | "banner" | "notice">("notice");
  const [creating, setCreating] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);

  const createMutation = trpc.notices.create.useMutation({
    onSuccess: () => { toast.success("공지 등록 완료"); setCreating(false); utils.notices.listAll.invalidate(); utils.notices.list.invalidate(); },
    onError: e => toast.error(e.message),
  });
  const updateMutation = trpc.notices.update.useMutation({
    onSuccess: () => { toast.success("수정 완료"); setEditId(null); utils.notices.listAll.invalidate(); utils.notices.list.invalidate(); },
    onError: e => toast.error(e.message),
  });
  const deleteMutation = trpc.notices.delete.useMutation({
    onSuccess: () => { toast.success("삭제 완료"); utils.notices.listAll.invalidate(); utils.notices.list.invalidate(); },
  });

  const TABS = [
    { key: "notice" as const, label: "공지사항", icon: Bell },
    { key: "banner" as const, label: "배너", icon: ExternalLink },
    { key: "survey" as const, label: "설문 응답", icon: ClipboardList, badge: surveyResponses?.length },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">공지사항 / 배너 관리</h1>
        <p className="text-sm text-muted-foreground mt-0.5">STEPER 앱에 표시되는 공지와 배너</p>
      </div>

      {/* 탭 */}
      <div className="flex gap-1 bg-muted/40 p-1 rounded-xl border border-border">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-medium rounded-lg transition-colors ${
              tab === t.key
                ? "bg-card shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <t.icon className="h-4 w-4 shrink-0" />
            {t.label}
            {t.badge != null && t.badge > 0 && (
              <span className="ml-0.5 text-xs bg-primary/20 text-primary px-1.5 py-0.5 rounded-full leading-none">
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === "survey" && <SurveyManager />}

      {tab === "banner" && (
        <>
          <TabBannerManager />
          <LegacyBannerManager />
        </>
      )}

      {tab === "notice" && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center justify-between">
              <span className="flex items-center gap-2"><Bell className="h-4 w-4 text-primary" />공지사항</span>
              <Button size="sm" variant="outline" className="gap-1.5 h-7 text-xs" onClick={() => { setCreating(true); setEditId(null); }}>
                <Plus className="h-3.5 w-3.5" />새 공지
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {creating && (
              <NoticeForm
                onSave={d => createMutation.mutate(d)}
                onCancel={() => setCreating(false)}
              />
            )}
            {(!notices || notices.length === 0) && !creating && (
              <p className="text-sm text-muted-foreground text-center py-4">공지사항이 없습니다.</p>
            )}
            {notices?.map(n => (
              <div key={n.id}>
                {editId === n.id ? (
                  <NoticeForm
                    initial={n}
                    onSave={d => updateMutation.mutate({ id: n.id, ...d })}
                    onCancel={() => setEditId(null)}
                  />
                ) : (
                  <div className={`p-3 rounded-lg border ${n.isActive ? "bg-accent/20 border-border" : "bg-accent/5 border-border/30 opacity-50"}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-1">
                          {n.isPinned && <Pin className="h-3 w-3 text-primary shrink-0" />}
                          {!n.isActive && <span className="text-xs text-muted-foreground">[비활성]</span>}
                          <p className="text-sm font-semibold truncate">{n.title}</p>
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2">{n.content}</p>
                        <p className="text-xs text-muted-foreground mt-1">{n.createdAt.slice(0, 10)}</p>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button onClick={() => setEditId(n.id)} className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground"><Pencil className="h-3.5 w-3.5" /></button>
                        <button onClick={() => deleteMutation.mutate({ id: n.id })} className="p-1.5 rounded hover:bg-red-500/10 text-muted-foreground hover:text-red-400"><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
