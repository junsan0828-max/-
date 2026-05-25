import { GraduationCap, BookOpen, Play, TrendingUp, Users, Star, Lock, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import TabBanner from "@/components/TabBanner";

const CATEGORIES = [
  {
    key: "sales",
    label: "영업 & 상담",
    icon: <Users className="h-5 w-5" />,
    color: "text-blue-500",
    bg: "bg-blue-50",
    desc: "첫 상담부터 계약까지, 전환율을 높이는 실전 노하우",
    courses: [
      { title: "첫 상담 10분 안에 신뢰 얻는 법", duration: "18분", locked: false },
      { title: "가격 저항 없애는 상담 스크립트", duration: "22분", locked: false },
      { title: "재등록율 90% 만드는 관리 루틴", duration: "15분", locked: true },
      { title: "SNS로 유입되는 고객 상담 전환법", duration: "25분", locked: true },
    ],
  },
  {
    key: "pt",
    label: "PT 프로그래밍",
    icon: <TrendingUp className="h-5 w-5" />,
    color: "text-green-600",
    bg: "bg-green-50",
    desc: "과학적 근거 기반의 효율적인 운동 프로그램 설계법",
    courses: [
      { title: "체형별 맞춤 프로그램 설계 기초", duration: "30분", locked: false },
      { title: "초보자 첫 달 루틴 완전 정복", duration: "20분", locked: false },
      { title: "다이어트 vs 벌크업 분기별 계획", duration: "28분", locked: true },
      { title: "재활·통증 고객을 위한 수정 운동", duration: "35분", locked: true },
    ],
  },
  {
    key: "brand",
    label: "트레이너 브랜딩",
    icon: <Star className="h-5 w-5" />,
    color: "text-amber-500",
    bg: "bg-amber-50",
    desc: "나만의 전문성을 알리고 팬을 만드는 퍼스널 브랜딩",
    courses: [
      { title: "인스타그램으로 문의 받는 콘텐츠 전략", duration: "24분", locked: false },
      { title: "블로그 SEO로 지역 고객 유입하기", duration: "20분", locked: true },
      { title: "유튜브 쇼츠로 전문가 이미지 구축", duration: "18분", locked: true },
      { title: "카카오채널 활용 CRM 운영법", duration: "15분", locked: true },
    ],
  },
  {
    key: "business",
    label: "수익 & 운영",
    icon: <BookOpen className="h-5 w-5" />,
    color: "text-purple-500",
    bg: "bg-purple-50",
    desc: "프리랜서·1인 사업자로 안정적인 수익 구조 만들기",
    courses: [
      { title: "세금·보험료 아끼는 트레이너 절세법", duration: "20분", locked: false },
      { title: "PT 가격 올리는 포지셔닝 전략", duration: "22분", locked: true },
      { title: "온라인 PT 확장으로 월 200만 추가 수익", duration: "30분", locked: true },
      { title: "팀 운영·부트캠프로 스케일업 하기", duration: "35분", locked: true },
    ],
  },
];

export default function Academy() {
  return (
    <div className="space-y-5">
      <TabBanner tabKey="academy" />

      {/* 헤더 */}
      <div className="rounded-2xl bg-gradient-to-br from-primary to-primary/70 p-5 text-white space-y-2">
        <div className="flex items-center gap-2">
          <GraduationCap className="h-6 w-6" />
          <span className="font-bold text-lg">성장 아카데미</span>
        </div>
        <p className="text-sm text-white/80 leading-relaxed">
          매출을 늘리고 싶은 트레이너를 위한 실전 강의. 상담·브랜딩·PT 프로그래밍까지 한 곳에서 배우세요.
        </p>
        <div className="flex items-center gap-4 pt-1">
          <div className="text-center">
            <p className="font-bold text-xl">16+</p>
            <p className="text-xs text-white/70">강의</p>
          </div>
          <div className="w-px h-8 bg-white/20" />
          <div className="text-center">
            <p className="font-bold text-xl">4</p>
            <p className="text-xs text-white/70">카테고리</p>
          </div>
          <div className="w-px h-8 bg-white/20" />
          <div className="text-center">
            <p className="font-bold text-xl">무료</p>
            <p className="text-xs text-white/70">일부 강의</p>
          </div>
        </div>
      </div>

      {/* 카테고리별 강의 */}
      <div className="space-y-4">
        {CATEGORIES.map(cat => (
          <Card key={cat.key} className="bg-card border-border overflow-hidden">
            <div className={`flex items-center gap-3 px-4 py-3 ${cat.bg} border-b border-border`}>
              <span className={cat.color}>{cat.icon}</span>
              <div>
                <p className="font-bold text-sm">{cat.label}</p>
                <p className="text-xs text-muted-foreground">{cat.desc}</p>
              </div>
            </div>
            <CardContent className="p-0">
              {cat.courses.map((course, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-3 px-4 py-3 border-b border-border last:border-0 ${course.locked ? "opacity-60" : "cursor-pointer hover:bg-muted/30 active:bg-muted/50"}`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${course.locked ? "bg-muted" : cat.bg}`}>
                    {course.locked
                      ? <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                      : <Play className={`h-3.5 w-3.5 ${cat.color}`} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{course.title}</p>
                    <p className="text-xs text-muted-foreground">{course.duration}</p>
                  </div>
                  {!course.locked && <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>

      <p className="text-xs text-center text-muted-foreground pb-4">
        잠긴 강의는 순차적으로 업데이트됩니다 · 무료 강의부터 시작해보세요
      </p>
    </div>
  );
}
