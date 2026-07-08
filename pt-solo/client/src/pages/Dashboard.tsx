import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Users, Dumbbell, TrendingUp, Calendar,
  AlertTriangle, ChevronRight, RefreshCw, Clock, BookOpen, ShieldCheck,
  Zap, FileText, CalendarCheck, BarChart3, Globe, UtensilsCrossed, ScanLine, UserPlus,
  Lock, Cpu, ArrowRight,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import TabBanner from "@/components/TabBanner";

// ─── 아바타 색상 ──────────────────────────────────────────────────────────────
const AVATAR_GRADIENTS = [
  "from-amber-400 to-orange-500",
  "from-emerald-400 to-teal-500",
  "from-blue-400 to-indigo-500",
  "from-pink-400 to-rose-500",
  "from-violet-400 to-purple-500",
  "from-cyan-400 to-blue-500",
];

// ─── 툴 그리드 ────────────────────────────────────────────────────────────────
type ToolItem = {
  label: string;
  icon: React.ElementType;
  colorCls: string;
  bgCls: string;
  borderCls: string;
  onClick: () => void;
  badge?: number | null;
  locked?: boolean;
};

function ToolGrid({ items }: { items: ToolItem[] }) {
  return (
    <div className="grid grid-cols-4 gap-3">
      {items.map((item) => (
        <button
          key={item.label}
          onClick={item.locked ? undefined : item.onClick}
          className="flex flex-col items-center gap-1.5 group"
        >
          <div
            className={`relative w-14 h-14 rounded-[18px] ${item.bgCls} border ${item.borderCls} flex items-center justify-center transition-all active:scale-90 ${item.locked ? "opacity-40" : ""}`}
          >
            <item.icon className={`h-5 w-5 ${item.colorCls}`} />
            {item.badge != null && item.badge > 0 && (
              <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 border-2 border-background">
                {item.badge > 99 ? "99+" : item.badge}
              </span>
            )}
            {item.locked && (
              <div className="absolute -top-1 -right-1 w-[18px] h-[18px] bg-background border border-border rounded-[5px] flex items-center justify-center">
                <Lock className="h-2.5 w-2.5 text-muted-foreground" />
              </div>
            )}
          </div>
          <span
            className={`text-[10.5px] font-semibold text-center leading-tight ${
              item.locked ? "text-muted-foreground/40" : "text-foreground/65 group-hover:text-foreground"
            } transition-colors`}
          >
            {item.label}
          </span>
        </button>
      ))}
    </div>
  );
}

// ─── 운영자(Admin) SaaS 대시보드 ──────────────────────────────────────────────
function AdminDashboard() {
  const [, setLocation] = useLocation();
  const { data: stats } = trpc.admin.getSaasStats.useQuery();
  const { data: trainerList } = trpc.admin.listTrainers.useQuery();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">FIT STEP 운영 현황</h1>
        <p className="text-sm text-muted-foreground mt-0.5">서비스 전체 통계</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "가입 STEPER", value: `${stats?.totalTrainers ?? 0}명`, icon: ShieldCheck, color: "text-blue-400" },
          { label: "누적 회원", value: `${stats?.totalMembers ?? 0}명`, icon: Users, color: "text-green-400" },
          { label: "누적 수업", value: `${stats?.totalSessions ?? 0}회`, icon: Dumbbell, color: "text-purple-400" },
        ].map((card) => (
          <Card key={card.label} className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-muted-foreground">{card.label}</p>
                <card.icon className={`h-4 w-4 ${card.color}`} />
              </div>
              <p className="text-xl font-bold">{card.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />가입 STEPER
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {!trainerList || trainerList.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">가입된 STEPER가 없습니다.</p>
          ) : (
            trainerList.map((t) => (
              <button
                key={t.id}
                onClick={() => setLocation(`/admin/trainers/${t.id}`)}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg bg-accent/20 border border-border hover:border-primary/30 hover:bg-accent/40 transition-colors text-left"
              >
                <div>
                  <p className="text-sm font-medium">{t.trainerName}</p>
                  <p className="text-xs text-muted-foreground">
                    @{t.username} · 가입 {t.createdAt?.slice(0, 10) ?? "-"}
                    {t.phone && <span className="ml-1">· {t.phone}</span>}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-xs font-semibold text-blue-400">{t.memberCount}명</p>
                    <p className="text-xs text-muted-foreground">{t.sessionCount}세션</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </div>
              </button>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── 배너 & 공지 ──────────────────────────────────────────────────────────────
function BannerAndNotices() {
  const { data: banner } = trpc.banner.get.useQuery();
  const { data: notices } = trpc.notices.list.useQuery();
  const [selectedNotice, setSelectedNotice] = useState<{ id: number; title: string; content: string; createdAt: string } | null>(null);

  const hasContent = (banner?.isActive) || (notices && notices.length > 0);
  if (!hasContent) return null;

  if (selectedNotice) {
    return (
      <div className="space-y-3">
        <button onClick={() => setSelectedNotice(null)} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
          ← 이벤트 목록
        </button>
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <span className="inline-block text-[10px] font-semibold bg-primary/20 text-primary px-2 py-0.5 rounded-full">공지</span>
          <h2 className="text-base font-bold leading-snug">{selectedNotice.title}</h2>
          <p className="text-xs text-muted-foreground">{selectedNotice.createdAt.slice(0, 10)}</p>
          <div className="rounded-xl bg-accent/20 border border-border px-4 py-3">
            <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{selectedNotice.content}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {banner?.isActive && (
        <a href={banner.link || undefined} target={banner.link ? "_blank" : undefined} rel="noreferrer"
          className={`flex items-center gap-3 px-4 py-3 rounded-xl ${banner.link ? "cursor-pointer" : "cursor-default"}`}
          style={{ backgroundColor: banner.bgColor }}>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-white leading-tight">{banner.text}</p>
            {banner.subText && <p className="text-xs text-white/80 mt-0.5">{banner.subText}</p>}
          </div>
          {banner.link && <div className="text-white/80 text-xs shrink-0">→</div>}
        </a>
      )}
      {notices && notices.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold">이벤트 &amp; 공지</p>
            {notices.length > 3 && (
              <button className="text-xs text-primary">전체보기 →</button>
            )}
          </div>
          <div className="space-y-2">
            {notices.slice(0, 3).map(n => (
              <button key={n.id} onClick={() => setSelectedNotice(n)}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-xl bg-accent/20 border border-border hover:bg-accent/40 transition-colors text-left">
                <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
                  <span className="text-lg">📢</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{n.isPinned && <span className="text-primary mr-1">[필독]</span>}{n.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{n.createdAt.slice(0, 10)}</p>
                </div>
                <span className="text-muted-foreground text-xs shrink-0">→</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── 작업실 프로모 배너 ────────────────────────────────────────────────────────
function WorkshopPromoBanner({ onStart }: { onStart: () => void }) {
  return (
    <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-[#0f172a] via-[#1e1b4b] to-[#0f172a] px-5 pt-6 pb-5 text-white">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute bottom-0 left-0 w-28 h-28 rounded-full bg-violet-500/20 blur-2xl" />
      </div>
      <div className="relative inline-flex items-center gap-1.5 bg-primary/20 border border-primary/30 rounded-full px-3 py-1 mb-3">
        <Zap className="h-3 w-3 text-primary" />
        <span className="text-[11px] font-bold text-primary tracking-wide">FIT STEP 작업실</span>
      </div>
      <div className="relative space-y-1.5 mb-4">
        <h2 className="text-[18px] font-black leading-tight tracking-tight">
          수업만 하는 트레이너에서,<br />
          <span className="text-primary">브랜드를 만드는</span> 전문가로
        </h2>
        <p className="text-xs text-white/55 leading-relaxed">전자계약 · 예약관리 · 보고서 · 개인 브랜딩을 시작하세요.</p>
      </div>
      <div className="relative grid grid-cols-4 gap-1.5 mb-4">
        {[
          { icon: FileText, label: "전자계약" },
          { icon: CalendarCheck, label: "예약관리" },
          { icon: BarChart3, label: "보고서" },
          { icon: Globe, label: "브랜딩" },
        ].map(f => (
          <div key={f.label} className="flex flex-col items-center gap-1 bg-white/8 rounded-xl py-2.5 border border-white/10">
            <f.icon className="h-4 w-4 text-primary" />
            <span className="text-[10px] font-semibold text-white/70">{f.label}</span>
          </div>
        ))}
      </div>
      <button onClick={onStart}
        className="relative w-full py-3 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:opacity-90 active:scale-[0.98] transition-all">
        30일 전체 기능 무료 체험 시작 →
      </button>
    </div>
  );
}

// ─── 트레이너 대시보드 ────────────────────────────────────────────────────────
function TrainerDashboard() {
  const [, setLocation] = useLocation();
  const { data: user } = trpc.auth.me.useQuery();
  const { data: stats, isLoading } = trpc.dashboard.getStats.useQuery();
  const { data: allMembers } = trpc.members.list.useQuery();
  const { data: wsStatus } = trpc.workshop.getStatus.useQuery();
  const { data: expiring } = trpc.members.getExpiring.useQuery({ days: 7 });
  const { data: unpaid } = trpc.members.getWithUnpaid.useQuery();
  const { data: lowSessions } = trpc.members.getLowSessions.useQuery({ threshold: 5 });

  const startTrialMutation = trpc.workshop.startTrial.useMutation({
    onSuccess: () => { toast.success("30일 전체 기능 무료 체험이 시작되었습니다!"); setLocation("/workshop"); },
    onError: (e) => toast.error(e.message),
  });

  const [todayModalOpen, setTodayModalOpen] = useState(false);
  const [ptStatsModalOpen, setPtStatsModalOpen] = useState(false);
  const todayStr = new Date().toISOString().split("T")[0];
  const { data: todayAttendanceList } = trpc.attendanceChecks.listByDate.useQuery(
    { date: todayStr },
    { enabled: todayModalOpen }
  );
  const { data: memberSessionStats } = trpc.pt.memberSessionStats.useQuery(
    undefined,
    { enabled: ptStatsModalOpen }
  );

  if (isLoading) return <LoadingSkeleton />;

  const userPlan = (user as any)?.plan ?? "free";
  const isProOrElite = userPlan === "pro" || userPlan === "elite";
  const trainerName = (user as any)?.trainerName ?? "트레이너";
  const recentMembers = allMembers?.slice(0, 8) ?? [];

  return (
    <div className="space-y-5">
      <TabBanner tabKey="dashboard" />
      <BannerAndNotices />

      {wsStatus?.status === "unopened" && (
        <WorkshopPromoBanner onStart={() => startTrialMutation.mutate()} />
      )}

      {/* 인사말 */}
      <div className="pt-1">
        <p className="text-xs font-semibold text-muted-foreground tracking-widest uppercase">안녕하세요</p>
        <h1 className="text-[22px] font-bold tracking-tight mt-0.5 leading-snug">
          {trainerName}님,<br />
          오늘 <span className="text-primary">무엇을 시작</span>할까요?
        </h1>
      </div>

      {/* 주요 액션 카드 */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => setLocation("/pt?register=1")}
          className="relative overflow-hidden rounded-3xl p-5 text-left flex flex-col justify-between min-h-[140px] active:scale-95 transition-transform"
          style={{ background: "linear-gradient(145deg, #4F46E5 0%, #7C3AED 100%)", boxShadow: "0 8px 24px rgba(79,70,229,.25)" }}
        >
          <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center">
            <UserPlus className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="text-[15px] font-bold text-white">회원 등록</p>
            <p className="text-[11px] text-white/65 mt-0.5">새 회원을 빠르게 등록</p>
          </div>
          <div className="absolute bottom-4 right-4 w-7 h-7 rounded-xl bg-white/20 flex items-center justify-center">
            <ArrowRight className="h-3.5 w-3.5 text-white" />
          </div>
        </button>

        <button
          onClick={() => setLocation("/attendance")}
          className="relative overflow-hidden rounded-3xl p-5 text-left flex flex-col justify-between min-h-[140px] active:scale-95 transition-transform"
          style={{ background: "linear-gradient(145deg, #0EA5E9 0%, #10B981 100%)", boxShadow: "0 8px 24px rgba(14,165,233,.2)" }}
        >
          <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center">
            <Dumbbell className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="text-[15px] font-bold text-white">수업 시작</p>
            <p className="text-[11px] text-white/65 mt-0.5">오늘 PT 바로 기록</p>
          </div>
          <div className="absolute bottom-4 right-4 w-7 h-7 rounded-xl bg-white/20 flex items-center justify-center">
            <ArrowRight className="h-3.5 w-3.5 text-white" />
          </div>
        </button>
      </div>

      {/* 최근 회원 */}
      {recentMembers.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-bold">최근 회원</p>
            <button onClick={() => setLocation("/members")} className="text-xs font-semibold text-primary">
              전체보기
            </button>
          </div>
          <div
            className="flex gap-3 overflow-x-auto pb-1 -mx-4 px-4"
            style={{ scrollbarWidth: "none" }}
          >
            {recentMembers.map((m) => (
              <button
                key={m.id}
                onClick={() => setLocation(`/members/${m.id}`)}
                className="flex flex-col items-center gap-1.5 flex-shrink-0 active:scale-90 transition-transform"
              >
                <div
                  className={`w-14 h-14 rounded-[18px] bg-gradient-to-br ${AVATAR_GRADIENTS[m.id % AVATAR_GRADIENTS.length]} flex items-center justify-center`}
                  style={{ boxShadow: "0 2px 8px rgba(0,0,0,.1)" }}
                >
                  <span className="text-lg font-bold text-white">{m.name.charAt(0)}</span>
                </div>
                <span className="text-[10.5px] font-semibold text-foreground/65 text-center w-14 truncate">
                  {m.name}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ─── 툴 그룹: 회원 관리 ─── */}
      <div className="rounded-2xl bg-card border border-border p-4">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-6 h-6 rounded-lg bg-indigo-500/10 flex items-center justify-center">
            <Users className="h-3.5 w-3.5 text-indigo-500" />
          </div>
          <span className="text-sm font-bold">회원 관리</span>
        </div>
        <ToolGrid items={[
          {
            label: "회원 목록", icon: Users,
            colorCls: "text-indigo-500", bgCls: "bg-indigo-500/10", borderCls: "border-indigo-500/20",
            onClick: () => setLocation("/members"),
          },
          {
            label: "회원 등록", icon: UserPlus,
            colorCls: "text-indigo-500", bgCls: "bg-indigo-500/10", borderCls: "border-indigo-500/20",
            onClick: () => setLocation("/pt?register=1"),
          },
          {
            label: "만료 임박", icon: Clock,
            colorCls: "text-amber-500", bgCls: "bg-amber-500/10", borderCls: "border-amber-500/20",
            onClick: () => setLocation("/members"),
            badge: expiring?.length ?? null,
          },
          {
            label: "미수금", icon: AlertTriangle,
            colorCls: "text-orange-500", bgCls: "bg-orange-500/10", borderCls: "border-orange-500/20",
            onClick: () => setLocation("/members"),
            badge: unpaid?.length ?? null,
          },
        ]} />
      </div>

      {/* ─── 툴 그룹: 수업 ─── */}
      <div className="rounded-2xl bg-card border border-border p-4">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-6 h-6 rounded-lg bg-emerald-500/10 flex items-center justify-center">
            <Dumbbell className="h-3.5 w-3.5 text-emerald-500" />
          </div>
          <span className="text-sm font-bold">수업</span>
        </div>
        <ToolGrid items={[
          {
            label: "수업 하기", icon: Dumbbell,
            colorCls: "text-emerald-500", bgCls: "bg-emerald-500/10", borderCls: "border-emerald-500/20",
            onClick: () => setLocation("/attendance"),
          },
          {
            label: "오늘 출석", icon: CalendarCheck,
            colorCls: "text-teal-500", bgCls: "bg-teal-500/10", borderCls: "border-teal-500/20",
            onClick: () => setTodayModalOpen(true),
            badge: stats?.todayAttendances ?? null,
          },
          {
            label: "이번달 수업", icon: BarChart3,
            colorCls: "text-violet-500", bgCls: "bg-violet-500/10", borderCls: "border-violet-500/20",
            onClick: () => setPtStatsModalOpen(true),
          },
          {
            label: "수업 일지", icon: BookOpen,
            colorCls: "text-blue-500", bgCls: "bg-blue-500/10", borderCls: "border-blue-500/20",
            onClick: () => setLocation("/members"),
          },
        ]} />
      </div>

      {/* ─── 툴 그룹: 매출 & 정산 ─── */}
      <div className="rounded-2xl bg-card border border-border p-4">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-6 h-6 rounded-lg bg-emerald-500/10 flex items-center justify-center">
            <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
          </div>
          <span className="text-sm font-bold">매출 &amp; 정산</span>
        </div>
        <ToolGrid items={[
          {
            label: "일일 매출", icon: TrendingUp,
            colorCls: "text-emerald-500", bgCls: "bg-emerald-500/10", borderCls: "border-emerald-500/20",
            onClick: () => setLocation("/settlement?view=daily"),
          },
          {
            label: "월 매출", icon: BarChart3,
            colorCls: "text-blue-500", bgCls: "bg-blue-500/10", borderCls: "border-blue-500/20",
            onClick: () => setLocation("/settlement?view=monthly"),
          },
          {
            label: "재등록 안내", icon: RefreshCw,
            colorCls: "text-cyan-500", bgCls: "bg-cyan-500/10", borderCls: "border-cyan-500/20",
            onClick: () => setLocation("/members"),
            badge: lowSessions?.length ?? null,
          },
          {
            label: "정산 관리", icon: FileText,
            colorCls: "text-slate-400", bgCls: "bg-slate-500/10", borderCls: "border-slate-500/20",
            onClick: () => setLocation("/settlement"),
          },
        ]} />
      </div>

      {/* ─── 툴 그룹: AI & 분석 ─── */}
      <div className="rounded-2xl bg-card border border-border p-4">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-6 h-6 rounded-lg bg-violet-500/10 flex items-center justify-center">
            <Cpu className="h-3.5 w-3.5 text-violet-500" />
          </div>
          <span className="text-sm font-bold">AI &amp; 분석</span>
          <span className="ml-auto text-[10px] font-bold text-violet-500 bg-violet-500/10 px-2 py-0.5 rounded-full">NEW</span>
        </div>
        <ToolGrid items={[
          {
            label: "체형 분석", icon: ScanLine,
            colorCls: "text-violet-500", bgCls: "bg-violet-500/10", borderCls: "border-violet-500/20",
            onClick: () => window.open("https://noble-unity-production-8100.up.railway.app/posture", "_blank"),
          },
          {
            label: "맞춤 식단", icon: UtensilsCrossed,
            colorCls: "text-emerald-500", bgCls: "bg-emerald-500/10", borderCls: "border-emerald-500/20",
            onClick: () => window.open("https://noble-unity-production-8100.up.railway.app/?ref=fitstep", "_blank"),
          },
          {
            label: "AI 추천", icon: Zap,
            colorCls: "text-violet-500", bgCls: "bg-violet-500/10", borderCls: "border-violet-500/20",
            onClick: () => setLocation("/workshop"),
            locked: !isProOrElite,
          },
          {
            label: "AI 리포트", icon: FileText,
            colorCls: "text-violet-500", bgCls: "bg-violet-500/10", borderCls: "border-violet-500/20",
            onClick: () => setLocation("/workshop"),
            locked: !isProOrElite,
          },
        ]} />
      </div>

      {/* ─── 툴 그룹: 브랜딩 & 작업실 ─── */}
      <div className="rounded-2xl bg-card border border-border p-4">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-6 h-6 rounded-lg bg-pink-500/10 flex items-center justify-center">
            <Globe className="h-3.5 w-3.5 text-pink-500" />
          </div>
          <span className="text-sm font-bold">브랜딩 &amp; 작업실</span>
        </div>
        <ToolGrid items={[
          {
            label: "작업실", icon: Zap,
            colorCls: "text-indigo-500", bgCls: "bg-indigo-500/10", borderCls: "border-indigo-500/20",
            onClick: () => setLocation("/workshop"),
          },
          {
            label: "브랜드 페이지", icon: Globe,
            colorCls: "text-pink-500", bgCls: "bg-pink-500/10", borderCls: "border-pink-500/20",
            onClick: () => setLocation("/workshop"),
          },
          {
            label: "전자계약", icon: FileText,
            colorCls: "text-blue-500", bgCls: "bg-blue-500/10", borderCls: "border-blue-500/20",
            onClick: () => setLocation("/workshop"),
          },
          {
            label: "설문 관리", icon: CalendarCheck,
            colorCls: "text-teal-500", bgCls: "bg-teal-500/10", borderCls: "border-teal-500/20",
            onClick: () => setLocation("/workshop"),
          },
        ]} />
      </div>

      {/* AI 추천 배너 */}
      <button
        onClick={() => setLocation("/workshop")}
        className="w-full relative overflow-hidden rounded-2xl p-5 flex items-center gap-4 text-left active:scale-[0.98] transition-transform"
        style={{
          background: "linear-gradient(130deg, #1E40AF 0%, #4F46E5 55%, #7C3AED 100%)",
          boxShadow: "0 8px 28px rgba(79,70,229,.28)",
        }}
      >
        <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-white/5 -translate-y-8 translate-x-8 pointer-events-none" />
        <div className="absolute bottom-0 right-16 w-20 h-20 rounded-full bg-white/5 translate-y-8 pointer-events-none" />
        <div className="w-12 h-12 rounded-2xl bg-white/15 flex items-center justify-center flex-shrink-0">
          <Cpu className="h-6 w-6 text-white" />
        </div>
        <div className="flex-1 relative">
          <p className="text-[10px] font-bold text-white/60 tracking-wider uppercase mb-1">AI 추천</p>
          <p className="text-sm font-bold text-white leading-snug">AI가 회원 데이터를 분석하여<br />맞춤 운동과 식단을 추천합니다</p>
        </div>
        <div className="w-8 h-8 rounded-xl bg-white/15 flex items-center justify-center flex-shrink-0 relative">
          <ChevronRight className="h-4 w-4 text-white" />
        </div>
      </button>

      {/* 오늘 출석 모달 */}
      <Dialog open={todayModalOpen} onOpenChange={setTodayModalOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-yellow-400" />
              오늘 출석 현황
            </DialogTitle>
            <DialogDescription className="text-xs">
              {todayStr.replace(/-/g, ".")} · 출석 {todayAttendanceList?.filter(m => m.check?.status === "attended").length ?? 0}명
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1 max-h-80 overflow-y-auto">
            {!todayAttendanceList ? (
              <p className="text-sm text-muted-foreground text-center py-4">로딩 중...</p>
            ) : todayAttendanceList.filter(m => m.check).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">오늘 출석 기록이 없습니다.</p>
            ) : (
              todayAttendanceList
                .filter(m => m.check)
                .map(m => {
                  const statusColor =
                    m.check?.status === "attended" ? "text-green-400" :
                    m.check?.status === "noshow" ? "text-red-400" : "text-yellow-400";
                  const statusLabel =
                    m.check?.status === "attended" ? "출석" :
                    m.check?.status === "noshow" ? "노쇼" : "캔슬";
                  return (
                    <button
                      key={m.id}
                      onClick={() => { setTodayModalOpen(false); setLocation(`/members/${m.id}`); }}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-accent/40 transition-colors"
                    >
                      <span className="text-sm font-medium">{m.name}</span>
                      <div className="flex items-center gap-2">
                        {m.check?.checkTime && (
                          <span className="text-xs text-muted-foreground">{m.check.checkTime}</span>
                        )}
                        <span className={`text-xs font-semibold ${statusColor}`}>{statusLabel}</span>
                      </div>
                    </button>
                  );
                })
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* 이번달 수업 모달 */}
      <Dialog open={ptStatsModalOpen} onOpenChange={setPtStatsModalOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Dumbbell className="h-4 w-4 text-purple-400" />
              회원별 수업 현황
            </DialogTitle>
            <DialogDescription className="text-xs">
              누적 세션 횟수 기준 정렬
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1 max-h-80 overflow-y-auto">
            {!memberSessionStats ? (
              <p className="text-sm text-muted-foreground text-center py-4">로딩 중...</p>
            ) : memberSessionStats.filter(m => Number(m.totalSessions) > 0).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">세션 기록이 없습니다.</p>
            ) : (
              memberSessionStats
                .filter(m => Number(m.totalSessions) > 0)
                .map((m, idx) => (
                  <button
                    key={m.memberId}
                    onClick={() => { setPtStatsModalOpen(false); setLocation(`/members/${m.memberId}`); }}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-accent/40 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-5 text-right">{idx + 1}</span>
                      <span className="text-sm font-medium">{m.memberName}</span>
                    </div>
                    <span className="text-sm font-bold text-purple-400">{Number(m.totalSessions)}회</span>
                  </button>
                ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── 로딩 스켈레톤 ────────────────────────────────────────────────────────────
function LoadingSkeleton() {
  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <div className="h-3 w-16 bg-card rounded animate-pulse" />
        <div className="h-7 w-48 bg-card rounded animate-pulse" />
        <div className="h-7 w-36 bg-card rounded animate-pulse" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="h-36 rounded-3xl bg-card border border-border animate-pulse" />
        <div className="h-36 rounded-3xl bg-card border border-border animate-pulse" />
      </div>
      <div className="h-20 rounded-2xl bg-card border border-border animate-pulse" />
      <div className="h-36 rounded-2xl bg-card border border-border animate-pulse" />
    </div>
  );
}

// ─── 메인 ─────────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const { data: user } = trpc.auth.me.useQuery();
  if (user?.role === "admin") return <AdminDashboard />;
  return <TrainerDashboard />;
}
