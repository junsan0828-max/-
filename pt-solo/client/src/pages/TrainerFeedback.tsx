import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { MessageSquare, Plus, ChevronDown, ChevronUp, Clock, CheckCircle2, XCircle, Loader2, AlertCircle } from "lucide-react";

const CATEGORIES = [
  { value: "bug", label: "오류 신고", color: "bg-red-500/15 text-red-400 border-red-500/30" },
  { value: "task", label: "작업 요청", color: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  { value: "improvement", label: "개선 제안", color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  { value: "question", label: "문의", color: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
] as const;

const STATUS_META: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  pending:     { label: "접수됨",    color: "bg-slate-500/15 text-slate-400 border-slate-500/30",   icon: Clock },
  in_progress: { label: "처리 중",   color: "bg-blue-500/15 text-blue-400 border-blue-500/30",      icon: Loader2 },
  done:        { label: "완료",      color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30", icon: CheckCircle2 },
  rejected:    { label: "반려",      color: "bg-red-500/15 text-red-400 border-red-500/30",          icon: XCircle },
};

export default function TrainerFeedback() {
  const utils = trpc.useUtils();
  const { data: list, isLoading } = trpc.trainerFeedback.myList.useQuery();
  const submitMutation = trpc.trainerFeedback.submit.useMutation({
    onSuccess: () => {
      toast.success("전송되었습니다.");
      setFormOpen(false);
      setTitle("");
      setContent("");
      utils.trainerFeedback.myList.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const [formOpen, setFormOpen] = useState(false);
  const [category, setCategory] = useState<"bug" | "task" | "improvement" | "question">("bug");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  return (
    <div className="space-y-5 pb-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">작업 / 오류 수정</h1>
          <p className="text-sm text-muted-foreground mt-0.5">운영팀에 직접 전달하는 요청 채널</p>
        </div>
        <Button onClick={() => setFormOpen(v => !v)} size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" />
          새 요청
        </Button>
      </div>

      {/* 작성 폼 */}
      {formOpen && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-primary" />
              요청 작성
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* 카테고리 */}
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map(c => (
                <button
                  key={c.value}
                  onClick={() => setCategory(c.value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                    category === c.value ? c.color : "bg-accent/20 text-muted-foreground border-border hover:bg-accent/40"
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
            <Input
              placeholder="제목을 입력하세요"
              value={title}
              onChange={e => setTitle(e.target.value)}
              maxLength={100}
            />
            <Textarea
              placeholder="내용을 자세히 적어주세요. 오류의 경우 재현 방법을 함께 알려주시면 빠른 처리에 도움이 됩니다."
              value={content}
              onChange={e => setContent(e.target.value)}
              rows={5}
              maxLength={2000}
            />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setFormOpen(false)}>취소</Button>
              <Button
                size="sm"
                disabled={!title.trim() || !content.trim() || submitMutation.isPending}
                onClick={() => submitMutation.mutate({ category, title: title.trim(), content: content.trim() })}
              >
                {submitMutation.isPending ? "전송 중..." : "전송"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 목록 */}
      {isLoading ? (
        <div className="text-center py-10 text-muted-foreground text-sm">불러오는 중...</div>
      ) : !list || list.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
            <AlertCircle className="h-7 w-7 text-primary/60" />
          </div>
          <p className="text-sm text-muted-foreground">아직 등록된 요청이 없습니다.</p>
          <Button size="sm" variant="outline" onClick={() => setFormOpen(true)}>첫 요청 보내기</Button>
        </div>
      ) : (
        <div className="space-y-3">
          {list.map(item => {
            const catMeta = CATEGORIES.find(c => c.value === item.category);
            const stMeta = STATUS_META[item.status] ?? STATUS_META.pending;
            const StIcon = stMeta.icon;
            const expanded = expandedId === item.id;
            return (
              <Card key={item.id} className="bg-card border-border">
                <button
                  className="w-full text-left"
                  onClick={() => setExpandedId(expanded ? null : item.id)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                          {catMeta && (
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${catMeta.color}`}>{catMeta.label}</span>
                          )}
                          <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${stMeta.color}`}>
                            <StIcon className="h-3 w-3" />
                            {stMeta.label}
                          </span>
                        </div>
                        <p className="text-sm font-semibold truncate">{item.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{item.createdAt.slice(0, 10)}</p>
                      </div>
                      {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0 mt-1" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />}
                    </div>
                    {expanded && (
                      <div className="mt-3 space-y-2 border-t border-border pt-3">
                        <p className="text-sm text-foreground/80 whitespace-pre-wrap leading-relaxed">{item.content}</p>
                        {item.adminNote && (
                          <div className="mt-3 rounded-xl bg-primary/10 border border-primary/20 px-4 py-3">
                            <p className="text-xs font-semibold text-primary mb-1">운영팀 답변</p>
                            <p className="text-sm text-foreground/80 whitespace-pre-wrap leading-relaxed">{item.adminNote}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </button>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
