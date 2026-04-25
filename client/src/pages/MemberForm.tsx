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
  defaultTrainerId?: number;
}

export default function MemberForm({ memberId, defaultTrainerId }: Props) {
  const [, setLocation] = useLocation();
  const isEdit = !!memberId;

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
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data: currentUser } = trpc.auth.me.useQuery();
  const { data: trainerList } = trpc.trainers.list.useQuery();
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

    const payload = {
      ...form,
      ptSessions: form.ptSessions ? (form.ptSessions as any) : undefined,
      ptProgram: form.ptProgram || undefined,
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
            {/* 관리자: 담당 트레이너 선택 */}
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
                <Label htmlFor="phone" className="text-sm text-muted-foreground">
                  연락처
                </Label>
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
                <Label htmlFor="birthDate" className="text-sm text-muted-foreground">
                  생년월일
                </Label>
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
                <Select
                  value={form.gender}
                  onValueChange={(v) => setForm((p) => ({ ...p, gender: v as any }))}
                >
                  <SelectTrigger className="bg-input border-border">
                    <SelectValue placeholder="선택" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">남성</SelectItem>
                    <SelectItem value="female">여성</SelectItem>
                    <SelectItem value="other">기타</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-sm text-muted-foreground">등급</Label>
                <Select
                  value={form.grade}
                  onValueChange={(v) => setForm((p) => ({ ...p, grade: v as any }))}
                >
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
                <Select
                  value={form.status}
                  onValueChange={(v) => setForm((p) => ({ ...p, status: v as any }))}
                >
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
              <Label htmlFor="email" className="text-sm text-muted-foreground">
                이메일
              </Label>
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
              <Label htmlFor="visitRoute" className="text-sm text-muted-foreground">유입경로</Label>
              <Input id="visitRoute" value={form.visitRoute} onChange={(e) => setForm((p) => ({ ...p, visitRoute: e.target.value }))} placeholder="지인 소개, SNS, 검색 등" className="bg-input border-border"/>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="profileNote" className="text-sm text-muted-foreground">특이사항</Label>
              <Input id="profileNote" value={form.profileNote} onChange={(e) => setForm((p) => ({ ...p, profileNote: e.target.value }))} placeholder="특이사항 입력" className="bg-input border-border"/>
            </div>
          </CardContent>
        </Card>

        {/* 회원권 정보 */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-4">
            <CardTitle className="text-base font-semibold">회원권 정보</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="membershipStart" className="text-sm text-muted-foreground">
                  시작일
                </Label>
                <Input
                  id="membershipStart"
                  type="date"
                  value={form.membershipStart}
                  onChange={(e) => setForm((p) => ({ ...p, membershipStart: e.target.value }))}
                  className="bg-input border-border"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="membershipEnd" className="text-sm text-muted-foreground">
                  만료일
                </Label>
                <Input
                  id="membershipEnd"
                  type="date"
                  value={form.membershipEnd}
                  onChange={(e) => setForm((p) => ({ ...p, membershipEnd: e.target.value }))}
                  className="bg-input border-border"
                />
              </div>
            </div>

            {!isEdit && (
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
                        onClick={() => setForm((p) => ({ ...p, ptProgram: p.ptProgram === preset ? "" : preset }))}
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
                </div>

                <div className="space-y-1.5">
                  <Label className="text-sm text-muted-foreground">PT 횟수</Label>
                  <Input
                    type="number"
                    min="1"
                    value={form.ptSessions}
                    onChange={(e) => setForm((p) => ({ ...p, ptSessions: e.target.value }))}
                    placeholder="횟수 직접 입력"
                    className="bg-input border-border"
                  />
                  <div className="flex gap-1.5 flex-wrap">
                    {["10", "20", "30", "40", "50"].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setForm((p) => ({ ...p, ptSessions: p.ptSessions === preset ? "" : preset }))}
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

                {/* 결제 정보 */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="paymentAmount" className="text-sm text-muted-foreground">
                      결제 금액
                    </Label>
                    <Input
                      id="paymentAmount"
                      type="number"
                      min="0"
                      placeholder="0"
                      value={form.paymentAmount}
                      onChange={(e) => setForm((p) => ({ ...p, paymentAmount: e.target.value }))}
                      className="bg-input border-border"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="unpaidAmount" className="text-sm text-muted-foreground">
                      미수금 금액
                    </Label>
                    <Input
                      id="unpaidAmount"
                      type="number"
                      min="0"
                      placeholder="0"
                      value={form.unpaidAmount}
                      onChange={(e) => setForm((p) => ({ ...p, unpaidAmount: e.target.value }))}
                      className="bg-input border-border"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-sm text-muted-foreground">결제방법</Label>
                  <Select
                    value={form.paymentMethod}
                    onValueChange={(v) => setForm((p) => ({ ...p, paymentMethod: v as any }))}
                  >
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
          </CardContent>
        </Card>

        <div className="flex gap-3 pb-4">
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={() => setLocation(isEdit ? `/members/${memberId}` : "/members")}
          >
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
