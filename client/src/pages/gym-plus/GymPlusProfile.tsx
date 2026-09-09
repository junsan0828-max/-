// @ts-nocheck
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { fmtPhone } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

function DietSection() {
  const utils = trpc.useUtils();
  const { data: diet, isLoading } = trpc.gymPlus.dietStatus.useQuery();
  const [weightForm, setWeightForm] = useState({ checkDate: new Date().toISOString().slice(0, 10), weight: "", note: "" });
  const [weightMsg, setWeightMsg] = useState("");

  const recordWeight = trpc.gymPlus.dietRecordWeight.useMutation({
    onSuccess: (res) => {
      utils.gymPlus.dietStatus.invalidate();
      utils.gymPlus.memberMe.invalidate();
      setWeightForm((p) => ({ ...p, weight: "", note: "" }));
      if (res.bonusEarned > 0) {
        setWeightMsg(`체중 기록 완료! 🎉 ${res.bonusEarned}개월 추가 서비스가 적립되었습니다.`);
      } else {
        setWeightMsg("체중이 기록되었습니다.");
      }
      setTimeout(() => setWeightMsg(""), 5000);
    },
    onError: (e) => setWeightMsg(e.message || "기록 실패"),
  });

  if (isLoading) return null;
  if (!diet?.programId) return null;

  const lostKg = diet.startWeight && diet.currentWeight
    ? Math.max(0, diet.startWeight - diet.currentWeight)
    : 0;
  const earnedMonths = diet.earnedMonths ?? 0;

  const handleRecord = (e: React.FormEvent) => {
    e.preventDefault();
    const w = parseFloat(weightForm.weight);
    if (!weightForm.weight || isNaN(w) || w <= 0) {
      setWeightMsg("체중을 입력해주세요.");
      return;
    }
    recordWeight.mutate({ checkDate: weightForm.checkDate, weight: w, note: weightForm.note || undefined });
  };

  return (
    <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-4 space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-lg">🥗</span>
        <h2 className="font-semibold text-sm text-purple-300">다이어트 프로그램</h2>
      </div>

      {/* 현황 요약 */}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-background/50 rounded-xl p-3">
          <p className="text-[10px] text-muted-foreground">시작 체중</p>
          <p className="font-bold text-sm mt-0.5">{diet.startWeight ? `${diet.startWeight}kg` : "-"}</p>
        </div>
        <div className="bg-background/50 rounded-xl p-3">
          <p className="text-[10px] text-muted-foreground">최근 체중</p>
          <p className="font-bold text-sm mt-0.5">{diet.currentWeight ? `${diet.currentWeight}kg` : "-"}</p>
        </div>
        <div className="bg-background/50 rounded-xl p-3">
          <p className="text-[10px] text-muted-foreground">총 감량</p>
          <p className="font-bold text-sm mt-0.5 text-green-400">{lostKg > 0 ? `-${lostKg.toFixed(1)}kg` : "0kg"}</p>
        </div>
        <div className="bg-background/50 rounded-xl p-3">
          <p className="text-[10px] text-muted-foreground">적립 개월</p>
          <p className="font-bold text-sm mt-0.5 text-purple-300">{diet.earnedMonths ?? 0}개월</p>
        </div>
      </div>

      {diet.earnedMonths > 0 && (
        <div className="bg-purple-500/20 border border-purple-500/30 rounded-xl p-3 text-center">
          <p className="text-xs text-purple-300">
            🎉 {diet.earnedMonths}개월 추가 서비스 적립! (최대 9개월 가능)
          </p>
        </div>
      )}

      {/* 최근 체중 기록 */}
      {diet.checks && diet.checks.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground font-medium">최근 기록</p>
          {diet.checks.slice(-5).reverse().map((c: any, i: number) => (
            <div key={i} className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0">
              <span className="text-xs text-muted-foreground">{c.checkDate?.slice(0, 10)}</span>
              <div className="flex items-center gap-2">
                {c.bonusMonthsEarned > 0 && (
                  <span className="text-[10px] text-purple-400">+{c.bonusMonthsEarned}개월</span>
                )}
                <span className="text-xs font-semibold">{c.weight}kg</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 체중 기록 폼 */}
      <form onSubmit={handleRecord} className="space-y-3 pt-2 border-t border-purple-500/20">
        <p className="text-xs font-medium text-purple-300">체중 기록하기</p>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">측정일</Label>
            <Input
              type="date"
              value={weightForm.checkDate}
              onChange={(e) => setWeightForm((p) => ({ ...p, checkDate: e.target.value }))}
              className="bg-input border-border h-9 text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">체중 (kg)</Label>
            <Input
              type="number"
              step="0.1"
              min="20"
              max="200"
              value={weightForm.weight}
              onChange={(e) => setWeightForm((p) => ({ ...p, weight: e.target.value }))}
              placeholder="예: 68.5"
              className="bg-input border-border h-9 text-sm"
            />
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] text-muted-foreground">메모 (선택)</Label>
          <Input
            value={weightForm.note}
            onChange={(e) => setWeightForm((p) => ({ ...p, note: e.target.value }))}
            placeholder="특이사항"
            className="bg-input border-border h-9 text-sm"
          />
        </div>
        <Button
          type="submit"
          size="sm"
          className="w-full bg-purple-600 hover:bg-purple-700 text-white"
          disabled={recordWeight.isPending}
        >
          {recordWeight.isPending ? "기록 중..." : "체중 기록"}
        </Button>
        {weightMsg && (
          <p className={`text-xs text-center ${weightMsg.includes("실패") ? "text-red-400" : "text-green-400"}`}>
            {weightMsg}
          </p>
        )}
      </form>
    </div>
  );
}

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

function daysUntil(dateStr: string | null | undefined) {
  if (!dateStr) return null;
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
}

function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return "-";
  return dateStr.slice(0, 10).replace(/-/g, ".");
}

export default function GymPlusProfile() {
  const utils = trpc.useUtils();
  const { data: member } = trpc.gymPlus.memberMe.useQuery();

  const [profileForm, setProfileForm] = useState({ name: "", phone: "", email: "" });
  const [profileEditing, setProfileEditing] = useState(false);
  const [profileMsg, setProfileMsg] = useState("");

  const [pwForm, setPwForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [pwMsg, setPwMsg] = useState("");
  const [pwExpanded, setPwExpanded] = useState(false);

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
    if (pwForm.newPassword !== pwForm.confirmPassword) {
      setPwMsg("새 비밀번호가 일치하지 않습니다.");
      return;
    }
    changePassword.mutate({ currentPassword: pwForm.currentPassword, newPassword: pwForm.newPassword });
  };

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
        {daysLeft !== null && (
          <div className={`rounded-xl p-3 text-center ${
            daysLeft <= 0 ? "bg-red-500/20 border border-red-500/30" :
            daysLeft <= 7 ? "bg-orange-500/20 border border-orange-500/30" :
            "bg-green-500/10 border border-green-500/20"
          }`}>
            <p className="text-xs text-muted-foreground">회원권 남은 기간</p>
            <p className={`font-black text-2xl mt-0.5 ${
              daysLeft <= 0 ? "text-red-400" : daysLeft <= 7 ? "text-orange-400" : "text-green-400"
            }`}>
              {daysLeft > 0 ? `D-${daysLeft}` : daysLeft === 0 ? "오늘 만료" : "만료됨"}
            </p>
          </div>
        )}
      </div>

      {/* 다이어트 프로그램 */}
      <DietSection />

      {/* 회원정보 편집 */}
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-sm">회원 정보</h2>
          {!profileEditing && (
            <button onClick={startEdit} className="text-xs text-primary">수정</button>
          )}
        </div>

        {profileEditing ? (
          <form onSubmit={submitProfile} className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">이름</Label>
              <Input
                value={profileForm.name}
                onChange={(e) => setProfileForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="이름"
                className="bg-input border-border h-9 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">연락처</Label>
              <Input
                value={profileForm.phone}
                onChange={(e) => setProfileForm((p) => ({ ...p, phone: e.target.value }))}
                placeholder="010-0000-0000"
                className="bg-input border-border h-9 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">이메일</Label>
              <Input
                value={profileForm.email}
                onChange={(e) => setProfileForm((p) => ({ ...p, email: e.target.value }))}
                placeholder="email@example.com"
                className="bg-input border-border h-9 text-sm"
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit" size="sm" className="flex-1" disabled={updateProfile.isPending}>
                {updateProfile.isPending ? "저장 중..." : "저장"}
              </Button>
              <Button type="button" size="sm" variant="outline" className="flex-1"
                onClick={() => { setProfileEditing(false); setProfileMsg(""); }}>
                취소
              </Button>
            </div>
          </form>
        ) : (
          <div className="space-y-2">
            {[
              { label: "아이디", value: member?.username },
              { label: "이름", value: member?.name ?? "-" },
              { label: "연락처", value: fmtPhone(member?.phone) },
              { label: "이메일", value: member?.email ?? "-" },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
                <span className="text-xs text-muted-foreground">{item.label}</span>
                <span className="text-xs font-medium">{item.value}</span>
              </div>
            ))}
          </div>
        )}

        {profileMsg && (
          <p className={`text-xs mt-2 ${profileMsg.includes("저장") ? "text-green-400" : "text-red-400"}`}>
            {profileMsg}
          </p>
        )}
      </div>

      {/* 비밀번호 변경 */}
      <div className="bg-card border border-border rounded-xl p-4">
        <button
          className="w-full flex items-center justify-between"
          onClick={() => { setPwExpanded((v) => !v); setPwMsg(""); }}
        >
          <h2 className="font-semibold text-sm">비밀번호 변경</h2>
          <span className="text-xs text-muted-foreground">{pwExpanded ? "▲" : "▼"}</span>
        </button>

        {pwExpanded && (
          <form onSubmit={submitPassword} className="mt-3 space-y-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">현재 비밀번호</Label>
              <Input
                type="password"
                value={pwForm.currentPassword}
                onChange={(e) => setPwForm((p) => ({ ...p, currentPassword: e.target.value }))}
                placeholder="현재 비밀번호"
                className="bg-input border-border h-9 text-sm"
                autoComplete="current-password"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">새 비밀번호</Label>
              <Input
                type="password"
                value={pwForm.newPassword}
                onChange={(e) => setPwForm((p) => ({ ...p, newPassword: e.target.value }))}
                placeholder="6자 이상"
                className="bg-input border-border h-9 text-sm"
                autoComplete="new-password"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">새 비밀번호 확인</Label>
              <Input
                type="password"
                value={pwForm.confirmPassword}
                onChange={(e) => setPwForm((p) => ({ ...p, confirmPassword: e.target.value }))}
                placeholder="비밀번호 재입력"
                className="bg-input border-border h-9 text-sm"
                autoComplete="new-password"
              />
            </div>
            <Button type="submit" size="sm" className="w-full" disabled={changePassword.isPending}>
              {changePassword.isPending ? "변경 중..." : "비밀번호 변경"}
            </Button>
          </form>
        )}

        {pwMsg && (
          <p className={`text-xs mt-2 ${pwMsg.includes("변경") ? "text-green-400" : "text-red-400"}`}>
            {pwMsg}
          </p>
        )}
      </div>
    </div>
  );
}
