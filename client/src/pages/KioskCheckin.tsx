import { useState, useEffect, useCallback, useRef, createContext, useContext } from "react";
import { trpc } from "../lib/trpc";

// ── 폰트 스케일 컨텍스트 ───────────────────────────────────────────────────
const ScaleCtx = createContext(1);
function useFs() {
  const scale = useContext(ScaleCtx);
  return (n: number) => Math.round(n * scale);
}

type Banner = {
  id: number;
  title: string;
  body: string | null;
  imageUrl: string | null;
  bgColor: string;
  textColor: string;
  sortOrder: number;
  textAlign?: string | null;
  textVAlign?: string | null;
  titleFontSize?: number | null;
  bodyFontSize?: number | null;
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

function PhoneSegment({ value }: { value: string }) {
  const fs = useFs();
  return (
    <div className="flex items-end gap-1" style={{ minWidth: 4 }}>
      {value.split("").map((d, i) => (
        <span key={i} className="font-mono font-bold" style={{ fontSize: fs(40), color: "white", lineHeight: 1 }}>{d}</span>
      ))}
    </div>
  );
}

// ZIANTGYM 로고 SVG — 바벨 + Z 구조 (|H-Z-H|)
function ZiantLogo({ size = 36, color = "white" }: { size?: number; color?: string }) {
  const w = Math.round(size * 2.75);
  return (
    <svg width={w} height={size} viewBox="0 0 220 80" fill="none">
      <rect x="1" y="20" width="11" height="40" rx="3" fill={color}/>
      <rect x="18" y="10" width="14" height="60" rx="3" fill={color}/>
      <rect x="36" y="10" width="14" height="60" rx="3" fill={color}/>
      <rect x="18" y="33" width="32" height="14" fill={color}/>
      <polygon points="50,10 162,10 162,22 100,22 162,58 162,70 50,70 50,58 112,58 50,22" fill={color}/>
      <rect x="164" y="10" width="14" height="60" rx="3" fill={color}/>
      <rect x="182" y="10" width="14" height="60" rx="3" fill={color}/>
      <rect x="164" y="33" width="32" height="14" fill={color}/>
      <rect x="208" y="20" width="11" height="40" rx="3" fill={color}/>
    </svg>
  );
}

type KioskTab = "phone" | "number";
type BottomNav = "home" | "locker" | "search" | "logs" | "more";

// ── 글씨 크기 설정 패널 ────────────────────────────────────────────────────
function ScaleRow({ label, scale, onChange }: { label: string; scale: number; onChange: (v: number) => void }) {
  const presets = [
    { label: "작게", value: 0.7 },
    { label: "보통", value: 1.0 },
    { label: "크게", value: 1.3 },
    { label: "매우 크게", value: 1.6 },
  ];
  return (
    <div className="flex flex-col gap-3">
      <p style={{ fontSize: 13, color: "#888", fontWeight: 600, letterSpacing: "0.05em" }}>{label}</p>
      <div className="grid grid-cols-4 gap-2">
        {presets.map((p) => (
          <button
            key={p.value}
            onClick={() => onChange(p.value)}
            style={{
              padding: "8px 0", borderRadius: 10,
              background: Math.abs(scale - p.value) < 0.05 ? "white" : "#252525",
              color: Math.abs(scale - p.value) < 0.05 ? "#0d0d0d" : "#888",
              border: "1px solid #333", fontSize: 12, fontWeight: 600, cursor: "pointer",
            }}
          >{p.label}</button>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={() => onChange(Math.round((scale - 0.1) * 10) / 10)}
          disabled={scale <= 0.5}
          style={{ width: 48, height: 48, borderRadius: 12, fontSize: 26, fontWeight: 300, background: "#252525", border: "1px solid #333", color: scale <= 0.5 ? "#333" : "white", cursor: "pointer" }}
        >−</button>
        <div className="flex-1 text-center">
          <p style={{ fontSize: 28, fontWeight: 800, color: "white", lineHeight: 1 }}>{Math.round(scale * 100)}%</p>
        </div>
        <button
          onClick={() => onChange(Math.round((scale + 0.1) * 10) / 10)}
          disabled={scale >= 2.5}
          style={{ width: 48, height: 48, borderRadius: 12, fontSize: 26, fontWeight: 300, background: "#252525", border: "1px solid #333", color: scale >= 2.5 ? "#333" : "white", cursor: "pointer" }}
        >+</button>
      </div>
    </div>
  );
}

function FontSettingsPanel({ bannerScale, onBannerChange, uiScale, onUiChange, onClose }: {
  bannerScale: number; onBannerChange: (v: number) => void;
  uiScale: number; onUiChange: (v: number) => void;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.85)" }}
      onClick={onClose}
    >
      <div
        className="flex flex-col gap-5 rounded-3xl"
        style={{ background: "#181818", border: "1px solid #2a2a2a", padding: 28, minWidth: 320, maxWidth: "90vw" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <p style={{ fontSize: 20, fontWeight: 700, color: "white" }}>글씨 크기 설정</p>
          <button onClick={onClose} style={{ color: "#666", fontSize: 22, background: "none", border: "none", cursor: "pointer", lineHeight: 1 }}>✕</button>
        </div>

        <ScaleRow label="배너 · 공지 영역" scale={bannerScale} onChange={onBannerChange} />
        <div style={{ height: 1, background: "#222" }} />
        <ScaleRow label="출입 팝업 · 키패드" scale={uiScale} onChange={onUiChange} />

        <button
          onClick={onClose}
          style={{ padding: "14px 0", borderRadius: 14, background: "white", color: "#0d0d0d", fontSize: 15, fontWeight: 700, border: "none", cursor: "pointer" }}
        >
          적용
        </button>
      </div>
    </div>
  );
}

export default function KioskCheckin() {
  const branchId = (() => {
    const p = new URLSearchParams(window.location.search).get("b");
    return p ? parseInt(p) : undefined;
  })();

  const [digits, setDigits] = useState("");
  const [result, setResult] = useState<CheckResult>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [activeTab, setActiveTab] = useState<KioskTab>("phone");
  const [bottomNav, setBottomNav] = useState<BottomNav>("home");
  const [bannerIdx, setBannerIdx] = useState(0);
  const bannerTouchX = useRef<number | null>(null);
  const now = useClock();

  // 글씨 크기 설정 — UI(팝업·키패드)
  const [fontScale, setFontScale] = useState<number>(() => {
    try { const s = localStorage.getItem("kiosk_font_scale"); return s ? parseFloat(s) : 1; } catch { return 1; }
  });
  // 글씨 크기 설정 — 배너·공지
  const [bannerScale, setBannerScale] = useState<number>(() => {
    try { const s = localStorage.getItem("kiosk_banner_scale"); return s ? parseFloat(s) : 1; } catch { return 1; }
  });
  const [showFontSettings, setShowFontSettings] = useState(false);
  const fs = (n: number) => Math.round(n * fontScale);
  const bfs = (n: number) => Math.round(n * bannerScale);
  const updateUiScale = (v: number) => {
    const c = Math.max(0.5, Math.min(2.5, Math.round(v * 10) / 10));
    setFontScale(c);
    try { localStorage.setItem("kiosk_font_scale", String(c)); } catch {}
  };
  const updateBannerScale = (v: number) => {
    const c = Math.max(0.5, Math.min(2.5, Math.round(v * 10) / 10));
    setBannerScale(c);
    try { localStorage.setItem("kiosk_banner_scale", String(c)); } catch {}
  };

  // 설정 버튼 5회 탭 카운터
  const settingsTapRef = useRef(0);
  const settingsTapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleSettingsTap = () => {
    settingsTapRef.current += 1;
    if (settingsTapTimer.current) clearTimeout(settingsTapTimer.current);
    if (settingsTapRef.current >= 3) {
      settingsTapRef.current = 0;
      setShowFontSettings(true);
    } else {
      settingsTapTimer.current = setTimeout(() => { settingsTapRef.current = 0; }, 1500);
    }
  };

  useEffect(() => {
    const link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    const prev = link?.href ?? "";
    if (link) link.href = "/manifest-kiosk.json";
    const appleMeta = document.querySelector<HTMLMetaElement>('meta[name="apple-mobile-web-app-title"]');
    const prevTitle = appleMeta?.content ?? "";
    if (appleMeta) appleMeta.content = "키오스크";
    return () => {
      if (link) link.href = prev;
      if (appleMeta) appleMeta.content = prevTitle;
    };
  }, []);

  const bannersQuery = trpc.access.getBanners.useQuery({ branchId }, {
    refetchInterval: 10000,
    staleTime: 0,
    gcTime: 0,
    retry: 3,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });
  const today = new Date().toISOString().substring(0, 10);
  const banners = ((bannersQuery.data ?? []) as Banner[]).filter((b: any) => {
    if (b.startDate && b.startDate > today) return false;
    if (b.endDate && b.endDate < today) return false;
    return true;
  });

  useEffect(() => {
    if (banners.length <= 1) return;
    const t = setInterval(() => setBannerIdx((i) => (i + 1) % banners.length), 5000);
    return () => clearInterval(t);
  }, [banners.length]);

  const playSound = (type: "success" | "fail") => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const t = ctx.currentTime;

      const note = (freq: number, start: number, dur: number, vol: number, wave: OscillatorType = "sine") => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = wave;
        osc.frequency.setValueAtTime(freq, t + start);
        gain.gain.setValueAtTime(0, t + start);
        gain.gain.linearRampToValueAtTime(vol, t + start + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, t + start + dur);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t + start);
        osc.stop(t + start + dur);
      };

      if (type === "success") {
        // 밝은 3음 상승 아르페지오 (C5 → E5 → G5)
        note(523, 0,    0.18, 0.35);
        note(659, 0.13, 0.18, 0.35);
        note(784, 0.26, 0.35, 0.4);
      } else {
        // 낮고 무거운 2음 하강 버저
        note(300, 0,    0.22, 0.45, "square");
        note(200, 0.20, 0.35, 0.5,  "square");
      }
    } catch {}
  };

  const checkIn = trpc.access.checkIn.useMutation({
    onSuccess: (data) => {
      setErrorMsg(null);
      setResult(data as CheckResult);
      const r = (data as any).result;
      if (r === "allowed") playSound("success");
      else if (r === "not_found" || r === "expired" || r === "blocked") playSound("fail");
      if (r !== "ambiguous") setCountdown(20);
    },
    onError: (err) => {
      playSound("fail");
      setErrorMsg(err.message || "서버 오류가 발생했습니다.");
      setCountdown(10);
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

  const a = digits.slice(0, 4);
  const b = digits.slice(4, 8);

  const showPopup = result !== null || errorMsg !== null;

  return (
    <ScaleCtx.Provider value={fontScale}>
      <div
        className="fixed inset-0 flex flex-col overflow-hidden select-none"
        style={{ background: "#0d0d0d", fontFamily: "'Apple SD Gothic Neo','Noto Sans KR',sans-serif", color: "white" }}
      >
        {/* 글씨 크기 설정 패널 */}
        {showFontSettings && (
          <FontSettingsPanel
            bannerScale={bannerScale}
            onBannerChange={updateBannerScale}
            uiScale={fontScale}
            onUiChange={updateUiScale}
            onClose={() => setShowFontSettings(false)}
          />
        )}

        {/* ── 메인 컨텐츠 ── */}
        {bottomNav === "home" && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* ── 배너 캐러셀 ── */}
            <div
              className="relative overflow-hidden shrink-0"
              style={{ height: "42vh" }}
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
                <div
                  className="absolute inset-0 flex flex-col justify-center items-center px-8"
                  style={{ background: "linear-gradient(160deg, #0f172a 0%, #1e293b 100%)" }}
                >
                  <p style={{ fontSize: bfs(13), color: "#334155", letterSpacing: "0.5em", marginBottom: 18, textTransform: "uppercase", fontWeight: 600 }}>NOTICE</p>
                  <p style={{ fontSize: bfs(34), fontWeight: 800, color: "#e2e8f0", textAlign: "center", lineHeight: 1.4, marginBottom: 14 }}>
                    공지사항이 없습니다
                  </p>
                  <p style={{ fontSize: bfs(15), color: "#475569", textAlign: "center", lineHeight: 1.8 }}>출입관리 → 배너 관리에서 공지를 등록하세요</p>
                </div>
              ) : (
                banners.map((b, i) => (
                  <div
                    key={b.id}
                    className="absolute inset-0 flex flex-col transition-opacity duration-700"
                    style={{
                      opacity: i === bannerIdx ? 1 : 0,
                      pointerEvents: i === bannerIdx ? "auto" : "none",
                      background: b.imageUrl
                        ? `linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.55) 100%), url(${b.imageUrl}) center/cover no-repeat`
                        : b.bgColor,
                      justifyContent: b.textVAlign === "top" ? "flex-start" : b.textVAlign === "bottom" ? "flex-end" : "center",
                      alignItems: b.textAlign === "left" ? "flex-start" : b.textAlign === "right" ? "flex-end" : "center",
                      padding: 24,
                      paddingBottom: 32,
                    }}
                  >
                    <div style={{ width: "100%" }}>
                      <p
                        className="font-bold leading-snug"
                        style={{ fontSize: bfs(b.titleFontSize ?? 22), color: b.textColor, textAlign: (b.textAlign ?? "center") as any, textShadow: b.imageUrl ? "0 1px 4px rgba(0,0,0,0.6)" : "none" }}
                      >
                        {b.title}
                      </p>
                      {b.body && (
                        <p
                          className="mt-2 leading-relaxed whitespace-pre-line"
                          style={{ fontSize: bfs(b.bodyFontSize ?? 15), color: b.textColor, opacity: 0.9, textAlign: (b.textAlign ?? "center") as any, textShadow: b.imageUrl ? "0 1px 3px rgba(0,0,0,0.5)" : "none" }}
                        >
                          {b.body}
                        </p>
                      )}
                    </div>
                    {banners.length > 1 && (
                      <div className="absolute bottom-0 left-0 right-0 flex gap-1 px-3 pb-2">
                        {banners.map((_, di) => (
                          <button
                            key={di}
                            onClick={() => setBannerIdx(di)}
                            style={{
                              flex: 1, height: 3, borderRadius: 2, border: "none", padding: 0,
                              background: di === bannerIdx ? b.textColor : "rgba(255,255,255,0.25)",
                              transition: "background 0.3s",
                            }}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* 헤더 */}
            <div className="flex items-center pt-3 pb-3 relative px-4" style={{ borderBottom: "1px solid #1c1c1c" }}>
              <div className="flex-1 flex flex-col items-center">
                <p
                  style={{ fontSize: fs(30), fontWeight: 900, color: "#2a5fc4", letterSpacing: "0.04em", textShadow: "0 0 18px rgba(42,95,196,0.45)", lineHeight: 1.2 }}
                  onClick={handleSettingsTap}
                >
                  맞춤운동센터 자이언트짐
                </p>
                <p style={{ fontSize: fs(11), color: "#374151", letterSpacing: "0.15em", marginTop: 4 }}>ACCESS SYSTEM</p>
              </div>
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
                    fontSize: fs(16),
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* 번호 표시 */}
            <div className="flex items-center justify-center py-3 gap-4">
              {activeTab === "phone" ? (
                <>
                  <span className="font-mono font-bold" style={{ fontSize: fs(40), color: "white" }}>010</span>
                  <PhoneSegment value={a} />
                  <PhoneSegment value={b} />
                </>
              ) : (
                <div className="flex items-end justify-center gap-2">
                  <PhoneSegment value={digits.slice(0, 4)} />
                  {digits.length > 4 && (
                    <span className="font-mono font-bold" style={{ fontSize: fs(40), color: "white" }}>{digits[4]}</span>
                  )}
                </div>
              )}
            </div>

            {/* 키패드 */}
            <div className="flex-1 flex flex-col px-3 gap-1.5" style={{ minHeight: 0 }}>
              <div
                className="grid gap-1.5 flex-1"
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
                        fontSize: k === "취소" ? fs(17) : fs(32),
                        WebkitTapHighlightColor: "transparent",
                      }}
                      onTouchStart={(e) => { (e.currentTarget as HTMLElement).style.background = "#303030"; }}
                      onTouchEnd={(e) => { (e.currentTarget as HTMLElement).style.background = isAction ? "#181818" : "#1c1c1c"; }}
                    >
                      {k === "del" ? (
                        <svg width="28" height="22" viewBox="0 0 24 18" fill="none">
                          <path d="M9 1H23V17H9L1 9L9 1Z" stroke="#666" strokeWidth="1.5"/>
                          <line x1="11" y1="6" x2="17" y2="12" stroke="#666" strokeWidth="1.5" strokeLinecap="round"/>
                          <line x1="17" y1="6" x2="11" y2="12" stroke="#666" strokeWidth="1.5" strokeLinecap="round"/>
                        </svg>
                      ) : k}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 출입하기 버튼 */}
            <div className="px-4 pb-4 pt-2 shrink-0">
              <button
                onClick={handleSubmit}
                disabled={(activeTab === "phone" ? digits.length !== 8 : digits.length < 4) || checkIn.isPending}
                className="w-full rounded-2xl font-bold transition-all active:scale-[0.98] flex items-center justify-center gap-3"
                style={{
                  height: 100,
                  fontSize: fs(28),
                  background: (activeTab === "phone" ? digits.length === 8 : digits.length >= 4) ? "#FACC15" : "#1c1c1c",
                  color: (activeTab === "phone" ? digits.length === 8 : digits.length >= 4) ? "#0d0d0d" : "#444",
                  border: "none",
                  letterSpacing: "0.1em",
                  WebkitTapHighlightColor: "transparent",
                }}
              >
                {checkIn.isPending ? "확인 중..." : (
                  <>
                    출입하기
                    <svg width="22" height="17" viewBox="0 0 22 17" fill="none">
                      {(() => { const active = activeTab === "phone" ? digits.length === 8 : digits.length >= 4; return (<><line x1="0" y1="8.5" x2="19" y2="8.5" stroke={active ? "#0d0d0d" : "#444"} strokeWidth="2.5" strokeLinecap="round"/><polyline points="12,1 20,8.5 12,16" stroke={active ? "#0d0d0d" : "#444"} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/></>); })()}
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

        {/* ── 결과 팝업 ── */}
        {showPopup && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center"
            style={{ background: "rgba(0,0,0,0.85)" }}
            onClick={handleClose}
          >
            <div
              className="relative flex flex-col overflow-hidden"
              style={{
                width: "88%",
                height: "70vh",
                background: "#141414",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 28,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* 닫기 버튼 */}
              <button
                onClick={handleClose}
                className="absolute top-4 right-4 z-10 flex items-center justify-center rounded-full"
                style={{ width: 36, height: 36, background: "rgba(255,255,255,0.08)" }}
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <line x1="1" y1="1" x2="11" y2="11" stroke="#aaa" strokeWidth="1.8" strokeLinecap="round"/>
                  <line x1="11" y1="1" x2="1" y2="11" stroke="#aaa" strokeWidth="1.8" strokeLinecap="round"/>
                </svg>
              </button>

              {/* 내용 */}
              <div className="flex-1 overflow-y-auto">
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
              </div>

              {/* 카운트다운 바 */}
              <div style={{ height: 4, background: "#1e1e1e", borderRadius: "0 0 28px 28px", flexShrink: 0 }}>
                <div style={{ height: "100%", width: `${(countdown / 20) * 100}%`, background: "white", transition: "width 1s linear", borderRadius: "0 0 0 28px" }} />
              </div>
            </div>
          </div>
        )}
      </div>
    </ScaleCtx.Provider>
  );
}

/* ── 카드 컴포넌트 ── */
function MemberCard({ result, now, expired }: { result: NonNullable<CheckResult>; now: Date; expired: boolean }) {
  const fs = useFs();
  const m = result.member!;
  return (
    <div>
      {/* 헤더 */}
      <div className="px-6 pt-6 pb-5">
        <div className="flex items-center gap-5">
          {/* 아바타 */}
          <div
            className="shrink-0 flex items-center justify-center rounded-2xl"
            style={{ width: 88, height: 88, background: expired ? "rgba(180,0,0,0.2)" : "rgba(255,255,255,0.08)", border: `2px solid ${expired ? "rgba(180,0,0,0.5)" : "rgba(255,255,255,0.12)"}` }}
          >
            <svg width="44" height="48" viewBox="0 0 26 28" fill="none">
              <circle cx="13" cy="9" r="6.5" stroke={expired ? "#cc3333" : "white"} strokeWidth="1.5"/>
              <path d="M2 27C2 20 24 20 24 27" stroke={expired ? "#cc3333" : "white"} strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>
          {/* 이름 + 날짜 */}
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-3 flex-wrap">
              <p style={{ fontSize: fs(80), fontWeight: 800, color: "white", lineHeight: 1 }}>
                {m.name}<span style={{ color: "#777", fontWeight: 400, fontSize: fs(52) }}>님</span>
              </p>
              {result.branchName && (
                <span style={{ fontSize: fs(26), padding: "4px 14px", borderRadius: 8, background: "rgba(255,255,255,0.1)", color: "#bbb", fontWeight: 500, whiteSpace: "nowrap" }}>
                  {result.branchName}
                </span>
              )}
            </div>
            <p style={{ color: "#555", fontSize: fs(32), marginTop: 4 }}>{fmtDate(now)} {fmtTime(now)}</p>
          </div>
          {/* 입장 / 만료 뱃지 */}
          <div className="shrink-0">
            {expired ? (
              <div style={{ minWidth: 120, height: 80, display: "flex", alignItems: "center", justifyContent: "center", fontSize: fs(36), color: "#ff4444", fontWeight: 800, background: "rgba(180,0,0,0.2)", borderRadius: 16, padding: "0 24px", border: "2px solid rgba(180,0,0,0.4)" }}>만료</div>
            ) : (
              <div style={{ minWidth: 120, height: 80, display: "flex", alignItems: "center", justifyContent: "center", fontSize: fs(36), color: "#0d0d0d", fontWeight: 800, background: "#ffffff", borderRadius: 16, padding: "0 24px" }}>입장</div>
            )}
          </div>
        </div>
      </div>

      <div style={{ height: 2, background: "#1e1e1e" }} />

      {/* 회원권 */}
      <div className="px-6 py-5">
        <p style={{ fontSize: fs(28), color: "#444", letterSpacing: "0.08em", marginBottom: 16, fontWeight: 600 }}>이용권</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
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

      <div style={{ height: 2, background: "#1e1e1e" }} />

      {/* 락커 */}
      <div className="px-6 py-5">
        <p style={{ fontSize: fs(28), color: "#444", letterSpacing: "0.08em", marginBottom: 16, fontWeight: 600 }}>락커</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Row
            label="개인 락커"
            value={result.locker ? `${result.locker.lockerNumber}번` : "미사용"}
            tag={result.locker ? "사용중" : undefined}
            tagColor={result.locker ? "#2a5" : undefined}
          />
          {result.locker?.endDate && <Row label="만료일" value={result.locker.endDate} />}
        </div>
      </div>

      <div style={{ height: 20 }} />
    </div>
  );
}

function Row({ label, value, tag, tagColor }: { label: string; value: string; tag?: string; tagColor?: string }) {
  const fs = useFs();
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid #1a1a1a" }}>
      <span style={{ color: "#777", fontSize: fs(36) }}>{label}</span>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ color: "white", fontSize: fs(40), fontWeight: 700 }}>{value}</span>
        {tag && <span style={{ fontSize: fs(26), padding: "4px 14px", borderRadius: 8, background: tagColor ?? "#333", color: "white", fontWeight: 600 }}>{tag}</span>}
      </div>
    </div>
  );
}

function NotFoundCard() {
  const fs = useFs();
  return (
    <div className="flex flex-col items-center py-12 px-6 text-center">
      <div className="flex items-center justify-center rounded-full mb-5" style={{ width: 72, height: 72, background: "#1c1c1c", border: "1px solid #2a2a2a" }}>
        <svg width="30" height="30" viewBox="0 0 30 30" fill="none">
          <circle cx="15" cy="15" r="13" stroke="#555" strokeWidth="1.5"/>
          <line x1="10" y1="10" x2="20" y2="20" stroke="#555" strokeWidth="1.5" strokeLinecap="round"/>
          <line x1="20" y1="10" x2="10" y2="20" stroke="#555" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </div>
      <p className="font-bold text-white" style={{ fontSize: fs(17) }}>등록된 회원을 찾을 수 없습니다</p>
      <p style={{ color: "#555", fontSize: fs(13), marginTop: 6 }}>전화번호를 다시 확인해주세요</p>
    </div>
  );
}

function BlockedCard({ name, now, branchName }: { name: string; now: Date; branchName?: string | null }) {
  const fs = useFs();
  return (
    <div className="px-5 pt-5 pb-8">
      <div className="flex items-center gap-2">
        <p style={{ fontSize: fs(20), fontWeight: 700 }}>{name}<span style={{ color: "#888", fontWeight: 400, fontSize: fs(16) }}>님</span></p>
        {branchName && <span style={{ fontSize: fs(11), padding: "2px 8px", borderRadius: 5, background: "rgba(255,255,255,0.1)", color: "#aaa" }}>{branchName}</span>}
      </div>
      <p style={{ color: "#555", fontSize: fs(12), marginTop: 4, marginBottom: 20 }}>{fmtDate(now)} {fmtTime(now)}</p>
      <div className="rounded-2xl px-5 py-5 text-center" style={{ background: "rgba(140,0,0,0.15)", border: "1px solid rgba(160,0,0,0.3)" }}>
        <p className="font-bold" style={{ color: "#ff4444", fontSize: fs(16) }}>출입이 제한된 회원입니다</p>
        <p style={{ color: "#884444", fontSize: fs(13), marginTop: 6 }}>관리자에게 문의해주세요</p>
      </div>
    </div>
  );
}

function ErrorCard({ msg }: { msg: string }) {
  const fs = useFs();
  return (
    <div className="flex flex-col items-center py-12 px-6 text-center">
      <div className="flex items-center justify-center rounded-full mb-5" style={{ width: 72, height: 72, background: "#1c1c1c" }}>
        <svg width="30" height="30" viewBox="0 0 30 30" fill="none">
          <circle cx="15" cy="15" r="13" stroke="#666" strokeWidth="1.5"/>
          <line x1="15" y1="8" x2="15" y2="17" stroke="#666" strokeWidth="2" strokeLinecap="round"/>
          <circle cx="15" cy="21" r="1.5" fill="#666"/>
        </svg>
      </div>
      <p className="font-bold text-white" style={{ fontSize: fs(15) }}>오류가 발생했습니다</p>
      <p style={{ color: "#555", fontSize: fs(12), marginTop: 6 }}>{msg}</p>
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
  const fs = useFs();
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
        <p style={{ fontSize: fs(17), fontWeight: 700, color: "white" }}>본인 이름을 선택해주세요</p>
        <p style={{ fontSize: fs(13), color: "#555", marginTop: 4 }}>동일한 출석번호를 가진 회원이 있습니다</p>
      </div>

      <div className="flex flex-col gap-3">
        {candidates.map((c) => (
          <button
            key={c.id}
            onClick={() => onSelect(c.id)}
            className="w-full rounded-2xl font-bold transition-all active:scale-[0.98]"
            style={{
              height: 60,
              fontSize: fs(18),
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
            fontSize: fs(14),
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
