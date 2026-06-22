import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const GYM_RULES = [
  { title: "시설 이용", body: "센터 내 모든 시설은 회원 전용이며, 타인에게 양도하거나 공유할 수 없습니다." },
  { title: "운동 복장", body: "운동복과 실내 운동화를 착용하셔야 합니다. 슬리퍼 및 맨발 이용은 금지됩니다." },
  { title: "기구 사용", body: "기구 사용 후 반드시 제자리에 정리하고, 땀을 닦아주세요. 장시간 기구 독점은 자제해 주세요." },
  { title: "위생 관리", body: "운동 중 타월을 사용하시고, 땀이 기구에 묻지 않도록 협조해 주세요." },
  { title: "소지품 관리", body: "귀중품 및 개인 소지품은 본인이 직접 관리하셔야 합니다. 분실 시 센터에서 책임지지 않습니다." },
  { title: "안전 수칙", body: "무리한 중량이나 자세로 인한 부상에 주의하세요. 트레이너에게 안전한 운동 방법을 문의하세요." },
  { title: "금지 행위", body: "센터 내 흡연, 음주, 반려동물 동반, 타인에 대한 불쾌한 언행은 금지됩니다." },
  { title: "회원권", body: "회원권은 양도 불가이며, 환불 규정은 센터 약관에 따릅니다. 출석하기를 통해 운동을 기록하세요." },
];

const PARQ_QUESTIONS = [
  "의사가 심장에 문제가 있다고 한 적이 있으며, 의사의 지시 아래서만 신체활동을 권고받은 적이 있습니까?",
  "신체활동 중 흉통을 느낀 적이 있습니까?",
  "최근 한 달 이내에 신체활동을 하지 않을 때 흉통을 느낀 적이 있습니까?",
  "어지러움으로 인해 균형감각을 잃거나 의식을 잃은 적이 있습니까?",
  "신체활동을 변화시키면 악화될 수 있는 뼈나 관절 문제가 있습니까?",
  "의사가 혈압이나 심장질환에 대해 약을 처방해 준 적이 있습니까?",
  "신체활동에 참여하지 말아야 할 다른 이유가 있습니까?",
];

const APP_GUIDE = [
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.8} stroke="currentColor" className="w-5 h-5 text-[#1D4ED8]">
        <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75" />
      </svg>
    ),
    label: "홈",
    desc: "회원권 남은 기간, 공지·이벤트, 빠른 메뉴를 한눈에 확인합니다.",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.8} stroke="currentColor" className="w-5 h-5 text-[#1D4ED8]">
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.91 11.672a.375.375 0 0 1 0 .656l-5.603 3.113a.375.375 0 0 1-.557-.328V8.887c0-.286.307-.466.557-.328l5.603 3.113Z" />
      </svg>
    ),
    label: "운동영상",
    desc: "출석체크 후 오늘의 컨디션에 맞는 맞춤 운동 영상을 추천받을 수 있습니다.",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.8} stroke="currentColor" className="w-5 h-5 text-violet-500">
        <path strokeLinecap="round" strokeLinejoin="round" d="m3.75 13.5 10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z" />
      </svg>
    ),
    label: "운동기록",
    desc: "운동 부위, 강도, 컨디션 등을 기록하고 히스토리를 관리합니다.",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.8} stroke="currentColor" className="w-5 h-5 text-emerald-500">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" />
      </svg>
    ),
    label: "맞춤식단",
    desc: "트레이너가 등록한 맞춤 식단을 확인하고 영양 관리를 합니다.",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.8} stroke="currentColor" className="w-5 h-5 text-slate-500">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
      </svg>
    ),
    label: "내정보",
    desc: "신체 정보 입력 및 PAR-Q 건강검사를 완료하면 맞춤 운동이 활성화됩니다.",
  },
];

type Step = "rules" | "guide" | "parq";

interface Props {
  health: {
    gymRulesAgreed?: number | null;
    appGuideConfirmed?: number | null;
    parqSubmittedAt?: string | null;
  } | null;
  onComplete: () => void;
}

export default function GymPlusOnboarding({ health, onComplete }: Props) {
  const needsRules = !health?.gymRulesAgreed;
  const needsGuide = !health?.appGuideConfirmed;
  const needsParq = !health?.parqSubmittedAt;

  const initialStep: Step = needsRules ? "rules" : needsGuide ? "guide" : "parq";
  const [step, setStep] = useState<Step>(initialStep);
  const [rulesScrolled, setRulesScrolled] = useState(false);
  const [rulesAgreed, setRulesAgreed] = useState(false);

  // PAR-Q state
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [parqAnswers, setParqAnswers] = useState<Record<number, "yes" | "no">>({});

  const upsert = trpc.gymPlus.upsertHealth.useMutation({
    onError: (err) => toast.error(err.message),
  });

  const totalSteps = [needsRules, needsGuide, needsParq].filter(Boolean).length;
  const stepIndex =
    step === "rules" ? 1 :
    step === "guide" ? (needsRules ? 2 : 1) :
    totalSteps;

  function handleRulesNext() {
    if (needsGuide) setStep("guide");
    else if (needsParq) setStep("parq");
    else {
      // rules only — save and complete
      upsert.mutateAsync({ gymRulesAgreed: 1 }).then(onComplete);
    }
  }

  function handleGuideNext() {
    if (needsParq) setStep("parq");
    else {
      // rules + guide but no parq — save and complete
      upsert.mutateAsync({ gymRulesAgreed: 1, appGuideConfirmed: 1 }).then(onComplete);
    }
  }

  async function handleParqSubmit() {
    if (!height || !weight) {
      toast.error("키와 몸무게를 입력해주세요.");
      return;
    }
    const allAnswered = PARQ_QUESTIONS.every((_, i) => parqAnswers[i]);
    if (!allAnswered) {
      toast.error("모든 건강 질문에 답해주세요.");
      return;
    }
    const hasYes = Object.values(parqAnswers).some(v => v === "yes");
    if (hasYes) {
      toast("의사와 상담 후 운동을 시작하시길 권장드립니다.", { duration: 5000 });
    }
    try {
      await upsert.mutateAsync({
        gymRulesAgreed: needsRules ? 1 : undefined,
        appGuideConfirmed: needsGuide ? 1 : undefined,
        height,
        weight,
        parq1: parqAnswers[0],
        parq2: parqAnswers[1],
        parq3: parqAnswers[2],
        parq4: parqAnswers[3],
        parq5: parqAnswers[4],
        parq6: parqAnswers[5],
        parq7: parqAnswers[6],
        parqSubmittedAt: new Date().toISOString().slice(0, 10),
      });
      onComplete();
    } catch {
      // error already shown via onError toast
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-md bg-white rounded-t-3xl overflow-hidden" style={{ maxHeight: "92vh" }}>

        {/* 헤더 */}
        <div className="px-5 pt-5 pb-4 border-b border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <div className="flex gap-1.5">
              {Array.from({ length: totalSteps }).map((_, i) => (
                <div
                  key={i}
                  className={`h-1 rounded-full transition-all ${i < stepIndex ? "bg-[#1D4ED8]" : "bg-gray-200"}`}
                  style={{ width: i < stepIndex ? "24px" : "8px" }}
                />
              ))}
            </div>
            <span className="text-[11px] text-gray-400 font-medium">{stepIndex}/{totalSteps}</span>
          </div>
          <p className="text-[11px] text-[#1D4ED8] font-bold tracking-widest uppercase">Welcome</p>
          <h2 className="text-[17px] font-extrabold text-[#1a2b4b] mt-0.5">
            {step === "rules" && "센터 이용규정 안내"}
            {step === "guide" && "앱 이용방법 안내"}
            {step === "parq" && "사전 건강 설문 (PAR-Q)"}
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            {step === "rules" && "하단의 이용규정을 읽고 동의해주세요."}
            {step === "guide" && "자이언트짐+ 앱 주요 기능을 안내드립니다."}
            {step === "parq" && "운동 시작 전 건강 상태를 확인합니다."}
          </p>
        </div>

        {/* 콘텐츠 */}
        <div className="overflow-y-auto" style={{ maxHeight: "calc(92vh - 160px)" }}>

          {/* STEP 1: 이용규정 */}
          {step === "rules" && (
            <div className="p-4 space-y-3">
              <div
                className="space-y-3 rounded-2xl border border-gray-100 p-4 bg-gray-50 overflow-y-auto"
                style={{ maxHeight: "45vh" }}
                onScroll={(e) => {
                  const el = e.currentTarget;
                  if (el.scrollTop + el.clientHeight >= el.scrollHeight - 20) {
                    setRulesScrolled(true);
                  }
                }}
              >
                {GYM_RULES.map((r) => (
                  <div key={r.title}>
                    <p className="text-[12px] font-bold text-[#1a2b4b]">{r.title}</p>
                    <p className="text-[11px] text-gray-500 mt-0.5 leading-relaxed">{r.body}</p>
                  </div>
                ))}
                {!rulesScrolled && (
                  <div className="sticky bottom-0 text-center py-2">
                    <p className="text-[10px] text-gray-400">아래로 스크롤하여 전체 내용을 확인하세요</p>
                  </div>
                )}
              </div>

              <button
                className={`w-full flex items-center gap-3 p-3.5 rounded-xl border transition-all ${rulesAgreed ? "border-[#1D4ED8] bg-[#EEF4FF]" : "border-gray-200 bg-white"}`}
                onClick={() => setRulesAgreed(v => !v)}
              >
                <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors ${rulesAgreed ? "bg-[#1D4ED8] border-[#1D4ED8]" : "border-gray-300"}`}>
                  {rulesAgreed && (
                    <svg viewBox="0 0 24 24" fill="none" strokeWidth={3} stroke="white" className="w-3 h-3">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                  )}
                </div>
                <p className="text-[13px] font-medium text-[#1a2b4b]">위 이용규정을 모두 읽고 동의합니다</p>
              </button>

              <Button
                className="w-full h-12 text-[14px] font-bold rounded-xl"
                disabled={!rulesAgreed || upsert.isPending}
                onClick={handleRulesNext}
              >
                {upsert.isPending ? "처리 중..." : "동의하고 계속하기"}
              </Button>
            </div>
          )}

          {/* STEP 2: 앱 이용방법 */}
          {step === "guide" && (
            <div className="p-4 space-y-3">
              <div className="space-y-2.5">
                {APP_GUIDE.map((g) => (
                  <div key={g.label} className="flex items-start gap-3 bg-gray-50 rounded-xl p-3.5">
                    <div className="w-9 h-9 rounded-xl bg-white border border-gray-100 flex items-center justify-center flex-shrink-0 shadow-sm">
                      {g.icon}
                    </div>
                    <div>
                      <p className="text-[12px] font-bold text-[#1a2b4b]">{g.label}</p>
                      <p className="text-[11px] text-gray-500 mt-0.5 leading-relaxed">{g.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="bg-[#EEF4FF] border border-blue-100 rounded-xl p-3.5">
                <p className="text-[12px] font-bold text-[#1D4ED8] mb-1">출석하기 안내</p>
                <p className="text-[11px] text-[#1D4ED8]/80 leading-relaxed">
                  운동영상 탭 상단의 <strong>출석하기</strong> 버튼을 눌러 매일 출석을 체크하세요.
                  컨디션과 운동 부위를 입력하면 맞춤 영상을 추천받을 수 있습니다.
                </p>
              </div>

              <Button
                className="w-full h-12 text-[14px] font-bold rounded-xl"
                disabled={upsert.isPending}
                onClick={handleGuideNext}
              >
                {upsert.isPending ? "처리 중..." : "확인했습니다"}
              </Button>
            </div>
          )}

          {/* STEP 3: PAR-Q */}
          {step === "parq" && (
            <div className="p-4 space-y-4">
              {/* 신체 정보 */}
              <div className="space-y-3">
                <p className="text-[12px] font-bold text-[#1a2b4b]">신체 정보</p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-[11px] text-gray-500">키 (cm)</label>
                    <Input
                      type="number"
                      placeholder="예: 170"
                      value={height}
                      onChange={(e) => setHeight(e.target.value)}
                      className="h-10 text-sm border-gray-200"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] text-gray-500">몸무게 (kg)</label>
                    <Input
                      type="number"
                      placeholder="예: 65"
                      value={weight}
                      onChange={(e) => setWeight(e.target.value)}
                      className="h-10 text-sm border-gray-200"
                    />
                  </div>
                </div>
              </div>

              {/* PAR-Q 질문 */}
              <div className="space-y-2.5">
                <div>
                  <p className="text-[12px] font-bold text-[#1a2b4b]">건강 상태 확인</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">각 항목에 예/아니오로 답해주세요</p>
                </div>
                {PARQ_QUESTIONS.map((q, i) => (
                  <div key={i} className="bg-gray-50 rounded-xl p-3">
                    <p className="text-[11px] text-[#1a2b4b] leading-relaxed mb-2">{i + 1}. {q}</p>
                    <div className="flex gap-2">
                      <button
                        className={`flex-1 py-1.5 rounded-lg border text-xs font-semibold transition-colors ${parqAnswers[i] === "yes" ? "bg-red-50 border-red-300 text-red-600" : "border-gray-200 text-gray-400"}`}
                        onClick={() => setParqAnswers(prev => ({ ...prev, [i]: "yes" }))}
                      >예</button>
                      <button
                        className={`flex-1 py-1.5 rounded-lg border text-xs font-semibold transition-colors ${parqAnswers[i] === "no" ? "bg-[#EEF4FF] border-[#1D4ED8] text-[#1D4ED8]" : "border-gray-200 text-gray-400"}`}
                        onClick={() => setParqAnswers(prev => ({ ...prev, [i]: "no" }))}
                      >아니오</button>
                    </div>
                  </div>
                ))}
              </div>

              <Button
                className="w-full h-12 text-[14px] font-bold rounded-xl"
                disabled={upsert.isPending}
                onClick={handleParqSubmit}
              >
                {upsert.isPending ? "저장 중..." : "제출하고 시작하기"}
              </Button>
              <p className="text-center text-[10px] text-gray-400 pb-2">
                나중에 내정보 탭에서도 언제든지 수정할 수 있습니다
              </p>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
