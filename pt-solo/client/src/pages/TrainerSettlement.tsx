import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TrendingUp, FileText, Calendar, ChevronLeft, ChevronRight } from "lucide-react";
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

export default function TrainerSettlement() {
  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];
  const [yearMonth, setYearMonth] = useState(
    `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`
  );
  const initialView = (new URLSearchParams(window.location.search).get("view") === "daily" ? "daily" : "monthly") as "monthly" | "daily";
  const [view, setView] = useState<"monthly" | "daily">(initialView);

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
    const rows = data.logs.map((l, i) =>
      [i + 1, l.sessionDate, l.memberName ?? "-", l.packageName ?? "-", l.effectivePrice]
    );
    rows.push(["합계", "", "", "", data.revenue] as any);
    const csv = [header, ...rows].map(r => r.join(",")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const label = view === "daily" ? todayStr : yearMonth;
    a.download = `매출내역_${label}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportPDF = () => {
    if (!data) return;
    const label = view === "daily" ? todayStr : yearMonth;
    const title = `매출 내역 - ${label}`;
    const lines = [
      title,
      `총 세션: ${data.sessionCount}회`,
      `총 매출: ${fmt(data.revenue)}원`,
      "",
      "번호  날짜          회원명          단가",
      "─".repeat(45),
      ...data.logs.map((l, i) =>
        `${String(i + 1).padStart(2)}    ${l.sessionDate}  ${(l.memberName ?? "-").padEnd(10)}  ${fmt(l.effectivePrice).padStart(8)}원`
      ),
      "─".repeat(45),
      `합계                              ${fmt(data.revenue).padStart(8)}원`,
    ];

    const content = lines.join("\n");
    const printWin = window.open("", "_blank");
    if (!printWin) return;
    printWin.document.write(`
      <html><head><title>${title}</title>
      <style>
        body { font-family: monospace; font-size: 13px; padding: 24px; white-space: pre; }
        @media print { body { padding: 0; } }
      </style></head>
      <body>${content.replace(/</g, "&lt;")}</body></html>
    `);
    printWin.document.close();
    printWin.focus();
    setTimeout(() => printWin.print(), 300);
  };

  return (
    <div className="space-y-5">
      <TabBanner tabKey="settlement" />
      <div>
        <h1 className="text-xl font-bold">매출 현황</h1>
        <p className="text-sm text-muted-foreground mt-0.5">PT 세션 기반 매출 내역</p>
      </div>

      {/* 뷰 선택 */}
      <div className="flex gap-2">
        <button
          onClick={() => setView("daily")}
          className={`flex-1 py-2 text-sm rounded-lg border transition-colors ${view === "daily" ? "bg-primary/20 border-primary/40 text-primary" : "border-border text-muted-foreground"}`}
        >
          일일 매출
        </button>
        <button
          onClick={() => setView("monthly")}
          className={`flex-1 py-2 text-sm rounded-lg border transition-colors ${view === "monthly" ? "bg-primary/20 border-primary/40 text-primary" : "border-border text-muted-foreground"}`}
        >
          월 매출
        </button>
      </div>

      {/* 월 선택 (월 매출일 때) */}
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

      {/* 요약 카드 */}
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
            <div className="col-span-1 p-3 rounded-lg bg-primary/10 border border-primary/30">
              <p className="text-xs text-muted-foreground mb-1">총 매출</p>
              <p className="text-lg font-bold text-primary">{fmt(data.revenue)}원</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 내보내기 버튼 */}
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

      {/* 세션 목록 */}
      {data && data.logs.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-semibold">세션 상세 내역</p>
          {data.logs.map((l) => (
            <div key={l.id} className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-accent/20 border border-border">
              <div>
                <p className="text-sm font-medium">{l.memberName ?? "-"}</p>
                <p className="text-xs text-muted-foreground">{l.sessionDate} · {l.packageName ?? "PT"}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-primary">{fmt(l.effectivePrice)}원</p>
              </div>
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
