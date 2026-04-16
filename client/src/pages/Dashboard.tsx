import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Users, Activity, Dumbbell, TrendingUp, Calendar,
  AlertTriangle, UserPlus, ChevronRight, UserCog,
} from "lucide-react";
import { differenceInDays } from "date-fns";

// ─── 관리자 대시보드 ──────────────────────────────────────────────────────────
function AdminDashboard() {
  const [, setLocation] = useLocation();
  const { data: stats, isLoading } = trpc.admin.getStats.useQuery();

  if (isLoading) return <LoadingSkeleton />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">관리자 대시보드</h1>
        <p className="text-sm text-muted-foreground mt-0.5">전체 현황</p>
      </div>

      {/* 전체 통계 */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: "전체 트레이너", value: `${stats?.totalTrainers ?? 0}명`, icon: UserCog, color: "text-blue-400" },
          { label: "전체 회원", value: `${stats?.totalMembers ?? 0}명`, icon: Users, color: "text-green-400" },
          { label: "이번달 매출", value: `${(stats?.totalMonthlyRevenue ?? 0).toLocaleString()}원`, icon: TrendingUp, color: "text-yellow-400" },
          { label: "이번달 정산", value: `${(stats?.totalMonthlySettlement ?? 0).toLocaleString()}원`, icon: Activity, color: "text-purple-400" },
        ].map((card) => (
          <Card key={card.label} className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs text-muted-foreground">{card.label}</p>
                <card.icon className={`h-4 w-4 ${card.color}`} />
              </div>
              <p className="text-xl font-bold">{card.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 트레이너별 현황 */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center justify-between">
            <span className="flex items-center gap-2"><UserCog className="h-4 w-4 text-primary" />트레이너별 현황</span>
            <Button size="sm" variant="outline" onClick={() => setLocation("/admin")}>관리</Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {stats?.trainerStats?.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">등록된 트레이너가 없습니다</p>
          )}
          {stats?.trainerStats?.map((t) => (
            <button
              key={t.id}
              onClick={() => setLocation(`/trainers/${t.id}`)}
              className="w-full flex items-center justify-between p-3 rounded-md bg-accent/20 border border-border hover:border-primary/40 transition-colors text-left"
            >
              <div>
                <p className="text-sm font-medium">{t.trainerName}</p>
                <p className="text-xs text-muted-foreground">회원 {t.memberCount}명 · 정산 {t.settlementRate}%</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-primary">{t.monthlySettlement.toLocaleString()}원</p>
                <p className="text-xs text-muted-foreground">이번달 정산</p>
              </div>
            </button>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── 트레이너 대시보드 ────────────────────────────────────────────────────────
function TrainerDashboard() {
  const [, setLocation] = useLocation();
  const { data: stats, isLoading } = trpc.dashboard.getStats.useQuery();
  const { data: expiring } = trpc.members.getExpiring.useQuery({ days: 7 });
  const { data: unpaid } = trpc.members.getWithUnpaid.useQuery();

  if (isLoading) return <LoadingSkeleton />;

  const today = new Date();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">대시보드</h1>
          <p className="text-sm text-muted-foreground mt-0.5">오늘의 현황</p>
        </div>
        <Button size="sm" onClick={() => setLocation("/members/new")} className="gap-1.5">
          <UserPlus className="h-4 w-4" />신규 등록
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {[
          { label: "전체 회원", value: `${stats?.totalMembers ?? 0}명`, icon: Users, color: "text-blue-400" },
          { label: "활성 회원", value: `${stats?.activeMembers ?? 0}명`, icon: Activity, color: "text-green-400" },
          { label: "오늘 출석", value: `${stats?.todayAttendances ?? 0}명`, icon: Calendar, color: "text-yellow-400" },
          { label: "총 PT 세션", value: `${stats?.totalPtSessions ?? 0}회`, icon: Dumbbell, color: "text-purple-400" },
        ].map((card) => (
          <Card key={card.label} className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs text-muted-foreground">{card.label}</p>
                <card.icon className={`h-4 w-4 ${card.color}`} />
              </div>
              <p className="text-2xl font-bold">{card.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />정산 현황
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div className="p-3 rounded-lg bg-accent/30 border border-border">
            <p className="text-xs text-muted-foreground mb-1">일일 정산</p>
            <p className="text-xl font-bold text-primary">{(stats?.dailySettlement ?? 0).toLocaleString()}원</p>
          </div>
          <div className="p-3 rounded-lg bg-accent/30 border border-border">
            <p className="text-xs text-muted-foreground mb-1">월 정산</p>
            <p className="text-xl font-bold text-primary">{(stats?.monthlySettlement ?? 0).toLocaleString()}원</p>
          </div>
        </CardContent>
      </Card>

      {expiring && expiring.length > 0 && (
        <Card className="bg-card border-border border-yellow-500/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-400" />
              <span className="text-yellow-400">만료 임박 회원</span>
              <span className="ml-auto text-xs font-normal text-muted-foreground">7일 이내</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {expiring.map((member) => {
              const daysLeft = member.membershipEnd ? differenceInDays(new Date(member.membershipEnd), today) : null;
              return (
                <button key={member.id} onClick={() => setLocation(`/members/${member.id}`)}
                  className="w-full flex items-center justify-between p-2.5 rounded-md bg-yellow-500/10 border border-yellow-500/20 hover:border-yellow-500/40 transition-colors text-left">
                  <div className="flex items-center gap-2">
                    <div className="h-7 w-7 rounded-full bg-yellow-500/20 flex items-center justify-center text-yellow-400 font-bold text-xs">{member.name.charAt(0)}</div>
                    <span className="text-sm font-medium">{member.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-yellow-400">{daysLeft === 0 ? "오늘 만료" : daysLeft !== null ? `D-${daysLeft}` : "-"}</span>
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                </button>
              );
            })}
          </CardContent>
        </Card>
      )}

      {unpaid && unpaid.length > 0 && (
        <Card className="bg-card border-border border-orange-500/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-orange-400" />
              <span className="text-orange-400">미수금 회원</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {unpaid.map((item) => (
              <button key={item.id} onClick={() => setLocation(`/members/${item.id}`)}
                className="w-full flex items-center justify-between p-2.5 rounded-md bg-orange-500/10 border border-orange-500/20 hover:border-orange-500/40 transition-colors text-left">
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-full bg-orange-500/20 flex items-center justify-center text-orange-400 font-bold text-xs">{item.name.charAt(0)}</div>
                  <div>
                    <p className="text-sm font-medium">{item.name}</p>
                    {item.packageName && <p className="text-xs text-muted-foreground">{item.packageName}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-orange-400">{(item.unpaidAmount ?? 0).toLocaleString()}원</span>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
              </button>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-6 w-32 bg-card rounded animate-pulse" />
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28 rounded-lg bg-card border border-border animate-pulse" />
        ))}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { data: user } = trpc.auth.me.useQuery();
  if (user?.role === "admin") return <AdminDashboard />;
  return <TrainerDashboard />;
}
