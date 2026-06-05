import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Coins, Clock, CheckCircle, XCircle, Copy, Check, ChevronDown } from "lucide-react";
import TabBanner from "@/components/TabBanner";

const TYPE_LABEL: Record<string, string> = {
  admin_grant: "관리자 지급",
  charge_request: "충전 신청",
  daily_reset: "일일 초기화 (300P)",
  usage: "사용",
  profile_bonus: "프로필 완성 보너스",
  referral_bonus: "친구 초대 보너스",
  academy_complete: "아카데미 강의 완료 보상",
};

const STATUS_ICON: Record<string, React.ReactNode> = {
  completed: <CheckCircle className="h-3.5 w-3.5 text-green-400 shrink-0" />,
  pending: <Clock className="h-3.5 w-3.5 text-yellow-400 shrink-0" />,
  rejected: <XCircle className="h-3.5 w-3.5 text-red-400 shrink-0" />,
};

const STATUS_TEXT: Record<string, string> = {
  completed: "완료",
  pending: "대기",
  rejected: "거절",
};

const CHARGE_PACKAGES = [
  { krw: 10000,  points: 10000, bonus: 0 },
  { krw: 30000,  points: 35000, bonus: 5000 },
  { krw: 50000,  points: 70000, bonus: 20000 },
  { krw: 100000, points: 130000, bonus: 30000 },
];

const KAKAO_ACCOUNT = "3333-37-4826334";
const KAKAO_HOLDER  = "피트니스텝";

export default function FitPoints() {
  const utils = trpc.useUtils();
  const { data: balanceData } = trpc.fitPoints.getBalance.useQuery();
  const { data: history } = trpc.fitPoints.getHistory.useQuery();

  const [showForm, setShowForm] = useState(false);
  const [selectedPkg, setSelectedPkg] = useState<typeof CHARGE_PACKAGES[number] | null>(null);
  const [depositor, setDepositor] = useState("");
  const [copied, setCopied] = useState(false);

  const requestCharge = trpc.fitPoints.requestCharge.useMutation({
    onSuccess: () => {
      toast.success("충전 신청이 완료되었습니다. 관리자 확인 후 포인트가 지급됩니다.");
      setSelectedPkg(null);
      setDepositor("");
      setShowForm(false);
      utils.fitPoints.getHistory.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const balance = balanceData?.balance ?? 0;

  function handleCopy() {
    navigator.clipboard.writeText(KAKAO_ACCOUNT.replace(/-/g, ""));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleSubmit() {
    if (!selectedPkg) { toast.error("충전 패키지를 선택해주세요."); return; }
    if (!depositor.trim()) { toast.error("입금자명을 입력해주세요."); return; }
    const memo = `${selectedPkg.krw.toLocaleString()}원 입금 | 입금자: ${depositor.trim()}`;
    requestCharge.mutate({ amount: selectedPkg.points, memo });
  }

  return (
    <div className="space-y-4">
      <TabBanner tabKey="fitpoints" />

      <div>
        <h1 className="text-xl font-bold">FIT POINT</h1>
        <p className="text-sm text-muted-foreground mt-0.5">포인트 잔액 및 내역</p>
      </div>

      {/* 잔액 카드 */}
      <Card className="bg-primary/10 border-primary/30">
        <CardContent className="p-6 flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center shrink-0">
            <Coins className="h-7 w-7 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground mb-1">보유 FIT POINT</p>
            <p className="text-3xl font-black text-primary tracking-tight">
              {balance.toLocaleString()} <span className="text-base font-semibold">P</span>
            </p>
          </div>
          {!showForm && (
            <button onClick={() => setShowForm(true)}
              className="shrink-0 text-xs text-primary font-semibold bg-primary/20 px-3 py-1.5 rounded-lg hover:bg-primary/30 transition-colors">
              충전하기
            </button>
          )}
        </CardContent>
      </Card>

      {/* 충전 패널 */}
      {showForm && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">포인트 충전</CardTitle>
              <button onClick={() => { setShowForm(false); setSelectedPkg(null); setDepositor(""); }}
                className="text-xs text-muted-foreground hover:text-foreground">닫기</button>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* 패키지 선택 */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground">충전 패키지 선택</p>
              <div className="grid grid-cols-2 gap-2">
                {CHARGE_PACKAGES.map(pkg => {
                  const isSelected = selectedPkg?.krw === pkg.krw;
                  return (
                    <button key={pkg.krw} onClick={() => setSelectedPkg(pkg)}
                      className={`relative rounded-2xl border-2 p-3 text-left transition-all ${
                        isSelected
                          ? "border-primary bg-primary/10"
                          : "border-border bg-card hover:border-primary/40"
                      }`}>
                      {pkg.bonus > 0 && (
                        <span className="absolute top-2 right-2 text-[9px] font-bold bg-amber-400 text-white px-1.5 py-0.5 rounded-full">
                          +{(pkg.bonus / 1000).toFixed(0)}천P
                        </span>
                      )}
                      <p className="text-xs text-muted-foreground">{pkg.krw.toLocaleString()}원</p>
                      <p className={`text-base font-black mt-0.5 ${isSelected ? "text-primary" : "text-foreground"}`}>
                        {pkg.points.toLocaleString()} P
                      </p>
                      {pkg.bonus > 0 && (
                        <p className="text-[10px] text-amber-500 font-semibold mt-0.5">
                          보너스 {pkg.bonus.toLocaleString()}P 포함
                        </p>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 계좌 안내 */}
            <div className="rounded-2xl bg-yellow-50 border border-yellow-200 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-yellow-400 flex items-center justify-center shrink-0">
                  <span className="text-[10px] font-black text-white">K</span>
                </div>
                <p className="text-xs font-semibold text-yellow-800">카카오뱅크 입금 계좌</p>
              </div>
              <div className="flex items-center justify-between bg-white rounded-xl border border-yellow-200 px-3 py-2.5">
                <div>
                  <p className="text-base font-black text-gray-800 tracking-wider">{KAKAO_ACCOUNT}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{KAKAO_HOLDER}</p>
                </div>
                <button onClick={handleCopy}
                  className="flex items-center gap-1 text-xs font-semibold text-yellow-700 bg-yellow-100 hover:bg-yellow-200 px-2.5 py-1.5 rounded-lg transition-colors">
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? "복사됨" : "복사"}
                </button>
              </div>
              {selectedPkg && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-yellow-700">입금 금액</span>
                  <span className="font-black text-yellow-900">{selectedPkg.krw.toLocaleString()}원</span>
                </div>
              )}
            </div>

            {/* 입금자명 */}
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-muted-foreground">입금자명 (실제 입금 시 표시되는 이름)</p>
              <Input
                placeholder="입금자명 입력"
                value={depositor}
                onChange={e => setDepositor(e.target.value)}
                className="h-10 text-sm"
              />
            </div>

            <Button className="w-full" size="sm"
              disabled={!selectedPkg || !depositor.trim() || requestCharge.isPending}
              onClick={handleSubmit}>
              {requestCharge.isPending ? "신청 중..." : `신청하기${selectedPkg ? ` — ${selectedPkg.points.toLocaleString()}P` : ""}`}
            </Button>

            <p className="text-[11px] text-muted-foreground text-center leading-relaxed">
              입금 확인 후 관리자가 포인트를 지급합니다 (보통 1시간 이내)
            </p>
          </CardContent>
        </Card>
      )}

      {/* 내역 */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">포인트 내역</CardTitle>
        </CardHeader>
        <CardContent className="space-y-0 p-0">
          {!history || history.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">내역이 없습니다.</p>
          ) : (
            history.filter(l => l.type !== "daily_reset").map((log, i, arr) => (
              <div key={log.id}
                className={`flex items-center gap-3 px-4 py-3 ${i < arr.length - 1 ? "border-b border-border/50" : ""}`}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    {STATUS_ICON[log.status]}
                    <span className="text-sm font-medium">{TYPE_LABEL[log.type] ?? log.type}</span>
                    <span className="text-xs text-muted-foreground">· {STATUS_TEXT[log.status]}</span>
                  </div>
                  {log.memo && <p className="text-xs text-muted-foreground mt-0.5 truncate">{log.memo}</p>}
                  <p className="text-xs text-muted-foreground mt-0.5">{log.createdAt.slice(0, 10)}</p>
                </div>
                <span className={`text-sm font-bold shrink-0 ${log.amount > 0 ? "text-green-400" : "text-red-400"}`}>
                  {log.amount > 0 ? "+" : ""}{log.amount.toLocaleString()} P
                </span>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
