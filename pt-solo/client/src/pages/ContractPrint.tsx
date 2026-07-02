import { useEffect, useState } from "react";

const CONTRACT_TERMS = `제1조 (목적)
본 약관은 (이하 "운영자")이 제공하는 운동 프로그램 및 맞춤형 피트니스 서비스(이하 "프로그램")의 이용에 관한 제반 사항을 규정함을 목적으로 합니다.

제2조 (참여자의 의무)
① 참여자는 프로그램 진행 중 타인에게 피해가 가지 않도록 안전수칙 및 지도 내용을 준수하여야 합니다.
② 참여자는 프로그램 진행을 방해하거나 타인에게 불쾌감을 주는 행위를 하여서는 안 됩니다.
③ 참여자는 프로그램에 사용된 운동 도구 및 장비를 올바르게 사용하고 정리하여야 합니다.
④ 프로그램 진행 공간 내 음식물 반입은 제한되며, 음료는 개인 물병만 허용합니다.

제3조 (프로그램 운영 및 이용)
① 프로그램 운영 일정 및 시간은 별도 안내에 따릅니다.
② 참여자는 운영 시간 및 예약된 일정 내에서만 프로그램을 이용할 수 있습니다.
③ 운영자의 사정, 공휴일 또는 기타 불가피한 상황에 따라 일정이 변경될 수 있으며, 이 경우 사전에 공지합니다.

제4조 (프로그램 이용권 및 환불)
① 프로그램 이용권은 계약 또는 등록 완료일로부터 효력이 발생합니다.
② 이용권의 환불은 관련 법령 및 별도 환불 규정에 따릅니다.
③ 참여자의 개인 사정으로 중도 해지할 경우, 잔여 이용 횟수 및 이용 기간에 따라 환불이 진행됩니다.
④ 부상·질병 등 불가피한 사유가 있는 경우 운영자와 협의 후 이용 정지 신청이 가능합니다.

제5조 (면책 조항)
① 운영자는 프로그램 진행 과정에서 운영자의 고의 또는 중대한 과실이 없는 사고에 대해 책임을 지지 않습니다.
② 참여자의 개인 소지품 분실 및 도난에 대해 운영자는 책임을 지지 않습니다.
③ 참여자는 자신의 건강 상태 및 병력 등을 정확히 고지하여야 하며, 허위 또는 누락된 정보로 인해 발생한 문제에 대한 책임은 참여자 본인에게 있습니다.

제6조 (참여 제한 및 자격 박탈)
다음 각 호에 해당하는 경우 운영자는 프로그램 참여를 제한하거나 자격을 박탈할 수 있습니다.
① 타인에게 폭언·폭행 등 위해를 가한 경우
② 프로그램 운영 장비 및 시설을 고의로 파손한 경우
③ 본 약관 및 운영 방침을 위반한 경우`;

const PRIVACY_TERMS = `수집하는 개인정보 항목
- 필수항목: 성명, 연락처, 성별, 생년월일
- 선택항목: 이메일 주소, 건강 정보(운동 목적, 부상 이력 등)

개인정보의 수집 및 이용 목적
① 피트니스 서비스 제공 및 회원 관리
② PT 프로그램 안내 및 일정 관리
③ 결제 및 환불 처리
④ 고객 상담 및 민원 처리
⑤ 서비스 개선을 위한 통계 분석

개인정보의 보유 및 이용 기간
- 회원 탈퇴 시 또는 이용 목적 달성 후 즉시 파기
- 단, 관련 법령에 따라 보존 의무가 있는 경우 해당 기간 보관

개인정보의 제3자 제공
- 원칙적으로 외부에 제공하지 않으며, 다음의 경우에 한해 제공합니다.
  · 법령의 규정에 의한 경우
  · 이용자가 사전에 동의한 경우

개인정보의 파기
- 개인정보 보유 기간의 경과 또는 목적 달성 후 지체없이 파기
- 전자적 파일: 복구 불가능한 방법으로 영구 삭제
- 종이 문서: 분쇄 또는 소각

귀하는 개인정보 제공에 동의하지 않을 권리가 있습니다.
단, 동의 거부 시 정상적인 서비스 이용이 제한될 수 있습니다.`;

const MARKETING_TERMS = `광고성 정보 수신 및 활용 동의 (선택)

수집 항목: 성명, 연락처, 이메일

이용 목적
① 신규 프로그램 및 이벤트 안내
② 할인 혜택 및 프로모션 정보 제공
③ 센터 소식 및 뉴스레터 발송

광고성 정보 발송 채널
- 문자메시지(SMS/MMS), 카카오 알림톡, 이메일

보유 및 이용 기간
- 동의일로부터 회원 탈퇴 또는 수신 거부 시까지

수신 거부 안내
- 언제든지 센터에 수신 거부 의사를 표시하거나 발송된 문자/이메일 하단의 수신 거부 링크를 통해 거부할 수 있습니다.
- 수신 거부 후에도 서비스 이용에는 제한이 없습니다.`;

export default function ContractPrint() {
  const params = new URLSearchParams(window.location.search);
  const name = params.get("name") || "성함";
  const phone = params.get("phone") || "";
  const date = params.get("date") || new Date().toLocaleDateString("ko-KR");
  const marketing = params.get("marketing") === "1";
  const showKakao = params.get("showKakao") === "1";
  const trainerName = params.get("trainerName") || "";
  const gymName = params.get("gymName") || "";
  const centerLabel = gymName || trainerName || "센터";
  const storedTerms = (() => { try { return JSON.parse(sessionStorage.getItem("contractTerms") || "{}"); } catch { return {}; } })();
  const contractTermsText = (storedTerms.termsOfService || CONTRACT_TERMS).split("자이언트짐").join(centerLabel);
  const privacyTermsText = (storedTerms.privacyPolicy || PRIVACY_TERMS).split("자이언트짐").join(centerLabel);
  const marketingTermsText = (storedTerms.marketingConsent || MARKETING_TERMS).split("자이언트짐").join(centerLabel);
  const [signatureImg, setSignatureImg] = useState<string>("");

  useEffect(() => {
    document.title = `${name} 회원 계약서`;
    const sig = sessionStorage.getItem("contractSignature");
    if (sig) setSignatureImg(sig);
  }, [name]);

  function handlePrint() {
    window.print();
  }

  function handleKakaoShare() {
    const url = window.location.href;
    const text = `[${name}님 회원 계약서]\n계약 내용을 확인해 주세요.\n${url}`;
    // 카카오톡 앱 공유 (모바일) / 클립보드 복사 (데스크탑 fallback)
    if (navigator.share) {
      navigator.share({ title: `${name} 회원 계약서`, text, url }).catch(() => {});
    } else {
      navigator.clipboard.writeText(text).then(() => alert("링크가 클립보드에 복사되었습니다.\n카카오톡에 붙여넣기 하세요.")).catch(() => {});
    }
  }

  return (
    <>
      {/* 인쇄 전용 스타일 */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; font-family: 'Malgun Gothic', sans-serif; }
          .contract-page { padding: 20px !important; max-width: 100% !important; box-shadow: none !important; }
          .section-box { border: 1px solid #ccc !important; }
          .page-break { page-break-before: always; }
        }
        @media screen {
          body { background: #f5f5f5; }
        }
      `}</style>

      {/* 버튼 (화면에서만 보임) */}
      <div className="no-print fixed top-4 right-4 z-50 flex gap-2">
        {showKakao && (
          <button onClick={handleKakaoShare}
            className="bg-yellow-400 text-gray-900 px-4 py-2.5 rounded-lg text-sm font-bold shadow-lg hover:bg-yellow-500 transition-colors flex items-center gap-1.5">
            💬 카카오 공유
          </button>
        )}
        <button onClick={handlePrint}
          className="bg-emerald-600 text-white px-4 py-2.5 rounded-lg text-sm font-bold shadow-lg hover:bg-emerald-700 transition-colors flex items-center gap-1.5">
          🖨️ PDF 저장 / 인쇄
        </button>
      </div>

      {/* 계약서 본문 */}
      <div className="contract-page max-w-2xl mx-auto bg-white p-10 my-8 shadow-md rounded-lg text-gray-800" style={{ fontFamily: "'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif" }}>

        {/* 헤더 */}
        <div className="text-center mb-8 border-b-2 border-gray-800 pb-6">
          <h1 className="text-3xl font-bold tracking-wide mb-1">{gymName || trainerName || "센터"}</h1>
          {gymName && trainerName && <p className="text-sm text-gray-500">{trainerName} STEPER</p>}
          <h2 className="text-xl font-bold mt-4 tracking-widest">회 원 계 약 서</h2>
        </div>

        {/* 회원 정보 */}
        <div className="mb-8 border border-gray-300 rounded-lg p-4">
          <h3 className="text-sm font-bold text-gray-600 mb-3 uppercase tracking-wide">회원 정보</h3>
          <div className="grid grid-cols-2 gap-y-3 text-sm">
            <div>
              <span className="text-gray-500">성명</span>
              <span className="ml-3 font-semibold border-b border-gray-400 pb-0.5 px-2">{name}</span>
            </div>
            <div>
              <span className="text-gray-500">연락처</span>
              <span className="ml-3 font-semibold border-b border-gray-400 pb-0.5 px-2">{phone || "_____________"}</span>
            </div>
            <div>
              <span className="text-gray-500">계약일</span>
              <span className="ml-3 font-semibold border-b border-gray-400 pb-0.5 px-2">{date}</span>
            </div>
          </div>
        </div>

        {/* 섹션 1: 이용약관 */}
        <div className="mb-6">
          <h3 className="text-base font-bold mb-2 flex items-center gap-2">
            <span className="bg-gray-800 text-white text-xs px-2 py-0.5 rounded">1</span>
            센터 이용 약관
          </h3>
          <div className="section-box border border-gray-200 rounded-lg p-4 bg-gray-50 text-xs leading-relaxed whitespace-pre-wrap text-gray-700" style={{ fontSize: "11px" }}>
            {contractTermsText}
          </div>
          <div className="mt-3 flex items-center gap-3">
            <div className="w-5 h-5 border-2 border-gray-600 rounded flex items-center justify-center text-gray-800 font-bold text-sm">✓</div>
            <span className="text-sm font-semibold">(필수) 위 이용약관을 읽고 이에 동의합니다.</span>
          </div>
        </div>

        {/* 섹션 2: 개인정보 */}
        <div className="mb-6">
          <h3 className="text-base font-bold mb-2 flex items-center gap-2">
            <span className="bg-gray-800 text-white text-xs px-2 py-0.5 rounded">2</span>
            개인정보 수집·이용 동의서
          </h3>
          <div className="section-box border border-gray-200 rounded-lg p-4 bg-gray-50 text-xs leading-relaxed whitespace-pre-wrap text-gray-700" style={{ fontSize: "11px" }}>
            {privacyTermsText}
          </div>
          <div className="mt-3 flex items-center gap-3">
            <div className="w-5 h-5 border-2 border-gray-600 rounded flex items-center justify-center text-gray-800 font-bold text-sm">✓</div>
            <span className="text-sm font-semibold">(필수) 개인정보 수집·이용에 동의합니다.</span>
          </div>
        </div>

        {/* 섹션 3: 광고성 */}
        <div className="mb-8">
          <h3 className="text-base font-bold mb-2 flex items-center gap-2">
            <span className="bg-gray-500 text-white text-xs px-2 py-0.5 rounded">3</span>
            광고성 정보 수신 동의서
          </h3>
          <div className="section-box border border-gray-200 rounded-lg p-4 bg-gray-50 text-xs leading-relaxed whitespace-pre-wrap text-gray-700" style={{ fontSize: "11px" }}>
            {marketingTermsText}
          </div>
          <div className="mt-3 flex items-center gap-3">
            <div className={`w-5 h-5 border-2 border-gray-600 rounded flex items-center justify-center text-gray-800 font-bold text-sm ${marketing ? "" : "opacity-30"}`}>
              {marketing ? "✓" : ""}
            </div>
            <span className="text-sm">
              <span className="text-gray-500">(선택)</span> 광고성 정보 수신에 동의합니다.
              {marketing && <span className="ml-2 text-emerald-600 font-semibold">동의</span>}
              {!marketing && <span className="ml-2 text-gray-400">미동의</span>}
            </span>
          </div>
        </div>

        {/* 서명란 */}
        <div className="border-t-2 border-gray-300 pt-6">
          <p className="text-sm text-center text-gray-600 mb-6">
            본인은 위 약관의 내용을 충분히 읽고 이해하였으며, 이에 동의하여 서명합니다.
          </p>
          <div className="flex justify-between items-end gap-8">
            <div className="flex-1">
              <p className="text-xs text-gray-500 mb-1">계약일</p>
              <p className="text-sm font-medium border-b border-gray-400 pb-1">{date}</p>
            </div>
            <div className="flex-1">
              <p className="text-xs text-gray-500 mb-1">회원 성명 (서명)</p>
              <div className="border-b border-gray-400 pb-2">
                <span className="text-sm font-semibold">{name}</span>
                {signatureImg ? (
                  <img src={signatureImg} alt="전자서명" className="mt-1 h-16 max-w-full object-contain" style={{ imageRendering: "pixelated" }} />
                ) : (
                  <div className="h-16 flex items-end">
                    <span className="text-xs text-gray-400">(서명)</span>
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="mt-8 text-center">
            <p className="text-sm text-gray-600 font-semibold">{gymName ? `${gymName} ` : ""}{trainerName || "STEPER"}</p>
            <div className="mt-2 inline-block border-b border-gray-400 w-40 pb-8"></div>
            <span className="text-xs text-gray-400 ml-2">(서명/인)</span>
          </div>
        </div>

        {/* 푸터 */}
        <div className="mt-10 border-t border-gray-200 pt-4 text-center text-xs text-gray-400">
          {gymName || trainerName || "FIT STEP"} · 본 계약서는 등록 시 작성되었습니다
        </div>
      </div>
    </>
  );
}
