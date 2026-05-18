import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export default function FitStepPlusLogin({ trainerId }: { trainerId: number }) {
  const [form, setForm] = useState({ username: "", password: "" });
  const [errorMsg, setErrorMsg] = useState("");
  const utils = trpc.useUtils();

  const loginMutation = trpc.fitStepPlus.memberLogin.useMutation({
    onSuccess: () => {
      utils.fitStepPlus.memberMe.invalidate();
      window.location.href = `/fit-step-plus/${trainerId}`;
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
    loginMutation.mutate({ ...form, trainerId });
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="flex items-center gap-1 mb-2">
            <span className="font-black text-2xl tracking-widest" style={{ fontFamily: "'Arial Black', Arial, sans-serif" }}>FIT</span>
            <span className="font-black text-2xl tracking-widest text-primary" style={{ fontFamily: "'Arial Black', Arial, sans-serif" }}>STEP</span>
            <span className="font-black text-2xl text-primary" style={{ fontFamily: "'Arial Black', Arial, sans-serif" }}>+</span>
          </div>
          <p className="text-muted-foreground text-sm mt-1">회원 전용 서비스</p>
        </div>

        <Card className="bg-card border-border">
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="username" className="text-sm text-muted-foreground">휴대폰 번호</Label>
                <Input
                  id="username"
                  value={form.username}
                  onChange={(e) => setForm((p) => ({ ...p, username: e.target.value }))}
                  placeholder="010-0000-0000"
                  className="bg-input border-border"
                  autoComplete="tel"
                  inputMode="tel"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-sm text-muted-foreground">비밀번호</Label>
                <Input
                  id="password"
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                  placeholder="휴대폰 뒷자리 4자리"
                  className="bg-input border-border"
                  autoComplete="current-password"
                  inputMode="numeric"
                  maxLength={4}
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
          아이디: 휴대폰 번호 · 비밀번호: 뒷자리 4자리
        </p>
      </div>
    </div>
  );
}
