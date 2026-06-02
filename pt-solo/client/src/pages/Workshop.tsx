import React, { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Wrench, ExternalLink, Video, Bell, Plus, Trash2, Edit2, ChevronDown, ChevronUp, Eye, EyeOff, FileText, Copy, Check, Users, CalendarCheck, ClipboardList, X, Globe, Instagram, Youtube, MessageCircle, Calendar, Dumbbell, Lock, Coins, BookMarked, BarChart3, TrendingUp, Database, Brain, FileSignature, Share2, Zap, Target, Utensils, Activity, ArrowUpRight, Sparkles, PlaySquare, PieChart, Award, Star, MapPin, Layers, Camera, ReceiptText, ArrowLeftRight } from "lucide-react";
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
// ── 브랜드 페이지 블록 시스템 ───────────────────────────────────────────────

type BrandBlockType = "intro" | "specialties" | "career" | "sns" | "booking" | "programs" | "video" | "testimonials";

interface BrandBlock {
  id: string;
  type: BrandBlockType;
  visible: boolean;
  data: any;
}

const BRAND_BLOCK_META: Record<BrandBlockType, { label: string; icon: React.ElementType; desc: string; canDelete: boolean; comingSoon?: boolean }> = {
  intro:        { label: "소개",         icon: Users,          desc: "이름·소개글·브랜드 컬러",    canDelete: false },
  specialties:  { label: "전문분야",     icon: Target,         desc: "전문 분야 태그 표시",         canDelete: true  },
  career:       { label: "경력·자격증",  icon: Award,          desc: "자격증·학력·경력·수상",       canDelete: true  },
  sns:          { label: "SNS 링크",     icon: Share2,         desc: "인스타·유튜브·카카오 연결",   canDelete: true  },
  booking:      { label: "상담 예약",    icon: Calendar,       desc: "예약 신청 버튼·폼",           canDelete: true  },
  programs:     { label: "프로그램 소개",icon: Dumbbell,       desc: "PT·필라테스 프로그램 안내",   canDelete: true  },
  video:        { label: "운동 영상",    icon: PlaySquare,     desc: "유튜브 영상 연결",            canDelete: true  },
  testimonials: { label: "회원 후기",    icon: Star,           desc: "회원 변화 사례·후기",         canDelete: true, comingSoon: true },
};

const ADDABLE_BLOCK_TYPES: BrandBlockType[] = ["specialties", "career", "sns", "booking", "programs", "video", "testimonials"];

async function resizeImageToBase64(file: File, maxSize = 400): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = reject;
    img.src = url;
  });
}

function defaultBlocks(brand: any): BrandBlock[] {
  return [
    { id: "intro", type: "intro", visible: true, data: {
      bio: brand?.brandBio ?? "", color: brand?.brandColor ?? "#1a00ff",
    }},
    ...(brand?.brandSpecialties ? [{ id: "specialties", type: "specialties" as const, visible: true, data: { items: brand.brandSpecialties.split(",").map((s: string) => s.trim()).filter(Boolean) } }] : []),
    ...((brand?.brandInstagram || brand?.brandKakao || brand?.brandYoutube) ? [{ id: "sns", type: "sns" as const, visible: true, data: { instagram: brand?.brandInstagram ?? "", kakao: brand?.brandKakao ?? "", youtube: brand?.brandYoutube ?? "" } }] : []),
    ...(brand?.bookingEnabled ? [{ id: "booking", type: "booking" as const, visible: true, data: { enabled: true, message: brand?.bookingMessage ?? "" } }] : []),
  ];
}

function buildLegacyFieldsStatic(blockList: BrandBlock[]) {
  const intro = blockList.find(b => b.type === "intro");
  const sns = blockList.find(b => b.type === "sns");
  const spc = blockList.find(b => b.type === "specialties");
  const bk  = blockList.find(b => b.type === "booking");
  return {
    brandBio: intro?.data?.bio ?? "",
    brandColor: intro?.data?.color ?? "#1a00ff",
    brandInstagram: sns?.data?.instagram ?? "",
    brandKakao: sns?.data?.kakao ?? "",
    brandYoutube: sns?.data?.youtube ?? "",
    brandSpecialties: (spc?.data?.items ?? []).join(", "),
    bookingEnabled: (bk?.visible && bk?.data?.enabled) ? 1 : 0,
    bookingMessage: bk?.data?.message ?? "",
  };
}

// ── 소개 블록 에디터 (배경 이미지 업로드 포함) ──────────────────────────────
function IntroBlockEditor({ d, onChange }: { d: any; onChange: (data: any) => void }) {
  const bgImgRef = useRef<HTMLInputElement>(null);
  const profileImgRef = useRef<HTMLInputElement>(null);
  const [hexVal, setHexVal] = useState(d.color ?? "#1a00ff");

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>, field: "bgImage" | "profileImage", maxSize: number) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const base64 = await resizeImageToBase64(file, maxSize);
      onChange({ ...d, [field]: base64 });
    } catch { toast.error("이미지 처리 실패"); }
    e.target.value = "";
  }

  function applyHex(val: string) {
    setHexVal(val);
    if (/^#[0-9a-fA-F]{6}$/.test(val)) onChange({ ...d, color: val });
  }

  return (
    <div className="space-y-4 pt-3 border-t border-border/60">
      {/* 프로필 이미지 */}
      <div className="space-y-1.5">
        <label className="text-xs text-muted-foreground">프로필 이미지</label>
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => profileImgRef.current?.click()} className="shrink-0">
            {d.profileImage
              ? <img src={d.profileImage} className="w-14 h-14 rounded-full object-cover border-2 border-border" alt="프로필" />
              : <div className="w-14 h-14 rounded-full bg-muted border-2 border-dashed border-border flex items-center justify-center">
                  <Camera className="h-4 w-4 text-muted-foreground" />
                </div>
            }
          </button>
          <div className="space-y-1.5">
            <button type="button" onClick={() => profileImgRef.current?.click()}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 bg-primary/10 text-primary rounded-xl hover:bg-primary/20 transition-colors">
              <Camera className="h-3 w-3" />{d.profileImage ? "변경" : "업로드"}
            </button>
            {d.profileImage && (
              <button type="button" onClick={() => onChange({ ...d, profileImage: undefined })}
                className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-red-500 transition-colors">
                <X className="h-3 w-3" />삭제
              </button>
            )}
          </div>
        </div>
        <input ref={profileImgRef} type="file" accept="image/*" className="hidden"
          onChange={e => handleImageUpload(e, "profileImage", 400)} />
      </div>

      {/* 직함 */}
      <div className="space-y-1.5">
        <label className="text-xs text-muted-foreground">직함 <span className="text-muted-foreground/50">(예: 퍼스널 트레이너)</span></label>
        <input value={d.title ?? ""} onChange={e => onChange({ ...d, title: e.target.value })}
          placeholder="퍼스널 트레이너"
          className="w-full bg-background border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
      </div>

      {/* 한줄 소개 */}
      <div className="space-y-1.5">
        <label className="text-xs text-muted-foreground">한줄 소개 <span className="text-muted-foreground/50">(Hero 영역 표시)</span></label>
        <input value={d.tagline ?? ""} onChange={e => onChange({ ...d, tagline: e.target.value })}
          placeholder="근거 있는 지도, 변화를 즐깁니다."
          className="w-full bg-background border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
      </div>

      {/* 소개글 */}
      <div className="space-y-1.5">
        <label className="text-xs text-muted-foreground">소개글</label>
        <textarea value={d.bio ?? ""} onChange={e => onChange({ ...d, bio: e.target.value })}
          rows={3} placeholder="트레이너 소개를 입력하세요..."
          className="w-full bg-background border border-border rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-primary" />
      </div>

      {/* 브랜드 컬러 */}
      <div className="space-y-1.5">
        <label className="text-xs text-muted-foreground">브랜드 컬러</label>
        <div className="flex items-center gap-2">
          <input type="color" value={d.color ?? "#1a00ff"}
            onChange={e => { onChange({ ...d, color: e.target.value }); setHexVal(e.target.value); }}
            className="w-10 h-10 rounded-lg border border-border cursor-pointer p-0.5 bg-background shrink-0" />
          <input type="text" value={hexVal} onChange={e => applyHex(e.target.value)}
            placeholder="#1a00ff" maxLength={7}
            className="flex-1 bg-background border border-border rounded-xl px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary" />
        </div>
      </div>

      {/* 배경 이미지 */}
      <div className="space-y-1.5">
        <label className="text-xs text-muted-foreground">배경 이미지 <span className="text-muted-foreground/50">(없으면 브랜드 컬러 사용)</span></label>
        {d.bgImage && (
          <div className="relative rounded-xl overflow-hidden border border-border">
            <img src={d.bgImage} alt="배경" className="w-full h-24 object-cover" />
            <button type="button" onClick={() => onChange({ ...d, bgImage: undefined })}
              className="absolute top-2 right-2 p-1 bg-black/50 rounded-full hover:bg-black/70 transition-colors">
              <X className="h-3.5 w-3.5 text-white" />
            </button>
          </div>
        )}
        <button type="button" onClick={() => bgImgRef.current?.click()}
          className="flex items-center gap-2 text-xs font-semibold px-3 py-2 bg-primary/10 text-primary rounded-xl hover:bg-primary/20 transition-colors">
          <Camera className="h-3.5 w-3.5" />{d.bgImage ? "배경 이미지 변경" : "배경 이미지 업로드"}
        </button>
        <input ref={bgImgRef} type="file" accept="image/*" className="hidden"
          onChange={e => handleImageUpload(e, "bgImage", 1200)} />
      </div>
    </div>
  );
}

// ── 블록별 인라인 에디터 ─────────────────────────────────────────────────────
function BlockEditor({ block, onChange }: { block: BrandBlock; onChange: (data: any) => void }) {
  const d = block.data;

  if (block.type === "intro") return (
    <IntroBlockEditor d={d} onChange={onChange} />
  );

  if (block.type === "specialties") {
    const items: string[] = d.items ?? [];
    const targetItems: string[] = d.targetItems ?? [];
    const [newItem, setNewItem] = useState("");
    const [newTarget, setNewTarget] = useState("");

    function addTag(list: string[], val: string, field: string) {
      if (!val.trim()) return;
      onChange({ ...d, [field]: [...list, val.trim()] });
    }

    return (
      <div className="space-y-4 pt-3 border-t border-border/60">
        {/* 전문분야 */}
        <div className="space-y-2">
          <label className="text-xs text-muted-foreground font-semibold">전문분야 태그</label>
          <div className="flex flex-wrap gap-2">
            {items.map((item, i) => (
              <span key={i} className="flex items-center gap-1 bg-primary/10 text-primary text-xs px-2.5 py-1 rounded-full">
                {item}
                <button onClick={() => onChange({ ...d, items: items.filter((_, j) => j !== i) })} className="hover:text-red-500">
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input value={newItem} onChange={e => setNewItem(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") { addTag(items, newItem, "items"); setNewItem(""); } }}
              placeholder="전문분야 입력 후 Enter"
              className="flex-1 bg-background border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
            <button onClick={() => { addTag(items, newItem, "items"); setNewItem(""); }}
              className="px-3 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-semibold">추가</button>
          </div>
          <p className="text-[10px] text-muted-foreground">예: 다이어트, 체형교정, 재활운동, 스포츠 퍼포먼스</p>
        </div>

        {/* 추천 대상 */}
        <div className="space-y-2 pt-3 border-t border-border/40">
          <label className="text-xs text-muted-foreground font-semibold">추천 대상 태그</label>
          <div className="flex flex-wrap gap-2">
            {targetItems.map((item, i) => (
              <span key={i} className="flex items-center gap-1 bg-muted text-muted-foreground text-xs px-2.5 py-1 rounded-full">
                {item}
                <button onClick={() => onChange({ ...d, targetItems: targetItems.filter((_, j) => j !== i) })} className="hover:text-red-500">
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input value={newTarget} onChange={e => setNewTarget(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") { addTag(targetItems, newTarget, "targetItems"); setNewTarget(""); } }}
              placeholder="거북목, 허리통증, 체형교정..."
              className="flex-1 bg-background border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
            <button onClick={() => { addTag(targetItems, newTarget, "targetItems"); setNewTarget(""); }}
              className="px-3 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-semibold">추가</button>
          </div>
        </div>
      </div>
    );
  }

  if (block.type === "career") {
    const items: { text: string; category: string }[] = d.items ?? [];
    const [newText, setNewText] = useState("");
    const [newCat, setNewCat] = useState("cert");
    const catLabels: Record<string, string> = { cert: "자격증", career: "경력", edu: "학력", award: "수상" };
    return (
      <div className="space-y-3 pt-3 border-t border-border/60">
        {items.map((item, i) => (
          <div key={i} className="flex items-center gap-2 bg-accent/30 rounded-xl px-3 py-2">
            <span className="text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded">{catLabels[item.category] ?? item.category}</span>
            <span className="text-xs flex-1">{item.text}</span>
            <button onClick={() => onChange({ ...d, items: items.filter((_, j) => j !== i) })} className="text-muted-foreground hover:text-red-500">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        <div className="space-y-2">
          <select value={newCat} onChange={e => setNewCat(e.target.value)}
            className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm focus:outline-none">
            {Object.entries(catLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <div className="flex gap-2">
            <input value={newText} onChange={e => setNewText(e.target.value)}
              placeholder="내용 입력..."
              className="flex-1 bg-background border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
            <button onClick={() => { if (newText.trim()) { onChange({ ...d, items: [...items, { text: newText.trim(), category: newCat }] }); setNewText(""); } }}
              className="px-3 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-semibold">
              추가
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (block.type === "sns") return (
    <div className="space-y-2.5 pt-3 border-t border-border/60">
      {[
        { key: "instagram", icon: Instagram, placeholder: "https://instagram.com/..." },
        { key: "youtube",   icon: Youtube,   placeholder: "https://youtube.com/..." },
        { key: "kakao",     icon: MessageCircle, placeholder: "카카오 채널 링크" },
      ].map(({ key, icon: Icon, placeholder }) => (
        <div key={key} className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
          <input value={d[key] ?? ""} onChange={e => onChange({ ...d, [key]: e.target.value })}
            placeholder={placeholder}
            className="flex-1 bg-background border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
        </div>
      ))}
    </div>
  );

  if (block.type === "booking") {
    const programs: string[] = d.programs ?? ["PT (퍼스널 트레이닝)", "필라테스", "기타"];
    const [newProgram, setNewProgram] = useState("");
    return (
      <div className="space-y-3 pt-3 border-t border-border/60">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium">예약 받기 활성화</p>
          <button onClick={() => onChange({ ...d, enabled: !d.enabled })}
            className={`w-10 h-5.5 rounded-full transition-colors relative ${d.enabled ? "bg-primary" : "bg-muted"}`}
            style={{ height: "22px", width: "40px" }}>
            <span className={`absolute top-0.5 w-4.5 h-4.5 bg-white rounded-full shadow transition-all ${d.enabled ? "left-[18px]" : "left-0.5"}`}
              style={{ width: "18px", height: "18px" }} />
          </button>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground font-semibold">버튼 문구</label>
          <input value={d.buttonText ?? ""} onChange={e => onChange({ ...d, buttonText: e.target.value })}
            placeholder="상담 예약하기"
            className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground font-semibold">예약 안내 문구</label>
          <textarea value={d.guideText ?? d.message ?? ""} onChange={e => onChange({ ...d, guideText: e.target.value, message: e.target.value })}
            rows={2} placeholder="예약 후 연락드립니다. 체험 수업은 예약제로 운영됩니다."
            className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-primary" />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground font-semibold">관심 프로그램 옵션</label>
          <div className="space-y-1.5">
            {programs.map((p, i) => (
              <div key={i} className="flex items-center gap-2 bg-accent/30 rounded-xl px-3 py-2">
                <span className="text-xs flex-1">{p}</span>
                <button onClick={() => onChange({ ...d, programs: programs.filter((_, j) => j !== i) })}
                  className="text-muted-foreground hover:text-red-500">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input value={newProgram} onChange={e => setNewProgram(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && newProgram.trim()) { onChange({ ...d, programs: [...programs, newProgram.trim()] }); setNewProgram(""); } }}
              placeholder="프로그램명 입력 후 Enter"
              className="flex-1 bg-background border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
            <button onClick={() => { if (newProgram.trim()) { onChange({ ...d, programs: [...programs, newProgram.trim()] }); setNewProgram(""); } }}
              className="px-3 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-semibold">추가</button>
          </div>
        </div>
      </div>
    );
  }

  if (block.type === "programs") {
    const items: { name: string; desc: string }[] = d.items ?? [];
    const [newName, setNewName] = useState("");
    const [newDesc, setNewDesc] = useState("");
    return (
      <div className="space-y-3 pt-3 border-t border-border/60">
        {items.map((item, i) => (
          <div key={i} className="bg-accent/30 rounded-xl p-3 space-y-1">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">{item.name}</p>
              <button onClick={() => onChange({ ...d, items: items.filter((_, j) => j !== i) })} className="text-muted-foreground hover:text-red-500">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <p className="text-xs text-muted-foreground">{item.desc}</p>
          </div>
        ))}
        <div className="space-y-2 border border-border/60 rounded-xl p-3">
          <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="프로그램명 (예: 12주 체형교정 PT)"
            className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
          <textarea value={newDesc} onChange={e => setNewDesc(e.target.value)} rows={2} placeholder="프로그램 설명..."
            className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-primary" />
          <button onClick={() => { if (newName.trim()) { onChange({ ...d, items: [...items, { name: newName.trim(), desc: newDesc.trim() }] }); setNewName(""); setNewDesc(""); } }}
            className="w-full py-2 bg-primary text-primary-foreground rounded-xl text-sm font-semibold">
            프로그램 추가
          </button>
        </div>
      </div>
    );
  }

  if (block.type === "video") return (
    <div className="space-y-2.5 pt-3 border-t border-border/60">
      <div className="space-y-1.5">
        <label className="text-xs text-muted-foreground">유튜브 URL</label>
        <input value={d.youtubeUrl ?? ""} onChange={e => onChange({ ...d, youtubeUrl: e.target.value })}
          placeholder="https://youtube.com/..."
          className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
      </div>
      <div className="space-y-1.5">
        <label className="text-xs text-muted-foreground">설명 (선택)</label>
        <input value={d.description ?? ""} onChange={e => onChange({ ...d, description: e.target.value })}
          placeholder="영상 설명을 입력하세요..."
          className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
      </div>
    </div>
  );

  return null;
}

// ── 블록 카드 ────────────────────────────────────────────────────────────────
function BlockCard({
  block, index, total,
  onToggleVisible, onMoveUp, onMoveDown, onDelete, onUpdate,
}: {
  block: BrandBlock; index: number; total: number;
  onToggleVisible: () => void; onMoveUp: () => void; onMoveDown: () => void;
  onDelete: () => void; onUpdate: (data: any) => void;
}) {
  const [editing, setEditing] = useState(false);
  const meta = BRAND_BLOCK_META[block.type];
  const Icon = meta.icon;

  return (
    <div className={`bg-card border rounded-2xl overflow-hidden transition-all duration-150 ${!block.visible ? "opacity-50 border-border/40" : "border-border"}`}>
      {/* 카드 헤더 */}
      <div className="flex items-center gap-2.5 px-4 py-3">
        <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <Icon className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold">{meta.label}</p>
          <p className="text-[10px] text-muted-foreground">{meta.desc}</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {/* 공개 토글 */}
          <button onClick={onToggleVisible} title={block.visible ? "숨기기" : "공개"}
            className="p-1.5 rounded-lg hover:bg-accent transition-colors text-muted-foreground hover:text-foreground">
            {block.visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
          </button>
          {/* 순서 이동 */}
          <button onClick={onMoveUp} disabled={index === 0}
            className="p-1.5 rounded-lg hover:bg-accent transition-colors text-muted-foreground hover:text-foreground disabled:opacity-30">
            <ChevronUp className="h-3.5 w-3.5" />
          </button>
          <button onClick={onMoveDown} disabled={index >= total - 1}
            className="p-1.5 rounded-lg hover:bg-accent transition-colors text-muted-foreground hover:text-foreground disabled:opacity-30">
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
          {/* 편집 */}
          <button onClick={() => setEditing(v => !v)}
            className={`p-1.5 rounded-lg transition-colors ${editing ? "bg-primary/10 text-primary" : "hover:bg-accent text-muted-foreground hover:text-foreground"}`}>
            <Edit2 className="h-3.5 w-3.5" />
          </button>
          {/* 삭제 */}
          {meta.canDelete && (
            <button onClick={onDelete}
              className="p-1.5 rounded-lg hover:bg-red-50 hover:text-red-500 transition-colors text-muted-foreground">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
      {/* 인라인 에디터 */}
      {editing && (
        <div className="px-4 pb-4">
          <BlockEditor block={block} onChange={onUpdate} />
        </div>
      )}
    </div>
  );
}

// ── 블록 추가 시트 ───────────────────────────────────────────────────────────
function AddBlockSheet({ existingTypes, onAdd, onClose }: {
  existingTypes: string[];
  onAdd: (type: BrandBlockType) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-card rounded-t-3xl w-full max-h-modal-sm overflow-y-auto shadow-2xl">
        <div className="flex justify-center pt-3 pb-1 sticky top-0 bg-card/95 z-10">
          <div className="w-10 h-1 rounded-full bg-border" />
        </div>
        <div className="px-5 py-3 flex items-center justify-between border-b border-border sticky top-5 bg-card/95 z-10">
          <p className="font-bold text-sm">블록 추가</p>
          <button onClick={onClose}><X className="h-4 w-4 text-muted-foreground" /></button>
        </div>
        <div className="px-5 py-4 space-y-2 pb-8">
          {ADDABLE_BLOCK_TYPES.map(type => {
            const meta = BRAND_BLOCK_META[type];
            const Icon = meta.icon;
            const already = existingTypes.includes(type);
            return (
              <button key={type} disabled={already || meta.comingSoon}
                onClick={() => { onAdd(type); onClose(); }}
                className="w-full flex items-center gap-3 bg-background border border-border rounded-2xl p-3.5 text-left disabled:opacity-40 hover:border-primary/40 hover:bg-primary/[0.02] transition-all">
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Icon className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold">{meta.label}</p>
                  <p className="text-[11px] text-muted-foreground">{meta.desc}</p>
                </div>
                {already && <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">추가됨</span>}
                {meta.comingSoon && <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">준비 중</span>}
                {!already && !meta.comingSoon && <Plus className="h-4 w-4 text-primary shrink-0" />}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── 비대면 전자계약 관리 ─────────────────────────────────────────────────────
function EContractManager() {
  const { data: list, refetch } = trpc.eContract.list.useQuery();
  const createMutation = trpc.eContract.create.useMutation({ onSuccess: () => { refetch(); setShowForm(false); resetForm(); } });
  const deleteMutation = trpc.eContract.delete.useMutation({ onSuccess: () => refetch() });
  const [showForm, setShowForm] = useState(false);
  const [detailId, setDetailId] = useState<number | null>(null);
  const { data: detail } = trpc.eContract.getDetail.useQuery({ id: detailId! }, { enabled: !!detailId });

  const emptyForm = { memberName: "", memberPhone: "", memberBirth: "", programName: "", programPrice: "", programSessions: "", programStartDate: "", trainerMemo: "" };
  const [form, setForm] = useState(emptyForm);
  function resetForm() { setForm(emptyForm); }

  function copyLink(token: string) {
    const url = `${window.location.origin}/contract/${token}`;
    navigator.clipboard.writeText(url).then(() => toast.success("링크 복사됨")).catch(() => toast.error("복사 실패"));
  }
  function openKakao(token: string) {
    const url = `${window.location.origin}/contract/${token}`;
    navigator.clipboard.writeText(url).then(() => {
      toast.success("링크 복사됨 — 카카오톡에 붙여넣기 하세요");
      setTimeout(() => { window.location.href = "kakaotalk://"; }, 300);
    });
  }

  const statusMeta: Record<string, { label: string; cls: string }> = {
    pending: { label: "서명 대기", cls: "bg-amber-100 text-amber-700" },
    signed:  { label: "서명 완료", cls: "bg-green-100 text-green-700" },
  };

  return (
    <div className="space-y-3 pt-3 border-t border-border/60">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-muted-foreground">전자계약 목록</p>
        <button onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-1.5 text-xs font-semibold bg-primary text-primary-foreground px-3 py-1.5 rounded-lg hover:bg-primary/90">
          <Plus className="h-3.5 w-3.5" /> 계약서 생성
        </button>
      </div>

      {showForm && (
        <div className="bg-accent/30 border border-border rounded-xl p-4 space-y-3">
          <p className="text-xs font-semibold">새 계약서 정보 입력 <span className="text-muted-foreground font-normal">(회원이 직접 수정 가능)</span></p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: "회원 이름", key: "memberName", placeholder: "홍길동" },
              { label: "연락처", key: "memberPhone", placeholder: "010-0000-0000" },
              { label: "생년월일", key: "memberBirth", placeholder: "1990-01-01" },
              { label: "프로그램명", key: "programName", placeholder: "PT 10회" },
              { label: "금액(원)", key: "programPrice", placeholder: "500000" },
              { label: "횟수", key: "programSessions", placeholder: "10" },
            ].map(({ label, key, placeholder }) => (
              <div key={key} className="space-y-1">
                <label className="text-[10px] font-semibold text-muted-foreground">{label}</label>
                <input value={(form as any)[key]} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
                  placeholder={placeholder}
                  className="w-full border border-border rounded-lg px-2.5 py-2 text-xs bg-background focus:outline-none focus:border-primary" />
              </div>
            ))}
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-semibold text-muted-foreground">시작일</label>
            <input type="date" value={form.programStartDate} onChange={e => setForm(p => ({ ...p, programStartDate: e.target.value }))}
              className="w-full border border-border rounded-lg px-2.5 py-2 text-xs bg-background focus:outline-none focus:border-primary" />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-semibold text-muted-foreground">트레이너 메모 (회원에게 표시)</label>
            <textarea value={form.trainerMemo} onChange={e => setForm(p => ({ ...p, trainerMemo: e.target.value }))}
              rows={2} placeholder="특이사항, 주의점 등"
              className="w-full border border-border rounded-lg px-2.5 py-2 text-xs bg-background focus:outline-none focus:border-primary resize-none" />
          </div>
          <div className="flex gap-2">
            <button onClick={() => { setShowForm(false); resetForm(); }} className="flex-1 text-xs py-2 border border-border rounded-lg text-muted-foreground">취소</button>
            <button disabled={createMutation.isPending} onClick={() => createMutation.mutate({
              memberName: form.memberName || undefined,
              memberPhone: form.memberPhone || undefined,
              memberBirth: form.memberBirth || undefined,
              programName: form.programName || undefined,
              programPrice: form.programPrice ? parseInt(form.programPrice) : undefined,
              programSessions: form.programSessions ? parseInt(form.programSessions) : undefined,
              programStartDate: form.programStartDate || undefined,
              trainerMemo: form.trainerMemo || undefined,
            })} className="flex-1 text-xs py-2 bg-primary text-primary-foreground rounded-lg font-semibold disabled:opacity-50">
              {createMutation.isPending ? "생성 중..." : "계약서 생성 및 링크 발급"}
            </button>
          </div>
        </div>
      )}

      {!list || list.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-4">생성된 계약서가 없습니다</p>
      ) : (
        <div className="space-y-2">
          {list.map((c: any) => {
            const sm = statusMeta[c.status] ?? statusMeta.pending;
            return (
              <div key={c.id} className="bg-background border border-border rounded-xl p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-semibold">{c.memberName || "이름 미입력"}</p>
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${sm.cls}`}>{sm.label}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {c.programName && `${c.programName} · `}{c.createdAt?.slice(0, 10)}
                    </p>
                  </div>
                  <button onClick={() => { if (confirm("삭제할까요?")) deleteMutation.mutate({ id: c.id }); }}
                    className="p-1 rounded-lg hover:bg-muted shrink-0">
                    <X className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                </div>
                <div className="flex gap-1.5">
                  <button onClick={() => copyLink(c.token)}
                    className="flex-1 flex items-center justify-center gap-1 text-[11px] font-semibold border border-border rounded-lg py-1.5 hover:bg-muted transition-colors">
                    <Copy className="h-3 w-3" /> 링크 복사
                  </button>
                  <button onClick={() => openKakao(c.token)}
                    className="flex-1 flex items-center justify-center gap-1 text-[11px] font-semibold bg-[#FEE500] text-[#3A1D1D] rounded-lg py-1.5 hover:opacity-90 transition-opacity">
                    카카오톡 공유
                  </button>
                  {c.status === "signed" && (
                    <button onClick={() => setDetailId(c.id)}
                      className="flex-1 flex items-center justify-center gap-1 text-[11px] font-semibold bg-primary/10 text-primary rounded-lg py-1.5 hover:bg-primary/20 transition-colors">
                      서명 확인
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 서명 상세 모달 */}
      {detail && (
        <div className="fixed inset-0 z-50 flex items-end">
          <div className="absolute inset-0 bg-black/50" onClick={() => setDetailId(null)} />
          <div className="relative bg-card rounded-t-3xl w-full max-h-[85vh] overflow-y-auto p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold">서명 완료 계약서</h3>
              <button onClick={() => setDetailId(null)}><X className="h-5 w-5" /></button>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {[
                ["이름", detail.memberName], ["연락처", detail.memberPhone],
                ["프로그램", detail.programName], ["서명자", detail.signerName],
                ["서명일시", detail.signedAt?.slice(0, 16)],
                ["마케팅 동의", detail.agreedMarketing ? "동의" : "비동의"],
              ].filter(r => r[1]).map(([label, value]) => (
                <div key={label} className="bg-accent/30 rounded-lg px-3 py-2">
                  <p className="text-[10px] text-muted-foreground">{label}</p>
                  <p className="font-semibold mt-0.5">{value}</p>
                </div>
              ))}
            </div>
            {detail.signaturePng && (
              <div className="space-y-1">
                <p className="text-xs font-semibold text-muted-foreground">서명 이미지</p>
                <div className="border border-border rounded-xl p-3 bg-white">
                  <img src={detail.signaturePng} className="w-full h-24 object-contain" />
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── 환불 계약서 관리 ────────────────────────────────────────────────────────────
function RefundContractManager() {
  const { data: list, refetch } = trpc.eContract.list.useQuery();
  const createMutation = trpc.eContract.createRefund.useMutation({ onSuccess: () => { refetch(); setShowForm(false); resetForm(); } });
  const deleteMutation = trpc.eContract.delete.useMutation({ onSuccess: () => refetch() });
  const [showForm, setShowForm] = useState(false);
  const [detailId, setDetailId] = useState<number | null>(null);
  const { data: detail } = trpc.eContract.getDetail.useQuery({ id: detailId! }, { enabled: !!detailId });

  const emptyForm = { memberName: "", memberPhone: "", programName: "", programPrice: "", programSessions: "", usedSessions: "", refundAmount: "", refundReason: "", bankName: "", accountNumber: "", accountHolder: "" };
  const [form, setForm] = useState(emptyForm);
  function resetForm() { setForm(emptyForm); }

  const refundList = (list ?? []).filter((c: any) => c.contractType === 'refund');

  function copyLink(token: string) {
    const url = `${window.location.origin}/contract/${token}`;
    navigator.clipboard.writeText(url).then(() => toast.success("링크 복사됨")).catch(() => toast.error("복사 실패"));
  }
  function openKakao(token: string) {
    const url = `${window.location.origin}/contract/${token}`;
    navigator.clipboard.writeText(url).then(() => {
      toast.success("링크 복사됨 — 카카오톡에 붙여넣기 하세요");
      setTimeout(() => { window.location.href = "kakaotalk://"; }, 300);
    });
  }

  const statusMeta: Record<string, { label: string; cls: string }> = {
    pending: { label: "서명 대기", cls: "bg-amber-100 text-amber-700" },
    signed:  { label: "서명 완료", cls: "bg-green-100 text-green-700" },
  };

  return (
    <div className="space-y-3 pt-3 border-t border-border/60">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-muted-foreground">환불 계약서 목록</p>
        <button onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-1.5 text-xs font-semibold bg-primary text-primary-foreground px-3 py-1.5 rounded-lg hover:bg-primary/90">
          <Plus className="h-3.5 w-3.5" /> 환불 계약서 생성
        </button>
      </div>

      {showForm && (
        <div className="bg-accent/30 border border-border rounded-xl p-4 space-y-3">
          <p className="text-xs font-semibold">환불 정보 입력</p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: "회원 이름", key: "memberName", placeholder: "홍길동" },
              { label: "연락처", key: "memberPhone", placeholder: "010-0000-0000" },
              { label: "프로그램명", key: "programName", placeholder: "PT 10회" },
              { label: "결제 금액(원)", key: "programPrice", placeholder: "500000" },
              { label: "총 횟수", key: "programSessions", placeholder: "10" },
              { label: "수강 횟수", key: "usedSessions", placeholder: "3" },
              { label: "환불 금액(원)", key: "refundAmount", placeholder: "350000" },
            ].map(({ label, key, placeholder }) => (
              <div key={key} className="space-y-1">
                <label className="text-[10px] font-semibold text-muted-foreground">{label}</label>
                <input value={(form as any)[key]} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
                  placeholder={placeholder}
                  className="w-full border border-border rounded-lg px-2.5 py-2 text-xs bg-background focus:outline-none focus:border-primary" />
              </div>
            ))}
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-semibold text-muted-foreground">환불 사유</label>
            <textarea value={form.refundReason} onChange={e => setForm(p => ({ ...p, refundReason: e.target.value }))}
              rows={2} placeholder="부상, 개인 사정 등"
              className="w-full border border-border rounded-lg px-2.5 py-2 text-xs bg-background focus:outline-none focus:border-primary resize-none" />
          </div>
          <p className="text-[10px] font-semibold text-muted-foreground pt-1">환불 계좌 정보 (선택)</p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: "은행", key: "bankName", placeholder: "국민은행" },
              { label: "예금주", key: "accountHolder", placeholder: "홍길동" },
            ].map(({ label, key, placeholder }) => (
              <div key={key} className="space-y-1">
                <label className="text-[10px] font-semibold text-muted-foreground">{label}</label>
                <input value={(form as any)[key]} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
                  placeholder={placeholder}
                  className="w-full border border-border rounded-lg px-2.5 py-2 text-xs bg-background focus:outline-none focus:border-primary" />
              </div>
            ))}
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-semibold text-muted-foreground">계좌번호</label>
            <input value={form.accountNumber} onChange={e => setForm(p => ({ ...p, accountNumber: e.target.value }))}
              placeholder="000-0000-0000000"
              className="w-full border border-border rounded-lg px-2.5 py-2 text-xs bg-background focus:outline-none focus:border-primary" />
          </div>
          <div className="flex gap-2">
            <button onClick={() => { setShowForm(false); resetForm(); }} className="flex-1 text-xs py-2 border border-border rounded-lg text-muted-foreground">취소</button>
            <button disabled={createMutation.isPending} onClick={() => createMutation.mutate({
              memberName: form.memberName || undefined,
              memberPhone: form.memberPhone || undefined,
              programName: form.programName || undefined,
              programPrice: form.programPrice ? parseInt(form.programPrice) : undefined,
              programSessions: form.programSessions ? parseInt(form.programSessions) : undefined,
              usedSessions: form.usedSessions ? parseInt(form.usedSessions) : undefined,
              refundAmount: form.refundAmount ? parseInt(form.refundAmount) : undefined,
              refundReason: form.refundReason || undefined,
              bankName: form.bankName || undefined,
              accountNumber: form.accountNumber || undefined,
              accountHolder: form.accountHolder || undefined,
            })} className="flex-1 text-xs py-2 bg-primary text-primary-foreground rounded-lg font-semibold disabled:opacity-50">
              {createMutation.isPending ? "생성 중..." : "계약서 생성 및 링크 발급"}
            </button>
          </div>
        </div>
      )}

      {refundList.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-4">생성된 환불 계약서가 없습니다</p>
      ) : (
        <div className="space-y-2">
          {refundList.map((c: any) => {
            const sm = statusMeta[c.status] ?? statusMeta.pending;
            const extra = (() => { try { return JSON.parse(c.extraData || '{}'); } catch { return {}; } })();
            return (
              <div key={c.id} className="bg-background border border-border rounded-xl p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-semibold">{c.memberName || "이름 미입력"}</p>
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${sm.cls}`}>{sm.label}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {c.programName && `${c.programName} · `}
                      {extra.refundAmount ? `환불 ${Number(extra.refundAmount).toLocaleString()}원` : ""}
                      {` · ${c.createdAt?.slice(0, 10)}`}
                    </p>
                  </div>
                  <button onClick={() => { if (confirm("삭제할까요?")) deleteMutation.mutate({ id: c.id }); }}
                    className="p-1 rounded-lg hover:bg-muted shrink-0">
                    <X className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                </div>
                <div className="flex gap-1.5">
                  <button onClick={() => copyLink(c.token)}
                    className="flex-1 flex items-center justify-center gap-1 text-[11px] font-semibold border border-border rounded-lg py-1.5 hover:bg-muted">
                    <Copy className="h-3 w-3" /> 링크 복사
                  </button>
                  <button onClick={() => openKakao(c.token)}
                    className="flex-1 flex items-center justify-center gap-1 text-[11px] font-semibold bg-[#FEE500] text-[#3A1D1D] rounded-lg py-1.5 hover:opacity-90">
                    카카오톡 공유
                  </button>
                  {c.status === "signed" && (
                    <button onClick={() => setDetailId(c.id)}
                      className="flex-1 flex items-center justify-center gap-1 text-[11px] font-semibold bg-primary/10 text-primary rounded-lg py-1.5 hover:bg-primary/20">
                      서명 확인
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {detail && (
        <div className="fixed inset-0 z-50 flex items-end">
          <div className="absolute inset-0 bg-black/50" onClick={() => setDetailId(null)} />
          <div className="relative bg-card rounded-t-3xl w-full max-h-[85vh] overflow-y-auto p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold">서명 완료 — 환불 계약서</h3>
              <button onClick={() => setDetailId(null)}><X className="h-5 w-5" /></button>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {[
                ["회원명", detail.memberName], ["연락처", detail.memberPhone],
                ["프로그램", detail.programName], ["서명자", detail.signerName],
                ["서명일시", detail.signedAt?.slice(0, 16)],
              ].filter(r => r[1]).map(([label, value]) => (
                <div key={label} className="bg-accent/30 rounded-lg px-3 py-2">
                  <p className="text-[10px] text-muted-foreground">{label}</p>
                  <p className="font-semibold mt-0.5">{value}</p>
                </div>
              ))}
            </div>
            {detail.signaturePng && (
              <div className="border border-border rounded-xl p-3 bg-white">
                <img src={detail.signaturePng} className="w-full h-24 object-contain" />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── 양도양수 계약서 관리 ─────────────────────────────────────────────────────
function TransferContractManager() {
  const { data: list, refetch } = trpc.eContract.list.useQuery();
  const createMutation = trpc.eContract.createTransfer.useMutation({ onSuccess: () => { refetch(); setShowForm(false); resetForm(); } });
  const deleteMutation = trpc.eContract.delete.useMutation({ onSuccess: () => refetch() });
  const [showForm, setShowForm] = useState(false);
  const [detailId, setDetailId] = useState<number | null>(null);
  const { data: detail } = trpc.eContract.getDetail.useQuery({ id: detailId! }, { enabled: !!detailId });

  const emptyForm = { transferorName: "", transferorPhone: "", programName: "", totalSessions: "", usedSessions: "", remainingSessions: "", transferDate: "", trainerMemo: "" };
  const [form, setForm] = useState(emptyForm);
  function resetForm() { setForm(emptyForm); }

  const transferList = (list ?? []).filter((c: any) => c.contractType === 'transfer');

  function copyLink(token: string) {
    const url = `${window.location.origin}/contract/${token}`;
    navigator.clipboard.writeText(url).then(() => toast.success("링크 복사됨")).catch(() => toast.error("복사 실패"));
  }
  function openKakao(token: string) {
    const url = `${window.location.origin}/contract/${token}`;
    navigator.clipboard.writeText(url).then(() => {
      toast.success("링크 복사됨 — 카카오톡에 붙여넣기 하세요");
      setTimeout(() => { window.location.href = "kakaotalk://"; }, 300);
    });
  }

  const statusMeta: Record<string, { label: string; cls: string }> = {
    pending:           { label: "양도인 서명 대기",  cls: "bg-amber-100 text-amber-700" },
    transferor_signed: { label: "양수인 서명 대기",  cls: "bg-blue-100 text-blue-700" },
    signed:            { label: "서명 완료",          cls: "bg-green-100 text-green-700" },
  };

  return (
    <div className="space-y-3 pt-3 border-t border-border/60">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-muted-foreground">양도양수 계약서 목록</p>
        <button onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-1.5 text-xs font-semibold bg-primary text-primary-foreground px-3 py-1.5 rounded-lg hover:bg-primary/90">
          <Plus className="h-3.5 w-3.5" /> 계약서 생성
        </button>
      </div>

      {showForm && (
        <div className="bg-accent/30 border border-border rounded-xl p-4 space-y-3">
          <p className="text-xs font-semibold">양도 정보 입력</p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: "양도인 이름", key: "transferorName", placeholder: "홍길동" },
              { label: "양도인 연락처", key: "transferorPhone", placeholder: "010-0000-0000" },
              { label: "프로그램명", key: "programName", placeholder: "PT 10회" },
              { label: "총 횟수", key: "totalSessions", placeholder: "10" },
              { label: "수강 횟수", key: "usedSessions", placeholder: "3" },
              { label: "잔여 횟수", key: "remainingSessions", placeholder: "7" },
            ].map(({ label, key, placeholder }) => (
              <div key={key} className="space-y-1">
                <label className="text-[10px] font-semibold text-muted-foreground">{label}</label>
                <input value={(form as any)[key]} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
                  placeholder={placeholder}
                  className="w-full border border-border rounded-lg px-2.5 py-2 text-xs bg-background focus:outline-none focus:border-primary" />
              </div>
            ))}
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-semibold text-muted-foreground">양도 예정일</label>
            <input type="date" value={form.transferDate} onChange={e => setForm(p => ({ ...p, transferDate: e.target.value }))}
              className="w-full border border-border rounded-lg px-2.5 py-2 text-xs bg-background focus:outline-none focus:border-primary" />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-semibold text-muted-foreground">트레이너 메모 (선택)</label>
            <textarea value={form.trainerMemo} onChange={e => setForm(p => ({ ...p, trainerMemo: e.target.value }))}
              rows={2} placeholder="특이사항 등"
              className="w-full border border-border rounded-lg px-2.5 py-2 text-xs bg-background focus:outline-none focus:border-primary resize-none" />
          </div>
          <div className="flex gap-2">
            <button onClick={() => { setShowForm(false); resetForm(); }} className="flex-1 text-xs py-2 border border-border rounded-lg text-muted-foreground">취소</button>
            <button disabled={createMutation.isPending} onClick={() => createMutation.mutate({
              transferorName: form.transferorName || undefined,
              transferorPhone: form.transferorPhone || undefined,
              programName: form.programName || undefined,
              totalSessions: form.totalSessions ? parseInt(form.totalSessions) : undefined,
              usedSessions: form.usedSessions ? parseInt(form.usedSessions) : undefined,
              remainingSessions: form.remainingSessions ? parseInt(form.remainingSessions) : undefined,
              transferDate: form.transferDate || undefined,
              trainerMemo: form.trainerMemo || undefined,
            })} className="flex-1 text-xs py-2 bg-primary text-primary-foreground rounded-lg font-semibold disabled:opacity-50">
              {createMutation.isPending ? "생성 중..." : "계약서 생성 및 링크 발급"}
            </button>
          </div>
        </div>
      )}

      {transferList.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-4">생성된 양도양수 계약서가 없습니다</p>
      ) : (
        <div className="space-y-2">
          {transferList.map((c: any) => {
            const sm = statusMeta[c.status] ?? statusMeta.pending;
            const extra = (() => { try { return JSON.parse(c.extraData || '{}'); } catch { return {}; } })();
            return (
              <div key={c.id} className="bg-background border border-border rounded-xl p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-semibold">{extra.transferorName || "양도인 미입력"}</p>
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${sm.cls}`}>{sm.label}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {c.programName && `${c.programName} · `}
                      {extra.remainingSessions ? `잔여 ${extra.remainingSessions}회` : ""}
                      {` · ${c.createdAt?.slice(0, 10)}`}
                    </p>
                  </div>
                  <button onClick={() => { if (confirm("삭제할까요?")) deleteMutation.mutate({ id: c.id }); }}
                    className="p-1 rounded-lg hover:bg-muted shrink-0">
                    <X className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                </div>
                <div className="flex gap-1.5">
                  <button onClick={() => copyLink(c.token)}
                    className="flex-1 flex items-center justify-center gap-1 text-[11px] font-semibold border border-border rounded-lg py-1.5 hover:bg-muted">
                    <Copy className="h-3 w-3" /> 링크 복사
                  </button>
                  <button onClick={() => openKakao(c.token)}
                    className="flex-1 flex items-center justify-center gap-1 text-[11px] font-semibold bg-[#FEE500] text-[#3A1D1D] rounded-lg py-1.5 hover:opacity-90">
                    카카오톡 공유
                  </button>
                  {c.status === "signed" && (
                    <button onClick={() => setDetailId(c.id)}
                      className="flex-1 flex items-center justify-center gap-1 text-[11px] font-semibold bg-primary/10 text-primary rounded-lg py-1.5 hover:bg-primary/20">
                      서명 확인
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {detail && (
        <div className="fixed inset-0 z-50 flex items-end">
          <div className="absolute inset-0 bg-black/50" onClick={() => setDetailId(null)} />
          <div className="relative bg-card rounded-t-3xl w-full max-h-[85vh] overflow-y-auto p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold">서명 완료 — 양도양수 계약서</h3>
              <button onClick={() => setDetailId(null)}><X className="h-5 w-5" /></button>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {[
                ["양수인 (서명자)", detail.signerName], ["양수인 연락처", detail.memberPhone],
                ["프로그램", detail.programName], ["서명일시", detail.signedAt?.slice(0, 16)],
              ].filter(r => r[1]).map(([label, value]) => (
                <div key={label} className="bg-accent/30 rounded-lg px-3 py-2">
                  <p className="text-[10px] text-muted-foreground">{label}</p>
                  <p className="font-semibold mt-0.5">{value}</p>
                </div>
              ))}
            </div>
            {detail.signaturePng && (
              <div className="border border-border rounded-xl p-3 bg-white">
                <img src={detail.signaturePng} className="w-full h-24 object-contain" />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── 예약 기능 패널 (수업 예약 기능 탭) ───────────────────────────────────────
const DAYS_KO = ["일", "월", "화", "수", "목", "금", "토"];
const STATUS_META: Record<string, { label: string; cls: string }> = {
  pending:   { label: "예약 대기",  cls: "bg-blue-500/15 text-blue-600" },
  confirmed: { label: "예약 확정",  cls: "bg-green-500/15 text-green-600" },
  visited:   { label: "방문 완료",  cls: "bg-violet-500/15 text-violet-600" },
  cancelled: { label: "취소",       cls: "bg-red-500/15 text-red-500" },
  noshow:    { label: "노쇼",       cls: "bg-amber-500/15 text-amber-600" },
};

function BookingFeaturePanel() {
  const utils = trpc.useUtils();
  const { data: brand, isLoading: brandLoading } = trpc.brand.getMyBrand.useQuery();
  const updateBrandMutation = trpc.brand.updateMyBrand.useMutation({
    onSuccess: () => { toast.success("저장되었습니다."); utils.brand.getMyBrand.invalidate(); },
    onError: e => toast.error(e.message),
  });

  const [tab, setTab] = useState<"settings" | "schedule" | "list">("settings");

  // ── 설정 탭 ──
  const [bkData, setBkData] = useState<any>(null);
  useEffect(() => {
    if (!brand || bkData !== null) return;
    const parsed = brand.brandBlocks ? (() => { try { return JSON.parse(brand.brandBlocks); } catch { return null; } })() : null;
    const bkBlock = parsed?.find((b: any) => b.type === "booking");
    setBkData(bkBlock?.data ?? { enabled: brand.bookingEnabled === 1, message: brand.bookingMessage ?? "", programs: ["PT (퍼스널 트레이닝)", "필라테스", "기타"], buttonText: "", guideText: "" });
  }, [brand]);

  function saveSettings() {
    if (!brand || !bkData) return;
    const parsed = brand.brandBlocks ? (() => { try { return JSON.parse(brand.brandBlocks); } catch { return null; } })() : null;
    let blocks = parsed ?? [];
    if (blocks.some((b: any) => b.type === "booking")) {
      blocks = blocks.map((b: any) => b.type === "booking" ? { ...b, data: bkData } : b);
    } else {
      blocks = [...blocks, { id: "booking", type: "booking", visible: true, data: bkData }];
    }
    updateBrandMutation.mutate({
      bookingEnabled: bkData.enabled ? 1 : 0,
      bookingMessage: bkData.message ?? "",
      brandIsPublic: brand.brandIsPublic ?? 0,
      brandBlocks: JSON.stringify(blocks),
    } as any);
  }

  // ── 시간 관리 탭 ──
  const today = new Date();
  const [slotMonth, setSlotMonth] = useState(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`);
  const { data: slots, refetch: refetchSlots } = trpc.booking.getSlots.useQuery({ month: slotMonth });
  const addSlotMutation = trpc.booking.addSlot.useMutation({ onSuccess: () => refetchSlots() });
  const deleteSlotMutation = trpc.booking.deleteSlot.useMutation({ onSuccess: () => refetchSlots() });

  const { data: recurring, refetch: refetchRecurring } = trpc.booking.getRecurring.useQuery();
  const saveRecurringMutation = trpc.booking.saveRecurring.useMutation({
    onSuccess: () => { toast.success("반복 일정 저장됨"); refetchRecurring(); },
  });
  const generateMutation = trpc.booking.generateFromRecurring.useMutation({
    onSuccess: (d) => { toast.success(`${d.created}개 슬롯 생성됨`); refetchSlots(); },
  });

  const { data: blackouts, refetch: refetchBlackouts } = trpc.booking.getBlackouts.useQuery();
  const addBlackoutMutation = trpc.booking.addBlackout.useMutation({ onSuccess: () => refetchBlackouts() });
  const deleteBlackoutMutation = trpc.booking.deleteBlackout.useMutation({ onSuccess: () => refetchBlackouts() });

  // recurring 편집 로컬 상태
  const [recurringEdit, setRecurringEdit] = useState<{ dayOfWeek: number; times: string[] }[]>([]);
  const recurringInitRef = useRef(false);
  useEffect(() => {
    if (!recurring || recurringInitRef.current) return;
    recurringInitRef.current = true;
    setRecurringEdit(
      [0, 1, 2, 3, 4, 5, 6].map(dow => {
        const found = recurring.find((r: any) => r.dayOfWeek === dow);
        return { dayOfWeek: dow, times: found?.times ?? [] };
      })
    );
  }, [recurring]);

  function toggleRecurringTime(dow: number, time: string) {
    setRecurringEdit(prev => prev.map(r =>
      r.dayOfWeek !== dow ? r : {
        ...r,
        times: r.times.includes(time) ? r.times.filter(t => t !== time) : [...r.times, time].sort(),
      }
    ));
  }

  const TIME_PRESETS = ["06:00","07:00","08:00","09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00","18:00","19:00","20:00","21:00","22:00"];
  const [newSlotDate, setNewSlotDate] = useState("");
  const [newSlotTimes, setNewSlotTimes] = useState<string[]>([]);
  const [newBlackout, setNewBlackout] = useState("");
  const [generateWeeks, setGenerateWeeks] = useState(4);

  // ── 예약 목록 탭 ──
  const { data: bookingList, refetch: refetchBookings } = trpc.booking.listBookings.useQuery();
  const updateStatusMutation = trpc.booking.updateStatus.useMutation({ onSuccess: () => refetchBookings() });
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [bookingTypeFilter, setBookingTypeFilter] = useState<"class" | "consultation">("class");

  const filteredBookings = (bookingList ?? []).filter((b: any) => {
    const isClass = b.slotId != null;
    if (bookingTypeFilter === "class" && !isClass) return false;
    if (bookingTypeFilter === "consultation" && isClass) return false;
    return statusFilter === "all" || b.status === statusFilter;
  });

  if (brandLoading) return <p className="text-sm text-muted-foreground text-center py-4">로딩 중...</p>;

  return (
    <div className="space-y-4">
      {/* 탭 헤더 */}
      <div className="flex gap-1 bg-muted rounded-xl p-1">
        {(["settings", "schedule", "list"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors ${tab === t ? "bg-background shadow text-foreground" : "text-muted-foreground"}`}>
            {t === "settings" ? "설정" : t === "schedule" ? "시간 관리" : "예약 목록"}
          </button>
        ))}
      </div>

      {/* ── 설정 탭 ── */}
      {tab === "settings" && bkData && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">예약 받기 활성화</p>
            <button onClick={() => setBkData((p: any) => ({ ...p, enabled: !p.enabled }))}
              className={`relative rounded-full transition-colors ${bkData.enabled ? "bg-primary" : "bg-muted"}`}
              style={{ width: 40, height: 22 }}>
              <span className={`absolute top-0.5 bg-white rounded-full shadow transition-all`}
                style={{ width: 18, height: 18, left: bkData.enabled ? 20 : 2 }} />
            </button>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground font-semibold">버튼 문구</label>
            <input value={bkData.buttonText ?? ""} onChange={e => setBkData((p: any) => ({ ...p, buttonText: e.target.value }))}
              placeholder="상담 예약하기"
              className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground font-semibold">예약 안내 문구</label>
            <textarea value={bkData.guideText ?? bkData.message ?? ""} rows={2}
              onChange={e => setBkData((p: any) => ({ ...p, guideText: e.target.value, message: e.target.value }))}
              placeholder="예약 후 연락드립니다. 체험 수업은 예약제로 운영됩니다."
              className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-primary" />
          </div>
          {/* 관심 프로그램 */}
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground font-semibold">관심 프로그램 옵션</label>
            {(bkData.programs ?? []).map((p: string, i: number) => (
              <div key={i} className="flex items-center gap-2 bg-accent/30 rounded-xl px-3 py-2">
                <span className="text-xs flex-1">{p}</span>
                <button onClick={() => setBkData((prev: any) => ({ ...prev, programs: prev.programs.filter((_: any, j: number) => j !== i) }))}
                  className="text-muted-foreground hover:text-red-500"><X className="h-3.5 w-3.5" /></button>
              </div>
            ))}
            <ProgramAddInput onAdd={name => setBkData((p: any) => ({ ...p, programs: [...(p.programs ?? []), name] }))} />
          </div>
          <Button size="sm" className="w-full" disabled={updateBrandMutation.isPending} onClick={saveSettings}>
            {updateBrandMutation.isPending ? "저장 중..." : "저장"}
          </Button>

          {/* 회원 수업 예약 링크 */}
          {brand?.username && (
            <div className="space-y-1.5 border-t border-border pt-4">
              <p className="text-xs font-semibold text-muted-foreground">기존 회원 수업 예약 링크</p>
              <p className="text-[11px] text-muted-foreground">기존 회원에게 공유하는 수업 예약 전용 페이지입니다. 브랜드 페이지와 별도로 운영됩니다.</p>
              <div className="flex gap-2 items-center bg-accent/40 rounded-xl px-3 py-2">
                <span className="text-xs flex-1 truncate text-foreground/70 font-mono">{window.location.origin}/c/{brand.username}</span>
                <button
                  onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/c/${brand.username}`); toast.success("링크 복사됨"); }}
                  className="text-[11px] font-semibold text-primary shrink-0 hover:underline">
                  복사
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── 시간 관리 탭 ── */}
      {tab === "schedule" && (
        <div className="space-y-5">
          {/* 반복 일정 */}
          <div className="space-y-3">
            <p className="text-sm font-semibold">반복 일정 설정</p>
            <p className="text-xs text-muted-foreground">예약 가능한 요일과 시간을 선택하세요.</p>
            <div className="space-y-2">
              {recurringEdit.map(r => (
                <div key={r.dayOfWeek} className="border border-border rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold">{DAYS_KO[r.dayOfWeek]}요일</p>
                    {r.times.length > 0 && <span className="text-[10px] text-primary font-semibold">{r.times.length}개 선택됨</span>}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {TIME_PRESETS.map(t => (
                      <button key={t} onClick={() => toggleRecurringTime(r.dayOfWeek, t)}
                        className={`text-[11px] px-2 py-1 rounded-lg border transition-colors font-medium ${r.times.includes(t) ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border text-muted-foreground"}`}>
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            {/* 저장 + 자동 생성 한 번에 */}
            <div className="flex gap-2 items-center">
              <select value={generateWeeks} onChange={e => setGenerateWeeks(Number(e.target.value))}
                className="h-9 bg-background border border-border rounded-lg px-2 text-xs shrink-0">
                {[1,2,4,8,12].map(w => <option key={w} value={w}>앞으로 {w}주</option>)}
              </select>
              <Button size="sm" className="flex-1 h-9 text-xs"
                disabled={saveRecurringMutation.isPending || generateMutation.isPending}
                onClick={async () => {
                  const toSave = recurringEdit.filter(r => r.times.length > 0);
                  await saveRecurringMutation.mutateAsync(toSave);
                  generateMutation.mutate({ weeks: generateWeeks });
                }}>
                {(saveRecurringMutation.isPending || generateMutation.isPending) ? "생성 중..." : "저장 후 슬롯 자동 생성"}
              </Button>
            </div>
          </div>

          {/* 특정 날짜 슬롯 추가 */}
          <div className="space-y-3">
            <p className="text-sm font-semibold">특정 날짜 슬롯 추가</p>
            <div className="space-y-2">
              <input type="date" value={newSlotDate} onChange={e => setNewSlotDate(e.target.value)}
                className="w-full h-9 bg-background border border-border rounded-xl px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
              <div className="flex flex-wrap gap-1.5">
                {TIME_PRESETS.map(t => (
                  <button key={t} onClick={() => setNewSlotTimes(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t].sort())}
                    className={`text-[11px] px-2 py-1 rounded-lg border font-medium transition-colors ${newSlotTimes.includes(t) ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border text-muted-foreground"}`}>
                    {t}
                  </button>
                ))}
              </div>
              <Button size="sm" className="w-full" disabled={!newSlotDate || newSlotTimes.length === 0 || addSlotMutation.isPending}
                onClick={() => { if (newSlotDate && newSlotTimes.length) { addSlotMutation.mutate({ date: newSlotDate, times: newSlotTimes }); setNewSlotTimes([]); } }}>
                {addSlotMutation.isPending ? "추가 중..." : `슬롯 추가 (${newSlotTimes.length}개)`}
              </Button>
            </div>
          </div>

          {/* 등록된 슬롯 */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold flex-1">등록된 슬롯</p>
              <button onClick={() => {
                const [y, m] = slotMonth.split("-").map(Number);
                const prev = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
                setSlotMonth(prev);
              }} className="text-muted-foreground hover:text-foreground p-1"><ChevronUp className="h-3.5 w-3.5 rotate-[-90deg]" /></button>
              <span className="text-xs font-medium">{slotMonth}</span>
              <button onClick={() => {
                const [y, m] = slotMonth.split("-").map(Number);
                const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
                setSlotMonth(next);
              }} className="text-muted-foreground hover:text-foreground p-1"><ChevronDown className="h-3.5 w-3.5 rotate-[-90deg]" /></button>
            </div>
            {!slots || slots.length === 0
              ? <p className="text-xs text-muted-foreground text-center py-2">슬롯이 없습니다</p>
              : (() => {
                const byDate: Record<string, any[]> = {};
                (slots as any[]).forEach(s => { (byDate[s.date] = byDate[s.date] ?? []).push(s); });
                return Object.entries(byDate).sort().map(([date, ss]) => (
                  <div key={date} className="border border-border rounded-xl p-3 space-y-1.5">
                    <p className="text-xs font-semibold">{date}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {ss.map((s: any) => (
                        <div key={s.id} className={`flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg border font-medium ${s.isBooked ? "bg-muted text-muted-foreground border-border" : "bg-background border-border text-foreground"}`}>
                          {s.time}
                          {s.isBooked ? <span className="text-[10px] text-amber-500">예약됨</span>
                            : <button onClick={() => deleteSlotMutation.mutate({ id: s.id })} className="text-muted-foreground hover:text-red-500 ml-0.5"><X className="h-2.5 w-2.5" /></button>}
                        </div>
                      ))}
                    </div>
                  </div>
                ));
              })()
            }
          </div>

          {/* 휴무일 */}
          <div className="space-y-2">
            <p className="text-sm font-semibold">휴무일</p>
            <div className="flex gap-2">
              <input type="date" value={newBlackout} onChange={e => setNewBlackout(e.target.value)}
                className="flex-1 h-9 bg-background border border-border rounded-xl px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
              <Button size="sm" className="h-9 px-4" disabled={!newBlackout || addBlackoutMutation.isPending}
                onClick={() => { addBlackoutMutation.mutate({ date: newBlackout }); setNewBlackout(""); }}>
                추가
              </Button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(blackouts ?? []).map((b: any) => (
                <div key={b.id} className="flex items-center gap-1 bg-red-500/10 text-red-600 text-xs px-2.5 py-1 rounded-lg">
                  <span>{b.date}</span>
                  <button onClick={() => deleteBlackoutMutation.mutate({ date: b.date })}><X className="h-3 w-3" /></button>
                </div>
              ))}
              {(!blackouts || blackouts.length === 0) && <p className="text-xs text-muted-foreground">등록된 휴무일이 없습니다</p>}
            </div>
          </div>
        </div>
      )}

      {/* ── 예약 목록 탭 ── */}
      {tab === "list" && (
        <div className="space-y-3">
          {/* 수업 / 상담 구분 */}
          <div className="flex gap-1 bg-muted rounded-xl p-1">
            {(["class", "consultation"] as const).map(t => (
              <button key={t} onClick={() => setBookingTypeFilter(t)}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors ${bookingTypeFilter === t ? "bg-background shadow text-foreground" : "text-muted-foreground"}`}>
                {t === "class" ? "수업 예약" : "상담 문의"}
              </button>
            ))}
          </div>
          {/* 상태 필터 */}
          <div className="flex gap-1.5 flex-wrap">
            <button onClick={() => setStatusFilter("all")}
              className={`text-[11px] px-2.5 py-1 rounded-lg border font-semibold transition-colors ${statusFilter === "all" ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border text-muted-foreground"}`}>
              전체
            </button>
            {Object.entries(STATUS_META).map(([k, v]) => (
              <button key={k} onClick={() => setStatusFilter(k)}
                className={`text-[11px] px-2.5 py-1 rounded-lg border font-semibold transition-colors ${statusFilter === k ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border text-muted-foreground"}`}>
                {v.label}
              </button>
            ))}
          </div>

          {filteredBookings.length === 0
            ? <p className="text-xs text-muted-foreground text-center py-4">예약 내역이 없습니다</p>
            : filteredBookings.map((b: any) => (
              <div key={b.id} className="bg-background border border-border rounded-xl p-3.5 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold">{b.name}</p>
                    <p className="text-xs text-muted-foreground">{b.phone}</p>
                  </div>
                  <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold shrink-0 ${STATUS_META[b.status]?.cls ?? "bg-muted text-muted-foreground"}`}>
                    {STATUS_META[b.status]?.label ?? b.status}
                  </span>
                </div>
                {(b.reservedDate || b.reservedTime) && (
                  <p className="text-xs text-muted-foreground">{b.reservedDate} {b.reservedTime}</p>
                )}
                {b.interestType && <p className="text-xs text-muted-foreground">프로그램: {b.interestType}</p>}
                {b.message && <p className="text-xs text-muted-foreground border-t border-border/60 pt-1.5 mt-1">문의: {b.message}</p>}
                {/* 상태 변경 */}
                <div className="flex flex-wrap gap-1.5 pt-1 border-t border-border/40">
                  {(["pending","confirmed","visited","cancelled","noshow"] as const).map(s => (
                    <button key={s} disabled={b.status === s || updateStatusMutation.isPending}
                      onClick={() => updateStatusMutation.mutate({ id: b.id, status: s })}
                      className={`text-[11px] px-2.5 py-1 rounded-lg border font-medium transition-colors disabled:opacity-40 ${b.status === s ? "bg-primary/10 text-primary border-primary/30" : "bg-background border-border text-muted-foreground hover:border-primary/40"}`}>
                      {STATUS_META[s].label}
                    </button>
                  ))}
                </div>
              </div>
            ))
          }
        </div>
      )}
    </div>
  );
}

function ProgramAddInput({ onAdd }: { onAdd: (name: string) => void }) {
  const [val, setVal] = useState("");
  return (
    <div className="flex gap-2">
      <input value={val} onChange={e => setVal(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter" && val.trim()) { onAdd(val.trim()); setVal(""); } }}
        placeholder="프로그램명 입력 후 Enter"
        className="flex-1 bg-background border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
      <button onClick={() => { if (val.trim()) { onAdd(val.trim()); setVal(""); } }}
        className="px-3 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-semibold">추가</button>
    </div>
  );
}

// ── 브랜드 페이지 빌더 (메인) ────────────────────────────────────────────────
function BrandPageEditor({ bookingOnly }: { bookingOnly?: boolean } = {}) {
  const { data: user } = trpc.auth.me.useQuery();
  const utils = trpc.useUtils();
  const { data: brand, isLoading } = trpc.brand.getMyBrand.useQuery();
  const { data: bookings } = trpc.brand.listBookings.useQuery();
  const silentSaveRef = useRef(false);
  const updateMutation = trpc.brand.updateMyBrand.useMutation({
    onSuccess: () => {
      if (!silentSaveRef.current) toast.success("저장되었습니다.");
      silentSaveRef.current = false;
      utils.brand.getMyBrand.invalidate();
    },
    onError: e => { silentSaveRef.current = false; toast.error(e.message); },
  });
  const statusMutation = trpc.brand.updateBookingStatus.useMutation({
    onSuccess: () => utils.brand.listBookings.invalidate(),
  });
  const isAdmin = (user as any)?.role === "admin";
  const { data: wsStatus } = trpc.workshop.getStatus.useQuery(undefined, { enabled: !isAdmin });
  const isTrial = wsStatus?.status === "trial" || wsStatus?.status === "active";
  const [showAddBlock, setShowAddBlock] = useState(false);

  const [blocks, setBlocks] = useState<BrandBlock[]>([]);
  const [brandIsPublic, setBrandIsPublic] = useState(0);
  const [dirty, setDirty] = useState(false);

  // useRef로 추적 — setState during render 안티패턴 제거
  const initializedRef = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const blocksRef = useRef<BrandBlock[]>([]);
  const brandIsPublicRef = useRef(0);
  useEffect(() => { blocksRef.current = blocks; }, [blocks]);
  useEffect(() => { brandIsPublicRef.current = brandIsPublic; }, [brandIsPublic]);

  // 초기화: brand 데이터가 오면 한 번만 세팅
  useEffect(() => {
    if (!brand || initializedRef.current) return;
    initializedRef.current = true;
    const parsed: BrandBlock[] | null = brand.brandBlocks
      ? (() => { try { return JSON.parse(brand.brandBlocks); } catch { return null; } })()
      : null;
    const blockList = (parsed && parsed.length > 0) ? parsed : defaultBlocks(brand);
    setBlocks(blockList);
    setBrandIsPublic(brand.brandIsPublic ?? 0);
  }, [brand]);

  // 자동저장: unmount 시 미저장 데이터 즉시 flush
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      if (!initializedRef.current) return;
      const currentBlocks = blocksRef.current;
      if (currentBlocks.length === 0) return;
      silentSaveRef.current = true;
      const legacy = buildLegacyFieldsStatic(currentBlocks);
      updateMutation.mutate({
        ...legacy,
        brandIsPublic: brandIsPublicRef.current,
        brandBlocks: JSON.stringify(currentBlocks),
      } as any);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const trainerId = (user as any)?.trainerId;
  const brandUrl = `${window.location.origin}/p/${trainerId}`;

  function scheduleAutoSave() {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      const currentBlocks = blocksRef.current;
      if (currentBlocks.length === 0) return;
      silentSaveRef.current = true;
      const legacy = buildLegacyFieldsStatic(currentBlocks);
      updateMutation.mutate({
        ...legacy,
        brandIsPublic: brandIsPublicRef.current,
        brandBlocks: JSON.stringify(currentBlocks),
      } as any);
      setDirty(false);
    }, 1500);
  }

  function updateBlock(id: string, data: any) {
    setBlocks(prev => prev.map(b => b.id === id ? { ...b, data } : b));
    setDirty(true);
    scheduleAutoSave();
  }
  function toggleVisible(id: string) {
    setBlocks(prev => prev.map(b => b.id === id ? { ...b, visible: !b.visible } : b));
    setDirty(true);
    scheduleAutoSave();
  }
  function moveBlock(index: number, dir: -1 | 1) {
    setBlocks(prev => {
      const next = [...prev];
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
    setDirty(true);
    scheduleAutoSave();
  }
  function deleteBlock(id: string) {
    setBlocks(prev => prev.filter(b => b.id !== id));
    setDirty(true);
    scheduleAutoSave();
  }
  function addBlock(type: BrandBlockType) {
    const defaults: Record<BrandBlockType, any> = {
      intro: {}, specialties: { items: [] }, career: { items: [] },
      sns: { instagram: "", youtube: "", kakao: "" },
      booking: { enabled: true, message: "" },
      programs: { items: [] }, video: { youtubeUrl: "", description: "" },
      testimonials: { items: [] },
    };
    setBlocks(prev => [...prev, { id: `${type}_${Date.now()}`, type, visible: true, data: defaults[type] }]);
    setDirty(true);
    scheduleAutoSave();
  }

  function buildLegacyFields(blockList: BrandBlock[]) {
    return buildLegacyFieldsStatic(blockList);
  }

  function handleSave() {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    const legacy = buildLegacyFields(blocks);
    updateMutation.mutate({
      ...legacy,
      brandIsPublic,
      brandBlocks: JSON.stringify(blocks),
    } as any);
    setDirty(false);
  }

  if (isLoading) return <p className="text-sm text-muted-foreground text-center py-4">로딩 중...</p>;

  // bookingOnly 모드: 수업 예약 기능 탭에서 사용
  if (bookingOnly) {
    const bkBlock = blocks.find(b => b.type === "booking") ?? { id: "booking", type: "booking" as const, visible: true, data: { enabled: brand?.bookingEnabled === 1, message: brand?.bookingMessage ?? "" } };
    return (
      <div className="space-y-5">
        <BlockEditor block={bkBlock} onChange={data => {
          setBlocks(prev => prev.some(b => b.type === "booking")
            ? prev.map(b => b.type === "booking" ? { ...b, data } : b)
            : [...prev, { ...bkBlock, data }]
          );
          setDirty(true);
        }} />
        <Button size="sm" className="w-full" disabled={updateMutation.isPending} onClick={handleSave}>
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

  return (
    <div className="space-y-4 relative">
      {/* ── 상단: 공개 상태 + 링크 + 미리보기 ── */}
      <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold">브랜드 페이지 공개</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">/p/{trainerId}</p>
          </div>
          <div className="flex items-center gap-2">
            {/* 미리보기 버튼 */}
            <button
              onClick={() => {
                if (dirty) { toast("저장 후 미리보기를 확인하세요", { icon: "💡" }); return; }
                if (brandIsPublic) {
                  window.open(brandUrl, "_blank");
                } else {
                  toast("공개로 설정하고 저장하면 미리보기 가능합니다", { icon: "🔒" });
                }
              }}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-muted hover:bg-accent transition-colors text-muted-foreground hover:text-foreground">
              <Eye className="h-3.5 w-3.5" />
              미리보기
            </button>
            {/* 공개 토글 */}
            <button onClick={() => { setBrandIsPublic(p => p ? 0 : 1); setDirty(true); }}
              className={`w-12 h-6 rounded-full transition-colors relative ${brandIsPublic ? "bg-primary" : "bg-muted"}`}>
              <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${brandIsPublic ? "left-6" : "left-0.5"}`} />
            </button>
          </div>
        </div>
        {brandIsPublic ? (
          <>
            <button onClick={() => { navigator.clipboard.writeText(brandUrl); toast.success("링크 복사됨!"); }}
              className="w-full flex items-center gap-2 px-3 py-2.5 bg-primary/10 border border-primary/20 rounded-xl text-xs text-primary">
              <Globe className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate flex-1">{brandUrl}</span>
              <Copy className="h-3.5 w-3.5 shrink-0" />
            </button>
          </>
        ) : (
          <p className="text-[11px] text-muted-foreground">공개로 설정하면 외부에서 접속할 수 있는 링크가 생성됩니다.</p>
        )}
      </div>

      {/* ── 저장 버튼 ── */}
      <Button className="w-full" onClick={handleSave} disabled={!dirty || updateMutation.isPending}>
        {updateMutation.isPending ? "저장 중..." : dirty ? "변경사항 저장" : "저장됨"}
      </Button>

      {/* ── 블록 섹션 헤더 ── */}
      <div className="flex items-center gap-2">
        <Layers className="h-4 w-4 text-muted-foreground" />
        <p className="text-sm font-bold">페이지 구성</p>
        <span className="text-[10px] text-muted-foreground ml-auto">{blocks.filter(b => b.visible).length}개 표시 중</span>
      </div>

      {/* ── 블록 리스트 ── */}
      <div className="space-y-2">
        {blocks.map((block, i) => (
          <BlockCard
            key={block.id}
            block={block}
            index={i}
            total={blocks.length}
            onToggleVisible={() => toggleVisible(block.id)}
            onMoveUp={() => moveBlock(i, -1)}
            onMoveDown={() => moveBlock(i, 1)}
            onDelete={() => deleteBlock(block.id)}
            onUpdate={data => updateBlock(block.id, data)}
          />
        ))}
      </div>

      {/* ── 블록 추가 버튼 ── */}
      <button onClick={() => setShowAddBlock(true)}
        className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-border rounded-2xl text-sm font-semibold text-muted-foreground hover:border-primary hover:text-primary transition-colors">
        <Plus className="h-4 w-4" />
        블록 추가
      </button>

      {showAddBlock && (
        <AddBlockSheet
          existingTypes={blocks.map(b => b.type)}
          onAdd={addBlock}
          onClose={() => setShowAddBlock(false)}
        />
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
              <span className="text-xs font-bold text-muted-foreground">{(brand as any)?.trainerName?.[0] ?? "T"}</span>
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

// ── 플랜 tier 매핑 ────────────────────────────────────────────────────────────
const TIER_ITEMS: Record<"free" | "pro" | "elite", string[]> = {
  free:  ["brand_page", "contract_kakao", "survey", "templates", "refund_contract", "transfer_contract"],
  pro:   ["fitstep_plus", "fitstep_videos", "fitstep_rec", "fitstep_diet", "fitstep_personal",
          "booking", "report_branding", "contract_terms", "training_video", "e_contract"],
  elite: ["member_overview", "activity_stats", "data_migration", "kpi_report",
          "consult_conversion", "unpaid", "monthly_pnl", "sales_analysis",
          "channel_analysis", "marketing_analysis", "renewal_analysis", "ai_insights"],
};

const TIER_META = {
  free: {
    label: "FREE", limit: "최대 15명",
    desc: "무료로 시작하는 기본 관리 도구",
    headerCls: "bg-emerald-50 border-emerald-200 dark:bg-emerald-500/10 dark:border-emerald-500/20",
    badgeCls: "bg-emerald-500 text-white",
    baseFeatures: ["회원관리", "출석 체크", "수업 관리", "상담실", "건강보고서"],
  },
  pro: {
    label: "PRO", limit: "최대 30명",
    desc: "전문가 이미지 + 회원 경험 강화",
    headerCls: "bg-blue-50 border-blue-200 dark:bg-blue-500/10 dark:border-blue-500/20",
    badgeCls: "bg-blue-500 text-white",
    baseFeatures: null,
  },
  elite: {
    label: "ELITE", limit: "최대 50명",
    desc: "사업 성장을 위한 분석 & 자동화",
    headerCls: "bg-amber-50 border-amber-200 dark:bg-amber-500/10 dark:border-amber-500/20",
    badgeCls: "bg-amber-500 text-white",
    baseFeatures: null,
  },
} as const;

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
        description: "상담실에서 작성·서명한 계약서를 카카오톡으로 회원에게 바로 전달하세요. 회원이 언제든 계약 내용을 다시 확인할 수 있습니다.",
        tags: ["카카오톡 공유", "계약서 링크", "빠른 전달"],
        useCases: ["비대면 계약 체결", "원격 회원 등록", "계약 프로세스 간소화"] },
      { id: "e_contract", icon: FileSignature, name: "비대면 전자계약", shortDesc: "원격 전자계약 및 비대면 등록", status: "active",
        description: "회원이 직접 방문하지 않아도 온라인에서 계약서 확인과 전자 서명을 완료할 수 있습니다. 비대면 회원 등록을 자동화하세요.",
        tags: ["전자계약", "비대면 등록", "온라인 서명"],
        useCases: ["원격 회원 등록", "비대면 계약 체결", "계약 자동화"] },
      { id: "refund_contract", icon: ReceiptText, name: "환불 계약서", shortDesc: "환불 조건 확인 및 전자서명", status: "active",
        description: "환불 금액, 수강 횟수, 환불 사유를 정리해 회원에게 링크로 전송합니다. 회원이 내용을 확인하고 전자서명하면 환불 계약이 완료됩니다.",
        tags: ["환불 전자계약", "환불 확인서", "온라인 서명"],
        useCases: ["환불 처리 자동화", "환불 증빙 확보", "비대면 환불 동의"] },
      { id: "transfer_contract", icon: ArrowLeftRight, name: "양도양수계약서", shortDesc: "PT 이용권 양도양수 전자계약", status: "active",
        description: "잔여 PT 이용권을 다른 사람에게 양도할 때 사용하는 전자계약서입니다. 양도인·양수인 정보와 잔여 횟수를 기록하고 양수인의 전자서명을 받습니다.",
        tags: ["양도양수", "이용권 양도", "전자계약"],
        useCases: ["PT 이용권 양도 처리", "양도 증빙 확보", "비대면 양도 동의"] },
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
      case "fitstep_plus":      return isAdmin ? <AdminFspLimitsPanel /> : trainerId ? <FitStepPlusPanel trainerId={trainerId} /> : null;
      case "fitstep_personal":  return <WorkoutLogSection />;
      case "booking":           return <BookingFeaturePanel />;
      case "report_branding": return <ReportBrandingEditor />;
      case "templates":     return <WorkoutTemplateEditor />;
      case "survey":        return <SurveyBuilder />;
      case "contract_terms": return <ContractTermsEditor />;
      case "e_contract":        return <EContractManager />;
      case "contract_kakao":    return <EContractManager />;
      case "refund_contract":   return <RefundContractManager />;
      case "transfer_contract": return <TransferContractManager />;
      default:                  return null;
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative bg-card rounded-t-3xl w-full max-h-modal overflow-y-auto shadow-2xl pb-safe">
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
  const FIcon = feature.icon;
  const [showTestUI, setShowTestUI] = useState(false);
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const updateStatusMutation = trpc.admin.updateWorkshopFeatureConfig.useMutation({
    onSuccess: () => { utils.admin.getWorkshopConsole.invalidate(); toast.success("상태가 변경되었습니다."); },
    onError: () => toast.error("상태 변경 실패"),
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
      <div className="relative bg-card rounded-t-3xl w-full max-h-modal overflow-y-auto shadow-2xl">
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

          {/* 상태 변경 */}
          <div className="pt-2 border-t border-border space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">기능 상태 변경</p>
            <div className="flex gap-2">
              {(["active", "coming_soon"] as const).map(s => {
                const meta = { active: { label: "활성", cls: "bg-green-600 text-white" }, coming_soon: { label: "준비 중", cls: "bg-muted text-muted-foreground border border-border" } }[s];
                const isCurrent = feature.status === s;
                return (
                  <button key={s} disabled={isCurrent || updateStatusMutation.isPending}
                    onClick={() => updateStatusMutation.mutate({ featureId: feature.id, status: s })}
                    className={`flex-1 text-xs font-semibold py-2 rounded-xl transition-all ${isCurrent ? (s === "active" ? "bg-green-100 text-green-700 ring-2 ring-green-400" : "bg-muted text-muted-foreground ring-2 ring-border") : (s === "active" ? "bg-muted/60 text-foreground/60 hover:bg-green-50 hover:text-green-700" : "bg-muted/40 text-foreground/50 hover:bg-muted")}`}>
                    {isCurrent ? `✓ ${meta.label}` : meta.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 전용 설정 페이지 링크 */}
          {(["fitstep_plus", "brand_page", "booking", "report_branding", "templates", "survey", "contract_terms"] as const).includes(feature.id as any) && (() => {
            const pageMap: Record<string, { path: string; label: string }> = {
              fitstep_plus:    { path: "/admin/fit-step-plus",  label: "FIT STEP+ 전용 설정 페이지" },
              brand_page:      { path: "/workshop",             label: "브랜드 페이지 편집기" },
              booking:         { path: "/workshop",             label: "예약 설정 편집기" },
              report_branding: { path: "/workshop",             label: "보고서 브랜딩 설정" },
              templates:       { path: "/workshop",             label: "운동 템플릿 관리" },
              survey:          { path: "/workshop",             label: "설문 빌더" },
              contract_terms:  { path: "/workshop",             label: "계약서 약관 설정" },
            };
            const pg = pageMap[feature.id];
            if (!pg) return null;
            return (
              <button onClick={() => { onClose(); navigate(pg.path); }}
                className="w-full flex items-center justify-between bg-primary/5 border border-primary/20 rounded-xl px-4 py-3 hover:bg-primary/10 transition-colors">
                <span className="text-xs font-semibold text-primary">{pg.label}</span>
                <ExternalLink className="h-3.5 w-3.5 text-primary" />
              </button>
            );
          })()}

          {/* 기능 직접 테스트 — 어드민은 상태 무관하게 항상 테스트 가능 */}
          <div className="pt-2 border-t border-border space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">기능 직접 테스트</p>
                {feature.status !== "active" && (
                  <p className="text-[10px] text-amber-600 mt-0.5">준비 중 상태 · 어드민만 테스트 가능</p>
                )}
              </div>
              <button
                onClick={() => setShowTestUI(v => !v)}
                className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
                  showTestUI
                    ? "bg-primary/10 text-primary"
                    : "bg-primary text-primary-foreground hover:bg-primary/90"
                }`}
              >
                <Eye className="h-3.5 w-3.5" />
                {showTestUI ? "닫기" : "기능 열어보기"}
              </button>
            </div>
            {!showTestUI ? (
              <p className="text-xs text-muted-foreground">실제 기능 UI를 관리자 화면에서 바로 확인할 수 있습니다.</p>
            ) : (
              <div className="border border-border rounded-2xl overflow-hidden bg-background">
                <div className="px-4 py-2.5 bg-muted/40 border-b border-border flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-400" />
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">라이브 미리보기</span>
                </div>
                <div className="p-4">
                  {feature.id === "brand_page"        && <BrandPageEditor />}
                  {feature.id === "fitstep_plus"      && <AdminFspLimitsPanel />}
                  {feature.id === "fitstep_personal"  && <WorkoutLogSection />}
                  {feature.id === "booking"           && <BookingFeaturePanel />}
                  {feature.id === "report_branding"   && <ReportBrandingEditor />}
                  {feature.id === "templates"         && <WorkoutTemplateEditor />}
                  {feature.id === "survey"            && <SurveyBuilder />}
                  {feature.id === "contract_terms"    && <ContractTermsEditor />}
                  {feature.id === "e_contract"         && <EContractManager />}
                  {feature.id === "contract_kakao"    && <EContractManager />}
                  {feature.id === "refund_contract"        && <RefundContractManager />}
                  {feature.id === "transfer_contract"      && <TransferContractManager />}
                  {feature.id === "unpaid"                 && <UnpaidManager />}
                  {feature.id === "consult_conversion"     && <ConsultConversionPreview />}
                  {feature.id === "member_overview"        && <MemberOverviewPreview />}
                  {feature.id === "activity_stats"         && <ActivityStatsPreview />}
                  {feature.id === "monthly_pnl"            && <MonthlyPnlPreview />}
                  {feature.id === "sales_analysis"         && <SalesAnalysisPreview />}
                  {feature.id === "renewal_analysis"       && <RenewalAnalysisPreview />}
                  {feature.id === "channel_analysis"       && <ChannelAnalysisPreview />}
                  {feature.id === "marketing_analysis"     && <MarketingAnalysisPreview />}
                  {feature.id === "kpi_report"             && <KpiReportPreview />}
                  {feature.id === "fitstep_videos"         && <VideoSection trainerId={0} />}
                  {feature.id === "ai_insights"            && <ComingSoonPreview title="AI 운영 인사이트" desc="운영 데이터를 AI가 분석해 개선 포인트를 제안합니다. 준비 중입니다." />}
                  {feature.id === "data_migration"         && <ComingSoonPreview title="데이터 이전" desc="기존 센터 데이터를 업로드해 간편하게 이전할 수 있습니다. 준비 중입니다." />}
                  {feature.id === "training_video"         && <ComingSoonPreview title="트레이닝 일지 + 영상 연결" desc="회원별 운동 일지에 영상을 직접 연결해 피드백을 제공합니다. 준비 중입니다." />}
                  {feature.id === "fitstep_rec"            && <ComingSoonPreview title="맞춤 운동 추천" desc="회원의 목표와 상태를 기반으로 개인화된 운동을 추천합니다. 준비 중입니다." />}
                  {feature.id === "fitstep_diet"           && <TrainerDietManager />}
                </div>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}

function UnpaidManager() {
  const { data: list = [], isLoading } = trpc.members.getWithUnpaid.useQuery();
  const total = list.reduce((s: number, m: any) => s + (m.unpaidAmount ?? 0), 0);

  if (isLoading) return <p className="text-sm text-muted-foreground text-center py-4">로딩 중...</p>;
  if (list.length === 0) return (
    <div className="text-center py-8 space-y-1">
      <p className="text-sm font-semibold text-muted-foreground">미수금 회원이 없습니다</p>
      <p className="text-xs text-muted-foreground">모든 회원의 결제가 완료되었습니다.</p>
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between bg-orange-50 dark:bg-orange-500/10 border border-orange-200 dark:border-orange-500/20 rounded-xl px-4 py-3">
        <div>
          <p className="text-xs font-semibold text-orange-700 dark:text-orange-400">총 미수금</p>
          <p className="text-lg font-black text-orange-600 dark:text-orange-400">{total.toLocaleString()}원</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-orange-600 dark:text-orange-400">{list.length}명</p>
        </div>
      </div>
      <div className="space-y-2">
        {list.map((m: any) => (
          <div key={m.id} className="flex items-center justify-between bg-background border border-border rounded-xl px-3 py-2.5">
            <div>
              <p className="text-sm font-semibold">{m.name}</p>
              <p className="text-[11px] text-muted-foreground">{m.packageName}</p>
            </div>
            <span className="text-sm font-bold text-orange-500">{(m.unpaidAmount ?? 0).toLocaleString()}원</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── ELITE/ADD-ON 기능 미리보기 컴포넌트들 ────────────────────────────────────

function ConsultConversionPreview() {
  const { data: leadList = [] } = trpc.leads.list.useQuery();
  const total = leadList.length;
  const registered = leadList.filter((l: any) => l.status === "registered").length;
  const rate = total > 0 ? Math.round((registered / total) * 100) : 0;
  const statCls = "bg-background border border-border rounded-xl p-3 text-center";
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        <div className={statCls}><p className="text-xl font-black">{total}</p><p className="text-[10px] text-muted-foreground mt-0.5">총 상담</p></div>
        <div className={statCls}><p className="text-xl font-black text-green-600">{registered}</p><p className="text-[10px] text-muted-foreground mt-0.5">등록 완료</p></div>
        <div className={statCls}><p className="text-xl font-black text-primary">{rate}%</p><p className="text-[10px] text-muted-foreground mt-0.5">전환율</p></div>
      </div>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-muted-foreground">전환율</span>
          <span className="font-bold text-primary">{rate}%</span>
        </div>
        <div className="w-full bg-muted rounded-full h-2.5">
          <div className="h-2.5 rounded-full bg-primary transition-all" style={{ width: `${rate}%` }} />
        </div>
      </div>
      {[
        { label: "대기 중", status: "pending", cls: "bg-yellow-100 text-yellow-700" },
        { label: "상담 완료", status: "consulted", cls: "bg-blue-100 text-blue-700" },
        { label: "등록 완료", status: "registered", cls: "bg-green-100 text-green-700" },
        { label: "미등록", status: "not_registered", cls: "bg-muted text-muted-foreground" },
      ].map(({ label, status, cls }) => {
        const cnt = leadList.filter((l: any) => l.status === status).length;
        return (
          <div key={status} className="flex items-center justify-between">
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${cls}`}>{label}</span>
            <span className="text-sm font-bold">{cnt}명</span>
          </div>
        );
      })}
    </div>
  );
}

function MemberOverviewPreview() {
  const { data: memberList = [] } = trpc.members.list.useQuery();
  const { data: stats } = trpc.trainers.getMyStats.useQuery();
  const active = memberList.filter((m: any) => m.status === "active").length;
  const paused = memberList.filter((m: any) => m.status === "paused").length;
  const total = memberList.length;
  const statCls = "bg-background border border-border rounded-xl p-3 text-center";
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <div className={statCls}><p className="text-xl font-black">{total}</p><p className="text-[10px] text-muted-foreground mt-0.5">전체 회원</p></div>
        <div className={statCls}><p className="text-xl font-black text-green-600">{active}</p><p className="text-[10px] text-muted-foreground mt-0.5">활성</p></div>
        <div className={statCls}><p className="text-xl font-black text-muted-foreground">{paused}</p><p className="text-[10px] text-muted-foreground mt-0.5">일시정지</p></div>
      </div>
      {stats && (
        <div className="grid grid-cols-2 gap-2">
          <div className={statCls}><p className="text-lg font-black">{stats.totalSessions}</p><p className="text-[10px] text-muted-foreground mt-0.5">누적 수업</p></div>
          <div className={statCls}><p className="text-lg font-black text-orange-500">{stats.reregRate}%</p><p className="text-[10px] text-muted-foreground mt-0.5">재등록률</p></div>
        </div>
      )}
    </div>
  );
}

function ActivityStatsPreview() {
  const { data: chartData = [] } = trpc.dashboard.getMonthlyChart.useQuery();
  const maxAtt = Math.max(1, ...chartData.map((d: any) => d["출석"] ?? 0));
  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold text-muted-foreground">최근 6개월 출석 현황</p>
      <div className="flex items-end gap-1.5 h-20">
        {chartData.map((d: any) => {
          const h = Math.round(((d["출석"] ?? 0) / maxAtt) * 100);
          return (
            <div key={d.month} className="flex-1 flex flex-col items-center gap-1">
              <div className="w-full rounded-t-sm bg-primary transition-all" style={{ height: `${h}%`, minHeight: d["출석"] > 0 ? "4px" : "0" }} />
              <span className="text-[9px] text-muted-foreground">{d.month}</span>
            </div>
          );
        })}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {chartData.slice(-1).map((d: any) => (
          <div key="last" className="contents">
            <div className="bg-background border border-border rounded-xl p-3 text-center">
              <p className="text-lg font-black text-green-600">{d["신규회원"]}</p>
              <p className="text-[10px] text-muted-foreground">이번 달 신규</p>
            </div>
            <div className="bg-background border border-border rounded-xl p-3 text-center">
              <p className="text-lg font-black text-blue-600">{d["재등록"]}</p>
              <p className="text-[10px] text-muted-foreground">이번 달 재등록</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MonthlyPnlPreview() {
  const { data: revenueData = [] } = trpc.dashboard.getMonthlyRevenue.useQuery();
  const maxRev = Math.max(1, ...revenueData.map((d: any) => d["매출"] ?? 0));
  const thisMonth = revenueData[revenueData.length - 1];
  return (
    <div className="space-y-3">
      {thisMonth && (
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-background border border-border rounded-xl p-3 text-center">
            <p className="text-base font-black">{((thisMonth["매출"] ?? 0) / 10000).toFixed(0)}만원</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">이번 달 매출</p>
          </div>
          <div className="bg-background border border-border rounded-xl p-3 text-center">
            <p className="text-base font-black text-green-600">{((thisMonth["정산"] ?? 0) / 10000).toFixed(0)}만원</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">이번 달 정산</p>
          </div>
        </div>
      )}
      <p className="text-xs font-semibold text-muted-foreground">최근 6개월 매출</p>
      <div className="flex items-end gap-1.5 h-16">
        {revenueData.map((d: any) => {
          const h = Math.round(((d["매출"] ?? 0) / maxRev) * 100);
          return (
            <div key={d.month} className="flex-1 flex flex-col items-center gap-1">
              <div className="w-full rounded-t-sm bg-green-400 transition-all" style={{ height: `${h}%`, minHeight: d["매출"] > 0 ? "4px" : "0" }} />
              <span className="text-[9px] text-muted-foreground">{d.month}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SalesAnalysisPreview() {
  return <MonthlyPnlPreview />;
}

function RenewalAnalysisPreview() {
  const { data: chartData = [] } = trpc.dashboard.getMonthlyChart.useQuery();
  const { data: stats } = trpc.trainers.getMyStats.useQuery();
  const maxVal = Math.max(1, ...chartData.flatMap((d: any) => [d["신규회원"] ?? 0, d["재등록"] ?? 0]));
  return (
    <div className="space-y-3">
      {stats && (
        <div className="bg-background border border-border rounded-xl p-3 text-center">
          <p className="text-2xl font-black text-primary">{stats.reregRate}%</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">재등록률</p>
        </div>
      )}
      <p className="text-xs font-semibold text-muted-foreground">신규 vs 재등록</p>
      <div className="space-y-2">
        {chartData.slice(-3).map((d: any) => (
          <div key={d.month} className="space-y-1">
            <p className="text-[10px] text-muted-foreground">{d.month}</p>
            <div className="flex gap-1 h-3">
              <div className="bg-primary rounded-full transition-all" style={{ width: `${Math.round((d["신규회원"] / maxVal) * 100)}%` }} />
              <div className="bg-blue-400 rounded-full transition-all" style={{ width: `${Math.round((d["재등록"] / maxVal) * 100)}%` }} />
            </div>
            <div className="flex gap-3 text-[9px] text-muted-foreground">
              <span>● 신규 {d["신규회원"]}</span><span>● 재등록 {d["재등록"]}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ChannelAnalysisPreview() {
  const { data: leadList = [] } = trpc.leads.list.useQuery();
  const byChannel: Record<string, number> = {};
  for (const l of leadList as any[]) {
    const name = l.channelName ?? "직접 입력";
    byChannel[name] = (byChannel[name] ?? 0) + 1;
  }
  const sorted = Object.entries(byChannel).sort((a, b) => b[1] - a[1]);
  const total = leadList.length;
  return (
    <div className="space-y-3">
      <div className="bg-background border border-border rounded-xl p-3 text-center">
        <p className="text-2xl font-black">{total}</p>
        <p className="text-[10px] text-muted-foreground mt-0.5">총 유입 상담</p>
      </div>
      {sorted.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-2">유입 데이터가 없습니다</p>
      ) : (
        <div className="space-y-2">
          {sorted.map(([name, cnt]) => (
            <div key={name} className="space-y-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-medium">{name}</span>
                <span className="font-bold">{cnt}명 ({total > 0 ? Math.round((cnt / total) * 100) : 0}%)</span>
              </div>
              <div className="w-full bg-muted rounded-full h-1.5">
                <div className="h-1.5 rounded-full bg-primary transition-all" style={{ width: `${total > 0 ? (cnt / total) * 100 : 0}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function KpiReportPreview() {
  const { data: stats } = trpc.trainers.getMyStats.useQuery();
  if (!stats) return <p className="text-sm text-muted-foreground text-center py-4">로딩 중...</p>;
  const kpis = [
    { label: "전체 회원", value: stats.totalMembers, unit: "명", cls: "text-primary" },
    { label: "누적 수업", value: stats.totalSessions, unit: "회", cls: "text-blue-600" },
    { label: "재등록률", value: stats.reregRate, unit: "%", cls: "text-green-600" },
    { label: "월평균 신규", value: stats.avgMonthlyNewMembers, unit: "명", cls: "text-orange-500" },
    { label: "노쇼 횟수", value: stats.totalNoShow, unit: "회", cls: "text-red-500" },
    { label: "잔여 PT", value: stats.remainingPt, unit: "회", cls: "text-muted-foreground" },
  ];
  return (
    <div className="grid grid-cols-2 gap-2">
      {kpis.map(({ label, value, unit, cls }) => (
        <div key={label} className="bg-background border border-border rounded-xl p-3 text-center">
          <p className={`text-xl font-black ${cls}`}>{value}{unit}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">{label}</p>
        </div>
      ))}
    </div>
  );
}

function MarketingAnalysisPreview() {
  return <ChannelAnalysisPreview />;
}

// 구글 시트에서 실시간으로 식품 DB를 가져옴 (브라우저 fetch)
const FOOD_SHEET_CSV = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRk0OlJXvZha8RRaMK4OXQ-C2OWhhmPVHxLbxiUnPZZfy64fd8muHWuz_QbhNXjLDkqscnrbRQ-AzME/pub?gid=287813752&single=true&output=csv";

type MealOption = { mealType: string; name: string; amount: string; kcal: number; carb: number; prot: number; fat: number };
type DietResult = { tdee: number; goalLabel: string; meals: { mealType: string; picked: MealOption; alt: MealOption[] }[] };

function parseFoodCSV(csvText: string): MealOption[] {
  const MEAL_TYPES = new Set(["아침", "점심", "저녁", "간식"]);
  const options: MealOption[] = [];
  const rows = csvText.split("\n");
  for (let i = 4; i < rows.length; i++) {
    const cols: string[] = [];
    let inQ = false, cur = "";
    for (const ch of rows[i]) {
      if (ch === '"') inQ = !inQ;
      else if (ch === "," && !inQ) { cols.push(cur.trim()); cur = ""; }
      else cur += ch;
    }
    cols.push(cur.trim());
    const cat = cols[0] ?? "";
    const name = cols[1] ?? "";
    if (!MEAL_TYPES.has(cat) || !name) continue;
    const kcal = parseFloat(cols[3]) || 0;
    if (kcal === 0) continue;
    options.push({ mealType: cat, name, amount: cols[2] ?? "", kcal, carb: parseFloat(cols[4]) || 0, prot: parseFloat(cols[5]) || 0, fat: parseFloat(cols[6]) || 0 });
  }
  return options;
}

function calcTdee(gender: string, kg: number, cm: number, age: number, activity: string) {
  const bmr = gender === "female" ? 10 * kg + 6.25 * cm - 5 * age - 161 : 10 * kg + 6.25 * cm - 5 * age + 5;
  const af: Record<string, number> = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725 };
  return Math.round(bmr * (af[activity] ?? 1.375));
}

function buildDietPlan(options: MealOption[], tdee: number, goal: string): DietResult {
  const targetKcal = goal === "loss" ? Math.round(tdee * 0.8) : goal === "gain" ? Math.round(tdee * 1.1) : tdee;
  const ratios: Record<string, number> = { 아침: 0.25, 점심: 0.35, 저녁: 0.30, 간식: 0.10 };
  const meals = ["아침", "점심", "저녁", "간식"].map(mealType => {
    const pool = options.filter(o => o.mealType === mealType);
    const target = targetKcal * (ratios[mealType] ?? 0.25);
    const sorted = [...pool].sort((a, b) => Math.abs(a.kcal - target) - Math.abs(b.kcal - target));
    return { mealType, picked: sorted[0], alt: sorted.slice(1, 5) };
  }).filter(m => m.picked);
  const goalLabel = goal === "loss" ? "체중 감량" : goal === "gain" ? "근육 증량" : "체중 유지";
  return { tdee: targetKcal, goalLabel, meals };
}

function TrainerDietManager() {
  const { data: memberList = [] } = trpc.members.list.useQuery();
  const [selectedMemberId, setSelectedMemberId] = useState<number | null>(null);
  const [goal, setGoal] = useState<"loss" | "maintain" | "gain">("maintain");
  const [activity, setActivity] = useState("light");
  const [plan, setPlan] = useState<DietResult | null>(null);
  const [foodOptions, setFoodOptions] = useState<MealOption[]>([]);
  const [sheetLoading, setSheetLoading] = useState(false);
  const [sheetError, setSheetError] = useState(false);
  const [altIdx, setAltIdx] = useState<Record<string, number>>({});

  useEffect(() => {
    setSheetLoading(true);
    fetch(FOOD_SHEET_CSV)
      .then(r => { if (!r.ok) throw new Error(); return r.text(); })
      .then(text => { setFoodOptions(parseFoodCSV(text)); setSheetLoading(false); })
      .catch(() => { setSheetError(true); setSheetLoading(false); });
  }, []);

  const selectedMember = (memberList as any[]).find((m: any) => m.id === selectedMemberId);
  const { data: parQData } = trpc.parQ.get.useQuery({ memberId: selectedMemberId! }, { enabled: !!selectedMemberId });

  const heightCm = parseFloat(parQData?.height ?? "0");
  const weightKg = parseFloat(parQData?.weight ?? "0");
  const gender = selectedMember?.gender ?? "male";
  const birthDate = selectedMember?.birthDate ?? "";
  const ageYears = birthDate ? new Date().getFullYear() - parseInt(birthDate.slice(0, 4)) : 30;
  const hasBodyData = heightCm > 0 && weightKg > 0;

  function handleGenerate() {
    if (!hasBodyData || foodOptions.length === 0) return;
    setPlan(buildDietPlan(foodOptions, calcTdee(gender, weightKg, heightCm, ageYears, activity), goal));
    setAltIdx({});
  }

  function shuffleMeal(mealType: string) {
    if (!plan) return;
    const meal = plan.meals.find(m => m.mealType === mealType);
    if (!meal || meal.alt.length === 0) return;
    setAltIdx(prev => ({ ...prev, [mealType]: ((prev[mealType] ?? -1) + 1) % meal.alt.length }));
  }

  function getItem(meal: DietResult["meals"][0]) {
    const idx = altIdx[meal.mealType];
    return idx !== undefined ? meal.alt[idx] : meal.picked;
  }

  const totalKcal = plan?.meals.reduce((s, m) => s + getItem(m).kcal, 0) ?? 0;
  const totalCarb = plan?.meals.reduce((s, m) => s + getItem(m).carb, 0) ?? 0;
  const totalProt = plan?.meals.reduce((s, m) => s + getItem(m).prot, 0) ?? 0;
  const totalFat  = plan?.meals.reduce((s, m) => s + getItem(m).fat,  0) ?? 0;

  if (sheetLoading) return (
    <div className="text-center py-10">
      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
      <p className="text-xs text-muted-foreground">식품 DB 불러오는 중...</p>
    </div>
  );
  if (sheetError) return (
    <div className="text-center py-6 space-y-1">
      <p className="text-sm text-red-400 font-semibold">식품 DB를 불러오지 못했습니다.</p>
      <p className="text-xs text-muted-foreground">구글 시트 웹 게시 설정을 확인해주세요.</p>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* 회원 선택 */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground mb-1.5">회원 선택</p>
        <select
          value={selectedMemberId ?? ""}
          onChange={e => { setSelectedMemberId(Number(e.target.value) || null); setPlan(null); }}
          className="w-full border border-border rounded-xl px-3 py-2.5 text-sm bg-background"
        >
          <option value="">-- 회원을 선택하세요 --</option>
          {(memberList as any[]).map((m: any) => (
            <option key={m.id} value={m.id}>{m.name}{m.gender === "female" ? " (여)" : m.gender === "male" ? " (남)" : ""}</option>
          ))}
        </select>
      </div>

      {/* 신체 정보 */}
      {selectedMemberId && (
        <div className={`rounded-xl border px-4 py-3 text-sm ${hasBodyData ? "border-border bg-card" : "border-amber-500/30 bg-amber-50/30"}`}>
          {hasBodyData ? (
            <>
              <p className="font-semibold text-xs text-muted-foreground mb-2">신체 정보 (PAR-Q)</p>
              <div className="grid grid-cols-3 gap-2 text-center">
                {[["키", `${heightCm}cm`], ["몸무게", `${weightKg}kg`], ["나이", `${ageYears}세`]].map(([label, val]) => (
                  <div key={label} className="bg-primary/5 rounded-lg py-2">
                    <p className="text-[10px] text-muted-foreground">{label}</p>
                    <p className="font-bold text-sm">{val}</p>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-xs text-amber-700">PAR-Q에 키/몸무게가 없습니다. PAR-Q를 먼저 작성해주세요.</p>
          )}
        </div>
      )}

      {/* 목표 / 활동량 선택 */}
      {selectedMemberId && hasBodyData && (
        <>
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-1.5">식단 목표</p>
            <div className="grid grid-cols-3 gap-2">
              {([["loss", "체중 감량", "🔥"], ["maintain", "체중 유지", "⚖️"], ["gain", "근육 증량", "💪"]] as const).map(([v, label, emoji]) => (
                <button key={v} onClick={() => { setGoal(v); setPlan(null); }}
                  className={`py-2.5 rounded-xl border text-xs font-semibold transition-colors ${goal === v ? "border-primary bg-primary/10 text-primary" : "border-border bg-card"}`}>
                  {emoji} {label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-1.5">활동량</p>
            <div className="grid grid-cols-2 gap-2">
              {([["sedentary", "거의 없음"], ["light", "가벼운 활동"], ["moderate", "보통 활동"], ["active", "활발한 활동"]] as const).map(([v, label]) => (
                <button key={v} onClick={() => { setActivity(v); setPlan(null); }}
                  className={`py-2 rounded-xl border text-xs font-medium transition-colors ${activity === v ? "border-primary bg-primary/10 text-primary" : "border-border bg-card"}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          <button onClick={handleGenerate}
            className="w-full py-3 rounded-2xl bg-primary text-primary-foreground font-bold text-sm flex items-center justify-center gap-2">
            <Sparkles className="h-4 w-4" />
            맞춤 식단 생성 ({foodOptions.length}개 메뉴 DB)
          </button>
        </>
      )}

      {/* 식단 결과 */}
      {plan && (
        <div className="space-y-3">
          <div className="bg-card border border-border rounded-2xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <p className="font-bold text-sm">{selectedMember?.name}님 맞춤 식단</p>
              <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">{plan.goalLabel}</span>
            </div>
            <p className="text-xs text-muted-foreground">목표 <span className="font-bold text-foreground">{plan.tdee.toLocaleString()} kcal</span></p>
            <div className="grid grid-cols-4 gap-1.5 pt-1">
              {[["총 칼로리", `${totalKcal}kcal`, "text-orange-500"], ["탄수화물", `${totalCarb}g`, "text-amber-500"], ["단백질", `${totalProt}g`, "text-blue-500"], ["지방", `${totalFat}g`, "text-green-500"]].map(([label, val, cls]) => (
                <div key={label} className="bg-muted/40 rounded-xl py-2 text-center">
                  <p className="text-[9px] text-muted-foreground">{label}</p>
                  <p className={`text-xs font-bold ${cls}`}>{val}</p>
                </div>
              ))}
            </div>
          </div>

          {plan.meals.map(meal => {
            const item = getItem(meal);
            return (
              <div key={meal.mealType} className="border border-border rounded-2xl overflow-hidden">
                <div className="bg-muted/30 px-4 py-2.5 flex items-center justify-between">
                  <p className="text-sm font-bold">{meal.mealType}</p>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{item.kcal} kcal</span>
                    {meal.alt.length > 0 && (
                      <button onClick={() => shuffleMeal(meal.mealType)} title="다른 메뉴"
                        className="text-muted-foreground hover:text-primary transition-colors">
                        <ArrowLeftRight className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
                <div className="px-4 py-3">
                  <p className="text-sm font-semibold">{item.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{item.amount}</p>
                  <div className="flex gap-3 mt-2 text-[11px]">
                    <span className="text-amber-500">탄 {item.carb}g</span>
                    <span className="text-blue-500">단 {item.prot}g</span>
                    <span className="text-green-500">지 {item.fat}g</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ComingSoonPreview({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="text-center py-6 space-y-2">
      <div className="w-12 h-12 rounded-2xl bg-muted/60 flex items-center justify-center mx-auto">
        <Brain className="h-6 w-6 text-muted-foreground" />
      </div>
      <p className="text-sm font-semibold text-muted-foreground">{title}</p>
      <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
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
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedFeatureIds, setSelectedFeatureIds] = useState<Set<string>>(new Set());

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
  const bulkUpdateMutation = trpc.admin.bulkUpdateWorkshopFeatureConfig.useMutation({
    onSuccess: (data) => {
      utils.admin.getWorkshopConsole.invalidate();
      toast.success(`${data.updated}개 기능 상태가 변경되었습니다.`);
      setSelectedFeatureIds(new Set());
      setBulkMode(false);
    },
    onError: () => toast.error("일괄 변경 실패"),
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

  // DB가 단일 진실 출처: 서버 시작 시 모든 기능이 workshop_feature_config에 seed됨
  // featureConfigs에 항상 모든 기능이 존재하므로 WS_CATALOG status는 fallback으로만 사용
  const featureConfigMap = new Map(
    (consoleData?.featureConfigs ?? []).map(c => [c.featureId, c.status])
  );
  const allFeatures: WsItemEnriched[] = WS_CATALOG.flatMap(cat =>
    cat.items.map(item => {
      const effectiveStatus = (featureConfigMap.get(item.id) ?? item.status) as WsItemStatus;
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
          {/* 필터 + 선택 모드 토글 */}
          <div className="flex gap-2 flex-wrap items-center">
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
            <button onClick={() => { setBulkMode(v => !v); setSelectedFeatureIds(new Set()); }}
              className={`ml-auto text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${bulkMode ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>
              {bulkMode ? "취소" : "선택 편집"}
            </button>
          </div>

          {/* 전체 선택 + 일괄 변경 바 */}
          {bulkMode && (
            <div className="bg-accent/40 border border-border rounded-xl px-3 py-2.5 flex items-center gap-3">
              <button onClick={() => {
                if (selectedFeatureIds.size === filteredFeatures.length) {
                  setSelectedFeatureIds(new Set());
                } else {
                  setSelectedFeatureIds(new Set(filteredFeatures.map(f => f.id)));
                }
              }} className="flex items-center gap-2 text-xs font-semibold">
                <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${selectedFeatureIds.size === filteredFeatures.length && filteredFeatures.length > 0 ? "bg-primary border-primary" : selectedFeatureIds.size > 0 ? "bg-primary/30 border-primary" : "border-border bg-background"}`}>
                  {selectedFeatureIds.size > 0 && <Check className="h-2.5 w-2.5 text-white" />}
                </div>
                전체 선택 ({selectedFeatureIds.size}/{filteredFeatures.length})
              </button>
              <div className="flex gap-1.5 ml-auto">
                <button disabled={selectedFeatureIds.size === 0 || bulkUpdateMutation.isPending}
                  onClick={() => bulkUpdateMutation.mutate({ featureIds: Array.from(selectedFeatureIds), status: "active" })}
                  className="text-[11px] font-semibold px-2.5 py-1.5 rounded-lg bg-green-600 text-white disabled:opacity-40 transition-opacity">
                  활성
                </button>
                <button disabled={selectedFeatureIds.size === 0 || bulkUpdateMutation.isPending}
                  onClick={() => bulkUpdateMutation.mutate({ featureIds: Array.from(selectedFeatureIds), status: "coming_soon" })}
                  className="text-[11px] font-semibold px-2.5 py-1.5 rounded-lg bg-muted text-muted-foreground border border-border disabled:opacity-40 transition-opacity">
                  준비 중
                </button>
              </div>
            </div>
          )}

          <p className="text-xs text-muted-foreground">{filteredFeatures.length}개 기능</p>

          <div className="space-y-2">
            {filteredFeatures.map(f => {
              const sm = FEATURE_STATUS_META[f.status] ?? FEATURE_STATUS_META.coming_soon;
              const FIcon = f.icon;
              const isChecked = selectedFeatureIds.has(f.id);
              return (
                <div key={f.id}
                  onClick={() => {
                    if (bulkMode) {
                      setSelectedFeatureIds(prev => {
                        const next = new Set(prev);
                        isChecked ? next.delete(f.id) : next.add(f.id);
                        return next;
                      });
                    } else {
                      setSelectedFeature(f);
                    }
                  }}
                  className={`w-full bg-card border rounded-xl p-4 text-left cursor-pointer transition-colors ${bulkMode && isChecked ? "border-primary bg-primary/5" : "border-border hover:border-primary/40 hover:bg-accent/10"}`}>
                  <div className="flex items-start gap-3">
                    {bulkMode && (
                      <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors ${isChecked ? "bg-primary border-primary" : "border-border bg-background"}`}>
                        {isChecked && <Check className="h-2.5 w-2.5 text-white" />}
                      </div>
                    )}
                    <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <FIcon className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="text-sm font-semibold">{f.name}</p>
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${sm.cls}`}>{sm.label}</span>
                        {(() => {
                          const tier = Object.entries(TIER_ITEMS).find(([, ids]) => ids.includes(f.id))?.[0];
                          if (!tier) return null;
                          const cfg = { free: "bg-emerald-100 text-emerald-700", pro: "bg-blue-100 text-blue-700", elite: "bg-amber-100 text-amber-700" } as Record<string, string>;
                          const lbl = { free: "FREE", pro: "PRO", elite: "ELITE" } as Record<string, string>;
                          return <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${cfg[tier]}`}>{lbl[tier]}</span>;
                        })()}
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
                    {!bulkMode && <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />}
                  </div>
                </div>
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

// ── 스토어 카드 (기능 구매 탭용) ──────────────────────────────────────────────
function WorkshopStoreCard({ item, effectiveStatus, onClick }: { item: WsItem; effectiveStatus?: string; onClick: () => void }) {
  const Icon = item.icon;
  const isActive = (effectiveStatus ?? item.status) === "active";

  return (
    <button onClick={onClick}
      className="w-full bg-card px-4 py-3.5 text-left hover:bg-accent/30 active:bg-accent/50 transition-colors">
      <div className="flex items-center gap-3">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${isActive ? "bg-primary/10" : "bg-muted/50"}`}>
          <Icon className={`h-4.5 w-4.5 h-[18px] w-[18px] ${isActive ? "text-primary" : "text-muted-foreground"}`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-semibold ${!isActive ? "text-foreground/60" : ""}`}>{item.name}</p>
          <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-1 mt-0.5">{item.shortDesc}</p>
        </div>
        <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${
          isActive ? "bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400" :
                     "bg-muted text-muted-foreground"
        }`}>
          {isActive ? "포함" : "준비 중"}
        </span>
      </div>
    </button>
  );
}

// ── 내 작업실 기능 행 ──────────────────────────────────────────────────────────
function WorkspaceFeatureRow({ item, onClick }: { item: WsItem & { catLabel: string }; onClick: () => void }) {
  const Icon = item.icon;
  const hasSettings = ["brand_page","fitstep_plus","booking","report_branding","templates","survey","contract_terms"].includes(item.id);

  return (
    <button onClick={onClick}
      className="w-full bg-card border border-border rounded-2xl p-4 text-left hover:border-primary/30 hover:bg-primary/[0.02] active:scale-[0.98] transition-all duration-150">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold">{item.name}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">{item.catLabel}</p>
        </div>
        <div className={`shrink-0 text-[11px] font-semibold px-3 py-1.5 rounded-lg
          ${hasSettings ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
          {hasSettings ? "설정하기" : "사용 중"}
        </div>
      </div>
    </button>
  );
}

// ── 작업실 메인 (트레이너용, 상태 기반) ─────────────────────────────────────
function WorkshopContent() {
  const { data: user } = trpc.auth.me.useQuery();
  const utils = trpc.useUtils();
  const [selectedItem, setSelectedItem] = useState<WsItem | null>(null);
  const [wsTab, setWsTab] = useState<"store" | "workspace">("store");
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

  // ── 체험 중 / 유예 / 활성화 → 두 탭 표시 ────────────────────────────────────
  const featureConfigs = wsStatus?.featureConfigs ?? {};
  const getEffectiveStatus = (item: WsItem) => featureConfigs[item.id] ?? item.status;

  const activeItems = WS_CATALOG.flatMap(cat =>
    cat.items
      .filter(item => getEffectiveStatus(item) === "active")
      .map(item => ({ ...item, catKey: cat.key, catLabel: cat.label }))
  );

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

      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">작업실</h1>
          <p className="text-sm text-muted-foreground mt-0.5">스테퍼 전용 기능 공간</p>
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

      {/* 서브탭 */}
      <div className="flex gap-1 bg-muted/40 rounded-xl p-1">
        <button onClick={() => setWsTab("store")}
          className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${wsTab === "store" ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
          기능 구매
        </button>
        <button onClick={() => setWsTab("workspace")}
          className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${wsTab === "workspace" ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
          내 작업실
        </button>
      </div>

      {/* ── 기능 구매 탭 (플랜별) ──────────────────────────────── */}
      {wsTab === "store" && (
        <div className="space-y-5 pb-6">
          {(["free", "pro", "elite"] as const).map(tierKey => {
            const meta = TIER_META[tierKey];
            const allItems = WS_CATALOG.flatMap(c => c.items);
            const tierItemList = TIER_ITEMS[tierKey]
              .map(id => allItems.find(i => i.id === id))
              .filter(Boolean) as WsItem[];

            return (
              <div key={tierKey} className={`rounded-2xl border overflow-hidden ${meta.headerCls}`}>
                {/* 플랜 헤더 */}
                <div className={`px-4 py-3 border-b ${meta.headerCls}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className={`text-[11px] font-black px-2.5 py-1 rounded-lg ${meta.badgeCls}`}>{meta.label}</span>
                      <div>
                        <p className="text-sm font-bold text-foreground">{meta.desc}</p>
                        <p className="text-[11px] text-muted-foreground">{meta.limit}</p>
                      </div>
                    </div>
                  </div>

                  {/* FREE 기본 기능 chips */}
                  {meta.baseFeatures && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      <span className="text-[10px] text-muted-foreground font-semibold self-center">기본 포함:</span>
                      {meta.baseFeatures.map(f => (
                        <span key={f} className="text-[11px] bg-white/70 dark:bg-card/60 border border-border/50 px-2 py-0.5 rounded-full font-medium text-foreground/80">
                          {f}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* 기능 카드 목록 */}
                <div className="bg-card divide-y divide-border/40">
                  {tierItemList.map(item => (
                    <WorkshopStoreCard key={item.id} item={item} effectiveStatus={getEffectiveStatus(item)}
                      onClick={() => setSelectedItem({ ...item, status: getEffectiveStatus(item) as WsItemStatus })} />
                  ))}
                </div>
              </div>
            );
          })}

          <p className="text-[11px] text-muted-foreground text-center">
            준비 중 기능은 출시 시 자동으로 활성화됩니다
          </p>
        </div>
      )}

      {/* ── 내 작업실 탭 ─────────────────────────────────────── */}
      {wsTab === "workspace" && (
        <div className="space-y-3 pb-6">
          <p className="text-xs text-muted-foreground">
            현재 이용 가능한 기능 {activeItems.length}개 · 설정 및 관리하세요
          </p>
          {activeItems.map(item => (
            <WorkspaceFeatureRow key={item.id} item={item} onClick={() => setSelectedItem({ ...item, status: getEffectiveStatus(item) as WsItemStatus })} />
          ))}
          <div className="mt-4 bg-muted/30 border border-border/40 rounded-2xl p-4 text-center">
            <p className="text-xs text-muted-foreground">추가 기능은 <button className="text-primary font-semibold underline-offset-2 hover:underline" onClick={() => setWsTab("store")}>기능 구매</button> 탭에서 확인하세요</p>
          </div>
        </div>
      )}

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
