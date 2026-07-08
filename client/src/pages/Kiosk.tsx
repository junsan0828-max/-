import { useState, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";

type Stage = "input" | "success" | "already" | "error";

function nowTimeStr() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default function KioskPage() {
  const [phone, setPhone] = useState("");
  const [stage, setStage] = useState<Stage>("input");
  const [memberName, setMemberName] = useState("");
  const [pointsEarned, setPointsEarned] = useState(0);
  const [currentTime, setCurrentTime] = useState(nowTimeStr());
  const inputRef = useRef<HTMLInputElement>(null);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const t = setInterval(() => setCurrentTime(nowTimeStr()), 10000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (stage === "input") {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [stage]);

  const checkInMutation = trpc.kiosk.checkIn.useMutation({
    onSuccess: (data) => {
      setMemberName(data.name);
      setPointsEarned(data.pointsEarned);
      setStage(data.alreadyCheckedIn ? "already" : "success");
      scheduleReset();
    },
    onError: (e) => {
      setMemberName(e.message);
      setStage("error");
      scheduleReset();
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

  function handleSubmit() {
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 9) return;
    checkInMutation.mutate({ phone: digits });
  }

  function formatPhone(raw: string) {
    const d = raw.replace(/\D/g, "");
    if (d.length <= 3) return d;
    if (d.length <= 7) return `${d.slice(0, 3)}-${d.slice(3)}`;
    return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
  }

  const today = new Date().toLocaleDateString("ko-KR", { month: "long", day: "numeric", weekday: "short" });

  return (
    <div className="min-h-screen bg-[#0a0f1e] flex flex-col items-center justify-center select-none">
      {/* 헤더 */}
      <div className="mb-8 text-center">
        <p
          style={{ fontFamily: "'Cormorant Garamond', serif", letterSpacing: "0.15em" }}
          className="text-3xl font-semibold text-white"
        >
          ZIANTGYM<span className="text-[#4f6ef7]">+</span>
        </p>
        <p className="text-sm text-white/40 mt-1">{today} {currentTime}</p>
      </div>

      {/* 카드 */}
      <div className="w-full max-w-sm mx-4">
        {stage === "input" && (
          <div className="bg-[#111827] border border-white/10 rounded-3xl p-6 space-y-5">
            <div className="text-center">
              <p className="text-white font-semibold text-lg">출입 체크인</p>
              <p className="text-white/40 text-sm mt-0.5">전화번호를 입력하세요</p>
            </div>

            {/* 번호 표시 */}
            <div className="bg-[#0a0f1e] rounded-2xl px-5 py-4 text-center min-h-[56px] flex items-center justify-center">
              <span className="text-2xl font-mono font-bold text-white tracking-widest">
                {phone ? formatPhone(phone) : <span className="text-white/20">010-0000-0000</span>}
              </span>
            </div>

            {/* 숫자 키패드 */}
            <div className="grid grid-cols-3 gap-2">
              {["1","2","3","4","5","6","7","8","9","","0","⌫"].map((k, i) => (
                <button
                  key={i}
                  onClick={() => k === "⌫" ? handleDelete() : k !== "" ? handleInput(k) : undefined}
                  className={`rounded-2xl py-4 text-xl font-semibold transition-all active:scale-95 ${
                    k === "" ? "invisible" :
                    k === "⌫" ? "bg-white/5 text-white/50 hover:bg-white/10" :
                    "bg-white/8 text-white hover:bg-white/15"
                  }`}
                  style={{ background: k !== "" && k !== "⌫" ? "rgba(255,255,255,0.06)" : undefined }}
                >
                  {k}
                </button>
              ))}
            </div>

            <button
              onClick={handleSubmit}
              disabled={phone.replace(/\D/g, "").length < 9 || checkInMutation.isPending}
              className="w-full bg-[#4f6ef7] hover:bg-[#3d5ce5] disabled:opacity-30 disabled:cursor-not-allowed text-white font-bold py-4 rounded-2xl text-lg transition-all active:scale-95"
            >
              {checkInMutation.isPending ? "확인 중..." : "입장 확인"}
            </button>

            {/* 숨겨진 실제 input (외부 바코드 리더 등) */}
            <input
              ref={inputRef}
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 11))}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              className="opacity-0 absolute w-0 h-0"
              tabIndex={-1}
            />
          </div>
        )}

        {stage === "success" && (
          <div className="bg-[#111827] border border-emerald-500/30 rounded-3xl p-8 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto">
              <svg className="w-8 h-8 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-black text-white">{memberName}님</p>
              <p className="text-emerald-400 font-semibold mt-1">출입이 확인되었습니다</p>
              <p className="text-white/40 text-sm mt-0.5">환영합니다! 즐거운 운동 되세요</p>
            </div>
            {pointsEarned > 0 && (
              <div className="bg-[#4f6ef7]/10 border border-[#4f6ef7]/20 rounded-2xl px-4 py-3">
                <p className="text-[#7b9bff] text-sm font-semibold">
                  +{pointsEarned.toLocaleString("ko-KR")}P 적립되었습니다
                </p>
              </div>
            )}
          </div>
        )}

        {stage === "already" && (
          <div className="bg-[#111827] border border-amber-500/30 rounded-3xl p-8 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-amber-500/20 flex items-center justify-center mx-auto">
              <svg className="w-8 h-8 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-black text-white">{memberName}님</p>
              <p className="text-amber-400 font-semibold mt-1">오늘 이미 출입이 확인되었습니다</p>
              <p className="text-white/40 text-sm mt-0.5">즐거운 운동 되세요!</p>
            </div>
          </div>
        )}

        {stage === "error" && (
          <div className="bg-[#111827] border border-red-500/30 rounded-3xl p-8 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto">
              <svg className="w-8 h-8 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </div>
            <div>
              <p className="text-red-400 font-semibold">등록된 회원을 찾을 수 없습니다</p>
              <p className="text-white/40 text-sm mt-1">전화번호를 다시 확인해주세요</p>
            </div>
          </div>
        )}
      </div>

      <p className="mt-8 text-white/20 text-xs">ZIANTGYM+ 출입 시스템</p>
    </div>
  );
}
