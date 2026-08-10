import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Download, X } from "lucide-react";

function formatPhone(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
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

        <p className="text-center text-xs text-muted-foreground mt-8">
          계정 문의는 헬스장 데스크에 문의하세요
        </p>
      </div>
    </div>
  );
}
