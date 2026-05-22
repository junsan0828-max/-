import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const membershipTypeLabel: Record<string, string> = {
  general: "일반회원",
  premium: "프리미엄",
  vip: "VIP",
};

const membershipTypeColor: Record<string, string> = {
  general: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  premium: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
  vip: "bg-purple-500/10 text-purple-400 border-purple-500/30",
};

const SLEEP_OPTIONS = ["4h↓", "5h", "6h", "7h", "8h", "9h+"];
const ENERGY_OPTIONS = ["낮음", "보통", "높음"];
const CONDITION_LABELS = ["", "매우 피곤", "피곤", "보통", "좋음", "최고"];

const BODY_PARTS = [
  "전신", "상체", "하체",
  "등", "어깨", "가슴",
  "복부", "허리", "코어",
  "엉덩이", "대퇴 후면", "대퇴 전면",
  "하퇴", "이두", "삼두",
  "기타",
];
const WORKOUT_THEMES = ["유산소 위주", "스트레칭 위주", "근력운동"];
const INTENSITY_OPTIONS = ["1", "2", "3", "4", "5"];

function daysUntil(dateStr: string | null | undefined) {
  if (!dateStr) return null;
  const diff = Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
  return diff;
}

function getYoutubeEmbedUrl(url: string): string | null {
  const m = url.match(/(?:(?:www\.|m\.)?youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([^&\n?#]+)/);
  return m ? `https://www.youtube.com/embed/${m[1]}?rel=0` : null;
}

// ── 출석 체크인 모달 ────────────────────────────────────────────────────────────
function CheckInModal({ onClose }: { onClose: () => void }) {
  const [, navigate] = useLocation();
  const [step, setStep] = useState<"form" | "result">("form");
  const [conditionScore, setConditionScore] = useState<number | null>(null);
  const [sleepHours, setSleepHours] = useState("");
  const [energyLevel, setEnergyLevel] = useState("");
  const [selectedBodyParts, setSelectedBodyParts] = useState<string[]>([]);
  const [selectedThemes, setSelectedThemes] = useState<string[]>([]);
  const [intensity, setIntensity] = useState("");
  const [recommendedVideos, setRecommendedVideos] = useState<any[]>([]);
  const [previewVideo, setPreviewVideo] = useState<any | null>(null);

  const checkInMutation = trpc.gymPlus.checkIn.useMutation({
    onSuccess: (data) => {
      setRecommendedVideos(data.recommendedVideos);
      setStep("result");
    },
    onError: (err) => toast.error(err.message),
  });

  function toggleBodyPart(part: string) {
    setSelectedBodyParts(prev =>
      prev.includes(part) ? prev.filter(p => p !== part) : [...prev, part]
    );
  }

  function toggleTheme(theme: string) {
    setSelectedThemes(prev =>
      prev.includes(theme) ? prev.filter(t => t !== theme) : [...prev, theme]
    );
  }

  function handleSubmit() {
    if (!conditionScore || !sleepHours || !energyLevel) {
      toast.error("컨디션, 수면시간, 에너지 레벨을 선택해주세요.");
      return;
    }
    checkInMutation.mutate({
      conditionScore,
      sleepHours,
      energyLevel,
      bodyPartsJson: selectedBodyParts.length > 0 ? JSON.stringify(selectedBodyParts) : undefined,
      workoutTheme: selectedThemes.length > 0 ? JSON.stringify(selectedThemes) : undefined,
      intensity: intensity || undefined,
    });
  }

  const conditionEmoji = ["", "😴", "😔", "😐", "😊", "💪"];

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto">
        {step === "form" ? (
          <>
            <DialogHeader>
              <h2 className="font-bold text-base">출석 체크인</h2>
              <p className="text-xs text-muted-foreground">오늘의 컨디션을 알려주세요</p>
            </DialogHeader>

            {/* 컨디션 점수 */}
            <div className="space-y-2">
              <p className="text-sm font-medium">오늘 컨디션</p>
              <div className="grid grid-cols-5 gap-1.5">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n}
                    className={`flex flex-col items-center py-2 rounded-xl border text-sm transition-colors ${conditionScore === n ? "bg-primary/20 border-primary text-primary" : "border-border text-muted-foreground"}`}
                    onClick={() => setConditionScore(n)}
                  >
                    <span className="text-lg">{conditionEmoji[n]}</span>
                    <span className="text-[10px] mt-0.5">{n}점</span>
                  </button>
                ))}
              </div>
              {conditionScore && (
                <p className="text-xs text-center text-muted-foreground">{CONDITION_LABELS[conditionScore]}</p>
              )}
            </div>

            {/* 수면 시간 */}
            <div className="space-y-2">
              <p className="text-sm font-medium">수면 시간</p>
              <div className="flex gap-1.5">
                {SLEEP_OPTIONS.map((s) => (
                  <button key={s}
                    className={`flex-1 py-2 rounded-xl border text-sm transition-colors ${sleepHours === s ? "bg-primary/20 border-primary text-primary" : "border-border text-muted-foreground"}`}
                    onClick={() => setSleepHours(s)}
                  >{s}</button>
                ))}
              </div>
            </div>

            {/* 에너지 상태 */}
            <div className="space-y-2">
              <p className="text-sm font-medium">에너지 상태</p>
              <div className="grid grid-cols-3 gap-1.5">
                {ENERGY_OPTIONS.map((e) => (
                  <button key={e}
                    className={`py-2 rounded-xl border text-sm transition-colors ${energyLevel === e ? "bg-primary/20 border-primary text-primary" : "border-border text-muted-foreground"}`}
                    onClick={() => setEnergyLevel(e)}
                  >{e}</button>
                ))}
              </div>
            </div>

            {/* 운동 부위 */}
            <div className="space-y-2">
              <p className="text-sm font-medium">오늘의 운동 부위 <span className="text-xs text-muted-foreground font-normal">(중복 선택 가능)</span></p>
              <div className="flex flex-wrap gap-1.5">
                {BODY_PARTS.map((part) => (
                  <button key={part}
                    className={`px-3 py-1.5 rounded-full border text-xs transition-colors ${selectedBodyParts.includes(part) ? "bg-primary/20 border-primary text-primary" : "border-border text-muted-foreground"}`}
                    onClick={() => toggleBodyPart(part)}
                  >{part}</button>
                ))}
              </div>
            </div>

            {/* 운동 주제 */}
            <div className="space-y-2">
              <p className="text-sm font-medium">오늘의 운동 주제 <span className="text-xs text-muted-foreground font-normal">(중복 선택 가능)</span></p>
              <div className="flex flex-wrap gap-1.5">
                {WORKOUT_THEMES.map((theme) => (
                  <button key={theme}
                    className={`px-3 py-1.5 rounded-full border text-sm transition-colors ${selectedThemes.includes(theme) ? "bg-primary/20 border-primary text-primary" : "border-border text-muted-foreground"}`}
                    onClick={() => toggleTheme(theme)}
                  >{theme}</button>
                ))}
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1 h-9" onClick={onClose}>취소</Button>
              <Button className="flex-1 h-9" onClick={handleSubmit} disabled={checkInMutation.isPending}>
                {checkInMutation.isPending ? "저장 중..." : "출석 완료"}
              </Button>
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <h2 className="font-bold text-base">✅ 출석 완료!</h2>
              <p className="text-xs text-muted-foreground">오늘 컨디션 기반 추천 운동 영상이에요</p>
            </DialogHeader>

            {/* 컨디션 요약 */}
            <div className="flex gap-2 flex-wrap">
              <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full">컨디션 {conditionScore}/5</span>
              <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">😴 {sleepHours}</span>
              <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">⚡ {energyLevel}</span>
              {intensity && <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">강도 {intensity}</span>}
              {selectedBodyParts.length > 0 && <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">{selectedBodyParts.slice(0, 3).join(", ")}{selectedBodyParts.length > 3 ? " +" + (selectedBodyParts.length - 3) : ""}</span>}
              {selectedThemes.length > 0 && <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">{selectedThemes.join(", ")}</span>}
            </div>

            {/* 추천 영상 */}
            {recommendedVideos.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">등록된 추천 영상이 없습니다</p>
            ) : (
              <div className="space-y-2">
                {recommendedVideos.map((v) => (
                  <button key={v.id}
                    className="w-full flex items-center gap-3 bg-muted/40 rounded-xl p-3 text-left hover:bg-muted transition-colors"
                    onClick={() => setPreviewVideo(v)}
                  >
                    {v.thumbnailUrl ? (
                      <img src={v.thumbnailUrl} alt={v.title} className="w-16 h-10 object-cover rounded-lg flex-shrink-0" />
                    ) : (
                      <div className="w-16 h-10 bg-muted rounded-lg flex items-center justify-center flex-shrink-0">
                        <span className="text-xl">▶</span>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium line-clamp-2">{v.title}</p>
                      {v.bodyPart && <p className="text-[10px] text-muted-foreground">{v.bodyPart}</p>}
                    </div>
                  </button>
                ))}
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1 h-9 text-sm" onClick={onClose}>닫기</Button>
              <Button className="flex-1 h-9 text-sm" onClick={() => { onClose(); navigate("/gym-plus/videos"); }}>
                전체 영상 보기
              </Button>
            </div>

            {/* 영상 미리보기 모달 */}
            {previewVideo && (
              <Dialog open onOpenChange={(o) => { if (!o) setPreviewVideo(null); }}>
                <DialogContent className="max-w-sm p-0 overflow-hidden">
                  <div className="w-full bg-black aspect-video">
                    {(() => {
                      const embedUrl = getYoutubeEmbedUrl(previewVideo.videoUrl);
                      return embedUrl ? (
                        <iframe src={embedUrl} className="w-full h-full" allowFullScreen
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" />
                      ) : (
                        <video src={previewVideo.videoUrl} controls className="w-full h-full" playsInline />
                      );
                    })()}
                  </div>
                  <div className="p-3 space-y-2">
                    <p className="text-sm font-medium">{previewVideo.title}</p>
                    <Button variant="outline" size="sm" className="w-full h-8 text-xs" onClick={() => setPreviewVideo(null)}>닫기</Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── 메인 대시보드 ───────────────────────────────────────────────────────────────
export default function GymPlusDashboard() {
  const [, navigate] = useLocation();
  const [showCheckIn, setShowCheckIn] = useState(false);
  const [showWorkoutChoice, setShowWorkoutChoice] = useState(false);
  const { data: member } = trpc.gymPlus.memberMe.useQuery();
  const { data: events } = trpc.gymPlus.listEvents.useQuery({});
  const { data: logs, refetch: refetchLogs } = trpc.gymPlus.listWorkoutLogs.useQuery({});
  const { data: todayRec, refetch: refetchRec } = trpc.gymPlus.getTodayRecommendations.useQuery();
  const { data: health } = trpc.gymPlus.getHealth.useQuery();

  const today = new Date().toISOString().slice(0, 10);
  const todayLog = logs?.find((l) => l.logDate === today && l.title !== "출석체크");
  const todayCheckedIn = logs?.some((l) => l.logDate === today && l.title === "출석체크");
  const daysLeft = daysUntil(member?.membershipEnd);
  const latestEvents = events?.slice(0, 3) ?? [];

  const workoutLogs = (logs ?? []).filter(l => l.title !== "출석체크");
  const allMissionsDone = !!(health?.height && health?.weight && health?.parqSubmittedAt && health?.bodyAnalysisRequested);
  const hasRec = allMissionsDone && todayCheckedIn && todayRec && todayRec.recommendedVideos.length > 0;
  const canRepeat = workoutLogs.length >= 10;

  return (
    <div className="p-4 space-y-4">

      {/* 이벤트/공지 */}
      {latestEvents.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="font-semibold text-sm">이벤트 & 공지</p>
            <button className="text-xs text-primary" onClick={() => navigate("/gym-plus/events")}>전체보기 →</button>
          </div>
          <div className="space-y-2">
            {latestEvents.map((e) => (
              <div key={e.id}
                className="rounded-xl overflow-hidden cursor-pointer border border-border hover:border-primary/50 transition-colors"
                onClick={() => navigate(`/gym-plus/events/${e.id}`)}
              >
                {e.imageUrl && <img src={e.imageUrl} alt={e.title} className="w-full object-cover max-h-40" />}
                <div className={`p-3 flex items-center gap-3 ${e.isPinned ? "bg-yellow-500/10" : "bg-card"}`}>
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-sm ${
                    e.eventType === "event" ? "bg-green-500/20" :
                    e.eventType === "promotion" ? "bg-orange-500/20" : "bg-blue-500/20"
                  }`}>
                    {e.eventType === "event" ? "🎉" : e.eventType === "promotion" ? "🎁" : "📢"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      {e.isPinned ? <span className="text-[9px] bg-yellow-500/20 text-yellow-400 px-1 rounded">고정</span> : null}
                      <p className="text-sm font-medium line-clamp-1">{e.title}</p>
                    </div>
                    <p className="text-[10px] text-muted-foreground">{e.createdAt?.slice(0, 10)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 인사 카드 (출석 버튼 제거) */}
      <div className="bg-gradient-to-r from-primary/20 to-primary/5 rounded-2xl p-4 border border-primary/20">
        <p className="text-muted-foreground text-xs mb-0.5">안녕하세요 👋</p>
        <p className="font-bold text-lg text-foreground">{member?.name ?? "회원"}님</p>
        {daysLeft !== null && (
          <p className={`text-xs mt-1 ${daysLeft <= 7 ? "text-red-400" : "text-muted-foreground"}`}>
            회원권 {daysLeft > 0 ? `D-${daysLeft}` : daysLeft === 0 ? "오늘 만료" : "만료됨"}
          </p>
        )}
      </div>

      {/* 오늘의 운동 — 프리미엄 카드 */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="font-semibold text-sm">오늘의 운동</p>
          {todayLog && <button className="text-xs text-primary" onClick={() => navigate("/gym-plus/workout")}>기록 보기 →</button>}
        </div>
        {todayLog ? (
          <div
            className="relative overflow-hidden bg-gradient-to-br from-primary/25 via-primary/10 to-transparent rounded-2xl border border-primary/30 p-5 cursor-pointer hover:border-primary/60 transition-colors"
            onClick={() => navigate("/gym-plus/workout")}
          >
            <div className="absolute top-0 right-0 w-24 h-24 bg-primary/10 rounded-full -translate-y-8 translate-x-8" />
            <p className="text-[10px] text-primary/80 font-semibold tracking-widest uppercase mb-1">Today's Workout</p>
            <p className="font-bold text-xl text-foreground mb-3">{todayLog.title || "오늘 운동 완료 💪"}</p>
            <div className="flex gap-4">
              {todayLog.durationMinutes ? (
                <div>
                  <p className="text-[10px] text-muted-foreground">운동 시간</p>
                  <p className="text-base font-bold text-primary">⏱ {todayLog.durationMinutes}분</p>
                </div>
              ) : null}
              {todayLog.caloriesBurned ? (
                <div>
                  <p className="text-[10px] text-muted-foreground">소모 칼로리</p>
                  <p className="text-base font-bold text-orange-400">🔥 {todayLog.caloriesBurned}kcal</p>
                </div>
              ) : null}
              {!todayLog.durationMinutes && !todayLog.caloriesBurned && (
                <p className="text-xs text-muted-foreground">운동 시작 버튼을 눌러 운동을 기록하세요</p>
              )}
            </div>
          </div>
        ) : (
          <button
            className="w-full relative overflow-hidden bg-gradient-to-br from-primary/15 via-primary/5 to-transparent border-2 border-dashed border-primary/30 rounded-2xl py-10 flex flex-col items-center gap-3 hover:border-primary/60 hover:from-primary/20 transition-all cursor-pointer"
            onClick={() => setShowWorkoutChoice(true)}
          >
            <div className="w-14 h-14 rounded-2xl bg-primary/20 border border-primary/30 flex items-center justify-center">
              <span className="text-2xl font-light text-primary">+</span>
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-foreground">오늘 운동 시작하기</p>
              <p className="text-xs text-muted-foreground mt-0.5">탭하여 운동 유형을 선택하세요</p>
            </div>
          </button>
        )}
      </div>

      {/* 운동 선택 모달 */}
      {showWorkoutChoice && (
        <Dialog open onOpenChange={(o) => { if (!o) setShowWorkoutChoice(false); }}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <h2 className="font-bold text-base">어떤 운동을 할까요?</h2>
              <p className="text-xs text-muted-foreground">운동 유형을 선택하세요</p>
            </DialogHeader>
            <div className="space-y-3 pt-1">

              {/* 새로운 운동 — 항상 활성 */}
              <button
                className="w-full flex items-center gap-4 p-4 rounded-xl border border-border bg-card hover:border-primary/50 transition-colors text-left"
                onClick={() => { setShowWorkoutChoice(false); navigate("/gym-plus/workout"); }}
              >
                <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center flex-shrink-0 text-xl">🆕</div>
                <div>
                  <p className="font-semibold text-sm">새로운 운동</p>
                  <p className="text-xs text-muted-foreground mt-0.5">직접 종목을 입력하고 운동 계획 작성</p>
                </div>
              </button>

              {/* 추천 운동 — 출석체크 후 추천이 있을 때 활성 */}
              <button
                disabled={!hasRec}
                className={`w-full flex items-center gap-4 p-4 rounded-xl border transition-colors text-left ${
                  hasRec
                    ? "border-border bg-card hover:border-primary/50 cursor-pointer"
                    : "border-border/40 bg-muted/20 cursor-not-allowed opacity-50"
                }`}
                onClick={() => { if (hasRec) { setShowWorkoutChoice(false); navigate("/gym-plus/videos"); } }}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-xl ${hasRec ? "bg-yellow-500/20" : "bg-muted"}`}>⭐</div>
                <div className="flex-1">
                  <p className="font-semibold text-sm">추천 운동</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {hasRec ? "오늘 맞춤 추천 운동 영상이 준비됐어요" : !allMissionsDone ? "내 정보 탭에서 미션 3가지를 완료하세요" : "출석체크 완료 후 활성화됩니다"}
                  </p>
                </div>
                {!hasRec && <span className="text-[10px] bg-muted text-muted-foreground px-2 py-0.5 rounded-full flex-shrink-0">잠금</span>}
              </button>

              {/* 이전 운동 — 운동 기록 10개 이상일 때 활성 */}
              <button
                disabled={!canRepeat}
                className={`w-full flex items-center gap-4 p-4 rounded-xl border transition-colors text-left ${
                  canRepeat
                    ? "border-border bg-card hover:border-primary/50 cursor-pointer"
                    : "border-border/40 bg-muted/20 cursor-not-allowed opacity-50"
                }`}
                onClick={() => { if (canRepeat) { setShowWorkoutChoice(false); navigate("/gym-plus/workout?tab=history"); } }}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-xl ${canRepeat ? "bg-blue-500/20" : "bg-muted"}`}>🔄</div>
                <div className="flex-1">
                  <p className="font-semibold text-sm">이전 운동</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {canRepeat ? "이전에 했던 운동을 다시 시작" : `운동 기록 ${workoutLogs.length}/10개 이상이면 활성화`}
                  </p>
                </div>
                {!canRepeat && <span className="text-[10px] bg-muted text-muted-foreground px-2 py-0.5 rounded-full flex-shrink-0">{workoutLogs.length}/10</span>}
              </button>

            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* 출석하기 / 추천운동 카드 */}
      {!todayCheckedIn ? (
        <button
          className="w-full bg-gradient-to-r from-primary to-primary/70 rounded-2xl p-5 flex items-center gap-4 text-left hover:opacity-90 transition-opacity"
          onClick={() => setShowCheckIn(true)}
        >
          <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0 text-2xl">👋</div>
          <div className="flex-1">
            <p className="font-bold text-base text-white">출석하기</p>
            <p className="text-xs text-white/70 mt-0.5">오늘의 컨디션을 체크하고 맞춤 운동을 받아보세요</p>
          </div>
          <span className="text-white/60 text-lg">→</span>
        </button>
      ) : todayRec && todayRec.recommendedVideos.length > 0 ? (
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="font-semibold text-sm">오늘의 추천 운동</p>
            <button className="text-xs text-primary" onClick={() => navigate("/gym-plus/videos")}>전체보기 →</button>
          </div>
          <div className="space-y-2">
            {todayRec.recommendedVideos.map((v: any) => (
              <div key={v.id}
                className="bg-card border border-border rounded-xl overflow-hidden cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => navigate(`/gym-plus/videos/${v.id}`)}
              >
                <div className="flex items-center gap-3 p-3">
                  {v.thumbnailUrl ? (
                    <img src={v.thumbnailUrl} alt={v.title} className="w-20 h-12 object-cover rounded-lg flex-shrink-0" />
                  ) : (
                    <div className="w-20 h-12 bg-muted rounded-lg flex items-center justify-center flex-shrink-0">
                      <span className="text-xl">▶</span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium line-clamp-2">{v.title}</p>
                    <div className="flex gap-1 mt-1 flex-wrap">
                      {v.bodyPart && <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">{v.bodyPart}</span>}
                      {v.level && <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">{v.level}</span>}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-green-500/10 border border-green-500/30 rounded-2xl p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center flex-shrink-0 text-2xl">✅</div>
          <div>
            <p className="font-bold text-base text-green-400">출석 완료!</p>
            <p className="text-xs text-muted-foreground mt-0.5">오늘 출석이 완료되었습니다</p>
          </div>
        </div>
      )}

      {/* 출석 체크인 모달 */}
      {showCheckIn && <CheckInModal onClose={() => { setShowCheckIn(false); refetchLogs(); refetchRec(); }} />}
    </div>
  );
}
