import React, { useRef, useState, useEffect, useCallback } from "react";
import { ChevronLeft, RotateCcw, Trash2, Download, Upload, Settings, X, User, Zap, Lock, Dumbbell, Camera, Move, Ruler, Eraser, TrendingUp, Minus, Share2, Grid3X3 } from "lucide-react";

// ── Supabase 카운터 ──────────────────────────────────────────────────────────
const _PA_SB_URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? "";
const _PA_SB_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ?? "";
const _PA_HDR = () => ({ "Content-Type": "application/json", apikey: _PA_SB_KEY, Authorization: `Bearer ${_PA_SB_KEY}` });
function _paTodayKey() { return new Date().toISOString().slice(0, 10).replace(/-/g, ""); }
async function paInc(key: string) {
  if (!_PA_SB_URL || !_PA_SB_KEY) return;
  try {
    await fetch(`${_PA_SB_URL}/rest/v1/rpc/dp_inc_counter`, {
      method: "POST", headers: _PA_HDR(),
      body: JSON.stringify({ p_key: key }),
    });
  } catch { /* ignore */ }
}

// ── 카카오 PKCE ──────────────────────────────────────────────────────────────
function generateCodeVerifier(): string {
  const a = new Uint8Array(32);
  crypto.getRandomValues(a);
  return btoa(String.fromCharCode(...a)).replace(/\+/g,"-").replace(/\//g,"_").replace(/=/g,"");
}
async function generateCodeChallenge(v: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(v));
  return btoa(String.fromCharCode(...new Uint8Array(d))).replace(/\+/g,"-").replace(/\//g,"_").replace(/=/g,"");
}

// ── 사용자 유형 & 한도 ───────────────────────────────────────────────────────
type UserType = "member" | "trainer" | "fitstep";
interface KakaoUser { name: string; thumbnail?: string }
const LIMITS: Record<string, number> = { guest: 2, member: 5, trainer: 10, fitstep: 99999 };
function todayGenKey() { return `pa_gen_${new Date().toISOString().slice(0,10).replace(/-/g,"")}`; }
function getGenCount() { return parseInt(localStorage.getItem(todayGenKey()) || "0"); }
function incGenCount() { const k = todayGenKey(); const n = getGenCount()+1; localStorage.setItem(k,String(n)); return n; }

type ToolType = "hline" | "vline" | "line" | "angle" | "text" | "erase" | "pan" | "mosaic";
type LineStyle = "solid" | "dashed" | "dotted";

interface DrawnItem {
  type: ToolType | "text";
  x1: number; y1: number;
  x2: number; y2: number;
  x3?: number; y3?: number; // 3번째 점 (각도선용)
  color: string; width: number; style: LineStyle;
  label?: string | null; labelX?: number; labelY?: number;
  text?: string; fontSize?: number;
}

function calcAngle3(x1: number, y1: number, x2: number, y2: number, x3: number, y3: number) {
  const v1x = x1 - x2, v1y = y1 - y2;
  const v2x = x3 - x2, v2y = y3 - y2;
  const dot = v1x * v2x + v1y * v2y;
  const mag = Math.hypot(v1x, v1y) * Math.hypot(v2x, v2y);
  if (mag === 0) return 0;
  return Math.acos(Math.max(-1, Math.min(1, dot / mag))) * 180 / Math.PI;
}

const TOOLS: { id: ToolType; icon: React.ReactNode; label: string; key: string }[] = [
  { id: "pan",   icon: <Move size={17}/>,       label: "이동",    key: "m" },
  { id: "hline", icon: <Minus size={17}/>,       label: "수평선",  key: "1" },
  { id: "vline", icon: <span style={{fontWeight:700,fontSize:17,lineHeight:1}}>|</span>, label: "수직선", key: "2" },
  { id: "line",  icon: <TrendingUp size={17}/>,  label: "기울기선", key: "3" },
  { id: "angle", icon: <Ruler size={17}/>,       label: "각도선",  key: "4" },
  { id: "text",  icon: <span style={{fontWeight:700,fontSize:15,lineHeight:1}}>T</span>, label: "텍스트", key: "5" },
  { id: "erase", icon: <Eraser size={17}/>,      label: "지우개",  key: "e" },
  { id: "mosaic", icon: <Grid3X3 size={17}/>,   label: "모자이크", key: "f" },
];

function distToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number) {
  const dx = x2 - x1, dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - x1, py - y1);
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

export default function PostureAnalysis() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── 인증 상태 ──────────────────────────────────────────────────────────────
  const [kakaoUser, setKakaoUser] = useState<KakaoUser | null>(() => {
    try { const s = localStorage.getItem("dp_kakao_user"); return s ? JSON.parse(s) : null; } catch { return null; }
  });
  const [userType, setUserType] = useState<UserType | null>(() => {
    const s = localStorage.getItem("dp_ut");
    if (localStorage.getItem("dp_fitstep") === "1" && localStorage.getItem("dp_kakao_user") && s !== "fitstep") {
      localStorage.setItem("dp_ut", "fitstep"); return "fitstep";
    }
    return s === "member" || s === "trainer" || s === "fitstep" ? s : null;
  });
  const [todayCount, setTodayCount] = useState(getGenCount);
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [showTypeModal, setShowTypeModal] = useState(false);

  // 방문자 카운터 (세션당 1회)
  useEffect(() => {
    if (!sessionStorage.getItem("pa-visited")) {
      sessionStorage.setItem("pa-visited", "1");
      const tdk = _paTodayKey();
      paInc("pa_vc");
      paInc(`pa_vt_${tdk}`);
    }
  }, []);

  // FIT STEP 레퍼럴 감지
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    if (sp.get("ref") === "fitstep" || sp.get("fitstep") === "1") {
      localStorage.setItem("dp_fitstep", "1");
      if (localStorage.getItem("dp_kakao_user") && localStorage.getItem("dp_ut") !== "fitstep") {
        localStorage.setItem("dp_ut", "fitstep"); setUserType("fitstep");
      }
    }
  }, []);

  async function handleKakaoLogin() {
    const appKey = import.meta.env.VITE_KAKAO_APP_KEY as string | undefined;
    if (!appKey) return;
    const verifier = generateCodeVerifier();
    sessionStorage.setItem("kakao_pkce_verifier", verifier);
    sessionStorage.setItem("login_return", "/posture");
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

  function selectUserType(t: UserType) {
    localStorage.setItem("dp_ut", t);
    setUserType(t);
    setShowTypeModal(false);
  }

  // ── 캔버스/도구 상태 ──────────────────────────────────────────────────────
  const [bgImage, setBgImage] = useState<HTMLImageElement | null>(null);
  const [lines, setLines] = useState<DrawnItem[]>([]);
  const [history, setHistory] = useState<DrawnItem[][]>([]);
  const [currentTool, setCurrentTool] = useState<ToolType>("hline");
  const [color, setColor] = useState("#ffff00");
  const [lineWidth, setLineWidth] = useState(2);
  const [lineStyle, setLineStyle] = useState<LineStyle>("solid");
  const [fontSize, setFontSize] = useState(18);
  const [showSettings, setShowSettings] = useState(false);
  const [showTextModal, setShowTextModal] = useState(false);
  const [pendingPos, setPendingPos] = useState<{ x: number; y: number } | null>(null);
  const [textInput, setTextInput] = useState("");
  const [isMobile] = useState(() => window.innerWidth < 768);
  const [urlCopied, setUrlCopied] = useState(false);

  async function handleShareUrl(url: string, title: string) {
    const tdk = _paTodayKey();
    paInc("pa_sc");
    paInc(`pa_st_${tdk}`);
    if (navigator.share) {
      try { await navigator.share({ title, text: title, url }); } catch {}
    } else {
      await navigator.clipboard.writeText(url);
      setUrlCopied(true);
      setTimeout(() => setUrlCopied(false), 2000);
    }
  }

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const panningRef = useRef(false);
  const panStartRef = useRef(0); // screen Y
  const drawingRef = useRef(false);
  const startRef = useRef({ x: 0, y: 0 });
  const movingIdxRef = useRef<number | null>(null);
  const moveLastRef = useRef({ x: 0, y: 0 });
  // 3점 각도: 0=대기, 1=1번점 찍음, 2=2번점 찍음
  const [angleStep, setAngleStep] = useState(0);
  const angleStepRef = useRef(0);
  const anglePtsRef = useRef<{ x: number; y: number }[]>([]);
  const linesRef = useRef<DrawnItem[]>([]);
  const historyRef = useRef<DrawnItem[][]>([]);
  const bgRef = useRef<HTMLImageElement | null>(null);
  const colorRef = useRef(color);
  const widthRef = useRef(lineWidth);
  const styleRef = useRef(lineStyle);
  const fontRef = useRef(fontSize);
  const toolRef = useRef<ToolType>(currentTool);

  // R/L 좌우 표시 — false: 전면(얼굴 보임, R=화면 왼쪽), true: 후면(등 보임, R=화면 오른쪽)
  const [flipRL, setFlipRL] = useState(false);
  const flipRLRef = useRef(false);
  useEffect(() => { flipRLRef.current = flipRL; }, [flipRL]);

  useEffect(() => { linesRef.current = lines; }, [lines]);
  useEffect(() => { historyRef.current = history; }, [history]);
  useEffect(() => { bgRef.current = bgImage; }, [bgImage]);
  useEffect(() => { colorRef.current = color; }, [color]);
  useEffect(() => { widthRef.current = lineWidth; }, [lineWidth]);
  useEffect(() => { styleRef.current = lineStyle; }, [lineStyle]);
  useEffect(() => { fontRef.current = fontSize; }, [fontSize]);
  useEffect(() => { toolRef.current = currentTool; }, [currentTool]);

  const applyLineStyle = useCallback((ctx: CanvasRenderingContext2D, c: string, w: number, s: LineStyle) => {
    ctx.strokeStyle = c;
    ctx.lineWidth = w;
    ctx.setLineDash(s === "dashed" ? [8, 6] : s === "dotted" ? [2, 4] : []);
  }, []);

  const applyMosaicRect = useCallback((ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number) => {
    const x = Math.round(Math.min(x1, x2));
    const y = Math.round(Math.min(y1, y2));
    const w = Math.round(Math.abs(x2 - x1));
    const h = Math.round(Math.abs(y2 - y1));
    if (w < 4 || h < 4) return;
    const block = 16;
    try {
      const id = ctx.getImageData(x, y, w, h);
      const d = id.data;
      for (let by = 0; by < h; by += block) {
        for (let bx = 0; bx < w; bx += block) {
          const cx = Math.min(bx + (block >> 1), w - 1);
          const cy = Math.min(by + (block >> 1), h - 1);
          const i = (cy * w + cx) * 4;
          ctx.fillStyle = `rgb(${d[i]},${d[i+1]},${d[i+2]})`;
          ctx.fillRect(x + bx, y + by, Math.min(block, w - bx), Math.min(block, h - by));
        }
      }
    } catch { /* cross-origin guard */ }
  }, []);

  const render = useCallback((extraPreview?: () => void) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (bgRef.current) ctx.drawImage(bgRef.current, 0, 0, canvas.width, canvas.height);
    // 모자이크를 먼저 적용 (배경 위, 선 아래)
    linesRef.current.forEach(l => {
      if (l.type === "mosaic") applyMosaicRect(ctx, l.x1, l.y1, l.x2, l.y2);
    });
    linesRef.current.forEach(l => {
      if (l.type === "mosaic") return;
      ctx.save();
      if (l.type === "text") {
        ctx.font = `bold ${l.fontSize || 18}px Arial`;
        ctx.fillStyle = l.color;
        ctx.strokeStyle = "rgba(0,0,0,0.6)";
        ctx.lineWidth = 3;
        ctx.setLineDash([]);
        ctx.strokeText(l.text!, l.x1, l.y1);
        ctx.fillText(l.text!, l.x1, l.y1);
      } else if (l.type === "angle" && l.x3 !== undefined) {
        // 3점 각도선: p1→p2(꼭짓점)→p3
        applyLineStyle(ctx, l.color, l.width, l.style);
        ctx.beginPath(); ctx.moveTo(l.x1, l.y1); ctx.lineTo(l.x2, l.y2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(l.x2, l.y2); ctx.lineTo(l.x3!, l.y3!); ctx.stroke();
        // 꼭짓점 점
        ctx.setLineDash([]);
        ctx.fillStyle = l.color;
        ctx.beginPath(); ctx.arc(l.x2, l.y2, l.width + 3, 0, Math.PI * 2); ctx.fill();
        // 각도 표시
        if (l.label) {
          ctx.font = `bold ${fontRef.current}px Arial`;
          ctx.strokeStyle = "rgba(0,0,0,0.8)";
          ctx.lineWidth = 3;
          // 라벨이 화면 밖으로 나가지 않도록 경계 안으로 보정
          const tw = ctx.measureText(l.label).width;
          const fh = fontRef.current;
          const m  = 4;
          const lx = Math.max(m, Math.min(l.labelX!, canvas.width  - tw - m));
          const ly = Math.max(fh + m, Math.min(l.labelY!, canvas.height - m));
          ctx.strokeText(l.label, lx, ly);
          ctx.fillText(l.label, lx, ly);
        }
      } else {
        applyLineStyle(ctx, l.color, l.width, l.style);
        ctx.beginPath(); ctx.moveTo(l.x1, l.y1); ctx.lineTo(l.x2, l.y2); ctx.stroke();
        if (l.label) {
          ctx.setLineDash([]);
          ctx.font = `bold ${fontRef.current}px Arial`;
          ctx.fillStyle = l.color;
          ctx.strokeStyle = "rgba(0,0,0,0.7)";
          ctx.lineWidth = 3;
          ctx.strokeText(l.label, l.labelX!, l.labelY!);
          ctx.fillText(l.label, l.labelX!, l.labelY!);
        }
      }
      ctx.restore();
    });
    if (extraPreview) extraPreview();

    // R / L 코너 마커 (이미지 있을 때만)
    if (bgRef.current) {
      const mSize = Math.max(14, Math.min(28, canvas.width * 0.04));
      const pad   = mSize * 0.6;
      ctx.save();
      ctx.font        = `bold ${mSize}px Arial`;
      ctx.textBaseline = "bottom";
      ctx.lineWidth   = mSize * 0.18;
      ctx.strokeStyle = "rgba(0,0,0,0.7)";
      ctx.fillStyle   = "#ffffff";
      // 전면(얼굴): R=화면 왼쪽 / 후면(등): R=화면 오른쪽
      const leftLabel  = flipRLRef.current ? "L" : "R";
      const rightLabel = flipRLRef.current ? "R" : "L";
      ctx.strokeText(leftLabel, pad, canvas.height - pad);
      ctx.fillText  (leftLabel, pad, canvas.height - pad);
      ctx.strokeText(rightLabel, canvas.width - pad - mSize, canvas.height - pad);
      ctx.fillText  (rightLabel, canvas.width - pad - mSize, canvas.height - pad);
      ctx.restore();
    }
  }, [applyLineStyle, applyMosaicRect]);

  // R/L 전환 시 다시 그리기
  useEffect(() => { render(); }, [flipRL, render]);

  // 각도 도구에서 다른 도구로 전환 시 진행 상태 + 미리보기 초기화
  useEffect(() => {
    if (currentTool !== "angle") {
      anglePtsRef.current = [];
      angleStepRef.current = 0;
      setAngleStep(0);
      render();
    }
  }, [currentTool, render]);

  const getPos = useCallback((e: MouseEvent | TouchEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
  }, []);

  // 기존 선 근처인지 확인 (모바일은 더 넓은 감지 범위)
  const findNearLine = useCallback((x: number, y: number): number | null => {
    const threshold = isMobile ? 28 : 14;
    const items = linesRef.current;
    for (let i = items.length - 1; i >= 0; i--) {
      const l = items[i];
      if (l.type === "text") {
        if (Math.abs(x - l.x1) < 80 && Math.abs(y - l.y1) < 36) return i;
      } else {
        if (distToSegment(x, y, l.x1, l.y1, l.x2, l.y2) <= threshold) return i;
      }
    }
    return null;
  }, [isMobile]);

  const onDown = useCallback((e: MouseEvent | TouchEvent) => {
    if (!bgRef.current) return;

    // 이동(pan) 모드: 선 그리기 없이 스크롤만
    if (toolRef.current === "pan") {
      panningRef.current = true;
      panStartRef.current = "touches" in e ? e.touches[0].clientY : (e as MouseEvent).clientY;
      return;
    }

    const pos = getPos(e);
    startRef.current = pos;

    // 삭제 도구: 탭한 선 즉시 삭제
    if (toolRef.current === "erase") {
      const idx = findNearLine(pos.x, pos.y);
      if (idx !== null) {
        const prev = linesRef.current;
        const next = prev.filter((_, i) => i !== idx);
        historyRef.current = [...historyRef.current, prev];
        setHistory([...historyRef.current]);
        linesRef.current = next;
        setLines(next);
        render();
      }
      return;
    }

    // 텍스트 도구: 탭한 위치에 텍스트 추가
    if (toolRef.current === "text") {
      setPendingPos(pos);
      setTextInput("");
      setShowTextModal(true);
      return;
    }

    // 각도 도구: 3점 탭 방식
    if (toolRef.current === "angle") {
      const step = angleStepRef.current;
      if (step === 0) {
        // 1번째 점
        anglePtsRef.current = [pos];
        angleStepRef.current = 1;
        setAngleStep(1);
      } else if (step === 1) {
        // 2번째 점 (꼭짓점)
        anglePtsRef.current = [...anglePtsRef.current, pos];
        angleStepRef.current = 2;
        setAngleStep(2);
      } else {
        // 3번째 점 → 각도 확정
        const [p1, p2] = anglePtsRef.current;
        const p3 = pos;
        const angle = calcAngle3(p1.x, p1.y, p2.x, p2.y, p3.x, p3.y);
        const item: DrawnItem = {
          type: "angle", x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, x3: p3.x, y3: p3.y,
          color: colorRef.current, width: widthRef.current, style: styleRef.current,
          label: angle.toFixed(1) + "°", labelX: p2.x + 10, labelY: p2.y - 10,
        };
        const next = [...linesRef.current, item];
        historyRef.current = [...historyRef.current, linesRef.current];
        setHistory([...historyRef.current]);
        linesRef.current = next;
        setLines(next);
        anglePtsRef.current = [];
        angleStepRef.current = 0;
        setAngleStep(0);
        render();
      }
      return;
    }

    // 기존 선 근처 → 이동 모드 (모자이크 도구는 항상 새로 그리기)
    const nearIdx = toolRef.current === "mosaic" ? null : findNearLine(pos.x, pos.y);
    if (nearIdx !== null) {
      historyRef.current = [...historyRef.current, linesRef.current];
      setHistory([...historyRef.current]);
      movingIdxRef.current = nearIdx;
      moveLastRef.current = pos;
      return;
    }

    // 빈 공간 → 새 선 그리기 모드
    drawingRef.current = true;
  }, [getPos, findNearLine, render]);

  const onMove = useCallback((e: MouseEvent | TouchEvent) => {
    if (!bgRef.current) return;

    // 이동(pan) 모드: 스크롤 컨테이너를 드래그로 이동
    if (toolRef.current === "pan" && panningRef.current) {
      const screenY = "touches" in e ? e.touches[0].clientY : (e as MouseEvent).clientY;
      const dy = panStartRef.current - screenY;
      panStartRef.current = screenY;
      if (scrollContainerRef.current) scrollContainerRef.current.scrollTop += dy;
      return;
    }

    const pos = getPos(e);

    // 각도 도구 미리보기
    if (toolRef.current === "angle" && angleStepRef.current > 0) {
      const pts = anglePtsRef.current;
      const canvas = canvasRef.current!;
      const ctx = canvas.getContext("2d")!;
      render(() => {
        ctx.save();
        applyLineStyle(ctx, colorRef.current, widthRef.current, styleRef.current);
        // 1번째 점 표시
        ctx.fillStyle = colorRef.current;
        ctx.beginPath(); ctx.arc(pts[0].x, pts[0].y, widthRef.current + 3, 0, Math.PI * 2); ctx.fill();
        if (angleStepRef.current === 1) {
          // p1 → cursor (첫 번째 선 미리보기)
          ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y); ctx.lineTo(pos.x, pos.y); ctx.stroke();
        } else if (angleStepRef.current === 2) {
          // p1 → p2 + p2 → cursor
          ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y); ctx.lineTo(pts[1].x, pts[1].y); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(pts[1].x, pts[1].y); ctx.lineTo(pos.x, pos.y); ctx.stroke();
          ctx.beginPath(); ctx.arc(pts[1].x, pts[1].y, widthRef.current + 3, 0, Math.PI * 2); ctx.fill();
          // 실시간 각도 표시
          const a = calcAngle3(pts[0].x, pts[0].y, pts[1].x, pts[1].y, pos.x, pos.y);
          ctx.setLineDash([]);
          ctx.font = `bold ${fontRef.current}px Arial`;
          ctx.strokeStyle = "rgba(0,0,0,0.8)";
          ctx.lineWidth = 3;
          const aTxt = a.toFixed(1) + "°";
          const tw = ctx.measureText(aTxt).width;
          const fh = fontRef.current, m = 4;
          const lx = Math.max(m, Math.min(pts[1].x + 10, canvas.width  - tw - m));
          const ly = Math.max(fh + m, Math.min(pts[1].y - 10, canvas.height - m));
          ctx.strokeText(aTxt, lx, ly);
          ctx.fillStyle = colorRef.current;
          ctx.fillText(aTxt, lx, ly);
        }
        ctx.restore();
      });
      return;
    }

    // 이동 모드
    if (movingIdxRef.current !== null) {
      const dx = pos.x - moveLastRef.current.x;
      const dy = pos.y - moveLastRef.current.y;
      moveLastRef.current = pos;
      const items = linesRef.current.map((l, i) => {
        if (i !== movingIdxRef.current) return l;
        const n = { ...l };
        if (n.type === "hline") { n.y1 += dy; n.y2 += dy; }
        else if (n.type === "vline") { n.x1 += dx; n.x2 += dx; }
        else {
          n.x1 += dx; n.y1 += dy; n.x2 += dx; n.y2 += dy;
          if (n.x3 !== undefined) { n.x3! += dx; n.y3! += dy; }
          if (n.labelX !== undefined) { n.labelX! += dx; n.labelY! += dy; }
        }
        return n;
      });
      linesRef.current = items;
      setLines(items);
      render();
      return;
    }

    // 그리기 미리보기
    if (!drawingRef.current) return;
    const tool = toolRef.current;
    const { x: sx, y: sy } = startRef.current;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;

    // 모자이크 드래그 미리보기
    if (tool === "mosaic") {
      render(() => {
        applyMosaicRect(ctx, sx, sy, pos.x, pos.y);
        ctx.save();
        ctx.strokeStyle = "rgba(255,255,255,0.85)";
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        const rx = Math.min(sx, pos.x), ry = Math.min(sy, pos.y);
        ctx.strokeRect(rx, ry, Math.abs(pos.x - sx), Math.abs(pos.y - sy));
        ctx.restore();
      });
      return;
    }

    render(() => {
      ctx.save();
      applyLineStyle(ctx, colorRef.current, widthRef.current, styleRef.current);
      ctx.beginPath();
      if (tool === "hline") { ctx.moveTo(0, sy); ctx.lineTo(canvas.width, sy); }
      else if (tool === "vline") { ctx.moveTo(sx, 0); ctx.lineTo(sx, canvas.height); }
      else {
        ctx.moveTo(sx, sy); ctx.lineTo(pos.x, pos.y); ctx.stroke();
        // 기울기선 실시간 각도 미리보기
        if (toolRef.current === "line") {
          const dx = Math.abs(pos.x - sx);
          const dy = Math.abs(pos.y - sy);
          const angleDeg = Math.atan2(dy, dx) * 180 / Math.PI;
          const leftY  = sx < pos.x ? sy : pos.y;
          const rightY = sx < pos.x ? pos.y : sy;
          const side = leftY > rightY ? "오른쪽↓" : leftY < rightY ? "왼쪽↓" : "수평";
          const txt = angleDeg < 1 ? "수평" : `${side}  △${angleDeg.toFixed(1)}°`;
          ctx.setLineDash([]);
          ctx.font = `bold ${fontRef.current}px Arial`;
          ctx.fillStyle = colorRef.current;
          ctx.strokeStyle = "rgba(0,0,0,0.8)";
          ctx.lineWidth = 3;
          const lx = (sx + pos.x) / 2, ly = Math.min(sy, pos.y) - 10;
          ctx.strokeText(txt, lx, ly);
          ctx.fillText(txt, lx, ly);
        }
      }
      ctx.restore();
    });
  }, [getPos, render, applyLineStyle, applyMosaicRect]);

  const onUp = useCallback((e: MouseEvent | TouchEvent) => {
    // pan 모드 종료
    if (panningRef.current) { panningRef.current = false; return; }
    // 선 이동 모드 종료
    if (movingIdxRef.current !== null) {
      movingIdxRef.current = null;
      return;
    }

    if (!drawingRef.current) return;
    drawingRef.current = false;

    let pos: { x: number; y: number };
    if ("changedTouches" in e && e.changedTouches.length > 0) {
      const canvas = canvasRef.current!;
      const rect = canvas.getBoundingClientRect();
      const t = e.changedTouches[0];
      pos = { x: (t.clientX - rect.left) * (canvas.width / rect.width), y: (t.clientY - rect.top) * (canvas.height / rect.height) };
    } else {
      pos = getPos(e);
    }

    const { x: sx, y: sy } = startRef.current;
    const canvas = canvasRef.current!;
    const tool = toolRef.current;
    const minDist = tool === "mosaic" ? 4 : 4;
    if (Math.abs(pos.x - sx) < minDist && Math.abs(pos.y - sy) < minDist) return;

    let item: DrawnItem = {
      type: tool, x1: sx, y1: sy, x2: pos.x, y2: pos.y,
      color: colorRef.current, width: widthRef.current, style: styleRef.current,
    };
    if (tool === "hline") { item.x1 = 0; item.x2 = canvas.width; item.y1 = sy; item.y2 = sy; }
    if (tool === "vline") { item.x1 = sx; item.x2 = sx; item.y1 = 0; item.y2 = canvas.height; }
    if (tool === "line") {
      // x 기준 왼쪽/오른쪽 판별 (y가 작을수록 위쪽)
      const dx2 = Math.abs(pos.x - sx);
      const dy2 = Math.abs(pos.y - sy);
      const angleDeg2 = Math.atan2(dy2, dx2) * 180 / Math.PI;
      const leftY  = sx < pos.x ? sy : pos.y;
      const rightY = sx < pos.x ? pos.y : sy;
      const side = leftY > rightY ? "오른쪽↓" : leftY < rightY ? "왼쪽↓" : "수평";
      item.label  = angleDeg2 < 1 ? "수평" : `${side}  △${angleDeg2.toFixed(1)}°`;
      item.labelX = (sx + pos.x) / 2;
      item.labelY = Math.min(sy, pos.y) - 10;
    }
    const next = [...linesRef.current, item];
    historyRef.current = [...historyRef.current, linesRef.current];
    setHistory([...historyRef.current]);
    linesRef.current = next;
    setLines(next);
    render();
  }, [getPos, render]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const opts = { passive: false } as AddEventListenerOptions;
    const md = (e: MouseEvent) => onDown(e);
    const mm = (e: MouseEvent) => onMove(e);
    const mu = (e: MouseEvent) => onUp(e);
    const ts = (e: TouchEvent) => { e.preventDefault(); onDown(e); };
    const tm = (e: TouchEvent) => { e.preventDefault(); onMove(e); };
    const te = (e: TouchEvent) => { e.preventDefault(); onUp(e); };
    canvas.addEventListener("mousedown", md);
    canvas.addEventListener("mousemove", mm);
    canvas.addEventListener("mouseup", mu);
    canvas.addEventListener("touchstart", ts, opts);
    canvas.addEventListener("touchmove", tm, opts);
    canvas.addEventListener("touchend", te, opts);
    return () => {
      canvas.removeEventListener("mousedown", md);
      canvas.removeEventListener("mousemove", mm);
      canvas.removeEventListener("mouseup", mu);
      canvas.removeEventListener("touchstart", ts);
      canvas.removeEventListener("touchmove", tm);
      canvas.removeEventListener("touchend", te);
    };
  }, [onDown, onMove, onUp]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === "INPUT") return;
      if ((e.ctrlKey || e.metaKey) && e.key === "z") { handleUndo(); return; }
      const found = TOOLS.find(t => t.key === e.key);
      if (found) setCurrentTool(found.id);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function loadImageFile(file: File) {
    const effectiveType = kakaoUser ? (userType ?? "member") : "guest";
    const limit = LIMITS[effectiveType] ?? 2;
    if (todayCount >= limit) { setShowLimitModal(true); return; }
    incGenCount();
    setTodayCount(c => c + 1);
    const reader = new FileReader();
    reader.onload = ev => {
      const img = new Image();
      img.onload = () => {
        const canvas = canvasRef.current!;
        const maxW = Math.min(img.width, window.innerWidth - (isMobile ? 0 : 40));
        const scale = maxW / img.width;
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        linesRef.current = []; historyRef.current = [];
        setLines([]); setHistory([]);
        bgRef.current = img; setBgImage(img);
        const ctx = canvas.getContext("2d")!;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      };
      img.src = ev.target!.result as string;
    };
    reader.readAsDataURL(file);
  }

  function handleUndo() {
    const hist = historyRef.current;
    if (!hist.length) return;
    const prev = hist[hist.length - 1];
    const newHist = hist.slice(0, -1);
    historyRef.current = newHist; linesRef.current = prev;
    setHistory(newHist); setLines(prev); render();
  }

  function handleClearAll() {
    if (!window.confirm("모든 선을 삭제하시겠습니까?")) return;
    historyRef.current = [...historyRef.current, linesRef.current];
    setHistory([...historyRef.current]);
    linesRef.current = []; setLines([]); render();
  }

  function handleSave() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = "posture-analysis.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

  function confirmText() {
    const text = textInput.trim();
    setShowTextModal(false);
    if (!text || !pendingPos) return;
    const item: DrawnItem = {
      type: "text", x1: pendingPos.x, y1: pendingPos.y,
      x2: pendingPos.x, y2: pendingPos.y,
      color: colorRef.current, width: 1, style: "solid",
      text, fontSize: fontRef.current,
    };
    const next = [...linesRef.current, item];
    historyRef.current = [...historyRef.current, linesRef.current];
    setHistory([...historyRef.current]);
    linesRef.current = next; setLines(next); render();
    setPendingPos(null);
  }

  /* ── MOBILE LAYOUT ── */
  if (isMobile) {
    const effectiveType = kakaoUser ? (userType ?? "member") : "guest";
    const limit = LIMITS[effectiveType] ?? 2;
    return (
      <div style={{ height: "100dvh", background: "#f8fafc", color: "#eee", display: "flex", flexDirection: "column", fontFamily: "'Noto Sans KR', sans-serif", overflow: "hidden" }}>

        {/* ── 랜딩 페이지 (사진 없을 때) ── */}
        {!bgImage && (
          <div style={{ flex: 1, overflow: "auto" }}>
            {/* 헤더 */}
            <div style={{ padding: "16px 16px 12px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 46, height: 46, background: "#1e3a5f", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Dumbbell size={24} color="#93c5fd"/></div>
                <div>
                  <p style={{ color: "#2563eb", fontSize: 10, fontWeight: 800, margin: "0 0 2px", letterSpacing: "0.12em" }}>FIT STEP</p>
                  <h1 style={{ color: "#0f172a", fontSize: 16, fontWeight: 700, margin: 0 }}>체형 분석 라인 드로잉</h1>
                </div>
              </div>
              {kakaoUser ? (
                <button onClick={handleKakaoLogout}
                  style={{ display:"flex", alignItems:"center", gap:5, background:"#dbeafe", border:"none", borderRadius:10, padding:"7px 10px", color:"#34d399", fontSize:12, cursor:"pointer", flexShrink:0 }}>
                  {kakaoUser.thumbnail ? <img src={kakaoUser.thumbnail} alt="" style={{width:18,height:18,borderRadius:"50%",objectFit:"cover"}} /> : <User size={14}/>}
                  <span style={{maxWidth:60,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{kakaoUser.name}</span>
                  {userType==="fitstep" && <Zap size={11} color="#fbbf24"/>}
                </button>
              ) : (
                <button onClick={handleKakaoLogin}
                  style={{ display:"flex", alignItems:"center", gap:5, background:"#FEE500", border:"none", borderRadius:10, padding:"9px 14px", color:"#000", fontSize:13, fontWeight:700, cursor:"pointer", flexShrink:0 }}>
                  <User size={14}/> 로그인
                </button>
              )}
            </div>

            {/* 사용량 */}
            <div style={{ padding: "0 16px 14px" }}>
              <div style={{ background: "#ffffff", borderRadius: 12, padding: "12px 16px", display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <span style={{ color: "#475569", fontSize: 11 }}>오늘 사용</span>
                  <span style={{ color: "#0f172a", fontWeight: 700, fontSize: 20, margin: "0 4px 0 8px" }}>{todayCount}</span>
                </div>
                <div style={{ width: 1, height: 28, background: "#f1f5f9" }} />
                <div style={{ flex: 1, textAlign: "right" }}>
                  <span style={{ color: "#475569", fontSize: 11 }}>한도</span>
                  <span style={{ color: limit >= 99999 ? "#f59e0b" : "#34d399", fontWeight: 700, fontSize: 20, margin: "0 0 0 8px" }}>
                    {limit >= 99999 ? "∞" : limit}
                  </span>
                  <span style={{ color: "#475569", fontSize: 11 }}>회/일</span>
                </div>
              </div>
            </div>

            {/* FIT STEP 배너 */}
            <div style={{ margin: "0 16px 16px", background: "#fff", borderRadius: 16, padding: "16px 16px 14px", boxShadow: "0 4px 20px rgba(0,0,0,0.2)" }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 14 }}>
                <div style={{ width: 44, height: 44, background: "#d1fae5", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Zap size={22} color="#059669" />
                </div>
                <div>
                  <p style={{ color: "#2563eb", fontWeight: 700, fontSize: 12, margin: "0 0 3px", letterSpacing: "0.05em" }}>FIT STEP</p>
                  <p style={{ color: "#111827", fontWeight: 700, fontSize: 15, margin: "0 0 4px", wordBreak: "keep-all" as const, lineHeight: 1.4 }}>
                    체형 분석 무제한. 회원관리까지 하나로.
                  </p>
                  <p style={{ color: "#475569", fontSize: 12, margin: 0 }}>운동전문가를 위한 올인원 성장 플랫폼</p>
                </div>
              </div>
              <a href="https://fitstep.co.kr/?ref=posture" target="_blank" rel="noreferrer"
                style={{ display: "block", background: "#2563eb", color: "#fff", textDecoration: "none", borderRadius: 10, padding: "13px 0", textAlign: "center", fontWeight: 700, fontSize: 15 }}>
                무료로 시작하기 →
              </a>
            </div>

            {/* 공유 버튼 */}
            <div style={{ padding: "0 16px 16px" }}>
              <button
                onClick={() => handleShareUrl(window.location.origin + "/posture", "FIT STEP 체형 분석 라인 드로잉")}
                style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", background: urlCopied ? "#eff6ff" : "#f8fafc", border: `1px solid ${urlCopied ? "#2563eb" : "#e2e8f0"}`, borderRadius: 12, padding: "14px 0", color: urlCopied ? "#2563eb" : "#64748b", fontSize: 14, fontWeight: 600, cursor: "pointer", transition: "all 0.2s" }}>
                <Share2 size={16} />
                {urlCopied ? "링크 복사됨!" : "FIT STEP 체형 분석 드로잉 공유하기"}
              </button>
            </div>

            {/* 사진 업로드 */}
            <div style={{ padding: "0 16px 40px" }}>
              <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) loadImageFile(f); }} />
              <div onClick={() => fileInputRef.current?.click()}
                style={{ border: "2px dashed #1e3a5f", borderRadius: 16, padding: "40px 20px", display: "flex", flexDirection: "column", alignItems: "center", gap: 10, cursor: "pointer" }}>
                <Camera size={52} color="#cbd5e1"/>
                <p style={{ color: "#475569", fontSize: 16, fontWeight: 600, margin: 0 }}>사진을 탭하여 업로드</p>
                <p style={{ color: "#475569", fontSize: 12, margin: 0 }}>카메라 촬영 또는 갤러리에서 선택</p>
              </div>
            </div>
          </div>
        )}

        {/* ── 드로잉 모드 (사진 로드 후) ── */}
        {bgImage && (
          <>
            {/* 상단 바 */}
            <div style={{ background: "#16213e", borderBottom: "1px solid #0f3460", padding: "8px 10px", display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
              <button onClick={() => { linesRef.current=[]; historyRef.current=[]; setLines([]); setHistory([]); bgRef.current=null; setBgImage(null); }}
                style={{ display:"flex", alignItems:"center", gap:4, background:"#0f3460", border:"none", borderRadius:6, padding:"6px 8px", color:"#aaa", fontSize:11, cursor:"pointer" }}>
                <ChevronLeft size={14}/>새 사진
              </button>
              <div style={{ display:"flex", alignItems:"center", gap:6, flex:1, minWidth:0, overflow:"hidden" }}>
                <Dumbbell size={15} color="#93c5fd" style={{ flexShrink:0 }}/>
                <div style={{ minWidth:0 }}>
                  <p style={{ color: "#93c5fd", fontSize: 9, fontWeight: 800, margin: 0, letterSpacing: "0.12em", lineHeight: 1 }}>FIT STEP</p>
                  <span style={{ color: "#ffffff", fontWeight: 700, fontSize: 12, lineHeight: 1, whiteSpace: "nowrap" }}>체형 분석 드로잉</span>
                </div>
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) loadImageFile(f); }} />
              <IconBtn icon={<RotateCcw size={15} />} label="되돌리기" onClick={handleUndo} disabled={history.length === 0} />
              <IconBtn icon={<Download size={15} />} label="저장" onClick={handleSave} />
              <IconBtn icon={<Settings size={15} />} label="설정" onClick={() => setShowSettings(v => !v)} active={showSettings} />
            </div>

            {/* 설정 패널 */}
            {showSettings && (
              <div style={{ background: "#16213e", borderBottom: "1px solid #0f3460", padding: "10px 14px", display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", flexShrink: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 12, color: "#aaa" }}>색상</span>
                  <input type="color" value={color} onChange={e => setColor(e.target.value)} style={{ width: 36, height: 32, border: "1px solid #0f3460", borderRadius: 6, cursor: "pointer", background: "none" }} />
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 140 }}>
                  <span style={{ fontSize: 12, color: "#aaa" }}>굵기 {lineWidth}</span>
                  <input type="range" min={1} max={12} value={lineWidth} onChange={e => setLineWidth(Number(e.target.value))} style={{ flex: 1, accentColor: "#e94560" }} />
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 12, color: "#aaa" }}>스타일</span>
                  <select value={lineStyle} onChange={e => setLineStyle(e.target.value as LineStyle)}
                    style={{ padding: "5px 8px", background: "#0f3460", border: "1px solid #555", color: "#eee", borderRadius: 6, fontSize: 13 }}>
                    <option value="solid">실선</option><option value="dashed">점선</option><option value="dotted">점점선</option>
                  </select>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 12, color: "#aaa" }}>글자크기</span>
                  <input type="number" min={10} max={80} value={fontSize} onChange={e => setFontSize(Number(e.target.value))} style={{ width: 56, padding: "5px 6px", background: "#0f3460", border: "1px solid #555", color: "#eee", borderRadius: 6, fontSize: 13 }} />
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 12, color: "#aaa" }}>좌우(R/L)</span>
                  <button onClick={() => { const nv = !flipRL; flipRLRef.current = nv; setFlipRL(nv); render(); }}
                    style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", background: "#0f3460", border: "1px solid #1d4ed8", color: "#eee", borderRadius: 6, cursor: "pointer", fontSize: 13, fontWeight: 700 }}>
                    <span style={{ letterSpacing: "0.05em" }}>{flipRL ? "L ◀▶ R" : "R ◀▶ L"}</span>
                    <span style={{ fontSize: 11, color: "#93c5fd" }}>{flipRL ? "후면(등)" : "전면(얼굴)"}</span>
                  </button>
                </div>
                <button onClick={handleClearAll} disabled={lines.length === 0}
                  style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", background: lines.length ? "#fef2f2" : "#f8fafc", border: "1px solid #991b1b", color: lines.length ? "#dc2626" : "#94a3b8", borderRadius: 6, cursor: lines.length ? "pointer" : "not-allowed", fontSize: 13 }}>
                  <Trash2 size={13} />전체 초기화
                </button>
              </div>
            )}
          </>
        )}

        {/* 캔버스 영역 (항상 렌더링, 랜딩에서는 숨김) */}
        <div ref={scrollContainerRef} style={{ flex: bgImage ? 1 : 0, overflow: bgImage ? "auto" : "hidden", display: "flex", flexDirection: "column", alignItems: "center", WebkitOverflowScrolling: "touch" } as React.CSSProperties}>
          <canvas ref={canvasRef} style={{ display: bgImage ? "block" : "none", width: "100%", touchAction: "none", cursor: currentTool === "pan" ? "grab" : "crosshair" }} />
        </div>

        {/* 각도 진행 힌트 + 하단 툴바 (드로잉 모드만) */}
        {bgImage && (
          <>
            {currentTool === "angle" && angleStep > 0 && (
              <div style={{ background: "#0f3460", borderTop: "1px solid #1e40af", padding: "6px 16px", textAlign: "center", fontSize: 12, color: "#93c5fd", flexShrink: 0 }}>
                {angleStep === 1 ? "● 1번 점 완료 → 꼭짓점을 탭하세요" : "● 꼭짓점 완료 → 3번째 점을 탭하세요"}
              </div>
            )}
            <div style={{ background: "#16213e", borderTop: "1px solid #0f3460", padding: "8px 4px", display: "flex", justifyContent: "space-around", flexShrink: 0 }}>
              {TOOLS.map(t => (
                <button key={t.id} onClick={() => setCurrentTool(t.id)}
                  style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, padding: "7px 8px", background: currentTool === t.id ? "#e94560" : "#0f3460", border: "none", borderRadius: 10, cursor: "pointer", color: "#eee", minWidth: 40, transition: "all 0.15s" }}>
                  {t.icon}
                  <span style={{ fontSize: 9 }}>{t.label}</span>
                </button>
              ))}
            </div>
          </>
        )}

        {/* 한도 초과 모달 */}
        {showLimitModal && (
          <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.75)", display:"flex", alignItems:"flex-end", justifyContent:"center", zIndex:400 }}>
            <div style={{ background:"#ffffff", border:"2px solid #e94560", borderRadius:"16px 16px 0 0", padding:"24px 20px 36px", width:"100%" }}>
              <div style={{ textAlign:"center", marginBottom:16 }}>
                <Lock size={40} color="#64748b" style={{marginBottom:8}}/>
                <h3 style={{ color:"#f1f5f9", fontSize:17, fontWeight:700, margin:0 }}>오늘 사용 한도 초과</h3>
                <p style={{ color:"#64748b", fontSize:13, margin:"8px 0 0" }}>
                  {kakaoUser ? `오늘 ${LIMITS[userType ?? "member"]}회 모두 사용했습니다.` : "비로그인 시 하루 2회까지 사용 가능합니다."}
                </p>
              </div>
              <div style={{ background:"#f8fafc", borderRadius:10, padding:14, marginBottom:16 }}>
                {[{icon:<Lock size={14}/>,label:"비로그인",count:"2회/일",color:"#6b7280"},{icon:<User size={14}/>,label:"로그인 회원",count:"5회/일",color:"#34d399"},{icon:<Dumbbell size={14}/>,label:"운동전문가",count:"10회/일",color:"#60a5fa"},{icon:<Zap size={14}/>,label:"FIT STEP",count:"무제한",color:"#f59e0b"}].map(t=>(
                  <div key={t.label} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"6px 0",borderBottom:"1px solid #1e293b"}}>
                    <div style={{display:"flex",alignItems:"center",gap:6,color:"#94a3b8",fontSize:12}}>{t.icon}{t.label}</div>
                    <span style={{color:t.color,fontSize:12,fontWeight:700}}>{t.count}</span>
                  </div>
                ))}
              </div>
              <div style={{ display:"flex", gap:10 }}>
                <button onClick={() => setShowLimitModal(false)}
                  style={{ flex:1, padding:"12px", background:"#f1f5f9", border:"none", color:"#94a3b8", borderRadius:8, cursor:"pointer", fontSize:14 }}>닫기</button>
                {!kakaoUser && (
                  <button onClick={handleKakaoLogin}
                    style={{ flex:2, padding:"12px", background:"#f59e0b", border:"none", color:"#000", borderRadius:8, cursor:"pointer", fontSize:14, fontWeight:700 }}>카카오 로그인</button>
                )}
                <a href="https://fitstep.co.kr/" target="_blank" rel="noreferrer"
                  style={{ flex:2, padding:"12px", background:"#2563eb", border:"none", color:"#fff", borderRadius:8, cursor:"pointer", fontSize:14, fontWeight:700, textDecoration:"none", textAlign:"center" }}>
                  FIT STEP 무제한
                </a>
              </div>
            </div>
          </div>
        )}

        {/* 유형 선택 모달 (첫 로그인) */}
        {showTypeModal && (
          <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.75)", display:"flex", alignItems:"flex-end", justifyContent:"center", zIndex:400 }}>
            <div style={{ background:"#ffffff", border:"2px solid #334155", borderRadius:"16px 16px 0 0", padding:"24px 20px 36px", width:"100%" }}>
              <h3 style={{ color:"#f1f5f9", fontSize:16, fontWeight:700, margin:"0 0 16px" }}>회원 유형 선택</h3>
              {([["member","일반 회원","5회/일","#34d399"],["trainer","운동전문가","10회/일","#60a5fa"]] as const).map(([t,l,c,col])=>(
                <button key={t} onClick={() => selectUserType(t)}
                  style={{ display:"flex", justifyContent:"space-between", alignItems:"center", width:"100%", background:"#f8fafc", border:"1px solid #334155", borderRadius:10, padding:"14px 16px", color:"#f1f5f9", fontSize:14, cursor:"pointer", marginBottom:10 }}>
                  <span>{l}</span><span style={{color:col,fontWeight:700}}>{c}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Text modal */}
        {showTextModal && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 300 }}>
            <div style={{ background: "#16213e", border: "2px solid #e94560", borderRadius: "16px 16px 0 0", padding: "20px 20px 32px", width: "100%" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <h3 style={{ color: "#e94560", fontSize: 16, margin: 0 }}>텍스트 입력</h3>
                <button onClick={() => { setShowTextModal(false); setPendingPos(null); }} style={{ background: "none", border: "none", color: "#aaa", cursor: "pointer" }}>
                  <X size={20} />
                </button>
              </div>
              <input autoFocus type="text" value={textInput}
                onChange={e => setTextInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") confirmText(); }}
                placeholder="예: 6° / 10mm"
                style={{ width: "100%", padding: "12px", background: "#0f3460", border: "1px solid #555", color: "#eee", borderRadius: 8, fontSize: 16, marginBottom: 14, boxSizing: "border-box" }} />
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => { setShowTextModal(false); setPendingPos(null); }}
                  style={{ flex: 1, padding: "12px", background: "#0f3460", border: "1px solid #555", color: "#aaa", borderRadius: 8, cursor: "pointer", fontSize: 15 }}>취소</button>
                <button onClick={confirmText}
                  style={{ flex: 2, padding: "12px", background: "#e94560", border: "none", color: "#fff", borderRadius: 8, cursor: "pointer", fontSize: 15, fontWeight: 700 }}>확인</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  /* ── DESKTOP LAYOUT ── */
  return (
    <div style={{ minHeight: "100vh", background: "#1a1a2e", color: "#eee", fontFamily: "'Noto Sans KR', 'Segoe UI', sans-serif", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{ background: "#16213e", borderBottom: "2px solid #0f3460", padding: "10px 16px", display: "flex", alignItems: "center", gap: 12 }}>
        <a href="/" style={{ display: "flex", alignItems: "center", gap: 6, color: "#aaa", textDecoration: "none", fontSize: 13, background: "#0f3460", borderRadius: 6, padding: "5px 10px" }}>
          <ChevronLeft size={14} /> 식단 플래너
        </a>
        <div>
          <p style={{ color: "#2563eb", fontSize: 10, fontWeight: 800, margin: 0, letterSpacing: "0.12em" }}>FIT STEP</p>
          <span style={{ color: "#0f172a", fontWeight: 700, fontSize: 14 }}>체형 분석 라인 드로잉</span>
        </div>
        <span style={{ background: "#0f3460", color: "#60a5fa", fontSize: 10, padding: "2px 8px", borderRadius: 20, fontWeight: 700 }}>BETA</span>
        <span style={{ flex: 1 }} />
        {/* 사용 횟수 */}
        <span style={{ color: "#475569", fontSize: 12 }}>
          오늘 {todayCount} / {LIMITS[kakaoUser ? (userType ?? "member") : "guest"]}회
        </span>
        {kakaoUser ? (
          <div style={{ display:"flex", alignItems:"center", gap:6, background:"#dbeafe", borderRadius:8, padding:"5px 10px" }}>
            {kakaoUser.thumbnail ? <img src={kakaoUser.thumbnail} alt="" style={{width:18,height:18,borderRadius:"50%",objectFit:"cover"}} /> : <User size={14} color="#34d399"/>}
            <span style={{ color:"#34d399", fontSize:12 }}>{kakaoUser.name}</span>
            {userType === "fitstep" && <Zap size={11} color="#fbbf24"/>}
            <button onClick={handleKakaoLogout}
              style={{ background:"none", border:"none", color:"#64748b", fontSize:11, cursor:"pointer", padding:0 }}>로그아웃</button>
          </div>
        ) : (
          <button onClick={handleKakaoLogin}
            style={{ display:"flex", alignItems:"center", gap:5, background:"#f59e0b", border:"none", borderRadius:8, padding:"6px 12px", color:"#000", fontSize:12, fontWeight:700, cursor:"pointer" }}>
            <User size={13}/>카카오 로그인
          </button>
        )}
      </div>

      {/* 한도 초과 모달 (데스크톱) */}
      {showLimitModal && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.7)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:400 }}>
          <div style={{ background:"#ffffff", border:"2px solid #e94560", borderRadius:16, padding:32, width:360 }}>
            <div style={{ textAlign:"center", marginBottom:20 }}>
              <Lock size={40} color="#64748b" style={{marginBottom:8}}/>
              <h3 style={{ color:"#f1f5f9", fontSize:17, fontWeight:700, margin:"8px 0 0" }}>오늘 사용 한도 초과</h3>
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:20 }}>
              {[{l:"비로그인",c:"2회/일",col:"#6b7280"},{l:"로그인 회원",c:"5회/일",col:"#34d399"},{l:"운동전문가",c:"10회/일",col:"#60a5fa"},{l:"FIT STEP",c:"무제한",col:"#f59e0b"}].map(t=>(
                <div key={t.l} style={{display:"flex",justifyContent:"space-between",color:"#94a3b8",fontSize:13}}>
                  <span>{t.l}</span><span style={{color:t.col,fontWeight:700}}>{t.c}</span>
                </div>
              ))}
            </div>
            <div style={{ display:"flex", gap:8 }}>
              <button onClick={() => setShowLimitModal(false)} style={{ flex:1, padding:"10px", background:"#f1f5f9", border:"none", color:"#94a3b8", borderRadius:8, cursor:"pointer" }}>닫기</button>
              {!kakaoUser && <button onClick={handleKakaoLogin} style={{ flex:2, padding:"10px", background:"#f59e0b", border:"none", color:"#000", borderRadius:8, cursor:"pointer", fontWeight:700 }}>카카오 로그인</button>}
              <a href="https://fitstep.co.kr/" target="_blank" rel="noreferrer" style={{ flex:2, padding:"10px", background:"#2563eb", color:"#fff", borderRadius:8, textDecoration:"none", textAlign:"center", fontWeight:700, fontSize:13, display:"flex", alignItems:"center", justifyContent:"center", gap:5 }}><Zap size={13}/> FIT STEP</a>
            </div>
          </div>
        </div>
      )}
      {showTypeModal && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.7)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:400 }}>
          <div style={{ background:"#ffffff", border:"2px solid #334155", borderRadius:16, padding:32, width:320 }}>
            <h3 style={{ color:"#f1f5f9", fontSize:16, fontWeight:700, margin:"0 0 20px" }}>회원 유형 선택</h3>
            {([["member","일반 회원","5회/일","#34d399"],["trainer","운동전문가","10회/일","#60a5fa"]] as const).map(([t,l,c,col])=>(
              <button key={t} onClick={() => selectUserType(t)}
                style={{ display:"flex", justifyContent:"space-between", width:"100%", background:"#f8fafc", border:"1px solid #334155", borderRadius:10, padding:"14px 16px", color:"#f1f5f9", fontSize:14, cursor:"pointer", marginBottom:10 }}>
                <span>{l}</span><span style={{color:col,fontWeight:700}}>{c}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", padding: "10px 16px", background: "#16213e", borderBottom: "1px solid #0f3460", position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ display: "flex", gap: 4, paddingRight: 10, marginRight: 2, borderRight: "1px solid #0f3460" }}>
          <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) loadImageFile(f); }} />
          <DeskBtn icon={<Upload size={13} />} label="사진 열기" onClick={() => fileInputRef.current?.click()} />
          <DeskBtn icon={<Download size={13} />} label="저장" onClick={handleSave} disabled={!bgImage} />
          <DeskBtn icon={<RotateCcw size={13} />} label="되돌리기" onClick={handleUndo} disabled={history.length === 0} />
          <DeskBtn icon={<Trash2 size={13} />} label="전체 초기화" onClick={handleClearAll} disabled={lines.length === 0} />
        </div>
        <div style={{ display: "flex", gap: 4, paddingRight: 10, marginRight: 2, borderRight: "1px solid #0f3460" }}>
          {TOOLS.map(t => (
            <button key={t.id} onClick={() => setCurrentTool(t.id)}
              style={{ padding: "5px 10px", border: "1px solid #0f3460", background: currentTool === t.id ? "#e94560" : "#0f3460", color: "#eee", borderRadius: 6, cursor: "pointer", fontSize: 12 }}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", paddingRight: 10, marginRight: 2, borderRight: "1px solid #0f3460" }}>
          <label style={{ fontSize: 12, color: "#aaa" }}>색상</label>
          <input type="color" value={color} onChange={e => setColor(e.target.value)} style={{ width: 32, height: 28, border: "1px solid #0f3460", borderRadius: 4, cursor: "pointer", background: "none" }} />
          <label style={{ fontSize: 12, color: "#aaa" }}>굵기</label>
          <input type="range" min={1} max={10} value={lineWidth} onChange={e => setLineWidth(Number(e.target.value))} style={{ width: 70 }} />
          <span style={{ fontSize: 12, color: "#eee", minWidth: 12 }}>{lineWidth}</span>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <label style={{ fontSize: 12, color: "#aaa" }}>스타일</label>
          <select value={lineStyle} onChange={e => setLineStyle(e.target.value as LineStyle)}
            style={{ padding: "4px 6px", background: "#0f3460", border: "1px solid #555", color: "#eee", borderRadius: 4, fontSize: 12 }}>
            <option value="solid">실선</option>
            <option value="dashed">점선</option>
            <option value="dotted">점점선</option>
          </select>
          <label style={{ fontSize: 12, color: "#aaa" }}>글자크기</label>
          <input type="number" min={8} max={72} value={fontSize} onChange={e => setFontSize(Number(e.target.value))}
            style={{ width: 50, padding: "4px 6px", background: "#0f3460", border: "1px solid #555", color: "#eee", borderRadius: 4, fontSize: 12 }} />
        </div>
      </div>

      {/* Canvas area */}
      <div ref={scrollContainerRef} style={{ flex: 1, display: "flex", justifyContent: "center", alignItems: "flex-start", padding: 20, overflow: "auto" }}
        onDragOver={e => e.preventDefault()}
        onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f?.type.startsWith("image/")) loadImageFile(f); }}>
        <div style={{ position: "relative", display: "inline-block", cursor: bgImage ? "crosshair" : "default" }}>
          {!bgImage && (
            <div onClick={() => fileInputRef.current?.click()}
              style={{ width: 500, height: 500, border: "3px dashed #0f3460", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, color: "#aaa", borderRadius: 12, cursor: "pointer" }}>
              <Upload size={64} color="#cbd5e1" />
              <p style={{ fontSize: 18 }}>사진을 클릭하거나 드래그해서 업로드</p>
              <small style={{ fontSize: 13, color: "#666" }}>JPG · PNG · WEBP 지원</small>
            </div>
          )}
          <canvas ref={canvasRef} style={{ display: bgImage ? "block" : "none", boxShadow: "0 4px 30px rgba(0,0,0,0.5)", maxWidth: "100%" }} />
        </div>
      </div>

      {/* Info bar */}
      <div style={{ position: "fixed", bottom: 10, left: "50%", transform: "translateX(-50%)", background: "rgba(0,0,0,0.75)", padding: "6px 18px", borderRadius: 20, fontSize: 12, color: "#aaa", pointerEvents: "none" }}>
        {currentTool === "angle" && angleStep === 1 && "꼭짓점(중간점)을 클릭하세요"}
        {currentTool === "angle" && angleStep === 2 && "3번째 점을 클릭하세요"}
        {(currentTool !== "angle" || angleStep === 0) && `현재 도구: ${TOOLS.find(t => t.id === currentTool)?.label}`}
      </div>

      {/* Text modal */}
      {showTextModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200 }}>
          <div style={{ background: "#16213e", border: "2px solid #e94560", borderRadius: 12, padding: 24, minWidth: 300 }}>
            <h3 style={{ color: "#e94560", marginBottom: 12, fontSize: 16 }}>텍스트 입력</h3>
            <input autoFocus type="text" value={textInput}
              onChange={e => setTextInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") confirmText(); if (e.key === "Escape") { setShowTextModal(false); setPendingPos(null); } }}
              placeholder="예: 6° / 10mm"
              style={{ width: "100%", padding: "8px", background: "#0f3460", border: "1px solid #555", color: "#eee", borderRadius: 6, fontSize: 14, marginBottom: 12, boxSizing: "border-box" }} />
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => { setShowTextModal(false); setPendingPos(null); }}
                style={{ padding: "7px 16px", background: "#0f3460", border: "1px solid #555", color: "#aaa", borderRadius: 6, cursor: "pointer", fontSize: 13 }}>취소</button>
              <button onClick={confirmText}
                style={{ padding: "7px 16px", background: "#e94560", border: "none", color: "#fff", borderRadius: 6, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>확인</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function IconBtn({ icon, label, onClick, disabled, active }: { icon: React.ReactNode; label: string; onClick: () => void; disabled?: boolean; active?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled}
      style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, padding: "6px 10px", background: active ? "#e94560" : "#0f3460", border: "none", borderRadius: 8, cursor: disabled ? "not-allowed" : "pointer", color: disabled ? "#555" : "#eee", minWidth: 44 }}>
      {icon}
      <span style={{ fontSize: 10 }}>{label}</span>
    </button>
  );
}

function DeskBtn({ icon, label, onClick, disabled }: { icon: React.ReactNode; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled}
      style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", border: "1px solid #0f3460", background: "#0f3460", color: disabled ? "#555" : "#eee", borderRadius: 6, cursor: disabled ? "not-allowed" : "pointer", fontSize: 12 }}>
      {icon}{label}
    </button>
  );
}
