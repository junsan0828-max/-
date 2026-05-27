import { type ReactNode } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function FitStepPlusLayout({ children, trainerId, isAdmin }: { children: ReactNode; trainerId: number; isAdmin?: boolean }) {
  const [location, navigate] = useLocation();
  const utils = trpc.useUtils();
  const base = `/fit-step-plus/${trainerId}`;

  const memberNavItems = [
    { path: base, label: "홈", icon: "⊞" },
    { path: `${base}/videos`, label: "운동영상", icon: "▶" },
    { path: `${base}/events`, label: "이벤트", icon: "★" },
    { path: `${base}/workout`, label: "운동기록", icon: "◎" },
    { path: `${base}/profile`, label: "내정보", icon: "◈" },
  ];

  const adminNavItems = [
    { path: base, label: "홈", icon: "⊞" },
    { path: `${base}/videos`, label: "운동영상", icon: "▶" },
    { path: `${base}/events`, label: "이벤트", icon: "★" },
    { path: `${base}/membership`, label: "멤버십", icon: "◉" },
  ];

  const navItems = isAdmin ? adminNavItems : memberNavItems;

  const logoutMutation = trpc.fitStepPlus.memberLogout.useMutation({
    onSuccess: () => {
      utils.fitStepPlus.memberMe.invalidate();
      navigate(`${base}/login`);
    },
  });

  return (
    <div className="min-h-screen bg-background flex flex-col max-w-md mx-auto">
      <header className="bg-card border-b border-border px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <span className="text-xl" style={{ fontFamily: "'Bebas Neue', 'Arial Black', Arial, sans-serif" }}>FIT</span>
            <span className="text-xl text-primary" style={{ fontFamily: "'Bebas Neue', 'Arial Black', Arial, sans-serif" }}>STEP</span>
            <span className="text-xl text-primary" style={{ fontFamily: "'Bebas Neue', 'Arial Black', Arial, sans-serif" }}>+</span>
          </div>
          {isAdmin && (
            <span className="text-[10px] font-bold bg-primary/15 text-primary border border-primary/30 px-1.5 py-0.5 rounded-full">관리자</span>
          )}
        </div>
        {isAdmin ? (
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-muted-foreground h-7 px-2 gap-1"
            onClick={() => navigate("/admin/fit-step-plus")}
          >
            <ArrowLeft className="h-3 w-3" />
            관리 패널
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-muted-foreground h-7 px-2"
            onClick={() => logoutMutation.mutate()}
          >
            로그아웃
          </Button>
        )}
      </header>

      <main className="flex-1 overflow-y-auto pb-20">
        {children}
      </main>

      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-card border-t border-border z-10">
        <div className="flex">
          {navItems.map((item) => {
            const isActive = location === item.path || (item.path !== base && location.startsWith(item.path));
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`flex-1 flex flex-col items-center py-2 gap-0.5 text-xs transition-colors ${
                  isActive ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <span className="text-base leading-none">{item.icon}</span>
                <span className="text-[10px] leading-none">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
