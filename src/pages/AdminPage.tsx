import { useState, useEffect } from "react";
import {
  LayoutDashboard, LogOut, RefreshCw, ExternalLink,
  Eye, EyeOff, Users, Share2, TrendingUp, Activity, CreditCard, Check, Bell,
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
  name: string;
  desc: string;
  link: string;
  vcKey: string;
  vtKey: string;
  scKey: string;
  stKey: string;
}

const SERVICES: ServiceDef[] = [
  {
    id: "diet-planner",
    name: "FIT STEP 맞춤 식단 플래너",
    desc: "개인 맞춤형 AI 식단 생성 서비스. 식단 목적 · 현실식/건강식 스타일 지원.",
    link: "/",
    vcKey: "dp_vc",
    vtKey: `dp_vt_${todayKey()}`,
    scKey: "dp_sc",
    stKey: `dp_st_${todayKey()}`,
  },
  {
    id: "posture-line",
    name: "FIT STEP 체형 분석 라인 드로잉",
    desc: "사진 위에 수평·수직·각도선을 그어 체형을 분석하는 도구. PNG 저장 지원.",
    link: "/posture",
    vcKey: "pa_vc",
    vtKey: `pa_vt_${todayKey()}`,
    scKey: "pa_sc",
    stKey: `pa_st_${todayKey()}`,
  },
  {
    id: "contract",
    name: "FIT STEP 전자 회원 계약서",
    desc: "URL 파라미터로 계약 정보를 전달해 계약서를 생성·인쇄·공유. 서명 이미지 지원.",
    link: "/contract",
    vcKey: "ct_vc",
    vtKey: `ct_vt_${todayKey()}`,
    scKey: "ct_sc",
    stKey: `ct_st_${todayKey()}`,
  },
];

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

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 700);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (id === ADMIN_ID && pw === ADMIN_PW) {
      sessionStorage.setItem("dp_admin", "1");
      setLoggedIn(true);
      setLoginError("");
    } else {
      setLoginError("아이디 또는 비밀번호가 올바르지 않습니다.");
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
    const keys = SERVICES.flatMap((s) => [s.vcKey, s.vtKey, s.scKey, s.stKey]);
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
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f8fafc",
        fontFamily: "'Noto Sans KR', sans-serif",
      }}
    >
      {/* Header */}
      <header
        style={{
          background: "#ffffff",
          borderBottom: "1px solid #e2e8f0",
          padding: "0 28px",
          height: 60,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <LayoutDashboard size={20} color="#2563eb" />
          <span style={{ color: "#0f172a", fontSize: 17, fontWeight: 700 }}>
            어드민 대시보드
          </span>
          <span
            style={{
              background: "#eff6ff",
              color: "#2563eb",
              fontSize: 10,
              padding: "2px 8px",
              borderRadius: 20,
              fontWeight: 700,
              letterSpacing: "0.05em",
              border: "1px solid #bfdbfe",
            }}
          >
            BETA
          </span>
        </div>
        <button
          onClick={handleLogout}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            background: "#f1f5f9",
            border: "1px solid #e2e8f0",
            borderRadius: 8,
            padding: "8px 14px",
            color: "#475569",
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          <LogOut size={14} />
          로그아웃
        </button>
      </header>

      <main style={{ maxWidth: 1000, margin: "0 auto", padding: "32px 24px" }}>
        {/* Stats Section */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 16,
          }}
        >
          <h2 style={{ color: "#0f172a", fontSize: 15, fontWeight: 700, margin: 0 }}>
            통계 현황
          </h2>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {lastRefresh && (
              <span style={{ color: "#94a3b8", fontSize: 12 }}>
                갱신: {lastRefresh.toLocaleTimeString("ko-KR")}
              </span>
            )}
            <button
              onClick={fetchStats}
              disabled={loading}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                background: "#ffffff",
                border: "1px solid #e2e8f0",
                borderRadius: 8,
                padding: "6px 12px",
                color: "#475569",
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              <RefreshCw
                size={12}
                style={{
                  transition: "transform 0.3s",
                  transform: loading ? "rotate(360deg)" : "none",
                }}
              />
              새로고침
            </button>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(2, 1fr)", gap: 20, marginBottom: 40 }}>
          {SERVICES.map((svc) => (
            <div
              key={svc.id}
              style={{
                background: "#ffffff",
                borderRadius: 16,
                padding: 24,
                border: "1px solid #e2e8f0",
                boxShadow: "0 1px 4px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)",
              }}
            >
              {/* Service header */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
                <div>
                  <h3 style={{ color: "#0f172a", fontSize: 15, fontWeight: 700, margin: "0 0 4px" }}>
                    {svc.name}
                  </h3>
                  <p style={{ color: "#475569", fontSize: 12, margin: 0 }}>{svc.desc}</p>
                </div>
                <a
                  href={svc.link}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                    background: "#eff6ff",
                    color: "#2563eb",
                    textDecoration: "none",
                    borderRadius: 8,
                    padding: "6px 12px",
                    fontSize: 12,
                    fontWeight: 600,
                    flexShrink: 0,
                    marginLeft: 12,
                    border: "1px solid #bfdbfe",
                  }}
                >
                  <ExternalLink size={12} />
                  열기
                </a>
              </div>

              {/* Per-service stat grid */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
                {[
                  { key: svc.vcKey, label: "누적 방문", color: "#2563eb", Icon: Users },
                  { key: svc.vtKey, label: "오늘 방문", color: "#2563eb", Icon: Activity },
                  { key: svc.scKey, label: "누적 공유", color: "#f472b6", Icon: Share2 },
                  { key: svc.stKey, label: "오늘 공유", color: "#fb923c", Icon: TrendingUp },
                ].map(({ key, label, color, Icon }) => (
                  <div
                    key={key}
                    style={{
                      background: "#f8fafc",
                      borderRadius: 12,
                      padding: "14px 12px",
                      border: "1px solid #e2e8f0",
                      borderTop: `3px solid ${color}`,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                      <span style={{ color: "#475569", fontSize: 11 }}>{label}</span>
                      <Icon size={13} color={color} />
                    </div>
                    <p style={{ color, fontSize: 22, fontWeight: 700, margin: 0, lineHeight: 1 }}>
                      {loading ? "…" : (stats[key] ?? 0).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* 포인트 지급 */}
        <PointPanel sbGet={sbGet} sbSet={sbSet} />

        {/* 충전 신청 목록 */}
        <ChargeRequestPanel sbList={sbList} sbGet={sbGet} sbSet={sbSet} />

        {/* Footer hint */}
        <p style={{ color: "#94a3b8", fontSize: 12, textAlign: "center", marginTop: 48 }}>
          Railway 환경변수 VITE_ADMIN_ID · VITE_ADMIN_PW 설정으로 계정을 변경할 수 있습니다
        </p>
      </main>
    </div>
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
