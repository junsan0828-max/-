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
  const { data: members, isLoading } = trpc.gymPlus.admin_listMembers.useQuery();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({
    username: "", password: "", name: "", phone: "", email: "",
    membershipType: "general" as "general" | "premium" | "vip",
    membershipStart: "", membershipEnd: "",
  });

  const createMutation = trpc.gymPlus.admin_createMember.useMutation({
    onSuccess: () => { utils.gymPlus.admin_listMembers.invalidate(); setShowForm(false); resetForm(); toast.success("회원이 생성되었습니다."); },
    onError: (err) => toast.error(err.message),
  });

  const updateMutation = trpc.gymPlus.admin_updateMember.useMutation({
    onSuccess: () => { utils.gymPlus.admin_listMembers.invalidate(); setShowForm(false); setEditingId(null); resetForm(); toast.success("회원 정보가 수정되었습니다."); },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = trpc.gymPlus.admin_deleteMember.useMutation({
    onSuccess: () => { utils.gymPlus.admin_listMembers.invalidate(); toast.success("회원이 삭제되었습니다."); },
    onError: (err) => toast.error(err.message),
  });

  const [showSync, setShowSync] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const { data: syncCandidates } = trpc.gymPlus.admin_listMembersForSync.useQuery(undefined, { enabled: showSync });
  const syncMutation = trpc.gymPlus.admin_syncSelectedMembers.useMutation({
    onSuccess: (r) => { utils.gymPlus.admin_listMembers.invalidate(); toast.success(`동기화 완료: ${r.created}명 추가, ${r.skipped}명 스킵`); setShowSync(false); setSelectedIds([]); },
    onError: (err) => toast.error(err.message),
  });

  function resetForm() {
    setForm({ username: "", password: "", name: "", phone: "", email: "", membershipType: "general", membershipStart: "", membershipEnd: "" });
  }

  function openEdit(m: any) {
    setForm({ username: m.username, password: "", name: m.name, phone: m.phone ?? "", email: m.email ?? "", membershipType: m.membershipType ?? "general", membershipStart: m.membershipStart ?? "", membershipEnd: m.membershipEnd ?? "" });
    setEditingId(m.id);
    setShowForm(true);
  }

  function handleSubmit() {
    if (editingId) {
      updateMutation.mutate({ id: editingId, name: form.name, phone: form.phone || undefined, email: form.email || undefined, membershipType: form.membershipType, membershipStart: form.membershipStart || undefined, membershipEnd: form.membershipEnd || undefined, password: form.password || undefined, isActive: 1 });
    } else {
      if (!form.username || !form.password || !form.name) { toast.error("아이디, 비밀번호, 이름은 필수입니다."); return; }
      createMutation.mutate({ ...form, phone: form.phone || undefined, email: form.email || undefined, membershipStart: form.membershipStart || undefined, membershipEnd: form.membershipEnd || undefined });
    }
  }

  const membershipTypeLabel: Record<string, string> = { general: "일반", premium: "프리미엄", vip: "VIP" };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-muted-foreground">짐+ 회원 ({members?.length ?? 0}명)</p>
        <div className="flex gap-1.5">
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setShowSync(true)}>회원 동기화</Button>
          <Button size="sm" className="h-7 text-xs" onClick={() => { resetForm(); setEditingId(null); setShowForm(true); }}>+ 회원 추가</Button>
        </div>
      </div>

      {/* 동기화 다이얼로그 */}
      <Dialog open={showSync} onOpenChange={(o) => { setShowSync(o); if (!o) setSelectedIds([]); }}>
        <DialogContent className="max-w-sm md:max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader><DialogTitle>회원 동기화</DialogTitle></DialogHeader>
          <p className="text-xs text-muted-foreground">동기화할 회원을 선택하세요. 이미 계정이 있는 회원은 회색으로 표시됩니다.</p>
          <div className="flex gap-1.5 mb-1">
            <Button size="sm" variant="outline" className="h-6 text-[10px]" onClick={() => {
              const unsynced = (syncCandidates ?? []).filter(m => !m.alreadySynced && m.phone).map(m => m.id);
              setSelectedIds(unsynced);
            }}>전체 선택</Button>
            <Button size="sm" variant="outline" className="h-6 text-[10px]" onClick={() => setSelectedIds([])}>전체 해제</Button>
          </div>
          <div className="overflow-y-auto flex-1 space-y-1 pr-1">
            {!syncCandidates ? (
              <p className="text-xs text-muted-foreground text-center py-4">불러오는 중...</p>
            ) : syncCandidates.map(m => (
              <button
                key={m.id}
                className={`w-full flex items-center gap-2 p-2 rounded-lg text-left transition-colors ${m.alreadySynced ? "opacity-40 cursor-not-allowed" : selectedIds.includes(m.id) ? "bg-primary/20 border border-primary/40" : "bg-muted/40 hover:bg-muted"}`}
                onClick={() => {
                  if (m.alreadySynced) return;
                  setSelectedIds(prev => prev.includes(m.id) ? prev.filter(id => id !== m.id) : [...prev, m.id]);
                }}
              >
                <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${selectedIds.includes(m.id) ? "bg-primary border-primary" : "border-muted-foreground"}`}>
                  {selectedIds.includes(m.id) && <span className="text-[10px] text-primary-foreground">✓</span>}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium">{m.name}</p>
                  <p className="text-[10px] text-muted-foreground">{m.phone ?? "전화번호 없음"} {m.alreadySynced ? "· 이미 등록됨" : ""}</p>
                </div>
              </button>
            ))}
          </div>
          <div className="flex gap-2 pt-2 border-t">
            <Button variant="outline" className="flex-1 h-8 text-xs" onClick={() => setShowSync(false)}>취소</Button>
            <Button className="flex-1 h-8 text-xs" disabled={selectedIds.length === 0 || syncMutation.isPending}
              onClick={() => syncMutation.mutate({ memberIds: selectedIds })}>
              {syncMutation.isPending ? "동기화 중..." : `${selectedIds.length}명 동기화`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {isLoading ? (
        <p className="text-sm text-muted-foreground text-center py-4">불러오는 중...</p>
      ) : members?.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">등록된 회원이 없습니다</p>
      ) : (
        <div className="space-y-2">
          {[...(members ?? [])].sort((a, b) => a.name.localeCompare(b.name, 'ko')).map((m) => (
            <div key={m.id} className="flex items-center justify-between bg-background/50 rounded-xl px-3 py-2.5">
              <div>
                <p className="text-sm font-medium">{m.name}</p>
                <p className="text-xs text-muted-foreground">{m.username} · {membershipTypeLabel[m.membershipType] ?? m.membershipType}</p>
                {m.membershipEnd && <p className="text-xs text-muted-foreground">만료: {m.membershipEnd.slice(0, 10)}</p>}
              </div>
              <div className="flex gap-1.5">
                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => openEdit(m)}>수정</Button>
                <Button variant="destructive" size="sm" className="h-7 text-xs" onClick={() => { if (confirm(`${m.name} 회원을 삭제하시겠습니까?`)) deleteMutation.mutate({ id: m.id }); }}>삭제</Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={showForm} onOpenChange={(o) => { setShowForm(o); if (!o) { setEditingId(null); resetForm(); } }}>
        <DialogContent className="max-w-sm md:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingId ? "회원 수정" : "짐+ 회원 추가"}</DialogTitle></DialogHeader>
          <div className="space-y-3 pb-2">
            {!editingId && (
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">아이디 *</Label>
                <Input value={form.username} onChange={(e) => setForm((p) => ({ ...p, username: e.target.value }))} className="h-8 text-sm" />
              </div>
            )}
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">{editingId ? "새 비밀번호 (변경 시에만)" : "비밀번호 *"}</Label>
              <Input type="password" value={form.password} onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))} className="h-8 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">이름 *</Label>
              <Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} className="h-8 text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">연락처</Label>
                <Input value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} className="h-8 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">이메일</Label>
                <Input value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} className="h-8 text-sm" />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">회원권 유형</Label>
              <Select value={form.membershipType} onValueChange={(v) => setForm((p) => ({ ...p, membershipType: v as any }))}>
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
                <Label className="text-xs text-muted-foreground">회원권 시작</Label>
                <Input type="date" value={form.membershipStart} onChange={(e) => setForm((p) => ({ ...p, membershipStart: e.target.value }))} className="h-8 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">회원권 만료</Label>
                <Input type="date" value={form.membershipEnd} onChange={(e) => setForm((p) => ({ ...p, membershipEnd: e.target.value }))} className="h-8 text-sm" />
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

// ─── 영상 관리 ────────────────────────────────────────────────────────────────
function getYoutubeEmbed(url: string): string | null {
  const m = url.match(/(?:(?:www\.|m\.)?youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([^&\n?#]+)/);
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
    onSuccess: () => { utils.gymPlus.admin_listVideos.invalidate(); setShowForm(false); setEditingId(null); resetForm(); toast.success("영상이 수정되었습니다."); },
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
    const data = { ...form, categoryId: form.categoryId ? parseInt(form.categoryId) : undefined, isPublished: parseInt(form.isPublished), sortOrder: parseInt(form.sortOrder) || 0, duration: form.duration ? parseInt(form.duration) : undefined };
    if (!data.title || !data.videoUrl) { toast.error("제목과 영상 URL은 필수입니다."); return; }
    if (editingId) {
      updateMutation.mutate({ id: editingId, ...data });
    } else {
      createMutation.mutate(data);
    }
  }

  const levelLabel: Record<string, string> = { beginner: "초급", intermediate: "중급", advanced: "고급" };

  const formDialog = (
    <Dialog open={showForm} onOpenChange={(o) => { setShowForm(o); if (!o) { setEditingId(null); resetForm(); } }}>
      <DialogContent className="max-w-sm md:max-w-2xl max-h-[90vh] overflow-y-auto">
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
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">설명</Label>
            <textarea value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} rows={2} className="w-full bg-input border border-border rounded-lg p-2 text-sm text-foreground resize-none" />
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
        <div className="flex items-center gap-2">
          <button onClick={() => setSelectedVideo(null)} className="text-muted-foreground text-sm px-1">← 목록</button>
          <p className="text-sm font-semibold flex-1 line-clamp-1">{selectedVideo.title}</p>
          <Button variant="outline" size="sm" className="h-7 text-[10px] px-2" onClick={() => openEdit(selectedVideo)}>수정</Button>
          <Button variant="destructive" size="sm" className="h-7 text-[10px] px-2" onClick={() => { if (confirm("삭제?")) { deleteMutation.mutate({ id: selectedVideo.id }); setSelectedVideo(null); } }}>삭제</Button>
        </div>

        <div className="w-full bg-black aspect-video rounded-xl overflow-hidden">
          {embedUrl ? (
            <iframe src={embedUrl} className="w-full h-full" allowFullScreen allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" />
          ) : (
            <video src={selectedVideo.videoUrl} controls className="w-full h-full" playsInline />
          )}
        </div>

        <div className="flex gap-2 flex-wrap">
          <span className="text-[10px] bg-muted px-2 py-0.5 rounded-full">{levelLabel[selectedVideo.level ?? "beginner"]}</span>
          {selectedVideo.bodyPart && <span className="text-[10px] bg-muted px-2 py-0.5 rounded-full">{selectedVideo.bodyPart}</span>}
          <span className="text-[10px] bg-muted px-2 py-0.5 rounded-full">{selectedVideo.isPublished ? "공개" : "비공개"}</span>
        </div>

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
              updateMutation.mutate({
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
              });
            }}
          >
            {updateMutation.isPending ? "저장 중..." : "저장"}
          </Button>
        </div>

        {formDialog}
      </div>
    );
  }

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
            {v.thumbnailUrl ? (
              <img src={v.thumbnailUrl} alt={v.title} className="w-12 h-8 object-cover rounded flex-shrink-0" />
            ) : (
              <div className="w-12 h-8 bg-muted rounded flex items-center justify-center flex-shrink-0 text-xs">▶</div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium line-clamp-1">{v.title}</p>
              <p className="text-[10px] text-muted-foreground">{v.level ? (levelLabel[v.level] ?? v.level) : ""} · {v.isPublished ? "공개" : "비공개"}</p>
            </div>
            <span className="text-muted-foreground text-xs flex-shrink-0">›</span>
          </button>
        ))}
      </div>

      {formDialog}
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
    title: "", content: "", imageUrl: "", linkUrl: "",
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
    setForm({ title: "", content: "", imageUrl: "", linkUrl: "", eventType: "notice", startDate: "", endDate: "", isPublished: "1", isPinned: "0" });
  }

  function openEdit(e: any) {
    setForm({ title: e.title, content: e.content, imageUrl: e.imageUrl ?? "", linkUrl: e.linkUrl ?? "", eventType: e.eventType, startDate: e.startDate ?? "", endDate: e.endDate ?? "", isPublished: e.isPublished.toString(), isPinned: e.isPinned.toString() });
    setEditingId(e.id);
    setShowForm(true);
  }

  function handleSubmit() {
    if (!form.title || !form.content) { toast.error("제목과 내용은 필수입니다."); return; }
    const data = { ...form, isPublished: parseInt(form.isPublished), isPinned: parseInt(form.isPinned), startDate: form.startDate || undefined, endDate: form.endDate || undefined, imageUrl: form.imageUrl || undefined, linkUrl: form.linkUrl || undefined };
    if (editingId) {
      updateMutation.mutate({ id: editingId, ...data });
    } else {
      createMutation.mutate(data);
    }
  }

  const typeLabel: Record<string, string> = { notice: "공지", event: "이벤트", promotion: "프로모션" };

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
                <span className="text-[10px] text-muted-foreground">{e.eventType ? (typeLabel[e.eventType] ?? e.eventType) : ""}</span>
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
        <DialogContent className="max-w-sm md:max-w-2xl max-h-[90vh] overflow-y-auto">
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
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">링크 URL <span className="text-[10px] text-muted-foreground/60">(입력 시 클릭하면 해당 링크로 이동)</span></Label>
              <Input value={form.linkUrl} onChange={(e) => setForm((p) => ({ ...p, linkUrl: e.target.value }))} placeholder="https://..." className="h-8 text-sm" />
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
  const [selectedMemberId, setSelectedMemberId] = useState<number | null>(null);
  const [filterPt, setFilterPt] = useState(false);
  const [selectedLog, setSelectedLog] = useState<any | null>(null);
  const [videoModal, setVideoModal] = useState<{ logId: number; exIdx: number; currentUrl: string } | null>(null);
  const [videoUrl, setVideoUrl] = useState("");

  const { data: ptMembers } = trpc.gymPlus.admin_listPtMembers.useQuery();
  const { data: allMembers } = trpc.gymPlus.admin_listMembers.useQuery();
  const displayMembers = [...(filterPt ? (ptMembers ?? []) : (allMembers ?? []))].sort((a, b) => a.name.localeCompare(b.name, 'ko'));

  const { data: logs, isLoading } = trpc.gymPlus.admin_listWorkoutLogs.useQuery(
    selectedMemberId ? { gymPlusMemberId: selectedMemberId } : {},
  );

  const deleteMutation = trpc.gymPlus.admin_deleteWorkoutLog.useMutation({
    onSuccess: () => { utils.gymPlus.admin_listWorkoutLogs.invalidate(); toast.success("삭제되었습니다."); },
    onError: (err) => toast.error(err.message),
  });

  const updateMutation = trpc.gymPlus.admin_updateWorkoutLog.useMutation({
    onSuccess: () => { utils.gymPlus.admin_listWorkoutLogs.invalidate(); toast.success("저장되었습니다."); setVideoModal(null); },
    onError: (err) => toast.error(err.message),
  });

  function parseExercises(json: string | null | undefined): any[] {
    if (!json) return [];
    try { return JSON.parse(json); } catch { return []; }
  }

  function saveVideoUrl() {
    if (!videoModal || !selectedLog) return;
    const exercises = parseExercises(selectedLog.exercisesJson);
    exercises[videoModal.exIdx] = { ...exercises[videoModal.exIdx], videoUrl: videoUrl.trim() || undefined };
    updateMutation.mutate({ id: videoModal.logId, exercisesJson: JSON.stringify(exercises) });
    setSelectedLog({ ...selectedLog, exercisesJson: JSON.stringify(exercises) });
  }

  return (
    <div className="space-y-3">
      {/* 필터 */}
      <div className="flex items-center gap-2">
        <button
          className={`text-xs px-3 py-1 rounded-full border transition-colors ${!filterPt ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground"}`}
          onClick={() => { setFilterPt(false); setSelectedMemberId(null); }}
        >전체 회원</button>
        <button
          className={`text-xs px-3 py-1 rounded-full border transition-colors ${filterPt ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground"}`}
          onClick={() => { setFilterPt(true); setSelectedMemberId(null); }}
        >PT 회원만</button>
      </div>

      {/* 회원 선택 */}
      <select
        value={selectedMemberId ?? ""}
        onChange={(e) => setSelectedMemberId(e.target.value ? Number(e.target.value) : null)}
        className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background"
      >
        <option value="">전체 회원</option>
        {displayMembers.map((m: any) => (
          <option key={m.id} value={m.id}>{m.name}</option>
        ))}
      </select>

      {/* 기록 목록 */}
      <p className="text-xs text-muted-foreground">운동기록 {logs?.length ?? 0}건</p>
      {isLoading ? (
        <p className="text-sm text-muted-foreground text-center py-4">불러오는 중...</p>
      ) : !logs?.length ? (
        <p className="text-sm text-muted-foreground text-center py-4">운동기록이 없습니다</p>
      ) : (
        <div className="space-y-2">
          {logs.map((log) => {
            const exercises = parseExercises((log as any).exercisesJson);
            const isOpen = selectedLog?.id === log.id;
            return (
              <div key={log.id} className="bg-background/50 rounded-xl border border-border overflow-hidden">
                <button
                  className="w-full flex items-center gap-3 p-3 text-left"
                  onClick={() => setSelectedLog(isOpen ? null : { ...log, exercisesJson: (log as any).exercisesJson })}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-xs font-semibold text-primary">{log.memberName ?? "알 수 없음"}</p>
                      <p className="text-[10px] text-muted-foreground">{log.logDate}</p>
                    </div>
                    <p className="text-xs font-medium">{log.title || "운동 기록"}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {log.durationMinutes ? `${log.durationMinutes}분` : ""}
                      {log.caloriesBurned ? ` · ${log.caloriesBurned}kcal` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <Button variant="destructive" size="sm" className="h-6 text-[10px] px-2"
                      onClick={(e) => { e.stopPropagation(); if (confirm("삭제?")) deleteMutation.mutate({ id: log.id }); }}
                    >삭제</Button>
                    <span className="text-muted-foreground text-xs">{isOpen ? "▲" : "▼"}</span>
                  </div>
                </button>

                {/* 운동 목록 (펼침) */}
                {isOpen && (
                  <div className="border-t border-border px-3 pb-3 pt-2 space-y-2">
                    {exercises.length === 0 ? (
                      <p className="text-xs text-muted-foreground">운동 종목 없음</p>
                    ) : exercises.map((ex: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between gap-2 bg-muted/40 rounded-lg px-3 py-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium">{ex.name}</p>
                          {ex.sets?.length > 0 && (
                            <p className="text-[10px] text-muted-foreground">{ex.sets.length}세트</p>
                          )}
                        </div>
                        <Button
                          size="sm"
                          variant={ex.videoUrl ? "default" : "outline"}
                          className="h-6 text-[10px] px-2 flex-shrink-0"
                          onClick={() => { setVideoModal({ logId: log.id, exIdx: idx, currentUrl: ex.videoUrl ?? "" }); setVideoUrl(ex.videoUrl ?? ""); }}
                        >
                          {ex.videoUrl ? "영상수정" : "운동영상"}
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 운동영상 URL 입력 모달 */}
      <Dialog open={!!videoModal} onOpenChange={(o) => { if (!o) setVideoModal(null); }}>
        <DialogContent className="max-w-sm md:max-w-xl">
          <DialogHeader><DialogTitle>운동영상 링크 등록</DialogTitle></DialogHeader>
          <p className="text-xs text-muted-foreground">YouTube 또는 영상 URL을 입력하세요. 회원이 해당 운동에서 영상을 확인할 수 있습니다.</p>
          <Input
            placeholder="https://youtube.com/watch?v=..."
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            className="h-9 text-sm"
          />
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1 h-8 text-xs" onClick={() => setVideoModal(null)}>취소</Button>
            {videoModal?.currentUrl && (
              <Button variant="destructive" className="h-8 text-xs px-3" onClick={() => { setVideoUrl(""); saveVideoUrl(); }}>삭제</Button>
            )}
            <Button className="flex-1 h-8 text-xs" onClick={saveVideoUrl} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "저장 중..." : "저장"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── 메인 어드민 짐+ 섹션 ─────────────────────────────────────────────────────
type GymPlusTab = "members" | "videos" | "events" | "logs";

export default function GymPlusAdminSection() {
  const [activeTab, setActiveTab] = useState<GymPlusTab>("members");

  const tabs: { key: GymPlusTab; label: string }[] = [
    { key: "members", label: "회원" },
    { key: "videos", label: "운동영상" },
    { key: "events", label: "이벤트/공지" },
    { key: "logs", label: "운동기록" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex gap-1 bg-muted p-1 rounded-xl">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              activeTab === tab.key ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "members" && <GymPlusMembersAdmin />}
      {activeTab === "videos" && <GymPlusVideosAdmin />}
      {activeTab === "events" && <GymPlusEventsAdmin />}
      {activeTab === "logs" && <GymPlusWorkoutLogsAdmin />}
    </div>
  );
}

// ─── 상품 관리 + 구매 신청 ────────────────────────────────────────────────────
const CATEGORY_OPTIONS = [
  { value: "membership", label: "회원권" },
  { value: "pt", label: "PT" },
  { value: "supplement", label: "보충제" },
  { value: "goods", label: "용품" },
  { value: "other", label: "기타" },
];

const categoryLabel: Record<string, string> = Object.fromEntries(
  CATEGORY_OPTIONS.map(o => [o.value, o.label])
);

function formatPrice(n: number) {
  return n.toLocaleString("ko-KR") + "원";
}

const PAYMENT_METHOD_LABEL: Record<string, string> = {
  points: "포인트", cash: "현금", transfer: "계좌이체", card: "카드",
};
const STATUS_LABEL: Record<string, string> = {
  pending: "대기중", approved: "승인", rejected: "거절",
};
const STATUS_COLOR: Record<string, string> = {
  pending: "bg-yellow-500/10 text-yellow-500",
  approved: "bg-green-500/10 text-green-500",
  rejected: "bg-red-500/10 text-red-400",
};

function GymPlusPurchaseRequestsAdmin() {
  const utils = trpc.useUtils();
  const { data: requests, isLoading } = trpc.gymPlus.admin_listPurchaseRequests.useQuery({});
  const updateMutation = trpc.gymPlus.admin_updatePurchaseRequest.useMutation({
    onSuccess: () => { utils.gymPlus.admin_listPurchaseRequests.invalidate(); toast.success("상태가 업데이트되었습니다."); },
    onError: (err) => toast.error(err.message),
  });
  const chargePoints = trpc.gymPlus.admin_chargePoints.useMutation({
    onSuccess: () => toast.success("포인트가 충전되었습니다."),
    onError: (err) => toast.error(err.message),
  });
  const [chargeTarget, setChargeTarget] = useState<{ memberId: number; name: string } | null>(null);
  const [chargeAmount, setChargeAmount] = useState("");
  const [chargeReason, setChargeReason] = useState("");

  if (isLoading) return <div className="text-sm text-muted-foreground py-6 text-center">불러오는 중...</div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-xs text-muted-foreground">총 {requests?.length ?? 0}건</p>
        <Button size="sm" variant="outline" onClick={() => setChargeTarget({ memberId: -1, name: "" })}>
          포인트 충전
        </Button>
      </div>

      {(!requests || requests.length === 0) ? (
        <div className="text-sm text-muted-foreground text-center py-10 border border-dashed border-border rounded-xl">
          구매 신청 내역이 없습니다
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((r) => (
            <div key={r.id} className="border border-border rounded-xl p-4 bg-card space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-foreground">{r.productName}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {r.memberName ?? "-"} · {r.memberPhone ?? "-"}
                  </p>
                  {r.note && <p className="text-xs text-muted-foreground mt-0.5">메모: {r.note}</p>}
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${STATUS_COLOR[r.status] ?? "bg-muted text-muted-foreground"}`}>
                  {STATUS_LABEL[r.status] ?? r.status}
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">{r.price.toLocaleString("ko-KR")}원</span>
                <span>{PAYMENT_METHOD_LABEL[r.paymentMethod] ?? r.paymentMethod}</span>
                {r.pointsUsed > 0 && <span className="text-primary">{r.pointsUsed.toLocaleString("ko-KR")}P 사용</span>}
                <span>{r.createdAt?.slice(0, 10) ?? ""}</span>
              </div>
              {r.status === "pending" && (
                <div className="flex gap-2 pt-1">
                  <Button size="sm" variant="outline" className="flex-1 text-xs text-green-600 hover:text-green-600"
                    onClick={() => updateMutation.mutate({ id: r.id, status: "approved" })}>
                    승인
                  </Button>
                  <Button size="sm" variant="outline" className="flex-1 text-xs text-red-500 hover:text-red-500"
                    onClick={() => updateMutation.mutate({ id: r.id, status: "rejected" })}>
                    거절
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 포인트 충전 다이얼로그 */}
      <Dialog open={!!chargeTarget} onOpenChange={v => { if (!v) { setChargeTarget(null); setChargeAmount(""); setChargeReason(""); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>포인트 충전</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label className="text-xs text-muted-foreground">회원 ID</Label>
              <Input
                type="number"
                placeholder="회원 ID 입력"
                value={chargeTarget?.memberId === -1 ? "" : chargeTarget?.memberId ?? ""}
                onChange={e => setChargeTarget(p => p ? { ...p, memberId: parseInt(e.target.value) || -1 } : null)}
                className="mt-1 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">충전 포인트 (음수 입력 시 차감)</Label>
              <Input type="number" value={chargeAmount} onChange={e => setChargeAmount(e.target.value)} placeholder="예: 10000" className="mt-1 text-sm" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">사유</Label>
              <Input value={chargeReason} onChange={e => setChargeReason(e.target.value)} placeholder="예: 이벤트 지급" className="mt-1 text-sm" />
            </div>
            <div className="flex gap-2">
              <Button className="flex-1" onClick={() => {
                const amount = parseInt(chargeAmount, 10);
                if (!chargeTarget || chargeTarget.memberId <= 0 || isNaN(amount)) { toast.error("회원 ID와 포인트를 입력하세요."); return; }
                chargePoints.mutate({ gymPlusMemberId: chargeTarget.memberId, amount, reason: chargeReason || undefined });
                setChargeTarget(null); setChargeAmount(""); setChargeReason("");
              }} disabled={chargePoints.isPending}>충전</Button>
              <Button variant="outline" className="flex-1" onClick={() => setChargeTarget(null)}>취소</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function GymPlusProductsAdmin() {
  const utils = trpc.useUtils();
  const { data: products, isLoading } = trpc.gymPlus.admin_listProducts.useQuery();
  const [adminTab, setAdminTab] = useState<"products" | "purchases">("products");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({
    name: "", description: "", price: "", originalPrice: "",
    category: "membership", imageUrl: "", badgeText: "",
    isActive: 1, sortOrder: 0,
  });

  const createMutation = trpc.gymPlus.admin_createProduct.useMutation({
    onSuccess: () => { utils.gymPlus.admin_listProducts.invalidate(); setShowForm(false); resetForm(); toast.success("상품이 등록되었습니다."); },
    onError: (err) => toast.error(err.message),
  });

  const updateMutation = trpc.gymPlus.admin_updateProduct.useMutation({
    onSuccess: () => { utils.gymPlus.admin_listProducts.invalidate(); setShowForm(false); setEditingId(null); resetForm(); toast.success("상품이 수정되었습니다."); },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = trpc.gymPlus.admin_deleteProduct.useMutation({
    onSuccess: () => { utils.gymPlus.admin_listProducts.invalidate(); toast.success("상품이 삭제되었습니다."); },
    onError: (err) => toast.error(err.message),
  });

  function resetForm() {
    setForm({ name: "", description: "", price: "", originalPrice: "", category: "membership", imageUrl: "", badgeText: "", isActive: 1, sortOrder: 0 });
  }

  function openEdit(p: any) {
    setForm({
      name: p.name, description: p.description ?? "", price: String(p.price),
      originalPrice: p.originalPrice ? String(p.originalPrice) : "",
      category: p.category ?? "membership", imageUrl: p.imageUrl ?? "",
      badgeText: p.badgeText ?? "", isActive: p.isActive ?? 1, sortOrder: p.sortOrder ?? 0,
    });
    setEditingId(p.id);
    setShowForm(true);
  }

  function handleSubmit() {
    if (!form.name.trim()) { toast.error("상품명은 필수입니다."); return; }
    const price = parseInt(form.price, 10);
    if (isNaN(price) || price < 0) { toast.error("가격을 올바르게 입력해주세요."); return; }
    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      price,
      originalPrice: form.originalPrice ? parseInt(form.originalPrice, 10) : undefined,
      category: form.category,
      imageUrl: form.imageUrl.trim() || undefined,
      badgeText: form.badgeText.trim() || undefined,
      isActive: form.isActive,
      sortOrder: form.sortOrder,
    };
    if (editingId) {
      updateMutation.mutate({ id: editingId, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  function f(key: keyof typeof form, value: any) {
    setForm(p => ({ ...p, [key]: value }));
  }

  if (isLoading) return <div className="text-sm text-muted-foreground py-6 text-center">불러오는 중...</div>;

  return (
    <div className="space-y-4">
      {/* 탭 헤더 */}
      <div className="flex bg-muted rounded-xl p-1 gap-1">
        {([
          { key: "products", label: "상품 목록" },
          { key: "purchases", label: "구매 신청" },
        ] as const).map(t => (
          <button
            key={t.key}
            onClick={() => setAdminTab(t.key)}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-colors ${adminTab === t.key ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {adminTab === "purchases" && <GymPlusPurchaseRequestsAdmin />}

      {adminTab === "products" && (<>
      {/* 등록 버튼 */}
      <div className="flex justify-end">
        <Button size="sm" onClick={() => { resetForm(); setEditingId(null); setShowForm(true); }}>
          + 상품 등록
        </Button>
      </div>

      {/* 상품 목록 */}
      {(!products || products.length === 0) ? (
        <div className="text-sm text-muted-foreground text-center py-10 border border-dashed border-border rounded-xl">
          등록된 상품이 없습니다
        </div>
      ) : (
        <div className="space-y-3">
          {products.map((p) => (
            <div key={p.id} className={`border border-border rounded-xl p-4 ${p.isActive ? "bg-card" : "bg-muted/30"}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-foreground truncate">{p.name}</span>
                    {p.badgeText && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary flex-shrink-0">
                        {p.badgeText}
                      </span>
                    )}
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground flex-shrink-0">
                      {categoryLabel[p.category] ?? p.category}
                    </span>
                    {!p.isActive && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-500/10 text-red-400 flex-shrink-0">비활성</span>
                    )}
                  </div>
                  {p.description && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{p.description}</p>
                  )}
                  <div className="flex items-baseline gap-2 mt-2">
                    <span className="text-base font-bold text-foreground">{formatPrice(p.price)}</span>
                    {p.originalPrice && p.originalPrice > p.price && (
                      <span className="text-xs text-muted-foreground line-through">{formatPrice(p.originalPrice)}</span>
                    )}
                  </div>
                </div>
                {p.imageUrl && (
                  <img src={p.imageUrl} alt={p.name} className="w-16 h-16 object-cover rounded-lg flex-shrink-0 border border-border" />
                )}
              </div>
              <div className="flex gap-2 mt-3 pt-3 border-t border-border">
                <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={() => openEdit(p)}>수정</Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={() => updateMutation.mutate({ id: p.id, isActive: p.isActive ? 0 : 1 })}
                >
                  {p.isActive ? "비활성화" : "활성화"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs text-red-500 hover:text-red-500"
                  onClick={() => { if (confirm("정말 삭제하시겠습니까?")) deleteMutation.mutate({ id: p.id }); }}
                >
                  삭제
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 등록/수정 다이얼로그 */}
      <Dialog open={showForm} onOpenChange={(v) => { if (!v) { setShowForm(false); setEditingId(null); resetForm(); } }}>
        <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "상품 수정" : "상품 등록"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label className="text-xs text-muted-foreground">상품명 *</Label>
              <Input value={form.name} onChange={e => f("name", e.target.value)} placeholder="예: 3개월 회원권" className="mt-1 text-sm" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">카테고리</Label>
              <Select value={form.category} onValueChange={v => f("category", v)}>
                <SelectTrigger className="mt-1 text-sm h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORY_OPTIONS.map(o => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">판매가 (원) *</Label>
              <Input type="number" value={form.price} onChange={e => f("price", e.target.value)} placeholder="예: 80000" className="mt-1 text-sm" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">정가 (원) — 할인 전 가격 표시용</Label>
              <Input type="number" value={form.originalPrice} onChange={e => f("originalPrice", e.target.value)} placeholder="예: 100000 (선택사항)" className="mt-1 text-sm" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">상품 설명</Label>
              <textarea
                value={form.description}
                onChange={e => f("description", e.target.value)}
                placeholder="상품에 대한 간단한 설명을 입력하세요"
                rows={3}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">배지 텍스트 (예: 인기, 추천, BEST)</Label>
              <Input value={form.badgeText} onChange={e => f("badgeText", e.target.value)} placeholder="예: 인기" className="mt-1 text-sm" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">이미지 URL</Label>
              <Input value={form.imageUrl} onChange={e => f("imageUrl", e.target.value)} placeholder="https://..." className="mt-1 text-sm" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">노출 순서 (숫자 낮을수록 위)</Label>
              <Input type="number" value={form.sortOrder} onChange={e => f("sortOrder", parseInt(e.target.value) || 0)} className="mt-1 text-sm" />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">활성화</Label>
              <button
                onClick={() => f("isActive", form.isActive ? 0 : 1)}
                className={`relative w-10 h-5.5 rounded-full transition-colors ${form.isActive ? "bg-primary" : "bg-muted"}`}
                style={{ height: "22px" }}
              >
                <span className={`absolute top-0.5 left-0.5 w-4.5 h-4.5 bg-white rounded-full shadow transition-transform ${form.isActive ? "translate-x-4.5" : ""}`}
                  style={{ width: "18px", height: "18px", transform: form.isActive ? "translateX(18px)" : "translateX(0)" }} />
              </button>
            </div>
            <div className="flex gap-2 pt-2">
              <Button
                className="flex-1"
                onClick={handleSubmit}
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {editingId ? "저장" : "등록"}
              </Button>
              <Button variant="outline" className="flex-1" onClick={() => { setShowForm(false); setEditingId(null); resetForm(); }}>
                취소
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      </>)}
    </div>
  );
}
