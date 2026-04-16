import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { UserPlus, Trash2, Users, ChevronRight } from "lucide-react";

export default function Admin() {
  const [, setLocation] = useLocation();
  const { data: user } = trpc.auth.me.useQuery();
  const { data: trainers, refetch } = trpc.admin.listTrainers.useQuery();
  const utils = trpc.useUtils();

  const [createOpen, setCreateOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [form, setForm] = useState({
    username: "",
    password: "",
    trainerName: "",
    phone: "",
    email: "",
    settlementRate: "50",
  });

  // 관리자 권한 확인
  if (user?.role !== "admin") {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>관리자만 접근할 수 있습니다.</p>
      </div>
    );
  }

  const createMutation = trpc.admin.createTrainer.useMutation({
    onSuccess: () => {
      toast.success("트레이너 계정이 생성되었습니다.");
      setCreateOpen(false);
      setForm({ username: "", password: "", trainerName: "", phone: "", email: "", settlementRate: "50" });
      refetch();
    },
    onError: (err) => toast.error(err.message || "생성 실패"),
  });

  const deleteMutation = trpc.admin.deleteTrainer.useMutation({
    onSuccess: () => {
      toast.success("트레이너가 삭제되었습니다.");
      setDeleteId(null);
      refetch();
    },
    onError: (err) => toast.error(err.message || "삭제 실패"),
  });

  const handleCreate = () => {
    if (!form.username || !form.password || !form.trainerName) {
      toast.error("아이디, 비밀번호, 이름은 필수입니다.");
      return;
    }
    createMutation.mutate({
      username: form.username,
      password: form.password,
      trainerName: form.trainerName,
      phone: form.phone || undefined,
      email: form.email || undefined,
      settlementRate: parseInt(form.settlementRate) || 50,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">관리자 설정</h1>
          <p className="text-sm text-muted-foreground mt-0.5">트레이너 계정 관리</p>
        </div>

        {/* 트레이너 생성 다이얼로그 */}
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5">
              <UserPlus className="h-4 w-4" />
              트레이너 추가
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>트레이너 계정 생성</DialogTitle>
              <DialogDescription>새 트레이너 계정 정보를 입력하세요.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">이름 <span className="text-primary">*</span></Label>
                <Input
                  placeholder="김트레이너"
                  value={form.trainerName}
                  onChange={(e) => setForm((p) => ({ ...p, trainerName: e.target.value }))}
                  className="h-9"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">아이디 <span className="text-primary">*</span></Label>
                  <Input
                    placeholder="trainer2"
                    value={form.username}
                    onChange={(e) => setForm((p) => ({ ...p, username: e.target.value }))}
                    className="h-9"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">비밀번호 <span className="text-primary">*</span></Label>
                  <Input
                    type="password"
                    placeholder="6자 이상"
                    value={form.password}
                    onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                    className="h-9"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">연락처</Label>
                <Input
                  placeholder="010-0000-0000"
                  value={form.phone}
                  onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">이메일</Label>
                <Input
                  type="email"
                  placeholder="trainer@example.com"
                  value={form.email}
                  onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">정산 비율 (%)</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={form.settlementRate}
                    onChange={(e) => setForm((p) => ({ ...p, settlementRate: e.target.value }))}
                    className="h-9"
                  />
                  <span className="text-sm text-muted-foreground">%</span>
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <Button variant="outline" className="flex-1" onClick={() => setCreateOpen(false)}>
                  취소
                </Button>
                <Button className="flex-1" onClick={handleCreate} disabled={createMutation.isPending}>
                  {createMutation.isPending ? "생성 중..." : "생성"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* 트레이너 목록 */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" />
            트레이너 목록
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {!trainers?.length ? (
            <p className="text-sm text-muted-foreground text-center py-6">등록된 트레이너가 없습니다.</p>
          ) : (
            trainers.map((trainer) => (
              <div
                key={trainer.id}
                className="flex items-center justify-between p-3 rounded-lg bg-accent/20 border border-border"
              >
                <button
                  className="flex items-center gap-3 flex-1 text-left"
                  onClick={() => setLocation(`/trainers/${trainer.id}`)}
                >
                  <div className="h-9 w-9 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm">
                    {trainer.trainerName.charAt(0)}
                  </div>
                  <div>
                    <p className="font-medium text-sm">{trainer.trainerName}</p>
                    <p className="text-xs text-muted-foreground">
                      회원 {trainer.memberCount}명 · 정산 {trainer.settlementRate}%
                    </p>
                  </div>
                </button>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setLocation(`/trainers/${trainer.id}`)}
                    className="text-muted-foreground hover:text-foreground p-1.5 rounded transition-colors"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                  {/* 삭제 확인 */}
                  <Dialog open={deleteId === trainer.id} onOpenChange={(open) => !open && setDeleteId(null)}>
                    <DialogTrigger asChild>
                      <button
                        onClick={() => setDeleteId(trainer.id)}
                        className="text-muted-foreground hover:text-red-400 p-1.5 rounded transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </DialogTrigger>
                    <DialogContent className="max-w-xs">
                      <DialogHeader>
                        <DialogTitle>트레이너 삭제</DialogTitle>
                        <DialogDescription>
                          {trainer.trainerName} 계정을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="flex gap-2">
                        <Button variant="outline" className="flex-1" onClick={() => setDeleteId(null)}>
                          취소
                        </Button>
                        <Button
                          variant="destructive"
                          className="flex-1"
                          disabled={deleteMutation.isPending}
                          onClick={() => deleteMutation.mutate({ trainerId: trainer.id })}
                        >
                          {deleteMutation.isPending ? "삭제 중..." : "삭제"}
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
