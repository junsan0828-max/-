import { type ReactNode, useEffect } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";

const DESK_PHONE = "010-0000-0000";

function ExpiredModal({ memberName, endDate }: { memberName?: string; endDate?: string }) {
  return (
    <div className="fixed inset-0 z-[300] bg-black/80 flex items-center justify-center p-6">
      <div className="bg-card border border-border rounded-2xl w-full max-w-sm overflow-hidden">
        <div className="bg-red-500/10 border-b border-red-500/20 px-5 py-4 text-center">
          <p className="text-3xl mb-2">🔒</p>
          <h2 className="font-bold text-lg text-foreground">회원권이 만료되었습니다</h2>
          {memberName && <p className="text-sm text-muted-foreground mt-0.5">{memberName}님</p>}
        </div>
        <div className="p-5 space-y-4">
          {endDate && (
            <div className="bg-muted/40 rounded-xl px-4 py-3 text-center">
              <p className="text-xs text-muted-foreground">만료일</p>
              <p className="font-semibold text-sm mt-0.5 text-red-400">{endDate.slice(0, 10).replace(/-/g, ".")}</p>
            </div>
          )}
          <p className="text-sm text-muted-foreground text-center leading-relaxed">
            회원권 재등록 후 서비스를 이용하실 수 있습니다.<br />
            데스크에 문의하시거나 전화로 연락해 주세요.
          </p>
          <a
            href={`tel:${DESK_PHONE}`}
            className="flex items-center justify-center gap-2 w-full bg-primary text-primary-foreground rounded-xl py-3 text-sm font-semibold"
          >
            <span>📞</span> 데스크 문의하기
          </a>
          <p className="text-center text-xs text-muted-foreground">{DESK_PHONE}</p>
        </div>
      </div>
    </div>
  );
}

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
  const { data: member } = trpc.gymPlus.memberMe.useQuery();
  const { data: unreadCount } = trpc.gymPlus.unreadMessageCount.useQuery(undefined, { refetchInterval: 30000 });

  const isExpired = (() => {
    if (!member?.membershipEnd) return false;
    return new Date(member.membershipEnd).getTime() < Date.now();
  })();

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

      {/* 만료 회원 차단 모달 */}
      {isExpired && (
        <ExpiredModal memberName={member?.name ?? undefined} endDate={member?.membershipEnd ?? undefined} />
      )}

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
