import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, Clock, XCircle } from "lucide-react";
import TabBanner from "@/components/TabBanner";

function todayStr() {
  return new Date().toISOString().split("T")[0];
}

function formatDateLabel(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return format(d, "yyyy. MM. dd. EEEE", { locale: ko });
}

const statusIcon = {
  attended: <CheckCircle className="h-4 w-4 text-green-400" />,
  noshow: <XCircle className="h-4 w-4 text-red-400" />,
  cancelled: <Clock className="h-4 w-4 text-yellow-400" />,
};
const statusLabel = { attended: "출석", noshow: "노쇼", cancelled: "캔슬" };
const statusColor = {
  attended: "text-green-400",
  noshow: "text-red-400",
  cancelled: "text-yellow-400",
};

export default function AttendancePage() {
  const [, setLocation] = useLocation();
  const [selectedDate, setSelectedDate] = useState(todayStr());

  const { data: members, refetch } = trpc.attendanceChecks.listByDate.useQuery({ date: selectedDate });
  const { data: recent } = trpc.attendanceChecks.recentSummary.useQuery();

  return (
    <div className="space-y-4">
      <TabBanner tabKey="attendance" />
      <h1 className="text-lg font-bold">출석 체크</h1>

      {/* 날짜 선택 */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{formatDateLabel(selectedDate)}</p>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="bg-card border border-border rounded-lg px-3 py-2 text-sm text-foreground"
        />
      </div>

      {/* 회원 리스트 */}
      <div className="space-y-1.5">
        {!members?.length && (
          <p className="text-center text-sm text-muted-foreground py-8">담당 활성 회원이 없습니다.</p>
        )}
        {members?.map((m) => {
          const check = m.check;
          const isChecked = !!check;
          const st = (check?.status ?? null) as "attended" | "noshow" | "cancelled" | null;

          return (
            <button
              key={m.id}
              onClick={() => setLocation(`/attendance/${m.id}?date=${selectedDate}`)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors text-left ${
                isChecked
                  ? "bg-primary/10 border-primary/40"
                  : "bg-card border-border hover:border-primary/40"
              }`}
            >
              <div className="h-9 w-9 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                {m.name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{m.name}</p>
                {m.remaining !== null && (
                  <p className="text-[11px] text-muted-foreground mt-0.5">잔여 {m.remaining}회</p>
                )}
              </div>
              {isChecked && st ? (
                <div className={`flex items-center gap-1 text-xs font-semibold shrink-0 ${statusColor[st]}`}>
                  {statusIcon[st]}
                  {statusLabel[st]}
                </div>
              ) : (
                <p className="text-xs text-primary shrink-0">출석하기 →</p>
              )}
            </button>
          );
        })}
      </div>

      {/* 최근 출석 기록 */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">최근 출석 기록</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {!recent?.length && (
            <p className="text-sm text-muted-foreground text-center py-4">출석 기록이 없습니다.</p>
          )}
          {recent?.map((r) => (
            <div key={r.date} className="flex items-center justify-between py-2 border-b border-border last:border-0">
              <p className="text-sm">{formatDateLabel(r.date)}</p>
              <p className="text-sm font-medium text-primary">{r.count}명</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
