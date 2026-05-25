import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { ArrowRightLeft, X, Copy, Check } from "lucide-react";
import { toast } from "sonner";

type PtPkg = { id: number; packageName: string | null; totalSessions: number; usedSessions: number };
export type MemberBasic = { id: number; name: string; phone: string | null };

const ITEM_TYPES = [
  { key: "pt_package", label: "PT권" },
  { key: "membership", label: "헬스권" },
  { key: "uniform", label: "운동복" },
  { key: "locker", label: "락커" },
] as const;

export function TransferModal({
  member,
  allMembers,
  ptPackages,
  onClose,
}: {
  member: MemberBasic;
  allMembers: MemberBasic[];
  ptPackages: PtPkg[];
  onClose: () => void;
}) {
  const [step, setStep] = useState<"item" | "transferee" | "done">("item");
  const [selectedTypes, setSelectedTypes] = useState<string[]>(["pt_package"]);
  const [selectedPkgIds, setSelectedPkgIds] = useState<number[]>(
    ptPackages[0] ? [ptPackages[0].id] : []
  );
  const [transfereeType, setTransfeeType] = useState<"existing" | "new">("existing");
  const [search, setSearch] = useState("");
  const [selectedTransferee, setSelectedTransferee] = useState<MemberBasic | null>(null);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newBirth, setNewBirth] = useState("");
  const [contractUrl, setContractUrl] = useState("");
  const [copied, setCopied] = useState(false);

  const createTransfer = trpc.transfer.createTransfer.useMutation({
    onSuccess: (data) => {
      setContractUrl(window.location.origin + data.contractUrl);
      setStep("done");
    },
    onError: (e) => toast.error(e.message),
  });

  const filteredMembers = allMembers.filter((m) =>
    m.id !== member.id &&
    (m.name.includes(search) || (m.phone && m.phone.includes(search)))
  );

  function toggleType(key: string) {
    setSelectedTypes((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  }

  function togglePkg(id: number) {
    setSelectedPkgIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  }

  function buildItemDescription() {
    const parts: string[] = [];
    for (const t of ITEM_TYPES) {
      if (!selectedTypes.includes(t.key)) continue;
      if (t.key === "pt_package") {
        const selected = ptPackages.filter((p) => selectedPkgIds.includes(p.id));
        if (selected.length > 0) {
          selected.forEach((p) => {
            parts.push(`PT권 - ${p.packageName ?? "패키지"} (잔여 ${p.totalSessions - p.usedSessions}회)`);
          });
        } else {
          parts.push("PT권");
        }
      } else {
        parts.push(t.label);
      }
    }
    return parts.join(", ");
  }

  function handleCreate() {
    if (selectedTypes.length === 0) { toast.error("양도 항목을 선택해주세요"); return; }
    const isExisting = transfereeType === "existing";
    if (isExisting && !selectedTransferee) { toast.error("양수인을 선택해주세요"); return; }
    if (!isExisting && !newName.trim()) { toast.error("양수인 이름을 입력해주세요"); return; }

    const primaryType = selectedTypes.includes("pt_package") ? "pt_package"
      : selectedTypes.includes("membership") ? "membership"
      : selectedTypes.includes("uniform") ? "uniform"
      : "locker";

    const primaryPkgId = primaryType === "pt_package"
      ? selectedPkgIds[0] ?? undefined
      : undefined;

    createTransfer.mutate({
      transferorMemberId: member.id,
      itemType: primaryType,
      itemId: primaryPkgId,
      itemDescription: buildItemDescription(),
      transfereeMemberId: isExisting ? selectedTransferee!.id : undefined,
      transfereeName: isExisting ? selectedTransferee!.name : newName.trim(),
      transfereePhone: isExisting ? (selectedTransferee!.phone ?? undefined) : (newPhone.trim() || undefined),
      transfereeBirthDate: !isExisting ? (newBirth || undefined) : undefined,
    });
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(contractUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success("링크 복사됨");
    } catch {
      toast.error("복사 실패");
    }
  }

  function shareKakao() {
    if (navigator.share) {
      navigator.share({ title: "자이언트짐 양도양수 계약서", url: contractUrl });
    } else {
      copyLink();
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-background rounded-2xl w-full max-w-md max-h-[85vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border sticky top-0 bg-background">
          <div className="flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5 text-orange-400" />
            <h2 className="font-bold">양도양수 계약서 작성</h2>
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

          {step === "item" && (
            <div className="space-y-4">
              <div>
                <label className="text-xs text-muted-foreground mb-2 block">양도 항목 (복수 선택 가능)</label>
                <div className="grid grid-cols-2 gap-2">
                  {ITEM_TYPES.map(({ key, label }) => (
                    <button
                      key={key}
                      onClick={() => toggleType(key)}
                      className={`py-2.5 rounded-xl text-sm font-medium border transition-colors ${
                        selectedTypes.includes(key)
                          ? "border-orange-400 bg-orange-400/10 text-orange-400"
                          : "border-border text-muted-foreground hover:border-orange-400/40"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {selectedTypes.includes("pt_package") && ptPackages.length > 0 && (
                <div>
                  <label className="text-xs text-muted-foreground mb-2 block">PT 패키지 선택 (복수 가능)</label>
                  <div className="space-y-2">
                    {ptPackages.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => togglePkg(p.id)}
                        className={`w-full text-left p-3 rounded-xl border text-sm transition-colors ${
                          selectedPkgIds.includes(p.id)
                            ? "border-orange-400 bg-orange-400/10"
                            : "border-border hover:border-orange-400/40"
                        }`}
                      >
                        <span className="font-medium">{p.packageName ?? "PT 패키지"}</span>
                        <span className="text-muted-foreground ml-2">잔여 {p.totalSessions - p.usedSessions}회</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {selectedTypes.length > 0 && (
                <div className="bg-muted/30 rounded-xl px-3 py-2 text-xs text-muted-foreground">
                  양도 항목: <span className="text-foreground font-medium">{buildItemDescription()}</span>
                </div>
              )}

              <button
                onClick={() => {
                  if (selectedTypes.length === 0) { toast.error("양도 항목을 선택해주세요"); return; }
                  setStep("transferee");
                }}
                className="w-full py-3 rounded-xl bg-orange-500 text-white font-medium text-sm hover:bg-orange-600"
              >
                다음 — 양수인 정보 입력
              </button>
            </div>
          )}

          {step === "transferee" && (
            <div className="space-y-4">
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

              <div className="flex gap-2">
                <button onClick={() => setStep("item")} className="flex-1 py-3 rounded-xl border border-border text-sm text-muted-foreground hover:bg-muted/40">
                  이전
                </button>
                <button
                  onClick={handleCreate}
                  disabled={createTransfer.isPending}
                  className="flex-1 py-3 rounded-xl bg-orange-500 text-white font-medium text-sm hover:bg-orange-600 disabled:opacity-50"
                >
                  {createTransfer.isPending ? "생성 중..." : "계약서 생성"}
                </button>
              </div>
            </div>
          )}

          {step === "done" && (
            <div className="space-y-4">
              <div className="text-center space-y-2 py-2">
                <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center mx-auto">
                  <Check className="h-6 w-6 text-green-400" />
                </div>
                <p className="font-semibold">계약서가 생성되었습니다</p>
                <p className="text-xs text-muted-foreground">아래 링크를 양도인에게 먼저 전달하세요<br />양도인 서명 → 양수인 서명 순서로 진행됩니다</p>
              </div>

              <div className="bg-muted/40 rounded-xl p-3 text-xs text-muted-foreground break-all">
                {contractUrl}
              </div>

              <div className="space-y-2">
                <button
                  onClick={copyLink}
                  className="w-full py-3 rounded-xl border border-border text-sm font-medium flex items-center justify-center gap-2 hover:bg-muted/40"
                >
                  {copied ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
                  {copied ? "복사됨!" : "링크 복사"}
                </button>
                <button
                  onClick={shareKakao}
                  className="w-full py-3 rounded-xl bg-yellow-400 text-yellow-900 font-medium text-sm hover:bg-yellow-500"
                >
                  카카오톡으로 공유
                </button>
              </div>

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
