import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Library, ListChecks, Coins, Plus, ArrowRight } from "lucide-react";

export default function SequenceLab() {
  const [, setLocation] = useLocation();
  const { data: credits } = trpc.sequenceLab.myCredits.useQuery();
  const { data: unread } = trpc.sequenceLab.unreadCount.useQuery();

  const createDraft = trpc.sequenceLab.createDraft.useMutation({
    onSuccess: (res) => setLocation(`/sequences/${res.versionId}/edit`),
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="space-y-4 pb-8">
      <div>
        <h1 className="text-xl font-bold">시퀀스 랩</h1>
        <p className="text-sm text-muted-foreground mt-0.5">직접 만든 수업 시퀀스를 등록 검토받고, 다른 트레이너의 시퀀스를 가져와 써보세요.</p>
      </div>

      <button
        onClick={() => createDraft.mutate()}
        disabled={createDraft.isPending}
        className="w-full relative overflow-hidden rounded-3xl p-5 text-left flex items-center justify-between min-h-[100px] active:scale-95 transition-transform"
        style={{ background: "linear-gradient(145deg, #4F46E5 0%, #7C3AED 100%)", boxShadow: "0 8px 24px rgba(79,70,229,.25)" }}
      >
        <div>
          <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center mb-2">
            <Plus className="h-5 w-5 text-white" />
          </div>
          <p className="text-[15px] font-bold text-white">새 시퀀스 작성</p>
          <p className="text-[11px] text-white/65 mt-0.5">시퀀스 메이커로 바로 시작</p>
        </div>
        <ArrowRight className="h-4 w-4 text-white/80" />
      </button>

      <div className="grid grid-cols-2 gap-3">
        <button onClick={() => setLocation("/sequences/library")}
          className="rounded-2xl bg-card border border-border p-4 text-left hover:border-primary/40 transition-colors">
          <Library className="h-5 w-5 text-blue-500 mb-2" />
          <p className="text-sm font-bold">시퀀스 라이브러리</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">승인된 시퀀스 둘러보기</p>
        </button>
        <button onClick={() => setLocation("/sequences/mine")}
          className="relative rounded-2xl bg-card border border-border p-4 text-left hover:border-primary/40 transition-colors">
          {!!unread?.count && (
            <span className="absolute top-3 right-3 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">{unread.count}</span>
          )}
          <ListChecks className="h-5 w-5 text-violet-500 mb-2" />
          <p className="text-sm font-bold">내 시퀀스</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">작성·검토·보관 현황</p>
        </button>
      </div>

      <button onClick={() => setLocation("/sequences/mine")} className="w-full rounded-2xl bg-card border border-border p-4 flex items-center justify-between hover:border-primary/40 transition-colors">
        <span className="text-sm font-semibold flex items-center gap-1.5"><Coins className="h-4 w-4 text-amber-500" />시퀀스 공유권</span>
        <span className="text-base font-black">{credits?.balance ?? 0}개</span>
      </button>

      <div className="rounded-2xl bg-accent/30 border border-border/60 p-4 space-y-1.5">
        <p className="text-xs font-bold text-foreground/70">시퀀스 랩은 이렇게 진행돼요</p>
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          작성 → 임시저장 → 등록 검토 신청 → 전문가 리뷰 → 승인되면 라이브러리에 공개되고 공유권 1개 지급 → 다른 트레이너는 공유권으로 가져와 자신의 회원·수업에 맞게 수정해 사용합니다.
        </p>
      </div>
    </div>
  );
}
