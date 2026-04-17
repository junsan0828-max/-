import { useState, useMemo } from "react";
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
import { Textarea } from "@/components/ui/textarea";
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
  Trash2,
  BookOpen,
  ChevronLeft,
  ChevronRight,
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

  const [calendarDate, setCalendarDate] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [unpaidOpen, setUnpaidOpen] = useState(false);
  const [memoOpen, setMemoOpen] = useState(false);
  const [memoForm, setMemoForm] = useState({ memoDate: new Date().toISOString().split("T")[0], content: "" });
  const [sessionMemoOpen, setSessionMemoOpen] = useState(false);
  const [sessionMemoContent, setSessionMemoContent] = useState("");
  const [trainerChangeOpen, setTrainerChangeOpen] = useState(false);
  const [selectedTrainerId, setSelectedTrainerId] = useState<string>("");
  const [unpaidEdit, setUnpaidEdit] = useState<{ packageId: number; current: number; value: string }>({
    packageId: 0,
    current: 0,
    value: "",
  });

  const { data: currentUser } = trpc.auth.me.useQuery();
  const { data: member, isLoading } = trpc.members.getById.useQuery({ id: memberId });
  const { data: ptPackages, refetch: refetchPt } = trpc.pt.listByMember.useQuery({ memberId });
  const { data: payments } = trpc.members.getPayments.useQuery({ memberId });
  const { data: attendanceList, refetch: refetchAttendance } =
    trpc.attendances.listByMember.useQuery({ memberId });
  const { data: trainers } = trpc.trainers.list.useQuery();
  const { data: memoList, refetch: refetchMemos } = trpc.workoutMemos.listByMember.useQuery({ memberId });

  // 회원 삭제
  const deleteMutation = trpc.members.delete.useMutation({
    onSuccess: () => {
      toast.success("회원이 삭제되었습니다.");
      setLocation("/members");
    },
    onError: (err) => toast.error(err.message || "삭제 실패"),
  });

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

  // 운동 메모 추가
  const createMemoMutation = trpc.workoutMemos.create.useMutation({
    onSuccess: () => {
      toast.success("운동 메모가 저장되었습니다.");
      setMemoOpen(false);
      setMemoForm({ memoDate: new Date().toISOString().split("T")[0], content: "" });
      refetchMemos();
    },
    onError: (err) => toast.error(err.message || "저장 실패"),
  });

  const deleteMemoMutation = trpc.workoutMemos.delete.useMutation({
    onSuccess: () => { toast.success("메모가 삭제되었습니다."); refetchMemos(); },
    onError: (err) => toast.error(err.message || "삭제 실패"),
  });

  // PT 세션 사용 (완료 후 메모 입력 유도)
  const useSessionMutation = trpc.pt.useSession.useMutation({
    onSuccess: (data) => {
      toast.success(`세션 사용 완료! 잔여 ${data.remaining}회`);
      refetchPt();
      setSessionMemoContent("");
      setSessionMemoOpen(true);
    },
    onError: (err) => toast.error(err.message || "세션 사용 실패"),
  });

  // 담당 트레이너 변경
  const updateMemberMutation = trpc.members.update.useMutation({
    onSuccess: () => {
      toast.success("담당 트레이너가 변경되었습니다.");
      setTrainerChangeOpen(false);
      utils.members.getById.invalidate({ id: memberId });
    },
    onError: (err) => toast.error(err.message || "변경 실패"),
  });

  // 미수금 업데이트
  const updatePaymentMutation = trpc.pt.updatePayment.useMutation({
    onSuccess: () => {
      toast.success("미수금이 업데이트되었습니다.");
      setUnpaidOpen(false);
      refetchPt();
    },
    onError: (err) => toast.error(err.message || "업데이트 실패"),
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

  // 달력 계산 (hooks는 조건부 return 이전에 호출해야 함)
  const attendanceMap = useMemo(() => {
    const map: Record<string, string> = {};
    attendanceList?.forEach((a) => { if (a.attendDate) map[a.attendDate] = a.status; });
    return map;
  }, [attendanceList]);

  const calendarDays = useMemo(() => {
    const { year, month } = calendarDate;
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days: (number | null)[] = Array(firstDay).fill(null);
    for (let d = 1; d <= daysInMonth; d++) days.push(d);
    while (days.length % 7 !== 0) days.push(null);
    return days;
  }, [calendarDate]);

  const moveMonth = (delta: number) => {
    setCalendarDate((prev) => {
      let m = prev.month + delta;
      let y = prev.year;
      if (m < 0) { m = 11; y--; }
      if (m > 11) { m = 0; y++; }
      return { year: y, month: m };
    });
  };

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

  const remainingPt = ptPackages
    ?.filter(p => p.status === "active")
    .reduce((sum, p) => sum + (p.totalSessions - p.usedSessions), 0) ?? 0;
  const totalAttendance = attendanceList?.filter(a => a.status === "attended").length ?? 0;
  const memoCount = memoList?.length ?? 0;

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
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setLocation(`/members/${memberId}/edit`)}
            className="gap-1.5"
          >
            <Edit className="h-3.5 w-3.5" />
            수정
          </Button>
          {/* 삭제 확인 다이얼로그 */}
          <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" className="gap-1.5 text-red-400 hover:text-red-400 border-red-500/30 hover:bg-red-500/10">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-xs">
              <DialogHeader>
                <DialogTitle>회원 삭제</DialogTitle>
                <DialogDescription>
                  {member.name}님을 삭제하시겠습니까? 모든 데이터가 삭제되며 되돌릴 수 없습니다.
                </DialogDescription>
              </DialogHeader>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setDeleteOpen(false)}>
                  취소
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1"
                  disabled={deleteMutation.isPending}
                  onClick={() => deleteMutation.mutate({ id: memberId })}
                >
                  {deleteMutation.isPending ? "삭제 중..." : "삭제"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* 요약 통계 카드 */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { icon: <Dumbbell className="h-5 w-5 text-primary" />, value: remainingPt, label: "잔여 PT 횟수" },
          { icon: <CheckCircle className="h-5 w-5 text-green-400" />, value: totalAttendance, label: "총 출석 횟수" },
          { icon: <BookOpen className="h-5 w-5 text-blue-400" />, value: memoCount, label: "운동 메모" },
        ].map((item) => (
          <Card key={item.label} className="bg-card border-border">
            <CardContent className="p-3 flex flex-col items-start gap-1">
              {item.icon}
              <p className="text-xl font-bold">{item.value}</p>
              <p className="text-xs text-muted-foreground leading-tight">{item.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 탭 */}
      <Tabs defaultValue="info">
        <TabsList className="w-full">
          <TabsTrigger value="info" className="flex-1 text-xs">기본 정보</TabsTrigger>
          <TabsTrigger value="pt" className="flex-1 text-xs">PT 프로그램</TabsTrigger>
          <TabsTrigger value="memo" className="flex-1 text-xs">운동 메모</TabsTrigger>
          <TabsTrigger value="attendance" className="flex-1 text-xs">출석</TabsTrigger>
        </TabsList>

        {/* ── 기본 정보 탭 ── */}
        <TabsContent value="info" className="mt-4 space-y-3">
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 w-full border-primary/40 text-primary hover:bg-primary/10"
            onClick={() => setLocation(`/members/${memberId}/parq`)}
          >
            PAR-Q 사전건강검사
          </Button>
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
                <div className="flex items-start gap-3">
                  <div className="text-muted-foreground mt-0.5"><User className="h-4 w-4" /></div>
                  <div className="flex-1">
                    <p className="text-xs text-muted-foreground">담당 트레이너</p>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-foreground">{trainer?.trainerName ?? "-"}</p>
                      {currentUser?.role === "admin" && (
                        <button
                          onClick={() => { setSelectedTrainerId(String(member.trainerId ?? "")); setTrainerChangeOpen(true); }}
                          className="text-xs text-primary underline hover:text-primary/70"
                        >
                          변경
                        </button>
                      )}
                    </div>
                  </div>
                </div>
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
                                  <div className="flex items-center gap-2">
                                    <p className="font-medium text-orange-400">{pkg.unpaidAmount.toLocaleString()}원</p>
                                    <button
                                      className="text-xs text-orange-400 underline hover:text-orange-300"
                                      onClick={() => {
                                        setUnpaidEdit({ packageId: pkg.id, current: pkg.unpaidAmount ?? 0, value: String(pkg.unpaidAmount ?? 0) });
                                        setUnpaidOpen(true);
                                      }}
                                    >
                                      수정
                                    </button>
                                  </div>
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

        {/* ── 운동 메모 탭 ── */}
        <TabsContent value="memo" className="mt-4">
          <Card className="bg-card border-border">
            <CardHeader className="px-4 sm:px-6 pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-blue-400" />운동 메모
              </CardTitle>
              <Dialog open={memoOpen} onOpenChange={setMemoOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="gap-1.5 text-xs">
                    <Plus className="h-3.5 w-3.5" />
                    메모 작성
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-sm">
                  <DialogHeader>
                    <DialogTitle>운동 메모 작성</DialogTitle>
                    <DialogDescription>{member.name}님의 운동 메모를 작성합니다.</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">날짜</Label>
                      <Input
                        type="date"
                        value={memoForm.memoDate}
                        onChange={(e) => setMemoForm(p => ({ ...p, memoDate: e.target.value }))}
                        className="h-9 text-sm"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">내용</Label>
                      <Textarea
                        value={memoForm.content}
                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setMemoForm(p => ({ ...p, content: e.target.value }))}
                        placeholder="오늘의 운동 내용, 특이사항 등을 기록하세요."
                        rows={5}
                        className="text-sm resize-none"
                      />
                    </div>
                    <div className="flex gap-2 pt-1">
                      <Button variant="outline" className="flex-1" onClick={() => setMemoOpen(false)}>취소</Button>
                      <Button
                        className="flex-1"
                        disabled={!memoForm.content.trim() || createMemoMutation.isPending}
                        onClick={() => createMemoMutation.mutate({ memberId, memoDate: memoForm.memoDate, content: memoForm.content })}
                      >
                        {createMemoMutation.isPending ? "저장 중..." : "저장"}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent className="px-4 sm:px-6">
              {!memoList?.length ? (
                <p className="text-muted-foreground text-sm text-center py-8">운동 메모가 없습니다.</p>
              ) : (
                <div className="space-y-3">
                  {memoList.map((memo) => (
                    <div key={memo.id} className="p-3 rounded-lg bg-accent/20 border border-border">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-medium text-primary">
                          {format(new Date(memo.memoDate), "yyyy.MM.dd (EEE)", { locale: ko })}
                        </p>
                        <button
                          onClick={() => deleteMemoMutation.mutate({ id: memo.id })}
                          className="text-muted-foreground hover:text-red-400 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <p className="text-sm text-foreground whitespace-pre-wrap">{memo.content}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── 출석 탭 ── */}
        <TabsContent value="attendance" className="mt-4 space-y-3">
          {/* 출석 체크 버튼 */}
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

          {/* 달력 카드 */}
          <Card className="bg-card border-border">
            <CardHeader className="px-4 pb-2 pt-4">
              <div className="flex items-center justify-between">
                <button onClick={() => moveMonth(-1)} className="p-1.5 rounded-md hover:bg-accent transition-colors">
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <p className="text-sm font-semibold">
                  {calendarDate.year}년 {calendarDate.month + 1}월
                </p>
                <button onClick={() => moveMonth(1)} className="p-1.5 rounded-md hover:bg-accent transition-colors">
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </CardHeader>
            <CardContent className="px-3 pb-4">
              {/* 요일 헤더 */}
              <div className="grid grid-cols-7 mb-1">
                {["일", "월", "화", "수", "목", "금", "토"].map((d) => (
                  <div key={d} className="text-center text-xs text-muted-foreground py-1">{d}</div>
                ))}
              </div>
              {/* 날짜 그리드 */}
              <div className="grid grid-cols-7 gap-0.5">
                {calendarDays.map((day, i) => {
                  if (!day) return <div key={i} />;
                  const dateStr = `${calendarDate.year}-${String(calendarDate.month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                  const status = attendanceMap[dateStr];
                  const isToday = dateStr === todayStr;
                  return (
                    <div
                      key={i}
                      className={`aspect-square flex items-center justify-center rounded-full text-xs font-medium transition-colors ${
                        status === "attended"
                          ? "bg-green-500 text-white"
                          : status === "noshow"
                          ? "bg-red-500/80 text-white"
                          : status === "absent"
                          ? "bg-yellow-500/60 text-white"
                          : isToday
                          ? "border border-primary text-primary"
                          : "text-foreground"
                      }`}
                    >
                      {day}
                    </div>
                  );
                })}
              </div>
              {/* 범례 */}
              <div className="flex items-center gap-3 mt-3 justify-center">
                {[
                  { color: "bg-green-500", label: "출석" },
                  { color: "bg-red-500/80", label: "노쇼" },
                  { color: "bg-yellow-500/60", label: "결석" },
                ].map((item) => (
                  <div key={item.label} className="flex items-center gap-1">
                    <div className={`w-3 h-3 rounded-full ${item.color}`} />
                    <span className="text-xs text-muted-foreground">{item.label}</span>
                  </div>
                ))}
              </div>
              {attendanceList && (
                <p className="text-xs text-muted-foreground text-center mt-2">
                  총 출석 {attendanceList.filter(a => a.status === "attended").length}회
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* 미수금 수정 다이얼로그 */}
      <Dialog open={unpaidOpen} onOpenChange={setUnpaidOpen}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle>미수금 수정</DialogTitle>
            <DialogDescription>현재 미수금: {unpaidEdit.current.toLocaleString()}원</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">새 미수금 금액</Label>
              <Input
                type="number"
                min="0"
                placeholder="0"
                value={unpaidEdit.value}
                onChange={(e) => setUnpaidEdit((p) => ({ ...p, value: e.target.value }))}
                className="h-9 text-sm"
              />
              <p className="text-xs text-muted-foreground">0원 입력 시 미수금 완납 처리됩니다.</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setUnpaidOpen(false)}>취소</Button>
              <Button
                className="flex-1"
                disabled={updatePaymentMutation.isPending}
                onClick={() =>
                  updatePaymentMutation.mutate({
                    packageId: unpaidEdit.packageId,
                    unpaidAmount: parseInt(unpaidEdit.value) || 0,
                  })
                }
              >
                {updatePaymentMutation.isPending ? "저장 중..." : "저장"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 세션 사용 후 운동 메모 입력 다이얼로그 */}
      <Dialog open={sessionMemoOpen} onOpenChange={setSessionMemoOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>운동 메모 작성</DialogTitle>
            <DialogDescription>오늘 세션 내용을 간단히 기록해두세요. (선택)</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Textarea
              value={sessionMemoContent}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setSessionMemoContent(e.target.value)}
              placeholder="오늘 운동 내용, 특이사항 등..."
              rows={4}
              className="text-sm resize-none"
            />
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setSessionMemoOpen(false)}>
                건너뛰기
              </Button>
              <Button
                className="flex-1"
                disabled={!sessionMemoContent.trim() || createMemoMutation.isPending}
                onClick={() => {
                  createMemoMutation.mutate({
                    memberId,
                    memoDate: new Date().toISOString().split("T")[0],
                    content: sessionMemoContent,
                  });
                  setSessionMemoOpen(false);
                }}
              >
                저장
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 담당 트레이너 변경 다이얼로그 */}
      <Dialog open={trainerChangeOpen} onOpenChange={setTrainerChangeOpen}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle>담당 트레이너 변경</DialogTitle>
            <DialogDescription>{member?.name}님의 담당 트레이너를 변경합니다.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Select value={selectedTrainerId} onValueChange={setSelectedTrainerId}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="트레이너 선택" />
              </SelectTrigger>
              <SelectContent>
                {trainers?.map((t) => (
                  <SelectItem key={t.id} value={String(t.id)}>{t.trainerName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setTrainerChangeOpen(false)}>취소</Button>
              <Button
                className="flex-1"
                disabled={!selectedTrainerId || updateMemberMutation.isPending}
                onClick={() => updateMemberMutation.mutate({ id: memberId, trainerId: parseInt(selectedTrainerId) })}
              >
                {updateMemberMutation.isPending ? "변경 중..." : "변경"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
