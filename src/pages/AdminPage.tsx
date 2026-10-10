import { useState, useEffect } from "react";
import {
  LayoutDashboard, LogOut, RefreshCw, ExternalLink,
  Eye, EyeOff, Users, CreditCard, Check, Bell,
  BarChart3, Coins,
} from "lucide-react";

const ADMIN_ID = (import.meta.env.VITE_ADMIN_ID as string | undefined) ?? "admin";
const ADMIN_PW = (import.meta.env.VITE_ADMIN_PW as string | undefined) ?? "admin123";

const _SB_URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? "";
const _SB_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ?? "";
const _SB_HDR = () => ({
  "Content-Type": "application/json",
  apikey: _SB_KEY,
  Authorization: `Bearer ${_SB_KEY}`,
});

async function sbGet(key: string): Promise<number> {
  if (!_SB_URL || !_SB_KEY) return 0;
  try {
    const r = await fetch(
      `${_SB_URL}/rest/v1/dp_counters?key=eq.${encodeURIComponent(key)}&select=value`,
      { headers: _SB_HDR() }
    );
    const d = await r.json();
    return Array.isArray(d) && d.length ? (d[0].value ?? 0) : 0;
  } catch {
    return 0;
  }
}
async function sbList(prefix: string): Promise<{ key: string; value: number }[]> {
  if (!_SB_URL || !_SB_KEY) return [];
  try {
    const r = await fetch(
      `${_SB_URL}/rest/v1/dp_counters?key=like.${encodeURIComponent(prefix + "%")}&select=key,value&order=key.desc&limit=100`,
      { headers: _SB_HDR() }
    );
    const d = await r.json();
    return Array.isArray(d) ? d : [];
  } catch { return []; }
}
async function sbSet(key: string, value: number): Promise<void> {
  if (!_SB_URL || !_SB_KEY) return;
  try {
    await fetch(`${_SB_URL}/rest/v1/dp_counters`, {
      method: "POST",
      headers: { ..._SB_HDR(), "Prefer": "resolution=merge-duplicates" },
      body: JSON.stringify({ key, value }),
    });
  } catch {}
}

function todayKey() {
  return new Date().toISOString().slice(0, 10).replace(/-/g, "");
}

interface ServiceDef {
  id: string;
  prefix: string;
  name: string;
  desc: string;
  usage: string;
  link: string;
}

const SERVICES: ServiceDef[] = [
  { id: "diet-planner", prefix: "dp", name: "맞춤 식단 플래너", desc: "개인 맞춤 식단 생성 · 공유", usage: "식단 생성", link: "/" },
  { id: "posture-line", prefix: "pa", name: "체형 분석 라인 드로잉", desc: "사진 위 수평·수직·각도선 분석 · PNG 저장", usage: "PNG 저장", link: "/posture" },
  { id: "contract", prefix: "ct", name: "전자 회원 계약서", desc: "계약서 작성 · 서명 · 출력", usage: "계약서 생성", link: "/contract" },
  { id: "sequence", prefix: "sq", name: "시퀀스 랩", desc: "수업 시퀀스 작성 · 공유", usage: "시퀀스 저장", link: "/sequence" },
];

const K = (p: string) => ({
  visitTotal: `${p}_vc`, visitToday: `${p}_vt_${todayKey()}`,
  useTotal: `${p}_uc`, useToday: `${p}_ud_${todayKey()}`,
  shareTotal: `${p}_sc`, shareToday: `${p}_st_${todayKey()}`,
});

const MAX_FAILS = 5;
const LOCK_MS = 5 * 60 * 1000;

type Tab = "overview" | "data" | "points";

export default function AdminPage() {
  const [loggedIn, setLoggedIn] = useState(
    () => sessionStorage.getItem("dp_admin") === "1"
  );
  const [id, setId] = useState("");
  const [pw, setPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [stats, setStats] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 700);
  const [tab, setTab] = useState<Tab>("overview");

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 700);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    const lockUntil = Number(sessionStorage.getItem("dp_admin_lock") || 0);
    if (lockUntil > Date.now()) {
      const min = Math.ceil((lockUntil - Date.now()) / 60000);
      setLoginError(`로그인 시도가 너무 많습니다. ${min}분 후 다시 시도하세요.`);
      return;
    }
    if (id === ADMIN_ID && pw === ADMIN_PW) {
      sessionStorage.setItem("dp_admin", "1");
      sessionStorage.removeItem("dp_admin_fail");
      setLoggedIn(true);
      setLoginError("");
    } else {
      const fails = Number(sessionStorage.getItem("dp_admin_fail") || 0) + 1;
      if (fails >= MAX_FAILS) {
        sessionStorage.setItem("dp_admin_lock", String(Date.now() + LOCK_MS));
        sessionStorage.removeItem("dp_admin_fail");
        setLoginError("비밀번호를 5회 틀려 5분 동안 로그인이 제한됩니다.");
      } else {
        sessionStorage.setItem("dp_admin_fail", String(fails));
        setLoginError(`아이디 또는 비밀번호가 올바르지 않습니다. (${fails}/${MAX_FAILS})`);
      }
    }
  }

  function handleLogout() {
    sessionStorage.removeItem("dp_admin");
    setLoggedIn(false);
    setId("");
    setPw("");
  }

  async function fetchStats() {
    setLoading(true);
    const keys = SERVICES.flatMap((s) => Object.values(K(s.prefix)));
    const results: Record<string, number> = {};
    await Promise.all(keys.map(async (k) => { results[k] = await sbGet(k); }));
    setStats(results);
    setLastRefresh(new Date());
    setLoading(false);
  }

  useEffect(() => {
    if (loggedIn) fetchStats();
  }, [loggedIn]);

  /* ── Login Screen ── */
  if (!loggedIn) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#f8fafc",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "'Noto Sans KR', sans-serif",
        }}
      >
        <div
          style={{
            background: "#ffffff",
            borderRadius: 18,
            padding: "40px 36px",
            width: 360,
            boxShadow: "0 1px 4px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)",
            border: "1px solid #e2e8f0",
          }}
        >
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <div style={{ fontSize: 42, marginBottom: 10 }}>🔐</div>
            <h1
              style={{ color: "#0f172a", fontSize: 20, fontWeight: 700, margin: 0 }}
            >
              어드민 로그인
            </h1>
            <p style={{ color: "#475569", fontSize: 13, margin: "8px 0 0" }}>
              서비스 관리자 전용 페이지입니다
            </p>
          </div>

          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: 14 }}>
              <label
                style={{
                  color: "#475569",
                  fontSize: 12,
                  fontWeight: 600,
                  display: "block",
                  marginBottom: 6,
                  letterSpacing: "0.05em",
                }}
              >
                아이디
              </label>
              <input
                value={id}
                onChange={(e) => setId(e.target.value)}
                autoFocus
                placeholder="아이디를 입력하세요"
                style={{
                  width: "100%",
                  background: "#ffffff",
                  border: "1px solid #e2e8f0",
                  borderRadius: 8,
                  padding: "11px 12px",
                  color: "#0f172a",
                  fontSize: 14,
                  boxSizing: "border-box",
                  outline: "none",
                }}
              />
            </div>

            <div style={{ marginBottom: 24, position: "relative" }}>
              <label
                style={{
                  color: "#475569",
                  fontSize: 12,
                  fontWeight: 600,
                  display: "block",
                  marginBottom: 6,
                  letterSpacing: "0.05em",
                }}
              >
                비밀번호
              </label>
              <input
                type={showPw ? "text" : "password"}
                value={pw}
                onChange={(e) => setPw(e.target.value)}
                placeholder="비밀번호를 입력하세요"
                style={{
                  width: "100%",
                  background: "#ffffff",
                  border: "1px solid #e2e8f0",
                  borderRadius: 8,
                  padding: "11px 40px 11px 12px",
                  color: "#0f172a",
                  fontSize: 14,
                  boxSizing: "border-box",
                  outline: "none",
                }}
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                style={{
                  position: "absolute",
                  right: 10,
                  bottom: 11,
                  background: "none",
                  border: "none",
                  color: "#94a3b8",
                  cursor: "pointer",
                  padding: 2,
                  display: "flex",
                }}
              >
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            {loginError && (
              <p
                style={{
                  color: "#f87171",
                  fontSize: 13,
                  marginBottom: 16,
                  textAlign: "center",
                }}
              >
                {loginError}
              </p>
            )}

            <button
              type="submit"
              style={{
                width: "100%",
                background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
                border: "none",
                borderRadius: 8,
                padding: "13px 0",
                color: "#fff",
                fontSize: 15,
                fontWeight: 700,
                cursor: "pointer",
                letterSpacing: "0.02em",
                boxShadow: "0 4px 20px rgba(37,99,235,0.15)",
              }}
            >
              로그인
            </button>
          </form>
        </div>
      </div>
    );
  }

  /* ── Dashboard ── */
  const fmtN = (n: number) => (loading ? "…" : n.toLocaleString());
  const card: React.CSSProperties = {
    background: "#ffffff", borderRadius: 16, padding: 24, border: "1px solid #e2e8f0",
    boxShadow: "0 1px 4px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)",
  };
  const TABS: { id: Tab; label: string; Icon: typeof Users }[] = [
    { id: "overview", label: "대시보드", Icon: LayoutDashboard },
    { id: "data", label: "데이터", Icon: BarChart3 },
    { id: "points", label: "포인트 관리", Icon: Coins },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", fontFamily: "'Noto Sans KR', sans-serif" }}>
      <header style={{ background: "#ffffff", borderBottom: "1px solid #e2e8f0", position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ maxWidth: 1000, margin: "0 auto", padding: isMobile ? "0 16px" : "0 24px", height: 60, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <LayoutDashboard size={20} color="#2563eb" />
            <span style={{ color: "#0f172a", fontSize: 17, fontWeight: 700 }}>FIT STEP 어드민</span>
          </div>
          <button onClick={handleLogout} style={{ display: "flex", alignItems: "center", gap: 6, background: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: 8, padding: "8px 14px", color: "#475569", fontSize: 13, cursor: "pointer" }}>
            <LogOut size={14} /> 로그아웃
          </button>
        </div>
        <nav style={{ maxWidth: 1000, margin: "0 auto", padding: isMobile ? "0 8px" : "0 16px", display: "flex", gap: 4, overflowX: "auto" }}>
          {TABS.map(({ id: tid, label, Icon }) => {
            const on = tab === tid;
            return (
              <button key={tid} onClick={() => setTab(tid)} style={{
                display: "flex", alignItems: "center", gap: 6, padding: "12px 14px", background: "none", border: "none",
                borderBottom: `2px solid ${on ? "#2563eb" : "transparent"}`, color: on ? "#2563eb" : "#64748b",
                fontSize: 14, fontWeight: on ? 700 : 500, cursor: "pointer", whiteSpace: "nowrap",
              }}>
                <Icon size={15} /> {label}
              </button>
            );
          })}
        </nav>
      </header>

      <main style={{ maxWidth: 1000, margin: "0 auto", padding: isMobile ? "24px 16px" : "32px 24px" }}>
        {tab === "overview" && (
          <>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, gap: 10, flexWrap: "wrap" }}>
              <h2 style={{ color: "#0f172a", fontSize: 15, fontWeight: 700, margin: 0 }}>프로그램별 현황</h2>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {lastRefresh && <span style={{ color: "#94a3b8", fontSize: 12 }}>갱신: {lastRefresh.toLocaleTimeString("ko-KR")}</span>}
                <button onClick={fetchStats} disabled={loading} style={{ display: "flex", alignItems: "center", gap: 5, background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 8, padding: "6px 12px", color: "#475569", fontSize: 12, cursor: "pointer" }}>
                  <RefreshCw size={12} /> 새로고침
                </button>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(2, 1fr)", gap: 20 }}>
              {SERVICES.map((svc) => {
                const k = K(svc.prefix);
                return (
                  <div key={svc.id} style={card}>
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 18, gap: 12 }}>
                      <div style={{ minWidth: 0 }}>
                        <h3 style={{ color: "#0f172a", fontSize: 15, fontWeight: 700, margin: "0 0 4px" }}>{svc.name}</h3>
                        <p style={{ color: "#64748b", fontSize: 12, margin: 0 }}>{svc.desc} · 사용 기준: {svc.usage}</p>
                      </div>
                      <a href={svc.link} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "#eff6ff", color: "#2563eb", textDecoration: "none", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 600, flexShrink: 0, border: "1px solid #bfdbfe" }}>
                        <ExternalLink size={12} /> 열기
                      </a>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                      {[
                        { key: k.visitToday, label: "오늘 방문", color: "#2563eb" },
                        { key: k.useToday, label: "오늘 사용", color: "#0d9488" },
                        { key: k.shareToday, label: "오늘 공유", color: "#f59e0b" },
                        { key: k.visitTotal, label: "누적 방문", color: "#2563eb" },
                        { key: k.useTotal, label: "누적 사용", color: "#0d9488" },
                        { key: k.shareTotal, label: "누적 공유", color: "#f59e0b" },
                      ].map(({ key, label, color }) => (
                        <div key={key} style={{ background: "#f8fafc", borderRadius: 10, padding: "12px 10px", border: "1px solid #e2e8f0", borderTop: `3px solid ${color}` }}>
                          <span style={{ color: "#64748b", fontSize: 11 }}>{label}</span>
                          <p style={{ color: "#0f172a", fontSize: 19, fontWeight: 700, margin: "6px 0 0", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{fmtN(stats[key] ?? 0)}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {tab === "data" && <DataPanel isMobile={isMobile} />}

        {tab === "points" && (
          <>
            <PointPanel sbGet={sbGet} sbSet={sbSet} />
            <ChargeRequestPanel sbList={sbList} sbGet={sbGet} sbSet={sbSet} />
          </>
        )}

        <p style={{ color: "#94a3b8", fontSize: 12, textAlign: "center", marginTop: 48 }}>
          Railway 환경변수 VITE_ADMIN_ID · VITE_ADMIN_PW 설정으로 계정을 변경할 수 있습니다
        </p>
      </main>
    </div>
  );
}

// ── 데이터 탭 ────────────────────────────────────────────────────────────────
type Daily = Record<string, number>;
interface SvcSeries { v: Daily; u: Daily; s: Daily }

function lastNDates(n: number): string[] {
  const out: string[] = [];
  const d = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const x = new Date(d.getTime() - i * 86400000);
    out.push(x.toISOString().slice(0, 10).replace(/-/g, ""));
  }
  return out;
}

async function loadSeries(prefix: string, kind: string): Promise<Daily> {
  const rows = await sbList(`${prefix}_${kind}_`);
  const out: Daily = {};
  for (const r of rows) {
    const date = r.key.slice(prefix.length + kind.length + 2);
    if (/^\d{8}$/.test(date)) out[date] = r.value;
  }
  return out;
}

function DataPanel({ isMobile }: { isMobile: boolean }) {
  const [days, setDays] = useState<7 | 14 | 30>(14);
  const [svcId, setSvcId] = useState<string>(SERVICES[0].id);
  const [series, setSeries] = useState<Record<string, SvcSeries>>({});
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    const entries = await Promise.all(SERVICES.map(async (svc) => {
      const [v, u, s] = await Promise.all([
        loadSeries(svc.prefix, "vt"), loadSeries(svc.prefix, "ud"), loadSeries(svc.prefix, "st"),
      ]);
      return [svc.prefix, { v, u, s }] as const;
    }));
    setSeries(Object.fromEntries(entries));
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const dates = lastNDates(days);
  const cur = SERVICES.find((s) => s.id === svcId) ?? SERVICES[0];
  const val = (d: string, kind: keyof SvcSeries) => series[cur.prefix]?.[kind][d] ?? 0;
  const rows = dates.map((d) => ({ d, v: val(d, "v"), u: val(d, "u"), s: val(d, "s") }));
  const total = rows.reduce((a, r) => ({ v: a.v + r.v, u: a.u + r.u, s: a.s + r.s }), { v: 0, u: 0, s: 0 });
  const maxY = Math.max(4, ...rows.map((r) => Math.max(r.v, r.u)));
  const niceMax = Math.ceil(maxY / 4) * 4;
  const W = isMobile ? 360 : 640, H = isMobile ? 230 : 220, padL = 30, padB = 26, padT = 10, padR = 6;
  const cw = (W - padL - padR) / rows.length;
  const bw = Math.max(2, Math.min(14, cw / 2 - 2));
  const y = (n: number) => padT + (H - padT - padB) * (1 - n / niceMax);
  const md = (d: string) => `${Number(d.slice(4, 6))}/${Number(d.slice(6, 8))}`;
  const labelEvery = days === 30 ? (isMobile ? 7 : 5) : days === 14 ? (isMobile ? 3 : 2) : 1;

  const card: React.CSSProperties = {
    background: "#ffffff", borderRadius: 16, padding: isMobile ? 16 : 24, border: "1px solid #e2e8f0",
    boxShadow: "0 1px 4px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)", marginBottom: 20,
  };
  const pill = (on: boolean): React.CSSProperties => ({
    padding: "6px 12px", borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: "pointer",
    border: `1px solid ${on ? "#2563eb" : "#e2e8f0"}`, background: on ? "#eff6ff" : "#ffffff", color: on ? "#2563eb" : "#475569",
  });
  const cellPad = isMobile ? "8px 6px" : "8px 10px";
  const th: React.CSSProperties = { textAlign: "right", padding: cellPad, color: "#64748b", fontWeight: 600, fontSize: 12, borderBottom: "1px solid #e2e8f0", whiteSpace: "nowrap" };
  const td: React.CSSProperties = { textAlign: "right", padding: cellPad, color: "#0f172a", fontSize: 13, borderBottom: "1px solid #f1f5f9", fontVariantNumeric: "tabular-nums" };
  const rate = (u: number, v: number) => (v ? `${Math.round((u / v) * 100)}%` : "—");

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 16 }}>
        <h2 style={{ color: "#0f172a", fontSize: 15, fontWeight: 700, margin: 0 }}>방문 · 사용 데이터</h2>
        <button onClick={load} disabled={loading} style={{ display: "flex", alignItems: "center", gap: 5, background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 8, padding: "6px 12px", color: "#475569", fontSize: 12, cursor: "pointer" }}>
          <RefreshCw size={12} /> {loading ? "불러오는 중…" : "새로고침"}
        </button>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
        {SERVICES.map((s) => (
          <button key={s.id} onClick={() => setSvcId(s.id)} style={pill(svcId === s.id)}>{s.name}</button>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {([7, 14, 30] as const).map((n) => (
          <button key={n} onClick={() => setDays(n)} style={pill(days === n)}>최근 {n}일</button>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 20 }}>
        {[
          { label: "방문", v: total.v.toLocaleString(), color: "#2563eb" },
          { label: "사용", v: total.u.toLocaleString(), color: "#0d9488" },
          { label: "공유", v: total.s.toLocaleString(), color: "#f59e0b" },
          { label: "사용률", v: rate(total.u, total.v), color: "#7c3aed" },
        ].map((c) => (
          <div key={c.label} style={{ background: "#ffffff", borderRadius: 12, padding: isMobile ? "12px 10px" : "14px 16px", border: "1px solid #e2e8f0", borderTop: `3px solid ${c.color}` }}>
            <span style={{ color: "#64748b", fontSize: 11 }}>{c.label} · {days}일</span>
            <p style={{ color: "#0f172a", fontSize: isMobile ? 18 : 22, fontWeight: 800, margin: "6px 0 0", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{c.v}</p>
          </div>
        ))}
      </div>

      <div style={card}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 10, fontSize: 12, color: "#475569" }}>
          <span style={{ fontWeight: 700, color: "#0f172a" }}>{cur.name} · 일별 추이</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><i style={{ width: 10, height: 10, borderRadius: 2, background: "#2563eb", display: "inline-block" }} />방문</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><i style={{ width: 10, height: 10, borderRadius: 2, background: "#0d9488", display: "inline-block" }} />사용</span>
        </div>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }} role="img" aria-label="일별 방문과 사용 막대 그래프">
          {[0, 1, 2, 3, 4].map((i) => {
            const n = (niceMax / 4) * i;
            return (
              <g key={i}>
                <line x1={padL} x2={W - padR} y1={y(n)} y2={y(n)} stroke="#e2e8f0" strokeWidth={1} />
                <text x={padL - 6} y={y(n) + 4} textAnchor="end" fontSize={10} fill="#94a3b8">{n}</text>
              </g>
            );
          })}
          {rows.map((r, i) => {
            const cx = padL + cw * i + cw / 2;
            return (
              <g key={r.d}>
                <rect x={cx - bw - 1} y={y(r.v)} width={bw} height={y(0) - y(r.v)} rx={2} fill="#2563eb"><title>{`${md(r.d)} 방문 ${r.v}`}</title></rect>
                <rect x={cx + 1} y={y(r.u)} width={bw} height={y(0) - y(r.u)} rx={2} fill="#0d9488"><title>{`${md(r.d)} 사용 ${r.u}`}</title></rect>
                {(rows.length - 1 - i) % labelEvery === 0 && (
                  <text x={cx} y={H - 8} textAnchor="middle" fontSize={10} fill="#64748b">{md(r.d)}</text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      <div style={card}>
        <p style={{ fontWeight: 700, color: "#0f172a", fontSize: 14, margin: "0 0 10px" }}>프로그램별 비교 · 최근 {days}일</p>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 420 }}>
            <thead><tr>
              <th style={{ ...th, textAlign: "left" }}>프로그램</th><th style={th}>방문</th><th style={th}>사용</th><th style={th}>공유</th><th style={th}>사용률</th>
            </tr></thead>
            <tbody>
              {SERVICES.map((svc) => {
                const sv = series[svc.prefix];
                const t = dates.reduce((a, d) => ({ v: a.v + (sv?.v[d] ?? 0), u: a.u + (sv?.u[d] ?? 0), s: a.s + (sv?.s[d] ?? 0) }), { v: 0, u: 0, s: 0 });
                return (
                  <tr key={svc.id}>
                    <td style={{ ...td, textAlign: "left", fontWeight: 600 }}>{svc.name}<span style={{ display: "block", color: "#94a3b8", fontSize: 11, fontWeight: 400 }}>사용 = {svc.usage}</span></td>
                    <td style={td}>{t.v.toLocaleString()}</td><td style={td}>{t.u.toLocaleString()}</td><td style={td}>{t.s.toLocaleString()}</td><td style={td}>{rate(t.u, t.v)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div style={card}>
        <p style={{ fontWeight: 700, color: "#0f172a", fontSize: 14, margin: "0 0 10px" }}>{cur.name} · 날짜별 상세</p>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 300 }}>
            <thead><tr>
              <th style={{ ...th, textAlign: "left" }}>날짜</th><th style={th}>방문</th><th style={th}>사용</th><th style={th}>공유</th><th style={th}>사용률</th>
            </tr></thead>
            <tbody>
              {[...rows].reverse().map((r) => (
                <tr key={r.d}>
                  <td style={{ ...td, textAlign: "left" }}>{`${r.d.slice(0, 4)}.${r.d.slice(4, 6)}.${r.d.slice(6, 8)}`}</td>
                  <td style={td}>{r.v.toLocaleString()}</td><td style={td}>{r.u.toLocaleString()}</td><td style={td}>{r.s.toLocaleString()}</td><td style={td}>{rate(r.u, r.v)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p style={{ color: "#94a3b8", fontSize: 11, margin: "12px 0 0" }}>방문은 브라우저 세션당 1회로 집계됩니다. 날짜는 한국 시간 오전 9시에 바뀝니다 (UTC 기준).</p>
      </div>
    </>
  );
}

// ── 포인트 지급 패널 ────────────────────────────────────────────────────────
function PointPanel({ sbGet, sbSet }: {
  sbGet: (k: string) => Promise<number>;
  sbSet: (k: string, v: number) => Promise<void>;
}) {
  const [userId, setUserId]   = useState("");
  const [amount, setAmount]   = useState("5000");
  const [current, setCurrent] = useState<number | null>(null);
  const [msg, setMsg]         = useState("");
  const [busy, setBusy]       = useState(false);

  async function lookup() {
    if (!userId.trim()) return;
    setBusy(true); setMsg("");
    const pts = await sbGet(`ct_pt_${userId.trim()}`);
    setCurrent(pts);
    setBusy(false);
  }

  async function grant() {
    if (!userId.trim() || !amount) return;
    setBusy(true); setMsg("");
    const key = `ct_pt_${userId.trim()}`;
    const cur = await sbGet(key);
    const next = cur + Number(amount);
    await sbSet(key, next);
    setCurrent(next);
    setMsg(`✓ ${Number(amount).toLocaleString()}P 지급 완료 (잔액: ${next.toLocaleString()}P)`);
    setBusy(false);
  }

  const iStyle2: React.CSSProperties = {
    background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 8,
    padding: "9px 12px", color: "#0f172a", fontSize: 14, outline: "none",
  };

  return (
    <div style={{ marginTop: 40 }}>
      <h2 style={{ color: "#0f172a", fontSize: 15, fontWeight: 700, margin: "0 0 16px" }}>
        <CreditCard size={16} color="#f59e0b" style={{ verticalAlign: "middle", marginRight: 6 }} />
        핏포인트 지급
      </h2>
      <div style={{ background: "#ffffff", borderRadius: 16, padding: 24, border: "1px solid #e2e8f0", boxShadow: "0 1px 4px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)" }}>
        <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" as const }}>
          <input
            value={userId} onChange={e => { setUserId(e.target.value); setCurrent(null); setMsg(""); }}
            placeholder="카카오 숫자 ID (예: 3712345678)"
            style={{ ...iStyle2, flex: 2, minWidth: 160 }}
          />
          <button onClick={lookup} disabled={busy}
            style={{ background: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: 8, padding: "9px 16px", color: "#475569", fontSize: 13, cursor: "pointer" }}>
            조회
          </button>
        </div>
        {current !== null && (
          <p style={{ color: "#f59e0b", fontSize: 13, margin: "0 0 12px" }}>현재 잔액: {current.toLocaleString()} P</p>
        )}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" as const }}>
          <input
            type="number" value={amount} onChange={e => setAmount(e.target.value)}
            placeholder="지급 포인트"
            style={{ ...iStyle2, flex: 1, minWidth: 120 }}
          />
          {[5000,12000].map(v => (
            <button key={v} onClick={() => setAmount(String(v))}
              style={{ background: amount===String(v)?"#fef3c7":"#ffffff", border:"1px solid #f59e0b", borderRadius:8, padding:"9px 14px", color:"#b45309", fontSize:13, cursor:"pointer", fontWeight:600 }}>
              {v.toLocaleString()}P
            </button>
          ))}
          <button onClick={grant} disabled={busy || !userId.trim()}
            style={{ display:"flex", alignItems:"center", gap:5, background:"linear-gradient(135deg,#2563eb,#1d4ed8)", border:"none", borderRadius:8, padding:"9px 18px", color:"#fff", fontSize:13, fontWeight:700, cursor:"pointer", boxShadow:"0 4px 20px rgba(37,99,235,0.15)" }}>
            <Check size={14}/> 지급
          </button>
        </div>
        {msg && <p style={{ color: "#2563eb", fontSize: 13, margin: "12px 0 0" }}>{msg}</p>}
        <div style={{ background: "#eff6ff", borderRadius: 8, padding: "10px 12px", marginTop: 12, borderLeft: "3px solid #2563eb" }}>
          <p style={{ color: "#475569", fontSize: 11, margin: 0, lineHeight: 1.7 }}>
            이름이 아닌 <span style={{ color: "#2563eb", fontWeight: 700 }}>카카오 숫자 ID</span>를 입력하세요.<br/>
            회원이 /contract 페이지에 로그인하면 화면에 본인 ID가 표시됩니다. 그 번호를 여기에 입력하면 됩니다.
          </p>
        </div>
      </div>
    </div>
  );
}

// ── 충전 신청 목록 패널 ────────────────────────────────────────────────────
interface ReqRow { key: string; value: number; ts: string; userId: string; won: string; name: string; }

function parseReqKey(key: string): Omit<ReqRow, "value"> | null {
  const parts = key.split("__");
  if (parts.length < 5 || parts[0] !== "ct_req") return null;
  const [, ts, userId, won, ...nameParts] = parts;
  return { key, ts, userId, won, name: nameParts.join("__") };
}

function fmtTs(ts: string) {
  if (ts.length < 8) return ts;
  return `${ts.slice(0, 4)}-${ts.slice(4, 6)}-${ts.slice(6, 8)} ${ts.slice(8, 10)}:${ts.slice(10, 12)}`;
}

function wonToPoints(won: string): number {
  return won === "10000" ? 12000 : Number(won);
}

function ChargeRequestPanel({ sbList, sbGet, sbSet }: {
  sbList: (prefix: string) => Promise<{ key: string; value: number }[]>;
  sbGet: (k: string) => Promise<number>;
  sbSet: (k: string, v: number) => Promise<void>;
}) {
  const [rows, setRows]   = useState<ReqRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy]   = useState<string>("");
  const [msg, setMsg]     = useState("");

  async function load() {
    setLoading(true); setMsg("");
    const raw = await sbList("ct_req__");
    const parsed = raw.flatMap(r => {
      const p = parseReqKey(r.key);
      return p ? [{ ...p, value: r.value }] : [];
    });
    setRows(parsed);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function grantAndClose(row: ReqRow) {
    setBusy(row.key);
    const pts = wonToPoints(row.won);
    const ptKey = `ct_pt_${row.userId}`;
    const cur = await sbGet(ptKey);
    await sbSet(ptKey, cur + pts);
    await sbSet(row.key, 2);
    setMsg(`✓ ${row.name}님께 ${pts.toLocaleString()}P 지급 완료`);
    setRows(prev => prev.map(r => r.key === row.key ? { ...r, value: 2 } : r));
    setBusy("");
  }

  const pending = rows.filter(r => r.value === 1);
  const done    = rows.filter(r => r.value === 2);

  const cardStyle = (isDone: boolean): React.CSSProperties => ({
    background: isDone ? "#f8fafc" : "#eff6ff",
    borderRadius: 10,
    padding: "14px",
    border: `1px solid ${isDone ? "#e2e8f0" : "#bfdbfe"}`,
    marginBottom: 8,
  });

  return (
    <div style={{ marginTop: 40 }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16 }}>
        <h2 style={{ color:"#0f172a", fontSize:15, fontWeight:700, margin:0, display:"flex", alignItems:"center", gap:8 }}>
          <Bell size={16} color="#fb923c"/>
          포인트 충전 신청
          {pending.length > 0 && (
            <span style={{ background:"#ea580c", color:"#fff", fontSize:11, fontWeight:700, borderRadius:20, padding:"2px 8px" }}>{pending.length}</span>
          )}
        </h2>
        <button onClick={load} disabled={loading}
          style={{ display:"flex", alignItems:"center", gap:5, background:"#ffffff", border:"1px solid #e2e8f0", borderRadius:8, padding:"6px 12px", color:"#475569", fontSize:12, cursor:"pointer" }}>
          <RefreshCw size={12} style={{ transform: loading ? "rotate(360deg)" : "none", transition:"transform 0.3s" }}/>
          새로고침
        </button>
      </div>
      <div style={{ background:"#ffffff", borderRadius:16, padding:24, border:"1px solid #e2e8f0", boxShadow:"0 1px 4px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)" }}>
        {loading && <p style={{ color:"#94a3b8", fontSize:13, textAlign:"center", margin:0 }}>불러오는 중…</p>}
        {!loading && rows.length === 0 && <p style={{ color:"#94a3b8", fontSize:13, textAlign:"center", margin:0 }}>아직 충전 신청이 없습니다.</p>}

        {pending.length > 0 && (
          <>
            <p style={{ color:"#fb923c", fontSize:11, fontWeight:700, margin:"0 0 10px", letterSpacing:"0.06em" }}>신청 대기 ({pending.length}건)</p>
            {pending.map(row => (
              <div key={row.key} style={cardStyle(false)}>
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap" as const, gap:8 }}>
                  <div>
                    <p style={{ color:"#0f172a", fontWeight:700, fontSize:14, margin:"0 0 2px" }}>
                      {row.name} <span style={{ color:"#94a3b8", fontSize:11, fontWeight:400 }}>{row.userId}</span>
                    </p>
                    <p style={{ color:"#475569", fontSize:11, margin:"0 0 4px" }}>{fmtTs(row.ts)}</p>
                    <p style={{ color:"#f59e0b", fontWeight:700, fontSize:13, margin:0 }}>
                      {Number(row.won).toLocaleString()}원 입금 → {wonToPoints(row.won).toLocaleString()}P 지급 예정
                    </p>
                  </div>
                  <button onClick={() => grantAndClose(row)} disabled={busy === row.key}
                    style={{ display:"flex", alignItems:"center", gap:5, background:"linear-gradient(135deg,#2563eb,#1d4ed8)", border:"none", borderRadius:8, padding:"10px 16px", color:"#fff", fontSize:13, fontWeight:700, cursor:"pointer", flexShrink:0, boxShadow:"0 4px 20px rgba(37,99,235,0.15)" }}>
                    <Check size={14}/>
                    {busy === row.key ? "처리 중…" : "입금 확인·지급"}
                  </button>
                </div>
              </div>
            ))}
          </>
        )}

        {done.length > 0 && (
          <>
            <p style={{ color:"#94a3b8", fontSize:11, fontWeight:700, margin:"16px 0 10px", letterSpacing:"0.06em" }}>완료 내역</p>
            {done.map(row => (
              <div key={row.key} style={cardStyle(true)}>
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                  <div>
                    <p style={{ color:"#475569", fontWeight:600, fontSize:13, margin:"0 0 2px" }}>
                      {row.name} <span style={{ fontSize:11, fontWeight:400 }}>{row.userId}</span>
                    </p>
                    <p style={{ color:"#94a3b8", fontSize:11, margin:0 }}>{fmtTs(row.ts)} · {Number(row.won).toLocaleString()}원 → {wonToPoints(row.won).toLocaleString()}P</p>
                  </div>
                  <span style={{ color:"#059669", fontSize:12, fontWeight:700 }}>✓ 완료</span>
                </div>
              </div>
            ))}
          </>
        )}

        {msg && <p style={{ color:"#2563eb", fontSize:13, margin:"12px 0 0" }}>{msg}</p>}
      </div>
    </div>
  );
}
