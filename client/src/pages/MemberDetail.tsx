import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { format } from "date-fns";
import { ko } from "date-fns/locale";

function parseDate(s: string | null | undefined): Date | null {
  if (!s) return null;
  // normalize "2024-01-15 12:30:45+00" → "2024-01-15T12:30:45+00:00"
  const normalized = s.replace(" ", "T").replace(/\+(\d{2})$/, "+$1:00");
  const d = new Date(normalized);
  return isNaN(d.getTime()) ? null : d;
}

function fmtDate(s: string | null | undefined, fmt: string): string {
  try {
    const d = parseDate(s);
    return d ? format(d, fmt, { locale: ko }) : "-";
  } catch {
    return "-";
  }
}
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import ExerciseEditor, { type Exercise, parseExercisesJson } from "@/components/ExerciseEditor";
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
  Share2,
  Copy,
  Check,
  BarChart3,
  PauseCircle,
  Clock,
  RefreshCw,
  MapPin,
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
    ptProgram: "",
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
  const [shareOpen, setShareOpen] = useState(false);
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [editMemoOpen, setEditMemoOpen] = useState(false);
  const [editMemoForm, setEditMemoForm] = useState({ id: 0, memoDate: "", content: "" });
  const [unpaidEdit, setUnpaidEdit] = useState<{ packageId: number; current: number; value: string }>({
    packageId: 0,
    current: 0,
    value: "",
  });
  const [pauseOpen, setPauseOpen] = useState(false);
  const [pauseForm, setPauseForm] = useState({ packageId: 0, pauseStart: "", pauseEnd: "", reason: "" });
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleForm, setScheduleForm] = useState({ scheduledDate: "", scheduledTime: "", notes: "" });
  const [sessionDialogOpen, setSessionDialogOpen] = useState(false);
  const [sessionDialogPkgId, setSessionDialogPkgId] = useState(0);
  const [sessionForm, setSessionForm] = useState({
    sessionDate: new Date().toISOString().split("T")[0],
    notes: "",
    exerciseType: "",
    bodyPart: "",
    exercises: [] as Exercise[],
  });

  const { data: currentUser } = trpc.auth.me.useQuery();
  const { data: member, isLoading } = trpc.members.getById.useQuery({ id: memberId });
  const { data: ptPackages, refetch: refetchPt } = trpc.pt.listByMember.useQuery({ memberId });
  const { data: payments } = trpc.members.getPayments.useQuery({ memberId });
  const { data: attendanceList, refetch: refetchAttendance } =
    trpc.attendances.listByMember.useQuery({ memberId });
  const { data: trainers } = trpc.trainers.list.useQuery();
  const { data: memoList, refetch: refetchMemos } = trpc.workoutMemos.listByMember.useQuery({ memberId });
  const { data: sessionLogs } = trpc.pt.sessionLogs.useQuery({ memberId });
  const { data: conditionChecks } = trpc.attendanceChecks.listByMember.useQuery({ memberId });
  const { data: stats } = trpc.members.getStats.useQuery({ memberId });
  const { data: pauses, refetch: refetchPauses } = trpc.pt.listPauses.useQuery({ memberId });
  const { data: memberSchedules, refetch: refetchSchedules } = trpc.schedules.listByMember.useQuery({ memberId });

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
      try { utils.dashboard.getStats.invalidate(); } catch {}
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

  const updateMemoMutation = trpc.workoutMemos.update.useMutation({
    onSuccess: () => {
      toast.success("메모가 수정되었습니다.");
      setEditMemoOpen(false);
      refetchMemos();
    },
    onError: (err) => toast.error(err.message || "수정 실패"),
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

  // 보고서 공유 토큰 발급
  const generateReportMutation = trpc.reports.generate.useMutation({
    onSuccess: (data) => {
      setShareToken(data.token);
      setShareOpen(true);
    },
    onError: (err) => toast.error(err.message || "링크 발급 실패"),
  });

  // 보고서 토큰 재발급
  const regenerateReportMutation = trpc.reports.regenerate.useMutation({
    onSuccess: (data) => {
      setShareToken(data.token);
      setCopied(false);
      toast.success("새 링크가 발급되었습니다. 기존 링크는 무효화됩니다.");
    },
    onError: (err) => toast.error(err.message || "링크 재발급 실패"),
  });

  const handleCopyLink = () => {
    if (!shareToken) return;
    const url = `${window.location.origin}/report/${shareToken}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const updateStatusMutation = trpc.pt.updateStatus.useMutation({
    onSuccess: () => { toast.success("상태가 변경되었습니다."); refetchPt(); },
    onError: () => toast.error("상태 변경 실패"),
  });
  const addPauseMutation = trpc.pt.addPause.useMutation({
    onSuccess: () => { toast.success("정지 내역이 등록되었습니다."); setPauseOpen(false); refetchPauses(); },
    onError: () => toast.error("등록 실패"),
  });
  const removePauseMutation = trpc.pt.removePause.useMutation({
    onSuccess: () => { toast.success("삭제되었습니다."); refetchPauses(); },
    onError: () => toast.error("삭제 실패"),
  });
  const createScheduleMutation = trpc.schedules.create.useMutation({
    onSuccess: () => { toast.success("일정이 등록되었습니다."); setScheduleOpen(false); setScheduleForm({ scheduledDate: "", scheduledTime: "", notes: "" }); refetchSchedules(); },
    onError: () => toast.error("등록 실패"),
  });
  const deleteScheduleMutation = trpc.schedules.delete.useMutation({
    onSuccess: () => { toast.success("일정이 삭제되었습니다."); refetchSchedules(); },
    onError: () => toast.error("삭제 실패"),
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
            onClick={() => {
              if (shareToken) { setShareOpen(true); }
              else { generateReportMutation.mutate({ memberId }); }
            }}
            disabled={generateReportMutation.isPending}
            className="gap-1.5"
          >
            <Share2 className="h-3.5 w-3.5" />
            공유
          </Button>
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
        <TabsList className="w-full grid grid-cols-5">
          <TabsTrigger value="info" className="text-xs px-1">기본정보</TabsTrigger>
          <TabsTrigger value="pt" className="text-xs px-1">PT정보</TabsTrigger>
          <TabsTrigger value="stats" className="text-xs px-1">통계</TabsTrigger>
          <TabsTrigger value="memo" className="text-xs px-1">메모</TabsTrigger>
          <TabsTrigger value="attendance" className="text-xs px-1">출석</TabsTrigger>
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
                  value={fmtDate(member.birthDate, "yyyy년 MM월 dd일")}
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
                  value={fmtDate(member.membershipStart, "yyyy.MM.dd")}
                />
                <InfoRow
                  icon={<Calendar className="h-4 w-4" />}
                  label="회원권 만료"
                  value={fmtDate(member.membershipEnd, "yyyy.MM.dd")}
                />
                <InfoRow
                  icon={<Calendar className="h-4 w-4" />}
                  label="최초 등록일"
                  value={fmtDate(member.createdAt, "yyyy.MM.dd")}
                />
                {member.visitRoute && (
                  <InfoRow icon={<MapPin className="h-4 w-4" />} label="유입경로" value={member.visitRoute} />
                )}
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
                    <div className="space-y-1.5">
                      <Label className="text-xs">PT 패키지명</Label>
                      <Input
                        value={pkgForm.ptProgram}
                        onChange={(e) => setPkgForm((p) => ({ ...p, ptProgram: e.target.value }))}
                        placeholder="패키지명 직접 입력"
                        className="h-9 text-sm"
                      />
                      <div className="flex gap-1.5 flex-wrap">
                        {["케어피티", "웨이트피티", "필라테스"].map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => setPkgForm((p) => ({ ...p, ptProgram: p.ptProgram === preset ? "" : preset }))}
                            className={`px-2.5 py-0.5 rounded-full text-xs border transition-colors ${
                              pkgForm.ptProgram === preset
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
                      <Label className="text-xs">총 횟수 <span className="text-primary">*</span></Label>
                      <Input
                        type="number" min="1" placeholder="20"
                        value={pkgForm.totalSessions}
                        onChange={(e) => setPkgForm((p) => ({ ...p, totalSessions: e.target.value }))}
                        className="h-9 text-sm"
                      />
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
                              {fmtDate(pkg.startDate, "yyyy.MM.dd")}{" "}~{" "}
                              {fmtDate(pkg.expiryDate, "yyyy.MM.dd")}
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
                              onClick={() => {
                                setSessionDialogPkgId(pkg.id);
                                setSessionForm({ sessionDate: new Date().toISOString().split("T")[0], notes: "", exerciseType: "", bodyPart: "", exercises: [] });
                                setSessionDialogOpen(true);
                              }}
                            >
                              <Dumbbell className="h-3.5 w-3.5" />
                              세션 1회 사용
                            </Button>
                          </div>
                        )}

                        {/* 세션 사용 기록 */}
                        {(() => {
                          const logs = sessionLogs?.filter(l => l.packageId === pkg.id) ?? [];
                          if (!logs.length) return null;
                          return (
                            <div className="mt-3 pt-3 border-t border-border/50">
                              <p className="text-xs text-muted-foreground mb-1.5">최근 세션 기록</p>
                              <div className="space-y-1">
                                {logs.slice(0, 5).map(log => {
                                  const exs = parseExercisesJson(log.exercisesJson as string | null);
                                  return (
                                    <div key={log.id} className="text-xs py-1.5 border-b border-border/30 last:border-0">
                                      <div className="flex items-center justify-between">
                                        <span className="text-foreground/70">{fmtDate(log.sessionDate, "yyyy.MM.dd (EEE)")}</span>
                                        <div className="flex items-center gap-1.5">
                                          {(log as any).bodyPart && <span className="px-1.5 py-0.5 rounded-full bg-primary/20 text-primary text-[10px]">{(log as any).bodyPart}</span>}
                                          {log.notes && <span className="text-muted-foreground truncate max-w-[100px]">{log.notes}</span>}
                                        </div>
                                      </div>
                                      {exs.length > 0 && (
                                        <div className="mt-1 space-y-0.5 pl-1">
                                          {exs.map((ex, i) => (
                                            <div key={i} className="text-muted-foreground">
                                              <span className="font-medium text-foreground/60">{ex.name}</span>
                                              {ex.sets.map((s, j) => (
                                                <span key={j} className="ml-2">
                                                  {j + 1}세트 {s.reps && `${s.reps}회`}{s.weight && ` ${s.weight}kg`}
                                                </span>
                                              ))}
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                                {logs.length > 5 && (
                                  <p className="text-xs text-muted-foreground">외 {logs.length - 5}회 더</p>
                                )}
                              </div>
                            </div>
                          );
                        })()}

                        {/* 상태 변경 버튼 */}
                        <div className="mt-3 flex gap-1.5 flex-wrap">
                          {(["active","paused","completed","refunded"] as const).map((s) => {
                            const labels: Record<string, string> = { active:"진행", paused:"정지", completed:"완료", refunded:"환불" };
                            const colors: Record<string, string> = { active:"border-green-500/40 text-green-400", paused:"border-yellow-500/40 text-yellow-400", completed:"border-gray-500/40 text-gray-400", refunded:"border-red-500/40 text-red-400" };
                            const isCur = pkg.status === s;
                            return (
                              <button key={s} onClick={() => !isCur && updateStatusMutation.mutate({ packageId: pkg.id, status: s })}
                                className={`px-2 py-0.5 rounded-full text-xs border transition-colors ${isCur ? `${colors[s]} bg-opacity-20` : "border-border text-muted-foreground hover:border-primary/40"} ${isCur ? "font-semibold" : ""}`}>
                                {labels[s]}
                              </button>
                            );
                          })}
                          <button onClick={() => { setPauseForm(p => ({ ...p, packageId: pkg.id })); setPauseOpen(true); }}
                            className="px-2 py-0.5 rounded-full text-xs border border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10 flex items-center gap-1">
                            <PauseCircle className="h-3 w-3" />정지 추가
                          </button>
                        </div>

                        {/* 정지 내역 */}
                        {pauses?.filter(p => p.packageId === pkg.id).map(pause => (
                          <div key={pause.id} className="mt-2 flex items-center justify-between text-xs bg-yellow-500/10 border border-yellow-500/20 rounded px-2 py-1">
                            <span className="text-yellow-400">{pause.pauseStart} ~ {pause.pauseEnd ?? "진행중"}{pause.reason ? ` · ${pause.reason}` : ""}</span>
                            <button onClick={() => removePauseMutation.mutate({ pauseId: pause.id })} className="text-muted-foreground hover:text-red-400 ml-2"><Trash2 className="h-3 w-3"/></button>
                          </div>
                        ))}

                        {/* 결제 정보 */}
                        {(pkg.paymentAmount || pkg.unpaidAmount || pkg.paymentMethod || (pkg as any).paymentDate || pkg.paymentMemo) && (
                          <div className="mt-3 pt-3 border-t border-border/50">
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              {pkg.paymentAmount ? (
                                <div>
                                  <p className="text-muted-foreground">결제 금액</p>
                                  <p className="font-medium">{pkg.paymentAmount.toLocaleString()}원</p>
                                </div>
                              ) : null}
                              {(pkg as any).paymentDate ? (
                                <div>
                                  <p className="text-muted-foreground">결제일자</p>
                                  <p className="font-medium">{(pkg as any).paymentDate}</p>
                                </div>
                              ) : null}
                              {pkg.unpaidAmount ? (
                                <div>
                                  <p className="text-muted-foreground">미수금</p>
                                  <div className="flex items-center gap-2">
                                    <p className="font-medium text-orange-400">{pkg.unpaidAmount.toLocaleString()}원</p>
                                    <button className="text-xs text-orange-400 underline hover:text-orange-300"
                                      onClick={() => { setUnpaidEdit({ packageId: pkg.id, current: pkg.unpaidAmount ?? 0, value: String(pkg.unpaidAmount ?? 0) }); setUnpaidOpen(true); }}>수정</button>
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
                                <div className="col-span-2">
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

        {/* ── 통계 탭 ── */}
        <TabsContent value="stats" className="mt-4 space-y-3">
          {/* 수업 통계 */}
          <Card className="bg-card border-border">
            <CardHeader className="px-4 pb-2 pt-4">
              <CardTitle className="text-sm flex items-center gap-2"><BarChart3 className="h-4 w-4 text-primary"/>수업 통계</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                {[
                  { label: "진행 수업 수", value: `${stats?.totalSessions ?? 0}회` },
                  { label: "총 예약 수", value: `${stats?.totalChecks ?? 0}회` },
                  { label: "취소 횟수", value: `${stats?.cancelCount ?? 0}회` },
                  { label: "노쇼 횟수", value: `${stats?.noshowCount ?? 0}회` },
                ].map(item => (
                  <div key={item.label} className="p-3 rounded-lg bg-accent/20 border border-border">
                    <p className="text-xs text-muted-foreground">{item.label}</p>
                    <p className="font-bold text-lg mt-0.5">{item.value}</p>
                  </div>
                ))}
              </div>
              <div className="mt-3 space-y-2 text-sm">
                {stats?.lastSessionDate && (
                  <div className="flex justify-between items-center py-1.5 border-b border-border/50">
                    <span className="text-muted-foreground flex items-center gap-1.5"><Clock className="h-3.5 w-3.5"/>마지막 수업일</span>
                    <span className="font-medium">{stats.lastSessionDate}</span>
                  </div>
                )}
                <div className="flex justify-between items-center py-1.5 border-b border-border/50">
                  <span className="text-muted-foreground flex items-center gap-1.5"><RefreshCw className="h-3.5 w-3.5"/>재등록 여부</span>
                  <span className={`font-medium ${stats?.reregistered ? "text-primary" : "text-muted-foreground"}`}>{stats?.reregistered ? `재등록 ${stats.reregistrationCount}회` : "첫 등록"}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 다음 예약/일정 */}
          <Card className="bg-card border-border">
            <CardHeader className="px-4 pb-2 pt-4 flex flex-row items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2"><Calendar className="h-4 w-4 text-blue-400"/>다음 예약일</CardTitle>
              <Dialog open={scheduleOpen} onOpenChange={setScheduleOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="gap-1 text-xs h-7"><Plus className="h-3 w-3"/>추가</Button>
                </DialogTrigger>
                <DialogContent className="max-w-sm">
                  <DialogHeader><DialogTitle>일정 등록</DialogTitle></DialogHeader>
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">날짜 *</Label>
                      <Input type="date" value={scheduleForm.scheduledDate} onChange={e => setScheduleForm(p => ({ ...p, scheduledDate: e.target.value }))} className="h-9 text-sm"/>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">시간 (선택)</Label>
                      <Input type="time" value={scheduleForm.scheduledTime} onChange={e => setScheduleForm(p => ({ ...p, scheduledTime: e.target.value }))} className="h-9 text-sm"/>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">메모</Label>
                      <Input placeholder="메모" value={scheduleForm.notes} onChange={e => setScheduleForm(p => ({ ...p, notes: e.target.value }))} className="h-9 text-sm"/>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" className="flex-1" onClick={() => setScheduleOpen(false)}>취소</Button>
                      <Button className="flex-1" disabled={!scheduleForm.scheduledDate || createScheduleMutation.isPending}
                        onClick={() => createScheduleMutation.mutate({ memberId, scheduledDate: scheduleForm.scheduledDate, scheduledTime: scheduleForm.scheduledTime || undefined, notes: scheduleForm.notes || undefined })}>
                        {createScheduleMutation.isPending ? "저장 중..." : "저장"}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              {!memberSchedules?.length ? (
                <p className="text-sm text-muted-foreground text-center py-4">등록된 일정이 없습니다.</p>
              ) : (
                <div className="space-y-2">
                  {memberSchedules.map(s => (
                    <div key={s.id} className={`flex items-center justify-between p-2.5 rounded-lg border text-sm ${s.status === "pending" ? "border-primary/30 bg-primary/5" : "border-border bg-accent/10 opacity-60"}`}>
                      <div>
                        <span className="font-medium">{s.scheduledDate}{s.scheduledTime ? ` ${s.scheduledTime}` : ""}</span>
                        {s.notes && <span className="text-xs text-muted-foreground ml-2">{s.notes}</span>}
                      </div>
                      <button onClick={() => deleteScheduleMutation.mutate({ scheduleId: s.id })} className="text-muted-foreground hover:text-red-400"><Trash2 className="h-3.5 w-3.5"/></button>
                    </div>
                  ))}
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
                          {fmtDate(memo.memoDate, "yyyy.MM.dd (EEE)")}
                        </p>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              setEditMemoForm({ id: memo.id, memoDate: memo.memoDate, content: memo.content });
                              setEditMemoOpen(true);
                            }}
                            className="text-muted-foreground hover:text-primary transition-colors"
                          >
                            <Edit className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => deleteMemoMutation.mutate({ id: memo.id })}
                            className="text-muted-foreground hover:text-red-400 transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
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

          {/* 컨디션 체크 이력 */}
          {conditionChecks && conditionChecks.length > 0 && (
            <Card className="bg-card border-border">
              <CardHeader className="px-4 pb-2 pt-4">
                <CardTitle className="text-sm">컨디션 체크 이력</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="space-y-0">
                  {conditionChecks.map((check) => (
                    <div key={check.id} className="flex items-start gap-3 py-2.5 border-b border-border last:border-0">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium">
                            {fmtDate(check.checkDate, "MM.dd (EEE)")}
                          </p>
                          <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                            check.status === "attended"
                              ? "bg-green-500/20 text-green-400"
                              : check.status === "noshow"
                              ? "bg-red-500/20 text-red-400"
                              : "bg-yellow-500/20 text-yellow-400"
                          }`}>
                            {check.status === "attended" ? "출석" : check.status === "noshow" ? "노쇼" : "캔슬"}
                          </span>
                        </div>
                        <div className="flex gap-3 mt-0.5 text-xs text-muted-foreground flex-wrap">
                          {check.conditionScore != null && (
                            <span>컨디션 {check.conditionScore}/5</span>
                          )}
                          {check.energyLevel && <span>에너지 {check.energyLevel}</span>}
                          {check.sleepHours && <span>수면 {check.sleepHours}h</span>}
                          {check.painLevel != null && check.painLevel > 0 && (
                            <span className="text-orange-400">
                              통증 {check.painLevel}/10{check.painArea ? ` (${check.painArea})` : ""}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
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

      {/* 운동 메모 수정 다이얼로그 */}
      <Dialog open={editMemoOpen} onOpenChange={setEditMemoOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>운동 메모 수정</DialogTitle>
            <DialogDescription>
              {editMemoForm.memoDate
                ? fmtDate(editMemoForm.memoDate, "yyyy.MM.dd (EEE)")
                : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Textarea
              value={editMemoForm.content}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                setEditMemoForm((p) => ({ ...p, content: e.target.value }))
              }
              rows={5}
              className="text-sm resize-none"
            />
            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => setEditMemoOpen(false)}>
                취소
              </Button>
              <Button
                className="flex-1"
                disabled={!editMemoForm.content.trim() || updateMemoMutation.isPending}
                onClick={() =>
                  updateMemoMutation.mutate({ id: editMemoForm.id, content: editMemoForm.content })
                }
              >
                {updateMemoMutation.isPending ? "저장 중..." : "저장"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 보고서 공유 다이얼로그 */}
      <Dialog open={shareOpen} onOpenChange={setShareOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Share2 className="h-4 w-4" />
              보고서 공유 링크
            </DialogTitle>
            <DialogDescription>
              아래 링크를 {member?.name}님께 공유하세요. 로그인 없이 열람 가능합니다.
            </DialogDescription>
          </DialogHeader>
          {shareToken && (
            <div className="space-y-3">
              <div className="p-3 bg-accent/30 rounded-lg border border-border">
                <p className="text-xs text-foreground break-all">
                  {`${window.location.origin}/report/${shareToken}`}
                </p>
              </div>
              <Button
                className="w-full gap-2"
                onClick={handleCopyLink}
                variant={copied ? "outline" : "default"}
              >
                {copied ? (
                  <><Check className="h-4 w-4 text-green-400" />복사 완료</>
                ) : (
                  <><Copy className="h-4 w-4" />링크 복사</>
                )}
              </Button>
              <Button
                variant="outline"
                className="w-full gap-2 text-muted-foreground text-xs"
                disabled={regenerateReportMutation.isPending}
                onClick={() => regenerateReportMutation.mutate({ memberId })}
              >
                {regenerateReportMutation.isPending ? "발급 중..." : "새 링크 발급 (기존 링크 무효화)"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 정지 추가 다이얼로그 */}
      <Dialog open={pauseOpen} onOpenChange={setPauseOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>정지 내역 추가</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">시작일 *</Label>
                <Input type="date" value={pauseForm.pauseStart} onChange={e => setPauseForm(p => ({ ...p, pauseStart: e.target.value }))} className="h-9 text-sm"/>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">종료일</Label>
                <Input type="date" value={pauseForm.pauseEnd} onChange={e => setPauseForm(p => ({ ...p, pauseEnd: e.target.value }))} className="h-9 text-sm"/>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">사유</Label>
              <Input placeholder="부상, 여행 등" value={pauseForm.reason} onChange={e => setPauseForm(p => ({ ...p, reason: e.target.value }))} className="h-9 text-sm"/>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setPauseOpen(false)}>취소</Button>
              <Button className="flex-1" disabled={!pauseForm.pauseStart || addPauseMutation.isPending}
                onClick={() => addPauseMutation.mutate({ packageId: pauseForm.packageId, memberId, pauseStart: pauseForm.pauseStart, pauseEnd: pauseForm.pauseEnd || undefined, reason: pauseForm.reason || undefined })}>
                {addPauseMutation.isPending ? "저장 중..." : "저장"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 세션 사용 기록 다이얼로그 (운동 부위 + 종목) */}
      <Dialog open={sessionDialogOpen} onOpenChange={setSessionDialogOpen}>
        <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>수업 기록</DialogTitle>
            <DialogDescription>세션 내용을 기록해주세요.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">수업일</label>
              <Input type="date" value={sessionForm.sessionDate} onChange={e => setSessionForm(p => ({ ...p, sessionDate: e.target.value }))} className="h-9 text-sm" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">운동 형태</label>
              <Select value={sessionForm.exerciseType || "__none"} onValueChange={v => setSessionForm(p => ({ ...p, exerciseType: v === "__none" ? "" : v }))}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="운동 형태를 선택하세요" /></SelectTrigger>
                <SelectContent position="popper" className="max-h-60 overflow-y-auto">
                  <SelectItem value="__none">선택 안함</SelectItem>
                  {["다이어트","체형교정","재활","근비대","퍼포먼스","일반건강","스트레칭","유산소","기능성훈련","밸런스","체력증진"].map(t => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">운동 부위</label>
              <Select value={sessionForm.bodyPart || "__none"} onValueChange={v => setSessionForm(p => ({ ...p, bodyPart: v === "__none" ? "" : v }))}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="운동 부위를 선택하세요" /></SelectTrigger>
                <SelectContent position="popper" className="max-h-60 overflow-y-auto">
                  <SelectItem value="__none">선택 안함</SelectItem>
                  {["전신","상체","하체","등","어깨","가슴","복부","허리","코어","고관절","대퇴 후면","대퇴 전면","하퇴","발목·발","이두","삼두","유산소","기타"].map(bp => (
                    <SelectItem key={bp} value={bp}>{bp}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">운동 종목</label>
              <ExerciseEditor
                exercises={sessionForm.exercises}
                onChange={exs => setSessionForm(p => ({ ...p, exercises: exs }))}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">메모 (선택)</label>
              <Textarea value={sessionForm.notes} onChange={e => setSessionForm(p => ({ ...p, notes: e.target.value }))} placeholder="특이사항, 컨디션 등..." rows={2} className="text-sm resize-none" />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setSessionDialogOpen(false)}>취소</Button>
              <Button
                className="flex-1"
                disabled={useSessionMutation.isPending}
                onClick={() => {
                  useSessionMutation.mutate({
                    packageId: sessionDialogPkgId,
                    memberId,
                    sessionDate: sessionForm.sessionDate,
                    notes: sessionForm.notes || undefined,
                    bodyPart: sessionForm.bodyPart || undefined,
                    exercisesJson: sessionForm.exercises.length > 0 ? JSON.stringify(sessionForm.exercises) : undefined,
                  });
                  setSessionDialogOpen(false);
                }}
              >
                {useSessionMutation.isPending ? "기록 중..." : "기록 완료"}
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
