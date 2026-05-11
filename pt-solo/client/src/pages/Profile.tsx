import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { User, Lock, Coins, Plus, CheckCircle, Clock, XCircle } from "lucide-react";
import { toast } from "sonner";
import TabBanner from "@/components/TabBanner";

const TYPE_LABEL: Record<string, string> = {
  admin_grant: "관리자 지급",
  charge_request: "충전 신청",
  daily_reset: "일일 초기화",
  usage: "사용",
};

export default function Profile() {
  const { data: profile, refetch } = trpc.trainers.getMyProfile.useQuery();
  const utils = trpc.useUtils();
  const { data: balanceData } = trpc.fitPoints.getBalance.useQuery();
  const { data: history } = trpc.fitPoints.getHistory.useQuery();

  const [info, setInfo] = useState({ trainerName: "", phone: "", email: "" });
  const [pw, setPw] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [infoMsg, setInfoMsg] = useState("");
  const [pwMsg, setPwMsg] = useState("");
  const [chargeAmount, setChargeAmount] = useState("");
  const [chargeMemo, setChargeMemo] = useState("");
  const [showChargeForm, setShowChargeForm] = useState(false);

  useEffect(() => {
    if (profile) setInfo({ trainerName: profile.trainerName, phone: profile.phone ?? "", email: profile.email ?? "" });
  }, [profile]);

  const updateProfile = trpc.trainers.updateMyProfile.useMutation({
    onSuccess: () => { setInfoMsg(""); toast.success("프로필이 수정되었습니다."); refetch(); },
    onError: (e) => setInfoMsg(e.message),
  });

  const changePassword = trpc.trainers.changePassword.useMutation({
    onSuccess: () => { setPwMsg(""); setPw({ currentPassword: "", newPassword: "", confirmPassword: "" }); toast.success("비밀번호가 변경되었습니다."); },
    onError: (e) => setPwMsg(e.message),
  });

  const requestCharge = trpc.fitPoints.requestCharge.useMutation({
    onSuccess: () => {
      toast.success("충전 신청이 완료되었습니다.");
      setChargeAmount(""); setChargeMemo(""); setShowChargeForm(false);
      utils.fitPoints.getHistory.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const handleInfoSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!info.trainerName.trim()) { setInfoMsg("이름을 입력해주세요."); return; }
    updateProfile.mutate({ trainerName: info.trainerName, phone: info.phone || undefined, email: info.email || undefined });
  };

  const handlePwSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pw.currentPassword || !pw.newPassword) { setPwMsg("모든 항목을 입력해주세요."); return; }
    if (pw.newPassword !== pw.confirmPassword) { setPwMsg("새 비밀번호가 일치하지 않습니다."); return; }
    if (pw.newPassword.length < 6) { setPwMsg("비밀번호는 6자 이상이어야 합니다."); return; }
    changePassword.mutate({ currentPassword: pw.currentPassword, newPassword: pw.newPassword });
  };

  const balance = balanceData?.balance ?? 0;

  return (
    <div className="space-y-6">
      <TabBanner tabKey="profile" />
      <div>
        <h1 className="text-xl font-bold">내 프로필</h1>
        <p className="text-sm text-muted-foreground mt-0.5">정보 수정 및 포인트 관리</p>
      </div>

      {/* FIT POINT */}
      <Card className="bg-primary/10 border-primary/30">
        <CardContent className="p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center shrink-0">
            <Coins className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground mb-0.5">보유 FIT POINT</p>
            <p className="text-2xl font-black text-primary tracking-tight">
              {balance.toLocaleString()} <span className="text-sm font-semibold">P</span>
            </p>
          </div>
          {!showChargeForm && (
            <button onClick={() => setShowChargeForm(true)}
              className="flex items-center gap-1 text-xs text-primary font-medium bg-primary/20 px-2.5 py-1.5 rounded-lg hover:bg-primary/30 transition-colors shrink-0">
              <Plus className="h-3.5 w-3.5" />충전 신청
            </button>
          )}
        </CardContent>

        {showChargeForm && (
          <CardContent className="pt-0 space-y-3">
            <div className="flex gap-2">
              <Input type="number" placeholder="충전 포인트" value={chargeAmount}
                onChange={e => setChargeAmount(e.target.value)}
                className="h-9 text-sm bg-background/50 border-primary/30" />
              <Input placeholder="메모 (선택)" value={chargeMemo}
                onChange={e => setChargeMemo(e.target.value)}
                className="h-9 text-sm bg-background/50 border-primary/30 flex-1" />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1" onClick={() => setShowChargeForm(false)}>취소</Button>
              <Button size="sm" className="flex-1"
                disabled={!chargeAmount || requestCharge.isPending}
                onClick={() => requestCharge.mutate({ amount: Number(chargeAmount), memo: chargeMemo || undefined })}>
                {requestCharge.isPending ? "신청 중..." : "신청"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">관리자 승인 후 포인트가 지급됩니다.</p>
          </CardContent>
        )}
      </Card>

      {/* 포인트 내역 */}
      {history && history.length > 0 && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">FIT POINT 내역</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {history.slice(0, 10).map((log, i) => (
              <div key={log.id}
                className={`flex items-center gap-3 px-4 py-3 ${i < Math.min(history.length, 10) - 1 ? "border-b border-border/50" : ""}`}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    {log.status === "completed" && <CheckCircle className="h-3.5 w-3.5 text-green-400 shrink-0" />}
                    {log.status === "pending" && <Clock className="h-3.5 w-3.5 text-yellow-400 shrink-0" />}
                    {log.status === "rejected" && <XCircle className="h-3.5 w-3.5 text-red-400 shrink-0" />}
                    <span className="text-sm font-medium">{TYPE_LABEL[log.type] ?? log.type}</span>
                  </div>
                  {log.memo && <p className="text-xs text-muted-foreground mt-0.5 truncate">{log.memo}</p>}
                  <p className="text-xs text-muted-foreground mt-0.5">{log.createdAt.slice(0, 10)}</p>
                </div>
                <span className={`text-sm font-bold shrink-0 ${log.amount > 0 ? "text-green-400" : "text-red-400"}`}>
                  {log.amount > 0 ? "+" : ""}{log.amount.toLocaleString()} P
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* 프로필 수정 */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <User className="h-4 w-4 text-primary" />기본 정보 수정
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleInfoSubmit} className="space-y-3">
            <div className="space-y-1">
              <Label className="text-sm text-muted-foreground">이름 *</Label>
              <Input value={info.trainerName} onChange={e => setInfo(p => ({ ...p, trainerName: e.target.value }))} className="bg-input border-border" />
            </div>
            <div className="space-y-1">
              <Label className="text-sm text-muted-foreground">전화번호</Label>
              <Input value={info.phone} onChange={e => setInfo(p => ({ ...p, phone: e.target.value }))} placeholder="010-0000-0000" className="bg-input border-border" />
            </div>
            <div className="space-y-1">
              <Label className="text-sm text-muted-foreground">이메일</Label>
              <Input type="email" value={info.email} onChange={e => setInfo(p => ({ ...p, email: e.target.value }))} placeholder="선택 입력" className="bg-input border-border" />
            </div>
            {infoMsg && <p className="text-red-500 text-sm bg-red-500/10 rounded p-2">{infoMsg}</p>}
            <Button type="submit" className="w-full" disabled={updateProfile.isPending}>
              {updateProfile.isPending ? "저장 중..." : "저장"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* 비밀번호 변경 */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Lock className="h-4 w-4 text-primary" />비밀번호 변경
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePwSubmit} className="space-y-3">
            <div className="space-y-1">
              <Label className="text-sm text-muted-foreground">현재 비밀번호</Label>
              <Input type="password" value={pw.currentPassword} onChange={e => setPw(p => ({ ...p, currentPassword: e.target.value }))} className="bg-input border-border" autoComplete="current-password" />
            </div>
            <div className="space-y-1">
              <Label className="text-sm text-muted-foreground">새 비밀번호</Label>
              <Input type="password" value={pw.newPassword} onChange={e => setPw(p => ({ ...p, newPassword: e.target.value }))} placeholder="6자 이상" className="bg-input border-border" autoComplete="new-password" />
            </div>
            <div className="space-y-1">
              <Label className="text-sm text-muted-foreground">새 비밀번호 확인</Label>
              <Input type="password" value={pw.confirmPassword} onChange={e => setPw(p => ({ ...p, confirmPassword: e.target.value }))} className="bg-input border-border" autoComplete="new-password" />
            </div>
            {pwMsg && <p className="text-red-500 text-sm bg-red-500/10 rounded p-2">{pwMsg}</p>}
            <Button type="submit" className="w-full" disabled={changePassword.isPending}>
              {changePassword.isPending ? "변경 중..." : "비밀번호 변경"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
