import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { User, Lock, BarChart2 } from "lucide-react";
import { toast } from "sonner";

function StatItem({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="p-3 rounded-lg bg-accent/20 border border-border flex flex-col gap-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-lg font-bold ${color ?? ""}`}>{value}</p>
    </div>
  );
}

export default function Profile() {
  const { data: profile, refetch } = trpc.trainers.getMyProfile.useQuery();
  const { data: stats } = trpc.trainers.getMyStats.useQuery();

  const monthOptions = Array.from({ length: 12 }, (_, i) => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - i);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [statsMonth, setStatsMonth] = useState(monthOptions[0]);
  const trainerId = profile?.id;
  const { data: monthlyStats } = trpc.trainers.getMonthlyStats.useQuery(
    { trainerId: trainerId ?? 0, yearMonth: statsMonth },
    { enabled: !!trainerId }
  );

  const [info, setInfo] = useState({ trainerName: "", phone: "", email: "" });
  const [pw, setPw] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [infoMsg, setInfoMsg] = useState("");
  const [pwMsg, setPwMsg] = useState("");

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">내 프로필</h1>
        <p className="text-sm text-muted-foreground mt-0.5">정보 수정 및 비밀번호 변경</p>
      </div>

      {/* 정산 비율 (읽기 전용) */}
      <Card className="bg-card border-border">
        <CardContent className="p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">내 정산 비율</p>
            <p className="text-2xl font-bold text-primary mt-1">{profile?.settlementRate ?? 50}%</p>
          </div>
          <p className="text-xs text-muted-foreground">관리자가 설정합니다</p>
        </CardContent>
      </Card>

      {/* 통계 */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart2 className="h-4 w-4 text-primary" />내 활동 통계
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 누적 */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">누적</p>
            <div className="grid grid-cols-2 gap-2">
              <StatItem label="회원 수" value={`${stats?.totalMembers ?? 0}명`} color="text-blue-400" />
              <StatItem label="수업 수" value={`${stats?.totalSessions ?? 0}회`} color="text-green-400" />
              <StatItem label="재등록 수" value={`${stats?.totalRereg ?? 0}회`} color="text-primary" />
              <StatItem label="노쇼 수" value={`${stats?.totalNoShow ?? 0}회`} color="text-orange-400" />
              <StatItem label="이탈 수" value={`${stats?.totalChurned ?? 0}명`} color="text-red-400" />
              <StatItem label="잔여 PT" value={`${stats?.remainingPt ?? 0}회`} color="text-purple-400" />
            </div>
          </div>

          {/* 월평균 */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">월평균</p>
            <div className="grid grid-cols-2 gap-2">
              <StatItem label="신규배정" value={`${stats?.avgMonthlyNewMembers ?? 0}명`} />
              <StatItem label="재등록" value={`${stats?.avgMonthlyRereg ?? 0}회`} />
              <StatItem label="PT 수" value={`${stats?.avgMonthlyPt ?? 0}회`} />
              <StatItem label="노쇼" value={`${stats?.avgMonthlyNoShow ?? 0}회`} />
            </div>
          </div>

          {/* 재등록률 */}
          <div className="p-3 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">재등록률</p>
              <p className="text-xs text-muted-foreground mt-0.5">전체 회원 중 재등록 비율</p>
            </div>
            <p className="text-2xl font-bold text-primary">{stats?.reregRate ?? 0}%</p>
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
              <StatItem label="수업 수" value={`${monthlyStats?.sessions ?? 0}회`} color="text-green-400" />
              <StatItem label="노쇼" value={`${monthlyStats?.noShow ?? 0}회`} color="text-orange-400" />
              <StatItem label="신규 배정" value={`${monthlyStats?.newMembers ?? 0}명`} color="text-blue-400" />
              <StatItem label="재등록" value={`${monthlyStats?.rereg ?? 0}회`} color="text-primary" />
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
