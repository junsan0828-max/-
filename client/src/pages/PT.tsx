import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";

export default function PT() {
  const [, setLocation] = useLocation();
  const { data: packages, isLoading } = trpc.pt.list.useQuery();

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button
          onClick={() => setLocation("/")}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-xl font-bold">PT 관리</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            총 {packages?.length ?? 0}개 패키지
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 rounded-lg bg-card border border-border animate-pulse" />
          ))}
        </div>
      ) : !packages?.length ? (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-sm">등록된 PT 패키지가 없습니다.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {packages.map((pkg) => (
            <Card key={pkg.id} className="bg-card border-border">
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-sm">{pkg.packageName || "PT 패키지"}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {pkg.startDate} ~ {pkg.expiryDate || "기간 미설정"}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-lg font-bold text-primary">
                      {pkg.totalSessions - pkg.usedSessions}회
                    </p>
                    <p className="text-xs text-muted-foreground">잔여 / {pkg.totalSessions}회</p>
                  </div>
                </div>

                <div className="mt-3">
                  <div className="w-full bg-border rounded-full h-1.5">
                    <div
                      className="bg-primary h-1.5 rounded-full"
                      style={{
                        width: `${Math.min(
                          (pkg.usedSessions / pkg.totalSessions) * 100,
                          100
                        )}%`,
                      }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{pkg.usedSessions}회 사용</p>
                </div>

                {(pkg.paymentAmount || pkg.paymentMethod) && (
                  <div className="mt-3 pt-3 border-t border-border/50 flex gap-4 text-xs">
                    {pkg.paymentAmount && (
                      <div>
                        <span className="text-muted-foreground">결제 </span>
                        <span className="font-medium">{pkg.paymentAmount.toLocaleString()}원</span>
                      </div>
                    )}
                    {pkg.unpaidAmount ? (
                      <div>
                        <span className="text-muted-foreground">미수금 </span>
                        <span className="font-medium text-orange-400">
                          {pkg.unpaidAmount.toLocaleString()}원
                        </span>
                      </div>
                    ) : null}
                    {pkg.paymentMethod && (
                      <div>
                        <span className="text-muted-foreground">결제방법 </span>
                        <span className="font-medium">{pkg.paymentMethod}</span>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
