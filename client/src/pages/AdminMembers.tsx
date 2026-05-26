import { useState, useMemo, useEffect } from "react";
import { useLocation } from "wouter";
import { trpc } from "../lib/trpc";
import { Search, ChevronRight, MapPin } from "lucide-react";

type TypeFilter = "all" | "PT" | "헬스" | "기타";

function memberType(packages: { packageName: string; totalSessions: number }[], status: string, hasPtRevenue?: boolean): "PT" | "헬스" | "기타" {
  if (packages.length > 0 || hasPtRevenue) return "PT";
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

const SESSION_KEY = "admin_members_filter";

function loadFilter() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as { search: string; typeFilter: TypeFilter; branchFilter: number | null };
  } catch {
    return null;
  }
}

export default function AdminMembers() {
  const [, setLocation] = useLocation();
  const saved = loadFilter();
  const [search, setSearch] = useState(saved?.search ?? "");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>(saved?.typeFilter ?? "all");
  const [branchFilter, setBranchFilter] = useState<number | null>(saved?.branchFilter ?? null);

  useEffect(() => {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ search, typeFilter, branchFilter }));
  }, [search, typeFilter, branchFilter]);

  const { data: branchList } = trpc.gym.staff.listBranches.useQuery();
  const { data: allMembers, isLoading } = trpc.members.listAll.useQuery(
    branchFilter ? { branchId: branchFilter } : undefined
  );

  const ptMembers = allMembers?.filter((m) => memberType(m.packages, m.status, m.hasPtRevenue) === "PT") ?? [];
  const healthMembers = allMembers?.filter((m) => memberType(m.packages, m.status, m.hasPtRevenue) === "헬스") ?? [];

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

  // 동일 이름+전화 회원 그룹핑 (합산 표시)
  type MemberRow = NonNullable<typeof allMembers>[0];
  const groupedMembers = useMemo(() => {
    if (!allMembers) return [];
    const map = new Map<string, MemberRow[]>();
    for (const m of allMembers) {
      const digits = m.phone?.replace(/\D/g, "") ?? "";
      const key = digits.length >= 7
        ? `${m.name.trim()}||${digits}`
        : `__solo_${m.id}`;
      const arr = map.get(key) ?? [];
      arr.push(m);
      map.set(key, arr);
    }
    return Array.from(map.values());
  }, [allMembers]);

  const filtered = groupedMembers?.filter((group) => {
    const m = group[0];
    const q = search.trim().toLowerCase();
    const matchSearch =
      !q ||
      m.name.toLowerCase().includes(q) ||
      group.some(g => (g.trainerName ?? "").toLowerCase().includes(q)) ||
      group.some(g => (g.profileNote ?? "").toLowerCase().includes(q));
    const mTypes = group.map(g => memberType(g.packages, g.status, g.hasPtRevenue));
    const matchType = typeFilter === "all" || mTypes.includes(typeFilter as any);
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
        {filtered?.map((group) => {
          const primary = group.find(g => memberType(g.packages, g.status, g.hasPtRevenue) === "PT") ?? group[0];
          const types = Array.from(new Set(group.map(g => memberType(g.packages, g.status, g.hasPtRevenue))));
          const pkgLabel = group
            .flatMap(g => g.packages.map(p => p.packageName).filter(Boolean))
            .filter((v, i, a) => a.indexOf(v) === i)
            .join(", ");
          const trainerNames = Array.from(new Set(group.map(g => g.trainerName).filter(Boolean)));
          const isDuplicate = group.length > 1;
          const typeStyle = (t: string) =>
            t === "PT" ? "bg-blue-500/20 text-blue-400 border-blue-500/30"
            : t === "헬스" ? "bg-green-500/20 text-green-400 border-green-500/30"
            : "bg-muted text-muted-foreground border-border";
          return (
            <div
              key={primary.id}
              role="button"
              tabIndex={0}
              onClick={() => setLocation(`/members/${primary.id}`)}
              onKeyDown={(e) => e.key === "Enter" && setLocation(`/members/${primary.id}`)}
              className="w-full text-left bg-card border border-border rounded-xl px-4 py-3 hover:bg-accent transition-colors cursor-pointer"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap mb-1">
                    {types.map(t => (
                      <span key={t} className={`text-xs px-1.5 py-0.5 rounded font-medium border ${typeStyle(t)}`}>{t}</span>
                    ))}
                    <span className="font-medium text-sm">{primary.name}</span>
                    {pkgLabel && <span className="text-xs text-muted-foreground truncate">{pkgLabel}</span>}
                    {isDuplicate && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded border bg-amber-500/10 text-amber-400 border-amber-500/30">통합</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    {trainerNames.length > 0 && <span>{trainerNames.join(", ")}</span>}
                    {trainerNames.length > 0 && primary.membershipStart && <span>·</span>}
                    {primary.membershipStart && <span>{primary.membershipStart}</span>}
                    {primary.profileNote && <><span>·</span><span className="truncate max-w-[120px]">{primary.profileNote}</span></>}
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </div>
            </div>
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
