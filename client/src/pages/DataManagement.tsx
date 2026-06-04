import { Database } from "lucide-react";

export default function DataManagementPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold flex items-center gap-2">
        <Database className="h-5 w-5 text-primary" />
        데이터 관리
      </h1>
      <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
        <Database className="h-12 w-12 mb-4 opacity-20" />
        <p className="text-sm">준비 중입니다</p>
      </div>
    </div>
  );
}
