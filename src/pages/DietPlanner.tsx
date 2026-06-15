import { useState, useEffect, useRef } from "react";
import { Salad, User, Activity, Utensils, Share2, Check, AlertCircle, Flame, Wheat, Beef, Droplets, Loader2, RefreshCw, Dumbbell, Lock, Zap, ChevronRight, Leaf, TrendingDown } from "lucide-react";

const CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vRk00IJXvZha8RRaMK40XQ-C20WhhmPVHxLbxiUnPZZfy64fd8muHWuz_QbhNXjLDkqscnrbRQ-AzME/pub?gid=287813752&single=true&output=csv";

// ─── 카운터: Supabase 우선, 미설정 시 localStorage 폴백 ──────────────────────
function _todayKey() { return new Date().toISOString().slice(0,10).replace(/-/g,""); }
function _lsNum(key: string) { return parseInt(localStorage.getItem(key)||"0"); }
function _lsInc(key: string) { const n=_lsNum(key)+1; localStorage.setItem(key,String(n)); return n; }

const _SB_URL  = (import.meta.env.VITE_SUPABASE_URL  as string | undefined) ?? "";
const _SB_KEY  = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ?? "";
const _SB_HDR  = () => ({ "Content-Type":"application/json", apikey:_SB_KEY, Authorization:`Bearer ${_SB_KEY}` });

async function remoteInc(key: string): Promise<number> {
  if (!_SB_URL || !_SB_KEY) return _lsInc(key);
  try {
    const res = await fetch(`${_SB_URL}/rest/v1/rpc/dp_inc_counter`, {
      method: "POST", headers: _SB_HDR(),
      body: JSON.stringify({ p_key: key }),
    });
    if (!res.ok) throw new Error();
    const n = await res.json() as number;
    localStorage.setItem(key, String(n));
    return n;
  } catch { return _lsInc(key); }
}

async function remoteGet(key: string): Promise<number> {
  if (!_SB_URL || !_SB_KEY) return _lsNum(key);
  try {
    const res = await fetch(`${_SB_URL}/rest/v1/dp_counters?key=eq.${key}&select=value`, {
      headers: _SB_HDR(),
    });
    if (!res.ok) throw new Error();
    const data = await res.json() as {value:number}[];
    const n = data[0]?.value ?? _lsNum(key);
    localStorage.setItem(key, String(n));
    return n;
  } catch { return _lsNum(key); }
}

// ─── 사용자 유형 & 이용 제한 ───────────────────────────────────────────────────
type UserType = "member" | "trainer" | "fitstep";
const DAILY_LIMITS: Record<string, number> = { guest: 2, member: 5, trainer: 10, fitstep: 99999 };
function getTodayGenKey() { return `dp_gen_${new Date().toISOString().slice(0,10).replace(/-/g,"")}`; }
function getGenCount()    { return parseInt(localStorage.getItem(getTodayGenKey()) || "0"); }
function incGenCount()    { const k = getTodayGenKey(); const n = getGenCount()+1; localStorage.setItem(k,String(n)); return n; }

// ─── 현실 식단 DB ──────────────────────────────────────────────────────────────
type RealCat = "C"|"P"|"F"|"V"|"S"; // 탄수화물/단백질/지방/채소/간식
interface RealFoodItem { cat:RealCat; meals:("breakfast"|"lunch"|"dinner"|"snack")[]; name:string; serving:string; kcal:number; carb:number; protein:number; fat:number; }

// [cat, mealBits(1=아침,2=점심,4=저녁,8=간식), name, kcal/100g, carb/100g, prot/100g, fat/100g]
type RFB = [RealCat,number,string,number,number,number,number];
const _RFB: RFB[] = [
  // ── 탄수화물 ───────────────────────────────────────────────────────────────
  ["C",7,"현미밥",168,37.0,3.6,1.3],["C",7,"백미밥",180,39.4,2.8,0.3],
  ["C",7,"잡곡밥",172,37.5,3.5,1.0],["C",7,"보리밥",158,34.8,4.0,0.8],
  ["C",7,"흑미밥",175,38.5,3.8,1.2],["C",7,"귀리밥",185,33.8,5.8,3.2],
  ["C",7,"콩밥",185,35.0,6.5,2.0],["C",7,"찰밥",195,44.0,3.5,0.5],
  ["C",7,"현미보리밥",163,35.8,4.0,1.0],["C",7,"오분도미밥",176,38.0,3.4,1.0],
  ["C",7,"현미귀리밥",178,36.5,4.5,2.0],["C",7,"팥밥",180,38.5,5.0,0.5],
  ["C",7,"기장밥",185,40.0,4.5,1.5],["C",7,"수수밥",178,38.0,4.2,1.2],
  ["C",7,"퀴노아밥",190,32.0,7.0,3.5],
  ["C",7,"찐고구마",103,23.5,1.5,0.1],["C",7,"군고구마",110,25.0,1.5,0.2],
  ["C",7,"자색고구마",105,24.0,1.5,0.1],["C",7,"찐감자",80,18.0,2.0,0.1],
  ["C",7,"삶은감자",78,17.5,2.1,0.1],["C",7,"으깬감자",95,20.0,2.0,0.5],
  ["C",3,"오트밀(건)",389,66.0,13.0,7.0],["C",3,"퀵오트밀(건)",368,63.0,13.0,6.0],
  ["C",3,"압착귀리(건)",389,68.0,13.0,7.0],["C",3,"롤드오트(건)",380,67.0,13.0,6.5],
  ["C",3,"스틸컷오트(건)",371,64.0,13.0,7.0],
  ["C",7,"통밀식빵",248,47.0,9.0,2.5],["C",7,"호밀빵",260,49.0,9.5,3.0],
  ["C",7,"잡곡빵",265,51.0,9.0,3.0],["C",3,"베이글",270,55.0,9.5,1.5],
  ["C",7,"식빵",265,51.0,8.0,3.0],["C",7,"통밀크래커",420,65.0,12.0,14.0],
  ["C",7,"라이스케이크",387,87.0,7.0,0.5],
  ["C",7,"통밀파스타(건)",356,74.0,12.0,1.5],["C",7,"메밀면(건)",346,72.0,13.0,1.5],
  ["C",6,"쌀국수(건)",360,80.0,6.0,0.5],["C",6,"당면(건)",344,85.0,0.5,0.2],
  ["C",6,"소면(건)",349,73.0,11.0,1.0],["C",6,"우동면(생)",168,35.0,5.0,0.5],
  ["C",6,"두부면",98,3.5,10.0,6.0],["C",6,"곤약면",9,2.0,0.3,0.0],
  ["C",6,"실곤약",8,1.8,0.2,0.0],
  ["C",15,"바나나",89,23.0,1.1,0.3],["C",15,"사과",52,14.0,0.3,0.2],
  ["C",15,"배",57,15.0,0.4,0.1],["C",15,"오렌지",47,12.0,0.9,0.1],
  ["C",8,"귤",53,13.5,0.8,0.1],["C",8,"딸기",33,7.7,0.7,0.3],
  ["C",8,"블루베리",57,14.5,0.7,0.3],["C",8,"체리",63,16.0,1.1,0.2],
  ["C",8,"포도",69,18.0,0.7,0.2],["C",8,"수박",30,7.6,0.6,0.2],
  ["C",8,"키위",61,15.0,1.1,0.5],["C",8,"망고",60,15.0,0.8,0.4],
  ["C",8,"파인애플",50,13.0,0.5,0.1],["C",8,"복숭아",39,9.5,0.9,0.3],
  ["C",8,"자두",46,11.0,0.7,0.3],["C",8,"냉동딸기",33,7.7,0.7,0.3],
  ["C",8,"냉동블루베리",57,14.5,0.7,0.3],["C",8,"냉동망고",60,15.0,0.8,0.4],
  ["C",7,"옥수수(삶은)",96,21.0,3.5,1.2],["C",7,"단호박(찐)",49,11.5,1.6,0.3],
  ["C",7,"밤(삶은)",245,54.0,3.5,1.0],["C",7,"토란(삶은)",58,13.5,1.4,0.2],
  ["C",7,"연근(삶은)",74,17.5,2.0,0.1],["C",3,"그래놀라",450,65.0,10.0,18.0],
  ["C",7,"현미떡",219,48.0,4.0,1.0],["C",7,"흑임자죽(건)",370,68.0,9.0,10.0],
  ["C",7,"아마란스(삶은)",102,19.0,3.8,1.6],["C",7,"타피오카",358,88.0,0.2,0.0],
  ["C",7,"현미미숫가루",365,75.0,8.5,4.5],["C",3,"통밀뮤즐리",349,61.0,11.0,7.0],
  ["C",7,"삶은옥수수(낟알)",108,25.0,3.3,1.4],["C",7,"누룽지",362,80.0,8.0,1.5],
  ["C",6,"냉동볶음밥베이스",145,30.0,3.5,1.5],["C",7,"압맥(보리)",354,73.0,9.0,2.0],
  ["C",7,"흰강낭콩(삶은)",127,23.0,8.7,0.5],["C",7,"서리태(삶은)",143,11.0,12.0,7.0],
  // ── 단백질 ───────────────────────────────────────────────────────────────
  ["P",7,"삶은닭가슴살",165,0,31.0,3.6],["P",7,"구운닭가슴살",168,0,31.5,4.0],
  ["P",7,"훈제닭가슴살",130,1.5,24.0,2.5],["P",7,"닭안심(삶은)",120,0,26.0,1.2],
  ["P",6,"닭다리살(뼈없이)",185,0,27.0,8.0],["P",7,"수비드닭가슴살",155,0,29.0,3.5],
  ["P",7,"닭가슴살큐브",152,2.5,28.0,3.0],["P",7,"닭가슴살볼",158,3.0,27.0,3.5],
  ["P",7,"닭가슴살스테이크",160,1.0,30.0,3.8],
  ["P",7,"연어(구운)",208,0,20.0,13.0],["P",7,"연어(생)",142,0,19.8,6.7],
  ["P",7,"훈제연어",117,0,18.0,4.5],["P",7,"고등어(구운)",205,0,20.0,13.0],
  ["P",6,"꽁치(구운)",195,0,20.0,12.0],["P",6,"갈치(구운)",143,0,22.0,5.0],
  ["P",6,"대구(구운)",105,0,23.0,1.0],["P",6,"조기(구운)",155,0,22.0,7.0],
  ["P",6,"명태(구운)",90,0,21.0,0.5],["P",6,"동태(구운)",88,0,20.5,0.5],
  ["P",7,"새우(삶은)",99,0,20.0,1.5],["P",6,"오징어(삶은)",92,3,19.0,1.2],
  ["P",6,"낙지(삶은)",82,0,17.0,1.0],["P",6,"굴(생)",69,4,8.0,2.5],
  ["P",6,"홍합(삶은)",86,3.7,12.0,2.0],["P",6,"바지락(삶은)",74,2,15.0,1.5],
  ["P",7,"소고기(안심)",216,0,20.6,14.0],["P",7,"소고기(우둔)",165,0,22.0,8.0],
  ["P",6,"소고기(홍두깨살)",150,0,22.5,6.5],["P",7,"소고기(사태)",145,0,21.0,6.0],
  ["P",6,"돼지고기(앞다리)",190,0,19.0,12.5],["P",6,"돼지고기(안심)",143,0,22.4,5.5],
  ["P",6,"돼지고기(등심)",165,0,20.0,9.0],
  ["P",7,"두부(일반)",76,2,8.0,4.0],["P",7,"두부(연두부)",54,2.5,5.0,2.5],
  ["P",7,"두부(순두부)",42,0.7,4.5,2.0],["P",7,"두부(단단한두부)",85,2,9.0,4.5],
  ["P",7,"두부(부침두부)",82,2,8.5,4.2],
  ["P",7,"에다마메(냉동)",122,8.9,11.0,5.2],["P",7,"삶은콩",147,8.5,9.3,8.0],
  ["P",7,"검은콩(삶은)",150,8.5,9.5,8.0],["P",7,"렌틸콩(삶은)",116,20.0,9.0,0.4],
  ["P",3,"그릭요거트(무가당)",59,3.6,10.0,0.4],["P",3,"저지방그릭요거트",70,5,9.0,1.0],
  ["P",3,"프로틴그릭요거트",80,5,14.0,0.5],["P",3,"코티지치즈",98,3.4,11.1,4.3],
  ["P",3,"리코타치즈",174,3.5,7.0,13.0],
  ["P",3,"저지방우유",50,5.0,3.4,1.4],["P",3,"무지방우유",34,5.0,3.4,0.1],
  ["P",3,"두유(무가당)",45,1.8,3.6,2.0],["P",3,"아몬드밀크(무가당)",15,0.3,0.5,1.0],
  ["P",7,"오리고기(구운)",337,0,16.5,29.0],["P",7,"오리가슴살(구운)",190,0,22,10.0],
  ["P",6,"닭간(삶은)",119,0.7,18.9,4.2],["P",7,"쇠고기(샤브샤브용)",145,0,20,7.0],
  ["P",7,"새우살(냉동)",85,0,18.0,1.0],["P",6,"전복(삶은)",90,5,17,0.5],
  ["P",6,"우렁살(삶은)",76,3.5,14,1.0],["P",7,"실란트로두부",72,1.8,8.5,3.5],
  ["P",3,"케피어",63,4.5,3.2,3.5],["P",7,"삶은병아리콩",164,27,9,2.6],
  ["P",7,"닭가슴살(냉동구이)",160,0.5,30,3.8],["P",7,"칠면조가슴살",135,0,29,1.5],
  ["P",6,"조개관자(삶은)",107,7,17,1.5],["P",6,"문어(삶은)",82,2.5,15,1.2],
  ["P",3,"스키어(아이슬란드요거트)",67,4,12,0.2],["P",6,"가자미(구운)",103,0,22,1.3],
  // ── 지방 ─────────────────────────────────────────────────────────────────
  ["F",15,"아몬드",579,22,21,49],["F",15,"호두",654,14,15,65],
  ["F",15,"캐슈넛",553,30,18,44],["F",15,"피스타치오",562,28,20,45],
  ["F",15,"마카다미아",718,14,8,76],["F",15,"피칸",691,14,9,72],
  ["F",15,"브라질너트",656,12,14,66],["F",15,"해바라기씨",584,20,21,51],
  ["F",15,"호박씨",559,11,30,49],["F",15,"아마씨(분말)",534,29,18,42],
  ["F",15,"치아씨드",486,42,17,31],["F",15,"혼합견과",614,19,16,52],
  ["F",15,"땅콩버터",598,22,25,50],["F",15,"아몬드버터",614,19,21,55],
  ["F",15,"아보카도",160,9,2,15],
  // ── 채소 ─────────────────────────────────────────────────────────────────
  ["V",15,"브로콜리",34,7,2.8,0.4],["V",15,"시금치",23,3.6,2.9,0.4],
  ["V",15,"케일",49,9,4.3,0.9],["V",15,"상추",15,2.9,1.4,0.2],
  ["V",15,"양배추",25,6,1.3,0.1],["V",15,"적양배추",31,7,1.4,0.1],
  ["V",15,"당근",41,10,0.9,0.2],["V",15,"파프리카(빨강)",31,7.6,1.0,0.3],
  ["V",15,"파프리카(노랑)",27,6.3,1.0,0.2],["V",15,"파프리카(초록)",20,4.6,0.9,0.2],
  ["V",15,"오이",15,3.6,0.7,0.1],["V",15,"셀러리",14,3,0.7,0.2],
  ["V",15,"콜리플라워",25,5,1.9,0.3],["V",15,"아스파라거스",20,3.9,2.2,0.1],
  ["V",15,"토마토",18,3.9,0.9,0.2],["V",15,"방울토마토",18,3.9,0.9,0.2],
  ["V",15,"양파",40,9,1.1,0.1],["V",15,"애호박",17,3.6,1.2,0.2],
  ["V",15,"가지",25,5.9,1.0,0.2],["V",15,"청경채",13,2.2,1.5,0.2],
  ["V",15,"깻잎",43,7.5,4.0,1.0],["V",15,"부추",29,5.0,2.4,0.4],
  ["V",15,"쑥갓",22,3.8,2.0,0.4],["V",15,"고사리(삶은)",35,6.5,3.0,0.5],
  ["V",15,"느타리버섯",22,4.3,2.4,0.3],["V",15,"팽이버섯",37,8,2.7,0.3],
  ["V",15,"새송이버섯",28,5.4,2.0,0.4],["V",15,"표고버섯",34,6.8,2.2,0.5],
  ["V",15,"양송이버섯",22,3.3,3.1,0.3],["V",15,"목이버섯(건)",280,61,14,1.5],
  ["V",7,"김치",15,2.4,1.1,0.3],["V",7,"깍두기",20,4,1.0,0.2],
  ["V",7,"시금치나물",38,5,3.0,1.0],["V",7,"콩나물",30,4,3.0,0.5],
  ["V",7,"숙주나물",12,2.1,1.7,0.2],["V",7,"취나물",28,4.5,3.0,0.5],
  ["V",7,"도라지나물",45,9,1.5,0.3],["V",7,"무나물",25,5,1.0,0.3],
  ["V",7,"냉동혼합채소",50,10,2.5,0.5],["V",15,"편의점샐러드",20,3,1.5,0.5],
  ["V",15,"새싹채소",32,5,3.0,0.5],["V",15,"루꼴라",25,3.6,2.6,0.7],
  ["V",15,"적상추",16,2.9,1.4,0.2],["V",15,"청경채(데친)",13,1.8,1.5,0.3],
  ["V",15,"냉동브로콜리",28,5.5,3.0,0.3],["V",15,"냉동시금치",23,3.5,2.8,0.4],
  ["V",7,"나물(비빔용혼합)",40,6,3.0,1.0],["V",7,"고구마줄기(나물)",28,5,1.8,0.5],
  ["V",7,"열무김치",12,2,1.0,0.3],["V",7,"백김치",18,3.5,1.2,0.2],
  ["V",15,"파프리카(혼합)",27,6,1.0,0.2],["V",15,"비트",43,10,1.6,0.2],
  ["V",15,"무(생)",18,4.1,0.7,0.1],["V",15,"오이(절임)",11,2.5,0.5,0.1],
  ["V",7,"우거지",25,4.8,1.8,0.3],["V",7,"고들빼기김치",15,2,1.1,0.3],
];

// 제공량별 자동 확장 (각 식품 × 서빙 사이즈 = 2000+ 항목)
const _SIZES: Record<RealCat, number[]> = {
  C: [60,75,100,120,150,175,200,250,300,350],
  P: [40,50,75,100,125,150,175,200,250],
  F: [5,8,10,12,15,20,25,30],
  V: [30,50,75,100,150,200,250,300],
  S: [],
};
const _MEAL_MAP: Record<number,("breakfast"|"lunch"|"dinner"|"snack")[]> = {
  1:["breakfast"],2:["lunch"],4:["dinner"],8:["snack"],
  3:["breakfast","lunch"],5:["breakfast","dinner"],6:["lunch","dinner"],
  7:["breakfast","lunch","dinner"],9:["breakfast","snack"],
  14:["lunch","dinner","snack"],15:["breakfast","lunch","dinner","snack"],
};

function _expand(base: RFB[]): RealFoodItem[] {
  const out: RealFoodItem[] = [];
  for (const [cat,bits,name,k100,c100,p100,f100] of base) {
    const sizes = _SIZES[cat];
    const meals = _MEAL_MAP[bits] ?? ["breakfast","lunch","dinner"];
    for (const g of sizes) {
      out.push({ cat, meals, name, serving:`${g}g`,
        kcal: Math.round(k100*g/100),
        carb: Math.round(c100*g/100*10)/10,
        protein: Math.round(p100*g/100*10)/10,
        fat: Math.round(f100*g/100*10)/10,
      });
    }
  }
  return out;
}

// 개수 기반 고정 항목 (계란, 소시지, 통조림 등)
const _RF_FIXED: RealFoodItem[] = [
  // 닭가슴살 소시지
  ...([1,2,3,4,5] as const).map(n=>({cat:"P" as RealCat,meals:["breakfast","lunch","dinner","snack"] as ("breakfast"|"lunch"|"dinner"|"snack")[],name:"닭가슴살소시지",serving:`${n}개`,kcal:n*55,carb:n*1,protein:n*9,fat:n*2})),
  // 삶은 계란
  ...([1,2,3,4,5] as const).map(n=>({cat:"P" as RealCat,meals:["breakfast","lunch","dinner","snack"] as ("breakfast"|"lunch"|"dinner"|"snack")[],name:"삶은계란",serving:`${n}개`,kcal:n*78,carb:+(n*0.6).toFixed(1),protein:+(n*6.3).toFixed(1),fat:+(n*5.3).toFixed(1)})),
  // 달걀흰자
  ...([1,2,3,4,5] as const).map(n=>({cat:"P" as RealCat,meals:["breakfast","lunch","dinner","snack"] as ("breakfast"|"lunch"|"dinner"|"snack")[],name:"달걀흰자",serving:`${n}개분`,kcal:n*17,carb:+(n*0.2).toFixed(1),protein:+(n*3.6).toFixed(1),fat:+(n*0.1).toFixed(1)})),
  // 참치캔
  {cat:"P",meals:["lunch","dinner","snack"],name:"참치캔(물)",serving:"1/2캔",kcal:58,carb:0,protein:13,fat:0.3},
  {cat:"P",meals:["lunch","dinner","snack"],name:"참치캔(물)",serving:"1캔",kcal:116,carb:0,protein:26,fat:0.6},
  {cat:"P",meals:["lunch","dinner","snack"],name:"참치캔(물)",serving:"1.5캔",kcal:174,carb:0,protein:39,fat:0.9},
  {cat:"P",meals:["lunch","dinner"],name:"고등어통조림",serving:"1/2캔",kcal:190,carb:0,protein:17,fat:13},
  {cat:"P",meals:["lunch","dinner"],name:"고등어통조림",serving:"1캔",kcal:380,carb:0,protein:34,fat:26},
  // 프로틴
  {cat:"P",meals:["breakfast","snack"],name:"프로틴파우더",serving:"1스쿱(25g)",kcal:95,carb:3,protein:20,fat:1},
  {cat:"P",meals:["breakfast","snack"],name:"프로틴파우더",serving:"2스쿱(50g)",kcal:190,carb:6,protein:40,fat:2},
  {cat:"P",meals:["breakfast","snack"],name:"프로틴드링크",serving:"1병(250ml)",kcal:130,carb:5,protein:25,fat:1.5},
  // 삼각김밥
  ...["참치마요","불고기","김치","계란","연어","명란","스팸","참치김치","닭가슴살","새우마요"].map((f,i)=>({
    cat:"C" as RealCat,meals:["breakfast","lunch","snack"] as ("breakfast"|"lunch"|"dinner"|"snack")[],
    name:`삼각김밥(${f})`,serving:"1개",kcal:185+i*5,carb:33,protein:5+Math.floor(i/3),fat:4+Math.floor(i/4)
  })),
  // 편의점 도시락
  {cat:"C",meals:["lunch","dinner"],name:"편의점도시락(불고기)",serving:"1개",kcal:520,carb:75,protein:22,fat:14},
  {cat:"C",meals:["lunch","dinner"],name:"편의점도시락(제육볶음)",serving:"1개",kcal:560,carb:72,protein:24,fat:17},
  {cat:"C",meals:["lunch","dinner"],name:"편의점도시락(닭갈비)",serving:"1개",kcal:490,carb:68,protein:25,fat:13},
  {cat:"C",meals:["lunch","dinner"],name:"편의점도시락(비빔밥)",serving:"1개",kcal:420,carb:65,protein:15,fat:10},
  // 그릭요거트 (개수 기반)
  {cat:"P",meals:["breakfast","snack"],name:"그릭요거트(무가당)",serving:"1개(100g)",kcal:59,carb:3.6,protein:10,fat:0.4},
  {cat:"P",meals:["breakfast","snack"],name:"그릭요거트(무가당)",serving:"2개(200g)",kcal:118,carb:7.2,protein:20,fat:0.8},
  {cat:"P",meals:["breakfast","snack"],name:"저지방그릭요거트",serving:"1개(100g)",kcal:70,carb:5,protein:9,fat:1},
  {cat:"P",meals:["breakfast","snack"],name:"저지방그릭요거트",serving:"2개(200g)",kcal:140,carb:10,protein:18,fat:2},
  // 두유/우유
  {cat:"P",meals:["breakfast","snack"],name:"두유(무가당)",serving:"200ml",kcal:90,carb:3.6,protein:7.2,fat:4},
  {cat:"P",meals:["breakfast","snack"],name:"두유(무가당)",serving:"300ml",kcal:135,carb:5.4,protein:10.8,fat:6},
  {cat:"P",meals:["breakfast","snack"],name:"저지방우유",serving:"200ml",kcal:100,carb:10,protein:6.8,fat:2.8},
  {cat:"P",meals:["breakfast","snack"],name:"저지방우유",serving:"300ml",kcal:150,carb:15,protein:10.2,fat:4.2},
  // 견과류 소포장
  {cat:"F",meals:["breakfast","snack"],name:"혼합견과(소포장)",serving:"1봉(25g)",kcal:154,carb:5,protein:4,fat:13},
  {cat:"F",meals:["breakfast","snack"],name:"혼합견과(소포장)",serving:"2봉(50g)",kcal:307,carb:10,protein:8,fat:26},
  // 간식
  {cat:"S",meals:["snack"],name:"프로틴바",serving:"1개",kcal:220,carb:22,protein:20,fat:6},
  {cat:"S",meals:["snack"],name:"프로틴바",serving:"2개",kcal:440,carb:44,protein:40,fat:12},
  {cat:"S",meals:["snack"],name:"견과류바",serving:"1개",kcal:160,carb:16,protein:4,fat:9},
  {cat:"S",meals:["snack"],name:"라이스웨이퍼",serving:"3장",kcal:110,carb:24,protein:2,fat:0.5},
  {cat:"S",meals:["snack"],name:"단백질요거트드링크",serving:"1병",kcal:95,carb:8,protein:12,fat:1.5},
  {cat:"S",meals:["snack"],name:"오트쿠키",serving:"2개",kcal:130,carb:20,protein:3,fat:4},
  {cat:"S",meals:["snack"],name:"삶은옥수수",serving:"1개",kcal:155,carb:34,protein:5,fat:1.5},
  // 편의점 샐러드
  {cat:"V",meals:["lunch","dinner","snack"],name:"편의점샐러드(플레인)",serving:"1팩(150g)",kcal:30,carb:5,protein:2,fat:0.5},
  {cat:"V",meals:["lunch","dinner","snack"],name:"편의점샐러드(닭가슴살)",serving:"1팩(200g)",kcal:120,carb:7,protein:15,fat:3},
  {cat:"V",meals:["lunch","dinner","snack"],name:"편의점샐러드(에그)",serving:"1팩(200g)",kcal:150,carb:8,protein:10,fat:8},
  // 추가 고정 항목
  {cat:"C",meals:["breakfast","snack"],name:"에너지바(저당)",serving:"1개",kcal:180,carb:22,protein:10,fat:5},
  {cat:"P",meals:["lunch","dinner"],name:"닭가슴살통조림",serving:"1캔(135g)",kcal:148,carb:0,protein:31,fat:2},
  {cat:"P",meals:["lunch","dinner"],name:"닭가슴살통조림",serving:"2캔(270g)",kcal:296,carb:0,protein:62,fat:4},
  {cat:"P",meals:["breakfast","snack"],name:"단백질음료(190ml)",serving:"1병",kcal:75,carb:4,protein:12,fat:1},
  {cat:"S",meals:["snack"],name:"미숫가루(무가당)",serving:"30g+물",kcal:110,carb:22,protein:3.5,fat:1.5},
  {cat:"S",meals:["snack"],name:"두부과자",serving:"1봉(40g)",kcal:145,carb:12,protein:10,fat:6},
  {cat:"F",meals:["breakfast","snack"],name:"다크초콜릿(80%이상)",serving:"1조각(10g)",kcal:58,carb:3.5,protein:1,fat:5},
  {cat:"F",meals:["breakfast","snack"],name:"다크초콜릿(80%이상)",serving:"2조각(20g)",kcal:116,carb:7,protein:2,fat:10},
  // 편의점 닭가슴살 제품 (1/2/3개)
  ...([1,2,3] as const).map(n=>({cat:"P" as RealCat,meals:["breakfast","lunch","dinner","snack"] as ("breakfast"|"lunch"|"dinner"|"snack")[],name:"편의점훈제닭가슴살",serving:`${n}팩(${n*100}g)`,kcal:n*130,carb:n*1.5,protein:n*24,fat:n*2.5})),
  // 프로틴 요거트 (1/2개)
  ...([1,2] as const).map(n=>({cat:"P" as RealCat,meals:["breakfast","snack"] as ("breakfast"|"lunch"|"dinner"|"snack")[],name:"프로틴요거트",serving:`${n}개(${n*100}g)`,kcal:n*80,carb:n*5,protein:n*14,fat:n*0.5})),
  // 삶은 고구마 개수 기반
  ...([1,2] as const).map(n=>({cat:"C" as RealCat,meals:["breakfast","lunch","dinner","snack"] as ("breakfast"|"lunch"|"dinner"|"snack")[],name:"삶은고구마",serving:`${n}개(${n*130}g)`,kcal:n*134,carb:n*30.6,protein:n*2,fat:n*0.1})),
  // 바나나 개수
  ...([1,2,3] as const).map(n=>({cat:"C" as RealCat,meals:["breakfast","lunch","dinner","snack"] as ("breakfast"|"lunch"|"dinner"|"snack")[],name:"바나나",serving:`${n}개`,kcal:n*89,carb:n*23,protein:n*1.1,fat:n*0.3})),
  // 보충 4개
  {cat:"S",meals:["snack"],name:"그린스무디(시판)",serving:"1병(250ml)",kcal:120,carb:22,protein:3,fat:2},
  {cat:"V",meals:["lunch","dinner"],name:"샐러드(집밥용)",serving:"1인분(180g)",kcal:45,carb:8,protein:2,fat:1},
  {cat:"C",meals:["breakfast","snack"],name:"쌀과자",serving:"1봉(30g)",kcal:120,carb:26,protein:2,fat:0.5},
  {cat:"C",meals:["breakfast","snack"],name:"쌀과자",serving:"2봉(60g)",kcal:240,carb:52,protein:4,fat:1},
  {cat:"P",meals:["lunch","dinner"],name:"두부면(1인분)",serving:"150g",kcal:147,carb:5,protein:15,fat:9},
  {cat:"P",meals:["lunch","dinner"],name:"두부면(1인분)",serving:"200g",kcal:196,carb:7,protein:20,fat:12},
  {cat:"V",meals:["breakfast","lunch","dinner","snack"],name:"토마토(방울)",serving:"15개",kcal:27,carb:5.9,protein:1.4,fat:0.3},
  {cat:"V",meals:["breakfast","lunch","dinner","snack"],name:"토마토(방울)",serving:"20개",kcal:36,carb:7.8,protein:1.8,fat:0.4},
  {cat:"F",meals:["breakfast","snack"],name:"올리브(절임)",serving:"10알",kcal:50,carb:1.5,protein:0.5,fat:4.5},
  {cat:"S",meals:["snack"],name:"아이스크림(저지방)",serving:"1개(100ml)",kcal:90,carb:15,protein:3,fat:2},
];

const REAL_FOOD_DB: RealFoodItem[] = [..._expand(_RFB), ..._RF_FIXED];

// ─── 현실성 점수 (1~5, 일반 한국인 식단 친숙도) ─────────────────────────────────
function getRealisticScore(name: string): number {
  const HIGH = ["현미밥","백미밥","잡곡밥","보리밥","귀리밥","콩밥","찰밥","고구마","감자",
    "바나나","사과","오트밀","식빵","통밀빵","베이글","옥수수",
    "닭가슴살","삶은계란","두부","연어","고등어","참치","새우","소고기","돼지고기","삼겹살",
    "그릭요거트","우유","두유","저지방우유",
    "브로콜리","시금치","상추","오이","토마토","당근","양배추","콩나물","무","배추","버섯","파프리카",
    "편의점","프로틴바","단백질","김치","된장"];
  const LOW = ["검은콩","목이버섯","아마란스","타피오카","흑임자죽","흑임자","현미미숫가루",
    "압맥","흰강낭콩","서리태","전복","우렁살","케피어","아마란스","퀴노아","스틸컷","곤약면","실곤약"];
  if (HIGH.some(k => name.includes(k))) return 5;
  if (LOW.some(k => name.includes(k))) return 2;
  return 3;
}

function buildRealMeal(
  time: "breakfast"|"lunch"|"dinner"|"snack",
  targetKcal: number,
  style: "realistic"|"healthy",
  goal: DietGoal | null
): MealEntry[] {
  if (targetKcal <= 0) return [];

  const pool = REAL_FOOD_DB.filter(f => f.meals.includes(time));
  const toEntry = (f: RealFoodItem): MealEntry => ({
    name: f.name, serving: f.serving, kcal: f.kcal, carb: f.carb, protein: f.protein, fat: f.fat
  });

  // 점수 기반 후보 선택 (상위 5개에서 랜덤)
  const pick = (arr: RealFoodItem[], budget: number, minScore = 1): RealFoodItem | null => {
    const filtered = arr.filter(f => getRealisticScore(f.name) >= minScore);
    const base = filtered.length ? filtered : arr;
    if (!base.length) return null;
    const scored = base
      .map(f => ({ f, s: Math.abs(f.kcal - budget) - (getRealisticScore(f.name) - 3) * 25 }))
      .sort((a, b) => a.s - b.s)
      .slice(0, 5);
    return scored[Math.floor(Math.random() * scored.length)].f;
  };

  // healthy 모드 최소 점수 기준
  const minScore = style === "healthy" ? 4 : 3;

  // ── 간식 ───────────────────────────────────────────────────────────────────
  if (time === "snack") {
    const snPool = pool.filter(f => f.cat === "S" || f.cat === "C" || f.cat === "P");
    const first = pick(snPool, targetKcal, minScore);
    if (!first) return [];
    const rem = targetKcal - first.kcal;
    if (rem >= 60) {
      const sec = pick(snPool.filter(f => f.name !== first.name && f.kcal <= rem * 1.4), rem, minScore);
      if (sec) return [toEntry(first), toEntry(sec)];
    }
    return [toEntry(first)];
  }

  // ── 칼로리 배분 비율 ────────────────────────────────────────────────────────
  const carbRatio = goal ? DIET_GOAL_CONFIG[goal].carb : 0.45;
  const protRatio = goal ? DIET_GOAL_CONFIG[goal].prot : 0.30;

  const carbBudget = targetKcal * carbRatio;
  const protBudget = targetKcal * protRatio;
  const vegBudget  = targetKcal * 0.12;

  const carbPool = pool.filter(f => f.cat === "C");
  const protPool = pool.filter(f => f.cat === "P");
  const vegPool  = pool.filter(f => f.cat === "V");

  const mainItem = pick(carbPool, carbBudget, minScore);
  const protItem = pick(protPool, protBudget, minScore);
  const veg1Item = pick(vegPool,  vegBudget,  minScore - 1);

  const items: RealFoodItem[] = [mainItem, protItem, veg1Item]
    .filter((x): x is RealFoodItem => x !== null);

  // 점심/저녁: 채소/반찬 1개 추가
  if (time !== "breakfast") {
    const used = new Set(items.map(i => i.name));
    const rem = Math.max(0, targetKcal - items.reduce((s, i) => s + i.kcal, 0));
    if (rem >= 20) {
      const veg2 = pick(vegPool.filter(f => !used.has(f.name)), rem * 0.5, minScore - 1);
      if (veg2) items.push(veg2);
    }
  }

  return items.map(toEntry);
}


// ─── 입장 환영 모달 ──────────────────────────────────────────────────────────
function WelcomeModal({ onClose }: { onClose: () => void }) {
  const tiers = [
    { Icon: Lock,     label: "비회원",          count: "2회 / 일",  countColor: "#6b7280" },
    { Icon: User,     label: "로그인 회원",     count: "5회 / 일",  countColor: "#34d399" },
    { Icon: Dumbbell, label: "운동전문가",      count: "10회 / 일", countColor: "#60a5fa" },
    { Icon: Zap,      label: "FIT STEP 회원",   count: "무제한",    countColor: "#059669" },
  ] as const;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-0 sm:px-4"
      style={{ background: "rgba(0,0,0,0.85)" }}
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-sm bg-gray-900 border border-white/[0.06] rounded-t-3xl sm:rounded-2xl overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="relative px-6 pt-8 pb-7 text-center overflow-hidden"
          style={{ background: "linear-gradient(160deg, #0a2a1f 0%, #0d3d2b 50%, #0f2744 100%)" }}>
          <div className="absolute inset-0" style={{ backgroundImage: "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(16,185,129,0.12) 0%, transparent 70%)" }} />
          <div className="relative">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl mb-4"
              style={{ background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.22)" }}>
              <Salad className="w-5 h-5 text-emerald-400" strokeWidth={1.5} />
            </div>
            <h2 className="text-[17px] font-bold text-white tracking-tight">맞춤 식단 플래너</h2>
            <p className="text-[11px] text-emerald-400/70 mt-1.5 font-medium tracking-wide uppercase">Personalized Nutrition Planner</p>
          </div>
        </div>

        {/* 콘텐츠 */}
        <div className="px-5 py-5 space-y-3.5">
          {/* 사용 대상 카드 2개 */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-gray-800/50 border border-white/[0.06] rounded-2xl p-4 flex flex-col items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                <Dumbbell className="w-4 h-4 text-blue-400" strokeWidth={1.5} />
              </div>
              <div className="text-center">
                <p className="text-[12px] font-bold text-white">운동 전문가</p>
                <p className="text-[10px] text-gray-500 mt-0.5 leading-relaxed">회원 식단 관리<br />트레이닝 지도</p>
              </div>
            </div>
            <div className="bg-gray-800/50 border border-white/[0.06] rounded-2xl p-4 flex flex-col items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                <User className="w-4 h-4 text-emerald-400" strokeWidth={1.5} />
              </div>
              <div className="text-center">
                <p className="text-[12px] font-bold text-white">일반 회원</p>
                <p className="text-[10px] text-gray-500 mt-0.5 leading-relaxed">개인 운동<br />식단 자기 관리</p>
              </div>
            </div>
          </div>

          {/* 이용 횟수 테이블 — 3단계만 */}
          <div className="rounded-2xl border border-white/[0.06] overflow-hidden">
            <div className="px-4 py-2.5 border-b border-white/[0.04]" style={{ background: "rgba(255,255,255,0.03)" }}>
              <p className="text-[10px] text-gray-500 font-semibold tracking-widest uppercase">일일 식단 생성 횟수</p>
            </div>
            {tiers.map(({ Icon, label, count, countColor }, i) => (
              <div key={i} className="flex items-center justify-between px-4 py-3 border-b border-white/[0.04] last:border-0">
                <div className="flex items-center gap-2.5">
                  <Icon className="w-3.5 h-3.5 shrink-0" style={{ color: countColor, opacity: 0.7 }} strokeWidth={1.5} />
                  <span className="text-[11px] text-gray-400">{label}</span>
                </div>
                <span className="text-[11px] font-bold tabular-nums" style={{ color: countColor }}>{count}</span>
              </div>
            ))}
          </div>

          {/* 로그인 유도 */}
          <div className="flex items-start gap-2.5 px-1">
            <ChevronRight className="w-3.5 h-3.5 text-emerald-500/60 shrink-0 mt-0.5" strokeWidth={2} />
            <p className="text-[11px] text-gray-500">
              로그인하면 더 많은 식단 생성 및 텍스트 공유가 가능합니다.
            </p>
          </div>

          {/* 시작 버튼 */}
          <button
            onClick={onClose}
            className="w-full py-3.5 rounded-xl font-bold text-sm text-white tracking-wide transition-opacity hover:opacity-90"
            style={{ background: "linear-gradient(135deg, #10b981 0%, #059669 100%)" }}
          >
            시작하기
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── 사용자 유형 선택 모달 ────────────────────────────────────────────────────
function UserTypeModal({ onSelect }: { onSelect: (t: UserType) => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: "rgba(0,0,0,0.75)" }}>
      <div className="w-full max-w-sm bg-gray-900 border border-gray-700 rounded-2xl p-6 space-y-3">
        <div className="text-center mb-1">
          <h2 className="text-base font-bold text-white">어떤 목적으로 이용하시나요?</h2>
          <p className="text-xs text-gray-400 mt-1">사용 목적에 맞는 이용 혜택을 제공해드릴게요.</p>
        </div>
        <button
          onClick={() => onSelect("member")}
          className="w-full text-left bg-gray-800 border border-gray-600 hover:border-emerald-500 rounded-xl p-4 transition-colors"
        >
          <div className="flex items-center gap-2 mb-1">
            <User className="w-4 h-4 text-emerald-400" strokeWidth={1.5} />
            <span className="text-sm font-bold text-white">일반 회원</span>
            <span className="ml-auto text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full font-bold">하루 5회</span>
          </div>
          <p className="text-xs text-gray-400">운동과 식단을 관리하고 싶은 사용자</p>
        </button>
        <button
          onClick={() => onSelect("trainer")}
          className="w-full text-left bg-gray-800 border border-gray-600 hover:border-blue-500 rounded-xl p-4 transition-colors"
        >
          <div className="flex items-center gap-2 mb-1">
            <Dumbbell className="w-4 h-4 text-blue-400" strokeWidth={1.5} />
            <span className="text-sm font-bold text-white">운동전문가</span>
            <span className="ml-auto text-[10px] bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full font-bold">하루 10회</span>
          </div>
          <p className="text-xs text-gray-400">회원 식단 관리 및 운동 지도가 필요한 트레이너/강사</p>
        </button>
      </div>
    </div>
  );
}

// ─── 이용 제한 도달 모달 ──────────────────────────────────────────────────────
function LimitReachedModal({ effectiveType, onClose, onLogin }: {
  effectiveType: string; onClose: () => void; onLogin: () => void;
}) {
  const isGuest   = effectiveType === "guest";
  const isMember  = effectiveType === "member";
  const isTrainer = !isGuest && !isMember;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: "rgba(0,0,0,0.75)" }}>
      <div className="w-full max-w-sm bg-gray-900 border border-gray-700 rounded-2xl p-6 space-y-4">

        {/* 아이콘 + 메시지 */}
        <div className="text-center space-y-2.5">
          <div className="inline-flex items-center justify-center w-11 h-11 rounded-2xl bg-gray-800 border border-gray-700">
            <AlertCircle className="w-5 h-5 text-gray-400" strokeWidth={1.5} />
          </div>
          {isGuest && (
            <>
              <h2 className="text-sm font-bold text-white">오늘 무료 생성 횟수를 모두 사용했어요.</h2>
              <p className="text-xs text-gray-400 leading-relaxed">
                카카오 로그인 후 로그인 회원은 하루 5회,<br />운동전문가는 하루 10회까지 이용할 수 있습니다.
              </p>
            </>
          )}
          {isMember && (
            <>
              <h2 className="text-sm font-bold text-white">오늘 생성 횟수를 모두 사용했어요.</h2>
              <p className="text-xs text-gray-400 leading-relaxed">
                운동전문가라면 유형을 변경해<br />하루 10회까지 이용할 수 있습니다.
              </p>
            </>
          )}
          {isTrainer && (
            <>
              <h2 className="text-sm font-bold text-white">오늘 생성 횟수를 모두 사용했어요.</h2>
              <p className="text-xs text-gray-400 leading-relaxed">
                내일 자정이 지나면 횟수가 초기화됩니다.
              </p>
            </>
          )}
        </div>

        {/* 비로그인 → 카카오 로그인 */}
        {isGuest && (
          <button onClick={() => { onClose(); onLogin(); }}
            className="w-full py-3 bg-[#FEE500] text-[#3A1D1D] font-bold text-sm rounded-xl flex items-center justify-center gap-2">
            <KakaoIcon /><span>카카오 로그인하기</span>
          </button>
        )}

        {/* 운동전문가 → FIT STEP 자연스러운 소개 */}
        {isTrainer && (
          <div className="bg-gray-800/60 border border-gray-700/50 rounded-xl p-4 space-y-2.5">
            <p className="text-xs font-semibold text-gray-200">운동전문가를 위한 추가 기능이 준비되어 있습니다.</p>
            <p className="text-[11px] text-gray-500 leading-relaxed">
              회원관리 · 건강 보고서 · 예약 기능 등<br />운동전문가를 위한 다양한 기능을 확인해보세요.
            </p>
            <a href="https://fitstep.co.kr/" target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-between w-full px-3.5 py-2.5 rounded-lg text-xs font-semibold text-emerald-400 border border-emerald-700/40 hover:border-emerald-500/60 transition-colors"
              style={{ background: "rgba(16,185,129,0.06)" }}>
              <span>FIT STEP 알아보기</span>
              <ChevronRight className="w-3.5 h-3.5" strokeWidth={2} />
            </a>
          </div>
        )}

        <button onClick={onClose} className="w-full text-xs text-gray-600 py-1 hover:text-gray-500 transition-colors">닫기</button>
      </div>
    </div>
  );
}

// ─── 타입 ──────────────────────────────────────────────────────────────────────
interface KakaoUser {
  id: number;
  name: string;
  thumbnail: string | null;
}


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

// ─── 내장 식품 DB ──────────────────────────────────────────────────────────────
type FT = [MealDBItem["mealTime"], string, string, number, number, number, number];
const _FT: FT[] = [
  // ── 아침 ──
  ["breakfast","오트밀","80g",297,51,10,5],
  ["breakfast","오트밀+우유","오트밀80g+우유200ml",380,59,15,8],
  ["breakfast","오트밀+바나나","오트밀70g+바나나1개",370,65,10,5],
  ["breakfast","오트밀+블루베리","오트밀80g+블루베리60g",320,55,10,5],
  ["breakfast","오트밀+사과","오트밀80g+사과1/2개",340,60,10,5],
  ["breakfast","오트밀+견과류","오트밀80g+혼합견과30g",390,52,12,16],
  ["breakfast","오트밀죽","오트밀60g",240,43,8,4],
  ["breakfast","퀵오트밀","40g",148,25,5,3],
  ["breakfast","오트밀팬케이크","오트밀50g",310,45,12,8],
  ["breakfast","프로틴오트밀","오트밀80g+단백질파우더25g",380,50,25,7],
  ["breakfast","삶은달걀 2개","달걀2개",156,2,12,10],
  ["breakfast","스크램블에그","달걀2개",180,2,14,13],
  ["breakfast","달걀후라이","달걀1개",98,1,7,8],
  ["breakfast","달걀오믈렛","달걀2개",220,3,15,16],
  ["breakfast","달걀흰자스크램블","달걀흰자3개",105,2,18,3],
  ["breakfast","달걀토스트","달걀1개+식빵2장",310,35,15,12],
  ["breakfast","달걀샌드위치","달걀2개+식빵2장",340,38,16,14],
  ["breakfast","달걀말이","달걀2개",200,4,14,14],
  ["breakfast","달걀흰자토스트","달걀흰자3개+통밀식빵2장",260,34,18,6],
  ["breakfast","저지방치즈오믈렛","달걀2개+저지방치즈",220,4,22,12],
  ["breakfast","식빵 2장","식빵100g",180,34,6,2],
  ["breakfast","통밀식빵 2장","통밀식빵100g",160,30,7,2],
  ["breakfast","버터토스트","식빵2장+버터10g",230,35,6,8],
  ["breakfast","에그토스트","달걀+식빵2장",310,35,15,12],
  ["breakfast","아보카도토스트","아보카도1/2+식빵1장",350,35,9,18],
  ["breakfast","프렌치토스트","식빵2장",290,36,10,12],
  ["breakfast","잡곡빵","1개(60g)",200,38,7,3],
  ["breakfast","베이글","1개",270,55,10,2],
  ["breakfast","리코타치즈토스트","리코타치즈50g+식빵1장",330,35,16,13],
  ["breakfast","아몬드버터토스트","아몬드버터15g+식빵2장",350,36,10,18],
  ["breakfast","치즈달걀토스트","치즈1장+달걀+식빵2장",350,34,18,16],
  ["breakfast","연어크림치즈베이글","연어30g+크림치즈+베이글",450,54,22,16],
  ["breakfast","플레인요거트","200g",130,15,10,3],
  ["breakfast","그릭요거트","200g",180,9,20,5],
  ["breakfast","그릭요거트+꿀","200g+꿀1큰술",230,20,20,5],
  ["breakfast","그릭요거트+과일","200g+과일80g",220,18,20,5],
  ["breakfast","저지방요거트","200g",120,18,9,2],
  ["breakfast","요거트파르페","그릭요거트+그래놀라+과일",350,48,14,12],
  ["breakfast","단백질그릭요거트볼","그릭요거트200g+단백질파우더",310,22,30,9],
  ["breakfast","냉동베리스무디볼","냉동베리100g+그릭요거트",240,32,16,5],
  ["breakfast","바나나스무디","바나나2개+우유200ml",250,50,6,3],
  ["breakfast","딸기스무디","딸기150g+우유200ml",220,42,6,3],
  ["breakfast","블루베리스무디","블루베리100g+두유200ml",240,46,6,3],
  ["breakfast","단백질쉐이크","단백질파우더30g+우유200ml",300,30,35,5],
  ["breakfast","두유바나나쉐이크","두유200ml+바나나1개",250,38,9,6],
  ["breakfast","프로틴바나나스무디","두유+바나나+단백질파우더",310,45,22,5],
  ["breakfast","두유","200ml",90,8,7,3],
  ["breakfast","저지방우유","200ml",100,10,8,2],
  ["breakfast","아몬드우유","200ml",60,5,2,3],
  ["breakfast","두부스무디","두부100g+바나나+두유",200,14,14,9],
  ["breakfast","흰죽","쌀40g",150,32,3,1],
  ["breakfast","닭죽","쌀30g+닭가슴살50g",220,30,15,4],
  ["breakfast","야채죽","쌀35g+야채",180,35,5,2],
  ["breakfast","전복죽","쌀30g+전복1개",250,38,14,4],
  ["breakfast","흑임자죽","흑임자20g+쌀30g",280,38,8,10],
  ["breakfast","호박죽","단호박100g+쌀20g",200,42,4,2],
  ["breakfast","닭가슴살죽","닭가슴살50g+쌀25g",250,35,20,3],
  ["breakfast","참깨죽","참깨20g+쌀30g",280,40,8,10],
  ["breakfast","콩죽","콩30g+쌀25g",260,38,12,5],
  ["breakfast","녹두죽","녹두30g+쌀25g",240,42,10,3],
  ["breakfast","흑미죽","흑미35g",250,46,6,3],
  ["breakfast","쌀죽+달걀","쌀35g+달걀1개",280,42,12,6],
  ["breakfast","미역국+밥","미역국+밥1/2공기",350,60,12,6],
  ["breakfast","된장찌개+밥","된장찌개+밥1/2공기",350,58,13,8],
  ["breakfast","계란국+밥","계란국+밥1/2공기",380,62,14,7],
  ["breakfast","두부된장국+밥","두부된장국+밥1/2공기",400,64,17,7],
  ["breakfast","콩나물국+밥","콩나물국+밥1/2공기",360,62,12,5],
  ["breakfast","시금치나물+밥","시금치나물+밥1/2공기",340,60,10,5],
  ["breakfast","청국장+밥","청국장+밥1/2공기",410,62,19,8],
  ["breakfast","흑미밥+나물2가지","흑미밥1/2+나물2종",380,68,11,6],
  ["breakfast","보리밥+된장국","보리밥1/2+된장국",390,67,13,6],
  ["breakfast","현미밥+야채볶음","현미밥1/2공기+야채볶음",380,70,9,6],
  ["breakfast","잡곡밥+된장찌개","밥1/2공기+된장찌개",350,58,13,6],
  ["breakfast","귀리밥+나물","귀리밥1/2공기+나물1가지",380,65,12,5],
  ["breakfast","찐고구마","200g",180,42,3,0],
  ["breakfast","찐고구마+요거트","고구마100g+요거트150g",310,57,13,3],
  ["breakfast","고구마+달걀","고구마100g+달걀2개",310,48,14,7],
  ["breakfast","두부스크램블","두부100g",180,6,15,11],
  ["breakfast","두부채소 아침볶음","두부100g+야채볶음",260,10,16,14],
  ["breakfast","연두부+간장","연두부150g",120,4,10,7],
  ["breakfast","퀴노아아침샐러드","퀴노아80g+야채",320,48,14,8],
  ["breakfast","치아씨드푸딩","치아씨드30g+두유200ml",280,35,9,12],
  ["breakfast","사과+아몬드버터","사과1개+아몬드버터1큰술",280,35,7,14],
  ["breakfast","바나나+그릭요거트","바나나1개+그릭요거트150g",235,36,21,5],
  ["breakfast","과일샐러드+요거트","혼합과일100g+요거트150g",250,42,9,4],
  ["breakfast","오트밀에너지볼 2개","오트밀+견과+꿀",320,42,10,12],
  ["breakfast","코코넛오트밀","오트밀70g+코코넛밀크",350,52,9,13],
  ["breakfast","그래놀라+두유","그래놀라50g+두유200ml",320,52,12,8],
  ["breakfast","시리얼+그릭요거트","시리얼50g+그릭요거트150g",340,50,18,6],
  ["breakfast","버섯달걀볶음밥","밥1/2공기+달걀+버섯",380,55,16,10],
  ["breakfast","현미오트밀","귀리+현미30g",310,54,10,5],
  ["breakfast","팬케이크 2장","오트밀팬케이크",350,55,9,10],
  ["breakfast","단백질팬케이크","단백질파우더팬케이크",290,35,25,6],
  ["breakfast","통밀와플+달걀","통밀와플+달걀1개",370,45,18,14],
  ["breakfast","두부된장브런치","두부+된장국+현미밥1/3공기",380,42,20,14],
  ["breakfast","병아리콩야채토스트","병아리콩+야채+통밀빵",360,42,16,14],
  ["breakfast","달걀버섯볶음+식빵","달걀2개+버섯+식빵2장",340,36,18,13],
  ["breakfast","두부와플","두부100g+오트밀30g",300,30,18,13],
  ["breakfast","완두콩오믈렛","달걀2개+완두콩50g",230,10,20,12],
  ["breakfast","스팸계란토스트","스팸30g+달걀+식빵2장",420,36,18,22],
  ["breakfast","된장버섯야채국+밥","된장+버섯+밥1/2공기",360,60,12,6],
  ["breakfast","두부김치볶음+밥","두부+김치+밥1/3공기",420,60,18,12],
  ["breakfast","닭가슴살 샌드위치","닭가슴살+통밀빵",360,40,26,8],
  ["breakfast","참치 샌드위치","참치+식빵2장",390,40,22,14],
  ["breakfast","햄 샌드위치","햄+식빵2장",380,42,18,14],
  ["breakfast","아사이볼","아사이80g+그래놀라+과일",370,55,10,13],
  ["breakfast","쌀 프로틴 토스트","현미떡+두부+나물",290,38,16,8],
  ["breakfast","저당 오트밀 머핀","오트밀50g+달걀",260,32,10,10],
  ["breakfast","사과+시나몬오트밀","오트밀+사과+시나몬",310,55,9,5],
  ["breakfast","바나나 오트 팬케이크","바나나+오트밀",290,48,9,7],
  ["breakfast","퀴노아 요거트볼","퀴노아+그릭요거트+베리",360,48,18,10],
  ["breakfast","구운고구마+달걀","고구마150g+달걀2개",350,52,16,8],
  ["breakfast","두부 스무디볼","두부+냉동베리+그릭요거트",270,22,20,10],
  ["breakfast","채소 달걀 포케","달걀+야채+현미밥1/3",360,44,18,12],
  ["breakfast","단호박 달걀찜","단호박100g+달걀2개",250,28,14,8],
  ["breakfast","현미죽+계란찜","현미죽+계란찜",370,60,16,7],
  ["breakfast","두유+오트쿠키","두유200ml+오트쿠키2개",280,45,10,7],
  ["breakfast","저지방 그릭 스무디","저지방그릭요거트+과일",230,26,18,4],
  ["breakfast","통밀파스타 아침","통밀파스타80g+달걀",350,46,16,10],
  ["breakfast","고단백 스크램블","달걀3개+닭가슴살30g",280,2,30,16],
  ["breakfast","버섯두부볶음+잡곡밥","버섯+두부+잡곡밥1/2",400,60,18,11],
  ["breakfast","된장 달걀국+현미밥","된장달걀국+현미밥1/2",370,58,14,8],
  ["breakfast","귀리밥+계란찜+나물","귀리밥1/2+계란찜+나물",410,62,20,9],
  ["breakfast","통밀빵+땅콩버터+바나나","통밀빵2장+땅콩버터",390,52,12,14],
  ["breakfast","그릭요거트 무스","그릭요거트+코코아",200,12,20,7],
  ["breakfast","치아씨드바나나볼","치아씨드+바나나+두유",280,38,10,9],
  ["breakfast","닭가슴살 야채죽","닭+야채+쌀25g",230,28,18,4],
  ["breakfast","흑임자두유스무디","흑임자두유200ml+바나나",230,32,8,8],
  ["breakfast","들깨죽","들깨20g+쌀30g",280,38,8,12],
  ["breakfast","연두부 야채 샐러드","연두부+야채+드레싱",190,8,12,10],
  ["breakfast","오트밀+프로틴 요거트","오트밀+그릭요거트+단백질",360,44,26,8],
  ["breakfast","통곡물시리얼+우유","통곡물시리얼50g+우유200ml",330,57,12,5],
  ["breakfast","뮤즐리+우유","뮤즐리50g+우유200ml",350,58,13,7],
  ["breakfast","저지방 달걀 베네딕트","달걀2개+잉글리쉬머핀",380,36,20,16],
  ["breakfast","두부 야채 덮밥 (아침)","두부+야채+잡곡밥1/2",380,58,16,10],
  // ── 점심 ──
  ["lunch","비빔밥","야채비빔밥1인분",550,92,18,12],
  ["lunch","돌솥비빔밥","돌솥비빔밥1인분",580,94,20,14],
  ["lunch","참치비빔밥","참치+야채+밥",560,88,24,12],
  ["lunch","나물비빔밥","나물5가지+밥",490,88,14,8],
  ["lunch","연어덮밥","연어80g+밥",550,72,30,16],
  ["lunch","소고기덮밥","소고기80g+밥",600,75,28,18],
  ["lunch","닭가슴살덮밥","닭가슴살100g+밥",520,72,30,10],
  ["lunch","참치김치덮밥","참치+김치+밥",540,74,25,14],
  ["lunch","제육덮밥","제육볶음+밥",620,76,28,20],
  ["lunch","불고기덮밥","불고기+밥",610,78,26,18],
  ["lunch","닭강정덮밥","닭강정+밥",620,80,28,22],
  ["lunch","연어아보카도덮밥","연어+아보카도+밥",580,72,30,20],
  ["lunch","두부소고기볶음+밥","두부+소고기+밥",560,72,28,16],
  ["lunch","콩나물국밥","콩나물국+밥",460,70,16,10],
  ["lunch","소고기국밥","소고기+밥",520,70,22,16],
  ["lunch","참치김밥","참치김밥1줄",450,68,18,12],
  ["lunch","야채김밥","야채김밥1줄",380,68,10,6],
  ["lunch","닭가슴살김밥","닭가슴살김밥1줄",420,65,20,8],
  ["lunch","현미김밥","현미김밥1줄",410,68,14,8],
  ["lunch","소고기김밥","소고기김밥1줄",480,68,22,14],
  ["lunch","달걀김밥","달걀김밥1줄",430,66,16,10],
  ["lunch","두부김밥","두부김밥1줄",400,66,14,8],
  ["lunch","훈제연어김밥","훈제연어김밥1줄",470,65,24,12],
  ["lunch","마약김밥","마약김밥1줄",440,68,16,10],
  ["lunch","미니김밥 4줄","미니김밥4줄",360,60,12,8],
  ["lunch","냉면","물냉면1인분",480,90,15,5],
  ["lunch","비빔냉면","비빔냉면1인분",530,95,16,7],
  ["lunch","잔치국수","잔치국수1인분",450,82,14,7],
  ["lunch","콩국수","콩국수1인분",500,78,22,12],
  ["lunch","비빔국수","비빔국수1인분",500,88,14,10],
  ["lunch","쫄면","쫄면1인분",520,92,14,8],
  ["lunch","우동","우동1인분",420,80,14,5],
  ["lunch","소바","소바1인분",380,72,14,2],
  ["lunch","쌀국수","쌀국수1인분",430,80,16,6],
  ["lunch","잡채+밥","잡채+밥1/2",560,92,14,12],
  ["lunch","파스타(토마토)","토마토파스타1인분",540,85,18,12],
  ["lunch","파스타(크림)","크림파스타1인분",650,78,18,28],
  ["lunch","파스타(오일)","오일파스타1인분",600,80,16,22],
  ["lunch","파스타(볼로네제)","볼로네제파스타1인분",620,82,24,18],
  ["lunch","훈제연어파스타","연어+파스타",560,76,28,16],
  ["lunch","참치토마토파스타","참치+토마토파스타",530,78,26,12],
  ["lunch","닭가슴살샐러드","닭가슴살100g+야채",320,20,30,12],
  ["lunch","연어샐러드","연어80g+야채",380,18,28,22],
  ["lunch","참치샐러드","참치100g+야채",300,16,28,12],
  ["lunch","새우샐러드","새우100g+야채",280,18,24,10],
  ["lunch","퀴노아샐러드","퀴노아80g+야채",400,52,16,14],
  ["lunch","시저샐러드","닭가슴살+로메인",380,22,18,26],
  ["lunch","두부샐러드","두부150g+야채",280,14,16,16],
  ["lunch","오리엔탈샐러드","닭가슴살+채소+드레싱",300,28,16,14],
  ["lunch","닭가슴살타코 2개","닭가슴살타코",480,48,32,16],
  ["lunch","닭가슴살랩","닭가슴살+야채+랩",400,40,30,12],
  ["lunch","참치랩","참치+야채+랩",410,42,28,14],
  ["lunch","샐러드랩","야채+두부+랩",320,38,14,12],
  ["lunch","그릭피타","닭가슴살+채소+피타",420,48,22,14],
  ["lunch","클럽샌드위치","햄+계란+식빵3장",480,48,24,20],
  ["lunch","터키랩","칠면조+야채+랩",430,44,28,16],
  ["lunch","순두부찌개+밥","순두부찌개+밥1공기",520,72,22,14],
  ["lunch","된장찌개+밥","된장찌개+밥1공기",510,74,16,12],
  ["lunch","김치찌개+밥","김치찌개+밥1공기",540,75,18,15],
  ["lunch","부대찌개+밥","부대찌개+밥1공기",600,76,24,20],
  ["lunch","갈비탕+밥","갈비탕+밥1공기",620,68,30,22],
  ["lunch","설렁탕+밥","설렁탕+밥1공기",590,66,28,20],
  ["lunch","삼계탕","삼계탕1인분",580,40,42,20],
  ["lunch","뚝배기불고기+밥","뚝배기불고기+밥",620,78,28,18],
  ["lunch","닭칼국수","닭칼국수1인분",520,80,26,10],
  ["lunch","떡볶이","떡볶이1인분",450,82,10,8],
  ["lunch","김치볶음밥","김치볶음밥1인분",510,76,16,15],
  ["lunch","새우볶음밥","새우볶음밥1인분",560,78,18,18],
  ["lunch","볶음밥","볶음밥1인분",520,78,14,16],
  ["lunch","오므라이스","오므라이스1인분",560,76,18,20],
  ["lunch","카레라이스","카레라이스1인분",600,90,16,16],
  ["lunch","돈까스+밥","돈까스+밥1공기",680,80,28,26],
  ["lunch","생선까스+밥","생선까스+밥1공기",620,78,26,22],
  ["lunch","햄버거","햄버거1개",540,52,26,26],
  ["lunch","치킨버거","치킨버거1개",520,50,28,22],
  ["lunch","제육볶음+밥","제육볶음+밥1공기",600,72,28,22],
  ["lunch","오삼불고기+밥","오삼불고기+밥1공기",610,74,26,22],
  ["lunch","낙지볶음+밥","낙지볶음+밥1공기",520,70,24,14],
  ["lunch","함박스테이크+밥","함박스테이크+밥",580,68,28,20],
  ["lunch","닭볶음탕+밥","닭볶음탕+밥1공기",560,68,30,18],
  ["lunch","해물비빔밥","해물+야채+밥",530,84,22,10],
  ["lunch","채식비빔밥","야채5종+밥",460,82,12,8],
  ["lunch","닭야채덮밥","닭가슴살+야채+밥",510,70,28,12],
  ["lunch","병아리콩카레+밥","병아리콩카레+현미밥",540,86,18,12],
  ["lunch","닭가슴살케밥+피타","닭가슴살+채소+피타빵",520,56,36,16],
  ["lunch","팔라펠+후무스+피타","팔라펠+후무스+피타빵",540,72,18,18],
  ["lunch","연어아보카도롤 6개","연어아보카도롤",480,68,22,14],
  ["lunch","닭가슴살+퀴노아+야채","닭가슴살100g+퀴노아+야채",460,52,38,10],
  ["lunch","참치샐러드+현미밥","참치+샐러드+현미밥",480,68,28,10],
  ["lunch","새우볶음밥(현미)","새우+현미볶음밥",510,72,22,14],
  ["lunch","두부카레+현미밥","두부카레+현미밥",490,72,20,12],
  ["lunch","고구마닭가슴살볶음밥","고구마+닭가슴살+밥",500,70,30,10],
  ["lunch","닭가슴살+두부+밥","닭+두부+현미밥",540,68,32,16],
  ["lunch","연두부덮밥","연두부+밥",420,68,16,8],
  ["lunch","미역무침+현미밥+된장국","미역무침+밥+된장국",440,68,14,8],
  ["lunch","단호박카레+현미밥","단호박카레+현미밥",510,84,14,10],
  ["lunch","소고기야채덮밥","소고기+야채+밥",570,74,28,16],
  ["lunch","두부미소덮밥","두부+미소소스+밥",480,72,22,10],
  ["lunch","렌틸수프+통밀빵","렌틸수프+통밀빵2장",420,66,18,8],
  ["lunch","콩야채볶음밥","콩+야채+현미밥",490,76,16,12],
  ["lunch","사찰비빔밥","사찰식나물+밥",470,82,14,8],
  ["lunch","멸치야채볶음+밥","멸치야채볶음+밥1공기",480,74,16,12],
  ["lunch","삼겹살쌈밥","삼겹살+쌈채소+밥",680,52,30,38],
  ["lunch","생선구이+밥","생선구이+밥1공기",500,60,26,14],
  ["lunch","닭불고기+밥","닭불고기+밥1공기",540,68,30,16],
  ["lunch","갈비+밥","갈비+밥1공기",680,60,32,30],
  ["lunch","닭가슴살야채덮밥","닭가슴살+야채+현미밥",480,62,32,10],
  ["lunch","두부야채찌개+밥","두부야채찌개+잡곡밥",460,68,18,12],
  ["lunch","육개장+밥","육개장+밥1공기",540,66,24,20],
  ["lunch","해물찌개+밥","해물찌개+밥1공기",500,64,26,14],
  ["lunch","버섯전골+밥","버섯전골+밥1공기",440,68,16,10],
  ["lunch","청국장+현미밥","청국장+현미밥1공기",460,62,22,10],
  ["lunch","닭개장+밥","닭개장+밥1공기",520,66,26,16],
  ["lunch","도시락 닭가슴살+야채","닭가슴살+야채+현미밥",450,56,34,10],
  ["lunch","그릭샐러드","채소+올리브+페타치즈",280,16,12,20],
  ["lunch","두부스테이크+샐러드+밥","두부+샐러드+현미밥",440,60,20,16],
  ["lunch","참치니스와즈샐러드","참치+달걀+야채",360,20,30,18],
  ["lunch","닭가슴살 퀴노아볼","닭가슴살+퀴노아+야채",440,48,38,12],
  ["lunch","연어퀴노아포케","연어+퀴노아+채소",520,52,32,20],
  ["lunch","두부스테이크+현미밥","두부+현미밥+야채",420,60,18,14],
  // ── 저녁 ──
  ["dinner","닭가슴살구이","닭가슴살150g",248,0,46,5],
  ["dinner","닭가슴살볶음","닭가슴살+야채",260,4,46,6],
  ["dinner","닭가슴살스테이크","닭가슴살150g",270,2,46,7],
  ["dinner","닭가슴살수육","닭가슴살150g",240,0,44,5],
  ["dinner","훈제닭가슴살","훈제닭가슴살100g",170,1,36,3],
  ["dinner","닭가슴살+현미밥+야채","닭+현미밥+야채",500,62,40,10],
  ["dinner","닭가슴살두부볶음","닭가슴살+두부",320,8,40,14],
  ["dinner","닭가슴살카레","닭가슴살카레+현미밥",380,42,36,8],
  ["dinner","닭가슴살야채카레+밥","닭카레+현미밥",500,68,36,8],
  ["dinner","닭가슴살미역국+밥","닭미역국+현미밥",440,60,32,8],
  ["dinner","닭안심볶음","닭안심+야채",240,4,40,6],
  ["dinner","닭안심스테이크","닭안심150g",230,1,40,6],
  ["dinner","닭안심+브로콜리","닭안심+브로콜리",240,8,36,6],
  ["dinner","닭안심야채스팀+귀리밥","닭안심+야채스팀+귀리밥",440,54,36,8],
  ["dinner","닭안심+퀴노아+야채","닭안심+퀴노아+야채",420,48,38,8],
  ["dinner","닭고기야채볶음","닭고기+야채",340,14,36,14],
  ["dinner","닭가슴살+고구마","닭가슴살+고구마",360,40,36,5],
  ["dinner","닭가슴살소금구이+브로콜리","닭+브로콜리",280,8,42,8],
  ["dinner","닭고기된장구이","닭고기된장+야채",290,6,38,12],
  ["dinner","매운닭갈비+현미밥","닭갈비+현미밥",560,68,32,18],
  ["dinner","닭볶음탕+잡곡밥","닭볶음탕+잡곡밥",540,64,28,20],
  ["dinner","닭곰탕+현미밥+나물","닭곰탕+현미밥",520,64,30,16],
  ["dinner","닭칼국수","닭칼국수1인분",520,80,26,10],
  ["dinner","닭고기토마토야채찌개+밥","닭+토마토찌개+밥",480,64,28,12],
  ["dinner","연어스테이크","연어150g",290,0,30,18],
  ["dinner","연어구이+야채","연어+야채",340,8,32,18],
  ["dinner","연어+아보카도샐러드","연어+아보카도+야채",380,12,28,24],
  ["dinner","연어샐러드","연어80g+야채",340,10,28,20],
  ["dinner","연어타다키+샐러드","연어타다키+야채",360,12,30,20],
  ["dinner","연어레몬구이+감자","연어+감자100g",480,46,32,18],
  ["dinner","훈제연어+샐러드+현미밥","훈제연어+샐러드+밥",450,52,28,16],
  ["dinner","고등어구이","고등어1마리",290,0,26,18],
  ["dinner","고등어조림","고등어+무",310,8,26,18],
  ["dinner","고등어조림+밥","고등어조림+현미밥",500,62,26,18],
  ["dinner","고등어된장국+밥","고등어+된장국+밥",480,62,24,14],
  ["dinner","삼치구이","삼치1마리",260,0,30,14],
  ["dinner","갈치구이","갈치1마리",250,0,28,14],
  ["dinner","갈치조림+밥","갈치조림+밥1공기",480,60,26,16],
  ["dinner","삼치조림+밥","삼치조림+밥1공기",490,62,28,15],
  ["dinner","조기구이+밥","조기구이+밥1공기",460,60,26,12],
  ["dinner","가자미구이+시금치+밥","가자미+시금치+밥",440,60,24,12],
  ["dinner","가자미조림+밥","가자미조림+밥",440,60,24,12],
  ["dinner","도미구이","도미1마리",220,0,32,9],
  ["dinner","참치스테이크","참치스테이크150g",260,0,36,11],
  ["dinner","참치야채볶음+현미밥","참치+야채+현미밥",460,62,26,12],
  ["dinner","새우볶음","새우100g+야채",180,4,28,5],
  ["dinner","새우야채볶음","새우+야채",220,10,26,7],
  ["dinner","새우마늘볶음+현미밥","새우+마늘+현미밥",440,60,26,10],
  ["dinner","새우브로콜리볶음+밥","새우+브로콜리+현미밥",440,62,28,8],
  ["dinner","새우타코+야채","새우타코",460,48,28,16],
  ["dinner","새우+야채스팀","새우+야채스팀",220,12,26,5],
  ["dinner","오징어볶음","오징어+야채",280,14,26,10],
  ["dinner","오징어구이","오징어1마리",220,4,30,6],
  ["dinner","오징어+야채볶음+밥","오징어+야채+밥",500,68,24,12],
  ["dinner","해물야채볶음","해물+야채",280,14,28,8],
  ["dinner","해물야채두부찌개","해물+두부+야채",280,10,22,14],
  ["dinner","해물야채찌개+밥","해물찌개+밥1공기",500,64,26,14],
  ["dinner","해물야채찌개+귀리밥","해물찌개+귀리밥",480,62,26,12],
  ["dinner","낙지연포탕+밥","낙지연포탕+밥",440,62,24,10],
  ["dinner","꽃게탕","꽃게탕1인분",280,8,32,10],
  ["dinner","조개관자구이+야채+밥","관자+야채+밥",430,62,22,9],
  ["dinner","굴국밥","굴국밥1인분",480,68,20,10],
  ["dinner","꼬막무침+밥","꼬막무침+밥1공기",420,66,18,8],
  ["dinner","백합조개탕+밥","조개탕+밥",420,62,20,8],
  ["dinner","아귀찜+밥","아귀찜+밥1공기",500,64,30,12],
  ["dinner","두부스테이크","두부200g",200,6,18,12],
  ["dinner","두부조림","두부200g+양념",220,10,16,12],
  ["dinner","두부김치볶음","두부+김치",260,12,16,14],
  ["dinner","두부야채볶음","두부+야채",240,12,16,13],
  ["dinner","두부된장국","두부+된장국",180,10,12,8],
  ["dinner","연두부+나물","연두부+나물2종",170,6,12,10],
  ["dinner","두부강된장+밥","두부+강된장+현미밥",420,62,22,10],
  ["dinner","두부해물찌개","두부+해물+야채",280,10,22,14],
  ["dinner","두부순두부볶음+밥","두부+순두부+밥",440,64,22,12],
  ["dinner","두부달걀야채국+잡곡밥","두부달걀국+잡곡밥",410,60,18,9],
  ["dinner","순두부야채국","순두부+야채",160,8,12,8],
  ["dinner","순두부계란찜","순두부+달걀",200,8,16,11],
  ["dinner","두부채소된장국+귀리밥","두부+야채+귀리밥",400,60,18,8],
  ["dinner","콩비지찌개+밥","콩비지찌개+밥1공기",440,64,18,10],
  ["dinner","콩비지야채볶음+잡곡밥","콩비지+야채+밥",430,62,18,10],
  ["dinner","청국장+현미밥","청국장+현미밥",460,62,22,10],
  ["dinner","청국장+잡곡밥(고단백)","청국장+잡곡밥",460,62,22,10],
  ["dinner","된장찌개+현미밥","된장찌개+현미밥",490,72,16,12],
  ["dinner","순두부찌개+밥","순두부찌개+밥1공기",500,70,22,14],
  ["dinner","김치찌개+밥","김치찌개+밥1공기",520,72,18,15],
  ["dinner","불고기+밥","불고기+밥1공기",570,68,28,20],
  ["dinner","제육볶음+밥","제육볶음+밥1공기",580,70,26,22],
  ["dinner","육개장+밥","육개장+밥1공기",540,66,24,20],
  ["dinner","미역국+밥","미역국+밥1공기",400,64,12,8],
  ["dinner","콩나물국+밥","콩나물국+밥1공기",360,62,12,5],
  ["dinner","소고기무국+밥","소고기무국+밥1공기",520,68,24,16],
  ["dinner","닭개장+밥","닭개장+밥1공기",520,66,26,16],
  ["dinner","갈비탕+밥","갈비탕+밥1공기",620,68,30,22],
  ["dinner","감자탕+밥","감자탕+밥1공기",560,64,26,22],
  ["dinner","설렁탕+밥","설렁탕+밥1공기",590,66,28,20],
  ["dinner","해장국+밥","해장국+밥1공기",560,70,24,16],
  ["dinner","닭볶음탕+밥","닭볶음탕+밥1공기",560,68,30,18],
  ["dinner","동태찌개+밥","동태찌개+밥1공기",480,62,24,14],
  ["dinner","황태국+밥","황태국+밥1공기",400,60,22,8],
  ["dinner","황태해장국+밥","황태국+밥1공기",440,62,24,10],
  ["dinner","미역두부국+현미밥","미역두부국+현미밥",390,60,16,8],
  ["dinner","들깨시금치된장국+밥","들깨된장국+밥",420,62,14,10],
  ["dinner","된장버섯야채국+두부+밥","된장+버섯+두부+밥",420,62,18,9],
  ["dinner","버섯두부전골+잡곡밥","버섯두부전골+밥",420,62,18,8],
  ["dinner","쇠고기야채전골+밥","소고기전골+밥",540,66,28,20],
  ["dinner","닭가슴살+샐러드","닭가슴살+야채샐러드",300,10,38,10],
  ["dinner","닭안심+현미+아보카도","닭안심+현미밥+아보카도",490,54,38,14],
  ["dinner","구운연어+아스파라거스+퀴노아","연어+아스파라거스+퀴노아",460,42,36,18],
  ["dinner","참치스테이크+야채스팀","참치+야채스팀",320,8,36,14],
  ["dinner","닭가슴살미소조림+밥","닭미소조림+밥",470,60,36,8],
  ["dinner","채소달걀볶음밥(귀리)","달걀+야채+귀리밥",430,56,18,14],
  ["dinner","달걀찜+소고기+현미밥","달걀찜+소고기+현미밥",460,58,28,14],
  ["dinner","계란찜+잡곡밥","계란찜+잡곡밥",380,58,20,8],
  ["dinner","다시마달걀말이+현미밥","달걀말이+현미밥",370,56,16,10],
  ["dinner","쪽파계란프리타타+밥","계란프리타타+밥",420,54,20,14],
  ["dinner","구운두부+청경채볶음+밥","두부+청경채+밥",420,62,18,10],
  ["dinner","두부소고기전골+밥","두부+소고기+밥",520,64,28,16],
  ["dinner","게살두부찌개+잡곡밥","게살두부찌개+밥",450,62,24,12],
  ["dinner","버섯브로콜리두부덮밥","버섯+브로콜리+두부+밥",400,62,18,9],
  ["dinner","닭가슴살채소볶음+현미밥","닭+채소+현미밥",480,60,38,8],
  ["dinner","닭가슴살+귀리밥+시금치","닭+귀리밥+시금치",460,56,38,8],
  ["dinner","흰살생선구이+잡곡밥+나물","흰살생선+잡곡밥",450,60,26,10],
  ["dinner","닭가슴살+단호박+현미밥","닭+단호박+현미밥",480,64,34,8],
  ["dinner","채소달걀포케","달걀+야채+현미밥",400,56,20,12],
  ["dinner","수육(돼지)+야채쌈","돼지수육+야채쌈",480,14,30,32],
  ["dinner","닭볶음탕 저염","닭볶음탕 저염",500,56,32,18],
  ["dinner","북어구이+밥","북어구이+밥",400,58,24,8],
  ["dinner","열빙어구이+미역국+밥","열빙어+미역국+밥",450,62,22,12],
  ["dinner","임연수어구이+밥","임연수어+밥",460,60,26,12],
  ["dinner","도다리쑥국+밥","도다리쑥국+밥",420,60,22,10],
  ["dinner","콩무침+현미밥+미역국","콩무침+현미밥",420,64,18,8],
  ["dinner","시금치두부된장국+밥","시금치+두부+된장국+밥",400,60,16,9],
  ["dinner","들깨소고기국+밥","들깨+소고기+밥",500,64,24,16],
  ["dinner","참깨시금치샐러드+닭가슴살+밥","참깨샐러드+닭+밥",460,58,34,12],
  ["dinner","닭가슴살+샐러드(저칼로리)","닭가슴살80g+야채",240,8,32,8],
  // ── 건강간식 ──
  ["snack","아몬드","30g",174,6,6,15],
  ["snack","호두","30g",196,4,5,19],
  ["snack","피스타치오","30g",171,8,6,14],
  ["snack","캐슈넛","30g",168,9,4,13],
  ["snack","마카다미아","30g",204,4,2,21],
  ["snack","해바라기씨","30g",174,6,6,15],
  ["snack","호박씨","30g",168,5,9,14],
  ["snack","혼합견과류","30g",180,6,5,16],
  ["snack","땅콩","30g",172,5,8,14],
  ["snack","잣","20g",140,3,3,14],
  ["snack","사과 1개","사과1개(150g)",95,25,1,0],
  ["snack","바나나 1개","바나나1개(100g)",105,27,1,0],
  ["snack","오렌지 1개","오렌지1개(150g)",86,21,2,0],
  ["snack","딸기 1컵","딸기150g",50,12,1,0],
  ["snack","블루베리 1컵","블루베리150g",84,21,1,0],
  ["snack","배 1/2개","배150g",90,24,1,0],
  ["snack","귤 2개","귤2개",80,20,1,0],
  ["snack","키위 2개","키위2개",90,20,2,1],
  ["snack","포도 1컵","포도100g",69,18,1,0],
  ["snack","수박 2조각","수박200g",85,21,1,0],
  ["snack","파인애플 슬라이스","파인애플100g",50,13,1,0],
  ["snack","복숭아 1개","복숭아1개",59,15,1,0],
  ["snack","체리 1컵","체리100g",97,25,2,0],
  ["snack","망고 1/2개","망고1/2개",100,25,1,0],
  ["snack","토마토 2개","토마토2개",44,10,2,0],
  ["snack","방울토마토 1컵","방울토마토150g",40,9,2,0],
  ["snack","아보카도 1/2개","아보카도1/2개",160,9,2,15],
  ["snack","멜론 1/4개","멜론150g",60,15,1,0],
  ["snack","자몽 1/2개","자몽1/2개",52,13,1,0],
  ["snack","천도복숭아 2개","천도복숭아2개",70,18,2,0],
  ["snack","말린망고","30g",100,25,1,0],
  ["snack","말린살구","30g",72,19,1,0],
  ["snack","건포도+아몬드","혼합30g",150,18,3,8],
  ["snack","단백질바","1개(60g)",220,24,20,6],
  ["snack","그릭요거트","150g",130,7,15,4],
  ["snack","코티지치즈","100g",98,3,11,4],
  ["snack","삶은달걀 1개","달걀1개",78,1,6,5],
  ["snack","달걀흰자 2개","달걀흰자2개",68,0,14,1],
  ["snack","훈제닭가슴살","80g",136,1,29,2],
  ["snack","에다마메","100g",122,10,11,5],
  ["snack","저지방스트링치즈","1개",80,1,7,5],
  ["snack","닭가슴살육포","30g",100,3,20,1],
  ["snack","프로틴쉐이크","1회(250ml)",150,8,25,3],
  ["snack","저지방우유","200ml",100,10,8,2],
  ["snack","두유","200ml",90,8,7,3],
  ["snack","흑임자두유","200ml",120,11,5,6],
  ["snack","검은콩두유","200ml",100,9,7,4],
  ["snack","블랙커피","아메리카노",10,2,0,0],
  ["snack","녹차","녹차200ml",2,0,0,0],
  ["snack","허브티","허브티200ml",5,1,0,0],
  ["snack","생강차(무설탕)","생강차200ml",20,5,0,0],
  ["snack","레몬워터","레몬워터200ml",15,4,0,0],
  ["snack","코코넛워터","200ml",46,11,1,0],
  ["snack","콤부차","200ml",30,7,0,0],
  ["snack","오미자차","200ml",30,7,0,0],
  ["snack","율무차","200ml",100,20,3,1],
  ["snack","찐고구마","100g",90,21,2,0],
  ["snack","고구마말랭이","30g",96,23,1,0],
  ["snack","군고구마","100g",102,24,2,0],
  ["snack","찐감자","100g",86,20,2,0],
  ["snack","옥수수 1개","옥수수1개",130,29,5,2],
  ["snack","현미떡 2개","현미떡2개",160,34,3,1],
  ["snack","쌀과자","30g",120,26,2,1],
  ["snack","오트밀쿠키 2개","오트밀쿠키2개",200,28,4,8],
  ["snack","단백질오트밀볼 2개","오트밀+견과+단백질",180,22,12,6],
  ["snack","견과류바","1개",200,22,6,10],
  ["snack","그래놀라바","1개",190,28,4,7],
  ["snack","다크초콜릿","30g(70%+)",170,13,3,12],
  ["snack","치즈크래커 5장","치즈크래커5장",130,16,4,6],
  ["snack","통밀크래커 5장","통밀크래커5장",100,18,3,2],
  ["snack","사과+땅콩버터","사과+땅콩버터1큰술",190,30,4,8],
  ["snack","바나나+아몬드버터","바나나+아몬드버터1큰술",210,32,5,8],
  ["snack","당근+후무스","당근+후무스3큰술",130,18,5,5],
  ["snack","오이+두부딥","오이+두부딥",90,8,6,3],
  ["snack","방울토마토+코티지치즈","방울토마토+코티지치즈",110,10,10,3],
  ["snack","에다마메+소금","에다마메100g",122,10,11,5],
  ["snack","블루베리+요거트","블루베리+저지방요거트",140,22,9,3],
  ["snack","사과+시나몬","사과1개",100,26,1,0],
  ["snack","연두부 1모","연두부150g",80,3,7,5],
  ["snack","순두부+간장","순두부100g",100,4,8,6],
  ["snack","참치캔","80g(물)",92,0,20,1],
  ["snack","게맛살 3개","게맛살3개",90,12,9,1],
  ["snack","새우칵테일","100g",99,1,21,1],
  ["snack","훈제연어","50g",110,0,14,6],
  ["snack","닭가슴살+통밀크래커","닭가슴살+크래커5장",200,18,20,5],
  ["snack","연두부야채샐러드","연두부+야채",170,8,10,8],
  ["snack","두부미소수프","두부+미소국",100,6,8,4],
  ["snack","닭고기콘소메수프","닭+야채수프",80,2,12,2],
  ["snack","현미뻥튀기 4개","현미뻥튀기4개",100,22,2,0],
  ["snack","오징어트윈","1개(30g)",90,5,14,1],
  ["snack","김 5장","구운김5장",25,2,2,1],
  ["snack","단백질젤리","1팩(100ml)",80,6,12,1],
  ["snack","저지방치즈 2장","슬라이스치즈2장",120,2,10,8],
  ["snack","리코타치즈+크래커","리코타50g+크래커5장",200,20,10,9],
  ["snack","아사이스무디볼(소)","아사이+그래놀라+과일",240,38,5,9],
  ["snack","딸기+바나나스무디","딸기+바나나+두유",170,38,4,1],
  ["snack","키위스무디","키위2개+두유",130,28,3,1],
  ["snack","수박스무디","수박200g",90,23,2,0],
  ["snack","냉동블루베리+단백질파우더","냉동블루베리+단백질",150,18,15,2],
  ["snack","프로틴그래놀라+우유","그래놀라+우유",300,40,18,8],
  ["snack","저지방리코타+베리","리코타+베리",160,14,12,6],
  ["snack","고구마요거트","고구마+요거트150g",180,30,8,3],
  ["snack","아몬드+다크초콜릿","한줌혼합",200,14,5,15],
  ["snack","완두콩스낵","30g",100,14,6,2],
  ["snack","두부소시지 2개","두부소시지2개",130,4,12,8],
  ["snack","닭가슴살소시지 2개","닭가슴살소시지2개",120,2,14,6],
  ["snack","메론+그릭요거트","메론+그릭요거트",160,20,12,4],
  ["snack","파인애플+코티지치즈","파인애플+코티지치즈",140,17,12,3],
  ["snack","계란흰자머핀 2개","달걀흰자머핀2개",140,6,20,4],
  ["snack","두부푸딩","두부+코코아",150,10,12,7],
  ["snack","닭고기만두 3개","닭가슴살만두3개",180,18,14,5],
  ["snack","야채만두 3개","야채만두3개",160,22,7,5],
  ["snack","인절미 2조각","인절미2조각",140,32,3,0],
  ["snack","단팥찐빵 1개","단팥찐빵1개",160,30,5,2],
  ["snack","두부카스테라 1조각","두부+카스테라",160,18,8,6],
  ["snack","오트밀에너지바","1개",210,30,7,8],
  ["snack","선식 1포","선식30g",150,26,6,3],
  ["snack","콩물","200ml",80,6,6,3],
  ["snack","아몬드우유","200ml",60,5,2,3],
  ["snack","단백질쿠키 1개","단백질쿠키1개",180,16,15,6],
  ["snack","저칼로리아이스크림","1개(저당)",100,16,5,2],
  ["snack","바나나아이스크림","얼린바나나1개",105,27,1,0],
  ["snack","저당빙수","얼음+저당팥",80,20,1,0],
  ["snack","두부초콜릿무스","두부+코코아",150,14,10,7],
  ["snack","녹차두유","200ml",100,10,6,3],
  ["snack","흑깨두유","200ml",120,11,5,6],
  ["snack","석류주스","150ml",100,24,1,0],
  ["snack","크랜베리주스","150ml",90,23,0,0],
  ["snack","무화과 2개","무화과2개",74,19,1,0],
  ["snack","말린크랜베리","30g",100,25,0,0],
  ["snack","자두 2개","자두2개",60,16,1,0],
  ["snack","두유+오트쿠키","두유200ml+오트쿠키2개",280,45,10,7],
  // ── 추가 아침 ──
  ["breakfast","잡곡밥+계란찜+나물","잡곡밥+계란찜+나물2종",420,64,20,9],
  ["breakfast","현미밥+두부조림+된장국","현미밥+두부조림+된장국",410,62,20,10],
  ["breakfast","보리밥+멸치볶음+미역국","보리밥+멸치볶음+미역국",400,64,16,8],
  ["breakfast","귀리밥+계란후라이+시금치","귀리밥+계란+시금치",390,58,18,10],
  ["breakfast","흑미밥+두부구이+나물","흑미밥+두부구이",400,62,18,10],
  ["breakfast","닭가슴살볶음밥(아침)","닭가슴살+야채+밥1/2",420,58,28,10],
  ["breakfast","두부연두부찌개+밥","두부찌개+잡곡밥1/2",380,58,18,10],
  ["breakfast","버섯계란볶음+현미밥","버섯+계란+현미밥1/2",370,54,16,12],
  ["breakfast","닭가슴살+현미죽","닭가슴살+현미죽",300,42,22,5],
  ["breakfast","두유+그릭요거트+견과류","두유+그릭요거트+견과류30g",350,30,22,18],
  ["breakfast","오트밀+단호박","오트밀70g+단호박50g",310,54,9,5],
  ["breakfast","통밀시리얼+저지방우유","통밀시리얼+저지방우유",280,48,12,4],
  ["breakfast","달걀흰자오믈렛+통밀토스트","달걀흰자오믈렛+통밀빵",300,32,22,10],
  ["breakfast","그릭요거트+그래놀라+블루베리","그릭요거트+그래놀라+블루베리",340,44,20,10],
  ["breakfast","퀴노아+달걀+아보카도","퀴노아+달걀+아보카도1/4",410,46,18,18],
  ["breakfast","고단백 두부스무디볼","두부+단백질파우더+베리",290,24,24,10],
  ["breakfast","단호박찜+달걀2개","단호박100g+달걀2개",280,32,16,9],
  ["breakfast","콩나물밥+된장국","콩나물밥+된장국",370,62,14,6],
  ["breakfast","시금치달걀오믈렛","시금치+달걀2개",200,4,16,13],
  ["breakfast","고구마오트밀","오트밀+고구마50g",300,54,8,4],
  // ── 추가 점심 ──
  ["lunch","불고기버거","불고기버거1개",530,52,26,24],
  ["lunch","닭가슴살타코야채","닭가슴살타코+야채",460,44,32,14],
  ["lunch","연어김치볶음밥","연어+김치+현미밥",530,68,26,16],
  ["lunch","두부강된장비빔밥","두부+강된장+잡곡밥",490,74,20,12],
  ["lunch","닭볶음+현미밥+나물3종","닭볶음+현미밥+나물",560,70,30,18],
  ["lunch","소고기미역국밥","소고기미역국+밥1공기",530,68,26,16],
  ["lunch","콩나물불고기밥","콩나물+불고기+밥",560,72,26,18],
  ["lunch","들깨칼국수","들깨+칼국수",480,80,16,12],
  ["lunch","새우케밥+피타","새우케밥+피타빵",500,54,28,18],
  ["lunch","닭가슴살아보카도샌드위치","닭가슴살+아보카도+통밀빵",430,40,30,18],
  ["lunch","참치아보카도덮밥","참치+아보카도+밥",560,72,28,18],
  ["lunch","두부야채볶음밥","두부+야채+현미밥",470,70,18,12],
  ["lunch","순두부비빔밥","순두부+야채+밥",490,72,20,12],
  ["lunch","병아리콩샐러드+통밀빵","병아리콩+야채+통밀빵2장",460,62,18,14],
  ["lunch","소고기퀴노아볼","소고기+퀴노아+야채",520,54,32,18],
  ["lunch","연어두부샐러드","연어+두부+야채",380,14,30,20],
  ["lunch","닭가슴살냉면","닭가슴살+냉면",510,82,26,8],
  ["lunch","고추장비빔쌀국수","쌀국수+고추장+야채",480,84,14,8],
  ["lunch","두부미역냉국수","두부+미역+냉국수",400,70,16,8],
  ["lunch","닭가슴살야채파스타","닭가슴살+토마토파스타",540,80,32,12],
  ["lunch","참치두부덮밥","참치+두부+잡곡밥",490,68,28,12],
  ["lunch","닭가슴살볶음쌀국수","닭+야채+쌀국수",500,74,28,12],
  ["lunch","새우미소라멘","새우+미소+라멘",480,74,24,14],
  ["lunch","연두부두부버거","연두부+채소+번",420,52,22,14],
  ["lunch","고단백닭가슴살도시락","닭+현미밥+나물3종+달걀",520,60,42,12],
  ["lunch","버섯솥밥","버섯+잡곡솥밥",440,78,14,8],
  ["lunch","두부소보로덮밥","두부소보로+잡곡밥",480,70,22,12],
  ["lunch","닭가슴살낫토덮밥","닭가슴살+낫토+현미밥",510,66,34,12],
  ["lunch","연어포케볼","연어+아보카도+현미밥",560,64,32,22],
  ["lunch","닭안심야채볶음우동","닭안심+야채+우동",510,74,28,12],
  ["lunch","새우야채쌀국수","새우+야채+쌀국수",460,72,22,10],
  // ── 추가 저녁 ──
  ["dinner","닭가슴살레몬허브구이+야채","닭가슴살+야채",290,8,44,8],
  ["dinner","연어된장구이+현미밥","연어+된장+현미밥",480,52,34,16],
  ["dinner","고등어+퀴노아+야채","고등어+퀴노아+야채",430,38,30,20],
  ["dinner","두부야채된장찌개+귀리밥","두부야채된장찌개+귀리밥",410,60,18,10],
  ["dinner","닭가슴살야채볶음+두부+밥","닭+야채+두부+현미밥",490,60,42,10],
  ["dinner","새우브로콜리두부볶음+밥","새우+브로콜리+두부+밥",450,60,30,10],
  ["dinner","참치두부스테이크+야채","참치+두부+야채",320,8,36,14],
  ["dinner","닭안심미역국+잡곡밥","닭안심+미역국+잡곡밥",420,56,34,8],
  ["dinner","버섯새우야채볶음+현미밥","버섯+새우+야채+밥",440,60,26,10],
  ["dinner","연어아보카도퀴노아볼","연어+아보카도+퀴노아",480,44,32,22],
  ["dinner","닭가슴살된장야채국+귀리밥","닭+된장+야채+밥",430,56,36,8],
  ["dinner","두부소고기야채전골+밥","두부+소고기전골+밥",520,62,28,18],
  ["dinner","고구마닭가슴살야채볶음+밥","고구마+닭+야채+현미밥",490,64,36,8],
  ["dinner","게살야채볶음+현미밥","게살+야채+현미밥",420,58,24,10],
  ["dinner","달걀두부야채그라탕","달걀+두부+야채",320,14,22,18],
  ["dinner","닭가슴살카프레제샐러드","닭가슴살+모짜렐라+토마토",340,8,38,16],
  ["dinner","저지방불고기+현미밥","저지방불고기+현미밥",490,62,28,14],
  ["dinner","닭가슴살+저칼로리파스타","닭+현미파스타+토마토",480,64,36,10],
  ["dinner","명란두부찌개+잡곡밥","명란+두부+잡곡밥",440,58,24,14],
  ["dinner","닭가슴살+아스파라거스+현미","닭+아스파라거스+현미밥",460,56,38,8],
  ["dinner","참치두부야채국+귀리밥","참치+두부+야채국+밥",420,56,28,10],
  ["dinner","해물순두부찌개+현미밥","해물+순두부+현미밥",490,62,26,14],
  ["dinner","닭가슴살시금치볶음+잡곡밥","닭+시금치+잡곡밥",450,56,38,8],
  ["dinner","연어브로콜리볶음+현미밥","연어+브로콜리+현미밥",470,54,34,16],
  ["dinner","쇠고기야채전골(저지방)+밥","저지방쇠고기전골+밥",500,60,30,16],
  ["dinner","두부달걀그라탕+현미밥","두부+달걀+현미밥",420,56,22,16],
  ["dinner","닭고기콩나물찜+잡곡밥","닭+콩나물+잡곡밥",470,60,30,14],
  ["dinner","새우콩나물볶음+현미밥","새우+콩나물+현미밥",430,58,26,10],
  ["dinner","닭가슴살두부야채한냄비","닭+두부+야채한냄비",380,16,42,14],
  ["dinner","고단백닭가슴살된장국+밥","닭+된장국+잡곡밥",440,54,38,8],
  // ── 추가 건강간식 ──
  ["snack","단백질 요거트 무스","그릭요거트+코코아+꿀",210,16,18,7],
  ["snack","통밀 브라우니","통밀+코코아1조각",160,22,4,6],
  ["snack","두부 브라우니","두부+코코아1조각",140,18,8,5],
  ["snack","오트밀 라즈베리볼","오트밀+라즈베리2개",180,26,6,6],
  ["snack","저지방 치킨육포","닭고기육포20g",80,2,16,1],
  ["snack","병아리콩 스낵","30g",120,18,6,3],
  ["snack","풋콩 소금삶음","100g",127,10,11,6],
  ["snack","쪄먹는 옥수수","1/2개",65,15,2,1],
  ["snack","단호박 스팀 큐브","100g",55,13,2,0],
  ["snack","브로콜리+두부딥","브로콜리+두부딥3큰술",100,8,8,4],
  ["snack","단백질 머핀","단백질파우더+오트밀1개",160,14,14,5],
  ["snack","저당 치즈케이크","1조각(50g)",130,8,7,9],
  ["snack","오트밀+아몬드버터 볼","오트밀+아몬드버터",190,22,6,9],
  ["snack","요거트 바크","요거트+베리+견과류",160,16,10,7],
  ["snack","냉동 포도","포도100g 얼린것",69,18,1,0],
  ["snack","냉동 에다마메","에다마메100g 얼린것",122,10,11,5],
  ["snack","참치+방울토마토","참치캔+방울토마토",110,4,20,1],
  ["snack","닭가슴살+오이","닭가슴살50g+오이",100,3,18,1],
  ["snack","저지방 그릭요거트 아이스","그릭요거트 냉동",120,10,14,3],
  ["snack","과일 두부 스무디","두부+과일",180,18,12,7],
  ["snack","흑임자 경단","흑임자경단3개",180,30,4,5],
  ["snack","수리취 인절미","인절미2조각",140,30,3,1],
  ["snack","호두 케이크 1조각","호두+통밀",150,18,4,7],
  ["snack","저당 마카롱","저당마카롱1개",90,12,3,4],
  ["snack","단호박 요거트","단호박+플레인요거트",150,22,8,3],
  ["snack","저칼로리 초코바","1개(40g 저당)",130,16,8,4],
  ["snack","아몬드 요거트 디핑","아몬드+그릭요거트",180,12,12,10],
  ["snack","고구마+두유","고구마50g+두유200ml",170,28,8,3],
  ["snack","찐달걀+두유","달걀1개+두유200ml",168,8,13,8],
  ["snack","흑미 인절미","흑미인절미2조각",140,32,3,0],
  ["snack","저당 팥 양갱","양갱1개(50g)",110,26,2,0],
  ["snack","단백질 그래놀라 클러스터","단백질그래놀라30g",140,18,8,5],
  ["snack","말린 블루베리","30g",100,24,1,0],
  ["snack","말린 파파야","30g",80,20,0,0],
  ["snack","퀴노아 팝","퀴노아팝30g",110,20,4,2],
  ["breakfast","두부 야채 된장죽","두부+야채+쌀20g",220,30,12,6],
  ["lunch","닭가슴살 오이냉채면","닭+오이+냉채면",430,70,28,8],
  ["dinner","참치 아보카도 야채볶음+밥","참치+아보카도+야채+현미밥",480,56,30,18],
  ["snack","구운 아몬드+크랜베리","구운아몬드+건크랜베리30g",160,16,4,10],
  ["snack","저지방 두부 티라미수","두부+저지방크림",130,12,9,5],
  ["breakfast","닭가슴살 오트밀죽","닭가슴살+오트밀",310,40,28,5],
];

const BUILT_IN_FOOD_DB: MealDBItem[] = _FT.map(
  ([mealTime, name, serving, kcal, carb, protein, fat]) => ({ mealTime, name, serving, kcal, carb, protein, fat })
);

// ─── CSV 매핑 ──────────────────────────────────────────────────────────────────
const KR_TO_MEAL: Record<string, keyof MealPlan> = {
  "아침": "breakfast",
  "점심": "lunch",
  "저녁": "dinner",
  "건강간식": "snack",
  "건강 간식": "snack",
};

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

// ─── 건강식 / 일반식 분류 ──────────────────────────────────────────────────────
const HEALTHY_KW = [
  "닭가슴살","달걀흰자","두부","현미","통밀","오트밀","고구마","샐러드","견과","저지방","무지방",
  "그릭요거트","단백질파우더","프로틴","연어","새우살","브로콜리","시금치","토마토","아보카도",
  "블루베리","키위","채소","나물","퀴노아","아몬드버터","프로틴볼","달걀말이","달걀스크램블",
  "달걀후라이","삶은달걀","스크램블에그","오믈렛","콩나물","무침","참치(캔)","닭안심","생선구이",
  "두부조림","된장국","미역국","청국장","잡곡","흑미","렌틸","병아리콩","그린스무디","채소스무디",
];
const REGULAR_KW = [
  "돈가스","튀김","탕","찌개","볶음밥","라면","짜장","짬뽕","피자","햄버거","파스타","삼겹살",
  "갈비","불고기","떡볶이","순대","국밥","칼국수","냉면","만두","전","치킨","닭강정","닭볶음탕",
  "마라탕","족발","보쌈","감자튀김","닭곰탕","설렁탕","곰탕","우거지","순대국","뼈해장국",
  "아구찜","낙지볶음","제육볶음","김치찌개","부대찌개","된장찌개","순두부찌개","스테이크","리조또",
];

function classifyFood(name: string): "healthy" | "regular" {
  if (HEALTHY_KW.some((k) => name.includes(k))) return "healthy";
  if (REGULAR_KW.some((k) => name.includes(k))) return "regular";
  return "regular";
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

// ─── 식단 목적 설정 ─────────────────────────────────────────────────────────────
type DietGoal = "cut" | "bulk" | "maintain" | "habit";
const DIET_GOAL_CONFIG: Record<DietGoal, {
  label: string; desc: string; mult: number;
  carb: number; prot: number; fat: number; healthRatio: number;
}> = {
  cut:      { label:"체중 감량",   desc:"체지방 감소를 위해 단백질 섭취를 늘리고 총 섭취 열량을 조절합니다.",     mult:0.85, carb:0.40, prot:0.35, fat:0.25, healthRatio:80 },
  bulk:     { label:"근육량 증가", desc:"운동 수행 능력과 회복을 위해 충분한 에너지와 단백질을 제공합니다.",     mult:1.10, carb:0.50, prot:0.30, fat:0.20, healthRatio:65 },
  maintain: { label:"건강 유지",   desc:"균형 잡힌 영양소 비율을 통해 건강한 식습관을 유지합니다.",             mult:1.00, carb:0.50, prot:0.25, fat:0.25, healthRatio:60 },
  habit:    { label:"식습관 개선", desc:"규칙적인 식사를 통해 건강한 생활 습관 형성을 돕습니다.",               mult:1.00, carb:0.55, prot:0.20, fat:0.25, healthRatio:50 },
};

function mealScore(item: MealDBItem, targetKcal: number, healthRatio = 50): number {
  // Primary: closeness to target (scale-free % diff so high-TDEE users aren't penalized)
  const kcalDiff = Math.abs(item.kcal - targetKcal) / Math.max(targetKcal, 1) * 100;
  let bonus = 0;
  const protPct = (item.protein * 4) / Math.max(item.kcal, 1) * 100;
  const fatPct  = (item.fat * 9)     / Math.max(item.kcal, 1) * 100;
  const carbPct = (item.carb * 4)    / Math.max(item.kcal, 1) * 100;
  if (item.mealTime === "breakfast") {
    if (protPct >= 15) bonus += 15;   // protein ≥15% of kcal
    if (fatPct  <= 35) bonus += 10;
  } else if (item.mealTime === "lunch") {
    if (carbPct >= 40 && carbPct <= 65) bonus += 20;
    if (protPct >= 20) bonus += 15;
  } else if (item.mealTime === "dinner") {
    bonus += protPct * 1.2;           // reward protein density
    if (fatPct  <= 40) bonus += 20;
    if (carbPct <= 55) bonus += 10;
  } else if (item.mealTime === "snack") {
    if (protPct >= 15) bonus += 20;
  }
  // 건강식/일반식 비율 반영: healthRatio 0~100
  const isHealthy = classifyFood(item.name) === "healthy";
  const bias = (healthRatio - 50) * 1.8; // -90 ~ +90
  if (isHealthy) bonus += bias;
  else bonus -= bias;
  return kcalDiff - bonus;
}

function buildMealFromDB(
  dbItems: MealDBItem[],
  mealTime: keyof MealPlan,
  targetKcal: number,
  includeList: string[],
  excludeList: string[],
  healthRatio = 50
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

  // 상위 5개 후보 중 랜덤 선택 → 재생성 시 다른 식단 출력
  const sorted = pool
    .map((item) => ({ item, score: mealScore(item, targetKcal, healthRatio) }))
    .sort((a, b) => a.score - b.score)
    .slice(0, 5);
  const pick = sorted[Math.floor(Math.random() * sorted.length)].item;
  const result: MealEntry[] = [{ name: pick.name, serving: pick.serving, kcal: pick.kcal, carb: pick.carb, protein: pick.protein, fat: pick.fat }];

  // 메인 메뉴가 목표 칼로리의 80% 미만이면 사이드 아이템 추가
  const remaining = targetKcal - pick.kcal;
  if (remaining >= targetKcal * 0.2 && mealTime !== "snack") {
    const sidePool = candidates.filter(
      (item) =>
        item.name !== pick.name &&
        item.kcal <= remaining * 1.3 &&
        item.kcal >= remaining * 0.1
    );
    if (sidePool.length > 0) {
      const sideSorted = sidePool
        .map((item) => ({ item, score: mealScore(item, remaining, healthRatio) }))
        .sort((a, b) => a.score - b.score)
        .slice(0, 5);
      const side = sideSorted[Math.floor(Math.random() * sideSorted.length)].item;
      result.push({ name: side.name, serving: side.serving, kcal: side.kcal, carb: side.carb, protein: side.protein, fat: side.fat });
    }
  }

  return result;
}

function sumMeal(entries: MealEntry[]) {
  const r = entries.reduce(
    (acc, e) => ({ kcal: acc.kcal + e.kcal, carb: acc.carb + e.carb, protein: acc.protein + e.protein, fat: acc.fat + e.fat }),
    { kcal: 0, carb: 0, protein: 0, fat: 0 }
  );
  return { kcal: Math.round(r.kcal), carb: Math.round(r.carb * 10) / 10, protein: Math.round(r.protein * 10) / 10, fat: Math.round(r.fat * 10) / 10 };
}

// ─── 공유 링크 인코딩/디코딩 ───────────────────────────────────────────────────
interface SharePayload {
  n: string; t: number;
  b: MealEntry[]; l: MealEntry[]; d: MealEntry[]; s: MealEntry[];
}

function encodeSharePayload(name: string, tdee: number, plan: MealPlan): string {
  const payload: SharePayload = { n: name || "회원", t: tdee, b: plan.breakfast, l: plan.lunch, d: plan.dinner, s: plan.snack };
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  return btoa(Array.from(bytes, (b) => String.fromCharCode(b)).join(""));
}

function decodeSharePayload(hash: string): SharePayload | null {
  try {
    if (!hash.startsWith("#share=")) return null;
    const bin = atob(hash.slice(7));
    const bytes = new Uint8Array([...bin].map((c) => c.charCodeAt(0)));
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch { return null; }
}

// ─── 공유 뷰 컴포넌트 (링크 열었을 때 보이는 화면) ─────────────────────────────
function SharedMealView({ data }: { data: SharePayload }) {
  const meals = [
    { label: "🌅 아침",     entries: data.b },
    { label: "☀️ 점심",     entries: data.l },
    { label: "🌙 저녁",     entries: data.d },
    { label: "🥗 건강 간식", entries: data.s },
  ];
  const total = sumMeal([...data.b, ...data.l, ...data.d, ...data.s]);

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", fontFamily: "'Noto Sans KR', sans-serif" }}>
      {/* 프린트용 숨김 스타일 */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white; }
          * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>

      <div style={{ maxWidth: 600, margin: "0 auto", padding: "24px 16px 40px" }}>
        {/* 헤더 */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 800, color: "#059669", letterSpacing: 2, marginBottom: 6 }}>
              FIT STEP · 맞춤 식단 플래너
            </div>
            <h1 style={{ fontSize: 20, fontWeight: 800, color: "#111827", margin: 0, lineHeight: 1.3 }}>
              {data.n}님의 하루 식단
            </h1>
            <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
              권장 칼로리: {data.t.toLocaleString()} kcal
            </div>
          </div>
          <button
            className="no-print"
            onClick={() => window.print()}
            style={{
              background: "linear-gradient(135deg, #10b981, #059669)", color: "white",
              border: "none", borderRadius: 10, padding: "10px 16px",
              fontSize: 13, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap",
              boxShadow: "0 2px 8px rgba(5,150,105,0.35)",
            }}
          >
            📥 PDF 저장
          </button>
        </div>

        {/* 하루 요약 */}
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8,
          background: "white", borderRadius: 14, padding: "14px 12px",
          border: "1px solid #e5e7eb", marginBottom: 16,
          boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
        }}>
          {[
            { label: "총 칼로리", val: `${total.kcal.toLocaleString()}`, unit: "kcal", color: "#059669" },
            { label: "탄수화물", val: `${total.carb}g`, unit: "", color: "#f59e0b" },
            { label: "단백질",   val: `${total.protein}g`, unit: "", color: "#3b82f6" },
            { label: "지방",     val: `${total.fat}g`, unit: "", color: "#ef4444" },
          ].map(({ label, val, unit, color }) => (
            <div key={label} style={{ textAlign: "center" }}>
              <div style={{ fontSize: 10, color: "#9ca3af", marginBottom: 4 }}>{label}</div>
              <div style={{ fontSize: 16, fontWeight: 800, color }}>{val}</div>
              {unit && <div style={{ fontSize: 10, color: "#9ca3af" }}>{unit}</div>}
            </div>
          ))}
        </div>

        {/* 끼니별 */}
        {meals.map(({ label, entries }) => entries.length === 0 ? null : (
          <div key={label} style={{
            background: "white", borderRadius: 14, marginBottom: 12,
            border: "1px solid #e5e7eb", overflow: "hidden",
            boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
          }}>
            <div style={{ padding: "10px 16px", background: "#f9fafb", borderBottom: "1px solid #f3f4f6" }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#374151" }}>{label}</span>
            </div>
            {entries.map((e, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "12px 16px", borderTop: i > 0 ? "1px solid #f3f4f6" : "none" }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>{e.name}</div>
                  <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>{e.serving}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#059669" }}>{e.kcal} kcal</div>
                  <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>탄{e.carb}g · 단{e.protein}g · 지{e.fat}g</div>
                </div>
              </div>
            ))}
          </div>
        ))}

        {/* 푸터 */}
        <div style={{ textAlign: "center", marginTop: 32, paddingTop: 16, borderTop: "1px solid #e5e7eb" }}>
          <div style={{ fontSize: 11, color: "#059669", fontWeight: 700 }}>FIT STEP</div>
          <div style={{ fontSize: 10, color: "#d1d5db", marginTop: 2 }}>fitstep.co.kr · 맞춤 식단 플래너</div>
        </div>
      </div>
    </div>
  );
}

// ─── 카카오 OAuth PKCE 헬퍼 ───────────────────────────────────────────────────
function generateCodeVerifier(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const data = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

async function exchangeKakaoCode(code: string, verifier: string, redirectUri: string): Promise<string | null> {
  const appKey = import.meta.env.VITE_KAKAO_APP_KEY;
  try {
    const res = await fetch("https://kauth.kakao.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: appKey,
        redirect_uri: redirectUri,
        code,
        code_verifier: verifier,
      }).toString(),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.access_token ?? null;
  } catch {
    return null;
  }
}

async function fetchKakaoProfile(token: string): Promise<KakaoUser | null> {
  try {
    const res = await fetch("https://kapi.kakao.com/v2/user/me", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = await res.json();
    const profile = data.kakao_account?.profile;
    return {
      id: data.id,
      name: profile?.nickname ?? "카카오 사용자",
      thumbnail: profile?.thumbnail_image_url ?? null,
    };
  } catch {
    return null;
  }
}

// ─── 카카오 아이콘 ─────────────────────────────────────────────────────────────
function KakaoIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="#3A1D1D" aria-hidden>
      <path d="M12 3C6.477 3 2 6.92 2 11.7c0 3.05 1.62 5.74 4.09 7.37L5 21.5l3.84-1.92c.99.28 2.05.42 3.16.42 5.523 0 10-3.92 10-8.7S17.523 3 12 3z" />
    </svg>
  );
}

// ─── 프로모션 배너 설정 (문구·링크·활성화 여부 여기서 수정) ─────────────────────
const BANNER_CONFIG = {
  active: true,
  url: "https://fitstep.co.kr/",
  openNewTab: true,
} as const;

function PromoBanner() {
  if (!BANNER_CONFIG.active) return null;
  const linkProps = BANNER_CONFIG.openNewTab
    ? { target: "_blank", rel: "noopener noreferrer" }
    : {};
  return (
    <div className="px-4 pt-3 pb-2 max-w-3xl mx-auto">
      <a
        href={BANNER_CONFIG.url}
        {...linkProps}
        className="group block"
        style={{
          background: "#ffffff",
          border: "1px solid #E5E7EB",
          borderRadius: "18px",
          boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
          padding: "14px 16px",
          textDecoration: "none",
          display: "block",
        }}
      >
        {/* 상단 행: 아이콘 + 텍스트 */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 10 }}>
          <div
            className="flex-shrink-0"
            style={{
              width: 34, height: 34, borderRadius: 9,
              background: "#f0fdf4", border: "1px solid #bbf7d0",
              display: "flex", alignItems: "center", justifyContent: "center",
              marginTop: 1,
            }}
          >
            <Zap className="w-4 h-4" style={{ color: "#059669" }} strokeWidth={2.5} />
          </div>

          <div style={{ flex: 1, wordBreak: "keep-all" }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: "#059669", letterSpacing: "0.12em", marginBottom: 4 }}>
              FIT STEP
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#111827", lineHeight: 1.45, marginBottom: 3 }}>
              <span style={{ fontWeight: 800 }}>식단 생성 무제한.</span> 회원관리까지 하나로.
            </div>
            <div style={{ fontSize: 11, color: "#6B7280", lineHeight: 1.45 }}>
              운동전문가를 위한 올인원 성장 플랫폼
            </div>
          </div>
        </div>

        {/* 하단 행: CTA 버튼 (전체 너비) */}
        <div
          className="transition-all group-hover:brightness-110 group-active:scale-95"
          style={{
            background: "#059669",
            color: "#ffffff",
            fontSize: 12,
            fontWeight: 700,
            padding: "9px 0",
            borderRadius: 10,
            textAlign: "center",
            letterSpacing: "-0.01em",
          }}
        >
          무료로 시작하기 →
        </div>
      </a>
    </div>
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
  const [dietGoal, setDietGoal] = useState<DietGoal | null>(null);
  const [mealStyle, setMealStyle] = useState<"realistic"|"healthy">("realistic");
  const [includeFood, setIncludeFood] = useState("");
  const [excludeFood, setExcludeFood] = useState("");
  const [healthRatio, setHealthRatio] = useState(50); // 0=일반식, 100=건강식

  const [pctBreakfast, setPctBreakfast] = useState(25);
  const [pctLunch, setPctLunch] = useState(35);
  const [pctDinner, setPctDinner] = useState(30);
  const [pctSnack, setPctSnack] = useState(10);

  function handlePctChange(key: "breakfast" | "lunch" | "dinner" | "snack", newVal: number) {
    const val = Math.min(95, Math.max(5, newVal)); // 각 슬라이더 5~95% 범위
    const others = (["breakfast", "lunch", "dinner", "snack"] as const).filter((k) => k !== key);
    const cur = { breakfast: pctBreakfast, lunch: pctLunch, dinner: pctDinner, snack: pctSnack };
    cur[key] = val;
    const remaining = 100 - val;
    const othersSum = others.reduce((s, k) => s + cur[k], 0);
    if (othersSum === 0) {
      const share = Math.floor(remaining / 3);
      others.forEach((k, i) => { cur[k] = i === 2 ? remaining - share * 2 : share; });
    } else {
      let dist = 0;
      others.slice(0, -1).forEach((k) => {
        cur[k] = Math.max(0, Math.round((cur[k] / othersSum) * remaining));
        dist += cur[k];
      });
      cur[others[others.length - 1]] = Math.max(0, remaining - dist);
    }
    setPctBreakfast(cur.breakfast);
    setPctLunch(cur.lunch);
    setPctDinner(cur.dinner);
    setPctSnack(cur.snack);
  }

  const [mealPlan, setMealPlan] = useState<MealPlan | null>(null);
  const [ratioError, setRatioError] = useState(false);
  const [copied, setCopied] = useState(false);

  // 입장 환영 모달 (세션당 1회)
  const [showWelcome, setShowWelcome] = useState(() => !sessionStorage.getItem("dp-welcomed"));

  // 사용자 유형
  const [userType, setUserType] = useState<UserType | null>(() => {
    const s = localStorage.getItem("dp_ut");
    // dp_fitstep 플래그 + 로그인 상태면 항상 fitstep으로 업그레이드
    if (localStorage.getItem("dp_fitstep") === "1" && localStorage.getItem("dp_kakao_user") && s !== "fitstep") {
      localStorage.setItem("dp_ut", "fitstep");
      return "fitstep";
    }
    return s === "member" || s === "trainer" || s === "fitstep" ? s : null;
  });
  const [showTypeModal, setShowTypeModal] = useState(false);
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [todayCount, setTodayCount] = useState(() => getGenCount());

  const [dbItems, setDbItems] = useState<MealDBItem[]>(BUILT_IN_FOOD_DB);
  const [dbLoading, setDbLoading] = useState(true);
  const [dbError, setDbError] = useState(false);
  const [visitorCount, setVisitorCount] = useState<number | null>(null);
  const [visitorToday, setVisitorToday] = useState<number | null>(null);
  const [shareCount, setShareCount] = useState<number | null>(null);
  const [shareToday, setShareToday] = useState<number | null>(null);
  const [kakaoUser, setKakaoUser] = useState<KakaoUser | null>(() => {
    try { const s = localStorage.getItem("dp_kakao_user"); return s ? JSON.parse(s) : null; } catch { return null; }
  });
  const [kakaoMsg, setKakaoMsg] = useState<string>("");

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
        const csvItems = parseFoodDB(csv);
        const seen = new Set(csvItems.map((i) => `${i.mealTime}:${i.name}`));
        const extra = BUILT_IN_FOOD_DB.filter((i) => !seen.has(`${i.mealTime}:${i.name}`));
        setDbItems([...csvItems, ...extra]);
        setDbLoading(false);
      })
      .catch(() => {
        setDbItems(BUILT_IN_FOOD_DB);
        setDbError(false);
        setDbLoading(false);
      });
  }

  useEffect(() => {
    loadDB();

    // FIT STEP 레퍼럴 감지: ?ref=fitstep 또는 ?fitstep=1
    const searchParams = new URLSearchParams(window.location.search);
    if (searchParams.get("ref") === "fitstep" || searchParams.get("fitstep") === "1") {
      localStorage.setItem("dp_fitstep", "1");
      // 이미 로그인된 상태면 즉시 fitstep으로 업그레이드
      if (localStorage.getItem("dp_kakao_user") && localStorage.getItem("dp_ut") !== "fitstep") {
        localStorage.setItem("dp_ut", "fitstep");
        setUserType("fitstep");
      }
    }

    // 카카오 PKCE 콜백 처리 (URL search params에서 code 추출)
    const authCode = searchParams.get("code");
    if (authCode) {
      const verifier = sessionStorage.getItem("kakao_pkce_verifier");
      sessionStorage.removeItem("kakao_pkce_verifier");
      const redirectUri = window.location.origin + window.location.pathname;
      window.history.replaceState(null, "", window.location.pathname);
      if (verifier) {
        setKakaoMsg("프로필 불러오는 중...");
        exchangeKakaoCode(authCode, verifier, redirectUri).then((token) => {
          if (!token) { setKakaoMsg("❌ 토큰 교환 실패"); return; }
          fetchKakaoProfile(token).then((user) => {
            if (user) {
              localStorage.setItem("dp_kakao_user", JSON.stringify(user));
              setKakaoUser(user);
              setKakaoMsg("");
              setName((prev) => prev || user.name);
              // FIT STEP 레퍼럴 회원 → 무제한 자동 부여
              if (localStorage.getItem("dp_fitstep") === "1") {
                localStorage.setItem("dp_ut", "fitstep");
                setUserType("fitstep");
              } else if (!localStorage.getItem("dp_ut")) {
                // 최초 로그인 시 유형 선택 모달
                setShowTypeModal(true);
              }
              // 다른 페이지에서 로그인 요청 → 돌아가기
              const returnPath = sessionStorage.getItem("login_return");
              if (returnPath) {
                sessionStorage.removeItem("login_return");
                window.location.href = returnPath;
                return;
              }
            } else {
              setKakaoMsg("❌ 프로필 조회 실패");
            }
          });
        });
      } else {
        setKakaoMsg("❌ 인증 상태 만료, 다시 시도하세요");
      }
    }

    // ── 공유 카운터 (Supabase 우선, 폴백: localStorage) ────────────────────────
    const tdk   = _todayKey();
    const vtKey = `dp_vt_${tdk}`;
    const stKey = `dp_st_${tdk}`;

    (async () => {
      if (!sessionStorage.getItem("dp-visited")) {
        sessionStorage.setItem("dp-visited", "1");
        setVisitorCount(await remoteInc("dp_vc"));
        setVisitorToday(await remoteInc(vtKey));
      } else {
        setVisitorCount(await remoteGet("dp_vc"));
        setVisitorToday(await remoteGet(vtKey));
      }
      setShareCount(await remoteGet("dp_sc"));
      setShareToday(await remoteGet(stKey));
    })();
  }, []);

  const bmr =
    age && weight && height
      ? calcBMR(gender, parseInt(age), parseFloat(weight), parseFloat(height))
      : 0;
  const tdee = bmr ? calcTDEE(bmr, activity) : 0;
  const goalCfg = dietGoal ? DIET_GOAL_CONFIG[dietGoal] : null;
  const adjustedTdee = tdee && goalCfg ? Math.round(tdee * goalCfg.mult) : tdee;
  const goalMacros = adjustedTdee && goalCfg ? {
    carb: Math.round(adjustedTdee * goalCfg.carb / 4),
    prot: Math.round(adjustedTdee * goalCfg.prot / 4),
    fat:  Math.round(adjustedTdee * goalCfg.fat  / 9),
  } : null;
  const pctTotal = pctBreakfast + pctLunch + pctDinner + pctSnack;

  function handleGenerate() {
    if (!dietGoal) return;
    const effectiveType = kakaoUser ? (userType ?? "member") : "guest";
    const limit = DAILY_LIMITS[effectiveType] ?? 2;
    if (todayCount >= limit) { setShowLimitModal(true); return; }
    setRatioError(false);
    const includeList = includeFood.split(/[,，]/).map((s) => s.trim()).filter(Boolean);
    const excludeList = excludeFood.split(/[,，]/).map((s) => s.trim()).filter(Boolean);
    const effectiveHealthRatio = goalCfg ? goalCfg.healthRatio : healthRatio;
    const base = adjustedTdee;
    const plan: MealPlan = mealStyle === "healthy"
      ? {
          breakfast: buildMealFromDB(dbItems, "breakfast", (base * pctBreakfast) / 100, includeList, excludeList, Math.max(effectiveHealthRatio, 70)),
          lunch:     buildMealFromDB(dbItems, "lunch",     (base * pctLunch)     / 100, includeList, excludeList, Math.max(effectiveHealthRatio, 70)),
          dinner:    buildMealFromDB(dbItems, "dinner",    (base * pctDinner)    / 100, includeList, excludeList, Math.max(effectiveHealthRatio, 70)),
          snack:     buildMealFromDB(dbItems, "snack",     (base * pctSnack)     / 100, includeList, excludeList, Math.max(effectiveHealthRatio, 70)),
        }
      : {
          breakfast: buildRealMeal("breakfast", (base * pctBreakfast) / 100, mealStyle, dietGoal),
          lunch:     buildRealMeal("lunch",     (base * pctLunch)     / 100, mealStyle, dietGoal),
          dinner:    buildRealMeal("dinner",    (base * pctDinner)    / 100, mealStyle, dietGoal),
          snack:     buildRealMeal("snack",     (base * pctSnack)     / 100, mealStyle, dietGoal),
        };
    setMealPlan(plan);
    const newCount = incGenCount();
    setTodayCount(newCount);
    setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  }

  function buildShareText() {
    if (!mealPlan) return "";
    const meals = [
      { label: "아침",   entries: mealPlan.breakfast },
      { label: "점심",   entries: mealPlan.lunch },
      { label: "저녁",   entries: mealPlan.dinner },
      { label: "간식",   entries: mealPlan.snack },
    ];
    const total = sumMeal([...mealPlan.breakfast, ...mealPlan.lunch, ...mealPlan.dinner, ...mealPlan.snack]);
    return [
      `🥗 오늘의 맞춤 식단`,
      `${name || "회원"}님 · 권장 ${tdee.toLocaleString()} kcal`,
      "",
      ...meals.flatMap(({ label, entries }) =>
        entries.length ? [`[${label}]`, ...entries.map(e => `${e.name} (${e.kcal}kcal)`), ""] : []
      ),
      `총 권장 칼로리: ${total.kcal.toLocaleString()}kcal`,
      `탄수화물 ${total.carb}g · 단백질 ${total.protein}g · 지방 ${total.fat}g`,
      "",
      "FIT STEP 맞춤 식단 플래너로 생성된 식단입니다.",
      "fitstep.co.kr",
    ].join("\n");
  }

  async function handleShare() {
    if (!mealPlan) return;
    if (!kakaoUser) { setKakaoMsg("로그인하면 식단을 공유할 수 있습니다."); return; }
    const text = buildShareText();
    try {
      if (navigator.share) {
        await navigator.share({ title: `${name || "회원"}님의 하루 맞춤 식단`, text });
      } else {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      }
      const stk = `dp_st_${_todayKey()}`;
      setShareCount(await remoteInc("dp_sc"));
      setShareToday(await remoteInc(stk));
    } catch {
      // 공유 취소
    }
  }

  async function handleKakaoLogin() {
    const appKey = import.meta.env.VITE_KAKAO_APP_KEY;
    if (!appKey) { setKakaoMsg("❌ 앱 키 미설정 (VITE_KAKAO_APP_KEY)"); return; }
    const verifier = generateCodeVerifier();
    sessionStorage.setItem("kakao_pkce_verifier", verifier);
    const challenge = await generateCodeChallenge(verifier);
    const redirectUri = window.location.origin + window.location.pathname;
    window.location.href =
      `https://kauth.kakao.com/oauth/authorize?client_id=${appKey}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&response_type=code` +
      `&code_challenge=${challenge}` +
      `&code_challenge_method=S256` +
      `&scope=profile_nickname,profile_image`;
  }

  function handleKakaoLogout() {
    localStorage.removeItem("dp_kakao_user");
    setKakaoUser(null);
    setKakaoMsg("");
  }

  function handleUserTypeSelect(type: UserType) {
    localStorage.setItem("dp_ut", type);
    setUserType(type);
    setShowTypeModal(false);
  }

  const totalFoodCount = dbItems.length + REAL_FOOD_DB.length;
  const dbLabel = totalFoodCount >= 3000 ? "식품 DB 3000개+" :
                  totalFoodCount >= 2000 ? "식품 DB 2000개+" :
                  totalFoodCount >= 1000 ? "식품 DB 1000개+" :
                  `식품 DB ${totalFoodCount}개`;

  const mealLabels = [
    { key: "breakfast" as const, label: "아침", pct: pctBreakfast, emoji: "🌅" },
    { key: "lunch" as const, label: "점심", pct: pctLunch, emoji: "☀️" },
    { key: "dinner" as const, label: "저녁", pct: pctDinner, emoji: "🌙" },
    { key: "snack" as const, label: "건강 간식", pct: pctSnack, emoji: "🥗" },
  ];

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 pb-20">
      {showWelcome && (
        <WelcomeModal onClose={() => {
          sessionStorage.setItem("dp-welcomed", "1");
          setShowWelcome(false);
        }} />
      )}
      {showTypeModal && <UserTypeModal onSelect={handleUserTypeSelect} />}
      {showLimitModal && (
        <LimitReachedModal
          effectiveType={kakaoUser ? (userType ?? "member") : "guest"}
          onClose={() => setShowLimitModal(false)}
          onLogin={handleKakaoLogin}
        />
      )}
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 px-4 py-3">
        <div className="max-w-3xl mx-auto space-y-2">
          {/* Row 1: 로고+타이틀 / 카카오 버튼 */}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center shrink-0">
              <Salad className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-sm font-bold text-white leading-tight whitespace-nowrap">맞춤 식단 플래너</h1>
              <p className="text-[10px] text-gray-400 leading-tight whitespace-nowrap">회원 정보 입력 → 하루 식단 자동 구성</p>
            </div>
            {/* 사용자 유형 뱃지 (로그인 후) */}
            {kakaoUser && (
              userType === "fitstep" ? (
                <div
                  className="shrink-0 flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg border"
                  style={{ background: "rgba(5,150,105,0.18)", color: "#34d399", borderColor: "rgba(5,150,105,0.35)" }}
                >
                  <Zap className="w-3 h-3" strokeWidth={2} />FIT STEP
                </div>
              ) : (
                <button
                  onClick={() => setShowTypeModal(true)}
                  className="shrink-0 flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg border transition-colors"
                  style={userType === "trainer"
                    ? { background: "rgba(59,130,246,0.15)", color: "#93c5fd", borderColor: "rgba(59,130,246,0.3)" }
                    : { background: "rgba(16,185,129,0.15)", color: "#6ee7b7", borderColor: "rgba(16,185,129,0.3)" }}
                >
                  {userType === "trainer"
                    ? <><Dumbbell className="w-3 h-3" strokeWidth={2} />운동전문가</>
                    : <><User className="w-3 h-3" strokeWidth={2} />일반 회원</>}
                </button>
              )
            )}
            {/* 카카오 로그인 버튼 */}
            <div className="flex flex-col items-end gap-0.5 shrink-0">
              {kakaoUser ? (
                <button
                  onClick={handleKakaoLogout}
                  title="로그아웃"
                  className="flex items-center gap-1.5 bg-[#FEE500] hover:bg-[#F5DC00] active:bg-[#EDD000] text-[#3A1D1D] text-xs font-bold pl-1.5 pr-2.5 py-1.5 rounded-lg transition-colors"
                >
                  {kakaoUser.thumbnail ? (
                    <img src={kakaoUser.thumbnail} alt="" className="w-5 h-5 rounded-full object-cover" />
                  ) : (
                    <KakaoIcon />
                  )}
                  <span className="max-w-[72px] truncate">{kakaoUser.name}</span>
                </button>
              ) : (
                <button
                  onClick={handleKakaoLogin}
                  className="flex items-center gap-1.5 bg-[#FEE500] hover:bg-[#F5DC00] active:bg-[#EDD000] text-[#3A1D1D] text-xs font-bold px-2.5 py-1.5 rounded-lg transition-colors"
                >
                  <KakaoIcon />
                  <span>로그인</span>
                </button>
              )}
              {kakaoMsg && (
                <span className="text-[10px] text-red-400 max-w-[140px] truncate">{kakaoMsg}</span>
              )}
            </div>
          </div>
          {/* Row 2: 카운터 + DB */}
          <div className="flex items-center justify-between gap-2">
            {/* 방문자·공유 카운터 */}
            <div className="flex items-center gap-1.5">
              {/* 방문자 */}
              <div className="flex items-center gap-1.5 bg-gray-800/60 rounded-lg px-2.5 py-1.5">
                <User className="w-3 h-3 text-gray-500 shrink-0" strokeWidth={1.5} />
                <span className="tabular-nums text-[11px] font-semibold text-white">{visitorCount ?? "—"}</span>
                <span className="text-[10px] text-gray-600">누적</span>
                <span className="w-px h-3 bg-gray-700" />
                <span className="tabular-nums text-[11px] font-semibold text-emerald-400">{visitorToday ?? "—"}</span>
                <span className="text-[10px] text-gray-600">오늘</span>
              </div>
              {/* 공유 */}
              <div className="flex items-center gap-1.5 bg-gray-800/60 rounded-lg px-2.5 py-1.5">
                <Share2 className="w-3 h-3 text-gray-500 shrink-0" strokeWidth={1.5} />
                <span className="tabular-nums text-[11px] font-semibold text-white">{shareCount ?? "—"}</span>
                <span className="text-[10px] text-gray-600">누적</span>
                <span className="w-px h-3 bg-gray-700" />
                <span className="tabular-nums text-[11px] font-semibold text-emerald-400">{shareToday ?? "—"}</span>
                <span className="text-[10px] text-gray-600">오늘</span>
              </div>
            </div>
            {/* DB 현황 */}
            <div className="shrink-0 flex items-center gap-1">
              {dbLoading ? (
                <span className="flex items-center gap-1 text-[11px] text-gray-400">
                  <Loader2 className="w-3 h-3 animate-spin" />로딩 중
                </span>
              ) : (
                <span className="text-[11px] text-emerald-400 font-medium">{dbLabel}</span>
              )}
              {dbError && (
                <button onClick={loadDB} className="flex items-center gap-0.5 text-[11px] text-red-400 hover:text-red-300">
                  <RefreshCw className="w-3 h-3" />재시도
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── FIT STEP 프로모션 배너 ── */}
      <PromoBanner />

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* ── 회원 기본 정보 ── */}
        <section className="bg-gray-900 rounded-2xl p-5 space-y-4 border border-gray-800">
          <div className="flex items-center gap-2 mb-0.5">
            <User className="w-4 h-4 text-emerald-400" />
            <h2 className="text-sm font-semibold text-gray-200">회원 기본 정보</h2>
          </div>
          <p className="text-[11px] text-gray-600 mb-3">신체 정보를 입력하면 기초대사량(BMR)과 권장칼로리(TDEE)를 자동으로 계산합니다.</p>
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

          {/* 식단 목적 */}
          <div>
            <label className="block text-xs text-gray-400 mb-2">
              식단 목적 <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              {([
                { key:"cut"      as DietGoal, Icon:TrendingDown, label:"체중 감량",   sub:"체지방 감소를 위한 식단" },
                { key:"bulk"     as DietGoal, Icon:Dumbbell,     label:"근육량 증가", sub:"근육 성장 및 수행 향상" },
                { key:"maintain" as DietGoal, Icon:Leaf,         label:"건강 유지",   sub:"균형 잡힌 건강한 식습관" },
                { key:"habit"    as DietGoal, Icon:Utensils,     label:"식습관 개선", sub:"규칙적인 식사 습관 형성" },
              ]).map(({ key, Icon, label, sub }) => (
                <button
                  key={key}
                  onClick={() => setDietGoal(key)}
                  className={`text-left p-3 rounded-xl border transition-colors ${
                    dietGoal === key
                      ? "bg-emerald-500/10 border-emerald-500/60"
                      : "bg-gray-800/50 border-gray-700/50 hover:border-gray-600"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Icon className={`w-3.5 h-3.5 shrink-0 ${dietGoal===key?"text-emerald-400":"text-gray-500"}`} strokeWidth={2} />
                    <span className={`text-xs font-bold ${dietGoal===key?"text-emerald-400":"text-gray-300"}`}>{label}</span>
                  </div>
                  <p className="text-[10px] text-gray-500 leading-relaxed pl-5">{sub}</p>
                </button>
              ))}
            </div>

            {/* 목적 선택 후 칼로리·영양소 미리보기 */}
            {goalCfg && adjustedTdee > 0 && goalMacros && (
              <div className="mt-3 bg-gray-800/60 border border-gray-700/50 rounded-xl p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-emerald-400">{goalCfg.label}</span>
                  <span className="text-[11px] font-bold text-white">{adjustedTdee.toLocaleString()} kcal</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-gray-900/60 rounded-lg py-2">
                    <p className="text-[10px] text-gray-500 mb-0.5">탄수화물</p>
                    <p className="text-xs font-bold text-yellow-400">{goalMacros.carb}g</p>
                  </div>
                  <div className="bg-gray-900/60 rounded-lg py-2">
                    <p className="text-[10px] text-gray-500 mb-0.5">단백질</p>
                    <p className="text-xs font-bold text-blue-400">{goalMacros.prot}g</p>
                  </div>
                  <div className="bg-gray-900/60 rounded-lg py-2">
                    <p className="text-[10px] text-gray-500 mb-0.5">지방</p>
                    <p className="text-xs font-bold text-red-400">{goalMacros.fat}g</p>
                  </div>
                </div>
                <p className="text-[10px] text-gray-500 leading-relaxed">{goalCfg.desc}</p>
              </div>
            )}
          </div>
        </section>

        {/* ── 음식 설정 ── */}
        <section className="bg-gray-900 rounded-2xl p-5 space-y-4 border border-gray-800">
          <div className="flex items-center gap-2 mb-0.5">
            <Utensils className="w-4 h-4 text-orange-400" />
            <h2 className="text-sm font-semibold text-gray-200">음식 설정</h2>
          </div>
          <p className="text-[11px] text-gray-600 mb-3">식단 스타일을 고르고 선호하거나 피하고 싶은 음식을 입력해주세요.</p>

          {/* 식단 스타일 */}
          <div>
            <label className="block text-xs text-gray-400 mb-1">식단 스타일</label>
            <p className="text-[11px] text-gray-600 mb-2">식단을 구성하는 방식을 선택해주세요. 현실식은 실제 한국인이 자주 먹는 조합으로, 건강식은 영양 밀도가 높은 음식 위주로 구성됩니다.</p>
            <div className="grid grid-cols-2 gap-2">
              {([
                { value:"realistic" as const, label:"현실식", desc:"실제 따라하기 쉬운 한국식 식단", sub:"잡곡밥 · 제육볶음 · 브로콜리" },
                { value:"healthy"   as const, label:"건강식", desc:"영양 밀도 높은 클린 식단", sub:"오트밀 · 닭가슴살 · 채소" },
              ]).map(({ value, label, desc, sub }) => (
                <button
                  key={value}
                  onClick={() => setMealStyle(value)}
                  className={`text-left p-3.5 rounded-xl border transition-colors space-y-1 ${
                    mealStyle === value
                      ? "bg-orange-500/10 border-orange-500/60"
                      : "bg-gray-800/50 border-gray-700/50"
                  }`}
                >
                  <p className={`text-xs font-bold ${mealStyle===value?"text-orange-400":"text-gray-300"}`}>{label}</p>
                  <p className="text-[10px] text-gray-500 leading-relaxed">{desc}</p>
                  <p className="text-[10px] text-gray-600 italic">{sub}</p>
                </button>
              ))}
            </div>
          </div>
          {mealStyle === "healthy" && (<>
          <div>
            <label className="block text-xs text-gray-400 mb-1">포함할 음식 <span className="text-gray-600">(쉼표로 구분)</span></label>
            <p className="text-[11px] text-gray-600 mb-1.5">식단에 반드시 넣고 싶은 재료나 음식을 입력하세요. 입력한 음식이 우선적으로 선택됩니다.</p>
            <input
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-orange-500"
              placeholder="예: 닭가슴살, 연어, 두부"
              value={includeFood}
              onChange={(e) => setIncludeFood(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">제외할 음식 <span className="text-gray-600">(쉼표로 구분)</span></label>
            <p className="text-[11px] text-gray-600 mb-1.5">알레르기·비선호 식재료를 입력하면 식단 생성 시 해당 음식을 제외합니다.</p>
            <input
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-red-500"
              placeholder="예: 달걀, 우유, 소고기"
              value={excludeFood}
              onChange={(e) => setExcludeFood(e.target.value)}
            />
          </div>
          {/* 건강식 / 일반식 비율 */}
          <div className="bg-gray-800/60 rounded-xl p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-300 font-medium">식단 스타일</span>
              <div className="flex items-center gap-1.5 text-xs font-bold">
                <span className={healthRatio >= 50 ? "text-emerald-400" : "text-gray-500"}>건강식 {healthRatio}%</span>
                <span className="text-gray-600">/</span>
                <span className={healthRatio < 50 ? "text-orange-400" : "text-gray-500"}>일반식 {100 - healthRatio}%</span>
              </div>
            </div>
            <input type="range" min={0} max={100} step={10} value={healthRatio}
              onChange={(e) => setHealthRatio(parseInt(e.target.value))}
              className="w-full accent-emerald-500" />
            <div className="flex justify-between text-[10px] text-gray-600">
              <span>일반식 위주<br/><span className="text-gray-700">탕·튀김·볶음 등</span></span>
              <span className="text-center">균형</span>
              <span className="text-right">건강식 위주<br/><span className="text-gray-700">닭가슴살·채소·달걀 등</span></span>
            </div>
          </div>
          </>)}
        </section>

        {/* ── 식사 비율 설정 ── */}
        <section className="bg-gray-900 rounded-2xl p-5 space-y-4 border border-gray-800">
          <div className="flex items-center gap-2 mb-1">
            <Activity className="w-4 h-4 text-purple-400" />
            <h2 className="text-sm font-semibold text-gray-200">식사 비율 설정</h2>
            <span className="ml-auto text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400">
              합계 {pctTotal}%
            </span>
          </div>
          <p className="text-[11px] text-gray-600 mb-3">하루 권장칼로리를 끼니별로 배분합니다. 합계가 100%가 되어야 합니다.</p>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "🌅 아침", value: pctBreakfast, key: "breakfast" as const, color: "text-yellow-400" },
              { label: "☀️ 점심", value: pctLunch,     key: "lunch"     as const, color: "text-orange-400" },
              { label: "🌙 저녁", value: pctDinner,    key: "dinner"    as const, color: "text-blue-400" },
              { label: "🥗 건강간식", value: pctSnack, key: "snack"     as const, color: "text-emerald-400" },
            ].map(({ label, value, key, color }) => (
              <div key={label} className="bg-gray-800/60 rounded-xl p-3">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs text-gray-300">{label}</span>
                  <span className={`text-sm font-bold ${color}`}>{value}%</span>
                </div>
                <input
                  type="range"
                  min={5}
                  max={95}
                  step={5}
                  value={value}
                  onChange={(e) => handlePctChange(key, parseInt(e.target.value))}
                  className="w-full accent-emerald-500"
                />
              </div>
            ))}
          </div>
        </section>

        {/* 이용 횟수 표시 */}
        {(() => {
          const effectiveType = kakaoUser ? (userType ?? "member") : "guest";
          const limit = DAILY_LIMITS[effectiveType] ?? 2;
          const label = effectiveType === "guest" ? "비로그인" : effectiveType === "trainer" ? "운동전문가" : effectiveType === "fitstep" ? "FIT STEP 회원" : "일반 회원";
          return (
            <div className="flex items-center justify-between text-xs px-1">
              <span className="text-gray-500">{label}</span>
              <span className={todayCount >= limit ? "text-red-400 font-bold" : "text-gray-400"}>
                오늘 {todayCount} / {limit}회 이용
              </span>
            </div>
          );
        })()}

        {/* 생성 버튼 */}
        <button
          onClick={handleGenerate}
          disabled={!tdee || !dietGoal || dbLoading}
          className="w-full py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:bg-gray-700 disabled:text-gray-500 text-white font-bold text-sm transition-colors"
        >
          {dbLoading
            ? "식품 DB 로딩 중..."
            : !tdee
            ? "회원 정보를 먼저 입력하세요"
            : !dietGoal
            ? "식단 목적을 선택해주세요"
            : mealPlan
            ? "식단 다시 생성"
            : "식단 자동 생성"}
        </button>

        {/* ── 식단 결과 ── */}
        {mealPlan && (
          <div ref={resultRef} className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-white">{name || "회원"}님의 하루 식단</h2>
              <button
                onClick={handleShare}
                className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg transition-colors ${
                  kakaoUser
                    ? "bg-yellow-400 hover:bg-yellow-300 text-gray-900"
                    : "bg-gray-700 text-gray-400 cursor-default"
                }`}
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Share2 className="w-3.5 h-3.5" />}
                {copied ? "복사됨!" : kakaoUser ? "공유하기" : "로그인 후 공유 가능"}
              </button>
            </div>

            {/* 하루 요약 */}
            {(() => {
              const total = sumMeal([...mealPlan.breakfast, ...mealPlan.lunch, ...mealPlan.dinner, ...mealPlan.snack]);
              return (
                <div className="space-y-2">
                  {goalCfg && (
                    <div className="flex items-center justify-between px-1">
                      <span className="text-[11px] text-gray-500">식단 목적</span>
                      <span className="text-[11px] font-bold text-emerald-400">{goalCfg.label}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between px-1">
                    <span className="text-[11px] text-gray-500">식단 스타일</span>
                    <span className="text-[11px] font-bold text-orange-400">{mealStyle === "realistic" ? "현실식" : "건강식"}</span>
                  </div>
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
                  {goalMacros && (
                    <div className="flex items-center justify-between px-1">
                      <span className="text-[10px] text-gray-600">목표</span>
                      <span className="text-[10px] text-gray-500">
                        탄 {goalMacros.carb}g · 단 {goalMacros.prot}g · 지 {goalMacros.fat}g
                      </span>
                    </div>
                  )}
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
