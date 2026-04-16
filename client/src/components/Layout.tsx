import { useLocation } from "wouter";
import { trpc } from "../lib/trpc";
import { toast } from "sonner";
import {
  LayoutDashboard, Users, Dumbbell, LogOut,
  Menu, X, UserCog, Settings, User,
} from "lucide-react";
import { useState } from "react";

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const { data: user } = trpc.auth.me.useQuery();
  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => window.location.reload(),
    onError: () => toast.error("로그아웃 실패"),
  });

  const adminNavItems = [
    { path: "/", label: "대시보드", icon: LayoutDashboard },
    { path: "/trainers", label: "트레이너", icon: UserCog },
    { path: "/admin", label: "관리", icon: Settings },
  ];

  const trainerNavItems = [
    { path: "/", label: "대시보드", icon: LayoutDashboard },
    { path: "/members", label: "회원 관리", icon: Users },
    { path: "/pt", label: "PT 관리", icon: Dumbbell },
    { path: "/profile", label: "내 프로필", icon: User },
  ];

  const navItems = user?.role === "admin" ? adminNavItems : trainerNavItems;

  const isActive = (path: string) => {
    if (path === "/") return location === "/";
    return location.startsWith(path);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* 상단 네비게이션 바 */}
      <header className="sticky top-0 z-50 bg-card border-b border-border px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button className="md:hidden text-muted-foreground hover:text-foreground" onClick={() => setMenuOpen(!menuOpen)}>
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <button onClick={() => setLocation("/")} className="font-bold text-primary text-lg">
            💪 트레이너앱
          </button>
        </div>

        {/* 데스크탑 네비게이션 */}
        <nav className="hidden md:flex items-center gap-1">
          {navItems.map((item) => (
            <button key={item.path} onClick={() => setLocation(item.path)}
              className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                isActive(item.path) ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-accent"
              }`}>
              <item.icon className="h-4 w-4" />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground hidden sm:block">
            {user?.username}
            {user?.role === "admin" && <span className="ml-1 text-primary">(관리자)</span>}
          </span>
          <button onClick={() => logoutMutation.mutate()}
            className="text-muted-foreground hover:text-foreground p-2 rounded-md hover:bg-accent transition-colors">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* 모바일 메뉴 */}
      {menuOpen && (
        <div className="md:hidden bg-card border-b border-border px-4 pb-3">
          {navItems.map((item) => (
            <button key={item.path} onClick={() => { setLocation(item.path); setMenuOpen(false); }}
              className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-md text-sm transition-colors mb-1 ${
                isActive(item.path) ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-accent"
              }`}>
              <item.icon className="h-4 w-4" />
              {item.label}
            </button>
          ))}
        </div>
      )}

      <main className="flex-1 container mx-auto px-4 py-6 max-w-3xl">
        {children}
      </main>
    </div>
  );
}
