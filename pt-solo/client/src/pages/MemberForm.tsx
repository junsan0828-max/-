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

interface Props {
  memberId?: number;
}

const won = (n: number) => n.toLocaleString() + "원";

export default function MemberForm({ memberId }: Props) {
  const [, setLocation] = useLocation();
  const isEdit = !!memberId;

  // 신규 등록 시: 계약 포함 여부 선택
  const [contractMode, setContractMode] = useState<"info_only" | "with_contract">("info_only");

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
    visitRoute: "",
    // 계약 금액 필드 (신규 등록 전용)
    listPrice: "",      // 정가
    discountAmount: "", // 할인금액
    paidAmount: "",     // 실납부액
    paymentMethod: "" as "" | "카드" | "현금" | "계좌이체" | "지역화폐",
    paymentDate: "",
    paymentMemo: "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // 계산값 (표시용)
  const listPriceNum = parseInt(form.listPrice) || 0;
  const discountNum = parseInt(form.discountAmount) || 0;
  const contractAmount = Math.max(0, listPriceNum - discountNum);
  const paidAmountNum = parseInt(form.paidAmount) || 0;
  const unpaidAmount = Math.max(0, contractAmount - paidAmountNum);

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
    if (!isEdit && contractMode === "with_contract") {
      if (!form.listPrice) newErrors.listPrice = "정가를 입력해주세요.";
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

    if (isEdit) {
      updateMutation.mutate({
        id: memberId!,
        name: form.name || undefined,
        phone: form.phone || undefined,
        email: form.email || undefined,
        birthDate: form.birthDate || undefined,
        gender: form.gender || undefined,
        grade: form.grade,
        status: form.status,
        membershipStart: form.membershipStart || undefined,
        membershipEnd: form.membershipEnd || undefined,
        profileNote: form.profileNote || undefined,
        visitRoute: form.visitRoute || undefined,
      });
    } else {
      const withContract = contractMode === "with_contract";
      createMutation.mutate({
        name: form.name,
        phone: form.phone || undefined,
        email: form.email || undefined,
        birthDate: form.birthDate || undefined,
        gender: form.gender || undefined,
        grade: form.grade,
        status: form.status,
        membershipStart: form.membershipStart || undefined,
        membershipEnd: form.membershipEnd || undefined,
        profileNote: form.profileNote || undefined,
        visitRoute: form.visitRoute || undefined,
        // 계약 관련 — contractMode = "with_contract" 일 때만 전송
        hasContract: withContract,
        ptProgram: withContract ? (form.ptProgram || undefined) : undefined,
        ptSessions: withContract ? (form.ptSessions || undefined) : undefined,
        listPrice: withContract && form.listPrice ? listPriceNum : undefined,
        discountAmount: withContract && form.discountAmount ? discountNum : undefined,
        paidAmount: withContract ? paidAmountNum : undefined,
        paymentMethod: withContract && form.paymentMethod ? form.paymentMethod : undefined,
        paymentDate: withContract && form.paymentDate ? form.paymentDate : undefined,
        paymentMemo: withContract ? (form.paymentMemo || undefined) : undefined,
      } as any);
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
                  <SelectTrigger className="bg-input border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="basic">기본</SelectItem>
                    <SelectItem value="premium">프리미엄</SelectItem>
                    <SelectItem value="vip">VIP</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm text-muted-foreground">상태</Label>
                <Select value={form.status} onValueChange={(v) => setForm((p) => ({ ...p, status: v as any }))}>
                  <SelectTrigger className="bg-input border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">활성</SelectItem>
                    <SelectItem value="paused">정지</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-sm text-muted-foreground">이메일</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                placeholder="example@email.com"
                className="bg-input border-border"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm text-muted-foreground">유입경로</Label>
              <Select value={form.visitRoute || "__none"} onValueChange={(v) => setForm((p) => ({ ...p, visitRoute: v === "__none" ? "" : v }))}>
                <SelectTrigger className="bg-input border-border">
                  <SelectValue placeholder="선택" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">선택 안함</SelectItem>
                  <SelectItem value="지인 소개">지인 소개</SelectItem>
                  <SelectItem value="네이버플레이스">네이버플레이스</SelectItem>
                  <SelectItem value="당근광고">당근광고</SelectItem>
                  <SelectItem value="인스타그램">인스타그램</SelectItem>
                  <SelectItem value="간판/현수막">간판/현수막</SelectItem>
                  <SelectItem value="전단지">전단지</SelectItem>
                  <SelectItem value="재등록">재등록</SelectItem>
                  <SelectItem value="기타">기타</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="profileNote" className="text-sm text-muted-foreground">특이사항</Label>
              <Input id="profileNote" value={form.profileNote} onChange={(e) => setForm((p) => ({ ...p, profileNote: e.target.value }))} placeholder="특이사항 입력" className="bg-input border-border" />
            </div>
          </CardContent>
        </Card>

        {/* 이용권 기간 */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-4">
            <CardTitle className="text-base font-semibold">이용 기간</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="membershipStart" className="text-sm text-muted-foreground">시작일</Label>
                <Input id="membershipStart" type="date" value={form.membershipStart} onChange={(e) => setForm((p) => ({ ...p, membershipStart: e.target.value }))} className="bg-input border-border" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="membershipEnd" className="text-sm text-muted-foreground">만료일</Label>
                <Input id="membershipEnd" type="date" value={form.membershipEnd} onChange={(e) => setForm((p) => ({ ...p, membershipEnd: e.target.value }))} className="bg-input border-border" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 신규 등록 시 계약 선택 */}
        {!isEdit && (
          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">프로그램 · 결제</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* 등록 모드 토글 */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setContractMode("info_only")}
                  className={`px-3 py-2.5 rounded-lg text-sm font-medium border transition-colors ${
                    contractMode === "info_only"
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border text-muted-foreground hover:border-primary/40"
                  }`}
                >
                  회원정보만 등록
                </button>
                <button
                  type="button"
                  onClick={() => setContractMode("with_contract")}
                  className={`px-3 py-2.5 rounded-lg text-sm font-medium border transition-colors ${
                    contractMode === "with_contract"
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border text-muted-foreground hover:border-primary/40"
                  }`}
                >
                  프로그램+결제 함께 등록
                </button>
              </div>

              {contractMode === "info_only" ? (
                <p className="text-xs text-muted-foreground bg-muted/40 rounded-lg px-3 py-2.5">
                  회원정보만 저장합니다. 프로그램과 결제는 나중에 회원 상세 페이지에서 추가할 수 있습니다.
                </p>
              ) : (
                <div className="space-y-4">
                  {/* 프로그램 */}
                  <div className="space-y-1.5">
                    <Label className="text-sm text-muted-foreground">프로그램명</Label>
                    <Input value={form.ptProgram} onChange={(e) => setForm((p) => ({ ...p, ptProgram: e.target.value }))} placeholder="프로그램명 직접 입력" className="bg-input border-border" />
                    <div className="flex gap-1.5 flex-wrap">
                      {["피티", "필라테스", "이벤트 세션"].map((preset) => (
                        <button key={preset} type="button" onClick={() => setForm((p) => ({ ...p, ptProgram: p.ptProgram === preset ? "" : preset }))}
                          className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${form.ptProgram === preset ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-primary/40"}`}>
                          {preset}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 이용 횟수 */}
                  <div className="space-y-1.5">
                    <Label className="text-sm text-muted-foreground">이용 횟수 <span className="font-normal text-muted-foreground/60">(이용권 수량)</span></Label>
                    <Input type="number" min="1" value={form.ptSessions} onChange={(e) => setForm((p) => ({ ...p, ptSessions: e.target.value }))} placeholder="횟수 입력 (선택)" className="bg-input border-border" />
                    <div className="flex gap-1.5 flex-wrap">
                      {["10", "20", "30", "40", "50"].map((preset) => (
                        <button key={preset} type="button" onClick={() => setForm((p) => ({ ...p, ptSessions: p.ptSessions === preset ? "" : preset }))}
                          className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${form.ptSessions === preset ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-primary/40"}`}>
                          {preset}회
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 계약 금액 구조 */}
                  <div className="space-y-3">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">계약 금액</p>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-sm text-muted-foreground">정가 <span className="text-primary">*</span></Label>
                        <Input
                          type="number" min="0" placeholder="0"
                          value={form.listPrice}
                          onChange={(e) => setForm((p) => ({ ...p, listPrice: e.target.value }))}
                          className={`bg-input border-border ${errors.listPrice ? "border-red-500" : ""}`}
                        />
                        {errors.listPrice && <p className="text-xs text-red-500">{errors.listPrice}</p>}
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-sm text-muted-foreground">할인금액</Label>
                        <Input
                          type="number" min="0" placeholder="0 (없으면 비워두세요)"
                          value={form.discountAmount}
                          onChange={(e) => setForm((p) => ({ ...p, discountAmount: e.target.value }))}
                          className="bg-input border-border"
                        />
                      </div>
                    </div>

                    {/* 계약금액 계산 표시 */}
                    <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2">
                      <span className="text-xs text-muted-foreground">계약금액 <span className="text-muted-foreground/60">(정가 − 할인)</span></span>
                      <span className="text-sm font-semibold">{contractAmount > 0 ? won(contractAmount) : "—"}</span>
                    </div>
                  </div>

                  {/* 실납부액 */}
                  <div className="space-y-3">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">납부 정보</p>

                    <div className="space-y-1.5">
                      <Label className="text-sm text-muted-foreground">실납부액 <span className="font-normal text-muted-foreground/60">(오늘 실제 받은 금액)</span></Label>
                      <Input
                        type="number" min="0" placeholder="0"
                        value={form.paidAmount}
                        onChange={(e) => setForm((p) => ({ ...p, paidAmount: e.target.value }))}
                        className="bg-input border-border"
                      />
                    </div>

                    {/* 미수금 계산 표시 */}
                    <div className={`flex items-center justify-between rounded-lg px-3 py-2 ${unpaidAmount > 0 ? "bg-amber-500/10" : "bg-muted/50"}`}>
                      <span className="text-xs text-muted-foreground">미수금 <span className="text-muted-foreground/60">(계약금액 − 실납부액)</span></span>
                      <span className={`text-sm font-semibold ${unpaidAmount > 0 ? "text-amber-600" : ""}`}>
                        {contractAmount > 0 ? won(unpaidAmount) : "—"}
                      </span>
                    </div>

                    {/* 실납부액이 있을 때만 결제방법·결제일 표시 */}
                    {paidAmountNum > 0 && (
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label className="text-sm text-muted-foreground">결제방법</Label>
                          <Select value={form.paymentMethod} onValueChange={(v) => setForm((p) => ({ ...p, paymentMethod: v as any }))}>
                            <SelectTrigger className="bg-input border-border">
                              <SelectValue placeholder="선택" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="현금">현금</SelectItem>
                              <SelectItem value="계좌이체">계좌이체</SelectItem>
                              <SelectItem value="지역화폐">지역화폐</SelectItem>
                              <SelectItem value="카드">카드</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="paymentDate" className="text-sm text-muted-foreground">결제일</Label>
                          <Input id="paymentDate" type="date" value={form.paymentDate} onChange={(e) => setForm((p) => ({ ...p, paymentDate: e.target.value }))} className="bg-input border-border" />
                        </div>
                      </div>
                    )}

                    <div className="space-y-1.5">
                      <Label htmlFor="paymentMemo" className="text-sm text-muted-foreground">메모</Label>
                      <Input id="paymentMemo" type="text" placeholder="분납 등 메모" value={form.paymentMemo} onChange={(e) => setForm((p) => ({ ...p, paymentMemo: e.target.value }))} className="bg-input border-border" />
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <div className="flex gap-3 pb-4">
          <Button type="button" variant="outline" className="flex-1" onClick={() => setLocation(isEdit ? `/members/${memberId}` : "/members")}>
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
