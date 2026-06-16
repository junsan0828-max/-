import { useState, useEffect } from "react";
import { Printer, Share2 } from "lucide-react";

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

const TERMS = [
  {
    no: "제1조",
    title: "이용 목적",
    body: "회원은 본 센터의 시설 및 서비스를 건강 증진 및 체력 향상의 목적으로만 이용하여야 하며, 타인에게 방해가 되는 행위를 하여서는 아니 됩니다.",
  },
  {
    no: "제2조",
    title: "환불 규정",
    body: "등록 후 7일 이내 미이용 시 전액 환불이 가능합니다. 이용 개시 후에는 소비자보호법 및 공정거래위원회 지침에 따라 잔여 기간에 대한 비례 환불이 적용됩니다. 단, 회원의 귀책사유로 인한 중도 해지 시 위약금이 발생할 수 있습니다.",
  },
  {
    no: "제3조",
    title: "시설 이용 규칙",
    body: "회원은 센터 내 기구 및 시설을 지정된 방법으로 사용하여야 하며, 사용 후 정리정돈을 철저히 하여야 합니다. 운동복 및 운동화 착용은 필수이며, 타인을 배려하는 에티켓을 준수하여야 합니다.",
  },
  {
    no: "제4조",
    title: "부상 및 사고",
    body: "운동 중 발생하는 부상에 대하여 회원은 사전에 본인의 건강 상태를 확인하고 무리한 운동을 자제하여야 합니다. 센터는 회원의 안전을 위해 최선을 다하나, 회원의 과실로 인한 부상에 대해서는 책임을 지지 않습니다.",
  },
  {
    no: "제5조",
    title: "개인 용품 및 귀중품",
    body: "센터 내 귀중품 분실에 대하여 센터는 책임을 지지 않습니다. 귀중품은 반드시 사물함에 보관하시고, 분실 방지를 위해 개인 관리를 철저히 하여 주시기 바랍니다.",
  },
  {
    no: "제6조",
    title: "계약 변경 및 양도",
    body: "본 계약의 내용을 변경하거나 회원권을 타인에게 양도하고자 할 경우에는 센터 운영자와 협의하여 서면으로 처리하여야 합니다. 무단 양도 시 계약이 해지될 수 있습니다.",
  },
];

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
  const adConsent    = qp("adConsent"); // "yes" | "no"
  const sig          = qp("sig");       // base64 image or text name
  const center       = qp("center") || "FIT STEP";
  const trainer      = qp("trainer");

  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!sessionStorage.getItem("ct-visited")) {
      sessionStorage.setItem("ct-visited", "1");
      ctInc("ct_vc");
      ctInc(`ct_vt_${_ctToday()}`);
    }
  }, []);

  async function handleShare() {
    ctInc("ct_sc");
    ctInc(`ct_st_${_ctToday()}`);
    const url = window.location.href;
    const title = name ? `${name} 회원 계약서` : "회원 계약서";
    if (navigator.share) {
      try { await navigator.share({ title, text: title, url }); } catch {}
    } else {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  const isSigImage = sig.startsWith("data:image");
  const unpaidNum = Number(unpaid.replace(/,/g, ""));

  /* ── inline styles ── */
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
          body { background: #fff !important; margin: 0; }
          .contract-wrap { padding: 0 !important; max-width: none !important; }
          .contract-doc { border: none !important; border-radius: 0 !important; padding: 32px 40px !important; }
        }
        @page { size: A4; margin: 10mm; }
      `}</style>

      {/* Action bar */}
      <div className="no-print" style={{ background: "#1e293b", padding: "12px 20px", display: "flex", gap: 10, justifyContent: "flex-end", position: "sticky", top: 0, zIndex: 10 }}>
        <button
          onClick={() => window.print()}
          style={{ display: "flex", alignItems: "center", gap: 6, background: "#059669", border: "none", borderRadius: 8, padding: "10px 20px", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer" }}
        >
          <Printer size={16} /> 인쇄 / PDF 저장
        </button>
        <button
          onClick={handleShare}
          style={{ display: "flex", alignItems: "center", gap: 6, background: copied ? "#065f46" : "#334155", border: "none", borderRadius: 8, padding: "10px 20px", color: copied ? "#34d399" : "#94a3b8", fontSize: 14, fontWeight: 700, cursor: "pointer" }}
        >
          <Share2 size={16} /> {copied ? "링크 복사됨!" : "공유하기"}
        </button>
      </div>

      {/* Contract document */}
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
          <table style={S.tbl}>
            <tbody>
              <tr>
                <th style={S.th}>성명</th>
                <td style={S.td}>{name || "—"}</td>
                <th style={S.th}>연락처</th>
                <td style={S.td}>{phone || "—"}</td>
              </tr>
              <tr>
                <th style={S.th}>계약일</th>
                <td style={S.td}>{contractDate || "—"}</td>
                <th style={S.th}>담당 트레이너</th>
                <td style={S.td}>{trainer || "—"}</td>
              </tr>
            </tbody>
          </table>

          {/* 등록 내역 */}
          <h2 style={S.h2}>등록 내역</h2>
          <table style={S.tbl}>
            <tbody>
              <tr>
                <th style={S.th}>구분</th>
                <td style={S.td}>{type || "—"}</td>
                <th style={S.th}>프로그램</th>
                <td style={S.td}>{program || "—"}</td>
              </tr>
              <tr>
                <th style={S.th}>정가</th>
                <td style={S.td}>{fmt(listPrice)}</td>
                <th style={S.th}>할인</th>
                <td style={S.td}>{fmt(discount)}</td>
              </tr>
              <tr>
                <th style={S.th}>실결제</th>
                <td style={{ ...S.td, fontWeight: 700, color: "#059669" }}>{fmt(paidAmount)}</td>
                <th style={S.th}>미수금</th>
                <td style={{ ...S.td, color: unpaidNum > 0 ? "#dc2626" : "inherit", fontWeight: unpaidNum > 0 ? 700 : 400 }}>{fmt(unpaid)}</td>
              </tr>
              <tr>
                <th style={S.th}>결제방법</th>
                <td style={S.td}>{payMethod || "—"}</td>
                <th style={S.th}>결제일</th>
                <td style={S.td}>{payDate || "—"}</td>
              </tr>
              <tr>
                <th style={S.th}>시작일</th>
                <td style={S.td} colSpan={3}>{startDate || "—"}</td>
              </tr>
            </tbody>
          </table>

          {/* 이용약관 */}
          <h2 style={S.h2}>센터 이용약관</h2>
          <div style={S.box}>
            {TERMS.map((t) => (
              <div key={t.no} style={{ marginBottom: 10 }}>
                <p style={{ fontSize: 12, fontWeight: 700, margin: "0 0 2px", color: "#1e293b" }}>
                  {t.no} ({t.title})
                </p>
                <p style={{ fontSize: 12, margin: 0, lineHeight: 1.7, color: "#475569" }}>{t.body}</p>
              </div>
            ))}
          </div>

          {/* 개인정보 동의 */}
          <h2 style={S.h2}>개인정보 수집·이용 동의서</h2>
          <div style={S.box}>
            <p style={{ margin: "0 0 10px" }}>
              본 센터는 회원 서비스 제공을 위해 아래와 같이 개인정보를 수집·이용합니다.
            </p>
            <table style={{ ...S.tbl, marginBottom: 10 }}>
              <thead>
                <tr>
                  <th style={{ ...S.th, background: "#e2e8f0", width: "auto" }}>수집 항목</th>
                  <th style={{ ...S.th, background: "#e2e8f0", width: "auto" }}>수집 목적</th>
                  <th style={{ ...S.th, background: "#e2e8f0", width: "auto" }}>보유 기간</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={S.td}>성명, 연락처, 계약 내역</td>
                  <td style={S.td}>회원 관리, 계약 이행</td>
                  <td style={S.td}>계약 종료 후 1년</td>
                </tr>
              </tbody>
            </table>
            <p style={{ margin: "0 0 8px", fontSize: 11, color: "#64748b" }}>
              ※ 위 개인정보 수집·이용에 동의하지 않을 권리가 있으나, 동의 거부 시 서비스 제공이 제한될 수 있습니다.
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ display: "inline-block", width: 14, height: 14, border: "2px solid #1e293b", borderRadius: 2, background: "#1e293b", flexShrink: 0 }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: "#1e293b" }}>동의함 (필수)</span>
            </div>
          </div>

          {/* 광고성 정보 수신 동의 */}
          <h2 style={S.h2}>광고성 정보 수신 동의서 <span style={{ fontSize: 11, fontWeight: 400, color: "#94a3b8" }}>(선택)</span></h2>
          <div style={S.box}>
            <p style={{ margin: "0 0 12px" }}>
              본 센터의 이벤트, 프로모션, 건강 정보 등 광고성 정보를 SMS·카카오톡 등을 통해 수신하는 것에 동의합니다.
            </p>
            <div style={{ display: "flex", gap: 24 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{
                  display: "inline-block", width: 15, height: 15,
                  border: `2px solid ${adConsent === "yes" ? "#059669" : "#cbd5e1"}`,
                  borderRadius: 2,
                  background: adConsent === "yes" ? "#059669" : "#fff",
                  flexShrink: 0,
                }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: adConsent === "yes" ? "#059669" : "#94a3b8" }}>동의함</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{
                  display: "inline-block", width: 15, height: 15,
                  border: `2px solid ${adConsent === "no" ? "#475569" : "#cbd5e1"}`,
                  borderRadius: 2,
                  background: adConsent === "no" ? "#475569" : "#fff",
                  flexShrink: 0,
                }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: adConsent === "no" ? "#64748b" : "#94a3b8" }}>동의하지 않음</span>
              </div>
            </div>
          </div>

          {/* 서명란 */}
          <h2 style={S.h2}>서명</h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 32 }}>
            {/* 회원 서명 */}
            <div style={{ border: "1px solid #cbd5e1", borderRadius: 8, padding: "16px 20px" }}>
              <p style={{ fontSize: 12, color: "#64748b", margin: "0 0 12px", fontWeight: 600 }}>회원 서명</p>
              <div style={{ minHeight: 90, display: "flex", alignItems: "center", justifyContent: "center", borderBottom: "1px solid #94a3b8", marginBottom: 10, padding: "0 0 8px" }}>
                {isSigImage ? (
                  <img src={sig} alt="서명" style={{ maxWidth: "100%", maxHeight: 90, objectFit: "contain" }} />
                ) : sig ? (
                  <span style={{ fontSize: 24, fontWeight: 700, color: "#1e293b", fontFamily: "Georgia, serif" }}>{sig}</span>
                ) : null}
              </div>
              <p style={{ fontSize: 13, color: "#1e293b", margin: 0, textAlign: "center" }}>{name || ""}</p>
            </div>

            {/* 트레이너 서명 */}
            <div style={{ border: "1px solid #cbd5e1", borderRadius: 8, padding: "16px 20px" }}>
              <p style={{ fontSize: 12, color: "#64748b", margin: "0 0 12px", fontWeight: 600 }}>담당 트레이너</p>
              <div style={{ minHeight: 90, borderBottom: "1px solid #94a3b8", marginBottom: 10 }} />
              <p style={{ fontSize: 13, color: "#1e293b", margin: 0, textAlign: "center" }}>{trainer || ""}</p>
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
