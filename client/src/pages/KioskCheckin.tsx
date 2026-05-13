import { useState, useEffect, useCallback } from "react";
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
  const [digits, setDigits] = useState("");
  const [result, setResult] = useState<CheckResult>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);
  const now = useClock();

  const checkIn = trpc.access.checkIn.useMutation({
    onSuccess: (data) => {
      setErrorMsg(null);
      setResult(data as CheckResult);
      setCountdown(10);
    },
    onError: (err) => {
      setErrorMsg(err.message || "서버 오류가 발생했습니다.");
      setCountdown(5);
    },
  });

  // 자동 닫기
  useEffect(() => {
    if (countdown <= 0) return;
    const t = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          setResult(null);
          setErrorMsg(null);
          setDigits("");
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [countdown]);

  const handleKey = useCallback((k: string) => {
    if (result || errorMsg) return;
    if (k === "del") { setDigits((v) => v.slice(0, -1)); return; }
    if (k === "clear") { setDigits(""); return; }
    if (digits.length >= 8) return;
    setDigits((v) => v + k);
  }, [digits, result, errorMsg]);

  const handleSubmit = useCallback(() => {
    if (digits.length !== 8 || checkIn.isPending) return;
    checkIn.mutate({ phone: "010" + digits });
  }, [digits, checkIn]);

  const handleClose = useCallback(() => {
    setResult(null);
    setErrorMsg(null);
    setDigits("");
    setCountdown(0);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (result || errorMsg) {
        if (e.key === "Escape" || e.key === "Enter") handleClose();
        return;
      }
      if (e.key >= "0" && e.key <= "9") handleKey(e.key);
      else if (e.key === "Backspace") handleKey("del");
      else if (e.key === "Enter") handleSubmit();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleKey, handleSubmit, handleClose, result, errorMsg]);

  // 전화번호 표시
  const a = digits.slice(0, 4).padEnd(4, "_");
  const b = digits.slice(4, 8).padEnd(4, "_");

  const showPopup = result !== null || errorMsg !== null;

  return (
    <div
      className="fixed inset-0 flex flex-col overflow-hidden select-none"
      style={{ background: "#0a0a0a", fontFamily: "'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif" }}
    >
      {/* ── 상단 배경 배너 ── */}
      <div
        className="relative overflow-hidden"
        style={{ height: "38%", minHeight: 200 }}
      >
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse at 60% 40%, #0f3460 0%, #16213e 50%, #0a0a0a 100%)",
          }}
        />
        {/* 헬스장 이름 */}
        <div className="absolute top-4 left-0 right-0 text-center z-10">
          <p className="text-white font-bold tracking-[0.2em]" style={{ fontSize: 15 }}>
            맞춤운동센터 자이언트짐
          </p>
        </div>
        {/* 슬로건 */}
        <div className="absolute inset-0 flex flex-col items-center justify-center z-10 pb-4">
          <p className="text-white/70 font-light tracking-widest mb-1" style={{ fontSize: 18 }}>
            여러분의 형제,
          </p>
          <p
            className="font-extrabold tracking-widest leading-none"
            style={{
              fontSize: 54,
              color: "#ff6600",
              textShadow: "0 0 40px rgba(255,102,0,0.5), 0 0 80px rgba(255,102,0,0.2)",
            }}
          >
            브로제이
          </p>
        </div>
        {/* 하단 페이드 */}
        <div
          className="absolute bottom-0 left-0 right-0"
          style={{ height: 60, background: "linear-gradient(to bottom, transparent, #0a0a0a)" }}
        />
      </div>

      {/* ── 하단 키패드 영역 ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* 카메라 영역 (가로 화면에서만 표시) */}
        <div
          className="hidden landscape:flex flex-col items-center justify-center"
          style={{ width: "38%", background: "#080808", borderRight: "1px solid #1a1a1a" }}
        >
          <div className="relative" style={{ width: 140, height: 140 }}>
            <div
              className="absolute inset-0 rounded-full"
              style={{ border: "2px solid #ff6600", animation: "pulse-ring 2s ease-in-out infinite" }}
            />
            <div
              className="absolute rounded-full"
              style={{ inset: 8, border: "1px solid rgba(255,102,0,0.4)" }}
            />
            <div
              className="absolute inset-0 rounded-full flex items-center justify-center"
              style={{ border: "2px solid #ff6600" }}
            >
              <svg width="56" height="60" viewBox="0 0 56 60" fill="none">
                <circle cx="28" cy="20" r="12" stroke="#ff6600" strokeWidth="2"/>
                <path d="M8 56C8 42 48 42 48 56" stroke="#ff6600" strokeWidth="2" strokeLinecap="round"/>
                <circle cx="23" cy="18" r="2" fill="#ff6600"/>
                <circle cx="33" cy="18" r="2" fill="#ff6600"/>
                <path d="M23 26Q28 30 33 26" stroke="#ff6600" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
              </svg>
            </div>
          </div>
          <p className="mt-4 text-gray-600 tracking-widest" style={{ fontSize: 11 }}>Searching...</p>
        </div>

        {/* 키패드 패널 */}
        <div className="flex-1 flex flex-col px-5 py-3 gap-2" style={{ background: "#0a0a0a" }}>
          {/* 탭 */}
          <div
            className="flex"
            style={{ borderBottom: "1px solid #1e1e1e", paddingBottom: 0 }}
          >
            {["출석번호", "휴대폰번호", "통합번호"].map((label) => {
              const active = label === "휴대폰번호";
              return (
                <button
                  key={label}
                  className="flex-1 py-2 text-center transition-colors"
                  style={{
                    fontSize: 12,
                    color: active ? "white" : "#555",
                    borderBottom: active ? "2px solid #ff6600" : "2px solid transparent",
                    marginBottom: -1,
                    fontWeight: active ? 600 : 400,
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {/* 전화번호 표시 */}
          <div className="text-center py-1">
            <span
              className="font-mono font-bold tracking-[0.15em] whitespace-nowrap"
              style={{ fontSize: 30, color: "#ff6600" }}
            >
              010-{a}-{b}
            </span>
          </div>

          {/* 키패드 3×4 */}
          <div
            className="grid gap-2 flex-1"
            style={{ gridTemplateColumns: "repeat(3, 1fr)", gridTemplateRows: "repeat(4, 1fr)" }}
          >
            {["1", "2", "3", "4", "5", "6", "7", "8", "9", "취소", "0", "del"].map((k) => {
              const isAction = k === "취소" || k === "del";
              return (
                <button
                  key={k}
                  onClick={() => (k === "취소" ? handleKey("clear") : handleKey(k))}
                  className="flex items-center justify-center rounded-xl font-semibold transition-all active:scale-95"
                  style={{
                    background: isAction ? "#141414" : "#111111",
                    border: "1px solid #222",
                    color: isAction ? "#888" : "white",
                    fontSize: k === "취소" ? 13 : 22,
                    WebkitTapHighlightColor: "transparent",
                  }}
                  onTouchStart={(e) => { (e.currentTarget as HTMLElement).style.background = "#252525"; }}
                  onTouchEnd={(e) => { (e.currentTarget as HTMLElement).style.background = isAction ? "#141414" : "#111111"; }}
                >
                  {k === "del" ? (
                    <svg width="22" height="17" viewBox="0 0 22 17" fill="none">
                      <path d="M8 1H21C21.55 1 22 1.45 22 2V15C22 15.55 21.55 16 21 16H8L1 8.5L8 1Z" stroke="#888" strokeWidth="1.5"/>
                      <line x1="10" y1="5.5" x2="16" y2="11.5" stroke="#888" strokeWidth="1.5" strokeLinecap="round"/>
                      <line x1="16" y1="5.5" x2="10" y2="11.5" stroke="#888" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                  ) : k}
                </button>
              );
            })}
          </div>

          {/* 출석하기 버튼 */}
          <button
            onClick={handleSubmit}
            disabled={digits.length !== 8 || checkIn.isPending}
            className="w-full rounded-xl font-bold tracking-widest transition-all active:scale-[0.98] disabled:opacity-30"
            style={{
              height: 54,
              fontSize: 17,
              background:
                digits.length === 8
                  ? "linear-gradient(135deg, #ff6600, #e55000)"
                  : "#1a1a1a",
              color: "white",
              border: "none",
              boxShadow: digits.length === 8 ? "0 4px 24px rgba(255,102,0,0.35)" : "none",
              WebkitTapHighlightColor: "transparent",
            }}
          >
            {checkIn.isPending ? "확인 중..." : "출석하기"}
          </button>
        </div>
      </div>

      {/* ── 결과 / 에러 팝업 ── */}
      {showPopup && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
          style={{ background: "rgba(0,0,0,0.88)" }}
          onClick={handleClose}
        >
          <div
            className="w-full rounded-t-3xl sm:rounded-2xl sm:max-w-sm relative overflow-hidden"
            style={{
              background: "#141414",
              border: "1px solid rgba(255,255,255,0.07)",
              maxHeight: "90vh",
              overflowY: "auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* 드래그 핸들 (모바일) */}
            <div className="flex justify-center pt-3 pb-1 sm:hidden">
              <div style={{ width: 36, height: 4, borderRadius: 2, background: "#333" }} />
            </div>

            {/* 닫기 버튼 */}
            <button
              onClick={handleClose}
              className="absolute top-4 right-4 z-10 flex items-center justify-center rounded-full"
              style={{ width: 28, height: 28, background: "rgba(255,255,255,0.1)" }}
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <line x1="1" y1="1" x2="9" y2="9" stroke="#aaa" strokeWidth="1.5" strokeLinecap="round"/>
                <line x1="9" y1="1" x2="1" y2="9" stroke="#aaa" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>

            {/* 컨텐츠 */}
            {errorMsg ? (
              <ErrorCard msg={errorMsg} />
            ) : result?.result === "not_found" ? (
              <NotFoundCard />
            ) : result?.result === "blocked" ? (
              <BlockedCard name={result.member!.name} now={now} />
            ) : result ? (
              <MemberCard result={result} now={now} expired={result.result === "expired"} />
            ) : null}

            {/* 카운트다운 바 */}
            <div style={{ height: 3, background: "#1e1e1e" }}>
              <div
                style={{
                  height: "100%",
                  width: `${(countdown / 10) * 100}%`,
                  background: "linear-gradient(90deg, #ff6600, #ff3300)",
                  transition: "width 1s linear",
                }}
              />
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes pulse-ring {
          0%, 100% { transform: scale(1); opacity: 0.8; }
          50% { transform: scale(1.12); opacity: 0.3; }
        }
        .landscape\\:flex { display: none; }
        @media (orientation: landscape) { .landscape\\:flex { display: flex !important; } }
        .hidden.landscape\\:flex { display: none; }
        @media (orientation: landscape) { .hidden.landscape\\:flex { display: flex !important; } }
      `}</style>
    </div>
  );
}

/* ── 카드 컴포넌트들 ── */

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

  return (
    <div>
      {/* 헤더 */}
      <div className="flex items-start gap-3 px-5 pt-5 pb-4">
        <div
          className="shrink-0 flex items-center justify-center rounded-xl overflow-hidden"
          style={{ width: 64, height: 64, background: "rgba(255,102,0,0.12)", border: "1px solid rgba(255,102,0,0.25)" }}
        >
          <svg width="28" height="30" viewBox="0 0 28 30" fill="none">
            <circle cx="14" cy="10" r="7" stroke="#ff6600" strokeWidth="1.5"/>
            <path d="M2 28C2 20 26 20 26 28" stroke="#ff6600" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-white leading-snug" style={{ fontSize: 18 }}>
            <span style={{ color: "#ff6600" }}>{m.name}</span>님, 환영합니다.
          </p>
          <p className="text-gray-400 mt-0.5" style={{ fontSize: 12 }}>{formatClockFull(now)}</p>
          <p className="text-gray-600 mt-0.5" style={{ fontSize: 11 }}>보유 마일리지 &nbsp;-점</p>
        </div>
      </div>

      <Divider />

      {/* 회원권 */}
      <SectionRow
        icon={
          <svg width="20" height="16" viewBox="0 0 20 16" fill="none">
            <rect x="1" y="1" width="18" height="14" rx="2.5" stroke={expired ? "#cc3333" : "#ff6600"} strokeWidth="1.5"/>
            <line x1="1" y1="6" x2="19" y2="6" stroke={expired ? "#cc3333" : "#ff6600"} strokeWidth="0.8"/>
            <circle cx="5.5" cy="3.5" r="1.2" fill={expired ? "#cc3333" : "#ff6600"}/>
            <circle cx="14.5" cy="3.5" r="1.2" fill={expired ? "#cc3333" : "#ff6600"}/>
          </svg>
        }
        iconBg={expired ? "rgba(180,0,0,0.2)" : "rgba(255,102,0,0.15)"}
      >
        {expired ? (
          <>
            <p className="font-bold" style={{ color: "#ff4444", fontSize: 16 }}>회원권이 만료되었습니다.</p>
            <p style={{ color: "#993333", fontSize: 12, marginTop: 2 }}>관리자에게 문의해주세요.</p>
            {m.membershipEnd && (
              <p style={{ color: "#555", fontSize: 11, marginTop: 4 }}>만료일: {m.membershipEnd}</p>
            )}
          </>
        ) : (
          <div className="space-y-1.5">
            <InfoRow label="현재 회원권" value={m.membershipType ?? "-"} />
            {m.membershipEnd && (
              <InfoRow
                label="회원권 만료일"
                value={m.membershipEnd}
                accent={daysUntil(m.membershipEnd) <= 7 ? `D-${daysUntil(m.membershipEnd)}` : undefined}
              />
            )}
            <InfoRow label="남은 입장 횟수" value="무제한" valueColor="#ff6600" />
          </div>
        )}
      </SectionRow>

      <Divider />

      {/* 수강권 */}
      <SectionRow
        icon={
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M10 1L12.6 6.9L19 7.6L14.5 12L15.8 18.3L10 15.1L4.2 18.3L5.5 12L1 7.6L7.4 6.9Z"
              stroke="#666" strokeWidth="1.3" fill="none"/>
          </svg>
        }
        iconBg="rgba(80,80,80,0.2)"
      >
        <div className="space-y-1.5">
          <InfoRow label="수강권 만료일" value={m.ptPackage?.expiryDate ?? "-"} />
          <InfoRow label="잔여 수강" value={m.ptPackage ? `${m.ptPackage.remainingSessions}회` : "-"} />
          <InfoRow label="수강권 상품명" value={m.ptPackage?.name ?? "-"} />
        </div>
      </SectionRow>

      <Divider />

      {/* 락커 */}
      <SectionRow
        icon={
          <svg width="16" height="20" viewBox="0 0 16 20" fill="none">
            <rect x="1" y="8" width="14" height="11" rx="2" stroke={result.locker ? "#ff6600" : "#555"} strokeWidth="1.5"/>
            <path d="M4.5 8V5.5C4.5 3.6 6.1 2 8 2C9.9 2 11.5 3.6 11.5 5.5V8"
              stroke={result.locker ? "#ff6600" : "#555"} strokeWidth="1.5" strokeLinecap="round"/>
            <circle cx="8" cy="14.5" r="1.8" fill={result.locker ? "#ff6600" : "#555"}/>
          </svg>
        }
        iconBg={result.locker ? "rgba(255,102,0,0.15)" : "rgba(60,60,60,0.3)"}
      >
        <div className="space-y-1.5">
          <div className="flex justify-between items-center">
            <span style={{ color: "#888", fontSize: 13 }}>개인락커</span>
            <div className="flex items-center gap-1.5">
              {result.locker ? (
                <>
                  <span style={{ color: "white", fontSize: 13, fontWeight: 500 }}>{result.locker.lockerNumber}번</span>
                  <Badge text="사용중" color="#ff6600" />
                  <Badge text="무제한" color="#444" />
                </>
              ) : (
                <span style={{ color: "#555", fontSize: 13 }}>-</span>
              )}
            </div>
          </div>
          <div className="flex justify-between items-center">
            <span style={{ color: "#888", fontSize: 13 }}>운동복</span>
            <Badge text="미사용" color="#333" />
          </div>
        </div>
      </SectionRow>

      <div style={{ height: 8 }} />
    </div>
  );
}

function NotFoundCard() {
  return (
    <div className="flex flex-col items-center py-10 px-6 text-center">
      <div
        className="flex items-center justify-center rounded-full mb-4"
        style={{ width: 64, height: 64, background: "rgba(80,80,80,0.2)" }}
      >
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
          <circle cx="14" cy="14" r="12" stroke="#666" strokeWidth="1.5"/>
          <line x1="9" y1="9" x2="19" y2="19" stroke="#666" strokeWidth="1.5" strokeLinecap="round"/>
          <line x1="19" y1="9" x2="9" y2="19" stroke="#666" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </div>
      <p className="font-bold text-white" style={{ fontSize: 16 }}>등록된 회원을 찾을 수 없습니다.</p>
      <p className="text-gray-500 mt-1" style={{ fontSize: 13 }}>전화번호를 다시 확인해주세요.</p>
    </div>
  );
}

function BlockedCard({ name, now }: { name: string; now: Date }) {
  return (
    <div className="px-5 pt-5 pb-6">
      <p className="font-bold text-white" style={{ fontSize: 18 }}>
        <span style={{ color: "#ff6600" }}>{name}</span>님
      </p>
      <p className="text-gray-500 mt-0.5 mb-4" style={{ fontSize: 12 }}>{formatClockFull(now)}</p>
      <div
        className="rounded-2xl px-4 py-4 text-center"
        style={{ background: "rgba(160,0,0,0.18)", border: "1px solid rgba(180,0,0,0.35)" }}
      >
        <p className="font-bold" style={{ color: "#ff4444", fontSize: 16 }}>출입이 제한된 회원입니다.</p>
        <p style={{ color: "#993333", fontSize: 13, marginTop: 4 }}>관리자에게 문의해주세요.</p>
      </div>
    </div>
  );
}

function ErrorCard({ msg }: { msg: string }) {
  return (
    <div className="flex flex-col items-center py-10 px-6 text-center">
      <div
        className="flex items-center justify-center rounded-full mb-4"
        style={{ width: 64, height: 64, background: "rgba(180,100,0,0.2)" }}
      >
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
          <circle cx="14" cy="14" r="12" stroke="#ff8800" strokeWidth="1.5"/>
          <line x1="14" y1="8" x2="14" y2="15" stroke="#ff8800" strokeWidth="2" strokeLinecap="round"/>
          <circle cx="14" cy="19" r="1.2" fill="#ff8800"/>
        </svg>
      </div>
      <p className="font-bold text-white" style={{ fontSize: 15 }}>오류가 발생했습니다</p>
      <p className="text-gray-500 mt-1" style={{ fontSize: 12 }}>{msg}</p>
    </div>
  );
}

/* ── 공통 UI ── */

function Divider() {
  return <div style={{ height: 1, background: "rgba(255,255,255,0.05)", margin: "0 20px" }} />;
}

function SectionRow({
  icon,
  iconBg,
  children,
}: {
  icon: React.ReactNode;
  iconBg: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3 px-5 py-3.5">
      <div
        className="shrink-0 flex items-center justify-center rounded-full"
        style={{ width: 40, height: 40, background: iconBg }}
      >
        {icon}
      </div>
      <div className="flex-1 min-w-0 flex items-center">{children}</div>
    </div>
  );
}

function InfoRow({
  label,
  value,
  accent,
  valueColor,
}: {
  label: string;
  value: string;
  accent?: string;
  valueColor?: string;
}) {
  return (
    <div className="flex justify-between items-center">
      <span style={{ color: "#888", fontSize: 13 }}>{label}</span>
      <div className="flex items-center gap-1.5">
        <span style={{ color: valueColor ?? "white", fontSize: 13, fontWeight: 500 }}>{value}</span>
        {accent && <span style={{ color: "#ff8800", fontSize: 11 }}>{accent}</span>}
      </div>
    </div>
  );
}

function Badge({ text, color }: { text: string; color: string }) {
  return (
    <span
      className="font-medium"
      style={{
        fontSize: 11,
        padding: "2px 8px",
        borderRadius: 4,
        background: color,
        color: "white",
      }}
    >
      {text}
    </span>
  );
}
