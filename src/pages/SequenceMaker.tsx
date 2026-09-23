import React, { useState, useEffect, useCallback } from "react";
import {
  Plus, Trash2, ChevronUp, ChevronDown, Save, Share2, Printer,
  ArrowLeft, Dumbbell, Youtube, Check, Clock, Copy, Heart, Eye,
  Globe, Lock, Users, ListChecks,
} from "lucide-react";

/* ────────────────────────────────────────────────────────────────────────
   시퀀스 메이커 — 작성/저장/공유 + 커뮤니티 피드
   · 카카오 로그인 (PKCE, 콜백은 "/" DietPlanner에서 처리)
   · localStorage 로컬 저장 + 핏스텝 서버 API 동기화
   · /api/sequences 커뮤니티 피드
──────────────────────────────────────────────────────────────────────── */

const API_URL = (import.meta.env.VITE_API_URL as string | undefined) || "";

const CATEGORY_OPTIONS   = ["웨이트 트레이닝", "필라테스", "요가", "크로스핏/기능성", "재활운동", "체형교정", "유산소", "기타"];
const DIFFICULTY_OPTIONS = ["입문", "초급", "중급", "고급"];
const AUDIENCE_OPTIONS   = ["일반", "시니어", "산전산후", "재활", "선수/경기력", "체중감량", "근력강화"];
const BODY_PART_OPTIONS  = ["전신", "목·어깨", "등", "가슴", "팔", "코어·복부", "둔근", "하체", "척추·자세"];

interface KakaoUser { id?: number; name: string; thumbnail?: string | null }
interface Exercise { name: string; sets: string; reps: string; videoUrl: string; note: string }
interface Sequence {
  id: string;
  title: string; description: string; category: string; bodyParts: string;
  targetAudience: string; difficulty: string; estimatedMinutes: string; equipment: string;
  classGoal: string; coachingNotes: string;
  exercises: Exercise[];
  author: string;
  isPublic?: boolean;
  remoteId?: number;
  createdAt: string; updatedAt: string;
}
interface CommunitySeq {
  id: number; title: string; description: string; category: string;
  difficulty: string; targetAudience: string; estimatedMinutes: string;
  price: number; viewCount: number; likeCount: number;
  authorName: string; authorThumbnail: string | null; createdAt: string;
}

const STORE_KEY = "sq_sequences";
const emptyExercise = (): Exercise => ({ name: "", sets: "", reps: "", videoUrl: "", note: "" });
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const nowISO = () => new Date().toISOString();

function loadAll(): Sequence[] {
  try { const s = localStorage.getItem(STORE_KEY); return s ? JSON.parse(s) : []; } catch { return []; }
}
function saveAll(list: Sequence[]) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(list)); } catch {}
}
function newSequence(author: string): Sequence {
  return {
    id: uid(), title: "", description: "", category: "", bodyParts: "",
    targetAudience: "", difficulty: "", estimatedMinutes: "", equipment: "",
    classGoal: "", coachingNotes: "", exercises: [emptyExercise()],
    author, isPublic: false, createdAt: nowISO(), updatedAt: nowISO(),
  };
}
function getKakaoToken(): string | null {
  return localStorage.getItem("dp_kakao_at");
}

/* ── 링크 인코딩 ── */
function encodeSeq(seq: Sequence): string {
  try { return btoa(unescape(encodeURIComponent(JSON.stringify(seq)))); } catch { return ""; }
}
function decodeSeq(s: string): Sequence | null {
  try { return JSON.parse(decodeURIComponent(escape(atob(s)))); } catch { return null; }
}

/* ── Kakao PKCE ── */
function generateCodeVerifier(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}
async function generateCodeChallenge(v: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(v));
  return btoa(String.fromCharCode(...new Uint8Array(digest))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

/* ── API 헬퍼 ── */
async function apiGet(path: string) {
  const res = await fetch(`${API_URL}/api/sequences${path}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
async function apiAuth(path: string, method: string, body?: object) {
  const token = getKakaoToken();
  const res = await fetch(`${API_URL}/api/sequences${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

/* ── 공통 스타일 ── */
const IS: React.CSSProperties = {
  width: "100%", background: "#ffffff", border: "1px solid #e2e8f0",
  borderRadius: 8, padding: "10px 12px", color: "#0f172a", fontSize: 14,
  boxSizing: "border-box", outline: "none",
};
const LB: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 6, display: "block" };
const CARD: React.CSSProperties = { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: 18, boxShadow: "0 1px 4px rgba(0,0,0,0.04)" };

/* ── TopBar ── */
function TopBar({ kakaoUser, onLogin, onLogout }: { kakaoUser: KakaoUser | null; onLogin: () => void; onLogout: () => void }) {
  return (
    <div style={{ background: "#fff", borderBottom: "1px solid #e2e8f0", padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 20 }}>
      <span style={{ fontSize: 15, fontWeight: 900, color: "#2563eb", letterSpacing: "-0.5px" }}>FIT STEP · 시퀀스</span>
      {kakaoUser ? (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {kakaoUser.thumbnail && <img src={kakaoUser.thumbnail} alt="" style={{ width: 28, height: 28, borderRadius: "50%", objectFit: "cover" }} />}
          <span style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>{kakaoUser.name}</span>
          <button onClick={onLogout} style={{ fontSize: 11, color: "#94a3b8", background: "none", border: "none", cursor: "pointer", padding: "4px 6px" }}>로그아웃</button>
        </div>
      ) : (
        <button onClick={onLogin} style={{ display: "flex", alignItems: "center", gap: 6, background: "#FEE500", border: "none", borderRadius: 8, padding: "7px 14px", fontSize: 13, fontWeight: 700, color: "#3A1D1D", cursor: "pointer" }}>
          카카오 로그인
        </button>
      )}
    </div>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 11, fontWeight: 600, color: "#475569", background: "#f1f5f9", borderRadius: 6, padding: "3px 8px" }}>{children}</span>;
}

/* ── 다중선택 칩 ── */
function ChipSelect({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) {
  const selected = value.split(",").map(s => s.trim()).filter(Boolean);
  const toggle = (opt: string) => {
    const next = selected.includes(opt) ? selected.filter(s => s !== opt) : [...selected, opt];
    onChange(next.join(", "));
  };
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {options.map(opt => {
        const on = selected.includes(opt);
        return (
          <button
            key={opt}
            type="button"
            onClick={() => toggle(opt)}
            style={{ fontSize: 12, fontWeight: 700, padding: "7px 12px", borderRadius: 999, cursor: "pointer", background: on ? "#eff6ff" : "#fff", border: `1px solid ${on ? "#2563eb" : "#e2e8f0"}`, color: on ? "#2563eb" : "#64748b" }}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}

function iconBtn(disabled: boolean): React.CSSProperties {
  return { display: "flex", alignItems: "center", justifyContent: "center", width: 34, height: 34, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, color: disabled ? "#cbd5e1" : "#64748b", cursor: disabled ? "not-allowed" : "pointer", flexShrink: 0 };
}

/* ── 공유(읽기전용) 뷰 ── */
function SharedView({ seq }: { seq: Sequence }) {
  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc" }}>
      <style>{`@media print { .no-print{display:none!important} body{background:#fff!important} }`}</style>
      <div className="no-print" style={{ background: "#fff", borderBottom: "1px solid #e2e8f0", padding: "10px 16px", display: "flex", justifyContent: "flex-end", position: "sticky", top: 0, zIndex: 10 }}>
        <button onClick={() => window.print()} style={{ display: "flex", alignItems: "center", gap: 6, background: "linear-gradient(135deg,#2563eb,#1d4ed8)", border: "none", borderRadius: 8, padding: "9px 18px", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
          <Printer size={16} /> 인쇄 / PDF
        </button>
      </div>
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "24px 16px 60px" }}>
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 16, padding: "32px 28px", boxShadow: "0 4px 32px rgba(0,0,0,0.06)" }}>
          <p style={{ color: "#2563eb", fontSize: 10, fontWeight: 900, letterSpacing: "0.2em", margin: "0 0 8px" }}>FIT STEP · 수업 시퀀스</p>
          <h1 style={{ fontSize: 22, fontWeight: 900, color: "#0f172a", margin: "0 0 6px" }}>{seq.title || "(제목 없음)"}</h1>
          {seq.description && <p style={{ fontSize: 14, color: "#475569", margin: "0 0 14px" }}>{seq.description}</p>}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 20 }}>
            {seq.category && <Tag>{seq.category}</Tag>}
            {seq.difficulty && <Tag>{seq.difficulty}</Tag>}
            {seq.targetAudience && <Tag>{seq.targetAudience}</Tag>}
            {seq.estimatedMinutes && <Tag><Clock size={10} /> {seq.estimatedMinutes}분</Tag>}
            {seq.bodyParts.split(",").map(s => s.trim()).filter(Boolean).map(p => <Tag key={p}>{p}</Tag>)}
            {seq.equipment && <Tag>{seq.equipment}</Tag>}
          </div>
          {seq.classGoal && (
            <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 10, padding: "12px 14px", marginBottom: 20 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: "#2563eb", margin: "0 0 4px" }}>수업 목표</p>
              <p style={{ fontSize: 13, color: "#0f172a", margin: 0 }}>{seq.classGoal}</p>
            </div>
          )}
          {seq.exercises.map((ex, i) => (
            <div key={i} style={{ display: "flex", gap: 12, padding: "14px 0", borderBottom: "1px solid #f1f5f9" }}>
              <span style={{ width: 28, height: 28, borderRadius: "50%", background: "#2563eb", color: "#fff", fontSize: 13, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{i + 1}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 15, fontWeight: 700, color: "#0f172a", margin: 0 }}>{ex.name || "(운동명 없음)"}</p>
                <p style={{ fontSize: 13, color: "#475569", margin: "3px 0 0" }}>{[ex.sets, ex.reps].filter(Boolean).join(" · ") || "—"}</p>
                {ex.note && <p style={{ fontSize: 12, color: "#94a3b8", margin: "4px 0 0" }}>{ex.note}</p>}
                {ex.videoUrl && <a href={ex.videoUrl} target="_blank" rel="noreferrer" className="no-print" style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, color: "#dc2626", marginTop: 5, textDecoration: "none" }}><Youtube size={13} /> 영상 보기</a>}
              </div>
            </div>
          ))}
          {seq.coachingNotes && (
            <div style={{ marginTop: 20, background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: "12px 14px" }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: "#475569", margin: "0 0 4px" }}>코칭 노트</p>
              <p style={{ fontSize: 13, color: "#0f172a", margin: 0, whiteSpace: "pre-wrap" }}>{seq.coachingNotes}</p>
            </div>
          )}
          <p style={{ textAlign: "right", fontSize: 11, color: "#94a3b8", marginTop: 20 }}>작성: {seq.author}</p>
        </div>
      </div>
    </div>
  );
}

/* ── 커뮤니티 카드 ── */
function CommunityCard({ seq, onView, likedIds, onLike }: { seq: CommunitySeq; onView: () => void; likedIds: Set<number>; onLike: () => void }) {
  const liked = likedIds.has(seq.id);
  return (
    <div style={{ ...CARD, cursor: "pointer" }} onClick={onView}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 style={{ fontSize: 15, fontWeight: 800, color: "#0f172a", margin: "0 0 4px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{seq.title}</h3>
          {seq.description && <p style={{ fontSize: 12, color: "#64748b", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{seq.description}</p>}
        </div>
        {seq.price > 0 && <span style={{ fontSize: 11, fontWeight: 700, color: "#2563eb", background: "#eff6ff", borderRadius: 6, padding: "3px 8px", marginLeft: 8, flexShrink: 0 }}>₩{seq.price.toLocaleString()}</span>}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 10 }}>
        {seq.category && <Tag>{seq.category}</Tag>}
        {seq.difficulty && <Tag>{seq.difficulty}</Tag>}
        {seq.estimatedMinutes && <Tag><Clock size={9} /> {seq.estimatedMinutes}분</Tag>}
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {seq.authorThumbnail && <img src={seq.authorThumbnail} alt="" style={{ width: 20, height: 20, borderRadius: "50%", objectFit: "cover" }} />}
          <span style={{ fontSize: 12, color: "#64748b" }}>{seq.authorName}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 11, color: "#94a3b8" }}><Eye size={11} /> {seq.viewCount}</span>
          <button
            onClick={e => { e.stopPropagation(); onLike(); }}
            style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 11, color: liked ? "#dc2626" : "#94a3b8", background: "none", border: "none", cursor: "pointer", padding: 0 }}
          >
            <Heart size={11} fill={liked ? "#dc2626" : "none"} /> {seq.likeCount}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   메인 컴포넌트
════════════════════════════════════════════════════════════════════════ */
export default function SequenceMaker() {
  const [kakaoUser, setKakaoUser] = useState<KakaoUser | null>(() => {
    try { const s = localStorage.getItem("dp_kakao_user"); return s ? JSON.parse(s) : null; } catch { return null; }
  });

  const [sharedSeq] = useState<Sequence | null>(() => {
    const sp = new URLSearchParams(window.location.search);
    const v = sp.get("view");
    return v ? decodeSeq(v) : null;
  });

  const [tab, setTab] = useState<"mine" | "community">("mine");
  const [mode, setMode] = useState<"list" | "edit">("list");
  const [list, setList] = useState<Sequence[]>(loadAll);
  const [draft, setDraft] = useState<Sequence | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);

  // 커뮤니티
  const [communitySeqs, setCommunitySeqs] = useState<CommunitySeq[]>([]);
  const [commLoading, setCommLoading] = useState(false);
  const [likedIds, setLikedIds] = useState<Set<number>>(new Set());
  const [viewingRemote, setViewingRemote] = useState<CommunitySeq | null>(null);
  const [remoteDetail, setRemoteDetail] = useState<Sequence | null>(null);

  useEffect(() => { document.title = "시퀀스 메이커 · FIT STEP"; }, []);

  const fetchCommunity = useCallback(async () => {
    if (!API_URL) return;
    setCommLoading(true);
    try {
      const rows: CommunitySeq[] = await apiGet("/");
      setCommunitySeqs(rows);
    } catch { /* ignore */ }
    setCommLoading(false);
  }, []);

  useEffect(() => { if (tab === "community") fetchCommunity(); }, [tab, fetchCommunity]);

  async function handleKakaoLogin() {
    const appKey = import.meta.env.VITE_KAKAO_APP_KEY as string | undefined;
    if (!appKey) { alert("카카오 앱키가 설정되지 않았습니다."); return; }
    const verifier = generateCodeVerifier();
    sessionStorage.setItem("kakao_pkce_verifier", verifier);
    sessionStorage.setItem("login_return", "/sequence");
    const challenge = await generateCodeChallenge(verifier);
    const redirectUri = window.location.origin + "/";
    window.location.href =
      `https://kauth.kakao.com/oauth/authorize?client_id=${appKey}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&response_type=code&code_challenge=${challenge}&code_challenge_method=S256` +
      `&scope=profile_nickname,profile_image`;
  }
  function handleKakaoLogout() {
    localStorage.removeItem("dp_kakao_user");
    localStorage.removeItem("dp_kakao_at");
    setKakaoUser(null);
  }

  function startNew() {
    if (!kakaoUser) { handleKakaoLogin(); return; }
    setDraft(newSequence(kakaoUser.name));
    setMode("edit");
  }
  function editExisting(seq: Sequence) {
    setDraft(JSON.parse(JSON.stringify(seq)));
    setMode("edit");
  }
  async function deleteExisting(id: string) {
    if (!confirm("이 시퀀스를 삭제할까요?")) return;
    const target = list.find(s => s.id === id);
    if (target?.remoteId && API_URL) {
      try { await apiAuth(`/${target.remoteId}`, "DELETE"); } catch { /* ignore */ }
    }
    const next = list.filter(s => s.id !== id);
    setList(next); saveAll(next);
  }
  function updateDraft(patch: Partial<Sequence>) {
    setDraft(d => d ? { ...d, ...patch } : d);
  }
  function updateExercise(i: number, patch: Partial<Exercise>) {
    setDraft(d => {
      if (!d) return d;
      const ex = d.exercises.slice();
      ex[i] = { ...ex[i], ...patch };
      return { ...d, exercises: ex };
    });
  }
  function addExercise() { setDraft(d => d ? { ...d, exercises: [...d.exercises, emptyExercise()] } : d); }
  function removeExercise(i: number) { setDraft(d => d ? { ...d, exercises: d.exercises.filter((_, idx) => idx !== i) } : d); }
  function moveExercise(i: number, dir: -1 | 1) {
    setDraft(d => {
      if (!d) return d;
      const j = i + dir;
      if (j < 0 || j >= d.exercises.length) return d;
      const ex = d.exercises.slice();
      [ex[i], ex[j]] = [ex[j], ex[i]];
      return { ...d, exercises: ex };
    });
  }

  async function saveDraft() {
    if (!draft) return;
    if (!draft.title.trim()) { alert("시퀀스 제목을 입력해주세요."); return; }
    setSaving(true);
    const updated = { ...draft, updatedAt: nowISO() };

    // API 동기화
    if (API_URL && getKakaoToken()) {
      try {
        const payload = {
          title: updated.title, description: updated.description,
          category: updated.category, bodyParts: updated.bodyParts,
          targetAudience: updated.targetAudience, difficulty: updated.difficulty,
          estimatedMinutes: updated.estimatedMinutes, equipment: updated.equipment,
          classGoal: updated.classGoal, coachingNotes: updated.coachingNotes,
          exercises: updated.exercises, isPublic: !!updated.isPublic, price: 0,
        };
        if (updated.remoteId) {
          await apiAuth(`/${updated.remoteId}`, "PUT", payload);
        } else {
          const remote = await apiAuth("/", "POST", payload);
          updated.remoteId = remote.id;
        }
      } catch { /* 오프라인 시 로컬에만 저장 */ }
    }

    const exists = list.some(s => s.id === updated.id);
    const next = exists ? list.map(s => s.id === updated.id ? updated : s) : [updated, ...list];
    setList(next); saveAll(next);
    setDraft(updated);
    setSaving(false);
    setSavedFlash(true); setTimeout(() => setSavedFlash(false), 1800);
  }

  async function shareDraft() {
    if (!draft) return;
    const encoded = encodeSeq(draft);
    const url = `${window.location.origin}/sequence?view=${encoded}`;
    if (navigator.share) {
      try { await navigator.share({ title: `${draft.title} · 수업 시퀀스`, url }); return; } catch (e) {
        if ((e as DOMException)?.name === "AbortError") return;
      }
    }
    await navigator.clipboard.writeText(url).catch(() => {});
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  }

  async function toggleLike(seqId: number) {
    if (!kakaoUser) { handleKakaoLogin(); return; }
    if (!API_URL) return;
    try {
      const { liked }: { liked: boolean } = await apiAuth(`/${seqId}/like`, "POST");
      setLikedIds(prev => {
        const next = new Set(prev);
        liked ? next.add(seqId) : next.delete(seqId);
        return next;
      });
      setCommunitySeqs(prev => prev.map(s => s.id === seqId ? { ...s, likeCount: s.likeCount + (liked ? 1 : -1) } : s));
    } catch { /* ignore */ }
  }

  async function openRemoteDetail(seq: CommunitySeq) {
    setViewingRemote(seq);
    if (!API_URL) return;
    try {
      const detail = await apiGet(`/${seq.id}`);
      const exercises = JSON.parse(detail.exercisesJson || "[]");
      setRemoteDetail({
        id: String(detail.id), title: detail.title, description: detail.description || "",
        category: detail.category || "", bodyParts: detail.bodyParts || "",
        targetAudience: detail.targetAudience || "", difficulty: detail.difficulty || "",
        estimatedMinutes: detail.estimatedMinutes || "", equipment: detail.equipment || "",
        classGoal: detail.classGoal || "", coachingNotes: detail.coachingNotes || "",
        exercises, author: detail.authorName, isPublic: true, remoteId: detail.id,
        createdAt: detail.createdAt, updatedAt: detail.updatedAt,
      });
    } catch { /* ignore */ }
  }

  /* ─── 공유 뷰 ─── */
  if (sharedSeq) return <SharedView seq={sharedSeq} />;

  /* ─── 커뮤니티 시퀀스 상세 ─── */
  if (viewingRemote && remoteDetail) {
    return (
      <div style={{ minHeight: "100vh", background: "#f8fafc" }}>
        <div style={{ background: "#fff", borderBottom: "1px solid #e2e8f0", padding: "10px 16px", display: "flex", alignItems: "center", gap: 10, position: "sticky", top: 0, zIndex: 20 }}>
          <button onClick={() => { setViewingRemote(null); setRemoteDetail(null); }} style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "1px solid #e2e8f0", borderRadius: 8, padding: "8px 12px", color: "#475569", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            <ArrowLeft size={15} /> 커뮤니티
          </button>
          <span style={{ fontSize: 15, fontWeight: 800, color: "#0f172a" }}>{viewingRemote.authorName}의 시퀀스</span>
        </div>
        <SharedView seq={remoteDetail} />
      </div>
    );
  }

  /* ─── 편집 뷰 ─── */
  if (mode === "edit" && draft) {
    return (
      <div style={{ minHeight: "100vh", background: "#f8fafc" }}>
        <TopBar kakaoUser={kakaoUser} onLogin={handleKakaoLogin} onLogout={handleKakaoLogout} />
        <div style={{ maxWidth: 720, margin: "0 auto", padding: "16px 16px 80px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <button onClick={() => setMode("list")} style={{ display: "flex", alignItems: "center", gap: 4, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, padding: "8px 12px", color: "#475569", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
              <ArrowLeft size={15} /> 목록
            </button>
            <h1 style={{ fontSize: 18, fontWeight: 800, color: "#0f172a", margin: 0 }}>시퀀스 작성</h1>
          </div>

          {/* 기본 정보 */}
          <div style={{ ...CARD, marginBottom: 14 }}>
            <label style={LB}>시퀀스 제목 *</label>
            <input style={IS} value={draft.title} onChange={e => updateDraft({ title: e.target.value })} placeholder="예: 하체 근력 강화 40분 루틴" />
            <div style={{ height: 12 }} />
            <label style={LB}>한 줄 설명</label>
            <input style={IS} value={draft.description} onChange={e => updateDraft({ description: e.target.value })} placeholder="이 수업의 핵심을 한 줄로" />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
              <div><label style={LB}>카테고리</label>
                <select style={IS} value={draft.category} onChange={e => updateDraft({ category: e.target.value })}>
                  <option value="">선택</option>{CATEGORY_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div><label style={LB}>난이도</label>
                <select style={IS} value={draft.difficulty} onChange={e => updateDraft({ difficulty: e.target.value })}>
                  <option value="">선택</option>{DIFFICULTY_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div><label style={LB}>대상</label>
                <select style={IS} value={draft.targetAudience} onChange={e => updateDraft({ targetAudience: e.target.value })}>
                  <option value="">선택</option>{AUDIENCE_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div><label style={LB}>예상 시간(분)</label>
                <input style={IS} type="number" value={draft.estimatedMinutes} onChange={e => updateDraft({ estimatedMinutes: e.target.value })} placeholder="40" />
              </div>
              <div><label style={LB}>필요 장비</label>
                <input style={IS} value={draft.equipment} onChange={e => updateDraft({ equipment: e.target.value })} placeholder="덤벨, 밴드" />
              </div>
            </div>
            <div style={{ marginTop: 12 }}>
              <label style={LB}>운동 부위 (복수 선택)</label>
              <ChipSelect options={BODY_PART_OPTIONS} value={draft.bodyParts} onChange={v => updateDraft({ bodyParts: v })} />
            </div>
          </div>

          {/* 수업 목표 */}
          <div style={{ ...CARD, marginBottom: 14 }}>
            <label style={LB}>수업 목표</label>
            <textarea style={{ ...IS, minHeight: 72, resize: "vertical" }} value={draft.classGoal} onChange={e => updateDraft({ classGoal: e.target.value })} placeholder="오늘 수업에서 달성할 목표" />
          </div>

          {/* 운동 목록 */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "0 4px 10px" }}>
            <span style={{ fontSize: 14, fontWeight: 800, color: "#0f172a", display: "flex", alignItems: "center", gap: 6 }}>
              <Dumbbell size={16} color="#2563eb" /> 운동 순서 ({draft.exercises.length})
            </span>
          </div>

          {draft.exercises.map((ex, i) => (
            <div key={i} style={{ ...CARD, marginBottom: 10, padding: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <span style={{ width: 26, height: 26, borderRadius: "50%", background: "#2563eb", color: "#fff", fontSize: 13, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{i + 1}</span>
                <input style={{ ...IS, flex: 1 }} value={ex.name} onChange={e => updateExercise(i, { name: e.target.value })} placeholder="운동 이름" />
                <button onClick={() => moveExercise(i, -1)} disabled={i === 0} style={iconBtn(i === 0)}><ChevronUp size={16} /></button>
                <button onClick={() => moveExercise(i, 1)} disabled={i === draft.exercises.length - 1} style={iconBtn(i === draft.exercises.length - 1)}><ChevronDown size={16} /></button>
                <button onClick={() => removeExercise(i)} style={{ ...iconBtn(false), color: "#dc2626" }}><Trash2 size={16} /></button>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div><label style={LB}>세트</label><input style={IS} value={ex.sets} onChange={e => updateExercise(i, { sets: e.target.value })} placeholder="3세트" /></div>
                <div><label style={LB}>횟수/시간</label><input style={IS} value={ex.reps} onChange={e => updateExercise(i, { reps: e.target.value })} placeholder="12회 / 30초" /></div>
              </div>
              <div style={{ marginTop: 10 }}>
                <label style={LB}>영상 URL</label>
                <input style={IS} value={ex.videoUrl} onChange={e => updateExercise(i, { videoUrl: e.target.value })} placeholder="https://youtube.com/..." />
              </div>
              <div style={{ marginTop: 10 }}>
                <label style={LB}>노트</label>
                <input style={IS} value={ex.note} onChange={e => updateExercise(i, { note: e.target.value })} placeholder="큐잉, 주의사항" />
              </div>
            </div>
          ))}

          <button onClick={addExercise} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: "#eff6ff", border: "2px dashed #bfdbfe", borderRadius: 12, padding: "12px 0", color: "#2563eb", fontSize: 14, fontWeight: 700, cursor: "pointer", marginBottom: 14 }}>
            <Plus size={16} /> 운동 추가
          </button>

          {/* 코칭 노트 */}
          <div style={{ ...CARD, marginBottom: 14 }}>
            <label style={LB}>코칭 노트</label>
            <textarea style={{ ...IS, minHeight: 80, resize: "vertical" }} value={draft.coachingNotes} onChange={e => updateDraft({ coachingNotes: e.target.value })} placeholder="회원에게 전달할 피드백, 주의사항" />
          </div>

          {/* 공개 설정 */}
          {API_URL && (
            <div style={{ ...CARD, marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", margin: "0 0 2px" }}>커뮤니티 공개</p>
                  <p style={{ fontSize: 12, color: "#64748b", margin: 0 }}>공개하면 다른 트레이너도 볼 수 있습니다</p>
                </div>
                <button
                  onClick={() => updateDraft({ isPublic: !draft.isPublic })}
                  style={{ display: "flex", alignItems: "center", gap: 6, background: draft.isPublic ? "#eff6ff" : "#f1f5f9", border: `1px solid ${draft.isPublic ? "#bfdbfe" : "#e2e8f0"}`, borderRadius: 8, padding: "8px 14px", color: draft.isPublic ? "#2563eb" : "#64748b", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
                >
                  {draft.isPublic ? <><Globe size={14} /> 공개</> : <><Lock size={14} /> 비공개</>}
                </button>
              </div>
            </div>
          )}

          {/* 하단 액션 */}
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={saveDraft} disabled={saving} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: savedFlash ? "#16a34a" : "linear-gradient(135deg,#2563eb,#1d4ed8)", border: "none", borderRadius: 12, padding: "14px 0", color: "#fff", fontSize: 15, fontWeight: 800, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1, transition: "background 0.3s" }}>
              {savedFlash ? <><Check size={18} /> 저장 완료</> : saving ? "저장 중..." : <><Save size={18} /> 저장</>}
            </button>
            <button onClick={shareDraft} style={{ display: "flex", alignItems: "center", gap: 6, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: "14px 18px", color: "#475569", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
              {copied ? <Check size={16} color="#16a34a" /> : <><Share2 size={16} /> 공유</>}
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ─── 목록 뷰 ─── */
  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc" }}>
      <TopBar kakaoUser={kakaoUser} onLogin={handleKakaoLogin} onLogout={handleKakaoLogout} />

      {/* 탭 */}
      <div style={{ background: "#fff", borderBottom: "1px solid #e2e8f0", display: "flex" }}>
        {([["mine", <><ListChecks size={14} /> 내 시퀀스</>], ["community", <><Users size={14} /> 커뮤니티</>]] as const).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key as "mine" | "community")} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "13px 0", fontSize: 13, fontWeight: 700, color: tab === key ? "#2563eb" : "#94a3b8", background: "none", border: "none", borderBottom: `2px solid ${tab === key ? "#2563eb" : "transparent"}`, cursor: "pointer" }}>
            {label}
          </button>
        ))}
      </div>

      <div style={{ maxWidth: 720, margin: "0 auto", padding: "16px 16px 80px" }}>
        {tab === "mine" ? (
          <>
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 14 }}>
              <button onClick={startNew} style={{ display: "flex", alignItems: "center", gap: 6, background: "linear-gradient(135deg,#2563eb,#1d4ed8)", border: "none", borderRadius: 10, padding: "10px 18px", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
                <Plus size={16} /> 새 시퀀스
              </button>
            </div>
            {list.length === 0 ? (
              <div style={{ textAlign: "center", padding: "60px 20px", color: "#94a3b8" }}>
                <Dumbbell size={40} style={{ margin: "0 auto 12px", display: "block", opacity: 0.3 }} />
                <p style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>아직 작성한 시퀀스가 없어요</p>
                <p style={{ margin: "6px 0 0", fontSize: 13 }}>새 시퀀스를 만들어 보세요</p>
              </div>
            ) : (
              list.map(seq => (
                <div key={seq.id} style={{ ...CARD, marginBottom: 12 }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                        <h3 style={{ fontSize: 15, fontWeight: 800, color: "#0f172a", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{seq.title || "(제목 없음)"}</h3>
                        {seq.isPublic && <Globe size={12} color="#2563eb" />}
                        {seq.remoteId && <Check size={12} color="#16a34a" />}
                      </div>
                      {seq.description && <p style={{ fontSize: 12, color: "#64748b", margin: 0 }}>{seq.description}</p>}
                    </div>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 10 }}>
                    {seq.category && <Tag>{seq.category}</Tag>}
                    {seq.difficulty && <Tag>{seq.difficulty}</Tag>}
                    {seq.estimatedMinutes && <Tag><Clock size={9} /> {seq.estimatedMinutes}분</Tag>}
                    <Tag><Dumbbell size={9} /> {seq.exercises.length}개</Tag>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => editExisting(seq)} style={{ flex: 1, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, padding: "8px 0", fontSize: 13, fontWeight: 600, color: "#475569", cursor: "pointer" }}>편집</button>
                    <button onClick={async () => {
                      const encoded = encodeSeq(seq);
                      const url = `${window.location.origin}/sequence?view=${encoded}`;
                      if (navigator.share) { try { await navigator.share({ title: seq.title, url }); return; } catch {} }
                      navigator.clipboard.writeText(url);
                    }} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, padding: "8px 12px", color: "#475569", cursor: "pointer" }}>
                      <Copy size={14} />
                    </button>
                    <button onClick={() => deleteExisting(seq.id)} style={{ background: "#fff", border: "1px solid #fee2e2", borderRadius: 8, padding: "8px 12px", color: "#dc2626", cursor: "pointer" }}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </>
        ) : (
          <>
            {!API_URL ? (
              <div style={{ textAlign: "center", padding: "60px 20px", color: "#94a3b8" }}>
                <p style={{ fontSize: 14 }}>VITE_API_URL 환경변수가 설정되지 않았습니다.</p>
              </div>
            ) : commLoading ? (
              <div style={{ textAlign: "center", padding: "60px 20px", color: "#94a3b8", fontSize: 14 }}>불러오는 중...</div>
            ) : communitySeqs.length === 0 ? (
              <div style={{ textAlign: "center", padding: "60px 20px", color: "#94a3b8" }}>
                <Users size={40} style={{ margin: "0 auto 12px", display: "block", opacity: 0.3 }} />
                <p style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>아직 공개된 시퀀스가 없어요</p>
                <p style={{ margin: "6px 0 0", fontSize: 13 }}>내 시퀀스를 공개해 커뮤니티와 나눠보세요</p>
              </div>
            ) : (
              communitySeqs.map(seq => (
                <div key={seq.id} style={{ marginBottom: 12 }}>
                  <CommunityCard
                    seq={seq}
                    onView={() => openRemoteDetail(seq)}
                    likedIds={likedIds}
                    onLike={() => toggleLike(seq.id)}
                  />
                </div>
              ))
            )}
          </>
        )}
      </div>

      {/* 탭 하단 FAB */}
      {tab === "mine" && (
        <button onClick={startNew} style={{ position: "fixed", bottom: 24, right: 20, width: 56, height: 56, borderRadius: "50%", background: "linear-gradient(135deg,#2563eb,#1d4ed8)", border: "none", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 16px rgba(37,99,235,0.4)", cursor: "pointer", zIndex: 50 }}>
          <Plus size={24} />
        </button>
      )}
    </div>
  );
}

