import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TrendingUp, FileSpreadsheet, FileText, Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import * as XLSX from "xlsx";

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
  const { data: me } = trpc.auth.me.useQuery();
  const trainerId = me?.trainerId ?? 0;

  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];
  const [yearMonth, setYearMonth] = useState(
    `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`
  );
  const initialView = (new URLSearchParams(window.location.search).get("view") === "daily" ? "daily" : "monthly") as "monthly" | "daily";
  const [view, setView] = useState<"monthly" | "daily">(initialView);

  const { data: monthly } = trpc.trainers.getMonthlySettlement.useQuery(
    { trainerId, yearMonth },
    { enabled: !!trainerId && view === "monthly" }
  );
  const { data: daily } = trpc.trainers.getMonthlySettlement.useQuery(
    { trainerId, yearMonth, dateFilter: todayStr },
    { enabled: !!trainerId && view === "daily" }
  );

  const data = view === "monthly" ? monthly : daily;

  const exportExcel = () => {
    if (!data) return;
    const rows = data.logs.map((l, i) => ({
      "번호": i + 1,
      "날짜": l.sessionDate,
      "회원명": l.memberName ?? "-",
      "패키지": l.packageName ?? "-",
      "단가(원)": l.effectivePrice,
      "정산금액(원)": Math.round(l.effectivePrice * data.settlementRate / 100),
    }));
    rows.push({
      "번호": 0,
      "날짜": "합계",
      "회원명": "",
      "패키지": "",
      "단가(원)": data.revenue,
      "정산금액(원)": data.settlementAmount,
    } as any);

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "정산내역");
    const label = view === "daily" ? todayStr : yearMonth;
    XLSX.writeFile(wb, `정산내역_${label}.xlsx`);
  };

  const exportCSV = () => {
    if (!data) return;
    const header = ["번호", "날짜", "회원명", "패키지", "단가(원)", "정산금액(원)"];
    const rows = data.logs.map((l, i) =>
      [i + 1, l.sessionDate, l.memberName ?? "-", l.packageName ?? "-", l.effectivePrice, Math.round(l.effectivePrice * data.settlementRate / 100)]
    );
    rows.push(["합계", "", "", "", data.revenue, data.settlementAmount] as any);
    const csv = [header, ...rows].map(r => r.join(",")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const label = view === "daily" ? todayStr : yearMonth;
    a.download = `정산내역_${label}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportPDF = () => {
    if (!data) return;
    const label = view === "daily" ? todayStr : yearMonth;
    const title = `정산 내역 - ${label}`;
    const lines = [
      title,
      `정산비율: ${data.settlementRate}%`,
      `총 세션: ${data.sessionCount}회`,
      `총 매출: ${fmt(data.revenue)}원`,
      `정산금액: ${fmt(data.settlementAmount)}원`,
      `3.3% 공제 후: ${fmt(data.afterTax)}원`,
      "",
      "번호  날짜          회원명          단가       정산금액",
      "─".repeat(55),
      ...data.logs.map((l, i) =>
        `${String(i + 1).padStart(2)}    ${l.sessionDate}  ${(l.memberName ?? "-").padEnd(10)}  ${fmt(l.effectivePrice).padStart(8)}원  ${fmt(Math.round(l.effectivePrice * data.settlementRate / 100)).padStart(8)}원`
      ),
      "─".repeat(55),
      `합계                              ${fmt(data.revenue).padStart(8)}원  ${fmt(data.settlementAmount).padStart(8)}원`,
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
      <div>
        <h1 className="text-xl font-bold">정산 현황</h1>
        <p className="text-sm text-muted-foreground mt-0.5">PT 세션 기반 정산 내역</p>
      </div>

      {/* 뷰 선택 */}
      <div className="flex gap-2">
        <button
          onClick={() => setView("daily")}
          className={`flex-1 py-2 text-sm rounded-lg border transition-colors ${view === "daily" ? "bg-primary/20 border-primary/40 text-primary" : "border-border text-muted-foreground"}`}
        >
          일일 정산
        </button>
        <button
          onClick={() => setView("monthly")}
          className={`flex-1 py-2 text-sm rounded-lg border transition-colors ${view === "monthly" ? "bg-primary/20 border-primary/40 text-primary" : "border-border text-muted-foreground"}`}
        >
          월 정산
        </button>
      </div>

      {/* 월 선택 (월 정산일 때) */}
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
              {view === "daily" ? "오늘 정산" : `${yearMonth.replace("-", "년 ")}월 정산`}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-lg bg-accent/20 border border-border">
              <p className="text-xs text-muted-foreground mb-1">총 세션</p>
              <p className="text-lg font-bold">{data.sessionCount}회</p>
            </div>
            <div className="p-3 rounded-lg bg-accent/20 border border-border">
              <p className="text-xs text-muted-foreground mb-1">정산비율</p>
              <p className="text-lg font-bold">{data.settlementRate}%</p>
            </div>
            <div className="p-3 rounded-lg bg-accent/20 border border-border">
              <p className="text-xs text-muted-foreground mb-1">총 매출</p>
              <p className="text-lg font-bold">{fmt(data.revenue)}원</p>
            </div>
            <div className="p-3 rounded-lg bg-accent/20 border border-border">
              <p className="text-xs text-muted-foreground mb-1">정산금액</p>
              <p className="text-lg font-bold text-primary">{fmt(data.settlementAmount)}원</p>
            </div>
            <div className="col-span-2 p-3 rounded-lg bg-green-500/10 border border-green-500/30">
              <p className="text-xs text-muted-foreground mb-1">3.3% 공제 후 실수령</p>
              <p className="text-xl font-bold text-green-400">{fmt(data.afterTax)}원</p>
              <p className="text-xs text-muted-foreground mt-0.5">공제액 {fmt(data.settlementAmount - data.afterTax)}원</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 내보내기 버튼 */}
      {data && data.sessionCount > 0 && (
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="flex-1 gap-1.5" onClick={exportExcel}>
            <FileSpreadsheet className="h-4 w-4" />엑셀
          </Button>
          <Button variant="outline" size="sm" className="flex-1 gap-1.5" onClick={exportCSV}>
            <FileSpreadsheet className="h-4 w-4" />CSV
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
          {data.logs.map((l, i) => (
            <div key={l.id} className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-accent/20 border border-border">
              <div>
                <p className="text-sm font-medium">{l.memberName ?? "-"}</p>
                <p className="text-xs text-muted-foreground">{l.sessionDate} · {l.packageName ?? "PT"}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-primary">{fmt(Math.round(l.effectivePrice * data.settlementRate / 100))}원</p>
                <p className="text-xs text-muted-foreground">단가 {fmt(l.effectivePrice)}원</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {data && data.logs.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">
          {view === "daily" ? "오늘 정산 내역이 없습니다." : `${yearMonth.replace("-", "년 ")}월 정산 내역이 없습니다.`}
        </p>
      )}
    </div>
  );
}
