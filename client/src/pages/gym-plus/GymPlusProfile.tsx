import { useState } from "react";
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

  // 갱신 신청 모달
  const [showRenewal, setShowRenewal] = useState(false);
  const [renewalForm, setRenewalForm] = useState({
    requestedPeriod: "1개월",
    memberName: "",
    memberPhone: "",
    notes: "",
    agreedToTerms: false,
  });

  // 신체정보 폼
  const [bodyForm, setBodyForm] = useState({ height: "", weight: "", birthYear: "", gender: "" });

  // PAR-Q 폼
  const [parqAnswers, setParqAnswers] = useState<Record<string, string>>({
    parq1: "", parq2: "", parq3: "", parq4: "", parq5: "", parq6: "", parq7: "",
  });

  const requestRenewal = trpc.gymPlus.requestRenewal.useMutation({
    onSuccess: () => {
      setShowRenewal(false);
      setRenewalForm({ requestedPeriod: "1개월", memberName: "", memberPhone: "", notes: "", agreedToTerms: false });
      toast.success("갱신 신청이 완료되었습니다. 트레이너가 확인 후 연락드립니다.");
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
    setRenewalForm(p => ({ ...p, memberName: member?.name ?? "", memberPhone: member?.phone ?? "" }));
    setShowRenewal(true);
  };

  const submitRenewal = () => {
    if (!renewalForm.agreedToTerms) { toast.error("계약 내용에 동의해 주세요."); return; }
    const bonus = getRenewalBonus(daysLeft);
    requestRenewal.mutate({
      requestedPeriod: renewalForm.requestedPeriod,
      bonusDays: bonus.days,
      memberName: renewalForm.memberName || undefined,
      memberPhone: renewalForm.memberPhone || undefined,
      notes: renewalForm.notes || undefined,
      agreedToTerms: 1,
    });
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
                  <p className={`text-xs font-semibold ${bonus.color}`}>🎁 지금 갱신하면 {bonus.label}!</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{bonus.desc} · 탭하여 갱신 신청</p>
                </div>
              )}
              {bonus.days === 0 && daysLeft <= 0 && (
                <p className="text-xs text-muted-foreground mt-1.5">탭하여 갱신 신청</p>
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

      {/* 회원권 갱신 신청 모달 */}
      {showRenewal && (() => {
        const bonus = getRenewalBonus(daysLeft);
        return (
          <Dialog open onOpenChange={(o) => { if (!o) setShowRenewal(false); }}>
            <DialogContent className="max-w-sm max-h-[92vh] overflow-y-auto">
              <DialogHeader>
                <h2 className="font-bold text-base">📋 회원권 갱신 신청</h2>
                <p className="text-xs text-muted-foreground">아래 내용을 확인하고 갱신을 신청하세요</p>
              </DialogHeader>
              <div className="space-y-4 pt-1">

                {/* 현재 회원권 정보 */}
                <div className="bg-muted/30 rounded-xl p-3 space-y-1.5 text-xs">
                  <div className="flex justify-between"><span className="text-muted-foreground">회원명</span><span className="font-medium">{member?.name}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">현재 만료일</span><span className="font-medium">{formatDate(member?.membershipEnd)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">남은 기간</span><span className={`font-bold ${daysLeft !== null && daysLeft <= 7 ? "text-orange-400" : "text-foreground"}`}>{daysLeft !== null ? (daysLeft > 0 ? `D-${daysLeft}` : "만료") : "-"}</span></div>
                </div>

                {/* 혜택 안내 */}
                {bonus.days > 0 && (
                  <div className={`rounded-xl p-3 border ${bonus.color === "text-green-400" ? "bg-green-500/10 border-green-500/30" : bonus.color === "text-blue-400" ? "bg-blue-500/10 border-blue-500/30" : "bg-yellow-500/10 border-yellow-500/30"}`}>
                    <p className={`text-xs font-semibold ${bonus.color}`}>🎁 {bonus.label} 적용!</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{bonus.desc} — 갱신 기간에 {bonus.days}일이 추가됩니다</p>
                  </div>
                )}

                {/* 갱신 기간 선택 */}
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">갱신 기간 선택</Label>
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

                {/* 계약 동의 */}
                <div className="bg-muted/30 rounded-xl p-3 text-xs text-muted-foreground space-y-1.5 leading-relaxed">
                  <p className="font-semibold text-foreground">계약 내용 확인</p>
                  <p>• 선택한 기간({renewalForm.requestedPeriod})으로 회원권이 갱신됩니다.</p>
                  {bonus.days > 0 && <p>• 조기 갱신 혜택으로 {bonus.days}일이 추가 제공됩니다.</p>}
                  <p>• 갱신 신청 후 트레이너 확인을 거쳐 최종 처리됩니다.</p>
                  <p>• 결제는 센터에서 별도로 진행됩니다.</p>
                </div>
                <button
                  type="button"
                  className="flex items-center gap-2 text-sm"
                  onClick={() => setRenewalForm(f => ({ ...f, agreedToTerms: !f.agreedToTerms }))}
                >
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${renewalForm.agreedToTerms ? "bg-primary border-primary" : "border-border"}`}>
                    {renewalForm.agreedToTerms && <span className="text-xs text-primary-foreground font-bold">✓</span>}
                  </div>
                  <span className={renewalForm.agreedToTerms ? "text-foreground" : "text-muted-foreground"}>위 계약 내용을 확인하고 동의합니다</span>
                </button>

                <div className="flex gap-2 pt-1">
                  <Button variant="outline" className="flex-1 h-9" onClick={() => setShowRenewal(false)}>취소</Button>
                  <Button className="flex-1 h-9" onClick={submitRenewal} disabled={requestRenewal.isPending || !renewalForm.agreedToTerms}>
                    {requestRenewal.isPending ? "신청 중..." : "갱신 신청"}
                  </Button>
                </div>
              </div>
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
