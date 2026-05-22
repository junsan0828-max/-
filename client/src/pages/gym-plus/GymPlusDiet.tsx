import { useState, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

// BMR (Mifflin-St Jeor) + TDEE calculation
const ACTIVITY_MULTIPLIERS: Record<string, { label: string; multiplier: number }> = {
  "낮음": { label: "낮음 (사무직·거의 안 움직임)", multiplier: 1.2 },
  "보통": { label: "보통 (주 1-3회 가벼운 운동)", multiplier: 1.375 },
  "높음": { label: "높음 (주 3-5회 운동)", multiplier: 1.55 },
  "매우높음": { label: "매우 높음 (주 6-7회 강도 운동)", multiplier: 1.725 },
};

function calcBMR(health: any): number | null {
  if (!health?.height || !health?.weight || !health?.birthYear || !health?.gender) return null;
  const h = parseFloat(health.height);
  const w = parseFloat(health.weight);
  const age = new Date().getFullYear() - parseInt(health.birthYear);
  if (isNaN(h) || isNaN(w) || isNaN(age) || age < 1 || age > 120) return null;
  return health.gender === "남성"
    ? Math.round(10 * w + 6.25 * h - 5 * age + 5)
    : Math.round(10 * w + 6.25 * h - 5 * age - 161);
}

function getTodayStr() {
  return new Date().toISOString().slice(0, 10);
}
function getTomorrowStr() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}
function formatDateLabel(dateStr: string) {
  const d = new Date(dateStr);
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  return `${dateStr.replace(/-/g, ".")} (${days[d.getDay()]})`;
}

type FoodItem = {
  name: string; amount: string; calories: number; carbs: number; protein: number; fat: number;
};
type DayMeals = { breakfast: FoodItem; lunch: FoodItem; dinner: FoodItem; snack: FoodItem };

const MEAL_META = [
  { key: "breakfast", label: "아침", icon: "🌅", ratio: 0.30 },
  { key: "lunch", label: "점심", icon: "☀️", ratio: 0.35 },
  { key: "dinner", label: "저녁", icon: "🌙", ratio: 0.25 },
  { key: "snack", label: "간식", icon: "🍎", ratio: 0.10 },
] as const;

function MealCard({
  meta, food, completedKey, completed, onToggle, isPending,
}: {
  meta: (typeof MEAL_META)[number];
  food: FoodItem;
  completedKey: string;
  completed: boolean;
  onToggle: (key: string, val: boolean) => void;
  isPending: boolean;
}) {
  return (
    <div className={`rounded-xl border p-3 transition-colors ${completed ? "border-green-500/30 bg-green-500/5 opacity-80" : "border-border bg-card"}`}>
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5">
          <span className="text-sm leading-none">{meta.icon}</span>
          <span className="text-xs font-semibold text-muted-foreground">{meta.label}</span>
        </div>
        <button
          onClick={() => onToggle(completedKey, !completed)}
          disabled={isPending}
          className={`text-[10px] px-2.5 py-1 rounded-full font-medium transition-colors ${
            completed
              ? "bg-green-500/20 text-green-400"
              : "bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary"
          }`}
        >
          {completed ? "✓ 완료" : "완료"}
        </button>
      </div>
      <p className={`font-semibold text-sm ${completed ? "line-through text-muted-foreground" : ""}`}>{food.name}</p>
      <p className="text-[10px] text-muted-foreground mt-0.5">{food.amount}</p>
      <div className="flex gap-2.5 mt-1.5 text-[10px]">
        <span className="font-bold text-foreground">{food.calories} kcal</span>
        <span className="text-muted-foreground">탄 {food.carbs}g</span>
        <span className="text-muted-foreground">단 {food.protein}g</span>
        <span className="text-muted-foreground">지 {food.fat}g</span>
      </div>
    </div>
  );
}

function DaySection({
  prefix, label, dateStr, meals, completedMeals, onToggle, isPending, targetCalories,
}: {
  prefix: "today" | "tomorrow";
  label: string;
  dateStr: string;
  meals: DayMeals;
  completedMeals: Record<string, boolean>;
  onToggle: (key: string, val: boolean) => void;
  isPending: boolean;
  targetCalories: number;
}) {
  const totalCals = MEAL_META.reduce((s, m) => s + meals[m.key].calories, 0);
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold">{label}</p>
        <div className="text-right">
          <p className="text-[10px] text-muted-foreground">{formatDateLabel(dateStr)}</p>
          <p className="text-[10px] text-muted-foreground">식단 합계 <span className="font-semibold text-foreground">{totalCals}</span> / 목표 {targetCalories} kcal</p>
        </div>
      </div>
      <div className="space-y-2">
        {MEAL_META.map((m) => (
          <MealCard
            key={m.key}
            meta={m}
            food={meals[m.key]}
            completedKey={`${prefix}_${m.key}`}
            completed={!!completedMeals[`${prefix}_${m.key}`]}
            onToggle={onToggle}
            isPending={isPending}
          />
        ))}
      </div>
    </div>
  );
}

export default function GymPlusDiet() {
  const [, navigate] = useLocation();
  const today = getTodayStr();

  const { data: health } = trpc.gymPlus.getHealth.useQuery();
  const { data: plan, refetch: refetchPlan } = trpc.gymPlus.getTodayDietPlan.useQuery({ planDate: today });

  const [activityLevel, setActivityLevel] = useState("보통");
  const [includeFoods, setIncludeFoods] = useState("");
  const [excludeFoods, setExcludeFoods] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Sync settings from saved plan
  useEffect(() => {
    if (plan) {
      setActivityLevel(plan.activityLevel);
      setIncludeFoods(plan.includeFoods);
      setExcludeFoods(plan.excludeFoods);
    } else {
      setSettingsOpen(true);
    }
  }, [plan?.planDate]);

  const bmr = useMemo(() => calcBMR(health), [health]);
  const tdee = useMemo(() => {
    if (!bmr) return null;
    return Math.round(bmr * (ACTIVITY_MULTIPLIERS[activityLevel]?.multiplier ?? 1.375));
  }, [bmr, activityLevel]);

  const generatePlan = trpc.gymPlus.generateDietPlan.useMutation({
    onSuccess: () => {
      refetchPlan();
      setSettingsOpen(false);
    },
  });

  const toggleCompletion = trpc.gymPlus.toggleDietCompletion.useMutation({
    onSuccess: () => refetchPlan(),
  });

  const handleToggle = (mealKey: string, completed: boolean) => {
    toggleCompletion.mutate({ planDate: today, mealKey, completed });
  };

  const handleGenerate = () => {
    if (!tdee) return;
    generatePlan.mutate({
      activityLevel,
      targetCalories: tdee,
      includeFoods,
      excludeFoods,
      planDate: today,
    });
  };

  // Report: only today's meals
  const todayReport = useMemo(() => {
    if (!plan) return null;
    const done: Array<{ label: string; food: FoodItem }> = [];
    const missed: Array<{ label: string; food: FoodItem }> = [];
    MEAL_META.forEach((m) => {
      const food = plan.todayMeals[m.key] as FoodItem;
      const isCompleted = !!plan.completedMeals[`today_${m.key}`];
      if (isCompleted) done.push({ label: m.label, food });
      else missed.push({ label: m.label, food });
    });
    const totalConsumed = done.reduce((s, x) => s + x.food.calories, 0);
    const totalTarget = plan.targetCalories;
    const rate = Math.round((totalConsumed / totalTarget) * 100);
    return { done, missed, totalConsumed, totalTarget, rate };
  }, [plan]);

  const hasMissingBodyInfo = !health?.height || !health?.weight || !health?.birthYear || !health?.gender;

  return (
    <div className="p-4 space-y-4 pb-6">
      <h1 className="font-bold text-lg">맞춤 식단</h1>

      {/* 신체정보 없을 때 안내 */}
      {hasMissingBodyInfo && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 space-y-2">
          <p className="text-xs font-semibold text-yellow-400">⚠️ 신체정보 입력 필요</p>
          <p className="text-xs text-muted-foreground">기초대사량 자동 계산을 위해 내정보에서 키·몸무게·출생연도·성별을 입력해 주세요.</p>
          <button
            onClick={() => navigate("/gym-plus/profile")}
            className="text-xs text-primary underline"
          >
            내 정보로 이동 →
          </button>
        </div>
      )}

      {/* BMR / 권장칼로리 카드 */}
      <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">에너지 분석</p>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-muted/30 rounded-xl p-3 text-center">
            <p className="text-[10px] text-muted-foreground">기초대사량 (BMR)</p>
            <p className="text-xl font-black mt-0.5">{bmr ? bmr.toLocaleString() : "—"}</p>
            <p className="text-[9px] text-muted-foreground">kcal / 일</p>
          </div>
          <div className="bg-primary/10 border border-primary/20 rounded-xl p-3 text-center">
            <p className="text-[10px] text-primary/80">권장 칼로리 (TDEE)</p>
            <p className="text-xl font-black mt-0.5 text-primary">{tdee ? tdee.toLocaleString() : "—"}</p>
            <p className="text-[9px] text-muted-foreground">kcal / 일</p>
          </div>
        </div>

        {/* 활동수준 선택 */}
        <div className="space-y-1.5">
          <p className="text-[10px] text-muted-foreground">활동수준</p>
          <div className="grid grid-cols-2 gap-1.5">
            {Object.entries(ACTIVITY_MULTIPLIERS).map(([key, val]) => (
              <button
                key={key}
                onClick={() => setActivityLevel(key)}
                className={`px-2 py-2 rounded-lg border text-[10px] font-medium transition-colors text-left leading-tight ${
                  activityLevel === key
                    ? "bg-primary/15 border-primary text-primary"
                    : "border-border text-muted-foreground hover:border-primary/30"
                }`}
              >
                <span className="font-bold">{key}</span>
                <br />
                <span className="opacity-70">{val.label.split("(")[1]?.replace(")", "")}</span>
              </button>
            ))}
          </div>
        </div>

        {/* 비율 안내 */}
        {tdee && (
          <div className="grid grid-cols-4 gap-1 text-center">
            {MEAL_META.map((m) => (
              <div key={m.key} className="bg-muted/20 rounded-lg py-1.5">
                <p className="text-[9px] text-muted-foreground">{m.icon} {m.label}</p>
                <p className="text-xs font-semibold">{Math.round(tdee * m.ratio)}</p>
                <p className="text-[8px] text-muted-foreground">kcal</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 식단 설정 카드 */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <button
          onClick={() => setSettingsOpen((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-3"
        >
          <p className="text-sm font-semibold">식단 설정</p>
          <span className="text-xs text-muted-foreground">{settingsOpen ? "▲" : "▼"}</span>
        </button>

        {settingsOpen && (
          <div className="px-4 pb-4 space-y-3 border-t border-border pt-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">포함할 음식 (쉼표로 구분)</Label>
              <Input
                value={includeFoods}
                onChange={(e) => setIncludeFoods(e.target.value)}
                placeholder="예: 닭가슴살, 고구마, 연어"
                className="bg-input border-border h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">제외할 음식 (쉼표로 구분)</Label>
              <Input
                value={excludeFoods}
                onChange={(e) => setExcludeFoods(e.target.value)}
                placeholder="예: 소고기, 돼지고기, 밀가루"
                className="bg-input border-border h-9 text-sm"
              />
            </div>
            <Button
              className="w-full h-10 text-sm font-semibold"
              onClick={handleGenerate}
              disabled={generatePlan.isPending || !tdee}
            >
              {generatePlan.isPending ? "생성 중..." : plan ? "🔄 식단 다시 생성" : "✨ 오늘의 식단 생성"}
            </Button>
          </div>
        )}
      </div>

      {/* 식단 표시 */}
      {plan && (
        <>
          {/* 오늘의 식단 */}
          <DaySection
            prefix="today"
            label="오늘의 식단"
            dateStr={today}
            meals={plan.todayMeals as DayMeals}
            completedMeals={plan.completedMeals}
            onToggle={handleToggle}
            isPending={toggleCompletion.isPending}
            targetCalories={plan.targetCalories}
          />

          {/* 내일의 식단 */}
          <DaySection
            prefix="tomorrow"
            label="내일의 식단"
            dateStr={getTomorrowStr()}
            meals={plan.tomorrowMeals as DayMeals}
            completedMeals={plan.completedMeals}
            onToggle={handleToggle}
            isPending={toggleCompletion.isPending}
            targetCalories={plan.targetCalories}
          />

          {/* 오늘 식단 보고서 */}
          {todayReport && (
            <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
              <p className="text-sm font-bold">오늘의 식단 보고서</p>

              {/* 칼로리 진행바 */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">섭취 칼로리</span>
                  <span>
                    <span className="font-bold">{todayReport.totalConsumed}</span>
                    <span className="text-muted-foreground"> / {todayReport.totalTarget} kcal</span>
                  </span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all ${
                      todayReport.rate >= 80 ? "bg-green-500" :
                      todayReport.rate >= 50 ? "bg-yellow-500" : "bg-red-500"
                    }`}
                    style={{ width: `${Math.min(todayReport.rate, 100)}%` }}
                  />
                </div>
                <p className="text-[10px] text-muted-foreground text-right">달성률 {todayReport.rate}%</p>
              </div>

              {/* 성공 섭취 */}
              {todayReport.done.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-green-400">✅ 성공 섭취 ({todayReport.done.length}건)</p>
                  {todayReport.done.map((x) => (
                    <div key={x.label} className="flex items-center justify-between text-xs bg-green-500/5 border border-green-500/20 rounded-lg px-3 py-1.5">
                      <span className="text-muted-foreground">{x.label}</span>
                      <span className="font-medium">{x.food.name}</span>
                      <span className="text-green-400 font-semibold">{x.food.calories} kcal</span>
                    </div>
                  ))}
                </div>
              )}

              {/* 미섭취 */}
              {todayReport.missed.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-muted-foreground">⭕ 미섭취 ({todayReport.missed.length}건)</p>
                  {todayReport.missed.map((x) => (
                    <div key={x.label} className="flex items-center justify-between text-xs bg-muted/20 border border-border rounded-lg px-3 py-1.5">
                      <span className="text-muted-foreground">{x.label}</span>
                      <span className="text-muted-foreground">{x.food.name}</span>
                      <span className="text-muted-foreground">{x.food.calories} kcal</span>
                    </div>
                  ))}
                </div>
              )}

              {todayReport.done.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-2">식사 후 완료 버튼을 눌러 기록하세요</p>
              )}
            </div>
          )}
        </>
      )}

      {/* 식단이 없을 때 빈 상태 */}
      {!plan && !generatePlan.isPending && (
        <div className="bg-card border border-dashed border-border rounded-2xl p-8 text-center space-y-2">
          <p className="text-3xl text-muted-foreground">⊙</p>
          <p className="text-sm font-medium">아직 오늘의 식단이 없어요</p>
          <p className="text-xs text-muted-foreground">위에서 활동수준을 설정하고 식단 생성 버튼을 눌러주세요</p>
        </div>
      )}
    </div>
  );
}
