import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export default function GymPlusLogin() {
  const [form, setForm] = useState({ username: "", password: "" });
  const [errorMsg, setErrorMsg] = useState("");
  const utils = trpc.useUtils();

  const loginMutation = trpc.gymPlus.memberLogin.useMutation({
    onSuccess: () => {
      utils.gymPlus.memberMe.invalidate();
      window.location.href = "/gym-plus";
    },
    onError: (err) => {
      setErrorMsg(err.message || "로그인 실패. 아이디/비밀번호를 확인하세요.");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.username || !form.password) {
      setErrorMsg("아이디와 비밀번호를 입력해주세요.");
      return;
    }
    setErrorMsg("");
    loginMutation.mutate(form);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* 로고 영역 */}
        <div className="flex flex-col items-center mb-8">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
              <span className="text-primary-foreground font-black text-lg">G</span>
            </div>
            <div>
              <p className="font-black text-xl text-foreground leading-none">ZIANT GYM</p>
              <p className="text-primary font-bold text-sm leading-none tracking-widest">+ PLUS</p>
            </div>
          </div>
          <p className="text-muted-foreground text-sm mt-2">회원 전용 서비스</p>
        </div>

        <Card className="bg-card border-border">
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="username" className="text-sm text-muted-foreground">아이디</Label>
                <Input
                  id="username"
                  value={form.username}
                  onChange={(e) => setForm((p) => ({ ...p, username: e.target.value }))}
                  placeholder="아이디 입력"
                  className="bg-input border-border"
                  autoComplete="username"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-sm text-muted-foreground">비밀번호</Label>
                <Input
                  id="password"
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                  placeholder="비밀번호 입력"
                  className="bg-input border-border"
                  autoComplete="current-password"
                />
              </div>
              {errorMsg && (
                <div className="text-red-500 text-sm text-center bg-red-500/10 rounded p-2">
                  {errorMsg}
                </div>
              )}
              <Button type="submit" className="w-full" disabled={loginMutation.isPending}>
                {loginMutation.isPending ? "로그인 중..." : "로그인"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-6">
          계정 문의는 헬스장 데스크에 문의하세요
        </p>
      </div>
    </div>
  );
}
