import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loader2, CheckCircle, Clock } from "lucide-react";

const BEBAS = { fontFamily: "'Bebas Neue', 'Arial Black', Arial, sans-serif", letterSpacing: "0.12em" };

export default function Register() {
  const [form, setForm] = useState({ username: "", password: "", confirmPassword: "", trainerName: "", phone: "", email: "" });
  const [errorMsg, setErrorMsg] = useState("");
  const [done, setDone] = useState(false);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(p => ({ ...p, [k]: e.target.value }));

  const registerMutation = trpc.auth.register.useMutation({
    onSuccess: () => setDone(true),
    onError: (e) => setErrorMsg(e.message || "회원가입 실패"),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    if (!form.username || !form.password || !form.trainerName) { setErrorMsg("아이디, 비밀번호, 이름은 필수입니다."); return; }
    if (form.password !== form.confirmPassword) { setErrorMsg("비밀번호가 일치하지 않습니다."); return; }
    if (form.password.length < 6) { setErrorMsg("비밀번호는 6자 이상이어야 합니다."); return; }
    registerMutation.mutate(form);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-sm bg-card border-border">
        <CardHeader className="text-center pb-4 pt-8">
          <div className="flex items-center justify-center gap-1 mb-1">
            <span className="text-4xl" style={BEBAS}>FIT</span>
            <span className="text-4xl text-primary" style={BEBAS}>STEP</span>
          </div>
          <CardTitle className="text-lg mt-2">트레이너 회원가입</CardTitle>
        </CardHeader>

        <CardContent>
          {done ? (
            <div className="py-4 space-y-4 text-center">
              <div className="flex justify-center">
                <div className="w-16 h-16 rounded-full bg-green-500/15 border border-green-500/30 flex items-center justify-center">
                  <CheckCircle className="h-8 w-8 text-green-400" />
                </div>
              </div>
              <div>
                <p className="font-semibold text-foreground mb-1">가입 신청 완료!</p>
                <p className="text-sm text-muted-foreground">관리자 승인 후 로그인할 수 있습니다.</p>
              </div>
              <div className="flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/30 rounded-lg px-3 py-2.5">
                <Clock className="h-4 w-4 text-yellow-400 shrink-0" />
                <p className="text-xs text-yellow-300">승인은 보통 1영업일 이내 처리됩니다.</p>
              </div>
              <a href="/login" className="block w-full">
                <Button variant="outline" className="w-full">로그인 페이지로</Button>
              </a>
            </div>
          ) : (
          <>
          {errorMsg && <p className="text-red-500 text-sm bg-red-500/10 rounded p-2 mb-3">{errorMsg}</p>}
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="space-y-1">
              <Label className="text-sm text-muted-foreground">이름 *</Label>
              <Input value={form.trainerName} onChange={set("trainerName")} placeholder="홍길동" className="bg-input border-border" />
            </div>
            <div className="space-y-1">
              <Label className="text-sm text-muted-foreground">아이디 *</Label>
              <Input value={form.username} onChange={set("username")} placeholder="3자 이상" className="bg-input border-border" autoComplete="username" />
            </div>
            <div className="space-y-1">
              <Label className="text-sm text-muted-foreground">비밀번호 *</Label>
              <Input type="password" value={form.password} onChange={set("password")} placeholder="6자 이상" className="bg-input border-border" autoComplete="new-password" />
            </div>
            <div className="space-y-1">
              <Label className="text-sm text-muted-foreground">비밀번호 확인 *</Label>
              <Input type="password" value={form.confirmPassword} onChange={set("confirmPassword")} className="bg-input border-border" autoComplete="new-password" />
            </div>
            <div className="space-y-1">
              <Label className="text-sm text-muted-foreground">전화번호</Label>
              <Input value={form.phone} onChange={set("phone")} placeholder="010-0000-0000" className="bg-input border-border" />
            </div>
            <div className="space-y-1">
              <Label className="text-sm text-muted-foreground">이메일</Label>
              <Input type="email" value={form.email} onChange={set("email")} placeholder="선택 입력" className="bg-input border-border" />
            </div>
            <Button type="submit" className="w-full mt-1" disabled={registerMutation.isPending}>
              {registerMutation.isPending ? <><Loader2 className="h-4 w-4 animate-spin" />가입 중...</> : "회원가입"}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              계정이 있으신가요?{" "}
              <a href="/login" className="text-primary underline">로그인</a>
            </p>
          </form>
          </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
