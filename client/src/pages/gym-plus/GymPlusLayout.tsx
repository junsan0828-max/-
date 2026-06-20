import { type ReactNode, useEffect } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";

const navItems = [
  { path: "/gym-plus", label: "홈", icon: "⊞" },
  { path: "/gym-plus/videos", label: "운동영상", icon: "▶" },
  { path: "/gym-plus/events", label: "이벤트", icon: "★" },
  { path: "/gym-plus/workout", label: "운동기록", icon: "◎" },
  { path: "/gym-plus/messages", label: "메시지", icon: "✉", badge: true },
  { path: "/gym-plus/profile", label: "내정보", icon: "◈" },
];

async function registerPush() {
  try {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    const reg = await navigator.serviceWorker.register("/sw.js");
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return;
    // VAPID 공개키 가져오기
    const vapidRes = await fetch("/trpc/gymPlus.getVapidPublicKey");
    const vapidJson = await vapidRes.json();
    const vapidKey = vapidJson?.result?.data;
    if (!vapidKey) return;
    const existing = await reg.pushManager.getSubscription();
    let sub = existing;
    if (!sub) {
      const raw = vapidKey.replace(/-/g, "+").replace(/_/g, "/");
      const padded = raw.padEnd(raw.length + (4 - raw.length % 4) % 4, "=");
      const keyBytes = Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
      sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes });
    }
    const { endpoint, keys } = sub.toJSON() as any;
    await fetch("/trpc/gymPlus.savePushSubscription", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ "0": { endpoint, p256dh: keys.p256dh, auth: keys.auth } }),
    });
  } catch {}
}

export default function GymPlusLayout({ children }: { children: ReactNode }) {
  const [location, navigate] = useLocation();
  const utils = trpc.useUtils();
  const { data: unreadCount } = trpc.gymPlus.unreadMessageCount.useQuery(undefined, { refetchInterval: 30000 });

  useEffect(() => { registerPush(); }, []);

  const logoutMutation = trpc.gymPlus.memberLogout.useMutation({
    onSuccess: () => {
      utils.gymPlus.memberMe.invalidate();
      navigate("/gym-plus/login");
    },
  });

  return (
    <div className="min-h-screen bg-background flex flex-col max-w-md mx-auto">
      {/* 상단 헤더 */}
      <header className="bg-card border-b border-border px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <span style={{ fontFamily: "'Cormorant Garamond', serif", letterSpacing: "0.1em" }} className="text-lg font-semibold text-foreground">
          ZIANTGYM<span className="text-primary">+</span>
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="text-xs text-muted-foreground h-7 px-2"
          onClick={() => logoutMutation.mutate()}
        >
          로그아웃
        </Button>
      </header>

      {/* 콘텐츠 */}
      <main className="flex-1 overflow-y-auto pb-20">
        {children}
      </main>

      {/* 하단 네비게이션 */}
      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-card border-t border-border z-10">
        <div className="flex">
          {navItems.map((item) => {
            const isActive = location === item.path || (item.path !== "/gym-plus" && location.startsWith(item.path));
            const showBadge = item.badge && unreadCount && unreadCount > 0;
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`flex-1 flex flex-col items-center py-2 gap-0.5 text-xs transition-colors ${
                  isActive ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <span className="text-base leading-none relative">
                  {item.icon}
                  {showBadge && (
                    <span className="absolute -top-1 -right-2 min-w-[14px] h-3.5 rounded-full bg-red-500 text-[9px] text-white flex items-center justify-center px-0.5">
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  )}
                </span>
                <span className="text-[10px] leading-none">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
