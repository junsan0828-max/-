import { useState } from "react";
import { GymPlusMembersAdmin, GymPlusVideosAdmin, GymPlusEventsAdmin, GymPlusWorkoutLogsAdmin } from "./gym-plus/GymPlusAdmin";

type Tab = "members" | "videos" | "events" | "logs";

const tabs: { key: Tab; label: string; icon: string; desc: string }[] = [
  { key: "members", label: "회원관리", icon: "◎", desc: "짐+ 회원 목록 및 동기화" },
  { key: "videos", label: "운동영상", icon: "▶", desc: "영상 카테고리 및 업로드" },
  { key: "events", label: "공지 / 이벤트", icon: "★", desc: "이벤트 및 공지 관리" },
  { key: "logs", label: "운동기록", icon: "≡", desc: "회원 운동기록 열람 / 영상 연결" },
];

export default function GymPlusAdminPage() {
  const [activeTab, setActiveTab] = useState<Tab>("members");
  const active = tabs.find(t => t.key === activeTab)!;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* ── 헤더 ── */}
      <header className="bg-card border-b border-border px-4 md:px-8 py-3 flex items-center justify-between sticky top-0 z-20">
        <span
          style={{ fontFamily: "'Cormorant Garamond', serif", letterSpacing: "0.1em" }}
          className="text-xl font-semibold text-foreground"
        >
          ZIANTGYM<span className="text-primary">+</span>
          <span className="ml-2 text-xs font-sans font-normal text-muted-foreground tracking-normal">관리자</span>
        </span>
        {/* 현재 탭 표시 (PC 전용) */}
        <div className="hidden md:flex items-center gap-2">
          <span className="text-sm text-muted-foreground">{active.icon}</span>
          <span className="text-sm font-medium text-foreground">{active.label}</span>
          <span className="text-xs text-muted-foreground">— {active.desc}</span>
        </div>
      </header>

      {/* ── PC 레이아웃 (md 이상) ── */}
      <div className="hidden md:flex flex-1 overflow-hidden">
        {/* 사이드바 */}
        <aside className="w-56 bg-card border-r border-border flex flex-col py-6 gap-1 flex-shrink-0">
          <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider px-5 mb-2">메뉴</p>
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-3 px-5 py-3 text-sm font-medium transition-colors text-left ${
                activeTab === tab.key
                  ? "bg-primary/10 text-primary border-r-2 border-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              }`}
            >
              <span className="text-base w-5 text-center flex-shrink-0">{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </aside>

        {/* 메인 콘텐츠 */}
        <main className="flex-1 overflow-y-auto">
          <div className="p-6 max-w-5xl">
            <div className="mb-5">
              <h1 className="text-lg font-bold text-foreground">{active.label}</h1>
              <p className="text-xs text-muted-foreground mt-0.5">{active.desc}</p>
            </div>
            {activeTab === "members" && <GymPlusMembersAdmin />}
            {activeTab === "videos" && <GymPlusVideosAdmin />}
            {activeTab === "events" && <GymPlusEventsAdmin />}
            {activeTab === "logs" && <GymPlusWorkoutLogsAdmin />}
          </div>
        </main>
      </div>

      {/* ── 모바일 레이아웃 (md 미만) ── */}
      <div className="flex md:hidden flex-1 flex-col overflow-hidden">
        <main className="flex-1 overflow-y-auto pb-20">
          <div className="p-4 max-w-2xl w-full mx-auto">
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
    </div>
  );
}
