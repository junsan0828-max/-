import { trpc } from "@/lib/trpc";

export default function RefundContractPage({ token }: { token: string }) {
  const { data, isLoading, error } = trpc.gym.getRefundContract.useQuery({ token });

  if (isLoading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <p className="text-muted-foreground">로딩 중...</p>
    </div>
  );
  if (error || !data) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <p className="text-muted-foreground">계약서를 찾을 수 없습니다.</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-lg mx-auto space-y-4">
        {/* Header */}
        <div className="text-center py-4">
          <p className="text-lg font-bold text-foreground">{data.gymName ?? "자이언트짐"}</p>
          <h1 className="text-xl font-bold text-foreground mt-1">환불 계약서</h1>
          <p className="text-xs text-muted-foreground mt-1">{new Date(data.createdAt).toLocaleDateString("ko-KR")}</p>
        </div>

        {/* Member Info */}
        <div className="bg-card border border-border rounded-lg p-4 space-y-2">
          <p className="text-sm font-semibold text-foreground">회원 정보</p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div><p className="text-muted-foreground">회원명</p><p className="font-medium">{data.memberName}</p></div>
            {data.memberPhone && <div><p className="text-muted-foreground">연락처</p><p className="font-medium">{data.memberPhone}</p></div>}
          </div>
        </div>

        {/* Program Info */}
        <div className="bg-card border border-border rounded-lg p-4 space-y-3">
          <p className="text-sm font-semibold text-foreground">프로그램 정보</p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="col-span-2"><p className="text-muted-foreground">프로그램명</p><p className="font-medium">{data.programName}</p></div>
            <div><p className="text-muted-foreground">총 횟수</p><p className="font-medium">{data.totalSessions}회</p></div>
            <div><p className="text-muted-foreground">수강 횟수</p><p className="font-medium">{data.usedSessions}회</p></div>
            <div><p className="text-muted-foreground">잔여 횟수</p><p className="font-medium">{data.totalSessions - data.usedSessions}회</p></div>
            {data.paymentMethod && <div><p className="text-muted-foreground">결제 방법</p><p className="font-medium">{data.paymentMethod}</p></div>}
          </div>
        </div>

        {/* Refund Calculation */}
        <div className="bg-card border border-border rounded-lg p-4 space-y-2">
          <p className="text-sm font-semibold text-foreground">환불 금액 계산</p>
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between"><span className="text-muted-foreground">결제 금액</span><span className="font-medium">{data.paymentAmount.toLocaleString()}원</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">부가세</span><span className="font-medium text-red-400">- {data.taxAmount.toLocaleString()}원</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">위약금</span><span className="font-medium text-red-400">- {data.penaltyAmount.toLocaleString()}원</span></div>
            <div className="flex justify-between pt-1.5 border-t border-border">
              <span className="font-semibold text-foreground">환불 금액</span>
              <span className="font-bold text-primary text-sm">{data.refundAmount.toLocaleString()}원</span>
            </div>
          </div>
        </div>

        {/* Reason */}
        {data.reason && (
          <div className="bg-card border border-border rounded-lg p-4">
            <p className="text-sm font-semibold text-foreground mb-1">환불 사유</p>
            <p className="text-xs text-muted-foreground">{data.reason}</p>
          </div>
        )}

        {/* Terms */}
        <div className="bg-card border border-border rounded-lg p-4">
          <p className="text-sm font-semibold text-foreground mb-2">환불 약관</p>
          <div className="text-xs text-muted-foreground space-y-1">
            <p>① 환불 처리는 영업일 기준 3-5일 이내에 처리됩니다.</p>
            <p>② 위약금은 회원 약관에 의거하여 공제됩니다.</p>
            <p>③ 환불 신청 후에는 해당 프로그램의 이용이 불가합니다.</p>
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground pb-4">본 문서는 {data.gymName ?? "자이언트짐"}에서 자동 생성된 환불 계약서입니다.</p>
      </div>
    </div>
  );
}
