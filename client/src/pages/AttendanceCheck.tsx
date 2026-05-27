import { useState, useEffect, useRef } from "react";
import { useLocation, useSearch } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ArrowLeft, ChevronDown, ChevronUp, Dumbbell } from "lucide-react";

interface Props {
  memberId: number;
}

type Status = "attended" | "noshow" | "cancelled";

const DIET_CATEGORIES = [
  "인스턴트탄수화물",
  "건강식탄수화물",
  "인스턴트단백질",
  "건강식단백질",
  "인스턴트지방",
  "건강식지방",
  "미섭취",
];

const PAIN_AREAS = [
  "목", "상부등", "중부등", "어깨 전면", "어깨 후면",
  "기립근", "엉치", "고관절", "무릎", "발목",
  "발바닥", "팔꿈치", "손목", "기타",
];

const SLEEP_OPTIONS = [
  { label: "4h↓", value: "4" },
  { label: "5h", value: "5" },
  { label: "6h", value: "6" },
  { label: "7h", value: "7" },
  { label: "8h", value: "8" },
  { label: "9h+", value: "9" },
];

function nowTimeStr() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h2 className="text-sm font-bold text-primary">{title}</h2>
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

  // 컨디션 평가
  const [conditionScore, setConditionScore] = useState("");
  const [sleepHours, setSleepHours] = useState("");
  const [energyLevel, setEnergyLevel] = useState("");

  // 식단 (카테고리 중복선택)
  const [dietCategories, setDietCategories] = useState<string[]>([]);

  // 통증
  const [painLevel, setPainLevel] = useState("");
  const [selectedPainAreas, setSelectedPainAreas] = useState<string[]>([]);
  const [painAreaOther, setPainAreaOther] = useState("");
  const [painAreaOpen, setPainAreaOpen] = useState(false);

  const [notes, setNotes] = useState("");
  const [deductSession, setDeductSession] = useState(false);
  const [selectedPkgId, setSelectedPkgId] = useState<number | null>(null);
  const savingRef = useRef(false);
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
    if (alreadyDeducted) { setDeductSession(false); return; }
    if (activePkgs.length > 0 && !existing) setDeductSession(true);
  }, [ptPackageList, existing, alreadyDeducted]);

  useEffect(() => {
    if (!existing) return;
    setStatus(existing.status as Status);
    setCheckDate(existing.checkDate);
    setCheckTime(existing.checkTime ?? nowTimeStr());
    setConditionScore(existing.conditionScore != null ? String(existing.conditionScore) : "");
    setSleepHours(existing.sleepHours ?? "");
    setEnergyLevel(existing.energyLevel ?? "");
    try {
      setDietCategories(existing.diet ? JSON.parse(existing.diet) : []);
    } catch {
      setDietCategories([]);
    }
    setPainLevel(existing.painLevel != null ? String(existing.painLevel) : "");
    const areas = existing.painArea ? existing.painArea.split(", ").filter(Boolean) : [];
    setSelectedPainAreas(areas);
    setPainAreaOther(existing.painSide ?? "");
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
              savingRef.current = false;
              toast.success("출석 및 세션이 저장되었습니다.");
              setLocation(`/attendance?date=${checkDate}`);
            },
          }
        );
      } else {
        savingRef.current = false;
        toast.success("출석이 저장되었습니다.");
        setLocation(`/attendance?date=${checkDate}`);
      }
    },
    onError: (err) => { savingRef.current = false; toast.error(err.message || "저장 실패"); },
  });

  const handleSave = () => {
    if (savingRef.current) return;
    savingRef.current = true;
    const painAreaStr = selectedPainAreas.length ? selectedPainAreas.join(", ") : undefined;
    upsertMutation.mutate({
      memberId,
      checkDate,
      checkTime,
      status,
      conditionScore: conditionScore ? parseInt(conditionScore) : undefined,
      sleepHours: sleepHours || undefined,
      energyLevel: energyLevel || undefined,
      diet: dietCategories.length ? JSON.stringify(dietCategories) : undefined,
      painLevel: painLevel !== "" ? parseInt(painLevel) : undefined,
      painArea: painAreaStr,
      painSide: painAreaOther || undefined,
      notes: notes || undefined,
    });
  };

  const toggleDiet = (cat: string) => {
    setDietCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  };

  const togglePainArea = (area: string) => {
    setSelectedPainAreas((prev) =>
      prev.includes(area) ? prev.filter((a) => a !== area) : [...prev, area]
    );
  };

  const isSaving = upsertMutation.isPending || useSessionMutation.isPending;
  const painNum = painLevel !== "" ? parseInt(painLevel) : null;

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

      <div className="bg-card border border-border rounded-xl p-4 space-y-6">

        {/* 기본 정보 */}
        <Section title="기본 정보">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">날짜</p>
              <input
                type="date"
                value={checkDate}
                onChange={(e) => setCheckDate(e.target.value)}
                className="w-full bg-input border border-border rounded-lg px-2 py-1.5 text-sm text-foreground"
              />
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">시간</p>
              <input
                type="time"
                value={checkTime}
                onChange={(e) => setCheckTime(e.target.value)}
                className="w-full bg-input border border-border rounded-lg px-2 py-1.5 text-sm text-foreground"
              />
            </div>
          </div>
        </Section>

        {/* 컨디션 평가 */}
        <Section title="컨디션 평가">
          {/* 컨디션 점수 */}
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground">오늘 컨디션 <span className="text-muted-foreground/60">(1 매우안좋음 → 5 최고)</span></p>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((v) => (
                <button
                  key={v}
                  onClick={() => setConditionScore(conditionScore === String(v) ? "" : String(v))}
                  className={`flex-1 py-2.5 rounded-lg border text-sm font-semibold transition-colors ${
                    conditionScore === String(v)
                      ? "bg-primary border-primary text-primary-foreground"
                      : "border-border text-muted-foreground hover:border-primary/40"
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>

          {/* 수면시간 */}
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground">수면시간</p>
            <div className="flex gap-1.5 flex-wrap">
              {SLEEP_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setSleepHours(sleepHours === opt.value ? "" : opt.value)}
                  className={`flex-1 min-w-0 py-2 rounded-lg border text-xs font-medium transition-colors ${
                    sleepHours === opt.value
                      ? "bg-primary border-primary text-primary-foreground"
                      : "border-border text-muted-foreground hover:border-primary/40"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* 에너지 */}
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground">에너지 수준</p>
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
          </div>
        </Section>

        {/* 식단 정보 */}
        <Section title="식단 정보">
          <p className="text-xs text-muted-foreground -mt-1">오늘 섭취한 식단 유형 (중복 선택 가능)</p>
          <div className="grid grid-cols-2 gap-2">
            {DIET_CATEGORIES.map((cat) => {
              const selected = dietCategories.includes(cat);
              return (
                <button
                  key={cat}
                  onClick={() => toggleDiet(cat)}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm text-left transition-colors ${
                    selected
                      ? "bg-primary/15 border-primary/50 text-primary"
                      : "border-border text-muted-foreground hover:border-primary/30"
                  }`}
                >
                  <span className={`w-4 h-4 rounded border shrink-0 flex items-center justify-center text-xs ${
                    selected ? "bg-primary border-primary text-primary-foreground" : "border-border"
                  }`}>
                    {selected ? "✓" : ""}
                  </span>
                  {cat}
                </button>
              );
            })}
          </div>
        </Section>

        {/* 통증 정보 */}
        <Section title="통증 정보">
          {/* 통증 수준 0-10 */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>이상없음</span>
              <span>통증심함</span>
            </div>
            <div className="flex gap-1">
              {Array.from({ length: 11 }, (_, i) => (
                <button
                  key={i}
                  onClick={() => setPainLevel(painLevel === String(i) ? "" : String(i))}
                  className={`flex-1 aspect-square rounded-full border text-xs font-medium transition-colors ${
                    painNum === i
                      ? i === 0
                        ? "bg-green-500 border-green-500 text-white"
                        : i <= 3
                        ? "bg-yellow-500 border-yellow-500 text-white"
                        : i <= 6
                        ? "bg-orange-500 border-orange-500 text-white"
                        : "bg-red-500 border-red-500 text-white"
                      : "border-border text-muted-foreground hover:border-primary/40"
                  }`}
                >
                  {i}
                </button>
              ))}
            </div>
          </div>

          {/* 통증 부위 드롭다운 */}
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground">통증 부위</p>
            <button
              onClick={() => setPainAreaOpen((o) => !o)}
              className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg border border-border text-sm text-left hover:border-primary/40 transition-colors"
            >
              <span className={selectedPainAreas.length ? "text-foreground" : "text-muted-foreground"}>
                {selectedPainAreas.length
                  ? selectedPainAreas.filter(a => a !== "기타").join(", ") + (selectedPainAreas.includes("기타") ? (selectedPainAreas.length > 1 ? ", 기타" : "기타") : "")
                  : "부위 선택"}
              </span>
              {painAreaOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
            </button>

            {painAreaOpen && (
              <div className="border border-border rounded-lg overflow-hidden">
                <div className="grid grid-cols-2">
                  {PAIN_AREAS.map((area, i) => {
                    const selected = selectedPainAreas.includes(area);
                    const isLast = i === PAIN_AREAS.length - 1;
                    return (
                      <button
                        key={area}
                        onClick={() => togglePainArea(area)}
                        className={`flex items-center gap-2 px-3 py-2.5 text-sm text-left border-b border-border transition-colors ${
                          isLast && PAIN_AREAS.length % 2 !== 0 ? "col-span-2" : ""
                        } ${selected ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent"}`}
                      >
                        <span className={`w-4 h-4 rounded border shrink-0 flex items-center justify-center text-xs ${
                          selected ? "bg-primary border-primary text-primary-foreground" : "border-border"
                        }`}>
                          {selected ? "✓" : ""}
                        </span>
                        {area}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 기타 텍스트 */}
            {selectedPainAreas.includes("기타") && (
              <input
                type="text"
                value={painAreaOther}
                onChange={(e) => setPainAreaOther(e.target.value)}
                placeholder="기타 통증 부위 직접 입력"
                className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground"
              />
            )}
          </div>
        </Section>

        {/* 추가 메모 */}
        <Section title="추가 메모">
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="특이사항이나 추가 메모"
            rows={3}
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
                  <span className="ml-auto text-xs opacity-70">{deductSession ? "ON" : "OFF"}</span>
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
        <div className="flex gap-3 pt-1">
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
