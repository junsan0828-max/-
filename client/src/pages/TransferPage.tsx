import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { CheckCircle2, XCircle, Pen, Clock } from "lucide-react";

type Contract = {
  id: number;
  token: string;
  status: string;
  transferorName: string;
  transferorPhone: string | null;
  transferorSignedAt: string | null;
  transfereeName: string | null;
  transfereePhone: string | null;
  transfereeBirthDate: string | null;
  transfereeSignedAt: string | null;
  itemType: string;
  itemDescription: string;
  termsSnapshot: string | null;
  createdAt: string;
  completedAt: string | null;
  transferorSigned: boolean;
  transfereeSigned: boolean;
};

const itemTypeLabels: Record<string, string> = {
  pt_package: "PT 패키지",
  membership: "헬스 회원권",
  uniform: "운동복",
  locker: "락커",
};

function SignatureCanvas({ onSigned }: { onSigned: (dataUrl: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);

  function getPos(e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ("touches" in e) {
      const t = e.touches[0];
      return { x: (t.clientX - rect.left) * scaleX, y: (t.clientY - rect.top) * scaleY };
    }
    const m = e as React.MouseEvent;
    return { x: (m.clientX - rect.left) * scaleX, y: (m.clientY - rect.top) * scaleY };
  }

  function startDraw(e: React.MouseEvent | React.TouchEvent) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    e.preventDefault();
    setIsDrawing(true);
    setHasDrawn(true);
    const pos = getPos(e, canvas);
    lastPos.current = pos;
    const ctx = canvas.getContext("2d")!;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, 1.5, 0, Math.PI * 2);
    ctx.fillStyle = "#111";
    ctx.fill();
  }

  function draw(e: React.MouseEvent | React.TouchEvent) {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas || !lastPos.current) return;
    e.preventDefault();
    const pos = getPos(e, canvas);
    const ctx = canvas.getContext("2d")!;
    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = "#111";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();
    lastPos.current = pos;
  }

  function endDraw() {
    setIsDrawing(false);
    lastPos.current = null;
  }

  function clear() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.getContext("2d")!.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  }

  function submit() {
    if (!hasDrawn || !canvasRef.current) return;
    onSigned(canvasRef.current.toDataURL("image/png"));
  }

  return (
    <div className="space-y-2">
      <div className="border-2 border-dashed border-gray-300 rounded-xl overflow-hidden bg-white">
        <canvas
          ref={canvasRef}
          width={600}
          height={200}
          className="w-full touch-none cursor-crosshair"
          style={{ display: "block" }}
          onMouseDown={startDraw}
          onMouseMove={draw}
          onMouseUp={endDraw}
          onMouseLeave={endDraw}
          onTouchStart={startDraw}
          onTouchMove={draw}
          onTouchEnd={endDraw}
        />
      </div>
      <div className="flex gap-2">
        <button onClick={clear} className="flex-1 py-2.5 text-sm border border-gray-300 rounded-xl text-gray-600 hover:bg-gray-50">
          다시 그리기
        </button>
        <button
          onClick={submit}
          disabled={!hasDrawn}
          className="flex-1 py-2.5 text-sm bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 disabled:opacity-40"
        >
          서명 완료
        </button>
      </div>
    </div>
  );
}

export default function TransferPage({ token }: { token: string }) {
  const contractQuery = trpc.transfer.getContract.useQuery({ token }, { staleTime: 0 });
  const signMutation = trpc.transfer.signContract.useMutation({
    onSuccess: () => { contractQuery.refetch(); toast.success("서명이 완료되었습니다!"); },
    onError: (e) => toast.error(e.message),
  });

  const [signerName, setSignerName] = useState("");
  const contract = contractQuery.data as Contract | undefined;

  if (contractQuery.isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-400 text-sm">로딩 중...</p>
      </div>
    );
  }

  if (!contract) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="text-center space-y-3">
          <XCircle className="h-12 w-12 text-red-400 mx-auto" />
          <p className="text-gray-700 font-semibold">계약서를 찾을 수 없습니다</p>
        </div>
      </div>
    );
  }

  if (contract.status === "completed") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-sm w-full text-center space-y-4">
          <CheckCircle2 className="h-14 w-14 text-green-500 mx-auto" />
          <h2 className="text-xl font-bold text-gray-800">양도양수 계약 완료</h2>
          <p className="text-gray-400 text-sm">양도인과 양수인 모두 서명이 완료되었습니다.</p>
          <div className="bg-gray-50 rounded-xl p-4 text-left space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-gray-400">양도 항목</span><span className="font-medium">{contract.itemDescription}</span></div>
            <div className="flex justify-between"><span className="text-gray-400">양도인</span><span className="font-medium">{contract.transferorName}</span></div>
            <div className="flex justify-between"><span className="text-gray-400">양수인</span><span className="font-medium">{contract.transfereeName ?? "-"}</span></div>
            <div className="flex justify-between"><span className="text-gray-400">완료일</span><span className="font-medium">{contract.completedAt?.substring(0, 10) ?? "-"}</span></div>
          </div>
        </div>
      </div>
    );
  }

  if (contract.status === "cancelled") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="text-center space-y-3">
          <XCircle className="h-12 w-12 text-red-400 mx-auto" />
          <p className="text-gray-700 font-semibold">취소된 계약서입니다</p>
        </div>
      </div>
    );
  }

  const role = contract.status === "pending_transferor" ? "transferor" : "transferee";
  const isTransferor = role === "transferor";

  // 이미 내 단계가 완료된 경우 (pending_transferee인데 transferor가 접속한 경우 등)
  const waitingForOther = contract.status === "pending_transferee" && contract.transferorSigned && !isTransferor === false;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <div className="bg-white border-b px-4 py-3 flex items-center gap-3">
        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
          <span className="text-white font-bold text-xs">Z</span>
        </div>
        <div>
          <p className="font-bold text-gray-800 text-sm">자이언트짐</p>
          <p className="text-xs text-gray-400">양도양수 전자계약서</p>
        </div>
      </div>

      <div className="max-w-lg mx-auto p-4 space-y-4 pb-12">
        {/* 진행 상태 바 */}
        <div className="mt-2 space-y-1">
          <div className="flex gap-1">
            <div className={`flex-1 h-1.5 rounded-full transition-all ${contract.transferorSigned ? "bg-blue-600" : "bg-gray-200"}`} />
            <div className={`flex-1 h-1.5 rounded-full transition-all ${contract.transfereeSigned ? "bg-blue-600" : "bg-gray-200"}`} />
          </div>
          <div className="flex justify-between text-xs text-gray-400 px-0.5">
            <span>{contract.transferorSigned ? "✓ " : ""}양도인 서명</span>
            <span>{contract.transfereeSigned ? "✓ " : ""}양수인 서명</span>
          </div>
        </div>

        {/* 계약 요약 */}
        <div className="bg-white rounded-2xl shadow-sm p-5 space-y-3">
          <h2 className="font-bold text-gray-800">양도양수 계약서</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-gray-400">양도 항목</span><span className="font-semibold">{contract.itemDescription}</span></div>
            <div className="flex justify-between"><span className="text-gray-400">항목 유형</span><span>{itemTypeLabels[contract.itemType] ?? contract.itemType}</span></div>
            <hr className="border-gray-100" />
            <div className="flex justify-between"><span className="text-gray-400">양도인</span><span className="font-medium">{contract.transferorName}</span></div>
            {contract.transferorPhone && <div className="flex justify-between"><span className="text-gray-400">연락처</span><span>{contract.transferorPhone}</span></div>}
            <hr className="border-gray-100" />
            {contract.transfereeName ? (
              <>
                <div className="flex justify-between"><span className="text-gray-400">양수인</span><span className="font-medium">{contract.transfereeName}</span></div>
                {contract.transfereePhone && <div className="flex justify-between"><span className="text-gray-400">연락처</span><span>{contract.transfereePhone}</span></div>}
                {contract.transfereeBirthDate && <div className="flex justify-between"><span className="text-gray-400">생년월일</span><span>{contract.transfereeBirthDate}</span></div>}
              </>
            ) : (
              <div className="flex justify-between"><span className="text-gray-400">양수인</span><span className="text-gray-300">미정</span></div>
            )}
          </div>
        </div>

        {/* 약관 */}
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <h3 className="font-semibold text-gray-700 mb-3 text-sm">약관 및 동의사항</h3>
          <pre className="text-xs text-gray-500 whitespace-pre-wrap font-sans leading-relaxed max-h-52 overflow-y-auto">
            {contract.termsSnapshot}
          </pre>
        </div>

        {/* 양도인 서명 완료 후 양수인 대기 */}
        {contract.status === "pending_transferee" && !waitingForOther && (
          <div className="bg-blue-50 rounded-2xl p-5 text-center space-y-2">
            <Clock className="h-8 w-8 text-blue-400 mx-auto" />
            <p className="text-blue-700 font-medium text-sm">양도인 서명 완료</p>
            <p className="text-blue-400 text-xs">양수인이 이 링크에서 서명하면 계약이 완료됩니다</p>
          </div>
        )}

        {/* 서명 단계 */}
        <div className="bg-white rounded-2xl shadow-sm p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Pen className="h-4 w-4 text-blue-600" />
            <h3 className="font-semibold text-gray-800 text-sm">
              {isTransferor ? "양도인 서명" : "양수인 서명"}
            </h3>
          </div>

          <div>
            <label className="text-xs text-gray-400 mb-1.5 block">
              {isTransferor ? "양도인" : "양수인"} 성명
            </label>
            <input
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder="이름을 입력하세요"
              value={signerName}
              onChange={(e) => setSignerName(e.target.value)}
            />
          </div>

          {signerName.trim() ? (
            <div className="space-y-2">
              <label className="text-xs text-gray-400 block">아래 박스에 손글씨로 서명해주세요</label>
              <SignatureCanvas
                onSigned={(sig) => signMutation.mutate({ token, role, signerName: signerName.trim(), signature: sig })}
              />
            </div>
          ) : (
            <p className="text-xs text-gray-300 text-center py-4">이름을 입력하면 서명란이 표시됩니다</p>
          )}

          {signMutation.isPending && (
            <p className="text-center text-sm text-blue-500">서명 저장 중...</p>
          )}
        </div>
      </div>
    </div>
  );
}
