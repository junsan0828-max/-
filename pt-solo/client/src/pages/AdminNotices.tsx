import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Bell, Plus, Pencil, Trash2, Pin, ExternalLink, ImageIcon, X } from "lucide-react";
import { toast } from "sonner";

type Notice = { id: number; title: string; content: string; isPinned: boolean; isActive: boolean; createdAt: string };

const TAB_OPTIONS = [
  { key: "all",        label: "전체 (공통)" },
  { key: "dashboard",  label: "대시보드" },
  { key: "pt",         label: "PT 관리" },
  { key: "attendance", label: "출석 체크" },
  { key: "leads",      label: "상담관리" },
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
    onSuccess: () => { toast.success("배너 저장 완료"); utils.tabBanner.listAll.invalidate(); utils.tabBanner.getByTab.invalidate(); },
    onError: e => toast.error(e.message),
  });

  const [selectedTab, setSelectedTab] = useState("all");
  const [fields, setFields] = useState<Record<string, FieldState>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getField = (tabKey: string): FieldState => {
    if (fields[tabKey]) return fields[tabKey];
    const row = allBanners?.find(b => b.tabKey === tabKey);
    return {
      text: row?.text ?? "",
      subText: row?.subText ?? "",
      link: row?.link ?? "",
      bgColor: row?.bgColor ?? "#6366f1",
      isActive: row ? row.isActive === 1 : false,
      imageUrl: (row as any)?.imageUrl ?? "",
      bannerHeight: (row as any)?.bannerHeight ?? "medium",
      textSize: (row as any)?.textSize ?? "medium",
      textAlign: (row as any)?.textAlign ?? "left",
    };
  };

  const setField = (tabKey: string, patch: Partial<FieldState>) => {
    setFields(f => ({ ...f, [tabKey]: { ...getField(tabKey), ...patch } }));
  };

  const current = getField(selectedTab);
  const tabLabel = TAB_OPTIONS.find(t => t.key === selectedTab)?.label ?? "";

  const heightPx: Record<string, string> = { small: "56px", medium: "96px", large: "140px" };

  const handleImageFile = (file: File) => {
    if (file.size > 5 * 1024 * 1024) { toast.error("이미지는 5MB 이하로 업로드해주세요"); return; }
    const reader = new FileReader();
    reader.onload = (e) => {
      setField(selectedTab, { imageUrl: e.target?.result as string });
    };
    reader.readAsDataURL(file);
  };

  const handleSave = () => {
    if (!current.text.trim() && !current.imageUrl) {
      toast.error("배너 텍스트 또는 이미지를 입력해주세요"); return;
    }
    upsertMutation.mutate({
      tabKey: selectedTab,
      text: current.text,
      subText: current.subText || undefined,
      link: current.link || undefined,
      bgColor: current.bgColor,
      isActive: current.isActive,
      imageUrl: current.imageUrl || undefined,
      bannerHeight: current.bannerHeight,
      textSize: current.textSize,
      textAlign: current.textAlign,
    });
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <ExternalLink className="h-4 w-4 text-primary" />탭별 광고 배너
        </CardTitle>
        <p className="text-xs text-muted-foreground">탭마다 다른 배너를 설정하거나, "전체(공통)"으로 모든 탭에 같은 배너를 표시하세요</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 탭 선택 */}
        <div className="flex flex-wrap gap-1.5">
          {TAB_OPTIONS.map(t => {
            const row = allBanners?.find(b => b.tabKey === t.key);
            const hasActive = row?.isActive === 1 && ((row as any)?.text || (row as any)?.imageUrl);
            return (
              <button
                key={t.key}
                onClick={() => setSelectedTab(t.key)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors relative ${
                  selectedTab === t.key
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border text-muted-foreground hover:border-primary/40"
                }`}
              >
                {t.label}
                {hasActive && <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-emerald-400" />}
              </button>
            );
          })}
        </div>

        {/* 미리보기 */}
        <div className="rounded-xl overflow-hidden border border-border/40" style={{ height: heightPx[current.bannerHeight] ?? "96px" }}>
          {current.imageUrl ? (
            <img src={current.imageUrl} alt="미리보기" className="w-full h-full object-cover" />
          ) : current.text ? (
            <div
              className={`w-full h-full flex items-center gap-3 px-4 ${
                current.textAlign === "center" ? "justify-center text-center" : current.textAlign === "right" ? "justify-end text-right" : "justify-start text-left"
              }`}
              style={{ backgroundColor: current.bgColor }}
            >
              <div className="flex-1 min-w-0">
                <p className={`font-bold text-white line-clamp-2 leading-tight ${current.textSize === "large" ? "text-lg" : current.textSize === "small" ? "text-xs" : "text-sm"}`}>{current.text}</p>
                {current.subText && <p className="text-xs text-white/80 mt-0.5 line-clamp-2">{current.subText}</p>}
              </div>
              {current.link && <ExternalLink className="h-4 w-4 text-white/80 shrink-0" />}
            </div>
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-muted/30 text-xs text-muted-foreground">
              미리보기
            </div>
          )}
        </div>

        <div className="space-y-3">
          <p className="text-xs font-medium text-muted-foreground">{tabLabel} 배너 설정</p>

          {/* 배너 크기 */}
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">배너 크기</label>
            <div className="flex gap-2">
              {HEIGHT_OPTIONS.map(h => (
                <button
                  key={h.value}
                  onClick={() => setField(selectedTab, { bannerHeight: h.value })}
                  className={`flex-1 py-1.5 text-xs rounded-lg border transition-colors ${
                    current.bannerHeight === h.value
                      ? "bg-primary/20 border-primary/40 text-primary"
                      : "border-border text-muted-foreground hover:border-primary/30"
                  }`}
                >
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
                <button key={o.value} onClick={() => setField(selectedTab, { textSize: o.value })}
                  className={`flex-1 py-1.5 text-xs rounded-lg border transition-colors ${current.textSize === o.value ? "bg-primary/20 border-primary/40 text-primary" : "border-border text-muted-foreground hover:border-primary/30"}`}>
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
                <button key={o.value} onClick={() => setField(selectedTab, { textAlign: o.value })}
                  className={`flex-1 py-1.5 text-xs rounded-lg border transition-colors ${current.textAlign === o.value ? "bg-primary/20 border-primary/40 text-primary" : "border-border text-muted-foreground hover:border-primary/30"}`}>
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          {/* 이미지 업로드 */}
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">배너 이미지 (선택)</label>
            {current.imageUrl ? (
              <div className="flex items-center gap-2 p-2 rounded-lg border border-border bg-muted/20">
                <img src={current.imageUrl} alt="이미지" className="h-10 w-16 object-cover rounded" />
                <span className="text-xs text-muted-foreground flex-1">이미지 업로드됨</span>
                <button
                  onClick={() => setField(selectedTab, { imageUrl: "" })}
                  className="text-muted-foreground hover:text-red-400"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg border border-dashed border-border text-muted-foreground hover:border-primary/40 text-sm transition-colors"
              >
                <ImageIcon className="h-4 w-4 shrink-0" />
                이미지 파일 첨부 (JPG, PNG, GIF · 5MB 이하)
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleImageFile(f); e.target.value = ""; }}
            />
          </div>

          {/* 텍스트 (이미지 없을 때만) */}
          {!current.imageUrl && (
            <>
              <Input
                value={current.text}
                onChange={e => setField(selectedTab, { text: e.target.value })}
                placeholder="배너 텍스트 *"
                className="bg-input border-border"
              />
              <Input
                value={current.subText}
                onChange={e => setField(selectedTab, { subText: e.target.value })}
                placeholder="서브 텍스트 (선택)"
                className="bg-input border-border"
              />
              {/* 프리셋 디자인 */}
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">빠른 색상 선택</label>
                <div className="grid grid-cols-5 gap-1.5">
                  {[
                    { bg: "#2563eb", label: "블루" },
                    { bg: "#7c3aed", label: "퍼플" },
                    { bg: "#059669", label: "그린" },
                    { bg: "#dc2626", label: "레드" },
                    { bg: "#d97706", label: "오렌지" },
                    { bg: "#0891b2", label: "시안" },
                    { bg: "#be185d", label: "핑크" },
                    { bg: "#1e293b", label: "다크" },
                    { bg: "#374151", label: "그레이" },
                    { bg: "#1a3a6e", label: "네이비" },
                  ].map(p => (
                    <button
                      key={p.bg}
                      title={p.label}
                      onClick={() => setField(selectedTab, { bgColor: p.bg })}
                      className={`h-8 rounded-lg border-2 transition-all ${current.bgColor === p.bg ? "border-white scale-110" : "border-transparent"}`}
                      style={{ backgroundColor: p.bg }}
                    />
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <label className="text-xs text-muted-foreground shrink-0">직접 입력</label>
                <input
                  type="color"
                  value={current.bgColor}
                  onChange={e => setField(selectedTab, { bgColor: e.target.value })}
                  className="h-8 w-12 rounded cursor-pointer border-0"
                />
                <span className="text-xs text-muted-foreground">{current.bgColor}</span>
              </div>
            </>
          )}

          <Input
            value={current.link}
            onChange={e => setField(selectedTab, { link: e.target.value })}
            placeholder="링크 URL (선택)"
            className="bg-input border-border"
          />

          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={current.isActive}
              onChange={e => setField(selectedTab, { isActive: e.target.checked })}
              className="accent-primary"
            />
            배너 활성화
          </label>
          <Button
            className="w-full"
            size="sm"
            onClick={handleSave}
            disabled={upsertMutation.isPending}
          >
            {upsertMutation.isPending ? "저장 중..." : `"${tabLabel}" 배너 저장`}
          </Button>
        </div>
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

export default function AdminNotices() {
  const utils = trpc.useUtils();
  const { data: notices } = trpc.notices.listAll.useQuery();

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">공지사항 / 배너 관리</h1>
        <p className="text-sm text-muted-foreground mt-0.5">트레이너 앱에 표시되는 공지와 배너</p>
      </div>

      <TabBannerManager />
      <LegacyBannerManager />

      {/* 공지사항 */}
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
    </div>
  );
}
