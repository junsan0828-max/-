import { Coins } from "lucide-react";
import { trpc } from "../lib/trpc";

interface Props {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  featureName: string;
  cost?: number;
  loading?: boolean;
}

export default function PointSpendConfirm({ open, onClose, onConfirm, featureName, cost = 50, loading }: Props) {
  const { data: balance } = trpc.fitPoints.getBalance.useQuery(undefined, { enabled: open });

  if (!open) return null;

  const hasEnough = (balance?.balance ?? 0) >= cost;

  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center md:items-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-sm mx-4 mb-6 md:mb-0 bg-card rounded-2xl shadow-2xl overflow-hidden">
        <div className="px-5 pt-5 pb-3">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Coins className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-sm text-foreground">{featureName}</p>
              <p className="text-xs text-muted-foreground">FIT 포인트를 사용합니다</p>
            </div>
          </div>

          <div className="bg-muted/50 rounded-xl p-3 space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">사용 포인트</span>
              <span className="font-semibold text-red-400">-{cost}P</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">현재 잔액</span>
              <span className={`font-semibold ${hasEnough ? "text-foreground" : "text-red-400"}`}>
                {balance?.balance ?? "..."}P
              </span>
            </div>
            {hasEnough && (
              <div className="flex justify-between border-t border-border pt-1.5">
                <span className="text-muted-foreground">사용 후 잔액</span>
                <span className="font-semibold text-foreground">{(balance?.balance ?? 0) - cost}P</span>
              </div>
            )}
          </div>

          {!hasEnough && (
            <p className="text-xs text-red-400 mt-2 text-center">포인트가 부족합니다. 충전 후 이용해 주세요.</p>
          )}
        </div>

        <div className="px-5 pb-5 flex gap-2">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl text-sm text-muted-foreground bg-muted hover:bg-accent transition-colors">
            취소
          </button>
          <button
            onClick={onConfirm}
            disabled={!hasEnough || loading}
            className="flex-1 py-3 rounded-xl text-sm font-semibold bg-primary text-primary-foreground disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? "처리 중..." : `확인 (-${cost}P)`}
          </button>
        </div>
      </div>
    </div>
  );
}
