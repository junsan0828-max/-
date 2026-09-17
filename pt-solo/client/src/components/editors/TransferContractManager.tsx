import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Plus, Edit2, X, Copy } from "lucide-react";

export default function TransferContractManager() {
  const utils = trpc.useUtils();
  const { data: list } = trpc.eContract.list.useQuery();
  const invalidate = () => utils.eContract.list.invalidate();
  const createMutation = trpc.eContract.createTransfer.useMutation({ onSuccess: () => { invalidate(); setShowForm(false); resetForm(); } });
  const updateTransferMutation = trpc.eContract.updateTransfer.useMutation({ onSuccess: () => { invalidate(); setEditId(null); setShowForm(false); resetForm(); toast.success("수정되었습니다"); } });
  const deleteMutation = trpc.eContract.delete.useMutation({ onSuccess: () => invalidate() });
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [detailId, setDetailId] = useState<number | null>(null);
  const { data: detail } = trpc.eContract.getDetail.useQuery({ id: detailId! }, { enabled: !!detailId });

  const emptyForm = { transferorName: "", transferorPhone: "", programName: "", totalSessions: "", usedSessions: "", remainingSessions: "", transferDate: "", trainerMemo: "" };
  const [form, setForm] = useState(emptyForm);
  function resetForm() { setForm(emptyForm); setEditId(null); }

  function openEdit(c: any) {
    const extra = (() => { try { return JSON.parse(c.extraData || '{}'); } catch { return {}; } })();
    setForm({
      transferorName: extra.transferorName ?? "",
      transferorPhone: extra.transferorPhone ?? "",
      programName: c.programName ?? "",
      totalSessions: extra.totalSessions != null ? String(extra.totalSessions) : "",
      usedSessions: extra.usedSessions != null ? String(extra.usedSessions) : "",
      remainingSessions: extra.remainingSessions != null ? String(extra.remainingSessions) : "",
      transferDate: extra.transferDate ?? "",
      trainerMemo: c.trainerMemo ?? "",
    });
    setEditId(c.id);
    setShowForm(true);
  }

  const transferList = (list ?? []).filter((c: any) => c.contractType === 'transfer');

  function copyLink(token: string) {
    const url = `${window.location.origin}/contract/${token}`;
    navigator.clipboard.writeText(url).then(() => toast.success("링크 복사됨")).catch(() => toast.error("복사 실패"));
  }
  function openKakao(token: string) {
    const url = `${window.location.origin}/contract/${token}`;
    navigator.clipboard.writeText(url).then(() => {
      toast.success("링크 복사됨 — 카카오톡에 붙여넣기 하세요");
      setTimeout(() => { window.location.href = "kakaotalk://"; }, 300);
    });
  }

  const statusMeta: Record<string, { label: string; cls: string }> = {
    pending:           { label: "양도인 서명 대기",  cls: "bg-amber-100 text-amber-700" },
    transferor_signed: { label: "양수인 서명 대기",  cls: "bg-blue-100 text-blue-700" },
    signed:            { label: "서명 완료",          cls: "bg-green-100 text-green-700" },
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-muted-foreground">양도양수 계약서 목록</p>
        <button onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-1.5 text-xs font-semibold bg-primary text-primary-foreground px-3 py-1.5 rounded-lg hover:bg-primary/90">
          <Plus className="h-3.5 w-3.5" /> 계약서 생성
        </button>
      </div>

      {showForm && (
        <div className="bg-accent/30 border border-border rounded-xl p-4 space-y-3">
          <p className="text-xs font-semibold">{editId ? "양도양수 계약서 수정" : "양도 정보 입력"}</p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: "양도인 이름", key: "transferorName", placeholder: "홍길동" },
              { label: "양도인 연락처", key: "transferorPhone", placeholder: "010-0000-0000" },
              { label: "프로그램명", key: "programName", placeholder: "PT 10회" },
              { label: "총 횟수", key: "totalSessions", placeholder: "10" },
              { label: "수강 횟수", key: "usedSessions", placeholder: "3" },
              { label: "잔여 횟수", key: "remainingSessions", placeholder: "7" },
            ].map(({ label, key, placeholder }) => (
              <div key={key} className="space-y-1">
                <label className="text-[10px] font-semibold text-muted-foreground">{label}</label>
                <input value={(form as any)[key]} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
                  placeholder={placeholder}
                  className="w-full border border-border rounded-lg px-2.5 py-2 text-xs bg-background focus:outline-none focus:border-primary" />
              </div>
            ))}
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-semibold text-muted-foreground">양도 예정일</label>
            <input type="date" value={form.transferDate} onChange={e => setForm(p => ({ ...p, transferDate: e.target.value }))}
              className="w-full border border-border rounded-lg px-2.5 py-2 text-xs bg-background focus:outline-none focus:border-primary" />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-semibold text-muted-foreground">STEPER 메모 (선택)</label>
            <textarea value={form.trainerMemo} onChange={e => setForm(p => ({ ...p, trainerMemo: e.target.value }))}
              rows={2} placeholder="특이사항 등"
              className="w-full border border-border rounded-lg px-2.5 py-2 text-xs bg-background focus:outline-none focus:border-primary resize-none" />
          </div>
          <div className="flex gap-2">
            <button onClick={() => { setShowForm(false); resetForm(); }} className="flex-1 text-xs py-2 border border-border rounded-lg text-muted-foreground">취소</button>
            {editId ? (
              <button disabled={updateTransferMutation.isPending} onClick={() => updateTransferMutation.mutate({
                id: editId,
                transferorName: form.transferorName || undefined,
                transferorPhone: form.transferorPhone || undefined,
                programName: form.programName || undefined,
                totalSessions: form.totalSessions ? parseInt(form.totalSessions) : undefined,
                usedSessions: form.usedSessions ? parseInt(form.usedSessions) : undefined,
                remainingSessions: form.remainingSessions ? parseInt(form.remainingSessions) : undefined,
                transferDate: form.transferDate || undefined,
                trainerMemo: form.trainerMemo || undefined,
              })} className="flex-1 text-xs py-2 bg-primary text-primary-foreground rounded-lg font-semibold disabled:opacity-50">
                {updateTransferMutation.isPending ? "수정 중..." : "수정 완료"}
              </button>
            ) : (
              <button disabled={createMutation.isPending} onClick={() => createMutation.mutate({
                transferorName: form.transferorName || undefined,
                transferorPhone: form.transferorPhone || undefined,
                programName: form.programName || undefined,
                totalSessions: form.totalSessions ? parseInt(form.totalSessions) : undefined,
                usedSessions: form.usedSessions ? parseInt(form.usedSessions) : undefined,
                remainingSessions: form.remainingSessions ? parseInt(form.remainingSessions) : undefined,
                transferDate: form.transferDate || undefined,
                trainerMemo: form.trainerMemo || undefined,
              })} className="flex-1 text-xs py-2 bg-primary text-primary-foreground rounded-lg font-semibold disabled:opacity-50">
                {createMutation.isPending ? "생성 중..." : "계약서 생성 및 링크 발급"}
              </button>
            )}
          </div>
        </div>
      )}

      {transferList.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-4">생성된 양도양수 계약서가 없습니다</p>
      ) : (
        <div className="space-y-2">
          {transferList.map((c: any) => {
            const sm = statusMeta[c.status] ?? statusMeta.pending;
            const extra = (() => { try { return JSON.parse(c.extraData || '{}'); } catch { return {}; } })();
            return (
              <div key={c.id} className="bg-background border border-border rounded-xl p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-semibold">{extra.transferorName || "양도인 미입력"}</p>
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${sm.cls}`}>{sm.label}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {c.programName && `${c.programName} · `}
                      {extra.remainingSessions ? `잔여 ${extra.remainingSessions}회` : ""}
                      {` · ${c.createdAt?.slice(0, 10)}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => openEdit(c)} className="p-1 rounded-lg hover:bg-muted">
                      <Edit2 className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                    <button onClick={() => { if (confirm("삭제할까요?")) deleteMutation.mutate({ id: c.id }); }}
                      className="p-1 rounded-lg hover:bg-muted">
                      <X className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                  </div>
                </div>
                <div className="flex gap-1.5">
                  <button onClick={() => copyLink(c.token)}
                    className="flex-1 flex items-center justify-center gap-1 text-[12px] font-semibold border border-border rounded-lg py-1.5 hover:bg-muted">
                    <Copy className="h-3 w-3" /> 링크 복사
                  </button>
                  <button onClick={() => openKakao(c.token)}
                    className="flex-1 flex items-center justify-center gap-1 text-[12px] font-semibold bg-[#FEE500] text-[#3A1D1D] rounded-lg py-1.5 hover:opacity-90">
                    카카오톡 공유
                  </button>
                  {c.status === "signed" && (
                    <button onClick={() => setDetailId(c.id)}
                      className="flex-1 flex items-center justify-center gap-1 text-[12px] font-semibold bg-primary/10 text-primary rounded-lg py-1.5 hover:bg-primary/20">
                      서명 확인
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {detail && (
        <div className="fixed inset-0 z-50 flex items-end">
          <div className="absolute inset-0 bg-black/50" onClick={() => setDetailId(null)} />
          <div className="relative bg-card rounded-t-3xl w-full max-h-[85vh] overflow-y-auto p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold">서명 완료 — 양도양수 계약서</h3>
              <button onClick={() => setDetailId(null)}><X className="h-5 w-5" /></button>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {[
                ["양수인 (서명자)", detail.signerName], ["양수인 연락처", detail.memberPhone],
                ["프로그램", detail.programName], ["서명일시", detail.signedAt?.slice(0, 16)],
              ].filter(r => r[1]).map(([label, value]) => (
                <div key={label} className="bg-accent/30 rounded-lg px-3 py-2">
                  <p className="text-[10px] text-muted-foreground">{label}</p>
                  <p className="font-semibold mt-0.5">{value}</p>
                </div>
              ))}
            </div>
            {detail.signaturePng && (
              <div className="border border-border rounded-xl p-3 bg-white">
                <img src={detail.signaturePng} className="w-full h-24 object-contain" />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
