import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Check, ChevronDown } from "lucide-react";

interface Props { memberId: number; }

// ── 상수 ──────────────────────────────────────────────────────────────────────

const HEIGHT_OPTIONS = ["140미만","140-145","145-150","150-155","155-160","160-165","165-170","170-175","175-180","180-185","185-190","190이상"];
const WEIGHT_OPTIONS = ["40미만","40-45","45-50","50-55","55-60","60-65","65-70","70-75","75-80","80-85","85-90","90-95","95-100","100이상"];

const GOAL_OPTIONS = [
  "다이어트 (체중 감량)","체형교정 (자세 개선)","통증 개선 (목/허리/무릎 등)",
  "재활 운동 (병원 진단 후 운동)","근력/체력 향상","바디라인 개선 (근육, 몸매)",
  "건강 관리 (예방 목적)","운동 습관 만들기","기타",
];

const DIET_CHECKS = [
  "A. 하루 식사 시간이 일정하지 않거나 끼니를 자주 거른다.",
  "B. 하루 단백질 섭취량이 부족하거나(체중 x 1g 이하) 식단 구성이 한쪽으로 치우친다.",
  "C. 스트레스나 감정 변화로 인해 폭식 또는 과식을 경험한다.",
  "D. 저녁 9시 이후 야식 또는 고칼로리 간식을 자주 섭취한다.",
];
const ALCOHOL_CHECKS = [
  "A. 주 3회 이상 음주하거나 1회 음주량이 평균 3잔 이상이다.",
  "B. 한 번 술을 마시면 마무리가 잘 안 되어 과음하는 경우가 있다.",
  "C. 스트레스 해소를 술에 의존하는 편이다.",
  "D. 회식·약속 등으로 인해 운동 다음 날 컨디션이 떨어지는 경우가 잦다.",
];
const SLEEP_CHECKS = [
  "A. 밤에 자주 깨거나(2회 이상) 수면 중단이 반복된다.",
  "B. 아침에 일어나도 개운하지 않고 지속적으로 피곤하다.",
  "C. 잠드는 데 30분 이상 걸리거나 누워도 쉽게 잠들지 못한다.",
  "D. 수면 시간이 일정하지 않거나 6시간 미만으로 자는 날이 많다.",
];
const ACTIVITY_CHECKS = [
  "A. 하루 활동량(걸음 수)이 5,000보 미만인 날이 많다.",
  "B. 하루 중 앉아 있는 시간이 6시간 이상으로 길다.",
  "C. 주 2회 이상 규칙적인 운동(근력 또는 유산소)을 하지 않는다.",
  "D. 계단 오르기 / 짧은 거리 이동 등 기본 활동에서도 숨이 차거나 피로를 느낀다.",
];

const MEDICAL_DIAGNOSES = [
  "해당 사항 없음","대사증후군","고혈압","당뇨","고지혈증(이상지질)",
  "당뇨병(2형)","비만","골다공증","근감소증",
];

const MUSCULO_PARTS = [
  "목관절","어깨관절","팔꿈치관절","손목관절","척추",
  "등(근육)","허리(근육)","골반/엉치","고관절","무릎관절","발목관절","하퇴(근육)","발",
];
const PAIN_PARTS = ["머리", ...MUSCULO_PARTS];

const FRONT_PARTS = [
  "목","어깨","가슴","팔/팔꿈치","복부","골반",
  "고관절","대퇴","무릎위","무릎","무릎아래","정강이","발목","발",
];
const BACK_PARTS = [
  "목","상부등","등","팔/팔꿈치","허리","엉치","엉덩이",
  "장경인대","햄스트링","오금","무릎아래","종아리","발목","발",
];

// ── 타입 ──────────────────────────────────────────────────────────────────────

type BodySideMap = Record<string, { rt: boolean; lt: boolean }>;

type FormState = {
  height: string; weight: string;
  occupation: string; workEnvironment: string; exerciseExperience: string;
  goal1: string; goal2: string; goal3: string;
  dietChecks: string[]; alcoholChecks: string[]; sleepChecks: string[]; activityChecks: string[];
  diagnoses: string[];
  systolicBp: string; diastolicBp: string;
  waistCircumference: string; totalCholesterol: string; hdlCholesterol: string;
  ldlCholesterol: string; triglycerides: string; fastingBloodSugar: string;
  postMealBloodSugar: string; hba1c: string; boneDensity: string;
  imbalanceAreas: string[]; acuteAreas: string[]; chronicPainAreas: string[];
  posturalFront: BodySideMap; posturalBack: BodySideMap;
};

function initBodyMap(parts: string[]): BodySideMap {
  return Object.fromEntries(parts.map((p) => [p, { rt: false, lt: false }]));
}

const empty: FormState = {
  height: "", weight: "",
  occupation: "", workEnvironment: "", exerciseExperience: "",
  goal1: "", goal2: "", goal3: "",
  dietChecks: [], alcoholChecks: [], sleepChecks: [], activityChecks: [],
  diagnoses: [],
  systolicBp: "", diastolicBp: "",
  waistCircumference: "", totalCholesterol: "", hdlCholesterol: "",
  ldlCholesterol: "", triglycerides: "", fastingBloodSugar: "",
  postMealBloodSugar: "", hba1c: "", boneDensity: "",
  imbalanceAreas: [], acuteAreas: [], chronicPainAreas: [],
  posturalFront: initBodyMap(FRONT_PARTS),
  posturalBack: initBodyMap(BACK_PARTS),
};

// ── 유틸 ──────────────────────────────────────────────────────────────────────

function parseArr(v: string | null | undefined): string[] {
  if (!v) return [];
  try { return JSON.parse(v); } catch { return v ? [v] : []; }
}
function parseObj(v: string | null | undefined): Record<string, unknown> {
  if (!v) return {};
  try { return JSON.parse(v); } catch { return {}; }
}
function mergeBodyMap(defaults: BodySideMap, saved: unknown): BodySideMap {
  if (!saved || typeof saved !== "object") return defaults;
  const result = { ...defaults };
  for (const [k, v] of Object.entries(saved as Record<string, unknown>)) {
    if (k in result && v && typeof v === "object") {
      result[k] = { rt: !!(v as any).rt, lt: !!(v as any).lt };
    }
  }
  return result;
}

// ── 공통 UI 컴포넌트 ──────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-xl p-5 space-y-4">
      <h2 className="text-base font-bold text-primary border-b border-border pb-2">{title}</h2>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

function RangeSelect({ label, value, options, onChange }: {
  label: string; value: string; options: string[]; onChange: (v: string) => void;
}) {
  return (
    <Field label={label}>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full appearance-none bg-input border border-border rounded-lg px-3 py-2.5 text-sm text-foreground pr-8"
        >
          <option value="">선택</option>
          {options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
      </div>
    </Field>
  );
}

function GoalSelect({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <Field label={label}>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full appearance-none bg-input border border-border rounded-lg px-3 py-2.5 text-sm text-foreground pr-8"
        >
          <option value="">선택 안함</option>
          {GOAL_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
      </div>
    </Field>
  );
}

function CheckGroup({ title, items, selected, onChange }: {
  title: string; items: string[]; selected: string[]; onChange: (v: string[]) => void;
}) {
  const toggle = (item: string) =>
    onChange(selected.includes(item) ? selected.filter((s) => s !== item) : [...selected, item]);
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-foreground">{title}</p>
      {items.map((item) => (
        <button
          key={item}
          type="button"
          onClick={() => toggle(item)}
          className={`w-full flex items-start gap-3 px-3 py-3 rounded-lg border text-left transition-colors ${
            selected.includes(item)
              ? "bg-primary/10 border-primary/30 text-foreground"
              : "border-border text-muted-foreground hover:border-primary/20"
          }`}
        >
          <div className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
            selected.includes(item) ? "bg-primary border-primary" : "border-muted-foreground/50"
          }`}>
            {selected.includes(item) && <Check className="h-3 w-3 text-white" />}
          </div>
          <span className="text-sm leading-snug">{item}</span>
        </button>
      ))}
    </div>
  );
}

function SimpleCheckList({ items, selected, onChange }: {
  items: string[]; selected: string[]; onChange: (v: string[]) => void;
}) {
  const toggle = (item: string) =>
    onChange(selected.includes(item) ? selected.filter((s) => s !== item) : [...selected, item]);
  return (
    <div className="space-y-1">
      {items.map((item) => (
        <button
          key={item}
          type="button"
          onClick={() => toggle(item)}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left transition-colors text-sm ${
            selected.includes(item)
              ? "bg-primary/10 border-primary/30 text-foreground"
              : "border-transparent text-muted-foreground hover:border-border"
          }`}
        >
          <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
            selected.includes(item) ? "bg-primary border-primary" : "border-muted-foreground/50"
          }`}>
            {selected.includes(item) && <Check className="h-3 w-3 text-white" />}
          </div>
          {item}
        </button>
      ))}
    </div>
  );
}

function HealthField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const isNormal = value === "정상";
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <label className="text-sm text-muted-foreground flex-1" dangerouslySetInnerHTML={{ __html: label }} />
        <button
          type="button"
          onClick={() => onChange(isNormal ? "" : "정상")}
          className={`text-xs px-2.5 py-1 rounded-lg border shrink-0 transition-colors ${
            isNormal ? "bg-primary/20 border-primary/40 text-primary" : "border-border text-muted-foreground hover:border-primary/30"
          }`}
        >
          이상없음
        </button>
      </div>
      {!isNormal && (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="직접 입력"
          className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
        />
      )}
    </div>
  );
}

function BpField({ systolic, diastolic, onChange }: {
  systolic: string; diastolic: string;
  onChange: (s: string, d: string) => void;
}) {
  const isNormal = systolic === "정상";
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <label className="text-sm text-muted-foreground">
          수축기혈압 / 이완기혈압 <span className="text-primary">(120/80 정상)</span> mmHg
        </label>
        <button
          type="button"
          onClick={() => onChange(isNormal ? "" : "정상", isNormal ? "" : "")}
          className={`text-xs px-2.5 py-1 rounded-lg border shrink-0 transition-colors ${
            isNormal ? "bg-primary/20 border-primary/40 text-primary" : "border-border text-muted-foreground hover:border-primary/30"
          }`}
        >
          이상없음
        </button>
      </div>
      {!isNormal && (
        <div className="flex items-center gap-2">
          <input
            value={systolic}
            onChange={(e) => onChange(e.target.value, diastolic)}
            placeholder="수축기"
            className="flex-1 bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
          />
          <span className="text-muted-foreground">/</span>
          <input
            value={diastolic}
            onChange={(e) => onChange(systolic, e.target.value)}
            placeholder="이완기"
            className="flex-1 bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
          />
        </div>
      )}
    </div>
  );
}

function BodyTable({ parts, data, onChange }: {
  parts: string[];
  data: BodySideMap;
  onChange: (part: string, side: "rt" | "lt", val: boolean) => void;
}) {
  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <div className="grid grid-cols-[1fr_56px_56px] bg-muted/30 border-b border-border">
        <div className="px-3 py-2 text-xs text-muted-foreground" />
        <div className="py-2 text-xs text-center text-muted-foreground font-medium">RT</div>
        <div className="py-2 text-xs text-center text-muted-foreground font-medium">LT</div>
      </div>
      {parts.map((part) => (
        <div key={part} className="grid grid-cols-[1fr_56px_56px] border-b border-border last:border-b-0">
          <div className="px-3 py-3 text-sm text-foreground">{part}</div>
          {(["rt", "lt"] as const).map((side) => (
            <button
              key={side}
              type="button"
              onClick={() => onChange(part, side, !data[part]?.[side])}
              className="flex items-center justify-center py-3"
            >
              <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                data[part]?.[side]
                  ? "bg-primary border-primary"
                  : "border-muted-foreground/40 hover:border-primary/50"
              }`}>
                {data[part]?.[side] && <Check className="h-3 w-3 text-white" />}
              </div>
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}

// ── 메인 컴포넌트 ─────────────────────────────────────────────────────────────

export default function ParQ({ memberId }: Props) {
  const [, setLocation] = useLocation();
  const [form, setForm] = useState<FormState>(empty);

  const { data: member } = trpc.members.getById.useQuery({ id: memberId });
  const { data: existing } = trpc.parQ.get.useQuery({ memberId });

  useEffect(() => {
    if (!existing) return;
    const musculo = parseObj(existing.musculoskeletalIssues) as any;
    const postural = parseObj(existing.posturalIssues) as any;
    setForm({
      height: existing.height ?? "",
      weight: existing.weight ?? "",
      occupation: existing.occupation ?? "",
      workEnvironment: existing.workEnvironment ?? "",
      exerciseExperience: existing.exerciseExperience ?? "",
      goal1: existing.goal1 ?? "",
      goal2: existing.goal2 ?? "",
      goal3: existing.goal3 ?? "",
      dietChecks: parseArr(existing.dietIssues),
      alcoholChecks: parseArr(existing.alcoholIssues),
      sleepChecks: parseArr(existing.sleepIssues),
      activityChecks: parseArr(existing.activityIssues),
      diagnoses: parseArr(existing.chronicDiseases),
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
      imbalanceAreas: Array.isArray(musculo?.imbalance) ? musculo.imbalance : [],
      acuteAreas: Array.isArray(musculo?.acute) ? musculo.acute : [],
      chronicPainAreas: Array.isArray(musculo?.chronic) ? musculo.chronic : [],
      posturalFront: mergeBodyMap(initBodyMap(FRONT_PARTS), postural?.front),
      posturalBack: mergeBodyMap(initBodyMap(BACK_PARTS), postural?.back),
    });
  }, [existing]);

  const upsertMutation = trpc.parQ.upsert.useMutation({
    onSuccess: () => {
      toast.success("PAR-Q가 저장되었습니다.");
      setLocation(`/members/${memberId}`);
    },
    onError: (err) => toast.error(err.message || "저장 실패"),
  });

  const set = <K extends keyof FormState>(key: K, val: FormState[K]) =>
    setForm((p) => ({ ...p, [key]: val }));

  const updateBodyMap = (side: "posturalFront" | "posturalBack", part: string, dir: "rt" | "lt", val: boolean) =>
    setForm((p) => ({
      ...p,
      [side]: { ...p[side], [part]: { ...p[side][part], [dir]: val } },
    }));

  const handleSave = () => {
    upsertMutation.mutate({
      memberId,
      height: form.height, weight: form.weight,
      muscleMass: "", bodyFatPercent: "", bodyFatKg: "",
      waistCircumference: form.waistCircumference,
      systolicBp: form.systolicBp, diastolicBp: form.diastolicBp,
      totalCholesterol: form.totalCholesterol, hdlCholesterol: form.hdlCholesterol,
      ldlCholesterol: form.ldlCholesterol, triglycerides: form.triglycerides,
      fastingBloodSugar: form.fastingBloodSugar, postMealBloodSugar: form.postMealBloodSugar,
      hba1c: form.hba1c, boneDensity: form.boneDensity,
      occupation: form.occupation, workEnvironment: form.workEnvironment,
      exerciseExperience: form.exerciseExperience, visitRoute: "",
      goal1: form.goal1, goal2: form.goal2, goal3: form.goal3,
      dietIssues: JSON.stringify(form.dietChecks),
      alcoholIssues: JSON.stringify(form.alcoholChecks),
      sleepIssues: JSON.stringify(form.sleepChecks),
      activityIssues: JSON.stringify(form.activityChecks),
      chronicDiseases: JSON.stringify(form.diagnoses),
      musculoskeletalIssues: JSON.stringify({
        imbalance: form.imbalanceAreas,
        acute: form.acuteAreas,
        chronic: form.chronicPainAreas,
      }),
      posturalIssues: JSON.stringify({
        front: form.posturalFront,
        back: form.posturalBack,
      }),
    });
  };

  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setLocation(`/members/${memberId}`)}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-base font-bold">{member?.name ?? "..."}</h1>
          <p className="text-xs text-muted-foreground">사전건강검사 (PAR-Q)</p>
        </div>
      </div>

      {/* 기본 건강 정보 */}
      <Section title="기본 건강 정보">
        <div className="grid grid-cols-2 gap-4">
          <RangeSelect label="키 (cm)" value={form.height} options={HEIGHT_OPTIONS} onChange={(v) => set("height", v)} />
          <RangeSelect label="체중 (kg)" value={form.weight} options={WEIGHT_OPTIONS} onChange={(v) => set("weight", v)} />
        </div>
        <Field label="직업">
          <input value={form.occupation} onChange={(e) => set("occupation", e.target.value)}
            placeholder="예: 사무직"
            className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground" />
        </Field>
        <Field label="근무 환경">
          <input value={form.workEnvironment} onChange={(e) => set("workEnvironment", e.target.value)}
            placeholder="예: 장시간 앉아서 근무"
            className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground" />
        </Field>
        <Field label="운동 경험">
          <input value={form.exerciseExperience} onChange={(e) => set("exerciseExperience", e.target.value)}
            placeholder="예: 헬스 1년, 수영 6개월"
            className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground" />
        </Field>
      </Section>

      {/* 운동 목적 */}
      <Section title="운동 목적">
        <GoalSelect label="운동 목적 1" value={form.goal1} onChange={(v) => set("goal1", v)} />
        <GoalSelect label="운동 목적 2" value={form.goal2} onChange={(v) => set("goal2", v)} />
        <GoalSelect label="운동 목적 3" value={form.goal3} onChange={(v) => set("goal3", v)} />
      </Section>

      {/* 생활 습관 */}
      <Section title="생활 습관">
        <CheckGroup title="식단 문제 체크" items={DIET_CHECKS} selected={form.dietChecks}
          onChange={(v) => set("dietChecks", v)} />
        <CheckGroup title="음주 문제 체크" items={ALCOHOL_CHECKS} selected={form.alcoholChecks}
          onChange={(v) => set("alcoholChecks", v)} />
        <CheckGroup title="수면 문제 체크" items={SLEEP_CHECKS} selected={form.sleepChecks}
          onChange={(v) => set("sleepChecks", v)} />
        <CheckGroup title="활동 문제 체크" items={ACTIVITY_CHECKS} selected={form.activityChecks}
          onChange={(v) => set("activityChecks", v)} />
      </Section>

      {/* 병원 진단 */}
      <Section title="병원 진단">
        <p className="text-sm font-medium text-foreground">병원에서 진단 받으신 내용 있으신가요?</p>
        <SimpleCheckList items={MEDICAL_DIAGNOSES} selected={form.diagnoses}
          onChange={(v) => set("diagnoses", v)} />
      </Section>

      {/* 질환 정보 */}
      <Section title="질환 정보">
        <BpField
          systolic={form.systolicBp} diastolic={form.diastolicBp}
          onChange={(s, d) => setForm((p) => ({ ...p, systolicBp: s, diastolicBp: d }))}
        />
        <HealthField
          label='허리둘레 <span class="text-primary">(남 85 이하 정상, 여 80 이하 정상)</span> cm'
          value={form.waistCircumference} onChange={(v) => set("waistCircumference", v)} />
        <HealthField
          label='총콜레스테롤 <span class="text-primary">(200 이하 정상)</span> mg/dL'
          value={form.totalCholesterol} onChange={(v) => set("totalCholesterol", v)} />
        <HealthField
          label='HDL콜레스테롤 <span class="text-primary">(60 이상 정상)</span> mg/dL'
          value={form.hdlCholesterol} onChange={(v) => set("hdlCholesterol", v)} />
        <HealthField
          label='LDL콜레스테롤 <span class="text-primary">(100 이하 정상)</span> mg/dL'
          value={form.ldlCholesterol} onChange={(v) => set("ldlCholesterol", v)} />
        <HealthField
          label='중성지방 <span class="text-primary">(150 이하 정상)</span> mg/dL'
          value={form.triglycerides} onChange={(v) => set("triglycerides", v)} />
        <HealthField
          label='공복 혈당 <span class="text-primary">(100 이하 정상)</span> mg/dL'
          value={form.fastingBloodSugar} onChange={(v) => set("fastingBloodSugar", v)} />
        <HealthField
          label='식후 2시간 혈당 <span class="text-primary">(140 이하 정상)</span> mg/dL'
          value={form.postMealBloodSugar} onChange={(v) => set("postMealBloodSugar", v)} />
        <HealthField
          label='당화혈색소 (HbA1c) <span class="text-primary">(5.7 이하 정상)</span> %'
          value={form.hba1c} onChange={(v) => set("hba1c", v)} />
        <HealthField
          label='골밀도 T-score <span class="text-primary">(-1.0 이상 정상)</span>'
          value={form.boneDensity} onChange={(v) => set("boneDensity", v)} />
      </Section>

      {/* 근골격계 */}
      <Section title="근골격계">
        <div className="space-y-3">
          <p className="text-sm font-medium text-foreground">'불균형'이라고 느끼는 부위를 선택해주세요.</p>
          <SimpleCheckList items={MUSCULO_PARTS} selected={form.imbalanceAreas}
            onChange={(v) => set("imbalanceAreas", v)} />
        </div>
        <div className="space-y-3 pt-2">
          <p className="text-sm font-medium text-foreground">'급성 통증' 및 '외상(부상)' 부위를 선택해주세요.</p>
          <SimpleCheckList items={PAIN_PARTS} selected={form.acuteAreas}
            onChange={(v) => set("acuteAreas", v)} />
        </div>
        <div className="space-y-3 pt-2">
          <p className="text-sm font-medium text-foreground">'만성 통증' 부위를 선택해주세요.</p>
          <SimpleCheckList items={PAIN_PARTS} selected={form.chronicPainAreas}
            onChange={(v) => set("chronicPainAreas", v)} />
        </div>
      </Section>

      {/* 체형 문제 */}
      <Section title="체형 문제">
        <div className="space-y-3">
          <p className="text-sm font-medium text-foreground">전면 체형 문제 확인</p>
          <BodyTable
            parts={FRONT_PARTS}
            data={form.posturalFront}
            onChange={(part, side, val) => updateBodyMap("posturalFront", part, side, val)}
          />
        </div>
        <div className="space-y-3 pt-2">
          <p className="text-sm font-medium text-foreground">후면 체형 문제 확인</p>
          <BodyTable
            parts={BACK_PARTS}
            data={form.posturalBack}
            onChange={(part, side, val) => updateBodyMap("posturalBack", part, side, val)}
          />
        </div>
      </Section>

      {/* 버튼 */}
      <div className="flex gap-3 pb-6">
        <Button onClick={handleSave} disabled={upsertMutation.isPending} className="flex-1 py-3 text-base">
          {upsertMutation.isPending ? "저장 중..." : "저장"}
        </Button>
        <Button variant="outline" className="flex-1 py-3 text-base"
          onClick={() => setLocation(`/members/${memberId}`)}>
          취소
        </Button>
      </div>
    </div>
  );
}
