import { type ReactNode, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import GymPlusOnboarding from "./GymPlusOnboarding";

const navItems = [
  {
    path: "/gym-plus",
    label: "홈",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.8} stroke="currentColor" className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75" />
      </svg>
    ),
  },
  {
    path: "/gym-plus/videos",
    label: "운동영상",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.8} stroke="currentColor" className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.91 11.672a.375.375 0 0 1 0 .656l-5.603 3.113a.375.375 0 0 1-.557-.328V8.887c0-.286.307-.466.557-.328l5.603 3.113Z" />
      </svg>
    ),
  },
  {
    path: "/gym-plus/workout",
    label: "운동기록",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.8} stroke="currentColor" className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="m3.75 13.5 10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z" />
      </svg>
    ),
  },
  {
    path: "/gym-plus/diet",
    label: "맞춤식단",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.8} stroke="currentColor" className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" />
      </svg>
    ),
  },
  {
    path: "/gym-plus/events",
    label: "이벤트",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.8} stroke="currentColor" className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
      </svg>
    ),
  },
  {
    path: "/gym-plus/profile",
    label: "인포데스크",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.8} stroke="currentColor" className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
      </svg>
    ),
  },
];

export default function GymPlusLayout({ children }: { children: ReactNode }) {
  const [location, navigate] = useLocation();
  const utils = trpc.useUtils();
  const [onboardingDone, setOnboardingDone] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const { data: health, isLoading: healthLoading } = trpc.gymPlus.getHealth.useQuery();
  const { data: me } = trpc.gymPlus.memberMe.useQuery();

  const needsOnboarding = !healthLoading && !onboardingDone && (
    !health?.gymRulesAgreed || !health?.appGuideConfirmed || !health?.parqSubmittedAt
  );

  const logoutMutation = trpc.gymPlus.memberLogout.useMutation({
    onSuccess: () => {
      utils.gymPlus.memberMe.invalidate();
      navigate("/gym-plus/login");
    },
  });

  const handleNav = (path: string) => {
    navigate(path);
    setSidebarOpen(false);
  };

  return (
    <div className="gymplus-light min-h-screen flex flex-col max-w-md mx-auto">
      {/* 헤더 */}
      <header className="bg-white border-b border-gray-100 px-5 py-3.5 flex items-center justify-between sticky top-0 z-20 shadow-sm">
        <button
          onClick={() => setSidebarOpen(true)}
          className="p-1 -ml-1 text-gray-500 hover:text-gray-700 transition-colors"
          aria-label="메뉴 열기"
        >
          <svg viewBox="0 0 24 24" fill="none" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
          </svg>
        </button>
        <button
          onClick={() => navigate("/gym-plus")}
          style={{ fontFamily: "'Cormorant Garamond', serif", letterSpacing: "0.12em" }}
          className="text-xl font-semibold text-[#1a2b4b]"
        >
          ZIANTGYM<span style={{ color: "hsl(221 83% 44%)" }}>+</span>
        </button>
        <div className="w-7" />
      </header>

      {/* 콘텐츠 */}
      <main className="flex-1 overflow-y-auto bg-[#f8f9fc]">
        {children}
      </main>

      {/* 온보딩 모달 */}
      {needsOnboarding && (
        <GymPlusOnboarding
          health={health ?? null}
          onComplete={() => { setOnboardingDone(true); utils.gymPlus.getHealth.invalidate(); }}
        />
      )}

      {/* 사이드바 오버레이 */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* 사이드바 */}
      <aside
        className="fixed top-0 left-0 h-full w-64 bg-white z-40 flex flex-col shadow-2xl transition-transform duration-300"
        style={{
          transform: sidebarOpen ? "translateX(0)" : "translateX(-100%)",
          maxWidth: "80vw",
        }}
      >
        {/* 사이드바 헤더 */}
        <div className="px-5 pt-12 pb-6 border-b border-gray-100">
          <span
            style={{ fontFamily: "'Cormorant Garamond', serif", letterSpacing: "0.12em" }}
            className="text-xl font-semibold text-[#1a2b4b]"
          >
            ZIANTGYM<span style={{ color: "hsl(221 83% 44%)" }}>+</span>
          </span>
          {me && (
            <div className="mt-3">
              <p className="text-sm font-bold text-[#1a2b4b]">{me.name}님</p>
              <p className="text-xs text-gray-400 mt-0.5">{me.membershipType ?? "일반회원"}</p>
            </div>
          )}
        </div>

        {/* 네비게이션 항목 */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = location === item.path || (item.path !== "/gym-plus" && location.startsWith(item.path));
            return (
              <button
                key={item.path}
                onClick={() => handleNav(item.path)}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-colors"
                style={{
                  background: isActive ? "hsl(221 83% 44% / 0.08)" : "transparent",
                  color: isActive ? "hsl(221 83% 44%)" : "#6b7280",
                }}
              >
                <span>{item.icon}</span>
                <span className="text-sm font-medium">{item.label}</span>
                {isActive && (
                  <span className="ml-auto w-1.5 h-1.5 rounded-full bg-[#1D4ED8]" />
                )}
              </button>
            );
          })}
        </nav>

        {/* 로그아웃 */}
        <div className="px-3 pb-8 border-t border-gray-100 pt-3">
          <button
            onClick={() => logoutMutation.mutate()}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors text-left"
          >
            <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.8} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15M12 9l-3 3m0 0 3 3m-3-3h12.75" />
            </svg>
            <span className="text-sm font-medium">로그아웃</span>
          </button>
        </div>
      </aside>
    </div>
  );
}
