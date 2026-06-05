import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Bell, CheckCircle2, ChevronRight, X } from "lucide-react";

const PRIORITY: Record<string, { label: string; style: string }> = {
  urgent:    { label: "긴급", style: "bg-red-500/20 text-red-400 border border-red-500/30" },
  important: { label: "중요", style: "bg-amber-500/20 text-amber-400 border border-amber-500/30" },
  normal:    { label: "일반", style: "bg-blue-500/20 text-blue-400 border border-blue-500/30" },
};

const DASHBOARD_PATHS = ["/", "/my-work"];

export default function NoticeLoginPopup() {
  const utils = trpc.useUtils();
  const [location] = useLocation();
  const { data: me } = trpc.auth.me.useQuery();
  const { data: noticeList } = trpc.gym.work.notices.list.useQuery(undefined, {
    enabled: !!(me && me.role !== "admin" && me.role !== "sub_admin"),
  });
  const markCompleteMutation = trpc.gym.work.notices.markComplete.useMutation({
    onSuccess: () => utils.gym.work.notices.invalidate(),
  });

  const shownForVisitRef = useRef(false);
  const [visible, setVisible] = useState(false);
  const [index, setIndex] = useState(0);

  const isAdmin = me?.role === "admin" || me?.role === "sub_admin";
  const unread = (noticeList ?? []).filter((n: any) => !n.isCompleted);
  const isOnDashboard = DASHBOARD_PATHS.includes(location);

  // Reset shown flag when user leaves the dashboard so the popup re-triggers on return
  useEffect(() => {
    if (!isOnDashboard) shownForVisitRef.current = false;
  }, [isOnDashboard]);

  // Show popup when user arrives on dashboard with uncompleted notices
  useEffect(() => {
    if (isAdmin || !me || noticeList === undefined) return;
    if (!isOnDashboard || shownForVisitRef.current) return;
    if (unread.length > 0) {
      shownForVisitRef.current = true;
      setIndex(0);
      setVisible(true);
    }
  }, [isOnDashboard, me, noticeList, isAdmin]);

  if (!visible || index >= unread.length) return null;

  const item = unread[index];
  const pm = PRIORITY[item.notice.priority] ?? PRIORITY.normal;
  const isLast = index === unread.length - 1;

  function handleConfirmOnly() {
    if (isLast) setVisible(false);
    else setIndex(i => i + 1);
  }

  function handleComplete() {
    markCompleteMutation.mutate({ noticeId: item.notice.id });
    if (isLast) setVisible(false);
    else setIndex(i => i + 1);
  }

  return (
    <div className="fixed inset-0 z-[9999] bg-black/70 flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-md flex flex-col shadow-2xl" style={{ maxHeight: "80svh" }}>

        {/* 헤더 */}
        <div className="px-5 pt-5 pb-4 border-b border-border shrink-0">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold text-foreground">새 공지사항</span>
            </div>
            <div className="flex items-center gap-3">
              {unread.length > 1 && (
                <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                  {index + 1} / {unread.length}
                </span>
              )}
              <button onClick={() => setVisible(false)} className="text-muted-foreground hover:text-foreground transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="flex items-start gap-2 flex-wrap">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${pm.style}`}>{pm.label}</span>
            <h3 className="font-semibold text-foreground leading-snug">{item.notice.title}</h3>
          </div>
          <p className="text-xs text-muted-foreground mt-1.5">
            {item.authorName ?? "관리자"} · {item.notice.createdAt?.substring(0, 10)}
          </p>
        </div>

        {/* 내용 */}
        <div className="overflow-y-auto flex-1 px-5 py-4">
          <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{item.notice.content}</p>
        </div>

        {/* 버튼 */}
        <div className="p-4 border-t border-border shrink-0 flex gap-2">
          <button
            onClick={handleConfirmOnly}
            className="flex-1 bg-accent text-foreground rounded-xl py-3 text-sm font-medium hover:bg-accent/80 flex items-center justify-center gap-1.5"
          >
            {isLast ? "확인 완료" : <><ChevronRight className="h-4 w-4" />다음 ({index + 2}/{unread.length})</>}
          </button>
          <button
            onClick={handleComplete}
            disabled={markCompleteMutation.isPending}
            className="flex-1 bg-primary text-primary-foreground rounded-xl py-3 text-sm font-bold hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            <CheckCircle2 className="h-4 w-4" />
            {markCompleteMutation.isPending ? "처리 중..." : "업무 완료"}
          </button>
        </div>
      </div>
    </div>
  );
}
