import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { User, Lock, Coins, Plus, CheckCircle, Clock, XCircle, Briefcase, Gift, Star } from "lucide-react";
import { toast } from "sonner";
import TabBanner from "@/components/TabBanner";

const TYPE_LABEL: Record<string, string> = {
  admin_grant: "관리자 지급",
  charge_request: "충전 신청",
  daily_reset: "일일 초기화",
  usage: "사용",
  profile_bonus: "프로필 완성 보너스",
};

const SPECIALTIES_OPTIONS = ["웨이트 트레이닝", "필라테스", "크로스핏", "다이어트", "재활/체형교정", "근육증가", "유산소/달리기", "요가", "스포츠 전문", "시니어 피트니스"];

function ProfileCompletionBanner({ profile }: { profile: { employmentType?: string | null; workplaceName?: string | null; workYears?: number | null; specialties?: string | null; profileBonusGranted?: number } | undefined }) {
  if (!profile) return null;
  const fields = [profile.employmentType, profile.workplaceName, profile.workYears !== null && profile.workYears !== undefined, profile.specialties];
  const filled = fields.filter(Boolean).length;
  const total = fields.length;
  const pct = Math.round((filled / total) * 100);
  if (profile.profileBonusGranted) return null;
  return (
    <div className="rounded-xl border border-yellow-500/40 bg-yellow-500/10 p-4 flex items-start gap-3">
      <Gift className="h-5 w-5 text-yellow-400 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-yellow-300">트레이너 프로필 완성 시 <span className="text-yellow-400">+200P</span> 지급!</p>
        <p className="text-xs text-muted-foreground mt-0.5">근무형태, 근무지, 경력, 전문분야를 모두 입력하면 FIT POINT 200P를 드립니다.</p>
        <div className="mt-2">
          <div className="flex justify-between text-xs text-muted-foreground mb-1">
            <span>프로필 완성도</span>
            <span className="text-yellow-400 font-medium">{filled}/{total} ({pct}%)</span>
          </div>
          <div className="h-1.5 bg-border rounded-full overflow-hidden">
            <div className="h-full bg-yellow-400 rounded-full transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Profile() {
  const { data: profile, refetch } = trpc.trainers.getMyProfile.useQuery();
  const utils = trpc.useUtils();
  const { data: balanceData } = trpc.fitPoints.getBalance.useQuery();
  const { data: history } = trpc.fitPoints.getHistory.useQuery();

  const [info, setInfo] = useState({ trainerName: "", phone: "", email: "" });
  const [ext, setExt] = useState({ employmentType: "" as "" | "freelancer" | "employed", workplaceName: "", workYears: "", specialties: "" });
  const [pw, setPw] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [infoMsg, setInfoMsg] = useState("");
  const [pwMsg, setPwMsg] = useState("");
  const [chargeAmount, setChargeAmount] = useState("");
  const [chargeMemo, setChargeMemo] = useState("");
  const [showChargeForm, setShowChargeForm] = useState(false);

  useEffect(() => {
    if (profile) {
      setInfo({ trainerName: profile.trainerName, phone: profile.phone ?? "", email: profile.email ?? "" });
      setExt({
        employmentType: (profile.employmentType as "" | "freelancer" | "employed") ?? "",
        workplaceName: profile.workplaceName ?? "",
        workYears: profile.workYears !== null && profile.workYears !== undefined ? String(profile.workYears) : "",
        specialties: profile.specialties ?? "",
      });
    }
  }, [profile]);

  const updateProfile = trpc.trainers.updateMyProfile.useMutation({
    onSuccess: () => { setInfoMsg(""); toast.success("프로필이 수정되었습니다."); refetch(); },
    onError: (e) => setInfoMsg(e.message),
  });

  const updateExtended = trpc.trainers.updateExtendedProfile.useMutation({
    onSuccess: (data) => {
      if (data.bonusGranted) {
        toast.success("🎉 프로필 완성! FIT POINT 200P가 지급되었습니다.");
        utils.fitPoints.getBalance.invalidate();
        utils.fitPoints.getHistory.invalidate();
      } else {
        toast.success("트레이너 정보가 저장되었습니다.");
      }
      refetch();
    },
    onError: (e) => toast.error(e.message),
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

  const handleExtSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateExtended.mutate({
      employmentType: ext.employmentType || undefined,
      workplaceName: ext.workplaceName || undefined,
      workYears: ext.workYears ? parseInt(ext.workYears) : undefined,
      specialties: ext.specialties || undefined,
    });
  };

  const toggleSpecialty = (s: string) => {
    const arr = ext.specialties ? ext.specialties.split(",").map(x => x.trim()).filter(Boolean) : [];
    const idx = arr.indexOf(s);
    if (idx >= 0) arr.splice(idx, 1); else arr.push(s);
    setExt(p => ({ ...p, specialties: arr.join(", ") }));
  };

  const handlePwSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pw.currentPassword || !pw.newPassword) { setPwMsg("모든 항목을 입력해주세요."); return; }
    if (pw.newPassword !== pw.confirmPassword) { setPwMsg("새 비밀번호가 일치하지 않습니다."); return; }
    if (pw.newPassword.length < 6) { setPwMsg("비밀번호는 6자 이상이어야 합니다."); return; }
    changePassword.mutate({ currentPassword: pw.currentPassword, newPassword: pw.newPassword });
  };

  const balance = balanceData?.balance ?? 0;
  const selectedSpecialties = ext.specialties ? ext.specialties.split(",").map(x => x.trim()).filter(Boolean) : [];

  return (
    <div className="space-y-6">
      <TabBanner tabKey="profile" />
      <div>
        <h1 className="text-xl font-bold">내 프로필</h1>
        <p className="text-sm text-muted-foreground mt-0.5">정보 수정 및 포인트 관리</p>
      </div>

      {/* 프로필 완성 보너스 안내 */}
      <ProfileCompletionBanner profile={profile} />

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
      {history && history.filter(l => l.type !== "daily_reset").length > 0 && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">FIT POINT 내역</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {history.filter(l => l.type !== "daily_reset").slice(0, 10).map((log, i) => (
              <div key={log.id}
                className={`flex items-center gap-3 px-4 py-3 ${i < Math.min(history.filter(l => l.type !== "daily_reset").length, 10) - 1 ? "border-b border-border/50" : ""}`}>
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

      {/* 트레이너 상세 프로필 */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-primary" />트레이너 상세 정보
            {!profile?.profileBonusGranted && (
              <span className="ml-auto flex items-center gap-1 text-xs font-normal text-yellow-400 bg-yellow-500/10 border border-yellow-500/30 px-2 py-0.5 rounded-full">
                <Gift className="h-3 w-3" />완성 시 +200P
              </span>
            )}
            {!!profile?.profileBonusGranted && (
              <span className="ml-auto flex items-center gap-1 text-xs font-normal text-green-400 bg-green-500/10 border border-green-500/30 px-2 py-0.5 rounded-full">
                <Star className="h-3 w-3" />보너스 지급 완료
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleExtSubmit} className="space-y-4">
            {/* 근무 형태 */}
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">근무 형태</Label>
              <div className="grid grid-cols-2 gap-2">
                {[{ value: "freelancer", label: "프리랜서" }, { value: "employed", label: "센터 소속" }].map(opt => (
                  <button key={opt.value} type="button"
                    onClick={() => setExt(p => ({ ...p, employmentType: opt.value as "freelancer" | "employed" }))}
                    className={`py-2.5 rounded-lg border text-sm font-medium transition-colors ${ext.employmentType === opt.value ? "bg-primary/20 border-primary text-primary" : "bg-input border-border text-muted-foreground hover:border-primary/50"}`}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 근무지 */}
            <div className="space-y-1">
              <Label className="text-sm text-muted-foreground">
                {ext.employmentType === "freelancer" ? "주 활동 지역" : "근무 센터/헬스장 이름"}
              </Label>
              <Input
                value={ext.workplaceName}
                onChange={e => setExt(p => ({ ...p, workplaceName: e.target.value }))}
                placeholder={ext.employmentType === "freelancer" ? "예: 강남구, 서초구" : "예: 강남 피트니스 센터"}
                className="bg-input border-border"
              />
            </div>

            {/* 경력 */}
            <div className="space-y-1">
              <Label className="text-sm text-muted-foreground">경력 (년)</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number" min="0" max="50"
                  value={ext.workYears}
                  onChange={e => setExt(p => ({ ...p, workYears: e.target.value }))}
                  placeholder="예: 3"
                  className="bg-input border-border w-28"
                />
                <span className="text-sm text-muted-foreground">년차</span>
              </div>
            </div>

            {/* 전문분야 */}
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">전문분야 (복수 선택)</Label>
              <div className="flex flex-wrap gap-1.5">
                {SPECIALTIES_OPTIONS.map(s => {
                  const selected = selectedSpecialties.includes(s);
                  return (
                    <button key={s} type="button"
                      onClick={() => toggleSpecialty(s)}
                      className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${selected ? "bg-primary/20 border-primary text-primary" : "bg-input border-border text-muted-foreground hover:border-primary/50"}`}>
                      {s}
                    </button>
                  );
                })}
              </div>
              {ext.specialties && (
                <p className="text-xs text-muted-foreground">선택: {ext.specialties}</p>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={updateExtended.isPending}>
              {updateExtended.isPending ? "저장 중..." : "저장"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* 기본 정보 수정 */}
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
