export default function Privacy() {
  return (
    <div className="min-h-screen bg-white text-gray-800 px-5 py-10 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">개인정보 처리방침</h1>
      <p className="text-sm text-gray-500 mb-8">시행일자: 2025년 1월 1일</p>

      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-3">1. 수집하는 개인정보 항목</h2>
        <p className="text-sm leading-relaxed text-gray-700">
          핏스텝(이하 "서비스")은 카카오 소셜 로그인을 통해 서비스 이용에 필요한 최소한의 개인정보만 수집합니다.
        </p>
        <ul className="mt-3 space-y-1 text-sm text-gray-700 list-disc list-inside">
          <li>이름 (카카오 닉네임)</li>
          <li>성별</li>
          <li>연령대</li>
          <li>출생연도</li>
          <li>카카오계정 (이메일)</li>
          <li>카카오 고유 식별자</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-3">2. 개인정보의 수집 및 이용 목적</h2>
        <ul className="mt-1 space-y-1 text-sm text-gray-700 list-disc list-inside">
          <li>서비스 로그인 및 회원 식별</li>
          <li>PT 수업 예약 및 운동 기록 관리</li>
          <li>서비스 이용 내역 확인 및 고객 문의 처리</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-3">3. 개인정보의 보유 및 이용 기간</h2>
        <p className="text-sm leading-relaxed text-gray-700">
          회원 탈퇴 시 즉시 파기합니다. 단, 관계 법령에 의해 보존이 필요한 경우 해당 법령에서 정한 기간 동안 보존합니다.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-3">4. 개인정보의 제3자 제공</h2>
        <p className="text-sm leading-relaxed text-gray-700">
          서비스는 이용자의 동의 없이 개인정보를 제3자에게 제공하지 않습니다. 단, 법령에 의한 경우는 예외로 합니다.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-3">5. 개인정보의 파기</h2>
        <p className="text-sm leading-relaxed text-gray-700">
          수집한 개인정보의 이용 목적이 달성된 후에는 해당 정보를 지체 없이 파기합니다. 전자적 파일 형태로 저장된 개인정보는 복구 불가능한 방법으로 영구 삭제합니다.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-3">6. 개인정보 보호책임자</h2>
        <p className="text-sm leading-relaxed text-gray-700">
          개인정보 처리에 관한 업무를 총괄하여 담당하며, 개인정보 처리와 관련한 정보주체의 불만 처리 및 피해 구제를 위하여 아래와 같이 개인정보 보호책임자를 지정하고 있습니다.
        </p>
        <div className="mt-3 text-sm text-gray-700 bg-gray-50 rounded-lg p-4">
          <p>• 담당자: 핏스텝 운영자</p>
          <p>• 이메일: junsan0828@gmail.com</p>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-3">7. 정보주체의 권리</h2>
        <p className="text-sm leading-relaxed text-gray-700">
          이용자는 언제든지 자신의 개인정보를 조회·수정·삭제할 수 있으며, 서비스 내 프로필 설정 또는 고객센터를 통해 회원 탈퇴를 요청할 수 있습니다.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-3">8. 개인정보 처리방침 변경</h2>
        <p className="text-sm leading-relaxed text-gray-700">
          본 방침은 시행일로부터 적용되며, 변경 시 서비스 내 공지사항을 통해 사전에 고지합니다.
        </p>
      </section>

      <p className="text-xs text-gray-400 mt-10 border-t pt-4">
        © 2025 핏스텝. All rights reserved.
      </p>
    </div>
  );
}
