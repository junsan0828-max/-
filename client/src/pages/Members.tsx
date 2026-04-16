import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UserPlus, ChevronRight, Search } from "lucide-react";
import { differenceInDays } from "date-fns";

const gradeLabels: Record<string, string> = {
  basic: "기본",
  premium: "프리미엄",
  vip: "VIP",
};

const statusColors: Record<string, string> = {
  active: "bg-green-500/20 text-green-400 border-green-500/30",
  paused: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
};

export default function Members() {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const { data: members, isLoading } = trpc.members.list.useQuery();
  const { data: ptPackages } = trpc.pt.list.useQuery();

  const today = new Date();

  const filtered = members?.filter(
    (m) => m.name.includes(search) || (m.phone && m.phone.includes(search))
  );

  // 회원별 활성 PT 잔여 횟수 맵
  const remainingMap: Record<number, number> = {};
  ptPackages?.forEach((pkg) => {
    if (pkg.status === "active") {
      remainingMap[pkg.memberId] = (remainingMap[pkg.memberId] ?? 0) + (pkg.totalSessions - pkg.usedSessions);
    }
  });

  // 미수금 회원 ID 집합
  const unpaidSet = new Set<number>(
    ptPackages?.filter((pkg) => pkg.unpaidAmount && pkg.unpaidAmount > 0).map((pkg) => pkg.memberId) ?? []
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">회원 관리</h1>
          <p className="text-sm text-muted-foreground mt-0.5">총 {members?.length ?? 0}명</p>
        </div>
        <Button size="sm" onClick={() => setLocation("/members/new")} className="gap-1.5">
          <UserPlus className="h-4 w-4" />
          신규 등록
        </Button>
      </div>

      {/* 검색 */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="이름 또는 연락처로 검색"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 bg-input border-border"
        />
      </div>

      {/* 회원 목록 */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-20 rounded-lg bg-card border border-border animate-pulse" />
          ))}
        </div>
      ) : filtered?.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-sm">{search ? "검색 결과가 없습니다." : "등록된 회원이 없습니다."}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered?.map((member) => {
            const daysLeft =
              member.membershipEnd
                ? differenceInDays(new Date(member.membershipEnd), today)
                : null;
            const isExpiringSoon = daysLeft !== null && daysLeft >= 0 && daysLeft <= 7;
            const isExpired = daysLeft !== null && daysLeft < 0;
            const hasUnpaid = unpaidSet.has(member.id);
            const remainingSessions = remainingMap[member.id];

            return (
              <button
                key={member.id}
                onClick={() => setLocation(`/members/${member.id}`)}
                className={`w-full text-left p-4 rounded-lg bg-card border transition-colors hover:border-primary/50 ${
                  isExpiringSoon ? "border-yellow-500/40" : isExpired ? "border-red-500/30" : "border-border"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                      {member.name.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="font-medium text-foreground">{member.name}</p>
                        <span className={`text-xs px-1.5 py-0.5 rounded-full border ${statusColors[member.status] ?? ""}`}>
                          {member.status === "active" ? "활성" : "정지"}
                        </span>
                        <span className="text-xs text-muted-foreground">{gradeLabels[member.grade]}</span>
                        {/* 만료 임박 배지 */}
                        {isExpiringSoon && (
                          <span className="text-xs px-1.5 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
                            D-{daysLeft}
                          </span>
                        )}
                        {isExpired && (
                          <span className="text-xs px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30">
                            만료
                          </span>
                        )}
                        {/* 미수금 배지 */}
                        {hasUnpaid && (
                          <span className="text-xs px-1.5 py-0.5 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/30">
                            미수금
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-xs text-muted-foreground truncate">
                          {member.phone ?? member.email ?? "연락처 없음"}
                        </p>
                        {remainingSessions !== undefined && (
                          <span className="text-xs text-primary shrink-0">PT {remainingSessions}회</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 ml-2" />
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
