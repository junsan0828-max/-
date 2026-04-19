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
import { UserPlus, Trash2, Users, ChevronRight, FileSpreadsheet, ChevronDown, ChevronUp, Download, Upload, Database } from "lucide-react";

const FIELD_OPTIONS = [
  { value: "skip", label: "건너뛰기" },
  { value: "name", label: "이름 *" },
  { value: "phone", label: "연락처" },
  { value: "email", label: "이메일" },
  { value: "birthDate", label: "생년월일 (YYYY-MM-DD)" },
  { value: "gender", label: "성별 (male/female)" },
  { value: "grade", label: "등급 (basic/premium/vip)" },
  { value: "status", label: "상태 (active/paused)" },
  { value: "membershipStart", label: "회원권 시작일" },
  { value: "membershipEnd", label: "회원권 만료일" },
  { value: "profileNote", label: "특이사항" },
  { value: "ptProgram", label: "PT 패키지명" },
  { value: "ptSessions", label: "PT 횟수" },
  { value: "paymentAmount", label: "결제 금액" },
  { value: "unpaidAmount", label: "미수금" },
  { value: "paymentMethod", label: "결제방법" },
];

const AUTO_GUESS: Record<string, string> = {
  이름: "name", 성명: "name", name: "name",
  연락처: "phone", 전화번호: "phone", 휴대폰: "phone", 핸드폰: "phone", phone: "phone",
  이메일: "email", email: "email",
  생년월일: "birthDate", 생일: "birthDate",
  성별: "gender", gender: "gender",
  등급: "grade", grade: "grade",
  상태: "status", status: "status",
  시작일: "membershipStart", 등록일: "membershipStart", 가입일: "membershipStart",
  만료일: "membershipEnd", 종료일: "membershipEnd",
  특이사항: "profileNote", 메모: "profileNote", 비고: "profileNote",
  패키지: "ptProgram", PT프로그램: "ptProgram", 프로그램: "ptProgram", "PT 프로그램": "ptProgram",
  횟수: "ptSessions", PT횟수: "ptSessions", "PT 횟수": "ptSessions", 세션: "ptSessions",
  결제금액: "paymentAmount", 금액: "paymentAmount", "결제 금액": "paymentAmount",
  미수금: "unpaidAmount",
  결제방법: "paymentMethod", "결제 방법": "paymentMethod",
};

export default function Admin() {
  const [, setLocation] = useLocation();
  const { data: user } = trpc.auth.me.useQuery();
  const { data: trainers, refetch } = trpc.admin.listTrainers.useQuery();
  const { data: syncConfig, refetch: refetchConfig } = trpc.admin.getSyncConfig.useQuery();
  const { data: pendingMembers, refetch: refetchPending } = trpc.admin.listPending.useQuery();
  const utils = trpc.useUtils();

  const [createOpen, setCreateOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [dbRestoring, setDbRestoring] = useState(false);
  const [form, setForm] = useState({
    username: "",
    password: "",
    trainerName: "",
    phone: "",
    email: "",
    settlementRate: "50",
  });

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

  // 관리자 권한 확인
  if (user?.role !== "admin") {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>관리자만 접근할 수 있습니다.</p>
      </div>
    );
  }

  const createMutation = trpc.admin.createTrainer.useMutation({
    onSuccess: () => {
      toast.success("트레이너 계정이 생성되었습니다.");
      setCreateOpen(false);
      setForm({ username: "", password: "", trainerName: "", phone: "", email: "", settlementRate: "50" });
      refetch();
    },
    onError: (err) => toast.error(err.message || "생성 실패"),
  });

  const deleteMutation = trpc.admin.deleteTrainer.useMutation({
    onSuccess: () => {
      toast.success("트레이너가 삭제되었습니다.");
      setDeleteId(null);
      refetch();
    },
    onError: (err) => toast.error(err.message || "삭제 실패"),
  });

  const handleCreate = () => {
    if (!form.username || !form.password || !form.trainerName) {
      toast.error("아이디, 비밀번호, 이름은 필수입니다.");
      return;
    }
    createMutation.mutate({
      username: form.username,
      password: form.password,
      trainerName: form.trainerName,
      phone: form.phone || undefined,
      email: form.email || undefined,
      settlementRate: parseInt(form.settlementRate) || 50,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">관리자 설정</h1>
          <p className="text-sm text-muted-foreground mt-0.5">트레이너 계정 관리</p>
        </div>

        {/* 트레이너 생성 다이얼로그 */}
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
                <Input
                  placeholder="김트레이너"
                  value={form.trainerName}
                  onChange={(e) => setForm((p) => ({ ...p, trainerName: e.target.value }))}
                  className="h-9"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">아이디 <span className="text-primary">*</span></Label>
                  <Input
                    placeholder="trainer2"
                    value={form.username}
                    onChange={(e) => setForm((p) => ({ ...p, username: e.target.value }))}
                    className="h-9"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">비밀번호 <span className="text-primary">*</span></Label>
                  <Input
                    type="password"
                    placeholder="6자 이상"
                    value={form.password}
                    onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                    className="h-9"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">연락처</Label>
                <Input
                  placeholder="010-0000-0000"
                  value={form.phone}
                  onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">이메일</Label>
                <Input
                  type="email"
                  placeholder="trainer@example.com"
                  value={form.email}
                  onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">정산 비율 (%)</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={form.settlementRate}
                    onChange={(e) => setForm((p) => ({ ...p, settlementRate: e.target.value }))}
                    className="h-9"
                  />
                  <span className="text-sm text-muted-foreground">%</span>
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <Button variant="outline" className="flex-1" onClick={() => setCreateOpen(false)}>
                  취소
                </Button>
                <Button className="flex-1" onClick={handleCreate} disabled={createMutation.isPending}>
                  {createMutation.isPending ? "생성 중..." : "생성"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

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
                      {p.membershipEnd && ` · 만료 ${p.membershipEnd}`}
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

      {/* 트레이너 목록 */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" />
            트레이너 목록
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {!trainers?.length ? (
            <p className="text-sm text-muted-foreground text-center py-6">등록된 트레이너가 없습니다.</p>
          ) : (
            trainers.map((trainer) => (
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
                  <div>
                    <p className="font-medium text-sm">{trainer.trainerName}</p>
                    <p className="text-xs text-muted-foreground">
                      회원 {trainer.memberCount}명 · 정산 {trainer.settlementRate}%
                    </p>
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
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
