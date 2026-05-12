import { useLocation } from "wouter";
import { ExternalLink } from "lucide-react";
import { trpc } from "@/lib/trpc";

export default function AdminFitStepPlus() {
  const [, navigate] = useLocation();
  const { data: overview, isLoading } = trpc.fitStepPlus.admin_overview.useQuery();
  const { data: trainers } = trpc.admin.listTrainers.useQuery();

  const memberCountMap = new Map(
    (overview?.memberCounts ?? []).map((mc) => [mc.trainerId, Number(mc.count)])
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">FIT STEP+ 현황</h1>
        <p className="text-sm text-muted-foreground mt-0.5">트레이너별 FIT STEP+ 운영 현황</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground mb-1">FIT STEP+ 운영 트레이너</p>
          <p className="text-2xl font-bold">{trainers?.length ?? 0}명</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground mb-1">전체 FIT STEP+ 회원</p>
          <p className="text-2xl font-bold">
            {overview?.memberCounts.reduce((s, mc) => s + Number(mc.count), 0) ?? 0}명
          </p>
        </div>
      </div>

      <div>
        <h2 className="font-semibold text-sm mb-3">트레이너별 현황</h2>
        {isLoading ? (
          <div className="text-center py-10 text-muted-foreground text-sm">불러오는 중...</div>
        ) : !trainers || trainers.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground text-sm">등록된 트레이너가 없습니다</div>
        ) : (
          <div className="space-y-3">
            {trainers.map((trainer) => {
              const memberCount = memberCountMap.get(trainer.id) ?? 0;
              return (
                <div key={trainer.id} className="bg-card border border-border rounded-xl p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-sm">{trainer.trainerName}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">@{trainer.username}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="font-bold text-lg">{memberCount}명</p>
                        <p className="text-[10px] text-muted-foreground">FIT STEP+ 회원</p>
                      </div>
                      <button
                        onClick={() => navigate(`/fit-step-plus/${trainer.id}`)}
                        className="w-9 h-9 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary flex items-center justify-center transition-colors flex-shrink-0"
                        title="회원 앱으로 이동"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-border">
                    <p className="text-xs text-muted-foreground">
                      회원 앱 URL:&nbsp;
                      <span className="text-primary font-medium break-all">
                        /fit-step-plus/{trainer.id}
                      </span>
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
