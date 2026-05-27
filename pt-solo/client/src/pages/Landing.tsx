import { useLocation } from "wouter";
import { useState, useEffect, useRef } from "react";
import {
  ClipboardList, RefreshCw, NotebookPen, Globe, Settings,
  Users, MessageSquare, BarChart2, Sparkles,
  LayoutDashboard, Dumbbell, Video, Salad, Activity,
} from "lucide-react";

// ── 수정 가능한 콘텐츠 ─────────────────────────────────────────────────────────

const PROBLEMS = [
  { icon: ClipboardList, title: "회원관리의 어려움", desc: "엑셀, 메모, 카카오톡으로 흩어진 회원 정보. 체계 없는 관리는 결국 이탈로 이어집니다." },
  { icon: RefreshCw, title: "재등록 관리의 부재", desc: "언제 끊기는지 모른 채 회원이 떠나고서야 알게 되는 재등록 타이밍." },
  { icon: NotebookPen, title: "기록 부족", desc: "기억에 의존하는 수업 관리. 회원의 변화를 추적하지 못하면 결과도 없습니다." },
  { icon: Globe, title: "브랜딩 부족", desc: "실력이 있어도 보여줄 채널이 없는 현실. 트레이너 개인 브랜드가 필요합니다." },
  { icon: Settings, title: "운영 시스템 부재", desc: "혼자 운영과 성장을 감당해야 하는 구조. 좋은 사람도 오래 버티기 어렵습니다." },
];

const FEATURES = [
  {
    key: "member",
    icon: Users,
    label: "회원관리",
    color: "blue",
    items: ["출석체크", "PT 관리", "건강리포트", "운동기록"],
    desc: "회원의 모든 정보를 한 곳에서 체계적으로 관리합니다.",
  },
  {
    key: "consult",
    icon: MessageSquare,
    label: "상담실",
    color: "violet",
    items: ["전자계약서", "상담일지", "재등록 관리", "상담 흐름"],
    desc: "첫 상담부터 재등록까지 상담의 전 과정을 관리합니다.",
  },
  {
    key: "analytics",
    icon: BarChart2,
    label: "성장분석",
    color: "cyan",
    items: ["재등록 분석", "회원 유지율", "출석 패턴", "운영 데이터"],
    desc: "데이터로 내 운영의 약점을 파악하고 성장 방향을 찾습니다.",
  },
  {
    key: "studio",
    icon: Sparkles,
    label: "작업실",
    color: "amber",
    items: ["개인 브랜딩", "트레이너 페이지", "SNS 관리", "콘텐츠"],
    desc: "트레이너로서의 브랜드를 만들고 잠재 회원에게 나를 알립니다.",
  },
];

const PLUS_CARDS = [
  { icon: LayoutDashboard, title: "개인 관리 페이지", items: ["회원별 전용 페이지", "운동·식단·기록 통합", "맞춤 콘텐츠 제공"] },
  { icon: Dumbbell, title: "맞춤 운동 프로그램", items: ["목표별 프로그램 구성", "회차별 운동 계획", "수행 기록 확인"] },
  { icon: Video, title: "운동 영상 제공", items: ["트레이너 지정 영상", "동작 설명 안내", "혼자서도 복습 가능"] },
  { icon: Salad, title: "맞춤 식단 설계", items: ["목표별 식단 방향", "식사 기록 관리", "피드백 기반 관리"] },
  { icon: Activity, title: "활동 데이터 확인", items: ["출석 기록", "운동 수행 기록", "변화 추적 및 이력"] },
];

const CULTURES = [
  { n: "01", t: "기록하는 문화", d: "감각과 경험만이 아닌, 회원의 변화와 수업의 흐름을 데이터로 기록하고 분석합니다." },
  { n: "02", t: "책임지는 문화", d: "회원의 몸과 건강을 다루는 직업인 만큼, 더 높은 전문성과 책임감을 갖습니다." },
  { n: "03", t: "함께 성장하는 문화", d: "트레이너와 강사가 경쟁 이전에 같은 업계를 성장시키는 파트너입니다." },
  { n: "04", t: "지속 가능한 운영 문화", d: "재등록 자동화, 데이터 기반 시스템으로 오래 살아남는 구조를 만듭니다." },
];

// ── 목업 컴포넌트들 ───────────────────────────────────────────────────────────

function PhoneFrame({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`relative bg-[#0d1117] rounded-[2rem] border border-white/10 overflow-hidden shadow-2xl shadow-black/60 ${className}`}>
      <div className="bg-[#080c12] px-5 pt-4 pb-2 flex items-center justify-between border-b border-white/5">
        <span className="text-[11px] font-black tracking-tight text-white">FIT <span className="text-blue-400">STEP</span></span>
        <div className="flex gap-1.5 items-center">
          <div className="w-1.5 h-1.5 rounded-full bg-green-400/60" />
          <div className="w-1.5 h-1.5 rounded-full bg-white/20" />
          <div className="w-1.5 h-1.5 rounded-full bg-white/20" />
        </div>
      </div>
      <div className="overflow-hidden">{children}</div>
    </div>
  );
}

function DashboardMockup() {
  return (
    <PhoneFrame>
      <div className="p-4 space-y-3 bg-[#0a0f18]">
        {/* 상단 통계 */}
        <div className="grid grid-cols-3 gap-2">
          {[["32", "총 회원", "text-white"], ["8", "오늘 수업", "text-blue-400"], ["94%", "재등록률", "text-green-400"]].map(([v, l, c]) => (
            <div key={l as string} className="bg-white/[0.04] rounded-xl p-2.5 text-center border border-white/5">
              <div className={`text-base font-black ${c as string}`}>{v as string}</div>
              <div className="text-[9px] text-white/35 mt-0.5">{l as string}</div>
            </div>
          ))}
        </div>
        {/* 출석 목록 */}
        <div className="bg-white/[0.03] rounded-xl p-3 border border-white/5 space-y-2">
          <div className="text-[10px] font-bold text-white/40 mb-2">오늘 수업 현황</div>
          {[["김민준", "10:00", true], ["이서연", "11:30", true], ["박지훈", "14:00", false], ["최유진", "16:00", false]].map(([n, t, done]) => (
            <div key={n as string} className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500/30 to-violet-500/20 flex items-center justify-center text-[9px] font-bold text-white/70 border border-white/10">{(n as string)[0]}</div>
              <div className="flex-1">
                <div className="text-[10px] text-white/70">{n as string}</div>
                <div className="text-[9px] text-white/30">{t as string}</div>
              </div>
              <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${done ? "bg-blue-500/15 text-blue-400" : "bg-white/5 text-white/25"}`}>
                {done ? "출석" : "예정"}
              </span>
            </div>
          ))}
        </div>
        {/* 재등록 알림 */}
        <div className="bg-gradient-to-r from-orange-500/15 to-red-500/8 border border-orange-500/20 rounded-xl p-3">
          <div className="text-[9px] font-bold text-orange-400 mb-1.5">⚡ 재등록 임박 회원</div>
          {[["최유진", "3회 남음"], ["김태호", "1회 남음"]].map(([n, r]) => (
            <div key={n as string} className="flex justify-between items-center py-0.5">
              <span className="text-[10px] text-white/60">{n as string}</span>
              <span className="text-[9px] text-orange-400/80">{r as string}</span>
            </div>
          ))}
        </div>
        {/* 미니 차트 */}
        <div className="bg-white/[0.03] rounded-xl p-3 border border-white/5">
          <div className="text-[9px] text-white/35 mb-2">이번 달 출석률</div>
          <div className="flex items-end gap-1 h-8">
            {[60, 80, 70, 90, 75, 85, 95, 80, 88, 92, 85, 78, 90, 82].map((h, i) => (
              <div key={i} className="flex-1 rounded-sm" style={{ height: `${h}%`, background: `rgba(59,130,246,${0.2 + h * 0.004})` }} />
            ))}
          </div>
        </div>
      </div>
    </PhoneFrame>
  );
}

function AttendanceMockup() {
  return (
    <PhoneFrame>
      <div className="p-4 space-y-3 bg-[#0a0f18]">
        <div className="flex items-center justify-between mb-1">
          <div>
            <div className="text-xs font-bold text-white/80">수업 전 컨디션 체크</div>
            <div className="text-[9px] text-white/30">김민준 · 2026.05.26</div>
          </div>
          <div className="text-[9px] px-2 py-1 bg-blue-500/20 text-blue-400 rounded-full border border-blue-500/30 font-semibold">출석</div>
        </div>
        <div className="bg-white/[0.03] rounded-xl p-3 border border-white/5">
          <div className="text-[9px] text-white/35 mb-2 font-bold">컨디션 평가</div>
          <div className="flex gap-1.5">
            {[1,2,3,4,5].map(v => (
              <div key={v} className={`flex-1 py-2 text-center text-[10px] rounded-lg border font-bold ${v === 4 ? "bg-blue-500/20 border-blue-500/40 text-blue-400" : "border-white/8 text-white/20"}`}>{v}</div>
            ))}
          </div>
        </div>
        <div className="bg-white/[0.03] rounded-xl p-3 border border-white/5">
          <div className="text-[9px] text-white/35 mb-2 font-bold">수면시간</div>
          <div className="grid grid-cols-6 gap-1">
            {["4h↓","5h","6h","7h","8h","9h+"].map(v => (
              <div key={v} className={`py-1.5 text-center text-[8px] rounded-lg border ${v === "7h" ? "bg-blue-500/20 border-blue-500/40 text-blue-400" : "border-white/8 text-white/20"}`}>{v}</div>
            ))}
          </div>
        </div>
        <div className="bg-white/[0.03] rounded-xl p-3 border border-white/5">
          <div className="text-[9px] text-white/35 mb-2 font-bold">통증 부위</div>
          <div className="flex flex-wrap gap-1">
            {["좌 어깨", "허리"].map(p => (
              <span key={p} className="text-[8px] px-2 py-0.5 rounded-full bg-red-500/15 border border-red-500/25 text-red-400">{p}</span>
            ))}
          </div>
        </div>
        <div className="bg-white/[0.03] rounded-xl p-2.5 border border-blue-500/15 flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-blue-500/20 flex items-center justify-center"><Dumbbell className="h-3 w-3 text-blue-400/70" /></div>
          <div className="flex-1">
            <div className="text-[9px] text-white/60">PT 세션 1회 차감</div>
          </div>
          <div className="text-[9px] font-bold text-blue-400">ON</div>
        </div>
      </div>
    </PhoneFrame>
  );
}

function ContractMockup() {
  return (
    <PhoneFrame>
      <div className="p-4 space-y-3 bg-[#0a0f18]">
        <div className="text-xs font-bold text-white/80 mb-3">📄 전자계약서</div>
        <div className="bg-white/[0.03] rounded-xl p-3 border border-white/5 space-y-2">
          {[["회원명", "김민준"], ["계약 유형", "3개월 PT"], ["총 횟수", "36회"], ["시작일", "2026.05.01"]].map(([l, v]) => (
            <div key={l as string} className="flex justify-between items-center">
              <span className="text-[9px] text-white/35">{l as string}</span>
              <span className="text-[10px] text-white/70 font-semibold">{v as string}</span>
            </div>
          ))}
        </div>
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3">
          <div className="text-[9px] text-blue-400/80 font-bold mb-2">상담 메모</div>
          <div className="text-[9px] text-white/40 leading-relaxed">체중 감량 목표 -8kg. 다이어트 식단 병행. 주 3회 수업 희망. 허리 디스크 주의사항 있음.</div>
        </div>
        <div className="bg-white/[0.03] rounded-xl p-3 border border-white/5">
          <div className="text-[9px] text-white/35 mb-1.5 font-bold">재등록 예정</div>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 rounded-full bg-white/8 overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-violet-500" style={{ width: "78%" }} />
            </div>
            <span className="text-[9px] text-white/50">28/36회</span>
          </div>
        </div>
        <div className="flex gap-2">
          <div className="flex-1 py-2 text-center text-[9px] font-bold bg-blue-500/20 border border-blue-500/30 text-blue-400 rounded-xl">서명 완료</div>
          <div className="flex-1 py-2 text-center text-[9px] text-white/30 border border-white/8 rounded-xl">재등록 안내</div>
        </div>
      </div>
    </PhoneFrame>
  );
}

function AnalyticsMockup() {
  return (
    <PhoneFrame>
      <div className="p-4 space-y-3 bg-[#0a0f18]">
        <div className="text-xs font-bold text-white/80 mb-1">📊 성장 분석</div>
        <div className="grid grid-cols-2 gap-2">
          {[["재등록률", "94%", "↑ 3%", "green"], ["유지율", "87%", "↑ 5%", "blue"]].map(([l, v, d, c]) => (
            <div key={l as string} className={`bg-white/[0.03] border border-white/5 rounded-xl p-3`}>
              <div className="text-[9px] text-white/35 mb-1">{l as string}</div>
              <div className={`text-xl font-black ${c === "green" ? "text-green-400" : "text-blue-400"}`}>{v as string}</div>
              <div className={`text-[9px] mt-0.5 ${c === "green" ? "text-green-400/60" : "text-blue-400/60"}`}>{d as string}</div>
            </div>
          ))}
        </div>
        <div className="bg-white/[0.03] rounded-xl p-3 border border-white/5">
          <div className="text-[9px] text-white/35 mb-2 font-bold">월별 출석률 추이</div>
          <div className="flex items-end gap-1 h-12">
            {[[72,"Jan"],[78,"Feb"],[81,"Mar"],[85,"Apr"],[90,"May"]].map(([h, m]) => (
              <div key={m as string} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full rounded-t-sm bg-gradient-to-t from-blue-600/60 to-blue-400/30" style={{ height: `${h as number * 0.12}rem` }} />
                <span className="text-[7px] text-white/25">{m as string}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-white/[0.03] rounded-xl p-3 border border-white/5 space-y-2">
          <div className="text-[9px] text-white/35 font-bold">출석 패턴</div>
          {[["월·수·금", 85], ["화·목", 72], ["주말", 45]].map(([d, p]) => (
            <div key={d as string} className="flex items-center gap-2">
              <span className="text-[9px] text-white/50 w-14 shrink-0">{d as string}</span>
              <div className="flex-1 h-1.5 rounded-full bg-white/8 overflow-hidden">
                <div className="h-full rounded-full bg-blue-500/60" style={{ width: `${p}%` }} />
              </div>
              <span className="text-[9px] text-white/35">{p}%</span>
            </div>
          ))}
        </div>
      </div>
    </PhoneFrame>
  );
}

function PlusMockup() {
  return (
    <PhoneFrame>
      <div className="bg-[#0a0f18] p-4 space-y-3">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/40 to-violet-500/30 border border-blue-500/30 flex items-center justify-center text-xs font-black text-blue-300">K</div>
          <div>
            <div className="text-xs font-bold text-white/80">김민준님의 관리 페이지</div>
            <div className="text-[9px] text-blue-400">FITSTEP+ 회원</div>
          </div>
        </div>
        {/* 이번 달 운동 */}
        <div className="bg-gradient-to-r from-blue-600/15 to-violet-600/8 border border-blue-500/20 rounded-xl p-3">
          <div className="text-[9px] text-blue-400 font-bold mb-2">이번 주 운동 프로그램</div>
          {[["월", "스쿼트 4×12 / 레그프레스", true], ["수", "벤치프레스 4×10 / 숄더프레스", true], ["금", "데드리프트 3×8 / 루마니안", false]].map(([d, w, done]) => (
            <div key={d as string} className="flex items-center gap-2 py-1">
              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold ${done ? "bg-blue-500/30 text-blue-400" : "bg-white/5 text-white/25"}`}>{done ? "✓" : d as string}</div>
              <span className="text-[9px] text-white/50 flex-1">{w as string}</span>
            </div>
          ))}
        </div>
        {/* 영상 */}
        <div className="bg-white/[0.03] rounded-xl p-3 border border-white/5">
          <div className="text-[9px] text-white/35 font-bold mb-2">추천 운동 영상</div>
          {[["스쿼트 자세 교정", "3:42"], ["데드리프트 기초", "5:21"]].map(([title, dur]) => (
            <div key={title as string} className="flex items-center gap-2 py-1.5">
              <div className="w-8 h-6 rounded-lg bg-gradient-to-br from-blue-500/20 to-violet-500/15 border border-white/8 flex items-center justify-center">
                <div className="w-0 h-0 border-l-[5px] border-l-blue-400 border-y-[3px] border-y-transparent ml-0.5" />
              </div>
              <span className="text-[9px] text-white/55 flex-1">{title as string}</span>
              <span className="text-[8px] text-white/25">{dur as string}</span>
            </div>
          ))}
        </div>
        {/* 식단 */}
        <div className="bg-white/[0.03] rounded-xl p-3 border border-white/5">
          <div className="text-[9px] text-white/35 font-bold mb-2">오늘 식단</div>
          <div className="grid grid-cols-3 gap-1.5">
            {[["단백질", "165g", "blue"], ["탄수화물", "220g", "amber"], ["지방", "55g", "violet"]].map(([n, v, c]) => (
              <div key={n as string} className="text-center">
                <div className={`text-[10px] font-bold ${c === "blue" ? "text-blue-400" : c === "amber" ? "text-amber-400" : "text-violet-400"}`}>{v as string}</div>
                <div className="text-[8px] text-white/25">{n as string}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </PhoneFrame>
  );
}

// ── 유틸 컴포넌트 ──────────────────────────────────────────────────────────────

function SectionLabel({ text }: { text: string }) {
  return <p className="text-center text-[11px] font-bold tracking-[0.2em] text-blue-400/60 uppercase mb-4">{text}</p>;
}

function GlowCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      className={`relative rounded-2xl border border-white/[0.07] bg-white/[0.025] transition-all duration-300 ${hovered ? "border-blue-500/30 bg-blue-500/[0.04]" : ""} ${className}`}
      style={{ boxShadow: hovered ? "0 0 32px 0 rgba(59,130,246,0.1)" : "none" }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {children}
    </div>
  );
}

const COLOR_MAP: Record<string, { border: string; bg: string; text: string; tag: string }> = {
  blue:   { border: "border-blue-500/20",   bg: "from-blue-600/15 to-blue-800/5",   text: "text-blue-400",   tag: "bg-blue-500/10 text-blue-400/70 border-blue-500/15" },
  violet: { border: "border-violet-500/20", bg: "from-violet-600/15 to-violet-800/5", text: "text-violet-400", tag: "bg-violet-500/10 text-violet-400/70 border-violet-500/15" },
  cyan:   { border: "border-cyan-500/20",   bg: "from-cyan-600/15 to-cyan-800/5",   text: "text-cyan-400",   tag: "bg-cyan-500/10 text-cyan-400/70 border-cyan-500/15" },
  amber:  { border: "border-amber-500/20",  bg: "from-amber-600/15 to-amber-800/5",  text: "text-amber-400",  tag: "bg-amber-500/10 text-amber-400/70 border-amber-500/15" },
};

// ── 메인 ──────────────────────────────────────────────────────────────────────

export default function Landing() {
  const [, setLocation] = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const heroRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 24);
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);

  return (
    <div className="min-h-screen bg-[#060910] text-white overflow-x-hidden">

      {/* ── NAV ── */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? "bg-[#060910]/96 backdrop-blur-xl border-b border-white/5" : ""}`}>
        <div className="max-w-5xl mx-auto px-5 py-4 flex items-center justify-between">
          <span className="text-lg font-black tracking-tight select-none">FIT <span className="text-blue-400">STEP</span></span>
          <div className="flex items-center gap-2">
            <a href="/auth/kakao" className="text-sm text-white/45 hover:text-white px-3 py-1.5 transition-colors">로그인</a>
            <a href="/auth/kakao" className="text-sm font-bold px-4 py-1.5 rounded-full bg-blue-500 hover:bg-blue-400 transition-all shadow-lg shadow-blue-500/25">무료 시작</a>
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section ref={heroRef} className="relative min-h-screen flex items-center pt-20 pb-12 px-5 overflow-hidden">
        {/* 배경 */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/3 w-[700px] h-[700px] rounded-full bg-blue-600/7 blur-[140px]" />
          <div className="absolute top-1/4 right-0 w-72 h-72 rounded-full bg-violet-600/5 blur-[80px]" />
          <svg className="absolute inset-0 w-full h-full opacity-[0.035]" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="g" width="52" height="52" patternUnits="userSpaceOnUse">
                <path d="M 52 0 L 0 0 0 52" fill="none" stroke="white" strokeWidth="0.5"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#g)" />
          </svg>
        </div>

        <div className="relative z-10 max-w-5xl mx-auto w-full">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* 좌측: 텍스트 */}
            <div className="text-center lg:text-left order-2 lg:order-1">
              <div className="inline-flex items-center gap-2 text-[11px] font-bold tracking-widest text-blue-400 bg-blue-400/10 border border-blue-400/20 rounded-full px-4 py-1.5 mb-8">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse shrink-0" />
                피트니스 성장 플랫폼
              </div>
              <h1 className="text-[2.4rem] sm:text-[3rem] font-black leading-[1.1] tracking-tight mb-6">
                트레이너의 성장과<br />운영을 연결하다.
              </h1>
              <p className="text-[15px] text-white/42 leading-loose mb-10">
                회원관리부터 상담, 건강리포트, 개인 브랜딩까지.<br />
                트레이너와 강사를 위한 피트니스 성장 플랫폼.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start mb-8">
                <a href="/auth/kakao"
                  className="px-7 py-3.5 rounded-xl bg-blue-500 hover:bg-blue-400 transition-all font-bold text-[15px] shadow-xl shadow-blue-500/25 hover:-translate-y-0.5 hover:shadow-blue-500/40 text-center">
                  무료로 시작하기
                </a>
                <a href="/auth/kakao"
                  className="px-7 py-3.5 rounded-xl border border-white/10 hover:border-white/22 bg-white/[0.03] hover:bg-white/5 transition-all font-medium text-[15px] text-white/55 hover:text-white hover:-translate-y-0.5 text-center">
                  로그인
                </a>
              </div>
              <p className="text-xs text-white/18">무료로 시작 · 신용카드 불필요</p>
            </div>

            {/* 우측: 목업 */}
            <div className="relative order-1 lg:order-2 flex justify-center lg:justify-end">
              <div className="relative w-full max-w-[300px]">
                {/* 메인 목업 */}
                <div className="relative z-10">
                  <DashboardMockup />
                </div>
                {/* 플로팅: 출석체크 카드 */}
                <div className="absolute -left-8 top-1/3 z-20 w-44 bg-[#111827] border border-blue-500/20 rounded-2xl p-3 shadow-xl shadow-black/40">
                  <div className="text-[9px] font-bold text-blue-400 mb-2">✓ 출석 체크</div>
                  <div className="text-[11px] font-bold text-white/80">김민준</div>
                  <div className="text-[9px] text-white/35 mb-2">컨디션 4/5 · 수면 7h</div>
                  <div className="flex gap-1">
                    <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/20">좌 어깨</span>
                    <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/20">허리</span>
                  </div>
                </div>
                {/* 플로팅: 재등록 알림 */}
                <div className="absolute -right-6 bottom-16 z-20 w-40 bg-[#111827] border border-orange-500/25 rounded-2xl p-3 shadow-xl shadow-black/40">
                  <div className="text-[9px] font-bold text-orange-400 mb-1.5">⚡ 재등록 임박</div>
                  <div className="text-[10px] text-white/65">최유진 — 3회 남음</div>
                  <div className="mt-1.5 h-1 rounded-full bg-white/8 overflow-hidden">
                    <div className="h-full rounded-full bg-orange-400/60 w-[15%]" />
                  </div>
                </div>
                {/* 배경 glow */}
                <div className="absolute inset-0 -z-10 blur-3xl opacity-15 bg-gradient-to-br from-blue-600 to-violet-600 scale-75 rounded-full" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── WHY ── */}
      <section className="py-24 px-5 bg-[#070b12]">
        <div className="max-w-3xl mx-auto">
          <SectionLabel text="Why FIT STEP" />
          <h2 className="text-center text-[2rem] sm:text-[2.3rem] font-black leading-tight tracking-tight mb-4">왜 FIT STEP이<br />필요한가</h2>
          <p className="text-center text-white/35 text-sm mb-14">
            좋은 트레이너는 많지만,<br />오래 살아남기 어려운 업계의 현실이 있습니다.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {PROBLEMS.map(p => (
              <GlowCard key={p.title} className="p-5">
                <div className="flex gap-4">
                  <div className="shrink-0 mt-0.5 w-9 h-9 rounded-xl bg-white/6 border border-white/10 flex items-center justify-center">
                    <p.icon className="h-4 w-4 text-white/50" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm mb-1.5 text-white/85">{p.title}</h3>
                    <p className="text-xs text-white/35 leading-relaxed">{p.desc}</p>
                  </div>
                </div>
              </GlowCard>
            ))}
          </div>
          <div className="mt-12 text-center">
            <div className="inline-block bg-gradient-to-br from-blue-600/12 to-violet-600/8 border border-blue-500/18 rounded-2xl px-8 py-6 max-w-md">
              <p className="text-white/55 text-sm leading-loose">
                핏스텝은 <span className="text-white font-semibold">"혼자 살아남는 업계"</span>가 아니라<br />
                <span className="text-blue-400 font-bold">"함께 성장하는 업계"</span>를 만들기 위해 시작되었습니다.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── CORE FEATURES ── */}
      <section className="py-24 px-5">
        <div className="max-w-5xl mx-auto">
          <SectionLabel text="Core Features" />
          <h2 className="text-center text-[2rem] sm:text-[2.3rem] font-black leading-tight tracking-tight mb-4">현장에서 필요한<br />기능만 담았습니다</h2>
          <p className="text-center text-white/35 text-sm mb-16">운영의 반복을 줄이고, 수업과 회원에 온전히 집중할 수 있는 구조.</p>

          <div className="space-y-8">
            {/* 회원관리 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-center">
              <div className={`rounded-2xl border ${COLOR_MAP.blue.border} bg-gradient-to-br ${COLOR_MAP.blue.bg} p-7`}>
                <div className="w-9 h-9 rounded-xl bg-white/6 border border-white/10 flex items-center justify-center mb-4"><Users className="h-4 w-4 text-white/50" /></div>
                <div className={`text-xs font-bold ${COLOR_MAP.blue.text} mb-2 tracking-widest uppercase`}>회원관리</div>
                <h3 className="text-xl font-black mb-3 leading-snug">회원 한 명 한 명을<br />체계적으로 관리하세요</h3>
                <p className="text-sm text-white/40 leading-relaxed mb-5">출석부터 PT 패키지, 건강리포트, 운동기록까지 회원의 모든 데이터를 한 곳에서.</p>
                <div className="flex flex-wrap gap-2">
                  {["출석체크", "PT 관리", "건강리포트", "운동기록"].map(i => (
                    <span key={i} className={`text-xs px-3 py-1 rounded-full border ${COLOR_MAP.blue.tag}`}>{i}</span>
                  ))}
                </div>
              </div>
              <div className="flex justify-center lg:justify-end">
                <div className="w-full max-w-[220px]"><AttendanceMockup /></div>
              </div>
            </div>

            {/* 상담실 + 성장분석 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className={`rounded-2xl border ${COLOR_MAP.violet.border} bg-gradient-to-br ${COLOR_MAP.violet.bg} p-6`}>
                <div className="w-9 h-9 rounded-xl bg-white/6 border border-white/10 flex items-center justify-center mb-3"><MessageSquare className="h-4 w-4 text-white/50" /></div>
                <div className={`text-xs font-bold ${COLOR_MAP.violet.text} mb-1.5 tracking-widest uppercase`}>상담실</div>
                <h3 className="text-base font-black mb-2 leading-snug">상담부터 재등록까지</h3>
                <p className="text-xs text-white/38 leading-relaxed mb-4">전자계약서, 상담일지, 재등록 알림 관리.</p>
                <div className="flex flex-wrap gap-1.5">
                  {["전자계약서", "상담일지", "재등록"].map(i => (
                    <span key={i} className={`text-[10px] px-2.5 py-1 rounded-full border ${COLOR_MAP.violet.tag}`}>{i}</span>
                  ))}
                </div>
              </div>
              <div className="flex justify-center sm:col-span-1">
                <div className="w-full max-w-[200px]"><ContractMockup /></div>
              </div>
              <div className={`rounded-2xl border ${COLOR_MAP.cyan.border} bg-gradient-to-br ${COLOR_MAP.cyan.bg} p-6`}>
                <div className="w-9 h-9 rounded-xl bg-white/6 border border-white/10 flex items-center justify-center mb-3"><BarChart2 className="h-4 w-4 text-white/50" /></div>
                <div className={`text-xs font-bold ${COLOR_MAP.cyan.text} mb-1.5 tracking-widest uppercase`}>성장분석</div>
                <h3 className="text-base font-black mb-2 leading-snug">데이터로 성장 방향을</h3>
                <p className="text-xs text-white/38 leading-relaxed mb-4">재등록률, 유지율, 출석 패턴 분석.</p>
                <div className="flex flex-wrap gap-1.5">
                  {["재등록 분석", "유지율", "출석 패턴"].map(i => (
                    <span key={i} className={`text-[10px] px-2.5 py-1 rounded-full border ${COLOR_MAP.cyan.tag}`}>{i}</span>
                  ))}
                </div>
              </div>
            </div>

            {/* 성장분석 목업 + 작업실 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-center">
              <div className="flex justify-center lg:justify-start order-2 lg:order-1">
                <div className="w-full max-w-[220px]"><AnalyticsMockup /></div>
              </div>
              <div className={`order-1 lg:order-2 rounded-2xl border ${COLOR_MAP.amber.border} bg-gradient-to-br ${COLOR_MAP.amber.bg} p-7`}>
                <div className="w-9 h-9 rounded-xl bg-white/6 border border-white/10 flex items-center justify-center mb-4"><Sparkles className="h-4 w-4 text-white/50" /></div>
                <div className={`text-xs font-bold ${COLOR_MAP.amber.text} mb-2 tracking-widest uppercase`}>작업실</div>
                <h3 className="text-xl font-black mb-3 leading-snug">나만의 트레이너<br />브랜드를 만드세요</h3>
                <p className="text-sm text-white/40 leading-relaxed mb-5">개인 페이지, SNS 관리, 콘텐츠 제작으로 잠재 회원에게 나를 알립니다.</p>
                <div className="flex flex-wrap gap-2">
                  {["개인 브랜딩", "트레이너 페이지", "SNS 관리", "콘텐츠"].map(i => (
                    <span key={i} className={`text-xs px-3 py-1 rounded-full border ${COLOR_MAP.amber.tag}`}>{i}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FIT STEP+ ── */}
      <section className="py-24 px-5 bg-[#070b12] relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] rounded-full bg-blue-600/5 blur-[100px]" />
          <div className="absolute bottom-0 right-0 w-64 h-64 rounded-full bg-violet-600/5 blur-[80px]" />
        </div>
        <div className="relative max-w-5xl mx-auto">
          <div className="flex justify-center mb-6">
            <div className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-gradient-to-r from-blue-600/25 to-violet-600/15 border border-blue-500/30 text-xs font-bold text-blue-300 tracking-widest uppercase">
              <span>✦</span> FIT STEP+
            </div>
          </div>
          <h2 className="text-center text-[2rem] sm:text-[2.3rem] font-black leading-tight tracking-tight mb-4">
            회원에게 제공하는<br />
            <span className="text-blue-400">나만의 프리미엄 관리 페이지</span>
          </h2>
          <p className="text-center text-white/38 text-sm leading-relaxed mb-6 max-w-lg mx-auto">
            트레이너가 회원별로 운동 프로그램, 맞춤 영상, 식단 설계, 활동 데이터를 제공하는 개인 관리 페이지입니다.
          </p>
          <div className="flex justify-center mb-14">
            <span className="inline-block text-sm font-semibold text-blue-300/80 bg-blue-500/10 border border-blue-500/20 rounded-full px-6 py-2.5">
              "회원에게 단순 기록이 아닌, 관리받고 있다는 경험을 제공하세요."
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
            {/* 목업 */}
            <div className="flex justify-center lg:sticky lg:top-24">
              <div className="w-full max-w-[240px]">
                <PlusMockup />
              </div>
            </div>
            {/* 카드들 */}
            <div className="space-y-3">
              {PLUS_CARDS.map(f => (
                <GlowCard key={f.title} className="p-5">
                  <div className="flex gap-4">
                    <div className="shrink-0 mt-0.5 w-9 h-9 rounded-xl bg-white/6 border border-white/10 flex items-center justify-center">
                      <f.icon className="h-4 w-4 text-white/50" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm mb-2 text-white/85">{f.title}</h3>
                      <ul className="space-y-1">
                        {f.items.map(it => (
                          <li key={it} className="flex items-center gap-1.5 text-xs text-white/38">
                            <span className="text-blue-400/50 shrink-0">·</span>{it}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </GlowCard>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── PHILOSOPHY ── */}
      <section className="py-24 px-5">
        <div className="max-w-4xl mx-auto">
          <SectionLabel text="Brand Philosophy" />
          <h2 className="text-center text-[2rem] sm:text-[2.3rem] font-black leading-tight tracking-tight mb-4">현장을 아는 사람이<br />만든 플랫폼</h2>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start mt-14">
            {/* 본문 */}
            <div className="space-y-5">
              <div className="bg-gradient-to-br from-blue-600/10 to-violet-600/5 border border-blue-500/18 rounded-2xl p-7">
                <div className="space-y-4 text-sm text-white/50 leading-loose">
                  <p>
                    <span className="text-white/80 font-semibold">14년간 트레이너로 현장을 경험하며</span><br />
                    회원관리, 재등록, 운영 시스템의 한계를 직접 경험했습니다.
                  </p>
                  <p>
                    FIT STEP은<br />
                    <span className="text-white/75 font-semibold">연 1억 5천 매출 운영 경험</span>과<br />
                    <span className="text-white/75 font-semibold">자세체형교정 석사 및 의학박사 과정</span>의 전문성을 바탕으로,<br />
                    트레이너와 강사가 더 오래, 더 체계적으로 성장할 수 있도록 만들었습니다.
                  </p>
                  <p className="text-blue-300/70 font-medium">
                    "혼자 버티는 업계가 아니라,<br />
                    함께 성장하는 업계를 만들고자 합니다."
                  </p>
                </div>
              </div>
            </div>
            {/* 문화 */}
            <div className="space-y-3">
              {CULTURES.map(c => (
                <div key={c.n} className="flex gap-5 rounded-2xl border border-white/6 bg-white/[0.025] hover:border-blue-500/22 hover:bg-blue-500/[0.03] transition-all duration-300 p-5">
                  <span className="text-3xl font-black shrink-0 leading-none" style={{ background: "linear-gradient(180deg, rgba(96,165,250,0.5) 0%, rgba(96,165,250,0.1) 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>{c.n}</span>
                  <div className="pt-0.5">
                    <h3 className="font-bold text-[14px] mb-1.5 text-white/85">{c.t}</h3>
                    <p className="text-xs text-white/35 leading-relaxed">{c.d}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-28 px-5 bg-[#070b12] relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[700px] h-56 bg-blue-600/7 blur-[80px]" />
        </div>
        <div className="relative max-w-xl mx-auto text-center">
          <div className="text-[11px] font-bold tracking-widest text-blue-400/60 uppercase mb-8">지금 시작하세요</div>
          <h2 className="text-3xl sm:text-4xl font-black leading-tight tracking-tight mb-5">
            혼자 버티는 운영이 아닌,<br />
            <span className="text-blue-400">함께 성장하는 시스템</span>을<br />
            시작하세요.
          </h2>
          <p className="text-white/32 text-sm leading-relaxed mb-10">
            더 체계적인 트레이너가 늘어나고,<br />
            더 건강한 운영 문화가 자리 잡는 것이 우리의 목표입니다.
          </p>
          <a href="/auth/kakao"
            className="inline-flex items-center gap-2.5 px-10 py-4 rounded-xl bg-blue-500 hover:bg-blue-400 transition-all font-bold text-base shadow-2xl shadow-blue-500/30 hover:shadow-blue-500/50 hover:-translate-y-0.5">
            무료로 시작하기
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8H13M13 8L9 4M13 8L9 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </a>
          <p className="mt-4 text-xs text-white/16">신용카드 불필요 · 바로 사용 가능</p>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-white/5 py-10 px-5">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="font-black text-base tracking-tight">FIT <span className="text-blue-400">STEP</span></span>
          <div className="flex items-center gap-5 text-xs text-white/22">
            <button onClick={() => setLocation("/privacy")} className="hover:text-white/50 transition-colors">개인정보처리방침</button>
            <span>·</span>
            <span>피트니스 업계의 운영 문화를 만들다.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
