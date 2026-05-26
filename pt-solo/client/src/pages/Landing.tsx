import { useLocation } from "wouter";
import { useState, useEffect } from "react";

// ── 수정 가능한 콘텐츠 ─────────────────────────────────────────────────────────

const HERO = {
  badge: "피트니스 성장 플랫폼",
  headline: "트레이너의 성장과\n운영을 연결하다.",
  sub: "회원관리부터 상담, 건강리포트, 개인 브랜딩까지.\n트레이너와 강사를 위한 피트니스 성장 플랫폼.",
  cta1: "무료로 시작하기",
  cta2: "로그인",
};

const PROBLEMS = [
  { icon: "📋", title: "회원관리의 어려움", desc: "엑셀, 메모, 카카오톡으로 흩어진 회원 정보. 체계 없는 관리는 이탈로 이어집니다." },
  { icon: "🔄", title: "재등록 관리의 부재", desc: "언제 재등록이 끊기는지 모른 채 회원이 떠나고서야 알게 됩니다." },
  { icon: "📝", title: "기록 부족", desc: "기억에 의존하는 수업 관리. 회원의 변화를 추적하지 못하면 결과도 없습니다." },
  { icon: "🌐", title: "브랜딩 부족", desc: "실력이 있어도 보여줄 채널이 없습니다. 트레이너 개인 브랜드가 필요합니다." },
  { icon: "⚙️", title: "운영 시스템 부재", desc: "혼자 운영과 성장을 감당해야 하는 구조. 좋은 사람도 오래 버티기 어렵습니다." },
];

const CORE_FEATURES = [
  {
    key: "member",
    icon: "👥",
    label: "회원관리",
    color: "from-blue-600/20 to-blue-800/10",
    border: "border-blue-500/20",
    items: ["출석체크", "PT 관리", "건강리포트", "운동기록"],
    desc: "회원의 모든 정보를 한 곳에서 체계적으로 관리합니다.",
  },
  {
    key: "consult",
    icon: "💬",
    label: "상담실",
    color: "from-violet-600/20 to-violet-800/10",
    border: "border-violet-500/20",
    items: ["전자계약서", "상담일지", "재등록 관리", "상담 흐름 관리"],
    desc: "첫 상담부터 재등록까지, 상담의 전 과정을 관리합니다.",
  },
  {
    key: "analytics",
    icon: "📊",
    label: "성장분석",
    color: "from-cyan-600/20 to-cyan-800/10",
    border: "border-cyan-500/20",
    items: ["재등록 분석", "회원 유지율", "출석 패턴", "운영 데이터"],
    desc: "데이터로 내 운영의 약점을 파악하고 성장 방향을 찾습니다.",
  },
  {
    key: "studio",
    icon: "✨",
    label: "작업실",
    color: "from-amber-600/20 to-amber-800/10",
    border: "border-amber-500/20",
    items: ["개인 브랜딩", "트레이너 페이지", "SNS 관리", "콘텐츠 제작"],
    desc: "트레이너로서의 브랜드를 만들고 잠재 회원에게 나를 알립니다.",
  },
];

const PLUS_FEATURES = [
  {
    icon: "🗂",
    title: "개인 관리 페이지",
    items: ["회원별 전용 페이지 제공", "운동·식단·기록 통합 관리", "트레이너 맞춤 콘텐츠 제공"],
  },
  {
    icon: "🏋️",
    title: "맞춤 운동 프로그램",
    items: ["회원 목표에 따른 프로그램 구성", "회차별 운동 계획 제공", "수행 기록 확인"],
  },
  {
    icon: "🎬",
    title: "운동 영상 제공",
    items: ["트레이너 지정 운동 영상", "동작 설명 및 주의사항", "회원 혼자서도 복습 가능"],
  },
  {
    icon: "🥗",
    title: "맞춤 식단 설계",
    items: ["목표별 식단 방향 제공", "식사 기록 관리", "식단 피드백 기반 관리"],
  },
  {
    icon: "📈",
    title: "활동 데이터 확인",
    items: ["출석 기록", "운동 수행 기록", "변화 추적 및 관리 이력"],
  },
];

const CULTURES = [
  { number: "01", title: "기록하는 문화", desc: "감각과 경험만이 아닌, 회원의 변화와 수업의 흐름을 데이터로 기록하고 분석합니다." },
  { number: "02", title: "책임지는 문화", desc: "회원의 몸과 건강을 다루는 직업인 만큼, 더 높은 전문성과 책임감을 갖습니다." },
  { number: "03", title: "함께 성장하는 문화", desc: "트레이너와 강사가 경쟁 이전에 같은 업계를 성장시키는 파트너입니다." },
  { number: "04", title: "지속 가능한 운영 문화", desc: "재등록 자동화, 데이터 기반 시스템으로 오래 살아남는 구조를 만듭니다." },
];

// ── 서브 컴포넌트 ──────────────────────────────────────────────────────────────

function GlowCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`group relative rounded-2xl border border-white/8 bg-white/[0.03] hover:border-blue-500/30 hover:bg-blue-500/[0.04] transition-all duration-300 ${className}`}
      style={{ boxShadow: "0 0 0 0 rgba(59,130,246,0)" }}
      onMouseEnter={e => (e.currentTarget.style.boxShadow = "0 0 24px 0 rgba(59,130,246,0.08)")}
      onMouseLeave={e => (e.currentTarget.style.boxShadow = "0 0 0 0 rgba(59,130,246,0)")}>
      {children}
    </div>
  );
}

function SectionLabel({ children }: { children: string }) {
  return (
    <p className="text-center text-[11px] font-bold tracking-[0.2em] text-blue-400/70 uppercase mb-4">
      {children}
    </p>
  );
}

function SectionTitle({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <h2 className={`text-center text-2xl sm:text-[2rem] font-black leading-tight tracking-tight ${className}`}>
      {children}
    </h2>
  );
}

// 앱 UI 목업 (Hero 우측)
function AppMockup() {
  return (
    <div className="relative w-full max-w-xs mx-auto select-none pointer-events-none">
      {/* 메인 카드 */}
      <div className="relative z-10 bg-[#111827] border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
        {/* 헤더 */}
        <div className="bg-[#0d1117] px-4 py-3 flex items-center justify-between border-b border-white/6">
          <span className="text-xs font-black text-white tracking-tight">FIT <span className="text-blue-400">STEP</span></span>
          <div className="flex gap-1">
            <div className="w-5 h-5 rounded-full bg-blue-500/20 border border-blue-500/30" />
            <div className="w-5 h-5 rounded-full bg-white/5 border border-white/10" />
          </div>
        </div>
        {/* 대시보드 */}
        <div className="p-4 space-y-3">
          <div className="grid grid-cols-3 gap-2">
            {[["32", "총 회원"], ["8", "오늘 수업"], ["94%", "재등록률"]].map(([v, l]) => (
              <div key={l} className="bg-white/4 rounded-xl p-2.5 text-center">
                <div className="text-sm font-black text-white">{v}</div>
                <div className="text-[9px] text-white/40 mt-0.5">{l}</div>
              </div>
            ))}
          </div>
          <div className="bg-white/4 rounded-xl p-3 space-y-2">
            <div className="text-[10px] font-bold text-white/50">오늘 출석</div>
            {[["김민준", "✓ 출석", "blue"], ["이서연", "✓ 출석", "blue"], ["박지훈", "○ 예정", "white"]].map(([n, s, c]) => (
              <div key={n as string} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-[8px] text-white/60">{(n as string)[0]}</div>
                  <span className="text-[10px] text-white/70">{n as string}</span>
                </div>
                <span className={`text-[9px] font-semibold ${c === "blue" ? "text-blue-400" : "text-white/30"}`}>{s as string}</span>
              </div>
            ))}
          </div>
          <div className="bg-gradient-to-r from-blue-600/20 to-blue-500/10 border border-blue-500/20 rounded-xl p-3">
            <div className="text-[9px] text-blue-400/80 font-bold mb-1">⚡ 재등록 임박</div>
            <div className="text-[10px] text-white/70">최유진 — 3회 남음</div>
          </div>
        </div>
      </div>
      {/* 뒤쪽 플로팅 카드 */}
      <div className="absolute -right-6 -bottom-4 z-0 w-[80%] bg-[#0f1724] border border-blue-500/15 rounded-2xl p-3 shadow-xl">
        <div className="text-[9px] text-blue-400/70 font-bold mb-2">📊 월간 분석</div>
        <div className="flex items-end gap-1 h-10">
          {[40, 65, 55, 80, 70, 90, 75].map((h, i) => (
            <div key={i} className="flex-1 rounded-sm bg-blue-500/30" style={{ height: `${h}%` }} />
          ))}
        </div>
      </div>
      {/* 배경 glow */}
      <div className="absolute inset-0 -z-10 blur-3xl opacity-20 bg-gradient-to-br from-blue-600 to-violet-600 rounded-full scale-75" />
    </div>
  );
}

// ── 메인 컴포넌트 ──────────────────────────────────────────────────────────────

export default function Landing() {
  const [, setLocation] = useLocation();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="min-h-screen bg-[#060910] text-white overflow-x-hidden" style={{ fontFamily: "'Pretendard', 'Apple SD Gothic Neo', sans-serif" }}>

      {/* ── NAV ── */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? "bg-[#060910]/95 backdrop-blur-md border-b border-white/5 shadow-lg shadow-black/20" : ""}`}>
        <div className="max-w-5xl mx-auto px-5 h-15 flex items-center justify-between py-4">
          <span className="text-lg font-black tracking-tight">
            FIT <span className="text-blue-400">STEP</span>
          </span>
          <div className="flex items-center gap-2">
            <button onClick={() => setLocation("/login")}
              className="text-sm text-white/50 hover:text-white px-3 py-1.5 transition-colors">
              로그인
            </button>
            <button onClick={() => setLocation("/register")}
              className="text-sm font-semibold px-4 py-1.5 rounded-full bg-blue-500 hover:bg-blue-400 transition-colors shadow-lg shadow-blue-500/20">
              무료 시작
            </button>
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="relative min-h-screen flex flex-col items-center justify-center pt-20 pb-16 px-5 overflow-hidden">
        {/* 배경 그래픽 */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-blue-600/8 blur-[120px]" />
          <div className="absolute top-1/3 right-0 w-64 h-64 rounded-full bg-violet-600/6 blur-[80px]" />
          <svg className="absolute inset-0 w-full h-full opacity-[0.04]" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="grid" width="48" height="48" patternUnits="userSpaceOnUse">
                <path d="M 48 0 L 0 0 0 48" fill="none" stroke="white" strokeWidth="0.5"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
        </div>

        <div className="relative z-10 max-w-4xl mx-auto w-full">
          <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-16">
            {/* 텍스트 */}
            <div className="flex-1 text-center lg:text-left">
              <div className="inline-flex items-center gap-2 text-[11px] font-bold tracking-widest text-blue-400 bg-blue-400/10 border border-blue-400/20 rounded-full px-4 py-1.5 mb-8">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                {HERO.badge}
              </div>
              <h1 className="text-[2.6rem] sm:text-5xl font-black leading-[1.12] tracking-tight mb-6 whitespace-pre-line">
                {HERO.headline}
              </h1>
              <p className="text-base text-white/45 leading-relaxed whitespace-pre-line mb-10">
                {HERO.sub}
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start">
                <button onClick={() => setLocation("/register")}
                  className="px-7 py-3.5 rounded-xl bg-blue-500 hover:bg-blue-400 transition-all font-bold text-[15px] shadow-xl shadow-blue-500/25 hover:shadow-blue-500/40 hover:-translate-y-0.5">
                  {HERO.cta1}
                </button>
                <button onClick={() => setLocation("/login")}
                  className="px-7 py-3.5 rounded-xl border border-white/12 hover:border-white/25 bg-white/3 hover:bg-white/5 transition-all font-medium text-[15px] text-white/60 hover:text-white hover:-translate-y-0.5">
                  {HERO.cta2}
                </button>
              </div>
              <p className="mt-6 text-xs text-white/20">무료로 시작 · 신용카드 불필요</p>
            </div>
            {/* 목업 */}
            <div className="flex-shrink-0 w-full max-w-[280px] lg:max-w-[300px]">
              <AppMockup />
            </div>
          </div>
        </div>

        {/* 스크롤 힌트 */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5 opacity-30">
          <div className="w-px h-8 bg-gradient-to-b from-transparent to-white/50" />
          <p className="text-[10px] tracking-widest text-white/50 uppercase">Scroll</p>
        </div>
      </section>

      {/* ── WHY ── */}
      <section className="py-24 px-5 bg-[#070b12]">
        <div className="max-w-3xl mx-auto">
          <SectionLabel>Why FIT STEP</SectionLabel>
          <SectionTitle className="mb-4">왜 FIT STEP이<br />필요한가</SectionTitle>
          <p className="text-center text-white/35 text-sm leading-relaxed mb-14">
            좋은 트레이너는 많지만,<br />
            오래 살아남기 어려운 업계의 현실이 있습니다.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {PROBLEMS.map((p) => (
              <GlowCard key={p.title} className="p-5">
                <div className="flex items-start gap-4">
                  <div className="text-2xl shrink-0 mt-0.5">{p.icon}</div>
                  <div>
                    <h3 className="font-bold text-sm mb-1.5 text-white/90">{p.title}</h3>
                    <p className="text-xs text-white/38 leading-relaxed">{p.desc}</p>
                  </div>
                </div>
              </GlowCard>
            ))}
          </div>
          <div className="mt-12 text-center">
            <div className="inline-block bg-gradient-to-r from-blue-600/15 to-violet-600/10 border border-blue-500/20 rounded-2xl px-8 py-6">
              <p className="text-white/60 text-sm leading-loose">
                핏스텝은 <span className="text-white font-semibold">"혼자 살아남는 업계"</span>가 아니라<br />
                <span className="text-blue-400 font-bold">"함께 성장하는 업계"</span>를 만들기 위해 시작되었습니다.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── CORE FEATURES ── */}
      <section className="py-24 px-5">
        <div className="max-w-3xl mx-auto">
          <SectionLabel>Core Features</SectionLabel>
          <SectionTitle className="mb-4">현장에서 필요한<br />기능만 담았습니다</SectionTitle>
          <p className="text-center text-white/35 text-sm mb-14">
            운영의 반복을 줄이고, 수업과 회원에 온전히 집중할 수 있는 구조.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {CORE_FEATURES.map((f) => (
              <div key={f.key}
                className={`group relative rounded-2xl border ${f.border} bg-gradient-to-br ${f.color} p-6 hover:scale-[1.01] transition-all duration-300 cursor-default`}
                style={{ boxShadow: "0 0 0 0 rgba(59,130,246,0)" }}
                onMouseEnter={e => (e.currentTarget.style.boxShadow = "0 0 30px 0 rgba(59,130,246,0.07)")}
                onMouseLeave={e => (e.currentTarget.style.boxShadow = "0 0 0 0 rgba(59,130,246,0)")}>
                <div className="text-2xl mb-3">{f.icon}</div>
                <h3 className="font-black text-base mb-1.5">{f.label}</h3>
                <p className="text-xs text-white/45 leading-relaxed mb-4">{f.desc}</p>
                <div className="flex flex-wrap gap-1.5">
                  {f.items.map(item => (
                    <span key={item} className="text-[10px] px-2.5 py-1 rounded-full bg-white/8 text-white/55 border border-white/8">
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FIT STEP+ ── */}
      <section className="py-24 px-5 bg-[#070b12] relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-blue-600/6 blur-[100px]" />
        </div>
        <div className="relative max-w-3xl mx-auto">
          <div className="flex justify-center mb-6">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gradient-to-r from-blue-600/30 to-violet-600/20 border border-blue-500/30 text-xs font-bold text-blue-300 tracking-widest uppercase">
              <span className="text-blue-400">✦</span> FIT STEP+
            </div>
          </div>
          <SectionTitle className="mb-4">
            회원에게 제공하는<br />
            <span className="text-blue-400">나만의 프리미엄 관리 페이지</span>
          </SectionTitle>
          <p className="text-center text-white/40 text-sm leading-relaxed mb-5 max-w-xl mx-auto">
            FITSTEP+는 트레이너가 회원별로 운동 프로그램, 맞춤 영상, 식단 설계, 활동 데이터를 제공할 수 있는 개인 관리 페이지입니다.
          </p>
          <p className="text-center mb-14">
            <span className="inline-block text-sm font-semibold text-blue-300/80 bg-blue-500/10 border border-blue-500/20 rounded-full px-5 py-2">
              "회원에게 단순 기록이 아닌, 관리받고 있다는 경험을 제공하세요."
            </span>
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {PLUS_FEATURES.map((f) => (
              <GlowCard key={f.title} className="p-5">
                <div className="text-xl mb-3">{f.icon}</div>
                <h3 className="font-bold text-sm mb-3 text-white/90">{f.title}</h3>
                <ul className="space-y-1.5">
                  {f.items.map(item => (
                    <li key={item} className="flex items-start gap-2 text-xs text-white/40 leading-snug">
                      <span className="text-blue-400/60 mt-0.5 shrink-0">·</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </GlowCard>
            ))}
          </div>

          {/* Plus 배지 강조 */}
          <div className="mt-12 relative rounded-2xl overflow-hidden border border-blue-500/25 bg-gradient-to-br from-blue-600/15 via-violet-600/8 to-transparent p-8 text-center">
            <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-blue-500/10 blur-2xl" />
            <div className="relative">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-blue-500/20 border border-blue-500/30 text-2xl mb-4">✦</div>
              <h3 className="font-black text-lg mb-2">FIT STEP+</h3>
              <p className="text-white/40 text-sm leading-relaxed">
                트레이너 전용 회원앱으로 운동영상, 이벤트, 멤버십 혜택을 제공하고<br />
                회원과의 연결을 더 깊게 만드세요.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── BRAND PHILOSOPHY ── */}
      <section className="py-24 px-5">
        <div className="max-w-3xl mx-auto">
          <SectionLabel>Brand Philosophy</SectionLabel>
          <SectionTitle className="mb-4">피트니스 업계의<br />운영 문화를 만들다.</SectionTitle>
          <p className="text-center text-white/35 text-sm leading-relaxed mb-14">
            혼자 버티는 업계가 아니라,<br />
            함께 성장하는 업계를 만들고자 합니다.
          </p>
          <div className="space-y-3">
            {CULTURES.map((c, i) => (
              <div key={c.number}
                className="group flex gap-6 rounded-2xl border border-white/6 bg-white/[0.025] hover:border-blue-500/25 hover:bg-blue-500/[0.03] transition-all duration-300 p-5 sm:p-6">
                <div className="shrink-0">
                  <span className="text-4xl font-black bg-gradient-to-b from-blue-400/40 to-blue-400/10 bg-clip-text text-transparent">
                    {c.number}
                  </span>
                </div>
                <div className="pt-1">
                  <h3 className="font-bold text-[15px] mb-1.5 text-white/90">{c.title}</h3>
                  <p className="text-sm text-white/38 leading-relaxed">{c.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-28 px-5 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-64 bg-blue-600/8 blur-[80px]" />
        </div>
        <div className="relative max-w-xl mx-auto text-center">
          <div className="inline-block text-[11px] font-bold tracking-widest text-blue-400/70 uppercase mb-8">
            지금 시작하세요
          </div>
          <h2 className="text-3xl sm:text-4xl font-black leading-tight tracking-tight mb-5">
            혼자 버티는 운영이 아닌,<br />
            <span className="text-blue-400">함께 성장하는 시스템</span>을<br />
            시작하세요.
          </h2>
          <p className="text-white/35 text-sm leading-relaxed mb-10">
            더 체계적인 트레이너가 늘어나고,<br />
            더 건강한 운영 문화가 자리 잡는 것이 우리의 목표입니다.
          </p>
          <button onClick={() => setLocation("/register")}
            className="inline-flex items-center gap-2 px-10 py-4 rounded-xl bg-blue-500 hover:bg-blue-400 transition-all font-bold text-base shadow-2xl shadow-blue-500/30 hover:shadow-blue-500/50 hover:-translate-y-0.5">
            무료로 시작하기
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8H13M13 8L9 4M13 8L9 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
          <p className="mt-4 text-xs text-white/18">신용카드 불필요 · 바로 사용 가능</p>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-white/5 py-10 px-5">
        <div className="max-w-3xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="font-black text-base tracking-tight">
            FIT <span className="text-blue-400">STEP</span>
          </span>
          <div className="flex items-center gap-5 text-xs text-white/25">
            <button onClick={() => setLocation("/privacy")} className="hover:text-white/50 transition-colors">개인정보처리방침</button>
            <span>·</span>
            <span>피트니스 업계의 운영 문화를 만들다.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
