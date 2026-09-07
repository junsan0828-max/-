import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { fmtPhone } from "@/lib/utils";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Users } from "lucide-react";

export default function PTAssignment() {
  const { data: unassignedMembers, refetch } = trpc.admin.listUnassignedMembers.useQuery();
  const { data: trainers } = trpc.trainers.list.useQuery();

  const [assigningMemberId, setAssigningMemberId] = useState<number | null>(null);
  const [selectedTrainerId, setSelectedTrainerId] = useState("");

  const assignMutation = trpc.admin.assignTrainerToMember.useMutation({
    onSuccess: () => {
      toast.success("트레이너가 배정되었습니다.");
      setAssigningMemberId(null);
      setSelectedTrainerId("");
      refetch();
    },
    onError: () => toast.error("배정에 실패했습니다."),
  });

  return (
    <div className="p-4 max-w-lg mx-auto space-y-4">
      <h1 className="text-lg font-semibold">PT 회원 배정</h1>

      {!unassignedMembers || unassignedMembers.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            트레이너 미배정 PT 회원이 없습니다.
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-card border-orange-500/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4 text-orange-400" />
              <span className="text-orange-400">트레이너 미배정 회원</span>
              <span className="ml-auto text-xs font-normal text-muted-foreground">
                {unassignedMembers.length}명
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {unassignedMembers.map((m) => (
              <div
                key={m.id}
                className="p-3 rounded-lg bg-orange-500/5 border border-orange-500/20 space-y-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-sm">{m.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {fmtPhone(m.phone)}
                      {m.remainingPt > 0 && ` · 잔여 PT ${m.remainingPt}회`}
                    </p>
                  </div>
                </div>
                {assigningMemberId === m.id ? (
                  <div className="flex gap-2">
                    <Select value={selectedTrainerId} onValueChange={setSelectedTrainerId}>
                      <SelectTrigger className="h-8 text-xs flex-1">
                        <SelectValue placeholder="트레이너 선택" />
                      </SelectTrigger>
                      <SelectContent>
                        {trainers?.map((t) => (
                          <SelectItem key={t.id} value={String(t.id)} className="text-xs">
                            {t.trainerName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      size="sm"
                      disabled={!selectedTrainerId || assignMutation.isPending}
                      onClick={() =>
                        assignMutation.mutate({
                          memberId: m.id,
                          trainerId: parseInt(selectedTrainerId),
                        })
                      }
                    >
                      배정
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setAssigningMemberId(null);
                        setSelectedTrainerId("");
                      }}
                    >
                      취소
                    </Button>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full text-xs h-7 border-orange-500/30 text-orange-400 hover:bg-orange-500/10"
                    onClick={() => {
                      setAssigningMemberId(m.id);
                      setSelectedTrainerId("");
                    }}
                  >
                    트레이너 배정
                  </Button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
