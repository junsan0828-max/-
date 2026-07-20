import { useEffect, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Bell } from "lucide-react";

const PERIOD_PRICES: Record<string, number> = {
  "1개월": 80000,
  "3개월": 159000,
  "6개월": 216000,
  "12개월": 312000,
};

// ZIANTGYM+ 회원앱에서 들어오는 재등록 신청을 관리자가 즉시 확인·승인할 수 있는 알림 모달
// (선택지 A: 관리자 승인 화면 + 선택지 B: 즉시 알림을 하나로 결합)
export default function AdminRenewalRequestsModal({ enabled }: { enabled: boolean }) {
  const [open, setOpen] = useState(false);
  const autoOpened = useRef(false);
  const utils = trpc.useUtils();

  const { data: pending } = trpc.gymPlus.adminListRenewals.useQuery(
    { status: "pending" },
    { enabled, refetchInterval: 30000 }
  );

  const pendingCount = pending?.length ?? 0;

  useEffect(() => {
    if (!autoOpened.current && pendingCount > 0) {
      autoOpened.current = true;
      setOpen(true);
    }
  }, [pendingCount]);

  const approveMutation = trpc.gymPlus.adminApproveRenewal.useMutation({
    onSuccess: (_, variables) => {
      toast.success(variables.action === "approved" ? "재등록을 승인했습니다. 만료일이 자동 연장되었습니다." : "신청을 거절했습니다.");
      utils.gymPlus.adminListRenewals.invalidate();
    },
    onError: (e) => toast.error(e.message || "처리 실패"),
  });

  if (!enabled) return null;

  return (
    <>
      {/* 플로팅 알림 버튼 */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-20 md:bottom-6 right-4 z-40 w-[3.25rem] h-[3.25rem] rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:brightness-110 transition-all"
        aria-label="재등록 신청 알림"
      >
        <Bell className="h-5 w-5" />
        {pendingCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 rounded-full bg-red-500 text-white text-[11px] font-bold flex items-center justify-center">
            {pendingCount}
          </span>
        )}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-primary" />
              재등록 신청 {pendingCount > 0 ? `(${pendingCount}건 대기)` : ""}
            </DialogTitle>
            <DialogDescription className="text-xs">
              ZIANTGYM+ 회원앱에서 접수된 재등록 신청입니다. 결제 확인 후 승인하면 회원권 만료일이 자동으로 연장됩니다.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 max-h-[60vh] overflow-y-auto">
            {!pending || pending.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">대기 중인 재등록 신청이 없습니다.</p>
            ) : (
              pending.map((r) => {
                const paymentMethod = r.notes?.match(/결제방법:\s*([^\n]+)/)?.[1];
                const extraNotes = r.notes?.replace(/결제방법:\s*[^\n]+\n?/, "").trim();
                return (
                  <div key={r.id} className="border border-border rounded-xl p-3.5 space-y-2 bg-accent/10">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-bold text-sm">{r.memberName ?? "-"}</p>
                        <p className="text-xs text-muted-foreground">{r.memberPhone ?? "-"}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-primary text-sm">{r.requestedPeriod}</p>
                        <p className="text-xs text-muted-foreground">{PERIOD_PRICES[r.requestedPeriod]?.toLocaleString() ?? "-"}원</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-background/60 rounded-lg p-2">
                        <p className="text-muted-foreground">현재 만료일</p>
                        <p className="font-medium mt-0.5">{r.currentMembershipEnd ?? "-"}</p>
                      </div>
                      <div className="bg-background/60 rounded-lg p-2">
                        <p className="text-muted-foreground">결제 방법</p>
                        <p className="font-medium mt-0.5">{paymentMethod ?? "미기재"}</p>
                      </div>
                    </div>
                    {r.bonusDays > 0 && (
                      <p className="text-xs text-green-500 font-medium">+ 보너스 {r.bonusDays}일 자동 추가</p>
                    )}
                    {extraNotes && (
                      <p className="text-xs text-muted-foreground bg-background/40 rounded-lg p-2">{extraNotes}</p>
                    )}
                    <div className="flex gap-2 pt-1">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 h-8 text-xs"
                        disabled={approveMutation.isPending}
                        onClick={() => approveMutation.mutate({ renewalId: r.id, action: "rejected" })}
                      >
                        거절
                      </Button>
                      <Button
                        size="sm"
                        className="flex-1 h-8 text-xs"
                        disabled={approveMutation.isPending}
                        onClick={() => approveMutation.mutate({ renewalId: r.id, action: "approved" })}
                      >
                        승인 (만료일 자동 연장)
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
