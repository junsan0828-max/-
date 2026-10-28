import { useState, useEffect, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc";

type MainType = "consult" | "payment" | "info";
type ConsultType = "new" | "renew" | "pt";
type Stage =
  | "main_select"
  | "consult_type"
  | "consult_input"
  | "consult_done"
  | "payment_wait"
  | "info_display"
  | "not_found"
  | "error";

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

const CONSULT_TYPES: { key: ConsultType; label: string; desc: string }[] = [
  { key: "new", label: "신규 상담", desc: "처음 방문하신 분" },
  { key: "renew", label: "재등록 상담", desc: "기존 회원 재등록" },
  { key: "pt", label: "PT 상담", desc: "퍼스널 트레이닝 문의" },
];

const PURPOSE_OPTIONS: Record<ConsultType, string[]> = {
  new: ["체중 감량", "근력 향상", "체형 교정", "건강 관리", "재활/통증"],
  renew: ["헬스 재등록", "PT 재등록", "헬스 + PT"],
  pt: ["체중 감량", "근력 향상", "체형 교정", "재활/통증", "777 맞춤 PT"],
};

const INFO_ITEMS = [
  { title: "헬스 이용권", rows: ["1개월 80,000원", "3개월 159,000원", "6개월 226,000원", "12개월 322,000원"] },
  { title: "연말 이벤트", rows: ["6개월 등록 → 1개월 추가", "12개월 등록 → 운동복 증정", "12월 31일까지"] },
  { title: "777 맞춤 PT", rows: ["17회 맞춤 지도", "헬스 이용권 2개월 포함", "락커 서비스 포함", "777,000원"] },
  { title: "운영 시간", rows: ["평일 06:00 – 23:00", "주말 08:00 – 20:00", "공휴일 08:00 – 20:00"] },
];

export default function ConsultKiosk() {
  const [stage, setStage] = useState<Stage>("main_select");
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
      setStage("consult_done");
    },
    onError: (err) => {
      if (err.data?.code === "NOT_FOUND") setStage("not_found");
      else setStage("error");
    },
  });

  const doReset = useCallback(() => {
    setStage("main_select");
    setName(""); setPhone(""); setPurpose(""); setMemberName("");
  }, []);

  useEffect(() => {
    if (stage === "consult_input") {
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

  return (
    <div className="min-h-screen bg-[#060D18] text-white flex flex-col items-center justify-center px-6 py-10 select-none">
      {/* 헤더 */}
      <div className="mb-10 text-center">
        <p className="text-[11px] tracking-[0.5em] text-white/25 uppercase mb-1">ZIANTGYM</p>
        <p className="text-white/40 text-sm">무엇을 도와드릴까요?</p>
      </div>

      {/* ── 메인 선택 ── */}
      {stage === "main_select" && (
        <div className="w-full max-w-sm space-y-3">
          {/* 상담 신청 */}
          <button
            onClick={() => setStage("consult_type")}
            className="w-full flex items-center gap-5 p-6 rounded-2xl border border-[#1D4ED8]/40 bg-[#1D4ED8]/10 active:bg-[#1D4ED8]/20 transition-colors text-left"
          >
            <div className="w-12 h-12 rounded-xl bg-[#1D4ED8]/20 flex items-center justify-center flex-shrink-0">
              <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6 text-[#60A5FA]" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 0 1-.825-.242m9.345-8.334a2.126 2.126 0 0 0-.476-.095 48.64 48.64 0 0 0-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0 0 11.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-white font-bold text-lg">상담 신청</p>
              <p className="text-white/40 text-sm mt-0.5">신규 · 재등록 · PT 상담</p>
            </div>
            <svg viewBox="0 0 24 24" fill="none" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-white/20 flex-shrink-0">
              <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
            </svg>
          </button>

          {/* 등록 결제 */}
          <button
            onClick={() => setStage("payment_wait")}
            className="w-full flex items-center gap-5 p-6 rounded-2xl border border-[#059669]/40 bg-[#059669]/10 active:bg-[#059669]/20 transition-colors text-left"
          >
            <div className="w-12 h-12 rounded-xl bg-[#059669]/20 flex items-center justify-center flex-shrink-0">
              <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6 text-[#34D399]" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Z" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-white font-bold text-lg">등록 결제</p>
              <p className="text-white/40 text-sm mt-0.5">회원권 등록 및 결제</p>
            </div>
            <svg viewBox="0 0 24 24" fill="none" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-white/20 flex-shrink-0">
              <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
            </svg>
          </button>

          {/* 안내 설명 */}
          <button
            onClick={() => setStage("info_display")}
            className="w-full flex items-center gap-5 p-6 rounded-2xl border border-white/10 bg-white/[0.04] active:bg-white/10 transition-colors text-left"
          >
            <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center flex-shrink-0">
              <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6 text-white/50" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-white font-bold text-lg">안내 설명</p>
              <p className="text-white/40 text-sm mt-0.5">이용권 가격 · 이벤트 · 운영시간</p>
            </div>
            <svg viewBox="0 0 24 24" fill="none" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-white/20 flex-shrink-0">
              <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
            </svg>
          </button>
        </div>
      )}

      {/* ── 상담 유형 선택 ── */}
      {stage === "consult_type" && (
        <div className="w-full max-w-sm">
          <button onClick={doReset} className="flex items-center gap-1 text-white/30 text-sm mb-8 hover:text-white/60 transition-colors">
            <svg viewBox="0 0 24 24" fill="none" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
            </svg>
            돌아가기
          </button>
          <h2 className="text-xl font-bold text-white mb-8">어떤 상담을 원하시나요?</h2>
          <div className="space-y-3">
            {CONSULT_TYPES.map((t) => (
              <button
                key={t.key}
                onClick={() => { setConsultType(t.key); setStage("consult_input"); }}
                className="w-full flex items-center justify-between p-5 rounded-2xl border border-[#1D4ED8]/30 bg-[#1D4ED8]/8 active:bg-[#1D4ED8]/20 transition-colors"
              >
                <div className="text-left">
                  <p className="text-white font-bold">{t.label}</p>
                  <p className="text-white/40 text-sm mt-0.5">{t.desc}</p>
                </div>
                <svg viewBox="0 0 24 24" fill="none" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-white/20">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                </svg>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── 상담 정보 입력 ── */}
      {stage === "consult_input" && (
        <div className="w-full max-w-sm">
          <button onClick={() => setStage("consult_type")} className="flex items-center gap-1 text-white/30 text-sm mb-8 hover:text-white/60 transition-colors">
            <svg viewBox="0 0 24 24" fill="none" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
            </svg>
            돌아가기
          </button>

          <p className="text-[#60A5FA] text-xs font-bold tracking-widest uppercase mb-6">
            {CONSULT_TYPES.find(t => t.key === consultType)?.label}
          </p>

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

          <div className="mb-5">
            <label className="text-white/40 text-xs tracking-widest uppercase mb-2 block">목적 (선택)</label>
            <div className="flex flex-wrap gap-2">
              {PURPOSE_OPTIONS[consultType].map((opt) => (
                <button
                  key={opt}
                  onClick={() => setPurpose(purpose === opt ? "" : opt)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border ${
                    purpose === opt
                      ? "bg-[#1D4ED8] border-[#1D4ED8] text-white"
                      : "text-white/40 border-white/10 hover:bg-white/5"
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          <div className="mb-5">
            <label className="text-white/40 text-xs tracking-widest uppercase mb-2 block">전화번호</label>
            <div className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-white text-xl font-mono tracking-widest min-h-[56px]">
              {phone || <span className="text-white/20 text-base font-normal">숫자를 입력해 주세요</span>}
            </div>
            <input ref={phoneRef} type="tel" className="sr-only" readOnly value={phone} />
          </div>

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
            className="w-full py-4 rounded-xl font-bold text-white bg-[#1D4ED8] hover:bg-[#1a44c2] disabled:opacity-30 transition-colors"
          >
            {submitMut.isPending ? "접수 중..." : "상담 접수하기"}
          </button>
        </div>
      )}

      {/* ── 상담 완료 ── */}
      {stage === "consult_done" && (
        <div className="w-full max-w-sm text-center space-y-6">
          <div className="w-16 h-16 rounded-full bg-[#60A5FA]/15 flex items-center justify-center mx-auto">
            <svg viewBox="0 0 40 40" fill="none" className="w-10 h-10 text-[#60A5FA]" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 20 L17 27 L30 13" />
            </svg>
          </div>
          <div>
            <p className="text-white font-bold text-2xl mb-2">
              {memberName ? `${memberName}님, ` : ""}접수 완료!
            </p>
            <p className="text-white/50 text-sm leading-relaxed">
              잠시만 기다려 주시면<br />직원이 안내해 드립니다.
            </p>
          </div>
          <AutoCloseBar durationMs={8000} active={stage === "consult_done"} onClose={doReset} />
        </div>
      )}

      {/* ── 등록 결제 대기 ── */}
      {stage === "payment_wait" && (
        <div className="w-full max-w-sm text-center space-y-6">
          <div className="w-16 h-16 rounded-full bg-[#059669]/15 flex items-center justify-center mx-auto">
            <svg viewBox="0 0 40 40" fill="none" className="w-10 h-10 text-[#34D399]" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 20h30M5 13h30M10 27h5M18 27h5M26 27h5" />
              <rect x="3" y="9" width="34" height="22" rx="3" strokeWidth={1.5} />
            </svg>
          </div>
          <div>
            <p className="text-white font-bold text-2xl mb-3">등록 결제</p>
            <p className="text-white/50 text-sm leading-relaxed">
              직원이 곧 안내해 드립니다.<br />잠시만 기다려 주세요.
            </p>
          </div>
          <div className="rounded-2xl border border-[#059669]/20 bg-[#059669]/8 px-5 py-4 text-left space-y-2">
            <p className="text-white/40 text-xs tracking-widest uppercase mb-3">이용권 안내</p>
            {["1개월 80,000원", "3개월 159,000원", "6개월 226,000원", "12개월 322,000원"].map((item) => (
              <div key={item} className="flex justify-between">
                <span className="text-white/60 text-sm">{item.split(" ")[0]}</span>
                <span className="text-white font-semibold text-sm">{item.split(" ")[1]}</span>
              </div>
            ))}
          </div>
          <button onClick={doReset} className="w-full py-3.5 rounded-xl border border-white/10 text-white/40 text-sm">
            처음으로 →
          </button>
          <AutoCloseBar durationMs={30000} active={stage === "payment_wait"} onClose={doReset} />
        </div>
      )}

      {/* ── 안내 설명 ── */}
      {stage === "info_display" && (
        <div className="w-full max-w-sm space-y-4">
          {INFO_ITEMS.map((item) => (
            <div key={item.title} className="rounded-2xl border border-white/8 bg-white/[0.03] px-5 py-4">
              <p className="text-white/40 text-[10px] tracking-widest uppercase mb-3">{item.title}</p>
              <div className="space-y-1.5">
                {item.rows.map((row) => (
                  <p key={row} className="text-white/80 text-sm">{row}</p>
                ))}
              </div>
            </div>
          ))}
          <button onClick={doReset} className="w-full py-4 rounded-xl bg-white/5 border border-white/10 text-white/60 font-bold mt-2">
            처음으로 →
          </button>
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
            <p className="text-white/50 text-sm">직원에게 직접 문의해 주세요.</p>
          </div>
          <button onClick={doReset} className="w-full py-4 rounded-xl border border-white/20 text-white/60 font-bold">다시 시도</button>
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
          <button onClick={doReset} className="w-full py-4 rounded-xl border border-white/20 text-white/60 font-bold">처음으로</button>
          <AutoCloseBar durationMs={7000} active={stage === "error"} onClose={doReset} />
        </div>
      )}
    </div>
  );
}
