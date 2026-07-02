import { useState } from "react";
import { useLocation } from "wouter";
import { ExternalLink, ChevronDown, Save } from "lucide-react";
import { trpc } from "@/lib/trpc";

function PlanLimitsPanel() {
  const utils = trpc.useUtils();
  const { data: limits, isLoading } = trpc.fitStepPlus.admin_getPlanLimits.useQuery();
  const updateMutation = trpc.fitStepPlus.admin_updatePlanLimits.useMutation({
    onSuccess: () => utils.fitStepPlus.admin_getPlanLimits.invalidate(),
  });

  const [free, setFree] = useState<string>("");
  const [pro, setPro] = useState<string>("");
  const [elite, setElite] = useState<string>("");
  const [initialized, setInitialized] = useState(false);

  if (!isLoading && limits && !initialized) {
    setFree(String(limits.free));
    setPro(String(limits.pro));
    setElite(String(limits.elite));
    setInitialized(true);
  }

  const handleSave = () => {
    updateMutation.mutate({
      free: parseInt(free) || 5,
      pro: parseInt(pro) || 15,
      elite: parseInt(elite) || 30,
    });
  };

  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-4">
      <div>
        <h2 className="font-semibold text-sm">FIT STEP+ 플랜별 회원 수 제한</h2>
        <p className="text-xs text-muted-foreground mt-0.5">트레이너 플랜에 따라 등록 가능한 FIT STEP+ 회원 수를 설정합니다</p>
      </div>
      {isLoading ? (
        <div className="text-sm text-muted-foreground">불러오는 중...</div>
      ) : (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "FREE", key: "free", value: free, set: setFree },
            { label: "PRO", key: "pro", value: pro, set: setPro },
            { label: "ELITE", key: "elite", value: elite, set: setElite },
          ].map(({ label, value, set }) => (
            <div key={label} className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">{label}</label>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min={1}
                  max={500}
                  value={value}
                  onChange={(e) => set(e.target.value)}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <span className="text-xs text-muted-foreground flex-shrink-0">명</span>
              </div>
            </div>
          ))}
        </div>
      )}
      {updateMutation.isSuccess && (
        <p className="text-xs text-green-600 font-medium">저장되었습니다</p>
      )}
      {updateMutation.isError && (
        <p className="text-xs text-destructive">{(updateMutation.error as any)?.message ?? "저장 실패"}</p>
      )}
      <button
        onClick={handleSave}
        disabled={updateMutation.isPending || isLoading}
        className="flex items-center gap-1.5 bg-primary text-primary-foreground text-xs font-semibold px-3 py-2 rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50"
      >
        <Save className="w-3.5 h-3.5" />
        {updateMutation.isPending ? "저장 중..." : "저장"}
      </button>
    </div>
  );
}

export default function AdminFitStepPlus() {
  const [, navigate] = useLocation();
  const [showPicker, setShowPicker] = useState(false);
  const { data: overview, isLoading } = trpc.fitStepPlus.admin_overview.useQuery();
  const { data: trainers } = trpc.admin.listTrainers.useQuery();

  const memberCountMap = new Map(
    (overview?.memberCounts ?? []).map((mc) => [mc.trainerId, Number(mc.count)])
  );

  const planBadge = (plan: string) => {
    if (plan === "elite") return <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">ELITE</span>;
    if (plan === "pro") return <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">PRO</span>;
    return <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-muted text-muted-foreground">FREE</span>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">FIT STEP+ 현황</h1>
          <p className="text-sm text-muted-foreground mt-0.5">트레이너별 FIT STEP+ 운영 현황</p>
        </div>
        <div className="relative flex-shrink-0">
          <button
            onClick={() => setShowPicker((v) => !v)}
            className="flex items-center gap-1.5 bg-primary text-primary-foreground text-xs font-semibold px-3 py-2 rounded-xl hover:bg-primary/90 transition-colors"
          >
            앱 입장
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
          {showPicker && trainers && trainers.length > 0 && (
            <div className="absolute right-0 top-10 z-50 bg-card border border-border rounded-xl shadow-lg min-w-[160px] overflow-hidden">
              {trainers.map((trainer) => (
                <button
                  key={trainer.id}
                  onClick={() => { setShowPicker(false); navigate(`/fit-step-plus/${trainer.id}`); }}
                  className="w-full text-left px-4 py-2.5 text-sm hover:bg-accent transition-colors"
                >
                  <p className="font-medium">{trainer.trainerName}</p>
                  <p className="text-[10px] text-muted-foreground">@{trainer.username}</p>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <PlanLimitsPanel />

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
              const plan = (trainer as any).plan ?? "free";
              return (
                <div key={trainer.id} className="bg-card border border-border rounded-xl p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-sm">{trainer.trainerName}</p>
                        {planBadge(plan)}
                      </div>
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
