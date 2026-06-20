import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

function formatPhone(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
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
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
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
              비밀번호 <span className="text-muted-foreground/60 text-xs">(전화번호 뒷자리 4자리)</span>
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
