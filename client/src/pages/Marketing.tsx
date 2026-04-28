import { useState } from "react";
import { trpc } from "../lib/trpc";
import { toast } from "sonner";
import { Plus, Users, DollarSign, Percent, Megaphone, Pencil } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

const CHANNEL_TYPES = [
  { value: "online", label: "온라인", color: "bg-blue-400/10 text-blue-400" },
  { value: "sns", label: "SNS", color: "bg-pink-400/10 text-pink-400" },
  { value: "referral", label: "소개", color: "bg-emerald-400/10 text-emerald-400" },
  { value: "offline", label: "오프라인", color: "bg-amber-400/10 text-amber-400" },
];

const COLORS = ["#6366f1", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#06b6d4", "#6b7280", "#f97316"];

export default function MarketingPage() {
  const utils = trpc.useUtils();
  const now = new Date();
  const [year] = useState(now.getFullYear());
  const [month] = useState(now.getMonth() + 1);
  const [showChannelForm, setShowChannelForm] = useState(false);
  const [channelForm, setChannelForm] = useState({ name: "", type: "online", description: "" });
  const [editChannel, setEditChannel] = useState<{ id: number; name: string; type: string; description: string } | null>(null);

  const { data: channels, isLoading } = trpc.gym.channels.list.useQuery();
  const { data: leadStats } = trpc.gym.leads.stats.useQuery();
  const { data: channelRevSummary } = trpc.gym.revenue.channelSummary.useQuery({ year, month });

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

  // 채널별 리드 수 + 매출 합산
  const channelData = (channels ?? []).map((ch, i) => {
    const leadCount = Object.values(leadStats?.byChannel ?? {}).find((b) => (b as any).name === ch.name);
    const revData = channelRevSummary?.find(r => r.channelName === ch.name);
    return {
      id: ch.id,
      name: ch.name,
      type: ch.type,
      leads: (leadCount as any)?.count ?? 0,
      registered: (leadCount as any)?.registered ?? 0,
      revenue: revData?.total ?? 0,
      revenueCount: revData?.count ?? 0,
      color: COLORS[i % COLORS.length],
    };
  }).sort((a, b) => b.revenue - a.revenue);

  const barData = channelData.filter(c => c.leads > 0 || c.revenue > 0).map(c => ({
    name: c.name.length > 6 ? c.name.slice(0, 6) + "…" : c.name,
    리드: c.leads,
    등록: c.registered,
    매출: Math.round(c.revenue / 10000),
    color: c.color,
  }));

  const totalLeads = channelData.reduce((s, c) => s + c.leads, 0);
  const totalRevenue = channelData.reduce((s, c) => s + c.revenue, 0);

  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">마케팅 퍼널</h1>
          <p className="text-xs text-muted-foreground">채널별 전환 및 매출 분석</p>
        </div>
        <button
          onClick={() => setShowChannelForm(true)}
          className="flex items-center gap-1.5 bg-primary text-primary-foreground px-3 py-2 rounded-lg text-sm font-medium hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          채널 추가
        </button>
      </div>

      {/* 전체 요약 */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-card border border-border rounded-xl p-3 text-center">
          <Users className="h-4 w-4 text-blue-400 mx-auto mb-1" />
          <div className="text-lg font-bold text-foreground">{totalLeads}</div>
          <div className="text-xs text-muted-foreground">총 리드</div>
        </div>
        <div className="bg-card border border-border rounded-xl p-3 text-center">
          <Percent className="h-4 w-4 text-emerald-400 mx-auto mb-1" />
          <div className="text-lg font-bold text-foreground">{leadStats?.conversionRate ?? 0}%</div>
          <div className="text-xs text-muted-foreground">전환율</div>
        </div>
        <div className="bg-card border border-border rounded-xl p-3 text-center">
          <DollarSign className="h-4 w-4 text-amber-400 mx-auto mb-1" />
          <div className="text-lg font-bold text-foreground">
            {totalRevenue >= 10000000 ? `${(totalRevenue / 10000000).toFixed(1)}천만` : totalRevenue >= 10000 ? `${Math.round(totalRevenue / 10000)}만` : totalRevenue.toLocaleString()}
          </div>
          <div className="text-xs text-muted-foreground">이달 채널 매출</div>
        </div>
      </div>

      {/* 퍼널 시각화 */}
      {leadStats && leadStats.total > 0 && (
        <div className="bg-card border border-border rounded-xl p-4">
          <h2 className="text-sm font-semibold text-foreground mb-4">전환 퍼널</h2>
          <div className="space-y-2">
            {[
              { label: "총 리드", count: leadStats.total, color: "#6366f1", pct: 100 },
              { label: "상담 완료", count: leadStats.consulted + leadStats.registered, color: "#8b5cf6", pct: Math.round(((leadStats.consulted + leadStats.registered) / leadStats.total) * 100) },
              { label: "등록 완료", count: leadStats.registered, color: "#10b981", pct: Math.round((leadStats.registered / leadStats.total) * 100) },
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
      {barData.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-4">
          <h2 className="text-sm font-semibold text-foreground mb-4">채널별 리드 & 등록</h2>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={barData} barSize={14}>
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
        <h2 className="text-sm font-semibold text-foreground">채널 목록</h2>
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
                  <button
                    onClick={() => setEditChannel({ id: ch.id, name: ch.name, type: ch.type, description: "" })}
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
                    <div className="font-semibold text-primary">
                      {ch.revenue >= 10000 ? `${Math.round(ch.revenue / 10000)}만` : ch.revenue.toLocaleString()}
                    </div>
                    <div className="text-muted-foreground">이달 매출</div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 채널 수정 모달 */}
      {editChannel && (
        <div className="fixed inset-0 z-[200] bg-black/60 flex items-end md:items-center justify-center p-4">
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
                <button
                  type="button"
                  onClick={() => { if (!editChannel.name.trim()) return toast.error("채널명을 입력해주세요"); updateChannelMutation.mutate({ id: editChannel.id, name: editChannel.name, type: editChannel.type }); }}
                  className="flex-1 bg-primary text-primary-foreground rounded-lg py-2.5 text-sm font-medium hover:bg-primary/90">
                  저장
                </button>
                <button
                  type="button"
                  onClick={() => { if (confirm(`"${editChannel.name}" 채널을 삭제하시겠습니까?\n연결된 리드 데이터는 유지됩니다.`)) deleteChannelMutation.mutate({ id: editChannel.id }); }}
                  className="px-4 border border-red-500/30 text-red-400 rounded-lg py-2.5 text-sm font-medium hover:bg-red-500/10">
                  삭제
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 채널 추가 폼 */}
      {showChannelForm && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end md:items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md">
            <div className="border-b border-border px-4 py-3 flex items-center justify-between">
              <h2 className="font-semibold text-foreground">채널 추가</h2>
              <button onClick={() => setShowChannelForm(false)} className="text-muted-foreground hover:text-foreground">✕</button>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); if (!channelForm.name.trim()) return toast.error("채널명을 입력해주세요"); createChannelMutation.mutate(channelForm); }} className="p-4 space-y-3">
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
              <button type="submit" className="w-full bg-primary text-primary-foreground rounded-lg py-2.5 text-sm font-medium hover:bg-primary/90 mt-2">
                추가
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
