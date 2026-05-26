import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Send, Users, User } from "lucide-react";

export default function GymPlusMessageAdmin() {
  const { data: members } = trpc.gymPlus.admin_listMembers.useQuery();
  const [mode, setMode] = useState<"single" | "bulk">("single");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const sendMutation = trpc.gymPlus.sendMessage.useMutation({
    onSuccess: () => { toast.success("메시지를 전송했습니다."); setTitle(""); setContent(""); setSelectedId(null); },
    onError: (e) => toast.error(e.message || "전송 실패"),
  });
  const bulkMutation = trpc.gymPlus.admin_sendBulkMessage.useMutation({
    onSuccess: (d) => { toast.success(`${d.count}명에게 메시지를 전송했습니다.`); setTitle(""); setContent(""); setSelectedIds(new Set()); },
    onError: (e) => toast.error(e.message || "전송 실패"),
  });

  const activeMembers = members?.filter((m) => m.isActive) ?? [];

  function handleSend() {
    if (!title.trim() || !content.trim()) { toast.error("제목과 내용을 입력해주세요."); return; }
    if (mode === "single") {
      if (!selectedId) { toast.error("회원을 선택해주세요."); return; }
      sendMutation.mutate({ gymPlusMemberId: selectedId, title: title.trim(), content: content.trim() });
    } else {
      if (selectedIds.size === 0) { toast.error("회원을 선택해주세요."); return; }
      bulkMutation.mutate({ gymPlusMemberIds: Array.from(selectedIds), title: title.trim(), content: content.trim() });
    }
  }

  const isPending = sendMutation.isPending || bulkMutation.isPending;

  return (
    <div className="space-y-4">
      <h2 className="text-base font-bold flex items-center gap-2"><Send className="h-4 w-4 text-primary" /> 메시지 전송</h2>

      {/* 모드 선택 */}
      <div className="flex gap-2">
        <button
          onClick={() => setMode("single")}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium border transition-colors ${
            mode === "single" ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:text-foreground"
          }`}
        >
          <User className="h-4 w-4" /> 개인 전송
        </button>
        <button
          onClick={() => setMode("bulk")}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium border transition-colors ${
            mode === "bulk" ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:text-foreground"
          }`}
        >
          <Users className="h-4 w-4" /> 단체 전송
        </button>
      </div>

      {/* 수신자 선택 */}
      {mode === "single" ? (
        <div>
          <label className="text-xs text-muted-foreground block mb-1">수신자</label>
          <select
            value={selectedId ?? ""}
            onChange={(e) => setSelectedId(e.target.value ? Number(e.target.value) : null)}
            className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm"
          >
            <option value="">-- 회원 선택 --</option>
            {activeMembers.map((m) => (
              <option key={m.id} value={m.id}>{m.name} ({m.username})</option>
            ))}
          </select>
        </div>
      ) : (
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs text-muted-foreground">수신자 선택 ({selectedIds.size}명)</label>
            <button
              onClick={() => {
                if (selectedIds.size === activeMembers.length) setSelectedIds(new Set());
                else setSelectedIds(new Set(activeMembers.map((m) => m.id)));
              }}
              className="text-xs text-primary"
            >
              {selectedIds.size === activeMembers.length ? "전체 해제" : "전체 선택"}
            </button>
          </div>
          <div className="border border-border rounded-lg divide-y divide-border max-h-48 overflow-y-auto">
            {activeMembers.map((m) => (
              <label key={m.id} className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-accent transition-colors">
                <input
                  type="checkbox"
                  checked={selectedIds.has(m.id)}
                  onChange={() => setSelectedIds((prev) => {
                    const next = new Set(prev);
                    if (next.has(m.id)) next.delete(m.id); else next.add(m.id);
                    return next;
                  })}
                  className="accent-primary"
                />
                <span className="text-sm">{m.name}</span>
                <span className="text-xs text-muted-foreground ml-auto">{m.username}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* 제목 */}
      <div>
        <label className="text-xs text-muted-foreground block mb-1">제목</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="메시지 제목"
          className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      {/* 내용 */}
      <div>
        <label className="text-xs text-muted-foreground block mb-1">내용</label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="메시지 내용을 입력하세요"
          rows={5}
          className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary resize-none"
        />
      </div>

      <button
        onClick={handleSend}
        disabled={isPending}
        className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-medium text-sm flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50"
      >
        <Send className="h-4 w-4" />
        {isPending ? "전송 중..." : "전송"}
      </button>
    </div>
  );
}
