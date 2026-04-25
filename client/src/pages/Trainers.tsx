import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronRight, Users } from "lucide-react";

export default function Trainers() {
  const [, setLocation] = useLocation();
  const { data: trainers, isLoading } = trpc.admin.listTrainers.useQuery();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">트레이너 관리</h1>
        <p className="text-sm text-muted-foreground mt-0.5">총 {trainers?.length ?? 0}명</p>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-20 rounded-lg bg-card border border-border animate-pulse" />
          ))}
        </div>
      ) : !trainers?.length ? (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-sm">등록된 트레이너가 없습니다.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {trainers.map((trainer) => (
            <button
              key={trainer.id}
              onClick={() => setLocation(`/trainers/${trainer.id}`)}
              className="w-full text-left p-4 rounded-lg bg-card border border-border hover:border-primary/50 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm">
                    {trainer.trainerName.charAt(0)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-foreground">{trainer.trainerName}</p>
                      {trainer.assignedBranches?.map((b) => (
                        <span key={b.branchId} className="text-xs bg-primary/20 text-primary px-1.5 py-0.5 rounded">
                          {b.branchName}
                        </span>
                      ))}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Users className="h-3 w-3" />
                        {trainer.memberCount}명
                      </span>
                      <span className="text-xs text-primary">정산 {trainer.settlementRate}%</span>
                    </div>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
