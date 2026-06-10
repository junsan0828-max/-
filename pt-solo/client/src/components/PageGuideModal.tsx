import { X } from "lucide-react";

interface PageGuide {
  emoji: string;
  title: string;
  desc: string;
  tips: string[];
}

const GUIDES: Record<string, PageGuide> = {
  "/": {
    emoji: "📊",
    title: "대시보드",
    desc: "오늘의 현황을 한눈에 확인하는 홈 화면입니다.",
    tips: [
      "오늘 수업 예정 회원과 완료된 세션 현황을 빠르게 파악하세요.",
      "미납금, 만료 임박 회원 등 관리가 필요한 항목을 확인하세요.",
      "상단 공지사항과 새 기능 알림도 여기서 확인할 수 있습니다.",
    ],
  },
  "/pt": {
    emoji: "🏋️",
    title: "회원 관리",
    desc: "등록된 회원 정보와 PT 현황을 관리합니다.",
    tips: [
      "+ 버튼으로 신규 회원을 등록하세요.",
      "회원 카드를 탭하면 세션 기록, 결제 내역, 체성분 등 상세 정보를 확인할 수 있습니다.",
      "검색창에서 이름이나 전화번호로 빠르게 찾을 수 있습니다.",
    ],
  },
  "/sessions": {
    emoji: "📋",
    title: "수업 관리",
    desc: "수업 완료 체크와 세션 기록을 관리합니다.",
    tips: [
      "날짜별로 수업 진행 현황을 확인하세요.",
      "완료 버튼을 누르면 회원의 잔여 횟수가 자동 차감됩니다.",
      "운동 내용, 특이사항 등을 메모로 남길 수 있습니다.",
    ],
  },
  "/leads": {
    emoji: "👥",
    title: "상담실",
    desc: "잠재 고객 상담과 등록 전환을 관리합니다.",
    tips: [
      "새 상담 문의가 들어오면 여기서 확인하고 단계를 이동하세요.",
      "상담 단계(문의 → 상담 → 체험 → 등록)를 단계별로 관리하세요.",
      "메모와 연락 이력을 기록해 체계적으로 관리하세요.",
    ],
  },
  "/booking": {
    emoji: "📅",
    title: "수업 예약 관리",
    desc: "예약 설정, 시간 관리, 예약 현황을 확인합니다.",
    tips: [
      "시간 관리 탭에서 요일별 예약 가능 시간을 설정하세요.",
      "오전 / 점심 / 오후 / 저녁 그룹을 탭하면 해당 시간대를 한 번에 선택합니다.",
      "▼를 눌러 펼치면 개별 시간을 세세하게 조정할 수 있습니다.",
      "저장 후 슬롯 자동 생성을 누르면 예약 달력에 즉시 반영됩니다.",
    ],
  },
  "/settlement": {
    emoji: "📈",
    title: "성장분석실",
    desc: "매출, 정산, 성장 지표를 분석합니다.",
    tips: [
      "월별 매출과 수업 횟수 추이를 그래프로 확인하세요.",
      "회원별 결제 내역과 미납 현황을 파악하세요.",
      "분기별 성장률을 통해 목표를 점검하세요.",
    ],
  },
  "/academy": {
    emoji: "🎓",
    title: "성장 아카데미",
    desc: "트레이너 성장을 위한 교육 콘텐츠입니다.",
    tips: [
      "영상 강의와 자료를 통해 전문성을 키우세요.",
      "완료한 강의는 수료 내역에 기록됩니다.",
      "새 콘텐츠가 업로드되면 알림을 받을 수 있습니다.",
    ],
  },
  "/workshop": {
    emoji: "🛠️",
    title: "작업실",
    desc: "브랜드 페이지, 계약서, 설문 등 업무 도구를 관리합니다.",
    tips: [
      "브랜드 페이지를 설정하면 회원에게 전문적인 페이지를 공유할 수 있습니다.",
      "전자계약서와 설문지를 회원에게 온라인으로 발송하세요.",
      "도구를 활성화/비활성화하여 내 업무에 맞게 커스텀하세요.",
    ],
  },
  "/profile": {
    emoji: "👤",
    title: "내 프로필",
    desc: "프로필 정보, 플랜, 포인트를 관리합니다.",
    tips: [
      "트레이너 소개, 사진, 자격증 등을 입력해 브랜드 페이지에 노출하세요.",
      "플랜 업그레이드로 관리 가능한 회원 수를 늘릴 수 있습니다.",
      "보유 포인트는 플랜 결제 시 일부 차감하여 사용할 수 있습니다.",
    ],
  },
  "/admin/trainers": {
    emoji: "🛡️",
    title: "STEPER 관리",
    desc: "등록된 트레이너 현황을 확인하고 관리합니다.",
    tips: [
      "오렌지 테두리 카드는 관리가 필요한 위험군 트레이너입니다.",
      "이름, 아이디, 전화번호로 검색하거나 플랜 필터로 분류하세요.",
      "트레이너를 탭하면 상세 정보, 플랜 변경, 메모 작성이 가능합니다.",
    ],
  },
  "/admin/plans": {
    emoji: "💳",
    title: "플랜 관리",
    desc: "구독료, 할인율, 회원 수 한도를 설정합니다.",
    tips: [
      "플랜별 월 구독료를 변경하면 모든 STEPER에게 즉시 적용됩니다.",
      "할인율을 입력하면 실시간으로 최종 금액이 미리보기됩니다.",
      "플랜 구매 신청 대기 항목을 승인하거나 거절하세요.",
    ],
  },
  "/admin/points": {
    emoji: "🪙",
    title: "포인트 관리",
    desc: "STEPER 포인트 지급 및 내역을 관리합니다.",
    tips: [
      "포인트를 개별 트레이너에게 지급하거나 차감할 수 있습니다.",
      "전체 포인트 지급 내역을 여기서 확인하세요.",
    ],
  },
  "/admin/notices": {
    emoji: "📢",
    title: "공지 / 배너",
    desc: "공지사항과 메인 배너를 관리합니다.",
    tips: [
      "새 공지를 작성하면 모든 STEPER의 대시보드에 표시됩니다.",
      "배너 이미지와 연결 링크를 설정하세요.",
    ],
  },
  "/admin/fit-step-plus": {
    emoji: "⚡",
    title: "FIT STEP+",
    desc: "FIT STEP Plus 기능과 설정을 관리합니다.",
    tips: [
      "Plus 전용 기능의 활성화 여부를 여기서 제어합니다.",
      "각 트레이너의 Plus 상태를 확인하고 관리하세요.",
    ],
  },
};

function storageKey(path: string) {
  return `guide-dismissed${path.replace(/\//g, "-") || "-home"}`;
}

export function shouldShowGuide(path: string): boolean {
  const guide = matchGuide(path);
  if (!guide) return false;
  return !localStorage.getItem(storageKey(path));
}

function matchGuide(path: string): PageGuide | null {
  if (GUIDES[path]) return GUIDES[path];
  // prefix match for nested paths (e.g. /admin/trainers/123 → /admin/trainers)
  const prefix = Object.keys(GUIDES)
    .filter(k => k !== "/" && path.startsWith(k))
    .sort((a, b) => b.length - a.length)[0];
  return prefix ? GUIDES[prefix] : null;
}

export default function PageGuideModal({ path, onClose }: { path: string; onClose: () => void }) {
  const guide = matchGuide(path);
  if (!guide) return null;

  function handleDismiss() {
    localStorage.setItem(storageKey(path), "1");
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-5">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card/95 backdrop-blur border border-border rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        {/* 닫기 버튼 */}
        <button onClick={onClose} className="absolute top-3 right-3 p-1 text-muted-foreground hover:text-foreground transition-colors">
          <X className="h-4 w-4" />
        </button>

        {/* 헤더 */}
        <div className="px-6 pt-6 pb-4 text-center space-y-1.5 border-b border-border/60">
          <div className="text-4xl leading-none">{guide.emoji}</div>
          <h2 className="text-base font-bold mt-2">{guide.title}</h2>
          <p className="text-xs text-muted-foreground leading-relaxed">{guide.desc}</p>
        </div>

        {/* 팁 목록 */}
        <ul className="px-6 py-4 space-y-3">
          {guide.tips.map((tip, i) => (
            <li key={i} className="flex items-start gap-2.5">
              <span className="mt-0.5 shrink-0 w-4 h-4 rounded-full bg-primary/15 text-primary text-[10px] font-bold flex items-center justify-center">{i + 1}</span>
              <span className="text-xs text-foreground/85 leading-relaxed">{tip}</span>
            </li>
          ))}
        </ul>

        {/* 버튼 */}
        <div className="px-6 pb-6 flex gap-2">
          <button onClick={handleDismiss}
            className="flex-1 py-2.5 rounded-xl border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:border-border/80 transition-colors">
            다시 안보기
          </button>
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-opacity">
            확인
          </button>
        </div>
      </div>
    </div>
  );
}
