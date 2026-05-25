import { useState, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ArrowLeft, Dumbbell, Check } from "lucide-react";

interface Props {
  memberId: number;
}

type Status = "attended" | "noshow" | "cancelled";

const DIET_OPTIONS = [
  "인스턴트탄수화물", "건강식탄수화물",
  "인스턴트단백질", "건강식단백질",
  "인스턴트지방", "건강식지방",
];

const SLEEP_OPTIONS = ["4h↓", "5h", "6h", "7h", "8h", "9h+"];

const BODY_PARTS = [
  "목", "상부등", "중부등", "어깨 전면", "어깨 후면", "기립근",
  "엉치", "고관절", "무릎", "발목", "발바닥", "팔꿈치", "손목", "기타",
];

// 신체 부위별 좌표 (viewBox: 0 0 100 245)
type Spot = { part: string; x: number; y: number; label: string };
const FRONT_SPOTS: Spot[] = [
  { part: "목",      x: 50, y: 36,  label: "목" },
  { part: "어깨 전면", x: 22, y: 48,  label: "어깨" },
  { part: "어깨 전면", x: 78, y: 48,  label: "" },
  { part: "팔꿈치",  x: 11, y: 93,  label: "팔꿈치" },
  { part: "팔꿈치",  x: 89, y: 93,  label: "" },
  { part: "손목",    x: 7,  y: 125, label: "손목" },
  { part: "손목",    x: 93, y: 125, label: "" },
  { part: "고관절",  x: 36, y: 126, label: "고관절" },
  { part: "고관절",  x: 64, y: 126, label: "" },
  { part: "무릎",    x: 35, y: 175, label: "무릎" },
  { part: "무릎",    x: 65, y: 175, label: "" },
  { part: "발목",    x: 34, y: 218, label: "발목" },
  { part: "발목",    x: 66, y: 218, label: "" },
];
const BACK_SPOTS: Spot[] = [
  { part: "목",      x: 50, y: 36,  label: "목" },
  { part: "어깨 후면", x: 22, y: 48,  label: "어깨" },
  { part: "어깨 후면", x: 78, y: 48,  label: "" },
  { part: "상부등",  x: 50, y: 60,  label: "상부등" },
  { part: "중부등",  x: 50, y: 80,  label: "중부등" },
  { part: "기립근",  x: 43, y: 100, label: "기립근" },
  { part: "기립근",  x: 57, y: 100, label: "" },
  { part: "엉치",    x: 50, y: 118, label: "엉치" },
  { part: "발바닥",  x: 34, y: 228, label: "발바닥" },
  { part: "발바닥",  x: 66, y: 228, label: "" },
];

function BodyOutline({ view }: { view: "front" | "back" }) {
  const s = "#94a3b8"; const w = 1.2;
  return (
    <g stroke={s} strokeWidth={w} fill="none" strokeLinecap="round" strokeLinejoin="round">
      {/* Head */}
      <ellipse cx="50" cy="16" rx="10" ry="12" />
      {/* Neck */}
      <path d="M46,27 L46,34 M54,27 L54,34" />
      {/* Shoulders & torso */}
      <path d="M46,34 Q32,34 24,40 Q18,60 20,100 L80,100 Q82,60 76,40 Q68,34 54,34" />
      {/* Left upper arm */}
      <path d="M24,40 Q14,54 10,82" />
      {/* Left forearm */}
      <path d="M10,82 Q7,106 7,128" />
      {/* Left hand */}
      <ellipse cx="7" cy="132" rx="4" ry="5" />
      {/* Right upper arm */}
      <path d="M76,40 Q86,54 90,82" />
      {/* Right forearm */}
      <path d="M90,82 Q93,106 93,128" />
      {/* Right hand */}
      <ellipse cx="93" cy="132" rx="4" ry="5" />
      {/* Hip line */}
      <path d="M22,100 Q50,110 78,100" />
      {/* Left thigh */}
      <path d="M36,108 Q34,145 34,175" />
      {/* Left shin */}
      <path d="M34,175 Q33,200 34,218" />
      {/* Left foot */}
      <path d="M31,218 Q28,228 36,230 Q42,230 44,224 L34,218" />
      {/* Right thigh */}
      <path d="M64,108 Q66,145 66,175" />
      {/* Right shin */}
      <path d="M66,175 Q67,200 66,218" />
      {/* Right foot */}
      <path d="M69,218 Q72,228 64,230 Q58,230 56,224 L66,218" />
      {view === "back" && (
        <>
          {/* Back spine line */}
          <path d="M50,34 L50,100" strokeDasharray="2,2" strokeWidth={0.8} />
        </>
      )}
    </g>
  );
}

function BodyPainMap({ selected, onChange }: { selected: string[]; onChange: (v: string[]) => void }) {
  function toggle(part: string) {
    onChange(selected.includes(part) ? selected.filter(p => p !== part) : [...selected, part]);
  }

  function renderSpots(spots: Spot[]) {
    return spots.map((s, i) => {
      const on = selected.includes(s.part);
      const showLabel = s.label !== "";
      return (
        <g key={i} onClick={() => toggle(s.part)} style={{ cursor: "pointer" }}>
          <circle
            cx={s.x} cy={s.y} r={5.5}
            fill={on ? "#1a80ff" : "#f1f5f9"}
            stroke={on ? "#1a80ff" : "#94a3b8"}
            strokeWidth={1.2}
          />
          {on && (
            <text x={s.x} y={s.y + 0.5} textAnchor="middle" dominantBaseline="middle"
              fontSize="5" fill="white" fontWeight="bold">✓</text>
          )}
          {showLabel && (
            <text
              x={s.x < 50 ? s.x - 7 : s.x > 50 ? s.x + 7 : s.x}
              y={s.y}
              textAnchor={s.x < 50 ? "end" : s.x > 50 ? "start" : "middle"}
              dominantBaseline="middle"
              fontSize="5.5"
              fill={on ? "#1a80ff" : "#64748b"}
              fontWeight={on ? "600" : "400"}
            >
              {s.label}
            </text>
          )}
          {/* Larger invisible tap target */}
          <circle cx={s.x} cy={s.y} r={10} fill="transparent" />
        </g>
      );
    });
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        {/* 전면 */}
        <div className="space-y-1">
          <p className="text-xs text-center text-muted-foreground font-medium">전면</p>
          <div className="bg-muted/30 rounded-xl border border-border overflow-hidden">
            <svg viewBox="0 0 100 245" className="w-full">
              <BodyOutline view="front" />
              {renderSpots(FRONT_SPOTS)}
            </svg>
          </div>
        </div>
        {/* 후면 */}
        <div className="space-y-1">
          <p className="text-xs text-center text-muted-foreground font-medium">후면</p>
          <div className="bg-muted/30 rounded-xl border border-border overflow-hidden">
            <svg viewBox="0 0 100 245" className="w-full">
              <BodyOutline view="back" />
              {renderSpots(BACK_SPOTS)}
            </svg>
          </div>
        </div>
      </div>
      {/* 기타 + 선택된 부위 표시 */}
      <div className="flex flex-wrap gap-1.5 items-center">
        <button
          onClick={() => toggle("기타")}
          className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
            selected.includes("기타")
              ? "bg-primary/20 border-primary text-primary"
              : "border-border text-muted-foreground hover:border-primary/40"
          }`}
        >
          기타
        </button>
        {selected.length > 0 && (
          <span className="text-xs text-muted-foreground">
            선택됨: {selected.join(" · ")}
          </span>
        )}
      </div>
    </div>
  );
}

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
  const [dietItems, setDietItems] = useState<string[]>([]);
  const [painLevel, setPainLevel] = useState("");
  const [painAreas, setPainAreas] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [deductSession, setDeductSession] = useState(false);
  const [selectedPkgId, setSelectedPkgId] = useState<number | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const { data: member } = trpc.members.getById.useQuery({ id: memberId });
  const { data: existing } = trpc.attendanceChecks.getByMemberDate.useQuery({ memberId, date: dateParam });
  const { data: ptPackageList } = trpc.pt.listByMember.useQuery({ memberId });
  const { data: sessionLogs } = trpc.pt.sessionLogs.useQuery({ memberId });

  const activePkgs = ptPackageList?.filter(
    (p) => p.status === "active" && p.totalSessions > p.usedSessions
  ) ?? [];

  const alreadyDeducted = sessionLogs?.some((l) => l.sessionDate === dateParam) ?? false;

  useEffect(() => {
    if (activePkgs.length > 0 && selectedPkgId === null) {
      setSelectedPkgId(activePkgs[0].id);
    }
  }, [activePkgs.length]);

  useEffect(() => {
    if (ptPackageList === undefined) return;
    if (alreadyDeducted) {
      setDeductSession(false);
      return;
    }
    if (activePkgs.length > 0 && !existing) {
      setDeductSession(true);
    }
  }, [ptPackageList, existing, alreadyDeducted]);

  useEffect(() => {
    if (!existing) return;
    setStatus(existing.status as Status);
    setCheckDate(existing.checkDate);
    setCheckTime(existing.checkTime ?? nowTimeStr());
    setConditionScore(existing.conditionScore != null ? String(existing.conditionScore) : "");
    setSleepHours(existing.sleepHours ?? "");
    setEnergyLevel(existing.energyLevel ?? "");
    setDietItems(existing.diet ? JSON.parse(existing.diet) : []);
    setPainLevel(existing.painLevel != null ? String(existing.painLevel) : "");
    try { setPainAreas(existing.painArea ? JSON.parse(existing.painArea) : []); } catch { setPainAreas(existing.painArea ? [existing.painArea] : []); }
    setNotes(existing.notes ?? "");
  }, [existing]);

  const deleteMutation = trpc.attendanceChecks.delete.useMutation({
    onSuccess: () => {
      toast.success("출석이 취소되었습니다.");
      setLocation(`/attendance?date=${dateParam}`);
    },
    onError: (err) => toast.error(err.message || "취소 실패"),
  });

  const useSessionMutation = trpc.pt.useSession.useMutation({
    onError: (err) => toast.error(err.message || "세션 차감 실패"),
  });

  const upsertMutation = trpc.attendanceChecks.upsert.useMutation({
    onSuccess: () => {
      if (deductSession && status === "attended" && selectedPkgId) {
        useSessionMutation.mutate(
          { packageId: selectedPkgId, memberId, sessionDate: checkDate },
          {
            onSettled: () => {
              toast.success("출석 및 세션이 저장되었습니다.");
              setLocation(`/attendance?date=${checkDate}`);
            },
          }
        );
      } else {
        toast.success("출석이 저장되었습니다.");
        setLocation(`/attendance?date=${checkDate}`);
      }
    },
    onError: (err) => toast.error(err.message || "저장 실패"),
  });

  const handleSave = () => {
    upsertMutation.mutate({
      memberId,
      checkDate,
      checkTime,
      status,
      conditionScore: conditionScore ? parseInt(conditionScore) : undefined,
      sleepHours: sleepHours || undefined,
      energyLevel: energyLevel || undefined,
      diet: dietItems.length ? JSON.stringify(dietItems) : undefined,
      painLevel: painLevel ? parseInt(painLevel) : undefined,
      painArea: painAreas.length ? JSON.stringify(painAreas) : undefined,
      painSide: undefined,
      notes: notes || undefined,
    });
  };

  const toggleDiet = (option: string) => {
    setDietItems((prev) =>
      prev.includes(option) ? prev.filter((d) => d !== option) : [...prev, option]
    );
  };

  const toggleBodyPart = (part: string) => {
    setPainAreas((prev) =>
      prev.includes(part) ? prev.filter((p) => p !== part) : [...prev, part]
    );
  };

  const isSaving = upsertMutation.isPending || useSessionMutation.isPending;

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
        <div className="flex items-center gap-1.5">
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
          {existing && (
            <button
              onClick={() => setDeleteConfirmOpen(true)}
              disabled={deleteMutation.isPending}
              className="text-xs px-2 py-1 rounded border border-gray-500/40 text-gray-400 hover:bg-gray-500/20 transition-colors"
            >
              출석취소
            </button>
          )}
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-5 space-y-8">

        {/* 기본 정보 */}
        <Section title="기본 정보">
          <div className="grid grid-cols-2 gap-3">
            <Field label="날짜">
              <input
                type="date"
                value={checkDate}
                onChange={(e) => setCheckDate(e.target.value)}
                className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground"
              />
            </Field>
            <Field label="시간">
              <input
                type="time"
                value={checkTime}
                onChange={(e) => setCheckTime(e.target.value)}
                className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground"
              />
            </Field>
          </div>
        </Section>

        {/* 컨디션 평가 */}
        <Section title="컨디션 평가">
          <Field label="오늘 컨디션 (1 매우안좋음 → 5 최고)">
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((v) => (
                <button
                  key={v}
                  onClick={() => setConditionScore(conditionScore === String(v) ? "" : String(v))}
                  className={`flex-1 py-3 text-sm font-medium rounded-lg border transition-colors ${
                    conditionScore === String(v)
                      ? "bg-primary/20 border-primary/40 text-primary"
                      : "border-border text-muted-foreground hover:border-primary/30"
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
          </Field>
          <Field label="수면시간">
            <div className="grid grid-cols-6 gap-1.5">
              {SLEEP_OPTIONS.map((v) => (
                <button
                  key={v}
                  onClick={() => setSleepHours(sleepHours === v ? "" : v)}
                  className={`py-2 text-sm rounded-lg border transition-colors text-center ${
                    sleepHours === v
                      ? "bg-primary/20 border-primary/40 text-primary"
                      : "border-border text-muted-foreground hover:border-primary/30"
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
          </Field>
          <Field label="에너지 수준">
            <div className="flex gap-2">
              {["낮음", "보통", "높음"].map((v) => (
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
          <Field label="오늘 섭취한 식단 유형 (중복 선택 가능)">
            <div className="grid grid-cols-2 gap-2">
              {DIET_OPTIONS.map((option) => (
                <button
                  key={option}
                  onClick={() => toggleDiet(option)}
                  className={`flex items-center gap-2 px-2 py-2.5 text-xs rounded-lg border transition-colors text-left ${
                    dietItems.includes(option)
                      ? "bg-primary/20 border-primary/40 text-primary"
                      : "border-border text-muted-foreground hover:border-primary/30"
                  }`}
                >
                  <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                    dietItems.includes(option) ? "bg-primary border-primary" : "border-muted-foreground/50"
                  }`}>
                    {dietItems.includes(option) && <Check className="h-3 w-3 text-white" />}
                  </div>
                  {option}
                </button>
              ))}
            </div>
          </Field>
        </Section>

        {/* 통증 정보 */}
        <Section title="통증 정보">
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>이상없음</span>
              <span>통증심함</span>
            </div>
            <div className="flex gap-1">
              {Array.from({ length: 11 }, (_, i) => String(i)).map((v) => (
                <button
                  key={v}
                  onClick={() => setPainLevel(painLevel === v ? "" : v)}
                  className={`flex-1 aspect-square flex items-center justify-center text-sm rounded-full border transition-colors ${
                    painLevel === v
                      ? "bg-primary/20 border-primary/40 text-primary"
                      : "border-border text-muted-foreground hover:border-primary/30"
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm text-muted-foreground">통증 부위 <span className="text-xs">(신체를 직접 탭하세요)</span></label>
            <BodyPainMap selected={painAreas} onChange={setPainAreas} />
          </div>
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

        {/* PT 세션 차감 */}
        {activePkgs.length > 0 && status === "attended" && (
          <Section title="PT 세션 차감">
            <div className="space-y-3">
              {alreadyDeducted ? (
                <div className="flex items-center gap-2 w-full py-2.5 px-3 rounded-lg border border-green-500/30 bg-green-500/10 text-sm text-green-400">
                  <Dumbbell className="h-4 w-4 shrink-0" />
                  오늘 세션 차감 완료
                  <span className="ml-auto text-xs opacity-70">완료</span>
                </div>
              ) : (
              <button
                onClick={() => setDeductSession((d) => !d)}
                className={`flex items-center gap-2 w-full py-2.5 px-3 rounded-lg border text-sm transition-colors ${
                  deductSession
                    ? "bg-primary/20 border-primary/40 text-primary"
                    : "border-border text-muted-foreground hover:border-primary/30"
                }`}
              >
                <Dumbbell className="h-4 w-4 shrink-0" />
                PT 세션 1회 차감
                <span className="ml-auto text-xs opacity-70">
                  {deductSession ? "ON" : "OFF"}
                </span>
              </button>
              )}
              {deductSession && activePkgs.length > 1 && (
                <div className="flex gap-2 flex-wrap">
                  {activePkgs.map((pkg) => (
                    <button
                      key={pkg.id}
                      onClick={() => setSelectedPkgId(pkg.id)}
                      className={`text-xs px-2.5 py-1.5 rounded-lg border transition-colors ${
                        selectedPkgId === pkg.id
                          ? "bg-primary/20 border-primary/40 text-primary"
                          : "border-border text-muted-foreground hover:border-primary/30"
                      }`}
                    >
                      {pkg.packageName || "PT"} ({pkg.totalSessions - pkg.usedSessions}회 잔여)
                    </button>
                  ))}
                </div>
              )}
              {deductSession && activePkgs.length === 1 && (
                <p className="text-xs text-muted-foreground">
                  {activePkgs[0].packageName || "PT"} — 잔여 {activePkgs[0].totalSessions - activePkgs[0].usedSessions}회
                </p>
              )}
            </div>
          </Section>
        )}

        {/* 버튼 */}
        <div className="flex gap-3 pt-2">
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? "저장 중..." : "저장"}
          </Button>
          <Button variant="outline" onClick={() => setLocation(`/attendance?date=${dateParam}`)}>
            취소
          </Button>
        </div>
      </div>

      {/* 출석 취소 확인 다이얼로그 */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle>출석 취소</DialogTitle>
            <DialogDescription>
              {member?.name}님의 출석 기록을 삭제하고 미출석 상태로 되돌립니다.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 pt-1">
            <Button variant="outline" className="flex-1" onClick={() => setDeleteConfirmOpen(false)}>
              닫기
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              disabled={deleteMutation.isPending}
              onClick={() => {
                setDeleteConfirmOpen(false);
                deleteMutation.mutate({ memberId, date: dateParam });
              }}
            >
              {deleteMutation.isPending ? "취소 중..." : "출석 취소"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
