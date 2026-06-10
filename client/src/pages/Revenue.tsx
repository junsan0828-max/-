import { useState } from "react";
import { trpc } from "../lib/trpc";
import { toast } from "sonner";
import ExpensesPage from "./Expenses";
import {
  Plus, ChevronLeft, ChevronRight, Search, AlertCircle,
  TrendingUp, RefreshCw, Dumbbell, Heart, MoreHorizontal, Lock,
} from "lucide-react";
import { parseServiceItems, SERVICE_COLORS, type ServiceType } from "@/lib/memberServices";

const PAYMENT_METHODS = ["카드", "현금", "현금영수증", "계좌이체", "지역화폐", "분할결제"];
const CATEGORIES = ["PT", "헬스", "기타"] as const;
const SUB_TYPES = ["신규", "재등록", "이전"] as const;
const DURATIONS = [1, 3, 6, 12];
const OTHER_ITEMS = ["락커", "운동복", "1일권", "밸런스체크", "체험"];
const PT_PROGRAMS = ["케어피티", "웨이트피티", "이벤트피티", "기타"];
const PT_SESSIONS = [10, 20, 30, 40, 50];

type RevForm = {
  customerName: string; phone: string; programDetail: string; duration: string; sessions: string;
  leadId?: number; trainerId?: number; consultantId?: number; branchId?: number; channelId?: number;
  type: "PT" | "헬스" | "기타"; subType: "신규" | "재등록" | "이전";
  amount: string; discountAmount: string; paidAmount: string; unpaidAmount: string; refundAmount: string;
  paymentMethod: string; paymentDate: string; startDate: string; installments: string; memo: string;
  ptProgramKey: string; ptProgramCustom: string;
  serviceHealthDuration: string;
  siPT: boolean; siPTCount: string;
  siHealth: boolean; siHealthMonths: string; siHealthCustom: string;
  siLocker: boolean; siLockerNum: string;
  siUniform: boolean;
};

const defaultForm: RevForm = {
  customerName: "", phone: "", programDetail: "", duration: "", sessions: "",
  ptProgramKey: "", ptProgramCustom: "", serviceHealthDuration: "",
  siPT: false, siPTCount: "", siHealth: false, siHealthMonths: "", siHealthCustom: "",
  siLocker: false, siLockerNum: "", siUniform: false,
  type: "PT", subType: "신규",
  amount: "", discountAmount: "0", paidAmount: "", unpaidAmount: "0", refundAmount: "0",
  paymentMethod: "카드", paymentDate: new Date().toISOString().substring(0, 10), startDate: "",
  installments: "1", memo: "",
  trainerId: undefined, consultantId: undefined,
};

function fmt(n: number) {
  return n.toLocaleString();
}

function parseRevServiceItems(str: string) {
  const r = { siPT: false, siPTCount: "", siHealth: false, siHealthMonths: "", siHealthCustom: "", siLocker: false, siLockerNum: "", siUniform: false };
  if (!str) return r;
  for (const part of str.split(",").map(s => s.trim())) {
    const ptM = /^PT\((\d+)회\)$/.exec(part);
    if (ptM) { r.siPT = true; r.siPTCount = ptM[1]; continue; }
    if (part === "PT") { r.siPT = true; continue; }
    const hMo = /^헬스\((\d+)개월\)$/.exec(part);
    if (hMo) { r.siHealth = true; r.siHealthMonths = hMo[1]; continue; }
    const hDay = /^헬스\((\d+)일\)$/.exec(part);
    if (hDay) { r.siHealth = true; r.siHealthCustom = hDay[1]; continue; }
    if (part === "헬스") { r.siHealth = true; continue; }
    const lkM = /^락커\((.+)\)$/.exec(part);
    if (lkM) { r.siLocker = true; r.siLockerNum = lkM[1]; continue; }
    if (part === "락커") { r.siLocker = true; continue; }
    if (part === "운동복") { r.siUniform = true; }
  }
  return r;
}

function buildRevServiceItems(f: RevForm): string | undefined {
  const parts: string[] = [];
  if (f.siPT) parts.push(f.siPTCount ? `PT(${f.siPTCount}회)` : "PT");
  if (f.siHealth) {
    if (f.siHealthMonths) parts.push(`헬스(${f.siHealthMonths}개월)`);
    else if (f.siHealthCustom) parts.push(`헬스(${f.siHealthCustom}일)`);
    else parts.push("헬스");
  }
  if (f.siLocker) parts.push(f.siLockerNum ? `락커(${f.siLockerNum})` : "락커");
  if (f.siUniform) parts.push("운동복");
  return parts.length > 0 ? parts.join(",") : undefined;
}

export default function RevenuePage() {
  const [financeTab, setFinanceTab] = useState<"revenue" | "expenses">("revenue");

  return (
    <div className="space-y-4">
      <div className="flex bg-card border border-border rounded-xl p-1 gap-1">
        <button onClick={() => setFinanceTab("revenue")}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${financeTab === "revenue" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
          매출
        </button>
        <button onClick={() => setFinanceTab("expenses")}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${financeTab === "expenses" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
          지출
        </button>
      </div>
      {financeTab === "revenue" ? <RevenueContent /> : <ExpensesPage />}
    </div>
  );
}

function RevenueContent() {
  const utils = trpc.useUtils();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [editCreatedBy, setEditCreatedBy] = useState<number | null>(null);
  const [form, setForm] = useState<RevForm>(defaultForm);
  const [filterType, setFilterType] = useState("");
  const [filterIncomplete, setFilterIncomplete] = useState(false);
  const [branchFilter, setBranchFilter] = useState<number | null>(() => {
    const saved = sessionStorage.getItem("revenue_default_branch");
    if (saved) { sessionStorage.removeItem("revenue_default_branch"); return Number(saved); }
    return null;
  });

  const { data: me } = trpc.auth.me.useQuery();
  const isConsultant = me?.role === "consultant";
  const isTrainer = me?.role === "trainer";
  const isAdminView = !isConsultant && !isTrainer;

  const { data: entries, isLoading } = trpc.gym.revenue.list.useQuery({ year, month }, { enabled: !filterIncomplete });
  const { data: allEntries, isLoading: allLoading } = trpc.gym.revenue.list.useQuery({}, { enabled: filterIncomplete });
  const { data: trainerSummary } = trpc.gym.revenue.trainerSummary.useQuery({ year, month }, { enabled: isAdminView });
  const { data: channels } = trpc.gym.channels.list.useQuery();
  const { data: trainers } = trpc.trainers.list.useQuery();
  const { data: consultants } = trpc.gym.staff.listConsultants.useQuery();
  const { data: branchList } = trpc.gym.staff.listBranches.useQuery();
  const { data: kpi, error: kpiError } = trpc.gym.kpi.overview.useQuery(
    { year, month, ...(branchFilter ? { branchId: branchFilter } : {}) },
    { enabled: isAdminView }
  );
  const kpiForbidden = (kpiError as any)?.data?.code === "FORBIDDEN";

  const createMutation = trpc.gym.revenue.create.useMutation({
    onSuccess: () => { toast.success("매출이 등록되었습니다"); utils.gym.revenue.invalidate(); utils.gym.kpi.invalidate(); resetForm(); },
    onError: (e) => toast.error(e.message),
  });
  const updateMutation = trpc.gym.revenue.update.useMutation({
    onSuccess: () => { toast.success("수정되었습니다"); utils.gym.revenue.invalidate(); utils.gym.kpi.invalidate(); resetForm(); },
    onError: (e) => toast.error(e.message),
  });
  const deleteMutation = trpc.gym.revenue.delete.useMutation({
    onSuccess: () => { toast.success("삭제되었습니다"); utils.gym.revenue.invalidate(); utils.gym.kpi.invalidate(); },
  });
  const setTargetMutation = trpc.gym.revenue.setTarget.useMutation({
    onSuccess: () => { toast.success("목표가 설정되었습니다"); utils.gym.revenue.targets.invalidate(); utils.gym.kpi.invalidate(); },
  });

  function resetForm() { setShowForm(false); setEditId(null); setEditCreatedBy(null); setForm(defaultForm); }

  function openEdit(row: any) {
    setEditId(row.entry.id);
    setEditCreatedBy(row.entry.createdBy ?? null);
    const si = parseRevServiceItems((row.entry as any).serviceItems ?? "");
    setForm({
      customerName: row.entry.customerName ?? "",
      phone: row.entry.phone ?? "",
      programDetail: row.entry.programDetail === "운동복 대여" ? "운동복" : (row.entry.programDetail ?? ""),
      duration: row.entry.duration
        ? String(row.entry.duration)
        : (/^헬스 (\d+)개월/.exec(row.entry.programDetail ?? "")?.[1] ?? ""),
      sessions: row.entry.sessions ? String(row.entry.sessions) : "",
      ptProgramKey: PT_PROGRAMS.includes(row.entry.programDetail ?? "") ? (row.entry.programDetail ?? "") : (row.entry.programDetail ? "기타" : ""),
      ptProgramCustom: PT_PROGRAMS.includes(row.entry.programDetail ?? "") ? "" : (row.entry.programDetail ?? ""),
      serviceHealthDuration: (row.entry as any).serviceHealthDuration ? String((row.entry as any).serviceHealthDuration) : "",
      ...si,
      leadId: row.entry.leadId ?? undefined,
      trainerId: row.entry.trainerId ?? undefined,
      consultantId: (row.entry as any).consultantId ?? undefined,
      branchId: row.entry.branchId ?? undefined,
      channelId: row.entry.channelId ?? undefined,
      type: row.entry.type,
      subType: row.entry.subType,
      amount: String(row.entry.amount),
      discountAmount: String(row.entry.discountAmount),
      paidAmount: String(row.entry.paidAmount),
      unpaidAmount: String(row.entry.unpaidAmount),
      refundAmount: String(row.entry.refundAmount),
      paymentMethod: row.entry.paymentMethod === "이체" ? "계좌이체" : (row.entry.paymentMethod ?? ""),
      paymentDate: row.entry.paymentDate,
      startDate: row.entry.startDate ?? "",
      installments: String(row.entry.installments),
      memo: row.entry.memo ?? "",
    });
    setShowForm(true);
  }

  function handleAmountChange(v: string) {
    const amount = parseInt(v) || 0;
    const discount = parseInt(form.discountAmount) || 0;
    const paid = Math.max(0, amount - discount);
    setForm(f => ({ ...f, amount: v, paidAmount: String(paid), unpaidAmount: "0" }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.customerName?.trim()) return toast.error("회원 이름을 입력해주세요");
    if (form.type === "기타" && !form.programDetail) return toast.error("항목을 선택해주세요");
    if (form.type === "PT" && !form.sessions) return toast.error("PT 횟수를 선택해주세요");
    if (form.type === "헬스" && !form.duration) return toast.error("이용 기간을 선택해주세요");
    if (form.subType !== "이전") {
      if (!form.amount) return toast.error("총 금액을 입력해주세요");
      if (form.paidAmount === "") return toast.error("실 납부액을 입력해주세요");
      if (!form.paymentMethod) return toast.error("결제 방법을 선택해주세요");
    }
    if (!form.paymentDate) return toast.error("결제일을 입력해주세요");
    const resolvedProgram = form.type === "PT"
      ? (form.ptProgramKey === "기타" ? form.ptProgramCustom : form.ptProgramKey) || undefined
      : form.programDetail || undefined;
    const payload = {
      customerName: form.customerName || undefined,
      phone: form.phone || undefined,
      programDetail: resolvedProgram,
      sessions: form.sessions ? parseInt(form.sessions) : undefined,
      duration: form.duration ? parseInt(form.duration) : undefined,
      serviceHealthDuration: (form.type === "PT" && form.serviceHealthDuration) ? parseInt(form.serviceHealthDuration) : undefined,
      leadId: form.leadId ? Number(form.leadId) : undefined,
      trainerId: form.trainerId ? Number(form.trainerId) : undefined,
      consultantId: form.consultantId ? Number(form.consultantId) : undefined,
      branchId: form.branchId ? Number(form.branchId) : undefined,
      channelId: form.channelId ? Number(form.channelId) : undefined,
      type: form.type,
      subType: form.subType,
      amount: parseInt(form.amount) || 0,
      discountAmount: parseInt(form.discountAmount) || 0,
      paidAmount: parseInt(form.paidAmount) || 0,
      unpaidAmount: parseInt(form.unpaidAmount) || 0,
      refundAmount: parseInt(form.refundAmount) || 0,
      paymentMethod: form.paymentMethod || undefined,
      paymentDate: form.paymentDate,
      startDate: form.startDate || form.paymentDate,
      installments: parseInt(form.installments) || 1,
      memo: form.memo,
      serviceItems: buildRevServiceItems(form),
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

  const rawEntries = filterIncomplete ? (allEntries ?? []) : (entries ?? []);
  const filtered = rawEntries.filter(row => {
    const q = search.toLowerCase();
    const matchSearch = !q || (row.memberName ?? "").toLowerCase().includes(q) || (row.trainerName ?? "").toLowerCase().includes(q) || (row.entry.customerName ?? "").toLowerCase().includes(q) || (row.entry.memo ?? "").toLowerCase().includes(q);
    const matchType = !filterType || row.entry.type === filterType;
    const matchBranch = !branchFilter || row.entry.branchId === branchFilter;
    const matchIncomplete = !filterIncomplete || (
      row.entry.amount === 0 ||
      (row.entry.type === "기타" && !row.entry.programDetail) ||
      (row.entry.type === "헬스" && !row.entry.duration) ||
      (row.entry.type === "PT" && !row.entry.sessions)
    );
    return matchSearch && matchType && matchBranch && matchIncomplete;
  });

  // 같은 이름+날짜+금액+구분 중복 제거 (PT > 헬스 > 기타 우선)
  const TYPE_PRI: Record<string, number> = { PT: 3, 헬스: 2, 기타: 1 };
  const dedupMap = new Map<string, typeof filtered[0]>();
  for (const row of filtered) {
    const key = `${row.entry.customerName}|${row.entry.paymentDate}|${row.entry.amount}|${row.entry.subType}`;
    const existing = dedupMap.get(key);
    if (!existing) { dedupMap.set(key, row); continue; }
    if ((TYPE_PRI[row.entry.type] ?? 0) > (TYPE_PRI[existing.entry.type] ?? 0)) dedupMap.set(key, row);
  }
  const deduped = Array.from(dedupMap.values());

  const monthTotal = deduped.reduce((s, r) => s + r.entry.paidAmount, 0);
  const monthUnpaid = deduped.reduce((s, r) => s + r.entry.unpaidAmount, 0);

  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <div>
        <h1 className="text-xl font-bold text-foreground">매출 {isConsultant ? "입력" : "장부"}</h1>
        <p className="text-xs text-muted-foreground">매출 입력 및 내역</p>
      </div>

      {/* 지점 필터 */}
      {isAdminView && branchList && branchList.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setBranchFilter(null)}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${branchFilter === null ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:text-foreground"}`}>
            전체
          </button>
          {branchList.map((b) => (
            <button key={b.id} onClick={() => setBranchFilter(b.id)}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${branchFilter === b.id ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:text-foreground"}`}>
              {b.name}
            </button>
          ))}
        </div>
      )}

      {/* 월 선택 / 미입력 모드 안내 */}
      {filterIncomplete ? (
        <div className="flex items-center justify-center gap-2 bg-orange-500/10 border border-orange-500/30 rounded-xl px-4 py-3">
          <span className="text-sm font-medium text-orange-400">전체 기간 · 미입력 항목 조회 중</span>
          <span className="text-xs text-orange-400/70">({deduped.length}건)</span>
        </div>
      ) : (
      <div className="flex items-center justify-center gap-3 bg-card border border-border rounded-xl px-4 py-3">
        <button onClick={prevMonth} className="text-muted-foreground hover:text-foreground">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <span className="text-base font-semibold text-foreground min-w-[100px] text-center">{year}년 {month}월</span>
        <button onClick={nextMonth} className="text-muted-foreground hover:text-foreground">
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>
      )}

      {/* 요약 카드 - 관리자만 표시 */}
      {isAdminView && kpiForbidden && (
        <div className="flex items-center gap-3 bg-red-500/5 border border-red-500/20 rounded-xl px-4 py-3">
          <Lock className="h-4 w-4 text-red-400 shrink-0" />
          <p className="text-sm text-red-400 font-medium">접근 권한이 없습니다</p>
        </div>
      )}
      {isAdminView && !kpiForbidden && (
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-card border border-border rounded-xl p-3">
            <div className="text-xs text-muted-foreground mb-1">이번달 매출</div>
            <div className="text-lg font-bold text-emerald-400">{fmt(kpi?.monthTotal ?? 0)}원</div>
            <div className="text-xs text-muted-foreground mt-0.5">신규 {fmt(kpi?.monthNewSales ?? 0)} / 재등록 {fmt(kpi?.monthRenewal ?? 0)}</div>
          </div>
          <div className={`bg-card border rounded-xl p-3 ${monthUnpaid > 0 ? "border-red-500/30" : "border-border"}`}>
            <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
              {monthUnpaid > 0 && <AlertCircle className="h-3 w-3 text-red-400" />}
              전체 미수금
            </div>
            <div className={`text-lg font-bold ${monthUnpaid > 0 ? "text-red-400" : "text-muted-foreground"}`}>{fmt(kpi?.totalUnpaid ?? 0)}원</div>
            <div className="text-xs text-muted-foreground mt-0.5">PT {fmt(kpi?.monthPT ?? 0)} / 헬스 {fmt(kpi?.monthHealth ?? 0)}</div>
          </div>
        </div>
      )}

      {/* 트레이너별 매출 - 관리자만 표시 */}
      {isAdminView && (trainerSummary ?? []).length > 0 && (
        <div className="bg-card border border-border rounded-xl p-4">
          <h3 className="text-sm font-semibold text-foreground mb-3">트레이너별 매출</h3>
          <div className="space-y-2">
            {(trainerSummary ?? []).map((t) => (
              <div key={t.trainerId} className="flex items-center justify-between text-xs">
                <span className="text-foreground">{t.trainerName}</span>
                <div className="flex items-center gap-3">
                  <span className="text-muted-foreground">{t.count}건</span>
                  <span className="font-medium text-foreground">{fmt(t.total)}원</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 필터 & 검색 */}
      <div className="space-y-2">
        <div className="flex gap-2 flex-wrap">
          {["", "PT", "헬스", "기타"].map(t => (
            <button key={t} onClick={() => setFilterType(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filterType === t && !filterIncomplete ? "bg-primary text-primary-foreground" : "bg-card border border-border text-muted-foreground hover:text-foreground"}`}>
              {t || "전체"}
            </button>
          ))}
          <button onClick={() => { setFilterIncomplete(f => !f); setFilterType(""); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filterIncomplete ? "bg-orange-500 text-white border-orange-500" : "bg-card border border-border text-muted-foreground hover:text-foreground"}`}>
            미입력
          </button>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="회원명, 트레이너, 메모 검색..."
            className="w-full bg-card border border-border rounded-lg pl-9 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
        </div>
      </div>

      {/* 매출 목록 */}
      {(isLoading || allLoading) ? (
        <div className="text-center text-muted-foreground py-8">로딩 중...</div>
      ) : deduped.length === 0 ? (
        <div className="text-center text-muted-foreground py-12">
          <TrendingUp className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">이 달 매출 내역이 없습니다</p>
        </div>
      ) : (
        <div className="space-y-2">
          {deduped.map(row => {
            const parsedItems = parseServiceItems((row.entry as any).serviceItems);
            const subTypeStyle = row.entry.subType === "신규"
              ? "bg-blue-400/10 text-blue-400 border-blue-400/30"
              : row.entry.subType === "이전"
              ? "bg-gray-400/10 text-gray-400 border-gray-400/30"
              : "bg-violet-400/10 text-violet-400 border-violet-400/30";
            // 기타 항목 중 운동복/락커는 해당 타입 색상으로 통합 표시
            const effectiveType: ServiceType =
              row.entry.type === "PT" ? "PT"
              : row.entry.type === "헬스" ? "헬스"
              : (row.entry.programDetail === "운동복 대여" || row.entry.programDetail === "운동복") ? "운동복"
              : row.entry.programDetail?.startsWith("락커") ? "락커"
              : "기타";
            const mainCol = SERVICE_COLORS[effectiveType] ?? SERVICE_COLORS.기타;

            return (
              <div key={row.entry.id} onClick={() => openEdit(row)}
                className="bg-card border border-border rounded-xl p-4 transition-colors cursor-pointer hover:border-primary/30">

                {/* 이름 + 신규/재등록 + 금액 */}
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm font-bold text-foreground truncate">{row.entry.customerName || row.memberName || "—"}</span>
                    <span className={`shrink-0 whitespace-nowrap text-[11px] px-1.5 py-0.5 rounded border font-semibold ${subTypeStyle}`}>
                      {row.entry.subType}
                    </span>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-base font-bold text-foreground whitespace-nowrap">{fmt(row.entry.paidAmount)}원</div>
                    {row.entry.unpaidAmount > 0 && (
                      <div className="text-xs text-red-400 flex items-center gap-0.5 justify-end whitespace-nowrap">
                        <AlertCircle className="h-3 w-3" />미수 {fmt(row.entry.unpaidAmount)}
                      </div>
                    )}
                    {row.entry.discountAmount > 0 && (
                      <div className="text-xs text-muted-foreground whitespace-nowrap">할인 -{fmt(row.entry.discountAmount)}</div>
                    )}
                  </div>
                </div>

                {/* 서비스 뱃지 */}
                <div className="flex flex-wrap gap-1.5 mb-2">
                  <span className={`whitespace-nowrap text-xs px-2 py-0.5 rounded-full font-medium border ${mainCol.bg} ${mainCol.text} ${mainCol.border}`}>
                    {effectiveType === "PT"
                      ? `PT${row.entry.sessions ? ` ${row.entry.sessions}회` : ""}`
                      : effectiveType === "헬스"
                      ? (row.entry.programDetail?.startsWith("헬스") ? row.entry.programDetail
                        : `헬스${row.entry.duration ? ` ${row.entry.duration}개월` : ""}`)
                      : effectiveType === "운동복"
                      ? "운동복"
                      : effectiveType === "락커"
                      ? (row.entry.programDetail?.match(/락커\(([^)]+)\)/)
                          ? `락커 ${row.entry.programDetail.match(/락커\(([^)]+)\)/)![1]}번`
                          : "락커")
                      : row.entry.programDetail?.startsWith("PT")
                      ? row.entry.programDetail
                      : row.entry.type}
                  </span>
                  {row.entry.type === "PT" && row.entry.programDetail && (
                    <span className="whitespace-nowrap text-xs px-2 py-0.5 rounded-full font-medium border bg-muted/40 text-muted-foreground border-border">
                      {row.entry.programDetail}
                    </span>
                  )}
                  {row.entry.type === "기타" && row.entry.programDetail && effectiveType === "기타" && (
                    <span className="whitespace-nowrap text-xs px-2 py-0.5 rounded-full font-medium border bg-muted/40 text-muted-foreground border-border">
                      {row.entry.programDetail}{row.entry.duration ? ` ${row.entry.duration}개월` : ""}
                    </span>
                  )}
                  {(row.entry as any).serviceHealthDuration > 0 && (
                    <span className={`whitespace-nowrap text-xs px-2 py-0.5 rounded-full font-medium border ${SERVICE_COLORS.헬스.bg} ${SERVICE_COLORS.헬스.text} ${SERVICE_COLORS.헬스.border}`}>
                      헬스 {(row.entry as any).serviceHealthDuration}개월
                    </span>
                  )}
                  {parsedItems.map((item, i) => {
                    const col = SERVICE_COLORS[item.type] ?? SERVICE_COLORS.기타;
                    return (
                      <span key={i} className={`whitespace-nowrap text-xs px-2 py-0.5 rounded-full font-medium border ${col.bg} ${col.text} ${col.border}`}>
                        {item.label}
                      </span>
                    );
                  })}
                </div>

                {/* 결제 정보 */}
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                  <span>{row.entry.paymentDate}</span>
                  {row.entry.paymentMethod && <span>· {row.entry.paymentMethod}</span>}
                  {row.entry.type === "PT" && !row.entry.trainerId && (
                    <span className="text-orange-400 font-medium">· 트레이너 미배정</span>
                  )}
                  {row.entry.trainerId && <span>· {row.trainerName}</span>}
                  {(row as any).consultantName && <span>· {(row as any).consultantName}</span>}
                  {row.channelName && <span>· {row.channelName}</span>}
                  {(row as any).branchName && (
                    <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400 font-medium">
                      {(row as any).branchName}
                    </span>
                  )}
                </div>

                {/* 메모 */}
                {row.entry.memo && (
                  <p className="text-xs text-muted-foreground mt-1.5 pt-1.5 border-t border-border/50">
                    {row.entry.memo}
                  </p>
                )}
              </div>
            );
          })}
          <div className="bg-card border border-border rounded-xl p-3 flex justify-between text-sm font-semibold">
            <span className="text-foreground">합계 ({filtered.length}건)</span>
            <span className="text-emerald-400">{fmt(monthTotal)}원</span>
          </div>
        </div>
      )}

      {/* 매출 입력 폼 */}
      {showForm && (
        <div className="fixed inset-0 z-[200] bg-black/60 flex items-end md:items-center justify-center"
          style={{ padding: 'max(env(safe-area-inset-top), 1rem) 1rem max(env(safe-area-inset-bottom), 1rem)' }}>
          <div className="bg-card border border-border rounded-2xl w-full max-w-md flex flex-col"
            style={{ maxHeight: 'calc(90svh - max(env(safe-area-inset-bottom), 1rem))' }}>
            <div className="sticky top-0 bg-card border-b border-border px-4 py-3 flex items-center justify-between shrink-0">
              <h2 className="font-semibold text-foreground">{editId ? "매출 수정" : "매출 입력"}</h2>
              <button onClick={resetForm} className="text-muted-foreground hover:text-foreground">✕</button>
            </div>
            <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
              <div className="overflow-y-auto flex-1 p-4 space-y-3">

              {/* 회원 이름 / 연락처 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">회원 이름 *</label>
                  <input value={form.customerName} onChange={e => setForm(f => ({ ...f, customerName: e.target.value }))} placeholder="홍길동"
                    className="w-full mt-1 rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:outline-none" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">연락처</label>
                  <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="010-0000-0000"
                    className="w-full mt-1 rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:outline-none" />
                </div>
              </div>

              {/* 프로그램 유형 */}
              <div>
                <label className="text-xs text-muted-foreground">프로그램 유형 *</label>
                <div className="flex gap-2 mt-1">
                  {CATEGORIES.map(c => (
                    <button key={c} type="button"
                      onClick={() => setForm(f => ({ ...f, type: c, programDetail: "", duration: "", serviceHealthDuration: "" }))}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${form.type === c ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border text-muted-foreground hover:text-foreground"}`}>
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              {/* 등록 유형 */}
              <div>
                <label className="text-xs text-muted-foreground">등록 유형 *</label>
                <div className="flex gap-2 mt-1">
                  {SUB_TYPES.map(s => (
                    <button key={s} type="button" onClick={() => setForm(f => ({
                      ...f,
                      subType: s,
                      ...(s === "이전" ? { amount: "0", paidAmount: "0", unpaidAmount: "0", discountAmount: "0", refundAmount: "0" } : {}),
                    }))}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${form.subType === s ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border text-muted-foreground hover:text-foreground"}`}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* PT: 프로그램명 + 횟수 + 서비스 헬스권 */}
              {form.type === "PT" && (
                <div className="space-y-2">
                  <div>
                    <label className="text-xs text-muted-foreground">프로그램명</label>
                    <div className="grid grid-cols-2 gap-2 mt-1">
                      {PT_PROGRAMS.map(p => (
                        <button key={p} type="button" onClick={() => setForm(f => ({ ...f, ptProgramKey: p, ptProgramCustom: "" }))}
                          className={`py-2 rounded-lg text-sm font-medium border transition-colors ${form.ptProgramKey === p ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border text-muted-foreground hover:text-foreground"}`}>
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>
                  {form.ptProgramKey === "기타" && (
                    <input value={form.ptProgramCustom} onChange={e => setForm(f => ({ ...f, ptProgramCustom: e.target.value }))} placeholder="프로그램명 직접 입력"
                      className="w-full rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:outline-none" />
                  )}
                  <div>
                    <label className="text-xs text-muted-foreground">횟수 *</label>
                    <div className="flex gap-2 mt-1 flex-wrap">
                      {PT_SESSIONS.map(s => (
                        <button key={s} type="button" onClick={() => setForm(f => ({ ...f, sessions: form.sessions === String(s) ? "" : String(s) }))}
                          className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${form.sessions === String(s) ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border text-muted-foreground hover:text-foreground"}`}>
                          {s}회
                        </button>
                      ))}
                      <button type="button"
                        onClick={() => setForm(f => ({ ...f, sessions: PT_SESSIONS.map(String).includes(f.sessions) || f.sessions === "" ? "기타" : f.sessions }))}
                        className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${!PT_SESSIONS.map(String).includes(form.sessions) && form.sessions !== "" ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border text-muted-foreground hover:text-foreground"}`}>
                        기타
                      </button>
                    </div>
                    {!PT_SESSIONS.map(String).includes(form.sessions) && form.sessions !== "" && (
                      <input
                        type="number"
                        min="1"
                        placeholder="직접 입력 (회)"
                        value={form.sessions === "기타" ? "" : form.sessions}
                        onChange={(e) => setForm(f => ({ ...f, sessions: e.target.value }))}
                        className="mt-2 w-full px-3 py-2 bg-input border border-border rounded-lg text-sm outline-none focus:outline-none"
                      />
                    )}
                  </div>
                  {/* 서비스 헬스권 */}
                  <div className="border border-border rounded-xl p-3 space-y-2 bg-background/50">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-medium text-foreground">헬스권 서비스 포함</label>
                      <button type="button"
                        onClick={() => setForm(f => ({ ...f, serviceHealthDuration: f.serviceHealthDuration ? "" : "1" }))}
                        className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${form.serviceHealthDuration ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border text-muted-foreground hover:text-foreground"}`}>
                        {form.serviceHealthDuration ? "ON" : "OFF"}
                      </button>
                    </div>
                    {form.serviceHealthDuration && (
                      <div>
                        <label className="text-xs text-muted-foreground">서비스 기간</label>
                        <div className="flex gap-2 mt-1 flex-wrap">
                          {DURATIONS.map(d => (
                            <button key={d} type="button"
                              onClick={() => setForm(f => ({ ...f, serviceHealthDuration: String(d) }))}
                              className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${form.serviceHealthDuration === String(d) ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border text-muted-foreground hover:text-foreground"}`}>
                              {d}개월
                            </button>
                          ))}
                          <button type="button"
                            onClick={() => setForm(f => ({ ...f, serviceHealthDuration: DURATIONS.map(String).includes(f.serviceHealthDuration) ? "기타" : f.serviceHealthDuration }))}
                            className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${!DURATIONS.map(String).includes(form.serviceHealthDuration) && form.serviceHealthDuration !== "" ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border text-muted-foreground hover:text-foreground"}`}>
                            기타
                          </button>
                        </div>
                        {!DURATIONS.map(String).includes(form.serviceHealthDuration) && form.serviceHealthDuration !== "" && (
                          <input
                            type="number"
                            min="1"
                            placeholder="직접 입력 (개월)"
                            value={form.serviceHealthDuration === "기타" ? "" : form.serviceHealthDuration}
                            onChange={e => setForm(f => ({ ...f, serviceHealthDuration: e.target.value }))}
                            className="mt-2 w-full px-3 py-2 bg-input border border-border rounded-lg text-sm outline-none focus:outline-none"
                          />
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 헬스: 이용 기간 */}
              {form.type === "헬스" && (
                <div>
                  <label className="text-xs text-muted-foreground">이용 기간 *</label>
                  <div className="flex gap-2 mt-1">
                    {DURATIONS.map(d => (
                      <button key={d} type="button" onClick={() => setForm(f => ({ ...f, duration: String(d) }))}
                        className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${form.duration === String(d) ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border text-muted-foreground hover:text-foreground"}`}>
                        {d}개월
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* 서비스 내역 (헬스/PT 공통) */}
              {(form.type === "헬스" || form.type === "PT") && (
                <div>
                  <label className="text-xs text-muted-foreground">서비스 내역 <span className="text-muted-foreground/60">(무료 제공 항목)</span></label>
                  <div className="space-y-1.5 mt-1">
                    {([
                      { id: "siPT" as const, label: "PT", color: "blue" },
                      { id: "siHealth" as const, label: "헬스", color: "emerald" },
                      { id: "siLocker" as const, label: "락커", color: "amber" },
                      { id: "siUniform" as const, label: "운동복", color: "purple" },
                    ] as const).map(({ id, label, color }) => {
                      const sel = form[id] as boolean;
                      return (
                        <div key={id} className={`rounded-xl border transition-colors ${sel ? `border-${color}-500/60 bg-${color}-500/5` : "border-border bg-background"}`}>
                          <button type="button"
                            onClick={() => setForm(f => ({
                              ...f,
                              [id]: !sel,
                              ...(id === "siPT" && sel ? { siPTCount: "" } : {}),
                              ...(id === "siHealth" && sel ? { siHealthMonths: "", siHealthCustom: "" } : {}),
                              ...(id === "siLocker" && sel ? { siLockerNum: "" } : {}),
                            }))}
                            className="w-full flex items-center justify-between px-4 py-2.5 text-sm font-medium">
                            <span className={sel ? `text-${color}-400` : "text-muted-foreground"}>{label}</span>
                            {sel && <span className={`text-[10px] px-2 py-0.5 rounded-full bg-${color}-500/20 text-${color}-400`}>선택됨</span>}
                          </button>
                          {sel && id === "siPT" && (
                            <div className="px-4 pb-3 border-t border-blue-500/20 pt-2 flex gap-2">
                              {[1, 2, 3].map(n => (
                                <button key={n} type="button"
                                  onClick={() => setForm(f => ({ ...f, siPTCount: f.siPTCount === String(n) ? "" : String(n) }))}
                                  className={`flex-1 py-1.5 rounded-lg text-xs font-medium border ${form.siPTCount === String(n) ? "bg-blue-500 text-white border-blue-500" : "bg-background border-border text-muted-foreground"}`}>
                                  +{n}회
                                </button>
                              ))}
                              <input type="number" min={1}
                                value={![1,2,3].map(String).includes(form.siPTCount) && form.siPTCount !== "" ? form.siPTCount : ""}
                                onChange={e => setForm(f => ({ ...f, siPTCount: e.target.value }))}
                                placeholder="직접입력"
                                className="bg-background border border-border rounded-lg text-xs px-2 py-1.5 w-20 focus:outline-none" />
                            </div>
                          )}
                          {sel && id === "siHealth" && (
                            <div className="px-4 pb-3 border-t border-emerald-500/20 pt-2 space-y-2">
                              <div className="flex gap-2">
                                {[1, 3, 6, 12].map(m => (
                                  <button key={m} type="button"
                                    onClick={() => setForm(f => ({ ...f, siHealthMonths: f.siHealthMonths === String(m) ? "" : String(m), siHealthCustom: "" }))}
                                    className={`flex-1 py-1.5 rounded-lg text-xs font-medium border ${form.siHealthMonths === String(m) ? "bg-emerald-500 text-white border-emerald-500" : "bg-background border-border text-muted-foreground"}`}>
                                    {m}개월
                                  </button>
                                ))}
                              </div>
                              <input type="number" min={1} value={form.siHealthCustom}
                                onChange={e => setForm(f => ({ ...f, siHealthCustom: e.target.value, siHealthMonths: "" }))}
                                placeholder="직접 입력 (일)"
                                className="w-full bg-background border border-border rounded-lg text-xs px-3 py-1.5 focus:outline-none" />
                            </div>
                          )}
                          {sel && id === "siLocker" && (
                            <div className="px-4 pb-3 border-t border-amber-500/20 pt-2">
                              <input type="text" value={form.siLockerNum}
                                onChange={e => setForm(f => ({ ...f, siLockerNum: e.target.value }))}
                                placeholder="락커 번호 입력"
                                className="w-full bg-background border border-border rounded-lg text-xs px-3 py-1.5 focus:outline-none" />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 기타: 항목 + 기간 */}
              {form.type === "기타" && (
                <div className="space-y-2">
                  <div>
                    <label className="text-xs text-muted-foreground">항목 *</label>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {OTHER_ITEMS.map(item => (
                        <button key={item} type="button" onClick={() => setForm(f => ({ ...f, programDetail: item }))}
                          className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${form.programDetail === item ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border text-muted-foreground hover:text-foreground"}`}>
                          {item}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">이용 기간</label>
                    <div className="flex gap-2 mt-1">
                      {DURATIONS.map(d => (
                        <button key={d} type="button" onClick={() => setForm(f => ({ ...f, duration: String(d) }))}
                          className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${form.duration === String(d) ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border text-muted-foreground hover:text-foreground"}`}>
                          {d}개월
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* 금액 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">총 금액 *</label>
                  <input type="number" value={form.amount} onChange={e => handleAmountChange(e.target.value)} placeholder="0"
                    className="w-full mt-1 rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:outline-none" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">할인 금액</label>
                  <input type="number" value={form.discountAmount} onChange={e => {
                    const discount = parseInt(e.target.value) || 0;
                    const amount = parseInt(form.amount) || 0;
                    setForm(f => ({ ...f, discountAmount: e.target.value, paidAmount: String(Math.max(0, amount - discount)) }));
                  }} placeholder="0"
                    className="w-full mt-1 rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:outline-none" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">실 납부액 *</label>
                  <input type="number" value={form.paidAmount} onChange={e => setForm(f => ({ ...f, paidAmount: e.target.value }))} placeholder="0"
                    className="w-full mt-1 rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:outline-none" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">미수금</label>
                  <input type="number" value={form.unpaidAmount} onChange={e => setForm(f => ({ ...f, unpaidAmount: e.target.value }))} placeholder="0"
                    className="w-full mt-1 rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:outline-none" />
                </div>
              </div>

              {/* 결제 정보 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">결제 방법 *</label>
                  <select value={form.paymentMethod} onChange={e => setForm(f => ({ ...f, paymentMethod: e.target.value }))}
                    className="w-full mt-1 rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none">
                    <option value="">선택 안 함</option>
                    {PAYMENT_METHODS.map(m => <option key={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">결제일 *</label>
                  <input type="date" value={form.paymentDate} onChange={e => setForm(f => ({ ...f, paymentDate: e.target.value }))}
                    className="w-full mt-1 rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:outline-none" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">시작일</label>
                  <input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
                    className="w-full mt-1 rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:outline-none" />
                </div>
                <div />
              </div>

              {/* PT 전용: 트레이너 */}
              {form.type === "PT" && (
                <div>
                  <label className="text-xs text-muted-foreground">트레이너</label>
                  <select value={form.trainerId ?? ""} onChange={e => setForm(f => ({ ...f, trainerId: e.target.value ? Number(e.target.value) : undefined }))}
                    className="w-full mt-1 rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none">
                    <option value="">선택</option>
                    {(trainers ?? []).map((t: any) => <option key={t.id} value={t.id}>{t.trainerName}</option>)}
                  </select>
                </div>
              )}

              {/* 상담담당자 (트레이너 + 컨설턴트 통합) */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">상담담당자</label>
                  <select value={form.consultantId ?? ""} onChange={e => setForm(f => ({ ...f, consultantId: e.target.value ? Number(e.target.value) : undefined }))}
                    className="w-full mt-1 rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none">
                    <option value="">선택</option>
                    {(trainers ?? []).length > 0 && <optgroup label="트레이너">
                      {(trainers ?? []).map((t: any) => <option key={`tr-${t.userId}`} value={t.userId}>{t.trainerName}</option>)}
                    </optgroup>}
                    {(consultants ?? []).length > 0 && <optgroup label="상담직원">
                      {(consultants ?? []).map((c: any) => <option key={`fc-${c.id}`} value={c.id}>{c.username}</option>)}
                    </optgroup>}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">유입 채널</label>
                  <select value={form.channelId ?? ""} onChange={e => setForm(f => ({ ...f, channelId: e.target.value ? Number(e.target.value) : undefined }))}
                    className="w-full mt-1 rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none">
                    <option value="">선택</option>
                    {(channels ?? []).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>

              {/* 지점 선택 */}
              {branchList && branchList.length > 0 && (
                <div>
                  <label className="text-xs text-muted-foreground">지점 *</label>
                  <div className="flex gap-2 mt-1 flex-wrap">
                    <button type="button" onClick={() => setForm(f => ({ ...f, branchId: undefined }))}
                      className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${!form.branchId ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border text-muted-foreground hover:text-foreground"}`}>
                      미지정
                    </button>
                    {branchList.map((b) => (
                      <button key={b.id} type="button" onClick={() => setForm(f => ({ ...f, branchId: b.id }))}
                        className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${form.branchId === b.id ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border text-muted-foreground hover:text-foreground"}`}>
                        {b.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="text-xs text-muted-foreground">메모</label>
                <textarea value={form.memo} onChange={e => setForm(f => ({ ...f, memo: e.target.value }))} rows={2}
                  className="w-full mt-1 rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:outline-none resize-none" />
              </div>

              </div>
              <div className="flex gap-2 p-4 border-t border-border shrink-0">
                {editId && isAdminView && (
                  <button type="button" onClick={() => { if (confirm("삭제하시겠습니까?")) { deleteMutation.mutate({ id: editId }); resetForm(); } }}
                    className="flex-1 border border-red-500/30 text-red-400 rounded-lg py-2.5 text-sm font-medium hover:bg-red-500/10">
                    삭제
                  </button>
                )}
                {isConsultant && editId && editCreatedBy !== me?.id ? (
                  <div className="flex-1 text-center text-xs text-muted-foreground py-2.5">타인이 입력한 항목은 수정할 수 없습니다</div>
                ) : (
                <button type="submit" className="flex-1 bg-primary text-primary-foreground rounded-lg py-2.5 text-sm font-medium hover:bg-primary/90">
                  {editId ? "수정" : "등록"}
                </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
