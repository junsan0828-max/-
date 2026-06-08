import { useState, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Dumbbell, Activity, Lock, Shirt } from "lucide-react";

function calcEndDateByPT(start: string, sessions: string): string {
  if (!start || !sessions) return "";
  const n = parseInt(sessions);
  if (!n) return "";
  const d = new Date(start);
  d.setDate(d.getDate() + Math.round(n / 2) * 7);
  return d.toISOString().substring(0, 10);
}

function calcEndDateByMonths(start: string, months: number): string {
  if (!start || !months) return "";
  const d = new Date(start);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().substring(0, 10);
}

type PaymentForm = {
  amount: string;
  unpaid: string;
  method: "" | "현금영수증" | "이체" | "지역화폐" | "카드";
  date: string;
  memo: string;
};
const emptyPayment = (): PaymentForm => ({ amount: "", unpaid: "", method: "", date: "", memo: "" });

function PaymentSection({
  payment, onChange, label,
}: {
  payment: PaymentForm;
  onChange: (p: PaymentForm) => void;
  label: string;
}) {
  return (
    <div className="space-y-3 pt-3 border-t border-border/50">
      <p className="text-xs font-semibold text-muted-foreground">{label}</p>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">결제 금액</Label>
          <Input type="number" min="0" placeholder="0"
            value={payment.amount} onChange={e => onChange({ ...payment, amount: e.target.value })}
            className="bg-input border-border" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">미수금</Label>
          <Input type="number" min="0" placeholder="0"
            value={payment.unpaid} onChange={e => onChange({ ...payment, unpaid: e.target.value })}
            className="bg-input border-border" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">결제방법</Label>
          <Select value={payment.method} onValueChange={v => onChange({ ...payment, method: v as any })}>
            <SelectTrigger className="bg-input border-border">
              <SelectValue placeholder="선택" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="현금영수증">현금영수증</SelectItem>
              <SelectItem value="이체">계좌이체</SelectItem>
              <SelectItem value="지역화폐">지역화폐</SelectItem>
              <SelectItem value="카드">카드</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">결제일자</Label>
          <Input type="date" value={payment.date}
            onChange={e => onChange({ ...payment, date: e.target.value })}
            className="bg-input border-border" />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">메모</Label>
        <Input type="text" placeholder="분납 등 메모"
          value={payment.memo} onChange={e => onChange({ ...payment, memo: e.target.value })}
          className="bg-input border-border" />
      </div>
    </div>
  );
}

const PT_PRESETS = ["케어피티", "웨이트피티", "이벤트피티"];
const SESSION_PRESETS = ["10", "20", "30", "40", "50"];

export default function MemberReRegister() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const { data: members = [] } = trpc.members.list.useQuery();
  const { data: allLockers } = trpc.access.getLockers.useQuery();
  const { data: branchList } = trpc.gym.staff.listBranches.useQuery();
  const { data: gymSettings } = trpc.gym.settings.get.useQuery();

  const [selectedMemberId, setSelectedMemberId] = useState(() => {
    const params = new URLSearchParams(search);
    return params.get("memberId") ?? "";
  });

  // 공유 운동 날짜 (헬스/PT 공통)
  const [membershipStart, setMembershipStart] = useState("");
  const [membershipEnd, setMembershipEnd] = useState("");

  // PT 프로그램
  const [addPt, setAddPt] = useState(false);
  const [ptProgram, setPtProgram] = useState("");
  const [isServiceSession, setIsServiceSession] = useState(false);
  const [unitPrice, setUnitPrice] = useState("");
  const [ptSessions, setPtSessions] = useState("");
  const [ptPayment, setPtPayment] = useState<PaymentForm>(emptyPayment());

  // 헬스 프로그램
  const [addHealth, setAddHealth] = useState(false);
  const [healthMonths, setHealthMonths] = useState<number | "">(1);
  const [healthPayment, setHealthPayment] = useState<PaymentForm>(emptyPayment());

  // 락커
  const [addLocker, setAddLocker] = useState(false);
  const [lockerConfig, setLockerConfig] = useState({ lockerId: "", startDate: "", endDate: "" });

  // 운동복
  const [addUniform, setAddUniform] = useState(false);
  const [uniformConfig, setUniformConfig] = useState({
    startDate: "", endDate: "",
    paymentAmount: "", paymentMethod: "" as "" | "현금영수증" | "이체" | "지역화폐" | "카드",
  });

  // 서비스 내역
  const [serviceItems, setServiceItems] = useState<string[]>([]);
  const [servicePtCount, setServicePtCount] = useState<number | undefined>(undefined);
  const [serviceHealthMonths, setServiceHealthMonths] = useState<number | undefined>(undefined);
  const [serviceHealthCustom, setServiceHealthCustom] = useState("");
  const [serviceLockerNum, setServiceLockerNum] = useState("");

  // URL memberId → 기존 날짜 pre-fill
  useEffect(() => {
    const params = new URLSearchParams(search);
    const urlMemberId = params.get("memberId");
    if (!urlMemberId || members.length === 0) return;
    const m = members.find(x => String(x.id) === urlMemberId);
    if (!m) return;
    const start = (m as any).membershipStart ?? "";
    const end = (m as any).membershipEnd ?? "";
    setMembershipStart(start);
    setMembershipEnd(end);
    if (start && end) {
      const s = new Date(start);
      const e = new Date(end);
      const months = (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth());
      if (months > 0) setHealthMonths(months);
      setAddHealth(true);
    }
  }, [search, members]);

  const updateMutation = trpc.members.update.useMutation({
    onError: (err) => toast.error((err as any).message || "등록 실패"),
  });
  const assignLockerMutation = trpc.access.assignLocker.useMutation({
    onError: (err) => toast.error("락커 배정 실패: " + ((err as any).message || "")),
  });
  const createUniformMutation = trpc.access.createUniform.useMutation({
    onError: (err) => toast.error("운동복 등록 실패: " + ((err as any).message || "")),
  });

  const selectedMember = members.find(m => String(m.id) === selectedMemberId);
  const availableLockers = (allLockers ?? []).filter((l: any) => !l.isOccupied);
  const lockerGroups: { branchId: number | null; name: string; lockers: any[] }[] = [];
  for (const l of availableLockers) {
    const bid = l.branchId ?? null;
    let g = lockerGroups.find(g => g.branchId === bid);
    if (!g) {
      const b = (branchList ?? []).find((b: any) => b.id === bid);
      g = { branchId: bid, name: b?.name ?? "지점 미지정", lockers: [] };
      lockerGroups.push(g);
    }
    g.lockers.push(l);
  }

  const anySelected = addPt || addHealth || addLocker || addUniform;
  const isPending = updateMutation.isPending || assignLockerMutation.isPending || createUniformMutation.isPending;

  const buildServiceItemsStr = () => {
    if (serviceItems.length === 0) return undefined;
    return serviceItems.map(item => {
      if (item === "PT" && servicePtCount) return `PT(${servicePtCount}회)`;
      if (item === "헬스") {
        if (serviceHealthMonths) return `헬스(${serviceHealthMonths}개월)`;
        if (serviceHealthCustom) return `헬스(${serviceHealthCustom}일)`;
        return "헬스";
      }
      if (item === "락커" && serviceLockerNum) return `락커(${serviceLockerNum})`;
      return item;
    }).join(",");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMemberId) { toast.error("회원을 선택해주세요"); return; }
    if (!anySelected) { toast.error("등록 유형을 선택해주세요"); return; }
    if (addLocker && !lockerConfig.lockerId) { toast.error("배정할 락커를 선택해주세요"); return; }

    const today = new Date().toISOString().substring(0, 10);
    const siStr = buildServiceItemsStr();

    try {
      // PT → 헬스 순서로 직렬 처리 (날짜 충돌 방지)
      if (addPt) {
        const ptEnd = addHealth ? membershipEnd : calcEndDateByPT(membershipStart, ptSessions);
        await updateMutation.mutateAsync({
          id: parseInt(selectedMemberId),
          name: selectedMember!.name,
          membershipStart: membershipStart || undefined,
          membershipEnd: ptEnd || undefined,
          ptProgram: isServiceSession ? "서비스세션" : (ptProgram || undefined),
          ptSessions: ptSessions ? parseInt(ptSessions) as any : undefined,
          paymentAmount: isServiceSession ? 0 : (ptPayment.amount ? parseInt(ptPayment.amount) : undefined),
          unpaidAmount: ptPayment.unpaid ? parseInt(ptPayment.unpaid) : undefined,
          paymentMethod: ptPayment.method || undefined,
          paymentDate: ptPayment.date || today,
          paymentMemo: isServiceSession
            ? `서비스세션 단가:${unitPrice}${ptPayment.memo ? ` / ${ptPayment.memo}` : ""}`
            : (ptPayment.memo || undefined),
          subType: "재등록" as any,
          serviceItems: !addHealth ? siStr : undefined,
        } as any);
      }

      if (addHealth) {
        await updateMutation.mutateAsync({
          id: parseInt(selectedMemberId),
          name: selectedMember!.name,
          membershipStart: membershipStart || undefined,
          membershipEnd: membershipEnd || undefined,
          ptProgram: `헬스 ${healthMonths}개월`,
          paymentAmount: healthPayment.amount ? parseInt(healthPayment.amount) : 0,
          unpaidAmount: healthPayment.unpaid ? parseInt(healthPayment.unpaid) : undefined,
          paymentMethod: healthPayment.method || undefined,
          paymentDate: healthPayment.date || today,
          paymentMemo: healthPayment.memo || undefined,
          subType: "재등록" as any,
          serviceItems: siStr,
        } as any);
      }

      // 락커·운동복은 병렬
      await Promise.all([
        addLocker && lockerConfig.lockerId
          ? assignLockerMutation.mutateAsync({
              lockerId: parseInt(lockerConfig.lockerId),
              memberId: parseInt(selectedMemberId),
              memberName: selectedMember!.name,
              memberPhone: selectedMember?.phone ?? undefined,
              startDate: lockerConfig.startDate || undefined,
              endDate: lockerConfig.endDate || undefined,
              rentalType: "service",
            })
          : Promise.resolve(),
        addUniform
          ? createUniformMutation.mutateAsync({
              memberId: parseInt(selectedMemberId),
              memberName: selectedMember!.name,
              memberPhone: selectedMember?.phone ?? undefined,
              startDate: uniformConfig.startDate || undefined,
              endDate: uniformConfig.endDate || undefined,
              rentalType: uniformConfig.paymentAmount ? "paid" : "service",
              isPaid: uniformConfig.paymentAmount ? 1 : 0,
              paymentAmount: uniformConfig.paymentAmount ? parseInt(uniformConfig.paymentAmount) : 0,
              paymentMethod: uniformConfig.paymentMethod || undefined,
            })
          : Promise.resolve(),
      ]);

      toast.success("등록되었습니다.");
      setLocation(`/members/${selectedMemberId}`);
    } catch {
      // individual mutations already toast errors
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => setLocation("/members")} className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-xl font-bold">재등록</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* 회원 선택 */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-4">
            <CardTitle className="text-base font-semibold">회원 선택</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-sm text-muted-foreground">
                회원 이름 <span className="text-primary">*</span>
              </Label>
              <select
                value={selectedMemberId}
                onChange={e => setSelectedMemberId(e.target.value)}
                className="w-full bg-input border border-border rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">회원을 선택하세요</option>
                {[...members].sort((a, b) => a.name.localeCompare(b.name, "ko")).map(m => (
                  <option key={m.id} value={String(m.id)}>
                    {m.name}{m.phone ? ` (${m.phone})` : ""}
                  </option>
                ))}
              </select>
            </div>
            {selectedMember && (
              <div className="bg-background border border-border rounded-lg px-3 py-2.5 flex gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">이름</p>
                  <p className="text-sm font-medium text-foreground">{selectedMember.name}</p>
                </div>
                {selectedMember.phone && (
                  <div>
                    <p className="text-xs text-muted-foreground">연락처</p>
                    <p className="text-sm text-foreground">{selectedMember.phone}</p>
                  </div>
                )}
                {(selectedMember as any).ptSessions && (
                  <div>
                    <p className="text-xs text-muted-foreground">잔여 PT</p>
                    <p className="text-sm text-primary font-medium">{(selectedMember as any).ptSessions}회</p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 등록 유형 선택 — 복수 선택 가능 */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">
              등록 유형 선택
              <span className="ml-2 text-xs font-normal text-muted-foreground">복수 선택 가능</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              <button type="button" onClick={() => setAddHealth(v => !v)}
                className={`flex flex-col items-center gap-2.5 p-5 rounded-xl border-2 transition-all ${addHealth ? "border-emerald-500 bg-emerald-500/10" : "border-border hover:border-emerald-500/40 hover:bg-accent"}`}>
                <div className={`p-3 rounded-full ${addHealth ? "bg-emerald-500/20" : "bg-muted"}`}>
                  <Activity className={`h-6 w-6 ${addHealth ? "text-emerald-400" : "text-muted-foreground"}`} />
                </div>
                <div className="text-center">
                  <p className={`text-sm font-semibold ${addHealth ? "text-emerald-400" : "text-foreground"}`}>헬스권</p>
                  <p className="text-xs text-muted-foreground mt-0.5">헬스 이용 등록</p>
                </div>
              </button>

              <button type="button" onClick={() => setAddPt(v => !v)}
                className={`flex flex-col items-center gap-2.5 p-5 rounded-xl border-2 transition-all ${addPt ? "border-primary bg-primary/10" : "border-border hover:border-primary/40 hover:bg-accent"}`}>
                <div className={`p-3 rounded-full ${addPt ? "bg-primary/20" : "bg-muted"}`}>
                  <Dumbbell className={`h-6 w-6 ${addPt ? "text-primary" : "text-muted-foreground"}`} />
                </div>
                <div className="text-center">
                  <p className={`text-sm font-semibold ${addPt ? "text-primary" : "text-foreground"}`}>PT 등록</p>
                  <p className="text-xs text-muted-foreground mt-0.5">PT 세션 등록</p>
                </div>
              </button>

              <button type="button" onClick={() => setAddLocker(v => !v)}
                className={`flex flex-col items-center gap-2.5 p-5 rounded-xl border-2 transition-all ${addLocker ? "border-amber-500 bg-amber-500/10" : "border-border hover:border-amber-500/40 hover:bg-accent"}`}>
                <div className={`p-3 rounded-full ${addLocker ? "bg-amber-500/20" : "bg-muted"}`}>
                  <Lock className={`h-6 w-6 ${addLocker ? "text-amber-400" : "text-muted-foreground"}`} />
                </div>
                <div className="text-center">
                  <p className={`text-sm font-semibold ${addLocker ? "text-amber-400" : "text-foreground"}`}>락커</p>
                  <p className="text-xs text-muted-foreground mt-0.5">락커 배정</p>
                </div>
              </button>

              <button type="button" onClick={() => setAddUniform(v => !v)}
                className={`flex flex-col items-center gap-2.5 p-5 rounded-xl border-2 transition-all ${addUniform ? "border-purple-500 bg-purple-500/10" : "border-border hover:border-purple-500/40 hover:bg-accent"}`}>
                <div className={`p-3 rounded-full ${addUniform ? "bg-purple-500/20" : "bg-muted"}`}>
                  <Shirt className={`h-6 w-6 ${addUniform ? "text-purple-400" : "text-muted-foreground"}`} />
                </div>
                <div className="text-center">
                  <p className={`text-sm font-semibold ${addUniform ? "text-purple-400" : "text-foreground"}`}>운동복</p>
                  <p className="text-xs text-muted-foreground mt-0.5">운동복 대여</p>
                </div>
              </button>
            </div>
          </CardContent>
        </Card>

        {/* ── PT 프로그램 정보 ── */}
        {addPt && (
          <Card className="bg-card border-primary/40">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold text-primary">PT 프로그램 정보</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* 프로그램명 */}
              <div className="space-y-1.5">
                <Label className="text-sm text-muted-foreground">프로그램명</Label>
                <Input
                  value={isServiceSession ? "" : ptProgram}
                  onChange={e => { setPtProgram(e.target.value); setIsServiceSession(false); }}
                  placeholder="프로그램명 직접 입력"
                  disabled={isServiceSession}
                  className="bg-input border-border disabled:opacity-50"
                />
                <div className="flex gap-1.5 flex-wrap">
                  {PT_PRESETS.map(preset => (
                    <button key={preset} type="button"
                      onClick={() => { setPtProgram(p => p === preset && !isServiceSession ? "" : preset); setIsServiceSession(false); }}
                      className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${ptProgram === preset && !isServiceSession ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-primary/40"}`}>
                      {preset}
                    </button>
                  ))}
                  <button type="button"
                    onClick={() => { setIsServiceSession(s => !s); setPtProgram(""); setPtPayment(p => ({ ...p, amount: "" })); }}
                    className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${isServiceSession ? "bg-emerald-500 text-white border-emerald-500" : "border-border text-muted-foreground hover:border-emerald-400/60"}`}>
                    서비스세션
                  </button>
                </div>
                {isServiceSession && (
                  <div className="mt-2 bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-3 py-2.5 space-y-2">
                    <p className="text-xs text-emerald-400 font-medium">서비스세션 — 결제금액 0원으로 처리됩니다</p>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">단가 (정산 기준)</Label>
                      <Input type="number" min="0" value={unitPrice}
                        onChange={e => setUnitPrice(e.target.value)} placeholder="0"
                        className="bg-background border-border text-sm" />
                    </div>
                  </div>
                )}
              </div>

              {/* PT 횟수 */}
              <div className="space-y-1.5">
                <Label className="text-sm text-muted-foreground">PT 횟수</Label>
                <Input type="number" min="1" value={ptSessions}
                  onChange={e => {
                    const s = e.target.value;
                    setPtSessions(s);
                    if (!addHealth) setMembershipEnd(calcEndDateByPT(membershipStart, s));
                  }}
                  placeholder="횟수 직접 입력" className="bg-input border-border"
                />
                <div className="flex gap-1.5 flex-wrap">
                  {SESSION_PRESETS.map(preset => (
                    <button key={preset} type="button"
                      onClick={() => {
                        const next = ptSessions === preset ? "" : preset;
                        setPtSessions(next);
                        if (!addHealth) setMembershipEnd(calcEndDateByPT(membershipStart, next));
                      }}
                      className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${ptSessions === preset ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-primary/40"}`}>
                      {preset}회
                    </button>
                  ))}
                </div>
              </div>

              {/* 날짜 — 헬스 미선택 시만 표시 (헬스 선택 시 헬스 카드에서 공유) */}
              {!addHealth && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-sm text-muted-foreground">시작일</Label>
                    <Input type="date" value={membershipStart}
                      onChange={e => { setMembershipStart(e.target.value); setMembershipEnd(calcEndDateByPT(e.target.value, ptSessions)); }}
                      className="bg-input border-border" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm text-muted-foreground">만료일 <span className="text-primary text-xs">(자동계산)</span></Label>
                    <Input type="date" value={membershipEnd} readOnly className="bg-input border-border opacity-60 cursor-not-allowed" />
                  </div>
                </div>
              )}

              {!isServiceSession && (
                <PaymentSection payment={ptPayment} onChange={setPtPayment} label="PT 결제 정보" />
              )}
            </CardContent>
          </Card>
        )}

        {/* ── 헬스 프로그램 정보 ── */}
        {addHealth && (
          <Card className="bg-card border-emerald-500/40">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold text-emerald-400">헬스 프로그램 정보</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* 이용 기간 먼저 */}
              <div className="space-y-1.5">
                <Label className="text-sm text-muted-foreground">이용 기간</Label>
                <div className="flex gap-2 flex-wrap">
                  {[1, 3, 6, 12].map(m => (
                    <button key={m} type="button"
                      onClick={() => {
                        setHealthMonths(m);
                        if (membershipStart) setMembershipEnd(calcEndDateByMonths(membershipStart, m));
                      }}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${healthMonths === m ? "bg-emerald-500 text-white border-emerald-500" : "border-border text-muted-foreground hover:bg-accent"}`}>
                      {m}개월
                    </button>
                  ))}
                </div>
              </div>

              {/* 날짜 (이용기간 이후) */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-sm text-muted-foreground">운동 시작일</Label>
                  <Input type="date" value={membershipStart}
                    onChange={e => {
                      setMembershipStart(e.target.value);
                      if (healthMonths) setMembershipEnd(calcEndDateByMonths(e.target.value, Number(healthMonths)));
                    }}
                    className="bg-input border-border" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm text-muted-foreground">운동 만료일</Label>
                  <Input type="date" value={membershipEnd}
                    onChange={e => setMembershipEnd(e.target.value)}
                    className="bg-input border-border" />
                </div>
              </div>

              <PaymentSection payment={healthPayment} onChange={setHealthPayment} label="헬스 결제 정보" />
            </CardContent>
          </Card>
        )}

        {/* ── 락커 프로그램 정보 ── */}
        {addLocker && (
          <Card className="bg-card border-amber-500/40">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold text-amber-400">락커 프로그램 정보</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-sm text-muted-foreground">락커 선택 <span className="text-primary">*</span></Label>
                {availableLockers.length === 0 ? (
                  <p className="text-xs text-muted-foreground">사용 가능한 락커가 없습니다</p>
                ) : (
                  <select value={lockerConfig.lockerId}
                    onChange={e => setLockerConfig(p => ({ ...p, lockerId: e.target.value }))}
                    className="w-full rounded-lg px-3 py-2 text-sm text-foreground bg-input border border-border focus:outline-none focus:ring-1 focus:ring-amber-500">
                    <option value="">락커 선택...</option>
                    {lockerGroups.map(g => (
                      <optgroup key={g.branchId ?? "none"} label={g.name}>
                        {g.lockers.map((l: any) => (
                          <option key={l.id} value={String(l.id)}>{l.lockerNumber}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-sm text-muted-foreground">시작일</Label>
                  <Input type="date" value={lockerConfig.startDate}
                    onChange={e => setLockerConfig(p => ({ ...p, startDate: e.target.value }))}
                    className="bg-input border-border" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm text-muted-foreground">만료일</Label>
                  <Input type="date" value={lockerConfig.endDate}
                    onChange={e => setLockerConfig(p => ({ ...p, endDate: e.target.value }))}
                    className="bg-input border-border" />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── 운동복 프로그램 정보 ── */}
        {addUniform && (
          <Card className="bg-card border-purple-500/40">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold text-purple-400">운동복 프로그램 정보</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-sm text-muted-foreground">시작일</Label>
                  <Input type="date" value={uniformConfig.startDate}
                    onChange={e => setUniformConfig(p => ({ ...p, startDate: e.target.value }))}
                    className="bg-input border-border" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm text-muted-foreground">만료일</Label>
                  <Input type="date" value={uniformConfig.endDate}
                    onChange={e => setUniformConfig(p => ({ ...p, endDate: e.target.value }))}
                    className="bg-input border-border" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-sm text-muted-foreground">결제 금액 <span className="text-muted-foreground/60">(유료 시)</span></Label>
                  <Input type="number" min="0" placeholder="0 (무료)"
                    value={uniformConfig.paymentAmount}
                    onChange={e => setUniformConfig(p => ({ ...p, paymentAmount: e.target.value }))}
                    className="bg-input border-border" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm text-muted-foreground">결제방법</Label>
                  <Select value={uniformConfig.paymentMethod} onValueChange={v => setUniformConfig(p => ({ ...p, paymentMethod: v as any }))}>
                    <SelectTrigger className="bg-input border-border">
                      <SelectValue placeholder="선택" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="현금영수증">현금영수증</SelectItem>
                      <SelectItem value="이체">계좌이체</SelectItem>
                      <SelectItem value="지역화폐">지역화폐</SelectItem>
                      <SelectItem value="카드">카드</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── 서비스 내역 (PT 또는 헬스 선택 시 표시) ── */}
        {(addPt || addHealth) && (
          <Card className="bg-card border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">
                서비스 내역
                <span className="ml-2 text-xs font-normal text-muted-foreground">무료 제공 항목</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {/* PT 서비스 */}
              {(() => {
                const sel = serviceItems.includes("PT");
                const paid = Number(ptPayment.amount) || 0;
                const sessions = parseInt(ptSessions) || 0;
                const calcPrice = sessions > 0 ? Math.round(paid / sessions) : 0;
                const unitPriceVal = calcPrice > 0 ? calcPrice : (gymSettings?.servicePtUnitPrice ?? 0);
                return (
                  <div className={`rounded-xl border transition-colors ${sel ? "border-blue-500/60 bg-blue-500/5" : "border-border"}`}>
                    <button type="button"
                      onClick={() => { setServiceItems(s => sel ? s.filter(x => x !== "PT") : [...s, "PT"]); setServicePtCount(undefined); }}
                      className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold">
                      <span className={sel ? "text-blue-400" : "text-muted-foreground"}>PT</span>
                      {unitPriceVal > 0 && <span className="text-[10px] text-muted-foreground">단가 {unitPriceVal.toLocaleString()}원/회</span>}
                    </button>
                    {sel && (
                      <div className="px-4 pb-4 border-t border-blue-500/20 pt-3 space-y-2">
                        <Label className="text-xs text-muted-foreground">제공 횟수</Label>
                        <div className="flex gap-2">
                          {[1, 2, 3].map(n => (
                            <button key={n} type="button"
                              onClick={() => setServicePtCount(c => c === n ? undefined : n)}
                              className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${servicePtCount === n ? "bg-blue-500 text-white border-blue-500" : "bg-background border-border text-muted-foreground"}`}>
                              +{n}회
                            </button>
                          ))}
                        </div>
                        <Input type="number" min={1}
                          value={servicePtCount && ![1,2,3].includes(servicePtCount) ? servicePtCount : ""}
                          onChange={e => setServicePtCount(e.target.value ? parseInt(e.target.value) : undefined)}
                          placeholder="직접 입력 (회)" className="bg-input border-border text-sm" />
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* 헬스 서비스 */}
              {(() => {
                const sel = serviceItems.includes("헬스");
                return (
                  <div className={`rounded-xl border transition-colors ${sel ? "border-emerald-500/60 bg-emerald-500/5" : "border-border"}`}>
                    <button type="button"
                      onClick={() => { setServiceItems(s => sel ? s.filter(x => x !== "헬스") : [...s, "헬스"]); setServiceHealthMonths(undefined); setServiceHealthCustom(""); }}
                      className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold">
                      <span className={sel ? "text-emerald-400" : "text-muted-foreground"}>헬스</span>
                    </button>
                    {sel && (
                      <div className="px-4 pb-4 border-t border-emerald-500/20 pt-3 space-y-2">
                        <Label className="text-xs text-muted-foreground">제공 개월 수</Label>
                        <div className="flex gap-2">
                          {[1, 3, 6, 12].map(m => (
                            <button key={m} type="button"
                              onClick={() => { setServiceHealthMonths(v => v === m ? undefined : m); setServiceHealthCustom(""); }}
                              className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${serviceHealthMonths === m ? "bg-emerald-500 text-white border-emerald-500" : "bg-background border-border text-muted-foreground"}`}>
                              {m}개월
                            </button>
                          ))}
                        </div>
                        <Input type="number" min={1} value={serviceHealthCustom}
                          onChange={e => { setServiceHealthCustom(e.target.value); setServiceHealthMonths(undefined); }}
                          placeholder="직접 입력 (일)" className="bg-input border-border text-sm" />
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* 락커 서비스 */}
              {(() => {
                const sel = serviceItems.includes("락커");
                const avail = (allLockers ?? []).filter((l: any) => !l.isOccupied);
                const groups: { branchId: number | null; name: string; lockers: any[] }[] = [];
                for (const l of avail) {
                  const bid = l.branchId ?? null;
                  let g = groups.find(g => g.branchId === bid);
                  if (!g) {
                    const b = (branchList ?? []).find((b: any) => b.id === bid);
                    g = { branchId: bid, name: b?.name ?? "지점 미지정", lockers: [] };
                    groups.push(g);
                  }
                  g.lockers.push(l);
                }
                return (
                  <div className={`rounded-xl border transition-colors ${sel ? "border-amber-500/60 bg-amber-500/5" : "border-border"}`}>
                    <button type="button"
                      onClick={() => { setServiceItems(s => sel ? s.filter(x => x !== "락커") : [...s, "락커"]); setServiceLockerNum(""); }}
                      className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold">
                      <span className={sel ? "text-amber-400" : "text-muted-foreground"}>락커</span>
                      {avail.length > 0 && <span className="text-[10px] text-muted-foreground">사용 가능 {avail.length}개</span>}
                    </button>
                    {sel && (
                      <div className="px-4 pb-4 border-t border-amber-500/20 pt-3">
                        <Label className="text-xs text-muted-foreground">락커 번호</Label>
                        {avail.length === 0 ? (
                          <p className="text-xs text-muted-foreground mt-1">사용 가능한 락커가 없습니다</p>
                        ) : (
                          <select value={serviceLockerNum} onChange={e => setServiceLockerNum(e.target.value)}
                            className="w-full mt-1 rounded-lg px-3 py-2 text-sm text-foreground bg-input border border-border focus:outline-none focus:ring-1 focus:ring-amber-500">
                            <option value="">락커 선택...</option>
                            {groups.map(g => (
                              <optgroup key={g.branchId ?? "none"} label={g.name}>
                                {g.lockers.map((l: any) => (
                                  <option key={l.id} value={l.lockerNumber}>{l.lockerNumber}</option>
                                ))}
                              </optgroup>
                            ))}
                          </select>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* 운동복 서비스 */}
              {(() => {
                const sel = serviceItems.includes("운동복");
                return (
                  <button type="button"
                    onClick={() => setServiceItems(s => sel ? s.filter(x => x !== "운동복") : [...s, "운동복"])}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-semibold border transition-colors ${sel ? "border-purple-500/60 bg-purple-500/5 text-purple-400" : "border-border text-muted-foreground"}`}>
                    운동복
                    {sel && <span className="text-[10px] text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-full">선택됨</span>}
                  </button>
                );
              })()}

              {serviceItems.length > 0 && (
                <div className="flex gap-1.5 flex-wrap mt-1">
                  {serviceItems.map(item => {
                    let label = `🎁 서비스 ${item}`;
                    if (item === "PT" && servicePtCount) label = `🎁 PT +${servicePtCount}회`;
                    else if (item === "헬스") {
                      if (serviceHealthMonths) label = `🎁 헬스 +${serviceHealthMonths}개월`;
                      else if (serviceHealthCustom) label = `🎁 헬스 +${serviceHealthCustom}일`;
                    } else if (item === "락커" && serviceLockerNum) label = `🎁 락커 #${serviceLockerNum}`;
                    const style = item === "PT" ? "bg-blue-500/20 text-blue-400"
                      : item === "헬스" ? "bg-emerald-500/20 text-emerald-400"
                      : item === "락커" ? "bg-amber-500/20 text-amber-400"
                      : "bg-purple-500/20 text-purple-400";
                    return <span key={item} className={`text-xs px-2 py-0.5 rounded-full font-medium ${style}`}>{label}</span>;
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <div className="flex gap-3 pb-4">
          <Button type="button" variant="outline" className="flex-1" onClick={() => setLocation("/members")}>
            취소
          </Button>
          <Button type="submit" className="flex-1" disabled={isPending || !selectedMemberId || !anySelected}>
            {isPending ? "처리 중..." : "재등록 완료"}
          </Button>
        </div>
      </form>
    </div>
  );
}
