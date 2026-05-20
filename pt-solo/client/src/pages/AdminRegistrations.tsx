import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UserCheck, UserX, Clock, CheckCircle, XCircle, User } from "lucide-react";
import { toast } from "sonner";

type Reg = {
  userId: number; trainerId: number; username: string; trainerName: string;
  phone: string | null; email: string | null; position: string | null; createdAt: string;
};

const TABS = [
  { key: "pending", label: "승인 대기", icon: Clock },
  { key: "approved", label: "승인 완료", icon: CheckCircle },
  { key: "rejected", label: "거절", icon: XCircle },
] as const;

function statusOf(r: Reg) {
  if (r.position === "pending") return "pending";
  if (r.position === "rejected") return "rejected";
  return "approved";
}

export default function AdminRegistrations() {
  const [tab, setTab] = useState<"pending" | "approved" | "rejected">("pending");
  const { data: regs, refetch, isLoading } = trpc.admin.getRegistrations.useQuery();
  const utils = trpc.useUtils();

  const approveMutation = trpc.admin.approveRegistration.useMutation({
    onSuccess: (_, v) => {
      const r = regs?.find(x => x.userId === v.userId);
      toast.success(`${r?.trainerName ?? ""} 승인 완료`);
      refetch();
      utils.admin.listTrainers.invalidate();
    },
    onError: e => toast.error(e.message),
  });

  const rejectMutation = trpc.admin.rejectRegistration.useMutation({
    onSuccess: (_, v) => {
      const r = regs?.find(x => x.userId === v.userId);
      toast.success(`${r?.trainerName ?? ""} 거절 처리`);
      refetch();
    },
    onError: e => toast.error(e.message),
  });

  const pending = (regs ?? []).filter(r => statusOf(r) === "pending");
  const approved = (regs ?? []).filter(r => statusOf(r) === "approved");
  const rejected = (regs ?? []).filter(r => statusOf(r) === "rejected");

  const counts = { pending: pending.length, approved: approved.length, rejected: rejected.length };
  const list = tab === "pending" ? pending : tab === "approved" ? approved : rejected;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">가입 관리</h1>
        <p className="text-sm text-muted-foreground mt-0.5">트레이너 가입 신청을 승인하거나 거절합니다</p>
      </div>

      {/* 요약 */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="bg-yellow-500/10 border-yellow-500/30">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-black text-yellow-400">{counts.pending}</p>
            <p className="text-xs text-muted-foreground mt-0.5">대기 중</p>
          </CardContent>
        </Card>
        <Card className="bg-green-500/10 border-green-500/30">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-black text-green-400">{counts.approved}</p>
            <p className="text-xs text-muted-foreground mt-0.5">승인 완료</p>
          </CardContent>
        </Card>
        <Card className="bg-red-500/10 border-red-500/30">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-black text-red-400">{counts.rejected}</p>
            <p className="text-xs text-muted-foreground mt-0.5">거절</p>
          </CardContent>
        </Card>
      </div>

      {/* 탭 */}
      <div className="flex gap-1 bg-accent/30 p-1 rounded-xl">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t.key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
          >
            <t.icon className="h-3.5 w-3.5" />
            {t.label}
            {counts[t.key] > 0 && (
              <span className={`text-xs font-bold ml-0.5 ${t.key === "pending" ? "text-yellow-400" : t.key === "approved" ? "text-green-400" : "text-red-400"}`}>
                {counts[t.key]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* 목록 */}
      <div className="space-y-3">
        {isLoading && <p className="text-xs text-muted-foreground text-center py-8">로딩 중...</p>}
        {!isLoading && list.length === 0 && (
          <div className="text-center py-12">
            <User className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              {tab === "pending" ? "대기 중인 가입 신청이 없습니다" : tab === "approved" ? "승인된 트레이너가 없습니다" : "거절된 신청이 없습니다"}
            </p>
          </div>
        )}
        {list.map(r => (
          <Card key={r.userId} className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                  <span className="text-sm font-bold text-primary">{r.trainerName[0]}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-sm">{r.trainerName}</p>
                    <span className="text-xs text-muted-foreground">@{r.username}</span>
                    {tab === "pending" && <span className="text-xs bg-yellow-500/15 text-yellow-400 border border-yellow-500/30 px-1.5 py-0.5 rounded-full">대기 중</span>}
                    {tab === "approved" && <span className="text-xs bg-green-500/15 text-green-400 border border-green-500/30 px-1.5 py-0.5 rounded-full">승인됨</span>}
                    {tab === "rejected" && <span className="text-xs bg-red-500/15 text-red-400 border border-red-500/30 px-1.5 py-0.5 rounded-full">거절됨</span>}
                  </div>
                  <div className="mt-1 space-y-0.5">
                    {r.phone && <p className="text-xs text-muted-foreground">📱 {r.phone}</p>}
                    {r.email && <p className="text-xs text-muted-foreground">✉️ {r.email}</p>}
                    <p className="text-xs text-muted-foreground">신청일: {r.createdAt.slice(0, 10)}</p>
                  </div>
                </div>
              </div>

              {/* 액션 버튼 */}
              {tab === "pending" && (
                <div className="flex gap-2 mt-3">
                  <Button
                    size="sm" className="flex-1 gap-1.5 bg-green-600 hover:bg-green-700 text-white"
                    disabled={approveMutation.isPending}
                    onClick={() => approveMutation.mutate({ userId: r.userId })}
                  >
                    <UserCheck className="h-3.5 w-3.5" />승인
                  </Button>
                  <Button
                    size="sm" variant="outline" className="flex-1 gap-1.5 border-red-500/40 text-red-400 hover:bg-red-500/10"
                    disabled={rejectMutation.isPending}
                    onClick={() => rejectMutation.mutate({ userId: r.userId })}
                  >
                    <UserX className="h-3.5 w-3.5" />거절
                  </Button>
                </div>
              )}
              {tab === "rejected" && (
                <div className="mt-3">
                  <Button
                    size="sm" variant="outline" className="w-full gap-1.5"
                    disabled={approveMutation.isPending}
                    onClick={() => approveMutation.mutate({ userId: r.userId })}
                  >
                    <UserCheck className="h-3.5 w-3.5" />승인으로 변경
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
