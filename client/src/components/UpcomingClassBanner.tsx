import { useRef, useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Bell, CheckCircle, XCircle, CalendarDays, Pen, RotateCcw, ChevronRight } from "lucide-react";

// ─── KST 시간 유틸 ─────────────────────────────────────────────────────────────
function kstMinutesNow() {
  const utc = new Date();
  const kst = new Date(utc.getTime() + 9 * 60 * 60 * 1000);
  return kst.getUTCHours() * 60 + kst.getUTCMinutes();
}
function minutesUntil(timeStr: string) {
  const [h, m] = timeStr.split(":").map(Number);
  return h * 60 + m - kstMinutesNow();
}

// ─── 체크인 데이터 타입 ──────────────────────────────────────────────────────────
interface Checkin {
  condition: number;      // 1~5
  sleep: number;          // 1=충분 0=6h미만
  nutrition: number;      // 1=단백질 2=탄수화물 0=결식/부족
  painLevel: number;      // 0=없음 1~5
  painNote?: string;
}

// ─── 체크인 스텝 ─────────────────────────────────────────────────────────────────
function CheckinStep({ memberName, onNext }: { memberName: string | null; onNext: (data: Checkin) => void }) {
  const [condition, setCondition] = useState(0);
  const [sleepShort, setSleepShort] = useState(false); // 6시간 이하 여부
  const [nutrition, setNutrition] = useState<Set<number>>(new Set());
  const [pain, setPain] = useState<number | null>(null);
  const [painNote, setPainNote] = useState("");

  const conditionOk = condition >= 1;
  const nutritionOk = nutrition.size > 0;
  const painOk = pain !== null;
  const canNext = conditionOk && nutritionOk && painOk;

  const ToggleBtn = ({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) => (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors border ${
        active ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:text-foreground hover:border-border/80"
      }`}
    >
      {children}
    </button>
  );

  const ScoreBtn = ({ val, current, onClick }: { val: number; current: number; onClick: () => void }) => (
    <button
      type="button"
      onClick={onClick}
      className={`w-10 h-10 rounded-lg text-sm font-bold transition-colors border ${
        current === val ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:text-foreground"
      }`}
    >
      {val}
    </button>
  );

  return (
    <div className="space-y-5">
      <div>
        <p className="text-base font-semibold">수업 전 체크인</p>
        {memberName && <p className="text-xs text-muted-foreground mt-0.5">{memberName}</p>}
      </div>

      {/* 컨디션 */}
      <div className="space-y-2">
        <p className="text-sm font-medium text-foreground">컨디션</p>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground shrink-0">나쁨</span>
          {[1, 2, 3, 4, 5].map(v => (
            <ScoreBtn key={v} val={v} current={condition} onClick={() => setCondition(v)} />
          ))}
          <span className="text-xs text-muted-foreground shrink-0">최고</span>
        </div>
      </div>

      {/* 수면 6시간 이하 */}
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-foreground">수면 6시간 이하</p>
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={sleepShort}
            onChange={e => setSleepShort(e.target.checked)}
            className="w-4 h-4 accent-red-400 cursor-pointer"
          />
          <span className={`text-sm font-medium ${sleepShort ? "text-red-400" : "text-muted-foreground"}`}>
            {sleepShort ? "예" : "아니오"}
          </span>
        </label>
      </div>

      {/* 영양 */}
      <div className="space-y-2">
        <p className="text-sm font-medium text-foreground">영양</p>
        <div className="flex gap-2">
          {([[1, "단백질"], [2, "탄수화물"], [0, "결식 / 부족"]] as [number, string][]).map(([v, label]) => (
            <ToggleBtn
              key={v}
              active={nutrition.has(v)}
              onClick={() => setNutrition(prev => {
                const next = new Set(prev);
                next.has(v) ? next.delete(v) : next.add(v);
                return next;
              })}
            >{label}</ToggleBtn>
          ))}
        </div>
      </div>

      {/* 통증 */}
      <div className="space-y-2">
        <p className="text-sm font-medium text-foreground">통증</p>
        <div className="flex gap-2">
          <ToggleBtn active={pain === 0} onClick={() => { setPain(0); setPainNote(""); }}>없음</ToggleBtn>
          <ToggleBtn active={pain !== null && pain > 0} onClick={() => setPain(p => (p !== null && p > 0) ? p : 1)}>있음</ToggleBtn>
        </div>
        {pain !== null && pain > 0 && (
          <div className="space-y-2 pl-1 pt-1">
            <div className="flex items-center gap-1.5">
              {[1, 2, 3, 4, 5].map(v => (
                <ScoreBtn key={v} val={v} current={pain} onClick={() => setPain(v)} />
              ))}
              <span className="text-xs text-muted-foreground ml-1">
                {pain <= 2 ? "약함" : pain === 3 ? "중간" : pain === 4 ? "강함" : "매우 강함"}
              </span>
            </div>
            <input
              type="text"
              value={painNote}
              onChange={e => setPainNote(e.target.value)}
              placeholder="통증 부위 (예: 왼쪽 무릎, 허리)"
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        )}
      </div>

      <button
        type="button"
        disabled={!canNext}
        onClick={() => onNext({ condition, sleep: sleepShort ? 0 : 1, nutrition: [...nutrition][0] ?? 0, painLevel: pain!, painNote })}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-40"
      >
        서명하기
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}

// ─── 캔버스 서명 패드 ──────────────────────────────────────────────────────────
function SignaturePad({ onSign, onClear, hasSignature }: {
  onSign: (dataUrl: string) => void;
  onClear: () => void;
  hasSignature: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);

  const getPos = (e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ("touches" in e) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY,
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    e.preventDefault();
    drawing.current = true;
    lastPos.current = getPos(e, canvas);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!drawing.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    e.preventDefault();
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const pos = getPos(e, canvas);
    ctx.beginPath();
    ctx.moveTo(lastPos.current!.x, lastPos.current!.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();
    lastPos.current = pos;
    onSign(canvas.toDataURL("image/png"));
  };

  const endDraw = () => { drawing.current = false; lastPos.current = null; };

  const clear = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
    onClear();
  }, [onClear]);

  return (
    <div className="space-y-2">
      <div className="relative border border-border rounded-xl overflow-hidden bg-slate-900/50" style={{ touchAction: "none" }}>
        <canvas
          ref={canvasRef}
          width={600} height={160}
          className="w-full cursor-crosshair block"
          onMouseDown={startDraw} onMouseMove={draw} onMouseUp={endDraw} onMouseLeave={endDraw}
          onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={endDraw}
        />
        {!hasSignature && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="flex items-center gap-2 text-muted-foreground/40">
              <Pen className="h-4 w-4" />
              <span className="text-sm">여기에 서명하세요</span>
            </div>
          </div>
        )}
      </div>
      {hasSignature && (
        <button type="button" onClick={clear} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <RotateCcw className="h-3.5 w-3.5" /> 다시 그리기
        </button>
      )}
    </div>
  );
}

// ─── 서명 + 완료 모달 ─────────────────────────────────────────────────────────
type Slot = { id: number; memberName: string | null; scheduledTime: string | null; notes: string | null; eventType: string | null };
type ModalStep = "checkin" | "signature" | "confirm" | "done";

function CompletionModal({ slot, onClose }: { slot: Slot; onClose: () => void }) {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const isPt = !slot.eventType || slot.eventType === "pt";
  const [step, setStep] = useState<ModalStep>(isPt ? "checkin" : "confirm");
  const [checkin, setCheckin] = useState<Checkin | null>(null);
  const [sigDataUrl, setSigDataUrl] = useState<string | null>(null);
  const [doneData, setDoneData] = useState<{ remaining: number | null } | null>(null);

  const completeMutation = trpc.schedules.completeWithSignature.useMutation({
    onSuccess: (res) => {
      utils.schedules.todayUpcoming.invalidate();
      utils.dashboard.getStats.invalidate();
      setDoneData({ remaining: res.sessionResult?.remaining ?? null });
      setStep("done");
    },
    onError: (e) => toast.error(e.message || "완료 처리 실패"),
  });

  const handleCheckinNext = (data: Checkin) => {
    setCheckin(data);
    setStep("signature");
  };

  const handleSubmit = () => {
    if (isPt && !sigDataUrl) return;
    completeMutation.mutate({
      scheduleId: slot.id,
      ...(sigDataUrl ? { signature: sigDataUrl } : {}),
      checkin: checkin ?? undefined,
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={() => { if (!completeMutation.isPending && step !== "done") onClose(); }}
    >
      <div
        className="bg-card border border-border rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md p-5 shadow-2xl max-h-[90dvh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {step === "checkin" && (
          <CheckinStep memberName={slot.memberName} onNext={handleCheckinNext} />
        )}

        {/* 상담/체험/회의 등 — 서명 없이 바로 완료 */}
        {step === "confirm" && (
          <div className="space-y-4">
            <div>
              <p className="text-base font-semibold">완료 처리</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {slot.scheduledTime}{slot.memberName ? ` · ${slot.memberName}` : ""}
                {slot.notes ? ` · ${slot.notes}` : ""}
              </p>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={onClose} className="px-4 py-2.5 rounded-xl bg-accent text-foreground text-sm hover:bg-accent/80 transition-colors">
                취소
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={completeMutation.isPending}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-500 transition-colors disabled:opacity-40"
              >
                <CheckCircle className="h-4 w-4" />
                {completeMutation.isPending ? "처리 중..." : "완료 처리"}
              </button>
            </div>
          </div>
        )}

        {step === "signature" && (
          <div className="space-y-4">
            <div>
              <p className="text-base font-semibold">수업 완료 서명</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {slot.scheduledTime}{slot.memberName ? ` · ${slot.memberName}` : ""}
                {slot.notes ? ` · ${slot.notes}` : ""}
              </p>
            </div>
            <SignaturePad
              hasSignature={!!sigDataUrl}
              onSign={setSigDataUrl}
              onClear={() => setSigDataUrl(null)}
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setStep("checkin")}
                className="px-4 py-2.5 rounded-xl bg-accent text-foreground text-sm hover:bg-accent/80 transition-colors"
              >
                이전
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!sigDataUrl || completeMutation.isPending}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-500 transition-colors disabled:opacity-40"
              >
                <CheckCircle className="h-4 w-4" />
                {completeMutation.isPending ? "처리 중..." : "서명 완료"}
              </button>
            </div>
          </div>
        )}

        {step === "done" && doneData && (
          <div className="space-y-4 text-center py-2">
            <div className="flex justify-center">
              <div className="w-14 h-14 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <CheckCircle className="h-7 w-7 text-emerald-400" />
              </div>
            </div>
            <div>
              <p className="text-base font-semibold">수업 완료!</p>
              {doneData.remaining !== null && (
                <p className="text-sm text-muted-foreground mt-0.5">
                  {slot.memberName} 잔여 <span className="text-foreground font-medium">{doneData.remaining}회</span>
                </p>
              )}
            </div>
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => { onClose(); setLocation("/schedule"); }}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                <CalendarDays className="h-4 w-4" />
                다음 스케줄 잡기
              </button>
              <button type="button" onClick={onClose} className="px-4 py-2.5 rounded-xl bg-accent text-foreground text-sm hover:bg-accent/80 transition-colors">
                닫기
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── 메인 배너 ─────────────────────────────────────────────────────────────────
export default function UpcomingClassBanner() {
  const utils = trpc.useUtils();
  const { data: upcoming } = trpc.schedules.todayUpcoming.useQuery(undefined, {
    refetchInterval: 30_000,
    staleTime: 0,
  });
  const [activeSlot, setActiveSlot] = useState<Slot | null>(null);

  const cancelMutation = trpc.schedules.updateStatus.useMutation({
    onSuccess: () => { utils.schedules.todayUpcoming.invalidate(); toast.success("수업 취소 처리됨"); },
    onError: (e) => toast.error(e.message || "취소 실패"),
  });

  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  if (!upcoming || upcoming.length === 0) return null;

  const relevant = upcoming.filter(slot => {
    if (!slot.scheduledTime) return false;
    const diff = minutesUntil(slot.scheduledTime);
    return diff >= -60 && diff <= 30;
  });

  if (relevant.length === 0) return null;

  return (
    <>
      <div className="space-y-2">
        {relevant.map(slot => {
          const diff = minutesUntil(slot.scheduledTime!);
          const isOngoing = diff <= 0;
          const label = isOngoing
            ? `수업 진행 중 (${Math.abs(diff)}분 경과)`
            : `${diff}분 후 수업`;

          return (
            <div
              key={slot.id}
              className={`rounded-xl px-4 py-3 flex items-center gap-3 border ${
                isOngoing ? "bg-blue-500/15 border-blue-500/40" : "bg-amber-500/15 border-amber-500/40"
              }`}
            >
              <Bell className={`h-4 w-4 shrink-0 ${isOngoing ? "text-blue-400" : "text-amber-400"}`} />
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-semibold ${isOngoing ? "text-blue-300" : "text-amber-300"}`}>
                  {isOngoing ? "🔵" : "🔔"} {label}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {slot.scheduledTime}
                  {slot.memberName ? ` · ${slot.memberName}` : " · 고정 슬롯"}
                  {slot.trainerName ? ` · ${slot.trainerName}` : ""}
                  {slot.notes ? ` · ${slot.notes}` : ""}
                </p>
              </div>
              <div className="flex gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setActiveSlot(slot as Slot)}
                  className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors font-medium"
                >
                  <CheckCircle className="h-3.5 w-3.5" />
                  완료
                </button>
                <button
                  type="button"
                  onClick={() => cancelMutation.mutate({ scheduleId: slot.id, status: "cancelled" })}
                  disabled={cancelMutation.isPending}
                  className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors font-medium disabled:opacity-50"
                >
                  <XCircle className="h-3.5 w-3.5" />
                  취소
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {activeSlot && (
        <CompletionModal slot={activeSlot} onClose={() => setActiveSlot(null)} />
      )}
    </>
  );
}
