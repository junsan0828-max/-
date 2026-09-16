import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { ArrowRightLeft, X, Check } from "lucide-react";
import { toast } from "sonner";

export type MemberBasic = { id: number; name: string; phone: string | null };

export function TransferModal({
  member,
  allMembers,
  onClose,
}: {
  member: MemberBasic;
  allMembers: MemberBasic[];
  onClose: () => void;
}) {
  const [transfereeType, setTransfeeType] = useState<"existing" | "new">("existing");
  const [search, setSearch] = useState("");
  const [selectedTransferee, setSelectedTransferee] = useState<MemberBasic | null>(null);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newBirth, setNewBirth] = useState("");
  const [transferred, setTransferred] = useState<string[]>([]);
  const [done, setDone] = useState(false);

  const createTransfer = trpc.transfer.createTransfer.useMutation({
    onSuccess: (data) => {
      setTransferred(data.transferred ?? []);
      setDone(true);
    },
    onError: (e) => toast.error(e.message),
  });

  const deduped = allMembers.reduce<MemberBasic[]>((acc, m) => {
    if (m.id === member.id) return acc;
    const digits = m.phone?.replace(/\D/g, "") ?? "";
    const key = digits.length >= 7 ? `${m.name}||${digits}` : `__${m.id}`;
    if (!acc.some((a) => {
      const ad = a.phone?.replace(/\D/g, "") ?? "";
      const ak = ad.length >= 7 ? `${a.name}||${ad}` : `__${a.id}`;
      return ak === key;
    })) acc.push(m);
    return acc;
  }, []);

  const filteredMembers = deduped.filter((m) => {
    const q = search.trim();
    if (!q) return true;
    const digits = m.phone?.replace(/\D/g, "") ?? "";
    const qDigits = q.replace(/\D/g, "");
    return m.name.includes(q) || (qDigits.length > 0 && digits.includes(qDigits));
  });

  function handleCreate() {
    const isExisting = transfereeType === "existing";
    if (isExisting && !selectedTransferee) { toast.error("양수인을 선택해주세요"); return; }
    if (!isExisting && !newName.trim()) { toast.error("양수인 이름을 입력해주세요"); return; }

    createTransfer.mutate({
      transferorMemberId: member.id,
      transfereeMemberId: isExisting ? selectedTransferee!.id : undefined,
      transfereeName: isExisting ? selectedTransferee!.name : newName.trim(),
      transfereePhone: isExisting ? (selectedTransferee!.phone ?? undefined) : (newPhone.trim() || undefined),
      transfereeBirthDate: !isExisting ? (newBirth || undefined) : undefined,
    });
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-background rounded-2xl w-full max-w-md max-h-[85vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border sticky top-0 bg-background">
          <div className="flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5 text-orange-400" />
            <h2 className="font-bold">양도 처리</h2>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          <div className="bg-muted/40 rounded-xl p-3 text-sm">
            <span className="text-muted-foreground">양도인: </span>
            <span className="font-semibold">{member.name}</span>
            {member.phone && <span className="text-muted-foreground ml-2">{member.phone}</span>}
          </div>

          {!done ? (
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground">
                PT 패키지·헬스권·락커·운동복이 모두 양수인에게 즉시 이전됩니다.
              </p>

              <div className="flex gap-2">
                <button
                  onClick={() => setTransfeeType("existing")}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition-colors ${
                    transfereeType === "existing" ? "border-orange-400 bg-orange-400/10 text-orange-400" : "border-border text-muted-foreground"
                  }`}
                >
                  기존 회원
                </button>
                <button
                  onClick={() => setTransfeeType("new")}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition-colors ${
                    transfereeType === "new" ? "border-orange-400 bg-orange-400/10 text-orange-400" : "border-border text-muted-foreground"
                  }`}
                >
                  신규 회원
                </button>
              </div>

              {transfereeType === "existing" && (
                <div className="space-y-2">
                  <input
                    className="w-full border border-border rounded-xl px-3 py-2.5 text-sm bg-background"
                    placeholder="이름 또는 연락처로 검색"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck={false}
                  />
                  <div className="max-h-48 overflow-y-auto space-y-1">
                    {filteredMembers.slice(0, 20).map((m) => (
                      <button
                        key={m.id}
                        onClick={() => setSelectedTransferee(m)}
                        className={`w-full text-left p-3 rounded-xl border text-sm transition-colors ${
                          selectedTransferee?.id === m.id ? "border-orange-400 bg-orange-400/10" : "border-border hover:border-orange-400/40"
                        }`}
                      >
                        <span className="font-medium">{m.name}</span>
                        {m.phone && <span className="text-muted-foreground ml-2">{m.phone}</span>}
                      </button>
                    ))}
                    {filteredMembers.length === 0 && search && (
                      <p className="text-xs text-muted-foreground text-center py-3">검색 결과 없음</p>
                    )}
                  </div>
                </div>
              )}

              {transfereeType === "new" && (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">양수인 이름 *</label>
                    <input className="w-full border border-border rounded-xl px-3 py-2.5 text-sm bg-background"
                      placeholder="이름" value={newName} onChange={(e) => setNewName(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">연락처</label>
                    <input className="w-full border border-border rounded-xl px-3 py-2.5 text-sm bg-background"
                      placeholder="010-0000-0000" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">생년월일</label>
                    <input type="date" className="w-full border border-border rounded-xl px-3 py-2.5 text-sm bg-background"
                      value={newBirth} onChange={(e) => setNewBirth(e.target.value)} />
                  </div>
                </div>
              )}

              <button
                onClick={handleCreate}
                disabled={createTransfer.isPending}
                className="w-full py-3 rounded-xl bg-orange-500 text-white font-medium text-sm hover:bg-orange-600 disabled:opacity-50"
              >
                {createTransfer.isPending ? "처리 중..." : "양도 완료 처리"}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="text-center space-y-2 py-2">
                <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center mx-auto">
                  <Check className="h-6 w-6 text-green-400" />
                </div>
                <p className="font-semibold">양도가 완료되었습니다</p>
                <p className="text-xs text-muted-foreground">양도자는 양도마감 처리되었습니다</p>
              </div>

              {transferred.length > 0 && (
                <div className="bg-muted/30 rounded-xl p-3 space-y-1">
                  <p className="text-xs font-medium text-foreground mb-2">이전된 항목</p>
                  {transferred.map((item, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Check className="h-3 w-3 text-green-400 shrink-0" />
                      {item}
                    </div>
                  ))}
                </div>
              )}

              <button onClick={onClose} className="w-full py-2.5 text-sm text-muted-foreground hover:text-foreground">
                닫기
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
