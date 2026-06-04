import { useState } from "react";
import { trpc } from "@/lib/trpc";
import {
  Database, TrendingUp, Users, Megaphone, Building2,
  ChevronLeft, ChevronRight, AlertCircle, UserX, Clock,
  Dumbbell, Lock, Shirt, UserCog, Activity, Target,
  DollarSign, Percent,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from "recharts";

const COLORS = ["#6366f1", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#06b6d4", "#6b7280", "#f97316"];

function fmtWon(v: number) {
  if (v >= 100000000) return `${(v / 100000000).toFixed(1)}억`;
  if (v >= 10000000) return `${(v / 10000000).toFixed(1)}천만`;
  if (v >= 10000) return `${Math.round(v / 10000)}만`;
  return v.toLocaleString();
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
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 bg-card border border-border rounded-xl px-3 py-2">
          <button onClick={() => setYear(y => y - 1)} className="text-muted-foreground hover:text-foreground"><ChevronLeft className="h-4 w-4" /></button>
          <span className="text-sm font-semibold w-14 text-center">{year}년</span>
          <button onClick={() => setYear(y => y + 1)} className="text-muted-foreground hover:text-foreground"><ChevronRight className="h-4 w-4" /></button>
        </div>
        {branchList && branchList.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => setBranchFilter(null)} className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${branchFilter === null ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:text-foreground"}`}>전체</button>
            {branchList.map((b: any) => (
              <button key={b.id} onClick={() => setBranchFilter(b.id)} className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${branchFilter === b.id ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:text-foreground"}`}>{b.name}</button>
            ))}
          </div>
        )}
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
  const { data: stats } = trpc.access.getAdminMemberStats.useQuery();
  const { data: expiring } = trpc.access.getAdminExpiringMembers.useQuery({ days: 30 });
  const { data: unpaid } = trpc.pt.listUnpaid.useQuery();
  const { data: activePt } = trpc.access.getActivePtPackages.useQuery();

  const totalUnpaid = (unpaid ?? []).reduce((s, p) => s + (p.unpaidAmount ?? 0), 0);
  const lowSession = (activePt ?? []).filter((p: any) => (p.totalSessions - p.usedSessions) <= 5);

  return (
    <div className="space-y-5">
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

      {/* 만료 임박 회원 */}
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1.5">
          <AlertCircle className="h-4 w-4 text-amber-400" /> 만료 임박 회원 (30일 이내)
          <span className="text-xs text-muted-foreground font-normal">({expiring?.length ?? 0}명)</span>
        </h3>
        {!expiring?.length ? (
          <p className="text-xs text-muted-foreground text-center py-4">만료 임박 회원이 없습니다</p>
        ) : (
          <div className="space-y-1.5">
            {expiring.map(m => (
              <div key={m.id} className="flex items-center justify-between bg-card border border-border rounded-xl px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">{m.name}</p>
                  <p className="text-xs text-muted-foreground">{m.trainerName ?? "담당 없음"} · 만료 {m.membershipEnd}</p>
                </div>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${m.days_left <= 7 ? "bg-red-500/20 text-red-400" : "bg-amber-500/20 text-amber-400"}`}>
                  D-{m.days_left}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 잔여 세션 5회 이하 */}
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1.5">
          <Dumbbell className="h-4 w-4 text-blue-400" /> PT 잔여 5회 이하
          <span className="text-xs text-muted-foreground font-normal">({lowSession.length}명)</span>
        </h3>
        {!lowSession.length ? (
          <p className="text-xs text-muted-foreground text-center py-4">해당 회원이 없습니다</p>
        ) : (
          <div className="space-y-1.5">
            {lowSession.slice(0, 10).map((p: any) => {
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

      {/* 미수금 */}
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1.5">
          <UserX className="h-4 w-4 text-red-400" /> 미수금 현황
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
  const [tab, setTab] = useState<"month" | "annual">("month");

  const { data: channels } = trpc.gym.channels.list.useQuery();
  const { data: monthStats } = trpc.gym.leads.statsByMonth.useQuery({ year, month });
  const { data: channelRevSummary } = trpc.gym.revenue.channelSummary.useQuery({ year, month });
  const { data: annualData } = trpc.gym.revenue.channelAnnual.useQuery({ year });
  const { data: programStats } = trpc.gym.revenue.programStats.useQuery({ year, month });
  const { data: programAnnual } = trpc.gym.revenue.programAnnual.useQuery({ year });
  const { data: consultantData } = trpc.consultantRecords.listAll.useQuery({ year, month });

  function prevMonth() { if (month === 1) { setYear(y => y - 1); setMonth(12); } else setMonth(m => m - 1); }
  function nextMonth() { if (month === 12) { setYear(y => y + 1); setMonth(1); } else setMonth(m => m + 1); }

  const channelData = (channels ?? []).map((ch, i) => {
    const leadStat = monthStats?.byChannel[ch.id];
    const revData = channelRevSummary?.find(r => r.channelName === ch.name);
    return {
      id: ch.id, name: ch.name, type: ch.type,
      leads: leadStat?.count ?? 0,
      registered: leadStat?.registered ?? 0,
      revenue: revData?.total ?? 0,
      color: COLORS[i % COLORS.length],
    };
  }).sort((a, b) => b.revenue - a.revenue);

  const totalLeads = monthStats?.total ?? 0;
  const totalRevenue = channelRevSummary?.reduce((s, r) => s + r.total, 0) ?? 0;
  const conversionRate = monthStats?.conversionRate ?? 0;

  const annualLineData = Array.from({ length: 12 }, (_, i) => {
    const m = i + 1;
    const mt = annualData?.monthTotals[m];
    return { name: `${m}월`, 매출: Math.round((mt?.revenue ?? 0) / 10000), 리드: mt?.leads ?? 0, 등록: mt?.registered ?? 0 };
  });

  const annualTotalRevenue = annualData?.channels.reduce((s, c) => s + c.totalRevenue, 0) ?? 0;
  const annualTotalLeads = annualData?.channels.reduce((s, c) => s + c.totalLeads, 0) ?? 0;
  const annualTotalReg = annualData?.channels.reduce((s, c) => s + c.totalRegistered, 0) ?? 0;

  return (
    <div className="space-y-5">
      {/* 월별 / 연간 탭 */}
      <div className="flex gap-1 bg-muted/40 rounded-xl p-1">
        <button onClick={() => setTab("month")}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${tab === "month" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}>
          월별 통계
        </button>
        <button onClick={() => setTab("annual")}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${tab === "annual" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}>
          연간 누적
        </button>
      </div>

      {/* ── 월별 ── */}
      {tab === "month" && (
        <>
          <div className="flex items-center justify-between bg-card border border-border rounded-xl px-4 py-2.5">
            <button onClick={prevMonth} className="p-1 text-muted-foreground hover:text-foreground"><ChevronLeft className="w-5 h-5" /></button>
            <span className="font-semibold text-foreground">{year}년 {month}월</span>
            <button onClick={nextMonth} className="p-1 text-muted-foreground hover:text-foreground"><ChevronRight className="w-5 h-5" /></button>
          </div>

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

          {/* 채널별 리드 & 등록 차트 */}
          {channelData.some(c => c.leads > 0 || c.revenue > 0) && (
            <div className="bg-card border border-border rounded-xl p-4">
              <h2 className="text-sm font-semibold text-foreground mb-4">채널별 리드 & 등록</h2>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={channelData.filter(c => c.leads > 0 || c.revenue > 0).map(c => ({
                  name: c.name.length > 6 ? c.name.slice(0, 6) + "…" : c.name,
                  리드: c.leads, 등록: c.registered,
                }))} barSize={14}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="name" tick={{ fontSize: 9, fill: "#9ca3af" }} />
                  <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} allowDecimals={false} />
                  <Tooltip contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #374151", borderRadius: "8px", fontSize: "12px" }} />
                  <Bar dataKey="리드" fill="#6366f1" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="등록" fill="#10b981" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* PT 프로그램별 현황 */}
          {programStats && programStats.length > 0 && (
            <div className="bg-card border border-border rounded-xl p-4">
              <h2 className="text-sm font-semibold text-foreground mb-3">PT 프로그램별 현황</h2>
              <div className="space-y-2">
                {programStats.map((prog, i) => {
                  const isEvent = prog.name.includes("이벤트");
                  const maxRev = programStats[0].revenue;
                  const pct = maxRev > 0 ? Math.round((prog.revenue / maxRev) * 100) : 0;
                  return (
                    <div key={prog.name}>
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
                    </div>
                  );
                })}
              </div>
              {(() => {
                const evList = programStats.filter(p => p.name.includes("이벤트"));
                if (!evList.length) return null;
                const evTotal = evList.reduce((s, p) => s + p.revenue, 0);
                const evCount = evList.reduce((s, p) => s + p.count, 0);
                const totalRev = programStats.reduce((s, p) => s + p.revenue, 0);
                const evPct = totalRev > 0 ? Math.round((evTotal / totalRev) * 100) : 0;
                return (
                  <div className="mt-3 pt-3 border-t border-border/40 flex items-center justify-between text-xs">
                    <span className="text-amber-400 font-medium">이벤트피티 합계</span>
                    <span className="text-foreground font-semibold">{evCount}건 · {fmtWon(evTotal)} ({evPct}%)</span>
                  </div>
                );
              })()}
            </div>
          )}

          {/* 채널별 상담 전환 */}
          {channels && channels.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1.5">
                <Target className="h-4 w-4 text-violet-400" /> 채널별 상담 전환
              </h3>
              <div className="space-y-1.5">
                {channels.map((ch: any) => {
                  const stat = monthStats?.byChannel?.[ch.id];
                  const count = stat?.count ?? 0;
                  const registered = stat?.registered ?? 0;
                  return (
                    <div key={ch.id} className="flex items-center justify-between bg-card border border-border rounded-xl px-3 py-2.5">
                      <p className="text-sm font-medium text-foreground">{ch.name}</p>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">상담 {count}건</span>
                        <span className="text-xs font-semibold text-emerald-400">등록 {registered}건</span>
                        <span className="text-xs px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-400">
                          {count > 0 ? Math.round((registered / count) * 100) : 0}%
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 채널별 성과 */}
          {channelData.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-sm font-semibold text-foreground">채널별 성과</h2>
              {channelData.map(ch => {
                const convRate = ch.leads > 0 ? Math.round((ch.registered / ch.leads) * 100) : 0;
                return (
                  <div key={ch.id} className="bg-card border border-border rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: ch.color }} />
                      <span className="font-medium text-foreground">{ch.name}</span>
                      <span className="text-xs px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">{CHANNEL_TYPE_LABELS[ch.type] ?? ch.type}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div className="text-center">
                        <div className="font-semibold text-foreground">{ch.leads}</div>
                        <div className="text-muted-foreground">리드</div>
                      </div>
                      <div className="text-center">
                        <div className="font-semibold text-emerald-400">{convRate}%</div>
                        <div className="text-muted-foreground">전환율</div>
                      </div>
                      <div className="text-center">
                        <div className="font-semibold text-primary">{fmtWon(ch.revenue)}</div>
                        <div className="text-muted-foreground">매출</div>
                      </div>
                    </div>
                  </div>
                );
              })}
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
        </>
      )}

      {/* ── 연간 누적 ── */}
      {tab === "annual" && (
        <>
          <div className="flex items-center justify-between bg-card border border-border rounded-xl px-4 py-2.5">
            <button onClick={() => setYear(y => y - 1)} className="p-1 text-muted-foreground hover:text-foreground"><ChevronLeft className="w-5 h-5" /></button>
            <span className="font-semibold text-foreground">{year}년 연간 통계</span>
            <button onClick={() => setYear(y => y + 1)} className="p-1 text-muted-foreground hover:text-foreground"><ChevronRight className="w-5 h-5" /></button>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="bg-card border border-border rounded-xl p-3 text-center">
              <Users className="h-4 w-4 text-blue-400 mx-auto mb-1" />
              <div className="text-lg font-bold text-foreground">{annualTotalLeads}</div>
              <div className="text-xs text-muted-foreground">연간 리드</div>
            </div>
            <div className="bg-card border border-border rounded-xl p-3 text-center">
              <Percent className="h-4 w-4 text-emerald-400 mx-auto mb-1" />
              <div className="text-lg font-bold text-foreground">
                {annualTotalLeads > 0 ? Math.round((annualTotalReg / annualTotalLeads) * 100) : 0}%
              </div>
              <div className="text-xs text-muted-foreground">연간 전환율</div>
            </div>
            <div className="bg-card border border-border rounded-xl p-3 text-center">
              <TrendingUp className="h-4 w-4 text-amber-400 mx-auto mb-1" />
              <div className="text-lg font-bold text-foreground">{fmtWon(annualTotalRevenue)}</div>
              <div className="text-xs text-muted-foreground">연간 매출</div>
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-4">
            <h2 className="text-sm font-semibold text-foreground mb-4">월별 매출 추이 (만원)</h2>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={annualLineData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="name" tick={{ fontSize: 9, fill: "#9ca3af" }} />
                <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} />
                <Tooltip contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #374151", borderRadius: "8px", fontSize: "12px" }} />
                <Line type="monotone" dataKey="매출" stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-card border border-border rounded-xl p-4">
            <h2 className="text-sm font-semibold text-foreground mb-4">월별 리드 & 등록</h2>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={annualLineData} barSize={10}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="name" tick={{ fontSize: 9, fill: "#9ca3af" }} />
                <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} allowDecimals={false} />
                <Tooltip contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #374151", borderRadius: "8px", fontSize: "12px" }} />
                <Legend wrapperStyle={{ fontSize: "11px" }} />
                <Bar dataKey="리드" fill="#6366f1" radius={[2, 2, 0, 0]} />
                <Bar dataKey="등록" fill="#10b981" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* 채널별 연간 누적 테이블 */}
          {annualData && annualData.channels.length > 0 && (
            <div className="bg-card border border-border rounded-xl p-4">
              <h2 className="text-sm font-semibold text-foreground mb-3">채널별 연간 누적</h2>
              <div className="overflow-x-auto -mx-2">
                <table className="w-full text-xs min-w-[560px]">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left text-muted-foreground py-2 pl-2 pr-1 font-medium w-20">채널</th>
                      {Array.from({ length: 12 }, (_, i) => (
                        <th key={i} className="text-center text-muted-foreground py-2 px-0.5 font-medium">{i + 1}월</th>
                      ))}
                      <th className="text-center text-muted-foreground py-2 pl-1 pr-2 font-medium">합계</th>
                    </tr>
                  </thead>
                  <tbody>
                    {annualData.channels.map((ch, idx) => (
                      <tr key={ch.name} className={idx % 2 === 0 ? "bg-muted/20" : ""}>
                        <td className="py-2 pl-2 pr-1 font-medium text-foreground truncate max-w-[72px]">{ch.name}</td>
                        {Array.from({ length: 12 }, (_, i) => {
                          const m = ch.months[i + 1];
                          return (
                            <td key={i} className="text-center py-2 px-0.5">
                              {m.revenue > 0 ? (
                                <div>
                                  <div className="text-primary font-semibold">{fmtWon(m.revenue)}</div>
                                  {m.leads > 0 && <div className="text-muted-foreground">{m.leads}건</div>}
                                </div>
                              ) : <span className="text-muted-foreground/30">—</span>}
                            </td>
                          );
                        })}
                        <td className="text-center py-2 pl-1 pr-2">
                          <div className="font-bold text-foreground">{fmtWon(ch.totalRevenue)}</div>
                          <div className="text-muted-foreground">{ch.totalLeads}건</div>
                        </td>
                      </tr>
                    ))}
                    <tr className="border-t border-border font-semibold">
                      <td className="py-2 pl-2 pr-1 text-foreground">합계</td>
                      {Array.from({ length: 12 }, (_, i) => {
                        const mt = annualData.monthTotals[i + 1];
                        return (
                          <td key={i} className="text-center py-2 px-0.5">
                            {mt.revenue > 0 ? (
                              <div>
                                <div className="text-primary">{fmtWon(mt.revenue)}</div>
                                {mt.leads > 0 && <div className="text-muted-foreground">{mt.leads}건</div>}
                              </div>
                            ) : <span className="text-muted-foreground/30">—</span>}
                          </td>
                        );
                      })}
                      <td className="text-center py-2 pl-1 pr-2">
                        <div className="text-primary font-bold">{fmtWon(annualTotalRevenue)}</div>
                        <div className="text-muted-foreground">{annualTotalLeads}건</div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* PT 프로그램별 월별 등록 건수 */}
          {programAnnual && programAnnual.programs.length > 0 && (
            <div className="bg-card border border-border rounded-xl p-4">
              <h2 className="text-sm font-semibold text-foreground mb-1">PT 프로그램별 월별 등록 건수</h2>
              <p className="text-xs text-muted-foreground mb-4">이벤트피티 포함 프로그램별 월별 추이</p>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={programAnnual.monthlyData} barSize={8}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="label" tick={{ fontSize: 9, fill: "#9ca3af" }} />
                  <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #374151", borderRadius: "8px", fontSize: "12px" }}
                    formatter={(value: any, name: any) => [String(value) + "건", String(name).replace("_count", "")]}
                  />
                  <Legend wrapperStyle={{ fontSize: "10px" }} formatter={(v: any) => String(v).replace("_count", "")} />
                  {programAnnual.programs.map((prog, i) => (
                    <Bar key={prog} dataKey={prog + "_count"} name={prog + "_count"}
                      fill={prog.includes("이벤트") ? "#f59e0b" : COLORS[i % COLORS.length]}
                      radius={[2, 2, 0, 0]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* 프로그램별 월별 매출 요약 테이블 */}
          {programAnnual && programAnnual.programs.length > 0 && (
            <div className="bg-card border border-border rounded-xl p-4">
              <h2 className="text-sm font-semibold text-foreground mb-3">프로그램별 월별 매출 요약</h2>
              <div className="overflow-x-auto -mx-2">
                <table className="w-full text-xs min-w-[500px]">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left text-muted-foreground py-2 pl-2 pr-1 font-medium w-20">프로그램</th>
                      {Array.from({ length: 12 }, (_, i) => (
                        <th key={i} className="text-center text-muted-foreground py-2 px-0.5 font-medium">{i + 1}월</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {programAnnual.programs.map((prog, idx) => {
                      const isEvent = prog.includes("이벤트");
                      return (
                        <tr key={prog} className={idx % 2 === 0 ? "bg-muted/20" : ""}>
                          <td className={`py-2 pl-2 pr-1 font-medium truncate max-w-[72px] ${isEvent ? "text-amber-400" : "text-foreground"}`}>{prog}</td>
                          {programAnnual.monthlyData.map((m) => {
                            const rev = m[prog + "_revenue"] as number ?? 0;
                            const cnt = m[prog + "_count"] as number ?? 0;
                            return (
                              <td key={m.month} className="text-center py-2 px-0.5">
                                {cnt > 0 ? (
                                  <div>
                                    <div className={`font-semibold ${isEvent ? "text-amber-400" : "text-primary"}`}>{cnt}건</div>
                                    <div className="text-muted-foreground">{fmtWon(rev)}</div>
                                  </div>
                                ) : <span className="text-muted-foreground/30">—</span>}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 채널별 연간 성과 순위 */}
          {annualData && annualData.channels.length > 0 && (
            <div className="bg-card border border-border rounded-xl p-4 space-y-3">
              <h2 className="text-sm font-semibold text-foreground">채널별 연간 성과 순위</h2>
              {annualData.channels.map((ch, i) => {
                const maxRev = annualData.channels[0].totalRevenue;
                const pct = maxRev > 0 ? Math.round((ch.totalRevenue / maxRev) * 100) : 0;
                const convRate = ch.totalLeads > 0 ? Math.round((ch.totalRegistered / ch.totalLeads) * 100) : 0;
                return (
                  <div key={ch.name}>
                    <div className="flex justify-between items-center mb-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-muted-foreground w-4">{i + 1}</span>
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                        <span className="text-sm font-medium text-foreground">{ch.name}</span>
                        <span className="text-xs text-muted-foreground">({ch.totalLeads}리드 · {convRate}%전환)</span>
                      </div>
                      <span className="text-sm font-bold text-primary">{fmtWon(ch.totalRevenue)}</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div className="h-2 rounded-full" style={{ width: `${pct}%`, backgroundColor: COLORS[i % COLORS.length] }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── 센터 운영 탭 ──────────────────────────────────────────────────────────────
function OperationsTab() {
  const now = new Date();
  const [year] = useState(now.getFullYear());
  const [month] = useState(now.getMonth() + 1);
  const { data: trainerList } = trpc.trainers.list.useQuery();
  const { data: lockers } = trpc.access.getLockers.useQuery();
  const { data: uniforms } = trpc.access.getUniforms.useQuery({ activeOnly: true });
  const { data: hourStats } = trpc.access.getAccessHourStats.useQuery();
  const { data: consultantData } = trpc.consultantRecords.listAll.useQuery({ year, month });

  const allLockers = (lockers ?? []) as any[];
  const occupied = allLockers.filter(l => l.isOccupied === 1);
  const allUniforms = (uniforms ?? []) as any[];

  const maxHour = (hourStats ?? []).reduce((m, h) => Math.max(m, h.count), 0);

  return (
    <div className="space-y-5">
      {/* 트레이너별 현황 */}
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1.5">
          <UserCog className="h-4 w-4 text-amber-400" /> 트레이너별 회원 현황
        </h3>
        {!trainerList?.length ? (
          <p className="text-xs text-muted-foreground text-center py-4">트레이너 정보가 없습니다</p>
        ) : (
          <div className="space-y-1.5">
            {(trainerList as any[]).map(t => (
              <div key={t.id} className="flex items-center justify-between bg-card border border-border rounded-xl px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">{t.trainerName}</p>
                  <p className="text-xs text-muted-foreground">정산 {t.settlementRate}%</p>
                </div>
                <div className="flex items-center gap-3 text-right">
                  <div>
                    <p className="text-xs text-muted-foreground">담당 회원</p>
                    <p className="text-sm font-semibold text-amber-400">{t.memberCount}명</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 락커 현황 */}
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1.5">
          <Lock className="h-4 w-4 text-amber-400" /> 락커 현황
        </h3>
        <div className="grid grid-cols-3 gap-2 mb-3">
          {[
            { label: "전체", value: allLockers.length, color: "text-foreground" },
            { label: "사용 중", value: occupied.length, color: "text-amber-400" },
            { label: "비어 있음", value: allLockers.length - occupied.length, color: "text-emerald-400" },
          ].map(c => (
            <div key={c.label} className="bg-card border border-border rounded-xl p-3 text-center">
              <p className="text-xs text-muted-foreground mb-1">{c.label}</p>
              <p className={`text-lg font-bold ${c.color}`}>{c.value}</p>
            </div>
          ))}
        </div>
        {allLockers.length > 0 && (
          <div className="bg-card border border-border rounded-xl p-3">
            <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
              <span>점유율</span>
              <span>{allLockers.length > 0 ? Math.round((occupied.length / allLockers.length) * 100) : 0}%</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-amber-400 rounded-full transition-all" style={{ width: `${allLockers.length > 0 ? (occupied.length / allLockers.length) * 100 : 0}%` }} />
            </div>
          </div>
        )}
      </div>

      {/* 운동복 현황 */}
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1.5">
          <Shirt className="h-4 w-4 text-amber-400" /> 운동복 현황 (착용 중)
          <span className="text-xs text-muted-foreground font-normal">({allUniforms.length}명)</span>
        </h3>
        {!allUniforms.length ? (
          <p className="text-xs text-muted-foreground text-center py-4">착용 중인 운동복이 없습니다</p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: "유료 대여", value: allUniforms.filter((u: any) => u.rentalType === "paid").length, color: "text-foreground" },
              { label: "서비스 대여", value: allUniforms.filter((u: any) => u.rentalType === "service").length, color: "text-violet-400" },
            ].map(c => (
              <div key={c.label} className="bg-card border border-border rounded-xl p-3 text-center">
                <p className="text-xs text-muted-foreground mb-1">{c.label}</p>
                <p className={`text-lg font-bold ${c.color}`}>{c.value}명</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 시간대별 방문 분포 */}
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1.5">
          <Clock className="h-4 w-4 text-amber-400" /> 이번달 시간대별 방문
        </h3>
        {!hourStats?.length ? (
          <p className="text-xs text-muted-foreground text-center py-4">출입 데이터가 없습니다</p>
        ) : (
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-end gap-1 h-20">
              {Array.from({ length: 24 }, (_, i) => {
                const h = hourStats.find(s => s.hour === i);
                const count = h?.count ?? 0;
                const height = maxHour > 0 ? Math.max((count / maxHour) * 100, count > 0 ? 8 : 0) : 0;
                const isPeak = count === maxHour && count > 0;
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                    <div
                      className={`w-full rounded-sm transition-all ${isPeak ? "bg-amber-400" : "bg-amber-400/40"}`}
                      style={{ height: `${height}%` }}
                      title={`${i}시: ${count}회`}
                    />
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between text-[9px] text-muted-foreground mt-1">
              <span>0시</span><span>6시</span><span>12시</span><span>18시</span><span>23시</span>
            </div>
            {maxHour > 0 && (
              <p className="text-xs text-muted-foreground mt-2 text-center">
                피크 시간: <span className="text-amber-400 font-semibold">{hourStats.find(h => h.count === maxHour)?.hour}시</span> ({maxHour}회)
              </p>
            )}
          </div>
        )}
      </div>

      {/* 컨설턴트 기록: 해지 현황 */}
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
                        {r} {c > 1 ? `×${c}` : ""}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
            {memos.map((m: any, i: number) => (
              <div key={i} className="bg-card border border-border rounded-xl px-4 py-3">
                <p className="text-xs text-muted-foreground mb-1">{m.name} · 메모</p>
                <p className="text-sm text-foreground whitespace-pre-wrap">{m.memo}</p>
              </div>
            ))}
          </div>
        );
      })()}
    </div>
  );
}

// ── 탭 정의 ──────────────────────────────────────────────────────────────────
const TABS = [
  { key: "finance", label: "재무", icon: TrendingUp, activeClass: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  { key: "customer", label: "고객", icon: Users, activeClass: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  { key: "marketing", label: "마케팅", icon: Megaphone, activeClass: "bg-violet-500/15 text-violet-400 border-violet-500/30" },
  { key: "operations", label: "센터 운영", icon: Building2, activeClass: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
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
      <div className="grid grid-cols-4 gap-2">
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
    </div>
  );
}
