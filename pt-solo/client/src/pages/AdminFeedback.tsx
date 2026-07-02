import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  MessageSquare, Clock, CheckCircle2, XCircle, Loader2, ChevronDown, ChevronUp, Filter,
} from "lucide-react";

const CATEGORIES: Record<string, { label: string; color: string }> = {
  bug:         { label: "오류 신고",   color: "bg-red-500/15 text-red-400 border-red-500/30" },
  task:        { label: "작업 요청",   color: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  improvement: { label: "개선 제안",   color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  question:    { label: "문의",        color: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
};

const STATUS_META: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  pending:     { label: "접수됨",  color: "bg-slate-500/15 text-slate-400 border-slate-500/30",      icon: Clock },
  in_progress: { label: "처리 중", color: "bg-blue-500/15 text-blue-400 border-blue-500/30",         icon: Loader2 },
  done:        { label: "완료",    color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30", icon: CheckCircle2 },
  rejected:    { label: "반려",    color: "bg-red-500/15 text-red-400 border-red-500/30",             icon: XCircle },
};

const STATUS_ACTIONS: { value: "pending" | "in_progress" | "done" | "rejected"; label: string }[] = [
  { value: "pending",     label: "접수됨" },
  { value: "in_progress", label: "처리 중" },
  { value: "done",        label: "완료" },
  { value: "rejected",    label: "반려" },
];

export default function AdminFeedback() {
  const utils = trpc.useUtils();
  const { data: list, isLoading } = trpc.trainerFeedback.adminList.useQuery();
  const updateMutation = trpc.trainerFeedback.updateStatus.useMutation({
    onSuccess: () => { toast.success("상태가 업데이트되었습니다."); utils.trainerFeedback.adminList.invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [adminNotes, setAdminNotes] = useState<Record<number, string>>({});
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");

  const filtered = (list ?? []).filter(item => {
    if (filterStatus !== "all" && item.status !== filterStatus) return false;
    if (filterCategory !== "all" && item.category !== filterCategory) return false;
    return true;
  });

  const counts = (list ?? []).reduce<Record<string, number>>((acc, item) => {
    acc[item.status] = (acc[item.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-5 pb-10">
      <div>
        <h1 className="text-xl font-bold">작업 / 오류 데이터</h1>
        <p className="text-sm text-muted-foreground mt-0.5">STEPER가 보낸 요청 및 오류 신고 내역</p>
      </div>

      {/* 요약 카운트 */}
      <div className="grid grid-cols-4 gap-2">
        {STATUS_ACTIONS.map(s => {
          const meta = STATUS_META[s.value];
          const Icon = meta.icon;
          return (
            <button
              key={s.value}
              onClick={() => setFilterStatus(filterStatus === s.value ? "all" : s.value)}
              className={`rounded-xl border p-3 text-center transition-all ${filterStatus === s.value ? meta.color : "bg-card border-border"}`}
            >
              <Icon className="h-4 w-4 mx-auto mb-1 opacity-70" />
              <p className="text-lg font-bold">{counts[s.value] ?? 0}</p>
              <p className="text-[10px] text-muted-foreground">{meta.label}</p>
            </button>
          );
        })}
      </div>

      {/* 필터 */}
      <div className="flex gap-2 flex-wrap">
        <div className="flex items-center gap-1.5">
          <Filter className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">유형:</span>
        </div>
        {[{ value: "all", label: "전체" }, ...Object.entries(CATEGORIES).map(([value, { label }]) => ({ value, label }))].map(c => (
          <button
            key={c.value}
            onClick={() => setFilterCategory(c.value)}
            className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${
              filterCategory === c.value ? "bg-primary/20 text-primary border-primary/30" : "bg-accent/20 text-muted-foreground border-border"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* 목록 */}
      {isLoading ? (
        <div className="text-center py-10 text-muted-foreground text-sm">불러오는 중...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground text-sm">해당 조건의 요청이 없습니다.</div>
      ) : (
        <div className="space-y-3">
          {filtered.map(item => {
            const catMeta = CATEGORIES[item.category] ?? { label: item.category, color: "" };
            const stMeta = STATUS_META[item.status] ?? STATUS_META.pending;
            const StIcon = stMeta.icon;
            const expanded = expandedId === item.id;
            const note = adminNotes[item.id] ?? item.adminNote ?? "";

            return (
              <Card key={item.id} className="bg-card border-border">
                <button className="w-full text-left" onClick={() => setExpandedId(expanded ? null : item.id)}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${catMeta.color}`}>{catMeta.label}</span>
                          <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${stMeta.color}`}>
                            <StIcon className="h-3 w-3" />{stMeta.label}
                          </span>
                        </div>
                        <p className="text-sm font-semibold truncate">{item.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {item.trainerName} (@{item.username}) · {item.createdAt.slice(0, 10)}
                        </p>
                      </div>
                      {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0 mt-1" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />}
                    </div>
                  </CardContent>
                </button>

                {expanded && (
                  <div className="px-4 pb-4 space-y-4 border-t border-border pt-3">
                    {/* 내용 */}
                    <p className="text-sm text-foreground/80 whitespace-pre-wrap leading-relaxed">{item.content}</p>

                    {/* 상태 변경 */}
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-muted-foreground">상태 변경</p>
                      <div className="flex flex-wrap gap-2">
                        {STATUS_ACTIONS.map(s => {
                          const sMeta = STATUS_META[s.value];
                          return (
                            <button
                              key={s.value}
                              onClick={() => updateMutation.mutate({ id: item.id, status: s.value, adminNote: note || undefined })}
                              className={`text-xs px-3 py-1.5 rounded-lg border font-semibold transition-all ${
                                item.status === s.value ? sMeta.color : "bg-accent/20 text-muted-foreground border-border hover:bg-accent/40"
                              }`}
                            >
                              {s.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* 답변 */}
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-muted-foreground">운영팀 답변 (선택)</p>
                      <Textarea
                        placeholder="STEPER에게 보여줄 답변을 입력하세요"
                        value={note}
                        onChange={e => setAdminNotes(prev => ({ ...prev, [item.id]: e.target.value }))}
                        rows={3}
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateMutation.mutate({ id: item.id, status: item.status as any, adminNote: note || undefined })}
                        disabled={updateMutation.isPending}
                      >
                        답변 저장
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
