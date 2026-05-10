import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Check, ChevronDown } from "lucide-react";

interface Props {
  memberId: number;
}

const GOAL_OPTIONS = [
  "다이어트 (체중 감량)",
  "체형교정 (자세 개선)",
  "통증 개선 (목/허리/무릎 등)",
  "재활 운동 (병원 진단 후 운동)",
  "근력/체력 향상",
  "바디라인 개선 (근육, 몸매)",
  "건강 관리 (예방 목적)",
  "운동 습관 만들기",
  "기타",
];

const DIET_CHECKS = [
  "A. 하루 식사 시간이 일정하지 않거나 끼니를 자주 거른다.",
  "B. 하루 단백질 섭취량이 부족하거나(체중 x 1g 이하) 식단 구성이 한쪽으로 치우친다.",
  "C. 스트레스나 감정 변화로 인해 폭식 또는 과식을 경험한다.",
  "D. 저녁 9시 이후 야식 또는 고칼로리 간식을 자주 섭취한다.",
];

const ALCOHOL_CHECKS = [
  "A. 주 3회 이상 음주하거나, 한 번에 3잔 이상 마신다.",
  "B. 음주 후 운동이나 식단 조절에 어려움을 겪는다.",
  "C. 스트레스 해소를 위해 음주를 자주 한다.",
  "D. 음주가 수면이나 다음 날 컨디션에 영향을 준다.",
];

const SLEEP_CHECKS = [
  "A. 하루 수면 시간이 6시간 미만이다.",
  "B. 잠들기 어렵거나 수면 중 자주 깨는 편이다.",
  "C. 취침 및 기상 시간이 불규칙하다.",
  "D. 수면 후에도 피로감이 남거나 개운하지 않다.",
];

const ACTIVITY_CHECKS = [
  "A. 하루 대부분의 시간을 앉아서 보낸다.",
  "B. 일상적인 걷기 등 신체 활동량이 매우 적다.",
  "C. 운동 후 지나친 피로나 근육통이 오래 지속된다.",
  "D. 운동 시간과 빈도가 불규칙하거나 지속하기 어렵다.",
];

type FormState = {
  height: string; weight: string; muscleMass: string;
  bodyFatPercent: string; bodyFatKg: string; waistCircumference: string;
  systolicBp: string; diastolicBp: string; totalCholesterol: string;
  hdlCholesterol: string; ldlCholesterol: string; triglycerides: string;
  fastingBloodSugar: string; postMealBloodSugar: string; hba1c: string; boneDensity: string;
  occupation: string; workEnvironment: string; exerciseExperience: string; visitRoute: string;
  goal1: string; goal2: string; goal3: string;
  dietChecks: string[]; alcoholChecks: string[]; sleepChecks: string[]; activityChecks: string[];
  chronicDiseases: string; musculoskeletalIssues: string; posturalIssues: string;
};

const empty: FormState = {
  height: "", weight: "", muscleMass: "",
  bodyFatPercent: "", bodyFatKg: "", waistCircumference: "",
  systolicBp: "", diastolicBp: "", totalCholesterol: "",
  hdlCholesterol: "", ldlCholesterol: "", triglycerides: "",
  fastingBloodSugar: "", postMealBloodSugar: "", hba1c: "", boneDensity: "",
  occupation: "", workEnvironment: "", exerciseExperience: "", visitRoute: "",
  goal1: "", goal2: "", goal3: "",
  dietChecks: [], alcoholChecks: [], sleepChecks: [], activityChecks: [],
  chronicDiseases: "", musculoskeletalIssues: "", posturalIssues: "",
};

function parseChecks(val: string | undefined | null): string[] {
  if (!val) return [];
  try { return JSON.parse(val); } catch { return val ? [val] : []; }
}

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

function CheckGroup({
  title, items, selected, onChange,
}: { title: string; items: string[]; selected: string[]; onChange: (v: string[]) => void }) {
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
        muscleMass: existing.muscleMass ?? "",
        bodyFatPercent: existing.bodyFatPercent ?? "",
        bodyFatKg: existing.bodyFatKg ?? "",
        waistCircumference: existing.waistCircumference ?? "",
        systolicBp: existing.systolicBp ?? "",
        diastolicBp: existing.diastolicBp ?? "",
        totalCholesterol: existing.totalCholesterol ?? "",
        hdlCholesterol: existing.hdlCholesterol ?? "",
        ldlCholesterol: existing.ldlCholesterol ?? "",
        triglycerides: existing.triglycerides ?? "",
        fastingBloodSugar: existing.fastingBloodSugar ?? "",
        postMealBloodSugar: existing.postMealBloodSugar ?? "",
        hba1c: existing.hba1c ?? "",
        boneDensity: existing.boneDensity ?? "",
        occupation: existing.occupation ?? "",
        workEnvironment: existing.workEnvironment ?? "",
        exerciseExperience: existing.exerciseExperience ?? "",
        visitRoute: existing.visitRoute ?? "",
        goal1: existing.goal1 ?? "",
        goal2: existing.goal2 ?? "",
        goal3: existing.goal3 ?? "",
        dietChecks: parseChecks(existing.dietIssues),
        alcoholChecks: parseChecks(existing.alcoholIssues),
        sleepChecks: parseChecks(existing.sleepIssues),
        activityChecks: parseChecks(existing.activityIssues),
        chronicDiseases: existing.chronicDiseases ?? "",
        musculoskeletalIssues: existing.musculoskeletalIssues ?? "",
        posturalIssues: existing.posturalIssues ?? "",
      });
    }
  }, [existing]);

  const upsertMutation = trpc.parQ.upsert.useMutation({
    onSuccess: () => {
      toast.success("PAR-Q가 저장되었습니다.");
      setLocation(`/members/${memberId}`);
    },
    onError: (err) => toast.error(err.message || "저장 실패"),
  });

  const set = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((p) => ({ ...p, [key]: e.target.value }));

  const handleSave = () => {
    upsertMutation.mutate({
      memberId,
      height: form.height, weight: form.weight, muscleMass: form.muscleMass,
      bodyFatPercent: form.bodyFatPercent, bodyFatKg: form.bodyFatKg,
      waistCircumference: form.waistCircumference,
      systolicBp: form.systolicBp, diastolicBp: form.diastolicBp,
      totalCholesterol: form.totalCholesterol, hdlCholesterol: form.hdlCholesterol,
      ldlCholesterol: form.ldlCholesterol, triglycerides: form.triglycerides,
      fastingBloodSugar: form.fastingBloodSugar, postMealBloodSugar: form.postMealBloodSugar,
      hba1c: form.hba1c, boneDensity: form.boneDensity,
      occupation: form.occupation, workEnvironment: form.workEnvironment,
      exerciseExperience: form.exerciseExperience, visitRoute: form.visitRoute,
      goal1: form.goal1, goal2: form.goal2, goal3: form.goal3,
      dietIssues: form.dietChecks.length ? JSON.stringify(form.dietChecks) : "",
      alcoholIssues: form.alcoholChecks.length ? JSON.stringify(form.alcoholChecks) : "",
      sleepIssues: form.sleepChecks.length ? JSON.stringify(form.sleepChecks) : "",
      activityIssues: form.activityChecks.length ? JSON.stringify(form.activityChecks) : "",
      chronicDiseases: form.chronicDiseases,
      musculoskeletalIssues: form.musculoskeletalIssues,
      posturalIssues: form.posturalIssues,
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
        <h1 className="text-base font-bold">{member?.name ?? "..."} - 사전건강검사 (PAR-Q)</h1>
      </div>

      {/* 신체 정보 */}
      <Section title="신체 정보">
        <div className="grid grid-cols-2 gap-4">
          <Field label="키 (cm)"><Input value={form.height} onChange={set("height")} placeholder="예: 170" /></Field>
          <Field label="체중 (kg)"><Input value={form.weight} onChange={set("weight")} placeholder="예: 70" /></Field>
          <Field label="근육량 (kg)"><Input value={form.muscleMass} onChange={set("muscleMass")} placeholder="예: 30" /></Field>
          <Field label="체지방률 (%)"><Input value={form.bodyFatPercent} onChange={set("bodyFatPercent")} placeholder="예: 15" /></Field>
          <Field label="체지방량 (kg)"><Input value={form.bodyFatKg} onChange={set("bodyFatKg")} placeholder="예: 10" /></Field>
          <Field label="허리둘레 (cm)"><Input value={form.waistCircumference} onChange={set("waistCircumference")} placeholder="예: 80" /></Field>
        </div>
      </Section>

      {/* 건강 정보 */}
      <Section title="건강 정보">
        <div className="grid grid-cols-2 gap-4">
          <Field label="수축기 혈압 (mmHg)"><Input value={form.systolicBp} onChange={set("systolicBp")} placeholder="예: 120" /></Field>
          <Field label="이완기 혈압 (mmHg)"><Input value={form.diastolicBp} onChange={set("diastolicBp")} placeholder="예: 80" /></Field>
          <Field label="총 콜레스테롤 (mg/dL)"><Input value={form.totalCholesterol} onChange={set("totalCholesterol")} placeholder="예: 200" /></Field>
          <Field label="HDL 콜레스테롤"><Input value={form.hdlCholesterol} onChange={set("hdlCholesterol")} placeholder="예: 50" /></Field>
          <Field label="LDL 콜레스테롤"><Input value={form.ldlCholesterol} onChange={set("ldlCholesterol")} placeholder="예: 130" /></Field>
          <Field label="중성지방 (mg/dL)"><Input value={form.triglycerides} onChange={set("triglycerides")} placeholder="예: 150" /></Field>
          <Field label="공복 혈당 (mg/dL)"><Input value={form.fastingBloodSugar} onChange={set("fastingBloodSugar")} placeholder="예: 100" /></Field>
          <Field label="식후 2시간 혈당 (mg/dL)"><Input value={form.postMealBloodSugar} onChange={set("postMealBloodSugar")} placeholder="예: 140" /></Field>
          <Field label="당화혈색소 (HbA1c)"><Input value={form.hba1c} onChange={set("hba1c")} placeholder="예: 5" /></Field>
          <Field label="골밀도 (T-Score)"><Input value={form.boneDensity} onChange={set("boneDensity")} placeholder="예: 0" /></Field>
        </div>
      </Section>

      {/* 직업 및 생활 정보 */}
      <Section title="직업 및 생활 정보">
        <div className="grid grid-cols-2 gap-4">
          <Field label="직업"><Input value={form.occupation} onChange={set("occupation")} placeholder="예: 사무직" /></Field>
          <Field label="근무 환경"><Input value={form.workEnvironment} onChange={set("workEnvironment")} placeholder="예: 앉음/서있음" /></Field>
          <Field label="운동 경험"><Input value={form.exerciseExperience} onChange={set("exerciseExperience")} placeholder="예: 1년 이상" /></Field>
          <Field label="방문 경로"><Input value={form.visitRoute} onChange={set("visitRoute")} placeholder="예: 친구 소개" /></Field>
        </div>
      </Section>

      {/* 운동 목적 */}
      <Section title="운동 목적">
        <GoalSelect label="운동 목적 1" value={form.goal1} onChange={(v) => setForm((p) => ({ ...p, goal1: v }))} />
        <GoalSelect label="운동 목적 2" value={form.goal2} onChange={(v) => setForm((p) => ({ ...p, goal2: v }))} />
        <GoalSelect label="운동 목적 3" value={form.goal3} onChange={(v) => setForm((p) => ({ ...p, goal3: v }))} />
      </Section>

      {/* 생활 습관 */}
      <Section title="생활 습관">
        <CheckGroup
          title="식단 문제 체크"
          items={DIET_CHECKS}
          selected={form.dietChecks}
          onChange={(v) => setForm((p) => ({ ...p, dietChecks: v }))}
        />
        <CheckGroup
          title="음주 문제 체크"
          items={ALCOHOL_CHECKS}
          selected={form.alcoholChecks}
          onChange={(v) => setForm((p) => ({ ...p, alcoholChecks: v }))}
        />
        <CheckGroup
          title="수면 문제 체크"
          items={SLEEP_CHECKS}
          selected={form.sleepChecks}
          onChange={(v) => setForm((p) => ({ ...p, sleepChecks: v }))}
        />
        <CheckGroup
          title="활동 문제 체크"
          items={ACTIVITY_CHECKS}
          selected={form.activityChecks}
          onChange={(v) => setForm((p) => ({ ...p, activityChecks: v }))}
        />
      </Section>

      {/* 질환 정보 */}
      <Section title="질환 정보">
        <Field label="만성 질환">
          <Textarea value={form.chronicDiseases} onChange={set("chronicDiseases")} placeholder="예: 고혈압, 당뇨병 등" rows={3} />
        </Field>
        <Field label="근골격계 질환">
          <Textarea value={form.musculoskeletalIssues} onChange={set("musculoskeletalIssues")} placeholder="예: 요통, 목 통증 등" rows={3} />
        </Field>
        <Field label="체형 문제">
          <Textarea value={form.posturalIssues} onChange={set("posturalIssues")} placeholder="예: 거북목, 라운드숄더 등" rows={3} />
        </Field>
      </Section>

      {/* 버튼 */}
      <div className="flex gap-3 pb-6">
        <Button onClick={handleSave} disabled={upsertMutation.isPending}>
          {upsertMutation.isPending ? "저장 중..." : "저장"}
        </Button>
        <Button variant="outline" onClick={() => setLocation(`/members/${memberId}`)}>취소</Button>
      </div>
    </div>
  );
}
