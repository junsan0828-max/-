import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { X, CalendarCheck, ExternalLink } from "lucide-react";

const DAYS_KO = ["일", "월", "화", "수", "목", "금", "토"];
const TIME_GROUPS = [
  { key: "morning",   label: "오전", times: ["06:00","07:00","08:00","09:00","10:00","11:00"] },
  { key: "lunch",     label: "점심", times: ["12:00","13:00"] },
  { key: "afternoon", label: "오후", times: ["14:00","15:00","16:00","17:00"] },
  { key: "evening",   label: "저녁", times: ["18:00","19:00","20:00","21:00","22:00"] },
];

const STATUS_META: Record<string, { label: string; cls: string }> = {
  pending:   { label: "예약 대기",  cls: "bg-blue-500/15 text-blue-600" },
  confirmed: { label: "예약 확정",  cls: "bg-green-500/15 text-green-600" },
  visited:   { label: "방문 완료",  cls: "bg-violet-500/15 text-violet-600" },
  cancelled: { label: "취소",       cls: "bg-red-500/15 text-red-500" },
  noshow:    { label: "노쇼",       cls: "bg-amber-500/15 text-amber-600" },
};

function ProgramAddInput({ onAdd }: { onAdd: (name: string) => void }) {
  const [val, setVal] = useState("");
  return (
    <div className="flex gap-2">
      <input value={val} onChange={e => setVal(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter" && val.trim()) { onAdd(val.trim()); setVal(""); } }}
        placeholder="프로그램명 입력 후 Enter"
        className="flex-1 bg-background border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
      <button onClick={() => { if (val.trim()) { onAdd(val.trim()); setVal(""); } }}
        className="px-3 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-semibold">추가</button>
    </div>
  );
}

export default function BookingManagementPage() {
  const utils = trpc.useUtils();
  const { data: brand, isLoading: brandLoading } = trpc.brand.getMyBrand.useQuery();
  const updateBrandMutation = trpc.brand.updateMyBrand.useMutation({
    onSuccess: () => { toast.success("저장되었습니다."); utils.brand.getMyBrand.invalidate(); },
    onError: e => toast.error(e.message),
  });

  const [tab, setTab] = useState<"settings" | "schedule" | "list">("list");

  // ── 설정 탭 ──
  const [bkData, setBkData] = useState<any>(null);
  useEffect(() => {
    if (!brand || bkData !== null) return;
    const parsed = brand.brandBlocks ? (() => { try { return JSON.parse(brand.brandBlocks); } catch { return null; } })() : null;
    const bkBlock = parsed?.find((b: any) => b.type === "booking");
    setBkData(bkBlock?.data ?? { enabled: brand.bookingEnabled === 1, message: brand.bookingMessage ?? "", programs: ["PT (퍼스널 트레이닝)", "필라테스", "기타"], buttonText: "", guideText: "" });
  }, [brand]);

  function saveSettings() {
    if (!brand || !bkData) return;
    const parsed = brand.brandBlocks ? (() => { try { return JSON.parse(brand.brandBlocks); } catch { return null; } })() : null;
    let blocks = parsed ?? [];
    if (blocks.some((b: any) => b.type === "booking")) {
      blocks = blocks.map((b: any) => b.type === "booking" ? { ...b, data: bkData } : b);
    } else {
      blocks = [...blocks, { id: "booking", type: "booking", visible: true, data: bkData }];
    }
    updateBrandMutation.mutate({
      bookingEnabled: bkData.enabled ? 1 : 0,
      bookingMessage: bkData.message ?? "",
      brandIsPublic: brand.brandIsPublic ?? 0,
      brandBlocks: JSON.stringify(blocks),
    } as any);
  }

  // ── 시간 관리 탭 ──
  const { data: recurring, refetch: refetchRecurring } = trpc.booking.getRecurring.useQuery();
  const saveRecurringMutation = trpc.booking.saveRecurring.useMutation({ onSuccess: () => refetchRecurring() });
  const generateMutation = trpc.booking.generateFromRecurring.useMutation({
    onSuccess: (d: any) => { toast.success(`${d.created}개 슬롯 생성됨`); },
  });

  const [recurringEdit, setRecurringEdit] = useState<{ dayOfWeek: number; times: string[] }[]>([]);
  const [generateWeeks, setGenerateWeeks] = useState(4);
  const [expandedDay, setExpandedDay] = useState<number | null>(null);
  useEffect(() => {
    setRecurringEdit(
      [0, 1, 2, 3, 4, 5, 6].map(d => ({
        dayOfWeek: d,
        times: (recurring ?? []).find((r: any) => r.dayOfWeek === d)?.times ?? [],
      }))
    );
  }, [recurring]);

  function toggleRecurringTime(dayOfWeek: number, time: string) {
    setRecurringEdit(prev => prev.map(r =>
      r.dayOfWeek === dayOfWeek
        ? { ...r, times: r.times.includes(time) ? r.times.filter(t => t !== time) : [...r.times, time].sort() }
        : r
    ));
  }

  function toggleGroup(dayOfWeek: number, groupTimes: string[]) {
    setRecurringEdit(prev => prev.map(r => {
      if (r.dayOfWeek !== dayOfWeek) return r;
      const allSelected = groupTimes.every(t => r.times.includes(t));
      return allSelected
        ? { ...r, times: r.times.filter(t => !groupTimes.includes(t)) }
        : { ...r, times: [...new Set([...r.times, ...groupTimes])].sort() };
    }));
  }

  function groupState(times: string[], groupTimes: string[]): "all" | "some" | "none" {
    const count = groupTimes.filter(t => times.includes(t)).length;
    if (count === groupTimes.length) return "all";
    if (count > 0) return "some";
    return "none";
  }

  function clearDay(dayOfWeek: number) {
    setRecurringEdit(prev => prev.map(r => r.dayOfWeek === dayOfWeek ? { ...r, times: [] } : r));
  }

  function copyToWeekdays(sourceDayOfWeek: number) {
    const source = recurringEdit.find(r => r.dayOfWeek === sourceDayOfWeek);
    if (!source) return;
    setRecurringEdit(prev => prev.map(r =>
      r.dayOfWeek >= 1 && r.dayOfWeek <= 5 ? { ...r, times: [...source.times] } : r
    ));
  }

  // ── 예약 목록 탭 ──
  const { data: bookingList, refetch: refetchBookings } = trpc.booking.listBookings.useQuery();
  const updateStatusMutation = trpc.booking.updateStatus.useMutation({ onSuccess: () => refetchBookings() });
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [bookingTypeFilter, setBookingTypeFilter] = useState<"class" | "consultation">("class");

  const filteredBookings = (bookingList ?? []).filter((b: any) => {
    const isClass = b.slotId != null;
    if (bookingTypeFilter === "class" && !isClass) return false;
    if (bookingTypeFilter === "consultation" && isClass) return false;
    return statusFilter === "all" || b.status === statusFilter;
  });

  if (brandLoading) return (
    <div className="flex items-center justify-center py-12">
      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-5 pb-8">
      {/* 헤더 */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-xl bg-primary/10">
          <CalendarCheck className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1">
          <h1 className="text-lg font-bold">수업 예약 관리</h1>
          <p className="text-xs text-muted-foreground">예약 설정 · 시간 관리 · 예약 확인</p>
        </div>
        {brand?.username && (
          <button
            onClick={() => window.open(`${window.location.origin}/c/${encodeURIComponent(brand.username)}`, "_blank")}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-primary/30 text-primary text-xs font-semibold hover:bg-primary/5 transition-colors shrink-0"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            미리보기
          </button>
        )}
      </div>

      {/* 탭 */}
      <div className="flex gap-1 bg-muted rounded-xl p-1">
        {(["list", "settings", "schedule"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors ${tab === t ? "bg-background shadow text-foreground" : "text-muted-foreground"}`}>
            {t === "list" ? "예약 목록" : t === "settings" ? "예약 설정" : "시간 관리"}
          </button>
        ))}
      </div>

      {/* ── 예약 목록 탭 ── */}
      {tab === "list" && (
        <div className="space-y-3">
          <div className="flex gap-1 bg-muted rounded-xl p-1">
            {(["class", "consultation"] as const).map(t => (
              <button key={t} onClick={() => setBookingTypeFilter(t)}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors ${bookingTypeFilter === t ? "bg-background shadow text-foreground" : "text-muted-foreground"}`}>
                {t === "class" ? "수업 예약" : "상담 문의"}
              </button>
            ))}
          </div>
          <div className="flex gap-1.5 flex-wrap">
            <button onClick={() => setStatusFilter("all")}
              className={`text-[11px] px-2.5 py-1 rounded-lg border font-semibold transition-colors ${statusFilter === "all" ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border text-muted-foreground"}`}>
              전체
            </button>
            {Object.entries(STATUS_META).map(([k, v]) => (
              <button key={k} onClick={() => setStatusFilter(k)}
                className={`text-[11px] px-2.5 py-1 rounded-lg border font-semibold transition-colors ${statusFilter === k ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border text-muted-foreground"}`}>
                {v.label}
              </button>
            ))}
          </div>
          {filteredBookings.length === 0
            ? <p className="text-xs text-muted-foreground text-center py-8">예약 내역이 없습니다</p>
            : filteredBookings.map((b: any) => (
              <div key={b.id} className="bg-card border border-border rounded-xl p-3.5 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold">{b.name}</p>
                    <p className="text-xs text-muted-foreground">{b.phone}</p>
                  </div>
                  <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold shrink-0 ${STATUS_META[b.status]?.cls ?? "bg-muted text-muted-foreground"}`}>
                    {STATUS_META[b.status]?.label ?? b.status}
                  </span>
                </div>
                {(b.reservedDate || b.reservedTime) && (
                  <p className="text-xs text-muted-foreground">{b.reservedDate} {b.reservedTime}</p>
                )}
                {b.interestType && <p className="text-xs text-muted-foreground">프로그램: {b.interestType}</p>}
                {b.message && <p className="text-xs text-muted-foreground border-t border-border/60 pt-1.5 mt-1">문의: {b.message}</p>}
                <div className="flex flex-wrap gap-1.5 pt-1 border-t border-border/40">
                  {(["pending","confirmed","visited","cancelled","noshow"] as const).map(s => (
                    <button key={s} disabled={b.status === s || updateStatusMutation.isPending}
                      onClick={() => updateStatusMutation.mutate({ id: b.id, status: s })}
                      className={`text-[11px] px-2.5 py-1 rounded-lg border font-medium transition-colors disabled:opacity-40 ${b.status === s ? "bg-primary/10 text-primary border-primary/30" : "bg-background border-border text-muted-foreground hover:border-primary/40"}`}>
                      {STATUS_META[s].label}
                    </button>
                  ))}
                </div>
              </div>
            ))
          }
        </div>
      )}

      {/* ── 예약 설정 탭 ── */}
      {tab === "settings" && bkData && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">예약 받기 활성화</p>
            <button onClick={() => setBkData((p: any) => ({ ...p, enabled: !p.enabled }))}
              className={`relative rounded-full transition-colors ${bkData.enabled ? "bg-primary" : "bg-muted"}`}
              style={{ width: 40, height: 22 }}>
              <span className="absolute top-0.5 bg-white rounded-full shadow transition-all"
                style={{ width: 18, height: 18, left: bkData.enabled ? 20 : 2 }} />
            </button>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground font-semibold">버튼 문구</label>
            <input value={bkData.buttonText ?? ""} onChange={e => setBkData((p: any) => ({ ...p, buttonText: e.target.value }))}
              placeholder="상담 예약하기"
              className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground font-semibold">예약 안내 문구</label>
            <textarea value={bkData.guideText ?? bkData.message ?? ""} rows={2}
              onChange={e => setBkData((p: any) => ({ ...p, guideText: e.target.value, message: e.target.value }))}
              placeholder="예약 후 연락드립니다. 체험 수업은 예약제로 운영됩니다."
              className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-primary" />
          </div>
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground font-semibold">관심 프로그램 옵션</label>
            {(bkData.programs ?? []).map((p: string, i: number) => (
              <div key={i} className="flex items-center gap-2 bg-accent/30 rounded-xl px-3 py-2">
                <span className="text-xs flex-1">{p}</span>
                <button onClick={() => setBkData((prev: any) => ({ ...prev, programs: prev.programs.filter((_: any, j: number) => j !== i) }))}
                  className="text-muted-foreground hover:text-red-500"><X className="h-3.5 w-3.5" /></button>
              </div>
            ))}
            <ProgramAddInput onAdd={name => setBkData((p: any) => ({ ...p, programs: [...(p.programs ?? []), name] }))} />
          </div>
          <Button size="sm" className="w-full" disabled={updateBrandMutation.isPending} onClick={saveSettings}>
            {updateBrandMutation.isPending ? "저장 중..." : "저장"}
          </Button>
          {brand?.username && (
            <div className="space-y-1.5 border-t border-border pt-4">
              <p className="text-xs font-semibold text-muted-foreground">기존 회원 수업 예약 링크</p>
              <p className="text-[11px] text-muted-foreground">기존 회원에게 공유하는 수업 예약 전용 페이지입니다.</p>
              <div className="flex gap-2 items-center bg-accent/40 rounded-xl px-3 py-2">
                <span className="text-xs flex-1 truncate text-foreground/70 font-mono">{window.location.origin}/c/{encodeURIComponent(brand.username)}</span>
                <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/c/${encodeURIComponent(brand.username)}`); toast.success("링크 복사됨"); }}
                  className="text-[11px] font-semibold text-primary shrink-0 hover:underline">복사</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── 시간 관리 탭 ── */}
      {tab === "schedule" && (
        <div className="space-y-5">
          {/* 반복 일정 */}
          <div className="space-y-3">
            <div>
              <p className="text-sm font-semibold">반복 일정 설정</p>
              <p className="text-xs text-muted-foreground mt-0.5">요일별 시간대를 탭해 일괄 선택하거나, 펼쳐서 개별 설정하세요.</p>
            </div>

            {/* 헤더 행 */}
            <div className="rounded-xl border border-border overflow-hidden">
              <div className="grid grid-cols-[2.5rem_1fr_1fr_1fr_1fr_2rem] gap-px bg-border">
                <div className="bg-accent/40 px-1 py-2 flex items-center justify-center">
                  <span className="text-[10px] font-bold text-muted-foreground">요일</span>
                </div>
                {TIME_GROUPS.map(g => (
                  <div key={g.key} className="bg-accent/40 px-1 py-2 flex items-center justify-center">
                    <span className="text-[10px] font-bold text-muted-foreground">{g.label}</span>
                  </div>
                ))}
                <div className="bg-accent/40" />
              </div>

              {recurringEdit.map((r, idx) => {
                const isExpanded = expandedDay === r.dayOfWeek;
                const isWeekend = r.dayOfWeek === 0 || r.dayOfWeek === 6;
                return (
                  <div key={r.dayOfWeek} className={idx > 0 ? "border-t border-border/60" : ""}>
                    {/* 요일 행 */}
                    <div className="grid grid-cols-[2.5rem_1fr_1fr_1fr_1fr_2rem] gap-px bg-border">
                      {/* 요일 이름 */}
                      <div className={`bg-card flex items-center justify-center py-2 ${isWeekend ? "text-red-400" : ""}`}>
                        <span className="text-xs font-bold">{DAYS_KO[r.dayOfWeek]}</span>
                      </div>

                      {/* 시간대 그룹 버튼 */}
                      {TIME_GROUPS.map(g => {
                        const state = groupState(r.times, g.times);
                        return (
                          <button key={g.key}
                            onClick={() => toggleGroup(r.dayOfWeek, g.times)}
                            className={`bg-card py-2 flex flex-col items-center justify-center gap-0.5 transition-colors active:opacity-70 ${
                              state === "all" ? "bg-primary/15" : state === "some" ? "bg-primary/5" : ""
                            }`}>
                            <span className={`text-[11px] font-semibold ${
                              state === "all" ? "text-primary" : state === "some" ? "text-primary/70" : "text-muted-foreground"
                            }`}>
                              {state === "all" ? "●" : state === "some" ? "◐" : "○"}
                            </span>
                            {r.times.filter(t => g.times.includes(t)).length > 0 && (
                              <span className="text-[9px] text-primary/80 font-medium">
                                {r.times.filter(t => g.times.includes(t)).length}/{g.times.length}
                              </span>
                            )}
                          </button>
                        );
                      })}

                      {/* 펼치기 버튼 */}
                      <button
                        onClick={() => setExpandedDay(isExpanded ? null : r.dayOfWeek)}
                        className="bg-card flex items-center justify-center text-muted-foreground hover:text-primary transition-colors">
                        <span className="text-[10px]">{isExpanded ? "▲" : "▼"}</span>
                      </button>
                    </div>

                    {/* 펼쳐진 개별 시간 선택 */}
                    {isExpanded && (
                      <div className="bg-accent/10 border-t border-border/60 p-3 space-y-2.5">
                        {TIME_GROUPS.map(g => (
                          <div key={g.key} className="space-y-1.5">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-bold text-muted-foreground w-6">{g.label}</span>
                              <div className="flex flex-wrap gap-1">
                                {g.times.map(t => (
                                  <button key={t} onClick={() => toggleRecurringTime(r.dayOfWeek, t)}
                                    className={`text-[11px] px-2 py-0.5 rounded-md border font-medium transition-colors ${
                                      r.times.includes(t) ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border text-muted-foreground"
                                    }`}>
                                    {t}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>
                        ))}
                        <div className="flex gap-1.5 pt-1 border-t border-border/40">
                          <button onClick={() => clearDay(r.dayOfWeek)}
                            className="text-[11px] px-2.5 py-1 rounded-lg border border-border text-muted-foreground hover:text-red-400 hover:border-red-400/40 transition-colors">
                            전체 해제
                          </button>
                          {r.dayOfWeek >= 1 && r.dayOfWeek <= 5 && (
                            <button onClick={() => { copyToWeekdays(r.dayOfWeek); toast.success("평일 전체에 적용됐습니다"); }}
                              className="text-[11px] px-2.5 py-1 rounded-lg border border-border text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors">
                              평일 전체 적용
                            </button>
                          )}
                          <span className="ml-auto text-[10px] text-muted-foreground self-center">
                            {r.times.length > 0 ? `${r.times.length}개 선택` : "선택 없음"}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="flex gap-2 items-center">
              <select value={generateWeeks} onChange={e => setGenerateWeeks(Number(e.target.value))}
                className="h-9 bg-background border border-border rounded-lg px-2 text-xs shrink-0">
                {[1,2,4,8,12].map(w => <option key={w} value={w}>앞으로 {w}주</option>)}
              </select>
              <Button size="sm" className="flex-1 h-9 text-xs"
                disabled={saveRecurringMutation.isPending || generateMutation.isPending}
                onClick={async () => {
                  const toSave = recurringEdit.filter(r => r.times.length > 0);
                  await saveRecurringMutation.mutateAsync(toSave);
                  generateMutation.mutate({ weeks: generateWeeks });
                }}>
                {(saveRecurringMutation.isPending || generateMutation.isPending) ? "생성 중..." : "저장 후 슬롯 자동 생성"}
              </Button>
            </div>
            {brand?.username && (
              <button
                onClick={() => window.open(`${window.location.origin}/c/${encodeURIComponent(brand.username)}`, "_blank")}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-xl border border-border text-xs font-medium text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors">
                <ExternalLink className="h-3.5 w-3.5" />
                예약 페이지 미리보기
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
