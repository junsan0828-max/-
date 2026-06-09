import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const PLAN_STYLES = {
  free: { label: "FREE", color: "text-gray-500" },
  pro: { label: "PRO", color: "text-blue-500" },
  elite: { label: "ELITE", color: "text-purple-500" },
} as const;

type PlanKey = keyof typeof PLAN_STYLES;

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">플랜 관리</h1>
        <p className="text-sm text-muted-foreground mt-0.5">구독료 및 플랜별 회원 수 한도를 설정합니다.</p>
      </div>

      {/* 구독료 설정 */}
      <Card className="bg-card border-border">
        <CardContent className="p-5 space-y-4">
          <div>
            <p className="text-sm font-semibold">플랜별 월 구독료</p>
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
                    type="number" min={0} max={9999999}
                    value={priceDraft?.[plan] ?? String(prices?.[plan] ?? "")}
                    onChange={e => setPriceDraft(prev => ({
                      free: String(prices?.free ?? 0),
                      pro: String(prices?.pro ?? 29000),
                      elite: String(prices?.elite ?? 59000),
                      ...prev,
                      [plan]: e.target.value,
                    }))}
                    className="h-9 text-sm bg-input border-border"
                  />
                  <span className="text-xs text-muted-foreground shrink-0">원</span>
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="flex-1"
              onClick={() => setPriceDraft(null)}>
              취소
            </Button>
            <Button size="sm" className="flex-1"
              disabled={updatePricesMutation.isPending || !priceDraft}
              onClick={() => {
                if (!priceDraft) return;
                updatePricesMutation.mutate({
                  free: parseInt(priceDraft.free) || (prices?.free ?? 0),
                  pro: parseInt(priceDraft.pro) || (prices?.pro ?? 29000),
                  elite: parseInt(priceDraft.elite) || (prices?.elite ?? 59000),
                });
              }}>
              {updatePricesMutation.isPending ? "저장 중..." : "저장"}
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
            <Button size="sm" variant="outline" className="flex-1"
              onClick={() => setLimitDraft(null)}>
              취소
            </Button>
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
