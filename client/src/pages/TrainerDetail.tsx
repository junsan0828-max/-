import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { differenceInDays } from "date-fns";
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
import { ArrowLeft, Settings, Phone, Mail, Users, ChevronRight, UserPlus, Edit } from "lucide-react";
import { Label } from "@/components/ui/label";
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

  // 트레이너 정보 수정
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({ trainerName: "", phone: "", email: "" });

  const trainerQuery = trpc.trainers.getById.useQuery({ id: trainerId });
  const { data: memberList } = trpc.admin.getMembersByTrainer.useQuery({ trainerId });
  const trainer = trainerQuery.data;

  const updateSettlementRateMutation = trpc.trainers.updateSettlementRate.useMutation({
    onSuccess: () => {
      toast.success("정산 비율이 저장되었습니다.");
      setIsDialogOpen(false);
      trainerQuery.refetch();
    },
    onError: (err) => toast.error(err.message || "저장 실패"),
  });

  const updateInfoMutation = trpc.trainers.updateInfo.useMutation({
    onSuccess: () => {
      toast.success("트레이너 정보가 수정되었습니다.");
      setEditOpen(false);
      trainerQuery.refetch();
    },
    onError: (err) => toast.error(err.message || "수정 실패"),
  });

  // 트레이너 정보 로드 시 초기값 설정
  useEffect(() => {
    if (trainer) {
      setSettlementRate(trainer.settlementRate);
      setEditForm({
        trainerName: trainer.trainerName,
        phone: trainer.phone ?? "",
        email: trainer.email ?? "",
      });
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
      <div className="flex items-center gap-3">
        <button
          onClick={() => setLocation("/")}
          className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold shrink-0">
            {trainer.trainerName.charAt(0)}
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-bold truncate">{trainer.trainerName}</h1>
            <p className="text-xs text-muted-foreground">트레이너</p>
          </div>
        </div>

        {/* 관리자 버튼 영역 */}
        {user?.role === "admin" && (
          <div className="flex items-center gap-2 shrink-0">
            <Button
              size="sm"
              className="gap-1.5"
              onClick={() => setLocation(`/trainers/${trainerId}/members/new`)}
            >
              <UserPlus className="h-4 w-4" />
              회원 등록
            </Button>
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
          </div>
        )}
      </div>

      {/* 트레이너 정보 카드 */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-base">트레이너 정보</CardTitle>
          {user?.role === "admin" && (
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 h-7 text-xs"
              onClick={() => {
                setEditForm({
                  trainerName: trainer.trainerName,
                  phone: trainer.phone ?? "",
                  email: trainer.email ?? "",
                });
                setEditOpen(true);
              }}
            >
              <Edit className="h-3 w-3" />
              수정
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3">
            <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">연락처</p>
              <p className="text-sm font-medium">{trainer.phone || "-"}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">이메일</p>
              <p className="text-sm font-medium">{trainer.email || "-"}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Settings className="h-4 w-4 text-muted-foreground shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">정산 비율</p>
              <p className="text-sm font-medium text-primary">{trainer.settlementRate}%</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 트레이너 정보 수정 다이얼로그 */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>트레이너 정보 수정</DialogTitle>
            <DialogDescription>이름, 연락처, 이메일을 수정합니다.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">이름 <span className="text-primary">*</span></Label>
              <Input
                value={editForm.trainerName}
                onChange={(e) => setEditForm((p) => ({ ...p, trainerName: e.target.value }))}
                placeholder="트레이너 이름"
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">연락처</Label>
              <Input
                value={editForm.phone}
                onChange={(e) => setEditForm((p) => ({ ...p, phone: e.target.value }))}
                placeholder="010-0000-0000"
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">이메일</Label>
              <Input
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm((p) => ({ ...p, email: e.target.value }))}
                placeholder="example@email.com"
                className="h-9 text-sm"
              />
            </div>
            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => setEditOpen(false)}>
                취소
              </Button>
              <Button
                className="flex-1"
                disabled={!editForm.trainerName.trim() || updateInfoMutation.isPending}
                onClick={() =>
                  updateInfoMutation.mutate({
                    trainerId,
                    trainerName: editForm.trainerName,
                    phone: editForm.phone || undefined,
                    email: editForm.email || undefined,
                  })
                }
              >
                {updateInfoMutation.isPending ? "저장 중..." : "저장"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 담당 회원 목록 */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            담당 회원
            <span className="ml-auto text-xs font-normal text-muted-foreground">총 {memberList?.length ?? 0}명</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {!memberList?.length ? (
            <p className="text-sm text-muted-foreground text-center py-6">담당 회원이 없습니다.</p>
          ) : (
            memberList.map((m) => {
              const today = new Date();
              const daysLeft = m.membershipEnd ? differenceInDays(new Date(m.membershipEnd), today) : null;
              const isExpiringSoon = daysLeft !== null && daysLeft >= 0 && daysLeft <= 7;
              return (
                <button
                  key={m.id}
                  onClick={() => setLocation(`/members/${m.id}`)}
                  className="w-full flex items-center justify-between p-3 rounded-lg bg-accent/20 border border-border hover:border-primary/40 transition-colors text-left"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-xs shrink-0">
                      {m.name.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="text-sm font-medium">{m.name}</p>
                        <span className={`text-xs px-1.5 py-0.5 rounded-full border ${
                          m.status === "active"
                            ? "bg-green-500/20 text-green-400 border-green-500/30"
                            : "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"
                        }`}>
                          {m.status === "active" ? "활성" : "정지"}
                        </span>
                        {isExpiringSoon && (
                          <span className="text-xs px-1.5 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
                            D-{daysLeft}
                          </span>
                        )}
                        {m.hasUnpaid && (
                          <span className="text-xs px-1.5 py-0.5 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/30">
                            미수금
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {m.membershipEnd
                          ? `만료 ${format(new Date(m.membershipEnd), "yyyy.MM.dd", { locale: ko })}`
                          : "만료일 없음"}
                        {m.remainingPt > 0 && ` · PT ${m.remainingPt}회`}
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 ml-2" />
                </button>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}
