import { useState, useMemo, useEffect } from "react";
import { useLocation } from "wouter";
import { trpc } from "../lib/trpc";
import { Search, ChevronRight, MapPin, Users, UserCheck, Clock, UserX, Pause, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";

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
      group.some(g => (g.phone ?? "").replace(/\D/g, "").includes(q.replace(/\D/g, ""))) ||
      group.some(g => (g.trainerName ?? "").toLowerCase().includes(q)) ||
      group.some(g => (g.profileNote ?? "").toLowerCase().includes(q));
    const mTypes = group.map(g => memberType(g.packages, g.status, g.hasPtRevenue));
    const matchType = typeFilter === "all" || mTypes.includes(typeFilter as any);
    return matchSearch && matchType;
  });

  const BAR_COLORS = [
    "bg-blue-500", "bg-indigo-500", "bg-violet-500", "bg-purple-500", "bg-fuchsia-500", "bg-pink-500",
  ];

  // ── 통계 계산 ─────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    if (!allMembers) return null;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().slice(0, 10);

    const total = allMembers.length;
    const active = allMembers.filter(m => m.status === "active").length;
    const paused = allMembers.filter(m => m.status === "paused").length;

    const expired = allMembers.filter(m => {
      if (!m.membershipEnd) return false;
      return new Date(m.membershipEnd) < today;
    }).length;

    const expiringSoon = allMembers.filter(m => {
      if (!m.membershipEnd || m.status !== "active") return false;
      const diff = Math.ceil((new Date(m.membershipEnd).getTime() - today.getTime()) / 86400000);
      return diff >= 0 && diff <= 7;
    }).length;

    // 전월 대비 (신규 가입)
    const thisMonthStr = todayStr.slice(0, 7);
    const prevMonthDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const prevMonthStr = prevMonthDate.toISOString().slice(0, 7);
    const newThisMonth = allMembers.filter(m => m.createdAt?.slice(0, 7) === thisMonthStr).length;
    const newPrevMonth = allMembers.filter(m => m.createdAt?.slice(0, 7) === prevMonthStr).length;
    const newDiff = newThisMonth - newPrevMonth;

    // 활성 회원 성별 비율
    const activeMembers = allMembers.filter(m => m.status === "active");
    const genderMap: Record<string, number> = {};
    for (const m of activeMembers) {
      const g = m.gender === "male" ? "남성" : m.gender === "female" ? "여성" : "미등록";
      genderMap[g] = (genderMap[g] ?? 0) + 1;
    }
    const genderData = Object.entries(genderMap).map(([name, value]) => ({ name, value }));

    // 활성 회원 연령대
    const ageMap: Record<string, number> = {};
    for (const m of activeMembers) {
      if (!m.birthDate) { ageMap["미등록"] = (ageMap["미등록"] ?? 0) + 1; continue; }
      const age = today.getFullYear() - parseInt(m.birthDate.slice(0, 4));
      const decade = Math.floor(age / 10) * 10;
      const label = decade <= 9 ? "10대 미만" : `${decade}대`;
      ageMap[label] = (ageMap[label] ?? 0) + 1;
    }
    const AGE_ORDER = ["10대 미만", "10대", "20대", "30대", "40대", "50대", "60대", "70대", "80대 이상", "미등록"];
    const ageData = AGE_ORDER.filter(k => ageMap[k]).map(k => ({ name: k, value: ageMap[k] }));
    // 80대 이상 합산
    const over80 = Object.entries(ageMap).filter(([k]) => !AGE_ORDER.includes(k)).reduce((s, [, v]) => s + v, 0);
    if (over80 > 0) {
      const idx = ageData.findIndex(d => d.name === "80대 이상");
      if (idx >= 0) ageData[idx].value += over80;
      else ageData.push({ name: "80대 이상", value: over80 });
    }

    return { total, active, paused, expired, expiringSoon, newThisMonth, newPrevMonth, newDiff, genderData, ageData };
  }, [allMembers]);

  const GENDER_COLORS = ["#3b82f6", "#ec4899", "#94a3b8"];
  const AGE_COLORS = ["#6366f1", "#8b5cf6", "#a78bfa", "#3b82f6", "#06b6d4", "#10b981", "#f59e0b", "#ef4444", "#94a3b8", "#64748b"];

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

      {/* ── 회원 통계 대시보드 ── */}
      {stats && (
        <div className="space-y-3">
          {/* 요약 카드 5개 */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {[
              { label: "전체 회원", value: stats.total, icon: <Users className="h-4 w-4 text-primary" />, color: "border-primary/20 bg-primary/5" },
              { label: "활성 회원", value: stats.active, icon: <UserCheck className="h-4 w-4 text-green-400" />, color: "border-green-500/20 bg-green-500/5" },
              { label: "만료 임박 (7일)", value: stats.expiringSoon, icon: <Clock className="h-4 w-4 text-yellow-400" />, color: "border-yellow-500/20 bg-yellow-500/5" },
              { label: "만료 회원", value: stats.expired, icon: <UserX className="h-4 w-4 text-red-400" />, color: "border-red-500/20 bg-red-500/5" },
              { label: "정지 회원", value: stats.paused, icon: <Pause className="h-4 w-4 text-orange-400" />, color: "border-orange-500/20 bg-orange-500/5" },
              {
                label: "이번달 신규",
                value: stats.newThisMonth,
                icon: stats.newDiff > 0
                  ? <TrendingUp className="h-4 w-4 text-emerald-400" />
                  : stats.newDiff < 0
                    ? <TrendingDown className="h-4 w-4 text-red-400" />
                    : <Minus className="h-4 w-4 text-muted-foreground" />,
                color: "border-border bg-card",
                sub: stats.newDiff > 0
                  ? <span className="text-xs text-emerald-400">↑ 전월 대비 +{stats.newDiff}명</span>
                  : stats.newDiff < 0
                    ? <span className="text-xs text-red-400">↓ 전월 대비 {stats.newDiff}명</span>
                    : <span className="text-xs text-muted-foreground">전월과 동일</span>,
              },
            ].map((card, i) => (
              <div key={i} className={`border rounded-xl p-3 ${card.color}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-muted-foreground">{card.label}</span>
                  {card.icon}
                </div>
                <p className="text-2xl font-bold text-foreground">{card.value}<span className="text-sm font-normal ml-0.5">명</span></p>
                {card.sub && <div className="mt-1">{card.sub}</div>}
              </div>
            ))}
          </div>

          {/* 차트 2개 */}
          {stats.genderData.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* 성별 비율 */}
              <div className="bg-card border border-border rounded-xl p-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">활성 회원 성별 비율</p>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={stats.genderData} dataKey="value" cx="50%" cy="50%" outerRadius={60} innerRadius={30} paddingAngle={2}>
                      {stats.genderData.map((_, i) => <Cell key={i} fill={GENDER_COLORS[i % GENDER_COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: any) => [`${v}명`, ""]} />
                    <Legend iconType="circle" iconSize={8} formatter={(v) => <span className="text-xs text-muted-foreground">{v}</span>} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* 연령대 비율 */}
              {stats.ageData.length > 0 && (
                <div className="bg-card border border-border rounded-xl p-4">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">활성 회원 연령대</p>
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie data={stats.ageData} dataKey="value" cx="50%" cy="50%" outerRadius={60} innerRadius={30} paddingAngle={2}>
                        {stats.ageData.map((_, i) => <Cell key={i} fill={AGE_COLORS[i % AGE_COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v: any) => [`${v}명`, ""]} />
                      <Legend iconType="circle" iconSize={8} formatter={(v) => <span className="text-xs text-muted-foreground">{v}</span>} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          )}
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
