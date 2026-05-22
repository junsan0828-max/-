import { useState, useRef, useEffect, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader } from "@/components/ui/dialog";
import { toast } from "sonner";

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

const PARQ_QUESTIONS = [
  "의사로부터 심장 관련 질환이 있어 의사가 권고하는 신체 활동만 해야 한다는 말을 들은 적이 있습니까?",
  "신체 활동 시 가슴 통증을 느낀 적이 있습니까?",
  "지난 한 달 동안 신체 활동을 하지 않을 때 가슴 통증을 느낀 적이 있습니까?",
  "어지럼증으로 균형을 잃거나 의식을 잃은 적이 있습니까?",
  "신체 활동의 변화로 악화될 수 있는 뼈 또는 관절 문제가 있습니까?",
  "현재 혈압이나 심장 질환으로 약을 복용하고 있습니까?",
  "신체 활동을 하면 안 되는 다른 이유가 있습니까?",
];

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
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0 ${
        done ? "bg-green-500/20" : "bg-muted"
      }`}>{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm">{title}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
      <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${
        done ? "bg-green-500/20 text-green-400" : "bg-muted text-muted-foreground"
      }`}>{done ? "완료" : "미완료"}</span>
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
  const [showBodyInfo, setShowBodyInfo] = useState(false);
  const [showParq, setShowParq] = useState(false);
  const [showBodyAnalysis, setShowBodyAnalysis] = useState(false);

  // 재등록 신청 모달
  const [showRenewal, setShowRenewal] = useState(false);
  const [renewalStep, setRenewalStep] = useState<1 | 2 | 3 | 4>(1);
  const [signatureData, setSignatureData] = useState<string>("");
  const [renewalForm, setRenewalForm] = useState({
    requestedPeriod: "1개월",
    memberName: "",
    memberPhone: "",
    notes: "",
    agreedToTerms: false,
    agreedPrivacy: false,
    agreedMarketing: false,
  });
  const [contractDate, setContractDate] = useState("");

  // 신체정보 폼
  const [bodyForm, setBodyForm] = useState({ height: "", weight: "", birthYear: "", gender: "" });

  // PAR-Q 폼
  const [parqAnswers, setParqAnswers] = useState<Record<string, string>>({
    parq1: "", parq2: "", parq3: "", parq4: "", parq5: "", parq6: "", parq7: "",
  });

  const requestRenewal = trpc.gymPlus.requestRenewal.useMutation({
    onSuccess: () => {
      setRenewalStep(4);
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

  // 갱신 혜택 계산
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
    if (!signatureData) {
      toast.error("서명을 완료해 주세요.");
      return;
    }
    const bonus = getRenewalBonus(daysLeft);
    requestRenewal.mutate({
      requestedPeriod: renewalForm.requestedPeriod,
      bonusDays: bonus.days,
      memberName: renewalForm.memberName || undefined,
      memberPhone: renewalForm.memberPhone || undefined,
      notes: renewalForm.notes || undefined,
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

  // 신체정보 모달 열기
  const openBodyInfo = () => {
    setBodyForm({
      height: health?.height ?? "",
      weight: health?.weight ?? "",
      birthYear: health?.birthYear ?? "",
      gender: health?.gender ?? "",
    });
    setShowBodyInfo(true);
  };

  const submitBodyInfo = () => {
    if (!bodyForm.height || !bodyForm.weight) { toast.error("키와 몸무게는 필수 입력 항목입니다."); return; }
    upsertHealth.mutate(bodyForm, {
      onSuccess: () => { setShowBodyInfo(false); toast.success("신체정보가 저장되었습니다."); },
    });
  };

  // PAR-Q 모달 열기
  const openParq = () => {
    setParqAnswers({
      parq1: health?.parq1 ?? "",
      parq2: health?.parq2 ?? "",
      parq3: health?.parq3 ?? "",
      parq4: health?.parq4 ?? "",
      parq5: health?.parq5 ?? "",
      parq6: health?.parq6 ?? "",
      parq7: health?.parq7 ?? "",
    });
    setShowParq(true);
  };

  const submitParq = () => {
    const allAnswered = Object.values(parqAnswers).every(v => v === "예" || v === "아니오");
    if (!allAnswered) { toast.error("모든 항목에 답변해 주세요."); return; }
    upsertHealth.mutate({ ...parqAnswers, parqSubmittedAt: new Date().toISOString() }, {
      onSuccess: () => { setShowParq(false); toast.success("사전 건강검사가 저장되었습니다."); },
    });
  };

  const submitBodyAnalysis = () => {
    upsertHealth.mutate({ bodyAnalysisRequested: 1, bodyAnalysisRequestedAt: new Date().toISOString() }, {
      onSuccess: () => { setShowBodyAnalysis(false); toast.success("체형분석 신청이 완료되었습니다. 트레이너가 확인 후 연락드립니다."); },
    });
  };

  // 미션 완료 여부
  const mission1Done = !!(health?.height && health?.weight);
  const mission2Done = !!(health?.parqSubmittedAt);
  const mission3Done = !!(health?.bodyAnalysisRequested);
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

      {/* 미션 */}
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
            icon="📏"
            title="신체정보 입력"
            description={mission1Done ? `${health?.height}cm / ${health?.weight}kg` : "키, 몸무게, 출생연도, 성별 입력"}
            done={mission1Done}
            onPress={openBodyInfo}
          />
          <MissionCard
            icon="🩺"
            title="사전 건강검사 (PAR-Q)"
            description={mission2Done ? "건강검사 완료" : "운동 전 필수 건강 설문 7문항"}
            done={mission2Done}
            onPress={openParq}
          />
          <MissionCard
            icon="📊"
            title="체형분석 데이터 신청"
            description={mission3Done ? "신청 완료 — 트레이너 확인 중" : "트레이너에게 체형분석 데이터 신청"}
            done={mission3Done}
            onPress={() => !mission3Done && setShowBodyAnalysis(true)}
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

      {/* 신체정보 입력 모달 */}
      {showBodyInfo && (
        <Dialog open onOpenChange={(o) => { if (!o) setShowBodyInfo(false); }}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <h2 className="font-bold text-base">📏 신체정보 입력</h2>
              <p className="text-xs text-muted-foreground">맞춤 운동 추천을 위한 기본 정보입니다</p>
            </DialogHeader>
            <div className="space-y-3 pt-1">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">키 (cm) *</Label>
                  <Input value={bodyForm.height} onChange={(e) => setBodyForm(p => ({ ...p, height: e.target.value }))} placeholder="예: 175" type="number" className="bg-input border-border h-9 text-sm" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">몸무게 (kg) *</Label>
                  <Input value={bodyForm.weight} onChange={(e) => setBodyForm(p => ({ ...p, weight: e.target.value }))} placeholder="예: 70" type="number" className="bg-input border-border h-9 text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">출생연도</Label>
                  <Input value={bodyForm.birthYear} onChange={(e) => setBodyForm(p => ({ ...p, birthYear: e.target.value }))} placeholder="예: 1990" type="number" className="bg-input border-border h-9 text-sm" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">성별</Label>
                  <div className="flex gap-2 h-9 items-center">
                    {["남성", "여성"].map(g => (
                      <button key={g} type="button"
                        className={`flex-1 h-full rounded-lg border text-xs font-medium transition-colors ${bodyForm.gender === g ? "bg-primary/20 border-primary text-primary" : "border-border text-muted-foreground"}`}
                        onClick={() => setBodyForm(p => ({ ...p, gender: g }))}
                      >{g}</button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <Button variant="outline" className="flex-1 h-9" onClick={() => setShowBodyInfo(false)}>취소</Button>
                <Button className="flex-1 h-9" onClick={submitBodyInfo} disabled={upsertHealth.isPending}>저장</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* PAR-Q 모달 */}
      {showParq && (
        <Dialog open onOpenChange={(o) => { if (!o) setShowParq(false); }}>
          <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <h2 className="font-bold text-base">🩺 사전 건강검사 (PAR-Q)</h2>
              <p className="text-xs text-muted-foreground">운동 시작 전 필수 건강 확인 항목입니다. 각 질문에 예/아니오로 답해 주세요.</p>
            </DialogHeader>
            <div className="space-y-4 pt-1">
              {PARQ_QUESTIONS.map((q, i) => {
                const key = `parq${i + 1}` as keyof typeof parqAnswers;
                return (
                  <div key={i} className="space-y-2">
                    <p className="text-xs text-foreground leading-relaxed">{i + 1}. {q}</p>
                    <div className="flex gap-2">
                      {["예", "아니오"].map(ans => (
                        <button key={ans} type="button"
                          className={`flex-1 py-2 rounded-lg border text-xs font-medium transition-colors ${parqAnswers[key] === ans ? (ans === "예" ? "bg-red-500/20 border-red-500/40 text-red-400" : "bg-green-500/20 border-green-500/40 text-green-400") : "border-border text-muted-foreground"}`}
                          onClick={() => setParqAnswers(p => ({ ...p, [key]: ans }))}
                        >{ans}</button>
                      ))}
                    </div>
                  </div>
                );
              })}
              {Object.values(parqAnswers).some(v => v === "예") && (
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-3">
                  <p className="text-xs text-yellow-400">⚠️ '예'로 답한 항목이 있습니다. 운동 시작 전 의사와 상담을 권장합니다.</p>
                </div>
              )}
              <div className="flex gap-2 pt-1">
                <Button variant="outline" className="flex-1 h-9" onClick={() => setShowParq(false)}>취소</Button>
                <Button className="flex-1 h-9" onClick={submitParq} disabled={upsertHealth.isPending}>제출</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* 회원권 재등록 신청 모달 (4단계) */}
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
                    {/* 현재 회원권 정보 */}
                    <div className="bg-muted/30 rounded-xl p-3 space-y-1.5 text-xs">
                      <div className="flex justify-between"><span className="text-muted-foreground">회원명</span><span className="font-medium">{member?.name}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">현재 만료일</span><span className="font-medium">{formatDate(member?.membershipEnd)}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">남은 기간</span><span className={`font-bold ${daysLeft !== null && daysLeft <= 7 ? "text-orange-400" : "text-foreground"}`}>{daysLeft !== null ? (daysLeft > 0 ? `D-${daysLeft}` : "만료") : "-"}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">담당자</span><span className="font-medium">본인계약</span></div>
                    </div>

                    {/* 혜택 안내 */}
                    {bonus.days > 0 && (
                      <div className={`rounded-xl p-3 border ${bonus.color === "text-green-400" ? "bg-green-500/10 border-green-500/30" : bonus.color === "text-blue-400" ? "bg-blue-500/10 border-blue-500/30" : "bg-yellow-500/10 border-yellow-500/30"}`}>
                        <p className={`text-xs font-semibold ${bonus.color}`}>🎁 {bonus.label} 적용!</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{bonus.desc} — 재등록 기간에 {bonus.days}일이 추가됩니다</p>
                      </div>
                    )}

                    {/* 재등록 기간 선택 */}
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">재등록 기간 선택</Label>
                      <div className="grid grid-cols-2 gap-2">
                        {["1개월", "3개월", "6개월", "12개월"].map(p => (
                          <button key={p} type="button"
                            className={`py-2.5 rounded-xl border text-sm font-medium transition-colors ${renewalForm.requestedPeriod === p ? "bg-primary/20 border-primary text-primary" : "border-border text-muted-foreground"}`}
                            onClick={() => setRenewalForm(f => ({ ...f, requestedPeriod: p }))}
                          >{p}</button>
                        ))}
                      </div>
                    </div>

                    {/* 신청자 정보 */}
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

              {/* 단계 2: 약관 동의 */}
              {renewalStep === 2 && (
                <>
                  <DialogHeader>
                    <h2 className="font-bold text-base">📄 약관 동의</h2>
                    <p className="text-xs text-muted-foreground">아래 약관을 읽고 동의해 주세요</p>
                  </DialogHeader>
                  <div className="space-y-4 pt-1">

                    {/* 전체 동의 */}
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

                    {/* 약관 1: 센터 이용약관 */}
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

                    {/* 약관 2: 개인정보수집이용 */}
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

                    {/* 약관 3: 광고성 정보 수신 (선택) */}
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
                      <Button variant="outline" className="flex-1 h-9" onClick={() => setRenewalStep(1)}>← 이전</Button>
                      <Button
                        className="flex-1 h-9"
                        disabled={!allRequired}
                        onClick={() => { if (allRequired) setRenewalStep(3); }}
                      >
                        다음 →
                      </Button>
                    </div>
                  </div>
                </>
              )}

              {/* 단계 3: 서명 */}
              {renewalStep === 3 && (
                <>
                  <DialogHeader>
                    <h2 className="font-bold text-base">✍️ 본인 서명</h2>
                    <p className="text-xs text-muted-foreground">아래 서명란에 손가락으로 서명해 주세요</p>
                  </DialogHeader>
                  <div className="space-y-4 pt-1">
                    <SignaturePad onSign={setSignatureData} signatureData={signatureData} />
                    <div className="flex gap-2 pt-1">
                      <Button variant="outline" className="flex-1 h-9" onClick={() => { setSignatureData(""); setRenewalStep(2); }}>← 이전</Button>
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

              {/* 단계 4: 완료 */}
              {renewalStep === 4 && (
                <>
                  <DialogHeader>
                    <h2 className="font-bold text-base">✅ 재등록 신청 완료</h2>
                  </DialogHeader>
                  <div className="space-y-4 pt-1">
                    <div className="bg-green-500/10 border border-green-500/30 rounded-2xl p-4 space-y-2 text-xs">
                      <p className="font-semibold text-green-400 text-sm">신청이 접수되었습니다</p>
                      <p className="text-muted-foreground">트레이너가 확인 후 최종 처리해 드립니다.</p>
                    </div>

                    {/* 계약 요약 */}
                    <div className="bg-muted/30 rounded-xl p-3 space-y-1.5 text-xs">
                      <div className="flex justify-between"><span className="text-muted-foreground">회원명</span><span className="font-medium">{renewalForm.memberName}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">재등록 기간</span><span className="font-medium">{renewalForm.requestedPeriod}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">계약일</span><span className="font-medium">{contractDate}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">담당자</span><span className="font-medium">본인계약</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">마케팅 수신</span><span className={renewalForm.agreedMarketing ? "text-green-400 font-medium" : "text-muted-foreground"}>{renewalForm.agreedMarketing ? "동의" : "미동의"}</span></div>
                    </div>

                    {/* 서명 미리보기 */}
                    {signatureData && (
                      <div className="space-y-1">
                        <p className="text-[10px] text-muted-foreground">서명</p>
                        <div className="border border-border rounded-xl p-2 bg-white">
                          <img src={signatureData} alt="서명" className="w-full h-16 object-contain" />
                        </div>
                      </div>
                    )}

                    {/* 계약서 공유 버튼 */}
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

      {/* 체형분석 신청 모달 */}
      {showBodyAnalysis && (
        <Dialog open onOpenChange={(o) => { if (!o) setShowBodyAnalysis(false); }}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <h2 className="font-bold text-base">📊 체형분석 데이터 신청</h2>
            </DialogHeader>
            <div className="space-y-4 pt-1">
              <div className="bg-muted/30 rounded-xl p-4 space-y-2 text-sm text-muted-foreground">
                <p>• 트레이너가 직접 체형을 분석하고 데이터를 입력해 드립니다.</p>
                <p>• 신청 후 트레이너가 확인하여 연락드립니다.</p>
                <p>• 체형분석 완료 시 더 정확한 운동 추천이 가능합니다.</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1 h-9" onClick={() => setShowBodyAnalysis(false)}>취소</Button>
                <Button className="flex-1 h-9" onClick={submitBodyAnalysis} disabled={upsertHealth.isPending}>신청하기</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
