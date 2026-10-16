import { useMemo, type ReactNode } from "react";
import { useLocation, useSearch } from "wouter";
import { trpc } from "@/lib/trpc";
import { Portal } from "@/components/Portal";
import { ChevronLeft, Printer } from "lucide-react";

type Period = "H1" | "H2" | "annual";
const PERIOD_LABEL: Record<Period, string> = { H1: "상반기 (1~6월)", H2: "하반기 (7~12월)", annual: "연간 (1~12월)" };
const STATUS_LABEL: Record<string, string> = { active: "활성", paused: "정지", inactive: "비활성", ended: "마감" };

const won = (n: number) => `${Math.round(n).toLocaleString()}원`;
const man = (n: number) => `${(Math.round(n / 10000)).toLocaleString()}만`;
const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);
const sum = (a: number[]) => a.reduce((s, v) => s + v, 0);
const daysSince = (d: string | null | undefined, today: string) =>
  d ? Math.round((new Date(today).getTime() - new Date(d).getTime()) / 86400000) : null;
function kstToday() {
  const d = new Date(Date.now() + 9 * 3600000);
  return d.toISOString().slice(0, 10);
}

// ── 보고서용 표 부품 (화면·프린트 공용, 밝은 문서 스타일) ─────────────────
function Section({ title, sub, children }: { title: string; sub?: string; children: ReactNode }) {
  return (
    <section className="report-section mb-7">
      <h2 className="report-h2 text-[15px] font-bold border-b-2 border-slate-800 pb-1 mb-3 flex items-baseline gap-2">
        {title}{sub && <span className="text-[11px] font-normal text-slate-500">{sub}</span>}
      </h2>
      {children}
    </section>
  );
}

function Table({ head, rows, foot, align }: {
  head: ReactNode[]; rows: ReactNode[][]; foot?: ReactNode[]; align?: ("l" | "r" | "c")[];
}) {
  const cls = (i: number) => `px-2 py-1.5 border border-slate-300 ${align?.[i] === "l" ? "text-left" : align?.[i] === "r" ? "text-right" : "text-center"}`;
  return (
    <table className="w-full border-collapse text-[12px] mb-2">
      <thead><tr className="bg-slate-100">{head.map((h, i) => <th key={i} className={`${cls(i)} font-semibold`}>{h}</th>)}</tr></thead>
      <tbody>
        {rows.length === 0
          ? <tr><td colSpan={head.length} className="px-2 py-3 border border-slate-300 text-center text-slate-400">해당 없음</td></tr>
          : rows.map((r, ri) => <tr key={ri}>{r.map((c, i) => <td key={i} className={cls(i)}>{c}</td>)}</tr>)}
      </tbody>
      {foot && <tfoot><tr className="bg-slate-50 font-bold">{foot.map((f, i) => <td key={i} className={cls(i)}>{f}</td>)}</tr></tfoot>}
    </table>
  );
}

function Kpi({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="border border-slate-300 rounded px-3 py-2">
      <div className="text-[11px] text-slate-500">{label}</div>
      <div className="text-[18px] font-bold leading-tight">{value}</div>
      {sub && <div className="text-[10px] text-slate-500 mt-0.5">{sub}</div>}
    </div>
  );
}

function Bar({ v, max }: { v: number; max: number }) {
  return (
    <div className="h-2 bg-slate-100 rounded w-full min-w-[60px]">
      <div className="h-2 bg-slate-700 rounded" style={{ width: `${max > 0 ? Math.max(2, (v / max) * 100) : 0}%` }} />
    </div>
  );
}

function Findings({ good, bad, todo }: { good: string[]; bad: string[]; todo: string[] }) {
  const block = (t: string, items: string[], mark: string) => (
    <div className="border border-slate-300 rounded p-3">
      <div className="font-bold text-[12px] mb-1.5">{t}</div>
      {items.length ? (
        <ul className="text-[12px] space-y-1">{items.map((x, i) => <li key={i}>{mark} {x}</li>)}</ul>
      ) : <div className="text-[12px] text-slate-400">특이사항 없음</div>}
    </div>
  );
  return (
    <div className="grid grid-cols-3 gap-2 report-grid">
      {block("강점", good, "▲")}
      {block("개선 필요", bad, "▼")}
      {block("다음 기간 실행 과제", todo, "□")}
    </div>
  );
}

// ── 트레이너 1인 보고서 ─────────────────────────────────────────────
function TrainerReportBody({ full, center, prev, today }: { full: any; center: any; prev: any; today: string }) {
  const s = full.stats;
  const trainerId = Number(full.trainerId ?? 0);
  const others: any[] = center?.trainers ?? [];
  const n = others.length || 1;
  const avg = (k: string) => others.length ? sum(others.map(t => Number(t[k] ?? 0))) / n : null;
  const rank = (k: string) => {
    if (!others.length) return null;
    const sorted = [...others].sort((a, b) => Number(b[k] ?? 0) - Number(a[k] ?? 0));
    return sorted.findIndex(t => t.trainerName === full.trainerName) + 1;
  };
  const myReg = center?.newRegs?.rows?.find((r: any) => r.trainerName === full.trainerName);
  const ptRevenue = Number(s.newAmount) + Number(s.reregAmount);

  const metrics: [string, string, (v: number) => string][] = [
    ["총 수업", "sessions", v => `${Math.round(v).toLocaleString()}회`],
    ["월평균 수업", "avgMonthly", v => `${(Math.round(v * 10) / 10)}회`],
    ["관리 회원", "managedMembers", v => `${Math.round(v * 10) / 10}명`],
    ["신규 (PT)", "newMembers", v => `${Math.round(v * 10) / 10}명`],
    ["재등록", "reregCount", v => `${Math.round(v * 10) / 10}건`],
    ["재등록률", "reregRate", v => `${Math.round(v)}%`],
    ["종료", "completed", v => `${Math.round(v * 10) / 10}명`],
    ["PT 신규 매출", "newAmount", v => man(v)],
    ["PT 재등록 매출", "reregAmount", v => man(v)],
  ];

  // 회원 현황 분석
  const managed: any[] = [...full.managed].map(m => ({ ...m, gap: daysSince(m.lastSession, today) }))
    .sort((a, b) => (b.gap ?? 9999) - (a.gap ?? 9999));
  const absent30 = managed.filter(m => m.gap == null || m.gap >= 30);
  const absent14 = managed.filter(m => m.gap != null && m.gap >= 14 && m.gap < 30);
  const remainingTotal = sum(managed.map(m => Number(m.remaining ?? 0)));
  const lowRemain = managed.filter(m => Number(m.remaining ?? 0) > 0 && Number(m.remaining) <= 3);

  // 재등록 분석: 프로그램별
  const byProgram = new Map<string, { c: number; amt: number; sessions: number }>();
  for (const e of full.reregEntries) {
    const k = (e.programDetail || "PT").trim();
    const v = byProgram.get(k) ?? { c: 0, amt: 0, sessions: 0 };
    v.c++; v.amt += Number(e.amount ?? 0); v.sessions += Number(e.sessions ?? 0);
    byProgram.set(k, v);
  }
  const reregMembers = new Map<string, number>();
  for (const e of full.reregEntries) reregMembers.set(e.name, (reregMembers.get(e.name) ?? 0) + 1);
  const repeaters = [...reregMembers.entries()].filter(([, c]) => c >= 2).sort((a, b) => b[1] - a[1]);

  // 자동 진단
  const good: string[] = [], bad: string[] = [], todo: string[] = [];
  const cAvg = (k: string) => avg(k) ?? 0;
  if (s.reregRate != null && others.length) {
    if (s.reregRate >= cAvg("reregRate") + 5) good.push(`재등록률 ${s.reregRate}% — 센터 평균(${Math.round(cAvg("reregRate"))}%)보다 높음`);
    else if (s.reregRate < cAvg("reregRate") - 5) bad.push(`재등록률 ${s.reregRate}% — 센터 평균(${Math.round(cAvg("reregRate"))}%)보다 낮음`);
  }
  if (others.length && s.avgMonthly >= cAvg("avgMonthly") * 1.1) good.push(`월평균 수업 ${s.avgMonthly}회 — 센터 평균의 ${pct(s.avgMonthly, cAvg("avgMonthly"))}%`);
  if (others.length && s.avgMonthly < cAvg("avgMonthly") * 0.7) bad.push(`월평균 수업 ${s.avgMonthly}회 — 센터 평균 대비 낮음`);
  if (repeaters.length) good.push(`2회 이상 재등록 회원 ${repeaters.length}명 (충성 고객)`);
  if (s.noShows === 0 && s.sessions > 0) good.push("노쇼 0회");
  if (s.completed > 0) bad.push(`종료 ${s.completed}명 — 패키지 소진 후 재등록 없음`);
  if (absent30.length) bad.push(`30일 이상 수업 없는 관리 회원 ${absent30.length}명 (잔여 ${sum(absent30.map(m => Number(m.remaining ?? 0)))}회)`);
  if (s.pausedMembers > 0) bad.push(`정지 회원 ${s.pausedMembers}명`);
  if (absent30.length) todo.push(`장기 미출석 ${absent30.length}명 복귀 연락 (상위: ${absent30.slice(0, 3).map(m => m.name).join(", ")})`);
  if (lowRemain.length) todo.push(`잔여 3회 이하 ${lowRemain.length}명 재등록 상담 (${lowRemain.slice(0, 3).map(m => m.name).join(", ")})`);
  if (full.ended.length) todo.push(`종료 회원 ${full.ended.length}명 재방문 제안 (${full.ended.slice(0, 3).map((m: any) => m.name).join(", ")})`);
  if (s.pausedMembers > 0) todo.push(`정지 회원 ${s.pausedMembers}명 복귀일 확인`);

  const months: number[] = s.monthly.map((m: any) => m.month);
  const regIdx = (arr: number[] | undefined, i: number) => arr?.[i] ?? 0;
  const maxSess = Math.max(1, ...s.monthly.map((m: any) => m.sessions));

  return (
    <>
      <header className="mb-6 border-b-4 border-slate-800 pb-3">
        <div className="text-[11px] text-slate-500 tracking-widest">ZIANT GYM · TRAINER PERFORMANCE REPORT</div>
        <h1 className="text-[22px] font-bold mt-1">{full.trainerName} 트레이너 성과 보고서</h1>
        <div className="text-[12px] text-slate-600 mt-1">
          대상 기간: {full.year}년 {PERIOD_LABEL[full.period as Period]} · 작성일 {today} · 관리 회원·잔여는 작성일 기준
        </div>
      </header>

      <Section title="핵심 지표">
        <div className="grid grid-cols-5 gap-2 report-grid">
          <Kpi label="총 수업" value={`${s.sessions.toLocaleString()}회`} sub={`월평균 ${s.avgMonthly}회`} />
          <Kpi label="관리 회원" value={`${s.managedMembers}명`} sub={`정지 ${s.pausedMembers}명 · 잔여 ${remainingTotal}회`} />
          <Kpi label="신규 (PT)" value={`${s.newMembers}명`} sub={`매출 ${man(s.newAmount)}`} />
          <Kpi label="재등록" value={`${s.reregCount}건`} sub={`${s.reregMembers}명 · 매출 ${man(s.reregAmount)}`} />
          <Kpi label="재등록률" value={s.reregRate == null ? "-" : `${s.reregRate}%`} sub={`종료 ${s.completed}명 · 노쇼 ${s.noShows}회`} />
        </div>
        <div className="text-[11px] text-slate-500 mt-2">PT 매출 합계(신규+재등록, 환불 차감): <b className="text-slate-800">{won(ptRevenue)}</b></div>
      </Section>

      {others.length > 0 && (
        <Section title="센터 평균 대비" sub={`트레이너 ${others.length}명 기준`}>
          <Table
            head={["지표", "본인", "센터 평균", "평균 대비", "센터 순위"]}
            align={["l", "r", "r", "r", "c"]}
            rows={metrics.map(([label, k, f]) => {
              const mine = Number(s[k] ?? 0);
              const a = avg(k) ?? 0;
              const diff = a > 0 ? pct(mine, a) - 100 : 0;
              return [label, f(mine), f(a), a > 0 ? `${diff >= 0 ? "+" : ""}${diff}%` : "-", k === "completed" ? "-" : `${rank(k)} / ${others.length}`];
            })}
          />
          <div className="text-[10px] text-slate-500">* 종료는 낮을수록 좋아 순위를 매기지 않음</div>
        </Section>
      )}

      {prev && (
        <Section title="상반기 대비">
          <Table
            head={["지표", "상반기", "하반기", "증감"]}
            align={["l", "r", "r", "r"]}
            rows={metrics.map(([label, k, f]) => {
              const a = Number(prev.stats[k] ?? 0), b = Number(s[k] ?? 0);
              const d = b - a;
              return [label, f(a), f(b), `${d >= 0 ? "+" : ""}${f(d)}`];
            })}
          />
        </Section>
      )}

      <Section title="월별 추이" sub="수업·재등록·신규 등록 건수">
        <Table
          head={["월", "수업", "", "재등록", "PT 신규", "헬스 신규"]}
          align={["c", "r", "l", "r", "r", "r"]}
          rows={s.monthly.map((m: any, i: number) => [
            `${m.month}월`, m.sessions, <Bar v={m.sessions} max={maxSess} />, m.rereg,
            regIdx(myReg?.pt, i), regIdx(myReg?.health, i),
          ])}
          foot={["합계", s.sessions, "", s.reregCount, sum(myReg?.pt ?? []), sum(myReg?.health ?? [])]}
        />
        <div className="text-[10px] text-slate-500">* 신규 등록은 매출 건수 기준 (신규 칸의 '명'과 다를 수 있음) · {months.length}개월</div>
      </Section>

      <Section title="재등록 분석" sub={`재등록률 = 재등록 ${s.reregCount}건 ÷ (재등록 ${s.reregCount} + 종료 ${s.completed})`}>
        <div className="grid grid-cols-2 gap-3 report-grid">
          <div>
            <div className="text-[12px] font-semibold mb-1">프로그램별 재등록</div>
            <Table
              head={["프로그램", "건수", "매출", "건당 평균"]}
              align={["l", "r", "r", "r"]}
              rows={[...byProgram.entries()].sort((a, b) => b[1].c - a[1].c).map(([k, v]) => [k, `${v.c}건`, man(v.amt), man(v.amt / v.c)])}
              foot={["합계", `${s.reregCount}건`, man(s.reregAmount), s.reregCount ? man(s.reregAmount / s.reregCount) : "-"]}
            />
          </div>
          <div>
            <div className="text-[12px] font-semibold mb-1">반복 재등록 회원 (2회 이상)</div>
            <Table head={["회원", "재등록 횟수"]} align={["l", "c"]} rows={repeaters.map(([name, c]) => [name, `${c}회`])} />
          </div>
        </div>
      </Section>

      <Section title="회원 현황" sub="작성일 기준">
        <div className="grid grid-cols-4 gap-2 mb-3 report-grid">
          <Kpi label="관리 회원" value={`${managed.length}명`} />
          <Kpi label="14~29일 미출석" value={`${absent14.length}명`} />
          <Kpi label="30일 이상 미출석" value={`${absent30.length}명`} sub={`잔여 ${sum(absent30.map(m => Number(m.remaining ?? 0)))}회`} />
          <Kpi label="잔여 3회 이하" value={`${lowRemain.length}명`} sub="재등록 상담 대상" />
        </div>
        <Table
          head={["회원", "패키지 (사용/총)", "잔여", "마지막 수업", "경과", "상태"]}
          align={["l", "l", "r", "c", "r", "c"]}
          rows={managed.map(m => [
            m.name, m.packages ?? "-", `${m.remaining ?? 0}회`, m.lastSession ?? "기록 없음",
            m.gap == null ? "-" : `${m.gap}일`,
            m.gap == null || m.gap >= 30 ? "장기 미출석" : m.gap >= 14 ? "관심 필요" : Number(m.remaining) <= 3 ? "재등록 상담" : "정상",
          ])}
        />
        {full.paused.length > 0 && (
          <>
            <div className="text-[12px] font-semibold mt-3 mb-1">정지 회원 {full.paused.length}명</div>
            <Table head={["회원", "패키지", "잔여", "마지막 수업"]} align={["l", "l", "r", "c"]}
              rows={full.paused.map((m: any) => [m.name, m.packages ?? "-", `${m.remaining ?? 0}회`, m.lastSession ?? "-"])} />
          </>
        )}
      </Section>

      <Section title="종료 회원" sub="패키지를 다 쓰고 진행 중인 패키지가 없는 회원">
        <Table head={["회원", "완료한 패키지", "마지막 수업", "경과"]} align={["l", "l", "c", "r"]}
          rows={full.ended.map((m: any) => [m.name, m.finished ?? "-", m.lastSession ?? "-", `${daysSince(m.lastSession, today) ?? "-"}일`])} />
      </Section>

      <Section title="신규 등록 명단 (PT)">
        <Table head={["#", "회원", "등록일", "프로그램", "횟수", "금액"]} align={["c", "l", "c", "l", "r", "r"]}
          rows={full.newEntries.map((e: any, i: number) => [i + 1, e.name, e.paymentDate, e.programDetail ?? "PT", e.sessions ? `${e.sessions}회` : "-", won(Number(e.amount ?? 0))])}
          foot={["", `${full.newEntries.length}건`, "", "", "", won(s.newAmount)]} />
      </Section>

      <Section title="재등록 명단 (PT)">
        <Table head={["#", "회원", "결제일", "프로그램", "횟수", "금액"]} align={["c", "l", "c", "l", "r", "r"]}
          rows={full.reregEntries.map((e: any, i: number) => [i + 1, e.name, e.paymentDate, e.programDetail ?? "PT", e.sessions ? `${e.sessions}회` : "-", won(Number(e.amount ?? 0))])}
          foot={["", `${full.reregEntries.length}건`, "", "", "", won(s.reregAmount)]} />
      </Section>

      <Section title="종합 진단">
        <Findings good={good} bad={bad} todo={todo} />
      </Section>

      <footer className="text-[10px] text-slate-400 border-t border-slate-300 pt-2 mt-4">
        산식 — 수업: 출석체크 + 수업일지(같은 날 중복 제외) · 월평균: 수업 기록이 있는 달 기준 · 재등록률: 재등록 건 ÷ (재등록 건 + 종료) ·
        종료: 해당 연도에 시작한 유료 패키지를 다 쓰고 진행 중인 패키지가 없는 회원 · 매출: PT 신규·재등록 결제액에서 환불 차감
      </footer>
    </>
  );
}

// ── 센터 전체 보고서 ──────────────────────────────────────────────
function CenterReportBody({ center, prev, today }: { center: any; prev: any; today: string }) {
  const tr: any[] = [...center.trainers].sort((a, b) => b.sessions - a.sessions);
  const T = center.total;
  const months: number[] = center.newRegs?.months ?? tr[0]?.monthly.map((m: any) => m.month) ?? [];
  const monthlySessions = months.map((_, i) => sum(tr.map(t => t.monthly[i]?.sessions ?? 0)));
  const monthlyRereg = months.map((_, i) => sum(tr.map(t => t.monthly[i]?.rereg ?? 0)));
  const regRows: any[] = center.newRegs?.rows ?? [];
  const un = center.newRegs?.unassigned ?? { pt: [], health: [] };
  const monthlyPt = months.map((_, i) => sum(regRows.map(r => r.pt[i] ?? 0)) + (un.pt[i] ?? 0));
  const monthlyHealth = months.map((_, i) => sum(regRows.map(r => r.health[i] ?? 0)) + (un.health[i] ?? 0));
  const revenue = (t: any) => Number(t.newAmount ?? 0) + Number(t.reregAmount ?? 0);
  const totalRevenue = Number(T.newAmount ?? 0) + Number(T.reregAmount ?? 0);
  const maxSess = Math.max(1, ...monthlySessions);
  const activeMonths = monthlySessions.filter(v => v > 0).length || 1;

  const good: string[] = [], bad: string[] = [], todo: string[] = [];
  const best = (k: string) => [...tr].sort((a, b) => Number(b[k] ?? 0) - Number(a[k] ?? 0))[0];
  if (tr.length) {
    good.push(`수업 최다: ${best("sessions").trainerName} (${best("sessions").sessions.toLocaleString()}회)`);
    const br = [...tr].filter(t => t.reregRate != null).sort((a, b) => b.reregRate - a.reregRate)[0];
    if (br) good.push(`재등록률 최고: ${br.trainerName} (${br.reregRate}%)`);
    good.push(`PT 매출 최고: ${[...tr].sort((a, b) => revenue(b) - revenue(a))[0].trainerName} (${man(revenue([...tr].sort((a, b) => revenue(b) - revenue(a))[0]))})`);
    const low = tr.filter(t => t.reregRate != null && T.reregRate != null && t.reregRate < T.reregRate - 10);
    if (low.length) bad.push(`재등록률 센터 평균(${T.reregRate}%)보다 10%p 이상 낮음: ${low.map(t => `${t.trainerName} ${t.reregRate}%`).join(", ")}`);
    const manyEnd = tr.filter(t => t.completed >= 5);
    if (manyEnd.length) bad.push(`종료 5명 이상: ${manyEnd.map(t => `${t.trainerName} ${t.completed}명`).join(", ")}`);
    if (sum(un.health) > 0) bad.push(`담당자 없는 헬스 신규 ${sum(un.health)}건 — 판매 성과 추적 불가`);
    if (T.pausedMembers > 0) todo.push(`정지 회원 ${T.pausedMembers}명 복귀일 일괄 확인`);
    if (low.length) todo.push(`${low.map(t => t.trainerName).join(", ")} 종료 회원 명단 점검 및 재등록 상담 코칭`);
    if (sum(un.health) > 0) todo.push("헬스권 등록 시 담당자 필수 입력");
    todo.push("트레이너별 장기 미출석 회원 복귀 연락 (트레이너 보고서 '회원 현황' 참고)");
  }

  return (
    <>
      <header className="mb-6 border-b-4 border-slate-800 pb-3">
        <div className="text-[11px] text-slate-500 tracking-widest">ZIANT GYM · CENTER PERFORMANCE REPORT</div>
        <h1 className="text-[22px] font-bold mt-1">자이언트짐 센터 성과 보고서</h1>
        <div className="text-[12px] text-slate-600 mt-1">대상 기간: {center.year}년 {PERIOD_LABEL[center.period as Period]} · 작성일 {today} · 트레이너 {tr.length}명</div>
      </header>

      <Section title="핵심 지표">
        <div className="grid grid-cols-5 gap-2 report-grid">
          <Kpi label="총 수업" value={`${T.sessions.toLocaleString()}회`} sub={`월평균 ${Math.round(T.sessions / activeMonths)}회`} />
          <Kpi label="관리 회원" value={`${T.managedMembers}명`} sub={`정지 ${T.pausedMembers}명`} />
          <Kpi label="신규 (PT)" value={`${T.newMembers}명`} sub={`헬스 신규 ${sum(monthlyHealth)}건`} />
          <Kpi label="재등록" value={`${T.reregCount}건`} sub={`재등록률 ${T.reregRate ?? "-"}%`} />
          <Kpi label="PT 매출" value={man(totalRevenue)} sub={`신규 ${man(T.newAmount ?? 0)} · 재등록 ${man(T.reregAmount ?? 0)}`} />
        </div>
      </Section>

      <Section title="트레이너별 성과 비교">
        <Table
          head={["트레이너", "수업", "월평균", "관리", "정지", "신규", "재등록", "재등록률", "종료", "노쇼", "PT 매출", "매출 비중"]}
          align={["l", "r", "r", "r", "r", "r", "r", "r", "r", "r", "r", "r"]}
          rows={tr.map(t => [t.trainerName, t.sessions.toLocaleString(), t.avgMonthly, t.managedMembers, t.pausedMembers, t.newMembers,
            t.reregCount, t.reregRate == null ? "-" : `${t.reregRate}%`, t.completed, t.noShows, man(revenue(t)), `${pct(revenue(t), totalRevenue)}%`])}
          foot={["합계", T.sessions.toLocaleString(), "-", T.managedMembers, T.pausedMembers, T.newMembers, T.reregCount,
            T.reregRate == null ? "-" : `${T.reregRate}%`, T.completed, T.noShows, man(totalRevenue), "100%"]}
        />
      </Section>

      <Section title="트레이너 순위">
        <div className="grid grid-cols-3 gap-3 report-grid">
          {([["수업", "sessions", "회"], ["재등록", "reregCount", "건"], ["신규", "newMembers", "명"]] as const).map(([label, k, u]) => {
            const sorted = [...tr].sort((a, b) => b[k] - a[k]);
            const mx = Math.max(1, ...sorted.map(t => t[k]));
            return (
              <div key={k}>
                <div className="text-[12px] font-semibold mb-1">{label}</div>
                <Table head={["순위", "트레이너", "", label]} align={["c", "l", "l", "r"]}
                  rows={sorted.map((t, i) => [i + 1, t.trainerName, <Bar v={t[k]} max={mx} />, `${t[k]}${u}`])} />
              </div>
            );
          })}
        </div>
      </Section>

      <Section title="월별 추이" sub="센터 합계">
        <Table
          head={["월", "수업", "", "재등록", "PT 신규", "헬스 신규", "신규 합계"]}
          align={["c", "r", "l", "r", "r", "r", "r"]}
          rows={months.map((m, i) => [`${m}월`, monthlySessions[i].toLocaleString(), <Bar v={monthlySessions[i]} max={maxSess} />, monthlyRereg[i], monthlyPt[i], monthlyHealth[i], monthlyPt[i] + monthlyHealth[i]])}
          foot={["합계", sum(monthlySessions).toLocaleString(), "", sum(monthlyRereg), sum(monthlyPt), sum(monthlyHealth), sum(monthlyPt) + sum(monthlyHealth)]}
        />
      </Section>

      <Section title="트레이너별 월별 수업">
        <Table head={["트레이너", ...months.map(m => `${m}월`), "합계"]} align={["l", ...months.map(() => "r" as const), "r"]}
          rows={tr.map(t => [t.trainerName, ...t.monthly.map((m: any) => m.sessions), t.sessions.toLocaleString()])}
          foot={["합계", ...monthlySessions.map(v => v.toLocaleString()), sum(monthlySessions).toLocaleString()]} />
      </Section>

      <Section title="트레이너별 월별 재등록">
        <Table head={["트레이너", ...months.map(m => `${m}월`), "합계"]} align={["l", ...months.map(() => "r" as const), "r"]}
          rows={[...tr].sort((a, b) => b.reregCount - a.reregCount).map(t => [t.trainerName, ...t.monthly.map((m: any) => m.rereg), t.reregCount])}
          foot={["합계", ...monthlyRereg, sum(monthlyRereg)]} />
      </Section>

      <Section title="신규 등록 현황" sub="매출 건수 · PT / 헬스">
        <Table head={["트레이너", ...months.map(m => `${m}월`), "PT", "헬스", "합계"]} align={["l", ...months.map(() => "r" as const), "r", "r", "r"]}
          rows={[...regRows, { trainerName: "미배정", ...un }]
            .filter(r => sum(r.pt) + sum(r.health) > 0)
            .sort((a, b) => (sum(b.pt) + sum(b.health)) - (sum(a.pt) + sum(a.health)))
            .map(r => [r.trainerName, ...months.map((_, i) => (r.pt[i] ?? 0) + (r.health[i] ?? 0)), sum(r.pt), sum(r.health), sum(r.pt) + sum(r.health)])}
          foot={["합계", ...months.map((_, i) => monthlyPt[i] + monthlyHealth[i]), sum(monthlyPt), sum(monthlyHealth), sum(monthlyPt) + sum(monthlyHealth)]} />
      </Section>

      {prev && (
        <Section title="상반기 대비">
          <Table head={["지표", "상반기", "하반기", "증감"]} align={["l", "r", "r", "r"]}
            rows={([
              ["총 수업", prev.total.sessions, T.sessions, "회"],
              ["신규 (PT)", prev.total.newMembers, T.newMembers, "명"],
              ["재등록", prev.total.reregCount, T.reregCount, "건"],
              ["종료", prev.total.completed, T.completed, "명"],
              ["PT 매출(만)", Math.round(((prev.total.newAmount ?? 0) + (prev.total.reregAmount ?? 0)) / 10000), Math.round(totalRevenue / 10000), "만"],
            ] as [string, number, number, string][]).map(([l, a, b, u]) => [l, `${a.toLocaleString()}${u}`, `${b.toLocaleString()}${u}`, `${b - a >= 0 ? "+" : ""}${(b - a).toLocaleString()}${u}`])}
            />
        </Section>
      )}

      <Section title="종합 진단">
        <Findings good={good} bad={bad} todo={todo} />
      </Section>

      <footer className="text-[10px] text-slate-400 border-t border-slate-300 pt-2 mt-4">
        산식 — 수업: 출석체크 + 수업일지(같은 날 중복 제외) · 재등록률: 재등록 건 ÷ (재등록 건 + 종료) · 종료: 해당 연도에 시작한 유료 패키지를 다 쓰고 진행 중인 패키지가 없는 회원 ·
        관리·정지 회원은 작성일 기준 · 매출: PT 신규·재등록 결제액에서 환불 차감 · 신규 등록 건수는 담당 트레이너 → 상담자 → 회원 담당 순 귀속
      </footer>
    </>
  );
}

// ── 페이지 ───────────────────────────────────────────────────────
export default function PerformanceReport() {
  const [, setLocation] = useLocation();
  const params = new URLSearchParams(useSearch());
  const year = Number(params.get("year")) || new Date().getFullYear();
  const period = (["H1", "H2", "annual"].includes(params.get("period") ?? "") ? params.get("period") : "annual") as Period;
  const trainerParam = params.get("trainerId") ?? "all";
  const isCenter = trainerParam === "all";
  const trainerId = isCenter ? 0 : Number(trainerParam);
  const today = useMemo(kstToday, []);

  const { data: me } = trpc.auth.me.useQuery();
  const isAdmin = me?.role === "admin" || me?.role === "sub_admin";

  const centerQ = trpc.admin.getTrainerPeriodReport.useQuery({ year, period }, { enabled: isAdmin, retry: false });
  const prevCenterQ = trpc.admin.getTrainerPeriodReport.useQuery({ year, period: "H1" }, { enabled: isAdmin && period === "H2", retry: false });
  const fullQ = trpc.admin.getTrainerPeriodFull.useQuery({ trainerId, year, period }, { enabled: !isCenter && trainerId > 0, retry: false });
  const prevFullQ = trpc.admin.getTrainerPeriodFull.useQuery({ trainerId, year, period: "H1" }, { enabled: !isCenter && trainerId > 0 && period === "H2", retry: false });

  const go = (p: Partial<{ year: number; period: Period; trainerId: string }>) => {
    const q = new URLSearchParams({ year: String(p.year ?? year), period: p.period ?? period, trainerId: p.trainerId ?? trainerParam });
    setLocation(`/performance-report?${q.toString()}`);
  };

  const loading = isCenter ? centerQ.isLoading : fullQ.isLoading;
  const err = isCenter ? (!isAdmin ? "관리자만 볼 수 있습니다." : centerQ.error?.message) : fullQ.error?.message;

  const body = !loading && !err && (isCenter
    ? centerQ.data && <CenterReportBody center={centerQ.data} prev={prevCenterQ.data} today={today} />
    : fullQ.data && <TrainerReportBody full={{ ...fullQ.data, trainerId }} center={centerQ.data} prev={prevFullQ.data} today={today} />);

  const trainersList: any[] = centerQ.data?.trainers ?? [];
  const pageTitle = isCenter ? "센터 성과 보고서" : `${fullQ.data?.trainerName ?? ""} 성과 보고서`;

  return (
    <div className="space-y-4">
      <style>{`
        .perf-print { display: none; }
        .report-doc { counter-reset: sec; }
        .report-doc .report-h2::before { counter-increment: sec; content: counter(sec) ". "; margin-right: -0.25rem; }
        @media print {
          @page { size: A4; margin: 12mm; }
          #root { display: none !important; }
          .perf-print { display: block !important; color: #0f172a; background: #fff; font-size: 12px; }
          .perf-print .report-section { break-inside: auto; }
          .perf-print h2 { break-after: avoid; }
          .perf-print tr { break-inside: avoid; }
          .perf-print .report-grid { break-inside: avoid; }
          html, body { background: #fff !important; }
          * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <button onClick={() => setLocation("/trainers")} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeft className="h-4 w-4" /> 트레이너
        </button>
        <div className="flex items-center gap-2 flex-wrap">
          {isAdmin && (
            <select value={trainerParam} onChange={e => go({ trainerId: e.target.value })}
              className="bg-card border border-border rounded-lg px-2 py-1.5 text-xs">
              <option value="all">센터 전체</option>
              {trainersList.map(t => <option key={t.trainerId} value={String(t.trainerId)}>{t.trainerName}</option>)}
            </select>
          )}
          <div className="flex items-center gap-1 bg-card border border-border rounded-lg px-2 py-1">
            <button onClick={() => go({ year: year - 1 })} className="px-1 text-muted-foreground hover:text-foreground">‹</button>
            <span className="text-xs font-medium">{year}년</span>
            <button onClick={() => go({ year: year + 1 })} className="px-1 text-muted-foreground hover:text-foreground">›</button>
          </div>
          <div className="flex bg-card border border-border rounded-lg p-0.5 gap-0.5">
            {(["H1", "H2", "annual"] as Period[]).map(k => (
              <button key={k} onClick={() => go({ period: k })}
                className={`px-2.5 py-1 rounded-md text-xs font-medium ${period === k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                {k === "H1" ? "상반기" : k === "H2" ? "하반기" : "연간"}
              </button>
            ))}
          </div>
          <button onClick={() => { document.title = `${pageTitle} ${year} ${PERIOD_LABEL[period]}`; window.print(); }}
            disabled={!body}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold disabled:opacity-50">
            <Printer className="h-3.5 w-3.5" /> 프린트 / PDF 저장
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground text-center py-16">보고서를 만드는 중...</p>
      ) : err ? (
        <p className="text-sm text-red-400 text-center py-16">{err}</p>
      ) : (
        <div className="report-doc bg-white text-slate-900 rounded-xl p-6 md:p-10 max-w-[1000px] mx-auto shadow overflow-x-auto">
          {body}
        </div>
      )}

      {body && <Portal><div className="perf-print report-doc">{body}</div></Portal>}
    </div>
  );
}
