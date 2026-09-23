import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Check, Utensils, ChevronDown } from "lucide-react";
import { useLocation } from "wouter";

export default function ImportDiet() {
  const [, navigate] = useLocation();
  const { data: memberList = [] } = trpc.members.list.useQuery();
  const [selectedMemberId, setSelectedMemberId] = useState<number | null>(null);
  const [dietData, setDietData] = useState<any>(null);
  const [saved, setSaved] = useState(false);

  const saveMutation = trpc.dietPlans.save.useMutation({
    onSuccess: () => { setSaved(true); toast.success("식단이 저장되었습니다"); },
    onError: () => toast.error("저장에 실패했습니다"),
  });

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const raw = params.get("data");
      if (raw) {
        const decoded = JSON.parse(atob(raw));
        setDietData(decoded);
      }
    } catch {
      toast.error("식단 데이터를 읽을 수 없습니다");
    }
  }, []);

  function handleSave() {
    if (!selectedMemberId || !dietData) return;
    saveMutation.mutate({
      memberId: selectedMemberId,
      planDate: new Date().toISOString().slice(0, 10),
      goal: dietData.goal || "맞춤식단",
      targetKcal: dietData.targetKcal || 0,
      mealsJson: JSON.stringify(dietData.meals || []),
    });
  }

  if (!dietData) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center space-y-3">
        <Utensils className="h-10 w-10 text-muted-foreground mx-auto" />
        <p className="text-sm text-muted-foreground">식단 데이터가 없습니다.</p>
        <button onClick={() => navigate("/")} className="text-xs text-primary underline">대시보드로 이동</button>
      </div>
    );
  }

  const meals: any[] = dietData.meals || [];
  const totalKcal = meals.reduce((s: number, m: any) => s + (m.kcal || 0), 0);

  if (saved) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center space-y-4">
        <div className="w-14 h-14 rounded-full bg-green-500/10 flex items-center justify-center mx-auto">
          <Check className="h-7 w-7 text-green-500" />
        </div>
        <p className="text-sm font-semibold">식단이 저장되었습니다</p>
        <p className="text-xs text-muted-foreground">대시보드 → 식단 관리에서 확인할 수 있습니다.</p>
        <button onClick={() => navigate("/")} className="text-xs text-primary underline">대시보드로 이동</button>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-4 py-6 space-y-5">
      <div className="text-center space-y-1">
        <Utensils className="h-8 w-8 text-primary mx-auto" />
        <h1 className="text-base font-bold">맞춤 식단 저장</h1>
        <p className="text-xs text-muted-foreground">AI 맞춤식단 결과를 회원 식단에 저장합니다</p>
      </div>

      {/* 식단 미리보기 */}
      <div className="border border-border rounded-2xl p-4 space-y-2 bg-card">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">{dietData.goal || "맞춤 식단"}</p>
          <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">{dietData.targetKcal || totalKcal} kcal</span>
        </div>
        <div className="space-y-1.5">
          {meals.map((m: any, i: number) => (
            <div key={i} className="flex items-center justify-between text-xs bg-muted/30 rounded-lg px-3 py-2">
              <span className="font-medium">{m.mealType || m.name}</span>
              <span className="text-muted-foreground">{m.name} · {m.kcal}kcal</span>
            </div>
          ))}
        </div>
      </div>

      {/* 회원 선택 */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground mb-1.5">저장할 회원 선택</p>
        <div className="relative">
          <select
            value={selectedMemberId ?? ""}
            onChange={e => setSelectedMemberId(Number(e.target.value) || null)}
            className="w-full border border-border rounded-xl px-3 py-2.5 text-sm bg-background appearance-none pr-8"
          >
            <option value="">-- 회원을 선택하세요 --</option>
            {(memberList as any[]).map((m: any) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={!selectedMemberId || saveMutation.isPending}
        className="w-full py-3 rounded-2xl bg-green-600 hover:bg-green-700 text-white font-semibold text-sm transition-colors disabled:opacity-50"
      >
        {saveMutation.isPending ? "저장 중..." : "회원 식단에 저장"}
      </button>
    </div>
  );
}
