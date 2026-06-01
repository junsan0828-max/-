import { useState } from "react";
import { trpc } from "../lib/trpc";
import { toast } from "sonner";
import { Plus, CheckCircle2, Circle, Bell, ChevronDown, ChevronUp, Trash2, X } from "lucide-react";

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
  { key: "daily",    label: "오늘" },
  { key: "weekly",   label: "주간" },
  { key: "monthly",  label: "월간" },
  { key: "position", label: "직책" },
  { key: "notices",  label: "공지" },
] as const;

type Tab = typeof TAB_LABELS[number]["key"];

const POSITION_BADGE: Record<string, string> = {
  "매니저":    "bg-purple-500/15 text-purple-400 border border-purple-500/30",
  "팀장":      "bg-blue-500/15 text-blue-400 border border-blue-500/30",
  "시니어":    "bg-cyan-500/15 text-cyan-400 border border-cyan-500/30",
  "팀원":      "bg-green-500/15 text-green-400 border border-green-500/30",
  "견습":      "bg-yellow-500/15 text-yellow-400 border border-yellow-500/30",
  "프리랜서":  "bg-orange-500/15 text-orange-400 border border-orange-500/30",
  "컨설턴트":  "bg-pink-500/15 text-pink-400 border border-pink-500/30",
};

const POSITION_TASKS: Record<string, { daily: string[]; weekly: string[]; monthly: string[] }> = {
  "매니저": {
    daily:   ["팀 일일 업무 점검", "스케줄 확인 및 조율", "매출 현황 파악"],
    weekly:  ["주간 팀 미팅 진행", "팀원 업무 피드백", "마케팅 성과 검토"],
    monthly: ["월간 KPI 분석 및 보고", "팀원 1:1 면담", "다음 달 목표 설정"],
  },
  "팀장": {
    daily:   ["팀원 출근 확인", "당일 수업 스케줄 점검", "회원 민원 처리"],
    weekly:  ["주간 업무 보고 작성", "팀 회의 참석", "회원 만족도 점검"],
    monthly: ["월간 실적 보고", "팀 목표 점검", "개선사항 제안"],
  },
  "시니어": {
    daily:   ["담당 회원 PT 수업", "회원 운동 기록 작성", "신입 트레이너 지도"],
    weekly:  ["주간 수업 계획 수립", "회원 목표 점검", "프로그램 업데이트"],
    monthly: ["회원 체성분 측정 및 분석", "월간 수업 계획서 작성", "전문성 향상 교육"],
  },
  "팀원": {
    daily:   ["담당 회원 PT 수업", "회원 출석 확인", "운동일지 작성"],
    weekly:  ["주간 수업 계획 작성", "회원 피드백 정리", "시설 점검"],
    monthly: ["월간 회원 관리 보고", "회원 체성분 측정", "자기개발 학습"],
  },
  "견습": {
    daily:   ["선임 트레이너 수업 보조", "시설 청결 점검", "회원 안내 및 응대"],
    weekly:  ["교육 내용 복습 및 정리", "실습 일지 작성", "미팅 참석"],
    monthly: ["역량 평가 준비", "자격증 학습", "월간 실습 보고서 작성"],
  },
  "프리랜서": {
    daily:   ["담당 수업 진행", "수업 기록 작성", "고객 소통"],
    weekly:  ["주간 수업 일정 조율", "수업료 정산 확인", "고객 피드백 반영"],
    monthly: ["월간 수업 실적 확인", "계약 사항 검토", "새 고객 유치 활동"],
  },
  "컨설턴트": {
    daily:   ["신규 상담 진행", "리드 현황 업데이트", "등록 고객 사후 관리"],
    weekly:  ["주간 상담 실적 정리", "마케팅 채널 성과 분석", "팀 공유 미팅"],
    monthly: ["월간 전환율 분석", "마케팅 전략 검토", "고객 만족도 조사"],
  },
};

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
  const [selectedNotice, setSelectedNotice] = useState<any>(null);
  const [selectedTask, setSelectedTask] = useState<any>(null);

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

  // 비반복 업무: taskDate >= today면 표시 (미리 보임), 날짜 지나면 사라짐
  const dailyTasks   = (allTasks ?? []).filter(r => r.task.taskType === "daily"   && (r.task.isRecurring === 1 || (r.task.taskDate != null && r.task.taskDate >= today)));
  const weeklyTasks  = (allTasks ?? []).filter(r => r.task.taskType === "weekly"  && (r.task.isRecurring === 1 || (r.task.taskDate != null && r.task.taskDate >= today)));
  const monthlyTasks = (allTasks ?? []).filter(r => r.task.taskType === "monthly" && (r.task.isRecurring === 1 || (r.task.taskDate != null && r.task.taskDate >= today)));

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
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-foreground">나의 업무</h1>
            {user?.position && (
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${POSITION_BADGE[user.position] ?? "bg-gray-500/15 text-gray-400 border border-gray-500/30"}`}>
                {user.position}
              </span>
            )}
          </div>
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

      {/* 직책 탭 */}
      {tab === "position" && <PositionTab position={user?.position ?? null} />}

      {/* 업무 탭 콘텐츠 */}
      {tab !== "notices" && tab !== "position" && (
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
              {pendingTasks.map(row => <TaskCard key={row.task.id} row={row} onComplete={() => completeMutation.mutate({ id: row.task.id })} onDelete={() => { if (confirm("삭제하시겠습니까?")) deleteMutation.mutate({ id: row.task.id }); }} onOpen={() => setSelectedTask(row)} />)}

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
                      onDelete={() => { if (confirm("삭제하시겠습니까?")) deleteMutation.mutate({ id: row.task.id }); }}
                      onOpen={() => setSelectedTask(row)} />
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
                  <div
                    key={n.notice.id}
                    onClick={() => {
                      setSelectedNotice(n);
                      if (!n.isRead) markReadMutation.mutate({ noticeId: n.notice.id });
                    }}
                    className={`bg-card border rounded-xl p-4 space-y-2 cursor-pointer hover:bg-accent/50 active:bg-accent transition-colors ${n.isRead ? "border-border opacity-70" : "border-border"}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${pm.style}`}>{pm.label}</span>
                        <span className="font-medium text-sm text-foreground">{n.notice.title}</span>
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {n.isRead ? "확인 완료" : "탭하여 확인"}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{n.notice.content}</p>
                    <p className="text-xs text-muted-foreground">
                      {n.authorName} · {n.notice.createdAt.substring(0, 10)}
                    </p>
                  </div>
                );
              })
          )}
        </div>
      )}

      {/* 공지 상세 모달 */}
      {selectedNotice && (
        <div className="fixed inset-0 z-[300] bg-black/60 flex items-end justify-center" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }} onClick={() => setSelectedNotice(null)}>
          <div className="bg-card border border-border rounded-t-2xl w-full max-w-md flex flex-col" style={{ maxHeight: 'calc(80vh - env(safe-area-inset-bottom))' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3 border-b border-border shrink-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${(NOTICE_PRIORITY[selectedNotice.notice.priority] ?? NOTICE_PRIORITY.normal).style}`}>
                  {(NOTICE_PRIORITY[selectedNotice.notice.priority] ?? NOTICE_PRIORITY.normal).label}
                </span>
                <h3 className="font-semibold text-foreground leading-snug">{selectedNotice.notice.title}</h3>
              </div>
              <button onClick={() => setSelectedNotice(null)} className="text-muted-foreground hover:text-foreground shrink-0 mt-0.5">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 px-5 py-4 space-y-3">
              <p className="text-xs text-muted-foreground">{selectedNotice.authorName} · {selectedNotice.notice.createdAt.substring(0, 10)}</p>
              <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{selectedNotice.notice.content}</p>
            </div>
            <div className="p-4 border-t border-border shrink-0">
              <button onClick={() => setSelectedNotice(null)}
                className="w-full bg-primary text-primary-foreground rounded-xl py-3 text-sm font-bold hover:bg-primary/90">
                확인
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 업무 상세 모달 */}
      {selectedTask && (
        <div className="fixed inset-0 z-[300] bg-black/60 flex items-end justify-center" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }} onClick={() => setSelectedTask(null)}>
          <div className="bg-card border border-border rounded-t-2xl w-full max-w-md flex flex-col" style={{ maxHeight: 'calc(80vh - env(safe-area-inset-bottom))' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3 border-b border-border shrink-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CAT_COLOR[selectedTask.task.category] ?? CAT_COLOR["기타"]}`}>
                  {selectedTask.task.category}
                </span>
                <span className={`inline-block w-2 h-2 rounded-full ${(PRIORITY_META[selectedTask.task.priority] ?? PRIORITY_META.normal).dot}`} />
                <span className="text-xs text-muted-foreground">{(PRIORITY_META[selectedTask.task.priority] ?? PRIORITY_META.normal).label}</span>
                {selectedTask.task.isRecurring === 1 && <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">반복</span>}
              </div>
              <button onClick={() => setSelectedTask(null)} className="text-muted-foreground hover:text-foreground shrink-0 mt-0.5">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 px-5 py-4 space-y-3">
              <p className={`text-base font-semibold text-foreground ${selectedTask.effectiveStatus === "done" ? "line-through text-muted-foreground" : ""}`}>
                {selectedTask.task.title}
              </p>
              {selectedTask.task.dueTime && (
                <p className="text-xs text-muted-foreground">⏰ 마감 시간: {selectedTask.task.dueTime}</p>
              )}
              {selectedTask.task.taskDate && selectedTask.task.isRecurring !== 1 && (
                <p className="text-xs text-muted-foreground">📅 날짜: {selectedTask.task.taskDate}</p>
              )}
              {selectedTask.task.description && (
                <div className="bg-background rounded-xl p-4">
                  <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{selectedTask.task.description}</p>
                </div>
              )}
            </div>
            <div className="p-4 border-t border-border shrink-0 flex gap-2">
              {selectedTask.effectiveStatus !== "done" ? (
                <button onClick={() => { completeMutation.mutate({ id: selectedTask.task.id }); setSelectedTask(null); }}
                  className="flex-1 bg-emerald-500 text-white rounded-xl py-3 text-sm font-bold hover:bg-emerald-400">
                  완료 처리
                </button>
              ) : (
                <button onClick={() => { uncompleteMutation.mutate({ id: selectedTask.task.id }); setSelectedTask(null); }}
                  className="flex-1 bg-background border border-border text-foreground rounded-xl py-3 text-sm font-bold hover:bg-accent">
                  완료 취소
                </button>
              )}
              <button onClick={() => { if (confirm("삭제하시겠습니까?")) { deleteMutation.mutate({ id: selectedTask.task.id }); setSelectedTask(null); } }}
                className="px-5 py-3 rounded-xl border border-red-500/30 text-red-400 text-sm font-medium hover:bg-red-500/10">
                삭제
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 업무 추가 모달 */}
      {showAdd && (
        <div className="fixed inset-0 z-[200] bg-black/60 flex items-end justify-center"
          style={{ padding: 'max(env(safe-area-inset-top), 1rem) 1rem max(env(safe-area-inset-bottom), 1rem)' }}>
          <div className="bg-card border border-border rounded-2xl w-full max-w-md flex flex-col"
            style={{ maxHeight: 'calc(85vh - env(safe-area-inset-bottom))' }}>
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

function TaskCard({ row, done, onComplete, onUncomplete, onDelete, onOpen }: {
  row: any; done?: boolean;
  onComplete?: () => void; onUncomplete?: () => void; onDelete?: () => void; onOpen?: () => void;
}) {
  const tk = row.task;
  const pm = PRIORITY_META[tk.priority] ?? PRIORITY_META.normal;
  const catColor = CAT_COLOR[tk.category] ?? CAT_COLOR["기타"];

  const today = new Date().toISOString().substring(0, 10);
  const dDays = tk.taskDate && tk.isRecurring !== 1
    ? Math.round((new Date(tk.taskDate).getTime() - new Date(today).getTime()) / 86400000)
    : null;
  const isFuture = dDays !== null && dDays > 0;

  return (
    <div className={`bg-card border rounded-xl p-4 transition-opacity cursor-pointer hover:bg-accent/30 active:bg-accent/50 ${done ? "opacity-50" : isFuture ? "border-amber-500/30" : "border-border"}`}
      onClick={onOpen}>
      <div className="flex items-start gap-3">
        <button onClick={e => { e.stopPropagation(); (done ? onUncomplete : onComplete)?.(); }}
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
            {isFuture && <span className="text-xs bg-amber-500/15 text-amber-400 border border-amber-500/30 px-1.5 py-0.5 rounded-full">D-{dDays} ({tk.taskDate})</span>}
            {dDays === 0 && <span className="text-xs bg-primary/15 text-primary border border-primary/30 px-1.5 py-0.5 rounded-full">오늘</span>}
          </div>
          <p className={`text-sm font-medium text-foreground ${done ? "line-through" : ""}`}>{tk.title}</p>
          {tk.dueTime && <p className="text-xs text-muted-foreground mt-0.5">⏰ {tk.dueTime}</p>}
          {tk.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{tk.description}</p>}
        </div>
        <button onClick={e => { e.stopPropagation(); onDelete?.(); }} className="text-muted-foreground hover:text-red-400 p-1 shrink-0">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

function PositionTab({ position }: { position: string | null }) {
  if (!position || !POSITION_TASKS[position]) {
    return (
      <div className="text-center text-muted-foreground py-12">
        <CheckCircle2 className="h-10 w-10 mx-auto mb-3 opacity-20" />
        <p className="text-sm">직책이 설정되지 않았습니다</p>
        <p className="text-xs mt-1 opacity-60">관리자에게 직책 설정을 요청하세요</p>
      </div>
    );
  }

  const tasks = POSITION_TASKS[position];
  const badge = POSITION_BADGE[position] ?? "bg-gray-500/15 text-gray-400 border border-gray-500/30";
  const sections = [
    { label: "일일 업무", items: tasks.daily,   accent: "border-blue-500/30 bg-blue-500/5" },
    { label: "주간 업무", items: tasks.weekly,  accent: "border-violet-500/30 bg-violet-500/5" },
    { label: "월간 업무", items: tasks.monthly, accent: "border-amber-500/30 bg-amber-500/5" },
  ];

  return (
    <div className="space-y-4">
      <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${badge}`}>
        {position} 직책 업무
      </div>
      {sections.map(sec => (
        <div key={sec.label} className={`border rounded-xl p-4 space-y-2 ${sec.accent}`}>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{sec.label}</p>
          {sec.items.map((item, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-muted-foreground/40 shrink-0" />
              <p className="text-sm text-foreground">{item}</p>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
