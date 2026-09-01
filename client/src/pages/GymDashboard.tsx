import { useState } from "react";
import { trpc } from "../lib/trpc";
import { useLocation } from "wouter";
import { GymPlusRenewalsAdmin } from "./gym-plus/GymPlusAdmin";
import {
  TrendingUp, TrendingDown, DollarSign, Users, Target,
  AlertCircle, RefreshCw, ArrowUpRight, ArrowDownRight,
  BarChart2, Percent, CreditCard, ChevronLeft, ChevronRight, ChevronDown, MapPin,
  X, Bell,
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
  ComposedChart, Line,
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
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const { data: entries, isLoading: revenueLoading } = trpc.gym.revenue.list.useQuery({ year, month, ...(branchFilter ? { branchId: branchFilter } : {}) });
  const { data: leads, isLoading: leadsLoading } = trpc.gym.leads.list.useQuery();
  const { data: unpaidRows, isLoading: unpaidLoading } = trpc.gym.kpi.unpaidList.useQuery(branchFilter ? { branchId: branchFilter } : undefined);

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
  const refundEntries = monthEntries.filter(r => r.entry.subType === "환불");
  const monthLeads = (leads ?? []).filter(l => (l.lead.createdAt ?? "").startsWith(prefix));
  const registeredLeads = monthLeads.filter(l => l.lead.status === "registered");
  const unpaidList = (unpaidRows ?? []).filter(p => (p.unpaidAmount ?? 0) > 0);

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
        value: `${(r.entry.paidAmount ?? 0).toLocaleString()}원`,
        sub: rowSub(r, [r.entry.type, r.entry.subType ?? ""]),
        warn: !r.entry.branchId,
      })),
      detail: todayEntries.length === 0 ? <p className="text-sm text-muted-foreground text-center py-6">오늘 매출 내역이 없습니다</p> : null,
    },
    month: {
      title: `${month}월 누적 매출 내역`,
      rows: monthEntries.filter(r => r.entry.subType !== "환불").map(r => ({
        label: r.memberName ?? r.entry.customerName ?? "-",
        value: `${(r.entry.paidAmount ?? 0).toLocaleString()}원`,
        sub: rowSub(r, [r.entry.paymentDate, r.entry.type, r.entry.subType ?? ""]),
        warn: !r.entry.branchId,
      })),
      detail: refundEntries.length > 0 ? (
        <div className="mt-4 space-y-2">
          <p className="text-xs font-semibold text-orange-400 uppercase tracking-wide">환불 내역 ({refundEntries.length}건)</p>
          {refundEntries.map((r, i) => (
            <div key={i} className="flex justify-between items-center text-sm py-1.5 border-b border-border/50">
              <div>
                <span className="font-medium">{r.memberName ?? r.entry.customerName ?? "-"}</span>
                <span className="text-muted-foreground ml-2 text-xs">{r.entry.paymentDate} · {r.entry.programDetail ?? r.entry.type}</span>
              </div>
              <span className="font-medium text-orange-400">{(r.entry.paidAmount ?? 0).toLocaleString()}원</span>
            </div>
          ))}
          <div className="flex justify-between text-sm font-bold pt-1">
            <span className="text-muted-foreground">환불 합계</span>
            <span className="text-orange-400">{refundEntries.reduce((s, r) => s + (r.entry.paidAmount ?? 0), 0).toLocaleString()}원</span>
          </div>
        </div>
      ) : null,
    },
    new: {
      title: `${month}월 신규 매출`,
      rows: newEntries.map(r => ({
        label: r.memberName ?? r.entry.customerName ?? "-",
        value: `${(r.entry.paidAmount ?? 0).toLocaleString()}원`,
        sub: rowSub(r, [r.entry.paymentDate, r.entry.type]),
        warn: !r.entry.branchId,
      })),
      detail: null,
    },
    renewal: {
      title: `${month}월 재등록 매출`,
      rows: renewalEntries.map(r => ({
        label: r.memberName ?? r.entry.customerName ?? "-",
        value: `${(r.entry.paidAmount ?? 0).toLocaleString()}원`,
        sub: rowSub(r, [r.entry.paymentDate, r.entry.type]),
        warn: !r.entry.branchId,
      })),
      detail: null,
    },
    pt: {
      title: `${month}월 PT 매출`,
      rows: ptEntries.map(r => ({
        label: r.memberName ?? r.entry.customerName ?? "-",
        value: `${(r.entry.paidAmount ?? 0).toLocaleString()}원`,
        sub: rowSub(r, [r.entry.paymentDate, r.entry.subType ?? ""]),
        warn: !r.entry.branchId,
      })),
      detail: null,
    },
    health: {
      title: `${month}월 헬스 매출`,
      rows: healthEntries.map(r => ({
        label: r.memberName ?? r.entry.customerName ?? "-",
        value: `${(r.entry.paidAmount ?? 0).toLocaleString()}원`,
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
        label: p.memberName ?? p.customerName ?? "-",
        value: `${(p.unpaidAmount ?? 0).toLocaleString()}원`,
        sub: [p.type, p.programDetail, p.trainerName, p.paymentDate].filter(Boolean).join(" · "),
      })),
      detail: unpaidList.length === 0 ? <p className="text-sm text-muted-foreground text-center py-6">미수금이 없습니다</p> : null,
    },
  };

  const cfg = configs[type];
  const total = cfg.rows.reduce((s, r) => {
    const n = parseInt(r.value.replace(/[^0-9-]/g, ""));
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
  type TrainerItem = { revenueId: number; memberId: number | null; name: string; date: string; amount: number; type: string; subType: string };
  const [trainerModal, setTrainerModal] = useState<{ name: string; isUnassigned: boolean; items: TrainerItem[] } | null>(null);

  const [dismissedBookingAlert, setDismissedBookingAlert] = useState(false);
  const [showAnomalies, setShowAnomalies] = useState(false);
  const { data: anomalyData } = trpc.admin.pricingAnomalies.useQuery();
  const { data: branchList } = trpc.gym.staff.listBranches.useQuery();
  const { data: kpi, isLoading } = trpc.gym.kpi.overview.useQuery(
    { year, month, ...(branchFilter ? { branchId: branchFilter } : {}) }
  );
  const { data: unviewedCount = 0 } = trpc.gym.leads.unviewedCount.useQuery(undefined, {
    refetchInterval: 30000,
  });
  const { data: pointExt } = trpc.gym.kpi.pointExtensionSummary.useQuery({ year, month });
  const { data: me } = trpc.auth.me.useQuery();
  // 트레이너도 본인 담당 회원의 재등록 신청을 보고 처리한다(서버에서 담당 건만 걸러 내려줌).
  const { data: pendingRenewals } = trpc.gymPlus.admin_listRenewals.useQuery(
    { status: "pending" },
    { refetchInterval: 30000, enabled: !!me }
  );
  const [dismissedRenewalAlert, setDismissedRenewalAlert] = useState(false);
  const [renewalModalOpen, setRenewalModalOpen] = useState(false);
  const { data: monthly } = trpc.gym.revenue.monthlySummary.useQuery({ year, ...(branchFilter ? { branchId: branchFilter } : {}) });
  const { data: staffSummary, refetch: refetchStaff } = trpc.gym.revenue.staffSummary.useQuery({ year, month, ...(branchFilter ? { branchId: branchFilter } : {}) });
  const { data: trainerList } = trpc.trainers.list.useQuery();
  const assignTrainerMutation = trpc.admin.assignTrainerToRevenue.useMutation({
    onSuccess: () => { refetchStaff(); },
  });
  const { data: channelSummary } = trpc.gym.revenue.channelSummary.useQuery({ year, month, ...(branchFilter ? { branchId: branchFilter } : {}) });
  const { data: expenseSummary } = trpc.gym.expenses.categorySummary.useQuery({ year, month, ...(branchFilter ? { branchId: branchFilter } : {}) });
  const { data: memberTrend } = trpc.gym.kpi.memberTrend.useQuery({ months: 6, ...(branchFilter ? { branchId: branchFilter } : {}) });

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
      {/* 앱 재등록 신청 알림 배너 — 별도 로그인 없이 그 자리에서 모달로 바로 처리 */}
      {(pendingRenewals?.length ?? 0) > 0 && !dismissedRenewalAlert && (
        <div
          className="flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-4 py-3 cursor-pointer"
          onClick={() => setRenewalModalOpen(true)}
        >
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-emerald-500/20 shrink-0">
            <RefreshCw className="h-4 w-4 text-emerald-400 animate-pulse" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-emerald-300">앱 재등록 신청 {pendingRenewals!.length}건</p>
            <p className="text-xs text-emerald-400/70">회원앱에서 들어온 재등록 신청이 처리 대기 중입니다. 탭하여 처리하세요.</p>
          </div>
          <button
            onClick={e => { e.stopPropagation(); setDismissedRenewalAlert(true); }}
            className="text-emerald-400/50 hover:text-emerald-300 shrink-0"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* 온라인 예약 알림 배너 */}
      {unviewedCount > 0 && !dismissedBookingAlert && (
        <div
          className="flex items-center gap-3 bg-blue-500/10 border border-blue-500/30 rounded-xl px-4 py-3 cursor-pointer"
          onClick={() => { setDismissedBookingAlert(true); setLocation("/leads"); }}
        >
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-500/20 shrink-0">
            <Bell className="h-4 w-4 text-blue-400 animate-pulse" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-blue-300">새 온라인 예약 {unviewedCount}건</p>
            <p className="text-xs text-blue-400/70">미확인 체형분석 예약이 있습니다. 탭하여 확인하세요.</p>
          </div>
          <button
            onClick={e => { e.stopPropagation(); setDismissedBookingAlert(true); }}
            className="text-blue-400/50 hover:text-blue-300 shrink-0"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

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

      {/* 정산 단가·장부 불일치 경보 */}
      {((anomalyData?.anomalies?.length ?? 0) > 0 || (anomalyData?.revenueMismatches?.length ?? 0) > 0) && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
          <button type="button" onClick={() => setShowAnomalies(v => !v)} className="w-full flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-400" />
              <span className="text-sm font-semibold text-red-400">
                데이터 이상 항목 {(anomalyData?.anomalies?.length ?? 0) + (anomalyData?.revenueMismatches?.length ?? 0)}건
                <span className="font-normal text-red-300/70 ml-1.5">
                  {[
                    (anomalyData?.anomalies?.length ?? 0) > 0 ? `정산단가 ${anomalyData!.anomalies.length}` : null,
                    (anomalyData?.revenueMismatches?.length ?? 0) > 0 ? `장부불일치 ${anomalyData!.revenueMismatches.length}` : null,
                  ].filter(Boolean).join(" · ")}
                </span>
              </span>
            </div>
            <ChevronDown className={`h-4 w-4 text-red-400 transition-transform ${showAnomalies ? "rotate-180" : ""}`} />
          </button>
          {showAnomalies && (
            <div className="mt-3 space-y-3">
              {anomalyData!.anomalies.map((a) => (
                <button
                  type="button"
                  key={`pkg-${a.id}`}
                  onClick={() => setLocation(`/registration?q=${encodeURIComponent(a.memberName ?? "")}`)}
                  className="w-full text-left text-xs border-t border-red-500/20 pt-2 hover:bg-red-500/5 rounded-b-md -mx-1 px-1 transition-colors"
                >
                  <div className="flex justify-between items-baseline">
                    <span className="font-medium text-foreground underline decoration-red-400/40 underline-offset-2">{a.memberName ?? "회원 미상"} · {a.trainerName ?? "담당 미배정"}</span>
                    <span className="text-muted-foreground">{a.packageName ?? "-"} · {a.totalSessions}회</span>
                  </div>
                  {a.reasons.map((r, i) => (
                    <p key={i} className="text-red-300 mt-0.5">⚠ {r}</p>
                  ))}
                  <p className="text-[11px] text-primary mt-0.5">→ 눌러서 등록관리에서 수정</p>
                </button>
              ))}
              {(anomalyData?.revenueMismatches ?? []).map((m) => (
                <button
                  type="button"
                  key={`rev-${m.id}`}
                  onClick={() => setLocation(`/registration?q=${encodeURIComponent(m.customerName ?? "")}`)}
                  className="w-full text-left text-xs border-t border-red-500/20 pt-2 hover:bg-red-500/5 rounded-b-md -mx-1 px-1 transition-colors"
                >
                  <div className="flex justify-between items-baseline">
                    <span className="font-medium text-foreground underline decoration-red-400/40 underline-offset-2">{m.customerName ?? "고객 미상"} · {m.type}</span>
                    <span className="text-muted-foreground">{m.paymentDate ?? "-"}</span>
                  </div>
                  {m.unpaid > m.amount ? (
                    <p className="text-red-300 mt-0.5">
                      ⚠ 미수금 {m.unpaid.toLocaleString()}원이 정가 {m.amount.toLocaleString()}원보다 큼 (데이터 오류)
                    </p>
                  ) : (
                    <p className="text-red-300 mt-0.5">
                      ⚠ 받을 금액 {(m.amount - m.discount - m.unpaid).toLocaleString()}원(정가 {m.amount.toLocaleString()} − 할인 {m.discount.toLocaleString()} − 미수 {m.unpaid.toLocaleString()})인데 실결제가 {m.paid.toLocaleString()}원으로 적게 기록됨
                    </p>
                  )}
                  <p className="text-[11px] text-primary mt-0.5">→ 눌러서 등록관리에서 수정</p>
                </button>
              ))}
              <p className="text-[11px] text-muted-foreground pt-1">자동 수정하지 않습니다 — 확인 후 직접 수정해주세요.</p>
            </div>
          )}
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
          sub={(kpi?.monthRefund ?? 0) > 0 ? `환불 -${fmt(kpi!.monthRefund)}원 반영` : undefined}
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
          {(pointExt?.count ?? 0) > 0 && (
            <div className="pt-2 border-t border-border flex justify-between text-xs">
              <span className="text-muted-foreground">포인트 회원권 연장 <span className="text-[10px]">(매출 외 무상 제공)</span></span>
              <span className="font-medium text-amber-400">{pointExt!.count}건 · {pointExt!.totalDays}일</span>
            </div>
          )}
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

      {/* 회원 운영 트렌드 (활성회원 + 재등록률) */}
      {(memberTrend ?? []).some(d => d.active > 0 || d.new > 0 || d.expired > 0) && (
        <div className="bg-card border border-border rounded-xl p-4">
          <h2 className="text-sm font-semibold text-foreground mb-1">회원 운영 트렌드</h2>
          <p className="text-xs text-muted-foreground mb-4">활성 회원 수 · 재등록률 (최근 6개월)</p>
          <ResponsiveContainer width="100%" height={200}>
            <ComposedChart data={memberTrend}>
              <defs>
                <linearGradient id="memberGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#9ca3af" }} />
              <YAxis yAxisId="left" tick={{ fontSize: 10, fill: "#9ca3af" }} tickFormatter={v => `${v}명`} />
              <YAxis yAxisId="right" orientation="right" domain={[0, 100]} tick={{ fontSize: 10, fill: "#9ca3af" }} tickFormatter={v => `${v}%`} />
              <Tooltip
                formatter={(v, name) => name === "재등록률" ? [`${v}%`, name] : [`${Number(v).toLocaleString()}명`, name]}
                contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #374151", borderRadius: "8px", fontSize: "12px" }}
              />
              <Legend wrapperStyle={{ fontSize: "12px" }} />
              <Area yAxisId="left" type="monotone" dataKey="active" name="활성회원" stroke="#6366f1" fill="url(#memberGrad)" strokeWidth={2} />
              <Line yAxisId="right" type="monotone" dataKey="renewalRate" name="재등록률" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* 신규 vs 만료(이탈) 회원 수 */}
      {(memberTrend ?? []).some(d => d.new > 0 || d.expired > 0) && (
        <div className="bg-card border border-border rounded-xl p-4">
          <h2 className="text-sm font-semibold text-foreground mb-1">신규 vs 만료 회원</h2>
          <p className="text-xs text-muted-foreground mb-4">월별 순증감 (최근 6개월)</p>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={memberTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#9ca3af" }} />
              <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} tickFormatter={v => `${v}명`} />
              <Tooltip formatter={(v, name) => [`${Number(v).toLocaleString()}명`, name]} contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #374151", borderRadius: "8px", fontSize: "12px" }} />
              <Bar dataKey="new" name="신규" fill="#6366f1" radius={[2, 2, 0, 0]} />
              <Bar dataKey="expired" name="만료" fill="#ef4444" radius={[2, 2, 0, 0]} />
              <Legend wrapperStyle={{ fontSize: "12px" }} />
            </BarChart>
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

      {/* 트레이너 매출 상세 모달 */}
      {trainerModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setTrainerModal(null)}>
          <div className="bg-card border border-border rounded-xl w-full max-w-sm max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <h3 className="text-sm font-semibold text-foreground">
                {trainerModal.isUnassigned ? "미배정 매출" : `${trainerModal.name} — ${month}월 트레이너 매출`}
              </h3>
              <button onClick={() => setTrainerModal(null)} className="text-muted-foreground hover:text-foreground text-lg leading-none">×</button>
            </div>
            <div className="overflow-y-auto flex-1 divide-y divide-border">
              {[...trainerModal.items].sort((a, b) => a.date.localeCompare(b.date)).map((item, idx) => {
                const typeColor = item.subType === "재등록" ? "text-violet-400" : item.type === "PT" ? "text-blue-400" : item.type === "헬스" ? "text-amber-400" : "text-muted-foreground";
                const typeLabel = item.type === "PT" ? `PT ${item.subType || ""}`.trim() : item.type || item.subType || "기타";
                return (
                  <div key={idx} className="px-4 py-2.5 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-foreground font-medium">{item.name}</p>
                        <p className="text-xs text-muted-foreground">{item.date} · <span className={typeColor}>{typeLabel}</span></p>
                      </div>
                      <span className={`text-sm font-semibold ${typeColor}`}>{item.amount.toLocaleString()}원</span>
                    </div>
                    {trainerModal.isUnassigned && (
                      <select
                        defaultValue=""
                        onChange={e => {
                          const tid = parseInt(e.target.value);
                          if (!tid) return;
                          assignTrainerMutation.mutate({ revenueId: item.revenueId, trainerId: tid });
                          setTrainerModal(prev => prev ? { ...prev, items: prev.items.filter(x => x.revenueId !== item.revenueId) } : null);
                        }}
                        className="w-full text-xs bg-muted border border-border rounded-lg px-2 py-1.5 text-foreground focus:outline-none"
                      >
                        <option value="">트레이너 배정하기...</option>
                        {(trainerList ?? []).map((t: any) => (
                          <option key={t.id} value={String(t.userId ?? t.id)}>{t.trainerName}</option>
                        ))}
                      </select>
                    )}
                  </div>
                );
              })}
              {trainerModal.items.length === 0 && (
                <p className="text-center text-sm text-muted-foreground py-8">모두 배정 완료됐습니다</p>
              )}
            </div>
            <div className="px-4 py-3 border-t border-border flex justify-between">
              <span className="text-sm text-muted-foreground">총 {trainerModal.items.length}건</span>
              <span className="text-sm font-bold text-foreground">{trainerModal.items.reduce((s, x) => s + x.amount, 0).toLocaleString()}원</span>
            </div>
          </div>
        </div>
      )}

      {/* 직원별 성과 (상담 + 트레이너 통합) */}
      {(staffSummary ?? []).length > 0 && (() => {
        const cTotal = (s: any) => s.consultNew + s.consultHealth + s.consultEtc;
        const tTotal = (s: any) => s.trainerPtRenewal + s.trainerPtNew + s.trainerHealth + s.trainerEtc;
        const maxBar = Math.max(...(staffSummary ?? []).map((s: any) => tTotal(s)), 1);
        return (
          <div className="bg-card border border-border rounded-xl p-4">
            <h2 className="text-sm font-semibold text-foreground mb-3">직원별 성과</h2>
            <div className="space-y-4">
              {(staffSummary ?? []).map((s: any, i: number) => (
                <div key={i} className="pb-3 border-b border-border last:border-0 last:pb-0 space-y-2">
                  {/* 이름 + 트레이너 매출 합계 (클릭 시 상세 모달) */}
                  <button
                    className="w-full flex justify-between items-center hover:opacity-80 transition-opacity"
                    onClick={() => s.trainerItems?.length > 0 && setTrainerModal({ name: s.name, isUnassigned: false, items: s.trainerItems })}
                  >
                    <span className="text-sm font-bold text-foreground">{s.name}</span>
                    <span className="text-sm font-semibold text-foreground">{fmt(tTotal(s))}원</span>
                  </button>
                  {/* 트레이너 매출 바 */}
                  <div className="w-full bg-muted rounded-full h-1.5">
                    <div className="h-1.5 rounded-full bg-primary" style={{ width: `${Math.min((tTotal(s) / maxBar) * 100, 100)}%` }} />
                  </div>
                  {/* 트레이너 매출 세부 */}
                  <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[11px]">
                    {s.trainerPtRenewal > 0 && <div className="flex justify-between"><span className="text-muted-foreground">PT 재등록</span><span className="text-violet-400">{fmt(s.trainerPtRenewal)}원</span></div>}
                    {s.trainerPtNew > 0 && <div className="flex justify-between"><span className="text-muted-foreground">PT 신규</span><span className="text-blue-400">{fmt(s.trainerPtNew)}원</span></div>}
                    {s.trainerHealth > 0 && <div className="flex justify-between"><span className="text-muted-foreground">헬스</span><span className="text-amber-400">{fmt(s.trainerHealth)}원</span></div>}
                    {s.trainerEtc > 0 && <div className="flex justify-between"><span className="text-muted-foreground">기타</span><span className="text-muted-foreground">{fmt(s.trainerEtc)}원</span></div>}
                  </div>
                  {/* 상담 성과 (있을 때만) */}
                  {(cTotal(s) > 0 || s.leadCount > 0) && (
                    <div className="mt-1 pt-2 border-t border-border/40 space-y-1">
                      <p className="text-[10px] text-emerald-400 font-semibold uppercase tracking-wide">상담 신규영업</p>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[11px]">
                        {s.consultNew > 0 && <div className="flex justify-between"><span className="text-muted-foreground">PT 신규</span><span className="text-emerald-400">{fmt(s.consultNew)}원</span></div>}
                        {s.consultHealth > 0 && <div className="flex justify-between"><span className="text-muted-foreground">헬스</span><span className="text-emerald-400">{fmt(s.consultHealth)}원</span></div>}
                        {s.consultEtc > 0 && <div className="flex justify-between"><span className="text-muted-foreground">기타</span><span className="text-emerald-400">{fmt(s.consultEtc)}원</span></div>}
                      </div>
                      {s.consultPtRenewal > 0 && (
                        <p className="text-[10px] text-muted-foreground/50">PT 재등록 {s.consultPtRenewal}건 ({fmt(s.consultPtRenewalAmount)}원) — 성과 미포함</p>
                      )}
                      {s.leadCount > 0 && (
                        <div className="flex items-center gap-3 text-[11px]">
                          <span className="text-muted-foreground">상담 {s.leadCount}건</span>
                          <span className="text-muted-foreground">등록 {s.registeredCount}건</span>
                          <span className={`font-medium ${s.conversionRate >= 50 ? "text-emerald-400" : s.conversionRate >= 30 ? "text-amber-400" : "text-red-400"}`}>
                            전환율 {s.conversionRate}%
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })()}

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

      {/* 앱 재등록 신청 처리 모달 — /admin/gymplus 로그인 없이 바로 처리 */}
      {renewalModalOpen && (
        <div className="fixed inset-0 z-[200] bg-black/70 flex items-end md:items-center justify-center" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }} onClick={() => setRenewalModalOpen(false)}>
          <div className="bg-background border border-border rounded-t-2xl md:rounded-2xl w-full md:max-w-lg flex flex-col" style={{ maxHeight: 'calc(85svh - env(safe-area-inset-bottom))' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
              <h2 className="font-semibold text-foreground">앱 재등록 신청 처리</h2>
              <button onClick={() => setRenewalModalOpen(false)} className="text-muted-foreground hover:text-foreground p-1">✕</button>
            </div>
            <div className="overflow-y-auto flex-1 p-4">
              <GymPlusRenewalsAdmin />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
