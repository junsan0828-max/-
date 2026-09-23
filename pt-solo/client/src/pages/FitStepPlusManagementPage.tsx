import { Sparkles, Lock } from "lucide-react";
import { trpc } from "@/lib/trpc";
import TabBanner from "@/components/TabBanner";
import { FitStepPlusPanel } from "@/pages/Workshop";

export default function FitStepPlusManagementPage() {
  const { data: user, isLoading } = trpc.auth.me.useQuery();
  const trainerId = (user as any)?.trainerId;
  const isPro = (user as any)?.plan === "pro" || (user as any)?.plan === "elite";
  const { data: planInfo } = trpc.fitStepPlus.trainer_getPublicPlanInfo.useQuery(undefined, { enabled: !isPro });

  if (isLoading) return (
    <div className="flex items-center justify-center py-12">
      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!isPro) {
    return (
      <div className="space-y-5 pb-8">
        <TabBanner tabKey="fitstep_plus" />
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-primary/10">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <h1 className="text-lg font-bold">FIT STEP+</h1>
            <p className="text-xs text-muted-foreground">회원 · 출석 · 운동기록 · 영상 · 이벤트 관리</p>
          </div>
        </div>
        <div className="rounded-2xl border border-dashed border-blue-300 dark:border-blue-500/30 bg-blue-50 dark:bg-blue-500/10 p-6 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-blue-500/15 flex items-center justify-center mx-auto">
            <Lock className="h-6 w-6 text-blue-600" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-semibold text-blue-700 dark:text-blue-400">FIT STEP+는 PRO 전용 기능입니다</p>
            <p className="text-xs text-blue-600/80 dark:text-blue-400/80 leading-relaxed">
              PRO로 업그레이드하면 회원 전용 앱에서 출석·운동기록·영상·이벤트까지 관리할 수 있어요.
            </p>
          </div>
          <a href="/profile"
            className="inline-flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl bg-blue-500 text-white text-sm font-semibold hover:bg-blue-600 transition-colors">
            연 {(planInfo?.prices?.pro ?? 69000).toLocaleString()}원으로 업그레이드
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-8">
      <TabBanner tabKey="fitstep_plus" />
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-xl bg-primary/10">
          <Sparkles className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1">
          <h1 className="text-lg font-bold">FIT STEP+</h1>
          <p className="text-xs text-muted-foreground">회원 · 출석 · 운동기록 · 영상 · 이벤트 관리</p>
        </div>
      </div>
      {trainerId ? <FitStepPlusPanel trainerId={trainerId} /> : null}
    </div>
  );
}
