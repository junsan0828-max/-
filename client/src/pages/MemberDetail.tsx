import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Crown,
  Activity,
  Calendar,
  User,
  Phone,
  Mail,
  Edit,
  CheckCircle,
  Plus,
  Dumbbell,
} from "lucide-react";

interface Props {
  memberId: number;
}

const membershipLabels: Record<string, string> = {
  basic: "기본",
  premium: "프리미엄",
  vip: "VIP",
};

const statusLabels: Record<string, string> = {
  active: "활성",
  paused: "정지",
};

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="text-muted-foreground mt-0.5">{icon}</div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium text-foreground">{value}</p>
      </div>
    </div>
  );
}

export default function MemberDetail({ memberId }: Props) {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();

  // 패키지 추가 다이얼로그 상태
  const [addPkgOpen, setAddPkgOpen] = useState(false);
  const [pkgForm, setPkgForm] = useState({
    ptProgram: "" as "" | "care_pt" | "weight_pt" | "pilates",
    totalSessions: "",
    startDate: "",
    expiryDate: "",
    paymentAmount: "",
    unpaidAmount: "",
    paymentMethod: "" as "" | "현금영수증" | "이체" | "지역화폐" | "카드",
    paymentMemo: "",
  });

  const { data: member, isLoading } = trpc.members.getById.useQuery({ id: memberId });
  const { data: ptPackages, refetch: refetchPt } = trpc.pt.listByMember.useQuery({ memberId });
  const { data: payments } = trpc.members.getPayments.useQuery({ memberId });
  const { data: attendanceList, refetch: refetchAttendance } =
    trpc.attendances.listByMember.useQuery({ memberId });
  const { data: trainers } = trpc.trainers.list.useQuery();

  // 출석 체크인
  const checkInMutation = trpc.attendances.checkIn.useMutation({
    onSuccess: () => {
      toast.success("출석 체크 완료!");
      refetchAttendance();
      utils.dashboard.getStats.invalidate();
    },
    onError: (err) =>
      toast.error(err.message === "CONFLICT" ? "오늘 이미 출석 체크되었습니다." : err.message),
  });

  // PT 세션 사용
  const useSessionMutation = trpc.pt.useSession.useMutation({
    onSuccess: (data) => {
      toast.success(`세션 사용 완료! 잔여 ${data.remaining}회`);
      refetchPt();
    },
    onError: (err) => toast.error(err.message || "세션 사용 실패"),
  });

  // PT 패키지 추가
  const addPackageMutation = trpc.pt.addPackage.useMutation({
    onSuccess: () => {
      toast.success("PT 패키지가 추가되었습니다.");
      setAddPkgOpen(false);
      setPkgForm({
        ptProgram: "",
        totalSessions: "",
        startDate: "",
        expiryDate: "",
        paymentAmount: "",
        unpaidAmount: "",
        paymentMethod: "",
        paymentMemo: "",
      });
      refetchPt();
    },
    onError: (err) => toast.error(err.message || "패키지 추가 실패"),
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 rounded bg-card animate-pulse" />
        <div className="h-64 rounded-lg bg-card animate-pulse" />
      </div>
    );
  }

  if (!member) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>회원을 찾을 수 없습니다.</p>
      </div>
    );
  }

  const trainer = trainers?.find((t) => t.id === member.trainerId);
  const todayStr = new Date().toISOString().split("T")[0];
  const checkedInToday = attendanceList?.some((a) => a.attendDate === todayStr);

  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setLocation("/members")}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
              {member.name.charAt(0)}
            </div>
            <div>
              <h1 className="text-lg font-bold">{member.name}</h1>
              <p className="text-xs text-muted-foreground">
                {membershipLabels[member.grade]} · {statusLabels[member.status]}
              </p>
            </div>
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setLocation(`/members/${memberId}/edit`)}
          className="gap-1.5"
        >
          <Edit className="h-3.5 w-3.5" />
          수정
        </Button>
      </div>

      {/* 탭 */}
      <Tabs defaultValue="info">
        <TabsList className="w-full">
          <TabsTrigger value="info" className="flex-1">기본 정보</TabsTrigger>
          <TabsTrigger value="pt" className="flex-1">PT 프로그램</TabsTrigger>
          <TabsTrigger value="attendance" className="flex-1">출석</TabsTrigger>
        </TabsList>

        {/* ── 기본 정보 탭 ── */}
        <TabsContent value="info" className="mt-4">
          <Card className="bg-card border-border">
            <CardContent className="p-4 sm:p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                <InfoRow icon={<Crown className="h-4 w-4" />} label="등급" value={membershipLabels[member.grade] ?? "-"} />
                <InfoRow icon={<Activity className="h-4 w-4" />} label="상태" value={statusLabels[member.status] ?? "-"} />
                <InfoRow
                  icon={<Calendar className="h-4 w-4" />}
                  label="생년월일"
                  value={member.birthDate ? format(new Date(member.birthDate), "yyyy년 MM월 dd일", { locale: ko }) : "-"}
                />
                <InfoRow
                  icon={<User className="h-4 w-4" />}
                  label="성별"
                  value={member.gender === "male" ? "남성" : member.gender === "female" ? "여성" : "-"}
                />
                <InfoRow icon={<Phone className="h-4 w-4" />} label="연락처" value={member.phone ?? "-"} />
                <InfoRow icon={<Mail className="h-4 w-4" />} label="이메일" value={member.email ?? "-"} />
                <InfoRow
                  icon={<Calendar className="h-4 w-4" />}
                  label="회원권 시작"
                  value={member.membershipStart ? format(new Date(member.membershipStart), "yyyy.MM.dd", { locale: ko }) : "-"}
                />
                <InfoRow
                  icon={<Calendar className="h-4 w-4" />}
                  label="회원권 만료"
                  value={member.membershipEnd ? format(new Date(member.membershipEnd), "yyyy.MM.dd", { locale: ko }) : "-"}
                />
                <InfoRow
                  icon={<Calendar className="h-4 w-4" />}
                  label="등록일"
                  value={format(new Date(member.createdAt), "yyyy.MM.dd", { locale: ko })}
                />
                <InfoRow icon={<User className="h-4 w-4" />} label="담당 트레이너" value={trainer?.trainerName ?? "-"} />
                <InfoRow
                  icon={<Activity className="h-4 w-4" />}
                  label="총 결제 금액"
                  value={payments ? `${payments.reduce((sum, p) => sum + p.amount, 0).toLocaleString()}원` : "-"}
                />
              </div>
              {member.profileNote && (
                <div className="mt-4 p-3 sm:p-4 rounded-lg bg-accent/30 border border-border">
                  <p className="text-xs text-muted-foreground mb-1">특이사항</p>
                  <p className="text-sm text-foreground whitespace-pre-wrap">{member.profileNote}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── PT 프로그램 탭 ── */}
        <TabsContent value="pt" className="mt-4">
          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between px-4 sm:px-6">
              <CardTitle className="text-base">PT 프로그램</CardTitle>
              {/* 패키지 추가 다이얼로그 */}
              <Dialog open={addPkgOpen} onOpenChange={setAddPkgOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="gap-1.5 text-xs">
                    <Plus className="h-3.5 w-3.5" />
                    패키지 추가
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-sm">
                  <DialogHeader>
                    <DialogTitle>PT 패키지 추가</DialogTitle>
                    <DialogDescription>{member.name}님에게 새 PT 패키지를 추가합니다.</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs">PT 프로그램</Label>
                        <Select value={pkgForm.ptProgram} onValueChange={(v) => setPkgForm((p) => ({ ...p, ptProgram: v as any }))}>
                          <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="선택" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="care_pt">케어피티</SelectItem>
                            <SelectItem value="weight_pt">웨이트피티</SelectItem>
                            <SelectItem value="pilates">필라테스</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">총 횟수 <span className="text-primary">*</span></Label>
                        <Input
                          type="number" min="1" placeholder="20"
                          value={pkgForm.totalSessions}
                          onChange={(e) => setPkgForm((p) => ({ ...p, totalSessions: e.target.value }))}
                          className="h-9 text-sm"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs">시작일</Label>
                        <Input type="date" value={pkgForm.startDate} onChange={(e) => setPkgForm((p) => ({ ...p, startDate: e.target.value }))} className="h-9 text-sm" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">만료일</Label>
                        <Input type="date" value={pkgForm.expiryDate} onChange={(e) => setPkgForm((p) => ({ ...p, expiryDate: e.target.value }))} className="h-9 text-sm" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs">결제 금액</Label>
                        <Input type="number" min="0" placeholder="0" value={pkgForm.paymentAmount} onChange={(e) => setPkgForm((p) => ({ ...p, paymentAmount: e.target.value }))} className="h-9 text-sm" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">미수금</Label>
                        <Input type="number" min="0" placeholder="0" value={pkgForm.unpaidAmount} onChange={(e) => setPkgForm((p) => ({ ...p, unpaidAmount: e.target.value }))} className="h-9 text-sm" />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">결제방법</Label>
                      <Select value={pkgForm.paymentMethod} onValueChange={(v) => setPkgForm((p) => ({ ...p, paymentMethod: v as any }))}>
                        <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="선택" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="현금영수증">현금영수증</SelectItem>
                          <SelectItem value="이체">이체</SelectItem>
                          <SelectItem value="지역화폐">지역화폐</SelectItem>
                          <SelectItem value="카드">카드</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">결제 메모</Label>
                      <Input placeholder="분납 등 메모" value={pkgForm.paymentMemo} onChange={(e) => setPkgForm((p) => ({ ...p, paymentMemo: e.target.value }))} className="h-9 text-sm" />
                    </div>
                    <div className="flex gap-2 pt-1">
                      <Button variant="outline" className="flex-1" onClick={() => setAddPkgOpen(false)}>취소</Button>
                      <Button
                        className="flex-1"
                        disabled={!pkgForm.totalSessions || addPackageMutation.isPending}
                        onClick={() =>
                          addPackageMutation.mutate({
                            memberId,
                            ptProgram: pkgForm.ptProgram || undefined,
                            totalSessions: parseInt(pkgForm.totalSessions),
                            startDate: pkgForm.startDate || undefined,
                            expiryDate: pkgForm.expiryDate || undefined,
                            paymentAmount: pkgForm.paymentAmount ? parseInt(pkgForm.paymentAmount) : undefined,
                            unpaidAmount: pkgForm.unpaidAmount ? parseInt(pkgForm.unpaidAmount) : undefined,
                            paymentMethod: pkgForm.paymentMethod || undefined,
                            paymentMemo: pkgForm.paymentMemo || undefined,
                          })
                        }
                      >
                        {addPackageMutation.isPending ? "추가 중..." : "추가"}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent className="px-4 sm:px-6">
              {!ptPackages?.length ? (
                <p className="text-muted-foreground text-sm text-center py-8">등록된 PT 프로그램이 없습니다.</p>
              ) : (
                <div className="space-y-3">
                  {ptPackages.map((pkg) => {
                    const remaining = pkg.totalSessions - pkg.usedSessions;
                    const isActive = pkg.status === "active" && remaining > 0;
                    return (
                      <div key={pkg.id} className="p-3 sm:p-4 rounded-lg bg-accent/20 border border-border">
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-foreground text-sm truncate">
                                {pkg.packageName || "PT 프로그램"}
                              </p>
                              <span className={`text-xs px-1.5 py-0.5 rounded-full border ${
                                pkg.status === "active"
                                  ? "bg-green-500/20 text-green-400 border-green-500/30"
                                  : pkg.status === "completed"
                                  ? "bg-gray-500/20 text-gray-400 border-gray-500/30"
                                  : "bg-red-500/20 text-red-400 border-red-500/30"
                              }`}>
                                {pkg.status === "active" ? "진행중" : pkg.status === "completed" ? "완료" : "만료"}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {pkg.startDate ? format(new Date(pkg.startDate), "yyyy.MM.dd", { locale: ko }) : ""}{" "}~{" "}
                              {pkg.expiryDate ? format(new Date(pkg.expiryDate), "yyyy.MM.dd", { locale: ko }) : ""}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-lg font-bold text-primary">{remaining}회</p>
                            <p className="text-xs text-muted-foreground">잔여 / {pkg.totalSessions}회</p>
                          </div>
                        </div>

                        {/* 진행률 바 */}
                        <div className="mt-3">
                          <div className="w-full bg-border rounded-full h-1.5">
                            <div
                              className="bg-primary h-1.5 rounded-full transition-all"
                              style={{ width: `${Math.min((pkg.usedSessions / pkg.totalSessions) * 100, 100)}%` }}
                            />
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">{pkg.usedSessions}회 사용</p>
                        </div>

                        {/* 세션 사용 버튼 */}
                        {isActive && (
                          <div className="mt-3">
                            <Button
                              size="sm"
                              className="w-full gap-2 bg-primary/20 text-primary hover:bg-primary/30 border border-primary/30"
                              disabled={useSessionMutation.isPending}
                              onClick={() => useSessionMutation.mutate({ packageId: pkg.id, memberId })}
                            >
                              <Dumbbell className="h-3.5 w-3.5" />
                              세션 1회 사용
                            </Button>
                          </div>
                        )}

                        {/* 결제 정보 */}
                        {(pkg.paymentAmount || pkg.unpaidAmount || pkg.paymentMethod || pkg.paymentMemo) && (
                          <div className="mt-3 pt-3 border-t border-border/50">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                              {pkg.paymentAmount ? (
                                <div>
                                  <p className="text-muted-foreground">결제 금액</p>
                                  <p className="font-medium">{pkg.paymentAmount.toLocaleString()}원</p>
                                </div>
                              ) : null}
                              {pkg.unpaidAmount ? (
                                <div>
                                  <p className="text-muted-foreground">미수금</p>
                                  <p className="font-medium text-orange-400">{pkg.unpaidAmount.toLocaleString()}원</p>
                                </div>
                              ) : null}
                              {pkg.paymentMethod ? (
                                <div>
                                  <p className="text-muted-foreground">결제방법</p>
                                  <p className="font-medium">{pkg.paymentMethod}</p>
                                </div>
                              ) : null}
                              {pkg.paymentMemo ? (
                                <div className="sm:col-span-2">
                                  <p className="text-muted-foreground">결제 메모</p>
                                  <p className="font-medium">{pkg.paymentMemo}</p>
                                </div>
                              ) : null}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── 출석 탭 ── */}
        <TabsContent value="attendance" className="mt-4">
          <Card className="bg-card border-border">
            <CardHeader className="px-4 sm:px-6 pb-3">
              <CardTitle className="text-base">출석 기록</CardTitle>
            </CardHeader>
            <CardContent className="px-4 sm:px-6 space-y-4">
              {/* 오늘 출석 체크 버튼 */}
              <Button
                className={`w-full gap-2 ${
                  checkedInToday
                    ? "bg-green-500/20 text-green-400 border border-green-500/30 hover:bg-green-500/30"
                    : ""
                }`}
                disabled={checkedInToday || checkInMutation.isPending}
                onClick={() => checkInMutation.mutate({ memberId })}
              >
                <CheckCircle className="h-4 w-4" />
                {checkedInToday ? "오늘 출석 완료 ✓" : checkInMutation.isPending ? "체크 중..." : "오늘 출석 체크"}
              </Button>

              {/* 출석 기록 목록 */}
              {!attendanceList?.length ? (
                <p className="text-muted-foreground text-sm text-center py-6">출석 기록이 없습니다.</p>
              ) : (
                <div className="space-y-2">
                  {attendanceList.slice(0, 30).map((att) => (
                    <div
                      key={att.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-accent/20 border border-border"
                    >
                      <p className="text-sm">
                        {att.attendDate
                          ? format(new Date(att.attendDate), "yyyy.MM.dd (EEE)", { locale: ko })
                          : "-"}
                      </p>
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${
                        att.status === "attended"
                          ? "bg-green-500/20 text-green-400 border-green-500/30"
                          : att.status === "noshow"
                          ? "bg-red-500/20 text-red-400 border-red-500/30"
                          : "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"
                      }`}>
                        {att.status === "attended" ? "출석" : att.status === "noshow" ? "노쇼" : "결석"}
                      </span>
                    </div>
                  ))}
                  <p className="text-xs text-muted-foreground text-center pt-1">
                    총 {attendanceList.length}회 기록
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
