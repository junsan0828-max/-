import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import Logo from "@/components/Logo";

export default function AdminLogin() {
  const [form, setForm] = useState({ username: "", password: "" });

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: () => { window.location.href = "/"; },
    onError: (err) => toast.error(err.message || "로그인 실패. 아이디/비밀번호를 확인하세요."),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.username || !form.password) { toast.error("아이디와 비밀번호를 입력해주세요."); return; }
    loginMutation.mutate(form);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-card border border-border rounded-2xl p-8 space-y-6">
        <div className="flex flex-col items-center gap-1">
          <Logo className="h-16" textSize="text-4xl" />
          <p className="text-xs text-muted-foreground mt-2">관리자 로그인</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            value={form.username}
            onChange={(e) => setForm(p => ({ ...p, username: e.target.value }))}
            placeholder="아이디"
            autoComplete="username"
            className="w-full bg-input border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground"
          />
          <input
            type="password"
            value={form.password}
            onChange={(e) => setForm(p => ({ ...p, password: e.target.value }))}
            placeholder="비밀번호"
            autoComplete="current-password"
            className="w-full bg-input border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground"
          />
          <button
            type="submit"
            disabled={loginMutation.isPending}
            className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {loginMutation.isPending ? "로그인 중..." : "로그인"}
          </button>
        </form>
      </div>
    </div>
  );
}
