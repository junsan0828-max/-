import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Download, X, Copy, Check } from "lucide-react";

const PERIOD_PRICES: Record<string, number> = {
  "1개월": 80000,
  "3개월": 159000,
  "6개월": 216000,
  "12개월": 312000,
};

function formatPhone(raw: string) {
  const d = raw.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 7) return `${d.slice(0,3)}-${d.slice(3)}`;
  return `${d.slice(0,3)}-${d.slice(3,7)}-${d.slice(7)}`;
}

function RegistrationModal({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState<"form" | "confirm">("form");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [period, setPeriod] = useState("3개월");
  const [copied, setCopied] = useState(false);
  const [errMsg, setErrMsg] = useState("");

  const { data: bankData } = trpc.gymPlus.getRegistrationBankAccount.useQuery();
  const bankAccount = bankData?.bankAccount || "계좌번호 등록 중 (데스크 문의)";

  const submitMut = trpc.gymPlus.submitRegistrationRequest.useMutation({
    onSuccess: () => setStep("confirm"),
    onError: (e) => setErrMsg(e.message || "신청 실패. 다시 시도해 주세요."),
  });

  const amount = PERIOD_PRICES[period] ?? 0;

  const handleSubmit = () => {
    if (!name.trim()) { setErrMsg("이름을 입력해주세요."); return; }
    if (phone.replace(/\D/g,"").length < 10) { setErrMsg("전화번호를 정확히 입력해주세요."); return; }
    setErrMsg("");
    submitMut.mutate({ name: name.trim(), phone, membershipPeriod: period as any, amount });
  };

  const copyAccount = () => {
    navigator.clipboard.writeText(bankAccount).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-5">
      <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden">
        {/* 헤더 */}
        <div className="bg-[#1D4ED8] px-6 py-5 relative">
          <button onClick={onClose} className="absolute top-4 right-4 text-white/70 hover:text-white">
            <X className="w-5 h-5" />
          </button>
          <p style={{ fontFamily: "'Cormorant Garamond', serif", letterSpacing: "0.12em" }} className="text-white text-lg font-semibold">
            ZIANTGYM<span className="opacity-80">+</span>
          </p>
          <p className="text-white/80 text-sm mt-0.5">회원 등록 신청</p>
        </div>

        {step === "form" ? (
          <div className="p-6 space-y-5">
            {/* 이름 */}
            <div className="space-y-1.5">
              <Label className="text-xs text-gray-500">이름</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="홍길동" className="h-11" />
            </div>
            {/* 전화번호 */}
            <div className="space-y-1.5">
              <Label className="text-xs text-gray-500">연락처</Label>
              <Input type="tel" inputMode="numeric" value={phone} onChange={(e) => setPhone(formatPhone(e.target.value))} placeholder="010-0000-0000" className="h-11" />
            </div>
            {/* 회원권 선택 */}
            <div className="space-y-2">
              <Label className="text-xs text-gray-500">희망 회원권</Label>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(PERIOD_PRICES).map(([p, price]) => (
                  <button
                    key={p}
                    onClick={() => setPeriod(p)}
                    className="rounded-xl border-2 p-3 text-left transition-all"
                    style={{
                      borderColor: period === p ? "#1D4ED8" : "#e5e7eb",
                      background: period === p ? "#eff6ff" : "white",
                    }}
                  >
                    <p className="text-sm font-bold" style={{ color: period === p ? "#1D4ED8" : "#1a2b4b" }}>{p}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{price.toLocaleString()}원</p>
                  </button>
                ))}
              </div>
            </div>
            {errMsg && <p className="text-red-500 text-xs text-center">{errMsg}</p>}
            <Button onClick={handleSubmit} disabled={submitMut.isPending} className="w-full h-11 bg-[#1D4ED8] hover:bg-[#1a43c0]">
              {submitMut.isPending ? "신청 중..." : "신청하기"}
            </Button>
            <p className="text-center text-xs text-gray-400">신청 후 계좌이체로 결제 완료 시 계정이 생성됩니다</p>
          </div>
        ) : (
          <div className="p-6 space-y-5">
            {/* 완료 */}
            <div className="text-center space-y-1.5">
              <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center mx-auto">
                <Check className="w-7 h-7 text-green-500" />
              </div>
              <h3 className="text-base font-bold text-[#1a2b4b]">신청이 완료되었습니다</h3>
              <p className="text-sm text-gray-500">아래 계좌로 입금 후 데스크에 확인 요청하시면<br/>계정을 생성해 드립니다.</p>
            </div>
            {/* 입금 정보 */}
            <div className="bg-blue-50 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">입금 계좌</span>
                <button onClick={copyAccount} className="flex items-center gap-1 text-xs text-[#1D4ED8] font-medium">
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? "복사됨" : "복사"}
                </button>
              </div>
              <p className="text-sm font-bold text-[#1a2b4b]">{bankAccount}</p>
              <div className="border-t border-blue-100 pt-3 flex justify-between items-center">
                <span className="text-xs text-gray-500">입금 금액</span>
                <span className="text-base font-bold text-[#1D4ED8]">{amount.toLocaleString()}원</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-500">입금자명</span>
                <span className="text-sm font-medium text-[#1a2b4b]">{name}</span>
              </div>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 text-xs text-gray-500 text-center">
              입금 확인 후 문자로 안내해 드립니다<br/>
              문의: 헬스장 데스크
            </div>
            <Button onClick={onClose} variant="outline" className="w-full h-11">닫기</Button>
          </div>
        )}
      </div>
    </div>
  );
}

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function useInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;
    if (isStandalone) {
      setIsInstalled(true);
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);

    const installedHandler = () => setIsInstalled(true);
    window.addEventListener("appinstalled", installedHandler);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", installedHandler);
    };
  }, []);

  const install = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") setIsInstalled(true);
    setDeferredPrompt(null);
  };

  return { canInstall: !!deferredPrompt && !isInstalled, install, isInstalled };
}

function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
}

function InstallBanner() {
  const { canInstall, install, isInstalled } = useInstallPrompt();
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem("install-dismissed")) setDismissed(true);
  }, []);

  if (isInstalled || dismissed) return null;

  const handleDismiss = () => {
    setDismissed(true);
    sessionStorage.setItem("install-dismissed", "1");
  };

  // Android / Chrome — 네이티브 설치 프롬프트
  if (canInstall) {
    return (
      <div className="w-full bg-primary/10 border border-primary/20 rounded-xl p-4 mb-6 relative">
        <button onClick={handleDismiss} className="absolute top-2 right-2 text-muted-foreground p-1">
          <X className="w-4 h-4" />
        </button>
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center shrink-0">
            <Download className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="font-semibold text-sm text-foreground">앱 설치하기</p>
            <p className="text-xs text-muted-foreground">홈 화면에 추가하면 더 빠르게 이용할 수 있어요</p>
          </div>
        </div>
        <Button onClick={install} size="sm" className="w-full h-9 text-sm">
          홈 화면에 추가
        </Button>
      </div>
    );
  }

  // iOS — Safari 가이드
  if (isIOS()) {
    return (
      <div className="w-full bg-primary/10 border border-primary/20 rounded-xl p-4 mb-6 relative">
        <button onClick={handleDismiss} className="absolute top-2 right-2 text-muted-foreground p-1">
          <X className="w-4 h-4" />
        </button>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center shrink-0">
            <Download className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="font-semibold text-sm text-foreground">앱처럼 사용하기</p>
            <p className="text-xs text-muted-foreground">홈 화면에 추가하면 앱처럼 사용할 수 있어요</p>
          </div>
        </div>
        {!showIOSGuide ? (
          <Button onClick={() => setShowIOSGuide(true)} variant="outline" size="sm" className="w-full h-9 text-sm mt-1">
            설치 방법 보기
          </Button>
        ) : (
          <div className="mt-3 space-y-2 text-sm text-foreground">
            <p>1. 하단 <span className="inline-flex items-center"><svg className="w-4 h-4 mx-0.5 inline" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 12h16M12 4v16M8 8l4-4 4 4"/></svg></span> (공유) 버튼 탭</p>
            <p>2. <strong>"홈 화면에 추가"</strong> 선택</p>
            <p>3. 우측 상단 <strong>"추가"</strong> 탭</p>
          </div>
        )}
      </div>
    );
  }

  return null;
}

export default function GymPlusLogin() {
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showRegModal, setShowRegModal] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const utils = trpc.useUtils();

  const loginMutation = trpc.gymPlus.memberLogin.useMutation({
    onSuccess: () => {
      utils.gymPlus.memberMe.invalidate();
      window.location.href = "/gym-plus";
    },
    onError: (err) => {
      setErrorMsg(err.message || "로그인 실패. 전화번호 또는 비밀번호를 확인하세요.");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone || !password) {
      setErrorMsg("전화번호와 비밀번호를 입력해주세요.");
      return;
    }
    setErrorMsg("");
    loginMutation.mutate({ username: phone, password });
  };

  return (
    <div className="gymplus-light min-h-screen bg-white flex items-center justify-center p-4" style={{ paddingTop: "env(safe-area-inset-top)" }}>
      <div className="w-full max-w-sm">
        {/* 로고 */}
        <div className="flex flex-col items-center mb-10">
          <p
            style={{ fontFamily: "'Cormorant Garamond', serif", letterSpacing: "0.15em" }}
            className="text-3xl font-semibold text-foreground"
          >
            ZIANTGYM<span className="text-primary">+</span>
          </p>
          <p className="text-muted-foreground text-sm mt-2">회원 전용 서비스</p>
        </div>

        <InstallBanner />

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="phone" className="text-sm text-muted-foreground">핸드폰 번호</Label>
            <Input
              id="phone"
              type="tel"
              inputMode="numeric"
              value={phone}
              onChange={(e) => setPhone(formatPhone(e.target.value))}
              placeholder="010-0000-0000"
              className="bg-input border-border h-11 text-base"
              autoComplete="tel"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-sm text-muted-foreground">
              비밀번호
            </Label>
            <Input
              id="password"
              type="password"
              inputMode="numeric"
              value={password}
              onChange={(e) => setPassword(e.target.value.replace(/\D/g, "").slice(0, 4))}
              placeholder="••••"
              maxLength={4}
              className="bg-input border-border h-11 text-base tracking-[0.5em]"
              autoComplete="current-password"
            />
          </div>
          {errorMsg && (
            <div className="text-red-500 text-sm text-center bg-red-500/10 rounded-lg p-2.5">
              {errorMsg}
            </div>
          )}
          <Button type="submit" className="w-full h-11 text-base mt-2" disabled={loginMutation.isPending}>
            {loginMutation.isPending ? "로그인 중..." : "로그인"}
          </Button>
        </form>

        {/* 구분선 */}
        <div className="flex items-center gap-3 mt-8">
          <div className="flex-1 h-px bg-gray-100" />
          <span className="text-xs text-gray-400">처음 방문하셨나요?</span>
          <div className="flex-1 h-px bg-gray-100" />
        </div>

        {/* 비회원 등록 버튼 */}
        <button
          onClick={() => setShowRegModal(true)}
          className="mt-4 w-full h-11 rounded-xl border-2 border-[#1D4ED8] text-[#1D4ED8] text-sm font-bold hover:bg-blue-50 transition-colors"
        >
          회원 등록 신청
        </button>

        <p className="text-center text-xs text-muted-foreground mt-4">
          계정 문의는 헬스장 데스크에 문의하세요
        </p>
      </div>

      {showRegModal && <RegistrationModal onClose={() => setShowRegModal(false)} />}
    </div>
  );
}
