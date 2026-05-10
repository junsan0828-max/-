import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Coins, Plus, Clock, CheckCircle, XCircle } from "lucide-react";
import TabBanner from "@/components/TabBanner";

const TYPE_LABEL: Record<string, string> = {
  admin_grant: "관리자 지급",
  charge_request: "충전 신청",
  usage: "사용",
};

const STATUS_ICON: Record<string, React.ReactNode> = {
  completed: <CheckCircle className="h-3.5 w-3.5 text-green-400 shrink-0" />,
  pending: <Clock className="h-3.5 w-3.5 text-yellow-400 shrink-0" />,
  rejected: <XCircle className="h-3.5 w-3.5 text-red-400 shrink-0" />,
};

const STATUS_TEXT: Record<string, string> = {
  completed: "완료",
  pending: "대기",
  rejected: "거절",
};

export default function FitPoints() {
  const utils = trpc.useUtils();
  const { data: balanceData } = trpc.fitPoints.getBalance.useQuery();
  const { data: history } = trpc.fitPoints.getHistory.useQuery();

  const [chargeAmount, setChargeAmount] = useState("");
  const [chargeMemo, setChargeMemo] = useState("");
  const [showForm, setShowForm] = useState(false);

  const requestCharge = trpc.fitPoints.requestCharge.useMutation({
    onSuccess: () => {
      toast.success("충전 신청이 완료되었습니다.");
      setChargeAmount("");
      setChargeMemo("");
      setShowForm(false);
      utils.fitPoints.getHistory.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const balance = balanceData?.balance ?? 0;

  return (
    <div className="space-y-4">
      <TabBanner tabKey="fitpoints" />

      <div>
        <h1 className="text-xl font-bold">FIT POINT</h1>
        <p className="text-sm text-muted-foreground mt-0.5">포인트 잔액 및 내역</p>
      </div>

      {/* 잔액 카드 */}
      <Card className="bg-primary/10 border-primary/30">
        <CardContent className="p-6 flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center shrink-0">
            <Coins className="h-7 w-7 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground mb-1">보유 FIT POINT</p>
            <p className="text-3xl font-black text-primary tracking-tight">
              {balance.toLocaleString()} <span className="text-base font-semibold">P</span>
            </p>
          </div>
        </CardContent>
      </Card>

      {/* 충전 신청 */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <Plus className="h-4 w-4 text-primary" />충전 신청
            </CardTitle>
            {!showForm && (
              <button onClick={() => setShowForm(true)}
                className="text-xs text-primary font-medium bg-primary/10 px-2.5 py-1 rounded-md hover:bg-primary/20 transition-colors">
                신청하기
              </button>
            )}
          </div>
        </CardHeader>
        {showForm && (
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">충전 금액 (포인트)</label>
              <Input
                type="number"
                placeholder="예: 10000"
                value={chargeAmount}
                onChange={e => setChargeAmount(e.target.value)}
                className="h-9 text-sm bg-input border-border"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">메모 (선택)</label>
              <Input
                placeholder="충전 사유"
                value={chargeMemo}
                onChange={e => setChargeMemo(e.target.value)}
                className="h-9 text-sm bg-input border-border"
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1" onClick={() => setShowForm(false)}>취소</Button>
              <Button size="sm" className="flex-1"
                disabled={!chargeAmount || requestCharge.isPending}
                onClick={() => requestCharge.mutate({ amount: Number(chargeAmount), memo: chargeMemo || undefined })}>
                {requestCharge.isPending ? "신청 중..." : "신청"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">신청 후 관리자 승인 시 포인트가 지급됩니다.</p>
          </CardContent>
        )}
      </Card>

      {/* 내역 */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">포인트 내역</CardTitle>
        </CardHeader>
        <CardContent className="space-y-0 p-0">
          {!history || history.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">내역이 없습니다.</p>
          ) : (
            history.map((log, i) => (
              <div key={log.id}
                className={`flex items-center gap-3 px-4 py-3 ${i < history.length - 1 ? "border-b border-border/50" : ""}`}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    {STATUS_ICON[log.status]}
                    <span className="text-sm font-medium">{TYPE_LABEL[log.type] ?? log.type}</span>
                    <span className="text-xs text-muted-foreground">· {STATUS_TEXT[log.status]}</span>
                  </div>
                  {log.memo && <p className="text-xs text-muted-foreground mt-0.5 truncate">{log.memo}</p>}
                  <p className="text-xs text-muted-foreground mt-0.5">{log.createdAt.slice(0, 10)}</p>
                </div>
                <span className={`text-sm font-bold shrink-0 ${log.amount > 0 ? "text-green-400" : "text-red-400"}`}>
                  {log.amount > 0 ? "+" : ""}{log.amount.toLocaleString()} P
                </span>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
