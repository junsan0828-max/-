import { useState, useEffect, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc";

// ── 아이콘 (SVG, 이모지 없음) ────────────────────────────────────────────────
function IconRun() {
  return (
    <svg viewBox="0 0 40 40" fill="none" className="w-10 h-10">
      <circle cx="20" cy="20" r="18" stroke="currentColor" strokeWidth="1.5" opacity="0.4"/>
      <path d="M14 20 L20 13 L26 20 M20 13 L20 29" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
function IconCheck() {
  return (
    <svg viewBox="0 0 40 40" fill="none" className="w-10 h-10">
      <circle cx="20" cy="20" r="18" stroke="currentColor" strokeWidth="1.5" opacity="0.4"/>
      <path d="M12 20 L18 26 L28 14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
function IconWarn() {
  return (
    <svg viewBox="0 0 40 40" fill="none" className="w-10 h-10">
      <path d="M20 5 L37 33 H3 Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" opacity="0.4"/>
      <line x1="20" y1="16" x2="20" y2="25" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
      <circle cx="20" cy="29.5" r="1.5" fill="currentColor"/>
    </svg>
  );
}
function IconError() {
  return (
    <svg viewBox="0 0 40 40" fill="none" className="w-10 h-10">
      <circle cx="20" cy="20" r="18" stroke="currentColor" strokeWidth="1.5" opacity="0.4"/>
      <path d="M13 13 L27 27 M27 13 L13 27" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
    </svg>
  );
}

// ── 자동닫힘 카운트다운 훅 ───────────────────────────────────────────────────
function useCountdown(durationMs: number, active: boolean, onDone: () => void) {
  const [remaining, setRemaining] = useState(durationMs);
  const startedAt = useRef<number | null>(null);
  const raf = useRef<number | null>(null);

  const cancel = useCallback(() => {
    if (raf.current) cancelAnimationFrame(raf.current);
  }, []);

  useEffect(() => {
    if (!active) { setRemaining(durationMs); startedAt.current = null; return; }
    startedAt.current = performance.now();
    const tick = () => {
      const elapsed = performance.now() - (startedAt.current ?? 0);
      const left = Math.max(0, durationMs - elapsed);
      setRemaining(left);
      if (left > 0) raf.current = requestAnimationFrame(tick);
      else onDone();
    };
    raf.current = requestAnimationFrame(tick);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [active, durationMs]);

  return { remaining, progress: 1 - remaining / durationMs, cancel };
}

// ── 카운트다운 바 컴포넌트 ──────────────────────────────────────────────────
function AutoCloseBar({
  durationMs, active, color, onClose,
}: {
  durationMs: number; active: boolean; color: string; onClose: () => void;
}) {
  const { remaining, progress } = useCountdown(durationMs, active, onClose);
  const secs = Math.ceil(remaining / 1000);
  return (
    <div className="space-y-3 w-full">
      {/* progress bar */}
      <div className="h-0.5 w-full bg-white/10 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-none"
          style={{ width: `${(1 - progress) * 100}%`, background: color }}
        />
      </div>
      {/* 버튼 + 초 */}
      <button
        onClick={onClose}
        className="w-full py-3 rounded-xl text-white/90 text-sm font-medium border border-white/20 hover:bg-white/10 transition-colors flex items-center justify-center gap-2"
      >
        확인
        <span className="text-white/40 text-xs">{secs}초 후 자동 닫힘</span>
      </button>
    </div>
  );
}

type Stage = "input" | "checkin" | "weight_input" | "checkout_ok" | "checkout_fail" | "error";

function nowKstStr() {
  const d = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return `${String(d.getUTCHours()).padStart(2,"0")}:${String(d.getUTCMinutes()).padStart(2,"0")}`;
}

function formatPhone(raw: string) {
  const d = raw.replace(/\D/g,"").slice(0,11);
  if (d.length <= 3) return d;
  if (d.length <= 7) return `${d.slice(0,3)}-${d.slice(3)}`;
  return `${d.slice(0,3)}-${d.slice(3,7)}-${d.slice(7)}`;
}

export default function DietKioskPage() {
  const [phone, setPhone] = useState("");
  const [stage, setStage] = useState<Stage>("input");
  const [memberName, setMemberName] = useState("");
  const [gymPlusMemberId, setGymPlusMemberId] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [weight, setWeight] = useState("");
  const [currentTime, setCurrentTime] = useState(nowKstStr());
  const inputRef = useRef<HTMLInputElement>(null);
  const weightRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const t = setInterval(() => setCurrentTime(nowKstStr()), 10000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (stage === "input") setTimeout(() => inputRef.current?.focus(), 100);
    if (stage === "weight_input") setTimeout(() => weightRef.current?.focus(), 100);
  }, [stage]);

  const doReset = useCallback(() => {
    setStage("input");
    setPhone("");
    setMemberName("");
    setMessage("");
    setWeight("");
    setGymPlusMemberId(null);
  }, []);

  const checkInMut = trpc.kiosk.dietCheckIn.useMutation({
    onSuccess: (data) => {
      setMemberName(data.name);
      setMessage(data.message);
      setElapsed(data.elapsedMin);
      if (data.gymPlusMemberId) setGymPlusMemberId(data.gymPlusMemberId);
      if (data.action === "checkin") {
        setStage("checkin");
      } else if (data.participated) {
        setStage("weight_input");
      } else {
        setStage("checkout_fail");
      }
    },
    onError: (err) => {
      setMessage(err.message || "오류가 발생했습니다.");
      setStage("error");
    },
  });

  const weightLogMut = trpc.gymPlus.logWeight.useMutation({
    onSuccess: () => setStage("checkout_ok"),
    onError: () => setStage("checkout_ok"), // 체중 로그 실패해도 수업 완료는 인정
  });

  const handleCheckIn = () => {
    const digits = phone.replace(/\D/g,"");
    if (digits.length < 9) return;
    checkInMut.mutate({ phone: digits });
  };

  const handleWeightSubmit = () => {
    const w = parseFloat(weight);
    if (isNaN(w) || w < 20 || w > 300) return;
    if (gymPlusMemberId) {
      weightLogMut.mutate({ weight: w });
    } else {
      setStage("checkout_ok");
      scheduleReset();
    }
  };

  const handleWeightSkip = () => setStage("checkout_ok");

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-6 select-none"
      style={{ background: "linear-gradient(135deg, #0f1b35 0%, #1a2d5a 100%)" }}
      onClick={() => stage === "input" && inputRef.current?.focus()}
    >
      {/* 시계 */}
      <div className="absolute top-6 right-8 text-white/30 text-sm font-mono">{currentTime}</div>

      {/* 로고 */}
      <div className="mb-8 text-center">
        <p style={{ fontFamily: "'Cormorant Garamond', serif", letterSpacing: "0.15em" }}
          className="text-3xl font-semibold text-white">
          ZIANTGYM<span className="text-blue-400">+</span>
        </p>
        <p className="text-blue-300 text-sm mt-1 tracking-widest font-light">12주 다이어트페이백</p>
      </div>

      {/* 전화번호 입력 */}
      {stage === "input" && (
        <div className="w-full max-w-sm space-y-4">
          <div className="bg-white/[0.06] border border-white/10 rounded-2xl p-6 space-y-4">
            <p className="text-white text-center text-base font-medium">핸드폰 번호를 입력해주세요</p>
            <input
              ref={inputRef}
              type="tel"
              inputMode="numeric"
              value={phone}
              onChange={(e) => setPhone(formatPhone(e.target.value))}
              onKeyDown={(e) => e.key === "Enter" && handleCheckIn()}
              placeholder="010-0000-0000"
              className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white text-center text-xl tracking-widest placeholder:text-white/20 outline-none focus:border-blue-400"
            />
            <button
              onClick={handleCheckIn}
              disabled={checkInMut.isPending || phone.replace(/\D/g,"").length < 9}
              className="w-full py-3.5 rounded-xl bg-blue-500 hover:bg-blue-400 disabled:opacity-40 text-white font-bold text-base transition-colors"
            >
              {checkInMut.isPending ? "확인 중..." : "체크인 / 체크아웃"}
            </button>
          </div>
          <p className="text-white/20 text-xs text-center">수업 시작·종료 모두 동일하게 체크인해 주세요</p>
        </div>
      )}

      {/* 수업 시작 */}
      {stage === "checkin" && (
        <div className="w-full max-w-sm text-center space-y-5">
          <div className="w-20 h-20 rounded-full bg-blue-500/15 border border-blue-400/40 flex items-center justify-center mx-auto text-blue-400">
            <IconRun />
          </div>
          <div>
            <p className="text-white text-2xl font-bold">{memberName}님</p>
            <p className="text-blue-300 text-base mt-1">수업 시작</p>
          </div>
          <div className="bg-white/[0.05] border border-white/10 rounded-2xl p-4">
            <p className="text-white/70 text-sm leading-relaxed">{message}</p>
            <p className="text-white/25 text-xs mt-2">{currentTime} 시작 기록됨</p>
          </div>
          <AutoCloseBar durationMs={5000} active={stage === "checkin"} color="#60a5fa" onClose={doReset} />
        </div>
      )}

      {/* 체중 입력 (수업 완료 후) */}
      {stage === "weight_input" && (
        <div className="w-full max-w-sm space-y-4 text-center">
          <div className="w-20 h-20 rounded-full bg-green-500/15 border border-green-400/40 flex items-center justify-center mx-auto text-green-400">
            <IconCheck />
          </div>
          <div>
            <p className="text-white text-2xl font-bold">{memberName}님</p>
            <p className="text-green-400 text-base mt-1">수업 완료 · {elapsed}분 참여 인정</p>
          </div>
          <div className="bg-white/[0.06] border border-white/10 rounded-2xl p-5 space-y-3">
            <p className="text-white text-sm font-medium">오늘 체중을 입력해 주세요</p>
            <div className="flex items-center gap-2">
              <input
                ref={weightRef}
                type="number"
                inputMode="decimal"
                step="0.1"
                min="20"
                max="300"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleWeightSubmit()}
                placeholder="00.0"
                className="flex-1 bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white text-center text-2xl font-bold placeholder:text-white/20 outline-none focus:border-green-400"
              />
              <span className="text-white/60 text-lg font-medium">kg</span>
            </div>
            <button
              onClick={handleWeightSubmit}
              disabled={weightLogMut.isPending || !weight || parseFloat(weight) < 20}
              className="w-full py-3 rounded-xl bg-green-500 hover:bg-green-400 disabled:opacity-40 text-white font-bold transition-colors"
            >
              {weightLogMut.isPending ? "저장 중..." : "체중 기록"}
            </button>
            <button onClick={handleWeightSkip} className="w-full py-2 text-white/30 text-sm hover:text-white/50">
              건너뛰기
            </button>
          </div>
        </div>
      )}

      {/* 수업 완료 */}
      {stage === "checkout_ok" && (
        <div className="w-full max-w-sm text-center space-y-5">
          <div className="w-20 h-20 rounded-full bg-green-500/15 border border-green-400/40 flex items-center justify-center mx-auto text-green-400">
            <IconCheck />
          </div>
          <div>
            <p className="text-white text-2xl font-bold">{memberName}님</p>
            <p className="text-green-400 text-base mt-1">수고하셨습니다</p>
          </div>
          <div className="bg-green-500/10 border border-green-400/20 rounded-2xl p-4">
            <p className="text-green-300 text-sm leading-relaxed">{message || `${elapsed}분 수업 참여 인정됩니다.`}</p>
          </div>
          <AutoCloseBar durationMs={7000} active={stage === "checkout_ok"} color="#4ade80" onClose={doReset} />
        </div>
      )}

      {/* 30분 미만 — 미인정 */}
      {stage === "checkout_fail" && (
        <div className="w-full max-w-sm text-center space-y-5">
          <div className="w-20 h-20 rounded-full bg-yellow-500/15 border border-yellow-400/40 flex items-center justify-center mx-auto text-yellow-400">
            <IconWarn />
          </div>
          <div>
            <p className="text-white text-2xl font-bold">{memberName}님</p>
            <p className="text-yellow-400 text-base mt-1">수업 미인정 · {elapsed}분</p>
          </div>
          <div className="bg-yellow-500/10 border border-yellow-400/20 rounded-2xl p-4">
            <p className="text-yellow-200/90 text-sm leading-relaxed">{message}</p>
          </div>
          <AutoCloseBar durationMs={7000} active={stage === "checkout_fail"} color="#facc15" onClose={doReset} />
        </div>
      )}

      {/* 오류 */}
      {stage === "error" && (
        <div className="w-full max-w-sm text-center space-y-5">
          <div className="w-20 h-20 rounded-full bg-red-500/15 border border-red-400/40 flex items-center justify-center mx-auto text-red-400">
            <IconError />
          </div>
          <div className="bg-red-500/10 border border-red-400/20 rounded-2xl p-4">
            <p className="text-red-300 text-sm leading-relaxed">{message}</p>
          </div>
          <AutoCloseBar durationMs={7000} active={stage === "error"} color="#f87171" onClose={doReset} />
        </div>
      )}
    </div>
  );
}
