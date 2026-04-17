import { useState, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Plus, X } from "lucide-react";

interface Props {
  memberId: number;
}

type Status = "attended" | "noshow" | "cancelled";

function nowTimeStr() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <h2 className="text-base font-bold text-primary">{title}</h2>
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

export default function AttendanceCheck({ memberId }: Props) {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const params = new URLSearchParams(search);
  const dateParam = params.get("date") ?? new Date().toISOString().split("T")[0];

  const [status, setStatus] = useState<Status>("attended");
  const [checkDate, setCheckDate] = useState(dateParam);
  const [checkTime, setCheckTime] = useState(nowTimeStr());
  const [conditionScore, setConditionScore] = useState("");
  const [sleepHours, setSleepHours] = useState("");
  const [energyLevel, setEnergyLevel] = useState("");
  const [dietItems, setDietItems] = useState<string[]>([""]);
  const [painLevel, setPainLevel] = useState("");
  const [painArea, setPainArea] = useState("");
  const [painSide, setPainSide] = useState("");
  const [notes, setNotes] = useState("");

  const { data: member } = trpc.members.getById.useQuery({ id: memberId });
  const { data: existing } = trpc.attendanceChecks.getByMemberDate.useQuery({ memberId, date: dateParam });

  useEffect(() => {
    if (!existing) return;
    setStatus(existing.status as Status);
    setCheckDate(existing.checkDate);
    setCheckTime(existing.checkTime ?? nowTimeStr());
    setConditionScore(existing.conditionScore != null ? String(existing.conditionScore) : "");
    setSleepHours(existing.sleepHours ?? "");
    setEnergyLevel(existing.energyLevel ?? "");
    setDietItems(existing.diet ? JSON.parse(existing.diet) : [""]);
    setPainLevel(existing.painLevel != null ? String(existing.painLevel) : "");
    setPainArea(existing.painArea ?? "");
    setPainSide(existing.painSide ?? "");
    setNotes(existing.notes ?? "");
  }, [existing]);

  const upsertMutation = trpc.attendanceChecks.upsert.useMutation({
    onSuccess: () => {
      toast.success("출석이 저장되었습니다.");
      setLocation(`/attendance?date=${checkDate}`);
    },
    onError: (err) => toast.error(err.message || "저장 실패"),
  });

  const handleSave = () => {
    const filledDiet = dietItems.filter((d) => d.trim());
    upsertMutation.mutate({
      memberId,
      checkDate,
      checkTime,
      status,
      conditionScore: conditionScore ? parseInt(conditionScore) : undefined,
      sleepHours: sleepHours || undefined,
      energyLevel: energyLevel || undefined,
      diet: filledDiet.length ? JSON.stringify(filledDiet) : undefined,
      painLevel: painLevel ? parseInt(painLevel) : undefined,
      painArea: painArea || undefined,
      painSide: painSide || undefined,
      notes: notes || undefined,
    });
  };

  const addDietItem = () => setDietItems((p) => [...p, ""]);
  const removeDietItem = (i: number) => setDietItems((p) => p.filter((_, idx) => idx !== i));
  const updateDietItem = (i: number, val: string) =>
    setDietItems((p) => p.map((d, idx) => (idx === i ? val : d)));

  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setLocation(`/attendance?date=${dateParam}`)}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-base font-bold flex-1">
          {member?.name ?? "..."} - 수업 전 컨디션 체크
        </h1>
        {/* 노쇼 / 캔슬 토글 */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setStatus((s) => s === "noshow" ? "attended" : "noshow")}
            className={`text-xs px-2 py-1 rounded border transition-colors ${
              status === "noshow"
                ? "bg-red-500/20 text-red-400 border-red-500/40"
                : "text-muted-foreground border-border"
            }`}
          >
            노쇼
          </button>
          <button
            onClick={() => setStatus((s) => s === "cancelled" ? "attended" : "cancelled")}
            className={`text-xs px-2 py-1 rounded border transition-colors ${
              status === "cancelled"
                ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/40"
                : "text-muted-foreground border-border"
            }`}
          >
            캔슬
          </button>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-5 space-y-8">

        {/* 기본 정보 */}
        <Section title="기본 정보">
          <Field label="체크 날짜">
            <input
              type="date"
              value={checkDate}
              onChange={(e) => setCheckDate(e.target.value)}
              className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground"
            />
          </Field>
          <Field label="체크 시간">
            <input
              type="time"
              value={checkTime}
              onChange={(e) => setCheckTime(e.target.value)}
              className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground"
            />
          </Field>
        </Section>

        {/* 컨디션 평가 */}
        <Section title="컨디션 평가">
          <Field label="전반적 컨디션 점수 (1-5)">
            <Input
              type="number" min="1" max="5"
              value={conditionScore}
              onChange={(e) => setConditionScore(e.target.value)}
              placeholder="3"
            />
          </Field>
          <Field label="수면시간 (시간)">
            <Input
              type="number" min="0" max="24" step="0.5"
              value={sleepHours}
              onChange={(e) => setSleepHours(e.target.value)}
              placeholder="7"
            />
          </Field>
          <Field label="에너지 수준">
            <div className="flex gap-2">
              {["높음", "보통", "낮음"].map((v) => (
                <button
                  key={v}
                  onClick={() => setEnergyLevel(energyLevel === v ? "" : v)}
                  className={`flex-1 py-2 text-sm rounded-lg border transition-colors ${
                    energyLevel === v
                      ? "bg-primary/20 border-primary/40 text-primary"
                      : "border-border text-muted-foreground hover:border-primary/30"
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
          </Field>
        </Section>

        {/* 식단 정보 */}
        <Section title="식단 정보">
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">오늘 먹은 식단</label>
            {dietItems.map((item, i) => (
              <div key={i} className="flex gap-2">
                <Input
                  value={item}
                  onChange={(e) => updateDietItem(i, e.target.value)}
                  placeholder="예: 아침 - 계란 2개, 도스트"
                />
                {dietItems.length > 1 && (
                  <button onClick={() => removeDietItem(i)} className="text-muted-foreground hover:text-red-400">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
            <button
              onClick={addDietItem}
              className="flex items-center gap-1 text-sm text-primary hover:text-primary/70"
            >
              <Plus className="h-4 w-4" />
              식단 항목 추가
            </button>
          </div>
        </Section>

        {/* 통증 정보 */}
        <Section title="통증 정보">
          <Field label="통증 수준 (0-10)">
            <Input
              type="number" min="0" max="10"
              value={painLevel}
              onChange={(e) => setPainLevel(e.target.value)}
              placeholder="0"
            />
          </Field>
          <Field label="통증 부위">
            <Input
              value={painArea}
              onChange={(e) => setPainArea(e.target.value)}
              placeholder="예: 허리, 어깨"
            />
          </Field>
          <Field label="통증 위치">
            <Input
              value={painSide}
              onChange={(e) => setPainSide(e.target.value)}
              placeholder="예: 왼쪽/오른쪽/양쪽"
            />
          </Field>
        </Section>

        {/* 추가 메모 */}
        <Section title="추가 메모">
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="특이사항이나 추가 메모"
            rows={4}
          />
        </Section>

        {/* 버튼 */}
        <div className="flex gap-3 pt-2">
          <Button onClick={handleSave} disabled={upsertMutation.isPending}>
            {upsertMutation.isPending ? "저장 중..." : "저장"}
          </Button>
          <Button variant="outline" onClick={() => setLocation(`/attendance?date=${dateParam}`)}>
            취소
          </Button>
        </div>
      </div>
    </div>
  );
}
