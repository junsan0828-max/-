import { trpc } from "@/lib/trpc";

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

export default function GymPlusMembership() {
  const { data: member } = trpc.gymPlus.memberMe.useQuery();
  const { data: logs } = trpc.gymPlus.listWorkoutLogs.useQuery({});

  const daysLeft = daysUntil(member?.membershipEnd);
  const totalWorkouts = logs?.length ?? 0;

  const thisMonth = new Date().toISOString().slice(0, 7);
  const monthlyWorkouts = logs?.filter((l) => l.logDate.startsWith(thisMonth)).length ?? 0;

  return (
    <div className="p-4 space-y-4">
      <h1 className="font-bold text-lg">회원권 정보</h1>

      {/* 회원 정보 카드 */}
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
            {daysLeft > 0 && (
              <p className="text-[10px] text-muted-foreground mt-0.5">{member?.membershipEnd?.slice(0, 10)} 만료</p>
            )}
          </div>
        )}
      </div>

      {/* 운동 통계 */}
      <div>
        <h2 className="font-semibold text-sm mb-3">나의 운동 통계</h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-card border border-border rounded-xl p-4 text-center">
            <p className="text-3xl font-black text-primary">{totalWorkouts}</p>
            <p className="text-xs text-muted-foreground mt-1">전체 운동 횟수</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4 text-center">
            <p className="text-3xl font-black text-primary">{monthlyWorkouts}</p>
            <p className="text-xs text-muted-foreground mt-1">이번달 운동 횟수</p>
          </div>
        </div>
      </div>

      {/* 계정 정보 */}
      <div className="bg-card border border-border rounded-xl p-4 space-y-3">
        <h2 className="font-semibold text-sm">계정 정보</h2>
        <div className="space-y-2">
          {[
            { label: "아이디", value: member?.username },
            { label: "연락처", value: member?.phone ?? "-" },
            { label: "이메일", value: member?.email ?? "-" },
          ].map((item) => (
            <div key={item.label} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
              <span className="text-xs text-muted-foreground">{item.label}</span>
              <span className="text-xs font-medium">{item.value}</span>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-muted-foreground">회원정보 변경은 헬스장 데스크에 문의하세요</p>
      </div>
    </div>
  );
}
