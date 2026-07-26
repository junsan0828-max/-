import { useState, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CalendarCheck, ExternalLink, Link2, Share2, AlertCircle, Lock } from "lucide-react";
import TabBanner from "@/components/TabBanner";

const DAYS_KO = ["일", "월", "화", "수", "목", "금", "토"];
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0]; // 월~일 순서로 표시
const ALL_HOURS = ["06:00","07:00","08:00","09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00","18:00","19:00","20:00","21:00","22:00","23:00"];

const STATUS_META: Record<string, { label: string; cls: string }> = {
  pending:   { label: "예약 대기",  cls: "bg-blue-500/15 text-blue-600" },
  confirmed: { label: "예약 확정",  cls: "bg-green-500/15 text-green-600" },
  visited:   { label: "방문 완료",  cls: "bg-violet-500/15 text-violet-600" },
  cancelled: { label: "취소",       cls: "bg-red-500/15 text-red-500" },
  noshow:    { label: "노쇼",       cls: "bg-amber-500/15 text-amber-600" },
};

export default function BookingManagementPage() {
  const { data: me, isLoading: meLoading } = trpc.auth.me.useQuery();
  const isPro = me?.plan === "pro" || me?.plan === "elite";
  const { data: planInfo } = trpc.fitStepPlus.trainer_getPublicPlanInfo.useQuery(undefined, { enabled: !isPro });
  const { data: brand, isLoading: brandLoading } = trpc.brand.getMyBrand.useQuery(undefined, { enabled: isPro });

  const [tab, setTab] = useState<"schedule" | "list">("list");

  // ── 시간 관리 탭 ──
  const { data: recurring, refetch: refetchRecurring } = trpc.booking.getRecurring.useQuery();
  const saveRecurringMutation = trpc.booking.saveRecurring.useMutation({ onSuccess: () => refetchRecurring() });
  const generateMutation = trpc.booking.generateFromRecurring.useMutation({
    onSuccess: (d: any) => { toast.success(`${d.created}개 슬롯 생성됨`); },
  });

  const [workDays, setWorkDays] = useState<Set<number>>(new Set());
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("18:00");
  const [generateWeeks, setGenerateWeeks] = useState(4);
  const hydratedRecurring = useRef(false);

  useEffect(() => {
    if (!recurring || hydratedRecurring.current) return;
    hydratedRecurring.current = true;
    const days = new Set<number>();
    let minTime = "", maxTime = "";
    for (const r of recurring as any[]) {
      if (!r.times || r.times.length === 0) continue;
      days.add(r.dayOfWeek);
      const sorted = [...r.times].sort();
      if (!minTime || sorted[0] < minTime) minTime = sorted[0];
      const last = sorted[sorted.length - 1];
      const lastIdx = ALL_HOURS.indexOf(last);
      const rangeEnd = lastIdx >= 0 && lastIdx < ALL_HOURS.length - 1 ? ALL_HOURS[lastIdx + 1] : last;
      if (!maxTime || rangeEnd > maxTime) maxTime = rangeEnd;
    }
    if (days.size > 0) {
      setWorkDays(days);
      setStartTime(minTime || "09:00");
      setEndTime(maxTime || "18:00");
    }
  }, [recurring]);

  function toggleWorkDay(dayOfWeek: number) {
    setWorkDays(prev => {
      const next = new Set(prev);
      next.has(dayOfWeek) ? next.delete(dayOfWeek) : next.add(dayOfWeek);
      return next;
    });
  }

  function buildRecurringPayload() {
    const times = ALL_HOURS.filter(t => t >= startTime && t < endTime);
    return [0, 1, 2, 3, 4, 5, 6].map(dayOfWeek => ({
      dayOfWeek,
      times: workDays.has(dayOfWeek) ? times : [],
    }));
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

  if (meLoading) return (
    <div className="flex items-center justify-center py-12">
      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!isPro) {
    return (
      <div className="space-y-5 pb-8">
        <TabBanner tabKey="booking" />
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-primary/10">
            <CalendarCheck className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <h1 className="text-lg font-bold">수업 예약 관리</h1>
            <p className="text-xs text-muted-foreground">시간 관리 · 예약 확인</p>
          </div>
        </div>
        <div className="rounded-2xl border border-dashed border-blue-300 dark:border-blue-500/30 bg-blue-50 dark:bg-blue-500/10 p-6 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-blue-500/15 flex items-center justify-center mx-auto">
            <Lock className="h-6 w-6 text-blue-600" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-bold text-blue-700 dark:text-blue-400">예약 관리는 PRO 전용 기능입니다</p>
            <p className="text-xs text-blue-600/80 dark:text-blue-400/80 leading-relaxed">
              PRO로 업그레이드하면 근무 요일·시간 설정부터 예약 확인·노쇼 관리까지 사용할 수 있어요.
            </p>
          </div>
          <a href="/profile"
            className="inline-flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl bg-blue-500 text-white text-sm font-bold hover:bg-blue-600 transition-colors">
            연 {(planInfo?.prices?.pro ?? 69000).toLocaleString()}원으로 업그레이드
          </a>
        </div>
      </div>
    );
  }

  if (brandLoading) return (
    <div className="flex items-center justify-center py-12">
      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-5 pb-8">
      <TabBanner tabKey="booking" />
      {/* 헤더 */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-xl bg-primary/10">
          <CalendarCheck className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1">
          <h1 className="text-lg font-bold">수업 예약 관리</h1>
          <p className="text-xs text-muted-foreground">시간 관리 · 예약 확인</p>
        </div>
        {brand?.username && brand?.brandIsPublic === 1 && (
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
        {(["list", "schedule"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors ${tab === t ? "bg-background shadow text-foreground" : "text-muted-foreground"}`}>
            {t === "list" ? "예약 목록" : "시간 관리"}
          </button>
        ))}
      </div>

      {/* ── 브랜드 페이지 미공개 경고 ── */}
      {brand && !brand.brandIsPublic && (
        <div className="flex items-start gap-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl px-3.5 py-3">
          <AlertCircle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-amber-600">브랜드 페이지 공개 필요</p>
            <p className="text-[11px] text-amber-600/80 mt-0.5 leading-relaxed">
              작업실 → 브랜드 페이지에서 <strong>공개 설정</strong>을 켜야 예약 링크가 활성화됩니다.
            </p>
          </div>
        </div>
      )}

      {/* ── 예약 링크 공유 (모든 탭 공통) ── */}
      {brand?.username && brand?.brandIsPublic === 1 && (
        <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Link2 className="h-4 w-4 text-primary" />
              <p className="text-sm font-bold text-primary">예약 링크 공유하기</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">회원에게 아래 링크를 공유하면 바로 예약할 수 있습니다.</p>
          <p className="text-[11px] text-muted-foreground/70">버튼 문구·안내 문구·프로그램 옵션 등 상세 설정은 <span className="font-semibold">작업실</span>에서 해주세요.</p>
          <div className="flex gap-2 items-center bg-background border border-border rounded-xl px-3 py-2">
            <span className="text-xs flex-1 truncate text-foreground/70 font-mono">
              {window.location.origin}/c/{encodeURIComponent(brand.username)}
            </span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                navigator.clipboard.writeText(`${window.location.origin}/c/${encodeURIComponent(brand.username)}`);
                toast.success("링크가 복사되었습니다");
              }}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-opacity"
            >
              <Link2 className="h-3.5 w-3.5" />
              링크 복사
            </button>
            <button
              onClick={async () => {
                const url = `${window.location.origin}/c/${encodeURIComponent(brand.username)}`;
                if (navigator.share) {
                  try { await navigator.share({ title: "수업 예약하기", url }); } catch {}
                } else {
                  navigator.clipboard.writeText(url);
                  toast.success("링크가 복사되었습니다");
                }
              }}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border border-primary/30 text-primary text-xs font-semibold hover:bg-primary/5 transition-colors"
            >
              <Share2 className="h-3.5 w-3.5" />
              공유하기
            </button>
          </div>
        </div>
      )}

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

      {/* ── 시간 관리 탭 ── */}
      {tab === "schedule" && (
        <div className="space-y-5">
          {/* 근무 요일 · 시간 */}
          <div className="rounded-2xl bg-card border border-border p-4 space-y-4">
            <div>
              <p className="text-sm font-semibold">근무 요일</p>
              <p className="text-xs text-muted-foreground mt-0.5">예약을 받을 요일을 선택하세요.</p>
            </div>
            <div className="flex gap-2 flex-wrap">
              {DAY_ORDER.map(d => {
                const active = workDays.has(d);
                const isWeekend = d === 0 || d === 6;
                return (
                  <button key={d} onClick={() => toggleWorkDay(d)}
                    className={`w-10 h-10 rounded-full border text-sm font-bold transition-colors ${
                      active ? "bg-primary text-primary-foreground border-primary" :
                      isWeekend ? "bg-background border-border text-red-400" : "bg-background border-border text-muted-foreground"
                    }`}>
                    {DAYS_KO[d]}
                  </button>
                );
              })}
            </div>

            <div className="border-t border-border/60 pt-4 space-y-1.5">
              <p className="text-sm font-semibold">근무 시간</p>
              <div className="flex items-center gap-2">
                <select value={startTime} onChange={e => setStartTime(e.target.value)}
                  className="flex-1 h-10 rounded-xl border border-border bg-background px-3 text-sm">
                  {ALL_HOURS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <span className="text-muted-foreground text-sm">~</span>
                <select value={endTime} onChange={e => setEndTime(e.target.value)}
                  className="flex-1 h-10 rounded-xl border border-border bg-background px-3 text-sm">
                  {ALL_HOURS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <p className="text-[11px] text-muted-foreground">선택한 요일에 1시간 간격으로 예약 슬롯이 생성됩니다.</p>
            </div>
          </div>

          <div className="flex gap-2 items-center">
            <select value={generateWeeks} onChange={e => setGenerateWeeks(Number(e.target.value))}
              className="h-9 bg-background border border-border rounded-lg px-2 text-xs shrink-0">
              {[1,2,4,8,12].map(w => <option key={w} value={w}>앞으로 {w}주</option>)}
            </select>
            <Button size="sm" className="flex-1 h-9 text-xs"
              disabled={workDays.size === 0 || startTime >= endTime || saveRecurringMutation.isPending || generateMutation.isPending}
              onClick={async () => {
                await saveRecurringMutation.mutateAsync(buildRecurringPayload());
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
      )}
    </div>
  );
}
