import { useState, useEffect, useRef } from "react";
import { Printer, Share2, RotateCcw, Check } from "lucide-react";

const _CT_SB_URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? "";
const _CT_SB_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ?? "";
const _CT_HDR = () => ({ "Content-Type": "application/json", apikey: _CT_SB_KEY, Authorization: `Bearer ${_CT_SB_KEY}` });
function _ctToday() { return new Date().toISOString().slice(0, 10).replace(/-/g, ""); }
async function ctInc(key: string) {
  if (!_CT_SB_URL || !_CT_SB_KEY) return;
  try {
    await fetch(`${_CT_SB_URL}/rest/v1/rpc/dp_inc_counter`, {
      method: "POST", headers: _CT_HDR(),
      body: JSON.stringify({ p_key: key }),
    });
  } catch {}
}

function qp(key: string) {
  return new URLSearchParams(window.location.search).get(key) ?? "";
}
function fmt(v: string) {
  const n = Number(v.replace(/,/g, ""));
  return isNaN(n) || v === "" ? (v || "—") : n.toLocaleString() + "원";
}

const DEFAULT_TERMS = [
  { no: "제1조", title: "이용 목적",     body: "회원은 본 센터의 시설 및 서비스를 건강 증진 및 체력 향상의 목적으로만 이용하여야 하며, 타인에게 방해가 되는 행위를 하여서는 아니 됩니다." },
  { no: "제2조", title: "환불 규정",     body: "등록 후 7일 이내 미이용 시 전액 환불이 가능합니다. 이용 개시 후에는 소비자보호법 및 공정거래위원회 지침에 따라 잔여 기간에 대한 비례 환불이 적용됩니다. 단, 회원의 귀책사유로 인한 중도 해지 시 위약금이 발생할 수 있습니다." },
  { no: "제3조", title: "시설 이용 규칙", body: "회원은 센터 내 기구 및 시설을 지정된 방법으로 사용하여야 하며, 사용 후 정리정돈을 철저히 하여야 합니다. 운동복 및 운동화 착용은 필수이며, 타인을 배려하는 에티켓을 준수하여야 합니다." },
  { no: "제4조", title: "부상 및 사고",  body: "운동 중 발생하는 부상에 대하여 회원은 사전에 본인의 건강 상태를 확인하고 무리한 운동을 자제하여야 합니다. 센터는 회원의 안전을 위해 최선을 다하나, 회원의 과실로 인한 부상에 대해서는 책임을 지지 않습니다." },
  { no: "제5조", title: "개인 용품 및 귀중품", body: "센터 내 귀중품 분실에 대하여 센터는 책임을 지지 않습니다. 귀중품은 반드시 사물함에 보관하시고, 분실 방지를 위해 개인 관리를 철저히 하여 주시기 바랍니다." },
  { no: "제6조", title: "계약 변경 및 양도", body: "본 계약의 내용을 변경하거나 회원권을 타인에게 양도하고자 할 경우에는 센터 운영자와 협의하여 서면으로 처리하여야 합니다. 무단 양도 시 계약이 해지될 수 있습니다." },
];

function loadTerms() {
  try {
    const saved = localStorage.getItem("ct_terms");
    if (saved) {
      const parsed = JSON.parse(saved) as { title: string; body: string }[];
      if (Array.isArray(parsed) && parsed.length === DEFAULT_TERMS.length) {
        return DEFAULT_TERMS.map((d, i) => ({
          no: d.no,
          title: parsed[i].title || d.title,
          body:  parsed[i].body  || d.body,
        }));
      }
    }
  } catch {}
  return DEFAULT_TERMS;
}

const TERMS = loadTerms();

export default function ContractPrint() {
  const name         = qp("name");
  const phone        = qp("phone");
  const contractDate = qp("contractDate");
  const type         = qp("type");
  const program      = qp("program");
  const listPrice    = qp("listPrice");
  const discount     = qp("discount");
  const paidAmount   = qp("paidAmount");
  const unpaid       = qp("unpaid");
  const payMethod    = qp("payMethod");
  const payDate      = qp("payDate");
  const startDate    = qp("startDate");
  const adConsent    = qp("adConsent");
  const urlSig       = qp("sig");
  const center       = qp("center") || "FIT STEP";
  const trainer      = qp("trainer");

  const [copied, setCopied]           = useState(false);
  const [hasSig, setHasSig]           = useState(false);
  const [confirmed, setConfirmed]     = useState(false);
  const [capturedSig, setCapturedSig] = useState<string>("");

  const sigPadRef  = useRef<HTMLCanvasElement>(null);
  const isDrawing  = useRef(false);
  const lastPos    = useRef({ x: 0, y: 0 });

  /* ── setup canvas context & load URL sig ── */
  useEffect(() => {
    const canvas = sigPadRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.strokeStyle = "#1e293b";
    ctx.lineWidth   = 2.5;
    ctx.lineCap     = "round";
    ctx.lineJoin    = "round";
    ctx.fillStyle   = "#1e293b";

    if (urlSig.startsWith("data:image")) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        setHasSig(true);
      };
      img.src = urlSig;
    }
  }, []);

  /* ── touch events (non-passive to allow preventDefault) ── */
  useEffect(() => {
    const canvas = sigPadRef.current;
    if (!canvas) return;

    function pos(e: TouchEvent) {
      const rect  = canvas!.getBoundingClientRect();
      const t     = e.touches[0];
      return {
        x: (t.clientX - rect.left) * (canvas!.width  / rect.width),
        y: (t.clientY - rect.top)  * (canvas!.height / rect.height),
      };
    }

    function onStart(e: TouchEvent) {
      e.preventDefault();
      const p  = pos(e);
      isDrawing.current = true;
      lastPos.current   = p;
      const ctx = canvas!.getContext("2d")!;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 1.5, 0, Math.PI * 2);
      ctx.fill();
      setHasSig(true);
      setConfirmed(false);
    }
    function onMove(e: TouchEvent) {
      e.preventDefault();
      if (!isDrawing.current) return;
      const p   = pos(e);
      const ctx = canvas!.getContext("2d")!;
      ctx.beginPath();
      ctx.moveTo(lastPos.current.x, lastPos.current.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      lastPos.current = p;
    }
    function onEnd(e: TouchEvent) {
      e.preventDefault();
      isDrawing.current = false;
    }

    canvas.addEventListener("touchstart", onStart, { passive: false });
    canvas.addEventListener("touchmove",  onMove,  { passive: false });
    canvas.addEventListener("touchend",   onEnd,   { passive: false });
    return () => {
      canvas.removeEventListener("touchstart", onStart);
      canvas.removeEventListener("touchmove",  onMove);
      canvas.removeEventListener("touchend",   onEnd);
    };
  }, []);

  /* ── mouse helpers ── */
  function mpos(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = sigPadRef.current!;
    const rect   = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (canvas.width  / rect.width),
      y: (e.clientY - rect.top)  * (canvas.height / rect.height),
    };
  }
  function onMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
    isDrawing.current = true;
    const p = mpos(e);
    lastPos.current = p;
    const ctx = sigPadRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.beginPath(); ctx.arc(p.x, p.y, 1.5, 0, Math.PI * 2); ctx.fill();
    setHasSig(true); setConfirmed(false);
  }
  function onMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!isDrawing.current) return;
    const p   = mpos(e);
    const ctx = sigPadRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.beginPath(); ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(p.x, p.y); ctx.stroke();
    lastPos.current = p;
  }
  function onMouseUp() { isDrawing.current = false; }

  function clearSig() {
    const canvas = sigPadRef.current;
    if (!canvas) return;
    canvas.getContext("2d")!.clearRect(0, 0, canvas.width, canvas.height);
    setHasSig(false); setConfirmed(false); setCapturedSig("");
  }

  function confirmSig() {
    const canvas = sigPadRef.current;
    if (!canvas || !hasSig) return;
    setCapturedSig(canvas.toDataURL("image/png"));
    setConfirmed(true);
  }

  useEffect(() => {
    if (!sessionStorage.getItem("ct-visited")) {
      sessionStorage.setItem("ct-visited", "1");
      ctInc("ct_vc"); ctInc(`ct_vt_${_ctToday()}`);
    }
  }, []);

  async function handleShare() {
    ctInc("ct_sc"); ctInc(`ct_st_${_ctToday()}`);
    const url   = window.location.href;
    const title = name ? `${name} 회원 계약서` : "회원 계약서";
    if (navigator.share) { try { await navigator.share({ title, text: title, url }); } catch {} }
    else {
      await navigator.clipboard.writeText(url);
      setCopied(true); setTimeout(() => setCopied(false), 2000);
    }
  }

  const unpaidNum = Number(unpaid.replace(/,/g, ""));

  const S = {
    wrap: { maxWidth: 820, margin: "0 auto", padding: "24px 20px", fontFamily: "'Noto Sans KR', sans-serif" },
    doc:  { background: "#fff", border: "1px solid #d1d5db", borderRadius: 8, padding: "48px 52px" },
    h2:   { fontSize: 14, fontWeight: 700, margin: "0 0 10px", color: "#1e293b", borderLeft: "3px solid #059669", paddingLeft: 8 } as React.CSSProperties,
    tbl:  { width: "100%", borderCollapse: "collapse" as const, marginBottom: 22, fontSize: 13 },
    th:   { background: "#f1f5f9", fontWeight: 600, padding: "8px 12px", border: "1px solid #cbd5e1", width: 120, textAlign: "left" as const, color: "#374151" },
    td:   { padding: "8px 12px", border: "1px solid #cbd5e1", color: "#1e293b" },
    box:  { border: "1px solid #cbd5e1", borderRadius: 6, padding: "14px 18px", marginBottom: 20, background: "#f8fafc", fontSize: 12, color: "#475569", lineHeight: 1.8 as const },
  };

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .sig-pad-wrap { display: none !important; }
          .sig-print { display: block !important; }
          body { background: #fff !important; margin: 0; }
          .contract-wrap { padding: 0 !important; max-width: none !important; }
          .contract-doc  { border: none !important; border-radius: 0 !important; padding: 32px 40px !important; }
        }
        .sig-print { display: none; }
        @page { size: A4; margin: 10mm; }
      `}</style>

      {/* Action bar */}
      <div className="no-print" style={{ background: "#1e293b", padding: "12px 20px", display: "flex", gap: 10, justifyContent: "flex-end", position: "sticky", top: 0, zIndex: 10 }}>
        <button onClick={() => window.print()} style={{ display: "flex", alignItems: "center", gap: 6, background: "#059669", border: "none", borderRadius: 8, padding: "10px 20px", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
          <Printer size={16} /> 인쇄 / PDF 저장
        </button>
        <button onClick={handleShare} style={{ display: "flex", alignItems: "center", gap: 6, background: copied ? "#065f46" : "#334155", border: "none", borderRadius: 8, padding: "10px 20px", color: copied ? "#34d399" : "#94a3b8", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
          <Share2 size={16} /> {copied ? "링크 복사됨!" : "공유하기"}
        </button>
      </div>

      <div className="contract-wrap" style={S.wrap}>
        <div className="contract-doc" style={S.doc}>

          {/* Header */}
          <div style={{ textAlign: "center", marginBottom: 36, borderBottom: "2px solid #1e293b", paddingBottom: 22 }}>
            <p style={{ color: "#059669", fontSize: 11, fontWeight: 800, letterSpacing: "0.2em", margin: "0 0 6px" }}>FIT STEP</p>
            <h1 style={{ fontSize: 28, fontWeight: 800, margin: "0 0 6px", color: "#0f172a", letterSpacing: "0.05em" }}>회 원 계 약 서</h1>
            <p style={{ color: "#64748b", fontSize: 13, margin: 0 }}>{center}</p>
          </div>

          {/* 회원 정보 */}
          <h2 style={S.h2}>회원 정보</h2>
          <table style={S.tbl}><tbody>
            <tr>
              <th style={S.th}>성명</th><td style={S.td}>{name || "—"}</td>
              <th style={S.th}>연락처</th><td style={S.td}>{phone || "—"}</td>
            </tr>
            <tr>
              <th style={S.th}>계약일</th><td style={S.td}>{contractDate || "—"}</td>
              <th style={S.th}>담당 운동전문가</th><td style={S.td}>{trainer || "—"}</td>
            </tr>
          </tbody></table>

          {/* 등록 내역 */}
          <h2 style={S.h2}>등록 내역</h2>
          <table style={S.tbl}><tbody>
            <tr>
              <th style={S.th}>구분</th><td style={S.td}>{type || "—"}</td>
              <th style={S.th}>프로그램</th><td style={S.td}>{program || "—"}</td>
            </tr>
            <tr>
              <th style={S.th}>정가</th><td style={S.td}>{fmt(listPrice)}</td>
              <th style={S.th}>할인</th><td style={S.td}>{fmt(discount)}</td>
            </tr>
            <tr>
              <th style={S.th}>실결제</th>
              <td style={{ ...S.td, fontWeight: 700, color: "#059669" }}>{fmt(paidAmount)}</td>
              <th style={S.th}>미수금</th>
              <td style={{ ...S.td, color: unpaidNum > 0 ? "#dc2626" : "inherit", fontWeight: unpaidNum > 0 ? 700 : 400 }}>{fmt(unpaid)}</td>
            </tr>
            <tr>
              <th style={S.th}>결제방법</th><td style={S.td}>{payMethod || "—"}</td>
              <th style={S.th}>결제일</th><td style={S.td}>{payDate || "—"}</td>
            </tr>
            <tr>
              <th style={S.th}>시작일</th><td style={S.td} colSpan={3}>{startDate || "—"}</td>
            </tr>
          </tbody></table>

          {/* 이용약관 */}
          <h2 style={S.h2}>센터 이용약관</h2>
          <div style={S.box}>
            {TERMS.map((t) => (
              <div key={t.no} style={{ marginBottom: 10 }}>
                <p style={{ fontSize: 12, fontWeight: 700, margin: "0 0 2px", color: "#1e293b" }}>{t.no} ({t.title})</p>
                <p style={{ fontSize: 12, margin: 0, lineHeight: 1.7, color: "#475569" }}>{t.body}</p>
              </div>
            ))}
          </div>

          {/* 개인정보 동의 */}
          <h2 style={S.h2}>개인정보 수집·이용 동의서</h2>
          <div style={S.box}>
            <p style={{ margin: "0 0 10px" }}>본 센터는 회원 서비스 제공을 위해 아래와 같이 개인정보를 수집·이용합니다.</p>
            <table style={{ ...S.tbl, marginBottom: 10 }}><thead>
              <tr>
                <th style={{ ...S.th, background: "#e2e8f0", width: "auto" }}>수집 항목</th>
                <th style={{ ...S.th, background: "#e2e8f0", width: "auto" }}>수집 목적</th>
                <th style={{ ...S.th, background: "#e2e8f0", width: "auto" }}>보유 기간</th>
              </tr>
            </thead><tbody>
              <tr>
                <td style={S.td}>성명, 연락처, 계약 내역</td>
                <td style={S.td}>회원 관리, 계약 이행</td>
                <td style={S.td}>계약 종료 후 1년</td>
              </tr>
            </tbody></table>
            <p style={{ margin: "0 0 8px", fontSize: 11, color: "#64748b" }}>
              ※ 위 개인정보 수집·이용에 동의하지 않을 권리가 있으나, 동의 거부 시 서비스 제공이 제한될 수 있습니다.
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ display: "inline-block", width: 14, height: 14, border: "2px solid #1e293b", borderRadius: 2, background: "#1e293b", flexShrink: 0 }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: "#1e293b" }}>동의함 (필수)</span>
            </div>
          </div>

          {/* 광고성 정보 동의 */}
          <h2 style={S.h2}>광고성 정보 수신 동의서 <span style={{ fontSize: 11, fontWeight: 400, color: "#94a3b8" }}>(선택)</span></h2>
          <div style={S.box}>
            <p style={{ margin: "0 0 12px" }}>본 센터의 이벤트, 프로모션, 건강 정보 등 광고성 정보를 SMS·카카오톡 등을 통해 수신하는 것에 동의합니다.</p>
            <div style={{ display: "flex", gap: 24 }}>
              {[{ val: "yes", label: "동의함", col: "#059669" }, { val: "no", label: "동의하지 않음", col: "#475569" }].map(({ val, label, col }) => (
                <div key={val} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ display: "inline-block", width: 15, height: 15, border: `2px solid ${adConsent === val ? col : "#cbd5e1"}`, borderRadius: 2, background: adConsent === val ? col : "#fff", flexShrink: 0 }} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: adConsent === val ? col : "#94a3b8" }}>{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ── 서명란 ── */}
          <h2 style={S.h2}>서명</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 32 }}>

            {/* 회원 서명 */}
            <div style={{ border: "1px solid #cbd5e1", borderRadius: 8, padding: "14px 16px" }}>
              <p style={{ fontSize: 12, color: "#64748b", margin: "0 0 8px", fontWeight: 600 }}>회원 서명</p>

              {/* 서명 패드 (화면 전용) */}
              <div className="sig-pad-wrap">
                <canvas
                  ref={sigPadRef}
                  width={500} height={140}
                  onMouseDown={onMouseDown}
                  onMouseMove={onMouseMove}
                  onMouseUp={onMouseUp}
                  onMouseLeave={onMouseUp}
                  style={{
                    width: "100%", height: 140,
                    border: confirmed ? "1.5px solid #059669" : "1.5px dashed #94a3b8",
                    borderRadius: 6,
                    background: "#fafafa",
                    cursor: "crosshair",
                    touchAction: "none",
                    display: "block",
                  }}
                />
                {/* 안내 텍스트 (서명 전) */}
                {!hasSig && (
                  <p style={{ fontSize: 11, color: "#94a3b8", margin: "6px 0 0", textAlign: "center" }}>
                    손가락 또는 마우스로 서명해 주세요
                  </p>
                )}
                {/* 버튼 */}
                <div className="no-print" style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <button
                    onClick={clearSig}
                    style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 5, background: "#f1f5f9", border: "1px solid #cbd5e1", borderRadius: 6, padding: "7px 0", fontSize: 12, color: "#64748b", cursor: "pointer", fontWeight: 600 }}
                  >
                    <RotateCcw size={12} /> 지우기
                  </button>
                  <button
                    onClick={confirmSig}
                    disabled={!hasSig}
                    style={{ flex: 2, display: "flex", alignItems: "center", justifyContent: "center", gap: 5, background: hasSig ? "#059669" : "#e2e8f0", border: "none", borderRadius: 6, padding: "7px 0", fontSize: 12, color: hasSig ? "#fff" : "#94a3b8", cursor: hasSig ? "pointer" : "not-allowed", fontWeight: 700 }}
                  >
                    <Check size={12} /> {confirmed ? "서명 완료 ✓" : "서명 확인"}
                  </button>
                </div>
              </div>

              {/* 인쇄용 서명 이미지 */}
              <div className="sig-print" style={{ minHeight: 100, display: "flex", alignItems: "center", justifyContent: "center", borderBottom: "1px solid #94a3b8", paddingBottom: 8, marginBottom: 8 }}>
                {capturedSig ? (
                  <img src={capturedSig} alt="서명" style={{ maxWidth: "100%", maxHeight: 100, objectFit: "contain" }} />
                ) : urlSig.startsWith("data:image") ? (
                  <img src={urlSig} alt="서명" style={{ maxWidth: "100%", maxHeight: 100, objectFit: "contain" }} />
                ) : null}
              </div>

              <p style={{ fontSize: 13, color: "#1e293b", margin: "8px 0 0", textAlign: "center" }}>{name || ""}</p>
            </div>

            {/* 운동전문가 */}
            <div style={{ border: "1px solid #cbd5e1", borderRadius: 8, padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>담당 운동전문가</span>
              <span style={{ fontSize: 15, fontWeight: 700, color: "#1e293b" }}>{trainer || "—"}</span>
            </div>
          </div>

          {/* Footer */}
          <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: 16, textAlign: "center" }}>
            <p style={{ fontSize: 12, color: "#94a3b8", margin: 0 }}>
              본 계약서는 {contractDate || "____년 __월 __일"}에 작성되었습니다. &nbsp;·&nbsp; {center}
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

