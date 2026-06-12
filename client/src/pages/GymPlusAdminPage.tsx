import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { GymPlusMembersAdmin, GymPlusVideosAdmin, GymPlusEventsAdmin, GymPlusWorkoutLogsAdmin } from "./gym-plus/GymPlusAdmin";
import GymPlusMessageAdmin from "./gym-plus/GymPlusMessageAdmin";

type Tab = "members" | "videos" | "events" | "logs" | "messages";

const tabs: { key: Tab; label: string; icon: string }[] = [
  { key: "members", label: "회원관리", icon: "◎" },
  { key: "videos", label: "운동영상", icon: "▶" },
  { key: "events", label: "공지", icon: "★" },
  { key: "logs", label: "기록관리", icon: "≡" },
  { key: "messages", label: "메시지", icon: "✉" },
];

const SESSION_KEY = "gymplus_admin_verified";

function AdminLoginGate({ onVerified }: { onVerified: () => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const loginMutation = trpc.gymPlus.adminLogin.useMutation({
    onSuccess: (data) => {
      sessionStorage.setItem(SESSION_KEY, data.username);
      onVerified();
    },
    onError: (err) => toast.error(err.message || "로그인 실패"),
  });

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-1">
          <h1
            style={{ fontFamily: "'Cormorant Garamond', serif", letterSpacing: "0.1em" }}
            className="text-2xl font-semibold text-foreground"
          >
            ZIANTGYM<span className="text-primary">+</span>
          </h1>
          <p className="text-sm text-muted-foreground">관리자 로그인</p>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            loginMutation.mutate({ username, password });
          }}
          className="space-y-3"
        >
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="아이디"
            className="w-full px-4 py-3 rounded-xl bg-card border border-border text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            autoComplete="username"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="비밀번호"
            className="w-full px-4 py-3 rounded-xl bg-card border border-border text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            autoComplete="current-password"
          />
          <button
            type="submit"
            disabled={loginMutation.isPending || !username || !password}
            className="w-full py-3 rounded-xl bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50 transition-opacity"
          >
            {loginMutation.isPending ? "확인 중..." : "로그인"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function GymPlusAdminPage() {
  const [verified, setVerified] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("members");

  useEffect(() => {
    if (sessionStorage.getItem(SESSION_KEY)) setVerified(true);
  }, []);

  if (!verified) {
    return <AdminLoginGate onVerified={() => setVerified(true)} />;
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="bg-card border-b border-border px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <span
          style={{ fontFamily: "'Cormorant Garamond', serif", letterSpacing: "0.1em" }}
          className="text-xl font-semibold text-foreground"
        >
          ZIANTGYM<span className="text-primary">+</span>
        </span>
        <button
          onClick={() => { sessionStorage.removeItem(SESSION_KEY); setVerified(false); }}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          로그아웃
        </button>
      </header>

      <main className="flex-1 overflow-y-auto pb-20 max-w-2xl w-full mx-auto">
        <div className="p-4">
          {activeTab === "members" && <GymPlusMembersAdmin />}
          {activeTab === "videos" && <GymPlusVideosAdmin />}
          {activeTab === "events" && <GymPlusEventsAdmin />}
          {activeTab === "logs" && <GymPlusWorkoutLogsAdmin />}
          {activeTab === "messages" && <GymPlusMessageAdmin />}
        </div>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border z-10">
        <div className="max-w-2xl mx-auto flex">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 flex flex-col items-center py-2.5 gap-0.5 transition-colors ${
                activeTab === tab.key ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <span className="text-base leading-none">{tab.icon}</span>
              <span className="text-[10px] leading-none">{tab.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
