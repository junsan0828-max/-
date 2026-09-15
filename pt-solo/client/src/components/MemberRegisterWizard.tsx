import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { UserPlus, RefreshCw, ChevronDown, ChevronLeft, X, Check, Search, MessageSquare } from "lucide-react";

const DRAFT_KEY = "fitstep_member_draft";

const PRESET_PACKAGES = [
  { label: "PT 10회", sessions: 10 },
  { label: "PT 20회", sessions: 20 },
  { label: "PT 30회", sessions: 30 },
];

type Draft = {
  mode: "new" | "renew" | "consultation" | null;
  name: string;
  phone: string;
  gender: string;
  birthDate: string;
  visitRoute: string;
  consultMemo: string;
  sessions: number | null;
  customSessions: string;
  paidAmount: string;
  membershipStart: string;
  membershipEnd: string;
  paymentMethod: string;
  step: number;
};

const EMPTY: Draft = {
  mode: null, name: "", phone: "", gender: "", birthDate: "", visitRoute: "", consultMemo: "",
  sessions: null, customSessions: "", paidAmount: "", membershipStart: "", membershipEnd: "",
  paymentMethod: "", step: 1,
};

export function readDraft(): Draft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as Draft;
    return d.name?.trim() ? d : null;
  } catch { return null; }
}

export function clearDraft() {
  try { localStorage.removeItem(DRAFT_KEY); } catch { /* 저장소 차단 환경 */ }
}

export default function MemberRegisterWizard({ open, onClose, resumeDraft }: {
  open: boolean;
  onClose: () => void;
  resumeDraft?: boolean;
}) {
  const [, navigate] = useLocation();
  const [d, setD] = useState<Draft>(EMPTY);
  const [detailOpen, setDetailOpen] = useState(false);
  const [done, setDone] = useState<{ id: number; name: string } | null>(null);
  const [renewSearch, setRenewSearch] = useState("");
  const [renewTarget, setRenewTarget] = useState<{ id: number; name: string } | null>(null);

  const utils = trpc.useUtils();
  const createMutation = trpc.members.create.useMutation();
  const addPackageMutation = trpc.pt.addPackage.useMutation();
  const createLeadMutation = trpc.leads.create.useMutation();
  const { data: lowSessions = [] } = trpc.members.getLowSessions.useQuery({ threshold: 6 }, { enabled: open && d.mode === "renew" });
  const { data: allMembers = [] } = trpc.members.list.useQuery(undefined, { enabled: open && d.mode === "renew" });

  useEffect(() => {
    if (!open) return;
    setDone(null);
    setDetailOpen(false);
    setRenewTarget(null);
    setRenewSearch("");
    setD(resumeDraft ? (readDraft() ?? EMPTY) : EMPTY);
  }, [open, resumeDraft]);

  function set<K extends keyof Draft>(k: K, v: Draft[K]) {
    setD(prev => ({ ...prev, [k]: v }));
  }

  // 이름이 있으면 중간 이탈 시 임시 저장
  function handleClose() {
    if (!done && d.name.trim()) {
      try { localStorage.setItem(DRAFT_KEY, JSON.stringify(d)); } catch { /* 저장소 차단 환경 */ }
      toast("작성 중인 내용을 저장했어요.");
    }
    onClose();
  }

  const sessions = d.sessions ?? (parseInt(d.customSessions) || 0);

  async function submitNew() {
    if (!d.name.trim()) return;
    const payload: any = { name: d.name.trim(), grade: "basic", status: "active" };
    if (d.phone.trim()) payload.phone = d.phone.trim();
    if (d.gender) payload.gender = d.gender;
    if (d.birthDate) payload.birthDate = d.birthDate;
    if (d.visitRoute) payload.visitRoute = d.visitRoute;
    if (d.membershipStart) payload.membershipStart = d.membershipStart;
    if (d.membershipEnd) payload.membershipEnd = d.membershipEnd;
    if (sessions > 0) {
      payload.hasContract = true;
      payload.ptSessions = String(sessions);
      if (d.paidAmount) payload.paidAmount = Number(d.paidAmount.replace(/[^0-9]/g, ""));
      if (d.paymentMethod) payload.paymentMethod = d.paymentMethod;
    }
    try {
      const result = await createMutation.mutateAsync(payload);
      clearDraft();
      utils.members.list.invalidate();
      utils.dashboard.getStats.invalidate();
      setDone({ id: result.id, name: d.name.trim() });
    } catch (err: any) {
      toast.error(err.message || "등록에 실패했어요.");
    }
  }

  async function submitRenew() {
    if (!renewTarget || sessions <= 0) return;
    try {
      await addPackageMutation.mutateAsync({
        memberId: renewTarget.id,
        totalSessions: sessions,
        ...(d.paidAmount ? { paymentAmount: Number(d.paidAmount.replace(/[^0-9]/g, "")) } : {}),
        ...(d.paymentMethod ? { paymentMethod: d.paymentMethod as any } : {}),
        ...(d.membershipStart ? { startDate: d.membershipStart } : {}),
        ...(d.membershipEnd ? { expiryDate: d.membershipEnd } : {}),
      });
      clearDraft();
      utils.members.list.invalidate();
      utils.dashboard.getStats.invalidate();
      setDone({ id: renewTarget.id, name: renewTarget.name });
    } catch (err: any) {
      toast.error(err.message || "재등록에 실패했어요.");
    }
  }

  async function submitConsultation() {
    if (!d.name.trim()) return;
    try {
      const payload: any = { name: d.name.trim() };
      if (d.phone.trim()) payload.phone = d.phone.trim();
      const noteParts: string[] = [];
      if (d.visitRoute) noteParts.push(`유입: ${d.visitRoute}`);
      if (d.consultMemo.trim()) noteParts.push(d.consultMemo.trim());
      if (noteParts.length > 0) payload.consultationNote = noteParts.join("\n");
      await createLeadMutation.mutateAsync(payload);
      clearDraft();
      utils.leads.invalidate();
      setDone({ id: 0, name: d.name.trim() });
    } catch (err: any) {
      toast.error(err.message || "상담 등록에 실패했어요.");
    }
  }

  if (!open) return null;

  const busy = createMutation.isPending || addPackageMutation.isPending || createLeadMutation.isPending;
  const renewCandidates = renewSearch.trim()
    ? (allMembers as any[]).filter(m => m.name.includes(renewSearch.trim()))
    : (lowSessions as any[]);

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={handleClose} />
      <div className="relative w-full sm:w-[400px] sm:max-w-[calc(100vw-2rem)] bg-card border-t sm:border border-border sm:rounded-2xl rounded-t-3xl shadow-2xl flex flex-col"
        style={{ maxHeight: "min(88dvh, 640px)" }}>

        {/* 헤더 */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border shrink-0">
          {d.step > 1 && !done && (
            <button onClick={() => set("step", d.step - 1)} className="text-muted-foreground hover:text-foreground -ml-1 p-0.5">
              <ChevronLeft className="h-5 w-5" />
            </button>
          )}
          <span className="text-sm font-semibold flex-1">
            {done ? (d.mode === "consultation" ? "상담 등록 완료" : "등록 완료") : d.mode === "renew" ? "재등록" : d.mode === "consultation" ? "상담 등록" : "회원 등록"}
          </span>
          {!done && d.mode !== "consultation" && <span className="text-[11px] text-muted-foreground">{d.step} / 3</span>}
          <button onClick={handleClose} className="text-muted-foreground hover:text-foreground p-0.5">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-5 min-h-0">
          {/* ───── 완료 ───── */}
          {done ? (
            <div className="space-y-5 text-center">
              <div className="w-14 h-14 rounded-full bg-green-500/10 flex items-center justify-center mx-auto">
                <Check className="h-7 w-7 text-green-500" />
              </div>
              <div>
                <p className="text-sm font-semibold">{done.name} {d.mode === "consultation" ? "상담" : d.mode === "renew" ? "재등록" : "등록"} 완료</p>
                {d.mode !== "consultation" && sessions > 0 && <p className="text-xs text-muted-foreground mt-1">PT {sessions}회가 함께 등록됐어요.</p>}
                {d.mode === "consultation" && <p className="text-xs text-muted-foreground mt-1">상담 목록에 추가됐어요.</p>}
              </div>
              <div className="space-y-2 pt-2">
                <p className="text-[11px] font-semibold text-muted-foreground">다음 할 일</p>
                {d.mode === "consultation" ? (
                  <button onClick={() => { navigate("/leads"); onClose(); }}
                    className="w-full py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90">
                    상담 목록 보기
                  </button>
                ) : (
                  <button onClick={() => { navigate(`/members/${done.id}`); onClose(); }}
                    className="w-full py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90">
                    {d.mode === "renew" ? "입금 처리하기" : "첫 수업 기록하기"}
                  </button>
                )}
                <button onClick={onClose}
                  className="w-full py-3 rounded-xl border border-border text-sm font-medium text-muted-foreground hover:bg-accent/50">
                  나중에
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* ───── 1단계: 상담 / 신규 등록 / 재등록 ───── */}
              {d.step === 1 && (
                <div className="space-y-3">
                  <p className="text-sm font-semibold mb-4">어떤 건가요?</p>
                  <button onClick={() => setD(p => ({ ...p, mode: "consultation", step: 2 }))}
                    className="w-full flex items-center gap-3 p-4 rounded-2xl border border-border hover:border-primary hover:bg-accent/40 transition-colors text-left">
                    <div className="w-9 h-9 rounded-xl bg-violet-500/10 flex items-center justify-center shrink-0">
                      <MessageSquare className="h-4 w-4 text-violet-500" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">상담</p>
                      <p className="text-[11px] text-muted-foreground">상담 고객 정보 기록</p>
                    </div>
                  </button>
                  <button onClick={() => setD(p => ({ ...p, mode: "new", step: 2 }))}
                    className="w-full flex items-center gap-3 p-4 rounded-2xl border border-border hover:border-primary hover:bg-accent/40 transition-colors text-left">
                    <div className="w-9 h-9 rounded-xl bg-indigo-500/10 flex items-center justify-center shrink-0">
                      <UserPlus className="h-4 w-4 text-indigo-500" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">신규 등록</p>
                      <p className="text-[11px] text-muted-foreground">처음 등록하는 회원</p>
                    </div>
                  </button>
                  <button onClick={() => setD(p => ({ ...p, mode: "renew", step: 2 }))}
                    className="w-full flex items-center gap-3 p-4 rounded-2xl border border-border hover:border-primary hover:bg-accent/40 transition-colors text-left">
                    <div className="w-9 h-9 rounded-xl bg-teal-500/10 flex items-center justify-center shrink-0">
                      <RefreshCw className="h-4 w-4 text-teal-500" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">재등록</p>
                      <p className="text-[11px] text-muted-foreground">기존 회원에게 세션 추가</p>
                    </div>
                  </button>
                </div>
              )}

              {/* ───── 2단계 (신규): 이름 · 연락처 ───── */}
              {d.step === 2 && d.mode === "new" && (
                <div className="space-y-4">
                  <p className="text-sm font-semibold">이름과 연락처</p>
                  <input autoFocus value={d.name} onChange={e => set("name", e.target.value)} placeholder="이름"
                    className="w-full px-3 py-3 text-sm rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/40" />
                  <input value={d.phone} onChange={e => set("phone", e.target.value)} placeholder="연락처 (선택)" inputMode="numeric"
                    className="w-full px-3 py-3 text-sm rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/40" />

                  <button onClick={() => setDetailOpen(v => !v)}
                    className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground">
                    상세히 적기
                    <ChevronDown className={`h-3 w-3 transition-transform ${detailOpen ? "rotate-180" : ""}`} />
                  </button>
                  {detailOpen && (
                    <div className="space-y-2.5 pt-1">
                      <div className="flex gap-2">
                        {[{ v: "male", l: "남성" }, { v: "female", l: "여성" }].map(g => (
                          <button key={g.v} onClick={() => set("gender", d.gender === g.v ? "" : g.v)}
                            className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-colors ${
                              d.gender === g.v ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"
                            }`}>{g.l}</button>
                        ))}
                      </div>
                      <input value={d.birthDate} onChange={e => set("birthDate", e.target.value)} placeholder="생년월일 (2000-01-01)"
                        className="w-full px-3 py-2.5 text-sm rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/40" />
                      <input value={d.visitRoute} onChange={e => set("visitRoute", e.target.value)} placeholder="유입 경로 (인스타, 지인 소개 등)"
                        className="w-full px-3 py-2.5 text-sm rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/40" />
                    </div>
                  )}

                  <button onClick={() => set("step", 3)} disabled={!d.name.trim()}
                    className="w-full py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-40 hover:opacity-90">
                    다음
                  </button>
                </div>
              )}

              {/* ───── 2단계 (재등록): 회원 선택 ───── */}
              {d.step === 2 && d.mode === "renew" && (
                <div className="space-y-3">
                  <p className="text-sm font-semibold">누구를 재등록할까요?</p>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <input value={renewSearch} onChange={e => setRenewSearch(e.target.value)} placeholder="회원 이름 검색"
                      className="w-full pl-9 pr-3 py-2.5 text-sm rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/40" />
                  </div>
                  {!renewSearch.trim() && (
                    <p className="text-[11px] text-muted-foreground">잔여 6회 이하 · 재등록 안내가 필요한 회원</p>
                  )}
                  <div className="space-y-1.5 max-h-60 overflow-y-auto">
                    {renewCandidates.length === 0 && (
                      <p className="text-[11px] text-muted-foreground text-center py-6">
                        {renewSearch.trim() ? "검색 결과가 없어요." : "재등록 대상 회원이 없어요. 이름으로 검색해보세요."}
                      </p>
                    )}
                    {renewCandidates.slice(0, 30).map((m: any) => (
                      <button key={m.id}
                        onClick={() => { setRenewTarget({ id: m.id, name: m.name }); setD(p => ({ ...p, name: m.name, step: 3 })); }}
                        className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl border border-border hover:border-primary hover:bg-accent/40 transition-colors text-left">
                        <span className="text-sm font-medium">{m.name}</span>
                        {m.remainingSessions != null && (
                          <span className="text-[11px] text-muted-foreground">잔여 {m.remainingSessions}회</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* ───── 2단계 (상담): 이름·연락처·메모 ───── */}
              {d.step === 2 && d.mode === "consultation" && (
                <div className="space-y-4">
                  <p className="text-sm font-semibold">상담 고객 정보</p>
                  <input autoFocus value={d.name} onChange={e => set("name", e.target.value)} placeholder="이름"
                    className="w-full px-3 py-3 text-sm rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/40" />
                  <input value={d.phone} onChange={e => set("phone", e.target.value)} placeholder="연락처 (선택)" inputMode="numeric"
                    className="w-full px-3 py-3 text-sm rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/40" />
                  <input value={d.visitRoute} onChange={e => set("visitRoute", e.target.value)} placeholder="유입 경로 (인스타, 지인 소개 등)"
                    className="w-full px-3 py-3 text-sm rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/40" />
                  <textarea value={d.consultMemo} onChange={e => set("consultMemo", e.target.value)} placeholder="상담 메모 (목적, 특이사항 등)" rows={3}
                    className="w-full px-3 py-3 text-sm rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none" />
                  <button onClick={submitConsultation} disabled={!d.name.trim() || busy}
                    className="w-full py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-40 hover:opacity-90">
                    {busy ? "등록 중..." : "상담 등록"}
                  </button>
                </div>
              )}

              {/* ───── 3단계: 프로그램 ───── */}
              {d.step === 3 && (
                <div className="space-y-4">
                  <p className="text-sm font-semibold">프로그램</p>
                  <div className="grid grid-cols-2 gap-2">
                    {PRESET_PACKAGES.map(p => (
                      <button key={p.sessions}
                        onClick={() => setD(prev => ({ ...prev, sessions: prev.sessions === p.sessions ? null : p.sessions, customSessions: "" }))}
                        className={`py-3 rounded-xl text-sm font-semibold border transition-colors ${
                          d.sessions === p.sessions ? "border-primary bg-primary/10 text-primary" : "border-border text-foreground hover:bg-accent/40"
                        }`}>{p.label}</button>
                    ))}
                    <input value={d.customSessions}
                      onChange={e => setD(prev => ({ ...prev, customSessions: e.target.value.replace(/[^0-9]/g, ""), sessions: null }))}
                      placeholder="직접 입력" inputMode="numeric"
                      className="py-3 px-3 rounded-xl text-sm text-center border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/40" />
                  </div>

                  <button onClick={() => setDetailOpen(v => !v)}
                    className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground">
                    상세히 적기
                    <ChevronDown className={`h-3 w-3 transition-transform ${detailOpen ? "rotate-180" : ""}`} />
                  </button>
                  {detailOpen && (
                    <div className="space-y-2.5 pt-1">
                      <input value={d.paidAmount} onChange={e => set("paidAmount", e.target.value.replace(/[^0-9]/g, ""))}
                        placeholder="결제 금액" inputMode="numeric"
                        className="w-full px-3 py-2.5 text-sm rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/40" />
                      <div className="grid grid-cols-4 gap-1.5">
                        {["카드", "현금", "계좌이체", "지역화폐"].map(pm => (
                          <button key={pm} onClick={() => set("paymentMethod", d.paymentMethod === pm ? "" : pm)}
                            className={`py-2 rounded-lg text-[11px] font-semibold border transition-colors ${
                              d.paymentMethod === pm ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"
                            }`}>{pm}</button>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <input value={d.membershipStart} onChange={e => set("membershipStart", e.target.value)} placeholder="시작일"
                          className="flex-1 min-w-0 px-3 py-2.5 text-sm rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/40" />
                        <input value={d.membershipEnd} onChange={e => set("membershipEnd", e.target.value)} placeholder="만료일"
                          className="flex-1 min-w-0 px-3 py-2.5 text-sm rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/40" />
                      </div>
                    </div>
                  )}

                  <button onClick={d.mode === "renew" ? submitRenew : submitNew}
                    disabled={busy || (d.mode === "renew" && sessions <= 0)}
                    className="w-full py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-40 hover:opacity-90">
                    {busy ? "등록 중..." : d.mode === "renew" ? "재등록 완료" : sessions > 0 ? "등록 완료" : "프로그램 없이 등록"}
                  </button>
                  {d.mode === "new" && sessions <= 0 && (
                    <p className="text-[11px] text-muted-foreground text-center">프로그램은 나중에 추가할 수 있어요.</p>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
