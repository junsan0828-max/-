import { useState, useEffect, useRef } from "react";
import { Salad, User, Activity, Utensils, Share2, AlertCircle, Flame, Wheat, Beef, Droplets, Loader2, RefreshCw } from "lucide-react";

const CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vRk00IJXvZha8RRaMK40XQ-C20WhhmPVHxLbxiUnPZZfy64fd8muHWuz_QbhNXjLDkqscnrbRQ-AzME/pub?gid=287813752&single=true&output=csv";

const KR_TO_MEAL: Record<string, keyof MealPlan> = {
  "아침": "breakfast",
  "점심": "lunch",
  "저녁": "dinner",
  "건강간식": "snack",
  "건강 간식": "snack",
};

// ─── 타입 ──────────────────────────────────────────────────────────────────────
interface MealDBItem {
  mealTime: "breakfast" | "lunch" | "dinner" | "snack";
  name: string;
  serving: string;
  kcal: number;
  carb: number;
  protein: number;
  fat: number;
}

interface MealEntry {
  name: string;
  serving: string;
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

// ─── CSV 파서 ──────────────────────────────────────────────────────────────────
function parseCSVRow(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (const char of line) {
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function parseFoodDB(csv: string): MealDBItem[] {
  const lines = csv.split(/\r?\n/);
  const items: MealDBItem[] = [];
  for (const line of lines) {
    const cols = parseCSVRow(line);
    const krCategory = cols[0]?.trim();
    const mealTime = KR_TO_MEAL[krCategory];
    if (!mealTime) continue;
    const name = cols[1]?.trim();
    const serving = cols[2]?.trim() ?? "";
    const kcal = parseFloat(cols[3]) || 0;
    const carb = parseFloat(cols[4]) || 0;
    const protein = parseFloat(cols[5]) || 0;
    const fat = parseFloat(cols[6]) || 0;
    if (!name || kcal === 0) continue;
    items.push({ mealTime, name, serving, kcal, carb, protein, fat });
  }
  return items;
}

// ─── 계산 함수 ─────────────────────────────────────────────────────────────────
function calcBMR(gender: string, age: number, weight: number, height: number): number {
  if (gender === "male") return Math.round(88.362 + 13.397 * weight + 4.799 * height - 5.677 * age);
  return Math.round(447.593 + 9.247 * weight + 3.098 * height - 4.330 * age);
}

const ACTIVITY_MULTIPLIER: Record<string, number> = { low: 1.375, moderate: 1.55, high: 1.725 };

function calcTDEE(bmr: number, activity: string): number {
  return Math.round(bmr * (ACTIVITY_MULTIPLIER[activity] ?? 1.55));
}

function buildMealFromDB(
  dbItems: MealDBItem[],
  mealTime: keyof MealPlan,
  targetKcal: number,
  includeList: string[],
  excludeList: string[]
): MealEntry[] {
  const excLower = excludeList.map((s) => s.toLowerCase().trim()).filter(Boolean);
  const incLower = includeList.map((s) => s.toLowerCase().trim()).filter(Boolean);

  let candidates = dbItems.filter((item) => item.mealTime === mealTime);

  if (excLower.length > 0) {
    candidates = candidates.filter(
      (item) =>
        !excLower.some(
          (ex) => item.name.toLowerCase().includes(ex) || item.serving.toLowerCase().includes(ex)
        )
    );
  }

  if (candidates.length === 0) return [];

  let pool = candidates;
  if (incLower.length > 0) {
    const matching = candidates.filter((item) =>
      incLower.some(
        (inc) => item.name.toLowerCase().includes(inc) || item.serving.toLowerCase().includes(inc)
      )
    );
    if (matching.length > 0) pool = matching;
  }

  const best = pool.reduce((prev, curr) =>
    Math.abs(curr.kcal - targetKcal) < Math.abs(prev.kcal - targetKcal) ? curr : prev
  );

  return [{ name: best.name, serving: best.serving, kcal: best.kcal, carb: best.carb, protein: best.protein, fat: best.fat }];
}

function sumMeal(entries: MealEntry[]) {
  return entries.reduce(
    (acc, e) => ({ kcal: acc.kcal + e.kcal, carb: acc.carb + e.carb, protein: acc.protein + e.protein, fat: acc.fat + e.fat }),
    { kcal: 0, carb: 0, protein: 0, fat: 0 }
  );
}

// ─── 컴포넌트 ──────────────────────────────────────────────────────────────────
export default function DietPlanner() {
  const [name, setName] = useState("");
  const [gender, setGender] = useState<"male" | "female">("male");
  const [age, setAge] = useState("");
  const [weight, setWeight] = useState("");
  const [height, setHeight] = useState("");
  const [activity, setActivity] = useState<"low" | "moderate" | "high">("moderate");
  const [includeFood, setIncludeFood] = useState("");
  const [excludeFood, setExcludeFood] = useState("");

  const [pctBreakfast, setPctBreakfast] = useState(25);
  const [pctLunch, setPctLunch] = useState(35);
  const [pctDinner, setPctDinner] = useState(30);
  const [pctSnack, setPctSnack] = useState(10);

  const [mealPlan, setMealPlan] = useState<MealPlan | null>(null);
  const [ratioError, setRatioError] = useState(false);

  const [dbItems, setDbItems] = useState<MealDBItem[]>([]);
  const [dbLoading, setDbLoading] = useState(true);
  const [dbError, setDbError] = useState(false);

  const resultRef = useRef<HTMLDivElement>(null);

  function loadDB() {
    setDbLoading(true);
    setDbError(false);
    fetch(CSV_URL)
      .then((res) => {
        if (!res.ok) throw new Error("fetch failed");
        return res.text();
      })
      .then((csv) => {
        const items = parseFoodDB(csv);
        setDbItems(items);
        setDbLoading(false);
      })
      .catch(() => {
        setDbError(true);
        setDbLoading(false);
      });
  }

  useEffect(() => { loadDB(); }, []);

  const bmr =
    age && weight && height
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
      breakfast: buildMealFromDB(dbItems, "breakfast", (tdee * pctBreakfast) / 100, includeList, excludeList),
      lunch: buildMealFromDB(dbItems, "lunch", (tdee * pctLunch) / 100, includeList, excludeList),
      dinner: buildMealFromDB(dbItems, "dinner", (tdee * pctDinner) / 100, includeList, excludeList),
      snack: buildMealFromDB(dbItems, "snack", (tdee * pctSnack) / 100, includeList, excludeList),
    };
    setMealPlan(plan);
    setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  }

  function handleKakaoShare() {
    if (!mealPlan || !window.Kakao) return;
    const total = sumMeal([...mealPlan.breakfast, ...mealPlan.lunch, ...mealPlan.dinner, ...mealPlan.snack]);
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

  useEffect(() => {
    if (window.Kakao) return;
    const script = document.createElement("script");
    script.src = "https://t1.kakaocdn.net/kakao_js_sdk/2.7.2/kakao.min.js";
    script.async = true;
    script.onload = () => {
      if (window.Kakao && !window.Kakao.isInitialized()) window.Kakao.init("YOUR_KAKAO_JS_KEY");
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
          <div className="ml-auto flex items-center gap-2">
            {dbLoading && (
              <span className="flex items-center gap-1.5 text-xs text-gray-400">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />식품 DB 로딩 중
              </span>
            )}
            {!dbLoading && !dbError && (
              <span className="text-xs text-emerald-400">식품 DB {dbItems.length}개</span>
            )}
            {dbError && (
              <button onClick={loadDB} className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300">
                <RefreshCw className="w-3.5 h-3.5" />재시도
              </button>
            )}
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
            <div className="col-span-2">
              <label className="block text-xs text-gray-400 mb-1">이름</label>
              <input
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500"
                placeholder="홍길동"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
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
            <div>
              <label className="block text-xs text-gray-400 mb-1">나이 (세)</label>
              <input type="number" className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500" placeholder="30" value={age} onChange={(e) => setAge(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">체중 (kg)</label>
              <input type="number" className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500" placeholder="70" value={weight} onChange={(e) => setWeight(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">키 (cm)</label>
              <input type="number" className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500" placeholder="175" value={height} onChange={(e) => setHeight(e.target.value)} />
            </div>
          </div>
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
              placeholder="예: 닭가슴살, 연어, 두부"
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
            <span
              className={`ml-auto text-xs font-bold px-2 py-0.5 rounded-full ${
                pctTotal === 100 ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"
              }`}
            >
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
          disabled={!tdee || dbLoading || dbItems.length === 0}
          className="w-full py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:bg-gray-700 disabled:text-gray-500 text-white font-bold text-sm transition-colors"
        >
          {dbLoading
            ? "식품 DB 로딩 중..."
            : dbItems.length === 0
            ? "식품 DB를 불러올 수 없습니다"
            : !tdee
            ? "회원 정보를 먼저 입력하세요"
            : "식단 자동 생성"}
        </button>

        {/* ── 식단 결과 ── */}
        {mealPlan && (
          <div ref={resultRef} className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-white">{name || "회원"}님의 하루 식단</h2>
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
              const total = sumMeal([...mealPlan.breakfast, ...mealPlan.lunch, ...mealPlan.dinner, ...mealPlan.snack]);
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
                  <div className="px-4 py-3 bg-gray-800/50 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{emoji}</span>
                      <span className="font-semibold text-sm text-white">{label}</span>
                      <span className="text-xs text-gray-500">({pct}%)</span>
                    </div>
                    <span className="flex items-center gap-1 text-emerald-400 font-bold text-xs">
                      <Flame className="w-3.5 h-3.5" />{sum.kcal} kcal
                    </span>
                  </div>
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
                  <div className="divide-y divide-gray-800/60">
                    {entries.length === 0 ? (
                      <p className="px-4 py-3 text-xs text-gray-500">해당 끼니의 식단이 없습니다</p>
                    ) : (
                      entries.map((e, i) => (
                        <div key={i} className="px-4 py-2.5 flex items-center justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-white font-medium">{e.name}</p>
                            {e.serving && <p className="text-xs text-gray-500 truncate">{e.serving}</p>}
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-sm font-semibold text-emerald-400">{e.kcal} kcal</p>
                            <p className="text-xs text-gray-500">탄{e.carb} / 단{e.protein} / 지{e.fat}</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}

            <p className="text-xs text-center text-gray-600">
              입력한 정보와 식단 결과는 서버에 저장되지 않습니다. 페이지를 나가면 데이터가 초기화됩니다.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

declare global {
  interface Window { Kakao: any; }
}
