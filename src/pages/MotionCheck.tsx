import { useEffect, useRef, useState, useCallback } from "react";
import { Activity, Play, Square, RotateCcw, Camera, Download, AlertTriangle, Maximize2, Minimize2, Repeat, ScanLine, Wrench, Timer, Trophy } from "lucide-react";
import { track } from "../lib/counter";

/* ── 관절 인덱스 (MediaPipe Pose 33점) ── */
const NOSE = 0;
const L = { shoulder: 11, elbow: 13, wrist: 15, hip: 23, knee: 25, ankle: 27, heel: 29, foot: 31 };
const R = { shoulder: 12, elbow: 14, wrist: 16, hip: 24, knee: 26, ankle: 28, heel: 30, foot: 32 };
const BONES: [number, number][] = [
  [11, 12], [11, 23], [12, 24], [23, 24],
  [11, 13], [13, 15], [12, 14], [14, 16],
  [23, 25], [25, 27], [24, 26], [26, 28],
  [27, 31], [28, 32], [0, 11], [0, 12],
];
const DOTS = [0, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28, 31, 32];

interface Pt { x: number; y: number; visibility?: number }
type Frame = Pt[];

function angle(a: Pt, b: Pt, c: Pt): number {
  const v1 = { x: a.x - b.x, y: a.y - b.y };
  const v2 = { x: c.x - b.x, y: c.y - b.y };
  const d = (v1.x * v2.x + v1.y * v2.y) / (Math.hypot(v1.x, v1.y) * Math.hypot(v2.x, v2.y) || 1);
  return (Math.acos(Math.max(-1, Math.min(1, d))) * 180) / Math.PI;
}
const vis = (f: Frame, i: number) => (f[i]?.visibility ?? 1) > 0.5;

interface Joint { key: string; name: string; side: "L" | "R"; idx: [number, number, number] }
const JOINTS: Joint[] = [
  { key: "lknee", name: "왼 무릎", side: "L", idx: [L.hip, L.knee, L.ankle] },
  { key: "rknee", name: "오른 무릎", side: "R", idx: [R.hip, R.knee, R.ankle] },
  { key: "lhip", name: "왼 고관절", side: "L", idx: [L.shoulder, L.hip, L.knee] },
  { key: "rhip", name: "오른 고관절", side: "R", idx: [R.shoulder, R.hip, R.knee] },
  { key: "lelbow", name: "왼 팔꿈치", side: "L", idx: [L.shoulder, L.elbow, L.wrist] },
  { key: "relbow", name: "오른 팔꿈치", side: "R", idx: [R.shoulder, R.elbow, R.wrist] },
  { key: "lsh", name: "왼 어깨", side: "L", idx: [L.elbow, L.shoulder, L.hip] },
  { key: "rsh", name: "오른 어깨", side: "R", idx: [R.elbow, R.shoulder, R.hip] },
  { key: "lankle", name: "왼 발목", side: "L", idx: [L.knee, L.ankle, L.foot] },
  { key: "rankle", name: "오른 발목", side: "R", idx: [R.knee, R.ankle, R.foot] },
  { key: "neck", name: "목", side: "L", idx: [NOSE, L.shoulder, L.hip] },
];
const PAIRS: [string, string, string][] = [
  ["무릎", "lknee", "rknee"], ["고관절", "lhip", "rhip"],
  ["발목", "lankle", "rankle"],
  ["팔꿈치", "lelbow", "relbow"], ["어깨", "lsh", "rsh"],
];
const mid = (f: Frame, a: number, b: number): Pt => ({ x: (f[a].x + f[b].x) / 2, y: (f[a].y + f[b].y) / 2 });
/** 관절 각도. 목은 코 - 어깨 중앙 - 골반 중앙으로 계산합니다. */
export function jointAngle(f: Frame, key: string): number | null {
  if (key === "neck") {
    if (!vis(f, NOSE) || !vis(f, L.shoulder) || !vis(f, R.shoulder) || !vis(f, L.hip) || !vis(f, R.hip)) return null;
    return angle(f[NOSE], mid(f, L.shoulder, R.shoulder), mid(f, L.hip, R.hip));
  }
  const j = JMAP[key]; if (!j) return null;
  const [a, b, c] = j.idx;
  return vis(f, a) && vis(f, b) && vis(f, c) ? angle(f[a], f[b], f[c]) : null;
}

/* ── 정면·측면 판별 ──
   어깨·골반 너비를 몸통 길이로 나눈 값. 정면에서는 넓고(0.35 이상), 측면에서는 좁습니다(0.24 이하). */
export type View = "front" | "side";
export function viewRatio(f: Frame, aspect = 1): number | null {
  if (!vis(f, L.shoulder) || !vis(f, R.shoulder) || !vis(f, L.hip) || !vis(f, R.hip)) return null;
  const w = (a: number, b: number) => Math.hypot((f[a].x - f[b].x) * aspect, f[a].y - f[b].y);
  const sm = mid(f, L.shoulder, R.shoulder), hm = mid(f, L.hip, R.hip);
  const torso = Math.hypot((sm.x - hm.x) * aspect, sm.y - hm.y);
  if (torso < 0.02) return null;
  return (w(L.shoulder, R.shoulder) + w(L.hip, R.hip)) / 2 / torso;
}
/** 애매한 구간에서는 직전 판정을 유지합니다 (화면이 깜빡이지 않도록) */
export function viewFrom(ratio: number | null, cur: View): View {
  if (ratio === null) return cur;
  if (ratio >= 0.35) return "front";
  if (ratio <= 0.24) return "side";
  return cur;
}
/** 측면일 때 카메라에 가까운(잘 보이는) 쪽 관절 */
export function nearerSide(f: Frame, lKey: string, rKey: string): string {
  const score = (k: string) => (JMAP[k]?.idx ?? []).reduce((a, i) => a + (f[i]?.visibility ?? 1), 0);
  return score(rKey) > score(lKey) ? rKey : lKey;
}

/* ── 횟수 체크: 종목을 고르지 않고 '가장 크게 움직이는 관절'을 찾아서 셉니다 ── */
type SigKey = "knee" | "hip" | "ankle" | "elbow" | "shoulder" | "neck";
type CountPart = "auto" | "upper" | "lower";
/** 자동으로 지켜보는 관절. min = 이보다 작게 움직이면 반복으로 보지 않는 각도 */
export const SIGNALS: { key: SigKey; name: string; group: "upper" | "lower"; l: string; r: string; ex: string; min: number }[] = [
  { key: "knee", name: "무릎", group: "lower", l: "lknee", r: "rknee", ex: "스쿼트·런지", min: 22 },
  { key: "hip", name: "고관절", group: "lower", l: "lhip", r: "rhip", ex: "데드리프트·힙힌지", min: 22 },
  { key: "ankle", name: "발목", group: "lower", l: "lankle", r: "rankle", ex: "카프레이즈·발목 가동", min: 14 },
  { key: "elbow", name: "팔꿈치", group: "upper", l: "lelbow", r: "relbow", ex: "숄더프레스·컬", min: 22 },
  { key: "shoulder", name: "어깨", group: "upper", l: "lsh", r: "rsh", ex: "레터럴 레이즈·프레스", min: 22 },
  { key: "neck", name: "목", group: "upper", l: "neck", r: "neck", ex: "목 가동·턱 당기기", min: 10 },
];
const JMAP: Record<string, Joint> = Object.fromEntries(JOINTS.map((j) => [j.key, j]));
const COUNT_PARTS: { key: CountPart; name: string; desc: string }[] = [
  { key: "auto", name: "전신", desc: "모든 관절" },
  { key: "upper", name: "상체", desc: "팔꿈치·어깨·목" },
  { key: "lower", name: "하체", desc: "무릎·고관절·발목" },
];
type Sig = { v: number; l: number; r: number; min: number; max: number; up: boolean; seen: boolean };
const newSigs = (): Record<SigKey, Sig> =>
  Object.fromEntries(SIGNALS.map((s) => [s.key, { v: 0, l: 0, r: 0, min: 999, max: -999, up: false, seen: false }])) as Record<SigKey, Sig>;
export const DECAY = 0.044;    // 기본 감쇠(프레임당). 관절 기준치에 비례해 조절합니다
export const decayOf = (minRom: number) => minRom * 0.002;  // 작게 움직이는 관절(목·발목)은 더 천천히
export const MIN_OF = (k: SigKey) => SIGNALS.find((s) => s.key === k)!.min;
const MIN_GAP = 420;     // 같은 횟수를 두 번 세지 않도록 최소 간격(ms)

/** 한 관절의 각도를 넣어 현재 값과 최근 범위를 갱신 */
export function feedSig(s: Sig, lv: number | null, rv: number | null, decay = DECAY): void {
  const vals = [lv, rv].filter((x): x is number => x !== null);
  if (!vals.length) return;
  const v = vals.reduce((a, b) => a + b, 0) / vals.length;
  s.v = v; s.l = lv ?? v; s.r = rv ?? v; s.seen = true;
  if (s.max < -900) { s.min = v; s.max = v; }
  else { s.min = Math.min(v, s.min + decay); s.max = Math.max(v, s.max - decay); }
}
export const rangeOf = (s?: Sig) => (s && s.seen && s.max > -900 ? s.max - s.min : 0);

/** 후보 중 가장 크게 움직이는 관절. 바꿀 땐 1.3배 이상 차이날 때만 (기준이 흔들리지 않도록) */
export function chooseDriver(sigs: Record<SigKey, Sig>, keys: SigKey[], cur: SigKey | null): SigKey | null {
  // 관절마다 정상 가동 범위가 달라서, '제 기준치의 몇 배로 움직였는지'로 비교합니다
  const score = (k: SigKey) => rangeOf(sigs[k]) / MIN_OF(k);
  const top = [...keys].sort((a, b) => score(b) - score(a))[0];
  if (!top || score(top) < 1) return cur && keys.includes(cur) && score(cur) >= 1 ? cur : null;
  if (!cur || !keys.includes(cur)) return top;
  if (top !== cur && score(top) > score(cur) * 1.3) return top;
  return cur;
}

/** 기준 관절이 한 번 왕복하면 true (굽혔다 펴든, 폈다 굽히든 같게 셉니다) */
export function repTick(s: Sig, now: number, lastRep: number, minRom: number): boolean {
  const r = rangeOf(s);
  if (r < minRom) return false;
  const lo = s.min + r * 0.3, hi = s.min + r * 0.7;
  if (!s.up && s.v > hi) { s.up = true; return now - lastRep > MIN_GAP; }
  if (s.up && s.v < lo) s.up = false;
  return false;
}

type Stats = Record<string, { min: number; max: number; last: number }>;
const newStats = (): Stats => Object.fromEntries(JOINTS.map((j) => [j.key, { min: 999, max: -999, last: 0 }]));

type Mode = "count" | "analyze";
type AnalyzePart = "upper" | "lower" | "full" | "gait";
const PARTS: { key: AnalyzePart; name: string; desc: string }[] = [
  { key: "upper", name: "상체", desc: "어깨·팔꿈치 정렬과 좌우 균형" },
  { key: "lower", name: "하체", desc: "고관절·무릎·발목 정렬" },
  { key: "full", name: "전신", desc: "머리부터 발까지 전체 정렬" },
  { key: "gait", name: "보행", desc: "걸을 때의 움직임 패턴" },
];

const card: React.CSSProperties = { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: 16 };

/** 사람의 기준점: 골반 중앙(없으면 어깨 중앙) */
function centerOf(f: Frame): Pt | null {
  if (vis(f, L.hip) && vis(f, R.hip)) return { x: (f[L.hip].x + f[R.hip].x) / 2, y: (f[L.hip].y + f[R.hip].y) / 2 };
  if (vis(f, L.shoulder) && vis(f, R.shoulder)) return { x: (f[L.shoulder].x + f[R.shoulder].x) / 2, y: (f[L.shoulder].y + f[R.shoulder].y) / 2 };
  return null;
}
/** 화면에 보이는 크기 = 가까이 있을수록 큼 */
function sizeOf(f: Frame): number {
  const pts = DOTS.filter((i) => vis(f, i)).map((i) => f[i]);
  if (pts.length < 4) return 0;
  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
  return Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
}
export default function MotionCheck() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const landmarkerRef = useRef<{ detectForVideo: (v: HTMLVideoElement, t: number) => { landmarks?: Frame[] }; close?: () => void } | null>(null);
  const rafRef = useRef(0);
  const statsRef = useRef<Stats>(newStats());
  const recRef = useRef(false);
  const repRef = useRef<{ down: boolean; count: number; depth: number }>({ down: false, count: 0, depth: 999 });
  const sigRef = useRef<Record<SigKey, Sig>>(newSigs());
  const driverRef = useRef<SigKey | null>(null);
  const lastRepRef = useRef(0);
  const cPartRef = useRef<CountPart>("auto");
  const trackRef = useRef<Pt | null>(null);   // 지금 따라가는 사람의 위치
  const tapRef = useRef<Pt | null>(null);     // 화면을 눌러 고른 위치 (다음 프레임에 반영)
  const missRef = useRef(0);                  // 놓친 프레임 수
  const lockRef = useRef(false);              // 직접 고른 상태인지

  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [errMsg, setErrMsg] = useState("");
  const [recording, setRecording] = useState(false);
  const [live, setLive] = useState<{ name: string; l: number; r: number; diff: number; rom: number; single: boolean } | null>(null);
  const [cPart, setCPart] = useState<CountPart>("auto");
  const [viewSel, setViewSel] = useState<"auto" | View>("auto");
  const viewSelRef = useRef<"auto" | View>("auto");
  const viewRef = useRef<View>("front");
  const [viewNow, setViewNow] = useState<View>("front");
  const [basis, setBasis] = useState<string | null>(null);
  const [viewUsed, setViewUsed] = useState<View | null>(null);
  // 게임(타임 어택)
  const [gOn, setGOn] = useState(false);
  const [dur, setDur] = useState(30);
  const [gPhase, setGPhase] = useState<"idle" | "ready" | "run" | "done">("idle");
  const gPhaseRef = useRef<"idle" | "ready" | "run" | "done">("idle");
  const [left, setLeft] = useState(0);
  const [gRes, setGRes] = useState<{ reps: number; full: number; balance: number | null; best: number; isBest: boolean; view: View } | null>(null);
  const gRef = useRef({ startAt: 0, endAt: 0, full: 0, balOk: 0, balAll: 0, cmin: 999, cmax: -999 });
  const acRef = useRef<AudioContext | null>(null);
  const [reps, setReps] = useState(0);
  const [result, setResult] = useState<Stats | null>(null);
  const [personIn, setPersonIn] = useState(false);
  const [people, setPeople] = useState(0);
  const [locked, setLocked] = useState(false);
  const [mode, setMode] = useState<Mode>("count");
  const [part, setPart] = useState<AnalyzePart>("full");
  const stageRef = useRef<HTMLDivElement>(null);
  const [full, setFull] = useState(false);
  // 시각 박수 감지 (양손 모으기)
  const visualClapRef = useRef<{ apart: boolean; times: number[] }>({ apart: true, times: [] });
  const [clapTrigger, setClapTrigger] = useState(0);
  const gOnRef = useRef(false);

  useEffect(() => {
    document.title = "모션 메카닉 · FIT STEP";
    if (!sessionStorage.getItem("mc-visited")) { sessionStorage.setItem("mc-visited", "1"); track("mc", "v"); }
    return () => { cancelAnimationFrame(rafRef.current); landmarkerRef.current?.close?.(); };
  }, []);

  useEffect(() => {
    const on = () => setFull(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", on);
    document.addEventListener("webkitfullscreenchange", on);
    return () => {
      document.removeEventListener("fullscreenchange", on);
      document.removeEventListener("webkitfullscreenchange", on);
    };
  }, []);

  async function toggleFull() {
    const el = stageRef.current; if (!el) return;
    try {
      if (document.fullscreenElement) { await document.exitFullscreen(); setFull(false); }
      else if (full) setFull(false);
      else if (el.requestFullscreen) await el.requestFullscreen({ navigationUI: "hide" });
      else setFull((v) => !v); // 전체화면을 막는 기기에서는 화면 꽉 채우기로 대체
    } catch { setFull((v) => !v); }
  }

  /** 화면을 누른 지점 → 영상 좌표(거울 보정) */
  function onStageTap(e: React.PointerEvent) {
    if (status !== "ready") return;
    if ((e.target as HTMLElement).closest("button")) return;
    const cv = canvasRef.current; if (!cv || !cv.width) return;
    const r = cv.getBoundingClientRect();
    const sc = full ? Math.min(r.width / cv.width, r.height / cv.height) : Math.max(r.width / cv.width, r.height / cv.height);
    const dw = cv.width * sc, dh = cv.height * sc;
    const x = (e.clientX - r.left - (r.width - dw) / 2) / dw;
    const y = (e.clientY - r.top - (r.height - dh) / 2) / dh;
    if (x < 0 || x > 1 || y < 0 || y > 1) return;
    tapRef.current = { x: 1 - x, y };
  }
  function autoSelect() {
    tapRef.current = null; trackRef.current = null; missRef.current = 0;
    lockRef.current = false; setLocked(false);
  }

  const draw = useCallback((f: Frame | null, others: Frame[], w: number, h: number) => {
    const cv = canvasRef.current; if (!cv) return;
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    const ctx = cv.getContext("2d")!;
    ctx.clearRect(0, 0, w, h);
    const px = (p: Pt) => ({ x: (1 - p.x) * w, y: p.y * h }); // 거울 보기

    // 측정 대상이 아닌 사람 — 흐리게
    ctx.save();
    ctx.strokeStyle = "rgba(148,163,184,.55)"; ctx.lineWidth = Math.max(2, w / 420);
    others.forEach((o) => {
      BONES.forEach(([a, b]) => {
        if (!vis(o, a) || !vis(o, b)) return;
        const p1 = px(o[a]), p2 = px(o[b]);
        ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
      });
    });
    ctx.restore();

    if (!f) return;

    // 측정 대상 표시
    const c = centerOf(f);
    if (c) {
      const p = px(c);
      ctx.save();
      ctx.strokeStyle = "#4ade80"; ctx.lineWidth = Math.max(2, w / 400); ctx.setLineDash([6, 6]);
      ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(20, w / 22), 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }

    ctx.lineWidth = Math.max(3, w / 220);
    ctx.strokeStyle = "#4ade80"; ctx.shadowColor = "#4ade80"; ctx.shadowBlur = 8;
    BONES.forEach(([a, b]) => {
      if (!vis(f, a) || !vis(f, b)) return;
      const p1 = px(f[a]), p2 = px(f[b]);
      ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
    });
    ctx.fillStyle = "#86efac";
    DOTS.forEach((i) => { if (!vis(f, i)) return; const p = px(f[i]); ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(5, w / 110), 0, Math.PI * 2); ctx.fill(); });
    ctx.shadowBlur = 0;
    // 기준 관절 각도 숫자
    const dk = driverRef.current;
    const dSig = dk ? SIGNALS.find((s) => s.key === dk) : null;
    const annot: [number, number, number][] = dSig
      ? (dSig.l === dSig.r ? [JMAP[dSig.l].idx] : [JMAP[dSig.l].idx, JMAP[dSig.r].idx])
      : [[L.hip, L.knee, L.ankle], [R.hip, R.knee, R.ankle]];
    ctx.font = `700 ${Math.max(16, Math.round(w / 26))}px 'Noto Sans KR', sans-serif`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    annot.forEach(([a, b, c]) => {
      if (!vis(f, a) || !vis(f, b) || !vis(f, c)) return;
      const p = px(f[b]); const deg = Math.round(angle(f[a], f[b], f[c]));
      const t = `${deg}°`; const tw = ctx.measureText(t).width;
      ctx.fillStyle = "rgba(15,34,64,.78)";
      ctx.fillRect(p.x - tw / 2 - 8, p.y - 16, tw + 16, 32);
      ctx.fillStyle = "#ffffff"; ctx.fillText(t, p.x, p.y);
    });
  }, []);

  const loop = useCallback(() => {
    const v = videoRef.current, lm = landmarkerRef.current;
    if (!v || !lm || v.readyState < 2) { rafRef.current = requestAnimationFrame(loop); return; }
    let poses: Frame[] = [];
    try { poses = lm.detectForVideo(v, performance.now()).landmarks ?? []; } catch { poses = []; }

    // ── 측정할 사람 고르기 ──
    const cands = poses
      .map((p) => ({ p, c: centerOf(p), size: sizeOf(p) }))
      .filter((x): x is { p: Frame; c: Pt; size: number } => !!x.c && x.size > 0.08);
    setPeople(cands.length);
    const pool = cands;

    let pick: { p: Frame; c: Pt; size: number } | null = null;
    const tap = tapRef.current;
    if (tap && cands.length) {
      // 누른 지점에서 가장 가까운 사람을 지정 (구역 밖이어도 허용)
      pick = cands.reduce((a, b) => (Math.hypot(b.c.x - tap.x, b.c.y - tap.y) < Math.hypot(a.c.x - tap.x, a.c.y - tap.y) ? b : a));
      tapRef.current = null; lockRef.current = true; setLocked(true);
    } else if (trackRef.current && pool.length) {
      // 직전 위치에서 가장 가까운 사람을 계속 따라감
      const t = trackRef.current;
      const near = pool.reduce((a, b) => (Math.hypot(b.c.x - t.x, b.c.y - t.y) < Math.hypot(a.c.x - t.x, a.c.y - t.y) ? b : a));
      if (Math.hypot(near.c.x - t.x, near.c.y - t.y) < 0.22) pick = near;
    }
    if (!pick && pool.length) {
      if (lockRef.current) {
        // 지정한 사람을 잠깐 놓친 경우: 약 1초간 기다렸다가 자동 선택으로 돌아감
        missRef.current += 1;
        if (missRef.current > 30) { lockRef.current = false; setLocked(false); trackRef.current = null; }
      }
      if (!lockRef.current) pick = pool.reduce((a, b) => (b.size > a.size ? b : a)); // 가장 크게(가까이) 보이는 사람
    }
    if (pick) { trackRef.current = pick.c; missRef.current = 0; }
    else if (!pool.length) { missRef.current += 1; if (missRef.current > 30) { trackRef.current = null; if (lockRef.current) { lockRef.current = false; setLocked(false); } } }

    const f: Frame | null = pick?.p ?? null;
    draw(f, cands.filter((x) => x.p !== f).map((x) => x.p), v.videoWidth || 640, v.videoHeight || 480);
    const part = cPartRef.current;
    const sPool = SIGNALS.filter((s) => part === "auto" || s.group === part);

    // 그 부위의 관절이 하나라도 보이면 측정합니다 (상체만/하체만 나와도 동작)
    const ok = !!f && sPool.some((sg) => jointAngle(f!, sg.l) !== null || jointAngle(f!, sg.r) !== null);
    setPersonIn(ok);

    if (f && ok) {
      // 1) 관절별 각도 갱신 (좌우 평균 — 양팔/양다리 운동을 두 번 세지 않도록)
      // 1-1) 정면인지 측면인지 판별 (자동일 때만)
      const asp = (v.videoWidth || 640) / (v.videoHeight || 480);
      const vw = viewSelRef.current === "auto" ? viewFrom(viewRatio(f, asp), viewRef.current) : viewSelRef.current;
      if (vw !== viewRef.current) { viewRef.current = vw; setViewNow(vw); }

      sPool.forEach((sg) => {
        const sig = sigRef.current[sg.key];
        if (sg.l === sg.r) { feedSig(sig, jointAngle(f!, sg.l), null, decayOf(sg.min)); return; }
        if (vw === "side") {
          // 측면에서는 반대쪽이 가려지므로 카메라에 가까운 쪽만 씁니다
          feedSig(sig, jointAngle(f!, nearerSide(f!, sg.l, sg.r)), null, decayOf(sg.min));
        } else {
          feedSig(sig, jointAngle(f!, sg.l), jointAngle(f!, sg.r), decayOf(sg.min));
        }
      });

      // 2) 기준이 될 관절 고르기
      driverRef.current = chooseDriver(sigRef.current, sPool.map((s) => s.key), driverRef.current);
      const dk = driverRef.current;
      const dSig = dk ? SIGNALS.find((s) => s.key === dk)! : null;
      const d = dk ? sigRef.current[dk] : null;
      setLive(d && dSig ? { name: dSig.name, l: Math.round(d.l), r: Math.round(d.r), diff: Math.round(Math.abs(d.l - d.r)), rom: Math.round(rangeOf(d)), single: dSig.l === dSig.r || viewRef.current === "side" } : null);

      // 3) 기준 관절이 한 번 왕복하면 1회 (굽혔다 펴든, 폈다 굽히든 동일)
      if (recRef.current) {
        JOINTS.forEach((j) => {
          const deg = jointAngle(f!, j.key);
          if (deg === null) return;
          const s = statsRef.current[j.key];
          s.min = Math.min(s.min, deg); s.max = Math.max(s.max, deg); s.last = deg;
        });
        const g = gRef.current, playing = gPhaseRef.current === "run";
        if (d && playing) {
          g.cmin = Math.min(g.cmin, d.v); g.cmax = Math.max(g.cmax, d.v);
          if (viewRef.current === "front" && !(dSig && dSig.l === dSig.r)) {
            g.balAll += 1; if (Math.abs(d.l - d.r) <= 5) g.balOk += 1;   // 좌우 차이 5° 이내로 유지한 시간
          }
        }
        if (d && dk && repTick(d, performance.now(), lastRepRef.current, MIN_OF(dk))) {
          lastRepRef.current = performance.now();
          repRef.current.count += 1; setReps(repRef.current.count);
          if (playing) {
            // 이번 한 번에 쓴 범위가 그동안 쓴 범위의 85% 이상이면 '끝까지' 1회
            if (g.cmax - g.cmin >= rangeOf(d) * 0.85) { g.full += 1; beep(1320, 90); } else beep(880, 70);
            g.cmin = d.v; g.cmax = d.v;
          }
        }
      }
    } else setLive(null);

    // 시각 박수 감지: 양손 손목이 가까워지면(< 0.12) 1번, 1.5초 안에 2번 → 게임 시작
    if (f && gOnRef.current && (gPhaseRef.current === "idle" || gPhaseRef.current === "done")) {
      const lw = f[L.wrist], rw = f[R.wrist];
      if ((lw?.visibility ?? 0) > 0.5 && (rw?.visibility ?? 0) > 0.5) {
        const dist = Math.hypot(lw.x - rw.x, lw.y - rw.y);
        const vc = visualClapRef.current;
        if (vc.apart && dist < 0.18) {
          vc.apart = false;
          const now = Date.now();
          vc.times = [...vc.times.filter((t) => now - t < 2000), now];
          if (vc.times.length >= 2) { vc.times = []; setClapTrigger((c) => c + 1); }
        } else if (!vc.apart && dist > 0.20) {
          vc.apart = true;
        }
      }
    }
    rafRef.current = requestAnimationFrame(loop);
  }, [draw]);

  async function startCamera() {
    setStatus("loading"); setErrMsg("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
      const v = videoRef.current!;
      v.srcObject = stream;
      await v.play();
      const vision = await import("@mediapipe/tasks-vision");
      const files = await vision.FilesetResolver.forVisionTasks("/pose");
      landmarkerRef.current = await vision.PoseLandmarker.createFromOptions(files, {
        baseOptions: { modelAssetPath: "/pose/pose_landmarker_lite.task", delegate: "GPU" },
        runningMode: "VIDEO", numPoses: 4,
      }) as unknown as typeof landmarkerRef.current;
      setStatus("ready");
      rafRef.current = requestAnimationFrame(loop);
    } catch (e) {
      setStatus("error");
      const m = String((e as Error)?.name || e);
      setErrMsg(m.includes("NotAllowed") ? "카메라 사용이 거부되었습니다. 브라우저 설정에서 카메라를 허용해 주세요."
        : m.includes("NotFound") ? "카메라를 찾을 수 없습니다."
        : "카메라 또는 자세 인식을 시작하지 못했습니다. 크롬·사파리에서 다시 시도해 주세요.");
    }
  }

  function beep(freq: number, ms: number, vol = 0.09) {
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ac = acRef.current ?? (acRef.current = new AC());
      if (ac.state === "suspended") ac.resume();
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = "sine"; o.frequency.value = freq; g.gain.value = vol;
      o.connect(g); g.connect(ac.destination);
      o.start();
      g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + ms / 1000);
      o.stop(ac.currentTime + ms / 1000);
    } catch { /* 소리를 막은 기기에서는 조용히 넘어갑니다 */ }
  }
  const bestKey = () => `mc_best_${cPartRef.current}_${viewRef.current}_${dur}`;
  const readBest = () => { try { return Number(localStorage.getItem(bestKey()) || 0); } catch { return 0; } };

  function startGame() {
    if (status !== "ready") return;
    statsRef.current = newStats();
    repRef.current = { down: false, count: 0, depth: 999 };
    lastRepRef.current = 0;
    gRef.current = { startAt: performance.now() + 3000, endAt: 0, full: 0, balOk: 0, balAll: 0, cmin: 999, cmax: -999 };
    setReps(0); setResult(null); setBasis(null); setViewUsed(null); setGRes(null);
    setLeft(3); setGPhase("ready"); gPhaseRef.current = "ready";
    beep(660, 120);
  }
  function finishGame() {
    recRef.current = false;
    gPhaseRef.current = "done"; setGPhase("done");
    const g = gRef.current, n = repRef.current.count;
    const prev = readBest(), isBest = n > prev;
    if (isBest) { try { localStorage.setItem(bestKey(), String(n)); } catch { /* ignore */ } }
    setGRes({
      reps: n, full: g.full,
      balance: viewRef.current === "front" && g.balAll > 30 ? Math.round((g.balOk / g.balAll) * 100) : null,
      best: Math.max(prev, n), isBest, view: viewRef.current,
    });
    const dk = driverRef.current;
    setResult(statsRef.current);
    setBasis(dk ? SIGNALS.find((x) => x.key === dk)!.name : null);
    setViewUsed(viewRef.current);
    track("mc", "u");
    beep(880, 160); setTimeout(() => beep(1100, 220), 180);
  }
  function stopGame() {
    recRef.current = false;
    gPhaseRef.current = "idle"; setGPhase("idle"); setLeft(0); setGRes(null);
  }

  function startRec() {
    statsRef.current = newStats();
    repRef.current = { down: false, count: 0, depth: 999 };
    lastRepRef.current = 0;
    setReps(0); setResult(null); setBasis(null); setViewUsed(null); setRecording(true); recRef.current = true;
  }
  function stopRec() {
    recRef.current = false; setRecording(false);
    setResult(statsRef.current);
    const dk = driverRef.current;
    setBasis(dk ? SIGNALS.find((s) => s.key === dk)!.name : null);
    setViewUsed(viewRef.current);
    track("mc", "u");
  }
  useEffect(() => {
    if (gPhase !== "ready" && gPhase !== "run") return;
    let shown = -1;
    const id = setInterval(() => {
      const now = performance.now(), g = gRef.current;
      if (gPhaseRef.current === "ready") {
        const sLeft = Math.ceil((g.startAt - now) / 1000);
        if (sLeft <= 0) {
          g.endAt = now + dur * 1000; g.cmin = 999; g.cmax = -999;
          recRef.current = true; gPhaseRef.current = "run"; setGPhase("run"); setLeft(dur); beep(1000, 220);
        } else if (sLeft !== shown) { shown = sLeft; setLeft(sLeft); beep(660, 110); }
      } else {
        const sLeft = Math.max(0, Math.ceil((g.endAt - now) / 1000));
        if (sLeft !== shown) { shown = sLeft; setLeft(sLeft); if (sLeft > 0 && sLeft <= 3) beep(660, 110); }
        if (sLeft <= 0) finishGame();
      }
    }, 100);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gPhase, dur]);

  useEffect(() => { gOnRef.current = gOn; }, [gOn]);
  useEffect(() => { if (clapTrigger > 0 && (gPhase === "idle" || gPhase === "done")) startGame(); }, [clapTrigger]);

  function resetAll() {
    setResult(null); setReps(0); setBasis(null); setViewUsed(null);
    statsRef.current = newStats(); repRef.current = { down: false, count: 0, depth: 999 };
    sigRef.current = newSigs(); driverRef.current = null; lastRepRef.current = 0;
  }

  const rom = (k: string) => { const s = result?.[k]; return s && s.max > -999 ? Math.round(s.max - s.min) : 0; };
  const moved = result ? JOINTS.map((j) => ({ ...j, rom: rom(j.key) })).sort((a, b) => b.rom - a.rom) : [];

  function saveResult() {
    if (!result) return;
    const lines = [
      "[모션 메카닉 · 횟수 체크]",
      `측정일: ${new Date().toLocaleString("ko-KR")}`,
      `부위: ${COUNT_PARTS.find((p) => p.key === cPart)?.name} · 시점: ${viewUsed === "side" ? "측면" : "정면"}`,
      `반복 횟수: ${reps}회${basis ? ` (기준 관절: ${basis})` : ""}`,
      "",
      "관절별 움직임 범위",
      ...moved.map((m) => `${m.name}: ${m.rom}°`),
      "",
      ...(viewUsed === "side"
        ? ["좌우 차이: 측면 측정이라 비교하지 않았습니다 (각도는 카메라에 가까운 쪽 기준)"]
        : ["좌우 차이", ...PAIRS.map(([n, l, r]) => `${n}: ${Math.abs(rom(l) - rom(r))}° (왼 ${rom(l)}° / 오른 ${rom(r)}°)`)]),
      "",
      "※ 카메라 추정값으로 몇 도 오차가 있으며, 의학적 진단이 아닙니다.",
    ].join("\n");
    const blob = new Blob([lines], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `motion-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    track("mc", "s");
  }

  return (
    <div style={{ minHeight: "100dvh", background: "#f8fafc", fontFamily: "'Noto Sans KR', sans-serif", color: "#0f172a" }}>
      <header style={{ padding: "16px 16px 12px", display: "flex", alignItems: "center", gap: 10, maxWidth: 980, margin: "0 auto" }}>
        <div style={{ width: 46, height: 46, background: "#1e3a5f", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Activity size={24} color="#86efac" /></div>
        <div>
          <p style={{ color: "#2563eb", fontSize: 10, fontWeight: 800, margin: "0 0 2px", letterSpacing: "0.12em" }}>FIT STEP</p>
          <h1 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>모션 메카닉</h1>
        </div>
      </header>

      <main style={{ maxWidth: 980, margin: "0 auto", padding: "0 16px 120px", display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", gap: 8 }}>
          {([["count", "횟수 체크", Repeat], ["analyze", "자세 분석", ScanLine]] as const).map(([k, label, Icon]) => {
            const on = mode === k;
            return (
              <button key={k} onClick={() => setMode(k)} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "13px 10px", borderRadius: 12, cursor: "pointer", fontSize: 15, fontWeight: 700, border: `1px solid ${on ? "#2563eb" : "#e2e8f0"}`, background: on ? "#eff6ff" : "#fff", color: on ? "#2563eb" : "#64748b" }}>
                <Icon size={16} /> {label}
              </button>
            );
          })}
        </div>

        {mode === "count" && (
          <div style={{ display: "flex", gap: 8 }}>
            {([[false, "측정", ScanLine], [true, "게임 · 타임 어택", Timer]] as const).map(([k, label, Icon]) => {
              const on = gOn === k;
              return (
                <button key={String(k)} onClick={() => { stopGame(); setGOn(k); }} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "11px 10px", borderRadius: 11, cursor: "pointer", fontSize: 14, fontWeight: 700, border: `1px solid ${on ? "#2563eb" : "#e2e8f0"}`, background: on ? "#eff6ff" : "#fff", color: on ? "#2563eb" : "#64748b" }}>
                  <Icon size={15} /> {label}
                </button>
              );
            })}
          </div>
        )}

        {mode === "count" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
            {COUNT_PARTS.map((pt) => {
              const on = cPart === pt.key;
              return (
                <button key={pt.key} onClick={() => { setCPart(pt.key); cPartRef.current = pt.key; sigRef.current = newSigs(); driverRef.current = null; }} style={{ textAlign: "center", padding: "12px 8px", borderRadius: 12, cursor: "pointer", border: `1px solid ${on ? "#2563eb" : "#e2e8f0"}`, background: on ? "#eff6ff" : "#fff" }}>
                  <b style={{ display: "block", fontSize: 15, color: on ? "#2563eb" : "#0f172a" }}>{pt.name}</b>
                  <span style={{ fontSize: 11, color: "#64748b" }}>{pt.desc}</span>
                </button>
              );
            })}
          </div>
        )}

        {mode === "count" && (
          <div style={{ ...card, padding: "12px 14px", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <b style={{ fontSize: 13.5 }}>촬영 시점</b>
            <div style={{ display: "flex", gap: 6 }}>
              {([["auto", "자동"], ["front", "정면"], ["side", "측면"]] as const).map(([k, label]) => {
                const on = viewSel === k;
                return (
                  <button key={k} onClick={() => { setViewSel(k); viewSelRef.current = k; if (k !== "auto") { viewRef.current = k; setViewNow(k); } }}
                    style={{ padding: "7px 14px", borderRadius: 9, cursor: "pointer", fontSize: 13, fontWeight: 700, border: `1px solid ${on ? "#2563eb" : "#e2e8f0"}`, background: on ? "#eff6ff" : "#fff", color: on ? "#2563eb" : "#64748b" }}>
                    {label}
                  </button>
                );
              })}
            </div>
            <span style={{ fontSize: 12.5, color: "#475569", marginLeft: "auto" }}>
              {viewSel === "auto" ? `지금 ${viewNow === "front" ? "정면" : "측면"}으로 인식 중` : `${viewNow === "front" ? "정면" : "측면"}으로 고정`}
            </span>
            <p style={{ fontSize: 12, color: "#64748b", lineHeight: 1.7, margin: 0, width: "100%" }}>
              {viewNow === "front"
                ? "정면: 좌우 차이를 볼 수 있습니다. 대신 앞뒤로 굽히는 깊이(스쿼트 깊이·힙힌지)는 납작하게 보여 각도가 실제보다 작게 나옵니다."
                : "측면: 굽히는 깊이가 정확합니다. 대신 반대쪽 팔다리가 가려져 좌우 비교는 할 수 없어, 카메라에 가까운 쪽만 측정합니다."}
            </p>
          </div>
        )}

        {mode === "analyze" && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8 }}>
              {PARTS.map((pt) => {
                const on = part === pt.key;
                return (
                  <button key={pt.key} onClick={() => setPart(pt.key)} style={{ textAlign: "left", padding: "12px 14px", borderRadius: 12, cursor: "pointer", border: `1px solid ${on ? "#2563eb" : "#e2e8f0"}`, background: on ? "#eff6ff" : "#fff" }}>
                    <b style={{ display: "block", fontSize: 14, color: on ? "#2563eb" : "#0f172a" }}>{pt.name}</b>
                    <span style={{ fontSize: 11.5, color: "#64748b" }}>{pt.desc}</span>
                  </button>
                );
              })}
            </div>
            <div style={{ ...card, display: "flex", gap: 12, alignItems: "flex-start", background: "#f8fafc", borderStyle: "dashed" }}>
              <Wrench size={18} color="#64748b" style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <b style={{ fontSize: 14, display: "block", marginBottom: 4 }}>{PARTS.find((x) => x.key === part)?.name} 분석 — 준비 중</b>
                <p style={{ fontSize: 13, color: "#475569", lineHeight: 1.7, margin: 0 }}>
                  어떤 항목을 어떤 기준으로 볼지 함께 정한 뒤 추가합니다. 아래 카메라로 관절 위치는 지금도 확인할 수 있습니다.
                </p>
              </div>
            </div>
          </>
        )}

        <div
          ref={stageRef}
          onPointerDown={onStageTap}
          style={full
            ? { position: "fixed", inset: 0, zIndex: 50, background: "#000", borderRadius: 0, overflow: "hidden" }
            : { position: "relative", background: "#0f172a", borderRadius: 16, overflow: "hidden", aspectRatio: "4 / 3" }}
        >
          <video ref={videoRef} playsInline muted style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: full ? "contain" : "cover", transform: "scaleX(-1)" }} />
          <canvas ref={canvasRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: full ? "contain" : "cover" }} />

          {status !== "ready" && (
            <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, padding: 20, textAlign: "center", color: "#e2e8f0" }}>
              <Camera size={34} color="#64748b" />
              {status === "loading" ? <p style={{ fontSize: 14 }}>카메라와 자세 인식을 준비하고 있습니다…</p> : status === "error" ? (
                <>
                  <p style={{ fontSize: 14, color: "#fca5a5", lineHeight: 1.7 }}>{errMsg}</p>
                  <button onClick={startCamera} style={{ background: "#2563eb", color: "#fff", border: "none", borderRadius: 10, padding: "12px 20px", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>다시 시도</button>
                </>
              ) : (
                <>
                  <p style={{ fontSize: 14, lineHeight: 1.7 }}>정면에서 전신이 보이도록 카메라를 놓고 시작하세요.<br />영상은 이 기기 안에서만 처리되고 전송되지 않습니다.</p>
                  <button onClick={startCamera} style={{ background: "#2563eb", color: "#fff", border: "none", borderRadius: 10, padding: "14px 24px", fontSize: 16, fontWeight: 700, cursor: "pointer" }}>카메라 켜기</button>
                </>
              )}
            </div>
          )}

          {status === "ready" && (
            <>
              <div style={{ position: "absolute", top: "calc(10px + env(safe-area-inset-top, 0px))", left: 10, right: 10, display: "flex", gap: 8, alignItems: "flex-start", flexWrap: "wrap" }}>
                {mode === "analyze" && <span style={{ background: "rgba(37,99,235,.9)", color: "#fff", fontSize: 12, fontWeight: 700, borderRadius: 20, padding: "4px 10px" }}>{PARTS.find((x) => x.key === part)?.name} 보기</span>}
                {mode === "count" && <span style={{ background: "rgba(15,23,42,.8)", color: "#fff", fontSize: 12, fontWeight: 700, borderRadius: 20, padding: "4px 10px" }}>{viewNow === "front" ? "정면" : "측면"}{viewSel === "auto" ? " 자동" : " 고정"}</span>}
                {mode === "count" && live && <span style={{ background: "rgba(37,99,235,.9)", color: "#fff", fontSize: 12, fontWeight: 700, borderRadius: 20, padding: "4px 10px" }}>기준 {live.name} · 범위 {live.rom}°</span>}
                {recording && <span style={{ background: "#dc2626", color: "#fff", fontSize: 12, fontWeight: 700, borderRadius: 20, padding: "4px 10px" }}>● 측정 중</span>}
                {recording && <span style={{ background: "rgba(15,23,42,.8)", color: "#fff", fontSize: 13, fontWeight: 700, borderRadius: 20, padding: "4px 12px" }}>{reps}회</span>}
                {people > 1 && <span style={{ background: "rgba(15,23,42,.8)", color: "#fff", fontSize: 12, fontWeight: 700, borderRadius: 20, padding: "4px 10px" }}>{people}명 인식 · {locked ? "지정한 사람 측정" : "가까운 사람 측정"}</span>}
                {locked && <button onClick={autoSelect} style={{ background: "rgba(37,99,235,.92)", color: "#fff", border: "none", fontSize: 12, fontWeight: 700, borderRadius: 20, padding: "5px 11px", cursor: "pointer" }}>자동 선택으로</button>}
                {!personIn && <span style={{ background: "rgba(234,88,12,.9)", color: "#fff", fontSize: 12, fontWeight: 700, borderRadius: 20, padding: "4px 10px" }}>화면 안에 {cPart === "upper" ? "상체" : cPart === "lower" ? "하체" : "전신"}가 보이게 서 주세요</span>}
              </div>
              {full && (
                <button
                  onClick={toggleFull}
                  aria-label="화면 작게"
                  style={{ position: "absolute", top: "calc(10px + env(safe-area-inset-top, 0px))", right: 10, display: "flex", alignItems: "center", gap: 5, background: "rgba(15,23,42,.85)", border: "1px solid rgba(255,255,255,.2)", borderRadius: 10, padding: "9px 14px", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
                >
                  <Minimize2 size={15} /> 작게
                </button>
              )}

              {mode === "count" && gOn && (gPhase === "ready" || gPhase === "run") && (
                <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
                  {gPhase === "ready" ? (
                    <div style={{ fontSize: "min(28vw, 180px)", fontWeight: 800, color: "#fff", textShadow: "0 4px 24px rgba(0,0,0,.6)" }}>{left}</div>
                  ) : (
                    <div style={{ position: "absolute", top: "26%", textAlign: "center", color: "#fff", textShadow: "0 3px 18px rgba(0,0,0,.65)" }}>
                      <div style={{ fontSize: "min(22vw, 140px)", fontWeight: 800, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{reps}</div>
                      <div style={{ fontSize: "min(7vw, 34px)", fontWeight: 800, color: left <= 5 ? "#fca5a5" : "#fff", fontVariantNumeric: "tabular-nums" }}>{left}초</div>
                    </div>
                  )}
                </div>
              )}

              {full && mode === "count" && gOn && (
                <div style={{ position: "absolute", bottom: "calc(16px + env(safe-area-inset-bottom, 0px))", left: 16, right: 16, display: "flex", justifyContent: "center" }}>
                  {gPhase === "idle" || gPhase === "done" ? (
                    <button onClick={startGame} style={{ flex: 1, maxWidth: 260, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: 16, borderRadius: 12, border: "none", background: "#2563eb", color: "#fff", fontSize: 16, fontWeight: 700, cursor: "pointer" }}><Play size={17} /> {dur}초 시작</button>
                  ) : (
                    <button onClick={stopGame} style={{ flex: 1, maxWidth: 260, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: 16, borderRadius: 12, border: "none", background: "#dc2626", color: "#fff", fontSize: 16, fontWeight: 700, cursor: "pointer" }}><Square size={16} /> 그만두기</button>
                  )}
                </div>
              )}

              {full && mode === "count" && !gOn && (
                <div style={{ position: "absolute", bottom: "calc(16px + env(safe-area-inset-bottom, 0px))", left: 16, right: 16, display: "flex", gap: 8, justifyContent: "center" }}>
                  {!recording ? (
                    <button onClick={startRec} style={{ flex: 1, maxWidth: 260, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: 16, borderRadius: 12, border: "none", background: "#2563eb", color: "#fff", fontSize: 16, fontWeight: 700, cursor: "pointer" }}><Play size={17} /> 측정 시작</button>
                  ) : (
                    <button onClick={stopRec} style={{ flex: 1, maxWidth: 260, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: 16, borderRadius: 12, border: "none", background: "#dc2626", color: "#fff", fontSize: 16, fontWeight: 700, cursor: "pointer" }}><Square size={16} /> 측정 끝</button>
                  )}
                </div>
              )}

              {live && (
                <div style={{ position: "absolute", bottom: full ? "calc(86px + env(safe-area-inset-bottom, 0px))" : 10, left: 10, right: 10, display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
                  {(live.single ? [[live.name, live.l]] : [[`왼 ${live.name}`, live.l], [`오른 ${live.name}`, live.r], ["좌우 차이", live.diff]]).map(([n, v], i) => (
                    <span key={n as string} style={{ background: i === 2 && (v as number) >= 10 ? "rgba(234,88,12,.92)" : "rgba(15,23,42,.8)", color: "#fff", fontSize: 13, borderRadius: 10, padding: "6px 12px", fontVariantNumeric: "tabular-nums" }}>
                      {n} <b>{v}°</b>
                    </span>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {status === "ready" && (
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button
              onClick={toggleFull}
              aria-label={full ? "전체화면 끄기" : "전체화면"}
              style={{ display: "flex", alignItems: "center", gap: 6, background: "#0f172a", border: "none", borderRadius: 10, padding: "9px 16px", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
            >
              {full ? <Minimize2 size={15} /> : <Maximize2 size={15} />} {full ? "화면 작게" : "전체화면"}
            </button>
          </div>
        )}

        {status === "ready" && mode === "count" && gOn && (
          <div style={{ ...card, display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <b style={{ fontSize: 14 }}>제한 시간</b>
              {[30, 60].map((d) => {
                const on = dur === d;
                return (
                  <button key={d} onClick={() => { stopGame(); setDur(d); }} disabled={gPhase === "ready" || gPhase === "run"}
                    style={{ padding: "7px 16px", borderRadius: 9, cursor: gPhase === "run" ? "not-allowed" : "pointer", fontSize: 13.5, fontWeight: 700, border: `1px solid ${on ? "#2563eb" : "#e2e8f0"}`, background: on ? "#eff6ff" : "#fff", color: on ? "#2563eb" : "#64748b" }}>
                    {d}초
                  </button>
                );
              })}
              <span style={{ marginLeft: "auto", fontSize: 12.5, color: "#475569" }}>내 최고 {readBest()}회</span>
            </div>
            {gPhase === "idle" || gPhase === "done" ? (
              <>
                <button onClick={startGame} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: 16, borderRadius: 12, border: "none", background: "#2563eb", color: "#fff", fontSize: 16, fontWeight: 700, cursor: "pointer" }}><Play size={17} /> {dur}초 타임 어택 시작</button>
                <p style={{ fontSize: 12, color: "#64748b", textAlign: "center", margin: 0 }}>
                  👏 양손을 모았다 펴기 2번으로도 시작할 수 있습니다
                </p>
              </>
            ) : (
              <button onClick={stopGame} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: 16, borderRadius: 12, border: "none", background: "#dc2626", color: "#fff", fontSize: 16, fontWeight: 700, cursor: "pointer" }}><Square size={16} /> 그만두기</button>
            )}
            <p style={{ fontSize: 12, color: "#64748b", lineHeight: 1.7, margin: 0 }}>
              3초 뒤 시작합니다. 제한 시간 안에 최대한 많이 반복하세요. 한 번 셀 때마다 소리가 납니다.
              {" "}지금 시점은 <b>{viewNow === "front" ? "정면" : "측면"}</b>이라 보너스는 <b>{viewNow === "front" ? "좌우 균형(좌우 차이 5° 이내 유지 시간)" : "끝까지 내려간 횟수(가동 범위 85% 이상)"}</b>입니다.
              {" "}기록은 이 기기에만 저장되고 서버로 보내지 않습니다.
            </p>
          </div>
        )}

        {gRes && mode === "count" && gOn && (
          <div style={{ ...card, border: "2px solid #2563eb", display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Trophy size={18} color="#2563eb" />
              <b style={{ fontSize: 16 }}>{dur}초 결과</b>
              {gRes.isBest && <span style={{ background: "#2563eb", color: "#fff", fontSize: 12, fontWeight: 800, borderRadius: 20, padding: "3px 10px" }}>신기록!</span>}
              <span style={{ marginLeft: "auto", fontSize: 12.5, color: "#64748b" }}>{gRes.view === "front" ? "정면" : "측면"} · {basis ?? "기준 없음"}</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: 8 }}>
              {[
                { n: "횟수", v: `${gRes.reps}회` },
                { n: "분당 환산", v: `${Math.round((gRes.reps * 60) / dur)}회` },
                gRes.view === "side"
                  ? { n: "끝까지 내려간 횟수", v: `${gRes.full}회` }
                  : { n: "좌우 균형", v: gRes.balance === null ? "—" : `${gRes.balance}%` },
                { n: "내 최고", v: `${gRes.best}회` },
              ].map((x) => (
                <div key={x.n} style={{ background: "#f8fafc", borderRadius: 10, padding: "10px 12px" }}>
                  <p style={{ fontSize: 11.5, color: "#64748b", margin: "0 0 2px" }}>{x.n}</p>
                  <b style={{ fontSize: 19, color: "#0f172a", fontVariantNumeric: "tabular-nums" }}>{x.v}</b>
                </div>
              ))}
            </div>
            <p style={{ fontSize: 11.5, color: "#64748b", lineHeight: 1.7, margin: 0 }}>
              {gRes.view === "side"
                ? "측면이라 깊이를 봤습니다. 한 번에 쓴 각도가 그 세트에서 쓴 최대 범위의 85% 이상이면 '끝까지'로 셉니다."
                : gRes.balance === null
                  ? "좌우 균형은 좌우가 모두 보이고 좌우 구분이 있는 관절에서만 계산합니다."
                  : "정면이라 좌우 균형을 봤습니다. 측정 시간 중 좌우 차이가 5° 이내였던 비율입니다."}
            </p>
            <button onClick={startGame} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: 13, borderRadius: 10, border: "1px solid #2563eb", background: "#fff", color: "#2563eb", fontSize: 14, fontWeight: 700, cursor: "pointer" }}><RotateCcw size={15} /> 한 번 더</button>
          </div>
        )}

        {status === "ready" && mode === "count" && !gOn && (
          <div style={{ display: "flex", gap: 8 }}>
            {!recording ? (
              <button onClick={startRec} style={{ flex: 2, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: 16, borderRadius: 12, border: "none", background: "#2563eb", color: "#fff", fontSize: 16, fontWeight: 700, cursor: "pointer" }}><Play size={17} /> 측정 시작</button>
            ) : (
              <button onClick={stopRec} style={{ flex: 2, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: 16, borderRadius: 12, border: "none", background: "#dc2626", color: "#fff", fontSize: 16, fontWeight: 700, cursor: "pointer" }}><Square size={16} /> 측정 끝</button>
            )}
            <button onClick={resetAll} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: 16, borderRadius: 12, border: "1px solid #e2e8f0", background: "#fff", color: "#475569", fontSize: 15, fontWeight: 700, cursor: "pointer" }}><RotateCcw size={15} /> 초기화</button>
          </div>
        )}

        {mode === "count" && status === "ready" && (
          <div style={{ ...card, padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <b style={{ fontSize: 13.5 }}>측정할 사람</b>
              <span style={{ fontSize: 12.5, color: "#475569" }}>{people === 0 ? "아직 인식된 사람이 없습니다" : locked ? `${people}명 중 직접 지정한 사람을 측정 중` : `${people}명 인식 · 가장 가까운 사람 자동 선택`}</span>
              {locked && <button onClick={autoSelect} style={{ marginLeft: "auto", padding: "7px 12px", borderRadius: 9, border: "1px solid #e2e8f0", background: "#fff", color: "#2563eb", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>자동 선택으로</button>}
            </div>
            <p style={{ fontSize: 12, color: "#64748b", lineHeight: 1.7, margin: 0 }}>
              여러 명이 보이면 <b>가장 크게(가까이) 보이는 사람</b>을 자동으로 고릅니다. 다른 사람을 재려면 <b>화면에서 그 사람을 한 번 누르세요</b> — 지정하면 계속 그 사람만 따라갑니다.
            </p>
            <div style={{ borderTop: "1px solid #eef2f7", paddingTop: 10 }}>
              <b style={{ fontSize: 13.5, display: "block", marginBottom: 4 }}>세는 방식</b>
              <p style={{ fontSize: 12, color: "#64748b", lineHeight: 1.7, margin: 0 }}>
                운동 종목을 고르지 않습니다. 선택한 부위에서 <b>가장 크게 움직이는 관절</b>을 자동으로 잡고, 그 관절이 한 번 왕복하면 1회입니다.
                {" "}목·어깨·팔꿈치·고관절·무릎·발목 여섯 관절을 모두 지켜보다가, 스쿼트면 무릎, 데드리프트면 고관절, 컬·프레스면 팔꿈치, 레터럴 레이즈면 어깨, 카프레이즈면 발목이 저절로 기준이 됩니다.
                {" "}운동을 바꾸면 몇 회 안에 기준 관절도 따라 바뀝니다. 관절마다 기준치가 있어 그보다 작게 움직이면(가만히 서서 숨 쉬는 정도) 세지 않습니다.
              </p>
            </div>
          </div>
        )}

        {mode === "count" && result && (
          <div style={{ ...card, display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
              <b style={{ fontSize: 16 }}>측정 결과</b>
              <span style={{ fontSize: 14, color: "#475569" }}>
                {basis && <span style={{ fontSize: 12.5, color: "#64748b", marginRight: 8 }}>기준 {basis}</span>}
                반복 <b style={{ color: "#2563eb", fontSize: 20 }}>{reps}</b>회
              </span>
            </div>

            <div>
              <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>많이 움직인 관절</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {moved.map((m) => (
                  <div key={m.key} style={{ display: "grid", gridTemplateColumns: "74px 1fr 46px", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 12, color: "#475569" }}>{m.name}</span>
                    <span style={{ height: 14, background: "#f1f5f9", borderRadius: 7, overflow: "hidden" }}>
                      <i style={{ display: "block", height: "100%", width: `${Math.min(100, (m.rom / Math.max(1, moved[0].rom)) * 100)}%`, background: m.rom >= 20 ? "#2563eb" : "#cbd5e1", borderRadius: 7 }} />
                    </span>
                    <b style={{ fontSize: 13, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{m.rom}°</b>
                  </div>
                ))}
              </div>
              <p style={{ fontSize: 11, color: "#64748b", marginTop: 8 }}>움직임 범위 = 측정 중 가장 펴진 각도와 가장 굽힌 각도의 차이입니다.</p>
            </div>

            {viewUsed === "side" ? (
              <div style={{ background: "#f8fafc", borderRadius: 10, padding: "12px 14px" }}>
                <p style={{ fontSize: 13, fontWeight: 700, margin: "0 0 4px" }}>좌우 차이 — 측면에서는 측정하지 않습니다</p>
                <p style={{ fontSize: 12, color: "#64748b", lineHeight: 1.7, margin: 0 }}>
                  측면에서는 반대쪽 팔다리가 몸에 가려져 좌우를 비교할 수 없습니다. 좌우 차이를 보려면 <b>정면</b>에서 한 세트 더 측정해 주세요.
                  {" "}위 각도는 카메라에 가까운 쪽 기준입니다.
                </p>
              </div>
            ) : (
            <div>
              <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>좌우 차이</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {PAIRS.map(([n, l, r]) => {
                  const d = Math.abs(rom(l) - rom(r));
                  const big = d >= 10;
                  return (
                    <div key={n} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, background: big ? "#fff7ed" : "#f8fafc", borderRadius: 8, padding: "9px 12px" }}>
                      <span style={{ width: 54, color: "#475569" }}>{n}</span>
                      <span style={{ color: "#64748b", fontVariantNumeric: "tabular-nums" }}>왼 {rom(l)}° · 오른 {rom(r)}°</span>
                      <b style={{ marginLeft: "auto", color: big ? "#c2410c" : "#0f172a", fontVariantNumeric: "tabular-nums" }}>{d}°</b>
                    </div>
                  );
                })}
              </div>
              <p style={{ fontSize: 11, color: "#64748b", marginTop: 8 }}>좌우 차이가 10° 이상이면 주황색으로 표시합니다. 정면에서는 앞뒤로 굽히는 깊이가 실제보다 작게 나오니, 깊이는 측면에서 다시 재 주세요.</p>
            </div>
            )}

            <button onClick={saveResult} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: 13, borderRadius: 10, border: "1px solid #e2e8f0", background: "#fff", color: "#2563eb", fontSize: 14, fontWeight: 700, cursor: "pointer" }}><Download size={15} /> 결과 저장 (텍스트)</button>
          </div>
        )}

        <div style={{ ...card, display: "flex", gap: 10, alignItems: "flex-start", background: "#fff7ed", border: "1px solid #fdba74" }}>
          <AlertTriangle size={16} color="#ea580c" style={{ flexShrink: 0, marginTop: 2 }} />
          <p style={{ fontSize: 12.5, color: "#7c2d12", lineHeight: 1.7, margin: 0 }}>
            카메라로 추정한 값이라 각도에 몇 도 오차가 있습니다. 운동 경과를 회원에게 설명하는 자료이며 <b>의학적 진단이 아닙니다</b>.
            정면 촬영이라 무릎·고관절을 앞뒤로 굽히는 깊이는 정확하지 않을 수 있습니다. 전신이 보이고 밝은 곳에서, 몸에 붙는 옷으로 측정하면 더 정확합니다.
          </p>
        </div>
      </main>
    </div>
  );
}
