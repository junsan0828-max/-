import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Plus, Edit2, X, Copy } from "lucide-react";

export default function EContractManager() {
  const utils = trpc.useUtils();
  const { data: list } = trpc.eContract.list.useQuery();
  const invalidate = () => utils.eContract.list.invalidate();
  const createMutation = trpc.eContract.create.useMutation({ onSuccess: () => { invalidate(); setShowForm(false); resetForm(); } });
  const updateMutation = trpc.eContract.update.useMutation({ onSuccess: () => { invalidate(); setEditId(null); setShowForm(false); resetForm(); toast.success("수정되었습니다"); } });
  const deleteMutation = trpc.eContract.delete.useMutation({ onSuccess: () => invalidate() });
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [detailId, setDetailId] = useState<number | null>(null);
  const { data: detail } = trpc.eContract.getDetail.useQuery({ id: detailId! }, { enabled: !!detailId });

  const emptyForm = { memberName: "", memberPhone: "", memberBirth: "", programName: "", programFormat: "", programSessions: "", listPrice: "", discountAmount: "0", programPrice: "", unpaidAmount: "0", paymentDate: new Date().toISOString().slice(0, 10), programStartDate: "", programEndDate: "", trainerMemo: "" };
  const [form, setForm] = useState(emptyForm);
  function resetForm() { setForm(emptyForm); setEditId(null); }

  function openEdit(c: any) {
    setForm({
      memberName: c.memberName ?? "", memberPhone: c.memberPhone ?? "", memberBirth: c.memberBirth ?? "",
      programName: c.programName ?? "", programFormat: c.programFormat ?? "",
      programSessions: c.programSessions != null ? String(c.programSessions) : "",
      listPrice: c.listPrice != null ? String(c.listPrice) : "",
      discountAmount: c.discountAmount != null ? String(c.discountAmount) : "0",
      programPrice: c.programPrice != null ? String(c.programPrice) : "",
      unpaidAmount: c.unpaidAmount != null ? String(c.unpaidAmount) : "0",
      paymentDate: c.paymentDate ?? new Date().toISOString().slice(0, 10),
      programStartDate: c.programStartDate ?? "", programEndDate: c.programEndDate ?? "",
      trainerMemo: c.trainerMemo ?? "",
    });
    setEditId(c.id);
    setShowForm(true);
  }

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
    pending: { label: "서명 대기", cls: "bg-amber-100 text-amber-700" },
    signed:  { label: "서명 완료", cls: "bg-green-100 text-green-700" },
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-muted-foreground">전자계약 목록</p>
        <button onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-1.5 text-xs font-semibold bg-primary text-primary-foreground px-3 py-1.5 rounded-lg hover:bg-primary/90">
          <Plus className="h-3.5 w-3.5" /> 계약서 생성
        </button>
      </div>

      {showForm && (
        <div className="bg-accent/30 border border-border rounded-xl p-4 space-y-3">
          <p className="text-xs font-semibold">{editId ? "계약서 수정" : "새 계약서 정보 입력"} <span className="text-muted-foreground font-normal">(회원이 직접 수정 가능)</span></p>
          {/* 기본 정보 */}
          <div className="grid grid-cols-2 gap-2">
            {([
              { label: "회원 이름", key: "memberName", placeholder: "홍길동" },
              { label: "연락처", key: "memberPhone", placeholder: "010-0000-0000" },
              { label: "생년월일", key: "memberBirth", placeholder: "1990-01-01" },
              { label: "프로그램명", key: "programName", placeholder: "PT" },
            ] as { label: string; key: keyof typeof emptyForm; placeholder: string }[]).map(({ label, key, placeholder }) => (
              <div key={key} className="space-y-1">
                <label className="text-[10px] font-semibold text-muted-foreground">{label}</label>
                <input value={form[key]} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
                  placeholder={placeholder}
                  className="w-full border border-border rounded-lg px-2.5 py-2 text-xs bg-background focus:outline-none focus:border-primary" />
              </div>
            ))}
          </div>
          {/* 프로그램 형태 */}
          <div className="space-y-1">
            <label className="text-[10px] font-semibold text-muted-foreground">프로그램 형태</label>
            <div className="flex gap-2">
              {["개인", "그룹"].map(f => (
                <button key={f} onClick={() => setForm(p => ({ ...p, programFormat: p.programFormat === f ? "" : f }))}
                  className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition-colors ${form.programFormat === f ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground"}`}>
                  {f}
                </button>
              ))}
            </div>
          </div>
          {/* 횟수 */}
          <div className="space-y-1">
            <label className="text-[10px] font-semibold text-muted-foreground">횟수</label>
            <input value={form.programSessions} onChange={e => setForm(p => ({ ...p, programSessions: e.target.value }))}
              type="number" placeholder="10"
              className="w-full border border-border rounded-lg px-2.5 py-2 text-xs bg-background focus:outline-none focus:border-primary" />
          </div>
          {/* 결제 금액 */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-muted-foreground">정가 (원)</label>
              <input value={form.listPrice} type="number" placeholder="0"
                onChange={e => {
                  const list = e.target.value;
                  const disc = Number(form.discountAmount) || 0;
                  setForm(p => ({ ...p, listPrice: list, programPrice: String(Math.max(0, Number(list) - disc)), unpaidAmount: "0" }));
                }}
                className="w-full border border-border rounded-lg px-2.5 py-2 text-xs bg-background focus:outline-none focus:border-primary" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-muted-foreground">할인 (원)</label>
              <input value={form.discountAmount} type="number" placeholder="0"
                onChange={e => {
                  const disc = e.target.value;
                  const list = Number(form.listPrice) || 0;
                  setForm(p => ({ ...p, discountAmount: disc, programPrice: String(Math.max(0, list - (Number(disc) || 0))), unpaidAmount: "0" }));
                }}
                className="w-full border border-border rounded-lg px-2.5 py-2 text-xs bg-background focus:outline-none focus:border-primary" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-muted-foreground">실결제 (원)</label>
              <input value={form.programPrice} type="number" placeholder="0"
                onChange={e => setForm(p => ({ ...p, programPrice: e.target.value }))}
                className="w-full border border-border rounded-lg px-2.5 py-2 text-xs bg-background focus:outline-none focus:border-primary" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-muted-foreground">미수금 (원)</label>
              <input value={form.unpaidAmount} type="number" placeholder="0"
                onChange={e => setForm(p => ({ ...p, unpaidAmount: e.target.value }))}
                className="w-full border border-border rounded-lg px-2.5 py-2 text-xs bg-background focus:outline-none focus:border-primary" />
            </div>
          </div>
          {/* 날짜 3열 */}
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-muted-foreground">결제일</label>
              <input type="date" value={form.paymentDate} onChange={e => setForm(p => ({ ...p, paymentDate: e.target.value }))}
                className="w-full border border-border rounded-lg px-2 py-2 text-xs bg-background focus:outline-none focus:border-primary" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-muted-foreground">시작일</label>
              <input type="date" value={form.programStartDate} onChange={e => setForm(p => ({ ...p, programStartDate: e.target.value }))}
                className="w-full border border-border rounded-lg px-2 py-2 text-xs bg-background focus:outline-none focus:border-primary" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-muted-foreground">종료일</label>
              <input type="date" value={form.programEndDate} onChange={e => setForm(p => ({ ...p, programEndDate: e.target.value }))}
                className="w-full border border-border rounded-lg px-2 py-2 text-xs bg-background focus:outline-none focus:border-primary" />
            </div>
          </div>
          {/* 메모 */}
          <div className="space-y-1">
            <label className="text-[10px] font-semibold text-muted-foreground">STEPER 메모 (회원에게 표시)</label>
            <textarea value={form.trainerMemo} onChange={e => setForm(p => ({ ...p, trainerMemo: e.target.value }))}
              rows={2} placeholder="특이사항, 주의점 등"
              className="w-full border border-border rounded-lg px-2.5 py-2 text-xs bg-background focus:outline-none focus:border-primary resize-none" />
          </div>
          <div className="flex gap-2">
            <button onClick={() => { setShowForm(false); resetForm(); }} className="flex-1 text-xs py-2 border border-border rounded-lg text-muted-foreground">취소</button>
            {editId ? (
              <button disabled={updateMutation.isPending} onClick={() => updateMutation.mutate({
                id: editId,
                memberName: form.memberName || undefined,
                memberPhone: form.memberPhone || undefined,
                memberBirth: form.memberBirth || undefined,
                programName: form.programName || undefined,
                programFormat: form.programFormat || undefined,
                programSessions: form.programSessions ? parseInt(form.programSessions) : undefined,
                listPrice: form.listPrice ? parseInt(form.listPrice) : undefined,
                discountAmount: form.discountAmount ? parseInt(form.discountAmount) : undefined,
                programPrice: form.programPrice ? parseInt(form.programPrice) : undefined,
                unpaidAmount: form.unpaidAmount ? parseInt(form.unpaidAmount) : undefined,
                paymentDate: form.paymentDate || undefined,
                programStartDate: form.programStartDate || undefined,
                programEndDate: form.programEndDate || undefined,
                trainerMemo: form.trainerMemo || undefined,
              })} className="flex-1 text-xs py-2 bg-primary text-primary-foreground rounded-lg font-semibold disabled:opacity-50">
                {updateMutation.isPending ? "수정 중..." : "수정 완료"}
              </button>
            ) : (
              <button disabled={createMutation.isPending} onClick={() => createMutation.mutate({
                memberName: form.memberName || undefined,
                memberPhone: form.memberPhone || undefined,
                memberBirth: form.memberBirth || undefined,
                programName: form.programName || undefined,
                programFormat: form.programFormat || undefined,
                programSessions: form.programSessions ? parseInt(form.programSessions) : undefined,
                listPrice: form.listPrice ? parseInt(form.listPrice) : undefined,
                discountAmount: form.discountAmount ? parseInt(form.discountAmount) : undefined,
                programPrice: form.programPrice ? parseInt(form.programPrice) : undefined,
                unpaidAmount: form.unpaidAmount ? parseInt(form.unpaidAmount) : undefined,
                paymentDate: form.paymentDate || undefined,
                programStartDate: form.programStartDate || undefined,
                programEndDate: form.programEndDate || undefined,
                trainerMemo: form.trainerMemo || undefined,
              })} className="flex-1 text-xs py-2 bg-primary text-primary-foreground rounded-lg font-semibold disabled:opacity-50">
                {createMutation.isPending ? "생성 중..." : "계약서 생성 및 링크 발급"}
              </button>
            )}
          </div>
        </div>
      )}

      {!list || list.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-4">생성된 계약서가 없습니다</p>
      ) : (
        <div className="space-y-2">
          {list.map((c: any) => {
            const sm = statusMeta[c.status] ?? statusMeta.pending;
            return (
              <div key={c.id} className="bg-background border border-border rounded-xl p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-semibold">{c.memberName || "이름 미입력"}</p>
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${sm.cls}`}>{sm.label}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {c.programName && `${c.programName} · `}{c.createdAt?.slice(0, 10)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => openEdit(c)}
                      className="p-1 rounded-lg hover:bg-muted">
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
                    className="flex-1 flex items-center justify-center gap-1 text-[11px] font-semibold border border-border rounded-lg py-1.5 hover:bg-muted transition-colors">
                    <Copy className="h-3 w-3" /> 링크 복사
                  </button>
                  <button onClick={() => openKakao(c.token)}
                    className="flex-1 flex items-center justify-center gap-1 text-[11px] font-semibold bg-[#FEE500] text-[#3A1D1D] rounded-lg py-1.5 hover:opacity-90 transition-opacity">
                    카카오톡 공유
                  </button>
                  {c.status === "signed" && (
                    <button onClick={() => setDetailId(c.id)}
                      className="flex-1 flex items-center justify-center gap-1 text-[11px] font-semibold bg-primary/10 text-primary rounded-lg py-1.5 hover:bg-primary/20 transition-colors">
                      서명 확인
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 서명 상세 모달 */}
      {detail && (
        <div className="fixed inset-0 z-50 flex items-end">
          <div className="absolute inset-0 bg-black/50" onClick={() => setDetailId(null)} />
          <div className="relative bg-card rounded-t-3xl w-full max-h-[85vh] overflow-y-auto p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold">서명 완료 계약서</h3>
              <button onClick={() => setDetailId(null)}><X className="h-5 w-5" /></button>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {[
                ["이름", detail.memberName], ["연락처", detail.memberPhone],
                ["프로그램", detail.programName], ["서명자", detail.signerName],
                ["서명일시", detail.signedAt?.slice(0, 16)],
                ["마케팅 동의", detail.agreedMarketing ? "동의" : "비동의"],
              ].filter(r => r[1]).map(([label, value]) => (
                <div key={label} className="bg-accent/30 rounded-lg px-3 py-2">
                  <p className="text-[10px] text-muted-foreground">{label}</p>
                  <p className="font-semibold mt-0.5">{value}</p>
                </div>
              ))}
            </div>
            {detail.signaturePng && (
              <div className="space-y-1">
                <p className="text-xs font-semibold text-muted-foreground">서명 이미지</p>
                <div className="border border-border rounded-xl p-3 bg-white">
                  <img src={detail.signaturePng} className="w-full h-24 object-contain" />
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
