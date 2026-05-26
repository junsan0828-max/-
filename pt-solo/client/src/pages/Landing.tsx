import { useLocation } from "wouter";

// ── 수정 가능한 콘텐츠 ──────────────────────────────────────────────────────────

const BRAND = {
  name: "FIT STEP",
  tagline: "피트니스 업계의 운영 문화를 만들다.",
  subTagline: "단순한 회원관리 앱이 아닙니다.\n트레이너와 강사가 더 오래, 더 전문적으로 성장할 수 있도록 돕는 운영 문화 플랫폼입니다.",
  ctaPrimary: "무료로 시작하기",
  ctaSecondary: "로그인",
};

const PROBLEMS = [
  { icon: "📋", text: "체계적인 운영 문화의 부족" },
  { icon: "🌱", text: "초보 트레이너 · 강사의 성장 환경 부족" },
  { icon: "⚡", text: "경험에만 의존하는 반복적인 운영 스트레스" },
  { icon: "🏠", text: "혼자 버텨야 하는 1인 센터 대표의 현실" },
];

const FEATURES = [
  {
    icon: "👥",
    title: "회원 관리",
    desc: "회원 정보, 계약, PAR-Q 건강설문, 재등록 현황까지 한 곳에서 관리합니다.",
  },
  {
    icon: "📅",
    title: "출석 & 컨디션 체크",
    desc: "수업 전 컨디션 · 수면 · 식단 · 통증 부위를 기록하고 회원의 변화를 추적합니다.",
  },
  {
    icon: "🎯",
    title: "수업 관리",
    desc: "PT 패키지 등록부터 세션 차감, 잔여 횟수 알림까지 자동으로 처리합니다.",
  },
  {
    icon: "📊",
    title: "운영 대시보드",
    desc: "오늘 수업 현황, 재등록 임박 회원, 미출석 알림을 한눈에 확인합니다.",
  },
  {
    icon: "📝",
    title: "트레이닝 일지",
    desc: "수업별 운동 기록과 메모를 남겨 회원 맞춤 프로그램을 체계적으로 관리합니다.",
  },
  {
    icon: "🔗",
    title: "회원 전용 앱 (FIT STEP+)",
    desc: "트레이너 전용 회원앱으로 운동영상, 이벤트, 멤버십 혜택을 제공합니다.",
  },
  {
    icon: "📢",
    title: "공지 & 배너",
    desc: "탭별 맞춤 배너와 공지로 회원에게 중요한 정보를 빠르게 전달합니다.",
  },
  {
    icon: "💰",
    title: "정산 관리",
    desc: "프리랜서 트레이너의 수업료 정산을 자동으로 계산하고 내역을 관리합니다.",
  },
];

const CULTURES = [
  {
    number: "01",
    title: "기록하는 문화",
    desc: "감각과 경험만이 아닌, 회원의 변화와 수업의 흐름을 데이터로 기록하고 분석합니다.",
  },
  {
    number: "02",
    title: "책임지는 문화",
    desc: "회원의 몸과 건강을 다루는 직업인 만큼, 더 높은 전문성과 책임감을 갖습니다.",
  },
  {
    number: "03",
    title: "함께 성장하는 문화",
    desc: "트레이너와 강사가 경쟁 이전에 같은 업계를 성장시키는 파트너입니다.",
  },
  {
    number: "04",
    title: "지속 가능한 운영 문화",
    desc: "회원 관리, 재등록 자동화, 데이터 기반 시스템으로 오래 살아남는 구조를 만듭니다.",
  },
];

const TARGETS = [
  { icon: "💪", label: "개인 트레이너 (PT)" },
  { icon: "🧘", label: "필라테스 강사" },
  { icon: "🏋️", label: "1인 센터 대표" },
  { icon: "👤", label: "프리랜서 트레이너" },
];

// ── 컴포넌트 ────────────────────────────────────────────────────────────────────

export default function Landing() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white font-sans">

      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0a0a0f]/90 backdrop-blur border-b border-white/5">
        <div className="max-w-5xl mx-auto px-5 h-14 flex items-center justify-between">
          <span className="font-black text-lg tracking-tight">
            FIT <span className="text-blue-400">STEP</span>
          </span>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setLocation("/login")}
              className="text-sm text-white/60 hover:text-white transition-colors"
            >
              {BRAND.ctaSecondary}
            </button>
            <button
              onClick={() => setLocation("/register")}
              className="text-sm px-4 py-1.5 rounded-full bg-blue-500 hover:bg-blue-400 transition-colors font-medium"
            >
              {BRAND.ctaPrimary}
            </button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-24 px-5 text-center">
        <div className="max-w-3xl mx-auto">
          <div className="inline-block text-xs font-semibold tracking-widest text-blue-400 bg-blue-400/10 border border-blue-400/20 rounded-full px-4 py-1.5 mb-8">
            피트니스 운영 문화 플랫폼
          </div>
          <h1 className="text-4xl sm:text-5xl font-black leading-tight mb-6 tracking-tight">
            {BRAND.tagline}
          </h1>
          <p className="text-base sm:text-lg text-white/50 leading-relaxed whitespace-pre-line mb-10">
            {BRAND.subTagline}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => setLocation("/register")}
              className="px-8 py-3.5 rounded-xl bg-blue-500 hover:bg-blue-400 transition-colors font-bold text-base"
            >
              {BRAND.ctaPrimary}
            </button>
            <button
              onClick={() => setLocation("/login")}
              className="px-8 py-3.5 rounded-xl border border-white/15 hover:border-white/30 transition-colors font-medium text-base text-white/70 hover:text-white"
            >
              {BRAND.ctaSecondary}
            </button>
          </div>
        </div>
      </section>

      {/* Problem */}
      <section className="py-20 px-5 bg-[#0f0f1a]">
        <div className="max-w-3xl mx-auto">
          <p className="text-center text-xs font-semibold tracking-widest text-white/30 mb-4 uppercase">Problem</p>
          <h2 className="text-2xl sm:text-3xl font-black text-center mb-4">
            피트니스 업계의 현실
          </h2>
          <p className="text-center text-white/40 text-sm mb-12">
            좋은 의도를 가진 사람들이 오래 버티기 어려운 구조가 있습니다.
          </p>
          <div className="grid grid-cols-2 gap-4">
            {PROBLEMS.map((p) => (
              <div key={p.text} className="bg-white/4 border border-white/8 rounded-2xl p-5 flex items-start gap-3">
                <span className="text-2xl">{p.icon}</span>
                <p className="text-sm text-white/70 leading-snug">{p.text}</p>
              </div>
            ))}
          </div>
          <p className="text-center mt-10 text-white/40 text-sm">
            핏스텝은 <span className="text-white/70 font-semibold">"혼자 살아남는 업계"</span>가 아니라<br />
            <span className="text-blue-400 font-semibold">"함께 성장하는 업계"</span>를 만들기 위해 시작되었습니다.
          </p>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-5">
        <div className="max-w-3xl mx-auto">
          <p className="text-center text-xs font-semibold tracking-widest text-white/30 mb-4 uppercase">Features</p>
          <h2 className="text-2xl sm:text-3xl font-black text-center mb-4">
            현장에서 필요한 기능만
          </h2>
          <p className="text-center text-white/40 text-sm mb-12">
            운영의 반복을 줄이고, 수업과 회원에 집중할 수 있는 구조를 제공합니다.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {FEATURES.map((f) => (
              <div key={f.title} className="bg-white/3 border border-white/8 rounded-2xl p-5 hover:border-blue-500/30 transition-colors">
                <div className="text-2xl mb-3">{f.icon}</div>
                <h3 className="font-bold mb-1.5 text-sm">{f.title}</h3>
                <p className="text-xs text-white/45 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Culture */}
      <section className="py-20 px-5 bg-[#0f0f1a]">
        <div className="max-w-3xl mx-auto">
          <p className="text-center text-xs font-semibold tracking-widest text-white/30 mb-4 uppercase">Culture</p>
          <h2 className="text-2xl sm:text-3xl font-black text-center mb-4">
            우리가 만들고자 하는 문화
          </h2>
          <p className="text-center text-white/40 text-sm mb-12">
            기능 이전에, 업계의 문화를 바꾸는 것이 핏스텝의 목표입니다.
          </p>
          <div className="space-y-4">
            {CULTURES.map((c) => (
              <div key={c.number} className="flex gap-5 bg-white/3 border border-white/8 rounded-2xl p-6">
                <span className="text-3xl font-black text-blue-500/30 shrink-0 leading-none">{c.number}</span>
                <div>
                  <h3 className="font-bold mb-1">{c.title}</h3>
                  <p className="text-sm text-white/45 leading-relaxed">{c.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Target */}
      <section className="py-20 px-5">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-xs font-semibold tracking-widest text-white/30 mb-4 uppercase">For Who</p>
          <h2 className="text-2xl sm:text-3xl font-black mb-4">
            이런 분들을 위해 만들었습니다
          </h2>
          <div className="flex flex-wrap justify-center gap-3 mt-10">
            {TARGETS.map((t) => (
              <div key={t.label} className="flex items-center gap-2.5 px-5 py-3 rounded-full bg-white/4 border border-white/10 text-sm font-medium text-white/70">
                <span className="text-xl">{t.icon}</span>
                {t.label}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-5 bg-gradient-to-b from-[#0f0f1a] to-[#0a0a0f]">
        <div className="max-w-xl mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl font-black mb-4 leading-tight">
            지금 핏스텝으로<br />
            <span className="text-blue-400">더 오래, 더 체계적으로</span> 성장하세요.
          </h2>
          <p className="text-white/40 text-sm mb-10">
            더 체계적인 트레이너가 늘어나고,<br />
            더 건강한 운영 문화가 자리 잡는 것을 목표로 합니다.
          </p>
          <button
            onClick={() => setLocation("/register")}
            className="px-10 py-4 rounded-xl bg-blue-500 hover:bg-blue-400 transition-colors font-bold text-base"
          >
            {BRAND.ctaPrimary}
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-8 px-5 text-center text-xs text-white/20">
        <p className="font-black tracking-tight mb-2">FIT <span className="text-blue-400">STEP</span></p>
        <p>피트니스 업계의 운영 문화를 만들다.</p>
        <button
          onClick={() => setLocation("/privacy")}
          className="mt-3 underline hover:text-white/40 transition-colors"
        >
          개인정보처리방침
        </button>
      </footer>
    </div>
  );
}
