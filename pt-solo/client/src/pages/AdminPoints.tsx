import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Coins, ChevronDown, ChevronUp, CheckCircle, Clock, XCircle, Zap, Gift, ToggleLeft, ToggleRight } from "lucide-react";
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

  const { data: pointData, refetch } = trpc.admin.getTrainerPoints.useQuery(
    { trainerId: trainer.trainerId },
    { enabled: open }
  );

  const grantMutation = trpc.admin.grantPoints.useMutation({
    onSuccess: () => {
      toast.success(`${trainer.trainerName}에게 ${Number(amount).toLocaleString()}P 지급 완료`);
      setAmount(""); setMemo("");
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
              <Button
                size="sm" className="h-8 px-3 shrink-0"
                disabled={!amount || grantMutation.isPending}
                onClick={() => grantMutation.mutate({ trainerId: trainer.trainerId, amount: Number(amount), memo: memo || undefined })}
              >
                지급
              </Button>
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
                {pointData.logs.filter(l => l.type !== "daily_reset").slice(0, 8).map(log => (
                  <div key={log.id} className="flex items-center gap-2 text-xs py-1 border-b border-border/40 last:border-0">
                    {log.status === "completed" && <CheckCircle className="h-3 w-3 text-green-400 shrink-0" />}
                    {log.status === "pending" && <Clock className="h-3 w-3 text-yellow-400 shrink-0" />}
                    {log.status === "rejected" && <XCircle className="h-3 w-3 text-red-400 shrink-0" />}
                    <span className="flex-1 text-muted-foreground">{TYPE_LABEL[log.type] ?? log.type}{log.memo ? ` · ${log.memo}` : ""}</span>
                    <span className="text-muted-foreground/60">{log.createdAt.slice(0, 10)}</span>
                    <span className={`font-semibold ${log.amount > 0 ? "text-green-400" : "text-red-400"}`}>
                      {log.amount > 0 ? "+" : ""}{log.amount.toLocaleString()}P
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function AdminPoints() {
  const [search, setSearch] = useState("");
  const { data: trainers, isLoading } = trpc.admin.listTrainersWithPoints.useQuery();
  const { data: rules, refetch: refetchRules } = trpc.admin.getAutoRules.useQuery();

  const updateRule = trpc.admin.updateAutoRule.useMutation({
    onSuccess: () => { toast.success("규칙이 저장되었습니다."); refetchRules(); },
    onError: e => toast.error(e.message),
  });

  const [editAmounts, setEditAmounts] = useState<Record<string, string>>({});

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
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" />자동 포인트 지급 규칙
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-0.5">조건 충족 시 트레이너에게 자동으로 포인트가 지급됩니다</p>
        </CardHeader>
        <CardContent className="space-y-3">
          {!rules && <p className="text-xs text-muted-foreground py-4 text-center">로딩 중...</p>}
          {rules?.map(rule => {
            const editVal = editAmounts[rule.event] ?? String(rule.amount);
            return (
              <div key={rule.event} className={`rounded-xl border p-3 transition-colors ${rule.isEnabled ? "border-primary/30 bg-primary/5" : "border-border bg-accent/10"}`}>
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <Gift className="h-3.5 w-3.5 text-primary shrink-0" />
                      <span className="text-sm font-semibold">{rule.label}</span>
                    </div>
                    {rule.description && <p className="text-xs text-muted-foreground">{rule.description}</p>}
                  </div>
                  <button
                    onClick={() => updateRule.mutate({ event: rule.event, amount: Number(editVal) || rule.amount, isEnabled: !rule.isEnabled })}
                    className="shrink-0 mt-0.5"
                  >
                    {rule.isEnabled
                      ? <ToggleRight className="h-6 w-6 text-primary" />
                      : <ToggleLeft className="h-6 w-6 text-muted-foreground" />}
                  </button>
                </div>
                {rule.isEnabled && (
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-xs text-muted-foreground shrink-0">지급 포인트</span>
                    <Input
                      type="number" min="0"
                      value={editVal}
                      onChange={e => setEditAmounts(p => ({ ...p, [rule.event]: e.target.value }))}
                      className="h-7 text-sm w-24 bg-background border-border"
                    />
                    <span className="text-xs text-muted-foreground">P</span>
                    {editVal !== String(rule.amount) && (
                      <Button size="sm" className="h-7 px-3 text-xs"
                        onClick={() => {
                          updateRule.mutate({ event: rule.event, amount: Number(editVal), isEnabled: true });
                          setEditAmounts(p => ({ ...p, [rule.event]: editVal }));
                        }}>
                        저장
                      </Button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
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
