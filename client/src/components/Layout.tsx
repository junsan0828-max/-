import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "../lib/trpc";
import { toast } from "sonner";
import {
  LayoutDashboard, Users, Dumbbell, LogOut,
  UserCog, Settings, User, ClipboardCheck, Download, X,
} from "lucide-react";
import Logo from "./Logo";

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const { data: user } = trpc.auth.me.useQuery();
  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => window.location.reload(),
    onError: () => toast.error("로그아웃 실패"),
  });

  // PWA 설치 프롬프트
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

  const adminNavItems = [
    { path: "/", label: "대시보드", icon: LayoutDashboard },
    { path: "/trainers", label: "트레이너", icon: UserCog },
    { path: "/admin", label: "관리", icon: Settings },
  ];

  const trainerNavItems = [
    { path: "/", label: "대시보드", icon: LayoutDashboard },
    { path: "/members", label: "회원 관리", icon: Users },
    { path: "/attendance", label: "출석 체크", icon: ClipboardCheck },
    { path: "/pt", label: "PT 관리", icon: Dumbbell },
    { path: "/profile", label: "내 프로필", icon: User },
  ];

  const navItems = user?.role === "admin" ? adminNavItems : trainerNavItems;

  const isActive = (path: string) => {
    if (path === "/") return location === "/";
    return location.startsWith(path);
  };

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* ── 데스크탑 사이드바 ── */}
      <aside className="hidden md:flex flex-col w-56 shrink-0 bg-card border-r border-border">
        {/* 로고 */}
        <div className="px-5 py-4 border-b border-border">
          <button onClick={() => setLocation("/")} className="text-primary">
            <Logo className="h-9" textSize="text-sm" />
          </button>
        </div>

        {/* 네비게이션 */}
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

        {/* 하단 유저 정보 */}
        <div className="px-3 py-4 border-t border-border space-y-1">
          <div className="px-3 py-2">
            <p className="text-xs font-medium text-foreground truncate">{user?.username}</p>
            <p className="text-xs text-muted-foreground">
              {user?.role === "admin" ? "관리자" : "트레이너"}
            </p>
          </div>
          <button
            onClick={() => logoutMutation.mutate()}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            로그아웃
          </button>
        </div>
      </aside>

      {/* ── 메인 영역 ── */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* 모바일 상단 바 */}
        <header className="md:hidden sticky top-0 z-50 bg-card border-b border-border px-4 py-3 flex items-center justify-between shrink-0">
          <button onClick={() => setLocation("/")} className="text-primary">
            <Logo className="h-7" textSize="text-sm" />
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

        {/* PWA 설치 배너 */}
        {showInstallBanner && (
          <div className="md:hidden bg-primary/10 border-b border-primary/20 px-4 py-2.5 flex items-center gap-3 shrink-0">
            <Download className="h-4 w-4 text-primary shrink-0" />
            <p className="text-xs text-foreground flex-1">홈 화면에 ZIANTGYM을 추가하세요</p>
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

        {/* 콘텐츠 */}
        <main className="flex-1 overflow-y-auto pb-20 md:pb-0">
          <div className="container mx-auto px-4 py-6 max-w-3xl">
            {children}
          </div>
        </main>

        {/* ── 모바일 하단 내비게이션 ── */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border flex">
          {navItems.map((item) => (
            <button
              key={item.path}
              onClick={() => setLocation(item.path)}
              className={`flex flex-col items-center justify-center flex-1 py-2.5 gap-1 text-xs transition-colors ${
                isActive(item.path) ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <item.icon className="h-5 w-5" />
              <span className="leading-none">{item.label}</span>
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}
