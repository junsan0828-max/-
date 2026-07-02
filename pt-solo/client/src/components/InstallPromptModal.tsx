import { useEffect, useState } from "react";
import { Download, Share, X, Smartphone } from "lucide-react";

const STORAGE_KEY = "pwa-install-dismissed-at";
const DISMISS_DAYS = 7;

function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isInStandaloneMode() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as any).standalone === true
  );
}

function wasDismissedRecently() {
  const ts = localStorage.getItem(STORAGE_KEY);
  if (!ts) return false;
  const days = (Date.now() - Number(ts)) / (1000 * 60 * 60 * 24);
  return days < DISMISS_DAYS;
}

interface Props {
  deferredPrompt: any;
  onClear: () => void;
}

export default function InstallPromptModal({ deferredPrompt, onClear }: Props) {
  const [visible, setVisible] = useState(false);
  const ios = isIOS();

  useEffect(() => {
    if (isInStandaloneMode()) return;
    if (wasDismissedRecently()) return;
    if (ios || deferredPrompt) {
      // slight delay so it doesn't pop up immediately on page load
      const t = setTimeout(() => setVisible(true), 1500);
      return () => clearTimeout(t);
    }
  }, [deferredPrompt, ios]);

  const dismiss = (permanent = false) => {
    setVisible(false);
    if (permanent) localStorage.setItem(STORAGE_KEY, String(Date.now()));
    onClear();
  };

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    try {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      dismiss(outcome === "accepted");
    } catch {
      // 설치 불가 환경 (이미 설치됨 등) — 조용히 닫기
      dismiss(false);
    }
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center md:items-center pt-safe">
      <div className="absolute inset-0 bg-black/50" onClick={() => dismiss(false)} />
      <div className="relative w-full max-w-sm mx-4 pb-safe md:pb-0 md:mb-0 bg-card rounded-t-2xl md:rounded-2xl shadow-2xl overflow-hidden">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
              <Smartphone className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-sm text-foreground">FIT STEP 앱 설치</p>
              <p className="text-xs text-muted-foreground">홈 화면에서 바로 접속하세요</p>
            </div>
          </div>
          <button onClick={() => dismiss(false)} className="text-muted-foreground hover:text-foreground p-1">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-5 pb-2">
          <ul className="space-y-1.5 text-xs text-muted-foreground">
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
              앱처럼 전체 화면으로 사용
            </li>
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
              빠른 실행 · 오프라인 지원
            </li>
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
              푸시 알림 수신 가능
            </li>
          </ul>
        </div>

        {/* iOS 안내 */}
        {ios && (
          <div className="mx-5 mt-3 mb-1 bg-muted/50 rounded-xl p-3.5 text-xs text-foreground space-y-2">
            <p className="font-medium">iPhone / iPad 설치 방법</p>
            <div className="flex items-center gap-2 text-muted-foreground">
              <span className="shrink-0 w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">1</span>
              하단 공유 버튼 <Share className="h-3.5 w-3.5 inline mx-0.5" /> 탭
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <span className="shrink-0 w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">2</span>
              <span><b className="text-foreground">'홈 화면에 추가'</b> 선택</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <span className="shrink-0 w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">3</span>
              오른쪽 상단 <b className="text-foreground">'추가'</b> 탭
            </div>
          </div>
        )}

        {/* 버튼 */}
        <div className="px-5 pt-3 pb-5 space-y-2">
          <div className="flex gap-2">
            {!ios && deferredPrompt && (
              <button
                onClick={handleInstall}
                className="flex-1 flex items-center justify-center gap-2 bg-primary text-primary-foreground rounded-xl py-3 text-sm font-semibold"
              >
                <Download className="h-4 w-4" />
                설치하기
              </button>
            )}
            <button
              onClick={() => dismiss(false)}
              className={`${ios || !deferredPrompt ? "flex-1" : ""} px-4 py-3 rounded-xl text-sm text-muted-foreground bg-muted hover:bg-accent transition-colors`}
            >
              {ios ? "확인" : "다음에"}
            </button>
          </div>
          <button
            onClick={() => dismiss(true)}
            className="w-full text-xs text-muted-foreground/50 py-1"
          >
            이미 설치됨 · 다시 보지 않기
          </button>
        </div>
      </div>
    </div>
  );
}
