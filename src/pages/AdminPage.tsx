import { useState, useEffect } from "react";
import {
  LayoutDashboard, LogOut, RefreshCw, ExternalLink,
  Eye, EyeOff, Users, Share2, TrendingUp, Activity,
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
      `${_SB_URL}/rest/v1/dp_counters?key=eq.${key}&select=value`,
      { headers: _SB_HDR() }
    );
    const d = await r.json();
    return Array.isArray(d) && d.length ? (d[0].value ?? 0) : 0;
  } catch {
    return 0;
  }
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
          background: "#0f172a",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "'Noto Sans KR', sans-serif",
        }}
      >
        <div
          style={{
            background: "#1e293b",
            borderRadius: 18,
            padding: "40px 36px",
            width: 360,
            boxShadow: "0 24px 64px rgba(0,0,0,0.6)",
            border: "1px solid #334155",
          }}
        >
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <div style={{ fontSize: 42, marginBottom: 10 }}>🔐</div>
            <h1
              style={{ color: "#f1f5f9", fontSize: 20, fontWeight: 700, margin: 0 }}
            >
              어드민 로그인
            </h1>
            <p style={{ color: "#64748b", fontSize: 13, margin: "8px 0 0" }}>
              서비스 관리자 전용 페이지입니다
            </p>
          </div>

          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: 14 }}>
              <label
                style={{
                  color: "#94a3b8",
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
                  background: "#0f172a",
                  border: "1px solid #334155",
                  borderRadius: 8,
                  padding: "11px 12px",
                  color: "#f1f5f9",
                  fontSize: 14,
                  boxSizing: "border-box",
                  outline: "none",
                }}
              />
            </div>

            <div style={{ marginBottom: 24, position: "relative" }}>
              <label
                style={{
                  color: "#94a3b8",
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
                  background: "#0f172a",
                  border: "1px solid #334155",
                  borderRadius: 8,
                  padding: "11px 40px 11px 12px",
                  color: "#f1f5f9",
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
                  color: "#64748b",
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
                background: "linear-gradient(135deg, #059669, #047857)",
                border: "none",
                borderRadius: 8,
                padding: "13px 0",
                color: "#fff",
                fontSize: 15,
                fontWeight: 700,
                cursor: "pointer",
                letterSpacing: "0.02em",
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
        background: "#0f172a",
        fontFamily: "'Noto Sans KR', sans-serif",
      }}
    >
      {/* Header */}
      <header
        style={{
          background: "#1e293b",
          borderBottom: "1px solid #334155",
          padding: "0 28px",
          height: 60,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <LayoutDashboard size={20} color="#34d399" />
          <span style={{ color: "#f1f5f9", fontSize: 17, fontWeight: 700 }}>
            어드민 대시보드
          </span>
          <span
            style={{
              background: "#064e3b",
              color: "#34d399",
              fontSize: 10,
              padding: "2px 8px",
              borderRadius: 20,
              fontWeight: 700,
              letterSpacing: "0.05em",
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
            background: "#334155",
            border: "none",
            borderRadius: 8,
            padding: "8px 14px",
            color: "#94a3b8",
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
          <h2 style={{ color: "#f1f5f9", fontSize: 15, fontWeight: 700, margin: 0 }}>
            통계 현황
          </h2>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {lastRefresh && (
              <span style={{ color: "#475569", fontSize: 12 }}>
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
                background: "#1e293b",
                border: "1px solid #334155",
                borderRadius: 8,
                padding: "6px 12px",
                color: "#94a3b8",
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

        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 20, marginBottom: 40 }}>
          {SERVICES.map((svc) => (
            <div
              key={svc.id}
              style={{
                background: "#1e293b",
                borderRadius: 14,
                padding: 24,
                border: "1px solid #065f46",
              }}
            >
              {/* Service header */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
                <div>
                  <h3 style={{ color: "#f1f5f9", fontSize: 15, fontWeight: 700, margin: "0 0 4px" }}>
                    {svc.name}
                  </h3>
                  <p style={{ color: "#64748b", fontSize: 12, margin: 0 }}>{svc.desc}</p>
                </div>
                <a
                  href={svc.link}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                    background: "#064e3b",
                    color: "#34d399",
                    textDecoration: "none",
                    borderRadius: 8,
                    padding: "6px 12px",
                    fontSize: 12,
                    fontWeight: 600,
                    flexShrink: 0,
                    marginLeft: 12,
                  }}
                >
                  <ExternalLink size={12} />
                  열기
                </a>
              </div>

              {/* Per-service stat grid */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
                {[
                  { key: svc.vcKey, label: "누적 방문", color: "#34d399", Icon: Users },
                  { key: svc.vtKey, label: "오늘 방문", color: "#60a5fa", Icon: Activity },
                  { key: svc.scKey, label: "누적 공유", color: "#f472b6", Icon: Share2 },
                  { key: svc.stKey, label: "오늘 공유", color: "#fb923c", Icon: TrendingUp },
                ].map(({ key, label, color, Icon }) => (
                  <div
                    key={key}
                    style={{
                      background: "#0f172a",
                      borderRadius: 10,
                      padding: "14px 12px",
                      borderTop: `3px solid ${color}`,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                      <span style={{ color: "#64748b", fontSize: 11 }}>{label}</span>
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

        {/* Footer hint */}
        <p style={{ color: "#334155", fontSize: 12, textAlign: "center", marginTop: 48 }}>
          Railway 환경변수 VITE_ADMIN_ID · VITE_ADMIN_PW 설정으로 계정을 변경할 수 있습니다
        </p>
      </main>
    </div>
  );
}
