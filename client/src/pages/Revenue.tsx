import { useState, useMemo } from "react";
import { trpc } from "../lib/trpc";
import { toast } from "sonner";
import ExpensesPage from "./Expenses";
import {
  ChevronLeft, ChevronRight, Search, AlertCircle,
  TrendingUp, TrendingDown, DollarSign, RefreshCw,
} from "lucide-react";
import { parseServiceItems, SERVICE_COLORS, type ServiceType } from "@/lib/memberServices";

const PAYMENT_METHODS = ["카드", "현금", "현금영수증", "계좌이체", "지역화폐", "분할결제", "혼합"];
const PRODUCT_TYPES = ["전체", "PT", "헬스", "운동복", "락커", "1일권", "기타"];
const SUB_TYPE_FILTERS = ["전체", "신규", "재등록"];

function fmt(n: number) { return n.toLocaleString(); }

function computeRevenueEndDate(entry: any): string | null {
  if (!entry.startDate) return null;
  let months = entry.duration ? Number(entry.duration) : 0;
  if (!months) {
    const m = /^헬스\s*(\d+)개월/.exec(entry.programDetail ?? "");
    if (m) months = parseInt(m[1]);
  }
  if (!months) return null;
  const [y, mo, dy] = (entry.startDate as string).split("-").map(Number);
  const d = new Date(y, mo - 1, dy);
  d.setMonth(d.getMonth() + months);
  if (entry.serviceItems) {
    for (const part of (entry.serviceItems as string).split(",").map((s: string) => s.trim())) {
      const moM = /^헬스\((\d+)개월\)$/.exec(part);
      if (moM) { d.setMonth(d.getMonth() + parseInt(moM[1])); continue; }
      const dyM = /^헬스\((\d+)일\)$/.exec(part);
      if (dyM) { d.setDate(d.getDate() + parseInt(dyM[1])); }
    }
  }
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getProductType(entry: any): string {
  if (entry.type === "PT") return "PT";
  if (entry.type === "헬스") return "헬스";
  const d = (entry.programDetail ?? "") as string;
  if (d.includes("운동복") || d === "운동복 대여") return "운동복";
  if (d.includes("락커")) return "락커";
  if (d.includes("1일권") || d.includes("일일권")) return "1일권";
  return "기타";
}

// ─── 탭 컨테이너 ──────────────────────────────────────────────────────────────
export default function RevenuePage() {
  const [tab, setTab] = useState<"revenue" | "expenses" | "stats" | "monthly">("revenue");
  return (
    <div className="space-y-4">
      <div className="flex bg-card border border-border rounded-xl p-1 gap-1">
        {([
          { key: "revenue", label: "매출" },
          { key: "expenses", label: "지출" },
          { key: "stats", label: "통계" },
          { key: "monthly", label: "월별리포트" },
        ] as const).map(({ key, label }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${tab === key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
            {label}
          </button>
        ))}
      </div>
      {tab === "revenue"  && <RevenueTab />}
      {tab === "expenses" && <ExpensesPage />}
      {tab === "stats"    && <StatsTab />}
      {tab === "monthly"  && <MonthlyReportTab />}
    </div>
  );
}

// ─── 매출 탭 (읽기 전용 + 환불 등록) ─────────────────────────────────────────
function RevenueTab() {
  const now = new Date();
  const [year, setYear]   = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [search, setSearch]                 = useState("");
  const [filterProduct, setFilterProduct]   = useState("전체");
  const [filterSubType, setFilterSubType]   = useState("전체");
  const [filterPayment, setFilterPayment]   = useState("");
  const [filterTrainer, setFilterTrainer]   = useState<number | "">("");
  const [branchFilter, setBranchFilter]     = useState<number | null>(null);
  const { data: me }        = trpc.auth.me.useQuery();
  const isAdmin             = me?.role === "admin" || me?.role === "sub_admin";
  const { data: entries, isLoading } = trpc.gym.revenue.list.useQuery({ year, month });
  const { data: trainers }  = trpc.trainers.list.useQuery();
  const { data: branchList }= trpc.gym.staff.listBranches.useQuery();
  const { data: cumulativeUnpaidData } = trpc.gym.revenue.cumulativeUnpaid.useQuery(
    branchFilter ? { branchId: branchFilter } : undefined
  );

  function prevMonth() { if (month === 1) { setYear(y => y - 1); setMonth(12); } else setMonth(m => m - 1); }
  function nextMonth() { if (month === 12) { setYear(y => y + 1); setMonth(1); } else setMonth(m => m + 1); }

  const rawEntries = entries ?? [];
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return rawEntries.filter(row => {
      if (filterProduct !== "전체" && getProductType(row.entry) !== filterProduct) return false;
      if (filterSubType !== "전체" && row.entry.subType !== filterSubType) return false;
      if (filterPayment && row.entry.paymentMethod !== filterPayment) return false;
      if (filterTrainer !== "" && row.entry.trainerId !== filterTrainer) return false;
      if (branchFilter && row.entry.branchId !== branchFilter) return false;
      if (q && ![(row.memberName ?? ""), (row.trainerName ?? ""), (row.entry.customerName ?? ""), (row.entry.memo ?? "")].some(s => s.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [rawEntries, filterProduct, filterSubType, filterPayment, filterTrainer, branchFilter, search]);

  // 중복 제거
  const TYPE_PRI: Record<string, number> = { PT: 3, 헬스: 2, 기타: 1 };
  const dedupMap = new Map<string, typeof filtered[0]>();
  for (const row of filtered) {
    const key = `${row.entry.customerName}|${row.entry.paymentDate}|${row.entry.amount}|${row.entry.subType}`;
    const ex = dedupMap.get(key);
    if (!ex || (TYPE_PRI[row.entry.type] ?? 0) > (TYPE_PRI[ex.entry.type] ?? 0)) dedupMap.set(key, row);
  }
  const deduped = Array.from(dedupMap.values());

  const regularRows = deduped.filter(r => r.entry.subType !== "환불");
  const refundRows  = deduped.filter(r => r.entry.subType === "환불");
  const totalRevenue = regularRows.reduce((s, r) => s + r.entry.paidAmount, 0);
  const monthUnpaid  = regularRows.reduce((s, r) => s + r.entry.unpaidAmount, 0);
  const cumulativeUnpaid = cumulativeUnpaidData?.total ?? monthUnpaid;
  const totalRefund  = refundRows.reduce((s, r) => s + Math.abs(r.entry.paidAmount), 0);
  const netRevenue   = totalRevenue - totalRefund;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">매출 장부</h1>
        <p className="text-xs text-muted-foreground">등록관리 기반 · 읽기 전용</p>
      </div>

      {/* 지점 필터 */}
      {isAdmin && (branchList ?? []).length > 0 && (
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setBranchFilter(null)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${branchFilter === null ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:text-foreground"}`}>전체</button>
          {branchList!.map(b => (
            <button key={b.id} onClick={() => setBranchFilter(b.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${branchFilter === b.id ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:text-foreground"}`}>{b.name}</button>
          ))}
        </div>
      )}

      {/* 월 선택 */}
      <div className="flex items-center justify-center gap-3 bg-card border border-border rounded-xl px-4 py-3">
        <button onClick={prevMonth} className="text-muted-foreground hover:text-foreground"><ChevronLeft className="h-5 w-5" /></button>
        <span className="text-base font-semibold min-w-[100px] text-center">{year}년 {month}월</span>
        <button onClick={nextMonth} className="text-muted-foreground hover:text-foreground"><ChevronRight className="h-5 w-5" /></button>
      </div>

      {/* 요약 4칸 */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-card border border-border rounded-xl p-3">
          <div className="text-xs text-muted-foreground mb-1">총 매출</div>
          <div className="text-lg font-bold text-emerald-400">{fmt(totalRevenue)}원</div>
          <div className="text-xs text-muted-foreground">{regularRows.length}건</div>
        </div>
        <div className={`bg-card border rounded-xl p-3 ${cumulativeUnpaid > 0 ? "border-red-500/30" : "border-border"}`}>
          <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
            {cumulativeUnpaid > 0 && <AlertCircle className="h-3 w-3 text-red-400" />}미수금 (누적)
          </div>
          <div className={`text-lg font-bold ${cumulativeUnpaid > 0 ? "text-red-400" : "text-muted-foreground"}`}>{fmt(cumulativeUnpaid)}원</div>
          {monthUnpaid > 0 && monthUnpaid !== cumulativeUnpaid && (
            <div className="text-xs text-red-400/70 mt-0.5">이번 달 {fmt(monthUnpaid)}원</div>
          )}
        </div>
        <div className="bg-card border border-border rounded-xl p-3">
          <div className="text-xs text-muted-foreground mb-1">환불/조정</div>
          <div className="text-lg font-bold text-orange-400">-{fmt(totalRefund)}원</div>
        </div>
        <div className="bg-card border border-emerald-500/30 rounded-xl p-3">
          <div className="text-xs text-muted-foreground mb-1">순매출</div>
          <div className="text-lg font-bold text-emerald-400">{fmt(netRevenue)}원</div>
        </div>
      </div>

      {/* 필터 */}
      <div className="space-y-2">
        <div className="flex gap-1.5 flex-wrap">
          {PRODUCT_TYPES.map(t => (
            <button key={t} onClick={() => setFilterProduct(t)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${filterProduct === t ? "bg-primary text-primary-foreground" : "bg-card border border-border text-muted-foreground hover:text-foreground"}`}>
              {t}
            </button>
          ))}
        </div>
        <div className="flex gap-1.5">
          {SUB_TYPE_FILTERS.map(t => (
            <button key={t} onClick={() => setFilterSubType(t)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${filterSubType === t ? "bg-primary text-primary-foreground" : "bg-card border border-border text-muted-foreground hover:text-foreground"}`}>
              {t}
            </button>
          ))}
          <select value={filterPayment} onChange={e => setFilterPayment(e.target.value)}
            className="px-2 py-1.5 rounded-lg text-xs bg-card border border-border text-muted-foreground focus:outline-none">
            <option value="">결제수단</option>
            {PAYMENT_METHODS.map(m => <option key={m}>{m}</option>)}
          </select>
          <select value={filterTrainer} onChange={e => setFilterTrainer(e.target.value ? Number(e.target.value) : "")}
            className="flex-1 px-2 py-1.5 rounded-lg text-xs bg-card border border-border text-muted-foreground focus:outline-none min-w-0">
            <option value="">담당자</option>
            {(trainers ?? []).map((t: any) => <option key={t.id} value={t.id}>{t.trainerName}</option>)}
          </select>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="회원명, 트레이너, 메모 검색..."
            className="w-full bg-card border border-border rounded-lg pl-9 pr-4 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
        </div>
      </div>

      {/* 안내 */}
      <div className="flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 rounded-xl px-4 py-2.5">
        <AlertCircle className="h-4 w-4 text-blue-400 shrink-0" />
        <p className="text-xs text-blue-300">매출 수정은 <strong>등록관리</strong>에서 원본 데이터를 수정해주세요.</p>
      </div>

      {/* 목록 */}
      {isLoading ? (
        <div className="text-center text-muted-foreground py-8">로딩 중...</div>
      ) : deduped.length === 0 ? (
        <div className="text-center text-muted-foreground py-12">
          <TrendingUp className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">이 달 매출 내역이 없습니다</p>
        </div>
      ) : (
        <div className="space-y-2">
          {deduped.map(row => {
            const isRefund = row.entry.subType === "환불";
            const parsedItems = parseServiceItems((row.entry as any).serviceItems ?? "");
            const subTypeStyle = isRefund
              ? "bg-orange-400/10 text-orange-400 border-orange-400/30"
              : row.entry.subType === "신규"
              ? "bg-blue-400/10 text-blue-400 border-blue-400/30"
              : row.entry.subType === "이전"
              ? "bg-gray-400/10 text-gray-400 border-gray-400/30"
              : "bg-violet-400/10 text-violet-400 border-violet-400/30";
            const productType = getProductType(row.entry);
            const effectiveType: ServiceType = productType === "PT" ? "PT" : productType === "헬스" ? "헬스" : productType === "운동복" ? "운동복" : productType === "락커" ? "락커" : "기타";
            const mainCol = SERVICE_COLORS[effectiveType] ?? SERVICE_COLORS.기타;

            return (
              <div key={row.entry.id}
                onClick={() => toast.info("수정이 필요하면 등록관리에서 원본 데이터를 수정해주세요")}
                className={`bg-card border rounded-xl p-4 cursor-pointer hover:border-primary/30 transition-colors ${isRefund ? "border-orange-500/30" : "border-border"}`}>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm font-bold truncate">{row.entry.customerName || row.memberName || "—"}</span>
                    <span className={`shrink-0 text-[11px] px-1.5 py-0.5 rounded border font-semibold ${subTypeStyle}`}>{row.entry.subType}</span>
                  </div>
                  <div className="text-right shrink-0">
                    <div className={`text-base font-bold whitespace-nowrap ${isRefund ? "text-orange-400" : "text-foreground"}`}>
                      {isRefund ? "-" : ""}{fmt(Math.abs(row.entry.paidAmount))}원
                    </div>
                    {row.entry.unpaidAmount > 0 && (
                      <div className="text-xs text-red-400 flex items-center gap-0.5 justify-end">
                        <AlertCircle className="h-3 w-3" />미수 {fmt(row.entry.unpaidAmount)}
                      </div>
                    )}
                    {row.entry.discountAmount > 0 && (
                      <div className="text-xs text-muted-foreground">할인 -{fmt(row.entry.discountAmount)}</div>
                    )}
                  </div>
                </div>

                {!isRefund && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${mainCol.bg} ${mainCol.text} ${mainCol.border}`}>
                      {effectiveType === "PT" ? `PT${row.entry.sessions ? ` ${row.entry.sessions}회` : ""}`
                        : effectiveType === "헬스" ? (row.entry.programDetail?.startsWith("헬스") ? row.entry.programDetail : `헬스${row.entry.duration ? ` ${row.entry.duration}개월` : ""}`)
                        : effectiveType === "운동복" ? "운동복"
                        : effectiveType === "락커" ? (row.entry.programDetail?.match(/락커\(([^)]+)\)/) ? `락커 ${row.entry.programDetail.match(/락커\(([^)]+)\)/)![1]}번` : "락커")
                        : row.entry.programDetail || row.entry.type}
                    </span>
                    {row.entry.type === "PT" && row.entry.programDetail && (
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium border bg-muted/40 text-muted-foreground border-border">{row.entry.programDetail}</span>
                    )}
                    {parsedItems.map((item, i) => {
                      const col = SERVICE_COLORS[item.type] ?? SERVICE_COLORS.기타;
                      return <span key={i} className={`text-xs px-2 py-0.5 rounded-full font-medium border ${col.bg} ${col.text} ${col.border}`}>{item.label}</span>;
                    })}
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                  {row.entry.type === "헬스" && row.entry.startDate
                    ? <span>{row.entry.startDate} ~ {computeRevenueEndDate(row.entry) ?? "—"}</span>
                    : row.entry.type === "PT" && row.entry.startDate
                    ? <span>{row.entry.startDate} 등록</span>
                    : <span>{row.entry.paymentDate}</span>}
                  {row.entry.paymentMethod && <span>· {row.entry.paymentMethod}</span>}
                  {row.trainerName && <span>· {row.trainerName}</span>}
                  {(row as any).branchName && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400 font-medium">{(row as any).branchName}</span>
                  )}
                </div>
                {row.entry.memo && (
                  <p className="text-xs text-muted-foreground mt-1.5 pt-1.5 border-t border-border/50">{row.entry.memo}</p>
                )}
              </div>
            );
          })}
          <div className="bg-card border border-border rounded-xl p-3 flex justify-between text-sm font-semibold">
            <span>합계 ({deduped.length}건)</span>
            <span className="text-emerald-400">{fmt(netRevenue)}원</span>
          </div>
        </div>
      )}

    </div>
  );
}

// ─── 통계 탭 ──────────────────────────────────────────────────────────────────
function StatsTab() {
  const now = new Date();
  const [year, setYear]   = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [branchFilter, setBranchFilter] = useState<number | null>(null);

  const { data: me }         = trpc.auth.me.useQuery();
  const isAdmin              = me?.role === "admin" || me?.role === "sub_admin";
  const { data: entries }    = trpc.gym.revenue.list.useQuery({ year, month });
  const { data: expData }    = trpc.gym.expenses.list.useQuery({ year, month }, { enabled: isAdmin });
  const { data: trainerSum } = trpc.gym.revenue.trainerSummary.useQuery({ year, month }, { enabled: isAdmin });
  const { data: branchList } = trpc.gym.staff.listBranches.useQuery();

  function prevMonth() { if (month === 1) { setYear(y => y - 1); setMonth(12); } else setMonth(m => m - 1); }
  function nextMonth() { if (month === 12) { setYear(y => y + 1); setMonth(1); } else setMonth(m => m + 1); }

  const revRows = (entries ?? []).filter(r => !branchFilter || r.entry.branchId === branchFilter);
  const regularRows = revRows.filter(r => r.entry.subType !== "환불" && r.entry.subType !== "이전");
  const refundRows  = revRows.filter(r => r.entry.subType === "환불");

  const totalRevenue = regularRows.reduce((s, r) => s + r.entry.paidAmount, 0);
  const totalRefund  = refundRows.reduce((s, r) => s + Math.abs(r.entry.paidAmount), 0);
  const netRevenue   = totalRevenue - totalRefund;
  const totalUnpaid  = regularRows.reduce((s, r) => s + r.entry.unpaidAmount, 0);
  const totalExpense = (expData ?? [])
    .filter(r => !branchFilter || r.entry.branchId === branchFilter)
    .reduce((s, r) => s + r.entry.amount, 0);
  const netProfit  = netRevenue - totalExpense;
  const newSales   = regularRows.filter(r => r.entry.subType === "신규").reduce((s, r) => s + r.entry.paidAmount, 0);
  const renewSales = regularRows.filter(r => r.entry.subType === "재등록").reduce((s, r) => s + r.entry.paidAmount, 0);

  const productSales: Record<string, number> = {};
  for (const row of regularRows) {
    const p = getProductType(row.entry);
    productSales[p] = (productSales[p] ?? 0) + row.entry.paidAmount;
  }
  const productList = Object.entries(productSales).sort(([, a], [, b]) => b - a);

  const PCOL: Record<string, string> = { PT: "text-blue-400", 헬스: "text-emerald-400", 운동복: "text-purple-400", 락커: "text-amber-400", "1일권": "text-cyan-400" };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">통계</h1>
        <p className="text-xs text-muted-foreground">월별 수익 현황</p>
      </div>

      {isAdmin && (branchList ?? []).length > 0 && (
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setBranchFilter(null)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${branchFilter === null ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:text-foreground"}`}>전체</button>
          {branchList!.map(b => (
            <button key={b.id} onClick={() => setBranchFilter(b.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${branchFilter === b.id ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:text-foreground"}`}>{b.name}</button>
          ))}
        </div>
      )}

      <div className="flex items-center justify-center gap-3 bg-card border border-border rounded-xl px-4 py-3">
        <button onClick={prevMonth} className="text-muted-foreground hover:text-foreground"><ChevronLeft className="h-5 w-5" /></button>
        <span className="text-base font-semibold min-w-[100px] text-center">{year}년 {month}월</span>
        <button onClick={nextMonth} className="text-muted-foreground hover:text-foreground"><ChevronRight className="h-5 w-5" /></button>
      </div>

      {/* KPI 4칸 */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2"><TrendingUp className="h-4 w-4 text-emerald-400" /><span className="text-xs text-muted-foreground">총 매출</span></div>
          <div className="text-xl font-bold text-emerald-400">{fmt(totalRevenue)}원</div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2"><TrendingDown className="h-4 w-4 text-red-400" /><span className="text-xs text-muted-foreground">총 지출</span></div>
          <div className="text-xl font-bold text-red-400">{fmt(totalExpense)}원</div>
        </div>
        <div className={`bg-card border rounded-xl p-4 ${netProfit >= 0 ? "border-emerald-500/30" : "border-red-500/30"}`}>
          <div className="flex items-center gap-2 mb-2"><DollarSign className="h-4 w-4" /><span className="text-xs text-muted-foreground">순이익 (매출-지출)</span></div>
          <div className={`text-xl font-bold ${netProfit >= 0 ? "text-emerald-400" : "text-red-400"}`}>{fmt(netProfit)}원</div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2"><RefreshCw className="h-4 w-4 text-orange-400" /><span className="text-xs text-muted-foreground">순매출 (매출-환불)</span></div>
          <div className="text-xl font-bold">{fmt(netRevenue)}원</div>
        </div>
      </div>

      {totalUnpaid > 0 && (
        <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-3 flex items-center justify-between">
          <div className="flex items-center gap-2"><AlertCircle className="h-4 w-4 text-red-400" /><span className="text-sm text-red-400 font-medium">미수금</span></div>
          <span className="text-sm font-bold text-red-400">{fmt(totalUnpaid)}원</span>
        </div>
      )}

      {/* 신규 vs 재등록 */}
      {totalRevenue > 0 && (
        <div className="bg-card border border-border rounded-xl p-4">
          <h3 className="text-sm font-semibold mb-3">신규 vs 재등록</h3>
          {[
            { label: "신규", amount: newSales, color: "bg-blue-400", textCol: "text-blue-400" },
            { label: "재등록", amount: renewSales, color: "bg-violet-400", textCol: "text-violet-400" },
          ].map(({ label, amount, color, textCol }) => (
            <div key={label} className="mb-2">
              <div className="flex justify-between text-xs mb-1">
                <span className={textCol}>{label} {fmt(amount)}원</span>
                <span className={textCol}>{totalRevenue > 0 ? Math.round((amount / totalRevenue) * 100) : 0}%</span>
              </div>
              <div className="w-full bg-background rounded-full h-2">
                <div className={`${color} h-2 rounded-full`} style={{ width: `${totalRevenue > 0 ? (amount / totalRevenue) * 100 : 0}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 상품별 매출 */}
      {productList.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-4">
          <h3 className="text-sm font-semibold mb-3">상품별 매출</h3>
          <div className="space-y-2">
            {productList.map(([p, amt]) => (
              <div key={p} className="flex items-center gap-3">
                <span className="w-14 text-xs text-muted-foreground">{p}</span>
                <div className="flex-1 bg-background rounded-full h-2">
                  <div className="h-2 rounded-full bg-primary" style={{ width: `${totalRevenue > 0 ? (amt / totalRevenue) * 100 : 0}%` }} />
                </div>
                <span className={`text-xs font-medium w-20 text-right ${PCOL[p] ?? "text-foreground"}`}>{fmt(amt)}원</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 트레이너별 매출 */}
      {(trainerSum ?? []).length > 0 && (
        <div className="bg-card border border-border rounded-xl p-4">
          <h3 className="text-sm font-semibold mb-3">트레이너별 매출</h3>
          <div className="space-y-2">
            {(trainerSum ?? []).map(t => (
              <div key={t.trainerId} className="flex items-center justify-between text-xs">
                <span>{t.trainerName}</span>
                <div className="flex items-center gap-3 text-muted-foreground">
                  <span>PT {fmt(t.pt)} / 헬스 {fmt(t.health)}</span>
                  <span className="font-medium text-foreground">{fmt(t.total)}원</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── 월별 리포트 탭 ────────────────────────────────────────────────────────────
function MonthlyReportTab() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());

  const { data: monthlySummary } = trpc.gym.revenue.monthlySummary.useQuery({ year });
  const { data: allExpenses }    = trpc.gym.expenses.list.useQuery({ year } as any);

  const monthlyExpense: Record<number, number> = {};
  for (let m = 1; m <= 12; m++) monthlyExpense[m] = 0;
  for (const row of (allExpenses ?? [])) {
    const m = parseInt(row.entry.expenseDate.substring(5, 7));
    if (m >= 1 && m <= 12) monthlyExpense[m] += row.entry.amount;
  }

  const summary     = monthlySummary ?? [];
  const totalRevAll = summary.reduce((s, m) => s + m.paid, 0);
  const totalExpAll = Object.values(monthlyExpense).reduce((a, b) => a + b, 0);
  const totalProfit = totalRevAll - totalExpAll;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">월별 리포트</h1>
          <p className="text-xs text-muted-foreground">{year}년 매출·지출 현황</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setYear(y => y - 1)} className="text-muted-foreground hover:text-foreground"><ChevronLeft className="h-5 w-5" /></button>
          <span className="text-sm font-semibold w-12 text-center">{year}년</span>
          <button onClick={() => setYear(y => y + 1)} className="text-muted-foreground hover:text-foreground"><ChevronRight className="h-5 w-5" /></button>
        </div>
      </div>

      {/* 연간 요약 */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-card border border-border rounded-xl p-3 text-center">
          <div className="text-xs text-muted-foreground mb-1">연 총매출</div>
          <div className="text-sm font-bold text-emerald-400">{fmt(totalRevAll)}</div>
        </div>
        <div className="bg-card border border-border rounded-xl p-3 text-center">
          <div className="text-xs text-muted-foreground mb-1">연 총지출</div>
          <div className="text-sm font-bold text-red-400">{fmt(totalExpAll)}</div>
        </div>
        <div className={`bg-card border rounded-xl p-3 text-center ${totalProfit >= 0 ? "border-emerald-500/30" : "border-red-500/30"}`}>
          <div className="text-xs text-muted-foreground mb-1">연 순이익</div>
          <div className={`text-sm font-bold ${totalProfit >= 0 ? "text-emerald-400" : "text-red-400"}`}>{fmt(totalProfit)}</div>
        </div>
      </div>

      {/* 월별 테이블 */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-background/50">
                <th className="text-left px-3 py-2.5 text-muted-foreground font-medium">월</th>
                <th className="text-right px-3 py-2.5 text-muted-foreground font-medium">신규</th>
                <th className="text-right px-3 py-2.5 text-muted-foreground font-medium">재등록</th>
                <th className="text-right px-3 py-2.5 text-muted-foreground font-medium">총매출</th>
                <th className="text-right px-3 py-2.5 text-muted-foreground font-medium">지출</th>
                <th className="text-right px-3 py-2.5 text-muted-foreground font-medium">순이익</th>
              </tr>
            </thead>
            <tbody>
              {summary.map(m => {
                const exp    = monthlyExpense[m.month] ?? 0;
                const profit = m.paid - exp;
                const hasData = m.paid > 0 || exp > 0;
                const isCurrent = m.month === now.getMonth() + 1 && year === now.getFullYear();
                return (
                  <tr key={m.month} className={`border-b border-border/50 ${isCurrent ? "bg-primary/5" : ""}`}>
                    <td className="px-3 py-2.5 font-medium">{m.month}월</td>
                    <td className={`px-3 py-2.5 text-right ${hasData ? "text-blue-400" : "text-muted-foreground/30"}`}>
                      {m.newSales > 0 ? fmt(m.newSales) : "—"}
                    </td>
                    <td className={`px-3 py-2.5 text-right ${hasData ? "text-violet-400" : "text-muted-foreground/30"}`}>
                      {m.renewal > 0 ? fmt(m.renewal) : "—"}
                    </td>
                    <td className={`px-3 py-2.5 text-right font-medium ${hasData ? "text-emerald-400" : "text-muted-foreground/30"}`}>
                      {m.paid > 0 ? fmt(m.paid) : "—"}
                    </td>
                    <td className={`px-3 py-2.5 text-right ${exp > 0 ? "text-red-400" : "text-muted-foreground/30"}`}>
                      {exp > 0 ? fmt(exp) : "—"}
                    </td>
                    <td className={`px-3 py-2.5 text-right font-medium ${hasData ? (profit >= 0 ? "text-emerald-400" : "text-red-400") : "text-muted-foreground/30"}`}>
                      {hasData ? fmt(profit) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-border bg-background/50 font-bold">
                <td className="px-3 py-2.5">합계</td>
                <td className="px-3 py-2.5 text-right text-blue-400">{fmt(summary.reduce((s, m) => s + m.newSales, 0))}</td>
                <td className="px-3 py-2.5 text-right text-violet-400">{fmt(summary.reduce((s, m) => s + m.renewal, 0))}</td>
                <td className="px-3 py-2.5 text-right text-emerald-400">{fmt(totalRevAll)}</td>
                <td className="px-3 py-2.5 text-right text-red-400">{fmt(totalExpAll)}</td>
                <td className={`px-3 py-2.5 text-right ${totalProfit >= 0 ? "text-emerald-400" : "text-red-400"}`}>{fmt(totalProfit)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* PT / 헬스 월별 */}
      {summary.some(m => m.pt > 0 || m.health > 0) && (
        <div className="bg-card border border-border rounded-xl p-4">
          <h3 className="text-sm font-semibold mb-3">PT / 헬스 월별 추이</h3>
          <div className="space-y-1.5">
            {summary.filter(m => m.pt > 0 || m.health > 0).map(m => (
              <div key={m.month} className="flex items-center gap-2 text-xs">
                <span className="text-muted-foreground w-8">{m.month}월</span>
                <div className="flex gap-1.5">
                  {m.pt > 0 && <span className="px-2 py-0.5 rounded bg-blue-400/10 text-blue-400">PT {fmt(m.pt)}</span>}
                  {m.health > 0 && <span className="px-2 py-0.5 rounded bg-emerald-400/10 text-emerald-400">헬스 {fmt(m.health)}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
