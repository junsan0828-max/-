import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronRight, Users, TrendingUp } from "lucide-react";

function fmt(n: number) { return n.toLocaleString(); }

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="p-3 rounded-lg bg-accent/20 border border-border">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className="text-lg font-bold">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

function TrainerList() {
  const [, setLocation] = useLocation();
  const { data: trainers, isLoading } = trpc.admin.listTrainers.useQuery();

  if (isLoading) return (
    <div className="space-y-2">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="h-20 rounded-lg bg-card border border-border animate-pulse" />
      ))}
    </div>
  );

  if (!trainers?.length) return (
    <div className="text-center py-12 text-muted-foreground">
      <p className="text-sm">등록된 트레이너가 없습니다.</p>
    </div>
  );

  return (
    <div className="space-y-2">
      {trainers.map((trainer) => (
        <button
          key={trainer.id}
          onClick={() => setLocation(`/trainers/${trainer.id}`)}
          className="w-full text-left p-4 rounded-lg bg-card border border-border hover:border-primary/50 transition-colors"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm">
                {trainer.trainerName.charAt(0)}
              </div>
              <div>
                <p className="font-medium text-foreground">{trainer.trainerName}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Users className="h-3 w-3" />
                    {trainer.memberCount}명
                  </span>
                  <span className="text-xs text-primary">정산 {trainer.settlementRate}%</span>
                </div>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </div>
        </button>
      ))}
    </div>
  );
}

function SettlementTab() {
  const today = new Date();
  const [yearMonth, setYearMonth] = useState(
    `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`
  );
  const { data, isLoading } = trpc.admin.getSettlementReport.useQuery({ yearMonth });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <input
          type="month"
          value={yearMonth}
          onChange={(e) => setYearMonth(e.target.value)}
          className="bg-input border border-border rounded-lg px-3 py-1.5 text-sm text-foreground"
        />
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground text-center py-8">로딩 중...</p>
      ) : !data ? null : (
        <>
          <Card className="bg-card border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />전체 합계
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3">
              <StatCard label="총 PT 횟수" value={`${fmt(data.total.sessionCount)}회`} />
              <StatCard label="전체 평균 단가" value={`${fmt(data.total.avgPrice)}원`} />
              <StatCard label="총 매출" value={`${fmt(data.total.revenue)}원`} />
              <StatCard label="총 정산 비용" value={`${fmt(data.total.settlement)}원`} />
              <StatCard
                label="3.3% 제외 후 정산"
                value={`${fmt(data.total.afterTax)}원`}
                sub={`공제액 ${fmt(data.total.settlement - data.total.afterTax)}원`}
              />
            </CardContent>
          </Card>

          {data.trainers.filter(t => t.sessionCount > 0).length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">{yearMonth} 정산 내역이 없습니다.</p>
          ) : (
            <div className="space-y-3">
              {data.trainers
                .filter(t => t.sessionCount > 0)
                .sort((a, b) => b.settlement - a.settlement)
                .map(t => (
                  <Card key={t.trainerId} className="bg-card border-border">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center justify-between">
                        <span className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-primary" />{t.trainerName}
                        </span>
                        <span className="text-xs text-muted-foreground font-normal">정산비율 {t.settlementRate}%</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-2 gap-3">
                      <StatCard label="PT 횟수" value={`${fmt(t.sessionCount)}회`} />
                      <StatCard label="평균 단가" value={`${fmt(t.avgPrice)}원`} />
                      <StatCard label="매출" value={`${fmt(t.revenue)}원`} />
                      <StatCard label="정산 비용" value={`${fmt(t.settlement)}원`}
                        sub={`매출 × ${t.settlementRate}%`} />
                      <StatCard
                        label="3.3% 제외 후"
                        value={`${fmt(t.afterTax)}원`}
                        sub={`공제 ${fmt(t.settlement - t.afterTax)}원`}
                      />
                    </CardContent>
                  </Card>
                ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

const TABS = [
  { key: "trainers", label: "트레이너 관리" },
  { key: "settlement", label: "수업 정산" },
] as const;

type Tab = typeof TABS[number]["key"];

export default function Trainers() {
  const { data: trainers } = trpc.admin.listTrainers.useQuery();
  const [tab, setTab] = useState<Tab>("trainers");

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">트레이너</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {tab === "trainers" ? `총 ${trainers?.length ?? 0}명` : "트레이너별 PT 정산 현황"}
        </p>
      </div>

      {/* 탭 */}
      <div className="flex bg-card border border-border rounded-xl p-1 gap-1">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === t.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "trainers" ? <TrainerList /> : <SettlementTab />}
    </div>
  );
}
