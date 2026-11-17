import { useState } from "react";
import { useLocation, useSearch } from "wouter";
import { trpc } from "@/lib/trpc";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { CheckCircle, Clock, XCircle, MoreHorizontal } from "lucide-react";
import TabBanner from "@/components/TabBanner";
import { useClassCheck, type CheckStatus } from "@/hooks/useClassCheck";

function todayStr() {
  return new Date(Date.now() + 9 * 3600000).toISOString().split("T")[0];
}

function formatDateLabel(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return format(d, "yyyy. MM. dd. EEEE", { locale: ko });
}

const STATUS_UI: Record<CheckStatus, { label: string; icon: React.ReactNode; cls: string }> = {
  attended: { label: "수업 완료", icon: <CheckCircle className="h-4 w-4" />, cls: "text-green-500" },
  noshow: { label: "노쇼", icon: <XCircle className="h-4 w-4" />, cls: "text-red-500" },
  cancelled: { label: "캔슬", icon: <Clock className="h-4 w-4" />, cls: "text-amber-600" },
};

type Row = { id: number; name: string; remaining: number | null; check: { status: string } | null };

export default function AttendancePage() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const [selectedDate, setSelectedDate] = useState(new URLSearchParams(search).get("date") ?? todayStr());
  const [menuFor, setMenuFor] = useState<Row | null>(null);
  const { checkClass, undoCheck, pending, hasSessions } = useClassCheck();

  const { data: members } = trpc.attendanceChecks.listByDate.useQuery({ date: selectedDate });
  const { data: recent } = trpc.attendanceChecks.recentSummary.useQuery();

  const doneCount = members?.filter((m) => m.check?.status === "attended").length ?? 0;

  return (
    <div className="space-y-4">
      <TabBanner tabKey="attendance" />
      <div className="flex items-baseline justify-between">
        <h1 className="text-lg font-bold">수업 체크</h1>
        <span className="text-xs text-muted-foreground tabular-nums">완료 {doneCount}명</span>
      </div>

      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">{formatDateLabel(selectedDate)}</p>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
          className="bg-card border border-border rounded-lg px-3 py-2 text-sm text-foreground"
        />
      </div>

      <div className="space-y-1.5">
        {!members?.length && (
          <p className="text-center text-sm text-muted-foreground py-8">담당 활성 회원이 없습니다.</p>
        )}
        {members?.map((m) => {
          const st = (m.check?.status ?? null) as CheckStatus | null;
          const ui = st ? STATUS_UI[st] : null;
          return (
            <div
              key={m.id}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-colors ${
                st === "attended" ? "bg-primary/5 border-primary/30" : "bg-card border-border"
              }`}
            >
              <button
                onClick={() => setLocation(`/members/${m.id}`)}
                className="flex items-center gap-3 flex-1 min-w-0 text-left"
              >
                <div className="h-9 w-9 rounded-full bg-primary/15 flex items-center justify-center text-primary font-semibold text-sm shrink-0">
                  {m.name.charAt(0)}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{m.name}</p>
                  {hasSessions && m.remaining !== null && (
                    <p className="text-[12px] text-muted-foreground tabular-nums">잔여 {m.remaining}회</p>
                  )}
                </div>
              </button>

              {ui ? (
                <span className={`flex items-center gap-1 text-xs font-semibold shrink-0 ${ui.cls}`}>
                  {ui.icon}{ui.label}
                </span>
              ) : (
                <Button
                  size="sm"
                  className="shrink-0 h-9 px-4"
                  disabled={pending}
                  onClick={() => checkClass(m.id, selectedDate)}
                >
                  수업 체크
                </Button>
              )}
              <button
                onClick={() => setMenuFor(m as Row)}
                className="p-1.5 -mr-1 rounded-lg text-muted-foreground hover:bg-accent/50 shrink-0"
                aria-label={`${m.name} 다른 처리`}
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>

      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">최근 수업 기록</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {!recent?.length && (
            <p className="text-sm text-muted-foreground text-center py-4">수업 기록이 없습니다.</p>
          )}
          {recent?.map((r) => (
            <div key={r.date} className="flex items-center justify-between py-2 border-b border-border last:border-0">
              <p className="text-sm">{formatDateLabel(r.date)}</p>
              <p className="text-sm font-medium text-primary tabular-nums">{r.count}명</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Dialog open={!!menuFor} onOpenChange={(v) => !v && setMenuFor(null)}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle>{menuFor?.name}</DialogTitle>
            <DialogDescription>{formatDateLabel(selectedDate)}</DialogDescription>
          </DialogHeader>
          {menuFor && (() => {
            const st = (menuFor.check?.status ?? null) as CheckStatus | null;
            const act = (fn: () => void) => { fn(); setMenuFor(null); };
            return (
              <div className="grid gap-2">
                {st !== "attended" && (
                  <Button onClick={() => act(() => checkClass(menuFor.id, selectedDate, "attended"))}>수업 체크</Button>
                )}
                {st !== "noshow" && (
                  <Button variant="outline" onClick={() => act(() => checkClass(menuFor.id, selectedDate, "noshow", false))}>
                    노쇼 (차감 안 함)
                  </Button>
                )}
                {st !== "noshow" && hasSessions && (
                  <Button variant="outline" onClick={() => act(() => checkClass(menuFor.id, selectedDate, "noshow", true))}>
                    노쇼 (1회 차감)
                  </Button>
                )}
                {st !== "cancelled" && (
                  <Button variant="outline" onClick={() => act(() => checkClass(menuFor.id, selectedDate, "cancelled"))}>
                    캔슬
                  </Button>
                )}
                {st && (
                  <Button variant="ghost" className="text-red-500" onClick={() => act(() => undoCheck(menuFor.id, selectedDate))}>
                    체크 취소
                  </Button>
                )}
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
