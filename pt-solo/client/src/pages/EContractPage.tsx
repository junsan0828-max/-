import { useRef, useState, useEffect } from "react";
import { useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { Check, Loader2, FileText, Share2 } from "lucide-react";
import ContractSignFlow, { type SignedInfo } from "@/components/ContractSignFlow";

type DoneState = 'transferor_signed' | 'complete' | null;

function shareKakao(url: string) {
  navigator.clipboard.writeText(url).then(() => {
    setTimeout(() => { window.location.href = "kakaotalk://"; }, 300);
  });
}

function openContractPrint(
  data: { trainerName?: string; termsOfService?: string; privacyPolicy?: string; marketingConsent?: string } | null | undefined,
  submitted: SignedInfo,
) {
  sessionStorage.setItem("contractSignature", submitted.signaturePng);
  sessionStorage.setItem("contractTerms", JSON.stringify({
    termsOfService: data?.termsOfService ?? "",
    privacyPolicy: data?.privacyPolicy ?? "",
    marketingConsent: data?.marketingConsent ?? "",
  }));
  const params = new URLSearchParams({
    name: submitted.memberName,
    phone: submitted.memberPhone,
    date: submitted.signedAt,
    marketing: submitted.agreedMarketing ? "1" : "0",
    trainerName: data?.trainerName ?? "",
  });
  window.open(`/contract-print?${params.toString()}`, "_blank");
}

export default function EContractPage({ token: tokenProp }: { token?: string }) {
  const params = useParams<{ token: string }>();
  const token = tokenProp ?? params.token ?? "";
  const { data, isLoading, error } = trpc.eContract.getPublic.useQuery({ token }, { retry: false });

  const [signOpen, setSignOpen] = useState(true);
  const [doneState, setDoneState] = useState<DoneState>(null);
  const [submittedInfo, setSubmittedInfo] = useState<SignedInfo | null>(null);

  if (isLoading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
    </div>
  );

  // (already_signed error no longer thrown — handled via data.status === 'signed' below)

  // 양도인 서명 완료 → 양수인에게 링크 전달 안내
  if (doneState === 'transferor_signed') return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-6">
      <div className="w-full max-w-sm space-y-6 text-center">
        <div className="space-y-3">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
            <Check className="h-8 w-8 text-blue-600" />
          </div>
          <h1 className="text-lg font-bold text-gray-900">양도인 서명 완료</h1>
          <p className="text-sm text-gray-500">이제 <b className="text-gray-900">양수인</b>에게 이 링크를 전달하여<br />양수인의 서명을 받아주세요.</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 p-4 text-left">
          <p className="text-xs text-gray-400 mb-2">계약서 링크</p>
          <p className="text-xs font-mono text-gray-700 break-all">{window.location.href}</p>
        </div>
        <button
          onClick={() => { navigator.clipboard.writeText(window.location.href); }}
          className="w-full flex items-center justify-center gap-2 bg-gray-900 text-white font-semibold py-4 rounded-2xl text-sm"
        >
          링크 복사
        </button>
        <p className="text-xs text-gray-400">양수인이 이 링크를 열면 서명할 수 있습니다.</p>
      </div>
    </div>
  );

  // 최종 완료 (양수인 서명 또는 환불/일반 계약 완료)
  if (doneState === 'complete' && submittedInfo) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-6">
      <div className="w-full max-w-sm space-y-6 text-center">
        <div className="space-y-3">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
            <Check className="h-8 w-8 text-green-600" />
          </div>
          <h1 className="text-lg font-bold text-gray-900">계약이 완료되었습니다</h1>
          <p className="text-sm text-gray-500">서명이 완료되어 저장되었습니다.</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-5 text-left space-y-2">
          <p className="text-xs font-semibold text-gray-500 mb-3">계약 내용 요약</p>
          {[
            ["STEPER", data?.trainerName],
            submittedInfo.memberName ? ["회원명", submittedInfo.memberName] : null,
            submittedInfo.memberPhone ? ["연락처", submittedInfo.memberPhone] : null,
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

        <div className="space-y-2">
          <button
            onClick={() => openContractPrint(data, submittedInfo)}
            className="w-full flex items-center justify-center gap-2 bg-gray-900 text-white font-semibold py-4 rounded-2xl text-sm"
          >
            <FileText className="h-4 w-4" />
            계약서 저장 / 인쇄
          </button>
          <button
            onClick={() => shareKakao(window.location.href)}
            className="w-full flex items-center justify-center gap-2 bg-yellow-400 text-gray-900 font-semibold py-4 rounded-2xl text-sm"
          >
            <Share2 className="h-4 w-4" />
            카카오톡으로 공유
          </button>
        </div>
        <p className="text-xs text-gray-400">회원이 링크를 열면 계약서를 확인할 수 있습니다.</p>
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

  // 서명 완료된 계약서 읽기 전용 조회 (회원이 링크 재접속 시)
  if (data.status === 'signed' && !doneState) {
    const extra = data.extraData ?? {};
    const contractType = data.contractType ?? 'standard';
    function InfoRowS({ label, value }: { label: string; value?: string | number | null }) {
      if (value == null || value === '') return null;
      return (
        <div className="flex justify-between py-2.5">
          <span className="text-xs text-gray-500">{label}</span>
          <span className="text-xs font-semibold text-gray-900">{value}</span>
        </div>
      );
    }
    return (
      <div className="min-h-screen bg-gray-50 pb-20">
        <div className="bg-white border-b border-gray-200 px-5 py-4 sticky top-0 z-10">
          <p className="text-xs text-gray-400 font-medium">FIT STEP · 서명 완료된 계약서</p>
          <h1 className="text-base font-bold text-gray-900 mt-0.5">{data.trainerName} STEPER</h1>
        </div>
        <div className="max-w-lg mx-auto px-5 pt-5 space-y-5">
          <div className="bg-green-50 border border-green-200 rounded-2xl p-4 flex items-center gap-3">
            <Check className="h-5 w-5 text-green-600 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-green-800">서명 완료된 계약서입니다</p>
              <p className="text-xs text-green-600">{data.signedAt ? `서명일: ${data.signedAt}` : "서명이 완료되었습니다."}</p>
            </div>
          </div>

          {/* 계약서 내용 요약 */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-3">
            <h2 className="text-sm font-bold text-gray-900">계약 정보</h2>
            <div className="divide-y divide-gray-100">
              <InfoRowS label="STEPER" value={data.trainerName} />
              {contractType === 'transfer' ? (<>
                <InfoRowS label="양도인" value={extra.transferorName ?? data.transferorSignerName} />
                <InfoRowS label="양수인" value={data.memberName} />
                <InfoRowS label="양수인 연락처" value={data.memberPhone} />
              </>) : (<>
                <InfoRowS label="회원명" value={data.memberName} />
                <InfoRowS label="연락처" value={data.memberPhone} />
              </>)}
              <InfoRowS label="프로그램" value={data.programName} />
              <InfoRowS label="금액" value={data.programPrice != null ? `${data.programPrice.toLocaleString()}원` : null} />
              <InfoRowS label="횟수" value={data.programSessions != null ? `${data.programSessions}회` : null} />
              {contractType === 'refund' && <InfoRowS label="환불 금액" value={extra.refundAmount != null ? `${Number(extra.refundAmount).toLocaleString()}원` : null} />}
              <InfoRowS label="서명자" value={data.signerName} />
              <InfoRowS label="서명일" value={data.signedAt} />
            </div>
          </div>

          {/* 서명 이미지 */}
          {data.signaturePng && (
            <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-2">
              <p className="text-xs font-semibold text-gray-500">전자서명</p>
              <div className="border border-gray-100 rounded-xl overflow-hidden bg-gray-50 p-2">
                <img src={data.signaturePng} className="w-full h-24 object-contain" />
              </div>
            </div>
          )}

          <button
            onClick={() => shareKakao(window.location.href)}
            className="w-full flex items-center justify-center gap-2 bg-yellow-400 text-gray-900 font-semibold py-4 rounded-2xl text-sm"
          >
            <Share2 className="h-4 w-4" />
            카카오톡으로 공유
          </button>
          <p className="text-xs text-gray-400 text-center">이 창을 닫으셔도 됩니다.</p>
        </div>
      </div>
    );
  }

  const contractType = data.contractType ?? 'standard';
  const contractStatus = data.status ?? 'pending';
  const isTransferStep1 = contractType === 'transfer' && contractStatus === 'pending';

  const headerSubtitle =
    contractType === 'refund' ? '환불 계약서' :
    contractType === 'transfer' && isTransferStep1 ? '양도양수 계약서 · 양도인 서명' :
    contractType === 'transfer' ? '양도양수 계약서 · 양수인 서명' :
    '비대면 전자계약';

  // 링크로 들어온 회원에게는 표지를 깔고 그 위에 서명 모달을 띄운다.
  // 모달을 닫아도 표지의 버튼으로 다시 열 수 있다.
  return (
    <div className="min-h-dvh bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-5 py-4">
        <p className="text-xs text-gray-400 font-medium">FIT STEP · {headerSubtitle}</p>
        <h1 className="text-base font-bold text-gray-900 mt-0.5">{data.trainerName} STEPER</h1>
      </div>

      <div className="max-w-lg mx-auto px-5 pt-10 text-center space-y-5">
        <div className="w-14 h-14 rounded-2xl bg-gray-900 flex items-center justify-center mx-auto">
          <FileText className="h-7 w-7 text-white" />
        </div>
        <div className="space-y-1.5">
          <h2 className="text-lg font-bold text-gray-900">계약서가 도착했습니다</h2>
          <p className="text-sm text-gray-500 leading-relaxed">
            계약 내용을 확인하신 후<br />마지막 단계에서 전자서명으로 마무리해주세요.
          </p>
        </div>
        <button onClick={() => setSignOpen(true)}
          className="w-full bg-gray-900 text-white font-semibold py-4 rounded-2xl text-sm">
          계약서 확인하고 서명하기
        </button>
      </div>

      {signOpen && (
        <ContractSignFlow
          token={token}
          onClose={() => setSignOpen(false)}
          onSigned={(step, info) => {
            setSignOpen(false);
            if (step === 'transferor_signed') {
              setDoneState('transferor_signed');
            } else {
              setSubmittedInfo(info);
              setDoneState('complete');
            }
          }}
        />
      )}
    </div>
  );
}
