import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Lock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { ChevronRight, Users, TrendingUp, UserPlus } from "lucide-react";

function fmt(n: number) { return n.toLocaleString(); }

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="p-3 rounded-lg bg-accent/20 border border-border">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className="text-lg font-bold">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

function TrainerList() {
  const [, setLocation] = useLocation();
  const { data: trainers, isLoading, refetch } = trpc.admin.listTrainers.useQuery();
  const { data: branchList } = trpc.admin.listBranches.useQuery();
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({
    username: "", password: "", trainerName: "", phone: "", email: "", settlementRate: "50", branchId: "none",
  });

  const createMutation = trpc.admin.createTrainer.useMutation({
    onSuccess: () => {
      toast.success("트레이너 계정이 생성되었습니다.");
      setCreateOpen(false);
      setForm({ username: "", password: "", trainerName: "", phone: "", email: "", settlementRate: "50", branchId: "none" });
      refetch();
    },
    onError: (err) => toast.error(err.message || "생성 실패"),
  });

  const handleCreate = () => {
    if (!form.trainerName.trim()) return toast.error("이름을 입력해주세요.");
    if (!form.username.trim() || form.username.trim().length < 3) return toast.error("아이디는 3자 이상이어야 합니다.");
    if (!form.password || form.password.length < 6) return toast.error("비밀번호는 6자 이상이어야 합니다.");
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return toast.error("올바른 이메일 형식이 아닙니다.");
    createMutation.mutate({
      username: form.username.trim(), password: form.password, trainerName: form.trainerName.trim(),
      phone: form.phone || undefined, email: form.email || undefined,
      settlementRate: parseInt(form.settlementRate) || 50,
      branchId: form.branchId !== "none" ? parseInt(form.branchId) : undefined,
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">총 {trainers?.length ?? 0}명</p>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5">
              <UserPlus className="h-4 w-4" />
              트레이너 추가
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>트레이너 계정 생성</DialogTitle>
              <DialogDescription>새 트레이너 계정 정보를 입력하세요.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">이름 <span className="text-primary">*</span></Label>
                <Input placeholder="김트레이너" value={form.trainerName}
                  onChange={(e) => setForm(p => ({ ...p, trainerName: e.target.value }))} className="h-9" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">아이디 <span className="text-primary">*</span></Label>
                  <Input placeholder="trainer2" value={form.username}
                    onChange={(e) => setForm(p => ({ ...p, username: e.target.value }))} className="h-9" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">비밀번호 <span className="text-primary">*</span></Label>
                  <Input type="password" placeholder="6자 이상" value={form.password}
                    onChange={(e) => setForm(p => ({ ...p, password: e.target.value }))} className="h-9" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">연락처</Label>
                <Input placeholder="010-0000-0000" value={form.phone}
                  onChange={(e) => setForm(p => ({ ...p, phone: e.target.value }))} className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">이메일</Label>
                <Input type="email" placeholder="trainer@example.com" value={form.email}
                  onChange={(e) => setForm(p => ({ ...p, email: e.target.value }))} className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">지점</Label>
                <Select value={form.branchId} onValueChange={(v) => setForm(p => ({ ...p, branchId: v }))}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="지점 선택 (선택)" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">미배정</SelectItem>
                    {branchList?.map(b => <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">정산 비율 (%)</Label>
                <div className="flex items-center gap-2">
                  <Input type="number" min="0" max="100" value={form.settlementRate}
                    onChange={(e) => setForm(p => ({ ...p, settlementRate: e.target.value }))} className="h-9" />
                  <span className="text-sm text-muted-foreground">%</span>
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <Button variant="outline" className="flex-1" onClick={() => setCreateOpen(false)}>취소</Button>
                <Button className="flex-1" onClick={handleCreate} disabled={createMutation.isPending}>
                  {createMutation.isPending ? "생성 중..." : "생성"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-20 rounded-lg bg-card border border-border animate-pulse" />
          ))}
        </div>
      ) : !trainers?.length ? (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-sm">등록된 트레이너가 없습니다.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {trainers.map((trainer) => (
            <button key={trainer.id} onClick={() => setLocation(`/trainers/${trainer.id}`)}
              className="w-full text-left p-4 rounded-lg bg-card border border-border hover:border-primary/50 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm">
                    {trainer.trainerName.charAt(0)}
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{trainer.trainerName}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Users className="h-3 w-3" />{trainer.memberCount}명
                      </span>
                      <span className="text-xs text-primary">정산 {trainer.settlementRate}%</span>
                    </div>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function SettlementTab() {
  const today = new Date();
  const [yearMonth, setYearMonth] = useState(
    `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`
  );
  const { data, isLoading } = trpc.admin.getSettlementReport.useQuery({ yearMonth });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <input type="month" value={yearMonth} onChange={(e) => setYearMonth(e.target.value)}
          className="bg-input border border-border rounded-lg px-3 py-1.5 text-sm text-foreground" />
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground text-center py-8">로딩 중...</p>
      ) : !data ? null : (
        <>
          <Card className="bg-card border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />전체 합계
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3">
              <StatCard label="총 PT 횟수" value={`${fmt(data.total.sessionCount)}회`} />
              <StatCard label="전체 평균 단가" value={`${fmt(data.total.avgPrice)}원`} />
              <StatCard label="총 매출" value={`${fmt(data.total.revenue)}원`} />
              <StatCard label="총 정산 비용" value={`${fmt(data.total.settlement)}원`} />
              <StatCard label="3.3% 제외 후 정산" value={`${fmt(data.total.afterTax)}원`}
                sub={`공제액 ${fmt(data.total.settlement - data.total.afterTax)}원`} />
            </CardContent>
          </Card>

          {data.trainers.filter(t => t.sessionCount > 0).length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">{yearMonth} 정산 내역이 없습니다.</p>
          ) : (
            <div className="space-y-3">
              {data.trainers.filter(t => t.sessionCount > 0).sort((a, b) => b.settlement - a.settlement).map(t => (
                <Card key={t.trainerId} className="bg-card border-border">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center justify-between">
                      <span className="flex items-center gap-2"><Users className="h-4 w-4 text-primary" />{t.trainerName}</span>
                      <span className="text-xs text-muted-foreground font-normal">정산비율 {t.settlementRate}%</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-2 gap-3">
                    <StatCard label="PT 횟수" value={`${fmt(t.sessionCount)}회`} />
                    <StatCard label="평균 단가" value={`${fmt(t.avgPrice)}원`} />
                    <StatCard label="매출" value={`${fmt(t.revenue)}원`} />
                    <StatCard label="정산 비용" value={`${fmt(t.settlement)}원`} sub={`매출 × ${t.settlementRate}%`} />
                    <StatCard label="3.3% 제외 후" value={`${fmt(t.afterTax)}원`}
                      sub={`공제 ${fmt(t.settlement - t.afterTax)}원`} />
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

const TABS = [
  { key: "trainers", label: "트레이너 관리" },
  { key: "settlement", label: "수업 정산" },
] as const;
type Tab = typeof TABS[number]["key"];

function ForbiddenPage({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
      <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center">
        <Lock className="h-6 w-6 text-red-400" />
      </div>
      <p className="font-semibold text-foreground">접근 권한이 없습니다</p>
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

export default function Trainers() {
  const { data: user } = trpc.auth.me.useQuery();
  const [tab, setTab] = useState<Tab>("trainers");

  if (user && user.role !== "admin" && user.role !== "sub_admin") {
    return <ForbiddenPage message="트레이너 관리는 관리자만 접근할 수 있습니다." />;
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">트레이너</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {tab === "trainers" ? "트레이너 계정 및 회원 관리" : "트레이너별 PT 정산 현황"}
        </p>
      </div>

      <div className="flex bg-card border border-border rounded-xl p-1 gap-1">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === t.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "trainers" ? <TrainerList /> : <SettlementTab />}
    </div>
  );
}
