import { useState, useEffect, useCallback, useRef } from "react";
import { trpc } from "../lib/trpc";

type CheckResult = {
  result: string;
  member: {
    id: number;
    name: string;
    phone: string | null;
    membershipStart: string | null;
    membershipEnd: string | null;
    membershipType: string | null;
    ptPackage: {
      name: string | null;
      expiryDate: string | null;
      remainingSessions: number;
    } | null;
  } | null;
  locker: {
    lockerNumber: string;
    type: string;
    endDate: string | null;
  } | null;
} | null;

const DAYS = ["일", "월", "화", "수", "목", "금", "토"];

function useClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

function formatClockFull(d: Date) {
  const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const day = DAYS[d.getDay()];
  const hms = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
  return `${ymd}(${day}) ${hms}`;
}

function daysUntil(dateStr: string): number {
  const end = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((end.getTime() - today.getTime()) / 86400000);
}

export default function KioskCheckin() {
  const [digits, setDigits] = useState(""); // 010 뒤 8자리
  const [result, setResult] = useState<CheckResult>(null);
  const [countdown, setCountdown] = useState(0);
  const now = useClock();

  const checkIn = trpc.access.checkIn.useMutation({
    onSuccess: (data) => {
      setResult(data as CheckResult);
      setCountdown(8);
    },
  });

  // 자동 닫기
  useEffect(() => {
    if (countdown <= 0) return;
    const t = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) { setResult(null); setDigits(""); return 0; }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [countdown]);

  const handleKey = useCallback((k: string) => {
    if (result) return;
    if (k === "del") { setDigits((v) => v.slice(0, -1)); return; }
    if (k === "clear") { setDigits(""); return; }
    if (digits.length >= 8) return;
    setDigits((v) => v + k);
  }, [digits, result]);

  const handleSubmit = useCallback(() => {
    if (digits.length !== 8 || checkIn.isPending) return;
    checkIn.mutate({ phone: "010" + digits });
  }, [digits, checkIn]);

  // 키보드 지원
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (result) {
        if (e.key === "Escape" || e.key === "Enter") { setResult(null); setDigits(""); setCountdown(0); }
        return;
      }
      if (e.key >= "0" && e.key <= "9") handleKey(e.key);
      else if (e.key === "Backspace") handleKey("del");
      else if (e.key === "Enter") handleSubmit();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleKey, handleSubmit, result]);

  // 전화번호 표시: 010-????-????
  const d1 = digits.slice(0, 4).padEnd(4, "_");
  const d2 = digits.slice(4, 8).padEnd(4, "_");
  const displayPhone = `010-${d1}-${d2}`;

  return (
    <div className="fixed inset-0 bg-[#0a0a0a] flex flex-col overflow-hidden select-none font-sans">

      {/* ── 상단 배경 영역 ── */}
      <div className="relative flex-[0_0_52%] overflow-hidden">
        {/* 배경 그라디언트 (헬스장 이미지 없을 때 대체) */}
        <div
          className="absolute inset-0"
          style={{
            background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 40%, #0f3460 70%, #1a1a2e 100%)",
          }}
        />
        {/* 상단 헬스장 이름 */}
        <div className="absolute top-0 left-0 right-0 z-10 px-6 pt-5">
          <p className="text-white text-xl font-bold tracking-[0.15em] drop-shadow-lg">
            맞춤운동센터 자이언트짐
          </p>
        </div>
        {/* 중앙 장식 텍스트 */}
        <div className="absolute inset-0 flex flex-col items-start justify-center pl-8 pb-4 z-10">
          <p className="text-white/80 text-2xl font-light tracking-widest mb-1">여러분의 형제,</p>
          <p
            className="text-5xl font-extrabold tracking-widest"
            style={{ color: "#ff6600", textShadow: "0 0 30px rgba(255,102,0,0.6)" }}
          >
            자이언트짐
          </p>
        </div>
        {/* 우측 하단 페이드 */}
        <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-[#0a0a0a] to-transparent z-10" />
      </div>

      {/* ── 하단 체크인 영역 ── */}
      <div className="flex-1 flex gap-0">

        {/* 카메라 영역 */}
        <div className="w-[42%] relative bg-[#111] flex items-center justify-center overflow-hidden">
          <div className="w-full h-full bg-[#0d0d0d] flex items-center justify-center">
            {/* 카메라 미리보기 자리 */}
            <div className="relative w-36 h-36">
              {/* 원형 스캔 애니메이션 */}
              <div
                className="absolute inset-0 rounded-full border-2 opacity-60"
                style={{ borderColor: "#ff6600", animation: "ping 2s cubic-bezier(0,0,0.2,1) infinite" }}
              />
              <div
                className="absolute inset-2 rounded-full border opacity-40"
                style={{ borderColor: "#ff6600" }}
              />
              <div
                className="absolute inset-0 rounded-full border-2"
                style={{ borderColor: "#ff6600" }}
              />
              {/* 얼굴 아이콘 */}
              <svg className="absolute inset-0 w-full h-full p-8 opacity-50" viewBox="0 0 100 100" fill="none">
                <circle cx="50" cy="38" r="18" stroke="#ff6600" strokeWidth="3"/>
                <path d="M20 85 C20 65 80 65 80 85" stroke="#ff6600" strokeWidth="3" strokeLinecap="round"/>
                <circle cx="42" cy="34" r="3" fill="#ff6600"/>
                <circle cx="58" cy="34" r="3" fill="#ff6600"/>
                <path d="M43 45 Q50 51 57 45" stroke="#ff6600" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
              </svg>
            </div>
          </div>
          <p className="absolute bottom-4 text-xs text-gray-500 tracking-widest">Searching...</p>
        </div>

        {/* 키패드 영역 */}
        <div className="flex-1 bg-[#0f0f0f] flex flex-col px-4 py-3 gap-2">

          {/* 탭 */}
          <div className="flex text-xs">
            {(["출석번호", "휴대폰번호", "통합번호"] as const).map((label) => (
              <button
                key={label}
                className={`flex-1 py-1.5 text-center transition-colors ${
                  label === "휴대폰번호"
                    ? "text-white border-b-2"
                    : "text-gray-600 border-b border-gray-800"
                }`}
                style={label === "휴대폰번호" ? { borderColor: "#ff6600" } : {}}
              >
                {label}
              </button>
            ))}
          </div>

          {/* 전화번호 표시 */}
          <div className="text-center py-1">
            <span
              className="text-2xl font-bold tracking-[0.2em] font-mono"
              style={{ color: "#ff6600" }}
            >
              {displayPhone}
            </span>
          </div>

          {/* 키패드 */}
          <div className="grid grid-cols-3 gap-1.5 flex-1">
            {["1","2","3","4","5","6","7","8","9","취소","0","del"].map((k) => (
              <button
                key={k}
                onClick={() => k === "취소" ? handleKey("clear") : handleKey(k)}
                className="flex items-center justify-center rounded-lg text-white font-semibold text-xl transition-all active:scale-95"
                style={{
                  background: k === "취소" || k === "del" ? "#1a1a1a" : "#181818",
                  border: "1px solid #2a2a2a",
                  minHeight: "52px",
                }}
                onMouseDown={(e) => { (e.target as HTMLElement).style.background = "#2a2a2a"; }}
                onMouseUp={(e) => {
                  (e.target as HTMLElement).style.background =
                    k === "취소" || k === "del" ? "#1a1a1a" : "#181818";
                }}
                onTouchStart={(e) => { (e.currentTarget as HTMLElement).style.background = "#2a2a2a"; }}
                onTouchEnd={(e) => {
                  (e.currentTarget as HTMLElement).style.background =
                    k === "취소" || k === "del" ? "#1a1a1a" : "#181818";
                }}
              >
                {k === "del" ? (
                  <svg width="20" height="16" viewBox="0 0 20 16" fill="none">
                    <path d="M7 1H19C19.55 1 20 1.45 20 2V14C20 14.55 19.55 15 19 15H7L1 8L7 1Z" stroke="#aaa" strokeWidth="1.5"/>
                    <path d="M13 5.5L9 10.5M9 5.5L13 10.5" stroke="#aaa" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                ) : k === "취소" ? (
                  <span className="text-gray-400 text-sm">{k}</span>
                ) : k}
              </button>
            ))}
          </div>

          {/* 출석하기 버튼 */}
          <button
            onClick={handleSubmit}
            disabled={digits.length !== 8 || checkIn.isPending}
            className="w-full py-3.5 rounded-lg font-bold text-lg tracking-widest transition-all active:scale-[0.98] disabled:opacity-30"
            style={{
              background: digits.length === 8 ? "linear-gradient(135deg, #ff6600, #ff4400)" : "#2a2a2a",
              color: "white",
              boxShadow: digits.length === 8 ? "0 4px 20px rgba(255,102,0,0.4)" : "none",
            }}
          >
            {checkIn.isPending ? "확인 중..." : "출석하기"}
          </button>
        </div>
      </div>

      {/* ── 결과 팝업 ── */}
      {result && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.85)" }}
          onClick={() => { setResult(null); setDigits(""); setCountdown(0); }}
        >
          <div
            className="w-full max-w-[360px] rounded-2xl overflow-hidden relative"
            style={{ background: "rgba(20,20,20,0.97)", border: "1px solid rgba(255,255,255,0.08)" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* 닫기 버튼 */}
            <button
              onClick={() => { setResult(null); setDigits(""); setCountdown(0); }}
              className="absolute top-3 right-3 z-10 w-7 h-7 rounded-full flex items-center justify-center text-gray-400 hover:text-white transition-colors"
              style={{ background: "rgba(255,255,255,0.1)" }}
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
                <path d="M1 1L9 9M9 1L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>

            {result.result === "not_found" ? (
              <NotFoundCard />
            ) : result.result === "blocked" ? (
              <BlockedCard name={result.member!.name} now={now} />
            ) : (
              <MemberCard result={result} now={now} expired={result.result === "expired"} />
            )}

            {/* 카운트다운 바 */}
            <div className="h-0.5 bg-gray-800">
              <div
                className="h-full transition-all"
                style={{
                  width: `${(countdown / 8) * 100}%`,
                  background: "linear-gradient(90deg, #ff6600, #ff4400)",
                  transition: "width 1s linear",
                }}
              />
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes ping {
          0% { transform: scale(1); opacity: 0.6; }
          75%, 100% { transform: scale(1.5); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

function MemberCard({
  result,
  now,
  expired,
}: {
  result: NonNullable<CheckResult>;
  now: Date;
  expired: boolean;
}) {
  const m = result.member!;
  const today = new Date().toISOString().substring(0, 10);

  return (
    <div>
      {/* 헤더: 이름 + 시간 */}
      <div className="flex items-start gap-3 p-4 pb-3">
        {/* 프로필 사진 자리 */}
        <div
          className="w-16 h-16 rounded-xl shrink-0 flex items-center justify-center overflow-hidden"
          style={{ background: "rgba(255,102,0,0.15)", border: "1px solid rgba(255,102,0,0.3)" }}
        >
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            <circle cx="14" cy="10" r="6" stroke="#ff6600" strokeWidth="1.5"/>
            <path d="M4 26C4 20 24 20 24 26" stroke="#ff6600" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-lg font-bold text-white leading-tight">
            <span style={{ color: "#ff6600" }}>{m.name}</span>님, 환영합니다.
          </p>
          <p className="text-xs text-gray-400 mt-0.5">{formatClockFull(now)}</p>
          <p className="text-xs text-gray-600 mt-0.5">보유 마일리지 &nbsp;-점</p>
        </div>
      </div>

      <div className="h-px bg-white/5 mx-4" />

      {/* 회원권 섹션 */}
      <div className="px-4 py-3 flex gap-3 items-start">
        {/* 아이콘 */}
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
          style={{ background: expired ? "rgba(180,0,0,0.3)" : "rgba(255,102,0,0.2)" }}
        >
          <svg width="18" height="16" viewBox="0 0 18 16" fill="none">
            <rect x="1" y="3" width="16" height="10" rx="2" stroke={expired ? "#cc3333" : "#ff6600"} strokeWidth="1.5"/>
            <path d="M1 7H17" stroke={expired ? "#cc3333" : "#ff6600"} strokeWidth="1"/>
            <circle cx="5" cy="5" r="1" fill={expired ? "#cc3333" : "#ff6600"}/>
            <circle cx="13" cy="5" r="1" fill={expired ? "#cc3333" : "#ff6600"}/>
          </svg>
        </div>
        <div className="flex-1">
          {expired ? (
            <>
              <p className="text-sm font-bold text-red-400">회원권이 만료되었습니다.</p>
              <p className="text-xs text-red-600 mt-0.5">관리자에게 문의해주세요.</p>
              {m.membershipEnd && (
                <p className="text-xs text-gray-600 mt-1">만료일: {m.membershipEnd}</p>
              )}
            </>
          ) : (
            <>
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-500">현재 회원권</span>
                <span className="text-xs text-white font-medium">{m.membershipType ?? "-"}</span>
              </div>
              {m.membershipEnd && (
                <div className="flex justify-between items-center mt-1">
                  <span className="text-xs text-gray-500">회원권 만료일</span>
                  <span className={`text-xs font-medium ${daysUntil(m.membershipEnd) <= 7 ? "text-orange-400" : "text-white"}`}>
                    {m.membershipEnd}
                    {daysUntil(m.membershipEnd) <= 7 && (
                      <span className="ml-1 text-orange-500">D-{daysUntil(m.membershipEnd)}</span>
                    )}
                  </span>
                </div>
              )}
              <div className="flex justify-between items-center mt-1">
                <span className="text-xs text-gray-500">남은 입장 횟수</span>
                <span className="text-xs font-bold" style={{ color: "#ff6600" }}>무제한</span>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="h-px bg-white/5 mx-4" />

      {/* 수강권 섹션 */}
      <div className="px-4 py-3 flex gap-3 items-start">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
          style={{ background: "rgba(80,80,80,0.3)" }}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <polygon points="9,1 11.5,6.5 17.5,7.3 13,11.7 14.1,17.7 9,14.8 3.9,17.7 5,11.7 0.5,7.3 6.5,6.5" stroke="#888" strokeWidth="1.2" fill="none"/>
          </svg>
        </div>
        <div className="flex-1">
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-500">수강권 만료일</span>
            <span className="text-xs text-white">{m.ptPackage?.expiryDate ?? "-"}</span>
          </div>
          <div className="flex justify-between items-center mt-1">
            <span className="text-xs text-gray-500">잔여 수강</span>
            <span className="text-xs text-white">{m.ptPackage ? `${m.ptPackage.remainingSessions}회` : "-"}</span>
          </div>
          <div className="flex justify-between items-center mt-1">
            <span className="text-xs text-gray-500">수강권 상품명</span>
            <span className="text-xs text-white truncate max-w-[140px]">{m.ptPackage?.name ?? "-"}</span>
          </div>
        </div>
      </div>

      <div className="h-px bg-white/5 mx-4" />

      {/* 락커 섹션 */}
      <div className="px-4 py-3 flex gap-3 items-start">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
          style={{ background: result.locker ? "rgba(255,102,0,0.2)" : "rgba(80,80,80,0.3)" }}
        >
          <svg width="16" height="18" viewBox="0 0 16 18" fill="none">
            <rect x="1" y="7" width="14" height="10" rx="2" stroke={result.locker ? "#ff6600" : "#666"} strokeWidth="1.5"/>
            <path d="M5 7V5C5 3.3 6.3 2 8 2C9.7 2 11 3.3 11 5V7" stroke={result.locker ? "#ff6600" : "#666"} strokeWidth="1.5" strokeLinecap="round"/>
            <circle cx="8" cy="13" r="1.5" fill={result.locker ? "#ff6600" : "#666"}/>
          </svg>
        </div>
        <div className="flex-1">
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-500">개인락커</span>
            <div className="flex items-center gap-1.5">
              {result.locker ? (
                <>
                  <span className="text-xs text-white font-medium">{result.locker.lockerNumber}번</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded font-medium text-white" style={{ background: "#ff6600" }}>사용중</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded font-medium text-white" style={{ background: "#444" }}>무제한</span>
                </>
              ) : (
                <span className="text-xs text-gray-600">-</span>
              )}
            </div>
          </div>
          <div className="flex justify-between items-center mt-1.5">
            <span className="text-xs text-gray-500">운동복</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded font-medium text-white" style={{ background: "#333" }}>미사용</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function NotFoundCard() {
  return (
    <div className="p-8 text-center">
      <div
        className="w-16 h-16 rounded-full mx-auto flex items-center justify-center mb-4"
        style={{ background: "rgba(100,100,100,0.2)" }}
      >
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
          <circle cx="14" cy="14" r="12" stroke="#666" strokeWidth="1.5"/>
          <path d="M9 9L19 19M19 9L9 19" stroke="#666" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </div>
      <p className="text-white font-bold text-base">등록된 회원을 찾을 수 없습니다.</p>
      <p className="text-gray-500 text-sm mt-1">전화번호를 다시 확인해주세요.</p>
    </div>
  );
}

function BlockedCard({ name, now }: { name: string; now: Date }) {
  return (
    <div className="p-6">
      <p className="text-lg font-bold text-white mb-1">
        <span style={{ color: "#ff6600" }}>{name}</span>님
      </p>
      <p className="text-xs text-gray-400 mb-4">{formatClockFull(now)}</p>
      <div
        className="rounded-xl p-4 text-center"
        style={{ background: "rgba(180,0,0,0.2)", border: "1px solid rgba(180,0,0,0.4)" }}
      >
        <p className="text-red-400 font-bold">출입이 제한된 회원입니다.</p>
        <p className="text-red-600 text-sm mt-1">관리자에게 문의해주세요.</p>
      </div>
    </div>
  );
}
