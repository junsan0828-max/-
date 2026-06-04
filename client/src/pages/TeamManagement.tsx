import { useState } from "react";
import TrainingManual from "./TrainingManual";
import { WorkManagementSection, NoticeManagementSection } from "./WorkManagement";

type Tab = "manual" | "tasks" | "notices";

export default function TeamManagementPage() {
  const [tab, setTab] = useState<Tab>("manual");

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">팀관리</h1>
      <div className="flex gap-1 bg-accent/20 p-1 rounded-lg">
        {([
          ["manual", "교육 매뉴얼"],
          ["tasks", "업무 관리"],
          ["notices", "공지사항 관리"],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex-1 py-2 text-sm rounded-md transition-colors font-medium ${
              tab === key ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "manual" && <TrainingManual />}
      {tab === "tasks" && <WorkManagementSection />}
      {tab === "notices" && <NoticeManagementSection />}
    </div>
  );
}
