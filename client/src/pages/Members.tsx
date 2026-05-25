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
  CheckSquare, Square, CalendarPlus, X, ArrowRightLeft, Copy, Check,
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

  // 양도 모달
  const [transferMember, setTransferMember] = useState<{ id: number; name: string; phone: string | null } | null>(null);

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
      return r !== undefined && r <= 6;
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
      matchSpecial = remaining !== undefined && remaining <= 6;
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
              <Button size="sm" onClick={() => setLocation("/members/re-register")} className="gap-1.5">
                <UserPlus className="h-4 w-4" />
                재등록
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
            label: "PT 6회 이하",
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
            const isLowSessions = remainingSessions !== undefined && remainingSessions <= 6;
            const isSelected = selectedIds.has(member.id);

            return (
              <div
                key={member.id}
                onClick={selectMode
                  ? (e) => toggleSelect(member.id, e as any)
                  : () => setLocation(`/members/${member.id}`)
                }
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === "Enter" && setLocation(`/members/${member.id}`)}
                className={`w-full text-left p-4 rounded-lg bg-card border transition-colors cursor-pointer ${
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
                            종료
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
                  {!selectMode && (
                    <div className="flex items-center gap-1.5 shrink-0 ml-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); setTransferMember({ id: member.id, name: member.name, phone: member.phone ?? null }); }}
                        className="text-xs px-2 py-1 rounded-md border border-orange-400/50 text-orange-400 hover:bg-orange-400/10 transition-colors"
                      >
                        양도
                      </button>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                </div>
              </div>
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

      {/* 양도 모달 */}
      {transferMember && (
        <TransferModal
          member={transferMember}
          allMembers={(members ?? []).map((m) => ({ id: m.id, name: m.name, phone: m.phone ?? null }))}
          ptPackages={(ptPackages ?? []).filter((p) => p.memberId === transferMember.id && p.status === "active")}
          onClose={() => setTransferMember(null)}
        />
      )}
    </div>
  );
}

// ── 양도 모달 ─────────────────────────────────────────────────────────────────

type PtPkg = { id: number; packageName: string | null; totalSessions: number; usedSessions: number };
type MemberBasic = { id: number; name: string; phone: string | null };

function TransferModal({
  member,
  allMembers,
  ptPackages,
  onClose,
}: {
  member: MemberBasic;
  allMembers: MemberBasic[];
  ptPackages: PtPkg[];
  onClose: () => void;
}) {
  const [step, setStep] = useState<"item" | "transferee" | "done">("item");
  const [itemType, setItemType] = useState<"pt_package" | "membership" | "uniform" | "locker">("pt_package");
  const [selectedPkgId, setSelectedPkgId] = useState<number | null>(ptPackages[0]?.id ?? null);
  const [itemDesc, setItemDesc] = useState("");
  const [transfereeType, setTransfeeType] = useState<"existing" | "new">("existing");
  const [search, setSearch] = useState("");
  const [selectedTransferee, setSelectedTransferee] = useState<MemberBasic | null>(null);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newBirth, setNewBirth] = useState("");
  const [contractUrl, setContractUrl] = useState("");
  const [copied, setCopied] = useState(false);

  const createTransfer = trpc.transfer.createTransfer.useMutation({
    onSuccess: (data) => {
      setContractUrl(window.location.origin + data.contractUrl);
      setStep("done");
    },
    onError: (e) => toast.error(e.message),
  });

  const filteredMembers = allMembers.filter((m) =>
    m.id !== member.id &&
    (m.name.includes(search) || (m.phone && m.phone.includes(search)))
  );

  function buildItemDescription() {
    if (itemType === "pt_package" && selectedPkgId) {
      const pkg = ptPackages.find((p) => p.id === selectedPkgId);
      if (pkg) {
        const rem = pkg.totalSessions - pkg.usedSessions;
        return `PT 패키지 - ${pkg.packageName ?? "패키지"} (잔여 ${rem}회)`;
      }
    }
    const fallback: Record<string, string> = { pt_package: "PT 패키지", membership: "헬스 회원권", uniform: "운동복", locker: "락커" };
    return itemDesc || fallback[itemType] || "";
  }

  function handleCreate() {
    const desc = buildItemDescription();
    if (!desc) { toast.error("항목 설명을 입력해주세요"); return; }
    const isExisting = transfereeType === "existing";
    if (isExisting && !selectedTransferee) { toast.error("양수인을 선택해주세요"); return; }
    if (!isExisting && !newName.trim()) { toast.error("양수인 이름을 입력해주세요"); return; }

    createTransfer.mutate({
      transferorMemberId: member.id,
      itemType,
      itemId: itemType === "pt_package" ? (selectedPkgId ?? undefined) : undefined,
      itemDescription: desc,
      transfereeMemberId: isExisting ? selectedTransferee!.id : undefined,
      transfereeName: isExisting ? selectedTransferee!.name : newName.trim(),
      transfereePhone: isExisting ? (selectedTransferee!.phone ?? undefined) : (newPhone.trim() || undefined),
      transfereeBirthDate: !isExisting ? (newBirth || undefined) : undefined,
    });
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(contractUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success("링크 복사됨");
    } catch {
      toast.error("복사 실패");
    }
  }

  function shareKakao() {
    // 카카오톡 공유 (Web Share API 폴백)
    if (navigator.share) {
      navigator.share({ title: "자이언트짐 양도양수 계약서", url: contractUrl });
    } else {
      copyLink();
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-background rounded-2xl w-full max-w-md max-h-[85vh] overflow-y-auto shadow-2xl">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border sticky top-0 bg-background">
          <div className="flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5 text-orange-400" />
            <h2 className="font-bold">양도양수 계약서 작성</h2>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* 양도인 정보 */}
          <div className="bg-muted/40 rounded-xl p-3 text-sm">
            <span className="text-muted-foreground">양도인: </span>
            <span className="font-semibold">{member.name}</span>
            {member.phone && <span className="text-muted-foreground ml-2">{member.phone}</span>}
          </div>

          {/* STEP 1: 양도 항목 */}
          {step === "item" && (
            <div className="space-y-4">
              <div>
                <label className="text-xs text-muted-foreground mb-2 block">양도 항목 유형</label>
                <div className="grid grid-cols-2 gap-2">
                  {(["pt_package", "membership", "uniform", "locker"] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setItemType(t)}
                      className={`py-2.5 rounded-xl text-sm font-medium border transition-colors ${
                        itemType === t ? "border-orange-400 bg-orange-400/10 text-orange-400" : "border-border text-muted-foreground hover:border-orange-400/40"
                      }`}
                    >
                      {{ pt_package: "PT권", membership: "헬스권", uniform: "운동복", locker: "락커" }[t]}
                    </button>
                  ))}
                </div>
              </div>

              {itemType === "pt_package" && ptPackages.length > 0 && (
                <div>
                  <label className="text-xs text-muted-foreground mb-2 block">패키지 선택</label>
                  <div className="space-y-2">
                    {ptPackages.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => setSelectedPkgId(p.id)}
                        className={`w-full text-left p-3 rounded-xl border text-sm transition-colors ${
                          selectedPkgId === p.id ? "border-orange-400 bg-orange-400/10" : "border-border hover:border-orange-400/40"
                        }`}
                      >
                        <span className="font-medium">{p.packageName ?? "PT 패키지"}</span>
                        <span className="text-muted-foreground ml-2">잔여 {p.totalSessions - p.usedSessions}회</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {itemType !== "pt_package" && (
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">항목 설명 (선택)</label>
                  <input
                    className="w-full border border-border rounded-xl px-3 py-2.5 text-sm bg-background"
                    placeholder={`예: 헬스 회원권 2025.12까지`}
                    value={itemDesc}
                    onChange={(e) => setItemDesc(e.target.value)}
                  />
                </div>
              )}

              <button
                onClick={() => setStep("transferee")}
                className="w-full py-3 rounded-xl bg-orange-500 text-white font-medium text-sm hover:bg-orange-600"
              >
                다음 — 양수인 정보 입력
              </button>
            </div>
          )}

          {/* STEP 2: 양수인 */}
          {step === "transferee" && (
            <div className="space-y-4">
              <div className="flex gap-2">
                <button
                  onClick={() => setTransfeeType("existing")}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition-colors ${
                    transfereeType === "existing" ? "border-orange-400 bg-orange-400/10 text-orange-400" : "border-border text-muted-foreground"
                  }`}
                >
                  기존 회원
                </button>
                <button
                  onClick={() => setTransfeeType("new")}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition-colors ${
                    transfereeType === "new" ? "border-orange-400 bg-orange-400/10 text-orange-400" : "border-border text-muted-foreground"
                  }`}
                >
                  신규 회원
                </button>
              </div>

              {transfereeType === "existing" && (
                <div className="space-y-2">
                  <input
                    className="w-full border border-border rounded-xl px-3 py-2.5 text-sm bg-background"
                    placeholder="이름 또는 연락처로 검색"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                  <div className="max-h-48 overflow-y-auto space-y-1">
                    {filteredMembers.slice(0, 20).map((m) => (
                      <button
                        key={m.id}
                        onClick={() => setSelectedTransferee(m)}
                        className={`w-full text-left p-3 rounded-xl border text-sm transition-colors ${
                          selectedTransferee?.id === m.id ? "border-orange-400 bg-orange-400/10" : "border-border hover:border-orange-400/40"
                        }`}
                      >
                        <span className="font-medium">{m.name}</span>
                        {m.phone && <span className="text-muted-foreground ml-2">{m.phone}</span>}
                      </button>
                    ))}
                    {filteredMembers.length === 0 && search && (
                      <p className="text-xs text-muted-foreground text-center py-3">검색 결과 없음</p>
                    )}
                  </div>
                </div>
              )}

              {transfereeType === "new" && (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">양수인 이름 *</label>
                    <input className="w-full border border-border rounded-xl px-3 py-2.5 text-sm bg-background"
                      placeholder="이름" value={newName} onChange={(e) => setNewName(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">연락처</label>
                    <input className="w-full border border-border rounded-xl px-3 py-2.5 text-sm bg-background"
                      placeholder="010-0000-0000" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">생년월일</label>
                    <input type="date" className="w-full border border-border rounded-xl px-3 py-2.5 text-sm bg-background"
                      value={newBirth} onChange={(e) => setNewBirth(e.target.value)} />
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <button onClick={() => setStep("item")} className="flex-1 py-3 rounded-xl border border-border text-sm text-muted-foreground hover:bg-muted/40">
                  이전
                </button>
                <button
                  onClick={handleCreate}
                  disabled={createTransfer.isPending}
                  className="flex-1 py-3 rounded-xl bg-orange-500 text-white font-medium text-sm hover:bg-orange-600 disabled:opacity-50"
                >
                  {createTransfer.isPending ? "생성 중..." : "계약서 생성"}
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: 링크 공유 */}
          {step === "done" && (
            <div className="space-y-4">
              <div className="text-center space-y-2 py-2">
                <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center mx-auto">
                  <Check className="h-6 w-6 text-green-400" />
                </div>
                <p className="font-semibold">계약서가 생성되었습니다</p>
                <p className="text-xs text-muted-foreground">아래 링크를 양도인에게 먼저 전달하세요<br />양도인 서명 → 양수인 서명 순서로 진행됩니다</p>
              </div>

              <div className="bg-muted/40 rounded-xl p-3 text-xs text-muted-foreground break-all">
                {contractUrl}
              </div>

              <div className="space-y-2">
                <button
                  onClick={copyLink}
                  className="w-full py-3 rounded-xl border border-border text-sm font-medium flex items-center justify-center gap-2 hover:bg-muted/40"
                >
                  {copied ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
                  {copied ? "복사됨!" : "링크 복사"}
                </button>
                <button
                  onClick={shareKakao}
                  className="w-full py-3 rounded-xl bg-yellow-400 text-yellow-900 font-medium text-sm hover:bg-yellow-500"
                >
                  카카오톡으로 공유
                </button>
              </div>

              <button onClick={onClose} className="w-full py-2.5 text-sm text-muted-foreground hover:text-foreground">
                닫기
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
