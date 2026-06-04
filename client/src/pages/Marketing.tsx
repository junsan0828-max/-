import { useState } from "react";
import { trpc } from "../lib/trpc";
import { toast } from "sonner";
import { Plus, Megaphone, Pencil } from "lucide-react";

const CHANNEL_TYPES = [
  { value: "online", label: "온라인", color: "bg-blue-400/10 text-blue-400" },
  { value: "sns", label: "SNS", color: "bg-pink-400/10 text-pink-400" },
  { value: "referral", label: "소개", color: "bg-emerald-400/10 text-emerald-400" },
  { value: "offline", label: "오프라인", color: "bg-amber-400/10 text-amber-400" },
];

export default function MarketingPage() {
  const utils = trpc.useUtils();
  const { data: me } = trpc.auth.me.useQuery();
  const isSubAdmin = me?.role === "sub_admin";
  const [showChannelForm, setShowChannelForm] = useState(false);
  const [channelForm, setChannelForm] = useState({ name: "", type: "online", description: "" });
  const [editChannel, setEditChannel] = useState<{ id: number; name: string; type: string; description: string } | null>(null);

  const { data: channels, isLoading } = trpc.gym.channels.list.useQuery();

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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">마케팅 관리</h1>
          <p className="text-xs text-muted-foreground">유입 채널 관리 · 통계는 데이터 관리에서 확인하세요</p>
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
