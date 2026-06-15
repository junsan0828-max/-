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
      `${_SB_URL}/rest/v1/dp_counters?key=eq.${key}&select=val`,
      { headers: _SB_HDR() }
    );
    const d = await r.json();
    return Array.isArray(d) && d.length ? (d[0].val ?? 0) : 0;
  } catch {
    return 0;
  }
}

function todayKey() {
  return new Date().toISOString().slice(0, 10).replace(/-/g, "");
}

interface StatCard {
  key: string;
  label: string;
  sub: string;
  color: string;
  Icon: React.ElementType;
}

const STAT_CARDS: StatCard[] = [
  { key: "visit_total",        label: "방문자 누적",  sub: "전체 기간",  color: "#34d399", Icon: Users },
  { key: `visit_${todayKey()}`, label: "오늘 방문자", sub: "오늘",       color: "#60a5fa", Icon: Activity },
  { key: "share_total",        label: "공유 누적",   sub: "전체 기간",  color: "#f472b6", Icon: Share2 },
  { key: `share_${todayKey()}`, label: "오늘 공유",  sub: "오늘",       color: "#fb923c", Icon: TrendingUp },
];

interface Service {
  id: string;
  name: string;
  desc: string;
  status: "active" | "pending";
  link: string | null;
  icon: string;
  badge?: string;
}

const SERVICES: Service[] = [
  {
    id: "diet-planner",
    name: "맞춤 식단 플래너",
    desc: "개인 맞춤형 AI 식단 생성 서비스. 식단 목적 · 현실식/건강식 스타일 지원.",
    status: "active",
    link: "/",
    icon: "🥗",
    badge: "운영중",
  },
  {
    id: "posture-line",
    name: "자세 분석 라인 드로잉",
    desc: "사진 위에 수평·수직·각도선을 그어 자세를 분석하는 도구. PNG 저장 지원.",
    status: "active",
    link: "/posture",
    icon: "🏋️",
    badge: "운영중",
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
    const results: Record<string, number> = {};
    await Promise.all(
      STAT_CARDS.map(async ({ key }) => {
        results[key] = await sbGet(key);
      })
    );
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

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 14,
            marginBottom: 40,
          }}
        >
          {STAT_CARDS.map(({ key, label, sub, color, Icon }) => (
            <div
              key={key}
              style={{
                background: "#1e293b",
                borderRadius: 12,
                padding: "20px 18px",
                borderTop: `3px solid ${color}`,
                border: `1px solid #334155`,
                borderTopColor: color,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 12,
                }}
              >
                <span style={{ color: "#64748b", fontSize: 12 }}>{label}</span>
                <Icon size={15} color={color} />
              </div>
              <p
                style={{
                  color: color,
                  fontSize: 26,
                  fontWeight: 700,
                  margin: "0 0 4px",
                  lineHeight: 1,
                }}
              >
                {loading ? "…" : (stats[key] ?? 0).toLocaleString()}
              </p>
              <p style={{ color: "#475569", fontSize: 11, margin: 0 }}>{sub}</p>
            </div>
          ))}
        </div>

        {/* Services Section */}
        <h2
          style={{
            color: "#f1f5f9",
            fontSize: 15,
            fontWeight: 700,
            margin: "0 0 16px",
          }}
        >
          서비스 관리
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16 }}>
          {SERVICES.map((svc) => {
            const isActive = svc.status === "active";
            return (
              <div
                key={svc.id}
                style={{
                  background: "#1e293b",
                  borderRadius: 14,
                  padding: 24,
                  border: `1px solid ${isActive ? "#065f46" : "#334155"}`,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    marginBottom: 16,
                  }}
                >
                  <div>
                    <span style={{ fontSize: 32 }}>{svc.icon}</span>
                    <h3
                      style={{
                        color: "#f1f5f9",
                        fontSize: 16,
                        fontWeight: 700,
                        margin: "10px 0 6px",
                      }}
                    >
                      {svc.name}
                    </h3>
                    <p style={{ color: "#64748b", fontSize: 13, margin: 0, lineHeight: 1.6 }}>
                      {svc.desc}
                    </p>
                  </div>
                  <span
                    style={{
                      background: isActive ? "#064e3b" : "#1e293b",
                      color: isActive ? "#34d399" : "#64748b",
                      fontSize: 11,
                      padding: "3px 10px",
                      borderRadius: 20,
                      fontWeight: 700,
                      border: `1px solid ${isActive ? "#065f46" : "#334155"}`,
                      whiteSpace: "nowrap",
                      marginLeft: 12,
                      flexShrink: 0,
                    }}
                  >
                    {svc.badge}
                  </span>
                </div>

                {svc.link ? (
                  <a
                    href={svc.link}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      background: "#059669",
                      color: "#fff",
                      textDecoration: "none",
                      borderRadius: 8,
                      padding: "8px 16px",
                      fontSize: 13,
                      fontWeight: 600,
                    }}
                  >
                    <ExternalLink size={13} />
                    서비스 열기
                  </a>
                ) : (
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      background: "#1e293b",
                      color: "#475569",
                      borderRadius: 8,
                      padding: "8px 16px",
                      fontSize: 13,
                      border: "1px solid #334155",
                    }}
                  >
                    통합 예정
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer hint */}
        <p style={{ color: "#334155", fontSize: 12, textAlign: "center", marginTop: 48 }}>
          Railway 환경변수 VITE_ADMIN_ID · VITE_ADMIN_PW 설정으로 계정을 변경할 수 있습니다
        </p>
      </main>
    </div>
  );
}
