import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

// ── Types ──────────────────────────────────────────────────────────────────
type SurveyData = {
  gender: string;
  birthYear: string; birthMonth: string; birthDay: string;
  height: string; weight: string;
  occupation: string; workEnvironment: string; exerciseExperience: string;
  goals: string[];
  dietHabits: string[]; drinkingHabits: string[]; sleepHabits: string[]; activityHabits: string[];
  diagnoses: string[];
  systolicBP: string; diastolicBP: string; waistCircumference: string;
  fastingGlucose: string; hba1c: string;
  totalCholesterol: string; hdl: string; ldl: string; triglycerides: string; boneDensity: string;
  painAreas: string[]; painDuration: string; painLevel: number; painTiming: string[];
  postureIssues: string[];
  safetyAnswers: Record<number, "yes" | "no">;
};

const defaultData: SurveyData = {
  gender: "", birthYear: "", birthMonth: "", birthDay: "",
  height: "", weight: "",
  occupation: "", workEnvironment: "", exerciseExperience: "",
  goals: [],
  dietHabits: [], drinkingHabits: [], sleepHabits: [], activityHabits: [],
  diagnoses: [],
  systolicBP: "", diastolicBP: "", waistCircumference: "",
  fastingGlucose: "", hba1c: "", totalCholesterol: "", hdl: "", ldl: "", triglycerides: "", boneDensity: "",
  painAreas: [], painDuration: "", painLevel: 0, painTiming: [],
  postureIssues: [],
  safetyAnswers: {},
};

// ── Small UI components ────────────────────────────────────────────────────
function Chip({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3.5 py-2 rounded-full text-[12px] font-medium border transition-all ${
        selected ? "bg-[#1D4ED8] text-white border-[#1D4ED8]" : "bg-white text-gray-600 border-gray-200"
      }`}
    >
      {label}
    </button>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[13px] font-bold text-[#1a2b4b]">{children}</p>;
}

// ── Props ──────────────────────────────────────────────────────────────────
interface Props {
  initialData?: any;
  onComplete: () => void;
  saveExtraFields?: Record<string, any>;
}

const TOTAL = 10;

const STEP_LABELS = [
  "", "시작", "기본 정보", "생활 정보", "운동 목표",
  "생활 습관", "건강 상태", "건강 수치", "통증 체크", "체형 체크", "운동 안전 체크",
];
const STEP_TITLES = [
  "", "운동 전 건강 체크", "기본 정보를 알려주세요", "생활 정보를 알려주세요",
  "운동 목표가 무엇인가요?", "생활 습관을 알려주세요", "건강 상태를 알려주세요",
  "건강 수치를 알고 계시나요?", "불편한 곳이 있으신가요?", "체형을 확인해주세요", "운동 안전 체크",
];

export default function GymPlusHealthSurvey({ initialData, onComplete, saveExtraFields }: Props) {
  const [step, setStep] = useState(1);
  const [done, setDone] = useState(false);
  const [data, setData] = useState<SurveyData>(() => {
    if (initialData?.parqJson) {
      try { return { ...defaultData, ...JSON.parse(initialData.parqJson) }; } catch { /* fall through */ }
    }
    return {
      ...defaultData,
      height: initialData?.height ?? "",
      weight: initialData?.weight ?? "",
      gender: initialData?.gender ?? "",
      birthYear: initialData?.birthYear ?? "",
    };
  });

  const upsert = trpc.gymPlus.upsertHealth.useMutation({
    onError: (err) => toast.error(err.message),
  });

  const set = <K extends keyof SurveyData>(key: K, val: SurveyData[K]) =>
    setData(p => ({ ...p, [key]: val }));

  const toggle = (key: "goals" | "dietHabits" | "drinkingHabits" | "sleepHabits" | "activityHabits" | "diagnoses" | "painAreas" | "painTiming" | "postureIssues", item: string) =>
    setData(p => {
      const arr = p[key] as string[];
      return { ...p, [key]: arr.includes(item) ? arr.filter(x => x !== item) : [...arr, item] };
    });

  const canNext = (): boolean => {
    if (step === 2) return !!data.gender && !!data.height && !!data.weight;
    if (step === 10) return Object.keys(data.safetyAnswers).length >= 8;
    return true;
  };

  const handleNext = () => {
    if (step < TOTAL) { setStep(s => s + 1); return; }
    handleSubmit();
  };

  const handleSubmit = async () => {
    try {
      const sq = data.safetyAnswers;
      await upsert.mutateAsync({
        height: data.height || undefined,
        weight: data.weight || undefined,
        gender: data.gender || undefined,
        birthYear: data.birthYear || undefined,
        parq1: sq[0] || "no",
        parq2: sq[1] || "no",
        parq3: sq[2] || "no",
        parq4: sq[3] || "no",
        parq5: sq[4] || "no",
        parq6: sq[5] || "no",
        parq7: sq[6] || "no",
        parqSubmittedAt: new Date().toISOString().slice(0, 10),
        parqJson: JSON.stringify(data),
        ...saveExtraFields,
      });
      setDone(true);
    } catch { /* toast shown by onError */ }
  };

  const progress = Math.round((step / TOTAL) * 100);
  const hasYesSafety = Object.values(data.safetyAnswers).some(v => v === "yes");

  // ── Done screen ──────────────────────────────────────────────────────────
  if (done) {
    return (
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm">
        <div className="w-full max-w-md bg-white rounded-t-3xl p-6 space-y-5">
          <div className="text-center space-y-3 pt-4">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
              <svg viewBox="0 0 24 24" fill="none" strokeWidth={2.5} stroke="#16a34a" className="w-8 h-8">
                <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
              </svg>
            </div>
            <h2 className="text-[20px] font-extrabold text-[#1a2b4b]">건강 체크가 완료되었습니다</h2>
            <p className="text-[13px] text-gray-500 leading-relaxed">감사합니다.<br />입력해주신 내용을 바탕으로</p>
            <div className="bg-[#EEF4FF] rounded-2xl p-4 text-left space-y-2">
              {["체형 분석", "움직임 평가", "운동 상담"].map(item => (
                <div key={item} className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#1D4ED8]" />
                  <span className="text-[13px] font-medium text-[#1D4ED8]">{item}</span>
                </div>
              ))}
            </div>
            <p className="text-[12px] text-gray-400">을 통해 회원님께 가장 적합한 운동 프로그램을 추천해드립니다.</p>
          </div>
          <button
            onClick={onComplete}
            className="w-full h-12 bg-[#1D4ED8] text-white font-bold rounded-xl text-[14px]"
          >
            확인
          </button>
        </div>
      </div>
    );
  }

  // ── Main modal ────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-md bg-white rounded-t-3xl flex flex-col" style={{ maxHeight: "92vh" }}>

        {/* Header */}
        <div className="px-5 pt-5 pb-3 flex-shrink-0 border-b border-gray-100">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] text-gray-400 font-medium">STEP {step} / {TOTAL}</span>
            <span className="text-[11px] text-[#1D4ED8] font-bold">{progress}%</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-1.5 mb-3">
            <div className="bg-[#1D4ED8] h-1.5 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
          <p className="text-[10px] text-[#1D4ED8] font-bold tracking-widest uppercase mb-0.5">{STEP_LABELS[step]}</p>
          <h2 className="text-[16px] font-extrabold text-[#1a2b4b]">{STEP_TITLES[step]}</h2>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4">

          {/* STEP 1: 시작 */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="bg-[#EEF4FF] rounded-2xl p-4">
                <p className="text-[14px] text-[#1D4ED8] font-semibold leading-relaxed">
                  회원님의 현재 몸 상태를 확인하여<br />더 안전하고 효과적인 운동을 추천해드립니다.
                </p>
              </div>
              <div className="space-y-2">
                {[
                  { icon: "⏱", text: "약 2~3분 정도 소요됩니다." },
                  { icon: "👆", text: "대부분 클릭만으로 완료할 수 있어요." },
                  { icon: "🔒", text: "입력하신 정보는 안전하게 보호됩니다." },
                ].map(item => (
                  <div key={item.text} className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3">
                    <span>{item.icon}</span>
                    <p className="text-[13px] text-gray-600">{item.text}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* STEP 2: 기본 정보 */}
          {step === 2 && (
            <div className="space-y-5">
              <div className="space-y-2">
                <SectionLabel>성별</SectionLabel>
                <div className="flex gap-3">
                  {[{ v: "남성", icon: "👨" }, { v: "여성", icon: "👩" }].map(({ v, icon }) => (
                    <button key={v} type="button" onClick={() => set("gender", v)}
                      className={`flex-1 py-3 rounded-xl border-2 font-bold text-[14px] transition-all ${data.gender === v ? "border-[#1D4ED8] bg-[#EEF4FF] text-[#1D4ED8]" : "border-gray-200 text-gray-500"}`}
                    >
                      {icon} {v}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <SectionLabel>생년월일</SectionLabel>
                <div className="grid grid-cols-3 gap-2">
                  {(["birthYear", "birthMonth", "birthDay"] as const).map((f, i) => (
                    <input key={f} type="number" placeholder={["년(4자리)", "월", "일"][i]}
                      value={data[f]} onChange={e => set(f, e.target.value)}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-[13px] text-center"
                    />
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {([["height", "키 (cm)", "예: 170"], ["weight", "체중 (kg)", "예: 65"]] as const).map(([f, label, ph]) => (
                  <div key={f} className="space-y-1">
                    <SectionLabel>{label}</SectionLabel>
                    <input type="number" placeholder={ph} value={data[f]}
                      onChange={e => set(f, e.target.value)}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-[13px]"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* STEP 3: 생활 정보 */}
          {step === 3 && (
            <div className="space-y-5">
              <div className="space-y-2">
                <SectionLabel>현재 어떤 일을 하고 계신가요?</SectionLabel>
                <div className="flex flex-wrap gap-2">
                  {["회사원", "학생", "자영업", "주부", "생산직", "서비스직", "프리랜서", "기타"].map(o => (
                    <Chip key={o} label={o} selected={data.occupation === o} onClick={() => set("occupation", data.occupation === o ? "" : o)} />
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <SectionLabel>하루 대부분 어떤 자세로 보내시나요?</SectionLabel>
                <div className="flex flex-wrap gap-2">
                  {["대부분 앉아있어요", "오래 서있어요", "많이 걸어요", "힘쓰는 일을 해요", "운전을 많이 합니다"].map(w => (
                    <Chip key={w} label={w} selected={data.workEnvironment === w} onClick={() => set("workEnvironment", data.workEnvironment === w ? "" : w)} />
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <SectionLabel>운동은 얼마나 해보셨나요?</SectionLabel>
                <div className="flex flex-wrap gap-2">
                  {["처음입니다.", "6개월 미만", "1년 이상", "3년 이상", "꾸준히 운동 중입니다."].map(e => (
                    <Chip key={e} label={e} selected={data.exerciseExperience === e} onClick={() => set("exerciseExperience", data.exerciseExperience === e ? "" : e)} />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: 운동 목표 */}
          {step === 4 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[12px] text-gray-400">최대 3개까지 선택할 수 있어요</p>
                <span className={`text-[12px] font-bold ${data.goals.length === 3 ? "text-[#1D4ED8]" : "text-gray-400"}`}>
                  {data.goals.length} / 3
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {["체중감량", "근육증가", "체형교정", "자세교정", "허리통증 개선", "어깨통증 개선", "무릎통증 개선", "체력향상", "건강관리", "재활 후 운동", "출산 후 운동", "시니어 건강관리"].map(g => (
                  <Chip key={g} label={g} selected={data.goals.includes(g)}
                    onClick={() => {
                      if (data.goals.includes(g)) set("goals", data.goals.filter(x => x !== g));
                      else if (data.goals.length < 3) set("goals", [...data.goals, g]);
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* STEP 5: 생활 습관 */}
          {step === 5 && (
            <div className="space-y-5">
              {[
                { label: "평소 식사는 어떤 편인가요?", key: "dietHabits" as const, opts: ["끼니를 자주 거른다.", "단백질을 잘 먹지 않는다.", "야식을 자주 먹는다.", "폭식하는 편이다.", "규칙적으로 먹는다."] },
                { label: "평소 음주는 어떤 편인가요?", key: "drinkingHabits" as const, opts: ["거의 마시지 않는다.", "주 1~2회", "주 3회 이상", "회식이 많다."] },
                { label: "잠은 어떤 편인가요?", key: "sleepHabits" as const, opts: ["6시간 미만", "잠이 잘 오지 않는다.", "자고 일어나도 피곤하다.", "7시간 이상 충분히 잔다."] },
                { label: "하루 활동량은 어떤 편인가요?", key: "activityHabits" as const, opts: ["하루 대부분 앉아있다.", "하루 5천보 미만", "운동을 거의 하지 않는다.", "활동량이 많은 편이다."] },
              ].map(s => (
                <div key={s.key} className="space-y-2">
                  <SectionLabel>{s.label}</SectionLabel>
                  <div className="flex flex-wrap gap-2">
                    {s.opts.map(o => (
                      <Chip key={o} label={o} selected={(data[s.key] as string[]).includes(o)} onClick={() => toggle(s.key, o)} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* STEP 6: 건강 상태 */}
          {step === 6 && (
            <div className="space-y-3">
              <p className="text-[12px] text-gray-400">복수 선택 가능 · "없음" 선택 시 다음으로 넘어가요</p>
              <div className="flex flex-wrap gap-2">
                {["없음", "고혈압", "당뇨", "고지혈증", "비만", "골다공증", "허리디스크", "목디스크", "관절염", "갑상선질환", "심장질환", "기타"].map(d => (
                  <Chip key={d} label={d} selected={data.diagnoses.includes(d)}
                    onClick={() => {
                      if (d === "없음") { set("diagnoses", data.diagnoses.includes("없음") ? [] : ["없음"]); }
                      else {
                        const without = data.diagnoses.filter(x => x !== "없음");
                        setData(p => ({ ...p, diagnoses: without.includes(d) ? without.filter(x => x !== d) : [...without, d] }));
                      }
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* STEP 7: 건강 수치 */}
          {step === 7 && (
            <div className="space-y-3">
              <p className="text-[12px] text-gray-400">최근 건강검진 결과를 알고 계시면 입력해주세요. 모르시면 그냥 넘어가셔도 됩니다.</p>
              {([
                ["systolicBP",       "혈압(수축기)",   "예: 120", "정상 90~120"],
                ["diastolicBP",      "혈압(이완기)",   "예: 80",  "정상 60~80"],
                ["waistCircumference","허리둘레(cm)",  "예: 85",  "남 90 미만 / 여 85 미만"],
                ["fastingGlucose",   "공복혈당",       "예: 95",  "정상 70~99"],
                ["hba1c",            "HbA1c(%)",       "예: 5.5", "정상 5.7% 미만"],
                ["totalCholesterol", "총콜레스테롤",   "예: 180", "정상 200 미만"],
                ["hdl",              "HDL",            "예: 55",  "남 40↑ / 여 50↑"],
                ["ldl",              "LDL",            "예: 100", "정상 130 미만"],
                ["triglycerides",    "중성지방",       "예: 120", "정상 150 미만"],
                ["boneDensity",      "골밀도(T-score)","예: -0.5","정상 -1.0 이상"],
              ] as const).map(([f, label, ph, norm]) => (
                <div key={f} className="bg-gray-50 rounded-xl px-3 py-2.5 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] font-semibold text-[#1a2b4b]">{label}</span>
                    <span className="text-[10px] text-gray-400 bg-white border border-gray-200 rounded-full px-2 py-0.5">{norm}</span>
                  </div>
                  <input type="number" placeholder={ph} value={data[f]}
                    onChange={e => set(f, e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-[13px] bg-white"
                  />
                </div>
              ))}
            </div>
          )}

          {/* STEP 8: 통증 체크 */}
          {step === 8 && (
            <div className="space-y-5">
              <div className="space-y-2">
                <SectionLabel>현재 불편한 부위가 있나요?</SectionLabel>
                <div className="flex flex-wrap gap-2">
                  {["목", "어깨", "팔꿈치", "손목", "허리", "골반", "고관절", "무릎", "발목", "발", "없음"].map(a => (
                    <Chip key={a} label={a} selected={data.painAreas.includes(a)}
                      onClick={() => {
                        if (a === "없음") { set("painAreas", data.painAreas.includes("없음") ? [] : ["없음"]); }
                        else {
                          const without = data.painAreas.filter(x => x !== "없음");
                          setData(p => ({ ...p, painAreas: without.includes(a) ? without.filter(x => x !== a) : [...without, a] }));
                        }
                      }}
                    />
                  ))}
                </div>
              </div>

              {!data.painAreas.includes("없음") && data.painAreas.length > 0 && (<>
                <div className="space-y-2">
                  <SectionLabel>언제부터 불편했나요?</SectionLabel>
                  <div className="flex flex-wrap gap-2">
                    {["최근 생김", "1개월 이상", "3개월 이상", "오래전부터"].map(d => (
                      <Chip key={d} label={d} selected={data.painDuration === d} onClick={() => set("painDuration", d)} />
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <SectionLabel>현재 통증 정도는?</SectionLabel>
                    <span className="text-[13px] font-bold text-[#1D4ED8]">{data.painLevel} / 10</span>
                  </div>
                  <input type="range" min={0} max={10} value={data.painLevel}
                    onChange={e => set("painLevel", parseInt(e.target.value))}
                    className="w-full accent-[#1D4ED8]"
                  />
                  <div className="flex justify-between text-[10px] text-gray-400">
                    <span>0 통증 없음</span><span>10 매우 심함</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <SectionLabel>언제 가장 불편한가요?</SectionLabel>
                  <div className="flex flex-wrap gap-2">
                    {["걸을 때", "오래 앉아있을 때", "오래 서있을 때", "계단을 오를 때", "운동할 때", "아침", "저녁"].map(t => (
                      <Chip key={t} label={t} selected={data.painTiming.includes(t)} onClick={() => toggle("painTiming", t)} />
                    ))}
                  </div>
                </div>
              </>)}
            </div>
          )}

          {/* STEP 9: 체형 체크 */}
          {step === 9 && (
            <div className="space-y-3">
              <p className="text-[12px] text-gray-400">거울을 봤을 때 해당되는 항목을 선택해주세요. (복수 선택)</p>
              <div className="flex flex-wrap gap-2">
                {["어깨 높이가 다른 것 같다.", "허리가 한쪽으로 기운 것 같다.", "골반이 틀어진 느낌이다.", "다리 길이가 다른 느낌이다.", "오다리 같다.", "X다리 같다.", "거북목인 것 같다.", "등이 굽은 것 같다.", "잘 모르겠다."].map(p => (
                  <Chip key={p} label={p} selected={data.postureIssues.includes(p)} onClick={() => toggle("postureIssues", p)} />
                ))}
              </div>
            </div>
          )}

          {/* STEP 10: 운동 안전 체크 */}
          {step === 10 && (
            <div className="space-y-3">
              <p className="text-[12px] text-gray-400">모든 항목에 답해주세요</p>
              {[
                "운동 중 가슴 통증을 느낀 적이 있나요?",
                "의사에게 운동을 제한받은 적이 있나요?",
                "운동 중 어지럽거나 쓰러진 적이 있나요?",
                "심장질환이 있나요?",
                "현재 꾸준히 복용하는 약이 있나요?",
                "최근 수술을 받은 적이 있나요?",
                "현재 임신 중이신가요?",
                "운동 시 특별히 주의해야 하는 질환이 있나요?",
              ].map((q, i) => (
                <div key={i} className="bg-gray-50 rounded-xl p-3.5">
                  <p className="text-[12px] text-[#1a2b4b] font-medium leading-relaxed mb-2.5">{i + 1}. {q}</p>
                  <div className="flex gap-2">
                    {(["no", "yes"] as const).map(ans => (
                      <button key={ans} type="button"
                        onClick={() => setData(p => ({ ...p, safetyAnswers: { ...p.safetyAnswers, [i]: ans } }))}
                        className={`flex-1 py-2 rounded-xl text-[13px] font-semibold border transition-all ${
                          data.safetyAnswers[i] === ans
                            ? ans === "yes" ? "bg-red-500 text-white border-red-500" : "bg-[#1D4ED8] text-white border-[#1D4ED8]"
                            : "bg-white text-gray-400 border-gray-200"
                        }`}
                      >
                        {ans === "yes" ? "예" : "아니오"}
                      </button>
                    ))}
                  </div>
                </div>
              ))}

              {hasYesSafety && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex items-start gap-2">
                  <span className="text-lg flex-shrink-0">⚠️</span>
                  <p className="text-[12px] text-yellow-800 font-medium leading-relaxed">
                    회원님의 안전한 운동을 위해 전문 트레이너가 추가 상담을 진행합니다.
                  </p>
                </div>
              )}
            </div>
          )}

        </div>

        {/* Navigation */}
        <div className="px-5 py-4 border-t border-gray-100 flex-shrink-0 flex gap-3">
          {step > 1 && (
            <button onClick={() => setStep(s => s - 1)}
              className="flex-1 h-12 border border-gray-200 rounded-xl text-[13px] font-semibold text-gray-600"
            >
              ← 이전
            </button>
          )}
          <button
            onClick={handleNext}
            disabled={!canNext() || upsert.isPending}
            className="flex-1 h-12 bg-[#1D4ED8] text-white rounded-xl text-[14px] font-bold disabled:opacity-40 transition-opacity"
          >
            {upsert.isPending ? "저장 중..." : step === TOTAL ? "제출하기" : "다음 →"}
          </button>
        </div>
      </div>
    </div>
  );
}
