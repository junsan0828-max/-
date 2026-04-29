import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "../lib/trpc";
import { Search, ChevronRight } from "lucide-react";

type TypeFilter = "all" | "PT" | "헬스" | "기타";

function memberType(packages: string[], status: string): "PT" | "헬스" | "기타" {
  if (packages.length > 0) return "PT";
  if (status === "active") return "헬스";
  return "기타";
}

export default function AdminMembers() {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");

  const { data: allMembers, isLoading } = trpc.members.listAll.useQuery();

  const filtered = allMembers?.filter((m) => {
    const q = search.trim().toLowerCase();
    const matchSearch =
      !q ||
      m.name.toLowerCase().includes(q) ||
      (m.trainerName ?? "").toLowerCase().includes(q) ||
      (m.profileNote ?? "").toLowerCase().includes(q);

    const mType = memberType(m.packages, m.status);
    const matchType = typeFilter === "all" || mType === typeFilter;

    return matchSearch && matchType;
  });

  const counts = {
    all: allMembers?.length ?? 0,
    PT: allMembers?.filter((m) => memberType(m.packages, m.status) === "PT").length ?? 0,
    헬스: allMembers?.filter((m) => memberType(m.packages, m.status) === "헬스").length ?? 0,
    기타: allMembers?.filter((m) => memberType(m.packages, m.status) === "기타").length ?? 0,
  };

  return (
    <div className="space-y-4 pb-20">
      <h1 className="text-xl font-bold">회원 관리</h1>

      {/* 타입 필터 탭 */}
      <div className="flex gap-1 bg-card border border-border rounded-xl p-1">
        {(["all", "PT", "헬스", "기타"] as TypeFilter[]).map((t) => (
          <button
            key={t}
            onClick={() => setTypeFilter(t)}
            className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              typeFilter === t
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t === "all" ? "전체" : t}
          </button>
        ))}
      </div>

      {/* 검색 */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="회원명, 트레이너, 메모 검색..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 bg-input border border-border rounded-lg text-sm outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      {/* 목록 */}
      <div className="space-y-2">
        {isLoading && (
          <p className="text-center text-muted-foreground py-8 text-sm">불러오는 중...</p>
        )}
        {!isLoading && (!filtered || filtered.length === 0) && (
          <p className="text-center text-muted-foreground py-8 text-sm">검색 결과가 없습니다</p>
        )}
        {filtered?.map((m) => {
          const mType = memberType(m.packages, m.status);
          const pkgLabel = m.packages.filter(Boolean).join(", ");
          return (
            <button
              key={m.id}
              onClick={() => setLocation(`/members/${m.id}`)}
              className="w-full text-left bg-card border border-border rounded-xl px-4 py-3 hover:bg-accent transition-colors"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap mb-1">
                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium border ${
                      mType === "PT"
                        ? "bg-blue-500/20 text-blue-400 border-blue-500/30"
                        : mType === "헬스"
                        ? "bg-green-500/20 text-green-400 border-green-500/30"
                        : "bg-muted text-muted-foreground border-border"
                    }`}>
                      {mType}
                    </span>
                    <span className="font-medium text-sm">{m.name}</span>
                    {pkgLabel && (
                      <span className="text-xs text-muted-foreground truncate">{pkgLabel}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    {m.trainerName && <span>{m.trainerName}</span>}
                    {m.trainerName && m.membershipStart && <span>·</span>}
                    {m.membershipStart && <span>{m.membershipStart}</span>}
                    {m.profileNote && (
                      <>
                        <span>·</span>
                        <span className="truncate max-w-[120px]">{m.profileNote}</span>
                      </>
                    )}
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </div>
            </button>
          );
        })}
      </div>

      {/* 합계 */}
      {filtered && filtered.length > 0 && (
        <p className="text-sm text-muted-foreground text-center py-2">
          합계 ({filtered.length}건)
        </p>
      )}
    </div>
  );
}
