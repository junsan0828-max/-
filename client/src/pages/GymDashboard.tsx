import { useState } from "react";
import { trpc } from "../lib/trpc";
import { useLocation } from "wouter";
import {
  TrendingUp, TrendingDown, DollarSign, Users, Target,
  AlertCircle, RefreshCw, ArrowUpRight, ArrowDownRight,
  BarChart2, Percent, CreditCard, ChevronLeft, ChevronRight, MapPin,
  X,
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts";

const COLORS = ["#6366f1", "#8b5cf6", "#a78bfa", "#c4b5fd", "#ddd6fe", "#ede9fe", "#f3f4f6"];

function fmt(n: number) {
  if (n >= 10000000) return `${(n / 10000000).toFixed(1)}천만`;
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}백만`;
  if (n >= 10000) return `${Math.round(n / 10000)}만`;
  return n.toLocaleString();
}

function KpiCard({
  label, value, sub, trend, icon: Icon, color = "text-primary", onClick,
}: {
  label: string; value: string; sub?: string; trend?: number; icon: React.ElementType; color?: string; onClick?: () => void;
}) {
  return (
    <div
      className={`bg-card border border-border rounded-xl p-4 flex flex-col gap-2 ${onClick ? "cursor-pointer hover:border-primary/50 transition-colors" : ""}`}
      onClick={onClick}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground font-medium">{label}</span>
        <Icon className={`h-4 w-4 ${color}`} />
      </div>
      <div className="text-xl font-bold text-foreground">{value}</div>
      <div className="flex items-center justify-between">
        {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
        {trend !== undefined && (
          <span className={`text-xs font-medium flex items-center gap-0.5 ${trend >= 0 ? "text-emerald-400" : "text-red-400"}`}>
            {trend >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
            {Math.abs(trend)}%
          </span>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
type ModalType = "today" | "month" | "new" | "renewal" | "pt" | "health" | "conversion" | "unpaid" | null;

function KpiDetailModal({ type, year, month, branchFilter, kpi, onClose }: {
  type: ModalType; year: number; month: number; branchFilter: number | null;
  kpi: any; onClose: () => void;
}) {
  const today = new Date().toISOString().split("T")[0];
  const { data: entries, isLoading: revenueLoading } = trpc.gym.revenue.list.useQuery({ year, month, ...(branchFilter ? { branchId: branchFilter } : {}) });
  const { data: leads, isLoading: leadsLoading } = trpc.gym.leads.list.useQuery();
  const { data: ptUnpaid, isLoading: unpaidLoading } = trpc.pt.listUnpaid.useQuery();

  if (!type) return null;

  const needsRevenue = ["today", "month", "new", "renewal", "pt", "health"].includes(type);
  const needsLeads = type === "conversion";
  const needsUnpaid = type === "unpaid";
  const isLoading =
    (needsRevenue && revenueLoading) ||
    (needsLeads && leadsLoading) ||
    (needsUnpaid && unpaidLoading);

  const prefix = `${year}-${String(month).padStart(2, "0")}`;

  const todayEntries = (entries ?? []).filter(r => r.entry.paymentDate === today);
  const monthEntries = entries ?? [];
  const newEntries = monthEntries.filter(r => r.entry.subType === "신규");
  const renewalEntries = monthEntries.filter(r => r.entry.subType === "재등록");
  const ptEntries = monthEntries.filter(r => r.entry.type === "PT");
  const healthEntries = monthEntries.filter(r => r.entry.type === "헬스");
  const monthLeads = (leads ?? []).filter(l => (l.lead.createdAt ?? "").startsWith(prefix));
  const registeredLeads = monthLeads.filter(l => l.lead.status === "registered");
  const unpaidList = (ptUnpaid ?? []).filter(p => (p.unpaidAmount ?? 0) > 0);

  // 전체 뷰일 때 지점명 추가 표시, 지점 자체가 없을 때만 경고
  function rowSub(r: typeof monthEntries[0], parts: string[]) {
    const extras: string[] = [];
    if (branchFilter === null) {
      extras.push(r.branchName ?? "⚠︎지점미배정");
    }
    if (r.trainerName) extras.push(r.trainerName);
    return [...parts, ...extras].filter(Boolean).join(" · ");
  }

  const configs: Record<NonNullable<ModalType>, { title: string; rows: { label: string; value: string; sub?: string; warn?: boolean }[]; detail?: React.ReactNode }> = {
    today: {
      title: "오늘 매출 내역",
      rows: todayEntries.map(r => ({
        label: r.memberName ?? r.entry.customerName ?? "-",
        value: `${(r.entry.amount ?? r.entry.paidAmount ?? 0).toLocaleString()}원`,
        sub: rowSub(r, [r.entry.type, r.entry.subType ?? ""]),
        warn: !r.entry.branchId,
      })),
      detail: todayEntries.length === 0 ? <p className="text-sm text-muted-foreground text-center py-6">오늘 매출 내역이 없습니다</p> : null,
    },
    month: {
      title: `${month}월 누적 매출 내역`,
      rows: monthEntries.map(r => ({
        label: r.memberName ?? r.entry.customerName ?? "-",
        value: `${(r.entry.amount ?? r.entry.paidAmount ?? 0).toLocaleString()}원`,
        sub: rowSub(r, [r.entry.paymentDate, r.entry.type, r.entry.subType ?? ""]),
        warn: !r.entry.branchId,
      })),
      detail: null,
    },
    new: {
      title: `${month}월 신규 매출`,
      rows: newEntries.map(r => ({
        label: r.memberName ?? r.entry.customerName ?? "-",
        value: `${(r.entry.amount ?? r.entry.paidAmount ?? 0).toLocaleString()}원`,
        sub: rowSub(r, [r.entry.paymentDate, r.entry.type]),
        warn: !r.entry.branchId,
      })),
      detail: null,
    },
    renewal: {
      title: `${month}월 재등록 매출`,
      rows: renewalEntries.map(r => ({
        label: r.memberName ?? r.entry.customerName ?? "-",
        value: `${(r.entry.amount ?? r.entry.paidAmount ?? 0).toLocaleString()}원`,
        sub: rowSub(r, [r.entry.paymentDate, r.entry.type]),
        warn: !r.entry.branchId,
      })),
      detail: null,
    },
    pt: {
      title: `${month}월 PT 매출`,
      rows: ptEntries.map(r => ({
        label: r.memberName ?? r.entry.customerName ?? "-",
        value: `${(r.entry.amount ?? r.entry.paidAmount ?? 0).toLocaleString()}원`,
        sub: rowSub(r, [r.entry.paymentDate, r.entry.subType ?? ""]),
        warn: !r.entry.branchId,
      })),
      detail: null,
    },
    health: {
      title: `${month}월 헬스 매출`,
      rows: healthEntries.map(r => ({
        label: r.memberName ?? r.entry.customerName ?? "-",
        value: `${(r.entry.amount ?? r.entry.paidAmount ?? 0).toLocaleString()}원`,
        sub: rowSub(r, [r.entry.paymentDate, r.entry.subType ?? ""]),
        warn: !r.entry.branchId,
      })),
      detail: null,
    },
    conversion: {
      title: `${month}월 전환율 상세`,
      rows: [
        { label: "총 상담", value: `${monthLeads.length}건` },
        { label: "등록 전환", value: `${registeredLeads.length}건` },
        { label: "전환율", value: `${monthLeads.length > 0 ? Math.round((registeredLeads.length / monthLeads.length) * 100) : 0}%` },
      ],
      detail: (
        <div className="mt-4 space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">이번달 상담 목록</p>
          {monthLeads.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">상담 내역이 없습니다</p>
          ) : monthLeads.map((l, i) => (
            <div key={i} className="flex justify-between items-center text-sm py-1.5 border-b border-border/50">
              <div>
                <span className="font-medium">{l.lead.name}</span>
                {l.channelName && <span className="text-muted-foreground ml-2 text-xs">{l.channelName}</span>}
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                l.lead.status === "registered" ? "bg-green-500/20 text-green-400"
                : l.lead.status === "consulting" ? "bg-blue-500/20 text-blue-400"
                : "bg-muted text-muted-foreground"
              }`}>
                {l.lead.status === "registered" ? "등록" : l.lead.status === "consulting" ? "상담중" : l.lead.status === "followup" ? "팔로업" : l.lead.status}
              </span>
            </div>
          ))}
        </div>
      ),
    },
    unpaid: {
      title: "미수금 내역",
      rows: unpaidList.map(p => ({
        label: p.memberName ?? "-",
        value: `${(p.unpaidAmount ?? 0).toLocaleString()}원`,
        sub: `${p.packageName ?? "PT"} · ${p.trainerName ?? ""}`,
      })),
      detail: unpaidList.length === 0 ? <p className="text-sm text-muted-foreground text-center py-6">미수금이 없습니다</p> : null,
    },
  };

  const cfg = configs[type];
  const total = cfg.rows.reduce((s, r) => {
    const n = parseInt(r.value.replace(/[^0-9]/g, ""));
    return isNaN(n) ? s : s + n;
  }, 0);
  const showTotal = ["today", "month", "new", "renewal", "pt", "health", "unpaid"].includes(type);

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card border border-border rounded-2xl w-full max-w-lg max-h-[80vh] flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="font-bold text-base">{cfg.title}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
        </div>
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-1">
          {isLoading ? (
            <p className="text-sm text-muted-foreground text-center py-8">불러오는 중...</p>
          ) : (
            <>
              {cfg.rows.length > 0 && cfg.rows.map((row, i) => (
                <div key={i} className={`flex justify-between items-start py-2 border-b border-border/40 ${(row as any).warn ? "bg-orange-500/5 rounded-lg px-2 -mx-2" : ""}`}>
                  <div className="min-w-0 flex-1 pr-3">
                    <p className="text-sm font-medium truncate">{row.label}</p>
                    {row.sub && <p className={`text-xs mt-0.5 ${(row as any).warn ? "text-orange-400" : "text-muted-foreground"}`}>{row.sub}</p>}
                  </div>
                  <p className="text-sm font-semibold text-foreground shrink-0">{row.value}</p>
                </div>
              ))}
              {cfg.rows.length === 0 && !cfg.detail && (
                <p className="text-sm text-muted-foreground text-center py-8">내역이 없습니다</p>
              )}
              {cfg.detail}
            </>
          )}
        </div>
        {!isLoading && showTotal && cfg.rows.length > 0 && (
          <div className="px-5 py-3 border-t border-border flex justify-between items-center">
            <span className="text-sm font-semibold text-muted-foreground">합계</span>
            <span className="text-base font-bold text-primary">{total.toLocaleString()}원</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function GymDashboard() {
  const [, setLocation] = useLocation();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [branchFilter, setBranchFilter] = useState<number | null>(null);
  const [modal, setModal] = useState<ModalType>(null);

  const { data: branchList } = trpc.gym.staff.listBranches.useQuery();
  const { data: kpi, isLoading } = trpc.gym.kpi.overview.useQuery(
    { year, month, ...(branchFilter ? { branchId: branchFilter } : {}) }
  );
  const { data: monthly } = trpc.gym.revenue.monthlySummary.useQuery({ year, ...(branchFilter ? { branchId: branchFilter } : {}) });
  const { data: trainerSummary } = trpc.gym.revenue.trainerSummary.useQuery({ year, month, ...(branchFilter ? { branchId: branchFilter } : {}) });
  const { data: channelSummary } = trpc.gym.revenue.channelSummary.useQuery({ year, month, ...(branchFilter ? { branchId: branchFilter } : {}) });
  const { data: expenseSummary } = trpc.gym.expenses.categorySummary.useQuery({ year, month, ...(branchFilter ? { branchId: branchFilter } : {}) });

  function prevMonth() {
    if (month === 1) { setYear(y => y - 1); setMonth(12); }
    else setMonth(m => m - 1);
  }
  function nextMonth() {
    if (month === 12) { setYear(y => y + 1); setMonth(1); }
    else setMonth(m => m + 1);
  }

  if (isLoading) {
    return <div className="flex items-center justify-center h-40 text-muted-foreground">로딩 중...</div>;
  }

  const monthlyChartData = (monthly ?? []).map(m => ({
    name: `${m.month}월`,
    매출: m.paid,
    신규: m.newSales,
    재등록: m.renewal,
  }));

  const typeChartData = [
    { name: "PT", value: kpi?.monthPT ?? 0 },
    { name: "헬스", value: kpi?.monthHealth ?? 0 },
    { name: "기타", value: Math.max(0, (kpi?.monthTotal ?? 0) - (kpi?.monthPT ?? 0) - (kpi?.monthHealth ?? 0)) },
  ].filter(d => d.value > 0);

  return (
    <div className="space-y-5">
      {/* 헤더 */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-foreground">KPI 대시보드</h1>
          <div className="flex items-center gap-2 bg-card border border-border rounded-lg px-3 py-1.5">
            <button onClick={prevMonth} className="text-muted-foreground hover:text-foreground">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm font-medium text-foreground min-w-[80px] text-center">{year}년 {month}월</span>
            <button onClick={nextMonth} className="text-muted-foreground hover:text-foreground">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
      {branchList && branchList.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setBranchFilter(null)}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${branchFilter === null ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:text-foreground"}`}>
            <MapPin className="h-3 w-3" /> 전체
          </button>
          {branchList.map((b) => (
            <button key={b.id} onClick={() => setBranchFilter(b.id)}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${branchFilter === b.id ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:text-foreground"}`}>
              <MapPin className="h-3 w-3" /> {b.name}
            </button>
          ))}
        </div>
      )}

      {/* 목표 달성률 배너 */}
      {(kpi?.targetAmount ?? 0) > 0 && (
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-foreground">월 목표 달성률</span>
            <span className="text-sm font-bold text-primary">{kpi?.achieveRate}%</span>
          </div>
          <div className="w-full bg-muted rounded-full h-2.5">
            <div
              className={`h-2.5 rounded-full transition-all ${(kpi?.achieveRate ?? 0) >= 100 ? "bg-emerald-500" : "bg-primary"}`}
              style={{ width: `${Math.min(kpi?.achieveRate ?? 0, 100)}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground mt-1.5">
            <span>현재 {fmt(kpi?.monthTotal ?? 0)}원</span>
            <span>목표 {fmt(kpi?.targetAmount ?? 0)}원</span>
          </div>
        </div>
      )}

      {/* KPI 카드 그리드 */}
      <div className="grid grid-cols-2 gap-3">
        <KpiCard
          label="오늘 매출"
          value={`${fmt(kpi?.todayRevenue ?? 0)}원`}
          icon={DollarSign}
          color="text-emerald-400"
          onClick={() => setModal("today")}
        />
        <KpiCard
          label="이번달 누적"
          value={`${fmt(kpi?.monthTotal ?? 0)}원`}
          trend={kpi?.momGrowth}
          icon={TrendingUp}
          color="text-primary"
          onClick={() => setModal("month")}
        />
        <KpiCard
          label="신규 매출"
          value={`${fmt(kpi?.monthNewSales ?? 0)}원`}
          sub={`전체의 ${kpi?.monthTotal ? Math.round((kpi.monthNewSales / kpi.monthTotal) * 100) : 0}%`}
          icon={Users}
          color="text-blue-400"
          onClick={() => setModal("new")}
        />
        <KpiCard
          label="재등록 매출"
          value={`${fmt(kpi?.monthRenewal ?? 0)}원`}
          sub={`재등록률 ${kpi?.renewalRate}%`}
          icon={RefreshCw}
          color="text-violet-400"
          onClick={() => setModal("renewal")}
        />
        <KpiCard
          label="PT 매출"
          value={`${fmt(kpi?.monthPT ?? 0)}원`}
          icon={BarChart2}
          color="text-amber-400"
          onClick={() => setModal("pt")}
        />
        <KpiCard
          label="헬스 매출"
          value={`${fmt(kpi?.monthHealth ?? 0)}원`}
          icon={Target}
          color="text-teal-400"
          onClick={() => setModal("health")}
        />
        <KpiCard
          label="전환율"
          value={`${kpi?.conversionRate ?? 0}%`}
          sub="상담→등록"
          icon={Percent}
          color="text-sky-400"
          onClick={() => setModal("conversion")}
        />
        <KpiCard
          label="미수금"
          value={`${fmt(kpi?.totalUnpaid ?? 0)}원`}
          icon={AlertCircle}
          color={(kpi?.totalUnpaid ?? 0) > 0 ? "text-red-400" : "text-muted-foreground"}
          onClick={() => setModal("unpaid")}
        />
      </div>

      {/* 수익 요약 */}
      <div className="bg-card border border-border rounded-xl p-4 space-y-3">
        <h2 className="text-sm font-semibold text-foreground">이번달 손익</h2>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">총 매출</span>
            <span className="font-medium text-emerald-400">+{fmt(kpi?.monthTotal ?? 0)}원</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">총 지출</span>
            <span className="font-medium text-red-400">-{fmt(kpi?.monthExpenses ?? 0)}원</span>
          </div>
          {(kpi?.monthRefund ?? 0) > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">환불</span>
              <span className="font-medium text-orange-400">-{fmt(kpi?.monthRefund ?? 0)}원</span>
            </div>
          )}
          <div className="pt-2 border-t border-border flex justify-between text-sm font-bold">
            <span className="text-foreground">순이익</span>
            <span className={(kpi?.monthProfit ?? 0) >= 0 ? "text-emerald-400" : "text-red-400"}>
              {(kpi?.monthProfit ?? 0) >= 0 ? "+" : ""}{fmt(kpi?.monthProfit ?? 0)}원
            </span>
          </div>
        </div>
      </div>

      {/* 월별 추이 차트 */}
      {monthlyChartData.some(d => d.매출 > 0) && (
        <div className="bg-card border border-border rounded-xl p-4">
          <h2 className="text-sm font-semibold text-foreground mb-4">{year}년 월별 매출 추이</h2>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={monthlyChartData}>
              <defs>
                <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#9ca3af" }} />
              <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} tickFormatter={v => `${Math.round(v / 10000)}만`} />
              <Tooltip formatter={(v) => [`${Number(v).toLocaleString()}원`, ""]} contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #374151", borderRadius: "8px", fontSize: "12px" }} />
              <Area type="monotone" dataKey="매출" stroke="#6366f1" fill="url(#salesGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* 매출 구성 (신규/재등록) */}
      {monthlyChartData.some(d => d.신규 > 0 || d.재등록 > 0) && (
        <div className="bg-card border border-border rounded-xl p-4">
          <h2 className="text-sm font-semibold text-foreground mb-4">신규 vs 재등록</h2>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={monthlyChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#9ca3af" }} />
              <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} tickFormatter={v => `${Math.round(v / 10000)}만`} />
              <Tooltip formatter={(v) => [`${Number(v).toLocaleString()}원`, ""]} contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #374151", borderRadius: "8px", fontSize: "12px" }} />
              <Bar dataKey="신규" fill="#6366f1" radius={[2, 2, 0, 0]} />
              <Bar dataKey="재등록" fill="#8b5cf6" radius={[2, 2, 0, 0]} />
              <Legend wrapperStyle={{ fontSize: "12px" }} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* PT/헬스 구성 */}
      {typeChartData.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-4">
          <h2 className="text-sm font-semibold text-foreground mb-4">매출 유형 구성</h2>
          <div className="flex items-center gap-4">
            <ResponsiveContainer width={130} height={130}>
              <PieChart>
                <Pie data={typeChartData} cx="50%" cy="50%" innerRadius={35} outerRadius={55} dataKey="value">
                  {typeChartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="flex-1 space-y-2">
              {typeChartData.map((d, i) => (
                <div key={d.name} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                    <span className="text-muted-foreground">{d.name}</span>
                  </div>
                  <span className="font-medium text-foreground">{fmt(d.value)}원</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 트레이너별 매출 */}
      {(trainerSummary ?? []).length > 0 && (
        <div className="bg-card border border-border rounded-xl p-4">
          <h2 className="text-sm font-semibold text-foreground mb-3">트레이너별 매출</h2>
          <div className="space-y-2">
            {(trainerSummary ?? []).map((t, i) => {
              const maxTotal = trainerSummary?.[0]?.total ?? 1;
              return (
                <div key={i} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-foreground font-medium">{t.trainerName}</span>
                    <span className="text-muted-foreground">{fmt(t.total)}원 ({t.count}건)</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-1.5">
                    <div className="h-1.5 rounded-full bg-primary" style={{ width: `${(t.total / maxTotal) * 100}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 채널별 매출 */}
      {(channelSummary ?? []).length > 0 && (
        <div className="bg-card border border-border rounded-xl p-4">
          <h2 className="text-sm font-semibold text-foreground mb-3">채널별 매출</h2>
          <div className="space-y-2">
            {(channelSummary ?? []).map((c, i) => {
              const maxTotal = channelSummary?.[0]?.total ?? 1;
              return (
                <div key={i} className="flex items-center gap-3 text-xs">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                  <span className="text-foreground flex-1">{c.channelName}</span>
                  <div className="w-20 bg-muted rounded-full h-1.5 mx-2">
                    <div className="h-1.5 rounded-full" style={{ width: `${(c.total / maxTotal) * 100}%`, backgroundColor: COLORS[i % COLORS.length] }} />
                  </div>
                  <span className="text-muted-foreground">{fmt(c.total)}원</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 지출 구성 */}
      {(expenseSummary ?? []).length > 0 && (
        <div className="bg-card border border-border rounded-xl p-4">
          <h2 className="text-sm font-semibold text-foreground mb-3">지출 구성</h2>
          <div className="space-y-2">
            {(expenseSummary ?? []).map((e, i) => (
              <div key={e.category} className="flex justify-between text-xs">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                  <span className="text-muted-foreground">{e.category}</span>
                </div>
                <span className="font-medium text-foreground">{fmt(e.total)}원</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 빠른 링크 */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: "매출 입력", path: "/revenue", color: "bg-primary/10 text-primary border-primary/20" },
          { label: "지출 입력", path: "/expenses", color: "bg-violet-500/10 text-violet-400 border-violet-500/20" },
          { label: "리드 관리", path: "/leads", color: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
          { label: "AI 분석", path: "/ai-analysis", color: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
        ].map(item => (
          <button
            key={item.path}
            onClick={() => {
              if (item.path === "/revenue" && branchFilter) {
                sessionStorage.setItem("revenue_default_branch", String(branchFilter));
              }
              setLocation(item.path);
            }}
            className={`border rounded-xl py-3 text-sm font-medium transition-colors hover:opacity-80 ${item.color}`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* KPI 카드 상세 모달 */}
      {modal && (
        <KpiDetailModal
          type={modal}
          year={year}
          month={month}
          branchFilter={branchFilter}
          kpi={kpi}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
