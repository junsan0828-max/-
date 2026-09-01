import type { SalesbookData, JobType } from "../types";

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

const ptTemplate: Omit<SalesbookData, "jobType" | "customJobTitle" | "designConceptId"> = {
  trainerName: "",
  centerName: "",
  experienceYears: "",
  certificates: [{ id: uid(), name: "생활스포츠지도사 2급 (보디빌딩)" }],
  profilePhotoUrl: "",
  openingMent:
    "안녕하세요! 오늘 상담 오시느라 수고하셨습니다. 저는 이곳에서 회원님들의 체형 변화와 건강을 책임지고 있는 트레이너입니다. 오늘 체성분 측정 결과를 바탕으로 현재 몸 상태를 정확히 파악하고, 회원님에게 가장 효과적인 운동 방향을 함께 찾아보겠습니다.",
  introPhilosophy:
    "저는 '근거 기반 트레이닝'을 지향합니다. 무작정 운동하는 것이 아니라, 체성분 데이터와 근골격 분석을 기반으로 회원님의 몸에 맞는 프로그램을 설계합니다. 단기 변화가 아닌, 평생 유지할 수 있는 운동 습관을 만들어 드리는 것이 제 목표입니다.",

  bodyCompItems: [
    { id: uid(), name: "체중", description: "현재 체중은 전반적인 건강 상태의 기초 지표입니다.", normalRange: "BMI 18.5~24.9 기준 적정 체중", riskDescription: "과체중 시 관절 부담 증가, 대사질환 위험 상승" },
    { id: uid(), name: "골격근량", description: "근육량은 기초대사량과 직접적으로 연결됩니다. 근육이 많을수록 가만히 있어도 칼로리 소모가 높아집니다.", normalRange: "남성 30kg 이상, 여성 20kg 이상", riskDescription: "골격근량 부족 시 기초대사량 저하, 요요 현상 발생 위험" },
    { id: uid(), name: "체지방률", description: "체지방률은 단순 체중보다 중요한 지표입니다. 같은 체중이라도 체지방률에 따라 체형과 건강이 크게 달라집니다.", normalRange: "남성 10~20%, 여성 18~28%", riskDescription: "체지방률 과다 시 내장지방 증가, 심혈관 질환 위험" },
    { id: uid(), name: "BMI", description: "체질량지수는 키 대비 체중의 비율로, 비만도를 간접적으로 평가합니다.", normalRange: "18.5~24.9", riskDescription: "25 이상 과체중, 30 이상 비만 판정" },
  ],

  musculoskeletalItems: [
    { id: uid(), area: "어깨", analysisPoint: "좌우 높이 차이, 전방 말림(라운드 숄더) 여부 확인", painPattern: "어깨 전방 말림 시 승모근 과긴장, 회전근개 약화로 어깨 통증 유발" },
    { id: uid(), area: "골반", analysisPoint: "좌우 골반 높이, 전방/후방 경사(틸트) 확인", painPattern: "골반 전방경사 시 요추 과전만으로 허리 통증, 후방경사 시 둔근 약화" },
    { id: uid(), area: "척추", analysisPoint: "측만 여부, 흉추 후만(굽은 등) 정도 확인", painPattern: "흉추 후만 시 호흡 제한, 어깨 가동범위 감소" },
    { id: uid(), area: "무릎", analysisPoint: "내반슬(O다리)/외반슬(X다리) 여부, 슬개골 트래킹 확인", painPattern: "외반슬 시 무릎 내측 인대 스트레스, 스쿼트 시 통증 유발" },
  ],

  comprehensiveMent: "회원님의 체성분 분석과 근골격 검사를 종합해보면, 현재 체지방률이 다소 높은 상태에서 코어 근력이 부족한 것으로 보입니다. 이 두 가지가 결합되면 일상생활에서의 허리 통증과 운동 시 부상 위험이 높아질 수 있습니다.",
  riskConnectionMent: "체지방이 높으면서 골격근량이 부족하면 기초대사량이 낮아 살이 더 쉽게 찝니다. 여기에 자세 불균형까지 있으면 운동을 해도 효율이 떨어지고, 잘못된 자세로 인한 부상 위험이 커집니다.",
  lifestyleConnectionMent: "장시간 앉아서 근무하시는 분들에게서 많이 보이는 패턴입니다. 앉는 시간이 길수록 고관절 굴곡근이 단축되고 둔근이 약해져서, 서 있을 때 골반이 앞으로 기울어지는 현상이 나타납니다.",

  exerciseNeedMent: "우리 몸은 '쓰지 않으면 퇴화한다'는 원칙을 따릅니다. 현재 근골격 불균형 상태에서 운동 없이 생활하면, 5년 후에는 만성 통증과 대사질환의 위험이 크게 높아집니다.",
  soloVsProMent: "혼자 운동하면 본인이 편한 동작만 반복하게 됩니다. 이미 강한 근육만 더 강해지고, 약한 근육은 계속 약한 채로 남아 불균형이 심화됩니다. 전문 트레이너는 약한 부분을 정확히 찾아내고, 올바른 자세로 교정하면서 운동 효과를 극대화합니다.",
  proAdvantagesMent: "1. 체계적인 프로그램으로 목표 달성 시간 단축\n2. 정확한 자세 교정으로 부상 예방\n3. 식단 관리 가이드 병행\n4. 동기부여와 책임감 부여\n5. 주기적 체성분 측정으로 객관적 변화 확인",

  programs: [
    { id: uid(), name: "체형교정 + 다이어트 프로그램", frequency: "주 3회", duration: "3개월 (36회)", target: "체지방 감량 + 자세 교정이 필요한 분", expectedResult: "체지방 5~8% 감량, 근골격 밸런스 개선" },
    { id: uid(), name: "근력 강화 프로그램", frequency: "주 3회", duration: "2개월 (24회)", target: "근육량 증가를 원하는 분", expectedResult: "골격근량 2~3kg 증가, 기초대사량 향상" },
    { id: uid(), name: "기초체력 향상 프로그램", frequency: "주 2회", duration: "1개월 (8회)", target: "운동 초보자, 체력이 약한 분", expectedResult: "기초 체력 향상, 올바른 운동 습관 형성" },
  ],

  pricePackages: [
    { id: uid(), name: "프리미엄 36회", sessions: "36회 (3개월)", originalPrice: "3,600,000원", discountedPrice: "2,880,000원" },
    { id: uid(), name: "스탠다드 24회", sessions: "24회 (2개월)", originalPrice: "2,400,000원", discountedPrice: "2,040,000원" },
    { id: uid(), name: "스타터 12회", sessions: "12회 (1개월)", originalPrice: "1,200,000원", discountedPrice: "1,080,000원" },
  ],
  anchoringMent: "가장 많은 회원님들이 선택하시는 24회 패키지를 추천드립니다. 12회는 운동 습관이 자리잡기 전에 끝나는 경우가 많고, 36회는 장기적으로 체형 변화를 원하시는 분들께 최적입니다.",
  discountConditionMent: "오늘 상담 당일 등록 시 특별 할인가가 적용됩니다. 또한 지인 추천 시 추가 2회 무료 제공해 드립니다.",

  objections: [
    { id: uid(), customerSays: "헬스만 해도 되지 않나요?", responseScript: "물론 헬스장에서 혼자 운동하실 수도 있습니다. 하지만 아까 확인하신 것처럼 현재 자세 불균형이 있는 상태에서 혼자 운동하면, 잘못된 자세가 고착되고 오히려 통증이 악화될 수 있습니다. 처음 3개월만이라도 정확한 자세를 배우시면, 이후에 혼자 운동하실 때도 효과가 완전히 달라집니다." },
    { id: uid(), customerSays: "가격이 너무 비싸요", responseScript: "충분히 이해합니다. 그런데 한 번 생각해보시면, 24회 기준 1회당 85,000원인데, 이 안에 체성분 분석, 식단 관리, 자세 교정이 모두 포함됩니다. 병원에서 물리치료 한 번 받으시면 5만원인데, 통증이 생기고 나서 치료하는 비용 vs 미리 예방하는 비용을 비교해보시면 오히려 경제적입니다." },
    { id: uid(), customerSays: "생각해볼게요", responseScript: "네, 당연히 신중하게 결정하셔야죠. 다만 한 가지만 말씀드리면, 오늘 측정 결과에서 보셨듯이 현재 상태가 그대로 6개월, 1년 지속되면 더 교정하기 어려워집니다. 당장은 아니더라도 가까운 시일 내에 시작하시는 걸 추천드려요. 혹시 어떤 부분이 가장 고민되시나요?" },
  ],

  followUpScenarios: [
    { id: uid(), timing: "상담 당일 (미등록 시)", message: "안녕하세요, 회원님! 오늘 상담 오셔서 감사했습니다. 오늘 측정하신 체성분 결과 다시 정리해서 보내드립니다. 혹시 추가로 궁금하신 점 있으시면 편하게 연락 주세요!" },
    { id: uid(), timing: "3일 후", message: "회원님, 잘 지내고 계시죠? 지난번 상담에서 말씀드린 코어 강화 운동, 집에서 하실 수 있는 간단한 루틴 영상 보내드릴까요? 부담 없이 먼저 시작해보시는 것도 좋을 것 같아서요!" },
    { id: uid(), timing: "7일 후", message: "회원님, 일주일 동안 혹시 운동은 해보셨나요? 이번 주 내로 등록하시면 체험 1회를 무료로 드리고 있는데, 직접 한번 경험해보시는 건 어떠세요? 부담 없이 한번 와보세요!" },
  ],
  reconsultMent: "상담 이후 2주가 지나면 재상담을 권유합니다. 시간이 지나면 동기가 사라지기 때문에, 따뜻하고 부담 없는 톤으로 재방문을 유도합니다.",
  firstSessionGuideMent: "첫 수업 전 안내 사항:\n1. 편한 운동복과 실내화를 준비해주세요\n2. 수업 1시간 전에는 가벼운 식사를 마쳐주세요\n3. 개인 수건과 물은 준비해주시면 좋습니다\n4. 첫 수업은 기초 체력 테스트와 운동 자세 교정 위주로 진행됩니다\n5. 수업 시간 10분 전에 도착해주시면 여유있게 준비할 수 있습니다",
};

const pilatesTemplate: Omit<SalesbookData, "jobType" | "customJobTitle" | "designConceptId"> = {
  trainerName: "",
  centerName: "",
  experienceYears: "",
  certificates: [{ id: uid(), name: "필라테스 지도자 자격증" }],
  profilePhotoUrl: "",
  openingMent:
    "안녕하세요! 오늘 방문해주셔서 감사합니다. 저는 이곳에서 회원님들의 체형 관리와 바른 자세를 도와드리고 있는 필라테스 강사입니다. 오늘은 간단한 체형 분석을 통해 현재 몸의 상태를 확인하고, 회원님에게 맞는 필라테스 프로그램을 안내해드리겠습니다.",
  introPhilosophy:
    "저는 '몸의 균형'을 가장 중요하게 생각합니다. 필라테스는 단순한 운동이 아니라, 몸의 정렬을 바로잡고 코어를 활성화하여 일상의 움직임 자체를 변화시키는 운동입니다. 외형적 변화뿐 아니라 통증 없는 건강한 몸을 만들어드리는 것이 제 철학입니다.",

  bodyCompItems: [
    { id: uid(), name: "체중", description: "체중은 참고 지표입니다. 필라테스에서는 체중보다 체형의 밸런스와 근육의 질을 더 중요하게 봅니다.", normalRange: "BMI 18.5~24.9 기준", riskDescription: "과체중 시 관절에 부담이 가며 자세 교정 효과가 감소할 수 있습니다" },
    { id: uid(), name: "코어 근력", description: "코어 근육은 모든 움직임의 기초입니다. 필라테스의 핵심 목표이기도 합니다.", normalRange: "복부/요추부 근력 균형 유지", riskDescription: "코어 약화 시 요통 발생, 사지 운동 효율 저하" },
    { id: uid(), name: "체지방률", description: "체지방률은 체형 라인과 직결됩니다. 필라테스와 식단 관리를 병행하면 체지방 감량에 효과적입니다.", normalRange: "여성 18~28%, 남성 10~20%", riskDescription: "체지방 과다 시 유연성 제한, 근막 유착 가능성 증가" },
    { id: uid(), name: "체형 밸런스", description: "좌우, 상하체 근육량 차이를 확인합니다. 이 차이가 클수록 자세 불균형의 원인이 됩니다.", normalRange: "좌우 차이 5% 이내", riskDescription: "밸런스 불균형 시 한쪽으로 보상 작용, 만성 통증 유발" },
  ],

  musculoskeletalItems: [
    { id: uid(), area: "척추 정렬", analysisPoint: "경추-흉추-요추의 자연스러운 커브 유지 여부 확인", painPattern: "척추 정렬 불균형 시 디스크 압박, 만성 요통/경추 통증" },
    { id: uid(), area: "골반 틀어짐", analysisPoint: "골반 전후방 경사, 좌우 높이 차이, 회전 여부 확인", painPattern: "골반 틀어짐 시 고관절 통증, 다리 길이 차이, 보행 패턴 이상" },
    { id: uid(), area: "어깨 정렬", analysisPoint: "양쪽 어깨 높이, 견갑골 위치, 날개뼈 돌출 여부 확인", painPattern: "어깨 불균형 시 승모근 과긴장, 두통, 팔 저림" },
    { id: uid(), area: "코어 안정성", analysisPoint: "복횡근 활성화 정도, 호흡 패턴, 늑골 벌어짐 확인", painPattern: "코어 불안정 시 복부 돌출, 요추 과전만, 운동 시 보상 작용" },
  ],

  comprehensiveMent: "회원님의 체형 분석 결과를 보면, 코어 근력이 다소 약한 상태에서 골반이 틀어져 있는 것으로 보입니다. 이 상태가 지속되면 허리와 골반 주변 통증이 점점 심해질 수 있습니다. 필라테스를 통해 코어를 먼저 활성화하고, 틀어진 정렬을 바로잡는 것이 우선입니다.",
  riskConnectionMent: "코어가 약한 상태에서 골반이 틀어져 있으면, 걷거나 앉아 있을 때 한쪽으로 체중이 쏠리면서 무릎과 허리에 부담이 집중됩니다. 시간이 지날수록 통증이 반복되고, 일상생활의 질이 떨어집니다.",
  lifestyleConnectionMent: "특히 오래 앉아 계시거나 한 자세로 오래 일하시는 분들에게 많이 보이는 패턴입니다. 필라테스는 이런 일상 습관에서 오는 체형 불균형을 교정하는 데 가장 효과적인 운동입니다.",

  exerciseNeedMent: "우리 몸은 매일의 자세 습관에 의해 만들어집니다. 지금의 체형 불균형을 방치하면, 3~5년 후에는 만성 통증으로 발전할 가능성이 높습니다. 지금이 가장 빠르게 교정할 수 있는 시점입니다.",
  soloVsProMent: "유튜브를 보고 따라하시는 분들이 많은데, 필라테스는 '정확한 자세'가 전부입니다. 1~2도의 각도 차이, 호흡 타이밍 하나가 효과를 결정합니다. 전문 강사가 직접 터치하며 교정해야 제대로 된 효과를 얻으실 수 있습니다.",
  proAdvantagesMent: "1. 1:1 맞춤 체형 교정 프로그램\n2. 정확한 호흡법과 코어 활성화 지도\n3. 기구(리포머/캐딜락) 활용으로 효과 극대화\n4. 통증 원인에 맞는 재활 운동 병행\n5. 주기적 체형 사진 비교로 변화 확인",

  programs: [
    { id: uid(), name: "체형교정 정규반", frequency: "주 2회", duration: "3개월 (24회)", target: "자세 교정, 만성 통증 개선이 필요한 분", expectedResult: "척추/골반 정렬 개선, 코어 근력 강화, 통증 완화" },
    { id: uid(), name: "다이어트 필라테스", frequency: "주 3회", duration: "2개월 (24회)", target: "체형 라인 변화와 체지방 감량을 원하는 분", expectedResult: "체지방 감소, 탄력 있는 바디라인 형성" },
    { id: uid(), name: "1:1 프리미엄 개인반", frequency: "주 2회", duration: "1개월 (8회)", target: "빠른 교정과 집중 관리가 필요한 분", expectedResult: "맞춤형 체형 교정, 개인별 약점 집중 보완" },
  ],

  pricePackages: [
    { id: uid(), name: "프리미엄 개인 24회", sessions: "24회 (3개월)", originalPrice: "2,880,000원", discountedPrice: "2,400,000원" },
    { id: uid(), name: "정규 그룹반 24회", sessions: "24회 (3개월)", originalPrice: "960,000원", discountedPrice: "840,000원" },
    { id: uid(), name: "체험 4회", sessions: "4회 (2주)", originalPrice: "400,000원", discountedPrice: "320,000원" },
  ],
  anchoringMent: "개인 레슨이 가장 빠른 효과를 보시지만, 비용이 부담되시면 그룹반으로 시작하셔도 좋습니다. 먼저 체험 4회로 필라테스가 본인에게 맞는지 확인해보시는 것을 추천드립니다.",
  discountConditionMent: "오늘 상담 당일 등록 시 특별 할인가가 적용됩니다. 그룹반은 친구와 함께 등록 시 추가 10% 할인됩니다.",

  objections: [
    { id: uid(), customerSays: "유튜브 보고 해도 되지 않나요?", responseScript: "유튜브 영상도 도움이 되지만, 영상으로는 본인의 자세가 맞는지 확인할 수 없습니다. 아까 확인하신 것처럼 회원님의 골반이 틀어진 상태에서 잘못된 동작을 반복하면 오히려 악화될 수 있습니다. 처음에 정확한 자세를 잡아드리면, 나중에 혼자 하실 때도 훨씬 효과적입니다." },
    { id: uid(), customerSays: "효과가 있나요?", responseScript: "필라테스는 의학적으로도 검증된 운동입니다. 특히 척추 정렬과 코어 강화에 있어서는 물리치료에서도 권장하는 운동이에요. 저희 센터 회원님들의 경우, 평균 2개월 이내에 통증 감소와 체형 변화를 체감하십니다. 체형 사진 비교로 직접 확인하실 수 있어요." },
    { id: uid(), customerSays: "가격이 좀 부담돼요", responseScript: "이해합니다. 그래서 저희가 그룹반도 운영하고 있어요. 그룹반은 개인의 절반 이하 가격이면서도 소수 정원(4~6명)으로 진행해서 충분히 개인 교정을 받으실 수 있습니다. 먼저 체험 4회로 시작해보시는 건 어떠세요?" },
  ],

  followUpScenarios: [
    { id: uid(), timing: "상담 당일 (미등록 시)", message: "안녕하세요, 회원님! 오늘 방문해주셔서 감사했습니다 :) 오늘 확인한 체형 분석 결과 정리해서 보내드릴게요. 궁금하신 점 있으시면 편하게 연락 주세요!" },
    { id: uid(), timing: "3일 후", message: "회원님, 안녕하세요! 지난번 상담에서 말씀드린 집에서 할 수 있는 간단한 코어 운동 영상 보내드릴게요. 하루 10분만 해보셔도 차이를 느끼실 거예요!" },
    { id: uid(), timing: "7일 후", message: "회원님, 일주일 잘 보내셨나요? 이번 주 체험 수업 자리가 있어서 안내드려요. 직접 한번 경험해보시면 필라테스가 어떤 운동인지 확실히 느끼실 수 있을 거예요. 부담 없이 한번 오세요!" },
  ],
  reconsultMent: "상담 후 1~2주 내에 자연스럽게 재방문을 유도합니다. 무료 체험 수업이나 자세 재측정 등을 명목으로 부담 없이 재방문할 수 있는 기회를 제공합니다.",
  firstSessionGuideMent: "첫 수업 전 안내 사항:\n1. 몸에 밀착되는 편한 운동복을 준비해주세요 (기구 레슨 시 헐렁한 옷은 위험합니다)\n2. 양말을 꼭 착용해주세요 (미끄럼 방지 양말 권장)\n3. 수업 2시간 전에는 식사를 마쳐주세요\n4. 첫 수업은 호흡법과 코어 활성화 위주로 부드럽게 진행됩니다\n5. 수업 시간 10분 전에 도착해주시면 좋습니다",
};

const yogaTemplate: Omit<SalesbookData, "jobType" | "customJobTitle" | "designConceptId"> = {
  ...pilatesTemplate,
  certificates: [{ id: uid(), name: "요가 지도자 자격증 (RYT-200)" }],
  openingMent: "안녕하세요! 오늘 방문해주셔서 감사합니다. 저는 이곳에서 회원님들의 심신 균형과 유연한 몸을 도와드리는 요가 강사입니다. 오늘은 간단한 체형 확인을 통해 현재 몸 상태를 살펴보고, 회원님에게 맞는 요가 프로그램을 안내해드리겠습니다.",
  introPhilosophy: "저는 '몸과 마음의 연결'을 중시합니다. 요가는 단순한 스트레칭이 아니라, 호흡과 움직임을 통해 내면의 평화와 신체적 균형을 동시에 찾아가는 여정입니다. 유연성뿐 아니라 강인한 코어와 안정된 마음을 만들어드리겠습니다.",
  exerciseNeedMent: "현대인의 몸은 스트레스와 잘못된 자세로 인해 경직되어 있습니다. 요가를 통해 이 경직을 풀어주지 않으면, 시간이 지날수록 유연성이 떨어지고 만성 통증으로 발전합니다.",
  soloVsProMent: "요가는 '안전한 범위'를 아는 것이 핵심입니다. 무리하게 따라하다 인대를 다치는 경우가 많습니다. 전문 강사가 회원님의 유연성 수준에 맞게 동작을 조절하고, 올바른 호흡을 안내합니다.",
  programs: [
    { id: uid(), name: "하타 요가 정규반", frequency: "주 3회", duration: "3개월", target: "유연성 향상, 스트레스 해소가 필요한 분", expectedResult: "유연성 향상, 수면의 질 개선, 스트레스 감소" },
    { id: uid(), name: "빈야사 플로우", frequency: "주 2회", duration: "2개월", target: "다이나믹한 운동을 원하는 분", expectedResult: "체력 향상, 체지방 감소, 근력 강화" },
    { id: uid(), name: "1:1 테라피 요가", frequency: "주 2회", duration: "1개월 (8회)", target: "통증 관리, 재활이 필요한 분", expectedResult: "통증 완화, 관절 가동범위 향상" },
  ],
};

const crossfitTemplate: Omit<SalesbookData, "jobType" | "customJobTitle" | "designConceptId"> = {
  ...ptTemplate,
  certificates: [{ id: uid(), name: "CrossFit Level 1 Trainer" }],
  openingMent: "반갑습니다! 오늘 상담 오신 걸 환영합니다. 저는 이곳에서 크로스핏 프로그램을 이끌고 있는 코치입니다. 오늘 체성분 측정 결과를 바탕으로 현재 체력 수준을 파악하고, 회원님에게 맞는 트레이닝 프로그램을 제안해드리겠습니다.",
  introPhilosophy: "저는 '기능적 체력'을 추구합니다. 보여주기 위한 근육이 아니라, 실생활에서 쓸 수 있는 진짜 체력을 만드는 것이 크로스핏의 핵심입니다. 커뮤니티의 에너지 속에서 자신의 한계를 넘어서는 경험을 함께 하겠습니다.",
  exerciseNeedMent: "일상에서 필요한 체력 — 무거운 것을 들고, 빠르게 움직이고, 오래 버티는 능력 — 은 의도적으로 훈련하지 않으면 나이가 들수록 급격히 떨어집니다. 크로스핏은 이 모든 체력 요소를 종합적으로 훈련합니다.",
  soloVsProMent: "크로스핏의 동작들(올림픽 리프팅, 짐나스틱)은 기술적 난이도가 높습니다. 코치 없이 혼자 배우면 부상 위험이 매우 높습니다. 전문 코치가 단계별로 기술을 가르치고, 개인 체력에 맞게 무게와 강도를 조절합니다.",
  programs: [
    { id: uid(), name: "온램프 프로그램 (입문)", frequency: "주 3회", duration: "1개월 (12회)", target: "크로스핏 처음 시작하는 분", expectedResult: "기본 동작 습득, 기초 체력 향상" },
    { id: uid(), name: "크로스핏 정규 클래스", frequency: "주 5회 (자유 참석)", duration: "월 정기권", target: "기본 동작을 마친 분", expectedResult: "전반적 체력 향상, 체성분 개선" },
    { id: uid(), name: "1:1 퍼스널 코칭", frequency: "주 2회", duration: "2개월 (16회)", target: "특정 약점 보완이 필요한 분", expectedResult: "약점 동작 개선, 기록 향상" },
  ],
};

const groupTemplate: Omit<SalesbookData, "jobType" | "customJobTitle" | "designConceptId"> = {
  ...ptTemplate,
  certificates: [{ id: uid(), name: "그룹운동 지도자 자격증" }],
  openingMent: "안녕하세요! 오늘 방문해주셔서 감사합니다. 저는 이곳에서 다양한 그룹 운동 프로그램을 진행하고 있는 강사입니다. 오늘은 회원님의 체력 수준과 운동 목표를 파악하고, 가장 적합한 클래스를 안내해드리겠습니다.",
  introPhilosophy: "저는 '함께하는 에너지'의 힘을 믿습니다. 혼자 하면 포기할 운동도 그룹에서 함께하면 즐거워집니다. 수준별 맞춤 클래스로 누구나 안전하고 효과적으로 운동할 수 있도록 이끌겠습니다.",
  exerciseNeedMent: "운동의 가장 큰 적은 '지루함'입니다. 그룹 운동은 다양한 프로그램과 함께하는 동기부여로 운동을 '습관'으로 만들어줍니다. 꾸준함이 가장 중요한 요소입니다.",
  programs: [
    { id: uid(), name: "서킷 트레이닝", frequency: "주 3회", duration: "월 정기권", target: "전신 체력 향상, 다이어트를 원하는 분", expectedResult: "체지방 감소, 심폐 지구력 향상" },
    { id: uid(), name: "스피닝/사이클", frequency: "주 2~3회", duration: "월 정기권", target: "유산소 운동을 즐기는 분", expectedResult: "심폐 기능 강화, 하체 근력 향상" },
    { id: uid(), name: "바디컨디셔닝", frequency: "주 2회", duration: "월 정기권", target: "체형 관리, 밸런스 향상을 원하는 분", expectedResult: "코어 강화, 유연성 향상, 자세 개선" },
  ],
};

const emptyTemplate: Omit<SalesbookData, "jobType" | "customJobTitle" | "designConceptId"> = {
  trainerName: "",
  centerName: "",
  experienceYears: "",
  certificates: [{ id: uid(), name: "" }],
  profilePhotoUrl: "",
  openingMent: "",
  introPhilosophy: "",
  bodyCompItems: [
    { id: uid(), name: "", description: "", normalRange: "", riskDescription: "" },
  ],
  musculoskeletalItems: [
    { id: uid(), area: "", analysisPoint: "", painPattern: "" },
  ],
  comprehensiveMent: "",
  riskConnectionMent: "",
  lifestyleConnectionMent: "",
  exerciseNeedMent: "",
  soloVsProMent: "",
  proAdvantagesMent: "",
  programs: [
    { id: uid(), name: "", frequency: "", duration: "", target: "", expectedResult: "" },
  ],
  pricePackages: [
    { id: uid(), name: "", sessions: "", originalPrice: "", discountedPrice: "" },
  ],
  anchoringMent: "",
  discountConditionMent: "",
  objections: [
    { id: uid(), customerSays: "", responseScript: "" },
  ],
  followUpScenarios: [
    { id: uid(), timing: "", message: "" },
  ],
  reconsultMent: "",
  firstSessionGuideMent: "",
};

export const templates: Record<JobType, Omit<SalesbookData, "jobType" | "customJobTitle" | "designConceptId">> = {
  pt: ptTemplate,
  pilates: pilatesTemplate,
  yoga: yogaTemplate,
  crossfit: crossfitTemplate,
  group: groupTemplate,
  custom: emptyTemplate,
};

export const jobTypeLabels: Record<JobType, string> = {
  pt: "PT 트레이너",
  pilates: "필라테스 강사",
  yoga: "요가 강사",
  crossfit: "크로스핏 코치",
  group: "그룹운동 강사",
  custom: "직접 입력",
};

export const jobTypeColors: Record<JobType, { primary: string; gradient: string; accent: string; bg: string }> = {
  pt: { primary: "#e74c3c", gradient: "from-red-600 to-orange-500", accent: "text-red-600", bg: "bg-red-50" },
  pilates: { primary: "#9b59b6", gradient: "from-purple-500 to-pink-400", accent: "text-purple-600", bg: "bg-purple-50" },
  yoga: { primary: "#27ae60", gradient: "from-emerald-500 to-teal-400", accent: "text-emerald-600", bg: "bg-emerald-50" },
  crossfit: { primary: "#2c3e50", gradient: "from-gray-800 to-gray-600", accent: "text-gray-700", bg: "bg-gray-50" },
  group: { primary: "#f39c12", gradient: "from-amber-500 to-yellow-400", accent: "text-amber-600", bg: "bg-amber-50" },
  custom: { primary: "#3498db", gradient: "from-blue-500 to-indigo-500", accent: "text-blue-600", bg: "bg-blue-50" },
};
