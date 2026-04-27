import { useState } from "react";
import { trpc } from "../lib/trpc";
import { toast } from "sonner";
import {
  Plus, ChevronLeft, ChevronRight, Search, AlertCircle,
  TrendingUp, RefreshCw, Dumbbell, Heart, MoreHorizontal,
} from "lucide-react";

const PAYMENT_METHODS = ["카드", "현금", "계좌이체", "분할결제"];
const CATEGORIES = ["PT", "헬스", "기타"] as const;
const SUB_TYPES = ["신규", "재등록"] as const;
const DURATIONS = [1, 3, 6, 12];
const OTHER_ITEMS = ["락커", "운동복"];
const PT_PROGRAMS = ["케어피티", "웨이트피티", "이벤트피티", "기타"];
const PT_SESSIONS = [10, 20, 30, 40, 50];

type RevForm = {
  customerName: string; phone: string; programDetail: string; duration: string; sessions: string;
  leadId?: number; trainerId?: number; branchId?: number; channelId?: number;
  type: "PT" | "헬스" | "기타"; subType: "신규" | "재등록";
  amount: string; discountAmount: string; paidAmount: string; unpaidAmount: string; refundAmount: string;
  paymentMethod: string; paymentDate: string; startDate: string; installments: string; memo: string;
  ptProgramKey: string; ptProgramCustom: string;
};

const defaultForm: RevForm = {
  customerName: "", phone: "", programDetail: "", duration: "", sessions: "",
  ptProgramKey: "", ptProgramCustom: "",
  type: "PT", subType: "신규",
  amount: "", discountAmount: "0", paidAmount: "", unpaidAmount: "0", refundAmount: "0",
  paymentMethod: "카드", paymentDate: new Date().toISOString().substring(0, 10), startDate: "",
  installments: "1", memo: "",
};

function fmt(n: number) {
  return n.toLocaleString();
}

export default function RevenuePage() {
  const utils = trpc.useUtils();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<RevForm>(defaultForm);
  const [filterType, setFilterType] = useState("");

  const { data: me } = trpc.auth.me.useQuery();
  const isConsultant = me?.role === "consultant";

  const { data: entries, isLoading } = trpc.gym.revenue.list.useQuery({ year, month });
  const { data: trainerSummary } = trpc.gym.revenue.trainerSummary.useQuery({ year, month }, { enabled: !isConsultant });
  const { data: channels } = trpc.gym.channels.list.useQuery();
  const { data: trainers } = trpc.trainers.list.useQuery();
  const { data: kpi } = trpc.gym.kpi.overview.useQuery({ year, month }, { enabled: !isConsultant });

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

  function resetForm() { setShowForm(false); setEditId(null); setForm(defaultForm); }

  function openEdit(row: any) {
    setEditId(row.entry.id);
    setForm({
      customerName: row.entry.customerName ?? "",
      phone: row.entry.phone ?? "",
      programDetail: row.entry.programDetail ?? "",
      duration: row.entry.duration ? String(row.entry.duration) : "",
      sessions: row.entry.sessions ? String(row.entry.sessions) : "",
      ptProgramKey: PT_PROGRAMS.includes(row.entry.programDetail ?? "") ? (row.entry.programDetail ?? "") : (row.entry.programDetail ? "기타" : ""),
      ptProgramCustom: PT_PROGRAMS.includes(row.entry.programDetail ?? "") ? "" : (row.entry.programDetail ?? ""),
      leadId: row.entry.leadId ?? undefined,
      trainerId: row.entry.trainerId ?? undefined,
      branchId: row.entry.branchId ?? undefined,
      channelId: row.entry.channelId ?? undefined,
      type: row.entry.type,
      subType: row.entry.subType,
      amount: String(row.entry.amount),
      discountAmount: String(row.entry.discountAmount),
      paidAmount: String(row.entry.paidAmount),
      unpaidAmount: String(row.entry.unpaidAmount),
      refundAmount: String(row.entry.refundAmount),
      paymentMethod: row.entry.paymentMethod ?? "카드",
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
    if (!form.amount) return toast.error("금액을 입력해주세요");
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
      leadId: form.leadId ? Number(form.leadId) : undefined,
      trainerId: form.trainerId ? Number(form.trainerId) : undefined,
      branchId: form.branchId ? Number(form.branchId) : undefined,
      channelId: form.channelId ? Number(form.channelId) : undefined,
      type: form.type,
      subType: form.subType,
      amount: parseInt(form.amount) || 0,
      discountAmount: parseInt(form.discountAmount) || 0,
      paidAmount: parseInt(form.paidAmount) || 0,
      unpaidAmount: parseInt(form.unpaidAmount) || 0,
      refundAmount: parseInt(form.refundAmount) || 0,
      paymentMethod: form.paymentMethod,
      paymentDate: form.paymentDate,
      startDate: form.startDate || undefined,
      installments: parseInt(form.installments) || 1,
      memo: form.memo,
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

  const filtered = (entries ?? []).filter(row => {
    const q = search.toLowerCase();
    const matchSearch = !q || (row.memberName ?? "").toLowerCase().includes(q) || (row.trainerName ?? "").toLowerCase().includes(q) || (row.entry.memo ?? "").toLowerCase().includes(q);
    const matchType = !filterType || row.entry.type === filterType;
    return matchSearch && matchType;
  });

  const monthTotal = filtered.reduce((s, r) => s + r.entry.paidAmount, 0);
  const monthUnpaid = filtered.reduce((s, r) => s + r.entry.unpaidAmount, 0);

  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">매출 {isConsultant ? "입력" : "장부"}</h1>
          <p className="text-xs text-muted-foreground">{isConsultant ? "오늘 입력한 매출 내역" : "매출 입력 및 분석"}</p>
        </div>
        <button
          onClick={() => { setShowForm(true); setEditId(null); setForm({ ...defaultForm, paymentDate: new Date().toISOString().substring(0, 10) }); }}
          className="flex items-center gap-1.5 bg-primary text-primary-foreground px-3 py-2 rounded-lg text-sm font-medium hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          매출 입력
        </button>
      </div>

      {/* 월 선택 - 컨설턴트는 숨김 */}
      {!isConsultant && (
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

      {/* 요약 카드 - 컨설턴트는 숨김 */}
      {!isConsultant && (
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

      {/* 트레이너별 매출 - 컨설턴트는 숨김 */}
      {!isConsultant && (trainerSummary ?? []).length > 0 && (
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
        <div className="flex gap-2">
          {["", "PT", "헬스", "기타"].map(t => (
            <button key={t} onClick={() => setFilterType(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filterType === t ? "bg-primary text-primary-foreground" : "bg-card border border-border text-muted-foreground hover:text-foreground"}`}>
              {t || "전체"}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="회원명, 트레이너, 메모 검색..."
            className="w-full bg-card border border-border rounded-lg pl-9 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
        </div>
      </div>

      {/* 매출 목록 */}
      {isLoading ? (
        <div className="text-center text-muted-foreground py-8">로딩 중...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center text-muted-foreground py-12">
          <TrendingUp className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">이 달 매출 내역이 없습니다</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(row => (
            <div key={row.entry.id} onClick={() => openEdit(row)}
              className="bg-card border border-border rounded-xl p-4 cursor-pointer hover:border-primary/30 transition-colors">
              <div className="flex items-start justify-between">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${row.entry.type === "PT" ? "bg-amber-400/10 text-amber-400" : row.entry.type === "헬스" ? "bg-teal-400/10 text-teal-400" : "bg-muted text-muted-foreground"}`}>
                      {row.entry.type}
                    </span>
                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${row.entry.subType === "신규" ? "bg-blue-400/10 text-blue-400" : "bg-violet-400/10 text-violet-400"}`}>
                      {row.entry.subType}
                    </span>
                    <span className="text-sm font-medium text-foreground">{row.entry.customerName || row.memberName || "—"}</span>
                    {row.entry.programDetail && <span className="text-xs text-muted-foreground">{row.entry.programDetail}</span>}
                    {row.entry.duration && <span className="text-xs text-muted-foreground">{row.entry.duration}개월</span>}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {row.trainerName && <span>{row.trainerName}</span>}
                    {row.channelName && <span>· {row.channelName}</span>}
                    <span>· {row.entry.paymentDate}</span>
                    {row.entry.paymentMethod && <span>· {row.entry.paymentMethod}</span>}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-base font-bold text-foreground">{fmt(row.entry.paidAmount)}원</div>
                  {row.entry.unpaidAmount > 0 && (
                    <div className="text-xs text-red-400 flex items-center gap-0.5 justify-end">
                      <AlertCircle className="h-3 w-3" />
                      미수 {fmt(row.entry.unpaidAmount)}
                    </div>
                  )}
                  {row.entry.discountAmount > 0 && (
                    <div className="text-xs text-muted-foreground">할인 -{fmt(row.entry.discountAmount)}</div>
                  )}
                </div>
              </div>
              {row.entry.memo && <p className="text-xs text-muted-foreground mt-2">{row.entry.memo}</p>}
            </div>
          ))}
          <div className="bg-card border border-border rounded-xl p-3 flex justify-between text-sm font-semibold">
            <span className="text-foreground">합계 ({filtered.length}건)</span>
            <span className="text-emerald-400">{fmt(monthTotal)}원</span>
          </div>
        </div>
      )}

      {/* 매출 입력 폼 */}
      {showForm && (
        <div className="fixed inset-0 z-[200] bg-black/60 flex items-end md:items-center justify-center p-4 pb-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md flex flex-col" style={{ maxHeight: "90vh" }}>
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
                    className="w-full mt-1 bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">연락처</label>
                  <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="010-0000-0000"
                    className="w-full mt-1 bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
                </div>
              </div>

              {/* 프로그램 유형 */}
              <div>
                <label className="text-xs text-muted-foreground">프로그램 유형 *</label>
                <div className="flex gap-2 mt-1">
                  {CATEGORIES.map(c => (
                    <button key={c} type="button" onClick={() => setForm(f => ({ ...f, type: c, programDetail: "", duration: "" }))}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${form.type === c ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border text-muted-foreground hover:text-foreground"}`}>
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              {/* PT: 프로그램명 */}
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
                      className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
                  )}
                  <div>
                    <label className="text-xs text-muted-foreground">횟수</label>
                    <div className="flex gap-2 mt-1">
                      {PT_SESSIONS.map(s => (
                        <button key={s} type="button" onClick={() => setForm(f => ({ ...f, sessions: form.sessions === String(s) ? "" : String(s) }))}
                          className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${form.sessions === String(s) ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border text-muted-foreground hover:text-foreground"}`}>
                          {s}회
                        </button>
                      ))}
                    </div>
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

              {/* 기타: 항목 + 기간 */}
              {form.type === "기타" && (
                <div className="space-y-2">
                  <div>
                    <label className="text-xs text-muted-foreground">항목</label>
                    <div className="flex gap-2 mt-1">
                      {OTHER_ITEMS.map(item => (
                        <button key={item} type="button" onClick={() => setForm(f => ({ ...f, programDetail: item }))}
                          className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${form.programDetail === item ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border text-muted-foreground hover:text-foreground"}`}>
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

              {/* 신규/재등록 */}
              <div>
                <label className="text-xs text-muted-foreground">등록 유형 *</label>
                <div className="flex gap-2 mt-1">
                  {SUB_TYPES.map(s => (
                    <button key={s} type="button" onClick={() => setForm(f => ({ ...f, subType: s }))}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${form.subType === s ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border text-muted-foreground hover:text-foreground"}`}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* 금액 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">총 금액 *</label>
                  <input type="number" value={form.amount} onChange={e => handleAmountChange(e.target.value)} placeholder="0"
                    className="w-full mt-1 bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">할인 금액</label>
                  <input type="number" value={form.discountAmount} onChange={e => {
                    const discount = parseInt(e.target.value) || 0;
                    const amount = parseInt(form.amount) || 0;
                    setForm(f => ({ ...f, discountAmount: e.target.value, paidAmount: String(Math.max(0, amount - discount)) }));
                  }} placeholder="0"
                    className="w-full mt-1 bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">실 납부액 *</label>
                  <input type="number" value={form.paidAmount} onChange={e => setForm(f => ({ ...f, paidAmount: e.target.value }))} placeholder="0"
                    className="w-full mt-1 bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">미수금</label>
                  <input type="number" value={form.unpaidAmount} onChange={e => setForm(f => ({ ...f, unpaidAmount: e.target.value }))} placeholder="0"
                    className="w-full mt-1 bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
                </div>
              </div>

              {/* 결제 정보 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">결제 방법</label>
                  <select value={form.paymentMethod} onChange={e => setForm(f => ({ ...f, paymentMethod: e.target.value }))}
                    className="w-full mt-1 bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none">
                    {PAYMENT_METHODS.map(m => <option key={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">결제일 *</label>
                  <input type="date" value={form.paymentDate} onChange={e => setForm(f => ({ ...f, paymentDate: e.target.value }))}
                    className="w-full mt-1 bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">시작일</label>
                  <input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
                    className="w-full mt-1 bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
                </div>
                <div />
              </div>

              {/* 트레이너 / 채널 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">트레이너</label>
                  <select value={form.trainerId ?? ""} onChange={e => setForm(f => ({ ...f, trainerId: e.target.value ? Number(e.target.value) : undefined }))}
                    className="w-full mt-1 bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none">
                    <option value="">선택</option>
                    {(trainers ?? []).map((t: any) => <option key={t.id} value={t.id}>{t.trainerName}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">유입 채널</label>
                  <select value={form.channelId ?? ""} onChange={e => setForm(f => ({ ...f, channelId: e.target.value ? Number(e.target.value) : undefined }))}
                    className="w-full mt-1 bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none">
                    <option value="">선택</option>
                    {(channels ?? []).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs text-muted-foreground">메모</label>
                <textarea value={form.memo} onChange={e => setForm(f => ({ ...f, memo: e.target.value }))} rows={2}
                  className="w-full mt-1 bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none" />
              </div>

              </div>
              <div className="flex gap-2 p-4 border-t border-border shrink-0">
                {editId && !isConsultant && (
                  <button type="button" onClick={() => { if (confirm("삭제하시겠습니까?")) { deleteMutation.mutate({ id: editId }); resetForm(); } }}
                    className="flex-1 border border-red-500/30 text-red-400 rounded-lg py-2.5 text-sm font-medium hover:bg-red-500/10">
                    삭제
                  </button>
                )}
                <button type="submit" className="flex-1 bg-primary text-primary-foreground rounded-lg py-2.5 text-sm font-medium hover:bg-primary/90">
                  {editId ? "수정" : "등록"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
