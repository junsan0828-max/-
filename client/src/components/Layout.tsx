import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "../lib/trpc";
import { toast } from "sonner";
import {
  LayoutDashboard, Users, Dumbbell, LogOut,
  UserCog, Settings, User, ClipboardCheck, Download, X, ChevronLeft,
  TrendingUp, Megaphone, BrainCircuit, UserPlus, ListChecks, DoorOpen, BookOpen, Menu, ExternalLink, ClipboardList, Globe, ClipboardPlus, UsersRound,
} from "lucide-react";
import Logo from "./Logo";

const GYMPLUS_URL_KEY = "ziantgym_gymplus_url";
const GYMPLUS_URL_DEFAULT = "https://abundant-recreation-production-a6a1.up.railway.app/admin/gymplus";

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const { data: user } = trpc.auth.me.useQuery();
  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => window.location.reload(),
    onError: () => toast.error("로그아웃 실패"),
  });

  const [drawerOpen, setDrawerOpen] = useState(false);

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

  // 페이지 이동 시 드로어 닫기
  useEffect(() => {
    setDrawerOpen(false);
  }, [location]);

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
    { path: "/", label: "KPI 대시보드", icon: LayoutDashboard },
    { path: "/revenue", label: "매출/지출", icon: TrendingUp },
    { path: "/trainers", label: "트레이너", icon: UserCog },
    { path: "/members", label: "회원관리", icon: Users },
    { path: "/leads", label: "상담관리", icon: UserPlus },
    { path: "/registration", label: "등록관리", icon: ClipboardPlus },
    { path: "/access", label: "출입관리", icon: DoorOpen },
    { path: "/marketing", label: "마케팅", icon: Megaphone },
    { path: "/ai-analysis", label: "AI 분석", icon: BrainCircuit },
    { path: "/team-management", label: "팀관리", icon: UsersRound },
    { path: "/landing-admin", label: "랜딩페이지 관리", icon: Globe },
    { path: "/admin", label: "관리자 설정", icon: Settings },
  ];

  const consultantNavItems = [
    { path: "/my-work", label: "나의 업무", icon: ListChecks },
    { path: "/leads", label: "상담관리", icon: UserPlus },
    { path: "/members", label: "회원관리", icon: Users },
    { path: "/revenue", label: "매출입력", icon: TrendingUp },
    { path: "/access", label: "출입관리", icon: DoorOpen },
  ];

  const trainerNavItems = [
    { path: "/", label: "대시보드", icon: LayoutDashboard },
    { path: "/my-work", label: "나의 업무", icon: ListChecks },
    { path: "/attendance", label: "출석 체크", icon: ClipboardCheck },
    { path: "/pt", label: "PT 관리", icon: Dumbbell },
    { path: "/members", label: "회원 관리", icon: Users },
    { path: "/leads", label: "상담관리", icon: UserPlus },
    { path: "/training-manual", label: "교육 매뉴얼", icon: BookOpen },
    { path: "/profile", label: "내 프로필", icon: User },
  ];

  const isAdmin = user?.role === "admin" || user?.role === "sub_admin";
  const navItems = isAdmin ? adminNavItems
    : user?.role === "consultant" ? consultantNavItems
    : trainerNavItems;

  const isActive = (path: string) => {
    if (path === "/") return location === "/";
    return location.startsWith(path);
  };

  const roleLabel = user?.role === "admin" ? "관리자"
    : user?.role === "sub_admin" ? "부관리자"
    : user?.role === "consultant" ? "컨설턴트"
    : "트레이너";

  const gymplusUrl = localStorage.getItem(GYMPLUS_URL_KEY) ?? GYMPLUS_URL_DEFAULT;

  // iOS 좌측 엣지 스와이프 뒤로가기
  const mainRef = useRef<HTMLElement>(null);
  const swipeRef = useRef<{ x: number; y: number } | null>(null);
  const [swipeDx, setSwipeDx] = useState(0);

  useEffect(() => {
    const el = mainRef.current;
    if (!el) return;

    const onStart = (e: TouchEvent) => {
      const t = e.touches[0];
      if (t.clientX <= 28) {
        swipeRef.current = { x: t.clientX, y: t.clientY };
        setSwipeDx(0);
      }
    };
    const onMove = (e: TouchEvent) => {
      if (!swipeRef.current) return;
      const dx = e.touches[0].clientX - swipeRef.current.x;
      if (dx > 0) setSwipeDx(Math.min(dx, 120));
    };
    const onEnd = (e: TouchEvent) => {
      if (!swipeRef.current) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - swipeRef.current.x;
      const dy = Math.abs(t.clientY - swipeRef.current.y);
      swipeRef.current = null;
      setSwipeDx(0);
      if (dx > 72 && dx > dy * 1.5) window.history.back();
    };
    const onCancel = () => { swipeRef.current = null; setSwipeDx(0); };

    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: true });
    el.addEventListener("touchend", onEnd, { passive: true });
    el.addEventListener("touchcancel", onCancel, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onCancel);
    };
  }, []);

  // ── 사이드바 공용 내용 ────────────────────────────────────────────────────
  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* 로고 + 닫기 */}
      <div className="px-5 py-4 border-b border-border flex items-center justify-between">
        <button onClick={() => setLocation("/")} className="text-primary">
          <Logo className="h-9" textSize="text-sm" />
        </button>
        <button
          onClick={() => setDrawerOpen(false)}
          className="md:hidden p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* 네비게이션 */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
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

      {/* 유저 정보 + (어드민만) ZIANTGYM+ + 로그아웃 */}
      <div className="px-3 py-4 border-t border-border space-y-1">
        <div className="px-3 py-2">
          <p className="text-xs font-medium text-foreground truncate">{user?.username}</p>
          <p className="text-xs text-muted-foreground">{roleLabel}</p>
        </div>
        {isAdmin && (
          <a
            href={gymplusUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm text-violet-400 hover:text-violet-300 hover:bg-violet-500/10 transition-colors"
          >
            <ExternalLink className="h-4 w-4 shrink-0" />
            ZIANTGYM+
          </a>
        )}
        <button
          onClick={() => logoutMutation.mutate()}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          로그아웃
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex bg-background overflow-hidden" style={{ height: '100dvh', minHeight: '100svh' }}>

      {/* 모바일 드로어 오버레이 (전체 계정) */}
      {drawerOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/50"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      {/* 모바일 드로어 패널 (전체 계정) */}
      <aside
        className={`md:hidden fixed top-0 left-0 h-full w-64 z-50 bg-card border-r border-border transform transition-transform duration-300 ease-in-out ${
          drawerOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <SidebarContent />
      </aside>

      {/* 데스크탑 사이드바 */}
      <aside className="hidden md:flex flex-col w-56 shrink-0 bg-card border-r border-border">
        <SidebarContent />
      </aside>

      {/* 메인 영역 */}
      <div className="flex flex-col flex-1 min-w-0">

        {/* 모바일 상단 헤더 (전체 계정 동일) */}
        <header
          className="md:hidden sticky top-0 z-30 bg-card border-b border-border px-4 flex items-center justify-between shrink-0"
          style={{ paddingTop: 'calc(env(safe-area-inset-top) + 0.75rem)', paddingBottom: '0.75rem' }}
        >
          <button
            onClick={() => setDrawerOpen(true)}
            className="p-2 -ml-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <Menu className="h-5 w-5" />
          </button>
          <button onClick={() => setLocation("/")} className="text-primary absolute left-1/2 -translate-x-1/2">
            <Logo className="h-7" textSize="text-sm" />
          </button>
          <div className="flex items-center gap-1">
            <span className="text-xs text-muted-foreground">{user?.username}</span>
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
        <main ref={mainRef} className="flex-1 overflow-y-auto scroll-touch" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
          {/* iOS 스와이프 뒤로가기 인디케이터 */}
          {swipeDx > 0 && (
            <div
              className="fixed left-0 top-1/2 -translate-y-1/2 z-[9999] flex items-center justify-center pointer-events-none"
              style={{ opacity: Math.min(swipeDx / 72, 1), transform: `translateX(${swipeDx - 20}px) translateY(-50%)` }}
            >
              <div className="bg-card/90 border border-border rounded-full p-2 shadow-lg">
                <ChevronLeft className="h-5 w-5 text-foreground" />
              </div>
            </div>
          )}
          <div className="container mx-auto px-4 py-6 max-w-3xl">
            {children}
          </div>
        </main>

      </div>
    </div>
  );
}
