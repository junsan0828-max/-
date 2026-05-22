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
const ENERGY_OPTIONS = ["높음", "보통", "낮음"];
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
              <div className="grid grid-cols-3 gap-1.5">
                {SLEEP_OPTIONS.map((s) => (
                  <button key={s}
                    className={`py-2 rounded-xl border text-sm transition-colors ${sleepHours === s ? "bg-primary/20 border-primary text-primary" : "border-border text-muted-foreground"}`}
                    onClick={() => setSleepHours(s)}
                  >{s}</button>
                ))}
              </div>
            </div>

            {/* 에너지 레벨 */}
            <div className="space-y-2">
              <p className="text-sm font-medium">에너지 레벨</p>
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

            {/* 강도 */}
            <div className="space-y-2">
              <p className="text-sm font-medium">운동 강도</p>
              <div className="grid grid-cols-5 gap-1.5">
                {INTENSITY_OPTIONS.map((opt) => (
                  <button key={opt}
                    className={`py-2 rounded-xl border text-sm font-medium transition-colors ${intensity === opt ? "bg-primary/20 border-primary text-primary" : "border-border text-muted-foreground"}`}
                    onClick={() => setIntensity(opt)}
                  >{opt}</button>
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
  const { data: member } = trpc.gymPlus.memberMe.useQuery();
  const { data: events } = trpc.gymPlus.listEvents.useQuery({});
  const { data: categories } = trpc.gymPlus.listCategories.useQuery();
  const { data: allVideos } = trpc.gymPlus.listVideos.useQuery({});
  const { data: logs, refetch: refetchLogs } = trpc.gymPlus.listWorkoutLogs.useQuery({});
  const { data: todayRec, refetch: refetchRec } = trpc.gymPlus.getTodayRecommendations.useQuery();

  const today = new Date().toISOString().slice(0, 10);
  const todayLog = logs?.find((l) => l.logDate === today && l.title !== "출석체크");
  const todayCheckedIn = logs?.some((l) => l.logDate === today && l.title === "출석체크");
  const daysLeft = daysUntil(member?.membershipEnd);
  const latestEvents = events?.slice(0, 3) ?? [];

  const equipmentCategory = categories?.find(c => c.name.includes("기구"));
  const equipmentVideos = equipmentCategory
    ? (allVideos ?? []).filter(v => v.categoryId === equipmentCategory.id).slice(0, 4)
    : (allVideos ?? []).slice(0, 4);

  return (
    <div className="p-4 space-y-5">

      {/* 이벤트/공지 최상단 배너 */}
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
                {e.imageUrl && (
                  <img src={e.imageUrl} alt={e.title} className="w-full object-cover max-h-40" />
                )}
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

      {/* 회원 인사 + 출석 버튼 */}
      <div className="bg-gradient-to-r from-primary/20 to-primary/5 rounded-2xl p-4 border border-primary/20">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-muted-foreground text-xs mb-1">안녕하세요 👋</p>
            <p className="font-bold text-lg text-foreground">{member?.name ?? "회원"}님</p>
            {member?.membershipType && (
              <span className={`inline-block mt-2 text-xs px-2 py-0.5 rounded-full border ${membershipTypeColor[member.membershipType] ?? ""}`}>
                {membershipTypeLabel[member.membershipType] ?? member.membershipType}
              </span>
            )}
          </div>
          <button
            onClick={() => setShowCheckIn(true)}
            className={`flex flex-col items-center justify-center px-3 py-2 rounded-xl border text-xs font-medium transition-colors flex-shrink-0 ${
              todayCheckedIn
                ? "bg-green-500/20 border-green-500/40 text-green-400"
                : "bg-primary text-primary-foreground border-primary"
            }`}
          >
            <span className="text-lg mb-0.5">{todayCheckedIn ? "✅" : "👋"}</span>
            <span>{todayCheckedIn ? "출석완료" : "출석하기"}</span>
          </button>
        </div>
      </div>

      {/* 회원권 D-day */}
      {daysLeft !== null && (
        <div
          className={`rounded-xl p-4 border flex items-center justify-between cursor-pointer ${
            daysLeft <= 7 ? "bg-red-500/10 border-red-500/30" : "bg-card border-border"
          }`}
          onClick={() => navigate("/gym-plus/membership")}
        >
          <div>
            <p className="text-xs text-muted-foreground">회원권 만료까지</p>
            <p className={`font-bold text-xl ${daysLeft <= 7 ? "text-red-400" : "text-foreground"}`}>
              {daysLeft > 0 ? `D-${daysLeft}` : daysLeft === 0 ? "오늘 만료" : "만료됨"}
            </p>
          </div>
          <span className="text-2xl">◈</span>
        </div>
      )}

      {/* 오늘의 추천 운동 */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="font-semibold text-sm">오늘의 추천 운동</p>
          {todayRec && todayRec.recommendedVideos.length > 0 && (
            <button className="text-xs text-primary" onClick={() => navigate("/gym-plus/videos")}>전체보기 →</button>
          )}
        </div>
        {todayRec && todayRec.recommendedVideos.length > 0 ? (
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
        ) : (
          <div
            className="bg-card border border-dashed border-border rounded-xl p-4 flex items-center gap-3 cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => setShowCheckIn(true)}
          >
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <span className="text-xl">🎯</span>
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">출석체크 후 추천 운동을 확인하세요</p>
              <p className="text-xs text-muted-foreground mt-0.5">오늘의 컨디션과 운동 부위를 입력하면<br />맞춤 운동 영상 3개를 추천해 드려요</p>
            </div>
          </div>
        )}
      </div>

      {/* 오늘 운동 */}
      <div
        className="bg-card rounded-xl p-4 border border-border cursor-pointer hover:border-primary/50 transition-colors"
        onClick={() => navigate("/gym-plus/workout")}
      >
        <div className="flex items-center justify-between mb-2">
          <p className="font-semibold text-sm">오늘의 운동</p>
          <span className="text-xs text-primary">기록하기 →</span>
        </div>
        {todayLog ? (
          <div>
            <p className="font-medium text-foreground">{todayLog.title || "운동 완료"}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {todayLog.durationMinutes ? `${todayLog.durationMinutes}분` : ""}
              {todayLog.durationMinutes && todayLog.caloriesBurned ? " · " : ""}
              {todayLog.caloriesBurned ? `${todayLog.caloriesBurned}kcal` : ""}
            </p>
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">아직 오늘 운동 기록이 없어요</p>
        )}
      </div>

      {/* 출석 체크인 모달 */}
      {showCheckIn && <CheckInModal onClose={() => { setShowCheckIn(false); refetchLogs(); refetchRec(); }} />}
    </div>
  );
}
