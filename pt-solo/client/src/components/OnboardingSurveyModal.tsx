import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { ChevronRight, ChevronLeft, X, Sparkles, TrendingUp, Coins } from "lucide-react";
import { Button } from "@/components/ui/button";

type Question = {
  id: string;
  question: string;
  hint: string;
  multi: boolean;
  options: string[];
};

const QUESTIONS: Question[] = [
  {
    id: "q1",
    question: "현재 가장 배우고 싶은 분야는 무엇인가요?",
    hint: "복수 선택 가능",
    multi: true,
    options: ["회원 상담", "운동 티칭", "운동 프로그램 구성", "체형 분석", "자세 평가", "움직임 평가", "회원 재등록 관리", "회원 유지 관리", "세일즈 및 상담 전환", "SNS 브랜딩"],
  },
  {
    id: "q2",
    question: "현재 가장 어려운 부분은 무엇인가요?",
    hint: "복수 선택 가능",
    multi: true,
    options: ["회원과 대화", "운동 설명", "티칭 자신감 부족", "회원 모집", "회원 유지", "프로그램 구성", "평가 및 분석", "수업 흐름 구성", "재등록 연결", "개인 브랜딩"],
  },
  {
    id: "q3",
    question: "현재 활동 형태는 어떻게 되나요?",
    hint: "하나 선택",
    multi: false,
    options: ["센터 소속", "프리랜서", "개인 운영", "필라테스 스튜디오 근무", "파트타임", "취업 준비 중", "학생"],
  },
  {
    id: "q4",
    question: "향후 목표는 무엇인가요?",
    hint: "복수 선택 가능",
    multi: true,
    options: ["좋은 트레이너가 되고 싶다", "회원 관리 능력을 높이고 싶다", "프리랜서로 활동하고 싶다", "센터 취업이 목표다", "센터 창업이 목표다", "교육 강사가 되고 싶다", "온라인 PT 운영", "필라테스 스튜디오 운영"],
  },
  {
    id: "q5",
    question: "현재 회원 관리 경험이 있나요?",
    hint: "하나 선택",
    multi: false,
    options: ["회원 관리 경험 없음", "1~5명", "5~10명", "10~30명", "30명 이상"],
  },
  {
    id: "q6",
    question: "어떤 교육 형태를 선호하시나요?",
    hint: "하나 선택",
    multi: false,
    options: ["오프라인 실습형", "소규모 그룹 교육", "온라인 교육", "현장 실습형", "케이스 스터디 중심", "세미나형"],
  },
  {
    id: "q7",
    question: "주로 활동하고 싶은 분야는 무엇인가요?",
    hint: "복수 선택 가능",
    multi: true,
    options: ["PT", "필라테스", "체형교정", "재활운동", "기능성 트레이닝", "시니어 운동", "스포츠 퍼포먼스", "다이어트 전문", "그룹수업"],
  },
  {
    id: "q8",
    question: "회원 상담 경험이 있나요?",
    hint: "하나 선택",
    multi: false,
    options: ["거의 없음", "기본 상담 가능", "등록 상담 가능", "재등록 상담 가능", "상담 자신 있음"],
  },
  {
    id: "q9",
    question: "현재 SNS 또는 개인 브랜딩 활동을 하고 있나요?",
    hint: "복수 선택 가능",
    multi: true,
    options: ["하지 않음", "인스타그램 운영 중", "블로그 운영 중", "릴스/숏폼 제작 중", "온라인 수업 운영 중"],
  },
  {
    id: "q10",
    question: "FIT STEP에서 가장 기대하는 기능은 무엇인가요?",
    hint: "복수 선택 가능",
    multi: true,
    options: ["회원관리", "운동기록", "건강리포트", "재등록 관리", "상담 관리", "교육 콘텐츠", "성장 분석", "커뮤니티", "전자계약", "개인 브랜딩"],
  },
];

export default function OnboardingSurveyModal({ onClose }: { onClose: () => void }) {
  const utils = trpc.useUtils();
  const [step, setStep] = useState<"intro" | "survey" | "done">("intro");
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [exiting, setExiting] = useState(false);
  const [pointsGranted, setPointsGranted] = useState(false);

  const submitMutation = trpc.trainers.submitOnboardingSurvey.useMutation({
    onSuccess: (data) => {
      utils.trainers.getMyProfile.invalidate();
      utils.fitPoints.getBalance.invalidate();
      setPointsGranted(data.pointsGranted ?? false);
      setStep("done");
    },
    onError: (e) => toast.error(e.message),
  });

  const q = QUESTIONS[current];
  const selected = answers[q?.id] ?? [];
  const progress = ((current + 1) / QUESTIONS.length) * 100;

  function toggle(option: string) {
    setAnswers(prev => {
      const cur = prev[q.id] ?? [];
      if (q.multi) {
        return { ...prev, [q.id]: cur.includes(option) ? cur.filter(x => x !== option) : [...cur, option] };
      }
      return { ...prev, [q.id]: [option] };
    });
  }

  function next() {
    if (current < QUESTIONS.length - 1) {
      setCurrent(c => c + 1);
    } else {
      submitMutation.mutate({ answers });
    }
  }

  function prev() {
    if (current > 0) setCurrent(c => c - 1);
  }

  function handleClose() {
    setExiting(true);
    setTimeout(onClose, 200);
  }

  if (step === "done") {
    return (
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 pt-safe backdrop-blur-sm">
        <div className="w-full max-w-md bg-card rounded-3xl shadow-2xl overflow-hidden">
          <div className="bg-gradient-to-br from-primary to-primary/70 p-8 text-white text-center space-y-3">
            <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto">
              <TrendingUp className="h-8 w-8" />
            </div>
            <p className="text-xl font-bold">설문 완료!</p>
            <p className="text-sm text-white/80 leading-relaxed">
              소중한 응답 감사합니다.<br />맞춤형 교육 콘텐츠와 기능으로 성장을 도와드릴게요.
            </p>
          </div>
          {pointsGranted && (
            <div className="flex items-center justify-center gap-2 bg-amber-50 border-b border-amber-100 px-6 py-3">
              <Coins className="h-4 w-4 text-amber-500" />
              <p className="text-sm font-bold text-amber-700">+300 FIT POINT 지급 완료!</p>
            </div>
          )}
          <div className="p-6">
            <Button className="w-full" onClick={handleClose}>FIT STEP 시작하기</Button>
          </div>
        </div>
      </div>
    );
  }

  if (step === "intro") {
    return (
      <div className={`fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 pt-safe backdrop-blur-sm transition-opacity ${exiting ? "opacity-0" : "opacity-100"}`}>
        <div className="w-full max-w-md bg-card rounded-3xl shadow-2xl overflow-hidden">
          <div className="flex justify-end p-4 pb-0">
            <button onClick={handleClose} className="text-muted-foreground hover:text-foreground p-1 rounded-full hover:bg-muted transition-colors">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="px-6 pb-6 pt-2 space-y-5 text-center">
            {/* 아이콘 */}
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
              <Sparkles className="h-8 w-8 text-primary" />
            </div>

            <div className="space-y-2">
              <p className="text-xl font-bold">30초 성장 설문</p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                여러분의 성장을 위해 딱 10가지만 여쭤볼게요.<br />
                응답 결과를 바탕으로 <span className="text-primary font-semibold">맞춤 교육 콘텐츠</span>와<br />
                <span className="text-primary font-semibold">FIT STEP 기능 개선</span>에 반영됩니다.
              </p>
            </div>

            {/* 포인트 안내 */}
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-3">
              <Coins className="h-6 w-6 text-amber-500 shrink-0" />
              <div>
                <p className="font-bold text-amber-800 text-sm">완료 시 300 FIT POINT 즉시 지급</p>
                <p className="text-amber-700 text-xs mt-0.5 leading-relaxed">
                  응답 결과는 교육 콘텐츠 기획 및 앱 기능 개선에만 활용됩니다.
                </p>
              </div>
            </div>

            <div className="space-y-2 pt-1">
              <Button className="w-full gap-2" onClick={() => setStep("survey")}>
                <Sparkles className="h-4 w-4" />
                설문 시작하기 (10문항)
              </Button>
              <button onClick={handleClose} className="w-full text-xs text-muted-foreground py-2 hover:text-foreground transition-colors">
                나중에 하기
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 pt-safe backdrop-blur-sm transition-opacity ${exiting ? "opacity-0" : "opacity-100"}`}>
      <div className="w-full max-w-md bg-card rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-modal">
        {/* 헤더 */}
        <div className="shrink-0 px-5 pt-5 pb-3 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                {current + 1} / {QUESTIONS.length}
              </span>
              <span className="text-xs text-muted-foreground">30초 성장 설문</span>
            </div>
            <button onClick={handleClose} className="text-muted-foreground hover:text-foreground p-1 rounded-full hover:bg-muted transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* 프로그레스 바 */}
          <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* 질문 + 옵션 */}
        <div className="flex-1 overflow-y-auto px-5 py-2 space-y-4">
          <div className="space-y-1">
            <p className="font-bold text-base leading-snug">{q.question}</p>
            <p className="text-xs text-muted-foreground">{q.hint}</p>
          </div>

          <div className="grid grid-cols-2 gap-2 pb-2">
            {q.options.map(opt => {
              const on = selected.includes(opt);
              return (
                <button
                  key={opt}
                  onClick={() => toggle(opt)}
                  className={`py-2.5 px-3 rounded-xl border text-sm font-medium text-left transition-all ${
                    on
                      ? "bg-primary/15 border-primary text-primary shadow-sm"
                      : "bg-background border-border text-foreground hover:border-primary/40 hover:bg-primary/5"
                  }`}
                >
                  {on && <span className="mr-1">✓</span>}
                  {opt}
                </button>
              );
            })}
          </div>
        </div>

        {/* 하단 버튼 */}
        <div className="shrink-0 flex items-center gap-3 px-5 pt-4 pb-safe-4 border-t border-border bg-card">
          <button
            onClick={prev}
            disabled={current === 0}
            className="p-2.5 rounded-xl border border-border text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>

          <Button
            className="flex-1 gap-2"
            disabled={selected.length === 0 || submitMutation.isPending}
            onClick={next}
          >
            {current === QUESTIONS.length - 1
              ? (submitMutation.isPending ? "제출 중..." : "제출하기")
              : "다음"}
            {current < QUESTIONS.length - 1 && <ChevronRight className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
