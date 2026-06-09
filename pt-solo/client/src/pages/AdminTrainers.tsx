import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, ChevronRight, AlertTriangle, Settings2 } from "lucide-react";
import { toast } from "sonner";

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
  const utils = trpc.useUtils();
  const { data: trainerList } = trpc.admin.listTrainers.useQuery();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  // 공통 플랜 인원 한도
  const { data: memberLimits } = trpc.fitStepPlus.admin_getMemberLimits.useQuery();
  const [limitOpen, setLimitOpen] = useState(false);
  const [limitDraft, setLimitDraft] = useState<{ free: string; pro: string; elite: string } | null>(null);
  const updateLimitsMutation = trpc.fitStepPlus.admin_updateMemberLimits.useMutation({
    onSuccess: () => {
      toast.success("플랜 인원 한도가 저장되었습니다.");
      utils.fitStepPlus.admin_getMemberLimits.invalidate();
      setLimitDraft(null);
      setLimitOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

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
      <div className="flex items-start justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold">STEPER 관리</h1>
          <p className="text-sm text-muted-foreground mt-0.5">총 {trainerList?.length ?? 0}명</p>
        </div>
        <button
          onClick={() => { setLimitOpen(v => !v); if (!limitOpen && memberLimits) setLimitDraft({ free: String(memberLimits.free), pro: String(memberLimits.pro), elite: String(memberLimits.elite) }); }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors shrink-0"
        >
          <Settings2 className="h-3.5 w-3.5" />
          플랜 인원 설정
        </button>
      </div>

      {/* 공통 플랜 인원 한도 패널 */}
      {limitOpen && (
        <Card className="bg-card border-primary/20">
          <CardContent className="p-4 space-y-3">
            <p className="text-sm font-semibold">플랜별 회원 수 한도</p>
            <p className="text-xs text-muted-foreground">변경 시 모든 STEPER에게 즉시 적용됩니다.</p>
            <div className="grid grid-cols-3 gap-3">
              {(["free", "pro", "elite"] as const).map(plan => (
                <div key={plan} className="space-y-1">
                  <label className={`text-xs font-bold ${plan === "elite" ? "text-purple-500" : plan === "pro" ? "text-blue-500" : "text-gray-500"}`}>
                    {plan.toUpperCase()}
                  </label>
                  <div className="flex items-center gap-1">
                    <Input
                      type="number" min={1} max={9999}
                      value={limitDraft?.[plan] ?? String(memberLimits?.[plan] ?? "")}
                      onChange={e => setLimitDraft(prev => ({
                        free: String(memberLimits?.free ?? 7),
                        pro: String(memberLimits?.pro ?? 15),
                        elite: String(memberLimits?.elite ?? 35),
                        ...prev,
                        [plan]: e.target.value,
                      }))}
                      className="h-9 text-sm bg-input border-border"
                    />
                    <span className="text-xs text-muted-foreground shrink-0">명</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="flex-1" onClick={() => { setLimitOpen(false); setLimitDraft(null); }}>취소</Button>
              <Button size="sm" className="flex-1"
                disabled={updateLimitsMutation.isPending || !limitDraft}
                onClick={() => {
                  if (!limitDraft) return;
                  updateLimitsMutation.mutate({
                    free: parseInt(limitDraft.free) || (memberLimits?.free ?? 7),
                    pro: parseInt(limitDraft.pro) || (memberLimits?.pro ?? 15),
                    elite: parseInt(limitDraft.elite) || (memberLimits?.elite ?? 35),
                  });
                }}>
                {updateLimitsMutation.isPending ? "저장 중..." : "저장"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

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
