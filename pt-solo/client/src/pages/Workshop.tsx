import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Wrench, ExternalLink, Users, Video, Bell, Plus, Trash2, Edit2, ChevronDown, ChevronUp, Eye, EyeOff, FileText, Copy, Check } from "lucide-react";
import TabBanner from "@/components/TabBanner";

const MEMBERSHIP_LABELS: Record<string, string> = { general: "일반회원", premium: "프리미엄", vip: "VIP" };
const LEVEL_LABELS: Record<string, string> = { beginner: "초급", intermediate: "중급", advanced: "고급" };
const EVENT_TYPE_LABELS: Record<string, string> = { notice: "공지", event: "이벤트", promotion: "프로모션" };

// ── 회원 관리 섹션 ──────────────────────────────────────────────────────────
function MemberSection({ trainerId }: { trainerId: number }) {
  const utils = trpc.useUtils();
  const { data: members } = trpc.fitStepPlus.trainer_listMembers.useQuery();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({ username: "", password: "", name: "", phone: "", membershipType: "general" as const, membershipStart: "", membershipEnd: "" });

  const createMutation = trpc.fitStepPlus.trainer_createMember.useMutation({
    onSuccess: () => { utils.fitStepPlus.trainer_listMembers.invalidate(); setShowForm(false); resetForm(); toast.success("회원 계정이 생성되었습니다"); },
    onError: (e) => toast.error(e.message),
  });
  const updateMutation = trpc.fitStepPlus.trainer_updateMember.useMutation({
    onSuccess: () => { utils.fitStepPlus.trainer_listMembers.invalidate(); setEditId(null); resetForm(); toast.success("수정되었습니다"); },
    onError: (e) => toast.error(e.message),
  });
  const deleteMutation = trpc.fitStepPlus.trainer_deleteMember.useMutation({
    onSuccess: () => { utils.fitStepPlus.trainer_listMembers.invalidate(); toast.success("삭제되었습니다"); },
  });

  function resetForm() { setForm({ username: "", password: "", name: "", phone: "", membershipType: "general", membershipStart: "", membershipEnd: "" }); }

  function openEdit(m: any) {
    setForm({ username: m.username, password: "", name: m.name, phone: m.phone ?? "", membershipType: m.membershipType, membershipStart: m.membershipStart ?? "", membershipEnd: m.membershipEnd ?? "" });
    setEditId(m.id);
    setShowForm(true);
  }

  function handleSubmit() {
    const payload = { ...form, phone: form.phone || undefined, membershipStart: form.membershipStart || undefined, membershipEnd: form.membershipEnd || undefined };
    if (editId) {
      updateMutation.mutate({ id: editId, ...payload, password: form.password || undefined });
    } else {
      if (!form.username || !form.password || !form.name) { toast.error("아이디, 비밀번호, 이름은 필수입니다"); return; }
      createMutation.mutate(payload as any);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">회원 계정 ({members?.length ?? 0})</p>
        <button onClick={() => { resetForm(); setEditId(null); setShowForm(v => !v); }}
          className="flex items-center gap-1 text-xs text-primary">
          <Plus className="h-3.5 w-3.5" />추가
        </button>
      </div>

      {showForm && (
        <div className="bg-accent/20 border border-border rounded-xl p-4 space-y-3">
          <p className="text-xs font-semibold">{editId ? "회원 수정" : "신규 회원 계정"}</p>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs text-muted-foreground">아이디</Label>
              <Input value={form.username} onChange={e => setForm(p => ({ ...p, username: e.target.value }))} placeholder="로그인 아이디" className="h-8 text-sm mt-0.5" disabled={!!editId} />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">{editId ? "새 비밀번호 (선택)" : "비밀번호"}</Label>
              <Input type="password" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} placeholder="6자 이상" className="h-8 text-sm mt-0.5" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">이름</Label>
              <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="회원명" className="h-8 text-sm mt-0.5" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">연락처</Label>
              <Input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="010-0000-0000" className="h-8 text-sm mt-0.5" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">회원권 시작</Label>
              <Input type="date" value={form.membershipStart} onChange={e => setForm(p => ({ ...p, membershipStart: e.target.value }))} className="h-8 text-sm mt-0.5" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">회원권 만료</Label>
              <Input type="date" value={form.membershipEnd} onChange={e => setForm(p => ({ ...p, membershipEnd: e.target.value }))} className="h-8 text-sm mt-0.5" />
            </div>
            <div className="col-span-2">
              <Label className="text-xs text-muted-foreground">회원 유형</Label>
              <select value={form.membershipType} onChange={e => setForm(p => ({ ...p, membershipType: e.target.value as any }))}
                className="w-full mt-0.5 h-8 bg-background border border-border rounded-md px-2 text-sm">
                {Object.entries(MEMBERSHIP_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="flex-1" onClick={() => { setShowForm(false); setEditId(null); resetForm(); }}>취소</Button>
            <Button size="sm" className="flex-1" onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending}>
              {editId ? "수정" : "생성"}
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {members?.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">등록된 회원이 없습니다</p>}
        {members?.map(m => (
          <div key={m.id} className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-accent/20 border border-border">
            <div>
              <p className="text-sm font-medium">{m.name}</p>
              <p className="text-xs text-muted-foreground">{m.username} · {MEMBERSHIP_LABELS[m.membershipType] ?? m.membershipType}</p>
              {m.membershipEnd && <p className="text-xs text-muted-foreground">{m.membershipEnd} 만료</p>}
            </div>
            <div className="flex gap-1">
              <button onClick={() => openEdit(m)} className="p-1.5 text-muted-foreground hover:text-primary transition-colors"><Edit2 className="h-3.5 w-3.5" /></button>
              <button onClick={() => { if (confirm("삭제하시겠습니까?")) deleteMutation.mutate({ id: m.id }); }} className="p-1.5 text-muted-foreground hover:text-red-400 transition-colors"><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── 영상 관리 섹션 ──────────────────────────────────────────────────────────
function VideoSection({ trainerId }: { trainerId: number }) {
  const utils = trpc.useUtils();
  const { data: videos } = trpc.fitStepPlus.trainer_listVideos.useQuery();
  const { data: categories } = trpc.fitStepPlus.trainer_listCategories.useQuery();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({ title: "", videoUrl: "", thumbnailUrl: "", description: "", level: "beginner" as const, bodyPart: "", duration: "", categoryId: "", isPublished: 1 });
  const [newCatName, setNewCatName] = useState("");

  const createMutation = trpc.fitStepPlus.trainer_createVideo.useMutation({
    onSuccess: () => { utils.fitStepPlus.trainer_listVideos.invalidate(); setShowForm(false); resetForm(); toast.success("영상이 추가되었습니다"); },
    onError: (e) => toast.error(e.message),
  });
  const updateMutation = trpc.fitStepPlus.trainer_updateVideo.useMutation({
    onSuccess: () => { utils.fitStepPlus.trainer_listVideos.invalidate(); setEditId(null); setShowForm(false); resetForm(); toast.success("수정되었습니다"); },
  });
  const deleteMutation = trpc.fitStepPlus.trainer_deleteVideo.useMutation({
    onSuccess: () => utils.fitStepPlus.trainer_listVideos.invalidate(),
  });
  const toggleMutation = trpc.fitStepPlus.trainer_updateVideo.useMutation({
    onSuccess: () => utils.fitStepPlus.trainer_listVideos.invalidate(),
  });
  const createCatMutation = trpc.fitStepPlus.trainer_createCategory.useMutation({
    onSuccess: () => { utils.fitStepPlus.trainer_listCategories.invalidate(); setNewCatName(""); },
  });
  const deleteCatMutation = trpc.fitStepPlus.trainer_deleteCategory.useMutation({
    onSuccess: () => utils.fitStepPlus.trainer_listCategories.invalidate(),
  });

  function resetForm() { setForm({ title: "", videoUrl: "", thumbnailUrl: "", description: "", level: "beginner", bodyPart: "", duration: "", categoryId: "", isPublished: 1 }); }

  function openEdit(v: any) {
    setForm({ title: v.title, videoUrl: v.videoUrl, thumbnailUrl: v.thumbnailUrl ?? "", description: v.description ?? "", level: v.level ?? "beginner", bodyPart: v.bodyPart ?? "", duration: v.duration?.toString() ?? "", categoryId: v.categoryId?.toString() ?? "", isPublished: v.isPublished });
    setEditId(v.id);
    setShowForm(true);
  }

  function handleSubmit() {
    const payload = { ...form, duration: form.duration ? parseInt(form.duration) : undefined, categoryId: form.categoryId ? parseInt(form.categoryId) : undefined, thumbnailUrl: form.thumbnailUrl || undefined, description: form.description || undefined, bodyPart: form.bodyPart || undefined };
    if (editId) { updateMutation.mutate({ id: editId, ...payload }); }
    else { if (!form.title || !form.videoUrl) { toast.error("제목과 영상 URL은 필수입니다"); return; } createMutation.mutate(payload as any); }
  }

  return (
    <div className="space-y-3">
      {/* 카테고리 */}
      <div>
        <p className="text-xs font-semibold mb-2">카테고리</p>
        <div className="flex gap-2 flex-wrap">
          {categories?.map(c => (
            <div key={c.id} className="flex items-center gap-1 bg-accent/30 border border-border px-2 py-1 rounded-full text-xs">
              <span>{c.name}</span>
              <button onClick={() => deleteCatMutation.mutate({ id: c.id })} className="text-muted-foreground hover:text-red-400"><Trash2 className="h-3 w-3" /></button>
            </div>
          ))}
          <div className="flex gap-1">
            <Input value={newCatName} onChange={e => setNewCatName(e.target.value)} placeholder="카테고리 추가" className="h-7 text-xs w-28" onKeyDown={e => { if (e.key === "Enter" && newCatName) createCatMutation.mutate({ name: newCatName }); }} />
            <Button size="sm" className="h-7 px-2 text-xs" onClick={() => newCatName && createCatMutation.mutate({ name: newCatName })}>추가</Button>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">영상 ({videos?.length ?? 0})</p>
        <button onClick={() => { resetForm(); setEditId(null); setShowForm(v => !v); }} className="flex items-center gap-1 text-xs text-primary">
          <Plus className="h-3.5 w-3.5" />추가
        </button>
      </div>

      {showForm && (
        <div className="bg-accent/20 border border-border rounded-xl p-4 space-y-3">
          <p className="text-xs font-semibold">{editId ? "영상 수정" : "새 영상"}</p>
          <div className="space-y-2">
            <div><Label className="text-xs text-muted-foreground">제목</Label><Input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="영상 제목" className="h-8 text-sm mt-0.5" /></div>
            <div><Label className="text-xs text-muted-foreground">영상 URL (YouTube 또는 직접 링크)</Label><Input value={form.videoUrl} onChange={e => setForm(p => ({ ...p, videoUrl: e.target.value }))} placeholder="https://youtube.com/..." className="h-8 text-sm mt-0.5" /></div>
            <div><Label className="text-xs text-muted-foreground">썸네일 URL (선택)</Label><Input value={form.thumbnailUrl} onChange={e => setForm(p => ({ ...p, thumbnailUrl: e.target.value }))} placeholder="https://..." className="h-8 text-sm mt-0.5" /></div>
            <div><Label className="text-xs text-muted-foreground">설명 (선택)</Label><Input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="영상 설명" className="h-8 text-sm mt-0.5" /></div>
            <div className="grid grid-cols-3 gap-2">
              <div><Label className="text-xs text-muted-foreground">난이도</Label>
                <select value={form.level} onChange={e => setForm(p => ({ ...p, level: e.target.value as any }))} className="w-full mt-0.5 h-8 bg-background border border-border rounded-md px-2 text-sm">
                  {Object.entries(LEVEL_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div><Label className="text-xs text-muted-foreground">부위</Label><Input value={form.bodyPart} onChange={e => setForm(p => ({ ...p, bodyPart: e.target.value }))} placeholder="가슴, 하체..." className="h-8 text-sm mt-0.5" /></div>
              <div><Label className="text-xs text-muted-foreground">시간(분)</Label><Input type="number" value={form.duration} onChange={e => setForm(p => ({ ...p, duration: e.target.value }))} placeholder="30" className="h-8 text-sm mt-0.5" /></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label className="text-xs text-muted-foreground">카테고리</Label>
                <select value={form.categoryId} onChange={e => setForm(p => ({ ...p, categoryId: e.target.value }))} className="w-full mt-0.5 h-8 bg-background border border-border rounded-md px-2 text-sm">
                  <option value="">없음</option>
                  {categories?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="flex items-end gap-2 pb-0.5">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.isPublished === 1} onChange={e => setForm(p => ({ ...p, isPublished: e.target.checked ? 1 : 0 }))} className="rounded" />
                  <span className="text-xs text-muted-foreground">공개</span>
                </label>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="flex-1" onClick={() => { setShowForm(false); setEditId(null); resetForm(); }}>취소</Button>
            <Button size="sm" className="flex-1" onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending}>{editId ? "수정" : "추가"}</Button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {videos?.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">등록된 영상이 없습니다</p>}
        {videos?.map(v => (
          <div key={v.id} className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-accent/20 border border-border">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{v.title}</p>
              <p className="text-xs text-muted-foreground">{LEVEL_LABELS[v.level ?? "beginner"]} {v.bodyPart ? `· ${v.bodyPart}` : ""} {v.duration ? `· ${v.duration}분` : ""}</p>
            </div>
            <div className="flex gap-1 shrink-0">
              <button onClick={() => toggleMutation.mutate({ id: v.id, isPublished: v.isPublished === 1 ? 0 : 1 })} className={`p-1.5 transition-colors ${v.isPublished === 1 ? "text-primary" : "text-muted-foreground"}`}>
                {v.isPublished === 1 ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
              </button>
              <button onClick={() => openEdit(v)} className="p-1.5 text-muted-foreground hover:text-primary transition-colors"><Edit2 className="h-3.5 w-3.5" /></button>
              <button onClick={() => { if (confirm("삭제하시겠습니까?")) deleteMutation.mutate({ id: v.id }); }} className="p-1.5 text-muted-foreground hover:text-red-400 transition-colors"><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── 공지/이벤트 관리 섹션 ────────────────────────────────────────────────────
function EventSection({ trainerId }: { trainerId: number }) {
  const utils = trpc.useUtils();
  const { data: events } = trpc.fitStepPlus.trainer_listEvents.useQuery();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({ title: "", content: "", eventType: "notice" as const, startDate: "", endDate: "", isPublished: 1, isPinned: 0 });

  const createMutation = trpc.fitStepPlus.trainer_createEvent.useMutation({
    onSuccess: () => { utils.fitStepPlus.trainer_listEvents.invalidate(); setShowForm(false); resetForm(); toast.success("공지가 등록되었습니다"); },
    onError: (e) => toast.error(e.message),
  });
  const updateMutation = trpc.fitStepPlus.trainer_updateEvent.useMutation({
    onSuccess: () => { utils.fitStepPlus.trainer_listEvents.invalidate(); setEditId(null); setShowForm(false); resetForm(); toast.success("수정되었습니다"); },
  });
  const deleteMutation = trpc.fitStepPlus.trainer_deleteEvent.useMutation({
    onSuccess: () => utils.fitStepPlus.trainer_listEvents.invalidate(),
  });

  function resetForm() { setForm({ title: "", content: "", eventType: "notice", startDate: "", endDate: "", isPublished: 1, isPinned: 0 }); }

  function openEdit(e: any) {
    setForm({ title: e.title, content: e.content, eventType: e.eventType ?? "notice", startDate: e.startDate ?? "", endDate: e.endDate ?? "", isPublished: e.isPublished, isPinned: e.isPinned });
    setEditId(e.id);
    setShowForm(true);
  }

  function handleSubmit() {
    const payload = { ...form, startDate: form.startDate || undefined, endDate: form.endDate || undefined };
    if (!form.title || !form.content) { toast.error("제목과 내용은 필수입니다"); return; }
    if (editId) { updateMutation.mutate({ id: editId, ...payload }); }
    else { createMutation.mutate(payload); }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">공지/이벤트 ({events?.length ?? 0})</p>
        <button onClick={() => { resetForm(); setEditId(null); setShowForm(v => !v); }} className="flex items-center gap-1 text-xs text-primary">
          <Plus className="h-3.5 w-3.5" />추가
        </button>
      </div>

      {showForm && (
        <div className="bg-accent/20 border border-border rounded-xl p-4 space-y-3">
          <p className="text-xs font-semibold">{editId ? "공지 수정" : "새 공지/이벤트"}</p>
          <div className="space-y-2">
            <div><Label className="text-xs text-muted-foreground">제목</Label><Input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} className="h-8 text-sm mt-0.5" /></div>
            <div><Label className="text-xs text-muted-foreground">내용</Label>
              <textarea value={form.content} onChange={e => setForm(p => ({ ...p, content: e.target.value }))} rows={4} placeholder="내용을 입력하세요..."
                className="w-full mt-0.5 bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary resize-none" />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div><Label className="text-xs text-muted-foreground">유형</Label>
                <select value={form.eventType} onChange={e => setForm(p => ({ ...p, eventType: e.target.value as any }))} className="w-full mt-0.5 h-8 bg-background border border-border rounded-md px-2 text-sm">
                  {Object.entries(EVENT_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div><Label className="text-xs text-muted-foreground">시작일</Label><Input type="date" value={form.startDate} onChange={e => setForm(p => ({ ...p, startDate: e.target.value }))} className="h-8 text-sm mt-0.5" /></div>
              <div><Label className="text-xs text-muted-foreground">종료일</Label><Input type="date" value={form.endDate} onChange={e => setForm(p => ({ ...p, endDate: e.target.value }))} className="h-8 text-sm mt-0.5" /></div>
            </div>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer text-xs text-muted-foreground">
                <input type="checkbox" checked={form.isPublished === 1} onChange={e => setForm(p => ({ ...p, isPublished: e.target.checked ? 1 : 0 }))} className="rounded" />공개
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-xs text-muted-foreground">
                <input type="checkbox" checked={form.isPinned === 1} onChange={e => setForm(p => ({ ...p, isPinned: e.target.checked ? 1 : 0 }))} className="rounded" />상단고정
              </label>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="flex-1" onClick={() => { setShowForm(false); setEditId(null); resetForm(); }}>취소</Button>
            <Button size="sm" className="flex-1" onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending}>{editId ? "수정" : "등록"}</Button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {events?.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">등록된 공지가 없습니다</p>}
        {events?.map(e => (
          <div key={e.id} className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-accent/20 border border-border">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                {e.isPinned ? <span className="text-[10px] text-yellow-400">📌</span> : null}
                <span className="text-xs text-muted-foreground">{EVENT_TYPE_LABELS[e.eventType ?? "notice"]}</span>
              </div>
              <p className="text-sm font-medium truncate">{e.title}</p>
            </div>
            <div className="flex gap-1 shrink-0">
              <button onClick={() => openEdit(e)} className="p-1.5 text-muted-foreground hover:text-primary transition-colors"><Edit2 className="h-3.5 w-3.5" /></button>
              <button onClick={() => { if (confirm("삭제하시겠습니까?")) deleteMutation.mutate({ id: e.id }); }} className="p-1.5 text-muted-foreground hover:text-red-400 transition-colors"><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── FIT STEP+ 메인 관리 패널 ────────────────────────────────────────────────
function FitStepPlusPanel({ trainerId }: { trainerId: number }) {
  const [, navigate] = useLocation();
  const [activeSection, setActiveSection] = useState<"members" | "videos" | "events" | null>(null);
  const [copied, setCopied] = useState(false);

  function copyLink() {
    const url = `${window.location.origin}/fit-step-plus/${trainerId}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const sections = [
    { key: "members" as const, label: "회원 계정", icon: Users, desc: "회원 앱 계정 생성 및 관리" },
    { key: "videos" as const, label: "운동 영상", icon: Video, desc: "영상 등록 및 카테고리 관리" },
    { key: "events" as const, label: "공지/이벤트", icon: Bell, desc: "공지, 이벤트, 프로모션 관리" },
  ];

  return (
    <div className="space-y-4">
      {/* 회원 앱 바로가기 */}
      <div className="bg-primary/10 border border-primary/20 rounded-xl p-4 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold">
            <span className="font-black" style={{ fontFamily: "'Arial Black', Arial, sans-serif" }}>FIT</span>
            <span className="font-black text-primary" style={{ fontFamily: "'Arial Black', Arial, sans-serif" }}>STEP</span>
            <span className="font-black text-primary" style={{ fontFamily: "'Arial Black', Arial, sans-serif" }}>+</span>
            <span className="font-normal text-muted-foreground text-xs ml-2">회원 전용 앱</span>
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">회원에게 이 링크를 공유하세요</p>
        </div>
        <div className="flex gap-2">
          <button onClick={copyLink}
            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors ${copied ? "text-green-400 bg-green-400/10" : "text-muted-foreground bg-accent/30 hover:text-primary hover:bg-primary/10"}`}>
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "복사됨" : "링크 복사"}
          </button>
          <button onClick={() => navigate(`/fit-step-plus/${trainerId}`)}
            className="flex items-center gap-1.5 text-xs text-primary bg-primary/10 px-3 py-1.5 rounded-lg hover:bg-primary/20 transition-colors">
            <ExternalLink className="h-3.5 w-3.5" />열기
          </button>
        </div>
      </div>

      {/* 관리 섹션 */}
      {sections.map(({ key, label, icon: Icon, desc }) => (
        <Card key={key} className="bg-card border-border">
          <button className="w-full text-left" onClick={() => setActiveSection(activeSection === key ? null : key)}>
            <CardHeader className="pb-2 pt-4 px-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Icon className="h-4 w-4 text-primary" />
                  {label}
                </CardTitle>
                {activeSection === key ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
              </div>
              {activeSection !== key && <p className="text-xs text-muted-foreground">{desc}</p>}
            </CardHeader>
          </button>
          {activeSection === key && (
            <CardContent className="pt-0 pb-4">
              {key === "members" && <MemberSection trainerId={trainerId} />}
              {key === "videos" && <VideoSection trainerId={trainerId} />}
              {key === "events" && <EventSection trainerId={trainerId} />}
            </CardContent>
          )}
        </Card>
      ))}
    </div>
  );
}

// ── 메인 Workshop 페이지 ────────────────────────────────────────────────────
function ContractTermsEditor() {
  const utils = trpc.useUtils();
  const { data: terms } = trpc.trainers.getContractTerms.useQuery();
  const updateMutation = trpc.trainers.updateContractTerms.useMutation({
    onSuccess: () => { toast.success("약관이 저장되었습니다"); utils.trainers.getContractTerms.invalidate(); },
    onError: () => toast.error("저장에 실패했습니다"),
  });

  const [termsOfService, setTermsOfService] = useState("");
  const [privacyPolicy, setPrivacyPolicy] = useState("");
  const [marketingConsent, setMarketingConsent] = useState("");
  const [initialized, setInitialized] = useState(false);

  if (terms && !initialized) {
    setTermsOfService(terms.termsOfService ?? "");
    setPrivacyPolicy(terms.privacyPolicy ?? "");
    setMarketingConsent(terms.marketingConsent ?? "");
    setInitialized(true);
  }

  return (
    <div className="space-y-4">
      {[
        { label: "이용 약관", value: termsOfService, onChange: setTermsOfService },
        { label: "개인정보 수집·이용 동의서", value: privacyPolicy, onChange: setPrivacyPolicy },
        { label: "광고성 정보 수신 동의서", value: marketingConsent, onChange: setMarketingConsent },
      ].map(({ label, value, onChange }) => (
        <div key={label} className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">{label}</Label>
          <textarea
            value={value}
            onChange={e => onChange(e.target.value)}
            rows={6}
            placeholder={`${label} 내용을 입력하세요...`}
            className="w-full bg-background border border-border rounded-xl px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none font-mono leading-relaxed"
          />
        </div>
      ))}
      <Button
        size="sm"
        className="w-full"
        disabled={updateMutation.isPending}
        onClick={() => updateMutation.mutate({ termsOfService, privacyPolicy, marketingConsent })}
      >
        {updateMutation.isPending ? "저장 중..." : "저장"}
      </Button>
    </div>
  );
}

export default function Workshop() {
  const { data: user } = trpc.auth.me.useQuery();
  const [openSection, setOpenSection] = useState<"fitstep" | "terms" | null>(null);
  const trainerId = (user as any)?.trainerId as number | undefined;

  function toggle(key: "fitstep" | "terms") {
    setOpenSection(v => v === key ? null : key);
  }

  return (
    <div className="space-y-4">
      <TabBanner tabKey="workshop" />
      <div>
        <h1 className="text-xl font-bold">작업실</h1>
        <p className="text-sm text-muted-foreground mt-0.5">트레이너 전용 작업 공간</p>
      </div>

      <div className="space-y-3">
        {/* FIT STEP+ */}
        <Card className="bg-card border-border">
          <button
            className="w-full flex items-center justify-between px-4 py-3 text-left"
            onClick={() => toggle("fitstep")}
          >
            <div className="flex items-center gap-2.5">
              <Wrench className="h-4 w-4 text-primary" />
              <span className="font-semibold text-sm">
                <span style={{ fontFamily: "'Arial Black', Arial, sans-serif" }}>FIT</span>
                <span className="text-primary" style={{ fontFamily: "'Arial Black', Arial, sans-serif" }}>STEP+</span>
              </span>
            </div>
            {openSection === "fitstep" ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </button>
          {openSection === "fitstep" && (
            <CardContent className="pt-0 pb-4">
              {trainerId ? (
                <FitStepPlusPanel trainerId={trainerId} />
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">트레이너 계정에서만 사용할 수 있습니다.</p>
              )}
            </CardContent>
          )}
        </Card>

        {/* 회원 계약서 약관 수정 */}
        <Card className="bg-card border-border">
          <button
            className="w-full flex items-center justify-between px-4 py-3 text-left"
            onClick={() => toggle("terms")}
          >
            <div className="flex items-center gap-2.5">
              <FileText className="h-4 w-4 text-primary" />
              <span className="font-semibold text-sm">회원 계약서 약관 수정</span>
            </div>
            {openSection === "terms" ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </button>
          {openSection === "terms" && (
            <CardContent className="pt-0 pb-4">
              <ContractTermsEditor />
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  );
}
