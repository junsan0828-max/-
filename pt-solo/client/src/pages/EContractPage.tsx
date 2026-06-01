import { useRef, useState, useEffect } from "react";
import { useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { Check, PenLine, RotateCcw, ChevronDown, ChevronUp, Loader2, Download } from "lucide-react";

function SignatureCanvas({ onSave }: { onSave: (png: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [hasStroke, setHasStroke] = useState(false);

  function getPos(e: MouseEvent | TouchEvent, canvas: HTMLCanvasElement) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const src = "touches" in e ? e.touches[0] : e;
    return { x: (src.clientX - rect.left) * scaleX, y: (src.clientY - rect.top) * scaleY };
  }

  function start(e: MouseEvent | TouchEvent) {
    e.preventDefault();
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const pos = getPos(e, canvas);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    drawing.current = true;
  }

  function move(e: MouseEvent | TouchEvent) {
    if (!drawing.current) return;
    e.preventDefault();
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#111";
    const pos = getPos(e, canvas);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    setHasStroke(true);
  }

  function end() { drawing.current = false; }

  function clear() {
    const canvas = canvasRef.current!;
    canvas.getContext("2d")!.clearRect(0, 0, canvas.width, canvas.height);
    setHasStroke(false);
  }

  function save() {
    if (!hasStroke) return;
    onSave(canvasRef.current!.toDataURL("image/png"));
  }

  useEffect(() => {
    const canvas = canvasRef.current!;
    canvas.addEventListener("mousedown", start);
    canvas.addEventListener("mousemove", move);
    canvas.addEventListener("mouseup", end);
    canvas.addEventListener("touchstart", start, { passive: false });
    canvas.addEventListener("touchmove", move, { passive: false });
    canvas.addEventListener("touchend", end);
    return () => {
      canvas.removeEventListener("mousedown", start);
      canvas.removeEventListener("mousemove", move);
      canvas.removeEventListener("mouseup", end);
      canvas.removeEventListener("touchstart", start);
      canvas.removeEventListener("touchmove", move);
      canvas.removeEventListener("touchend", end);
    };
  }, []);

  return (
    <div className="space-y-2">
      <div className="border-2 border-dashed border-gray-300 rounded-xl overflow-hidden bg-white relative">
        <canvas ref={canvasRef} width={600} height={200} className="w-full h-36 touch-none block" />
        <p className="absolute bottom-2 left-0 right-0 text-center text-[10px] text-gray-300 pointer-events-none">서명란</p>
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={clear}
          className="flex items-center gap-1.5 text-xs text-gray-500 border border-gray-200 rounded-lg px-3 py-2 hover:bg-gray-50">
          <RotateCcw className="h-3.5 w-3.5" /> 다시 쓰기
        </button>
        <button type="button" onClick={save} disabled={!hasStroke}
          className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold bg-gray-900 text-white rounded-lg px-3 py-2 disabled:opacity-40">
          <PenLine className="h-3.5 w-3.5" /> 서명 완료
        </button>
      </div>
    </div>
  );
}

function TermsSection({ title, content, agreed, onToggle, required }: {
  title: string; content: string; agreed: boolean; onToggle: () => void; required: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <button type="button" onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 text-left">
        <span className="text-sm font-semibold text-gray-700">
          {required ? <span className="text-red-500 mr-1">[필수]</span> : <span className="text-gray-400 mr-1">[선택]</span>}
          {title}
        </span>
        {open ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
      </button>
      {open && (
        <pre className="px-4 py-3 text-xs text-gray-600 leading-relaxed whitespace-pre-wrap font-sans border-t border-gray-100 max-h-48 overflow-y-auto bg-white">
          {content}
        </pre>
      )}
      <button type="button" onClick={onToggle}
        className={`w-full flex items-center gap-2 px-4 py-3 border-t border-gray-100 text-sm transition-colors ${agreed ? "bg-blue-50 text-blue-700" : "bg-white text-gray-500 hover:bg-gray-50"}`}>
        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors flex-shrink-0 ${agreed ? "bg-blue-600 border-blue-600" : "border-gray-300"}`}>
          {agreed && <Check className="h-3 w-3 text-white" />}
        </div>
        동의합니다
      </button>
    </div>
  );
}

type SubmittedInfo = {
  memberName: string;
  memberPhone: string;
  memberBirth: string;
  signerName: string;
  signaturePng: string;
  agreedMarketing: boolean;
  signedAt: string;
};

function rrect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

async function buildContractImage(
  trainerName: string,
  programName: string | null | undefined,
  programPrice: number | null | undefined,
  programSessions: number | null | undefined,
  programStartDate: string | null | undefined,
  trainerMemo: string | null | undefined,
  submitted: SubmittedInfo,
): Promise<string> {
  const W = 794;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = 1800;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, canvas.height);

  const PAD = 52;
  let y = 0;

  // Header background
  ctx.fillStyle = "#f9fafb";
  ctx.fillRect(0, 0, W, 116);
  ctx.strokeStyle = "#e5e7eb";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, 116);
  ctx.lineTo(W, 116);
  ctx.stroke();

  y = 46;
  ctx.fillStyle = "#111827";
  ctx.font = `bold 22px sans-serif`;
  ctx.textAlign = "center";
  ctx.fillText(`${trainerName} 트레이너`, W / 2, y);
  y += 32;
  ctx.font = `bold 17px sans-serif`;
  ctx.letterSpacing = "4px";
  ctx.fillText("회 원 계 약 서", W / 2, y);
  ctx.letterSpacing = "0px";
  y += 36;

  // Section renderer
  function sectionTitle(title: string) {
    ctx.fillStyle = "#111827";
    ctx.font = `bold 13px sans-serif`;
    ctx.textAlign = "left";
    ctx.fillText(title, PAD, y);
    y += 12;
    ctx.strokeStyle = "#e5e7eb";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(PAD, y);
    ctx.lineTo(W - PAD, y);
    ctx.stroke();
    y += 16;
  }

  function infoRow(label: string, value: string) {
    ctx.fillStyle = "#9ca3af";
    ctx.font = `11px sans-serif`;
    ctx.textAlign = "left";
    ctx.fillText(label, PAD, y);
    ctx.fillStyle = "#111827";
    ctx.font = `bold 13px sans-serif`;
    ctx.fillText(value, PAD + 120, y);
    y += 28;
  }

  // Member info
  sectionTitle("■  회원 정보");
  infoRow("이름", submitted.memberName || "—");
  infoRow("연락처", submitted.memberPhone || "—");
  if (submitted.memberBirth) infoRow("생년월일", submitted.memberBirth);
  y += 8;

  // Program info
  const hasProg = programName || programPrice != null || programSessions != null;
  if (hasProg) {
    sectionTitle("■  프로그램 정보");
    if (programName) infoRow("프로그램명", programName);
    if (programPrice != null) infoRow("금액", `${programPrice.toLocaleString()}원`);
    if (programSessions != null) infoRow("횟수", `${programSessions}회`);
    if (programStartDate) infoRow("시작일", programStartDate);
    if (trainerMemo) infoRow("메모", trainerMemo);
    y += 8;
  }

  // Agreements
  sectionTitle("■  약관 동의");
  const agreements = [
    { label: "(필수) 이용약관 동의", agreed: true },
    { label: "(필수) 개인정보 수집·이용 동의", agreed: true },
    { label: "(선택) 마케팅 정보 수신 동의", agreed: submitted.agreedMarketing },
  ];
  for (const ag of agreements) {
    rrect(ctx, PAD, y - 13, 16, 16, 3);
    ctx.fillStyle = ag.agreed ? "#2563eb" : "#f3f4f6";
    ctx.fill();
    ctx.strokeStyle = ag.agreed ? "#2563eb" : "#d1d5db";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    if (ag.agreed) {
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(PAD + 3, y - 5);
      ctx.lineTo(PAD + 7, y - 1);
      ctx.lineTo(PAD + 13, y - 10);
      ctx.stroke();
    }
    ctx.fillStyle = "#374151";
    ctx.font = `13px sans-serif`;
    ctx.textAlign = "left";
    ctx.fillText(ag.label, PAD + 26, y);
    y += 28;
  }
  y += 16;

  // Divider
  ctx.strokeStyle = "#d1d5db";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(PAD, y);
  ctx.lineTo(W - PAD, y);
  ctx.stroke();
  y += 22;

  // Consent statement
  ctx.fillStyle = "#4b5563";
  ctx.font = `12px sans-serif`;
  ctx.textAlign = "center";
  ctx.fillText("본인은 위 약관의 내용을 충분히 읽고 이해하였으며, 이에 동의하여 서명합니다.", W / 2, y);
  y += 34;

  // Date / Signer rows
  ctx.textAlign = "left";
  ctx.fillStyle = "#9ca3af";
  ctx.font = `11px sans-serif`;
  ctx.fillText("계약일", PAD, y);
  ctx.fillStyle = "#111827";
  ctx.font = `bold 13px sans-serif`;
  ctx.fillText(submitted.signedAt, PAD + 120, y);
  y += 28;

  ctx.fillStyle = "#9ca3af";
  ctx.font = `11px sans-serif`;
  ctx.fillText("서명자", PAD, y);
  ctx.fillStyle = "#111827";
  ctx.font = `bold 13px sans-serif`;
  ctx.fillText(submitted.signerName, PAD + 120, y);
  y += 28;

  // Signature box
  ctx.fillStyle = "#9ca3af";
  ctx.font = `11px sans-serif`;
  ctx.fillText("서명", PAD, y);

  const sigX = PAD + 120;
  const sigY = y - 14;
  const sigW = 260;
  const sigH = 96;

  if (submitted.signaturePng) {
    await new Promise<void>((resolve) => {
      const img = new Image();
      img.onload = () => { ctx.drawImage(img, sigX + 4, sigY + 4, sigW - 8, sigH - 8); resolve(); };
      img.onerror = () => resolve();
      img.src = submitted.signaturePng;
    });
  }
  rrect(ctx, sigX, sigY, sigW, sigH, 8);
  ctx.strokeStyle = "#d1d5db";
  ctx.lineWidth = 1;
  ctx.stroke();
  y += sigH + 16;

  // Bottom line (trainer signature line)
  ctx.strokeStyle = "#374151";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(PAD, y);
  ctx.lineTo(PAD + 280, y);
  ctx.stroke();
  y += 14;

  ctx.fillStyle = "#6b7280";
  ctx.font = `11px sans-serif`;
  ctx.textAlign = "left";
  ctx.fillText(`${trainerName} 트레이너 (서명/인)`, PAD, y);
  y += 30;

  // Footer
  ctx.strokeStyle = "#f3f4f6";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(PAD, y);
  ctx.lineTo(W - PAD, y);
  ctx.stroke();
  y += 18;

  ctx.fillStyle = "#9ca3af";
  ctx.font = `11px sans-serif`;
  ctx.textAlign = "center";
  ctx.fillText(`FIT STEP 비대면 전자계약  ·  ${submitted.signedAt}`, W / 2, y);
  y += 30;

  // Crop to content
  const out = document.createElement("canvas");
  out.width = W;
  out.height = y;
  out.getContext("2d")!.drawImage(canvas, 0, 0);
  return out.toDataURL("image/png");
}

export default function EContractPage() {
  const params = useParams<{ token: string }>();
  const token = params.token ?? "";
  const { data, isLoading, error } = trpc.eContract.getPublic.useQuery({ token }, { retry: false });
  const submitMutation = trpc.eContract.submit.useMutation();

  const [form, setForm] = useState({ memberName: "", memberPhone: "", memberBirth: "" });
  const [agreedTerms, setAgreedTerms] = useState(false);
  const [agreedPrivacy, setAgreedPrivacy] = useState(false);
  const [agreedMarketing, setAgreedMarketing] = useState(false);
  const [signerName, setSignerName] = useState("");
  const [signaturePng, setSignaturePng] = useState("");
  const [done, setDone] = useState(false);
  const [submittedInfo, setSubmittedInfo] = useState<SubmittedInfo | null>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (data) {
      setForm({
        memberName: data.memberName ?? "",
        memberPhone: data.memberPhone ?? "",
        memberBirth: data.memberBirth ?? "",
      });
    }
  }, [data]);

  if (isLoading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
    </div>
  );

  // already_signed from server (re-visit) — no download available
  if (error?.message === "already_signed" && !done) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-6">
      <div className="text-center space-y-3">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
          <Check className="h-8 w-8 text-green-600" />
        </div>
        <h1 className="text-lg font-bold text-gray-900">이미 서명된 계약서입니다</h1>
        <p className="text-sm text-gray-500">이미 서명이 완료된 계약서입니다.<br />이 창을 닫으셔도 됩니다.</p>
      </div>
    </div>
  );

  // Done after signing in this session — show download button
  if (done && submittedInfo) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-6">
      <div className="w-full max-w-sm space-y-6 text-center">
        <div className="space-y-3">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
            <Check className="h-8 w-8 text-green-600" />
          </div>
          <h1 className="text-lg font-bold text-gray-900">계약이 완료되었습니다</h1>
          <p className="text-sm text-gray-500">서명이 완료되어 저장되었습니다.</p>
        </div>

        {/* Contract summary card */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 text-left space-y-2">
          <p className="text-xs font-bold text-gray-500 mb-3">계약 내용 요약</p>
          {[
            ["트레이너", data?.trainerName],
            ["회원명", submittedInfo.memberName],
            ["연락처", submittedInfo.memberPhone],
            data?.programName ? ["프로그램", data.programName] : null,
            data?.programPrice != null ? ["금액", `${data.programPrice.toLocaleString()}원`] : null,
            data?.programSessions != null ? ["횟수", `${data.programSessions}회`] : null,
            ["계약일", submittedInfo.signedAt],
          ].filter((r): r is [string, string] => r !== null).map(([label, value]) => (
            <div key={label as string} className="flex justify-between text-sm">
              <span className="text-gray-400">{label as string}</span>
              <span className="font-semibold text-gray-900">{value as string}</span>
            </div>
          ))}
        </div>

        {/* Download button */}
        <button
          disabled={downloading}
          onClick={async () => {
            setDownloading(true);
            try {
              const dataUrl = await buildContractImage(
                data?.trainerName ?? "",
                data?.programName,
                data?.programPrice,
                data?.programSessions,
                data?.programStartDate,
                data?.trainerMemo,
                submittedInfo,
              );
              const a = document.createElement("a");
              a.download = `계약서_${submittedInfo.signerName}_${submittedInfo.signedAt.replace(/\./g, "")}.png`;
              a.href = dataUrl;
              a.click();
            } finally {
              setDownloading(false);
            }
          }}
          className="w-full flex items-center justify-center gap-2 bg-gray-900 text-white font-bold py-4 rounded-2xl text-sm disabled:opacity-60"
        >
          {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          {downloading ? "이미지 생성 중..." : "계약서 이미지 저장"}
        </button>
        <p className="text-xs text-gray-400">이 창을 닫으셔도 됩니다.</p>
      </div>
    </div>
  );

  if (error) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-6">
      <div className="text-center space-y-2">
        <p className="text-lg font-bold text-gray-900">계약서를 찾을 수 없습니다</p>
        <p className="text-sm text-gray-500">링크가 만료되었거나 올바르지 않습니다.</p>
      </div>
    </div>
  );

  if (!data) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!agreedTerms || !agreedPrivacy) return alert("필수 항목에 동의해주세요.");
    if (!signerName.trim()) return alert("서명자 이름을 입력해주세요.");
    if (!signaturePng) return alert("서명을 완성해주세요.");
    try {
      await submitMutation.mutateAsync({
        token,
        memberName: form.memberName,
        memberPhone: form.memberPhone,
        memberBirth: form.memberBirth,
        agreedTerms,
        agreedPrivacy,
        agreedMarketing,
        signerName,
        signaturePng,
      });
      setSubmittedInfo({
        memberName: form.memberName,
        memberPhone: form.memberPhone,
        memberBirth: form.memberBirth,
        signerName,
        signaturePng,
        agreedMarketing,
        signedAt: new Date().toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" }),
      });
      setDone(true);
    } catch (err: any) {
      alert(err?.message ?? "제출 중 오류가 발생했습니다.");
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* 헤더 */}
      <div className="bg-white border-b border-gray-200 px-5 py-4 sticky top-0 z-10">
        <p className="text-xs text-gray-400 font-medium">FIT STEP 전자계약</p>
        <h1 className="text-base font-bold text-gray-900 mt-0.5">{data.trainerName} 트레이너</h1>
      </div>

      <form onSubmit={handleSubmit} className="max-w-lg mx-auto px-5 pt-5 space-y-5">

        {/* 회원 정보 */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
          <h2 className="text-sm font-bold text-gray-900">회원 정보</h2>
          {[
            { label: "이름", key: "memberName", placeholder: "홍길동", type: "text" },
            { label: "연락처", key: "memberPhone", placeholder: "010-0000-0000", type: "tel" },
            { label: "생년월일", key: "memberBirth", placeholder: "1990-01-01", type: "text" },
          ].map(({ label, key, placeholder, type }) => (
            <div key={key} className="space-y-1">
              <label className="text-xs font-semibold text-gray-500">{label}</label>
              <input type={type} placeholder={placeholder}
                value={(form as any)[key]}
                onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-blue-400 bg-white" />
            </div>
          ))}
        </div>

        {/* 프로그램 정보 */}
        {(data.programName || data.programPrice || data.programSessions) && (
          <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-3">
            <h2 className="text-sm font-bold text-gray-900">프로그램 정보</h2>
            <div className="divide-y divide-gray-100">
              {[
                { label: "프로그램명", value: data.programName },
                { label: "금액", value: data.programPrice != null ? `${data.programPrice.toLocaleString()}원` : null },
                { label: "횟수", value: data.programSessions != null ? `${data.programSessions}회` : null },
                { label: "시작일", value: data.programStartDate },
              ].filter(r => r.value).map(({ label, value }) => (
                <div key={label} className="flex justify-between py-2.5">
                  <span className="text-xs text-gray-500">{label}</span>
                  <span className="text-xs font-semibold text-gray-900">{value}</span>
                </div>
              ))}
            </div>
            {data.trainerMemo && (
              <div className="bg-gray-50 rounded-xl px-4 py-3">
                <p className="text-xs text-gray-500 font-semibold mb-1">트레이너 메모</p>
                <p className="text-xs text-gray-700 leading-relaxed">{data.trainerMemo}</p>
              </div>
            )}
          </div>
        )}

        {/* 약관 동의 */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-3">
          <h2 className="text-sm font-bold text-gray-900">약관 동의</h2>
          <TermsSection title="이용약관" content={data.termsOfService} agreed={agreedTerms} onToggle={() => setAgreedTerms(v => !v)} required />
          <TermsSection title="개인정보 수집·이용 동의" content={data.privacyPolicy} agreed={agreedPrivacy} onToggle={() => setAgreedPrivacy(v => !v)} required />
          <TermsSection title="마케팅 자료활용 동의" content={data.marketingConsent} agreed={agreedMarketing} onToggle={() => setAgreedMarketing(v => !v)} required={false} />
        </div>

        {/* 서명 */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
          <h2 className="text-sm font-bold text-gray-900">서명</h2>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-500">서명자 이름</label>
            <input type="text" placeholder="본인 이름 입력" value={signerName}
              onChange={e => setSignerName(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-blue-400" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-500">서명</label>
            {signaturePng ? (
              <div className="space-y-2">
                <div className="border border-gray-200 rounded-xl overflow-hidden bg-white p-2">
                  <img src={signaturePng} className="w-full h-24 object-contain" />
                </div>
                <button type="button" onClick={() => setSignaturePng("")}
                  className="flex items-center gap-1.5 text-xs text-gray-500 border border-gray-200 rounded-lg px-3 py-2 hover:bg-gray-50">
                  <RotateCcw className="h-3.5 w-3.5" /> 다시 서명
                </button>
              </div>
            ) : (
              <SignatureCanvas onSave={setSignaturePng} />
            )}
          </div>
        </div>

        {/* 제출 */}
        <button type="submit" disabled={submitMutation.isPending}
          className="w-full bg-gray-900 text-white font-bold py-4 rounded-2xl text-sm disabled:opacity-50 flex items-center justify-center gap-2">
          {submitMutation.isPending ? <><Loader2 className="h-4 w-4 animate-spin" /> 제출 중...</> : "계약 완료 및 제출"}
        </button>
      </form>
    </div>
  );
}
