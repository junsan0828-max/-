import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "../lib/trpc";
import { toast } from "sonner";
import {
  LayoutDashboard, Dumbbell, LogOut,
  User, ClipboardCheck, Download, X, ShieldCheck, Bell,
  UserPlus, TrendingUp, Wrench, Zap, Coins,
} from "lucide-react";

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const { data: user } = trpc.auth.me.useQuery();
  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => window.location.reload(),
    onError: () => toast.error("로그아웃 실패"),
  });

  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e);
      const dismissed = sessionStorage.getItem("pwa-banner-dismissed");
      if (!dismissed) setShowInstallBanner(true);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === "accepted") setShowInstallBanner(false);
    setInstallPrompt(null);
  };

  const dismissBanner = () => {
    setShowInstallBanner(false);
    sessionStorage.setItem("pwa-banner-dismissed", "1");
  };

  const isAdmin = user?.role === "admin";

  const adminNavItems = [
    { path: "/", label: "운영 현황", icon: LayoutDashboard },
    { path: "/admin/trainers", label: "트레이너 관리", icon: ShieldCheck },
    { path: "/admin/points", label: "포인트 관리", icon: Coins },
    { path: "/admin/notices", label: "공지/배너", icon: Bell },
    { path: "/admin/fit-step-plus", label: "FIT STEP+", icon: Zap },
  ];

  const trainerNavItems = [
    { path: "/", label: "대시보드", icon: LayoutDashboard },
    { path: "/attendance", label: "출석 체크", icon: ClipboardCheck },
    { path: "/pt", label: "회원관리", icon: Dumbbell },
    { path: "/leads", label: "상담실", icon: UserPlus },
    { path: "/settlement", label: "성장분석", icon: TrendingUp },
    { path: "/workshop", label: "작업실", icon: Wrench },
    { path: "/profile", label: "내 프로필", icon: User },
  ];

  const navItems = isAdmin ? adminNavItems : trainerNavItems;

  const isActive = (path: string) => {
    if (path === "/") return location === "/";
    return location.startsWith(path);
  };

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* 데스크탑 사이드바 */}
      <aside className="hidden md:flex flex-col w-56 shrink-0 bg-card border-r border-border">
        <div className="px-5 py-4 border-b border-border">
          <button onClick={() => setLocation("/")} className="flex items-center gap-1">
            <span className="font-black text-lg tracking-widest" style={{ fontFamily: "'Arial Black', Arial, sans-serif" }}>FIT</span>
            <span className="font-black text-lg tracking-widest text-primary" style={{ fontFamily: "'Arial Black', Arial, sans-serif" }}>STEP</span>
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <button
              key={item.path}
              onClick={() => setLocation(item.path)}
              className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive(item.path)
                  ? "bg-primary/20 text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
              }`}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="px-3 py-4 border-t border-border space-y-1">
          <div className="px-3 py-2">
            <p className="text-xs font-medium text-foreground truncate">{user?.username}</p>
            <p className="text-xs text-muted-foreground">{isAdmin ? "운영자" : "트레이너"}</p>
          </div>
          <button
            onClick={() => logoutMutation.mutate()}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            로그아웃
          </button>
          {!isAdmin && (user as any)?.plan === "free" && (
            <p className="text-center text-[10px] text-muted-foreground/50 pt-1">Powered by FIT STEP</p>
          )}
        </div>
      </aside>

      <div className="flex flex-col flex-1 min-w-0">
        {/* 모바일 상단 바 */}
        <header className="md:hidden sticky top-0 z-50 bg-card border-b border-border px-4 py-3 flex items-center justify-between shrink-0">
          <button onClick={() => setLocation("/")} className="flex items-center gap-1">
            <span className="font-black text-base tracking-widest" style={{ fontFamily: "'Arial Black', Arial, sans-serif" }}>FIT</span>
            <span className="font-black text-base tracking-widest text-primary" style={{ fontFamily: "'Arial Black', Arial, sans-serif" }}>STEP</span>
          </button>
          <div className="flex items-center gap-1">
            <span className="text-xs text-muted-foreground mr-1">{user?.username}</span>
            <button
              onClick={() => logoutMutation.mutate()}
              className="text-muted-foreground hover:text-foreground p-2 rounded-md hover:bg-accent transition-colors"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </header>

        {showInstallBanner && (
          <div className="md:hidden bg-primary/10 border-b border-primary/20 px-4 py-2.5 flex items-center gap-3 shrink-0">
            <Download className="h-4 w-4 text-primary shrink-0" />
            <p className="text-xs text-foreground flex-1">홈 화면에 FIT STEP을 추가하세요</p>
            <button
              onClick={handleInstall}
              className="text-xs font-medium text-primary bg-primary/20 px-2.5 py-1 rounded-md shrink-0"
            >
              설치
            </button>
            <button onClick={dismissBanner} className="text-muted-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        <main className="flex-1 overflow-y-auto pb-20 md:pb-0">
          <div className="container mx-auto px-4 py-6 max-w-3xl">
            {children}
          </div>
        </main>

        {/* 모바일 하단 내비게이션 */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border">
          <div className="flex overflow-x-auto scrollbar-none">
            {navItems.map((item) => (
              <button
                key={item.path}
                onClick={() => setLocation(item.path)}
                className={`flex flex-col items-center justify-center shrink-0 py-2.5 gap-1 text-xs transition-colors px-3 min-w-[60px] ${
                  isActive(item.path) ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <item.icon className="h-5 w-5" />
                <span className="leading-none">{item.label}</span>
              </button>
            ))}
          </div>
          {!isAdmin && (user as any)?.plan === "free" && (
            <p className="text-center text-[10px] text-muted-foreground/50 pb-1">Powered by FIT STEP</p>
          )}
        </nav>
      </div>
    </div>
  );
}
