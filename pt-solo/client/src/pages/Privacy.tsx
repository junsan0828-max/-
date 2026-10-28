function Section({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="text-lg font-semibold mb-3">{n}. {title}</h2>
      <div className="text-sm leading-relaxed text-gray-700 space-y-2">{children}</div>
    </section>
  );
}

function List({ items }: { items: string[] }) {
  return (
    <ul className="space-y-1 list-disc list-inside">
      {items.map((i) => <li key={i}>{i}</li>)}
    </ul>
  );
}

export default function Privacy() {
  return (
    <div className="min-h-screen bg-white text-gray-800 px-5 py-10 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">개인정보 처리방침</h1>
      <p className="text-sm text-gray-500 mb-8">시행일자: 2026년 11월 2일</p>

      <p className="text-sm leading-relaxed text-gray-700 mb-8">
        핏스텝(이하 "서비스")은 운동전문가(이하 "STEPER")가 회원을 관리하도록 돕는 서비스입니다. 서비스는 ① STEPER 본인의 개인정보를
        직접 처리하고, ② STEPER가 서비스에 입력하는 회원의 개인정보를 STEPER로부터 위탁받아 처리합니다. 이 방침은 두 경우를 나누어 설명합니다.
      </p>

      <Section n={1} title="수집하는 개인정보 항목">
        <p className="font-medium text-gray-800">가. STEPER(서비스 가입자)</p>
        <List items={[
          "카카오 로그인 시: 이름(카카오 닉네임), 성별, 연령대, 출생연도, 카카오계정(이메일), 카카오 고유 식별자",
          "아이디 가입 시: 아이디, 비밀번호(암호화 저장), 이름, 연락처, 이메일",
          "프로필(선택): 직종, 경력, 활동 지역, 근무지, 전문 분야, 프로필 사진",
        ]} />
        <p className="font-medium text-gray-800 pt-2">나. STEPER가 입력하는 회원 정보 (위탁 처리)</p>
        <List items={[
          "기본 정보: 이름, 연락처, 생년월일, 성별, 방문 경로",
          "계약·결제 정보: 이용 상품, 횟수·기간, 결제 금액, 미수금",
          "수업 정보: 출석·예약 기록, 운동 일지, 컨디션·수면·식단 기록",
          "건강 정보(민감정보): 사전 건강 설문(PAR-Q)의 신체 측정값, 혈압·혈당·콜레스테롤 등 검사 수치, 통증 부위, 병력",
        ]} />
        <p className="font-medium text-gray-800 pt-2">다. 회원 전용 앱(FIT STEP+)·상담 예약·설문 이용자</p>
        <List items={[
          "이름, 연락처, 아이디, 운동 기록, 문의·설문 응답 내용",
        ]} />
      </Section>

      <Section n={2} title="개인정보의 이용 목적">
        <List items={[
          "STEPER 로그인, 본인 식별, 요금제·결제 관리",
          "회원 관리, 수업 예약·출석·운동 기록 관리 등 STEPER가 이용하는 서비스 기능 제공",
          "고객 문의 처리, 오류·장애 확인 및 대응",
          "서비스 개선을 위한 통계 분석 (개인을 알아볼 수 없는 형태로만 이용)",
        ]} />
      </Section>

      <Section n={3} title="회원 정보의 위탁 처리">
        <p>
          STEPER가 입력한 회원 정보의 처리 책임은 해당 STEPER에게 있으며, 서비스는 STEPER로부터 위탁받은 범위(정보 저장, 서비스 기능 제공,
          문의·장애 대응) 안에서만 회원 정보를 처리합니다. 서비스는 회원 정보를 위탁 목적 외로 이용하거나 제3자에게 제공하지 않습니다.
        </p>
        <p>
          STEPER는 회원에게 서비스를 이용해 정보를 처리한다는 사실을 알리고, 건강 정보 등 민감정보는 회원의 별도 동의를 받아 입력해야 합니다.
        </p>
      </Section>

      <Section n={4} title="운영자의 회원 정보 열람 원칙">
        <List items={[
          "서비스 운영자는 운영 관리를 위해 매출·수업 수 등 개인을 알아볼 수 없는 통계 지표만 확인합니다.",
          "회원의 이름·연락처·메모·건강 정보는 운영자 화면에서 가려서 표시됩니다.",
          "STEPER가 서비스 내 [프로필 > 회원 정보 운영자 열람]에서 허용한 경우에만, 문의 처리·운영 컨설팅에 필요한 범위에서 회원 정보를 열람합니다. STEPER는 언제든 허용을 철회할 수 있습니다.",
        ]} />
      </Section>

      <Section n={5} title="개인정보 처리업무의 위탁">
        <p>서비스는 원활한 운영을 위해 아래 업체에 개인정보 처리업무를 위탁합니다.</p>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse mt-1">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="py-2 pr-4 font-medium">수탁업체</th>
                <th className="py-2 font-medium">위탁 업무</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-gray-100"><td className="py-2 pr-4">Railway Corporation</td><td className="py-2">서버 운영 및 데이터 보관</td></tr>
              <tr className="border-b border-gray-100"><td className="py-2 pr-4">Resend, Inc.</td><td className="py-2">이메일 인증·알림 발송</td></tr>
              <tr><td className="py-2 pr-4">(주)카카오</td><td className="py-2">소셜 로그인</td></tr>
            </tbody>
          </table>
        </div>
      </Section>

      <Section n={6} title="개인정보의 보유 및 이용 기간">
        <p>
          STEPER 정보는 회원 탈퇴 시 즉시 파기합니다. STEPER가 입력한 회원 정보는 STEPER가 삭제하거나 STEPER가 탈퇴하면 파기합니다.
          단, 관계 법령에 따라 보존이 필요한 경우 해당 법령에서 정한 기간 동안 보존합니다.
        </p>
      </Section>

      <Section n={7} title="개인정보의 제3자 제공">
        <p>서비스는 정보주체의 동의 없이 개인정보를 제3자에게 제공하지 않습니다. 단, 법령에 의한 경우는 예외로 합니다.</p>
      </Section>

      <Section n={8} title="개인정보의 파기">
        <p>
          이용 목적이 달성된 개인정보는 지체 없이 파기합니다. 전자적 파일 형태로 저장된 개인정보는 복구할 수 없는 방법으로 영구 삭제합니다.
        </p>
      </Section>

      <Section n={9} title="개인정보의 안전성 확보 조치">
        <List items={[
          "비밀번호 암호화 저장, 전송 구간 암호화(HTTPS)",
          "개인정보에 접근할 수 있는 인원의 최소화 및 운영자 화면의 회원 정보 비식별 표시",
        ]} />
      </Section>

      <Section n={10} title="개인정보 보호책임자">
        <p>
          개인정보 처리에 관한 업무를 총괄하며, 개인정보 처리와 관련한 정보주체의 불만 처리 및 피해 구제를 위하여 아래와 같이 개인정보 보호책임자를 지정하고 있습니다.
        </p>
        <div className="text-gray-700 bg-gray-50 rounded-lg p-4">
          <p>• 담당자: 핏스텝 운영자</p>
          <p>• 이메일: junsan0828@gmail.com</p>
        </div>
      </Section>

      <Section n={11} title="정보주체의 권리">
        <p>
          STEPER는 언제든지 자신의 개인정보를 조회·수정·삭제할 수 있으며, 프로필 설정 또는 고객센터를 통해 탈퇴를 요청할 수 있습니다.
          STEPER가 관리하는 회원은 해당 STEPER에게 자신의 정보 열람·정정·삭제를 요청할 수 있으며, 서비스로 요청한 경우 해당 STEPER에게 전달합니다.
        </p>
      </Section>

      <Section n={12} title="개인정보 처리방침 변경">
        <p>본 방침은 시행일로부터 적용되며, 변경 시 시행 7일 전부터 서비스 내 공지사항을 통해 고지합니다.</p>
      </Section>

      <p className="text-xs text-gray-400 mt-10 border-t pt-4">
        © 2026 핏스텝. All rights reserved.
      </p>
    </div>
  );
}
