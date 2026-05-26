import { useState, useEffect, useRef } from "react";
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

// ── 색상 기반 신체 부위 감지 ──────────────────────────────────────────────────
function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l * 100];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) * 60;
  else if (max === gn) h = ((bn - rn) / d + 2) * 60;
  else h = ((rn - gn) / d + 4) * 60;
  return [h, s * 100, l * 100];
}
function hueIn(h: number, min: number, max: number) {
  return min <= max ? h >= min && h <= max : h >= min || h <= max;
}

type ColorRule = {
  hMin: number; hMax: number; sMin: number;
  yMin?: number; yMax?: number;
  part: (xPct: number) => string;
};

// 같은 색이 상/하체에 겹치는 경우 yMin/yMax로 구분
const FRONT_RULES: ColorRule[] = [
  // 서혜부 — yellow (노란색, y>48%), 복근보다 먼저 매칭
  { hMin: 40,  hMax: 76,  sMin: 35, yMin: 48, part: () => "서혜부" },
  // 가슴 — red/salmon
  { hMin: 340, hMax: 20,  sMin: 40, yMax: 55, part: () => "가슴" },
  // 어깨 — orange, 상단만 (y<28%)
  { hMin: 18,  hMax: 40,  sMin: 45, yMax: 28, part: x => x < 50 ? "좌 어깨" : "우 어깨" },
  // 복근 — orange, 중간 (y 28~62%)
  { hMin: 18,  hMax: 40,  sMin: 45, yMin: 28, yMax: 62, part: () => "복근" },
  // 정강이 — orange, 하단 (y>62%)
  { hMin: 18,  hMax: 40,  sMin: 45, yMin: 62, part: x => x < 50 ? "좌 정강이" : "우 정강이" },
  // 이두근 — green, 상체 (y<53%)
  { hMin: 76,  hMax: 148, sMin: 28, yMax: 53, part: x => x < 50 ? "좌 이두근" : "우 이두근" },
  // 고관절 — lime/green, 엉덩이 옆 (y 53~73%)
  { hMin: 76,  hMax: 148, sMin: 28, yMin: 53, yMax: 73, part: x => x < 50 ? "좌 고관절" : "우 고관절" },
  // 전완근 — teal, 복부 옆 레벨 (y 35~58%)
  { hMin: 148, hMax: 200, sMin: 40, yMin: 35, yMax: 58, part: x => x < 50 ? "좌 전완근" : "우 전완근" },
  // 손목 — teal, 손 레벨 (y 58~73%)
  { hMin: 148, hMax: 200, sMin: 40, yMin: 58, yMax: 73, part: x => x < 50 ? "좌 손목" : "우 손목" },
  // 발목 — teal, 최하단 (y>88%)
  { hMin: 148, hMax: 200, sMin: 40, yMin: 88, part: x => x < 50 ? "좌 발목" : "우 발목" },
  // 무릎 — blue
  { hMin: 200, hMax: 262, sMin: 25, part: x => x < 50 ? "좌 무릎" : "우 무릎" },
  // 목/승모근 — purple, 최상단 (y<25%)
  { hMin: 262, hMax: 310, sMin: 25, yMax: 25, part: () => "목/승모근" },
  // 어깨(삼각근) — purple, y 25~30%만
  { hMin: 262, hMax: 310, sMin: 25, yMin: 25, yMax: 30, part: x => x < 50 ? "좌 어깨" : "우 어깨" },
  // 팔(전완) — purple, y 30~52%
  { hMin: 262, hMax: 310, sMin: 25, yMin: 30, yMax: 52, part: x => x < 50 ? "좌 팔" : "우 팔" },
  // 사두근 — purple y 52~80% (허벅지)
  { hMin: 262, hMax: 310, sMin: 25, yMin: 52, yMax: 80, part: x => x < 50 ? "좌 사두근" : "우 사두근" },
  // 사두근 — pink/magenta wrapping (hue 290-360 and 0-20), y>52%
  { hMin: 290, hMax: 20,  sMin: 35, yMin: 52, part: x => x < 50 ? "좌 사두근" : "우 사두근" },
];

const BACK_RULES: ColorRule[] = [
  // 회전근개 — pink/salmon, 상체 (y<48%)
  { hMin: 340, hMax: 20,  sMin: 35, yMax: 48, part: () => "회전근개" },
  // 후면 어깨 — orange, 상단 (y<33%)
  { hMin: 18,  hMax: 46,  sMin: 45, yMax: 33, part: x => x < 50 ? "좌 회전근개" : "우 회전근개" },
  // 허리 — orange, 중간 (y 33~62%)
  { hMin: 18,  hMax: 46,  sMin: 45, yMin: 33, yMax: 62, part: () => "허리" },
  // 종아리 — orange, 하단 (y>62%)
  { hMin: 18,  hMax: 46,  sMin: 45, yMin: 62, part: x => x < 50 ? "좌 종아리" : "우 종아리" },
  // 고관절 — yellow/gold (y 50~70%)
  { hMin: 46,  hMax: 73,  sMin: 35, yMin: 50, yMax: 70, part: x => x < 50 ? "좌 고관절" : "우 고관절" },
  // 팔 — green, 상체 팔 (y<50%)
  { hMin: 73,  hMax: 148, sMin: 28, yMax: 50, part: x => x < 50 ? "좌 팔" : "우 팔" },
  // 둔근 — lime green, 엉덩이 (y 50~73%)
  { hMin: 73,  hMax: 148, sMin: 28, yMin: 50, yMax: 73, part: () => "둔근" },
  // 광배근 — teal/cyan, 등 중간 (y 18~58%)
  { hMin: 148, hMax: 200, sMin: 40, yMin: 18, yMax: 58, part: x => x < 50 ? "좌 광배근" : "우 광배근" },
  // 손목 — teal, 손목 레벨 (y 58~73%)
  { hMin: 148, hMax: 200, sMin: 40, yMin: 58, yMax: 73, part: x => x < 50 ? "좌 손목" : "우 손목" },
  // 발목 — teal, 최하단 (y>88%)
  { hMin: 148, hMax: 200, sMin: 40, yMin: 88, part: x => x < 50 ? "좌 발목" : "우 발목" },
  // 무릎 — blue
  { hMin: 200, hMax: 262, sMin: 25, part: x => x < 50 ? "좌 무릎" : "우 무릎" },
  // 목/승모근 — purple, 최상단 (y<22%)
  { hMin: 262, hMax: 310, sMin: 25, yMax: 22, part: () => "목/승모근" },
  // 삼두근 — purple, 팔 구간 (y 22~62%)
  { hMin: 262, hMax: 310, sMin: 25, yMin: 22, yMax: 62, part: x => x < 50 ? "좌 삼두근" : "우 삼두근" },
  // 햄스트링 — purple/magenta 하체 후면 (hue 260~355 wrapping, y 62~85%)
  { hMin: 260, hMax: 355, sMin: 30, yMin: 62, yMax: 85, part: x => x < 50 ? "좌 햄스트링" : "우 햄스트링" },
];

function BodyPainMap({ selected, onChange }: { selected: string[]; onChange: (v: string[]) => void }) {
  const [view, setView] = useState<"front" | "back">("front");
  const [flash, setFlash] = useState<{ part: string; x: number; y: number } | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  function handleTap(e: React.MouseEvent<HTMLImageElement>) {
    const img = imgRef.current;
    if (!img) return;
    const rect = img.getBoundingClientRect();
    const xPct = ((e.clientX - rect.left) / rect.width) * 100;
    const yPct = ((e.clientY - rect.top) / rect.height) * 100;

    // 캔버스에 이미지를 그려서 픽셀 색상 읽기
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(img, 0, 0);
    const px = Math.round((xPct / 100) * img.naturalWidth);
    const py = Math.round((yPct / 100) * img.naturalHeight);
    const [r, g, b, a] = ctx.getImageData(px, py, 1, 1).data;

    if (a < 100) return; // 투명
    const [h, s, l] = rgbToHsl(r, g, b);
    if (s < 15 || l > 92 || l < 8) return; // 흰색/검정/무채색 무시

    const rules = view === "front" ? FRONT_RULES : BACK_RULES;
    const rule = rules.find(rule => {
      if (s < rule.sMin) return false;
      if (rule.yMin !== undefined && yPct < rule.yMin) return false;
      if (rule.yMax !== undefined && yPct > rule.yMax) return false;
      return hueIn(h, rule.hMin, rule.hMax);
    });
    if (!rule) return;

    const part = rule.part(xPct);
    onChange(selected.includes(part) ? selected.filter(p => p !== part) : [...selected, part]);
    setFlash({ part, x: xPct, y: yPct });
    setTimeout(() => setFlash(null), 1200);
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 rounded-lg border border-border overflow-hidden text-sm">
        {(["front", "back"] as const).map(v => (
          <button key={v} onClick={() => setView(v)}
            className={`py-1.5 font-medium transition-colors touch-manipulation ${view === v ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}>
            {v === "front" ? "전면" : "후면"}
          </button>
        ))}
      </div>

      <div className="relative rounded-xl border border-border overflow-hidden cursor-pointer">
        <img
          ref={imgRef}
          src={view === "front" ? "/body-front.png" : "/body-back.png"}
          className="block w-full touch-manipulation"
          draggable={false}
          crossOrigin="anonymous"
          alt="신체 부위 — 탭하세요"
          onClick={handleTap}
        />
        {flash && (
          <div
            className="absolute -translate-x-1/2 -translate-y-full pointer-events-none"
            style={{ left: `${flash.x}%`, top: `${flash.y}%` }}
          >
            <div className="bg-black/80 text-white text-xs font-bold px-2 py-1 rounded-lg whitespace-nowrap mb-1 animate-bounce">
              {selected.includes(flash.part) ? `✓ ${flash.part}` : `✕ ${flash.part} 해제`}
            </div>
          </div>
        )}
      </div>

      {selected.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-muted-foreground">선택된 부위</p>
            <button onClick={() => onChange([])} className="text-[11px] text-muted-foreground underline">전체 삭제</button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {selected.map(part => (
              <button key={part} onClick={() => onChange(selected.filter(p => p !== part))}
                className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs bg-primary/20 text-primary border border-primary/40 hover:bg-primary/30 transition-colors touch-manipulation">
                {part}<X className="h-3 w-3" />
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
            <label className="text-sm text-muted-foreground">통증 부위 <span className="text-xs">(해당 부위를 탭하세요)</span></label>
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
