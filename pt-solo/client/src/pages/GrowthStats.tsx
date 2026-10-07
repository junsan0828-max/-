import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import GrowthAnalysis from "@/components/GrowthAnalysis";
import { ChevronLeft, ChevronRight, TrendingUp, Users, RefreshCw, BarChart3, MapPin, UserRound } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";

const PERIOD_LABELS: Record<string, string> = { H1: "상반기", H2: "하반기", annual: "연간", month: "월간" };
const MONTHS = ["1월","2월","3월","4월","5월","6월","7월","8월","9월","10월","11월","12월"];
const GENDER_LABELS: Record<string, string> = { male: "남성", female: "여성", other: "기타", 미입력: "미입력" };

const COLORS = ["#8b5cf6","#06b6d4","#10b981","#f59e0b","#ef4444","#ec4899","#6366f1"];

function fmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}백만`;
  if (n >= 10_000) return `${Math.floor(n / 10_000)}만`;
  return n.toLocaleString();
}

export default function GrowthStats() {
  const [, setLocation] = useLocation();
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const defaultPeriod: "H1" | "H2" | "annual" | "month" = currentMonth <= 6 ? "H1" : "H2";

  const [year, setYear] = useState(currentYear);
  const [period, setPeriod] = useState<"H1" | "H2" | "annual" | "month">(defaultPeriod);
  const [month, setMonth] = useState(currentMonth);
  const [tab, setTab] = useState<"stats" | "analysis">("stats");

  const { data, isLoading } = trpc.dashboard.getGrowthStats.useQuery(
    { year, period, month },
    { refetchOnWindowFocus: false, enabled: tab === "stats" }
  );

  const summary = data?.summary ?? { newCount: 0, reregCount: 0, reregRate: 0, totalRevenue: 0 };
  const programs = data?.programs ?? [];
  const visitRoutes = data?.visitRoutes ?? [];
  const genders = data?.genders ?? [];
  const monthly = data?.monthly ?? [];

  const maxProgTotal = Math.max(...programs.map(p => p.total), 1);
  const totalGender = genders.reduce((s, g) => s + g.count, 0) || 1;

  return (
    <div className="min-h-screen bg-background pb-8">
      {/* 상단 헤더 */}
      <div className="sticky top-0 z-10 bg-background border-b border-border px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => setLocation("/")}
          className="p-1.5 -ml-1.5 hover:bg-accent/40 rounded-lg transition-colors"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <TrendingUp className="h-4 w-4 text-primary" />
        <span className="font-semibold text-sm flex-1">성장 분석</span>

        {/* 연도 */}
        {tab === "stats" && <div className="flex items-center gap-1">
          <button onClick={() => setYear(y => y - 1)} className="p-1 hover:bg-accent/40 rounded-lg">
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground rotate-180" />
          </button>
          <span className="text-xs font-semibold w-10 text-center">{year}년</span>
          <button
            onClick={() => setYear(y => y + 1)}
            disabled={year >= currentYear}
            className="p-1 hover:bg-accent/40 rounded-lg disabled:opacity-30"
          >
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </div>}
      </div>

      <div className="px-4 pt-4 space-y-5">
        <div className="grid grid-cols-2 gap-1 bg-muted/50 rounded-xl p-1">
          {([["stats", "통계"], ["analysis", "분석"]] as const).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`text-sm font-semibold py-2 rounded-lg transition-colors ${
                tab === k ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "analysis" ? <GrowthAnalysis /> : (<>
        {/* 기간 탭 */}
        <div className="flex gap-1 bg-muted/50 rounded-xl p-1">
          {(["H1", "H2", "annual", "month"] as const).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`flex-1 text-xs font-semibold py-1.5 rounded-lg transition-colors ${
                period === p ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>

        {/* 월 선택 (period === "month" 일 때) */}
        {period === "month" && (
          <div className="grid grid-cols-6 gap-1.5">
            {MONTHS.map((m, i) => (
              <button
                key={i}
                onClick={() => setMonth(i + 1)}
                className={`text-xs py-1.5 rounded-lg font-medium transition-colors ${
                  month === i + 1
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/40 text-muted-foreground hover:text-foreground"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        )}

        {isLoading ? (
          <div className="py-16 text-center text-sm text-muted-foreground">불러오는 중...</div>
        ) : (
          <>
            {/* KPI 카드 4개 */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-card border border-border p-4">
                <div className="flex items-center gap-1.5 mb-2">
                  <Users className="h-3.5 w-3.5 text-primary" />
                  <span className="text-[11px] text-muted-foreground font-medium">신규 등록</span>
                </div>
                <p className="text-2xl font-bold text-primary">
                  {summary.newCount}<span className="text-sm font-normal ml-1">건</span>
                </p>
              </div>

              <div className="rounded-2xl bg-card border border-border p-4">
                <div className="flex items-center gap-1.5 mb-2">
                  <RefreshCw className="h-3.5 w-3.5 text-emerald-500" />
                  <span className="text-[11px] text-muted-foreground font-medium">재등록</span>
                </div>
                <p className="text-2xl font-bold text-emerald-500">
                  {summary.reregCount}<span className="text-sm font-normal ml-1">건</span>
                </p>
              </div>

              <div className="rounded-2xl bg-card border border-border p-4">
                <div className="flex items-center gap-1.5 mb-2">
                  <BarChart3 className="h-3.5 w-3.5 text-amber-500" />
                  <span className="text-[11px] text-muted-foreground font-medium">재등록률</span>
                </div>
                <p className={`text-2xl font-bold ${
                  summary.reregRate >= 50 ? "text-emerald-500" :
                  summary.reregRate >= 30 ? "text-amber-500" : "text-rose-500"
                }`}>
                  {summary.reregRate}<span className="text-sm font-normal ml-1">%</span>
                </p>
              </div>

              <div className="rounded-2xl bg-card border border-border p-4">
                <div className="flex items-center gap-1.5 mb-2">
                  <TrendingUp className="h-3.5 w-3.5 text-violet-500" />
                  <span className="text-[11px] text-muted-foreground font-medium">총 매출</span>
                </div>
                <p className="text-2xl font-bold text-violet-500">
                  {fmt(summary.totalRevenue)}<span className="text-sm font-normal ml-1">원</span>
                </p>
              </div>
            </div>

            {/* 프로그램별 현황 */}
            <div className="rounded-2xl bg-card border border-border p-4 space-y-3">
              <p className="text-sm font-semibold">프로그램별 현황</p>
              {programs.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">해당 기간 데이터가 없어요</p>
              ) : (
                <div className="space-y-3">
                  {programs.map((prog, i) => {
                    return (
                      <div key={i} className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium truncate max-w-[60%]">{prog.name}</span>
                          <span className="text-xs text-muted-foreground tabular-nums">
                            {fmt(prog.revenue)}원
                          </span>
                        </div>
                        <div className="h-5 rounded-full overflow-hidden bg-muted/40 flex">
                          <div
                            className="h-full transition-all duration-500"
                            style={{ width: `${(prog.신규 / maxProgTotal) * 100}%`, background: COLORS[i % COLORS.length] }}
                          />
                          <div
                            className="h-full transition-all duration-500"
                            style={{ width: `${(prog.재등록 / maxProgTotal) * 100}%`, background: COLORS[i % COLORS.length], opacity: 0.45 }}
                          />
                        </div>
                        <div className="flex gap-3 text-[10px] text-muted-foreground">
                          <span>전체 <span className="font-semibold text-foreground">{prog.total}건</span></span>
                          <span>신규 <span className="font-semibold text-foreground">{prog.신규}건</span></span>
                          <span>재등록 <span className="font-semibold text-foreground">{prog.재등록}건</span></span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 유입경로 */}
            {visitRoutes.length > 0 && (
              <div className="rounded-2xl bg-card border border-border p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <MapPin className="h-3.5 w-3.5 text-primary" />
                  <p className="text-sm font-semibold">유입경로 분포</p>
                  <span className="text-xs text-muted-foreground ml-auto">신규 회원 기준</span>
                </div>
                <div className="space-y-2">
                  {(() => {
                    const total = visitRoutes.reduce((s, r) => s + r.count, 0) || 1;
                    return visitRoutes.map((r, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground w-16 truncate">{r.route}</span>
                        <div className="flex-1 h-4 bg-muted/40 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${Math.round((r.count / total) * 100)}%`,
                              background: COLORS[i % COLORS.length],
                            }}
                          />
                        </div>
                        <span className="text-xs font-semibold w-10 text-right tabular-nums">
                          {Math.round((r.count / total) * 100)}%
                        </span>
                        <span className="text-[10px] text-muted-foreground w-8 tabular-nums">
                          {r.count}명
                        </span>
                      </div>
                    ));
                  })()}
                </div>
              </div>
            )}

            {/* 성별 분포 */}
            {genders.length > 0 && (
              <div className="rounded-2xl bg-card border border-border p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <UserRound className="h-3.5 w-3.5 text-primary" />
                  <p className="text-sm font-semibold">성별 분포</p>
                  <span className="text-xs text-muted-foreground ml-auto">활성 회원 기준</span>
                </div>
                {/* 수평 스택 바 */}
                <div className="h-6 rounded-full overflow-hidden flex">
                  {genders.map((g, i) => (
                    <div
                      key={i}
                      className="h-full transition-all duration-500"
                      style={{
                        width: `${Math.round((g.count / totalGender) * 100)}%`,
                        background: COLORS[i % COLORS.length],
                      }}
                    />
                  ))}
                </div>
                <div className="flex gap-4 flex-wrap">
                  {genders.map((g, i) => (
                    <div key={i} className="flex items-center gap-1.5">
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ background: COLORS[i % COLORS.length] }}
                      />
                      <span className="text-xs">
                        {GENDER_LABELS[g.gender] ?? g.gender}
                        <span className="text-muted-foreground ml-1">
                          {g.count}명 ({Math.round((g.count / totalGender) * 100)}%)
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 월별 추이 (최근 6개월) */}
            {monthly.length > 0 && (
              <div className="rounded-2xl bg-card border border-border p-4 space-y-3">
                <p className="text-sm font-semibold">월별 추이 <span className="text-xs font-normal text-muted-foreground">(최근 6개월)</span></p>
                <div className="h-44 -mx-1">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthly} barGap={2} barCategoryGap="30%">
                      <XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                      <YAxis hide />
                      <Tooltip
                        contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid var(--border)", background: "var(--card)" }}
                        cursor={{ fill: "transparent" }}
                      />
                      <Bar dataKey="신규" name="신규" fill="#8b5cf6" radius={[4,4,0,0]} maxBarSize={18} />
                      <Bar dataKey="재등록" name="재등록" fill="#10b981" radius={[4,4,0,0]} maxBarSize={18} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex gap-4 justify-center">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-violet-500" />
                    <span className="text-xs text-muted-foreground">신규</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    <span className="text-xs text-muted-foreground">재등록</span>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
        </>)}
      </div>
    </div>
  );
}
