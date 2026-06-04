import { useEffect, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Bell, ChevronRight, X } from "lucide-react";

const PRIORITY: Record<string, { label: string; style: string }> = {
  urgent:    { label: "긴급", style: "bg-red-500/20 text-red-400 border border-red-500/30" },
  important: { label: "중요", style: "bg-amber-500/20 text-amber-400 border border-amber-500/30" },
  normal:    { label: "일반", style: "bg-blue-500/20 text-blue-400 border border-blue-500/30" },
};

export default function NoticeLoginPopup() {
  const utils = trpc.useUtils();
  const { data: me } = trpc.auth.me.useQuery();
  const { data: noticeList } = trpc.gym.work.notices.list.useQuery(undefined, {
    enabled: !!(me && me.role !== "admin" && me.role !== "sub_admin"),
  });
  const markReadMutation = trpc.gym.work.notices.markRead.useMutation({
    onSuccess: () => utils.gym.work.notices.invalidate(),
  });

  const hasShownRef = useRef(false);
  const [visible, setVisible] = useState(false);
  const [index, setIndex] = useState(0);

  const isAdmin = me?.role === "admin" || me?.role === "sub_admin";
  const unread = (noticeList ?? []).filter(n => !n.isRead);

  useEffect(() => {
    if (hasShownRef.current || isAdmin || !me || noticeList === undefined) return;
    hasShownRef.current = true;
    if (unread.length > 0) {
      setIndex(0);
      setVisible(true);
    }
  }, [me, noticeList]);

  if (!visible || index >= unread.length) return null;

  const item = unread[index];
  const pm = PRIORITY[item.notice.priority] ?? PRIORITY.normal;
  const isLast = index === unread.length - 1;

  function handleConfirm() {
    markReadMutation.mutate({ noticeId: item.notice.id });
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
        <div className="p-4 border-t border-border shrink-0 space-y-2">
          <button
            onClick={handleConfirm}
            disabled={markReadMutation.isPending}
            className="w-full bg-primary text-primary-foreground rounded-xl py-3 text-sm font-bold hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            {markReadMutation.isPending ? "처리 중..." : isLast ? "확인 완료" : (
              <>확인 <ChevronRight className="h-4 w-4" /> 다음 ({index + 2}/{unread.length})</>
            )}
          </button>
          <button
            onClick={() => setVisible(false)}
            className="w-full text-xs text-muted-foreground py-1.5 hover:text-foreground transition-colors"
          >
            나중에 확인
          </button>
        </div>
      </div>
    </div>
  );
}
