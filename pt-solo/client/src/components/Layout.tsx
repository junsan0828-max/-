import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "../lib/trpc";
import { toast } from "sonner";
import {
  LayoutDashboard, Dumbbell, LogOut,
  User, ClipboardCheck, Download, X, ShieldCheck, Bell,
  UserPlus, TrendingUp, Wrench, Zap, Coins, UserCog, Menu, GraduationCap, BookOpen,
} from "lucide-react";
import ProfileSetupModal from "./ProfileSetupModal";
import OnboardingSurveyModal from "./OnboardingSurveyModal";
import BasicInfoModal from "./BasicInfoModal";

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const { data: user } = trpc.auth.me.useQuery();
  const { data: profile } = trpc.trainers.getMyProfile.useQuery(undefined, { enabled: user?.role === "trainer" });
  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => window.location.reload(),
    onError: () => toast.error("로그아웃 실패"),
  });

  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [surveyDone, setSurveyDone] = useState(false);
  const [basicInfoDone, setBasicInfoDone] = useState(false);

  const needsBasicInfo = user?.role === "trainer"
    && profile !== undefined
    && !(profile as any).phone
    && !basicInfoDone;

  const showSurvey = user?.role === "trainer"
    && profile !== undefined
    && !(profile as any).onboardingSurveyDone
    && !surveyDone
    && !needsBasicInfo;

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

  const JOB_LABELS: Record<string, string> = {
    "퍼스널트레이너": "퍼스널트레이너",
    "필라테스강사": "필라테스강사",
    "트레이너 준비생": "트레이너 준비생",
    "센터 운영자": "센터 운영자",
    "프리랜서": "프리랜서",
    "학생": "학생",
  };
  const jobLabel = isAdmin ? "운영자" : (JOB_LABELS[(user as any)?.jobType ?? ""] ?? "트레이너");

  const adminNavItems = [
    { path: "/", label: "운영 현황", icon: LayoutDashboard },
    { path: "/admin/registrations", label: "가입 관리", icon: UserCog },
    { path: "/admin/trainers", label: "트레이너 관리", icon: ShieldCheck },
    { path: "/admin/points", label: "포인트 관리", icon: Coins },
    { path: "/admin/notices", label: "공지/배너", icon: Bell },
    { path: "/admin/fit-step-plus", label: "FIT STEP+", icon: Zap },
    { path: "/academy", label: "성장아카데미 관리", icon: GraduationCap },
    { path: "/workshop", label: "작업실", icon: Wrench },
  ];

  const trainerNavItems = [
    { path: "/", label: "대시보드", icon: LayoutDashboard },
    { path: "/attendance", label: "출석 체크", icon: ClipboardCheck },
    { path: "/sessions", label: "수업 관리", icon: BookOpen },
    { path: "/pt", label: "회원 관리", icon: Dumbbell },
    { path: "/leads", label: "상담실", icon: UserPlus },
    { path: "/workshop", label: "작업실", icon: Wrench },
    { path: "/settlement", label: "성장분석실", icon: TrendingUp },
    { path: "/academy", label: "성장 아카데미", icon: GraduationCap },
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
            <span className="text-2xl tracking-wider" style={{ fontFamily: "'Bebas Neue', 'Arial Black', Arial, sans-serif", letterSpacing: "0.12em" }}>FIT</span>
            <span className="text-2xl tracking-wider text-primary" style={{ fontFamily: "'Bebas Neue', 'Arial Black', Arial, sans-serif", letterSpacing: "0.12em" }}>STEP</span>
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
            <p className="text-xs text-muted-foreground">{jobLabel}</p>
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

      {/* 모바일 사이드바 오버레이 */}
      {sidebarOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          {/* 배경 딤 */}
          <div className="absolute inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          {/* 사이드바 */}
          <aside className="relative w-64 h-full bg-card flex flex-col shadow-2xl">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <button onClick={() => { setLocation("/"); setSidebarOpen(false); }} className="flex items-center gap-1">
                <span className="text-xl tracking-wider" style={{ fontFamily: "'Bebas Neue', 'Arial Black', Arial, sans-serif", letterSpacing: "0.12em" }}>FIT</span>
                <span className="text-xl tracking-wider text-primary" style={{ fontFamily: "'Bebas Neue', 'Arial Black', Arial, sans-serif", letterSpacing: "0.12em" }}>STEP</span>
              </button>
              <button onClick={() => setSidebarOpen(false)} className="text-muted-foreground p-1">
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
              {navItems.map((item) => (
                <button
                  key={item.path}
                  onClick={() => { setLocation(item.path); setSidebarOpen(false); }}
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
                <p className="text-xs text-muted-foreground">{jobLabel}</p>
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
        </div>
      )}

      <div className="flex flex-col flex-1 min-w-0">
        {/* 모바일 상단 바 */}
        <header className="md:hidden sticky top-0 z-40 bg-card border-b border-border px-4 py-3 flex items-center justify-between shrink-0">
          <button onClick={() => setSidebarOpen(true)} className="text-muted-foreground hover:text-foreground p-1 -ml-1">
            <Menu className="h-5 w-5" />
          </button>
          <button onClick={() => setLocation("/")} className="flex items-center gap-1 absolute left-1/2 -translate-x-1/2">
            <span className="text-xl tracking-wider" style={{ fontFamily: "'Bebas Neue', 'Arial Black', Arial, sans-serif", letterSpacing: "0.12em" }}>FIT</span>
            <span className="text-xl tracking-wider text-primary" style={{ fontFamily: "'Bebas Neue', 'Arial Black', Arial, sans-serif", letterSpacing: "0.12em" }}>STEP</span>
          </button>
          <span className="text-xs text-muted-foreground">{user?.username}</span>
        </header>

        {showInstallBanner && (
          <div className="md:hidden bg-primary/10 border-b border-primary/20 px-4 py-2.5 flex items-center gap-3 shrink-0">
            <Download className="h-4 w-4 text-primary shrink-0" />
            <p className="text-xs text-foreground flex-1">홈 화면에 FIT STEP을 추가하세요</p>
            <button onClick={handleInstall} className="text-xs font-medium text-primary bg-primary/20 px-2.5 py-1 rounded-md shrink-0">설치</button>
            <button onClick={dismissBanner} className="text-muted-foreground"><X className="h-4 w-4" /></button>
          </div>
        )}

        <main className="flex-1 overflow-y-auto">
          <div className="container mx-auto px-4 py-6 max-w-3xl">
            {children}
          </div>
        </main>
        {!isAdmin && !needsBasicInfo && !showSurvey && <ProfileSetupModal />}
        {needsBasicInfo && (
          <BasicInfoModal
            currentName={(profile as any)?.trainerName ?? ""}
            onClose={() => setBasicInfoDone(true)}
          />
        )}
        {showSurvey && <OnboardingSurveyModal required onClose={() => setSurveyDone(true)} />}
      </div>
    </div>
  );
}
