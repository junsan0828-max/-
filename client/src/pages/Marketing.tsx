import { useState } from "react";
import { trpc } from "../lib/trpc";
import { toast } from "sonner";
import { Plus, Users, DollarSign, Percent, Megaphone, Pencil, ChevronLeft, ChevronRight, TrendingUp } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from "recharts";

const CHANNEL_TYPES = [
  { value: "online", label: "온라인", color: "bg-blue-400/10 text-blue-400" },
  { value: "sns", label: "SNS", color: "bg-pink-400/10 text-pink-400" },
  { value: "referral", label: "소개", color: "bg-emerald-400/10 text-emerald-400" },
  { value: "offline", label: "오프라인", color: "bg-amber-400/10 text-amber-400" },
];

const COLORS = ["#6366f1", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#06b6d4", "#6b7280", "#f97316"];

function fmtWon(v: number) {
  if (v >= 100000000) return `${(v / 100000000).toFixed(1)}억`;
  if (v >= 10000000) return `${(v / 10000000).toFixed(1)}천만`;
  if (v >= 10000) return `${Math.round(v / 10000)}만`;
  return v.toLocaleString();
}

export default function MarketingPage() {
  const utils = trpc.useUtils();
  const { data: me } = trpc.auth.me.useQuery();
  const isSubAdmin = me?.role === "sub_admin";
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [tab, setTab] = useState<"month" | "annual">("month");
  const [showChannelForm, setShowChannelForm] = useState(false);
  const [channelForm, setChannelForm] = useState({ name: "", type: "online", description: "" });
  const [editChannel, setEditChannel] = useState<{ id: number; name: string; type: string; description: string } | null>(null);

  const { data: channels, isLoading } = trpc.gym.channels.list.useQuery();
  const { data: monthStats } = trpc.gym.leads.statsByMonth.useQuery({ year, month });
  const { data: channelRevSummary } = trpc.gym.revenue.channelSummary.useQuery({ year, month });
  const { data: annualData } = trpc.gym.revenue.channelAnnual.useQuery({ year });

  const createChannelMutation = trpc.gym.channels.create.useMutation({
    onSuccess: () => { toast.success("채널이 추가되었습니다"); utils.gym.channels.invalidate(); setShowChannelForm(false); setChannelForm({ name: "", type: "online", description: "" }); },
    onError: (e) => toast.error(e.message),
  });
  const updateChannelMutation = trpc.gym.channels.update.useMutation({
    onSuccess: () => { toast.success("수정되었습니다"); utils.gym.channels.invalidate(); setEditChannel(null); },
    onError: (e) => toast.error(e.message),
  });
  const deleteChannelMutation = trpc.gym.channels.delete.useMutation({
    onSuccess: () => { toast.success("삭제되었습니다"); utils.gym.channels.invalidate(); setEditChannel(null); },
    onError: (e) => toast.error(e.message),
  });

  function prevMonth() {
    if (month === 1) { setYear(y => y - 1); setMonth(12); }
    else setMonth(m => m - 1);
  }
  function nextMonth() {
    if (month === 12) { setYear(y => y + 1); setMonth(1); }
    else setMonth(m => m + 1);
  }

  // 월별 채널 데이터
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

  // 연간 월별 라인차트 데이터
  const annualLineData = Array.from({ length: 12 }, (_, i) => {
    const m = i + 1;
    const mt = annualData?.monthTotals[m];
    return {
      name: `${m}월`,
      매출: Math.round((mt?.revenue ?? 0) / 10000),
      리드: mt?.leads ?? 0,
      등록: mt?.registered ?? 0,
    };
  });

  const annualTotalRevenue = annualData?.channels.reduce((s, c) => s + c.totalRevenue, 0) ?? 0;
  const annualTotalLeads = annualData?.channels.reduce((s, c) => s + c.totalLeads, 0) ?? 0;
  const annualTotalReg = annualData?.channels.reduce((s, c) => s + c.totalRegistered, 0) ?? 0;

  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">마케팅 퍼널</h1>
          <p className="text-xs text-muted-foreground">채널별 전환 및 매출 분석</p>
        </div>
        <button onClick={() => setShowChannelForm(true)}
          className="flex items-center gap-1.5 bg-primary text-primary-foreground px-3 py-2 rounded-lg text-sm font-medium hover:bg-primary/90">
          <Plus className="h-4 w-4" /> 채널 추가
        </button>
      </div>

      {/* 탭 */}
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

      {/* ── 월별 탭 ── */}
      {tab === "month" && (
        <>
          {/* 월 네비게이터 */}
          <div className="flex items-center justify-between bg-card border border-border rounded-xl px-4 py-2.5">
            <button onClick={prevMonth} className="p-1 text-muted-foreground hover:text-foreground">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="font-semibold text-foreground">{year}년 {month}월</span>
            <button onClick={nextMonth} className="p-1 text-muted-foreground hover:text-foreground">
              <ChevronRight className="w-5 h-5" />
            </button>
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

          {/* 채널별 리드/등록 차트 */}
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

          {/* 채널 카드 목록 */}
          <div className="space-y-2">
            <h2 className="text-sm font-semibold text-foreground">채널별 상세</h2>
            {isLoading ? (
              <div className="text-center text-muted-foreground py-8">로딩 중...</div>
            ) : channelData.length === 0 ? (
              <div className="text-center text-muted-foreground py-12">
                <Megaphone className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">채널이 없습니다</p>
              </div>
            ) : (
              channelData.map(ch => {
                const typeInfo = CHANNEL_TYPES.find(t => t.value === ch.type);
                const convRate = ch.leads > 0 ? Math.round((ch.registered / ch.leads) * 100) : 0;
                return (
                  <div key={ch.id} className="bg-card border border-border rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: ch.color }} />
                        <span className="font-medium text-foreground">{ch.name}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded-full ${typeInfo?.color}`}>{typeInfo?.label}</span>
                      </div>
                      <button onClick={() => setEditChannel({ id: ch.id, name: ch.name, type: ch.type, description: "" })}
                        className="text-muted-foreground hover:text-foreground p-1.5 rounded-lg hover:bg-muted/40 transition-colors">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
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
              })
            )}
          </div>
        </>
      )}

      {/* ── 연간 누적 탭 ── */}
      {tab === "annual" && (
        <>
          {/* 연도 선택 */}
          <div className="flex items-center justify-between bg-card border border-border rounded-xl px-4 py-2.5">
            <button onClick={() => setYear(y => y - 1)} className="p-1 text-muted-foreground hover:text-foreground">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="font-semibold text-foreground">{year}년 연간 통계</span>
            <button onClick={() => setYear(y => y + 1)} className="p-1 text-muted-foreground hover:text-foreground">
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* 연간 요약 카드 */}
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

          {/* 월별 추이 차트 */}
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

          {/* 월별 리드/등록 차트 */}
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
                              ) : (
                                <span className="text-muted-foreground/30">—</span>
                              )}
                            </td>
                          );
                        })}
                        <td className="text-center py-2 pl-1 pr-2">
                          <div className="font-bold text-foreground">{fmtWon(ch.totalRevenue)}</div>
                          <div className="text-muted-foreground">{ch.totalLeads}건</div>
                        </td>
                      </tr>
                    ))}
                    {/* 합계 행 */}
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

          {/* 채널별 연간 순위 */}
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

      {/* 채널 수정 모달 */}
      {editChannel && (
        <div className="fixed inset-0 z-[200] bg-black/60 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md">
            <div className="border-b border-border px-4 py-3 flex items-center justify-between">
              <h2 className="font-semibold text-foreground">채널 수정</h2>
              <button onClick={() => setEditChannel(null)} className="text-muted-foreground hover:text-foreground">✕</button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="text-xs text-muted-foreground">채널명 *</label>
                <input value={editChannel.name} onChange={e => setEditChannel(f => f && ({ ...f, name: e.target.value }))}
                  className="w-full mt-1 bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">채널 유형</label>
                <div className="flex gap-2 mt-1">
                  {CHANNEL_TYPES.map(t => (
                    <button key={t.value} type="button" onClick={() => setEditChannel(f => f && ({ ...f, type: t.value }))}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors ${editChannel.type === t.value ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border text-muted-foreground"}`}>
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <button type="button"
                  onClick={() => { if (!editChannel.name.trim()) return toast.error("채널명을 입력해주세요"); updateChannelMutation.mutate({ id: editChannel.id, name: editChannel.name, type: editChannel.type }); }}
                  className="flex-1 bg-primary text-primary-foreground rounded-lg py-2.5 text-sm font-medium hover:bg-primary/90">
                  저장
                </button>
                {!isSubAdmin && (
                  <button type="button"
                    onClick={() => { if (confirm(`"${editChannel.name}" 채널을 삭제하시겠습니까?\n연결된 리드 데이터는 유지됩니다.`)) deleteChannelMutation.mutate({ id: editChannel.id }); }}
                    className="px-4 border border-red-500/30 text-red-400 rounded-lg py-2.5 text-sm font-medium hover:bg-red-500/10">
                    삭제
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 채널 추가 폼 */}
      {showChannelForm && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md flex flex-col" style={{ maxHeight: "90vh" }}>
            <div className="border-b border-border px-4 py-3 flex items-center justify-between shrink-0">
              <h2 className="font-semibold text-foreground">채널 추가</h2>
              <button onClick={() => setShowChannelForm(false)} className="text-muted-foreground hover:text-foreground">✕</button>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); if (!channelForm.name.trim()) return toast.error("채널명을 입력해주세요"); createChannelMutation.mutate(channelForm); }} className="flex flex-col flex-1 min-h-0">
              <div className="overflow-y-auto flex-1 min-h-0 p-4 space-y-3">
                <div>
                  <label className="text-xs text-muted-foreground">채널명 *</label>
                  <input value={channelForm.name} onChange={e => setChannelForm(f => ({ ...f, name: e.target.value }))} placeholder="예: 인스타그램"
                    className="w-full mt-1 bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">채널 유형</label>
                  <div className="flex gap-2 mt-1">
                    {CHANNEL_TYPES.map(t => (
                      <button key={t.value} type="button" onClick={() => setChannelForm(f => ({ ...f, type: t.value }))}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors ${channelForm.type === t.value ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border text-muted-foreground"}`}>
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">설명</label>
                  <input value={channelForm.description} onChange={e => setChannelForm(f => ({ ...f, description: e.target.value }))} placeholder="채널 설명"
                    className="w-full mt-1 bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
                </div>
              </div>
              <div className="p-4 border-t border-border shrink-0">
                <button type="submit" className="w-full bg-primary text-primary-foreground rounded-lg py-2.5 text-sm font-medium hover:bg-primary/90">
                  추가
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
