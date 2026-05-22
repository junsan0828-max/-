import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { UserPlus, Trash2, Users, ChevronRight, FileSpreadsheet, ChevronDown, ChevronUp, Download, Upload, Database, Building2, Bell, Plus, ClipboardList, MapPin, ExternalLink, Lock, CheckCircle2, Clock } from "lucide-react";

const FIELD_OPTIONS = [
  { value: "skip", label: "건너뛰기" },
  { value: "name", label: "이름 *" },
  { value: "phone", label: "연락처" },
  { value: "email", label: "이메일" },
  { value: "birthDate", label: "생년월일 (YYYY-MM-DD)" },
  { value: "gender", label: "성별 (male/female)" },
  { value: "grade", label: "등급 (basic/premium/vip)" },
  { value: "status", label: "상태 (active/paused)" },
  { value: "membershipStart", label: "운동 시작일" },
  { value: "membershipEnd", label: "운동 종료일" },
  { value: "profileNote", label: "특이사항" },
  { value: "ptProgram", label: "PT 패키지명" },
  { value: "ptSessions", label: "PT 횟수" },
  { value: "paymentAmount", label: "결제 금액" },
  { value: "unpaidAmount", label: "미수금" },
  { value: "paymentMethod", label: "결제방법" },
  { value: "membershipInfo", label: "보유 이용권 (헬스/PT 자동 파싱)" },
];

const AUTO_GUESS: Record<string, string> = {
  이름: "name", 성명: "name", name: "name",
  연락처: "phone", 전화번호: "phone", 휴대폰: "phone", 핸드폰: "phone", phone: "phone",
  이메일: "email", email: "email",
  생년월일: "birthDate", 생일: "birthDate",
  성별: "gender", gender: "gender",
  등급: "grade", grade: "grade",
  상태: "status", status: "status",
  시작일: "membershipStart", 등록일: "membershipStart", 가입일: "membershipStart", 운동시작일: "membershipStart",
  만료일: "membershipEnd", 종료일: "membershipEnd", 운동종료일: "membershipEnd",
  특이사항: "profileNote", 메모: "profileNote", 비고: "profileNote",
  패키지: "ptProgram", PT프로그램: "ptProgram", 프로그램: "ptProgram", "PT 프로그램": "ptProgram",
  횟수: "ptSessions", PT횟수: "ptSessions", "PT 횟수": "ptSessions", 세션: "ptSessions",
  결제금액: "paymentAmount", 금액: "paymentAmount", "결제 금액": "paymentAmount",
  미수금: "unpaidAmount",
  결제방법: "paymentMethod", "결제 방법": "paymentMethod",
  "보유이용권": "membershipInfo", "보유 이용권": "membershipInfo",
};

export default function Admin() {
  const [, setLocation] = useLocation();
  const { data: user } = trpc.auth.me.useQuery();
  const isAdmin = user?.role === "admin";
  const { data: trainers, refetch } = trpc.admin.listTrainers.useQuery(undefined, { enabled: isAdmin });
  const { data: branchList, refetch: refetchBranches } = trpc.admin.listBranches.useQuery(undefined, { enabled: isAdmin });
  const { data: syncConfig, refetch: refetchConfig } = trpc.admin.getSyncConfig.useQuery(undefined, { enabled: isAdmin });
  const { data: pendingMembers, refetch: refetchPending } = trpc.admin.listPending.useQuery(undefined, { enabled: isAdmin });
  const { data: unassignedMembers, refetch: refetchUnassigned } = trpc.admin.listUnassignedMembers.useQuery(undefined, { enabled: !!user });
  const { data: unassignedRevenue, refetch: refetchUnassignedRevenue } = trpc.admin.listUnassignedRevenue.useQuery(undefined, { enabled: !!user });
  const { data: unclassifiedMembers, refetch: refetchUnclassified } = trpc.members.listUnclassified.useQuery();
  const utils = trpc.useUtils();

  const [assigningMemberId, setAssigningMemberId] = useState<number | null>(null);
  const [assignMemberTrainerId, setAssignMemberTrainerId] = useState("");
  const [assigningRevenueId, setAssigningRevenueId] = useState<number | null>(null);
  const [assignRevenueTrainerId, setAssignRevenueTrainerId] = useState("");

  const [adminTab, setAdminTab] = useState<"account" | "work" | "server">("account");
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [dbRestoring, setDbRestoring] = useState(false);
  const [newBranchName, setNewBranchName] = useState("");
  const [trainerBranchFilter, setTrainerBranchFilter] = useState<number | undefined>(undefined);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ username: "", password: "", trainerName: "", phone: "", email: "", settlementRate: "50", branchId: "none" });

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

  // 시트 자동 동기화 설정
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetUrl, setSheetUrl] = useState("https://docs.google.com/spreadsheets/d/1jZbMrBQM_vr2PpvxyprpH1qQlfp_w2hQwdortv65C5w/edit?usp=drivesdk");

  useEffect(() => {
    if (syncConfig?.sheetUrl) setSheetUrl(syncConfig.sheetUrl);
  }, [syncConfig?.sheetUrl]);
  const [sheetPreview, setSheetPreview] = useState<{
    headers: string[];
    sampleRows: string[][];
    totalRows: number;
  } | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [syncResult, setSyncResult] = useState<{ newMembers: number; message: string } | null>(null);

  // 미배정 회원 트레이너 선택
  const [assigningId, setAssigningId] = useState<number | null>(null);
  const [assignTrainerId, setAssignTrainerId] = useState("");

  const previewMutation = trpc.admin.previewSheet.useMutation({
    onSuccess: (data) => {
      // column B(offset=1)부터 헤더 취득
      setSheetPreview(data);
      const autoMap: Record<string, string> = {};
      data.headers.forEach((h) => {
        const key = h.trim();
        autoMap[key] = AUTO_GUESS[key] ?? "skip";
      });
      setMapping(autoMap);
    },
    onError: (err) => toast.error(err.message || "시트 불러오기 실패"),
  });

  const saveSyncMutation = trpc.admin.saveSyncConfig.useMutation({
    onSuccess: () => {
      toast.success("동기화 설정이 저장되었습니다. 5분마다 자동 동기화됩니다.");
      refetchConfig();
      setSheetOpen(false);
    },
    onError: (err) => toast.error(err.message || "저장 실패"),
  });

  const syncNowMutation = trpc.admin.syncNow.useMutation({
    onSuccess: (data) => {
      setSyncResult(data);
      refetchPending();
      refetchConfig();
      if (data.newMembers > 0) toast.success(`${data.newMembers}명이 미배정 목록에 추가되었습니다.`);
      else toast.info("새로운 데이터가 없습니다.");
    },
    onError: (err) => toast.error(err.message || "동기화 실패"),
  });

  const assignMutation = trpc.admin.assignPending.useMutation({
    onSuccess: () => {
      toast.success("회원이 배정되었습니다.");
      setAssigningId(null);
      setAssignTrainerId("");
      refetchPending();
    },
    onError: (err) => toast.error(err.message || "배정 실패"),
  });

  const deletePendingMutation = trpc.admin.deletePending.useMutation({
    onSuccess: () => { toast.success("삭제되었습니다."); refetchPending(); },
    onError: (err) => toast.error(err.message || "삭제 실패"),
  });

  const assignTrainerToMemberMutation = trpc.admin.assignTrainerToMember.useMutation({
    onSuccess: () => {
      toast.success("트레이너가 배정되었습니다.");
      setAssigningMemberId(null);
      setAssignMemberTrainerId("");
      refetchUnassigned();
    },
    onError: (err) => toast.error(err.message || "배정 실패"),
  });

  const assignTrainerToRevenueMutation = trpc.admin.assignTrainerToRevenue.useMutation({
    onSuccess: () => {
      toast.success("트레이너가 배정되었습니다.");
      setAssigningRevenueId(null);
      setAssignRevenueTrainerId("");
      refetchUnassignedRevenue();
      utils.gym.revenue.list.invalidate();
    },
    onError: (err) => toast.error(err.message || "배정 실패"),
  });

  const assignBranchMutation = trpc.members.assignBranch.useMutation({
    onSuccess: () => { toast.success("지점이 배정되었습니다."); refetchUnclassified(); },
    onError: (err) => toast.error(err.message || "배정 실패"),
  });

  // 관리자 권한 확인
  if (user?.role !== "admin" && user?.role !== "sub_admin") {
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-bold">관리자 설정</h1>
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
          <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center">
            <Lock className="h-6 w-6 text-red-400" />
          </div>
          <p className="font-semibold text-foreground">접근 권한이 없습니다</p>
          <p className="text-sm text-muted-foreground">관리자 설정은 관리자만 접근할 수 있습니다.</p>
        </div>
      </div>
    );
  }

  const createBranchMutation = trpc.admin.createBranch.useMutation({
    onSuccess: () => { toast.success("지점이 생성되었습니다."); setNewBranchName(""); refetchBranches(); },
    onError: (err) => toast.error(err.message || "지점 생성 실패"),
  });

  const updateTrainerBranchesMutation = trpc.admin.updateTrainerBranches.useMutation({
    onSuccess: () => { refetch(); },
    onError: (err) => toast.error(err.message || "지점 변경 실패"),
  });

  const deleteMutation = trpc.admin.deleteTrainer.useMutation({
    onSuccess: () => {
      toast.success("트레이너가 삭제되었습니다.");
      setDeleteId(null);
      refetch();
    },
    onError: (err) => toast.error(err.message || "삭제 실패"),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">관리자 설정</h1>
      </div>

      {/* 탭 */}
      <div className="flex bg-card border border-border rounded-xl p-1 gap-1">
        <button onClick={() => setAdminTab("account")}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${adminTab === "account" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
          계정 설정
        </button>
        <button onClick={() => setAdminTab("work")}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${adminTab === "work" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
          업무 관리
        </button>
      </div>

      {adminTab === "work" && (
        <>
          <WorkManagementSection />
          <NoticeManagementSection />
        </>
      )}

      {adminTab === "account" && (<>

      {/* ── 구글시트 자동 동기화 설정 ── */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <button
            className="flex items-center justify-between w-full"
            onClick={() => setSheetOpen((v) => !v)}
          >
            <CardTitle className="text-base flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4 text-green-400" />
              구글시트 자동 동기화
              {syncConfig && (
                <span className="text-xs font-normal text-green-400 border border-green-500/30 bg-green-500/10 px-1.5 py-0.5 rounded-full">활성</span>
              )}
            </CardTitle>
            {sheetOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </button>
        </CardHeader>

        {sheetOpen && (
          <CardContent className="space-y-4">
            {/* 현재 설정 상태 */}
            {syncConfig && !sheetPreview && (
              <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/30 space-y-2">
                <p className="text-xs text-green-400 font-medium">✓ 동기화 설정됨 · 5분마다 자동 실행</p>
                <p className="text-xs text-muted-foreground truncate">{syncConfig.sheetUrl}</p>
                <p className="text-xs text-muted-foreground">
                  동기화된 행: {syncConfig.lastSyncedCount}행
                  {syncConfig.syncedAt && ` · 마지막: ${syncConfig.syncedAt.slice(0, 16).replace("T", " ")}`}
                </p>
                <div className="flex gap-2 pt-1">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 gap-1.5"
                    disabled={syncNowMutation.isPending}
                    onClick={() => { setSyncResult(null); syncNowMutation.mutate(); }}
                  >
                    {syncNowMutation.isPending ? "동기화 중..." : "지금 동기화"}
                  </Button>
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => { setSheetUrl(syncConfig.sheetUrl); setSheetPreview(null); }}>
                    설정 변경
                  </Button>
                </div>
                {syncResult && (
                  <p className="text-xs text-green-400">{syncResult.message}</p>
                )}
              </div>
            )}

            {/* 신규 설정 or 변경 */}
            {(!syncConfig || sheetUrl) && (
              <>
                <div className="space-y-1.5">
                  <Label className="text-xs">구글시트 공유 URL</Label>
                  <div className="flex gap-2">
                    <Input
                      value={sheetUrl}
                      onChange={(e) => setSheetUrl(e.target.value)}
                      placeholder="https://docs.google.com/spreadsheets/d/..."
                      className="h-9 text-sm flex-1"
                    />
                    <Button
                      size="sm"
                      onClick={() => previewMutation.mutate({ sheetUrl, columnOffset: 1 } as any)}
                      disabled={!sheetUrl.trim() || previewMutation.isPending}
                    >
                      {previewMutation.isPending ? "불러오는 중..." : "미리보기"}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">B열부터 데이터 인식 · "링크가 있는 모든 사용자" 뷰어 공개 필요</p>
                </div>

                {sheetPreview && (
                  <>
                    <div className="space-y-1.5">
                      <p className="text-xs text-muted-foreground">총 {sheetPreview.totalRows}행 · B열부터 미리보기</p>
                      <div className="overflow-x-auto rounded-lg border border-border">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="bg-accent/30">
                              {sheetPreview.headers.map((h, i) => (
                                <th key={i} className="px-2 py-1.5 text-left font-medium text-muted-foreground whitespace-nowrap">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {sheetPreview.sampleRows.map((row, ri) => (
                              <tr key={ri} className="border-t border-border">
                                {sheetPreview.headers.map((_, ci) => (
                                  <td key={ci} className="px-2 py-1.5 text-foreground/80 whitespace-nowrap">{row[ci] ?? ""}</td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-medium">컬럼 매핑</Label>
                      {sheetPreview.headers.map((header) => (
                        <div key={header} className="flex items-center gap-2">
                          <span className="text-xs text-foreground/70 w-24 shrink-0 truncate">{header}</span>
                          <span className="text-xs text-muted-foreground">→</span>
                          <Select
                            value={mapping[header] ?? "skip"}
                            onValueChange={(v) => setMapping((p) => ({ ...p, [header]: v }))}
                          >
                            <SelectTrigger className="h-8 text-xs flex-1">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {FIELD_OPTIONS.map((opt) => (
                                <SelectItem key={opt.value} value={opt.value} className="text-xs">{opt.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      ))}
                    </div>

                    <Button
                      className="w-full gap-2"
                      disabled={saveSyncMutation.isPending}
                      onClick={() => saveSyncMutation.mutate({ sheetUrl, columnOffset: 1, mapping })}
                    >
                      <FileSpreadsheet className="h-4 w-4" />
                      {saveSyncMutation.isPending ? "저장 중..." : "동기화 설정 저장 (자동 활성화)"}
                    </Button>
                  </>
                )}
              </>
            )}
          </CardContent>
        )}
      </Card>

      {/* ── 미배정 매출 건 (revenue_entries.trainerId NULL) ── */}
      {unassignedRevenue && unassignedRevenue.length > 0 && (
        <Card className="bg-card border-orange-500/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4 text-orange-400" />
              <span className="text-orange-400">트레이너 미배정 매출</span>
              <span className="ml-auto text-xs font-normal text-muted-foreground">{unassignedRevenue.length}건</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {unassignedRevenue.map((r) => (
              <div key={r.id} className="p-3 rounded-lg bg-orange-500/5 border border-orange-500/20 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-sm">{r.customerName ?? "-"}</p>
                    <p className="text-xs text-muted-foreground">
                      {r.type} · {r.subType}
                      {r.programDetail && ` · ${r.programDetail}`}
                      {r.sessions ? ` · ${r.sessions}회` : ""}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {r.paymentDate} · {r.paidAmount?.toLocaleString()}원
                    </p>
                  </div>
                </div>
                {assigningRevenueId === r.id ? (
                  <div className="flex gap-2">
                    <Select value={assignRevenueTrainerId} onValueChange={setAssignRevenueTrainerId}>
                      <SelectTrigger className="h-8 text-xs flex-1">
                        <SelectValue placeholder="트레이너 선택" />
                      </SelectTrigger>
                      <SelectContent>
                        {trainers?.map((t) => (
                          <SelectItem key={t.id} value={String(t.id)} className="text-xs">{t.trainerName}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      size="sm"
                      disabled={!assignRevenueTrainerId || assignTrainerToRevenueMutation.isPending}
                      onClick={() => assignTrainerToRevenueMutation.mutate({ revenueId: r.id, trainerId: parseInt(assignRevenueTrainerId) })}
                    >
                      배정
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => { setAssigningRevenueId(null); setAssignRevenueTrainerId(""); }}>
                      취소
                    </Button>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full text-xs h-7 border-orange-500/30 text-orange-400 hover:bg-orange-500/10"
                    onClick={() => { setAssigningRevenueId(r.id); setAssignRevenueTrainerId(""); }}
                  >
                    트레이너 배정
                  </Button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* ── 실제 미배정 회원 (members 테이블 trainerId NULL) ── */}
      {unassignedMembers && unassignedMembers.length > 0 && (
        <Card className="bg-card border-orange-500/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4 text-orange-400" />
              <span className="text-orange-400">트레이너 미배정 회원</span>
              <span className="ml-auto text-xs font-normal text-muted-foreground">{unassignedMembers.length}명</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {unassignedMembers.map((m) => (
              <div key={m.id} className="p-3 rounded-lg bg-orange-500/5 border border-orange-500/20 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-sm">{m.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {m.phone ?? "연락처 없음"}
                      {m.remainingPt > 0 && ` · 잔여 PT ${m.remainingPt}회`}
                    </p>
                  </div>
                </div>
                {assigningMemberId === m.id ? (
                  <div className="flex gap-2">
                    <Select value={assignMemberTrainerId} onValueChange={setAssignMemberTrainerId}>
                      <SelectTrigger className="h-8 text-xs flex-1">
                        <SelectValue placeholder="트레이너 선택" />
                      </SelectTrigger>
                      <SelectContent>
                        {trainers?.map((t) => (
                          <SelectItem key={t.id} value={String(t.id)} className="text-xs">{t.trainerName}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      size="sm"
                      disabled={!assignMemberTrainerId || assignTrainerToMemberMutation.isPending}
                      onClick={() => assignTrainerToMemberMutation.mutate({ memberId: m.id, trainerId: parseInt(assignMemberTrainerId) })}
                    >
                      배정
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => { setAssigningMemberId(null); setAssignMemberTrainerId(""); }}>
                      취소
                    </Button>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full text-xs h-7 border-orange-500/30 text-orange-400 hover:bg-orange-500/10"
                    onClick={() => { setAssigningMemberId(m.id); setAssignMemberTrainerId(""); }}
                  >
                    트레이너 배정
                  </Button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* ── 미배정 회원 (시트에서 가져온 후 트레이너 미배정) ── */}
      {pendingMembers && pendingMembers.length > 0 && (
        <Card className="bg-card border-orange-500/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4 text-orange-400" />
              <span className="text-orange-400">트레이너 미배정 회원</span>
              <span className="ml-auto text-xs font-normal text-muted-foreground">{pendingMembers.length}명</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {pendingMembers.map((p) => (
              <div key={p.id} className="p-3 rounded-lg bg-orange-500/5 border border-orange-500/20 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-sm">{p.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.phone ?? "연락처 없음"}
                      {p.membershipEnd && ` · 종료 ${p.membershipEnd}`}
                      {p.ptSessions && ` · PT ${p.ptSessions}회`}
                    </p>
                  </div>
                  <button
                    onClick={() => deletePendingMutation.mutate({ id: p.id })}
                    className="text-muted-foreground hover:text-red-400 transition-colors p-1 shrink-0"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>

                {assigningId === p.id ? (
                  <div className="flex gap-2">
                    <Select value={assignTrainerId} onValueChange={setAssignTrainerId}>
                      <SelectTrigger className="h-8 text-xs flex-1">
                        <SelectValue placeholder="트레이너 선택" />
                      </SelectTrigger>
                      <SelectContent>
                        {trainers?.map((t) => (
                          <SelectItem key={t.id} value={String(t.id)} className="text-xs">{t.trainerName}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      size="sm"
                      disabled={!assignTrainerId || assignMutation.isPending}
                      onClick={() => assignMutation.mutate({ pendingId: p.id, trainerId: parseInt(assignTrainerId) })}
                    >
                      배정
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => { setAssigningId(null); setAssignTrainerId(""); }}>
                      취소
                    </Button>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full text-xs h-7 border-orange-500/30 text-orange-400 hover:bg-orange-500/10"
                    onClick={() => { setAssigningId(p.id); setAssignTrainerId(""); }}
                  >
                    트레이너 배정
                  </Button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* ── 지점 미분류 회원 (다중지점 트레이너 소속) ── */}
      {unclassifiedMembers && unclassifiedMembers.length > 0 && (
        <Card className="bg-card border-blue-500/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <MapPin className="h-4 w-4 text-blue-400" />
              <span className="text-blue-400">지점 미분류 회원</span>
              <span className="ml-auto text-xs font-normal text-muted-foreground">{unclassifiedMembers.length}명</span>
            </CardTitle>
            <p className="text-xs text-muted-foreground">담당 트레이너가 여러 지점에 속해 있어 수동으로 지점을 선택해주세요.</p>
          </CardHeader>
          <CardContent className="space-y-2">
            {unclassifiedMembers.map((m) => (
              <div key={m.id} className="p-3 rounded-lg bg-blue-500/5 border border-blue-500/20">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div>
                    <p className="font-medium text-sm">{m.name}</p>
                    <p className="text-xs text-muted-foreground">{m.trainerName} · {m.phone ?? "연락처 없음"}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  {m.availableBranches.map((b) => (
                    <button
                      key={b.id}
                      onClick={() => assignBranchMutation.mutate({ memberId: m.id, branchId: b.id })}
                      className="flex-1 py-1.5 text-xs font-medium rounded-lg border border-blue-500/40 text-blue-400 hover:bg-blue-500/20 transition-colors"
                    >
                      {b.name}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* DB 백업 / 복원 */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Database className="h-4 w-4 text-primary" />
            데이터베이스 관리
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">DB 파일을 다운로드하거나, 기존 백업 파일로 복원할 수 있습니다.</p>
          <div className="flex gap-2">
            {/* 백업 다운로드 */}
            <a href="/api/db-backup" download className="flex-1">
              <button className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-md border border-border bg-accent/20 hover:bg-accent/40 transition-colors text-sm">
                <Download className="h-4 w-4 text-green-400" />
                <span>DB 다운로드</span>
              </button>
            </a>
            {/* 복원 업로드 */}
            <label className="flex-1 cursor-pointer">
              <input
                type="file"
                accept=".db"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  if (!confirm(`"${file.name}" 파일로 DB를 복원하시겠습니까?\n현재 데이터가 모두 교체됩니다.`)) return;
                  setDbRestoring(true);
                  try {
                    const buf = await file.arrayBuffer();
                    const res = await fetch("/api/db-restore", {
                      method: "POST",
                      headers: { "Content-Type": "application/octet-stream" },
                      body: buf,
                      credentials: "include",
                    });
                    const json = await res.json();
                    if (res.ok) {
                      alert("복원 완료! 서버가 재시작됩니다. 잠시 후 새로고침해주세요.");
                    } else {
                      alert("복원 실패: " + json.error);
                      setDbRestoring(false);
                    }
                  } catch {
                    alert("복원 중 오류가 발생했습니다.");
                    setDbRestoring(false);
                  }
                }}
              />
              <div className={`w-full flex items-center justify-center gap-2 py-2 px-3 rounded-md border transition-colors text-sm ${dbRestoring ? "border-orange-500/40 text-orange-400 bg-orange-500/10" : "border-border bg-accent/20 hover:bg-accent/40"}`}>
                <Upload className="h-4 w-4 text-orange-400" />
                <span>{dbRestoring ? "복원 중..." : "DB 복원"}</span>
              </div>
            </label>
          </div>
          <p className="text-xs text-muted-foreground">⚠ DB 복원 시 현재 모든 데이터가 업로드한 파일로 교체됩니다.</p>
        </CardContent>
      </Card>

      {/* 지점 관리 */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="h-4 w-4 text-primary" />
            지점 관리
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input
              placeholder="지점명 (예: 1호점)"
              value={newBranchName}
              onChange={(e) => setNewBranchName(e.target.value)}
              className="h-9 flex-1"
            />
            <Button
              size="sm"
              disabled={!newBranchName.trim() || createBranchMutation.isPending}
              onClick={() => createBranchMutation.mutate({ name: newBranchName.trim() })}
            >
              추가
            </Button>
          </div>
          {branchList && branchList.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {branchList.map((b) => (
                <span key={b.id} className="text-xs bg-blue-500/10 text-blue-400 border border-blue-500/30 px-2.5 py-1 rounded-full">
                  {b.name}
                </span>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 트레이너 목록 */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" />
              트레이너 목록
            </CardTitle>
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
        </CardHeader>
        <CardContent className="space-y-3">
          {/* 지점 필터 탭 */}
          {branchList && branchList.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setTrainerBranchFilter(undefined)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${trainerBranchFilter === undefined ? "bg-primary text-primary-foreground" : "bg-accent/30 text-muted-foreground hover:bg-accent/50"}`}
              >
                전체
              </button>
              {branchList.map((b) => (
                <button
                  key={b.id}
                  onClick={() => setTrainerBranchFilter(b.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${trainerBranchFilter === b.id ? "bg-primary text-primary-foreground" : "bg-accent/30 text-muted-foreground hover:bg-accent/50"}`}
                >
                  {b.name}
                </button>
              ))}
            </div>
          )}
          <div className="space-y-2">
          {(() => {
            const filtered = trainerBranchFilter
              ? (trainers ?? []).filter((t) => t.assignedBranches.some((b) => b.branchId === trainerBranchFilter))
              : (trainers ?? []);
            if (!filtered.length) return (
              <p className="text-sm text-muted-foreground text-center py-6">
                {trainerBranchFilter ? "해당 지점에 배정된 트레이너가 없습니다." : "등록된 트레이너가 없습니다."}
              </p>
            );
            return filtered.map((trainer) => (
              <div
                key={trainer.id}
                className="flex items-center justify-between p-3 rounded-lg bg-accent/20 border border-border"
              >
                <button
                  className="flex items-center gap-3 flex-1 text-left"
                  onClick={() => setLocation(`/trainers/${trainer.id}`)}
                >
                  <div className="h-9 w-9 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm">
                    {trainer.trainerName.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-sm">{trainer.trainerName}</p>
                      {trainer.assignedBranches.map((b) => (
                        <span key={b.branchId} className="text-xs bg-blue-500/10 text-blue-400 border border-blue-500/30 px-1.5 py-0.5 rounded-full">{b.branchName}</span>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      회원 {trainer.memberCount}명 · 정산 {trainer.settlementRate}%
                    </p>
                    <p className="text-xs text-muted-foreground/70">
                      {trainer.lastLoginAt
                        ? `최근 로그인: ${new Date(trainer.lastLoginAt).toLocaleString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}`
                        : "로그인 기록 없음"}
                    </p>
                    <div className="mt-1.5" onClick={(e) => e.stopPropagation()}>
                      <PositionSelect userId={trainer.userId} currentPosition={trainer.position ?? null} />
                    </div>
                    {branchList && branchList.length > 0 && (
                      <div className="flex items-center gap-3 mt-1.5" onClick={(e) => e.stopPropagation()}>
                        {branchList.map((b) => {
                          const checked = trainer.assignedBranches.some((ab) => ab.branchId === b.id);
                          return (
                            <label key={b.id} className="flex items-center gap-1 cursor-pointer select-none" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={checked}
                                className="h-3.5 w-3.5 accent-primary"
                                onChange={(e) => {
                                  e.stopPropagation();
                                  const current = trainer.assignedBranches.map((ab) => ab.branchId);
                                  const next = checked ? current.filter((id) => id !== b.id) : [...current, b.id];
                                  updateTrainerBranchesMutation.mutate({ trainerId: trainer.id, branchIds: next });
                                }}
                              />
                              <span className="text-xs text-muted-foreground">{b.name}</span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </button>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setLocation(`/trainers/${trainer.id}`)}
                    className="text-muted-foreground hover:text-foreground p-1.5 rounded transition-colors"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                  {/* 삭제 확인 */}
                  <Dialog open={deleteId === trainer.id} onOpenChange={(open) => !open && setDeleteId(null)}>
                    <DialogTrigger asChild>
                      <button
                        onClick={() => setDeleteId(trainer.id)}
                        className="text-muted-foreground hover:text-red-400 p-1.5 rounded transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </DialogTrigger>
                    <DialogContent className="max-w-xs">
                      <DialogHeader>
                        <DialogTitle>트레이너 삭제</DialogTitle>
                        <DialogDescription>
                          {trainer.trainerName} 계정을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="flex gap-2">
                        <Button variant="outline" className="flex-1" onClick={() => setDeleteId(null)}>
                          취소
                        </Button>
                        <Button
                          variant="destructive"
                          className="flex-1"
                          disabled={deleteMutation.isPending}
                          onClick={() => deleteMutation.mutate({ trainerId: trainer.id })}
                        >
                          {deleteMutation.isPending ? "삭제 중..." : "삭제"}
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            ));
          })()}
          </div>
        </CardContent>
      </Card>

      {/* 컨설턴트 계정 관리 */}
      {isAdmin && <ConsultantSection />}

      {/* 부관리자 계정 관리 */}
      {isAdmin && <SubAdminSection />}
      </>)}
    </div>
  );
}

function ConsultantSection() {
  const utils = trpc.useUtils();
  const { data: consultants, refetch } = trpc.admin.listConsultants.useQuery();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ username: "", password: "", displayName: "" });

  const createMutation = trpc.admin.createConsultant.useMutation({
    onSuccess: () => { toast.success("컨설턴트 계정이 생성되었습니다."); setShowForm(false); setForm({ username: "", password: "", displayName: "" }); refetch(); },
    onError: (e: any) => toast.error(e.message),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.username || !form.password || !form.displayName) return toast.error("모든 항목을 입력해주세요");
    createMutation.mutate(form);
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">프론트 컨설턴트 계정</CardTitle>
          <button onClick={() => setShowForm(v => !v)} className="flex items-center gap-1.5 bg-primary text-primary-foreground px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-primary/90">
            <UserPlus className="h-3.5 w-3.5" />
            계정 추가
          </button>
        </div>
        <p className="text-xs text-muted-foreground">상담관리 + 오늘 매출 입력/수정만 가능한 직원 계정</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {showForm && (
          <form onSubmit={handleSubmit} className="bg-background border border-border rounded-xl p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">이름 *</label>
                <input value={form.displayName} onChange={e => setForm(f => ({ ...f, displayName: e.target.value }))} placeholder="홍길동"
                  className="w-full mt-1 bg-card border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">아이디 *</label>
                <input value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} placeholder="staff1"
                  className="w-full mt-1 bg-card border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">비밀번호 *</label>
              <input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="6자 이상"
                className="w-full mt-1 bg-card border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setShowForm(false)} className="flex-1 border border-border text-muted-foreground rounded-lg py-2 text-sm hover:bg-accent">취소</button>
              <button type="submit" className="flex-1 bg-primary text-primary-foreground rounded-lg py-2 text-sm font-medium hover:bg-primary/90">생성</button>
            </div>
          </form>
        )}

        {(consultants ?? []).length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">등록된 컨설턴트가 없습니다</p>
        ) : (
          <div className="space-y-2">
            {(consultants ?? []).map((c: any) => (
              <div key={c.id} className="bg-background border border-border rounded-lg px-3 py-2 space-y-1.5">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium text-foreground">{c.username}</span>
                    <span className="text-xs text-muted-foreground ml-2">프론트 컨설턴트</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{c.createdAt?.substring(0, 10)}</span>
                </div>
                <PositionSelect userId={c.id} currentPosition={c.position ?? null} />
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const POSITIONS = ["매니저", "팀장", "시니어", "팀원", "견습", "프리랜서", "컨설턴트"];

function PositionSelect({ userId, currentPosition }: { userId: number; currentPosition: string | null }) {
  const utils = trpc.useUtils();
  const mutation = trpc.admin.updatePosition.useMutation({
    onSuccess: () => {
      utils.admin.listTrainers.invalidate();
      utils.admin.listConsultants.invalidate();
      utils.admin.listSubAdmins.invalidate();
      toast.success("직책이 저장되었습니다");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <select
      value={currentPosition ?? ""}
      onChange={(e) => mutation.mutate({ userId, position: e.target.value || null })}
      className="text-xs bg-accent/30 border border-border rounded-md px-2 py-1 text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
    >
      <option value="">직책 없음</option>
      {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
    </select>
  );
}

function SubAdminSection() {
  const { data: subAdmins, refetch } = trpc.admin.listSubAdmins.useQuery();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ username: "", password: "" });

  const createMutation = trpc.admin.createSubAdmin.useMutation({
    onSuccess: () => { toast.success("부관리자 계정이 생성되었습니다."); setShowForm(false); setForm({ username: "", password: "" }); refetch(); },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = trpc.admin.deleteSubAdmin.useMutation({
    onSuccess: () => { toast.success("부관리자 계정이 삭제되었습니다."); refetch(); },
    onError: (e: any) => toast.error(e.message),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.username.trim() || form.username.trim().length < 3) return toast.error("아이디는 3자 이상이어야 합니다.");
    if (!form.password || form.password.length < 6) return toast.error("비밀번호는 6자 이상이어야 합니다.");
    createMutation.mutate({ username: form.username.trim(), password: form.password });
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">부관리자 계정</CardTitle>
          <button onClick={() => setShowForm(v => !v)} className="flex items-center gap-1.5 bg-primary text-primary-foreground px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-primary/90">
            <UserPlus className="h-3.5 w-3.5" />
            계정 추가
          </button>
        </div>
        <p className="text-xs text-muted-foreground">모든 기능 이용 가능 · 삭제 및 매출 수정/삭제 불가</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {showForm && (
          <form onSubmit={handleSubmit} className="bg-background border border-border rounded-xl p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">아이디 *</label>
                <input value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} placeholder="subadmin1"
                  className="w-full mt-1 bg-card border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">비밀번호 *</label>
                <input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="6자 이상"
                  className="w-full mt-1 bg-card border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
              </div>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setShowForm(false)} className="flex-1 border border-border text-muted-foreground rounded-lg py-2 text-sm hover:bg-accent">취소</button>
              <button type="submit" className="flex-1 bg-primary text-primary-foreground rounded-lg py-2 text-sm font-medium hover:bg-primary/90">생성</button>
            </div>
          </form>
        )}

        {(subAdmins ?? []).length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">등록된 부관리자가 없습니다</p>
        ) : (
          <div className="space-y-2">
            {(subAdmins ?? []).map((s: any) => (
              <div key={s.id} className="bg-background border border-border rounded-lg px-3 py-2 space-y-1.5">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium text-foreground">{s.username}</span>
                    <span className="text-xs text-muted-foreground ml-2">부관리자</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{s.createdAt?.substring(0, 10)}</span>
                    <button onClick={() => { if (confirm(`${s.username} 계정을 삭제하시겠습니까?`)) deleteMutation.mutate({ userId: s.id }); }}
                      className="text-red-400 hover:text-red-300 p-1 rounded hover:bg-red-500/10 transition-colors">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <PositionSelect userId={s.id} currentPosition={s.position ?? null} />
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── 업무 관리 ──────────────────────────────────────────────────────────────────
const WORK_CATEGORIES = ["상담", "수업", "회원관리", "청소/정리", "마케팅", "매출/등록", "교육", "기타"];

function WorkManagementSection() {
  const utils = trpc.useUtils();
  const { data: staffList } = trpc.gym.work.tasks.listStaff.useQuery();
  const { data: overview } = trpc.gym.work.tasks.staffOverview.useQuery();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    title: "", category: "기타", priority: "normal",
    taskType: "daily", isRecurring: 0, assigneeId: "",
    taskDate: new Date().toISOString().substring(0, 10), dueTime: "",
  });

  const createMutation = trpc.gym.work.tasks.create.useMutation({
    onSuccess: () => {
      toast.success("업무가 추가되었습니다");
      utils.gym.work.tasks.invalidate();
      setShowAdd(false);
      setForm({ title: "", category: "기타", priority: "normal", taskType: "daily", isRecurring: 0, assigneeId: "", taskDate: new Date().toISOString().substring(0, 10), dueTime: "" });
    },
    onError: (e) => toast.error(e.message),
  });

  const createForGroupMutation = trpc.gym.work.tasks.createForGroup.useMutation({
    onSuccess: (data) => {
      toast.success(`업무가 ${data.count}명에게 할당되었습니다`);
      utils.gym.work.tasks.invalidate();
      setShowAdd(false);
      setForm({ title: "", category: "기타", priority: "normal", taskType: "daily", isRecurring: 0, assigneeId: "", taskDate: new Date().toISOString().substring(0, 10), dueTime: "" });
    },
    onError: (e) => toast.error(e.message),
  });

  function handleAdd() {
    if (!form.title.trim()) return toast.error("업무 제목을 입력해주세요");
    if (!form.assigneeId) return toast.error("담당자를 선택해주세요");
    const base = {
      title: form.title.trim(), category: form.category, priority: form.priority,
      taskType: form.taskType, isRecurring: form.isRecurring,
      taskDate: form.isRecurring ? undefined : form.taskDate,
      dueTime: form.dueTime || undefined,
    };
    if (form.assigneeId === "all" || form.assigneeId === "trainer" || form.assigneeId === "consultant") {
      createForGroupMutation.mutate({ ...base, assigneeGroup: form.assigneeId as "all" | "trainer" | "consultant" });
    } else {
      createMutation.mutate({ ...base, assigneeId: parseInt(form.assigneeId) });
    }
  }

  const staff = (staffList ?? []).filter((s: any) => s.role !== "admin");

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-primary" />업무 관리
          </CardTitle>
          <button onClick={() => setShowAdd(v => !v)}
            className="flex items-center gap-1.5 bg-primary text-primary-foreground px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-primary/90">
            <Plus className="h-3.5 w-3.5" />업무 추가
          </button>
        </div>
        <p className="text-xs text-muted-foreground">직원 업무 할당 및 오늘 완료 현황</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {showAdd && (
          <div className="bg-background border border-border rounded-xl p-4 space-y-3">
            <div>
              <label className="text-xs text-muted-foreground">업무 제목 *</label>
              <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="업무 내용을 입력하세요"
                className="w-full mt-1 bg-card border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">담당자 *</label>
                <select value={form.assigneeId} onChange={e => setForm(f => ({ ...f, assigneeId: e.target.value }))}
                  className="w-full mt-1 bg-card border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary">
                  <option value="">선택</option>
                  <optgroup label="── 그룹 할당 ──">
                    <option value="all">전체 직원</option>
                    <option value="trainer">트레이너 전체</option>
                    <option value="consultant">컨설턴트 전체</option>
                  </optgroup>
                  <optgroup label="── 개인 ──">
                    {staff.map((s: any) => <option key={s.id} value={s.id}>{s.username} ({s.role === "trainer" ? "트레이너" : "컨설턴트"})</option>)}
                  </optgroup>
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">카테고리</label>
                <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                  className="w-full mt-1 bg-card border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary">
                  {WORK_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {(["daily", "weekly", "monthly"] as const).map(t => (
                <button key={t} type="button" onClick={() => setForm(f => ({ ...f, taskType: t }))}
                  className={`py-1.5 rounded-lg text-xs font-medium transition-colors ${form.taskType === t ? "bg-primary text-primary-foreground" : "bg-accent text-muted-foreground"}`}>
                  {t === "daily" ? "일일" : t === "weekly" ? "주간" : "월간"}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.isRecurring === 1} onChange={e => setForm(f => ({ ...f, isRecurring: e.target.checked ? 1 : 0 }))} />
                <span className="text-xs text-muted-foreground">반복 업무</span>
              </label>
              {!form.isRecurring && (
                <input type="date" value={form.taskDate} onChange={e => setForm(f => ({ ...f, taskDate: e.target.value }))}
                  className="flex-1 bg-card border border-border rounded-lg px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
              )}
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setShowAdd(false)} className="flex-1 border border-border text-muted-foreground rounded-lg py-2 text-sm hover:bg-accent">취소</button>
              <button type="button" onClick={handleAdd} className="flex-1 bg-primary text-primary-foreground rounded-lg py-2 text-sm font-medium hover:bg-primary/90">추가</button>
            </div>
          </div>
        )}

        {(overview ?? []).length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground font-medium">오늘 완료 현황</p>
            {(overview ?? []).map((s: any) => (
              <div key={s.assigneeId} className="flex items-center justify-between bg-background border border-border rounded-lg px-3 py-2">
                <span className="text-sm text-foreground">{s.name}</span>
                <div className="flex items-center gap-2">
                  <div className="w-20 h-1.5 bg-border rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${s.rate}%` }} />
                  </div>
                  <span className="text-xs text-muted-foreground">{s.todayDone}/{s.todayTotal}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {(overview ?? []).length === 0 && !showAdd && (
          <p className="text-xs text-muted-foreground text-center py-4">오늘 할당된 업무가 없습니다</p>
        )}
      </CardContent>
    </Card>
  );
}

// ── 공지 확인자 패널 ────────────────────────────────────────────────────────────
function NoticeReadPanel({ noticeId }: { noticeId: number }) {
  const { data, isLoading } = trpc.gym.work.notices.readStatus.useQuery({ noticeId });

  if (isLoading) return <div className="text-xs text-muted-foreground py-2 text-center">로딩 중...</div>;

  const { readers = [], nonReaders = [] } = data ?? {};
  const total = readers.length + nonReaders.length;

  return (
    <div className="mt-2 border-t border-border/50 pt-2 space-y-2">
      <div className="flex items-center gap-3 text-xs">
        <span className="flex items-center gap-1 text-emerald-400 font-semibold">
          <CheckCircle2 className="h-3.5 w-3.5" />확인 {readers.length}명
        </span>
        {nonReaders.length > 0 && (
          <span className="flex items-center gap-1 text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />미확인 {nonReaders.length}명
          </span>
        )}
        {total > 0 && (
          <span className="ml-auto text-muted-foreground">전체 {total}명</span>
        )}
      </div>

      {readers.length > 0 && (
        <div className="space-y-1">
          {readers.map(r => (
            <div key={r.userId} className="flex items-center justify-between text-xs bg-emerald-500/5 border border-emerald-500/20 rounded px-2 py-1">
              <span className="text-emerald-400 font-medium">{r.username}</span>
              <span className="text-muted-foreground">{r.readAt?.substring(0, 16).replace("T", " ")}</span>
            </div>
          ))}
        </div>
      )}

      {nonReaders.length > 0 && (
        <div className="space-y-1">
          {nonReaders.map(r => (
            <div key={r.userId} className="flex items-center text-xs bg-muted/30 rounded px-2 py-1">
              <Clock className="h-3 w-3 text-muted-foreground mr-1.5" />
              <span className="text-muted-foreground">{r.username}</span>
              <span className="ml-auto text-xs text-muted-foreground/60">미확인</span>
            </div>
          ))}
        </div>
      )}

      {total === 0 && (
        <p className="text-xs text-muted-foreground text-center py-1">확인한 직원이 없습니다</p>
      )}
    </div>
  );
}

// ── 공지사항 관리 ──────────────────────────────────────────────────────────────
function NoticeManagementSection() {
  const utils = trpc.useUtils();
  const { data: noticeList } = trpc.gym.work.notices.list.useQuery();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ title: "", content: "", targetRole: "all", priority: "normal" });
  const [expandedReaders, setExpandedReaders] = useState<Set<number>>(new Set());
  const [expandedNotices, setExpandedNotices] = useState<Set<number>>(new Set());

  function toggleNotice(id: number) {
    setExpandedNotices(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  const createMutation = trpc.gym.work.notices.create.useMutation({
    onSuccess: () => {
      toast.success("공지사항이 등록되었습니다");
      utils.gym.work.notices.invalidate();
      setShowAdd(false);
      setForm({ title: "", content: "", targetRole: "all", priority: "normal" });
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = trpc.gym.work.notices.delete.useMutation({
    onSuccess: () => { toast.success("삭제되었습니다"); utils.gym.work.notices.invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  const PRIORITY_STYLE: Record<string, string> = {
    urgent: "bg-red-500/20 text-red-400 border border-red-500/30",
    important: "bg-amber-500/20 text-amber-400 border border-amber-500/30",
    normal: "bg-blue-500/20 text-blue-400 border border-blue-500/30",
  };
  const PRIORITY_LABEL: Record<string, string> = { urgent: "긴급", important: "중요", normal: "일반" };
  const ROLE_LABEL: Record<string, string> = { all: "전체", trainer: "트레이너", consultant: "컨설턴트" };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Bell className="h-4 w-4 text-primary" />공지사항 관리
          </CardTitle>
          <button onClick={() => setShowAdd(v => !v)}
            className="flex items-center gap-1.5 bg-primary text-primary-foreground px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-primary/90">
            <Plus className="h-3.5 w-3.5" />공지 작성
          </button>
        </div>
        <p className="text-xs text-muted-foreground">트레이너·컨설턴트 공지사항 등록 및 관리</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {showAdd && (
          <div className="bg-background border border-border rounded-xl p-4 space-y-3">
            <div>
              <label className="text-xs text-muted-foreground">제목 *</label>
              <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="공지 제목"
                className="w-full mt-1 bg-card border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">내용 *</label>
              <textarea value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} placeholder="공지 내용을 입력하세요" rows={3}
                className="w-full mt-1 bg-card border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">대상</label>
                <select value={form.targetRole} onChange={e => setForm(f => ({ ...f, targetRole: e.target.value }))}
                  className="w-full mt-1 bg-card border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary">
                  <option value="all">전체</option>
                  <option value="trainer">트레이너만</option>
                  <option value="consultant">컨설턴트만</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">중요도</label>
                <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}
                  className="w-full mt-1 bg-card border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary">
                  <option value="normal">일반</option>
                  <option value="important">중요</option>
                  <option value="urgent">긴급</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setShowAdd(false)} className="flex-1 border border-border text-muted-foreground rounded-lg py-2 text-sm hover:bg-accent">취소</button>
              <button type="button"
                onClick={() => { if (!form.title.trim() || !form.content.trim()) return toast.error("제목과 내용을 입력해주세요"); createMutation.mutate(form); }}
                className="flex-1 bg-primary text-primary-foreground rounded-lg py-2 text-sm font-medium hover:bg-primary/90">등록</button>
            </div>
          </div>
        )}

        {(noticeList ?? []).length === 0 && !showAdd ? (
          <p className="text-xs text-muted-foreground text-center py-4">등록된 공지사항이 없습니다</p>
        ) : (
          <div className="space-y-2">
            {(noticeList ?? []).map((n: any) => {
              const isOpen = expandedNotices.has(n.notice.id);
              return (
              <div key={n.notice.id} className="bg-background border border-border rounded-lg px-3 py-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0 cursor-pointer" onClick={() => toggleNotice(n.notice.id)}>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${PRIORITY_STYLE[n.notice.priority]}`}>
                        {PRIORITY_LABEL[n.notice.priority]}
                      </span>
                      <span className="text-xs text-muted-foreground border border-border px-1.5 py-0.5 rounded-full">
                        {ROLE_LABEL[n.notice.targetRole] ?? n.notice.targetRole}
                      </span>
                    </div>
                    <p className={`text-sm font-medium text-foreground mt-1 ${isOpen ? "" : "truncate"}`}>{n.notice.title}</p>
                    <p className={`text-xs text-muted-foreground mt-0.5 whitespace-pre-wrap ${isOpen ? "" : "line-clamp-2"}`}>{n.notice.content}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-muted-foreground">{n.notice.createdAt?.substring(0, 10)}</span>
                      <span className="text-xs text-primary">{isOpen ? "▲ 접기" : "▼ 더 보기"}</span>
                    </div>
                  </div>
                  <button onClick={() => { if (confirm("공지를 삭제하시겠습니까?")) deleteMutation.mutate({ id: n.notice.id }); }}
                    className="text-red-400 hover:text-red-300 p-1 rounded hover:bg-red-500/10 transition-colors shrink-0">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                {/* 확인자 토글 버튼 */}
                <button
                  onClick={() => setExpandedReaders(prev => {
                    const next = new Set(prev);
                    next.has(n.notice.id) ? next.delete(n.notice.id) : next.add(n.notice.id);
                    return next;
                  })}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mt-1.5 transition-colors"
                >
                  <CheckCircle2 className="h-3 w-3" />
                  확인자 보기
                  {expandedReaders.has(n.notice.id) ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                </button>
                {expandedReaders.has(n.notice.id) && <NoticeReadPanel noticeId={n.notice.id} />}
              </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
