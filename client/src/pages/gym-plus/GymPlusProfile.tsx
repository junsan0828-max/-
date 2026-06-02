import { useState, useRef, useEffect, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader } from "@/components/ui/dialog";
import { toast } from "sonner";

const PERIOD_PRICES: Record<string, number> = {
  "1개월": 80000,
  "3개월": 159000,
  "6개월": 216000,
  "12개월": 312000,
};

const membershipTypeLabel: Record<string, string> = {
  general: "일반회원",
  premium: "프리미엄",
  vip: "VIP",
};

const membershipTypeBadge: Record<string, string> = {
  general: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  premium: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
  vip: "bg-purple-500/10 text-purple-400 border-purple-500/30",
};

const GOAL_OPTIONS = ["선택 안함", "체중감량", "근력증가", "다이어트", "체형교정", "건강관리", "재활/부상회복", "스포츠퍼포먼스", "스트레스해소", "기타"];

const BODY_PARTS = [
  "목관절", "흉추", "요추", "골반/천골",
  "어깨(RT)", "어깨(LT)", "팔꿈치(RT)", "팔꿈치(LT)",
  "손목/손(RT)", "손목/손(LT)", "고관절(RT)", "고관절(LT)",
  "무릎(RT)", "무릎(LT)",
];

const POSTURE_ROWS_FRONT = [
  "목", "어깨", "쇄골/흉골", "흉부", "상완(팔)",
  "전완/팔꿈치", "손목/손", "복부(상)", "복부(하)/요추",
  "골반", "고관절", "허벅지", "무릎", "발목/발",
];

const POSTURE_ROWS_BACK = [
  "후두부/목", "어깨/승모", "흉추(상)", "흉추(하)/견갑", "상완(팔)",
  "전완/팔꿈치", "손목/손", "등(상)", "등(하)/요추",
  "골반/천골", "고관절", "허벅지(후)", "무릎(후)/종아리", "발목/발",
];

const DIAGNOSES = ["해당없음", "대사증후군", "고혈압", "당뇨", "당뇨병2형", "고지혈증", "비만", "골다공증", "근감소증"];

const LIFESTYLE = {
  diet: ["A. 식사불규칙", "B. 단백질부족", "C. 폭식/과식", "D. 야식"],
  drinking: ["A. 주3회이상", "B. 과음", "C. 스트레스음주", "D. 회식컨디션저하"],
  sleep: ["A. 자주깸", "B. 피로", "C. 잠드는데30분이상", "D. 6시간미만"],
  activity: ["A. 5000보미만", "B. 앉아있는시간6시간이상", "C. 주2회미만운동", "D. 기본활동숨참"],
};

type ParqData = {
  birthYear: string; birthMonth: string; birthDay: string;
  height: string; weight: string;
  occupation: string; workEnvironment: string; exerciseExperience: string;
  goal1: string; goal2: string; goal3: string;
  dietHabits: string[]; drinkingHabits: string[]; sleepHabits: string[]; activityHabits: string[];
  diagnoses: string[];
  systolicBP: string; diastolicBP: string; waistCircumference: string;
  totalCholesterol: string; hdl: string; ldl: string; triglycerides: string;
  fastingGlucose: string; postMealGlucose: string; hba1c: string; boneDensity: string;
  imbalanceAreas: string[]; acuteInjuryAreas: string[]; chronicPainAreas: string[];
  postureFrontRT: string[]; postureFrontLT: string[];
  postureBackRT: string[]; postureBackLT: string[];
};

const defaultParqData: ParqData = {
  birthYear: "", birthMonth: "", birthDay: "", height: "", weight: "",
  occupation: "", workEnvironment: "", exerciseExperience: "",
  goal1: "선택 안함", goal2: "선택 안함", goal3: "선택 안함",
  dietHabits: [], drinkingHabits: [], sleepHabits: [], activityHabits: [],
  diagnoses: [],
  systolicBP: "", diastolicBP: "", waistCircumference: "",
  totalCholesterol: "", hdl: "", ldl: "", triglycerides: "",
  fastingGlucose: "", postMealGlucose: "", hba1c: "", boneDensity: "",
  imbalanceAreas: [], acuteInjuryAreas: [], chronicPainAreas: [],
  postureFrontRT: [], postureFrontLT: [],
  postureBackRT: [], postureBackLT: [],
};

function toggleArr(arr: string[], item: string): string[] {
  return arr.includes(item) ? arr.filter(i => i !== item) : [...arr, item];
}

function daysUntil(dateStr: string | null | undefined) {
  if (!dateStr) return null;
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
}

function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return "-";
  return dateStr.slice(0, 10).replace(/-/g, ".");
}

function MissionCard({
  icon, title, description, done, locked, onPress,
}: {
  icon: string; title: string; description: string;
  done: boolean; locked?: boolean; onPress: () => void;
}) {
  return (
    <button
      onClick={onPress}
      disabled={locked}
      className={`w-full flex items-center gap-3 p-4 rounded-xl border text-left transition-colors ${
        done
          ? "border-green-500/40 bg-green-500/10"
          : locked
          ? "border-border/40 bg-muted/20 opacity-50 cursor-not-allowed"
          : "border-border bg-card hover:border-primary/50"
      }`}
    >
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0 ${done ? "bg-green-500/20" : "bg-muted"}`}>{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm">{title}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
      <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${done ? "bg-green-500/20 text-green-400" : "bg-muted text-muted-foreground"}`}>
        {done ? "완료" : "미완료"}
      </span>
    </button>
  );
}

function ToggleChip({ label, checked, onToggle }: { label: string; checked: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
        checked ? "border-primary/50 bg-primary/15 text-primary" : "border-border text-muted-foreground hover:border-primary/30"
      }`}
    >
      {label}
    </button>
  );
}

function SignaturePad({ onSign, signatureData }: { onSign: (data: string) => void; signatureData: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#1a1a2e";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, []);

  const getPos = (e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ("touches" in e) {
      const t = e.touches[0];
      return { x: (t.clientX - rect.left) * scaleX, y: (t.clientY - rect.top) * scaleY };
    }
    return { x: ((e as React.MouseEvent).clientX - rect.left) * scaleX, y: ((e as React.MouseEvent).clientY - rect.top) * scaleY };
  };

  const startDraw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    isDrawingRef.current = true;
    const ctx = canvas.getContext("2d")!;
    const { x, y } = getPos(e, canvas);
    ctx.beginPath();
    ctx.moveTo(x, y);
  }, []);

  const draw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (!isDrawingRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const { x, y } = getPos(e, canvas);
    ctx.lineTo(x, y);
    ctx.stroke();
  }, []);

  const endDraw = useCallback(() => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    const canvas = canvasRef.current;
    if (!canvas) return;
    onSign(canvas.toDataURL("image/png"));
  }, [onSign]);

  const clearPad = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    onSign("");
  };

  return (
    <div className="space-y-2">
      <div className="relative border-2 border-dashed border-border rounded-xl overflow-hidden bg-white">
        <canvas
          ref={canvasRef}
          width={600}
          height={200}
          className="w-full touch-none cursor-crosshair"
          style={{ display: "block" }}
          onMouseDown={startDraw}
          onMouseMove={draw}
          onMouseUp={endDraw}
          onMouseLeave={endDraw}
          onTouchStart={startDraw}
          onTouchMove={draw}
          onTouchEnd={endDraw}
        />
        {!signatureData && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="text-gray-300 text-sm">여기에 서명하세요</p>
          </div>
        )}
      </div>
      <div className="flex justify-between items-center">
        <p className="text-[10px] text-muted-foreground">손가락 또는 마우스로 서명해 주세요</p>
        <button type="button" onClick={clearPad} className="text-xs text-muted-foreground border border-border rounded-lg px-3 py-1 hover:border-red-500/50 hover:text-red-400 transition-colors">
          지우기
        </button>
      </div>
    </div>
  );
}

export default function GymPlusProfile() {
  const utils = trpc.useUtils();
  const { data: member } = trpc.gymPlus.memberMe.useQuery();
  const { data: health, refetch: refetchHealth } = trpc.gymPlus.getHealth.useQuery();

  const [profileForm, setProfileForm] = useState({ name: "", phone: "", email: "" });
  const [profileEditing, setProfileEditing] = useState(false);
  const [profileMsg, setProfileMsg] = useState("");

  const [pwForm, setPwForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [pwMsg, setPwMsg] = useState("");
  const [pwExpanded, setPwExpanded] = useState(false);

  // 미션 모달 상태
  const [showGymRules, setShowGymRules] = useState(false);
  const [gymRulesChecked, setGymRulesChecked] = useState(false);
  const [showAppGuide, setShowAppGuide] = useState(false);
  const [showParq, setShowParq] = useState(false);
  const [parqData, setParqData] = useState<ParqData>(defaultParqData);

  // 재등록 신청 모달
  const [showRenewal, setShowRenewal] = useState(false);
  const [renewalStep, setRenewalStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [signatureData, setSignatureData] = useState<string>("");
  const [renewalForm, setRenewalForm] = useState({
    requestedPeriod: "1개월",
    memberName: "",
    memberPhone: "",
    notes: "",
    agreedToTerms: false,
    agreedPrivacy: false,
    agreedMarketing: false,
    paymentMethod: "",
  });
  const [contractDate, setContractDate] = useState("");

  const requestRenewal = trpc.gymPlus.requestRenewal.useMutation({
    onSuccess: () => {
      utils.gymPlus.memberMe.invalidate();
      setRenewalStep(5);
    },
    onError: (e) => toast.error(e.message || "신청 실패"),
  });

  const upsertHealth = trpc.gymPlus.upsertHealth.useMutation({
    onSuccess: () => { refetchHealth(); },
  });

  const updateProfile = trpc.gymPlus.updateProfile.useMutation({
    onSuccess: () => {
      utils.gymPlus.memberMe.invalidate();
      setProfileEditing(false);
      setProfileMsg("정보가 저장되었습니다.");
      setTimeout(() => setProfileMsg(""), 3000);
    },
    onError: (e) => setProfileMsg(e.message || "저장 실패"),
  });

  const changePassword = trpc.gymPlus.changePassword.useMutation({
    onSuccess: () => {
      setPwForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setPwMsg("비밀번호가 변경되었습니다.");
      setPwExpanded(false);
      setTimeout(() => setPwMsg(""), 3000);
    },
    onError: (e) => setPwMsg(e.message || "변경 실패"),
  });

  const startEdit = () => {
    setProfileForm({ name: member?.name ?? "", phone: member?.phone ?? "", email: member?.email ?? "" });
    setProfileEditing(true);
    setProfileMsg("");
  };

  const submitProfile = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfile.mutate({ name: profileForm.name || undefined, phone: profileForm.phone || undefined, email: profileForm.email || undefined });
  };

  const submitPassword = (e: React.FormEvent) => {
    e.preventDefault();
    setPwMsg("");
    if (pwForm.newPassword !== pwForm.confirmPassword) { setPwMsg("새 비밀번호가 일치하지 않습니다."); return; }
    changePassword.mutate({ currentPassword: pwForm.currentPassword, newPassword: pwForm.newPassword });
  };

  function getRenewalBonus(days: number | null): { days: number; label: string; desc: string; color: string } {
    if (days === null) return { days: 0, label: "", desc: "", color: "" };
    if (days >= 30) return { days: 14, label: "2주 서비스 혜택", desc: "만료 1개월 전 등록 시", color: "text-green-400" };
    if (days >= 5) return { days: 7, label: "7일 서비스 혜택", desc: "만료 1개월 이내 등록 시", color: "text-blue-400" };
    if (days >= 0) return { days: 3, label: "3일 서비스 혜택", desc: "만료 5일 전 등록 시", color: "text-yellow-400" };
    return { days: 0, label: "", desc: "만료된 회원권", color: "text-red-400" };
  }

  const openRenewal = () => {
    setRenewalForm(p => ({
      ...p,
      memberName: member?.name ?? "",
      memberPhone: member?.phone ?? "",
      agreedToTerms: false,
      agreedPrivacy: false,
      agreedMarketing: false,
      paymentMethod: "",
    }));
    setContractDate(new Date().toLocaleDateString("ko-KR"));
    setSignatureData("");
    setRenewalStep(1);
    setShowRenewal(true);
  };

  const closeRenewal = () => {
    setShowRenewal(false);
    setRenewalStep(1);
    setSignatureData("");
  };

  const submitRenewal = () => {
    if (!signatureData) { toast.error("서명을 완료해 주세요."); return; }
    const bonus = getRenewalBonus(daysLeft);
    const notesWithPayment = [
      renewalForm.paymentMethod ? `결제방법: ${renewalForm.paymentMethod}` : "",
      renewalForm.notes,
    ].filter(Boolean).join("\n");
    requestRenewal.mutate({
      requestedPeriod: renewalForm.requestedPeriod,
      bonusDays: bonus.days,
      memberName: renewalForm.memberName || undefined,
      memberPhone: renewalForm.memberPhone || undefined,
      notes: notesWithPayment || undefined,
      agreedToTerms: 1,
      agreedPrivacy: 1,
      agreedMarketing: renewalForm.agreedMarketing ? 1 : 0,
      trainerName: "본인계약",
      contractDate,
      signatureData,
    });
  };

  const openContractPrint = () => {
    const p = new URLSearchParams({
      name: renewalForm.memberName,
      phone: renewalForm.memberPhone,
      date: contractDate,
      marketing: renewalForm.agreedMarketing ? "1" : "0",
    });
    window.open(`/contract-print?${p.toString()}`, "_blank");
  };

  const shareViaKakao = () => {
    const p = new URLSearchParams({
      name: renewalForm.memberName,
      phone: renewalForm.memberPhone,
      date: contractDate,
      marketing: renewalForm.agreedMarketing ? "1" : "0",
    });
    const url = `${window.location.origin}/contract-print?${p.toString()}`;
    if (navigator.share) {
      navigator.share({ title: `${renewalForm.memberName} 님 자이언트짐 재등록 계약서`, url }).catch(() => {});
    } else {
      window.open(url, "_blank");
    }
  };

  // 미션 핸들러
  const submitGymRules = () => {
    if (!gymRulesChecked) { toast.error("이용규정에 동의해 주세요."); return; }
    upsertHealth.mutate({ gymRulesAgreed: 1 }, {
      onSuccess: () => { setShowGymRules(false); toast.success("센터 이용규정 동의가 완료되었습니다."); },
    });
  };

  const submitAppGuide = () => {
    upsertHealth.mutate({ appGuideConfirmed: 1 }, {
      onSuccess: () => { setShowAppGuide(false); toast.success("이용방법 안내 확인이 완료되었습니다."); },
    });
  };

  const openParq = () => {
    if (health?.parqJson) {
      try { setParqData(JSON.parse(health.parqJson)); } catch { setParqData(defaultParqData); }
    } else {
      setParqData(defaultParqData);
    }
    setShowParq(true);
  };

  const submitParq = () => {
    upsertHealth.mutate({ parqJson: JSON.stringify(parqData) }, {
      onSuccess: () => { setShowParq(false); toast.success("PAR-Q 건강설문이 완료되었습니다."); },
    });
  };

  const setPD = (key: keyof ParqData, value: any) => setParqData(p => ({ ...p, [key]: value }));

  // 미션 완료 여부
  const mission1Done = !!(health?.gymRulesAgreed);
  const mission2Done = !!(health?.appGuideConfirmed);
  const mission3Done = !!(health?.parqJson);
  const allMissionsDone = mission1Done && mission2Done && mission3Done;

  const daysLeft = daysUntil(member?.membershipEnd);

  return (
    <div className="p-4 space-y-4">
      <h1 className="font-bold text-lg">내 정보</h1>

      {/* 회원권 카드 */}
      <div className="bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 rounded-2xl p-5 space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-muted-foreground text-xs">회원명</p>
            <p className="font-bold text-xl mt-0.5">{member?.name ?? "-"}</p>
          </div>
          {member?.membershipType && (
            <span className={`text-xs px-3 py-1 rounded-full border font-semibold ${membershipTypeBadge[member.membershipType] ?? ""}`}>
              {membershipTypeLabel[member.membershipType] ?? member.membershipType}
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-background/50 rounded-xl p-3">
            <p className="text-[10px] text-muted-foreground">회원권 시작</p>
            <p className="font-semibold text-sm mt-0.5">{formatDate(member?.membershipStart)}</p>
          </div>
          <div className="bg-background/50 rounded-xl p-3">
            <p className="text-[10px] text-muted-foreground">회원권 만료</p>
            <p className="font-semibold text-sm mt-0.5">{formatDate(member?.membershipEnd)}</p>
          </div>
        </div>
        {daysLeft !== null && (() => {
          const bonus = getRenewalBonus(daysLeft);
          return (
            <button
              onClick={openRenewal}
              className={`w-full rounded-xl p-3 text-center transition-colors hover:opacity-80 ${
                daysLeft <= 0 ? "bg-red-500/20 border border-red-500/30" :
                daysLeft <= 7 ? "bg-orange-500/20 border border-orange-500/30" :
                "bg-green-500/10 border border-green-500/20"
              }`}
            >
              <p className="text-xs text-muted-foreground">회원권 남은 기간</p>
              <p className={`font-black text-2xl mt-0.5 ${
                daysLeft <= 0 ? "text-red-400" : daysLeft <= 7 ? "text-orange-400" : "text-green-400"
              }`}>
                {daysLeft > 0 ? `D-${daysLeft}` : daysLeft === 0 ? "오늘 만료" : "만료됨"}
              </p>
              {bonus.days > 0 && (
                <div className="mt-2 pt-2 border-t border-white/10">
                  <p className={`text-xs font-semibold ${bonus.color}`}>🎁 지금 재등록하면 {bonus.label}!</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{bonus.desc} · 탭하여 재등록 신청</p>
                </div>
              )}
              {bonus.days === 0 && daysLeft <= 0 && (
                <p className="text-xs text-muted-foreground mt-1.5">탭하여 재등록 신청</p>
              )}
            </button>
          );
        })()}
      </div>

      {/* 추천 운동 활성화 미션 */}
      <div className="bg-card border border-border rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-sm">추천 운동 활성화 미션</h2>
            <p className="text-xs text-muted-foreground mt-0.5">3가지 미션을 완료하면 맞춤 추천 운동이 활성화됩니다</p>
          </div>
          <span className={`text-xs px-2 py-0.5 rounded-full ${allMissionsDone ? "bg-green-500/20 text-green-400" : "bg-muted text-muted-foreground"}`}>
            {[mission1Done, mission2Done, mission3Done].filter(Boolean).length}/3
          </span>
        </div>

        {allMissionsDone && (
          <div className="bg-green-500/10 border border-green-500/30 rounded-xl px-3 py-2 text-center">
            <p className="text-xs text-green-400 font-semibold">✅ 모든 미션 완료! 추천 운동이 활성화됩니다</p>
          </div>
        )}

        <div className="space-y-2">
          <MissionCard
            icon="📋"
            title="센터 이용규정 안내 동의"
            description={mission1Done ? "이용규정 동의 완료" : "자이언트짐+ 센터 이용규정을 확인하고 동의하세요"}
            done={mission1Done}
            onPress={() => setShowGymRules(true)}
          />
          <MissionCard
            icon="📱"
            title="자이언트짐+ 이용방법 안내 확인"
            description={mission2Done ? "이용방법 안내 확인 완료" : "앱 사용법 및 센터 이용 안내를 확인하세요"}
            done={mission2Done}
            onPress={() => setShowAppGuide(true)}
          />
          <MissionCard
            icon="🩺"
            title="PAR-Q 완료"
            description={mission3Done ? "사전 건강설문 완료" : "운동 시작 전 건강 상태를 알려주세요"}
            done={mission3Done}
            onPress={openParq}
          />
        </div>
      </div>

      {/* 회원정보 편집 */}
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-sm">회원 정보</h2>
          {!profileEditing && <button onClick={startEdit} className="text-xs text-primary">수정</button>}
        </div>
        {profileEditing ? (
          <form onSubmit={submitProfile} className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">이름</Label>
              <Input value={profileForm.name} onChange={(e) => setProfileForm((p) => ({ ...p, name: e.target.value }))} placeholder="이름" className="bg-input border-border h-9 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">연락처</Label>
              <Input value={profileForm.phone} onChange={(e) => setProfileForm((p) => ({ ...p, phone: e.target.value }))} placeholder="010-0000-0000" className="bg-input border-border h-9 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">이메일</Label>
              <Input value={profileForm.email} onChange={(e) => setProfileForm((p) => ({ ...p, email: e.target.value }))} placeholder="email@example.com" className="bg-input border-border h-9 text-sm" />
            </div>
            <div className="flex gap-2">
              <Button type="submit" size="sm" className="flex-1" disabled={updateProfile.isPending}>{updateProfile.isPending ? "저장 중..." : "저장"}</Button>
              <Button type="button" size="sm" variant="outline" className="flex-1" onClick={() => { setProfileEditing(false); setProfileMsg(""); }}>취소</Button>
            </div>
          </form>
        ) : (
          <div className="space-y-2">
            {[
              { label: "아이디", value: member?.username },
              { label: "이름", value: member?.name ?? "-" },
              { label: "연락처", value: member?.phone ?? "-" },
              { label: "이메일", value: member?.email ?? "-" },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
                <span className="text-xs text-muted-foreground">{item.label}</span>
                <span className="text-xs font-medium">{item.value}</span>
              </div>
            ))}
          </div>
        )}
        {profileMsg && <p className={`text-xs mt-2 ${profileMsg.includes("저장") ? "text-green-400" : "text-red-400"}`}>{profileMsg}</p>}
      </div>

      {/* 비밀번호 변경 */}
      <div className="bg-card border border-border rounded-xl p-4">
        <button className="w-full flex items-center justify-between" onClick={() => { setPwExpanded((v) => !v); setPwMsg(""); }}>
          <h2 className="font-semibold text-sm">비밀번호 변경</h2>
          <span className="text-xs text-muted-foreground">{pwExpanded ? "▲" : "▼"}</span>
        </button>
        {pwExpanded && (
          <form onSubmit={submitPassword} className="mt-3 space-y-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">현재 비밀번호</Label>
              <Input type="password" value={pwForm.currentPassword} onChange={(e) => setPwForm((p) => ({ ...p, currentPassword: e.target.value }))} placeholder="현재 비밀번호" className="bg-input border-border h-9 text-sm" autoComplete="current-password" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">새 비밀번호</Label>
              <Input type="password" value={pwForm.newPassword} onChange={(e) => setPwForm((p) => ({ ...p, newPassword: e.target.value }))} placeholder="6자 이상" className="bg-input border-border h-9 text-sm" autoComplete="new-password" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">새 비밀번호 확인</Label>
              <Input type="password" value={pwForm.confirmPassword} onChange={(e) => setPwForm((p) => ({ ...p, confirmPassword: e.target.value }))} placeholder="비밀번호 재입력" className="bg-input border-border h-9 text-sm" autoComplete="new-password" />
            </div>
            <Button type="submit" size="sm" className="w-full" disabled={changePassword.isPending}>{changePassword.isPending ? "변경 중..." : "비밀번호 변경"}</Button>
          </form>
        )}
        {pwMsg && <p className={`text-xs mt-2 ${pwMsg.includes("변경") ? "text-green-400" : "text-red-400"}`}>{pwMsg}</p>}
      </div>

      {/* 센터 이용규정 모달 */}
      {showGymRules && (
        <Dialog open onOpenChange={(o) => { if (!o) setShowGymRules(false); }}>
          <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <h2 className="font-bold text-base">📋 센터 이용규정 안내</h2>
              <p className="text-xs text-muted-foreground">아래 이용규정을 확인하고 동의해 주세요</p>
            </DialogHeader>
            <div className="space-y-4 pt-1">
              <div className="bg-muted/20 border border-border rounded-xl p-4 text-[11px] text-muted-foreground leading-relaxed space-y-3 max-h-72 overflow-y-auto">
                <div>
                  <p className="font-semibold text-foreground mb-1">제1조 (목적)</p>
                  <p>본 규정은 자이언트짐+(이하 "센터")이 제공하는 피트니스 서비스 이용에 관한 제반 사항을 규정함을 목적으로 합니다.</p>
                </div>
                <div>
                  <p className="font-semibold text-foreground mb-1">제2조 (회원의 의무)</p>
                  <p>① 회원은 센터의 시설 및 기구를 타인에게 피해가 가지 않도록 올바르게 사용하여야 합니다.</p>
                  <p>② 회원은 센터 내에서 타인을 방해하거나 불쾌감을 주는 행위를 해서는 안 됩니다.</p>
                  <p>③ 운동 후 사용한 기구는 반드시 제자리에 정리하여야 합니다.</p>
                  <p>④ 센터 내 음식물 반입은 허용되지 않으며, 음료는 개인 물병만 허용합니다.</p>
                  <p>⑤ 적절한 운동복을 착용하고 입장하여야 합니다.</p>
                </div>
                <div>
                  <p className="font-semibold text-foreground mb-1">제3조 (이용 시간 및 시설)</p>
                  <p>① 센터의 운영 시간은 별도 공지에 따릅니다.</p>
                  <p>② 회원은 운영 시간 내에만 센터를 이용할 수 있습니다.</p>
                  <p>③ 시설 이용 시 안전사고 예방을 위해 주의사항을 준수하여야 합니다.</p>
                </div>
                <div>
                  <p className="font-semibold text-foreground mb-1">제4조 (이용권 및 환불)</p>
                  <p>① 이용권은 계약 시작일로부터 효력이 발생합니다.</p>
                  <p>② 이용권의 환불은 관련 법령 및 센터 환불 규정에 따릅니다.</p>
                  <p>③ 개인 사정으로 인한 중도 해지 시 잔여 기간에 따라 환불이 이루어집니다.</p>
                  <p>④ 부상·질병 등 불가피한 사유가 있을 경우 이용 정지 신청이 가능합니다.</p>
                </div>
                <div>
                  <p className="font-semibold text-foreground mb-1">제5조 (자이언트짐+ 앱 이용)</p>
                  <p>① 회원은 자이언트짐+ 앱을 통해 트레이닝 일지 및 운동 기록을 관리할 수 있습니다.</p>
                  <p>② 앱 내 개인정보는 회원 본인만 열람 가능하며, 제3자에게 제공되지 않습니다.</p>
                  <p>③ 앱 이용 중 발생하는 기술적 문제는 센터 담당자에게 문의하여 주시기 바랍니다.</p>
                </div>
                <div>
                  <p className="font-semibold text-foreground mb-1">제6조 (면책 조항)</p>
                  <p>① 센터는 회원이 센터 내에서 발생한 사고에 대해 센터의 과실이 없는 경우 책임을 지지 않습니다.</p>
                  <p>② 개인 소지품 분실에 대해 센터는 책임을 지지 않습니다.</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setGymRulesChecked(v => !v)}
                className="flex items-center gap-3 w-full p-3 rounded-xl border border-border hover:border-primary/50 transition-colors"
              >
                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${gymRulesChecked ? "bg-primary border-primary" : "border-border"}`}>
                  {gymRulesChecked && <span className="text-[10px] text-primary-foreground font-bold">✓</span>}
                </div>
                <span className={`text-sm font-medium ${gymRulesChecked ? "text-foreground" : "text-muted-foreground"}`}>위 이용규정을 모두 읽었으며 동의합니다</span>
              </button>

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1 h-10" onClick={() => setShowGymRules(false)}>닫기</Button>
                <Button className="flex-1 h-10" disabled={!gymRulesChecked || upsertHealth.isPending} onClick={submitGymRules}>
                  {upsertHealth.isPending ? "처리 중..." : "동의 완료"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* 자이언트짐+ 이용방법 안내 모달 */}
      {showAppGuide && (
        <Dialog open onOpenChange={(o) => { if (!o) setShowAppGuide(false); }}>
          <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <h2 className="font-bold text-base">📱 자이언트짐+ 이용방법 안내</h2>
              <p className="text-xs text-muted-foreground">앱 사용법 및 센터 이용 방법을 확인해 주세요</p>
            </DialogHeader>
            <div className="space-y-4 pt-1">

              <div className="space-y-3">
                {[
                  {
                    icon: "🏋️",
                    title: "트레이닝 일지 확인",
                    desc: "트레이너가 전송한 운동 프로그램을 '운동' 탭에서 확인하세요. 운동 시작 버튼을 눌러 실시간으로 세트/횟수/무게를 기록할 수 있습니다.",
                  },
                  {
                    icon: "▶️",
                    title: "운동 시작하기",
                    desc: "트레이닝 일지에서 '▶ 운동 시작' 버튼을 탭하면 운동 타이머와 세트 기록 화면이 열립니다. 각 세트 완료 후 체크하고 운동을 기록하세요.",
                  },
                  {
                    icon: "📊",
                    title: "운동 기록 관리",
                    desc: "완료된 운동은 자동으로 기록되며, 날짜별로 이력을 확인할 수 있습니다. 체중·컨디션·수면 정보도 함께 기록해 보세요.",
                  },
                  {
                    icon: "🎯",
                    title: "추천 운동 활성화",
                    desc: "3가지 미션(이용규정 동의, 이용방법 확인, PAR-Q)을 완료하면 맞춤형 추천 운동이 활성화됩니다.",
                  },
                  {
                    icon: "🔔",
                    title: "센터 출입 확인",
                    desc: "센터 방문 시 QR코드 또는 앱을 통해 출입을 확인할 수 있습니다.",
                  },
                  {
                    icon: "📅",
                    title: "회원권 재등록",
                    desc: "'내 정보' 탭에서 회원권 만료일을 확인하고 온라인으로 재등록 신청을 할 수 있습니다. 만료 전 재등록 시 추가 혜택이 있습니다.",
                  },
                ].map(item => (
                  <div key={item.title} className="flex gap-3 p-3 rounded-xl bg-muted/20 border border-border">
                    <span className="text-xl flex-shrink-0">{item.icon}</span>
                    <div>
                      <p className="text-sm font-semibold">{item.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="bg-primary/10 border border-primary/20 rounded-xl p-3">
                <p className="text-xs text-primary font-semibold">💡 문의 및 도움말</p>
                <p className="text-xs text-muted-foreground mt-0.5">앱 사용 중 궁금한 점은 센터 담당 트레이너에게 문의해 주세요.</p>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1 h-10" onClick={() => setShowAppGuide(false)}>닫기</Button>
                <Button className="flex-1 h-10" disabled={upsertHealth.isPending} onClick={submitAppGuide}>
                  {upsertHealth.isPending ? "처리 중..." : "확인 완료"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* PAR-Q 건강설문 모달 */}
      {showParq && (
        <Dialog open onOpenChange={(o) => { if (!o) setShowParq(false); }}>
          <DialogContent className="max-w-sm max-h-[92vh] overflow-y-auto">
            <DialogHeader>
              <h2 className="font-bold text-base">🩺 PAR-Q 건강설문</h2>
              <p className="text-xs text-muted-foreground">운동 시작 전 건강 상태를 알려주세요. 더 안전하고 효과적인 운동 계획 수립에 활용됩니다.</p>
            </DialogHeader>

            <div className="space-y-5 pt-1">

              {/* 기본 정보 */}
              <div className="space-y-3">
                <p className="text-sm font-semibold border-b border-border pb-1.5">기본 정보</p>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">생년월일</Label>
                  <div className="grid grid-cols-3 gap-2">
                    <select
                      value={parqData.birthYear}
                      onChange={e => setPD("birthYear", e.target.value)}
                      className="bg-input border border-border rounded-lg px-2 py-2 text-xs"
                    >
                      <option value="">년도</option>
                      {Array.from({ length: 80 }, (_, i) => 2010 - i).map(y => (
                        <option key={y} value={String(y)}>{y}년</option>
                      ))}
                    </select>
                    <select
                      value={parqData.birthMonth}
                      onChange={e => setPD("birthMonth", e.target.value)}
                      className="bg-input border border-border rounded-lg px-2 py-2 text-xs"
                    >
                      <option value="">월</option>
                      {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                        <option key={m} value={String(m)}>{m}월</option>
                      ))}
                    </select>
                    <select
                      value={parqData.birthDay}
                      onChange={e => setPD("birthDay", e.target.value)}
                      className="bg-input border border-border rounded-lg px-2 py-2 text-xs"
                    >
                      <option value="">일</option>
                      {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                        <option key={d} value={String(d)}>{d}일</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">키 (cm)</Label>
                    <select
                      value={parqData.height}
                      onChange={e => setPD("height", e.target.value)}
                      className="w-full bg-input border border-border rounded-lg px-2 py-2 text-xs"
                    >
                      <option value="">선택</option>
                      {Array.from({ length: 121 }, (_, i) => i + 100).map(h => (
                        <option key={h} value={String(h)}>{h}cm</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">체중 (kg)</Label>
                    <select
                      value={parqData.weight}
                      onChange={e => setPD("weight", e.target.value)}
                      className="w-full bg-input border border-border rounded-lg px-2 py-2 text-xs"
                    >
                      <option value="">선택</option>
                      {Array.from({ length: 121 }, (_, i) => i + 30).map(w => (
                        <option key={w} value={String(w)}>{w}kg</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* 생활 정보 */}
              <div className="space-y-3">
                <p className="text-sm font-semibold border-b border-border pb-1.5">생활 정보</p>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">직업</Label>
                  <Input value={parqData.occupation} onChange={e => setPD("occupation", e.target.value)} placeholder="예: 회사원, 학생, 자영업" className="bg-input border-border h-9 text-sm" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">근무환경</Label>
                  <Input value={parqData.workEnvironment} onChange={e => setPD("workEnvironment", e.target.value)} placeholder="예: 사무직, 현장직, 재택" className="bg-input border-border h-9 text-sm" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">운동경험</Label>
                  <Input value={parqData.exerciseExperience} onChange={e => setPD("exerciseExperience", e.target.value)} placeholder="예: 헬스 1년, 처음, 수영 경험 있음" className="bg-input border-border h-9 text-sm" />
                </div>
              </div>

              {/* 운동 목적 */}
              <div className="space-y-3">
                <p className="text-sm font-semibold border-b border-border pb-1.5">운동 목적</p>
                {(["goal1", "goal2", "goal3"] as const).map((key, i) => (
                  <div key={key} className="space-y-1">
                    <Label className="text-xs text-muted-foreground">목적 {i + 1}</Label>
                    <select
                      value={parqData[key]}
                      onChange={e => setPD(key, e.target.value)}
                      className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm"
                    >
                      {GOAL_OPTIONS.map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                  </div>
                ))}
              </div>

              {/* 생활 습관 */}
              <div className="space-y-3">
                <p className="text-sm font-semibold border-b border-border pb-1.5">생활 습관 <span className="text-xs text-muted-foreground font-normal">(해당 항목 모두 선택)</span></p>
                {([
                  { key: "dietHabits" as const, label: "식단", items: LIFESTYLE.diet },
                  { key: "drinkingHabits" as const, label: "음주", items: LIFESTYLE.drinking },
                  { key: "sleepHabits" as const, label: "수면", items: LIFESTYLE.sleep },
                  { key: "activityHabits" as const, label: "활동", items: LIFESTYLE.activity },
                ]).map(({ key, label, items }) => (
                  <div key={key} className="space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground">{label}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {items.map(item => (
                        <ToggleChip
                          key={item}
                          label={item}
                          checked={(parqData[key] as string[]).includes(item)}
                          onToggle={() => setPD(key, toggleArr(parqData[key] as string[], item))}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* 병원 진단 */}
              <div className="space-y-3">
                <p className="text-sm font-semibold border-b border-border pb-1.5">병원 진단 <span className="text-xs text-muted-foreground font-normal">(해당 항목 선택)</span></p>
                <div className="flex flex-wrap gap-1.5">
                  {DIAGNOSES.map(d => (
                    <ToggleChip
                      key={d}
                      label={d}
                      checked={parqData.diagnoses.includes(d)}
                      onToggle={() => setPD("diagnoses", toggleArr(parqData.diagnoses, d))}
                    />
                  ))}
                </div>
              </div>

              {/* 질환 정보 */}
              <div className="space-y-3">
                <p className="text-sm font-semibold border-b border-border pb-1.5">질환 정보 <span className="text-xs text-muted-foreground font-normal">(수치 또는 이상없음 선택)</span></p>
                {([
                  { key: "systolicBP" as const, label: "수축기혈압", unit: "mmHg" },
                  { key: "diastolicBP" as const, label: "이완기혈압", unit: "mmHg" },
                  { key: "waistCircumference" as const, label: "허리둘레", unit: "cm" },
                  { key: "totalCholesterol" as const, label: "총콜레스테롤", unit: "mg/dL" },
                  { key: "hdl" as const, label: "HDL콜레스테롤", unit: "mg/dL" },
                  { key: "ldl" as const, label: "LDL콜레스테롤", unit: "mg/dL" },
                  { key: "triglycerides" as const, label: "중성지방", unit: "mg/dL" },
                  { key: "fastingGlucose" as const, label: "공복혈당", unit: "mg/dL" },
                  { key: "postMealGlucose" as const, label: "식후2h혈당", unit: "mg/dL" },
                  { key: "hba1c" as const, label: "HbA1c", unit: "%" },
                  { key: "boneDensity" as const, label: "골밀도 T-score", unit: "" },
                ]).map(({ key, label, unit }) => (
                  <div key={key} className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground w-28 flex-shrink-0">{label}</Label>
                    <Input
                      value={parqData[key] === "이상없음" ? "" : parqData[key]}
                      onChange={e => setPD(key, e.target.value)}
                      disabled={parqData[key] === "이상없음"}
                      placeholder={unit}
                      className="bg-input border-border h-8 text-xs flex-1"
                    />
                    <button
                      type="button"
                      onClick={() => setPD(key, parqData[key] === "이상없음" ? "" : "이상없음")}
                      className={`px-2 py-1 rounded-lg border text-[10px] font-medium flex-shrink-0 transition-colors ${
                        parqData[key] === "이상없음" ? "border-green-500/50 bg-green-500/15 text-green-400" : "border-border text-muted-foreground"
                      }`}
                    >
                      이상없음
                    </button>
                  </div>
                ))}
              </div>

              {/* 근골격계 */}
              <div className="space-y-3">
                <p className="text-sm font-semibold border-b border-border pb-1.5">근골격계 <span className="text-xs text-muted-foreground font-normal">(해당 부위 선택)</span></p>
                {([
                  { key: "imbalanceAreas" as const, label: "불균형 부위" },
                  { key: "acuteInjuryAreas" as const, label: "급성통증/외상 부위" },
                  { key: "chronicPainAreas" as const, label: "만성통증 부위" },
                ]).map(({ key, label }) => (
                  <div key={key} className="space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground">{label}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {BODY_PARTS.map(part => (
                        <ToggleChip
                          key={part}
                          label={part}
                          checked={(parqData[key] as string[]).includes(part)}
                          onToggle={() => setPD(key, toggleArr(parqData[key] as string[], part))}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* 체형 문제 - 전면 */}
              <div className="space-y-2">
                <p className="text-sm font-semibold border-b border-border pb-1.5">체형 문제 - 전면</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr>
                        <th className="text-left text-muted-foreground font-medium py-1 pr-2 w-28">부위</th>
                        <th className="text-center text-muted-foreground font-medium py-1 px-2">RT</th>
                        <th className="text-center text-muted-foreground font-medium py-1 px-2">LT</th>
                      </tr>
                    </thead>
                    <tbody>
                      {POSTURE_ROWS_FRONT.map(row => (
                        <tr key={row} className="border-t border-border/30">
                          <td className="py-1.5 pr-2 text-muted-foreground">{row}</td>
                          <td className="py-1.5 px-2 text-center">
                            <button
                              type="button"
                              onClick={() => setPD("postureFrontRT", toggleArr(parqData.postureFrontRT, row))}
                              className={`w-6 h-6 rounded border-2 flex items-center justify-center mx-auto transition-colors ${
                                parqData.postureFrontRT.includes(row) ? "bg-primary border-primary" : "border-border"
                              }`}
                            >
                              {parqData.postureFrontRT.includes(row) && <span className="text-[9px] text-primary-foreground font-bold">✓</span>}
                            </button>
                          </td>
                          <td className="py-1.5 px-2 text-center">
                            <button
                              type="button"
                              onClick={() => setPD("postureFrontLT", toggleArr(parqData.postureFrontLT, row))}
                              className={`w-6 h-6 rounded border-2 flex items-center justify-center mx-auto transition-colors ${
                                parqData.postureFrontLT.includes(row) ? "bg-primary border-primary" : "border-border"
                              }`}
                            >
                              {parqData.postureFrontLT.includes(row) && <span className="text-[9px] text-primary-foreground font-bold">✓</span>}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 체형 문제 - 후면 */}
              <div className="space-y-2">
                <p className="text-sm font-semibold border-b border-border pb-1.5">체형 문제 - 후면</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr>
                        <th className="text-left text-muted-foreground font-medium py-1 pr-2 w-28">부위</th>
                        <th className="text-center text-muted-foreground font-medium py-1 px-2">RT</th>
                        <th className="text-center text-muted-foreground font-medium py-1 px-2">LT</th>
                      </tr>
                    </thead>
                    <tbody>
                      {POSTURE_ROWS_BACK.map(row => (
                        <tr key={row} className="border-t border-border/30">
                          <td className="py-1.5 pr-2 text-muted-foreground">{row}</td>
                          <td className="py-1.5 px-2 text-center">
                            <button
                              type="button"
                              onClick={() => setPD("postureBackRT", toggleArr(parqData.postureBackRT, row))}
                              className={`w-6 h-6 rounded border-2 flex items-center justify-center mx-auto transition-colors ${
                                parqData.postureBackRT.includes(row) ? "bg-primary border-primary" : "border-border"
                              }`}
                            >
                              {parqData.postureBackRT.includes(row) && <span className="text-[9px] text-primary-foreground font-bold">✓</span>}
                            </button>
                          </td>
                          <td className="py-1.5 px-2 text-center">
                            <button
                              type="button"
                              onClick={() => setPD("postureBackLT", toggleArr(parqData.postureBackLT, row))}
                              className={`w-6 h-6 rounded border-2 flex items-center justify-center mx-auto transition-colors ${
                                parqData.postureBackLT.includes(row) ? "bg-primary border-primary" : "border-border"
                              }`}
                            >
                              {parqData.postureBackLT.includes(row) && <span className="text-[9px] text-primary-foreground font-bold">✓</span>}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex gap-2 pt-1 pb-2">
                <Button variant="outline" className="flex-1 h-10" onClick={() => setShowParq(false)}>취소</Button>
                <Button className="flex-1 h-10" onClick={submitParq} disabled={upsertHealth.isPending}>
                  {upsertHealth.isPending ? "저장 중..." : "PAR-Q 제출"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* 회원권 재등록 신청 모달 (5단계) */}
      {showRenewal && (() => {
        const bonus = getRenewalBonus(daysLeft);
        const allRequired = renewalForm.agreedToTerms && renewalForm.agreedPrivacy;
        return (
          <Dialog open onOpenChange={(o) => { if (!o) closeRenewal(); }}>
            <DialogContent className="max-w-sm max-h-[92vh] overflow-y-auto">

              {/* 단계 1: 기본 정보 */}
              {renewalStep === 1 && (
                <>
                  <DialogHeader>
                    <h2 className="font-bold text-base">📋 재등록 신청</h2>
                    <p className="text-xs text-muted-foreground">아래 내용을 확인하고 재등록을 신청하세요</p>
                  </DialogHeader>
                  <div className="space-y-4 pt-1">
                    <div className="bg-muted/30 rounded-xl p-3 space-y-1.5 text-xs">
                      <div className="flex justify-between"><span className="text-muted-foreground">회원명</span><span className="font-medium">{member?.name}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">현재 만료일</span><span className="font-medium">{formatDate(member?.membershipEnd)}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">남은 기간</span><span className={`font-bold ${daysLeft !== null && daysLeft <= 7 ? "text-orange-400" : "text-foreground"}`}>{daysLeft !== null ? (daysLeft > 0 ? `D-${daysLeft}` : "만료") : "-"}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">담당자</span><span className="font-medium">본인계약</span></div>
                    </div>

                    {bonus.days > 0 && (
                      <div className={`rounded-xl p-3 border ${bonus.color === "text-green-400" ? "bg-green-500/10 border-green-500/30" : bonus.color === "text-blue-400" ? "bg-blue-500/10 border-blue-500/30" : "bg-yellow-500/10 border-yellow-500/30"}`}>
                        <p className={`text-xs font-semibold ${bonus.color}`}>🎁 {bonus.label} 적용!</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{bonus.desc} — 재등록 기간에 {bonus.days}일이 추가됩니다</p>
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">재등록 기간 선택</Label>
                      <div className="grid grid-cols-2 gap-2">
                        {["1개월", "3개월", "6개월", "12개월"].map(p => (
                          <button key={p} type="button"
                            className={`py-2.5 rounded-xl border text-sm font-medium transition-colors flex flex-col items-center gap-0.5 ${renewalForm.requestedPeriod === p ? "bg-primary/20 border-primary text-primary" : "border-border text-muted-foreground"}`}
                            onClick={() => setRenewalForm(f => ({ ...f, requestedPeriod: p }))}
                          >
                            <span>{p}</span>
                            <span className="text-xs font-normal">{PERIOD_PRICES[p]?.toLocaleString()}원</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">이름</Label>
                      <Input value={renewalForm.memberName} onChange={(e) => setRenewalForm(f => ({ ...f, memberName: e.target.value }))} placeholder="이름" className="bg-input border-border h-9 text-sm" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">연락처</Label>
                      <Input value={renewalForm.memberPhone} onChange={(e) => setRenewalForm(f => ({ ...f, memberPhone: e.target.value }))} placeholder="010-0000-0000" className="bg-input border-border h-9 text-sm" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">특이사항 (선택)</Label>
                      <textarea
                        value={renewalForm.notes}
                        onChange={(e) => setRenewalForm(f => ({ ...f, notes: e.target.value }))}
                        placeholder="요청사항이나 특이사항을 입력하세요"
                        className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm resize-none h-16"
                      />
                    </div>

                    <div className="flex gap-2 pt-1">
                      <Button variant="outline" className="flex-1 h-9" onClick={closeRenewal}>취소</Button>
                      <Button className="flex-1 h-9" onClick={() => setRenewalStep(2)}>다음 →</Button>
                    </div>
                  </div>
                </>
              )}

              {/* 단계 2: 결제 방법 선택 */}
              {renewalStep === 2 && (
                <>
                  <DialogHeader>
                    <h2 className="font-bold text-base">💳 결제 방법 선택</h2>
                    <p className="text-xs text-muted-foreground">결제 금액 및 방법을 확인해 주세요</p>
                  </DialogHeader>
                  <div className="space-y-4 pt-1">
                    <div className="bg-primary/10 border border-primary/20 rounded-xl p-4 text-center">
                      <p className="text-xs text-muted-foreground mb-1">{renewalForm.requestedPeriod} 이용권</p>
                      <p className="text-2xl font-bold text-primary">{PERIOD_PRICES[renewalForm.requestedPeriod]?.toLocaleString()}원</p>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">결제 방법을 선택해 주세요</Label>

                      <button type="button"
                        onClick={() => setRenewalForm(f => ({ ...f, paymentMethod: "계좌이체" }))}
                        className={`w-full p-3 rounded-xl border text-left transition-colors ${renewalForm.paymentMethod === "계좌이체" ? "border-primary/50 bg-primary/10" : "border-border bg-card"}`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-xl">🏦</span>
                          <div className="flex-1">
                            <p className="text-sm font-semibold">계좌이체</p>
                            <p className="text-xs text-muted-foreground">카카오뱅크 3333-05-2664409</p>
                            <p className="text-xs text-muted-foreground">예금주: (자이언트짐)</p>
                          </div>
                          {renewalForm.paymentMethod === "계좌이체" && <span className="text-primary text-sm font-bold">✓</span>}
                        </div>
                      </button>

                      {renewalForm.paymentMethod === "계좌이체" && (
                        <button type="button"
                          onClick={() => { navigator.clipboard.writeText("333305266409"); toast.success("계좌번호가 복사되었습니다"); }}
                          className="w-full py-2 rounded-lg bg-yellow-400/20 border border-yellow-400/30 text-yellow-500 text-xs font-semibold"
                        >
                          📋 계좌번호 복사하기
                        </button>
                      )}

                      <button type="button"
                        onClick={() => setRenewalForm(f => ({ ...f, paymentMethod: "카드" }))}
                        className={`w-full p-3 rounded-xl border text-left transition-colors ${renewalForm.paymentMethod === "카드" ? "border-primary/50 bg-primary/10" : "border-border bg-card"}`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-xl">💳</span>
                          <div className="flex-1">
                            <p className="text-sm font-semibold">카드 결제</p>
                            <p className="text-xs text-muted-foreground">센터 방문 시 결제 가능합니다</p>
                          </div>
                          {renewalForm.paymentMethod === "카드" && <span className="text-primary text-sm font-bold">✓</span>}
                        </div>
                      </button>

                      <button type="button"
                        onClick={() => setRenewalForm(f => ({ ...f, paymentMethod: "지역화폐" }))}
                        className={`w-full p-3 rounded-xl border text-left transition-colors ${renewalForm.paymentMethod === "지역화폐" ? "border-primary/50 bg-primary/10" : "border-border bg-card"}`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-xl">🏪</span>
                          <div className="flex-1">
                            <p className="text-sm font-semibold">지역화폐</p>
                            <p className="text-xs text-muted-foreground">센터 방문 시 결제 가능합니다</p>
                          </div>
                          {renewalForm.paymentMethod === "지역화폐" && <span className="text-primary text-sm font-bold">✓</span>}
                        </div>
                      </button>
                    </div>

                    <div className="flex gap-2 pt-1">
                      <Button variant="outline" className="flex-1 h-9" onClick={() => setRenewalStep(1)}>← 이전</Button>
                      <Button className="flex-1 h-9" disabled={!renewalForm.paymentMethod} onClick={() => setRenewalStep(3)}>
                        다음 →
                      </Button>
                    </div>
                  </div>
                </>
              )}

              {/* 단계 3: 약관 동의 */}
              {renewalStep === 3 && (
                <>
                  <DialogHeader>
                    <h2 className="font-bold text-base">📄 약관 동의</h2>
                    <p className="text-xs text-muted-foreground">아래 약관을 읽고 동의해 주세요</p>
                  </DialogHeader>
                  <div className="space-y-4 pt-1">

                    <button
                      type="button"
                      className={`w-full flex items-center gap-2 p-3 rounded-xl border transition-colors ${allRequired && renewalForm.agreedMarketing ? "border-primary/50 bg-primary/5" : "border-border"}`}
                      onClick={() => {
                        const next = !(allRequired && renewalForm.agreedMarketing);
                        setRenewalForm(f => ({ ...f, agreedToTerms: next, agreedPrivacy: next, agreedMarketing: next }));
                      }}
                    >
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${allRequired && renewalForm.agreedMarketing ? "bg-primary border-primary" : "border-border"}`}>
                        {allRequired && renewalForm.agreedMarketing && <span className="text-[10px] text-primary-foreground font-bold">✓</span>}
                      </div>
                      <span className="text-sm font-semibold">전체 동의</span>
                    </button>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold">센터 이용약관 <span className="text-red-400">(필수)</span></span>
                      </div>
                      <div className="bg-muted/20 border border-border rounded-lg p-3 h-28 overflow-y-auto text-[10px] text-muted-foreground leading-relaxed whitespace-pre-wrap">{`제1조 (목적)\n본 약관은 자이언트짐(이하 "센터")이 제공하는 피트니스 서비스 이용에 관한 제반 사항을 규정함을 목적으로 합니다.\n\n제2조 (회원의 의무)\n① 회원은 센터의 시설 및 기구를 타인에게 피해가 가지 않도록 올바르게 사용하여야 합니다.\n② 회원은 센터 내에서 타인을 방해하거나 불쾌감을 주는 행위를 하여서는 안 됩니다.\n③ 운동 후 사용한 기구는 반드시 제자리에 정리하여야 합니다.\n④ 센터 내 음식물 반입은 허용되지 않으며, 음료는 개인 물병만 허용합니다.\n\n제3조 (이용 시간 및 시설)\n① 센터의 운영 시간은 별도 공지에 따릅니다.\n② 회원은 운영 시간 내에만 센터를 이용할 수 있습니다.\n\n제4조 (이용권 및 환불)\n① PT 이용권은 계약 시작일로부터 효력이 발생합니다.\n② 이용권의 환불은 관련 법령 및 센터 환불 규정에 따릅니다.\n③ 회원 개인 사정으로 인한 중도 해지 시 잔여 횟수에 따라 환불이 이루어집니다.\n④ 부상·질병 등 불가피한 사유가 있을 경우 이용 정지 신청이 가능합니다.\n\n제5조 (면책 조항)\n① 센터는 회원이 센터 내에서 발생한 사고에 대해 센터의 과실이 없는 경우 책임을 지지 않습니다.\n② 개인 소지품 분실에 대해 센터는 책임을 지지 않습니다.`}</div>
                      <button type="button" className="flex items-center gap-2 text-sm" onClick={() => setRenewalForm(f => ({ ...f, agreedToTerms: !f.agreedToTerms }))}>
                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${renewalForm.agreedToTerms ? "bg-primary border-primary" : "border-border"}`}>
                          {renewalForm.agreedToTerms && <span className="text-[10px] text-primary-foreground font-bold">✓</span>}
                        </div>
                        <span className={`text-xs ${renewalForm.agreedToTerms ? "text-foreground" : "text-muted-foreground"}`}>위 이용약관에 동의합니다 (필수)</span>
                      </button>
                    </div>

                    <div className="space-y-2">
                      <span className="text-xs font-semibold">개인정보 수집·이용 동의 <span className="text-red-400">(필수)</span></span>
                      <div className="bg-muted/20 border border-border rounded-lg p-3 h-28 overflow-y-auto text-[10px] text-muted-foreground leading-relaxed whitespace-pre-wrap">{`수집하는 개인정보 항목\n- 필수항목: 성명, 연락처, 성별, 생년월일\n- 선택항목: 이메일 주소, 건강 정보(운동 목적, 부상 이력 등)\n\n개인정보의 수집 및 이용 목적\n① 피트니스 서비스 제공 및 회원 관리\n② PT 프로그램 안내 및 일정 관리\n③ 결제 및 환불 처리\n④ 고객 상담 및 민원 처리\n⑤ 서비스 개선을 위한 통계 분석\n\n개인정보의 보유 및 이용 기간\n- 회원 탈퇴 시 또는 이용 목적 달성 후 즉시 파기\n- 단, 관련 법령에 따라 보존 의무가 있는 경우 해당 기간 보관\n\n개인정보의 제3자 제공\n- 원칙적으로 외부에 제공하지 않으며, 법령의 규정에 의한 경우 또는 이용자가 사전에 동의한 경우에 한해 제공합니다.\n\n귀하는 개인정보 제공에 동의하지 않을 권리가 있습니다.`}</div>
                      <button type="button" className="flex items-center gap-2 text-sm" onClick={() => setRenewalForm(f => ({ ...f, agreedPrivacy: !f.agreedPrivacy }))}>
                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${renewalForm.agreedPrivacy ? "bg-primary border-primary" : "border-border"}`}>
                          {renewalForm.agreedPrivacy && <span className="text-[10px] text-primary-foreground font-bold">✓</span>}
                        </div>
                        <span className={`text-xs ${renewalForm.agreedPrivacy ? "text-foreground" : "text-muted-foreground"}`}>개인정보 수집·이용에 동의합니다 (필수)</span>
                      </button>
                    </div>

                    <div className="space-y-2">
                      <span className="text-xs font-semibold">광고성 정보 수신 동의 <span className="text-muted-foreground">(선택)</span></span>
                      <div className="bg-muted/20 border border-border rounded-lg p-3 h-20 overflow-y-auto text-[10px] text-muted-foreground leading-relaxed whitespace-pre-wrap">{`이용 목적: 신규 프로그램 및 이벤트 안내, 할인 혜택 및 프로모션 정보 제공\n광고성 정보 발송 채널: 문자메시지(SMS/MMS), 카카오 알림톡, 이메일\n보유 및 이용 기간: 동의일로부터 회원 탈퇴 또는 수신 거부 시까지\n수신 거부 안내: 언제든지 센터에 수신 거부 의사를 표시할 수 있으며, 수신 거부 후에도 서비스 이용에는 제한이 없습니다.`}</div>
                      <button type="button" className="flex items-center gap-2 text-sm" onClick={() => setRenewalForm(f => ({ ...f, agreedMarketing: !f.agreedMarketing }))}>
                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${renewalForm.agreedMarketing ? "bg-primary border-primary" : "border-border"}`}>
                          {renewalForm.agreedMarketing && <span className="text-[10px] text-primary-foreground font-bold">✓</span>}
                        </div>
                        <span className={`text-xs ${renewalForm.agreedMarketing ? "text-foreground" : "text-muted-foreground"}`}>광고성 정보 수신에 동의합니다 (선택)</span>
                      </button>
                    </div>

                    <div className="flex gap-2 pt-1">
                      <Button variant="outline" className="flex-1 h-9" onClick={() => setRenewalStep(2)}>← 이전</Button>
                      <Button
                        className="flex-1 h-9"
                        disabled={!allRequired}
                        onClick={() => { if (allRequired) setRenewalStep(4); }}
                      >
                        다음 →
                      </Button>
                    </div>
                  </div>
                </>
              )}

              {/* 단계 4: 서명 */}
              {renewalStep === 4 && (
                <>
                  <DialogHeader>
                    <h2 className="font-bold text-base">✍️ 본인 서명</h2>
                    <p className="text-xs text-muted-foreground">아래 서명란에 손가락으로 서명해 주세요</p>
                  </DialogHeader>
                  <div className="space-y-4 pt-1">
                    <SignaturePad onSign={setSignatureData} signatureData={signatureData} />
                    <div className="flex gap-2 pt-1">
                      <Button variant="outline" className="flex-1 h-9" onClick={() => { setSignatureData(""); setRenewalStep(3); }}>← 이전</Button>
                      <Button
                        className="flex-1 h-9"
                        onClick={submitRenewal}
                        disabled={requestRenewal.isPending || !signatureData}
                      >
                        {requestRenewal.isPending ? "신청 중..." : "재등록 신청"}
                      </Button>
                    </div>
                  </div>
                </>
              )}

              {/* 단계 5: 완료 */}
              {renewalStep === 5 && (
                <>
                  <DialogHeader>
                    <h2 className="font-bold text-base">✅ 재등록 신청 완료</h2>
                  </DialogHeader>
                  <div className="space-y-4 pt-1">
                    <div className="bg-green-500/10 border border-green-500/30 rounded-2xl p-4 space-y-2 text-xs">
                      <p className="font-semibold text-green-400 text-sm">신청이 접수되었습니다</p>
                      <p className="text-muted-foreground">트레이너가 확인 후 최종 처리해 드립니다.</p>
                    </div>

                    <div className="bg-muted/30 rounded-xl p-3 space-y-1.5 text-xs">
                      <div className="flex justify-between"><span className="text-muted-foreground">회원명</span><span className="font-medium">{renewalForm.memberName}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">재등록 기간</span><span className="font-medium">{renewalForm.requestedPeriod}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">계약일</span><span className="font-medium">{contractDate}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">담당자</span><span className="font-medium">본인계약</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">마케팅 수신</span><span className={renewalForm.agreedMarketing ? "text-green-400 font-medium" : "text-muted-foreground"}>{renewalForm.agreedMarketing ? "동의" : "미동의"}</span></div>
                      {renewalForm.paymentMethod && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">결제 방법</span>
                          <span className="font-medium">{renewalForm.paymentMethod}</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">결제 금액</span>
                        <span className="font-bold text-primary">{PERIOD_PRICES[renewalForm.requestedPeriod]?.toLocaleString()}원</span>
                      </div>
                    </div>

                    {signatureData && (
                      <div className="space-y-1">
                        <p className="text-[10px] text-muted-foreground">서명</p>
                        <div className="border border-border rounded-xl p-2 bg-white">
                          <img src={signatureData} alt="서명" className="w-full h-16 object-contain" />
                        </div>
                      </div>
                    )}

                    <div className="space-y-2">
                      <button
                        type="button"
                        className="w-full py-3 rounded-xl border border-border bg-card text-sm font-medium flex items-center justify-center gap-2 hover:border-primary/50 transition-colors"
                        onClick={openContractPrint}
                      >
                        🖨️ 계약서 PDF 보기 / 인쇄
                      </button>
                      <button
                        type="button"
                        className="w-full py-3 rounded-xl bg-yellow-400 text-yellow-900 text-sm font-semibold flex items-center justify-center gap-2 hover:bg-yellow-300 transition-colors"
                        onClick={shareViaKakao}
                      >
                        💬 카카오톡으로 계약서 공유
                      </button>
                    </div>

                    <Button className="w-full h-9" onClick={closeRenewal}>확인</Button>
                  </div>
                </>
              )}

            </DialogContent>
          </Dialog>
        );
      })()}

    </div>
  );
}
