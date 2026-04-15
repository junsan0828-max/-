import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Activity, Dumbbell, TrendingUp, Calendar } from "lucide-react";

export default function Dashboard() {
  const { data: stats, isLoading } = trpc.dashboard.getStats.useQuery();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-bold">대시보드</h1>
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 rounded-lg bg-card border border-border animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const statCards = [
    {
      label: "전체 회원",
      value: `${stats?.totalMembers ?? 0}명`,
      icon: Users,
      color: "text-blue-400",
    },
    {
      label: "활성 회원",
      value: `${stats?.activeMembers ?? 0}명`,
      icon: Activity,
      color: "text-green-400",
    },
    {
      label: "오늘 출석",
      value: `${stats?.todayAttendances ?? 0}명`,
      icon: Calendar,
      color: "text-yellow-400",
    },
    {
      label: "총 PT 세션",
      value: `${stats?.totalPtSessions ?? 0}회`,
      icon: Dumbbell,
      color: "text-purple-400",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">대시보드</h1>
        <p className="text-sm text-muted-foreground mt-0.5">오늘의 현황</p>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-2 gap-3">
        {statCards.map((card) => (
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

      {/* 정산 정보 */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            정산 현황
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div className="p-3 rounded-lg bg-accent/30 border border-border">
            <p className="text-xs text-muted-foreground mb-1">일일 정산</p>
            <p className="text-xl font-bold text-primary">
              {(stats?.dailySettlement ?? 0).toLocaleString()}원
            </p>
          </div>
          <div className="p-3 rounded-lg bg-accent/30 border border-border">
            <p className="text-xs text-muted-foreground mb-1">월 정산</p>
            <p className="text-xl font-bold text-primary">
              {(stats?.monthlySettlement ?? 0).toLocaleString()}원
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
