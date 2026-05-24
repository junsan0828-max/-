import { useState, useRef, useEffect, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Plus, Search, Phone, MessageSquare, CheckCircle2, UserCheck, ChevronLeft, ChevronRight, Zap, UserPlus, RefreshCw, ClipboardList } from "lucide-react";
import TabBanner from "@/components/TabBanner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

// 관리상담: consulted 상태이고 상담일로부터 7일 이내
function resolveDisplayStatus(status: string, consultationDate: string | null | undefined): string {
  if (status === "consulted" && consultationDate) {
    const days = Math.floor((Date.now() - new Date(consultationDate).getTime()) / 86400000);
    if (days <= 7) return "managed";
  }
  return status;
}

const STATUS_OPTIONS = [
  { value: "managed",    label: "관리상담", color: "text-yellow-400",  bg: "bg-yellow-400/10",  icon: ClipboardList },
  { value: "consulted",  label: "상담완료", color: "text-blue-400",    bg: "bg-blue-400/10",    icon: MessageSquare },
  { value: "registered", label: "등록완료", color: "text-emerald-400", bg: "bg-emerald-400/10", icon: CheckCircle2 },
];

const CONSULT_TYPES: Record<string, string[]> = {
  "방문상담": [], "예약상담": ["플레이스", "전화예약"], "소개상담": ["지인소개", "가족소개"],
};
const MAIN_TYPES = Object.keys(CONSULT_TYPES);
const INTEREST_OPTIONS = ["PT", "필라테스", "기타"];
const AGE_OPTIONS = ["10대", "20대", "30대", "40대", "50대이상"];
const EXERCISE_PURPOSES = [
  "다이어트 (체중 감량)", "체형교정 (자세 개선)", "통증 개선 (목/허리/무릎 등)",
  "재활 운동 (병원 진단 후 운동)", "근력/체력 향상", "바디라인 개선 (근육, 몸매)",
  "건강 관리 (예방 목적)", "운동 습관 만들기", "기타",
];
const PT_PROGRAMS = ["피티", "필라테스", "이벤트 세션", "기타"];
const PT_SESSIONS = [10, 20, 30, 40, 50];
const DURATIONS = [1, 3, 6, 12];
const PAYMENT_METHODS = ["카드", "현금", "계좌이체", "지역화폐"];

const CONTRACT_TERMS = `제1조 (목적)
본 약관은 센터가 제공하는 피트니스 서비스 이용에 관한 제반 사항을 규정함을 목적으로 합니다.

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

보유 및 이용 기간: 동의일로부터 회원 탈퇴 또는 수신 거부 시까지

귀하는 광고성 정보 수신에 동의하지 않아도 센터 이용에 아무런 불이익이 없습니다.`;

type LeadForm = {
  name: string; phone: string; gender: string; ageGroup: string;
  channelId?: number;
  consultationDate: string;
  consultationTypes: string[];
  consultationSubTypes: string[];
  consultationNote: string;
  interestType: string;
  exercisePurposes: string[];
  memo: string;
};

type RegForm = {
  itemTypes: string[];
  subType: "신규" | "재등록";
  programKey: string; programCustom: string;
  sessions?: number; duration?: number; otherItem: string;
  amount: string; discountAmount: string; paidAmount: string; unpaidAmount: string;
  paymentMethod: string; paymentDate: string; startDate: string; memo: string;
};

const defaultForm: LeadForm = {
  name: "", phone: "", gender: "", ageGroup: "",
  consultationDate: new Date().toISOString().substring(0, 10),
  consultationTypes: [], consultationSubTypes: [],
  consultationNote: "", interestType: "", exercisePurposes: [], memo: "",
};

const defaultReg: RegForm = {
  itemTypes: [], subType: "신규", programKey: "", programCustom: "",
  sessions: undefined, duration: undefined, otherItem: "",
  amount: "", discountAmount: "0", paidAmount: "", unpaidAmount: "0",
  paymentMethod: "", paymentDate: new Date().toISOString().substring(0, 10),
  startDate: new Date().toISOString().substring(0, 10), memo: "",
};

export default function LeadsPage() {
  const utils = trpc.useUtils();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<LeadForm>(defaultForm);

  const [showContract, setShowContract] = useState(false);
  const [agreedTerms, setAgreedTerms] = useState(false);
  const [agreedPrivacy, setAgreedPrivacy] = useState(false);
  const [agreedMarketing, setAgreedMarketing] = useState(false);
  const [signatureData, setSignatureData] = useState<string>("");
  const signatureCanvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef = useRef(false);

  const [showRegistration, setShowRegistration] = useState(false);
  const [regForm, setRegForm] = useState<RegForm>(defaultReg);

  const pendingLeadIdRef = useRef<number | null>(null);

  const { data: leadsData, isLoading } = trpc.leads.list.useQuery({ year, month });
  const { data: channels } = trpc.channels.list.useQuery();
  const { data: allMembers } = trpc.members.list.useQuery();
  const { data: contractTerms } = trpc.trainers.getContractTerms.useQuery();

  // 바로등록 상태
  const [showQuickModal, setShowQuickModal] = useState(false);
  const [quickStep, setQuickStep] = useState<"select" | "new" | "rereg">("select");
  const [quickName, setQuickName] = useState("");
  const [quickPhone, setQuickPhone] = useState("");
  const [reregMemberId, setReregMemberId] = useState("");
  const [reregPkg, setReregPkg] = useState({
    ptProgram: "", totalSessions: "", startDate: "", expiryDate: "",
    paymentAmount: "", unpaidAmount: "",
    paymentMethod: "" as "" | "현금영수증" | "이체" | "지역화폐" | "카드",
    paymentMemo: "",
  });

  const addPackageMutation = trpc.pt.addPackage.useMutation({
    onSuccess: () => {
      toast.success("재등록 완료!");
      setShowQuickModal(false);
      setReregMemberId("");
      setReregPkg({ ptProgram: "", totalSessions: "", startDate: "", expiryDate: "", paymentAmount: "", unpaidAmount: "", paymentMethod: "", paymentMemo: "" });
      utils.leads.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  function openQuickModal() {
    setQuickStep("select");
    setQuickName("");
    setQuickPhone("");
    setShowQuickModal(true);
  }

  function startQuickNew() {
    if (!quickName.trim()) return toast.error("이름을 입력해주세요");
    setShowQuickModal(false);
    setEditId(null);
    setForm({ ...defaultForm, name: quickName, phone: quickPhone });
    setAgreedTerms(false); setAgreedPrivacy(false); setAgreedMarketing(false);
    setSignatureData("");
    setShowContract(true);
  }

  const createMutation = trpc.leads.create.useMutation({
    onSuccess: (data) => {
      utils.leads.invalidate();
      if (pendingLeadIdRef.current === -1) {
        pendingLeadIdRef.current = data.id;
        setShowForm(false);
        // 등록 모달은 confirmRegistration에서 이미 열었음
      } else {
        toast.success("상담이 등록되었습니다");
        resetForm();
      }
    },
    onError: (e) => { pendingLeadIdRef.current = null; toast.error(e.message); },
  });
  const updateMutation = trpc.leads.update.useMutation({
    onSuccess: (data) => {
      utils.leads.invalidate();
      if (pendingLeadIdRef.current === -2) {
        pendingLeadIdRef.current = data!.id;
        setShowForm(false);
        // 등록 모달은 confirmRegistration에서 이미 열었음
      } else {
        toast.success("수정되었습니다");
        resetForm();
      }
    },
    onError: (e) => { pendingLeadIdRef.current = null; toast.error(e.message); },
  });
  const deleteMutation = trpc.leads.delete.useMutation({
    onSuccess: () => { toast.success("삭제되었습니다"); utils.leads.invalidate(); },
  });
  const registerMutation = trpc.leads.register.useMutation({
    onSuccess: () => { toast.success("등록 완료! 회원이 생성되었습니다"); utils.leads.invalidate(); resetForm(); },
    onError: (e) => toast.error("등록 실패: " + e.message),
  });

  function resetForm() {
    setShowForm(false); setEditId(null); setForm(defaultForm);
    setShowContract(false); setAgreedTerms(false); setAgreedPrivacy(false); setAgreedMarketing(false);
    setSignatureData("");
    setShowRegistration(false); setRegForm(defaultReg);
    pendingLeadIdRef.current = null;
  }

  function openEdit(row: any) {
    setEditId(row.lead.id);
    setForm({
      name: row.lead.name, phone: row.lead.phone ?? "", gender: row.lead.gender ?? "",
      ageGroup: row.lead.ageGroup ?? "", channelId: row.lead.channelId ?? undefined,
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
      const newTypes = f.consultationTypes.includes(type) ? f.consultationTypes.filter(t => t !== type) : [...f.consultationTypes, type];
      const validSubs = newTypes.flatMap(t => CONSULT_TYPES[t] ?? []);
      return { ...f, consultationTypes: newTypes, consultationSubTypes: f.consultationSubTypes.filter(s => validSubs.includes(s)) };
    });
  }
  function toggleSubType(sub: string) {
    setForm(f => ({ ...f, consultationSubTypes: f.consultationSubTypes.includes(sub) ? f.consultationSubTypes.filter(s => s !== sub) : [...f.consultationSubTypes, sub] }));
  }

  function buildPayload(status: string) {
    return {
      name: form.name, phone: form.phone || undefined,
      gender: form.gender || undefined, ageGroup: form.ageGroup || undefined,
      channelId: form.channelId,
      consultationDate: form.consultationDate || undefined,
      consultationType: form.consultationTypes.length > 0 ? form.consultationTypes.join(",") : undefined,
      consultationSubTypes: form.consultationSubTypes.length > 0 ? form.consultationSubTypes.join(",") : undefined,
      consultationNote: form.consultationNote || undefined,
      interestType: form.interestType || undefined,
      exercisePurpose: form.exercisePurposes.length > 0 ? form.exercisePurposes.join(",") : undefined,
      memo: form.memo || undefined,
      status,
    };
  }

  function handleSave(status: string) {
    if (!form.name.trim()) return toast.error("이름을 입력해주세요");
    if (editId) updateMutation.mutate({ id: editId, ...buildPayload(status) });
    else createMutation.mutate(buildPayload(status));
  }

  function openContract() {
    if (!form.name.trim()) return toast.error("이름을 입력해주세요");
    setAgreedTerms(false); setAgreedPrivacy(false); setAgreedMarketing(false);
    setSignatureData("");
    setShowContract(true);
  }

  function clearSignature() {
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setSignatureData("");
  }

  function getPos(canvas: HTMLCanvasElement, e: MouseEvent | TouchEvent) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ("touches" in e) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY,
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }

  const handleSignatureStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    isDrawingRef.current = true;
    const pos = getPos(canvas, e.nativeEvent as MouseEvent | TouchEvent);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  }, []);

  const handleSignatureMove = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (!isDrawingRef.current) return;
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const pos = getPos(canvas, e.nativeEvent as MouseEvent | TouchEvent);
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#1a1a2e";
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  }, []);

  const handleSignatureEnd = useCallback(() => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;
    setSignatureData(canvas.toDataURL("image/png"));
  }, []);

  function confirmRegistration() {
    if (!agreedTerms) return toast.error("이용약관에 동의해주세요");
    if (!agreedPrivacy) return toast.error("개인정보 수집·이용에 동의해주세요");
    if (!signatureData) return toast.error("서명을 해주세요");
    sessionStorage.setItem("contractSignature", signatureData);
    setShowContract(false);
    const preTypes = INTEREST_OPTIONS.includes(form.interestType) ? [form.interestType] : [];
    setRegForm({ ...defaultReg, itemTypes: preTypes, paymentDate: new Date().toISOString().substring(0, 10), startDate: new Date().toISOString().substring(0, 10) });
    // 등록 모달 즉시 오픈 (API 응답 기다리지 않음)
    setShowRegistration(true);
    if (editId) {
      pendingLeadIdRef.current = -2;
      updateMutation.mutate({ id: editId, ...buildPayload("registered") });
    } else {
      pendingLeadIdRef.current = -1;
      createMutation.mutate(buildPayload("registered"));
    }
  }

  function saveRegistration() {
    const leadId = pendingLeadIdRef.current;
    // leadId가 아직 -1/-2면 API 처리 중이므로 잠시 대기
    if (!leadId || leadId < 0) return toast.error("잠시 후 다시 시도해주세요 (처리 중)");
    if (!regForm.paymentDate) return toast.error("결제일을 입력해주세요");
    if (!Number(regForm.amount)) return toast.error("금액을 입력해주세요");
    registerMutation.mutate({
      leadId,
      name: form.name, phone: form.phone || undefined, gender: form.gender || undefined,
      itemTypes: regForm.itemTypes,
      programKey: regForm.programKey || undefined, programCustom: regForm.programCustom || undefined,
      sessions: regForm.sessions, duration: regForm.duration, subType: regForm.subType,
      amount: Number(regForm.amount), discountAmount: Number(regForm.discountAmount),
      paidAmount: Number(regForm.paidAmount), unpaidAmount: Number(regForm.unpaidAmount),
      paymentMethod: regForm.paymentMethod || undefined,
      paymentDate: regForm.paymentDate, startDate: regForm.startDate || undefined,
      memo: regForm.memo || undefined,
    });
  }

  function prevMonth() { if (month === 1) { setYear(y => y - 1); setMonth(12); } else setMonth(m => m - 1); }
  function nextMonth() { if (month === 12) { setYear(y => y + 1); setMonth(1); } else setMonth(m => m + 1); }

  const filtered = (leadsData ?? []).filter(row => {
    const q = search.toLowerCase();
    const display = resolveDisplayStatus(row.lead.status, row.lead.consultationDate);
    return (!q || row.lead.name.toLowerCase().includes(q) || (row.lead.phone ?? "").includes(q))
      && (!filterStatus || display === filterStatus);
  });

  const statCounts = STATUS_OPTIONS.map(s => ({
    ...s,
    count: (leadsData ?? []).filter(r => resolveDisplayStatus(r.lead.status, r.lead.consultationDate) === s.value).length,
  }));
  const total = (leadsData ?? []).length;
  const registered = (leadsData ?? []).filter(r => r.lead.status === "registered").length;
  const conversionRate = total > 0 ? Math.round((registered / total) * 100) : 0;

  return (
    <div className="space-y-4">
      <TabBanner tabKey="leads" />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">상담실</h1>
          <p className="text-xs text-muted-foreground">월별 상담 및 전환 관리</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={openQuickModal}
            className="flex items-center gap-1.5 bg-emerald-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors"
          >
            <Zap className="h-4 w-4" /> 바로등록
          </button>
          <button
            onClick={() => { setShowForm(true); setEditId(null); setForm({ ...defaultForm, consultationDate: new Date().toISOString().substring(0, 10) }); }}
            className="flex items-center gap-1.5 bg-primary text-primary-foreground px-3 py-2 rounded-lg text-sm font-medium hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" /> 상담 추가
          </button>
        </div>
      </div>

      <div className="flex items-center justify-center gap-3 bg-card border border-border rounded-xl px-4 py-3">
        <button onClick={prevMonth} className="text-muted-foreground hover:text-foreground"><ChevronLeft className="h-5 w-5" /></button>
        <span className="text-base font-semibold min-w-[100px] text-center">{year}년 {month}월</span>
        <button onClick={nextMonth} className="text-muted-foreground hover:text-foreground"><ChevronRight className="h-5 w-5" /></button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {statCounts.map(s => (
          <button key={s.value} onClick={() => setFilterStatus(filterStatus === s.value ? "" : s.value)}
            className={`rounded-xl p-3 border transition-all text-center ${filterStatus === s.value ? `${s.bg} border-current ${s.color}` : "bg-card border-border"}`}>
            <div className={`text-xl font-bold ${s.color}`}>{s.count}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{s.label}</div>
          </button>
        ))}
      </div>

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

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="이름, 전화번호 검색..."
          className="w-full bg-card border border-border rounded-lg pl-9 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
      </div>

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
            const displayStatus = resolveDisplayStatus(row.lead.status, row.lead.consultationDate);
            const s = STATUS_OPTIONS.find(s => s.value === displayStatus);
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
                    {s && <s.icon className="h-3 w-3" />}{s?.label}
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5 text-xs">
                  {mainTypes.map(mt => <span key={mt} className="bg-primary/10 text-primary px-2 py-0.5 rounded-full">{mt}</span>)}
                  {subTypes.map(st => <span key={st} className="bg-muted text-muted-foreground px-2 py-0.5 rounded-full">{st}</span>)}
                  {row.lead.interestType && <span className="bg-amber-400/10 text-amber-400 px-2 py-0.5 rounded-full">{row.lead.interestType}</span>}
                  {row.channelName && <span className="bg-muted text-muted-foreground px-2 py-0.5 rounded-full">{row.channelName}</span>}
                </div>
                {row.lead.consultationNote && <p className="text-xs text-muted-foreground line-clamp-2">{row.lead.consultationNote}</p>}
              </div>
            );
          })}
        </div>
      )}

      {/* ── 계약서 모달 ── */}
      {showContract && (
        <div className="fixed inset-0 z-[300] bg-black/70 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md flex flex-col" style={{ maxHeight: "92vh" }}>
            <div className="sticky top-0 bg-card border-b border-border px-4 py-3 flex items-center justify-between shrink-0 rounded-t-2xl">
              <h2 className="font-bold text-foreground">회원 계약서</h2>
              <button onClick={() => setShowContract(false)} className="text-muted-foreground hover:text-foreground">✕</button>
            </div>
            <div className="overflow-y-auto flex-1 p-4 space-y-5">
              <div className="space-y-2">
                <h3 className="font-semibold text-sm text-foreground">이용 약관</h3>
                <div className="bg-background border border-border rounded-lg p-3 h-36 overflow-y-auto">
                  <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-sans leading-relaxed">{contractTerms?.termsOfService || CONTRACT_TERMS}</pre>
                </div>
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input type="checkbox" checked={agreedTerms} onChange={e => setAgreedTerms(e.target.checked)} className="w-4 h-4 accent-emerald-500 shrink-0" />
                  <span className="text-sm text-foreground"><span className="text-emerald-500 font-semibold">(필수)</span> 이용약관에 동의합니다</span>
                </label>
              </div>
              <div className="space-y-2">
                <h3 className="font-semibold text-sm text-foreground">개인정보 수집·이용 동의서</h3>
                <div className="bg-background border border-border rounded-lg p-3 h-36 overflow-y-auto">
                  <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-sans leading-relaxed">{contractTerms?.privacyPolicy || PRIVACY_TERMS}</pre>
                </div>
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input type="checkbox" checked={agreedPrivacy} onChange={e => setAgreedPrivacy(e.target.checked)} className="w-4 h-4 accent-emerald-500 shrink-0" />
                  <span className="text-sm text-foreground"><span className="text-emerald-500 font-semibold">(필수)</span> 개인정보 수집·이용에 동의합니다</span>
                </label>
              </div>
              <div className="space-y-2">
                <h3 className="font-semibold text-sm text-foreground">광고성 정보 수신 동의서</h3>
                <div className="bg-background border border-border rounded-lg p-3 h-28 overflow-y-auto">
                  <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-sans leading-relaxed">{contractTerms?.marketingConsent || MARKETING_TERMS}</pre>
                </div>
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input type="checkbox" checked={agreedMarketing} onChange={e => setAgreedMarketing(e.target.checked)} className="w-4 h-4 accent-blue-500 shrink-0" />
                  <span className="text-sm text-foreground"><span className="text-blue-400 font-semibold">(선택)</span> 광고성 정보 수신에 동의합니다</span>
                </label>
              </div>
              {/* 전자 서명 */}
              <div className="space-y-2 pb-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-sm text-foreground">전자 서명 <span className="text-emerald-500">(필수)</span></h3>
                  <button type="button" onClick={clearSignature} className="text-xs text-muted-foreground hover:text-foreground border border-border rounded px-2 py-0.5 transition-colors">지우기</button>
                </div>
                <p className="text-xs text-muted-foreground">아래 칸에 손가락 또는 마우스로 서명해 주세요</p>
                <canvas
                  ref={signatureCanvasRef}
                  width={600}
                  height={160}
                  className="w-full rounded-lg border-2 border-dashed touch-none cursor-crosshair"
                  style={{ borderColor: signatureData ? "#10b981" : "#6b7280", background: "#ffffff" }}
                  onMouseDown={handleSignatureStart}
                  onMouseMove={handleSignatureMove}
                  onMouseUp={handleSignatureEnd}
                  onMouseLeave={handleSignatureEnd}
                  onTouchStart={handleSignatureStart}
                  onTouchMove={handleSignatureMove}
                  onTouchEnd={handleSignatureEnd}
                />
                {signatureData
                  ? <p className="text-xs text-emerald-500 font-medium">✓ 서명 완료</p>
                  : <p className="text-xs text-muted-foreground">서명 후 등록 진행이 가능합니다</p>
                }
              </div>
            </div>
            <div className="p-4 border-t border-border shrink-0 space-y-2">
              <button type="button" onClick={confirmRegistration} disabled={!agreedTerms || !agreedPrivacy || !signatureData}
                className="w-full bg-emerald-500 text-white rounded-xl py-3 text-sm font-bold hover:bg-emerald-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                동의 후 등록 진행
              </button>
              <button type="button" onClick={() => setShowContract(false)}
                className="w-full border border-border text-muted-foreground rounded-xl py-2.5 text-sm font-medium hover:bg-muted/30">
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 바로등록 모달 ── */}
      {showQuickModal && (
        <div className="fixed inset-0 z-[300] bg-black/70 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-sm flex flex-col">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between rounded-t-2xl">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-emerald-400" />
                <h2 className="font-bold">바로등록</h2>
              </div>
              <button onClick={() => setShowQuickModal(false)} className="text-muted-foreground hover:text-foreground">✕</button>
            </div>

            {/* 유형 선택 */}
            {quickStep === "select" && (
              <div className="p-4 space-y-3">
                <p className="text-sm text-muted-foreground">등록 유형을 선택하세요.</p>
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => setQuickStep("new")}
                    className="flex flex-col items-center gap-2 p-5 rounded-xl border border-border bg-accent/20 hover:border-primary/50 hover:bg-primary/10 transition-colors">
                    <UserPlus className="h-8 w-8 text-primary" />
                    <span className="text-sm font-bold">신규등록</span>
                    <span className="text-xs text-muted-foreground text-center">새 회원 + 전자계약</span>
                  </button>
                  <button onClick={() => setQuickStep("rereg")}
                    className="flex flex-col items-center gap-2 p-5 rounded-xl border border-border bg-accent/20 hover:border-emerald-500/50 hover:bg-emerald-500/10 transition-colors">
                    <RefreshCw className="h-8 w-8 text-emerald-400" />
                    <span className="text-sm font-bold">재등록</span>
                    <span className="text-xs text-muted-foreground text-center">기존 회원 패키지 추가</span>
                  </button>
                </div>
              </div>
            )}

            {/* 신규등록 — 기본 정보 입력 후 전자계약 진행 */}
            {quickStep === "new" && (
              <div className="p-4 space-y-3">
                <button onClick={() => setQuickStep("select")} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">← 뒤로</button>
                <p className="text-sm font-semibold">신규 회원 정보</p>
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">이름 *</label>
                  <Input value={quickName} onChange={e => setQuickName(e.target.value)} placeholder="회원 이름" className="h-9 text-sm bg-input border-border" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">연락처</label>
                  <Input value={quickPhone} onChange={e => setQuickPhone(e.target.value)} placeholder="010-0000-0000" className="h-9 text-sm bg-input border-border" />
                </div>
                <p className="text-xs text-muted-foreground">이름 입력 후 전자계약 화면으로 이동합니다.</p>
                <div className="flex gap-2">
                  <button onClick={() => setShowQuickModal(false)} className="flex-1 border border-border text-muted-foreground rounded-xl py-2.5 text-sm">취소</button>
                  <button onClick={startQuickNew} className="flex-1 bg-primary text-primary-foreground rounded-xl py-2.5 text-sm font-bold hover:bg-primary/90">전자계약 진행</button>
                </div>
              </div>
            )}

            {/* 재등록 — 기존 회원 선택 + 패키지 */}
            {quickStep === "rereg" && (
              <div className="p-4 space-y-3 max-h-[75vh] overflow-y-auto">
                <button onClick={() => setQuickStep("select")} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">← 뒤로</button>
                <p className="text-sm font-semibold">재등록 — 기존 회원</p>
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">회원 선택 *</label>
                  <Select value={reregMemberId} onValueChange={setReregMemberId}>
                    <SelectTrigger className="h-9 text-sm bg-input border-border"><SelectValue placeholder="회원 선택" /></SelectTrigger>
                    <SelectContent>{allMembers?.map(m => <SelectItem key={m.id} value={String(m.id)}>{m.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">프로그램명</label>
                  <Input className="h-9 text-sm bg-input border-border" placeholder="예: 피티" value={reregPkg.ptProgram} onChange={e => setReregPkg(p => ({ ...p, ptProgram: e.target.value }))} />
                  <div className="flex gap-1.5 flex-wrap">
                    {["피티", "필라테스", "이벤트 세션"].map(pr => (
                      <button key={pr} onClick={() => setReregPkg(p => ({ ...p, ptProgram: p.ptProgram === pr ? "" : pr }))}
                        className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${reregPkg.ptProgram === pr ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground"}`}>{pr}</button>
                    ))}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">총 세션 수 *</label>
                  <Input className="h-9 text-sm bg-input border-border" type="number" min={1} placeholder="횟수" value={reregPkg.totalSessions} onChange={e => setReregPkg(p => ({ ...p, totalSessions: e.target.value }))} />
                  <div className="flex gap-1.5 flex-wrap">
                    {["10", "20", "30", "40", "50"].map(pr => (
                      <button key={pr} onClick={() => setReregPkg(p => ({ ...p, totalSessions: p.totalSessions === pr ? "" : pr }))}
                        className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${reregPkg.totalSessions === pr ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground"}`}>{pr}회</button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1.5">
                    <label className="text-xs text-muted-foreground">시작일</label>
                    <Input className="h-9 text-sm bg-input border-border" type="date" value={reregPkg.startDate} onChange={e => setReregPkg(p => ({ ...p, startDate: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs text-muted-foreground">만료일</label>
                    <Input className="h-9 text-sm bg-input border-border" type="date" value={reregPkg.expiryDate} onChange={e => setReregPkg(p => ({ ...p, expiryDate: e.target.value }))} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1.5">
                    <label className="text-xs text-muted-foreground">결제금액 (원)</label>
                    <Input className="h-9 text-sm bg-input border-border" type="number" placeholder="0" value={reregPkg.paymentAmount} onChange={e => setReregPkg(p => ({ ...p, paymentAmount: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs text-muted-foreground">미수금 (원)</label>
                    <Input className="h-9 text-sm bg-input border-border" type="number" placeholder="0" value={reregPkg.unpaidAmount} onChange={e => setReregPkg(p => ({ ...p, unpaidAmount: e.target.value }))} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">결제 방법</label>
                  <Select value={reregPkg.paymentMethod} onValueChange={v => setReregPkg(p => ({ ...p, paymentMethod: v as any }))}>
                    <SelectTrigger className="h-9 text-sm bg-input border-border"><SelectValue placeholder="선택" /></SelectTrigger>
                    <SelectContent>{["현금영수증", "이체", "지역화폐", "카드"].map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">메모</label>
                  <Textarea className="text-sm resize-none bg-input border-border" rows={2} placeholder="결제 메모" value={reregPkg.paymentMemo} onChange={e => setReregPkg(p => ({ ...p, paymentMemo: e.target.value }))} />
                </div>
                <div className="flex gap-2 pt-1">
                  <button onClick={() => setShowQuickModal(false)} className="flex-1 border border-border text-muted-foreground rounded-xl py-2.5 text-sm">취소</button>
                  <button
                    disabled={!reregMemberId || !reregPkg.totalSessions || addPackageMutation.isPending}
                    onClick={() => {
                      if (!reregMemberId || !reregPkg.totalSessions) return;
                      addPackageMutation.mutate({
                        memberId: Number(reregMemberId),
                        ptProgram: reregPkg.ptProgram || undefined,
                        totalSessions: Number(reregPkg.totalSessions),
                        startDate: reregPkg.startDate || undefined,
                        expiryDate: reregPkg.expiryDate || undefined,
                        paymentAmount: reregPkg.paymentAmount ? Number(reregPkg.paymentAmount) : undefined,
                        unpaidAmount: reregPkg.unpaidAmount ? Number(reregPkg.unpaidAmount) : undefined,
                        paymentMethod: reregPkg.paymentMethod || undefined,
                        paymentMemo: reregPkg.paymentMemo || undefined,
                      });
                    }}
                    className="flex-1 bg-emerald-600 text-white rounded-xl py-2.5 text-sm font-bold hover:bg-emerald-700 disabled:opacity-40">
                    {addPackageMutation.isPending ? "등록 중..." : "재등록 완료"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── 등록 상세 모달 ── */}
      {showRegistration && (
        <div className="fixed inset-0 z-[300] bg-black/70 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md flex flex-col" style={{ maxHeight: "92vh" }}>
            <div className="sticky top-0 bg-card border-b border-border px-4 py-3 flex items-center justify-between shrink-0 rounded-t-2xl">
              <div>
                <h2 className="font-bold text-foreground">등록 상세 정보</h2>
                <p className="text-xs text-muted-foreground">{form.name} · {form.interestType || "기타"}</p>
              </div>
              <button onClick={() => setShowRegistration(false)} className="text-muted-foreground hover:text-foreground">✕</button>
            </div>
            <div className="overflow-y-auto flex-1 p-4 space-y-4">
              <div>
                <label className="text-xs text-muted-foreground">구분</label>
                <div className="flex gap-2 mt-1">
                  <button type="button"
                    className="flex-1 py-2 rounded-lg text-sm font-medium border bg-primary text-primary-foreground border-primary">
                    신규
                  </button>
                  <button type="button" disabled
                    className="flex-1 py-2 rounded-lg text-sm font-medium border bg-background border-border text-muted-foreground/40 cursor-not-allowed">
                    재등록
                  </button>
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">항목 유형 (복수 선택)</label>
                <div className="flex gap-2 mt-1">
                  {["PT", "필라테스", "기타"].map(t => (
                    <button key={t} type="button"
                      onClick={() => setRegForm(f => ({ ...f, itemTypes: f.itemTypes.includes(t) ? f.itemTypes.filter(x => x !== t) : [...f.itemTypes, t] }))}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${regForm.itemTypes.includes(t) ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border text-muted-foreground"}`}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              {regForm.itemTypes.includes("PT") && (
                <div className="space-y-3 pl-3 border-l-2 border-primary/40">
                  <div>
                    <label className="text-xs text-muted-foreground">PT 프로그램</label>
                    <input
                      value={regForm.programCustom || regForm.programKey}
                      onChange={e => setRegForm(f => ({ ...f, programKey: "", programCustom: e.target.value }))}
                      placeholder="예: 피티"
                      className="w-full mt-1 bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">PT 횟수</label>
                    <div className="flex items-center gap-2 mt-1">
                      <input
                        type="number"
                        min={1}
                        value={regForm.sessions ?? ""}
                        onChange={e => setRegForm(f => ({ ...f, sessions: e.target.value ? parseInt(e.target.value) : undefined }))}
                        placeholder="횟수 직접 입력"
                        className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                      <span className="text-sm text-muted-foreground shrink-0">회</span>
                    </div>
                  </div>
                </div>
              )}
              {regForm.itemTypes.includes("필라테스") && (
                <div className="pl-3 border-l-2 border-primary/40">
                  <label className="text-xs text-muted-foreground">필라테스 이용 기간</label>
                  <div className="flex gap-2 mt-1">
                    {DURATIONS.map(d => (
                      <button key={d} type="button" onClick={() => setRegForm(f => ({ ...f, duration: f.duration === d ? undefined : d }))}
                        className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${regForm.duration === d ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border text-muted-foreground"}`}>
                        {d}개월
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {regForm.itemTypes.includes("기타") && (
                <div className="pl-3 border-l-2 border-primary/40">
                  <label className="text-xs text-muted-foreground">기타 항목명</label>
                  <input value={regForm.otherItem} onChange={e => setRegForm(f => ({ ...f, otherItem: e.target.value }))} placeholder="예: 락커, 운동복 등"
                    className="w-full mt-1 bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">정가 (원)</label>
                  <input type="number" value={regForm.amount} onChange={e => {
                    const amt = e.target.value;
                    const disc = Number(regForm.discountAmount) || 0;
                    setRegForm(f => ({ ...f, amount: amt, paidAmount: String(Math.max(0, Number(amt) - disc)), unpaidAmount: "0" }));
                  }} placeholder="0"
                    className="w-full mt-1 bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">할인 (원)</label>
                  <input type="number" value={regForm.discountAmount} onChange={e => {
                    const disc = e.target.value;
                    setRegForm(f => ({ ...f, discountAmount: disc, paidAmount: String(Math.max(0, Number(f.amount) - Number(disc))) }));
                  }} placeholder="0"
                    className="w-full mt-1 bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">실결제 (원)</label>
                  <input type="number" value={regForm.paidAmount} onChange={e => {
                    const paid = e.target.value;
                    setRegForm(f => ({ ...f, paidAmount: paid, unpaidAmount: String(Math.max(0, Number(f.amount) - Number(f.discountAmount) - Number(paid))) }));
                  }} placeholder="0"
                    className="w-full mt-1 bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">미수금 (원)</label>
                  <input type="number" value={regForm.unpaidAmount} onChange={e => setRegForm(f => ({ ...f, unpaidAmount: e.target.value }))} placeholder="0"
                    className="w-full mt-1 bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">결제 방법</label>
                <div className="grid grid-cols-4 gap-2 mt-1">
                  {PAYMENT_METHODS.map(m => (
                    <button key={m} type="button" onClick={() => setRegForm(f => ({ ...f, paymentMethod: f.paymentMethod === m ? "" : m }))}
                      className={`py-2 rounded-lg text-xs font-medium border transition-colors ${regForm.paymentMethod === m ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border text-muted-foreground"}`}>
                      {m}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">결제일 *</label>
                  <input type="date" value={regForm.paymentDate} onChange={e => setRegForm(f => ({ ...f, paymentDate: e.target.value }))}
                    className="w-full mt-1 bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">시작일</label>
                  <input type="date" value={regForm.startDate} onChange={e => setRegForm(f => ({ ...f, startDate: e.target.value }))}
                    className="w-full mt-1 bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">메모</label>
                <textarea value={regForm.memo} onChange={e => setRegForm(f => ({ ...f, memo: e.target.value }))} rows={2}
                  className="w-full mt-1 bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none" />
              </div>
            </div>
            <div className="p-4 border-t border-border shrink-0 space-y-2">
              <button type="button" onClick={saveRegistration}
                disabled={registerMutation.isPending || createMutation.isPending || updateMutation.isPending}
                className="w-full bg-emerald-500 text-white rounded-xl py-3 text-sm font-bold hover:bg-emerald-600 transition-colors disabled:opacity-50">
                {(createMutation.isPending || updateMutation.isPending) ? "계약 처리 중..." : registerMutation.isPending ? "등록 중..." : "등록 완료 및 회원 생성"}
              </button>
              <button type="button" onClick={() => setShowRegistration(false)}
                className="w-full border border-border text-muted-foreground rounded-xl py-2.5 text-sm font-medium hover:bg-muted/30">
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 상담 폼 모달 ── */}
      {showForm && (
        <div className="fixed inset-0 z-[200] bg-black/60 flex items-end md:items-center justify-center p-4 pb-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md flex flex-col" style={{ maxHeight: "90vh" }}>
            <div className="sticky top-0 bg-card border-b border-border px-4 py-3 flex items-center justify-between shrink-0">
              <h2 className="font-semibold text-foreground">{editId ? "상담 수정" : "상담 일지"}</h2>
              <button onClick={resetForm} className="text-muted-foreground hover:text-foreground">✕</button>
            </div>
            <div className="overflow-y-auto flex-1 p-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">이름 *</label>
                  <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="홍길동"
                    className="w-full mt-1 bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">연락처</label>
                  <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="010-0000-0000"
                    className="w-full mt-1 bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">성별</label>
                  <div className="flex gap-2 mt-1">
                    {["남", "여"].map(g => (
                      <button key={g} type="button" onClick={() => setForm(f => ({ ...f, gender: f.gender === g ? "" : g }))}
                        className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${form.gender === g ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border text-muted-foreground"}`}>
                        {g}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">연령대</label>
                  <select value={form.ageGroup} onChange={e => setForm(f => ({ ...f, ageGroup: e.target.value }))}
                    className="w-full mt-1 bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none">
                    <option value="">선택</option>
                    {AGE_OPTIONS.map(a => <option key={a}>{a}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">상담 유형 (복수 선택)</label>
                <div className="flex gap-2 mt-1">
                  {MAIN_TYPES.map(t => (
                    <button key={t} type="button" onClick={() => toggleMainType(t)}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${form.consultationTypes.includes(t) ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border text-muted-foreground"}`}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">관심 프로그램</label>
                <div className="flex gap-2 mt-1">
                  {INTEREST_OPTIONS.map(o => (
                    <button key={o} type="button"
                      onClick={() => setForm(f => ({ ...f, interestType: f.interestType === o ? "" : o, exercisePurposes: o !== "PT" ? [] : f.exercisePurposes }))}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${form.interestType === o ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border text-muted-foreground"}`}>
                      {o}
                    </button>
                  ))}
                </div>
                {form.interestType === "PT" && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {EXERCISE_PURPOSES.map(p => (
                      <button key={p} type="button"
                        onClick={() => setForm(f => ({ ...f, exercisePurposes: f.exercisePurposes.includes(p) ? f.exercisePurposes.filter(x => x !== p) : [...f.exercisePurposes, p] }))}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${form.exercisePurposes.includes(p) ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border text-muted-foreground"}`}>
                        {p}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">상담일</label>
                  <input type="date" value={form.consultationDate} onChange={e => setForm(f => ({ ...f, consultationDate: e.target.value }))}
                    className="w-full mt-1 bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">유입 채널</label>
                  <select value={form.channelId ?? ""} onChange={e => setForm(f => ({ ...f, channelId: e.target.value ? Number(e.target.value) : undefined }))}
                    className="w-full mt-1 bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none">
                    <option value="">선택</option>
                    {(channels ?? []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">상담 내용</label>
                <textarea value={form.consultationNote} onChange={e => setForm(f => ({ ...f, consultationNote: e.target.value }))} rows={3}
                  placeholder="상담 내용을 입력하세요..."
                  className="w-full mt-1 bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">메모</label>
                <textarea value={form.memo} onChange={e => setForm(f => ({ ...f, memo: e.target.value }))} rows={2}
                  className="w-full mt-1 bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none" />
              </div>
            </div>
            <div className="p-4 border-t border-border shrink-0 space-y-2">
              {editId ? (
                // 기존 상담 수정: 등록완료(계약서) or 확인(저장)
                <>
                  <div className="flex gap-2">
                    <button type="button"
                      onClick={() => {
                        const cur = (leadsData ?? []).find(r => r.lead.id === editId);
                        handleSave(cur?.lead.status ?? "consulted");
                      }}
                      className="flex-1 border border-border text-foreground rounded-lg py-2.5 text-sm font-semibold hover:bg-accent/40 transition-colors">
                      확인
                    </button>
                    <button type="button" onClick={openContract}
                      className="flex-1 bg-emerald-500 text-white rounded-lg py-2.5 text-sm font-semibold hover:bg-emerald-600 transition-colors">
                      등록완료
                    </button>
                  </div>
                  <button type="button" onClick={() => { if (confirm("삭제하시겠습니까?")) { deleteMutation.mutate({ id: editId }); resetForm(); } }}
                    className="w-full border border-red-500/30 text-red-400 rounded-lg py-2 text-sm font-medium hover:bg-red-500/10">
                    삭제
                  </button>
                </>
              ) : (
                // 신규 상담 추가: 상담완료 / 등록완료
                <div className="flex gap-2">
                  <button type="button" onClick={() => handleSave("consulted")}
                    className="flex-1 bg-blue-500 text-white rounded-lg py-2.5 text-sm font-semibold hover:bg-blue-600 transition-colors">
                    상담완료
                  </button>
                  <button type="button" onClick={openContract}
                    className="flex-1 bg-emerald-500 text-white rounded-lg py-2.5 text-sm font-semibold hover:bg-emerald-600 transition-colors">
                    등록완료
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
