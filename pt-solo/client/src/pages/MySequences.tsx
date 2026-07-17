import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Plus, Coins, ArrowUp, ArrowDown, Gift } from "lucide-react";

type TabKey = "draft" | "submitted" | "changes_requested" | "published" | "imported" | "archived" | "credits";

const TABS: { key: TabKey; label: string }[] = [
  { key: "draft", label: "작성 중" },
  { key: "submitted", label: "검토 중" },
  { key: "changes_requested", label: "수정 요청" },
  { key: "published", label: "승인·공개" },
  { key: "imported", label: "가져온 시퀀스" },
  { key: "archived", label: "보관" },
  { key: "credits", label: "공유권 내역" },
];

const STATUS_META: Record<string, { label: string; cls: string }> = {
  DRAFT: { label: "작성 중", cls: "bg-muted text-muted-foreground" },
  SUBMITTED: { label: "검토 중", cls: "bg-blue-500/15 text-blue-600" },
  CHANGES_REQUESTED: { label: "수정 요청", cls: "bg-amber-500/15 text-amber-600" },
  PUBLISHED: { label: "승인·공개", cls: "bg-emerald-500/15 text-emerald-600" },
  REJECTED: { label: "거절", cls: "bg-red-500/15 text-red-600" },
  ARCHIVED: { label: "보관", cls: "bg-muted text-muted-foreground" },
};

const TX_TYPE_LABEL: Record<string, string> = {
  publish_grant: "시퀀스 승인·공개 지급",
  import_spend: "시퀀스 가져오기 사용",
  admin_grant: "관리자 지급",
  admin_revoke: "관리자 회수",
};

export default function MySequences() {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const [tab, setTab] = useState<TabKey>("draft");

  const { data: credits } = trpc.sequenceLab.myCredits.useQuery();
  const { data: rows, isLoading } = trpc.sequenceLab.listMine.useQuery(
    { tab: tab === "credits" ? "draft" : tab },
    { enabled: tab !== "credits" }
  );

  const createDraft = trpc.sequenceLab.createDraft.useMutation({
    onSuccess: (res) => setLocation(`/sequences/${res.versionId}/edit`),
    onError: (e) => toast.error(e.message),
  });
  const createRevision = trpc.sequenceLab.createRevision.useMutation({
    onSuccess: (res) => { setLocation(`/sequences/${res.versionId}/edit`); utils.sequenceLab.listMine.invalidate(); },
    onError: (e) => toast.error(e.message),
  });
  const archive = trpc.sequenceLab.archive.useMutation({
    onSuccess: () => { toast.success("보관함으로 이동했습니다."); utils.sequenceLab.listMine.invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="space-y-4 pb-8">
      <div className="flex items-center gap-3">
        <button onClick={() => setLocation("/sequences")} className="text-muted-foreground hover:text-foreground transition-colors shrink-0">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-bold">내 시퀀스</h1>
        </div>
        <Button size="sm" onClick={() => createDraft.mutate()} disabled={createDraft.isPending}>
          <Plus className="h-4 w-4 mr-1" />새 시퀀스
        </Button>
      </div>

      <div className="rounded-xl bg-card border border-border px-4 py-3 flex items-center justify-between">
        <span className="text-xs font-semibold flex items-center gap-1.5"><Coins className="h-4 w-4 text-amber-500" />보유 공유권</span>
        <span className="text-lg font-black">{credits?.balance ?? 0}개</span>
      </div>

      <div className="flex items-center gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`shrink-0 text-xs font-semibold px-3 py-1.5 rounded-full transition-colors ${tab === t.key ? "bg-primary text-primary-foreground" : "bg-accent/50 text-muted-foreground hover:bg-accent"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "credits" ? (
        !credits || credits.transactions.length === 0 ? (
          <div className="text-center py-16 space-y-2">
            <Gift className="h-8 w-8 text-muted-foreground mx-auto" />
            <p className="text-sm text-muted-foreground">아직 공유권 내역이 없어요. 시퀀스를 작성해 승인받으면 공유권이 지급돼요.</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {credits.transactions.map((tx: any) => (
              <div key={tx.id} className="flex items-center justify-between rounded-xl border border-border px-3.5 py-2.5">
                <div>
                  <p className="text-xs font-semibold">{TX_TYPE_LABEL[tx.type] ?? tx.type}</p>
                  <p className="text-[10px] text-muted-foreground">{new Date(tx.createdAt).toLocaleString("ko-KR")}</p>
                </div>
                <span className={`text-sm font-bold flex items-center gap-0.5 ${tx.amount > 0 ? "text-emerald-600" : "text-red-500"}`}>
                  {tx.amount > 0 ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />}
                  {Math.abs(tx.amount)}
                </span>
              </div>
            ))}
          </div>
        )
      ) : isLoading ? (
        <p className="text-sm text-muted-foreground text-center py-10">불러오는 중...</p>
      ) : !rows || rows.length === 0 ? (
        <div className="text-center py-16 space-y-2">
          <p className="text-sm text-muted-foreground">
            {tab === "draft" ? "작성 중인 시퀀스가 없어요." :
             tab === "submitted" ? "검토 신청한 시퀀스가 없어요." :
             tab === "changes_requested" ? "수정 요청받은 시퀀스가 없어요." :
             tab === "published" ? "아직 승인·공개된 시퀀스가 없어요." :
             tab === "imported" ? "가져온 시퀀스가 없어요. 라이브러리에서 찾아보세요." :
             "보관된 시퀀스가 없어요."}
          </p>
          {tab === "draft" && (
            <button onClick={() => createDraft.mutate()} className="text-xs font-semibold text-primary">새 시퀀스 작성하기 →</button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((r: any) => (
            <button
              key={r.id}
              onClick={() => {
                if (tab === "published") createRevision.mutate({ sequenceId: r.sequenceId });
                else setLocation(`/sequences/${r.id}/edit`);
              }}
              className="w-full text-left rounded-2xl border border-border bg-card p-3.5 hover:border-primary/40 transition-colors"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-bold truncate">{r.title || "(제목 없음)"}</p>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${STATUS_META[r.status]?.cls ?? ""}`}>{STATUS_META[r.status]?.label ?? r.status}</span>
              </div>
              <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
                <span>최근 수정 {new Date(r.updatedAt).toLocaleDateString("ko-KR")}</span>
                {tab === "published" && r.importCount != null && <span>· 가져간 횟수 {r.importCount}회</span>}
                {tab === "imported" && r.originalAuthorName && <span>· 원본: {r.originalAuthorName}</span>}
              </div>
              {tab === "archived" && (
                <div className="mt-1">
                  <span className="text-[10px] text-muted-foreground" onClick={(e) => { e.stopPropagation(); }}>
                    보관됨
                  </span>
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
