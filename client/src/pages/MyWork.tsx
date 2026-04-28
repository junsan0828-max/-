import { useState } from "react";
import { trpc } from "../lib/trpc";
import { toast } from "sonner";
import { Plus, CheckCircle2, Circle, Bell, ChevronDown, ChevronUp, Trash2 } from "lucide-react";

const CATEGORIES = ["상담", "수업", "회원관리", "청소/정리", "마케팅", "매출/등록", "교육", "기타"];

const CAT_COLOR: Record<string, string> = {
  "상담": "bg-blue-400/15 text-blue-400",
  "수업": "bg-green-400/15 text-green-400",
  "회원관리": "bg-violet-400/15 text-violet-400",
  "청소/정리": "bg-gray-400/15 text-gray-400",
  "마케팅": "bg-pink-400/15 text-pink-400",
  "매출/등록": "bg-amber-400/15 text-amber-400",
  "교육": "bg-cyan-400/15 text-cyan-400",
  "기타": "bg-gray-400/15 text-gray-400",
};

const PRIORITY_META: Record<string, { label: string; dot: string }> = {
  high:   { label: "높음", dot: "bg-red-400" },
  normal: { label: "보통", dot: "bg-amber-400" },
  low:    { label: "낮음", dot: "bg-gray-400" },
};

const NOTICE_PRIORITY: Record<string, { label: string; style: string }> = {
  urgent:    { label: "긴급", style: "bg-red-500/20 text-red-400 border border-red-500/30" },
  important: { label: "중요", style: "bg-amber-500/20 text-amber-400 border border-amber-500/30" },
  normal:    { label: "일반", style: "bg-blue-500/20 text-blue-400 border border-blue-500/30" },
};

const TAB_LABELS = [
  { key: "daily",   label: "오늘" },
  { key: "weekly",  label: "주간" },
  { key: "monthly", label: "월간" },
  { key: "notices", label: "공지" },
] as const;

type Tab = typeof TAB_LABELS[number]["key"];

const defaultTaskForm = {
  title: "", description: "", category: "기타",
  priority: "normal", taskType: "daily",
  taskDate: new Date().toISOString().substring(0, 10),
  dueTime: "", isRecurring: 0,
};

export default function MyWorkPage() {
  const utils = trpc.useUtils();
  const { data: user } = trpc.auth.me.useQuery();
  const [tab, setTab] = useState<Tab>("daily");
  const [showDone, setShowDone] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [taskForm, setTaskForm] = useState(defaultTaskForm);

  const { data: allTasks, isLoading } = trpc.gym.work.tasks.list.useQuery();
  const { data: noticeList } = trpc.gym.work.notices.list.useQuery();

  const completeMutation   = trpc.gym.work.tasks.complete.useMutation({ onSuccess: () => utils.gym.work.tasks.invalidate() });
  const uncompleteMutation = trpc.gym.work.tasks.uncomplete.useMutation({ onSuccess: () => utils.gym.work.tasks.invalidate() });
  const createMutation     = trpc.gym.work.tasks.create.useMutation({
    onSuccess: () => { toast.success("업무가 추가되었습니다"); utils.gym.work.tasks.invalidate(); setShowAdd(false); setTaskForm(defaultTaskForm); },
    onError: (e) => toast.error(e.message),
  });
  const deleteMutation     = trpc.gym.work.tasks.delete.useMutation({ onSuccess: () => utils.gym.work.tasks.invalidate() });
  const markReadMutation   = trpc.gym.work.notices.markRead.useMutation({ onSuccess: () => utils.gym.work.notices.invalidate() });

  const today     = new Date().toISOString().substring(0, 10);
  const thisMonth = today.substring(0, 7);
  const weekStart = (() => {
    const d = new Date(); const day = d.getDay();
    d.setDate(d.getDate() - day + (day === 0 ? -6 : 1));
    return d.toISOString().substring(0, 10);
  })();

  const dailyTasks   = (allTasks ?? []).filter(r => r.task.taskType === "daily"   && (r.task.isRecurring === 1 || r.task.taskDate === today));
  const weeklyTasks  = (allTasks ?? []).filter(r => r.task.taskType === "weekly"  && (r.task.isRecurring === 1 || (r.task.taskDate && r.task.taskDate >= weekStart)));
  const monthlyTasks = (allTasks ?? []).filter(r => r.task.taskType === "monthly" && (r.task.isRecurring === 1 || (r.task.taskDate && r.task.taskDate.startsWith(thisMonth))));

  const currentTasks = tab === "daily" ? dailyTasks : tab === "weekly" ? weeklyTasks : monthlyTasks;
  const pendingTasks = currentTasks.filter(r => r.effectiveStatus !== "done").sort((a, b) => {
    const order = { high: 0, normal: 1, low: 2 };
    return (order[a.task.priority as keyof typeof order] ?? 1) - (order[b.task.priority as keyof typeof order] ?? 1);
  });
  const doneTasks = currentTasks.filter(r => r.effectiveStatus === "done");

  const todayPending = dailyTasks.filter(r => r.effectiveStatus !== "done").length;
  const todayDone    = dailyTasks.filter(r => r.effectiveStatus === "done").length;
  const unreadCount  = (noticeList ?? []).filter(n => !n.isRead).length;
  const urgentNotices = (noticeList ?? []).filter(n => n.notice.priority === "urgent" && !n.isRead);

  function handleSaveTask() {
    if (!taskForm.title.trim()) return toast.error("업무 제목을 입력해주세요");
    if (!user) return;
    createMutation.mutate({
      ...taskForm,
      assigneeId: user.id,
      taskDate: taskForm.isRecurring ? undefined : taskForm.taskDate,
      dueTime: taskForm.dueTime || undefined,
      description: taskForm.description || undefined,
    });
  }

  return (
    <div className="space-y-4 pb-24">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">나의 업무</h1>
          <p className="text-xs text-muted-foreground">{today.replace(/-/g, ".")} 기준</p>
        </div>
        <button onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 bg-primary text-primary-foreground px-3 py-2 rounded-lg text-sm font-medium hover:bg-primary/90">
          <Plus className="h-4 w-4" /> 업무 추가
        </button>
      </div>

      {/* 긴급 공지 */}
      {urgentNotices.map(n => (
        <div key={n.notice.id} className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 flex items-start gap-3">
          <Bell className="h-4 w-4 text-red-400 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-red-400">[긴급] {n.notice.title}</p>
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.notice.content}</p>
          </div>
          <button onClick={() => markReadMutation.mutate({ noticeId: n.notice.id })}
            className="text-xs text-red-400 border border-red-400/40 px-2 py-1 rounded shrink-0 hover:bg-red-400/10">확인</button>
        </div>
      ))}

      {/* 요약 카드 */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-card border border-border rounded-xl p-3 text-center">
          <div className="text-2xl font-bold text-foreground">{todayPending}</div>
          <div className="text-xs text-muted-foreground mt-0.5">오늘 할 일</div>
        </div>
        <div className="bg-card border border-border rounded-xl p-3 text-center">
          <div className="text-2xl font-bold text-emerald-400">{todayDone}</div>
          <div className="text-xs text-muted-foreground mt-0.5">완료</div>
        </div>
        <div className="bg-card border border-border rounded-xl p-3 text-center">
          <div className="text-2xl font-bold text-amber-400">{unreadCount}</div>
          <div className="text-xs text-muted-foreground mt-0.5">미확인 공지</div>
        </div>
      </div>

      {/* 탭 */}
      <div className="flex bg-card border border-border rounded-xl p-1 gap-1">
        {TAB_LABELS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
            {t.label}
            {t.key === "notices" && unreadCount > 0 && (
              <span className="ml-1 bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5">{unreadCount}</span>
            )}
          </button>
        ))}
      </div>

      {/* 업무 탭 콘텐츠 */}
      {tab !== "notices" && (
        <div className="space-y-2">
          {isLoading ? (
            <div className="text-center text-muted-foreground py-10 text-sm">로딩 중...</div>
          ) : pendingTasks.length === 0 && doneTasks.length === 0 ? (
            <div className="text-center text-muted-foreground py-12">
              <CheckCircle2 className="h-10 w-10 mx-auto mb-3 opacity-20" />
              <p className="text-sm">업무가 없습니다</p>
              <p className="text-xs mt-1 opacity-60">+ 업무 추가 버튼으로 등록하세요</p>
            </div>
          ) : (
            <>
              {pendingTasks.map(row => <TaskCard key={row.task.id} row={row} onComplete={() => completeMutation.mutate({ id: row.task.id })} onDelete={() => { if (confirm("삭제하시겠습니까?")) deleteMutation.mutate({ id: row.task.id }); }} />)}

              {doneTasks.length > 0 && (
                <div>
                  <button onClick={() => setShowDone(v => !v)}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground py-2 w-full">
                    {showDone ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                    완료된 업무 {doneTasks.length}개
                  </button>
                  {showDone && doneTasks.map(row => (
                    <TaskCard key={row.task.id} row={row} done
                      onUncomplete={() => uncompleteMutation.mutate({ id: row.task.id })}
                      onDelete={() => { if (confirm("삭제하시겠습니까?")) deleteMutation.mutate({ id: row.task.id }); }} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* 공지 탭 */}
      {tab === "notices" && (
        <div className="space-y-2">
          {(noticeList ?? []).length === 0 ? (
            <div className="text-center text-muted-foreground py-12">
              <Bell className="h-10 w-10 mx-auto mb-3 opacity-20" />
              <p className="text-sm">공지사항이 없습니다</p>
            </div>
          ) : (
            (noticeList ?? [])
              .sort((a, b) => {
                const pOrder = { urgent: 0, important: 1, normal: 2 };
                return (pOrder[a.notice.priority as keyof typeof pOrder] ?? 2) - (pOrder[b.notice.priority as keyof typeof pOrder] ?? 2);
              })
              .map(n => {
                const pm = NOTICE_PRIORITY[n.notice.priority] ?? NOTICE_PRIORITY.normal;
                return (
                  <div key={n.notice.id} className={`bg-card border rounded-xl p-4 space-y-2 ${n.isRead ? "border-border opacity-60" : "border-border"}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${pm.style}`}>{pm.label}</span>
                        <span className="font-medium text-sm text-foreground">{n.notice.title}</span>
                      </div>
                      {n.isRead ? (
                        <span className="text-xs text-muted-foreground shrink-0">확인 완료</span>
                      ) : (
                        <button onClick={() => markReadMutation.mutate({ noticeId: n.notice.id })}
                          className="text-xs bg-primary text-primary-foreground px-2.5 py-1 rounded-lg shrink-0 hover:bg-primary/90">
                          확인
                        </button>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">{n.notice.content}</p>
                    <p className="text-xs text-muted-foreground">
                      {n.authorName} · {n.notice.createdAt.substring(0, 10)}
                    </p>
                  </div>
                );
              })
          )}
        </div>
      )}

      {/* 업무 추가 모달 */}
      {showAdd && (
        <div className="fixed inset-0 z-[200] bg-black/60 flex items-end justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md flex flex-col" style={{ maxHeight: "85vh" }}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
              <h2 className="font-semibold text-foreground">업무 추가</h2>
              <button onClick={() => setShowAdd(false)} className="text-muted-foreground hover:text-foreground">✕</button>
            </div>
            <div className="overflow-y-auto flex-1 p-4 space-y-4">
              <div>
                <label className="text-xs text-muted-foreground">업무 제목 *</label>
                <input value={taskForm.title} onChange={e => setTaskForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="예: 오늘 상담 예약 확인"
                  className="w-full mt-1 bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
              </div>

              <div>
                <label className="text-xs text-muted-foreground">업무 구분</label>
                <div className="flex gap-1 mt-1">
                  {(["daily", "weekly", "monthly"] as const).map(t => (
                    <button key={t} type="button" onClick={() => setTaskForm(f => ({ ...f, taskType: t }))}
                      className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-colors ${taskForm.taskType === t ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border text-muted-foreground"}`}>
                      {t === "daily" ? "일일" : t === "weekly" ? "주간" : "월간"}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs text-muted-foreground">카테고리</label>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {CATEGORIES.map(c => (
                    <button key={c} type="button" onClick={() => setTaskForm(f => ({ ...f, category: c }))}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${taskForm.category === c ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border text-muted-foreground"}`}>
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs text-muted-foreground">우선순위</label>
                <div className="flex gap-2 mt-1">
                  {[["high", "높음"], ["normal", "보통"], ["low", "낮음"]].map(([v, l]) => (
                    <button key={v} type="button" onClick={() => setTaskForm(f => ({ ...f, priority: v }))}
                      className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-colors ${taskForm.priority === v ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border text-muted-foreground"}`}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <label className="text-xs text-muted-foreground">반복 업무</label>
                <button type="button" onClick={() => setTaskForm(f => ({ ...f, isRecurring: f.isRecurring ? 0 : 1 }))}
                  className={`relative w-10 h-5 rounded-full transition-colors ${taskForm.isRecurring ? "bg-primary" : "bg-muted"}`}>
                  <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${taskForm.isRecurring ? "translate-x-5" : "translate-x-0.5"}`} />
                </button>
                <span className="text-xs text-muted-foreground">{taskForm.isRecurring ? "매번 자동 반복" : "일회성"}</span>
              </div>

              {!taskForm.isRecurring && (
                <div>
                  <label className="text-xs text-muted-foreground">날짜</label>
                  <input type="date" value={taskForm.taskDate} onChange={e => setTaskForm(f => ({ ...f, taskDate: e.target.value }))}
                    className="w-full mt-1 bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
                </div>
              )}

              <div>
                <label className="text-xs text-muted-foreground">마감 시간 (선택)</label>
                <input type="time" value={taskForm.dueTime} onChange={e => setTaskForm(f => ({ ...f, dueTime: e.target.value }))}
                  className="w-full mt-1 bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
              </div>

              <div>
                <label className="text-xs text-muted-foreground">메모 (선택)</label>
                <textarea value={taskForm.description} onChange={e => setTaskForm(f => ({ ...f, description: e.target.value }))} rows={2}
                  className="w-full mt-1 bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none" />
              </div>
            </div>
            <div className="p-4 border-t border-border shrink-0">
              <button type="button" onClick={handleSaveTask} disabled={createMutation.isPending}
                className="w-full bg-primary text-primary-foreground rounded-xl py-3 text-sm font-bold hover:bg-primary/90 disabled:opacity-50">
                {createMutation.isPending ? "저장 중..." : "저장"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TaskCard({ row, done, onComplete, onUncomplete, onDelete }: {
  row: any; done?: boolean;
  onComplete?: () => void; onUncomplete?: () => void; onDelete?: () => void;
}) {
  const tk = row.task;
  const pm = PRIORITY_META[tk.priority] ?? PRIORITY_META.normal;
  const catColor = CAT_COLOR[tk.category] ?? CAT_COLOR["기타"];

  return (
    <div className={`bg-card border rounded-xl p-4 transition-opacity ${done ? "opacity-50" : "border-border"}`}>
      <div className="flex items-start gap-3">
        <button onClick={done ? onUncomplete : onComplete}
          className="mt-0.5 shrink-0 hover:scale-110 transition-transform">
          {done
            ? <CheckCircle2 className="h-6 w-6 text-emerald-400" />
            : <Circle className="h-6 w-6 text-muted-foreground hover:text-primary" />}
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap mb-1">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${catColor}`}>{tk.category}</span>
            <span className={`inline-block w-2 h-2 rounded-full ${pm.dot}`} />
            <span className="text-xs text-muted-foreground">{pm.label}</span>
            {tk.isRecurring === 1 && <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">반복</span>}
          </div>
          <p className={`text-sm font-medium text-foreground ${done ? "line-through" : ""}`}>{tk.title}</p>
          {tk.dueTime && <p className="text-xs text-muted-foreground mt-0.5">⏰ {tk.dueTime}</p>}
          {tk.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{tk.description}</p>}
        </div>
        <button onClick={onDelete} className="text-muted-foreground hover:text-red-400 p-1 shrink-0">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
