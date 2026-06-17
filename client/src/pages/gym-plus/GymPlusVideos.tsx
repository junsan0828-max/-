import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const levelLabel: Record<string, string> = {
  beginner: "초급",
  intermediate: "중급",
  advanced: "고급",
};

const levelColor: Record<string, string> = {
  beginner: "bg-green-500/20 text-green-600",
  intermediate: "bg-yellow-500/20 text-yellow-600",
  advanced: "bg-red-500/20 text-red-600",
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

function getYoutubeEmbedUrl(url: string): string | null {
  const m = url.match(/(?:(?:www\.|m\.)?youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([^&\n?#]+)/);
  return m ? `https://www.youtube.com/embed/${m[1]}?rel=0` : null;
}

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

            <div className="space-y-2">
              <p className="text-sm font-medium">수면 시간</p>
              <div className="flex gap-1.5">
                {SLEEP_OPTIONS.map((s) => (
                  <button key={s}
                    className={`flex-1 py-2 rounded-xl border text-xs transition-colors ${sleepHours === s ? "bg-primary/20 border-primary text-primary" : "border-border text-muted-foreground"}`}
                    onClick={() => setSleepHours(s)}
                  >{s}</button>
                ))}
              </div>
            </div>

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

            <div className="space-y-2">
              <p className="text-sm font-medium">오늘의 운동 부위 <span className="text-xs text-muted-foreground font-normal">(중복 선택)</span></p>
              <div className="grid grid-cols-4 gap-1.5">
                {BODY_PART_GROUPS.map((g) => (
                  <button key={g.key}
                    className={`py-2 rounded-xl border text-xs font-medium transition-colors ${selectedBodyParts.includes(g.key) ? "bg-primary/20 border-primary text-primary" : "border-border text-muted-foreground"}`}
                    onClick={() => toggleBodyPart(g.key)}
                  >{g.label}</button>
                ))}
              </div>
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

            <div className="space-y-2">
              <p className="text-sm font-medium">오늘의 운동 주제 <span className="text-xs text-muted-foreground font-normal">(중복 선택)</span></p>
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

            <div className="flex gap-2 flex-wrap">
              <span className="text-xs bg-blue-500/20 text-blue-600 px-2 py-0.5 rounded-full">컨디션 {conditionScore}/5</span>
              <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">수면 {sleepHours}</span>
              <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">에너지 {energyLevel}</span>
              {selectedBodyParts.length > 0 && (
                <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
                  {selectedBodyParts.slice(0, 3).join(", ")}{selectedBodyParts.length > 3 ? " +" + (selectedBodyParts.length - 3) : ""}
                </span>
              )}
            </div>

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
                        <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.8} stroke="currentColor" className="w-4 h-4 text-muted-foreground">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z" />
                        </svg>
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
            </div>

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

function VideoCard({ v, onClick }: { v: any; onClick: () => void }) {
  return (
    <div
      className="bg-white border border-gray-100 rounded-xl overflow-hidden cursor-pointer hover:border-blue-200 hover:shadow-md transition-all"
      onClick={onClick}
    >
      {v.thumbnailUrl ? (
        <img src={v.thumbnailUrl} alt={v.title} className="w-full aspect-video object-cover" />
      ) : (
        <div className="w-full aspect-video bg-gray-50 flex items-center justify-center">
          <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 text-gray-300">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z" />
          </svg>
        </div>
      )}
      <div className="p-2.5 space-y-1">
        <p className="text-xs font-semibold line-clamp-2 leading-snug text-[#1a2b4b]">{v.title}</p>
        <div className="flex items-center gap-1 flex-wrap">
          <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${levelColor[v.level ?? "beginner"] ?? ""}`}>
            {levelLabel[v.level ?? "beginner"] ?? v.level}
          </span>
          {v.bodyPart && <span className="text-[9px] text-gray-400">{v.bodyPart}</span>}
        </div>
        {v.duration && <p className="text-[9px] text-gray-400">{v.duration}</p>}
      </div>
    </div>
  );
}

export default function GymPlusVideos() {
  const [, navigate] = useLocation();
  const [tab, setTab] = useState<"gym" | "custom">("gym");
  const [selectedCategory, setSelectedCategory] = useState<number | undefined>();
  const [selectedLevel, setSelectedLevel] = useState<string | undefined>();
  const [showCheckIn, setShowCheckIn] = useState(false);

  const { data: categories } = trpc.gymPlus.listVideoCategories.useQuery();
  const { data: videos, isLoading } = trpc.gymPlus.listVideos.useQuery({
    categoryId: selectedCategory,
    level: selectedLevel,
  });
  const { data: health } = trpc.gymPlus.getHealth.useQuery();
  const { data: todayRec, refetch: refetchRec } = trpc.gymPlus.getTodayRecommendations.useQuery();
  const { data: logs, refetch: refetchLogs } = trpc.gymPlus.listWorkoutLogs.useQuery({});

  const today = new Date().toISOString().slice(0, 10);
  const todayCheckedIn = logs?.some((l) => l.logDate === today && l.title === "출석체크");

  const allMissionsDone = !!(health?.height && health?.weight && health?.parqSubmittedAt && health?.bodyAnalysisRequested);
  const missionCount = [
    !!(health?.height && health?.weight),
    !!health?.parqSubmittedAt,
    !!health?.bodyAnalysisRequested,
  ].filter(Boolean).length;

  return (
    <div className="flex flex-col h-full bg-white">

      {/* 출석하기 배너 */}
      <div className="px-4 pt-4 pb-0">
        {todayCheckedIn ? (
          <div className="flex items-center gap-3 bg-green-50 border border-green-100 rounded-2xl px-4 py-3">
            <div className="w-8 h-8 rounded-xl bg-green-500 flex items-center justify-center flex-shrink-0">
              <svg viewBox="0 0 24 24" fill="none" strokeWidth={2.5} stroke="white" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
              </svg>
            </div>
            <div>
              <p className="text-[13px] font-bold text-green-700">오늘 출석 완료</p>
              <p className="text-[11px] text-green-500">수고하셨습니다. 오늘도 파이팅!</p>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowCheckIn(true)}
            className="w-full flex items-center gap-3 bg-[#1D4ED8] hover:bg-[#1a44c2] active:bg-[#1739a8] rounded-2xl px-4 py-3.5 transition-colors"
          >
            <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
              <svg viewBox="0 0 24 24" fill="none" strokeWidth={2} stroke="white" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
            </div>
            <div className="flex-1 text-left">
              <p className="text-[13px] font-bold text-white">출석하기</p>
              <p className="text-[11px] text-white/70">오늘의 컨디션을 체크하고 맞춤 운동을 받아보세요</p>
            </div>
            <svg viewBox="0 0 24 24" fill="none" strokeWidth={2} stroke="white" className="w-4 h-4 opacity-60 flex-shrink-0">
              <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
            </svg>
          </button>
        )}
      </div>

      {/* 탭 헤더 */}
      <div className="flex border-b border-gray-100 bg-white sticky top-0 z-10 mt-4">
        <button
          onClick={() => setTab("gym")}
          className={`flex-1 py-3 text-sm font-medium transition-colors ${
            tab === "gym" ? "text-[#1D4ED8] border-b-2 border-[#1D4ED8]" : "text-gray-400"
          }`}
        >
          자이언트짐 기구운동
        </button>
        <button
          onClick={() => setTab("custom")}
          className={`flex-1 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-1.5 ${
            tab === "custom" ? "text-[#1D4ED8] border-b-2 border-[#1D4ED8]" : "text-gray-400"
          }`}
        >
          맞춤운동
          {!allMissionsDone && (
            <span className="text-[9px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">{missionCount}/3</span>
          )}
        </button>
      </div>

      {/* 자이언트짐 기구운동 탭 */}
      {tab === "gym" && (
        <div className="p-4 space-y-4">
          {categories && categories.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4">
              <button
                onClick={() => setSelectedCategory(undefined)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  !selectedCategory ? "bg-[#1D4ED8] text-white" : "bg-gray-100 text-gray-500"
                }`}
              >전체</button>
              {categories.map((c) => (
                <button key={c.id}
                  onClick={() => setSelectedCategory(selectedCategory === c.id ? undefined : c.id)}
                  className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    selectedCategory === c.id ? "bg-[#1D4ED8] text-white" : "bg-gray-100 text-gray-500"
                  }`}
                >{c.name}</button>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            {([undefined, "beginner", "intermediate", "advanced"] as const).map((level) => (
              <button key={level ?? "all"}
                onClick={() => setSelectedLevel(level)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  selectedLevel === level ? "bg-[#1D4ED8] text-white" : "bg-gray-100 text-gray-500"
                }`}
              >{level ? levelLabel[level] : "전체"}</button>
            ))}
          </div>

          {isLoading ? (
            <div className="text-center py-10 text-gray-400 text-sm">불러오는 중...</div>
          ) : !videos || videos.length === 0 ? (
            <div className="text-center py-10 text-gray-400 text-sm">등록된 영상이 없습니다</div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {videos.map((v) => (
                <VideoCard key={v.id} v={v} onClick={() => navigate(`/gym-plus/videos/${v.id}`)} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* 맞춤운동 탭 */}
      {tab === "custom" && (
        <div className="p-4">
          {!allMissionsDone ? (
            <div className="space-y-4 pt-2">
              <div className="bg-white border border-gray-100 rounded-2xl p-6 flex flex-col items-center gap-3 text-center shadow-sm">
                <div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center">
                  <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.8} stroke="currentColor" className="w-7 h-7 text-gray-400">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
                  </svg>
                </div>
                <p className="font-bold text-[15px] text-[#1a2b4b]">맞춤운동 잠금 중</p>
                <p className="text-xs text-gray-400 leading-relaxed">
                  내 정보 탭에서 미션 3가지를 완료하면<br />나에게 딱 맞는 맞춤 운동이 열립니다
                </p>
                <div className="w-full bg-gray-100 rounded-full h-1.5 mt-1">
                  <div
                    className="bg-[#1D4ED8] h-1.5 rounded-full transition-all"
                    style={{ width: `${(missionCount / 3) * 100}%` }}
                  />
                </div>
                <p className="text-xs text-gray-400">{missionCount}/3 미션 완료</p>
              </div>

              <div className="space-y-2">
                {[
                  { label: "신체정보 입력", done: !!(health?.height && health?.weight) },
                  { label: "사전 건강검사 (PAR-Q)", done: !!health?.parqSubmittedAt },
                  { label: "체형분석 데이터 신청", done: !!health?.bodyAnalysisRequested },
                ].map((m) => (
                  <div key={m.label} className={`flex items-center gap-3 p-3.5 rounded-xl border ${m.done ? "border-green-100 bg-green-50" : "border-gray-100 bg-white"}`}>
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${m.done ? "bg-green-500" : "bg-gray-200"}`}>
                      {m.done ? (
                        <svg viewBox="0 0 24 24" fill="none" strokeWidth={2.5} stroke="white" className="w-3 h-3">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                        </svg>
                      ) : (
                        <span className="w-1.5 h-1.5 rounded-full bg-white" />
                      )}
                    </span>
                    <span className="text-[13px] font-medium text-[#1a2b4b] flex-1">{m.label}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${m.done ? "bg-green-100 text-green-600" : "bg-gray-100 text-gray-400"}`}>
                      {m.done ? "완료" : "미완료"}
                    </span>
                  </div>
                ))}
              </div>

              <button
                className="w-full py-3.5 rounded-xl bg-[#1D4ED8] text-white text-[13px] font-bold"
                onClick={() => navigate("/gym-plus/profile")}
              >
                내 정보에서 미션 완료하기 →
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-gradient-to-r from-[#1D4ED8]/10 to-[#1D4ED8]/5 rounded-2xl p-4 border border-[#1D4ED8]/15">
                <p className="text-[10px] text-[#1D4ED8] font-bold tracking-widest uppercase mb-1">Personalized</p>
                <p className="font-bold text-[15px] text-[#1a2b4b]">나에게 맞는 운동</p>
                <p className="text-xs text-gray-400 mt-1">신체정보와 건강데이터를 기반으로 선별된 운동 영상입니다</p>
              </div>

              {todayRec && todayRec.recommendedVideos.length > 0 ? (
                <div className="space-y-3">
                  <p className="text-xs font-bold text-gray-400 tracking-wide">오늘의 추천 ({todayRec.recommendedVideos.length}개)</p>
                  <div className="grid grid-cols-2 gap-3">
                    {todayRec.recommendedVideos.map((v: any) => (
                      <VideoCard key={v.id} v={v} onClick={() => navigate(`/gym-plus/videos/${v.id}`)} />
                    ))}
                  </div>
                </div>
              ) : (
                <div className="border border-dashed border-gray-200 rounded-xl p-6 text-center space-y-2">
                  <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center mx-auto">
                    <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.8} stroke="currentColor" className="w-5 h-5 text-gray-300">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                    </svg>
                  </div>
                  <p className="text-sm font-medium text-[#1a2b4b]">출석체크 후 추천 운동이 표시됩니다</p>
                  <p className="text-xs text-gray-400">위의 출석하기 버튼을 눌러 오늘의 맞춤 운동을 확인하세요</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {showCheckIn && (
        <CheckInModal onClose={() => { setShowCheckIn(false); refetchLogs(); refetchRec(); }} />
      )}
    </div>
  );
}
