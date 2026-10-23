import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Portal } from "./Portal";
import { Search, X } from "lucide-react";

export type GrantKind = "health" | "pt" | "locker" | "uniform";
export const GRANT_LABEL: Record<GrantKind, string> = { health: "헬스", pt: "PT", locker: "락커", uniform: "운동복" };

const DAY_PRESETS = [7, 14, 30, 60, 90];
const PT_PRESETS = [1, 2, 3, 5, 10];

/** 계약 후 서비스 지급 — 계약서는 그대로 두고 각 항목에 추가만 한다 */
export function ServiceGrantModal({ initialKind = "health", onClose, onDone }: {
  initialKind?: GrantKind; onClose: () => void; onDone?: () => void;
}) {
  const utils = trpc.useUtils();
  const { data: me } = trpc.auth.me.useQuery();
  const { data: allMembers = [] } = trpc.access.getMembersForLocker.useQuery();
  // 트레이너는 담당 회원만
  const memberList = me?.role === "trainer" ? (allMembers as any[]).filter(m => m.trainerId === (me as any).trainerId) : allMembers;
  const { data: lockers = [] } = trpc.access.getLockers.useQuery();
  const [kind, setKind] = useState<GrantKind>(initialKind);
  const [search, setSearch] = useState("");
  const [member, setMember] = useState<{ id: number; name: string } | null>(null);
  const [days, setDays] = useState(30);
  const [sessions, setSessions] = useState(1);
  const [lockerId, setLockerId] = useState<number | null>(null);
  const [reason, setReason] = useState("");

  const matches = useMemo(() => {
    const q = search.trim();
    if (!q || member) return [];
    const digits = q.replace(/\D/g, "");
    return (memberList as any[]).filter(m => m.name.includes(q) || (digits && (m.phone ?? "").replace(/\D/g, "").includes(digits))).slice(0, 8);
  }, [search, memberList, member]);
  const emptyLockers = useMemo(
    () => (lockers as any[]).filter(l => l.isOccupied !== 1).sort((a, b) => String(a.lockerNumber).localeCompare(String(b.lockerNumber), undefined, { numeric: true })),
    [lockers],
  );

  const grant = trpc.access.grantService.useMutation({
    onSuccess: (r) => {
      const what = kind === "pt" ? `PT ${r.quantity}회` : `${GRANT_LABEL[kind]} ${r.quantity}일 (${r.startDate} ~ ${r.endDate})`;
      toast.success(`${member?.name} · 서비스 ${what} 지급 완료`);
      utils.access.invalidate();
      utils.pt.invalidate();
      onDone?.();
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  const canSubmit = !!member && reason.trim().length > 0 && !grant.isPending
    && (kind === "pt" ? sessions >= 1 : days >= 1) && (kind !== "locker" || !!lockerId);
  const chip = (on: boolean) => `px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${on ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground bg-background hover:text-foreground"}`;
  const input = "w-full bg-input border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring";

  return (
    <Portal>
      <div className="fixed inset-0 z-[200] bg-black/70 flex items-end md:items-center justify-center" onClick={onClose}>
        <div className="bg-card border border-border rounded-t-2xl md:rounded-2xl w-full md:max-w-md flex flex-col" style={{ maxHeight: "90svh" }} onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
            <div>
              <h3 className="font-bold text-base">서비스 추가</h3>
              <p className="text-[11px] text-muted-foreground">계약서는 그대로 두고 서비스만 추가로 지급하며, 지급 이력이 남습니다</p>
            </div>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
          </div>

          <div className="overflow-y-auto px-4 py-4 space-y-4">
            {/* 종류 */}
            <div className="grid grid-cols-4 gap-1.5">
              {(Object.keys(GRANT_LABEL) as GrantKind[]).map(k => (
                <button key={k} type="button" className={chip(kind === k)} onClick={() => setKind(k)}>{GRANT_LABEL[k]}</button>
              ))}
            </div>

            {/* 회원 */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">회원</label>
              {member ? (
                <div className="text-sm px-3 py-2 rounded-lg bg-primary/10 text-primary font-medium flex items-center justify-between">
                  ✓ {member.name}
                  <button className="text-muted-foreground hover:text-foreground" onClick={() => { setMember(null); setSearch(""); }}>변경</button>
                </div>
              ) : (
                <>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <input className={`${input} pl-8`} placeholder="이름 또는 전화번호" value={search} onChange={e => setSearch(e.target.value)} />
                  </div>
                  {matches.length > 0 && (
                    <div className="border border-border rounded-lg divide-y divide-border max-h-44 overflow-y-auto">
                      {matches.map((m: any) => (
                        <button key={m.id} type="button" onClick={() => setMember({ id: m.id, name: m.name })}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-accent/40 flex justify-between">
                          <span>{m.name}</span><span className="text-xs text-muted-foreground">{m.phone ?? ""}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* 수량 */}
            {kind === "pt" ? (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">서비스 PT 횟수</label>
                <div className="flex gap-1.5 flex-wrap items-center">
                  {PT_PRESETS.map(n => <button key={n} type="button" className={chip(sessions === n)} onClick={() => setSessions(n)}>{n}회</button>)}
                  <input type="number" min={1} max={100} value={sessions} onChange={e => setSessions(Number(e.target.value))} className="w-20 bg-input border border-border rounded-lg px-2 py-1.5 text-sm text-center" />
                </div>
                <p className="text-[11px] text-muted-foreground">담당 트레이너 앞으로 0원 서비스 이용권이 새로 생깁니다</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">서비스 기간</label>
                <div className="flex gap-1.5 flex-wrap items-center">
                  {DAY_PRESETS.map(n => <button key={n} type="button" className={chip(days === n)} onClick={() => setDays(n)}>{n}일</button>)}
                  <input type="number" min={1} max={730} value={days} onChange={e => setDays(Number(e.target.value))} className="w-20 bg-input border border-border rounded-lg px-2 py-1.5 text-sm text-center" />
                  <span className="text-xs text-muted-foreground">일</span>
                </div>
                {kind === "health" && <p className="text-[11px] text-muted-foreground">남은 회원권이 있으면 만료일 다음 날부터 이어서 연장됩니다</p>}
              </div>
            )}

            {kind === "locker" && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">빈 락커 ({emptyLockers.length}개)</label>
                <select className={input} value={lockerId ?? ""} onChange={e => setLockerId(e.target.value ? Number(e.target.value) : null)}>
                  <option value="">락커 선택</option>
                  {emptyLockers.map((l: any) => <option key={l.id} value={l.id}>{l.lockerNumber}번{l.lockerType ? ` · ${l.lockerType}` : ""}</option>)}
                </select>
              </div>
            )}

            {/* 사유 */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">지급 사유 *</label>
              <input className={input} placeholder="예: 재등록 감사, 이벤트, 불편 보상" value={reason} onChange={e => setReason(e.target.value)} />
            </div>
          </div>

          <div className="flex gap-2 px-4 py-3 border-t border-border shrink-0">
            <button className="flex-1 py-2.5 rounded-xl border border-border text-sm" onClick={onClose}>취소</button>
            <button className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50"
              disabled={!canSubmit}
              onClick={() => member && grant.mutate({
                memberId: member.id, kind, reason: reason.trim(),
                ...(kind === "pt" ? { sessions } : { days }),
                ...(kind === "locker" && lockerId ? { lockerId } : {}),
              })}>
              {grant.isPending ? "지급 중..." : `${GRANT_LABEL[kind]} ${kind === "pt" ? `${sessions}회` : `${days}일`} 지급`}
            </button>
          </div>
        </div>
      </div>
    </Portal>
  );
}
