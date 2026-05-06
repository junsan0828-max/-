import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, User, Activity, CreditCard, FileText } from "lucide-react";
import { toast } from "sonner";

const STATUS_OPTIONS = [
  { value: "trial", label: "체험판", color: "text-blue-400" },
  { value: "active", label: "활성", color: "text-green-400" },
  { value: "expired", label: "만료", color: "text-red-400" },
  { value: "suspended", label: "비활성", color: "text-gray-400" },
];

function StatusBadge({ status, lastLoginAt }: { status: string; lastLoginAt?: string | null }) {
  if (status === "suspended") return <span className="text-xs px-2 py-0.5 rounded-full border bg-gray-500/20 text-gray-400 border-gray-500/30">비활성</span>;
  if (status === "expired") return <span className="text-xs px-2 py-0.5 rounded-full border bg-red-500/20 text-red-400 border-red-500/30">만료</span>;
  if (status === "trial") return <span className="text-xs px-2 py-0.5 rounded-full border bg-blue-500/20 text-blue-400 border-blue-500/30">체험판</span>;
  const days = lastLoginAt ? (Date.now() - new Date(lastLoginAt).getTime()) / (1000 * 60 * 60 * 24) : 999;
  if (days >= 14) return <span className="text-xs px-2 py-0.5 rounded-full border bg-gray-500/20 text-gray-400 border-gray-500/30">휴면</span>;
  return <span className="text-xs px-2 py-0.5 rounded-full border bg-green-500/20 text-green-400 border-green-500/30">활성</span>;
}

interface Props { trainerId: number; }

export default function AdminTrainerDetail({ trainerId }: Props) {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const { data: t, isLoading } = trpc.admin.getTrainer.useQuery({ trainerId });

  const [subStatus, setSubStatus] = useState("");
  const [subEndDate, setSubEndDate] = useState("");
  const [memo, setMemo] = useState("");
  const [memoEdit, setMemoEdit] = useState(false);

  const updateMutation = trpc.admin.updateTrainer.useMutation({
    onSuccess: () => { toast.success("저장되었습니다."); utils.admin.getTrainer.invalidate({ trainerId }); utils.admin.listTrainers.invalidate(); setMemoEdit(false); },
    onError: e => toast.error(e.message),
  });

  const toggleActiveMutation = trpc.admin.toggleUserActive.useMutation({
    onSuccess: () => { toast.success("계정 상태가 변경되었습니다."); utils.admin.getTrainer.invalidate({ trainerId }); utils.admin.listTrainers.invalidate(); },
    onError: e => toast.error(e.message),
  });

  if (isLoading) return <div className="py-16 text-center text-muted-foreground text-sm">로딩 중...</div>;
  if (!t) return <div className="py-16 text-center text-muted-foreground text-sm">트레이너를 찾을 수 없습니다.</div>;

  const days = t.lastLoginAt ? Math.floor((Date.now() - new Date(t.lastLoginAt).getTime()) / (1000 * 60 * 60 * 24)) : null;
  const isSuspended = t.position === "suspended";

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => setLocation("/admin/trainers")} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-xl font-bold">{t.trainerName}</h1>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-muted-foreground">@{t.username}</span>
            <StatusBadge status={t.subscriptionStatus} lastLoginAt={t.lastLoginAt} />
          </div>
        </div>
      </div>

      {/* 기본 정보 */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><User className="h-4 w-4 text-primary" />기본 정보</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {[
            ["연락처", t.phone ?? "-"],
            ["이메일", t.email ?? "-"],
            ["가입일", t.createdAt?.slice(0, 10) ?? "-"],
            ["마지막 접속", t.lastLoginAt ? `${t.lastLoginAt.slice(0, 10)} (${days}일 전)` : "없음"],
          ].map(([label, value]) => (
            <div key={label} className="flex justify-between py-1 border-b border-border/50 last:border-0">
              <span className="text-muted-foreground">{label}</span>
              <span className="font-medium">{value}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* 활동 정보 */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><Activity className="h-4 w-4 text-primary" />활동 정보</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-3 gap-2">
          {[
            { label: "관리 회원", value: `${t.memberCount}명`, color: "text-blue-400" },
            { label: "PT 세션", value: `${t.sessionCount}회`, color: "text-green-400" },
            { label: "출석 체크", value: `${t.attendanceCount}회`, color: "text-purple-400" },
          ].map(item => (
            <div key={item.label} className="p-2.5 rounded-lg bg-accent/20 border border-border text-center">
              <p className="text-xs text-muted-foreground mb-1">{item.label}</p>
              <p className={`text-lg font-bold ${item.color}`}>{item.value}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* 구독 관리 */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><CreditCard className="h-4 w-4 text-primary" />구독 관리</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">구독 상태</label>
            <Select value={subStatus || t.subscriptionStatus} onValueChange={setSubStatus}>
              <SelectTrigger className="h-9 text-sm bg-input border-border"><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">구독 만료일</label>
            <Input type="date" className="h-9 text-sm bg-input border-border"
              defaultValue={t.subscriptionEndDate ?? ""} onChange={e => setSubEndDate(e.target.value)} />
          </div>
          <Button size="sm" className="w-full" onClick={() => updateMutation.mutate({
            trainerId,
            subscriptionStatus: (subStatus || t.subscriptionStatus) as any,
            subscriptionEndDate: subEndDate || t.subscriptionEndDate,
          })} disabled={updateMutation.isPending}>
            {updateMutation.isPending ? "저장 중..." : "구독 정보 저장"}
          </Button>
        </CardContent>
      </Card>

      {/* 운영자 메모 */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><FileText className="h-4 w-4 text-primary" />운영자 메모</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {!memoEdit ? (
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm text-muted-foreground flex-1">{t.adminMemo || "메모 없음"}</p>
              <button onClick={() => { setMemo(t.adminMemo ?? ""); setMemoEdit(true); }} className="text-xs text-primary underline shrink-0">수정</button>
            </div>
          ) : (
            <>
              <textarea
                value={memo}
                onChange={e => setMemo(e.target.value)}
                rows={3}
                placeholder="운영 메모 입력..."
                className="w-full text-sm bg-input border border-border rounded-md px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1" onClick={() => setMemoEdit(false)}>취소</Button>
                <Button size="sm" className="flex-1" onClick={() => updateMutation.mutate({ trainerId, adminMemo: memo })} disabled={updateMutation.isPending}>저장</Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* 계정 제어 */}
      <Card className="bg-card border-red-500/20">
        <CardContent className="p-4">
          <Button
            variant="outline"
            className={`w-full ${isSuspended ? "border-green-500/50 text-green-400 hover:bg-green-500/10" : "border-red-500/50 text-red-400 hover:bg-red-500/10"}`}
            onClick={() => toggleActiveMutation.mutate({ userId: t.userId!, active: isSuspended })}
            disabled={toggleActiveMutation.isPending}
          >
            {isSuspended ? "계정 활성화" : "계정 비활성화"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
