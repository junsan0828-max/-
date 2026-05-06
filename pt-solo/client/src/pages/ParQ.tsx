import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft } from "lucide-react";

interface Props {
  memberId: number;
}

type FormState = {
  height: string; weight: string; muscleMass: string;
  bodyFatPercent: string; bodyFatKg: string; waistCircumference: string;
  systolicBp: string; diastolicBp: string; totalCholesterol: string;
  hdlCholesterol: string; ldlCholesterol: string; triglycerides: string;
  fastingBloodSugar: string; postMealBloodSugar: string; hba1c: string; boneDensity: string;
  occupation: string; workEnvironment: string; exerciseExperience: string; visitRoute: string;
  goal1: string; goal2: string; goal3: string;
  dietIssues: string; alcoholIssues: string; sleepIssues: string; activityIssues: string;
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
  dietIssues: "", alcoholIssues: "", sleepIssues: "", activityIssues: "",
  chronicDiseases: "", musculoskeletalIssues: "", posturalIssues: "",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-4">
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
        dietIssues: existing.dietIssues ?? "",
        alcoholIssues: existing.alcoholIssues ?? "",
        sleepIssues: existing.sleepIssues ?? "",
        activityIssues: existing.activityIssues ?? "",
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
    upsertMutation.mutate({ memberId, ...form });
  };

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setLocation(`/members/${memberId}`)}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-base font-bold">{member?.name ?? "..."} - 사전건강검사 (PAR-Q)</h1>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-5 space-y-8">

        {/* 신체 정보 */}
        <Section title="신체 정보">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
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
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="직업"><Input value={form.occupation} onChange={set("occupation")} placeholder="예: 사무직" /></Field>
            <Field label="근무 환경"><Input value={form.workEnvironment} onChange={set("workEnvironment")} placeholder="예: 앉음/서있음" /></Field>
            <Field label="운동 경험"><Input value={form.exerciseExperience} onChange={set("exerciseExperience")} placeholder="예: 달음/보름/직음" /></Field>
            <Field label="방문 경로"><Input value={form.visitRoute} onChange={set("visitRoute")} placeholder="예: 친구 소개" /></Field>
          </div>
        </Section>

        {/* 운동 목적 */}
        <Section title="운동 목적">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field label="목적 1"><Input value={form.goal1} onChange={set("goal1")} placeholder="예: 체중 감량" /></Field>
            <Field label="목적 2"><Input value={form.goal2} onChange={set("goal2")} placeholder="예: 근력 증가" /></Field>
            <Field label="목적 3"><Input value={form.goal3} onChange={set("goal3")} placeholder="예: 건강 증진" /></Field>
          </div>
        </Section>

        {/* 생활 습관 및 문제 */}
        <Section title="생활 습관 및 문제">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="식단 문제">
              <Textarea value={form.dietIssues} onChange={set("dietIssues")} placeholder="식단 관련 문제 기록" rows={3} />
            </Field>
            <Field label="음주 문제">
              <Textarea value={form.alcoholIssues} onChange={set("alcoholIssues")} placeholder="음주 관련 문제 기록" rows={3} />
            </Field>
            <Field label="수면 문제">
              <Textarea value={form.sleepIssues} onChange={set("sleepIssues")} placeholder="수면 관련 문제 기록" rows={3} />
            </Field>
            <Field label="활동 문제">
              <Textarea value={form.activityIssues} onChange={set("activityIssues")} placeholder="활동 관련 문제 기록" rows={3} />
            </Field>
          </div>
        </Section>

        {/* 질환 정보 */}
        <Section title="질환 정보">
          <div className="space-y-4">
            <Field label="만성 질환">
              <Textarea value={form.chronicDiseases} onChange={set("chronicDiseases")} placeholder="예: 고혈압, 당뇨병 등" rows={3} />
            </Field>
            <Field label="근골격계 질환">
              <Textarea value={form.musculoskeletalIssues} onChange={set("musculoskeletalIssues")} placeholder="예: 요통, 목 통증 등" rows={3} />
            </Field>
            <Field label="체형 문제">
              <Textarea value={form.posturalIssues} onChange={set("posturalIssues")} placeholder="예: 거북목, 라운드숄더 등" rows={3} />
            </Field>
          </div>
        </Section>

        {/* 버튼 */}
        <div className="flex gap-3 pt-2">
          <Button onClick={handleSave} disabled={upsertMutation.isPending}>
            {upsertMutation.isPending ? "저장 중..." : "저장"}
          </Button>
          <Button variant="outline" onClick={() => setLocation(`/members/${memberId}`)}>취소</Button>
        </div>
      </div>
    </div>
  );
}
