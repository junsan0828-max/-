import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft } from "lucide-react";

const PAYMENT_METHODS = ["카드", "현금", "현금영수증", "계좌이체", "지역화폐", "분할결제", "혼합"] as const;
const PT_PROGRAMS = ["케어피티", "웨이트피티", "이벤트피티", "기타"];

interface Props {
  memberId?: number;
  defaultTrainerId?: number;
}

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

export default function MemberForm({ memberId, defaultTrainerId }: Props) {
  const [, setLocation] = useLocation();
  const isEdit = !!memberId;

  const [itemTypes, setItemTypes] = useState<string[]>([]);
  const [healthMonths, setHealthMonths] = useState<number | "">(1);

  // 락커
  const [addLocker, setAddLocker] = useState(false);
  const [lockerId, setLockerId] = useState("");
  const [lockerMonths, setLockerMonths] = useState(1);
  const [lockerPrice, setLockerPrice] = useState("");
  const [lockerEnd, setLockerEnd] = useState("");

  // 운동복
  const [addUniform, setAddUniform] = useState(false);
  const [uniformMonths, setUniformMonths] = useState(1);
  const [uniformPrice, setUniformPrice] = useState("");
  const [uniformEnd, setUniformEnd] = useState("");

  // 지점
  const [branchId, setBranchId] = useState<number | null>(null);

  // 서비스 내역
  const [serviceItems, setServiceItems] = useState<string[]>([]);
  const [servicePtCount, setServicePtCount] = useState<number | undefined>(undefined);
  const [serviceHealthMonths, setServiceHealthMonths] = useState<number | undefined>(undefined);
  const [serviceHealthCustom, setServiceHealthCustom] = useState("");
  const [serviceLockerNum, setServiceLockerNum] = useState("");

  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    birthDate: "",
    gender: "" as "male" | "female" | "other" | "",
    grade: "basic" as "basic" | "premium" | "vip",
    status: "active" as "active" | "paused",
    membershipStart: "",
    membershipEnd: "",
    profileNote: "",
    ptProgram: "",
    ptSessions: "",
    paymentAmount: "",
    discountAmount: "",
    unpaidAmount: "",
    visitRoute: "",
    paymentMethod: "" as "" | "카드" | "현금" | "현금영수증" | "계좌이체" | "지역화폐" | "분할결제" | "혼합",
    paymentDate: "",
    paymentMemo: "",
    adminTrainerId: defaultTrainerId ? String(defaultTrainerId) : "",
    serviceSessions: "",
    serviceSessionPrice: "",
    subType: "신규" as "신규" | "재등록",
  });

  const [ptTransferAmount, setPtTransferAmount] = useState("");
  const [ptCardAmount, setPtCardAmount] = useState("");

  const [errors, setErrors] = useState<Record<string, string>>({});

  const today = new Date().toISOString().substring(0, 10);
  const { data: currentUser } = trpc.auth.me.useQuery();
  const { data: trainerList } = trpc.trainers.list.useQuery();
  const { data: allMembers = [] } = trpc.members.list.useQuery();
  const { data: ptEvents } = trpc.eventPrograms.list.useQuery({ type: "PT", activeOnly: true });
  const { data: allLockers } = trpc.access.getLockers.useQuery();
  const { data: branchList } = trpc.gym.staff.listBranches.useQuery();
  const { data: gymSettings } = trpc.gym.settings.get.useQuery();
  const { data: existingMember } = trpc.members.getById.useQuery(
    { id: memberId! },
    { enabled: isEdit }
  );

  useEffect(() => {
    if (existingMember) {
      setForm((p) => ({
        ...p,
        name: existingMember.name ?? "",
        phone: existingMember.phone ?? "",
        email: existingMember.email ?? "",
        birthDate: existingMember.birthDate ?? "",
        gender: (existingMember.gender as any) ?? "",
        grade: existingMember.grade as any,
        status: existingMember.status as any,
        membershipStart: existingMember.membershipStart ?? "",
        membershipEnd: existingMember.membershipEnd ?? "",
        profileNote: existingMember.profileNote ?? "",
        visitRoute: (existingMember as any).visitRoute ?? "",
      }));
    }
  }, [existingMember]);

  const registerMutation = trpc.gym.register.useMutation({
    onError: (err) => toast.error(err.message || "등록 실패"),
  });

  const updateMutation = trpc.members.update.useMutation({
    onError: (err) => toast.error(err.message || "수정 실패"),
  });

  const assignLockerMutation = trpc.access.assignLocker.useMutation({
    onError: (err) => toast.error("락커 배정 실패: " + (err.message || "")),
  });

  const createUniformMutation = trpc.access.createUniform.useMutation({
    onError: (err) => toast.error("운동복 등록 실패: " + (err.message || "")),
  });

  // 락커 가격 자동 기입
  useEffect(() => {
    if (!gymSettings || !addLocker) return;
    const price = (gymSettings as any).lockerMonthlyPrice ?? 0;
    if (price > 0) setLockerPrice(String(price * lockerMonths));
  }, [gymSettings, addLocker, lockerMonths]);

  // 운동복 가격 자동 기입
  useEffect(() => {
    if (!gymSettings || !addUniform) return;
    const price = (gymSettings as any).uniformPrice ?? 0;
    if (price > 0) setUniformPrice(String(price));
  }, [gymSettings, addUniform]);

  // 락커/운동복 종료일 자동 계산
  useEffect(() => {
    const start = form.membershipStart || today;
    setLockerEnd(calcEndDateByMonths(start, lockerMonths));
  }, [form.membershipStart, lockerMonths]);

  useEffect(() => {
    const start = form.membershipStart || today;
    setUniformEnd(calcEndDateByMonths(start, uniformMonths));
  }, [form.membershipStart, uniformMonths]);

  // 사용 가능 락커 그룹
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

  const hasPT = itemTypes.includes("PT");
  const hasHealth = itemTypes.includes("헬스");
  const hasOther = itemTypes.includes("기타");

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!form.name.trim()) newErrors.name = "이름을 입력해주세요.";
    if (!form.phone.trim()) newErrors.phone = "연락처를 입력해주세요.";
    if (!isEdit && itemTypes.length === 0) newErrors.itemTypes = "항목 유형을 선택해주세요.";
    if (!isEdit && form.paymentAmount && parseInt(form.paymentAmount) > 0) {
      if (!form.paymentMethod) newErrors.paymentMethod = "결제 방법을 선택해주세요.";
      if (!form.paymentDate) newErrors.paymentDate = "결제일자를 입력해주세요.";
    }
    if (!isEdit && form.name.trim() && form.phone.trim()) {
      const dup = allMembers.find(
        m => m.name.trim() === form.name.trim() && m.phone?.trim() === form.phone.trim()
      );
      if (dup) newErrors.name = "동일한 이름, 연락처가 중복되었습니다.";
    }
    return newErrors;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors = validateForm();
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      toast.error("입력 정보를 확인해주세요.");
      return;
    }
    if (addLocker && !lockerId) { toast.error("배정할 락커를 선택해주세요"); return; }
    setErrors({});

    const resolvedPtProgram = hasPT ? form.ptProgram || undefined : undefined;
    const siStr = serviceItems.length > 0 ? serviceItems.map(item => {
      if (item === "PT" && servicePtCount) return `PT(${servicePtCount}회)`;
      if (item === "헬스") {
        const m = serviceHealthMonths ?? (serviceHealthCustom ? parseInt(serviceHealthCustom) : undefined);
        return m ? `헬스(${m}일)` : "헬스";
      }
      if (item === "락커" && serviceLockerNum) return `락커(${serviceLockerNum})`;
      return item;
    }).join(",") : undefined;

    try {
      let savedMemberId: number;
      if (isEdit) {
        const payload = {
          ...form,
          gender: form.gender || undefined,
          birthDate: form.birthDate || undefined,
          membershipStart: form.membershipStart || today,
          membershipEnd: form.membershipEnd || undefined,
          email: form.email || undefined,
          phone: form.phone || undefined,
          profileNote: form.profileNote || undefined,
          paymentAmount: form.paymentAmount ? parseInt(form.paymentAmount) : undefined,
          discountAmount: form.discountAmount ? parseInt(form.discountAmount) : undefined,
          unpaidAmount: form.unpaidAmount ? parseInt(form.unpaidAmount) : undefined,
          visitRoute: form.visitRoute || undefined,
          paymentMethod: form.paymentMethod || undefined,
          paymentDate: form.paymentDate || undefined,
          paymentMemo: form.paymentMemo || undefined,
          adminTrainerId: form.adminTrainerId ? parseInt(form.adminTrainerId) : undefined,
          serviceSessions: (hasPT && form.serviceSessions) ? parseInt(form.serviceSessions) : undefined,
          serviceSessionPrice: (hasPT && form.serviceSessionPrice) ? parseInt(form.serviceSessionPrice) : undefined,
          subType: form.subType,
          primaryType: hasPT ? "PT" : hasHealth ? "헬스" : hasOther ? "기타" : undefined,
          branchId: branchId ?? undefined,
          ptSessions: (hasPT && form.ptSessions) ? form.ptSessions : undefined,
          ptProgram: resolvedPtProgram,
          serviceItems: siStr,
        };
        await updateMutation.mutateAsync({ id: memberId!, ...payload });
        savedMemberId = memberId!;
      } else {
        // 신규 등록: gym.register (단일 원자 호출)
        const paymentAmt = form.paymentAmount ? parseInt(form.paymentAmount) : 0;
        const result = await registerMutation.mutateAsync({
          name: form.name,
          phone: form.phone || undefined,
          email: form.email || undefined,
          birthDate: form.birthDate || undefined,
          gender: form.gender || undefined,
          grade: form.grade,
          status: form.status,
          profileNote: form.profileNote || undefined,
          visitRoute: form.visitRoute || undefined,
          signatureDataUrl: undefined,
          membershipStart: form.membershipStart || today,
          membershipEnd: form.membershipEnd || undefined,
          trainerId: form.adminTrainerId ? parseInt(form.adminTrainerId) : undefined,
          branchId: branchId ?? undefined,
          subType: form.subType,
          serviceItems: siStr,
          paymentMethod: form.paymentMethod || undefined,
          paymentDate: form.paymentDate || undefined,
          unpaidAmount: form.unpaidAmount ? parseInt(form.unpaidAmount) : undefined,
          discountAmount: form.discountAmount ? parseInt(form.discountAmount) : undefined,
          paymentMemo: form.paymentMemo || undefined,
          ptTransferAmount: form.paymentMethod === "혼합" && ptTransferAmount ? parseInt(ptTransferAmount) : undefined,
          ptCardAmount: form.paymentMethod === "혼합" && ptCardAmount ? parseInt(ptCardAmount) : undefined,
          // 헬스권
          addHealth: hasHealth || undefined,
          healthMonths: hasHealth ? (typeof healthMonths === "number" ? healthMonths : 1) : undefined,
          healthPrice: hasHealth ? paymentAmt : undefined,
          // PT
          addPt: hasPT || undefined,
          ptProgram: resolvedPtProgram,
          ptSessions: hasPT && form.ptSessions ? parseInt(form.ptSessions) : undefined,
          ptPrice: hasPT ? paymentAmt : undefined,
          serviceSessions: hasPT && form.serviceSessions ? parseInt(form.serviceSessions) : undefined,
          serviceSessionPrice: hasPT && form.serviceSessionPrice ? parseInt(form.serviceSessionPrice) : undefined,
          // 기타
          addOther: hasOther || undefined,
          otherDetail: hasOther ? form.ptProgram || undefined : undefined,
          otherPrice: hasOther ? paymentAmt : undefined,
          // 락커
          lockerId: addLocker && lockerId ? parseInt(lockerId) : undefined,
          lockerStartDate: addLocker ? form.membershipStart || today : undefined,
          lockerEndDate: addLocker ? lockerEnd || undefined : undefined,
          lockerRentalType: addLocker ? (lockerPrice && parseInt(lockerPrice) > 0 ? "paid" : "service") : undefined,
          // 운동복
          addUniform: addUniform || undefined,
          uniformStartDate: addUniform ? form.membershipStart || today : undefined,
          uniformEndDate: addUniform ? uniformEnd || undefined : undefined,
          uniformRentalType: addUniform ? (uniformPrice && parseInt(uniformPrice) > 0 ? "paid" : "service") : undefined,
          uniformPrice: addUniform ? (uniformPrice ? parseInt(uniformPrice) : 0) : undefined,
        });
        savedMemberId = result.memberId;
        // 서비스 락커 실제 배정
        if (serviceItems.includes("락커") && serviceLockerNum && savedMemberId) {
          const lockerToAssign = (allLockers ?? []).find((l: any) => l.lockerNumber === serviceLockerNum);
          if (lockerToAssign) {
            await assignLockerMutation.mutateAsync({
              lockerId: lockerToAssign.id,
              memberId: savedMemberId,
              memberName: form.name,
              memberPhone: form.phone || undefined,
              rentalType: "service",
            });
          }
        }
      }

      toast.success(isEdit ? "회원 정보가 수정되었습니다." : "회원이 등록되었습니다.");
      setLocation(`/members/${savedMemberId}`);
    } catch {
      // individual mutations already toast errors
    }
  };

  const isPending = registerMutation.isPending || updateMutation.isPending || assignLockerMutation.isPending || createUniformMutation.isPending;

  // 실결제 자동 계산
  const computedPaid = Math.max(0,
    (parseInt(form.paymentAmount) || 0) - (parseInt(form.discountAmount) || 0) - (parseInt(form.unpaidAmount) || 0)
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button
          onClick={() => setLocation(isEdit ? `/members/${memberId}` : "/members")}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-xl font-bold">{isEdit ? "회원 정보 수정" : "신규 회원 등록"}</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* 기본 정보 */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-4">
            <CardTitle className="text-base font-semibold">기본 정보</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {currentUser?.role === "admin" && !isEdit && (
              <div className="space-y-1.5">
                <Label className="text-sm text-muted-foreground">
                  상담 담당자
                </Label>
                <Select
                  value={form.adminTrainerId}
                  onValueChange={(v) => setForm((p) => ({ ...p, adminTrainerId: v }))}
                >
                  <SelectTrigger className="bg-input border-border">
                    <SelectValue placeholder="담당자 선택 (선택사항)" />
                  </SelectTrigger>
                  <SelectContent>
                    {trainerList?.map((t) => (
                      <SelectItem key={t.id} value={String(t.id)}>{t.trainerName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.adminTrainerId && <p className="text-xs text-red-500">{errors.adminTrainerId}</p>}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="name" className="text-sm text-muted-foreground">
                  이름 <span className="text-primary">*</span>
                </Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="홍길동"
                  className={`bg-input border-border ${errors.name ? "border-red-500" : ""}`}
                />
                {errors.name && <p className="text-xs text-red-500">{errors.name}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="phone" className="text-sm text-muted-foreground">연락처 <span className="text-primary">*</span></Label>
                <Input
                  id="phone"
                  value={form.phone}
                  onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                  placeholder="010-0000-0000"
                  className={`bg-input border-border ${errors.phone ? "border-red-500" : ""}`}
                />
                {errors.phone && <p className="text-xs text-red-500">{errors.phone}</p>}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="birthDate" className="text-sm text-muted-foreground">생년월일</Label>
                <Input
                  id="birthDate"
                  type="date"
                  value={form.birthDate}
                  onChange={(e) => setForm((p) => ({ ...p, birthDate: e.target.value }))}
                  className="bg-input border-border"
                />
                {form.birthDate && (() => {
                  const birth = new Date(form.birthDate);
                  const todayD = new Date();
                  let age = todayD.getFullYear() - birth.getFullYear();
                  const mo = todayD.getMonth() - birth.getMonth();
                  if (mo < 0 || (mo === 0 && todayD.getDate() < birth.getDate())) age--;
                  return <p className="text-xs text-primary mt-1">만 {age}세</p>;
                })()}
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm text-muted-foreground">성별</Label>
                <Select value={form.gender} onValueChange={(v) => setForm((p) => ({ ...p, gender: v as any }))}>
                  <SelectTrigger className="bg-input border-border">
                    <SelectValue placeholder="선택" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">남성</SelectItem>
                    <SelectItem value="female">여성</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-sm text-muted-foreground">등급</Label>
                <Select value={form.grade} onValueChange={(v) => setForm((p) => ({ ...p, grade: v as any }))}>
                  <SelectTrigger className="bg-input border-border"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="basic">기본</SelectItem>
                    <SelectItem value="vip">VIP</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm text-muted-foreground">상태</Label>
                <Select value={form.status} onValueChange={(v) => setForm((p) => ({ ...p, status: v as any }))}>
                  <SelectTrigger className="bg-input border-border"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">활성</SelectItem>
                    <SelectItem value="paused">정지</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="visitRoute" className="text-sm text-muted-foreground">유입경로</Label>
              <select id="visitRoute" value={form.visitRoute} onChange={(e) => setForm((p) => ({ ...p, visitRoute: e.target.value }))}
                className="w-full bg-input border border-border rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring">
                <option value="">선택 안함</option>
                <option value="지인 소개">지인 소개</option>
                <option value="가족 소개">가족 소개</option>
                <option value="네이버 검색">네이버 검색</option>
                <option value="네이버플레이스">네이버플레이스</option>
                <option value="카카오맵">카카오맵</option>
                <option value="인스타그램">인스타그램</option>
                <option value="유튜브">유튜브</option>
                <option value="블로그">블로그</option>
                <option value="현수막/전단지">현수막/전단지</option>
                <option value="워크인">워크인</option>
                <option value="재등록">재등록</option>
                <option value="기타">기타</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="profileNote" className="text-sm text-muted-foreground">특이사항</Label>
              <Input id="profileNote" value={form.profileNote} onChange={(e) => setForm((p) => ({ ...p, profileNote: e.target.value }))} placeholder="특이사항 입력" className="bg-input border-border"/>
            </div>
          </CardContent>
        </Card>

        {/* ── 등록 정보 (신규 등록 시만) ── */}
        {!isEdit && (
          <Card className="bg-card border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">등록 상세 정보</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">

              {/* 항목 유형 */}
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground">항목 유형 * (복수 선택 가능)</label>
                {errors.itemTypes && <p className="text-xs text-red-500">{errors.itemTypes}</p>}

                {/* PT */}
                <div className={`rounded-xl border transition-colors ${hasPT ? "border-primary/60 bg-primary/5" : "border-border"}`}>
                  <button type="button" onClick={() => setItemTypes(t => hasPT ? t.filter(x => x !== "PT") : [...t, "PT"])}
                    className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold">
                    <span className={hasPT ? "text-primary" : "text-muted-foreground"}>PT</span>
                    {hasPT && <span className="text-[10px] text-primary bg-primary/10 px-2 py-0.5 rounded-full">선택됨</span>}
                  </button>
                  {hasPT && (
                    <div className="px-4 pb-4 space-y-3 border-t border-primary/20 pt-3">
                      <div>
                        <label className="text-xs text-muted-foreground">PT 프로그램</label>
                        <div className="grid grid-cols-2 gap-2 mt-1">
                          {PT_PROGRAMS.map(p => (
                            <button key={p} type="button"
                              onClick={() => setForm(f => ({ ...f, ptProgram: f.ptProgram === p ? "" : p }))}
                              className={`py-2 rounded-lg text-sm font-medium border transition-colors ${form.ptProgram === p ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border text-muted-foreground"}`}>
                              {p}
                            </button>
                          ))}
                        </div>
                        {form.ptProgram === "기타" && (
                          <input value={form.ptProgram === "기타" ? "" : form.ptProgram}
                            onChange={e => setForm(f => ({ ...f, ptProgram: e.target.value }))}
                            placeholder="프로그램명 입력"
                            className="w-full mt-2 rounded-lg px-3 py-2 text-sm text-foreground bg-input border border-border focus:outline-none" />
                        )}
                        {form.ptProgram === "이벤트피티" && (
                          <div className="mt-2">
                            <select
                              className="w-full h-9 rounded-lg px-3 text-sm text-foreground focus:outline-none bg-input border border-border"
                              defaultValue=""
                              onChange={e => {
                                const ev = (ptEvents ?? []).find((x: any) => String(x.id) === e.target.value);
                                if (ev) setForm(f => ({ ...f, serviceSessions: String(ev.serviceSessions), serviceSessionPrice: String(ev.serviceSessionPrice ?? 0) }));
                              }}>
                              <option value="" disabled>이벤트 선택...</option>
                              {(ptEvents ?? []).map((ev: any) => (
                                <option key={ev.id} value={String(ev.id)}>
                                  {ev.name} (서비스 +{ev.serviceSessions}회{ev.serviceSessionPrice > 0 ? ` · ${ev.serviceSessionPrice.toLocaleString()}원/회` : ""})
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">PT 횟수</label>
                        <Input
                          type="number"
                          min="1"
                          value={form.ptSessions}
                          onChange={e => {
                            const s = e.target.value;
                            setForm(p => ({ ...p, ptSessions: s, membershipEnd: calcEndDateByPT(p.membershipStart, s) }));
                          }}
                          placeholder="횟수 직접 입력"
                          className="bg-input border-border mt-1"
                        />
                        <div className="flex gap-1.5 flex-wrap mt-1.5">
                          {["10", "20", "30", "40", "50"].map(preset => (
                            <button key={preset} type="button"
                              onClick={() => setForm(p => {
                                const next = p.ptSessions === preset ? "" : preset;
                                return { ...p, ptSessions: next, membershipEnd: calcEndDateByPT(p.membershipStart, next) };
                              })}
                              className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${form.ptSessions === preset ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-primary/40"}`}>
                              {preset}회
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* 헬스 */}
                <div className={`rounded-xl border transition-colors ${hasHealth ? "border-emerald-500/60 bg-emerald-500/5" : "border-border"}`}>
                  <button type="button" onClick={() => setItemTypes(t => hasHealth ? t.filter(x => x !== "헬스") : [...t, "헬스"])}
                    className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold">
                    <span className={hasHealth ? "text-emerald-400" : "text-muted-foreground"}>헬스</span>
                    {hasHealth && <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">선택됨</span>}
                  </button>
                  {hasHealth && (
                    <div className="px-4 pb-4 border-t border-emerald-500/20 pt-3">
                      <label className="text-xs text-muted-foreground">이용 기간</label>
                      <div className="flex gap-2 mt-1">
                        {[1, 3, 6, 12].map(m => (
                          <button key={m} type="button"
                            onClick={() => {
                              setHealthMonths(m);
                              if (form.membershipStart) {
                                setForm(p => ({ ...p, membershipEnd: calcEndDateByMonths(p.membershipStart, m) }));
                              }
                            }}
                            className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${healthMonths === m ? "bg-emerald-500 text-white border-emerald-500" : "bg-background border-border text-muted-foreground"}`}>
                            {m}개월
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* 기타 (락커 / 운동복) */}
                <div className={`rounded-xl border transition-colors ${hasOther ? "border-amber-500/60 bg-amber-500/5" : "border-border"}`}>
                  <button type="button" onClick={() => {
                    setItemTypes(t => hasOther ? t.filter(x => x !== "기타") : [...t, "기타"]);
                    if (hasOther) { setAddLocker(false); setAddUniform(false); setLockerId(""); }
                  }}
                    className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold">
                    <span className={hasOther ? "text-amber-400" : "text-muted-foreground"}>기타 <span className="font-normal text-xs">(운동복, 락커 등)</span></span>
                    {hasOther && <span className="text-[10px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full">선택됨</span>}
                  </button>
                  {hasOther && (
                    <div className="px-4 pb-4 border-t border-amber-500/20 pt-3 space-y-3">
                      {/* 락커 배정 */}
                      <div className={`rounded-xl border transition-colors ${addLocker ? "border-amber-400/60 bg-amber-400/5" : "border-border"}`}>
                        <button type="button" onClick={() => { setAddLocker(v => !v); setLockerId(""); }}
                          className="w-full flex items-center justify-between px-3 py-2.5 text-sm font-medium">
                          <span className={addLocker ? "text-amber-400" : "text-muted-foreground"}>락커 배정</span>
                          <div className={`w-10 h-5 rounded-full transition-colors relative ${addLocker ? "bg-amber-500" : "bg-muted"}`}>
                            <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${addLocker ? "left-5" : "left-0.5"}`} />
                          </div>
                        </button>
                        {addLocker && (
                          <div className="px-3 pb-3 space-y-2 border-t border-amber-400/20 pt-2">
                            <select value={lockerId} onChange={e => setLockerId(e.target.value)}
                              className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none">
                              <option value="">락커 선택...</option>
                              {lockerGroups.map(g => (
                                <optgroup key={g.branchId ?? "none"} label={g.name}>
                                  {g.lockers.map((l: any) => <option key={l.id} value={String(l.id)}>락커 {l.lockerNumber}</option>)}
                                </optgroup>
                              ))}
                            </select>
                            {availableLockers.length === 0 && <p className="text-xs text-muted-foreground">사용 가능한 락커가 없습니다</p>}
                            <div className="flex gap-1.5 flex-wrap">
                              {[1, 3, 6, 12].map(m => (
                                <button key={m} type="button" onClick={() => setLockerMonths(m)}
                                  className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${lockerMonths === m ? "bg-amber-500 text-white border-amber-500" : "border-border text-muted-foreground"}`}>
                                  {m}개월
                                </button>
                              ))}
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="text-xs text-muted-foreground">결제 금액</label>
                                <Input type="number" value={lockerPrice} onChange={e => setLockerPrice(e.target.value)}
                                  placeholder="0" className="mt-1 bg-input border-border" />
                              </div>
                              <div>
                                {lockerEnd && <div className="text-xs text-muted-foreground mt-4">종료: {lockerEnd}</div>}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* 운동복 대여 */}
                      <div className={`rounded-xl border transition-colors ${addUniform ? "border-purple-500/60 bg-purple-500/5" : "border-border"}`}>
                        <button type="button" onClick={() => setAddUniform(v => !v)}
                          className="w-full flex items-center justify-between px-3 py-2.5 text-sm font-medium">
                          <span className={addUniform ? "text-purple-400" : "text-muted-foreground"}>운동복 대여</span>
                          <div className={`w-10 h-5 rounded-full transition-colors relative ${addUniform ? "bg-purple-500" : "bg-muted"}`}>
                            <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${addUniform ? "left-5" : "left-0.5"}`} />
                          </div>
                        </button>
                        {addUniform && (
                          <div className="px-3 pb-3 space-y-2 border-t border-purple-500/20 pt-2">
                            <div className="flex gap-1.5 flex-wrap">
                              {[1, 3, 6, 12].map(m => (
                                <button key={m} type="button" onClick={() => setUniformMonths(m)}
                                  className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${uniformMonths === m ? "bg-purple-500 text-white border-purple-500" : "border-border text-muted-foreground"}`}>
                                  {m}개월
                                </button>
                              ))}
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="text-xs text-muted-foreground">결제 금액</label>
                                <Input type="number" value={uniformPrice} onChange={e => setUniformPrice(e.target.value)}
                                  placeholder="0" className="mt-1 bg-input border-border" />
                              </div>
                              <div>
                                {uniformEnd && <div className="text-xs text-muted-foreground mt-4">종료: {uniformEnd}</div>}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* 날짜 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">결제일 *</label>
                  <input type="date" value={form.paymentDate}
                    onChange={e => setForm(f => ({ ...f, paymentDate: e.target.value }))}
                    className="w-full mt-1 rounded-lg px-3 py-2 text-sm text-foreground bg-input border border-border focus:outline-none" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">시작일</label>
                  <input type="date" value={form.membershipStart}
                    onChange={e => {
                      const start = e.target.value;
                      let end = form.membershipEnd;
                      if (hasHealth && healthMonths) end = calcEndDateByMonths(start, Number(healthMonths));
                      else if (hasPT) end = calcEndDateByPT(start, form.ptSessions);
                      setForm(p => ({ ...p, membershipStart: start, membershipEnd: end }));
                    }}
                    className="w-full mt-1 rounded-lg px-3 py-2 text-sm text-foreground bg-input border border-border focus:outline-none" />
                </div>
              </div>

              {/* 금액 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">정가 * (원)</label>
                  <input type="number" value={form.paymentAmount}
                    onChange={e => setForm(f => ({ ...f, paymentAmount: e.target.value }))}
                    placeholder="0"
                    className="w-full mt-1 rounded-lg px-3 py-2 text-sm text-foreground bg-input border border-border focus:outline-none" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">할인 (원)</label>
                  <input type="number" value={form.discountAmount}
                    onChange={e => setForm(f => ({ ...f, discountAmount: e.target.value }))}
                    placeholder="0"
                    className="w-full mt-1 rounded-lg px-3 py-2 text-sm text-foreground bg-input border border-border focus:outline-none" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">실결제 (원)</label>
                  <div className="w-full mt-1 rounded-lg px-3 py-2 text-sm text-foreground bg-input border border-border opacity-70">
                    {computedPaid.toLocaleString()}
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">미수금 (원)</label>
                  <input type="number" value={form.unpaidAmount}
                    onChange={e => setForm(f => ({ ...f, unpaidAmount: e.target.value }))}
                    placeholder="0"
                    className="w-full mt-1 rounded-lg px-3 py-2 text-sm text-foreground bg-input border border-border focus:outline-none" />
                </div>
              </div>

              {/* 결제 방법 */}
              <div>
                <label className="text-xs text-muted-foreground">결제 방법 *</label>
                {errors.paymentMethod && <p className="text-xs text-red-500">{errors.paymentMethod}</p>}
                <div className="grid grid-cols-4 gap-2 mt-1">
                  {PAYMENT_METHODS.map(m => (
                    <button key={m} type="button"
                      onClick={() => setForm(f => ({ ...f, paymentMethod: f.paymentMethod === m ? "" : m as any }))}
                      className={`py-2 rounded-lg text-xs font-medium border transition-colors ${form.paymentMethod === m ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border text-muted-foreground hover:text-foreground"}`}>
                      {m}
                    </button>
                  ))}
                </div>
                {form.paymentMethod === "혼합" && (
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-muted-foreground">이체 금액</label>
                      <input type="number" value={ptTransferAmount}
                        onChange={e => {
                          setPtTransferAmount(e.target.value);
                          const t = parseInt(e.target.value) || 0;
                          const c = parseInt(ptCardAmount) || 0;
                          setForm(f => ({ ...f, paymentAmount: String(t + c) }));
                        }}
                        placeholder="0"
                        className="w-full mt-1 rounded-lg px-3 py-2 text-sm text-foreground bg-input border border-border focus:outline-none" />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">카드 금액</label>
                      <input type="number" value={ptCardAmount}
                        onChange={e => {
                          setPtCardAmount(e.target.value);
                          const t = parseInt(ptTransferAmount) || 0;
                          const c = parseInt(e.target.value) || 0;
                          setForm(f => ({ ...f, paymentAmount: String(t + c) }));
                        }}
                        placeholder="0"
                        className="w-full mt-1 rounded-lg px-3 py-2 text-sm text-foreground bg-input border border-border focus:outline-none" />
                    </div>
                  </div>
                )}
              </div>

              {/* 등록 메모 */}
              <div>
                <label className="text-xs text-muted-foreground">등록 진행 내용</label>
                <textarea value={form.paymentMemo} onChange={e => setForm(f => ({ ...f, paymentMemo: e.target.value }))} rows={2}
                  placeholder="운동 가능 시간, 날짜, 특이사항..."
                  className="w-full mt-1 rounded-lg px-3 py-2 text-sm text-foreground bg-input border border-border focus:outline-none resize-none" />
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
                          <Label className="text-xs text-muted-foreground">제공 일 수</Label>
                          <div className="flex gap-2">
                            {[7, 14, 30, 90].map(d => (
                              <button key={d} type="button"
                                onClick={() => { setServiceHealthMonths(v => v === d ? undefined : d); setServiceHealthCustom(""); }}
                                className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${serviceHealthMonths === d ? "bg-emerald-500 text-white border-emerald-500" : "bg-background border-border text-muted-foreground"}`}>
                                {d}일
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

                {/* 서비스 배지 */}
                {serviceItems.length > 0 && (
                  <div className="flex gap-1.5 flex-wrap mt-1">
                    {serviceItems.map(item => {
                      let label = `🎁 서비스 ${item}`;
                      if (item === "PT" && servicePtCount) label = `🎁 PT +${servicePtCount}회`;
                      else if (item === "헬스") {
                        const m = serviceHealthMonths ?? (serviceHealthCustom ? parseInt(serviceHealthCustom) : 0);
                        if (m) label = `🎁 헬스 +${m}일`;
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

              {/* 지점 */}
              {branchList && branchList.length > 0 && (
                <div className="pt-2 border-t border-border">
                  <label className="text-xs text-muted-foreground">지점</label>
                  <div className="flex gap-2 mt-1 flex-wrap">
                    <button type="button" onClick={() => setBranchId(null)}
                      className={`px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${branchId === null ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border text-muted-foreground hover:text-foreground"}`}>
                      미지정
                    </button>
                    {branchList.map((b: any) => (
                      <button key={b.id} type="button" onClick={() => setBranchId(b.id)}
                        className={`px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${branchId === b.id ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border text-muted-foreground hover:text-foreground"}`}>
                        {b.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

            </CardContent>
          </Card>
        )}

        {/* 수정 모드: 운동 기간 */}
        {isEdit && (
          <Card className="bg-card border-border">
            <CardHeader className="pb-4">
              <CardTitle className="text-base font-semibold">운동 기간</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="membershipStart" className="text-sm text-muted-foreground">운동 시작일</Label>
                  <Input id="membershipStart" type="date" value={form.membershipStart}
                    onChange={e => setForm(p => ({ ...p, membershipStart: e.target.value }))}
                    className="bg-input border-border" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="membershipEnd" className="text-sm text-muted-foreground">운동 만료일</Label>
                  <Input id="membershipEnd" type="date" value={form.membershipEnd}
                    onChange={e => setForm(p => ({ ...p, membershipEnd: e.target.value }))}
                    className="bg-input border-border" />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex gap-3 pb-4">
          <Button type="button" variant="outline" className="flex-1"
            onClick={() => setLocation(isEdit ? `/members/${memberId}` : "/members")}>
            취소
          </Button>
          <Button type="submit" className="flex-1" disabled={isPending}>
            {isPending ? "저장 중..." : isEdit ? "수정 완료" : "등록 완료"}
          </Button>
        </div>
      </form>
    </div>
  );
}
