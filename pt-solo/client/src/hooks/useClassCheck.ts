import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useHasSessions } from "@/hooks/useOperationMode";

export type CheckStatus = "attended" | "noshow" | "cancelled";

export function useClassCheck() {
  const utils = trpc.useUtils();
  const hasSessions = useHasSessions();

  const check = trpc.attendanceChecks.checkClass.useMutation({
    onSuccess: (r, v) => {
      utils.invalidate();
      if (v.status === "cancelled") return toast.success("캔슬로 처리했어요");
      const label = v.status === "noshow" ? "노쇼" : "수업 체크";
      if (r.deducted) toast.success(`${label} 완료 · 1회 차감 (잔여 ${r.remaining}회)`);
      else if (r.alreadyDeducted) toast.success(`${label} 완료 · 이 날짜는 이미 차감돼 있어요`);
      else if (r.noPackage && hasSessions && v.deduct !== false) toast.success(`${label} 완료 · 차감할 수업권이 없어요`);
      else toast.success(`${label} 완료`);
    },
    onError: (e) => toast.error(e.message || "처리하지 못했어요"),
  });

  const undo = trpc.attendanceChecks.delete.useMutation({
    onSuccess: (r) => {
      utils.invalidate();
      if (r.restored) toast.success("체크를 취소하고 수업 1회를 되돌렸어요");
      else if (r.keptWithJournal) toast.success("체크를 취소했어요 · 수업 일지가 있어 차감은 유지돼요");
      else toast.success("체크를 취소했어요");
    },
    onError: (e) => toast.error(e.message || "취소하지 못했어요"),
  });

  return {
    hasSessions,
    pending: check.isPending || undo.isPending,
    checkClass: (memberId: number, date: string, status: CheckStatus = "attended", deduct?: boolean) =>
      check.mutate({ memberId, date, status, deduct: deduct ?? (status === "attended" ? hasSessions : false) }),
    undoCheck: (memberId: number, date: string) => undo.mutate({ memberId, date }),
  };
}
