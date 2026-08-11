import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Lock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { ChevronRight, Users, TrendingUp, UserPlus, BarChart3, ChevronLeft } from "lucide-react";

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
  const { data: trainers, isLoading, refetch } = trpc.admin.listTrainers.useQuery();
  const { data: branchList } = trpc.admin.listBranches.useQuery();
  const { data: expiringSummary } = trpc.admin.getTrainersExpiringSummary.useQuery();
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({
    username: "", password: "", trainerName: "", phone: "", email: "", settlementRate: "50", branchId: "none",
  });

  const createMutation = trpc.admin.createTrainer.useMutation({
    onSuccess: () => {
      toast.success("트레이너 계정이 생성되었습니다.");
      setCreateOpen(false);
      setForm({ username: "", password: "", trainerName: "", phone: "", email: "", settlementRate: "50", branchId: "none" });
      refetch();
    },
    onError: (err) => toast.error(err.message || "생성 실패"),
  });

  const handleCreate = () => {
    if (!form.trainerName.trim()) return toast.error("이름을 입력해주세요.");
    if (!form.username.trim() || form.username.trim().length < 3) return toast.error("아이디는 3자 이상이어야 합니다.");
    if (!form.password || form.password.length < 6) return toast.error("비밀번호는 6자 이상이어야 합니다.");
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return toast.error("올바른 이메일 형식이 아닙니다.");
    createMutation.mutate({
      username: form.username.trim(), password: form.password, trainerName: form.trainerName.trim(),
      phone: form.phone || undefined, email: form.email || undefined,
      settlementRate: parseInt(form.settlementRate) || 50,
      branchId: form.branchId !== "none" ? parseInt(form.branchId) : undefined,
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">총 {trainers?.length ?? 0}명</p>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5">
              <UserPlus className="h-4 w-4" />
              트레이너 추가
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>트레이너 계정 생성</DialogTitle>
              <DialogDescription>새 트레이너 계정 정보를 입력하세요.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">이름 <span className="text-primary">*</span></Label>
                <Input placeholder="김트레이너" value={form.trainerName}
                  onChange={(e) => setForm(p => ({ ...p, trainerName: e.target.value }))} className="h-9" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">아이디 <span className="text-primary">*</span></Label>
                  <Input placeholder="trainer2" value={form.username}
                    onChange={(e) => setForm(p => ({ ...p, username: e.target.value }))} className="h-9" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">비밀번호 <span className="text-primary">*</span></Label>
                  <Input type="password" placeholder="6자 이상" value={form.password}
                    onChange={(e) => setForm(p => ({ ...p, password: e.target.value }))} className="h-9" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">연락처</Label>
                <Input placeholder="010-0000-0000" value={form.phone}
                  onChange={(e) => setForm(p => ({ ...p, phone: e.target.value }))} className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">이메일</Label>
                <Input type="email" placeholder="trainer@example.com" value={form.email}
                  onChange={(e) => setForm(p => ({ ...p, email: e.target.value }))} className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">지점</Label>
                <Select value={form.branchId} onValueChange={(v) => setForm(p => ({ ...p, branchId: v }))}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="지점 선택 (선택)" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">미배정</SelectItem>
                    {branchList?.map(b => <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">정산 비율 (%)</Label>
                <div className="flex items-center gap-2">
                  <Input type="number" min="0" max="100" value={form.settlementRate}
                    onChange={(e) => setForm(p => ({ ...p, settlementRate: e.target.value }))} className="h-9" />
                  <span className="text-sm text-muted-foreground">%</span>
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <Button variant="outline" className="flex-1" onClick={() => setCreateOpen(false)}>취소</Button>
                <Button className="flex-1" onClick={handleCreate} disabled={createMutation.isPending}>
                  {createMutation.isPending ? "생성 중..." : "생성"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-20 rounded-lg bg-card border border-border animate-pulse" />
          ))}
        </div>
      ) : !trainers?.length ? (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-sm">등록된 트레이너가 없습니다.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {trainers.map((trainer) => {
            const exp = expiringSummary?.[trainer.id];
            const hasExpiring = exp && exp.total > 0;
            const undecided = hasExpiring ? exp.total - exp.rereg - exp.churn : 0;
            return (
              <button key={trainer.id} onClick={() => setLocation(`/trainers/${trainer.id}`)}
                className={`w-full text-left p-4 rounded-lg bg-card border transition-colors hover:border-primary/50 ${hasExpiring ? "border-purple-500/40" : "border-border"}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                      {trainer.trainerName.charAt(0)}
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{trainer.trainerName}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Users className="h-3 w-3" />{trainer.memberCount}명
                        </span>
                        <span className="text-xs text-primary">정산 {trainer.settlementRate}%</span>
                      </div>
                      {hasExpiring && (
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          <span className="text-[11px] px-1.5 py-0.5 rounded-md bg-purple-500/15 text-purple-400 border border-purple-500/25 font-medium">
                            이번달 만료 {exp.total}명
                          </span>
                          {exp.rereg > 0 && (
                            <span className="text-[11px] px-1.5 py-0.5 rounded-md bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
                              재등록 {exp.rereg}명
                            </span>
                          )}
                          {exp.churn > 0 && (
                            <span className="text-[11px] px-1.5 py-0.5 rounded-md bg-red-500/15 text-red-400 border border-red-500/25">
                              이탈 {exp.churn}명
                            </span>
                          )}
                          {undecided > 0 && (
                            <span className="text-[11px] px-1.5 py-0.5 rounded-md bg-muted/40 text-muted-foreground border border-border">
                              미정 {undecided}명
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SettlementTab() {
  const today = new Date();
  const [yearMonth, setYearMonth] = useState(
    `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`
  );
  const { data, isLoading, error } = trpc.admin.getSettlementReport.useQuery({ yearMonth });
  const [selectedTrainer, setSelectedTrainer] = useState<(typeof data)["trainers"][number] | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <input type="month" value={yearMonth} onChange={(e) => setYearMonth(e.target.value)}
          className="bg-input border border-border rounded-lg px-3 py-1.5 text-sm text-foreground" />
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground text-center py-8">로딩 중...</p>
      ) : error ? (
        <p className="text-sm text-red-400 text-center py-8">정산 데이터를 불러오지 못했습니다.</p>
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
              <StatCard label="총 정산 비용" value={`${fmt(data.total.settlement)}원`} />
              <StatCard label="3.3% 제외 후 정산" value={`${fmt(data.total.afterTax)}원`}
                sub={`공제액 ${fmt(data.total.settlement - data.total.afterTax)}원`} />
            </CardContent>
          </Card>

          {data.trainers.filter(t => t.sessionCount > 0).length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">{yearMonth} 정산 내역이 없습니다.</p>
          ) : (
            <div className="space-y-3">
              {data.trainers.filter(t => t.sessionCount > 0).sort((a, b) => b.settlement - a.settlement).map(t => (
                <Card key={t.trainerId} className="bg-card border-border cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => setSelectedTrainer(t)}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center justify-between">
                      <span className="flex items-center gap-2"><Users className="h-4 w-4 text-primary" />{t.trainerName}</span>
                      <span className="text-xs text-muted-foreground font-normal">정산비율 {t.settlementRate}%</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-2 gap-3">
                    <StatCard label="PT 횟수" value={`${fmt(t.sessionCount)}회`} />
                    <StatCard label="평균 단가" value={`${fmt(t.avgPrice)}원`} />
                    <StatCard label="정산 비용" value={`${fmt(t.settlement)}원`} sub={`수업합계 × ${t.settlementRate}%`} />
                    <StatCard label="3.3% 제외 후" value={`${fmt(t.afterTax)}원`}
                      sub={`공제 ${fmt(t.settlement - t.afterTax)}원`} />
                    {((t as any).newRevenue > 0 || (t as any).reRegRevenue > 0 || (t as any).healthRevenue > 0) && (
                      <>
                        {(t as any).newRevenue > 0 && (
                          <StatCard label="PT 신규" value={`${fmt((t as any).newRevenue)}원`} />
                        )}
                        {(t as any).reRegRevenue > 0 && (
                          <StatCard label="PT 재등록" value={`${fmt((t as any).reRegRevenue)}원`} />
                        )}
                        {(t as any).healthRevenue > 0 && (
                          <StatCard label="헬스권" value={`${fmt((t as any).healthRevenue)}원`} />
                        )}
                      </>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* 트레이너 상세 모달 */}
          <Dialog open={!!selectedTrainer} onOpenChange={(open) => !open && setSelectedTrainer(null)}>
            <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
              {selectedTrainer && (
                <>
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-primary" />
                      {selectedTrainer.trainerName} — {yearMonth.replace("-", "년 ")}월
                    </DialogTitle>
                    <DialogDescription>회원별 수업 현황 및 매출 내역</DialogDescription>
                  </DialogHeader>

                  <div className="space-y-4 mt-2">
                    {/* 정산 요약 */}
                    <div className="grid grid-cols-2 gap-2">
                      <StatCard label="PT 횟수" value={`${fmt(selectedTrainer.sessionCount)}회`} />
                      <StatCard label="평균 단가" value={`${fmt(selectedTrainer.avgPrice)}원`} />
                      <StatCard label="정산 비용" value={`${fmt(selectedTrainer.settlement)}원`} sub={`× ${selectedTrainer.settlementRate}%`} />
                      <StatCard label="3.3% 제외 후" value={`${fmt(selectedTrainer.afterTax)}원`} />
                    </div>
                    {(selectedTrainer as any).totalExpiredCount > 0 && (
                      <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-accent/20 border border-border">
                        <span className="text-xs text-muted-foreground">재등록률</span>
                        <span className={`text-sm font-bold ${(selectedTrainer as any).reRegRate >= 50 ? "text-emerald-400" : (selectedTrainer as any).reRegRate >= 30 ? "text-yellow-400" : "text-red-400"}`}>
                          {(selectedTrainer as any).reRegRate}%
                        </span>
                        <span className="text-xs text-muted-foreground">
                          ({(selectedTrainer as any).reRegCount}명 / 만료 {(selectedTrainer as any).totalExpiredCount}명)
                        </span>
                      </div>
                    )}

                    {/* 신규/재등록/헬스 등록 매출 */}
                    {((selectedTrainer as any).newRevenue > 0 || (selectedTrainer as any).reRegRevenue > 0 || (selectedTrainer as any).healthRevenue > 0 || (selectedTrainer as any).otherRevenue > 0) && (
                      <div>
                        <h4 className="text-xs font-medium text-muted-foreground mb-2">이달 등록 매출</h4>
                        <div className="space-y-2">
                          {(selectedTrainer as any).newRevenue > 0 && (
                            <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs font-medium text-emerald-400">PT 신규</span>
                                <span className="text-sm font-bold text-emerald-400">{fmt((selectedTrainer as any).newRevenue)}원</span>
                              </div>
                              {((selectedTrainer as any).newMembers ?? []).map((m: any, i: number) => (
                                <div key={i} className="flex items-center justify-between text-xs text-emerald-400/80 pl-2">
                                  <span>{m.name}{m.channel ? ` (${m.channel})` : ""}</span>
                                  <span>{fmt(m.amount)}원</span>
                                </div>
                              ))}
                            </div>
                          )}
                          {(selectedTrainer as any).reRegRevenue > 0 && (
                            <div className="p-2.5 rounded-lg bg-blue-500/10 border border-blue-500/30">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs font-medium text-blue-400">PT 재등록</span>
                                <span className="text-sm font-bold text-blue-400">{fmt((selectedTrainer as any).reRegRevenue)}원</span>
                              </div>
                              {((selectedTrainer as any).reRegMembers ?? []).map((m: any, i: number) => (
                                <div key={i} className="flex items-center justify-between text-xs text-blue-400/80 pl-2">
                                  <span>{m.name}</span>
                                  <span>{fmt(m.amount)}원</span>
                                </div>
                              ))}
                            </div>
                          )}
                          {(selectedTrainer as any).healthRevenue > 0 && (
                            <div className="p-2.5 rounded-lg bg-purple-500/10 border border-purple-500/30">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs font-medium text-purple-400">헬스권</span>
                                <span className="text-sm font-bold text-purple-400">{fmt((selectedTrainer as any).healthRevenue)}원</span>
                              </div>
                              {((selectedTrainer as any).healthMembers ?? []).map((m: any, i: number) => (
                                <div key={i} className="flex items-center justify-between text-xs text-purple-400/80 pl-2">
                                  <span>{m.name}</span>
                                  <span>{fmt(m.amount)}원</span>
                                </div>
                              ))}
                            </div>
                          )}
                          {(selectedTrainer as any).otherRevenue > 0 && (
                            <div className="p-2 rounded-lg bg-accent/20 border border-border flex items-center justify-between">
                              <span className="text-xs text-muted-foreground">기타</span>
                              <span className="text-sm font-bold">{fmt((selectedTrainer as any).otherRevenue)}원</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* 회원별 수업 목록 */}
                    <div>
                      <h4 className="text-xs font-medium text-muted-foreground mb-2">
                        회원별 수업 현황 ({(selectedTrainer as any).memberDetails?.length ?? 0}명)
                      </h4>
                      <div className="space-y-1.5">
                        {((selectedTrainer as any).memberDetails ?? []).map((m: any) => {
                          const activeRemain = m.activeTotal - m.activeUsed;
                          const activePaid = m.activeTotal - (m.activeService ?? 0);
                          return (
                          <div key={m.memberId} className="p-2.5 rounded-lg bg-accent/20 border border-border">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm font-medium">{m.name}</p>
                                <p className="text-xs text-muted-foreground">단가 {fmt(m.avgPrice)}원</p>
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-bold">이번달 {m.sessions}회</p>
                              </div>
                            </div>
                            {(m.activeTotal > 0 || m.cumTotal > 0) && (
                              <div className="mt-1.5 pt-1.5 border-t border-border/50 flex gap-3 text-[11px]">
                                {m.activeTotal > 0 && (
                                  <span className="text-blue-400">
                                    현재 {activePaid}회{(m.activeService ?? 0) > 0 ? `+${m.activeService}서비스` : ""}
                                    <span className="text-muted-foreground"> ({m.activeUsed}/{m.activeTotal} 진행, 잔여 {activeRemain})</span>
                                  </span>
                                )}
                                {m.cumTotal > m.activeTotal && (
                                  <span className="text-muted-foreground">
                                    누적 {m.cumTotal - (m.cumService ?? 0)}회{(m.cumService ?? 0) > 0 ? `+${m.cumService}서비스` : ""}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
}

function ActivityStatsTab() {
  const today = new Date();
  const [yearMonth, setYearMonth] = useState(
    `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`
  );
  const [ym, setYm] = useState(yearMonth);
  const { data, isLoading } = trpc.admin.getTrainerActivityStats.useQuery({ yearMonth: ym });

  function prevMonth() {
    const [y, m] = ym.split("-").map(Number);
    const d = new Date(y, m - 2, 1);
    setYm(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  function nextMonth() {
    const [y, m] = ym.split("-").map(Number);
    const d = new Date(y, m, 1);
    setYm(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  const [y, mo] = ym.split("-").map(Number);

  const th = "px-2 py-2 text-center text-[11px] font-semibold text-muted-foreground whitespace-nowrap bg-muted/40 border-b border-border";
  const td = "px-2 py-2 text-center text-xs text-foreground whitespace-nowrap border-b border-border/40";
  const tdNum = (v: number, color?: string) =>
    `px-2 py-2 text-center text-xs font-medium ${color ?? "text-foreground"} whitespace-nowrap border-b border-border/40`;

  return (
    <div className="space-y-4">
      {/* 월 선택 */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-foreground">트레이너 활동 비교</span>
        <div className="flex items-center gap-1 bg-card border border-border rounded-lg px-2 py-1">
          <button onClick={prevMonth} className="p-0.5 text-muted-foreground hover:text-foreground">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-xs font-medium min-w-[64px] text-center">{y}년 {mo}월</span>
          <button onClick={nextMonth} className="p-0.5 text-muted-foreground hover:text-foreground">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="h-40 flex items-center justify-center text-sm text-muted-foreground">로딩 중...</div>
      ) : !data?.length ? (
        <div className="text-center py-12 text-sm text-muted-foreground">데이터 없음</div>
      ) : (
        <>
          {/* 이번달 + 오늘 */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">{y}년 {mo}월 · 오늘</p>
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full min-w-[480px]">
                <thead>
                  <tr>
                    <th className={`${th} text-left pl-3`}>트레이너</th>
                    <th className={th}>오늘 수업</th>
                    <th className={th}>이번달 수업</th>
                    <th className={th}>이번달 노쇼</th>
                    <th className={th}>오늘 기록지</th>
                    <th className={th}>이번달 기록지</th>
                    <th className={th}>오늘 영상</th>
                    <th className={th}>이번달 영상</th>
                    <th className={th}>회원수</th>
                  </tr>
                </thead>
                <tbody>
                  {[...data].sort((a, b) => b.todaySessions - a.todaySessions).map((t) => (
                    <tr key={t.trainerId} className="hover:bg-muted/10">
                      <td className={`${td} text-left pl-3 font-medium`}>{t.trainerName}</td>
                      <td className={tdNum(t.todaySessions, t.todaySessions > 0 ? "text-emerald-400" : "text-muted-foreground")}>
                        {t.todaySessions}회
                      </td>
                      <td className={tdNum(t.monthSessions, "text-blue-400")}>{t.monthSessions}회</td>
                      <td className={tdNum(t.monthNoShow, t.monthNoShow > 0 ? "text-orange-400" : "text-muted-foreground")}>
                        {t.monthNoShow}회
                      </td>
                      <td className={tdNum(t.todayMemos, t.todayMemos > 0 ? "text-teal-400" : "text-muted-foreground")}>
                        {t.todayMemos}건
                      </td>
                      <td className={tdNum(t.monthMemos, "text-teal-400")}>{t.monthMemos}건</td>
                      <td className={tdNum(t.todayVideos, t.todayVideos > 0 ? "text-violet-400" : "text-muted-foreground")}>
                        {t.todayVideos}건
                      </td>
                      <td className={tdNum(t.monthVideos, "text-violet-400")}>{t.monthVideos}건</td>
                      <td className={tdNum(t.totalMembers)}>{t.totalMembers}명</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 누적 통계 */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">누적 통계</p>
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full min-w-[560px]">
                <thead>
                  <tr>
                    <th className={`${th} text-left pl-3`}>트레이너</th>
                    <th className={th}>누적 수업</th>
                    <th className={th}>월평균 수업</th>
                    <th className={th}>누적 기록지</th>
                    <th className={th}>누적 영상</th>
                    <th className={th}>재등록</th>
                    <th className={th}>재등록률</th>
                    <th className={th}>이탈</th>
                    <th className={th}>잔여 PT</th>
                  </tr>
                </thead>
                <tbody>
                  {[...data].sort((a, b) => b.totalSessions - a.totalSessions).map((t) => (
                    <tr key={t.trainerId} className="hover:bg-muted/10">
                      <td className={`${td} text-left pl-3 font-medium`}>{t.trainerName}</td>
                      <td className={tdNum(t.totalSessions, "text-green-400")}>{t.totalSessions}회</td>
                      <td className={tdNum(t.avgMonthlyPt)}>{t.avgMonthlyPt}회</td>
                      <td className={tdNum(t.totalMemos, "text-teal-400")}>{t.totalMemos}건</td>
                      <td className={tdNum(t.totalVideos, "text-violet-400")}>{t.totalVideos}건</td>
                      <td className={tdNum(t.totalRereg, "text-primary")}>{t.totalRereg}회</td>
                      <td className={tdNum(t.reregRate, t.reregRate >= 50 ? "text-emerald-400" : t.reregRate >= 30 ? "text-yellow-400" : "text-red-400")}>
                        {t.reregRate}%
                      </td>
                      <td className={tdNum(t.totalChurned, t.totalChurned > 0 ? "text-red-400" : "text-muted-foreground")}>
                        {t.totalChurned}명
                      </td>
                      <td className={tdNum(t.remainingPt, "text-purple-400")}>{t.remainingPt}회</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 노쇼 비교 */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">노쇼 누적</p>
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full min-w-[360px]">
                <thead>
                  <tr>
                    <th className={`${th} text-left pl-3`}>트레이너</th>
                    <th className={th}>누적 노쇼</th>
                    <th className={th}>노쇼율</th>
                  </tr>
                </thead>
                <tbody>
                  {[...data].sort((a, b) => b.totalNoShow - a.totalNoShow).map((t) => {
                    const rate = t.totalSessions > 0 ? Math.round((t.totalNoShow / (t.totalSessions + t.totalNoShow)) * 1000) / 10 : 0;
                    return (
                      <tr key={t.trainerId} className="hover:bg-muted/10">
                        <td className={`${td} text-left pl-3 font-medium`}>{t.trainerName}</td>
                        <td className={tdNum(t.totalNoShow, t.totalNoShow > 0 ? "text-orange-400" : "text-muted-foreground")}>
                          {t.totalNoShow}회
                        </td>
                        <td className={tdNum(rate, rate > 10 ? "text-red-400" : rate > 5 ? "text-orange-400" : "text-muted-foreground")}>
                          {rate}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground text-center pb-2">* 오늘 수업 = PT 세션 로그 기준</p>
        </>
      )}
    </div>
  );
}

function PeriodReportTab() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [period, setPeriod] = useState<"H1" | "H2" | "annual">(now.getMonth() < 6 ? "H1" : "H2");
  const { data, isLoading, error } = trpc.admin.getTrainerPeriodReport.useQuery({ year, period });

  const periodLabel = period === "H1" ? "상반기 (1~6월)" : period === "H2" ? "하반기 (7~12월)" : "연간 (1~12월)";
  const th = "px-2 py-2 text-center text-[11px] font-semibold text-muted-foreground whitespace-nowrap bg-muted/40 border-b border-border";
  const td = "px-2 py-2 text-center text-xs text-foreground whitespace-nowrap border-b border-border/40";
  const tdNum = (v: number, color?: string) =>
    `px-2 py-2 text-center text-xs font-medium ${color ?? "text-foreground"} whitespace-nowrap border-b border-border/40`;

  return (
    <div className="space-y-4">
      {/* 기간 선택 */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="text-sm font-semibold text-foreground">트레이너 반기 리포트</span>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-card border border-border rounded-lg px-2 py-1">
            <button onClick={() => setYear(y => y - 1)} className="p-0.5 text-muted-foreground hover:text-foreground">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-xs font-medium min-w-[40px] text-center">{year}년</span>
            <button onClick={() => setYear(y => y + 1)} className="p-0.5 text-muted-foreground hover:text-foreground">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <div className="flex bg-card border border-border rounded-lg p-0.5 gap-0.5">
            {([["H1", "상반기"], ["H2", "하반기"], ["annual", "연간"]] as const).map(([k, l]) => (
              <button key={k} onClick={() => setPeriod(k)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  period === k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                }`}>{l}</button>
            ))}
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="h-40 flex items-center justify-center text-sm text-muted-foreground">로딩 중...</div>
      ) : error ? (
        <p className="text-sm text-red-400 text-center py-8">데이터를 불러오지 못했습니다.</p>
      ) : !data ? null : (
        <>
          {/* 전체 요약 */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" />{year}년 {periodLabel} 전체 요약
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-3 gap-2">
              <StatCard label="총 수업" value={`${fmt(data.total.sessions)}회`} />
              <StatCard label="종료 회원" value={`${fmt(data.total.completed)}명`} />
              <StatCard label="신규 배정" value={`${fmt(data.total.newMembers)}명`} />
              <StatCard label="재등록" value={`${fmt(data.total.reregCount)}건`} sub={`${data.total.reregMembers}명`} />
              <StatCard label="재등록률" value={`${data.total.reregRate}%`} />
              <StatCard label="노쇼" value={`${fmt(data.total.noShows)}회`} />
            </CardContent>
          </Card>

          {/* 트레이너별 종합 */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">트레이너별 성과</p>
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full min-w-[640px]">
                <thead>
                  <tr>
                    <th className={`${th} text-left pl-3`}>트레이너</th>
                    <th className={th}>총 수업</th>
                    <th className={th}>월평균</th>
                    <th className={th}>종료</th>
                    <th className={th}>신규</th>
                    <th className={th}>재등록</th>
                    <th className={th}>재등록률</th>
                    <th className={th}>노쇼</th>
                  </tr>
                </thead>
                <tbody>
                  {[...data.trainers].sort((a, b) => b.sessions - a.sessions).map(t => (
                    <tr key={t.trainerId} className="hover:bg-muted/10">
                      <td className={`${td} text-left pl-3 font-medium`}>{t.trainerName}</td>
                      <td className={tdNum(t.sessions, "text-blue-400")}>{fmt(t.sessions)}회</td>
                      <td className={tdNum(t.avgMonthly)}>{t.avgMonthly}회</td>
                      <td className={tdNum(t.completed, t.completed > 0 ? "text-orange-400" : "text-muted-foreground")}>{t.completed}명</td>
                      <td className={tdNum(t.newMembers, t.newMembers > 0 ? "text-cyan-400" : "text-muted-foreground")}>{t.newMembers}명</td>
                      <td className={tdNum(t.reregCount, "text-primary")}>{t.reregCount}건</td>
                      <td className={tdNum(t.reregRate, t.reregRate >= 50 ? "text-emerald-400" : t.reregRate >= 30 ? "text-yellow-400" : "text-red-400")}>
                        {t.reregRate}%
                      </td>
                      <td className={tdNum(t.noShows, t.noShows > 0 ? "text-orange-400" : "text-muted-foreground")}>{t.noShows}회</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-muted/20">
                    <td className={`${td} text-left pl-3 font-bold`}>합계</td>
                    <td className={`${td} font-bold text-blue-400`}>{fmt(data.total.sessions)}회</td>
                    <td className={td}>-</td>
                    <td className={`${td} font-bold`}>{fmt(data.total.completed)}명</td>
                    <td className={`${td} font-bold`}>{fmt(data.total.newMembers)}명</td>
                    <td className={`${td} font-bold text-primary`}>{fmt(data.total.reregCount)}건</td>
                    <td className={`${td} font-bold`}>{data.total.reregRate}%</td>
                    <td className={`${td} font-bold`}>{fmt(data.total.noShows)}회</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* 월별 수업 추이 */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">월별 수업 현황</p>
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full min-w-[480px]">
                <thead>
                  <tr>
                    <th className={`${th} text-left pl-3`}>트레이너</th>
                    {data.trainers[0]?.monthly.map(m => (
                      <th key={m.month} className={th}>{m.month}월</th>
                    ))}
                    <th className={th}>합계</th>
                  </tr>
                </thead>
                <tbody>
                  {[...data.trainers].sort((a, b) => b.sessions - a.sessions).map(t => (
                    <tr key={t.trainerId} className="hover:bg-muted/10">
                      <td className={`${td} text-left pl-3 font-medium`}>{t.trainerName}</td>
                      {t.monthly.map(m => (
                        <td key={m.month} className={tdNum(m.sessions, m.sessions > 0 ? "text-blue-400" : "text-muted-foreground")}>
                          {m.sessions}
                        </td>
                      ))}
                      <td className={`${td} font-bold text-blue-400`}>{fmt(t.sessions)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 월별 재등록 추이 */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">월별 재등록 현황</p>
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full min-w-[480px]">
                <thead>
                  <tr>
                    <th className={`${th} text-left pl-3`}>트레이너</th>
                    {data.trainers[0]?.monthly.map(m => (
                      <th key={m.month} className={th}>{m.month}월</th>
                    ))}
                    <th className={th}>합계</th>
                  </tr>
                </thead>
                <tbody>
                  {[...data.trainers].sort((a, b) => b.reregCount - a.reregCount).map(t => (
                    <tr key={t.trainerId} className="hover:bg-muted/10">
                      <td className={`${td} text-left pl-3 font-medium`}>{t.trainerName}</td>
                      {t.monthly.map(m => (
                        <td key={m.month} className={tdNum(m.rereg, m.rereg > 0 ? "text-primary" : "text-muted-foreground")}>
                          {m.rereg}
                        </td>
                      ))}
                      <td className={`${td} font-bold text-primary`}>{fmt(t.reregCount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground text-center pb-2">* 재등록률 = 재등록 회원 / 종료 회원 · 종료 = 패키지 완료+만료 기준</p>
        </>
      )}
    </div>
  );
}

const TABS = [
  { key: "trainers", label: "트레이너 관리" },
  { key: "stats", label: "활동 통계" },
  { key: "period", label: "반기 리포트" },
  { key: "settlement", label: "수업 정산" },
] as const;
type Tab = typeof TABS[number]["key"];

function ForbiddenPage({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
      <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center">
        <Lock className="h-6 w-6 text-red-400" />
      </div>
      <p className="font-semibold text-foreground">접근 권한이 없습니다</p>
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

export default function Trainers() {
  const { data: user } = trpc.auth.me.useQuery();
  const [tab, setTab] = useState<Tab>("trainers");

  if (user && user.role !== "admin" && user.role !== "sub_admin") {
    return <ForbiddenPage message="트레이너 관리는 관리자만 접근할 수 있습니다." />;
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">트레이너</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {tab === "trainers" ? "트레이너 계정 및 회원 관리" : tab === "stats" ? "트레이너별 활동 통계 비교" : tab === "period" ? "상반기·하반기·연간 성과 리포트" : "트레이너별 PT 정산 현황"}
        </p>
      </div>

      <div className="overflow-x-auto scrollbar-none -mx-4 px-4">
        <div className="flex bg-card border border-border rounded-xl p-1 gap-1 w-max min-w-full">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex-1 min-w-[96px] py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                tab === t.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === "trainers" ? <TrainerList /> : tab === "stats" ? <ActivityStatsTab /> : tab === "period" ? <PeriodReportTab /> : <SettlementTab />}
    </div>
  );
}
