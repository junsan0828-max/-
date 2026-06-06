import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Search, ChevronRight, Dumbbell, Calendar, AlertCircle,
  Clock, XCircle, CheckSquare, Square, CalendarPlus, X, UserPlus,
} from "lucide-react";
import { differenceInDays } from "date-fns";
import { toast } from "sonner";
import TabBanner from "@/components/TabBanner";

const gradeLabels: Record<string, string> = {
  basic: "기본",
  vip: "VIP",
};

const statusColors: Record<string, string> = {
  active: "bg-green-500/20 text-green-400 border-green-500/30",
  paused: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
};

const EXTEND_PRESETS = [30, 60, 90, 180];

type SpecialFilter = "none" | "unpaid" | "low_sessions" | "expiring" | "expired";

const PAYMENT_METHODS = ["카드", "현금", "계좌이체", "지역화폐"] as const;

const EMPTY_FORM = {
  name: "",
  phone: "",
  birthDate: "",
  gender: "" as "male" | "female" | "other" | "",
  grade: "basic" as "basic" | "vip",
  status: "active" as "active" | "paused",
  membershipStart: "",
  membershipEnd: "",
  visitRoute: "",
  profileNote: "",
  // PT·결제
  ptProgram: "",
  ptSessions: "",
  paymentAmount: "",
  unpaidAmount: "",
  paymentMethod: "" as "" | "현금영수증" | "이체" | "지역화폐" | "카드",
  paymentDate: new Date().toISOString().substring(0, 10),
  paymentMemo: "",
};

function RegisterSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const utils = trpc.useUtils();
  const [form, setForm] = useState(EMPTY_FORM);
  const [nameError, setNameError] = useState("");

  const createMutation = trpc.members.create.useMutation({
    onSuccess: () => {
      toast.success("회원이 등록되었습니다.");
      setForm(EMPTY_FORM);
      setNameError("");
      utils.members.list.invalidate();
      onClose();
    },
    onError: (e) => toast.error(e.message || "등록 실패"),
  });

  const hasPt = !!form.ptSessions;

  function handleSubmit() {
    if (!form.name.trim()) { setNameError("이름을 입력해주세요."); return; }
    setNameError("");
    createMutation.mutate({
      name: form.name.trim(),
      phone: form.phone || undefined,
      birthDate: form.birthDate || undefined,
      gender: form.gender || undefined,
      grade: form.grade,
      status: form.status,
      membershipStart: form.membershipStart || undefined,
      membershipEnd: form.membershipEnd || undefined,
      visitRoute: form.visitRoute || undefined,
      profileNote: form.profileNote || undefined,
      ptProgram: form.ptProgram || undefined,
      ptSessions: form.ptSessions || undefined,
      paymentAmount: form.paymentAmount ? Number(form.paymentAmount) : undefined,
      unpaidAmount: form.unpaidAmount ? Number(form.unpaidAmount) : undefined,
      paymentMethod: form.paymentMethod || undefined,
      paymentDate: hasPt ? form.paymentDate : undefined,
      paymentMemo: form.paymentMemo || undefined,
    });
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative bg-card rounded-t-3xl w-full max-h-[90vh] flex flex-col shadow-2xl">
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-border" />
        </div>
        <div className="px-5 pt-1 pb-4 flex items-center justify-between shrink-0 border-b border-border">
          <div>
            <h2 className="text-base font-bold">회원 등록</h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">결제 없이 등록 · 매출에 미포함</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-muted">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        <div className="px-5 py-5 pb-10 space-y-5 overflow-y-auto flex-1">
          <div className="space-y-3">
            <p className="text-xs font-semibold text-foreground">기본 정보</p>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">이름 <span className="text-primary">*</span></Label>
              <Input
                placeholder="홍길동"
                value={form.name}
                onChange={e => { setForm(p => ({ ...p, name: e.target.value })); setNameError(""); }}
                className={nameError ? "border-red-500" : ""}
              />
              {nameError && <p className="text-xs text-red-500">{nameError}</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">연락처</Label>
                <Input placeholder="010-0000-0000" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">생년월일</Label>
                <Input type="date" value={form.birthDate} onChange={e => setForm(p => ({ ...p, birthDate: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">성별</Label>
                <Select value={form.gender} onValueChange={v => setForm(p => ({ ...p, gender: v as any }))}>
                  <SelectTrigger><SelectValue placeholder="선택" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">남성</SelectItem>
                    <SelectItem value="female">여성</SelectItem>
                    <SelectItem value="other">기타</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">등급</Label>
                <Select value={form.grade} onValueChange={v => setForm(p => ({ ...p, grade: v as any }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="basic">기본</SelectItem>
                    <SelectItem value="vip">VIP</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">상태</Label>
              <Select value={form.status} onValueChange={v => setForm(p => ({ ...p, status: v as any }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">활성</SelectItem>
                  <SelectItem value="paused">정지</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-xs font-semibold text-foreground">회원권</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">시작일</Label>
                <Input type="date" value={form.membershipStart} onChange={e => setForm(p => ({ ...p, membershipStart: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">종료일</Label>
                <Input type="date" value={form.membershipEnd} onChange={e => setForm(p => ({ ...p, membershipEnd: e.target.value }))} />
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-xs font-semibold text-foreground">기타</p>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">방문 경로</Label>
              <Input placeholder="SNS, 지인 소개 등" value={form.visitRoute} onChange={e => setForm(p => ({ ...p, visitRoute: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">메모</Label>
              <Input placeholder="특이사항" value={form.profileNote} onChange={e => setForm(p => ({ ...p, profileNote: e.target.value }))} />
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-xs font-semibold text-foreground">PT 패키지 · 결제 <span className="text-muted-foreground font-normal">(선택)</span></p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">프로그램명</Label>
                <Input placeholder="예: 피티" value={form.ptProgram} onChange={e => setForm(p => ({ ...p, ptProgram: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">횟수</Label>
                <Input type="number" placeholder="0" value={form.ptSessions} onChange={e => setForm(p => ({ ...p, ptSessions: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">결제금액 (원)</Label>
                <Input type="number" placeholder="0" value={form.paymentAmount} onChange={e => setForm(p => ({ ...p, paymentAmount: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">미수금 (원)</Label>
                <Input type="number" placeholder="0" value={form.unpaidAmount} onChange={e => setForm(p => ({ ...p, unpaidAmount: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">결제 방법</Label>
              <div className="grid grid-cols-4 gap-1.5">
                {PAYMENT_METHODS.map(m => (
                  <button key={m} type="button"
                    onClick={() => setForm(p => ({ ...p, paymentMethod: p.paymentMethod === m ? "" : m as any }))}
                    className={`py-2 rounded-lg text-xs font-medium border transition-colors ${form.paymentMethod === m ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-muted-foreground"}`}>
                    {m}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">결제일</Label>
              <Input type="date" value={form.paymentDate} onChange={e => setForm(p => ({ ...p, paymentDate: e.target.value }))} />
            </div>
          </div>

          <div className={`p-3 rounded-xl border text-xs ${hasPt ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-muted/50 border-border text-muted-foreground"}`}>
            {hasPt
              ? "PT 패키지 정보가 입력되어 매출 통계에 반영됩니다."
              : "PT 횟수를 입력하면 매출 통계에 반영됩니다. 입력하지 않으면 미포함입니다."}
          </div>

          <Button className="w-full" disabled={createMutation.isPending} onClick={handleSubmit}>
            {createMutation.isPending ? "등록 중..." : "등록 완료"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function MembersTab() {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "paused">("all");
  const [specialFilter, setSpecialFilter] = useState<SpecialFilter>("none");
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [extendOpen, setExtendOpen] = useState(false);
  const [extendDays, setExtendDays] = useState(30);
  const [extendCustom, setExtendCustom] = useState("");
  const [showRegister, setShowRegister] = useState(false);

  const utils = trpc.useUtils();
  const { data: members, isLoading } = trpc.members.list.useQuery();
  const { data: ptPackages } = trpc.pt.list.useQuery();

  const bulkExtendMutation = trpc.members.bulkExtend.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.updated}명의 만료일이 연장되었습니다.`);
      setExtendOpen(false);
      setSelectMode(false);
      setSelectedIds(new Set());
      utils.members.list.invalidate();
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
    const matchSearch = m.name.includes(search) || (m.phone && m.phone.includes(search));
    const matchStatus = statusFilter === "all" || m.status === statusFilter;
    const daysLeft = m.membershipEnd ? differenceInDays(new Date(m.membershipEnd), today) : null;
    const remaining = remainingMap[m.id];
    let matchSpecial = true;
    if (specialFilter === "unpaid") matchSpecial = unpaidSet.has(m.id);
    else if (specialFilter === "low_sessions") matchSpecial = remaining !== undefined && remaining <= 3;
    else if (specialFilter === "expiring") matchSpecial = daysLeft !== null && daysLeft >= 0 && daysLeft <= 7;
    else if (specialFilter === "expired") matchSpecial = daysLeft !== null && daysLeft < 0;
    return matchSearch && matchStatus && matchSpecial;
  });

  const toggleSpecial = (f: SpecialFilter) => setSpecialFilter((prev) => (prev === f ? "none" : f));

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
    if (selectedIds.size === filtered.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filtered.map((m) => m.id)));
  };

  const effectiveDays = extendCustom ? parseInt(extendCustom) || 0 : extendDays;

  const handleExtend = () => {
    if (effectiveDays < 1) { toast.error("연장 일수를 입력해주세요."); return; }
    bulkExtendMutation.mutate({ memberIds: Array.from(selectedIds), days: effectiveDays });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          총 {members?.length ?? 0}명
          {filtered && filtered.length !== members?.length && (
            <span className="text-primary ml-1">· 필터 {filtered.length}명</span>
          )}
        </p>
        <div className="flex gap-2">
          {selectMode ? (
            <Button size="sm" variant="ghost" onClick={() => { setSelectMode(false); setSelectedIds(new Set()); }} className="gap-1.5 text-muted-foreground">
              <X className="h-4 w-4" />취소
            </Button>
          ) : (
            <>
              <Button size="sm" variant="outline" onClick={() => setSelectMode(true)} className="gap-1.5">
                <CheckSquare className="h-4 w-4" />선택
              </Button>
              <Button size="sm" onClick={() => setShowRegister(true)} className="gap-1.5">
                <UserPlus className="h-4 w-4" />회원 등록
              </Button>
            </>
          )}
        </div>
      </div>

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
          { key: "unpaid" as SpecialFilter, label: "미수금", count: counts.unpaid, icon: <AlertCircle className="h-3.5 w-3.5" />, activeClass: "bg-orange-500/20 text-orange-400 border-orange-500/40", inactiveClass: "text-orange-400/70 border-orange-500/20 hover:border-orange-500/40" },
          { key: "low_sessions" as SpecialFilter, label: "수업 3회 이하", count: counts.lowSessions, icon: <Dumbbell className="h-3.5 w-3.5" />, activeClass: "bg-primary/20 text-primary border-primary/40", inactiveClass: "text-primary/60 border-primary/20 hover:border-primary/40" },
          { key: "expiring" as SpecialFilter, label: "만료 임박 (7일)", count: counts.expiring, icon: <Clock className="h-3.5 w-3.5" />, activeClass: "bg-yellow-500/20 text-yellow-400 border-yellow-500/40", inactiveClass: "text-yellow-400/70 border-yellow-500/20 hover:border-yellow-500/40" },
          { key: "expired" as SpecialFilter, label: "만료됨", count: counts.expired, icon: <XCircle className="h-3.5 w-3.5" />, activeClass: "bg-red-500/20 text-red-400 border-red-500/40", inactiveClass: "text-red-400/70 border-red-500/20 hover:border-red-500/40" },
        ].map((f) => (
          <button
            key={f.key}
            onClick={() => toggleSpecial(f.key)}
            className={`flex items-center justify-between px-3 py-2 rounded-lg border text-xs font-medium transition-colors ${
              specialFilter === f.key ? f.activeClass : `bg-card ${f.inactiveClass}`
            }`}
          >
            <span className="flex items-center gap-1.5">{f.icon}{f.label}</span>
            <span className={`text-base font-bold ${specialFilter === f.key ? "" : "opacity-60"}`}>{f.count}</span>
          </button>
        ))}
      </div>

      {/* 상태 필터 */}
      <div className="flex gap-1.5 flex-wrap">
        {(["all", "active", "paused"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1 rounded-full text-xs border transition-colors ${
              statusFilter === s
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border text-muted-foreground hover:border-primary/40"
            }`}
          >
            {s === "all" ? "전체" : s === "active" ? "활성" : "정지"}
          </button>
        ))}
      </div>

      {selectMode && filtered && filtered.length > 0 && (
        <button onClick={toggleSelectAll} className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors">
          {selectedIds.size === filtered.length ? <CheckSquare className="h-4 w-4 text-primary" /> : <Square className="h-4 w-4" />}
          전체 선택 ({filtered.length}명)
        </button>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-20 rounded-lg bg-card border border-border animate-pulse" />
          ))}
        </div>
      ) : filtered?.length === 0 ? (
        <div className="text-center py-12 space-y-3 text-muted-foreground">
          <p className="text-sm">{search || specialFilter !== "none" ? "조건에 맞는 회원이 없습니다." : "등록된 회원이 없습니다."}</p>
          {!search && specialFilter === "none" && (
            <Button size="sm" variant="outline" onClick={() => setShowRegister(true)} className="gap-1.5">
              <UserPlus className="h-4 w-4" />회원 등록하기
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered?.map((member) => {
            const daysLeft = member.membershipEnd ? differenceInDays(new Date(member.membershipEnd), today) : null;
            const isExpiringSoon = daysLeft !== null && daysLeft >= 0 && daysLeft <= 7;
            const isExpired = daysLeft !== null && daysLeft < 0;
            const hasUnpaid = unpaidSet.has(member.id);
            const remainingSessions = remainingMap[member.id];
            const isLowSessions = remainingSessions !== undefined && remainingSessions <= 3;
            const isSelected = selectedIds.has(member.id);

            // PT packages for this member
            const memberPkgs = ptPackages?.filter((p) => p.memberId === member.id && p.status === "active") ?? [];

            return (
              <button
                key={member.id}
                onClick={selectMode ? (e) => toggleSelect(member.id, e) : () => setLocation(`/members/${member.id}`)}
                className={`w-full text-left p-4 rounded-lg bg-card border transition-colors ${
                  selectMode
                    ? isSelected ? "border-primary bg-primary/10" : "border-border hover:border-primary/30"
                    : isExpiringSoon ? "border-yellow-500/40 hover:border-primary/50"
                    : isExpired ? "border-red-500/30 hover:border-primary/50"
                    : hasUnpaid ? "border-orange-500/30 hover:border-primary/50"
                    : "border-border hover:border-primary/50"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    {selectMode && (
                      <div className="shrink-0 mt-0.5">
                        {isSelected ? <CheckSquare className="h-5 w-5 text-primary" /> : <Square className="h-5 w-5 text-muted-foreground" />}
                      </div>
                    )}
                    {!selectMode && (
                      <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                        {member.name.charAt(0)}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="font-medium text-foreground">{member.name}</p>
                        <span className={`text-xs px-1.5 py-0.5 rounded-full border ${statusColors[member.status] ?? ""}`}>
                          {member.status === "active" ? "활성" : "정지"}
                        </span>
                        {gradeLabels[member.grade] && member.grade !== "basic" && (
                          <span className="text-xs text-muted-foreground">{gradeLabels[member.grade]}</span>
                        )}
                        {isExpiringSoon && (
                          <span className="text-xs px-1.5 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">D-{daysLeft}</span>
                        )}
                        {isExpired && (
                          <span className="text-xs px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30">만료</span>
                        )}
                        {hasUnpaid && (
                          <span className="text-xs px-1.5 py-0.5 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/30">미수금</span>
                        )}
                        {isLowSessions && (
                          <span className="text-xs px-1.5 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/30">PT {remainingSessions}회</span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        {member.phone ?? member.email ?? "연락처 없음"}
                        {remainingSessions !== undefined && !isLowSessions && (
                          <span className="text-primary ml-2">PT {remainingSessions}회</span>
                        )}
                      </p>
                      {/* PT 패키지 인라인 */}
                      {memberPkgs.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {memberPkgs.map((pkg) => {
                            const pct = Math.min((pkg.usedSessions / pkg.totalSessions) * 100, 100);
                            return (
                              <div key={pkg.id}>
                                <div className="flex items-center justify-between text-xs text-muted-foreground mb-0.5">
                                  <span>{pkg.packageName || "PT 프로그램"}</span>
                                  <span>{pkg.usedSessions}/{pkg.totalSessions}회</span>
                                </div>
                                <div className="w-full bg-border rounded-full h-1">
                                  <div className="bg-primary h-1 rounded-full" style={{ width: `${pct}%` }} />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                  {!selectMode && <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {selectMode && selectedIds.size > 0 && (
        <div className="fixed bottom-20 md:bottom-4 left-0 right-0 flex justify-center z-40 px-4">
          <div className="bg-card border border-border rounded-xl shadow-xl px-4 py-3 flex items-center gap-3 w-full max-w-md">
            <p className="text-sm font-medium flex-1">
              <span className="text-primary font-bold">{selectedIds.size}명</span> 선택됨
            </p>
            <Button size="sm" onClick={() => { setExtendDays(30); setExtendCustom(""); setExtendOpen(true); }} className="gap-1.5">
              <CalendarPlus className="h-4 w-4" />만료일 연장
            </Button>
          </div>
        </div>
      )}

      <Dialog open={extendOpen} onOpenChange={setExtendOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>만료일 일괄 연장</DialogTitle></DialogHeader>
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
                <Input type="number" min={1} placeholder="일수 입력" value={extendCustom} onChange={(e) => setExtendCustom(e.target.value)} className="w-32" />
                <span className="text-sm text-muted-foreground">일</span>
              </div>
            </div>
            {effectiveDays > 0 && <p className="text-sm text-primary font-medium">현재 만료일 기준 +{effectiveDays}일 연장</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExtendOpen(false)}>취소</Button>
            <Button onClick={handleExtend} disabled={effectiveDays < 1 || bulkExtendMutation.isPending}>
              {bulkExtendMutation.isPending ? "처리 중..." : `${selectedIds.size}명 연장`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <RegisterSheet open={showRegister} onClose={() => setShowRegister(false)} />
    </div>
  );
}

function TrainingLogTab() {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const now = new Date();
  const [month, setMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);

  const { data: logs, isLoading } = trpc.trainingLog.listAll.useQuery({ month });

  const filtered = (logs ?? []).filter(log => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (log.memberName ?? "").toLowerCase().includes(q) ||
      (log.bodyPart ?? "").toLowerCase().includes(q) ||
      (log.notes ?? "").toLowerCase().includes(q);
  });

  const grouped: Record<string, typeof filtered> = {};
  for (const log of filtered) {
    const date = log.sessionDate ?? log.createdAt.substring(0, 10);
    if (!grouped[date]) grouped[date] = [];
    grouped[date].push(log);
  }
  const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  const prevMonth = () => {
    const [y, m] = month.split("-").map(Number);
    setMonth(m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`);
  };
  const nextMonth = () => {
    const [y, m] = month.split("-").map(Number);
    setMonth(m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`);
  };

  const [y, m] = month.split("-").map(Number);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-center gap-3 bg-card border border-border rounded-xl px-4 py-3">
        <button onClick={prevMonth} className="text-muted-foreground hover:text-foreground px-2 text-lg">‹</button>
        <span className="text-base font-semibold min-w-[100px] text-center">{y}년 {m}월</span>
        <button onClick={nextMonth} className="text-muted-foreground hover:text-foreground px-2 text-lg">›</button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="회원명, 부위, 메모 검색..."
          className="w-full bg-card border border-border rounded-lg pl-9 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 rounded-lg bg-card border border-border animate-pulse" />
          ))}
        </div>
      ) : sortedDates.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Dumbbell className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">이 달 트레이닝 기록이 없습니다</p>
        </div>
      ) : (
        <div className="space-y-4">
          {sortedDates.map(date => (
            <div key={date}>
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-semibold text-muted-foreground">
                  {format(new Date(date), "M월 d일 (EEE)", { locale: ko })}
                </span>
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs text-muted-foreground">{grouped[date].length}건</span>
              </div>
              <div className="space-y-2">
                {grouped[date].map(log => {
                  let exercises: any[] = [];
                  try { exercises = log.exercisesJson ? JSON.parse(log.exercisesJson) : []; } catch {}
                  return (
                    <button
                      key={log.id}
                      onClick={() => setLocation(`/members/${log.memberId}`)}
                      className="w-full text-left bg-card border border-border rounded-xl p-4 hover:border-primary/40 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-sm">{log.memberName ?? "알 수 없음"}</span>
                            {log.bodyPart && (
                              <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">{log.bodyPart}</span>
                            )}
                          </div>
                          {exercises.length > 0 && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {exercises.slice(0, 3).map((e: any) => e.name).join(" · ")}
                              {exercises.length > 3 && ` 외 ${exercises.length - 3}개`}
                            </p>
                          )}
                          {log.notes && <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{log.notes}</p>}
                          {log.goal && <p className="text-xs text-blue-400 mt-1 line-clamp-1">목표: {log.goal}</p>}
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function PT() {
  const { data: members } = trpc.members.list.useQuery();

  return (
    <div className="space-y-4">
      <TabBanner tabKey="pt" />
      <div>
        <h1 className="text-xl font-bold">회원관리</h1>
        <p className="text-sm text-muted-foreground">총 {members?.length ?? 0}명</p>
      </div>

      <MembersTab />
    </div>
  );
}
