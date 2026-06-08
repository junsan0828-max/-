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

const PT_PRESETS = ["케어피티", "웨이트피티", "이벤트피티"];
const SESSION_PRESETS = ["10", "20", "30", "40", "50"];

export default function MemberReRegister() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const { data: members = [] } = trpc.members.list.useQuery();
  const { data: allLockers } = trpc.access.getLockers.useQuery();
  const { data: branchList } = trpc.gym.staff.listBranches.useQuery();
  const { data: gymSettings } = trpc.gym.settings.get.useQuery();

  const today = new Date().toISOString().substring(0, 10);

  const [selectedMemberId, setSelectedMemberId] = useState(() => {
    const params = new URLSearchParams(search);
    return params.get("memberId") ?? "";
  });

  // 공유 날짜
  const [membershipStart, setMembershipStart] = useState(today);
  const [membershipEnd, setMembershipEnd] = useState("");

  // 헬스
  const [addHealth, setAddHealth] = useState(false);
  const [healthMonths, setHealthMonths] = useState<number>(1);
  const [healthPrice, setHealthPrice] = useState("");

  // PT
  const [addPt, setAddPt] = useState(false);
  const [ptProgram, setPtProgram] = useState("");
  const [isServiceSession, setIsServiceSession] = useState(false);
  const [unitPrice, setUnitPrice] = useState("");
  const [ptSessions, setPtSessions] = useState("");
  const [ptPrice, setPtPrice] = useState("");

  // 락커
  const [addLocker, setAddLocker] = useState(false);
  const [lockerId, setLockerId] = useState("");
  const [lockerEnd, setLockerEnd] = useState("");
  const [lockerPrice, setLockerPrice] = useState("");

  // 운동복
  const [addUniform, setAddUniform] = useState(false);
  const [uniformEnd, setUniformEnd] = useState("");
  const [uniformPrice, setUniformPrice] = useState("");

  // 공통 결제
  const [paymentMethod, setPaymentMethod] = useState<"" | "현금영수증" | "이체" | "지역화폐" | "카드">("");
  const [paymentDate, setPaymentDate] = useState(today);
  const [unpaidAmount, setUnpaidAmount] = useState("");
  const [paymentMemo, setPaymentMemo] = useState("");

  // 서비스 내역
  const [serviceItems, setServiceItems] = useState<string[]>([]);
  const [servicePtCount, setServicePtCount] = useState<number | undefined>();
  const [serviceHealthMonths, setServiceHealthMonths] = useState<number | undefined>();
  const [serviceHealthCustom, setServiceHealthCustom] = useState("");
  const [serviceLockerNum, setServiceLockerNum] = useState("");

  const selectedMember = members.find(m => String(m.id) === selectedMemberId);

  // 회원 선택 시 날짜 자동 기입
  useEffect(() => {
    if (!selectedMember) return;
    const memberEnd = (selectedMember as any).membershipEnd ?? "";
    // 재등록: 기존 종료일이 오늘 이후면 그 날짜부터, 아니면 오늘
    const autoStart = memberEnd && memberEnd >= today ? memberEnd : today;
    setMembershipStart(autoStart);
    setMembershipEnd(calcEndDateByMonths(autoStart, healthMonths));
    setLockerEnd(calcEndDateByMonths(autoStart, healthMonths));
    setUniformEnd(calcEndDateByMonths(autoStart, healthMonths));
  }, [selectedMemberId]);

  // URL memberId pre-fill (헬스권 수정에서 진입)
  useEffect(() => {
    const params = new URLSearchParams(search);
    const urlMemberId = params.get("memberId");
    if (!urlMemberId || members.length === 0) return;
    const m = members.find(x => String(x.id) === urlMemberId);
    if (!m) return;
    const existingStart = (m as any).membershipStart ?? "";
    const existingEnd = (m as any).membershipEnd ?? "";
    if (existingStart) setMembershipStart(existingStart);
    if (existingEnd) setMembershipEnd(existingEnd);
    if (existingStart && existingEnd) {
      const s = new Date(existingStart);
      const e = new Date(existingEnd);
      const months = (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth());
      if (months > 0) setHealthMonths(months);
      setAddHealth(true);
    }
  }, [search, members]);

  // 헬스 가격 자동 기입
  useEffect(() => {
    if (!gymSettings) return;
    const price = (gymSettings as any).healthMonthlyPrice ?? 0;
    if (price > 0) setHealthPrice(String(price * healthMonths));
  }, [gymSettings, addHealth, healthMonths]);

  // PT 가격 자동 기입
  useEffect(() => {
    if (!gymSettings) return;
    const price = (gymSettings as any).ptSessionPrice ?? 0;
    const sessions = parseInt(ptSessions) || 0;
    if (price > 0 && sessions > 0) setPtPrice(String(price * sessions));
  }, [gymSettings, addPt, ptSessions]);

  // 락커 가격 자동 기입
  useEffect(() => {
    if (!gymSettings) return;
    const price = (gymSettings as any).lockerMonthlyPrice ?? 0;
    if (price > 0) setLockerPrice(String(price));
  }, [gymSettings, addLocker]);

  // 운동복 가격 자동 기입
  useEffect(() => {
    if (!gymSettings) return;
    const price = (gymSettings as any).uniformPrice ?? 0;
    if (price > 0) setUniformPrice(String(price));
  }, [gymSettings, addUniform]);

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

  // 총 결제 금액
  const totalAmount =
    (addHealth && !isNaN(parseInt(healthPrice)) ? parseInt(healthPrice) : 0) +
    (addPt && !isServiceSession && !isNaN(parseInt(ptPrice)) ? parseInt(ptPrice) : 0) +
    (addLocker && !isNaN(parseInt(lockerPrice)) ? parseInt(lockerPrice) : 0) +
    (addUniform && !isNaN(parseInt(uniformPrice)) ? parseInt(uniformPrice) : 0);

  const anySelected = addPt || addHealth || addLocker || addUniform;
  const updateMutation = trpc.members.update.useMutation({
    onError: (err) => toast.error((err as any).message || "등록 실패"),
  });
  const assignLockerMutation = trpc.access.assignLocker.useMutation({
    onError: (err) => toast.error("락커 배정 실패: " + ((err as any).message || "")),
  });
  const createUniformMutation = trpc.access.createUniform.useMutation({
    onError: (err) => toast.error("운동복 등록 실패: " + ((err as any).message || "")),
  });

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
    if (addLocker && !lockerId) { toast.error("배정할 락커를 선택해주세요"); return; }

    const siStr = buildServiceItemsStr();
    const method = paymentMethod || undefined;
    const date = paymentDate || today;

    try {
      if (addPt) {
        const ptEnd = addHealth ? membershipEnd : calcEndDateByPT(membershipStart, ptSessions);
        await updateMutation.mutateAsync({
          id: parseInt(selectedMemberId),
          name: selectedMember!.name,
          membershipStart: membershipStart || undefined,
          membershipEnd: ptEnd || undefined,
          ptProgram: isServiceSession ? "서비스세션" : (ptProgram || undefined),
          ptSessions: ptSessions ? parseInt(ptSessions) as any : undefined,
          paymentAmount: isServiceSession ? 0 : (ptPrice ? parseInt(ptPrice) : undefined),
          unpaidAmount: !addHealth && unpaidAmount ? parseInt(unpaidAmount) : undefined,
          paymentMethod: method,
          paymentDate: date,
          paymentMemo: isServiceSession
            ? `서비스세션 단가:${unitPrice}${paymentMemo ? ` / ${paymentMemo}` : ""}`
            : (paymentMemo || undefined),
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
          paymentAmount: healthPrice ? parseInt(healthPrice) : 0,
          unpaidAmount: unpaidAmount ? parseInt(unpaidAmount) : undefined,
          paymentMethod: method,
          paymentDate: date,
          paymentMemo: paymentMemo || undefined,
          subType: "재등록" as any,
          serviceItems: siStr,
        } as any);
      }

      await Promise.all([
        addLocker && lockerId
          ? assignLockerMutation.mutateAsync({
              lockerId: parseInt(lockerId),
              memberId: parseInt(selectedMemberId),
              memberName: selectedMember!.name,
              memberPhone: selectedMember?.phone ?? undefined,
              startDate: membershipStart || undefined,
              endDate: lockerEnd || undefined,
              rentalType: "service",
            })
          : Promise.resolve(),
        addUniform
          ? createUniformMutation.mutateAsync({
              memberId: parseInt(selectedMemberId),
              memberName: selectedMember!.name,
              memberPhone: selectedMember?.phone ?? undefined,
              startDate: membershipStart || undefined,
              endDate: uniformEnd || undefined,
              rentalType: uniformPrice && parseInt(uniformPrice) > 0 ? "paid" : "service",
              isPaid: uniformPrice && parseInt(uniformPrice) > 0 ? 1 : 0,
              paymentAmount: uniformPrice ? parseInt(uniformPrice) : 0,
              paymentMethod: method,
            })
          : Promise.resolve(),
      ]);

      toast.success("등록되었습니다.");
      setLocation(`/members/${selectedMemberId}`);
    } catch {
      // individual mutations already toast
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
          <CardContent className="space-y-3">
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
            {selectedMember && (
              <div className="bg-background border border-border rounded-lg px-3 py-2.5 flex gap-4 flex-wrap">
                <div>
                  <p className="text-xs text-muted-foreground">이름</p>
                  <p className="text-sm font-medium">{selectedMember.name}</p>
                </div>
                {selectedMember.phone && (
                  <div>
                    <p className="text-xs text-muted-foreground">연락처</p>
                    <p className="text-sm">{selectedMember.phone}</p>
                  </div>
                )}
                {(selectedMember as any).membershipEnd && (
                  <div>
                    <p className="text-xs text-muted-foreground">현재 만료일</p>
                    <p className="text-sm text-emerald-400 font-medium">{(selectedMember as any).membershipEnd}</p>
                  </div>
                )}
                {(selectedMember as any).ptSessions > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground">잔여 PT</p>
                    <p className="text-sm text-primary font-medium">{(selectedMember as any).ptSessions}회</p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 등록 유형 선택 */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">
              등록 유형 선택
              <span className="ml-2 text-xs font-normal text-muted-foreground">복수 선택 가능</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              {[
                { key: "health", label: "헬스권", sub: "헬스 이용 등록", icon: Activity, active: addHealth, color: "emerald", toggle: () => setAddHealth(v => !v) },
                { key: "pt", label: "PT 등록", sub: "PT 세션 등록", icon: Dumbbell, active: addPt, color: "primary", toggle: () => setAddPt(v => !v) },
                { key: "locker", label: "락커", sub: "락커 배정", icon: Lock, active: addLocker, color: "amber", toggle: () => setAddLocker(v => !v) },
                { key: "uniform", label: "운동복", sub: "운동복 대여", icon: Shirt, active: addUniform, color: "purple", toggle: () => setAddUniform(v => !v) },
              ].map(({ key, label, sub, icon: Icon, active, color, toggle }) => (
                <button key={key} type="button" onClick={toggle}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                    active
                      ? color === "primary" ? "border-primary bg-primary/10"
                        : `border-${color}-500 bg-${color}-500/10`
                      : "border-border hover:bg-accent"
                  }`}>
                  <div className={`p-2.5 rounded-full ${active
                    ? color === "primary" ? "bg-primary/20" : `bg-${color}-500/20`
                    : "bg-muted"}`}>
                    <Icon className={`h-5 w-5 ${active
                      ? color === "primary" ? "text-primary" : `text-${color}-400`
                      : "text-muted-foreground"}`} />
                  </div>
                  <div className="text-center">
                    <p className={`text-sm font-semibold ${active
                      ? color === "primary" ? "text-primary" : `text-${color}-400`
                      : "text-foreground"}`}>{label}</p>
                    <p className="text-xs text-muted-foreground">{sub}</p>
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* ── 헬스 프로그램 정보 ── */}
        {addHealth && (
          <Card className="bg-card border-emerald-500/40">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-emerald-400">헬스 프로그램 정보</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-xs text-muted-foreground">이용 기간</Label>
                <div className="flex gap-2 mt-1">
                  {[1, 3, 6, 12].map(m => (
                    <button key={m} type="button"
                      onClick={() => {
                        setHealthMonths(m);
                        const newEnd = calcEndDateByMonths(membershipStart, m);
                        setMembershipEnd(newEnd);
                        const gp = (gymSettings as any)?.healthMonthlyPrice ?? 0;
                        if (gp > 0) setHealthPrice(String(gp * m));
                      }}
                      className={`flex-1 py-1.5 rounded-lg text-sm font-medium border transition-colors ${healthMonths === m ? "bg-emerald-500 text-white border-emerald-500" : "border-border text-muted-foreground hover:bg-accent"}`}>
                      {m}개월
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">운동 시작일</Label>
                  <Input type="date" value={membershipStart}
                    onChange={e => {
                      setMembershipStart(e.target.value);
                      setMembershipEnd(calcEndDateByMonths(e.target.value, healthMonths));
                    }}
                    className="bg-input border-border mt-1" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">운동 만료일</Label>
                  <Input type="date" value={membershipEnd}
                    onChange={e => setMembershipEnd(e.target.value)}
                    className="bg-input border-border mt-1" />
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">결제 금액</Label>
                <Input type="number" min="0" value={healthPrice}
                  onChange={e => setHealthPrice(e.target.value)}
                  placeholder="0" className="bg-input border-border mt-1" />
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── PT 프로그램 정보 ── */}
        {addPt && (
          <Card className="bg-card border-primary/40">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-primary">PT 프로그램 정보</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-xs text-muted-foreground">프로그램명</Label>
                <Input value={isServiceSession ? "" : ptProgram}
                  onChange={e => { setPtProgram(e.target.value); setIsServiceSession(false); }}
                  placeholder="프로그램명 입력"
                  disabled={isServiceSession}
                  className="bg-input border-border mt-1 disabled:opacity-50" />
                <div className="flex gap-1.5 flex-wrap mt-1.5">
                  {PT_PRESETS.map(p => (
                    <button key={p} type="button"
                      onClick={() => { setPtProgram(x => x === p && !isServiceSession ? "" : p); setIsServiceSession(false); }}
                      className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${ptProgram === p && !isServiceSession ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-primary/40"}`}>
                      {p}
                    </button>
                  ))}
                  <button type="button"
                    onClick={() => { setIsServiceSession(s => !s); setPtProgram(""); setPtPrice(""); }}
                    className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${isServiceSession ? "bg-emerald-500 text-white border-emerald-500" : "border-border text-muted-foreground hover:border-emerald-400/60"}`}>
                    서비스세션
                  </button>
                </div>
                {isServiceSession && (
                  <div className="mt-2 bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-3 py-2 flex items-center gap-3">
                    <p className="text-xs text-emerald-400">서비스세션 — 0원 처리</p>
                    <div className="flex-1">
                      <Input type="number" min="0" value={unitPrice}
                        onChange={e => setUnitPrice(e.target.value)}
                        placeholder="단가 (정산기준)"
                        className="bg-background border-border text-xs h-7" />
                    </div>
                  </div>
                )}
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">PT 횟수</Label>
                <div className="flex gap-1.5 flex-wrap mt-1">
                  {SESSION_PRESETS.map(preset => (
                    <button key={preset} type="button"
                      onClick={() => {
                        const next = ptSessions === preset ? "" : preset;
                        setPtSessions(next);
                        if (!addHealth) setMembershipEnd(calcEndDateByPT(membershipStart, next));
                        const gp = (gymSettings as any)?.ptSessionPrice ?? 0;
                        if (gp > 0 && next) setPtPrice(String(gp * parseInt(next)));
                      }}
                      className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${ptSessions === preset ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-primary/40"}`}>
                      {preset}회
                    </button>
                  ))}
                  <Input type="number" min="1" value={ptSessions}
                    onChange={e => {
                      const s = e.target.value;
                      setPtSessions(s);
                      if (!addHealth) setMembershipEnd(calcEndDateByPT(membershipStart, s));
                      const gp = (gymSettings as any)?.ptSessionPrice ?? 0;
                      if (gp > 0 && s) setPtPrice(String(gp * parseInt(s)));
                    }}
                    placeholder="직접 입력" className="bg-input border-border text-xs h-7 w-24" />
                </div>
              </div>
              {!addHealth && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">시작일</Label>
                    <Input type="date" value={membershipStart}
                      onChange={e => { setMembershipStart(e.target.value); setMembershipEnd(calcEndDateByPT(e.target.value, ptSessions)); }}
                      className="bg-input border-border mt-1" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">만료일 <span className="text-primary text-[10px]">(자동)</span></Label>
                    <Input type="date" value={membershipEnd} readOnly className="bg-input border-border mt-1 opacity-60 cursor-not-allowed" />
                  </div>
                </div>
              )}
              {!isServiceSession && (
                <div>
                  <Label className="text-xs text-muted-foreground">결제 금액</Label>
                  <Input type="number" min="0" value={ptPrice}
                    onChange={e => setPtPrice(e.target.value)}
                    placeholder="0" className="bg-input border-border mt-1" />
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* ── 락커 프로그램 정보 ── */}
        {addLocker && (
          <Card className="bg-card border-amber-500/40">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-amber-400">락커 프로그램 정보</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-xs text-muted-foreground">락커 선택 <span className="text-primary">*</span></Label>
                {availableLockers.length === 0 ? (
                  <p className="text-xs text-muted-foreground mt-1">사용 가능한 락커가 없습니다</p>
                ) : (
                  <select value={lockerId} onChange={e => setLockerId(e.target.value)}
                    className="w-full mt-1 rounded-lg px-3 py-2 text-sm bg-input border border-border focus:outline-none focus:ring-1 focus:ring-amber-500">
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
                <div>
                  <Label className="text-xs text-muted-foreground">시작일</Label>
                  <Input type="date" value={membershipStart} readOnly className="bg-input border-border mt-1 opacity-60 cursor-not-allowed" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">만료일</Label>
                  <Input type="date" value={lockerEnd}
                    onChange={e => setLockerEnd(e.target.value)}
                    className="bg-input border-border mt-1" />
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">결제 금액</Label>
                <Input type="number" min="0" value={lockerPrice}
                  onChange={e => setLockerPrice(e.target.value)}
                  placeholder="0" className="bg-input border-border mt-1" />
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── 운동복 프로그램 정보 ── */}
        {addUniform && (
          <Card className="bg-card border-purple-500/40">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-purple-400">운동복 프로그램 정보</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">시작일</Label>
                  <Input type="date" value={membershipStart} readOnly className="bg-input border-border mt-1 opacity-60 cursor-not-allowed" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">만료일</Label>
                  <Input type="date" value={uniformEnd}
                    onChange={e => setUniformEnd(e.target.value)}
                    className="bg-input border-border mt-1" />
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">결제 금액</Label>
                <Input type="number" min="0" value={uniformPrice}
                  onChange={e => setUniformPrice(e.target.value)}
                  placeholder="0 (무료)" className="bg-input border-border mt-1" />
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── 서비스 내역 ── */}
        {(addPt || addHealth) && (
          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">
                서비스 내역 <span className="text-xs font-normal text-muted-foreground">무료 제공 항목</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {[
                { id: "PT", label: "PT", color: "blue" },
                { id: "헬스", label: "헬스", color: "emerald" },
                { id: "락커", label: "락커", color: "amber" },
                { id: "운동복", label: "운동복", color: "purple" },
              ].map(({ id, label, color }) => {
                const sel = serviceItems.includes(id);
                return (
                  <div key={id} className={`rounded-xl border transition-colors ${sel ? `border-${color}-500/60 bg-${color}-500/5` : "border-border"}`}>
                    <button type="button"
                      onClick={() => {
                        setServiceItems(s => sel ? s.filter(x => x !== id) : [...s, id]);
                        if (id === "PT") setServicePtCount(undefined);
                        if (id === "헬스") { setServiceHealthMonths(undefined); setServiceHealthCustom(""); }
                        if (id === "락커") setServiceLockerNum("");
                      }}
                      className="w-full flex items-center justify-between px-4 py-2.5 text-sm font-medium">
                      <span className={sel ? `text-${color}-400` : "text-muted-foreground"}>{label}</span>
                      {sel && <span className={`text-[10px] px-2 py-0.5 rounded-full bg-${color}-500/20 text-${color}-400`}>선택됨</span>}
                    </button>
                    {sel && id === "PT" && (
                      <div className="px-4 pb-3 border-t border-blue-500/20 pt-2 flex gap-2">
                        {[1, 2, 3].map(n => (
                          <button key={n} type="button"
                            onClick={() => setServicePtCount(c => c === n ? undefined : n)}
                            className={`flex-1 py-1.5 rounded-lg text-xs font-medium border ${servicePtCount === n ? "bg-blue-500 text-white border-blue-500" : "bg-background border-border text-muted-foreground"}`}>
                            +{n}회
                          </button>
                        ))}
                        <Input type="number" min={1}
                          value={servicePtCount && ![1,2,3].includes(servicePtCount) ? servicePtCount : ""}
                          onChange={e => setServicePtCount(e.target.value ? parseInt(e.target.value) : undefined)}
                          placeholder="직접입력" className="bg-input border-border text-xs h-8 w-20" />
                      </div>
                    )}
                    {sel && id === "헬스" && (
                      <div className="px-4 pb-3 border-t border-emerald-500/20 pt-2 space-y-2">
                        <div className="flex gap-2">
                          {[1, 3, 6, 12].map(m => (
                            <button key={m} type="button"
                              onClick={() => { setServiceHealthMonths(v => v === m ? undefined : m); setServiceHealthCustom(""); }}
                              className={`flex-1 py-1.5 rounded-lg text-xs font-medium border ${serviceHealthMonths === m ? "bg-emerald-500 text-white border-emerald-500" : "bg-background border-border text-muted-foreground"}`}>
                              {m}개월
                            </button>
                          ))}
                        </div>
                        <Input type="number" min={1} value={serviceHealthCustom}
                          onChange={e => { setServiceHealthCustom(e.target.value); setServiceHealthMonths(undefined); }}
                          placeholder="직접 입력 (일)" className="bg-input border-border text-xs h-8" />
                      </div>
                    )}
                    {sel && id === "락커" && (
                      <div className="px-4 pb-3 border-t border-amber-500/20 pt-2">
                        <select value={serviceLockerNum} onChange={e => setServiceLockerNum(e.target.value)}
                          className="w-full rounded-lg px-3 py-1.5 text-xs bg-input border border-border">
                          <option value="">락커 선택...</option>
                          {lockerGroups.flatMap(g => g.lockers.map((l: any) => (
                            <option key={l.id} value={l.lockerNumber}>{l.lockerNumber}</option>
                          )))}
                        </select>
                      </div>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        {/* ── 공통 결제 정보 ── */}
        {anySelected && (
          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">결제 정보</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">결제방법</Label>
                  <Select value={paymentMethod} onValueChange={v => setPaymentMethod(v as any)}>
                    <SelectTrigger className="bg-input border-border mt-1">
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
                <div>
                  <Label className="text-xs text-muted-foreground">결제일자</Label>
                  <Input type="date" value={paymentDate}
                    onChange={e => setPaymentDate(e.target.value)}
                    className="bg-input border-border mt-1" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">미수금</Label>
                  <Input type="number" min="0" placeholder="0"
                    value={unpaidAmount} onChange={e => setUnpaidAmount(e.target.value)}
                    className="bg-input border-border mt-1" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">메모</Label>
                  <Input type="text" placeholder="분납 등"
                    value={paymentMemo} onChange={e => setPaymentMemo(e.target.value)}
                    className="bg-input border-border mt-1" />
                </div>
              </div>

              {/* 총 결제 합계 */}
              <div className="rounded-xl bg-background border border-border p-3 space-y-1.5">
                {addHealth && (
                  <div className="flex justify-between text-sm">
                    <span className="text-emerald-400">헬스 {healthMonths}개월</span>
                    <span className="font-medium">{healthPrice ? parseInt(healthPrice).toLocaleString() : 0}원</span>
                  </div>
                )}
                {addPt && !isServiceSession && (
                  <div className="flex justify-between text-sm">
                    <span className="text-primary">PT {ptSessions ? `${ptSessions}회` : ""}</span>
                    <span className="font-medium">{ptPrice ? parseInt(ptPrice).toLocaleString() : 0}원</span>
                  </div>
                )}
                {addPt && isServiceSession && (
                  <div className="flex justify-between text-sm">
                    <span className="text-emerald-400">PT 서비스세션</span>
                    <span className="font-medium text-emerald-400">0원</span>
                  </div>
                )}
                {addLocker && (
                  <div className="flex justify-between text-sm">
                    <span className="text-amber-400">락커</span>
                    <span className="font-medium">{lockerPrice ? parseInt(lockerPrice).toLocaleString() : 0}원</span>
                  </div>
                )}
                {addUniform && (
                  <div className="flex justify-between text-sm">
                    <span className="text-purple-400">운동복</span>
                    <span className="font-medium">{uniformPrice ? parseInt(uniformPrice).toLocaleString() : 0}원</span>
                  </div>
                )}
                {unpaidAmount && parseInt(unpaidAmount) > 0 && (
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>미수금</span>
                    <span className="text-red-400">-{parseInt(unpaidAmount).toLocaleString()}원</span>
                  </div>
                )}
                <div className="flex justify-between text-base font-bold pt-1.5 border-t border-border">
                  <span>합계</span>
                  <span className="text-primary">{totalAmount.toLocaleString()}원</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex gap-3 pb-4">
          <Button type="button" variant="outline" className="flex-1" onClick={() => setLocation("/members")}>
            취소
          </Button>
          <Button type="submit" className="flex-1" disabled={isPending || !selectedMemberId || !anySelected}>
            {isPending ? "처리 중..." : `${totalAmount > 0 ? totalAmount.toLocaleString() + "원 " : ""}등록 완료`}
          </Button>
        </div>
      </form>
    </div>
  );
}
