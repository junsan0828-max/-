import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";

// ─── 연락처 설정 (변경 시 여기만 수정) ───────────────────────────────────────
const NAVER_PLACE_URL = "https://booking.naver.com/booking/13/bizes/YOUR_ID"; // 네이버 플레이스 예약 URL
const KAKAO_CHANNEL_URL = "https://pf.kakao.com/_YOUR_ID"; // 카카오 채널 URL
const PHONE_NUMBER = "010-0000-0000"; // 전화번호

// ─── Scroll helper ─────────────────────────────────────────────────────────────
function scrollTo(id: string) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: "smooth" });
}

// ─── Nav ───────────────────────────────────────────────────────────────────────
function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const navLinks = [
    { label: "HOME", id: "hero" },
    { label: "헬스권 & 개인 맞춤 PT", id: "gym-pricing" },
    { label: "짐플러스", id: "gymplus" },
    { label: "회원후기", id: "reviews" },
    { label: "오시는길", id: "location" },
  ];

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? "bg-white shadow-md" : "bg-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <button
            onClick={() => scrollTo("hero")}
            className={`text-xl font-black tracking-tight ${
              scrolled ? "text-[#0B1D3A]" : "text-white"
            }`}
          >
            ZIANTGYM+
          </button>

          {/* Desktop Nav */}
          <nav className="hidden lg:flex items-center gap-6">
            {navLinks.map((link) => (
              <button
                key={link.id}
                onClick={() => scrollTo(link.id)}
                className={`text-sm font-medium transition-colors ${
                  scrolled
                    ? "text-gray-700 hover:text-[#0B1D3A]"
                    : "text-white/80 hover:text-white"
                }`}
              >
                {link.label}
              </button>
            ))}
            <a
              href={NAVER_PLACE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-[#03C75A] text-white text-sm font-semibold rounded-lg hover:bg-[#02b350] transition-colors"
            >
              상담신청
            </a>
          </nav>

          {/* Mobile Hamburger */}
          <button
            className="lg:hidden p-2"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            <div className={`w-6 h-0.5 mb-1.5 transition-all ${scrolled ? "bg-gray-800" : "bg-white"}`} />
            <div className={`w-6 h-0.5 mb-1.5 transition-all ${scrolled ? "bg-gray-800" : "bg-white"}`} />
            <div className={`w-6 h-0.5 transition-all ${scrolled ? "bg-gray-800" : "bg-white"}`} />
          </button>
        </div>

        {/* Mobile Menu */}
        {menuOpen && (
          <div className="lg:hidden bg-white shadow-lg rounded-b-xl px-4 py-4 flex flex-col gap-3">
            {navLinks.map((link) => (
              <button
                key={link.id}
                onClick={() => { scrollTo(link.id); setMenuOpen(false); }}
                className="text-left text-sm font-medium text-gray-700 hover:text-[#0B1D3A] py-1"
              >
                {link.label}
              </button>
            ))}
            <a
              href={NAVER_PLACE_URL}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setMenuOpen(false)}
              className="mt-2 px-4 py-2.5 bg-[#03C75A] text-white text-sm font-semibold rounded-lg text-center"
            >
              상담신청 (네이버 예약)
            </a>
          </div>
        )}
      </div>
    </header>
  );
}

// ─── Section 1: Hero ──────────────────────────────────────────────────────────
function HeroSection() {
  const badges = ["체형분석", "자세교정", "다이어트", "통증관리", "개인 맞춤 운동"];

  return (
    <section
      id="hero"
      className="relative min-h-screen flex flex-col items-center justify-center bg-[#0B1D3A] overflow-hidden"
    >
      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#0B1D3A] via-[#112644] to-[#0a1628] pointer-events-none" />
      {/* Subtle grid pattern */}
      <div
        className="absolute inset-0 opacity-5 pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 text-center">
        <p className="text-blue-400 text-sm font-semibold tracking-widest uppercase mb-4">
          정왕동 맞춤운동센터
        </p>
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white leading-tight mb-6">
          운동은 많이 하는 것이 아니라
          <br />
          <span className="text-blue-300">내 몸에 맞게 하는 것이 중요합니다.</span>
        </h1>
        <p className="text-lg sm:text-xl text-white/70 font-light mb-10 leading-relaxed">
          체형 분석부터 운동 방향 설정까지
          <br />
          정왕동 맞춤운동센터 자이언트짐
        </p>

        {/* Check badges */}
        <div className="flex flex-wrap justify-center gap-3 mb-10">
          {badges.map((b) => (
            <span
              key={b}
              className="inline-flex items-center gap-1.5 bg-white/10 text-white text-sm px-3 py-1.5 rounded-full border border-white/20"
            >
              <span className="text-blue-300">✔</span> {b}
            </span>
          ))}
        </div>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row justify-center gap-4">
          <button
            onClick={() => scrollTo("contact")}
            className="px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-base transition-all shadow-lg shadow-blue-900/40 hover:scale-105"
          >
            무료 체형분석 예약하기
          </button>
          <button
            onClick={() => scrollTo("gym-pricing")}
            className="px-8 py-4 border-2 border-white text-white hover:bg-white/10 font-bold rounded-xl text-base transition-all hover:scale-105"
          >
            회원권 알아보기
          </button>
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 text-white/40">
        <span className="text-xs">SCROLL</span>
        <div className="w-px h-8 bg-white/30 animate-pulse" />
      </div>
    </section>
  );
}

// ─── Section 2: 어떤 운동을 찾고 계신가요? ────────────────────────────────────
function WorkoutTypeSection() {
  return (
    <section className="py-20 bg-white">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-black text-[#0B1D3A] mb-3">
            어떤 운동을 찾고 계신가요?
          </h2>
          <p className="text-gray-500 font-light">목적에 맞는 운동 방법을 안내해드립니다</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* 헬스 이용권 */}
          <div className="border border-gray-100 rounded-2xl p-8 shadow-sm hover:shadow-md transition-shadow">
            <div className="w-12 h-12 bg-[#0B1D3A]/10 rounded-xl flex items-center justify-center text-2xl mb-5">
              🏋️
            </div>
            <h3 className="text-2xl font-bold text-[#0B1D3A] mb-3">헬스 이용권</h3>
            <p className="text-gray-500 font-light text-sm mb-5">스스로 운동하고 싶은 분들을 위한 헬스장 이용권</p>
            <div className="grid grid-cols-2 gap-2 mb-6">
              {["혼자 운동", "건강관리", "체중감량", "운동습관"].map((tag) => (
                <span key={tag} className="flex items-center gap-1.5 text-sm text-gray-600">
                  <span className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
                  {tag}
                </span>
              ))}
            </div>
            <button
              onClick={() => scrollTo("gym-pricing")}
              className="w-full py-3 bg-[#0B1D3A] text-white font-semibold rounded-xl hover:bg-[#162d5a] transition-colors"
            >
              헬스 이용권 보기
            </button>
          </div>

          {/* 개인 맞춤 PT */}
          <div className="border border-blue-100 rounded-2xl p-8 shadow-sm hover:shadow-md transition-shadow bg-gradient-to-br from-blue-50/50 to-white">
            <div className="w-12 h-12 bg-blue-600/10 rounded-xl flex items-center justify-center text-2xl mb-5">
              🎯
            </div>
            <h3 className="text-2xl font-bold text-[#0B1D3A] mb-3">개인 맞춤 PT</h3>
            <p className="text-gray-500 font-light text-sm mb-5">체형, 목적, 통증에 맞춘 1:1 맞춤 트레이닝</p>
            <div className="grid grid-cols-2 gap-2 mb-6">
              {["체형교정", "통증관리", "다이어트", "근력향상", "운동초보"].map((tag) => (
                <span key={tag} className="flex items-center gap-1.5 text-sm text-gray-600">
                  <span className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
                  {tag}
                </span>
              ))}
            </div>
            <button
              onClick={() => scrollTo("pt-pricing")}
              className="w-full py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors"
            >
              개인 맞춤 PT 보기
            </button>
          </div>
        </div>

        <p className="text-center text-sm text-gray-400 mt-6 font-light">
          두 버튼 모두 최종적으로 무료 체형분석 및 상담 예약으로 연결됩니다
        </p>
      </div>
    </section>
  );
}

// ─── Section 3: 왜 체형분석부터 해야 할까요? ─────────────────────────────────
function WhyBodyAnalysisSection() {
  const steps = [
    "예약 신청",
    "센터 방문",
    "체형분석",
    "운동 상담",
    "운동 방향 설정",
    "헬스 또는 PT 선택",
  ];

  return (
    <section className="py-20 bg-[#0B1D3A]">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-black text-white mb-6">
            왜 체형분석부터 해야 할까요?
          </h2>
          <p className="text-white/70 font-light leading-relaxed max-w-2xl mx-auto text-base sm:text-lg">
            사람마다 체형, 움직임, 근력, 통증, 생활습관, 운동목적이 모두 다릅니다.
            <br className="hidden sm:block" />
            운동을 시작하기 전 현재 몸 상태를 확인하고 나에게 맞는 운동 방향을 설정하는 것이 중요합니다.
          </p>
        </div>

        {/* Process flow */}
        <div className="relative mb-12">
          {/* Desktop: horizontal */}
          <div className="hidden md:flex items-center justify-between gap-2">
            {steps.map((step, i) => (
              <div key={step} className="flex items-center gap-2 flex-1">
                <div className="flex flex-col items-center text-center flex-1">
                  <div className="w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold mb-2 shadow-lg shadow-blue-900/50">
                    {i + 1}
                  </div>
                  <span className="text-white/90 text-xs font-medium">{step}</span>
                </div>
                {i < steps.length - 1 && (
                  <div className="w-6 h-px bg-white/30 flex-shrink-0" />
                )}
              </div>
            ))}
          </div>

          {/* Mobile: vertical */}
          <div className="md:hidden flex flex-col gap-0">
            {steps.map((step, i) => (
              <div key={step} className="flex items-start gap-4">
                <div className="flex flex-col items-center">
                  <div className="w-9 h-9 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold shadow-lg shadow-blue-900/50 flex-shrink-0">
                    {i + 1}
                  </div>
                  {i < steps.length - 1 && (
                    <div className="w-px h-8 bg-white/20 mt-1" />
                  )}
                </div>
                <span className="text-white/90 text-sm font-medium pt-2">{step}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="text-center">
          <button
            onClick={() => scrollTo("contact")}
            className="px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-base transition-all shadow-lg hover:scale-105"
          >
            무료 체형분석 예약
          </button>
        </div>
      </div>
    </section>
  );
}

// ─── Section 4: 헬스 이용권 ───────────────────────────────────────────────────
function GymPricingSection() {
  const plans = [
    { period: "1개월", price: "80,000원" },
    { period: "3개월", price: "159,000원" },
    { period: "6개월", price: "216,000원" },
    { period: "12개월", price: "312,000원" },
  ];
  const targets = ["운동 초보", "혼자 운동 가능한 회원", "건강관리 목적", "체중감량 목적"];
  const includes = ["헬스장 이용", "체성분 측정", "운동 상담"];

  return (
    <section id="gym-pricing" className="py-20 bg-white">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-10">
          <p className="text-blue-600 text-sm font-semibold tracking-widest uppercase mb-2">MEMBERSHIP</p>
          <h2 className="text-3xl sm:text-4xl font-black text-[#0B1D3A] mb-4">헬스 이용권</h2>
          <div className="flex flex-wrap justify-center gap-2 mb-6">
            {targets.map((t) => (
              <span key={t} className="text-sm bg-gray-100 text-gray-600 px-3 py-1 rounded-full">
                #{t}
              </span>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {plans.map((plan, i) => (
            <div
              key={plan.period}
              className={`rounded-2xl p-6 text-center border-2 transition-all hover:scale-105 ${
                i === 3
                  ? "border-[#0B1D3A] bg-[#0B1D3A] text-white shadow-xl"
                  : "border-gray-100 bg-white text-[#0B1D3A] shadow-sm hover:border-blue-200"
              }`}
            >
              <p className={`text-sm font-semibold mb-2 ${i === 3 ? "text-blue-300" : "text-gray-500"}`}>
                {plan.period}
              </p>
              <p className={`text-xl font-black ${i === 3 ? "text-white" : "text-[#0B1D3A]"}`}>
                {plan.price}
              </p>
              {i === 3 && (
                <span className="inline-block mt-2 text-xs bg-blue-600 text-white px-2 py-0.5 rounded-full">
                  추천
                </span>
              )}
            </div>
          ))}
        </div>

        <div className="bg-gray-50 rounded-2xl p-6 mb-8 flex flex-wrap justify-center gap-6">
          {includes.map((item) => (
            <span key={item} className="flex items-center gap-2 text-sm text-gray-700">
              <span className="text-blue-500 font-bold">✓</span> {item}
            </span>
          ))}
        </div>

        <div className="text-center">
          <button
            onClick={() => scrollTo("contact")}
            className="px-8 py-4 bg-[#0B1D3A] hover:bg-[#162d5a] text-white font-bold rounded-xl text-base transition-all hover:scale-105"
          >
            무료 체형분석 예약
          </button>
        </div>
      </div>
    </section>
  );
}

// ─── Section 5: 개인 맞춤 PT ──────────────────────────────────────────────────
function PtPricingSection() {
  const targets = ["허리통증", "목·어깨통증", "체형교정", "다이어트", "근력향상", "운동초보"];
  const steps = [
    "체형평가",
    "움직임평가",
    "목표설정",
    "맞춤프로그램설계",
    "운동진행",
    "재평가",
  ];

  return (
    <section id="pt-pricing" className="py-20 bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-10">
          <p className="text-blue-600 text-sm font-semibold tracking-widest uppercase mb-2">PERSONAL TRAINING</p>
          <h2 className="text-3xl sm:text-4xl font-black text-[#0B1D3A] mb-4">개인 맞춤 PT</h2>
          <div className="flex flex-wrap justify-center gap-2 mb-6">
            {targets.map((t) => (
              <span key={t} className="text-sm bg-white text-gray-600 px-3 py-1 rounded-full border border-gray-200">
                {t}
              </span>
            ))}
          </div>
        </div>

        {/* Process */}
        <div className="bg-white rounded-2xl p-6 mb-8 shadow-sm">
          <p className="text-sm font-semibold text-gray-500 mb-4 text-center">PT 진행 프로세스</p>
          <div className="hidden md:flex items-center justify-between gap-2">
            {steps.map((step, i) => (
              <div key={step} className="flex items-center gap-2 flex-1">
                <div className="flex flex-col items-center flex-1 text-center">
                  <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold mb-1.5">
                    {i + 1}
                  </div>
                  <span className="text-xs text-gray-600 font-medium">{step}</span>
                </div>
                {i < steps.length - 1 && (
                  <div className="w-4 h-px bg-gray-200 flex-shrink-0" />
                )}
              </div>
            ))}
          </div>
          <div className="md:hidden flex flex-col gap-2">
            {steps.map((step, i) => (
              <div key={step} className="flex items-center gap-3">
                <div className="w-7 h-7 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">
                  {i + 1}
                </div>
                <span className="text-sm text-gray-700 font-medium">{step}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Pricing */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8 max-w-md mx-auto">
          {[
            { sessions: "10회", price: "500,000원" },
            { sessions: "20회", price: "960,000원" },
          ].map((plan) => (
            <div
              key={plan.sessions}
              className="bg-white rounded-2xl p-6 text-center border-2 border-gray-100 shadow-sm hover:border-blue-200 hover:scale-105 transition-all"
            >
              <p className="text-sm font-semibold text-gray-500 mb-1">{plan.sessions}</p>
              <p className="text-2xl font-black text-[#0B1D3A]">{plan.price}</p>
            </div>
          ))}
        </div>

        <div className="text-center">
          <button
            onClick={() => scrollTo("contact")}
            className="px-8 py-4 bg-[#0B1D3A] hover:bg-[#162d5a] text-white font-bold rounded-xl text-base transition-all hover:scale-105"
          >
            무료 체형분석 예약
          </button>
        </div>
      </div>
    </section>
  );
}

// ─── Section 6: 짐플러스 ──────────────────────────────────────────────────────
function GymPlusSection() {
  const features = [
    { icon: "📋", label: "운동 프로그램 확인" },
    { icon: "📊", label: "운동 기록 관리" },
    { icon: "🥗", label: "식단 기록 관리" },
    { icon: "🎬", label: "운동 영상 제공" },
    { icon: "📅", label: "예약 관리" },
    { icon: "📈", label: "변화 리포트 제공" },
  ];

  return (
    <section id="gymplus" className="py-20 bg-[#0B1D3A]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Left content */}
          <div>
            <p className="text-blue-400 text-sm font-semibold tracking-widest uppercase mb-3">GYM PLUS</p>
            <h2 className="text-3xl sm:text-4xl font-black text-white mb-4 leading-tight">
              운동은 센터 밖에서
              <br />결정됩니다.
            </h2>
            <p className="text-white/70 font-light mb-8 text-base">
              짐플러스는 회원 전용 운동 관리 서비스입니다.
            </p>
            <div className="grid grid-cols-2 gap-3">
              {features.map((f) => (
                <div key={f.label} className="flex items-center gap-3 bg-white/5 rounded-xl px-4 py-3 border border-white/10">
                  <span className="text-xl">{f.icon}</span>
                  <span className="text-white/90 text-sm font-medium">{f.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Phone mockup */}
          <div className="flex justify-center">
            <div className="w-64 h-[520px] bg-gray-900 rounded-[3rem] border-4 border-gray-700 shadow-2xl relative overflow-hidden">
              {/* Phone notch */}
              <div className="absolute top-3 left-1/2 -translate-x-1/2 w-24 h-6 bg-black rounded-full z-10" />
              {/* Phone screen */}
              <div className="absolute inset-0 bg-gradient-to-b from-[#0B1D3A] to-[#071228] flex flex-col pt-12">
                {/* Status bar */}
                <div className="flex items-center justify-between px-4 py-2">
                  <span className="text-white/60 text-xs">09:41</span>
                  <div className="flex gap-1">
                    <div className="w-4 h-2 bg-white/60 rounded-sm" />
                    <div className="w-1 h-2 bg-white/40 rounded-sm" />
                  </div>
                </div>
                {/* App header */}
                <div className="px-4 pt-4 pb-3 border-b border-white/10">
                  <p className="text-white font-black text-base tracking-tight">ZIANTGYM+</p>
                  <p className="text-white/50 text-xs mt-0.5">회원 전용 서비스</p>
                </div>
                {/* Mock content cards */}
                <div className="px-3 pt-4 flex flex-col gap-2">
                  <div className="bg-white/10 rounded-xl p-3">
                    <p className="text-white/50 text-xs mb-1">오늘의 운동</p>
                    <p className="text-white text-sm font-semibold">상체 근력 프로그램</p>
                  </div>
                  <div className="bg-blue-600/30 rounded-xl p-3 border border-blue-500/30">
                    <p className="text-blue-300 text-xs mb-1">체형분석 리포트</p>
                    <div className="flex gap-1 mt-1">
                      {[80, 65, 90, 75].map((v, i) => (
                        <div key={i} className="flex-1 bg-white/10 rounded-sm overflow-hidden h-8 flex items-end">
                          <div className="w-full bg-blue-500/60" style={{ height: `${v}%` }} />
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="bg-white/10 rounded-xl p-3">
                    <p className="text-white/50 text-xs mb-1">이번 주 식단</p>
                    <p className="text-white text-sm font-semibold">3일 기록 완료 ✓</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Section 7: 이벤트 ───────────────────────────────────────────────────────
function EventsSection() {
  const { data: events } = trpc.landing.getEvents.useQuery();

  const defaultEvents = [
    { id: -1, icon: "🎓", title: "학생 할인", description: "학생증 제시 시 10% 할인" },
    { id: -2, icon: "📝", title: "수험생 할인", description: "수험표 지참 시 1개월 무료 연장" },
    { id: -3, icon: "👫", title: "친구 추천 이벤트", description: "친구 추천 시 양쪽 1주일 연장" },
  ];

  const displayEvents = (events && events.length > 0)
    ? events
    : defaultEvents;

  return (
    <section id="events" className="py-20 bg-white">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-12">
          <p className="text-blue-600 text-sm font-semibold tracking-widest uppercase mb-2">EVENTS</p>
          <h2 className="text-3xl sm:text-4xl font-black text-[#0B1D3A]">현재 진행 중인 이벤트</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          {displayEvents.slice(0, 3).map((ev: any) => (
            <div
              key={ev.id}
              className="rounded-2xl border border-gray-100 p-6 shadow-sm hover:shadow-md transition-all hover:-translate-y-1"
            >
              <div className="text-3xl mb-3">{ev.icon}</div>
              <h3 className="text-lg font-bold text-[#0B1D3A] mb-2">{ev.title}</h3>
              <p className="text-gray-500 text-sm font-light mb-4">{ev.description}</p>
              <button
                onClick={() => scrollTo("contact")}
                className="text-blue-600 text-sm font-semibold hover:underline"
              >
                자세히 보기 →
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Section 8: 회원 후기 ─────────────────────────────────────────────────────
function ReviewsSection() {
  const { data: reviews } = trpc.landing.getReviews.useQuery();

  const defaultReviews = [
    {
      id: -1,
      reviewer: "이○○ (30대 직장인)",
      rating: 5,
      content: "허리 통증이 많이 좋아졌어요. 트레이너 분이 제 체형에 맞게 프로그램을 짜주셔서 효과가 정말 좋았습니다.",
    },
    {
      id: -2,
      reviewer: "김○○ (20대 학생)",
      rating: 5,
      content: "처음엔 혼자 운동하다가 PT로 전환했는데, 체형분석 결과가 너무 도움이 됐어요.",
    },
    {
      id: -3,
      reviewer: "박○○ (40대 주부)",
      rating: 5,
      content: "어깨 통증 때문에 시작했는데 3개월 만에 정말 많이 좋아졌습니다.",
    },
  ];

  const displayReviews = (reviews && reviews.length > 0) ? reviews : defaultReviews;

  return (
    <section id="reviews" className="py-20 bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-12">
          <p className="text-blue-600 text-sm font-semibold tracking-widest uppercase mb-2">REVIEWS</p>
          <h2 className="text-3xl sm:text-4xl font-black text-[#0B1D3A]">회원 후기</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          {displayReviews.slice(0, 3).map((review: any) => (
            <div key={review.id} className="bg-white rounded-2xl p-6 shadow-sm hover:shadow-md transition-all hover:-translate-y-1">
              <div className="flex gap-0.5 mb-3">
                {Array.from({ length: Math.min(5, review.rating || 5) }).map((_, i) => (
                  <span key={i} className="text-yellow-400 text-base">⭐</span>
                ))}
              </div>
              <p className="text-gray-700 text-sm font-light leading-relaxed mb-4">
                "{review.content}"
              </p>
              <p className="text-gray-500 text-xs font-semibold">{review.reviewer}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Section 9: Before & After ───────────────────────────────────────────────
function BeforeAfterSection() {
  const cases = [
    { name: "OOO 회원", duration: "3개월", goal: "체형교정" },
    { name: "OOO 회원", duration: "4개월", goal: "다이어트" },
    { name: "OOO 회원", duration: "6개월", goal: "통증관리" },
  ];

  return (
    <section className="py-20 bg-[#0B1D3A]">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-12">
          <p className="text-blue-400 text-sm font-semibold tracking-widest uppercase mb-2">TRANSFORMATION</p>
          <h2 className="text-3xl sm:text-4xl font-black text-white">회원 변화 사례</h2>
        </div>

        <div className="flex gap-5 overflow-x-auto pb-4 snap-x snap-mandatory">
          {cases.map((c, i) => (
            <div
              key={i}
              className="min-w-[280px] sm:min-w-0 sm:flex-1 bg-white/5 border border-white/10 rounded-2xl p-5 snap-start flex-shrink-0"
            >
              <div className="mb-3">
                <p className="text-white font-semibold">{c.name}</p>
                <p className="text-white/50 text-xs mt-0.5">기간: {c.duration} | 목표: {c.goal}</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {["BEFORE", "AFTER"].map((label) => (
                  <div
                    key={label}
                    className={`h-32 rounded-xl flex items-center justify-center text-xs font-bold ${
                      label === "BEFORE"
                        ? "bg-gradient-to-br from-gray-600 to-gray-700 text-gray-300"
                        : "bg-gradient-to-br from-blue-700 to-blue-900 text-blue-200"
                    }`}
                  >
                    {label}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <p className="text-center text-white/40 text-xs mt-6 font-light">
          * 개인차가 있을 수 있습니다. 실제 회원의 후기를 바탕으로 제작되었습니다.
        </p>
      </div>
    </section>
  );
}

// ─── Section 10: 시설 소개 ────────────────────────────────────────────────────
function FacilitySection() {
  const zones = ["웨이트존", "유산소존", "스트레칭존", "상담실", "샤워실"];
  const [activeZone, setActiveZone] = useState(zones[0]);

  const facilityFeatures = [
    { icon: "🚗", label: "주차 가능" },
    { icon: "🚿", label: "샤워시설" },
    { icon: "❄️", label: "냉난방" },
    { icon: "🔒", label: "보관함" },
    { icon: "🪑", label: "라커룸" },
    { icon: "🧴", label: "어메니티" },
  ];

  return (
    <section id="facility" className="py-20 bg-white">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-10">
          <p className="text-blue-600 text-sm font-semibold tracking-widest uppercase mb-2">FACILITY</p>
          <h2 className="text-3xl sm:text-4xl font-black text-[#0B1D3A]">시설 소개</h2>
        </div>

        {/* Zone Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-6 snap-x">
          {zones.map((zone) => (
            <button
              key={zone}
              onClick={() => setActiveZone(zone)}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all flex-shrink-0 ${
                activeZone === zone
                  ? "bg-[#0B1D3A] text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {zone}
            </button>
          ))}
        </div>

        {/* Zone image placeholder */}
        <div className="bg-gray-100 rounded-2xl h-64 flex items-center justify-center mb-8 overflow-hidden">
          <span className="text-gray-400 text-base font-medium">{activeZone} 사진</span>
        </div>

        {/* Facility features */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-4">
          {facilityFeatures.map((f) => (
            <div key={f.label} className="flex flex-col items-center gap-2 p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors">
              <span className="text-2xl">{f.icon}</span>
              <span className="text-xs text-gray-600 font-medium text-center">{f.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Section 11: 오시는 길 ────────────────────────────────────────────────────
function LocationSection() {
  return (
    <section id="location" className="py-20 bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-12">
          <p className="text-blue-600 text-sm font-semibold tracking-widest uppercase mb-2">LOCATION</p>
          <h2 className="text-3xl sm:text-4xl font-black text-[#0B1D3A]">오시는 길</h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Info boxes */}
          <div className="flex flex-col gap-4">
            <div className="bg-white rounded-2xl p-5 shadow-sm">
              <div className="flex items-start gap-3">
                <span className="text-xl flex-shrink-0">📍</span>
                <div>
                  <p className="font-semibold text-[#0B1D3A] mb-1">주소</p>
                  <p className="text-gray-600 text-sm font-light">경기도 시흥시 정왕동</p>
                  <a
                    href="https://map.naver.com/v5/search/자이언트짐"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 text-sm hover:underline mt-1 inline-block"
                  >
                    지도에서 보기 →
                  </a>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-5 shadow-sm">
              <div className="flex items-start gap-3">
                <span className="text-xl flex-shrink-0">🕐</span>
                <div>
                  <p className="font-semibold text-[#0B1D3A] mb-1">운영시간</p>
                  <p className="text-gray-600 text-sm font-light">평일 08:00 ~ 23:00</p>
                  <p className="text-gray-600 text-sm font-light">토요일 10:00 ~ 17:00</p>
                  <p className="text-gray-500 text-sm font-light">일요일 휴무</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-5 shadow-sm">
              <div className="flex items-start gap-3">
                <span className="text-xl flex-shrink-0">🚗</span>
                <div>
                  <p className="font-semibold text-[#0B1D3A] mb-1">주차</p>
                  <p className="text-gray-600 text-sm font-light">센터 내 주차 가능</p>
                  <p className="text-gray-500 text-xs font-light mt-0.5">방문 전 주차 안내 문의 요망</p>
                </div>
              </div>
            </div>
          </div>

          {/* Map placeholder */}
          <div className="bg-white rounded-2xl overflow-hidden shadow-sm min-h-[280px] flex flex-col">
            <a
              href="https://map.naver.com/v5/search/자이언트짐"
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 bg-gradient-to-br from-gray-100 to-gray-200 flex flex-col items-center justify-center gap-3 hover:from-blue-50 hover:to-blue-100 transition-colors group min-h-[240px]"
            >
              <span className="text-4xl">📍</span>
              <span className="text-gray-500 font-medium group-hover:text-blue-600 transition-colors">
                지도에서 보기
              </span>
              <span className="text-xs text-gray-400">네이버 지도 연결</span>
            </a>
            <div className="p-4 flex gap-3">
              <a
                href="tel:010-0000-0000"
                className="flex-1 py-2.5 bg-green-500 text-white text-sm font-semibold rounded-xl text-center hover:bg-green-600 transition-colors"
              >
                📞 전화 문의
              </a>
              <a
                href="#"
                className="flex-1 py-2.5 bg-yellow-400 text-gray-800 text-sm font-semibold rounded-xl text-center hover:bg-yellow-500 transition-colors"
              >
                💬 카카오 문의
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Section 12: Contact Form ─────────────────────────────────────────────────
function ContactSection() {
  return (
    <section id="contact" className="py-24 bg-[#0B1D3A]">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 text-center">
        <p className="text-blue-300 text-sm font-semibold tracking-widest uppercase mb-4">무료 상담 예약</p>
        <h2 className="text-3xl sm:text-4xl font-black text-white leading-tight mb-4">
          회원권 등록 전에
          <br />
          <span className="text-blue-300">내 몸 상태부터 확인해보세요.</span>
        </h2>
        <p className="text-white/60 font-light text-base mb-10">
          무료 체형분석 및 상담을 통해 운동 방향을 먼저 확인할 수 있습니다.
          <br />
          네이버 플레이스에서 간편하게 예약하세요.
        </p>

        {/* Primary CTA — Naver Place */}
        <a
          href={NAVER_PLACE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-3 w-full sm:w-auto sm:px-16 py-5 bg-[#03C75A] hover:bg-[#02b350] text-white font-black text-lg rounded-2xl transition-all hover:scale-[1.02] shadow-lg shadow-green-900/30 mb-4"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 flex-shrink-0">
            <path d="M16.273 12.845 7.376 0H0v24h7.727V11.155L16.624 24H24V0h-7.727z"/>
          </svg>
          네이버 플레이스 예약하기
        </a>

        <p className="text-white/40 text-xs mb-10">네이버 플레이스에서 원하는 날짜와 시간을 선택하세요</p>

        {/* Secondary CTAs */}
        <div className="grid grid-cols-2 gap-3 max-w-sm mx-auto">
          <a
            href={KAKAO_CHANNEL_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="py-4 bg-[#FEE500] hover:bg-yellow-300 text-[#3C1E1E] font-bold rounded-xl text-sm text-center transition-all flex flex-col items-center gap-1"
          >
            <span className="text-xl">💬</span>
            카카오톡 상담
          </a>
          <a
            href={`tel:${PHONE_NUMBER}`}
            className="py-4 bg-white/10 hover:bg-white/20 text-white font-bold rounded-xl text-sm text-center transition-all flex flex-col items-center gap-1 border border-white/20"
          >
            <span className="text-xl">📞</span>
            전화 상담
          </a>
        </div>

        <p className="text-white/30 text-xs mt-6">{PHONE_NUMBER}</p>
      </div>
    </section>
  );
}

// ─── Mobile Floating CTA ──────────────────────────────────────────────────────
function MobileFloatingCTA() {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 lg:hidden bg-white border-t border-gray-200 shadow-lg">
      <div className="grid grid-cols-3 gap-0">
        <a
          href={NAVER_PLACE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="py-3.5 bg-[#03C75A] text-white text-xs font-semibold flex flex-col items-center gap-0.5"
        >
          <span className="text-sm">📋</span>
          <span>체형분석 예약</span>
        </a>
        <a
          href={KAKAO_CHANNEL_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="py-3.5 bg-[#FEE500] text-[#3C1E1E] text-xs font-semibold flex flex-col items-center gap-0.5"
        >
          <span className="text-sm">💬</span>
          <span>카카오 상담</span>
        </a>
        <a
          href={`tel:${PHONE_NUMBER}`}
          className="py-3.5 bg-[#0B1D3A] text-white text-xs font-semibold flex flex-col items-center gap-0.5"
        >
          <span className="text-sm">📞</span>
          <span>전화 상담</span>
        </a>
      </div>
    </div>
  );
}

// ─── Footer ───────────────────────────────────────────────────────────────────
function Footer() {
  return (
    <footer className="bg-gray-900 text-white/60 pb-20 lg:pb-0">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12">
        <div className="flex flex-col sm:flex-row justify-between gap-6">
          <div>
            <p className="text-white font-black text-xl mb-2">ZIANTGYM+</p>
            <p className="text-sm font-light">자이언트짐 — 정왕동 맞춤운동센터</p>
          </div>
          <div className="text-sm font-light space-y-1">
            <p>경기도 시흥시 정왕동</p>
            <p>평일 08:00 ~ 23:00 | 토 10:00 ~ 17:00 | 일 휴무</p>
            <p>Tel: {PHONE_NUMBER}</p>
          </div>
        </div>
        <div className="border-t border-white/10 mt-8 pt-6 text-xs text-center text-white/30">
          © {new Date().getFullYear()} ZIANTGYM+. All rights reserved.
        </div>
      </div>
    </footer>
  );
}

// ─── Main Landing Page ────────────────────────────────────────────────────────
export default function Landing() {
  // Set smooth scroll on mount
  useEffect(() => {
    document.documentElement.style.scrollBehavior = "smooth";
    return () => {
      document.documentElement.style.scrollBehavior = "";
    };
  }, []);

  return (
    <div className="min-h-screen">
      <Nav />
      <HeroSection />
      <WorkoutTypeSection />
      <WhyBodyAnalysisSection />
      <GymPricingSection />
      <PtPricingSection />
      <GymPlusSection />
      <EventsSection />
      <ReviewsSection />
      <BeforeAfterSection />
      <FacilitySection />
      <LocationSection />
      <ContactSection />
      <Footer />
      <MobileFloatingCTA />
    </div>
  );
}
