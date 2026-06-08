import { useState, useMemo, useRef } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { MEMBER_STATUS, SERVICE_COLORS, PT_STATUS, ATTENDANCE_STATUS, STAFF_LABELS, STATUS_COLORS } from "@/lib/memberServices";
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
import {
  ArrowLeft,
  Crown,
  Activity,
  FileHeart,
  Sparkles,
  Loader2,
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
  CheckCheck,
  ArrowRightLeft,
} from "lucide-react";
import { TransferModal, type MemberBasic } from "./TransferModal";

const ISSUE_ITEMS: Record<string, string[]> = {
  diet: [
    "하루 식사 시간이 일정하지 않거나 끼니를 자주 거른다.",
    "하루 단백질 섭취량이 부족하거나 식단 구성이 한쪽으로 치우친다.",
    "스트레스나 감정 변화로 인해 폭식 또는 과식을 경험한다.",
    "저녁 9시 이후 야식 또는 고칼로리 간식을 자주 섭취한다.",
  ],
  alcohol: [
    "주 3회 이상 음주하거나 1회 음주량이 평균 3잔 이상이다.",
    "한 번 술을 마시면 마무리가 잘 안 되어 과음하는 경우가 있다.",
    "스트레스 해소를 술에 의존하는 편이다.",
    "회식·약속 등으로 인해 운동 다음 날 컨디션이 떨어지는 경우가 잦다.",
  ],
  sleep: [
    "밤에 자주 깨거나(2회 이상) 수면 중단이 반복된다.",
    "아침에 일어나도 개운하지 않고 지속적으로 피곤하다.",
    "잠드는 데 30분 이상 걸리거나 누워도 쉽게 잠들지 못한다.",
    "수면 시간이 일정하지 않거나 6시간 미만으로 자는 날이 많다.",
  ],
  activity: [
    "하루 활동량(걸음 수)이 5,000보 미만인 날이 많다.",
    "하루 중 앉아 있는 시간이 6시간 이상으로 길다.",
    "주 2회 이상 규칙적인 운동(근력 또는 유산소)을 하지 않는다.",
    "계단 오르기 / 짧은 거리 이동 등 기본 활동에서도 숨이 차거나 피로를 느낀다.",
  ],
};

function expandIssues(raw: string, type: keyof typeof ISSUE_ITEMS): { letter: string; text: string }[] {
  if (!raw) return [];
  const letters = ["A", "B", "C", "D"];
  const items = ISSUE_ITEMS[type];
  return raw.split(",").filter(Boolean).map(l => {
    const letter = l.trim().toUpperCase();
    const idx = letters.indexOf(letter);
    return { letter, text: idx >= 0 ? items[idx] : l };
  });
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

function getMilestones(total: number): number[] {
  if (total <= 10) return [7];
  const ms: number[] = [];
  for (let m = 15; m < total; m += 10) ms.push(m);
  return ms;
}

function PTReportButtons({ packageId, memberId, totalSessions, usedSessions }: {
  packageId: number;
  memberId: number;
  totalSessions: number;
  usedSessions: number;
}) {
  const { data: existingReports = [], refetch } = trpc.gym.ai.getPTReports.useQuery({ packageId });
  const genMutation = trpc.gym.ai.generatePTProgressReport.useMutation({
    onSuccess: (data) => {
      refetch();
      toast.success("PT 변화 리포트가 생성되었습니다!");
      window.open(data.reportUrl, "_blank");
    },
    onError: (err: any) => toast.error(err.message || "리포트 생성 실패"),
  });

  const milestones = getMilestones(totalSessions);
  if (milestones.length === 0) return null;

  return (
    <div className="mt-3 pt-3 border-t border-border/50">
      <p className="text-xs text-muted-foreground font-semibold mb-2">📊 PT 변화 리포트</p>
      <div className="flex flex-wrap gap-1.5">
        {milestones.map((milestoneSession, idx) => {
          const reportIndex = idx + 1;
          const fromSession = idx === 0 ? 1 : milestones[idx - 1] + 1;
          const existing = existingReports.find((r: any) => r.reportIndex === reportIndex);
          const reached = usedSessions >= milestoneSession;
          const isPending = genMutation.isPending && (genMutation.variables as any)?.reportIndex === reportIndex;

          if (existing) {
            return (
              <button
                key={reportIndex}
                onClick={() => window.open(`/api/pt-report/${existing.token}`, "_blank")}
                className="px-3 py-1 text-xs rounded-full border border-green-500/40 text-green-400 bg-green-500/10 hover:bg-green-500/20 transition-colors flex items-center gap-1"
              >
                <Check className="h-3 w-3" />보고서 {reportIndex}
              </button>
            );
          }

          if (!reached) {
            return (
              <button
                key={reportIndex}
                disabled
                className="px-3 py-1 text-xs rounded-full border border-border text-muted-foreground opacity-50 cursor-not-allowed"
                title={`${milestoneSession}회 달성 후 생성 가능`}
              >
                보고서 {reportIndex} ({milestoneSession}회)
              </button>
            );
          }

          return (
            <button
              key={reportIndex}
              disabled={isPending}
              onClick={() => genMutation.mutate({ packageId, memberId, milestoneSession, fromSession, reportIndex })}
              className="px-3 py-1 text-xs rounded-full border border-primary/40 text-primary bg-primary/10 hover:bg-primary/20 transition-colors flex items-center gap-1"
            >
              {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
              보고서 {reportIndex}
            </button>
          );
        })}
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
  const [transferOpen, setTransferOpen] = useState(false);
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
    isDraft: false,
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
    isDraft: false,
  });

  // 건강보고서
  const [healthReport, setHealthReport] = useState<{ report: string; isAI: boolean; stats: any; reportUrl?: string } | null>(null);
  const healthReportMutation = trpc.gym.ai.generateMemberReport.useMutation({
    onSuccess: (data) => setHealthReport(data),
    onError: (err: any) => toast.error(err.message || "보고서 생성 실패"),
  });

  // 메모 검색
  const [memoSearch, setMemoSearch] = useState("");

  // 라이브 트레이닝 모달
  const [liveTrainingOpen, setLiveTrainingOpen] = useState(false);
  const [liveLog, setLiveLog] = useState<any>(null);
  const [liveExercises, setLiveExercises] = useState<Exercise[]>([]);
  // "exIdx-setIdx" 형식으로 완료된 세트 추적
  const [checkedSets, setCheckedSets] = useState<Set<string>>(new Set());
  const [memberMemoEdit, setMemberMemoEdit] = useState(false);
  const [memberMemoText, setMemberMemoText] = useState("");

  // 환불 계약서 모달
  const [refundModalOpen, setRefundModalOpen] = useState(false);
  const [refundSelectedPkgId, setRefundSelectedPkgId] = useState<number | "">("");
  const [refundContractUrl, setRefundContractUrl] = useState("");
  const [refundForm, setRefundForm] = useState({
    paymentMethod: "" as "" | "카드" | "현금" | "계좌이체",
    taxAmount: "0",
    penaltyAmount: "0",
    refundAmount: "0",
    reason: "",
  });

  // 양도 계약서 모달
  const [yangdoModalOpen, setYangdoModalOpen] = useState(false);
  const [yangdoSelectedPkgId, setYangdoSelectedPkgId] = useState<number | "">("");
  const [yangdoForm, setYangdoForm] = useState({
    transferDate: "",
    trainerMemo: "",
  });
  const [yangdoContractUrl, setYangdoContractUrl] = useState("");

  function openLiveTraining(log: any) {
    const exs = parseExercisesJson((log as any).exercisesJson as string | null);
    setLiveLog(log);
    setLiveExercises(exs);
    setCheckedSets(new Set());
    setLiveTrainingOpen(true);
  }

  function toggleSetCheck(exIdx: number, setIdx: number) {
    const key = `${exIdx}-${setIdx}`;
    setCheckedSets((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  function insertExerciseAfter(afterIdx: number) {
    setLiveExercises((prev) => {
      const next = [...prev];
      next.splice(afterIdx + 1, 0, { name: "", sets: [{ reps: "", weight: "" }] });
      return next;
    });
  }

  const { data: currentUser } = trpc.auth.me.useQuery();
  const { data: member, isLoading } = trpc.members.getById.useQuery({ id: memberId });
  const { data: allMembers } = trpc.members.list.useQuery(undefined, { enabled: true });
  const { data: ptPackages, refetch: refetchPt } = trpc.pt.listByMember.useQuery({ memberId });
  const { data: payments } = trpc.members.getPayments.useQuery({ memberId });
  const { data: attendanceList, refetch: refetchAttendance } =
    trpc.attendances.listByMember.useQuery({ memberId });
  const { data: trainers } = trpc.trainers.list.useQuery();
  const { data: memoList, refetch: refetchMemos } = trpc.workoutMemos.listByMember.useQuery({ memberId });
  const { data: sessionLogs } = trpc.pt.sessionLogs.useQuery({ memberId });
  const { data: conditionChecks } = trpc.attendanceChecks.listByMember.useQuery({ memberId });

  // 이 회원의 과거 운동명 목록 (자동완성용)
  const exerciseSuggestions = useMemo(() => {
    if (!sessionLogs) return [];
    const names = new Set<string>();
    sessionLogs.forEach((log: any) => {
      parseExercisesJson(log.exercisesJson).forEach((ex) => {
        if (ex.name.trim()) names.add(ex.name.trim());
      });
    });
    return Array.from(names);
  }, [sessionLogs]);
  const { data: stats } = trpc.members.getStats.useQuery({ memberId });
  const { data: pauses, refetch: refetchPauses } = trpc.pt.listPauses.useQuery({ memberId });
  const { data: leadInfo } = trpc.gym.leads.getByMemberId.useQuery({ memberId });
  const { data: parQData } = trpc.parQ.get.useQuery({ memberId });
  const { data: memberPrograms } = trpc.access.getMemberPrograms.useQuery({ memberId });

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
      setJournalForm({ sessionDate: new Date().toISOString().split("T")[0], goal: "", bodyPart: "", exercises: [], feedback: "", notes: "", isDraft: false });
      utils.pt.sessionLogs.invalidate({ memberId });
    },
    onError: (err) => toast.error(err.message || "저장 실패"),
  });

  const updateLogMutation = trpc.pt.updateLog.useMutation({
    onSuccess: () => {
      toast.success("일지가 수정되었습니다.");
      setEditJournalOpen(false);
      setLiveTrainingOpen(false);
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

  const shareLogMutation = trpc.pt.shareLog.useMutation({
    onSuccess: (data, vars) => {
      if (vars.share) {
        if (data.gymPlusSynced) {
          toast.success("짐플러스 앱에 전송되었습니다.");
        } else {
          toast.warning(`전송 플래그는 저장됐지만 짐플러스 연동 실패: ${data.gymPlusSyncError ?? "알 수 없는 오류"}`);
        }
      } else {
        toast.success("전송이 취소되었습니다.");
      }
      utils.pt.sessionLogs.invalidate({ memberId });
      setLiveLog((prev: any) => prev ? { ...prev, sharedToMember: vars.share ? 1 : 0 } : prev);
    },
    onError: (err) => toast.error(err.message || "전송 실패"),
  });

  // PT 세션 사용 (완료 후 메모 입력 유도)
  const sessionSubmittingRef = useRef(false);
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
    onSettled: () => { sessionSubmittingRef.current = false; },
  });

  // 회원 상태 변경 (활성 ↔ 정지)
  const toggleStatusMutation = trpc.members.update.useMutation({
    onSuccess: () => {
      toast.success("상태가 변경되었습니다.");
      utils.members.getById.invalidate({ id: memberId });
    },
    onError: (err) => toast.error(err.message || "변경 실패"),
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

  const saveNoteMutation = trpc.members.update.useMutation({
    onSuccess: () => {
      toast.success("메모가 저장되었습니다.");
      setMemberMemoEdit(false);
      utils.members.getById.invalidate({ id: memberId });
    },
    onError: (err) => toast.error(err.message || "저장 실패"),
  });

  // 헬스권 삭제 (membershipStart/End 클리어)
  const clearHealthMutation = trpc.members.update.useMutation({
    onSuccess: () => {
      toast.success("헬스권이 삭제되었습니다.");
      utils.members.getById.invalidate({ id: memberId });
      utils.access.getMemberPrograms.invalidate({ memberId });
    },
    onError: (err) => toast.error(err.message || "삭제 실패"),
  });

  const createRefundContractMutation = trpc.gym.createRefundContract.useMutation({
    onSuccess: (data) => {
      setRefundContractUrl(window.location.origin + data.contractUrl);
    },
    onError: (e) => toast.error(e.message || "계약서 생성 실패"),
  });

  const createYangdoContractMutation = trpc.transfer.createTransfer.useMutation({
    onSuccess: (data) => {
      setYangdoContractUrl(window.location.origin + data.contractUrl);
    },
    onError: (e) => toast.error(e.message || "계약서 생성 실패"),
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

  const deletePackageMutation = trpc.pt.deletePackage.useMutation({
    onSuccess: () => { toast.success("프로그램이 삭제되었습니다."); refetchPt(); },
    onError: (err) => toast.error(err.message || "삭제 실패"),
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

  // 만나이 계산
  const koreanAge = useMemo(() => {
    if (!member?.birthDate) return "";
    const birth = new Date(member.birthDate);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return `만 ${age}세`;
  }, [member?.birthDate]);

  // 최초 등록일: createdAt → 없으면 가장 이른 PT 패키지 startDate
  const firstRegistrationDate = useMemo(() => {
    if (member?.createdAt) return fmtDate(member.createdAt, "yyyy.MM.dd");
    const dates = (ptPackages ?? []).map(p => p.startDate).filter(Boolean).sort() as string[];
    return dates[0] ? fmtDate(dates[0], "yyyy.MM.dd") : "-";
  }, [member?.createdAt, ptPackages]);

  // 운동 만료일: 운동시작일 + (totalSessions / 2)주
  const exerciseEndDate = useMemo(() => {
    const startStr = member?.membershipStart;
    if (!startStr) return "-";
    const totalSessions = (ptPackages ?? []).reduce((sum, p) => sum + (p.totalSessions ?? 0), 0);
    if (!totalSessions) return "-";
    const weeks = Math.round(totalSessions / 2);
    const d = new Date(startStr);
    d.setDate(d.getDate() + weeks * 7);
    return fmtDate(d.toISOString(), "yyyy.MM.dd");
  }, [member?.membershipStart, ptPackages]);

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
            disabled={healthReportMutation.isPending}
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
        <div className="overflow-x-auto scrollbar-none -mx-4 px-4">
          <TabsList className="flex w-max min-w-full">
            <TabsTrigger value="info" className="text-xs px-4 whitespace-nowrap flex-1 min-w-[72px]">기본정보</TabsTrigger>
            <TabsTrigger value="pt" className="text-xs px-4 whitespace-nowrap flex-1 min-w-[72px]">프로그램</TabsTrigger>
            <TabsTrigger value="stats" className="text-xs px-4 whitespace-nowrap flex-1 min-w-[60px]">통계</TabsTrigger>
            <TabsTrigger value="training" className="text-xs px-4 whitespace-nowrap flex-1 min-w-[80px]">트레이닝</TabsTrigger>
            <TabsTrigger value="attendance" className="text-xs px-4 whitespace-nowrap flex-1 min-w-[60px]">출석</TabsTrigger>
          </TabsList>
        </div>

        {/* ── 기본 정보 탭 ── */}
        <TabsContent value="info" className="mt-4 space-y-3">
          {/* PAR-Q 사전건강검사 인라인 표시 */}
          <Card className="bg-card border-border">
            <CardHeader className={`px-4 pt-4 flex flex-row items-center justify-between ${parQData ? "pb-2" : "pb-4"}`}>
              <CardTitle className="text-sm font-semibold text-foreground">PAR-Q 사전건강검사</CardTitle>
              <Button
                size="sm"
                variant="ghost"
                className="text-xs text-primary hover:bg-primary/10 h-7 px-2"
                onClick={() => setLocation(`/members/${memberId}/parq`)}
              >
                {parQData ? "수정" : "입력하기"}
              </Button>
            </CardHeader>
            {parQData && <CardContent className="px-4 pb-4">
              {true && (
                <div className="space-y-3 text-sm">
                  {/* 신체 측정 */}
                  {[parQData.height, parQData.weight, parQData.muscleMass, parQData.bodyFatPercent, parQData.bodyFatKg, parQData.waistCircumference].some(Boolean) && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1.5">신체 측정</p>
                      <div className="grid grid-cols-3 gap-1.5">
                        {[
                          { label: "신장", value: parQData.height, unit: "cm" },
                          { label: "체중", value: parQData.weight, unit: "kg" },
                          { label: "근육량", value: parQData.muscleMass, unit: "kg" },
                          { label: "체지방률", value: parQData.bodyFatPercent, unit: "%" },
                          { label: "체지방량", value: parQData.bodyFatKg, unit: "kg" },
                          { label: "허리둘레", value: parQData.waistCircumference, unit: "cm" },
                        ].map(({ label, value, unit }) => (
                          <div key={label} className="bg-accent/30 rounded-md px-2 py-1.5">
                            <p className="text-xs text-muted-foreground">{label}</p>
                            <p className="text-xs font-medium text-foreground">{value ? `${value}${unit}` : "미입력"}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {/* 혈압 */}
                  {(parQData.systolicBp || parQData.diastolicBp) && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1.5">혈압</p>
                      <div className="grid grid-cols-2 gap-1.5">
                        {[
                          { label: "수축기혈압", value: parQData.systolicBp, unit: "mmHg" },
                          { label: "이완기혈압", value: parQData.diastolicBp, unit: "mmHg" },
                        ].map(({ label, value, unit }) => (
                          <div key={label} className="bg-accent/30 rounded-md px-2 py-1.5">
                            <p className="text-xs text-muted-foreground">{label}</p>
                            <p className="text-xs font-medium text-foreground">{value ? `${value}${unit}` : "미입력"}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {/* 혈액 검사 */}
                  {[parQData.totalCholesterol, parQData.hdlCholesterol, parQData.ldlCholesterol, parQData.triglycerides, parQData.fastingBloodSugar, parQData.postMealBloodSugar, parQData.hba1c, parQData.boneDensity].some(Boolean) && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1.5">혈액 검사</p>
                      <div className="grid grid-cols-2 gap-1.5">
                        {[
                          { label: "총콜레스테롤", value: parQData.totalCholesterol, unit: "" },
                          { label: "HDL 콜레스테롤", value: parQData.hdlCholesterol, unit: "" },
                          { label: "LDL 콜레스테롤", value: parQData.ldlCholesterol, unit: "" },
                          { label: "중성지방", value: parQData.triglycerides, unit: "" },
                          { label: "공복혈당", value: parQData.fastingBloodSugar, unit: "" },
                          { label: "식후혈당", value: parQData.postMealBloodSugar, unit: "" },
                          { label: "당화혈색소", value: parQData.hba1c, unit: "%" },
                          { label: "골밀도", value: parQData.boneDensity, unit: "" },
                        ].filter(i => i.value).map(({ label, value, unit }) => (
                          <div key={label} className="bg-accent/30 rounded-md px-2 py-1.5">
                            <p className="text-xs text-muted-foreground">{label}</p>
                            <p className="text-xs font-medium text-foreground">{value}{unit}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {/* 생활 정보 */}
                  {(parQData.occupation || parQData.workEnvironment || parQData.exerciseExperience || parQData.visitRoute) && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1.5">생활 정보</p>
                      <div className="space-y-1">
                        {parQData.occupation && <div className="flex gap-2"><span className="text-xs text-muted-foreground w-16 shrink-0">직업</span><span className="text-xs text-foreground">{parQData.occupation}</span></div>}
                        {parQData.workEnvironment && <div className="flex gap-2"><span className="text-xs text-muted-foreground w-16 shrink-0">근무환경</span><span className="text-xs text-foreground">{parQData.workEnvironment}</span></div>}
                        {parQData.exerciseExperience && <div className="flex gap-2"><span className="text-xs text-muted-foreground w-16 shrink-0">운동경험</span><span className="text-xs text-foreground">{parQData.exerciseExperience}</span></div>}
                        {parQData.visitRoute && <div className="flex gap-2"><span className="text-xs text-muted-foreground w-16 shrink-0">방문경로</span><span className="text-xs text-foreground">{parQData.visitRoute}</span></div>}
                      </div>
                    </div>
                  )}
                  {/* 목표 */}
                  {(parQData.goal1 || parQData.goal2 || parQData.goal3) && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1.5">운동 목표</p>
                      <div className="flex flex-wrap gap-1.5">
                        {[parQData.goal1, parQData.goal2, parQData.goal3].filter(Boolean).map((g, i) => (
                          <span key={i} className="bg-primary/10 text-primary rounded-full px-2.5 py-0.5 text-xs">{g}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {/* 이슈 */}
                  {(parQData.dietIssues || parQData.alcoholIssues || parQData.sleepIssues || parQData.activityIssues) && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-2">생활 이슈</p>
                      <div className="space-y-2.5">
                        {([
                          { key: "diet", label: "식이", raw: parQData.dietIssues },
                          { key: "alcohol", label: "음주", raw: parQData.alcoholIssues },
                          { key: "sleep", label: "수면", raw: parQData.sleepIssues },
                          { key: "activity", label: "활동", raw: parQData.activityIssues },
                        ] as const).map(({ key, label, raw }) => {
                          const items = expandIssues(raw ?? "", key);
                          if (!items.length) return null;
                          return (
                            <div key={key}>
                              <span className="text-xs font-semibold text-muted-foreground">{label}</span>
                              <ul className="mt-1 space-y-1">
                                {items.map(({ letter, text }) => (
                                  <li key={letter} className="text-xs text-foreground flex items-start gap-1.5 pl-1">
                                    <span className="text-primary shrink-0 font-semibold w-4">{letter}.</span>
                                    <span className="leading-relaxed">{text}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {/* 병력 */}
                  {(parQData.chronicDiseases || parQData.musculoskeletalIssues || parQData.posturalIssues) && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1.5">건강 병력</p>
                      <div className="space-y-1">
                        {parQData.chronicDiseases && <div className="flex gap-2"><span className="text-xs text-muted-foreground w-16 shrink-0">만성질환</span><span className="text-xs text-foreground">{parQData.chronicDiseases}</span></div>}
                        {parQData.musculoskeletalIssues && <div className="flex gap-2"><span className="text-xs text-muted-foreground w-16 shrink-0">근골격계</span><span className="text-xs text-foreground">{parQData.musculoskeletalIssues}</span></div>}
                        {parQData.posturalIssues && <div className="flex gap-2"><span className="text-xs text-muted-foreground w-16 shrink-0">자세문제</span><span className="text-xs text-foreground">{parQData.posturalIssues}</span></div>}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>}
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4 sm:p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                <div className="flex items-start gap-3">
                  <div className="text-muted-foreground mt-0.5"><Activity className="h-4 w-4" /></div>
                  <div className="flex-1">
                    <p className="text-xs text-muted-foreground">상태</p>
                    <div className="flex items-center gap-2 flex-wrap mt-0.5">
                      <p className="text-sm font-medium text-foreground">{statusLabels[member.status] ?? "-"}</p>
                      <button
                        onClick={() => toggleStatusMutation.mutate({ id: memberId, status: member.status === "active" ? "paused" : "active" })}
                        disabled={toggleStatusMutation.isPending}
                        className="text-xs px-2 py-0.5 rounded border border-yellow-400/50 text-yellow-400 hover:bg-yellow-400/10 transition-colors disabled:opacity-50"
                      >
                        {member.status === "active" ? "정지" : "활성화"}
                      </button>
                      <button
                        onClick={() => setTransferOpen(true)}
                        className="text-xs px-2 py-0.5 rounded border border-orange-400/50 text-orange-400 hover:bg-orange-400/10 transition-colors flex items-center gap-1"
                      >
                        <ArrowRightLeft className="h-3 w-3" />
                        양도
                      </button>
                    </div>
                  </div>
                </div>
                <InfoRow icon={<Crown className="h-4 w-4" />} label="등급" value={membershipLabels[member.grade] ?? "-"} />
                <div className="flex items-start gap-3">
                  <div className="text-muted-foreground mt-0.5"><Phone className="h-4 w-4" /></div>
                  <div>
                    <p className="text-xs text-muted-foreground">연락처</p>
                    {member.phone ? (
                      <a href={`tel:${member.phone}`} className="text-sm font-medium text-primary underline underline-offset-2">
                        {member.phone}
                      </a>
                    ) : (
                      <p className="text-sm font-medium text-foreground">-</p>
                    )}
                  </div>
                </div>
                <InfoRow
                  icon={<Calendar className="h-4 w-4" />}
                  label="생년월일"
                  value={member.birthDate ? `${fmtDate(member.birthDate, "yyyy.MM.dd")}${koreanAge ? ` (${koreanAge})` : ""}` : "-"}
                />
                <InfoRow
                  icon={<User className="h-4 w-4" />}
                  label="성별"
                  value={member.gender === "male" ? "남성" : member.gender === "female" ? "여성" : "-"}
                />
                <InfoRow
                  icon={<Calendar className="h-4 w-4" />}
                  label="최초 등록일"
                  value={firstRegistrationDate}
                />
                <InfoRow
                  icon={<Calendar className="h-4 w-4" />}
                  label="운동 시작일"
                  value={fmtDate(member.membershipStart, "yyyy.MM.dd")}
                />
                <InfoRow
                  icon={<Calendar className="h-4 w-4" />}
                  label="운동 만료일"
                  value={exerciseEndDate}
                />
                <div className="flex items-start gap-3">
                  <div className="text-muted-foreground mt-0.5"><User className="h-4 w-4" /></div>
                  <div className="flex-1">
                    <p className="text-xs text-muted-foreground">{STAFF_LABELS.trainer}</p>
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
                  value={ptPackages ? `${ptPackages.reduce((sum, p) => sum + (p.paymentAmount ?? 0), 0).toLocaleString()}원` : "-"}
                />
                {(member as any).visitRoute && (
                  <InfoRow icon={<MapPin className="h-4 w-4" />} label="유입경로" value={(member as any).visitRoute} />
                )}
              </div>
              {(leadInfo?.consultationNote || leadInfo?.memo) && (
                <div className="mt-4 space-y-3">
                  {leadInfo.consultationNote && (
                    <div className="p-3 sm:p-4 rounded-lg bg-accent/30 border border-border">
                      <p className="text-xs text-muted-foreground mb-1">상담 내용</p>
                      <p className="text-sm text-foreground whitespace-pre-wrap">{leadInfo.consultationNote}</p>
                    </div>
                  )}
                  {leadInfo.memo && (
                    <div className="p-3 sm:p-4 rounded-lg bg-accent/30 border border-border">
                      <p className="text-xs text-muted-foreground mb-1">등록 진행 내용</p>
                      <p className="text-sm text-foreground whitespace-pre-wrap">{leadInfo.memo}</p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* 메모 — 기본정보 하단 */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-2 px-4 pt-4 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-semibold text-foreground">메모</CardTitle>
              {!memberMemoEdit ? (
                <Button
                  size="sm" variant="ghost"
                  className="text-xs text-primary hover:bg-primary/10 h-7 px-2"
                  onClick={() => { setMemberMemoText(member.profileNote ?? ""); setMemberMemoEdit(true); }}
                >
                  수정
                </Button>
              ) : (
                <div className="flex gap-1.5">
                  <Button size="sm" variant="ghost" className="text-xs h-7 px-2 text-muted-foreground" onClick={() => setMemberMemoEdit(false)}>취소</Button>
                  <Button
                    size="sm" className="text-xs h-7 px-2"
                    disabled={saveNoteMutation.isPending}
                    onClick={() => saveNoteMutation.mutate({ id: memberId, name: member.name, profileNote: memberMemoText })}
                  >
                    저장
                  </Button>
                </div>
              )}
            </CardHeader>
            <CardContent className="px-4 pb-4">
              {memberMemoEdit ? (
                <Textarea
                  value={memberMemoText}
                  onChange={e => setMemberMemoText(e.target.value)}
                  placeholder="회원 관련 메모를 입력하세요..."
                  rows={4}
                  className="text-sm resize-none"
                />
              ) : (
                <p className="text-sm text-foreground whitespace-pre-wrap">
                  {member.profileNote || <span className="text-muted-foreground">없음</span>}
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── 프로그램 탭 ── */}
        <TabsContent value="pt" className="mt-4 space-y-4">

          {/* PT 패키지 */}
          <Card className="bg-card border-border">
            <CardHeader className="px-4 sm:px-6 pb-2">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-base">PT</CardTitle>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => {
                      setRefundModalOpen(true);
                      setRefundContractUrl("");
                      setRefundSelectedPkgId(ptPackages?.[0]?.id ?? "");
                      const firstPkg = ptPackages?.[0];
                      if (firstPkg) {
                        setRefundForm({
                          paymentMethod: "",
                          taxAmount: "0",
                          penaltyAmount: "0",
                          refundAmount: String(firstPkg.paymentAmount ?? 0),
                          reason: "",
                        });
                      }
                    }}
                    className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg border border-red-400/50 text-red-400 hover:bg-red-400/10 transition-colors"
                  >
                    <span>🔄</span> 환불
                  </button>
                  <button
                    onClick={() => {
                      setYangdoModalOpen(true);
                      setYangdoContractUrl("");
                      setYangdoSelectedPkgId(ptPackages?.[0]?.id ?? "");
                      setYangdoForm({ transferDate: "", trainerMemo: "" });
                    }}
                    className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg border border-orange-400/50 text-orange-400 hover:bg-orange-400/10 transition-colors"
                  >
                    <ArrowRightLeft className="h-3 w-3" /> 양도
                  </button>
                  <button
                    onClick={() => setAddPkgOpen(true)}
                    className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                  >
                    <Plus className="h-3 w-3" /> 프로그램 추가
                  </button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="px-4 sm:px-6">
              {!ptPackages?.length ? (
                <p className="text-muted-foreground text-sm text-center py-6">등록된 PT 프로그램이 없습니다.</p>
              ) : (
                <div className="space-y-3">
                  {ptPackages.map((pkg) => {
                    const remaining = pkg.totalSessions - pkg.usedSessions;
                    const isActive = pkg.status === "active" && remaining > 0;
                    const svcSessions = (pkg as any).serviceSessions ?? 0;
                    return (
                      <div key={pkg.id} className="p-3 sm:p-4 rounded-lg bg-accent/20 border border-border">
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-medium text-foreground text-sm truncate">
                                {pkg.packageName || "PT 프로그램"}
                              </p>
                              {(() => {
                                const s = PT_STATUS[pkg.status] ?? PT_STATUS.expired;
                                return (
                                  <span className={`text-xs px-1.5 py-0.5 rounded-full border ${s.bg} ${s.text} ${s.border}`}>
                                    {s.label}
                                  </span>
                                );
                              })()}
                              {svcSessions > 0 && (
                                <span className="text-xs px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
                                  서비스 {svcSessions}회
                                </span>
                              )}
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
                            <div className="flex items-center gap-2">
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
                                    paymentMethod: ((pkg.paymentMethod === "계좌이체" ? "이체" : pkg.paymentMethod) ?? "") as any,
                                    paymentDate: (pkg as any).paymentDate ?? "",
                                    paymentMemo: pkg.paymentMemo ?? "",
                                  });
                                  setEditPkgOpen(true);
                                }}
                                className="text-xs text-primary underline hover:text-primary/70 transition-colors"
                              >
                                수정
                              </button>
                              <button
                                onClick={() => {
                                  if (window.confirm(`"${pkg.packageName || 'PT 프로그램'}" 프로그램을 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) {
                                    deletePackageMutation.mutate({ packageId: pkg.id });
                                  }
                                }}
                                className="text-xs text-red-400 underline hover:text-red-300 transition-colors"
                              >
                                삭제
                              </button>
                            </div>
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
                          <button onClick={() => { setPauseForm({ packageId: pkg.id, pauseStart: "", pauseEnd: "", reason: "" }); setPauseOpen(true); }}
                            className="px-2 py-0.5 rounded-full text-xs border border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10 flex items-center gap-1">
                            <PauseCircle className="h-3 w-3" />정지 추가
                          </button>
                        </div>

                        {/* PT 변화 리포트 마일스톤 버튼 */}
                        <PTReportButtons
                          packageId={pkg.id}
                          memberId={memberId}
                          totalSessions={pkg.totalSessions}
                          usedSessions={pkg.usedSessions}
                        />

                        {/* 프로그램 완료 → 보고서 버튼 */}
                        {(pkg.status === "completed" || pkg.usedSessions >= pkg.totalSessions) && (
                          <div className="mt-3 p-3 rounded-lg bg-green-500/10 border border-green-500/30">
                            <p className="text-xs text-green-400 font-medium mb-2">🎉 프로그램 완료! 회원 보고서를 생성하세요.</p>
                            <Button
                              size="sm"
                              className="w-full gap-2 bg-green-600 hover:bg-green-700 text-white"
                              disabled={healthReportMutation.isPending}
                              onClick={() => {
                                if (shareToken) { setShareOpen(true); }
                                else { generateReportMutation.mutate({ memberId }); }
                              }}
                            >
                              <Share2 className="h-3.5 w-3.5" />
                              보고서 생성 및 공유
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
                                  <p className="font-medium">{pkg.paymentMethod === "이체" ? "계좌이체" : pkg.paymentMethod}</p>
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

          {/* serviceItems / programDetail 파싱 (결제 기록에서 서비스 항목 추출) */}
          {(() => {
            const allRevs = memberPrograms?.healthRevenues ?? [];

            // serviceItems 기반 파싱
            const siEntries = allRevs.filter(r => r.serviceItems);
            const parseItems = (prefix: string) =>
              siEntries.flatMap(r =>
                (r.serviceItems ?? "").split(",").filter(s => s.startsWith(prefix)).map(item => ({
                  key: `si-${r.id}-${item}`,
                  detail: item,
                  paymentDate: r.paymentDate,
                  subType: r.subType,
                  fromEntry: r.id,
                }))
              );
            const siHealth = parseItems("헬스");
            const siLocker = parseItems("락커");
            const siUniform = parseItems("운동복");

            // serviceItems가 없지만 programDetail에 해당 카테고리가 있는 항목
            const siEntryIds = new Set(siEntries.map(r => r.id));
            const pdUniform = allRevs.filter(r =>
              !siEntryIds.has(r.id) && /운동복|유니폼|uniform/i.test(r.programDetail ?? "")
            ).map(r => ({ key: `pd-${r.id}`, detail: r.programDetail ?? "운동복", paymentDate: r.paymentDate, subType: r.subType, fromEntry: r.id }));

            const pdLocker = allRevs.filter(r =>
              !siEntryIds.has(r.id) && /락커/i.test(r.programDetail ?? "")
            ).map(r => ({ key: `pd-${r.id}`, detail: r.programDetail ?? "락커", paymentDate: r.paymentDate, subType: r.subType, fromEntry: r.id }));

            const allUniformItems = [...siUniform, ...pdUniform];
            const allLockerItems = [...siLocker, ...pdLocker];

            // 기타 서비스: 위에서 분류된 항목 제외
            const classifiedIds = new Set([
              ...pdUniform.map(x => x.fromEntry),
              ...pdLocker.map(x => x.fromEntry),
            ]);
            const healthRevs = allRevs.filter(r => r.type === "헬스");
            const etcRevs = allRevs.filter(r => r.type === "기타" && !classifiedIds.has(r.id));

            // 멤버 레코드의 membershipEnd가 있으면 헬스권으로 표시 (revenue entry 없는 경우 폴백)
            const memberHasHealthRecord = !!member.membershipEnd && healthRevs.length === 0;
            const hasHealth = healthRevs.length > 0 || siHealth.length > 0 || memberHasHealthRecord;

            // 멤버 레코드 기반 기간 계산
            const healthDurationMonths = (() => {
              const s = member.membershipStart ? new Date(member.membershipStart) : null;
              const e = member.membershipEnd ? new Date(member.membershipEnd) : null;
              if (!s || !e) return null;
              const months = (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth());
              return months > 0 ? months : null;
            })();
            const healthDaysLeft = (() => {
              if (!member.membershipEnd) return null;
              const today = new Date(); today.setHours(0, 0, 0, 0);
              const end = new Date(member.membershipEnd); end.setHours(0, 0, 0, 0);
              return Math.ceil((end.getTime() - today.getTime()) / 86400000);
            })();
            const hasLocker = (memberPrograms?.lockers.length ?? 0) > 0 || allLockerItems.length > 0;
            const hasUniform = (memberPrograms?.uniforms.length ?? 0) > 0 || allUniformItems.length > 0;

            // 뱃지-상세 불일치 감지 (getById 계산값 vs 프로그램 탭 실제 데이터)
            const badgeLockerNum = (member as any).lockerNumber as string | null;
            const badgeHasUniform = !!(member as any).hasUniform;
            const lockerMismatch = !!badgeLockerNum && !hasLocker;
            const uniformMismatch = badgeHasUniform && !hasUniform;

            return (
              <>
                {/* 헬스권 */}
                <Card className="bg-card border-border">
                  <CardHeader className="px-4 sm:px-6 pb-2">
                    <CardTitle className="text-base">헬스권</CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 sm:px-6">
                    {!hasHealth ? (
                      <p className="text-muted-foreground text-sm text-center py-6">등록된 헬스권이 없습니다.</p>
                    ) : (
                      <div className="space-y-3">
                        {/* 멤버 레코드 기반 헬스권 (revenue entry 없는 경우) */}
                        {memberHasHealthRecord && (
                          <div className="p-3 rounded-lg bg-accent/20 border border-border">
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-medium text-sm text-foreground">
                                  헬스권{healthDurationMonths ? ` ${healthDurationMonths}개월` : ""}
                                </p>
                                {healthDaysLeft !== null && healthDaysLeft > 0 ? (
                                  <span className={`text-xs px-1.5 py-0.5 rounded-full border ${
                                    healthDaysLeft <= 7
                                      ? `${STATUS_COLORS.expiring.bg} ${STATUS_COLORS.expiring.text} ${STATUS_COLORS.expiring.border}`
                                      : `${STATUS_COLORS.active.bg} ${STATUS_COLORS.active.text} ${STATUS_COLORS.active.border}`
                                  }`}>이용중</span>
                                ) : (
                                  <span className={`text-xs px-1.5 py-0.5 rounded-full border ${STATUS_COLORS.expired.bg} ${STATUS_COLORS.expired.text} ${STATUS_COLORS.expired.border}`}>만료</span>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                {healthDaysLeft !== null && healthDaysLeft > 0 && (
                                  <span className="text-xs font-semibold text-emerald-400">D-{healthDaysLeft}</span>
                                )}
                                <button
                                  onClick={() => setLocation(`/members/re-register?memberId=${memberId}`)}
                                  className="p-1 rounded text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                                  title="헬스권 수정 (재등록 페이지)"
                                >
                                  <Edit className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  onClick={() => {
                                    if (confirm("헬스권을 삭제하시겠습니까?\n삭제 후 재등록하면 장부·서비스 내역이 함께 저장됩니다.")) {
                                      clearHealthMutation.mutate({ id: memberId, membershipStart: null, membershipEnd: null });
                                    }
                                  }}
                                  disabled={clearHealthMutation.isPending}
                                  className="p-1 rounded text-muted-foreground hover:text-red-400 hover:bg-red-400/10 transition-colors"
                                  title="헬스권 삭제"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </div>
                            <div className="mt-2 text-xs text-muted-foreground">
                              {fmtDate(member.membershipStart, "yyyy.MM.dd")} ~ {fmtDate(member.membershipEnd, "yyyy.MM.dd")}
                            </div>
                            <div className="mt-2 text-amber-400/80 text-[11px]">
                              ※ 결제 내역 없음 — 재등록 시 장부·서비스 내역이 함께 저장됩니다
                            </div>
                          </div>
                        )}
                        {/* serviceItems 기반 헬스 서비스 */}
                        {siHealth.map(item => (
                          <div key={item.key} className={`p-3 rounded-lg ${SERVICE_COLORS.헬스.faint} border ${SERVICE_COLORS.헬스.border}`}>
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-medium text-sm text-foreground">{item.detail}</p>
                              <span className={`text-xs px-1.5 py-0.5 rounded-full border ${SERVICE_COLORS.헬스.bg} ${SERVICE_COLORS.헬스.text} ${SERVICE_COLORS.헬스.border}`}>서비스</span>
                              {item.subType && <span className="text-xs px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">{item.subType}</span>}
                            </div>
                            <p className="mt-1 text-xs text-muted-foreground">{item.paymentDate}</p>
                          </div>
                        ))}
                        {/* 결제 기록 기반 헬스권 */}
                        {healthRevs.map(r => {
                          const isService = r.paidAmount === 0;
                          return (
                            <div key={r.id} className="p-3 rounded-lg bg-accent/20 border border-border">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-medium text-sm text-foreground">헬스권</p>
                                {r.subType && <span className="text-xs px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">{r.subType}</span>}
                                {isService && <span className={`text-xs px-1.5 py-0.5 rounded-full border ${SERVICE_COLORS.헬스.bg} ${SERVICE_COLORS.헬스.text} ${SERVICE_COLORS.헬스.border}`}>서비스</span>}
                              </div>
                              <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
                                {(r.startDate || r.endDate) && <div className="col-span-2">{r.startDate ?? "-"} ~ {r.endDate ?? "-"}</div>}
                                <div>결제 <span className="text-foreground font-medium">{r.paidAmount.toLocaleString()}원</span></div>
                                {r.unpaidAmount > 0 && <div>미수금 <span className="text-orange-400 font-medium">{r.unpaidAmount.toLocaleString()}원</span></div>}
                                {r.programDetail && <div className="col-span-2">{r.programDetail}</div>}
                                {r.memo && <div className="col-span-2 text-muted-foreground/70">{r.memo}</div>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* 기타 서비스 */}
                {etcRevs.length > 0 && (
                  <Card className="bg-card border-border">
                    <CardHeader className="px-4 sm:px-6 pb-2">
                      <CardTitle className="text-base">기타 서비스</CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 sm:px-6">
                      <div className="space-y-3">
                        {etcRevs.map(r => {
                          const isService = r.paidAmount === 0;
                          const detail = r.programDetail ?? r.memo ?? "기타";
                          return (
                            <div key={r.id} className="p-3 rounded-lg bg-accent/20 border border-border">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-medium text-sm text-foreground">{detail}</p>
                                <span className="text-xs px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">{r.subType}</span>
                                {isService && <span className="text-xs px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">서비스</span>}
                              </div>
                              <div className="mt-2 text-xs text-muted-foreground">
                                <span>결제 <span className="text-foreground font-medium">{r.paidAmount.toLocaleString()}원</span></span>
                                {r.unpaidAmount > 0 && <span className="ml-3">미수금 <span className="text-orange-400 font-medium">{r.unpaidAmount.toLocaleString()}원</span></span>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* 락커 */}
                <Card className="bg-card border-border">
                  <CardHeader className="px-4 sm:px-6 pb-2">
                    <CardTitle className="text-base">락커</CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 sm:px-6">
                    {lockerMismatch && (
                      <div className="mb-3 flex items-start gap-2 px-3 py-2.5 rounded-lg bg-orange-500/10 border border-orange-500/30">
                        <span className="text-orange-400 text-sm shrink-0">⚠️</span>
                        <div>
                          <p className="text-xs font-medium text-orange-400">락커 연동 오류</p>
                          <p className="text-xs text-orange-400/80 mt-0.5">회원 목록에서 락커 {badgeLockerNum} 뱃지가 감지됐지만 이 회원 ID에 연결된 데이터가 없습니다. 장부에서 해당 결제 내역의 회원을 이 회원으로 연결해 주세요.</p>
                        </div>
                      </div>
                    )}
                    {!hasLocker ? (
                      <p className="text-muted-foreground text-sm text-center py-6">배정된 락커가 없습니다.</p>
                    ) : (
                      <div className="space-y-3">
                        {/* serviceItems/programDetail 기반 락커 서비스 */}
                        {allLockerItems.map(item => (
                          <div key={item.key} className={`p-3 rounded-lg ${SERVICE_COLORS.락커.faint} border ${SERVICE_COLORS.락커.border}`}>
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-medium text-sm text-foreground">{item.detail}</p>
                              <span className={`text-xs px-1.5 py-0.5 rounded-full border ${SERVICE_COLORS.락커.bg} ${SERVICE_COLORS.락커.text} ${SERVICE_COLORS.락커.border}`}>서비스</span>
                              {item.subType && <span className="text-xs px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">{item.subType}</span>}
                            </div>
                            <p className="mt-1 text-xs text-muted-foreground">{item.paymentDate}</p>
                          </div>
                        ))}
                        {/* 실제 락커 배정 기록 */}
                        {memberPrograms!.lockers.map(locker => (
                          <div key={locker.id} className="p-3 rounded-lg bg-accent/20 border border-border">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-medium text-sm text-foreground">락커 {locker.lockerNumber}</p>
                              <span className={`text-xs px-1.5 py-0.5 rounded-full border ${locker.isOccupied ? `${STATUS_COLORS.active.bg} ${STATUS_COLORS.active.text} ${STATUS_COLORS.active.border}` : `${STATUS_COLORS.completed.bg} ${STATUS_COLORS.completed.text} ${STATUS_COLORS.completed.border}`}`}>
                                {locker.isOccupied ? "이용중" : "미사용"}
                              </span>
                              {locker.lockerType && locker.lockerType !== "personal" && (
                                <span className="text-xs px-1.5 py-0.5 rounded-full bg-accent text-muted-foreground border border-border">{locker.lockerType}</span>
                              )}
                            </div>
                            {(locker.startDate || locker.endDate) && (
                              <p className="mt-1 text-xs text-muted-foreground">{locker.startDate ?? "-"} ~ {locker.endDate ?? "-"}</p>
                            )}
                            {locker.memo && <p className="mt-1 text-xs text-muted-foreground/70">{locker.memo}</p>}
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* 운동복 */}
                <Card className="bg-card border-border">
                  <CardHeader className="px-4 sm:px-6 pb-2">
                    <CardTitle className="text-base">운동복</CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 sm:px-6">
                    {uniformMismatch && (
                      <div className="mb-3 flex items-start gap-2 px-3 py-2.5 rounded-lg bg-orange-500/10 border border-orange-500/30">
                        <span className="text-orange-400 text-sm shrink-0">⚠️</span>
                        <div>
                          <p className="text-xs font-medium text-orange-400">운동복 연동 오류</p>
                          <p className="text-xs text-orange-400/80 mt-0.5">회원 목록에서 운동복 뱃지가 감지됐지만 이 회원 ID에 연결된 데이터가 없습니다. 장부에서 해당 결제 내역의 회원을 이 회원으로 연결해 주세요.</p>
                        </div>
                      </div>
                    )}
                    {!hasUniform ? (
                      <p className="text-muted-foreground text-sm text-center py-6">대여중인 운동복이 없습니다.</p>
                    ) : (
                      <div className="space-y-3">
                        {/* serviceItems/programDetail 기반 운동복 서비스 */}
                        {allUniformItems.map(item => (
                          <div key={item.key} className={`p-3 rounded-lg ${SERVICE_COLORS.운동복.faint} border ${SERVICE_COLORS.운동복.border}`}>
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-medium text-sm text-foreground">{item.detail}</p>
                              <span className={`text-xs px-1.5 py-0.5 rounded-full border ${SERVICE_COLORS.운동복.bg} ${SERVICE_COLORS.운동복.text} ${SERVICE_COLORS.운동복.border}`}>서비스</span>
                              {item.subType && <span className="text-xs px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">{item.subType}</span>}
                            </div>
                            <p className="mt-1 text-xs text-muted-foreground">{item.paymentDate}</p>
                          </div>
                        ))}
                        {/* 실제 운동복 대여 기록 */}
                        {memberPrograms!.uniforms.map(u => (
                          <div key={u.id} className="p-3 rounded-lg bg-accent/20 border border-border">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-medium text-sm text-foreground">운동복{u.size ? ` (${u.size})` : ""}</p>
                              {(u.quantity ?? 1) > 1 && (
                                <span className="text-xs px-1.5 py-0.5 rounded-full bg-accent text-muted-foreground border border-border">×{u.quantity}</span>
                              )}
                              <span className={`text-xs px-1.5 py-0.5 rounded-full border ${u.isActive ? `${STATUS_COLORS.active.bg} ${STATUS_COLORS.active.text} ${STATUS_COLORS.active.border}` : `${STATUS_COLORS.completed.bg} ${STATUS_COLORS.completed.text} ${STATUS_COLORS.completed.border}`}`}>
                                {u.isActive ? "이용중" : "반납"}
                              </span>
                            </div>
                            {(u.startDate || u.endDate) && (
                              <p className="mt-1 text-xs text-muted-foreground">{u.startDate ?? "-"} ~ {u.endDate ?? "-"}</p>
                            )}
                            {u.memo && <p className="mt-1 text-xs text-muted-foreground/70">{u.memo}</p>}
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </>
            );
          })()}

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

          {/* 건강 보고서 */}
          <Card className="bg-card border-border">
            <CardHeader className="px-4 pb-2 pt-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <FileHeart className="h-4 w-4 text-primary" />건강 보고서
                </CardTitle>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 h-8 text-xs"
                  disabled={healthReportMutation.isPending}
                  onClick={() => healthReportMutation.mutate({ memberId })}
                >
                  {healthReportMutation.isPending
                    ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />생성 중...</>
                    : <><Sparkles className="h-3.5 w-3.5 text-primary" />AI 보고서 생성</>}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              {!healthReport && !healthReportMutation.isPending && (
                <p className="text-xs text-muted-foreground text-center py-6">
                  AI 보고서 생성 버튼을 눌러 건강·트레이닝 분석 보고서를 만들어보세요.
                </p>
              )}
              {healthReportMutation.isPending && (
                <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground text-sm">
                  <Loader2 className="h-4 w-4 animate-spin" />AI가 보고서를 작성하고 있습니다...
                </div>
              )}
              {healthReport && !healthReportMutation.isPending && (
                <div className="space-y-4">
                  {/* 공유 버튼 */}
                  {healthReport.reportUrl && (
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="flex-1 gap-1.5 text-xs"
                        onClick={() => {
                          const url = `${window.location.origin}${healthReport.reportUrl}`;
                          navigator.clipboard.writeText(url).then(() => toast.success("링크가 복사되었습니다")).catch(() => toast.error("복사 실패"));
                        }}>
                        <Copy className="h-3.5 w-3.5" />링크 복사
                      </Button>
                      <Button variant="outline" size="sm" className="flex-1 gap-1.5 text-xs"
                        onClick={() => window.open(healthReport.reportUrl!, "_blank")}>
                        <FileHeart className="h-3.5 w-3.5" />보고서 보기
                      </Button>
                    </div>
                  )}
                  {/* 트레이닝 통계 요약 */}
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    {[
                      { label: "총 수업", value: `${healthReport.stats.totalSessions}회` },
                      { label: "컨디션 평균", value: healthReport.stats.avgCondition != null ? `${healthReport.stats.avgCondition}/10` : "-" },
                      { label: "통증 평균", value: healthReport.stats.avgPain != null ? `${healthReport.stats.avgPain}/10` : "-" },
                    ].map(item => (
                      <div key={item.label} className="p-2 rounded-lg bg-accent/20 border border-border text-center">
                        <p className="text-muted-foreground mb-0.5">{item.label}</p>
                        <p className="font-bold text-sm">{item.value}</p>
                      </div>
                    ))}
                  </div>
                  {healthReport.stats.topBodyParts.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">주요 운동 부위</p>
                      <div className="flex flex-wrap gap-1.5">
                        {healthReport.stats.topBodyParts.map((p: string) => (
                          <span key={p} className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">{p}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {/* AI 리포트 텍스트 미리보기 */}
                  <div className="space-y-3 pt-2 border-t border-border/50">
                    <div className="flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5 text-primary" />
                      <span className="text-xs font-semibold text-primary">{healthReport.isAI ? "AI 분석 결과 (미리보기)" : "자동 생성 보고서 (미리보기)"}</span>
                    </div>
                    <div className="text-sm text-foreground leading-relaxed whitespace-pre-wrap line-clamp-6">
                      {healthReport.report.split(/(\*\*[^*]+\*\*)/).map((part, i) =>
                        part.startsWith("**") && part.endsWith("**")
                          ? <strong key={i} className="font-semibold text-foreground">{part.slice(2, -2)}</strong>
                          : <span key={i}>{part}</span>
                      )}
                    </div>
                    {healthReport.reportUrl && (
                      <p className="text-xs text-muted-foreground text-center">전체 보고서는 링크에서 확인하세요</p>
                    )}
                  </div>
                </div>
              )}
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
                  setJournalForm({ sessionDate: new Date().toISOString().split("T")[0], goal: "", bodyPart: "", exercises: [], feedback: "", notes: "", isDraft: false });
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
                    const isDraft = !!(log as any).isDraft;
                    return (
                      <button
                        key={log.id}
                        className={`w-full rounded-lg overflow-hidden transition-colors text-left border ${
                          isDraft
                            ? "bg-yellow-500/5 border-yellow-500/30 hover:border-yellow-500/60 hover:bg-yellow-500/10"
                            : "bg-accent/20 border-border hover:border-primary/40 hover:bg-accent/30"
                        }`}
                        onClick={() => {
                          if (isDraft) {
                            const exs = parseExercisesJson((log as any).exercisesJson as string | null);
                            setEditJournalForm({
                              id: log.id,
                              sessionDate: log.sessionDate,
                              goal: (log as any).goal ?? "",
                              bodyPart: (log as any).bodyPart ?? "",
                              exercises: exs,
                              feedback: (log as any).feedback ?? "",
                              notes: log.notes ?? "",
                              isDraft: true,
                            });
                            setEditJournalOpen(true);
                          } else {
                            openLiveTraining(log);
                          }
                        }}
                      >
                        <div className="flex items-center justify-between px-3 py-2.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            {isDraft ? (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 font-medium">📝 날짜 미정</span>
                            ) : (
                              <span className="text-xs font-semibold text-primary">{fmtDate(log.sessionDate, "yyyy.MM.dd (EEE)")}</span>
                            )}
                            {(log as any).bodyPart && (log as any).bodyPart.split(",").filter(Boolean).map((bp: string) => (
                              <span key={bp} className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/20 text-primary">{bp}</span>
                            ))}
                            {log.packageId && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-500/20 text-green-400">PT세션</span>
                            )}
                            {!isDraft && (log as any).sharedToMember ? (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center gap-0.5">
                                <CheckCheck className="h-2.5 w-2.5" />전송됨
                              </span>
                            ) : null}
                          </div>
                          {isDraft ? (
                            <span className="text-[10px] text-yellow-400 shrink-0">날짜 확정 →</span>
                          ) : (
                            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          )}
                        </div>
                        {isDraft && (log as any).goal && (
                          <div className="px-3 pb-2 text-[10px] text-muted-foreground truncate">{(log as any).goal}</div>
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
                <Dialog open={memoOpen} onOpenChange={(v) => { setMemoOpen(v); if (!v) setMemoForm({ memoDate: new Date().toISOString().split("T")[0], content: "" }); }}>
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
            onClick={() => setLocation(`/attendance/${memberId}?date=${todayStr}`)}
          >
            <CheckCircle className="h-4 w-4" />
            {checkedInToday ? "오늘 출석 완료 ✓" : "오늘 출석 체크"}
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
                    <button
                      key={i}
                      onClick={() => setLocation(`/attendance/${memberId}?date=${dateStr}`)}
                      className={`aspect-square flex items-center justify-center rounded-full text-xs font-medium transition-colors hover:ring-2 hover:ring-primary/50 ${
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
                    </button>
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
                              통증 {check.painLevel}/10{check.painArea ? ` (${check.painArea}${check.painSide ? ` · ${check.painSide}` : ""})` : ""}
                            </span>
                          )}
                          {check.diet && (() => { try { const d = JSON.parse(check.diet); return d.length > 0 ? <span>식단: {d.join(" · ")}</span> : null; } catch { return null; } })()}
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
              <Input value={editPkgForm.packageName} onChange={e => setEditPkgForm(p => ({ ...p, packageName: e.target.value }))} placeholder="케어피티" className="h-9 text-sm" />
              <div className="flex gap-1.5 flex-wrap">
                {["케어피티", "웨이트피티", "이벤트피티", "이벤트세션"].map(preset => (
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
                  <SelectItem value="이체">계좌이체</SelectItem>
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
            {/* 날짜 미정 토글 */}
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={journalForm.isDraft}
                onChange={e => setJournalForm(p => ({ ...p, isDraft: e.target.checked }))}
                className="rounded"
              />
              <span className="text-xs text-muted-foreground">날짜 미정 — 나중에 확정</span>
            </label>
            <div className="space-y-1.5">
              <Label className="text-xs">날짜</Label>
              {journalForm.isDraft ? (
                <div className="h-9 flex items-center px-3 text-sm text-muted-foreground border border-border rounded-md bg-muted/30 italic">미정</div>
              ) : (
                <Input type="date" value={journalForm.sessionDate} onChange={e => setJournalForm(p => ({ ...p, sessionDate: e.target.value }))} className="h-9 text-sm" />
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">운동 부위 (최대 3개)</Label>
              <BodyPartPicker value={journalForm.bodyPart} onChange={v => setJournalForm(p => ({ ...p, bodyPart: v }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">운동 종목</Label>
              <ExerciseEditor simpleMode exercises={journalForm.exercises} onChange={exs => setJournalForm(p => ({ ...p, exercises: exs }))} suggestions={exerciseSuggestions} />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setJournalOpen(false)}>취소</Button>
              <Button className="flex-1" disabled={createLogMutation.isPending}
                onClick={() => createLogMutation.mutate({
                  memberId,
                  sessionDate: journalForm.isDraft ? new Date().toISOString().split("T")[0] : journalForm.sessionDate,
                  goal: journalForm.goal || undefined,
                  bodyPart: journalForm.bodyPart || undefined,
                  exercisesJson: journalForm.exercises.length > 0 ? JSON.stringify(journalForm.exercises) : undefined,
                  feedback: journalForm.feedback || undefined,
                  notes: journalForm.notes || undefined,
                  isDraft: journalForm.isDraft,
                })}>
                {createLogMutation.isPending ? "저장 중..." : journalForm.isDraft ? "임시 저장" : "저장"}
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
            {/* 날짜 미정 토글 */}
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={editJournalForm.isDraft}
                onChange={e => setEditJournalForm(p => ({ ...p, isDraft: e.target.checked }))}
                className="rounded"
              />
              <span className="text-xs text-muted-foreground">날짜 미정 — 나중에 확정</span>
            </label>
            <div className="space-y-1.5">
              <Label className="text-xs">날짜</Label>
              {editJournalForm.isDraft ? (
                <div className="h-9 flex items-center px-3 text-sm text-muted-foreground border border-border rounded-md bg-muted/30 italic">미정</div>
              ) : (
                <Input type="date" value={editJournalForm.sessionDate} onChange={e => setEditJournalForm(p => ({ ...p, sessionDate: e.target.value }))} className="h-9 text-sm" />
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">운동 부위 (최대 3개)</Label>
              <BodyPartPicker value={editJournalForm.bodyPart} onChange={v => setEditJournalForm(p => ({ ...p, bodyPart: v }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">운동 종목</Label>
              <ExerciseEditor simpleMode exercises={editJournalForm.exercises} onChange={exs => setEditJournalForm(p => ({ ...p, exercises: exs }))} suggestions={exerciseSuggestions} />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setEditJournalOpen(false)}>취소</Button>
              <Button className="flex-1" disabled={updateLogMutation.isPending}
                onClick={() => updateLogMutation.mutate({
                  id: editJournalForm.id,
                  sessionDate: editJournalForm.isDraft
                    ? (editJournalForm.sessionDate || new Date().toISOString().split("T")[0])
                    : editJournalForm.sessionDate || undefined,
                  goal: editJournalForm.goal || undefined,
                  bodyPart: editJournalForm.bodyPart || undefined,
                  exercisesJson: editJournalForm.exercises.length > 0 ? JSON.stringify(editJournalForm.exercises) : undefined,
                  feedback: editJournalForm.feedback || undefined,
                  notes: editJournalForm.notes || undefined,
                  isDraft: editJournalForm.isDraft,
                })}>
                {updateLogMutation.isPending ? "저장 중..." : editJournalForm.isDraft ? "임시 저장" : "저장"}
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
                suggestions={exerciseSuggestions}
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setSessionDialogOpen(false)}>취소</Button>
              <Button
                className="flex-1"
                disabled={useSessionMutation.isPending}
                onClick={() => {
                  if (sessionSubmittingRef.current) return;
                  sessionSubmittingRef.current = true;
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

      {/* ── 라이브 트레이닝 모달 ── */}
      <Dialog open={liveTrainingOpen} onOpenChange={setLiveTrainingOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Dumbbell className="h-4 w-4 text-primary" />
              트레이닝 기록
            </DialogTitle>
            {liveLog && (
              <DialogDescription>
                {fmtDate(liveLog.sessionDate, "yyyy.MM.dd (EEE)")}
                {liveLog.goal ? ` · ${liveLog.goal}` : ""}
              </DialogDescription>
            )}
          </DialogHeader>

          <div className="space-y-3 py-1">
            {liveExercises.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">운동 종목이 없습니다.</p>
            )}
            {liveExercises.map((ex, i) => {
              const allDone = ex.sets.length > 0 && ex.sets.every((_, j) => checkedSets.has(`${i}-${j}`));
              return (
                <div
                  key={i}
                  className={`border rounded-lg p-3 space-y-2 transition-colors ${allDone ? "border-green-500/40 bg-green-500/5" : "border-border bg-accent/10"}`}
                >
                  {/* 운동명 헤더 */}
                  <div className="flex items-center gap-2">
                    <input
                      className="flex-1 bg-transparent text-sm font-medium border-none outline-none focus:ring-0 text-foreground"
                      value={ex.name}
                      placeholder="운동명"
                      onChange={(e) => setLiveExercises((prev) =>
                        prev.map((ex2, idx) => idx === i ? { ...ex2, name: e.target.value } : ex2)
                      )}
                    />
                    <button
                      onClick={() => setLiveExercises((prev) => prev.filter((_, idx) => idx !== i))}
                      className="text-muted-foreground hover:text-red-400 transition-colors shrink-0"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {/* 세트 헤더 */}
                  {ex.sets.length > 0 && (
                    <div className="grid grid-cols-[20px_20px_1fr_1fr_28px] gap-1 px-0.5">
                      <span />
                      <span className="text-[10px] text-muted-foreground text-center">세트</span>
                      <span className="text-[10px] text-muted-foreground">횟수</span>
                      <span className="text-[10px] text-muted-foreground">무게(kg)</span>
                      <span />
                    </div>
                  )}

                  {/* 세트 목록 - 세트별 체크박스 */}
                  <div className="space-y-1">
                    {ex.sets.map((s, j) => {
                      const setKey = `${i}-${j}`;
                      const isSetDone = checkedSets.has(setKey);
                      return (
                        <div key={j} className="grid grid-cols-[20px_20px_1fr_1fr_28px] gap-1 items-center">
                          <button
                            onClick={() => toggleSetCheck(i, j)}
                            className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors shrink-0 ${isSetDone ? "border-green-500 bg-green-500" : "border-muted-foreground hover:border-primary"}`}
                          >
                            {isSetDone && <Check className="h-2.5 w-2.5 text-white" />}
                          </button>
                          <span className={`text-xs text-muted-foreground text-center ${isSetDone ? "opacity-40" : ""}`}>{j + 1}</span>
                          <Input
                            placeholder="횟수"
                            value={s.reps}
                            onChange={(e) => setLiveExercises((prev) =>
                              prev.map((ex2, idx) => {
                                if (idx !== i) return ex2;
                                return { ...ex2, sets: ex2.sets.map((s2, k) => k === j ? { ...s2, reps: e.target.value } : s2) };
                              })
                            )}
                            className={`h-7 text-xs ${isSetDone ? "opacity-40" : ""}`}
                            type="number"
                            min="0"
                          />
                          <Input
                            placeholder="kg"
                            value={s.weight}
                            onChange={(e) => setLiveExercises((prev) =>
                              prev.map((ex2, idx) => {
                                if (idx !== i) return ex2;
                                return { ...ex2, sets: ex2.sets.map((s2, k) => k === j ? { ...s2, weight: e.target.value } : s2) };
                              })
                            )}
                            className={`h-7 text-xs ${isSetDone ? "opacity-40" : ""}`}
                            type="number"
                            min="0"
                            step="0.5"
                          />
                          <button
                            onClick={() => setLiveExercises((prev) =>
                              prev.map((ex2, idx) => {
                                if (idx !== i) return ex2;
                                return { ...ex2, sets: ex2.sets.filter((_, k) => k !== j) };
                              })
                            )}
                            className="text-muted-foreground hover:text-red-400 transition-colors"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  {/* 세트 추가 | 여기에 운동 삽입 */}
                  <div className="flex items-center gap-3 pt-0.5">
                    <button
                      onClick={() => setLiveExercises((prev) =>
                        prev.map((ex2, idx) => {
                          if (idx !== i) return ex2;
                          const last = ex2.sets[ex2.sets.length - 1];
                          return { ...ex2, sets: [...ex2.sets, last ? { ...last } : { reps: "", weight: "" }] };
                        })
                      )}
                      className="flex items-center gap-1 text-xs text-primary hover:text-primary/70 transition-colors"
                    >
                      <Plus className="h-3 w-3" />
                      세트 추가
                    </button>
                    <span className="text-muted-foreground/30 text-xs">|</span>
                    <button
                      onClick={() => insertExerciseAfter(i)}
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Plus className="h-3 w-3" />
                      운동 삽입
                    </button>
                  </div>
                </div>
              );
            })}

            {/* 맨 끝에 운동 추가 */}
            <button
              onClick={() => setLiveExercises((prev) => [...prev, { name: "", sets: [{ reps: "", weight: "" }] }])}
              className="w-full flex items-center justify-center gap-1.5 py-2.5 border border-dashed border-primary/40 rounded-lg text-sm text-primary hover:bg-primary/5 transition-colors"
            >
              <Plus className="h-4 w-4" />
              운동 추가
            </button>
          </div>

          {/* 하단 액션 */}
          <div className="flex items-center justify-between pt-3 border-t border-border/40">
            {/* 회원 전송 */}
            {liveLog && (
              <button
                onClick={() => shareLogMutation.mutate({ id: liveLog.id, share: !(liveLog as any).sharedToMember })}
                disabled={shareLogMutation.isPending}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  (liveLog as any).sharedToMember
                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/10"
                    : "bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20"
                }`}
              >
                {(liveLog as any).sharedToMember
                  ? <><CheckCheck className="h-3.5 w-3.5" />전송됨</>
                  : <><Send className="h-3.5 w-3.5" />회원 전송</>
                }
              </button>
            )}
            {/* 수정/삭제/저장 */}
            <div className="flex items-center gap-2 ml-auto">
              {liveLog && (
                <>
                  <button
                    onClick={() => {
                      if (!liveLog) return;
                      const exs = parseExercisesJson((liveLog as any).exercisesJson as string | null);
                      setEditJournalForm({
                        id: liveLog.id,
                        sessionDate: liveLog.sessionDate,
                        goal: (liveLog as any).goal ?? "",
                        bodyPart: (liveLog as any).bodyPart ?? "",
                        exercises: exs,
                        feedback: (liveLog as any).feedback ?? "",
                        notes: liveLog.notes ?? "",
                        isDraft: !!((liveLog as any).isDraft),
                      });
                      setLiveTrainingOpen(false);
                      setEditJournalOpen(true);
                    }}
                    className="text-muted-foreground hover:text-primary transition-colors p-1"
                    title="상세 수정"
                  >
                    <Edit className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => { deleteLogMutation.mutate({ id: liveLog.id }); setLiveTrainingOpen(false); }}
                    className="text-muted-foreground hover:text-red-400 transition-colors p-1"
                    title="삭제"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </>
              )}
              <Button
                size="sm"
                disabled={updateLogMutation.isPending}
                onClick={() => {
                  if (!liveLog) return;
                  updateLogMutation.mutate({
                    id: liveLog.id,
                    exercisesJson: liveExercises.length > 0 ? JSON.stringify(liveExercises) : undefined,
                  });
                }}
              >
                {updateLogMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "저장"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {transferOpen && member && (
        <TransferModal
          member={{ id: member.id, name: member.name, phone: member.phone ?? null }}
          allMembers={(allMembers ?? []).map((m) => ({ id: m.id, name: m.name, phone: m.phone ?? null }))}
          ptPackages={
            (ptPackages ?? []).map((p) => ({
              id: p.id,
              packageName: p.packageName,
              totalSessions: p.totalSessions,
              usedSessions: p.usedSessions,
            }))
          }
          onClose={() => setTransferOpen(false)}
        />
      )}

      {/* ── 환불 계약서 모달 ── */}
      <Dialog open={refundModalOpen} onOpenChange={(open) => { setRefundModalOpen(open); if (!open) setRefundContractUrl(""); }}>
        <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span>🔄</span> 환불 계약서 생성
            </DialogTitle>
            <DialogDescription>환불 정보를 입력하고 계약서 링크를 발급합니다.</DialogDescription>
          </DialogHeader>

          {refundContractUrl ? (
            <div className="space-y-4 py-2">
              <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 text-center">
                <p className="text-sm font-semibold text-green-400 mb-2">계약서가 생성되었습니다!</p>
                <p className="text-xs text-muted-foreground break-all">{refundContractUrl}</p>
              </div>
              <Button
                className="w-full"
                onClick={() => {
                  navigator.clipboard.writeText(refundContractUrl);
                  toast.success("링크가 복사되었습니다.");
                }}
              >
                <Copy className="h-4 w-4 mr-2" /> 링크 복사
              </Button>
              <Button variant="outline" className="w-full" onClick={() => { setRefundModalOpen(false); setRefundContractUrl(""); }}>
                닫기
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {/* 패키지 선택 */}
              {ptPackages && ptPackages.length > 1 && (
                <div className="space-y-1.5">
                  <Label className="text-xs">PT 패키지 선택</Label>
                  <Select
                    value={String(refundSelectedPkgId)}
                    onValueChange={(v) => {
                      const id = Number(v);
                      setRefundSelectedPkgId(id);
                      const pkg = ptPackages.find((p) => p.id === id);
                      if (pkg) {
                        setRefundForm((prev) => ({
                          ...prev,
                          taxAmount: "0",
                          penaltyAmount: "0",
                          refundAmount: String(pkg.paymentAmount ?? 0),
                        }));
                      }
                    }}
                  >
                    <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="패키지 선택" /></SelectTrigger>
                    <SelectContent>
                      {ptPackages.map((p) => (
                        <SelectItem key={p.id} value={String(p.id)}>
                          {p.packageName || "PT 프로그램"} ({p.totalSessions - p.usedSessions}회 잔여)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* 자동 채움 필드 */}
              {(() => {
                const pkg = ptPackages?.find((p) => p.id === refundSelectedPkgId) ?? ptPackages?.[0];
                return pkg ? (
                  <div className="bg-accent/20 rounded-lg p-3 space-y-1.5 text-xs">
                    <div className="flex justify-between"><span className="text-muted-foreground">프로그램명</span><span className="font-medium">{pkg.packageName || "PT 프로그램"}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">결제 금액</span><span className="font-medium">{(pkg.paymentAmount ?? 0).toLocaleString()}원</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">총 횟수</span><span className="font-medium">{pkg.totalSessions}회</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">수강 횟수</span><span className="font-medium">{pkg.usedSessions}회</span></div>
                  </div>
                ) : null;
              })()}

              {/* 결제 방법 */}
              <div className="space-y-1.5">
                <Label className="text-xs">결제 방법</Label>
                <div className="flex gap-1.5">
                  {(["카드", "현금", "계좌이체"] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setRefundForm((p) => ({ ...p, paymentMethod: p.paymentMethod === m ? "" : m }))}
                      className={`flex-1 py-1.5 rounded-lg text-xs border transition-colors ${refundForm.paymentMethod === m ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-primary/40"}`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              {/* 부가세 / 위약금 */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">부가세(원)</Label>
                  <Input
                    type="number"
                    min="0"
                    value={refundForm.taxAmount}
                    onChange={(e) => {
                      const tax = Number(e.target.value) || 0;
                      const penalty = Number(refundForm.penaltyAmount) || 0;
                      const pkg = ptPackages?.find((p) => p.id === refundSelectedPkgId) ?? ptPackages?.[0];
                      const base = pkg?.paymentAmount ?? 0;
                      setRefundForm((p) => ({ ...p, taxAmount: e.target.value, refundAmount: String(Math.max(0, base - tax - penalty)) }));
                    }}
                    className="h-9 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">위약금(원)</Label>
                  <Input
                    type="number"
                    min="0"
                    value={refundForm.penaltyAmount}
                    onChange={(e) => {
                      const penalty = Number(e.target.value) || 0;
                      const tax = Number(refundForm.taxAmount) || 0;
                      const pkg = ptPackages?.find((p) => p.id === refundSelectedPkgId) ?? ptPackages?.[0];
                      const base = pkg?.paymentAmount ?? 0;
                      setRefundForm((p) => ({ ...p, penaltyAmount: e.target.value, refundAmount: String(Math.max(0, base - tax - penalty)) }));
                    }}
                    className="h-9 text-sm"
                  />
                </div>
              </div>

              {/* 환불 금액 */}
              <div className="space-y-1.5">
                <Label className="text-xs">환불 금액(원)</Label>
                <Input
                  type="number"
                  min="0"
                  value={refundForm.refundAmount}
                  onChange={(e) => setRefundForm((p) => ({ ...p, refundAmount: e.target.value }))}
                  className="h-9 text-sm font-semibold text-primary"
                />
              </div>

              {/* 환불 사유 */}
              <div className="space-y-1.5">
                <Label className="text-xs">환불 사유</Label>
                <Textarea
                  rows={3}
                  placeholder="환불 사유를 입력하세요 (선택)"
                  value={refundForm.reason}
                  onChange={(e) => setRefundForm((p) => ({ ...p, reason: e.target.value }))}
                  className="text-sm resize-none"
                />
              </div>

              <div className="flex gap-2 pt-1">
                <Button variant="outline" className="flex-1" onClick={() => setRefundModalOpen(false)}>취소</Button>
                <Button
                  className="flex-1"
                  disabled={createRefundContractMutation.isPending}
                  onClick={() => {
                    const pkg = ptPackages?.find((p) => p.id === refundSelectedPkgId) ?? ptPackages?.[0];
                    if (!pkg || !member) return;
                    createRefundContractMutation.mutate({
                      memberId: member.id,
                      packageId: pkg.id,
                      memberName: member.name,
                      memberPhone: member.phone ?? undefined,
                      programName: pkg.packageName || "PT 프로그램",
                      paymentAmount: pkg.paymentAmount ?? 0,
                      totalSessions: pkg.totalSessions,
                      usedSessions: pkg.usedSessions,
                      paymentMethod: refundForm.paymentMethod || undefined,
                      taxAmount: Number(refundForm.taxAmount) || 0,
                      penaltyAmount: Number(refundForm.penaltyAmount) || 0,
                      refundAmount: Number(refundForm.refundAmount) || 0,
                      reason: refundForm.reason || undefined,
                    });
                  }}
                >
                  {createRefundContractMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "계약서 생성 및 링크 발급"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── 양도 계약서 모달 ── */}
      <Dialog open={yangdoModalOpen} onOpenChange={(open) => { setYangdoModalOpen(open); if (!open) setYangdoContractUrl(""); }}>
        <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowRightLeft className="h-4 w-4 text-orange-400" /> 양도 계약서 생성
            </DialogTitle>
            <DialogDescription>양도 정보를 입력하고 계약서 링크를 발급합니다.</DialogDescription>
          </DialogHeader>

          {yangdoContractUrl ? (
            <div className="space-y-4 py-2">
              <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-4 text-center">
                <p className="text-sm font-semibold text-orange-400 mb-2">계약서가 생성되었습니다!</p>
                <p className="text-xs text-muted-foreground break-all">{yangdoContractUrl}</p>
              </div>
              <Button
                className="w-full"
                onClick={() => {
                  navigator.clipboard.writeText(yangdoContractUrl);
                  toast.success("링크가 복사되었습니다.");
                }}
              >
                <Copy className="h-4 w-4 mr-2" /> 링크 복사
              </Button>
              <Button variant="outline" className="w-full" onClick={() => { setYangdoModalOpen(false); setYangdoContractUrl(""); }}>
                닫기
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {/* 패키지 선택 */}
              {ptPackages && ptPackages.length > 1 && (
                <div className="space-y-1.5">
                  <Label className="text-xs">PT 패키지 선택</Label>
                  <Select
                    value={String(yangdoSelectedPkgId)}
                    onValueChange={(v) => setYangdoSelectedPkgId(Number(v))}
                  >
                    <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="패키지 선택" /></SelectTrigger>
                    <SelectContent>
                      {ptPackages.map((p) => (
                        <SelectItem key={p.id} value={String(p.id)}>
                          {p.packageName || "PT 프로그램"} ({p.totalSessions - p.usedSessions}회 잔여)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* 자동 채움 필드 */}
              {(() => {
                const pkg = ptPackages?.find((p) => p.id === yangdoSelectedPkgId) ?? ptPackages?.[0];
                return pkg ? (
                  <div className="bg-accent/20 rounded-lg p-3 space-y-1.5 text-xs">
                    <div className="flex justify-between"><span className="text-muted-foreground">프로그램명</span><span className="font-medium">{pkg.packageName || "PT 프로그램"}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">총 횟수</span><span className="font-medium">{pkg.totalSessions}회</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">수강 횟수</span><span className="font-medium">{pkg.usedSessions}회</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">잔여 횟수</span><span className="font-medium text-primary">{pkg.totalSessions - pkg.usedSessions}회</span></div>
                  </div>
                ) : null;
              })()}

              {/* 양도 예정일 */}
              <div className="space-y-1.5">
                <Label className="text-xs">양도 예정일</Label>
                <Input
                  type="date"
                  value={yangdoForm.transferDate}
                  onChange={(e) => setYangdoForm((p) => ({ ...p, transferDate: e.target.value }))}
                  className="h-9 text-sm"
                />
              </div>

              {/* 트레이너 메모 */}
              <div className="space-y-1.5">
                <Label className="text-xs">트레이너 메모 (선택)</Label>
                <Textarea
                  rows={3}
                  placeholder="양도 관련 메모를 입력하세요 (선택)"
                  value={yangdoForm.trainerMemo}
                  onChange={(e) => setYangdoForm((p) => ({ ...p, trainerMemo: e.target.value }))}
                  className="text-sm resize-none"
                />
              </div>

              <div className="flex gap-2 pt-1">
                <Button variant="outline" className="flex-1" onClick={() => setYangdoModalOpen(false)}>취소</Button>
                <Button
                  className="flex-1"
                  disabled={createYangdoContractMutation.isPending}
                  onClick={() => {
                    const pkg = ptPackages?.find((p) => p.id === yangdoSelectedPkgId) ?? ptPackages?.[0];
                    if (!pkg || !member) return;
                    const remaining = pkg.totalSessions - pkg.usedSessions;
                    createYangdoContractMutation.mutate({
                      transferorMemberId: member.id,
                      itemType: "pt_package",
                      itemId: pkg.id,
                      itemDescription: `${pkg.packageName || "PT 프로그램"} (잔여 ${remaining}회${yangdoForm.transferDate ? ` · 양도예정일: ${yangdoForm.transferDate}` : ""}${yangdoForm.trainerMemo ? ` · ${yangdoForm.trainerMemo}` : ""})`,
                    });
                  }}
                >
                  {createYangdoContractMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "계약서 생성 및 링크 발급"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
