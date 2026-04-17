import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { User, Lock, CheckCircle } from "lucide-react";
import { toast } from "sonner";

export default function Profile() {
  const { data: profile, refetch } = trpc.trainers.getMyProfile.useQuery();

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
