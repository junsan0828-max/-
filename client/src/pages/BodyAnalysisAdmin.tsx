import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { ChevronDown, ChevronUp, Phone, User, Calendar, Check } from "lucide-react";

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending:   { label: "접수", color: "bg-yellow-500/20 text-yellow-600 border-yellow-500/30" },
  contacted: { label: "연락완료", color: "bg-blue-500/20 text-blue-600 border-blue-500/30" },
  completed: { label: "방문완료", color: "bg-green-500/20 text-green-600 border-green-500/30" },
};

export default function BodyAnalysisAdmin() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [noteInput, setNoteInput] = useState<Record<number, string>>({});

  const utils = trpc.useUtils();
  const { data: reservations, isLoading } = trpc.bodyAnalysis.list.useQuery(
    statusFilter !== "all" ? { status: statusFilter } : {}
  );

  const updateMutation = trpc.bodyAnalysis.updateStatus.useMutation({
    onSuccess: () => {
      toast.success("상태가 업데이트되었습니다.");
      utils.bodyAnalysis.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  function formatDate(str: string) {
    return str?.slice(0, 10) ?? "-";
  }

  return (
    <div className="space-y-4 pb-20">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">체형분석 예약 관리</h1>
        <span className="text-sm text-muted-foreground">{reservations?.length ?? 0}건</span>
      </div>

      {/* 상태 필터 */}
      <div className="flex gap-1.5 flex-wrap">
        {["all", "pending", "contacted", "completed"].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-full text-xs border transition-colors font-medium ${
              statusFilter === s
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border text-muted-foreground hover:border-primary/40"
            }`}
          >
            {s === "all" ? "전체" : STATUS_LABELS[s]?.label}
          </button>
        ))}
      </div>

      {/* 목록 */}
      {isLoading && <p className="text-center text-muted-foreground py-10 text-sm">불러오는 중...</p>}
      {!isLoading && (!reservations || reservations.length === 0) && (
        <p className="text-center text-muted-foreground py-10 text-sm">예약이 없습니다.</p>
      )}

      <div className="space-y-2">
        {reservations?.map((r) => {
          const isExpanded = expandedId === r.id;
          const statusInfo = STATUS_LABELS[r.status ?? "pending"];
          return (
            <div key={r.id} className="bg-card border border-border rounded-xl overflow-hidden">
              {/* 헤더 (클릭하면 상세 토글) */}
              <button
                className="w-full px-4 py-3.5 text-left flex items-center justify-between gap-3 hover:bg-accent transition-colors"
                onClick={() => setExpandedId(isExpanded ? null : r.id)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-sm">{r.name}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${statusInfo.color}`}>
                      {statusInfo.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{r.phone}</span>
                    <span>·</span>
                    <span>{formatDate(r.createdAt)}</span>
                    {r.experience && <><span>·</span><span>{r.experience}</span></>}
                  </div>
                </div>
                {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
              </button>

              {/* 상세 */}
              {isExpanded && (
                <div className="border-t border-border px-4 py-4 space-y-4 bg-card/50">
                  {/* 기본 정보 */}
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="space-y-0.5">
                      <p className="text-xs text-muted-foreground">생년월일</p>
                      <p className="font-medium">{r.birthDate || "-"}</p>
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-xs text-muted-foreground">성별</p>
                      <p className="font-medium">{r.gender === "male" ? "남성" : r.gender === "female" ? "여성" : "-"}</p>
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-xs text-muted-foreground">키</p>
                      <p className="font-medium">{r.height ? `${r.height}cm` : "-"}</p>
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-xs text-muted-foreground">운동 경험</p>
                      <p className="font-medium">{r.experience || "-"}</p>
                    </div>
                  </div>

                  {r.purpose && (
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">운동 목적</p>
                      <div className="flex flex-wrap gap-1.5">
                        {r.purpose.split(",").map((p) => (
                          <span key={p} className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-full border border-primary/20">{p.trim()}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {r.concern && (
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">고민 부위/목표</p>
                      <p className="text-sm">{r.concern}</p>
                    </div>
                  )}

                  {/* 마케팅 동의 */}
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      {r.privacyAgreed ? <Check className="h-3 w-3 text-green-500" /> : <span>✗</span>}
                      개인정보 동의
                    </span>
                    <span className="flex items-center gap-1">
                      {r.marketingAgreed ? <Check className="h-3 w-3 text-green-500" /> : <span className="text-red-400">✗</span>}
                      마케팅 동의 {r.marketingAgreed && r.marketingChannels ? `(${r.marketingChannels})` : ""}
                    </span>
                  </div>

                  {/* 담당자 메모 */}
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">담당자 메모</p>
                    <textarea
                      rows={2}
                      placeholder="메모 입력..."
                      value={noteInput[r.id] ?? (r.note ?? "")}
                      onChange={(e) => setNoteInput((prev) => ({ ...prev, [r.id]: e.target.value }))}
                      className="w-full text-sm bg-input border border-border rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-primary resize-none"
                    />
                  </div>

                  {/* 상태 변경 버튼 */}
                  <div className="flex gap-2">
                    {(["pending", "contacted", "completed"] as const).map((s) => (
                      <button
                        key={s}
                        onClick={() => updateMutation.mutate({
                          id: r.id,
                          status: s,
                          note: noteInput[r.id] ?? r.note ?? undefined,
                        })}
                        disabled={updateMutation.isPending}
                        className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition-colors ${
                          r.status === s
                            ? "bg-primary text-primary-foreground border-primary"
                            : "border-border text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {STATUS_LABELS[s].label}
                      </button>
                    ))}
                  </div>

                  {/* 전화 바로걸기 */}
                  <a
                    href={`tel:${r.phone}`}
                    className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Phone className="h-4 w-4" />
                    {r.phone} 전화하기
                  </a>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
