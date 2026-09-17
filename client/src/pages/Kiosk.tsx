import { useState, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";

type Stage =
  | "input" | "success" | "already" | "error" | "expired"
  | "pt_input" | "pt_balance" | "pt_low" | "pt_success" | "pt_error";

function nowTimeStr() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function NoticeCarousel({ notices }: { notices: string[] }) {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    setIdx(i => (notices.length > 0 ? Math.min(i, notices.length - 1) : 0));
  }, [notices.length]);

  useEffect(() => {
    if (notices.length <= 1) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % notices.length), 4000);
    return () => clearInterval(t);
  }, [notices.length]);

  if (!notices.length) return null;

  return (
    <div className="bg-white/[0.04] border border-white/[0.06] rounded-2xl px-4 py-3.5 flex items-center gap-3">
      <div className="w-8 h-8 rounded-lg bg-[#4f6ef7]/20 flex items-center justify-center shrink-0">
        <svg className="w-4 h-4 text-[#7b9bff]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 1 1 0-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.253.962.584 1.892.985 2.783.247.55.06 1.21-.463 1.511l-.657.38c-.551.318-1.26.117-1.527-.461a20.845 20.845 0 0 1-1.44-4.282m3.102.069a18.03 18.03 0 0 1-.59-4.59c0-1.586.205-3.124.59-4.59m0 9.18a23.848 23.848 0 0 1 8.835 2.535M10.34 6.66a23.847 23.847 0 0 0 8.835-2.535m0 0A23.74 23.74 0 0 0 18.795 3m.38 1.125a23.91 23.91 0 0 1 1.014 5.395m-1.014 8.855c-.118.38-.245.754-.38 1.125m.38-1.125a23.91 23.91 0 0 0 1.014-5.395m0-3.46c.495.413.811 1.035.811 1.73 0 .695-.316 1.317-.811 1.73m0-3.46a24.347 24.347 0 0 1 0 3.46" />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-white/80 text-sm font-medium truncate">{notices[idx]}</p>
      </div>
      {notices.length > 1 && (
        <span className="text-[10px] text-white/20 shrink-0">{idx + 1}/{notices.length}</span>
      )}
    </div>
  );
}

export default function KioskPage() {
  const [phone, setPhone] = useState("");
  const [stage, setStage] = useState<Stage>("input");
  const [memberName, setMemberName] = useState("");
  const [pointsEarned, setPointsEarned] = useState(0);
  const [totalPoints, setTotalPoints] = useState(0);
  const [showPoints, setShowPoints] = useState(true);
  const [uniformEnd, setUniformEnd] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(nowTimeStr());

  // Point usage state
  const [ptMemberName, setPtMemberName] = useState("");
  const [ptBalance, setPtBalance] = useState(0);
  const [ptAmount, setPtAmount] = useState(3000);
  const [ptBalanceAfter, setPtBalanceAfter] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: notices } = trpc.kiosk.getNotices.useQuery(undefined, {
    refetchInterval: 60000,
  });

  useEffect(() => {
    const t = setInterval(() => setCurrentTime(nowTimeStr()), 10000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (stage === "input" || stage === "pt_input") {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [stage]);

  const checkInMutation = trpc.kiosk.checkIn.useMutation({
    onSuccess: (data) => {
      setMemberName(data.name);
      setPointsEarned(data.pointsEarned);
      setTotalPoints(data.totalPoints);
      setShowPoints(data.showPoints);
      setUniformEnd(data.uniformEnd ?? null);
      setStage(data.alreadyCheckedIn ? "already" : "success");
      scheduleReset();
    },
    onError: (e) => {
      if (e.data?.code === "FORBIDDEN") {
        setStage("expired");
      } else {
        setStage("error");
      }
      scheduleReset(5000);
    },
  });

  const checkBalanceMut = trpc.kiosk.checkPointBalance.useMutation({
    onSuccess: (data) => {
      setPtMemberName(data.name);
      setPtBalance(data.points);
      if (data.points < 3000) {
        setStage("pt_low");
        scheduleReset(8000);
      } else {
        setPtAmount(3000);
        setStage("pt_balance");
      }
    },
    onError: () => {
      setStage("pt_error");
      scheduleReset(5000);
    },
  });

  const usePointsMut = trpc.kiosk.usePoints.useMutation({
    onSuccess: (data) => {
      setPtMemberName(data.name);
      setPtBalanceAfter(data.balanceAfter);
      setStage("pt_success");
      scheduleReset(6000);
    },
    onError: () => {
      setStage("pt_error");
      scheduleReset(5000);
    },
  });

  function scheduleReset(delay = 4000) {
    if (resetTimer.current) clearTimeout(resetTimer.current);
    resetTimer.current = setTimeout(() => {
      setPhone("");
      setStage("input");
    }, delay);
  }

  function handleInput(digit: string) {
    if (phone.length < 11) setPhone((p) => p + digit);
  }

  function handleDelete() {
    setPhone((p) => p.slice(0, -1));
  }

  function handleCheckInSubmit() {
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 9) return;
    checkInMutation.mutate({ phone: digits });
  }

  function handlePointPhoneSubmit() {
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 9) return;
    checkBalanceMut.mutate({ phone: digits });
  }

  function handleUsePoints() {
    const digits = phone.replace(/\D/g, "");
    if (ptAmount < 3000 || ptAmount > ptBalance) return;
    usePointsMut.mutate({ phone: digits, amount: ptAmount });
  }

  function goToPointInput() {
    setPhone("");
    setStage("pt_input");
  }

  function formatPhone(raw: string) {
    const d = raw.replace(/\D/g, "");
    if (d.length <= 3) return d;
    if (d.length <= 7) return `${d.slice(0, 3)}-${d.slice(3)}`;
    return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
  }

  const today = new Date().toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "short" });

  const PRESET_AMOUNTS = [3000, 5000, 10000, 20000, 50000].filter(a => a <= ptBalance);

  return (
    <div
      className="min-h-screen bg-[#060a14] flex flex-col select-none"
      style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {/* 헤더 */}
      <div className="px-6 pt-6 pb-4 flex items-center justify-between">
        <div>
          <p
            style={{ fontFamily: "'Cormorant Garamond', serif", letterSpacing: "0.15em" }}
            className="text-2xl font-semibold text-white"
          >
            ZIANTGYM<span className="text-[#4f6ef7]">+</span>
          </p>
          <p className="text-white/25 text-[11px] mt-0.5 tracking-wide">맞춤운동센터 자이언트짐</p>
        </div>
        <div className="text-right">
          <p className="text-white/20 text-[11px]">{today}</p>
          <p className="text-white/30 text-lg font-mono font-medium">{currentTime}</p>
        </div>
      </div>

      {/* 공지사항 */}
      {(notices?.length ?? 0) > 0 && (
        <div className="px-6 pb-3">
          <NoticeCarousel notices={notices!} />
        </div>
      )}

      {/* 메인 */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 pb-6">
        <div className="w-full max-w-md">

          {/* ── 출입 체크인 입력 ── */}
          {stage === "input" && (
            <div className="space-y-4">
              <div className="text-center mb-2">
                <p className="text-white font-bold text-xl">출입 체크인</p>
                <p className="text-white/30 text-sm mt-1">핸드폰 번호를 입력해주세요</p>
              </div>

              <div className="bg-[#0e1424] border border-white/[0.06] rounded-2xl px-5 py-5 text-center">
                <span className="text-3xl font-mono font-bold text-white tracking-[0.12em]">
                  {phone ? formatPhone(phone) : <span className="text-white/15">010-0000-0000</span>}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                {["1","2","3","4","5","6","7","8","9","","0","⌫"].map((k, i) => (
                  <button
                    key={i}
                    onClick={() => k === "⌫" ? handleDelete() : k !== "" ? handleInput(k) : undefined}
                    className={`rounded-2xl text-2xl font-semibold transition-all active:scale-[0.96] ${
                      k === "" ? "invisible" :
                      k === "⌫" ? "bg-white/[0.04] text-white/40 hover:bg-white/[0.08] py-[18px]" :
                      "bg-white/[0.06] text-white hover:bg-white/[0.1] py-[18px]"
                    }`}
                  >
                    {k}
                  </button>
                ))}
              </div>

              <button
                onClick={handleCheckInSubmit}
                disabled={phone.replace(/\D/g, "").length < 9 || checkInMutation.isPending}
                className="w-full bg-[#4f6ef7] hover:bg-[#3d5ce5] disabled:opacity-20 disabled:cursor-not-allowed text-white font-bold py-5 rounded-2xl text-xl transition-all active:scale-[0.98]"
              >
                {checkInMutation.isPending ? "확인 중..." : "입장 확인"}
              </button>

              <button
                onClick={goToPointInput}
                className="w-full bg-white/[0.05] hover:bg-white/[0.09] border border-white/[0.08] text-white/60 font-semibold py-4 rounded-2xl text-base transition-all active:scale-[0.98] flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <circle cx="12" cy="12" r="10" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2" />
                </svg>
                포인트 사용
              </button>

              <input
                ref={inputRef}
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 11))}
                onKeyDown={(e) => e.key === "Enter" && handleCheckInSubmit()}
                className="opacity-0 absolute w-0 h-0"
                tabIndex={-1}
              />
            </div>
          )}

          {/* ── 포인트 사용 - 전화번호 입력 ── */}
          {stage === "pt_input" && (
            <div className="space-y-4">
              <div className="text-center mb-2">
                <div className="w-12 h-12 rounded-full bg-amber-500/15 flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <circle cx="12" cy="12" r="10" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2" />
                  </svg>
                </div>
                <p className="text-white font-bold text-xl">포인트 사용</p>
                <p className="text-white/30 text-sm mt-1">핸드폰 번호를 입력해주세요</p>
              </div>

              <div className="bg-[#0e1424] border border-amber-500/20 rounded-2xl px-5 py-5 text-center">
                <span className="text-3xl font-mono font-bold text-white tracking-[0.12em]">
                  {phone ? formatPhone(phone) : <span className="text-white/15">010-0000-0000</span>}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                {["1","2","3","4","5","6","7","8","9","","0","⌫"].map((k, i) => (
                  <button
                    key={i}
                    onClick={() => k === "⌫" ? handleDelete() : k !== "" ? handleInput(k) : undefined}
                    className={`rounded-2xl text-2xl font-semibold transition-all active:scale-[0.96] ${
                      k === "" ? "invisible" :
                      k === "⌫" ? "bg-white/[0.04] text-white/40 hover:bg-white/[0.08] py-[18px]" :
                      "bg-white/[0.06] text-white hover:bg-white/[0.1] py-[18px]"
                    }`}
                  >
                    {k}
                  </button>
                ))}
              </div>

              <button
                onClick={handlePointPhoneSubmit}
                disabled={phone.replace(/\D/g, "").length < 9 || checkBalanceMut.isPending}
                className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-20 disabled:cursor-not-allowed text-white font-bold py-5 rounded-2xl text-xl transition-all active:scale-[0.98]"
              >
                {checkBalanceMut.isPending ? "조회 중..." : "포인트 조회"}
              </button>

              <button
                onClick={() => { setPhone(""); setStage("input"); }}
                className="w-full bg-white/[0.04] text-white/40 font-semibold py-3.5 rounded-2xl text-base transition-all active:scale-[0.98]"
              >
                취소
              </button>

              <input
                ref={inputRef}
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 11))}
                onKeyDown={(e) => e.key === "Enter" && handlePointPhoneSubmit()}
                className="opacity-0 absolute w-0 h-0"
                tabIndex={-1}
              />
            </div>
          )}

          {/* ── 포인트 사용 - 금액 선택 ── */}
          {stage === "pt_balance" && (
            <div className="space-y-4">
              <div className="bg-[#0e1424] border border-amber-500/20 rounded-3xl p-6 text-center space-y-1">
                <p className="text-white/40 text-sm">보유 포인트</p>
                <p className="text-3xl font-black text-amber-400">{ptBalance.toLocaleString()}P</p>
                <p className="text-white/30 text-xs">{ptMemberName}님 · 1P = 1원</p>
              </div>

              <div>
                <p className="text-white/40 text-xs mb-2 px-1">사용할 금액 선택</p>
                <div className="grid grid-cols-3 gap-2">
                  {PRESET_AMOUNTS.map((a) => (
                    <button
                      key={a}
                      onClick={() => setPtAmount(a)}
                      className={`rounded-2xl py-3.5 text-sm font-bold transition-all active:scale-[0.96] ${
                        ptAmount === a
                          ? "bg-amber-500 text-white"
                          : "bg-white/[0.06] text-white/60 hover:bg-white/[0.1]"
                      }`}
                    >
                      {(a / 1000).toLocaleString()}천원
                    </button>
                  ))}
                  <button
                    onClick={() => setPtAmount(ptBalance)}
                    className={`rounded-2xl py-3.5 text-sm font-bold transition-all active:scale-[0.96] ${
                      ptAmount === ptBalance
                        ? "bg-amber-500 text-white"
                        : "bg-white/[0.06] text-white/60 hover:bg-white/[0.1]"
                    }`}
                  >
                    전액
                  </button>
                </div>
              </div>

              <div className="bg-[#0e1424] border border-white/[0.06] rounded-2xl px-5 py-4 flex items-center justify-between">
                <span className="text-white/40 text-sm">차감 금액</span>
                <span className="text-white font-bold text-xl">{ptAmount.toLocaleString()}원</span>
              </div>

              <button
                onClick={handleUsePoints}
                disabled={usePointsMut.isPending || ptAmount < 3000 || ptAmount > ptBalance}
                className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-20 disabled:cursor-not-allowed text-white font-bold py-5 rounded-2xl text-xl transition-all active:scale-[0.98]"
              >
                {usePointsMut.isPending ? "처리 중..." : `${ptAmount.toLocaleString()}원 사용하기`}
              </button>

              <button
                onClick={() => { setPhone(""); setStage("input"); }}
                className="w-full bg-white/[0.04] text-white/40 font-semibold py-3.5 rounded-2xl text-base transition-all active:scale-[0.98]"
              >
                취소
              </button>
            </div>
          )}

          {/* ── 포인트 부족 ── */}
          {stage === "pt_low" && (
            <div className="bg-[#0e1424] border border-white/[0.08] rounded-3xl p-8 text-center space-y-5">
              <div className="w-20 h-20 rounded-full bg-white/[0.05] flex items-center justify-center mx-auto">
                <svg className="w-10 h-10 text-white/30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <circle cx="12" cy="12" r="10" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2" />
                </svg>
              </div>
              <div>
                <p className="text-2xl font-black text-white">{ptMemberName}님</p>
                <p className="text-amber-400 font-bold text-lg mt-2">포인트가 부족합니다</p>
                <p className="text-white/30 text-sm mt-1">
                  현재 <span className="text-white/60 font-semibold">{ptBalance.toLocaleString()}P</span> 보유
                </p>
                <p className="text-white/20 text-xs mt-3">3,000포인트부터 사용 가능합니다</p>
              </div>
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl px-5 py-4">
                <p className="text-white/40 text-sm font-medium">현장 결제 안내</p>
                <p className="text-white/30 text-xs mt-1 leading-relaxed">
                  카드 또는 계좌이체로<br />데스크에서 결제하실 수 있습니다
                </p>
              </div>
            </div>
          )}

          {/* ── 포인트 사용 성공 ── */}
          {stage === "pt_success" && (
            <div className="bg-[#0e1424] border border-emerald-500/20 rounded-3xl p-8 text-center space-y-5">
              <div className="w-20 h-20 rounded-full bg-emerald-500/15 flex items-center justify-center mx-auto">
                <svg className="w-10 h-10 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                </svg>
              </div>
              <div>
                <p className="text-3xl font-black text-white">{ptMemberName}님</p>
                <p className="text-emerald-400 font-bold text-lg mt-2">포인트 사용 완료</p>
              </div>
              <div className="bg-[#4f6ef7]/10 border border-[#4f6ef7]/15 rounded-2xl px-5 py-4 space-y-1">
                <p className="text-white/30 text-xs">남은 포인트</p>
                <p className="text-[#7b9bff] text-2xl font-black">{ptBalanceAfter.toLocaleString()}P</p>
              </div>
            </div>
          )}

          {/* ── 포인트 오류 ── */}
          {stage === "pt_error" && (
            <div className="bg-[#0e1424] border border-red-500/20 rounded-3xl p-8 text-center space-y-5">
              <div className="w-20 h-20 rounded-full bg-red-500/15 flex items-center justify-center mx-auto">
                <svg className="w-10 h-10 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </div>
              <div>
                <p className="text-red-400 font-bold text-lg">처리 중 오류가 발생했습니다</p>
                <p className="text-white/30 text-sm mt-1">데스크에 문의해주세요</p>
              </div>
            </div>
          )}

          {/* ── 출입 체크인 성공 ── */}
          {stage === "success" && (
            <div className="bg-[#0e1424] border border-emerald-500/20 rounded-3xl p-8 text-center space-y-5">
              <div className="w-20 h-20 rounded-full bg-emerald-500/15 flex items-center justify-center mx-auto">
                <svg className="w-10 h-10 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                </svg>
              </div>
              <div>
                <p className="text-3xl font-black text-white">{memberName}님</p>
                <p className="text-emerald-400 font-bold text-lg mt-2">출입이 확인되었습니다</p>
                <p className="text-white/30 text-sm mt-1">환영합니다! 즐거운 운동 되세요</p>
              </div>
              {showPoints && pointsEarned > 0 && (
                <div className="bg-[#4f6ef7]/10 border border-[#4f6ef7]/15 rounded-2xl px-5 py-4">
                  <p className="text-[#7b9bff] text-lg font-bold">
                    +{pointsEarned.toLocaleString("ko-KR")}P 적립
                  </p>
                  <p className="text-white/30 text-xs mt-1">
                    누적 <span className="text-white/60 font-semibold">{totalPoints.toLocaleString("ko-KR")}P</span>
                  </p>
                </div>
              )}
              {uniformEnd && (
                <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl px-5 py-4 text-left">
                  <p className="text-white/30 text-xs mb-1">운동복 서비스</p>
                  <p className="text-white text-sm font-semibold">
                    이용 가능 · <span className="text-emerald-400">{uniformEnd.replace(/-/g, ".")} 까지</span>
                  </p>
                </div>
              )}
            </div>
          )}

          {stage === "already" && (
            <div className="bg-[#0e1424] border border-amber-500/20 rounded-3xl p-8 text-center space-y-5">
              <div className="w-20 h-20 rounded-full bg-amber-500/15 flex items-center justify-center mx-auto">
                <svg className="w-10 h-10 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                </svg>
              </div>
              <div>
                <p className="text-3xl font-black text-white">{memberName}님</p>
                <p className="text-amber-400 font-bold text-lg mt-2">오늘 이미 출입이 확인되었습니다</p>
                <p className="text-white/30 text-sm mt-1">즐거운 운동 되세요!</p>
              </div>
              {showPoints && totalPoints > 0 && (
                <div className="bg-[#4f6ef7]/10 border border-[#4f6ef7]/15 rounded-2xl px-5 py-4">
                  <p className="text-white/30 text-xs">누적 포인트</p>
                  <p className="text-[#7b9bff] text-lg font-bold mt-0.5">{totalPoints.toLocaleString("ko-KR")}P</p>
                </div>
              )}
              {uniformEnd && (
                <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl px-5 py-4 text-left">
                  <p className="text-white/30 text-xs mb-1">운동복 서비스</p>
                  <p className="text-white text-sm font-semibold">
                    이용 가능 · <span className="text-emerald-400">{uniformEnd.replace(/-/g, ".")} 까지</span>
                  </p>
                </div>
              )}
            </div>
          )}

          {stage === "expired" && (
            <div className="bg-[#0e1424] border border-orange-500/20 rounded-3xl p-8 text-center space-y-5">
              <div className="w-20 h-20 rounded-full bg-orange-500/15 flex items-center justify-center mx-auto">
                <svg className="w-10 h-10 text-orange-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                </svg>
              </div>
              <div>
                <p className="text-orange-400 font-bold text-xl">이용권이 만료되었습니다</p>
                <p className="text-white/40 text-sm mt-2 leading-relaxed">데스크에 문의하여<br />이용권을 갱신해주세요</p>
              </div>
            </div>
          )}

          {stage === "error" && (
            <div className="bg-[#0e1424] border border-red-500/20 rounded-3xl p-8 text-center space-y-5">
              <div className="w-20 h-20 rounded-full bg-red-500/15 flex items-center justify-center mx-auto">
                <svg className="w-10 h-10 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </div>
              <div>
                <p className="text-red-400 font-bold text-lg">등록된 회원을 찾을 수 없습니다</p>
                <p className="text-white/30 text-sm mt-1">전화번호를 다시 확인해주세요</p>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* 하단 */}
      <div className="px-6 pb-4 text-center">
        <p className="text-white/10 text-[10px] tracking-widest uppercase">ZIANTGYM+ Kiosk</p>
      </div>
    </div>
  );
}
