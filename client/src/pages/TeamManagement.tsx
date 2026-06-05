import { useState } from "react";
import TrainingManual from "./TrainingManual";
import { WorkManagementSection, NoticeManagementSection, DataFieldManagementSection } from "./WorkManagement";

type Tab = "manual" | "tasks" | "notices" | "datafields";

export default function TeamManagementPage() {
  const [tab, setTab] = useState<Tab>("manual");

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">팀관리</h1>
      <div className="grid grid-cols-2 gap-1 bg-accent/20 p-1 rounded-lg">
        {([
          ["manual", "교육 매뉴얼"],
          ["tasks", "업무 관리"],
          ["notices", "공지사항 관리"],
          ["datafields", "데이터 항목"],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`py-2 text-sm rounded-md transition-colors font-medium ${
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
      {tab === "datafields" && <DataFieldManagementSection />}
    </div>
  );
}
