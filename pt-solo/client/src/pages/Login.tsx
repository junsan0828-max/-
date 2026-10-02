import { useState, useEffect } from "react";
import Logo from "@/components/Logo";
import { trpc } from "@/lib/trpc";

const ERROR_MESSAGES: Record<string, string> = {
  pending: "가입 승인 대기 중입니다. 관리자에게 문의하세요.",
  rejected: "가입이 거절된 계정입니다. 관리자에게 문의하세요.",
  kakao_not_configured: "카카오 로그인이 설정되지 않았습니다.",
  kakao_failed: "카카오 로그인 중 오류가 발생했습니다. 다시 시도해주세요.",
  kakao_cancelled: "카카오 로그인이 취소되었습니다.",
  kakao_token_failed: "카카오 인증에 실패했습니다. 다시 시도해주세요.",
};

const AUTO_LOGIN_KEY = "fitStep-autoLogin";

export default function Login() {
  const [errorMsg, setErrorMsg] = useState("");
  const [autoLogging, setAutoLogging] = useState(false);
  const [showIdLogin, setShowIdLogin] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: () => { window.location.href = "/"; },
    onError: (e) => setErrorMsg(e.message),
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const err = params.get("error");
    if (err && ERROR_MESSAGES[err]) {
      setErrorMsg(ERROR_MESSAGES[err]);
      localStorage.removeItem(AUTO_LOGIN_KEY);
      return;
    }
    const saved = localStorage.getItem(AUTO_LOGIN_KEY);
    if (saved === "kakao") {
      setAutoLogging(true);
      window.location.href = "/auth/kakao";
    }
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

        {autoLogging ? (
          <div className="flex flex-col items-center gap-3 py-4">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-muted-foreground">자동 로그인 중...</p>
            <button
              onClick={() => {
                localStorage.removeItem(AUTO_LOGIN_KEY);
                setAutoLogging(false);
              }}
              className="text-xs text-muted-foreground/50 underline underline-offset-2"
            >
              다른 계정으로 로그인
            </button>
          </div>
        ) : showIdLogin ? (
          <div className="space-y-3">
            <div className="space-y-2">
              <input
                type="text"
                placeholder="아이디"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full h-11 rounded-xl border border-border bg-background px-4 text-sm outline-none focus:ring-2 focus:ring-primary/40"
              />
              <input
                type="password"
                placeholder="비밀번호"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && loginMutation.mutate({ username, password })}
                className="w-full h-11 rounded-xl border border-border bg-background px-4 text-sm outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
            <button
              onClick={() => loginMutation.mutate({ username, password })}
              disabled={loginMutation.isPending || !username || !password}
              className="w-full h-11 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50 transition-opacity hover:opacity-90"
            >
              {loginMutation.isPending ? "로그인 중..." : "로그인"}
            </button>
            <button
              onClick={() => { setShowIdLogin(false); setErrorMsg(""); }}
              className="w-full text-xs text-muted-foreground/60 underline underline-offset-2"
            >
              카카오로 로그인
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <a href="/auth/kakao"
              onClick={() => localStorage.setItem(AUTO_LOGIN_KEY, "kakao")}
              className="flex items-center justify-center gap-3 w-full h-12 rounded-xl font-semibold transition-opacity hover:opacity-90"
              style={{ backgroundColor: "#FEE500" }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="#3C1E1E">
                <path d="M12 3C6.477 3 2 6.477 2 10.8c0 2.7 1.6 5.07 4.04 6.52L5.2 21l4.5-2.4c.75.1 1.53.16 2.3.16 5.523 0 10-3.477 10-7.76S17.523 3 12 3z"/>
              </svg>
              <span className="text-sm font-semibold" style={{ color: "#3C1E1E" }}>카카오로 시작하기</span>
            </a>
            <button
              onClick={() => setShowIdLogin(true)}
              className="w-full text-xs text-muted-foreground/50 underline underline-offset-2"
            >
              아이디로 로그인
            </button>
          </div>
        )}

        {errorMsg && (
          <div className="text-red-500 text-sm text-center bg-red-500/10 rounded-xl p-3">{errorMsg}</div>
        )}
      </div>
    </div>
  );
}
