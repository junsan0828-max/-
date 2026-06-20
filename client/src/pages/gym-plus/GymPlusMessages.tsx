import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Bell, ChevronDown, ChevronUp } from "lucide-react";

export default function GymPlusMessages() {
  const utils = trpc.useUtils();
  const { data: messages, isLoading } = trpc.gymPlus.listMessages.useQuery();
  const markRead = trpc.gymPlus.markMessageRead.useMutation({
    onSuccess: () => { utils.gymPlus.listMessages.invalidate(); utils.gymPlus.unreadMessageCount.invalidate(); },
  });
  const [expandedId, setExpandedId] = useState<number | null>(null);

  function toggle(id: number, isRead: number) {
    if (expandedId === id) { setExpandedId(null); return; }
    setExpandedId(id);
    if (!isRead) markRead.mutate({ messageId: id });
  }

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center gap-2 mb-2">
        <Bell className="h-5 w-5 text-primary" />
        <h1 className="text-lg font-bold">메시지함</h1>
      </div>

      {isLoading && <p className="text-center text-muted-foreground py-10 text-sm">불러오는 중...</p>}
      {!isLoading && (!messages || messages.length === 0) && (
        <div className="flex flex-col items-center justify-center py-16 gap-2 text-center">
          <Bell className="h-10 w-10 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">받은 메시지가 없습니다</p>
        </div>
      )}

      {messages?.map((msg) => (
        <div
          key={msg.id}
          className={`rounded-xl border overflow-hidden transition-colors ${
            msg.isRead ? "border-border bg-card" : "border-primary/30 bg-primary/5"
          }`}
        >
          <button
            onClick={() => toggle(msg.id, msg.isRead)}
            className="w-full text-left px-4 py-3 flex items-center gap-3"
          >
            {!msg.isRead && <span className="w-2 h-2 rounded-full bg-primary shrink-0" />}
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-medium truncate ${!msg.isRead ? "text-foreground" : "text-muted-foreground"}`}>
                {msg.title}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {msg.senderName} · {msg.createdAt.slice(0, 10)}
              </p>
            </div>
            {expandedId === msg.id
              ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
              : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
          </button>

          {expandedId === msg.id && (
            <div className="px-4 pb-4 pt-1 border-t border-border">
              <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{msg.content}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
