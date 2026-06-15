import { useRef, useState, useEffect, useCallback } from "react";
import { ChevronLeft, RotateCcw, Trash2, Download, Upload } from "lucide-react";

type ToolType = "hline" | "vline" | "line" | "angle" | "text" | "erase";
type LineStyle = "solid" | "dashed" | "dotted";

interface DrawnItem {
  type: ToolType | "text";
  x1: number; y1: number;
  x2: number; y2: number;
  color: string;
  width: number;
  style: LineStyle;
  label?: string | null;
  labelX?: number;
  labelY?: number;
  text?: string;
  fontSize?: number;
}

const TOOLS: { id: ToolType; label: string; key: string }[] = [
  { id: "hline", label: "― 수평선", key: "1" },
  { id: "vline", label: "| 수직선", key: "2" },
  { id: "line",  label: "／ 자유선", key: "3" },
  { id: "angle", label: "📐 각도선", key: "4" },
  { id: "text",  label: "T 텍스트", key: "5" },
  { id: "erase", label: "✕ 삭제", key: "e" },
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
  const [fontSize, setFontSize] = useState(14);
  const [infoText, setInfoText] = useState("좌표: (0, 0) | 도구: 수평선");
  const [showTextModal, setShowTextModal] = useState(false);
  const [pendingPos, setPendingPos] = useState<{ x: number; y: number } | null>(null);
  const [textInput, setTextInput] = useState("");

  const drawingRef = useRef(false);
  const startRef = useRef({ x: 0, y: 0 });
  const linesRef = useRef<DrawnItem[]>([]);
  const historyRef = useRef<DrawnItem[][]>([]);
  const bgRef = useRef<HTMLImageElement | null>(null);
  const colorRef = useRef(color);
  const widthRef = useRef(lineWidth);
  const styleRef = useRef(lineStyle);
  const fontRef = useRef(fontSize);
  const toolRef = useRef<ToolType>(currentTool);

  // Keep refs in sync
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
        ctx.font = `bold ${l.fontSize || 14}px Arial`;
        ctx.fillStyle = l.color;
        ctx.strokeStyle = "rgba(0,0,0,0.6)";
        ctx.lineWidth = 3;
        ctx.setLineDash([]);
        ctx.strokeText(l.text!, l.x1, l.y1);
        ctx.fillText(l.text!, l.x1, l.y1);
      } else {
        applyLineStyle(ctx, l.color, l.width, l.style);
        ctx.beginPath();
        ctx.moveTo(l.x1, l.y1);
        ctx.lineTo(l.x2, l.y2);
        ctx.stroke();
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

  const getPos = useCallback((e: MouseEvent | TouchEvent): { x: number; y: number } => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
  }, []);

  const eraseAt = useCallback((x: number, y: number) => {
    const prev = linesRef.current;
    const next = prev.filter(l => {
      if (l.type === "text") return !(Math.abs(x - l.x1) < 60 && Math.abs(y - l.y1) < 20);
      return distToSegment(x, y, l.x1, l.y1, l.x2, l.y2) > 10;
    });
    if (next.length < prev.length) {
      historyRef.current = [...historyRef.current, prev];
      setHistory([...historyRef.current]);
      linesRef.current = next;
      setLines(next);
      render();
    }
  }, [render]);

  const onDown = useCallback((e: MouseEvent | TouchEvent) => {
    if (!bgRef.current) return;
    const pos = getPos(e);
    startRef.current = pos;
    if (toolRef.current === "erase") { eraseAt(pos.x, pos.y); return; }
    if (toolRef.current === "text") {
      setPendingPos(pos);
      setTextInput("");
      setShowTextModal(true);
      return;
    }
    drawingRef.current = true;
  }, [getPos, eraseAt]);

  const onMove = useCallback((e: MouseEvent | TouchEvent) => {
    if (!bgRef.current) return;
    const pos = getPos(e);
    const tool = toolRef.current;
    const names: Record<ToolType, string> = { hline: "수평선", vline: "수직선", line: "자유선", angle: "각도선", text: "텍스트", erase: "삭제" };
    setInfoText(`좌표: (${Math.round(pos.x)}, ${Math.round(pos.y)}) | 도구: ${names[tool]}`);
    if (!drawingRef.current) return;
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
    if (!drawingRef.current) return;
    drawingRef.current = false;
    const pos = getPos(e);
    const { x: sx, y: sy } = startRef.current;
    const canvas = canvasRef.current!;
    const tool = toolRef.current;
    if (Math.abs(pos.x - sx) < 2 && Math.abs(pos.y - sy) < 2) return;

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
      item.labelY = (sy + pos.y) / 2 - 10;
    }

    const next = [...linesRef.current, item];
    historyRef.current = [...historyRef.current, linesRef.current];
    setHistory([...historyRef.current]);
    linesRef.current = next;
    setLines(next);
    render();
  }, [getPos, render]);

  // Attach canvas events
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const opts = { passive: false } as AddEventListenerOptions;
    const mousedown = (e: MouseEvent) => onDown(e);
    const mousemove = (e: MouseEvent) => onMove(e);
    const mouseup = (e: MouseEvent) => onUp(e);
    const touchstart = (e: TouchEvent) => { e.preventDefault(); onDown(e); };
    const touchmove = (e: TouchEvent) => { e.preventDefault(); onMove(e); };
    const touchend = (e: TouchEvent) => { e.preventDefault(); onUp(e); };
    canvas.addEventListener("mousedown", mousedown);
    canvas.addEventListener("mousemove", mousemove);
    canvas.addEventListener("mouseup", mouseup);
    canvas.addEventListener("touchstart", touchstart, opts);
    canvas.addEventListener("touchmove", touchmove, opts);
    canvas.addEventListener("touchend", touchend, opts);
    return () => {
      canvas.removeEventListener("mousedown", mousedown);
      canvas.removeEventListener("mousemove", mousemove);
      canvas.removeEventListener("mouseup", mouseup);
      canvas.removeEventListener("touchstart", touchstart);
      canvas.removeEventListener("touchmove", touchmove);
      canvas.removeEventListener("touchend", touchend);
    };
  }, [onDown, onMove, onUp]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === "INPUT") return;
      if ((e.ctrlKey || e.metaKey) && e.key === "z") { handleUndo(); return; }
      const found = TOOLS.find(t => t.key === e.key);
      if (found) setCurrentTool(found.id);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function loadImageFile(file: File) {
    const reader = new FileReader();
    reader.onload = ev => {
      const img = new Image();
      img.onload = () => {
        const canvas = canvasRef.current!;
        const maxW = Math.min(img.width, window.innerWidth - 80);
        const scale = maxW / img.width;
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        linesRef.current = [];
        historyRef.current = [];
        setLines([]);
        setHistory([]);
        bgRef.current = img;
        setBgImage(img);
        const ctx = canvas.getContext("2d")!;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      };
      img.src = ev.target!.result as string;
    };
    reader.readAsDataURL(file);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) loadImageFile(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file?.type.startsWith("image/")) loadImageFile(file);
  }

  function handleUndo() {
    const hist = historyRef.current;
    if (!hist.length) return;
    const prev = hist[hist.length - 1];
    const newHist = hist.slice(0, -1);
    historyRef.current = newHist;
    linesRef.current = prev;
    setHistory(newHist);
    setLines(prev);
    render();
  }

  function handleClearAll() {
    if (!window.confirm("모든 선을 삭제하시겠습니까?")) return;
    historyRef.current = [...historyRef.current, linesRef.current];
    setHistory([...historyRef.current]);
    linesRef.current = [];
    setLines([]);
    render();
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
    linesRef.current = next;
    setLines(next);
    render();
    setPendingPos(null);
  }

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
        {/* File controls */}
        <div style={{ display: "flex", gap: 4, paddingRight: 10, marginRight: 2, borderRight: "1px solid #0f3460" }}>
          <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleFileChange} />
          <ToolBtn icon={<Upload size={13} />} label="사진 열기" onClick={() => fileInputRef.current?.click()} />
          <ToolBtn icon={<Download size={13} />} label="저장" onClick={handleSave} disabled={!bgImage} />
          <ToolBtn icon={<RotateCcw size={13} />} label="실행취소" onClick={handleUndo} disabled={history.length === 0} />
          <ToolBtn icon={<Trash2 size={13} />} label="전체삭제" onClick={handleClearAll} disabled={lines.length === 0} />
        </div>

        {/* Tool buttons */}
        <div style={{ display: "flex", gap: 4, paddingRight: 10, marginRight: 2, borderRight: "1px solid #0f3460" }}>
          {TOOLS.map(t => (
            <button key={t.id} onClick={() => setCurrentTool(t.id)}
              style={{ padding: "5px 10px", border: "1px solid #0f3460", background: currentTool === t.id ? "#e94560" : "#0f3460", color: "#eee", borderRadius: 6, cursor: "pointer", fontSize: 12, transition: "all 0.15s" }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Color & width */}
        <div style={{ display: "flex", gap: 8, alignItems: "center", paddingRight: 10, marginRight: 2, borderRight: "1px solid #0f3460" }}>
          <label style={{ fontSize: 12, color: "#aaa" }}>색상</label>
          <input type="color" value={color} onChange={e => setColor(e.target.value)}
            style={{ width: 32, height: 28, border: "1px solid #0f3460", borderRadius: 4, cursor: "pointer", background: "none" }} />
          <label style={{ fontSize: 12, color: "#aaa" }}>굵기</label>
          <input type="range" min={1} max={10} value={lineWidth} onChange={e => setLineWidth(Number(e.target.value))} style={{ width: 70 }} />
          <span style={{ fontSize: 12, color: "#eee", minWidth: 12 }}>{lineWidth}</span>
        </div>

        {/* Style & font */}
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
      <div
        style={{ flex: 1, display: "flex", justifyContent: "center", alignItems: "flex-start", padding: 20, overflow: "auto" }}
        onDragOver={e => e.preventDefault()}
        onDrop={handleDrop}
      >
        <div style={{ position: "relative", display: "inline-block", cursor: bgImage ? "crosshair" : "default" }}>
          {!bgImage && (
            <div
              onClick={() => fileInputRef.current?.click()}
              style={{ width: 500, height: 500, border: "3px dashed #0f3460", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, color: "#aaa", borderRadius: 12, cursor: "pointer" }}>
              <div style={{ fontSize: 64 }}>🖼️</div>
              <p style={{ fontSize: 18 }}>사진을 클릭하거나 드래그해서 업로드</p>
              <small style={{ fontSize: 13, color: "#666" }}>JPG, PNG, WEBP 지원</small>
            </div>
          )}
          <canvas
            ref={canvasRef}
            style={{ display: bgImage ? "block" : "none", boxShadow: "0 4px 30px rgba(0,0,0,0.5)", maxWidth: "100%" }}
          />
        </div>
      </div>

      {/* Info bar */}
      <div style={{ position: "fixed", bottom: 10, left: "50%", transform: "translateX(-50%)", background: "rgba(0,0,0,0.7)", padding: "6px 16px", borderRadius: 20, fontSize: 12, color: "#aaa", pointerEvents: "none" }}>
        {infoText}
      </div>

      {/* Text input modal */}
      {showTextModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200 }}>
          <div style={{ background: "#16213e", border: "2px solid #e94560", borderRadius: 12, padding: 24, minWidth: 300 }}>
            <h3 style={{ color: "#e94560", marginBottom: 12, fontSize: 16 }}>텍스트 입력</h3>
            <input
              type="text"
              autoFocus
              value={textInput}
              onChange={e => setTextInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") confirmText(); if (e.key === "Escape") { setShowTextModal(false); setPendingPos(null); } }}
              placeholder="예: 6° / 10mm"
              style={{ width: "100%", padding: "8px", background: "#0f3460", border: "1px solid #555", color: "#eee", borderRadius: 6, fontSize: 14, marginBottom: 12, boxSizing: "border-box" }}
            />
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => { setShowTextModal(false); setPendingPos(null); }}
                style={{ padding: "7px 16px", background: "#0f3460", border: "1px solid #555", color: "#aaa", borderRadius: 6, cursor: "pointer", fontSize: 13 }}>
                취소
              </button>
              <button onClick={confirmText}
                style={{ padding: "7px 16px", background: "#e94560", border: "none", color: "#fff", borderRadius: 6, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
                확인
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ToolBtn({ icon, label, onClick, disabled }: { icon: React.ReactNode; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled}
      style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", border: "1px solid #0f3460", background: "#0f3460", color: disabled ? "#555" : "#eee", borderRadius: 6, cursor: disabled ? "not-allowed" : "pointer", fontSize: 12, transition: "all 0.15s" }}>
      {icon}{label}
    </button>
  );
}
