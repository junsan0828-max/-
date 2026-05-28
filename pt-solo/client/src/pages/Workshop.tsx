import React, { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Wrench, ExternalLink, Video, Bell, Plus, Trash2, Edit2, ChevronDown, ChevronUp, Eye, EyeOff, FileText, Copy, Check, Users, CalendarCheck, ClipboardList, X, Globe, Instagram, Youtube, MessageCircle, Calendar, Dumbbell, Lock, Coins, BookMarked } from "lucide-react";
import TabBanner from "@/components/TabBanner";
import PointSpendConfirm from "@/components/PointSpendConfirm";

const WORKSHOP_LOCKED = true; // 개발 중 — 완료 후 false로 변경

const LEVEL_LABELS: Record<string, string> = { beginner: "초급", intermediate: "중급", advanced: "고급" };
const EVENT_TYPE_LABELS: Record<string, string> = { notice: "공지", event: "이벤트", promotion: "프로모션" };

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

// ── 회원 관리 섹션 ──────────────────────────────────────────────────────────
const MEMBERSHIP_LABELS: Record<string, string> = { general: "일반회원", premium: "프리미엄", vip: "VIP" };

function MemberSection() {
  const utils = trpc.useUtils();
  const { data: members } = trpc.fitStepPlus.trainer_listMembers.useQuery();
  const [showForm, setShowForm] = useState(false);
  const [editMember, setEditMember] = useState<any | null>(null);
  const [form, setForm] = useState({ username: "", password: "", name: "", phone: "", membershipType: "general" as "general" | "premium" | "vip", membershipStart: "", membershipEnd: "" });

  const createMutation = trpc.fitStepPlus.trainer_createMember.useMutation({
    onSuccess: () => { utils.fitStepPlus.trainer_listMembers.invalidate(); setShowForm(false); resetForm(); toast.success("회원이 추가되었습니다"); },
    onError: (err) => toast.error(err.message),
  });
  const updateMutation = trpc.fitStepPlus.trainer_updateMember.useMutation({
    onSuccess: () => { utils.fitStepPlus.trainer_listMembers.invalidate(); setEditMember(null); toast.success("수정되었습니다"); },
    onError: (err) => toast.error(err.message),
  });
  const deleteMutation = trpc.fitStepPlus.trainer_deleteMember.useMutation({
    onSuccess: () => utils.fitStepPlus.trainer_listMembers.invalidate(),
  });

  function resetForm() { setForm({ username: "", password: "", name: "", phone: "", membershipType: "general", membershipStart: "", membershipEnd: "" }); }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">총 {members?.length ?? 0}명</p>
        <Button size="sm" className="h-7 text-xs gap-1" onClick={() => { resetForm(); setShowForm(true); }}>
          <Plus className="h-3 w-3" />회원 추가
        </Button>
      </div>

      {showForm && (
        <div className="bg-muted/40 rounded-xl p-4 space-y-3 border border-border">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">새 회원 추가</p>
            <button onClick={() => setShowForm(false)}><X className="h-4 w-4 text-muted-foreground" /></button>
          </div>
          {[
            { label: "이름 *", key: "name", placeholder: "홍길동" },
            { label: "아이디 *", key: "username", placeholder: "hong123" },
            { label: "비밀번호 *", key: "password", placeholder: "6자 이상", type: "password" },
            { label: "연락처", key: "phone", placeholder: "010-0000-0000" },
          ].map(({ label, key, placeholder, type }) => (
            <div key={key} className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">{label}</Label>
              <Input type={type} placeholder={placeholder} value={(form as any)[key]}
                onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))} className="bg-background border-border text-sm h-8" />
            </div>
          ))}
          <div className="grid grid-cols-3 gap-1.5">
            {(["general", "premium", "vip"] as const).map((t) => (
              <button key={t} onClick={() => setForm((p) => ({ ...p, membershipType: t }))}
                className={`py-1.5 rounded-lg text-xs font-medium border transition-colors ${form.membershipType === t ? "border-primary text-primary bg-primary/10" : "border-border text-muted-foreground"}`}>
                {MEMBERSHIP_LABELS[t]}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">시작일</Label>
              <Input type="date" value={form.membershipStart} onChange={(e) => setForm((p) => ({ ...p, membershipStart: e.target.value }))} className="bg-background border-border text-xs h-8" />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">만료일</Label>
              <Input type="date" value={form.membershipEnd} onChange={(e) => setForm((p) => ({ ...p, membershipEnd: e.target.value }))} className="bg-background border-border text-xs h-8" />
            </div>
          </div>
          <Button size="sm" className="w-full" disabled={createMutation.isPending}
            onClick={() => createMutation.mutate({ ...form, phone: form.phone || undefined, membershipStart: form.membershipStart || undefined, membershipEnd: form.membershipEnd || undefined })}>
            {createMutation.isPending ? "추가 중..." : "추가"}
          </Button>
        </div>
      )}

      {editMember && (
        <div className="bg-muted/40 rounded-xl p-4 space-y-3 border border-border">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">회원 수정</p>
            <button onClick={() => setEditMember(null)}><X className="h-4 w-4 text-muted-foreground" /></button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">시작일</Label>
              <Input type="date" value={editMember.membershipStart ?? ""}
                onChange={(e) => setEditMember((p: any) => ({ ...p, membershipStart: e.target.value }))} className="bg-background border-border text-xs h-8" />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">만료일</Label>
              <Input type="date" value={editMember.membershipEnd ?? ""}
                onChange={(e) => setEditMember((p: any) => ({ ...p, membershipEnd: e.target.value }))} className="bg-background border-border text-xs h-8" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {(["general", "premium", "vip"] as const).map((t) => (
              <button key={t} onClick={() => setEditMember((p: any) => ({ ...p, membershipType: t }))}
                className={`py-1.5 rounded-lg text-xs font-medium border transition-colors ${editMember.membershipType === t ? "border-primary text-primary bg-primary/10" : "border-border text-muted-foreground"}`}>
                {MEMBERSHIP_LABELS[t]}
              </button>
            ))}
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">새 비밀번호 (변경 시만 입력)</Label>
            <Input type="password" placeholder="6자 이상" value={editMember.newPassword ?? ""}
              onChange={(e) => setEditMember((p: any) => ({ ...p, newPassword: e.target.value }))} className="bg-background border-border text-sm h-8" />
          </div>
          <Button size="sm" className="w-full" disabled={updateMutation.isPending}
            onClick={() => updateMutation.mutate({ id: editMember.id, membershipType: editMember.membershipType, membershipStart: editMember.membershipStart || undefined, membershipEnd: editMember.membershipEnd || undefined, password: editMember.newPassword || undefined })}>
            {updateMutation.isPending ? "저장 중..." : "저장"}
          </Button>
        </div>
      )}

      <div className="space-y-2">
        {!members || members.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-4">등록된 회원이 없습니다</p>
        ) : (
          members.map((m) => (
            <div key={m.id} className="bg-background border border-border rounded-xl p-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold">{m.name}</p>
                <p className="text-[10px] text-muted-foreground">{MEMBERSHIP_LABELS[m.membershipType] ?? m.membershipType} · {m.phone ?? m.username}</p>
                {m.membershipEnd && <p className="text-[10px] text-muted-foreground">만료: {m.membershipEnd}</p>}
              </div>
              <div className="flex gap-1.5">
                <button onClick={() => setEditMember({ ...m, newPassword: "" })} className="text-muted-foreground hover:text-primary">
                  <Edit2 className="h-3.5 w-3.5" />
                </button>
                <button onClick={() => { if (confirm(`${m.name} 회원을 삭제하시겠습니까?`)) deleteMutation.mutate({ id: m.id }); }} className="text-muted-foreground hover:text-red-400">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ── 출석 현황 섹션 ──────────────────────────────────────────────────────────
function AttendanceSection() {
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const { data: attendance } = trpc.fitStepPlus.trainer_listAttendance.useQuery({ date });

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="bg-input border-border text-sm h-8 flex-1" />
        <button onClick={() => setDate(today)} className="text-xs text-primary bg-primary/10 px-3 py-1.5 rounded-lg">오늘</button>
      </div>
      <p className="text-xs text-muted-foreground">{date} · {attendance?.length ?? 0}명 출석</p>
      {!attendance || attendance.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground py-4">출석 기록이 없습니다</p>
      ) : (
        <div className="space-y-2">
          {attendance.map((a, i) => (
            <div key={i} className="bg-background border border-border rounded-xl p-3 flex items-center gap-3">
              <div className="w-7 h-7 rounded-full bg-green-500/20 flex items-center justify-center text-xs">✅</div>
              <div>
                <p className="text-sm font-semibold">{a.name}</p>
                <p className="text-[10px] text-muted-foreground">{a.attendDate} 출석</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── 운동기록 조회 섹션 ──────────────────────────────────────────────────────
function WorkoutLogSection() {
  const today = new Date().toISOString().slice(0, 10);
  const [month, setMonth] = useState(today.slice(0, 7));
  const { data: logs } = trpc.fitStepPlus.trainer_listWorkoutLogs.useQuery({ month });
  const months = Array.from({ length: 4 }, (_, i) => { const d = new Date(); d.setMonth(d.getMonth() - i); return d.toISOString().slice(0, 7); });

  return (
    <div className="space-y-3">
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {months.map((m) => (
          <button key={m} onClick={() => setMonth(m)}
            className={`flex-shrink-0 px-2.5 py-1 rounded-full text-[10px] font-medium transition-colors ${month === m ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
            {m.replace("-", "년 ")}월
          </button>
        ))}
      </div>
      {!logs || logs.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground py-4">운동 기록이 없습니다</p>
      ) : (
        <div className="space-y-2">
          {logs.map((log) => (
            <div key={log.id} className="bg-background border border-border rounded-xl p-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">{log.memberName} · {log.logDate}</p>
                  <p className="text-sm font-semibold">{log.title || "운동 기록"}</p>
                </div>
                {log.durationMinutes && <span className="text-[10px] text-muted-foreground">⏱ {log.durationMinutes}분</span>}
              </div>
              {log.notes && <p className="text-[10px] text-muted-foreground mt-1 line-clamp-2">{log.notes}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── FIT STEP+ 메인 관리 패널 ────────────────────────────────────────────────
function FitStepPlusPanel({ trainerId }: { trainerId: number }) {
  const [, navigate] = useLocation();
  const [activeSection, setActiveSection] = useState<"members" | "attendance" | "workoutlogs" | "videos" | "events" | null>(null);
  const [copied, setCopied] = useState(false);

  function copyLink() {
    const url = `${window.location.origin}/fit-step-plus/${trainerId}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const sections = [
    { key: "members" as const, label: "회원 관리", icon: Users, desc: "FIT STEP+ 회원 등록 및 관리" },
    { key: "attendance" as const, label: "출석 현황", icon: CalendarCheck, desc: "회원 출석 체크 현황" },
    { key: "workoutlogs" as const, label: "운동기록 조회", icon: ClipboardList, desc: "회원 운동기록 확인" },
    { key: "videos" as const, label: "운동 영상", icon: Video, desc: "영상 등록 및 카테고리 관리" },
    { key: "events" as const, label: "공지/이벤트", icon: Bell, desc: "공지, 이벤트, 프로모션 관리" },
  ];

  return (
    <div className="space-y-4">
      {/* 회원 앱 바로가기 */}
      <div className="bg-primary/10 border border-primary/20 rounded-xl p-4 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold">
            <span className="font-black" style={{ fontFamily: "'Bebas Neue', 'Arial Black', Arial, sans-serif" }}>FIT</span>
            <span className="font-black text-primary" style={{ fontFamily: "'Bebas Neue', 'Arial Black', Arial, sans-serif" }}>STEP</span>
            <span className="font-black text-primary" style={{ fontFamily: "'Bebas Neue', 'Arial Black', Arial, sans-serif" }}>+</span>
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
              {key === "members" && <MemberSection />}
              {key === "attendance" && <AttendanceSection />}
              {key === "workoutlogs" && <WorkoutLogSection />}
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

// ── 운동 프로그램 템플릿 관리 ─────────────────────────────────────────────────
function WorkoutTemplateEditor() {
  const utils = trpc.useUtils();
  const { data: templates } = trpc.workoutTemplates.list.useQuery();
  const createMutation = trpc.workoutTemplates.create.useMutation({
    onSuccess: () => { utils.workoutTemplates.list.invalidate(); setShowForm(false); setForm({ name: "", description: "", bodyPart: "", exercises: "" }); toast.success("템플릿이 저장되었습니다."); },
    onError: e => toast.error(e.message),
  });
  const deleteMutation = trpc.workoutTemplates.delete.useMutation({
    onSuccess: () => utils.workoutTemplates.list.invalidate(),
  });
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", bodyPart: "", exercises: "" });

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">자주 사용하는 운동 루틴을 저장해두고 트레이닝 일지 작성 시 불러올 수 있습니다.</p>
      <button onClick={() => setShowForm(v => !v)} className="flex items-center gap-1.5 text-xs text-primary font-medium">
        <Plus className="h-3.5 w-3.5" />{showForm ? "취소" : "새 템플릿 추가"}
      </button>
      {showForm && (
        <div className="bg-accent/20 border border-border rounded-xl p-4 space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">템플릿 이름 *</Label>
            <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="예: 하체 기본 루틴" className="text-sm h-8" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">운동 부위</Label>
            <Input value={form.bodyPart} onChange={e => setForm(p => ({ ...p, bodyPart: e.target.value }))} placeholder="예: 하체, 코어" className="text-sm h-8" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">운동 종목 (줄바꿈으로 구분)</Label>
            <textarea value={form.exercises} onChange={e => setForm(p => ({ ...p, exercises: e.target.value }))}
              rows={5} placeholder={"스쿼트\n레그프레스\n레그컬\n카프레이즈"}
              className="w-full bg-background border border-border rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-primary" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">메모 (선택)</Label>
            <Input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="루틴 설명" className="text-sm h-8" />
          </div>
          <Button size="sm" className="w-full" disabled={!form.name || createMutation.isPending}
            onClick={() => {
              const exercises = form.exercises.split("\n").map(n => n.trim()).filter(Boolean).map(name => ({ name, sets: [] }));
              createMutation.mutate({ name: form.name, description: form.description || undefined, bodyPart: form.bodyPart || undefined, exercisesJson: exercises.length > 0 ? JSON.stringify(exercises) : undefined });
            }}>
            {createMutation.isPending ? "저장 중..." : "저장"}
          </Button>
        </div>
      )}
      <div className="space-y-2">
        {(templates ?? []).length === 0 && <p className="text-xs text-muted-foreground text-center py-4">저장된 템플릿이 없습니다.</p>}
        {(templates ?? []).map((t: any) => (
          <div key={t.id} className="flex items-start justify-between gap-2 bg-accent/10 border border-border rounded-xl p-3">
            <div>
              <p className="text-sm font-medium">{t.name}</p>
              {t.bodyPart && <p className="text-xs text-muted-foreground mt-0.5">{t.bodyPart}</p>}
              {t.exercisesJson && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {JSON.parse(t.exercisesJson).map((e: any) => e.name).join(" · ")}
                </p>
              )}
            </div>
            <button onClick={() => deleteMutation.mutate({ id: t.id })} className="text-muted-foreground hover:text-red-400 shrink-0">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── 맞춤 상담 설문 빌더 ───────────────────────────────────────────────────────
function SurveyBuilder() {
  const { data: user } = trpc.auth.me.useQuery();
  const utils = trpc.useUtils();
  const { data: questions } = trpc.survey.listQuestions.useQuery();
  const { data: responses } = trpc.survey.listResponses.useQuery();
  const createMutation = trpc.survey.createQuestion.useMutation({
    onSuccess: () => { utils.survey.listQuestions.invalidate(); setShowForm(false); setForm({ question: "", type: "text", options: "", isRequired: 0 }); toast.success("문항이 추가되었습니다."); },
  });
  const deleteMutation = trpc.survey.deleteQuestion.useMutation({
    onSuccess: () => utils.survey.listQuestions.invalidate(),
  });
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ question: "", type: "text" as "text" | "choice" | "scale", options: "", isRequired: 0 });
  const [showResponses, setShowResponses] = useState(false);

  const username = (user as any)?.username;
  const surveyUrl = `${window.location.origin}/survey/${username}`;

  const TYPE_LABELS = { text: "주관식", choice: "객관식", scale: "1~5점 척도" };

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">상담 전 고객에게 보낼 맞춤 설문을 만드세요.</p>
      <button onClick={() => { navigator.clipboard.writeText(surveyUrl); toast.success("설문 링크 복사됨!"); }}
        className="w-full flex items-center gap-2 px-3 py-2.5 bg-primary/10 border border-primary/30 rounded-xl text-xs text-primary">
        <Copy className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">{surveyUrl}</span>
      </button>
      <button onClick={() => setShowForm(v => !v)} className="flex items-center gap-1.5 text-xs text-primary font-medium">
        <Plus className="h-3.5 w-3.5" />{showForm ? "취소" : "문항 추가"}
      </button>
      {showForm && (
        <div className="bg-accent/20 border border-border rounded-xl p-4 space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">유형</Label>
            <div className="flex gap-2">
              {(["text", "choice", "scale"] as const).map(t => (
                <button key={t} onClick={() => setForm(p => ({ ...p, type: t }))}
                  className={`flex-1 py-1.5 rounded-lg text-xs border transition-colors ${form.type === t ? "bg-primary/20 border-primary text-primary" : "border-border text-muted-foreground"}`}>
                  {TYPE_LABELS[t]}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">질문 *</Label>
            <Input value={form.question} onChange={e => setForm(p => ({ ...p, question: e.target.value }))} placeholder="예: 운동 목적이 무엇인가요?" className="text-sm h-8" />
          </div>
          {form.type === "choice" && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">선택지 (쉼표로 구분)</Label>
              <Input value={form.options} onChange={e => setForm(p => ({ ...p, options: e.target.value }))} placeholder="다이어트, 근력강화, 재활, 체형교정" className="text-sm h-8" />
            </div>
          )}
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.isRequired === 1} onChange={e => setForm(p => ({ ...p, isRequired: e.target.checked ? 1 : 0 }))} className="rounded" />
            <span className="text-xs text-muted-foreground">필수 응답</span>
          </label>
          <Button size="sm" className="w-full" disabled={!form.question || createMutation.isPending}
            onClick={() => createMutation.mutate({ ...form, sortOrder: (questions?.length ?? 0) })}>
            {createMutation.isPending ? "추가 중..." : "추가"}
          </Button>
        </div>
      )}
      <div className="space-y-2">
        {(questions ?? []).length === 0 && <p className="text-xs text-muted-foreground text-center py-4">등록된 문항이 없습니다.</p>}
        {(questions ?? []).map((q: any, i: number) => (
          <div key={q.id} className="flex items-start justify-between gap-2 bg-accent/10 border border-border rounded-xl p-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs bg-primary/20 text-primary px-1.5 py-0.5 rounded font-medium">{TYPE_LABELS[q.type as "text" | "choice" | "scale"] ?? q.type}</span>
                {q.isRequired ? <span className="text-xs text-red-400">필수</span> : null}
              </div>
              <p className="text-sm mt-1">{i + 1}. {q.question}</p>
              {q.options && <p className="text-xs text-muted-foreground mt-0.5">{q.options}</p>}
            </div>
            <button onClick={() => deleteMutation.mutate({ id: q.id })} className="text-muted-foreground hover:text-red-400 shrink-0">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
      {responses && responses.length > 0 && (
        <div className="space-y-2">
          <button onClick={() => setShowResponses(v => !v)} className="text-xs text-primary font-medium flex items-center gap-1">
            응답 목록 ({responses.length}건) {showResponses ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>
          {showResponses && responses.map((r: any) => (
            <div key={r.id} className="bg-background border border-border rounded-xl p-3 space-y-1.5">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">{r.respondentName}</p>
                <p className="text-xs text-muted-foreground">{r.createdAt?.slice(0, 10)}</p>
              </div>
              {r.respondentPhone && <p className="text-xs text-muted-foreground">{r.respondentPhone}</p>}
              {Object.entries(JSON.parse(r.answers ?? "{}")).map(([qId, ans]) => {
                const q = (questions ?? []).find((q: any) => String(q.id) === qId);
                return q ? (
                  <div key={qId} className="text-xs">
                    <span className="text-muted-foreground">{q.question}: </span>
                    <span className="text-foreground">{String(ans)}</span>
                  </div>
                ) : null;
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── 브랜드 페이지 에디터 ─────────────────────────────────────────────────────
function BrandPageEditor({ bookingOnly }: { bookingOnly?: boolean } = {}) {
  const { data: user } = trpc.auth.me.useQuery();
  const utils = trpc.useUtils();
  const { data: brand, isLoading } = trpc.brand.getMyBrand.useQuery();
  const { data: bookings } = trpc.brand.listBookings.useQuery();
  const updateMutation = trpc.brand.updateMyBrand.useMutation({
    onSuccess: () => { toast.success("저장되었습니다."); utils.brand.getMyBrand.invalidate(); },
    onError: e => toast.error(e.message),
  });
  const statusMutation = trpc.brand.updateBookingStatus.useMutation({
    onSuccess: () => utils.brand.listBookings.invalidate(),
  });
  const spendFeatureMutation = trpc.fitPoints.spendFeature.useMutation();
  const [showShareConfirm, setShowShareConfirm] = useState(false);

  const [form, setForm] = useState({
    brandBio: "", brandSpecialties: "", brandColor: "#1a00ff",
    brandInstagram: "", brandKakao: "", brandYoutube: "",
    brandIsPublic: 0, bookingEnabled: 0, bookingMessage: "",
  });
  const [initialized, setInitialized] = useState(false);

  if (!initialized && brand) {
    setForm({
      brandBio: brand.brandBio ?? "",
      brandSpecialties: brand.brandSpecialties ?? "",
      brandColor: brand.brandColor ?? "#1a00ff",
      brandInstagram: brand.brandInstagram ?? "",
      brandKakao: brand.brandKakao ?? "",
      brandYoutube: brand.brandYoutube ?? "",
      brandIsPublic: brand.brandIsPublic ?? 0,
      bookingEnabled: brand.bookingEnabled ?? 0,
      bookingMessage: brand.bookingMessage ?? "",
    });
    setInitialized(true);
  }

  const username = (user as any)?.username;
  const brandUrl = `${window.location.origin}/p/${username}`;

  if (isLoading) return <p className="text-sm text-muted-foreground text-center py-4">로딩 중...</p>;

  if (bookingOnly) {
    return (
      <div className="space-y-5">
        <div className="space-y-3 p-3 bg-accent/20 rounded-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />
              <p className="text-sm font-medium">상담 예약 받기</p>
            </div>
            <button
              onClick={() => setForm(p => ({ ...p, bookingEnabled: p.bookingEnabled ? 0 : 1 }))}
              className={`w-12 h-6 rounded-full transition-colors relative ${form.bookingEnabled ? "bg-primary" : "bg-muted"}`}
            >
              <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${form.bookingEnabled ? "left-6" : "left-0.5"}`} />
            </button>
          </div>
          {form.bookingEnabled ? (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">예약 안내 메시지</Label>
              <textarea value={form.bookingMessage} onChange={e => setForm(p => ({ ...p, bookingMessage: e.target.value }))}
                rows={2} placeholder="상담 가능 시간이나 안내 문구를 입력하세요..."
                className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
          ) : null}
        </div>
        <Button size="sm" className="w-full" disabled={updateMutation.isPending}
          onClick={() => updateMutation.mutate(form as any)}>
          {updateMutation.isPending ? "저장 중..." : "저장"}
        </Button>
        {bookings && bookings.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground">들어온 예약 ({bookings.length})</p>
            {bookings.map((b: any) => (
              <div key={b.id} className="bg-background border border-border rounded-xl p-3 space-y-1">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">{b.name} · {b.phone}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${b.status === "confirmed" ? "bg-green-500/20 text-green-600" : b.status === "cancelled" ? "bg-red-500/20 text-red-500" : "bg-blue-500/20 text-blue-500"}`}>
                    {b.status === "confirmed" ? "확인" : b.status === "cancelled" ? "취소" : "대기"}
                  </span>
                </div>
                {b.message && <p className="text-xs text-muted-foreground">{b.message}</p>}
                {b.status === "pending" && (
                  <div className="flex gap-2 pt-1">
                    <button onClick={() => statusMutation.mutate({ bookingId: b.id, status: "confirmed" })}
                      className="flex-1 text-xs py-1.5 rounded-lg bg-green-500/10 text-green-600 font-medium">확인</button>
                    <button onClick={() => statusMutation.mutate({ bookingId: b.id, status: "cancelled" })}
                      className="flex-1 text-xs py-1.5 rounded-lg bg-red-500/10 text-red-500 font-medium">취소</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* 공개 여부 + 링크 */}
      <div className="flex items-center justify-between p-3 bg-accent/20 rounded-xl">
        <div>
          <p className="text-sm font-medium">브랜드 페이지 공개</p>
          <p className="text-xs text-muted-foreground mt-0.5">/p/{username}</p>
        </div>
        <button
          onClick={() => setForm(p => ({ ...p, brandIsPublic: p.brandIsPublic ? 0 : 1 }))}
          className={`w-12 h-6 rounded-full transition-colors relative ${form.brandIsPublic ? "bg-primary" : "bg-muted"}`}
        >
          <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${form.brandIsPublic ? "left-6" : "left-0.5"}`} />
        </button>
      </div>

      {form.brandIsPublic ? (
        <>
          <button onClick={() => setShowShareConfirm(true)}
            className="w-full flex items-center gap-2 px-3 py-2.5 bg-primary/10 border border-primary/30 rounded-xl text-xs text-primary">
            <Globe className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{brandUrl}</span>
            <span className="text-primary/70 shrink-0">-50P</span>
            <Copy className="h-3.5 w-3.5 shrink-0" />
          </button>
          <PointSpendConfirm
            open={showShareConfirm}
            onClose={() => setShowShareConfirm(false)}
            featureName="브랜딩 페이지 공유"
            loading={spendFeatureMutation.isPending}
            onConfirm={() => {
              spendFeatureMutation.mutate({ feature: "branding_share" }, {
                onSuccess: () => {
                  setShowShareConfirm(false);
                  navigator.clipboard.writeText(brandUrl);
                  toast.success("링크 복사됨!");
                },
                onError: (e) => toast.error(e.message),
              });
            }}
          />
        </>
      ) : null}

      {/* 브랜드 컬러 */}
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">브랜드 컬러</Label>
        <div className="flex items-center gap-3">
          <input type="color" value={form.brandColor} onChange={e => setForm(p => ({ ...p, brandColor: e.target.value }))}
            className="w-12 h-10 rounded-lg border border-border cursor-pointer p-0.5 bg-background" />
          <span className="text-sm text-muted-foreground font-mono">{form.brandColor}</span>
        </div>
      </div>

      {/* 소개글 */}
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">소개글</Label>
        <textarea value={form.brandBio} onChange={e => setForm(p => ({ ...p, brandBio: e.target.value }))}
          rows={4} placeholder="트레이너 소개를 입력하세요..."
          className="w-full bg-background border border-border rounded-xl px-3 py-2.5 text-sm text-foreground resize-none focus:outline-none focus:ring-1 focus:ring-primary" />
      </div>

      {/* 전문 분야 */}
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">전문 분야 (쉼표로 구분)</Label>
        <Input value={form.brandSpecialties} onChange={e => setForm(p => ({ ...p, brandSpecialties: e.target.value }))}
          placeholder="다이어트, 근력 강화, 재활, 체형 교정" className="text-sm" />
      </div>

      {/* 소셜 링크 */}
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">소셜 링크</Label>
        <div className="flex items-center gap-2">
          <Instagram className="h-4 w-4 text-muted-foreground shrink-0" />
          <Input value={form.brandInstagram} onChange={e => setForm(p => ({ ...p, brandInstagram: e.target.value }))}
            placeholder="https://instagram.com/..." className="text-sm h-8" />
        </div>
        <div className="flex items-center gap-2">
          <MessageCircle className="h-4 w-4 text-muted-foreground shrink-0" />
          <Input value={form.brandKakao} onChange={e => setForm(p => ({ ...p, brandKakao: e.target.value }))}
            placeholder="카카오 채널 링크" className="text-sm h-8" />
        </div>
        <div className="flex items-center gap-2">
          <Youtube className="h-4 w-4 text-muted-foreground shrink-0" />
          <Input value={form.brandYoutube} onChange={e => setForm(p => ({ ...p, brandYoutube: e.target.value }))}
            placeholder="https://youtube.com/..." className="text-sm h-8" />
        </div>
      </div>

      {/* 상담 예약 */}
      <div className="space-y-3 p-3 bg-accent/20 rounded-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" />
            <p className="text-sm font-medium">상담 예약 받기</p>
          </div>
          <button
            onClick={() => setForm(p => ({ ...p, bookingEnabled: p.bookingEnabled ? 0 : 1 }))}
            className={`w-12 h-6 rounded-full transition-colors relative ${form.bookingEnabled ? "bg-primary" : "bg-muted"}`}
          >
            <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${form.bookingEnabled ? "left-6" : "left-0.5"}`} />
          </button>
        </div>
        {form.bookingEnabled ? (
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">예약 안내 메시지</Label>
            <textarea value={form.bookingMessage} onChange={e => setForm(p => ({ ...p, bookingMessage: e.target.value }))}
              rows={2} placeholder="상담 가능 시간이나 안내 문구를 입력하세요..."
              className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-primary" />
          </div>
        ) : null}
      </div>

      <Button size="sm" className="w-full" disabled={updateMutation.isPending}
        onClick={() => updateMutation.mutate(form as any)}>
        {updateMutation.isPending ? "저장 중..." : "저장"}
      </Button>

      {/* 예약 목록 */}
      {bookings && bookings.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground">들어온 예약 ({bookings.length})</p>
          {bookings.map((b: any) => (
            <div key={b.id} className="bg-background border border-border rounded-xl p-3 space-y-1">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">{b.name} · {b.phone}</p>
                <span className={`text-xs px-2 py-0.5 rounded-full ${b.status === "confirmed" ? "bg-green-500/20 text-green-600" : b.status === "cancelled" ? "bg-red-500/20 text-red-500" : "bg-blue-500/20 text-blue-500"}`}>
                  {b.status === "confirmed" ? "확인" : b.status === "cancelled" ? "취소" : "대기"}
                </span>
              </div>
              {b.interestType && <p className="text-xs text-muted-foreground">{b.interestType}</p>}
              {b.message && <p className="text-xs text-muted-foreground">{b.message}</p>}
              {b.status === "pending" && (
                <div className="flex gap-2 pt-1">
                  <button onClick={() => statusMutation.mutate({ bookingId: b.id, status: "confirmed" })}
                    className="flex-1 text-xs py-1.5 rounded-lg bg-green-500/10 text-green-600 font-medium">확인</button>
                  <button onClick={() => statusMutation.mutate({ bookingId: b.id, status: "cancelled" })}
                    className="flex-1 text-xs py-1.5 rounded-lg bg-red-500/10 text-red-500 font-medium">취소</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── 회원 보고서 브랜딩 에디터 ──────────────────────────────────────────────────
function ReportBrandingEditor() {
  const utils = trpc.useUtils();
  const { data: brand } = trpc.brand.getMyBrand.useQuery();
  const updateMutation = trpc.brand.updateMyBrand.useMutation({
    onSuccess: () => { utils.brand.getMyBrand.invalidate(); toast.success("저장되었습니다"); },
    onError: (e) => toast.error(e.message),
  });

  const brandingEnabled = !!(brand as any)?.brandColor || !!(brand as any)?.brandBio;

  return (
    <div className="space-y-4">
      <div className="bg-muted/40 border border-border rounded-xl p-3 space-y-2">
        <p className="text-xs font-semibold text-muted-foreground">미리보기 · 공유 보고서 상단</p>
        <div className="rounded-lg overflow-hidden border border-border">
          <div className="h-2" style={{ background: (brand as any)?.brandColor || "#1a80ff" }} />
          <div className="flex items-center gap-3 p-3 bg-background">
            <div className="w-10 h-10 rounded-full bg-muted border border-border overflow-hidden flex items-center justify-center">
              {(brand as any)?.profileImage ? (
                <img src={(brand as any).profileImage} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-xs text-muted-foreground">사진</span>
              )}
            </div>
            <div>
              <p className="text-sm font-bold">{(brand as any)?.trainerName ?? "트레이너 이름"}</p>
              <p className="text-xs text-muted-foreground">트레이너 · Powered by FIT STEP</p>
            </div>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">공유 보고서에 위 형태로 내 정보가 표시됩니다.</p>
      </div>

      <div className="space-y-2">
        <Label className="text-xs">브랜드 컬러</Label>
        <div className="flex items-center gap-3">
          <input
            type="color"
            value={(brand as any)?.brandColor || "#1a80ff"}
            onChange={(e) => updateMutation.mutate({ brandColor: e.target.value } as any)}
            className="w-10 h-10 rounded-lg border border-border cursor-pointer bg-transparent"
          />
          <span className="text-sm text-muted-foreground">{(brand as any)?.brandColor || "#1a80ff"}</span>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">브랜드 컬러를 설정하면 공유 보고서에 자동으로 적용됩니다. 프로필 사진·이름은 프로필 페이지에서 변경할 수 있습니다.</p>
    </div>
  );
}

// ── 잠금 게이트 ────────────────────────────────────────────────────────────────
function FeatureCard({
  icon,
  title,
  desc,
  featureKey,
  pointCost,
  isUnlocked,
  isOpen,
  onToggle,
  onUnlock,
  unlocking,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  featureKey: string;
  pointCost: number;
  isUnlocked: boolean;
  isOpen: boolean;
  onToggle: () => void;
  onUnlock: () => void;
  unlocking: boolean;
  children: React.ReactNode;
}) {
  return (
    <Card className={`border-border ${!isUnlocked ? "opacity-90" : ""}`}>
      <button
        className="w-full flex items-center justify-between px-4 py-3 text-left"
        onClick={isUnlocked ? onToggle : undefined}
      >
        <div className="flex items-center gap-2.5">
          <span className={isUnlocked ? "text-primary" : "text-muted-foreground"}>{icon}</span>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm">{title}</span>
              {!isUnlocked && (
                <span className="flex items-center gap-1 text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-medium">
                  <Lock className="h-3 w-3" />{pointCost.toLocaleString()}P
                </span>
              )}
              {isUnlocked && (
                <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-medium">잠금해제</span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
          </div>
        </div>
        {isUnlocked ? (
          isOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <Lock className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {!isUnlocked && (
        <CardContent className="pt-0 pb-4">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex flex-col items-center gap-3">
            <Lock className="h-8 w-8 text-amber-500" />
            <div className="text-center">
              <p className="text-sm font-semibold text-amber-800">핏포인트로 잠금해제</p>
              <p className="text-xs text-amber-600 mt-0.5">{pointCost.toLocaleString()} 포인트를 사용하여 기능을 영구 활성화합니다</p>
            </div>
            <Button size="sm" className="bg-amber-500 hover:bg-amber-600 text-white gap-1.5" onClick={onUnlock} disabled={unlocking}>
              <Coins className="h-3.5 w-3.5" />
              {unlocking ? "처리 중..." : `${pointCost.toLocaleString()}P 사용하여 열기`}
            </Button>
          </div>
        </CardContent>
      )}

      {isUnlocked && isOpen && (
        <CardContent className="pt-0 pb-4">{children}</CardContent>
      )}
    </Card>
  );
}

const PREVIEW_FEATURES = [
  {
    key: "brand_page",
    icon: <Globe className="h-5 w-5" />,
    title: "내 브랜드 페이지",
    desc: "나만의 트레이너 소개 페이지를 만들고 링크 하나로 고객에게 공유하세요. 전문 분야, 소개글, 소셜 미디어를 한 곳에 담을 수 있습니다.",
  },
  {
    key: "booking",
    icon: <Calendar className="h-5 w-5" />,
    title: "상담 예약 링크",
    desc: "고객이 직접 상담을 신청할 수 있는 예약 폼을 제공합니다. 신청이 들어오면 리드로 자동 등록되어 관리가 편해집니다.",
  },
  {
    key: "report_branding",
    icon: <BookMarked className="h-5 w-5" />,
    title: "회원 보고서 브랜딩",
    desc: "회원에게 공유하는 운동 보고서에 내 프로필과 브랜드 컬러를 표시합니다. 전문적인 인상을 남기고 신뢰를 높이세요.",
  },
  {
    key: "templates",
    icon: <Dumbbell className="h-5 w-5" />,
    title: "운동 프로그램 템플릿",
    desc: "자주 쓰는 루틴을 템플릿으로 저장하고 일지 작성 시 불러와 빠르게 입력하세요. 반복 작업을 대폭 줄여줍니다.",
  },
  {
    key: "survey",
    icon: <ClipboardList className="h-5 w-5" />,
    title: "맞춤 상담 설문 빌더",
    desc: "상담 전에 고객 정보를 미리 수집하는 설문을 직접 만들어 링크로 공유하세요. 주관식·객관식·척도 문항을 자유롭게 구성할 수 있습니다.",
  },
];

// WORKSHOP_LOCKED가 true일 때 보여주는 화면
// (compile-time constant이므로 hooks 규칙 위반 없음)
function WorkshopLockedView() {
  const { data: user } = trpc.auth.me.useQuery();
  const trainerId = (user as any)?.trainerId as number | undefined;
  const isAdmin = (user as any)?.role === "admin";

  // 어드민은 전체 작업실 기능 접근
  if (isAdmin) return <WorkshopContent />;

  // 트레이너는 FIT STEP+ 패널 접근
  if (trainerId) {
    return (
      <div className="space-y-4">
        <TabBanner tabKey="workshop" />
        <div className="flex items-center gap-2">
          <div>
            <p className="text-base font-bold">
              <span style={{ fontFamily: "'Bebas Neue', 'Arial Black', Arial, sans-serif" }}>FIT</span>
              <span className="text-primary" style={{ fontFamily: "'Bebas Neue', 'Arial Black', Arial, sans-serif" }}>STEP</span>
              <span className="text-primary font-black" style={{ fontFamily: "'Bebas Neue', 'Arial Black', Arial, sans-serif" }}>+</span>
              <span className="text-sm font-semibold ml-2">관리</span>
            </p>
            <p className="text-xs text-muted-foreground">작업실의 다른 기능은 업데이트 준비 중입니다</p>
          </div>
          <span className="text-[10px] bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-semibold ml-auto shrink-0">🔧 일부 개발 중</span>
        </div>
        <FitStepPlusPanel trainerId={trainerId} />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4 px-6">
      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
        <Wrench className="h-8 w-8 text-muted-foreground" />
      </div>
      <div className="space-y-1.5">
        <p className="text-xl font-bold">작업실</p>
        <span className="inline-block text-xs bg-yellow-100 text-yellow-700 px-2.5 py-1 rounded-full font-semibold">🔧 개발 중</span>
        <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
          현재 업데이트 작업 중입니다.<br />조금만 기다려 주세요!
        </p>
      </div>
    </div>
  );
}

function WorkshopContent() {
  const { data: user } = trpc.auth.me.useQuery();
  const utils = trpc.useUtils();
  const [openSection, setOpenSection] = useState<string | null>(null);
  const [unlockingKey, setUnlockingKey] = useState<string | null>(null);
  const [showOpenModal, setShowOpenModal] = useState(false);
  const trainerId = (user as any)?.trainerId as number | undefined;
  const isAdmin = (user as any)?.role === "admin";

  const { data: unlocks, isLoading: unlocksLoading } = trpc.workshop.listUnlocks.useQuery();
  const unlockMutation = trpc.workshop.unlock.useMutation({
    onSuccess: (_data, vars) => {
      utils.workshop.listUnlocks.invalidate();
      utils.fitPoints.getBalance.invalidate();
      if (vars.feature === "workshop_access") {
        toast.success("작업실이 오픈되었습니다!");
        setShowOpenModal(false);
      } else {
        toast.success("기능이 잠금해제되었습니다!");
        setOpenSection(vars.feature);
      }
      setUnlockingKey(null);
    },
    onError: (e) => { toast.error(e.message); setUnlockingKey(null); },
  });

  function toggle(key: string) {
    setOpenSection(v => v === key ? null : key);
  }

  function handleUnlock(feature: string) {
    setUnlockingKey(feature);
    unlockMutation.mutate({ feature });
  }

  function isUnlocked(feature: string) {
    return unlocks?.find((u: any) => u.key === feature)?.unlocked ?? false;
  }

  function pointCost(feature: string) {
    return unlocks?.find((u: any) => u.key === feature)?.points ?? 0;
  }

  const workshopOpen = isAdmin || isUnlocked("workshop_access");

  if (unlocksLoading) {
    return (
      <div className="space-y-4">
        <TabBanner tabKey="workshop" />
        <div className="flex items-center justify-center py-20">
          <p className="text-sm text-muted-foreground">로딩 중...</p>
        </div>
      </div>
    );
  }

  // ── 잠긴 상태: 프리뷰 + 오픈 모달 ──────────────────────────────────────────
  if (!workshopOpen) {
    return (
      <div className="space-y-4">
        <TabBanner tabKey="workshop" />
        <div>
          <h1 className="text-xl font-bold">작업실</h1>
          <p className="text-sm text-muted-foreground mt-0.5">핏포인트로 작업실을 오픈하고 브랜딩 기능을 사용하세요</p>
        </div>

        {/* 오픈 CTA 배너 */}
        <div className="rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 p-5 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-primary" />
            <p className="font-bold text-base">작업실이 잠겨 있습니다</p>
          </div>
          <p className="text-sm text-muted-foreground">아래 기능들은 작업실을 오픈한 트레이너만 사용할 수 있습니다. 핏포인트 50,000P를 사용하면 모든 기능에 접근할 수 있습니다.</p>
          <Button className="w-full gap-2 mt-1" onClick={() => setShowOpenModal(true)}>
            <Coins className="h-4 w-4" />
            작업실 오픈하기 · 50,000P
          </Button>
        </div>

        {/* 기능 프리뷰 카드들 */}
        <div className="space-y-3">
          {PREVIEW_FEATURES.map(f => (
            <Card key={f.key} className="bg-card border-border opacity-80">
              <div className="flex items-start gap-3 px-4 py-4">
                <span className="text-muted-foreground mt-0.5 shrink-0">{f.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-semibold text-sm">{f.title}</p>
                    <Lock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{f.desc}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* 오픈 확인 모달 */}
        {showOpenModal && (
          <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
            <div className="absolute inset-0 bg-black/40" onClick={() => setShowOpenModal(false)} />
            <div className="relative bg-card rounded-t-2xl sm:rounded-2xl w-full max-w-sm p-6 space-y-5 shadow-2xl">
              <div className="flex items-center justify-between">
                <p className="text-lg font-bold">작업실 오픈</p>
                <button onClick={() => setShowOpenModal(false)} className="p-1 rounded-lg hover:bg-muted">
                  <X className="h-5 w-5 text-muted-foreground" />
                </button>
              </div>

              <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 space-y-3">
                <p className="text-sm font-semibold text-primary">포함 기능</p>
                <ul className="space-y-2">
                  {PREVIEW_FEATURES.map(f => (
                    <li key={f.key} className="flex items-center gap-2 text-sm">
                      <span className="text-primary shrink-0">{f.icon}</span>
                      <span>{f.title}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="flex items-center justify-between p-3 bg-amber-50 border border-amber-200 rounded-xl">
                <div className="flex items-center gap-2">
                  <Coins className="h-5 w-5 text-amber-600" />
                  <span className="text-sm font-semibold text-amber-800">사용 포인트</span>
                </div>
                <span className="text-lg font-bold text-amber-700">50,000 P</span>
              </div>

              <p className="text-xs text-muted-foreground">작업실 오픈은 영구 적용되며 환불되지 않습니다. 핏포인트 잔액이 충분한지 확인하세요.</p>

              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => setShowOpenModal(false)}>취소</Button>
                <Button
                  className="flex-1 gap-2"
                  disabled={unlockingKey === "workshop_access"}
                  onClick={() => handleUnlock("workshop_access")}
                >
                  <Coins className="h-4 w-4" />
                  {unlockingKey === "workshop_access" ? "처리 중..." : "50,000P 결제"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── 오픈 상태: 모든 기능 무료 사용 ─────────────────────────────────────────
  return (
    <div className="space-y-4">
      <TabBanner tabKey="workshop" />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">작업실</h1>
          <p className="text-sm text-muted-foreground mt-0.5">스테퍼 전용 브랜딩 공간</p>
        </div>
        {isAdmin
          ? <span className="flex items-center gap-1.5 text-xs bg-orange-100 text-orange-700 px-2.5 py-1 rounded-full font-semibold">관리자 모드</span>
          : <span className="flex items-center gap-1.5 text-xs bg-green-100 text-green-700 px-2.5 py-1 rounded-full font-semibold"><Check className="h-3.5 w-3.5" /> 오픈됨</span>
        }
      </div>

      <div className="space-y-3">
        {/* FIT STEP+ */}
        <Card className="bg-card border-border">
          <button className="w-full flex items-center justify-between px-4 py-3 text-left" onClick={() => toggle("fitstep")}>
            <div className="flex items-center gap-2.5">
              <Wrench className="h-4 w-4 text-primary" />
              <div className="flex items-baseline gap-2">
                <span className="font-semibold text-base">
                  <span style={{ fontFamily: "'Bebas Neue', 'Arial Black', Arial, sans-serif" }}>FIT</span>
                  <span className="text-primary" style={{ fontFamily: "'Bebas Neue', 'Arial Black', Arial, sans-serif" }}>STEP+</span>
                </span>
                <span className="text-xs text-muted-foreground">개인 회원 관리 페이지</span>
              </div>
            </div>
            {openSection === "fitstep" ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </button>
          {openSection === "fitstep" && (
            <CardContent className="pt-0 pb-4">
              {trainerId ? <FitStepPlusPanel trainerId={trainerId} /> : <p className="text-sm text-muted-foreground text-center py-4">트레이너 계정에서만 사용할 수 있습니다.</p>}
            </CardContent>
          )}
        </Card>

        {/* 내 브랜드 페이지 */}
        <Card className="bg-card border-border">
          <button className="w-full flex items-center justify-between px-4 py-3 text-left" onClick={() => toggle("brand_page")}>
            <div className="flex items-center gap-2.5">
              <Globe className="h-4 w-4 text-primary" />
              <div><span className="font-semibold text-sm">내 브랜드 페이지</span><p className="text-xs text-muted-foreground mt-0.5">공개 소개 페이지 · 예약 링크 공유</p></div>
            </div>
            {openSection === "brand_page" ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </button>
          {openSection === "brand_page" && <CardContent className="pt-0 pb-4"><BrandPageEditor /></CardContent>}
        </Card>

        {/* 상담 예약 링크 */}
        <Card className="bg-card border-border">
          <button className="w-full flex items-center justify-between px-4 py-3 text-left" onClick={() => toggle("booking")}>
            <div className="flex items-center gap-2.5">
              <Calendar className="h-4 w-4 text-primary" />
              <div><span className="font-semibold text-sm">상담 예약 링크</span><p className="text-xs text-muted-foreground mt-0.5">고객이 직접 상담 신청 · 리드 자동 등록</p></div>
            </div>
            {openSection === "booking" ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </button>
          {openSection === "booking" && <CardContent className="pt-0 pb-4"><BrandPageEditor bookingOnly /></CardContent>}
        </Card>

        {/* 회원 보고서 브랜딩 */}
        <Card className="bg-card border-border">
          <button className="w-full flex items-center justify-between px-4 py-3 text-left" onClick={() => toggle("report_branding")}>
            <div className="flex items-center gap-2.5">
              <BookMarked className="h-4 w-4 text-primary" />
              <div><span className="font-semibold text-sm">회원 보고서 브랜딩</span><p className="text-xs text-muted-foreground mt-0.5">공유 보고서에 내 프로필 · 브랜드 색상 표시</p></div>
            </div>
            {openSection === "report_branding" ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </button>
          {openSection === "report_branding" && <CardContent className="pt-0 pb-4"><ReportBrandingEditor /></CardContent>}
        </Card>

        {/* 운동 프로그램 템플릿 */}
        <Card className="bg-card border-border">
          <button className="w-full flex items-center justify-between px-4 py-3 text-left" onClick={() => toggle("templates")}>
            <div className="flex items-center gap-2.5">
              <Dumbbell className="h-4 w-4 text-primary" />
              <div><span className="font-semibold text-sm">운동 프로그램 템플릿</span><p className="text-xs text-muted-foreground mt-0.5">루틴 저장 · 일지 작성 시 불러오기</p></div>
            </div>
            {openSection === "templates" ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </button>
          {openSection === "templates" && <CardContent className="pt-0 pb-4"><WorkoutTemplateEditor /></CardContent>}
        </Card>

        {/* 맞춤 상담 설문 빌더 */}
        <Card className="bg-card border-border">
          <button className="w-full flex items-center justify-between px-4 py-3 text-left" onClick={() => toggle("survey")}>
            <div className="flex items-center gap-2.5">
              <ClipboardList className="h-4 w-4 text-primary" />
              <div><span className="font-semibold text-sm">맞춤 상담 설문 빌더</span><p className="text-xs text-muted-foreground mt-0.5">상담 전 고객 설문 · 링크 공유</p></div>
            </div>
            {openSection === "survey" ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </button>
          {openSection === "survey" && <CardContent className="pt-0 pb-4"><SurveyBuilder /></CardContent>}
        </Card>

        {/* 회원 계약서 약관 수정 */}
        <Card className="bg-card border-border">
          <button className="w-full flex items-center justify-between px-4 py-3 text-left" onClick={() => toggle("terms")}>
            <div className="flex items-center gap-2.5">
              <FileText className="h-4 w-4 text-primary" />
              <span className="font-semibold text-sm">회원 계약서 약관 수정</span>
            </div>
            {openSection === "terms" ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </button>
          {openSection === "terms" && <CardContent className="pt-0 pb-4"><ContractTermsEditor /></CardContent>}
        </Card>
      </div>
    </div>
  );
}

export default function Workshop() {
  // WORKSHOP_LOCKED는 compile-time 상수이므로 훅 규칙 위반 없음
  if (WORKSHOP_LOCKED) return <WorkshopLockedView />;
  return <WorkshopContent />;
}
