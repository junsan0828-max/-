import { useEffect, useRef, useState, useCallback } from "react";
import { Activity, Play, Square, RotateCcw, Camera, Download, AlertTriangle, Maximize2, Minimize2, Repeat, ScanLine, Wrench } from "lucide-react";
import { track } from "../lib/counter";

/* ── 관절 인덱스 (MediaPipe Pose 33점) ── */
const L = { shoulder: 11, elbow: 13, wrist: 15, hip: 23, knee: 25, ankle: 27 };
const R = { shoulder: 12, elbow: 14, wrist: 16, hip: 24, knee: 26, ankle: 28 };
const BONES: [number, number][] = [
  [11, 12], [11, 23], [12, 24], [23, 24],
  [11, 13], [13, 15], [12, 14], [14, 16],
  [23, 25], [25, 27], [24, 26], [26, 28],
];
const DOTS = [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28];

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
];
const PAIRS: [string, string, string][] = [
  ["무릎", "lknee", "rknee"], ["고관절", "lhip", "rhip"],
  ["팔꿈치", "lelbow", "relbow"], ["어깨", "lsh", "rsh"],
];

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

/* ── 측정 구역 (화면 가운데. 이 안에 있는 사람만 측정 대상으로 봅니다) ── */
const ZONE = { x0: 0.17, x1: 0.83, y0: 0.02, y1: 0.98 };

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
const inZone = (c: Pt) => c.x >= ZONE.x0 && c.x <= ZONE.x1 && c.y >= ZONE.y0 && c.y <= ZONE.y1;

export default function MotionCheck() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const landmarkerRef = useRef<{ detectForVideo: (v: HTMLVideoElement, t: number) => { landmarks?: Frame[] }; close?: () => void } | null>(null);
  const rafRef = useRef(0);
  const statsRef = useRef<Stats>(newStats());
  const recRef = useRef(false);
  const repRef = useRef<{ down: boolean; count: number; depth: number }>({ down: false, count: 0, depth: 999 });
  const trackRef = useRef<Pt | null>(null);   // 지금 따라가는 사람의 위치
  const tapRef = useRef<Pt | null>(null);     // 화면을 눌러 고른 위치 (다음 프레임에 반영)
  const missRef = useRef(0);                  // 놓친 프레임 수
  const lockRef = useRef(false);              // 직접 고른 상태인지

  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [errMsg, setErrMsg] = useState("");
  const [recording, setRecording] = useState(false);
  const [live, setLive] = useState<{ lknee: number; rknee: number; diff: number } | null>(null);
  const [reps, setReps] = useState(0);
  const [result, setResult] = useState<Stats | null>(null);
  const [personIn, setPersonIn] = useState(false);
  const [people, setPeople] = useState(0);
  const [locked, setLocked] = useState(false);
  const [zoneOn, setZoneOn] = useState(true);
  const zoneRef = useRef(true);
  const [mode, setMode] = useState<Mode>("count");
  const [part, setPart] = useState<AnalyzePart>("full");
  const stageRef = useRef<HTMLDivElement>(null);
  const [full, setFull] = useState(false);

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

    // 측정 구역 안내선
    if (zoneRef.current) {
      const x = (1 - ZONE.x1) * w, y = ZONE.y0 * h;
      const bw = (ZONE.x1 - ZONE.x0) * w, bh = (ZONE.y1 - ZONE.y0) * h;
      ctx.save();
      ctx.fillStyle = "rgba(0,0,0,.34)";
      ctx.fillRect(0, 0, x, h); ctx.fillRect(x + bw, 0, w - x - bw, h);
      ctx.setLineDash([10, 8]); ctx.lineWidth = Math.max(2, w / 420); ctx.strokeStyle = "rgba(255,255,255,.65)";
      ctx.strokeRect(x, y, bw, bh);
      ctx.restore();
    }

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
    // 무릎 각도 숫자
    ctx.font = `700 ${Math.max(16, Math.round(w / 26))}px 'Noto Sans KR', sans-serif`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ([[L.hip, L.knee, L.ankle], [R.hip, R.knee, R.ankle]] as const).forEach(([a, b, c]) => {
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
    let pool = zoneRef.current ? cands.filter((x) => inZone(x.c)) : cands;
    if (!pool.length && !zoneRef.current) pool = cands;

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
    const ok = !!f && vis(f, L.knee) && vis(f, R.knee) && vis(f, L.hip) && vis(f, R.hip);
    setPersonIn(ok);
    if (f && ok) {
      const lk = angle(f[L.hip], f[L.knee], f[L.ankle]);
      const rk = angle(f[R.hip], f[R.knee], f[R.ankle]);
      setLive({ lknee: Math.round(lk), rknee: Math.round(rk), diff: Math.round(Math.abs(lk - rk)) });
      if (recRef.current) {
        JOINTS.forEach((j) => {
          const [a, b, c] = j.idx;
          if (!vis(f!, a) || !vis(f!, b) || !vis(f!, c)) return;
          const deg = angle(f![a], f![b], f![c]);
          const s = statsRef.current[j.key];
          s.min = Math.min(s.min, deg); s.max = Math.max(s.max, deg); s.last = deg;
        });
        // 반복 세기: 양 무릎 평균이 150도 아래로 내려갔다가 160도 위로 돌아오면 1회
        const knee = (lk + rk) / 2;
        const r = repRef.current;
        if (!r.down && knee < 150) { r.down = true; r.depth = knee; }
        if (r.down) r.depth = Math.min(r.depth, knee);
        if (r.down && knee > 160) { r.down = false; r.count += 1; r.depth = 999; setReps(r.count); }
      }
    } else setLive(null);
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

  function startRec() {
    statsRef.current = newStats();
    repRef.current = { down: false, count: 0, depth: 999 };
    setReps(0); setResult(null); setRecording(true); recRef.current = true;
  }
  function stopRec() {
    recRef.current = false; setRecording(false);
    setResult(statsRef.current);
    track("mc", "u");
  }
  function resetAll() { setResult(null); setReps(0); statsRef.current = newStats(); repRef.current = { down: false, count: 0, depth: 999 }; }

  const rom = (k: string) => { const s = result?.[k]; return s && s.max > -999 ? Math.round(s.max - s.min) : 0; };
  const moved = result ? JOINTS.map((j) => ({ ...j, rom: rom(j.key) })).sort((a, b) => b.rom - a.rom) : [];

  function saveResult() {
    if (!result) return;
    const lines = [
      "[모션 메카닉 · 횟수 체크]",
      `측정일: ${new Date().toLocaleString("ko-KR")}`,
      `반복 횟수: ${reps}회`,
      "",
      "관절별 움직임 범위",
      ...moved.map((m) => `${m.name}: ${m.rom}°`),
      "",
      "좌우 차이",
      ...PAIRS.map(([n, l, r]) => `${n}: ${Math.abs(rom(l) - rom(r))}° (왼 ${rom(l)}° / 오른 ${rom(r)}°)`),
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
              <div style={{ position: "absolute", top: "calc(10px + env(safe-area-inset-top, 0px))", left: 10, right: 124, display: "flex", gap: 8, alignItems: "flex-start", flexWrap: "wrap" }}>
                {mode === "analyze" && <span style={{ background: "rgba(37,99,235,.9)", color: "#fff", fontSize: 12, fontWeight: 700, borderRadius: 20, padding: "4px 10px" }}>{PARTS.find((x) => x.key === part)?.name} 보기</span>}
                {recording && <span style={{ background: "#dc2626", color: "#fff", fontSize: 12, fontWeight: 700, borderRadius: 20, padding: "4px 10px" }}>● 측정 중</span>}
                {recording && <span style={{ background: "rgba(15,23,42,.8)", color: "#fff", fontSize: 13, fontWeight: 700, borderRadius: 20, padding: "4px 12px" }}>{reps}회</span>}
                {people > 1 && <span style={{ background: "rgba(15,23,42,.8)", color: "#fff", fontSize: 12, fontWeight: 700, borderRadius: 20, padding: "4px 10px" }}>{people}명 인식 · {locked ? "지정한 사람 측정" : "가까운 사람 측정"}</span>}
                {locked && <button onClick={autoSelect} style={{ background: "rgba(37,99,235,.92)", color: "#fff", border: "none", fontSize: 12, fontWeight: 700, borderRadius: 20, padding: "5px 11px", cursor: "pointer" }}>자동 선택으로</button>}
                {!personIn && <span style={{ background: "rgba(234,88,12,.9)", color: "#fff", fontSize: 12, fontWeight: 700, borderRadius: 20, padding: "4px 10px" }}>측정 구역 안에 전신이 보이게 서 주세요</span>}
              </div>
              <button
                onClick={toggleFull}
                aria-label={full ? "전체화면 끄기" : "전체화면"}
                style={{ position: "absolute", top: 10, right: 10, display: "flex", alignItems: "center", gap: 6, background: "rgba(15,23,42,.8)", border: "none", borderRadius: 10, padding: "9px 12px", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
              >
                {full ? <Minimize2 size={15} /> : <Maximize2 size={15} />} {full ? "작게" : "전체화면"}
              </button>

              {full && mode === "count" && (
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
                  {[["왼 무릎", live.lknee], ["오른 무릎", live.rknee], ["좌우 차이", live.diff]].map(([n, v], i) => (
                    <span key={n as string} style={{ background: i === 2 && (v as number) >= 10 ? "rgba(234,88,12,.92)" : "rgba(15,23,42,.8)", color: "#fff", fontSize: 13, borderRadius: 10, padding: "6px 12px", fontVariantNumeric: "tabular-nums" }}>
                      {n} <b>{v}°</b>
                    </span>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {status === "ready" && mode === "count" && (
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
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "#475569", cursor: "pointer" }}>
              <input type="checkbox" checked={zoneOn} onChange={(e) => { setZoneOn(e.target.checked); zoneRef.current = e.target.checked; autoSelect(); }} />
              측정 구역만 보기 — 구역 밖(뒤로 지나가거나 옆에 선 사람)은 세지 않습니다
            </label>
            <p style={{ fontSize: 12, color: "#64748b", lineHeight: 1.7, margin: 0 }}>
              여러 명이 보이면 <b>가장 크게(가까이) 보이는 사람</b>을 자동으로 고릅니다. 다른 사람을 재려면 <b>화면에서 그 사람을 한 번 누르세요</b> — 지정하면 계속 그 사람만 따라갑니다.
              {" "}지금은 <b>스쿼트</b> 기준으로, 무릎이 굽혔다 펴지면 1회입니다.
            </p>
          </div>
        )}

        {mode === "count" && result && (
          <div style={{ ...card, display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
              <b style={{ fontSize: 16 }}>측정 결과</b>
              <span style={{ fontSize: 14, color: "#475569" }}>반복 <b style={{ color: "#2563eb", fontSize: 20 }}>{reps}</b>회</span>
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
              <p style={{ fontSize: 11, color: "#64748b", marginTop: 8 }}>좌우 차이가 10° 이상이면 주황색으로 표시합니다.</p>
            </div>

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
