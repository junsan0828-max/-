import { useState } from "react";
import { trpc } from "../lib/trpc";
import { toast } from "sonner";
import { Sparkles, RefreshCw, ChevronLeft, ChevronRight, BrainCircuit, AlertTriangle, Users } from "lucide-react";

// ── 마크다운 렌더러 (공통)
function FormatAnalysis({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <div className="space-y-1">
      {lines.map((line, i) => {
        if (line.startsWith("## ")) return <h2 key={i} className="font-bold text-foreground text-sm mt-4 mb-1">{line.slice(3)}</h2>;
        if (line.startsWith("### ")) return <h3 key={i} className="font-semibold text-foreground text-sm mt-3 mb-0.5">{line.slice(4)}</h3>;
        if (line.match(/^\*\*.*\*\*$/)) return <h3 key={i} className="font-bold text-foreground mt-4 mb-1 text-sm">{line.replace(/\*\*/g, "")}</h3>;
        if (line.match(/^\*\*.*\*\*/)) {
          return (
            <p key={i} className="text-sm text-foreground mt-2 mb-0.5">
              {line.split(/(\*\*.*?\*\*)/).map((part, j) =>
                part.startsWith("**") && part.endsWith("**")
                  ? <strong key={j}>{part.replace(/\*\*/g, "")}</strong>
                  : part
              )}
            </p>
          );
        }
        if (line.match(/^- /)) return <div key={i} className="flex gap-1.5 text-sm text-muted-foreground"><span className="text-primary mt-0.5 shrink-0">•</span><span>{line.slice(2)}</span></div>;
        if (line.match(/^\d\. /)) return <div key={i} className="flex gap-2 text-sm text-foreground mt-1"><span className="text-primary font-bold shrink-0">{line.substring(0, 2)}</span><span>{line.substring(3)}</span></div>;
        if (line.trim() === "") return <div key={i} className="h-1" />;
        return <p key={i} className="text-sm text-muted-foreground leading-relaxed">{line}</p>;
      })}
    </div>
  );
}

// ── 운영 분석 탭
function OperationTab() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [result, setResult] = useState<{ analysis: string; isAI: boolean } | null>(null);

  const { data: kpi } = trpc.gym.kpi.overview.useQuery({ year, month });
  const analyzeMutation = trpc.gym.ai.analyze.useMutation({
    onSuccess: (data) => setResult(data),
    onError: (e) => toast.error("분석 중 오류: " + e.message),
  });

  const fmt = (n: number) => {
    if (n >= 10000000) return `${(n / 10000000).toFixed(1)}천만원`;
    if (n >= 10000) return `${Math.round(n / 10000)}만원`;
    return `${n.toLocaleString()}원`;
  };

  return (
    <div className="space-y-4">
      {/* 월 선택 */}
      <div className="flex items-center justify-center gap-3 bg-card border border-border rounded-xl px-4 py-3">
        <button onClick={() => { if (month === 1) { setYear(y => y - 1); setMonth(12); } else setMonth(m => m - 1); }} className="text-muted-foreground hover:text-foreground">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <span className="text-base font-semibold text-foreground min-w-[100px] text-center">{year}년 {month}월</span>
        <button onClick={() => { if (month === 12) { setYear(y => y + 1); setMonth(1); } else setMonth(m => m + 1); }} className="text-muted-foreground hover:text-foreground">
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {/* 데이터 미리보기 */}
      {kpi && (
        <div className="bg-card border border-border rounded-xl p-4 space-y-2">
          <h2 className="text-sm font-semibold text-foreground">분석 대상 데이터</h2>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {[
              ["이번달 매출", fmt(kpi.monthTotal)],
              ["전월 대비", `${kpi.momGrowth >= 0 ? "+" : ""}${kpi.momGrowth}%`],
              ["신규 매출", fmt(kpi.monthNewSales)],
              ["재등록 매출", fmt(kpi.monthRenewal)],
              ["미수금", fmt(kpi.totalUnpaid)],
              ["전환율", `${kpi.conversionRate}%`],
              ["재등록률", `${kpi.renewalRate}%`],
              ["목표 달성률", `${kpi.achieveRate}%`],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between">
                <span className="text-muted-foreground">{label}</span>
                <span className="font-medium text-foreground">{value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <button
        onClick={() => analyzeMutation.mutate({ year, month })}
        disabled={analyzeMutation.isPending}
        className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground py-3 rounded-xl text-sm font-semibold hover:bg-primary/90 disabled:opacity-60 transition-all"
      >
        {analyzeMutation.isPending ? <><RefreshCw className="h-4 w-4 animate-spin" />AI 분석 중...</> : <><Sparkles className="h-4 w-4" />{year}년 {month}월 AI 분석 실행</>}
      </button>

      {result ? (
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" />AI 분석 리포트</h2>
            {result.isAI
              ? <span className="text-xs text-primary bg-primary/10 px-2 py-0.5 rounded-full">Claude AI</span>
              : <span className="flex items-center gap-1 text-xs text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-full"><AlertTriangle className="h-3 w-3" />기본 분석</span>}
          </div>
          <FormatAnalysis text={result.analysis} />
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl p-4 text-center space-y-3">
          <Sparkles className="h-12 w-12 mx-auto text-primary/30" />
          <div>
            <p className="text-sm font-medium text-foreground">AI가 운영 현황을 분석합니다</p>
            <p className="text-xs text-muted-foreground mt-1">매출, 채널, 트레이너, 리드 데이터를 종합하여<br />실용적인 인사이트와 액션 아이템을 제안합니다</p>
          </div>
          <div className="text-left space-y-2 pt-2">
            {["매출 감소 원인 자동 탐지", "채널 효율성 비교 분석", "재등록 매출 하락 경고", "미수금 리스크 알림", "다음 달 액션 플랜 제안"].map(item => (
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

// ── 트레이너 매칭 탭
function MatchTab() {
  const [selectedMemberId, setSelectedMemberId] = useState<number | null>(null);
  const [result, setResult] = useState<{ analysis: string; isAI: boolean; trainerStats: { trainerName: string; activeMembers: number; monthSessions: number; reregRate: number; topPrograms: string[]; activeDays: string }[] } | null>(null);

  const { data: allMembers } = trpc.members.list.useQuery();
  const matchMutation = trpc.gym.ai.trainerMatch.useMutation({
    onSuccess: (data) => setResult(data),
    onError: (e) => toast.error("매칭 분석 오류: " + e.message),
  });

  const selectedMember = allMembers?.find(m => m.id === selectedMemberId);

  return (
    <div className="space-y-4">
      {/* 설명 */}
      <div className="bg-card border border-border rounded-xl p-4 space-y-2">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">AI 트레이너 매칭</h2>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          회원 성향·운동목적·가능시간과 트레이너 전문성·재등록률·워크로드를 종합 분석하여 최적의 트레이너를 추천합니다.
        </p>
        <div className="grid grid-cols-2 gap-1 pt-1">
          {["운동 목적 적합성", "가능 시간 매칭", "트레이너 재등록률", "현재 워크로드", "전문 프로그램", "나이/성별 고려"].map(item => (
            <div key={item} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <div className="w-1.5 h-1.5 rounded-full bg-primary/70 shrink-0" />
              {item}
            </div>
          ))}
        </div>
      </div>

      {/* 회원 선택 */}
      <div className="bg-card border border-border rounded-xl p-4 space-y-3">
        <label className="text-sm font-medium text-foreground">분석할 회원 선택</label>
        <select
          value={selectedMemberId ?? ""}
          onChange={e => { setSelectedMemberId(e.target.value ? Number(e.target.value) : null); setResult(null); }}
          className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="">회원을 선택하세요</option>
          {allMembers?.map(m => (
            <option key={m.id} value={m.id}>{m.name}{m.phone ? ` · ${m.phone}` : ""}</option>
          ))}
        </select>

        {selectedMember && (
          <div className="text-xs text-muted-foreground space-y-0.5 bg-muted/20 rounded-lg p-2.5">
            <p><span className="text-foreground font-medium">{selectedMember.name}</span> 회원 프로필 기반 분석</p>
            <p>상담 내용·운동목적·가능 시간이 입력되어 있을수록 정확도가 높아집니다.</p>
          </div>
        )}

        <button
          onClick={() => selectedMemberId && matchMutation.mutate({ memberId: selectedMemberId })}
          disabled={!selectedMemberId || matchMutation.isPending}
          className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground py-3 rounded-xl text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-all"
        >
          {matchMutation.isPending
            ? <><RefreshCw className="h-4 w-4 animate-spin" />AI 매칭 분석 중...</>
            : <><Sparkles className="h-4 w-4" />AI 트레이너 매칭 분석</>}
        </button>
      </div>

      {/* 트레이너 현황 요약 */}
      {result && (
        <>
          <div className="bg-card border border-border rounded-xl p-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">트레이너 현황 (분석 기준)</p>
            <div className="space-y-2">
              {result.trainerStats.map(t => (
                <div key={t.trainerName} className="flex items-center justify-between text-xs">
                  <span className="font-medium text-foreground w-16 shrink-0">{t.trainerName}</span>
                  <div className="flex gap-3 text-muted-foreground flex-1 flex-wrap">
                    <span>담당 <span className="text-foreground">{t.activeMembers}명</span></span>
                    <span>이번달 <span className="text-foreground">{t.monthSessions}회</span></span>
                    <span>재등록 <span className={t.reregRate >= 50 ? "text-emerald-400" : t.reregRate >= 30 ? "text-yellow-400" : "text-muted-foreground"}>{t.reregRate}%</span></span>
                    {t.topPrograms.length > 0 && <span className="text-primary/80">{t.topPrograms[0]}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-foreground flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" />매칭 추천 결과</h2>
              {result.isAI
                ? <span className="text-xs text-primary bg-primary/10 px-2 py-0.5 rounded-full">Claude AI</span>
                : <span className="flex items-center gap-1 text-xs text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-full"><AlertTriangle className="h-3 w-3" />기본 분석</span>}
            </div>
            <FormatAnalysis text={result.analysis} />
          </div>
        </>
      )}

      {!result && (
        <div className="bg-card border border-border rounded-xl p-6 text-center text-muted-foreground text-sm space-y-2">
          <Users className="h-10 w-10 mx-auto text-primary/20" />
          <p>회원을 선택하고 분석을 실행하면<br />최적의 트레이너 매칭 추천 결과가 표시됩니다</p>
          <p className="text-xs">데이터가 많을수록 분석 정확도가 높아집니다</p>
        </div>
      )}
    </div>
  );
}

// ── 메인 페이지
export default function AiAnalysisPage() {
  const [tab, setTab] = useState<"operation" | "match">("operation");

  return (
    <div className="space-y-4 pb-20">
      {/* 헤더 */}
      <div>
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
          <BrainCircuit className="h-5 w-5 text-primary" />
          AI 운영 분석
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">데이터 기반 AI 인사이트</p>
      </div>

      {/* 탭 */}
      <div className="flex gap-1 bg-card border border-border rounded-xl p-1">
        <button
          onClick={() => setTab("operation")}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${tab === "operation" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
        >
          운영 분석
        </button>
        <button
          onClick={() => setTab("match")}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${tab === "match" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
        >
          트레이너 매칭
        </button>
      </div>

      {tab === "operation" ? <OperationTab /> : <MatchTab />}
    </div>
  );
}
