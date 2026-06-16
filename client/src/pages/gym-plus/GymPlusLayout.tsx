import { type ReactNode } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";

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
    label: "내정보",
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

  const logoutMutation = trpc.gymPlus.memberLogout.useMutation({
    onSuccess: () => {
      utils.gymPlus.memberMe.invalidate();
      navigate("/gym-plus/login");
    },
  });

  return (
    <div className="gymplus-light min-h-screen flex flex-col max-w-md mx-auto">
      {/* 헤더 */}
      <header className="bg-white border-b border-gray-100 px-5 py-3.5 flex items-center justify-between sticky top-0 z-10 shadow-sm">
        <span
          style={{ fontFamily: "'Cormorant Garamond', serif", letterSpacing: "0.12em" }}
          className="text-xl font-semibold text-[#1a2b4b]"
        >
          ZIANTGYM<span style={{ color: "hsl(221 83% 44%)" }}>+</span>
        </span>
        <button
          className="text-xs text-gray-400 hover:text-gray-600 transition-colors px-2 py-1"
          onClick={() => logoutMutation.mutate()}
        >
          로그아웃
        </button>
      </header>

      {/* 콘텐츠 */}
      <main className="flex-1 overflow-y-auto bg-[#f8f9fc]" style={{ paddingBottom: "calc(5rem + env(safe-area-inset-bottom))" }}>
        {children}
      </main>

      {/* 하단 네비게이션 */}
      <nav
        className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-white border-t border-gray-100 z-10 shadow-[0_-1px_8px_rgba(0,0,0,0.06)]"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="flex">
          {navItems.map((item) => {
            const isActive = location === item.path || (item.path !== "/gym-plus" && location.startsWith(item.path));
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className="flex-1 flex flex-col items-center pt-2.5 pb-2 gap-1 transition-colors relative"
              >
                {isActive && (
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-0.5 rounded-full bg-[#1D4ED8]" />
                )}
                <span style={{ color: isActive ? "hsl(221 83% 44%)" : "#9ca3af" }}>
                  {item.icon}
                </span>
                <span
                  className="text-[9px] leading-none font-medium"
                  style={{ color: isActive ? "hsl(221 83% 44%)" : "#9ca3af" }}
                >
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
