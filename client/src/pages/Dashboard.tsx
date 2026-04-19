import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Users, Activity, Dumbbell, TrendingUp, Calendar,
  AlertTriangle, UserPlus, ChevronRight, UserCog, RefreshCw, Clock, BookOpen, Trash2, UserCheck,
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { differenceInDays } from "date-fns";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
  AreaChart, Area, LineChart, Line,
} from "recharts";

const CHART_COLORS = ["#22c55e", "#3b82f6", "#f59e0b", "#a855f7", "#ef4444", "#06b6d4"];

// ─── 관리자 대시보드 ──────────────────────────────────────────────────────────
function AdminDashboard() {
  const [, setLocation] = useLocation();
  const { data: stats, isLoading } = trpc.admin.getStats.useQuery();
  const { data: chart } = trpc.admin.getMonthlyChart.useQuery();
  const { data: pendingMembers, refetch: refetchPending } = trpc.admin.listPending.useQuery();
  const [assignDialogId, setAssignDialogId] = useState<number | null>(null);
  const [assignTrainerId, setAssignTrainerId] = useState<string>("");
  const utils = trpc.useUtils();

  const assignMutation = trpc.admin.assignPending.useMutation({
    onSuccess: () => {
      toast.success("회원 배정 완료");
      setAssignDialogId(null);
      setAssignTrainerId("");
      refetchPending();
      utils.admin.getStats.invalidate();
    },
    onError: (e: { message: string }) => toast.error(e.message),
  });

  const deletePendingMutation = trpc.admin.deletePending.useMutation({
    onSuccess: () => { toast.success("삭제됨"); refetchPending(); },
    onError: (e: { message: string }) => toast.error(e.message),
  });

  const syncNowMutation = trpc.admin.syncNow.useMutation({
    onSuccess: (res) => { toast.success(res.message); refetchPending(); },
    onError: (e: { message: string }) => toast.error(e.message),
  });

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

      {/* 미배정 회원 명단 */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center justify-between">
            <span className="flex items-center gap-2">
              <UserCheck className="h-4 w-4 text-orange-400" />
              미배정 회원 명단
              {pendingMembers && pendingMembers.length > 0 && (
                <span className="text-xs bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded-full">{pendingMembers.length}명</span>
              )}
            </span>
            <Button size="sm" variant="outline" className="h-7 text-xs" disabled={syncNowMutation.isPending} onClick={() => syncNowMutation.mutate()}>
              <RefreshCw className={`h-3 w-3 mr-1 ${syncNowMutation.isPending ? "animate-spin" : ""}`} />
              시트 동기화
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {(!pendingMembers || pendingMembers.length === 0) && (
            <p className="text-sm text-muted-foreground text-center py-4">미배정 회원 없음</p>
          )}
          {pendingMembers?.map((p) => (
            <div key={p.id} className="flex items-center justify-between p-3 rounded-md bg-accent/20 border border-border">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{p.name}</p>
                <p className="text-xs text-muted-foreground">
                  {[p.phone, p.gender, p.ptSessions ? `PT ${p.ptSessions}회` : null].filter(Boolean).join(" · ")}
                </p>
              </div>
              <div className="flex gap-1.5 ml-2 shrink-0">
                <Button size="sm" className="h-7 text-xs" onClick={() => { setAssignDialogId(p.id); setAssignTrainerId(""); }}>배정</Button>
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-red-400" onClick={() => deletePendingMutation.mutate({ id: p.id })}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* 트레이너 배정 다이얼로그 */}
      <Dialog open={assignDialogId !== null} onOpenChange={(o) => { if (!o) setAssignDialogId(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>트레이너 배정</DialogTitle>
            <DialogDescription>이 회원을 담당할 트레이너를 선택하세요.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <Select value={assignTrainerId} onValueChange={setAssignTrainerId}>
              <SelectTrigger><SelectValue placeholder="트레이너 선택" /></SelectTrigger>
              <SelectContent>
                {stats?.trainerStats?.map((t) => (
                  <SelectItem key={t.id} value={String(t.id)}>{t.trainerName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              className="w-full"
              disabled={!assignTrainerId || assignMutation.isPending}
              onClick={() => assignDialogId !== null && assignMutation.mutate({ pendingId: assignDialogId, trainerId: Number(assignTrainerId) })}
            >
              배정 완료
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── 트레이너 대시보드 ────────────────────────────────────────────────────────
function TrainerDashboard() {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const { data: stats, isLoading } = trpc.dashboard.getStats.useQuery();
  const { data: chartData } = trpc.dashboard.getMonthlyChart.useQuery();
  const { data: revenueData } = trpc.dashboard.getMonthlyRevenue.useQuery();
  const { data: allMembers } = trpc.members.list.useQuery();

  const [journalOpen, setJournalOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<{ id: number; name: string } | null>(null);
  const [journalForm, setJournalForm] = useState({
    sessionDate: new Date().toISOString().split("T")[0],
    exerciseType: "",
    bodyPart: "",
    notes: "",
    exercises: [] as { name: string; sets: string; reps: string; weight: string }[],
  });

  const useSessionMutation = trpc.pt.useSession.useMutation({
    onSuccess: (data) => {
      toast.success(`${selectedMember?.name} 수업 기록 완료! 잔여 ${data.remaining}회`);
      setJournalOpen(false);
      utils.dashboard.getStats.invalidate();
    },
    onError: (err) => toast.error(err.message || "기록 실패"),
  });
  const { data: expiring } = trpc.members.getExpiring.useQuery({ days: 7 });
  const { data: unpaid } = trpc.members.getWithUnpaid.useQuery();
  const { data: lowSessions } = trpc.members.getLowSessions.useQuery({ threshold: 5 });
  const { data: longAbsent } = trpc.members.getLongAbsent.useQuery({ days: 14 });

  if (isLoading) return <LoadingSkeleton />;

  const today = new Date();

  const alertItems = [
    expiring?.length ? { label: `만료 임박 ${expiring.length}명`, color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" } : null,
    unpaid?.length ? { label: `미수금 ${unpaid.length}명`, color: "bg-orange-500/20 text-orange-400 border-orange-500/30" } : null,
    longAbsent?.length ? { label: `장기 미출석 ${longAbsent.length}명`, color: "bg-red-500/20 text-red-400 border-red-500/30" } : null,
  ].filter(Boolean) as { label: string; color: string }[];

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

      {/* 알림 뱃지 */}
      {alertItems.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {alertItems.map((item) => (
            <span key={item.label} className={`text-xs px-3 py-1.5 rounded-full border font-medium ${item.color}`}>
              ⚠ {item.label}
            </span>
          ))}
        </div>
      )}

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

      {/* 월별 매출/정산 추이 차트 */}
      {revenueData && revenueData.some(r => r.매출 > 0) && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />최근 6개월 매출/정산 추이
            </CardTitle>
          </CardHeader>
          <CardContent className="px-2 pb-4">
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={revenueData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorSettlement" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#888" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "#888" }} axisLine={false} tickLine={false} tickFormatter={(v) => v === 0 ? "0" : `${(v / 10000).toFixed(0)}만`} />
                <Tooltip
                  contentStyle={{ background: "#1c1c1e", border: "1px solid #333", borderRadius: 8, fontSize: 12 }}
                  formatter={(value) => [`${Number(value ?? 0).toLocaleString()}원`]}
                />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                <Area type="monotone" dataKey="매출" stroke="#6366f1" fill="url(#colorRevenue)" strokeWidth={2} dot={{ r: 3, fill: "#6366f1" }} />
                <Area type="monotone" dataKey="정산" stroke="#22c55e" fill="url(#colorSettlement)" strokeWidth={2} dot={{ r: 3, fill: "#22c55e" }} />
              </AreaChart>
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

      {/* 트레이닝 일지 */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-primary" />트레이닝 일지
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {(!allMembers || allMembers.filter(m => m.status === "active").length === 0) && (
            <p className="text-sm text-muted-foreground text-center py-4">활성 회원이 없습니다</p>
          )}
          {allMembers?.filter(m => m.status === "active").map((m) => (
            <button
              key={m.id}
              onClick={() => {
                setSelectedMember({ id: m.id, name: m.name });
                setJournalForm({ sessionDate: new Date().toISOString().split("T")[0], exerciseType: "", bodyPart: "", notes: "", exercises: [] });
                setJournalOpen(true);
              }}
              className="w-full flex items-center justify-between p-3 rounded-md bg-accent/20 border border-border hover:border-primary/40 transition-colors text-left"
            >
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm">{m.name.charAt(0)}</div>
                <div>
                  <p className="text-sm font-medium">{m.name}</p>
                  {m.membershipEnd && <p className="text-xs text-muted-foreground">{m.membershipEnd} 만료</p>}
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-primary border border-primary/30 rounded-full px-2.5 py-1 bg-primary/10">
                <BookOpen className="h-3 w-3" />기록
              </div>
            </button>
          ))}
        </CardContent>
      </Card>

      {/* 트레이닝 일지 기록 다이얼로그 */}
      <Dialog open={journalOpen} onOpenChange={setJournalOpen}>
        <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><BookOpen className="h-4 w-4 text-primary" />트레이닝 일지</DialogTitle>
            <DialogDescription>{selectedMember?.name} 수업 기록</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">수업일</label>
              <Input type="date" value={journalForm.sessionDate} onChange={e => setJournalForm(p => ({ ...p, sessionDate: e.target.value }))} className="h-9 text-sm" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">운동 형태</label>
              <Select value={journalForm.exerciseType} onValueChange={v => setJournalForm(p => ({ ...p, exerciseType: v === "__none" ? "" : v }))}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="운동 형태를 선택하세요" /></SelectTrigger>
                <SelectContent position="popper" className="max-h-60 overflow-y-auto">
                  {["다이어트","체형교정","재활","근비대","퍼포먼스","일반건강","스트레칭","유산소","기능성훈련","밸런스","체력증진"].map(t => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">운동 부위</label>
              <Select value={journalForm.bodyPart} onValueChange={v => setJournalForm(p => ({ ...p, bodyPart: v === "__none" ? "" : v }))}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="운동 부위를 선택하세요" /></SelectTrigger>
                <SelectContent position="popper" className="max-h-60 overflow-y-auto">
                  {["전신","상체","하체","등","어깨","가슴","복부","허리","코어","고관절","대퇴 후면","대퇴 전면","하퇴","발목·발","이두","삼두","유산소","기타"].map(bp => (
                    <SelectItem key={bp} value={bp}>{bp}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-muted-foreground">운동 종목</label>
                <button onClick={() => setJournalForm(p => ({ ...p, exercises: [...p.exercises, { name: "", sets: "", reps: "", weight: "" }] }))}
                  className="text-xs text-primary hover:underline">+ 추가</button>
              </div>
              {journalForm.exercises.length === 0 && <p className="text-xs text-muted-foreground">종목을 추가하세요 (선택)</p>}
              <div className="space-y-2">
                {journalForm.exercises.map((ex, i) => (
                  <div key={i} className="flex gap-1 items-center">
                    <Input placeholder="종목명" value={ex.name} onChange={e => setJournalForm(p => { const arr = [...p.exercises]; arr[i] = { ...arr[i], name: e.target.value }; return { ...p, exercises: arr }; })} className="h-8 text-xs flex-1" />
                    <Input placeholder="세트" value={ex.sets} onChange={e => setJournalForm(p => { const arr = [...p.exercises]; arr[i] = { ...arr[i], sets: e.target.value }; return { ...p, exercises: arr }; })} className="h-8 text-xs w-12" />
                    <Input placeholder="횟수" value={ex.reps} onChange={e => setJournalForm(p => { const arr = [...p.exercises]; arr[i] = { ...arr[i], reps: e.target.value }; return { ...p, exercises: arr }; })} className="h-8 text-xs w-12" />
                    <Input placeholder="kg" value={ex.weight} onChange={e => setJournalForm(p => { const arr = [...p.exercises]; arr[i] = { ...arr[i], weight: e.target.value }; return { ...p, exercises: arr }; })} className="h-8 text-xs w-12" />
                    <button onClick={() => setJournalForm(p => ({ ...p, exercises: p.exercises.filter((_, j) => j !== i) }))} className="text-muted-foreground hover:text-red-400"><Trash2 className="h-3.5 w-3.5"/></button>
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">메모</label>
              <Textarea value={journalForm.notes} onChange={e => setJournalForm(p => ({ ...p, notes: e.target.value }))} placeholder="오늘 수업 특이사항..." rows={2} className="text-sm resize-none" />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setJournalOpen(false)}>취소</Button>
              <Button className="flex-1" disabled={useSessionMutation.isPending}
                onClick={() => {
                  if (!selectedMember) return;
                  useSessionMutation.mutate({
                    memberId: selectedMember.id,
                    sessionDate: journalForm.sessionDate,
                    bodyPart: journalForm.bodyPart || undefined,
                    notes: journalForm.notes || undefined,
                    exercisesJson: journalForm.exercises.length > 0 ? JSON.stringify(journalForm.exercises) : undefined,
                  });
                }}>
                {useSessionMutation.isPending ? "기록 중..." : "기록 완료"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
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
