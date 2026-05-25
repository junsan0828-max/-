import { useState, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ArrowLeft, Dumbbell, Check, X } from "lucide-react";

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

type Zone = { xMin: number; xMax: number; yMin: number; yMax: number; candidates: string[] };

const ZONES: Zone[] = [
  // ── 전면 (왼쪽 절반) ──
  { xMin: 8,  xMax: 42, yMin: 0,  yMax: 17, candidates: ["턱관절", "목", "두통"] },
  { xMin: 0,  xMax: 20, yMin: 17, yMax: 55, candidates: ["좌 어깨", "좌 팔꿈치", "좌 손목"] },
  { xMin: 32, xMax: 50, yMin: 17, yMax: 55, candidates: ["우 어깨", "우 팔꿈치", "우 손목"] },
  { xMin: 13, xMax: 37, yMin: 17, yMax: 35, candidates: ["가슴", "어깨", "목"] },
  { xMin: 13, xMax: 37, yMin: 33, yMax: 55, candidates: ["가슴", "복부", "갈비뼈"] },
  { xMin: 8,  xMax: 42, yMin: 53, yMax: 68, candidates: ["좌 고관절", "우 고관절", "골반"] },
  { xMin: 5,  xMax: 24, yMin: 66, yMax: 87, candidates: ["좌 허벅지", "좌 무릎", "좌 종아리"] },
  { xMin: 22, xMax: 47, yMin: 66, yMax: 87, candidates: ["우 허벅지", "우 무릎", "우 종아리"] },
  { xMin: 5,  xMax: 24, yMin: 86, yMax: 100, candidates: ["좌 발목", "좌 발"] },
  { xMin: 22, xMax: 47, yMin: 86, yMax: 100, candidates: ["우 발목", "우 발"] },
  // ── 후면 (오른쪽 절반) ──
  { xMin: 60, xMax: 88, yMin: 0,  yMax: 17, candidates: ["목", "경추", "두통"] },
  { xMin: 50, xMax: 68, yMin: 17, yMax: 55, candidates: ["좌 어깨(후)", "좌 팔", "등"] },
  { xMin: 82, xMax: 100, yMin: 17, yMax: 55, candidates: ["우 어깨(후)", "우 팔", "등"] },
  { xMin: 62, xMax: 86, yMin: 17, yMax: 35, candidates: ["등(승모근)", "어깨", "목"] },
  { xMin: 62, xMax: 86, yMin: 33, yMax: 53, candidates: ["등(승모근)", "허리", "척추"] },
  { xMin: 53, xMax: 97, yMin: 51, yMax: 68, candidates: ["허리", "좌 엉덩이", "우 엉덩이", "골반"] },
  { xMin: 50, xMax: 74, yMin: 66, yMax: 87, candidates: ["좌 허벅지", "좌 무릎", "좌 종아리"] },
  { xMin: 72, xMax: 100, yMin: 66, yMax: 87, candidates: ["우 허벅지", "우 무릎", "우 종아리"] },
  { xMin: 53, xMax: 97, yMin: 86, yMax: 100, candidates: ["좌 발목", "우 발목", "발(족저근막)"] },
];

function BodyPainMap({ selected, onChange }: { selected: string[]; onChange: (v: string[]) => void }) {
  const [candidates, setCandidates] = useState<string[]>([]);
  const [tapDot, setTapDot] = useState<{ x: number; y: number } | null>(null);

  function handleTap(e: React.MouseEvent<HTMLImageElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const xPct = ((e.clientX - rect.left) / rect.width) * 100;
    const yPct = ((e.clientY - rect.top) / rect.height) * 100;
    const zone = ZONES.find(z => xPct >= z.xMin && xPct <= z.xMax && yPct >= z.yMin && yPct <= z.yMax);
    if (zone) {
      setCandidates(zone.candidates);
      setTapDot({ x: xPct, y: yPct });
    } else {
      setCandidates([]);
      setTapDot(null);
    }
  }

  function dismiss() {
    setCandidates([]);
    setTapDot(null);
  }

  function pick(part: string) {
    onChange(selected.includes(part) ? selected.filter(p => p !== part) : [...selected, part]);
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <img
          src="/body-map.png"
          className="w-full block rounded-xl border border-border cursor-pointer touch-manipulation"
          draggable={false}
          alt="신체 부위 선택 — 해당 부위를 탭하세요"
          onClick={handleTap}
        />
        {tapDot && (
          <div
            className="absolute w-5 h-5 rounded-full border-2 border-primary bg-primary/40 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
            style={{ left: `${tapDot.x}%`, top: `${tapDot.y}%` }}
          />
        )}
      </div>

      {candidates.length > 0 && (
        <div className="bg-muted/40 border border-border rounded-xl p-3 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-muted-foreground">이 주변 부위를 선택하세요</p>
            <button onClick={dismiss} className="text-muted-foreground hover:text-foreground p-0.5">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {candidates.map(part => {
              const on = selected.includes(part);
              return (
                <button
                  key={part}
                  onClick={() => pick(part)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors touch-manipulation ${
                    on
                      ? "bg-primary text-white border-primary"
                      : "bg-background text-foreground border-border hover:border-primary/50"
                  }`}
                >
                  {on && <Check className="inline h-3 w-3 mr-1" />}{part}
                </button>
              );
            })}
          </div>
          <p className="text-[11px] text-muted-foreground">선택 후 이미지의 다른 부위를 탭하거나 × 로 닫으세요</p>
        </div>
      )}

      {selected.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-muted-foreground">선택된 부위</p>
          <div className="flex flex-wrap gap-1.5">
            {selected.map(part => (
              <button
                key={part}
                onClick={() => onChange(selected.filter(p => p !== part))}
                className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs bg-primary/20 text-primary border border-primary/40 hover:bg-primary/30 transition-colors touch-manipulation"
              >
                {part}
                <X className="h-3 w-3" />
              </button>
            ))}
          </div>
        </div>
      )}
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
