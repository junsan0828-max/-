import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Users, Activity, Dumbbell, TrendingUp, Calendar,
  AlertTriangle, UserPlus, ChevronRight, UserCog, RefreshCw, Clock,
} from "lucide-react";
import { differenceInDays } from "date-fns";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

const CHART_COLORS = ["#22c55e", "#3b82f6", "#f59e0b", "#a855f7", "#ef4444", "#06b6d4"];

// ─── 관리자 대시보드 ──────────────────────────────────────────────────────────
function AdminDashboard() {
  const [, setLocation] = useLocation();
  const { data: stats, isLoading } = trpc.admin.getStats.useQuery();
  const { data: chart } = trpc.admin.getMonthlyChart.useQuery();

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
          { label: "전체 트레이너", value: `${stats?.totalTrainers ?? 0}명`, icon: UserCog, color: "text-blue-400", path: "/trainers" },
          { label: "전체 회원", value: `${stats?.totalMembers ?? 0}명`, icon: Users, color: "text-green-400", path: "/trainers" },
          { label: "이번달 매출", value: `${(stats?.totalMonthlyRevenue ?? 0).toLocaleString()}원`, icon: TrendingUp, color: "text-yellow-400", path: "/admin" },
          { label: "이번달 정산", value: `${(stats?.totalMonthlySettlement ?? 0).toLocaleString()}원`, icon: Activity, color: "text-purple-400", path: "/admin" },
        ].map((card) => (
          <button key={card.label} onClick={() => setLocation(card.path)} className="text-left">
            <Card className="bg-card border-border hover:border-primary/40 transition-colors cursor-pointer">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs text-muted-foreground">{card.label}</p>
                  <card.icon className={`h-4 w-4 ${card.color}`} />
                </div>
                <p className="text-xl font-bold">{card.value}</p>
              </CardContent>
            </Card>
          </button>
        ))}
      </div>

      {/* 월간 매출 차트 */}
      {chart && chart.rows.length > 0 && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />최근 6개월 트레이너별 매출
            </CardTitle>
          </CardHeader>
          <CardContent className="px-2 pb-4">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chart.rows} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#888" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "#888" }} axisLine={false} tickLine={false} tickFormatter={(v) => v === 0 ? "0" : `${(v / 10000).toFixed(0)}만`} />
                <Tooltip
                  contentStyle={{ background: "#1c1c1e", border: "1px solid #333", borderRadius: 8, fontSize: 12 }}
                  formatter={(value) => [`${Number(value ?? 0).toLocaleString()}원`]}
                />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                {chart.trainerNames.map((name, i) => (
                  <Bar key={name} dataKey={name} fill={CHART_COLORS[i % CHART_COLORS.length]} radius={[3, 3, 0, 0]} maxBarSize={32} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

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
  const { data: chartData } = trpc.dashboard.getMonthlyChart.useQuery();
  const { data: expiring } = trpc.members.getExpiring.useQuery({ days: 7 });
  const { data: unpaid } = trpc.members.getWithUnpaid.useQuery();
  const { data: lowSessions } = trpc.members.getLowSessions.useQuery({ threshold: 5 });
  const { data: longAbsent } = trpc.members.getLongAbsent.useQuery({ days: 14 });

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
          { label: "전체 회원", value: `${stats?.totalMembers ?? 0}명`, icon: Users, color: "text-blue-400", path: "/members" },
          { label: "활성 회원", value: `${stats?.activeMembers ?? 0}명`, icon: Activity, color: "text-green-400", path: "/members" },
          { label: "오늘 출석", value: `${stats?.todayAttendances ?? 0}명`, icon: Calendar, color: "text-yellow-400", path: "/members" },
          { label: "총 PT 세션", value: `${stats?.totalPtSessions ?? 0}회`, icon: Dumbbell, color: "text-purple-400", path: "/pt" },
        ].map((card) => (
          <button key={card.label} onClick={() => setLocation(card.path)} className="text-left">
            <Card className="bg-card border-border hover:border-primary/40 transition-colors cursor-pointer">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs text-muted-foreground">{card.label}</p>
                  <card.icon className={`h-4 w-4 ${card.color}`} />
                </div>
                <p className="text-2xl font-bold">{card.value}</p>
              </CardContent>
            </Card>
          </button>
        ))}
      </div>

      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />정산 현황
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <button onClick={() => setLocation("/pt")} className="p-3 rounded-lg bg-accent/30 border border-border hover:border-primary/40 transition-colors text-left">
            <p className="text-xs text-muted-foreground mb-1">일일 정산</p>
            <p className="text-xl font-bold text-primary">{(stats?.dailySettlement ?? 0).toLocaleString()}원</p>
          </button>
          <button onClick={() => setLocation("/pt")} className="p-3 rounded-lg bg-accent/30 border border-border hover:border-primary/40 transition-colors text-left">
            <p className="text-xs text-muted-foreground mb-1">월 정산</p>
            <p className="text-xl font-bold text-primary">{(stats?.monthlySettlement ?? 0).toLocaleString()}원</p>
          </button>
        </CardContent>
      </Card>

      {/* 월별 출석/신규 회원 추이 차트 */}
      {chartData && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />최근 6개월 추이
            </CardTitle>
          </CardHeader>
          <CardContent className="px-2 pb-4">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#888" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "#888" }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ background: "#1c1c1e", border: "1px solid #333", borderRadius: 8, fontSize: 12 }}
                  formatter={(value) => [`${value}회`]}
                />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                <Bar dataKey="출석" fill="#22c55e" radius={[3, 3, 0, 0]} maxBarSize={28} />
                <Bar dataKey="신규회원" fill="#3b82f6" radius={[3, 3, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

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

      {/* 재등록 안내 회원 (PT 5회 이하) */}
      {lowSessions && lowSessions.length > 0 && (
        <Card className="bg-card border-border border-blue-500/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <RefreshCw className="h-4 w-4 text-blue-400" />
              <span className="text-blue-400">재등록 안내 회원</span>
              <span className="ml-auto text-xs font-normal px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">5세션 이하</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {lowSessions.map((item) => {
              const remaining = item.totalSessions - item.usedSessions;
              return (
                <button key={`${item.id}-${item.packageName}`} onClick={() => setLocation(`/members/${item.id}`)}
                  className="w-full flex items-center justify-between p-2.5 rounded-md bg-blue-500/10 border border-blue-500/20 hover:border-blue-500/40 transition-colors text-left">
                  <div className="flex items-center gap-2">
                    <div className="h-7 w-7 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 font-bold text-xs">{item.name.charAt(0)}</div>
                    <div>
                      <p className="text-sm font-medium">{item.name}</p>
                      {item.packageName && <p className="text-xs text-muted-foreground">{item.packageName}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-blue-400">잔여 {remaining}회</span>
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                </button>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* 장기 미출석 회원 (2주 이상) */}
      {longAbsent && longAbsent.length > 0 && (
        <Card className="bg-card border-border border-red-500/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4 text-red-400" />
              <span className="text-red-400">장기 미출석 회원</span>
              <span className="ml-auto text-xs font-normal px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30">2주 이상</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {longAbsent.map((item) => (
              <button key={item.id} onClick={() => setLocation(`/members/${item.id}`)}
                className="w-full flex items-center justify-between p-2.5 rounded-md bg-red-500/10 border border-red-500/20 hover:border-red-500/40 transition-colors text-left">
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-full bg-red-500/20 flex items-center justify-center text-red-400 font-bold text-xs">{item.name.charAt(0)}</div>
                  <div>
                    <p className="text-sm font-medium">{item.name}</p>
                    <p className="text-xs text-muted-foreground">{item.lastAttendDate ? `마지막 출석: ${item.lastAttendDate}` : "출석 기록 없음"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-red-400">미출석</span>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
              </button>
            ))}
          </CardContent>
        </Card>
      )}

      {/* 빠른 액션 */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">빠른 액션</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setLocation("/members/new")}
            className="flex flex-col items-center justify-center gap-2 p-4 rounded-lg bg-primary/10 border border-primary/20 hover:bg-primary/20 transition-colors"
          >
            <UserPlus className="h-6 w-6 text-primary" />
            <span className="text-sm font-medium text-primary">회원 등록</span>
          </button>
          <button
            onClick={() => setLocation("/members")}
            className="flex flex-col items-center justify-center gap-2 p-4 rounded-lg bg-green-500/10 border border-green-500/20 hover:bg-green-500/20 transition-colors"
          >
            <Calendar className="h-6 w-6 text-green-400" />
            <span className="text-sm font-medium text-green-400">출석 관리</span>
          </button>
        </CardContent>
      </Card>
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
