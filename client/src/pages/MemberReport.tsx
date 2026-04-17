import { trpc } from "@/lib/trpc";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import {
  CheckCircle,
  XCircle,
  Clock,
  Activity,
  Dumbbell,
  BookOpen,
  AlertTriangle,
  User,
} from "lucide-react";

interface Props {
  token: string;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-widest border-b border-border pb-2">
        {title}
      </h2>
      {children}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-3 space-y-1">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
      <p className="text-lg font-bold">{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
    attended: { label: "출석", cls: "bg-green-500/20 text-green-400", icon: <CheckCircle className="h-3 w-3" /> },
    noshow: { label: "노쇼", cls: "bg-red-500/20 text-red-400", icon: <XCircle className="h-3 w-3" /> },
    cancelled: { label: "캔슬", cls: "bg-yellow-500/20 text-yellow-400", icon: <Clock className="h-3 w-3" /> },
  };
  const s = map[status] ?? { label: status, cls: "bg-gray-500/20 text-gray-400", icon: null };
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full ${s.cls}`}>
      {s.icon}
      {s.label}
    </span>
  );
}

export default function MemberReport({ token }: Props) {
  const { data, isLoading, error } = trpc.reports.getPublic.useQuery({ token });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground text-sm">보고서 로딩 중...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-2">
          <p className="text-foreground font-medium">보고서를 찾을 수 없습니다.</p>
          <p className="text-sm text-muted-foreground">링크가 유효하지 않거나 만료되었습니다.</p>
        </div>
      </div>
    );
  }

  const { member, conditionChecks, workoutMemos, ptPackages, generatedAt } = data;

  // 출석 통계
  const totalAttended = conditionChecks.filter((c) => c.status === "attended").length;
  const totalNoshow = conditionChecks.filter((c) => c.status === "noshow").length;
  const totalCancelled = conditionChecks.filter((c) => c.status === "cancelled").length;

  // 컨디션 평균
  const scoresWithValues = conditionChecks.filter((c) => c.conditionScore != null);
  const avgCondition =
    scoresWithValues.length
      ? (
          scoresWithValues.reduce((s, c) => s + (c.conditionScore ?? 0), 0) /
          scoresWithValues.length
        ).toFixed(1)
      : null;

  // PT 잔여
  const activePkgs = ptPackages.filter((p) => p.status === "active");
  const remainingPt = activePkgs.reduce(
    (s, p) => s + (p.totalSessions - p.usedSessions),
    0
  );

  // 통증 이력
  const painChecks = conditionChecks.filter(
    (c) => c.painLevel != null && c.painLevel > 0
  );

  // 차트 데이터 (conditionScore 있는 것만, 최근 20개, 날짜 오름차순)
  const chartData = conditionChecks
    .filter((c) => c.conditionScore != null)
    .slice(0, 20)
    .reverse()
    .map((c) => ({
      date: format(new Date(c.checkDate + "T00:00:00"), "M/d"),
      컨디션: c.conditionScore,
      수면: c.sleepHours ? parseFloat(c.sleepHours) : undefined,
    }));

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">

        {/* 헤더 */}
        <div className="border-b border-border pb-6">
          <p
            className="text-xs text-muted-foreground font-bold tracking-widest mb-3"
            style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
          >
            ZIANTGYM
          </p>
          <div className="flex items-start gap-4">
            <div className="h-14 w-14 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-xl shrink-0">
              {member.name.charAt(0)}
            </div>
            <div>
              <h1 className="text-2xl font-bold">{member.name} 회원 보고서</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                {["basic", "premium", "vip"].includes(member.grade ?? "")
                  ? { basic: "기본", premium: "프리미엄", vip: "VIP" }[member.grade as string]
                  : member.grade}{" "}
                회원
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                생성일: {format(new Date(generatedAt), "yyyy년 MM월 dd일 HH:mm", { locale: ko })}
              </p>
            </div>
          </div>
        </div>

        {/* 요약 통계 */}
        <Section title="요약">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard
              label="총 출석"
              value={`${totalAttended}회`}
              icon={<CheckCircle className="h-3.5 w-3.5 text-green-400" />}
            />
            <StatCard
              label="잔여 PT"
              value={`${remainingPt}회`}
              icon={<Dumbbell className="h-3.5 w-3.5 text-primary" />}
            />
            <StatCard
              label="평균 컨디션"
              value={avgCondition ? `${avgCondition}/5` : "-"}
              icon={<Activity className="h-3.5 w-3.5 text-blue-400" />}
            />
            <StatCard
              label="트레이닝 일지"
              value={`${workoutMemos.length}건`}
              icon={<BookOpen className="h-3.5 w-3.5 text-orange-400" />}
            />
          </div>
          {(totalNoshow > 0 || totalCancelled > 0) && (
            <div className="flex gap-4 text-xs text-muted-foreground">
              {totalNoshow > 0 && <span className="text-red-400">노쇼 {totalNoshow}회</span>}
              {totalCancelled > 0 && <span className="text-yellow-400">캔슬 {totalCancelled}회</span>}
            </div>
          )}
        </Section>

        {/* 컨디션 추이 차트 */}
        {chartData.length > 1 && (
          <Section title="컨디션 점수 추이">
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 4, right: 8, left: -24, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis
                      domain={[0, 5]}
                      ticks={[1, 2, 3, 4, 5]}
                      tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                        fontSize: "12px",
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="컨디션"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      dot={{ r: 3, fill: "hsl(var(--primary))" }}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </Section>
        )}

        {/* 수업 전 체크 이력 */}
        {conditionChecks.length > 0 && (
          <Section title="수업 전 컨디션 체크 이력">
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              {conditionChecks.slice(0, 15).map((check, idx) => (
                <div
                  key={check.id}
                  className={`flex items-start gap-3 px-4 py-3 ${
                    idx < conditionChecks.slice(0, 15).length - 1 ? "border-b border-border" : ""
                  }`}
                >
                  <div className="shrink-0 w-20 space-y-1">
                    <p className="text-xs font-medium">
                      {format(new Date(check.checkDate + "T00:00:00"), "MM.dd (EEE)", { locale: ko })}
                    </p>
                    <StatusBadge status={check.status} />
                  </div>
                  <div className="flex-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                    {check.conditionScore != null && (
                      <span>
                        컨디션{" "}
                        <strong className="text-foreground">{check.conditionScore}/5</strong>
                      </span>
                    )}
                    {check.sleepHours && (
                      <span>
                        수면 <strong className="text-foreground">{check.sleepHours}h</strong>
                      </span>
                    )}
                    {check.energyLevel && (
                      <span>
                        에너지 <strong className="text-foreground">{check.energyLevel}</strong>
                      </span>
                    )}
                    {check.painLevel != null && check.painLevel > 0 && (
                      <span className="text-orange-400">
                        통증 <strong>{check.painLevel}/10</strong>
                        {check.painArea ? ` (${check.painArea}${check.painSide ? " · " + check.painSide : ""})` : ""}
                      </span>
                    )}
                    {check.notes && (
                      <span className="w-full text-foreground/70 mt-0.5 italic">
                        {check.notes}
                      </span>
                    )}
                  </div>
                </div>
              ))}
              {conditionChecks.length > 15 && (
                <div className="px-4 py-2 text-xs text-muted-foreground text-center border-t border-border">
                  외 {conditionChecks.length - 15}건 더 있음
                </div>
              )}
            </div>
          </Section>
        )}

        {/* 통증 이력 하이라이트 */}
        {painChecks.length > 0 && (
          <Section title="통증 이력">
            <div className="space-y-2">
              {painChecks.map((check) => (
                <div
                  key={check.id}
                  className="flex items-center gap-3 p-3 rounded-lg bg-orange-500/10 border border-orange-500/20"
                >
                  <AlertTriangle className="h-4 w-4 text-orange-400 shrink-0" />
                  <div className="text-xs">
                    <span className="font-medium text-orange-300">
                      {format(new Date(check.checkDate + "T00:00:00"), "yyyy년 MM월 dd일", { locale: ko })}
                    </span>
                    <span className="text-muted-foreground ml-2">통증 {check.painLevel}/10</span>
                    {check.painArea && (
                      <span className="text-muted-foreground"> · {check.painArea}</span>
                    )}
                    {check.painSide && (
                      <span className="text-muted-foreground"> ({check.painSide})</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* 트레이닝 일지 */}
        {workoutMemos.length > 0 && (
          <Section title="트레이닝 일지">
            <div className="space-y-3">
              {workoutMemos.slice(0, 10).map((memo) => (
                <div
                  key={memo.id}
                  className="p-4 rounded-xl bg-card border border-border"
                >
                  <p className="text-xs font-medium text-primary mb-2">
                    {format(new Date(memo.memoDate + "T00:00:00"), "yyyy.MM.dd (EEE)", { locale: ko })}
                  </p>
                  <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                    {memo.content}
                  </p>
                </div>
              ))}
              {workoutMemos.length > 10 && (
                <p className="text-xs text-muted-foreground text-center">
                  외 {workoutMemos.length - 10}건 더 있음
                </p>
              )}
            </div>
          </Section>
        )}

        {/* PT 패키지 현황 */}
        {ptPackages.length > 0 && (
          <Section title="PT 패키지 현황">
            <div className="space-y-3">
              {ptPackages.map((pkg) => {
                const remaining = pkg.totalSessions - pkg.usedSessions;
                const pct = (pkg.usedSessions / pkg.totalSessions) * 100;
                return (
                  <div
                    key={pkg.id}
                    className="p-4 rounded-xl bg-card border border-border"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-sm font-medium">{pkg.packageName || "PT 프로그램"}</p>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          pkg.status === "active"
                            ? "bg-green-500/20 text-green-400"
                            : pkg.status === "completed"
                            ? "bg-gray-500/20 text-gray-400"
                            : "bg-red-500/20 text-red-400"
                        }`}
                      >
                        {pkg.status === "active"
                          ? "진행중"
                          : pkg.status === "completed"
                          ? "완료"
                          : "만료"}
                      </span>
                    </div>
                    <div className="w-full bg-border rounded-full h-2 mb-2">
                      <div
                        className="bg-primary h-2 rounded-full transition-all"
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{pkg.usedSessions}회 사용</span>
                      <span className="font-medium text-foreground">{remaining}회 잔여 / 총 {pkg.totalSessions}회</span>
                    </div>
                    {(pkg.startDate || pkg.expiryDate) && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {pkg.startDate} ~ {pkg.expiryDate}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </Section>
        )}

        {/* 푸터 */}
        <div className="border-t border-border pt-6 text-center">
          <p
            className="text-xs text-muted-foreground"
            style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
          >
            ZIANTGYM · 트레이너 회원 관리 시스템
          </p>
        </div>
      </div>
    </div>
  );
}
