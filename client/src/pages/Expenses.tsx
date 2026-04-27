import { useState } from "react";
import { trpc } from "../lib/trpc";
import { toast } from "sonner";
import { Plus, ChevronLeft, ChevronRight, PieChart as PieIcon } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";

const PAYMENT_METHODS = ["카드", "현금", "계좌이체"];

const CATEGORY_MAP: Record<string, string[]> = {
  "고정관리비": ["임대료", "전기세", "가스비", "공동관리비", "인터넷비", "정수기비", "TV비", "CRM비"],
  "유동관리비": ["A/S 비용", "예상 외 지출"],
  "인건비":     ["트레이너 급여", "컨설턴트 급여"],
  "운영비":     ["물품구매비", "소모품비", "사무용품비", "청소용품비", "마케팅비"],
};
const MAIN_CATEGORIES = Object.keys(CATEGORY_MAP);
const COLORS = ["#6366f1", "#8b5cf6", "#ec4899", "#f59e0b"];

type ExpForm = {
  branchId?: number;
  category: string;
  subCategory: string;
  amount: string;
  paymentMethod: string;
  vendor: string;
  expenseDate: string;
  memo: string;
};

const defaultForm: ExpForm = {
  category: "", subCategory: "",
  amount: "", paymentMethod: "카드", vendor: "",
  expenseDate: new Date().toISOString().substring(0, 10), memo: "",
};

export default function ExpensesPage() {
  const utils = trpc.useUtils();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<ExpForm>(defaultForm);
  const [filterCat, setFilterCat] = useState("");

  const { data: entries, isLoading } = trpc.gym.expenses.list.useQuery({ year, month });
  const { data: categorySummary } = trpc.gym.expenses.categorySummary.useQuery({ year, month });

  const createMutation = trpc.gym.expenses.create.useMutation({
    onSuccess: () => { toast.success("지출이 등록되었습니다"); utils.gym.expenses.invalidate(); utils.gym.kpi.invalidate(); resetForm(); },
    onError: (e) => toast.error(e.message),
  });
  const updateMutation = trpc.gym.expenses.update.useMutation({
    onSuccess: () => { toast.success("수정되었습니다"); utils.gym.expenses.invalidate(); utils.gym.kpi.invalidate(); resetForm(); },
    onError: (e) => toast.error(e.message),
  });
  const deleteMutation = trpc.gym.expenses.delete.useMutation({
    onSuccess: () => { toast.success("삭제되었습니다"); utils.gym.expenses.invalidate(); utils.gym.kpi.invalidate(); },
  });

  function resetForm() { setShowForm(false); setEditId(null); setForm(defaultForm); }

  function openEdit(row: any) {
    setEditId(row.entry.id);
    setForm({
      branchId: row.entry.branchId ?? undefined,
      category: row.entry.category,
      subCategory: row.entry.subCategory ?? "",
      amount: String(row.entry.amount),
      paymentMethod: row.entry.paymentMethod ?? "카드",
      vendor: row.entry.vendor ?? "",
      expenseDate: row.entry.expenseDate,
      memo: row.entry.memo ?? "",
    });
    setShowForm(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.category) return toast.error("대분류 카테고리를 선택해주세요");
    if (!form.subCategory) return toast.error("소분류 카테고리를 선택해주세요");
    if (!form.amount) return toast.error("금액을 입력해주세요");
    const payload = {
      branchId: form.branchId,
      category: form.category,
      subCategory: form.subCategory,
      amount: parseInt(form.amount) || 0,
      paymentMethod: form.paymentMethod || undefined,
      vendor: form.vendor || undefined,
      expenseDate: form.expenseDate,
      memo: form.memo || undefined,
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

  const filtered = (entries ?? []).filter(r => !filterCat || r.entry.category === filterCat);
  const totalExpense = filtered.reduce((s, r) => s + r.entry.amount, 0);
  const pieData = (categorySummary ?? []).map(c => ({ name: c.category, value: c.total }));

  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">지출 장부</h1>
          <p className="text-xs text-muted-foreground">월별 지출 입력 및 분석</p>
        </div>
        <button
          onClick={() => { setShowForm(true); setEditId(null); setForm({ ...defaultForm, expenseDate: new Date().toISOString().substring(0, 10) }); }}
          className="flex items-center gap-1.5 bg-primary text-primary-foreground px-3 py-2 rounded-lg text-sm font-medium hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          지출 입력
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

      {/* 총 지출 */}
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="text-xs text-muted-foreground mb-1">이번달 총 지출</div>
        <div className="text-2xl font-bold text-red-400">{totalExpense.toLocaleString()}원</div>
      </div>

      {/* 카테고리 파이차트 */}
      {pieData.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-4">
          <h2 className="text-sm font-semibold text-foreground mb-3">대분류별 지출</h2>
          <div className="flex items-center gap-4">
            <ResponsiveContainer width={110} height={110}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={28} outerRadius={48} dataKey="value">
                  {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="flex-1 space-y-1.5">
              {(categorySummary ?? []).map((c, i) => (
                <div key={c.category} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                    <span className="text-muted-foreground">{c.category}</span>
                  </div>
                  <span className="font-medium text-foreground">{c.total.toLocaleString()}원</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 대분류 필터 */}
      <div className="flex gap-2 flex-wrap">
        <button onClick={() => setFilterCat("")}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${!filterCat ? "bg-primary text-primary-foreground" : "bg-card border border-border text-muted-foreground hover:text-foreground"}`}>
          전체
        </button>
        {MAIN_CATEGORIES.map(cat => (
          <button key={cat} onClick={() => setFilterCat(filterCat === cat ? "" : cat)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filterCat === cat ? "bg-primary text-primary-foreground" : "bg-card border border-border text-muted-foreground hover:text-foreground"}`}>
            {cat}
          </button>
        ))}
      </div>

      {/* 지출 목록 */}
      {isLoading ? (
        <div className="text-center text-muted-foreground py-8">로딩 중...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center text-muted-foreground py-12">
          <PieIcon className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">이 달 지출 내역이 없습니다</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(row => {
            const catIdx = MAIN_CATEGORIES.indexOf(row.entry.category);
            return (
              <div key={row.entry.id} onClick={() => openEdit(row)}
                className="bg-card border border-border rounded-xl p-4 cursor-pointer hover:border-primary/30 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[catIdx >= 0 ? catIdx : 0] }} />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">{row.entry.category}</span>
                        <span className="text-sm font-medium text-foreground">{row.entry.subCategory ?? ""}</span>
                        {row.entry.vendor && <span className="text-xs text-muted-foreground">{row.entry.vendor}</span>}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{row.entry.expenseDate}</span>
                        {row.entry.paymentMethod && <span>· {row.entry.paymentMethod}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="text-base font-bold text-red-400">{row.entry.amount.toLocaleString()}원</div>
                </div>
                {row.entry.memo && <p className="text-xs text-muted-foreground mt-2">{row.entry.memo}</p>}
              </div>
            );
          })}
          <div className="bg-card border border-border rounded-xl p-3 flex justify-between text-sm font-semibold">
            <span className="text-foreground">합계 ({filtered.length}건)</span>
            <span className="text-red-400">{totalExpense.toLocaleString()}원</span>
          </div>
        </div>
      )}

      {/* 지출 입력 폼 */}
      {showForm && (
        <div className="fixed inset-0 z-[200] bg-black/60 flex items-end md:items-center justify-center p-4 pb-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md flex flex-col" style={{ maxHeight: "90vh" }}>
            <div className="sticky top-0 bg-card border-b border-border px-4 py-3 flex items-center justify-between shrink-0">
              <h2 className="font-semibold text-foreground">{editId ? "지출 수정" : "지출 입력"}</h2>
              <button onClick={resetForm} className="text-muted-foreground hover:text-foreground">✕</button>
            </div>
            <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
              <div className="overflow-y-auto flex-1 p-4 space-y-4">

                {/* 대분류 */}
                <div>
                  <label className="text-xs text-muted-foreground">대분류 *</label>
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    {MAIN_CATEGORIES.map((cat, i) => (
                      <button key={cat} type="button"
                        onClick={() => setForm(f => ({ ...f, category: cat, subCategory: "" }))}
                        className={`py-2.5 rounded-lg text-sm font-medium border transition-colors ${form.category === cat ? "text-white border-transparent" : "bg-background border-border text-muted-foreground hover:text-foreground"}`}
                        style={form.category === cat ? { backgroundColor: COLORS[i] } : {}}>
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 소분류 */}
                {form.category && (
                  <div>
                    <label className="text-xs text-muted-foreground">소분류 *</label>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {CATEGORY_MAP[form.category].map(sub => (
                        <button key={sub} type="button"
                          onClick={() => setForm(f => ({ ...f, subCategory: sub }))}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${form.subCategory === sub ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border text-muted-foreground hover:text-foreground"}`}>
                          {sub}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* 금액 */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground">금액 *</label>
                    <input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="0"
                      className="w-full mt-1 bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">지출일 *</label>
                    <input type="date" value={form.expenseDate} onChange={e => setForm(f => ({ ...f, expenseDate: e.target.value }))}
                      className="w-full mt-1 bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
                  </div>
                </div>

                {/* 결제 방식 */}
                <div>
                  <label className="text-xs text-muted-foreground">결제 방식</label>
                  <div className="flex gap-2 mt-1">
                    {PAYMENT_METHODS.map(m => (
                      <button key={m} type="button" onClick={() => setForm(f => ({ ...f, paymentMethod: m }))}
                        className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${form.paymentMethod === m ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border text-muted-foreground hover:text-foreground"}`}>
                        {m}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 거래처 / 메모 */}
                <div>
                  <label className="text-xs text-muted-foreground">거래처/공급업체</label>
                  <input value={form.vendor} onChange={e => setForm(f => ({ ...f, vendor: e.target.value }))} placeholder="거래처명"
                    className="w-full mt-1 bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
                </div>

                <div>
                  <label className="text-xs text-muted-foreground">메모</label>
                  <textarea value={form.memo} onChange={e => setForm(f => ({ ...f, memo: e.target.value }))} rows={2}
                    className="w-full mt-1 bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none" />
                </div>

              </div>
              <div className="flex gap-2 p-4 border-t border-border shrink-0">
                {editId && (
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
