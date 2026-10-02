import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Copy, ChevronUp, ChevronDown } from "lucide-react";

export default function SurveyBuilder() {
  const { data: user } = trpc.auth.me.useQuery();
  const utils = trpc.useUtils();
  const { data: questions } = trpc.survey.listQuestions.useQuery();
  const { data: responses } = trpc.survey.listResponses.useQuery();
  const createMutation = trpc.survey.createQuestion.useMutation({
    onSuccess: () => { utils.survey.listQuestions.invalidate(); setShowForm(false); setForm({ question: "", type: "text", options: "", isRequired: 0 }); toast.success("문항이 추가되었습니다."); },
  });
  const deleteMutation = trpc.survey.deleteQuestion.useMutation({
    onSuccess: () => utils.survey.listQuestions.invalidate(),
  });
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ question: "", type: "text" as "text" | "choice" | "scale", options: "", isRequired: 0 });
  const [showResponses, setShowResponses] = useState(false);

  const trainerId = (user as any)?.trainerId;
  const surveyUrl = `${window.location.origin}/survey/${trainerId}`;

  const TYPE_LABELS = { text: "주관식", choice: "객관식", scale: "1~5점 척도" };

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">상담 전 고객에게 보낼 맞춤 설문을 만드세요.</p>
      <button onClick={() => { navigator.clipboard.writeText(surveyUrl); toast.success("설문 링크 복사됨!"); }}
        className="w-full flex items-center gap-2 px-3 py-2.5 bg-primary/10 border border-primary/30 rounded-xl text-xs text-primary">
        <Copy className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">{surveyUrl}</span>
      </button>
      <button onClick={() => setShowForm(v => !v)} className="flex items-center gap-1.5 text-xs text-primary font-medium">
        <Plus className="h-3.5 w-3.5" />{showForm ? "취소" : "문항 추가"}
      </button>
      {showForm && (
        <div className="bg-accent/20 border border-border rounded-xl p-4 space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">유형</Label>
            <div className="flex gap-2">
              {(["text", "choice", "scale"] as const).map(t => (
                <button key={t} onClick={() => setForm(p => ({ ...p, type: t }))}
                  className={`flex-1 py-1.5 rounded-lg text-xs border transition-colors ${form.type === t ? "bg-primary/20 border-primary text-primary" : "border-border text-muted-foreground"}`}>
                  {TYPE_LABELS[t]}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">질문 *</Label>
            <Input value={form.question} onChange={e => setForm(p => ({ ...p, question: e.target.value }))} placeholder="예: 운동 목적이 무엇인가요?" className="text-sm h-8" />
          </div>
          {form.type === "choice" && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">선택지 (쉼표로 구분)</Label>
              <Input value={form.options} onChange={e => setForm(p => ({ ...p, options: e.target.value }))} placeholder="다이어트, 근력강화, 재활, 체형교정" className="text-sm h-8" />
            </div>
          )}
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.isRequired === 1} onChange={e => setForm(p => ({ ...p, isRequired: e.target.checked ? 1 : 0 }))} className="rounded" />
            <span className="text-xs text-muted-foreground">필수 응답</span>
          </label>
          <Button size="sm" className="w-full" disabled={!form.question || createMutation.isPending}
            onClick={() => createMutation.mutate({ ...form, sortOrder: (questions?.length ?? 0) })}>
            {createMutation.isPending ? "추가 중..." : "추가"}
          </Button>
        </div>
      )}
      <div className="space-y-2">
        {(questions ?? []).length === 0 && <p className="text-xs text-muted-foreground text-center py-4">등록된 문항이 없습니다.</p>}
        {(questions ?? []).map((q: any, i: number) => (
          <div key={q.id} className="flex items-start justify-between gap-2 bg-accent/10 border border-border rounded-xl p-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs bg-primary/20 text-primary px-1.5 py-0.5 rounded font-medium">{TYPE_LABELS[q.type as "text" | "choice" | "scale"] ?? q.type}</span>
                {q.isRequired ? <span className="text-xs text-red-400">필수</span> : null}
              </div>
              <p className="text-sm mt-1">{i + 1}. {q.question}</p>
              {q.options && <p className="text-xs text-muted-foreground mt-0.5">{q.options}</p>}
            </div>
            <button onClick={() => deleteMutation.mutate({ id: q.id })} className="text-muted-foreground hover:text-red-400 shrink-0">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
      {responses && responses.length > 0 && (
        <div className="space-y-2">
          <button onClick={() => setShowResponses(v => !v)} className="text-xs text-primary font-medium flex items-center gap-1">
            응답 목록 ({responses.length}건) {showResponses ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>
          {showResponses && responses.map((r: any) => (
            <div key={r.id} className="bg-background border border-border rounded-xl p-3 space-y-1.5">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">{r.respondentName}</p>
                <p className="text-xs text-muted-foreground">{r.createdAt?.slice(0, 10)}</p>
              </div>
              {r.respondentPhone && <p className="text-xs text-muted-foreground">{r.respondentPhone}</p>}
              {Object.entries(JSON.parse(r.answers ?? "{}")).map(([qId, ans]) => {
                const q = (questions ?? []).find((q: any) => String(q.id) === qId);
                return q ? (
                  <div key={qId} className="text-xs">
                    <span className="text-muted-foreground">{q.question}: </span>
                    <span className="text-foreground">{String(ans)}</span>
                  </div>
                ) : null;
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
