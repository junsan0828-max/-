import { useState, useEffect, useRef } from "react";
import { Salad, User, Activity, Utensils, Share2, ChevronDown, AlertCircle, Flame, Wheat, Beef, Droplets } from "lucide-react";

// ─── 내장 식품 DB ────────────────────────────────────────────────────────────
interface FoodItem {
  name: string;
  category: "grain" | "protein" | "vegetable" | "dairy" | "fruit" | "fat" | "snack";
  per100g: { kcal: number; carb: number; protein: number; fat: number };
  tags: string[];
}

const FOOD_DB: FoodItem[] = [
  // 곡류
  { name: "현미밥", category: "grain", per100g: { kcal: 141, carb: 29.6, protein: 2.7, fat: 1.0 }, tags: ["밥", "쌀"] },
  { name: "백미밥", category: "grain", per100g: { kcal: 143, carb: 31.7, protein: 2.7, fat: 0.3 }, tags: ["밥", "쌀"] },
  { name: "오트밀", category: "grain", per100g: { kcal: 389, carb: 67.0, protein: 17.0, fat: 7.0 }, tags: ["귀리", "시리얼"] },
  { name: "고구마", category: "grain", per100g: { kcal: 86, carb: 20.1, protein: 1.6, fat: 0.1 }, tags: ["고구마"] },
  { name: "감자", category: "grain", per100g: { kcal: 69, carb: 15.4, protein: 2.1, fat: 0.1 }, tags: ["감자"] },
  { name: "통밀빵", category: "grain", per100g: { kcal: 247, carb: 44.0, protein: 9.5, fat: 3.5 }, tags: ["빵", "식빵"] },
  { name: "옥수수", category: "grain", per100g: { kcal: 96, carb: 21.0, protein: 3.4, fat: 1.5 }, tags: ["옥수수"] },
  // 단백질
  { name: "닭가슴살", category: "protein", per100g: { kcal: 109, carb: 0.0, protein: 23.1, fat: 1.2 }, tags: ["닭", "chicken"] },
  { name: "삶은 달걀", category: "protein", per100g: { kcal: 155, carb: 1.1, protein: 13.0, fat: 10.6 }, tags: ["달걀", "계란"] },
  { name: "두부", category: "protein", per100g: { kcal: 76, carb: 1.9, protein: 8.1, fat: 4.2 }, tags: ["두부", "콩"] },
  { name: "연어", category: "protein", per100g: { kcal: 208, carb: 0.0, protein: 20.4, fat: 13.4 }, tags: ["생선", "salmon"] },
  { name: "참치캔(물)", category: "protein", per100g: { kcal: 109, carb: 0.0, protein: 24.0, fat: 1.0 }, tags: ["참치", "통조림"] },
  { name: "소고기(등심)", category: "protein", per100g: { kcal: 271, carb: 0.0, protein: 18.5, fat: 21.4 }, tags: ["소", "beef"] },
  { name: "돼지고기(목살)", category: "protein", per100g: { kcal: 262, carb: 0.0, protein: 16.5, fat: 21.5 }, tags: ["돼지", "pork"] },
  { name: "새우", category: "protein", per100g: { kcal: 99, carb: 0.9, protein: 20.9, fat: 1.1 }, tags: ["새우", "해산물"] },
  { name: "그릭요거트(무지방)", category: "protein", per100g: { kcal: 59, carb: 3.6, protein: 10.0, fat: 0.4 }, tags: ["요거트", "유제품"] },
  { name: "닭다리살", category: "protein", per100g: { kcal: 179, carb: 0.0, protein: 18.9, fat: 11.1 }, tags: ["닭", "chicken"] },
  // 채소
  { name: "브로콜리", category: "vegetable", per100g: { kcal: 34, carb: 7.0, protein: 2.8, fat: 0.4 }, tags: ["브로콜리"] },
  { name: "시금치", category: "vegetable", per100g: { kcal: 23, carb: 3.6, protein: 2.9, fat: 0.4 }, tags: ["시금치"] },
  { name: "양배추", category: "vegetable", per100g: { kcal: 25, carb: 5.8, protein: 1.3, fat: 0.1 }, tags: ["양배추"] },
  { name: "오이", category: "vegetable", per100g: { kcal: 15, carb: 3.6, protein: 0.7, fat: 0.1 }, tags: ["오이"] },
  { name: "토마토", category: "vegetable", per100g: { kcal: 18, carb: 3.9, protein: 0.9, fat: 0.2 }, tags: ["토마토"] },
  { name: "당근", category: "vegetable", per100g: { kcal: 41, carb: 9.6, protein: 0.9, fat: 0.2 }, tags: ["당근"] },
  { name: "파프리카", category: "vegetable", per100g: { kcal: 31, carb: 6.3, protein: 1.0, fat: 0.3 }, tags: ["파프리카"] },
  { name: "버섯", category: "vegetable", per100g: { kcal: 22, carb: 3.3, protein: 3.1, fat: 0.3 }, tags: ["버섯"] },
  // 유제품
  { name: "우유(저지방)", category: "dairy", per100g: { kcal: 46, carb: 4.8, protein: 3.4, fat: 1.0 }, tags: ["우유", "milk"] },
  { name: "치즈(체다)", category: "dairy", per100g: { kcal: 403, carb: 1.3, protein: 25.0, fat: 33.0 }, tags: ["치즈"] },
  { name: "코티지치즈", category: "dairy", per100g: { kcal: 98, carb: 3.4, protein: 11.1, fat: 4.3 }, tags: ["치즈", "코티지"] },
  // 과일
  { name: "바나나", category: "fruit", per100g: { kcal: 89, carb: 23.0, protein: 1.1, fat: 0.3 }, tags: ["바나나"] },
  { name: "사과", category: "fruit", per100g: { kcal: 52, carb: 14.0, protein: 0.3, fat: 0.2 }, tags: ["사과"] },
  { name: "블루베리", category: "fruit", per100g: { kcal: 57, carb: 14.5, protein: 0.7, fat: 0.3 }, tags: ["블루베리"] },
  { name: "귤", category: "fruit", per100g: { kcal: 47, carb: 11.8, protein: 0.7, fat: 0.1 }, tags: ["귤", "오렌지"] },
  // 지방/견과류
  { name: "아몬드", category: "fat", per100g: { kcal: 579, carb: 21.6, protein: 21.2, fat: 49.9 }, tags: ["아몬드", "견과류"] },
  { name: "아보카도", category: "fat", per100g: { kcal: 160, carb: 8.5, protein: 2.0, fat: 14.7 }, tags: ["아보카도"] },
  { name: "올리브오일", category: "fat", per100g: { kcal: 884, carb: 0.0, protein: 0.0, fat: 100.0 }, tags: ["기름", "oil"] },
  { name: "호두", category: "fat", per100g: { kcal: 654, carb: 13.7, protein: 15.2, fat: 65.2 }, tags: ["호두", "견과류"] },
  // 건강간식
  { name: "프로틴바", category: "snack", per100g: { kcal: 380, carb: 42.0, protein: 30.0, fat: 9.0 }, tags: ["프로틴", "바"] },
  { name: "단백질 쉐이크(무설탕)", category: "snack", per100g: { kcal: 110, carb: 5.0, protein: 22.0, fat: 1.5 }, tags: ["쉐이크", "단백질"] },
  { name: "현미 떡", category: "snack", per100g: { kcal: 220, carb: 48.0, protein: 4.0, fat: 0.5 }, tags: ["떡", "현미"] },
  { name: "삶은 계란 흰자", category: "snack", per100g: { kcal: 52, carb: 0.7, protein: 10.9, fat: 0.2 }, tags: ["계란", "흰자"] },
];

// ─── 끼니별 음식 구성 템플릿 ─────────────────────────────────────────────────
const MEAL_TEMPLATES = {
  breakfast: [
    { food: "오트밀", grams: 80 },
    { food: "삶은 달걀", grams: 100 },
    { food: "바나나", grams: 100 },
    { food: "우유(저지방)", grams: 200 },
  ],
  lunch: [
    { food: "현미밥", grams: 200 },
    { food: "닭가슴살", grams: 150 },
    { food: "브로콜리", grams: 100 },
    { food: "당근", grams: 50 },
  ],
  dinner: [
    { food: "고구마", grams: 150 },
    { food: "연어", grams: 150 },
    { food: "시금치", grams: 100 },
    { food: "버섯", grams: 80 },
  ],
  snack: [
    { food: "아몬드", grams: 30 },
    { food: "그릭요거트(무지방)", grams: 150 },
    { food: "블루베리", grams: 80 },
  ],
};

// ─── 타입 ─────────────────────────────────────────────────────────────────────
interface MealEntry {
  name: string;
  grams: number;
  kcal: number;
  carb: number;
  protein: number;
  fat: number;
}

interface MealPlan {
  breakfast: MealEntry[];
  lunch: MealEntry[];
  dinner: MealEntry[];
  snack: MealEntry[];
}

// ─── 계산 함수 ────────────────────────────────────────────────────────────────
function calcBMR(gender: string, age: number, weight: number, height: number): number {
  if (gender === "male") {
    return Math.round(88.362 + 13.397 * weight + 4.799 * height - 5.677 * age);
  }
  return Math.round(447.593 + 9.247 * weight + 3.098 * height - 4.330 * age);
}

const ACTIVITY_MULTIPLIER: Record<string, number> = { low: 1.375, moderate: 1.55, high: 1.725 };

function calcTDEE(bmr: number, activity: string): number {
  return Math.round(bmr * (ACTIVITY_MULTIPLIER[activity] ?? 1.55));
}

function macroFromKcal(kcal: number) {
  // 탄 50% / 단 25% / 지 25%
  return {
    carb: Math.round((kcal * 0.5) / 4),
    protein: Math.round((kcal * 0.25) / 4),
    fat: Math.round((kcal * 0.25) / 9),
  };
}

function getNutrition(food: FoodItem, grams: number): { kcal: number; carb: number; protein: number; fat: number } {
  const r = grams / 100;
  return {
    kcal: Math.round(food.per100g.kcal * r),
    carb: Math.round(food.per100g.carb * r * 10) / 10,
    protein: Math.round(food.per100g.protein * r * 10) / 10,
    fat: Math.round(food.per100g.fat * r * 10) / 10,
  };
}

function buildMeal(
  template: { food: string; grams: number }[],
  targetKcal: number,
  includeList: string[],
  excludeList: string[]
): MealEntry[] {
  // 제외 목록 필터링
  const excludeLower = excludeList.map((s) => s.toLowerCase().trim()).filter(Boolean);
  const includeLower = includeList.map((s) => s.toLowerCase().trim()).filter(Boolean);

  let candidates = [...template];

  // 포함 음식 우선 추가
  const extraItems: { food: string; grams: number }[] = [];
  includeLower.forEach((inc) => {
    const found = FOOD_DB.find(
      (f) => f.name.toLowerCase().includes(inc) || f.tags.some((t) => t.toLowerCase().includes(inc))
    );
    if (found && !candidates.some((c) => c.food === found.name)) {
      extraItems.push({ food: found.name, grams: 100 });
    }
  });

  // 전체 후보 = 포함 음식 + 기존 템플릿 (제외 음식 제거)
  const allCandidates = [...extraItems, ...candidates].filter(({ food }) => {
    return !excludeLower.some((ex) => food.toLowerCase().includes(ex));
  });

  // 현재 칼로리 합계 계산 후 스케일 조정
  const entries: MealEntry[] = allCandidates.map(({ food, grams }) => {
    const item = FOOD_DB.find((f) => f.name === food);
    if (!item) return null!;
    return { name: food, grams, ...getNutrition(item, grams) };
  }).filter(Boolean);

  const totalKcal = entries.reduce((s, e) => s + e.kcal, 0);
  if (totalKcal === 0) return entries;

  const scale = targetKcal / totalKcal;
  return entries.map((e) => {
    const newGrams = Math.round(e.grams * scale);
    const item = FOOD_DB.find((f) => f.name === e.name)!;
    return { name: e.name, grams: newGrams, ...getNutrition(item, newGrams) };
  });
}

function sumMeal(entries: MealEntry[]) {
  return entries.reduce(
    (acc, e) => ({ kcal: acc.kcal + e.kcal, carb: acc.carb + e.carb, protein: acc.protein + e.protein, fat: acc.fat + e.fat }),
    { kcal: 0, carb: 0, protein: 0, fat: 0 }
  );
}

// ─── 컴포넌트 ─────────────────────────────────────────────────────────────────
export default function DietPlanner() {
  const [name, setName] = useState("");
  const [gender, setGender] = useState<"male" | "female">("male");
  const [age, setAge] = useState("");
  const [weight, setWeight] = useState("");
  const [height, setHeight] = useState("");
  const [activity, setActivity] = useState<"low" | "moderate" | "high">("moderate");
  const [includeFood, setIncludeFood] = useState("");
  const [excludeFood, setExcludeFood] = useState("");

  // 끼니 비율 (합 = 100)
  const [pctBreakfast, setPctBreakfast] = useState(25);
  const [pctLunch, setPctLunch] = useState(35);
  const [pctDinner, setPctDinner] = useState(30);
  const [pctSnack, setPctSnack] = useState(10);

  const [mealPlan, setMealPlan] = useState<MealPlan | null>(null);
  const [ratioError, setRatioError] = useState(false);

  const resultRef = useRef<HTMLDivElement>(null);

  // 자동 계산
  const bmr = age && weight && height
    ? calcBMR(gender, parseInt(age), parseFloat(weight), parseFloat(height))
    : 0;
  const tdee = bmr ? calcTDEE(bmr, activity) : 0;

  const pctTotal = pctBreakfast + pctLunch + pctDinner + pctSnack;

  function handleGenerate() {
    if (pctTotal !== 100) { setRatioError(true); return; }
    setRatioError(false);

    const includeList = includeFood.split(/[,，]/).map((s) => s.trim()).filter(Boolean);
    const excludeList = excludeFood.split(/[,，]/).map((s) => s.trim()).filter(Boolean);

    const plan: MealPlan = {
      breakfast: buildMeal(MEAL_TEMPLATES.breakfast, (tdee * pctBreakfast) / 100, includeList, excludeList),
      lunch: buildMeal(MEAL_TEMPLATES.lunch, (tdee * pctLunch) / 100, includeList, excludeList),
      dinner: buildMeal(MEAL_TEMPLATES.dinner, (tdee * pctDinner) / 100, includeList, excludeList),
      snack: buildMeal(MEAL_TEMPLATES.snack, (tdee * pctSnack) / 100, includeList, excludeList),
    };
    setMealPlan(plan);
    setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  }

  function handleKakaoShare() {
    if (!mealPlan || !window.Kakao) return;
    const total = sumMeal([
      ...mealPlan.breakfast, ...mealPlan.lunch, ...mealPlan.dinner, ...mealPlan.snack,
    ]);
    const bf = sumMeal(mealPlan.breakfast);
    const lu = sumMeal(mealPlan.lunch);
    const di = sumMeal(mealPlan.dinner);
    const sn = sumMeal(mealPlan.snack);

    const desc = [
      `권장칼로리: ${tdee} kcal`,
      `아침(${pctBreakfast}%): ${bf.kcal}kcal | 탄${bf.carb}g 단${bf.protein}g 지${bf.fat}g`,
      `점심(${pctLunch}%): ${lu.kcal}kcal | 탄${lu.carb}g 단${lu.protein}g 지${lu.fat}g`,
      `저녁(${pctDinner}%): ${di.kcal}kcal | 탄${di.carb}g 단${di.protein}g 지${di.fat}g`,
      `간식(${pctSnack}%): ${sn.kcal}kcal | 탄${sn.carb}g 단${sn.protein}g 지${sn.fat}g`,
      `합계: ${total.kcal}kcal | 탄${total.carb}g 단${total.protein}g 지${total.fat}g`,
    ].join("\n");

    window.Kakao.Share.sendDefault({
      objectType: "text",
      text: `[FIT STEP] ${name || "회원"}님의 하루 맞춤 식단\n\n${desc}`,
      link: { mobileWebUrl: window.location.href, webUrl: window.location.href },
    });
  }

  // Kakao SDK 로드
  useEffect(() => {
    if (window.Kakao) return;
    const script = document.createElement("script");
    script.src = "https://t1.kakaocdn.net/kakao_js_sdk/2.7.2/kakao.min.js";
    script.async = true;
    script.onload = () => {
      if (window.Kakao && !window.Kakao.isInitialized()) {
        // 실제 운영 시 발급받은 JavaScript 키로 교체하세요
        window.Kakao.init("YOUR_KAKAO_JS_KEY");
      }
    };
    document.head.appendChild(script);
  }, []);

  const mealLabels = [
    { key: "breakfast" as const, label: "아침", pct: pctBreakfast, emoji: "🌅" },
    { key: "lunch" as const, label: "점심", pct: pctLunch, emoji: "☀️" },
    { key: "dinner" as const, label: "저녁", pct: pctDinner, emoji: "🌙" },
    { key: "snack" as const, label: "건강 간식", pct: pctSnack, emoji: "🥗" },
  ];

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 pb-20">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 px-4 py-4">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-500/20 flex items-center justify-center">
            <Salad className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-base font-bold text-white">맞춤 식단 플래너</h1>
            <p className="text-xs text-gray-400">회원 정보 입력 → 하루 식단 자동 구성</p>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* ── 회원 기본 정보 ── */}
        <section className="bg-gray-900 rounded-2xl p-5 space-y-4 border border-gray-800">
          <div className="flex items-center gap-2 mb-1">
            <User className="w-4 h-4 text-emerald-400" />
            <h2 className="text-sm font-semibold text-gray-200">회원 기본 정보</h2>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* 이름 */}
            <div className="col-span-2">
              <label className="block text-xs text-gray-400 mb-1">이름</label>
              <input
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500"
                placeholder="홍길동"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            {/* 성별 */}
            <div>
              <label className="block text-xs text-gray-400 mb-1">성별</label>
              <div className="flex gap-2">
                {(["male", "female"] as const).map((g) => (
                  <button
                    key={g}
                    onClick={() => setGender(g)}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                      gender === g
                        ? "bg-emerald-500/20 border-emerald-500 text-emerald-400"
                        : "bg-gray-800 border-gray-700 text-gray-400"
                    }`}
                  >
                    {g === "male" ? "남" : "여"}
                  </button>
                ))}
              </div>
            </div>

            {/* 나이 */}
            <div>
              <label className="block text-xs text-gray-400 mb-1">나이 (세)</label>
              <input
                type="number"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500"
                placeholder="30"
                value={age}
                onChange={(e) => setAge(e.target.value)}
              />
            </div>

            {/* 체중 */}
            <div>
              <label className="block text-xs text-gray-400 mb-1">체중 (kg)</label>
              <input
                type="number"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500"
                placeholder="70"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
              />
            </div>

            {/* 키 */}
            <div>
              <label className="block text-xs text-gray-400 mb-1">키 (cm)</label>
              <input
                type="number"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500"
                placeholder="175"
                value={height}
                onChange={(e) => setHeight(e.target.value)}
              />
            </div>
          </div>

          {/* BMR / TDEE 자동 계산 표시 */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-800/60 rounded-xl p-3">
              <p className="text-xs text-gray-400 mb-1">기초대사량 (BMR)</p>
              <p className="text-lg font-bold text-emerald-400">{bmr ? `${bmr.toLocaleString()} kcal` : "—"}</p>
            </div>
            <div className="bg-gray-800/60 rounded-xl p-3">
              <p className="text-xs text-gray-400 mb-1">권장칼로리 (TDEE)</p>
              <p className="text-lg font-bold text-blue-400">{tdee ? `${tdee.toLocaleString()} kcal` : "—"}</p>
            </div>
          </div>

          {/* 활동수준 */}
          <div>
            <label className="block text-xs text-gray-400 mb-2">활동수준</label>
            <div className="grid grid-cols-3 gap-2">
              {([
                { value: "low", label: "낮음", sub: "×1.375" },
                { value: "moderate", label: "보통", sub: "×1.55" },
                { value: "high", label: "높음", sub: "×1.725" },
              ] as const).map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setActivity(opt.value)}
                  className={`py-2 px-3 rounded-lg border text-sm transition-colors ${
                    activity === opt.value
                      ? "bg-blue-500/20 border-blue-500 text-blue-400"
                      : "bg-gray-800 border-gray-700 text-gray-400"
                  }`}
                >
                  <div className="font-medium">{opt.label}</div>
                  <div className="text-xs opacity-70">{opt.sub}</div>
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* ── 음식 설정 ── */}
        <section className="bg-gray-900 rounded-2xl p-5 space-y-4 border border-gray-800">
          <div className="flex items-center gap-2 mb-1">
            <Utensils className="w-4 h-4 text-orange-400" />
            <h2 className="text-sm font-semibold text-gray-200">음식 설정</h2>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">포함할 음식 <span className="text-gray-600">(쉼표로 구분)</span></label>
            <input
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-orange-500"
              placeholder="예: 닭가슴살, 오트밀, 두부"
              value={includeFood}
              onChange={(e) => setIncludeFood(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">제외할 음식 <span className="text-gray-600">(쉼표로 구분)</span></label>
            <input
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-red-500"
              placeholder="예: 달걀, 우유, 소고기"
              value={excludeFood}
              onChange={(e) => setExcludeFood(e.target.value)}
            />
          </div>
        </section>

        {/* ── 식사 비율 설정 ── */}
        <section className="bg-gray-900 rounded-2xl p-5 space-y-4 border border-gray-800">
          <div className="flex items-center gap-2 mb-1">
            <Activity className="w-4 h-4 text-purple-400" />
            <h2 className="text-sm font-semibold text-gray-200">식사 비율 설정</h2>
            <span className={`ml-auto text-xs font-bold px-2 py-0.5 rounded-full ${pctTotal === 100 ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"}`}>
              합계 {pctTotal}%
            </span>
          </div>

          {ratioError && (
            <div className="flex items-center gap-2 text-red-400 text-xs bg-red-500/10 rounded-lg px-3 py-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              식사 비율의 합이 100%가 되어야 합니다.
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "🌅 아침", value: pctBreakfast, setter: setPctBreakfast, color: "text-yellow-400" },
              { label: "☀️ 점심", value: pctLunch, setter: setPctLunch, color: "text-orange-400" },
              { label: "🌙 저녁", value: pctDinner, setter: setPctDinner, color: "text-blue-400" },
              { label: "🥗 건강간식", value: pctSnack, setter: setPctSnack, color: "text-emerald-400" },
            ].map(({ label, value, setter, color }) => (
              <div key={label} className="bg-gray-800/60 rounded-xl p-3">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs text-gray-300">{label}</span>
                  <span className={`text-sm font-bold ${color}`}>{value}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={value}
                  onChange={(e) => setter(parseInt(e.target.value))}
                  className="w-full accent-emerald-500"
                />
              </div>
            ))}
          </div>
        </section>

        {/* 생성 버튼 */}
        <button
          onClick={handleGenerate}
          disabled={!tdee}
          className="w-full py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:bg-gray-700 disabled:text-gray-500 text-white font-bold text-sm transition-colors"
        >
          {tdee ? "식단 자동 생성" : "회원 정보를 먼저 입력하세요"}
        </button>

        {/* ── 식단 결과 ── */}
        {mealPlan && (
          <div ref={resultRef} className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-white">
                {name || "회원"}님의 하루 식단
              </h2>
              <button
                onClick={handleKakaoShare}
                className="flex items-center gap-1.5 text-xs bg-yellow-400 hover:bg-yellow-300 text-gray-900 font-bold px-3 py-1.5 rounded-lg transition-colors"
              >
                <Share2 className="w-3.5 h-3.5" />
                카카오 공유
              </button>
            </div>

            {/* 하루 요약 */}
            {(() => {
              const total = sumMeal([
                ...mealPlan.breakfast, ...mealPlan.lunch, ...mealPlan.dinner, ...mealPlan.snack,
              ]);
              return (
                <div className="bg-gradient-to-r from-emerald-900/40 to-blue-900/40 border border-emerald-800/40 rounded-2xl p-4 grid grid-cols-4 gap-2 text-center">
                  <div>
                    <p className="text-xs text-gray-400 mb-0.5">총 칼로리</p>
                    <p className="text-base font-bold text-emerald-400">{total.kcal.toLocaleString()}</p>
                    <p className="text-xs text-gray-500">kcal</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 mb-0.5">탄수화물</p>
                    <p className="text-base font-bold text-yellow-400">{total.carb}g</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 mb-0.5">단백질</p>
                    <p className="text-base font-bold text-blue-400">{total.protein}g</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 mb-0.5">지방</p>
                    <p className="text-base font-bold text-red-400">{total.fat}g</p>
                  </div>
                </div>
              );
            })()}

            {/* 끼니별 카드 */}
            {mealLabels.map(({ key, label, pct, emoji }) => {
              const entries = mealPlan[key];
              const sum = sumMeal(entries);
              return (
                <div key={key} className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
                  {/* 카드 헤더 */}
                  <div className="px-4 py-3 bg-gray-800/50 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{emoji}</span>
                      <span className="font-semibold text-sm text-white">{label}</span>
                      <span className="text-xs text-gray-500">({pct}%)</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      <span className="flex items-center gap-1 text-emerald-400 font-bold">
                        <Flame className="w-3.5 h-3.5" />{sum.kcal} kcal
                      </span>
                    </div>
                  </div>

                  {/* 매크로 요약 */}
                  <div className="px-4 pt-3 pb-2 grid grid-cols-3 gap-2 border-b border-gray-800">
                    <div className="flex items-center gap-1.5">
                      <Wheat className="w-3.5 h-3.5 text-yellow-400 shrink-0" />
                      <span className="text-xs text-gray-400">탄 <span className="text-yellow-400 font-semibold">{sum.carb}g</span></span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Beef className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                      <span className="text-xs text-gray-400">단 <span className="text-blue-400 font-semibold">{sum.protein}g</span></span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Droplets className="w-3.5 h-3.5 text-red-400 shrink-0" />
                      <span className="text-xs text-gray-400">지 <span className="text-red-400 font-semibold">{sum.fat}g</span></span>
                    </div>
                  </div>

                  {/* 음식 목록 */}
                  <div className="divide-y divide-gray-800/60">
                    {entries.map((e, i) => (
                      <div key={i} className="px-4 py-2.5 flex items-center justify-between">
                        <div>
                          <p className="text-sm text-white">{e.name}</p>
                          <p className="text-xs text-gray-500">{e.grams}g</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-emerald-400">{e.kcal} kcal</p>
                          <p className="text-xs text-gray-500">탄{e.carb} / 단{e.protein} / 지{e.fat}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}

            {/* 개인정보 안내 */}
            <p className="text-xs text-center text-gray-600">
              입력한 정보와 식단 결과는 서버에 저장되지 않습니다. 페이지를 나가면 데이터가 초기화됩니다.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// Kakao SDK window 타입 보강
declare global {
  interface Window {
    Kakao: any;
  }
}
