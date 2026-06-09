import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { CheckCircle, Clock, XCircle } from "lucide-react";

const PLAN_STYLES = {
  free: { label: "FREE", color: "text-gray-500" },
  pro: { label: "PRO", color: "text-blue-500" },
  elite: { label: "ELITE", color: "text-purple-500" },
} as const;

type PlanKey = keyof typeof PLAN_STYLES;

function calcDiscounted(price: number, discount: number) {
  return Math.round(price * (1 - discount / 100));
}

export default function AdminPlans() {
  const utils = trpc.useUtils();

  // ── 구독료 ──
  const { data: prices } = trpc.fitStepPlus.admin_getPlanPrices.useQuery();
  const [priceDraft, setPriceDraft] = useState<{ free: string; pro: string; elite: string } | null>(null);
  const updatePricesMutation = trpc.fitStepPlus.admin_updatePlanPrices.useMutation({
    onSuccess: () => {
      toast.success("구독료가 저장되었습니다.");
      utils.fitStepPlus.admin_getPlanPrices.invalidate();
      setPriceDraft(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  // ── 할인율 ──
  const { data: discounts } = trpc.fitStepPlus.admin_getPlanDiscounts.useQuery();
  const [discountDraft, setDiscountDraft] = useState<{ free: string; pro: string; elite: string } | null>(null);
  const updateDiscountsMutation = trpc.fitStepPlus.admin_updatePlanDiscounts.useMutation({
    onSuccess: () => {
      toast.success("할인율이 저장되었습니다.");
      utils.fitStepPlus.admin_getPlanDiscounts.invalidate();
      setDiscountDraft(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  // ── 회원 수 한도 ──
  const { data: limits } = trpc.fitStepPlus.admin_getMemberLimits.useQuery();
  const [limitDraft, setLimitDraft] = useState<{ free: string; pro: string; elite: string } | null>(null);
  const updateLimitsMutation = trpc.fitStepPlus.admin_updateMemberLimits.useMutation({
    onSuccess: () => {
      toast.success("플랜 인원 한도가 저장되었습니다.");
      utils.fitStepPlus.admin_getMemberLimits.invalidate();
      setLimitDraft(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  // ── 플랜 구매 신청 목록 ──
  const { data: purchaseRequests, refetch: refetchRequests } = trpc.fitStepPlus.admin_listPlanPurchaseRequests.useQuery({ trainerId: undefined });
  const approveMutation = trpc.fitStepPlus.admin_approvePlanPurchase.useMutation({
    onSuccess: () => { toast.success("플랜이 승인되었습니다."); refetchRequests(); },
    onError: (e: any) => toast.error(e.message),
  });
  const rejectMutation = trpc.fitStepPlus.admin_rejectPlanPurchase.useMutation({
    onSuccess: () => { toast.success("신청이 거절되었습니다."); refetchRequests(); },
    onError: (e: any) => toast.error(e.message),
  });

  const currentPrices = { free: prices?.free ?? 0, pro: prices?.pro ?? 29000, elite: prices?.elite ?? 59000 };
  const currentDiscounts = { free: discounts?.free ?? 0, pro: discounts?.pro ?? 0, elite: discounts?.elite ?? 0 };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">플랜 관리</h1>
        <p className="text-sm text-muted-foreground mt-0.5">구독료, 할인율 및 플랜별 회원 수 한도를 설정합니다.</p>
      </div>

      {/* 플랜 구매 신청 */}
      {purchaseRequests && purchaseRequests.length > 0 && (
        <Card className="bg-card border-orange-500/30">
          <CardContent className="p-5 space-y-3">
            <p className="text-sm font-semibold text-orange-400">플랜 구매 신청 대기 {purchaseRequests.length}건</p>
            {purchaseRequests.map(req => (
              <div key={req.id} className="flex items-center justify-between gap-3 p-3 rounded-lg bg-orange-500/10 border border-orange-500/20">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{req.trainerName}</p>
                  <p className="text-xs text-muted-foreground">
                    {req.plan.toUpperCase()} · {req.amount.toLocaleString()}원 · 입금자: {req.depositor}
                  </p>
                  <p className="text-xs text-muted-foreground">{req.createdAt.slice(0, 16).replace("T", " ")}</p>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <Button size="sm" variant="outline" className="h-7 px-2 text-xs border-red-500/40 text-red-400 hover:bg-red-500/10"
                    disabled={rejectMutation.isPending}
                    onClick={() => rejectMutation.mutate({ requestId: req.id })}>
                    거절
                  </Button>
                  <Button size="sm" className="h-7 px-2 text-xs"
                    disabled={approveMutation.isPending}
                    onClick={() => approveMutation.mutate({ requestId: req.id, trainerId: req.trainerId, plan: req.plan as "pro" | "elite" })}>
                    승인
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* 구독료 설정 */}
      <Card className="bg-card border-border">
        <CardContent className="p-5 space-y-4">
          <div>
            <p className="text-sm font-semibold">플랜별 월 구독료</p>
            <p className="text-xs text-muted-foreground mt-0.5">변경 시 모든 STEPER에게 즉시 적용됩니다.</p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {(["free", "pro", "elite"] as PlanKey[]).map(plan => {
              const disc = parseInt(discountDraft?.[plan] ?? String(currentDiscounts[plan]));
              const price = parseInt(priceDraft?.[plan] ?? String(currentPrices[plan])) || 0;
              const discounted = disc > 0 ? calcDiscounted(price, disc) : null;
              return (
                <div key={plan} className="space-y-1">
                  <label className={`text-xs font-bold ${PLAN_STYLES[plan].color}`}>
                    {PLAN_STYLES[plan].label}
                  </label>
                  <div className="flex items-center gap-1">
                    <Input
                      type="number" min={0} max={9999999}
                      value={priceDraft?.[plan] ?? String(currentPrices[plan])}
                      onChange={e => setPriceDraft(prev => ({
                        free: String(currentPrices.free),
                        pro: String(currentPrices.pro),
                        elite: String(currentPrices.elite),
                        ...prev,
                        [plan]: e.target.value,
                      }))}
                      className="h-9 text-sm bg-input border-border"
                    />
                    <span className="text-xs text-muted-foreground shrink-0">원</span>
                  </div>
                  {discounted !== null && (
                    <p className="text-xs text-green-400">→ {discounted.toLocaleString()}원</p>
                  )}
                </div>
              );
            })}
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="flex-1" onClick={() => setPriceDraft(null)}>취소</Button>
            <Button size="sm" className="flex-1"
              disabled={updatePricesMutation.isPending || !priceDraft}
              onClick={() => {
                if (!priceDraft) return;
                updatePricesMutation.mutate({
                  free: parseInt(priceDraft.free) || currentPrices.free,
                  pro: parseInt(priceDraft.pro) || currentPrices.pro,
                  elite: parseInt(priceDraft.elite) || currentPrices.elite,
                });
              }}>
              {updatePricesMutation.isPending ? "저장 중..." : "저장"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 할인율 설정 */}
      <Card className="bg-card border-border">
        <CardContent className="p-5 space-y-4">
          <div>
            <p className="text-sm font-semibold">플랜별 할인율</p>
            <p className="text-xs text-muted-foreground mt-0.5">0이면 할인 없음. 설정 시 구매 화면에 할인가가 표시됩니다.</p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {(["free", "pro", "elite"] as PlanKey[]).map(plan => (
              <div key={plan} className="space-y-1">
                <label className={`text-xs font-bold ${PLAN_STYLES[plan].color}`}>
                  {PLAN_STYLES[plan].label}
                </label>
                <div className="flex items-center gap-1">
                  <Input
                    type="number" min={0} max={100}
                    value={discountDraft?.[plan] ?? String(currentDiscounts[plan])}
                    onChange={e => setDiscountDraft(prev => ({
                      free: String(currentDiscounts.free),
                      pro: String(currentDiscounts.pro),
                      elite: String(currentDiscounts.elite),
                      ...prev,
                      [plan]: e.target.value,
                    }))}
                    className="h-9 text-sm bg-input border-border"
                  />
                  <span className="text-xs text-muted-foreground shrink-0">%</span>
                </div>
              </div>
            ))}
          </div>

          {/* 실시간 미리보기 */}
          <div className="rounded-xl border border-border overflow-hidden">
            <div className="grid grid-cols-4 bg-accent/30 px-3 py-2 text-[11px] font-semibold text-muted-foreground">
              <span>플랜</span>
              <span className="text-right">정가</span>
              <span className="text-right">할인율</span>
              <span className="text-right">최종 금액</span>
            </div>
            {(["free", "pro", "elite"] as PlanKey[]).map(plan => {
              const disc = parseInt(discountDraft?.[plan] ?? String(currentDiscounts[plan])) || 0;
              const price = currentPrices[plan];
              const final = disc > 0 ? calcDiscounted(price, disc) : price;
              const saved = price - final;
              return (
                <div key={plan} className="grid grid-cols-4 items-center px-3 py-2.5 border-t border-border/50 text-sm">
                  <span className={`text-xs font-bold ${PLAN_STYLES[plan].color}`}>{PLAN_STYLES[plan].label}</span>
                  <span className="text-right text-xs text-muted-foreground">
                    {price > 0 ? `${price.toLocaleString()}원` : "무료"}
                  </span>
                  <span className={`text-right text-xs font-medium ${disc > 0 ? "text-red-400" : "text-muted-foreground"}`}>
                    {disc > 0 ? `-${disc}%` : "—"}
                  </span>
                  <div className="text-right">
                    <p className={`text-sm font-bold ${disc > 0 ? "text-green-400" : ""}`}>
                      {price > 0 ? `${final.toLocaleString()}원` : "무료"}
                    </p>
                    {saved > 0 && (
                      <p className="text-[10px] text-red-400">{saved.toLocaleString()}원 절약</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="flex-1" onClick={() => setDiscountDraft(null)}>취소</Button>
            <Button size="sm" className="flex-1"
              disabled={updateDiscountsMutation.isPending || !discountDraft}
              onClick={() => {
                if (!discountDraft) return;
                updateDiscountsMutation.mutate({
                  free: parseInt(discountDraft.free) || 0,
                  pro: parseInt(discountDraft.pro) || 0,
                  elite: parseInt(discountDraft.elite) || 0,
                });
              }}>
              {updateDiscountsMutation.isPending ? "저장 중..." : "저장"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 회원 수 한도 설정 */}
      <Card className="bg-card border-border">
        <CardContent className="p-5 space-y-4">
          <div>
            <p className="text-sm font-semibold">플랜별 회원 수 한도</p>
            <p className="text-xs text-muted-foreground mt-0.5">변경 시 모든 STEPER에게 즉시 적용됩니다.</p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {(["free", "pro", "elite"] as PlanKey[]).map(plan => (
              <div key={plan} className="space-y-1">
                <label className={`text-xs font-bold ${PLAN_STYLES[plan].color}`}>
                  {PLAN_STYLES[plan].label}
                </label>
                <div className="flex items-center gap-1">
                  <Input
                    type="number" min={1} max={9999}
                    value={limitDraft?.[plan] ?? String(limits?.[plan] ?? "")}
                    onChange={e => setLimitDraft(prev => ({
                      free: String(limits?.free ?? 7),
                      pro: String(limits?.pro ?? 15),
                      elite: String(limits?.elite ?? 35),
                      ...prev,
                      [plan]: e.target.value,
                    }))}
                    className="h-9 text-sm bg-input border-border"
                  />
                  <span className="text-xs text-muted-foreground shrink-0">명</span>
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="flex-1" onClick={() => setLimitDraft(null)}>취소</Button>
            <Button size="sm" className="flex-1"
              disabled={updateLimitsMutation.isPending || !limitDraft}
              onClick={() => {
                if (!limitDraft) return;
                updateLimitsMutation.mutate({
                  free: parseInt(limitDraft.free) || (limits?.free ?? 7),
                  pro: parseInt(limitDraft.pro) || (limits?.pro ?? 15),
                  elite: parseInt(limitDraft.elite) || (limits?.elite ?? 35),
                });
              }}>
              {updateLimitsMutation.isPending ? "저장 중..." : "저장"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
