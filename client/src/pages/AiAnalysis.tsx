import { useState } from "react";
import { trpc } from "../lib/trpc";
import { toast } from "sonner";
import { Sparkles, RefreshCw, ChevronLeft, ChevronRight, BrainCircuit, AlertTriangle } from "lucide-react";

export default function AiAnalysisPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [result, setResult] = useState<{ analysis: string; isAI: boolean } | null>(null);

  const { data: kpi } = trpc.gym.kpi.overview.useQuery({ year, month });

  const analyzeMutation = trpc.gym.ai.analyze.useMutation({
    onSuccess: (data) => setResult(data),
    onError: (e) => toast.error("분석 중 오류가 발생했습니다: " + e.message),
  });

  function prevMonth() {
    if (month === 1) { setYear(y => y - 1); setMonth(12); }
    else setMonth(m => m - 1);
  }
  function nextMonth() {
    if (month === 12) { setYear(y => y + 1); setMonth(1); }
    else setMonth(m => m + 1);
  }

  function formatAnalysis(text: string) {
    const lines = text.split("\n");
    return lines.map((line, i) => {
      if (line.startsWith("**") && line.endsWith("**")) {
        return <h3 key={i} className="font-bold text-foreground mt-4 mb-1 text-sm">{line.replace(/\*\*/g, "")}</h3>;
      }
      if (line.match(/^\*\*.*\*\*/)) {
        return (
          <p key={i} className="text-sm text-foreground mt-3 mb-1">
            {line.split(/(\*\*.*?\*\*)/).map((part, j) =>
              part.startsWith("**") && part.endsWith("**")
                ? <strong key={j}>{part.replace(/\*\*/g, "")}</strong>
                : part
            )}
          </p>
        );
      }
      if (line.startsWith("1. ") || line.startsWith("2. ") || line.startsWith("3. ")) {
        return (
          <div key={i} className="flex gap-2 text-sm text-foreground mt-1">
            <span className="text-primary font-bold shrink-0">{line.substring(0, 2)}</span>
            <span>{line.substring(3)}</span>
          </div>
        );
      }
      if (line.trim() === "") return <div key={i} className="h-1" />;
      return <p key={i} className="text-sm text-muted-foreground leading-relaxed">{line}</p>;
    });
  }

  const fmt = (n: number) => {
    if (n >= 10000000) return `${(n / 10000000).toFixed(1)}천만원`;
    if (n >= 10000) return `${Math.round(n / 10000)}만원`;
    return `${n.toLocaleString()}원`;
  };

  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <div>
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
          <BrainCircuit className="h-5 w-5 text-primary" />
          AI 운영 분석
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">매출 데이터 기반 AI 인사이트</p>
      </div>

      {/* 월 선택 */}
      <div className="flex items-center justify-center gap-3 bg-card border border-border rounded-xl px-4 py-3">
        <button onClick={prevMonth} className="text-muted-foreground hover:text-foreground">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <span className="text-base font-semibold text-foreground min-w-[100px] text-center">{year}년 {month}월</span>
        <button onClick={nextMonth} className="text-muted-foreground hover:text-foreground">
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {/* 데이터 미리보기 */}
      {kpi && (
        <div className="bg-card border border-border rounded-xl p-4 space-y-2">
          <h2 className="text-sm font-semibold text-foreground">분석 대상 데이터</h2>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">이번달 매출</span>
              <span className="font-medium text-foreground">{fmt(kpi.monthTotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">전월 대비</span>
              <span className={`font-medium ${kpi.momGrowth >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {kpi.momGrowth >= 0 ? "+" : ""}{kpi.momGrowth}%
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">신규 매출</span>
              <span className="font-medium text-foreground">{fmt(kpi.monthNewSales)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">재등록 매출</span>
              <span className="font-medium text-foreground">{fmt(kpi.monthRenewal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">미수금</span>
              <span className={`font-medium ${kpi.totalUnpaid > 0 ? "text-red-400" : "text-muted-foreground"}`}>{fmt(kpi.totalUnpaid)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">전환율</span>
              <span className="font-medium text-foreground">{kpi.conversionRate}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">재등록률</span>
              <span className="font-medium text-foreground">{kpi.renewalRate}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">목표 달성률</span>
              <span className={`font-medium ${kpi.achieveRate >= 100 ? "text-emerald-400" : "text-amber-400"}`}>{kpi.achieveRate}%</span>
            </div>
          </div>
        </div>
      )}

      {/* 분석 버튼 */}
      <button
        onClick={() => analyzeMutation.mutate({ year, month })}
        disabled={analyzeMutation.isPending}
        className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground py-3 rounded-xl text-sm font-semibold hover:bg-primary/90 disabled:opacity-60 transition-all"
      >
        {analyzeMutation.isPending ? (
          <>
            <RefreshCw className="h-4 w-4 animate-spin" />
            AI 분석 중...
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4" />
            {year}년 {month}월 AI 분석 실행
          </>
        )}
      </button>

      {/* 분석 결과 */}
      {result && (
        <div className="bg-card border border-border rounded-xl p-4 space-y-1">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              AI 분석 리포트
            </h2>
            {!result.isAI && (
              <div className="flex items-center gap-1 text-xs text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-full">
                <AlertTriangle className="h-3 w-3" />
                기본 분석
              </div>
            )}
            {result.isAI && (
              <div className="text-xs text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                Claude AI
              </div>
            )}
          </div>
          <div className="prose-sm text-foreground space-y-1">
            {formatAnalysis(result.analysis)}
          </div>
        </div>
      )}

      {/* AI 설명 */}
      {!result && (
        <div className="bg-card border border-border rounded-xl p-4 text-center space-y-3">
          <Sparkles className="h-12 w-12 mx-auto text-primary/30" />
          <div>
            <p className="text-sm font-medium text-foreground">AI가 운영 현황을 분석합니다</p>
            <p className="text-xs text-muted-foreground mt-1">
              매출, 채널, 트레이너, 리드 데이터를 종합하여<br />
              실용적인 인사이트와 액션 아이템을 제안합니다
            </p>
          </div>
          <div className="text-left space-y-2 pt-2">
            {[
              "매출 감소 원인 자동 탐지",
              "채널 효율성 비교 분석",
              "재등록 매출 하락 경고",
              "미수금 리스크 알림",
              "다음 달 액션 플랜 제안",
            ].map(item => (
              <div key={item} className="flex items-center gap-2 text-xs text-muted-foreground">
                <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                {item}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
