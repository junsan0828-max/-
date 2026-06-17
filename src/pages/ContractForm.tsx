import { useState, useEffect } from "react";
import { User, Zap, FileText, CreditCard, ChevronDown, ChevronUp, Lock, Settings, Copy, Check as CheckIcon } from "lucide-react";

// ── Supabase ──────────────────────────────────────────────────────────────────
const _SB  = (import.meta.env.VITE_SUPABASE_URL  as string | undefined) ?? "";
const _SK  = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ?? "";
const _SH  = () => ({ "Content-Type": "application/json", apikey: _SK, Authorization: `Bearer ${_SK}` });

async function dbGet(key: string): Promise<number> {
  if (!_SB || !_SK) return 0;
  try {
    const r = await fetch(`${_SB}/rest/v1/dp_counters?key=eq.${encodeURIComponent(key)}&select=value`, { headers: _SH() });
    const d = await r.json();
    return Array.isArray(d) && d.length ? (d[0].value ?? 0) : 0;
  } catch { return 0; }
}
async function dbSet(key: string, value: number): Promise<void> {
  if (!_SB || !_SK) return;
  try {
    await fetch(`${_SB}/rest/v1/dp_counters`, {
      method: "POST",
      headers: { ..._SH(), "Prefer": "resolution=merge-duplicates" },
      body: JSON.stringify({ key, value }),
    });
  } catch {}
}
async function dbInc(key: string): Promise<void> {
  if (!_SB || !_SK) return;
  try {
    await fetch(`${_SB}/rest/v1/rpc/dp_inc_counter`, {
      method: "POST", headers: _SH(), body: JSON.stringify({ p_key: key }),
    });
  } catch {}
}

// ── Kakao PKCE ───────────────────────────────────────────────────────────────
function generateCodeVerifier() {
  const a = new Uint8Array(32); crypto.getRandomValues(a);
  return btoa(String.fromCharCode(...a)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}
async function generateCodeChallenge(v: string) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(v));
  return btoa(String.fromCharCode(...new Uint8Array(d))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

// ── Constants ─────────────────────────────────────────────────────────────────
const DAILY_FREE   = 2;
const POINT_COST   = 300;  // 일반 회원
const FS_POINT_COST = 150; // 핏스텝 회원 50% 할인

function todayKey() { return new Date().toISOString().slice(0, 10).replace(/-/g, ""); }
function todayISO() { return new Date().toISOString().slice(0, 10); }

interface KakaoUser { name: string; thumbnail?: string; id?: string; }

interface F {
  name: string; phone: string; contractDate: string;
  type: string; program: string; listPrice: string; discount: string;
  paidAmount: string; unpaid: string; payMethod: string; payDate: string;
  startDate: string; center: string; trainer: string; adConsent: string;
  payMethod1: string; payMethod2: string; payAmount1: string; payAmount2: string;
}
const DEF: F = {
  name: "", phone: "", contractDate: todayISO(),
  type: "신규", program: "", listPrice: "", discount: "0",
  paidAmount: "", unpaid: "0", payMethod: "카드", payDate: todayISO(),
  startDate: todayISO(), center: "FIT STEP", trainer: "", adConsent: "yes",
  payMethod1: "카드", payMethod2: "현금", payAmount1: "", payAmount2: "",
};

// ── Default Terms ─────────────────────────────────────────────────────────────
const DEFAULT_TERMS_CF = [
  { title: "이용 목적",     body: "회원은 본 센터의 시설 및 서비스를 건강 증진 및 체력 향상의 목적으로만 이용하여야 하며, 타인에게 방해가 되는 행위를 하여서는 아니 됩니다." },
  { title: "환불 규정",     body: "등록 후 7일 이내 미이용 시 전액 환불이 가능합니다. 이용 개시 후에는 소비자보호법 및 공정거래위원회 지침에 따라 잔여 기간에 대한 비례 환불이 적용됩니다. 단, 회원의 귀책사유로 인한 중도 해지 시 위약금이 발생할 수 있습니다." },
  { title: "시설 이용 규칙", body: "회원은 센터 내 기구 및 시설을 지정된 방법으로 사용하여야 하며, 사용 후 정리정돈을 철저히 하여야 합니다. 운동복 및 운동화 착용은 필수이며, 타인을 배려하는 에티켓을 준수하여야 합니다." },
  { title: "부상 및 사고",  body: "운동 중 발생하는 부상에 대하여 회원은 사전에 본인의 건강 상태를 확인하고 무리한 운동을 자제하여야 합니다. 센터는 회원의 안전을 위해 최선을 다하나, 회원의 과실로 인한 부상에 대해서는 책임을 지지 않습니다." },
  { title: "개인 용품 및 귀중품", body: "센터 내 귀중품 분실에 대하여 센터는 책임을 지지 않습니다. 귀중품은 반드시 사물함에 보관하시고, 분실 방지를 위해 개인 관리를 철저히 하여 주시기 바랍니다." },
  { title: "계약 변경 및 양도", body: "본 계약의 내용을 변경하거나 회원권을 타인에게 양도하고자 할 경우에는 센터 운영자와 협의하여 서면으로 처리하여야 합니다. 무단 양도 시 계약이 해지될 수 있습니다." },
];
function loadSavedTerms() {
  try {
    const s = localStorage.getItem("ct_terms");
    if (s) { const p = JSON.parse(s); if (Array.isArray(p) && p.length === 6) return p as { title: string; body: string }[]; }
  } catch {}
  return DEFAULT_TERMS_CF.map(t => ({ ...t }));
}

// ── Inline style helpers ──────────────────────────────────────────────────────
const IS: React.CSSProperties = {
  width: "100%", background: "#ffffff", border: "1px solid #e2e8f0",
  borderRadius: 8, padding: "10px 12px", color: "#0f172a", fontSize: 14,
  boxSizing: "border-box", outline: "none",
};
const IS_G: React.CSSProperties = { ...IS, color: "#2563eb", fontWeight: 600 };

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "#ffffff", borderRadius: 14, padding: "16px", border: "1px solid #e2e8f0", boxShadow: "0 1px 4px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)" }}>
      <p style={{ color: "#2563eb", fontSize: 11, fontWeight: 800, letterSpacing: "0.1em", margin: "0 0 12px", textTransform: "uppercase" as const }}>{title}</p>
      {children}
    </div>
  );
}
function Row({ children }: { children: React.ReactNode }) {
  return <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 10, marginBottom: 10 }}>{children}</div>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p style={{ color: "#475569", fontSize: 11, fontWeight: 600, margin: "0 0 5px" }}>{label}</p>
      {children}
    </div>
  );
}

// ── Contract Preview Modal ────────────────────────────────────────────────────
function ContractPreviewModal({ onStart }: { onStart: () => void }) {
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(15,23,42,0.7)", zIndex: 1000,
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      padding: "20px 16px", overflowY: "auto",
    }}>
      <div style={{ maxWidth: 380, width: "100%" }}>
        {/* 타이틀 */}
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <p style={{ color: "#93c5fd", fontSize: 11, fontWeight: 800, letterSpacing: "0.15em", margin: "0 0 6px" }}>FIT STEP</p>
          <h1 style={{ color: "#f1f5f9", fontSize: 22, fontWeight: 800, margin: "0 0 8px", lineHeight: 1.3 }}>전자 회원 계약서</h1>
          <p style={{ color: "#94a3b8", fontSize: 13, margin: 0, lineHeight: 1.6 }}>회원 정보를 입력하면 아래와 같은<br/>계약서가 즉시 생성됩니다</p>
        </div>

        {/* 계약서 미니 프리뷰 */}
        <div style={{
          background: "#fff", borderRadius: 12, padding: "16px 14px", marginBottom: 20,
          boxShadow: "0 8px 40px rgba(0,0,0,0.5)",
          fontFamily: "'Noto Sans KR', sans-serif",
          transform: "scale(1)", transformOrigin: "top center",
        }}>
          {/* 계약서 헤더 */}
          <div style={{ borderBottom: "2px solid #111", paddingBottom: 8, marginBottom: 10, textAlign: "center" }}>
            <p style={{ fontSize: 7, color: "#2563eb", fontWeight: 800, letterSpacing: "0.1em", margin: "0 0 2px" }}>FIT STEP</p>
            <p style={{ fontSize: 13, fontWeight: 800, color: "#111", margin: "0 0 2px" }}>회 원 계 약 서</p>
            <p style={{ fontSize: 7, color: "#555", margin: 0 }}>Member Contract</p>
          </div>

          {/* 회원 정보 섹션 */}
          <p style={{ fontSize: 7, fontWeight: 800, color: "#2563eb", letterSpacing: "0.08em", margin: "0 0 5px" }}>▪ 회원 정보</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, marginBottom: 8 }}>
            {[["성명", "홍 길 동"],["연락처", "010-0000-0000"],["계약일", "2026-06-16"],["담당 운동전문가", "김트레이너"]].map(([l,v]) => (
              <div key={l} style={{ borderBottom: "1px solid #ddd", paddingBottom: 3 }}>
                <p style={{ fontSize: 6, color: "#888", margin: "0 0 1px" }}>{l}</p>
                <p style={{ fontSize: 8, fontWeight: 700, color: "#111", margin: 0 }}>{v}</p>
              </div>
            ))}
          </div>

          {/* 등록 내역 */}
          <p style={{ fontSize: 7, fontWeight: 800, color: "#2563eb", letterSpacing: "0.08em", margin: "0 0 5px" }}>▪ 등록 내역</p>
          <div style={{ background: "#f8f8f8", borderRadius: 4, padding: "5px 6px", marginBottom: 8 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 4 }}>
              {[["프로그램","PT 12회"],["정가","300,000원"],["실결제","250,000원"]].map(([l,v]) => (
                <div key={l}>
                  <p style={{ fontSize: 5.5, color: "#888", margin: "0 0 1px" }}>{l}</p>
                  <p style={{ fontSize: 7.5, fontWeight: 700, color: "#111", margin: 0 }}>{v}</p>
                </div>
              ))}
            </div>
          </div>

          {/* 이용약관 */}
          <p style={{ fontSize: 7, fontWeight: 800, color: "#2563eb", letterSpacing: "0.08em", margin: "0 0 4px" }}>▪ 이용약관</p>
          {["제1조 이용 목적","제2조 환불 규정","제3조 시설 이용 규칙"].map(t => (
            <div key={t} style={{ borderBottom: "1px solid #eee", paddingBottom: 3, marginBottom: 3 }}>
              <p style={{ fontSize: 6.5, fontWeight: 700, color: "#333", margin: "0 0 1px" }}>{t}</p>
              <div style={{ height: 5, background: "#f0f0f0", borderRadius: 2, marginBottom: 1 }} />
              <div style={{ height: 4, background: "#f0f0f0", borderRadius: 2, width: "80%" }} />
            </div>
          ))}
          <p style={{ fontSize: 6, color: "#aaa", margin: "3px 0 8px" }}>…외 3개 조항</p>

          {/* 서명 */}
          <p style={{ fontSize: 7, fontWeight: 800, color: "#2563eb", letterSpacing: "0.08em", margin: "0 0 5px" }}>▪ 서명</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ border: "1px solid #ddd", borderRadius: 4, padding: "4px 6px" }}>
              <p style={{ fontSize: 6, color: "#888", margin: "0 0 2px" }}>회원 서명</p>
              <div style={{ height: 20, background: "#fafafa", borderRadius: 3, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="60" height="16" viewBox="0 0 60 16">
                  <path d="M5,12 Q15,2 25,8 Q35,14 45,4 Q52,1 58,6" stroke="#1a1a1a" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
                </svg>
              </div>
            </div>
            <div style={{ border: "1px solid #ddd", borderRadius: 4, padding: "4px 6px" }}>
              <p style={{ fontSize: 6, color: "#888", margin: "0 0 1px" }}>담당 운동전문가</p>
              <p style={{ fontSize: 8, fontWeight: 700, color: "#111", margin: 0 }}>김트레이너</p>
            </div>
          </div>

          {/* 인쇄/공유 버튼 힌트 */}
          <div style={{ display: "flex", gap: 4, marginTop: 10 }}>
            <div style={{ flex:1, background:"#1a1a1a", borderRadius:3, padding:"4px 0", textAlign:"center" }}>
              <p style={{ fontSize:7, color:"#fff", fontWeight:700, margin:0 }}>🖨 인쇄</p>
            </div>
            <div style={{ flex:1, background:"#FEE500", borderRadius:3, padding:"4px 0", textAlign:"center" }}>
              <p style={{ fontSize:7, color:"#000", fontWeight:700, margin:0 }}>📤 카카오 공유</p>
            </div>
          </div>
        </div>

        {/* CTA 버튼 */}
        <button onClick={onStart}
          style={{ width:"100%", background:"linear-gradient(135deg,#2563eb,#1d4ed8)", border:"none", borderRadius:14, padding:"18px 0", color:"#fff", fontSize:17, fontWeight:800, cursor:"pointer", letterSpacing:"0.02em", boxShadow:"0 4px 20px rgba(37,99,235,0.15)" }}>
          전자계약서 제작하기 →
        </button>
        <p style={{ color:"#94a3b8", fontSize:11, textAlign:"center", margin:"12px 0 0" }}>
          하루 2회 무료 · 이후 300P/건 (핏스텝 회원 150P)
        </p>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function ContractForm() {
  const [kakaoUser, setKakaoUser] = useState<KakaoUser | null>(null);
  const [userType,  setUserType]  = useState("guest");
  const [freeUsed,  setFreeUsed]  = useState(0);
  const [points,    setPoints]    = useState(0);
  const [loading,   setLoading]   = useState(false);
  const [form,      setForm]      = useState<F>(DEF);
  const [showIntro,    setShowIntro]    = useState(true);
  const [showPurchase, setShowPurchase] = useState(false);
  const [showTermsEdit, setShowTermsEdit] = useState(false);
  const [terms, setTerms] = useState<{ title: string; body: string }[]>(loadSavedTerms);
  const [termsSaved, setTermsSaved] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const [reqAmount, setReqAmount] = useState("");
  const [reqDone, setReqDone] = useState(false);
  const [reqBusy, setReqBusy] = useState(false);
  const [error,     setError]     = useState("");
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("dp_kakao_user");
      if (stored) {
        const u = JSON.parse(stored) as KakaoUser;
        setKakaoUser(u);
        const ut = localStorage.getItem("dp_ut") || "member";
        setUserType(ut);
        if (u.id) loadStats(u.id);
      }
    } catch {}
  }, []);

  async function loadStats(userId: string) {
    setLoading(true);
    const t = todayKey();
    const [free, pts] = await Promise.all([
      dbGet(`ct_df_${userId}_${t}`),
      dbGet(`ct_pt_${userId}`),
    ]);
    setFreeUsed(free);
    setPoints(pts);
    setLoading(false);
  }

  async function handleKakaoLogin() {
    const appKey = import.meta.env.VITE_KAKAO_APP_KEY as string | undefined;
    if (!appKey) return;
    const verifier = generateCodeVerifier();
    sessionStorage.setItem("kakao_pkce_verifier", verifier);
    sessionStorage.setItem("login_return", "/contract");
    const challenge = await generateCodeChallenge(verifier);
    window.location.href =
      `https://kauth.kakao.com/oauth/authorize?client_id=${appKey}` +
      `&redirect_uri=${encodeURIComponent(window.location.origin + "/")}` +
      `&response_type=code&code_challenge=${challenge}&code_challenge_method=S256` +
      `&scope=profile_nickname,profile_image`;
  }

  function handleLogout() {
    localStorage.removeItem("dp_kakao_user");
    setKakaoUser(null); setUserType("guest"); setFreeUsed(0); setPoints(0);
  }

  function set(k: keyof F, v: string) {
    setForm(f => {
      const n = { ...f, [k]: v };
      if (k === "listPrice" || k === "discount") {
        const lp = Number((k === "listPrice" ? v : n.listPrice).replace(/,/g, ""));
        const dc = Number((k === "discount"  ? v : n.discount ).replace(/,/g, ""));
        if (!isNaN(lp) && !isNaN(dc)) n.paidAmount = String(lp - dc);
      }
      // 혼합결제: amount1 입력 시 amount2 자동 계산
      if (k === "payAmount1") {
        const paid = Number(n.paidAmount);
        const a1   = Number(v);
        if (!isNaN(paid) && !isNaN(a1) && paid > 0) n.payAmount2 = String(paid - a1);
      }
      if (k === "payAmount2") {
        const paid = Number(n.paidAmount);
        const a2   = Number(v);
        if (!isNaN(paid) && !isNaN(a2) && paid > 0) n.payAmount1 = String(paid - a2);
      }
      return n;
    });
  }

  const SUB_METHODS = ["카드", "현금", "계좌이체", "지역화폐", "현금영수증", "기타"];

  function setTerm(idx: number, field: "title" | "body", val: string) {
    setTerms(prev => prev.map((t, i) => i === idx ? { ...t, [field]: val } : t));
    setTermsSaved(false);
  }
  function saveTerms() {
    localStorage.setItem("ct_terms", JSON.stringify(terms));
    setTermsSaved(true);
    setTimeout(() => setTermsSaved(false), 2000);
  }
  function resetTerms() {
    const def = DEFAULT_TERMS_CF.map(t => ({ ...t }));
    setTerms(def);
    localStorage.setItem("ct_terms", JSON.stringify(def));
    setTermsSaved(true);
    setTimeout(() => setTermsSaved(false), 2000);
  }
  async function submitChargeRequest() {
    if (!kakaoUser?.id || !reqAmount) return;
    setReqBusy(true);
    const now = new Date();
    const ts = now.toISOString().replace(/[^0-9]/g, "").slice(0, 14);
    const key = `ct_req__${ts}__${kakaoUser.id}__${reqAmount}__${kakaoUser.name}`;
    await dbSet(key, 1);
    setReqDone(true);
    setReqBusy(false);
  }

  function copyKakaoId() {
    if (kakaoUser?.id) {
      navigator.clipboard.writeText(kakaoUser.id).catch(() => {});
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    }
  }

  async function handleGenerate() {
    if (!kakaoUser?.id) { setError("로그인이 필요합니다."); return; }
    if (!form.name.trim()) { setError("성명을 입력해주세요."); return; }
    setError(""); setGenerating(true);

    const uid = kakaoUser.id;
    const t   = todayKey();

    const cost = userType === "fitstep" ? FS_POINT_COST : POINT_COST;
    if (freeUsed < DAILY_FREE) {
      await dbInc(`ct_df_${uid}_${t}`);
      setFreeUsed(f => f + 1);
    } else if (points >= cost) {
      const np = points - cost;
      await dbSet(`ct_pt_${uid}`, np);
      setPoints(np);
    } else {
      setError("무료 횟수를 소진했고 포인트가 부족합니다.");
      setShowPurchase(true);
      setGenerating(false);
      return;
    }

    await dbInc("ct_vc");
    await dbInc(`ct_vt_${t}`);

    const p = new URLSearchParams();
    (Object.entries(form) as [keyof F, string][]).forEach(([k, v]) => { if (v) p.set(k, v); });
    window.location.href = `/contract?${p.toString()}`;
  }

  const pointCost  = userType === "fitstep" ? FS_POINT_COST : POINT_COST;
  const isFree     = freeUsed < DAILY_FREE;
  const canGen     = !!kakaoUser && (isFree || points >= pointCost);

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", fontFamily: "'Noto Sans KR', sans-serif", paddingBottom: 40 }}>
      {showIntro && <ContractPreviewModal onStart={() => setShowIntro(false)} />}

      {/* Header */}
      <div style={{ padding: "16px 16px 12px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #e2e8f0", background: "#ffffff" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 46, height: 46, background: "#eff6ff", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <FileText size={24} color="#2563eb" />
          </div>
          <div>
            <p style={{ color: "#2563eb", fontSize: 10, fontWeight: 800, margin: "0 0 2px", letterSpacing: "0.12em" }}>FIT STEP</p>
            <h1 style={{ color: "#0f172a", fontSize: 16, fontWeight: 700, margin: 0 }}>전자 회원 계약서</h1>
          </div>
        </div>
        {kakaoUser ? (
          <button onClick={handleLogout} style={{ display:"flex", alignItems:"center", gap:5, background:"#eff6ff", border:"1px solid #bfdbfe", borderRadius:10, padding:"7px 10px", color:"#2563eb", fontSize:12, cursor:"pointer", flexShrink:0 }}>
            {kakaoUser.thumbnail ? <img src={kakaoUser.thumbnail} alt="" style={{ width:18, height:18, borderRadius:"50%", objectFit:"cover" }} /> : <User size={14}/>}
            <span style={{ maxWidth:60, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{kakaoUser.name}</span>
            {userType === "fitstep" && <Zap size={11} color="#f59e0b"/>}
          </button>
        ) : (
          <button onClick={handleKakaoLogin} style={{ display:"flex", alignItems:"center", gap:5, background:"#FEE500", border:"none", borderRadius:10, padding:"9px 14px", color:"#000", fontSize:13, fontWeight:700, cursor:"pointer", flexShrink:0 }}>
            <User size={14}/> 로그인
          </button>
        )}
      </div>

      <div style={{ padding: "0 16px" }}>

        {/* FIT STEP 배너 */}
        <div style={{ background:"linear-gradient(135deg,#1d4ed8,#2563eb)", borderRadius:16, padding:"16px", margin:"14px 0 4px" }}>
          <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:12 }}>
            <div style={{ width:42, height:42, background:"rgba(255,255,255,0.15)", borderRadius:10, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
              <Zap size={22} color="#ffffff"/>
            </div>
            <div style={{ flex:1 }}>
              <p style={{ color:"#bfdbfe", fontWeight:800, fontSize:11, margin:"0 0 2px", letterSpacing:"0.1em" }}>FIT STEP 회원 혜택</p>
              <p style={{ color:"#fff", fontWeight:800, fontSize:15, margin:0, lineHeight:1.3, wordBreak:"keep-all" as const }}>전자계약서 50% 할인!</p>
            </div>
          </div>
          <p style={{ color:"#dbeafe", fontSize:12, margin:"0 0 14px", lineHeight:1.6 }}>
            핏스텝 회원은 건당 <strong style={{ color:"#ffffff" }}>{FS_POINT_COST}P</strong>로 이용 가능 (일반 {POINT_COST}P의 50% 할인).<br/>
            비회원은 하루 {DAILY_FREE}회 무료 · 이후 {POINT_COST}P/건
          </p>
          <a href="https://fitstep.co.kr/?ref=contract" target="_blank" rel="noreferrer"
            style={{ display:"block", background:"#ffffff", color:"#2563eb", textDecoration:"none", borderRadius:10, padding:"12px 0", textAlign:"center", fontWeight:800, fontSize:14, letterSpacing:"0.02em" }}>
            핏스텝 회원 가입하기 →
          </a>
        </div>

        {/* 사용량 & 포인트 */}
        {kakaoUser && (
          <div style={{ padding: "12px 0" }}>
            <div style={{ background: "#ffffff", borderRadius: 12, padding: "12px 16px", display: "flex", alignItems: "center", border: "1px solid #e2e8f0", boxShadow: "0 1px 4px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)" }}>
              <div style={{ flex: 1 }}>
                <p style={{ color: "#94a3b8", fontSize: 11, margin: "0 0 2px" }}>오늘 무료</p>
                <p style={{ color: "#0f172a", fontWeight: 700, fontSize: 18, margin: 0 }}>
                  {loading ? "…" : freeUsed}<span style={{ color: "#94a3b8", fontSize: 12 }}>/{DAILY_FREE}회</span>
                </p>
              </div>
              <div style={{ width: 1, height: 32, background: "#e2e8f0" }} />
              <div style={{ flex: 1, textAlign: "center" }}>
                <p style={{ color: "#94a3b8", fontSize: 11, margin: "0 0 2px" }}>핏포인트</p>
                <p style={{ color: "#f59e0b", fontWeight: 700, fontSize: 18, margin: 0 }}>
                  {loading ? "…" : points.toLocaleString()}<span style={{ color: "#94a3b8", fontSize: 12 }}> P</span>
                </p>
              </div>
              <div style={{ width: 1, height: 32, background: "#e2e8f0" }} />
              <div style={{ flex: 1, textAlign: "right" }}>
                <p style={{ color: "#94a3b8", fontSize: 11, margin: "0 0 2px" }}>건당 차감</p>
                <p style={{ color: "#2563eb", fontWeight: 700, fontSize: 18, margin: 0 }}>
                  {pointCost}<span style={{ color: "#94a3b8", fontSize: 12 }}> P</span>
                  {userType === "fitstep" && <span style={{ color: "#f59e0b", fontSize: 10, marginLeft: 4 }}>50%↓</span>}
                </p>
              </div>
            </div>
            {/* Kakao ID row — for admin point grant */}
            {kakaoUser.id && (
              <div style={{ marginTop: 8, background: "#eff6ff", borderRadius: 10, padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", border: "1px solid #bfdbfe" }}>
                <div>
                  <p style={{ color: "#475569", fontSize: 10, margin: "0 0 2px" }}>카카오 ID (포인트 충전 시 어드민에 전달)</p>
                  <p style={{ color: "#2563eb", fontWeight: 700, fontSize: 14, margin: 0, fontFamily: "monospace" }}>{kakaoUser.id}</p>
                </div>
                <button onClick={copyKakaoId}
                  style={{ display:"flex", alignItems:"center", gap:4, background: copiedId ? "#eff6ff" : "#ffffff", border:`1px solid ${copiedId ? "#2563eb" : "#e2e8f0"}`, borderRadius:8, padding:"7px 12px", color: copiedId ? "#2563eb" : "#475569", fontSize:12, cursor:"pointer" }}>
                  {copiedId ? <CheckIcon size={13}/> : <Copy size={13}/>}
                  {copiedId ? "복사됨" : "복사"}
                </button>
              </div>
            )}
          </div>
        )}

        {/* 로그인 필요 */}
        {!kakaoUser && (
          <div style={{ padding: "24px 0" }}>
            <div style={{ background: "#ffffff", borderRadius: 14, padding: "28px 16px", textAlign: "center", border: "1px solid #e2e8f0", boxShadow: "0 1px 4px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)" }}>
              <Lock size={36} color="#94a3b8" style={{ marginBottom: 14 }} />
              <p style={{ color: "#475569", fontSize: 14, margin: "0 0 20px", lineHeight: 1.6 }}>계약서를 작성하려면<br/>카카오 로그인이 필요합니다</p>
              <button onClick={handleKakaoLogin} style={{ background: "#FEE500", border: "none", borderRadius: 10, padding: "13px 36px", color: "#000", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>
                카카오 로그인
              </button>
            </div>
          </div>
        )}

        {/* ── 회원 정보 ── */}
        <div style={{ marginBottom: 12 }}>
          <Section title="회원 정보">
            <Row>
              <Field label="성명 *"><input value={form.name} onChange={e=>set("name",e.target.value)} placeholder="홍길동" style={IS} /></Field>
              <Field label="연락처"><input value={form.phone} onChange={e=>set("phone",e.target.value)} placeholder="010-0000-0000" style={IS} /></Field>
            </Row>
            <Row>
              <Field label="계약일"><input type="date" value={form.contractDate} onChange={e=>set("contractDate",e.target.value)} style={IS} /></Field>
              <Field label="담당 운동전문가"><input value={form.trainer} onChange={e=>set("trainer",e.target.value)} placeholder="이름" style={IS} /></Field>
            </Row>
            <Row>
              <Field label="센터명"><input value={form.center} onChange={e=>set("center",e.target.value)} style={IS} /></Field>
            </Row>
          </Section>
        </div>

        {/* ── 등록 내역 ── */}
        <div style={{ marginBottom: 12 }}>
          <Section title="등록 내역">
            <Row>
              <Field label="구분">
                <select value={form.type} onChange={e=>set("type",e.target.value)} style={IS}>
                  {["신규","재등록","추가","연장"].map(v=><option key={v}>{v}</option>)}
                </select>
              </Field>
              <Field label="프로그램"><input value={form.program} onChange={e=>set("program",e.target.value)} placeholder="PT 12회" style={IS} /></Field>
            </Row>
            <Row>
              <Field label="정가 (원)"><input type="number" value={form.listPrice} onChange={e=>set("listPrice",e.target.value)} placeholder="0" style={IS} /></Field>
              <Field label="할인 (원)"><input type="number" value={form.discount} onChange={e=>set("discount",e.target.value)} placeholder="0" style={IS} /></Field>
            </Row>
            <Row>
              <Field label="실결제 (원)"><input type="number" value={form.paidAmount} onChange={e=>set("paidAmount",e.target.value)} placeholder="자동계산" style={IS_G} /></Field>
              <Field label="미수금 (원)"><input type="number" value={form.unpaid} onChange={e=>set("unpaid",e.target.value)} placeholder="0" style={IS} /></Field>
            </Row>
            <Row>
              <Field label="결제방법">
                <select value={form.payMethod} onChange={e=>set("payMethod",e.target.value)} style={IS}>
                  {["카드","현금","계좌이체","지역화폐","현금영수증","기타","혼합결제"].map(v=><option key={v}>{v}</option>)}
                </select>
              </Field>
              <Field label="결제일"><input type="date" value={form.payDate} onChange={e=>set("payDate",e.target.value)} style={IS} /></Field>
            </Row>
            {/* 혼합결제 상세 */}
            {form.payMethod === "혼합결제" && (
              <div style={{ background:"#eff6ff", borderRadius:10, padding:"12px 14px", marginBottom:10, border:"1px solid #bfdbfe" }}>
                <p style={{ color:"#2563eb", fontSize:11, fontWeight:700, margin:"0 0 10px", letterSpacing:"0.05em" }}>혼합결제 구성</p>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:8 }}>
                  <Field label="결제수단 ①">
                    <select value={form.payMethod1} onChange={e=>set("payMethod1",e.target.value)} style={IS}>
                      {SUB_METHODS.map(v=><option key={v}>{v}</option>)}
                    </select>
                  </Field>
                  <Field label="금액 ①">
                    <input type="number" value={form.payAmount1} onChange={e=>set("payAmount1",e.target.value)} placeholder="0" style={IS} />
                  </Field>
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                  <Field label="결제수단 ②">
                    <select value={form.payMethod2} onChange={e=>set("payMethod2",e.target.value)} style={IS}>
                      {SUB_METHODS.map(v=><option key={v}>{v}</option>)}
                    </select>
                  </Field>
                  <Field label="금액 ②">
                    <input type="number" value={form.payAmount2} onChange={e=>set("payAmount2",e.target.value)} placeholder="0" style={IS} />
                  </Field>
                </div>
                {form.paidAmount && form.payAmount1 && form.payAmount2 && (
                  <p style={{ color: Number(form.payAmount1)+Number(form.payAmount2)===Number(form.paidAmount) ? "#059669" : "#dc2626", fontSize:11, margin:"8px 0 0", fontWeight:600 }}>
                    {Number(form.payAmount1)+Number(form.payAmount2)===Number(form.paidAmount)
                      ? `✓ 합계 ${Number(form.paidAmount).toLocaleString()}원 일치`
                      : `⚠ 합계 ${(Number(form.payAmount1)+Number(form.payAmount2)).toLocaleString()}원 — 실결제 ${Number(form.paidAmount).toLocaleString()}원과 다름`}
                  </p>
                )}
              </div>
            )}
            <Row>
              <Field label="시작일"><input type="date" value={form.startDate} onChange={e=>set("startDate",e.target.value)} style={IS} /></Field>
            </Row>
          </Section>
        </div>

        {/* ── 광고 수신 동의 ── */}
        <div style={{ marginBottom: 12 }}>
          <Section title="광고성 정보 수신 동의 (선택)">
            <div style={{ display: "flex", gap: 10 }}>
              {[{ v:"yes",l:"동의함" },{ v:"no",l:"동의하지 않음" }].map(({ v, l }) => (
                <button key={v} onClick={() => set("adConsent", v)}
                  style={{ flex:1, padding:"10px 0", borderRadius:8, border:`2px solid ${form.adConsent===v?"#2563eb":"#e2e8f0"}`, background: form.adConsent===v?"#eff6ff":"#ffffff", color: form.adConsent===v?"#2563eb":"#94a3b8", fontSize:13, fontWeight:600, cursor:"pointer" }}>
                  {l}
                </button>
              ))}
            </div>
          </Section>
        </div>

        {/* ── 이용약관 설정 ── */}
        <div style={{ border:"1px solid #e2e8f0", borderRadius:14, overflow:"hidden", marginBottom:12, boxShadow:"0 1px 4px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)" }}>
          <button onClick={() => setShowTermsEdit(v => !v)}
            style={{ width:"100%", background:"#ffffff", border:"none", padding:"14px 16px", display:"flex", alignItems:"center", justifyContent:"space-between", color:"#475569", fontSize:13, fontWeight:600, cursor:"pointer" }}>
            <span style={{ display:"flex", alignItems:"center", gap:6 }}><Settings size={15} color="#2563eb"/> 이용약관 설정</span>
            {showTermsEdit ? <ChevronUp size={15} color="#94a3b8"/> : <ChevronDown size={15} color="#94a3b8"/>}
          </button>
          {showTermsEdit && (
            <div style={{ background:"#f8fafc", padding:"16px", borderTop:"1px solid #e2e8f0" }}>
              <p style={{ color:"#94a3b8", fontSize:11, margin:"0 0 14px" }}>수정 후 저장하면 이후 생성되는 모든 계약서에 적용됩니다.</p>
              {terms.map((term, idx) => (
                <div key={idx} style={{ marginBottom: 16, background:"#ffffff", borderRadius:10, padding:"12px 14px", border:"1px solid #e2e8f0" }}>
                  <p style={{ color:"#2563eb", fontSize:10, fontWeight:700, margin:"0 0 6px" }}>제{idx+1}조</p>
                  <input
                    value={term.title}
                    onChange={e => setTerm(idx, "title", e.target.value)}
                    placeholder={`제${idx+1}조 제목`}
                    style={{ ...IS, marginBottom:8, fontSize:12, fontWeight:600 }}
                  />
                  <textarea
                    value={term.body}
                    onChange={e => setTerm(idx, "body", e.target.value)}
                    rows={3}
                    style={{ ...IS, resize:"vertical" as const, lineHeight:1.6 }}
                  />
                </div>
              ))}
              <div style={{ display:"flex", gap:10 }}>
                <button onClick={saveTerms}
                  style={{ flex:2, background: termsSaved ? "#eff6ff" : "linear-gradient(135deg,#2563eb,#1d4ed8)", border: termsSaved ? "1px solid #2563eb" : "none", borderRadius:10, padding:"12px 0", color: termsSaved ? "#2563eb" : "#fff", fontSize:14, fontWeight:700, cursor:"pointer" }}>
                  {termsSaved ? "저장됨 ✓" : "저장"}
                </button>
                <button onClick={resetTerms}
                  style={{ flex:1, background:"#ffffff", border:"1px solid #e2e8f0", borderRadius:10, padding:"12px 0", color:"#475569", fontSize:13, cursor:"pointer" }}>
                  기본값 복원
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── 계약서 생성 버튼 ── */}
        {kakaoUser && (
          <div style={{ marginBottom: 12 }}>
            {error && <p style={{ color:"#ef4444", fontSize:13, margin:"0 0 10px", textAlign:"center" }}>{error}</p>}
            <button onClick={handleGenerate} disabled={generating || !canGen}
              style={{ width:"100%", background: canGen ? "linear-gradient(135deg,#2563eb,#1d4ed8)" : "#f1f5f9", border: canGen ? "none" : "1px solid #e2e8f0", borderRadius:14, padding:"17px 0", color: canGen?"#fff":"#94a3b8", fontSize:16, fontWeight:700, cursor: canGen?"pointer":"not-allowed", boxShadow: canGen ? "0 4px 20px rgba(37,99,235,0.15)" : "none" }}>
              {generating
                ? "생성 중..."
                : isFree
                  ? `계약서 생성 (무료 ${freeUsed + 1}/${DAILY_FREE}회)`
                  : canGen
                    ? `계약서 생성 (${pointCost}P 차감)`
                    : `포인트 부족 — 충전 필요`}
            </button>
          </div>
        )}

        {/* ── 포인트 충전 안내 ── */}
        <div style={{ border:"1px solid #e2e8f0", borderRadius:14, overflow:"hidden", marginBottom:12, boxShadow:"0 1px 4px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)" }}>
          <button onClick={() => setShowPurchase(v => !v)}
            style={{ width:"100%", background:"#ffffff", border:"none", padding:"14px 16px", display:"flex", alignItems:"center", justifyContent:"space-between", color:"#475569", fontSize:13, fontWeight:600, cursor:"pointer" }}>
            <span style={{ display:"flex", alignItems:"center", gap:6 }}><CreditCard size={15} color="#f59e0b"/> 핏포인트 충전 안내</span>
            {showPurchase ? <ChevronUp size={15} color="#94a3b8"/> : <ChevronDown size={15} color="#94a3b8"/>}
          </button>
          {showPurchase && (
            <div style={{ background:"#f8fafc", padding:"16px", borderTop:"1px solid #e2e8f0" }}>
              {/* 계좌 */}
              <div style={{ background:"#ffffff", borderRadius:10, padding:"14px 16px", marginBottom:12, border:"1px solid #e2e8f0" }}>
                <p style={{ color:"#94a3b8", fontSize:11, margin:"0 0 4px" }}>입금 계좌 (카카오뱅크)</p>
                <p style={{ color:"#0f172a", fontWeight:700, fontSize:16, margin:0, letterSpacing:"0.05em" }}>3333-37-4826334</p>
              </div>
              {/* 금액 선택 */}
              <p style={{ color:"#475569", fontSize:11, margin:"0 0 8px", fontWeight:600 }}>충전할 금액을 선택하세요</p>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:12 }}>
                {[{ won:"5000", label:"5,000원", points:"5,000 P" },{ won:"10000", label:"10,000원", points:"12,000 P", bonus:true }].map(({ won, label, points, bonus }) => (
                  <button key={won} onClick={() => { setReqAmount(won); setReqDone(false); }}
                    style={{ background: reqAmount===won ? (bonus?"#fff7ed":"#eff6ff") : "#ffffff", borderRadius:10, padding:"12px 14px", border:`2px solid ${reqAmount===won?(bonus?"#f59e0b":"#2563eb"):(bonus?"#fde68a":"#e2e8f0")}`, cursor:"pointer", textAlign:"left" as const }}>
                    <p style={{ color:"#94a3b8", fontSize:11, margin:"0 0 3px" }}>입금액</p>
                    <p style={{ color:"#0f172a", fontWeight:700, fontSize:14, margin:"0 0 4px" }}>{label}</p>
                    <p style={{ color:"#f59e0b", fontWeight:700, fontSize:13, margin:0 }}>→ {points} {bonus && <span style={{ color:"#f97316", fontSize:11 }}>+보너스</span>}</p>
                  </button>
                ))}
              </div>
              {/* 신청 버튼 — 로그인한 경우만 */}
              {kakaoUser ? (
                reqDone ? (
                  <div style={{ background:"#eff6ff", borderRadius:10, padding:"14px 16px", textAlign:"center", border:"1px solid #bfdbfe" }}>
                    <p style={{ color:"#2563eb", fontWeight:700, fontSize:14, margin:"0 0 4px" }}>✓ 충전 신청 완료!</p>
                    <p style={{ color:"#475569", fontSize:12, margin:0 }}>입금 확인 후 담당자가 포인트를 지급해 드립니다.</p>
                  </div>
                ) : (
                  <button onClick={submitChargeRequest} disabled={!reqAmount || reqBusy}
                    style={{ width:"100%", background: reqAmount ? "linear-gradient(135deg,#d97706,#b45309)" : "#f1f5f9", border: reqAmount ? "none" : "1px solid #e2e8f0", borderRadius:10, padding:"13px 0", color: reqAmount?"#fff":"#94a3b8", fontSize:14, fontWeight:700, cursor: reqAmount?"pointer":"not-allowed" }}>
                    {reqBusy ? "신청 중..." : reqAmount ? `${Number(reqAmount).toLocaleString()}원 충전 신청` : "금액을 먼저 선택하세요"}
                  </button>
                )
              ) : (
                <p style={{ color:"#94a3b8", fontSize:12, textAlign:"center", margin:0 }}>로그인 후 충전 신청이 가능합니다.</p>
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
