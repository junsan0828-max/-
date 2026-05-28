import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Bell, Plus, ClipboardList, CheckCircle2, Clock, ChevronDown, ChevronUp, Trash2, Zap } from "lucide-react";

const WORK_CATEGORIES = ["상담", "수업", "회원관리", "청소/정리", "마케팅", "매출/등록", "교육", "기타"];

function WorkManagementSection() {
  const utils = trpc.useUtils();
  const { data: staffList } = trpc.gym.work.tasks.listStaff.useQuery();
  const { data: overview } = trpc.gym.work.tasks.staffOverview.useQuery();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    title: "", category: "기타", priority: "normal",
    taskType: "daily", isRecurring: 0, assigneeId: "",
    taskDate: new Date().toISOString().substring(0, 10), dueTime: "",
  });

  const createMutation = trpc.gym.work.tasks.create.useMutation({
    onSuccess: () => {
      toast.success("업무가 추가되었습니다");
      utils.gym.work.tasks.invalidate();
      setShowAdd(false);
      setForm({ title: "", category: "기타", priority: "normal", taskType: "daily", isRecurring: 0, assigneeId: "", taskDate: new Date().toISOString().substring(0, 10), dueTime: "" });
    },
    onError: (e) => toast.error(e.message),
  });

  const createForGroupMutation = trpc.gym.work.tasks.createForGroup.useMutation({
    onSuccess: (data) => {
      toast.success(`업무가 ${data.count}명에게 할당되었습니다`);
      utils.gym.work.tasks.invalidate();
      setShowAdd(false);
      setForm({ title: "", category: "기타", priority: "normal", taskType: "daily", isRecurring: 0, assigneeId: "", taskDate: new Date().toISOString().substring(0, 10), dueTime: "" });
    },
    onError: (e) => toast.error(e.message),
  });

  function handleAdd() {
    if (!form.title.trim()) return toast.error("업무 제목을 입력해주세요");
    if (!form.assigneeId) return toast.error("담당자를 선택해주세요");
    const base = {
      title: form.title.trim(), category: form.category, priority: form.priority,
      taskType: form.taskType, isRecurring: form.isRecurring,
      taskDate: form.isRecurring ? undefined : form.taskDate,
      dueTime: form.dueTime || undefined,
    };
    if (form.assigneeId === "all" || form.assigneeId === "trainer" || form.assigneeId === "consultant") {
      createForGroupMutation.mutate({ ...base, assigneeGroup: form.assigneeId as "all" | "trainer" | "consultant" });
    } else {
      createMutation.mutate({ ...base, assigneeId: parseInt(form.assigneeId) });
    }
  }

  const staff = (staffList ?? []).filter((s: any) => s.role !== "admin");

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-primary" />업무 관리
          </CardTitle>
          <button onClick={() => setShowAdd(v => !v)}
            className="flex items-center gap-1.5 bg-primary text-primary-foreground px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-primary/90">
            <Plus className="h-3.5 w-3.5" />업무 추가
          </button>
        </div>
        <p className="text-xs text-muted-foreground">직원 업무 할당 및 오늘 완료 현황</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {showAdd && (
          <div className="bg-background border border-border rounded-xl p-4 space-y-3">
            <div>
              <label className="text-xs text-muted-foreground">업무 제목 *</label>
              <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="업무 내용을 입력하세요"
                className="w-full mt-1 bg-card border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">담당자 *</label>
                <select value={form.assigneeId} onChange={e => setForm(f => ({ ...f, assigneeId: e.target.value }))}
                  className="w-full mt-1 bg-card border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary">
                  <option value="">선택</option>
                  <optgroup label="── 그룹 할당 ──">
                    <option value="all">전체 직원</option>
                    <option value="trainer">트레이너 전체</option>
                    <option value="consultant">컨설턴트 전체</option>
                  </optgroup>
                  <optgroup label="── 개인 ──">
                    {staff.map((s: any) => <option key={s.id} value={s.id}>{s.username} ({s.role === "trainer" ? "트레이너" : "컨설턴트"})</option>)}
                  </optgroup>
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">카테고리</label>
                <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                  className="w-full mt-1 bg-card border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary">
                  {WORK_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {(["daily", "weekly", "monthly"] as const).map(t => (
                <button key={t} type="button" onClick={() => setForm(f => ({ ...f, taskType: t }))}
                  className={`py-1.5 rounded-lg text-xs font-medium transition-colors ${form.taskType === t ? "bg-primary text-primary-foreground" : "bg-accent text-muted-foreground"}`}>
                  {t === "daily" ? "일일" : t === "weekly" ? "주간" : "월간"}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.isRecurring === 1} onChange={e => setForm(f => ({ ...f, isRecurring: e.target.checked ? 1 : 0 }))} />
                <span className="text-xs text-muted-foreground">반복 업무</span>
              </label>
              {!form.isRecurring && (
                <input type="date" value={form.taskDate} onChange={e => setForm(f => ({ ...f, taskDate: e.target.value }))}
                  className="flex-1 bg-card border border-border rounded-lg px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
              )}
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setShowAdd(false)} className="flex-1 border border-border text-muted-foreground rounded-lg py-2 text-sm hover:bg-accent">취소</button>
              <button type="button" onClick={handleAdd} className="flex-1 bg-primary text-primary-foreground rounded-lg py-2 text-sm font-medium hover:bg-primary/90">추가</button>
            </div>
          </div>
        )}

        {(overview ?? []).length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground font-medium">오늘 완료 현황</p>
            {(overview ?? []).map((s: any) => (
              <div key={s.assigneeId} className="flex items-center justify-between bg-background border border-border rounded-lg px-3 py-2">
                <span className="text-sm text-foreground">{s.name}</span>
                <div className="flex items-center gap-2">
                  <div className="w-20 h-1.5 bg-border rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${s.rate}%` }} />
                  </div>
                  <span className="text-xs text-muted-foreground">{s.todayDone}/{s.todayTotal}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {(overview ?? []).length === 0 && !showAdd && (
          <p className="text-xs text-muted-foreground text-center py-4">오늘 할당된 업무가 없습니다</p>
        )}
      </CardContent>
    </Card>
  );
}

function NoticeReadPanel({ noticeId }: { noticeId: number }) {
  const { data, isLoading } = trpc.gym.work.notices.readStatus.useQuery({ noticeId });
  if (isLoading) return <div className="text-xs text-muted-foreground py-2 text-center">로딩 중...</div>;
  const { readers = [], nonReaders = [] } = data ?? {};
  const total = readers.length + nonReaders.length;
  return (
    <div className="mt-2 border-t border-border/50 pt-2 space-y-2">
      <div className="flex items-center gap-3 text-xs">
        <span className="flex items-center gap-1 text-emerald-400 font-semibold">
          <CheckCircle2 className="h-3.5 w-3.5" />확인 {readers.length}명
        </span>
        {nonReaders.length > 0 && (
          <span className="flex items-center gap-1 text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />미확인 {nonReaders.length}명
          </span>
        )}
        {total > 0 && <span className="ml-auto text-muted-foreground">전체 {total}명</span>}
      </div>
      {readers.length > 0 && (
        <div className="space-y-1">
          {readers.map(r => (
            <div key={r.userId} className="flex items-center justify-between text-xs bg-emerald-500/5 border border-emerald-500/20 rounded px-2 py-1">
              <span className="text-emerald-400 font-medium">{r.username}</span>
              <span className="text-muted-foreground">{r.readAt?.substring(0, 16).replace("T", " ")}</span>
            </div>
          ))}
        </div>
      )}
      {nonReaders.length > 0 && (
        <div className="space-y-1">
          {nonReaders.map(r => (
            <div key={r.userId} className="flex items-center text-xs bg-muted/30 rounded px-2 py-1">
              <Clock className="h-3 w-3 text-muted-foreground mr-1.5" />
              <span className="text-muted-foreground">{r.username}</span>
              <span className="ml-auto text-xs text-muted-foreground/60">미확인</span>
            </div>
          ))}
        </div>
      )}
      {total === 0 && <p className="text-xs text-muted-foreground text-center py-1">확인한 직원이 없습니다</p>}
    </div>
  );
}

function NoticeManagementSection() {
  const utils = trpc.useUtils();
  const { data: noticeList } = trpc.gym.work.notices.list.useQuery();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ title: "", content: "", targetRole: "all", priority: "normal" });
  const [expandedReaders, setExpandedReaders] = useState<Set<number>>(new Set());
  const [expandedNotices, setExpandedNotices] = useState<Set<number>>(new Set());

  function toggleNotice(id: number) {
    setExpandedNotices(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  const createMutation = trpc.gym.work.notices.create.useMutation({
    onSuccess: () => {
      toast.success("공지사항이 등록되었습니다");
      utils.gym.work.notices.invalidate();
      setShowAdd(false);
      setForm({ title: "", content: "", targetRole: "all", priority: "normal" });
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = trpc.gym.work.notices.delete.useMutation({
    onSuccess: () => { toast.success("삭제되었습니다"); utils.gym.work.notices.invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  const PRIORITY_STYLE: Record<string, string> = {
    urgent: "bg-red-500/20 text-red-400 border border-red-500/30",
    important: "bg-amber-500/20 text-amber-400 border border-amber-500/30",
    normal: "bg-blue-500/20 text-blue-400 border border-blue-500/30",
  };
  const PRIORITY_LABEL: Record<string, string> = { urgent: "긴급", important: "중요", normal: "일반" };
  const ROLE_LABEL: Record<string, string> = { all: "전체", trainer: "트레이너", consultant: "컨설턴트" };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Bell className="h-4 w-4 text-primary" />공지사항 관리
          </CardTitle>
          <button onClick={() => setShowAdd(v => !v)}
            className="flex items-center gap-1.5 bg-primary text-primary-foreground px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-primary/90">
            <Plus className="h-3.5 w-3.5" />공지 작성
          </button>
        </div>
        <p className="text-xs text-muted-foreground">트레이너·컨설턴트 공지사항 등록 및 관리</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {showAdd && (
          <div className="bg-background border border-border rounded-xl p-4 space-y-3">
            <div>
              <label className="text-xs text-muted-foreground">제목 *</label>
              <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="공지 제목"
                className="w-full mt-1 bg-card border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">내용 *</label>
              <textarea value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} placeholder="공지 내용을 입력하세요" rows={3}
                className="w-full mt-1 bg-card border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">대상</label>
                <select value={form.targetRole} onChange={e => setForm(f => ({ ...f, targetRole: e.target.value }))}
                  className="w-full mt-1 bg-card border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary">
                  <option value="all">전체</option>
                  <option value="trainer">트레이너만</option>
                  <option value="consultant">컨설턴트만</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">중요도</label>
                <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}
                  className="w-full mt-1 bg-card border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary">
                  <option value="normal">일반</option>
                  <option value="important">중요</option>
                  <option value="urgent">긴급</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setShowAdd(false)} className="flex-1 border border-border text-muted-foreground rounded-lg py-2 text-sm hover:bg-accent">취소</button>
              <button type="button"
                onClick={() => { if (!form.title.trim() || !form.content.trim()) return toast.error("제목과 내용을 입력해주세요"); createMutation.mutate(form); }}
                className="flex-1 bg-primary text-primary-foreground rounded-lg py-2 text-sm font-medium hover:bg-primary/90">등록</button>
            </div>
          </div>
        )}

        {(noticeList ?? []).length === 0 && !showAdd ? (
          <p className="text-xs text-muted-foreground text-center py-4">등록된 공지사항이 없습니다</p>
        ) : (
          <div className="space-y-2">
            {(noticeList ?? []).map((n: any) => {
              const isOpen = expandedNotices.has(n.notice.id);
              return (
                <div key={n.notice.id} className="bg-background border border-border rounded-lg px-3 py-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0 cursor-pointer" onClick={() => toggleNotice(n.notice.id)}>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${PRIORITY_STYLE[n.notice.priority]}`}>
                          {PRIORITY_LABEL[n.notice.priority]}
                        </span>
                        <span className="text-xs text-muted-foreground border border-border px-1.5 py-0.5 rounded-full">
                          {ROLE_LABEL[n.notice.targetRole] ?? n.notice.targetRole}
                        </span>
                      </div>
                      <p className={`text-sm font-medium text-foreground mt-1 ${isOpen ? "" : "truncate"}`}>{n.notice.title}</p>
                      <p className={`text-xs text-muted-foreground mt-0.5 whitespace-pre-wrap ${isOpen ? "" : "line-clamp-2"}`}>{n.notice.content}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-muted-foreground">{n.notice.createdAt?.substring(0, 10)}</span>
                        <span className="text-xs text-primary">{isOpen ? "▲ 접기" : "▼ 더 보기"}</span>
                      </div>
                    </div>
                    <button onClick={() => { if (confirm("공지를 삭제하시겠습니까?")) deleteMutation.mutate({ id: n.notice.id }); }}
                      className="text-red-400 hover:text-red-300 p-1 rounded hover:bg-red-500/10 transition-colors shrink-0">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <button
                    onClick={() => setExpandedReaders(prev => {
                      const next = new Set(prev); next.has(n.notice.id) ? next.delete(n.notice.id) : next.add(n.notice.id); return next;
                    })}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mt-1.5 transition-colors"
                  >
                    <CheckCircle2 className="h-3 w-3" />확인자 보기
                    {expandedReaders.has(n.notice.id) ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  </button>
                  {expandedReaders.has(n.notice.id) && <NoticeReadPanel noticeId={n.notice.id} />}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const SESSION_PRESETS = [10, 20, 30, 40, 50];
const SERVICE_PRESETS = [1, 2, 3];

function EventManagementSection() {
  const [eventType, setEventType] = useState<"PT" | "헬스">("PT");
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  // applicableSessions: Set of selected session counts (as strings)
  const [selectedSessions, setSelectedSessions] = useState<Set<string>>(new Set());
  const [customSession, setCustomSession] = useState(""); // 직접입력 세션
  const [form, setForm] = useState({ name: "", serviceSessions: "0", serviceSessionPrice: "0", startDate: "", endDate: "" });

  const { data: events, refetch } = trpc.eventPrograms.list.useQuery({ type: eventType });
  const upsertMutation = trpc.eventPrograms.upsert.useMutation({
    onSuccess: () => { toast.success("저장되었습니다."); setShowForm(false); setEditItem(null); refetch(); },
    onError: (e) => toast.error(e.message || "저장 실패"),
  });
  const deleteMutation = trpc.eventPrograms.delete.useMutation({
    onSuccess: () => { toast.success("삭제되었습니다."); refetch(); },
    onError: (e) => toast.error(e.message || "삭제 실패"),
  });

  function resetForm() {
    setSelectedSessions(new Set());
    setCustomSession("");
    setForm({ name: "", serviceSessions: "0", serviceSessionPrice: "0", startDate: "", endDate: "" });
  }

  const openEdit = (item: any) => {
    setEditItem(item);
    // applicableSessions가 있으면 파싱, 없으면 기존 sessions 값 사용
    const raw: string = item.applicableSessions || String(item.sessions || "");
    const parsed = raw.split(",").map((s: string) => s.trim()).filter(Boolean);
    const presetSet = new Set<string>();
    let custom = "";
    parsed.forEach((s: string) => {
      if (SESSION_PRESETS.map(String).includes(s)) presetSet.add(s);
      else custom = s;
    });
    setSelectedSessions(presetSet);
    setCustomSession(custom);
    setForm({ name: item.name, serviceSessions: String(item.serviceSessions), serviceSessionPrice: String(item.serviceSessionPrice), startDate: item.startDate ?? "", endDate: item.endDate ?? "" });
    setShowForm(true);
  };
  const openNew = () => { setEditItem(null); resetForm(); setShowForm(true); };

  function toggleSession(s: string) {
    setSelectedSessions(prev => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s); else next.add(s);
      return next;
    });
  }

  function buildApplicableSessions() {
    const all = [...Array.from(selectedSessions).map(Number).sort((a, b) => a - b).map(String)];
    if (customSession.trim()) all.push(customSession.trim());
    return all.join(",");
  }

  const handleSubmit = () => {
    const applicableSessions = buildApplicableSessions();
    if (!form.name) { toast.error("이벤트명을 입력해주세요."); return; }
    upsertMutation.mutate({
      id: editItem?.id,
      type: eventType,
      name: form.name,
      applicableSessions: applicableSessions || "",
      serviceSessions: parseInt(form.serviceSessions || "0"),
      serviceSessionPrice: parseInt(form.serviceSessionPrice || "0"),
      isActive: editItem?.isActive ?? 1,
      startDate: form.startDate || null,
      endDate: form.endDate || null,
    });
  };

  const isCustomServiceSessions = !["0", ...SERVICE_PRESETS.map(String)].includes(form.serviceSessions);

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Zap className="h-4 w-4 text-primary" />이벤트 관리
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* PT/헬스 탭 */}
        <div className="flex gap-2">
          {(["PT","헬스"] as const).map(t => (
            <button key={t} onClick={() => { setEventType(t); setShowForm(false); }}
              className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${eventType === t ? "bg-primary/20 border-primary/40 text-primary" : "border-border text-muted-foreground"}`}>
              {t} 이벤트
            </button>
          ))}
        </div>

        {/* 이벤트 목록 */}
        <div className="space-y-2">
          {(events ?? []).map((ev: any) => {
            const appliedSessions = ev.applicableSessions || String(ev.sessions || "");
            return (
              <div key={ev.id} className={`flex items-start gap-3 p-3 rounded-lg border ${ev.isActive ? "bg-accent/20 border-border" : "bg-muted/10 border-border/50 opacity-60"}`}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold">{ev.name}</span>
                    {ev.isActive ? <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-500/20 text-green-400">운영중</span> : <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted/40 text-muted-foreground">중단</span>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    적용 세션: {appliedSessions.split(",").map((s: string) => `${s}회`).join(" · ")}
                    {" · "} 서비스 +{ev.serviceSessions}회
                    {ev.serviceSessionPrice > 0 && <span> · 서비스단가 {ev.serviceSessionPrice.toLocaleString()}원</span>}
                  </p>
                  {(ev.startDate || ev.endDate) && (
                    <p className="text-xs text-muted-foreground/70 mt-0.5">
                      {ev.startDate ?? "시작일 없음"} ~ {ev.endDate ?? "종료일 없음"}
                    </p>
                  )}
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <button onClick={() => upsertMutation.mutate({ ...ev, applicableSessions: ev.applicableSessions || String(ev.sessions), isActive: ev.isActive ? 0 : 1 })}
                    className="text-xs px-2 py-1 rounded border border-border text-muted-foreground hover:text-foreground transition-colors">
                    {ev.isActive ? "중단" : "재개"}
                  </button>
                  <button onClick={() => openEdit(ev)}
                    className="text-xs px-2 py-1 rounded border border-border text-muted-foreground hover:text-foreground transition-colors">수정</button>
                  <button onClick={() => { if (confirm("삭제할까요?")) deleteMutation.mutate({ id: ev.id }); }}
                    className="text-xs px-2 py-1 rounded border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors">삭제</button>
                </div>
              </div>
            );
          })}
          {(events ?? []).length === 0 && <p className="text-sm text-muted-foreground text-center py-4">등록된 이벤트가 없습니다.</p>}
        </div>

        {/* 추가/수정 폼 */}
        {showForm && (
          <div className="p-3 rounded-lg border border-primary/30 bg-primary/5 space-y-4">
            <p className="text-sm font-medium">{editItem ? "이벤트 수정" : "새 이벤트 추가"}</p>

            {/* 이벤트명 */}
            <div>
              <label className="text-xs text-muted-foreground">이벤트명</label>
              <input value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} placeholder="예: 진단서 이벤트" className="w-full mt-1 px-3 py-2 rounded-md border border-border bg-background text-sm" />
            </div>

            {/* 이벤트 적용 세션 */}
            <div>
              <label className="text-xs text-muted-foreground">이벤트 적용 세션 <span className="text-muted-foreground/60">(중복 선택 가능)</span></label>
              <div className="flex gap-2 mt-1.5 flex-wrap">
                {SESSION_PRESETS.map(s => (
                  <button key={s} type="button"
                    onClick={() => toggleSession(String(s))}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${selectedSessions.has(String(s)) ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground bg-background hover:text-foreground"}`}>
                    {s}회
                  </button>
                ))}
                <input
                  type="number" min="1"
                  value={customSession}
                  onChange={e => setCustomSession(e.target.value)}
                  placeholder="직접입력"
                  className="w-20 px-2 py-1.5 rounded-lg border border-border bg-background text-sm text-center"
                />
              </div>
              {(selectedSessions.size > 0 || customSession) && (
                <p className="text-xs text-primary mt-1">
                  선택: {[...Array.from(selectedSessions).map(Number).sort((a,b)=>a-b).map(n=>`${n}회`), ...(customSession ? [`${customSession}회`] : [])].join(", ")}
                </p>
              )}
            </div>

            {/* 서비스 세션 */}
            <div>
              <label className="text-xs text-muted-foreground">서비스 세션</label>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <button type="button" onClick={() => setForm(f => ({...f, serviceSessions: "0"}))}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${form.serviceSessions === "0" ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground bg-background"}`}>
                  없음
                </button>
                {SERVICE_PRESETS.map(n => (
                  <button key={n} type="button" onClick={() => setForm(f => ({...f, serviceSessions: String(n)}))}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${form.serviceSessions === String(n) ? "bg-amber-500 text-white border-amber-500" : "border-border text-muted-foreground bg-background"}`}>
                    +{n}
                  </button>
                ))}
                <input
                  type="number" min="1"
                  value={isCustomServiceSessions ? form.serviceSessions : ""}
                  onChange={e => setForm(f => ({...f, serviceSessions: e.target.value}))}
                  placeholder="직접입력"
                  className={`w-20 px-2 py-1.5 rounded-lg border text-sm text-center transition-colors ${isCustomServiceSessions ? "border-amber-500 bg-background text-foreground" : "border-border bg-background text-muted-foreground"}`}
                />
              </div>
            </div>

            {/* 서비스 세션 단가 */}
            <div>
              <label className="text-xs text-muted-foreground">서비스 세션 단가 <span className="text-muted-foreground/60">(정산용)</span></label>
              <div className="flex items-center gap-1 mt-1">
                <input type="number" value={form.serviceSessionPrice} onChange={e => setForm(f => ({...f, serviceSessionPrice: e.target.value}))} placeholder="40000"
                  className="flex-1 px-3 py-2 rounded-md border border-border bg-background text-sm" />
                <span className="text-xs text-muted-foreground">원</span>
              </div>
            </div>

            {/* 날짜 */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-muted-foreground">시작 날짜 <span className="text-muted-foreground/60">(없으면 즉시)</span></label>
                <input type="date" value={form.startDate} onChange={e => setForm(f => ({...f, startDate: e.target.value}))}
                  className="w-full mt-1 px-3 py-2 rounded-md border border-border bg-background text-sm" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">종료 날짜 <span className="text-muted-foreground/60">(없으면 무기한)</span></label>
                <input type="date" value={form.endDate} onChange={e => setForm(f => ({...f, endDate: e.target.value}))}
                  className="w-full mt-1 px-3 py-2 rounded-md border border-border bg-background text-sm" />
              </div>
            </div>

            {/* 요약 */}
            {(selectedSessions.size > 0 || customSession) && form.serviceSessions !== "0" && (
              <div className="text-xs text-muted-foreground bg-accent/20 rounded p-2">
                {[...Array.from(selectedSessions).map(Number).sort((a,b)=>a-b), ...(customSession ? [parseInt(customSession)] : [])].map(n => (
                  <span key={n}>{n}회 등록 → +{form.serviceSessions}회 서비스 (단가 {parseInt(form.serviceSessionPrice||"0").toLocaleString()}원)　</span>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <button onClick={() => { setShowForm(false); setEditItem(null); }} className="flex-1 py-2 rounded-md border border-border text-sm text-muted-foreground">취소</button>
              <button onClick={handleSubmit} disabled={upsertMutation.isPending} className="flex-1 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50">
                {upsertMutation.isPending ? "저장 중..." : "저장"}
              </button>
            </div>
          </div>
        )}

        {!showForm && (
          <button onClick={openNew} className="w-full py-2 rounded-md border border-dashed border-primary/40 text-sm text-primary hover:bg-primary/5 transition-colors">
            + 이벤트 추가
          </button>
        )}
      </CardContent>
    </Card>
  );
}

export default function WorkManagementPage() {
  const [tab, setTab] = useState<"tasks" | "notices" | "events">("tasks");
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">업무 관리</h1>
      {/* Tab nav */}
      <div className="flex gap-1 bg-accent/20 p-1 rounded-lg">
        {([["tasks","업무 관리"],["notices","공지사항 관리"],["events","이벤트 관리"]] as const).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex-1 py-2 text-sm rounded-md transition-colors font-medium ${tab === key ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
            {label}
          </button>
        ))}
      </div>
      {tab === "tasks" && <WorkManagementSection />}
      {tab === "notices" && <NoticeManagementSection />}
      {tab === "events" && <EventManagementSection />}
    </div>
  );
}
