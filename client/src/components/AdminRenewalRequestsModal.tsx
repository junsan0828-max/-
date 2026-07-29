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

// ZIANTGYM+ 회원앱에서 들어오는 재등록/포인트 충전 신청을 관리자가 즉시 확인·승인할 수 있는 알림 모달
// (선택지 A: 관리자 승인 화면 + 선택지 B: 즉시 알림을 하나로 결합)
export default function AdminRenewalRequestsModal({ enabled }: { enabled: boolean }) {
  const [open, setOpen] = useState(false);
  const autoOpened = useRef(false);
  const utils = trpc.useUtils();

  const { data: pending } = trpc.gymPlus.adminListRenewals.useQuery(
    { status: "pending" },
    { enabled, refetchInterval: 30000 }
  );
  const { data: pendingCharges } = trpc.gymPlus.admin_listPointChargeRequests.useQuery(
    { status: "pending" },
    { enabled, refetchInterval: 30000 }
  );

  const { data: pendingExtensions } = trpc.gymPlus.admin_listPointExtensionRequests.useQuery(
    { status: "pending" },
    { enabled, refetchInterval: 30000 }
  );

  const renewalCount = pending?.length ?? 0;
  const chargeCount = pendingCharges?.length ?? 0;
  const extensionCount = pendingExtensions?.length ?? 0;
  const pendingCount = renewalCount + chargeCount + extensionCount;

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

  const approveExtensionMutation = trpc.gymPlus.admin_approvePointExtensionRequest.useMutation({
    onSuccess: (res: any, variables) => {
      toast.success(
        variables.action === "approved"
          ? `승인 완료 — 회원권 만료일을 ${res?.manualExtensionDays ?? ""}일 연장해 주세요.`
          : "신청을 거절하고 포인트를 반환했습니다."
      );
      utils.gymPlus.admin_listPointExtensionRequests.invalidate();
    },
    onError: (e) => toast.error(e.message || "처리 실패"),
  });

  const approveChargeMutation = trpc.gymPlus.admin_approvePointChargeRequest.useMutation({
    onSuccess: (_, variables) => {
      toast.success(variables.action === "approved" ? "포인트 충전을 승인했습니다." : "신청을 거절했습니다.");
      utils.gymPlus.admin_listPointChargeRequests.invalidate();
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
              회원 신청 알림 {pendingCount > 0 ? `(${pendingCount}건 대기)` : ""}
            </DialogTitle>
            <DialogDescription className="text-xs">
              ZIANTGYM+ 회원앱에서 접수된 재등록·포인트 충전 신청입니다.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 max-h-[65vh] overflow-y-auto">
            {/* 포인트 충전 신청 */}
            <div className="space-y-2">
              <p className="text-xs font-bold text-muted-foreground">포인트 충전 신청 {chargeCount > 0 ? `(${chargeCount})` : ""}</p>
              {!pendingCharges || pendingCharges.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-3">대기 중인 충전 신청이 없습니다.</p>
              ) : (
                <div className="space-y-2">
                  {pendingCharges.map((c) => (
                    <div key={c.id} className="border border-border rounded-xl p-3.5 space-y-2 bg-accent/10">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-bold text-sm">{c.memberName ?? "-"}</p>
                          <p className="text-xs text-muted-foreground">{c.memberPhone ?? "-"}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-primary text-sm">{c.requestedAmount.toLocaleString()}P</p>
                          <p className="text-xs text-muted-foreground">{c.paymentMethod}</p>
                        </div>
                      </div>
                      {c.note && <p className="text-xs text-muted-foreground bg-background/40 rounded-lg p-2">{c.note}</p>}
                      <div className="flex gap-2 pt-1">
                        <Button
                          variant="outline" size="sm" className="flex-1 h-8 text-xs"
                          disabled={approveChargeMutation.isPending}
                          onClick={() => approveChargeMutation.mutate({ id: c.id, action: "rejected" })}
                        >거절</Button>
                        <Button
                          size="sm" className="flex-1 h-8 text-xs"
                          disabled={approveChargeMutation.isPending}
                          onClick={() => approveChargeMutation.mutate({ id: c.id, action: "approved" })}
                        >승인 (포인트 자동 충전)</Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="h-px bg-border" />

            {/* 포인트 회원권 연장 신청 */}
            <div className="space-y-2">
              <p className="text-xs font-bold text-muted-foreground">회원권 연장 신청 (포인트) {extensionCount > 0 ? `(${extensionCount})` : ""}</p>
              {!pendingExtensions || pendingExtensions.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-3">대기 중인 연장 신청이 없습니다.</p>
              ) : (
                <div className="space-y-2">
                  {pendingExtensions.map((x) => (
                    <div key={x.id} className="border border-border rounded-xl p-3.5 space-y-2 bg-accent/10">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-bold text-sm">{x.memberName ?? "-"}</p>
                          <p className="text-xs text-muted-foreground">{x.memberPhone ?? "-"}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-primary text-sm">{x.requestedDays}일 연장</p>
                          <p className="text-xs text-muted-foreground">{x.pointsUsed.toLocaleString()}P 차감됨</p>
                        </div>
                      </div>
                      <div className="bg-background/60 rounded-lg p-2 text-xs">
                        <p className="text-muted-foreground">현재 만료일</p>
                        <p className="font-medium mt-0.5">{x.membershipEnd ?? "-"}</p>
                      </div>
                      <p className="text-[11px] text-orange-500 bg-orange-500/10 rounded-lg p-2">
                        승인 후 회원 만료일을 {x.requestedDays}일 <b>직접 연장</b>해 주세요. (자동 연장 연동 준비 중)
                      </p>
                      <div className="flex gap-2 pt-1">
                        <Button
                          variant="outline" size="sm" className="flex-1 h-8 text-xs"
                          disabled={approveExtensionMutation.isPending}
                          onClick={() => approveExtensionMutation.mutate({ id: x.id, action: "rejected" })}
                        >거절 (포인트 반환)</Button>
                        <Button
                          size="sm" className="flex-1 h-8 text-xs"
                          disabled={approveExtensionMutation.isPending}
                          onClick={() => approveExtensionMutation.mutate({ id: x.id, action: "approved" })}
                        >승인</Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="h-px bg-border" />

            {/* 재등록 신청 */}
            <div className="space-y-2">
              <p className="text-xs font-bold text-muted-foreground">재등록 신청 {renewalCount > 0 ? `(${renewalCount})` : ""}</p>
              {!pending || pending.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-3">대기 중인 재등록 신청이 없습니다.</p>
              ) : (
                <div className="space-y-2">
                  {pending.map((r) => {
                // 결제방법·금액은 구조화 필드 우선, 없으면 옛 기록 호환(메모/기간표 파싱)
                const paymentMethod = r.paymentMethod ?? r.notes?.match(/결제방법:\s*([^\n]+)/)?.[1];
                const amount = r.requestedAmount ?? PERIOD_PRICES[r.requestedPeriod];
                const extraNotes = r.notes?.replace(/결제방법:\s*[^\n]+\n?/, "").trim();
                return (
                  <div key={r.id} className="border border-border rounded-xl p-3.5 space-y-2 bg-accent/10">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-bold text-sm">{r.memberName ?? "-"}</p>
                        <p className="text-xs text-muted-foreground">{r.memberPhone ?? "-"}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-primary text-sm">
                          {r.membershipType ? `${r.membershipType} · ` : ""}{r.requestedPeriod}
                        </p>
                        <p className="text-xs text-muted-foreground">{amount != null ? `${amount.toLocaleString()}원` : "-"}</p>
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
                  })}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
