import React, { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Wrench, ExternalLink, Video, Bell, Plus, Trash2, Edit2, ChevronDown, ChevronUp, Eye, EyeOff, FileText, Copy, Check, Users, CalendarCheck, ClipboardList, X, Globe, Instagram, Youtube, MessageCircle, Calendar, Dumbbell, Lock, Coins, BookMarked, BarChart3, TrendingUp, Database, Brain, FileSignature, Share2, Zap, Target, Utensils, Activity, ArrowUpRight, Sparkles, PlaySquare, PieChart } from "lucide-react";
import TabBanner from "@/components/TabBanner";
import PointSpendConfirm from "@/components/PointSpendConfirm";


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

// ── 어드민용 FIT STEP+ 플랜 한도 설정 패널 ────────────────────────────────────
function AdminFspLimitsPanel() {
  const utils = trpc.useUtils();
  const { data: limits, isLoading } = trpc.fitStepPlus.admin_getPlanLimits.useQuery();
  const { data: overview } = trpc.fitStepPlus.admin_overview.useQuery();
  const { data: trainers } = trpc.admin.listTrainers.useQuery();
  const updateMutation = trpc.fitStepPlus.admin_updatePlanLimits.useMutation({
    onSuccess: () => { utils.fitStepPlus.admin_getPlanLimits.invalidate(); toast.success("저장되었습니다"); },
    onError: (e) => toast.error(e.message),
  });

  const [free, setFree] = useState("");
  const [pro, setPro] = useState("");
  const [elite, setElite] = useState("");
  const [inited, setInited] = useState(false);

  if (!isLoading && limits && !inited) {
    setFree(String(limits.free));
    setPro(String(limits.pro));
    setElite(String(limits.elite));
    setInited(true);
  }

  const memberCountMap = new Map(
    (overview?.memberCounts ?? []).map((mc) => [mc.trainerId, Number(mc.count)])
  );

  const planColor = (plan: string) => {
    if (plan === "elite") return "bg-amber-100 text-amber-700";
    if (plan === "pro") return "bg-blue-100 text-blue-700";
    return "bg-muted text-muted-foreground";
  };

  return (
    <div className="space-y-4">
      {/* 플랜별 제한 설정 */}
      <div className="bg-accent/20 border border-border rounded-xl p-4 space-y-3">
        <div>
          <p className="text-sm font-semibold">플랜별 FIT STEP+ 회원 수 제한</p>
          <p className="text-xs text-muted-foreground mt-0.5">트레이너 플랜에 따라 등록 가능한 최대 회원 수</p>
        </div>
        {isLoading ? (
          <p className="text-xs text-muted-foreground">불러오는 중...</p>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "FREE", value: free, set: setFree },
              { label: "PRO", value: pro, set: setPro },
              { label: "ELITE", value: elite, set: setElite },
            ].map(({ label, value, set }) => (
              <div key={label} className="space-y-1">
                <label className="text-[11px] font-semibold text-muted-foreground">{label}</label>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min={1}
                    max={500}
                    value={value}
                    onChange={(e) => set(e.target.value)}
                    className="w-full border border-border rounded-lg px-2 py-1.5 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <span className="text-[10px] text-muted-foreground shrink-0">명</span>
                </div>
              </div>
            ))}
          </div>
        )}
        <button
          onClick={() => updateMutation.mutate({ free: parseInt(free)||5, pro: parseInt(pro)||15, elite: parseInt(elite)||30 })}
          disabled={updateMutation.isPending || isLoading}
          className="flex items-center gap-1.5 bg-primary text-primary-foreground text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {updateMutation.isPending ? "저장 중..." : "저장"}
        </button>
      </div>

      {/* 트레이너별 현황 */}
      <div>
        <p className="text-xs font-semibold mb-2 text-muted-foreground">트레이너별 현황</p>
        {!trainers || trainers.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">등록된 트레이너가 없습니다</p>
        ) : (
          <div className="space-y-2">
            {trainers.map((trainer) => {
              const count = memberCountMap.get(trainer.id) ?? 0;
              const plan = (trainer as any).plan ?? "free";
              const limit = plan === "elite" ? parseInt(elite)||30 : plan === "pro" ? parseInt(pro)||15 : parseInt(free)||5;
              return (
                <div key={trainer.id} className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-card border border-border">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{trainer.trainerName}</p>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${planColor(plan)}`}>{plan.toUpperCase()}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground">@{trainer.username}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold">{count} <span className="text-xs text-muted-foreground font-normal">/ {limit}명</span></p>
                    <div className="w-20 h-1.5 bg-muted rounded-full mt-1 overflow-hidden">
                      <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${Math.min(100, (count/limit)*100)}%` }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
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

// ── 작업실 기능 카탈로그 ───────────────────────────────────────────────────────

type WsItemStatus = "active" | "coming_soon" | "addon_fsp" | "addon_premium";
interface WsItem { id: string; icon: React.ElementType; name: string; shortDesc: string; description: string; tags: string[]; useCases: string[]; status: WsItemStatus; }
interface WsCatDef { key: string; label: string; icon: React.ElementType; iconCls: string; bgCls: string; items: WsItem[]; }

const WS_CATALOG: WsCatDef[] = [
  {
    key: "branding", label: "브랜딩 & 회원 경험", icon: Sparkles, iconCls: "text-violet-500", bgCls: "bg-violet-500/10",
    items: [
      { id: "brand_page", icon: Globe, name: "내 브랜드 페이지", shortDesc: "STEPER 소개 및 브랜드 페이지 제작", status: "active",
        description: "트레이너만의 브랜드 소개 페이지를 만들고 링크 하나로 회원에게 공유하세요. 소개글, 전문 분야, SNS 계정을 한 페이지에 담을 수 있습니다.",
        tags: ["소개 페이지", "SNS 연결", "브랜드 프로필"],
        useCases: ["신규 회원 유치 시 소개 자료로 활용", "SNS 바이오 링크로 설정", "상담 전 회원에게 공유"] },
      { id: "fitstep_plus", icon: Wrench, name: "FIT STEP+", shortDesc: "회원 전용 프리미엄 관리 페이지", status: "active",
        description: "회원이 직접 접속하는 전용 앱 페이지입니다. 출석 체크, 개인 운동 기록, 트레이너 피드백을 한 곳에서 관리할 수 있습니다.",
        tags: ["회원 앱", "출석 확인", "운동 기록", "리포트"],
        useCases: ["회원 자가 출석 체크", "홈트레이닝 운동 기록", "트레이너 피드백 제공"] },
      { id: "fitstep_videos", icon: PlaySquare, name: "운동 영상 200개", shortDesc: "회원에게 제공 가능한 운동 영상 라이브러리", status: "addon_fsp",
        description: "카테고리·부위별로 정리된 200개의 운동 영상을 회원에게 제공하세요. 홈트레이닝 영상과 부위별 운동 영상을 FIT STEP+ 앱에서 바로 볼 수 있습니다.",
        tags: ["카테고리별 영상", "부위별 영상", "홈트레이닝"],
        useCases: ["홈트레이닝 영상 제공", "운동 복습 콘텐츠 제공", "회원 자가 운동 지원"] },
      { id: "fitstep_rec", icon: Target, name: "맞춤 운동 추천", shortDesc: "회원 목표 및 상태 기반 운동 추천", status: "addon_fsp",
        description: "회원의 목표, 체력 수준, 컨디션을 바탕으로 맞춤 운동 루틴을 자동 추천합니다. 최적화된 프로그램을 손쉽게 제공할 수 있습니다.",
        tags: ["운동 루틴 추천", "목적별 구성", "상태 기반"],
        useCases: ["목표별 맞춤 프로그램 제공", "회원 상태에 따른 강도 조절", "루틴 자동화"] },
      { id: "fitstep_diet", icon: Utensils, name: "맞춤 식단 관리", shortDesc: "회원 식단 및 생활습관 관리", status: "addon_fsp",
        description: "회원의 식사 기록과 생활 패턴을 관리하고 식단 방향을 제시하세요. 운동 효과를 극대화하는 통합 관리가 가능합니다.",
        tags: ["식단 방향 제시", "식사 기록", "식단 피드백"],
        useCases: ["다이어트 회원 식단 관리", "벌크업 영양 가이드", "생활습관 개선"] },
      { id: "fitstep_personal", icon: Activity, name: "개인 운동 기록 관리", shortDesc: "회원 개인 운동 수행 기록 및 활동 관리", status: "addon_fsp",
        description: "회원이 직접 수행한 운동 기록을 쌓고 활동 데이터를 분석하세요. 홈운동 체크, 운동 볼륨 추적, 성장 확인이 가능합니다.",
        tags: ["운동 기록", "활동 데이터", "홈운동 체크"],
        useCases: ["자가 운동 기록 추적", "운동 볼륨 성장 확인", "홈트레이닝 관리"] },
      { id: "booking", icon: Calendar, name: "수업 예약 기능", shortDesc: "STEPER 전용 상담·PT 예약 시스템", status: "active",
        description: "회원이 직접 상담·PT 예약을 신청할 수 있는 예약 시스템입니다. 내 브랜드 페이지와 연결되어 링크 하나로 예약을 받을 수 있습니다.",
        tags: ["상담 예약", "PT 예약", "예약 링크 공유", "일정 관리"],
        useCases: ["상담 신청 자동화", "예약 관리 효율화", "리드 자동 등록"] },
      { id: "report_branding", icon: BookMarked, name: "회원 보고서 브랜딩", shortDesc: "회원 리포트에 브랜드 컬러·프로필 적용", status: "active",
        description: "회원에게 공유하는 운동 보고서에 내 로고, 브랜드 컬러, 프로필, 메시지를 표시하세요. 전문적인 인상을 남기고 신뢰를 높입니다.",
        tags: ["로고", "브랜드 컬러", "프로필", "메시지"],
        useCases: ["월간 운동 리포트 공유", "회원 성과 보고", "브랜드 노출"] },
      { id: "templates", icon: Dumbbell, name: "운동 프로그램 템플릿", shortDesc: "루틴 저장 · 일지 작성 시 불러오기", status: "active",
        description: "자주 사용하는 운동 루틴을 템플릿으로 저장하고, 트레이닝 일지 작성 시 불러와 빠르게 입력하세요. 반복 작업을 대폭 줄여줍니다.",
        tags: ["루틴 저장", "빠른 입력", "일지 연동"],
        useCases: ["자주 쓰는 루틴 저장", "일지 작성 시간 절약", "프로그램 체계화"] },
      { id: "training_video", icon: Video, name: "트레이닝 일지 + 영상 연결", shortDesc: "회원별 운동 영상 연결 기능", status: "coming_soon",
        description: "트레이닝 일지에 운동 영상을 직접 연결하여 회원이 집에서도 운동을 복습할 수 있게 하세요. 홈트레이닝 프로그램 제공이 가능합니다.",
        tags: ["일지 내 영상 연결", "회원 복습", "홈운동 제공"],
        useCases: ["운동 후 복습 영상 제공", "홈트레이닝 프로그램", "회원 자가 학습"] },
      { id: "contract_terms", icon: FileText, name: "계약서 약관 브랜딩", shortDesc: "계약서 및 약관 커스터마이징", status: "active",
        description: "회원 계약서와 약관을 트레이너만의 운영 정책에 맞게 수정하세요. 브랜드 컬러와 운영 방침을 반영한 전문적인 계약서를 제공할 수 있습니다.",
        tags: ["브랜드 컬러", "약관 수정", "운영 정책"],
        useCases: ["계약서 조건 맞춤 설정", "개인정보 동의서 수정", "운영 방침 반영"] },
    ],
  },
  {
    key: "operations", label: "회원 운영 관리", icon: Users, iconCls: "text-blue-500", bgCls: "bg-blue-500/10",
    items: [
      { id: "member_overview", icon: Users, name: "회원 운영 현황", shortDesc: "전체 회원 상태 한눈에 파악", status: "coming_soon",
        description: "전체 회원, 활성 회원, 만료 임박·만료·정지 회원을 한눈에 확인하세요. 성별 비율, 연령대 그래프로 회원 구성을 분석할 수 있습니다.",
        tags: ["활성 회원", "만료 임박", "성별 비율", "연령대"],
        useCases: ["월말 회원 현황 파악", "만료 예정 회원 관리", "회원 구성 분석"] },
      { id: "activity_stats", icon: BarChart3, name: "활동 통계", shortDesc: "월별·누적 활동 데이터 분석", status: "coming_soon",
        description: "월별 회원 활동량과 누적 데이터를 분석하세요. 출석률, 운동 빈도, 회원 참여도를 수치로 확인하고 운영에 반영할 수 있습니다.",
        tags: ["월별 분석", "누적 분석", "활동 데이터"],
        useCases: ["회원 활동 패턴 파악", "출석률 개선 전략", "운영 성과 측정"] },
      { id: "data_migration", icon: Database, name: "데이터 이전", shortDesc: "기존 데이터 업로드 및 센터 이전", status: "coming_soon",
        description: "다른 시스템에서 사용하던 회원 데이터를 엑셀로 업로드하거나 센터 이전 시 데이터를 연동할 수 있습니다.",
        tags: ["엑셀 업로드", "센터 이전", "데이터 연동"],
        useCases: ["신규 앱 전환 시 데이터 이전", "센터 이사 후 데이터 연동", "대량 회원 등록"] },
    ],
  },
  {
    key: "analytics", label: "센터 운영 분석", icon: TrendingUp, iconCls: "text-emerald-500", bgCls: "bg-emerald-500/10",
    items: [
      { id: "kpi_report", icon: Target, name: "운영 KPI 리포트", shortDesc: "센터 성장 및 운영 성과 분석", status: "coming_soon",
        description: "센터의 핵심 운영 지표를 한눈에 확인하세요. 회원 수 추이, 수익 성장률, 목표 달성도를 KPI로 관리할 수 있습니다.",
        tags: ["KPI 분석", "운영 성과", "성장 데이터"],
        useCases: ["월간 운영 성과 점검", "연간 목표 달성도 확인", "성장 지표 모니터링"] },
      { id: "consult_conversion", icon: ArrowUpRight, name: "상담 등록 전환율", shortDesc: "상담 → 등록 전환 성과 분석", status: "coming_soon",
        description: "상담한 회원 중 실제로 등록한 비율을 분석하세요. 전환율 개선 포인트를 찾고 상담 성과를 높일 수 있습니다.",
        tags: ["전환율", "상담 성과", "등록 분석"],
        useCases: ["상담 전략 개선", "전환율 목표 설정", "월별 성과 비교"] },
      { id: "unpaid", icon: Coins, name: "미수금 관리", shortDesc: "회원별 미납 현황 관리", status: "coming_soon",
        description: "미수금 현황을 회원별로 파악하고 납부 관리를 체계화하세요. 미납 알림과 납부 추적으로 수익 누수를 방지합니다.",
        tags: ["미수금 현황", "회원별 미납", "납부 추적"],
        useCases: ["미납 회원 파악", "수납 관리 자동화", "수익 누수 방지"] },
      { id: "monthly_pnl", icon: PieChart, name: "월간 손익 현황", shortDesc: "월별 수익·비용·손익 확인", status: "coming_soon",
        description: "월별 매출과 비용을 비교하고 순이익을 확인하세요. 운영 비용 구조를 파악해 수익성을 개선할 수 있습니다.",
        tags: ["월별 수익", "비용 분석", "손익 확인"],
        useCases: ["월말 수익 정산", "비용 구조 파악", "손익분기점 분석"] },
      { id: "sales_analysis", icon: BarChart3, name: "월별 매출 분석", shortDesc: "매출 추이 및 월별 비교 그래프", status: "coming_soon",
        description: "매출 트렌드와 월별 매출 비교 그래프를 확인하세요. 성수기·비수기 패턴을 파악해 운영 전략을 수립할 수 있습니다.",
        tags: ["매출 추이", "월별 비교", "그래프"],
        useCases: ["매출 트렌드 분석", "성수기 전략 수립", "연간 목표 설정"] },
      { id: "renewal_analysis", icon: TrendingUp, name: "신규·재등록 분석", shortDesc: "신규 회원 및 재등록 비율 분석", status: "coming_soon",
        description: "신규 등록과 재등록 회원 비율을 분석하세요. 재등록율은 센터 만족도와 직결되는 핵심 지표입니다.",
        tags: ["신규 회원", "재등록", "비율 분석"],
        useCases: ["재등록 캠페인 효과 측정", "이탈 방지 전략", "회원 만족도 간접 측정"] },
      { id: "channel_analysis", icon: Share2, name: "유입 채널 분석", shortDesc: "채널별 유입 및 매출 분석", status: "coming_soon",
        description: "어떤 채널에서 회원이 유입되는지, 채널별 매출 기여도는 어떤지 분석하세요. 효율적인 마케팅 예산 배분이 가능합니다.",
        tags: ["채널별 유입", "채널별 매출", "마케팅 효율"],
        useCases: ["마케팅 예산 배분", "효율적 채널 집중", "채널별 ROI 분석"] },
      { id: "marketing_analysis", icon: Zap, name: "마케팅 유입 분석", shortDesc: "퍼널 데이터 및 월별·연간 통계", status: "coming_soon",
        description: "마케팅 퍼널 전 단계의 데이터를 추적하고 월별·연간 누적 통계로 캠페인 효과를 측정하세요.",
        tags: ["퍼널 데이터", "월별 통계", "연간 누적"],
        useCases: ["광고 효과 측정", "퍼널 최적화", "연간 마케팅 전략 수립"] },
      { id: "ai_insights", icon: Brain, name: "AI 운영 인사이트", shortDesc: "운영 데이터 기반 AI 분석", status: "coming_soon",
        description: "AI가 운영 데이터를 분석해 회원 흐름 패턴, 이탈 위험 회원, 최적 운영 방식을 인사이트로 제공합니다.",
        tags: ["AI 분석", "회원 흐름", "운영 패턴"],
        useCases: ["이탈 위험 회원 사전 파악", "운영 패턴 최적화", "데이터 기반 의사결정"] },
    ],
  },
  {
    key: "automation", label: "계약 & 상담 자동화", icon: FileSignature, iconCls: "text-amber-500", bgCls: "bg-amber-500/10",
    items: [
      { id: "survey", icon: ClipboardList, name: "맞춤 상담 설문 빌더", shortDesc: "상담 전 고객 설문 제작 및 링크 공유", status: "active",
        description: "상담 전에 고객 정보를 미리 수집하는 설문을 직접 만들어 링크로 공유하세요. 주관식·객관식·척도 문항을 자유롭게 구성할 수 있습니다.",
        tags: ["주관식·객관식", "척도 문항", "링크 공유"],
        useCases: ["상담 전 사전 정보 수집", "고객 맞춤 상담 준비", "설문 링크 배포"] },
      { id: "contract_kakao", icon: MessageCircle, name: "계약서 카카오톡 공유", shortDesc: "계약서 링크 카카오톡 전달", status: "coming_soon",
        description: "작성된 계약서를 카카오톡으로 바로 공유하세요. 회원이 카카오톡에서 계약서를 확인하고 서명까지 완료할 수 있습니다.",
        tags: ["카카오톡 공유", "계약서 링크", "빠른 전달"],
        useCases: ["비대면 계약 체결", "원격 회원 등록", "계약 프로세스 간소화"] },
      { id: "e_contract", icon: FileSignature, name: "비대면 전자계약", shortDesc: "원격 전자계약 및 비대면 등록", status: "coming_soon",
        description: "회원이 직접 방문하지 않아도 온라인에서 계약서 확인과 전자 서명을 완료할 수 있습니다. 비대면 회원 등록을 자동화하세요.",
        tags: ["전자계약", "비대면 등록", "온라인 서명"],
        useCases: ["원격 회원 등록", "비대면 계약 체결", "계약 자동화"] },
    ],
  },
];

// ── 기능 카드 ─────────────────────────────────────────────────────────────────
function WorkshopItemCard({ item, onClick }: { item: WsItem; onClick: () => void }) {
  const Icon = item.icon;
  const statusBadge: Record<WsItemStatus, { label: string; cls: string } | null> = {
    active: null,
    coming_soon: { label: "준비 중", cls: "bg-muted text-muted-foreground" },
    addon_fsp: { label: "ADD-ON", cls: "bg-blue-100 text-blue-600" },
    addon_premium: { label: "PREMIUM", cls: "bg-amber-100 text-amber-600" },
  };
  const badge = statusBadge[item.status];

  return (
    <button
      onClick={onClick}
      className={`relative flex flex-col bg-card border border-border/60 rounded-2xl p-3.5 text-left w-full transition-all duration-150
        hover:border-primary/40 hover:bg-primary/[0.03] active:scale-[0.96]
        ${item.status !== "active" ? "opacity-80" : ""}`}
    >
      {badge && (
        <span className={`absolute top-2.5 right-2.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full ${badge.cls}`}>
          {badge.label}
        </span>
      )}
      <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center mb-2.5">
        <Icon className="h-[18px] w-[18px] text-primary" />
      </div>
      <p className="font-semibold text-[13px] leading-tight pr-8">{item.name}</p>
      <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed line-clamp-2">{item.shortDesc}</p>
    </button>
  );
}

// ── 기능 하단 시트 ────────────────────────────────────────────────────────────
function WorkshopItemSheet({ item, trainerId, isAdmin, onClose }: {
  item: WsItem; trainerId?: number; isAdmin: boolean; onClose: () => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const Icon = item.icon;

  const statusMeta: Record<WsItemStatus, { label: string; cls: string }> = {
    active: { label: "사용 가능", cls: "bg-green-100 text-green-700" },
    coming_soon: { label: "출시 예정", cls: "bg-muted text-muted-foreground" },
    addon_fsp: { label: "FITSTEP+ ADD-ON", cls: "bg-blue-100 text-blue-600" },
    addon_premium: { label: "PREMIUM ADD-ON", cls: "bg-amber-100 text-amber-600" },
  };
  const sm = statusMeta[item.status];

  function renderForm() {
    if (!showForm) return null;
    switch (item.id) {
      case "brand_page":    return <BrandPageEditor />;
      case "fitstep_plus":  return isAdmin ? <AdminFspLimitsPanel /> : trainerId ? <FitStepPlusPanel trainerId={trainerId} /> : null;
      case "booking":       return <BrandPageEditor bookingOnly />;
      case "report_branding": return <ReportBrandingEditor />;
      case "templates":     return <WorkoutTemplateEditor />;
      case "survey":        return <SurveyBuilder />;
      case "contract_terms": return <ContractTermsEditor />;
      default:              return null;
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative bg-card rounded-t-3xl w-full max-h-[92vh] overflow-y-auto shadow-2xl">
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-2 sticky top-0 bg-card/95 backdrop-blur-sm z-10">
          <div className="w-10 h-1 rounded-full bg-border" />
        </div>

        {/* Header */}
        <div className="px-5 pt-1 pb-4 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
              <Icon className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h2 className="font-bold text-base leading-tight">{item.name}</h2>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${sm.cls}`}>{sm.label}</span>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-muted mt-0.5 shrink-0">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 pb-10 space-y-4">
          <p className="text-sm text-foreground/80 leading-relaxed">{item.description}</p>

          <div className="flex flex-wrap gap-1.5">
            {item.tags.map(tag => (
              <span key={tag} className="text-xs bg-accent/60 text-foreground/70 px-2.5 py-1 rounded-full border border-border/40">{tag}</span>
            ))}
          </div>

          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">활용 상황</p>
            {item.useCases.map(uc => (
              <div key={uc} className="flex items-start gap-2">
                <Check className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                <span className="text-xs text-foreground/80">{uc}</span>
              </div>
            ))}
          </div>

          {item.status === "active" && (
            !showForm ? (
              <Button className="w-full" onClick={() => setShowForm(true)}>설정하기</Button>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <div className="h-px flex-1 bg-border" />
                  <span className="text-xs text-muted-foreground font-medium">설정</span>
                  <div className="h-px flex-1 bg-border" />
                </div>
                {renderForm()}
              </div>
            )
          )}

          {item.status !== "active" && (
            <div className="bg-muted/40 border border-border/60 rounded-2xl p-5 text-center space-y-1.5">
              <p className="text-sm font-semibold text-muted-foreground">
                {item.status === "addon_fsp" ? "FITSTEP+ 확장 기능" :
                 item.status === "addon_premium" ? "PREMIUM 확장 기능" : "출시 예정 기능"}
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {item.status === "coming_soon"
                  ? "곧 업데이트될 예정입니다. 출시 시 알려드리겠습니다."
                  : "FIT STEP의 확장 기능으로 별도 제공될 예정입니다."}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── 어드민 전용 작업실 관리 뷰 ──────────────────────────────────────────────

type WsCategory = "fsp" | "brand" | "booking" | "branding" | "templates" | "survey" | "contract";

const WS_CATS: { key: WsCategory; label: string; icon: React.ElementType }[] = [
  { key: "fsp",       label: "FSP 회원 관리",    icon: Users },
  { key: "brand",     label: "브랜드 페이지",    icon: Globe },
  { key: "booking",   label: "상담 예약",        icon: Calendar },
  { key: "branding",  label: "보고서 브랜딩",    icon: BookMarked },
  { key: "templates", label: "운동 템플릿",       icon: Dumbbell },
  { key: "survey",    label: "설문 빌더",        icon: ClipboardList },
  { key: "contract",  label: "계약서 약관",      icon: FileText },
];

function planBadge(plan: string) {
  const base = "text-[10px] font-bold px-1.5 py-0.5 rounded";
  if (plan === "elite") return <span className={`${base} bg-amber-100 text-amber-700`}>ELITE</span>;
  if (plan === "pro") return <span className={`${base} bg-blue-100 text-blue-700`}>PRO</span>;
  return <span className={`${base} bg-muted text-muted-foreground`}>FREE</span>;
}

function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, string> = {
    "정상":       "bg-green-100 text-green-700",
    "미사용":     "bg-muted text-muted-foreground",
    "확인필요":   "bg-yellow-100 text-yellow-700",
    "활성":       "bg-blue-100 text-blue-700",
    "기본 사용":  "bg-muted text-muted-foreground",
  };
  return <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${cfg[status] ?? "bg-muted text-muted-foreground"}`}>{status}</span>;
}

function TrainerDetailPanel({ trainerId, category }: { trainerId: number; category: WsCategory }) {
  const { data: fsp }      = trpc.admin.getTrainerFspDetail.useQuery({ trainerId }, { enabled: category === "fsp" });
  const { data: bookings } = trpc.admin.getTrainerBookingsDetail.useQuery({ trainerId }, { enabled: category === "booking" });
  const { data: templates }= trpc.admin.getTrainerTemplatesDetail.useQuery({ trainerId }, { enabled: category === "templates" });
  const { data: survey }   = trpc.admin.getTrainerSurveyDetail.useQuery({ trainerId }, { enabled: category === "survey" });
  const { data: contract } = trpc.admin.getTrainerContractDetail.useQuery({ trainerId }, { enabled: category === "contract" });

  if (category === "fsp") {
    if (!fsp) return <p className="text-xs text-muted-foreground text-center py-3">불러오는 중...</p>;
    if (fsp.length === 0) return <p className="text-xs text-muted-foreground text-center py-3">등록된 FSP 회원이 없습니다</p>;
    return (
      <div className="space-y-1.5">
        {fsp.map((m: any) => (
          <div key={m.id} className="flex items-center justify-between bg-background border border-border rounded-lg px-3 py-2">
            <div>
              <p className="text-xs font-semibold">{m.name}</p>
              <p className="text-[10px] text-muted-foreground">{m.phone ?? m.username} · {m.membershipType}</p>
            </div>
            <div className="text-right">
              {m.membershipEnd && <p className="text-[10px] text-muted-foreground">만료: {m.membershipEnd}</p>}
              <p className="text-[10px] text-muted-foreground">{m.createdAt?.slice(0,10)} 가입</p>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (category === "booking") {
    if (!bookings) return <p className="text-xs text-muted-foreground text-center py-3">불러오는 중...</p>;
    if (bookings.length === 0) return <p className="text-xs text-muted-foreground text-center py-3">예약 내역이 없습니다</p>;
    const statusCls: Record<string, string> = { confirmed: "text-green-600", cancelled: "text-red-500", pending: "text-blue-500" };
    const statusLabel: Record<string, string> = { confirmed: "확인", cancelled: "취소", pending: "대기" };
    return (
      <div className="space-y-1.5">
        {bookings.map((b: any) => (
          <div key={b.id} className="flex items-start justify-between bg-background border border-border rounded-lg px-3 py-2">
            <div>
              <p className="text-xs font-semibold">{b.name}</p>
              <p className="text-[10px] text-muted-foreground">{b.phone}{b.interestType ? ` · ${b.interestType}` : ""}</p>
              {b.message && <p className="text-[10px] text-muted-foreground line-clamp-1">{b.message}</p>}
            </div>
            <span className={`text-[10px] font-semibold ${statusCls[b.status] ?? ""}`}>{statusLabel[b.status] ?? b.status}</span>
          </div>
        ))}
      </div>
    );
  }

  if (category === "templates") {
    if (!templates) return <p className="text-xs text-muted-foreground text-center py-3">불러오는 중...</p>;
    if (templates.length === 0) return <p className="text-xs text-muted-foreground text-center py-3">저장된 템플릿이 없습니다</p>;
    return (
      <div className="space-y-1.5">
        {templates.map((t: any) => {
          let exNames = "";
          try { exNames = JSON.parse(t.exercisesJson ?? "[]").map((e: any) => e.name).join(", "); } catch {}
          return (
            <div key={t.id} className="bg-background border border-border rounded-lg px-3 py-2">
              <p className="text-xs font-semibold">{t.name}{t.bodyPart ? ` · ${t.bodyPart}` : ""}</p>
              {exNames && <p className="text-[10px] text-muted-foreground">{exNames}</p>}
            </div>
          );
        })}
      </div>
    );
  }

  if (category === "survey") {
    if (!survey) return <p className="text-xs text-muted-foreground text-center py-3">불러오는 중...</p>;
    return (
      <div className="space-y-3">
        <div>
          <p className="text-[10px] font-semibold text-muted-foreground mb-1">설문 문항 ({survey.questions.length})</p>
          {survey.questions.length === 0 ? <p className="text-xs text-muted-foreground">등록된 문항 없음</p> : (
            <div className="space-y-1">
              {survey.questions.map((q: any, i: number) => (
                <div key={q.id} className="bg-background border border-border rounded-lg px-3 py-1.5">
                  <p className="text-xs">{i+1}. {q.question}</p>
                  <p className="text-[10px] text-muted-foreground">{q.type}{q.isRequired ? " · 필수" : ""}</p>
                </div>
              ))}
            </div>
          )}
        </div>
        <div>
          <p className="text-[10px] font-semibold text-muted-foreground mb-1">응답 ({survey.responses.length}건)</p>
          {survey.responses.length === 0 ? <p className="text-xs text-muted-foreground">응답 없음</p> : (
            <div className="space-y-1">
              {survey.responses.map((r: any) => (
                <div key={r.id} className="bg-background border border-border rounded-lg px-3 py-1.5">
                  <p className="text-xs font-semibold">{r.respondentName}</p>
                  <p className="text-[10px] text-muted-foreground">{r.respondentPhone ?? ""} · {r.createdAt?.slice(0,10)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (category === "contract") {
    if (!contract) return <p className="text-xs text-muted-foreground text-center py-3">커스텀 약관 없음 (기본값 사용)</p>;
    return (
      <div className="space-y-2">
        {[["이용 약관", contract.termsOfService], ["개인정보", contract.privacyPolicy], ["광고수신", contract.marketingConsent]].map(([label, val]) => (
          val ? (
            <div key={label} className="bg-background border border-border rounded-lg px-3 py-2">
              <p className="text-[10px] font-semibold text-muted-foreground mb-1">{label}</p>
              <p className="text-xs line-clamp-3">{val}</p>
            </div>
          ) : null
        ))}
      </div>
    );
  }

  return (
    <div className="text-xs text-muted-foreground text-center py-3">상세 정보가 없습니다</div>
  );
}

// ── 작업실 관리 콘솔 서브컴포넌트 ────────────────────────────────────────────

interface WsItemEnriched extends WsItem {
  catKey: string;
  catLabel: string;
  tracked: boolean;
  usage: { activeUsers: number; totalMetric: number; label: string } | null;
}

function WsAdminFeatureModal({ feature, trainers, onClose }: {
  feature: WsItemEnriched;
  trainers: any[];
  onClose: () => void;
}) {
  const utils = trpc.useUtils();
  const FIcon = feature.icon;
  const [editStatus, setEditStatus] = useState<string>(feature.status);
  const [adminNote, setAdminNote] = useState("");

  const updateMutation = trpc.admin.updateWorkshopFeatureConfig.useMutation({
    onSuccess: () => { utils.admin.getWorkshopConsole.invalidate(); toast.success("기능 설정이 저장되었습니다"); onClose(); },
    onError: (e) => toast.error(e.message),
  });

  const STATUS_META: Record<string, { label: string; cls: string }> = {
    active: { label: "활성", cls: "bg-green-100 text-green-700" },
    coming_soon: { label: "준비 중", cls: "bg-muted text-muted-foreground" },
    addon_fsp: { label: "ADD-ON", cls: "bg-blue-100 text-blue-600" },
    addon_premium: { label: "PREMIUM", cls: "bg-amber-100 text-amber-600" },
    hidden: { label: "숨김", cls: "bg-gray-200 text-gray-500" },
  };
  const sm = STATUS_META[feature.status] ?? STATUS_META.coming_soon;

  function getFeatureTrainers() {
    switch (feature.id) {
      case "brand_page": return trainers.filter(t => t.brandIsPublic || t.brandBio);
      case "fitstep_plus": return trainers.filter(t => t.fsp_count > 0);
      case "booking": return trainers.filter(t => t.bookingEnabled || t.booking_count > 0);
      case "report_branding": return trainers.filter(t => t.brandColor);
      case "templates": return trainers.filter(t => t.template_count > 0);
      case "survey": return trainers.filter(t => t.survey_question_count > 0);
      case "contract_terms": return trainers.filter(t => t.has_custom_terms);
      default: return [];
    }
  }
  const featureTrainers = getFeatureTrainers();

  return (
    <div className="fixed inset-0 z-50 flex items-end">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative bg-card rounded-t-3xl w-full max-h-[92vh] overflow-y-auto shadow-2xl">
        <div className="flex justify-center pt-3 pb-2 sticky top-0 bg-card/95 backdrop-blur-sm z-10">
          <div className="w-10 h-1 rounded-full bg-border" />
        </div>
        <div className="px-5 pt-1 pb-4 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
              <FIcon className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h2 className="font-bold text-base leading-tight">{feature.name}</h2>
              <p className="text-[10px] text-muted-foreground">{feature.catLabel}</p>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${sm.cls}`}>{sm.label}</span>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-muted mt-0.5 shrink-0">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        <div className="px-5 pb-10 space-y-5">
          <p className="text-sm text-foreground/80 leading-relaxed">{feature.description}</p>

          {/* 사용 현황 */}
          {feature.usage ? (
            <div className="bg-accent/30 rounded-2xl p-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">사용 현황</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="text-center bg-card rounded-xl p-3 border border-border">
                  <p className="text-2xl font-black text-primary">{feature.usage.activeUsers}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">이용 중인 STEPER</p>
                </div>
                <div className="text-center bg-card rounded-xl p-3 border border-border">
                  <p className="text-2xl font-black">{feature.usage.totalMetric}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{feature.usage.label}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-muted/40 rounded-2xl p-4 text-center">
              <p className="text-xs font-semibold text-muted-foreground">사용 추적 준비 중</p>
              <p className="text-[10px] text-muted-foreground mt-1">이 기능의 상세 사용 데이터 추적이 준비 중입니다.</p>
            </div>
          )}

          {/* 이용 STEPER 목록 */}
          {featureTrainers.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">이용 중인 STEPER ({featureTrainers.length}명)</p>
              {featureTrainers.map((t: any) => (
                <div key={t.id} className="flex items-center justify-between bg-background border border-border rounded-xl px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="text-[10px] font-bold text-primary">{t.trainerName?.[0]}</span>
                    </div>
                    <div>
                      <p className="text-xs font-semibold">{t.trainerName}</p>
                      <p className="text-[10px] text-muted-foreground">{t.username}</p>
                    </div>
                  </div>
                  {planBadge(t.plan ?? "free")}
                </div>
              ))}
            </div>
          )}

          {/* 관리자 설정 */}
          <div className="space-y-3 pt-2 border-t border-border">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">관리자 설정</p>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">기능 상태 변경</label>
              <select value={editStatus} onChange={e => setEditStatus(e.target.value)}
                className="w-full bg-background border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary">
                <option value="active">활성 (사용 가능)</option>
                <option value="coming_soon">준비 중</option>
                <option value="addon_fsp">ADD-ON (FSP)</option>
                <option value="addon_premium">PREMIUM ADD-ON</option>
                <option value="hidden">숨김</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">관리자 메모</label>
              <input value={adminNote} onChange={e => setAdminNote(e.target.value)}
                placeholder="메모 입력 (선택)"
                className="w-full bg-background border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <Button className="w-full" size="sm"
              onClick={() => updateMutation.mutate({ featureId: feature.id, status: editStatus, adminNote: adminNote || undefined })}
              disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "저장 중..." : "설정 저장"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function WsAdminPointLog() {
  const { data: logs, isLoading } = trpc.admin.getWorkshopPointLog.useQuery();
  const TYPE_META: Record<string, { label: string; cls: string }> = {
    workshop_unlock: { label: "작업실 활성화", cls: "text-red-500" },
    admin_grant: { label: "관리자 지급", cls: "text-green-600" },
    admin_adjust: { label: "관리자 조정", cls: "text-amber-600" },
  };
  if (isLoading) return <p className="text-center text-sm text-muted-foreground py-8">로딩 중...</p>;
  if (!logs || logs.length === 0) return <p className="text-center text-sm text-muted-foreground py-8">작업실 관련 포인트 내역이 없습니다</p>;
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">{logs.length}건</p>
      {(logs as any[]).map(l => {
        const meta = TYPE_META[l.type] ?? { label: l.type, cls: "text-muted-foreground" };
        return (
          <div key={l.id} className="bg-card border border-border rounded-xl px-4 py-3 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold">{l.trainerName ?? "알 수 없음"}</p>
              <p className={`text-[10px] font-medium mt-0.5 ${meta.cls}`}>{meta.label}</p>
              {l.memo && <p className="text-[10px] text-muted-foreground truncate">{l.memo}</p>}
              <p className="text-[10px] text-muted-foreground">{l.createdAt?.slice(0, 16)}</p>
            </div>
            <div className="text-right shrink-0">
              <p className={`text-sm font-bold ${l.amount > 0 ? "text-green-600" : l.amount < 0 ? "text-red-500" : "text-muted-foreground"}`}>
                {l.amount > 0 ? "+" : ""}{l.amount.toLocaleString()}P
              </p>
              <span className={`text-[10px] ${l.status === "completed" ? "text-green-600" : "text-muted-foreground"}`}>
                {l.status === "completed" ? "완료" : l.status}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── 작업실 관리 콘솔 메인 ─────────────────────────────────────────────────────
function AdminWorkshopView() {
  const [tab, setTab] = useState<"stepers" | "features" | "pointlog">("stepers");
  const [selectedFeature, setSelectedFeature] = useState<WsItemEnriched | null>(null);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [wsStatusFilter, setWsStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedTrainerId, setExpandedTrainerId] = useState<number | null>(null);

  const { data: consoleData, isLoading } = trpc.admin.getWorkshopConsole.useQuery();
  const utils = trpc.useUtils();

  const grantMutation = trpc.admin.grantWorkshopAccess.useMutation({
    onSuccess: () => { utils.admin.getWorkshopConsole.invalidate(); toast.success("작업실 접근이 부여되었습니다"); },
    onError: (e) => toast.error(e.message),
  });
  const revokeMutation = trpc.admin.revokeWorkshopAccess.useMutation({
    onSuccess: () => { utils.admin.getWorkshopConsole.invalidate(); toast.success("작업실 접근이 회수되었습니다"); },
    onError: (e) => toast.error(e.message),
  });

  const trainers: any[] = consoleData?.trainers ?? [];
  const summary = consoleData?.summary ?? { total: 0, unopened: 0, trial: 0, grace: 0, locked: 0, active: 0 };

  const featureUsage: Record<string, { activeUsers: number; totalMetric: number; label: string }> = {
    brand_page:      { activeUsers: trainers.filter(t => t.brandIsPublic).length, totalMetric: trainers.filter(t => t.brandBio || t.brandIsPublic).length, label: "공개 중 트레이너" },
    fitstep_plus:    { activeUsers: trainers.filter(t => t.fsp_count > 0).length, totalMetric: trainers.reduce((s, t) => s + (t.fsp_count || 0), 0), label: "FSP 회원 수" },
    booking:         { activeUsers: trainers.filter(t => t.bookingEnabled).length, totalMetric: trainers.reduce((s, t) => s + (t.booking_count || 0), 0), label: "총 예약 건" },
    report_branding: { activeUsers: trainers.filter(t => t.brandColor).length, totalMetric: trainers.filter(t => t.brandColor).length, label: "브랜드 설정" },
    templates:       { activeUsers: trainers.filter(t => t.template_count > 0).length, totalMetric: trainers.reduce((s, t) => s + (t.template_count || 0), 0), label: "총 템플릿" },
    survey:          { activeUsers: trainers.filter(t => t.survey_question_count > 0).length, totalMetric: trainers.reduce((s, t) => s + (t.survey_question_count || 0), 0), label: "총 문항 수" },
    contract_terms:  { activeUsers: trainers.filter(t => t.has_custom_terms).length, totalMetric: trainers.filter(t => t.has_custom_terms).length, label: "커스텀 약관" },
  };

  const allFeatures: WsItemEnriched[] = WS_CATALOG.flatMap(cat =>
    cat.items.map(item => {
      const cfgOverride = consoleData?.featureConfigs?.find(c => c.featureId === item.id);
      const effectiveStatus = (cfgOverride?.status ?? item.status) as WsItemStatus;
      return {
        ...item,
        status: effectiveStatus,
        catKey: cat.key,
        catLabel: cat.label,
        tracked: !!featureUsage[item.id],
        usage: featureUsage[item.id] ?? null,
      };
    })
  );

  const filteredFeatures = allFeatures.filter(f => {
    if (categoryFilter !== "all" && f.catKey !== categoryFilter) return false;
    if (statusFilter !== "all" && f.status !== statusFilter) return false;
    if (searchQuery && !f.name.includes(searchQuery) && !f.shortDesc.includes(searchQuery)) return false;
    return true;
  });

  const filteredTrainers = trainers.filter(t => {
    if (wsStatusFilter !== "all" && t.wsStatus !== wsStatusFilter) return false;
    if (searchQuery && !t.trainerName?.includes(searchQuery)) return false;
    return true;
  });

  const WS_STATUS_META: Record<string, { label: string; cls: string }> = {
    unopened: { label: "미오픈",   cls: "bg-muted text-muted-foreground" },
    trial:    { label: "체험 중",  cls: "bg-blue-100 text-blue-700" },
    grace:    { label: "유예기간", cls: "bg-red-100 text-red-700" },
    locked:   { label: "잠금",    cls: "bg-gray-200 text-gray-600" },
    active:   { label: "활성화",  cls: "bg-green-100 text-green-700" },
  };

  const FEATURE_STATUS_META: Record<string, { label: string; cls: string }> = {
    active:        { label: "활성",   cls: "bg-green-100 text-green-700" },
    coming_soon:   { label: "준비 중", cls: "bg-muted text-muted-foreground" },
    addon_fsp:     { label: "ADD-ON", cls: "bg-blue-100 text-blue-600" },
    addon_premium: { label: "PREMIUM", cls: "bg-amber-100 text-amber-600" },
    hidden:        { label: "숨김",   cls: "bg-gray-200 text-gray-500" },
  };

  if (isLoading) return (
    <div className="space-y-4"><TabBanner tabKey="workshop" />
      <p className="text-center text-sm text-muted-foreground py-8">로딩 중...</p>
    </div>
  );

  return (
    <div className="space-y-5 pb-10">
      <TabBanner tabKey="workshop" />

      {/* 헤더 */}
      <div>
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">작업실 관리</h1>
          <span className="text-xs bg-orange-100 text-orange-700 px-2.5 py-1 rounded-full font-semibold">관리자</span>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">STEPER 작업실 기능의 이용자·포인트 매출 성과를 관리합니다.</p>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "전체 STEPER",  value: summary.total,    cls: "text-foreground" },
          { label: "체험 중",      value: summary.trial,    cls: "text-blue-600" },
          { label: "활성화",       value: summary.active,   cls: "text-green-600" },
          { label: "유예기간",     value: summary.grace,    cls: "text-red-600" },
          { label: "잠금",         value: summary.locked,   cls: "text-muted-foreground" },
          { label: "미오픈",       value: summary.unopened, cls: "text-muted-foreground" },
        ].map(card => (
          <div key={card.label} className="bg-card border border-border rounded-xl p-3 text-center">
            <p className={`text-lg font-black ${card.cls}`}>{card.value}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{card.label}</p>
          </div>
        ))}
      </div>

      {/* 탭 */}
      <div className="flex gap-1 bg-muted/40 rounded-xl p-1">
        {(["stepers", "features", "pointlog"] as const).map(key => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-colors ${tab === key ? "bg-background shadow text-foreground" : "text-muted-foreground"}`}>
            {key === "stepers" ? "STEPER 현황" : key === "features" ? "기능 관리" : "포인트 로그"}
          </button>
        ))}
      </div>

      {/* 검색 */}
      <div className="relative">
        <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
          placeholder={tab === "stepers" ? "STEPER 이름 검색" : "기능명 검색"}
          className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm pr-8 focus:outline-none focus:ring-1 focus:ring-primary" />
        {searchQuery && (
          <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* ── STEPER 현황 탭 ── */}
      {tab === "stepers" && (
        <div className="space-y-3">
          <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
            {[
              { key: "all",     label: "전체",     count: summary.total },
              { key: "trial",   label: "체험 중",  count: summary.trial },
              { key: "grace",   label: "유예기간", count: summary.grace },
              { key: "active",  label: "활성화",   count: summary.active },
              { key: "locked",  label: "잠금",     count: summary.locked },
              { key: "unopened",label: "미오픈",   count: summary.unopened },
            ].map(({ key, label, count }) => (
              <button key={key} onClick={() => setWsStatusFilter(key)}
                className={`shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                  wsStatusFilter === key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                }`}>
                {label}
                <span className={`text-[10px] ${wsStatusFilter === key ? "opacity-80" : "opacity-60"}`}>({count})</span>
              </button>
            ))}
          </div>

          <p className="text-xs text-muted-foreground">{filteredTrainers.length}명</p>

          {filteredTrainers.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">해당 조건의 STEPER가 없습니다</p>
          ) : (
            <div className="space-y-2">
              {filteredTrainers.map((t: any) => {
                const sm = WS_STATUS_META[t.wsStatus] ?? WS_STATUS_META.unopened;
                const isExpanded = expandedTrainerId === t.id;
                const daysLabel = t.wsStatus === "trial" ? `D-${t.daysRemaining}` :
                                   t.wsStatus === "grace" ? `유예 ${t.daysRemaining}일` : null;
                return (
                  <div key={t.id} className="bg-card border border-border rounded-xl overflow-hidden">
                    <button className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-accent/20 transition-colors"
                      onClick={() => setExpandedTrainerId(isExpanded ? null : t.id)}>
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <span className="text-xs font-bold text-primary">{t.trainerName?.[0]}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold truncate">{t.trainerName}</p>
                          {planBadge(t.plan ?? "free")}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${sm.cls}`}>{sm.label}</span>
                          {daysLabel && <span className="text-[10px] text-muted-foreground">{daysLabel}</span>}
                          <span className="text-[10px] text-muted-foreground">{(t.points_balance ?? 0).toLocaleString()}P</span>
                        </div>
                      </div>
                      {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
                    </button>

                    {isExpanded && (
                      <div className="border-t border-border px-4 py-4 bg-accent/10 space-y-3">
                        <div className="grid grid-cols-2 gap-1.5">
                          {[
                            { label: "FIT STEP+",   val: t.fsp_count > 0 ? `${t.fsp_count}명` : null },
                            { label: "운동 템플릿", val: t.template_count > 0 ? `${t.template_count}개` : null },
                            { label: "설문 빌더",   val: t.survey_question_count > 0 ? `${t.survey_question_count}문항` : null },
                            { label: "예약 기능",   val: t.bookingEnabled ? `${t.booking_count ?? 0}건` : null },
                            { label: "브랜드 페이지", val: t.brandIsPublic ? "공개 중" : null },
                            { label: "보고서 브랜딩", val: t.brandColor ?? null },
                            { label: "계약서 약관", val: t.has_custom_terms ? "커스텀" : null },
                          ].map(item => (
                            <div key={item.label} className="flex items-center justify-between bg-background border border-border rounded-lg px-3 py-2">
                              <p className="text-[10px] text-muted-foreground">{item.label}</p>
                              <p className={`text-[10px] font-semibold ${item.val ? "text-green-600" : "text-muted-foreground"}`}>
                                {item.val ?? "미사용"}
                              </p>
                            </div>
                          ))}
                        </div>
                        <div className="flex gap-2 pt-1">
                          {t.wsStatus !== "active" ? (
                            <button onClick={() => grantMutation.mutate({ trainerId: t.id })} disabled={grantMutation.isPending}
                              className="flex-1 bg-primary text-primary-foreground text-xs font-semibold py-2 rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50">
                              작업실 접근 부여
                            </button>
                          ) : (
                            <button onClick={() => revokeMutation.mutate({ trainerId: t.id })} disabled={revokeMutation.isPending}
                              className="flex-1 bg-destructive/90 text-white text-xs font-semibold py-2 rounded-lg hover:bg-destructive transition-colors disabled:opacity-50">
                              접근 회수
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── 기능 관리 탭 ── */}
      {tab === "features" && (
        <div className="space-y-3">
          <div className="flex gap-2 flex-wrap">
            <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}
              className="bg-background border border-border rounded-lg px-2.5 py-1.5 text-xs focus:outline-none">
              <option value="all">전체 카테고리</option>
              {WS_CATALOG.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
            </select>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
              className="bg-background border border-border rounded-lg px-2.5 py-1.5 text-xs focus:outline-none">
              <option value="all">전체 상태</option>
              <option value="active">활성</option>
              <option value="coming_soon">준비 중</option>
              <option value="addon_fsp">ADD-ON</option>
              <option value="addon_premium">PREMIUM</option>
            </select>
          </div>

          <p className="text-xs text-muted-foreground">{filteredFeatures.length}개 기능</p>

          <div className="space-y-2">
            {filteredFeatures.map(f => {
              const sm = FEATURE_STATUS_META[f.status] ?? FEATURE_STATUS_META.coming_soon;
              const FIcon = f.icon;
              return (
                <button key={f.id} onClick={() => setSelectedFeature(f)}
                  className="w-full bg-card border border-border rounded-xl p-4 text-left hover:border-primary/40 hover:bg-accent/10 transition-colors">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <FIcon className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold">{f.name}</p>
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${sm.cls}`}>{sm.label}</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground">{f.catLabel}</p>
                      {f.usage ? (
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-xs font-semibold text-green-600">{f.usage.activeUsers}명 이용 중</span>
                          <span className="text-xs text-muted-foreground">{f.usage.label}: {f.usage.totalMetric}</span>
                        </div>
                      ) : (
                        <p className="text-[10px] text-muted-foreground mt-1">추적 준비 중</p>
                      )}
                    </div>
                    <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── 포인트 로그 탭 ── */}
      {tab === "pointlog" && <WsAdminPointLog />}

      {/* 기능 상세 모달 */}
      {selectedFeature && (
        <WsAdminFeatureModal
          feature={selectedFeature}
          trainers={trainers}
          onClose={() => setSelectedFeature(null)}
        />
      )}
    </div>
  );
}

// ── 작업실 메인 (트레이너용, 상태 기반) ─────────────────────────────────────
function WorkshopContent() {
  const { data: user } = trpc.auth.me.useQuery();
  const utils = trpc.useUtils();
  const [selectedItem, setSelectedItem] = useState<WsItem | null>(null);
  const trainerId = (user as any)?.trainerId as number | undefined;
  const isAdmin = (user as any)?.role === "admin";

  const { data: wsStatus, isLoading } = trpc.workshop.getStatus.useQuery();
  const startTrialMutation = trpc.workshop.startTrial.useMutation({
    onSuccess: () => { utils.workshop.getStatus.invalidate(); toast.success("30일 무료 체험이 시작되었습니다!"); },
    onError: (e) => toast.error(e.message),
  });
  const unlockMutation = trpc.workshop.unlock.useMutation({
    onSuccess: () => { utils.workshop.getStatus.invalidate(); utils.fitPoints.getBalance.invalidate(); toast.success("작업실이 활성화되었습니다!"); },
    onError: (e) => toast.error(e.message),
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <TabBanner tabKey="workshop" />
        <div className="flex items-center justify-center py-20">
          <p className="text-sm text-muted-foreground">로딩 중...</p>
        </div>
      </div>
    );
  }

  const status = wsStatus?.status ?? "unopened";
  const daysRemaining = wsStatus?.daysRemaining ?? 0;

  // ── 미오픈: 무료 체험 CTA ─────────────────────────────────────────────────
  if (status === "unopened") {
    return (
      <div className="space-y-5 pb-6">
        <TabBanner tabKey="workshop" />
        <div className="flex flex-col items-center text-center space-y-5 pt-2 px-2">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Wrench className="h-8 w-8 text-primary" />
          </div>
          <div className="space-y-2">
            <h1 className="text-xl font-bold">작업실 무료 체험 시작하기</h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              회원 관리, 예약, 브랜딩, 설문, 템플릿 기능을<br />
              30일 동안 자유롭게 사용해보세요.
            </p>
            <p className="text-xs text-muted-foreground">실제 회원 데이터와 작업 흐름을 직접 경험할 수 있습니다.</p>
          </div>

          <div className="w-full space-y-1.5 text-left">
            {PREVIEW_FEATURES.map(f => (
              <div key={f.key} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-card border border-border">
                <span className="text-primary shrink-0">{f.icon}</span>
                <span className="text-sm font-medium">{f.title}</span>
              </div>
            ))}
          </div>

          <Button className="w-full gap-2" size="lg"
            onClick={() => startTrialMutation.mutate()}
            disabled={startTrialMutation.isPending}>
            {startTrialMutation.isPending ? "시작 중..." : "무료 체험 오픈 (30일)"}
          </Button>
          <p className="text-xs text-muted-foreground">결제 없이 바로 시작 · 카드 정보 불필요</p>
        </div>
      </div>
    );
  }

  // ── 잠금 상태: 데이터 보존 안내 + 코인 활성화 ────────────────────────────
  if (status === "locked") {
    return (
      <div className="space-y-4 pb-6">
        <TabBanner tabKey="workshop" />
        <h1 className="text-xl font-bold">작업실</h1>
        <div className="rounded-2xl bg-amber-50 border border-amber-200 p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-amber-600" />
            <p className="font-bold text-amber-800">무료 체험 기간이 종료되었습니다</p>
          </div>
          <p className="text-sm text-amber-700">현재 저장된 데이터는 안전하게 보관 중입니다:</p>
          <div className="grid grid-cols-2 gap-1.5">
            {["회원 템플릿", "예약 링크 설정", "브랜딩 설정", "설문 데이터", "계약서 설정", "보고서 브랜딩"].map(item => (
              <div key={item} className="flex items-center gap-1.5 text-sm text-amber-700">
                <Check className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                <span className="text-xs">{item}</span>
              </div>
            ))}
          </div>
          <p className="text-sm font-semibold text-amber-800">작업실을 활성화하면 모든 데이터와 기능이 복구됩니다.</p>
          <Button className="w-full bg-amber-500 hover:bg-amber-600 text-white gap-2"
            onClick={() => unlockMutation.mutate({ feature: "workshop_access" })}
            disabled={unlockMutation.isPending}>
            <Coins className="h-4 w-4" />
            {unlockMutation.isPending ? "처리 중..." : "50,000P로 작업실 활성화"}
          </Button>
        </div>

        <div className="space-y-2">
          {PREVIEW_FEATURES.map(f => (
            <Card key={f.key} className="bg-card border-border opacity-60">
              <div className="flex items-center gap-3 px-4 py-3">
                <span className="text-muted-foreground shrink-0">{f.icon}</span>
                <span className="font-medium text-sm text-muted-foreground">{f.title}</span>
                <Lock className="h-3.5 w-3.5 text-muted-foreground ml-auto shrink-0" />
              </div>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // ── 체험 중 / 유예 / 활성화 → 전체 기능 표시 ──────────────────────────────
  return (
    <div className="space-y-4">
      <TabBanner tabKey="workshop" />

      {status === "trial" && daysRemaining > 7 && (
        <div className="bg-primary/10 border border-primary/20 rounded-xl px-4 py-2.5 flex items-center justify-between">
          <p className="text-xs font-semibold text-primary">무료 체험 중</p>
          <span className="text-xs font-bold text-primary">{daysRemaining}일 남음</span>
        </div>
      )}
      {status === "trial" && daysRemaining <= 7 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-2.5 flex items-center justify-between">
          <p className="text-xs font-semibold text-yellow-700">무료 체험 중</p>
          <span className="text-xs font-bold text-yellow-700">D-{daysRemaining}</span>
        </div>
      )}
      {status === "grace" && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 space-y-2.5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-red-700">무료 체험 종료 · {daysRemaining}일 후 완전 잠금</p>
              <p className="text-[10px] text-red-600 mt-0.5">지금 활성화하면 기존 데이터가 그대로 유지됩니다</p>
            </div>
          </div>
          <Button size="sm" className="w-full bg-amber-500 hover:bg-amber-600 text-white gap-1.5"
            onClick={() => unlockMutation.mutate({ feature: "workshop_access" })}
            disabled={unlockMutation.isPending}>
            <Coins className="h-3.5 w-3.5" />
            {unlockMutation.isPending ? "처리 중..." : "50,000P로 작업실 활성화"}
          </Button>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">작업실</h1>
          <p className="text-sm text-muted-foreground mt-0.5">스테퍼 전용 브랜딩 공간</p>
        </div>
        {status === "active" && (
          <span className="flex items-center gap-1.5 text-xs bg-green-100 text-green-700 px-2.5 py-1 rounded-full font-semibold">
            <Check className="h-3.5 w-3.5" /> 활성화
          </span>
        )}
        {isAdmin && (
          <span className="text-xs bg-orange-100 text-orange-700 px-2.5 py-1 rounded-full font-semibold">관리자 모드</span>
        )}
      </div>

      <div className="space-y-6">
        {WS_CATALOG.map(cat => (
          <div key={cat.key}>
            <div className="flex items-center gap-2 mb-3">
              <div className={`w-6 h-6 rounded-lg ${cat.bgCls} flex items-center justify-center`}>
                <cat.icon className={`h-3.5 w-3.5 ${cat.iconCls}`} />
              </div>
              <p className="text-sm font-bold">{cat.label}</p>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              {cat.items.map(item => (
                <WorkshopItemCard key={item.id} item={item} onClick={() => setSelectedItem(item)} />
              ))}
            </div>
          </div>
        ))}
      </div>

      {selectedItem && (
        <WorkshopItemSheet
          item={selectedItem}
          trainerId={trainerId}
          isAdmin={isAdmin}
          onClose={() => setSelectedItem(null)}
        />
      )}
    </div>
  );
}

export default function Workshop() {
  const { data: user } = trpc.auth.me.useQuery();
  const [adminTab, setAdminTab] = useState<"manage" | "workshop">("manage");
  const isAdmin = (user as any)?.role === "admin";

  if (isAdmin) {
    return (
      <div className="space-y-4">
        <div className="flex gap-1 bg-muted/40 rounded-xl p-1">
          <button onClick={() => setAdminTab("manage")}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${adminTab === "manage" ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
            기능 사용 현황
          </button>
          <button onClick={() => setAdminTab("workshop")}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${adminTab === "workshop" ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
            내 작업실
          </button>
        </div>
        {adminTab === "manage" ? <AdminWorkshopView /> : <WorkshopContent />}
      </div>
    );
  }

  return <WorkshopContent />;
}
