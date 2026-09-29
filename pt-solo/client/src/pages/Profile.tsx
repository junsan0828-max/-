import { useState, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { User, Lock, CheckCircle, Clock, XCircle, Briefcase, Camera, Share2, Copy, Check, Users, ClipboardList, Bell, BellOff, Send } from "lucide-react";


function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

function PushNotificationCard() {
  const utils = trpc.useUtils();
  const { data: vapid } = trpc.push.getVapidPublicKey.useQuery();
  const { data: status } = trpc.push.getStatus.useQuery();
  const [busy, setBusy] = useState(false);
  const supported = typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window;

  const subscribeMutation = trpc.push.subscribe.useMutation({
    onSuccess: () => { utils.push.getStatus.invalidate(); toast.success("알림이 켜졌습니다!"); },
    onError: (e) => toast.error(e.message),
  });
  const unsubscribeMutation = trpc.push.unsubscribe.useMutation({
    onSuccess: () => { utils.push.getStatus.invalidate(); toast.success("알림이 꺼졌습니다."); },
    onError: (e) => toast.error(e.message),
  });
  const testMutation = trpc.push.sendTest.useMutation({
    onSuccess: () => toast.success("테스트 알림을 보냈습니다. 잠시 후 확인해보세요."),
    onError: (e) => toast.error(e.message),
  });

  async function handleEnable() {
    if (!supported) { toast.error("이 브라우저/기기는 푸시 알림을 지원하지 않습니다."); return; }
    if (!vapid?.publicKey) { toast.error("알림 설정이 아직 준비되지 않았습니다. 잠시 후 다시 시도해주세요."); return; }
    if (Notification.permission === "denied") {
      toast.error("이 사이트의 알림이 브라우저에서 차단되어 있습니다. 주소창 왼쪽 자물쇠(사이트 정보) 아이콘 → 권한 → 알림을 '허용'으로 바꾼 뒤 다시 시도해주세요.", { duration: 8000 });
      return;
    }
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") { toast.error("알림 권한을 허용해야 알림을 받을 수 있어요."); return; }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapid.publicKey),
      });
      const json = sub.toJSON();
      subscribeMutation.mutate({
        endpoint: json.endpoint!,
        keys: { p256dh: json.keys!.p256dh!, auth: json.keys!.auth! },
      });
    } catch (e: any) {
      toast.error("알림 설정 중 오류가 발생했습니다: " + (e?.message ?? ""));
    } finally {
      setBusy(false);
    }
  }

  async function handleDisable() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        unsubscribeMutation.mutate({ endpoint: sub.endpoint });
        await sub.unsubscribe();
      } else {
        unsubscribeMutation.mutate({ endpoint: "" });
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="bg-card border-border">
      <CardContent className="p-5 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold flex items-center gap-2">
            {status?.subscribed ? <Bell className="h-4 w-4 text-primary" /> : <BellOff className="h-4 w-4 text-muted-foreground" />}
            푸시 알림
          </p>
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${status?.subscribed ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>
            {status?.subscribed ? "켜짐" : "꺼짐"}
          </span>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          만료임박·미수금 등 주요 알림을 이 기기로 바로 받아보세요. (테스트 중인 기능입니다)
        </p>
        <div className="flex gap-2">
          {status?.subscribed ? (
            <>
              <Button size="sm" variant="outline" className="flex-1" disabled={busy} onClick={handleDisable}>알림 끄기</Button>
              <Button size="sm" className="flex-1" disabled={busy || testMutation.isPending} onClick={() => testMutation.mutate()}>
                <Send className="h-3.5 w-3.5 mr-1" />테스트 발송
              </Button>
            </>
          ) : (
            <Button size="sm" className="flex-1" disabled={busy || !supported} onClick={handleEnable}>
              {busy ? "설정 중..." : "알림 켜기"}
            </Button>
          )}
        </div>
        {!supported && <p className="text-[10px] text-red-400">이 브라우저에서는 지원되지 않습니다. 홈 화면에 앱을 추가한 뒤 이용해주세요.</p>}
      </CardContent>
    </Card>
  );
}
import { toast } from "sonner";
import TabBanner from "@/components/TabBanner";
import OnboardingSurveyModal from "@/components/OnboardingSurveyModal";


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


export default function Profile() {
  const { data: profile, refetch } = trpc.trainers.getMyProfile.useQuery();
  const { data: referralInfo } = trpc.trainers.getMyReferralInfo.useQuery();
  const { data: authUser } = trpc.auth.me.useQuery();
  const utils = trpc.useUtils();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [info, setInfo] = useState({ trainerName: "", phone: "", email: "" });
  const [ext, setExt] = useState({ jobType: "", careerRange: "", activityArea: "", profileImage: "", educationNeeds: "" });
  const [journalType, setJournalTypeState] = useState<"weight" | "pilates">("weight");
  const [pw, setPw] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [infoMsg, setInfoMsg] = useState("");
  const [pwMsg, setPwMsg] = useState("");
  const [referralCopied, setReferralCopied] = useState(false);
  const [showSurveyModal, setShowSurveyModal] = useState(false);

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
      setJournalTypeState(((profile as any).journalType ?? "weight") as "weight" | "pilates");
    }
  }, [profile]);

  const updateProfile = trpc.trainers.updateMyProfile.useMutation({
    onSuccess: () => { setInfoMsg(""); toast.success("프로필이 수정되었습니다."); refetch(); },
    onError: (e) => setInfoMsg(e.message),
  });

  const updateExtended = trpc.trainers.updateExtendedProfile.useMutation({
    onSuccess: () => { toast.success("STEPER 정보가 저장되었습니다."); refetch(); },
    onError: (e) => toast.error(e.message),
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

  const handleExtSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!info.trainerName.trim()) { toast.error("이름을 입력해주세요."); return; }
    updateExtended.mutate({
      jobType: ext.jobType || undefined,
      careerRange: ext.careerRange || undefined,
      activityArea: ext.activityArea || undefined,
      profileImage: ext.profileImage || undefined,
      educationNeeds: ext.educationNeeds || undefined,
    });
    updateProfile.mutate({ trainerName: info.trainerName, phone: info.phone || undefined, email: info.email || undefined });
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

  return (
    <div className="space-y-6">
      <TabBanner tabKey="profile" />
      <div>
        <h1 className="text-xl font-bold">내 프로필</h1>
        <p className="text-sm text-muted-foreground mt-0.5">정보 수정</p>
      </div>

      <PushNotificationCard />

      {/* 친구 초대 */}
      {referralInfo?.referralCode && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Share2 className="h-4 w-4 text-primary" />친구 초대하기
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              초대 링크를 공유해 FIT STEP을 함께 사용해보세요.
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
                <p className="text-xl font-bold text-foreground">{referralInfo.totalInvited}</p>
                <p className="text-[10px] text-muted-foreground">명</p>
              </div>
              <div className="flex-1 rounded-xl bg-primary/10 border border-primary/20 p-3 text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <CheckCircle className="h-3.5 w-3.5 text-primary" />
                  <p className="text-xs text-muted-foreground">가입 승인</p>
                </div>
                <p className="text-xl font-bold text-primary">{referralInfo.approvedInvited}</p>
                <p className="text-[10px] text-muted-foreground">명</p>
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground/60 text-center">
              내 초대 코드: <span className="font-mono font-semibold">{referralInfo.referralCode}</span>
            </p>
          </CardContent>
        </Card>
      )}

      {/* 트레이너 상세 프로필 */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-primary" />STEPER 상세 정보
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

            {/* 이름 / 연락처 */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-sm text-muted-foreground">이름 *</Label>
                <Input
                  value={info.trainerName}
                  onChange={e => setInfo(p => ({ ...p, trainerName: e.target.value }))}
                  placeholder="실명 입력"
                  className="bg-input border-border"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-sm text-muted-foreground">연락처</Label>
                <Input
                  type="tel"
                  value={info.phone}
                  onChange={e => setInfo(p => ({ ...p, phone: e.target.value }))}
                  placeholder="010-0000-0000"
                  className="bg-input border-border"
                />
              </div>
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

      {/* 트레이닝 일지 유형 */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-primary" />트레이닝 일지 유형
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">선택한 유형에 따라 트레이닝 일지 입력 화면이 변경됩니다.</p>
          <div className="grid grid-cols-2 gap-2">
            {([
              { value: "weight", label: "웨이트 / PT", desc: "종목·세트·횟수·중량" },
              { value: "pilates", label: "필라테스", desc: "수업목적·기구·메모" },
            ] as const).map(({ value, label, desc }) => (
              <button
                key={value}
                type="button"
                onClick={() => {
                  setJournalTypeState(value);
                  updateExtended.mutate({ journalType: value });
                }}
                className={`flex flex-col items-start gap-1 p-3 rounded-xl border text-left transition-colors ${
                  journalType === value
                    ? "bg-primary/15 border-primary"
                    : "bg-card border-border hover:border-primary/40"
                }`}
              >
                <span className={`text-sm font-semibold ${journalType === value ? "text-primary" : "text-foreground"}`}>{label}</span>
                <span className="text-[12px] text-muted-foreground">{desc}</span>
              </button>
            ))}
          </div>
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

      {/* 성장 설문 */}
      <Card className="bg-card border-border">
        <CardContent className="pt-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <ClipboardList className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold">30초 성장 설문</p>
                <p className="text-xs text-muted-foreground">
                  {(profile as any)?.onboardingSurveyDone
                    ? "완료됨 · 다시 응답할 수 있습니다"
                    : "미완료"}
                </p>
              </div>
            </div>
            <Button size="sm" variant="outline" onClick={() => setShowSurveyModal(true)}>
              {(profile as any)?.onboardingSurveyDone ? "다시 하기" : "시작하기"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {showSurveyModal && (
        <OnboardingSurveyModal onClose={() => setShowSurveyModal(false)} />
      )}
    </div>
  );
}
