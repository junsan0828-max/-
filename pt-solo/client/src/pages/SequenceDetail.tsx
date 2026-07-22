import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Users, Clock, Dumbbell, Lock, Download, ShieldCheck, ListChecks, Youtube } from "lucide-react";

interface Props {
  sequenceId: number;
}

export default function SequenceDetail({ sequenceId }: Props) {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.sequenceLab.libraryDetail.useQuery({ sequenceId });

  const importMutation = trpc.sequenceLab.importSequence.useMutation({
    onSuccess: (res) => {
      toast.success(res.alreadyImported ? "이미 가져온 시퀀스입니다." : "시퀀스를 가져왔습니다! 공유권 1개가 사용됐어요.");
      utils.sequenceLab.libraryDetail.invalidate({ sequenceId });
      utils.sequenceLab.myCredits.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  if (isLoading || !data) {
    return <div className="py-20 text-center text-sm text-muted-foreground">불러오는 중...</div>;
  }

  const { sequence, version, sectionSummary, totalExercises, unlocked, isMine, hasImported, sections, copyVersionId } = data;

  return (
    <div className="space-y-4 pb-8">
      <div className="flex items-center gap-3">
        <button onClick={() => setLocation("/sequences/library")} className="text-muted-foreground hover:text-foreground transition-colors shrink-0">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-bold truncate flex-1">{version.title}</h1>
      </div>

      <div className="rounded-2xl bg-card border border-border p-4 space-y-3">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-emerald-500/15 text-emerald-600 flex items-center gap-1">
            <ShieldCheck className="h-3 w-3" />전문가 리뷰 완료
          </span>
          {isMine && <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-primary/15 text-primary">내 시퀀스</span>}
          {hasImported && !isMine && <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-blue-500/15 text-blue-600">가져온 시퀀스</span>}
        </div>

        {version.shortDescription && <p className="text-sm text-foreground/80">{version.shortDescription}</p>}
        {version.publicDescription && <p className="text-xs text-muted-foreground whitespace-pre-wrap">{version.publicDescription}</p>}

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="flex items-center gap-1.5 text-muted-foreground"><Users className="h-3.5 w-3.5" />작성자: {sequence.authorName}</div>
          {version.estimatedMinutes && <div className="flex items-center gap-1.5 text-muted-foreground"><Clock className="h-3.5 w-3.5" />{version.estimatedMinutes}분</div>}
          {version.equipment && <div className="flex items-center gap-1.5 text-muted-foreground col-span-2"><Dumbbell className="h-3.5 w-3.5" />{version.equipment}</div>}
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {version.category && <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600">{version.category}</span>}
          {version.targetAudience && <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-600">{version.targetAudience}</span>}
          {version.difficulty && <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600">{version.difficulty}</span>}
          {version.bodyParts && <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-600">{version.bodyParts}</span>}
        </div>

        {version.classGoal && (
          <div className="pt-2 border-t border-border/60">
            <p className="text-xs font-semibold text-foreground/70 mb-1">수업 목표</p>
            <p className="text-xs text-muted-foreground whitespace-pre-wrap">{version.classGoal}</p>
          </div>
        )}

        <div className="flex items-center gap-1.5 text-xs text-muted-foreground pt-1">
          <ListChecks className="h-3.5 w-3.5" />
          단계 {sectionSummary.length}개 · 운동 {totalExercises}개
        </div>
      </div>

      {/* 단계 구성 요약 (가져오기 전에도 표시) */}
      <div className="rounded-2xl bg-card border border-border p-4 space-y-2">
        <p className="text-sm font-bold">단계 구성</p>
        {sectionSummary.map((s: any, i: number) => (
          <div key={i} className="flex items-center justify-between text-xs px-3 py-2 rounded-lg bg-accent/30">
            <span className="font-medium">{i + 1}. {s.name}</span>
            <span className="text-muted-foreground">{s.exerciseCount}개</span>
          </div>
        ))}
      </div>

      {!unlocked ? (
        <div className="rounded-2xl border border-dashed border-primary/40 bg-primary/5 p-5 text-center space-y-3">
          <Lock className="h-6 w-6 text-primary mx-auto" />
          <p className="text-sm font-semibold">가져오면 전체 운동 순서·세트·지도 포인트·주의사항을 볼 수 있어요</p>
          <p className="text-xs text-muted-foreground">공유권 1개가 사용됩니다. 이미 소진 시 다른 트레이너의 시퀀스가 승인·공개되면 다시 받을 수 있어요.</p>
          <Button onClick={() => importMutation.mutate({ sequenceId })} disabled={importMutation.isPending} className="w-full">
            <Download className="h-4 w-4 mr-1.5" />공유권 1개로 가져오기
          </Button>
        </div>
      ) : (
        <>
          {version.preCheckItems && (
            <div className="rounded-2xl bg-card border border-border p-4">
              <p className="text-xs font-semibold text-foreground/70 mb-1">수업 전 확인 항목</p>
              <p className="text-xs text-muted-foreground whitespace-pre-wrap">{version.preCheckItems}</p>
            </div>
          )}
          {(sections ?? []).map((sec: any, i: number) => (
            <div key={i} className="rounded-2xl bg-card border border-border p-4 space-y-2">
              <p className="text-sm font-bold">{i + 1}. {sec.name}</p>
              {sec.exercises.map((ex: any, j: number) => (
                <div key={j} className="rounded-xl bg-accent/20 p-3 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold">{ex.name}</p>
                    {ex.durationOrReps && <span className="text-[11px] text-muted-foreground shrink-0">{ex.durationOrReps}</span>}
                  </div>
                  {ex.videoUrl && (
                    <a href={ex.videoUrl} target="_blank" rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-red-600 hover:underline">
                      <Youtube className="h-3.5 w-3.5" />동작 영상 보기
                    </a>
                  )}
                </div>
              ))}
            </div>
          ))}
          {version.postCheckItems && (
            <div className="rounded-2xl bg-card border border-border p-4">
              <p className="text-xs font-semibold text-foreground/70 mb-1">수업 후 재확인 항목</p>
              <p className="text-xs text-muted-foreground whitespace-pre-wrap">{version.postCheckItems}</p>
            </div>
          )}
          {version.coachingNotes && (
            <div className="rounded-2xl bg-card border border-border p-4">
              <p className="text-xs font-semibold text-foreground/70 mb-1">지도 시 주의사항</p>
              <p className="text-xs text-muted-foreground whitespace-pre-wrap">{version.coachingNotes}</p>
            </div>
          )}
          {!isMine && copyVersionId && (
            <Button onClick={() => setLocation(`/sequences/${copyVersionId}/edit`)} className="w-full">
              복사본 수정하기 →
            </Button>
          )}
          {isMine && copyVersionId && (
            <Button variant="outline" onClick={() => setLocation(`/sequences/${copyVersionId}/edit`)} className="w-full">
              내 시퀀스 편집으로 이동
            </Button>
          )}
        </>
      )}
    </div>
  );
}
