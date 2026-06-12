import { X, LayoutDashboard, Dumbbell, BookOpen, UserPlus, CalendarCheck, TrendingUp, GraduationCap, Wrench, User, ShieldCheck, CreditCard, Coins, Bell, Zap, MessageSquarePlus, ClipboardList, type LucideIcon } from "lucide-react";

interface PageGuide {
  icon: LucideIcon;
  color: string;
  title: string;
  desc: string;
  tips: string[];
}

const GUIDES: Record<string, PageGuide> = {
  "/": {
    icon: LayoutDashboard,
    color: "bg-blue-500/15 text-blue-500",
    title: "대시보드",
    desc: "오늘의 현황을 한눈에 확인하는 홈 화면입니다.",
    tips: [
      "오늘 수업 예정 회원과 완료된 세션 현황을 빠르게 파악하세요.",
      "미납금, 만료 임박 회원 등 관리가 필요한 항목을 확인하세요.",
      "상단 공지사항과 새 기능 알림도 여기서 확인할 수 있습니다.",
    ],
  },
  "/pt": {
    icon: Dumbbell,
    color: "bg-violet-500/15 text-violet-500",
    title: "회원 관리",
    desc: "등록된 회원 정보와 PT 현황을 관리합니다.",
    tips: [
      "+ 버튼으로 신규 회원을 등록하세요.",
      "회원 카드를 탭하면 세션 기록, 결제 내역, 체성분 등 상세 정보를 확인할 수 있습니다.",
      "검색창에서 이름이나 전화번호로 빠르게 찾을 수 있습니다.",
    ],
  },
  "/sessions": {
    icon: BookOpen,
    color: "bg-green-500/15 text-green-500",
    title: "수업 관리",
    desc: "수업 완료 체크와 세션 기록을 관리합니다.",
    tips: [
      "날짜별로 수업 진행 현황을 확인하세요.",
      "완료 버튼을 누르면 회원의 잔여 횟수가 자동 차감됩니다.",
      "운동 내용, 특이사항 등을 메모로 남길 수 있습니다.",
    ],
  },
  "/leads": {
    icon: UserPlus,
    color: "bg-amber-500/15 text-amber-500",
    title: "상담실",
    desc: "잠재 고객 상담과 등록 전환을 관리합니다.",
    tips: [
      "새 상담 문의가 들어오면 여기서 확인하고 단계를 이동하세요.",
      "상담 단계(문의 → 상담 → 체험 → 등록)를 단계별로 관리하세요.",
      "메모와 연락 이력을 기록해 체계적으로 관리하세요.",
    ],
  },
  "/booking": {
    icon: CalendarCheck,
    color: "bg-cyan-500/15 text-cyan-500",
    title: "수업 예약 관리",
    desc: "예약 설정, 시간 관리, 예약 현황을 확인합니다.",
    tips: [
      "시간 관리 탭에서 요일별 예약 가능 시간을 설정하세요.",
      "오전 / 점심 / 오후 / 저녁 그룹을 탭하면 해당 시간대를 한 번에 선택합니다.",
      "저장 후 슬롯 자동 생성을 누르면 예약 달력에 즉시 반영됩니다.",
    ],
  },
  "/settlement": {
    icon: TrendingUp,
    color: "bg-emerald-500/15 text-emerald-500",
    title: "성장분석실",
    desc: "매출, 정산, 성장 지표를 분석합니다.",
    tips: [
      "월별 매출과 수업 횟수 추이를 그래프로 확인하세요.",
      "회원별 결제 내역과 미납 현황을 파악하세요.",
      "분기별 성장률을 통해 목표를 점검하세요.",
    ],
  },
  "/academy": {
    icon: GraduationCap,
    color: "bg-indigo-500/15 text-indigo-500",
    title: "성장 아카데미",
    desc: "트레이너 성장을 위한 교육 콘텐츠입니다.",
    tips: [
      "영상 강의와 자료를 통해 전문성을 키우세요.",
      "완료한 강의는 수료 내역에 기록됩니다.",
      "새 콘텐츠가 업로드되면 알림을 받을 수 있습니다.",
    ],
  },
  "/workshop": {
    icon: Wrench,
    color: "bg-orange-500/15 text-orange-500",
    title: "작업실",
    desc: "브랜드 페이지, 계약서, 설문 등 업무 도구를 관리합니다.",
    tips: [
      "브랜드 페이지를 설정하면 회원에게 전문적인 페이지를 공유할 수 있습니다.",
      "전자계약서와 설문지를 회원에게 온라인으로 발송하세요.",
      "도구를 활성화/비활성화하여 내 업무에 맞게 커스텀하세요.",
    ],
  },
  "/profile": {
    icon: User,
    color: "bg-slate-500/15 text-slate-400",
    title: "내 프로필",
    desc: "프로필 정보, 플랜, 포인트를 관리합니다.",
    tips: [
      "트레이너 소개, 사진, 자격증 등을 입력해 브랜드 페이지에 노출하세요.",
      "플랜 업그레이드로 관리 가능한 회원 수를 늘릴 수 있습니다.",
      "보유 포인트는 플랜 결제 시 일부 차감하여 사용할 수 있습니다.",
    ],
  },
  "/admin/trainers": {
    icon: ShieldCheck,
    color: "bg-blue-500/15 text-blue-500",
    title: "STEPER 관리",
    desc: "등록된 트레이너 현황을 확인하고 관리합니다.",
    tips: [
      "오렌지 테두리 카드는 관리가 필요한 위험군 트레이너입니다.",
      "이름, 아이디, 전화번호로 검색하거나 플랜 필터로 분류하세요.",
      "트레이너를 탭하면 상세 정보, 플랜 변경, 메모 작성이 가능합니다.",
    ],
  },
  "/admin/plans": {
    icon: CreditCard,
    color: "bg-violet-500/15 text-violet-500",
    title: "플랜 관리",
    desc: "구독료, 할인율, 회원 수 한도를 설정합니다.",
    tips: [
      "플랜별 월 구독료를 변경하면 모든 STEPER에게 즉시 적용됩니다.",
      "할인율을 입력하면 실시간으로 최종 금액이 미리보기됩니다.",
      "플랜 구매 신청 대기 항목을 승인하거나 거절하세요.",
    ],
  },
  "/admin/points": {
    icon: Coins,
    color: "bg-yellow-500/15 text-yellow-500",
    title: "포인트 관리",
    desc: "STEPER 포인트 지급 및 내역을 관리합니다.",
    tips: [
      "포인트를 개별 트레이너에게 지급하거나 차감할 수 있습니다.",
      "전체 포인트 지급 내역을 여기서 확인하세요.",
    ],
  },
  "/admin/notices": {
    icon: Bell,
    color: "bg-rose-500/15 text-rose-500",
    title: "공지 / 배너",
    desc: "공지사항과 메인 배너를 관리합니다.",
    tips: [
      "새 공지를 작성하면 모든 STEPER의 대시보드에 표시됩니다.",
      "배너 이미지와 연결 링크를 설정하세요.",
    ],
  },
  "/feedback": {
    icon: MessageSquarePlus,
    color: "bg-rose-500/15 text-rose-500",
    title: "작업 / 오류 수정",
    desc: "운영팀에 직접 오류 신고 및 작업 요청을 보냅니다.",
    tips: [
      "오류가 발생한 경우 재현 방법을 상세히 작성해 주세요.",
      "기능 개선 아이디어나 작업 요청도 여기서 보낼 수 있습니다.",
      "운영팀이 답변을 남기면 요청 목록에서 확인할 수 있습니다.",
    ],
  },
  "/admin/feedback": {
    icon: ClipboardList,
    color: "bg-rose-500/15 text-rose-500",
    title: "작업 / 오류 데이터",
    desc: "STEPER가 보낸 요청과 오류 신고를 관리합니다.",
    tips: [
      "상태(접수됨/처리 중/완료/반려)를 변경하여 진행 상황을 알려주세요.",
      "답변을 입력하면 STEPER의 요청 화면에 바로 표시됩니다.",
      "유형 필터로 오류/작업/개선/문의를 구분하여 확인하세요.",
    ],
  },
  "/admin/fit-step-plus": {
    icon: Zap,
    color: "bg-primary/15 text-primary",
    title: "FIT STEP+",
    desc: "FIT STEP Plus 기능과 설정을 관리합니다.",
    tips: [
      "Plus 전용 기능의 활성화 여부를 여기서 제어합니다.",
      "각 트레이너의 Plus 상태를 확인하고 관리하세요.",
    ],
  },
};

// 경로를 정규화된 가이드 키로 변환
function canonicalKey(path: string): string | null {
  if (GUIDES[path]) return path;
  const prefix = Object.keys(GUIDES)
    .filter(k => k !== "/" && path.startsWith(k))
    .sort((a, b) => b.length - a.length)[0];
  return prefix ?? null;
}

function storageKey(key: string) {
  return `guide-dismissed${key.replace(/\//g, "-") || "-home"}`;
}

function sessionKey(key: string) {
  return `guide-seen${key.replace(/\//g, "-") || "-home"}`;
}

// 런타임 인메모리 dismissed 세트 — localStorage/sessionStorage 실패 시에도 동일 세션 내 재노출 방지
const runtimeDismissed = new Set<string>();

function safeGet(storage: Storage, key: string): string | null {
  try { return storage.getItem(key); } catch { return null; }
}
function safeSet(storage: Storage, key: string, value: string) {
  try { storage.setItem(key, value); } catch { /* noop */ }
}

export function shouldShowGuide(path: string): boolean {
  const key = canonicalKey(path);
  if (!key) return false;
  if (runtimeDismissed.has(key)) return false;
  if (safeGet(localStorage, storageKey(key))) return false;
  if (safeGet(sessionStorage, sessionKey(key))) return false;
  return true;
}

function matchGuide(path: string): PageGuide | null {
  const key = canonicalKey(path);
  return key ? GUIDES[key] : null;
}

export default function PageGuideModal({ path, onClose }: { path: string; onClose: () => void }) {
  const guide = matchGuide(path);
  if (!guide) return null;

  const Icon = guide.icon;
  const key = canonicalKey(path) ?? path;

  function handleDismiss() {
    runtimeDismissed.add(key);
    safeSet(localStorage, storageKey(key), "1");
    safeSet(sessionStorage, sessionKey(key), "1");
    onClose();
  }

  function handleConfirm() {
    runtimeDismissed.add(key);
    safeSet(sessionStorage, sessionKey(key), "1");
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-5">
      <div className="absolute inset-0 z-0 bg-black/50" onClick={onClose} />
      <div className="relative z-10 bg-card border border-border rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        {/* 닫기 */}
        <button onClick={handleConfirm} className="absolute top-3.5 right-3.5 p-1 text-muted-foreground hover:text-foreground transition-colors">
          <X className="h-4 w-4" />
        </button>

        {/* 헤더 */}
        <div className="px-6 pt-7 pb-5 text-center space-y-3 border-b border-border/60">
          <div className={`inline-flex items-center justify-center w-12 h-12 rounded-2xl ${guide.color}`}>
            <Icon className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-sm font-bold">{guide.title}</h2>
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{guide.desc}</p>
          </div>
        </div>

        {/* 팁 */}
        <ul className="px-6 py-5 space-y-3.5">
          {guide.tips.map((tip, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="mt-0.5 shrink-0 w-4 h-4 rounded-full bg-primary/15 text-primary text-[10px] font-bold flex items-center justify-center">{i + 1}</span>
              <span className="text-xs text-foreground/80 leading-relaxed">{tip}</span>
            </li>
          ))}
        </ul>

        {/* 버튼 */}
        <div className="px-6 pb-6 flex gap-2">
          <button onClick={handleDismiss}
            className="flex-1 py-2.5 rounded-xl border border-border text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
            다시 안보기
          </button>
          <button onClick={handleConfirm}
            className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-opacity">
            확인
          </button>
        </div>
      </div>
    </div>
  );
}
