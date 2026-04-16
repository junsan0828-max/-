import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Search, ChevronRight } from "lucide-react";

const statusLabels: Record<string, { label: string; color: string }> = {
  active:    { label: "진행중", color: "bg-green-500/20 text-green-400 border-green-500/30" },
  completed: { label: "완료",   color: "bg-gray-500/20 text-gray-400 border-gray-500/30" },
  expired:   { label: "만료",   color: "bg-red-500/20 text-red-400 border-red-500/30" },
};

export default function PT() {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "completed" | "expired">("all");

  const { data: packages, isLoading } = trpc.pt.list.useQuery();

  const filtered = packages?.filter((pkg) => {
    const matchSearch =
      !search ||
      (pkg.memberName ?? "").includes(search) ||
      (pkg.packageName ?? "").includes(search) ||
      (pkg.memberPhone ?? "").includes(search);
    const matchFilter = filter === "all" || pkg.status === filter;
    return matchSearch && matchFilter;
  });

  const counts = {
    all: packages?.length ?? 0,
    active: packages?.filter((p) => p.status === "active").length ?? 0,
    completed: packages?.filter((p) => p.status === "completed").length ?? 0,
    expired: packages?.filter((p) => p.status === "expired").length ?? 0,
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">PT 관리</h1>
        <p className="text-sm text-muted-foreground mt-0.5">총 {packages?.length ?? 0}개 패키지</p>
      </div>

      {/* 검색 */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="회원명, 프로그램, 연락처 검색"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 bg-input border-border"
        />
      </div>

      {/* 상태 필터 탭 */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {(["all", "active", "completed", "expired"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              filter === s
                ? "bg-primary text-primary-foreground"
                : "bg-accent text-muted-foreground hover:text-foreground"
            }`}
          >
            {s === "all" ? "전체" : statusLabels[s].label}
            <span className="ml-1.5 opacity-70">{counts[s]}</span>
          </button>
        ))}
      </div>

      {/* PT 패키지 목록 */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 rounded-lg bg-card border border-border animate-pulse" />
          ))}
        </div>
      ) : !filtered?.length ? (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-sm">{search || filter !== "all" ? "검색 결과가 없습니다." : "등록된 PT 패키지가 없습니다."}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((pkg) => {
            const remaining = pkg.totalSessions - pkg.usedSessions;
            const pct = Math.min((pkg.usedSessions / pkg.totalSessions) * 100, 100);
            const st = statusLabels[pkg.status] ?? statusLabels.active;

            return (
              <button
                key={pkg.id}
                onClick={() => setLocation(`/members/${pkg.memberId}`)}
                className="w-full text-left p-4 rounded-lg bg-card border border-border hover:border-primary/50 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    {/* 회원 이름 + 상태 배지 */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{pkg.memberName}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full border ${st.color}`}>
                        {st.label}
                      </span>
                      {pkg.unpaidAmount && pkg.unpaidAmount > 0 ? (
                        <span className="text-xs px-1.5 py-0.5 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/30">
                          미수금
                        </span>
                      ) : null}
                    </div>
                    {/* 프로그램명 + 기간 */}
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {pkg.packageName || "PT 프로그램"}
                      {pkg.expiryDate && (
                        <> · 만료 {format(new Date(pkg.expiryDate), "yyyy.MM.dd", { locale: ko })}</>
                      )}
                    </p>
                    {/* 진행률 바 */}
                    <div className="mt-2 w-full bg-border rounded-full h-1.5">
                      <div className="bg-primary h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {pkg.usedSessions}/{pkg.totalSessions}회 사용 · 잔여 {remaining}회
                    </p>
                    {/* 결제 정보 */}
                    {(pkg.paymentAmount || pkg.unpaidAmount) && (
                      <div className="flex gap-3 mt-1.5 text-xs">
                        {pkg.paymentAmount ? (
                          <span className="text-muted-foreground">
                            결제 <span className="text-foreground font-medium">{pkg.paymentAmount.toLocaleString()}원</span>
                          </span>
                        ) : null}
                        {pkg.unpaidAmount && pkg.unpaidAmount > 0 ? (
                          <span className="text-muted-foreground">
                            미수금 <span className="text-orange-400 font-medium">{pkg.unpaidAmount.toLocaleString()}원</span>
                          </span>
                        ) : null}
                        {pkg.paymentMethod ? (
                          <span className="text-muted-foreground">{pkg.paymentMethod}</span>
                        ) : null}
                      </div>
                    )}
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
