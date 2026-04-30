import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { differenceInDays } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ArrowLeft, Settings, Phone, Mail, Users, ChevronRight, ChevronLeft, UserPlus, Edit, KeyRound, BarChart3, AtSign } from "lucide-react";
import { Label } from "@/components/ui/label";
import { trpc as trpcHook } from "@/lib/trpc";

interface Props {
  trainerId: number;
}

export default function TrainerDetail({ trainerId }: Props) {
  const [, setLocation] = useLocation();
  const { data: user } = trpcHook.auth.me.useQuery();

  // 정산 비율 수정
  const [settlementRate, setSettlementRate] = useState(50);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // 트레이너 정보 수정
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({ trainerName: "", phone: "", email: "" });

  // 비밀번호 초기화
  const [pwOpen, setPwOpen] = useState(false);
  const [pwForm, setPwForm] = useState({ newPassword: "", confirmPassword: "" });
  const [pwError, setPwError] = useState("");

  // 월별 정산
  const [settlementMonth, setSettlementMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const moveSettlementMonth = (delta: number) => {
    setSettlementMonth((prev) => {
      const [y, m] = prev.split("-").map(Number);
      const d = new Date(y, m - 1 + delta, 1);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    });
  };

  const trainerQuery = trpc.trainers.getById.useQuery({ id: trainerId });
  const { data: memberList } = trpc.admin.getMembersByTrainer.useQuery({ trainerId });
  const { data: settlement } = trpc.trainers.getMonthlySettlement.useQuery({ trainerId, yearMonth: settlementMonth });
  const { data: trainerStats } = trpc.trainers.getMyStats.useQuery({ trainerId });

  const monthOptions = Array.from({ length: 12 }, (_, i) => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - i);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [statsMonth, setStatsMonth] = useState(monthOptions[0]);
  const { data: monthlyStats } = trpc.trainers.getMonthlyStats.useQuery(
    { trainerId, yearMonth: statsMonth }
  );

  const trainer = trainerQuery.data;

  const updateSettlementRateMutation = trpc.trainers.updateSettlementRate.useMutation({
    onSuccess: () => {
      toast.success("정산 비율이 저장되었습니다.");
      setIsDialogOpen(false);
      trainerQuery.refetch();
    },
    onError: (err) => toast.error(err.message || "저장 실패"),
  });

  const updateInfoMutation = trpc.trainers.updateInfo.useMutation({
    onSuccess: () => {
      toast.success("트레이너 정보가 수정되었습니다.");
      setEditOpen(false);
      trainerQuery.refetch();
    },
    onError: (err) => toast.error(err.message || "수정 실패"),
  });

  const resetPasswordMutation = trpc.trainers.resetPassword.useMutation({
    onSuccess: () => {
      toast.success("비밀번호가 초기화되었습니다.");
      setPwOpen(false);
      setPwForm({ newPassword: "", confirmPassword: "" });
      setPwError("");
    },
    onError: (err) => toast.error(err.message || "초기화 실패"),
  });

  const handleResetPassword = () => {
    if (!pwForm.newPassword || !pwForm.confirmPassword) {
      setPwError("모든 항목을 입력해주세요."); return;
    }
    if (pwForm.newPassword.length < 6) {
      setPwError("비밀번호는 6자 이상이어야 합니다."); return;
    }
    if (pwForm.newPassword !== pwForm.confirmPassword) {
      setPwError("비밀번호가 일치하지 않습니다."); return;
    }
    setPwError("");
    resetPasswordMutation.mutate({ trainerId, newPassword: pwForm.newPassword });
  };

  // 트레이너 정보 로드 시 초기값 설정
  useEffect(() => {
    if (trainer) {
      setSettlementRate(trainer.settlementRate);
      setEditForm({
        trainerName: trainer.trainerName,
        phone: trainer.phone ?? "",
        email: trainer.email ?? "",
      });
    }
  }, [trainer]);

  if (trainerQuery.isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 rounded bg-card animate-pulse" />
        <div className="h-48 rounded-lg bg-card animate-pulse" />
      </div>
    );
  }

  if (!trainer) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>트레이너를 찾을 수 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setLocation("/")}
          className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold shrink-0">
            {trainer.trainerName.charAt(0)}
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-bold truncate">{trainer.trainerName}</h1>
            <p className="text-xs text-muted-foreground">트레이너</p>
          </div>
        </div>

        {/* 관리자 버튼 영역 */}
        {user?.role === "admin" && (
          <div className="flex items-center gap-2 shrink-0">
            <Button
              size="sm"
              className="gap-1.5"
              onClick={() => setLocation(`/trainers/${trainerId}/members/new`)}
            >
              <UserPlus className="h-4 w-4" />
              회원 등록
            </Button>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Settings className="h-4 w-4" />
                정산 비율 설정
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>정산 비율 설정</DialogTitle>
                <DialogDescription>
                  {trainer.trainerName}의 정산 비율을 설정합니다.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">정산 비율 (%)</label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      value={settlementRate}
                      onChange={(e) => setSettlementRate(parseInt(e.target.value) || 0)}
                      className="flex-1"
                    />
                    <span className="text-sm font-medium">%</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    예: 50%로 설정하면 PT 결제 금액의 50%를 정산받습니다.
                  </p>
                </div>
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                    취소
                  </Button>
                  <Button
                    onClick={() => {
                      updateSettlementRateMutation.mutate({
                        trainerId,
                        settlementRate,
                      });
                    }}
                    disabled={updateSettlementRateMutation.isPending}
                  >
                    {updateSettlementRateMutation.isPending ? "저장 중..." : "저장"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          </div>
        )}
      </div>

      {/* 트레이너 정보 카드 */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-base">트레이너 정보</CardTitle>
          {user?.role === "admin" && (
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 h-7 text-xs"
                onClick={() => {
                  setPwForm({ newPassword: "", confirmPassword: "" });
                  setPwError("");
                  setPwOpen(true);
                }}
              >
                <KeyRound className="h-3 w-3" />
                비밀번호
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 h-7 text-xs"
                onClick={() => {
                  setEditForm({
                    trainerName: trainer.trainerName,
                    phone: trainer.phone ?? "",
                    email: trainer.email ?? "",
                  });
                  setEditOpen(true);
                }}
              >
                <Edit className="h-3 w-3" />
                수정
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3">
            <AtSign className="h-4 w-4 text-muted-foreground shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">로그인 아이디</p>
              <p className="text-sm font-medium text-primary">{(trainer as any).username || "-"}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">연락처</p>
              <p className="text-sm font-medium">{trainer.phone || "-"}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">이메일</p>
              <p className="text-sm font-medium">{trainer.email || "-"}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Settings className="h-4 w-4 text-muted-foreground shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">정산 비율</p>
              <p className="text-sm font-medium text-primary">{trainer.settlementRate}%</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 비밀번호 초기화 다이얼로그 */}
      <Dialog open={pwOpen} onOpenChange={setPwOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-4 w-4" />
              비밀번호 초기화
            </DialogTitle>
            <DialogDescription>
              {trainer.trainerName} 트레이너의 비밀번호를 새로 설정합니다.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">새 비밀번호 <span className="text-primary">*</span></Label>
              <Input
                type="password"
                value={pwForm.newPassword}
                onChange={(e) => { setPwForm((p) => ({ ...p, newPassword: e.target.value })); setPwError(""); }}
                placeholder="6자 이상"
                className="h-9 text-sm"
                autoComplete="new-password"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">비밀번호 확인 <span className="text-primary">*</span></Label>
              <Input
                type="password"
                value={pwForm.confirmPassword}
                onChange={(e) => { setPwForm((p) => ({ ...p, confirmPassword: e.target.value })); setPwError(""); }}
                placeholder="동일하게 입력"
                className="h-9 text-sm"
                autoComplete="new-password"
              />
            </div>
            {pwError && (
              <p className="text-xs text-red-400 bg-red-500/10 rounded-lg px-3 py-2">{pwError}</p>
            )}
            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => setPwOpen(false)}>
                취소
              </Button>
              <Button
                className="flex-1"
                disabled={resetPasswordMutation.isPending}
                onClick={handleResetPassword}
              >
                {resetPasswordMutation.isPending ? "초기화 중..." : "초기화"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 트레이너 정보 수정 다이얼로그 */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>트레이너 정보 수정</DialogTitle>
            <DialogDescription>이름, 연락처, 이메일을 수정합니다.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">이름 <span className="text-primary">*</span></Label>
              <Input
                value={editForm.trainerName}
                onChange={(e) => setEditForm((p) => ({ ...p, trainerName: e.target.value }))}
                placeholder="트레이너 이름"
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">연락처</Label>
              <Input
                value={editForm.phone}
                onChange={(e) => setEditForm((p) => ({ ...p, phone: e.target.value }))}
                placeholder="010-0000-0000"
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">이메일</Label>
              <Input
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm((p) => ({ ...p, email: e.target.value }))}
                placeholder="example@email.com"
                className="h-9 text-sm"
              />
            </div>
            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => setEditOpen(false)}>
                취소
              </Button>
              <Button
                className="flex-1"
                disabled={!editForm.trainerName.trim() || updateInfoMutation.isPending}
                onClick={() =>
                  updateInfoMutation.mutate({
                    trainerId,
                    trainerName: editForm.trainerName,
                    phone: editForm.phone || undefined,
                    email: editForm.email || undefined,
                  })
                }
              >
                {updateInfoMutation.isPending ? "저장 중..." : "저장"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 트레이너 통계 */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />활동 통계
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 누적 */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">누적</p>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: "회원 수", value: `${trainerStats?.totalMembers ?? 0}명`, color: "text-blue-400" },
                { label: "수업 수", value: `${trainerStats?.totalSessions ?? 0}회`, color: "text-green-400" },
                { label: "재등록", value: `${trainerStats?.totalRereg ?? 0}회`, color: "text-primary" },
                { label: "노쇼", value: `${trainerStats?.totalNoShow ?? 0}회`, color: "text-orange-400" },
                { label: "이탈", value: `${trainerStats?.totalChurned ?? 0}명`, color: "text-red-400" },
                { label: "잔여 PT", value: `${trainerStats?.remainingPt ?? 0}회`, color: "text-purple-400" },
              ].map(s => (
                <div key={s.label} className="p-2.5 rounded-lg bg-accent/20 border border-border text-center">
                  <p className="text-xs text-muted-foreground mb-1">{s.label}</p>
                  <p className={`text-base font-bold ${s.color}`}>{s.value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* 월평균 */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">월평균</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "신규배정", value: `${trainerStats?.avgMonthlyNewMembers ?? 0}명` },
                { label: "재등록", value: `${trainerStats?.avgMonthlyRereg ?? 0}회` },
                { label: "PT 수", value: `${trainerStats?.avgMonthlyPt ?? 0}회` },
                { label: "노쇼", value: `${trainerStats?.avgMonthlyNoShow ?? 0}회` },
              ].map(s => (
                <div key={s.label} className="p-2.5 rounded-lg bg-accent/20 border border-border flex justify-between items-center">
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                  <p className="text-sm font-bold">{s.value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* 재등록률 */}
          <div className="p-3 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">재등록률</p>
              <p className="text-xs text-muted-foreground mt-0.5">전체 회원 중 재등록 비율</p>
            </div>
            <p className="text-2xl font-bold text-primary">{trainerStats?.reregRate ?? 0}%</p>
          </div>

          {/* 월별 조회 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">월별 조회</p>
              <Select value={statsMonth} onValueChange={setStatsMonth}>
                <SelectTrigger className="h-7 text-xs w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {monthOptions.map(ym => {
                    const [y, mo] = ym.split("-");
                    return <SelectItem key={ym} value={ym}>{y}년 {parseInt(mo)}월</SelectItem>;
                  })}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "수업 수", value: `${monthlyStats?.sessions ?? 0}회`, color: "text-green-400" },
                { label: "노쇼", value: `${monthlyStats?.noShow ?? 0}회`, color: "text-orange-400" },
                { label: "신규 배정", value: `${monthlyStats?.newMembers ?? 0}명`, color: "text-blue-400" },
                { label: "재등록", value: `${monthlyStats?.rereg ?? 0}회`, color: "text-primary" },
              ].map(s => (
                <div key={s.label} className="p-2.5 rounded-lg bg-accent/20 border border-border text-center">
                  <p className="text-xs text-muted-foreground mb-1">{s.label}</p>
                  <p className={`text-base font-bold ${s.color}`}>{s.value}</p>
                </div>
              ))}
            </div>
            <div className="mt-2 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30 flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">이달 매출</p>
                <p className="text-xs text-muted-foreground mt-0.5">등록 패키지 결제금액 합산</p>
              </div>
              <p className="text-xl font-bold text-yellow-400">{(monthlyStats?.revenue ?? 0).toLocaleString()}원</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 월별 정산 카드 */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              월별 정산
            </CardTitle>
            <div className="flex items-center gap-1">
              <button onClick={() => moveSettlementMonth(-1)} className="p-1.5 rounded hover:bg-accent transition-colors">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-sm font-medium px-1">{settlementMonth}</span>
              <button onClick={() => moveSettlementMonth(1)} className="p-1.5 rounded hover:bg-accent transition-colors">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-2 mb-4">
            <div className="text-center p-2.5 rounded-lg bg-accent/20">
              <p className="text-xl font-bold">{settlement?.sessionCount ?? 0}</p>
              <p className="text-xs text-muted-foreground mt-0.5">세션 수</p>
            </div>
            <div className="text-center p-2.5 rounded-lg bg-accent/20">
              <p className="text-lg font-bold">{(settlement?.revenue ?? 0).toLocaleString()}</p>
              <p className="text-xs text-muted-foreground mt-0.5">매출 (원)</p>
            </div>
            <div className="text-center p-2.5 rounded-lg bg-primary/10 border border-primary/20">
              <p className="text-lg font-bold text-primary">{(settlement?.settlementAmount ?? 0).toLocaleString()}</p>
              <p className="text-xs text-muted-foreground mt-0.5">정산 (원)</p>
            </div>
          </div>
          {settlement?.logs && settlement.logs.length > 0 ? (
            <div className="space-y-0">
              {settlement.logs.map((log) => (
                <div key={log.id} className="flex items-center justify-between text-xs py-2 border-b border-border last:border-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-muted-foreground shrink-0">
                      {format(new Date(log.sessionDate), "MM.dd (EEE)", { locale: ko })}
                    </span>
                    <span className="font-medium truncate">{log.memberName}</span>
                    {log.packageName && (
                      <span className="text-muted-foreground truncate">· {log.packageName}</span>
                    )}
                  </div>
                  <span className="font-medium text-primary shrink-0 ml-2">
                    {log.pricePerSession ? `${log.pricePerSession.toLocaleString()}원` : "-"}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-xs text-muted-foreground py-4">이번 달 세션 기록이 없습니다.</p>
          )}
        </CardContent>
      </Card>

      {/* 담당 회원 목록 */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            담당 회원
            <span className="ml-auto text-xs font-normal text-muted-foreground">총 {memberList?.length ?? 0}명</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {!memberList?.length ? (
            <p className="text-sm text-muted-foreground text-center py-6">담당 회원이 없습니다.</p>
          ) : (
            memberList.map((m) => {
              const today = new Date();
              const daysLeft = m.membershipEnd ? differenceInDays(new Date(m.membershipEnd), today) : null;
              const isExpiringSoon = daysLeft !== null && daysLeft >= 0 && daysLeft <= 7;
              return (
                <button
                  key={m.id}
                  onClick={() => setLocation(`/members/${m.id}`)}
                  className="w-full flex items-center justify-between p-3 rounded-lg bg-accent/20 border border-border hover:border-primary/40 transition-colors text-left"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-xs shrink-0">
                      {m.name.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="text-sm font-medium">{m.name}</p>
                        <span className={`text-xs px-1.5 py-0.5 rounded-full border ${
                          m.status === "active"
                            ? "bg-green-500/20 text-green-400 border-green-500/30"
                            : "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"
                        }`}>
                          {m.status === "active" ? "활성" : "정지"}
                        </span>
                        {isExpiringSoon && (
                          <span className="text-xs px-1.5 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
                            D-{daysLeft}
                          </span>
                        )}
                        {m.hasUnpaid && (
                          <span className="text-xs px-1.5 py-0.5 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/30">
                            미수금
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {m.membershipEnd
                          ? `만료 ${format(new Date(m.membershipEnd), "yyyy.MM.dd", { locale: ko })}`
                          : "만료일 없음"}
                        {m.remainingPt > 0 && ` · PT ${m.remainingPt}회`}
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 ml-2" />
                </button>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}
