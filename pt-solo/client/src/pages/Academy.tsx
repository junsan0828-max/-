import { useState, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { GraduationCap, Plus, Edit2, Trash2, Play, CheckCircle, Coins, Clock, Eye, EyeOff, X, Check, Wifi, MapPin, Timer } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type CourseType = "online" | "offline";

type Course = {
  id: number;
  title: string;
  description: string | null;
  videoUrl: string | null;
  thumbnailUrl: string | null;
  duration: string | null;
  timerSeconds: number;
  pointReward: number;
  courseType: CourseType;
  isPublished: number;
  completed: boolean;
};

const EMPTY_FORM = {
  title: "",
  description: "",
  videoUrl: "",
  thumbnailUrl: "",
  timerSeconds: 0,
  courseType: "online" as CourseType,
  pointReward: 0,
  isPublished: 1,
};

function secsToHMS(total: number) {
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return { h, m, s };
}

function formatDuration(secs: number) {
  if (!secs) return "";
  const { h, m, s } = secsToHMS(secs);
  const parts = [];
  if (h) parts.push(`${h}시간`);
  if (m) parts.push(`${m}분`);
  if (s) parts.push(`${s}초`);
  return parts.join(" ");
}

function formatCountdown(secs: number) {
  const { h, m, s } = secsToHMS(secs);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// ── 타이머 컴포넌트 ───────────────────────────────────────────────────────────
function CourseTimer({ courseId, totalSeconds, onUnlock }: {
  courseId: number;
  totalSeconds: number;
  onUnlock: () => void;
}) {
  const key = `academy-timer-${courseId}`;

  const getStartedAt = () => {
    const v = localStorage.getItem(key);
    return v ? parseInt(v) : null;
  };

  const calcRemaining = (startedAt: number | null) => {
    if (!startedAt) return totalSeconds;
    return Math.max(0, totalSeconds - Math.floor((Date.now() - startedAt) / 1000));
  };

  const [startedAt, setStartedAt] = useState<number | null>(getStartedAt);
  const [remaining, setRemaining] = useState(() => calcRemaining(getStartedAt()));
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 이미 완료된 경우 즉시 unlock
  useEffect(() => {
    if (startedAt && calcRemaining(startedAt) === 0) {
      onUnlock();
    }
  }, []); // eslint-disable-line

  // 타이머 tick
  useEffect(() => {
    if (!startedAt) return;
    intervalRef.current = setInterval(() => {
      const rem = calcRemaining(startedAt);
      setRemaining(rem);
      if (rem === 0) {
        clearInterval(intervalRef.current!);
        onUnlock();
      }
    }, 500);
    return () => clearInterval(intervalRef.current!);
  }, [startedAt]); // eslint-disable-line

  function start() {
    const now = Date.now();
    localStorage.setItem(key, String(now));
    setStartedAt(now);
    setRemaining(totalSeconds);
  }

  if (!startedAt) {
    return (
      <div className="bg-muted/40 border border-border rounded-xl p-3 space-y-2">
        <div className="flex items-center gap-2">
          <Timer className="h-4 w-4 text-muted-foreground shrink-0" />
          <p className="text-xs text-muted-foreground">타이머 완료 후 완료 버튼이 활성화됩니다</p>
        </div>
        <button
          onClick={start}
          className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground text-xs font-semibold py-2.5 rounded-lg hover:bg-primary/90 transition-colors"
        >
          <Timer className="h-3.5 w-3.5" />
          타이머 시작 ({formatDuration(totalSeconds)})
        </button>
      </div>
    );
  }

  const progress = Math.round(((totalSeconds - remaining) / totalSeconds) * 100);

  return (
    <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Timer className="h-3.5 w-3.5 text-primary" />
          교육 진행 중
        </div>
        <span className="font-mono font-bold text-primary text-base tabular-nums">
          {formatCountdown(remaining)}
        </span>
      </div>
      <div className="h-2 bg-primary/10 rounded-full overflow-hidden">
        <div
          className="h-full bg-primary rounded-full transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className="text-[10px] text-muted-foreground text-center">
        타이머가 완료되면 완료 버튼이 활성화됩니다
      </p>
    </div>
  );
}

// ── 강의 생성/수정 폼 ─────────────────────────────────────────────────────────
function CourseForm({
  initial,
  onSave,
  onCancel,
  saving,
}: {
  initial: typeof EMPTY_FORM;
  onSave: (v: typeof EMPTY_FORM) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [form, setForm] = useState(initial);
  const set = (k: keyof typeof EMPTY_FORM, v: any) => setForm(p => ({ ...p, [k]: v }));

  const { h, m, s } = secsToHMS(form.timerSeconds);

  function setH(val: number) { set("timerSeconds", Math.max(0, val) * 3600 + (form.timerSeconds % 3600)); }
  function setM(val: number) { const clamped = Math.min(59, Math.max(0, val)); set("timerSeconds", Math.floor(form.timerSeconds / 3600) * 3600 + clamped * 60 + (form.timerSeconds % 60)); }
  function setS(val: number) { const clamped = Math.min(59, Math.max(0, val)); set("timerSeconds", Math.floor(form.timerSeconds / 3600) * 3600 + Math.floor((form.timerSeconds % 3600) / 60) * 60 + clamped); }

  return (
    <div className="space-y-4 bg-card border border-border rounded-2xl p-4">
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">제목 *</Label>
        <Input value={form.title} onChange={e => set("title", e.target.value)} placeholder="강의 제목" className="text-sm" />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">설명</Label>
        <textarea
          value={form.description}
          onChange={e => set("description", e.target.value)}
          rows={3}
          placeholder="강의 내용을 간략히 설명하세요..."
          className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">영상 URL</Label>
          <Input value={form.videoUrl} onChange={e => set("videoUrl", e.target.value)} placeholder="https://youtube.com/..." className="text-sm" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">썸네일 URL</Label>
          <Input value={form.thumbnailUrl} onChange={e => set("thumbnailUrl", e.target.value)} placeholder="https://..." className="text-sm" />
        </div>
      </div>

      {/* 강의 유형 */}
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">강의 유형</Label>
        <div className="grid grid-cols-2 gap-2">
          {(["online", "offline"] as CourseType[]).map(type => (
            <button
              key={type}
              type="button"
              onClick={() => set("courseType", type)}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-medium transition-colors ${
                form.courseType === type
                  ? type === "online" ? "bg-blue-50 border-blue-400 text-blue-700" : "bg-orange-50 border-orange-400 text-orange-700"
                  : "bg-background border-border text-muted-foreground"
              }`}
            >
              {type === "online" ? <Wifi className="h-4 w-4" /> : <MapPin className="h-4 w-4" />}
              {type === "online" ? "온라인 강의" : "오프라인 강의"}
            </button>
          ))}
        </div>
      </div>

      {/* 타이머 설정 */}
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
          <Timer className="h-3.5 w-3.5" />
          완료 잠금 타이머 (0이면 타이머 없음)
        </Label>
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "시간", value: h, onChange: (v: number) => setH(v), max: 99 },
            { label: "분",   value: m, onChange: (v: number) => setM(v), max: 59 },
            { label: "초",   value: s, onChange: (v: number) => setS(v), max: 59 },
          ].map(({ label, value, onChange, max }) => (
            <div key={label} className="space-y-1">
              <label className="text-[10px] font-semibold text-muted-foreground block text-center">{label}</label>
              <Input
                type="number"
                min={0}
                max={max}
                value={value}
                onChange={e => onChange(parseInt(e.target.value) || 0)}
                className="text-sm text-center"
              />
            </div>
          ))}
        </div>
        {form.timerSeconds > 0 && (
          <p className="text-xs text-primary font-medium">
            ⏱ {formatDuration(form.timerSeconds)} 타이머 — 시간이 지나야 완료 버튼 활성화
          </p>
        )}
      </div>

      {/* 포인트 지급 */}
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">참여 포인트 지급 (P)</Label>
        <Input
          type="number"
          min={0}
          value={form.pointReward}
          onChange={e => set("pointReward", parseInt(e.target.value) || 0)}
          placeholder="0"
          className="text-sm"
        />
      </div>

      <div className="flex items-center justify-between p-3 bg-accent/30 rounded-xl">
        <div>
          <p className="text-sm font-medium">게시 여부</p>
          <p className="text-xs text-muted-foreground">{form.isPublished ? "STEPER에게 공개됩니다" : "임시저장 (비공개)"}</p>
        </div>
        <button
          type="button"
          onClick={() => set("isPublished", form.isPublished ? 0 : 1)}
          className={`w-12 h-6 rounded-full transition-colors relative ${form.isPublished ? "bg-primary" : "bg-muted"}`}
        >
          <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${form.isPublished ? "left-6" : "left-0.5"}`} />
        </button>
      </div>
      <div className="flex gap-3 pt-1">
        <Button variant="outline" className="flex-1" onClick={onCancel}>취소</Button>
        <Button className="flex-1" disabled={saving || !form.title.trim()} onClick={() => onSave(form)}>
          {saving ? "저장 중..." : "저장"}
        </Button>
      </div>
    </div>
  );
}

// ── 메인 페이지 ───────────────────────────────────────────────────────────────
export default function Academy() {
  const { data: user } = trpc.auth.me.useQuery();
  const utils = trpc.useUtils();
  const isAdmin = user?.role === "admin";

  const { data: courses = [], isLoading } = trpc.academy.list.useQuery();

  const [showCreate, setShowCreate] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  // 타이머 완료 여부 (courseId → true)
  const [timerUnlocked, setTimerUnlocked] = useState<Record<number, boolean>>({});

  // 페이지 로드 시 localStorage에서 이미 완료된 타이머 확인
  useEffect(() => {
    if (!courses.length) return;
    const unlocked: Record<number, boolean> = {};
    (courses as Course[]).forEach(c => {
      if ((c.timerSeconds ?? 0) > 0) {
        const v = localStorage.getItem(`academy-timer-${c.id}`);
        if (v) {
          const elapsed = Math.floor((Date.now() - parseInt(v)) / 1000);
          if (elapsed >= c.timerSeconds) unlocked[c.id] = true;
        }
      }
    });
    setTimerUnlocked(unlocked);
  }, [courses]);

  const createMutation = trpc.academy.create.useMutation({
    onSuccess: () => { utils.academy.list.invalidate(); setShowCreate(false); toast.success("강의가 등록되었습니다"); },
    onError: e => toast.error(e.message),
  });
  const updateMutation = trpc.academy.update.useMutation({
    onSuccess: () => { utils.academy.list.invalidate(); setEditId(null); toast.success("수정되었습니다"); },
    onError: e => toast.error(e.message),
  });
  const deleteMutation = trpc.academy.delete.useMutation({
    onSuccess: () => { utils.academy.list.invalidate(); setConfirmDeleteId(null); toast.success("삭제되었습니다"); },
    onError: e => toast.error(e.message),
  });
  const completeMutation = trpc.academy.complete.useMutation({
    onSuccess: (data) => {
      utils.academy.list.invalidate();
      utils.fitPoints.getBalance.invalidate();
      if (data.pointReward > 0) {
        toast.success(`강의 완료! ${data.pointReward.toLocaleString()}P 지급되었습니다`);
      } else {
        toast.success("강의 완료 처리되었습니다");
      }
    },
    onError: e => toast.error(e.message),
  });

  function buildMutationArgs(v: typeof EMPTY_FORM) {
    return {
      title: v.title,
      description: v.description || undefined,
      videoUrl: v.videoUrl || undefined,
      thumbnailUrl: v.thumbnailUrl || undefined,
      duration: formatDuration(v.timerSeconds) || undefined,
      timerSeconds: v.timerSeconds,
      courseType: v.courseType,
      pointReward: v.pointReward,
      isPublished: v.isPublished,
    };
  }

  return (
    <div className="space-y-5">
      

      {/* 헤더 */}
      <div className="rounded-2xl bg-gradient-to-br from-primary to-primary/70 p-5 text-white space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GraduationCap className="h-6 w-6" />
            <span className="font-bold text-lg">성장 아카데미</span>
          </div>
          {isAdmin && (
            <button
              onClick={() => { setShowCreate(v => !v); setEditId(null); }}
              className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 text-white text-xs font-semibold px-3 py-1.5 rounded-full transition-colors"
            >
              {showCreate ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
              {showCreate ? "취소" : "강의 추가"}
            </button>
          )}
        </div>
        <p className="text-sm text-white/80 leading-relaxed">
          매출을 늘리고 싶은 STEPER를 위한 실전 강의. 상담·브랜딩·PT 프로그래밍까지 배우고 포인트도 받으세요.
        </p>
        <div className="flex items-center gap-4 pt-1">
          <div className="text-center">
            <p className="font-bold text-xl">{(courses as Course[]).filter(c => c.isPublished).length}</p>
            <p className="text-xs text-white/70">강의</p>
          </div>
          <div className="w-px h-8 bg-white/20" />
          <div className="text-center">
            <p className="font-bold text-xl">{(courses as Course[]).filter(c => c.completed).length}</p>
            <p className="text-xs text-white/70">완료</p>
          </div>
          <div className="w-px h-8 bg-white/20" />
          <div className="text-center">
            <p className="font-bold text-xl">
              {(courses as Course[]).reduce((sum, c) => c.completed ? sum + c.pointReward : sum, 0).toLocaleString()}P
            </p>
            <p className="text-xs text-white/70">획득 포인트</p>
          </div>
        </div>
      </div>

      {/* 어드민 강의 생성 폼 */}
      {isAdmin && showCreate && (
        <CourseForm
          initial={EMPTY_FORM}
          saving={createMutation.isPending}
          onCancel={() => setShowCreate(false)}
          onSave={v => createMutation.mutate(buildMutationArgs(v))}
        />
      )}

      {/* 강의 목록 */}
      {isLoading ? (
        <p className="text-sm text-muted-foreground text-center py-10">로딩 중...</p>
      ) : (courses as Course[]).length === 0 ? (
        <div className="text-center py-14 space-y-2">
          <GraduationCap className="h-10 w-10 text-muted-foreground mx-auto opacity-40" />
          <p className="text-sm text-muted-foreground">등록된 강의가 없습니다</p>
          {isAdmin && <p className="text-xs text-muted-foreground">상단 "강의 추가" 버튼으로 첫 강의를 등록하세요</p>}
        </div>
      ) : (
        <div className="space-y-3">
          {(courses as Course[]).map(course => {
            const timerSecs = course.timerSeconds ?? 0;
            const hasTimer = timerSecs > 0;
            const timerDone = timerUnlocked[course.id] ?? false;
            const canComplete = !hasTimer || timerDone;

            return (
              <div key={course.id}>
                {editId === course.id ? (
                  <CourseForm
                    initial={{
                      title: course.title,
                      description: course.description ?? "",
                      videoUrl: course.videoUrl ?? "",
                      thumbnailUrl: course.thumbnailUrl ?? "",
                      timerSeconds: timerSecs,
                      courseType: (course.courseType ?? "online") as CourseType,
                      pointReward: course.pointReward,
                      isPublished: course.isPublished,
                    }}
                    saving={updateMutation.isPending}
                    onCancel={() => setEditId(null)}
                    onSave={v => updateMutation.mutate({ id: course.id, ...buildMutationArgs(v) })}
                  />
                ) : (
                  <Card className={`bg-card border-border overflow-hidden ${!course.isPublished ? "opacity-60" : ""}`}>
                    {/* 썸네일 */}
                    {course.thumbnailUrl ? (
                      <div className="w-full h-44 overflow-hidden bg-muted">
                        <img src={course.thumbnailUrl} alt={course.title} className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className="w-full h-28 bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center">
                        <GraduationCap className="h-10 w-10 text-primary/30" />
                      </div>
                    )}

                    <CardContent className="p-4 space-y-3">
                      {/* 배지 행 */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${
                          course.courseType === "offline" ? "bg-orange-100 text-orange-700" : "bg-blue-100 text-blue-700"
                        }`}>
                          {course.courseType === "offline" ? <MapPin className="h-3 w-3" /> : <Wifi className="h-3 w-3" />}
                          {course.courseType === "offline" ? "오프라인" : "온라인"}
                        </span>
                        {isAdmin && (
                          <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${course.isPublished ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"}`}>
                            {course.isPublished ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                            {course.isPublished ? "게시됨" : "비공개"}
                          </span>
                        )}
                      </div>

                      <div className="space-y-1">
                        <p className="font-bold text-base leading-tight">{course.title}</p>
                        {course.description && (
                          <p className="text-sm text-muted-foreground leading-relaxed">{course.description}</p>
                        )}
                      </div>

                      {/* 메타 정보 */}
                      <div className="flex items-center gap-3 flex-wrap">
                        {hasTimer && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="h-3.5 w-3.5" />
                            {formatDuration(timerSecs)}
                          </div>
                        )}
                        {course.pointReward > 0 && (
                          <div className="flex items-center gap-1 text-xs font-semibold text-amber-600">
                            <Coins className="h-3.5 w-3.5" />
                            완료 시 {course.pointReward.toLocaleString()}P 지급
                          </div>
                        )}
                        {course.completed && (
                          <div className="flex items-center gap-1 text-xs font-semibold text-green-600">
                            <CheckCircle className="h-3.5 w-3.5" />
                            완료
                          </div>
                        )}
                      </div>

                      {/* 액션 */}
                      {isAdmin ? (
                        <div className="flex gap-2 pt-1">
                          <Button size="sm" variant="outline" className="flex-1 gap-1.5" onClick={() => { setEditId(course.id); setShowCreate(false); }}>
                            <Edit2 className="h-3.5 w-3.5" />수정
                          </Button>
                          <Button size="sm" variant="outline" className="flex-1 gap-1.5 text-red-500 border-red-200 hover:bg-red-50"
                            onClick={() => setConfirmDeleteId(course.id)}>
                            <Trash2 className="h-3.5 w-3.5" />삭제
                          </Button>
                        </div>
                      ) : (
                        <div className="space-y-2 pt-1">
                          {/* 영상 보기 */}
                          {course.videoUrl && (
                            <a href={course.videoUrl} target="_blank" rel="noopener noreferrer">
                              <Button size="sm" className="w-full gap-1.5">
                                <Play className="h-3.5 w-3.5" />강의 보기
                              </Button>
                            </a>
                          )}

                          {/* 타이머 (완료 전 + 타이머 설정된 경우) */}
                          {!course.completed && hasTimer && !timerDone && (
                            <CourseTimer
                              courseId={course.id}
                              totalSeconds={timerSecs}
                              onUnlock={() => setTimerUnlocked(p => ({ ...p, [course.id]: true }))}
                            />
                          )}

                          {/* 완료 버튼 또는 완료됨 배지 */}
                          {course.completed ? (
                            <div className="flex items-center justify-center gap-1.5 py-2 rounded-lg bg-green-50 text-green-700 text-sm font-medium">
                              <CheckCircle className="h-4 w-4" />완료됨
                            </div>
                          ) : canComplete ? (
                            <Button
                              size="sm"
                              className="w-full gap-1.5"
                              disabled={completeMutation.isPending}
                              onClick={() => completeMutation.mutate({ courseId: course.id })}
                            >
                              <Check className="h-3.5 w-3.5" />
                              {course.pointReward > 0 ? `교육 완료 +${course.pointReward.toLocaleString()}P` : "교육 완료"}
                            </Button>
                          ) : null}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 삭제 확인 모달 */}
      {confirmDeleteId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setConfirmDeleteId(null)} />
          <div className="relative bg-card rounded-2xl w-full max-w-xs mx-4 p-6 space-y-4 shadow-2xl">
            <p className="font-bold text-base">강의를 삭제하시겠습니까?</p>
            <p className="text-sm text-muted-foreground">삭제된 강의와 완료 기록은 복구되지 않습니다.</p>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setConfirmDeleteId(null)}>취소</Button>
              <Button
                className="flex-1 bg-red-500 hover:bg-red-600"
                disabled={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate({ id: confirmDeleteId })}
              >
                {deleteMutation.isPending ? "삭제 중..." : "삭제"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
