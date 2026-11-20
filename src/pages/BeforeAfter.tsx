import { useEffect, useRef, useState } from "react";
import { ImagePlus, Download, Share2, RotateCcw, Save, Columns2, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Grid2x2, Minus, Plus } from "lucide-react";
import { track } from "../lib/counter";

type Layout = "wide" | "portrait";
interface Photo { img: HTMLImageElement | null; zoom: number; x: number; y: number }
interface Texts {
  beforeLabel: string; afterLabel: string; center: string; title: string;
  body: string; bottom: string; footnote: string; showFootnote: boolean;
}

const PRESET_KEY = "ba_preset_v1";
const BLUE = "#1e7bff";
const DEFAULT_TEXTS: Texts = {
  beforeLabel: "BEFORE",
  afterLabel: "AFTER",
  center: "맞춤운동센터\n자이언트짐",
  title: "*케어 PT*\n이용 후 변화",
  body: "1:1 맞춤 *케어PT*로\n자세와 균형,\n일상 속 움직임이\n달라졌습니다.",
  bottom: "*시흥 맞춤운동센터 자이언트짐 케어PT*는 단순 운동이 아닌,\n당신의 일상을 바꾸는 *1:1 맞춤 케어 솔루션*입니다.",
  footnote: "※ 실제 회원 사례입니다.",
  showFootnote: true,
};
const SIZES: Record<Layout, { w: number; h: number; label: string }> = {
  wide: { w: 1260, h: 890, label: "가로형 1260×890" },
  portrait: { w: 1080, h: 1350, label: "세로형 1080×1350 (인스타)" },
};

/* ── 텍스트: *강조* 를 파란색으로, 줄바꿈·자동 줄바꿈 처리 ── */
type Seg = { t: string; hl: boolean };
function parse(line: string): Seg[] {
  const out: Seg[] = [];
  line.split(/(\*[^*]+\*)/g).forEach((p) => {
    if (!p) return;
    if (p.startsWith("*") && p.endsWith("*") && p.length > 2) out.push({ t: p.slice(1, -1), hl: true });
    else out.push({ t: p, hl: false });
  });
  return out;
}
function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number): Seg[][] {
  const lines: Seg[][] = [];
  text.split("\n").forEach((raw) => {
    const words: Seg[] = [];
    parse(raw).forEach((s) => s.t.split(/(\s+)/).forEach((w) => w && words.push({ t: w, hl: s.hl })));
    let cur: Seg[] = []; let w = 0;
    words.forEach((wd) => {
      const ww = ctx.measureText(wd.t).width;
      if (w + ww > maxW && cur.length && wd.t.trim()) { lines.push(cur); cur = []; w = 0; if (!wd.t.trim()) return; }
      if (!cur.length && !wd.t.trim()) return;
      cur.push(wd); w += ww;
    });
    lines.push(cur);
  });
  return lines;
}
function drawText(ctx: CanvasRenderingContext2D, text: string, cx: number, y: number, maxW: number, size: number, lh: number, weight = 700, align: "center" | "right" = "center"): number {
  ctx.font = `${weight} ${size}px 'Noto Sans KR', sans-serif`;
  ctx.textBaseline = "middle";
  const lines = wrap(ctx, text, maxW);
  lines.forEach((segs, i) => {
    const total = segs.reduce((a, s) => a + ctx.measureText(s.t).width, 0);
    let x = align === "center" ? cx - total / 2 : cx - total;
    segs.forEach((s) => { ctx.fillStyle = s.hl ? BLUE : "#ffffff"; ctx.textAlign = "left"; ctx.fillText(s.t, x, y + i * lh); x += ctx.measureText(s.t).width; });
  });
  return lines.length;
}
function drawPhoto(ctx: CanvasRenderingContext2D, p: Photo, x: number, y: number, w: number, h: number) {
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.fillStyle = "#1f2937"; ctx.fillRect(x, y, w, h);
  if (p.img) {
    const s = Math.max(w / p.img.width, h / p.img.height) * p.zoom;
    const dw = p.img.width * s, dh = p.img.height * s;
    const dx = x + (w - dw) / 2 + p.x * (dw - w) / 2;
    const dy = y + (h - dh) / 2 + p.y * (dh - h) / 2;
    ctx.drawImage(p.img, dx, dy, dw, dh);
  } else {
    ctx.fillStyle = "#6b7280"; ctx.font = "500 22px 'Noto Sans KR', sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("사진을 올려주세요", x + w / 2, y + h / 2);
  }
  ctx.restore();
}

interface Rect { x: number; y: number; w: number; h: number }
function panels(layout: Layout): { before: Rect; after: Rect } {
  const { w: W } = SIZES[layout];
  if (layout === "wide") {
    const pw = 390, ph = 550, py = 150, lx = 60;
    return { before: { x: lx, y: py, w: pw, h: ph }, after: { x: W - 60 - pw, y: py, w: pw, h: ph } };
  }
  const pw = 470, ph = 700, py = 140, lx = 50;
  return { before: { x: lx, y: py, w: pw, h: ph }, after: { x: W - 50 - pw, y: py, w: pw, h: ph } };
}

function render(cv: HTMLCanvasElement, layout: Layout, before: Photo, after: Photo, logo: HTMLImageElement | null, t: Texts, guides = false) {
  const { w: W, h: H } = SIZES[layout];
  cv.width = W; cv.height = H;
  const ctx = cv.getContext("2d")!;
  ctx.fillStyle = "#000"; ctx.fillRect(0, 0, W, H);
  const label = (txt: string, cx: number, y: number, color: string, size: number) => {
    ctx.font = `700 ${size}px 'Noto Sans KR', sans-serif`; ctx.fillStyle = color; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(txt, cx, y);
  };
  const logoBlock = (cx: number, top: number, maxW: number, maxH: number) => {
    if (!logo) return top;
    const s = Math.min(maxW / logo.width, maxH / logo.height);
    ctx.drawImage(logo, cx - (logo.width * s) / 2, top, logo.width * s, logo.height * s);
    return top + logo.height * s;
  };

  if (layout === "wide") {
    const { before: bR, after: aR } = panels("wide");
    const pw = bR.w, ph = bR.h, py = bR.y, lx = bR.x, rx = aR.x, cx = W / 2, colW = rx - (lx + pw) - 40;
    label(t.beforeLabel, lx + pw / 2, 97, "#ffffff", 40);
    label(t.afterLabel, rx + pw / 2, 97, BLUE, 40);
    drawPhoto(ctx, before, lx, py, pw, ph);
    drawPhoto(ctx, after, rx, py, pw, ph);
    let y = logoBlock(cx, 108, 120, 64);
    y = (logo ? y + 30 : 150);
    const n1 = drawText(ctx, t.center, cx, y, colW, 22, 30);
    y += n1 * 30 + 70;
    const n2 = drawText(ctx, t.title, cx, y, colW, 30, 44);
    y += (n2 - 1) * 44 + 56;
    ctx.fillStyle = "#ffffff"; ctx.fillRect(cx - 52, y, 104, 6);
    drawText(ctx, t.body, cx, y + 76, colW, 22, 52);
    if (t.showFootnote && t.footnote) { ctx.font = "400 18px 'Noto Sans KR', sans-serif"; ctx.fillStyle = "#e5e7eb"; ctx.textAlign = "right"; ctx.textBaseline = "middle"; ctx.fillText(t.footnote, rx + pw - 26, py + ph + 24); }
    drawText(ctx, t.bottom, cx, 800, W - 120, 24, 42);
  } else {
    const { before: bR2, after: aR2 } = panels("portrait");
    const pw = bR2.w, ph = bR2.h, py = bR2.y, lx = bR2.x, rx = aR2.x, cx = W / 2;
    label(t.beforeLabel, lx + pw / 2, 86, "#ffffff", 44);
    label(t.afterLabel, rx + pw / 2, 86, BLUE, 44);
    drawPhoto(ctx, before, lx, py, pw, ph);
    drawPhoto(ctx, after, rx, py, pw, ph);
    if (t.showFootnote && t.footnote) { ctx.font = "400 18px 'Noto Sans KR', sans-serif"; ctx.fillStyle = "#e5e7eb"; ctx.textAlign = "right"; ctx.textBaseline = "middle"; ctx.fillText(t.footnote, rx + pw, py + ph + 26); }
    let y = py + ph + 80;
    if (logo) { y = logoBlock(cx, y - 20, 110, 56) + 26; }
    const n1 = drawText(ctx, t.center.replace(/\n/g, " "), cx, y, W - 160, 24, 32);
    y += n1 * 32 + 30;
    const n2 = drawText(ctx, t.title.replace(/\n/g, " "), cx, y, W - 160, 34, 46);
    y += n2 * 46 + 24;
    ctx.fillStyle = "#ffffff"; ctx.fillRect(cx - 52, y, 104, 6);
    y += 46;
    const n3 = drawText(ctx, t.body.replace(/\n/g, " "), cx, y, W - 200, 24, 38, 500);
    y += n3 * 38 + 34;
    drawText(ctx, t.bottom, cx, Math.min(y + 16, H - 90), W - 120, 22, 36);
  }

  if (guides) {
    const ps = panels(layout);
    ctx.save();
    ctx.strokeStyle = "rgba(74,222,128,.85)"; ctx.lineWidth = 2; ctx.setLineDash([10, 8]);
    ([ps.before, ps.after]).forEach((r) => {
      [0.5].forEach((f) => { ctx.beginPath(); ctx.moveTo(r.x + r.w * f, r.y); ctx.lineTo(r.x + r.w * f, r.y + r.h); ctx.stroke(); });
      [0.25, 0.5, 0.75].forEach((f) => { ctx.beginPath(); ctx.moveTo(r.x, r.y + r.h * f); ctx.lineTo(r.x + r.w, r.y + r.h * f); ctx.stroke(); });
    });
    ctx.restore();
  }
}

function loadFile(file: File): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = url;
  });
}

const card: React.CSSProperties = { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: 16, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" };
const lbl: React.CSSProperties = { display: "block", fontSize: 13, fontWeight: 700, color: "#0f172a", marginBottom: 6 };
const stepBtn: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "center", width: 34, height: 30, border: "1px solid #e2e8f0", borderRadius: 8, background: "#fff", color: "#2563eb", cursor: "pointer", padding: 0 };
const inp: React.CSSProperties = { width: "100%", boxSizing: "border-box", border: "1px solid #e2e8f0", borderRadius: 10, padding: "10px 12px", fontSize: 15, fontFamily: "inherit", color: "#0f172a", background: "#fff" };

function PhotoInput({ name, photo, onChange }: { name: string; photo: Photo; onChange: (p: Photo) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <span style={lbl}>{name}</span>
      <button onClick={() => ref.current?.click()} style={{ width: "100%", height: 96, border: "2px dashed #bfdbfe", borderRadius: 12, background: photo.img ? "#eff6ff" : "#f8fafc", color: "#2563eb", fontSize: 13, fontWeight: 700, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, cursor: "pointer", overflow: "hidden", padding: 0 }}>
        {photo.img ? <img src={photo.img.src} alt="" style={{ height: "100%", maxWidth: "100%", objectFit: "contain" }} /> : (<><ImagePlus size={22} />사진 선택</>)}
      </button>
      <input ref={ref} type="file" accept="image/*" hidden onChange={async (e) => { const f = e.target.files?.[0]; if (f) onChange({ img: await loadFile(f), zoom: 1, x: 0, y: 0 }); e.target.value = ""; }} />
      {photo.img && (
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 11, color: "#64748b", width: 26, whiteSpace: "nowrap" }}>확대</span>
            <button aria-label="축소" onClick={() => onChange({ ...photo, zoom: Math.max(1, +(photo.zoom - 0.05).toFixed(2)) })} style={stepBtn}><Minus size={14} /></button>
            <input type="range" min={1} max={3} step={0.01} value={photo.zoom} onChange={(e) => onChange({ ...photo, zoom: Number(e.target.value) })} style={{ flex: 1, minWidth: 0, accentColor: "#2563eb" }} />
            <button aria-label="확대" onClick={() => onChange({ ...photo, zoom: Math.min(3, +(photo.zoom + 0.05).toFixed(2)) })} style={stepBtn}><Plus size={14} /></button>
            <span style={{ fontSize: 11, color: "#64748b", width: 32, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{photo.zoom.toFixed(2)}x</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 11, color: "#64748b", width: 26, whiteSpace: "nowrap" }}>위치</span>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 34px)", gridTemplateRows: "repeat(2, 30px)", gap: 4 }}>
              <span />
              <button aria-label="위로" onClick={() => onChange({ ...photo, y: Math.max(-1, +(photo.y - 0.04).toFixed(3)) })} style={stepBtn}><ChevronUp size={15} /></button>
              <span />
              <button aria-label="왼쪽" onClick={() => onChange({ ...photo, x: Math.max(-1, +(photo.x - 0.04).toFixed(3)) })} style={stepBtn}><ChevronLeft size={15} /></button>
              <button aria-label="아래로" onClick={() => onChange({ ...photo, y: Math.min(1, +(photo.y + 0.04).toFixed(3)) })} style={stepBtn}><ChevronDown size={15} /></button>
              <button aria-label="오른쪽" onClick={() => onChange({ ...photo, x: Math.min(1, +(photo.x + 0.04).toFixed(3)) })} style={stepBtn}><ChevronRight size={15} /></button>
            </div>
            <button onClick={() => onChange({ ...photo, zoom: 1, x: 0, y: 0 })} style={{ marginLeft: "auto", background: "none", border: "none", color: "#94a3b8", fontSize: 11, cursor: "pointer", padding: 0, textDecoration: "underline", whiteSpace: "nowrap" }}>초기화</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function BeforeAfter() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [layout, setLayout] = useState<Layout>("wide");
  const [before, setBefore] = useState<Photo>({ img: null, zoom: 1, x: 0, y: 0 });
  const [after, setAfter] = useState<Photo>({ img: null, zoom: 1, x: 0, y: 0 });
  const [logo, setLogo] = useState<HTMLImageElement | null>(null);
  const [texts, setTexts] = useState<Texts>(() => {
    try { const s = localStorage.getItem(PRESET_KEY); return s ? { ...DEFAULT_TEXTS, ...JSON.parse(s) } : DEFAULT_TEXTS; } catch { return DEFAULT_TEXTS; }
  });
  const [consent, setConsent] = useState(false);
  const [msg, setMsg] = useState("");
  const [fontsReady, setFontsReady] = useState(false);
  const logoRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState<"before" | "after" | null>(null);
  const [guides, setGuides] = useState(false);
  const pts = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinch = useRef<{ side: "before" | "after"; dist: number; zoom: number } | null>(null);
  const dragRef = useRef<{ side: "before" | "after"; sx: number; sy: number; ox: number; oy: number } | null>(null);
  const [wide, setWide] = useState(() => window.innerWidth >= 900);
  useEffect(() => {
    const on = () => setWide(window.innerWidth >= 900);
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);

  useEffect(() => {
    document.title = "비포·애프터 메이커 · FIT STEP";
    if (!sessionStorage.getItem("ba-visited")) { sessionStorage.setItem("ba-visited", "1"); track("ba", "v"); }
    Promise.all([400, 500, 700].map((w) => document.fonts.load(`${w} 24px 'Noto Sans KR'`))).finally(() => setFontsReady(true));
    try { const l = localStorage.getItem(PRESET_KEY + "_logo"); if (l) { const i = new Image(); i.onload = () => setLogo(i); i.src = l; } } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (canvasRef.current) render(canvasRef.current, layout, before, after, logo, texts, guides);
  }, [layout, before, after, logo, texts, fontsReady, guides]);

  const set = (k: keyof Texts) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setTexts({ ...texts, [k]: e.target.value });
  const ready = !!before.img && !!after.img;
  const needConsent = texts.showFootnote;
  const canExport = ready && (!needConsent || consent);

  function flash(m: string) { setMsg(m); setTimeout(() => setMsg(""), 2500); }

  /* ── 미리보기에서 사진을 직접 끌어 옮기고 확대 ── */
  function hit(e: { clientX: number; clientY: number }): { side: "before" | "after"; scale: number } | null {
    const cv = canvasRef.current; if (!cv) return null;
    const box = cv.getBoundingClientRect();
    const scale = SIZES[layout].w / box.width;
    const cx = (e.clientX - box.left) * scale, cy = (e.clientY - box.top) * scale;
    const ps = panels(layout);
    for (const side of ["before", "after"] as const) {
      const r = ps[side];
      if (cx >= r.x && cx <= r.x + r.w && cy >= r.y && cy <= r.y + r.h) return { side, scale };
    }
    return null;
  }
  const photoOf = (side: "before" | "after") => (side === "before" ? before : after);
  const setPhoto = (side: "before" | "after", p: Photo) => (side === "before" ? setBefore(p) : setAfter(p));

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    const h = hit(e); if (!h || !photoOf(h.side).img) return;
    pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.current.size === 2) {
      const [a, b] = [...pts.current.values()];
      pinch.current = { side: h.side, dist: Math.hypot(a.x - b.x, a.y - b.y) || 1, zoom: photoOf(h.side).zoom };
      dragRef.current = null; setDragging(null);
      return;
    }
    const p = photoOf(h.side);
    dragRef.current = { side: h.side, sx: e.clientX, sy: e.clientY, ox: p.x, oy: p.y };
    setDragging(h.side);
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (pts.current.has(e.pointerId)) pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pz = pinch.current;
    if (pz && pts.current.size >= 2) {
      const [a, b] = [...pts.current.values()];
      const d2 = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      const p = photoOf(pz.side);
      setPhoto(pz.side, { ...p, zoom: Math.max(1, Math.min(3, pz.zoom * (d2 / pz.dist))) });
      return;
    }
    const d = dragRef.current; if (!d) return;
    const cv = canvasRef.current!; const box = cv.getBoundingClientRect();
    const scale = SIZES[layout].w / box.width;
    const r = panels(layout)[d.side];
    const p = photoOf(d.side); if (!p.img) return;
    const s = Math.max(r.w / p.img.width, r.h / p.img.height) * p.zoom;
    const dw = p.img.width * s, dh = p.img.height * s;
    const rangeX = dw - r.w, rangeY = dh - r.h;
    const nx = rangeX > 1 ? d.ox + ((e.clientX - d.sx) * scale * 2) / rangeX : d.ox;
    const ny = rangeY > 1 ? d.oy + ((e.clientY - d.sy) * scale * 2) / rangeY : d.oy;
    setPhoto(d.side, { ...p, x: Math.max(-1, Math.min(1, nx)), y: Math.max(-1, Math.min(1, ny)) });
  }
  function endDrag(e?: React.PointerEvent<HTMLCanvasElement>) {
    if (e) pts.current.delete(e.pointerId);
    if (pts.current.size < 2) pinch.current = null;
    dragRef.current = null; setDragging(null);
  }
  function onWheel(e: React.WheelEvent<HTMLCanvasElement>) {
    const h = hit(e); if (!h) return;
    const p = photoOf(h.side); if (!p.img) return;
    e.preventDefault();
    const z = Math.max(1, Math.min(3, p.zoom - e.deltaY * 0.0015));
    setPhoto(h.side, { ...p, zoom: z });
  }

  function toBlob(): Promise<Blob | null> {
    const cv = canvasRef.current!;
    render(cv, layout, before, after, logo, texts, false);
    return new Promise((res) => cv.toBlob((b) => {
      render(cv, layout, before, after, logo, texts, guides);
      res(b);
    }, "image/png"));
  }
  async function save() {
    if (!canExport) return;
    const blob = await toBlob(); if (!blob) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `before-after-${new Date().toISOString().slice(0, 10)}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    track("ba", "u");
    flash("이미지를 저장했습니다");
  }
  async function share() {
    if (!canExport) return;
    const blob = await toBlob(); if (!blob) return;
    const file = new File([blob], "before-after.png", { type: "image/png" });
    const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
    if (nav.share && nav.canShare?.({ files: [file] })) {
      try { await nav.share({ files: [file], title: "비포·애프터" }); track("ba", "s"); } catch { /* cancelled */ }
    } else { flash("이 기기에서는 공유를 지원하지 않습니다. 저장 후 공유해 주세요."); }
  }
  function savePreset() {
    try {
      localStorage.setItem(PRESET_KEY, JSON.stringify(texts));
      if (logo) {
        const c = document.createElement("canvas"); const s = Math.min(1, 400 / logo.width);
        c.width = logo.width * s; c.height = logo.height * s; c.getContext("2d")!.drawImage(logo, 0, 0, c.width, c.height);
        localStorage.setItem(PRESET_KEY + "_logo", c.toDataURL("image/png"));
      }
      flash("문구와 로고를 이 기기에 저장했습니다");
    } catch { flash("저장 공간이 부족해 저장하지 못했습니다"); }
  }
  function resetTexts() { setTexts(DEFAULT_TEXTS); }

  return (
    <div style={{ minHeight: "100dvh", background: "#f8fafc", fontFamily: "'Noto Sans KR', sans-serif", color: "#0f172a" }}>
      <header style={{ padding: "16px 16px 12px", display: "flex", alignItems: "center", gap: 10, maxWidth: 1180, margin: "0 auto" }}>
        <div style={{ width: 46, height: 46, background: "#1e3a5f", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Columns2 size={24} color="#93c5fd" /></div>
        <div>
          <p style={{ color: "#2563eb", fontSize: 10, fontWeight: 800, margin: "0 0 2px", letterSpacing: "0.12em" }}>FIT STEP</p>
          <h1 style={{ color: "#0f172a", fontSize: 16, fontWeight: 700, margin: 0 }}>비포·애프터 메이커</h1>
        </div>
      </header>

      <main style={{ maxWidth: 1180, margin: "0 auto", padding: "0 16px 120px", display: "grid", gap: 16, gridTemplateColumns: wide ? "minmax(0, 1fr) minmax(0, 1.2fr)" : "1fr", alignItems: "start" }}>
        <section style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0, order: wide ? 0 : 1 }}>
          <div style={card}>
            <div style={{ display: "flex", gap: 12 }}>
              <PhotoInput name="비포 사진" photo={before} onChange={setBefore} />
              <PhotoInput name="애프터 사진" photo={after} onChange={setAfter} />
            </div>
            <p style={{ fontSize: 12, color: "#64748b", margin: "10px 0 0" }}>사진은 이 기기 안에서만 합쳐지고, 서버로 전송되지 않습니다.</p>
          </div>

          <div style={card}>
            <span style={lbl}>이미지 크기</span>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {(Object.keys(SIZES) as Layout[]).map((k) => (
                <button key={k} onClick={() => setLayout(k)} style={{ padding: "8px 12px", borderRadius: 20, fontSize: 13, fontWeight: 700, cursor: "pointer", border: `1px solid ${layout === k ? "#2563eb" : "#e2e8f0"}`, background: layout === k ? "#eff6ff" : "#fff", color: layout === k ? "#2563eb" : "#475569" }}>{SIZES[k].label}</button>
              ))}
            </div>
          </div>

          <div style={{ ...card, display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ ...lbl, marginBottom: 0 }}>문구</span>
              <span style={{ fontSize: 12, color: "#64748b" }}><b style={{ color: BLUE }}>*강조*</b> → 파란색</span>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <label style={{ flex: 1 }}><span style={{ ...lbl, fontSize: 12 }}>비포 라벨</span><input style={inp} value={texts.beforeLabel} onChange={set("beforeLabel")} maxLength={12} /></label>
              <label style={{ flex: 1 }}><span style={{ ...lbl, fontSize: 12 }}>애프터 라벨</span><input style={inp} value={texts.afterLabel} onChange={set("afterLabel")} maxLength={12} /></label>
            </div>
            <div>
              <span style={{ ...lbl, fontSize: 12 }}>① 로고 · 센터 이름</span>
              <div style={{ display: "flex", gap: 8, alignItems: "stretch" }}>
                <button onClick={() => logoRef.current?.click()} style={{ width: 84, flexShrink: 0, border: "1px dashed #bfdbfe", borderRadius: 10, background: "#000", color: "#93c5fd", fontSize: 11, cursor: "pointer", padding: 4, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {logo ? <img src={logo.src} alt="로고" style={{ maxWidth: "100%", maxHeight: 48 }} /> : "로고 선택"}
                </button>
                <textarea style={{ ...inp, minHeight: 64, resize: "vertical" }} value={texts.center} onChange={set("center")} />
              </div>
              <input ref={logoRef} type="file" accept="image/*" hidden onChange={async (e) => { const f = e.target.files?.[0]; if (f) setLogo(await loadFile(f)); e.target.value = ""; }} />
              {logo && <button onClick={() => { setLogo(null); try { localStorage.removeItem(PRESET_KEY + "_logo"); } catch { /* ignore */ } }} style={{ marginTop: 6, background: "none", border: "none", color: "#94a3b8", fontSize: 12, cursor: "pointer", padding: 0 }}>로고 빼기</button>}
            </div>
            <label><span style={{ ...lbl, fontSize: 12 }}>② 제목</span><textarea style={{ ...inp, minHeight: 64, resize: "vertical" }} value={texts.title} onChange={set("title")} /></label>
            <label><span style={{ ...lbl, fontSize: 12 }}>③ 본문</span><textarea style={{ ...inp, minHeight: 100, resize: "vertical" }} value={texts.body} onChange={set("body")} /></label>
            <label><span style={{ ...lbl, fontSize: 12 }}>④ 하단 문구</span><textarea style={{ ...inp, minHeight: 80, resize: "vertical" }} value={texts.bottom} onChange={set("bottom")} /></label>
            <div>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 700, marginBottom: 6 }}>
                <input type="checkbox" checked={texts.showFootnote} onChange={(e) => setTexts({ ...texts, showFootnote: e.target.checked })} style={{ width: 18, height: 18, accentColor: "#2563eb" }} />
                사진 아래 안내 문구 표시
              </label>
              {texts.showFootnote && <input style={inp} value={texts.footnote} onChange={set("footnote")} maxLength={40} />}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={savePreset} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "10px", borderRadius: 10, border: "1px solid #e2e8f0", background: "#fff", color: "#475569", fontSize: 13, fontWeight: 700, cursor: "pointer" }}><Save size={14} /> 문구·로고 저장</button>
              <button onClick={resetTexts} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "10px 14px", borderRadius: 10, border: "1px solid #e2e8f0", background: "#fff", color: "#94a3b8", fontSize: 13, cursor: "pointer" }}><RotateCcw size={14} /> 기본값</button>
            </div>
          </div>
        </section>

        <section style={{ position: wide ? "sticky" : "static", top: 12, display: "flex", flexDirection: "column", gap: 12, minWidth: 0, order: wide ? 1 : 0 }}>
          <div style={{ ...card, padding: 10, background: "#0f172a", border: "none" }}>
            <canvas
              ref={canvasRef}
              aria-label="비포·애프터 결과 미리보기"
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
              onPointerLeave={endDrag}
              onWheel={onWheel}
              style={{ width: "100%", height: "auto", display: "block", borderRadius: 6, touchAction: "none", cursor: dragging ? "grabbing" : (before.img || after.img) ? "grab" : "default" }}
            />
            {(before.img || after.img) && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, margin: "8px 2px 0", flexWrap: "wrap" }}>
                <p style={{ fontSize: 11, color: "#93c5fd", margin: 0 }}>사진을 끌어 옮기고, 두 손가락으로 확대하세요.</p>
                <button onClick={() => setGuides(!guides)} style={{ display: "inline-flex", alignItems: "center", gap: 4, background: guides ? "#16a34a" : "rgba(255,255,255,.1)", border: "none", borderRadius: 20, padding: "4px 10px", color: "#fff", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                  <Grid2x2 size={12} /> 정렬선 {guides ? "끄기" : "켜기"}
                </button>
              </div>
            )}
          </div>
          {needConsent && (
            <label style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 13, color: "#334155", background: "#fff7ed", border: "1px solid #fdba74", borderRadius: 10, padding: "10px 12px" }}>
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} style={{ width: 18, height: 18, marginTop: 1, accentColor: "#ea580c", flexShrink: 0 }} />
              <span>사진 속 회원에게 <b>사진 사용 동의</b>를 받았습니다. (실제 회원 사례 문구를 쓰려면 필요합니다)</span>
            </label>
          )}
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={save} disabled={!canExport} style={{ flex: 2, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "14px", borderRadius: 12, border: "none", background: canExport ? "#2563eb" : "#cbd5e1", color: "#fff", fontSize: 15, fontWeight: 700, cursor: canExport ? "pointer" : "not-allowed" }}><Download size={16} /> 이미지 저장</button>
            <button onClick={share} disabled={!canExport} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "14px", borderRadius: 12, border: "1px solid #e2e8f0", background: "#fff", color: canExport ? "#2563eb" : "#94a3b8", fontSize: 15, fontWeight: 700, cursor: canExport ? "pointer" : "not-allowed" }}><Share2 size={16} /> 공유</button>
          </div>
          <p style={{ fontSize: 12, color: msg ? "#16a34a" : "#64748b", margin: 0, minHeight: 18 }}>
            {msg || (!ready ? "비포·애프터 사진을 모두 올리면 저장할 수 있습니다." : needConsent && !consent ? "사진 사용 동의를 체크하면 저장할 수 있습니다." : "결과는 운동 경과를 보여주는 자료이며 의학적 진단이 아닙니다.")}
          </p>
        </section>
      </main>
    </div>
  );
}
