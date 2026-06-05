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
import { ArrowLeft, Dumbbell, Activity } from "lucide-react";

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

  const [regType, setRegType] = useState<"" | "health" | "pt">("");
  const [healthMonths, setHealthMonths] = useState<number | "">(1);

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
    unpaidAmount: "",
    visitRoute: "",
    paymentMethod: "" as "" | "현금영수증" | "이체" | "지역화폐" | "카드",
    paymentDate: "",
    paymentMemo: "",
    adminTrainerId: defaultTrainerId ? String(defaultTrainerId) : "",
    serviceSessions: "",
    serviceSessionPrice: "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data: currentUser } = trpc.auth.me.useQuery();
  const { data: trainerList } = trpc.trainers.list.useQuery();
  const { data: allMembers = [] } = trpc.members.list.useQuery();
  const { data: ptEvents } = trpc.eventPrograms.list.useQuery({ type: "PT", activeOnly: true });
  const { data: allLockers } = trpc.access.getLockers.useQuery();
  const { data: branchList } = trpc.gym.staff.listBranches.useQuery();
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

  const createMutation = trpc.members.create.useMutation({
    onSuccess: (data) => {
      toast.success("회원이 등록되었습니다.");
      setLocation(`/members/${data.id}`);
    },
    onError: (err) => toast.error(err.message || "등록 실패"),
  });

  const updateMutation = trpc.members.update.useMutation({
    onSuccess: () => {
      toast.success("회원 정보가 수정되었습니다.");
      setLocation(`/members/${memberId}`);
    },
    onError: (err) => toast.error(err.message || "수정 실패"),
  });

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!form.name.trim()) newErrors.name = "이름을 입력해주세요.";
    if (currentUser?.role === "admin" && !isEdit && !form.adminTrainerId) newErrors.adminTrainerId = "담당 트레이너를 선택해주세요.";
    if (!isEdit && !regType) newErrors.regType = "등록 유형을 선택해주세요.";
    if (!isEdit && form.name.trim() && form.phone.trim()) {
      const dup = allMembers.find(
        m => m.name.trim() === form.name.trim() && m.phone?.trim() === form.phone.trim()
      );
      if (dup) newErrors.name = "동일한 이름, 연락처가 중복되었습니다.";
    }
    return newErrors;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors = validateForm();
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      toast.error("입력 정보를 확인해주세요.");
      return;
    }
    setErrors({});

    const isHealth = regType === "health";

    const payload = {
      ...form,
      ptSessions: (!isHealth && form.ptSessions) ? (form.ptSessions as any) : undefined,
      ptProgram: (!isHealth && form.ptProgram) ? form.ptProgram : undefined,
      gender: form.gender || undefined,
      birthDate: form.birthDate || undefined,
      membershipStart: form.membershipStart || undefined,
      membershipEnd: form.membershipEnd || undefined,
      email: form.email || undefined,
      phone: form.phone || undefined,
      profileNote: form.profileNote || undefined,
      paymentAmount: form.paymentAmount ? parseInt(form.paymentAmount) : undefined,
      unpaidAmount: form.unpaidAmount ? parseInt(form.unpaidAmount) : undefined,
      visitRoute: form.visitRoute || undefined,
      paymentMethod: form.paymentMethod || undefined,
      paymentDate: form.paymentDate || undefined,
      paymentMemo: form.paymentMemo || undefined,
      adminTrainerId: form.adminTrainerId ? parseInt(form.adminTrainerId) : undefined,
      serviceSessions: (!isHealth && form.serviceSessions) ? parseInt(form.serviceSessions) : undefined,
      serviceSessionPrice: (!isHealth && form.serviceSessionPrice) ? parseInt(form.serviceSessionPrice) : undefined,
      subType: "재등록" as const,
      serviceItems: serviceItems.length > 0 ? serviceItems.map(item => {
        if (item === "PT" && servicePtCount) return `PT(${servicePtCount}회)`;
        if (item === "헬스") {
          const m = serviceHealthMonths ?? (serviceHealthCustom ? parseInt(serviceHealthCustom) : undefined);
          return m ? `헬스(${m}개월)` : "헬스";
        }
        if (item === "락커" && serviceLockerNum) return `락커(${serviceLockerNum})`;
        return item;
      }).join(",") : undefined,
    };

    if (isEdit) {
      updateMutation.mutate({ id: memberId!, ...payload });
    } else {
      createMutation.mutate(payload as any);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

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
                  담당 트레이너 <span className="text-primary">*</span>
                </Label>
                <Select
                  value={form.adminTrainerId}
                  onValueChange={(v) => setForm((p) => ({ ...p, adminTrainerId: v }))}
                >
                  <SelectTrigger className={`bg-input border-border ${errors.adminTrainerId ? "border-red-500" : ""}`}>
                    <SelectValue placeholder="트레이너 선택" />
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
                <Label htmlFor="phone" className="text-sm text-muted-foreground">연락처</Label>
                <Input
                  id="phone"
                  value={form.phone}
                  onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                  placeholder="010-0000-0000"
                  className="bg-input border-border"
                />
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
                  const today = new Date();
                  let age = today.getFullYear() - birth.getFullYear();
                  const mo = today.getMonth() - birth.getMonth();
                  if (mo < 0 || (mo === 0 && today.getDate() < birth.getDate())) age--;
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

        {/* 등록 유형 선택 (신규 등록 시만) */}
        {!isEdit && (
          <Card className={`bg-card border-2 ${errors.regType ? "border-red-500" : "border-border"}`}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">등록 유형 선택 <span className="text-primary">*</span></CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setRegType("health");
                    setForm(p => ({ ...p, ptProgram: "", ptSessions: "", serviceSessions: "", serviceSessionPrice: "" }));
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
              {errors.regType && <p className="text-xs text-red-500 mt-2">{errors.regType}</p>}
            </CardContent>
          </Card>
        )}

        {/* 운동 기간 / 결제 정보 (등록 유형이 선택됐거나 수정 모드일 때) */}
        {(isEdit || regType !== "") && (
          <Card className="bg-card border-border">
            <CardHeader className="pb-4">
              <CardTitle className="text-base font-semibold">
                {regType === "health" ? "헬스 기간 및 결제" : regType === "pt" ? "PT 및 헬스 기간·결제" : "운동 기간"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* 운동 시작일 */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="membershipStart" className="text-sm text-muted-foreground">운동 시작일</Label>
                  <Input
                    id="membershipStart"
                    type="date"
                    value={form.membershipStart}
                    onChange={(e) => {
                      const start = e.target.value;
                      let end = form.membershipEnd;
                      if (regType === "health" && healthMonths) {
                        end = calcEndDateByMonths(start, Number(healthMonths));
                      } else if (regType === "pt") {
                        end = calcEndDateByPT(start, form.ptSessions);
                      }
                      setForm((p) => ({ ...p, membershipStart: start, membershipEnd: end }));
                    }}
                    className="bg-input border-border"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="membershipEnd" className="text-sm text-muted-foreground">
                    운동 만료일
                    {regType === "pt" && <span className="text-primary text-xs ml-1">(자동계산)</span>}
                  </Label>
                  <Input
                    id="membershipEnd"
                    type="date"
                    value={form.membershipEnd}
                    readOnly={regType === "pt"}
                    onChange={(e) => regType !== "pt" && setForm((p) => ({ ...p, membershipEnd: e.target.value }))}
                    className={`bg-input border-border ${regType === "pt" ? "opacity-60 cursor-not-allowed" : ""}`}
                  />
                </div>
              </div>

              {/* 헬스권: 이용 기간 선택 */}
              {(regType === "health" || isEdit) && (
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

              {/* PT 등록: 프로그램명 + PT 횟수 */}
              {!isEdit && regType === "pt" && (
                <>
                  <div className="space-y-1.5">
                    <Label className="text-sm text-muted-foreground">프로그램명</Label>
                    <Input
                      value={form.ptProgram}
                      onChange={(e) => setForm((p) => ({ ...p, ptProgram: e.target.value }))}
                      placeholder="프로그램명 직접 입력"
                      className="bg-input border-border"
                    />
                    <div className="flex gap-1.5 flex-wrap">
                      {["케어피티", "웨이트피티", "이벤트피티"].map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setForm((p) => ({ ...p, ptProgram: p.ptProgram === preset ? "" : preset, serviceSessions: "", serviceSessionPrice: "" }))}
                          className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
                            form.ptProgram === preset
                              ? "bg-primary text-primary-foreground border-primary"
                              : "border-border text-muted-foreground hover:border-primary/40"
                          }`}
                        >
                          {preset}
                        </button>
                      ))}
                    </div>
                    {form.ptProgram === "이벤트피티" && (
                      <div className="mt-1">
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
                              {ev.name} (적용: {(ev.applicableSessions || String(ev.sessions)).split(",").map((s: string) => `${s}회`).join("·")}, 서비스 +{ev.serviceSessions}회{ev.serviceSessionPrice > 0 ? ` · ${ev.serviceSessionPrice.toLocaleString()}원/회` : ""})
                            </option>
                          ))}
                        </select>
                        {(ptEvents ?? []).length === 0 && <p className="text-xs text-muted-foreground mt-1">현재 진행 중인 이벤트가 없습니다.</p>}
                      </div>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-sm text-muted-foreground">PT 횟수</Label>
                    <Input
                      type="number"
                      min="1"
                      value={form.ptSessions}
                      onChange={(e) => {
                        const s = e.target.value;
                        setForm((p) => ({ ...p, ptSessions: s, membershipEnd: calcEndDateByPT(p.membershipStart, s) }));
                      }}
                      placeholder="횟수 직접 입력"
                      className="bg-input border-border"
                    />
                    <div className="flex gap-1.5 flex-wrap">
                      {["10", "20", "30", "40", "50"].map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setForm((p) => {
                            const next = p.ptSessions === preset ? "" : preset;
                            return { ...p, ptSessions: next, membershipEnd: calcEndDateByPT(p.membershipStart, next) };
                          })}
                          className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
                            form.ptSessions === preset
                              ? "bg-primary text-primary-foreground border-primary"
                              : "border-border text-muted-foreground hover:border-primary/40"
                          }`}
                        >
                          {preset}회
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* 결제 정보 (신규 등록 시) */}
              {!isEdit && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="paymentAmount" className="text-sm text-muted-foreground">결제 금액</Label>
                      <Input id="paymentAmount" type="number" min="0" placeholder="0" value={form.paymentAmount}
                        onChange={(e) => setForm((p) => ({ ...p, paymentAmount: e.target.value }))} className="bg-input border-border" />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="unpaidAmount" className="text-sm text-muted-foreground">미수금 금액</Label>
                      <Input id="unpaidAmount" type="number" min="0" placeholder="0" value={form.unpaidAmount}
                        onChange={(e) => setForm((p) => ({ ...p, unpaidAmount: e.target.value }))} className="bg-input border-border" />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-sm text-muted-foreground">결제방법</Label>
                    <Select value={form.paymentMethod} onValueChange={(v) => setForm((p) => ({ ...p, paymentMethod: v as any }))}>
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
                    <Label htmlFor="paymentDate" className="text-sm text-muted-foreground">결제일자</Label>
                    <Input id="paymentDate" type="date" value={form.paymentDate} onChange={(e) => setForm((p) => ({ ...p, paymentDate: e.target.value }))} className="bg-input border-border"/>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="paymentMemo" className="text-sm text-muted-foreground">결제 메모</Label>
                    <Input id="paymentMemo" type="text" placeholder="분납 등 메모" value={form.paymentMemo} onChange={(e) => setForm((p) => ({ ...p, paymentMemo: e.target.value }))} className="bg-input border-border"/>
                  </div>
                </>
              )}

              {/* 서비스 내역 */}
              {(isEdit || regType !== "") && (
                <div className="space-y-2 pt-2 border-t border-border">
                  <Label className="text-sm text-muted-foreground">서비스 내역 <span className="text-muted-foreground/60">(무료 제공 항목)</span></Label>

                  {/* PT */}
                  {(() => {
                    const sel = serviceItems.includes("PT");
                    const paid = Number(form.paymentAmount) || 0;
                    const sessions = parseInt(form.ptSessions) || 0;
                    const unitPrice = sessions > 0 ? Math.round(paid / sessions) : 0;
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
              )}
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
