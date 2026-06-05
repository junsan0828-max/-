import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Dumbbell, Activity } from "lucide-react";

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
  const { data: members = [] } = trpc.members.list.useQuery();
  const { data: allLockers } = trpc.access.getLockers.useQuery();
  const { data: branchList } = trpc.gym.staff.listBranches.useQuery();
  const { data: gymSettings } = trpc.gym.settings.get.useQuery();

  const [selectedMemberId, setSelectedMemberId] = useState("");
  const [regType, setRegType] = useState<"" | "health" | "pt">("");
  const [healthMonths, setHealthMonths] = useState<number | "">(1);

  // 서비스 내역
  const [serviceItems, setServiceItems] = useState<string[]>([]);
  const [servicePtCount, setServicePtCount] = useState<number | undefined>(undefined);
  const [serviceHealthMonths, setServiceHealthMonths] = useState<number | undefined>(undefined);
  const [serviceHealthCustom, setServiceHealthCustom] = useState("");
  const [serviceLockerNum, setServiceLockerNum] = useState("");

  const [form, setForm] = useState({
    membershipStart: "",
    membershipEnd: "",
    ptProgram: "",
    isServiceSession: false,
    unitPrice: "",
    ptSessions: "",
    paymentAmount: "",
    unpaidAmount: "",
    paymentMethod: "" as "" | "현금영수증" | "이체" | "지역화폐" | "카드",
    paymentDate: "",
    paymentMemo: "",
  });

  const updateMutation = trpc.members.update.useMutation({
    onSuccess: () => {
      toast.success("재등록되었습니다.");
      setLocation(`/members/${selectedMemberId}`);
    },
    onError: (err) => toast.error((err as any).message || "재등록 실패"),
  });

  const selectedMember = members.find(m => String(m.id) === selectedMemberId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMemberId) { toast.error("회원을 선택해주세요"); return; }
    if (!regType) { toast.error("등록 유형을 선택해주세요"); return; }

    const isHealth = regType === "health";

    const memoFinal = (!isHealth && form.isServiceSession)
      ? `서비스세션 단가:${form.unitPrice}${form.paymentMemo ? ` / ${form.paymentMemo}` : ""}`
      : (form.paymentMemo || undefined);

    updateMutation.mutate({
      id: parseInt(selectedMemberId),
      name: selectedMember!.name,
      membershipStart: form.membershipStart || undefined,
      membershipEnd: form.membershipEnd || undefined,
      ptProgram: isHealth ? undefined : (form.isServiceSession ? "서비스세션" : (form.ptProgram || undefined)),
      ptSessions: (!isHealth && form.ptSessions) ? parseInt(form.ptSessions) as any : undefined,
      paymentAmount: (!isHealth && form.isServiceSession) ? 0 : (form.paymentAmount ? parseInt(form.paymentAmount) : undefined),
      unpaidAmount: form.unpaidAmount ? parseInt(form.unpaidAmount) : undefined,
      paymentMethod: form.paymentMethod || undefined,
      paymentDate: form.paymentDate || undefined,
      paymentMemo: memoFinal,
      subType: "재등록" as any,
      serviceItems: serviceItems.length > 0 ? serviceItems.map(item => {
        if (item === "PT" && servicePtCount) return `PT(${servicePtCount}회)`;
        if (item === "헬스") {
          const m = serviceHealthMonths ?? (serviceHealthCustom ? parseInt(serviceHealthCustom) : undefined);
          return m ? `헬스(${m}개월)` : "헬스";
        }
        if (item === "락커" && serviceLockerNum) return `락커(${serviceLockerNum})`;
        return item;
      }).join(",") : undefined,
    } as any);
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

        {/* 등록 유형 선택 */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">등록 유형 선택 <span className="text-primary">*</span></CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  setRegType("health");
                  setForm(p => ({ ...p, ptProgram: "", ptSessions: "", isServiceSession: false, unitPrice: "" }));
                }}
                className={`flex flex-col items-center gap-2.5 p-5 rounded-xl border-2 transition-all ${
                  regType === "health"
                    ? "border-emerald-500 bg-emerald-500/10"
                    : "border-border hover:border-emerald-500/40 hover:bg-accent"
                }`}
              >
                <div className={`p-3 rounded-full ${regType === "health" ? "bg-emerald-500/20" : "bg-muted"}`}>
                  <Activity className={`h-6 w-6 ${regType === "health" ? "text-emerald-400" : "text-muted-foreground"}`} />
                </div>
                <div className="text-center">
                  <p className={`text-sm font-semibold ${regType === "health" ? "text-emerald-400" : "text-foreground"}`}>헬스권</p>
                  <p className="text-xs text-muted-foreground mt-0.5">헬스 이용 등록</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setRegType("pt")}
                className={`flex flex-col items-center gap-2.5 p-5 rounded-xl border-2 transition-all ${
                  regType === "pt"
                    ? "border-primary bg-primary/10"
                    : "border-border hover:border-primary/40 hover:bg-accent"
                }`}
              >
                <div className={`p-3 rounded-full ${regType === "pt" ? "bg-primary/20" : "bg-muted"}`}>
                  <Dumbbell className={`h-6 w-6 ${regType === "pt" ? "text-primary" : "text-muted-foreground"}`} />
                </div>
                <div className="text-center">
                  <p className={`text-sm font-semibold ${regType === "pt" ? "text-primary" : "text-foreground"}`}>PT 등록</p>
                  <p className="text-xs text-muted-foreground mt-0.5">PT + 헬스 포함</p>
                </div>
              </button>
            </div>
          </CardContent>
        </Card>

        {/* 운동 기간 / 결제 (유형 선택 후) */}
        {regType !== "" && (
          <Card className="bg-card border-border">
            <CardHeader className="pb-4">
              <CardTitle className="text-base font-semibold">
                {regType === "health" ? "헬스 기간 및 결제" : "PT 및 헬스 기간·결제"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* 운동 시작일 / 만료일 */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-sm text-muted-foreground">운동 시작일</Label>
                  <Input
                    type="date"
                    value={form.membershipStart}
                    onChange={e => {
                      const start = e.target.value;
                      let end = form.membershipEnd;
                      if (regType === "health" && healthMonths) {
                        end = calcEndDateByMonths(start, Number(healthMonths));
                      } else if (regType === "pt") {
                        end = calcEndDateByPT(start, form.ptSessions);
                      }
                      setForm(p => ({ ...p, membershipStart: start, membershipEnd: end }));
                    }}
                    className="bg-input border-border"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm text-muted-foreground">
                    운동 만료일
                    {regType === "pt" && <span className="text-primary text-xs ml-1">(자동계산)</span>}
                  </Label>
                  <Input
                    type="date"
                    value={form.membershipEnd}
                    readOnly={regType === "pt"}
                    onChange={e => regType !== "pt" && setForm(p => ({ ...p, membershipEnd: e.target.value }))}
                    className={`bg-input border-border ${regType === "pt" ? "opacity-60 cursor-not-allowed" : ""}`}
                  />
                </div>
              </div>

              {/* 헬스권: 이용 기간 버튼 */}
              {regType === "health" && (
                <div className="space-y-1.5">
                  <Label className="text-sm text-muted-foreground">이용 기간</Label>
                  <div className="flex gap-2 flex-wrap">
                    {[1, 3, 6, 12].map(m => (
                      <button key={m} type="button"
                        onClick={() => {
                          setHealthMonths(m);
                          if (form.membershipStart) {
                            setForm(p => ({ ...p, membershipEnd: calcEndDateByMonths(p.membershipStart, m) }));
                          }
                        }}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                          healthMonths === m
                            ? "bg-emerald-500 text-white border-emerald-500"
                            : "border-border text-muted-foreground hover:bg-accent"
                        }`}
                      >
                        {m}개월
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* PT 등록: 프로그램명 */}
              {regType === "pt" && (
                <>
                  <div className="space-y-1.5">
                    <Label className="text-sm text-muted-foreground">프로그램명</Label>
                    <Input
                      value={form.isServiceSession ? "" : form.ptProgram}
                      onChange={e => setForm(p => ({ ...p, ptProgram: e.target.value, isServiceSession: false }))}
                      placeholder="프로그램명 직접 입력"
                      disabled={form.isServiceSession}
                      className="bg-input border-border disabled:opacity-50"
                    />
                    <div className="flex gap-1.5 flex-wrap">
                      {PT_PRESETS.map(preset => (
                        <button
                          key={preset} type="button"
                          onClick={() => setForm(p => ({ ...p, ptProgram: p.ptProgram === preset && !p.isServiceSession ? "" : preset, isServiceSession: false }))}
                          className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
                            form.ptProgram === preset && !form.isServiceSession
                              ? "bg-primary text-primary-foreground border-primary"
                              : "border-border text-muted-foreground hover:border-primary/40"
                          }`}
                        >{preset}</button>
                      ))}
                      <button
                        type="button"
                        onClick={() => setForm(p => ({ ...p, isServiceSession: !p.isServiceSession, ptProgram: "", paymentAmount: "" }))}
                        className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
                          form.isServiceSession
                            ? "bg-emerald-500 text-white border-emerald-500"
                            : "border-border text-muted-foreground hover:border-emerald-400/60"
                        }`}
                      >서비스세션</button>
                    </div>

                    {form.isServiceSession && (
                      <div className="mt-2 bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-3 py-2.5 space-y-2">
                        <p className="text-xs text-emerald-400 font-medium">서비스세션 — 결제금액 0원으로 처리됩니다</p>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">단가 (정산 기준)</Label>
                          <Input
                            type="number" min="0"
                            value={form.unitPrice}
                            onChange={e => setForm(p => ({ ...p, unitPrice: e.target.value }))}
                            placeholder="0"
                            className="bg-background border-border text-sm"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* PT 횟수 */}
                  <div className="space-y-1.5">
                    <Label className="text-sm text-muted-foreground">PT 횟수</Label>
                    <Input
                      type="number" min="1"
                      value={form.ptSessions}
                      onChange={e => {
                        const s = e.target.value;
                        setForm(p => ({ ...p, ptSessions: s, membershipEnd: calcEndDateByPT(p.membershipStart, s) }));
                      }}
                      placeholder="횟수 직접 입력"
                      className="bg-input border-border"
                    />
                    <div className="flex gap-1.5 flex-wrap">
                      {SESSION_PRESETS.map(preset => (
                        <button
                          key={preset} type="button"
                          onClick={() => setForm(p => {
                            const next = p.ptSessions === preset ? "" : preset;
                            return { ...p, ptSessions: next, membershipEnd: calcEndDateByPT(p.membershipStart, next) };
                          })}
                          className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
                            form.ptSessions === preset
                              ? "bg-primary text-primary-foreground border-primary"
                              : "border-border text-muted-foreground hover:border-primary/40"
                          }`}
                        >{preset}회</button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* 결제 정보 (공통) */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-sm text-muted-foreground">결제 금액</Label>
                  <Input
                    type="number" min="0" placeholder="0"
                    value={(regType === "pt" && form.isServiceSession) ? "0" : form.paymentAmount}
                    onChange={e => setForm(p => ({ ...p, paymentAmount: e.target.value }))}
                    disabled={regType === "pt" && form.isServiceSession}
                    className="bg-input border-border disabled:opacity-50"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm text-muted-foreground">미수금 금액</Label>
                  <Input
                    type="number" min="0" placeholder="0"
                    value={form.unpaidAmount}
                    onChange={e => setForm(p => ({ ...p, unpaidAmount: e.target.value }))}
                    className="bg-input border-border"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm text-muted-foreground">결제방법</Label>
                <Select value={form.paymentMethod} onValueChange={v => setForm(p => ({ ...p, paymentMethod: v as any }))}>
                  <SelectTrigger className="bg-input border-border">
                    <SelectValue placeholder="결제방법 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="현금영수증">현금영수증</SelectItem>
                    <SelectItem value="이체">이체</SelectItem>
                    <SelectItem value="지역화폐">지역화폐</SelectItem>
                    <SelectItem value="카드">카드</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm text-muted-foreground">결제일자</Label>
                <Input type="date" value={form.paymentDate} onChange={e => setForm(p => ({ ...p, paymentDate: e.target.value }))} className="bg-input border-border" />
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm text-muted-foreground">결제 메모</Label>
                <Input
                  type="text" placeholder="분납 등 메모"
                  value={form.paymentMemo}
                  onChange={e => setForm(p => ({ ...p, paymentMemo: e.target.value }))}
                  className="bg-input border-border"
                />
              </div>

              {/* 서비스 내역 */}
              <div className="space-y-2 pt-2 border-t border-border">
                <Label className="text-sm text-muted-foreground">서비스 내역 <span className="text-muted-foreground/60">(무료 제공 항목)</span></Label>

                {/* PT */}
                {(() => {
                  const sel = serviceItems.includes("PT");
                  const paid = Number(form.paymentAmount) || 0;
                  const sessions = parseInt(form.ptSessions) || 0;
                  const calcPrice = sessions > 0 ? Math.round(paid / sessions) : 0;
                  const unitPrice = calcPrice > 0 ? calcPrice : (gymSettings?.servicePtUnitPrice ?? 0);
                  return (
                    <div className={`rounded-xl border transition-colors ${sel ? "border-blue-500/60 bg-blue-500/5" : "border-border"}`}>
                      <button type="button"
                        onClick={() => { setServiceItems(s => sel ? s.filter(x => x !== "PT") : [...s, "PT"]); setServicePtCount(undefined); }}
                        className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold">
                        <span className={sel ? "text-blue-400" : "text-muted-foreground"}>PT</span>
                        {unitPrice > 0 && <span className="text-[10px] text-muted-foreground">단가 {unitPrice.toLocaleString()}원/회</span>}
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
                          {servicePtCount && unitPrice > 0 && (
                            <p className="text-xs text-blue-400">서비스 금액 ≈ {(servicePtCount * unitPrice).toLocaleString()}원 상당</p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* 헬스 */}
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
                            placeholder="직접 입력 (개월)" className="bg-input border-border text-sm" />
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* 락커 */}
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

                {/* 운동복 */}
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

                {/* 배지 */}
                {serviceItems.length > 0 && (
                  <div className="flex gap-1.5 flex-wrap mt-1">
                    {serviceItems.map(item => {
                      let label = `🎁 서비스 ${item}`;
                      if (item === "PT" && servicePtCount) label = `🎁 PT +${servicePtCount}회`;
                      else if (item === "헬스") {
                        const m = serviceHealthMonths ?? (serviceHealthCustom ? parseInt(serviceHealthCustom) : 0);
                        if (m) label = `🎁 헬스 +${m}개월`;
                      } else if (item === "락커" && serviceLockerNum) label = `🎁 락커 #${serviceLockerNum}`;
                      const style = item === "PT" ? "bg-blue-500/20 text-blue-400"
                        : item === "헬스" ? "bg-emerald-500/20 text-emerald-400"
                        : item === "락커" ? "bg-amber-500/20 text-amber-400"
                        : "bg-purple-500/20 text-purple-400";
                      return <span key={item} className={`text-xs px-2 py-0.5 rounded-full font-medium ${style}`}>{label}</span>;
                    })}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex gap-3 pb-4">
          <Button type="button" variant="outline" className="flex-1" onClick={() => setLocation("/members")}>
            취소
          </Button>
          <Button type="submit" className="flex-1" disabled={updateMutation.isPending || !selectedMemberId || !regType}>
            {updateMutation.isPending ? "처리 중..." : "재등록 완료"}
          </Button>
        </div>
      </form>
    </div>
  );
}
