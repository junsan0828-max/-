import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

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

export default function FitStepPlusProfile() {
  const utils = trpc.useUtils();
  const { data: member } = trpc.fitStepPlus.memberMe.useQuery();

  const [profileForm, setProfileForm] = useState({ name: "", phone: "", email: "" });
  const [profileEditing, setProfileEditing] = useState(false);
  const [profileMsg, setProfileMsg] = useState("");

  const updateProfile = trpc.fitStepPlus.updateProfile.useMutation({
    onSuccess: () => {
      utils.fitStepPlus.memberMe.invalidate();
      setProfileEditing(false);
      setProfileMsg("정보가 저장되었습니다.");
      setTimeout(() => setProfileMsg(""), 3000);
    },
    onError: (e) => setProfileMsg(e.message || "저장 실패"),
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

  const daysLeft = daysUntil(member?.membershipEnd);

  return (
    <div className="p-4 space-y-4">
      <h1 className="font-bold text-lg">내 정보</h1>

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
              { label: "이름", value: member?.name ?? "-" },
              { label: "휴대폰 (아이디)", value: member?.phone ?? "-" },
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
          <p className={`text-xs mt-2 ${profileMsg.includes("저장") ? "text-green-400" : "text-red-400"}`}>{profileMsg}</p>
        )}
      </div>

      <div className="bg-card border border-border rounded-xl p-4">
        <p className="text-xs text-muted-foreground">비밀번호: 휴대폰 번호 뒷자리 4자리</p>
      </div>
    </div>
  );
}
