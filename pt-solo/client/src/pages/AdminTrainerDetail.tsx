import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, User, Activity, CreditCard, FileText, Coins, CheckCircle, XCircle, Clock, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";

const STATUS_OPTIONS = [
  { value: "trial", label: "체험판", color: "text-blue-400" },
  { value: "active", label: "활성", color: "text-green-400" },
  { value: "expired", label: "만료", color: "text-red-400" },
  { value: "suspended", label: "비활성", color: "text-gray-400" },
];

const PLAN_OPTIONS = [
  { value: "free", label: "FREE" },
  { value: "pro", label: "PRO" },
  { value: "elite", label: "ELITE" },
];

function PlanBadge({ plan }: { plan?: string }) {
  if (plan === "elite") return <span className="text-xs px-2 py-0.5 rounded-full border bg-purple-500/20 text-purple-500 border-purple-500/30">ELITE</span>;
  if (plan === "pro") return <span className="text-xs px-2 py-0.5 rounded-full border bg-blue-500/20 text-blue-500 border-blue-500/30">PRO</span>;
  return <span className="text-xs px-2 py-0.5 rounded-full border bg-gray-500/20 text-gray-500 border-gray-500/30">FREE</span>;
}

interface Props { trainerId: number; }

export default function AdminTrainerDetail({ trainerId }: Props) {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const { data: t, isLoading } = trpc.admin.getTrainer.useQuery({ trainerId });

  // 플랜별 회원 한도
  const { data: memberLimits } = trpc.fitStepPlus.admin_getMemberLimits.useQuery();
  const [limitDraft, setLimitDraft] = useState<{ free: string; pro: string; elite: string } | null>(null);
  const updateMemberLimitsMutation = trpc.fitStepPlus.admin_updateMemberLimits.useMutation({
    onSuccess: () => { toast.success("플랜 인원 한도가 저장되었습니다."); utils.fitStepPlus.admin_getMemberLimits.invalidate(); setLimitDraft(null); },
    onError: (e: any) => toast.error(e.message),
  });

  const [subStatus, setSubStatus] = useState("");
  const [subEndDate, setSubEndDate] = useState("");
  const [planValue, setPlanValue] = useState("");
  const [memo, setMemo] = useState("");
  const [memoEdit, setMemoEdit] = useState(false);
  const [grantAmount, setGrantAmount] = useState("");
  const [grantMemo, setGrantMemo] = useState("");
  const [infoEdit, setInfoEdit] = useState(false);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editEmail, setEditEmail] = useState("");

  const updateMutation = trpc.admin.updateTrainer.useMutation({
    onSuccess: () => { toast.success("저장되었습니다."); utils.admin.getTrainer.invalidate({ trainerId }); utils.admin.listTrainers.invalidate(); setMemoEdit(false); },
    onError: e => toast.error(e.message),
  });

  const deleteMutation = trpc.admin.deleteTrainer.useMutation({
    onSuccess: () => {
      utils.admin.listTrainers.invalidate();
      toast.success("STEPER 계정이 삭제되었습니다");
      setLocation("/admin/trainers");
    },
    onError: (e) => toast.error(e.message),
  });

  const toggleActiveMutation = trpc.admin.toggleUserActive.useMutation({
    onSuccess: () => { toast.success("계정 상태가 변경되었습니다."); utils.admin.getTrainer.invalidate({ trainerId }); utils.admin.listTrainers.invalidate(); },
    onError: e => toast.error(e.message),
  });

  const { data: pointData, refetch: refetchPoints } = trpc.admin.getTrainerPoints.useQuery({ trainerId });

  const grantMutation = trpc.admin.grantPoints.useMutation({
    onSuccess: () => { toast.success("포인트가 지급되었습니다."); setGrantAmount(""); setGrantMemo(""); refetchPoints(); },
    onError: e => toast.error(e.message),
  });

  const approveMutation = trpc.admin.approveChargeRequest.useMutation({
    onSuccess: () => { toast.success("처리되었습니다."); refetchPoints(); },
    onError: e => toast.error(e.message),
  });

  if (isLoading) return <div className="py-16 text-center text-muted-foreground text-sm">로딩 중...</div>;
  if (!t) return <div className="py-16 text-center text-muted-foreground text-sm">STEPER를 찾을 수 없습니다.</div>;

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
            <PlanBadge plan={(t as any).plan} />
          </div>
        </div>
      </div>

      {/* 기본 정보 */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center justify-between">
            <span className="flex items-center gap-2"><User className="h-4 w-4 text-primary" />기본 정보</span>
            {!infoEdit && (
              <button
                onClick={() => { setEditName(t.trainerName ?? ""); setEditPhone(t.phone ?? ""); setEditEmail(t.email ?? ""); setInfoEdit(true); }}
                className="flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <Pencil className="h-3 w-3" />수정
              </button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {infoEdit ? (
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">이름</label>
                <Input value={editName} onChange={e => setEditName(e.target.value)} className="h-9 text-sm bg-input border-border" placeholder="STEPER 이름" />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">연락처</label>
                <Input value={editPhone} onChange={e => setEditPhone(e.target.value)} className="h-9 text-sm bg-input border-border" placeholder="010-0000-0000" />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">이메일</label>
                <Input value={editEmail} onChange={e => setEditEmail(e.target.value)} className="h-9 text-sm bg-input border-border" placeholder="email@example.com" />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1" onClick={() => setInfoEdit(false)}>취소</Button>
                <Button size="sm" className="flex-1" disabled={updateMutation.isPending}
                  onClick={() => updateMutation.mutate({
                    trainerId,
                    trainerName: editName.trim() || undefined,
                    phone: editPhone.trim() || null,
                    email: editEmail.trim() || null,
                  }, { onSuccess: () => setInfoEdit(false) })}>
                  {updateMutation.isPending ? "저장 중..." : "저장"}
                </Button>
              </div>
            </div>
          ) : (
            <>
              {[
                ["이름", t.trainerName ?? "-"],
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
            </>
          )}
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
            { label: "수업", value: `${t.sessionCount}회`, color: "text-green-400" },
            { label: "출석 체크", value: `${t.attendanceCount}회`, color: "text-purple-400" },
          ].map(item => (
            <div key={item.label} className="p-2.5 rounded-lg bg-accent/20 border border-border text-center">
              <p className="text-xs text-muted-foreground mb-1">{item.label}</p>
              <p className={`text-lg font-bold ${item.color}`}>{item.value}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* 플랜 관리 */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><CreditCard className="h-4 w-4 text-primary" />플랜 / 구독 관리</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">요금 플랜</label>
            <div className="flex gap-2">
              {PLAN_OPTIONS.map(o => (
                <button key={o.value} onClick={() => setPlanValue(o.value)}
                  className={`flex-1 py-2 px-2 rounded-lg border text-xs font-medium transition-colors ${
                    (planValue || (t as any).plan || "free") === o.value
                      ? "bg-primary/20 border-primary text-primary"
                      : "border-border text-muted-foreground hover:border-primary/40"
                  }`}>
                  <p>{o.label}</p>
                  <p className="text-[10px] font-normal opacity-70 mt-0.5">유효회원 {memberLimits?.[o.value] ?? "—"}명</p>
                </button>
              ))}
            </div>
          </div>
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
            plan: (planValue || (t as any).plan || "free") as any,
          })} disabled={updateMutation.isPending}>
            {updateMutation.isPending ? "저장 중..." : "저장"}
          </Button>
        </CardContent>
      </Card>

      {/* 플랜별 회원 한도 설정 */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><CreditCard className="h-4 w-4 text-amber-500" />플랜별 회원 수 한도 설정</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">플랜마다 등록 가능한 유효회원 수 한도를 설정합니다. 변경 시 모든 STEPER에게 적용됩니다.</p>
          {["free", "pro", "elite"].map(plan => (
            <div key={plan} className="flex items-center gap-3">
              <span className={`text-xs font-bold w-12 ${plan === "elite" ? "text-purple-500" : plan === "pro" ? "text-blue-500" : "text-gray-500"}`}>
                {plan.toUpperCase()}
              </span>
              <Input
                type="number" min={1} max={9999}
                value={limitDraft?.[plan as "free"|"pro"|"elite"] ?? String(memberLimits?.[plan] ?? "")}
                onChange={e => setLimitDraft(prev => ({ free: String(memberLimits?.free ?? 7), pro: String(memberLimits?.pro ?? 15), elite: String(memberLimits?.elite ?? 35), ...prev, [plan]: e.target.value }))}
                className="h-9 w-24 text-sm bg-input border-border"
              />
              <span className="text-xs text-muted-foreground">명</span>
            </div>
          ))}
          <Button size="sm" className="w-full"
            disabled={updateMemberLimitsMutation.isPending || !limitDraft}
            onClick={() => {
              if (!limitDraft) return;
              updateMemberLimitsMutation.mutate({
                free: parseInt(limitDraft.free) || (memberLimits?.free ?? 7),
                pro: parseInt(limitDraft.pro) || (memberLimits?.pro ?? 15),
                elite: parseInt(limitDraft.elite) || (memberLimits?.elite ?? 35),
              });
            }}>
            {updateMemberLimitsMutation.isPending ? "저장 중..." : "한도 저장"}
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

      {/* FIT POINT 관리 */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><Coins className="h-4 w-4 text-primary" />FIT POINT 관리</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* 잔액 */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-primary/10 border border-primary/20">
            <span className="text-sm text-muted-foreground">현재 잔액</span>
            <span className="text-xl font-black text-primary">{(pointData?.balance ?? 0).toLocaleString()} P</span>
          </div>

          {/* 지급 폼 */}
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">포인트 지급</label>
            <Input type="number" placeholder="금액" value={grantAmount} onChange={e => setGrantAmount(e.target.value)}
              className="h-9 text-sm bg-input border-border" />
            <Input placeholder="메모 (선택)" value={grantMemo} onChange={e => setGrantMemo(e.target.value)}
              className="h-9 text-sm bg-input border-border" />
            <Button size="sm" className="w-full" disabled={!grantAmount || grantMutation.isPending}
              onClick={() => grantMutation.mutate({ trainerId, amount: Number(grantAmount), memo: grantMemo || undefined })}>
              {grantMutation.isPending ? "지급 중..." : "포인트 지급"}
            </Button>
          </div>

          {/* 충전 신청 내역 */}
          {pointData && pointData.logs.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground font-medium">내역 (최근 30건)</p>
              {pointData.logs.map(log => (
                <div key={log.id} className="flex items-center gap-2 py-1.5 px-2 rounded-lg bg-accent/20 border border-border/50">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      {log.status === "completed" && <CheckCircle className="h-3 w-3 text-green-400 shrink-0" />}
                      {log.status === "pending" && <Clock className="h-3 w-3 text-yellow-400 shrink-0" />}
                      {log.status === "rejected" && <XCircle className="h-3 w-3 text-red-400 shrink-0" />}
                      <span className="text-xs font-medium">
                        {log.type === "admin_grant" ? "관리자 지급" : log.type === "charge_request" ? "충전 신청" : log.type === "daily_reset" ? "일일 초기화" : "사용"}
                      </span>
                      {log.memo && <span className="text-xs text-muted-foreground truncate">· {log.memo}</span>}
                    </div>
                    <p className="text-[11px] text-muted-foreground">{log.createdAt.slice(0, 10)}</p>
                  </div>
                  <span className={`text-sm font-bold shrink-0 ${log.amount > 0 ? "text-green-400" : "text-red-400"}`}>
                    {log.amount > 0 ? "+" : ""}{log.amount.toLocaleString()} P
                  </span>
                  {log.status === "pending" && (
                    <div className="flex gap-1 shrink-0">
                      <button onClick={() => approveMutation.mutate({ logId: log.id, approve: true })}
                        className="text-[11px] bg-green-500/20 text-green-400 border border-green-500/30 px-1.5 py-0.5 rounded">승인</button>
                      <button onClick={() => approveMutation.mutate({ logId: log.id, approve: false })}
                        className="text-[11px] bg-red-500/20 text-red-400 border border-red-500/30 px-1.5 py-0.5 rounded">거절</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 계정 제어 */}
      <Card className="bg-card border-red-500/20">
        <CardContent className="p-4 space-y-2">
          <Button
            variant="outline"
            className={`w-full ${isSuspended ? "border-green-500/50 text-green-400 hover:bg-green-500/10" : "border-red-500/50 text-red-400 hover:bg-red-500/10"}`}
            onClick={() => t.userId != null && toggleActiveMutation.mutate({ userId: t.userId, active: isSuspended })}
            disabled={toggleActiveMutation.isPending || t.userId == null}
          >
            {isSuspended ? "계정 활성화" : "계정 비활성화"}
          </Button>
          <Button
            variant="outline"
            className="w-full border-red-700/60 text-red-500 hover:bg-red-500/10 gap-2"
            onClick={() => {
              if (!confirm(`${t.trainerName ?? t.username} 계정을 완전히 삭제하시겠습니까?\n\n회원, PT 기록, 포인트 등 모든 데이터가 삭제됩니다. 이 작업은 되돌릴 수 없습니다.`)) return;
              deleteMutation.mutate({ userId: t.userId ?? undefined, trainerId: t.id });
            }}
            disabled={deleteMutation.isPending}
          >
            <Trash2 className="h-4 w-4" />
            계정 영구 삭제
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
