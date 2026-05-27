import { useState, useEffect } from "react";
import Logo from "@/components/Logo";

const ERROR_MESSAGES: Record<string, string> = {
  pending: "가입 승인 대기 중입니다. 관리자에게 문의하세요.",
  rejected: "가입이 거절된 계정입니다. 관리자에게 문의하세요.",
  kakao_not_configured: "카카오 로그인이 설정되지 않았습니다.",
  kakao_failed: "카카오 로그인 중 오류가 발생했습니다. 다시 시도해주세요.",
  kakao_cancelled: "카카오 로그인이 취소되었습니다.",
  kakao_token_failed: "카카오 인증에 실패했습니다. 다시 시도해주세요.",
};

export default function Login() {
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const err = params.get("error");
    if (err && ERROR_MESSAGES[err]) setErrorMsg(ERROR_MESSAGES[err]);
  }, []);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-card border border-border rounded-2xl p-8 space-y-6">
        <div className="flex flex-col items-center gap-1">
          <Logo className="h-16" textSize="text-4xl" />
          <p className="text-xs text-muted-foreground/70 mt-1 tracking-widest uppercase"
            style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: "0.2em" }}>
            성장하는 운동전문가 플랫폼
          </p>
        </div>

        <div className="space-y-3">
          <a href="/auth/kakao"
            className="flex items-center justify-center gap-3 w-full h-12 rounded-xl font-semibold transition-opacity hover:opacity-90"
            style={{ backgroundColor: "#FEE500" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="#3C1E1E">
              <path d="M12 3C6.477 3 2 6.477 2 10.8c0 2.7 1.6 5.07 4.04 6.52L5.2 21l4.5-2.4c.75.1 1.53.16 2.3.16 5.523 0 10-3.477 10-7.76S17.523 3 12 3z"/>
            </svg>
            <span className="text-sm font-bold" style={{ color: "#3C1E1E" }}>카카오로 시작하기</span>
          </a>
          <p className="text-center text-xs text-muted-foreground/50">
            카카오 계정으로 간편하게 로그인하세요
          </p>
        </div>

        {errorMsg && (
          <div className="text-red-500 text-sm text-center bg-red-500/10 rounded-xl p-3">{errorMsg}</div>
        )}
      </div>
    </div>
  );
}
