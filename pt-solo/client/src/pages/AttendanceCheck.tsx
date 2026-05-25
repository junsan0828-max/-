import { useState, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ArrowLeft, Dumbbell, Check } from "lucide-react";

interface Props {
  memberId: number;
}

type Status = "attended" | "noshow" | "cancelled";

const DIET_OPTIONS = [
  "인스턴트탄수화물", "건강식탄수화물",
  "인스턴트단백질", "건강식단백질",
  "인스턴트지방", "건강식지방",
];

const SLEEP_OPTIONS = ["4h↓", "5h", "6h", "7h", "8h", "9h+"];

// 좌/우 구분 포함한 전체 부위 목록
const BODY_PARTS = [
  "목",
  "좌 어깨전면", "우 어깨전면",
  "좌 팔꿈치", "우 팔꿈치",
  "좌 손목", "우 손목",
  "좌 고관절", "우 고관절",
  "좌 무릎", "우 무릎",
  "좌 종아리", "우 종아리",
  "좌 발목", "우 발목",
  "좌 어깨후면", "우 어깨후면",
  "상부등", "중부등",
  "좌 기립근", "우 기립근",
  "엉치",
  "좌 발바닥", "우 발바닥",
  "기타",
];

// viewBox: 0 0 110 268
type Spot = { part: string; x: number; y: number; side: "L" | "R" | "C" };

// 전면 핫스팟 — x<50: 화면 좌(우측신체), x>50: 화면 우(좌측신체), x=50: 중앙
const FRONT_SPOTS: Spot[] = [
  { part: "목",          x: 55,  y: 38,  side: "C" },
  { part: "좌 어깨전면", x: 23,  y: 52,  side: "L" },
  { part: "우 어깨전면", x: 87,  y: 52,  side: "R" },
  { part: "좌 팔꿈치",   x: 12,  y: 104, side: "L" },
  { part: "우 팔꿈치",   x: 98,  y: 104, side: "R" },
  { part: "좌 손목",     x: 8,   y: 138, side: "L" },
  { part: "우 손목",     x: 102, y: 138, side: "R" },
  { part: "좌 고관절",   x: 33,  y: 146, side: "L" },
  { part: "우 고관절",   x: 77,  y: 146, side: "R" },
  { part: "좌 무릎",     x: 32,  y: 196, side: "L" },
  { part: "우 무릎",     x: 78,  y: 196, side: "R" },
  { part: "좌 발목",     x: 32,  y: 238, side: "L" },
  { part: "우 발목",     x: 78,  y: 238, side: "R" },
];

// 후면 핫스팟
const BACK_SPOTS: Spot[] = [
  { part: "목",          x: 55,  y: 38,  side: "C" },
  { part: "좌 어깨후면", x: 23,  y: 52,  side: "L" },
  { part: "우 어깨후면", x: 87,  y: 52,  side: "R" },
  { part: "상부등",      x: 55,  y: 68,  side: "C" },
  { part: "중부등",      x: 55,  y: 90,  side: "C" },
  { part: "좌 기립근",   x: 43,  y: 112, side: "L" },
  { part: "우 기립근",   x: 67,  y: 112, side: "R" },
  { part: "엉치",        x: 55,  y: 132, side: "C" },
  { part: "좌 종아리",   x: 31,  y: 218, side: "L" },
  { part: "우 종아리",   x: 79,  y: 218, side: "R" },
  { part: "좌 발바닥",   x: 31,  y: 248, side: "L" },
  { part: "우 발바닥",   x: 79,  y: 248, side: "R" },
];

// 전면 상세 SVG (viewBox 0 0 110 268)
function FrontBody() {
  const c = "#94a3b8"; const w = 1.1;
  return (
    <g stroke={c} fill="none" strokeWidth={w} strokeLinecap="round" strokeLinejoin="round">
      {/* ── HEAD ── */}
      <path d="M55,6 C44,6 36,12 36,22 C36,31 41,37 47,39 C47,41 47,43 46,45 L64,45 C63,43 63,41 63,39 C69,37 74,31 74,22 C74,12 66,6 55,6 Z"/>
      {/* Ear detail */}
      <path d="M36,20 C34,20 33,23 34,26 C35,28 36,27 36,26" strokeWidth="0.8"/>
      <path d="M74,20 C76,20 77,23 76,26 C75,28 74,27 74,26" strokeWidth="0.8"/>
      {/* Chin line */}
      <path d="M44,37 C47,40 55,41 63,37" strokeWidth="0.7"/>

      {/* ── NECK ── */}
      <path d="M47,39 C46,41 45,44 46,47 M63,39 C64,41 65,44 64,47"/>
      <path d="M46,47 C48,48 55,49 64,47" strokeWidth="0.7"/>

      {/* ── SHOULDERS & TRAPEZIUS ── */}
      <path d="M46,45 C40,45 28,49 20,56"/>
      <path d="M64,45 C70,45 82,49 90,56"/>
      {/* Deltoid roundness */}
      <path d="M20,56 C17,60 16,66 17,72"/>
      <path d="M90,56 C93,60 94,66 93,72"/>

      {/* ── TORSO ── */}
      {/* Left side */}
      <path d="M20,56 C18,68 17,84 19,104 C20,116 24,128 28,134"/>
      {/* Right side */}
      <path d="M90,56 C92,68 93,84 91,104 C90,116 86,128 82,134"/>
      {/* Chest / pec line */}
      <path d="M22,66 C32,74 45,76 55,76 C65,76 78,74 88,66" strokeWidth="0.8"/>
      {/* Sternum center */}
      <path d="M55,49 L55,134" strokeWidth="0.5" strokeDasharray="2,2"/>
      {/* Abs lines */}
      <path d="M47,82 L63,82 M46,94 L64,94 M46,106 L64,106" strokeWidth="0.6" strokeDasharray="1.5,1.5"/>
      {/* Navel */}
      <circle cx="55" cy="113" r="1.8" fill={c} stroke="none"/>
      {/* Oblique lines */}
      <path d="M28,100 C34,110 40,114 46,118 M82,100 C76,110 70,114 64,118" strokeWidth="0.7"/>

      {/* ── HIPS & PELVIS ── */}
      <path d="M28,134 C34,142 44,147 55,148 C66,147 76,142 82,134"/>
      {/* Groin lines */}
      <path d="M40,147 C43,153 55,155 55,155 C55,155 67,153 70,147" strokeWidth="0.8"/>

      {/* ── LEFT ARM ── */}
      {/* Outer bicep */}
      <path d="M20,56 C13,68 9,88 8,108"/>
      {/* Inner bicep */}
      <path d="M24,60 C19,72 16,92 16,110"/>
      {/* Bicep peak */}
      <path d="M9,82 C11,78 15,77 17,80" strokeWidth="0.7"/>
      {/* Elbow crease */}
      <path d="M8,108 C9,112 12,113 16,110"/>
      {/* Outer forearm */}
      <path d="M8,108 C6,122 5,136 5,144"/>
      {/* Inner forearm */}
      <path d="M16,110 C14,122 13,134 13,142"/>
      {/* Wrist */}
      <path d="M5,144 C6,148 9,149 13,148 L13,142"/>
      {/* Hand */}
      <path d="M5,144 C4,150 5,155 8,156 L13,156 C15,155 15,150 13,148"/>

      {/* ── RIGHT ARM ── */}
      {/* Outer bicep */}
      <path d="M90,56 C97,68 101,88 102,108"/>
      {/* Inner bicep */}
      <path d="M86,60 C91,72 94,92 94,110"/>
      {/* Bicep peak */}
      <path d="M101,82 C99,78 95,77 93,80" strokeWidth="0.7"/>
      {/* Elbow crease */}
      <path d="M102,108 C101,112 98,113 94,110"/>
      {/* Outer forearm */}
      <path d="M102,108 C104,122 105,136 105,144"/>
      {/* Inner forearm */}
      <path d="M94,110 C96,122 97,134 97,142"/>
      {/* Wrist */}
      <path d="M105,144 C104,148 101,149 97,148 L97,142"/>
      {/* Hand */}
      <path d="M105,144 C106,150 105,155 102,156 L97,156 C95,155 95,150 97,148"/>

      {/* ── LEFT LEG ── */}
      {/* Outer quad */}
      <path d="M37,150 C33,172 31,192 30,206"/>
      {/* Inner quad */}
      <path d="M55,155 C52,170 49,188 47,204"/>
      {/* Quad sweep detail */}
      <path d="M40,158 C37,178 35,194 34,206" strokeWidth="0.7" strokeDasharray="1.5,1.5"/>
      {/* Knee */}
      <path d="M30,206 C29,210 30,216 32,218"/>
      <path d="M47,204 C47,208 46,214 44,217"/>
      {/* Kneecap */}
      <path d="M30,212 C34,210 39,210 44,213" strokeWidth="0.9"/>
      {/* Shin (tibia) */}
      <path d="M32,218 C31,232 31,242 32,252"/>
      <path d="M44,217 C43,230 43,240 44,250"/>
      {/* Ankle */}
      <path d="M32,252 C31,256 33,259 38,260"/>
      <path d="M44,250 C44,255 42,259 38,260"/>
      {/* Foot */}
      <path d="M30,255 C26,257 24,261 28,263 C33,265 44,264 46,260 L38,260"/>

      {/* ── RIGHT LEG ── */}
      {/* Outer quad */}
      <path d="M73,150 C77,172 79,192 80,206"/>
      {/* Inner quad */}
      <path d="M55,155 C58,170 61,188 63,204"/>
      {/* Quad sweep detail */}
      <path d="M70,158 C73,178 75,194 76,206" strokeWidth="0.7" strokeDasharray="1.5,1.5"/>
      {/* Knee */}
      <path d="M80,206 C81,210 80,216 78,218"/>
      <path d="M63,204 C63,208 64,214 66,217"/>
      {/* Kneecap */}
      <path d="M80,212 C76,210 71,210 66,213" strokeWidth="0.9"/>
      {/* Shin (tibia) */}
      <path d="M78,218 C79,232 79,242 78,252"/>
      <path d="M66,217 C67,230 67,240 66,250"/>
      {/* Ankle */}
      <path d="M78,252 C79,256 77,259 72,260"/>
      <path d="M66,250 C66,255 68,259 72,260"/>
      {/* Foot */}
      <path d="M80,255 C84,257 86,261 82,263 C77,265 66,264 64,260 L72,260"/>
    </g>
  );
}

// 후면 상세 SVG
function BackBody() {
  const c = "#94a3b8"; const w = 1.1;
  return (
    <g stroke={c} fill="none" strokeWidth={w} strokeLinecap="round" strokeLinejoin="round">
      {/* ── HEAD ── */}
      <path d="M55,6 C44,6 36,12 36,22 C36,31 41,37 47,39 C47,41 46,44 46,45 L64,45 C64,44 63,41 63,39 C69,37 74,31 74,22 C74,12 66,6 55,6 Z"/>
      <path d="M36,20 C34,20 33,23 34,26 C35,28 36,27 36,26" strokeWidth="0.8"/>
      <path d="M74,20 C76,20 77,23 76,26 C75,28 74,27 74,26" strokeWidth="0.8"/>

      {/* ── NECK & TRAPS ── */}
      <path d="M47,39 C46,41 45,44 46,47 M63,39 C64,41 65,44 64,47"/>
      {/* Trapezius */}
      <path d="M46,45 C40,45 28,50 20,57"/>
      <path d="M64,45 C70,45 82,50 90,57"/>
      <path d="M46,47 C50,52 55,53 60,52 C65,51 55,53 55,53" strokeWidth="0.7"/>

      {/* ── DELTOIDS ── */}
      <path d="M20,57 C17,61 16,67 17,73"/>
      <path d="M90,57 C93,61 94,67 93,73"/>

      {/* ── BACK TORSO ── */}
      <path d="M20,57 C18,70 17,86 19,106 C20,118 24,130 28,136"/>
      <path d="M90,57 C92,70 93,86 91,106 C90,118 86,130 82,136"/>
      {/* Spine */}
      <path d="M55,49 L55,136" strokeWidth="0.6" strokeDasharray="2,2"/>
      {/* Shoulder blades */}
      <path d="M26,60 C28,72 30,82 28,90 C32,88 37,82 35,70 Z" strokeWidth="0.9"/>
      <path d="M84,60 C82,72 80,82 82,90 C78,88 73,82 75,70 Z" strokeWidth="0.9"/>
      {/* Lat muscles */}
      <path d="M22,74 C24,90 26,106 28,120" strokeWidth="0.8"/>
      <path d="M88,74 C86,90 84,106 82,120" strokeWidth="0.8"/>
      {/* Erector spinae grooves */}
      <path d="M50,54 C48,76 46,100 45,122 M60,54 C62,76 64,100 65,122" strokeWidth="0.7"/>
      {/* Lower back / lumbar */}
      <path d="M34,122 C40,128 55,130 55,130 C55,130 70,128 76,122" strokeWidth="0.8"/>

      {/* ── GLUTES ── */}
      <path d="M28,136 C34,148 44,153 55,154 C66,153 76,148 82,136"/>
      {/* Glute crease */}
      <path d="M34,148 C40,156 55,158 55,158 C55,158 70,156 76,148" strokeWidth="0.9"/>

      {/* ── LEFT ARM (back view) ── */}
      <path d="M20,57 C13,69 9,89 8,110"/>
      <path d="M24,61 C19,73 16,93 16,112"/>
      {/* Tricep detail */}
      <path d="M10,80 C12,76 16,76 17,80" strokeWidth="0.7"/>
      {/* Elbow point */}
      <path d="M8,110 C9,114 13,114 16,112"/>
      <path d="M8,110 C6,124 5,138 5,146"/>
      <path d="M16,112 C14,124 13,136 13,144"/>
      <path d="M5,146 C6,150 9,151 13,150 L13,144"/>
      <path d="M5,146 C4,152 5,157 8,158 L13,158 C15,157 15,152 13,150"/>

      {/* ── RIGHT ARM (back view) ── */}
      <path d="M90,57 C97,69 101,89 102,110"/>
      <path d="M86,61 C91,73 94,93 94,112"/>
      <path d="M100,80 C98,76 94,76 93,80" strokeWidth="0.7"/>
      <path d="M102,110 C101,114 97,114 94,112"/>
      <path d="M102,110 C104,124 105,138 105,146"/>
      <path d="M94,112 C96,124 97,136 97,144"/>
      <path d="M105,146 C104,150 101,151 97,150 L97,144"/>
      <path d="M105,146 C106,152 105,157 102,158 L97,158 C95,157 95,152 97,150"/>

      {/* ── LEFT LEG (back) ── */}
      {/* Outer hamstring */}
      <path d="M37,156 C33,178 31,198 30,210"/>
      {/* Inner hamstring */}
      <path d="M55,158 C52,174 49,194 47,208"/>
      {/* Hamstring separation */}
      <path d="M43,162 C41,180 39,198 38,210" strokeWidth="0.7" strokeDasharray="1.5,1.5"/>
      {/* Knee (back/popliteal) */}
      <path d="M30,210 C29,215 30,220 32,222"/>
      <path d="M47,208 C47,212 46,218 44,220"/>
      <path d="M30,216 C34,214 40,214 44,216" strokeWidth="0.8"/>
      {/* Calf (gastrocnemius) */}
      <path d="M32,222 C30,234 30,242 32,252"/>
      <path d="M44,220 C43,232 42,240 44,250"/>
      {/* Calf muscle belly */}
      <path d="M33,226 C35,234 34,242 33,248" strokeWidth="0.8"/>
      <path d="M41,226 C40,234 41,242 42,248" strokeWidth="0.8"/>
      {/* Ankle & foot */}
      <path d="M32,252 C31,257 33,260 38,261"/>
      <path d="M44,250 C44,256 42,260 38,261"/>
      <path d="M30,256 C26,258 24,262 28,264 C33,266 44,265 46,261 L38,261"/>

      {/* ── RIGHT LEG (back) ── */}
      <path d="M73,156 C77,178 79,198 80,210"/>
      <path d="M55,158 C58,174 61,194 63,208"/>
      <path d="M67,162 C69,180 71,198 72,210" strokeWidth="0.7" strokeDasharray="1.5,1.5"/>
      <path d="M80,210 C81,215 80,220 78,222"/>
      <path d="M63,208 C63,212 64,218 66,220"/>
      <path d="M80,216 C76,214 70,214 66,216" strokeWidth="0.8"/>
      <path d="M78,222 C80,234 80,242 78,252"/>
      <path d="M66,220 C67,232 68,240 66,250"/>
      <path d="M77,226 C75,234 76,242 77,248" strokeWidth="0.8"/>
      <path d="M69,226 C70,234 69,242 68,248" strokeWidth="0.8"/>
      <path d="M78,252 C79,257 77,260 72,261"/>
      <path d="M66,250 C66,256 68,260 72,261"/>
      <path d="M80,256 C84,258 86,262 82,264 C77,266 66,265 64,261 L72,261"/>
    </g>
  );
}

function BodyPainMap({ selected, onChange }: { selected: string[]; onChange: (v: string[]) => void }) {
  function toggle(part: string) {
    onChange(selected.includes(part) ? selected.filter(p => p !== part) : [...selected, part]);
  }

  function renderSpots(spots: Spot[]) {
    return spots.map((s, i) => {
      const on = selected.includes(s.part);
      const isLeft = s.side === "L";   // screen left
      const isRight = s.side === "R";  // screen right
      const labelX = isLeft ? s.x - 8 : isRight ? s.x + 8 : s.x;
      const anchor = isLeft ? "end" : isRight ? "start" : "middle";
      // short label: strip "좌 " / "우 " prefix for display on figure
      const label = s.part.replace(/^[좌우] /, "");
      return (
        <g key={i} onClick={() => toggle(s.part)} style={{ cursor: "pointer" }}>
          {/* Large invisible tap zone */}
          <circle cx={s.x} cy={s.y} r={13} fill="transparent" />
          {/* Dot */}
          <circle
            cx={s.x} cy={s.y} r={6}
            fill={on ? "#1a80ff" : "#fff"}
            stroke={on ? "#1a80ff" : "#94a3b8"}
            strokeWidth={1.4}
          />
          {on ? (
            <text x={s.x} y={s.y + 0.5} textAnchor="middle" dominantBaseline="middle"
              fontSize="6" fill="white" fontWeight="bold">✓</text>
          ) : (
            <text x={s.x} y={s.y + 0.5} textAnchor="middle" dominantBaseline="middle"
              fontSize="4.5" fill="#94a3b8">+</text>
          )}
          {/* Label */}
          <text
            x={labelX} y={s.y}
            textAnchor={anchor}
            dominantBaseline="middle"
            fontSize="5.2"
            fill={on ? "#1a80ff" : "#64748b"}
            fontWeight={on ? "700" : "400"}
          >
            {label}
          </text>
        </g>
      );
    });
  }

  const hasSelected = selected.filter(p => p !== "기타").length > 0;

  return (
    <div className="space-y-3">
      {/* 좌/우 범례 */}
      <div className="flex justify-between text-[10px] text-muted-foreground px-1">
        <span>← 우측 신체</span>
        <span>좌측 신체 →</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {/* 전면 */}
        <div className="space-y-1">
          <p className="text-xs text-center font-semibold text-muted-foreground tracking-wide">전면 (前)</p>
          <div className="bg-slate-50 rounded-xl border border-border overflow-hidden">
            <svg viewBox="0 0 110 268" className="w-full">
              <FrontBody />
              {renderSpots(FRONT_SPOTS)}
            </svg>
          </div>
        </div>
        {/* 후면 */}
        <div className="space-y-1">
          <p className="text-xs text-center font-semibold text-muted-foreground tracking-wide">후면 (後)</p>
          <div className="bg-slate-50 rounded-xl border border-border overflow-hidden">
            <svg viewBox="0 0 110 268" className="w-full">
              <BackBody />
              {renderSpots(BACK_SPOTS)}
            </svg>
          </div>
        </div>
      </div>

      {/* 기타 버튼 */}
      <div className="flex flex-wrap gap-1.5 items-center">
        <button
          onClick={() => toggle("기타")}
          className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
            selected.includes("기타")
              ? "bg-primary/20 border-primary text-primary"
              : "border-border text-muted-foreground hover:border-primary/40"
          }`}
        >
          + 기타
        </button>
        {hasSelected && (
          <div className="flex flex-wrap gap-1">
            {selected.filter(p => p !== "기타").map(p => (
              <span key={p} className="inline-flex items-center gap-1 text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
                {p}
                <button onClick={() => toggle(p)} className="text-primary/60 hover:text-primary leading-none">×</button>
              </span>
            ))}
          </div>
        )}
        {selected.includes("기타") && (
          <span className="inline-flex items-center gap-1 text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
            기타
            <button onClick={() => toggle("기타")} className="text-primary/60 hover:text-primary leading-none">×</button>
          </span>
        )}
        {selected.length > 0 && (
          <button onClick={() => onChange([])} className="text-[10px] text-muted-foreground underline ml-1">전체 해제</button>
        )}
      </div>

      {selected.length > 0 && (
        <p className="text-xs text-muted-foreground">
          선택된 부위: <span className="text-foreground font-medium">{selected.join(" · ")}</span>
        </p>
      )}
    </div>
  );
}

function nowTimeStr() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <h2 className="text-base font-bold text-primary">{title}</h2>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

export default function AttendanceCheck({ memberId }: Props) {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const params = new URLSearchParams(search);
  const dateParam = params.get("date") ?? new Date().toISOString().split("T")[0];

  const [status, setStatus] = useState<Status>("attended");
  const [checkDate, setCheckDate] = useState(dateParam);
  const [checkTime, setCheckTime] = useState(nowTimeStr());
  const [conditionScore, setConditionScore] = useState("");
  const [sleepHours, setSleepHours] = useState("");
  const [energyLevel, setEnergyLevel] = useState("");
  const [dietItems, setDietItems] = useState<string[]>([]);
  const [painLevel, setPainLevel] = useState("");
  const [painAreas, setPainAreas] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [deductSession, setDeductSession] = useState(false);
  const [selectedPkgId, setSelectedPkgId] = useState<number | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const { data: member } = trpc.members.getById.useQuery({ id: memberId });
  const { data: existing } = trpc.attendanceChecks.getByMemberDate.useQuery({ memberId, date: dateParam });
  const { data: ptPackageList } = trpc.pt.listByMember.useQuery({ memberId });
  const { data: sessionLogs } = trpc.pt.sessionLogs.useQuery({ memberId });

  const activePkgs = ptPackageList?.filter(
    (p) => p.status === "active" && p.totalSessions > p.usedSessions
  ) ?? [];

  const alreadyDeducted = sessionLogs?.some((l) => l.sessionDate === dateParam) ?? false;

  useEffect(() => {
    if (activePkgs.length > 0 && selectedPkgId === null) {
      setSelectedPkgId(activePkgs[0].id);
    }
  }, [activePkgs.length]);

  useEffect(() => {
    if (ptPackageList === undefined) return;
    if (alreadyDeducted) {
      setDeductSession(false);
      return;
    }
    if (activePkgs.length > 0 && !existing) {
      setDeductSession(true);
    }
  }, [ptPackageList, existing, alreadyDeducted]);

  useEffect(() => {
    if (!existing) return;
    setStatus(existing.status as Status);
    setCheckDate(existing.checkDate);
    setCheckTime(existing.checkTime ?? nowTimeStr());
    setConditionScore(existing.conditionScore != null ? String(existing.conditionScore) : "");
    setSleepHours(existing.sleepHours ?? "");
    setEnergyLevel(existing.energyLevel ?? "");
    setDietItems(existing.diet ? JSON.parse(existing.diet) : []);
    setPainLevel(existing.painLevel != null ? String(existing.painLevel) : "");
    try { setPainAreas(existing.painArea ? JSON.parse(existing.painArea) : []); } catch { setPainAreas(existing.painArea ? [existing.painArea] : []); }
    setNotes(existing.notes ?? "");
  }, [existing]);

  const deleteMutation = trpc.attendanceChecks.delete.useMutation({
    onSuccess: () => {
      toast.success("출석이 취소되었습니다.");
      setLocation(`/attendance?date=${dateParam}`);
    },
    onError: (err) => toast.error(err.message || "취소 실패"),
  });

  const useSessionMutation = trpc.pt.useSession.useMutation({
    onError: (err) => toast.error(err.message || "세션 차감 실패"),
  });

  const upsertMutation = trpc.attendanceChecks.upsert.useMutation({
    onSuccess: () => {
      if (deductSession && status === "attended" && selectedPkgId) {
        useSessionMutation.mutate(
          { packageId: selectedPkgId, memberId, sessionDate: checkDate },
          {
            onSettled: () => {
              toast.success("출석 및 세션이 저장되었습니다.");
              setLocation(`/attendance?date=${checkDate}`);
            },
          }
        );
      } else {
        toast.success("출석이 저장되었습니다.");
        setLocation(`/attendance?date=${checkDate}`);
      }
    },
    onError: (err) => toast.error(err.message || "저장 실패"),
  });

  const handleSave = () => {
    upsertMutation.mutate({
      memberId,
      checkDate,
      checkTime,
      status,
      conditionScore: conditionScore ? parseInt(conditionScore) : undefined,
      sleepHours: sleepHours || undefined,
      energyLevel: energyLevel || undefined,
      diet: dietItems.length ? JSON.stringify(dietItems) : undefined,
      painLevel: painLevel ? parseInt(painLevel) : undefined,
      painArea: painAreas.length ? JSON.stringify(painAreas) : undefined,
      painSide: undefined,
      notes: notes || undefined,
    });
  };

  const toggleDiet = (option: string) => {
    setDietItems((prev) =>
      prev.includes(option) ? prev.filter((d) => d !== option) : [...prev, option]
    );
  };

  const toggleBodyPart = (part: string) => {
    setPainAreas((prev) =>
      prev.includes(part) ? prev.filter((p) => p !== part) : [...prev, part]
    );
  };

  const isSaving = upsertMutation.isPending || useSessionMutation.isPending;

  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setLocation(`/attendance?date=${dateParam}`)}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-base font-bold flex-1">
          {member?.name ?? "..."} - 수업 전 컨디션 체크
        </h1>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setStatus((s) => s === "noshow" ? "attended" : "noshow")}
            className={`text-xs px-2 py-1 rounded border transition-colors ${
              status === "noshow"
                ? "bg-red-500/20 text-red-400 border-red-500/40"
                : "text-muted-foreground border-border"
            }`}
          >
            노쇼
          </button>
          <button
            onClick={() => setStatus((s) => s === "cancelled" ? "attended" : "cancelled")}
            className={`text-xs px-2 py-1 rounded border transition-colors ${
              status === "cancelled"
                ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/40"
                : "text-muted-foreground border-border"
            }`}
          >
            캔슬
          </button>
          {existing && (
            <button
              onClick={() => setDeleteConfirmOpen(true)}
              disabled={deleteMutation.isPending}
              className="text-xs px-2 py-1 rounded border border-gray-500/40 text-gray-400 hover:bg-gray-500/20 transition-colors"
            >
              출석취소
            </button>
          )}
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-5 space-y-8">

        {/* 기본 정보 */}
        <Section title="기본 정보">
          <div className="grid grid-cols-2 gap-3">
            <Field label="날짜">
              <input
                type="date"
                value={checkDate}
                onChange={(e) => setCheckDate(e.target.value)}
                className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground"
              />
            </Field>
            <Field label="시간">
              <input
                type="time"
                value={checkTime}
                onChange={(e) => setCheckTime(e.target.value)}
                className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground"
              />
            </Field>
          </div>
        </Section>

        {/* 컨디션 평가 */}
        <Section title="컨디션 평가">
          <Field label="오늘 컨디션 (1 매우안좋음 → 5 최고)">
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((v) => (
                <button
                  key={v}
                  onClick={() => setConditionScore(conditionScore === String(v) ? "" : String(v))}
                  className={`flex-1 py-3 text-sm font-medium rounded-lg border transition-colors ${
                    conditionScore === String(v)
                      ? "bg-primary/20 border-primary/40 text-primary"
                      : "border-border text-muted-foreground hover:border-primary/30"
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
          </Field>
          <Field label="수면시간">
            <div className="grid grid-cols-6 gap-1.5">
              {SLEEP_OPTIONS.map((v) => (
                <button
                  key={v}
                  onClick={() => setSleepHours(sleepHours === v ? "" : v)}
                  className={`py-2 text-sm rounded-lg border transition-colors text-center ${
                    sleepHours === v
                      ? "bg-primary/20 border-primary/40 text-primary"
                      : "border-border text-muted-foreground hover:border-primary/30"
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
          </Field>
          <Field label="에너지 수준">
            <div className="flex gap-2">
              {["낮음", "보통", "높음"].map((v) => (
                <button
                  key={v}
                  onClick={() => setEnergyLevel(energyLevel === v ? "" : v)}
                  className={`flex-1 py-2 text-sm rounded-lg border transition-colors ${
                    energyLevel === v
                      ? "bg-primary/20 border-primary/40 text-primary"
                      : "border-border text-muted-foreground hover:border-primary/30"
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
          </Field>
        </Section>

        {/* 식단 정보 */}
        <Section title="식단 정보">
          <Field label="오늘 섭취한 식단 유형 (중복 선택 가능)">
            <div className="grid grid-cols-2 gap-2">
              {DIET_OPTIONS.map((option) => (
                <button
                  key={option}
                  onClick={() => toggleDiet(option)}
                  className={`flex items-center gap-2 px-2 py-2.5 text-xs rounded-lg border transition-colors text-left ${
                    dietItems.includes(option)
                      ? "bg-primary/20 border-primary/40 text-primary"
                      : "border-border text-muted-foreground hover:border-primary/30"
                  }`}
                >
                  <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                    dietItems.includes(option) ? "bg-primary border-primary" : "border-muted-foreground/50"
                  }`}>
                    {dietItems.includes(option) && <Check className="h-3 w-3 text-white" />}
                  </div>
                  {option}
                </button>
              ))}
            </div>
          </Field>
        </Section>

        {/* 통증 정보 */}
        <Section title="통증 정보">
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>이상없음</span>
              <span>통증심함</span>
            </div>
            <div className="flex gap-1">
              {Array.from({ length: 11 }, (_, i) => String(i)).map((v) => (
                <button
                  key={v}
                  onClick={() => setPainLevel(painLevel === v ? "" : v)}
                  className={`flex-1 aspect-square flex items-center justify-center text-sm rounded-full border transition-colors ${
                    painLevel === v
                      ? "bg-primary/20 border-primary/40 text-primary"
                      : "border-border text-muted-foreground hover:border-primary/30"
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm text-muted-foreground">통증 부위 <span className="text-xs">(신체를 직접 탭하세요)</span></label>
            <BodyPainMap selected={painAreas} onChange={setPainAreas} />
          </div>
        </Section>

        {/* 추가 메모 */}
        <Section title="추가 메모">
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="특이사항이나 추가 메모"
            rows={4}
          />
        </Section>

        {/* PT 세션 차감 */}
        {activePkgs.length > 0 && status === "attended" && (
          <Section title="PT 세션 차감">
            <div className="space-y-3">
              {alreadyDeducted ? (
                <div className="flex items-center gap-2 w-full py-2.5 px-3 rounded-lg border border-green-500/30 bg-green-500/10 text-sm text-green-400">
                  <Dumbbell className="h-4 w-4 shrink-0" />
                  오늘 세션 차감 완료
                  <span className="ml-auto text-xs opacity-70">완료</span>
                </div>
              ) : (
              <button
                onClick={() => setDeductSession((d) => !d)}
                className={`flex items-center gap-2 w-full py-2.5 px-3 rounded-lg border text-sm transition-colors ${
                  deductSession
                    ? "bg-primary/20 border-primary/40 text-primary"
                    : "border-border text-muted-foreground hover:border-primary/30"
                }`}
              >
                <Dumbbell className="h-4 w-4 shrink-0" />
                PT 세션 1회 차감
                <span className="ml-auto text-xs opacity-70">
                  {deductSession ? "ON" : "OFF"}
                </span>
              </button>
              )}
              {deductSession && activePkgs.length > 1 && (
                <div className="flex gap-2 flex-wrap">
                  {activePkgs.map((pkg) => (
                    <button
                      key={pkg.id}
                      onClick={() => setSelectedPkgId(pkg.id)}
                      className={`text-xs px-2.5 py-1.5 rounded-lg border transition-colors ${
                        selectedPkgId === pkg.id
                          ? "bg-primary/20 border-primary/40 text-primary"
                          : "border-border text-muted-foreground hover:border-primary/30"
                      }`}
                    >
                      {pkg.packageName || "PT"} ({pkg.totalSessions - pkg.usedSessions}회 잔여)
                    </button>
                  ))}
                </div>
              )}
              {deductSession && activePkgs.length === 1 && (
                <p className="text-xs text-muted-foreground">
                  {activePkgs[0].packageName || "PT"} — 잔여 {activePkgs[0].totalSessions - activePkgs[0].usedSessions}회
                </p>
              )}
            </div>
          </Section>
        )}

        {/* 버튼 */}
        <div className="flex gap-3 pt-2">
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? "저장 중..." : "저장"}
          </Button>
          <Button variant="outline" onClick={() => setLocation(`/attendance?date=${dateParam}`)}>
            취소
          </Button>
        </div>
      </div>

      {/* 출석 취소 확인 다이얼로그 */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle>출석 취소</DialogTitle>
            <DialogDescription>
              {member?.name}님의 출석 기록을 삭제하고 미출석 상태로 되돌립니다.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 pt-1">
            <Button variant="outline" className="flex-1" onClick={() => setDeleteConfirmOpen(false)}>
              닫기
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              disabled={deleteMutation.isPending}
              onClick={() => {
                setDeleteConfirmOpen(false);
                deleteMutation.mutate({ memberId, date: dateParam });
              }}
            >
              {deleteMutation.isPending ? "취소 중..." : "출석 취소"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
