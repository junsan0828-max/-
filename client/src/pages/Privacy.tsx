export default function Privacy() {
  return (
    <div className="min-h-screen bg-white text-gray-900">
      <div className="max-w-2xl mx-auto px-5 py-10 space-y-8">
        <h1 className="text-2xl font-bold">개인정보처리방침</h1>
        <p className="text-sm text-gray-500">시행일: 2026년 8월 1일</p>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">1. 개인정보의 수집 및 이용 목적</h2>
          <p className="text-sm leading-relaxed">
            자이언트짐(이하 "회사")은 ZIANTGYM+ 앱 서비스 제공을 위해 다음의 목적으로 개인정보를 수집 및 이용합니다.
          </p>
          <ul className="text-sm space-y-1 list-disc pl-5">
            <li>회원 가입 및 본인 확인</li>
            <li>회원권 관리 및 출석 체크인</li>
            <li>포인트 적립 및 사용 관리</li>
            <li>맞춤 운동/식단 추천 서비스 제공</li>
            <li>공지사항 및 이벤트 안내</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">2. 수집하는 개인정보 항목</h2>
          <ul className="text-sm space-y-1 list-disc pl-5">
            <li>필수: 이름, 연락처(휴대폰 번호)</li>
            <li>선택: 이메일, 생년월일, 신체정보(키, 체중), 건강 설문(PAR-Q)</li>
            <li>자동 수집: 출석 기록, 앱 이용 기록</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">3. 개인정보의 보유 및 이용 기간</h2>
          <p className="text-sm leading-relaxed">
            회원 탈퇴 시까지 보유하며, 탈퇴 후 지체 없이 파기합니다.
            단, 관계 법령에 의해 보존이 필요한 경우 해당 기간 동안 보존합니다.
          </p>
          <ul className="text-sm space-y-1 list-disc pl-5">
            <li>계약 또는 청약철회 등에 관한 기록: 5년 (전자상거래법)</li>
            <li>소비자의 불만 또는 분쟁처리에 관한 기록: 3년 (전자상거래법)</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">4. 개인정보의 제3자 제공</h2>
          <p className="text-sm leading-relaxed">
            회사는 이용자의 동의 없이 개인정보를 제3자에게 제공하지 않습니다.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">5. 개인정보의 파기 절차 및 방법</h2>
          <p className="text-sm leading-relaxed">
            보유 기간이 경과하거나 처리 목적이 달성된 개인정보는 지체 없이 파기합니다.
            전자적 파일 형태의 정보는 복구 불가능한 방법으로 삭제합니다.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">6. 이용자의 권리</h2>
          <p className="text-sm leading-relaxed">
            이용자는 언제든지 자신의 개인정보를 조회하거나 수정할 수 있으며,
            회원 탈퇴를 통해 개인정보 삭제를 요청할 수 있습니다.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">7. 개인정보 보호책임자</h2>
          <ul className="text-sm space-y-1">
            <li>업체명: 자이언트짐</li>
            <li>담당자: 대표</li>
            <li>연락처: 센터 프론트 데스크</li>
          </ul>
        </section>

        <div className="pt-6 border-t border-gray-200 text-xs text-gray-400">
          본 개인정보처리방침은 2026년 8월 1일부터 적용됩니다.
        </div>
      </div>
    </div>
  );
}
