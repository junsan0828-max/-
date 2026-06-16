import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useLocation } from "wouter";
import { trpc } from "../lib/trpc";
import { toast } from "sonner";
import {
  Plus, Search, Phone, MessageSquare, CheckCircle2,
  Bell, UserCheck, ChevronLeft, ChevronRight, X,
  PenLine, RotateCcw, Printer, Check, FileText, ClipboardList,
} from "lucide-react";

const STATUS_OPTIONS = [
  { value: "consulted",  label: "상담완료", color: "text-blue-400",    bg: "bg-blue-400/10",    icon: MessageSquare },
  { value: "followup",   label: "관리상담", color: "text-purple-400",  bg: "bg-purple-400/10",  icon: Bell },
  { value: "registered", label: "등록완료", color: "text-emerald-400", bg: "bg-emerald-400/10", icon: CheckCircle2 },
];

const CONSULT_TYPES: Record<string, string[]> = {
  "방문상담": [],
  "예약상담": ["플레이스", "전화예약"],
  "소개상담": ["지인소개", "가족소개"],
};
const MAIN_TYPES = Object.keys(CONSULT_TYPES);
const INTEREST_OPTIONS = ["PT", "헬스", "기타"];
const AGE_OPTIONS = ["10대", "20대", "30대", "40대", "50대이상"];
const EXERCISE_PURPOSES = [
  "다이어트 (체중 감량)",
  "체형교정 (자세 개선)",
  "통증 개선 (목/허리/무릎 등)",
  "재활 운동 (병원 진단 후 운동)",
  "근력/체력 향상",
  "바디라인 개선 (근육, 몸매)",
  "건강 관리 (예방 목적)",
  "운동 습관 만들기",
  "기타",
];

const PT_PROGRAMS = ["케어피티", "웨이트피티", "이벤트피티", "기타"];
const PT_SESSIONS = [10, 20, 30, 40, 50];
const DURATIONS = [1, 3, 6, 12];
const PAYMENT_METHODS_REG = ["카드", "현금", "현금영수증", "계좌이체", "지역화폐", "분할결제", "혼합"];
const PAYMENT_METHOD_LABELS: Record<string, string> = {};

type RegForm = {
  itemTypes: string[];     // 복수 선택: PT / 헬스 / 기타
  subType: "신규" | "재등록";
  // PT
  programKey: string;
  programCustom: string;
  sessions?: number;
  serviceSessions?: number;
  // 헬스
  duration?: number;
  // 기타
  otherItem: string;
  // 결제
  amount: string;
  discountAmount: string;
  paidAmount: string;
  unpaidAmount: string;
  paymentMethod: string;
  transferAmount: string;
  cardAmount: string;
  paymentDate: string;
  startDate: string;
  memo: string;
  branchId?: number;
  serviceItems: string[];       // 서비스 제공 항목: PT / 헬스 / 락커 / 운동복
  servicePtCount?: number;      // 서비스 PT 횟수
  serviceHealthMonths?: number; // 서비스 헬스 개월 수
  serviceHealthMonthsCustom: string; // 직접 입력
  serviceLockerNum: string;     // 서비스 락커 번호
};

const defaultRegForm: RegForm = {
  itemTypes: [],
  subType: "신규",
  programKey: "",
  programCustom: "",
  sessions: undefined,
  serviceSessions: undefined,
  duration: undefined,
  otherItem: "",
  amount: "",
  discountAmount: "0",
  paidAmount: "",
  unpaidAmount: "0",
  paymentMethod: "",
  transferAmount: "",
  cardAmount: "",
  paymentDate: new Date().toISOString().substring(0, 10),
  startDate: new Date().toISOString().substring(0, 10),
  memo: "",
  branchId: undefined,
  serviceItems: [],
  servicePtCount: undefined,
  serviceHealthMonths: undefined,
  serviceHealthMonthsCustom: "",
  serviceLockerNum: "",
};

type LeadForm = {
  name: string; phone: string; gender: string; ageGroup: string;
  channelId?: number; assignedTrainerId?: number; assignedConsultantId?: number;
  consultationDate: string;
  consultationTypes: string[];    // 대분류 복수 선택
  consultationSubTypes: string[]; // 소분류 복수 선택
  consultationNote: string;
  interestType: string;
  exercisePurposes: string[];
  memo: string;
};

const defaultForm: LeadForm = {
  name: "", phone: "", gender: "", ageGroup: "",
  consultationDate: new Date().toISOString().substring(0, 10),
  consultationTypes: [], consultationSubTypes: [],
  consultationNote: "", interestType: "", exercisePurposes: [], memo: "",
  assignedTrainerId: undefined, assignedConsultantId: undefined,
};

function calcEndDate(start: string, sessions: string): string {
  if (!start || !sessions) return "";
  const n = parseInt(sessions);
  if (!n) return "";
  const d = new Date(start);
  d.setDate(d.getDate() + Math.round(n / 2) * 7);
  return d.toISOString().substring(0, 10);
}

const CONTRACT_TERMS = `제1조 (목적)
본 약관은 자이언트짐(이하 "센터")이 제공하는 피트니스 서비스 이용에 관한 제반 사항을 규정함을 목적으로 합니다.

제2조 (회원의 의무)
① 회원은 센터의 시설 및 기구를 타인에게 피해가 가지 않도록 올바르게 사용하여야 합니다.
② 회원은 센터 내에서 타인을 방해하거나 불쾌감을 주는 행위를 하여서는 안 됩니다.
③ 운동 후 사용한 기구는 반드시 제자리에 정리하여야 합니다.
④ 센터 내 음식물 반입은 허용되지 않으며, 음료는 개인 물병만 허용합니다.

제3조 (이용 시간 및 시설)
① 센터의 운영 시간은 별도 공지에 따릅니다.
② 회원은 운영 시간 내에만 센터를 이용할 수 있습니다.
③ 공휴일 및 센터 사정에 따라 운영 시간이 변경될 수 있으며, 이 경우 사전에 공지합니다.

제4조 (이용권 및 환불)
① PT 이용권은 계약 시작일로부터 효력이 발생합니다.
② 이용권의 환불은 관련 법령 및 센터 환불 규정에 따릅니다.
③ 회원 개인 사정으로 인한 중도 해지 시 잔여 횟수에 따라 환불이 이루어집니다.
④ 부상·질병 등 불가피한 사유가 있을 경우 이용 정지 신청이 가능합니다.

제5조 (면책 조항)
① 센터는 회원이 센터 내에서 발생한 사고에 대해 센터의 과실이 없는 경우 책임을 지지 않습니다.
② 개인 소지품 분실에 대해 센터는 책임을 지지 않습니다.
③ 회원은 자신의 건강 상태를 정확히 고지하여야 하며, 허위 고지로 인한 문제는 회원 본인이 책임집니다.

제6조 (회원 자격 박탈)
다음 각 호에 해당하는 경우 센터는 회원 자격을 박탈할 수 있습니다.
① 타인에게 폭언·폭행 등 위해를 가한 경우
② 센터 시설물을 고의로 파손한 경우
③ 본 약관을 위반한 경우`;

const PRIVACY_TERMS = `수집하는 개인정보 항목
- 필수항목: 성명, 연락처, 성별, 생년월일
- 선택항목: 이메일 주소, 건강 정보(운동 목적, 부상 이력 등)

개인정보의 수집 및 이용 목적
① 피트니스 서비스 제공 및 회원 관리
② PT 프로그램 안내 및 일정 관리
③ 결제 및 환불 처리
④ 고객 상담 및 민원 처리
⑤ 서비스 개선을 위한 통계 분석

개인정보의 보유 및 이용 기간
- 회원 탈퇴 시 또는 이용 목적 달성 후 즉시 파기
- 단, 관련 법령에 따라 보존 의무가 있는 경우 해당 기간 보관

개인정보의 제3자 제공
- 원칙적으로 외부에 제공하지 않으며, 다음의 경우에 한해 제공합니다.
  · 법령의 규정에 의한 경우
  · 이용자가 사전에 동의한 경우

개인정보의 파기
- 개인정보 보유 기간의 경과 또는 목적 달성 후 지체없이 파기
- 전자적 파일: 복구 불가능한 방법으로 영구 삭제
- 종이 문서: 분쇄 또는 소각

귀하는 개인정보 제공에 동의하지 않을 권리가 있습니다.
단, 동의 거부 시 정상적인 서비스 이용이 제한될 수 있습니다.`;

const MARKETING_TERMS = `광고성 정보 수신 및 활용 동의 (선택)

수집 항목: 성명, 연락처, 이메일

이용 목적
① 신규 프로그램 및 이벤트 안내
② 할인 혜택 및 프로모션 정보 제공
③ 센터 소식 및 뉴스레터 발송

광고성 정보 발송 채널
- 문자메시지(SMS/MMS), 카카오 알림톡, 이메일

보유 및 이용 기간
- 동의일로부터 회원 탈퇴 또는 수신 거부 시까지

수신 거부 안내
- 언제든지 센터에 수신 거부 의사를 표시하거나 발송된 문자/이메일 하단의 수신 거부 링크를 통해 거부할 수 있습니다.
- 수신 거부 후에도 서비스 이용에는 제한이 없습니다.

귀하는 광고성 정보 수신에 동의하지 않아도 센터 이용에 아무런 불이익이 없습니다.`;

export default function LeadsPage() {
  const utils = trpc.useUtils();
  const { data: me } = trpc.auth.me.useQuery();
  const isSubAdmin = me?.role === "sub_admin";
  const isTrainer = me?.role === "trainer";
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [editStatus, setEditStatus] = useState<string>("");
  const [editHasSig, setEditHasSig] = useState(false); // 수정 중인 리드에 서명이 있는지
  const [form, setForm] = useState<LeadForm>(defaultForm);
  const [showContract, setShowContract] = useState(false);
  const [sigContext, setSigContext] = useState<"lead" | "direct" | "rereg" | null>(null);
  const [contractDisplayForm, setContractDisplayForm] = useState<RegForm>(defaultRegForm);
  const [agreedTerms, setAgreedTerms] = useState(false);
  const [agreedPrivacy, setAgreedPrivacy] = useState(false);
  const [agreedMarketing, setAgreedMarketing] = useState(false);
  const [showSignature, setShowSignature] = useState(false);
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
  const [showSignedContract, setShowSignedContract] = useState(false);
  const [showRegistration, setShowRegistration] = useState(false);
  const [regForm, setRegForm] = useState<RegForm>(defaultRegForm);
  const regPendingRef = useRef<RegForm | null>(null);
  const pendingEditIdRef = useRef<number | null>(null);
  const [editingRevenueId, setEditingRevenueId] = useState<number | null>(null);

  // 바로등록 모달
  const [statDetailModal, setStatDetailModal] = useState<string | null>(null);

  const [showDirectReg, setShowDirectReg] = useState(false);
  const [showRegModeSelect, setShowRegModeSelect] = useState(false);
  const [directRegMode, setDirectRegMode] = useState<null | "재등록">(null);
  const [reRegSearch, setReRegSearch] = useState("");
  const [reRegMemberId, setReRegMemberId] = useState<number | null>(null);
  const defaultReRegForm = {
    membershipStart: "", membershipEnd: "",
    programTypes: [] as string[],
    ptProgram: "", ptSessions: "", serviceSessions: "", serviceSessionPrice: "",
    healthDuration: "" as string,
    healthServiceDays: "",
    otherItem: "",
    paymentAmount: "", unpaidAmount: "",
    paymentMethod: "" as "" | "현금영수증" | "이체" | "지역화폐" | "카드" | "혼합",
    paymentDate: "", paymentMemo: "",
    branchId: "" as string,
  };
  const [reRegForm, setReRegForm] = useState(defaultReRegForm);
  const defaultDirectForm = {
    name: "", phone: "", birthDate: "", gender: "" as "" | "male" | "female" | "other",
    grade: "basic" as "basic" | "vip", status: "active" as "active" | "paused",
    visitRoute: "", profileNote: "", trainerId: "",
    membershipStart: "", membershipEnd: "",
    programTypes: [] as string[],  // ["PT", "헬스", "기타"]
    ptProgram: "",                  // 케어피티, 웨이트피티, 이벤트피티, 직접입력
    ptSessions: "", serviceSessions: "", serviceSessionPrice: "",
    healthDuration: "" as string,
    healthServiceDays: "",
    otherItem: "",
    paymentAmount: "", unpaidAmount: "",
    paymentMethod: "" as "" | "현금영수증" | "이체" | "지역화폐" | "카드" | "혼합",
    paymentDate: "", paymentMemo: "",
    branchId: "" as string,
  };
  const [directForm, setDirectForm] = useState(defaultDirectForm);

  const { data: leadsData, isLoading } = trpc.gym.leads.list.useQuery({ year, month });
  const { data: channels } = trpc.gym.channels.list.useQuery();
  const { data: trainers } = trpc.trainers.list.useQuery();
  const { data: consultants } = trpc.admin.listConsultants.useQuery();
  const { data: branchList } = trpc.gym.staff.listBranches.useQuery();
  const { data: allLockers } = trpc.access.getLockers.useQuery();
  const { data: gymSettings } = trpc.gym.settings.get.useQuery();
  const { data: ptEvents } = trpc.eventPrograms.list.useQuery({ type: "PT", activeOnly: true });
  const [showEventPicker, setShowEventPicker] = useState<"reReg" | "direct" | null>(null);

  const directLeadMutation = trpc.gym.leads.create.useMutation({
    onSuccess: () => { utils.gym.leads.invalidate(); },
  });

  const directRegMutation = trpc.members.create.useMutation({
    onSuccess: (data) => {
      toast.success("회원이 등록되었습니다.");
      setShowDirectReg(false);
      setDirectForm(defaultDirectForm);
    },
    onError: (e) => toast.error(e.message || "등록 실패"),
  });

  const { data: allMembersList } = trpc.members.list.useQuery();

  const filteredReRegMembers = useMemo(() => {
    const all = allMembersList ?? [];
    const q = reRegSearch.trim().toLowerCase();
    const qDigits = q.replace(/\D/g, "");
    const matched = q
      ? all.filter(m =>
          (m.name ?? "").toLowerCase().includes(q) ||
          (qDigits.length > 0 && (m.phone ?? "").replace(/\D/g, "").includes(qDigits))
        )
      : all;
    return [...matched].sort((a, b) => {
      if (!q) return (a.name ?? "").localeCompare(b.name ?? "", "ko");
      const aN = (a.name ?? "").toLowerCase();
      const bN = (b.name ?? "").toLowerCase();
      if (aN === q && bN !== q) return -1;
      if (bN === q && aN !== q) return 1;
      if (aN.includes(q) && !bN.includes(q)) return -1;
      if (bN.includes(q) && !aN.includes(q)) return 1;
      return aN.localeCompare(bN, "ko");
    });
  }, [allMembersList, reRegSearch]);

  const reRegUpdateMutation = trpc.members.update.useMutation({
    onSuccess: () => {},
    onError: (e) => toast.error(e.message || "회원 정보 업데이트 실패"),
  });

  const reRegAddPackageMutation = trpc.pt.addPackage.useMutation({
    onSuccess: () => {
      toast.success("재등록이 완료되었습니다.");
      setDirectRegMode(null);
      setReRegMemberId(null);
      setReRegSearch("");
      setReRegForm(defaultReRegForm);
    },
    onError: (e) => toast.error(e.message || "패키지 추가 실패"),
  });

  const createRevenueMutation = trpc.gym.revenue.create.useMutation({
    onSuccess: () => { toast.success("등록 완료 및 매출 저장"); utils.gym.leads.invalidate(); utils.gym.revenue.invalidate(); resetForm(); },
    onError: (e) => { toast.error("매출 저장 실패: " + e.message); resetForm(); },
  });

  const updateRevenueMutation = trpc.gym.revenue.update.useMutation({
    onSuccess: () => { toast.success("등록 내용이 수정되었습니다"); utils.gym.leads.invalidate(); utils.gym.revenue.invalidate(); resetForm(); },
    onError: (e) => toast.error("수정 실패: " + e.message),
  });

  // 매출 항목 조회 (등록 수정용) — editId 있으면 항상 조회
  const { data: existingRevenue } = trpc.gym.revenue.byLead.useQuery(
    { leadId: editId ?? 0 },
    { enabled: !!editId }
  );

  const createMutation = trpc.gym.leads.create.useMutation({
    onSuccess: (data) => {
      if (regPendingRef.current) {
        const reg = regPendingRef.current;
        regPendingRef.current = null;
        fireRevenueSave(reg, data.id);
      } else {
        toast.success("상담이 등록되었습니다"); utils.gym.leads.invalidate(); resetForm();
      }
    },
    onError: (e) => { regPendingRef.current = null; toast.error(e.message); },
  });
  const updateMutation = trpc.gym.leads.update.useMutation({
    onSuccess: (data) => {
      if (regPendingRef.current) {
        const reg = regPendingRef.current;
        regPendingRef.current = null;
        fireRevenueSave(reg, data.id);
      } else {
        toast.success("수정되었습니다"); utils.gym.leads.invalidate(); resetForm();
      }
    },
    onError: (e) => { regPendingRef.current = null; toast.error(e.message); },
  });
  const deleteMutation = trpc.gym.leads.delete.useMutation({
    onSuccess: () => { toast.success("삭제되었습니다"); utils.gym.leads.invalidate(); },
  });

  function resetForm() {
    setShowForm(false); setEditId(null); setEditStatus(""); setEditHasSig(false); setForm(defaultForm);
    setShowContract(false); setAgreedTerms(false); setAgreedPrivacy(false); setAgreedMarketing(false);
    setShowSignature(false); setSignatureDataUrl(null); setShowSignedContract(false);
    setShowRegistration(false); setRegForm(defaultRegForm); setEditingRevenueId(null);
    regPendingRef.current = null; pendingEditIdRef.current = null;
  }

  function openContract() {
    if (!form.name.trim()) return toast.error("이름을 입력해주세요");
    setAgreedTerms(false); setAgreedPrivacy(false); setAgreedMarketing(false);
    setShowContract(true);
  }

  function openDirectSig() {
    if (!directForm.name.trim()) return toast.error("이름을 입력해주세요.");
    const isPT = directForm.programTypes.includes("PT");
    const isHealth = directForm.programTypes.includes("헬스");
    const isOther = directForm.programTypes.includes("기타");
    setContractDisplayForm({
      itemTypes: directForm.programTypes,
      subType: "신규",
      programKey: directForm.ptProgram || "",
      programCustom: "",
      sessions: isPT && directForm.ptSessions ? parseInt(directForm.ptSessions) : undefined,
      serviceSessions: isPT && directForm.serviceSessions ? parseInt(directForm.serviceSessions) : undefined,
      duration: isHealth && directForm.healthDuration ? parseInt(directForm.healthDuration) : undefined,
      otherItem: directForm.otherItem || "",
      amount: directForm.paymentAmount,
      discountAmount: "0",
      paidAmount: directForm.paymentAmount,
      unpaidAmount: directForm.unpaidAmount || "0",
      paymentMethod: directForm.paymentMethod || "",
      paymentDate: directForm.paymentDate || new Date().toISOString().substring(0, 10),
      startDate: directForm.membershipStart || new Date().toISOString().substring(0, 10),
      memo: directForm.paymentMemo || "",
      branchId: directForm.branchId ? parseInt(directForm.branchId) : undefined,
      transferAmount: "",
      cardAmount: "",
      serviceItems: [],
      servicePtCount: undefined,
      serviceHealthMonths: undefined,
      serviceHealthMonthsCustom: "",
      serviceLockerNum: "",
    });
    setSigContext("direct");
    setSignatureDataUrl(null);
    setShowSignature(true);
  }

  function openReRegSig() {
    if (!reRegMemberId) return;
    if (!reRegForm.programTypes.includes("PT") && !reRegForm.programTypes.includes("헬스") && !reRegForm.programTypes.includes("기타")) {
      return toast.error("프로그램을 선택해주세요.");
    }
    const isPT = reRegForm.programTypes.includes("PT");
    const isHealth = reRegForm.programTypes.includes("헬스");
    setContractDisplayForm({
      itemTypes: reRegForm.programTypes,
      subType: "재등록",
      programKey: reRegForm.ptProgram || "",
      programCustom: "",
      sessions: isPT && reRegForm.ptSessions ? parseInt(reRegForm.ptSessions) : undefined,
      serviceSessions: isPT && reRegForm.serviceSessions ? parseInt(reRegForm.serviceSessions) : undefined,
      duration: isHealth && reRegForm.healthDuration ? parseInt(reRegForm.healthDuration) : undefined,
      otherItem: reRegForm.otherItem || "",
      amount: reRegForm.paymentAmount,
      discountAmount: "0",
      paidAmount: reRegForm.paymentAmount,
      unpaidAmount: reRegForm.unpaidAmount || "0",
      paymentMethod: reRegForm.paymentMethod || "",
      paymentDate: reRegForm.paymentDate || new Date().toISOString().substring(0, 10),
      startDate: reRegForm.membershipStart || new Date().toISOString().substring(0, 10),
      memo: reRegForm.paymentMemo || "",
      branchId: reRegForm.branchId ? parseInt(reRegForm.branchId) : undefined,
      transferAmount: "",
      cardAmount: "",
      serviceItems: [],
      servicePtCount: undefined,
      serviceHealthMonths: undefined,
      serviceHealthMonthsCustom: "",
      serviceLockerNum: "",
    });
    setSigContext("rereg");
    setSignatureDataUrl(null);
    setShowSignature(true);
  }

  function openRegEdit(revenue: any) {
    if (!revenue) return toast.error("등록된 매출 내역이 없습니다");
    const si = (revenue.serviceItems ?? "").split(",").filter(Boolean) as string[];
    const siCategories = si.map((s: string) =>
      s.startsWith("PT") ? "PT" : s.startsWith("헬스") ? "헬스" : s.startsWith("락커") ? "락커" : s.startsWith("운동복") ? "운동복" : s
    );
    const servicePtMatch = si.find((s: string) => s.startsWith("PT("))?.match(/PT\((\d+)회\)/);
    const serviceHealthMatch = si.find((s: string) => s.startsWith("헬스("))?.match(/헬스\((\d+)개월\)/);
    const serviceLockerMatch = si.find((s: string) => s.startsWith("락커("))?.match(/락커\(([^)]+)\)/);

    const knownPrograms = ["케어피티", "웨이트피티", "이벤트피티"];
    const detectedKey = knownPrograms.find(k => (revenue.programDetail ?? "") === k || (revenue.programDetail ?? "").startsWith(k + " ") || (revenue.programDetail ?? "").startsWith(k + "+")) ?? "기타";
    setRegForm({
      ...defaultRegForm,
      itemTypes: [revenue.type as string],
      subType: (revenue.subType ?? "신규") as "신규" | "재등록",
      programKey: detectedKey,
      programCustom: detectedKey === "기타" ? (revenue.programDetail ?? "") : "",
      sessions: revenue.sessions ?? undefined,
      serviceSessions: revenue.serviceSessions ?? 0,
      duration: revenue.duration ?? undefined,
      amount: String(revenue.amount ?? ""),
      discountAmount: String(revenue.discountAmount ?? "0"),
      paidAmount: String(revenue.paidAmount ?? ""),
      unpaidAmount: String(revenue.unpaidAmount ?? "0"),
      paymentMethod: (revenue.paymentMethod ?? "") as any,
      paymentDate: revenue.paymentDate ?? new Date().toISOString().substring(0, 10),
      startDate: revenue.startDate ?? "",
      memo: revenue.memo ?? "",
      branchId: revenue.branchId ?? undefined,
      serviceItems: siCategories,
      servicePtCount: servicePtMatch ? parseInt(servicePtMatch[1]) : undefined,
      serviceHealthMonths: serviceHealthMatch ? parseInt(serviceHealthMatch[1]) : undefined,
      serviceLockerNum: serviceLockerMatch ? serviceLockerMatch[1] : "",
    });
    setEditingRevenueId(revenue.id);
    setShowForm(false);
    setShowRegistration(true);
  }

  function confirmRegistration() {
    if (!agreedTerms) return toast.error("이용약관에 동의해주세요");
    if (!agreedPrivacy) return toast.error("개인정보 수집·이용에 동의해주세요");
    setShowContract(false);
    const preTypes = (form.interestType === "PT" || form.interestType === "헬스" || form.interestType === "기타")
      ? [form.interestType] : [];
    setRegForm({
      ...defaultRegForm,
      itemTypes: preTypes,
      paymentDate: new Date().toISOString().substring(0, 10),
      startDate: new Date().toISOString().substring(0, 10),
    });
    setShowRegistration(true);
  }

  function requestSignature() {
    const reg = regForm;
    if (reg.itemTypes.length === 0) return toast.error("항목 유형을 선택해주세요");
    if (reg.itemTypes.includes("PT") && !reg.programKey) return toast.error("PT 프로그램을 선택해주세요");
    if (reg.itemTypes.includes("PT") && !reg.sessions) return toast.error("PT 횟수를 선택해주세요");
    if (reg.itemTypes.includes("헬스") && !reg.duration) return toast.error("헬스 이용 기간을 선택해주세요");
    if (reg.itemTypes.includes("기타") && !reg.otherItem) return toast.error("기타 항목을 선택해주세요");
    const amount = Number(reg.amount);
    if (!amount) return toast.error("금액을 입력해주세요");
    if (!reg.paymentMethod) return toast.error("결제 방법을 선택해주세요");
    if (!reg.paymentDate) return toast.error("결제일을 입력해주세요");
    setShowRegistration(false);
    setShowSignature(true);
  }

  function proceedAfterSignature(sigDataUrl: string) {
    setSignatureDataUrl(sigDataUrl);
    setShowSignature(false);
    setShowSignedContract(true);
  }

  function proceedToSave() {
    setShowSignedContract(false);
    const sig = signatureDataUrl;
    const ctx = sigContext;
    setSigContext(null);

    if (ctx === "direct") {
      const f = directForm;
      const isPT = f.programTypes.includes("PT");
      const isHealth = f.programTypes.includes("헬스");
      const isOther = f.programTypes.includes("기타");
      const parts: string[] = [];
      if (isPT && f.ptProgram) parts.push(f.ptProgram);
      if (isHealth && f.healthDuration) parts.push(`헬스 ${f.healthDuration}개월`);
      if (isOther && f.otherItem) parts.push(f.otherItem);
      directRegMutation.mutate({
        name: f.name.trim(),
        phone: f.phone || undefined,
        birthDate: f.birthDate || undefined,
        gender: f.gender || undefined,
        grade: f.grade,
        status: f.status,
        visitRoute: f.visitRoute || undefined,
        profileNote: f.profileNote || undefined,
        membershipStart: f.membershipStart || undefined,
        membershipEnd: f.membershipEnd || undefined,
        ptProgram: parts.length > 0 ? parts.join(" + ") : undefined,
        ptSessions: isPT ? (f.ptSessions || undefined) : undefined,
        serviceSessions: isPT && f.serviceSessions ? parseInt(f.serviceSessions) : undefined,
        serviceSessionPrice: isPT && f.serviceSessionPrice ? parseInt(f.serviceSessionPrice) : undefined,
        paymentAmount: f.paymentAmount ? parseInt(f.paymentAmount) : undefined,
        unpaidAmount: f.unpaidAmount ? parseInt(f.unpaidAmount) : undefined,
        paymentMethod: f.paymentMethod || undefined,
        paymentDate: f.paymentDate || undefined,
        paymentMemo: f.paymentMemo || undefined,
        adminTrainerId: f.trainerId ? parseInt(f.trainerId) : undefined,
        branchId: f.branchId ? parseInt(f.branchId) : undefined,
        subType: "신규" as const,
        primaryType: isPT ? "PT" : isHealth ? "헬스" : isOther ? "기타" : undefined,
        signatureDataUrl: sig || undefined,
      });
      // 상담 CRM에도 등록완료 리드 생성
      directLeadMutation.mutate({
        name: f.name.trim(),
        phone: f.phone || undefined,
        gender: f.gender || undefined,
        status: "registered",
        consultationDate: f.paymentDate || new Date().toISOString().substring(0, 10),
        interestType: isPT ? "PT" : isHealth ? "헬스" : isOther ? "기타" : undefined,
        signatureDataUrl: sig || undefined,
        memo: f.paymentMemo || undefined,
        branchId: f.branchId ? parseInt(f.branchId) : undefined,
      });
      return;
    }

    if (ctx === "rereg") {
      if (!reRegMemberId) return;
      const f = reRegForm;
      const isPT = f.programTypes.includes("PT");
      const selectedMem = (allMembersList ?? []).find(m => m.id === reRegMemberId);
      reRegUpdateMutation.mutateAsync({
        id: reRegMemberId,
        name: selectedMem?.name ?? "",
        membershipStart: f.membershipStart || undefined,
        membershipEnd: f.membershipEnd || undefined,
        status: "active",
        signatureDataUrl: sig || undefined,
      }).then(() => {
        if (isPT && f.ptSessions) {
          reRegAddPackageMutation.mutate({
            memberId: reRegMemberId!,
            ptProgram: f.ptProgram || undefined,
            totalSessions: parseInt(f.ptSessions),
            serviceSessions: f.serviceSessions ? parseInt(f.serviceSessions) : undefined,
            serviceSessionPrice: f.serviceSessionPrice ? parseInt(f.serviceSessionPrice) : undefined,
            startDate: f.membershipStart || undefined,
            expiryDate: f.membershipEnd || undefined,
            paymentAmount: f.paymentAmount ? parseInt(f.paymentAmount) : undefined,
            unpaidAmount: f.unpaidAmount ? parseInt(f.unpaidAmount) : undefined,
            paymentMethod: f.paymentMethod || undefined,
            paymentDate: f.paymentDate || undefined,
            paymentMemo: f.paymentMemo || undefined,
          });
        } else {
          toast.success("재등록이 완료되었습니다.");
          setDirectRegMode(null);
          setReRegMemberId(null);
          setReRegSearch("");
          setReRegForm(defaultReRegForm);
        }
      });
      return;
    }

    // lead flow (default)
    regPendingRef.current = regForm;
    handleSave("registered");
  }

  function fireRevenueSave(reg: RegForm, leadId: number) {
    // 대표 type: PT 있으면 PT, 없으면 헬스, 없으면 기타
    const primary = reg.itemTypes.includes("PT") ? "PT"
      : reg.itemTypes.includes("헬스") ? "헬스" : "기타";

    // programDetail: 선택된 항목들 조합
    const parts: string[] = [];
    if (reg.itemTypes.includes("PT") && reg.programKey) {
      parts.push(reg.programKey === "기타" ? (reg.programCustom || "기타PT") : reg.programKey);
    }
    if (reg.itemTypes.includes("헬스") && reg.duration) {
      parts.push(`헬스 ${reg.duration}개월`);
    }
    if (reg.itemTypes.includes("기타") && reg.otherItem) {
      parts.push(reg.otherItem);
    }

    createRevenueMutation.mutate({
      leadId,
      customerName: form.name,
      phone: form.phone || undefined,
      type: primary as "PT" | "헬스" | "기타",
      subType: reg.subType,
      programDetail: parts.length > 0 ? parts.join(" + ") : undefined,
      sessions: reg.itemTypes.includes("PT") ? reg.sessions : undefined,
      serviceSessions: reg.itemTypes.includes("PT") ? (reg.serviceSessions ?? 0) : undefined,
      duration: reg.itemTypes.includes("헬스") ? reg.duration : undefined,
      amount: Number(reg.amount) || 0,
      discountAmount: Number(reg.discountAmount) || 0,
      paidAmount: Number(reg.paidAmount) || 0,
      unpaidAmount: Number(reg.unpaidAmount) || 0,
      paymentMethod: reg.paymentMethod || undefined,
      paymentDate: reg.paymentDate,
      startDate: reg.startDate || undefined,
      memo: reg.memo || undefined,
      trainerId: form.assignedTrainerId ?? undefined,
      consultantId: form.assignedConsultantId ?? undefined,
      branchId: reg.branchId ?? undefined,
      serviceItems: reg.serviceItems.length > 0 ? reg.serviceItems.map(item => {
        if (item === "PT" && reg.servicePtCount) return `PT(${reg.servicePtCount}회)`;
        if (item === "헬스") {
          const months = reg.serviceHealthMonths ?? (reg.serviceHealthMonthsCustom ? parseInt(reg.serviceHealthMonthsCustom) : undefined);
          return months ? `헬스(${months}개월)` : "헬스";
        }
        if (item === "락커" && reg.serviceLockerNum) return `락커(${reg.serviceLockerNum})`;
        return item;
      }).join(",") : undefined,
    });
  }

  function saveRegistration() {
    requestSignature();
  }

  function openEdit(row: any) {
    setEditId(row.lead.id);
    setEditStatus(row.lead.status ?? "");
    setEditHasSig(!!row.lead.signatureDataUrl);
    setForm({
      name: row.lead.name,
      phone: row.lead.phone ?? "",
      gender: row.lead.gender ?? "",
      ageGroup: row.lead.ageGroup ?? "",
      channelId: row.lead.channelId ?? undefined,
      assignedTrainerId: row.lead.assignedTrainerId ?? undefined,
      assignedConsultantId: row.lead.assignedConsultantId ?? undefined,
      consultationDate: row.lead.consultationDate ?? new Date().toISOString().substring(0, 10),
      consultationTypes: row.lead.consultationType ? row.lead.consultationType.split(",").filter(Boolean) : [],
      consultationSubTypes: row.lead.consultationSubTypes ? row.lead.consultationSubTypes.split(",").filter(Boolean) : [],
      consultationNote: row.lead.consultationNote ?? "",
      interestType: row.lead.interestType ?? "",
      exercisePurposes: row.lead.exercisePurpose ? row.lead.exercisePurpose.split(",").filter(Boolean) : [],
      memo: row.lead.memo ?? "",
    });
    setShowForm(true);
  }

  function toggleMainType(type: string) {
    setForm(f => {
      const exists = f.consultationTypes.includes(type);
      const newTypes = exists ? f.consultationTypes.filter(t => t !== type) : [...f.consultationTypes, type];
      // 선택 해제된 대분류의 소분류는 제거
      const validSubs = newTypes.flatMap(t => CONSULT_TYPES[t] ?? []);
      return { ...f, consultationTypes: newTypes, consultationSubTypes: f.consultationSubTypes.filter(s => validSubs.includes(s)) };
    });
  }

  function toggleSubType(sub: string) {
    setForm(f => {
      const exists = f.consultationSubTypes.includes(sub);
      return { ...f, consultationSubTypes: exists ? f.consultationSubTypes.filter(s => s !== sub) : [...f.consultationSubTypes, sub] };
    });
  }

  function handleSave(status: string) {
    if (!form.name.trim()) return toast.error("이름을 입력해주세요");
    const payload = {
      name: form.name,
      phone: form.phone || undefined,
      gender: form.gender || undefined,
      ageGroup: form.ageGroup || undefined,
      channelId: form.channelId,
      assignedTrainerId: form.assignedTrainerId,
      assignedConsultantId: form.assignedConsultantId,
      consultationDate: form.consultationDate || undefined,
      consultationType: form.consultationTypes.length > 0 ? form.consultationTypes.join(",") : undefined,
      consultationSubTypes: form.consultationSubTypes.length > 0 ? form.consultationSubTypes.join(",") : undefined,
      consultationNote: form.consultationNote || undefined,
      interestType: form.interestType || undefined,
      exercisePurpose: form.exercisePurposes.length > 0 ? form.exercisePurposes.join(",") : undefined,
      memo: form.memo || undefined,
      signatureDataUrl: signatureDataUrl || undefined,
      status,
    };
    if (editId) updateMutation.mutate({ id: editId, ...payload });
    else createMutation.mutate(payload);
  }

  function prevMonth() {
    if (month === 1) { setYear(y => y - 1); setMonth(12); }
    else setMonth(m => m - 1);
  }
  function nextMonth() {
    if (month === 12) { setYear(y => y + 1); setMonth(1); }
    else setMonth(m => m + 1);
  }

  const filtered = (leadsData ?? []).filter(row => {
    const q = search.toLowerCase();
    const matchSearch = !q || row.lead.name.toLowerCase().includes(q) || (row.lead.phone ?? "").includes(q);
    return matchSearch;
  });

  // 월별 통계
  const statCounts = STATUS_OPTIONS.map(s => ({
    ...s,
    count: (leadsData ?? []).filter(r => r.lead.status === s.value).length,
  }));
  const total = (leadsData ?? []).length;
  const registered = (leadsData ?? []).filter(r => r.lead.status === "registered").length;
  const conversionRate = total > 0 ? Math.round((registered / total) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-foreground">상담 CRM</h1>
          <p className="text-xs text-muted-foreground">월별 상담 및 전환 관리</p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => {
              setShowForm(true); setEditId(null);
              setForm({
                ...defaultForm,
                consultationDate: new Date().toISOString().substring(0, 10),
                assignedTrainerId: isTrainer ? me?.trainerId ?? undefined : undefined,
              });
            }}
            className="flex items-center gap-1 bg-primary text-primary-foreground px-2.5 py-2 rounded-lg text-sm font-medium hover:bg-primary/90"
          >
            <Plus className="h-4 w-4 shrink-0" />
            <span className="hidden xs:inline">상담 </span>추가
          </button>
        </div>
      </div>

      {/* 월 선택 */}
      <div className="flex items-center justify-center gap-3 bg-card border border-border rounded-xl px-4 py-3">
        <button onClick={prevMonth} className="text-muted-foreground hover:text-foreground">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <span className="text-base font-semibold text-foreground min-w-[100px] text-center">{year}년 {month}월</span>
        <button onClick={nextMonth} className="text-muted-foreground hover:text-foreground">
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-3 gap-2">
        {statCounts.map(s => (
          <button key={s.value} onClick={() => setStatDetailModal(s.value)}
            className={`rounded-xl p-3 border transition-all text-center bg-card border-border hover:border-primary/30`}>
            <div className={`text-lg font-bold ${s.color}`}>{s.count}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{s.label}</div>
          </button>
        ))}
      </div>

      {/* 전환율 */}
      {total > 0 && (
        <div className="bg-card border border-border rounded-xl p-3 flex items-center justify-between">
          <span className="text-sm text-muted-foreground">이번달 전환율</span>
          <div className="flex items-center gap-3">
            <div className="w-32 bg-muted rounded-full h-2">
              <div className="h-2 rounded-full bg-emerald-500" style={{ width: `${conversionRate}%` }} />
            </div>
            <span className="text-sm font-bold text-emerald-400">{conversionRate}%</span>
          </div>
        </div>
      )}

      {/* 검색 */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="이름, 전화번호 검색..."
          className="w-full bg-card border border-border rounded-lg pl-9 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
      </div>

      {/* 목록 */}
      {isLoading ? (
        <div className="text-center text-muted-foreground py-8">로딩 중...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center text-muted-foreground py-12">
          <UserCheck className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">이 달 상담 내역이 없습니다</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(row => {
            const s = STATUS_OPTIONS.find(s => s.value === row.lead.status);
            const mainTypes = row.lead.consultationType ? row.lead.consultationType.split(",").filter(Boolean) : [];
            const subTypes = row.lead.consultationSubTypes ? row.lead.consultationSubTypes.split(",").filter(Boolean) : [];
            return (
              <div key={row.lead.id} onClick={() => openEdit(row)}
                className="bg-card border border-border rounded-xl p-4 space-y-2 cursor-pointer hover:border-primary/30 transition-colors">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground">{row.lead.name}</span>
                      {row.lead.gender && <span className="text-xs text-muted-foreground">{row.lead.gender}</span>}
                      {row.lead.ageGroup && <span className="text-xs text-muted-foreground">{row.lead.ageGroup}</span>}
                    </div>
                    {row.lead.phone && (
                      <div className="flex items-center gap-1 mt-0.5">
                        <Phone className="h-3 w-3 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">{row.lead.phone}</span>
                      </div>
                    )}
                  </div>
                  <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${s?.bg} ${s?.color}`}>
                    {s && <s.icon className="h-3 w-3" />}
                    {s?.label}
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5 text-xs">
                  {mainTypes.map(mt => (
                    <span key={mt} className="bg-primary/10 text-primary px-2 py-0.5 rounded-full">{mt}</span>
                  ))}
                  {subTypes.map(st => (
                    <span key={st} className="bg-muted text-muted-foreground px-2 py-0.5 rounded-full">{st}</span>
                  ))}
                  {row.lead.interestType && (
                    <span className="bg-amber-400/10 text-amber-400 px-2 py-0.5 rounded-full">{row.lead.interestType}</span>
                  )}
                  {row.channelName && (
                    <span className="bg-muted text-muted-foreground px-2 py-0.5 rounded-full">{row.channelName}</span>
                  )}
                  {(row.trainerName || (row as any).consultantName) && (
                    <span className="bg-violet-500/10 text-violet-400 px-2 py-0.5 rounded-full">
                      {row.trainerName || (row as any).consultantName}
                    </span>
                  )}
                </div>
                {row.lead.consultationNote && (
                  <p className="text-xs text-muted-foreground line-clamp-2">{row.lead.consultationNote}</p>
                )}
                {(row as any).serviceItems && (row as any).serviceItems.split(",").filter(Boolean).length > 0 && (
                  <div className="flex gap-1 flex-wrap">
                    {(row as any).serviceItems.split(",").filter(Boolean).map((item: string) => {
                      const badgeStyle = item === "PT" ? "bg-blue-500/20 text-blue-400"
                        : item === "헬스" ? "bg-emerald-500/20 text-emerald-400"
                        : item === "락커" ? "bg-amber-500/20 text-amber-400"
                        : "bg-purple-500/20 text-purple-400";
                      return (
                        <span key={item} className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${badgeStyle}`}>
                          🎁 서비스 {item}
                        </span>
                      );
                    })}
                  </div>
                )}
                {row.lead.status === "registered" && (
                  <ContractPdfButton lead={row.lead} />
                )}
                {row.lead.status === "registered" && row.lead.interestType === "PT" && (
                  <ParQButton lead={row.lead} />
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 통계 카드 세부내역 모달 */}
      {statDetailModal && (() => {
        const s = STATUS_OPTIONS.find(s => s.value === statDetailModal)!;
        const rows = (leadsData ?? []).filter(r => r.lead.status === statDetailModal);
        return (
          <div className="fixed inset-0 z-[300] bg-black/70 flex items-end justify-center" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }} onClick={() => setStatDetailModal(null)}>
            <div className="bg-card border border-border rounded-t-2xl w-full max-w-md flex flex-col" style={{ maxHeight: 'calc(75svh - env(safe-area-inset-bottom))' }} onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-border shrink-0">
                <div className="flex items-center gap-2">
                  <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${s.bg} ${s.color}`}>
                    <s.icon className="h-3.5 w-3.5" />
                    {s.label}
                  </span>
                  <span className="text-sm text-muted-foreground">{rows.length}명</span>
                </div>
                <button onClick={() => setStatDetailModal(null)} className="text-muted-foreground hover:text-foreground">
                  <X className="h-5 w-5" />
                </button>
              </div>
              {rows.length === 0 ? (
                <div className="py-12 text-center text-sm text-muted-foreground">해당 상태의 상담이 없습니다</div>
              ) : (
                <div className="overflow-y-auto flex-1 divide-y divide-border">
                  {rows.map(row => {
                    const mainTypes = row.lead.consultationType ? row.lead.consultationType.split(",").filter(Boolean) : [];
                    return (
                      <button
                        key={row.lead.id}
                        className="w-full text-left px-5 py-3.5 hover:bg-accent/30 transition-colors"
                        onClick={() => { setStatDetailModal(null); openEdit(row); }}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-sm text-foreground">{row.lead.name}</span>
                              {row.lead.gender && <span className="text-xs text-muted-foreground">{row.lead.gender}</span>}
                              {row.lead.ageGroup && <span className="text-xs text-muted-foreground">{row.lead.ageGroup}</span>}
                            </div>
                            {row.lead.phone && (
                              <p className="text-xs text-muted-foreground mt-0.5">{row.lead.phone}</p>
                            )}
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {mainTypes.map(mt => (
                                <span key={mt} className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">{mt}</span>
                              ))}
                              {row.lead.interestType && (
                                <span className="text-[10px] bg-amber-400/10 text-amber-400 px-1.5 py-0.5 rounded-full">{row.lead.interestType}</span>
                              )}
                              {(row.trainerName || (row as any).consultantName) && (
                                <span className="text-[10px] bg-violet-500/10 text-violet-400 px-1.5 py-0.5 rounded-full">
                                  {row.trainerName || (row as any).consultantName}
                                </span>
                              )}
                            </div>
                            {row.lead.consultationNote && (
                              <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{row.lead.consultationNote}</p>
                            )}
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-xs text-muted-foreground">{row.lead.consultationDate ?? ""}</p>
                            <ChevronRight className="h-4 w-4 text-muted-foreground mt-1 ml-auto" />
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* 계약서 모달 */}
      {showContract && (
        <div className="fixed inset-0 z-[300] bg-black/70 flex items-center justify-center"
          style={{ padding: 'max(env(safe-area-inset-top), 1rem) 1rem max(env(safe-area-inset-bottom), 1rem)' }}>
          <div className="bg-card border border-border rounded-2xl w-full max-w-md flex flex-col"
            style={{ maxHeight: 'calc(100svh - max(env(safe-area-inset-top), 1rem) - max(env(safe-area-inset-bottom), 1rem))' }}>
            {/* 헤더 */}
            <div className="sticky top-0 bg-card border-b border-border px-4 py-3 flex items-center justify-between shrink-0 rounded-t-2xl">
              <h2 className="font-bold text-foreground">회원 계약서</h2>
              <button onClick={() => setShowContract(false)} className="text-muted-foreground hover:text-foreground">✕</button>
            </div>

            <div className="overflow-y-auto flex-1 p-4 space-y-5">

              {/* 섹션 1: 이용약관 */}
              <div className="space-y-2">
                <h3 className="font-semibold text-sm text-foreground">센터 이용 약관</h3>
                <div className="rounded-lg p-3 h-36 overflow-y-auto">
                  <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-sans leading-relaxed">{CONTRACT_TERMS}</pre>
                </div>
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input type="checkbox" checked={agreedTerms} onChange={e => setAgreedTerms(e.target.checked)}
                    className="w-4 h-4 accent-emerald-500 shrink-0" />
                  <span className="text-sm text-foreground">
                    <span className="text-emerald-500 font-semibold">(필수)</span> 이용약관에 동의합니다
                  </span>
                </label>
              </div>

              {/* 섹션 2: 개인정보 동의 */}
              <div className="space-y-2">
                <h3 className="font-semibold text-sm text-foreground">개인정보 수집·이용 동의서</h3>
                <div className="rounded-lg p-3 h-36 overflow-y-auto">
                  <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-sans leading-relaxed">{PRIVACY_TERMS}</pre>
                </div>
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input type="checkbox" checked={agreedPrivacy} onChange={e => setAgreedPrivacy(e.target.checked)}
                    className="w-4 h-4 accent-emerald-500 shrink-0" />
                  <span className="text-sm text-foreground">
                    <span className="text-emerald-500 font-semibold">(필수)</span> 개인정보 수집·이용에 동의합니다
                  </span>
                </label>
              </div>

              {/* 섹션 3: 광고성 동의 */}
              <div className="space-y-2">
                <h3 className="font-semibold text-sm text-foreground">광고성 정보 수신 동의서</h3>
                <div className="rounded-lg p-3 h-28 overflow-y-auto">
                  <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-sans leading-relaxed">{MARKETING_TERMS}</pre>
                </div>
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input type="checkbox" checked={agreedMarketing} onChange={e => setAgreedMarketing(e.target.checked)}
                    className="w-4 h-4 accent-blue-500 shrink-0" />
                  <span className="text-sm text-foreground">
                    <span className="text-blue-400 font-semibold">(선택)</span> 광고성 정보 수신에 동의합니다
                  </span>
                </label>
              </div>

              <p className="text-xs text-muted-foreground text-center pb-1">
                필수 항목에 동의하셔야 등록이 완료됩니다
              </p>
            </div>

            {/* 하단 확인 버튼 */}
            <div className="border-t border-border shrink-0 space-y-2 bg-card"
              style={{ padding: '0.75rem 1rem', paddingBottom: 'max(env(safe-area-inset-bottom), 0.75rem)' }}>
              <button
                type="button"
                onClick={confirmRegistration}
                disabled={!agreedTerms || !agreedPrivacy}
                className="w-full bg-emerald-500 text-white rounded-xl py-3 text-sm font-bold hover:bg-emerald-600 active:bg-emerald-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                동의 후 등록 완료
              </button>
              <button type="button" onClick={() => setShowContract(false)}
                className="w-full border border-border text-muted-foreground rounded-xl py-2.5 text-sm font-medium hover:bg-muted/30">
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 전자서명 모달 */}
      {showSignature && (() => {
        const sigName = sigContext === "direct" ? directForm.name
          : sigContext === "rereg" ? ((allMembersList ?? []).find(m => m.id === reRegMemberId)?.name ?? "")
          : form.name;
        const backAction = sigContext === "direct" ? () => { setShowSignature(false); setSigContext(null); }
          : sigContext === "rereg" ? () => { setShowSignature(false); setSigContext(null); }
          : () => { setShowSignature(false); setShowRegistration(true); };
        return (
          <SignatureModal
            memberName={sigName}
            onConfirm={proceedAfterSignature}
            onBack={backAction}
          />
        );
      })()}

      {/* 서명된 계약서 확인 모달 */}
      {showSignedContract && signatureDataUrl && (() => {
        const displayForm = (sigContext === "direct" || sigContext === "rereg") ? contractDisplayForm : regForm;
        const sigName = sigContext === "direct" ? directForm.name
          : sigContext === "rereg" ? ((allMembersList ?? []).find(m => m.id === reRegMemberId)?.name ?? "")
          : form.name;
        const sigPhone = sigContext === "direct" ? (directForm.phone || "")
          : sigContext === "rereg" ? ((allMembersList ?? []).find(m => m.id === reRegMemberId)?.phone ?? "")
          : (form.phone || "");
        return (
          <SignedContractModal
            memberName={sigName}
            memberPhone={sigPhone}
            marketing={agreedMarketing}
            signatureDataUrl={signatureDataUrl}
            regForm={displayForm}
            onPrint={() => {
              const sigKey = `contract_sig_${Date.now()}`;
              localStorage.setItem(sigKey, signatureDataUrl);
              const p = new URLSearchParams({
                name: sigName,
                phone: sigPhone,
                date: new Date().toLocaleDateString("ko-KR"),
                marketing: agreedMarketing ? "1" : "0",
                sigKey,
                subType: displayForm.subType,
                itemTypes: displayForm.itemTypes.join(","),
                programKey: displayForm.programKey,
                programCustom: displayForm.programCustom,
                sessions: displayForm.sessions?.toString() ?? "",
                duration: displayForm.duration?.toString() ?? "",
                otherItem: displayForm.otherItem,
                amount: displayForm.amount,
                discountAmount: displayForm.discountAmount,
                paidAmount: displayForm.paidAmount,
                unpaidAmount: displayForm.unpaidAmount,
                paymentMethod: displayForm.paymentMethod,
                paymentDate: displayForm.paymentDate,
                startDate: displayForm.startDate,
              });
              window.open(`/contract-print?${p.toString()}`, "_blank");
            }}
            onConfirm={proceedToSave}
          />
        );
      })()}

      {/* 등록 상세 모달 */}
      {showRegistration && (
        <div className="fixed inset-0 z-[300] bg-black/70 flex items-center justify-center"
          style={{ padding: 'max(env(safe-area-inset-top), 1rem) 1rem max(env(safe-area-inset-bottom), 1rem)' }}>
          <div className="bg-card border border-border rounded-2xl w-full max-w-md flex flex-col"
            style={{ maxHeight: 'calc(100svh - max(env(safe-area-inset-top), 1rem) - max(env(safe-area-inset-bottom), 1rem))' }}>
            <div className="sticky top-0 bg-card border-b border-border px-4 py-3 flex items-center justify-between shrink-0 rounded-t-2xl">
              <div>
                <h2 className="font-bold text-foreground">등록 상세 정보</h2>
                <p className="text-xs text-muted-foreground">{form.name}{form.interestType ? ` · ${form.interestType}` : ""}</p>
              </div>
              <button onClick={() => setShowRegistration(false)} className="text-muted-foreground hover:text-foreground">✕</button>
            </div>

            <div className="overflow-y-auto flex-1 p-4 space-y-4">

              {/* 신규/재등록 */}
              <div>
                <label className="text-xs text-muted-foreground">구분 *</label>
                <div className="flex gap-2 mt-1">
                  {(["신규", "재등록"] as const).map(s => (
                    <button key={s} type="button"
                      onClick={() => setRegForm(f => ({ ...f, subType: s }))}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${regForm.subType === s ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border text-muted-foreground"}`}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* 항목 유형 — 복수 선택 + 인라인 상세 */}
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground">항목 유형 * (복수 선택 가능)</label>

                {/* PT */}
                <div className={`rounded-xl border transition-colors ${regForm.itemTypes.includes("PT") ? "border-primary/60 bg-primary/5" : "border-border"}`}>
                  <button type="button" onClick={() => setRegForm(f => {
                    const has = f.itemTypes.includes("PT");
                    return { ...f, itemTypes: has ? f.itemTypes.filter(x => x !== "PT") : [...f.itemTypes, "PT"] };
                  })} className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold">
                    <span className={regForm.itemTypes.includes("PT") ? "text-primary" : "text-muted-foreground"}>PT</span>
                    {regForm.itemTypes.includes("PT") && <span className="text-[10px] text-primary bg-primary/10 px-2 py-0.5 rounded-full">선택됨</span>}
                  </button>
                  {regForm.itemTypes.includes("PT") && (
                    <div className="px-4 pb-4 space-y-3 border-t border-primary/20">
                      <div className="pt-3">
                        <label className="text-xs text-muted-foreground">PT 프로그램</label>
                        <div className="grid grid-cols-2 gap-2 mt-1">
                          {PT_PROGRAMS.map(p => (
                            <button key={p} type="button"
                              onClick={() => setRegForm(f => ({ ...f, programKey: p, programCustom: "" }))}
                              className={`py-2 rounded-lg text-sm font-medium border transition-colors ${regForm.programKey === p ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border text-muted-foreground"}`}>
                              {p}
                            </button>
                          ))}
                        </div>
                        {regForm.programKey === "기타" && (
                          <input value={regForm.programCustom}
                            onChange={e => setRegForm(f => ({ ...f, programCustom: e.target.value }))}
                            placeholder="프로그램명 입력"
                            className="w-full mt-2 rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:outline-none" />
                        )}
                      </div>
                      {regForm.programKey === "이벤트피티" && (
                        <div>
                          <label className="text-xs text-muted-foreground">이벤트 선택</label>
                          <select
                            className="w-full mt-1 rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:outline-none"
                            defaultValue=""
                            onChange={e => {
                              const ev = (ptEvents ?? []).find((x: any) => String(x.id) === e.target.value);
                              if (ev) setRegForm(f => ({ ...f, sessions: ev.sessions, serviceSessions: ev.serviceSessions }));
                            }}>
                            <option value="" disabled>이벤트 선택...</option>
                            {(ptEvents ?? []).map((ev: any) => (
                              <option key={ev.id} value={String(ev.id)}>
                                {ev.name} (적용: {(ev.applicableSessions || String(ev.sessions)).split(",").map((s: string) => `${s}회`).join("·")}, 서비스 +{ev.serviceSessions}회{ev.serviceSessionPrice > 0 ? ` · 서비스단가 ${ev.serviceSessionPrice.toLocaleString()}원/회` : ""})
                              </option>
                            ))}
                          </select>
                          {(ptEvents ?? []).length === 0 && (
                            <p className="text-xs text-muted-foreground mt-1">현재 진행 중인 이벤트가 없습니다.</p>
                          )}
                        </div>
                      )}
                      <div>
                        <label className="text-xs text-muted-foreground">PT 횟수 *</label>
                        <input type="number" min="1"
                          value={regForm.sessions ?? ""}
                          onChange={e => setRegForm(f => ({ ...f, sessions: e.target.value ? parseInt(e.target.value) : undefined }))}
                          placeholder="횟수 직접 입력"
                          className="w-full mt-1 rounded-lg px-3 py-2 text-sm text-foreground bg-background border border-border focus:outline-none" />
                        <div className="flex gap-1.5 flex-wrap mt-1.5">
                          {PT_SESSIONS.map(n => (
                            <button key={n} type="button"
                              onClick={() => setRegForm(f => ({ ...f, sessions: f.sessions === n ? undefined : n }))}
                              className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${regForm.sessions === n ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-primary/40"}`}>
                              {n}회
                            </button>
                          ))}
                        </div>
                        {(regForm.sessions || regForm.serviceSessions) && (
                          <p className="text-xs text-primary mt-1 font-medium">
                            총 {(regForm.sessions ?? 0) + (regForm.serviceSessions ?? 0)}회
                            {regForm.serviceSessions ? <span className="text-muted-foreground"> (결제 {regForm.sessions ?? 0}회 + 서비스 {regForm.serviceSessions}회)</span> : ""}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* 헬스 */}
                <div className={`rounded-xl border transition-colors ${regForm.itemTypes.includes("헬스") ? "border-emerald-500/60 bg-emerald-500/5" : "border-border"}`}>
                  <button type="button" onClick={() => setRegForm(f => {
                    const has = f.itemTypes.includes("헬스");
                    return { ...f, itemTypes: has ? f.itemTypes.filter(x => x !== "헬스") : [...f.itemTypes, "헬스"] };
                  })} className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold">
                    <span className={regForm.itemTypes.includes("헬스") ? "text-emerald-400" : "text-muted-foreground"}>헬스</span>
                    {regForm.itemTypes.includes("헬스") && <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">선택됨</span>}
                  </button>
                  {regForm.itemTypes.includes("헬스") && (
                    <div className="px-4 pb-4 border-t border-emerald-500/20">
                      <label className="text-xs text-muted-foreground block pt-3">이용 기간</label>
                      <div className="flex gap-2 mt-1">
                        {DURATIONS.map(d => (
                          <button key={d} type="button"
                            onClick={() => setRegForm(f => ({ ...f, duration: f.duration === d ? undefined : d }))}
                            className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${regForm.duration === d ? "bg-emerald-500 text-white border-emerald-500" : "bg-background border-border text-muted-foreground"}`}>
                            {d}개월
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* 기타 */}
                <div className={`rounded-xl border transition-colors ${regForm.itemTypes.includes("기타") ? "border-amber-500/60 bg-amber-500/5" : "border-border"}`}>
                  <button type="button" onClick={() => setRegForm(f => {
                    const has = f.itemTypes.includes("기타");
                    return { ...f, itemTypes: has ? f.itemTypes.filter(x => x !== "기타") : [...f.itemTypes, "기타"] };
                  })} className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold">
                    <span className={regForm.itemTypes.includes("기타") ? "text-amber-400" : "text-muted-foreground"}>기타 <span className="font-normal text-xs">(운동복, 락커 등)</span></span>
                    {regForm.itemTypes.includes("기타") && <span className="text-[10px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full">선택됨</span>}
                  </button>
                  {regForm.itemTypes.includes("기타") && (
                    <div className="px-4 pb-4 border-t border-amber-500/20 pt-3 space-y-2">
                      <div className="flex gap-2">
                        {["락커", "운동복"].map(item => {
                          const selected = regForm.otherItem.split(",").map(s => s.trim()).includes(item);
                          return (
                            <button key={item} type="button"
                              onClick={() => {
                                const items = regForm.otherItem.split(",").map(s => s.trim()).filter(Boolean);
                                const next = items.includes(item) ? items.filter(x => x !== item) : [...items, item];
                                setRegForm(f => ({ ...f, otherItem: next.join(", ") }));
                              }}
                              className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${selected ? "bg-amber-500 text-white border-amber-500" : "border-border text-muted-foreground hover:bg-accent"}`}>
                              {item}
                            </button>
                          );
                        })}
                      </div>
                      <p className="text-xs text-amber-400/70">
                        개월 수는 헬스 등록 기간{regForm.duration ? ` (${regForm.duration}개월)` : ""}과 동일하게 적용됩니다
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* 금액 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">정가 * (원)</label>
                  <input type="number" value={regForm.amount}
                    onChange={e => {
                      const amt = e.target.value;
                      const disc = Number(regForm.discountAmount) || 0;
                      const unpaid = Number(regForm.unpaidAmount) || 0;
                      const paid = Math.max(0, Number(amt) - disc - unpaid);
                      setRegForm(f => ({ ...f, amount: amt, paidAmount: String(paid) }));
                    }}
                    placeholder="0"
                    className="w-full mt-1 rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">할인 (원)</label>
                  <input type="number" value={regForm.discountAmount}
                    onChange={e => {
                      const disc = e.target.value;
                      const unpaid = Number(regForm.unpaidAmount) || 0;
                      const paid = Math.max(0, Number(regForm.amount) - Number(disc) - unpaid);
                      setRegForm(f => ({ ...f, discountAmount: disc, paidAmount: String(paid) }));
                    }}
                    placeholder="0"
                    className="w-full mt-1 rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">실결제 (원)</label>
                  <div className="w-full mt-1 rounded-lg px-3 py-2 text-sm text-foreground bg-background border border-border opacity-70">
                    {Math.max(0, (Number(regForm.amount) || 0) - (Number(regForm.discountAmount) || 0) - (Number(regForm.unpaidAmount) || 0)).toLocaleString()}
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">미수금 (원)</label>
                  <input type="number" value={regForm.unpaidAmount}
                    onChange={e => {
                      const unpaid = e.target.value;
                      const paid = Math.max(0, Number(regForm.amount) - Number(regForm.discountAmount) - Number(unpaid));
                      setRegForm(f => ({ ...f, unpaidAmount: unpaid, paidAmount: String(paid) }));
                    }}
                    placeholder="0"
                    className="w-full mt-1 rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none" />
                </div>
              </div>

              {/* 결제 방법 */}
              <div>
                <label className="text-xs text-muted-foreground">결제 방법 *</label>
                <div className="grid grid-cols-4 gap-2 mt-1">
                  {PAYMENT_METHODS_REG.map(m => (
                    <button key={m} type="button"
                      onClick={() => setRegForm(f => ({ ...f, paymentMethod: f.paymentMethod === m ? "" : m }))}
                      className={`py-2 rounded-lg text-xs font-medium border transition-colors ${regForm.paymentMethod === m ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border text-muted-foreground"}`}>
                      {PAYMENT_METHOD_LABELS[m] ?? m}
                    </button>
                  ))}
                </div>
                {regForm.paymentMethod === "혼합" && (
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-muted-foreground">이체 금액</label>
                      <input type="number" value={regForm.transferAmount}
                        onChange={e => {
                          const t = e.target.value;
                          const c = Number(regForm.cardAmount) || 0;
                          const amt = String((Number(t) || 0) + c);
                          const unpaid = Number(regForm.unpaidAmount) || 0;
                          const paid = Math.max(0, Number(amt) - Number(regForm.discountAmount) - unpaid);
                          setRegForm(f => ({ ...f, transferAmount: t, amount: amt, paidAmount: String(paid) }));
                        }}
                        placeholder="0"
                        className="w-full mt-1 rounded-lg px-3 py-2 text-sm text-foreground bg-background border border-border focus:outline-none" />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">카드 금액</label>
                      <input type="number" value={regForm.cardAmount}
                        onChange={e => {
                          const c = e.target.value;
                          const t = Number(regForm.transferAmount) || 0;
                          const amt = String(t + (Number(c) || 0));
                          const unpaid = Number(regForm.unpaidAmount) || 0;
                          const paid = Math.max(0, Number(amt) - Number(regForm.discountAmount) - unpaid);
                          setRegForm(f => ({ ...f, cardAmount: c, amount: amt, paidAmount: String(paid) }));
                        }}
                        placeholder="0"
                        className="w-full mt-1 rounded-lg px-3 py-2 text-sm text-foreground bg-background border border-border focus:outline-none" />
                    </div>
                  </div>
                )}
              </div>

              {/* 날짜 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">결제일 *</label>
                  <input type="date" value={regForm.paymentDate}
                    onChange={e => setRegForm(f => ({ ...f, paymentDate: e.target.value }))}
                    className="w-full mt-1 rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:outline-none" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">시작일</label>
                  <input type="date" value={regForm.startDate}
                    onChange={e => setRegForm(f => ({ ...f, startDate: e.target.value }))}
                    className="w-full mt-1 rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:outline-none" />
                </div>
              </div>

              {/* 지점 선택 */}
              {branchList && branchList.length > 0 && (
                <div>
                  <label className="text-xs text-muted-foreground">지점</label>
                  <div className="flex gap-2 mt-1 flex-wrap">
                    <button type="button" onClick={() => setRegForm(f => ({ ...f, branchId: undefined }))}
                      className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${!regForm.branchId ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border text-muted-foreground hover:text-foreground"}`}>
                      미지정
                    </button>
                    {branchList.map((b: any) => (
                      <button key={b.id} type="button" onClick={() => setRegForm(f => ({ ...f, branchId: b.id }))}
                        className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${regForm.branchId === b.id ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border text-muted-foreground hover:text-foreground"}`}>
                        {b.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* 등록 진행 내용 */}
              <div>
                <label className="text-xs text-muted-foreground">등록 진행 내용</label>
                <textarea value={regForm.memo} onChange={e => setRegForm(f => ({ ...f, memo: e.target.value }))} rows={2}
                  placeholder="운동 가능 시간, 날짜, 특이사항..."
                  className="w-full mt-1 rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:outline-none resize-none" />
              </div>

              {/* 서비스 내역 */}
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground">서비스 내역 <span className="text-muted-foreground/60">(무료 제공 항목)</span></label>

                {/* PT 서비스 — 항상 표시 */}
                {(() => {
                  const selected = regForm.serviceItems.includes("PT");
                  const paid = Number(regForm.paidAmount) || 0;
                  const total = (regForm.sessions ?? 0) + (regForm.serviceSessions ?? 0);
                  const calcPrice = total > 0 ? Math.round(paid / total) : 0;
                  const unitPrice = calcPrice > 0 ? calcPrice : (gymSettings?.servicePtUnitPrice ?? 0);
                  return (
                    <div className={`rounded-xl border transition-colors ${selected ? "border-blue-500/60 bg-blue-500/5" : "border-border"}`}>
                      <button type="button"
                        onClick={() => setRegForm(f => ({ ...f, serviceItems: selected ? f.serviceItems.filter(s => s !== "PT") : [...f.serviceItems, "PT"], servicePtCount: undefined }))}
                        className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold">
                        <span className={selected ? "text-blue-400" : "text-muted-foreground"}>PT</span>
                        {unitPrice > 0 && <span className="text-[10px] text-muted-foreground">단가 {unitPrice.toLocaleString()}원/회</span>}
                      </button>
                      {selected && (
                        <div className="px-4 pb-4 border-t border-blue-500/20 pt-3 space-y-2">
                          <label className="text-xs text-muted-foreground">제공 횟수</label>
                          <div className="flex gap-2">
                            {[1, 2, 3].map(n => (
                              <button key={n} type="button"
                                onClick={() => setRegForm(f => ({ ...f, servicePtCount: f.servicePtCount === n ? undefined : n }))}
                                className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${regForm.servicePtCount === n ? "bg-blue-500 text-white border-blue-500" : "bg-background border-border text-muted-foreground"}`}>
                                +{n}회
                              </button>
                            ))}
                          </div>
                          <input
                            type="number"
                            min={1}
                            value={regForm.servicePtCount && ![1,2,3].includes(regForm.servicePtCount) ? regForm.servicePtCount : ""}
                            onChange={e => setRegForm(f => ({ ...f, servicePtCount: e.target.value ? parseInt(e.target.value) : undefined }))}
                            placeholder="직접 입력 (회)"
                            className="w-full py-2 px-3 rounded-lg text-sm text-foreground border border-border bg-background focus:outline-none focus:ring-1 focus:ring-blue-500" />
                          {regForm.servicePtCount && unitPrice > 0 && (
                            <p className="text-xs text-blue-400">서비스 금액 ≈ {(regForm.servicePtCount * unitPrice).toLocaleString()}원 상당</p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* 헬스 서비스 — 항상 표시 */}
                {(() => {
                  const selected = regForm.serviceItems.includes("헬스");
                  return (
                    <div className={`rounded-xl border transition-colors ${selected ? "border-emerald-500/60 bg-emerald-500/5" : "border-border"}`}>
                      <button type="button"
                        onClick={() => setRegForm(f => ({ ...f, serviceItems: selected ? f.serviceItems.filter(s => s !== "헬스") : [...f.serviceItems, "헬스"], serviceHealthMonths: undefined, serviceHealthMonthsCustom: "" }))}
                        className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold">
                        <span className={selected ? "text-emerald-400" : "text-muted-foreground"}>헬스</span>
                      </button>
                      {selected && (
                        <div className="px-4 pb-4 border-t border-emerald-500/20 pt-3 space-y-2">
                          <label className="text-xs text-muted-foreground">제공 개월 수</label>
                          <div className="flex gap-2 flex-wrap">
                            {[1, 3, 6, 12].map(m => (
                              <button key={m} type="button"
                                onClick={() => setRegForm(f => ({ ...f, serviceHealthMonths: f.serviceHealthMonths === m ? undefined : m, serviceHealthMonthsCustom: "" }))}
                                className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${regForm.serviceHealthMonths === m ? "bg-emerald-500 text-white border-emerald-500" : "bg-background border-border text-muted-foreground"}`}>
                                {m}개월
                              </button>
                            ))}
                          </div>
                          <input
                            type="number"
                            min={1}
                            value={regForm.serviceHealthMonthsCustom}
                            onChange={e => setRegForm(f => ({ ...f, serviceHealthMonthsCustom: e.target.value, serviceHealthMonths: undefined }))}
                            placeholder="직접 입력 (개월)"
                            className="w-full py-2 px-3 rounded-lg text-sm text-foreground border border-border bg-background focus:outline-none focus:ring-1 focus:ring-emerald-500" />
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* 락커 서비스 — 항상 표시 */}
                {(() => {
                  const selected = regForm.serviceItems.includes("락커");
                  const availableLockers = (allLockers ?? []).filter((l: any) =>
                    !l.isOccupied && (!regForm.branchId || l.branchId === regForm.branchId || !l.branchId)
                  );
                  // 지점별 그룹핑
                  const groups: { branchId: number | null; branchName: string; lockers: any[] }[] = [];
                  for (const l of availableLockers) {
                    const bid = l.branchId ?? null;
                    let g = groups.find(g => g.branchId === bid);
                    if (!g) {
                      const branch = (branchList ?? []).find((b: any) => b.id === bid);
                      g = { branchId: bid, branchName: branch?.name ?? "지점 미지정", lockers: [] };
                      groups.push(g);
                    }
                    g.lockers.push(l);
                  }
                  return (
                    <div className={`rounded-xl border transition-colors ${selected ? "border-amber-500/60 bg-amber-500/5" : "border-border"}`}>
                      <button type="button"
                        onClick={() => setRegForm(f => ({ ...f, serviceItems: selected ? f.serviceItems.filter(s => s !== "락커") : [...f.serviceItems, "락커"], serviceLockerNum: "" }))}
                        className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold">
                        <span className={selected ? "text-amber-400" : "text-muted-foreground"}>락커</span>
                        {availableLockers.length > 0 && <span className="text-[10px] text-muted-foreground">사용 가능 {availableLockers.length}개</span>}
                      </button>
                      {selected && (
                        <div className="px-4 pb-4 border-t border-amber-500/20 pt-3">
                          <label className="text-xs text-muted-foreground">락커 번호</label>
                          {availableLockers.length === 0 ? (
                            <p className="text-xs text-muted-foreground mt-1">사용 가능한 락커가 없습니다</p>
                          ) : (
                            <select
                              value={regForm.serviceLockerNum}
                              onChange={e => setRegForm(f => ({ ...f, serviceLockerNum: e.target.value }))}
                              className="w-full mt-1 rounded-lg px-3 py-2 text-sm text-foreground border border-border bg-background focus:outline-none focus:ring-1 focus:ring-amber-500">
                              <option value="">락커 선택...</option>
                              {groups.map(g => (
                                <optgroup key={g.branchId ?? "none"} label={g.branchName}>
                                  {g.lockers.map((l: any) => (
                                    <option key={l.id} value={l.lockerNumber}>
                                      {l.lockerNumber}{l.lockerType && l.lockerType !== "personal" ? ` (${l.lockerType})` : ""}
                                    </option>
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

                {/* 운동복 서비스 — 항상 표시 */}
                {(() => {
                  const selected = regForm.serviceItems.includes("운동복");
                  return (
                    <button type="button"
                      onClick={() => setRegForm(f => ({ ...f, serviceItems: selected ? f.serviceItems.filter(s => s !== "운동복") : [...f.serviceItems, "운동복"] }))}
                      className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-semibold border transition-colors ${selected ? "border-purple-500/60 bg-purple-500/5 text-purple-400" : "border-border text-muted-foreground"}`}>
                      운동복
                      {selected && <span className="text-[10px] text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-full">선택됨</span>}
                    </button>
                  );
                })()}

                {/* 선택된 서비스 배지 */}
                {regForm.serviceItems.length > 0 && (
                  <div className="flex gap-1.5 mt-1 flex-wrap">
                    {regForm.serviceItems.map(item => {
                      let label = `🎁 서비스 ${item}`;
                      if (item === "PT" && regForm.servicePtCount) label = `🎁 PT +${regForm.servicePtCount}회`;
                      else if (item === "헬스") {
                        const m = regForm.serviceHealthMonths ?? (regForm.serviceHealthMonthsCustom ? parseInt(regForm.serviceHealthMonthsCustom) : 0);
                        if (m) label = `🎁 헬스 +${m}개월`;
                      } else if (item === "락커" && regForm.serviceLockerNum) label = `🎁 락커 #${regForm.serviceLockerNum}`;
                      const badgeStyle = item === "PT" ? "bg-blue-500/20 text-blue-400"
                        : item === "헬스" ? "bg-emerald-500/20 text-emerald-400"
                        : item === "락커" ? "bg-amber-500/20 text-amber-400"
                        : "bg-purple-500/20 text-purple-400";
                      return (
                        <span key={item} className={`text-xs px-2 py-0.5 rounded-full font-medium ${badgeStyle}`}>{label}</span>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="border-t border-border shrink-0 space-y-2 bg-card"
              style={{ padding: '0.75rem 1rem', paddingBottom: 'max(env(safe-area-inset-bottom), 0.75rem)' }}>
              <button type="button" onClick={() => {
                if (editingRevenueId) {
                  // 수정 모드: 서명 없이 바로 저장
                  const reg = regForm;
                  if (!reg.paymentDate) return toast.error("결제일을 입력해주세요");
                  const parts: string[] = [];
                  if (reg.itemTypes.includes("PT") && reg.programKey) {
                    parts.push(reg.programKey === "기타" ? (reg.programCustom || "기타PT") : reg.programKey);
                  }
                  if (reg.itemTypes.includes("헬스") && reg.duration) parts.push(`헬스 ${reg.duration}개월`);
                  if (reg.itemTypes.includes("기타") && reg.otherItem) parts.push(reg.otherItem);
                  updateRevenueMutation.mutate({
                    id: editingRevenueId,
                    type: reg.itemTypes.includes("PT") ? "PT" : reg.itemTypes.includes("헬스") ? "헬스" : "기타",
                    subType: reg.subType,
                    programDetail: parts.length > 0 ? parts.join(" + ") : undefined,
                    sessions: reg.itemTypes.includes("PT") ? reg.sessions : undefined,
                    amount: Number(reg.amount) || 0,
                    discountAmount: Number(reg.discountAmount) || 0,
                    paidAmount: Number(reg.paidAmount) || 0,
                    unpaidAmount: Number(reg.unpaidAmount) || 0,
                    paymentMethod: reg.paymentMethod || undefined,
                    paymentDate: reg.paymentDate,
                    startDate: reg.startDate || undefined,
                    memo: reg.memo || undefined,
                    branchId: reg.branchId ?? undefined,
                    serviceItems: reg.serviceItems.length > 0 ? reg.serviceItems.map((item: string) => {
                      if (item === "PT" && reg.servicePtCount) return `PT(${reg.servicePtCount}회)`;
                      if (item === "헬스") {
                        const months = reg.serviceHealthMonths ?? (reg.serviceHealthMonthsCustom ? parseInt(reg.serviceHealthMonthsCustom) : undefined);
                        return months ? `헬스(${months}개월)` : "헬스";
                      }
                      if (item === "락커" && reg.serviceLockerNum) return `락커(${reg.serviceLockerNum})`;
                      return item;
                    }).join(",") : undefined,
                  });
                } else {
                  saveRegistration();
                }
              }}
                disabled={updateRevenueMutation.isPending}
                className="w-full bg-emerald-500 text-white rounded-xl py-3 text-sm font-bold hover:bg-emerald-600 active:bg-emerald-700 transition-colors disabled:opacity-50">
                {editingRevenueId ? "수정 저장" : "등록 완료"}
              </button>
              <button type="button" onClick={() => {
                setShowRegistration(false);
                if (editingRevenueId) { setEditingRevenueId(null); setShowForm(true); }
              }}
                className="w-full border border-border text-muted-foreground rounded-xl py-2.5 text-sm font-medium hover:bg-muted/30">
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 바로등록 모드 선택 */}
      {showRegModeSelect && (
        <div className="fixed inset-0 z-[200] bg-black/60 flex items-center justify-center p-4" onClick={() => setShowRegModeSelect(false)}>
          <div className="bg-card border border-border rounded-2xl w-full max-w-xs p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <h2 className="font-semibold text-foreground text-center">등록 유형 선택</h2>
            <p className="text-xs text-muted-foreground text-center">신규 회원인지, 기존 회원의 재등록인지 선택해주세요</p>
            <div className="space-y-2">
              <button
                className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm transition-colors"
                onClick={() => { setShowRegModeSelect(false); setShowDirectReg(true); setDirectForm(defaultDirectForm); }}
              >
                신규등록
                <span className="block text-xs font-normal opacity-80 mt-0.5">처음 등록하는 새 회원</span>
              </button>
              <button
                className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm transition-colors"
                onClick={() => { setShowRegModeSelect(false); setDirectRegMode("재등록"); setReRegSearch(""); setReRegMemberId(null); setReRegForm(defaultReRegForm); }}
              >
                재등록
                <span className="block text-xs font-normal opacity-80 mt-0.5">기존 회원의 프로그램 재등록</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 재등록 모달 */}
      {directRegMode === "재등록" && (
        <div className="fixed inset-0 z-[200] bg-black/60 flex items-end justify-center" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }} onClick={() => setDirectRegMode(null)}>
          <div className="bg-card border border-border rounded-t-2xl w-full max-w-md flex flex-col" style={{ maxHeight: 'calc(90svh - env(safe-area-inset-bottom))' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-border shrink-0">
              <div className="flex items-center gap-2">
                {reRegMemberId && (
                  <button onClick={() => setReRegMemberId(null)} className="text-muted-foreground hover:text-foreground">
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                )}
                <h2 className="font-semibold text-foreground">
                  {reRegMemberId ? "재등록 — 프로그램 입력" : "재등록 — 회원 선택"}
                </h2>
              </div>
              <button onClick={() => setDirectRegMode(null)} className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Step 1: 회원 선택 */}
            {!reRegMemberId && (
              <div className="flex flex-col flex-1 overflow-hidden">
                <div className="px-4 py-3 border-b border-border shrink-0">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary/70 pointer-events-none" />
                    <input
                      autoFocus
                      value={reRegSearch}
                      onChange={e => setReRegSearch(e.target.value)}
                      placeholder="이름 또는 연락처 검색..."
                      className="w-full rounded-xl pl-9 pr-4 py-3 text-[16px] text-foreground placeholder:text-muted-foreground focus:outline-none"
                      style={{
                        background: 'hsl(var(--muted))',
                        border: '1.5px solid hsl(var(--primary) / 0.35)',
                      }}
                    />
                  </div>
                </div>
                <div className="overflow-y-auto flex-1 divide-y divide-border">
                  {filteredReRegMembers.map(m => (
                      <button
                        key={m.id}
                        className="w-full flex items-center justify-between px-5 py-3 hover:bg-accent transition-colors text-left"
                        onClick={() => setReRegMemberId(m.id)}
                      >
                        <div>
                          <p className="text-sm font-medium text-foreground">{m.name}</p>
                          {m.phone && <p className="text-xs text-muted-foreground mt-0.5">{m.phone}</p>}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs px-2 py-0.5 rounded-full border ${m.status === "active" ? "border-green-500/30 text-green-400" : "border-border text-muted-foreground"}`}>
                            {m.status === "active" ? "활성" : m.status === "paused" ? "정지" : "만료"}
                          </span>
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </button>
                    ))}
                </div>
              </div>
            )}

            {/* Step 2: 프로그램 정보 입력 */}
            {reRegMemberId && (() => {
              const selectedMem = (allMembersList ?? []).find(m => m.id === reRegMemberId);
              return (
                <>
                  {/* 선택된 회원 정보 표시 */}
                  {selectedMem && (
                    <div className="px-5 py-3 border-b border-border bg-accent/30 shrink-0">
                      <p className="text-sm font-semibold text-foreground">{selectedMem.name}</p>
                      {selectedMem.phone && <p className="text-xs text-muted-foreground">{selectedMem.phone}</p>}
                    </div>
                  )}
                  <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">

                    {/* 운동 기간 */}
                    <div className="border-t border-border pt-2">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">운동 기간</p>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="text-xs text-muted-foreground">운동 시작일</label>
                        <input type="date" value={reRegForm.membershipStart}
                          onChange={e => {
                            const start = e.target.value;
                            const end = calcEndDate(start, reRegForm.ptSessions);
                            setReRegForm(f => ({ ...f, membershipStart: start, membershipEnd: end }));
                          }}
                          className="w-full rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:outline-none" />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs text-muted-foreground">운동 만료일 <span className="text-primary text-xs">(자동계산)</span></label>
                        <input type="date" value={reRegForm.membershipEnd} readOnly
                          className="w-full rounded-lg px-3 py-2 text-sm text-foreground opacity-60 cursor-not-allowed" />
                      </div>
                    </div>

                    {/* 프로그램 / 결제 */}
                    <div className="border-t border-border pt-2">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">프로그램 / 결제</p>
                    </div>

                    {/* 프로그램 선택 — PT / 헬스 / 기타 */}
                    <div className="space-y-2">
                      <label className="text-xs text-muted-foreground">프로그램 (복수 선택 가능)</label>

                      {/* PT */}
                      <div className={`rounded-xl border transition-colors ${reRegForm.programTypes.includes("PT") ? "border-primary/60 bg-primary/5" : "border-border"}`}>
                        <button type="button"
                          onClick={() => setReRegForm(f => {
                            const has = f.programTypes.includes("PT");
                            return { ...f, programTypes: has ? f.programTypes.filter(x => x !== "PT") : [...f.programTypes, "PT"],
                              ptProgram: has ? "" : f.ptProgram, ptSessions: has ? "" : f.ptSessions, serviceSessions: has ? "" : f.serviceSessions };
                          })}
                          className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold">
                          <span className={reRegForm.programTypes.includes("PT") ? "text-primary" : "text-muted-foreground"}>PT</span>
                          {reRegForm.programTypes.includes("PT") && <span className="text-[10px] text-primary bg-primary/10 px-2 py-0.5 rounded-full">선택됨</span>}
                        </button>
                        {reRegForm.programTypes.includes("PT") && (
                          <div className="px-4 pb-4 space-y-3 border-t border-primary/20 pt-3">
                            <div>
                              <label className="text-xs text-muted-foreground">PT 프로그램</label>
                              <div className="flex gap-1.5 flex-wrap mt-1">
                                {["케어피티", "웨이트피티", "이벤트피티"].map(p => (
                                  <button key={p} type="button"
                                    onClick={() => setReRegForm(f => ({ ...f, ptProgram: f.ptProgram === p ? "" : p }))}
                                    className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${reRegForm.ptProgram === p ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground"}`}>{p}</button>
                                ))}
                              </div>
                              {reRegForm.ptProgram === "이벤트피티" && (
                                <div className="mt-2">
                                  <select
                                    className="w-full rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:outline-none"
                                    defaultValue=""
                                    onChange={e => {
                                      const ev = (ptEvents ?? []).find((x: any) => String(x.id) === e.target.value);
                                      if (ev) setReRegForm(f => ({
                                        ...f,
                                        serviceSessions: String(ev.serviceSessions),
                                        serviceSessionPrice: String(ev.serviceSessionPrice ?? 0),
                                      }));
                                    }}>
                                    <option value="" disabled>이벤트 선택...</option>
                                    {(ptEvents ?? []).map((ev: any) => (
                                      <option key={ev.id} value={String(ev.id)}>
                                        {ev.name} (적용: {(ev.applicableSessions || String(ev.sessions)).split(",").map((s: string) => `${s}회`).join("·")}, 서비스 +{ev.serviceSessions}회{ev.serviceSessionPrice > 0 ? ` · 서비스단가 ${ev.serviceSessionPrice.toLocaleString()}원/회` : ""})
                                      </option>
                                    ))}
                                  </select>
                                  {(ptEvents ?? []).length === 0 && (
                                    <p className="text-xs text-muted-foreground mt-1">현재 진행 중인 이벤트가 없습니다.</p>
                                  )}
                                </div>
                              )}
                              <input value={!["케어피티","웨이트피티","이벤트피티"].includes(reRegForm.ptProgram) ? reRegForm.ptProgram : ""}
                                onChange={e => setReRegForm(f => ({ ...f, ptProgram: e.target.value }))}
                                placeholder="직접 입력"
                                className="w-full mt-2 rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:outline-none" />
                            </div>
                            <div>
                              <label className="text-xs text-muted-foreground">PT 횟수</label>
                              <div className="flex gap-1.5 flex-wrap mt-1">
                                {[10, 20, 30, 40, 50].map(n => (
                                  <button key={n} type="button"
                                    onClick={() => setReRegForm(f => {
                                      const next = f.ptSessions === String(n) ? "" : String(n);
                                      return { ...f, ptSessions: next, membershipEnd: calcEndDate(f.membershipStart, next) };
                                    })}
                                    className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${reRegForm.ptSessions === String(n) ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground"}`}>{n}회</button>
                                ))}
                              </div>
                              <input value={reRegForm.ptSessions} onChange={e => setReRegForm(f => ({ ...f, ptSessions: e.target.value, membershipEnd: calcEndDate(f.membershipStart, e.target.value) }))}
                                placeholder="직접 입력" type="number" min="1"
                                className="w-full mt-2 rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:outline-none" />
                            </div>
                          </div>
                        )}
                      </div>

                      {/* 헬스 */}
                      <div className={`rounded-xl border transition-colors ${reRegForm.programTypes.includes("헬스") ? "border-emerald-500/60 bg-emerald-500/5" : "border-border"}`}>
                        <button type="button"
                          onClick={() => setReRegForm(f => {
                            const has = f.programTypes.includes("헬스");
                            return { ...f, programTypes: has ? f.programTypes.filter(x => x !== "헬스") : [...f.programTypes, "헬스"],
                              healthDuration: has ? "" : f.healthDuration, membershipEnd: has ? "" : f.membershipEnd };
                          })}
                          className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold">
                          <span className={reRegForm.programTypes.includes("헬스") ? "text-emerald-400" : "text-muted-foreground"}>헬스</span>
                          {reRegForm.programTypes.includes("헬스") && <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">선택됨</span>}
                        </button>
                        {reRegForm.programTypes.includes("헬스") && (
                          <div className="px-4 pb-4 border-t border-emerald-500/20 pt-3">
                            <label className="text-xs text-muted-foreground">이용 기간</label>
                            <div className="flex gap-2 mt-1">
                              {[1, 3, 6, 12].map(d => (
                                <button key={d} type="button"
                                  onClick={() => setReRegForm(f => {
                                    const dur = String(d);
                                    const svcDays = parseInt(f.healthServiceDays || "0");
                                    const end = f.membershipStart
                                      ? (() => { const e = new Date(f.membershipStart); e.setMonth(e.getMonth() + d); if (svcDays > 0) e.setDate(e.getDate() + svcDays); return e.toISOString().substring(0, 10); })()
                                      : "";
                                    return { ...f, healthDuration: f.healthDuration === dur ? "" : dur, membershipEnd: f.healthDuration === dur ? "" : end };
                                  })}
                                  className={`flex-1 py-2 rounded-lg text-sm font-semibold border transition-colors ${reRegForm.healthDuration === String(d) ? "bg-emerald-500 text-white border-emerald-500" : "bg-background border-border text-muted-foreground"}`}>
                                  {d}개월
                                </button>
                              ))}
                            </div>
                            <div className="mt-3">
                              <label className="text-xs text-muted-foreground">기본 서비스 기간 <span className="text-muted-foreground/60">(일 단위)</span></label>
                              <div className="flex items-center gap-2 mt-1">
                                {[0, 7, 14, 30].map(n => (
                                  <button key={n} type="button"
                                    onClick={() => setReRegForm(f => {
                                      const months = parseInt(f.healthDuration || "0");
                                      const end = f.membershipStart && months > 0
                                        ? (() => { const e = new Date(f.membershipStart); e.setMonth(e.getMonth() + months); if (n > 0) e.setDate(e.getDate() + n); return e.toISOString().substring(0, 10); })()
                                        : f.membershipEnd;
                                      return { ...f, healthServiceDays: f.healthServiceDays === String(n) ? "" : String(n), membershipEnd: end };
                                    })}
                                    className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors ${reRegForm.healthServiceDays === String(n) ? "bg-emerald-500 text-white border-emerald-500" : "bg-background border-border text-muted-foreground"}`}>
                                    {n === 0 ? "없음" : `+${n}일`}
                                  </button>
                                ))}
                                <input type="number" min="0" placeholder="직접"
                                  value={reRegForm.healthServiceDays && !["0","7","14","30"].includes(reRegForm.healthServiceDays) ? reRegForm.healthServiceDays : ""}
                                  onChange={e => setReRegForm(f => {
                                    const n = parseInt(e.target.value || "0");
                                    const months = parseInt(f.healthDuration || "0");
                                    const end = f.membershipStart && months > 0
                                      ? (() => { const d = new Date(f.membershipStart); d.setMonth(d.getMonth() + months); if (n > 0) d.setDate(d.getDate() + n); return d.toISOString().substring(0, 10); })()
                                      : f.membershipEnd;
                                    return { ...f, healthServiceDays: e.target.value, membershipEnd: end };
                                  })}
                                  className="w-14 rounded-lg px-2 py-1.5 text-xs text-center text-foreground focus:outline-none focus:outline-none" />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* 기타 */}
                      <div className={`rounded-xl border transition-colors ${reRegForm.programTypes.includes("기타") ? "border-amber-500/60 bg-amber-500/5" : "border-border"}`}>
                        <button type="button"
                          onClick={() => setReRegForm(f => {
                            const has = f.programTypes.includes("기타");
                            return { ...f, programTypes: has ? f.programTypes.filter(x => x !== "기타") : [...f.programTypes, "기타"],
                              otherItem: has ? "" : f.otherItem };
                          })}
                          className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold">
                          <span className={reRegForm.programTypes.includes("기타") ? "text-amber-400" : "text-muted-foreground"}>기타 <span className="font-normal text-xs">(운동복, 락커 등)</span></span>
                          {reRegForm.programTypes.includes("기타") && <span className="text-[10px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full">선택됨</span>}
                        </button>
                        {reRegForm.programTypes.includes("기타") && (
                          <div className="px-4 pb-4 border-t border-amber-500/20 pt-3 space-y-2">
                            <div className="flex gap-2">
                              {["락커", "운동복"].map(item => {
                                const selected = reRegForm.otherItem.split(",").map(s => s.trim()).includes(item);
                                return (
                                  <button key={item} type="button"
                                    onClick={() => {
                                      const items = reRegForm.otherItem.split(",").map(s => s.trim()).filter(Boolean);
                                      const next = items.includes(item) ? items.filter(x => x !== item) : [...items, item];
                                      setReRegForm(f => ({ ...f, otherItem: next.join(", ") }));
                                    }}
                                    className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${selected ? "bg-amber-500 text-white border-amber-500" : "border-border text-muted-foreground hover:bg-accent"}`}>
                                    {item}
                                  </button>
                                );
                              })}
                            </div>
                            <p className="text-xs text-amber-400/70">
                              개월 수는 헬스 등록 기간{reRegForm.healthDuration ? ` (${reRegForm.healthDuration}개월)` : ""}과 동일하게 적용됩니다
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* 결제 */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="text-xs text-muted-foreground">결제 금액</label>
                        <input type="number" min="0" value={reRegForm.paymentAmount} onChange={e => setReRegForm(f => ({ ...f, paymentAmount: e.target.value }))} placeholder="0"
                          className="w-full rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:outline-none" />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs text-muted-foreground">미수금 금액</label>
                        <input type="number" min="0" value={reRegForm.unpaidAmount} onChange={e => setReRegForm(f => ({ ...f, unpaidAmount: e.target.value }))} placeholder="0"
                          className="w-full rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:outline-none" />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs text-muted-foreground">결제방법</label>
                      <select value={reRegForm.paymentMethod} onChange={e => setReRegForm(f => ({ ...f, paymentMethod: e.target.value as any }))}
                        className="w-full rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:outline-none">
                        <option value="">결제방법 선택</option>
                        {["현금영수증", "이체", "지역화폐", "카드", "혼합"].map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs text-muted-foreground">결제일자</label>
                      <input type="date" value={reRegForm.paymentDate} onChange={e => setReRegForm(f => ({ ...f, paymentDate: e.target.value }))}
                        className="w-full rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:outline-none" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs text-muted-foreground">결제 메모</label>
                      <input value={reRegForm.paymentMemo} onChange={e => setReRegForm(f => ({ ...f, paymentMemo: e.target.value }))} placeholder="분납 등 메모"
                        className="w-full rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:outline-none" />
                    </div>
                    {/* 지점 */}
                    {branchList && branchList.length > 0 && (
                      <div className="space-y-1.5">
                        <label className="text-xs text-muted-foreground">지점</label>
                        <div className="flex gap-2 flex-wrap">
                          <button type="button" onClick={() => setReRegForm(f => ({ ...f, branchId: "" }))}
                            className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${!reRegForm.branchId ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border text-muted-foreground hover:text-foreground"}`}>
                            미지정
                          </button>
                          {branchList.map((b: any) => (
                            <button key={b.id} type="button" onClick={() => setReRegForm(f => ({ ...f, branchId: String(b.id) }))}
                              className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${reRegForm.branchId === String(b.id) ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border text-muted-foreground hover:text-foreground"}`}>
                              {b.name}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 제출 버튼 */}
                  <div className="border-t border-border shrink-0 bg-card"
                    style={{ padding: '0.75rem 1rem', paddingBottom: 'max(env(safe-area-inset-bottom), 0.75rem)' }}>
                    <button type="button"
                      onClick={openReRegSig}
                      className="w-full bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white rounded-xl py-3 text-sm font-bold disabled:opacity-50">
                      전자서명 후 재등록
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* 바로등록 모달 */}
      {showDirectReg && (
        <div className="fixed inset-0 z-[200] bg-black/60 flex items-end justify-center" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }} onClick={() => setShowDirectReg(false)}>
          <div className="bg-card border border-border rounded-t-2xl w-full max-w-md flex flex-col" style={{ maxHeight: 'calc(90svh - env(safe-area-inset-bottom))' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-border shrink-0">
              <h2 className="font-semibold text-foreground">회원 바로등록</h2>
              <button onClick={() => setShowDirectReg(false)} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
            </div>
            <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
              {/* 이름 */}
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">이름 <span className="text-primary">*</span></label>
                <input value={directForm.name} onChange={e => setDirectForm(f => ({ ...f, name: e.target.value }))} placeholder="홍길동"
                  className="w-full rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:outline-none" />
              </div>
              {/* 연락처 */}
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">연락처</label>
                <input value={directForm.phone} onChange={e => setDirectForm(f => ({ ...f, phone: e.target.value }))} placeholder="010-0000-0000"
                  className="w-full rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:outline-none" />
              </div>
              {/* 생년월일 + 만나이 */}
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">생년월일</label>
                <input type="date" value={directForm.birthDate} onChange={e => setDirectForm(f => ({ ...f, birthDate: e.target.value }))}
                  className="w-full rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:outline-none" />
                {directForm.birthDate && (() => {
                  const b = new Date(directForm.birthDate), t = new Date();
                  let age = t.getFullYear() - b.getFullYear();
                  const mo = t.getMonth() - b.getMonth();
                  if (mo < 0 || (mo === 0 && t.getDate() < b.getDate())) age--;
                  return <p className="text-xs text-primary">만 {age}세</p>;
                })()}
              </div>
              {/* 성별 */}
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">성별</label>
                <div className="flex gap-2">
                  {[["male","남성"],["female","여성"]].map(([v,l]) => (
                    <button key={v} type="button" onClick={() => setDirectForm(f => ({ ...f, gender: f.gender === v ? "" : v as any }))}
                      className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-colors ${directForm.gender === v ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border text-muted-foreground"}`}>{l}</button>
                  ))}
                </div>
              </div>
              {/* 등급 */}
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">등급</label>
                <div className="flex gap-2">
                  {[["basic","기본"],["vip","VIP"]].map(([v,l]) => (
                    <button key={v} type="button" onClick={() => setDirectForm(f => ({ ...f, grade: v as any }))}
                      className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-colors ${directForm.grade === v ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border text-muted-foreground"}`}>{l}</button>
                  ))}
                </div>
              </div>
              {/* 담당 트레이너 */}
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">담당 트레이너</label>
                <select value={directForm.trainerId} onChange={e => setDirectForm(f => ({ ...f, trainerId: e.target.value }))}
                  className="w-full rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:outline-none">
                  <option value="">미배정</option>
                  {(trainers ?? []).map(t => <option key={t.id} value={t.id}>{t.trainerName}</option>)}
                </select>
              </div>
              {/* 유입경로 */}
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">유입경로</label>
                <select value={directForm.visitRoute} onChange={e => setDirectForm(f => ({ ...f, visitRoute: e.target.value }))}
                  className="w-full rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:outline-none">
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
              {/* 특이사항 */}
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">특이사항</label>
                <textarea value={directForm.profileNote} onChange={e => setDirectForm(f => ({ ...f, profileNote: e.target.value }))} rows={2} placeholder="특이사항 입력"
                  className="w-full rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:outline-none resize-none" />
              </div>

              {/* 구분선 */}
              <div className="border-t border-border pt-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">운동 기간</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">운동 시작일</label>
                  <input type="date" value={directForm.membershipStart}
                    onChange={e => {
                      const start = e.target.value;
                      const end = calcEndDate(start, directForm.ptSessions);
                      setDirectForm(f => ({ ...f, membershipStart: start, membershipEnd: end }));
                    }}
                    className="w-full rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:outline-none" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">운동 만료일 <span className="text-primary text-xs">(자동계산)</span></label>
                  <input type="date" value={directForm.membershipEnd} readOnly
                    className="w-full rounded-lg px-3 py-2 text-sm text-foreground opacity-60 cursor-not-allowed" />
                </div>
              </div>

              {/* 구분선 */}
              <div className="border-t border-border pt-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">프로그램 / 결제</p>
              </div>

              {/* 프로그램 선택 — PT / 헬스 / 기타 accordion */}
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground">프로그램 (복수 선택 가능)</label>

                {/* PT */}
                <div className={`rounded-xl border transition-colors ${directForm.programTypes.includes("PT") ? "border-primary/60 bg-primary/5" : "border-border"}`}>
                  <button type="button"
                    onClick={() => setDirectForm(f => {
                      const has = f.programTypes.includes("PT");
                      return { ...f, programTypes: has ? f.programTypes.filter(x => x !== "PT") : [...f.programTypes, "PT"],
                        ptProgram: has ? "" : f.ptProgram, ptSessions: has ? "" : f.ptSessions, serviceSessions: has ? "" : f.serviceSessions };
                    })}
                    className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold">
                    <span className={directForm.programTypes.includes("PT") ? "text-primary" : "text-muted-foreground"}>PT</span>
                    {directForm.programTypes.includes("PT") && <span className="text-[10px] text-primary bg-primary/10 px-2 py-0.5 rounded-full">선택됨</span>}
                  </button>
                  {directForm.programTypes.includes("PT") && (
                    <div className="px-4 pb-4 space-y-3 border-t border-primary/20 pt-3">
                      <div>
                        <label className="text-xs text-muted-foreground">PT 프로그램</label>
                        <div className="flex gap-1.5 flex-wrap mt-1">
                          {["케어피티", "웨이트피티", "이벤트피티"].map(p => (
                            <button key={p} type="button"
                              onClick={() => setDirectForm(f => ({ ...f, ptProgram: f.ptProgram === p ? "" : p }))}
                              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${directForm.ptProgram === p ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground"}`}>{p}</button>
                          ))}
                        </div>
                        {directForm.ptProgram === "이벤트피티" && (
                          <div className="mt-2">
                            <select
                              className="w-full rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:outline-none"
                              defaultValue=""
                              onChange={e => {
                                const ev = (ptEvents ?? []).find((x: any) => String(x.id) === e.target.value);
                                if (ev) setDirectForm(f => ({
                                  ...f,
                                  serviceSessions: String(ev.serviceSessions),
                                  serviceSessionPrice: String(ev.serviceSessionPrice ?? 0),
                                }));
                              }}>
                              <option value="" disabled>이벤트 선택...</option>
                              {(ptEvents ?? []).map((ev: any) => (
                                <option key={ev.id} value={String(ev.id)}>
                                  {ev.name} (적용: {(ev.applicableSessions || String(ev.sessions)).split(",").map((s: string) => `${s}회`).join("·")}, 서비스 +{ev.serviceSessions}회{ev.serviceSessionPrice > 0 ? ` · 서비스단가 ${ev.serviceSessionPrice.toLocaleString()}원/회` : ""})
                                </option>
                              ))}
                            </select>
                            {(ptEvents ?? []).length === 0 && (
                              <p className="text-xs text-muted-foreground mt-1">현재 진행 중인 이벤트가 없습니다.</p>
                            )}
                          </div>
                        )}
                        <input value={!["케어피티","웨이트피티","이벤트피티"].includes(directForm.ptProgram) ? directForm.ptProgram : ""}
                          onChange={e => setDirectForm(f => ({ ...f, ptProgram: e.target.value }))}
                          placeholder="직접 입력"
                          className="w-full mt-2 rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:outline-none" />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">PT 횟수</label>
                        <div className="flex gap-1.5 flex-wrap mt-1">
                          {[10, 20, 30, 40, 50].map(n => (
                            <button key={n} type="button"
                              onClick={() => setDirectForm(f => {
                                const next = f.ptSessions === String(n) ? "" : String(n);
                                return { ...f, ptSessions: next, membershipEnd: calcEndDate(f.membershipStart, next) };
                              })}
                              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${directForm.ptSessions === String(n) ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground"}`}>{n}회</button>
                          ))}
                        </div>
                        <input value={directForm.ptSessions} onChange={e => setDirectForm(f => ({ ...f, ptSessions: e.target.value, membershipEnd: calcEndDate(f.membershipStart, e.target.value) }))}
                          placeholder="직접 입력" type="number" min="1"
                          className="w-full mt-2 rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:outline-none" />
                      </div>
                    </div>
                  )}
                </div>

                {/* 헬스 */}
                <div className={`rounded-xl border transition-colors ${directForm.programTypes.includes("헬스") ? "border-emerald-500/60 bg-emerald-500/5" : "border-border"}`}>
                  <button type="button"
                    onClick={() => setDirectForm(f => {
                      const has = f.programTypes.includes("헬스");
                      return { ...f, programTypes: has ? f.programTypes.filter(x => x !== "헬스") : [...f.programTypes, "헬스"],
                        healthDuration: has ? "" : f.healthDuration, membershipEnd: has ? "" : f.membershipEnd };
                    })}
                    className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold">
                    <span className={directForm.programTypes.includes("헬스") ? "text-emerald-400" : "text-muted-foreground"}>헬스</span>
                    {directForm.programTypes.includes("헬스") && <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">선택됨</span>}
                  </button>
                  {directForm.programTypes.includes("헬스") && (
                    <div className="px-4 pb-4 border-t border-emerald-500/20 pt-3">
                      <label className="text-xs text-muted-foreground">이용 기간</label>
                      <div className="flex gap-2 mt-1">
                        {[1, 3, 6, 12].map(d => (
                          <button key={d} type="button"
                            onClick={() => setDirectForm(f => {
                              const dur = String(d);
                              const svcDays = parseInt(f.healthServiceDays || "0");
                              const end = f.membershipStart
                                ? (() => { const e = new Date(f.membershipStart); e.setMonth(e.getMonth() + d); if (svcDays > 0) e.setDate(e.getDate() + svcDays); return e.toISOString().substring(0, 10); })()
                                : "";
                              return { ...f, healthDuration: f.healthDuration === dur ? "" : dur, membershipEnd: f.healthDuration === dur ? "" : end };
                            })}
                            className={`flex-1 py-2 rounded-lg text-sm font-semibold border transition-colors ${directForm.healthDuration === String(d) ? "bg-emerald-500 text-white border-emerald-500" : "bg-background border-border text-muted-foreground"}`}>
                            {d}개월
                          </button>
                        ))}
                      </div>
                      <div className="mt-3">
                        <label className="text-xs text-muted-foreground">기본 서비스 기간 <span className="text-muted-foreground/60">(일 단위)</span></label>
                        <div className="flex items-center gap-2 mt-1">
                          {[0, 7, 14, 30].map(n => (
                            <button key={n} type="button"
                              onClick={() => setDirectForm(f => {
                                const months = parseInt(f.healthDuration || "0");
                                const end = f.membershipStart && months > 0
                                  ? (() => { const e = new Date(f.membershipStart); e.setMonth(e.getMonth() + months); if (n > 0) e.setDate(e.getDate() + n); return e.toISOString().substring(0, 10); })()
                                  : f.membershipEnd;
                                return { ...f, healthServiceDays: f.healthServiceDays === String(n) ? "" : String(n), membershipEnd: end };
                              })}
                              className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors ${directForm.healthServiceDays === String(n) ? "bg-emerald-500 text-white border-emerald-500" : "bg-background border-border text-muted-foreground"}`}>
                              {n === 0 ? "없음" : `+${n}일`}
                            </button>
                          ))}
                          <input type="number" min="0" placeholder="직접"
                            value={directForm.healthServiceDays && !["0","7","14","30"].includes(directForm.healthServiceDays) ? directForm.healthServiceDays : ""}
                            onChange={e => setDirectForm(f => {
                              const n = parseInt(e.target.value || "0");
                              const months = parseInt(f.healthDuration || "0");
                              const end = f.membershipStart && months > 0
                                ? (() => { const dd = new Date(f.membershipStart); dd.setMonth(dd.getMonth() + months); if (n > 0) dd.setDate(dd.getDate() + n); return dd.toISOString().substring(0, 10); })()
                                : f.membershipEnd;
                              return { ...f, healthServiceDays: e.target.value, membershipEnd: end };
                            })}
                            className="w-14 rounded-lg px-2 py-1.5 text-xs text-center text-foreground focus:outline-none focus:outline-none" />
                        </div>
                      </div>
                      {directForm.membershipEnd && directForm.programTypes.includes("헬스") && (
                        <p className="text-xs text-emerald-400 font-medium mt-1">만료일: {directForm.membershipEnd}</p>
                      )}
                    </div>
                  )}
                </div>

                {/* 기타 */}
                <div className={`rounded-xl border transition-colors ${directForm.programTypes.includes("기타") ? "border-amber-500/60 bg-amber-500/5" : "border-border"}`}>
                  <button type="button"
                    onClick={() => setDirectForm(f => {
                      const has = f.programTypes.includes("기타");
                      return { ...f, programTypes: has ? f.programTypes.filter(x => x !== "기타") : [...f.programTypes, "기타"],
                        otherItem: has ? "" : f.otherItem };
                    })}
                    className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold">
                    <span className={directForm.programTypes.includes("기타") ? "text-amber-400" : "text-muted-foreground"}>기타 <span className="font-normal text-xs">(운동복, 락커 등)</span></span>
                    {directForm.programTypes.includes("기타") && <span className="text-[10px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full">선택됨</span>}
                  </button>
                  {directForm.programTypes.includes("기타") && (
                    <div className="px-4 pb-4 border-t border-amber-500/20 pt-3 space-y-2">
                      <div className="flex gap-2">
                        {["락커", "운동복"].map(item => {
                          const selected = directForm.otherItem.split(",").map(s => s.trim()).includes(item);
                          return (
                            <button key={item} type="button"
                              onClick={() => {
                                const items = directForm.otherItem.split(",").map(s => s.trim()).filter(Boolean);
                                const next = items.includes(item) ? items.filter(x => x !== item) : [...items, item];
                                setDirectForm(f => ({ ...f, otherItem: next.join(", ") }));
                              }}
                              className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${selected ? "bg-amber-500 text-white border-amber-500" : "border-border text-muted-foreground hover:bg-accent"}`}>
                              {item}
                            </button>
                          );
                        })}
                      </div>
                      <p className="text-xs text-amber-400/70">
                        개월 수는 헬스 등록 기간{directForm.healthDuration ? ` (${directForm.healthDuration}개월)` : ""}과 동일하게 적용됩니다
                      </p>
                    </div>
                  )}
                </div>
              </div>
              {/* 결제 금액 / 미수금 */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">결제 금액</label>
                  <input type="number" min="0" value={directForm.paymentAmount} onChange={e => setDirectForm(f => ({ ...f, paymentAmount: e.target.value }))} placeholder="0"
                    className="w-full rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:outline-none" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">미수금 금액</label>
                  <input type="number" min="0" value={directForm.unpaidAmount} onChange={e => setDirectForm(f => ({ ...f, unpaidAmount: e.target.value }))} placeholder="0"
                    className="w-full rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:outline-none" />
                </div>
              </div>
              {/* 결제방법 */}
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">결제방법</label>
                <select value={directForm.paymentMethod} onChange={e => setDirectForm(f => ({ ...f, paymentMethod: e.target.value as any }))}
                  className="w-full rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:outline-none">
                  <option value="">결제방법 선택</option>
                  {["현금영수증", "이체", "지역화폐", "카드", "혼합"].map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              {/* 결제일자 */}
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">결제일자</label>
                <input type="date" value={directForm.paymentDate} onChange={e => setDirectForm(f => ({ ...f, paymentDate: e.target.value }))}
                  className="w-full rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:outline-none" />
              </div>
              {/* 결제 메모 */}
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">결제 메모</label>
                <input value={directForm.paymentMemo} onChange={e => setDirectForm(f => ({ ...f, paymentMemo: e.target.value }))} placeholder="분납 등 메모"
                  className="w-full rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:outline-none" />
              </div>
              {/* 지점 선택 */}
              {branchList && branchList.length > 0 && (
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">지점</label>
                  <div className="flex gap-2 flex-wrap">
                    <button type="button" onClick={() => setDirectForm(f => ({ ...f, branchId: "" }))}
                      className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${!directForm.branchId ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border text-muted-foreground hover:text-foreground"}`}>
                      미지정
                    </button>
                    {branchList.map((b: any) => (
                      <button key={b.id} type="button" onClick={() => setDirectForm(f => ({ ...f, branchId: String(b.id) }))}
                        className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${directForm.branchId === String(b.id) ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border text-muted-foreground hover:text-foreground"}`}>
                        {b.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="border-t border-border shrink-0 bg-card"
              style={{ padding: '0.75rem 1rem', paddingBottom: 'max(env(safe-area-inset-bottom), 0.75rem)' }}>
              <button type="button" disabled={directRegMutation.isPending}
                onClick={openDirectSig}
                className="w-full bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white rounded-xl py-3 text-sm font-bold disabled:opacity-50">
                {directRegMutation.isPending ? "등록 중..." : "전자서명 후 등록"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 상담 폼 모달 */}
      {showForm && (
        <div className="fixed inset-0 z-[200] bg-black/60 flex items-end justify-center"
          style={{
            paddingLeft: '3vw', paddingRight: '3vw',
            paddingTop: 'max(env(safe-area-inset-top), 1rem)',
            paddingBottom: 'env(safe-area-inset-bottom)',
          }}>
          <div className="bg-card border border-border rounded-t-2xl w-full max-w-[520px] flex flex-col modal-sheet-h overflow-hidden">
            {/* 헤더 */}
            <div className="bg-card border-b border-border px-4 py-3 flex items-center justify-between shrink-0">
              <h2 className="font-semibold text-foreground">{editId ? "상담 수정" : "상담 일지"}</h2>
              <button onClick={resetForm} className="text-muted-foreground hover:text-foreground p-1">✕</button>
            </div>

            {/* 스크롤 내용 */}
            <div className="overflow-y-auto scroll-touch flex-1 p-4 space-y-4 overscroll-contain">

              {/* 이름 / 연락처 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">이름 *</label>
                  <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="홍길동"
                    className="w-full mt-1 rounded-lg px-3 py-2.5 text-[16px] text-foreground focus:outline-none focus:outline-none" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">연락처</label>
                  <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="010-0000-0000"
                    inputMode="tel"
                    className="w-full mt-1 rounded-lg px-3 py-2.5 text-[16px] text-foreground focus:outline-none focus:outline-none" />
                </div>
              </div>

              {/* 성별 / 연령대 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">성별</label>
                  <div className="flex gap-2 mt-1">
                    {["남", "여"].map(g => (
                      <button key={g} type="button" onClick={() => setForm(f => ({ ...f, gender: f.gender === g ? "" : g }))}
                        className={`flex-1 py-2.5 rounded-lg text-sm font-medium border transition-colors ${form.gender === g ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border text-muted-foreground hover:text-foreground"}`}>
                        {g}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">연령대</label>
                  <select value={form.ageGroup} onChange={e => setForm(f => ({ ...f, ageGroup: e.target.value }))}
                    className="w-full mt-1 rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none">
                    <option value="">선택</option>
                    {AGE_OPTIONS.map(a => <option key={a}>{a}</option>)}
                  </select>
                </div>
              </div>

              {/* 상담 유형 대분류 — 복수 선택 */}
              <div>
                <label className="text-xs text-muted-foreground">상담 유형 (복수 선택 가능)</label>
                <div className="flex gap-2 mt-1">
                  {MAIN_TYPES.map(t => (
                    <button key={t} type="button" onClick={() => toggleMainType(t)}
                      className={`flex-1 py-2.5 rounded-lg text-sm font-medium border transition-colors ${form.consultationTypes.includes(t) ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border text-muted-foreground hover:text-foreground"}`}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* 관심 프로그램 */}
              <div className="space-y-2">
                <div>
                  <label className="text-xs text-muted-foreground">관심 프로그램</label>
                  <div className="flex gap-2 mt-1">
                    {INTEREST_OPTIONS.map(o => (
                      <button key={o} type="button"
                        onClick={() => setForm(f => ({ ...f, interestType: f.interestType === o ? "" : o, exercisePurposes: o !== "PT" ? [] : f.exercisePurposes }))}
                        className={`flex-1 py-2.5 rounded-lg text-sm font-medium border transition-colors ${form.interestType === o ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border text-muted-foreground hover:text-foreground"}`}>
                        {o}
                      </button>
                    ))}
                  </div>
                </div>

                {/* PT 선택 시 운동 목적 */}
                {form.interestType === "PT" && (
                  <div>
                    <label className="text-xs text-muted-foreground">운동 목적 (복수 선택 가능)</label>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {EXERCISE_PURPOSES.map(p => (
                        <button key={p} type="button"
                          onClick={() => setForm(f => {
                            const exists = f.exercisePurposes.includes(p);
                            return { ...f, exercisePurposes: exists ? f.exercisePurposes.filter(x => x !== p) : [...f.exercisePurposes, p] };
                          })}
                          className={`px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${form.exercisePurposes.includes(p) ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border text-muted-foreground hover:text-foreground"}`}>
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* 상담일 / 유입 채널 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">상담일</label>
                  <input type="date" value={form.consultationDate} onChange={e => setForm(f => ({ ...f, consultationDate: e.target.value }))}
                    className="w-full mt-1 rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:outline-none" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">유입 채널</label>
                  <select value={form.channelId ?? ""} onChange={e => setForm(f => ({ ...f, channelId: e.target.value ? Number(e.target.value) : undefined }))}
                    className="w-full mt-1 rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none">
                    <option value="">선택</option>
                    {(channels ?? []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>

              {/* 상담 담당자 - 트레이너 계정은 본인 고정 */}
              {isTrainer ? (
                <div>
                  <label className="text-xs text-muted-foreground">상담 담당자</label>
                  <div className="w-full mt-1 bg-muted border border-border rounded-lg px-3 py-2 text-sm text-muted-foreground">
                    {trainers?.find(t => t.id === me?.trainerId)?.trainerName ?? me?.username ?? "본인"} (본인)
                  </div>
                </div>
              ) : (
                <div>
                  <label className="text-xs text-muted-foreground">상담 담당자</label>
                  <select
                    value={form.assignedConsultantId ? `c:${form.assignedConsultantId}` : form.assignedTrainerId ? `t:${form.assignedTrainerId}` : ""}
                    onChange={e => {
                      const v = e.target.value;
                      if (!v) setForm(f => ({ ...f, assignedTrainerId: undefined, assignedConsultantId: undefined }));
                      else if (v.startsWith("t:")) setForm(f => ({ ...f, assignedTrainerId: Number(v.slice(2)), assignedConsultantId: undefined }));
                      else setForm(f => ({ ...f, assignedConsultantId: Number(v.slice(2)), assignedTrainerId: undefined }));
                    }}
                    className="w-full mt-1 rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none">
                    <option value="">선택</option>
                    {(consultants ?? []).length > 0 && (
                      <optgroup label="프론트 컨설턴트">
                        {(consultants ?? []).map((c: any) => <option key={c.id} value={`c:${c.id}`}>{c.username}</option>)}
                      </optgroup>
                    )}
                    {(trainers ?? []).length > 0 && (
                      <optgroup label="트레이너">
                        {(trainers ?? []).map((t: any) => <option key={t.id} value={`t:${t.id}`}>{t.trainerName}</option>)}
                      </optgroup>
                    )}
                  </select>
                </div>
              )}

              {/* 상담 내용 */}
              <div>
                <label className="text-xs text-muted-foreground">상담 내용</label>
                <textarea value={form.consultationNote} onChange={e => setForm(f => ({ ...f, consultationNote: e.target.value }))} rows={3}
                  placeholder="상담 내용을 입력하세요..."
                  className="w-full mt-1 rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:outline-none resize-none" />
              </div>

              {/* 등록 진행 내용 */}
              <div>
                <label className="text-xs text-muted-foreground">등록 진행 내용</label>
                <textarea value={form.memo} onChange={e => setForm(f => ({ ...f, memo: e.target.value }))} rows={2}
                  placeholder="운동 가능 시간, 날짜, 특이사항..."
                  className="w-full mt-1 rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:outline-none resize-none" />
              </div>

            </div>

            {/* 하단 버튼 — sticky + safe area */}
            <div className="border-t border-border shrink-0 space-y-2 bg-card"
              style={{ padding: '0.75rem 1rem', paddingBottom: 'max(env(safe-area-inset-bottom), 0.75rem)' }}>
              <p className="text-xs text-muted-foreground text-center">아래 버튼을 누르면 상담 일지가 저장됩니다</p>
              <div className="flex gap-2">
                <button type="button" onClick={() => handleSave("followup")}
                  className="flex-1 bg-blue-500 text-white rounded-xl py-3 text-sm font-semibold hover:bg-blue-600 active:bg-blue-700 transition-colors">
                  상담완료
                </button>
                <button type="button" onClick={editId && editHasSig ? () => handleSave("registered") : openContract}
                  className="flex-1 bg-emerald-500 text-white rounded-xl py-3 text-sm font-semibold hover:bg-emerald-600 active:bg-emerald-700 transition-colors">
                  등록완료
                </button>
              </div>
              {existingRevenue && (
                <button type="button" onClick={() => openRegEdit(existingRevenue)}
                  className="w-full border border-emerald-500/40 text-emerald-400 rounded-xl py-2.5 text-sm font-medium hover:bg-emerald-500/10 active:bg-emerald-500/20 transition-colors">
                  ✏️ 등록 내용 수정
                </button>
              )}
              {editId && !isSubAdmin && (
                <button type="button" onClick={() => { if (confirm("삭제하시겠습니까?")) { deleteMutation.mutate({ id: editId }); resetForm(); } }}
                  className="w-full border border-red-500/30 text-red-400 rounded-xl py-2.5 text-sm font-medium hover:bg-red-500/10 active:bg-red-500/20">
                  삭제
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── 전자서명 모달 ───────────────────────────────────────────────────────────
function SignatureModal({
  memberName,
  onConfirm,
  onBack,
}: {
  memberName: string;
  onConfirm: (dataUrl: string) => void;
  onBack: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);
  const [hasDrawn, setHasDrawn] = useState(false);

  const getPos = (e: React.TouchEvent | React.MouseEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ("touches" in e) {
      const touch = e.touches[0];
      return { x: (touch.clientX - rect.left) * scaleX, y: (touch.clientY - rect.top) * scaleY };
    }
    return { x: ((e as React.MouseEvent).clientX - rect.left) * scaleX, y: ((e as React.MouseEvent).clientY - rect.top) * scaleY };
  };

  const startDraw = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    isDrawing.current = true;
    lastPos.current = getPos(e, canvas);
  };

  const draw = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    if (!isDrawing.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const pos = getPos(e, canvas);
    if (lastPos.current) {
      ctx.beginPath();
      ctx.moveTo(lastPos.current.x, lastPos.current.y);
      ctx.lineTo(pos.x, pos.y);
      ctx.strokeStyle = "#1a1a2e";
      ctx.lineWidth = 2.5;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.stroke();
      setHasDrawn(true);
    }
    lastPos.current = pos;
  };

  const endDraw = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    isDrawing.current = false;
    lastPos.current = null;
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  };

  const confirmSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    onConfirm(canvas.toDataURL("image/png"));
  };

  return (
    <div className="fixed inset-0 z-[310] bg-black/80 flex items-center justify-center"
      style={{ padding: 'max(env(safe-area-inset-top), 1rem) 1rem max(env(safe-area-inset-bottom), 1rem)' }}>
      <div className="bg-card border border-border rounded-2xl w-full max-w-md flex flex-col gap-4 p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PenLine className="w-5 h-5 text-emerald-400" />
            <h2 className="font-bold text-foreground">전자 서명</h2>
          </div>
          <button onClick={onBack} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-sm text-muted-foreground text-center">
          <span className="text-foreground font-semibold">{memberName}</span> 고객님,<br />
          아래 서명란에 직접 서명해 주세요.
        </p>

        {/* 서명 캔버스 */}
        <div className="border-2 border-dashed border-emerald-500/50 rounded-xl bg-white relative overflow-hidden"
          style={{ touchAction: "none" }}>
          <canvas
            ref={canvasRef}
            width={640}
            height={240}
            className="w-full"
            style={{ display: "block", cursor: "crosshair" }}
            onMouseDown={startDraw}
            onMouseMove={draw}
            onMouseUp={endDraw}
            onMouseLeave={endDraw}
            onTouchStart={startDraw}
            onTouchMove={draw}
            onTouchEnd={endDraw}
          />
          {!hasDrawn && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <p className="text-gray-400 text-sm select-none">여기에 서명하세요</p>
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={clearCanvas}
            className="flex items-center gap-1.5 px-4 py-2.5 border border-border rounded-xl text-sm text-muted-foreground hover:bg-muted/30 transition-colors">
            <RotateCcw className="w-4 h-4" />
            다시 쓰기
          </button>
          <button
            type="button"
            onClick={confirmSignature}
            disabled={!hasDrawn}
            className="flex-1 flex items-center justify-center gap-2 bg-emerald-500 text-white rounded-xl py-2.5 text-sm font-bold hover:bg-emerald-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
            <Check className="w-4 h-4" />
            서명 완료
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── 서명된 계약서 확인 모달 ─────────────────────────────────────────────────
function SignedContractModal({
  memberName,
  memberPhone,
  marketing,
  signatureDataUrl,
  regForm,
  onPrint,
  onConfirm,
}: {
  memberName: string;
  memberPhone: string;
  marketing: boolean;
  signatureDataUrl: string;
  regForm: RegForm;
  onPrint: () => void;
  onConfirm: () => void;
}) {
  const today = new Date().toLocaleDateString("ko-KR");

  const programLabel = (() => {
    const parts: string[] = [];
    if (regForm.itemTypes.includes("PT")) {
      const prog = regForm.programKey === "기타" ? (regForm.programCustom || "기타PT") : regForm.programKey;
      parts.push(`PT${prog ? ` (${prog})` : ""}${regForm.sessions ? ` ${regForm.sessions}회` : ""}`);
    }
    if (regForm.itemTypes.includes("헬스")) parts.push(`헬스 ${regForm.duration ? regForm.duration + "개월" : ""}`);
    if (regForm.itemTypes.includes("기타")) parts.push(regForm.otherItem || "기타");
    return parts.join(" + ") || "—";
  })();

  const fmt = (v: string | number) => v ? Number(v).toLocaleString() + "원" : "0원";

  return (
    <div className="fixed inset-0 z-[310] bg-black/80 flex items-center justify-center"
      style={{ padding: 'max(env(safe-area-inset-top), 1rem) 1rem max(env(safe-area-inset-bottom), 1rem)' }}>
      <div className="bg-card border border-border rounded-2xl w-full max-w-md flex flex-col"
        style={{ maxHeight: 'calc(100svh - max(env(safe-area-inset-top), 1rem) - max(env(safe-area-inset-bottom), 1rem))' }}>
        {/* 헤더 */}
        <div className="sticky top-0 bg-card border-b border-border px-4 py-3 flex items-center gap-2 shrink-0 rounded-t-2xl">
          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          <h2 className="font-bold text-foreground flex-1">서명 완료</h2>
          <span className="text-xs text-muted-foreground">계약서를 확인하세요</span>
        </div>

        {/* 계약서 미리보기 */}
        <div className="overflow-y-auto flex-1 p-4">
          <div className="bg-white text-gray-800 rounded-xl p-5 text-xs leading-relaxed shadow-sm"
            style={{ fontFamily: "'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif" }}>

            {/* 계약서 헤더 */}
            <div className="text-center border-b border-gray-300 pb-4 mb-4">
              <p className="text-base font-bold tracking-widest">자이언트짐</p>
              <p className="text-xs text-gray-500">GIANT GYM</p>
              <p className="text-sm font-bold mt-2 tracking-wider">회 원 계 약 서</p>
            </div>

            {/* 회원 정보 */}
            <div className="border border-gray-200 rounded p-3 mb-4 grid grid-cols-2 gap-y-2">
              <div><span className="text-gray-500">성명</span> <span className="font-semibold ml-2">{memberName}</span></div>
              <div><span className="text-gray-500">연락처</span> <span className="font-semibold ml-2">{memberPhone || "—"}</span></div>
              <div className="col-span-2"><span className="text-gray-500">계약일</span> <span className="font-semibold ml-2">{today}</span></div>
            </div>

            {/* 등록 내역 */}
            <div className="border border-gray-200 rounded p-3 mb-4">
              <p className="text-gray-500 font-semibold text-xs mb-2">등록 내역</p>
              <div className="space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-gray-500">구분</span>
                  <span className="font-semibold">{regForm.subType}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">프로그램</span>
                  <span className="font-semibold text-right max-w-[60%]">{programLabel}</span>
                </div>
                <div className="border-t border-gray-100 pt-1.5 mt-1.5 space-y-1">
                  <div className="flex justify-between">
                    <span className="text-gray-500">정가</span>
                    <span>{fmt(regForm.amount)}</span>
                  </div>
                  {Number(regForm.discountAmount) > 0 && (
                    <div className="flex justify-between text-red-500">
                      <span>할인</span>
                      <span>- {fmt(regForm.discountAmount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-semibold border-t border-gray-100 pt-1">
                    <span className="text-gray-700">실결제</span>
                    <span className="text-gray-900">{fmt(regForm.paidAmount || regForm.amount)}</span>
                  </div>
                  {Number(regForm.unpaidAmount) > 0 && (
                    <div className="flex justify-between text-orange-500">
                      <span>미수금</span>
                      <span>{fmt(regForm.unpaidAmount)}</span>
                    </div>
                  )}
                </div>
                <div className="flex justify-between pt-1">
                  <span className="text-gray-500">결제방법</span>
                  <span className="font-semibold">{regForm.paymentMethod || "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">결제일</span>
                  <span>{regForm.paymentDate}</span>
                </div>
                {regForm.startDate && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">시작일</span>
                    <span>{regForm.startDate}</span>
                  </div>
                )}
              </div>
            </div>

            {/* 동의 항목 요약 */}
            <div className="space-y-1.5 mb-4">
              <div className="flex items-center gap-2">
                <span className="text-emerald-600 font-bold">✓</span>
                <span className="font-medium">(필수) 센터 이용 약관 동의</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-emerald-600 font-bold">✓</span>
                <span className="font-medium">(필수) 개인정보 수집·이용 동의</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={marketing ? "text-blue-600 font-bold" : "text-gray-300 font-bold"}>
                  {marketing ? "✓" : "✗"}
                </span>
                <span className={marketing ? "font-medium" : "text-gray-400"}>
                  (선택) 광고성 정보 수신 동의 {marketing ? "— 동의" : "— 미동의"}
                </span>
              </div>
            </div>

            {/* 서명 */}
            <div className="border-t border-gray-300 pt-3">
              <p className="text-gray-600 mb-2 text-center text-xs">
                본인은 위 약관의 내용을 충분히 읽고 이해하였으며, 이에 동의하여 서명합니다.
              </p>
              <div className="flex justify-between items-end gap-4">
                <div>
                  <p className="text-gray-500 text-xs mb-1">계약일</p>
                  <p className="text-xs font-medium border-b border-gray-300 pb-1">{today}</p>
                </div>
                <div className="flex-1">
                  <p className="text-gray-500 text-xs mb-1">회원 서명</p>
                  <div className="border border-gray-200 rounded bg-gray-50 flex items-center justify-center"
                    style={{ height: "64px" }}>
                    <img src={signatureDataUrl} alt="서명" className="max-h-full max-w-full object-contain" />
                  </div>
                </div>
              </div>
              <div className="mt-3 text-center">
                <p className="text-xs font-semibold text-gray-700">ZIANT GYM</p>
                <div className="mt-1 inline-block border-b border-gray-400 w-32 pb-5"></div>
                <span className="text-xs text-gray-400 ml-1">(서명/인)</span>
              </div>
            </div>
          </div>
        </div>

        {/* 하단 버튼 */}
        <div className="p-4 border-t border-border shrink-0 space-y-2">
          <button
            type="button"
            onClick={onConfirm}
            className="w-full flex items-center justify-center gap-2 bg-emerald-500 text-white rounded-xl py-3 text-sm font-bold hover:bg-emerald-600 transition-colors">
            <Check className="w-4 h-4" />
            확인 후 등록 진행
          </button>
          <button
            type="button"
            onClick={onPrint}
            className="w-full flex items-center justify-center gap-2 border border-emerald-500/40 text-emerald-400 rounded-xl py-2.5 text-sm font-medium hover:bg-emerald-500/10 transition-colors">
            <Printer className="w-4 h-4" />
            계약서 인쇄 / PDF 저장
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── 등록완료 카드 내 PAR-Q 버튼 ─────────────────────────────────────────────
function ParQButton({ lead }: { lead: any }) {
  const [, setLocation] = useLocation();
  const { data: members = [] } = trpc.members.list.useQuery();

  function handleClick(e: React.MouseEvent) {
    e.stopPropagation();
    let memberId = lead.registeredMemberId;
    if (!memberId) {
      const found = members.find((m: any) => m.name === lead.name);
      memberId = found?.id;
    }
    if (memberId) {
      setLocation(`/members/${memberId}/parq`);
    }
  }

  return (
    <button
      onClick={handleClick}
      className="mt-1 w-full flex items-center justify-center gap-1.5 border border-blue-500/30 text-blue-400 rounded-lg py-2 text-xs font-medium hover:bg-blue-500/10 transition-colors"
    >
      <ClipboardList className="w-3.5 h-3.5" />
      PAR-Q 사전건강검사
    </button>
  );
}

// ─── 등록완료 카드 내 계약서 PDF 버튼 ────────────────────────────────────────
function ContractPdfButton({ lead }: { lead: any }) {
  const { data: entry, isLoading } = trpc.gym.revenue.byLead.useQuery({ leadId: lead.id });

  function openPdf(e: React.MouseEvent) {
    e.stopPropagation();
    const date = lead.consultationDate
      ? new Date(lead.consultationDate).toLocaleDateString("ko-KR")
      : new Date().toLocaleDateString("ko-KR");

    const p = new URLSearchParams({
      name: lead.name ?? "",
      phone: lead.phone ?? "",
      date,
      marketing: "0",
    });

    if (entry) {
      const programParts: string[] = [];
      if (entry.type === "PT") programParts.push(`PT${entry.programDetail ? ` (${entry.programDetail})` : ""}${entry.sessions ? ` ${entry.sessions}회` : ""}`);
      else if (entry.type === "헬스") programParts.push(`헬스${entry.duration ? ` ${entry.duration}개월` : ""}`);
      else if (entry.type === "기타" && entry.programDetail) programParts.push(entry.programDetail);

      p.set("subType", entry.subType ?? "신규");
      p.set("itemTypes", entry.type ?? "");
      p.set("programKey", entry.programDetail ?? "");
      p.set("sessions", entry.sessions?.toString() ?? "");
      p.set("duration", entry.duration?.toString() ?? "");
      p.set("amount", entry.amount?.toString() ?? "");
      p.set("discountAmount", entry.discountAmount?.toString() ?? "0");
      p.set("paidAmount", entry.paidAmount?.toString() ?? "");
      p.set("unpaidAmount", entry.unpaidAmount?.toString() ?? "0");
      p.set("paymentMethod", entry.paymentMethod ?? "");
      p.set("paymentDate", entry.paymentDate ?? "");
      p.set("startDate", entry.startDate ?? "");
    }

    if (lead.signatureDataUrl) {
      const sigKey = `contract_sig_${Date.now()}`;
      localStorage.setItem(sigKey, lead.signatureDataUrl);
      p.set("sigKey", sigKey);
    }

    window.open(`/contract-print?${p.toString()}`, "_blank");
  }

  return (
    <button
      onClick={openPdf}
      disabled={isLoading}
      className="mt-1 w-full flex items-center justify-center gap-1.5 border border-emerald-500/30 text-emerald-400 rounded-lg py-2 text-xs font-medium hover:bg-emerald-500/10 transition-colors disabled:opacity-40"
    >
      <FileText className="w-3.5 h-3.5" />
      계약서 PDF 출력
    </button>
  );
}

