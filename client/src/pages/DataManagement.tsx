import { useState } from "react";
import { trpc } from "@/lib/trpc";
import {
  Database, TrendingUp, Users, Megaphone, Building2,
  ChevronLeft, ChevronRight, AlertCircle, UserX, Clock,
  Dumbbell, Lock, Shirt, UserCog, PhoneCall, BarChart3,
  RefreshCw, Activity, Target,
} from "lucide-react";

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
function MarketingTab() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const { data: monthStats } = trpc.gym.leads.statsByMonth.useQuery({ year, month });
  const { data: channelSummary } = trpc.gym.revenue.channelSummary.useQuery({ year, month });

  function prevMonth() { if (month === 1) { setYear(y => y - 1); setMonth(12); } else setMonth(m => m - 1); }
  function nextMonth() { if (month === 12) { setYear(y => y + 1); setMonth(1); } else setMonth(m => m + 1); }

  return (
    <div className="space-y-5">
      {/* 월 선택 */}
      <div className="flex items-center gap-2 bg-card border border-border rounded-xl px-3 py-2 w-fit">
        <button onClick={prevMonth} className="text-muted-foreground hover:text-foreground"><ChevronLeft className="h-4 w-4" /></button>
        <span className="text-sm font-semibold w-20 text-center">{year}년 {month}월</span>
        <button onClick={nextMonth} className="text-muted-foreground hover:text-foreground"><ChevronRight className="h-4 w-4" /></button>
      </div>

      {/* 상담 현황 요약 */}
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1.5">
          <PhoneCall className="h-4 w-4 text-violet-400" /> 상담 현황
        </h3>
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: "총 상담", value: monthStats?.total ?? 0, unit: "건", color: "text-foreground" },
            { label: "등록 전환", value: monthStats?.registered ?? 0, unit: "건", color: "text-emerald-400" },
            { label: "전환율", value: monthStats?.conversionRate ?? 0, unit: "%", color: "text-violet-400" },
            { label: "팔로업 대기", value: monthStats?.followup ?? 0, unit: "건", color: "text-amber-400" },
          ].map(c => (
            <div key={c.label} className="bg-card border border-border rounded-xl p-3">
              <p className="text-xs text-muted-foreground mb-1">{c.label}</p>
              <p className={`text-lg font-bold ${c.color}`}>{c.value}<span className="text-xs font-normal ml-1">{c.unit}</span></p>
            </div>
          ))}
        </div>
      </div>

      {/* 채널별 유입 */}
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1.5">
          <BarChart3 className="h-4 w-4 text-violet-400" /> 채널별 매출 유입
        </h3>
        {!channelSummary?.length ? (
          <p className="text-xs text-muted-foreground text-center py-4">이번달 채널 데이터가 없습니다</p>
        ) : (
          <div className="space-y-1.5">
            {channelSummary.map((ch: any) => {
              const total = channelSummary.reduce((s: number, c: any) => s + c.total, 0);
              const pct = total > 0 ? Math.round((ch.total / total) * 100) : 0;
              return (
                <div key={ch.channelId ?? "none"} className="bg-card border border-border rounded-xl px-3 py-2.5">
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-sm font-medium text-foreground">{ch.channelName}</p>
                    <div className="text-right">
                      <span className="text-sm font-semibold text-violet-400">{ch.total.toLocaleString()}원</span>
                      <span className="text-xs text-muted-foreground ml-1.5">{ch.count}건</span>
                    </div>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-violet-400 rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 채널별 상담 */}
      {monthStats && Object.keys(monthStats.byChannel ?? {}).length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1.5">
            <Target className="h-4 w-4 text-violet-400" /> 채널별 상담 전환
          </h3>
          <div className="space-y-1.5">
            {Object.values(monthStats.byChannel).map((ch: any) => (
              <div key={ch.name} className="flex items-center justify-between bg-card border border-border rounded-xl px-3 py-2.5">
                <p className="text-sm font-medium text-foreground">{ch.name}</p>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">상담 {ch.count}건</span>
                  <span className="text-xs font-semibold text-emerald-400">등록 {ch.registered}건</span>
                  <span className="text-xs px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-400">
                    {ch.count > 0 ? Math.round((ch.registered / ch.count) * 100) : 0}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── 센터 운영 탭 ──────────────────────────────────────────────────────────────
function OperationsTab() {
  const { data: trainerList } = trpc.trainers.list.useQuery();
  const { data: lockers } = trpc.access.getLockers.useQuery();
  const { data: uniforms } = trpc.access.getUniforms.useQuery({ activeOnly: true });
  const { data: hourStats } = trpc.access.getAccessHourStats.useQuery();

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
