import { useState, useEffect, useCallback, useRef } from "react";
import { trpc } from "../lib/trpc";

type CheckResult = {
  result: string;
  branchName?: string | null;
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

function fmtDate(d: Date) {
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")} (${DAYS[d.getDay()]})`;
}
function fmtTime(d: Date) {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
}
function daysUntil(dateStr: string): number {
  const end = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((end.getTime() - today.getTime()) / 86400000);
}

// ZIANTGYM 로고 SVG — 바벨 + Z 구조 (|H-Z-H|)
function ZiantLogo({ size = 36, color = "white" }: { size?: number; color?: string }) {
  const w = Math.round(size * 2.75); // 220:80 비율
  return (
    <svg width={w} height={size} viewBox="0 0 220 80" fill="none">
      {/* 왼쪽 외부 플레이트 */}
      <rect x="1" y="20" width="11" height="40" rx="3" fill={color}/>
      {/* 왼쪽 H — 왼쪽 바 */}
      <rect x="18" y="10" width="14" height="60" rx="3" fill={color}/>
      {/* 왼쪽 H — 오른쪽 바 */}
      <rect x="36" y="10" width="14" height="60" rx="3" fill={color}/>
      {/* 왼쪽 H 크로스바 */}
      <rect x="18" y="33" width="32" height="14" fill={color}/>
      {/* 중앙 Z 형태 — 평행한 두 대각선 엣지 (기울기 36/62) */}
      <polygon points="50,10 162,10 162,22 100,22 162,58 162,70 50,70 50,58 112,58 50,22" fill={color}/>
      {/* 오른쪽 H — 왼쪽 바 */}
      <rect x="164" y="10" width="14" height="60" rx="3" fill={color}/>
      {/* 오른쪽 H — 오른쪽 바 */}
      <rect x="182" y="10" width="14" height="60" rx="3" fill={color}/>
      {/* 오른쪽 H 크로스바 */}
      <rect x="164" y="33" width="32" height="14" fill={color}/>
      {/* 오른쪽 외부 플레이트 */}
      <rect x="208" y="20" width="11" height="40" rx="3" fill={color}/>
    </svg>
  );
}

type KioskTab = "phone" | "number" | "qr";
type BottomNav = "home" | "locker" | "search" | "logs" | "more";

export default function KioskCheckin() {
  const [digits, setDigits] = useState("");
  const [result, setResult] = useState<CheckResult>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [activeTab, setActiveTab] = useState<KioskTab>("phone");
  const [bottomNav, setBottomNav] = useState<BottomNav>("home");
  const now = useClock();

  // 탭별 최대 자리수
  const maxDigits = activeTab === "number" ? 6 : 8;
  // 출석번호: 4~6자리, 휴대폰: 8자리
  const isReady = activeTab === "number" ? digits.length >= 4 : digits.length === 8;

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

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) { setResult(null); setErrorMsg(null); setDigits(""); return 0; }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [countdown]);

  const handleKey = useCallback((k: string) => {
    if (result || errorMsg) return;
    if (k === "del") { setDigits((v) => v.slice(0, -1)); return; }
    if (k === "clear") { setDigits(""); return; }
    if (digits.length >= maxDigits) return;
    setDigits((v) => v + k);
  }, [digits, result, errorMsg, maxDigits]);

  const handleSubmit = useCallback(() => {
    if (!isReady || checkIn.isPending) return;
    if (activeTab === "number") {
      checkIn.mutate({ memberNumber: digits });
    } else {
      checkIn.mutate({ phone: "010" + digits });
    }
  }, [digits, checkIn, activeTab, isReady]);

  const handleClose = useCallback(() => {
    setResult(null); setErrorMsg(null); setDigits(""); setCountdown(0);
  }, []);

  const handleTabChange = useCallback((tab: KioskTab) => {
    setActiveTab(tab);
    setDigits("");
    setResult(null);
    setErrorMsg(null);
  }, []);

  // ── 안드로이드 뒤로 버튼 처리 ─────────────────────────────────────────────
  const backStateRef = useRef({ result, errorMsg, bottomNav, activeTab });
  useEffect(() => { backStateRef.current = { result, errorMsg, bottomNav, activeTab }; }, [result, errorMsg, bottomNav, activeTab]);

  useEffect(() => {
    history.pushState(null, "");
    const handler = () => {
      const { result: r, errorMsg: e, bottomNav: nav } = backStateRef.current;
      if (r !== null || e !== null) {
        setResult(null); setErrorMsg(null); setDigits(""); setCountdown(0);
        history.pushState(null, "");
      } else if (nav !== "home") {
        setBottomNav("home");
        history.pushState(null, "");
      }
    };
    window.addEventListener("popstate", handler);
    return () => window.removeEventListener("popstate", handler);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (result || errorMsg) { if (e.key === "Escape" || e.key === "Enter") handleClose(); return; }
      if (e.key >= "0" && e.key <= "9") handleKey(e.key);
      else if (e.key === "Backspace") handleKey("del");
      else if (e.key === "Enter") handleSubmit();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleKey, handleSubmit, handleClose, result, errorMsg]);

  // 전화번호 표시: 010 - XXXX - XXXX
  const a = digits.slice(0, 4);
  const b = digits.slice(4, 8);
  const aDisplay = a.padEnd(4, "_").split("").join(" ");
  const bDisplay = b.padEnd(4, "_").split("").join(" ");

  // 출석번호 표시: 최대 6자리 블록
  const numDisplay = digits.padEnd(6, "_").split("").join("  ");

  const showPopup = result !== null || errorMsg !== null;

  return (
    <div
      className="fixed inset-0 flex flex-col overflow-hidden select-none"
      style={{ background: "#0d0d0d", fontFamily: "'Apple SD Gothic Neo','Noto Sans KR',sans-serif", color: "white" }}
    >
      {/* ── 메인 컨텐츠 ── */}
      {bottomNav === "home" && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* 헤더 */}
          <div className="flex flex-col items-center pt-8 pb-4 relative" style={{ borderBottom: "1px solid #1c1c1c" }}>
            {/* 알림 아이콘 */}
            <button className="absolute top-4 right-4 p-2">
              <svg width="20" height="22" viewBox="0 0 20 22" fill="none">
                <path d="M10 22C11.1 22 12 21.1 12 20H8C8 21.1 8.9 22 10 22ZM18 16V10C18 6.93 16.37 4.36 13.5 3.68V3C13.5 2.17 12.83 1.5 12 1.5H8C7.17 1.5 6.5 2.17 6.5 3V3.68C3.64 4.36 2 6.92 2 10V16L0 18V19H20V18L18 16Z" fill="#555"/>
              </svg>
            </button>
            <p style={{ fontFamily: "'Cinzel', serif", fontWeight: 700, letterSpacing: "0.25em", fontSize: 14, color: "white" }}>ZIANTGYM</p>
            <p className="mt-3 tracking-[0.15em] text-gray-500" style={{ fontSize: 11 }}>ACCESS SYSTEM</p>
            <h1 className="font-bold tracking-tight mt-1" style={{ fontSize: 28 }}>출입 시스템</h1>
          </div>

          {/* 탭 */}
          <div className="flex" style={{ borderBottom: "1px solid #1e1e1e" }}>
            {([["number","출석번호"], ["phone","휴대폰번호"], ["qr","QR 출입"]] as [KioskTab,string][]).map(([id, label]) => (
              <button
                key={id}
                onClick={() => handleTabChange(id as KioskTab)}
                className="flex-1 py-3 text-center text-sm transition-colors"
                style={{
                  color: activeTab === id ? "white" : "#555",
                  borderBottom: activeTab === id ? "2px solid white" : "2px solid transparent",
                  marginBottom: -1,
                  fontWeight: activeTab === id ? 600 : 400,
                  fontSize: 13,
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {/* 입력 표시 */}
          <div className="text-center py-5 px-4">
            {activeTab === "phone" ? (
              <span className="font-mono font-bold tracking-widest whitespace-nowrap" style={{ fontSize: 26, color: "white", letterSpacing: "0.08em" }}>
                010 - {aDisplay} - {bDisplay}
              </span>
            ) : activeTab === "number" ? (
              <div>
                <p style={{ fontSize: 11, color: "#555", letterSpacing: "0.15em", marginBottom: 10 }}>ATTENDANCE NUMBER</p>
                <span className="font-mono font-bold" style={{ fontSize: 32, color: "white", letterSpacing: "0.18em" }}>
                  {numDisplay}
                </span>
                <p style={{ fontSize: 11, color: "#444", marginTop: 8 }}>4 ~ 6자리 출석번호를 입력하세요</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <div style={{ width: 64, height: 64, background: "#1c1c1c", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                    <rect x="2" y="2" width="28" height="28" rx="4" stroke="#555" strokeWidth="1.5"/>
                    <rect x="7" y="7" width="8" height="8" fill="#555"/>
                    <rect x="17" y="7" width="8" height="8" fill="#555"/>
                    <rect x="7" y="17" width="8" height="8" fill="#555"/>
                    <rect x="19" y="19" width="2" height="2" fill="#555"/>
                    <rect x="23" y="19" width="2" height="2" fill="#555"/>
                    <rect x="19" y="23" width="2" height="2" fill="#555"/>
                    <rect x="23" y="23" width="2" height="2" fill="#555"/>
                  </svg>
                </div>
                <p style={{ color: "#555", fontSize: 13 }}>QR 출입은 준비 중입니다</p>
              </div>
            )}
          </div>

          {/* 키패드 (QR 탭이 아닐 때만) */}
          {activeTab !== "qr" && (
            <div className="flex-1 flex flex-col px-5 gap-2" style={{ minHeight: 0 }}>
              <div
                className="grid gap-2 flex-1"
                style={{ gridTemplateColumns: "repeat(3, 1fr)", gridTemplateRows: "repeat(4, 1fr)" }}
              >
                {["1","2","3","4","5","6","7","8","9","취소","0","del"].map((k) => {
                  const isAction = k === "취소" || k === "del";
                  return (
                    <button
                      key={k}
                      onClick={() => k === "취소" ? handleKey("clear") : handleKey(k)}
                      className="flex items-center justify-center rounded-2xl font-semibold transition-all active:scale-95"
                      style={{
                        background: isAction ? "#181818" : "#1c1c1c",
                        border: "1px solid #2a2a2a",
                        color: isAction ? "#666" : "white",
                        fontSize: k === "취소" ? 13 : 24,
                        WebkitTapHighlightColor: "transparent",
                      }}
                      onTouchStart={(e) => { (e.currentTarget as HTMLElement).style.background = "#303030"; }}
                      onTouchEnd={(e) => { (e.currentTarget as HTMLElement).style.background = isAction ? "#181818" : "#1c1c1c"; }}
                    >
                      {k === "del" ? (
                        <svg width="24" height="18" viewBox="0 0 24 18" fill="none">
                          <path d="M9 1H23V17H9L1 9L9 1Z" stroke="#666" strokeWidth="1.5"/>
                          <line x1="11" y1="6" x2="17" y2="12" stroke="#666" strokeWidth="1.5" strokeLinecap="round"/>
                          <line x1="17" y1="6" x2="11" y2="12" stroke="#666" strokeWidth="1.5" strokeLinecap="round"/>
                        </svg>
                      ) : k}
                    </button>
                  );
                })}
              </div>

              {/* 출입하기 버튼 */}
              <button
                onClick={handleSubmit}
                disabled={!isReady || checkIn.isPending}
                className="w-full rounded-2xl font-bold transition-all active:scale-[0.98] flex items-center justify-center gap-3"
                style={{
                  height: 58,
                  fontSize: 17,
                  background: isReady ? "#ffffff" : "#1c1c1c",
                  color: isReady ? "#0d0d0d" : "#333",
                  border: "none",
                  letterSpacing: "0.08em",
                  WebkitTapHighlightColor: "transparent",
                  marginBottom: 8,
                }}
              >
                {checkIn.isPending ? "확인 중..." : (
                  <>
                    출입하기
                    <svg width="18" height="14" viewBox="0 0 18 14" fill="none">
                      <line x1="0" y1="7" x2="16" y2="7" stroke={isReady ? "#0d0d0d" : "#333"} strokeWidth="2" strokeLinecap="round"/>
                      <polyline points="10,1 16,7 10,13" stroke={isReady ? "#0d0d0d" : "#333"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                    </svg>
                  </>
                )}
              </button>
            </div>
          )}

          {/* QR 탭: 준비중 안내 */}
          {activeTab === "qr" && (
            <div className="flex-1 flex items-center justify-center">
              <p style={{ color: "#444", fontSize: 14 }}>서비스 준비 중입니다</p>
            </div>
          )}
        </div>
      )}

      {/* ── 다른 탭 자리표시자 ── */}
      {bottomNav !== "home" && (
        <div className="flex-1 flex flex-col items-center justify-center gap-3">
          <p className="text-gray-600 text-sm">준비 중입니다</p>
          <button onClick={() => setBottomNav("home")} className="text-white text-sm underline">홈으로</button>
        </div>
      )}

      {/* ── 하단 네비게이션 ── */}
      <div
        className="flex"
        style={{ background: "#111111", borderTop: "1px solid #222", paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        {([
          ["home", "홈", HomeIcon],
          ["locker", "락커현황", LockerIcon],
          ["search", "회원검색", SearchIcon],
          ["logs", "출입기록", LogIcon],
          ["more", "더보기", MoreIcon],
        ] as [BottomNav, string, (a:{active:boolean})=>JSX.Element][]).map(([id, label, Icon]) => (
          <button
            key={id}
            onClick={() => setBottomNav(id)}
            className="flex-1 flex flex-col items-center justify-center py-3 gap-1"
            style={{ WebkitTapHighlightColor: "transparent" }}
          >
            <Icon active={bottomNav === id} />
            <span style={{ fontSize: 10, color: bottomNav === id ? "white" : "#555", fontWeight: bottomNav === id ? 600 : 400 }}>{label}</span>
          </button>
        ))}
      </div>

      {/* ── 결과 팝업 ── */}
      {showPopup && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center"
          style={{ background: "rgba(0,0,0,0.9)" }}
          onClick={handleClose}
        >
          <div
            className="w-full rounded-t-3xl relative overflow-hidden"
            style={{ background: "#141414", border: "1px solid rgba(255,255,255,0.06)", maxHeight: "85vh", overflowY: "auto" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-center pt-3 pb-1">
              <div style={{ width: 36, height: 4, borderRadius: 2, background: "#2a2a2a" }} />
            </div>
            <button
              onClick={handleClose}
              className="absolute top-4 right-4 z-10 flex items-center justify-center rounded-full"
              style={{ width: 28, height: 28, background: "rgba(255,255,255,0.08)" }}
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <line x1="1" y1="1" x2="9" y2="9" stroke="#aaa" strokeWidth="1.5" strokeLinecap="round"/>
                <line x1="9" y1="1" x2="1" y2="9" stroke="#aaa" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>

            {errorMsg ? <ErrorCard msg={errorMsg} />
              : result?.result === "not_found" ? <NotFoundCard />
              : result?.result === "blocked" ? <BlockedCard name={result.member!.name} now={now} branchName={result.branchName} />
              : result ? <MemberCard result={result} now={now} expired={result.result === "expired"} />
              : null}

            {/* 카운트다운 바 */}
            <div style={{ height: 3, background: "#1e1e1e" }}>
              <div style={{ height: "100%", width: `${(countdown / 10) * 100}%`, background: "white", transition: "width 1s linear" }} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── 하단 네비 아이콘 ── */
function HomeIcon({ active }: { active: boolean }) {
  const c = active ? "white" : "#555";
  return <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><path d="M1 10L11 2L21 10V20C21 20.55 20.55 21 20 21H14V15H8V21H2C1.45 21 1 20.55 1 20V10Z" stroke={c} strokeWidth="1.5" fill="none"/></svg>;
}
function LockerIcon({ active }: { active: boolean }) {
  const c = active ? "white" : "#555";
  return <svg width="20" height="22" viewBox="0 0 20 22" fill="none"><rect x="1" y="6" width="18" height="15" rx="2" stroke={c} strokeWidth="1.5"/><path d="M6 6V4C6 2.34 7.34 1 9 1H11C12.66 1 14 2.34 14 4V6" stroke={c} strokeWidth="1.5" strokeLinecap="round"/><circle cx="10" cy="13.5" r="2" stroke={c} strokeWidth="1.5"/></svg>;
}
function SearchIcon({ active }: { active: boolean }) {
  const c = active ? "white" : "#555";
  return <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><circle cx="9" cy="9" r="7" stroke={c} strokeWidth="1.5"/><line x1="14" y1="14" x2="21" y2="21" stroke={c} strokeWidth="1.5" strokeLinecap="round"/><circle cx="9" cy="7" r="2.5" stroke={c} strokeWidth="1"/><path d="M4 13C4 10.5 6.5 9 9 9C11.5 9 14 10.5 14 13" stroke={c} strokeWidth="1" strokeLinecap="round"/></svg>;
}
function LogIcon({ active }: { active: boolean }) {
  const c = active ? "white" : "#555";
  return <svg width="20" height="22" viewBox="0 0 20 22" fill="none"><rect x="1" y="1" width="18" height="20" rx="2" stroke={c} strokeWidth="1.5"/><line x1="5" y1="7" x2="15" y2="7" stroke={c} strokeWidth="1.2" strokeLinecap="round"/><line x1="5" y1="11" x2="15" y2="11" stroke={c} strokeWidth="1.2" strokeLinecap="round"/><line x1="5" y1="15" x2="10" y2="15" stroke={c} strokeWidth="1.2" strokeLinecap="round"/></svg>;
}
function MoreIcon({ active }: { active: boolean }) {
  const c = active ? "white" : "#555";
  return <svg width="22" height="6" viewBox="0 0 22 6" fill="none"><circle cx="3" cy="3" r="2" stroke={c} strokeWidth="1.5"/><circle cx="11" cy="3" r="2" stroke={c} strokeWidth="1.5"/><circle cx="19" cy="3" r="2" stroke={c} strokeWidth="1.5"/></svg>;
}

/* ── 카드 컴포넌트 ── */
function MemberCard({ result, now, expired }: { result: NonNullable<CheckResult>; now: Date; expired: boolean }) {
  const m = result.member!;
  return (
    <div>
      {/* 헤더 */}
      <div className="px-5 pt-4 pb-5">
        <div className="flex items-center gap-4">
          <div
            className="shrink-0 flex items-center justify-center rounded-2xl"
            style={{ width: 56, height: 56, background: expired ? "rgba(180,0,0,0.2)" : "rgba(255,255,255,0.08)", border: `1px solid ${expired ? "rgba(180,0,0,0.4)" : "rgba(255,255,255,0.1)"}` }}
          >
            <svg width="26" height="28" viewBox="0 0 26 28" fill="none">
              <circle cx="13" cy="9" r="6.5" stroke={expired ? "#cc3333" : "white"} strokeWidth="1.5"/>
              <path d="M2 27C2 20 24 20 24 27" stroke={expired ? "#cc3333" : "white"} strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p style={{ fontSize: 20, fontWeight: 700, color: "white" }}>
                {m.name}<span style={{ color: "#888", fontWeight: 400, fontSize: 16 }}>님</span>
              </p>
              {result.branchName && (
                <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 5, background: "rgba(255,255,255,0.1)", color: "#aaa", fontWeight: 500 }}>
                  {result.branchName}
                </span>
              )}
            </div>
            <p style={{ color: "#555", fontSize: 12, marginTop: 2 }}>{fmtDate(now)} {fmtTime(now)}</p>
          </div>
          <div className="ml-auto text-right">
            {expired ? (
              <span style={{ fontSize: 13, color: "#ff4444", fontWeight: 600, background: "rgba(180,0,0,0.15)", padding: "4px 10px", borderRadius: 6 }}>만료</span>
            ) : (
              <span style={{ fontSize: 13, color: "white", fontWeight: 600, background: "rgba(255,255,255,0.1)", padding: "4px 10px", borderRadius: 6 }}>입장</span>
            )}
          </div>
        </div>
      </div>

      <div style={{ height: 1, background: "#1e1e1e" }} />

      {/* 회원권 */}
      <div className="px-5 py-4">
        <p style={{ fontSize: 11, color: "#555", letterSpacing: "0.1em", marginBottom: 12 }}>이용권</p>
        <div className="space-y-2">
          <Row label="현재 회원권" value={m.membershipType ?? "-"} />
          {m.membershipEnd && (
            <Row
              label="만료일"
              value={m.membershipEnd}
              tag={daysUntil(m.membershipEnd) <= 7 ? `D-${daysUntil(m.membershipEnd)}` : undefined}
              tagColor="#ff8800"
            />
          )}
          {m.ptPackage && (
            <>
              <Row label="PT 패키지" value={m.ptPackage.name ?? "-"} />
              <Row label="잔여 횟수" value={`${m.ptPackage.remainingSessions}회`} />
              {m.ptPackage.expiryDate && <Row label="PT 만료일" value={m.ptPackage.expiryDate} />}
            </>
          )}
        </div>
      </div>

      <div style={{ height: 1, background: "#1e1e1e" }} />

      {/* 락커 */}
      <div className="px-5 py-4">
        <p style={{ fontSize: 11, color: "#555", letterSpacing: "0.1em", marginBottom: 12 }}>락커</p>
        <div className="space-y-2">
          <Row
            label="개인 락커"
            value={result.locker ? `${result.locker.lockerNumber}번` : "미사용"}
            tag={result.locker ? "사용중" : undefined}
            tagColor={result.locker ? "#333" : undefined}
          />
          {result.locker?.endDate && <Row label="만료일" value={result.locker.endDate} />}
        </div>
      </div>

      <div style={{ height: 16 }} />
    </div>
  );
}

function Row({ label, value, tag, tagColor }: { label: string; value: string; tag?: string; tagColor?: string }) {
  return (
    <div className="flex justify-between items-center">
      <span style={{ color: "#666", fontSize: 13 }}>{label}</span>
      <div className="flex items-center gap-2">
        <span style={{ color: "white", fontSize: 13, fontWeight: 500 }}>{value}</span>
        {tag && <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 4, background: tagColor ?? "#333", color: "white" }}>{tag}</span>}
      </div>
    </div>
  );
}

function NotFoundCard() {
  return (
    <div className="flex flex-col items-center py-12 px-6 text-center">
      <div className="flex items-center justify-center rounded-full mb-5" style={{ width: 72, height: 72, background: "#1c1c1c", border: "1px solid #2a2a2a" }}>
        <svg width="30" height="30" viewBox="0 0 30 30" fill="none">
          <circle cx="15" cy="15" r="13" stroke="#555" strokeWidth="1.5"/>
          <line x1="10" y1="10" x2="20" y2="20" stroke="#555" strokeWidth="1.5" strokeLinecap="round"/>
          <line x1="20" y1="10" x2="10" y2="20" stroke="#555" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </div>
      <p className="font-bold text-white" style={{ fontSize: 17 }}>등록된 회원을 찾을 수 없습니다</p>
      <p style={{ color: "#555", fontSize: 13, marginTop: 6 }}>전화번호를 다시 확인해주세요</p>
    </div>
  );
}

function BlockedCard({ name, now, branchName }: { name: string; now: Date; branchName?: string | null }) {
  return (
    <div className="px-5 pt-5 pb-8">
      <div className="flex items-center gap-2">
        <p style={{ fontSize: 20, fontWeight: 700 }}>{name}<span style={{ color: "#888", fontWeight: 400, fontSize: 16 }}>님</span></p>
        {branchName && <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 5, background: "rgba(255,255,255,0.1)", color: "#aaa" }}>{branchName}</span>}
      </div>
      <p style={{ color: "#555", fontSize: 12, marginTop: 4, marginBottom: 20 }}>{fmtDate(now)} {fmtTime(now)}</p>
      <div className="rounded-2xl px-5 py-5 text-center" style={{ background: "rgba(140,0,0,0.15)", border: "1px solid rgba(160,0,0,0.3)" }}>
        <p className="font-bold" style={{ color: "#ff4444", fontSize: 16 }}>출입이 제한된 회원입니다</p>
        <p style={{ color: "#884444", fontSize: 13, marginTop: 6 }}>관리자에게 문의해주세요</p>
      </div>
    </div>
  );
}

function ErrorCard({ msg }: { msg: string }) {
  return (
    <div className="flex flex-col items-center py-12 px-6 text-center">
      <div className="flex items-center justify-center rounded-full mb-5" style={{ width: 72, height: 72, background: "#1c1c1c" }}>
        <svg width="30" height="30" viewBox="0 0 30 30" fill="none">
          <circle cx="15" cy="15" r="13" stroke="#666" strokeWidth="1.5"/>
          <line x1="15" y1="8" x2="15" y2="17" stroke="#666" strokeWidth="2" strokeLinecap="round"/>
          <circle cx="15" cy="21" r="1.5" fill="#666"/>
        </svg>
      </div>
      <p className="font-bold text-white" style={{ fontSize: 15 }}>오류가 발생했습니다</p>
      <p style={{ color: "#555", fontSize: 12, marginTop: 6 }}>{msg}</p>
    </div>
  );
}
