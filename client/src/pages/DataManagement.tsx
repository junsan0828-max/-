import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { fmtPhone } from "@/lib/utils";
import {
  Database, TrendingUp, Users, Megaphone, Building2,
  ChevronLeft, ChevronRight, AlertCircle, UserX, Clock,
  Dumbbell, UserCog, Activity, Target,
  DollarSign, Percent, X, Smartphone,
  Coins, ArrowUpDown, Gift, CalendarPlus, Bookmark,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend, LabelList } from "recharts";

const COLORS = ["#6366f1", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#06b6d4", "#6b7280", "#f97316"];

type ViewMode = "monthly" | "annual";

function PeriodSelector({ viewMode, setViewMode, year, setYear, month, setMonth, isCurrentMonth }: {
  viewMode: ViewMode; setViewMode: (v: ViewMode) => void;
  year: number; setYear: (fn: (y: number) => number) => void;
  month: number; setMonth: (fn: (m: number) => number) => void;
  isCurrentMonth: boolean;
}) {
  const goPrev = () => {
    if (viewMode === "annual") { setYear(y => y - 1); }
    else { if (month === 1) { setYear(y => y - 1); setMonth(() => 12); } else setMonth(m => m - 1); }
  };
  const goNext = () => {
    if (viewMode === "annual") {
      const now = new Date();
      if (year < now.getFullYear()) setYear(y => y + 1);
    } else {
      if (!isCurrentMonth) { if (month === 12) { setYear(y => y + 1); setMonth(() => 1); } else setMonth(m => m + 1); }
    }
  };
  const atMax = viewMode === "annual" ? year >= new Date().getFullYear() : isCurrentMonth;

  return (
    <div className="flex items-center justify-between">
      <div className="flex gap-1">
        <button onClick={() => setViewMode("monthly")} className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${viewMode === "monthly" ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:text-foreground"}`}>월간</button>
        <button onClick={() => setViewMode("annual")} className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${viewMode === "annual" ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:text-foreground"}`}>연간</button>
      </div>
      <div className="flex items-center gap-3">
        <button onClick={goPrev} className="p-1.5 rounded-lg bg-card border border-border text-muted-foreground hover:text-foreground">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-sm font-semibold text-foreground min-w-[80px] text-center">
          {viewMode === "annual" ? `${year}년` : `${year}년 ${month}월`}
        </span>
        <button onClick={goNext} disabled={atMax} className={`p-1.5 rounded-lg bg-card border border-border ${atMax ? "text-border cursor-not-allowed" : "text-muted-foreground hover:text-foreground"}`}>
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function fmtWon(v: number) {
  if (v >= 100000000) return `${(v / 100000000).toFixed(1)}억`;
  if (v >= 10000000) return `${(v / 10000000).toFixed(1)}천만`;
  if (v >= 10000) return `${Math.round(v / 10000)}만`;
  return v.toLocaleString();
}

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ── 재무 탭 ──────────────────────────────────────────────────────────────────
function FinanceTab() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const { data: branchList } = trpc.gym.staff.listBranches.useQuery();
  const [branchFilter, setBranchFilter] = useState<number | null>(null);

  const { data, isLoading } = trpc.gym.kpi.financialDetail.useQuery(
    { year, ...(branchFilter ? { branchId: branchFilter } : {}) }
  );

  function w(n: number) { return n ? `₩${n.toLocaleString()}` : "-"; }
  function pct(n: number) { return (n || n === 0) ? `${n}%` : "-"; }

  const rows = data?.monthlyData ?? [];
  const tot = data?.total;

  const th = "px-2 py-2 text-center text-[10px] font-semibold text-muted-foreground whitespace-nowrap border-b border-border bg-muted/40";
  const td = "px-2 py-1.5 text-center text-[10px] text-foreground whitespace-nowrap border-b border-border/50";
  const tdR = "px-2 py-1.5 text-center text-[10px] text-red-400 whitespace-nowrap border-b border-border/50";
  const tdG = "px-2 py-1.5 text-center text-[10px] text-emerald-400 whitespace-nowrap border-b border-border/50";
  const tdB = "px-2 py-1.5 text-center text-[10px] text-blue-400 whitespace-nowrap border-b border-border/50";
  const totS = "px-2 py-2 text-center text-[10px] font-bold text-foreground whitespace-nowrap bg-muted/30";

  return (
    <div className="space-y-6">
      {/* 호점 필터 */}
      {branchList && branchList.length > 1 && (
        <div className="flex gap-1.5 flex-wrap">
          <button onClick={() => setBranchFilter(null)} className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${branchFilter === null ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:text-foreground"}`}>전체</button>
          {branchList.map((b: any) => (
            <button key={b.id} onClick={() => setBranchFilter(b.id)} className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${branchFilter === b.id ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:text-foreground"}`}>{b.name}</button>
          ))}
        </div>
      )}

      {/* 년도 선택 */}
      <div className="flex items-center justify-center gap-3">
        <button onClick={() => setYear(y => y - 1)} className="p-1.5 rounded-lg bg-card border border-border text-muted-foreground hover:text-foreground"><ChevronLeft className="h-4 w-4" /></button>
        <span className="text-sm font-semibold text-foreground min-w-[80px] text-center">{year}년</span>
        <button onClick={() => setYear(y => y + 1)} className="p-1.5 rounded-lg bg-card border border-border text-muted-foreground hover:text-foreground"><ChevronRight className="h-4 w-4" /></button>
      </div>
      {isLoading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground text-sm">로딩 중...</div>
      ) : (
        <div className="space-y-6">
          {(() => {
            const cur = rows[now.getMonth()];
            if (!cur || cur.gs === 0) return null;
            return (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground border-b border-border pb-2">{now.getMonth() + 1}월 재무 요약</h3>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: "매출(GS)", value: w(cur.gs), color: "text-foreground" },
                    { label: "매출(NS)", value: w(cur.ns), sub: `부가세 ${w(cur.vat)}`, color: "text-foreground" },
                    { label: "영업이익", value: w(cur.op), sub: `OPM ${pct(cur.opm)}`, color: cur.op >= 0 ? "text-emerald-400" : "text-red-400" },
                    { label: "순이익", value: w(cur.np), sub: `NPM ${pct(cur.npm)}`, color: cur.np >= 0 ? "text-emerald-400" : "text-red-400" },
                  ].map(c => (
                    <div key={c.label} className="bg-card border border-border rounded-xl p-3">
                      <div className="text-xs text-muted-foreground mb-1">{c.label}</div>
                      <div className={`text-sm font-bold ${c.color}`}>{c.value}</div>
                      {c.sub && <div className="text-xs text-muted-foreground mt-0.5">{c.sub}</div>}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-card border border-border rounded-xl p-3 space-y-1.5">
                    <div className="text-xs font-semibold text-muted-foreground mb-2">결제 수단</div>
                    {[["카드", cur.card], ["계좌이체", cur.transfer], ["현금", cur.cash], ["지역화폐", cur.local]].filter(([, v]) => (v as number) > 0).map(([l, v]) => (
                      <div key={l as string} className="flex justify-between text-xs">
                        <span className="text-muted-foreground">{l as string}</span>
                        <span className="text-foreground">{w(v as number)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="bg-card border border-border rounded-xl p-3 space-y-1.5">
                    <div className="text-xs font-semibold text-muted-foreground mb-2">비용 구성</div>
                    {[["고정비(FC)", cur.fc], ["변동비(VC)", cur.vc], ["광고비(CAC)", cur.cac], ["환불", cur.refund]].map(([l, v]) => (
                      <div key={l as string} className="flex justify-between text-xs">
                        <span className="text-muted-foreground">{l as string}</span>
                        <span className={(v as number) > 0 ? "text-red-400" : "text-muted-foreground"}>{w(v as number)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })()}
          <div>
            <h3 className="text-sm font-semibold text-foreground border-b border-border pb-2 mb-3">{year}년 월별 재무 데이터</h3>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px]">
                <thead>
                  <tr>
                    <th className={th} rowSpan={2}>월</th>
                    <th className={`${th} border-r border-border`} colSpan={5}>핵심 재무</th>
                    <th className={`${th} border-r border-border`} colSpan={4}>매출 구성</th>
                    <th className={`${th} border-r border-border`} colSpan={3}>비용</th>
                    <th className={`${th} border-r border-border`} colSpan={2}>객단가</th>
                    <th className={th}>계약</th>
                  </tr>
                  <tr>
                    <th className={th}>매출(GS)</th><th className={th}>매출(NS)</th><th className={th}>영업이익</th><th className={th}>OPM</th><th className={`${th} border-r border-border`}>순이익</th>
                    <th className={th}>PT신규</th><th className={th}>PT재등록</th><th className={th}>헬스신규</th><th className={`${th} border-r border-border`}>헬스재등록</th>
                    <th className={th}>고정비</th><th className={th}>변동비</th><th className={`${th} border-r border-border`}>환불</th>
                    <th className={th}>PT</th><th className={`${th} border-r border-border`}>헬스</th>
                    <th className={th}>건수</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => (
                    <tr key={r.month} className={r.gs === 0 ? "opacity-30" : "hover:bg-muted/10"}>
                      <td className={`${td} font-medium`}>{r.month}월</td>
                      <td className={td}>{w(r.gs)}</td><td className={td}>{w(r.ns)}</td>
                      <td className={r.op >= 0 ? tdG : tdR}>{w(r.op)}</td>
                      <td className={r.op >= 0 ? tdG : tdR}>{r.gs > 0 ? pct(r.opm) : "-"}</td>
                      <td className={`border-r border-border/30 ${r.np >= 0 ? tdG : tdR}`}>{w(r.np)}</td>
                      <td className={tdB}>{w(r.ptNew)}</td><td className={tdB}>{w(r.ptRenewal)}</td>
                      <td className={tdG}>{w(r.hlNew)}</td><td className={`border-r border-border/30 ${tdG}`}>{w(r.hlRenewal)}</td>
                      <td className={tdR}>{w(r.fc)}</td><td className={tdR}>{w(r.vc)}</td><td className={`border-r border-border/30 ${tdR}`}>{w(r.refund)}</td>
                      <td className={td}>{w(r.ptUnit)}</td><td className={`border-r border-border/30 ${td}`}>{w(r.hlUnit)}</td>
                      <td className={td}>{r.totalCnt || "-"}</td>
                    </tr>
                  ))}
                  {tot && (
                    <tr className="border-t-2 border-border">
                      <td className={totS}>합계</td>
                      <td className={totS}>{w(tot.gs)}</td><td className={totS}>{w(tot.ns)}</td>
                      <td className={`${totS} ${tot.op >= 0 ? "text-emerald-400" : "text-red-400"}`}>{w(tot.op)}</td>
                      <td className={`${totS} ${tot.op >= 0 ? "text-emerald-400" : "text-red-400"}`}>{tot.ns > 0 ? pct(Math.round(tot.op / tot.ns * 1000) / 10) : "-"}</td>
                      <td className={`border-r border-border/30 ${totS} ${tot.np >= 0 ? "text-emerald-400" : "text-red-400"}`}>{w(tot.np)}</td>
                      <td className={`${totS} text-blue-400`}>{w(tot.ptNew)}</td><td className={`${totS} text-blue-400`}>{w(tot.ptRenewal)}</td>
                      <td className={`${totS} text-emerald-400`}>{w(tot.hlNew)}</td><td className={`border-r border-border/30 ${totS} text-emerald-400`}>{w(tot.hlRenewal)}</td>
                      <td className={`${totS} text-red-400`}>{w(tot.fc)}</td><td className={`${totS} text-red-400`}>{w(tot.vc)}</td><td className={`border-r border-border/30 ${totS} text-red-400`}>{w(tot.refund)}</td>
                      <td className={totS}>{tot.ptCnt > 0 ? w(Math.round((tot.ptNew + tot.ptRenewal) / tot.ptCnt)) : "-"}</td>
                      <td className={`border-r border-border/30 ${totS}`}>{tot.hlCnt > 0 ? w(Math.round((tot.hlNew + tot.hlRenewal) / tot.hlCnt)) : "-"}</td>
                      <td className={totS}>{tot.totalCnt || "-"}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground border-b border-border pb-2 mb-3">결제 수단 및 세금</h3>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[500px]">
                <thead><tr>
                  <th className={th}>월</th><th className={th}>카드</th><th className={th}>계좌이체</th><th className={th}>현금</th><th className={th}>지역화폐</th><th className={th}>부가세(추정)</th>
                </tr></thead>
                <tbody>
                  {rows.filter(r => r.gs > 0).map(r => (
                    <tr key={r.month} className="hover:bg-muted/10">
                      <td className={`${td} font-medium`}>{r.month}월</td>
                      <td className={td}>{w(r.card)}</td><td className={td}>{w(r.transfer)}</td><td className={td}>{w(r.cash)}</td><td className={td}>{w(r.local)}</td><td className={tdR}>{w(r.vat)}</td>
                    </tr>
                  ))}
                  {tot && (<tr className="border-t-2 border-border">
                    <td className={totS}>합계</td>
                    <td className={totS}>{w(tot.card)}</td><td className={totS}>{w(tot.transfer)}</td><td className={totS}>{w(tot.cash)}</td><td className={totS}>{w(tot.local)}</td>
                    <td className={`${totS} text-red-400`}>{w(tot.vat)}</td>
                  </tr>)}
                </tbody>
              </table>
            </div>
          </div>
          <p className="text-xs text-muted-foreground text-center pb-2">* 부가세는 매출(GS)의 10/110 추정값 · 영업이익 = NS - 고정비 - 변동비 · 순이익 = 영업이익 - 광고비</p>
        </div>
      )}
    </div>
  );
}

// ── 고객 탭 ──────────────────────────────────────────────────────────────────
function CustomerTab() {
  const [, setLocation] = useLocation();
  const kstNow = new Date(Date.now() + 9 * 3600000);
  const [selYear, setSelYear] = useState(kstNow.getUTCFullYear());
  const [selMonth, setSelMonth] = useState(kstNow.getUTCMonth() + 1);
  const [branchFilter, setBranchFilter] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("monthly");
  const selPrefix = `${selYear}-${String(selMonth).padStart(2, "0")}`;
  const isCurrentMonth = selPrefix === `${kstNow.getUTCFullYear()}-${String(kstNow.getUTCMonth() + 1).padStart(2, "0")}`;

  const { data: branchList } = trpc.gym.staff.listBranches.useQuery();
  const bParam = branchFilter ? { branchId: branchFilter } : {};
  const { data: stats } = trpc.access.getAdminMemberStats.useQuery(branchFilter ? { branchId: branchFilter } : undefined);
  const expiringParam = viewMode === "annual"
    ? { days: 30, month: String(selYear), ...bParam }
    : isCurrentMonth ? { days: 30, ...bParam } : { days: 30, month: selPrefix, ...bParam };
  const { data: expiring, isLoading: expiringLoading } = trpc.access.getAdminExpiringMembers.useQuery(expiringParam);
  const { data: unpaid } = trpc.pt.listUnpaid.useQuery(branchFilter ? { branchId: branchFilter } : undefined);
  const { data: activePt } = trpc.access.getActivePtPackages.useQuery(branchFilter ? { branchId: branchFilter } : undefined);
  const mParam = viewMode === "monthly" ? { month: selMonth } : {};
  const { data: programStats } = trpc.gym.revenue.programStats.useQuery({ year: selYear, ...mParam, ...bParam });

  const totalUnpaid = (unpaid ?? []).reduce((s, p) => s + (p.unpaidAmount ?? 0), 0);
  const lowSession = (activePt ?? []).filter((p: any) => (p.totalSessions - p.usedSessions) <= 5);

  type CustCat = "expiring" | "lowPt" | "unpaid";
  const [custCat, setCustCat] = useState<CustCat>("expiring");

  const [gradeOpen, setGradeOpen] = useState<"vvip" | "vip" | null>(null);
  const { data: gradeMembers, isLoading: gradeMembersLoading, error: gradeMembersError } = trpc.access.getMembersByGrade.useQuery(
    { grade: gradeOpen ?? "vip", ...(branchFilter ? { branchId: branchFilter } : {}) },
    { enabled: !!gradeOpen }
  );

  const expiringLabel = viewMode === "annual" ? `${selYear}년 만료` : isCurrentMonth ? "만료 임박" : `${selMonth}월 만료`;
  const CUST_CATS: { key: CustCat; label: string; count: number; icon: React.ReactNode; color: string; activeClass: string }[] = [
    { key: "expiring", label: expiringLabel, count: expiring?.length ?? 0, icon: <AlertCircle className="h-3.5 w-3.5" />, color: "text-amber-400", activeClass: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
    { key: "lowPt", label: "PT 잔여 5↓", count: lowSession.length, icon: <Dumbbell className="h-3.5 w-3.5" />, color: "text-blue-400", activeClass: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
    { key: "unpaid", label: "미수금", count: unpaid?.length ?? 0, icon: <DollarSign className="h-3.5 w-3.5" />, color: "text-red-400", activeClass: "bg-red-500/15 text-red-400 border-red-500/30" },
  ];

  return (
    <div className="space-y-4">
      {/* 호점 필터 */}
      {branchList && branchList.length > 1 && (
        <div className="flex gap-1.5 flex-wrap">
          <button onClick={() => setBranchFilter(null)} className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${branchFilter === null ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:text-foreground"}`}>전체</button>
          {branchList.map(b => (
            <button key={b.id} onClick={() => setBranchFilter(b.id)} className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${branchFilter === b.id ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:text-foreground"}`}>{b.name}</button>
          ))}
        </div>
      )}

      <PeriodSelector viewMode={viewMode} setViewMode={setViewMode} year={selYear} setYear={setSelYear} month={selMonth} setMonth={setSelMonth} isCurrentMonth={isCurrentMonth} />

      {/* 요약 카드 */}
      <div className="grid grid-cols-2 gap-2">
        {[
          { label: "전체 회원", value: stats?.total ?? 0, unit: "명", color: "text-foreground" },
          { label: "활성 회원", value: stats?.active ?? 0, unit: "명", color: "text-emerald-400" },
          { label: "활성 PT 패키지", value: stats?.active_pt_packages ?? 0, unit: "건", color: "text-blue-400" },
          { label: "미수금 합계", value: totalUnpaid.toLocaleString(), unit: "원", color: totalUnpaid > 0 ? "text-red-400" : "text-muted-foreground" },
        ].map(c => (
          <div key={c.label} className="bg-card border border-border rounded-xl p-3">
            <p className="text-xs text-muted-foreground mb-1">{c.label}</p>
            <p className={`text-lg font-bold ${c.color}`}>{c.value}<span className="text-xs font-normal ml-1">{c.unit}</span></p>
          </div>
        ))}
      </div>

      {/* VIP/VVIP 카드 */}
      <div className="grid grid-cols-2 gap-2">
        {([
          { key: "vvip" as const, label: "VVIP 회원", sub: "누적 500만↑", count: stats?.vvip_count ?? 0, border: "border-rose-500/30", text: "text-rose-400", textMuted: "text-rose-400/70", activeBg: "bg-rose-500/10" },
          { key: "vip" as const, label: "VIP 회원", sub: "누적 300만↑", count: stats?.vip_count ?? 0, border: "border-yellow-500/30", text: "text-yellow-400", textMuted: "text-yellow-400/70", activeBg: "bg-yellow-500/10" },
        ]).map(c => (
          <button
            key={c.key}
            onClick={() => setGradeOpen(gradeOpen === c.key ? null : c.key)}
            className={`text-left bg-card border ${c.border} rounded-xl p-3 transition-colors ${gradeOpen === c.key ? c.activeBg : "hover:opacity-80"}`}
          >
            <p className={`text-xs ${c.textMuted} mb-1`}>{c.label} <span className="text-[10px]">({c.sub})</span></p>
            <p className={`text-lg font-bold ${c.text}`}>{c.count}<span className="text-xs font-normal ml-1">명</span></p>
          </button>
        ))}
      </div>

      {/* 등급별 회원 목록 */}
      {gradeOpen && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className={`px-4 py-2.5 border-b border-border flex items-center justify-between ${gradeOpen === "vvip" ? "bg-rose-500/10" : "bg-yellow-500/10"}`}>
            <span className={`text-sm font-semibold ${gradeOpen === "vvip" ? "text-rose-400" : "text-yellow-400"}`}>
              {gradeOpen === "vvip" ? "VVIP" : "VIP"} 회원 목록
            </span>
            <button onClick={() => setGradeOpen(null)} className="text-muted-foreground hover:text-foreground text-xs">닫기</button>
          </div>
          {gradeMembersError ? (
            <p className="text-xs text-red-400 text-center py-6">오류: {(gradeMembersError as any)?.message ?? "조회 실패"}</p>
          ) : gradeMembersLoading ? (
            <p className="text-xs text-muted-foreground text-center py-6">불러오는 중…</p>
          ) : !gradeMembers || gradeMembers.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6">해당 등급 회원이 없습니다.</p>
          ) : (
            <div className="divide-y divide-border">
              {gradeMembers.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setLocation(`/members/${m.id}`)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-accent/30 transition-colors text-left"
                >
                  <div>
                    <p className="text-sm font-medium">{m.name}</p>
                    <p className="text-xs text-muted-foreground">{fmtPhone(m.phone)} · {m.status === "active" ? "활성" : m.status === "ended" ? "마감" : m.status === "inactive" ? "비활성" : m.status}</p>
                  </div>
                  <p className={`text-xs font-semibold ${gradeOpen === "vvip" ? "text-rose-400" : "text-yellow-400"}`}>
                    {Number(m.total_payment ?? 0).toLocaleString()}원
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* PT 회원 비율 */}
      {stats && stats.active > 0 && (
        <div className="bg-card border border-border rounded-xl p-4 space-y-2">
          <p className="text-sm font-semibold text-foreground">PT 회원 비율</p>
          <div className="flex items-baseline gap-3">
            <span className="text-2xl font-bold text-blue-400">{Math.round((stats.pt_members ?? 0) / stats.active * 100)}%</span>
            <span className="text-xs text-muted-foreground">활성 {stats.active}명 중 PT {stats.pt_members ?? 0}명</span>
          </div>
          <div className="flex rounded-full overflow-hidden h-2 bg-muted">
            <div className="bg-blue-400 transition-all" style={{ width: `${((stats.pt_members ?? 0) / stats.active) * 100}%` }} />
          </div>
        </div>
      )}

      {/* 성별 분포 */}
      {stats && (stats.male + stats.female) > 0 && (
        <div className="bg-card border border-border rounded-xl p-4 space-y-2">
          <p className="text-sm font-semibold text-foreground">성별 분포</p>
          <div className="flex gap-4">
            <span className="text-xs text-muted-foreground">남 <span className="text-blue-400 font-semibold">{stats.male}명</span></span>
            <span className="text-xs text-muted-foreground">여 <span className="text-rose-400 font-semibold">{stats.female}명</span></span>
            {stats.total - stats.male - stats.female > 0 && (
              <span className="text-xs text-muted-foreground">미입력 <span className="text-muted-foreground font-semibold">{stats.total - stats.male - stats.female}명</span></span>
            )}
          </div>
          <div className="flex rounded-full overflow-hidden h-2 bg-muted">
            {stats.total > 0 && <>
              <div className="bg-blue-400 transition-all" style={{ width: `${(stats.male / stats.total) * 100}%` }} />
              <div className="bg-rose-400 transition-all" style={{ width: `${(stats.female / stats.total) * 100}%` }} />
            </>}
          </div>
        </div>
      )}

      {/* PT 프로그램별 현황 */}
      {programStats && programStats.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-4">
          <h2 className="text-sm font-semibold text-foreground mb-3">PT 프로그램별 현황</h2>
          <div className="space-y-2">
            {programStats.map((prog: any, i: number) => {
              const isEvent = prog.isEvent;
              const maxRev = programStats[0].revenue;
              const pct = maxRev > 0 ? Math.round((prog.revenue / maxRev) * 100) : 0;
              const subItems = isEvent && prog.subItems ? Object.entries(prog.subItems as Record<string, { count: number; revenue: number }>) : [];
              return (
                <div key={prog.name} className={isEvent ? "rounded-lg border border-amber-500/20 bg-amber-500/5 p-2.5 space-y-2" : ""}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <div className="flex items-center gap-1.5">
                      <span className={`px-1.5 py-0.5 rounded-full font-medium ${isEvent ? "bg-amber-400/15 text-amber-400" : "bg-primary/10 text-primary"}`}>{prog.name}</span>
                      <span className="text-muted-foreground">{prog.count}건</span>
                      <span className="text-muted-foreground text-[10px]">(신규 {prog.newCount} / 재등록 {prog.renewalCount})</span>
                    </div>
                    <span className="font-semibold text-foreground">{fmtWon(prog.revenue)}</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-1.5">
                    <div className="h-1.5 rounded-full" style={{ width: `${pct}%`, backgroundColor: isEvent ? "#f59e0b" : COLORS[i % COLORS.length] }} />
                  </div>
                  {isEvent && subItems.length > 0 && (
                    <div className="pt-1 space-y-1">
                      {subItems.sort((a, b) => b[1].revenue - a[1].revenue).map(([name, sub]) => (
                        <div key={name} className="flex items-center justify-between text-[11px] pl-2 border-l-2 border-amber-500/30">
                          <span className="text-muted-foreground">{name}</span>
                          <span className="text-amber-300 font-medium">{sub.count}건 · {fmtWon(sub.revenue)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {(() => {
            const ev = programStats.find((p: any) => p.isEvent);
            if (!ev) return null;
            const totalRev = programStats.reduce((s: number, p: any) => s + p.revenue, 0);
            const evPct = totalRev > 0 ? Math.round((ev.revenue / totalRev) * 100) : 0;
            return (
              <div className="mt-3 pt-3 border-t border-border/40 flex items-center justify-between text-xs">
                <span className="text-amber-400 font-medium">이벤트피티 합계</span>
                <span className="text-foreground font-semibold">{ev.count}건 · {fmtWon(ev.revenue)} ({evPct}%)</span>
              </div>
            );
          })()}
        </div>
      )}

      {/* 카테고리 탭 */}
      <div className="flex gap-1.5">
        {CUST_CATS.map(c => {
          const isActive = custCat === c.key;
          return (
            <button
              key={c.key}
              onClick={() => setCustCat(c.key)}
              className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-xs font-medium border transition-colors ${isActive ? c.activeClass : "bg-card border-border text-muted-foreground hover:text-foreground"}`}
            >
              {c.icon}
              {c.label}
              <span className={`ml-0.5 text-[10px] font-bold ${isActive ? "" : "opacity-60"}`}>{c.count}</span>
            </button>
          );
        })}
      </div>

      {/* 카테고리별 컨텐츠 */}
      {custCat === "expiring" && (
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1.5">
            <AlertCircle className="h-4 w-4 text-amber-400" /> 만료 임박 회원 (30일 이내)
            <span className="text-xs text-muted-foreground font-normal">({expiring?.length ?? 0}명)</span>
          </h3>
          {expiringLoading ? (
            <p className="text-xs text-muted-foreground text-center py-4">로딩 중...</p>
          ) : !expiring?.length ? (
            <p className="text-xs text-muted-foreground text-center py-4">만료 임박 회원이 없습니다</p>
          ) : (
            <div className="space-y-1.5">
              {expiring.map(m => {
                const isService = m.rev_paid === 0 || (m.rev_type === "PT" && (m.rev_svc_health ?? 0) > 0);
                const program = m.rev_type === "헬스" && m.rev_duration
                  ? `헬스 ${m.rev_duration}개월`
                  : m.rev_type === "PT"
                    ? `PT${m.rev_svc_health ? ` + 서비스헬스 ${m.rev_svc_health}개월` : ""}`
                    : m.rev_program ?? m.rev_type ?? "정보 없음";
                return (
                  <div
                    key={m.id}
                    onClick={() => setLocation(`/members/${m.id}`)}
                    className="flex items-center justify-between bg-card border border-border rounded-xl px-3 py-2.5 cursor-pointer active:bg-accent hover:border-primary/30 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-medium text-foreground">{m.name}</p>
                        {isService && <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-400 font-medium">서비스</span>}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {program}
                        {m.rev_paid != null && m.rev_paid > 0 && <> · {m.rev_paid.toLocaleString()}원</>}
                      </p>
                      <p className="text-xs text-muted-foreground">{m.trainerName ?? "담당 없음"} · 만료 {m.membershipEnd}</p>
                    </div>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${m.days_left <= 7 ? "bg-red-500/20 text-red-400" : "bg-amber-500/20 text-amber-400"}`}>
                      D-{m.days_left}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {custCat === "lowPt" && (
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1.5">
            <Dumbbell className="h-4 w-4 text-blue-400" /> PT 잔여 5회 이하
            <span className="text-xs text-muted-foreground font-normal">({lowSession.length}명)</span>
          </h3>
          {!lowSession.length ? (
            <p className="text-xs text-muted-foreground text-center py-4">해당 회원이 없습니다</p>
          ) : (
            <div className="space-y-1.5">
              {lowSession.map((p: any) => {
                const remaining = p.totalSessions - p.usedSessions;
                return (
                  <div key={p.id} className="flex items-center justify-between bg-card border border-border rounded-xl px-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground">{p.memberName}</p>
                      <p className="text-xs text-muted-foreground">{p.packageName} · {p.usedSessions}/{p.totalSessions}회 사용</p>
                    </div>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${remaining === 0 ? "bg-red-500/20 text-red-400" : "bg-blue-500/20 text-blue-400"}`}>
                      잔여 {remaining}회
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {custCat === "unpaid" && (
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1.5">
            <DollarSign className="h-4 w-4 text-red-400" /> 미수금 현황
            <span className="text-xs text-muted-foreground font-normal">({unpaid?.length ?? 0}건)</span>
          </h3>
          {!unpaid?.length ? (
            <p className="text-xs text-muted-foreground text-center py-4">미수금이 없습니다</p>
          ) : (
            <div className="space-y-1.5">
              {unpaid.map(p => (
                <div key={p.id} className="flex items-center justify-between bg-card border border-border rounded-xl px-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground">{p.memberName}</p>
                    <p className="text-xs text-muted-foreground">{p.packageName} · {p.trainerName ?? "담당 없음"}</p>
                  </div>
                  <span className="text-xs font-semibold text-red-400">{(p.unpaidAmount ?? 0).toLocaleString()}원</span>
                </div>
              ))}
              <div className="flex justify-between px-3 py-2 border-t border-border mt-1 pt-2">
                <span className="text-xs text-muted-foreground font-medium">총 미수금</span>
                <span className="text-sm font-bold text-red-400">{totalUnpaid.toLocaleString()}원</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── 마케팅 탭 ─────────────────────────────────────────────────────────────────
const CHANNEL_TYPE_LABELS: Record<string, string> = {
  online: "온라인", sns: "SNS", referral: "소개", offline: "오프라인",
};

function MarketingTab() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [branchFilter, setBranchFilter] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("monthly");
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1;
  const mParam = viewMode === "monthly" ? { month } : {};
  const dateRange = viewMode === "annual"
    ? { startDate: `${year}-01-01`, endDate: `${year}-12-31` }
    : { startDate: `${year}-${String(month).padStart(2, "0")}-01`, endDate: `${year}-${String(month).padStart(2, "0")}-${String(new Date(year, month, 0).getDate()).padStart(2, "0")}` };
  const bParam = branchFilter ? { branchId: branchFilter } : {};


  const { data: branchList } = trpc.gym.staff.listBranches.useQuery();
  const { data: pageStats } = trpc.landing.getPageStats.useQuery();
  const { data: pageStatsMonth } = trpc.landing.getPageStatsByPeriod.useQuery({ year, ...(viewMode === "monthly" ? { month } : {}) });
  const { data: channels } = trpc.gym.channels.list.useQuery();
  const { data: monthStats } = trpc.gym.leads.statsByMonth.useQuery({ year, ...mParam });
  const { data: channelRevSummary } = trpc.gym.revenue.channelSummary.useQuery({ year, ...mParam, ...bParam });
  const { data: consultantData } = trpc.consultantRecords.listAll.useQuery(bParam);
  const { data: adSummary } = trpc.consultantData.getAdSummary.useQuery(dateRange);
  const { data: contentSummary } = trpc.consultantData.getContentSummary.useQuery(dateRange);
  const { data: consultTimeStats } = trpc.gym.leads.consultationTimeStats.useQuery({ year, ...mParam });

  const channelData = (() => {
    const list = (channels ?? [])
      .filter(ch => ch.name !== "전화예약")
      .map((ch, i) => {
        const leadStat = monthStats?.byChannel[ch.id];
        const revData = channelRevSummary?.find(r => r.channelName === ch.name);
        return {
          id: ch.id, name: ch.name, type: ch.type,
          leads: leadStat?.count ?? 0,
          consulted: leadStat?.consulted ?? 0,
          registered: leadStat?.registered ?? 0,
          revenue: revData?.total ?? 0,
          color: COLORS[i % COLORS.length],
        };
      });
    if (monthStats?.noChannel) {
      list.push({
        id: -1, name: "채널 미지정", type: "etc",
        leads: monthStats.noChannel.count,
        consulted: monthStats.noChannel.consulted,
        registered: monthStats.noChannel.registered,
        revenue: 0,
        color: COLORS[(list.length) % COLORS.length],
      });
    }
    return list.filter(ch => ch.leads > 0 || ch.revenue > 0).sort((a, b) => b.leads - a.leads);
  })();

  const totalLeads = monthStats?.total ?? 0;
  const totalRevenue = channelRevSummary?.reduce((s, r) => s + r.total, 0) ?? 0;
  const conversionRate = monthStats?.conversionRate ?? 0;

  return (
    <div className="space-y-5">
      {/* 호점 필터 */}
      {branchList && branchList.length > 1 && (
        <div className="flex gap-1.5 flex-wrap">
          <button onClick={() => setBranchFilter(null)} className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${branchFilter === null ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:text-foreground"}`}>전체</button>
          {branchList.map(b => (
            <button key={b.id} onClick={() => setBranchFilter(b.id)} className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${branchFilter === b.id ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:text-foreground"}`}>{b.name}</button>
          ))}
        </div>
      )}

      <PeriodSelector viewMode={viewMode} setViewMode={setViewMode} year={year} setYear={setYear} month={month} setMonth={setMonth} isCurrentMonth={isCurrentMonth} />

      {/* 랜딩페이지 오늘 현황 — 월간 모드에서만 */}
      {viewMode === "monthly" && <div className="bg-card border border-border rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Megaphone className="h-4 w-4 text-primary" />
          <h2 className="font-semibold text-sm">랜딩페이지 오늘 현황</h2>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "방문자", value: pageStats?.todayViews ?? 0, unit: "명", color: "text-blue-400" },
            { label: "네이버 클릭", value: pageStats?.naverClicks ?? 0, unit: "회", color: "text-emerald-400" },
            { label: "체형분석 신청", value: pageStats?.analysisComplete ?? 0, unit: "건", color: "text-amber-400" },
          ].map((s) => (
            <div key={s.label} className="bg-muted/30 rounded-lg p-3 text-center">
              <p className={`text-2xl font-black ${s.color}`}>{s.value}<span className="text-xs font-medium text-muted-foreground ml-0.5">{s.unit}</span></p>
              <p className="text-[10px] text-muted-foreground mt-1">{s.label}</p>
            </div>
          ))}
        </div>
        {pageStats?.daily && pageStats.daily.length > 0 && (
          <div className="pt-2 border-t border-border">
            <p className="text-[10px] text-muted-foreground mb-2">최근 14일 방문자</p>
            <div className="flex items-end gap-1 h-20">
              {pageStats.daily.map((d: { date: string; views: number }) => {
                const max = Math.max(...pageStats.daily.map((x: { views: number }) => Number(x.views)), 1);
                const h = Math.max(4, Math.round((Number(d.views) / max) * 52));
                const dateStr = String(d.date).slice(0, 10);
                return (
                  <div key={dateStr} className="flex-1 flex flex-col items-center gap-0.5" title={`${dateStr}: ${d.views}명`}>
                    <span className="text-[9px] font-bold text-foreground leading-none">{Number(d.views)}</span>
                    <div className="w-full bg-primary/60 rounded-sm" style={{ height: h }} />
                    <span className="text-[8px] text-muted-foreground">{dateStr.slice(5)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>}

      {/* 광고 채널 성과 (데이터 기록) */}
      {adSummary && adSummary.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1.5">
            <Target className="h-4 w-4 text-blue-400" /> 광고 채널 성과
          </h3>
          <div className="space-y-2">
            {adSummary.map((ad: any) => {
              const ctr = ad.impressions > 0 ? ((ad.clicks / ad.impressions) * 100).toFixed(1) : "0";
              return (
                <div key={ad.channel} className="bg-card border border-border rounded-xl p-3">
                  <p className="text-xs font-medium text-foreground mb-2">{ad.channel}</p>
                  <div className="grid grid-cols-4 gap-2 text-center text-xs">
                    <div>
                      <div className="font-semibold text-foreground">{ad.impressions.toLocaleString()}</div>
                      <div className="text-muted-foreground">노출</div>
                    </div>
                    <div>
                      <div className="font-semibold text-blue-400">{ad.clicks.toLocaleString()}</div>
                      <div className="text-muted-foreground">클릭</div>
                    </div>
                    <div>
                      <div className="font-semibold text-emerald-400">{ad.visits}</div>
                      <div className="text-muted-foreground">유입</div>
                    </div>
                    <div>
                      <div className="font-semibold text-amber-400">{ad.inquiries}</div>
                      <div className="text-muted-foreground">문의</div>
                    </div>
                  </div>
                  {ad.impressions > 0 && (
                    <div className="mt-2 text-[11px] text-muted-foreground text-right">CTR {ctr}%</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 콘텐츠 제작 현황 (데이터 기록) */}
      {contentSummary && contentSummary.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1.5">
            <Megaphone className="h-4 w-4 text-pink-400" /> 콘텐츠 제작 현황
          </h3>
          <div className="grid grid-cols-1 gap-2">
            {contentSummary.map((c: any) => (
              <div key={c.platform} className="bg-card border border-border rounded-xl p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-foreground">{c.platform}</span>
                  <span className="text-[11px] text-muted-foreground">{c.totalDays}일 기록</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div>
                    <div className="font-semibold text-foreground">{c.totalPublished ?? 0}</div>
                    <div className="text-muted-foreground">발행 수</div>
                  </div>
                  <div>
                    <div className="font-semibold text-emerald-400">{c.publishedDays}</div>
                    <div className="text-muted-foreground">발행일</div>
                  </div>
                  <div>
                    <div className="font-semibold text-blue-400">{c.completedDays}</div>
                    <div className="text-muted-foreground">완료일</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 요약 카드 */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-card border border-border rounded-xl p-3 text-center">
              <Users className="h-4 w-4 text-blue-400 mx-auto mb-1" />
              <div className="text-lg font-bold text-foreground">{totalLeads}</div>
              <div className="text-xs text-muted-foreground">총 리드</div>
            </div>
            <div className="bg-card border border-border rounded-xl p-3 text-center">
              <Percent className="h-4 w-4 text-emerald-400 mx-auto mb-1" />
              <div className="text-lg font-bold text-foreground">{conversionRate}%</div>
              <div className="text-xs text-muted-foreground">전환율</div>
            </div>
            <div className="bg-card border border-border rounded-xl p-3 text-center">
              <DollarSign className="h-4 w-4 text-amber-400 mx-auto mb-1" />
              <div className="text-lg font-bold text-foreground">{fmtWon(totalRevenue)}</div>
              <div className="text-xs text-muted-foreground">채널 매출</div>
            </div>
          </div>

          {/* 랜딩페이지 기간 통계 */}
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Megaphone className="h-4 w-4 text-primary" />
              <h2 className="font-semibold text-sm">
                랜딩페이지 {viewMode === "annual" ? `${year}년` : `${month}월`} 현황
              </h2>
            </div>
            {(() => {
              const d = pageStatsMonth;
              return (
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-muted/30 rounded-lg p-3 text-center">
                    <p className="text-2xl font-black text-blue-400">{d?.views ?? 0}<span className="text-xs font-medium text-muted-foreground ml-0.5">명</span></p>
                    <p className="text-[10px] text-muted-foreground mt-1">방문자(순)</p>
                    <p className="text-[9px] text-muted-foreground/80 mt-0.5">신규 {d?.newVisitors ?? 0} · 재방문 {d?.returningVisitors ?? 0}</p>
                  </div>
                  <div className="bg-muted/30 rounded-lg p-3 text-center">
                    <p className="text-2xl font-black text-emerald-400">{d?.naverClicks ?? 0}<span className="text-xs font-medium text-muted-foreground ml-0.5">회</span></p>
                    <p className="text-[10px] text-muted-foreground mt-1">네이버 클릭</p>
                  </div>
                  <div className="bg-muted/30 rounded-lg p-3 text-center">
                    <p className="text-2xl font-black text-amber-400">{d?.analysisComplete ?? 0}<span className="text-xs font-medium text-muted-foreground ml-0.5">건</span></p>
                    <p className="text-[10px] text-muted-foreground mt-1">체형분석 신청</p>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* 전환 퍼널 */}
          {monthStats && monthStats.total > 0 && (
            <div className="bg-card border border-border rounded-xl p-4">
              <h2 className="text-sm font-semibold text-foreground mb-4">전환 퍼널</h2>
              <div className="space-y-2">
                {[
                  { label: "총 리드", count: monthStats.total, color: "#6366f1", pct: 100 },
                  { label: "상담 완료", count: monthStats.consulted + monthStats.registered, color: "#8b5cf6", pct: Math.round(((monthStats.consulted + monthStats.registered) / monthStats.total) * 100) },
                  { label: "등록 완료", count: monthStats.registered, color: "#10b981", pct: Math.round((monthStats.registered / monthStats.total) * 100) },
                ].map(stage => (
                  <div key={stage.label} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">{stage.label}</span>
                      <span className="font-medium text-foreground">{stage.count}명 ({stage.pct}%)</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-3">
                      <div className="h-3 rounded-full transition-all" style={{ width: `${stage.pct}%`, backgroundColor: stage.color }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 상담 시간 분석 */}
          {consultTimeStats && consultTimeStats.total > 0 && (
            <div className="bg-card border border-border rounded-xl p-4 space-y-4">
              <h2 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-blue-400" /> 상담 시간 분석
                <span className="text-xs text-muted-foreground font-normal ml-1">{month}월 총 {consultTimeStats.total}건</span>
              </h2>

              {/* 요일별 */}
              <div>
                <p className="text-xs text-muted-foreground mb-2">요일별 상담 건수</p>
                <ResponsiveContainer width="100%" height={140}>
                  <BarChart data={consultTimeStats.byDow} barSize={24}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#9ca3af" }} />
                    <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} allowDecimals={false} />
                    <Tooltip contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #374151", borderRadius: "8px", fontSize: "12px" }} />
                    <Bar dataKey="count" name="건수" fill="#6366f1" radius={[3, 3, 0, 0]}>
                      <LabelList dataKey="count" position="top" style={{ fontSize: 10, fill: "#d1d5db", fontWeight: 600 }} formatter={(v: number) => v > 0 ? v : ""} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* 시간대별 */}
              <div>
                <p className="text-xs text-muted-foreground mb-2">시간대별 상담 건수</p>
                <ResponsiveContainer width="100%" height={140}>
                  <BarChart data={consultTimeStats.byHour} barSize={14}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="hour" tick={{ fontSize: 9, fill: "#9ca3af" }} tickFormatter={(h: number) => `${h}시`} />
                    <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} allowDecimals={false} />
                    <Tooltip contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #374151", borderRadius: "8px", fontSize: "12px" }} labelFormatter={(h: number) => `${h}시`} />
                    <Bar dataKey="count" name="건수" fill="#8b5cf6" radius={[3, 3, 0, 0]}>
                      <LabelList dataKey="count" position="top" style={{ fontSize: 9, fill: "#d1d5db", fontWeight: 600 }} formatter={(v: number) => v > 0 ? v : ""} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* 채널별 성과 (상담 전환 + 매출 통합) */}
          {channelData.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1.5">
                <Target className="h-4 w-4 text-violet-400" /> 채널별 성과
              </h3>
              <div className="space-y-2">
                {channelData.map((ch: any) => {
                  const convRate = ch.leads > 0 ? Math.round((ch.registered / ch.leads) * 100) : 0;
                  return (
                    <div key={ch.id} className="bg-card border border-border rounded-xl p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: ch.color }} />
                        <span className="text-sm font-medium text-foreground">{ch.name}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">{CHANNEL_TYPE_LABELS[ch.type] ?? ch.type}</span>
                      </div>
                      <div className="grid grid-cols-4 gap-1.5 text-xs text-center">
                        <div>
                          <div className="font-semibold text-foreground">{ch.leads}</div>
                          <div className="text-muted-foreground">리드</div>
                        </div>
                        <div>
                          <div className="font-semibold text-blue-400">{ch.consulted}</div>
                          <div className="text-muted-foreground">상담</div>
                        </div>
                        <div>
                          <div className="font-semibold text-emerald-400">{ch.registered}<span className="text-muted-foreground ml-0.5">({convRate}%)</span></div>
                          <div className="text-muted-foreground">등록</div>
                        </div>
                        <div>
                          <div className="font-semibold text-primary">{fmtWon(ch.revenue)}</div>
                          <div className="text-muted-foreground">매출</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 컨설턴트 기록: 콘텐츠 실적 */}
          {consultantData && consultantData.length > 0 && (() => {
            const agg = consultantData.reduce((s: any, r: any) => ({
              blogPosts: s.blogPosts + (r.blogPosts ?? 0),
              instagramPosts: s.instagramPosts + (r.instagramPosts ?? 0),
              youtubeVideos: s.youtubeVideos + (r.youtubeVideos ?? 0),
              offlineEvents: s.offlineEvents + (r.offlineEvents ?? 0),
              referralCount: s.referralCount + (r.referralCount ?? 0),
              adSpend: s.adSpend + (r.adSpend ?? 0),
              snsFollowers: Math.max(s.snsFollowers ?? 0, r.snsFollowers ?? 0),
            }), { blogPosts: 0, instagramPosts: 0, youtubeVideos: 0, offlineEvents: 0, referralCount: 0, adSpend: 0, snsFollowers: 0 });
            const items = [
              { label: "블로그 포스팅", value: agg.blogPosts, unit: "건" },
              { label: "인스타그램 게시물", value: agg.instagramPosts, unit: "건" },
              { label: "유튜브 영상", value: agg.youtubeVideos, unit: "건" },
              { label: "오프라인 이벤트", value: agg.offlineEvents, unit: "건" },
              { label: "지인 추천", value: agg.referralCount, unit: "건" },
              { label: "광고 집행", value: agg.adSpend.toLocaleString(), unit: "원" },
              ...(agg.snsFollowers > 0 ? [{ label: "SNS 팔로워", value: agg.snsFollowers.toLocaleString(), unit: "명" }] : []),
            ].filter(i => Number(String(i.value).replace(/,/g, "")) > 0);
            if (!items.length) return null;
            return (
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1.5">
                  <Megaphone className="h-4 w-4 text-violet-400" /> 콘텐츠 · 마케팅 실적
                  <span className="text-xs text-muted-foreground font-normal">(컨설턴트 기록)</span>
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  {items.map(i => (
                    <div key={i.label} className="bg-card border border-border rounded-xl p-3">
                      <p className="text-xs text-muted-foreground mb-1">{i.label}</p>
                      <p className="text-lg font-bold text-violet-400">{i.value}<span className="text-xs font-normal ml-1">{i.unit}</span></p>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

    </div>
  );
}

// ── 센터 운영 탭 ──────────────────────────────────────────────────────────────
function OperationsTab() {
  const now = new Date();
  const [selYear, setSelYear] = useState(now.getFullYear());
  const [selMonth, setSelMonth] = useState(now.getMonth() + 1);
  const [branchFilter, setBranchFilter] = useState<number | undefined>(undefined);
  const [viewMode, setViewMode] = useState<ViewMode>("monthly");
  const selPrefix = `${selYear}-${String(selMonth).padStart(2, "0")}`;
  const isCurrentMonth = selYear === now.getFullYear() && selMonth === now.getMonth() + 1;
  const opsMonthParam = viewMode === "annual" ? String(selYear) : selPrefix;
  const opsDateRange = viewMode === "annual"
    ? { startDate: `${selYear}-01-01`, endDate: `${selYear}-12-31` }
    : { startDate: `${selPrefix}-01`, endDate: `${selPrefix}-${String(new Date(selYear, selMonth, 0).getDate()).padStart(2, "0")}` };
  const { data: me } = trpc.auth.me.useQuery();
  const isAdmin = ["admin", "sub_admin"].includes((me as any)?.role ?? "");
  const { data: branchList } = trpc.gym.staff.listBranches.useQuery();
  const { data: dashboard, isLoading: dashLoading } = trpc.access.getOpsVisitDashboard.useQuery(
    { ...(branchFilter ? { branchId: branchFilter } : {}), month: opsMonthParam }
  );
  const [, setLocation] = useLocation();
  const [utilModal, setUtilModal] = useState<{ type: string; title: string } | null>(null);
  const { data: utilMembers, isLoading: utilLoading } = trpc.access.getUtilizationMembers.useQuery(
    { type: utilModal?.type as any, branchId: branchFilter, month: selPrefix },
    { enabled: !!utilModal }
  );
  const { data: consultantData } = trpc.consultantRecords.listAll.useQuery({ year: selYear, month: selMonth });
  const { data: inspectionSummary } = trpc.consultantData.getInspectionSummary.useQuery(opsDateRange);
  const { data: inspectionPending } = trpc.consultantData.getInspectionPending.useQuery(opsDateRange);
  const { data: inspectionTrend } = trpc.consultantData.getInspectionTrend.useQuery(opsDateRange);
  const { data: inspectionAreaStats } = trpc.consultantData.getInspectionAreaStats.useQuery(opsDateRange);
  const { data: inspectionDateStatuses, refetch: refetchDateStatuses } = trpc.consultantData.getInspectionDateStatuses.useQuery(opsDateRange);
  const setInspectionReview = trpc.consultantData.setInspectionDateReview.useMutation({
    onSuccess: () => { refetchDateStatuses(); },
  });


  if (dashLoading || !dashboard) {
    return <p className="text-sm text-muted-foreground text-center py-8">로딩 중...</p>;
  }

  const {
    dailyVisits, prevMonthTotal, hourlyVisits: allHourlyVisits, dailyHourly, dowVisits,
    activeCount, visited7, visited14, visited30, memberFrequency,
    currentMonth, today,
  } = dashboard;

  const totalVisits = dailyVisits.reduce((s: number, d: any) => s + d.count, 0);
  const [cy, cm] = currentMonth.split("-").map(Number);
  const daysInMonth = new Date(cy, cm, 0).getDate();
  const todayDate = parseInt(today.substring(8, 10), 10);
  const periodDays = Math.min(todayDate, daysInMonth);
  const avgDaily = periodDays > 0 ? Math.round(totalVisits / periodDays) : 0;
  const prevMonthNum = cm === 1 ? 12 : cm - 1;
  const prevYear = cm === 1 ? cy - 1 : cy;
  const prevDaysInMonth = new Date(prevYear, prevMonthNum, 0).getDate();
  const prevAvgDaily = prevDaysInMonth > 0 ? prevMonthTotal / prevDaysInMonth : 0;
  const changeRate = prevAvgDaily > 0 ? Math.round((avgDaily - prevAvgDaily) / prevAvgDaily * 100) : null;

  const TIME_BLOCKS = [
    { label: "08~10", hours: [8, 9] },
    { label: "10~12", hours: [10, 11] },
    { label: "12~14", hours: [12, 13] },
    { label: "14~16", hours: [14, 15] },
    { label: "16~18", hours: [16, 17] },
    { label: "18~20", hours: [18, 19] },
    { label: "20~23", hours: [20, 21, 22] },
  ];
  const uniqueDays = new Set(dailyHourly.map((d: any) => d.day)).size || 1;
  const blockStats = TIME_BLOCKS.map(block => {
    const dayTotals: Record<string, number> = {};
    dailyHourly.forEach((d: any) => {
      if (block.hours.includes(d.hour)) {
        dayTotals[d.day] = (dayTotals[d.day] ?? 0) + d.count;
      }
    });
    const vals = Object.values(dayTotals);
    const total = vals.reduce((s, v) => s + v, 0);
    return { label: block.label, total, avg: Math.round(total / uniqueDays * 10) / 10, max: vals.length > 0 ? Math.max(...vals) : 0, pct: 0 };
  });
  const totalBlockVisits = blockStats.reduce((s, b) => s + b.total, 0) || 1;
  blockStats.forEach(b => { b.pct = Math.round(b.total / totalBlockVisits * 100); });
  const peakBlock = blockStats.reduce((a, b) => (b.total > a.total ? b : a), blockStats[0]);

  const DOW_LABELS = ["월", "화", "수", "목", "금", "토", "일"];
  const dowOccurrences: Record<number, number> = {};
  const loopStart = `${cy}-${String(cm).padStart(2, "0")}-01`;
  const loopEnd = `${cy}-${String(cm).padStart(2, "0")}-${String(Math.min(todayDate, daysInMonth)).padStart(2, "0")}`;
  for (let cur = new Date(loopStart + "T00:00:00"); toDateStr(cur) <= loopEnd; cur.setDate(cur.getDate() + 1)) {
    const jsDay = cur.getDay();
    const isodow = jsDay === 0 ? 7 : jsDay;
    dowOccurrences[isodow] = (dowOccurrences[isodow] ?? 0) + 1;
  }
  const dowData = [1, 2, 3, 4, 5, 6].map(dow => {
    const found = dowVisits.find((d: any) => d.dow === dow);
    const total = found?.count ?? 0;
    const occ = dowOccurrences[dow] ?? 1;
    return { label: DOW_LABELS[dow - 1], total, avg: Math.round(total / occ * 10) / 10, pct: 0 };
  });
  const totalDowVisits = dowData.reduce((s, d) => s + d.total, 0) || 1;
  dowData.forEach(d => { d.pct = Math.round(d.total / totalDowVisits * 100); });
  const busiestDow = dowData.reduce((a, b) => (b.total > a.total ? b : a), dowData[0]);
  const quietestDow = dowData.filter(d => d.total > 0).reduce((a, b) => (b.total < a.total ? b : a), dowData[0]);

  const WEEKS_IN_30 = 30 / 7;
  const freqBuckets = [
    { label: "주 1회 미만", min: 0, max: 0.99 },
    { label: "주 1회", min: 1, max: 1.99 },
    { label: "주 2회", min: 2, max: 2.99 },
    { label: "주 3회", min: 3, max: 3.99 },
    { label: "주 4회+", min: 4, max: Infinity },
  ];
  const bucketCounts = freqBuckets.map(b => {
    const count = memberFrequency.filter((m: any) => {
      const rate = m.visits / WEEKS_IN_30;
      return rate >= b.min && rate <= b.max;
    }).length;
    return { ...b, count };
  });
  const totalMembersFreq = memberFrequency.length || 1;
  const totalVisitsFreq = memberFrequency.reduce((s: number, m: any) => s + m.visits, 0);
  const avgWeekly = memberFrequency.length > 0
    ? (totalVisitsFreq / memberFrequency.length / WEEKS_IN_30).toFixed(1) : "0";
  const maxBucketCount = Math.max(...bucketCounts.map(b => b.count), 1);

  const notVisited14 = Math.max(0, activeCount - visited14);
  const notVisited30 = Math.max(0, activeCount - visited30);

  return (
    <div className="space-y-6">
      {/* 호점 필터 */}
      {branchList && branchList.length > 1 && (
        <div className="flex gap-2">
          <button
            onClick={() => setBranchFilter(undefined)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${!branchFilter ? "bg-amber-500/15 text-amber-400 border-amber-500/30" : "bg-card border-border text-muted-foreground"}`}
          >전체</button>
          {(branchList as any[]).map((b: any) => (
            <button
              key={b.id}
              onClick={() => setBranchFilter(b.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${branchFilter === b.id ? "bg-amber-500/15 text-amber-400 border-amber-500/30" : "bg-card border-border text-muted-foreground"}`}
            >{b.name}</button>
          ))}
        </div>
      )}

      <PeriodSelector viewMode={viewMode} setViewMode={setViewMode} year={selYear} setYear={setSelYear} month={selMonth} setMonth={setSelMonth} isCurrentMonth={isCurrentMonth} />

      {/* ── 미조치 항목 경고 ── */}
      {inspectionPending && inspectionPending.length > 0 && (
        <div className="bg-red-500/10 border border-red-500/25 rounded-xl p-3">
          <h3 className="text-sm font-semibold text-red-400 mb-2 flex items-center gap-1.5">
            <AlertCircle className="h-4 w-4" /> 미조치 항목 {inspectionPending.length}건
          </h3>
          <div className="space-y-1.5">
            {inspectionPending.map((item: any) => (
              <div key={item.area + item.date} className="bg-card border border-red-500/20 rounded-lg px-3 py-2">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-xs font-medium text-foreground">{item.area}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-400">{item.actionStatus || "미처리"}</span>
                    <span className="text-[11px] text-muted-foreground">{item.date}</span>
                  </div>
                </div>
                <div className="flex gap-3 text-xs">
                  {item.facilityStatus !== "정상" && <span className="text-red-400">시설: {item.facilityStatus}</span>}
                  {item.hygieneStatus !== "양호" && <span className="text-amber-400">위생: {item.hygieneStatus}</span>}
                  {item.assignee && <span className="text-muted-foreground">담당: {item.assignee}</span>}
                </div>
                {item.issueNote && <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">{item.issueNote}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── 센터 점검 현황 ── */}
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1.5">
          <Building2 className="h-4 w-4 text-emerald-400" /> 센터 점검 현황
          {inspectionSummary && inspectionSummary.totalDays > 0 && (
            <span className="text-xs text-muted-foreground font-normal">({inspectionSummary.totalDays}일 점검)</span>
          )}
        </h3>

        {/* 날짜별 점검 완료 상태 */}
        {inspectionDateStatuses && inspectionDateStatuses.length > 0 && (
          <div className="mb-3 space-y-1.5">
            {inspectionDateStatuses.map((ds: any) => {
              const reviewed = ds.reviewStatus === "점검완료";
              return (
                <div key={ds.date} className={`bg-card border rounded-xl px-3 py-2 flex items-center justify-between gap-2 ${reviewed ? "border-border" : "border-amber-500/30"}`}>
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0 ${reviewed ? "bg-emerald-500/15 text-emerald-400" : "bg-amber-500/15 text-amber-400"}`}>
                      {ds.reviewStatus}
                    </span>
                    <span className="text-xs text-foreground">{ds.date}</span>
                    {ds.issue_count > 0 && (
                      <span className="text-[10px] text-red-400">이상 {ds.issue_count}건</span>
                    )}
                  </div>
                  {isAdmin && (
                    <button
                      onClick={() => setInspectionReview.mutate({ date: ds.date, status: reviewed ? "미점검" : "점검완료" })}
                      disabled={setInspectionReview.isPending}
                      className={`text-[10px] px-2 py-1 rounded border transition-colors shrink-0 ${reviewed ? "border-border text-muted-foreground hover:border-amber-500/40 hover:text-amber-400" : "border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"}`}
                    >
                      {reviewed ? "미점검으로" : "점검완료"}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {inspectionSummary && inspectionSummary.issueCount > 0 && (!inspectionPending || inspectionPending.length === 0) && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2 mb-2 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
            <span className="text-xs text-red-400">이상 항목 {inspectionSummary.issueCount}건 발견</span>
          </div>
        )}
        {inspectionSummary && inspectionSummary.latestByArea.length > 0 ? (
          <div className="space-y-1.5">
            {inspectionSummary.latestByArea.map((item: any) => {
              const facilityOk = item.facilityStatus === "정상";
              const hygieneOk = item.hygieneStatus === "양호";
              const hasIssue = !facilityOk || !hygieneOk;
              return (
                <div key={item.area} className={`bg-card border rounded-xl px-3 py-2.5 ${hasIssue ? "border-red-500/30" : "border-border"}`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-foreground">{item.area}</span>
                    <span className="text-[11px] text-muted-foreground">{item.date}</span>
                  </div>
                  <div className="flex gap-3 text-xs">
                    <span className={facilityOk ? "text-emerald-400" : "text-red-400"}>시설: {item.facilityStatus}</span>
                    <span className={hygieneOk ? "text-emerald-400" : "text-amber-400"}>위생: {item.hygieneStatus}</span>
                    {item.actionStatus && <span className="text-muted-foreground">조치: {item.actionStatus}</span>}
                  </div>
                  {item.issueNote && <p className="text-[11px] text-muted-foreground mt-1 line-clamp-1">{item.issueNote}</p>}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-card border border-border rounded-xl p-4 text-center">
            <p className="text-xs text-muted-foreground">이번 달 점검 기록이 없습니다</p>
            <p className="text-[11px] text-muted-foreground mt-1">데이터 기록 → 센터 탭에서 점검을 입력하세요</p>
          </div>
        )}
      </div>

      {/* ── 점검 이력 추이 차트 ── */}
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1.5">
          <TrendingUp className="h-4 w-4 text-blue-400" /> 점검 이력 추이
        </h3>
        {inspectionTrend && inspectionTrend.length > 1 ? (
          <div className="bg-card border border-border rounded-xl p-3">
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={inspectionTrend.map((d: any) => ({
                date: d.date.substring(5),
                정상: d.total - d.issues,
                이상: d.issues,
              }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#888" }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "#888" }} width={24} />
                <Tooltip contentStyle={{ background: "#1a1a2e", border: "1px solid #333", borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="정상" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} />
                <Bar dataKey="이상" stackId="a" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <div className="flex justify-center gap-4 mt-1">
              <span className="text-[10px] text-muted-foreground flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-emerald-500 inline-block" /> 정상</span>
              <span className="text-[10px] text-muted-foreground flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-red-500 inline-block" /> 이상</span>
            </div>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-xl p-4 text-center">
            <p className="text-xs text-muted-foreground">2일 이상 점검 데이터가 쌓이면 추이가 표시됩니다</p>
          </div>
        )}
      </div>

      {/* ── 구역별 이상 빈도 순위 ── */}
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1.5">
          <Target className="h-4 w-4 text-orange-400" /> 구역별 이상 빈도
          {inspectionAreaStats && inspectionAreaStats.length > 0 && inspectionAreaStats.some((a: any) => a.total_issues > 0) && (
            <span className="text-xs text-muted-foreground font-normal">
              (최다: {inspectionAreaStats[0].area})
            </span>
          )}
        </h3>
        {inspectionAreaStats && inspectionAreaStats.length > 0 ? (
          <div className="space-y-1.5">
            {inspectionAreaStats.map((area: any, idx: number) => {
              const maxIssues = Math.max(...inspectionAreaStats.map((a: any) => a.total_issues), 1);
              const pct = area.total_checks > 0 ? Math.round(area.total_issues / area.total_checks * 100) : 0;
              const barW = maxIssues > 0 ? Math.round(area.total_issues / maxIssues * 100) : 0;
              return (
                <div key={area.area} className="bg-card border border-border rounded-xl px-3 py-2">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      {idx < 3 && area.total_issues > 0 && (
                        <span className={`text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center ${
                          idx === 0 ? "bg-red-500/20 text-red-400" : idx === 1 ? "bg-orange-500/20 text-orange-400" : "bg-amber-500/20 text-amber-400"
                        }`}>{idx + 1}</span>
                      )}
                      <span className="text-xs font-medium text-foreground">{area.area}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-muted-foreground">{area.total_checks}회 점검</span>
                      <span className={`text-xs font-semibold ${area.total_issues > 0 ? "text-red-400" : "text-emerald-400"}`}>
                        {area.total_issues > 0 ? `이상 ${area.total_issues}건 (${pct}%)` : "이상 없음"}
                      </span>
                    </div>
                  </div>
                  {area.total_issues > 0 && (
                    <>
                      <div className="w-full bg-muted/30 rounded-full h-1.5 mb-1">
                        <div className="h-1.5 rounded-full bg-gradient-to-r from-red-500 to-orange-500 transition-all" style={{ width: `${barW}%` }} />
                      </div>
                      <div className="flex gap-3 text-[10px] text-muted-foreground">
                        {area.facility_issues > 0 && <span>시설 {area.facility_issues}건</span>}
                        {area.hygiene_issues > 0 && <span>위생 {area.hygiene_issues}건</span>}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-card border border-border rounded-xl p-4 text-center">
            <p className="text-xs text-muted-foreground">점검 데이터가 쌓이면 구역별 통계가 표시됩니다</p>
          </div>
        )}
      </div>

      {/* 1. 센터 방문 요약 */}
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-1.5">
          <Activity className="h-4 w-4 text-amber-400" /> 센터 방문 요약
        </h3>
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="bg-card border border-border rounded-xl p-3 text-center">
            <p className="text-[10px] text-muted-foreground">월 총 방문</p>
            <p className="text-lg font-bold text-amber-400">{totalVisits.toLocaleString()}회</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-3 text-center">
            <p className="text-[10px] text-muted-foreground">일 평균</p>
            <p className="text-lg font-bold text-foreground">{avgDaily}회</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-3 text-center">
            <p className="text-[10px] text-muted-foreground">전월 대비</p>
            {changeRate !== null ? (
              <p className={`text-lg font-bold ${changeRate >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {changeRate >= 0 ? "+" : ""}{changeRate}%
              </p>
            ) : (
              <p className="text-lg font-bold text-muted-foreground">-</p>
            )}
          </div>
        </div>
        {dailyVisits.length > 0 && (
          <div className="bg-card border border-border rounded-xl p-4">
            <p className="text-xs text-muted-foreground mb-2">일별 방문 추이</p>
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={dailyVisits.map((d: any) => ({ name: d.day.substring(8), count: d.count }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" />
                <YAxis tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" width={30} />
                <Tooltip
                  contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                  labelFormatter={(v: string) => `${currentMonth}-${v}`}
                  formatter={(v: number) => [`${v}회`, "방문"]}
                />
                <Line type="monotone" dataKey="count" stroke="#f59e0b" strokeWidth={2} dot={{ r: 2, fill: "#f59e0b" }} label={{ fontSize: 9, fill: "#f59e0b", position: "top", offset: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* 2. 회원 이용률 */}
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-1.5">
          <Users className="h-4 w-4 text-amber-400" /> 회원 이용률
        </h3>
        <div className="grid grid-cols-2 gap-2 mb-2">
          {[
            { label: "활성 회원", value: activeCount, color: "text-foreground", type: "" },
            { label: "7일내 방문", value: visited7, color: "text-emerald-400", type: "visited7" },
            { label: "14일내 방문", value: visited14, color: "text-blue-400", type: "visited14" },
            { label: "30일내 방문", value: visited30, color: "text-violet-400", type: "visited30" },
          ].map(c => (
            <div key={c.label}
              onClick={() => c.type && setUtilModal({ type: c.type, title: c.label })}
              className={`bg-card border border-border rounded-xl p-3 text-center ${c.type ? "cursor-pointer hover:border-amber-500/30 active:scale-[0.98] transition-all" : ""}`}>
              <p className="text-[10px] text-muted-foreground">{c.label}</p>
              <p className={`text-lg font-bold ${c.color}`}>{c.value}명</p>
            </div>
          ))}
        </div>
        {(notVisited14 > 0 || notVisited30 > 0) && (
          <div className="grid grid-cols-2 gap-2">
            <div onClick={() => setUtilModal({ type: "notVisited14", title: "14일 미방문 (이탈 주의)" })}
              className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-3 text-center cursor-pointer hover:border-yellow-500/40 active:scale-[0.98] transition-all">
              <p className="text-[10px] text-yellow-400 flex items-center justify-center gap-1">
                <AlertCircle className="h-3 w-3" /> 14일 미방문
              </p>
              <p className="text-lg font-bold text-yellow-400">{notVisited14}명</p>
              <p className="text-[10px] text-muted-foreground">이탈 주의</p>
            </div>
            <div onClick={() => setUtilModal({ type: "notVisited30", title: "30일 미방문 (이탈 위험)" })}
              className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-center cursor-pointer hover:border-red-500/40 active:scale-[0.98] transition-all">
              <p className="text-[10px] text-red-400 flex items-center justify-center gap-1">
                <UserX className="h-3 w-3" /> 30일 미방문
              </p>
              <p className="text-lg font-bold text-red-400">{notVisited30}명</p>
              <p className="text-[10px] text-muted-foreground">이탈 위험</p>
            </div>
          </div>
        )}
      </div>

      {/* 3. 평균 방문 빈도 */}
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-1.5">
          <Target className="h-4 w-4 text-amber-400" /> 평균 방문 빈도
          <span className="text-xs text-muted-foreground font-normal">(최근 30일)</span>
        </h3>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-muted-foreground">전체 평균</span>
            <span className="text-lg font-bold text-amber-400">주 {avgWeekly}회</span>
          </div>
          <div className="space-y-2">
            {bucketCounts.map(b => (
              <div key={b.label}>
                <div className="flex items-center justify-between text-xs mb-0.5">
                  <span className="text-muted-foreground">{b.label}</span>
                  <span className="text-foreground font-medium">
                    {b.count}명 ({Math.round(b.count / totalMembersFreq * 100)}%)
                  </span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-amber-400 rounded-full transition-all" style={{ width: `${(b.count / maxBucketCount) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 4. 시간대별 혼잡도 */}
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-1.5">
          <Clock className="h-4 w-4 text-amber-400" /> 시간대별 혼잡도
        </h3>
        {blockStats.length > 0 && (
          <>
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2 mb-3 text-center">
              <span className="text-xs text-amber-400 font-medium flex items-center justify-center gap-1">
                <Clock className="h-3 w-3" /> 피크타임: {peakBlock.label}시 (평균 {peakBlock.avg}회/일)
              </span>
            </div>
            <div className="bg-card border border-border rounded-xl p-4 mb-2">
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={blockStats}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" />
                  <YAxis tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" width={30} />
                  <Tooltip
                    contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                    formatter={(v: number, name: string) => [
                      `${v}회`,
                      name === "avg" ? "일 평균" : "최대",
                    ]}
                  />
                  <Legend formatter={(v: string) => v === "avg" ? "일 평균" : "최대"} />
                  <Bar dataKey="avg" fill="#f59e0b" radius={[4, 4, 0, 0]} label={{ position: "top", fontSize: 10, fill: "#f59e0b" }} />
                  <Bar dataKey="max" fill="rgba(245,158,11,0.3)" radius={[4, 4, 0, 0]} label={{ position: "top", fontSize: 10, fill: "#9ca3af" }} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left py-2 px-3 text-muted-foreground font-medium">시간대</th>
                    <th className="text-right py-2 px-3 text-muted-foreground font-medium">평균</th>
                    <th className="text-right py-2 px-3 text-muted-foreground font-medium">최대</th>
                    <th className="text-right py-2 px-3 text-muted-foreground font-medium">비율</th>
                  </tr>
                </thead>
                <tbody>
                  {blockStats.map(b => (
                    <tr key={b.label} className={`border-b border-border/50 ${b === peakBlock ? "bg-amber-500/5" : ""}`}>
                      <td className={`py-2 px-3 font-medium ${b === peakBlock ? "text-amber-400" : "text-foreground"}`}>{b.label}시</td>
                      <td className="text-right py-2 px-3 text-foreground">{b.avg}회</td>
                      <td className="text-right py-2 px-3 text-foreground">{b.max}회</td>
                      <td className="text-right py-2 px-3 text-amber-400 font-medium">{b.pct}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* 5. 요일별 혼잡도 */}
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-1.5">
          <Dumbbell className="h-4 w-4 text-amber-400" /> 요일별 혼잡도
        </h3>
        <div className="flex gap-2 mb-3 justify-center flex-wrap">
          <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
            가장 많은 요일: {busiestDow.label}요일
          </span>
          <span className="text-xs px-2.5 py-1 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/20">
            한산한 요일: {quietestDow.label}요일
          </span>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 mb-2">
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={dowData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
              <YAxis tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" width={30} />
              <Tooltip
                contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                formatter={(v: number) => [`${v}회`, "총 방문"]}
              />
              <Bar dataKey="total" fill="#f59e0b" radius={[4, 4, 0, 0]} label={{ position: "top", fontSize: 10, fill: "#f59e0b" }} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left py-2 px-3 text-muted-foreground font-medium">요일</th>
                <th className="text-right py-2 px-3 text-muted-foreground font-medium">총 방문</th>
                <th className="text-right py-2 px-3 text-muted-foreground font-medium">일 평균</th>
                <th className="text-right py-2 px-3 text-muted-foreground font-medium">비율</th>
              </tr>
            </thead>
            <tbody>
              {dowData.map(d => (
                <tr key={d.label} className={`border-b border-border/50 ${d === busiestDow ? "bg-emerald-500/5" : d === quietestDow ? "bg-blue-500/5" : ""}`}>
                  <td className={`py-2 px-3 font-medium ${d === busiestDow ? "text-emerald-400" : d === quietestDow ? "text-blue-400" : "text-foreground"}`}>{d.label}요일</td>
                  <td className="text-right py-2 px-3 text-foreground">{d.total}회</td>
                  <td className="text-right py-2 px-3 text-foreground">{d.avg}회</td>
                  <td className="text-right py-2 px-3 text-amber-400 font-medium">{d.pct}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 해지 현황 */}
      {consultantData && consultantData.length > 0 && (() => {
        const totalChurn = consultantData.reduce((s: number, r: any) => s + (r.churnCount ?? 0), 0);
        const allReasons = consultantData.flatMap((r: any) => r.churnReasons ?? []);
        const reasonCounts: Record<string, number> = {};
        allReasons.forEach((reason: string) => { reasonCounts[reason] = (reasonCounts[reason] ?? 0) + 1; });
        const memos = consultantData.filter((r: any) => r.memo).map((r: any) => ({ name: r.creatorName, memo: r.memo }));
        if (totalChurn === 0 && !memos.length) return null;
        return (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Activity className="h-4 w-4 text-amber-400" /> 해지 현황
              <span className="text-xs text-muted-foreground font-normal">(컨설턴트 기록)</span>
            </h3>
            {totalChurn > 0 && (
              <div className="bg-card border border-border rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">해지 상담 건수</span>
                  <span className="text-lg font-bold text-red-400">{totalChurn}건</span>
                </div>
                {Object.keys(reasonCounts).length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(reasonCounts).sort((a, b) => b[1] - a[1]).map(([r, c]) => (
                      <span key={r} className="text-xs px-2.5 py-1 rounded-full bg-red-500/15 text-red-400 border border-red-500/20">
                        {r} {c > 1 ? `x${c}` : ""}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
            {memos.map((m: any, i: number) => (
              <div key={i} className="bg-card border border-border rounded-xl px-4 py-3">
                <p className="text-xs text-muted-foreground mb-1">{m.name} - 메모</p>
                <p className="text-sm text-foreground whitespace-pre-wrap">{m.memo}</p>
              </div>
            ))}
          </div>
        );
      })()}

      {/* 이용률 회원 명단 모달 */}
      {utilModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50" onClick={() => setUtilModal(null)}>
          <div className="bg-card border border-border rounded-t-2xl sm:rounded-2xl w-full max-w-lg max-h-[75vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
              <h3 className="text-sm font-semibold text-foreground">{utilModal.title}</h3>
              <button onClick={() => setUtilModal(null)} className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 p-3">
              {utilLoading ? (
                <p className="text-sm text-muted-foreground text-center py-8">로딩 중...</p>
              ) : !utilMembers?.length ? (
                <p className="text-sm text-muted-foreground text-center py-8">해당 회원이 없습니다</p>
              ) : (
                <>
                  <p className="text-xs text-muted-foreground mb-2 px-1">총 {utilMembers.length}명</p>
                  <div className="space-y-1.5">
                    {utilMembers.map((m: any) => (
                      <div key={m.id}
                        onClick={() => { setUtilModal(null); setLocation(`/members/${m.id}`); }}
                        className="flex items-center justify-between bg-background border border-border rounded-xl px-3 py-2.5 cursor-pointer hover:border-amber-500/30 active:scale-[0.99] transition-all">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground">{m.name}</p>
                          {m.phone && <p className="text-xs text-muted-foreground">{fmtPhone(m.phone)}</p>}
                        </div>
                        <p className="text-[11px] text-muted-foreground shrink-0 ml-2">
                          {m.last_visit ? m.last_visit.substring(0, 10) : "방문 기록 없음"}
                        </p>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── 앱 현황 탭 ──────────────────────────────────────────────────────────────
function AppTab() {
  const now = new Date();
  const [selYear, setSelYear] = useState(now.getFullYear());
  const [selMonth, setSelMonth] = useState(now.getMonth() + 1);
  const [viewMode, setViewMode] = useState<ViewMode>("monthly");
  const isCurrentMonth = selYear === now.getFullYear() && selMonth === now.getMonth() + 1;

  const { data, isLoading } = trpc.gym.appStats.summary.useQuery({
    year: selYear,
    ...(viewMode === "monthly" ? { month: selMonth } : {}),
  });

  const [showMemberPoints, setShowMemberPoints] = useState(false);
  const [showTxLog, setShowTxLog] = useState(false);

  return (
    <div className="space-y-4">
      <PeriodSelector viewMode={viewMode} setViewMode={setViewMode}
        year={selYear} setYear={setSelYear} month={selMonth} setMonth={setSelMonth}
        isCurrentMonth={isCurrentMonth} />

      {isLoading ? (
        <p className="text-center text-muted-foreground py-12 text-sm">로딩 중...</p>
      ) : !data ? (
        <p className="text-center text-muted-foreground py-12 text-sm">데이터 없음</p>
      ) : (
        <div className="space-y-4">
          {/* 앱 가입 현황 */}
          <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Smartphone className="h-4 w-4 text-cyan-400" />
              앱 가입 현황
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "총 가입자", value: `${data.totalMembers}명`, color: "text-foreground" },
                { label: "활성 회원", value: `${data.activeMembers}명`, color: "text-emerald-400" },
                { label: "최근 활동 (30일)", value: `${data.recentActive}명`, color: "text-blue-400" },
                { label: "비활성 (30일+)", value: `${data.inactive30}명`, color: data.inactive30 > 0 ? "text-yellow-400" : "text-muted-foreground" },
              ].map(s => (
                <div key={s.label} className="bg-background border border-border rounded-xl p-3">
                  <p className="text-[11px] text-muted-foreground">{s.label}</p>
                  <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* 일일 앱 활동 */}
          <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Activity className="h-4 w-4 text-emerald-400" />
              앱 이용 현황
            </h3>
            {/* 오늘 + 기간 요약 */}
            <div className="grid grid-cols-2 gap-2">
              {viewMode === "monthly" && (
                <>
                  <div className="bg-background border border-border rounded-xl p-3">
                    <p className="text-[11px] text-muted-foreground">오늘 입장</p>
                    <p className="text-lg font-bold text-emerald-400">{data.todayCheckins}명</p>
                  </div>
                  <div className="bg-background border border-border rounded-xl p-3">
                    <p className="text-[11px] text-muted-foreground">오늘 운동기록</p>
                    <p className="text-lg font-bold text-blue-400">{data.todayWorkouts}명</p>
                  </div>
                </>
              )}
              <div className="bg-background border border-border rounded-xl p-3">
                <p className="text-[11px] text-muted-foreground">{viewMode === "monthly" ? `${selMonth}월` : `${selYear}년`} 총 입장</p>
                <p className="text-lg font-bold text-foreground">{data.totalCheckins}회</p>
              </div>
              <div className="bg-background border border-border rounded-xl p-3">
                <p className="text-[11px] text-muted-foreground">{viewMode === "monthly" ? `${selMonth}월` : `${selYear}년`} 운동기록</p>
                <p className="text-lg font-bold text-foreground">{data.totalWorkouts}건</p>
              </div>
            </div>
            {/* 일별 추이 차트 */}
            {data.dailyActivity.length > 0 && (
              <div className="h-48 mt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.dailyActivity} barGap={1}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="day" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
                      tickFormatter={(v: string) => viewMode === "monthly" ? v.substring(8) + "일" : v.substring(5, 7) + "월"} />
                    <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                      labelFormatter={(v: string) => v} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="checkins" name="입장" fill="#10b981" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="workouts" name="운동기록" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* 앱 설치 현황 */}
          <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Bookmark className="h-4 w-4 text-pink-400" />
              앱 설치 현황 (바탕화면 저장)
            </h3>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-background border border-border rounded-xl p-3 space-y-1">
                <p className="text-[11px] text-muted-foreground">총 설치 회원</p>
                <p className="text-2xl font-bold text-pink-400">{data.appInstalls?.total ?? 0}<span className="text-xs text-muted-foreground ml-1">명</span></p>
                <p className="text-[11px] text-muted-foreground">전체 {data.totalMembers}명 중</p>
              </div>
              <div className="bg-background border border-border rounded-xl p-3 space-y-1">
                <p className="text-[11px] text-muted-foreground">{viewMode === "monthly" ? `${selMonth}월` : `${selYear}년`} 신규 설치</p>
                <p className="text-2xl font-bold text-foreground">{data.appInstalls?.period ?? 0}<span className="text-xs text-muted-foreground ml-1">명</span></p>
                <p className="text-[11px] text-muted-foreground">설치율 {data.totalMembers > 0 ? Math.round(((data.appInstalls?.total ?? 0) / data.totalMembers) * 100) : 0}%</p>
              </div>
            </div>
            {(data.appInstalls?.byDevice?.length ?? 0) > 0 && (
              <div className="flex gap-2 flex-wrap">
                {data.appInstalls.byDevice.map((d: any) => (
                  <span key={d.device} className="text-[11px] bg-background border border-border rounded-full px-2 py-0.5 text-muted-foreground">
                    {d.device}: {d.count}명
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* 포인트 현황 */}
          <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Coins className="h-4 w-4 text-amber-400" />
              포인트 현황
            </h3>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: "전체 보유", value: `${data.totalPoints.toLocaleString()}P`, color: "text-foreground" },
                { label: viewMode === "monthly" ? `${selMonth}월 적립` : `${selYear}년 적립`, value: `+${data.earnedPoints.toLocaleString()}P`, color: "text-emerald-400" },
                { label: viewMode === "monthly" ? `${selMonth}월 사용` : `${selYear}년 사용`, value: `-${data.spentPoints.toLocaleString()}P`, color: "text-red-400" },
              ].map(s => (
                <div key={s.label} className="bg-background border border-border rounded-xl p-3">
                  <p className="text-[11px] text-muted-foreground">{s.label}</p>
                  <p className={`text-base font-bold ${s.color}`}>{s.value}</p>
                </div>
              ))}
            </div>

            {/* 연간: 포인트 추이 차트 */}
            {viewMode === "annual" && data.pointTrend.length > 0 && (
              <div className="h-48 mt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.pointTrend} barGap={2}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="earned" name="적립" fill="#10b981" radius={[4, 4, 0, 0]}>
                      <LabelList dataKey="earned" position="top" style={{ fontSize: 9, fill: "#10b981" }} />
                    </Bar>
                    <Bar dataKey="spent" name="사용" fill="#ef4444" radius={[4, 4, 0, 0]}>
                      <LabelList dataKey="spent" position="top" style={{ fontSize: 9, fill: "#ef4444" }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* 회원별 보유 포인트 */}
            <button
              onClick={() => setShowMemberPoints(!showMemberPoints)}
              className="text-xs text-primary underline hover:text-primary/70"
            >
              회원별 보유 포인트 {showMemberPoints ? "접기" : "보기"}
            </button>
            {showMemberPoints && data.memberPoints.length > 0 && (
              <div className="space-y-1 max-h-64 overflow-y-auto">
                {data.memberPoints.map((m: any) => (
                  <div key={m.id} className="flex items-center justify-between bg-background border border-border rounded-lg px-3 py-2">
                    <div>
                      <p className="text-sm font-medium text-foreground">{m.name}</p>
                      {m.phone && <p className="text-[11px] text-muted-foreground">{fmtPhone(m.phone)}</p>}
                    </div>
                    <p className="text-sm font-bold text-amber-400">{m.points.toLocaleString()}P</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 요청 현황 */}
          <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <ArrowUpDown className="h-4 w-4 text-violet-400" />
              요청 현황
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {/* 재등록 요청 */}
              <div className="bg-background border border-border rounded-xl p-3 space-y-2">
                <div className="flex items-center gap-1.5">
                  <Gift className="h-3.5 w-3.5 text-violet-400" />
                  <p className="text-xs font-medium text-foreground">재등록 신청</p>
                </div>
                <p className="text-2xl font-bold text-foreground">{data.renewals.total}<span className="text-xs text-muted-foreground ml-1">건</span></p>
                <div className="flex gap-2 text-[11px]">
                  {data.renewals.pending > 0 && <span className="text-yellow-400">대기 {data.renewals.pending}</span>}
                  {data.renewals.approved > 0 && <span className="text-emerald-400">승인 {data.renewals.approved}</span>}
                  {data.renewals.rejected > 0 && <span className="text-red-400">거절 {data.renewals.rejected}</span>}
                  {data.renewals.total === 0 && <span className="text-muted-foreground">없음</span>}
                </div>
              </div>
              {/* 포인트 연장 */}
              <div className="bg-background border border-border rounded-xl p-3 space-y-2">
                <div className="flex items-center gap-1.5">
                  <CalendarPlus className="h-3.5 w-3.5 text-cyan-400" />
                  <p className="text-xs font-medium text-foreground">포인트 연장</p>
                </div>
                <p className="text-2xl font-bold text-foreground">{data.extensions.total}<span className="text-xs text-muted-foreground ml-1">건</span></p>
                <div className="text-[11px] space-y-0.5">
                  {data.extensions.total > 0 ? (<>
                    <p className="text-amber-400">{data.extensions.pointsUsed.toLocaleString()}P 사용</p>
                    <p className="text-cyan-400">{data.extensions.daysExtended}일 연장</p>
                  </>) : (
                    <p className="text-muted-foreground">없음</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* 최근 포인트 거래 내역 */}
          <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
            <button
              onClick={() => setShowTxLog(!showTxLog)}
              className="text-sm font-semibold text-foreground flex items-center gap-2 w-full"
            >
              <Activity className="h-4 w-4 text-blue-400" />
              최근 포인트 거래
              <span className="text-[11px] text-primary ml-auto">{showTxLog ? "접기" : "펼치기"}</span>
            </button>
            {showTxLog && data.recentTransactions.length > 0 && (
              <div className="space-y-1 max-h-72 overflow-y-auto">
                {data.recentTransactions.map((tx: any, i: number) => (
                  <div key={i} className="flex items-center justify-between bg-background border border-border rounded-lg px-3 py-2">
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-foreground">{tx.memberName ?? "알 수 없음"}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{tx.description}</p>
                    </div>
                    <div className="text-right shrink-0 ml-2">
                      <p className={`text-sm font-bold ${tx.type === 'spend' ? 'text-red-400' : 'text-emerald-400'}`}>
                        {tx.type === 'spend' ? '' : '+'}{tx.amount.toLocaleString()}P
                      </p>
                      <p className="text-[10px] text-muted-foreground">{tx.createdAt?.substring(0, 10)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {showTxLog && data.recentTransactions.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">거래 내역이 없습니다</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── 탭 정의 ──────────────────────────────────────────────────────────────────
const TABS = [
  { key: "finance", label: "재무", icon: TrendingUp, activeClass: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  { key: "customer", label: "고객", icon: Users, activeClass: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  { key: "marketing", label: "마케팅", icon: Megaphone, activeClass: "bg-violet-500/15 text-violet-400 border-violet-500/30" },
  { key: "operations", label: "센터 운영", icon: Building2, activeClass: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
  { key: "app", label: "앱 현황", icon: Smartphone, activeClass: "bg-cyan-500/15 text-cyan-400 border-cyan-500/30" },
] as const;

type TabKey = typeof TABS[number]["key"];

export default function DataManagementPage() {
  const [tab, setTab] = useState<TabKey>("finance");

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold flex items-center gap-2">
        <Database className="h-5 w-5 text-primary" />
        데이터 관리
      </h1>
      <div className="grid grid-cols-5 gap-2">
        {TABS.map(t => {
          const Icon = t.icon;
          const isActive = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex flex-col items-center gap-1 py-3 rounded-xl text-xs font-medium border transition-colors ${isActive ? t.activeClass : "bg-card border-border text-muted-foreground hover:text-foreground hover:bg-accent"}`}
            >
              <Icon className={`h-4 w-4 ${isActive ? "" : "opacity-60"}`} />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === "finance" && <FinanceTab />}
      {tab === "customer" && <CustomerTab />}
      {tab === "marketing" && <MarketingTab />}
      {tab === "operations" && <OperationsTab />}
      {tab === "app" && <AppTab />}
    </div>
  );
}
