import { useState } from "react";
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
import { UserPlus, Trash2, Users, ChevronRight, FileSpreadsheet, ChevronDown, ChevronUp } from "lucide-react";

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
  const utils = trpc.useUtils();

  const [createOpen, setCreateOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [form, setForm] = useState({
    username: "",
    password: "",
    trainerName: "",
    phone: "",
    email: "",
    settlementRate: "50",
  });

  // 구글시트 가져오기 상태
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetUrl, setSheetUrl] = useState("");
  const [sheetPreview, setSheetPreview] = useState<{
    headers: string[];
    sampleRows: string[][];
    totalRows: number;
  } | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [importTrainerId, setImportTrainerId] = useState("");
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number } | null>(null);

  const previewMutation = trpc.admin.previewSheet.useMutation({
    onSuccess: (data) => {
      setSheetPreview(data);
      setImportResult(null);
      // 자동 컬럼 매핑
      const autoMap: Record<string, string> = {};
      data.headers.forEach((h) => {
        const key = h.trim();
        autoMap[key] = AUTO_GUESS[key] ?? "skip";
      });
      setMapping(autoMap);
    },
    onError: (err) => toast.error(err.message || "시트 불러오기 실패"),
  });

  const importMutation = trpc.admin.importFromSheet.useMutation({
    onSuccess: (data) => {
      setImportResult(data);
      toast.success(`${data.imported}명 등록 완료${data.skipped ? ` (${data.skipped}명 건너뜀)` : ""}`);
      utils.members.list.invalidate();
    },
    onError: (err) => toast.error(err.message || "가져오기 실패"),
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

      {/* 구글시트 가져오기 */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <button
            className="flex items-center justify-between w-full"
            onClick={() => { setSheetOpen((v) => !v); setSheetPreview(null); setImportResult(null); }}
          >
            <CardTitle className="text-base flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4 text-green-400" />
              구글시트에서 회원 가져오기
            </CardTitle>
            {sheetOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </button>
        </CardHeader>

        {sheetOpen && (
          <CardContent className="space-y-4">
            {/* URL 입력 */}
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
                  onClick={() => previewMutation.mutate({ sheetUrl })}
                  disabled={!sheetUrl.trim() || previewMutation.isPending}
                >
                  {previewMutation.isPending ? "불러오는 중..." : "미리보기"}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">시트가 "링크가 있는 모든 사용자" 공개 설정이어야 합니다.</p>
            </div>

            {/* 미리보기 테이블 */}
            {sheetPreview && (
              <>
                <div className="space-y-1.5">
                  <p className="text-xs text-muted-foreground">총 {sheetPreview.totalRows}행 감지됨 · 미리보기 (최대 3행)</p>
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

                {/* 컬럼 매핑 */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium">컬럼 매핑 (각 컬럼을 앱 필드에 연결하세요)</Label>
                  <div className="space-y-2">
                    {sheetPreview.headers.map((header) => (
                      <div key={header} className="flex items-center gap-2">
                        <span className="text-xs text-foreground/70 w-28 shrink-0 truncate">{header}</span>
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
                              <SelectItem key={opt.value} value={opt.value} className="text-xs">
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 담당 트레이너 선택 */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">담당 트레이너 <span className="text-primary">*</span></Label>
                  <Select value={importTrainerId} onValueChange={setImportTrainerId}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="트레이너 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      {trainers?.map((t) => (
                        <SelectItem key={t.id} value={String(t.id)}>{t.trainerName}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* 결과 표시 */}
                {importResult && (
                  <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/30 text-sm text-green-400">
                    ✓ {importResult.imported}명 등록 완료
                    {importResult.skipped > 0 && ` · ${importResult.skipped}명 건너뜀 (이름 없음)`}
                  </div>
                )}

                <Button
                  className="w-full gap-2"
                  disabled={!importTrainerId || importMutation.isPending}
                  onClick={() =>
                    importMutation.mutate({
                      sheetUrl,
                      trainerId: parseInt(importTrainerId),
                      mapping,
                    })
                  }
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  {importMutation.isPending ? "가져오는 중..." : `${sheetPreview.totalRows}명 가져오기`}
                </Button>
              </>
            )}
          </CardContent>
        )}
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
