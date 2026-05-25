import { useState, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { User, Lock, Coins, Plus, CheckCircle, Clock, XCircle, Briefcase, Gift, Star, Camera, ChevronDown, Share2, Copy, Check, Users } from "lucide-react";
import { toast } from "sonner";
import TabBanner from "@/components/TabBanner";

const TYPE_LABEL: Record<string, string> = {
  admin_grant: "관리자 지급",
  charge_request: "충전 신청",
  daily_reset: "일일 초기화",
  usage: "사용",
  profile_bonus: "프로필 완성 보너스",
  referral_bonus: "친구 초대 보너스",
};

const JOB_TYPES = ["퍼스널트레이너", "필라테스강사", "트레이너 준비생", "센터 운영자", "프리랜서", "학생"];
const CAREER_RANGES = ["준비 중", "1년 미만", "1~3년", "3~5년", "5년 이상"];
const EARLY_CAREER_RANGES = new Set(["준비 중", "1년 미만", "1~3년"]);
const EDUCATION_NEEDS = [
  "웨이트 트레이닝 (저항 운동)",
  "필라테스 (매트·기구)",
  "요가 (하타·플로우)",
  "크로스핏 / 기능성 훈련",
  "수영 / 아쿠아 운동",
  "사이클 / 스피닝",
  "복싱 / 격투 피트니스",
  "재활 운동 / 물리치료 연계",
  "체형 교정 / 자세 분석",
  "영양·식이 코칭",
  "노인·시니어 피트니스",
  "산전·산후 운동",
  "스포츠 경기력 향상",
  "온라인 PT 운영 방법",
];

async function resizeImageToBase64(file: File, maxSize = 300): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/jpeg", 0.8));
    };
    img.onerror = reject;
    img.src = url;
  });
}

function ProfileCompletionBanner({ profile }: { profile: { jobType?: string | null; careerRange?: string | null; activityArea?: string | null; profileBonusGranted?: number } | undefined }) {
  if (!profile) return null;
  const fields = [profile.jobType, profile.careerRange, profile.activityArea];
  const filled = fields.filter(Boolean).length;
  const total = fields.length;
  const pct = Math.round((filled / total) * 100);
  if (profile.profileBonusGranted) return null;
  return (
    <div className="rounded-xl border border-yellow-500/40 bg-yellow-500/10 p-4 flex items-start gap-3">
      <Gift className="h-5 w-5 text-yellow-400 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-yellow-300">트레이너 프로필 완성 시 <span className="text-yellow-400">+200P</span> 지급!</p>
        <p className="text-xs text-muted-foreground mt-0.5">직무, 경력, 활동지역을 모두 입력하면 FIT POINT 200P를 드립니다.</p>
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
  const { data: referralInfo } = trpc.trainers.getMyReferralInfo.useQuery();
  const utils = trpc.useUtils();
  const { data: balanceData } = trpc.fitPoints.getBalance.useQuery();
  const { data: history } = trpc.fitPoints.getHistory.useQuery();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [info, setInfo] = useState({ trainerName: "", phone: "", email: "" });
  const [ext, setExt] = useState({ jobType: "", careerRange: "", activityArea: "", profileImage: "", educationNeeds: "" });
  const [pw, setPw] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [infoMsg, setInfoMsg] = useState("");
  const [pwMsg, setPwMsg] = useState("");
  const [chargeAmount, setChargeAmount] = useState("");
  const [chargeMemo, setChargeMemo] = useState("");
  const [showChargeForm, setShowChargeForm] = useState(false);
  const [showPointDetail, setShowPointDetail] = useState(false);
  const [referralCopied, setReferralCopied] = useState(false);

  useEffect(() => {
    if (profile) {
      setInfo({ trainerName: profile.trainerName, phone: profile.phone ?? "", email: profile.email ?? "" });
      setExt({
        jobType: (profile as any).jobType ?? "",
        careerRange: (profile as any).careerRange ?? "",
        activityArea: (profile as any).activityArea ?? "",
        profileImage: (profile as any).profileImage ?? "",
        educationNeeds: (profile as any).educationNeeds ?? "",
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
      jobType: ext.jobType || undefined,
      careerRange: ext.careerRange || undefined,
      activityArea: ext.activityArea || undefined,
      profileImage: ext.profileImage || undefined,
      educationNeeds: ext.educationNeeds || undefined,
    });
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const base64 = await resizeImageToBase64(file);
      setExt(p => ({ ...p, profileImage: base64 }));
    } catch {
      toast.error("이미지 처리 중 오류가 발생했습니다.");
    }
    e.target.value = "";
  };

  const handlePwSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pw.currentPassword || !pw.newPassword) { setPwMsg("모든 항목을 입력해주세요."); return; }
    if (pw.newPassword !== pw.confirmPassword) { setPwMsg("새 비밀번호가 일치하지 않습니다."); return; }
    if (pw.newPassword.length < 6) { setPwMsg("비밀번호는 6자 이상이어야 합니다."); return; }
    changePassword.mutate({ currentPassword: pw.currentPassword, newPassword: pw.newPassword });
  };

  const balance = balanceData?.balance ?? 0;
  const freeBalance = balanceData?.freeBalance ?? 0;
  const earnedBalance = balanceData?.earnedBalance ?? 0;
  const dailyPoint = balanceData?.dailyPoint ?? 300;

  return (
    <div className="space-y-6">
      <TabBanner tabKey="profile" />
      <div>
        <h1 className="text-xl font-bold">내 프로필</h1>
        <p className="text-sm text-muted-foreground mt-0.5">정보 수정 및 포인트 관리</p>
      </div>

      {/* 프로필 완성 보너스 안내 */}
      <ProfileCompletionBanner profile={profile as any} />

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
            <button
              onClick={() => setShowPointDetail(v => !v)}
              className="flex items-center gap-0.5 text-[10px] text-muted-foreground/70 hover:text-muted-foreground mt-1 transition-colors"
            >
              포인트 상세
              <ChevronDown className={`h-3 w-3 transition-transform ${showPointDetail ? "rotate-180" : ""}`} />
            </button>
          </div>
          {!showChargeForm && (
            <button onClick={() => setShowChargeForm(true)}
              className="flex items-center gap-1 text-xs text-primary font-medium bg-primary/20 px-2.5 py-1.5 rounded-lg hover:bg-primary/30 transition-colors shrink-0">
              <Plus className="h-3.5 w-3.5" />충전 신청
            </button>
          )}
        </CardContent>

        {showPointDetail && (
          <CardContent className="pt-0 pb-4 px-5">
            <div className="rounded-xl bg-background/40 border border-primary/20 divide-y divide-border/50 text-xs">
              <div className="flex items-center justify-between px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
                  <span className="text-muted-foreground">무료포인트</span>
                </div>
                <div className="text-right">
                  <span className="font-bold text-blue-400">{freeBalance.toLocaleString()} P</span>
                  <span className="text-muted-foreground/60 ml-1.5">/ {dailyPoint.toLocaleString()} P</span>
                </div>
              </div>
              <div className="flex items-center justify-between px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                  <span className="text-muted-foreground">적립포인트</span>
                </div>
                <span className="font-bold text-primary">{earnedBalance.toLocaleString()} P</span>
              </div>
              <div className="px-3 py-2 bg-blue-500/5 rounded-b-xl">
                <p className="text-[10px] text-muted-foreground/60 leading-relaxed">
                  💡 무료포인트는 매일 <span className="text-blue-400 font-medium">{dailyPoint.toLocaleString()}P</span>로 제공되며 <span className="text-blue-400 font-medium">00시에 초기화</span>됩니다.
                  적립포인트는 보너스·관리자 지급 포인트로 초기화되지 않습니다.
                </p>
              </div>
            </div>
          </CardContent>
        )}

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

      {/* 친구 초대 */}
      {referralInfo?.referralCode && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Share2 className="h-4 w-4 text-primary" />친구 초대하기
              <span className="ml-auto flex items-center gap-1 text-xs font-normal text-primary bg-primary/10 border border-primary/30 px-2 py-0.5 rounded-full">
                각 +500P
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              초대 링크를 공유하면 친구가 가입 승인 후 <span className="text-primary font-semibold">각각 500 FIT POINT</span>를 드립니다.
              최대 <span className="text-primary font-semibold">3명</span>까지 혜택이 적용됩니다.
            </p>
            {/* 초대 링크 */}
            <div className="flex items-center gap-2 bg-accent/30 border border-border rounded-lg px-3 py-2.5">
              <p className="flex-1 text-xs text-muted-foreground truncate">
                {window.location.origin}/register?ref={referralInfo.referralCode}
              </p>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}/register?ref=${referralInfo.referralCode}`);
                  setReferralCopied(true);
                  setTimeout(() => setReferralCopied(false), 2000);
                }}
                className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-md transition-colors shrink-0 ${referralCopied ? "text-green-400 bg-green-400/10" : "text-primary bg-primary/10 hover:bg-primary/20"}`}
              >
                {referralCopied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {referralCopied ? "복사됨" : "복사"}
              </button>
            </div>
            {/* 초대 현황 */}
            <div className="flex gap-3">
              <div className="flex-1 rounded-xl bg-accent/20 border border-border p-3 text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Users className="h-3.5 w-3.5 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">초대한 친구</p>
                </div>
                <p className="text-xl font-black text-foreground">{referralInfo.totalInvited}</p>
                <p className="text-[10px] text-muted-foreground">명</p>
              </div>
              <div className="flex-1 rounded-xl bg-primary/10 border border-primary/20 p-3 text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <CheckCircle className="h-3.5 w-3.5 text-primary" />
                  <p className="text-xs text-muted-foreground">보너스 지급</p>
                </div>
                <p className="text-xl font-black text-primary">{Math.min(referralInfo.approvedInvited, 3)}<span className="text-sm font-medium text-muted-foreground"> / 3</span></p>
                <p className="text-[10px] text-muted-foreground">명</p>
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground/60 text-center">
              내 초대 코드: <span className="font-mono font-bold">{referralInfo.referralCode}</span>
            </p>
          </CardContent>
        </Card>
      )}

      {/* 트레이너 상세 프로필 */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-primary" />트레이너 상세 정보
            {!(profile as any)?.profileBonusGranted && (
              <span className="ml-auto flex items-center gap-1 text-xs font-normal text-yellow-400 bg-yellow-500/10 border border-yellow-500/30 px-2 py-0.5 rounded-full">
                <Gift className="h-3 w-3" />완성 시 +200P
              </span>
            )}
            {!!(profile as any)?.profileBonusGranted && (
              <span className="ml-auto flex items-center gap-1 text-xs font-normal text-green-400 bg-green-500/10 border border-green-500/30 px-2 py-0.5 rounded-full">
                <Star className="h-3 w-3" />보너스 지급 완료
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleExtSubmit} className="space-y-5">
            {/* 프로필 이미지 */}
            <div className="flex flex-col items-center gap-3">
              <div className="relative">
                <div className="w-24 h-24 rounded-full bg-primary/10 border-2 border-border overflow-hidden flex items-center justify-center">
                  {ext.profileImage ? (
                    <img src={ext.profileImage} alt="프로필" className="w-full h-full object-cover" />
                  ) : (
                    <User className="h-10 w-10 text-muted-foreground/50" />
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-primary flex items-center justify-center border-2 border-card"
                >
                  <Camera className="h-3.5 w-3.5 text-primary-foreground" />
                </button>
              </div>
              <p className="text-xs text-muted-foreground">프로필 사진을 설정하세요</p>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
            </div>

            {/* 직무 선택 */}
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">직무 선택</Label>
              <div className="grid grid-cols-3 gap-2">
                {JOB_TYPES.map(jt => (
                  <button key={jt} type="button"
                    onClick={() => setExt(p => ({ ...p, jobType: jt }))}
                    className={`py-2 rounded-lg border text-xs font-medium transition-colors ${ext.jobType === jt ? "bg-primary/20 border-primary text-primary" : "bg-input border-border text-muted-foreground hover:border-primary/50"}`}>
                    {jt}
                  </button>
                ))}
              </div>
            </div>

            {/* 경력 선택 */}
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">경력 선택</Label>
              <div className="grid grid-cols-5 gap-1.5">
                {CAREER_RANGES.map(cr => (
                  <button key={cr} type="button"
                    onClick={() => setExt(p => ({ ...p, careerRange: cr, educationNeeds: EARLY_CAREER_RANGES.has(cr) ? p.educationNeeds : "" }))}
                    className={`py-2 rounded-lg border text-xs font-medium transition-colors ${ext.careerRange === cr ? "bg-primary/20 border-primary text-primary" : "bg-input border-border text-muted-foreground hover:border-primary/50"}`}>
                    {cr}
                  </button>
                ))}
              </div>
            </div>

            {/* 교육 희망 운동 종류 (준비중·1년미만·1~3년) */}
            {EARLY_CAREER_RANGES.has(ext.careerRange) && (
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">어떤 운동 분야 교육이 필요하신가요? <span className="text-primary font-medium">(복수 선택 가능)</span></Label>
                <div className="grid grid-cols-2 gap-2">
                  {EDUCATION_NEEDS.map(item => {
                    const selected = ext.educationNeeds.split(",").map(s => s.trim()).filter(Boolean);
                    const isOn = selected.includes(item);
                    return (
                      <button key={item} type="button"
                        onClick={() => {
                          const arr = ext.educationNeeds.split(",").map(s => s.trim()).filter(Boolean);
                          const next = isOn ? arr.filter(x => x !== item) : [...arr, item];
                          setExt(p => ({ ...p, educationNeeds: next.join(", ") }));
                        }}
                        className={`py-2 px-3 rounded-lg border text-xs font-medium text-left transition-colors ${isOn ? "bg-primary/20 border-primary text-primary" : "bg-input border-border text-muted-foreground hover:border-primary/50"}`}>
                        {item}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 활동지역 */}
            <div className="space-y-1">
              <Label className="text-sm text-muted-foreground">활동지역</Label>
              <Input
                value={ext.activityArea}
                onChange={e => setExt(p => ({ ...p, activityArea: e.target.value }))}
                placeholder="예: 서울 강남구, 서초구"
                className="bg-input border-border"
              />
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
