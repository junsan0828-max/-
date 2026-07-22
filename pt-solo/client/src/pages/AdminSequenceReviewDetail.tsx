import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { fmtDbDate } from "@/lib/dbDate";
import { ArrowLeft, Users, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";

interface Props {
  versionId: number;
}

const CRITERIA = [
  "수업 목표가 명확한가",
  "단계별 흐름이 자연스러운가",
  "난이도 조절 방법이 포함됐는가",
  "지도 포인트와 주의사항이 작성됐는가",
  "다른 트레이너가 이해하고 활용할 수 있는가",
  "특정 질환의 치료 효과를 과장하지 않는가",
];

export default function AdminSequenceReviewDetail({ versionId }: Props) {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.sequenceLab.getReviewDetail.useQuery({ versionId });
  const [feedback, setFeedback] = useState("");
  const [checked, setChecked] = useState<Record<number, boolean>>({});

  const submitReview = trpc.sequenceLab.submitReview.useMutation({
    onSuccess: (_, vars) => {
      const label = vars.decision === "approved" ? "승인" : vars.decision === "changes_requested" ? "수정 요청" : "거절";
      toast.success(`${label} 처리했습니다.`);
      utils.sequenceLab.reviewQueue.invalidate();
      setLocation("/admin/sequence-review");
    },
    onError: (e) => toast.error(e.message),
  });

  if (isLoading || !data) return <div className="py-20 text-center text-sm text-muted-foreground">불러오는 중...</div>;

  const { version, sections, reviews } = data;

  function decide(decision: "approved" | "changes_requested" | "rejected") {
    if (decision !== "approved" && !feedback.trim()) {
      toast.error("작성자에게 전달할 피드백을 입력해주세요.");
      return;
    }
    submitReview.mutate({
      versionId,
      decision,
      feedback: feedback.trim() || undefined,
      criteria: JSON.stringify(CRITERIA.map((item, i) => ({ item, ok: !!checked[i] }))),
    });
  }

  return (
    <div className="space-y-4 pb-8">
      <div className="flex items-center gap-3">
        <button onClick={() => setLocation("/admin/sequence-review")} className="text-muted-foreground hover:text-foreground transition-colors shrink-0">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-lg font-bold truncate">{version.title || "(제목 없음)"}</h1>
          <p className="text-xs text-muted-foreground flex items-center gap-1"><Users className="h-3 w-3" />{version.authorName}</p>
        </div>
      </div>

      {/* 이전 검토 이력 */}
      {reviews.length > 0 && (
        <div className="rounded-2xl bg-card border border-border p-4 space-y-2">
          <p className="text-xs font-semibold text-foreground/70">이전 검토 이력</p>
          {reviews.map((r: any) => (
            <div key={r.id} className="text-xs rounded-lg bg-accent/30 px-3 py-2">
              <p className="font-semibold">{r.reviewerLabel} · {r.decision === "approved" ? "승인" : r.decision === "changes_requested" ? "수정 요청" : "거절"} · {fmtDbDate(r.createdAt)}</p>
              {r.feedback && <p className="text-muted-foreground mt-0.5 whitespace-pre-wrap">{r.feedback}</p>}
            </div>
          ))}
        </div>
      )}

      {/* 기본정보 */}
      <div className="rounded-2xl bg-card border border-border p-4 space-y-2 text-sm">
        <p className="font-bold">기본정보</p>
        <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
          <p>분야: {version.category || "-"}</p>
          <p>대상: {version.targetAudience || "-"}</p>
          <p>난이도: {version.difficulty || "-"}</p>
          <p>예상시간: {version.estimatedMinutes ? `${version.estimatedMinutes}분` : "-"}</p>
          <p className="col-span-2">신체부위: {version.bodyParts || "-"}</p>
          <p className="col-span-2">필요기구: {version.equipment || "-"}</p>
        </div>
        {version.shortDescription && <p className="text-xs pt-1">{version.shortDescription}</p>}
      </div>

      {/* 수업 설계 */}
      <div className="rounded-2xl bg-card border border-border p-4 space-y-2 text-xs">
        <p className="text-sm font-bold">수업 설계</p>
        {version.classGoal && <p><span className="font-semibold text-foreground/70">목표: </span>{version.classGoal}</p>}
        {version.preCheckItems && <p><span className="font-semibold text-foreground/70">사전 확인: </span>{version.preCheckItems}</p>}
        {version.postCheckItems && <p><span className="font-semibold text-foreground/70">사후 확인: </span>{version.postCheckItems}</p>}
        {version.coachingNotes && <p><span className="font-semibold text-foreground/70">주의사항: </span>{version.coachingNotes}</p>}
        {version.authorMemo && <p className="text-amber-600"><span className="font-semibold">작성자 메모: </span>{version.authorMemo}</p>}
      </div>

      {/* 운동 단계 */}
      {sections.map((sec: any, i: number) => (
        <div key={i} className="rounded-2xl bg-card border border-border p-4 space-y-2">
          <p className="text-sm font-bold">{i + 1}. {sec.name}</p>
          {sec.exercises.length === 0 ? (
            <p className="text-xs text-muted-foreground">운동 항목이 없습니다.</p>
          ) : sec.exercises.map((ex: any, j: number) => (
            <div key={j} className="rounded-lg bg-accent/20 p-2.5 text-xs space-y-1">
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold">{ex.name}</p>
                {ex.durationOrReps && <span className="text-muted-foreground shrink-0">{ex.durationOrReps}</span>}
              </div>
              {ex.videoUrl && (
                <a href={ex.videoUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-red-600 hover:underline">
                  ▶ 동작 영상 보기
                </a>
              )}
            </div>
          ))}
        </div>
      ))}

      {/* 검토 기준 체크리스트 (참고용) */}
      <div className="rounded-2xl bg-card border border-border p-4 space-y-2">
        <p className="text-sm font-bold">검토 기준</p>
        {CRITERIA.map((c, i) => (
          <label key={i} className="flex items-center gap-2 text-xs cursor-pointer">
            <input type="checkbox" checked={!!checked[i]} onChange={e => setChecked(prev => ({ ...prev, [i]: e.target.checked }))} className="accent-primary" />
            {c}
          </label>
        ))}
      </div>

      {/* 피드백 + 결정 */}
      <div className="rounded-2xl bg-card border border-border p-4 space-y-3">
        <p className="text-sm font-bold">작성자에게 전달할 피드백</p>
        <Textarea rows={4} value={feedback} onChange={e => setFeedback(e.target.value)} placeholder="수정 요청·거절 시에는 구체적인 사유를 남겨주세요." />
        <div className="grid grid-cols-3 gap-2">
          <Button variant="outline" className="text-amber-600 border-amber-500/40 hover:bg-amber-500/10" onClick={() => decide("changes_requested")} disabled={submitReview.isPending}>
            <AlertTriangle className="h-4 w-4 mr-1" />수정 요청
          </Button>
          <Button variant="outline" className="text-red-600 border-red-500/40 hover:bg-red-500/10" onClick={() => decide("rejected")} disabled={submitReview.isPending}>
            <XCircle className="h-4 w-4 mr-1" />거절
          </Button>
          <Button onClick={() => decide("approved")} disabled={submitReview.isPending}>
            <CheckCircle2 className="h-4 w-4 mr-1" />승인
          </Button>
        </div>
      </div>
    </div>
  );
}
