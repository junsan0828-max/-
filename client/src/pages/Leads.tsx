import { useState, useRef } from "react";
import { trpc } from "../lib/trpc";
import { toast } from "sonner";
import {
  Plus, Search, Phone, MessageSquare, CheckCircle2,
  Clock, XCircle, UserCheck, ChevronLeft, ChevronRight,
} from "lucide-react";

const STATUS_OPTIONS = [
  { value: "pending",    label: "상담대기", color: "text-amber-400",  bg: "bg-amber-400/10",  icon: Clock },
  { value: "consulted",  label: "상담완료", color: "text-blue-400",   bg: "bg-blue-400/10",   icon: MessageSquare },
  { value: "registered", label: "등록완료", color: "text-emerald-400",bg: "bg-emerald-400/10",icon: CheckCircle2 },
  { value: "dropped",    label: "등록보류", color: "text-red-400",    bg: "bg-red-400/10",    icon: XCircle },
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
const PAYMENT_METHODS_REG = ["카드", "현금", "계좌이체", "지역화폐"];

type RegForm = {
  itemType: "PT" | "헬스" | "기타" | "";
  subType: "신규" | "재등록";
  programKey: string;
  programCustom: string;
  sessions?: number;
  duration?: number;
  amount: string;
  discountAmount: string;
  paidAmount: string;
  unpaidAmount: string;
  paymentMethod: string;
  paymentDate: string;
  startDate: string;
  memo: string;
};

const defaultRegForm: RegForm = {
  itemType: "",
  subType: "신규",
  programKey: "",
  programCustom: "",
  sessions: undefined,
  duration: undefined,
  amount: "",
  discountAmount: "0",
  paidAmount: "",
  unpaidAmount: "0",
  paymentMethod: "",
  paymentDate: new Date().toISOString().substring(0, 10),
  startDate: new Date().toISOString().substring(0, 10),
  memo: "",
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
  const [showRegistration, setShowRegistration] = useState(false);
  const [regForm, setRegForm] = useState<RegForm>(defaultRegForm);
  const regPendingRef = useRef<RegForm | null>(null);
  const pendingEditIdRef = useRef<number | null>(null);

  const { data: leadsData, isLoading } = trpc.gym.leads.list.useQuery({ year, month });
  const { data: channels } = trpc.gym.channels.list.useQuery();
  const { data: trainers } = trpc.trainers.list.useQuery();
  const { data: consultants } = trpc.admin.listConsultants.useQuery();

  const createRevenueMutation = trpc.gym.revenue.create.useMutation({
    onSuccess: () => { toast.success("등록 완료 및 매출 저장"); utils.gym.leads.invalidate(); utils.gym.revenue.invalidate(); resetForm(); },
    onError: (e) => { toast.error("매출 저장 실패: " + e.message); resetForm(); },
  });

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
    setShowForm(false); setEditId(null); setForm(defaultForm);
    setShowContract(false); setAgreedTerms(false); setAgreedPrivacy(false); setAgreedMarketing(false);
    setShowRegistration(false); setRegForm(defaultRegForm);
    regPendingRef.current = null; pendingEditIdRef.current = null;
  }

  function openContract() {
    if (!form.name.trim()) return toast.error("이름을 입력해주세요");
    setAgreedTerms(false); setAgreedPrivacy(false); setAgreedMarketing(false);
    setShowContract(true);
  }

  function confirmRegistration() {
    if (!agreedTerms) return toast.error("이용약관에 동의해주세요");
    if (!agreedPrivacy) return toast.error("개인정보 수집·이용에 동의해주세요");
    setShowContract(false);
    const preType = (form.interestType === "PT" || form.interestType === "헬스" || form.interestType === "기타")
      ? form.interestType : "";
    setRegForm({
      ...defaultRegForm,
      itemType: preType,
      paymentDate: new Date().toISOString().substring(0, 10),
      startDate: new Date().toISOString().substring(0, 10),
    });
    setShowRegistration(true);
  }

  function fireRevenueSave(reg: RegForm, leadId: number) {
    const type = (reg.itemType === "PT" || reg.itemType === "헬스" || reg.itemType === "기타") ? reg.itemType : "기타";
    const programDetail = type === "PT"
      ? (reg.programKey === "기타" ? reg.programCustom : reg.programKey)
      : undefined;
    createRevenueMutation.mutate({
      leadId,
      customerName: form.name,
      phone: form.phone || undefined,
      type,
      subType: reg.subType,
      programDetail: programDetail || undefined,
      sessions: type === "PT" ? reg.sessions : undefined,
      duration: type === "헬스" ? reg.duration : undefined,
      amount: Number(reg.amount) || 0,
      discountAmount: Number(reg.discountAmount) || 0,
      paidAmount: Number(reg.paidAmount) || 0,
      unpaidAmount: Number(reg.unpaidAmount) || 0,
      paymentMethod: reg.paymentMethod || undefined,
      paymentDate: reg.paymentDate,
      startDate: reg.startDate || undefined,
      memo: reg.memo || undefined,
    });
  }

  function saveRegistration() {
    const reg = regForm;
    if (!reg.paymentDate) return toast.error("결제일을 입력해주세요");
    const amount = Number(reg.amount);
    if (!amount) return toast.error("금액을 입력해주세요");
    regPendingRef.current = reg;
    handleSave("registered");
  }

  function openEdit(row: any) {
    setEditId(row.lead.id);
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
    const matchStatus = !filterStatus || row.lead.status === filterStatus;
    return matchSearch && matchStatus;
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">상담 CRM</h1>
          <p className="text-xs text-muted-foreground">월별 상담 및 전환 관리</p>
        </div>
        <button
          onClick={() => { setShowForm(true); setEditId(null); setForm({ ...defaultForm, consultationDate: new Date().toISOString().substring(0, 10) }); }}
          className="flex items-center gap-1.5 bg-primary text-primary-foreground px-3 py-2 rounded-lg text-sm font-medium hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          상담 추가
        </button>
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
      <div className="grid grid-cols-4 gap-2">
        {statCounts.map(s => (
          <button key={s.value} onClick={() => setFilterStatus(filterStatus === s.value ? "" : s.value)}
            className={`rounded-xl p-3 border transition-all text-center ${filterStatus === s.value ? `${s.bg} border-current ${s.color}` : "bg-card border-border"}`}>
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
              </div>
            );
          })}
        </div>
      )}

      {/* 계약서 모달 */}
      {showContract && (
        <div className="fixed inset-0 z-[300] bg-black/70 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md flex flex-col" style={{ maxHeight: "92vh" }}>
            {/* 헤더 */}
            <div className="sticky top-0 bg-card border-b border-border px-4 py-3 flex items-center justify-between shrink-0 rounded-t-2xl">
              <h2 className="font-bold text-foreground">회원 계약서</h2>
              <button onClick={() => setShowContract(false)} className="text-muted-foreground hover:text-foreground">✕</button>
            </div>

            <div className="overflow-y-auto flex-1 p-4 space-y-5">

              {/* 섹션 1: 이용약관 */}
              <div className="space-y-2">
                <h3 className="font-semibold text-sm text-foreground">센터 이용 약관</h3>
                <div className="bg-background border border-border rounded-lg p-3 h-36 overflow-y-auto">
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
                <div className="bg-background border border-border rounded-lg p-3 h-36 overflow-y-auto">
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
                <div className="bg-background border border-border rounded-lg p-3 h-28 overflow-y-auto">
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
            <div className="p-4 border-t border-border shrink-0 space-y-2">
              <button
                type="button"
                onClick={confirmRegistration}
                disabled={!agreedTerms || !agreedPrivacy}
                className="w-full bg-emerald-500 text-white rounded-xl py-3 text-sm font-bold hover:bg-emerald-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                동의 후 등록 완료
              </button>
              <button
                type="button"
                onClick={() => {
                  const p = new URLSearchParams({ name: form.name, phone: form.phone || "", date: new Date().toLocaleDateString("ko-KR"), marketing: agreedMarketing ? "1" : "0" });
                  window.open(`/contract-print?${p.toString()}`, "_blank");
                }}
                className="w-full border border-emerald-500/40 text-emerald-400 rounded-xl py-2.5 text-sm font-medium hover:bg-emerald-500/10 transition-colors">
                계약서 PDF 출력
              </button>
              <button type="button" onClick={() => setShowContract(false)}
                className="w-full border border-border text-muted-foreground rounded-xl py-2.5 text-sm font-medium hover:bg-muted/30">
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 등록 상세 모달 */}
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

              {/* 신규/재등록 */}
              <div>
                <label className="text-xs text-muted-foreground">구분</label>
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

              {/* 항목 유형 선택 */}
              <div>
                <label className="text-xs text-muted-foreground">항목 유형</label>
                <div className="flex gap-2 mt-1">
                  {(["PT", "헬스", "기타"] as const).map(t => (
                    <button key={t} type="button"
                      onClick={() => setRegForm(f => ({ ...f, itemType: t, programKey: "", programCustom: "", sessions: undefined, duration: undefined }))}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${regForm.itemType === t ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border text-muted-foreground"}`}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* PT 프로그램 + 횟수 */}
              {regForm.itemType === "PT" && (
                <>
                  <div>
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
                        className="w-full mt-2 bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
                    )}
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">PT 횟수</label>
                    <div className="flex gap-2 mt-1">
                      {PT_SESSIONS.map(n => (
                        <button key={n} type="button"
                          onClick={() => setRegForm(f => ({ ...f, sessions: f.sessions === n ? undefined : n }))}
                          className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${regForm.sessions === n ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border text-muted-foreground"}`}>
                          {n}회
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* 헬스 기간 */}
              {regForm.itemType === "헬스" && (
                <div>
                  <label className="text-xs text-muted-foreground">이용 기간</label>
                  <div className="flex gap-2 mt-1">
                    {DURATIONS.map(d => (
                      <button key={d} type="button"
                        onClick={() => setRegForm(f => ({ ...f, duration: f.duration === d ? undefined : d }))}
                        className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${regForm.duration === d ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border text-muted-foreground"}`}>
                        {d}개월
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* 기타 항목명 */}
              {regForm.itemType === "기타" && (
                <div>
                  <label className="text-xs text-muted-foreground">항목명</label>
                  <input value={regForm.programKey}
                    onChange={e => setRegForm(f => ({ ...f, programKey: e.target.value }))}
                    placeholder="예: 락커, 운동복 등"
                    className="w-full mt-1 bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
                </div>
              )}

              {/* 금액 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">정가 (원)</label>
                  <input type="number" value={regForm.amount}
                    onChange={e => {
                      const amt = e.target.value;
                      const disc = Number(regForm.discountAmount) || 0;
                      const paid = Math.max(0, Number(amt) - disc);
                      setRegForm(f => ({ ...f, amount: amt, paidAmount: String(paid), unpaidAmount: "0" }));
                    }}
                    placeholder="0"
                    className="w-full mt-1 bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">할인 (원)</label>
                  <input type="number" value={regForm.discountAmount}
                    onChange={e => {
                      const disc = e.target.value;
                      const paid = Math.max(0, Number(regForm.amount) - Number(disc));
                      setRegForm(f => ({ ...f, discountAmount: disc, paidAmount: String(paid) }));
                    }}
                    placeholder="0"
                    className="w-full mt-1 bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">실결제 (원)</label>
                  <input type="number" value={regForm.paidAmount}
                    onChange={e => {
                      const paid = e.target.value;
                      const unpaid = Math.max(0, Number(regForm.amount) - Number(regForm.discountAmount) - Number(paid));
                      setRegForm(f => ({ ...f, paidAmount: paid, unpaidAmount: String(unpaid) }));
                    }}
                    placeholder="0"
                    className="w-full mt-1 bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">미수금 (원)</label>
                  <input type="number" value={regForm.unpaidAmount}
                    onChange={e => setRegForm(f => ({ ...f, unpaidAmount: e.target.value }))}
                    placeholder="0"
                    className="w-full mt-1 bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
                </div>
              </div>

              {/* 결제 방법 */}
              <div>
                <label className="text-xs text-muted-foreground">결제 방법</label>
                <div className="grid grid-cols-4 gap-2 mt-1">
                  {PAYMENT_METHODS_REG.map(m => (
                    <button key={m} type="button"
                      onClick={() => setRegForm(f => ({ ...f, paymentMethod: f.paymentMethod === m ? "" : m }))}
                      className={`py-2 rounded-lg text-xs font-medium border transition-colors ${regForm.paymentMethod === m ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border text-muted-foreground"}`}>
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              {/* 날짜 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">결제일 *</label>
                  <input type="date" value={regForm.paymentDate}
                    onChange={e => setRegForm(f => ({ ...f, paymentDate: e.target.value }))}
                    className="w-full mt-1 bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">시작일</label>
                  <input type="date" value={regForm.startDate}
                    onChange={e => setRegForm(f => ({ ...f, startDate: e.target.value }))}
                    className="w-full mt-1 bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
                </div>
              </div>

              {/* 메모 */}
              <div>
                <label className="text-xs text-muted-foreground">메모</label>
                <textarea value={regForm.memo} onChange={e => setRegForm(f => ({ ...f, memo: e.target.value }))} rows={2}
                  placeholder="추가 메모..."
                  className="w-full mt-1 bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none" />
              </div>
            </div>

            <div className="p-4 border-t border-border shrink-0 space-y-2">
              <button type="button" onClick={saveRegistration}
                className="w-full bg-emerald-500 text-white rounded-xl py-3 text-sm font-bold hover:bg-emerald-600 transition-colors">
                등록 완료 및 매출 저장
              </button>
              <button type="button" onClick={() => setShowRegistration(false)}
                className="w-full border border-border text-muted-foreground rounded-xl py-2.5 text-sm font-medium hover:bg-muted/30">
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 상담 폼 모달 */}
      {showForm && (
        <div className="fixed inset-0 z-[200] bg-black/60 flex items-end md:items-center justify-center p-4 pb-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md flex flex-col" style={{ maxHeight: "90vh" }}>
            <div className="sticky top-0 bg-card border-b border-border px-4 py-3 flex items-center justify-between shrink-0">
              <h2 className="font-semibold text-foreground">{editId ? "상담 수정" : "상담 일지"}</h2>
              <button onClick={resetForm} className="text-muted-foreground hover:text-foreground">✕</button>
            </div>

            <div className="overflow-y-auto flex-1 p-4 space-y-4">

              {/* 이름 / 연락처 */}
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

              {/* 성별 / 연령대 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">성별</label>
                  <div className="flex gap-2 mt-1">
                    {["남", "여"].map(g => (
                      <button key={g} type="button" onClick={() => setForm(f => ({ ...f, gender: f.gender === g ? "" : g }))}
                        className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${form.gender === g ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border text-muted-foreground hover:text-foreground"}`}>
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

              {/* 상담 유형 대분류 — 복수 선택 */}
              <div>
                <label className="text-xs text-muted-foreground">상담 유형 (복수 선택 가능)</label>
                <div className="flex gap-2 mt-1">
                  {MAIN_TYPES.map(t => (
                    <button key={t} type="button" onClick={() => toggleMainType(t)}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${form.consultationTypes.includes(t) ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border text-muted-foreground hover:text-foreground"}`}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* 소분류 — 선택된 대분류의 소분류 전부 표시 */}
              {form.consultationTypes.some(t => CONSULT_TYPES[t]?.length > 0) && (
                <div>
                  <label className="text-xs text-muted-foreground">소분류 (복수 선택 가능)</label>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {form.consultationTypes.flatMap(t => CONSULT_TYPES[t] ?? []).map(sub => (
                      <button key={sub} type="button" onClick={() => toggleSubType(sub)}
                        className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${form.consultationSubTypes.includes(sub) ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border text-muted-foreground hover:text-foreground"}`}>
                        {sub}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* 관심 프로그램 */}
              <div className="space-y-2">
                <div>
                  <label className="text-xs text-muted-foreground">관심 프로그램</label>
                  <div className="flex gap-2 mt-1">
                    {INTEREST_OPTIONS.map(o => (
                      <button key={o} type="button"
                        onClick={() => setForm(f => ({ ...f, interestType: f.interestType === o ? "" : o, exercisePurposes: o !== "PT" ? [] : f.exercisePurposes }))}
                        className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${form.interestType === o ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border text-muted-foreground hover:text-foreground"}`}>
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
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${form.exercisePurposes.includes(p) ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border text-muted-foreground hover:text-foreground"}`}>
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

              {/* 상담 담당자 */}
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
                  className="w-full mt-1 bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none">
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

              {/* 상담 내용 */}
              <div>
                <label className="text-xs text-muted-foreground">상담 내용</label>
                <textarea value={form.consultationNote} onChange={e => setForm(f => ({ ...f, consultationNote: e.target.value }))} rows={3}
                  placeholder="상담 내용을 입력하세요..."
                  className="w-full mt-1 bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none" />
              </div>

              {/* 메모 */}
              <div>
                <label className="text-xs text-muted-foreground">메모</label>
                <textarea value={form.memo} onChange={e => setForm(f => ({ ...f, memo: e.target.value }))} rows={2}
                  className="w-full mt-1 bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none" />
              </div>

            </div>

            {/* 하단 상태 저장 버튼 */}
            <div className="p-4 border-t border-border shrink-0 space-y-2">
              <p className="text-xs text-muted-foreground text-center">아래 버튼을 누르면 상담 일지가 저장됩니다</p>
              <div className="flex gap-2">
                <button type="button" onClick={() => handleSave("consulted")}
                  className="flex-1 bg-blue-500 text-white rounded-lg py-2.5 text-sm font-semibold hover:bg-blue-600 transition-colors">
                  상담완료
                </button>
                <button type="button" onClick={openContract}
                  className="flex-1 bg-emerald-500 text-white rounded-lg py-2.5 text-sm font-semibold hover:bg-emerald-600 transition-colors">
                  등록완료
                </button>
                <button type="button" onClick={() => handleSave("dropped")}
                  className="flex-1 bg-red-500/80 text-white rounded-lg py-2.5 text-sm font-semibold hover:bg-red-600 transition-colors">
                  등록보류
                </button>
              </div>
              {editId && (
                <button type="button" onClick={() => { if (confirm("삭제하시겠습니까?")) { deleteMutation.mutate({ id: editId }); resetForm(); } }}
                  className="w-full border border-red-500/30 text-red-400 rounded-lg py-2 text-sm font-medium hover:bg-red-500/10">
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
