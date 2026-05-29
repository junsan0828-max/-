import { useRef, useState, useEffect } from "react";
import { useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { Check, PenLine, RotateCcw, ChevronDown, ChevronUp, Loader2 } from "lucide-react";

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

  if (error?.message === "already_signed" || done) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-6">
      <div className="text-center space-y-3">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
          <Check className="h-8 w-8 text-green-600" />
        </div>
        <h1 className="text-lg font-bold text-gray-900">계약이 완료되었습니다</h1>
        <p className="text-sm text-gray-500">서명이 완료되어 저장되었습니다.<br />이 창을 닫으셔도 됩니다.</p>
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
