import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, Dumbbell, Users, Calculator } from "lucide-react";

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

export default function SettlementReport() {
  const today = new Date();
  const [yearMonth, setYearMonth] = useState(
    `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`
  );

  const { data, isLoading } = trpc.admin.getSettlementReport.useQuery({ yearMonth });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">정산 리포트</h1>
          <p className="text-sm text-muted-foreground mt-0.5">트레이너별 PT 정산 현황</p>
        </div>
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
          {/* 전체 합계 */}
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

          {/* 트레이너별 */}
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
