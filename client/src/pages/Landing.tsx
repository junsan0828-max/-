import { useState, useEffect } from "react";
import LandingReservationModal from "./LandingReservationModal";
import LandingTrialModal from "./LandingTrialModal";

// ─── 지점별 정보 설정 ─────────────────────────────────────────────────────────
const BRANCH = {
  b1: {
    name: "1호점",
    address: "경기도 시흥시 함송로 29번길 5, 다나빌딩 2/3층",
    phone: "0507-1482-3349",
    hours: { weekday: "08:00 – 23:00", sat: "10:00 – 17:00", sun: "휴무" },
    naverUrl: "https://naver.me/GALzXokD",
    kakaoUrl: "http://pf.kakao.com/_hEHnX/chat",
  },
  b2: {
    name: "2호점",
    address: "경기도 시흥시 중심상가로 181, 삼화빌딩 4층",
    phone: "0507-1457-4003",
    hours: { weekday: "07:30 – 23:00", sat: "10:00 – 17:00", sun: "휴무" },
    naverUrl: "https://naver.me/51upjb7H",
    kakaoUrl: "http://pf.kakao.com/_hEHnX/chat",
  },
};

// ─── 이미지 경로 (실제 사진 업로드 후 경로 교체) ──────────────────────────────
const IMG = {
  hero: "/images/hero/hero-main.jpg",
  intro: "/images/facility/facility-overview.jpg",
  bodyAnalysis: "/images/training/body-analysis.jpg",
  ptSession: "/images/training/pt-session.jpg",
  memberWorkout: {
    b1: "/images/training/member-workout-1.jpg",
    b2: "/images/training/member-workout-2.jpg",
  },
  beforeAfter: [
    { before: "/images/reviews/review-01-before.jpg", after: "/images/reviews/review-01-after.jpg", label: "3개월 체형교정" },
    { before: "/images/reviews/review-02-before.jpg", after: "/images/reviews/review-02-after.jpg", label: "4개월 다이어트" },
    { before: "/images/reviews/review-03-before.jpg", after: "/images/reviews/review-03-after.jpg", label: "6개월 통증관리" },
  ],
  gymplus: [
    { src: "/images/gymplus/screen-dashboard.jpg", label: "대시보드" },
    { src: "/images/gymplus/screen-program.jpg", label: "운동 프로그램" },
    { src: "/images/gymplus/screen-record.jpg", label: "운동 기록" },
    { src: "/images/gymplus/screen-report.jpg", label: "리포트" },
    { src: "/images/gymplus/screen-meal.jpg", label: "식단 관리" },
  ],
  branch: [
    { interior: "/images/branch/branch1-interior.jpg" },
    { interior: "/images/branch/branch2-interior.jpg" },
  ],
};

// ─── 이미지 컴포넌트 (사진 없을 때 placeholder) ───────────────────────────────
function Img({ src, alt, className }: { src: string; alt: string; className?: string }) {
  const [triedUpper, setTriedUpper] = useState(false);
  const [error, setError] = useState(false);

  const resolvedSrc = triedUpper ? src.replace(/\.jpg$/i, ".JPG") : src;

  if (error) {
    return (
      <div className={`bg-gray-100 flex items-center justify-center ${className ?? ""}`}>
        <span className="text-gray-400 text-xs font-light tracking-wide px-4 text-center">{alt}</span>
      </div>
    );
  }
  return (
    <img
      src={resolvedSrc}
      alt={alt}
      className={className}
      onError={() => {
        if (!triedUpper) {
          setTriedUpper(true);
        } else {
          setError(true);
        }
      }}
      loading="lazy"
    />
  );
}

function scrollTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
}

// ─── Nav ───────────────────────────────────────────────────────────────────────
function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", fn);
    return () => window.removeEventListener("scroll", fn);
  }, []);

  const links = [
    { label: "소개", id: "intro" },
    { label: "프로그램", id: "program" },
    { label: "분석 시스템", id: "analysis" },
    { label: "후기", id: "reviews" },
    { label: "짐플러스", id: "gymplus" },
    { label: "지점 안내", id: "branches" },
  ];

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
          scrolled ? "bg-white border-b border-gray-100" : "bg-transparent"
        }`}
      >
        <div className="max-w-6xl mx-auto px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 lg:h-20">
            <button
              onClick={() => scrollTo("hero")}
              className={`text-sm font-bold tracking-[0.2em] uppercase transition-colors ${
                scrolled ? "text-[#0B1D3A]" : "text-white"
              }`}
            >
              ZIANTGYM
            </button>

            <nav className="hidden lg:flex items-center gap-8">
              {links.map((link) => (
                <button
                  key={link.id}
                  onClick={() => scrollTo(link.id)}
                  className={`text-xs tracking-widest uppercase transition-colors ${
                    scrolled ? "text-gray-400 hover:text-[#0B1D3A]" : "text-white/60 hover:text-white"
                  }`}
                >
                  {link.label}
                </button>
              ))}
            </nav>

            <div className="hidden lg:flex items-center gap-6">
              <a
                href={BRANCH.b1.naverUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={`text-xs font-medium px-5 py-2.5 tracking-wide transition-all border ${
                  scrolled
                    ? "border-[#0B1D3A] text-[#0B1D3A] hover:bg-[#0B1D3A] hover:text-white"
                    : "border-white text-white hover:bg-white hover:text-[#0B1D3A]"
                }`}
              >
                무료 상담 예약
              </a>
              <a
                href="/gym-plus"
                className={`text-xs tracking-widest transition-colors ${
                  scrolled ? "text-gray-300 hover:text-gray-600" : "text-white/30 hover:text-white/60"
                }`}
              >
                짐플러스
              </a>
            </div>

            <button
              className="lg:hidden p-2"
              onClick={() => setMenuOpen(true)}
              aria-label="메뉴"
            >
              <div className="flex flex-col gap-1.5 w-5">
                <span className={`block h-px ${scrolled ? "bg-gray-800" : "bg-white"}`} />
                <span className={`block h-px ${scrolled ? "bg-gray-800" : "bg-white"}`} />
                <span className={`block h-px ${scrolled ? "bg-gray-800" : "bg-white"}`} />
              </div>
            </button>
          </div>
        </div>
      </header>

      {/* 모바일 풀스크린 오버레이 메뉴 */}
      {menuOpen && (
        <div className="fixed inset-0 z-[100] lg:hidden">
          {/* 배경 dimmer */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setMenuOpen(false)}
          />
          {/* 드로어 패널 */}
          <div className="absolute top-0 right-0 bottom-0 w-4/5 max-w-xs bg-white flex flex-col shadow-2xl">
            {/* 헤더 */}
            <div className="flex items-center justify-between px-6 h-16 border-b border-gray-100 flex-shrink-0">
              <span className="text-sm font-bold tracking-[0.2em] uppercase text-[#0B1D3A]">ZIANTGYM</span>
              <button
                onClick={() => setMenuOpen(false)}
                className="p-2 text-gray-400 hover:text-gray-700"
                aria-label="닫기"
              >
                <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* 링크 목록 */}
            <nav className="flex-1 overflow-y-auto px-6 py-4">
              {links.map((link) => (
                <button
                  key={link.id}
                  onClick={() => { scrollTo(link.id); setMenuOpen(false); }}
                  className="w-full text-left py-4 text-sm tracking-widest uppercase text-gray-400 hover:text-[#0B1D3A] border-b border-gray-50 transition-colors"
                >
                  {link.label}
                </button>
              ))}
            </nav>

            {/* 하단 CTA */}
            <div className="px-6 py-6 flex flex-col gap-3 flex-shrink-0 border-t border-gray-100">
              <a
                href={BRANCH.b1.naverUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setMenuOpen(false)}
                className="w-full py-4 bg-[#0B1D3A] text-white text-xs font-semibold tracking-widest text-center block"
              >
                무료 상담 예약
              </a>
              <a
                href="/gym-plus"
                className="w-full py-4 text-center text-xs text-gray-400 tracking-widest border border-gray-200 hover:border-gray-400 transition-colors"
              >
                짐플러스 회원 로그인
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Section 1: HERO ──────────────────────────────────────────────────────────
function HeroSection({ onReserve }: { onReserve: () => void }) {
  return (
    <section id="hero" className="relative h-screen min-h-[640px] flex items-end overflow-hidden">
      <div className="absolute inset-0">
        <Img src={IMG.hero} alt="자이언트짐 센터 전경" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/50 to-black/20" />
      </div>

      <div className="relative z-10 w-full max-w-6xl mx-auto px-6 lg:px-8 pb-20 lg:pb-32">
        <p className="text-white/70 text-xs tracking-[0.4em] uppercase mb-8">
          경기도 시흥시 정왕동 · 맞춤운동센터
        </p>
        <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-bold text-white leading-[1.05] mb-8 max-w-2xl drop-shadow-lg">
          내 몸에 맞는<br />운동을<br />시작합니다.
        </h1>
        <p className="text-white/80 text-base lg:text-lg font-light mb-12 max-w-md leading-relaxed drop-shadow">
          체형 분석부터 운동 방향 설정까지.<br />
          자이언트짐
        </p>
        <button
          onClick={onReserve}
          className="px-8 py-4 bg-white text-[#0B1D3A] text-xs font-semibold tracking-[0.15em] uppercase hover:bg-white/90 transition-colors"
        >
          무료 체형분석 예약
        </button>
      </div>

      <div className="absolute bottom-8 right-8 lg:right-12 flex flex-col items-center gap-2 z-10">
        <span className="text-white/50 text-[10px] tracking-[0.3em] uppercase writing-mode-vertical" style={{ writingMode: "vertical-rl" }}>Scroll</span>
        <div className="w-px h-12 bg-white/40" />
      </div>
    </section>
  );
}

// ─── Section 2: 자이언트짐 소개 ───────────────────────────────────────────────
function IntroSection() {
  return (
    <section id="intro" className="py-28 lg:py-40 bg-white">
      <div className="max-w-6xl mx-auto px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24 items-center">
          <div>
            <p className="text-[10px] tracking-[0.4em] uppercase text-gray-300 mb-10">About ZIANTGYM</p>
            <h2 className="text-3xl lg:text-4xl xl:text-5xl font-bold text-[#0B1D3A] leading-[1.1] mb-10">
              자이언트짐은<br />일반 헬스장이<br />아닙니다.
            </h2>
            <div className="space-y-6 text-gray-500 text-base lg:text-lg font-light leading-relaxed">
              <p>
                사람마다 체형, 움직임, 근력, 통증이 모두 다릅니다.
                획일적인 운동 방법으로는 효과를 보장할 수 없습니다.
              </p>
              <p>
                자이언트짐은 운동을 시작하기 전 반드시 현재 몸 상태를 파악합니다.
                체형 분석을 통해 운동 방향을 설정하고, 그에 맞는 프로그램을 제공합니다.
              </p>
              <p>
                헬스장이 아닌, 맞춤운동센터입니다.
              </p>
            </div>

            <div className="mt-14 grid grid-cols-3 gap-0 border-t border-gray-100">
              {[
                { label: "체형분석", sub: "모든 회원 필수" },
                { label: "1 : 1", sub: "개인 맞춤 운동" },
                { label: "ZIANT+", sub: "전용 관리 시스템" },
              ].map((item, i) => (
                <div key={item.label} className={`pt-8 ${i > 0 ? "pl-6 border-l border-gray-100" : ""}`}>
                  <p className="text-[#0B1D3A] font-bold text-base mb-1.5">{item.label}</p>
                  <p className="text-gray-400 text-xs font-light tracking-wide">{item.sub}</p>
                </div>
              ))}
            </div>
          </div>

          <div>
            <Img
              src={IMG.intro}
              alt="자이언트짐 센터 내부"
              className="w-full aspect-[4/5] object-cover"
            />
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Section 3: 운동 프로그램 ─────────────────────────────────────────────────
function ProgramSection({ onReserve }: { onReserve: () => void }) {
  const [branch, setBranch] = useState<"b1" | "b2">("b1");

  const membershipPrices = {
    b1: [
      { period: "1개월", price: "80,000원" },
      { period: "3개월", price: "159,000원" },
      { period: "6개월", price: "216,000원" },
      { period: "12개월", price: "312,000원" },
    ],
    b2: [
      { period: "1개월", price: "60,000원" },
      { period: "3개월", price: "120,000원" },
      { period: "6개월", price: "180,000원" },
      { period: "12개월", price: "280,000원" },
    ],
  };

  return (
    <section id="program" className="py-28 lg:py-40 bg-[#F7F7F5]">
      <div className="max-w-6xl mx-auto px-6 lg:px-8">
        <div className="mb-16 lg:mb-20">
          <p className="text-[10px] tracking-[0.4em] uppercase text-gray-300 mb-4">Program</p>
          <h2 className="text-3xl lg:text-4xl xl:text-5xl font-bold text-[#0B1D3A]">운동 프로그램</h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-1">
          {/* 헬스 이용권 */}
          <div className="bg-white p-10 lg:p-14">
            <div className="flex items-center justify-between mb-8">
              <p className="text-[10px] tracking-[0.4em] uppercase text-gray-300">Membership</p>
              <div className="flex border border-gray-200">
                <button
                  onClick={() => setBranch("b1")}
                  className={`px-4 py-1.5 text-[10px] tracking-widest transition-colors ${branch === "b1" ? "bg-[#0B1D3A] text-white" : "text-gray-400 hover:text-[#0B1D3A]"}`}
                >
                  1호점
                </button>
                <button
                  onClick={() => setBranch("b2")}
                  className={`px-4 py-1.5 text-[10px] tracking-widest transition-colors border-l border-gray-200 ${branch === "b2" ? "bg-[#0B1D3A] text-white" : "text-gray-400 hover:text-[#0B1D3A]"}`}
                >
                  2호점
                </button>
              </div>
            </div>
            <h3 className="text-2xl lg:text-3xl font-bold text-[#0B1D3A] mb-4">헬스 이용권</h3>
            <p className="text-gray-400 font-light leading-relaxed text-sm mb-10">
              체형분석 후 스스로 운동하고 싶은 분을 위한 이용권입니다.
              체성분 측정 및 운동 상담이 포함됩니다.
            </p>
            <div className="space-y-0 mb-10">
              {membershipPrices[branch].map((p) => (
                <div key={p.period} className="flex items-center justify-between py-4 border-b border-gray-100">
                  <span className="text-sm text-gray-400 font-light">{p.period}</span>
                  <span className="text-sm font-semibold text-[#0B1D3A]">{p.price}</span>
                </div>
              ))}
            </div>
            <Img src={IMG.memberWorkout[branch]} alt="헬스 이용 장면" className="w-full aspect-video object-cover" />
          </div>

          {/* 개인 맞춤 PT */}
          <div className="bg-[#0B1D3A] p-10 lg:p-14">
            <p className="text-[10px] tracking-[0.4em] uppercase text-white/25 mb-8">Personal Training</p>
            <h3 className="text-2xl lg:text-3xl font-bold text-white mb-4">개인 맞춤 PT</h3>
            <p className="text-white/50 font-light leading-relaxed text-sm mb-10">
              체형, 통증, 목적에 맞는 1:1 맞춤 트레이닝입니다.
              체형평가와 움직임 평가를 바탕으로 개인별 프로그램을 설계합니다.
            </p>
            <div className="space-y-0 mb-10">
              {[
                { label: "체형 / 움직임 평가", value: "운동 시작 전 필수" },
                { label: "개인 프로그램 설계", value: "목적 · 체형 맞춤" },
                { label: "10회권", value: "500,000원" },
                { label: "20회권", value: "960,000원" },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between py-4 border-b border-white/10">
                  <span className="text-sm text-white/40 font-light">{item.label}</span>
                  <span className="text-sm font-medium text-white/80">{item.value}</span>
                </div>
              ))}
            </div>
            <Img src={IMG.ptSession} alt="PT 수업 장면" className="w-full aspect-video object-cover" />
          </div>
        </div>

        <div className="mt-16 text-center">
          <p className="text-xs text-gray-300 font-light tracking-wide mb-8">
            모든 프로그램은 무료 체형분석 후 결정합니다
          </p>
          <button
            onClick={onReserve}
            className="px-8 py-4 border border-[#0B1D3A] text-[#0B1D3A] text-xs font-medium tracking-[0.15em] uppercase hover:bg-[#0B1D3A] hover:text-white transition-all"
          >
            무료 체형분석 예약
          </button>
        </div>
      </div>
    </section>
  );
}

// ─── Section 4: 근골격 분석 및 체성분 분석 ───────────────────────────────────
function AnalysisSection({ onReserve }: { onReserve: () => void }) {
  const items = [
    {
      title: "체형 평가",
      desc: "자세 분석, 체형 불균형, 움직임 패턴을 평가합니다. 운동 전 반드시 확인해야 할 현재 몸 상태입니다.",
    },
    {
      title: "근골격 분석",
      desc: "어깨, 허리, 무릎 등 관절 기능 및 근력 불균형을 파악합니다. 통증 예방과 올바른 운동 방향 설정의 기초입니다.",
    },
    {
      title: "체성분 분석",
      desc: "체중, 근육량, 체지방률을 정밀 측정합니다. 수치 기반으로 운동 목표를 설정하고 변화를 추적합니다.",
    },
    {
      title: "운동 방향 설정",
      desc: "분석 결과를 바탕으로 헬스 또는 PT 중 적합한 프로그램을 안내합니다. 막연한 운동이 아닌 목적 있는 운동을 시작합니다.",
    },
  ];

  return (
    <section id="analysis" className="py-28 lg:py-40 bg-white">
      <div className="max-w-6xl mx-auto px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24">
          <div>
            <p className="text-[10px] tracking-[0.4em] uppercase text-gray-300 mb-10">Analysis System</p>
            <h2 className="text-3xl lg:text-4xl xl:text-5xl font-bold text-[#0B1D3A] leading-[1.1] mb-10">
              운동 전,<br />내 몸을<br />먼저 파악합니다.
            </h2>
            <p className="text-gray-400 font-light leading-relaxed text-base lg:text-lg mb-12">
              자이언트짐은 모든 회원에게 운동 시작 전 체형분석을 실시합니다.
              분석 없이 시작하는 운동은 방향을 잃은 운동입니다.
            </p>
            <button
              onClick={onReserve}
              className="px-8 py-4 bg-[#0B1D3A] text-white text-xs font-medium tracking-[0.15em] uppercase hover:bg-[#162d5a] transition-colors"
            >
              무료 체형분석 예약
            </button>
          </div>

          <div>
            {items.map((item, i) => (
              <div key={item.title} className="py-8 border-b border-gray-100 first:border-t">
                <div className="flex gap-6">
                  <span className="text-[10px] text-gray-200 font-light mt-1 flex-shrink-0 tabular-nums">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <h3 className="text-sm font-semibold text-[#0B1D3A] mb-2">{item.title}</h3>
                    <p className="text-sm text-gray-400 font-light leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-20">
          <Img
            src={IMG.bodyAnalysis}
            alt="체형평가 및 분석 장면"
            className="w-full aspect-video object-cover"
          />
        </div>
      </div>
    </section>
  );
}

// ─── Section 5: 회원 후기 및 변화 사례 ───────────────────────────────────────
function ReviewsSection() {
  const testimonials = [
    {
      content: "허리 통증 때문에 시작했는데, 체형분석에서 원인을 찾아 3개월 만에 통증이 크게 줄었습니다. 원인을 모른 채 운동했다면 오히려 더 나빠졌을 것 같습니다.",
      name: "이○○",
      info: "30대 직장인 · PT 3개월",
    },
    {
      content: "체형분석 결과를 보고 내 몸에 대해 처음으로 제대로 이해하게 됐습니다. 혼자 운동해도 방향이 명확하니 효율이 완전히 달랐습니다.",
      name: "김○○",
      info: "20대 대학생 · 헬스 이용 6개월",
    },
    {
      content: "어깨 불균형이 심각했는데, 체형에 맞게 프로그램을 설계해주셔서 4개월 만에 자세가 많이 개선됐습니다.",
      name: "박○○",
      info: "40대 · PT 4개월",
    },
  ];

  return (
    <section id="reviews" className="py-28 lg:py-40 bg-[#F7F7F5]">
      <div className="max-w-6xl mx-auto px-6 lg:px-8">
        <div className="mb-16 lg:mb-20">
          <p className="text-[10px] tracking-[0.4em] uppercase text-gray-300 mb-4">Reviews</p>
          <h2 className="text-3xl lg:text-4xl xl:text-5xl font-bold text-[#0B1D3A]">회원 후기</h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-px bg-gray-200">
          {testimonials.map((t) => (
            <div key={t.name} className="bg-white p-8 lg:p-10">
              <p className="text-gray-500 font-light leading-relaxed text-sm mb-10">
                "{t.content}"
              </p>
              <div className="mt-auto">
                <p className="text-[#0B1D3A] font-semibold text-sm">{t.name}</p>
                <p className="text-gray-300 text-xs font-light mt-1">{t.info}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Before & After */}
        <div className="mt-24 mb-12">
          <p className="text-[10px] tracking-[0.4em] uppercase text-gray-300 mb-4">Transformation</p>
          <h3 className="text-2xl lg:text-3xl font-bold text-[#0B1D3A]">변화 사례</h3>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {IMG.beforeAfter.map((item) => (
            <div key={item.label}>
              <div className="grid grid-cols-2 gap-1 mb-4">
                <div className="relative">
                  <Img src={item.before} alt="Before" className="w-full aspect-[3/4] object-cover" />
                  <span className="absolute bottom-3 left-3 text-[10px] text-white/80 tracking-widest uppercase">Before</span>
                </div>
                <div className="relative">
                  <Img src={item.after} alt="After" className="w-full aspect-[3/4] object-cover" />
                  <span className="absolute bottom-3 left-3 text-[10px] text-white/80 tracking-widest uppercase">After</span>
                </div>
              </div>
              <p className="text-xs text-gray-400 font-light tracking-wide">{item.label}</p>
            </div>
          ))}
        </div>

        <p className="text-[10px] text-gray-300 mt-10 font-light tracking-wide">
          * 개인차가 있으며, 실제 회원의 기록을 바탕으로 제작되었습니다.
        </p>
      </div>
    </section>
  );
}

// ─── Section 5.5: 친구 이벤트 ────────────────────────────────────────────────
function EventSection() {
  return (
    <section id="event" className="py-24 lg:py-36 bg-[#06111F] relative overflow-hidden">
      {/* 백그라운드 글로우 */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-[#1D4ED8]/10 blur-[120px] pointer-events-none" />

      <div className="relative z-10 max-w-xl mx-auto px-6 lg:px-8 flex flex-col items-center text-center">

        {/* 배지 */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[#1D4ED8]/40 bg-[#1D4ED8]/10 mb-10">
          <span className="w-1.5 h-1.5 rounded-full bg-[#60A5FA] animate-pulse" />
          <span className="text-[10px] font-bold tracking-[0.3em] text-[#60A5FA] uppercase">Special Event</span>
        </div>

        {/* 헤드라인 */}
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white leading-[1.1] mb-5 tracking-tight">
          친구와 함께 등록하면<br />
          <span className="text-[#60A5FA]">두 사람 모두</span> 1개월 추가
        </h2>
        <p className="text-white/50 text-sm lg:text-base font-light leading-relaxed mb-14 max-w-sm">
          혼자보다 함께 시작하면 더 오래 갑니다.<br />
          친구, 가족, 연인과 함께 운동을 시작해보세요.
        </p>

        {/* 카드 영역 */}
        <div className="w-full grid grid-cols-2 gap-3 mb-4">

          {/* 1인 등록 */}
          <div className="relative rounded-2xl border border-white/10 bg-white/5 p-5 flex flex-col items-center gap-3 text-center">
            <p className="text-[10px] tracking-[0.25em] text-white/30 uppercase font-medium">1인 등록</p>
            <p className="text-white font-bold text-base leading-snug">헬스 12개월</p>
            <div className="w-full border-t border-white/10 pt-3 mt-auto">
              <p className="text-white/40 text-xs">12개월 이용</p>
            </div>
          </div>

          {/* 2인 동시 등록 BEST */}
          <div className="relative rounded-2xl border border-[#1D4ED8]/60 bg-gradient-to-b from-[#1D4ED8]/20 to-[#1D4ED8]/5 p-5 flex flex-col items-center gap-3 text-center shadow-[0_0_30px_rgba(29,78,216,0.2)]">
            {/* BEST 배지 */}
            <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-[#1D4ED8] text-white text-[9px] font-bold tracking-widest rounded-full">BEST</span>
            <p className="text-[10px] tracking-[0.25em] text-[#60A5FA] uppercase font-medium mt-1">2인 동시 등록</p>
            <p className="text-white font-bold text-base leading-snug">두 사람 모두<br />1개월 추가 제공</p>
            <div className="w-full border-t border-[#1D4ED8]/30 pt-3 mt-auto space-y-1">
              <p className="text-white/40 text-xs line-through">12개월</p>
              <p className="text-[#60A5FA] font-black text-xl tracking-tight">13개월 이용</p>
            </div>
          </div>
        </div>

        {/* 혜택 박스들 */}
        <div className="w-full flex flex-col gap-3 mb-10">
          <div className="rounded-2xl border border-[#1D4ED8]/30 bg-[#1D4ED8]/10 px-5 py-4 flex items-center justify-between">
            <p className="text-white/70 text-sm text-left leading-snug">
              친구와 함께 등록 시<br />
              <span className="text-white font-semibold">각각 1개월 추가</span>
            </p>
            <div className="text-right flex-shrink-0">
              <p className="text-[#60A5FA] font-black text-3xl leading-none">+1</p>
              <p className="text-[#60A5FA]/60 text-[10px] font-medium tracking-wide">개월</p>
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-4 flex items-center justify-between">
            <p className="text-white/70 text-sm text-left leading-snug">
              2인 동시 등록 시<br />
              <span className="text-white font-semibold">운동복 서비스 제공</span>
            </p>
            <div className="text-right flex-shrink-0">
              <p className="text-white/50 font-black text-3xl leading-none">+</p>
              <p className="text-white/30 text-[10px] font-medium tracking-wide">운동복</p>
            </div>
          </div>
        </div>

        {/* CTA */}
        <a
          href={BRANCH.b1.naverUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full max-w-sm py-4 bg-[#1D4ED8] hover:bg-[#1a44c2] text-white font-bold text-sm tracking-wide transition-colors rounded-xl shadow-[0_4px_24px_rgba(29,78,216,0.4)] mb-6 text-center"
        >
          무료 상담 예약하기 →
        </a>

        {/* 주의사항 */}
        <div className="space-y-1">
          {[
            "두 분 모두 12개월 회원권 등록 시 적용",
            "친구, 가족, 연인 모두 가능",
            "운동복 서비스는 수량 한정 제공",
            "이벤트는 기간 한정으로 진행될 수 있습니다",
          ].map((note) => (
            <p key={note} className="text-white/25 text-[11px] tracking-wide">* {note}</p>
          ))}
        </div>

      </div>
    </section>
  );
}

// ─── Section 5.7: 미션 혜택 ──────────────────────────────────────────────────
function MissionSection({ onTrial }: { onTrial: () => void }) {
  return (
    <section id="mission" className="py-24 lg:py-36 bg-[#080F1A] relative overflow-hidden">
      <div className="absolute top-0 right-0 w-80 h-80 rounded-full bg-[#1D4ED8]/8 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-64 h-64 rounded-full bg-[#1D4ED8]/6 blur-[80px] pointer-events-none" />

      <div className="relative z-10 max-w-xl mx-auto px-6 lg:px-8">

        {/* 헤드라인 */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[#1D4ED8]/40 bg-[#1D4ED8]/10 mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-[#60A5FA]" />
            <span className="text-[10px] font-bold tracking-[0.3em] text-[#60A5FA] uppercase">회원 혜택 미션</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white leading-[1.1] mb-4 tracking-tight">
            미션 달성하고<br />
            <span className="text-[#60A5FA]">추가 혜택</span> 받기
          </h2>
          <p className="text-white/40 text-sm leading-relaxed">
            간단한 참여만으로<br />헬스 이용 혜택을 받아보세요.
          </p>
        </div>

        {/* ── DEAL 1: 1만원 체험 예약 ── */}
        <div className="rounded-2xl border border-[#1D4ED8]/50 bg-gradient-to-br from-[#1D4ED8]/15 to-[#1D4ED8]/5 p-5 mb-4 shadow-[0_0_30px_rgba(29,78,216,0.15)]">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <span className="inline-block px-2.5 py-0.5 rounded-full bg-[#1D4ED8] text-white text-[9px] font-bold tracking-widest uppercase mb-2">DEAL 1</span>
              <p className="text-white font-bold text-base leading-snug">1만원 체험 예약 결제</p>
              <p className="text-white/40 text-xs mt-1">체형분석 및 상담 · 센터 직접 체험</p>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-[#60A5FA] text-[10px] tracking-wide mb-1">혜택</p>
              <p className="text-[#60A5FA] font-black text-xl leading-none">헬스 1개월</p>
              <p className="text-[#60A5FA]/70 text-[11px] font-medium">추가 제공</p>
            </div>
          </div>
          <button
            onClick={onTrial}
            className="w-full py-3 bg-[#1D4ED8] hover:bg-[#1a44c2] text-white text-sm font-bold rounded-xl transition-colors"
          >
            체험 예약하기 →
          </button>
        </div>

        {/* 구분선 */}
        <div className="flex items-center gap-3 my-5">
          <div className="flex-1 h-px bg-white/10" />
          <span className="text-white/20 text-[11px] tracking-widest">+</span>
          <div className="flex-1 h-px bg-white/10" />
        </div>

        {/* ── DEAL 2: 3-step 미션 ── */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 mb-4">
          <div className="flex items-center justify-between mb-5">
            <div>
              <span className="inline-block px-2.5 py-0.5 rounded-full border border-white/20 text-white/50 text-[9px] font-bold tracking-widest uppercase mb-2">DEAL 2</span>
              <p className="text-white font-bold text-base">2가지 미션 완료</p>
            </div>
            <div className="text-right">
              <p className="text-white/40 text-[10px] tracking-wide mb-1">혜택</p>
              <p className="text-[#60A5FA] font-black text-xl leading-none">1만원</p>
              <p className="text-[#60A5FA]/70 text-[11px] font-medium">할인</p>
            </div>
          </div>

          {/* 미션 스텝 */}
          {[
            {
              step: "01",
              title: "네이버 플레이스 저장 + 알림 받기",
              desc: "자이언트짐 플레이스 저장 후 소식 알림 설정",
              href: BRANCH.b1.naverUrl,
              btnLabel: "바로가기",
              note: "완료 후 캡처해서 네이버 톡톡으로 전달해주세요",
            },
            {
              step: "02",
              title: "네이버 영수증 리뷰",
              desc: "방문 상담 시 작성 방법을 안내해 드립니다",
              href: null,
              btnLabel: null,
              note: null,
            },
          ].map((m, i, arr) => (
            <div key={m.step} className="relative">
              {i < arr.length - 1 && (
                <div className="absolute left-[18px] top-10 w-px h-4 bg-white/10" />
              )}
              <div className="flex items-center gap-3 mb-1">
                <div className="w-9 h-9 rounded-xl border border-[#1D4ED8]/40 bg-[#1D4ED8]/10 flex items-center justify-center flex-shrink-0">
                  <span className="text-[#60A5FA] text-[10px] font-bold">{m.step}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-[13px] font-semibold">{m.title}</p>
                  <p className="text-white/35 text-[11px]">{m.desc}</p>
                  {m.note && (
                    <a
                      href="https://talk.naver.com/ct/w42bpf#nafullscreen"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[#60A5FA]/70 hover:text-[#60A5FA] text-[10px] mt-1 transition-colors"
                    >
                      📲 {m.note}
                      <svg viewBox="0 0 24 24" fill="none" strokeWidth={2} stroke="currentColor" className="w-2.5 h-2.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                      </svg>
                    </a>
                  )}
                </div>
                {m.href && m.btnLabel && (
                  <a
                    href={m.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-[#60A5FA]/60 hover:text-[#60A5FA] transition-colors flex-shrink-0 flex items-center gap-1"
                  >
                    {m.btnLabel}
                    <svg viewBox="0 0 24 24" fill="none" strokeWidth={2} stroke="currentColor" className="w-3 h-3">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                    </svg>
                  </a>
                )}
              </div>
              {i < arr.length - 1 && <div className="h-4" />}
            </div>
          ))}
        </div>

        {/* 두 딜 합산 강조 */}
        <div className="rounded-2xl border border-[#1D4ED8]/30 bg-[#1D4ED8]/8 px-5 py-4 mb-8 flex items-center justify-between">
          <div>
            <p className="text-white/50 text-xs mb-1">DEAL 1 + DEAL 2 모두 달성 시</p>
            <p className="text-white font-bold text-sm">헬스 1개월 추가 <span className="text-white/40">+</span> <span className="text-[#60A5FA]">1만원 할인</span></p>
          </div>
          <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-[#60A5FA]/40 flex-shrink-0">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
          </svg>
        </div>

        {/* CTA */}
        <a
          href={BRANCH.b1.naverUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full py-4 bg-white text-[#0B1D3A] font-bold text-sm tracking-wide hover:bg-white/90 transition-colors rounded-xl shadow-lg text-center"
        >
          지금 혜택 시작하기 →
        </a>
        <a
          href={BRANCH.b1.naverUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full mt-3 py-3.5 border border-white/20 text-white/60 text-sm hover:text-white hover:border-white/40 transition-colors rounded-xl text-center"
        >
          무료 상담 예약
        </a>

      </div>
    </section>
  );
}

// ─── Section 6: 짐플러스 ──────────────────────────────────────────────────────
function GymPlusSection() {
  const features = [
    { title: "운동 프로그램", desc: "트레이너가 설계한 개인 맞춤 프로그램을 언제 어디서나 확인합니다." },
    { title: "운동 기록 관리", desc: "세션별 운동 내용을 기록하고 누적 데이터로 변화를 관리합니다." },
    { title: "식단 관리", desc: "운동과 함께 식단을 기록하여 목표 달성을 효율적으로 관리합니다." },
    { title: "운동 영상 제공", desc: "동작 영상으로 정확한 자세를 유지하며 혼자서도 운동합니다." },
    { title: "변화 리포트", desc: "체성분 변화와 운동 기록을 시각화하여 진행 상황을 확인합니다." },
  ];

  const [active, setActive] = useState(0);

  return (
    <section id="gymplus" className="py-28 lg:py-40 bg-[#0B1D3A]">
      <div className="max-w-6xl mx-auto px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24 items-start">
          <div>
            <p className="text-[10px] tracking-[0.4em] uppercase text-white/25 mb-10">ZIANTGYM+</p>
            <h2 className="text-3xl lg:text-4xl xl:text-5xl font-bold text-white leading-[1.1] mb-8">
              센터 밖에서도<br />관리됩니다.
            </h2>
            <p className="text-white/50 font-light leading-relaxed text-base lg:text-lg mb-14">
              짐플러스는 자이언트짐 회원 전용 관리 시스템입니다.
              운동 프로그램, 기록, 식단, 리포트를 하나의 플랫폼에서 관리하며,
              트레이너와 회원이 센터 밖에서도 연결됩니다.
            </p>

            <div>
              {features.map((f, i) => (
                <button
                  key={f.title}
                  className="w-full text-left py-5 border-b border-white/[0.07] hover:border-white/20 transition-colors"
                  onClick={() => setActive(i)}
                >
                  <div className="flex justify-between items-start gap-4">
                    <div>
                      <p className={`text-sm font-medium mb-1 transition-colors ${active === i ? "text-white" : "text-white/40"}`}>
                        {f.title}
                      </p>
                      {active === i && (
                        <p className="text-sm text-white/40 font-light leading-relaxed">
                          {f.desc}
                        </p>
                      )}
                    </div>
                    <span className={`text-[10px] mt-0.5 flex-shrink-0 tabular-nums transition-colors ${active === i ? "text-white/30" : "text-white/15"}`}>
                      {String(i + 1).padStart(2, "0")}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* 폰 목업 */}
          <div className="flex justify-center lg:justify-end">
            <div className="w-56 xl:w-64">
              <div className="w-full aspect-[9/19] bg-gray-950 rounded-[2.5rem] border-[5px] border-gray-800 shadow-2xl shadow-black/50 overflow-hidden relative">
                <div className="absolute top-0 left-0 right-0 h-7 bg-gray-950 z-10 flex items-end justify-center pb-1">
                  <div className="w-16 h-3.5 bg-black rounded-full" />
                </div>
                <div className="absolute inset-0 pt-7">
                  <Img
                    src={IMG.gymplus[active]?.src ?? ""}
                    alt={IMG.gymplus[active]?.label ?? "짐플러스 화면"}
                    className="w-full h-full object-cover object-top"
                  />
                </div>
              </div>
              <div className="flex justify-center gap-2 mt-5">
                {IMG.gymplus.map((s, i) => (
                  <button
                    key={s.label}
                    onClick={() => setActive(i)}
                    className={`transition-all rounded-full ${active === i ? "w-5 h-1 bg-white" : "w-1 h-1 bg-white/25"}`}
                    aria-label={s.label}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-20 pt-16 border-t border-white/[0.07] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div>
            <p className="text-white font-medium text-sm mb-1">현재 회원이신가요?</p>
            <p className="text-white/35 text-sm font-light">짐플러스에서 운동 프로그램을 확인하세요.</p>
          </div>
          <a
            href="/gym-plus"
            className="px-6 py-3 border border-white/15 text-white/60 text-xs tracking-widest uppercase hover:border-white/30 hover:text-white/80 transition-colors flex-shrink-0"
          >
            짐플러스 로그인
          </a>
        </div>
      </div>
    </section>
  );
}

// ─── Section 7: 지점 안내 ─────────────────────────────────────────────────────
function BranchSection() {
  const branches = [
    { ...BRANCH.b1, imgs: IMG.branch[0] },
    { ...BRANCH.b2, imgs: IMG.branch[1] },
  ];

  return (
    <section id="branches" className="py-28 lg:py-40 bg-white">
      <div className="max-w-6xl mx-auto px-6 lg:px-8">
        <div className="mb-16 lg:mb-20">
          <p className="text-[10px] tracking-[0.4em] uppercase text-gray-300 mb-4">Locations</p>
          <h2 className="text-3xl lg:text-4xl xl:text-5xl font-bold text-[#0B1D3A]">지점 안내</h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-1">
          {branches.map((b, i) => (
            <div key={b.name} className={`${i === 1 ? "bg-[#F7F7F5]" : "bg-white border border-gray-100"} p-10 lg:p-14`}>
              <p className="text-[10px] tracking-[0.4em] uppercase text-gray-300 mb-6">ZIANTGYM {b.name}</p>

              <Img
                src={b.imgs.interior}
                alt={`자이언트짐 ${b.name} 내부`}
                className="w-full aspect-video object-cover mb-10"
              />

              {/* 정보 */}
              <div className="space-y-3 mb-10 border-t border-gray-100 pt-8">
                {[
                  { label: "주소", value: b.address },
                  { label: "전화", value: b.phone },
                  { label: "평일", value: b.hours.weekday },
                  { label: "토요일", value: b.hours.sat },
                  { label: "일요일", value: b.hours.sun },
                ].map((item) => (
                  <div key={item.label} className="flex justify-between text-sm gap-4">
                    <span className="text-gray-300 font-light flex-shrink-0">{item.label}</span>
                    <span className="text-gray-600 font-light text-right">{item.value}</span>
                  </div>
                ))}
              </div>

              {/* CTA */}
              <div className="space-y-2">
                <a
                  href={b.naverUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between w-full px-6 py-4 bg-[#0B1D3A] text-white hover:bg-[#162d5a] transition-colors group"
                >
                  <span className="text-xs font-medium tracking-wide">네이버 예약</span>
                  <span className="text-white/30 group-hover:text-white/60 transition-colors">→</span>
                </a>
                <a
                  href={b.kakaoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between w-full px-6 py-4 bg-gray-50 border border-gray-100 text-[#0B1D3A] hover:bg-gray-100 transition-colors group"
                >
                  <span className="text-xs font-medium tracking-wide">카카오톡 문의</span>
                  <span className="text-gray-300 group-hover:text-gray-500 transition-colors">→</span>
                </a>
                <a
                  href={`tel:${b.phone}`}
                  className="flex items-center justify-between w-full px-6 py-4 bg-gray-50 border border-gray-100 text-[#0B1D3A] hover:bg-gray-100 transition-colors group"
                >
                  <span className="text-xs font-medium tracking-wide">전화 문의</span>
                  <span className="text-gray-300 text-xs font-light group-hover:text-gray-500 transition-colors">{b.phone}</span>
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Section 8: 상담 신청 ─────────────────────────────────────────────────────
function ContactSection() {
  const steps = [
    { step: "무료 체형분석 예약", active: true },
    { step: "센터 방문", active: false },
    { step: "체형 · 근골격 분석", active: false },
    { step: "운동 방향 설정", active: false },
    { step: "헬스 또는 PT 등록", active: false },
    { step: "짐플러스 관리 시작", active: false },
  ];

  return (
    <section id="contact" className="py-28 lg:py-40 bg-white">
      <div className="max-w-6xl mx-auto px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24">
          <div>
            <p className="text-[10px] tracking-[0.4em] uppercase text-gray-300 mb-10">Consultation</p>
            <h2 className="text-3xl lg:text-4xl xl:text-5xl font-bold text-[#0B1D3A] leading-[1.1] mb-8">
              먼저 몸 상태를<br />확인해보세요.
            </h2>
            <p className="text-gray-400 font-light leading-relaxed text-base lg:text-lg mb-14">
              무료 체형분석 및 상담을 통해 운동 방향을 먼저 결정합니다.
              회원권 등록은 그 다음입니다.
            </p>

            <div>
              {steps.map((s, i) => (
                <div key={s.step} className="flex items-center gap-5 py-4 border-b border-gray-100">
                  <span className="text-[10px] text-gray-200 font-light tabular-nums flex-shrink-0 w-4">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className={`text-sm ${s.active ? "text-[#0B1D3A] font-semibold" : "text-gray-400 font-light"}`}>
                    {s.step}
                  </span>
                  {s.active && (
                    <span className="ml-auto text-[10px] text-[#0B1D3A] tracking-widest uppercase font-light flex-shrink-0">Start</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col justify-center gap-6">
            {[BRANCH.b1, BRANCH.b2].map((b) => (
              <div key={b.name} className="border border-gray-100 p-8">
                <p className="text-[10px] tracking-[0.4em] uppercase text-gray-300 mb-5">ZIANTGYM {b.name}</p>
                <div className="space-y-2 mb-6">
                  <a
                    href={b.naverUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between w-full px-6 py-4 bg-[#0B1D3A] text-white hover:bg-[#162d5a] transition-colors group"
                  >
                    <span className="text-xs font-medium tracking-wide">네이버 예약</span>
                    <span className="text-white/30 group-hover:text-white/60 transition-colors">→</span>
                  </a>
                  <a
                    href={b.kakaoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between w-full px-6 py-4 bg-gray-50 border border-gray-100 text-[#0B1D3A] hover:bg-gray-100 transition-colors group"
                  >
                    <span className="text-xs font-medium tracking-wide">카카오톡 문의</span>
                    <span className="text-gray-300 group-hover:text-gray-500 transition-colors">→</span>
                  </a>
                  <a
                    href={`tel:${b.phone}`}
                    className="flex items-center justify-between w-full px-6 py-4 bg-gray-50 border border-gray-100 text-[#0B1D3A] hover:bg-gray-100 transition-colors group"
                  >
                    <span className="text-xs font-medium tracking-wide">전화 문의</span>
                    <span className="text-gray-300 text-xs font-light group-hover:text-gray-500 transition-colors">{b.phone}</span>
                  </a>
                </div>
                <div className="border-t border-gray-50 pt-5 space-y-2">
                  {[
                    { label: "주소", value: b.address },
                    { label: "평일", value: b.hours.weekday },
                    { label: "토요일", value: b.hours.sat },
                    { label: "일요일", value: b.hours.sun },
                  ].map((item) => (
                    <div key={item.label} className="flex justify-between text-xs gap-4">
                      <span className="text-gray-300 font-light flex-shrink-0">{item.label}</span>
                      <span className="text-gray-500 font-light text-right">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Footer ───────────────────────────────────────────────────────────────────
function Footer() {
  return (
    <footer className="bg-[#F7F7F5] border-t border-gray-100">
      <div className="max-w-6xl mx-auto px-6 lg:px-8 py-12">
        <div className="flex flex-col lg:flex-row justify-between gap-8 mb-10">
          <div>
            <p className="text-[#0B1D3A] font-bold tracking-[0.2em] uppercase text-xs mb-4">ZIANTGYM</p>
            <div className="text-xs text-gray-300 font-light leading-relaxed space-y-2">
              <p>1호점 · {BRANCH.b1.address}<br />Tel. {BRANCH.b1.phone}</p>
              <p>2호점 · {BRANCH.b2.address}<br />Tel. {BRANCH.b2.phone}</p>
            </div>
          </div>
          <div className="text-xs text-gray-300 font-light space-y-1.5">
            <p>평일 08:00 – 23:00 · 토 10:00 – 17:00 · 일 휴무</p>
            <p>© {new Date().getFullYear()} ZIANTGYM. All rights reserved.</p>
          </div>
        </div>
        <div className="border-t border-gray-200 pt-6 flex items-center gap-5 text-[10px] text-gray-200 tracking-widest uppercase">
          <a href="/gym-plus" className="hover:text-gray-400 transition-colors">짐플러스 로그인</a>
          <span>·</span>
          <a href="/login" className="hover:text-gray-400 transition-colors">관리자</a>
        </div>
      </div>
    </footer>
  );
}

// ─── Mobile Bottom CTA ────────────────────────────────────────────────────────
function MobileBottomCTA({ onReserve }: { onReserve: () => void }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const fn = () => setVisible(window.scrollY > window.innerHeight * 0.5);
    window.addEventListener("scroll", fn);
    return () => window.removeEventListener("scroll", fn);
  }, []);

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 lg:hidden bg-white border-t border-gray-100">
      <div className="grid grid-cols-2">
        <button
          onClick={onReserve}
          className="py-4 bg-[#0B1D3A] text-white text-[10px] font-medium text-center tracking-[0.15em] uppercase"
        >
          무료 체형분석 예약
        </button>
        <a
          href={BRANCH.b1.naverUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="py-4 bg-white text-[#0B1D3A] text-[10px] font-medium text-center tracking-[0.15em] uppercase border-l border-gray-100 flex items-center justify-center"
        >
          상담 신청
        </a>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function Landing() {
  const [showReservationModal, setShowReservationModal] = useState(false);
  const [showTrialModal, setShowTrialModal] = useState(false);
  const openReservation = () => setShowReservationModal(true);
  const openTrial = () => setShowTrialModal(true);

  useEffect(() => {
    document.documentElement.style.scrollBehavior = "smooth";
    return () => { document.documentElement.style.scrollBehavior = ""; };
  }, []);

  return (
    <div className="min-h-screen bg-white">
      <Nav />
      <HeroSection onReserve={openReservation} />
      <IntroSection />
      <ProgramSection onReserve={openReservation} />
      <AnalysisSection onReserve={openReservation} />
      <ReviewsSection />
      <EventSection />
      <MissionSection onTrial={openTrial} />
      <GymPlusSection />
      <BranchSection />
      <ContactSection />
      <Footer />
      <MobileBottomCTA onReserve={openReservation} />
      {showReservationModal && (
        <LandingReservationModal onClose={() => setShowReservationModal(false)} />
      )}
      {showTrialModal && (
        <LandingTrialModal onClose={() => setShowTrialModal(false)} />
      )}
    </div>
  );
}
