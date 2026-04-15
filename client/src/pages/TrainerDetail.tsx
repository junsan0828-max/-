import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ArrowLeft, Settings, Phone, Mail } from "lucide-react";
import { trpc as trpcHook } from "@/lib/trpc";

interface Props {
  trainerId: number;
}

export default function TrainerDetail({ trainerId }: Props) {
  const [, setLocation] = useLocation();
  const { data: user } = trpcHook.auth.me.useQuery();

  // 정산 비율 수정
  const [settlementRate, setSettlementRate] = useState(50);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const trainerQuery = trpc.trainers.getById.useQuery({ id: trainerId });
  const trainer = trainerQuery.data;

  const updateSettlementRateMutation = trpc.trainers.updateSettlementRate.useMutation({
    onSuccess: () => {
      toast.success("정산 비율이 저장되었습니다.");
      setIsDialogOpen(false);
      trainerQuery.refetch();
    },
    onError: (err) => toast.error(err.message || "저장 실패"),
  });

  // 트레이너 정보 로드 시 정산 비율 설정
  useEffect(() => {
    if (trainer?.settlementRate) {
      setSettlementRate(trainer.settlementRate);
    }
  }, [trainer]);

  if (trainerQuery.isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 rounded bg-card animate-pulse" />
        <div className="h-48 rounded-lg bg-card animate-pulse" />
      </div>
    );
  }

  if (!trainer) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>트레이너를 찾을 수 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setLocation("/")}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
              {trainer.trainerName.charAt(0)}
            </div>
            <div>
              <h1 className="text-lg font-bold">{trainer.trainerName}</h1>
              <p className="text-xs text-muted-foreground">트레이너</p>
            </div>
          </div>
        </div>

        {/* 관리자만 정산 비율 설정 가능 */}
        {user?.role === "admin" && (
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Settings className="h-4 w-4" />
                정산 비율 설정
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>정산 비율 설정</DialogTitle>
                <DialogDescription>
                  {trainer.trainerName}의 정산 비율을 설정합니다.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">정산 비율 (%)</label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      value={settlementRate}
                      onChange={(e) => setSettlementRate(parseInt(e.target.value) || 0)}
                      className="flex-1"
                    />
                    <span className="text-sm font-medium">%</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    예: 50%로 설정하면 PT 결제 금액의 50%를 정산받습니다.
                  </p>
                </div>
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                    취소
                  </Button>
                  <Button
                    onClick={() => {
                      updateSettlementRateMutation.mutate({
                        trainerId,
                        settlementRate,
                      });
                    }}
                    disabled={updateSettlementRateMutation.isPending}
                  >
                    {updateSettlementRateMutation.isPending ? "저장 중..." : "저장"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* 트레이너 정보 카드 */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">트레이너 정보</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {trainer.phone && (
            <div className="flex items-center gap-3">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">연락처</p>
                <p className="text-sm font-medium">{trainer.phone}</p>
              </div>
            </div>
          )}
          {trainer.email && (
            <div className="flex items-center gap-3">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">이메일</p>
                <p className="text-sm font-medium">{trainer.email}</p>
              </div>
            </div>
          )}
          <div className="flex items-center gap-3">
            <Settings className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">정산 비율</p>
              <p className="text-sm font-medium text-primary">{trainer.settlementRate}%</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
