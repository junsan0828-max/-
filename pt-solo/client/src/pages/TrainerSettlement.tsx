import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TrendingUp, FileText, Calendar, ChevronLeft, ChevronRight, BarChart2 } from "lucide-react";
import TabBanner from "@/components/TabBanner";

function fmt(n: number) { return n.toLocaleString(); }

function prevMonth(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function nextMonth(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function StatItem({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="p-3 rounded-lg bg-accent/20 border border-border flex flex-col gap-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-lg font-bold ${color ?? ""}`}>{value}</p>
    </div>
  );
}

function RevenueTab() {
  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];
  const [yearMonth, setYearMonth] = useState(
    `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`
  );
  const [view, setView] = useState<"monthly" | "daily">("monthly");

  const { data: monthly } = trpc.trainers.getMonthlySettlement.useQuery(
    { yearMonth },
    { enabled: view === "monthly" }
  );
  const { data: daily } = trpc.trainers.getMonthlySettlement.useQuery(
    { yearMonth, dateFilter: todayStr },
    { enabled: view === "daily" }
  );
  const data = view === "monthly" ? monthly : daily;

  const exportCSV = () => {
    if (!data) return;
    const header = ["번호", "날짜", "회원명", "패키지", "단가(원)"];
    const rows = data.logs.map((l, i) => [i + 1, l.sessionDate, l.memberName ?? "-", l.packageName ?? "-", l.effectivePrice]);
    rows.push(["합계", "", "", "", data.revenue] as any);
    const csv = [header, ...rows].map(r => r.join(",")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `매출내역_${view === "daily" ? todayStr : yearMonth}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportPDF = () => {
    if (!data) return;
    const label = view === "daily" ? todayStr : yearMonth;
    const title = `매출 내역 - ${label}`;
    const lines = [
      title, `총 세션: ${data.sessionCount}회`, `총 매출: ${fmt(data.revenue)}원`, "",
      "번호  날짜          회원명          단가", "─".repeat(45),
      ...data.logs.map((l, i) =>
        `${String(i + 1).padStart(2)}    ${l.sessionDate}  ${(l.memberName ?? "-").padEnd(10)}  ${fmt(l.effectivePrice).padStart(8)}원`
      ),
      "─".repeat(45), `합계                              ${fmt(data.revenue).padStart(8)}원`,
    ];
    const printWin = window.open("", "_blank");
    if (!printWin) return;
    printWin.document.write(`<html><head><title>${title}</title><style>body{font-family:monospace;font-size:13px;padding:24px;white-space:pre;}@media print{body{padding:0;}}</style></head><body>${lines.join("\n").replace(/</g, "&lt;")}</body></html>`);
    printWin.document.close();
    printWin.focus();
    setTimeout(() => printWin.print(), 300);
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <button onClick={() => setView("daily")}
          className={`flex-1 py-2 text-sm rounded-lg border transition-colors ${view === "daily" ? "bg-primary/20 border-primary/40 text-primary" : "border-border text-muted-foreground"}`}>
          일일 매출
        </button>
        <button onClick={() => setView("monthly")}
          className={`flex-1 py-2 text-sm rounded-lg border transition-colors ${view === "monthly" ? "bg-primary/20 border-primary/40 text-primary" : "border-border text-muted-foreground"}`}>
          월 매출
        </button>
      </div>

      {view === "monthly" && (
        <div className="flex items-center justify-between">
          <button onClick={() => setYearMonth(prevMonth(yearMonth))} className="p-2 rounded-lg hover:bg-accent/40">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-semibold">{yearMonth.replace("-", "년 ")}월</span>
          <button onClick={() => setYearMonth(nextMonth(yearMonth))} className="p-2 rounded-lg hover:bg-accent/40">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
      {view === "daily" && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Calendar className="h-4 w-4" />
          <span>오늘 ({todayStr})</span>
        </div>
      )}

      {data && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              {view === "daily" ? "오늘 매출" : `${yearMonth.replace("-", "년 ")}월 매출`}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-lg bg-accent/20 border border-border">
              <p className="text-xs text-muted-foreground mb-1">총 세션</p>
              <p className="text-lg font-bold">{data.sessionCount}회</p>
            </div>
            <div className="p-3 rounded-lg bg-primary/10 border border-primary/30">
              <p className="text-xs text-muted-foreground mb-1">총 매출</p>
              <p className="text-lg font-bold text-primary">{fmt(data.revenue)}원</p>
            </div>
          </CardContent>
        </Card>
      )}

      {data && data.sessionCount > 0 && (
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="flex-1 gap-1.5" onClick={exportCSV}>
            <FileText className="h-4 w-4" />CSV
          </Button>
          <Button variant="outline" size="sm" className="flex-1 gap-1.5" onClick={exportPDF}>
            <FileText className="h-4 w-4" />PDF 인쇄
          </Button>
        </div>
      )}

      {data && data.logs.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-semibold">세션 상세 내역</p>
          {data.logs.map((l) => (
            <div key={l.id} className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-accent/20 border border-border">
              <div>
                <p className="text-sm font-medium">{l.memberName ?? "-"}</p>
                <p className="text-xs text-muted-foreground">{l.sessionDate} · {l.packageName ?? "PT"}</p>
              </div>
              <p className="text-sm font-semibold text-primary">{fmt(l.effectivePrice)}원</p>
            </div>
          ))}
        </div>
      )}
      {data && data.logs.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">
          {view === "daily" ? "오늘 매출 내역이 없습니다." : `${yearMonth.replace("-", "년 ")}월 매출 내역이 없습니다.`}
        </p>
      )}
    </div>
  );
}

function StatsTab() {
  const { data: profile } = trpc.trainers.getMyProfile.useQuery();
  const { data: stats } = trpc.trainers.getMyStats.useQuery();

  const monthOptions = Array.from({ length: 12 }, (_, i) => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - i);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [statsMonth, setStatsMonth] = useState(monthOptions[0]);
  const { data: monthlyStats } = trpc.trainers.getMonthlySettlement.useQuery(
    { yearMonth: statsMonth },
    { enabled: !!profile?.id }
  );

  return (
    <div className="space-y-4">
      {/* 누적 */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-muted-foreground uppercase tracking-wide">누적 통계</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-2">
          <StatItem label="회원 수" value={`${stats?.totalMembers ?? 0}명`} color="text-blue-400" />
          <StatItem label="수업 수" value={`${stats?.totalSessions ?? 0}회`} color="text-green-400" />
          <StatItem label="재등록 수" value={`${stats?.totalRereg ?? 0}회`} color="text-primary" />
          <StatItem label="노쇼 수" value={`${stats?.totalNoShow ?? 0}회`} color="text-orange-400" />
          <StatItem label="잔여 PT" value={`${stats?.remainingPt ?? 0}회`} color="text-purple-400" />
        </CardContent>
      </Card>

      {/* 월평균 */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-muted-foreground uppercase tracking-wide">월평균</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <StatItem label="신규배정" value={`${stats?.avgMonthlyNewMembers ?? 0}명`} />
            <StatItem label="재등록" value={`${stats?.avgMonthlyRereg ?? 0}회`} />
            <StatItem label="PT 수" value={`${stats?.avgMonthlyPt ?? 0}회`} />
            <StatItem label="재등록률" value={`${stats?.reregRate ?? 0}%`} />
          </div>
          <div className="p-3 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">재등록률</p>
              <p className="text-xs text-muted-foreground mt-0.5">전체 회원 중 재등록 비율</p>
            </div>
            <p className="text-2xl font-bold text-primary">{stats?.reregRate ?? 0}%</p>
          </div>
        </CardContent>
      </Card>

      {/* 월별 조회 */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm text-muted-foreground uppercase tracking-wide">월별 조회</CardTitle>
            <Select value={statsMonth} onValueChange={setStatsMonth}>
              <SelectTrigger className="h-7 text-xs w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                {monthOptions.map(ym => {
                  const [y, mo] = ym.split("-");
                  return <SelectItem key={ym} value={ym}>{y}년 {parseInt(mo)}월</SelectItem>;
                })}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <StatItem label="수업 수" value={`${monthlyStats?.sessionCount ?? 0}회`} color="text-green-400" />
            <StatItem label="노쇼" value={`${monthlyStats?.noShow ?? 0}회`} color="text-orange-400" />
            <StatItem label="신규 배정" value={`${monthlyStats?.newMembers ?? 0}명`} color="text-blue-400" />
            <StatItem label="재등록" value={`${monthlyStats?.rereg ?? 0}회`} color="text-primary" />
          </div>
          <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">이달 매출</p>
              <p className="text-xs text-muted-foreground mt-0.5">등록 패키지 결제금액 합산</p>
            </div>
            <p className="text-xl font-bold text-yellow-400">{(monthlyStats?.revenue ?? 0).toLocaleString()}원</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function TrainerSettlement() {
  const [tab, setTab] = useState<"revenue" | "stats">("revenue");

  return (
    <div className="space-y-4">
      <TabBanner tabKey="settlement" />
      <div>
        <h1 className="text-xl font-bold">성장분석</h1>
        <p className="text-sm text-muted-foreground mt-0.5">매출 현황 및 활동 통계</p>
      </div>

      {/* 탭 선택 */}
      <div className="flex gap-2 border-b border-border">
        <button onClick={() => setTab("revenue")}
          className={`pb-2.5 px-1 text-sm font-medium border-b-2 transition-colors ${tab === "revenue" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
          <TrendingUp className="h-4 w-4 inline mr-1.5 mb-0.5" />매출
        </button>
        <button onClick={() => setTab("stats")}
          className={`pb-2.5 px-1 text-sm font-medium border-b-2 transition-colors ${tab === "stats" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
          <BarChart2 className="h-4 w-4 inline mr-1.5 mb-0.5" />통계
        </button>
      </div>

      {tab === "revenue" ? <RevenueTab /> : <StatsTab />}
    </div>
  );
}
