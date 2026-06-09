import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Search, ChevronRight, AlertTriangle } from "lucide-react";

function getPlanBadge(plan?: string): { label: string; color: string; key: string } {
  if (plan === "elite") return { label: "ELITE", color: "bg-purple-500/20 text-purple-500 border-purple-500/30", key: "elite" };
  if (plan === "pro") return { label: "PRO", color: "bg-blue-500/20 text-blue-500 border-blue-500/30", key: "pro" };
  return { label: "FREE", color: "bg-gray-500/20 text-gray-500 border-gray-500/30", key: "free" };
}

const FILTERS = [
  { key: "all", label: "전체" },
  { key: "free", label: "FREE" },
  { key: "pro", label: "PRO" },
  { key: "elite", label: "ELITE" },
];

export default function AdminTrainers() {
  const [, setLocation] = useLocation();
  const { data: trainerList } = trpc.admin.listTrainers.useQuery();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  const riskList = useMemo(() => {
    if (!trainerList) return [];
    return trainerList.filter(t => {
      const days = t.lastLoginAt ? (Date.now() - new Date(t.lastLoginAt).getTime()) / (1000 * 60 * 60 * 24) : 999;
      return days >= 14 || t.memberCount === 0 || t.sessionCount === 0;
    });
  }, [trainerList]);

  const filtered = useMemo(() => {
    if (!trainerList) return [];
    return trainerList.filter(t => {
      const planKey = getPlanBadge((t as any).plan).key;
      const matchFilter = filter === "all" || planKey === filter;
      const q = search.toLowerCase();
      const matchSearch = !q || t.trainerName.toLowerCase().includes(q) || (t.username ?? "").toLowerCase().includes(q) || (t.phone ?? "").includes(q);
      return matchFilter && matchSearch;
    });
  }, [trainerList, search, filter]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">STEPER 관리</h1>
        <p className="text-sm text-muted-foreground mt-0.5">총 {trainerList?.length ?? 0}명</p>
      </div>

      {/* 검색 */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="이름, 아이디, 전화번호 검색"
          className="pl-9 bg-input border-border"
        />
      </div>

      {/* 필터 */}
      <div className="flex gap-1.5 flex-wrap">
        {FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              filter === f.key ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-primary/40"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* 위험군 알림 */}
      {riskList.length > 0 && filter === "all" && !search && (
        <Card className="bg-card border-orange-500/30">
          <CardContent className="p-3 space-y-1.5">
            <p className="text-xs font-semibold text-orange-400 flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5" />관리 필요 STEPER {riskList.length}명
            </p>
            {riskList.map(t => {
              const days = t.lastLoginAt ? Math.floor((Date.now() - new Date(t.lastLoginAt).getTime()) / (1000 * 60 * 60 * 24)) : null;
              const reasons = [
                days !== null && days >= 14 ? `${days}일 미접속` : null,
                t.memberCount === 0 ? "회원 없음" : null,
                t.sessionCount === 0 ? "PT 기록 없음" : null,
              ].filter(Boolean);
              return (
                <button key={t.id} onClick={() => setLocation(`/admin/trainers/${t.id}`)}
                  className="w-full flex items-center justify-between px-2.5 py-2 rounded-lg bg-orange-500/10 border border-orange-500/20 hover:border-orange-500/40 transition-colors text-left">
                  <span className="text-sm font-medium">{t.trainerName}</span>
                  <span className="text-xs text-orange-400">{reasons.join(" · ")}</span>
                </button>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* STEPER 목록 */}
      <div className="space-y-2">
        {filtered.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">STEPER가 없습니다.</p>
        )}
        {filtered.map(t => {
          const plan = getPlanBadge((t as any).plan);
          const days = t.lastLoginAt ? Math.floor((Date.now() - new Date(t.lastLoginAt).getTime()) / (1000 * 60 * 60 * 24)) : null;
          return (
            <button key={t.id} onClick={() => setLocation(`/admin/trainers/${t.id}`)}
              className="w-full text-left">
              <Card className="bg-card border-border hover:border-primary/40 transition-colors">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="text-sm font-semibold">{t.trainerName}</p>
                      <p className="text-xs text-muted-foreground">@{t.username}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${plan.color}`}>{plan.label}</span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-md bg-accent/20 py-1.5">
                      <p className="text-xs text-muted-foreground">회원</p>
                      <p className="text-sm font-bold text-blue-400">{t.memberCount}명</p>
                    </div>
                    <div className="rounded-md bg-accent/20 py-1.5">
                      <p className="text-xs text-muted-foreground">PT 세션</p>
                      <p className="text-sm font-bold text-green-400">{t.sessionCount}회</p>
                    </div>
                    <div className="rounded-md bg-accent/20 py-1.5">
                      <p className="text-xs text-muted-foreground">마지막 접속</p>
                      <p className="text-sm font-bold">{days !== null ? `${days}일 전` : "-"}</p>
                    </div>
                  </div>
                  {t.adminMemo && (
                    <p className="text-xs text-muted-foreground mt-2 px-1">📝 {t.adminMemo}</p>
                  )}
                </CardContent>
              </Card>
            </button>
          );
        })}
      </div>
    </div>
  );
}
