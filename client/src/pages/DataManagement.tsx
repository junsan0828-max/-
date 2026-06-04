import { useState } from "react";
import {
  Database, TrendingUp, Users, Megaphone, Building2,
  ChevronDown, ChevronUp, Download, BarChart3, CreditCard,
  UserCheck, UserX, CalendarDays, Dumbbell, ClipboardList,
  Lock, Shirt, PhoneCall, Target, RefreshCw, Activity,
} from "lucide-react";

type DataItem = {
  icon: React.ElementType;
  label: string;
  desc: string;
};

type Category = {
  key: string;
  label: string;
  color: string;
  bgColor: string;
  icon: React.ElementType;
  items: DataItem[];
};

const categories: Category[] = [
  {
    key: "finance",
    label: "재무",
    color: "text-emerald-400",
    bgColor: "bg-emerald-500/10 border-emerald-500/20",
    icon: TrendingUp,
    items: [
      { icon: CreditCard, label: "매출 장부", desc: "기간별 매출 내역 및 수금 현황" },
      { icon: BarChart3, label: "매출 통계", desc: "월별·유형별 매출 분석 데이터" },
      { icon: UserX, label: "미수금 현황", desc: "결제 미완료 및 잔금 회원 목록" },
      { icon: RefreshCw, label: "환불 내역", desc: "환불 처리된 결제 이력" },
    ],
  },
  {
    key: "customer",
    label: "고객",
    color: "text-blue-400",
    bgColor: "bg-blue-500/10 border-blue-500/20",
    icon: Users,
    items: [
      { icon: UserCheck, label: "전체 회원 목록", desc: "회원 기본 정보 및 등록 현황" },
      { icon: CalendarDays, label: "만료 회원", desc: "이용권 만료 예정 및 만료된 회원" },
      { icon: Dumbbell, label: "PT 패키지 현황", desc: "회원별 PT 잔여 횟수 및 만료일" },
      { icon: Activity, label: "출석 현황", desc: "회원 출석 이력 및 방문 패턴" },
    ],
  },
  {
    key: "marketing",
    label: "마케팅",
    color: "text-violet-400",
    bgColor: "bg-violet-500/10 border-violet-500/20",
    icon: Megaphone,
    items: [
      { icon: PhoneCall, label: "상담 내역", desc: "전체 상담 기록 및 결과 이력" },
      { icon: Target, label: "전환율 분석", desc: "상담에서 등록까지 전환 통계" },
      { icon: BarChart3, label: "채널별 유입 통계", desc: "마케팅 채널별 신규 상담 현황" },
      { icon: UserCheck, label: "신규·재등록 통계", desc: "기간별 신규 및 재등록 현황" },
    ],
  },
  {
    key: "operations",
    label: "센터 운영",
    color: "text-amber-400",
    bgColor: "bg-amber-500/10 border-amber-500/20",
    icon: Building2,
    items: [
      { icon: ClipboardList, label: "업무 일지", desc: "트레이너·컨설턴트 업무 기록" },
      { icon: Lock, label: "락커 현황", desc: "락커 사용 및 배정 현황" },
      { icon: Shirt, label: "운동복 현황", desc: "운동복 대여 및 반납 이력" },
      { icon: Dumbbell, label: "트레이너 실적", desc: "트레이너별 PT 진행 및 실적 현황" },
    ],
  },
];

export default function DataManagementPage() {
  const [openKeys, setOpenKeys] = useState<string[]>(["finance", "customer", "marketing", "operations"]);

  const toggle = (key: string) =>
    setOpenKeys(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold flex items-center gap-2">
        <Database className="h-5 w-5 text-primary" />
        데이터 관리
      </h1>

      <div className="space-y-3">
        {categories.map(cat => {
          const isOpen = openKeys.includes(cat.key);
          const Icon = cat.icon;
          return (
            <div key={cat.key} className="bg-card border border-border rounded-2xl overflow-hidden">
              {/* 카테고리 헤더 */}
              <button
                onClick={() => toggle(cat.key)}
                className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <div className={`p-1.5 rounded-lg ${cat.bgColor} border`}>
                    <Icon className={`h-4 w-4 ${cat.color}`} />
                  </div>
                  <span className="text-sm font-semibold text-foreground">{cat.label}</span>
                  <span className="text-xs text-muted-foreground">{cat.items.length}개 항목</span>
                </div>
                {isOpen
                  ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  : <ChevronDown className="h-4 w-4 text-muted-foreground" />
                }
              </button>

              {/* 항목 목록 */}
              {isOpen && (
                <div className="border-t border-border divide-y divide-border">
                  {cat.items.map((item) => {
                    const ItemIcon = item.icon;
                    return (
                      <div
                        key={item.label}
                        className="flex items-center justify-between px-4 py-3 hover:bg-accent/30 transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <ItemIcon className={`h-4 w-4 shrink-0 ${cat.color} opacity-70`} />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground">{item.label}</p>
                            <p className="text-xs text-muted-foreground truncate">{item.desc}</p>
                          </div>
                        </div>
                        <button className="ml-3 shrink-0 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground border border-border hover:border-foreground/30 rounded-lg px-2.5 py-1.5 transition-colors">
                          <Download className="h-3 w-3" />
                          내보내기
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
