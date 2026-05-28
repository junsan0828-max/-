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
import BodyPartPicker from "@/components/BodyPartPicker";
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
import PointSpendConfirm from "@/components/PointSpendConfirm";
import { useAutoPoints, pointLabel } from "@/hooks/useAutoPoints";
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
  ChevronDown,
  ChevronUp,
  Send,
  LayoutTemplate,
} from "lucide-react";

function TemplateLoader({ onLoad }: { onLoad: (exs: Exercise[]) => void }) {
  const { data: templates } = trpc.workoutTemplates.list.useQuery();
  const [open, setOpen] = useState(false);
  if (!templates || templates.length === 0) return null;
  return (
    <div className="relative">
      <button onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 text-xs text-primary mb-1">
        <LayoutTemplate className="h-3.5 w-3.5" />템플릿 불러오기
      </button>
      {open && (
        <div className="absolute z-10 top-6 left-0 w-56 bg-card border border-border rounded-xl shadow-lg overflow-hidden">
          {templates.map((t: any) => (
            <button key={t.id} className="w-full text-left px-3 py-2.5 text-xs hover:bg-accent/30 transition-colors border-b border-border last:border-0"
              onClick={() => {
                const exs: Exercise[] = t.exercisesJson ? JSON.parse(t.exercisesJson) : [];
                onLoad(exs);
                setOpen(false);
                toast.success(`${t.name} 템플릿 적용됨`);
              }}>
              <p className="font-medium">{t.name}</p>
              {t.bodyPart && <p className="text-muted-foreground mt-0.5">{t.bodyPart}</p>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

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
  const autoPoints = useAutoPoints();

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

  // 패키지 수정 다이얼로그 상태
  const [editPkgOpen, setEditPkgOpen] = useState(false);
  const [editPkgForm, setEditPkgForm] = useState({
    packageId: 0,
    packageName: "",
    totalSessions: "",
    usedSessions: "",
    startDate: "",
    expiryDate: "",
    paymentAmount: "",
    unpaidAmount: "",
    paymentMethod: "" as "" | "현금영수증" | "이체" | "지역화폐" | "카드",
    paymentDate: "",
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
  const [shareOpen, setShareOpen] = useState(false);
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [reportPointConfirm, setReportPointConfirm] = useState(false);
  const [editMemoOpen, setEditMemoOpen] = useState(false);
  const [editMemoForm, setEditMemoForm] = useState({ id: 0, memoDate: "", content: "" });
  const [unpaidEdit, setUnpaidEdit] = useState<{ packageId: number; current: number; value: string }>({
    packageId: 0,
    current: 0,
    value: "",
  });
  const [pauseOpen, setPauseOpen] = useState(false);
  const [pauseForm, setPauseForm] = useState({ packageId: 0, pauseStart: "", pauseEnd: "", reason: "" });
  const [sessionDialogOpen, setSessionDialogOpen] = useState(false);
  const [sessionDialogPkgId, setSessionDialogPkgId] = useState(0);
  const [sessionForm, setSessionForm] = useState({
    sessionDate: new Date().toISOString().split("T")[0],
    notes: "",
    exerciseType: "",
    bodyPart: "",
    exercises: [] as Exercise[],
    goal: "",
    feedback: "",
  });

  // 트레이닝 일지 상태
  const [trainingSubTab, setTrainingSubTab] = useState<"journal" | "memo">("journal");
  const [journalOpen, setJournalOpen] = useState(false);
  const [journalForm, setJournalForm] = useState({
    sessionDate: new Date().toISOString().split("T")[0],
    goal: "",
    bodyPart: "",
    exercises: [] as Exercise[],
    feedback: "",
    notes: "",
  });
  const [editJournalOpen, setEditJournalOpen] = useState(false);
  const [editJournalForm, setEditJournalForm] = useState({
    id: 0,
    sessionDate: "",
    goal: "",
    bodyPart: "",
    exercises: [] as Exercise[],
    feedback: "",
    notes: "",
  });

  // 메모 검색
  const [memoSearch, setMemoSearch] = useState("");

  // 트레이닝 일지 펼치기
  const [expandedLogIds, setExpandedLogIds] = useState<Set<number>>(new Set());
  const toggleLog = (id: number) =>
    setExpandedLogIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  // 트레이닝 기록 상세 모달 (인라인 편집)
  const [viewLogOpen, setViewLogOpen] = useState(false);
  const [viewLogData, setViewLogData] = useState<{ log: any; exs: Exercise[] } | null>(null);
  const [checkedSets, setCheckedSets] = useState<Record<string, boolean>>({});
  const openViewLog = (log: any, exs: Exercise[]) => {
    const withSets = exs.map(ex => ({
      ...ex,
      sets: ex.sets.length > 0 ? ex.sets : [{ reps: "", weight: "" }],
    }));
    setViewLogData({ log, exs: JSON.parse(JSON.stringify(withSets)) });
    setCheckedSets({});
    setViewLogOpen(true);
  };
  const toggleSetCheck = (exIdx: number, setIdx: number) => {
    const key = `${exIdx}-${setIdx}`;
    setCheckedSets(prev => ({ ...prev, [key]: !prev[key] }));
  };
  const updateViewExs = (updater: (exs: Exercise[]) => Exercise[]) => {
    setViewLogData(prev => prev ? { ...prev, exs: updater(prev.exs) } : prev);
  };
  const updateViewSet = (exIdx: number, setIdx: number, field: "reps" | "weight", val: string) =>
    updateViewExs(exs => exs.map((ex, i) => i !== exIdx ? ex : {
      ...ex, sets: ex.sets.map((s, j) => j !== setIdx ? s : { ...s, [field]: val })
    }));
  const addViewSet = (exIdx: number) =>
    updateViewExs(exs => exs.map((ex, i) => i !== exIdx ? ex : {
      ...ex, sets: [...ex.sets, { reps: "", weight: "" }]
    }));
  const removeViewSet = (exIdx: number, setIdx: number) =>
    updateViewExs(exs => exs.map((ex, i) => i !== exIdx ? ex : {
      ...ex, sets: ex.sets.filter((_, j) => j !== setIdx)
    }));
  const addViewExercise = (afterIdx?: number) =>
    updateViewExs(exs => {
      const newEx = { name: "", sets: [{ reps: "", weight: "" }] };
      if (afterIdx === undefined) return [...exs, newEx];
      const next = [...exs];
      next.splice(afterIdx + 1, 0, newEx);
      return next;
    });
  const removeViewExercise = (exIdx: number) =>
    updateViewExs(exs => exs.filter((_, i) => i !== exIdx));
  const updateViewExName = (exIdx: number, name: string) =>
    updateViewExs(exs => exs.map((ex, i) => i !== exIdx ? ex : { ...ex, name }));

  const { data: currentUser } = trpc.auth.me.useQuery();
  const { data: member, isLoading } = trpc.members.getById.useQuery({ id: memberId });
  const { data: ptPackages, refetch: refetchPt } = trpc.pt.listByMember.useQuery({ memberId });
  const { data: payments } = trpc.members.getPayments.useQuery({ memberId });
  const { data: attendanceList, refetch: refetchAttendance } =
    trpc.attendances.listByMember.useQuery({ memberId });
  const { data: memoList, refetch: refetchMemos } = trpc.workoutMemos.listByMember.useQuery({ memberId });
  const { data: sessionLogs } = trpc.pt.sessionLogs.useQuery({ memberId });
  const { data: conditionChecks } = trpc.attendanceChecks.listByMember.useQuery({ memberId });
  const { data: stats } = trpc.members.getStats.useQuery({ memberId });
  const { data: pauses, refetch: refetchPauses } = trpc.pt.listPauses.useQuery({ memberId });

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

  // 트레이닝 일지 CRUD
  const createLogMutation = trpc.pt.createLog.useMutation({
    onSuccess: () => {
      toast.success("트레이닝 일지가 저장되었습니다.");
      setJournalOpen(false);
      setJournalForm({ sessionDate: new Date().toISOString().split("T")[0], goal: "", bodyPart: "", exercises: [], feedback: "", notes: "" });
      utils.pt.sessionLogs.invalidate({ memberId });
    },
    onError: (err) => toast.error(err.message || "저장 실패"),
  });

  const updateLogMutation = trpc.pt.updateLog.useMutation({
    onSuccess: () => {
      toast.success("일지가 수정되었습니다.");
      setEditJournalOpen(false);
      utils.pt.sessionLogs.invalidate({ memberId });
    },
    onError: (err) => toast.error(err.message || "수정 실패"),
  });

  const deleteLogMutation = trpc.pt.deleteLog.useMutation({
    onSuccess: () => {
      toast.success("일지가 삭제되었습니다.");
      utils.pt.sessionLogs.invalidate({ memberId });
    },
    onError: (err) => toast.error(err.message || "삭제 실패"),
  });

  const sendToMemberMutation = trpc.fitStepPlus.trainer_sendSessionToMember.useMutation({
    onSuccess: () => toast.success("회원 FIT STEP+ 운동기록으로 전송되었습니다."),
    onError: (err) => {
      if (err.data?.code === "CONFLICT") toast.error("이미 전송된 일지입니다.");
      else toast.error(err.message || "전송 실패");
    },
  });

  // PT 세션 사용 (완료 후 메모 입력 유도)
  const useSessionMutation = trpc.pt.useSession.useMutation({
    onSuccess: (data) => {
      toast.success(`세션 사용 완료! 잔여 ${data.remaining}회`);
      refetchPt();
      utils.members.getStats.invalidate({ memberId });
      utils.pt.sessionLogs.invalidate({ memberId });
      setSessionMemoContent("");
      setSessionMemoOpen(true);
    },
    onError: (err) => toast.error(err.message || "세션 사용 실패"),
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

  const spendFeatureMutation = trpc.fitPoints.spendFeature.useMutation();

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

  const updatePackageMutation = trpc.pt.updatePackage.useMutation({
    onSuccess: () => {
      toast.success("패키지 정보가 수정되었습니다.");
      setEditPkgOpen(false);
      refetchPt();
    },
    onError: (err) => toast.error(err.message || "수정 실패"),
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
              else { setReportPointConfirm(true); }
            }}
            disabled={generateReportMutation.isPending}
            className="gap-1.5"
          >
            <Share2 className="h-3.5 w-3.5" />
            공유 <span className="text-primary/70 text-[10px]">-50P</span>
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
          <TabsTrigger value="training" className="text-xs px-1">트레이닝</TabsTrigger>
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
            <span className="flex items-center gap-1.5">
              PAR-Q 사전건강검사
              {pointLabel(autoPoints("parq_submit")) && (
                <span className="text-xs text-green-400 font-normal">{pointLabel(autoPoints("parq_submit"))} 최초</span>
              )}
            </span>
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
                <InfoRow
                  icon={<Activity className="h-4 w-4" />}
                  label="총 결제 금액"
                  value={ptPackages ? `${ptPackages.reduce((sum, p) => sum + (p.paymentAmount ?? 0), 0).toLocaleString()}원` : "-"}
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
                    프로그램 추가
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-sm">
                  <DialogHeader>
                    <DialogTitle>PT 프로그램 추가</DialogTitle>
                    <DialogDescription>{member.name}님에게 새 PT 프로그램을 추가합니다.</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">PT 프로그램</Label>
                      <Input
                        value={pkgForm.ptProgram}
                        onChange={(e) => setPkgForm((p) => ({ ...p, ptProgram: e.target.value }))}
                        placeholder="프로그램명 직접 입력"
                        className="h-9 text-sm"
                      />
                      <div className="flex gap-1.5 flex-wrap">
                        {["피티", "필라테스", "이벤트 세션"].map((preset) => (
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
                          <div className="flex flex-col items-end gap-1 shrink-0">
                            <div className="text-right">
                              <p className="text-lg font-bold text-primary">{remaining}회</p>
                              <p className="text-xs text-muted-foreground">잔여 / {pkg.totalSessions}회</p>
                            </div>
                            <button
                              onClick={() => {
                                setEditPkgForm({
                                  packageId: pkg.id,
                                  packageName: pkg.packageName ?? "",
                                  totalSessions: String(pkg.totalSessions),
                                  usedSessions: String(pkg.usedSessions),
                                  startDate: pkg.startDate ?? "",
                                  expiryDate: pkg.expiryDate ?? "",
                                  paymentAmount: pkg.paymentAmount ? String(pkg.paymentAmount) : "",
                                  unpaidAmount: pkg.unpaidAmount ? String(pkg.unpaidAmount) : "",
                                  paymentMethod: (pkg.paymentMethod ?? "") as any,
                                  paymentDate: (pkg as any).paymentDate ?? "",
                                  paymentMemo: pkg.paymentMemo ?? "",
                                });
                                setEditPkgOpen(true);
                              }}
                              className="text-xs text-primary underline hover:text-primary/70 transition-colors"
                            >
                              수정
                            </button>
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
                              onClick={() => {
                                const today = new Date().toISOString().split("T")[0];
                                setLocation(`/attendance/${memberId}?date=${today}`);
                              }}
                            >
                              <Dumbbell className="h-3.5 w-3.5" />
                              세션 1회 사용
                            </Button>
                          </div>
                        )}


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

                        {/* 프로그램 완료 → 보고서 버튼 */}
                        {(pkg.status === "completed" || pkg.usedSessions >= pkg.totalSessions) && (
                          <div className="mt-3 p-3 rounded-lg bg-green-500/10 border border-green-500/30">
                            <p className="text-xs text-green-400 font-medium mb-2">🎉 프로그램 완료! 회원 보고서를 생성하세요.</p>
                            <Button
                              size="sm"
                              className="w-full gap-2 bg-green-600 hover:bg-green-700 text-white"
                              disabled={generateReportMutation.isPending}
                              onClick={() => {
                                if (shareToken) { setShareOpen(true); }
                                else { setReportPointConfirm(true); }
                              }}
                            >
                              <Share2 className="h-3.5 w-3.5" />
                              보고서 생성 및 공유 (-50P)
                            </Button>
                          </div>
                        )}

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

        </TabsContent>

        {/* ── 트레이닝 탭 ── */}
        <TabsContent value="training" className="mt-4">
          {/* 서브탭 */}
          <div className="flex gap-1 mb-4 bg-accent/20 p-1 rounded-lg">
            <button
              onClick={() => setTrainingSubTab("journal")}
              className={`flex-1 py-1.5 text-xs rounded-md font-medium transition-colors ${trainingSubTab === "journal" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              트레이닝 일지
            </button>
            <button
              onClick={() => setTrainingSubTab("memo")}
              className={`flex-1 py-1.5 text-xs rounded-md font-medium transition-colors ${trainingSubTab === "memo" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              메모
            </button>
          </div>

          {/* ── 트레이닝 일지 서브탭 ── */}
          {trainingSubTab === "journal" && (
            <div className="space-y-3">
              <Button
                size="sm"
                className="w-full gap-1.5 text-xs"
                onClick={() => {
                  setJournalForm({ sessionDate: new Date().toISOString().split("T")[0], goal: "", bodyPart: "", exercises: [], feedback: "", notes: "" });
                  setJournalOpen(true);
                }}
              >
                <Plus className="h-3.5 w-3.5" />
                트레이닝 일지 작성
              </Button>

              {!sessionLogs?.length ? (
                <p className="text-muted-foreground text-sm text-center py-8">트레이닝 기록이 없습니다.</p>
              ) : (
                <div className="space-y-2">
                  {sessionLogs.map((log) => {
                    const exs = parseExercisesJson((log as any).exercisesJson as string | null);
                    return (
                      <button
                        key={log.id}
                        className="w-full rounded-lg bg-accent/20 border border-border px-3 py-2.5 text-left hover:border-primary/40 transition-colors"
                        onClick={() => openViewLog(log, exs)}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 flex-wrap min-w-0">
                            <span className="text-xs font-semibold text-primary">{fmtDate(log.sessionDate, "yyyy.MM.dd (EEE)")}</span>
                            {(log as any).bodyPart && (log as any).bodyPart.split(",").filter(Boolean).map((bp: string) => (
                              <span key={bp} className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/20 text-primary">{bp}</span>
                            ))}
                            {log.packageId && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-500/20 text-green-400">PT세션</span>
                            )}
                          </div>
                          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        </div>
                        {(log as any).goal && (
                          <p className="text-[11px] text-muted-foreground mt-1 truncate">{(log as any).goal}</p>
                        )}
                        {exs.length > 0 && (
                          <p className="text-[10px] text-muted-foreground/60 mt-0.5 truncate">
                            {exs.map(e => e.name).filter(Boolean).join(" · ")}
                          </p>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── 메모 서브탭 ── */}
          {trainingSubTab === "memo" && (
            <div className="space-y-3">
              <div className="flex gap-2">
                <Input
                  placeholder="메모 검색..."
                  value={memoSearch}
                  onChange={e => setMemoSearch(e.target.value)}
                  className="h-9 text-sm flex-1"
                />
                <Dialog open={memoOpen} onOpenChange={setMemoOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="gap-1.5 text-xs shrink-0">
                      <Plus className="h-3.5 w-3.5" />
                      작성
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-sm">
                    <DialogHeader>
                      <DialogTitle>메모 작성</DialogTitle>
                      <DialogDescription>{member.name}님의 메모를 작성합니다.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs">날짜</Label>
                        <Input type="date" value={memoForm.memoDate} onChange={e => setMemoForm(p => ({ ...p, memoDate: e.target.value }))} className="h-9 text-sm" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">내용</Label>
                        <Textarea value={memoForm.content} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setMemoForm(p => ({ ...p, content: e.target.value }))} placeholder="내용을 입력하세요." rows={5} className="text-sm resize-none" />
                      </div>
                      <div className="flex gap-2 pt-1">
                        <Button variant="outline" className="flex-1" onClick={() => setMemoOpen(false)}>취소</Button>
                        <Button className="flex-1" disabled={!memoForm.content.trim() || createMemoMutation.isPending}
                          onClick={() => createMemoMutation.mutate({ memberId, memoDate: memoForm.memoDate, content: memoForm.content })}>
                          {createMemoMutation.isPending ? "저장 중..." : "저장"}
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>

              {(() => {
                const filtered = (memoList ?? []).filter(m =>
                  !memoSearch.trim() || m.content.toLowerCase().includes(memoSearch.toLowerCase())
                );
                if (!filtered.length) return (
                  <p className="text-muted-foreground text-sm text-center py-8">
                    {memoSearch ? "검색 결과가 없습니다." : "메모가 없습니다."}
                  </p>
                );
                return (
                  <div className="space-y-3">
                    {filtered.map((memo) => (
                      <div key={memo.id} className="p-3 rounded-lg bg-accent/20 border border-border">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs font-medium text-primary">{fmtDate(memo.memoDate, "yyyy.MM.dd (EEE)")}</p>
                          <div className="flex items-center gap-2">
                            <button onClick={() => { setEditMemoForm({ id: memo.id, memoDate: memo.memoDate, content: memo.content }); setEditMemoOpen(true); }} className="text-muted-foreground hover:text-primary transition-colors">
                              <Edit className="h-3.5 w-3.5" />
                            </button>
                            <button onClick={() => deleteMemoMutation.mutate({ id: memo.id })} className="text-muted-foreground hover:text-red-400 transition-colors">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                        <p className="text-sm text-foreground whitespace-pre-wrap">{memo.content}</p>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          )}
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
            disabled={checkedInToday}
            onClick={() => {
              if (!checkedInToday) setLocation(`/attendance/${memberId}?date=${todayStr}`);
            }}
          >
            <CheckCircle className="h-4 w-4" />
            {checkedInToday ? "오늘 출석 완료 ✓" : (
              <span className="flex items-center gap-1.5">
                오늘 출석 체크
                {pointLabel(autoPoints("attendance_check")) && (
                  <span className="text-xs text-green-400 font-normal">{pointLabel(autoPoints("attendance_check"))}</span>
                )}
              </span>
            )}
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

      {/* PT 패키지 수정 다이얼로그 */}
      <Dialog open={editPkgOpen} onOpenChange={setEditPkgOpen}>
        <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>PT 패키지 수정</DialogTitle>
            <DialogDescription>패키지 정보를 수정합니다.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">PT 프로그램</Label>
              <Input value={editPkgForm.packageName} onChange={e => setEditPkgForm(p => ({ ...p, packageName: e.target.value }))} placeholder="피티" className="h-9 text-sm" />
              <div className="flex gap-1.5 flex-wrap">
                {["피티", "필라테스", "이벤트 세션"].map(preset => (
                  <button key={preset} type="button"
                    onClick={() => setEditPkgForm(p => ({ ...p, packageName: p.packageName === preset ? "" : preset }))}
                    className={`px-2.5 py-0.5 rounded-full text-xs border transition-colors ${editPkgForm.packageName === preset ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-primary/40"}`}>
                    {preset}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">총 횟수</Label>
                <Input type="number" min="1" value={editPkgForm.totalSessions} onChange={e => setEditPkgForm(p => ({ ...p, totalSessions: e.target.value }))} className="h-9 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">사용 횟수</Label>
                <Input type="number" min="0" value={editPkgForm.usedSessions} onChange={e => setEditPkgForm(p => ({ ...p, usedSessions: e.target.value }))} className="h-9 text-sm" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">시작일</Label>
                <Input type="date" value={editPkgForm.startDate} onChange={e => setEditPkgForm(p => ({ ...p, startDate: e.target.value }))} className="h-9 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">만료일</Label>
                <Input type="date" value={editPkgForm.expiryDate} onChange={e => setEditPkgForm(p => ({ ...p, expiryDate: e.target.value }))} className="h-9 text-sm" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">결제 금액</Label>
                <Input type="number" min="0" placeholder="0" value={editPkgForm.paymentAmount} onChange={e => setEditPkgForm(p => ({ ...p, paymentAmount: e.target.value }))} className="h-9 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">미수금</Label>
                <Input type="number" min="0" placeholder="0" value={editPkgForm.unpaidAmount} onChange={e => setEditPkgForm(p => ({ ...p, unpaidAmount: e.target.value }))} className="h-9 text-sm" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">결제방법</Label>
              <Select value={editPkgForm.paymentMethod || "__none"} onValueChange={v => setEditPkgForm(p => ({ ...p, paymentMethod: v === "__none" ? "" : v as any }))}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="선택" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">선택 안함</SelectItem>
                  <SelectItem value="현금영수증">현금영수증</SelectItem>
                  <SelectItem value="이체">이체</SelectItem>
                  <SelectItem value="지역화폐">지역화폐</SelectItem>
                  <SelectItem value="카드">카드</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">결제일자</Label>
              <Input type="date" value={editPkgForm.paymentDate} onChange={e => setEditPkgForm(p => ({ ...p, paymentDate: e.target.value }))} className="h-9 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">결제 메모</Label>
              <Input placeholder="분납 등 메모" value={editPkgForm.paymentMemo} onChange={e => setEditPkgForm(p => ({ ...p, paymentMemo: e.target.value }))} className="h-9 text-sm" />
            </div>
            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => setEditPkgOpen(false)}>취소</Button>
              <Button
                className="flex-1"
                disabled={!editPkgForm.totalSessions || updatePackageMutation.isPending}
                onClick={() => updatePackageMutation.mutate({
                  packageId: editPkgForm.packageId,
                  packageName: editPkgForm.packageName || undefined,
                  totalSessions: editPkgForm.totalSessions ? parseInt(editPkgForm.totalSessions) : undefined,
                  usedSessions: editPkgForm.usedSessions !== "" ? parseInt(editPkgForm.usedSessions) : undefined,
                  startDate: editPkgForm.startDate || undefined,
                  expiryDate: editPkgForm.expiryDate || undefined,
                  paymentAmount: editPkgForm.paymentAmount ? parseInt(editPkgForm.paymentAmount) : undefined,
                  unpaidAmount: editPkgForm.unpaidAmount !== "" ? parseInt(editPkgForm.unpaidAmount) : undefined,
                  paymentMethod: editPkgForm.paymentMethod || undefined,
                  paymentDate: editPkgForm.paymentDate || undefined,
                  paymentMemo: editPkgForm.paymentMemo || undefined,
                })}
              >
                {updatePackageMutation.isPending ? "저장 중..." : "저장"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

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

      {/* 트레이닝 일지 작성 다이얼로그 */}
      <Dialog open={journalOpen} onOpenChange={setJournalOpen}>
        <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>트레이닝 일지 작성</DialogTitle>
            <DialogDescription>{member?.name}님의 트레이닝 기록을 작성합니다.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">날짜</Label>
              <Input type="date" value={journalForm.sessionDate} onChange={e => setJournalForm(p => ({ ...p, sessionDate: e.target.value }))} className="h-9 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">운동 부위 (최대 3개)</Label>
              <BodyPartPicker value={journalForm.bodyPart} onChange={v => setJournalForm(p => ({ ...p, bodyPart: v }))} />
            </div>
            <div className="space-y-1.5">
              <TemplateLoader onLoad={exs => setJournalForm(p => ({ ...p, exercises: exs }))} />
              <Label className="text-xs">운동 종목</Label>
              <div className="space-y-1.5">
                {journalForm.exercises.map((ex, i) => (
                  <div key={i} className="flex items-center gap-2 bg-muted/30 border border-border rounded-lg px-3 py-2">
                    <span className="text-muted-foreground text-xs select-none">⠿⠿</span>
                    <input
                      value={ex.name}
                      onChange={e => setJournalForm(p => ({ ...p, exercises: p.exercises.map((x, j) => j === i ? { ...x, name: e.target.value } : x) }))}
                      placeholder="운동명 (예: 스쿼트)"
                      className="flex-1 bg-transparent text-sm outline-none text-foreground placeholder:text-muted-foreground"
                    />
                    <button onClick={() => setJournalForm(p => ({ ...p, exercises: p.exercises.filter((_, j) => j !== i) }))}
                      className="text-muted-foreground hover:text-red-400 transition-colors">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => setJournalForm(p => ({ ...p, exercises: [...p.exercises, { name: "", sets: [] }] }))}
                  className="w-full py-2 border border-dashed border-primary/40 rounded-lg text-xs text-primary hover:bg-primary/5 transition-colors"
                >
                  + 운동 종목 추가
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">메모 (선택)</Label>
              <Textarea value={journalForm.notes} onChange={e => setJournalForm(p => ({ ...p, notes: e.target.value }))} placeholder="특이사항..." rows={2} className="text-sm resize-none" />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setJournalOpen(false)}>취소</Button>
              <Button className="flex-1" disabled={createLogMutation.isPending}
                onClick={() => createLogMutation.mutate({
                  memberId,
                  sessionDate: journalForm.sessionDate,
                  goal: journalForm.goal || undefined,
                  bodyPart: journalForm.bodyPart || undefined,
                  exercisesJson: journalForm.exercises.length > 0 ? JSON.stringify(journalForm.exercises) : undefined,
                  feedback: journalForm.feedback || undefined,
                  notes: journalForm.notes || undefined,
                })}>
                {createLogMutation.isPending ? "저장 중..." : (
                  <span className="flex items-center gap-1.5">
                    저장
                    {pointLabel(autoPoints("session_log")) && (
                      <span className="text-xs text-green-400 font-normal">{pointLabel(autoPoints("session_log"))}</span>
                    )}
                  </span>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 트레이닝 일지 수정 다이얼로그 */}
      <Dialog open={editJournalOpen} onOpenChange={setEditJournalOpen}>
        <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>트레이닝 일지 수정</DialogTitle>
            <DialogDescription>{editJournalForm.sessionDate ? fmtDate(editJournalForm.sessionDate, "yyyy.MM.dd (EEE)") : ""}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">날짜</Label>
              <Input type="date" value={editJournalForm.sessionDate} onChange={e => setEditJournalForm(p => ({ ...p, sessionDate: e.target.value }))} className="h-9 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">운동 부위 (최대 3개)</Label>
              <BodyPartPicker value={editJournalForm.bodyPart} onChange={v => setEditJournalForm(p => ({ ...p, bodyPart: v }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">운동 종목</Label>
              <ExerciseEditor exercises={editJournalForm.exercises} onChange={exs => setEditJournalForm(p => ({ ...p, exercises: exs }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">메모 (선택)</Label>
              <Textarea value={editJournalForm.notes} onChange={e => setEditJournalForm(p => ({ ...p, notes: e.target.value }))} placeholder="특이사항..." rows={2} className="text-sm resize-none" />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setEditJournalOpen(false)}>취소</Button>
              <Button className="flex-1" disabled={updateLogMutation.isPending}
                onClick={() => updateLogMutation.mutate({
                  id: editJournalForm.id,
                  sessionDate: editJournalForm.sessionDate || undefined,
                  goal: editJournalForm.goal || undefined,
                  bodyPart: editJournalForm.bodyPart || undefined,
                  exercisesJson: editJournalForm.exercises.length > 0 ? JSON.stringify(editJournalForm.exercises) : undefined,
                  feedback: editJournalForm.feedback || undefined,
                  notes: editJournalForm.notes || undefined,
                })}>
                {updateLogMutation.isPending ? "저장 중..." : "저장"}
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
              <label className="text-xs font-medium text-muted-foreground">운동 부위 (최대 3개)</label>
              <BodyPartPicker value={sessionForm.bodyPart} onChange={v => setSessionForm(p => ({ ...p, bodyPart: v }))} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">운동 종목</label>
              <ExerciseEditor
                exercises={sessionForm.exercises}
                onChange={exs => setSessionForm(p => ({ ...p, exercises: exs }))}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">오늘의 목표</label>
              <Input value={sessionForm.goal} onChange={e => setSessionForm(p => ({ ...p, goal: e.target.value }))} placeholder="오늘 수업 목표..." className="h-9 text-sm" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">피드백</label>
              <Textarea value={sessionForm.feedback} onChange={e => setSessionForm(p => ({ ...p, feedback: e.target.value }))} placeholder="수업 후 피드백, 개선점 등..." rows={2} className="text-sm resize-none" />
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
                    goal: sessionForm.goal || undefined,
                    feedback: sessionForm.feedback || undefined,
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

      {/* ── 트레이닝 기록 상세 모달 (체크박스) ── */}
      <Dialog open={viewLogOpen} onOpenChange={setViewLogOpen}>
        <DialogContent className="max-w-sm max-h-[85vh] overflow-y-auto p-0">
          {viewLogData && (
            <>
              <div className="sticky top-0 bg-card z-10 px-5 pt-5 pb-3 border-b border-border">
                <DialogTitle className="text-base font-bold flex items-center gap-2">
                  <span className="text-primary text-lg">🏋️</span> 트레이닝 기록
                </DialogTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {fmtDate(viewLogData.log.sessionDate, "yyyy.MM.dd (EEE)")}
                  {viewLogData.log.bodyPart && ` · ${viewLogData.log.bodyPart}`}
                </p>
              </div>

              <div className="px-4 py-4 space-y-3">
                {viewLogData.exs.map((ex, exIdx) => (
                  <div key={exIdx} className="bg-muted/30 border border-border rounded-xl p-3 space-y-2">
                    {/* 운동명 */}
                    <div className="flex items-center justify-between gap-2">
                      <input
                        value={ex.name}
                        onChange={e => updateViewExName(exIdx, e.target.value)}
                        placeholder="운동명"
                        className="font-bold text-sm text-primary bg-transparent border-none outline-none flex-1 min-w-0"
                      />
                      <button onClick={() => removeViewExercise(exIdx)} className="text-muted-foreground hover:text-red-400 transition-colors shrink-0">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    {/* 세트 목록 */}
                    <div className="space-y-1.5">
                      <div className="grid grid-cols-[20px_28px_1fr_1fr_20px] gap-1.5 text-[10px] text-muted-foreground px-0.5">
                        <span />
                        <span className="text-center">#</span>
                        <span>세트 횟수</span>
                        <span>무게(kg)</span>
                        <span />
                      </div>
                      {ex.sets.map((s, setIdx) => {
                        const key = `${exIdx}-${setIdx}`;
                        const checked = !!checkedSets[key];
                        return (
                          <div key={setIdx} className={`grid grid-cols-[20px_28px_1fr_1fr_20px] gap-1.5 items-center transition-opacity ${checked ? "opacity-40" : ""}`}>
                            <button
                              onClick={() => toggleSetCheck(exIdx, setIdx)}
                              className={`w-4.5 h-4.5 rounded border-2 flex items-center justify-center transition-colors ${checked ? "bg-primary border-primary" : "border-border"}`}
                            >
                              {checked && <span className="text-primary-foreground text-[9px] font-bold">✓</span>}
                            </button>
                            <span className="text-[11px] text-muted-foreground text-center">{setIdx + 1}</span>
                            <input
                              type="number"
                              value={s.reps}
                              onChange={e => updateViewSet(exIdx, setIdx, "reps", e.target.value)}
                              placeholder="횟수"
                              className={`bg-card border border-border rounded-lg px-2 py-1.5 text-sm text-center w-full outline-none focus:border-primary/50 ${checked ? "line-through text-muted-foreground" : ""}`}
                            />
                            <input
                              type="number"
                              value={s.weight}
                              onChange={e => updateViewSet(exIdx, setIdx, "weight", e.target.value)}
                              placeholder="kg"
                              className="bg-card border border-border rounded-lg px-2 py-1.5 text-sm text-center w-full outline-none focus:border-primary/50 text-muted-foreground"
                            />
                            <button onClick={() => removeViewSet(exIdx, setIdx)} className="text-muted-foreground hover:text-red-400 transition-colors">
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        );
                      })}
                    </div>

                    {/* 세트 추가 / 운동 삽입 */}
                    <div className="flex gap-3 pt-1">
                      <button onClick={() => addViewSet(exIdx)} className="text-xs text-primary hover:text-primary/80 transition-colors">+ 세트 추가</button>
                      <span className="text-border">|</span>
                      <button onClick={() => addViewExercise(exIdx)} className="text-xs text-primary hover:text-primary/80 transition-colors">+ 운동 삽입</button>
                    </div>
                  </div>
                ))}

                {/* 운동 추가 */}
                <button
                  onClick={() => addViewExercise()}
                  className="w-full py-2.5 rounded-xl border border-dashed border-primary/40 text-primary text-xs hover:bg-primary/5 transition-colors"
                >
                  + 운동 추가
                </button>

                {/* 하단 버튼 바 */}
                <div className="flex items-center gap-2 pt-1 border-t border-border/40">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-xs text-blue-400 hover:text-blue-400 hover:bg-blue-500/10 border-blue-500/30"
                    disabled={sendToMemberMutation.isPending}
                    onClick={() => sendToMemberMutation.mutate({ sessionLogId: viewLogData.log.id }, {
                      onSuccess: () => toast.success("회원에게 전송되었습니다."),
                      onError: (err) => toast.error(err.message || "전송 실패"),
                    })}
                  >
                    <Send className="h-3.5 w-3.5" />
                    회원 전송
                  </Button>
                  <div className="flex-1" />
                  <button
                    onClick={() => {
                      setEditJournalForm({
                        id: viewLogData.log.id,
                        sessionDate: viewLogData.log.sessionDate,
                        goal: viewLogData.log.goal ?? "",
                        bodyPart: viewLogData.log.bodyPart ?? "",
                        exercises: viewLogData.exs,
                        feedback: viewLogData.log.feedback ?? "",
                        notes: viewLogData.log.notes ?? "",
                      });
                      setViewLogOpen(false);
                      setEditJournalOpen(true);
                    }}
                    className="p-2 text-muted-foreground hover:text-primary transition-colors"
                  >
                    <Edit className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => { if (confirm("삭제하시겠습니까?")) { deleteLogMutation.mutate({ id: viewLogData.log.id }); setViewLogOpen(false); } }}
                    className="p-2 text-muted-foreground hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                  <Button
                    size="sm"
                    className="text-xs"
                    disabled={updateLogMutation.isPending}
                    onClick={() => {
                      updateLogMutation.mutate({
                        id: viewLogData.log.id,
                        exercisesJson: JSON.stringify(viewLogData.exs),
                      }, { onSuccess: () => setViewLogOpen(false) });
                    }}
                  >
                    {updateLogMutation.isPending ? "저장 중..." : "저장"}
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* 건강 리포트 공유 포인트 확인 */}
      <PointSpendConfirm
        open={reportPointConfirm}
        onClose={() => setReportPointConfirm(false)}
        featureName="건강 리포트 공유"
        loading={spendFeatureMutation.isPending || generateReportMutation.isPending}
        onConfirm={() => {
          spendFeatureMutation.mutate({ feature: "health_report" }, {
            onSuccess: () => {
              setReportPointConfirm(false);
              generateReportMutation.mutate({ memberId });
            },
            onError: (e) => toast.error(e.message),
          });
        }}
      />
    </div>
  );
}
