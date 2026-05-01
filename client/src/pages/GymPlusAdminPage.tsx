import { useState } from "react";
import { GymPlusMembersAdmin, GymPlusVideosAdmin, GymPlusEventsAdmin, GymPlusWorkoutLogsAdmin } from "./gym-plus/GymPlusAdmin";

type Tab = "members" | "videos" | "events" | "logs";

const tabs: { key: Tab; label: string; icon: string }[] = [
  { key: "members", label: "회원관리", icon: "◎" },
  { key: "videos", label: "운동영상", icon: "▶" },
  { key: "events", label: "공지", icon: "★" },
  { key: "logs", label: "기록관리", icon: "≡" },
];

export default function GymPlusAdminPage() {
  const [activeTab, setActiveTab] = useState<Tab>("members");

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* 헤더 */}
      <header className="bg-card border-b border-border px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <span
          style={{ fontFamily: "'Cormorant Garamond', serif", letterSpacing: "0.1em" }}
          className="text-xl font-semibold text-foreground"
        >
          ZIANTGYM<span className="text-primary">+</span>
        </span>
        <button
          onClick={() => { window.location.href = "/"; }}
          className="text-xs text-muted-foreground border border-border rounded px-2 py-1 hover:text-foreground transition-colors"
        >
          통합관리 →
        </button>
      </header>

      {/* 콘텐츠 */}
      <main className="flex-1 overflow-y-auto pb-20 max-w-2xl w-full mx-auto">
        <div className="p-4">
          {activeTab === "members" && <GymPlusMembersAdmin />}
          {activeTab === "videos" && <GymPlusVideosAdmin />}
          {activeTab === "events" && <GymPlusEventsAdmin />}
          {activeTab === "logs" && <GymPlusWorkoutLogsAdmin />}
        </div>
      </main>

      {/* 하단 탭 */}
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
