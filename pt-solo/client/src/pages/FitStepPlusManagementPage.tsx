import { Sparkles } from "lucide-react";
import { trpc } from "@/lib/trpc";
import TabBanner from "@/components/TabBanner";
import { FitStepPlusPanel } from "@/pages/Workshop";

export default function FitStepPlusManagementPage() {
  const { data: user, isLoading } = trpc.auth.me.useQuery();
  const trainerId = (user as any)?.trainerId;

  if (isLoading) return (
    <div className="flex items-center justify-center py-12">
      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

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
