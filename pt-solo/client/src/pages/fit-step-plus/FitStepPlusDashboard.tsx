import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { ChevronRight } from "lucide-react";

const CONDITION_EMOJI = ["😴", "😑", "😐", "☺️", "💪"];
const SLEEP_OPTIONS = ["4h↓", "5h", "6h", "7h", "8h", "9h+"];
const ENERGY_OPTIONS = ["높음", "보통", "낮음"];
const BODY_PARTS = ["전신", "상체", "하체", "등", "어깨", "가슴", "복부", "허리", "코어", "엉덩이", "대퇴 후면", "대퇴 전면", "하퇴", "이두", "삼두", "기타"];
const WORKOUT_THEMES = ["유산소 위주", "스트레칭 위주", "근력운동"];

function CheckInModal({ onClose, onSubmit, isPending }: {
  onClose: () => void;
  onSubmit: (data: { conditionScore?: number; sleepHours?: string; energyLevel?: string; bodyParts?: string[]; workoutTheme?: string[]; intensity?: number }) => void;
  isPending: boolean;
}) {
  const [conditionScore, setConditionScore] = useState<number | undefined>();
  const [sleepHours, setSleepHours] = useState<string | undefined>();
  const [energyLevel, setEnergyLevel] = useState<string | undefined>();
  const [bodyParts, setBodyParts] = useState<string[]>([]);
  const [workoutTheme, setWorkoutTheme] = useState<string[]>([]);
  const [intensity, setIntensity] = useState<number | undefined>();

  function toggleArr<T>(arr: T[], val: T): T[] {
    return arr.includes(val) ? arr.filter((v) => v !== val) : [...arr, val];
  }

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-end justify-center" onClick={onClose}>
      <div className="bg-background w-full max-w-md rounded-t-3xl p-5 pb-8 max-h-[92vh] overflow-y-auto space-y-5"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-bold text-lg">출석 체크인</h2>
            <p className="text-xs text-muted-foreground mt-0.5">오늘의 컨디션을 알려주세요</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground text-xl leading-none">✕</button>
        </div>
        <div>
          <p className="text-sm font-semibold mb-2">오늘 컨디션</p>
          <div className="grid grid-cols-5 gap-2">
            {CONDITION_EMOJI.map((emoji, i) => (
              <button key={i} onClick={() => setConditionScore(i + 1)}
                className={`flex flex-col items-center gap-1 py-3 rounded-2xl border text-xl transition-colors ${conditionScore === i + 1 ? "border-primary bg-primary/10" : "border-border bg-muted/30"}`}>
                {emoji}
                <span className="text-[10px] text-muted-foreground">{i + 1}점</span>
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-sm font-semibold mb-2">수면 시간</p>
          <div className="grid grid-cols-3 gap-2">
            {SLEEP_OPTIONS.map((h) => (
              <button key={h} onClick={() => setSleepHours(sleepHours === h ? undefined : h)}
                className={`py-2.5 rounded-2xl border text-sm font-medium transition-colors ${sleepHours === h ? "border-primary bg-primary/10 text-primary" : "border-border bg-muted/30 text-foreground"}`}>
                {h}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-sm font-semibold mb-2">에너지 레벨</p>
          <div className="grid grid-cols-3 gap-2">
            {ENERGY_OPTIONS.map((e) => (
              <button key={e} onClick={() => setEnergyLevel(energyLevel === e ? undefined : e)}
                className={`py-2.5 rounded-2xl border text-sm font-medium transition-colors ${energyLevel === e ? "border-primary bg-primary/10 text-primary" : "border-border bg-muted/30 text-foreground"}`}>
                {e}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-sm font-semibold mb-2">오늘의 운동 부위 <span className="text-xs text-muted-foreground font-normal">(중복 선택 가능)</span></p>
          <div className="flex flex-wrap gap-2">
            {BODY_PARTS.map((p) => (
              <button key={p} onClick={() => setBodyParts((prev) => toggleArr(prev, p))}
                className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-colors ${bodyParts.includes(p) ? "border-primary bg-primary/10 text-primary" : "border-border bg-muted/30 text-foreground"}`}>
                {p}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-sm font-semibold mb-2">오늘의 운동 주제 <span className="text-xs text-muted-foreground font-normal">(중복 선택 가능)</span></p>
          <div className="flex flex-wrap gap-2">
            {WORKOUT_THEMES.map((t) => (
              <button key={t} onClick={() => setWorkoutTheme((prev) => toggleArr(prev, t))}
                className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-colors ${workoutTheme.includes(t) ? "border-primary bg-primary/10 text-primary" : "border-border bg-muted/30 text-foreground"}`}>
                {t}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-sm font-semibold mb-2">운동 강도</p>
          <div className="grid grid-cols-5 gap-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} onClick={() => setIntensity(intensity === n ? undefined : n)}
                className={`py-2.5 rounded-2xl border text-sm font-bold transition-colors ${intensity === n ? "border-primary bg-primary/10 text-primary" : "border-border bg-muted/30 text-foreground"}`}>
                {n}
              </button>
            ))}
          </div>
        </div>
        <button
          onClick={() => onSubmit({ conditionScore, sleepHours, energyLevel, bodyParts: bodyParts.length ? bodyParts : undefined, workoutTheme: workoutTheme.length ? workoutTheme : undefined, intensity })}
          disabled={isPending}
          className="w-full bg-primary text-primary-foreground font-bold py-3.5 rounded-2xl text-base active:scale-95 transition-transform disabled:opacity-60">
          {isPending ? "체크인 중..." : "출석 완료 ✅"}
        </button>
      </div>
    </div>
  );
}

function daysUntil(dateStr: string | null | undefined) {
  if (!dateStr) return null;
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
}

export default function FitStepPlusDashboard({ trainerId }: { trainerId: number }) {
  const [, navigate] = useLocation();
  const [showCheckIn, setShowCheckIn] = useState(false);
  const base = `/fit-step-plus/${trainerId}`;
  const utils = trpc.useUtils();
  const { data: member } = trpc.fitStepPlus.memberMe.useQuery();
  const { data: events } = trpc.fitStepPlus.listEvents.useQuery({ trainerId });
  const { data: logs } = trpc.fitStepPlus.listWorkoutLogs.useQuery({});

  const today = new Date().toISOString().slice(0, 10);
  const thisMonth = today.slice(0, 7);
  const { data: attendance } = trpc.fitStepPlus.member_getAttendance.useQuery({ month: thisMonth });
  const checkedInToday = attendance?.includes(today) ?? false;

  const checkInMutation = trpc.fitStepPlus.member_checkIn.useMutation({
    onSuccess: () => {
      toast.success("출석 체크 완료! 오늘도 화이팅 💪");
      utils.fitStepPlus.member_getAttendance.invalidate();
      setShowCheckIn(false);
    },
    onError: (err) => {
      if (err.data?.code === "CONFLICT") { toast.info("오늘 이미 출석 체크했습니다."); setShowCheckIn(false); }
      else toast.error(err.message || "출석 체크 실패");
    },
  });

  const todayLog = logs?.find((l) => l.logDate === today);
  const daysLeft = daysUntil(member?.membershipEnd);
  const latestEvents = (events ?? []).slice(0, 3);

  // 만료 30일 이내 재등록 안내 표시 여부
  const showRenewalPromo = daysLeft !== null && daysLeft <= 30 && daysLeft > 0;

  return (
    <div className="p-4 space-y-3 pb-8">
      {showCheckIn && (
        <CheckInModal
          onClose={() => setShowCheckIn(false)}
          onSubmit={(data) => checkInMutation.mutate(data)}
          isPending={checkInMutation.isPending}
        />
      )}

      {/* ① 이벤트 & 공지 */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="font-semibold text-sm">이벤트 &amp; 공지</p>
          <button className="text-xs text-primary flex items-center gap-0.5" onClick={() => navigate(`${base}/events`)}>
            전체보기 <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
        {latestEvents.length === 0 ? (
          <div className="bg-card border border-border rounded-2xl p-4 text-center">
            <p className="text-sm text-muted-foreground">등록된 이벤트가 없습니다</p>
          </div>
        ) : (
          <div className="space-y-2">
            {latestEvents.map((e) => (
              <button
                key={e.id}
                className="w-full bg-card border border-border rounded-2xl px-4 py-3 flex items-center gap-3 text-left hover:border-primary/40 transition-colors"
                onClick={() => navigate(`${base}/events/${e.id}`)}
              >
                <span className="text-lg shrink-0">
                  {e.eventType === "event" ? "🎉" : e.eventType === "promotion" ? "🎁" : "📢"}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium line-clamp-1">{e.title}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{e.createdAt?.slice(0, 10)}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ② 이름 카드 */}
      <div className="bg-[#1a2236] rounded-2xl px-5 py-4">
        <p className="text-blue-300 text-sm mb-1">안녕하세요 👋</p>
        <p className="text-white font-bold text-xl">{member?.name ?? "회원"}님</p>
      </div>

      {/* ③ 회원권 남은 기간 카드 */}
      {daysLeft !== null && (
        <button
          className={`w-full rounded-2xl px-5 py-4 flex items-center justify-between text-left active:scale-[0.99] transition-transform ${
            daysLeft <= 7
              ? "bg-red-900/60 border border-red-500/40"
              : "bg-[#1a3a2a] border border-green-800/40"
          }`}
          onClick={() => navigate(`${base}/membership`)}
        >
          <div>
            <p className="text-xs text-green-300/80 mb-1">회원권 남은 기간</p>
            <p className={`font-black text-3xl ${daysLeft <= 7 ? "text-red-300" : "text-green-300"}`}>
              {daysLeft > 0 ? `D-${daysLeft}` : daysLeft === 0 ? "오늘 만료" : "만료됨"}
            </p>
          </div>
          {showRenewalPromo && (
            <div className="text-right">
              <p className="text-yellow-300 text-sm font-bold">🎁 2주 서비스 혜택</p>
              <p className="text-[11px] text-yellow-200/70 mt-0.5">만료 1개월 전 등록 시</p>
              <p className="text-[11px] text-primary mt-0.5 font-medium">탭하여 재등록 신청 →</p>
            </div>
          )}
        </button>
      )}

      {/* ④ 오늘의 운동 기록 */}
      <button
        className="w-full bg-[#1a2236] border-2 border-dashed border-blue-800/60 rounded-2xl p-6 flex flex-col items-center justify-center gap-3 active:scale-[0.99] transition-transform"
        onClick={() => navigate(`${base}/workout`)}
      >
        {todayLog ? (
          <>
            <div className="w-12 h-12 rounded-full bg-green-500/20 border border-green-500/40 flex items-center justify-center text-2xl">✅</div>
            <div className="text-center">
              <p className="text-white font-semibold">{todayLog.title || "오늘 운동 완료"}</p>
              <p className="text-sm text-muted-foreground mt-1">
                {todayLog.durationMinutes ? `${todayLog.durationMinutes}분` : ""}
                {todayLog.durationMinutes && todayLog.caloriesBurned ? " · " : ""}
                {todayLog.caloriesBurned ? `${todayLog.caloriesBurned}kcal` : ""}
              </p>
            </div>
          </>
        ) : (
          <>
            <div className="w-12 h-12 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center">
              <span className="text-primary text-2xl font-light">+</span>
            </div>
            <div className="text-center">
              <p className="text-white font-semibold">오늘 운동 시작하기</p>
              <p className="text-sm text-muted-foreground mt-1">탭하여 운동 유형을 선택하세요</p>
            </div>
          </>
        )}
      </button>

      {/* ⑤ 출석하기 버튼 */}
      {checkedInToday ? (
        <div className="w-full bg-green-500/15 border border-green-500/30 rounded-2xl px-5 py-4 flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-green-500/20 flex items-center justify-center text-2xl shrink-0">✅</div>
          <div className="flex-1">
            <p className="font-bold text-green-400">오늘 출석 완료!</p>
            <p className="text-xs text-muted-foreground mt-0.5">내일도 함께해요 💪</p>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowCheckIn(true)}
          className="w-full bg-primary rounded-2xl px-5 py-4 flex items-center gap-4 active:scale-[0.99] transition-transform"
        >
          <div className="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center text-2xl shrink-0">👋</div>
          <div className="flex-1 text-left">
            <p className="font-bold text-primary-foreground">출석하기</p>
            <p className="text-xs text-primary-foreground/70 mt-0.5">오늘의 컨디션을 체크하고 맞춤 운동을 받아보세요</p>
          </div>
          <ChevronRight className="w-5 h-5 text-primary-foreground/70 shrink-0" />
        </button>
      )}
    </div>
  );
}
