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

const BODY_PART_GROUPS = [
  { key: "전신", label: "전신", sub: [] },
  { key: "상체", label: "상체", sub: ["등", "어깨", "가슴", "팔"] },
  { key: "하체", label: "하체", sub: ["엉덩이", "대퇴 후면", "대퇴 전면", "하퇴"] },
  { key: "코어", label: "코어", sub: [] },
];
const WORKOUT_THEMES = ["유산소 위주", "스트레칭 위주", "근력운동"];
const INTENSITY_OPTIONS = ["1", "2", "3", "4", "5"];

function daysUntil(dateStr: string | null | undefined) {
  if (!dateStr) return null;
  const diff = Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
  return diff;
}

function getRenewalBonus(days: number | null) {
  if (days === null) return null;
  if (days >= 30) return { days: 14, label: "2주 서비스 혜택", desc: "만료 1개월 전 등록 시", color: "text-green-400" };
  if (days >= 5) return { days: 7, label: "7일 서비스 혜택", desc: "만료 1개월 이내 등록 시", color: "text-blue-400" };
  if (days >= 0) return { days: 3, label: "3일 서비스 혜택", desc: "만료 5일 전 등록 시", color: "text-yellow-400" };
  return null;
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

  const conditionDots = ["", "●", "●●", "●●●", "●●●●", "●●●●●"];

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
                    <span className="text-[10px] tracking-tighter text-primary/70">{conditionDots[n]}</span>
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
              {/* 대분류 */}
              <div className="grid grid-cols-4 gap-1.5">
                {BODY_PART_GROUPS.map((g) => (
                  <button key={g.key}
                    className={`py-2 rounded-xl border text-xs font-medium transition-colors ${selectedBodyParts.includes(g.key) ? "bg-primary/20 border-primary text-primary" : "border-border text-muted-foreground"}`}
                    onClick={() => toggleBodyPart(g.key)}
                  >{g.label}</button>
                ))}
              </div>
              {/* 상체 소분류 */}
              {selectedBodyParts.includes("상체") && (
                <div className="pl-2 border-l-2 border-primary/30 space-y-1">
                  <p className="text-[10px] text-muted-foreground">상체 세부 부위</p>
                  <div className="flex flex-wrap gap-1.5">
                    {BODY_PART_GROUPS[1].sub.map((s) => (
                      <button key={s}
                        className={`px-3 py-1.5 rounded-full border text-xs transition-colors ${selectedBodyParts.includes(s) ? "bg-primary/20 border-primary text-primary" : "border-border text-muted-foreground"}`}
                        onClick={() => toggleBodyPart(s)}
                      >{s}</button>
                    ))}
                  </div>
                </div>
              )}
              {/* 하체 소분류 */}
              {selectedBodyParts.includes("하체") && (
                <div className="pl-2 border-l-2 border-primary/30 space-y-1">
                  <p className="text-[10px] text-muted-foreground">하체 세부 부위</p>
                  <div className="flex flex-wrap gap-1.5">
                    {BODY_PART_GROUPS[2].sub.map((s) => (
                      <button key={s}
                        className={`px-3 py-1.5 rounded-full border text-xs transition-colors ${selectedBodyParts.includes(s) ? "bg-primary/20 border-primary text-primary" : "border-border text-muted-foreground"}`}
                        onClick={() => toggleBodyPart(s)}
                      >{s}</button>
                    ))}
                  </div>
                </div>
              )}
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
              <h2 className="font-bold text-base">출석 완료</h2>
              <p className="text-xs text-muted-foreground">오늘 컨디션 기반 추천 운동 영상이에요</p>
            </DialogHeader>

            {/* 컨디션 요약 */}
            <div className="flex gap-2 flex-wrap">
              <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full">컨디션 {conditionScore}/5</span>
              <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">수면 {sleepHours}</span>
              <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">에너지 {energyLevel}</span>
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
  const { data: logs, refetch: refetchLogs } = trpc.gymPlus.listWorkoutLogs.useQuery({});
  const { data: todayRec, refetch: refetchRec } = trpc.gymPlus.getTodayRecommendations.useQuery();

  const today = new Date().toISOString().slice(0, 10);
  const todayCheckedIn = logs?.some((l) => l.logDate === today && l.title === "출석체크");
  const daysLeft = daysUntil(member?.membershipEnd);
  const bonus = getRenewalBonus(daysLeft);

  const notices = (events ?? []).filter(e => e.eventType === "notice");
  const eventItems = (events ?? []).filter(e => e.eventType !== "notice");
  const displayItems = [
    ...notices.map(e => ({ ...e, _isNotice: true })),
    ...eventItems.map(e => ({ ...e, _isNotice: false })),
  ].slice(0, 6);

  const membershipColor =
    daysLeft === null ? "border-gray-100 bg-white" :
    daysLeft <= 0 ? "border-red-100 bg-red-50" :
    daysLeft <= 7 ? "border-orange-100 bg-orange-50" :
    "border-blue-100 bg-blue-50";

  const dayTextColor =
    daysLeft === null ? "text-gray-400" :
    daysLeft <= 0 ? "text-red-500" :
    daysLeft <= 7 ? "text-orange-500" :
    "text-[#1D4ED8]";

  return (
    <div className="p-4 space-y-5">

      {/* 1. 환영 인사 */}
      <div className="pt-1">
        <p className="text-sm text-gray-400 font-light mb-0.5">안녕하세요</p>
        <p className="text-2xl font-bold text-[#1a2b4b]">{member?.name ?? "회원"}님</p>
      </div>

      {/* 2. 회원권 D-day */}
      {daysLeft !== null && (
        <button
          onClick={() => navigate("/gym-plus/profile")}
          className={`w-full rounded-2xl border p-4 text-left transition-opacity hover:opacity-80 ${membershipColor}`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] text-gray-400 font-light mb-1">회원권 남은 기간</p>
              <p className={`font-black text-3xl leading-none ${dayTextColor}`}>
                {daysLeft > 0 ? `D-${daysLeft}` : daysLeft === 0 ? "오늘 만료" : "만료됨"}
              </p>
              {member?.membershipEnd && (
                <p className="text-[10px] text-gray-400 mt-1.5">{member.membershipEnd} 까지</p>
              )}
            </div>
            {bonus && (
              <div className="text-right">
                <p className="text-xs font-semibold text-[#1D4ED8]">{bonus.label}</p>
                <p className="text-[10px] text-gray-400 mt-0.5">{bonus.desc}</p>
                <p className="text-[10px] text-gray-400">재등록 신청 →</p>
              </div>
            )}
          </div>
        </button>
      )}

      {/* 3. 공지 & 이벤트 (최대 6개) */}
      {displayItems.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-[#1a2b4b]">공지 & 이벤트</p>
            <button className="text-xs text-[#1D4ED8]" onClick={() => navigate("/gym-plus/events")}>전체보기 →</button>
          </div>
          {displayItems.map((e) => (
            <div
              key={e.id}
              onClick={() => navigate(`/gym-plus/events/${e.id}`)}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-colors hover:opacity-80 ${
                e._isNotice
                  ? "bg-blue-50 border-blue-100"
                  : "bg-white border-gray-100 shadow-sm"
              }`}
            >
              <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${
                e._isNotice
                  ? "bg-blue-500 text-white"
                  : e.eventType === "promotion"
                  ? "bg-orange-400 text-white"
                  : "bg-gray-200 text-gray-600"
              }`}>
                {e._isNotice ? "공지" : e.eventType === "promotion" ? "프로" : "이벤트"}
              </span>
              <p className="text-sm font-medium text-[#1a2b4b] line-clamp-1 flex-1">{e.title}</p>
              <p className="text-[10px] text-gray-400 flex-shrink-0">{e.createdAt?.slice(0, 10)}</p>
            </div>
          ))}
        </div>
      )}

      {/* 4. 퀵 메뉴 2x2 그리드 */}
      <div className="grid grid-cols-2 gap-3">

        {/* 운동영상 + 출석하기 */}
        <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm flex flex-col gap-3">
          <button
            className="flex items-center gap-2 w-full text-left"
            onClick={() => navigate("/gym-plus/videos")}
          >
            <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
              <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.8} stroke="currentColor" className="w-5 h-5 text-[#1D4ED8]">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.91 11.672a.375.375 0 0 1 0 .656l-5.603 3.113a.375.375 0 0 1-.557-.328V8.887c0-.286.307-.466.557-.328l5.603 3.113Z" />
              </svg>
            </div>
            <span className="text-sm font-semibold text-[#1a2b4b]">운동영상</span>
          </button>
          {todayCheckedIn ? (
            <div className="flex items-center gap-1.5 px-3 py-2 bg-green-50 border border-green-100 rounded-xl">
              <svg viewBox="0 0 24 24" fill="none" strokeWidth={2.5} stroke="currentColor" className="w-3.5 h-3.5 text-green-500 flex-shrink-0">
                <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
              </svg>
              <span className="text-[11px] font-medium text-green-600">출석 완료</span>
            </div>
          ) : (
            <button
              onClick={() => setShowCheckIn(true)}
              className="w-full py-2 bg-[#1D4ED8] text-white text-[11px] font-semibold rounded-xl hover:bg-[#1a44c2] transition-colors"
            >
              출석하기
            </button>
          )}
        </div>

        {/* 운동기록 */}
        <button
          className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm flex flex-col items-start gap-2 hover:border-blue-200 transition-colors"
          onClick={() => navigate("/gym-plus/workout")}
        >
          <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center">
            <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.8} stroke="currentColor" className="w-5 h-5 text-[#1D4ED8]">
              <path strokeLinecap="round" strokeLinejoin="round" d="m3.75 13.5 10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z" />
            </svg>
          </div>
          <span className="text-sm font-semibold text-[#1a2b4b]">운동기록</span>
        </button>

        {/* 식단관리 */}
        <button
          className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm flex flex-col items-start gap-2 hover:border-blue-200 transition-colors"
          onClick={() => navigate("/gym-plus/diet")}
        >
          <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center">
            <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.8} stroke="currentColor" className="w-5 h-5 text-[#1D4ED8]">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" />
            </svg>
          </div>
          <span className="text-sm font-semibold text-[#1a2b4b]">식단관리</span>
        </button>

        {/* 내정보 */}
        <button
          className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm flex flex-col items-start gap-2 hover:border-blue-200 transition-colors"
          onClick={() => navigate("/gym-plus/profile")}
        >
          <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center">
            <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.8} stroke="currentColor" className="w-5 h-5 text-[#1D4ED8]">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
            </svg>
          </div>
          <span className="text-sm font-semibold text-[#1a2b4b]">내정보</span>
        </button>

      </div>

      {/* 출석 체크인 모달 */}
      {showCheckIn && <CheckInModal onClose={() => { setShowCheckIn(false); refetchLogs(); refetchRec(); }} />}
    </div>
  );
}
