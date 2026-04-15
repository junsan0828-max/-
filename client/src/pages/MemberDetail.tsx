import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft,
  Crown,
  Activity,
  Calendar,
  User,
  Phone,
  Mail,
  Edit,
} from "lucide-react";

interface Props {
  memberId: number;
}

const membershipLabels: Record<string, string> = {
  basic: "기본",
  premium: "프리미엄",
  vip: "VIP",
};

const statusLabels: Record<string, string> = {
  active: "활성",
  paused: "정지",
};

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="text-muted-foreground mt-0.5">{icon}</div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium text-foreground">{value}</p>
      </div>
    </div>
  );
}

export default function MemberDetail({ memberId }: Props) {
  const [, setLocation] = useLocation();
  const { data: member, isLoading } = trpc.members.getById.useQuery({ id: memberId });
  const { data: ptPackages } = trpc.pt.listByMember.useQuery({ memberId });
  const { data: payments } = trpc.members.getPayments.useQuery({ memberId });
  const { data: attendances } = trpc.attendances.listByMember.useQuery({ memberId });
  const { data: trainers } = trpc.trainers.list.useQuery();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 rounded bg-card animate-pulse" />
        <div className="h-64 rounded-lg bg-card animate-pulse" />
      </div>
    );
  }

  if (!member) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>회원을 찾을 수 없습니다.</p>
      </div>
    );
  }

  const trainer = trainers?.find((t) => t.id === member.trainerId);

  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setLocation("/members")}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
              {member.name.charAt(0)}
            </div>
            <div>
              <h1 className="text-lg font-bold">{member.name}</h1>
              <p className="text-xs text-muted-foreground">
                {membershipLabels[member.grade]} · {statusLabels[member.status]}
              </p>
            </div>
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setLocation(`/members/${memberId}/edit`)}
          className="gap-1.5"
        >
          <Edit className="h-3.5 w-3.5" />
          수정
        </Button>
      </div>

      {/* 탭 */}
      <Tabs defaultValue="info">
        <TabsList className="w-full">
          <TabsTrigger value="info" className="flex-1">기본 정보</TabsTrigger>
          <TabsTrigger value="pt" className="flex-1">PT 프로그램</TabsTrigger>
          <TabsTrigger value="attendance" className="flex-1">출석</TabsTrigger>
        </TabsList>

        {/* 기본 정보 탭 */}
        <TabsContent value="info" className="mt-4">
          <Card className="bg-card border-border">
            <CardContent className="p-4 sm:p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                <InfoRow
                  icon={<Crown className="h-4 w-4" />}
                  label="등급"
                  value={membershipLabels[member.grade] ?? "-"}
                />
                <InfoRow
                  icon={<Activity className="h-4 w-4" />}
                  label="상태"
                  value={statusLabels[member.status] ?? "-"}
                />
                <InfoRow
                  icon={<Calendar className="h-4 w-4" />}
                  label="생년월일"
                  value={
                    member.birthDate
                      ? format(new Date(member.birthDate), "yyyy년 MM월 dd일", { locale: ko })
                      : "-"
                  }
                />
                <InfoRow
                  icon={<User className="h-4 w-4" />}
                  label="성별"
                  value={
                    member.gender === "male"
                      ? "남성"
                      : member.gender === "female"
                      ? "여성"
                      : "-"
                  }
                />
                <InfoRow
                  icon={<Phone className="h-4 w-4" />}
                  label="연락처"
                  value={member.phone ?? "-"}
                />
                <InfoRow
                  icon={<Mail className="h-4 w-4" />}
                  label="이메일"
                  value={member.email ?? "-"}
                />
                <InfoRow
                  icon={<Calendar className="h-4 w-4" />}
                  label="회원권 시작"
                  value={
                    member.membershipStart
                      ? format(new Date(member.membershipStart), "yyyy.MM.dd", { locale: ko })
                      : "-"
                  }
                />
                <InfoRow
                  icon={<Calendar className="h-4 w-4" />}
                  label="회원권 만료"
                  value={
                    member.membershipEnd
                      ? format(new Date(member.membershipEnd), "yyyy.MM.dd", { locale: ko })
                      : "-"
                  }
                />
                <InfoRow
                  icon={<Calendar className="h-4 w-4" />}
                  label="등록일"
                  value={format(new Date(member.createdAt), "yyyy.MM.dd", { locale: ko })}
                />
                <InfoRow
                  icon={<User className="h-4 w-4" />}
                  label="담당 트레이너"
                  value={trainer?.trainerName ?? "-"}
                />
                <InfoRow
                  icon={<Activity className="h-4 w-4" />}
                  label="총 결제 금액"
                  value={
                    payments
                      ? `${payments.reduce((sum, p) => sum + p.amount, 0).toLocaleString()}원`
                      : "-"
                  }
                />
              </div>

              {member.profileNote && (
                <div className="mt-4 p-3 sm:p-4 rounded-lg bg-accent/30 border border-border">
                  <p className="text-xs text-muted-foreground mb-1">특이사항</p>
                  <p className="text-sm text-foreground whitespace-pre-wrap">
                    {member.profileNote}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* PT 프로그램 탭 */}
        <TabsContent value="pt" className="mt-4">
          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between px-4 sm:px-6">
              <CardTitle className="text-base">PT 프로그램</CardTitle>
              <Button
                size="sm"
                onClick={() => setLocation("/pt")}
                className="bg-primary/20 text-primary hover:bg-primary/30 border border-primary/30 text-xs"
              >
                프로그램 관리
              </Button>
            </CardHeader>
            <CardContent className="px-4 sm:px-6">
              {!ptPackages?.length ? (
                <p className="text-muted-foreground text-sm text-center py-8">
                  등록된 PT 프로그램이 없습니다.
                </p>
              ) : (
                <div className="space-y-3">
                  {ptPackages.map((pkg) => (
                    <div
                      key={pkg.id}
                      className="p-3 sm:p-4 rounded-lg bg-accent/20 border border-border"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium text-foreground text-sm truncate">
                            {pkg.packageName || "PT 프로그램"}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {pkg.startDate
                              ? format(new Date(pkg.startDate), "yyyy.MM.dd", { locale: ko })
                              : ""}{" "}
                            ~{" "}
                            {pkg.expiryDate
                              ? format(new Date(pkg.expiryDate), "yyyy.MM.dd", { locale: ko })
                              : ""}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-lg font-bold text-primary">
                            {pkg.totalSessions - pkg.usedSessions}회
                          </p>
                          <p className="text-xs text-muted-foreground">
                            잔여 / 총 {pkg.totalSessions}회
                          </p>
                        </div>
                      </div>

                      {/* 진행률 바 */}
                      <div className="mt-3">
                        <div className="w-full bg-border rounded-full h-1.5">
                          <div
                            className="bg-primary h-1.5 rounded-full transition-all"
                            style={{
                              width: `${Math.min(
                                (pkg.usedSessions / pkg.totalSessions) * 100,
                                100
                              )}%`,
                            }}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {pkg.usedSessions}회 사용
                        </p>
                      </div>

                      {/* 결제 정보 표시 */}
                      {(pkg.paymentAmount ||
                        pkg.unpaidAmount ||
                        pkg.paymentMethod ||
                        pkg.paymentMemo) && (
                        <div className="mt-3 pt-3 border-t border-border/50">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                            {pkg.paymentAmount ? (
                              <div>
                                <p className="text-muted-foreground">결제 금액</p>
                                <p className="font-medium text-foreground">
                                  {pkg.paymentAmount.toLocaleString()}원
                                </p>
                              </div>
                            ) : null}
                            {pkg.unpaidAmount ? (
                              <div>
                                <p className="text-muted-foreground">미수금 금액</p>
                                <p className="font-medium text-orange-400">
                                  {pkg.unpaidAmount.toLocaleString()}원
                                </p>
                              </div>
                            ) : null}
                            {pkg.paymentMethod ? (
                              <div>
                                <p className="text-muted-foreground">결제방법</p>
                                <p className="font-medium text-foreground">{pkg.paymentMethod}</p>
                              </div>
                            ) : null}
                            {pkg.paymentMemo ? (
                              <div className="sm:col-span-2">
                                <p className="text-muted-foreground">결제 메모</p>
                                <p className="font-medium text-foreground">{pkg.paymentMemo}</p>
                              </div>
                            ) : null}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 출석 탭 */}
        <TabsContent value="attendance" className="mt-4">
          <Card className="bg-card border-border">
            <CardHeader className="px-4 sm:px-6">
              <CardTitle className="text-base">출석 기록</CardTitle>
            </CardHeader>
            <CardContent className="px-4 sm:px-6">
              {!attendances?.length ? (
                <p className="text-muted-foreground text-sm text-center py-8">
                  출석 기록이 없습니다.
                </p>
              ) : (
                <div className="space-y-2">
                  {attendances.slice(0, 20).map((att) => (
                    <div
                      key={att.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-accent/20 border border-border"
                    >
                      <p className="text-sm">
                        {att.attendDate
                          ? format(new Date(att.attendDate), "yyyy.MM.dd (EEE)", { locale: ko })
                          : "-"}
                      </p>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full border ${
                          att.status === "attended"
                            ? "bg-green-500/20 text-green-400 border-green-500/30"
                            : att.status === "noshow"
                            ? "bg-red-500/20 text-red-400 border-red-500/30"
                            : "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"
                        }`}
                      >
                        {att.status === "attended"
                          ? "출석"
                          : att.status === "noshow"
                          ? "노쇼"
                          : "결석"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
