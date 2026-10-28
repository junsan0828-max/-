import { useState, useEffect, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc";

type ConsultType = "new" | "renew" | "pt";
type Stage = "type_select" | "input" | "success" | "not_found" | "error";

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

function AutoCloseBar({ durationMs, active, onClose }: { durationMs: number; active: boolean; onClose: () => void }) {
  const { remaining, progress } = useCountdown(durationMs, active, onClose);
  const secs = Math.ceil(remaining / 1000);
  return (
    <div className="space-y-2 w-full">
      <div className="h-0.5 w-full bg-white/10 rounded-full overflow-hidden">
        <div className="h-full rounded-full bg-[#60A5FA] transition-none" style={{ width: `${(1 - progress) * 100}%` }} />
      </div>
      <p className="text-white/30 text-xs text-center">{secs}초 후 자동으로 닫힙니다</p>
    </div>
  );
}

const TYPE_CONFIG: Record<ConsultType, { label: string; desc: string; color: string; icon: React.ReactNode }> = {
  new: {
    label: "신규 상담",
    desc: "처음 방문하신 분",
    color: "#60A5FA",
    icon: (
      <svg viewBox="0 0 32 32" fill="none" className="w-8 h-8" stroke="currentColor" strokeWidth={1.5}>
        <circle cx="16" cy="10" r="5" />
        <path strokeLinecap="round" d="M6 28c0-5.523 4.477-10 10-10s10 4.477 10 10" />
        <path strokeLinecap="round" d="M23 3v6M20 6h6" strokeWidth={2} />
      </svg>
    ),
  },
  renew: {
    label: "재등록 상담",
    desc: "기존 회원 재등록",
    color: "#34D399",
    icon: (
      <svg viewBox="0 0 32 32" fill="none" className="w-8 h-8" stroke="currentColor" strokeWidth={1.5}>
        <circle cx="16" cy="10" r="5" />
        <path strokeLinecap="round" d="M6 28c0-5.523 4.477-10 10-10s10 4.477 10 10" />
        <path strokeLinecap="round" d="M22 21l2 2 4-4" strokeWidth={2} />
      </svg>
    ),
  },
  pt: {
    label: "PT 상담",
    desc: "퍼스널 트레이닝 문의",
    color: "#F472B6",
    icon: (
      <svg viewBox="0 0 32 32" fill="none" className="w-8 h-8" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16h4M24 16h4M8 16h16M8 12v8M24 12v8M12 9v5M20 9v5M12 18v5M20 18v5" />
      </svg>
    ),
  },
};

const PURPOSE_OPTIONS: Record<ConsultType, string[]> = {
  new: ["체중 감량", "근력 향상", "체형 교정", "건강 관리", "재활/통증"],
  renew: ["헬스 재등록", "PT 재등록", "헬스 + PT"],
  pt: ["체중 감량", "근력 향상", "체형 교정", "재활/통증", "777 맞춤 PT"],
};

export default function ConsultKiosk() {
  const [stage, setStage] = useState<Stage>("type_select");
  const [consultType, setConsultType] = useState<ConsultType>("new");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [purpose, setPurpose] = useState("");
  const [memberName, setMemberName] = useState("");

  const phoneRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  const submitMut = trpc.kiosk.submitConsult.useMutation({
    onSuccess: (data) => {
      if (data.memberName) setMemberName(data.memberName);
      setStage("success");
    },
    onError: (err) => {
      if (err.data?.code === "NOT_FOUND") setStage("not_found");
      else setStage("error");
    },
  });

  const doReset = useCallback(() => {
    setStage("type_select");
    setName("");
    setPhone("");
    setPurpose("");
    setMemberName("");
  }, []);

  useEffect(() => {
    if (stage === "input") {
      setTimeout(() => {
        if (consultType === "renew") phoneRef.current?.focus();
        else nameRef.current?.focus();
      }, 100);
    }
  }, [stage, consultType]);

  const handlePhoneKey = (key: string) => {
    if (key === "←") setPhone((p) => p.slice(0, -1));
    else if (key === "지우기") setPhone("");
    else if (phone.length < 11) setPhone((p) => p + key);
  };

  const handleSubmit = () => {
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 9) return;
    submitMut.mutate({ consultType, name: name || undefined, phone: digits, purpose: purpose || undefined });
  };

  const cfg = TYPE_CONFIG[consultType];

  return (
    <div
      className="min-h-screen bg-[#060D18] text-white flex flex-col items-center justify-center px-6 py-10 select-none"
      onClick={() => stage === "type_select" && undefined}
    >
      {/* 헤더 */}
      <div className="mb-10 text-center">
        <p className="text-[10px] tracking-[0.4em] text-white/20 uppercase mb-2">ZIANTGYM</p>
        <p className="text-white/60 text-sm font-medium">상담 접수</p>
      </div>

      {/* ── 유형 선택 ── */}
      {stage === "type_select" && (
        <div className="w-full max-w-sm space-y-3">
          <h2 className="text-xl font-bold text-white text-center mb-8">어떤 상담을 원하시나요?</h2>
          {(["new", "renew", "pt"] as ConsultType[]).map((t) => {
            const c = TYPE_CONFIG[t];
            return (
              <button
                key={t}
                onClick={() => { setConsultType(t); setStage("input"); }}
                className="w-full flex items-center gap-5 p-5 rounded-2xl border border-white/10 bg-white/[0.04] active:bg-white/10 transition-colors text-left"
                style={{ "--tw-ring-color": c.color } as React.CSSProperties}
              >
                <div className="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${c.color}18`, color: c.color }}>
                  {c.icon}
                </div>
                <div>
                  <p className="text-white font-bold text-lg">{c.label}</p>
                  <p className="text-white/40 text-sm mt-0.5">{c.desc}</p>
                </div>
                <svg viewBox="0 0 24 24" fill="none" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-white/20 ml-auto flex-shrink-0">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                </svg>
              </button>
            );
          })}
        </div>
      )}

      {/* ── 정보 입력 ── */}
      {stage === "input" && (
        <div className="w-full max-w-sm">
          <button onClick={doReset} className="flex items-center gap-1 text-white/30 text-sm mb-8 hover:text-white/60 transition-colors">
            <svg viewBox="0 0 24 24" fill="none" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
            </svg>
            돌아가기
          </button>

          {/* 선택 유형 표시 */}
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${cfg.color}18`, color: cfg.color }}>
              {cfg.icon}
            </div>
            <div>
              <p className="text-white font-bold">{cfg.label}</p>
              <p className="text-white/40 text-xs">{cfg.desc}</p>
            </div>
          </div>

          {/* 이름 (재등록 제외) */}
          {consultType !== "renew" && (
            <div className="mb-5">
              <label className="text-white/40 text-xs tracking-widest uppercase mb-2 block">이름</label>
              <input
                ref={nameRef}
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="성함을 입력해 주세요"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-white text-base placeholder-white/20 focus:outline-none focus:border-white/30"
              />
            </div>
          )}

          {/* 목적 선택 */}
          <div className="mb-5">
            <label className="text-white/40 text-xs tracking-widest uppercase mb-2 block">목적 (선택)</label>
            <div className="flex flex-wrap gap-2">
              {PURPOSE_OPTIONS[consultType].map((opt) => (
                <button
                  key={opt}
                  onClick={() => setPurpose(purpose === opt ? "" : opt)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border ${
                    purpose === opt
                      ? "text-white border-transparent"
                      : "text-white/40 border-white/10 bg-transparent hover:bg-white/5"
                  }`}
                  style={purpose === opt ? { background: cfg.color, borderColor: cfg.color } : {}}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          {/* 전화번호 */}
          <div className="mb-6">
            <label className="text-white/40 text-xs tracking-widest uppercase mb-2 block">전화번호</label>
            <div
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-white text-xl font-mono tracking-widest cursor-pointer"
              onClick={() => phoneRef.current?.focus()}
            >
              {phone || <span className="text-white/20 text-base font-normal">숫자를 입력해 주세요</span>}
            </div>
            <input ref={phoneRef} type="tel" className="sr-only" readOnly value={phone} />
          </div>

          {/* 숫자 키패드 */}
          <div className="grid grid-cols-3 gap-2 mb-6">
            {["1","2","3","4","5","6","7","8","9","←","0","지우기"].map((key) => (
              <button
                key={key}
                onClick={() => handlePhoneKey(key)}
                className={`py-4 rounded-xl text-lg font-bold transition-colors ${
                  key === "지우기"
                    ? "text-red-400/70 bg-red-400/5 border border-red-400/10 text-sm"
                    : key === "←"
                    ? "text-white/60 bg-white/5 border border-white/10"
                    : "text-white bg-white/5 border border-white/10 active:bg-white/15"
                }`}
              >
                {key}
              </button>
            ))}
          </div>

          <button
            onClick={handleSubmit}
            disabled={phone.replace(/\D/g, "").length < 9 || submitMut.isPending}
            className="w-full py-4 rounded-xl font-bold text-white text-base transition-all disabled:opacity-30"
            style={{ background: cfg.color }}
          >
            {submitMut.isPending ? "접수 중..." : "상담 접수하기"}
          </button>
        </div>
      )}

      {/* ── 접수 완료 ── */}
      {stage === "success" && (
        <div className="w-full max-w-sm text-center space-y-6">
          <div className="w-16 h-16 rounded-full bg-[#60A5FA]/15 flex items-center justify-center mx-auto">
            <svg viewBox="0 0 40 40" fill="none" className="w-10 h-10 text-[#60A5FA]" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 20 L17 27 L30 13" />
            </svg>
          </div>
          <div>
            <p className="text-white font-bold text-2xl mb-2">
              {memberName ? `${memberName}님,` : ""} 접수 완료!
            </p>
            <p className="text-white/50 text-sm leading-relaxed">
              잠시만 기다려 주시면<br />직원이 안내해 드립니다.
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4">
            <p className="text-white/40 text-xs mb-1">{TYPE_CONFIG[consultType].label}</p>
            {purpose && <p className="text-[#60A5FA] font-semibold text-sm">{purpose}</p>}
          </div>
          <AutoCloseBar durationMs={8000} active={stage === "success"} onClose={doReset} />
        </div>
      )}

      {/* ── 회원 없음 ── */}
      {stage === "not_found" && (
        <div className="w-full max-w-sm text-center space-y-6">
          <div className="w-16 h-16 rounded-full bg-yellow-400/10 flex items-center justify-center mx-auto">
            <svg viewBox="0 0 40 40" fill="none" className="w-10 h-10 text-yellow-400" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M20 12v10M20 27v2" />
              <path strokeLinecap="round" d="M5 34 L20 8 L35 34 Z" />
            </svg>
          </div>
          <div>
            <p className="text-white font-bold text-xl mb-2">회원 정보를 찾을 수 없어요</p>
            <p className="text-white/50 text-sm">입력하신 번호로 등록된 회원이 없습니다.<br />직원에게 직접 문의해 주세요.</p>
          </div>
          <button onClick={doReset} className="w-full py-4 rounded-xl border border-white/20 text-white/60 font-bold">
            다시 시도
          </button>
          <AutoCloseBar durationMs={7000} active={stage === "not_found"} onClose={doReset} />
        </div>
      )}

      {/* ── 오류 ── */}
      {stage === "error" && (
        <div className="w-full max-w-sm text-center space-y-6">
          <div className="w-16 h-16 rounded-full bg-red-400/10 flex items-center justify-center mx-auto">
            <svg viewBox="0 0 40 40" fill="none" className="w-10 h-10 text-red-400" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" d="M13 13 L27 27 M27 13 L13 27" />
            </svg>
          </div>
          <div>
            <p className="text-white font-bold text-xl mb-2">오류가 발생했어요</p>
            <p className="text-white/50 text-sm">직원에게 문의해 주세요.</p>
          </div>
          <button onClick={doReset} className="w-full py-4 rounded-xl border border-white/20 text-white/60 font-bold">
            처음으로
          </button>
          <AutoCloseBar durationMs={7000} active={stage === "error"} onClose={doReset} />
        </div>
      )}
    </div>
  );
}
