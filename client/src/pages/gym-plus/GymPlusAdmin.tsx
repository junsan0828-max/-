// @ts-nocheck
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs } from "@/components/ui/tabs";

// ─── 회원 관리 ────────────────────────────────────────────────────────────────
export function GymPlusMembersAdmin() {
  const utils = trpc.useUtils();
  const { data: mainMembers, isLoading } = trpc.gymPlus.admin_listMainMembers.useQuery();
  const [linkTarget, setLinkTarget] = useState<{ id: number; name: string; phone?: string | null; membershipStart?: string | null; membershipEnd?: string | null } | null>(null);
  const [editTarget, setEditTarget] = useState<{ gymPlusId: number; name: string } | null>(null);
  const [linkForm, setLinkForm] = useState({ membershipType: "general" as "general" | "premium" | "vip", membershipStart: "", membershipEnd: "" });
  const [editForm, setEditForm] = useState({ password: "", membershipType: "general" as "general" | "premium" | "vip", membershipStart: "", membershipEnd: "", isActive: 1 });

  const createLinkedMutation = trpc.gymPlus.admin_createLinkedMember.useMutation({
    onSuccess: () => { utils.gymPlus.admin_listMainMembers.invalidate(); setLinkTarget(null); toast.success("짐플러스 계정이 생성되었습니다."); },
    onError: (err) => toast.error(err.message),
  });

  const updateMutation = trpc.gymPlus.admin_updateMember.useMutation({
    onSuccess: () => { utils.gymPlus.admin_listMainMembers.invalidate(); setEditTarget(null); toast.success("수정되었습니다."); },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = trpc.gymPlus.admin_deleteMember.useMutation({
    onSuccess: () => { utils.gymPlus.admin_listMainMembers.invalidate(); toast.success("계정이 삭제되었습니다."); },
    onError: (err) => toast.error(err.message),
  });


  const connectedCount = mainMembers?.filter(m => m.gymPlus).length ?? 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-muted-foreground">
          전체 회원 ({mainMembers?.length ?? 0}명) · 짐+ 연동 {connectedCount}명
        </p>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground text-center py-6">불러오는 중...</p>
      ) : mainMembers?.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">등록된 회원이 없습니다</p>
      ) : (
        <div className="space-y-2">
          {mainMembers?.map((m) => (
            <div key={m.id} className="bg-card border border-border rounded-xl px-3 py-2.5">
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold">{m.name}</p>
                    {m.gymPlus ? (
                      <span className="text-[9px] bg-primary/20 text-primary px-1.5 py-0.5 rounded-full font-medium">짐+ 연동</span>
                    ) : (
                      <span className="text-[9px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">미연동</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {m.phone ?? "연락처 없음"}
                    {m.gymPlus && <span className="ml-2 text-primary/70">@{m.gymPlus.username}</span>}
                  </p>
                  {m.membershipEnd && (
                    <p className="text-xs text-muted-foreground">회원권 만료: {m.membershipEnd.slice(0, 10)}</p>
                  )}
                </div>
                <div className="flex gap-1.5 flex-shrink-0 ml-2">
                  {m.gymPlus ? (
                    <Button variant="destructive" size="sm" className="h-7 text-[10px] px-2"
                      onClick={() => { if (confirm(`${m.name}의 짐플러스 계정을 삭제하시겠습니까?`)) deleteMutation.mutate({ id: m.gymPlus!.id }); }}>삭제</Button>
                  ) : (
                    <Button size="sm" className="h-7 text-[10px] px-2"
                      onClick={() => {
                        setLinkTarget({ id: m.id, name: m.name, phone: m.phone, membershipStart: m.membershipStart, membershipEnd: m.membershipEnd });
                        setLinkForm({ membershipType: "general", membershipStart: m.membershipStart ?? "", membershipEnd: m.membershipEnd ?? "" });
                      }}>계정 생성</Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 짐플러스 계정 생성 다이얼로그 */}
      <Dialog open={!!linkTarget} onOpenChange={(o) => { if (!o) setLinkTarget(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{linkTarget?.name} — 짐플러스 계정 생성</DialogTitle></DialogHeader>
          <div className="space-y-3 pb-2">
            {/* 자동 설정 안내 */}
            <div className="bg-muted/60 rounded-xl p-3 space-y-1">
              <p className="text-xs font-semibold">자동 설정 정보</p>
              <p className="text-xs text-muted-foreground">아이디: <span className="text-foreground font-medium">{linkTarget?.phone ?? "전화번호 없음"}</span></p>
              <p className="text-xs text-muted-foreground">비밀번호: <span className="text-foreground font-medium">전화번호 뒷자리 4자리</span></p>
            </div>
            {!linkTarget?.phone && (
              <p className="text-xs text-red-400">전화번호가 없는 회원입니다. 통합관리에서 먼저 등록해주세요.</p>
            )}
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">회원권 유형</Label>
              <Select value={linkForm.membershipType} onValueChange={(v) => setLinkForm(p => ({ ...p, membershipType: v as any }))}>
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="general">일반</SelectItem>
                  <SelectItem value="premium">프리미엄</SelectItem>
                  <SelectItem value="vip">VIP</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">시작일</Label>
                <Input type="date" value={linkForm.membershipStart} onChange={(e) => setLinkForm(p => ({ ...p, membershipStart: e.target.value }))} className="h-8 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">만료일</Label>
                <Input type="date" value={linkForm.membershipEnd} onChange={(e) => setLinkForm(p => ({ ...p, membershipEnd: e.target.value }))} className="h-8 text-sm" />
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1 h-8 text-sm" onClick={() => setLinkTarget(null)}>취소</Button>
              <Button className="flex-1 h-8 text-sm" disabled={createLinkedMutation.isPending || !linkTarget?.phone}
                onClick={() => {
                  createLinkedMutation.mutate({ memberId: linkTarget!.id, membershipType: linkForm.membershipType, membershipStart: linkForm.membershipStart || undefined, membershipEnd: linkForm.membershipEnd || undefined });
                }}>
                {createLinkedMutation.isPending ? "생성 중..." : "계정 생성"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 짐플러스 계정 수정 다이얼로그 */}
      <Dialog open={!!editTarget} onOpenChange={(o) => { if (!o) setEditTarget(null); }}>
        <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editTarget?.name} — 짐플러스 계정 수정</DialogTitle></DialogHeader>
          <div className="space-y-3 pb-2">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">새 비밀번호 (변경 시에만)</Label>
              <Input type="password" value={editForm.password} onChange={(e) => setEditForm(p => ({ ...p, password: e.target.value }))} className="h-8 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">회원권 유형</Label>
              <Select value={editForm.membershipType} onValueChange={(v) => setEditForm(p => ({ ...p, membershipType: v as any }))}>
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="general">일반</SelectItem>
                  <SelectItem value="premium">프리미엄</SelectItem>
                  <SelectItem value="vip">VIP</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">시작일</Label>
                <Input type="date" value={editForm.membershipStart} onChange={(e) => setEditForm(p => ({ ...p, membershipStart: e.target.value }))} className="h-8 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">만료일</Label>
                <Input type="date" value={editForm.membershipEnd} onChange={(e) => setEditForm(p => ({ ...p, membershipEnd: e.target.value }))} className="h-8 text-sm" />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">계정 상태</Label>
              <Select value={String(editForm.isActive)} onValueChange={(v) => setEditForm(p => ({ ...p, isActive: parseInt(v) }))}>
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">활성</SelectItem>
                  <SelectItem value="0">비활성</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1 h-8 text-sm" onClick={() => setEditTarget(null)}>취소</Button>
              <Button className="flex-1 h-8 text-sm" disabled={updateMutation.isPending}
                onClick={() => {
                  updateMutation.mutate({ id: editTarget!.gymPlusId, membershipType: editForm.membershipType, membershipStart: editForm.membershipStart || undefined, membershipEnd: editForm.membershipEnd || undefined, isActive: editForm.isActive, password: editForm.password || undefined });
                }}>
                {updateMutation.isPending ? "저장 중..." : "저장"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── 영상 관리 ────────────────────────────────────────────────────────────────
function getYoutubeEmbed(url: string) {
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([^&\n?#]+)/);
  return m ? `https://www.youtube.com/embed/${m[1]}?rel=0` : null;
}

export function GymPlusVideosAdmin() {
  const utils = trpc.useUtils();
  const { data: videos } = trpc.gymPlus.admin_listVideos.useQuery();
  const { data: categories } = trpc.gymPlus.admin_listCategories.useQuery();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [newCatName, setNewCatName] = useState("");
  const [selectedVideo, setSelectedVideo] = useState<any | null>(null);
  const [detailDesc, setDetailDesc] = useState("");
  const [form, setForm] = useState({
    title: "", description: "", videoUrl: "", thumbnailUrl: "", duration: "",
    level: "beginner" as "beginner" | "intermediate" | "advanced",
    bodyPart: "", categoryId: "", isPublished: "1", sortOrder: "0",
  });

  const createMutation = trpc.gymPlus.admin_createVideo.useMutation({
    onSuccess: () => { utils.gymPlus.admin_listVideos.invalidate(); setShowForm(false); resetForm(); toast.success("영상이 추가되었습니다."); },
    onError: (err) => toast.error(err.message),
  });

  const updateMutation = trpc.gymPlus.admin_updateVideo.useMutation({
    onSuccess: () => {
      utils.gymPlus.admin_listVideos.invalidate();
      setShowForm(false); setEditingId(null); resetForm();
      toast.success("저장되었습니다.");
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = trpc.gymPlus.admin_deleteVideo.useMutation({
    onSuccess: () => { utils.gymPlus.admin_listVideos.invalidate(); toast.success("영상이 삭제되었습니다."); },
    onError: (err) => toast.error(err.message),
  });

  const createCatMutation = trpc.gymPlus.admin_createCategory.useMutation({
    onSuccess: () => { utils.gymPlus.admin_listCategories.invalidate(); setNewCatName(""); toast.success("카테고리가 추가되었습니다."); },
    onError: (err) => toast.error(err.message),
  });

  const deleteCatMutation = trpc.gymPlus.admin_deleteCategory.useMutation({
    onSuccess: () => { utils.gymPlus.admin_listCategories.invalidate(); toast.success("카테고리가 삭제되었습니다."); },
    onError: (err) => toast.error(err.message),
  });

  function resetForm() {
    setForm({ title: "", description: "", videoUrl: "", thumbnailUrl: "", duration: "", level: "beginner", bodyPart: "", categoryId: "", isPublished: "1", sortOrder: "0" });
  }

  function openEdit(v: any) {
    setForm({ title: v.title, description: v.description ?? "", videoUrl: v.videoUrl, thumbnailUrl: v.thumbnailUrl ?? "", duration: v.duration ?? "", level: v.level, bodyPart: v.bodyPart ?? "", categoryId: v.categoryId?.toString() ?? "", isPublished: v.isPublished.toString(), sortOrder: v.sortOrder.toString() });
    setEditingId(v.id);
    setShowForm(true);
  }

  function handleSubmit() {
    const data = {
      ...form,
      categoryId: form.categoryId ? parseInt(form.categoryId) : undefined,
      isPublished: parseInt(form.isPublished),
      sortOrder: parseInt(form.sortOrder) || 0,
      duration: form.duration ? parseInt(form.duration) || undefined : undefined,
    };
    if (!data.title || !data.videoUrl) { toast.error("제목과 영상 URL은 필수입니다."); return; }
    if (editingId) {
      updateMutation.mutate({ id: editingId, ...data });
    } else {
      createMutation.mutate(data);
    }
  }

  const levelLabel: Record<string, string> = { beginner: "초급", intermediate: "중급", advanced: "고급" };

  const videoFormDialog = (
    <Dialog open={showForm} onOpenChange={(o) => { setShowForm(o); if (!o) { setEditingId(null); resetForm(); } }}>
      <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{editingId ? "영상 수정" : "영상 추가"}</DialogTitle></DialogHeader>
        <div className="space-y-3 pb-2">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">제목 *</Label>
            <Input value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} className="h-8 text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">영상 URL (YouTube 또는 직접) *</Label>
            <Input placeholder="https://youtube.com/watch?v=..." value={form.videoUrl} onChange={(e) => setForm((p) => ({ ...p, videoUrl: e.target.value }))} className="h-8 text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">썸네일 URL</Label>
            <Input value={form.thumbnailUrl} onChange={(e) => setForm((p) => ({ ...p, thumbnailUrl: e.target.value }))} className="h-8 text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">카테고리</Label>
              <Select value={form.categoryId || "none"} onValueChange={(v) => setForm((p) => ({ ...p, categoryId: v === "none" ? "" : v }))}>
                <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="선택" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">없음</SelectItem>
                  {categories?.map((c) => <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">난이도</Label>
              <Select value={form.level} onValueChange={(v) => setForm((p) => ({ ...p, level: v as any }))}>
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="beginner">초급</SelectItem>
                  <SelectItem value="intermediate">중급</SelectItem>
                  <SelectItem value="advanced">고급</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">운동부위</Label>
              <Input placeholder="가슴" value={form.bodyPart} onChange={(e) => setForm((p) => ({ ...p, bodyPart: e.target.value }))} className="h-8 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">길이</Label>
              <Input placeholder="10:30" value={form.duration} onChange={(e) => setForm((p) => ({ ...p, duration: e.target.value }))} className="h-8 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">공개</Label>
              <Select value={form.isPublished} onValueChange={(v) => setForm((p) => ({ ...p, isPublished: v }))}>
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">공개</SelectItem>
                  <SelectItem value="0">비공개</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <Button variant="outline" className="flex-1 h-8 text-sm" onClick={() => setShowForm(false)}>취소</Button>
            <Button className="flex-1 h-8 text-sm" onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending}>
              {createMutation.isPending || updateMutation.isPending ? "저장 중..." : "저장"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );

  /* ── 영상 상세 뷰 ── */
  if (selectedVideo) {
    const embedUrl = getYoutubeEmbed(selectedVideo.videoUrl);
    return (
      <div className="space-y-4">
        {/* 헤더 */}
        <div className="flex items-center gap-2">
          <button onClick={() => setSelectedVideo(null)} className="text-muted-foreground text-sm px-1">← 목록</button>
          <p className="text-sm font-semibold flex-1 line-clamp-1">{selectedVideo.title}</p>
          <Button variant="outline" size="sm" className="h-7 text-[10px] px-2" onClick={() => openEdit(selectedVideo)}>수정</Button>
          <Button variant="destructive" size="sm" className="h-7 text-[10px] px-2" onClick={() => { if (confirm("삭제?")) { deleteMutation.mutate({ id: selectedVideo.id }); setSelectedVideo(null); } }}>삭제</Button>
        </div>

        {/* 영상 플레이어 */}
        <div className="w-full bg-black aspect-video rounded-xl overflow-hidden">
          {embedUrl ? (
            <iframe src={embedUrl} className="w-full h-full" allowFullScreen allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" />
          ) : (
            <video src={selectedVideo.videoUrl} controls className="w-full h-full" playsInline />
          )}
        </div>

        {/* 메타 정보 */}
        <div className="flex gap-2 flex-wrap">
          <span className="text-[10px] bg-muted px-2 py-0.5 rounded-full">{levelLabel[selectedVideo.level ?? "beginner"]}</span>
          {selectedVideo.bodyPart && <span className="text-[10px] bg-muted px-2 py-0.5 rounded-full">{selectedVideo.bodyPart}</span>}
          <span className="text-[10px] bg-muted px-2 py-0.5 rounded-full">{selectedVideo.isPublished ? "공개" : "비공개"}</span>
        </div>

        {/* 운동 방법 소개글 */}
        <div className="space-y-2">
          <p className="text-xs font-semibold">운동 방법 소개</p>
          <textarea
            value={detailDesc}
            onChange={(e) => setDetailDesc(e.target.value)}
            rows={8}
            placeholder="운동 방법, 주의사항, 세트/횟수 안내 등을 입력하세요..."
            className="w-full bg-input border border-border rounded-xl p-3 text-sm text-foreground resize-none leading-relaxed"
          />
          <Button
            className="w-full h-9 text-sm"
            disabled={updateMutation.isPending}
            onClick={() => {
              const data = {
                id: selectedVideo.id,
                title: selectedVideo.title,
                videoUrl: selectedVideo.videoUrl,
                description: detailDesc,
                isPublished: selectedVideo.isPublished,
                sortOrder: selectedVideo.sortOrder ?? 0,
                level: selectedVideo.level,
                thumbnailUrl: selectedVideo.thumbnailUrl ?? undefined,
                bodyPart: selectedVideo.bodyPart ?? undefined,
                categoryId: selectedVideo.categoryId ?? undefined,
                duration: selectedVideo.duration ?? undefined,
              };
              updateMutation.mutate(data);
            }}
          >
            {updateMutation.isPending ? "저장 중..." : "저장"}
          </Button>
        </div>

        {/* 수정 다이얼로그 */}
        {videoFormDialog}
      </div>
    );
  }

  /* ── 영상 목록 뷰 ── */
  return (
    <div className="space-y-4">
      {/* 카테고리 */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground mb-2">카테고리 관리</p>
        <div className="flex gap-2 flex-wrap mb-2">
          {categories?.map((c) => (
            <div key={c.id} className="flex items-center gap-1 bg-muted px-2 py-1 rounded-full">
              <span className="text-xs">{c.name}</span>
              <button onClick={() => deleteCatMutation.mutate({ id: c.id })} className="text-red-400 text-[10px]">✕</button>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <Input placeholder="카테고리명" value={newCatName} onChange={(e) => setNewCatName(e.target.value)} className="h-7 text-xs flex-1" />
          <Button size="sm" className="h-7 text-xs" onClick={() => { if (newCatName) createCatMutation.mutate({ name: newCatName }); }}>추가</Button>
        </div>
      </div>

      {/* 영상 목록 */}
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-muted-foreground">영상 목록 ({videos?.length ?? 0}개)</p>
        <Button size="sm" className="h-7 text-xs" onClick={() => { resetForm(); setEditingId(null); setShowForm(true); }}>+ 영상 추가</Button>
      </div>

      <div className="space-y-2">
        {videos?.map((v) => (
          <button
            key={v.id}
            className="w-full flex items-center gap-3 bg-background/50 rounded-xl p-3 text-left"
            onClick={() => { setSelectedVideo(v); setDetailDesc(v.description ?? ""); }}
          >
            <div className="w-12 h-8 rounded overflow-hidden flex-shrink-0 bg-muted flex items-center justify-center text-xs relative">
              {v.thumbnailUrl
                ? <img src={v.thumbnailUrl} alt={v.title} className="w-full h-full object-cover" />
                : <span>▶</span>
              }
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium line-clamp-1">{v.title}</p>
              <p className="text-[10px] text-muted-foreground">{levelLabel[v.level ?? "beginner"]} · {v.isPublished ? "공개" : "비공개"}</p>
            </div>
            <span className="text-muted-foreground text-xs">›</span>
          </button>
        ))}
        {!videos?.length && <p className="text-xs text-muted-foreground text-center py-4">등록된 영상이 없습니다</p>}
      </div>

      {videoFormDialog}
    </div>
  );
}

// ─── 이벤트/공지 관리 ─────────────────────────────────────────────────────────
export function GymPlusEventsAdmin() {
  const utils = trpc.useUtils();
  const { data: events } = trpc.gymPlus.admin_listEvents.useQuery();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({
    title: "", content: "", imageUrl: "",
    eventType: "notice" as "notice" | "event" | "promotion",
    startDate: "", endDate: "", isPublished: "1", isPinned: "0",
  });

  const createMutation = trpc.gymPlus.admin_createEvent.useMutation({
    onSuccess: () => { utils.gymPlus.admin_listEvents.invalidate(); setShowForm(false); resetForm(); toast.success("이벤트/공지가 등록되었습니다."); },
    onError: (err) => toast.error(err.message),
  });

  const updateMutation = trpc.gymPlus.admin_updateEvent.useMutation({
    onSuccess: () => { utils.gymPlus.admin_listEvents.invalidate(); setShowForm(false); setEditingId(null); resetForm(); toast.success("이벤트/공지가 수정되었습니다."); },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = trpc.gymPlus.admin_deleteEvent.useMutation({
    onSuccess: () => { utils.gymPlus.admin_listEvents.invalidate(); toast.success("삭제되었습니다."); },
    onError: (err) => toast.error(err.message),
  });

  function resetForm() {
    setForm({ title: "", content: "", imageUrl: "", eventType: "notice", startDate: "", endDate: "", isPublished: "1", isPinned: "0" });
  }

  function openEdit(e: any) {
    setForm({ title: e.title, content: e.content, imageUrl: e.imageUrl ?? "", eventType: e.eventType, startDate: e.startDate ?? "", endDate: e.endDate ?? "", isPublished: e.isPublished.toString(), isPinned: e.isPinned.toString() });
    setEditingId(e.id);
    setShowForm(true);
  }

  function handleSubmit() {
    if (!form.title || !form.content) { toast.error("제목과 내용은 필수입니다."); return; }
    const data = { ...form, isPublished: parseInt(form.isPublished), isPinned: parseInt(form.isPinned), startDate: form.startDate || undefined, endDate: form.endDate || undefined, imageUrl: form.imageUrl || undefined };
    if (editingId) {
      updateMutation.mutate({ id: editingId, ...data });
    } else {
      createMutation.mutate(data);
    }
  }

  const typeLabel: Record<string, string> = { notice: "📢 공지", event: "🎉 이벤트", promotion: "🎁 프로모션" };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-muted-foreground">이벤트/공지 ({events?.length ?? 0}개)</p>
        <Button size="sm" className="h-7 text-xs" onClick={() => { resetForm(); setEditingId(null); setShowForm(true); }}>+ 등록</Button>
      </div>

      <div className="space-y-2">
        {events?.map((e) => (
          <div key={e.id} className="flex items-center gap-3 bg-background/50 rounded-xl p-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="text-[10px] text-muted-foreground">{typeLabel[e.eventType ?? "notice"] ?? e.eventType}</span>
                {e.isPinned ? <span className="text-[9px] bg-yellow-500/20 text-yellow-400 px-1 rounded">고정</span> : null}
                {!e.isPublished ? <span className="text-[9px] bg-muted text-muted-foreground px-1 rounded">비공개</span> : null}
              </div>
              <p className="text-xs font-medium line-clamp-1">{e.title}</p>
              <p className="text-[10px] text-muted-foreground">{e.createdAt?.slice(0, 10)}</p>
            </div>
            <div className="flex gap-1.5 flex-shrink-0">
              <Button variant="outline" size="sm" className="h-6 text-[10px] px-2" onClick={() => openEdit(e)}>수정</Button>
              <Button variant="destructive" size="sm" className="h-6 text-[10px] px-2" onClick={() => { if (confirm("삭제?")) deleteMutation.mutate({ id: e.id }); }}>삭제</Button>
            </div>
          </div>
        ))}
        {!events?.length && <p className="text-xs text-muted-foreground text-center py-4">등록된 이벤트/공지가 없습니다</p>}
      </div>

      <Dialog open={showForm} onOpenChange={(o) => { setShowForm(o); if (!o) { setEditingId(null); resetForm(); } }}>
        <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingId ? "이벤트/공지 수정" : "이벤트/공지 등록"}</DialogTitle></DialogHeader>
          <div className="space-y-3 pb-2">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">유형</Label>
              <Select value={form.eventType} onValueChange={(v) => setForm((p) => ({ ...p, eventType: v as any }))}>
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="notice">공지</SelectItem>
                  <SelectItem value="event">이벤트</SelectItem>
                  <SelectItem value="promotion">프로모션</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">제목 *</Label>
              <Input value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} className="h-8 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">내용 *</Label>
              <textarea value={form.content} onChange={(e) => setForm((p) => ({ ...p, content: e.target.value }))} rows={4} className="w-full bg-input border border-border rounded-lg p-2 text-sm text-foreground resize-none" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">이미지 URL</Label>
              <Input value={form.imageUrl} onChange={(e) => setForm((p) => ({ ...p, imageUrl: e.target.value }))} className="h-8 text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">시작일</Label>
                <Input type="date" value={form.startDate} onChange={(e) => setForm((p) => ({ ...p, startDate: e.target.value }))} className="h-8 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">종료일</Label>
                <Input type="date" value={form.endDate} onChange={(e) => setForm((p) => ({ ...p, endDate: e.target.value }))} className="h-8 text-sm" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">공개여부</Label>
                <Select value={form.isPublished} onValueChange={(v) => setForm((p) => ({ ...p, isPublished: v }))}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="1">공개</SelectItem><SelectItem value="0">비공개</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">고정여부</Label>
                <Select value={form.isPinned} onValueChange={(v) => setForm((p) => ({ ...p, isPinned: v }))}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="0">일반</SelectItem><SelectItem value="1">고정</SelectItem></SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1 h-8 text-sm" onClick={() => setShowForm(false)}>취소</Button>
              <Button className="flex-1 h-8 text-sm" onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending}>
                {createMutation.isPending || updateMutation.isPending ? "저장 중..." : "저장"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── 운동기록 관리 ────────────────────────────────────────────────────────────
export function GymPlusWorkoutLogsAdmin() {
  const utils = trpc.useUtils();
  const { data: logs, isLoading } = trpc.gymPlus.admin_listWorkoutLogs.useQuery({});

  const deleteMutation = trpc.gymPlus.admin_deleteWorkoutLog.useMutation({
    onSuccess: () => { utils.gymPlus.admin_listWorkoutLogs.invalidate(); toast.success("삭제되었습니다."); },
    onError: (err) => toast.error(err.message),
  });

  const moodLabel: Record<string, string> = { great: "😄 최상", good: "🙂 좋음", okay: "😐 보통", tired: "😫 피곤", bad: "😞 나쁨" };

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold text-muted-foreground">전체 운동기록 ({logs?.length ?? 0}건)</p>
      {isLoading ? (
        <p className="text-sm text-muted-foreground text-center py-4">불러오는 중...</p>
      ) : !logs?.length ? (
        <p className="text-sm text-muted-foreground text-center py-4">운동기록이 없습니다</p>
      ) : (
        <div className="space-y-2">
          {logs.map((log) => (
            <div key={log.id} className="flex items-center gap-3 bg-background/50 rounded-xl p-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="text-xs font-semibold text-primary">{log.memberName ?? "알 수 없음"}</p>
                  <p className="text-[10px] text-muted-foreground">{log.logDate}</p>
                </div>
                <p className="text-xs font-medium line-clamp-1">{log.title || "운동 기록"}</p>
                <p className="text-[10px] text-muted-foreground">
                  {log.durationMinutes ? `${log.durationMinutes}분` : ""}
                  {log.durationMinutes && log.caloriesBurned ? " · " : ""}
                  {log.caloriesBurned ? `${log.caloriesBurned}kcal` : ""}
                  {log.mood ? ` · ${moodLabel[log.mood] ?? log.mood}` : ""}
                </p>
              </div>
              <Button
                variant="destructive" size="sm" className="h-6 text-[10px] px-2 flex-shrink-0"
                onClick={() => { if (confirm("삭제?")) deleteMutation.mutate({ id: log.id }); }}
              >삭제</Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── 메인 어드민 짐+ 섹션 ─────────────────────────────────────────────────────
function GymPlusRenewalsAdmin() {
  const utils = trpc.useUtils();
  const { data: renewals, isLoading } = trpc.gymPlus.admin_listRenewals.useQuery({ status: "all" });
  const [approveTarget, setApproveTarget] = useState<{ id: number; memberName: string; currentEnd: string | null } | null>(null);
  const [newEnd, setNewEnd] = useState("");
  const [adminNote, setAdminNote] = useState("");

  const approveMutation = trpc.gymPlus.admin_approveRenewal.useMutation({
    onSuccess: () => { utils.gymPlus.admin_listRenewals.invalidate(); setApproveTarget(null); setNewEnd(""); setAdminNote(""); toast.success("승인되었습니다."); },
    onError: (e) => toast.error(e.message),
  });
  const rejectMutation = trpc.gymPlus.admin_rejectRenewal.useMutation({
    onSuccess: () => { utils.gymPlus.admin_listRenewals.invalidate(); toast.success("거절되었습니다."); },
    onError: (e) => toast.error(e.message),
  });

  const pending = renewals?.filter(r => r.renewal.status === "pending") ?? [];
  const done = renewals?.filter(r => r.renewal.status !== "pending") ?? [];

  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold text-muted-foreground">대기 중 {pending.length}건</p>
      {isLoading && <p className="text-sm text-muted-foreground text-center py-6">불러오는 중...</p>}
      {pending.length === 0 && !isLoading && (
        <p className="text-sm text-muted-foreground text-center py-6">대기 중인 신청이 없습니다.</p>
      )}
      {pending.map(r => (
        <div key={r.renewal.id} className="bg-card border border-yellow-500/30 rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-sm">{r.memberName ?? "-"}</p>
              <p className="text-xs text-muted-foreground">{r.memberPhone} · 현재 만료 {r.membershipEnd?.slice(0, 10) ?? "-"}</p>
            </div>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-yellow-500/15 text-yellow-400 border border-yellow-500/30">대기중</span>
          </div>
          {r.renewal.memo && <p className="text-xs text-muted-foreground bg-muted/40 rounded-lg px-3 py-2">메모: {r.renewal.memo}</p>}
          <p className="text-[10px] text-muted-foreground">{r.renewal.requestedAt?.slice(0, 16).replace("T", " ")} 신청</p>
          <div className="flex gap-2 pt-1">
            <button onClick={() => rejectMutation.mutate({ id: r.renewal.id })} disabled={rejectMutation.isPending}
              className="flex-1 py-2 rounded-xl border border-border text-sm text-muted-foreground hover:text-red-400 hover:border-red-400/40">거절</button>
            <button onClick={() => { setApproveTarget({ id: r.renewal.id, memberName: r.memberName ?? "", currentEnd: r.membershipEnd }); setNewEnd(r.membershipEnd ?? ""); }}
              className="flex-1 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold">승인</button>
          </div>
        </div>
      ))}

      {done.length > 0 && (
        <div className="space-y-2 pt-2">
          <p className="text-xs text-muted-foreground font-semibold">처리 완료</p>
          {done.map(r => (
            <div key={r.renewal.id} className="bg-card border border-border rounded-xl p-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{r.memberName}</p>
                <p className="text-xs text-muted-foreground">{r.renewal.processedAt?.slice(0, 10)}</p>
              </div>
              <span className={`text-[11px] px-2 py-0.5 rounded-full border ${r.renewal.status === "approved" ? "bg-green-500/10 text-green-400 border-green-500/30" : "bg-red-500/10 text-red-400 border-red-500/30"}`}>
                {r.renewal.status === "approved" ? `승인 (→${r.renewal.newMembershipEnd?.slice(0, 10)})` : "거절"}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* 승인 다이얼로그 */}
      <Dialog open={!!approveTarget} onOpenChange={(o) => { if (!o) setApproveTarget(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{approveTarget?.memberName} — 재등록 승인</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">연장 후 만료일</Label>
              <Input type="date" value={newEnd} onChange={e => setNewEnd(e.target.value)} className="h-8 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">관리자 메모 (선택)</Label>
              <Input value={adminNote} onChange={e => setAdminNote(e.target.value)} placeholder="메모 입력" className="h-8 text-sm" />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 h-8 text-sm" onClick={() => setApproveTarget(null)}>취소</Button>
              <Button className="flex-1 h-8 text-sm" disabled={!newEnd || approveMutation.isPending}
                onClick={() => approveMutation.mutate({ id: approveTarget!.id, newMembershipEnd: newEnd, adminNote: adminNote || undefined })}>
                {approveMutation.isPending ? "승인 중..." : "승인"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

type GymPlusTab = "members" | "renewals" | "videos" | "events" | "logs";

export default function GymPlusAdminSection() {
  const [activeTab, setActiveTab] = useState<GymPlusTab>("members");
  const { data: pendingRenewals } = trpc.gymPlus.admin_listRenewals.useQuery({ status: "pending" });
  const pendingCount = pendingRenewals?.length ?? 0;

  const tabs: { key: GymPlusTab; label: string }[] = [
    { key: "members", label: "회원" },
    { key: "renewals", label: "재등록 신청" },
    { key: "videos", label: "운동영상" },
    { key: "events", label: "이벤트/공지" },
    { key: "logs", label: "운동기록" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex gap-1 bg-muted p-1 rounded-xl overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`relative flex-1 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
              activeTab === tab.key ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
            }`}
          >
            {tab.label}
            {tab.key === "renewals" && pendingCount > 0 && (
              <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-red-500 text-[10px] text-white flex items-center justify-center">{pendingCount}</span>
            )}
          </button>
        ))}
      </div>

      {activeTab === "members" && <GymPlusMembersAdmin />}
      {activeTab === "renewals" && <GymPlusRenewalsAdmin />}
      {activeTab === "videos" && <GymPlusVideosAdmin />}
      {activeTab === "events" && <GymPlusEventsAdmin />}
      {activeTab === "logs" && <GymPlusWorkoutLogsAdmin />}
    </div>
  );
}
