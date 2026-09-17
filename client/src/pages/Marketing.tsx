import { useState } from "react";
import { trpc } from "../lib/trpc";
import { toast } from "sonner";
import { Plus, Megaphone, Pencil, TrendingUp, Users, BarChart2 } from "lucide-react";

const CHANNEL_TYPES = [
  { value: "online",   label: "온라인",  color: "bg-blue-400/10 text-blue-400" },
  { value: "sns",      label: "SNS",    color: "bg-pink-400/10 text-pink-400" },
  { value: "referral", label: "소개",   color: "bg-emerald-400/10 text-emerald-400" },
  { value: "offline",  label: "오프라인", color: "bg-amber-400/10 text-amber-400" },
];

function fmt(n: number) {
  return n >= 10000 ? `${(n / 10000).toFixed(1)}만` : n.toLocaleString();
}

function ConversionTab() {
  const now = new Date(Date.now() + 9 * 3600000);
  const [year,  setYear]  = useState<number>(now.getFullYear());
  const [month, setMonth] = useState<number | undefined>(undefined);

  const { data, isLoading } = trpc.gym.channels.conversionStats.useQuery(
    { year, month },
    { staleTime: 30000 }
  );

  const totalLeads     = (data?.channels ?? []).reduce((s, c) => s + c.leadsCount, 0)
                       + (data?.unattributed?.leadsCount ?? 0);
  const totalConverted = (data?.channels ?? []).reduce((s, c) => s + c.convertedCount, 0)
                       + (data?.unattributed?.convertedCount ?? 0);
  const totalRevNew    = (data?.channels ?? []).reduce((s, c) => s + c.revenueNew, 0);
  const overallRate    = totalLeads > 0 ? Math.round((totalConverted / totalLeads) * 100) : 0;

  const years = Array.from({ length: 4 }, (_, i) => now.getFullYear() - i);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);

  const maxLeads = Math.max(...(data?.channels ?? []).map(c => c.leadsCount), 1);

  return (
    <div className="space-y-4">
      {/* 날짜 필터 */}
      <div className="flex gap-2 flex-wrap">
        <select value={year} onChange={e => setYear(Number(e.target.value))}
          className="bg-muted/40 border border-border rounded-lg px-2 py-1.5 text-sm text-foreground">
          {years.map(y => <option key={y} value={y}>{y}년</option>)}
        </select>
        <select value={month ?? ""} onChange={e => setMonth(e.target.value ? Number(e.target.value) : undefined)}
          className="bg-muted/40 border border-border rounded-lg px-2 py-1.5 text-sm text-foreground">
          <option value="">전체 월</option>
          {months.map(m => <option key={m} value={m}>{m}월</option>)}
        </select>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "총 상담", value: totalLeads, unit: "건", color: "text-blue-400" },
          { label: "등록 전환", value: totalConverted, unit: "건", color: "text-emerald-400" },
          { label: "전환율",   value: overallRate, unit: "%", color: "text-orange-400" },
        ].map(s => (
          <div key={s.label} className="bg-muted/30 rounded-xl p-3 text-center">
            <p className={`text-2xl font-black ${s.color}`}>
              {s.value}<span className="text-xs font-medium text-muted-foreground ml-0.5">{s.unit}</span>
            </p>
            <p className="text-[10px] text-muted-foreground mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* 재등록 카드 */}
      {data && (
        <div className="bg-card border border-border rounded-xl p-3">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs font-semibold">재등록</span>
          </div>
          <div className="flex gap-4">
            <div>
              <span className="text-lg font-bold text-primary">{data.reregStats.uniqueMembers}</span>
              <span className="text-xs text-muted-foreground ml-1">명 재등록</span>
            </div>
            <div>
              <span className="text-lg font-bold text-muted-foreground">{data.reregStats.totalRereg}</span>
              <span className="text-xs text-muted-foreground ml-1">건 결제</span>
            </div>
            {totalRevNew > 0 && (
              <div className="ml-auto text-right">
                <span className="text-xs text-muted-foreground block">신규 매출</span>
                <span className="text-sm font-semibold text-foreground">{fmt(totalRevNew)}원</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 채널별 전환 퍼널 */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-muted-foreground">채널별 전환 현황</p>
        {isLoading ? (
          <div className="text-center text-muted-foreground py-6 text-sm">로딩 중...</div>
        ) : !data?.channels.length && !data?.unattributed.leadsCount ? (
          <div className="text-center text-muted-foreground py-8 text-sm">
            <BarChart2 className="h-8 w-8 mx-auto mb-2 opacity-30" />
            이 기간에 상담 데이터가 없습니다
          </div>
        ) : (
          <>
            {data?.channels.filter(c => c.leadsCount > 0 || c.revenueNew > 0).map(ch => {
              const typeInfo = CHANNEL_TYPES.find(t => t.value === ch.type);
              const barW = Math.round((ch.leadsCount / maxLeads) * 100);
              return (
                <div key={ch.id} className="bg-card border border-border rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-foreground">{ch.name}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${typeInfo?.color ?? "bg-muted text-muted-foreground"}`}>
                        {typeInfo?.label ?? ch.type}
                      </span>
                    </div>
                    <span className={`text-sm font-bold ${ch.conversionRate >= 50 ? "text-emerald-400" : ch.conversionRate >= 20 ? "text-amber-400" : "text-muted-foreground"}`}>
                      {ch.conversionRate}%
                    </span>
                  </div>

                  {/* 바 */}
                  <div className="h-1.5 bg-muted/40 rounded-full overflow-hidden">
                    <div className="h-full bg-primary/60 rounded-full transition-all" style={{ width: `${barW}%` }} />
                  </div>

                  {/* 수치 */}
                  <div className="flex gap-4 text-xs">
                    <span className="text-muted-foreground">상담 <span className="text-foreground font-medium">{ch.leadsCount}</span>건</span>
                    <span className="text-muted-foreground">등록 <span className="text-emerald-400 font-medium">{ch.convertedCount}</span>건</span>
                    {ch.revenueNew > 0 && (
                      <span className="ml-auto text-muted-foreground">신규 <span className="text-foreground font-medium">{fmt(ch.revenueNew)}원</span></span>
                    )}
                    {ch.revenueRereg > 0 && (
                      <span className="text-muted-foreground">재등록 <span className="text-primary font-medium">{fmt(ch.revenueRereg)}원</span></span>
                    )}
                  </div>
                </div>
              );
            })}

            {/* 미귀속 */}
            {(data?.unattributed?.leadsCount ?? 0) > 0 && (
              <div className="bg-muted/20 border border-dashed border-border rounded-xl p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">채널 미입력</span>
                  <span className="text-xs text-muted-foreground">
                    상담 {data!.unattributed.leadsCount}건 · 등록 {data!.unattributed.convertedCount}건
                  </span>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function MarketingPage() {
  const utils = trpc.useUtils();
  const { data: me } = trpc.auth.me.useQuery();
  const isSubAdmin = me?.role === "sub_admin";
  const { data: pageStats } = trpc.landing.getPageStats.useQuery();
  const [tab, setTab] = useState<"channels" | "conversion">("conversion");
  const [showChannelForm, setShowChannelForm] = useState(false);
  const [channelForm, setChannelForm] = useState({ name: "", type: "online", description: "" });
  const [editChannel, setEditChannel] = useState<{ id: number; name: string; type: string; description: string } | null>(null);

  const { data: channels, isLoading } = trpc.gym.channels.list.useQuery();

  const createChannelMutation = trpc.gym.channels.create.useMutation({
    onSuccess: () => {
      toast.success("채널이 추가되었습니다");
      utils.gym.channels.invalidate();
      setShowChannelForm(false);
      setChannelForm({ name: "", type: "online", description: "" });
    },
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

  return (
    <div className="space-y-4">
      {/* 랜딩페이지 방문 통계 */}
      <div className="bg-card border border-border rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Megaphone className="h-4 w-4 text-primary" />
          <h2 className="font-semibold text-sm">랜딩페이지 오늘 현황</h2>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "방문자",      value: pageStats?.todayViews    ?? 0, unit: "명", color: "text-blue-400" },
            { label: "네이버 클릭", value: pageStats?.naverClicks   ?? 0, unit: "회", color: "text-emerald-400" },
            { label: "체형분석 신청", value: pageStats?.analysisComplete ?? 0, unit: "건", color: "text-amber-400" },
          ].map((s) => (
            <div key={s.label} className="bg-muted/30 rounded-lg p-3 text-center">
              <p className={`text-2xl font-black ${s.color}`}>
                {s.value}<span className="text-xs font-medium text-muted-foreground ml-0.5">{s.unit}</span>
              </p>
              <p className="text-[10px] text-muted-foreground mt-1">{s.label}</p>
            </div>
          ))}
        </div>
        {pageStats?.daily && pageStats.daily.length > 0 && (
          <div className="pt-2 border-t border-border">
            <p className="text-[10px] text-muted-foreground mb-2">최근 14일 방문자</p>
            <div className="flex items-end gap-1 h-16">
              {pageStats.daily.map((d: { date: string; views: number }) => {
                const max = Math.max(...pageStats.daily.map((x: { views: number }) => Number(x.views)), 1);
                const h = Math.max(4, Math.round((Number(d.views) / max) * 56));
                return (
                  <div key={d.date} className="flex-1 flex flex-col items-center gap-1" title={`${d.date}: ${d.views}명`}>
                    <div className="w-full bg-primary/60 rounded-sm" style={{ height: h }} />
                    <span className="text-[8px] text-muted-foreground">{d.date.slice(5)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* 탭 */}
      <div className="flex gap-1 bg-muted/30 rounded-xl p-1">
        <button
          onClick={() => setTab("conversion")}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-colors ${tab === "conversion" ? "bg-card shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}
        >
          <TrendingUp className="h-3.5 w-3.5" />
          전환율 분석
        </button>
        <button
          onClick={() => setTab("channels")}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-colors ${tab === "channels" ? "bg-card shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}
        >
          <Users className="h-3.5 w-3.5" />
          채널 관리
        </button>
      </div>

      {/* 전환율 탭 */}
      {tab === "conversion" && <ConversionTab />}

      {/* 채널 관리 탭 */}
      {tab === "channels" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-foreground">마케팅 채널</h1>
              <p className="text-xs text-muted-foreground">유입 채널을 등록해 상담에서 채널을 선택하세요</p>
            </div>
            <button onClick={() => setShowChannelForm(true)}
              className="flex items-center gap-1.5 bg-primary text-primary-foreground px-3 py-2 rounded-lg text-sm font-medium hover:bg-primary/90">
              <Plus className="h-4 w-4" /> 채널 추가
            </button>
          </div>

          {isLoading ? (
            <div className="text-center text-muted-foreground py-8">로딩 중...</div>
          ) : !channels?.length ? (
            <div className="text-center text-muted-foreground py-12">
              <Megaphone className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">채널이 없습니다</p>
              <p className="text-xs mt-1">채널을 추가해 마케팅 데이터를 분석하세요</p>
            </div>
          ) : (
            <div className="space-y-2">
              {channels.map(ch => {
                const typeInfo = CHANNEL_TYPES.find(t => t.value === ch.type);
                return (
                  <div key={ch.id} className="bg-card border border-border rounded-xl px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-medium text-foreground">{ch.name}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full shrink-0 ${typeInfo?.color}`}>{typeInfo?.label}</span>
                      {ch.description && <span className="text-xs text-muted-foreground truncate">{ch.description}</span>}
                    </div>
                    <button onClick={() => setEditChannel({ id: ch.id, name: ch.name, type: ch.type, description: ch.description ?? "" })}
                      className="text-muted-foreground hover:text-foreground p-1.5 rounded-lg hover:bg-muted/40 transition-colors shrink-0">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
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
