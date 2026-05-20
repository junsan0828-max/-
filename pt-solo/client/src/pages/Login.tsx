import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import Logo from "@/components/Logo";

const ERROR_MESSAGES: Record<string, string> = {
  pending: "가입 승인 대기 중입니다. 관리자 승인 후 로그인할 수 있습니다.",
  rejected: "가입이 거절된 계정입니다. 관리자에게 문의하세요.",
  kakao_not_configured: "카카오 로그인이 설정되지 않았습니다.",
  kakao_failed: "카카오 로그인 중 오류가 발생했습니다.",
  kakao_cancelled: "카카오 로그인이 취소되었습니다.",
};

export default function Login() {
  const [form, setForm] = useState({ username: "", password: "" });
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const err = params.get("error");
    if (err && ERROR_MESSAGES[err]) setErrorMsg(ERROR_MESSAGES[err]);
  }, []);

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: () => { window.location.href = "/"; },
    onError: (err) => setErrorMsg(err.message || "로그인 실패. 아이디/비밀번호를 확인하세요."),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.username || !form.password) { toast.error("아이디와 비밀번호를 입력해주세요."); return; }
    loginMutation.mutate(form);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-sm bg-card border-border">
        <CardHeader className="flex flex-col items-center pb-6 pt-8">
          <Logo className="h-16" textSize="text-4xl" />
          <p className="text-xs text-muted-foreground/70 mt-1 tracking-widest uppercase"
            style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: "0.2em" }}>
            성장하는 운동전문가 플랫폼
          </p>
          <p className="text-sm text-muted-foreground mt-4">STEPER로 시작하세요</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 소셜 로그인 */}
          <div className="space-y-2">
            <a href="/auth/kakao"
              className="flex items-center justify-center gap-3 w-full h-11 rounded-lg border border-border transition-colors"
              style={{ backgroundColor: "#FEE500" }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="#3C1E1E">
                <path d="M12 3C6.477 3 2 6.477 2 10.8c0 2.7 1.6 5.07 4.04 6.52L5.2 21l4.5-2.4c.75.1 1.53.16 2.3.16 5.523 0 10-3.477 10-7.76S17.523 3 12 3z"/>
              </svg>
              <span className="text-sm font-medium" style={{ color: "#3C1E1E" }}>카카오로 시작하기</span>
            </a>
          </div>

          {/* 구분선 */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground">또는</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* 일반 로그인 */}
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="username" className="text-sm text-muted-foreground">아이디</Label>
              <Input id="username" value={form.username}
                onChange={(e) => setForm((p) => ({ ...p, username: e.target.value }))}
                placeholder="아이디 입력" className="bg-input border-border" autoComplete="username" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-sm text-muted-foreground">비밀번호</Label>
              <Input id="password" type="password" value={form.password}
                onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                placeholder="비밀번호 입력" className="bg-input border-border" autoComplete="current-password" />
            </div>
            {errorMsg && (
              <div className="text-red-500 text-sm text-center bg-red-500/10 rounded p-2">{errorMsg}</div>
            )}
            <Button type="submit" className="w-full" disabled={loginMutation.isPending}>
              {loginMutation.isPending ? "로그인 중..." : "로그인"}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground">
            계정이 없으신가요?{" "}
            <a href="/register" className="text-primary underline">STEPER 회원가입</a>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
