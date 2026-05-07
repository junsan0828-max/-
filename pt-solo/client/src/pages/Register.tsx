import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { CheckCircle, Mail, Loader2 } from "lucide-react";

type Step = "email" | "code" | "form";

export default function Register() {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [form, setForm] = useState({ username: "", password: "", confirmPassword: "", trainerName: "", phone: "" });
  const [errorMsg, setErrorMsg] = useState("");

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(p => ({ ...p, [k]: e.target.value }));

  const sendCodeMutation = trpc.auth.sendEmailCode.useMutation({
    onSuccess: (data) => {
      setErrorMsg("");
      setStep("code");
      if (data.devCode) setDevCode(data.devCode);
    },
    onError: (e) => setErrorMsg(e.message),
  });

  const verifyMutation = trpc.auth.verifyEmailCode.useMutation({
    onSuccess: () => { setErrorMsg(""); setStep("form"); },
    onError: (e) => setErrorMsg(e.message),
  });

  const registerMutation = trpc.auth.register.useMutation({
    onSuccess: () => { window.location.href = "/"; },
    onError: (e) => setErrorMsg(e.message || "회원가입 실패"),
  });

  const handleSendCode = () => {
    setErrorMsg("");
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setErrorMsg("올바른 이메일 주소를 입력해주세요."); return; }
    sendCodeMutation.mutate({ email });
  };

  const handleVerify = () => {
    setErrorMsg("");
    if (code.length !== 6) { setErrorMsg("6자리 인증 코드를 입력해주세요."); return; }
    verifyMutation.mutate({ email, code });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    if (!form.username || !form.password || !form.trainerName) { setErrorMsg("아이디, 비밀번호, 이름은 필수입니다."); return; }
    if (form.password !== form.confirmPassword) { setErrorMsg("비밀번호가 일치하지 않습니다."); return; }
    if (form.password.length < 6) { setErrorMsg("비밀번호는 6자 이상이어야 합니다."); return; }
    registerMutation.mutate({ ...form, email });
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-sm bg-card border-border">
        <CardHeader className="text-center pb-4 pt-6">
          <div className="flex items-center justify-center gap-1 mb-3">
            <span className="font-black text-2xl tracking-widest" style={{ fontFamily: "'Arial Black', Arial, sans-serif" }}>FIT</span>
            <span className="font-black text-2xl tracking-widest text-primary" style={{ fontFamily: "'Arial Black', Arial, sans-serif" }}>STEP</span>
          </div>
          <CardTitle className="text-lg">트레이너 회원가입</CardTitle>

          {/* 단계 표시 */}
          <div className="flex items-center justify-center gap-2 mt-3">
            {["이메일 인증", "코드 확인", "정보 입력"].map((label, i) => {
              const stepIdx = step === "email" ? 0 : step === "code" ? 1 : 2;
              const done = i < stepIdx;
              const active = i === stepIdx;
              return (
                <div key={label} className="flex items-center gap-1">
                  <div className={`w-6 h-6 rounded-full text-xs flex items-center justify-center font-bold transition-colors ${done ? "bg-green-500 text-white" : active ? "bg-primary text-white" : "bg-accent text-muted-foreground"}`}>
                    {done ? "✓" : i + 1}
                  </div>
                  {i < 2 && <div className={`w-6 h-0.5 ${done ? "bg-green-500" : "bg-border"}`} />}
                </div>
              );
            })}
          </div>
        </CardHeader>

        <CardContent>
          {errorMsg && <p className="text-red-500 text-sm bg-red-500/10 rounded p-2 mb-3">{errorMsg}</p>}

          {/* Step 1: 이메일 입력 */}
          {step === "email" && (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-sm text-muted-foreground">이메일 주소 *</Label>
                <Input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="example@email.com"
                  className="bg-input border-border"
                  onKeyDown={e => e.key === "Enter" && handleSendCode()}
                />
              </div>
              <Button className="w-full gap-2" onClick={handleSendCode} disabled={sendCodeMutation.isPending}>
                {sendCodeMutation.isPending ? <><Loader2 className="h-4 w-4 animate-spin" />전송 중...</> : <><Mail className="h-4 w-4" />인증 코드 받기</>}
              </Button>
              <p className="text-center text-sm text-muted-foreground">
                계정이 있으신가요?{" "}
                <a href="/login" className="text-primary underline">로그인</a>
              </p>
            </div>
          )}

          {/* Step 2: 코드 입력 */}
          {step === "code" && (
            <div className="space-y-3">
              <div className="p-3 rounded-lg bg-primary/10 border border-primary/30 text-center">
                <Mail className="h-5 w-5 text-primary mx-auto mb-1" />
                <p className="text-xs text-muted-foreground"><span className="font-semibold text-foreground">{email}</span>으로<br />6자리 인증 코드를 전송했습니다.</p>
                {devCode && (
                  <p className="mt-2 text-xs text-yellow-400 bg-yellow-500/10 rounded px-2 py-1">
                    [개발모드] 코드: <span className="font-bold">{devCode}</span>
                  </p>
                )}
              </div>
              <div className="space-y-1">
                <Label className="text-sm text-muted-foreground">인증 코드 6자리</Label>
                <Input
                  value={code}
                  onChange={e => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="000000"
                  className="bg-input border-border text-center text-2xl tracking-[0.5em] font-bold"
                  maxLength={6}
                  onKeyDown={e => e.key === "Enter" && handleVerify()}
                />
              </div>
              <Button className="w-full" onClick={handleVerify} disabled={verifyMutation.isPending}>
                {verifyMutation.isPending ? <><Loader2 className="h-4 w-4 animate-spin" />확인 중...</> : "인증 확인"}
              </Button>
              <button onClick={() => { setStep("email"); setCode(""); setErrorMsg(""); }} className="w-full text-xs text-muted-foreground underline">이메일 다시 입력하기</button>
              <button onClick={handleSendCode} disabled={sendCodeMutation.isPending} className="w-full text-xs text-primary underline">
                {sendCodeMutation.isPending ? "재전송 중..." : "코드 재전송"}
              </button>
            </div>
          )}

          {/* Step 3: 정보 입력 */}
          {step === "form" && (
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-green-500/10 border border-green-500/30 mb-2">
                <CheckCircle className="h-4 w-4 text-green-400 shrink-0" />
                <p className="text-xs text-green-400">{email} 인증 완료</p>
              </div>
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
              <Button type="submit" className="w-full" disabled={registerMutation.isPending}>
                {registerMutation.isPending ? <><Loader2 className="h-4 w-4 animate-spin" />가입 중...</> : "회원가입 완료"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
