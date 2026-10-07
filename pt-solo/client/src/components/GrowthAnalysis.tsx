import { Fragment, useEffect, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  CalendarClock, Clock, UserPlus, Wallet, RefreshCw, AlertTriangle, Lightbulb, Settings2, ChevronRight, CalendarCheck,
} from "lucide-react";

const DAYS = ["월", "화", "수", "목", "금", "토", "일"];

function won(n: number) {
  if (!n) return "0원";
  if (n >= 100_000_000) return `${(n / 100_000_000).toFixed(1)}억원`;
  if (n >= 10_000) return `${Math.round(n / 10_000).toLocaleString()}만원`;
  return `${n.toLocaleString()}원`;
}
const pct = (r: number) => `${Math.round(r * 100)}%`;

function Card({ icon: Icon, title, right, children }: { icon: React.ElementType; title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl bg-card border border-border p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-primary shrink-0" />
        <h3 className="text-sm font-semibold flex-1">{title}</h3>
        {right}
      </div>
      {children}
    </section>
  );
}

type DayHours = { dow: number; open: boolean; start: number; end: number };

function WorkHoursDialog({ open, onClose, initial }: { open: boolean; onClose: () => void; initial: DayHours[] }) {
  const utils = trpc.useUtils();
  const [days, setDays] = useState<DayHours[]>(initial);
  useEffect(() => { if (open) setDays(initial); }, [open, initial]);
  const save = trpc.dashboard.setWorkHours.useMutation({
    onSuccess: () => { utils.dashboard.getGrowthAnalysis.invalidate(); toast.success("운영 시간을 저장했어요"); onClose(); },
    onError: (e) => toast.error(e.message),
  });
  const hours = Array.from({ length: 25 }, (_, i) => i);
  const update = (dow: number, patch: Partial<DayHours>) => setDays(ds => ds.map(d => d.dow === dow ? { ...d, ...patch } : d));

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>운영 시간</DialogTitle></DialogHeader>
        <p className="text-xs text-muted-foreground -mt-2">수업을 받을 수 있는 시간이에요. 빈 시간·추가 수용 인원 계산에 쓰여요.</p>
        <div className="space-y-2">
          {days.map(d => (
            <div key={d.dow} className="flex items-center gap-2">
              <button
                onClick={() => update(d.dow, { open: !d.open })}
                className={`w-9 h-8 rounded-lg text-xs font-semibold shrink-0 ${d.open ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
              >
                {DAYS[d.dow]}
              </button>
              {d.open ? (
                <div className="flex items-center gap-1.5 flex-1">
                  <select value={d.start} onChange={e => update(d.dow, { start: Number(e.target.value) })}
                    className="flex-1 h-8 rounded-lg border border-border bg-background text-sm px-2">
                    {hours.slice(0, 24).map(h => <option key={h} value={h}>{h}시</option>)}
                  </select>
                  <span className="text-xs text-muted-foreground">~</span>
                  <select value={d.end} onChange={e => update(d.dow, { end: Number(e.target.value) })}
                    className="flex-1 h-8 rounded-lg border border-border bg-background text-sm px-2">
                    {hours.slice(1).filter(h => h > d.start).map(h => <option key={h} value={h}>{h}시</option>)}
                  </select>
                </div>
              ) : (
                <span className="text-xs text-muted-foreground flex-1">휴무</span>
              )}
            </div>
          ))}
        </div>
        <Button className="w-full" disabled={save.isPending} onClick={() => save.mutate({ days })}>
          {save.isPending ? "저장 중..." : "저장"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}

export default function GrowthAnalysis() {
  const [, setLocation] = useLocation();
  const { data, isLoading } = trpc.dashboard.getGrowthAnalysis.useQuery(undefined, { refetchOnWindowFocus: false });
  const [hoursOpen, setHoursOpen] = useState(false);
  const [hover, setHover] = useState<{ dow: number; hour: number; occ: number; open: boolean } | null>(null);

  if (isLoading || !data) {
    return <div className="py-16 text-center text-sm text-muted-foreground">분석 중...</div>;
  }

  const { schedule: s, revenue: r, renewal, atRisk, metrics, bookingMethod, recommendations } = data;
  const hours = Array.from({ length: s.hourRange[1] - s.hourRange[0] + 1 }, (_, i) => s.hourRange[0] + i);
  const cellMap = new Map(s.cells.map(c => [`${c.dow}-${c.hour}`, c]));
  const utilColor = s.utilization >= 0.85 ? "text-emerald-500" : s.utilization >= 0.5 ? "text-amber-500" : "text-rose-500";

  return (
    <div className="space-y-4">
      {/* 핵심 요약 */}
      <section className="rounded-2xl border border-primary/30 bg-primary/5 p-4 space-y-3">
        <p className="text-xs font-semibold text-primary">이번 분석 요약</p>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <p className="text-[11px] text-muted-foreground">시간표 가동률</p>
            <p className={`text-2xl font-bold tabular-nums ${utilColor}`}>{pct(s.utilization)}</p>
            <p className="text-[10px] text-muted-foreground">주 {s.booked}/{s.capacity}시간</p>
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground">추가 수용</p>
            <p className="text-2xl font-bold tabular-nums">{s.recommendedAdditionalMembers}<span className="text-sm font-normal ml-0.5">명</span></p>
            <p className="text-[10px] text-muted-foreground">최대 {s.maxAdditionalMembers}명</p>
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground">추가 매출 여력</p>
            <p className="text-2xl font-bold tabular-nums text-primary">{r.unitPrice ? won(r.recommendedMonthly).replace("원", "") : "-"}</p>
            <p className="text-[10px] text-muted-foreground">월 기준</p>
          </div>
        </div>
        {data.hoursEstimated && s.hasData && (
          <button onClick={() => setHoursOpen(true)} className="w-full text-left text-xs text-amber-700 bg-amber-500/10 rounded-lg px-3 py-2">
            운영 시간을 수업 기록으로 추정했어요. <b className="underline underline-offset-2">운영 시간 설정</b>을 하면 수용 인원과 매출 여력이 정확해져요.
          </button>
        )}
        {!s.hasData && (
          <p className="text-xs text-muted-foreground">스케줄 관리에 최근 4주 수업이 없어서 시간표 분석은 예시 운영 시간 기준이에요. 일정을 등록하면 정확해져요.</p>
        )}
      </section>

      {/* 실행 추천 */}
      {recommendations.length > 0 && (
        <Card icon={Lightbulb} title="지금 하면 좋은 것" right={<span className="text-[10px] text-muted-foreground">예상 효과순</span>}>
          <ol className="space-y-2.5">
            {recommendations.map((rec, i) => (
              <li key={i} className="flex gap-3">
                <span className={`mt-0.5 h-5 w-5 rounded-full text-[11px] font-bold flex items-center justify-center shrink-0 ${
                  rec.level === "high" ? "bg-rose-500/15 text-rose-500" : "bg-amber-500/15 text-amber-600"
                }`}>{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <p className="text-sm font-semibold flex-1">{rec.title}</p>
                    {rec.impact > 0 && <span className="text-xs font-semibold text-primary tabular-nums shrink-0">+{won(rec.impact)}</span>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{rec.detail}</p>
                </div>
              </li>
            ))}
          </ol>
        </Card>
      )}

      {/* 시간표 히트맵 */}
      <Card
        icon={CalendarClock}
        title="주간 시간표 점유"
        right={
          <button onClick={() => setHoursOpen(true)} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <Settings2 className="h-3.5 w-3.5" />
            운영 시간{data.hoursEstimated && <span className="text-[10px] text-amber-600">(자동 추정)</span>}
          </button>
        }
      >
        <p className="text-xs text-muted-foreground -mt-1">최근 4주 동안 매주 그 시간에 수업이 있었던 비율이에요.</p>
        <div className="overflow-x-auto -mx-1 px-1">
          <div className="grid gap-[3px] min-w-[280px]" style={{ gridTemplateColumns: "28px repeat(7, minmax(0, 1fr))" }}>
            <div />
            {DAYS.map(d => <div key={d} className="text-[10px] text-center text-muted-foreground font-medium">{d}</div>)}
            {hours.map(h => (
              <Fragment key={h}>
                <div className="text-[10px] text-muted-foreground tabular-nums text-right pr-1 leading-5">{h}</div>
                {DAYS.map((_, dow) => {
                  const c = cellMap.get(`${dow}-${h}`) ?? { dow, hour: h, occ: 0, open: false };
                  const bg = c.occ > 0
                    ? `hsl(var(--primary) / ${0.15 + c.occ * 0.85})`
                    : c.open ? "transparent" : "hsl(var(--muted) / 0.6)";
                  return (
                    <button
                      key={`${dow}-${h}`}
                      onMouseEnter={() => setHover(c)}
                      onMouseLeave={() => setHover(null)}
                      onClick={() => setHover(c)}
                      className={`h-5 rounded-[4px] ${c.open ? "border border-border" : ""} ${!c.open && c.occ > 0 ? "ring-1 ring-amber-500/60" : ""}`}
                      style={{ background: bg }}
                      aria-label={`${DAYS[dow]} ${h}시 ${c.open ? `점유 ${pct(c.occ)}` : "운영 시간 외"}`}
                    />
                  );
                })}
              </Fragment>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-between gap-2 flex-wrap text-[10px] text-muted-foreground">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-[3px] border border-border" />비어 있음</span>
            <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-[3px]" style={{ background: "hsl(var(--primary) / 0.5)" }} />가끔</span>
            <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-[3px]" style={{ background: "hsl(var(--primary))" }} />매주</span>
            <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-[3px] bg-muted" />운영 외</span>
          </div>
          <span className="tabular-nums text-foreground font-medium min-h-[1em]">
            {hover ? `${DAYS[hover.dow]} ${hover.hour}시 · ${hover.open ? `점유 ${pct(hover.occ)}` : hover.occ > 0 ? `운영 시간 외 수업 ${pct(hover.occ)}` : "운영 시간 외"}` : ""}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <div className="space-y-1.5">
            <p className="text-xs font-semibold flex items-center gap-1"><Clock className="h-3.5 w-3.5 text-muted-foreground" />비어 있는 시간대</p>
            {s.emptyRanges.length === 0 ? (
              <p className="text-xs text-muted-foreground">운영 시간이 거의 다 찼어요</p>
            ) : (
              <ul className="flex flex-wrap gap-1.5">
                {s.emptyRanges.map(e => (
                  <li key={e.label} className="text-xs px-2 py-1 rounded-lg bg-muted/50">
                    {e.label} <span className="text-muted-foreground">({e.hours}시간)</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="space-y-1.5">
            <p className="text-xs font-semibold flex items-center gap-1"><CalendarCheck className="h-3.5 w-3.5 text-muted-foreground" />매주 차는 시간</p>
            {s.peaks.length === 0 ? (
              <p className="text-xs text-muted-foreground">아직 매주 고정으로 차는 시간이 없어요</p>
            ) : (
              <ul className="flex flex-wrap gap-1.5">
                {s.peaks.map(p => <li key={p} className="text-xs px-2 py-1 rounded-lg bg-primary/10 text-primary">{p}</li>)}
              </ul>
            )}
          </div>
        </div>
        {s.bookedOutside > 0 && (
          <p className="text-[11px] text-amber-600">운영 시간 밖에서 주 {s.bookedOutside}시간 수업하고 있어요. 운영 시간을 넓히거나 그 수업을 빈 시간으로 옮겨 보세요.</p>
        )}
      </Card>

      {/* 수용 여력 */}
      <Card icon={UserPlus} title="앞으로 더 받을 수 있는 회원">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-muted/40 py-3">
            <p className="text-[11px] text-muted-foreground">빈 슬롯</p>
            <p className="text-lg font-bold tabular-nums">주 {s.freeSlots}<span className="text-xs font-normal">시간</span></p>
          </div>
          <div className="rounded-xl bg-muted/40 py-3">
            <p className="text-[11px] text-muted-foreground">권장 ({pct(s.targetUtilization)})</p>
            <p className="text-lg font-bold tabular-nums text-primary">{s.recommendedAdditionalMembers}<span className="text-xs font-normal">명</span></p>
          </div>
          <div className="rounded-xl bg-muted/40 py-3">
            <p className="text-[11px] text-muted-foreground">최대</p>
            <p className="text-lg font-bold tabular-nums">{s.maxAdditionalMembers}<span className="text-xs font-normal">명</span></p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          회원 1명이 주 평균 <b className="text-foreground">{s.freqPerMember}회</b> 수업한다고 계산했어요. 이동·휴식 시간을 남기려고 가동률 {pct(s.targetUtilization)}를 권장 기준으로 잡았어요.
        </p>
      </Card>

      {/* 매출 전망 */}
      <Card icon={Wallet} title="매출 전망">
        {r.unitPrice === 0 ? (
          <p className="text-xs text-muted-foreground">최근 6개월 계약에 결제 금액과 수업 횟수를 입력하면 매출 전망이 계산돼요.</p>
        ) : (
          <div className="divide-y divide-border">
            {[
              ["회당 평균 단가", won(r.unitPrice), "최근 6개월 계약 기준"],
              ["최근 3개월 월평균 매출", won(r.avgMonthlyRevenue), `이번 달 지금까지 ${won(r.thisMonthRevenue)}`],
              ["30일 내 재등록 예상 매출", won(renewal.expectedRevenue), `${renewal.endingCount}명 종료 예정 × 재등록률 ${pct(renewal.rate)}${renewal.reliable ? "" : " (기본값)"}`],
              [`가동률 ${pct(s.targetUtilization)}까지 채우면`, `+${won(r.recommendedMonthly)}`, "월 추가 매출"],
              ["빈 시간을 전부 채우면", `+${won(r.potentialMonthly)}`, "월 최대 잠재 매출"],
            ].map(([label, value, sub]) => (
              <div key={label} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <p className="text-xs">{label}</p>
                  <p className="text-[10px] text-muted-foreground">{sub}</p>
                </div>
                <p className="text-sm font-bold tabular-nums shrink-0">{value}</p>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* 추천 예약 방식 */}
      <Card icon={CalendarCheck} title="추천 예약 방식">
        <div className="rounded-xl bg-primary/5 border border-primary/20 p-3 space-y-1">
          <p className="text-sm font-bold text-primary">{bookingMethod.title}</p>
          <p className="text-xs text-muted-foreground leading-relaxed">{bookingMethod.reason}</p>
        </div>
        <ol className="space-y-1.5">
          {bookingMethod.steps.map((step, i) => (
            <li key={i} className="flex gap-2 text-xs">
              <span className="text-primary font-semibold tabular-nums shrink-0 w-4">{i + 1}.</span>
              <span className="leading-relaxed">{step}</span>
            </li>
          ))}
        </ol>
        <button onClick={() => setLocation("/schedule")} className="flex items-center gap-0.5 text-xs font-semibold text-primary">
          스케줄 관리로 가기 <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </Card>

      {/* 재등록 예정 */}
      <Card icon={RefreshCw} title="30일 내 종료 예정" right={<span className="text-xs text-muted-foreground tabular-nums">{renewal.endingCount}명</span>}>
        {renewal.ending.length === 0 ? (
          <p className="text-xs text-muted-foreground">30일 안에 끝나는 회원이 없어요</p>
        ) : (
          <ul className="divide-y divide-border">
            {renewal.ending.map(m => (
              <li key={m.memberId}>
                <button onClick={() => setLocation(`/members/${m.memberId}`)} className="w-full flex items-center gap-2 py-2 text-left">
                  <span className="text-sm font-medium flex-1 truncate">{m.name}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">잔여 {m.remaining}회</span>
                  <span className={`text-xs font-semibold tabular-nums w-14 text-right ${m.daysLeft <= 7 ? "text-rose-500" : "text-amber-600"}`}>
                    {m.daysLeft === 0 ? "곧 종료" : `약 ${m.daysLeft}일`}
                  </span>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* 이탈 위험 */}
      <Card icon={AlertTriangle} title="이탈 위험 회원" right={<span className="text-xs text-muted-foreground tabular-nums">{atRisk.length}명</span>}>
        <p className="text-xs text-muted-foreground -mt-1">잔여 수업이 있는데 2주 넘게 수업이 없고 예정된 일정도 없는 회원이에요.</p>
        {atRisk.length === 0 ? (
          <p className="text-xs text-emerald-600">이탈 위험 회원이 없어요</p>
        ) : (
          <ul className="divide-y divide-border">
            {atRisk.map(m => (
              <li key={m.memberId}>
                <button onClick={() => setLocation(`/members/${m.memberId}`)} className="w-full flex items-center gap-2 py-2 text-left">
                  <span className="text-sm font-medium flex-1 truncate">{m.name}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">잔여 {m.remaining}회</span>
                  <span className="text-xs font-semibold text-rose-500 tabular-nums w-16 text-right">
                    {m.daysSince == null ? "기록 없음" : `${m.daysSince}일째`}
                  </span>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* 수업 운영 지표 */}
      <Card icon={Clock} title="수업 운영 지표">
        <div className="grid grid-cols-2 gap-2">
          {[
            ["회원당 주 평균 수업", `${metrics.freqPerMember}회`],
            ["일정 잡힌 회원", `${metrics.activeScheduled}명`],
            ["정기 고정 예약 비율", pct(metrics.recurringShare)],
            ["노쇼율 (최근 8주)", pct(metrics.noShowRate)],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl bg-muted/40 px-3 py-2.5">
              <p className="text-[11px] text-muted-foreground">{label}</p>
              <p className="text-base font-bold tabular-nums">{value}</p>
            </div>
          ))}
        </div>
      </Card>

      <WorkHoursDialog open={hoursOpen} onClose={() => setHoursOpen(false)} initial={data.workHours} />
    </div>
  );
}
