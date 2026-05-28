import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Coins, ChevronDown, ChevronUp, CheckCircle, Clock, XCircle, Zap, Gift, ToggleLeft, ToggleRight, Pencil, Trash2, Plus, Check, X, Minus } from "lucide-react";
import { toast } from "sonner";

const TYPE_LABEL: Record<string, string> = {
  admin_grant: "관리자 지급",
  charge_request: "충전 신청",
  daily_reset: "일일 초기화",
  usage: "사용",
  profile_bonus: "프로필 완성",
};

function TrainerPointRow({ trainer }: { trainer: { trainerId: number; trainerName: string; username: string; balance: number; pendingAmount: number } }) {
  const utils = trpc.useUtils();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [expiresAt, setExpiresAt] = useState("");

  const { data: pointData, refetch } = trpc.admin.getTrainerPoints.useQuery(
    { trainerId: trainer.trainerId },
    { enabled: open }
  );

  const grantMutation = trpc.admin.grantPoints.useMutation({
    onSuccess: () => {
      toast.success(`${trainer.trainerName}에게 ${Number(amount).toLocaleString()}P 지급 완료`);
      setAmount(""); setMemo(""); setExpiresAt("");
      refetch();
      utils.admin.listTrainersWithPoints.invalidate();
    },
    onError: e => toast.error(e.message),
  });

  const approveMutation = trpc.admin.approveChargeRequest.useMutation({
    onSuccess: () => { toast.success("처리되었습니다."); refetch(); utils.admin.listTrainersWithPoints.invalidate(); },
    onError: e => toast.error(e.message),
  });

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <button
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-accent/30 transition-colors text-left"
        onClick={() => setOpen(v => !v)}
      >
        <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
          <span className="text-xs font-bold text-primary">{trainer.trainerName[0]}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">{trainer.trainerName}</p>
          <p className="text-xs text-muted-foreground">@{trainer.username}</p>
        </div>
        <div className="text-right shrink-0 mr-2">
          <p className="text-sm font-bold text-primary">{trainer.balance.toLocaleString()} P</p>
          {trainer.pendingAmount > 0 && (
            <p className="text-xs text-yellow-400">충전대기 {trainer.pendingAmount.toLocaleString()}P</p>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
      </button>

      {open && (
        <div className="border-t border-border bg-accent/10 p-4 space-y-4">
          {/* 수동 지급 폼 */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2">수동 포인트 지급</p>
            <div className="space-y-2">
              <div className="flex gap-2">
                <Input
                  type="number" placeholder="포인트" value={amount}
                  onChange={e => setAmount(e.target.value)}
                  className="h-8 text-sm w-28 bg-background border-border"
                />
                <Input
                  placeholder="메모 (선택)" value={memo}
                  onChange={e => setMemo(e.target.value)}
                  className="h-8 text-sm flex-1 bg-background border-border"
                />
              </div>
              <div className="flex gap-2 items-center">
                <label className="text-xs text-muted-foreground shrink-0">만료일 (선택)</label>
                <Input
                  type="date" value={expiresAt}
                  onChange={e => setExpiresAt(e.target.value)}
                  className="h-8 text-sm flex-1 bg-background border-border"
                />
                <Button
                  size="sm" className="h-8 px-3 shrink-0"
                  disabled={!amount || grantMutation.isPending}
                  onClick={() => grantMutation.mutate({ trainerId: trainer.trainerId, amount: Number(amount), memo: memo || undefined, expiresAt: expiresAt || undefined })}
                >
                  지급
                </Button>
              </div>
            </div>
          </div>

          {/* 충전 대기 승인 */}
          {pointData && pointData.logs.filter(l => l.status === "pending").length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-2">충전 신청 대기</p>
              <div className="space-y-1.5">
                {pointData.logs.filter(l => l.status === "pending").map(log => (
                  <div key={log.id} className="flex items-center gap-2 bg-background rounded-lg px-3 py-2">
                    <Clock className="h-3.5 w-3.5 text-yellow-400 shrink-0" />
                    <span className="text-sm flex-1">{log.amount.toLocaleString()} P</span>
                    {log.memo && <span className="text-xs text-muted-foreground truncate max-w-[100px]">{log.memo}</span>}
                    <div className="flex gap-1 shrink-0">
                      <Button size="sm" className="h-6 px-2 text-xs" onClick={() => approveMutation.mutate({ logId: log.id, approve: true })}>승인</Button>
                      <Button size="sm" variant="outline" className="h-6 px-2 text-xs" onClick={() => approveMutation.mutate({ logId: log.id, approve: false })}>거절</Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 최근 내역 */}
          {pointData && pointData.logs.filter(l => l.type !== "daily_reset").length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-2">최근 내역</p>
              <div className="space-y-1">
                {pointData.logs.filter(l => l.type !== "daily_reset").slice(0, 8).map(log => {
                  const expired = log.expiresAt && log.expiresAt < new Date().toISOString().slice(0, 10);
                  return (
                    <div key={log.id} className={`flex items-center gap-2 text-xs py-1 border-b border-border/40 last:border-0 ${expired ? "opacity-50" : ""}`}>
                      {log.status === "completed" && <CheckCircle className="h-3 w-3 text-green-400 shrink-0" />}
                      {log.status === "pending" && <Clock className="h-3 w-3 text-yellow-400 shrink-0" />}
                      {log.status === "rejected" && <XCircle className="h-3 w-3 text-red-400 shrink-0" />}
                      <div className="flex-1 min-w-0">
                        <span className="text-muted-foreground">{TYPE_LABEL[log.type] ?? log.type}{log.memo ? ` · ${log.memo}` : ""}</span>
                        {log.expiresAt && (
                          <span className={`ml-1.5 text-[10px] ${expired ? "text-red-400" : "text-amber-500"}`}>
                            {expired ? "만료됨" : `~${log.expiresAt}`}
                          </span>
                        )}
                      </div>
                      <span className="text-muted-foreground/60 shrink-0">{log.createdAt.slice(0, 10)}</span>
                      <span className={`font-semibold shrink-0 ${log.amount > 0 ? "text-green-400" : "text-red-400"}`}>
                        {log.amount > 0 ? "+" : ""}{log.amount.toLocaleString()}P
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

type RuleEdit = { label: string; description: string; amount: string };

function AutoRuleCard({
  rule,
  onSave,
  onToggle,
  onDelete,
  saving,
}: {
  rule: { event: string; label: string; description: string | null; amount: number; isEnabled: number };
  onSave: (event: string, v: RuleEdit) => void;
  onToggle: (event: string, enabled: boolean, amount: number) => void;
  onDelete: (event: string) => void;
  saving: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<RuleEdit>({ label: rule.label, description: rule.description ?? "", amount: String(rule.amount) });
  const isCustom = rule.event.startsWith("custom_");

  const startEdit = () => { setDraft({ label: rule.label, description: rule.description ?? "", amount: String(rule.amount) }); setEditing(true); };
  const cancelEdit = () => setEditing(false);
  const submitEdit = () => { onSave(rule.event, draft); setEditing(false); };

  return (
    <div className={`rounded-xl border transition-colors ${rule.isEnabled ? "border-primary/30 bg-primary/5" : "border-border bg-accent/10"}`}>
      {editing ? (
        <div className="p-3 space-y-2">
          <Input value={draft.label} onChange={e => setDraft(p => ({ ...p, label: e.target.value }))}
            placeholder="규칙 이름" className="h-8 text-sm bg-background border-border" />
          <Input value={draft.description} onChange={e => setDraft(p => ({ ...p, description: e.target.value }))}
            placeholder="설명 (선택)" className="h-8 text-sm bg-background border-border" />
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground shrink-0">지급 포인트</span>
            <Input type="number" min="0" value={draft.amount} onChange={e => setDraft(p => ({ ...p, amount: e.target.value }))}
              className="h-8 text-sm w-24 bg-background border-border" />
            <span className="text-xs text-muted-foreground">P</span>
          </div>
          <div className="flex gap-2 pt-1">
            <Button size="sm" className="h-7 flex-1 text-xs gap-1" disabled={!draft.label || saving} onClick={submitEdit}>
              <Check className="h-3 w-3" />저장
            </Button>
            <Button size="sm" variant="outline" className="h-7 flex-1 text-xs gap-1" onClick={cancelEdit}>
              <X className="h-3 w-3" />취소
            </Button>
          </div>
        </div>
      ) : (
        <div className="p-3">
          <div className="flex items-start gap-2">
            <Gift className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold leading-tight">{rule.label}</p>
              {rule.description && <p className="text-xs text-muted-foreground mt-0.5">{rule.description}</p>}
              {rule.isEnabled ? (
                <p className="text-xs text-primary font-medium mt-1">{rule.amount.toLocaleString()} P 지급</p>
              ) : (
                <p className="text-xs text-muted-foreground mt-1">비활성</p>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button onClick={startEdit} className="p-1 text-muted-foreground hover:text-foreground transition-colors">
                <Pencil className="h-3.5 w-3.5" />
              </button>
              {isCustom && (
                <button onClick={() => onDelete(rule.event)} className="p-1 text-muted-foreground hover:text-red-400 transition-colors">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
              <button onClick={() => onToggle(rule.event, !rule.isEnabled, rule.amount)} className="p-1">
                {rule.isEnabled
                  ? <ToggleRight className="h-6 w-6 text-primary" />
                  : <ToggleLeft className="h-6 w-6 text-muted-foreground" />}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FeatureCostRuleCard({ rule, onUpdate, saving }: {
  rule: { feature: string; label: string; cost: number; isEnabled: number };
  onUpdate: (feature: string, cost: number, isEnabled: boolean) => void;
  saving: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draftCost, setDraftCost] = useState(String(rule.cost));

  const startEdit = () => { setDraftCost(String(rule.cost)); setEditing(true); };
  const submitEdit = () => { onUpdate(rule.feature, Number(draftCost) || 0, !!rule.isEnabled); setEditing(false); };

  return (
    <div className={`rounded-xl border transition-colors ${rule.isEnabled ? "border-red-200 bg-red-50/50 dark:border-red-900/40 dark:bg-red-900/10" : "border-border bg-accent/10"}`}>
      {editing ? (
        <div className="p-3 space-y-2">
          <p className="text-xs font-semibold">{rule.label}</p>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground shrink-0">차감 포인트</span>
            <Input type="number" min="0" value={draftCost} onChange={e => setDraftCost(e.target.value)}
              className="h-8 text-sm w-24 bg-background border-border" />
            <span className="text-xs text-muted-foreground">P</span>
          </div>
          <div className="flex gap-2 pt-1">
            <Button size="sm" className="h-7 flex-1 text-xs gap-1" disabled={saving} onClick={submitEdit}>
              <Check className="h-3 w-3" />저장
            </Button>
            <Button size="sm" variant="outline" className="h-7 flex-1 text-xs gap-1" onClick={() => setEditing(false)}>
              <X className="h-3 w-3" />취소
            </Button>
          </div>
        </div>
      ) : (
        <div className="p-3">
          <div className="flex items-start gap-2">
            <Minus className="h-3.5 w-3.5 text-red-400 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold leading-tight">{rule.label}</p>
              {rule.isEnabled ? (
                <p className="text-xs text-red-500 font-medium mt-1">{rule.cost.toLocaleString()} P 차감</p>
              ) : (
                <p className="text-xs text-muted-foreground mt-1">비활성 (무료)</p>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button onClick={startEdit} className="p-1 text-muted-foreground hover:text-foreground transition-colors">
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button onClick={() => onUpdate(rule.feature, rule.cost, !rule.isEnabled)} className="p-1">
                {rule.isEnabled
                  ? <ToggleRight className="h-6 w-6 text-red-400" />
                  : <ToggleLeft className="h-6 w-6 text-muted-foreground" />}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminPoints() {
  const [search, setSearch] = useState("");
  const { data: trainers, isLoading } = trpc.admin.listTrainersWithPoints.useQuery();
  const { data: rules, refetch: refetchRules } = trpc.admin.getAutoRules.useQuery();
  const [showAddRule, setShowAddRule] = useState(false);
  const [newRule, setNewRule] = useState<RuleEdit>({ label: "", description: "", amount: "100" });

  const { data: costRules, refetch: refetchCostRules } = trpc.admin.getFeatureCostRules.useQuery();
  const updateCostRule = trpc.admin.updateFeatureCostRule.useMutation({
    onSuccess: () => { toast.success("저장되었습니다."); refetchCostRules(); },
    onError: e => toast.error(e.message),
  });

  const updateRule = trpc.admin.updateAutoRule.useMutation({
    onSuccess: () => { toast.success("저장되었습니다."); refetchRules(); },
    onError: e => toast.error(e.message),
  });
  const createRule = trpc.admin.createAutoRule.useMutation({
    onSuccess: () => { toast.success("규칙이 추가되었습니다."); setShowAddRule(false); setNewRule({ label: "", description: "", amount: "100" }); refetchRules(); },
    onError: e => toast.error(e.message),
  });
  const deleteRule = trpc.admin.deleteAutoRule.useMutation({
    onSuccess: () => { toast.success("규칙이 삭제되었습니다."); refetchRules(); },
    onError: e => toast.error(e.message),
  });

  const handleSave = (event: string, v: RuleEdit) => {
    const rule = rules?.find(r => r.event === event);
    updateRule.mutate({ event, label: v.label, description: v.description || undefined, amount: Number(v.amount) || 0, isEnabled: !!(rule?.isEnabled) });
  };
  const handleToggle = (event: string, enabled: boolean, amount: number) => {
    updateRule.mutate({ event, amount, isEnabled: enabled });
  };

  const filtered = (trainers ?? []).filter(t =>
    !search || t.trainerName.includes(search) || t.username.includes(search)
  );

  const totalBalance = (trainers ?? []).reduce((s, t) => s + t.balance, 0);
  const totalPending = (trainers ?? []).reduce((s, t) => s + t.pendingAmount, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">포인트 관리</h1>
        <p className="text-sm text-muted-foreground mt-0.5">트레이너 포인트 지급 및 자동 규칙 설정</p>
      </div>

      {/* 요약 */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="bg-primary/10 border-primary/30">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">전체 보유 포인트</p>
            <p className="text-xl font-black text-primary">{totalBalance.toLocaleString()} P</p>
          </CardContent>
        </Card>
        <Card className="bg-yellow-500/10 border-yellow-500/30">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">충전 대기 중</p>
            <p className="text-xl font-black text-yellow-400">{totalPending.toLocaleString()} P</p>
          </CardContent>
        </Card>
      </div>

      {/* 자동 지급 규칙 */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" />자동 포인트 지급 규칙
            </CardTitle>
            <button
              onClick={() => setShowAddRule(v => !v)}
              className="flex items-center gap-1 text-xs text-primary bg-primary/10 hover:bg-primary/20 border border-primary/30 px-2.5 py-1 rounded-lg transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />규칙 추가
            </button>
          </div>
          <p className="text-xs text-muted-foreground mt-1">조건 충족 시 자동으로 포인트가 지급됩니다. 연필 아이콘으로 수정, 토글로 ON/OFF</p>
        </CardHeader>
        <CardContent className="space-y-2">
          {/* 새 규칙 추가 폼 */}
          {showAddRule && (
            <div className="rounded-xl border border-primary/40 bg-primary/5 p-3 space-y-2 mb-3">
              <p className="text-xs font-semibold text-primary mb-1">새 규칙 추가</p>
              <Input value={newRule.label} onChange={e => setNewRule(p => ({ ...p, label: e.target.value }))}
                placeholder="규칙 이름 (예: 리뷰 작성)" className="h-8 text-sm bg-background border-border" />
              <Input value={newRule.description} onChange={e => setNewRule(p => ({ ...p, description: e.target.value }))}
                placeholder="조건 설명 (선택)" className="h-8 text-sm bg-background border-border" />
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground shrink-0">지급 포인트</span>
                <Input type="number" min="0" value={newRule.amount} onChange={e => setNewRule(p => ({ ...p, amount: e.target.value }))}
                  className="h-8 text-sm w-24 bg-background border-border" />
                <span className="text-xs text-muted-foreground">P</span>
              </div>
              <div className="flex gap-2 pt-1">
                <Button size="sm" className="h-7 flex-1 text-xs" disabled={!newRule.label || createRule.isPending}
                  onClick={() => createRule.mutate({ label: newRule.label, description: newRule.description || undefined, amount: Number(newRule.amount) || 0 })}>
                  추가
                </Button>
                <Button size="sm" variant="outline" className="h-7 flex-1 text-xs" onClick={() => setShowAddRule(false)}>취소</Button>
              </div>
            </div>
          )}

          {!rules && <p className="text-xs text-muted-foreground py-4 text-center">로딩 중...</p>}
          {rules?.map(rule => (
            <AutoRuleCard
              key={rule.event}
              rule={rule}
              onSave={handleSave}
              onToggle={handleToggle}
              onDelete={e => deleteRule.mutate({ event: e })}
              saving={updateRule.isPending}
            />
          ))}
        </CardContent>
      </Card>

      {/* 포인트 사용 규칙 */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Minus className="h-4 w-4 text-red-400" />포인트 사용 규칙
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">기능 사용 시 차감되는 포인트를 설정합니다. 토글로 ON/OFF, 연필로 금액 수정</p>
        </CardHeader>
        <CardContent className="space-y-2">
          {!costRules && <p className="text-xs text-muted-foreground py-4 text-center">로딩 중...</p>}
          {costRules?.map(rule => (
            <FeatureCostRuleCard
              key={rule.feature}
              rule={rule}
              onUpdate={(feature, cost, isEnabled) => updateCostRule.mutate({ feature, cost, isEnabled })}
              saving={updateCostRule.isPending}
            />
          ))}
        </CardContent>
      </Card>

      {/* 트레이너별 포인트 */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Coins className="h-4 w-4 text-primary" />트레이너별 포인트
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Input
            placeholder="트레이너 이름 또는 아이디 검색"
            value={search} onChange={e => setSearch(e.target.value)}
            className="h-9 text-sm bg-input border-border mb-3"
          />
          {isLoading && <p className="text-xs text-muted-foreground py-4 text-center">로딩 중...</p>}
          {filtered.length === 0 && !isLoading && (
            <p className="text-xs text-muted-foreground py-4 text-center">트레이너가 없습니다</p>
          )}
          {filtered.map(t => <TrainerPointRow key={t.trainerId} trainer={t} />)}
        </CardContent>
      </Card>
    </div>
  );
}
