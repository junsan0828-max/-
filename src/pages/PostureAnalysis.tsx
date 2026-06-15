import { useRef, useState, useEffect, useCallback } from "react";
import { ChevronLeft, RotateCcw, Trash2, Download, Upload, Settings, X } from "lucide-react";

type ToolType = "hline" | "vline" | "line" | "angle" | "text" | "erase";
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

const TOOLS: { id: ToolType; emoji: string; label: string; key: string }[] = [
  { id: "hline", emoji: "—",  label: "수평선",  key: "1" },
  { id: "vline", emoji: "|",  label: "수직선",  key: "2" },
  { id: "line",  emoji: "／", label: "자유선",  key: "3" },
  { id: "angle", emoji: "📐", label: "각도선",  key: "4" },
  { id: "text",  emoji: "T",  label: "텍스트",  key: "5" },
  { id: "erase", emoji: "🧹", label: "지우개",  key: "e" },
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

  const render = useCallback((extraPreview?: () => void) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (bgRef.current) ctx.drawImage(bgRef.current, 0, 0, canvas.width, canvas.height);
    linesRef.current.forEach(l => {
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
          ctx.strokeText(l.label, l.labelX!, l.labelY!);
          ctx.fillText(l.label, l.labelX!, l.labelY!);
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
  }, [applyLineStyle]);

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

    // 기존 선 근처 → 이동 모드
    const nearIdx = findNearLine(pos.x, pos.y);
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
          const lx = pts[1].x + 10, ly = pts[1].y - 10;
          ctx.strokeText(a.toFixed(1) + "°", lx, ly);
          ctx.fillStyle = colorRef.current;
          ctx.fillText(a.toFixed(1) + "°", lx, ly);
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
    render(() => {
      ctx.save();
      applyLineStyle(ctx, colorRef.current, widthRef.current, styleRef.current);
      ctx.beginPath();
      if (tool === "hline") { ctx.moveTo(0, sy); ctx.lineTo(canvas.width, sy); }
      else if (tool === "vline") { ctx.moveTo(sx, 0); ctx.lineTo(sx, canvas.height); }
      else { ctx.moveTo(sx, sy); ctx.lineTo(pos.x, pos.y); }
      ctx.stroke();
      ctx.restore();
    });
  }, [getPos, render, applyLineStyle]);

  const onUp = useCallback((e: MouseEvent | TouchEvent) => {
    // 이동 모드 종료
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
    if (Math.abs(pos.x - sx) < 4 && Math.abs(pos.y - sy) < 4) return;

    let item: DrawnItem = {
      type: tool, x1: sx, y1: sy, x2: pos.x, y2: pos.y,
      color: colorRef.current, width: widthRef.current, style: styleRef.current,
    };
    if (tool === "hline") { item.x1 = 0; item.x2 = canvas.width; item.y1 = sy; item.y2 = sy; }
    if (tool === "vline") { item.x1 = sx; item.x2 = sx; item.y1 = 0; item.y2 = canvas.height; }
    if (tool === "angle") {
      const angle = Math.abs(Math.atan2(pos.y - sy, pos.x - sx) * 180 / Math.PI);
      item.label = angle.toFixed(1) + "°";
      item.labelX = (sx + pos.x) / 2;
      item.labelY = (sy + pos.y) / 2 - 12;
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
    return (
      <div style={{ height: "100dvh", background: "#1a1a2e", color: "#eee", display: "flex", flexDirection: "column", fontFamily: "'Noto Sans KR', sans-serif", overflow: "hidden" }}>

        {/* Top bar */}
        <div style={{ background: "#16213e", borderBottom: "1px solid #0f3460", padding: "8px 12px", display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <a href="/" style={{ color: "#aaa", textDecoration: "none", padding: "6px 8px", background: "#0f3460", borderRadius: 6, display: "flex", alignItems: "center" }}>
            <ChevronLeft size={18} />
          </a>
          <span style={{ color: "#f1f5f9", fontWeight: 700, fontSize: 14, flex: 1 }}>🏋️ 자세 분석</span>
          <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) loadImageFile(f); }} />
          <IconBtn icon={<Upload size={16} />} label="사진" onClick={() => fileInputRef.current?.click()} />
          <IconBtn icon={<RotateCcw size={16} />} label="되돌리기" onClick={handleUndo} disabled={history.length === 0} />
          <IconBtn icon={<Download size={16} />} label="저장" onClick={handleSave} disabled={!bgImage} />
          <IconBtn icon={<Settings size={16} />} label="설정" onClick={() => setShowSettings(v => !v)} active={showSettings} />
        </div>

        {/* Settings panel (collapsible) */}
        {showSettings && (
          <div style={{ background: "#16213e", borderBottom: "1px solid #0f3460", padding: "10px 14px", display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 12, color: "#aaa" }}>색상</span>
              <input type="color" value={color} onChange={e => setColor(e.target.value)}
                style={{ width: 36, height: 32, border: "1px solid #0f3460", borderRadius: 6, cursor: "pointer", background: "none" }} />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 140 }}>
              <span style={{ fontSize: 12, color: "#aaa" }}>굵기 {lineWidth}</span>
              <input type="range" min={1} max={12} value={lineWidth} onChange={e => setLineWidth(Number(e.target.value))}
                style={{ flex: 1, accentColor: "#e94560" }} />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 12, color: "#aaa" }}>스타일</span>
              <select value={lineStyle} onChange={e => setLineStyle(e.target.value as LineStyle)}
                style={{ padding: "5px 8px", background: "#0f3460", border: "1px solid #555", color: "#eee", borderRadius: 6, fontSize: 13 }}>
                <option value="solid">실선</option>
                <option value="dashed">점선</option>
                <option value="dotted">점점선</option>
              </select>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 12, color: "#aaa" }}>글자크기</span>
              <input type="number" min={10} max={80} value={fontSize} onChange={e => setFontSize(Number(e.target.value))}
                style={{ width: 56, padding: "5px 6px", background: "#0f3460", border: "1px solid #555", color: "#eee", borderRadius: 6, fontSize: 13 }} />
            </div>
            <button onClick={handleClearAll} disabled={lines.length === 0}
              style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", background: lines.length ? "#7f1d1d" : "#1e293b", border: "1px solid #991b1b", color: lines.length ? "#fca5a5" : "#555", borderRadius: 6, cursor: lines.length ? "pointer" : "not-allowed", fontSize: 13 }}>
              <Trash2 size={13} />전체 초기화
            </button>
          </div>
        )}

        {/* Canvas area */}
        <div style={{ flex: 1, overflow: "auto", display: "flex", flexDirection: "column", justifyContent: "flex-start", alignItems: "center", WebkitOverflowScrolling: "touch" } as React.CSSProperties}>
          {!bgImage && (
            <div onClick={() => fileInputRef.current?.click()}
              style={{ margin: 20, width: "calc(100% - 40px)", minHeight: 300, border: "3px dashed #0f3460", borderRadius: 14, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, color: "#aaa", cursor: "pointer" }}>
              <div style={{ fontSize: 56 }}>📷</div>
              <p style={{ fontSize: 16, textAlign: "center", margin: 0 }}>사진을 탭하여 업로드</p>
              <small style={{ fontSize: 12, color: "#555" }}>카메라 촬영 또는 갤러리에서 선택</small>
            </div>
          )}
          <canvas ref={canvasRef} style={{ display: bgImage ? "block" : "none", width: "100%", touchAction: "none" }} />
        </div>

        {/* 각도 진행 힌트 */}
        {currentTool === "angle" && angleStep > 0 && (
          <div style={{ background: "#0f3460", borderTop: "1px solid #1e40af", padding: "6px 16px", textAlign: "center", fontSize: 12, color: "#93c5fd", flexShrink: 0 }}>
            {angleStep === 1 ? "✅ 1번 점 완료 → 꼭짓점(중간점)을 탭하세요" : "✅ 꼭짓점 완료 → 3번째 점을 탭하세요"}
          </div>
        )}

        {/* Bottom toolbar */}
        <div style={{ background: "#16213e", borderTop: "1px solid #0f3460", padding: "8px 6px", display: "flex", justifyContent: "space-around", flexShrink: 0 }}>
          {TOOLS.map(t => (
            <button key={t.id} onClick={() => setCurrentTool(t.id)}
              style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, padding: "8px 10px", background: currentTool === t.id ? "#e94560" : "#0f3460", border: "none", borderRadius: 10, cursor: "pointer", color: "#eee", minWidth: 44, transition: "all 0.15s" }}>
              <span style={{ fontSize: 18, lineHeight: 1 }}>{t.emoji}</span>
              <span style={{ fontSize: 10 }}>{t.label}</span>
            </button>
          ))}
        </div>

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
        <span style={{ color: "#f1f5f9", fontWeight: 700, fontSize: 15 }}>🏋️ 자세 분석 라인 드로잉</span>
        <span style={{ background: "#0f3460", color: "#60a5fa", fontSize: 10, padding: "2px 8px", borderRadius: 20, fontWeight: 700 }}>BETA</span>
      </div>

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
              {t.emoji} {t.label}
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
      <div style={{ flex: 1, display: "flex", justifyContent: "center", alignItems: "flex-start", padding: 20, overflow: "auto" }}
        onDragOver={e => e.preventDefault()}
        onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f?.type.startsWith("image/")) loadImageFile(f); }}>
        <div style={{ position: "relative", display: "inline-block", cursor: bgImage ? "crosshair" : "default" }}>
          {!bgImage && (
            <div onClick={() => fileInputRef.current?.click()}
              style={{ width: 500, height: 500, border: "3px dashed #0f3460", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, color: "#aaa", borderRadius: 12, cursor: "pointer" }}>
              <div style={{ fontSize: 64 }}>🖼️</div>
              <p style={{ fontSize: 18 }}>사진을 클릭하거나 드래그해서 업로드</p>
              <small style={{ fontSize: 13, color: "#666" }}>JPG · PNG · WEBP 지원</small>
            </div>
          )}
          <canvas ref={canvasRef} style={{ display: bgImage ? "block" : "none", boxShadow: "0 4px 30px rgba(0,0,0,0.5)", maxWidth: "100%" }} />
        </div>
      </div>

      {/* Info bar */}
      <div style={{ position: "fixed", bottom: 10, left: "50%", transform: "translateX(-50%)", background: "rgba(0,0,0,0.75)", padding: "6px 18px", borderRadius: 20, fontSize: 12, color: "#aaa", pointerEvents: "none" }}>
        {currentTool === "angle" && angleStep === 1 && "📐 꼭짓점(중간점)을 클릭하세요"}
        {currentTool === "angle" && angleStep === 2 && "📐 3번째 점을 클릭하세요"}
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
