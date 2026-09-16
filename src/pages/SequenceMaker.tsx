import React, { useState, useEffect } from "react";
import {
  Plus, Trash2, ChevronUp, ChevronDown, Save, Share2, Printer,
  ArrowLeft, User, ListChecks, Dumbbell, Youtube, Check, Clock, Copy,
} from "lucide-react";

/* ────────────────────────────────────────────────────────────────────────
   시퀀스 메이커 (standalone) — 트레이너가 수업 시퀀스를 작성/저장/공유
   · 카카오 로그인 (기존 standalone 앱과 동일한 PKCE 흐름, 콜백은 "/"에서 처리)
   · localStorage 저장 (기기별)
   · 링크(?view=) / 인쇄(PDF)로 공유
──────────────────────────────────────────────────────────────────────── */

const CATEGORY_OPTIONS   = ["웨이트 트레이닝", "필라테스", "요가", "크로스핏/기능성", "재활운동", "체형교정", "유산소", "기타"];
const DIFFICULTY_OPTIONS = ["입문", "초급", "중급", "고급"];
const AUDIENCE_OPTIONS   = ["일반", "시니어", "산전산후", "재활", "선수/경기력", "체중감량", "근력강화"];

interface KakaoUser { id?: number; name: string; thumbnail?: string | null }

interface Exercise { name: string; sets: string; reps: string; videoUrl: string; note: string }
interface Sequence {
  id: string;
  title: string; description: string; category: string; bodyParts: string;
  targetAudience: string; difficulty: string; estimatedMinutes: string; equipment: string;
  classGoal: string; coachingNotes: string;
  exercises: Exercise[];
  author: string;
  createdAt: string; updatedAt: string;
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
    author, createdAt: nowISO(), updatedAt: nowISO(),
  };
}

/* ── 링크 인코딩 (UTF-8 안전 base64) ── */
function encodeSeq(seq: Sequence): string {
  try { return btoa(unescape(encodeURIComponent(JSON.stringify(seq)))); } catch { return ""; }
}
function decodeSeq(s: string): Sequence | null {
  try { return JSON.parse(decodeURIComponent(escape(atob(s)))); } catch { return null; }
}

/* ── Kakao PKCE 헬퍼 ── */
function generateCodeVerifier(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}
async function generateCodeChallenge(v: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(v));
  return btoa(String.fromCharCode(...new Uint8Array(digest))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

/* ── 공통 스타일 ── */
const IS: React.CSSProperties = {
  width: "100%", background: "#ffffff", border: "1px solid #e2e8f0",
  borderRadius: 8, padding: "10px 12px", color: "#0f172a", fontSize: 14,
  boxSizing: "border-box", outline: "none",
};
const LB: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 6, display: "block" };
const CARD: React.CSSProperties = { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: 18, boxShadow: "0 1px 4px rgba(0,0,0,0.04)" };

export default function SequenceMaker() {
  // 인증
  const [kakaoUser, setKakaoUser] = useState<KakaoUser | null>(() => {
    try { const s = localStorage.getItem("dp_kakao_user"); return s ? JSON.parse(s) : null; } catch { return null; }
  });

  // 공유(읽기전용) 뷰 여부
  const [sharedSeq] = useState<Sequence | null>(() => {
    const sp = new URLSearchParams(window.location.search);
    const v = sp.get("view");
    return v ? decodeSeq(v) : null;
  });

  // 화면 모드: list | edit
  const [mode, setMode] = useState<"list" | "edit">("list");
  const [list, setList] = useState<Sequence[]>(loadAll);
  const [draft, setDraft] = useState<Sequence | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => { document.title = "시퀀스 메이커 · FIT STEP"; }, []);

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
    setKakaoUser(null);
  }

  /* ── 편집 액션 ── */
  function startNew() {
    if (!kakaoUser) { handleKakaoLogin(); return; }
    setDraft(newSequence(kakaoUser.name));
    setMode("edit");
  }
  function editExisting(seq: Sequence) {
    setDraft(JSON.parse(JSON.stringify(seq)));
    setMode("edit");
  }
  function deleteExisting(id: string) {
    if (!confirm("이 시퀀스를 삭제할까요?")) return;
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
  function addExercise() {
    setDraft(d => d ? { ...d, exercises: [...d.exercises, emptyExercise()] } : d);
  }
  function removeExercise(i: number) {
    setDraft(d => d ? { ...d, exercises: d.exercises.filter((_, idx) => idx !== i) } : d);
  }
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
  function saveDraft() {
    if (!draft) return;
    if (!draft.title.trim()) { alert("시퀀스 제목을 입력해주세요."); return; }
    const updated = { ...draft, updatedAt: nowISO() };
    const exists = list.some(s => s.id === updated.id);
    const next = exists ? list.map(s => s.id === updated.id ? updated : s) : [updated, ...list];
    setList(next); saveAll(next);
    setDraft(updated);
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

  /* ─────────── 공유(읽기전용) 뷰 ─────────── */
  if (sharedSeq) return <SharedView seq={sharedSeq} />;

  /* ─────────── 편집 뷰 ─────────── */
  if (mode === "edit" && draft) {
    return (
      <div style={{ minHeight: "100vh", background: "#f8fafc" }}>
        <TopBar kakaoUser={kakaoUser} onLogin={handleKakaoLogin} onLogout={handleKakaoLogout} />
        <div style={{ maxWidth: 720, margin: "0 auto", padding: "16px 16px 60px" }}>
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
              <div>
                <label style={LB}>카테고리</label>
                <select style={IS} value={draft.category} onChange={e => updateDraft({ category: e.target.value })}>
                  <option value="">선택</option>
                  {CATEGORY_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div>
                <label style={LB}>난이도</label>
                <select style={IS} value={draft.difficulty} onChange={e => updateDraft({ difficulty: e.target.value })}>
                  <option value="">선택</option>
                  {DIFFICULTY_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div>
                <label style={LB}>대상</label>
                <select style={IS} value={draft.targetAudience} onChange={e => updateDraft({ targetAudience: e.target.value })}>
                  <option value="">선택</option>
                  {AUDIENCE_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div>
                <label style={LB}>예상 시간(분)</label>
                <input style={IS} type="number" value={draft.estimatedMinutes} onChange={e => updateDraft({ estimatedMinutes: e.target.value })} placeholder="40" />
              </div>
              <div>
                <label style={LB}>운동 부위</label>
                <input style={IS} value={draft.bodyParts} onChange={e => updateDraft({ bodyParts: e.target.value })} placeholder="하체, 코어" />
              </div>
              <div>
                <label style={LB}>필요 장비</label>
                <input style={IS} value={draft.equipment} onChange={e => updateDraft({ equipment: e.target.value })} placeholder="덤벨, 밴드" />
              </div>
            </div>
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
                <div>
                  <label style={LB}>세트</label>
                  <input style={IS} value={ex.sets} onChange={e => updateExercise(i, { sets: e.target.value })} placeholder="3세트" />
                </div>
                <div>
                  <label style={LB}>횟수/시간</label>
                  <input style={IS} value={ex.reps} onChange={e => updateExercise(i, { reps: e.target.value })} placeholder="12회 / 30초" />
                </div>
              </div>
              <div style={{ marginTop: 10 }}>
                <label style={LB}>영상 링크 (선택)</label>
                <input style={IS} value={ex.videoUrl} onChange={e => updateExercise(i, { videoUrl: e.target.value })} placeholder="https://youtube.com/..." />
              </div>
              <div style={{ marginTop: 10 }}>
                <label style={LB}>메모 (선택)</label>
                <input style={IS} value={ex.note} onChange={e => updateExercise(i, { note: e.target.value })} placeholder="자세 포인트, 주의사항" />
              </div>
            </div>
          ))}

          <button onClick={addExercise} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: "#eff6ff", border: "1px dashed #93c5fd", borderRadius: 10, padding: "12px 0", color: "#2563eb", fontSize: 14, fontWeight: 700, cursor: "pointer", marginBottom: 16 }}>
            <Plus size={16} /> 운동 추가
          </button>

          {/* 코칭 노트 */}
          <div style={{ ...CARD, marginBottom: 20 }}>
            <label style={LB}>수업 목표</label>
            <input style={IS} value={draft.classGoal} onChange={e => updateDraft({ classGoal: e.target.value })} placeholder="이 수업으로 달성할 목표" />
            <div style={{ height: 12 }} />
            <label style={LB}>코칭 노트</label>
            <textarea style={{ ...IS, minHeight: 72, resize: "vertical" }} value={draft.coachingNotes} onChange={e => updateDraft({ coachingNotes: e.target.value })} placeholder="진행 시 유의점, 대체 동작 등" />
          </div>

          {/* 저장/공유 바 */}
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={saveDraft} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: savedFlash ? "#16a34a" : "linear-gradient(135deg,#2563eb,#1d4ed8)", border: "none", borderRadius: 10, padding: "13px 0", color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>
              {savedFlash ? <><Check size={17} /> 저장됨</> : <><Save size={17} /> 저장</>}
            </button>
            <button onClick={shareDraft} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: "13px 18px", color: copied ? "#2563eb" : "#475569", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>
              {copied ? <><Check size={17} /> 복사됨</> : <><Share2 size={17} /> 공유</>}
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ─────────── 목록 뷰 ─────────── */
  const myList = kakaoUser ? list.filter(s => s.author === kakaoUser.name) : list;
  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc" }}>
      <TopBar kakaoUser={kakaoUser} onLogin={handleKakaoLogin} onLogout={handleKakaoLogout} />
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "20px 16px 60px" }}>
        <div style={{ marginBottom: 18 }}>
          <p style={{ color: "#2563eb", fontSize: 10, fontWeight: 900, letterSpacing: "0.2em", margin: "0 0 6px" }}>FIT STEP</p>
          <h1 style={{ fontSize: 24, fontWeight: 900, color: "#0f172a", margin: 0 }}>시퀀스 메이커</h1>
          <p style={{ fontSize: 13, color: "#64748b", margin: "6px 0 0" }}>수업 시퀀스를 만들고 링크로 공유하세요.</p>
        </div>

        <button onClick={startNew} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", background: "linear-gradient(145deg,#2563eb,#1d4ed8)", border: "none", borderRadius: 16, padding: "18px 20px", cursor: "pointer", marginBottom: 22, boxShadow: "0 8px 24px rgba(37,99,235,.22)" }}>
          <span style={{ textAlign: "left" }}>
            <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 38, height: 38, borderRadius: 12, background: "rgba(255,255,255,.2)", marginBottom: 8 }}><Plus size={20} color="#fff" /></span>
            <span style={{ display: "block", fontSize: 16, fontWeight: 800, color: "#fff" }}>새 시퀀스 작성</span>
            <span style={{ display: "block", fontSize: 12, color: "rgba(255,255,255,.7)", marginTop: 2 }}>{kakaoUser ? "바로 시작" : "로그인 후 시작"}</span>
          </span>
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 6, margin: "0 4px 12px" }}>
          <ListChecks size={16} color="#7c3aed" />
          <span style={{ fontSize: 15, fontWeight: 800, color: "#0f172a" }}>내 시퀀스</span>
          <span style={{ fontSize: 13, color: "#94a3b8" }}>{myList.length}개</span>
        </div>

        {myList.length === 0 ? (
          <div style={{ ...CARD, textAlign: "center", padding: "36px 20px", color: "#94a3b8", fontSize: 13 }}>
            아직 작성한 시퀀스가 없어요.<br />위 버튼으로 첫 시퀀스를 만들어보세요.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {myList.map(seq => (
              <div key={seq.id} style={{ ...CARD, padding: 16, cursor: "pointer" }} onClick={() => editExisting(seq)}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: 15, fontWeight: 800, color: "#0f172a", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{seq.title || "(제목 없음)"}</p>
                    {seq.description && <p style={{ fontSize: 12, color: "#64748b", margin: "4px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{seq.description}</p>}
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                      {seq.category && <Tag>{seq.category}</Tag>}
                      {seq.difficulty && <Tag>{seq.difficulty}</Tag>}
                      {seq.estimatedMinutes && <Tag><Clock size={10} /> {seq.estimatedMinutes}분</Tag>}
                      <Tag><Dumbbell size={10} /> {seq.exercises.length}개 운동</Tag>
                    </div>
                  </div>
                  <button onClick={e => { e.stopPropagation(); deleteExisting(seq.id); }} style={{ ...iconBtn(false), color: "#dc2626", flexShrink: 0 }}><Trash2 size={16} /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── 하위 컴포넌트 ── */
function TopBar({ kakaoUser, onLogin, onLogout }: { kakaoUser: KakaoUser | null; onLogin: () => void; onLogout: () => void }) {
  return (
    <div style={{ background: "#fff", borderBottom: "1px solid #e2e8f0", padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 10 }}>
      <span style={{ fontSize: 13, fontWeight: 900, color: "#2563eb", letterSpacing: "0.12em" }}>FIT STEP</span>
      {kakaoUser ? (
        <button onClick={onLogout} style={{ display: "flex", alignItems: "center", gap: 6, background: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: 20, padding: "5px 12px", cursor: "pointer", fontSize: 12, color: "#475569", fontWeight: 600 }}>
          {kakaoUser.thumbnail ? <img src={kakaoUser.thumbnail} alt="" style={{ width: 18, height: 18, borderRadius: "50%", objectFit: "cover" }} /> : <User size={14} />}
          <span style={{ maxWidth: 80, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{kakaoUser.name}</span>
        </button>
      ) : (
        <button onClick={onLogin} style={{ display: "flex", alignItems: "center", gap: 6, background: "#FEE500", border: "none", borderRadius: 20, padding: "6px 14px", cursor: "pointer", fontSize: 12, color: "#191919", fontWeight: 700 }}>
          카카오 로그인
        </button>
      )}
    </div>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 11, fontWeight: 600, color: "#475569", background: "#f1f5f9", borderRadius: 6, padding: "3px 8px" }}>{children}</span>;
}

function iconBtn(disabled: boolean): React.CSSProperties {
  return { display: "flex", alignItems: "center", justifyContent: "center", width: 34, height: 34, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, color: disabled ? "#cbd5e1" : "#64748b", cursor: disabled ? "not-allowed" : "pointer", flexShrink: 0 };
}

/* ── 공유(읽기전용) 뷰 ── */
function SharedView({ seq }: { seq: Sequence }) {
  const S = {
    wrap: { maxWidth: 720, margin: "0 auto", padding: "24px 16px 60px" } as React.CSSProperties,
    doc: { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 16, padding: "32px 28px", boxShadow: "0 4px 32px rgba(0,0,0,0.06)" } as React.CSSProperties,
  };
  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc" }}>
      <style>{`@media print { .no-print{display:none!important} body{background:#fff!important} }`}</style>
      <div className="no-print" style={{ background: "#fff", borderBottom: "1px solid #e2e8f0", padding: "10px 16px", display: "flex", justifyContent: "flex-end", position: "sticky", top: 0, zIndex: 10 }}>
        <button onClick={() => window.print()} style={{ display: "flex", alignItems: "center", gap: 6, background: "linear-gradient(135deg,#2563eb,#1d4ed8)", border: "none", borderRadius: 8, padding: "9px 18px", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
          <Printer size={16} /> 인쇄 / PDF
        </button>
      </div>
      <div style={S.wrap}>
        <div style={S.doc}>
          <p style={{ color: "#2563eb", fontSize: 10, fontWeight: 900, letterSpacing: "0.2em", margin: "0 0 8px" }}>FIT STEP · 수업 시퀀스</p>
          <h1 style={{ fontSize: 22, fontWeight: 900, color: "#0f172a", margin: "0 0 6px" }}>{seq.title || "(제목 없음)"}</h1>
          {seq.description && <p style={{ fontSize: 14, color: "#475569", margin: "0 0 14px" }}>{seq.description}</p>}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 20 }}>
            {seq.category && <Tag>{seq.category}</Tag>}
            {seq.difficulty && <Tag>{seq.difficulty}</Tag>}
            {seq.targetAudience && <Tag>{seq.targetAudience}</Tag>}
            {seq.estimatedMinutes && <Tag><Clock size={10} /> {seq.estimatedMinutes}분</Tag>}
            {seq.bodyParts && <Tag>{seq.bodyParts}</Tag>}
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
                <p style={{ fontSize: 13, color: "#475569", margin: "3px 0 0" }}>
                  {[ex.sets, ex.reps].filter(Boolean).join(" · ") || "—"}
                </p>
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
