import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  UserPlus, ChevronRight, Search, AlertCircle, Dumbbell, Clock, XCircle,
  CheckSquare, Square, CalendarPlus, X,
} from "lucide-react";
import { differenceInDays } from "date-fns";
import { toast } from "sonner";

const gradeLabels: Record<string, string> = {
  basic: "기본",
  premium: "프리미엄",
  vip: "VIP",
};

const statusColors: Record<string, string> = {
  active: "bg-green-500/20 text-green-400 border-green-500/30",
  paused: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
};

type StatusFilter = "all" | "active" | "paused";
type GradeFilter = "all" | "basic" | "premium" | "vip";
type SpecialFilter = "none" | "unpaid" | "low_sessions" | "expiring" | "expired";

const EXTEND_PRESETS = [30, 60, 90, 180];

export default function Members() {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [gradeFilter, setGradeFilter] = useState<GradeFilter>("all");
  const [specialFilter, setSpecialFilter] = useState<SpecialFilter>("none");

  // 다중 선택 모드
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // 만료일 연장 다이얼로그
  const [extendOpen, setExtendOpen] = useState(false);
  const [extendDays, setExtendDays] = useState(30);
  const [extendCustom, setExtendCustom] = useState("");

  const { data: members, isLoading, refetch } = trpc.members.list.useQuery();
  const { data: ptPackages } = trpc.pt.list.useQuery();

  const bulkExtendMutation = trpc.members.bulkExtend.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.updated}명의 만료일이 연장되었습니다.`);
      setExtendOpen(false);
      setSelectMode(false);
      setSelectedIds(new Set());
      refetch();
    },
    onError: () => toast.error("연장 중 오류가 발생했습니다."),
  });

  const today = new Date();

  const remainingMap: Record<number, number> = {};
  ptPackages?.forEach((pkg) => {
    if (pkg.status === "active") {
      remainingMap[pkg.memberId] = (remainingMap[pkg.memberId] ?? 0) + (pkg.totalSessions - pkg.usedSessions);
    }
  });

  const unpaidSet = new Set<number>(
    ptPackages?.filter((pkg) => pkg.unpaidAmount && pkg.unpaidAmount > 0).map((pkg) => pkg.memberId) ?? []
  );

  const counts = {
    unpaid: members?.filter((m) => unpaidSet.has(m.id)).length ?? 0,
    lowSessions: members?.filter((m) => {
      const r = remainingMap[m.id];
      return r !== undefined && r <= 3;
    }).length ?? 0,
    expiring: members?.filter((m) => {
      const d = m.membershipEnd ? differenceInDays(new Date(m.membershipEnd), today) : null;
      return d !== null && d >= 0 && d <= 7;
    }).length ?? 0,
    expired: members?.filter((m) => {
      const d = m.membershipEnd ? differenceInDays(new Date(m.membershipEnd), today) : null;
      return d !== null && d < 0;
    }).length ?? 0,
  };

  const filtered = members?.filter((m) => {
    const matchSearch =
      m.name.includes(search) || (m.phone && m.phone.includes(search));
    const matchStatus = statusFilter === "all" || m.status === statusFilter;
    const matchGrade = gradeFilter === "all" || m.grade === gradeFilter;

    const daysLeft = m.membershipEnd
      ? differenceInDays(new Date(m.membershipEnd), today)
      : null;
    const remaining = remainingMap[m.id];

    let matchSpecial = true;
    if (specialFilter === "unpaid") matchSpecial = unpaidSet.has(m.id);
    else if (specialFilter === "low_sessions")
      matchSpecial = remaining !== undefined && remaining <= 3;
    else if (specialFilter === "expiring")
      matchSpecial = daysLeft !== null && daysLeft >= 0 && daysLeft <= 7;
    else if (specialFilter === "expired")
      matchSpecial = daysLeft !== null && daysLeft < 0;

    return matchSearch && matchStatus && matchGrade && matchSpecial;
  });

  const toggleSpecial = (f: SpecialFilter) =>
    setSpecialFilter((prev) => (prev === f ? "none" : f));

  const toggleSelect = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (!filtered) return;
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((m) => m.id)));
    }
  };

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelectedIds(new Set());
  };

  const effectiveDays = extendCustom ? parseInt(extendCustom) || 0 : extendDays;

  const handleExtend = () => {
    if (effectiveDays < 1) { toast.error("연장 일수를 입력해주세요."); return; }
    bulkExtendMutation.mutate({ memberIds: Array.from(selectedIds), days: effectiveDays });
  };

  return (
    <div className="space-y-4 pb-32">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">회원 관리</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            총 {members?.length ?? 0}명
            {filtered && filtered.length !== members?.length && (
              <span className="text-primary ml-1">· 필터 {filtered.length}명</span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          {selectMode ? (
            <Button size="sm" variant="ghost" onClick={exitSelectMode} className="gap-1.5 text-muted-foreground">
              <X className="h-4 w-4" />
              취소
            </Button>
          ) : (
            <>
              <Button size="sm" variant="outline" onClick={() => setSelectMode(true)} className="gap-1.5">
                <CheckSquare className="h-4 w-4" />
                선택
              </Button>
              <Button size="sm" onClick={() => setLocation("/members/new")} className="gap-1.5">
                <UserPlus className="h-4 w-4" />
                신규 등록
              </Button>
            </>
          )}
        </div>
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

      {/* 특수 필터 */}
      <div className="grid grid-cols-2 gap-2">
        {[
          {
            key: "unpaid" as SpecialFilter,
            label: "미수금",
            count: counts.unpaid,
            icon: <AlertCircle className="h-3.5 w-3.5" />,
            activeClass: "bg-orange-500/20 text-orange-400 border-orange-500/40",
            inactiveClass: "text-orange-400/70 border-orange-500/20 hover:border-orange-500/40",
          },
          {
            key: "low_sessions" as SpecialFilter,
            label: "PT 3회 이하",
            count: counts.lowSessions,
            icon: <Dumbbell className="h-3.5 w-3.5" />,
            activeClass: "bg-primary/20 text-primary border-primary/40",
            inactiveClass: "text-primary/60 border-primary/20 hover:border-primary/40",
          },
          {
            key: "expiring" as SpecialFilter,
            label: "만료 임박 (7일)",
            count: counts.expiring,
            icon: <Clock className="h-3.5 w-3.5" />,
            activeClass: "bg-yellow-500/20 text-yellow-400 border-yellow-500/40",
            inactiveClass: "text-yellow-400/70 border-yellow-500/20 hover:border-yellow-500/40",
          },
          {
            key: "expired" as SpecialFilter,
            label: "만료됨",
            count: counts.expired,
            icon: <XCircle className="h-3.5 w-3.5" />,
            activeClass: "bg-red-500/20 text-red-400 border-red-500/40",
            inactiveClass: "text-red-400/70 border-red-500/20 hover:border-red-500/40",
          },
        ].map((f) => (
          <button
            key={f.key}
            onClick={() => toggleSpecial(f.key)}
            className={`flex items-center justify-between px-3 py-2 rounded-lg border text-xs font-medium transition-colors ${
              specialFilter === f.key ? f.activeClass : `bg-card ${f.inactiveClass}`
            }`}
          >
            <span className="flex items-center gap-1.5">
              {f.icon}
              {f.label}
            </span>
            <span className={`text-base font-bold ${specialFilter === f.key ? "" : "opacity-60"}`}>
              {f.count}
            </span>
          </button>
        ))}
      </div>

      {/* 상태 · 등급 필터 */}
      <div className="space-y-2">
        <div className="flex gap-1.5 flex-wrap">
          {(["all", "active", "paused"] as StatusFilter[]).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1 rounded-full text-xs border transition-colors ${
                statusFilter === s
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border text-muted-foreground hover:border-primary/40"
              }`}
            >
              {s === "all" ? "전체 상태" : s === "active" ? "활성" : "정지"}
            </button>
          ))}
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {(["all", "basic", "premium", "vip"] as GradeFilter[]).map((g) => (
            <button
              key={g}
              onClick={() => setGradeFilter(g)}
              className={`px-3 py-1 rounded-full text-xs border transition-colors ${
                gradeFilter === g
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border text-muted-foreground hover:border-primary/40"
              }`}
            >
              {g === "all" ? "전체 등급" : gradeLabels[g]}
            </button>
          ))}
        </div>
      </div>

      {/* 선택 모드: 전체 선택 */}
      {selectMode && filtered && filtered.length > 0 && (
        <button
          onClick={toggleSelectAll}
          className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          {selectedIds.size === filtered.length ? (
            <CheckSquare className="h-4 w-4 text-primary" />
          ) : (
            <Square className="h-4 w-4" />
          )}
          전체 선택 ({filtered.length}명)
        </button>
      )}

      {/* 회원 목록 */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-20 rounded-lg bg-card border border-border animate-pulse" />
          ))}
        </div>
      ) : filtered?.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-sm">
            {search || specialFilter !== "none"
              ? "조건에 맞는 회원이 없습니다."
              : "등록된 회원이 없습니다."}
          </p>
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
            const isLowSessions = remainingSessions !== undefined && remainingSessions <= 3;
            const isSelected = selectedIds.has(member.id);

            return (
              <button
                key={member.id}
                onClick={selectMode
                  ? (e) => toggleSelect(member.id, e)
                  : () => setLocation(`/members/${member.id}`)
                }
                className={`w-full text-left p-4 rounded-lg bg-card border transition-colors ${
                  selectMode
                    ? isSelected
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-primary/30"
                    : isExpiringSoon
                    ? "border-yellow-500/40 hover:border-primary/50"
                    : isExpired
                    ? "border-red-500/30 hover:border-primary/50"
                    : hasUnpaid
                    ? "border-orange-500/30 hover:border-primary/50"
                    : "border-border hover:border-primary/50"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    {selectMode && (
                      <div className="shrink-0">
                        {isSelected ? (
                          <CheckSquare className="h-5 w-5 text-primary" />
                        ) : (
                          <Square className="h-5 w-5 text-muted-foreground" />
                        )}
                      </div>
                    )}
                    {!selectMode && (
                      <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                        {member.name.charAt(0)}
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="font-medium text-foreground">{member.name}</p>
                        <span
                          className={`text-xs px-1.5 py-0.5 rounded-full border ${
                            statusColors[member.status] ?? ""
                          }`}
                        >
                          {member.status === "active" ? "활성" : "정지"}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {gradeLabels[member.grade]}
                        </span>
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
                        {hasUnpaid && (
                          <span className="text-xs px-1.5 py-0.5 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/30">
                            미수금
                          </span>
                        )}
                        {isLowSessions && (
                          <span className="text-xs px-1.5 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/30">
                            PT {remainingSessions}회
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-xs text-muted-foreground truncate">
                          {member.phone ?? member.email ?? "연락처 없음"}
                        </p>
                        {remainingSessions !== undefined && !isLowSessions && (
                          <span className="text-xs text-primary shrink-0">
                            PT {remainingSessions}회
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  {!selectMode && <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 ml-2" />}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* 선택 모드 하단 액션 바 */}
      {selectMode && selectedIds.size > 0 && (
        <div className="fixed bottom-20 md:bottom-4 left-0 right-0 flex justify-center z-40 px-4">
          <div className="bg-card border border-border rounded-xl shadow-xl px-4 py-3 flex items-center gap-3 w-full max-w-md">
            <p className="text-sm font-medium flex-1">
              <span className="text-primary font-bold">{selectedIds.size}명</span> 선택됨
            </p>
            <Button
              size="sm"
              onClick={() => { setExtendDays(30); setExtendCustom(""); setExtendOpen(true); }}
              className="gap-1.5"
            >
              <CalendarPlus className="h-4 w-4" />
              만료일 연장
            </Button>
          </div>
        </div>
      )}

      {/* 만료일 연장 다이얼로그 */}
      <Dialog open={extendOpen} onOpenChange={setExtendOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>만료일 일괄 연장</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              선택한 <span className="font-medium text-foreground">{selectedIds.size}명</span>의 현재 만료일에서 N일을 연장합니다.
            </p>
            <div className="flex flex-wrap gap-2">
              {EXTEND_PRESETS.map((d) => (
                <button
                  key={d}
                  onClick={() => { setExtendDays(d); setExtendCustom(""); }}
                  className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                    extendDays === d && !extendCustom
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border text-muted-foreground hover:border-primary/40"
                  }`}
                >
                  {d}일
                </button>
              ))}
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1.5">직접 입력</p>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  placeholder="일수 입력"
                  value={extendCustom}
                  onChange={(e) => setExtendCustom(e.target.value)}
                  className="w-32"
                />
                <span className="text-sm text-muted-foreground">일</span>
              </div>
            </div>
            {effectiveDays > 0 && (
              <p className="text-sm text-primary font-medium">
                현재 만료일 기준 +{effectiveDays}일 연장
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExtendOpen(false)}>취소</Button>
            <Button
              onClick={handleExtend}
              disabled={effectiveDays < 1 || bulkExtendMutation.isPending}
            >
              {bulkExtendMutation.isPending ? "처리 중..." : `${selectedIds.size}명 연장`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
