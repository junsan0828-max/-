import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "../lib/trpc";
import { Search, ChevronRight, MapPin } from "lucide-react";

type TypeFilter = "all" | "PT" | "헬스" | "기타";

function memberType(packages: { packageName: string; totalSessions: number }[], status: string): "PT" | "헬스" | "기타" {
  if (packages.length > 0) return "PT";
  if (status === "active") return "헬스";
  return "기타";
}

function calcMonths(start: string | null, end: string | null): number | null {
  if (!start || !end) return null;
  const s = new Date(start);
  const e = new Date(end);
  const diff = (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth());
  return diff > 0 ? diff : 1;
}

function bucketMonths(months: number): string {
  if (months <= 1) return "1개월";
  if (months <= 2) return "2개월";
  if (months <= 3) return "3개월";
  if (months <= 6) return "6개월";
  if (months <= 12) return "12개월";
  return "12개월+";
}

const MONTH_ORDER = ["1개월", "2개월", "3개월", "6개월", "12개월", "12개월+"];
const SESSION_ORDER = [10, 20, 30, 40, 50];

function StatsBar({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{count}명 <span className="text-muted-foreground">({pct}%)</span></span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function AdminMembers() {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [branchFilter, setBranchFilter] = useState<number | null>(null);

  const { data: branchList } = trpc.gym.staff.listBranches.useQuery();
  const { data: allMembers, isLoading } = trpc.members.listAll.useQuery(
    branchFilter ? { branchId: branchFilter } : undefined
  );

  const ptMembers = allMembers?.filter((m) => memberType(m.packages, m.status) === "PT") ?? [];
  const healthMembers = allMembers?.filter((m) => memberType(m.packages, m.status) === "헬스") ?? [];

  // PT 횟수별 통계
  const sessionStats = (() => {
    const map = new Map<number, number>();
    for (const m of ptMembers) {
      for (const p of m.packages) {
        const bucket = SESSION_ORDER.find((s) => s === p.totalSessions) ?? p.totalSessions;
        map.set(bucket, (map.get(bucket) ?? 0) + 1);
      }
    }
    const total = Array.from(map.values()).reduce((a, b) => a + b, 0);
    const entries = SESSION_ORDER
      .filter((s) => map.has(s))
      .map((s) => ({ label: `${s}회`, count: map.get(s)!, total }));
    const others = Array.from(map.entries())
      .filter(([k]) => !SESSION_ORDER.includes(k))
      .reduce((a, [, v]) => a + v, 0);
    if (others > 0) entries.push({ label: "기타", count: others, total });
    return entries;
  })();

  // 헬스 개월별 통계
  const monthStats = (() => {
    const map = new Map<string, number>();
    for (const m of healthMembers) {
      const months = calcMonths(m.membershipStart, m.membershipEnd);
      if (months !== null) {
        const b = bucketMonths(months);
        map.set(b, (map.get(b) ?? 0) + 1);
      }
    }
    const total = Array.from(map.values()).reduce((a, b) => a + b, 0);
    return MONTH_ORDER.filter((k) => map.has(k)).map((k) => ({ label: k, count: map.get(k)!, total }));
  })();

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

  const BAR_COLORS = [
    "bg-blue-500", "bg-indigo-500", "bg-violet-500", "bg-purple-500", "bg-fuchsia-500", "bg-pink-500",
  ];

  return (
    <div className="space-y-4 pb-20">
      <h1 className="text-xl font-bold">회원 관리</h1>

      {/* 지점 필터 */}
      {branchList && branchList.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setBranchFilter(null)}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              branchFilter === null ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            <MapPin className="h-3 w-3" /> 전체
          </button>
          {branchList.map((b) => (
            <button
              key={b.id}
              onClick={() => setBranchFilter(b.id)}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                branchFilter === b.id ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              <MapPin className="h-3 w-3" /> {b.name}
            </button>
          ))}
        </div>
      )}

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

      {/* PT 횟수별 통계 */}
      {typeFilter === "PT" && sessionStats.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">횟수별 비율</p>
          {sessionStats.map((s, i) => (
            <StatsBar key={s.label} label={s.label} count={s.count} total={s.total} color={BAR_COLORS[i % BAR_COLORS.length]} />
          ))}
        </div>
      )}

      {/* 헬스 개월별 통계 */}
      {typeFilter === "헬스" && (
        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">개월별 비율</p>
          {monthStats.length > 0 ? (
            monthStats.map((s, i) => (
              <StatsBar key={s.label} label={s.label} count={s.count} total={s.total} color={BAR_COLORS[i % BAR_COLORS.length]} />
            ))
          ) : (
            <p className="text-xs text-muted-foreground">회원권 기간 데이터가 없습니다</p>
          )}
        </div>
      )}

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
          const pkgLabel = m.packages.map((p) => p.packageName).filter(Boolean).join(", ");
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

      {filtered && filtered.length > 0 && (
        <p className="text-sm text-muted-foreground text-center py-2">
          합계 ({filtered.length}건)
        </p>
      )}
    </div>
  );
}
