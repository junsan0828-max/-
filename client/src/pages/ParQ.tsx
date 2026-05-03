import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { ArrowLeft, CheckCircle2 } from "lucide-react";

interface Props { memberId: number; }

type FormState = {
  height: string; weight: string;
  occupation: string; workEnvironment: string;
  exerciseExperience: string;
  goal1: string; goal2: string; goal3: string;
  dietIssues: string; alcoholIssues: string;
  sleepIssues: string; activityIssues: string;
  chronicDiseases: string;
  systolicBp: string; diastolicBp: string;
  waistCircumference: string;
  totalCholesterol: string; hdlCholesterol: string; ldlCholesterol: string;
  triglycerides: string; fastingBloodSugar: string;
  postMealBloodSugar: string; hba1c: string; boneDensity: string;
  musculoskeletalIssues: string; posturalIssues: string;
  // unused but kept for DB compat
  muscleMass: string; bodyFatPercent: string; bodyFatKg: string; visitRoute: string;
};

const empty: FormState = {
  height: "", weight: "",
  occupation: "", workEnvironment: "", exerciseExperience: "",
  goal1: "", goal2: "", goal3: "",
  dietIssues: "", alcoholIssues: "", sleepIssues: "", activityIssues: "",
  chronicDiseases: "",
  systolicBp: "", diastolicBp: "",
  waistCircumference: "", totalCholesterol: "", hdlCholesterol: "",
  ldlCholesterol: "", triglycerides: "", fastingBloodSugar: "",
  postMealBloodSugar: "", hba1c: "", boneDensity: "",
  musculoskeletalIssues: "", posturalIssues: "",
  muscleMass: "", bodyFatPercent: "", bodyFatKg: "", visitRoute: "",
};

// ─── 상수 ─────────────────────────────────────────────────────────────────────
const HEIGHT_OPTS = Array.from({ length: 81 }, (_, i) => `${140 + i}`);
const WEIGHT_OPTS = Array.from({ length: 121 }, (_, i) => `${30 + i}`);

const GOAL_OPTS = [
  "자세교정", "다이어트", "근력 증가", "근육량 증가",
  "기초체력 증가", "운동 습관", "통증 감소", "재활 운동",
];

const DIET_ITEMS = [
  "A. 하루 식사 시간이 일정하지 않거나 끼니를 자주 거른다.",
  "B. 하루 단백질 섭취량이 부족하거나(체중 x 1g 이하) 식단 구성이 한쪽으로 치우친다.",
  "C. 스트레스나 감정 변화로 인해 폭식 또는 과식을 경험한다.",
  "D. 저녁 9시 이후 야식 또는 고칼로리 간식을 자주 섭취한다.",
];
const ALCOHOL_ITEMS = [
  "A. 주 3회 이상 음주하거나 1회 음주량이 평균 3잔 이상이다.",
  "B. 한 번 술을 마시면 마무리가 잘 안 되어 과음하는 경우가 있다.",
  "C. 스트레스 해소를 술에 의존하는 편이다.",
  "D. 회식·약속 등으로 인해 운동 다음 날 컨디션이 떨어지는 경우가 잦다.",
];
const SLEEP_ITEMS = [
  "A. 밤에 자주 깨거나(2회 이상) 수면 중단이 반복된다.",
  "B. 아침에 일어나도 개운하지 않고 지속적으로 피곤하다.",
  "C. 잠드는 데 30분 이상 걸리거나 누워도 쉽게 잠들지 못한다.",
  "D. 수면 시간이 일정하지 않거나 6시간 미만으로 자는 날이 많다.",
];
const ACTIVITY_ITEMS = [
  "A. 하루 활동량(걸음 수)이 5,000보 미만인 날이 많다.",
  "B. 하루 중 앉아 있는 시간이 6시간 이상으로 길다.",
  "C. 주 2회 이상 규칙적인 운동(근력 또는 유산소)을 하지 않는다.",
  "D. 계단 오르기 / 짧은 거리 이동 등 기본 활동에서도 숨이 차거나 피로를 느낀다.",
];

const BODY_PARTS = [
  "목/경추", "어깨(우)", "어깨(좌)", "팔꿈치(우)", "팔꿈치(좌)",
  "손목/손(우)", "손목/손(좌)", "등/흉추", "허리/요추",
  "고관절(우)", "고관절(좌)", "무릎(우)", "무릎(좌)",
  "발목/발(우)", "발목/발(좌)", "기타",
];

const MUSK_DIAGNOSIS = [
  "추간판 탈출증(디스크)", "척추관 협착증", "회전근개 파열/손상",
  "반월판 손상", "인대 파열/손상", "골절(현재 또는 과거)",
  "골관절염", "류마티스 관절염", "기타",
];

// ─── 서브 컴포넌트 ─────────────────────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <h2 className="text-sm font-bold text-primary border-b border-primary/30 pb-2 uppercase tracking-wide">{title}</h2>
      {children}
    </div>
  );
}

function Dropdown({ label, value, options, onChange, placeholder }: {
  label: string; value: string; options: string[];
  onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs text-muted-foreground">{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)}
        className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring">
        <option value="">{placeholder ?? "선택"}</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

function CheckboxGroup({ title, items, value, onChange }: {
  title: string; items: string[]; value: string; onChange: (v: string) => void;
}) {
  const letters = ["A", "B", "C", "D"];
  const checked = value ? value.split(",").filter(Boolean) : [];
  const toggle = (l: string) => {
    const next = checked.includes(l) ? checked.filter(x => x !== l) : [...checked, l];
    onChange(next.join(","));
  };
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-foreground">{title}</p>
      <div className="space-y-2.5">
        {items.map((item, i) => {
          const l = letters[i];
          const on = checked.includes(l);
          return (
            <label key={l} onClick={() => toggle(l)}
              className="flex items-start gap-3 cursor-pointer group">
              <div className={`mt-0.5 w-4 h-4 shrink-0 rounded border-2 flex items-center justify-center transition-colors ${on ? "bg-primary border-primary" : "border-border group-hover:border-primary/50"}`}>
                {on && <svg className="w-2.5 h-2.5 text-primary-foreground" fill="currentColor" viewBox="0 0 12 12">
                  <path d="M10.28 2.28L3.989 8.575 1.695 6.28A1 1 0 00.28 7.695l3 3a1 1 0 001.414 0l7-7A1 1 0 0010.28 2.28z" />
                </svg>}
              </div>
              <span className="text-sm text-foreground leading-snug">{item}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

function HealthRow({ label, hint, value, onChange, unit }: {
  label: string; hint?: string; value: string; onChange: (v: string) => void; unit?: string;
}) {
  const isNormal = value === "이상없음";
  return (
    <div className="flex items-start gap-3">
      <div className="flex-1 space-y-1">
        <div className="text-xs text-muted-foreground leading-snug">
          {label}
          {hint && <span className="text-primary ml-1">({hint})</span>}
          {unit && <span className="text-muted-foreground ml-1">{unit}</span>}
        </div>
        <Input value={isNormal ? "" : value} onChange={e => onChange(e.target.value)}
          disabled={isNormal} placeholder="직접 입력"
          className={`h-9 text-sm ${isNormal ? "opacity-40" : ""}`} />
      </div>
      <button type="button" onClick={() => onChange(isNormal ? "" : "이상없음")}
        className={`mt-5 shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs border transition-colors ${
          isNormal ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40" : "border-border text-muted-foreground hover:border-emerald-500/40 hover:text-emerald-400"
        }`}>
        {isNormal && <CheckCircle2 className="h-3 w-3" />}
        이상없음
      </button>
    </div>
  );
}

function BpRow({ systolic, diastolic, onSystolic, onDiastolic }: {
  systolic: string; diastolic: string;
  onSystolic: (v: string) => void; onDiastolic: (v: string) => void;
}) {
  const isNormal = systolic === "이상없음";
  const toggle = () => {
    if (isNormal) { onSystolic(""); onDiastolic(""); }
    else { onSystolic("이상없음"); onDiastolic("이상없음"); }
  };
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="text-xs text-muted-foreground">수축기혈압 / 이완기혈압 <span className="text-primary">(120/80 정상)</span> <span>mmHg</span></div>
        <button type="button" onClick={toggle}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs border transition-colors ${isNormal ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40" : "border-border text-muted-foreground hover:border-emerald-500/40 hover:text-emerald-400"}`}>
          {isNormal && <CheckCircle2 className="h-3 w-3" />}이상없음
        </button>
      </div>
      <div className="flex gap-2">
        <Input value={isNormal ? "" : systolic} onChange={e => onSystolic(e.target.value)}
          disabled={isNormal} placeholder="수축기" className={`h-9 text-sm ${isNormal ? "opacity-40" : ""}`} />
        <span className="self-center text-muted-foreground">/</span>
        <Input value={isNormal ? "" : diastolic} onChange={e => onDiastolic(e.target.value)}
          disabled={isNormal} placeholder="이완기" className={`h-9 text-sm ${isNormal ? "opacity-40" : ""}`} />
      </div>
    </div>
  );
}

// ─── 메인 컴포넌트 ─────────────────────────────────────────────────────────────
export default function ParQ({ memberId }: Props) {
  const [, setLocation] = useLocation();
  const [form, setForm] = useState<FormState>(empty);

  const { data: member } = trpc.members.getById.useQuery({ id: memberId });
  const { data: existing } = trpc.parQ.get.useQuery({ memberId });

  useEffect(() => {
    if (existing) {
      setForm({
        height: existing.height ?? "",
        weight: existing.weight ?? "",
        occupation: existing.occupation ?? "",
        workEnvironment: existing.workEnvironment ?? "",
        exerciseExperience: existing.exerciseExperience ?? "",
        goal1: existing.goal1 ?? "",
        goal2: existing.goal2 ?? "",
        goal3: existing.goal3 ?? "",
        dietIssues: existing.dietIssues ?? "",
        alcoholIssues: existing.alcoholIssues ?? "",
        sleepIssues: existing.sleepIssues ?? "",
        activityIssues: existing.activityIssues ?? "",
        chronicDiseases: existing.chronicDiseases ?? "",
        systolicBp: existing.systolicBp ?? "",
        diastolicBp: existing.diastolicBp ?? "",
        waistCircumference: existing.waistCircumference ?? "",
        totalCholesterol: existing.totalCholesterol ?? "",
        hdlCholesterol: existing.hdlCholesterol ?? "",
        ldlCholesterol: existing.ldlCholesterol ?? "",
        triglycerides: existing.triglycerides ?? "",
        fastingBloodSugar: existing.fastingBloodSugar ?? "",
        postMealBloodSugar: existing.postMealBloodSugar ?? "",
        hba1c: existing.hba1c ?? "",
        boneDensity: existing.boneDensity ?? "",
        musculoskeletalIssues: existing.musculoskeletalIssues ?? "",
        posturalIssues: existing.posturalIssues ?? "",
        muscleMass: existing.muscleMass ?? "",
        bodyFatPercent: existing.bodyFatPercent ?? "",
        bodyFatKg: existing.bodyFatKg ?? "",
        visitRoute: existing.visitRoute ?? "",
      });
    }
  }, [existing]);

  const upsertMutation = trpc.parQ.upsert.useMutation({
    onSuccess: () => { toast.success("저장되었습니다."); setLocation(`/members/${memberId}`); },
    onError: (err) => toast.error(err.message || "저장 실패"),
  });

  const set = (key: keyof FormState) => (v: string) => setForm(p => ({ ...p, [key]: v }));

  const hospitalNone = form.chronicDiseases === "이상없음";

  return (
    <div className="space-y-4 pb-8">
      {/* 헤더 */}
      <div className="flex items-center gap-3">
        <button onClick={() => setLocation(`/members/${memberId}`)} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-base font-bold">{member?.name ?? "..."}</h1>
          <p className="text-xs text-muted-foreground">사전건강검사 (PAR-Q)</p>
        </div>
      </div>

      <div className="space-y-6">

        {/* ① 기본 건강 정보 */}
        <div className="bg-card border border-border rounded-xl p-4 space-y-4">
          <Section title="기본 건강 정보">
            <div className="grid grid-cols-2 gap-3">
              <Dropdown label="키 (cm)" value={form.height} options={HEIGHT_OPTS} onChange={set("height")} placeholder="선택" />
              <Dropdown label="체중 (kg)" value={form.weight} options={WEIGHT_OPTS} onChange={set("weight")} placeholder="선택" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">직업</label>
              <Input value={form.occupation} onChange={e => set("occupation")(e.target.value)} placeholder="예: 사무직" className="text-sm" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">근무 환경</label>
              <Input value={form.workEnvironment} onChange={e => set("workEnvironment")(e.target.value)} placeholder="예: 장시간 앉아서 근무" className="text-sm" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">운동 경험</label>
              <Input value={form.exerciseExperience} onChange={e => set("exerciseExperience")(e.target.value)} placeholder="예: 헬스 1년, 수영 6개월" className="text-sm" />
            </div>
          </Section>
        </div>

        {/* ② 운동 목적 */}
        <div className="bg-card border border-border rounded-xl p-4 space-y-4">
          <Section title="운동 목적">
            <Dropdown label="운동 목적 1" value={form.goal1} options={GOAL_OPTS} onChange={set("goal1")} placeholder="선택 안함" />
            <Dropdown label="운동 목적 2" value={form.goal2} options={GOAL_OPTS} onChange={set("goal2")} placeholder="선택 안함" />
            <Dropdown label="운동 목적 3" value={form.goal3} options={GOAL_OPTS} onChange={set("goal3")} placeholder="선택 안함" />
          </Section>
        </div>

        {/* ③ 생활 습관 */}
        <div className="bg-card border border-border rounded-xl p-4 space-y-5">
          <Section title="생활 습관">
            <CheckboxGroup title="식단 문제 체크" items={DIET_ITEMS} value={form.dietIssues} onChange={set("dietIssues")} />
            <div className="border-t border-border/50 pt-4">
              <CheckboxGroup title="음주 문제 체크" items={ALCOHOL_ITEMS} value={form.alcoholIssues} onChange={set("alcoholIssues")} />
            </div>
            <div className="border-t border-border/50 pt-4">
              <CheckboxGroup title="수면 문제 체크" items={SLEEP_ITEMS} value={form.sleepIssues} onChange={set("sleepIssues")} />
            </div>
            <div className="border-t border-border/50 pt-4">
              <CheckboxGroup title="활동 문제 체크" items={ACTIVITY_ITEMS} value={form.activityIssues} onChange={set("activityIssues")} />
            </div>
          </Section>
        </div>

        {/* ④ 병원 진단 */}
        <div className="bg-card border border-border rounded-xl p-4 space-y-4">
          <Section title="병원 진단">
            <p className="text-sm text-foreground">병원에서 진단 받으신 내용 있으신가요?</p>
            <label onClick={() => set("chronicDiseases")(hospitalNone ? "" : "이상없음")}
              className="flex items-center gap-3 cursor-pointer">
              <div className={`w-4 h-4 shrink-0 rounded border-2 flex items-center justify-center transition-colors ${hospitalNone ? "bg-primary border-primary" : "border-border"}`}>
                {hospitalNone && <svg className="w-2.5 h-2.5 text-primary-foreground" fill="currentColor" viewBox="0 0 12 12">
                  <path d="M10.28 2.28L3.989 8.575 1.695 6.28A1 1 0 00.28 7.695l3 3a1 1 0 001.414 0l7-7A1 1 0 0010.28 2.28z" />
                </svg>}
              </div>
              <span className="text-sm text-foreground">해당 사항 없음</span>
            </label>
            {!hospitalNone && (
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">진단 내용 직접 입력</label>
                <Input value={form.chronicDiseases} onChange={e => set("chronicDiseases")(e.target.value)} placeholder="예: 고혈압, 당뇨 등" className="text-sm" />
              </div>
            )}
          </Section>
        </div>

        {/* ⑤ 질환 정보 */}
        <div className="bg-card border border-border rounded-xl p-4 space-y-4">
          <Section title="질환 정보">
            <BpRow systolic={form.systolicBp} diastolic={form.diastolicBp}
              onSystolic={set("systolicBp")} onDiastolic={set("diastolicBp")} />
            <HealthRow label="허리둘레" hint="남 85 이하 정상, 여 80 이하 정상" unit="cm"
              value={form.waistCircumference} onChange={set("waistCircumference")} />
            <HealthRow label="총콜레스테롤" hint="200 이하 정상" unit="mg/dL"
              value={form.totalCholesterol} onChange={set("totalCholesterol")} />
            <HealthRow label="HDL콜레스테롤" hint="60 이상 정상" unit="mg/dL"
              value={form.hdlCholesterol} onChange={set("hdlCholesterol")} />
            <HealthRow label="LDL콜레스테롤" hint="100 이하 정상" unit="mg/dL"
              value={form.ldlCholesterol} onChange={set("ldlCholesterol")} />
            <HealthRow label="중성지방" hint="150 이하 정상" unit="mg/dL"
              value={form.triglycerides} onChange={set("triglycerides")} />
            <HealthRow label="공복 혈당" hint="100 이하 정상" unit="mg/dL"
              value={form.fastingBloodSugar} onChange={set("fastingBloodSugar")} />
            <HealthRow label="식후 2시간 혈당" hint="140 이하 정상" unit="mg/dL"
              value={form.postMealBloodSugar} onChange={set("postMealBloodSugar")} />
            <HealthRow label="당화혈색소 (HbA1c)" hint="5.7 이하 정상" unit="%"
              value={form.hba1c} onChange={set("hba1c")} />
            <HealthRow label="골밀도 T-score" hint="-1.0 이상 정상"
              value={form.boneDensity} onChange={set("boneDensity")} />
          </Section>
        </div>

        {/* ⑥ 근골격계 */}
        <div className="bg-card border border-border rounded-xl p-4 space-y-4">
          <Section title="근골격계">
            <Dropdown label="근골격계에 대한 진단 받으신 내용"
              value={form.musculoskeletalIssues.split("|")[0] ?? ""}
              options={MUSK_DIAGNOSIS}
              onChange={v => set("musculoskeletalIssues")(v)}
              placeholder="해당 없음" />
            <Dropdown label="'만성 통증' 부위"
              value={form.musculoskeletalIssues.split("|")[1] ?? ""}
              options={BODY_PARTS}
              onChange={v => {
                const parts = form.musculoskeletalIssues.split("|");
                parts[1] = v;
                set("musculoskeletalIssues")(parts.join("|"));
              }}
              placeholder="해당 없음" />
            <Dropdown label="'급성 통증' 및 '외상(부상)' 부위"
              value={form.musculoskeletalIssues.split("|")[2] ?? ""}
              options={BODY_PARTS}
              onChange={v => {
                const parts = form.musculoskeletalIssues.split("|");
                parts[2] = v;
                set("musculoskeletalIssues")(parts.join("|"));
              }}
              placeholder="해당 없음" />
            <Dropdown label="'불균형'이라고 느끼는 부위"
              value={form.musculoskeletalIssues.split("|")[3] ?? ""}
              options={BODY_PARTS}
              onChange={v => {
                const parts = form.musculoskeletalIssues.split("|");
                parts[3] = v;
                set("musculoskeletalIssues")(parts.join("|"));
              }}
              placeholder="해당 없음" />
          </Section>
        </div>

        {/* ⑦ 체형 문제 (추가 이미지 확인 후 업데이트 예정) */}
        <div className="bg-card border border-border rounded-xl p-4 space-y-4">
          <Section title="체형 문제">
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">전면 / 후면 체형 문제</label>
              <Input value={form.posturalIssues} onChange={e => set("posturalIssues")(e.target.value)}
                placeholder="예: 거북목, 라운드숄더, 골반 틀어짐 등" className="text-sm" />
            </div>
          </Section>
        </div>

      </div>

      {/* 저장 버튼 */}
      <div className="flex gap-3 pt-2">
        <button onClick={() => upsertMutation.mutate({ memberId, ...form })}
          disabled={upsertMutation.isPending}
          className="flex-1 bg-primary text-primary-foreground rounded-xl py-3 text-sm font-bold disabled:opacity-50 hover:bg-primary/90 transition-colors">
          {upsertMutation.isPending ? "저장 중..." : "저장"}
        </button>
        <button onClick={() => setLocation(`/members/${memberId}`)}
          className="flex-1 border border-border text-muted-foreground rounded-xl py-3 text-sm font-medium hover:bg-muted/30">
          취소
        </button>
      </div>
    </div>
  );
}
