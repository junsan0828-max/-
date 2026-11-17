import { useRef, useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import {
  Check, PenLine, RotateCcw, ChevronDown, ChevronUp, ChevronLeft, ChevronRight,
  Loader2, X, ShieldCheck,
} from "lucide-react";

// ─── 서명 캔버스 ──────────────────────────────────────────────────────────────
export function SignatureCanvas({ onSave }: { onSave: (png: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [hasStroke, setHasStroke] = useState(false);

  function getPos(e: MouseEvent | TouchEvent, canvas: HTMLCanvasElement) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const p = "touches" in e ? e.touches[0] : e;
    return { x: (p.clientX - rect.left) * scaleX, y: (p.clientY - rect.top) * scaleY };
  }

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;

    function start(e: MouseEvent | TouchEvent) {
      e.preventDefault();
      drawing.current = true;
      const pos = getPos(e, canvas);
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
    }
    function move(e: MouseEvent | TouchEvent) {
      if (!drawing.current) return;
      e.preventDefault();
      const pos = getPos(e, canvas);
      ctx.lineWidth = 2.5;
      ctx.lineCap = "round";
      ctx.strokeStyle = "#111827";
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
      setHasStroke(true);
    }
    function end() { drawing.current = false; }

    canvas.addEventListener("mousedown", start);
    canvas.addEventListener("mousemove", move);
    canvas.addEventListener("mouseup", end);
    canvas.addEventListener("mouseleave", end);
    canvas.addEventListener("touchstart", start, { passive: false });
    canvas.addEventListener("touchmove", move, { passive: false });
    canvas.addEventListener("touchend", end);
    return () => {
      canvas.removeEventListener("mousedown", start);
      canvas.removeEventListener("mousemove", move);
      canvas.removeEventListener("mouseup", end);
      canvas.removeEventListener("mouseleave", end);
      canvas.removeEventListener("touchstart", start);
      canvas.removeEventListener("touchmove", move);
      canvas.removeEventListener("touchend", end);
    };
  }, []);

  function clear() {
    const canvas = canvasRef.current!;
    canvas.getContext("2d")!.clearRect(0, 0, canvas.width, canvas.height);
    setHasStroke(false);
  }

  return (
    <div className="space-y-2">
      <div className="border-2 border-dashed border-gray-300 rounded-xl overflow-hidden bg-white relative">
        <canvas ref={canvasRef} width={600} height={200} className="w-full h-36 touch-none block" />
        {!hasStroke && (
          <p className="absolute bottom-2 left-0 right-0 text-center text-[10px] text-gray-300 pointer-events-none">
            이곳에 손가락 또는 마우스로 서명해주세요
          </p>
        )}
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={clear}
          className="flex items-center gap-1.5 text-xs text-gray-500 border border-gray-200 rounded-lg px-3 py-2 hover:bg-gray-50">
          <RotateCcw className="h-3.5 w-3.5" /> 다시 쓰기
        </button>
        <button type="button" onClick={() => onSave(canvasRef.current!.toDataURL("image/png"))}
          disabled={!hasStroke}
          className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold bg-gray-900 text-white rounded-lg px-3 py-2 disabled:opacity-40">
          <PenLine className="h-3.5 w-3.5" /> 서명 확정
        </button>
      </div>
    </div>
  );
}

// ─── 약관 아코디언 ────────────────────────────────────────────────────────────
export function TermsSection({ title, content, agreed, onToggle, required }: {
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

function InfoRow({ label, value }: { label: string; value?: string | number | null }) {
  if (value == null || value === "") return null;
  return (
    <div className="flex justify-between py-2.5">
      <span className="text-xs text-gray-500">{label}</span>
      <span className="text-xs font-semibold text-gray-900 text-right">{value}</span>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = "text" }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-semibold text-gray-500">{label}</label>
      <input type={type} placeholder={placeholder} value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full border border-gray-200 rounded-xl px-4 py-3 text-base no-ios-zoom outline-none focus:border-blue-400 bg-white" />
    </div>
  );
}

type StepKey = "content" | "terms" | "account" | "transferee" | "sign";

export type SignedInfo = {
  memberName: string;
  memberPhone: string;
  memberBirth: string;
  signerName: string;
  signaturePng: string;
  agreedMarketing: boolean;
  signedAt: string;
};

export default function ContractSignFlow({
  token, onClose, onSigned,
}: {
  token: string;
  onClose: () => void;
  onSigned?: (step: "transferor_signed" | "signed", info: SignedInfo) => void;
}) {
  const { data, isLoading, error } = trpc.eContract.getPublic.useQuery({ token });
  const submitMutation = trpc.eContract.submit.useMutation();

  const [stepIdx, setStepIdx] = useState(0);
  const [form, setForm] = useState({
    memberName: "", memberPhone: "", memberBirth: "",
    bankName: "", accountNumber: "", accountHolder: "",
  });
  const [agreedTerms, setAgreedTerms] = useState(false);
  const [agreedPrivacy, setAgreedPrivacy] = useState(false);
  const [agreedMarketing, setAgreedMarketing] = useState(false);
  const [signerName, setSignerName] = useState("");
  const [signaturePng, setSignaturePng] = useState("");
  const [err, setErr] = useState("");
  const bodyRef = useRef<HTMLDivElement>(null);

  // 트레이너가 미리 채워둔 값을 초기값으로
  useEffect(() => {
    if (!data) return;
    setForm(p => ({
      ...p,
      memberName: p.memberName || (data.memberName ?? ""),
      memberPhone: p.memberPhone || (data.memberPhone ?? ""),
      memberBirth: p.memberBirth || (data.memberBirth ?? ""),
    }));
  }, [data]);

  useEffect(() => { bodyRef.current?.scrollTo({ top: 0 }); setErr(""); }, [stepIdx]);

  if (isLoading || !data) {
    return (
      <Shell onClose={onClose}>
        <div className="py-20 flex justify-center">
          {error
            ? <p className="text-sm text-gray-500">계약서를 불러올 수 없습니다.</p>
            : <Loader2 className="h-5 w-5 animate-spin text-gray-400" />}
        </div>
      </Shell>
    );
  }

  const cType = data.contractType ?? "standard";
  const cStatus = data.status ?? "pending";
  const extra: any = data.extraData ?? {};
  const isTransferStep1 = cType === "transfer" && cStatus === "pending";
  const isTransferStep2 = cType === "transfer" && cStatus === "transferor_signed";

  const steps: { key: StepKey; label: string }[] =
    cType === "refund"
      ? [{ key: "content", label: "환불 내역" }, { key: "account", label: "환불 계좌" }, { key: "sign", label: "전자서명" }]
      : cType === "transfer"
        ? isTransferStep1
          ? [{ key: "content", label: "양도 내용" }, { key: "sign", label: "전자서명" }]
          : [{ key: "content", label: "양도 내용" }, { key: "transferee", label: "양수인 정보" }, { key: "sign", label: "전자서명" }]
        : [{ key: "content", label: "계약 내용" }, { key: "terms", label: "약관 동의" }, { key: "sign", label: "전자서명" }];

  const step = steps[stepIdx];
  const isLast = stepIdx === steps.length - 1;

  function validateStep(): string {
    if (step.key === "terms" && (!agreedTerms || !agreedPrivacy)) return "필수 약관에 동의해주세요.";
    if (step.key === "transferee") {
      if (!form.memberName.trim()) return "양수인 이름을 입력해주세요.";
      if (!form.memberPhone.trim()) return "양수인 연락처를 입력해주세요.";
    }
    if (step.key === "sign") {
      if (!signerName.trim()) return "서명자 이름을 입력해주세요.";
      if (!signaturePng) return "서명을 확정해주세요.";
    }
    return "";
  }

  function next() {
    const v = validateStep();
    if (v) return setErr(v);
    setStepIdx(i => i + 1);
  }

  async function submit() {
    const v = validateStep();
    if (v) return setErr(v);
    try {
      const result = await submitMutation.mutateAsync({
        token,
        memberName: form.memberName || undefined,
        memberPhone: form.memberPhone || undefined,
        memberBirth: form.memberBirth || undefined,
        agreedTerms: cType === "standard" ? agreedTerms : true,
        agreedPrivacy: cType === "standard" ? agreedPrivacy : true,
        agreedMarketing,
        signerName,
        signaturePng,
        bankName: form.bankName || undefined,
        accountNumber: form.accountNumber || undefined,
        accountHolder: form.accountHolder || undefined,
      });
      onSigned?.(result.step as "transferor_signed" | "signed", {
        memberName: form.memberName,
        memberPhone: form.memberPhone,
        memberBirth: form.memberBirth,
        signerName,
        signaturePng,
        agreedMarketing,
        signedAt: new Date().toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" }),
      });
    } catch (e: any) {
      setErr(e?.message ?? "제출 중 오류가 발생했습니다.");
    }
  }

  const title =
    cType === "refund" ? "환불 계약서" :
    cType === "transfer" ? (isTransferStep1 ? "양도양수 계약서 · 양도인" : "양도양수 계약서 · 양수인") :
    "비대면 전자계약";

  return (
    <Shell onClose={onClose}>
      {/* 헤더 */}
      <div className="shrink-0 px-5 pt-5 pb-3 border-b border-gray-100">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] text-gray-400 font-medium">FIT STEP · {data.trainerName} STEPER</p>
            <h2 className="text-base font-bold text-gray-900 mt-0.5 truncate">{title}</h2>
          </div>
          <button onClick={onClose} className="p-1 -mr-1 text-gray-400 shrink-0"><X className="h-5 w-5" /></button>
        </div>
        {/* 단계 표시 */}
        <div className="flex items-center gap-1.5 mt-3">
          {steps.map((s, i) => (
            <div key={s.key} className="flex-1 space-y-1">
              <div className={`h-1 rounded-full ${i <= stepIdx ? "bg-gray-900" : "bg-gray-200"}`} />
              <p className={`text-[10px] ${i === stepIdx ? "text-gray-900 font-semibold" : "text-gray-400"}`}>{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* 본문 */}
      <div ref={bodyRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-4 bg-gray-50">
        {step.key === "content" && (<>
          {cType === "refund" && (
            <Card title="환불 내역">
              <div className="divide-y divide-gray-100">
                <InfoRow label="프로그램명" value={data.programName} />
                <InfoRow label="결제 방법" value={extra.paymentMethod} />
                <InfoRow label="결제 금액" value={data.programPrice != null ? `${data.programPrice.toLocaleString()}원` : null} />
                <InfoRow label="총 횟수" value={data.programSessions != null ? `${data.programSessions}회` : null} />
                <InfoRow label="수강 횟수" value={extra.usedSessions != null ? `${extra.usedSessions}회` : null} />
                <InfoRow label="위약금" value={extra.penaltyAmount ? `${Number(extra.penaltyAmount).toLocaleString()}원` : null} />
                <InfoRow label="부가세" value={extra.vatAmount ? `${Number(extra.vatAmount).toLocaleString()}원` : null} />
              </div>
              {extra.refundAmount != null && (
                <div className="bg-blue-50 rounded-xl px-4 py-3 flex justify-between items-center">
                  <span className="text-sm font-semibold text-blue-900">환불 예정 금액</span>
                  <span className="text-base font-bold text-blue-700">{Number(extra.refundAmount).toLocaleString()}원</span>
                </div>
              )}
              {extra.refundReason && (
                <div className="bg-gray-50 rounded-xl px-4 py-3">
                  <p className="text-xs text-gray-500 font-semibold mb-1">환불 사유</p>
                  <p className="text-xs text-gray-700 leading-relaxed">{extra.refundReason}</p>
                </div>
              )}
            </Card>
          )}

          {cType === "transfer" && (<>
            <Card title="양도 정보">
              <div className="divide-y divide-gray-100">
                <InfoRow label="양도인" value={extra.transferorName} />
                <InfoRow label="양도인 연락처" value={extra.transferorPhone} />
                <InfoRow label="프로그램명" value={data.programName} />
                <InfoRow label="총 횟수" value={extra.totalSessions != null ? `${extra.totalSessions}회` : null} />
                <InfoRow label="수강 횟수" value={extra.usedSessions != null ? `${extra.usedSessions}회` : null} />
                <InfoRow label="잔여 횟수" value={extra.remainingSessions != null ? `${extra.remainingSessions}회` : null} />
                <InfoRow label="양도 예정일" value={extra.transferDate} />
              </div>
              {data.trainerMemo && <Memo text={data.trainerMemo} />}
            </Card>
            {isTransferStep2 && data.transferorSignaturePng && (
              <Card title="양도인 서명">
                <div className="bg-green-50 border border-green-200 rounded-xl p-3 flex items-center gap-2 mb-2">
                  <Check className="h-4 w-4 text-green-600 shrink-0" />
                  <p className="text-xs text-green-800">{data.transferorSignerName} 님이 서명하였습니다.</p>
                </div>
                <div className="border border-gray-100 rounded-xl bg-gray-50 p-2">
                  <img src={data.transferorSignaturePng} className="w-full h-20 object-contain" />
                </div>
              </Card>
            )}
          </>)}

          {cType === "standard" && (<>
            <Card title="회원 정보">
              <Field label="이름" value={form.memberName} onChange={v => setForm(p => ({ ...p, memberName: v }))} placeholder="홍길동" />
              <Field label="연락처" type="tel" value={form.memberPhone} onChange={v => setForm(p => ({ ...p, memberPhone: v }))} placeholder="010-0000-0000" />
              <Field label="생년월일" value={form.memberBirth} onChange={v => setForm(p => ({ ...p, memberBirth: v }))} placeholder="1990-01-01" />
            </Card>
            <Card title="프로그램 정보">
              <div className="divide-y divide-gray-100">
                <InfoRow label="프로그램명" value={data.programName} />
                <InfoRow label="프로그램 형태" value={data.programFormat} />
                <InfoRow label="횟수" value={data.programSessions != null ? `${data.programSessions}회` : null} />
                <InfoRow label="정가" value={data.listPrice != null ? `${data.listPrice.toLocaleString()}원` : null} />
                <InfoRow label="할인" value={data.discountAmount ? `-${data.discountAmount.toLocaleString()}원` : null} />
                <InfoRow label="실결제" value={data.programPrice != null ? `${data.programPrice.toLocaleString()}원` : null} />
                <InfoRow label="미수금" value={data.unpaidAmount ? `${data.unpaidAmount.toLocaleString()}원` : null} />
                <InfoRow label="결제일" value={data.paymentDate} />
                <InfoRow label="시작일" value={data.programStartDate} />
                <InfoRow label="종료일" value={data.programEndDate} />
              </div>
              {data.trainerMemo && <Memo text={data.trainerMemo} />}
            </Card>
          </>)}
        </>)}

        {step.key === "terms" && (
          <Card title="약관 동의">
            <TermsSection title="이용약관" content={data.termsOfService} agreed={agreedTerms} onToggle={() => setAgreedTerms(v => !v)} required />
            <TermsSection title="개인정보 수집·이용 동의" content={data.privacyPolicy} agreed={agreedPrivacy} onToggle={() => setAgreedPrivacy(v => !v)} required />
            <TermsSection title="마케팅 자료활용 동의" content={data.marketingConsent} agreed={agreedMarketing} onToggle={() => setAgreedMarketing(v => !v)} required={false} />
          </Card>
        )}

        {step.key === "account" && (
          <Card title="환불 받으실 계좌">
            <Field label="예금주" value={form.accountHolder} onChange={v => setForm(p => ({ ...p, accountHolder: v }))} placeholder="홍길동" />
            <Field label="은행명" value={form.bankName} onChange={v => setForm(p => ({ ...p, bankName: v }))} placeholder="국민은행" />
            <Field label="계좌번호" value={form.accountNumber} onChange={v => setForm(p => ({ ...p, accountNumber: v }))} placeholder="000-0000-0000000" />
          </Card>
        )}

        {step.key === "transferee" && (
          <Card title="양수인 정보">
            <Field label="이름 (양수인)" value={form.memberName} onChange={v => setForm(p => ({ ...p, memberName: v }))} placeholder="홍길동" />
            <Field label="연락처" type="tel" value={form.memberPhone} onChange={v => setForm(p => ({ ...p, memberPhone: v }))} placeholder="010-0000-0000" />
          </Card>
        )}

        {step.key === "sign" && (<>
          <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-3">
            <div className="flex items-start gap-2.5">
              <ShieldCheck className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
              <div className="space-y-1.5">
                <p className="text-sm font-bold text-gray-900">전자서명 안내</p>
                <p className="text-xs text-gray-600 leading-relaxed">
                  아래에 하신 서명은 <b className="text-gray-900">자필 서명과 동일한 효력</b>을 가집니다.
                  서명하시면 위 계약 내용에 동의한 것으로 처리되며, 서명 시각과 접속 기록이 함께 저장됩니다.
                </p>
                <p className="text-xs text-gray-500 leading-relaxed">
                  {cType === "refund" && "위 환불 내용을 확인하였으며, 이에 동의하여 서명합니다."}
                  {cType === "transfer" && (isTransferStep1
                    ? "위 양도 내용을 확인하였으며, 이에 동의하여 서명합니다."
                    : "위 양도양수 내용을 확인하였으며, 잔여 이용권을 양도받는 데 동의하여 서명합니다.")}
                  {cType === "standard" && "위 계약 내용과 약관을 모두 확인하였으며, 이에 동의하여 서명합니다."}
                </p>
              </div>
            </div>
          </div>

          <Card title="서명">
            <Field label="서명자 이름" value={signerName} onChange={setSignerName} placeholder="본인 이름 입력" />
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-500">서명</label>
              {signaturePng ? (
                <div className="space-y-2">
                  <div className="border border-gray-200 rounded-xl bg-white p-2">
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
          </Card>
        </>)}
      </div>

      {/* 하단 */}
      <div className="shrink-0 border-t border-gray-100 px-5 pt-3 pb-safe-4 bg-white space-y-2">
        {err && <p className="text-xs text-red-500 text-center">{err}</p>}
        <div className="flex gap-2">
          {stepIdx > 0 && (
            <button onClick={() => setStepIdx(i => i - 1)}
              className="flex items-center justify-center gap-1 px-4 py-3.5 rounded-2xl border border-gray-200 text-sm font-semibold text-gray-600">
              <ChevronLeft className="h-4 w-4" /> 이전
            </button>
          )}
          {isLast ? (
            <button onClick={submit} disabled={submitMutation.isPending}
              className="flex-1 flex items-center justify-center gap-2 bg-gray-900 text-white font-semibold py-3.5 rounded-2xl text-sm disabled:opacity-50">
              {submitMutation.isPending
                ? <><Loader2 className="h-4 w-4 animate-spin" /> 제출 중...</>
                : <><PenLine className="h-4 w-4" /> {isTransferStep1 ? "양도인 서명 완료" : "서명하고 계약 완료"}</>}
            </button>
          ) : (
            <button onClick={next}
              className="flex-1 flex items-center justify-center gap-1 bg-gray-900 text-white font-semibold py-3.5 rounded-2xl text-sm">
              다음 <ChevronRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </Shell>
  );
}

function Shell({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    // 회원 등록 마법사(z-60) 위에서도 열리므로 그보다 높게 둔다
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/50 pt-safe"
      onClick={onClose}>
      <div onClick={e => e.stopPropagation()}
        className="w-full max-w-lg bg-white rounded-t-3xl sm:rounded-3xl sm:mx-4 overflow-hidden flex flex-col max-h-modal shadow-2xl">
        {children}
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-3">
      <h3 className="text-sm font-bold text-gray-900">{title}</h3>
      {children}
    </div>
  );
}

function Memo({ text }: { text: string }) {
  return (
    <div className="bg-gray-50 rounded-xl px-4 py-3">
      <p className="text-xs text-gray-500 font-semibold mb-1">STEPER 메모</p>
      <p className="text-xs text-gray-700 leading-relaxed">{text}</p>
    </div>
  );
}
