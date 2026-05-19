import { useState, useEffect, useCallback, useRef } from "react";
import { trpc } from "../lib/trpc";

type Banner = {
  id: number;
  title: string;
  body: string | null;
  imageUrl: string | null;
  bgColor: string;
  textColor: string;
  sortOrder: number;
};

type CheckResult = {
  result: string;
  branchName?: string | null;
  candidates?: { id: number; name: string }[];
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

type KioskTab = "phone" | "number";
type BottomNav = "home" | "locker" | "search" | "logs" | "more";

export default function KioskCheckin() {
  const [digits, setDigits] = useState("");
  const [result, setResult] = useState<CheckResult>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [activeTab, setActiveTab] = useState<KioskTab>("phone");
  const [bottomNav, setBottomNav] = useState<BottomNav>("home");
  const [bannerIdx, setBannerIdx] = useState(0);
  const bannerTouchX = useRef<number | null>(null);
  const now = useClock();

  const bannersQuery = trpc.access.getBanners.useQuery(undefined, { refetchInterval: 60000 });
  const banners = (bannersQuery.data ?? []) as Banner[];

  useEffect(() => {
    if (banners.length <= 1) return;
    const t = setInterval(() => setBannerIdx((i) => (i + 1) % banners.length), 5000);
    return () => clearInterval(t);
  }, [banners.length]);

  const checkIn = trpc.access.checkIn.useMutation({
    onSuccess: (data) => {
      setErrorMsg(null);
      setResult(data as CheckResult);
      // ambiguous(이름 선택)는 카운트다운 없이 대기
      if ((data as any).result !== "ambiguous") setCountdown(10);
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
    const max = activeTab === "number" ? 5 : 8;
    if (digits.length >= max) return;
    setDigits((v) => v + k);
  }, [digits, result, errorMsg, activeTab]);

  const handleSubmit = useCallback(() => {
    if (checkIn.isPending) return;
    if (activeTab === "phone") {
      if (digits.length !== 8) return;
      checkIn.mutate({ phone: "010" + digits });
    } else {
      if (digits.length < 4) return;
      checkIn.mutate({ attendanceNumber: digits });
    }
  }, [digits, checkIn, activeTab]);

  const handleClose = useCallback(() => {
    setResult(null); setErrorMsg(null); setDigits(""); setCountdown(0);
  }, []);

  // ── 안드로이드 뒤로 버튼 처리 ─────────────────────────────────────────────
  const backStateRef = useRef({ result, errorMsg, bottomNav });
  useEffect(() => { backStateRef.current = { result, errorMsg, bottomNav }; }, [result, errorMsg, bottomNav]);

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

  // 휴대폰번호 표시: 010 - XXXX - XXXX
  const a = digits.slice(0, 4);
  const b = digits.slice(4, 8);
  const aDisplay = a.padEnd(4, "_").split("").join(" ");
  const bDisplay = b.padEnd(4, "_").split("").join(" ");

  // 출석번호 표시: 4자리 + 선택적 5번째 자리
  const numBase = digits.padEnd(4, "_").slice(0, 4).split("").join(" ");
  const numSuffix = digits.length > 4 ? ` - ${digits[4]}` : "";
  const numDisplay = numBase + numSuffix;

  const showPopup = result !== null || errorMsg !== null;

  return (
    <div
      className="fixed inset-0 flex flex-col overflow-hidden select-none"
      style={{ background: "#0d0d0d", fontFamily: "'Apple SD Gothic Neo','Noto Sans KR',sans-serif", color: "white" }}
    >
      {/* ── 메인 컨텐츠 ── */}
      {bottomNav === "home" && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* ── 배너 캐러셀 ── */}
          <div
            className="relative overflow-hidden shrink-0"
            style={{ height: "38vh" }}
            onTouchStart={(e) => { bannerTouchX.current = e.touches[0].clientX; }}
            onTouchEnd={(e) => {
              if (bannerTouchX.current === null || banners.length <= 1) return;
              const dx = e.changedTouches[0].clientX - bannerTouchX.current;
              bannerTouchX.current = null;
              if (Math.abs(dx) < 30) return;
              setBannerIdx((i) => dx < 0 ? (i + 1) % banners.length : (i - 1 + banners.length) % banners.length);
            }}
          >
            {banners.length === 0 ? (
              /* 배너 없을 때 기본 안내 화면 */
              <div
                className="absolute inset-0 flex flex-col justify-center items-center px-6"
                style={{ background: "linear-gradient(160deg, #111827 0%, #1e293b 100%)" }}
              >
                <p style={{ fontSize: 12, color: "#4b5563", letterSpacing: "0.2em", marginBottom: 12 }}>NOTICE</p>
                <p style={{ fontSize: 16, color: "#6b7280", textAlign: "center", lineHeight: 1.7 }}>
                  공지사항이 없습니다
                </p>
                <p style={{ fontSize: 11, color: "#374151", marginTop: 10 }}>관리자 페이지 → 출입관리 → 배너 관리에서 등록</p>
              </div>
            ) : (
              banners.map((b, i) => (
                <div
                  key={b.id}
                  className="absolute inset-0 flex flex-col justify-end transition-opacity duration-700"
                  style={{
                    opacity: i === bannerIdx ? 1 : 0,
                    pointerEvents: i === bannerIdx ? "auto" : "none",
                    background: b.imageUrl
                      ? `linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.55) 100%), url(${b.imageUrl}) center/cover no-repeat`
                      : b.bgColor,
                  }}
                >
                  <div className="px-5 pb-4 pt-8">
                    <p
                      className="font-bold leading-snug"
                      style={{ fontSize: 20, color: b.textColor, textShadow: b.imageUrl ? "0 1px 4px rgba(0,0,0,0.6)" : "none" }}
                    >
                      {b.title}
                    </p>
                    {b.body && (
                      <p
                        className="mt-1 leading-relaxed whitespace-pre-line"
                        style={{ fontSize: 13, color: b.textColor, opacity: 0.85, textShadow: b.imageUrl ? "0 1px 3px rgba(0,0,0,0.5)" : "none" }}
                      >
                        {b.body}
                      </p>
                    )}
                  </div>
                  {/* 점 인디케이터 */}
                  {banners.length > 1 && (
                    <div className="flex justify-center gap-1.5 pb-3">
                      {banners.map((_, di) => (
                        <button
                          key={di}
                          onClick={() => setBannerIdx(di)}
                          style={{
                            width: di === bannerIdx ? 16 : 6,
                            height: 6,
                            borderRadius: 3,
                            background: di === bannerIdx ? b.textColor : "rgba(255,255,255,0.35)",
                            transition: "width 0.3s",
                            border: "none",
                            padding: 0,
                          }}
                        />
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          {/* 헤더 */}
          <div className="flex flex-col items-center pt-4 pb-3 relative" style={{ borderBottom: "1px solid #1c1c1c" }}>
            <p style={{ fontFamily: "'Cinzel', serif", fontSize: 30, fontWeight: 900, color: "#2a5fc4", letterSpacing: "0.28em", textShadow: "0 0 18px rgba(42,95,196,0.45)" }}>ZIANTGYM</p>
            <p className="mt-1 tracking-[0.15em] text-gray-500" style={{ fontSize: 10 }}>ACCESS SYSTEM</p>
          </div>

          {/* 탭 */}
          <div className="flex" style={{ borderBottom: "1px solid #1e1e1e" }}>
            {([["number","출석번호"], ["phone","휴대폰번호"]] as [KioskTab,string][]).map(([id, label]) => (
              <button
                key={id}
                onClick={() => { setActiveTab(id); setDigits(""); }}
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

          {/* 번호 표시 */}
          <div className="text-center py-5">
            {activeTab === "phone" ? (
              <span className="font-mono font-bold tracking-widest whitespace-nowrap" style={{ fontSize: 26, color: "white", letterSpacing: "0.08em" }}>
                010 - {aDisplay} - {bDisplay}
              </span>
            ) : (
              <span className="font-mono font-bold whitespace-nowrap" style={{ fontSize: 30, color: "white", letterSpacing: "0.18em" }}>
                {numDisplay}
              </span>
            )}
          </div>

          {/* 키패드 */}
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
              disabled={(activeTab === "phone" ? digits.length !== 8 : digits.length < 4) || checkIn.isPending}
              className="w-full rounded-2xl font-bold transition-all active:scale-[0.98] flex items-center justify-center gap-3"
              style={{
                height: 58,
                fontSize: 17,
                background: (activeTab === "phone" ? digits.length === 8 : digits.length >= 4) ? "#ffffff" : "#1c1c1c",
                color: (activeTab === "phone" ? digits.length === 8 : digits.length >= 4) ? "#0d0d0d" : "#333",
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
                    {(() => { const active = activeTab === "phone" ? digits.length === 8 : digits.length >= 4; return (<><line x1="0" y1="7" x2="16" y2="7" stroke={active ? "#0d0d0d" : "#333"} strokeWidth="2" strokeLinecap="round"/><polyline points="10,1 16,7 10,13" stroke={active ? "#0d0d0d" : "#333"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/></>); })()}
                  </svg>
                </>
              )}
            </button>
          </div>
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
              : result?.result === "ambiguous" ? (
                <AmbiguousCard
                  candidates={result.candidates ?? []}
                  onSelect={(id) => {
                    setResult(null);
                    checkIn.mutate({ memberId: id });
                  }}
                  onCancel={handleClose}
                />
              )
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

function AmbiguousCard({
  candidates,
  onSelect,
  onCancel,
}: {
  candidates: { id: number; name: string }[];
  onSelect: (id: number) => void;
  onCancel: () => void;
}) {
  return (
    <div className="px-5 pt-5 pb-6">
      <div className="flex flex-col items-center mb-6">
        <div
          className="flex items-center justify-center rounded-full mb-4"
          style={{ width: 56, height: 56, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
        >
          <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
            <circle cx="13" cy="8" r="5.5" stroke="white" strokeWidth="1.5"/>
            <path d="M2 25C2 18.5 24 18.5 24 25" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </div>
        <p style={{ fontSize: 17, fontWeight: 700, color: "white" }}>본인 이름을 선택해주세요</p>
        <p style={{ fontSize: 13, color: "#555", marginTop: 4 }}>동일한 출석번호를 가진 회원이 있습니다</p>
      </div>

      <div className="flex flex-col gap-3">
        {candidates.map((c) => (
          <button
            key={c.id}
            onClick={() => onSelect(c.id)}
            className="w-full rounded-2xl font-bold transition-all active:scale-[0.98]"
            style={{
              height: 60,
              fontSize: 18,
              background: "#1c1c1c",
              border: "1px solid #2a2a2a",
              color: "white",
              WebkitTapHighlightColor: "transparent",
            }}
            onTouchStart={(e) => { (e.currentTarget as HTMLElement).style.background = "#303030"; }}
            onTouchEnd={(e) => { (e.currentTarget as HTMLElement).style.background = "#1c1c1c"; }}
          >
            {c.name}
          </button>
        ))}

        <button
          onClick={onCancel}
          className="w-full rounded-2xl font-semibold transition-all active:scale-[0.98] mt-1"
          style={{
            height: 48,
            fontSize: 14,
            background: "transparent",
            border: "1px solid #2a2a2a",
            color: "#555",
            WebkitTapHighlightColor: "transparent",
          }}
        >
          취소
        </button>
      </div>
    </div>
  );
}
