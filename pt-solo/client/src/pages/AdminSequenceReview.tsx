import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { fmtDbDate } from "@/lib/dbDate";
import { ArrowLeft, Users, Clock, ShieldPlus, X } from "lucide-react";

export default function AdminSequenceReview() {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const [reviewerPanelOpen, setReviewerPanelOpen] = useState(false);
  const [search, setSearch] = useState("");

  const { data: queue, isLoading } = trpc.sequenceLab.reviewQueue.useQuery();
  const { data: reviewers } = trpc.sequenceLab.adminListReviewers.useQuery();
  const { data: trainers } = trpc.admin.listTrainers.useQuery(undefined, { enabled: reviewerPanelOpen });

  const grantReviewer = trpc.sequenceLab.adminGrantReviewer.useMutation({
    onSuccess: () => { toast.success("리뷰어로 지정했습니다."); utils.sequenceLab.adminListReviewers.invalidate(); },
    onError: (e) => toast.error(e.message),
  });
  const revokeReviewer = trpc.sequenceLab.adminRevokeReviewer.useMutation({
    onSuccess: () => { toast.success("리뷰어 권한을 해제했습니다."); utils.sequenceLab.adminListReviewers.invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  const filteredTrainers = (trainers ?? []).filter((t: any) =>
    !search.trim() || t.trainerName?.toLowerCase().includes(search.toLowerCase())
  ).slice(0, 20);

  return (
    <div className="space-y-4 pb-8">
      <div className="flex items-center gap-3">
        <button onClick={() => setLocation("/")} className="text-muted-foreground hover:text-foreground transition-colors shrink-0">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-bold">시퀀스 검토 관리</h1>
          <p className="text-xs text-muted-foreground">등록 검토 대기 중인 시퀀스를 확인하고 승인/수정요청/거절합니다</p>
        </div>
        <Button size="sm" variant="outline" onClick={() => setReviewerPanelOpen(v => !v)}>
          <ShieldPlus className="h-4 w-4 mr-1" />리뷰어 관리
        </Button>
      </div>

      {reviewerPanelOpen && (
        <div className="rounded-2xl bg-card border border-border p-4 space-y-3">
          <p className="text-sm font-semibold">지정된 리뷰어</p>
          {!reviewers || reviewers.length === 0 ? (
            <p className="text-xs text-muted-foreground">관리자 외 지정된 리뷰어가 없습니다.</p>
          ) : (
            <div className="space-y-1.5">
              {reviewers.map((r: any) => (
                <div key={r.id} className="flex items-center justify-between rounded-lg bg-accent/30 px-3 py-2">
                  <span className="text-xs font-semibold">{r.trainerName}</span>
                  <button onClick={() => revokeReviewer.mutate({ trainerId: r.trainerId })} className="text-muted-foreground hover:text-red-500">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="pt-2 border-t border-border/60 space-y-2">
            <p className="text-xs font-semibold text-foreground/70">트레이너 검색해서 리뷰어로 지정</p>
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="이름 검색..." className="h-9 text-sm" />
            <div className="max-h-48 overflow-y-auto space-y-1">
              {filteredTrainers.map((t: any) => (
                <button key={t.id} onClick={() => grantReviewer.mutate({ trainerId: t.id })}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-accent/40 text-left">
                  <span className="text-xs">{t.trainerName}</span>
                  <span className="text-[10px] text-primary font-semibold">지정</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground text-center py-10">불러오는 중...</p>
      ) : !queue || queue.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-sm text-muted-foreground">검토 대기 중인 시퀀스가 없습니다.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {queue.map((v: any) => (
            <button key={v.id} onClick={() => setLocation(`/admin/sequence-review/${v.id}`)}
              className="w-full text-left rounded-2xl border border-border bg-card p-4 hover:border-primary/40 transition-colors">
              <p className="text-sm font-semibold truncate">{v.title || "(제목 없음)"}</p>
              <div className="flex items-center gap-3 mt-1.5 text-[12px] text-muted-foreground">
                <span className="flex items-center gap-1"><Users className="h-3 w-3" />{v.authorName}</span>
                <span className="flex items-center gap-1"><Clock className="h-3 w-3" />신청: {fmtDbDate(v.submittedAt)}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
