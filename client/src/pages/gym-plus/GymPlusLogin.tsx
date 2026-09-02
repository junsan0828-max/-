import { useState, useEffect, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Download, X, Copy, Check } from "lucide-react";

const PERIOD_PRICES: Record<string, number> = {
  "1개월": 80000,
  "3개월": 159000,
  "6개월": 216000,
  "12개월": 312000,
};

const PERIOD_ORIGINAL: Record<string, number> = {
  "6개월": 226000,
  "12개월": 322000,
};

function formatPhone(raw: string) {
  const d = raw.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 7) return `${d.slice(0,3)}-${d.slice(3)}`;
  return `${d.slice(0,3)}-${d.slice(3,7)}-${d.slice(7)}`;
}

const CONTRACT_TEXT = `제1조 (목적)
본 약관은 자이언트짐(이하 "센터")이 제공하는 피트니스 서비스 이용에 관한 제반 사항을 규정함을 목적으로 합니다.

제2조 (회원의 의무)
① 회원은 센터의 시설 및 기구를 타인에게 피해가 가지 않도록 올바르게 사용하여야 합니다.
② 회원은 센터 내에서 타인을 방해하거나 불쾌감을 주는 행위를 하여서는 안 됩니다.
③ 운동 후 사용한 기구는 반드시 제자리에 정리하여야 합니다.
④ 센터 내 음식물 반입은 허용되지 않으며, 음료는 개인 물병만 허용합니다.

제3조 (이용 시간 및 시설)
① 센터의 운영 시간은 별도 공지에 따릅니다.
② 회원은 운영 시간 내에만 센터를 이용할 수 있습니다.
③ 공휴일 및 센터 사정에 따라 운영 시간이 변경될 수 있으며, 이 경우 사전에 공지합니다.

제4조 (이용권 및 환불)
① 이용권은 계약 시작일로부터 효력이 발생합니다.
② 이용권의 환불은 관련 법령 및 센터 환불 규정에 따릅니다.
③ 회원 개인 사정으로 인한 중도 해지 시 잔여 기간에 따라 환불이 이루어집니다.
④ 부상·질병 등 불가피한 사유가 있을 경우 이용 정지 신청이 가능합니다.

제5조 (면책 조항)
① 센터는 회원이 센터 내에서 발생한 사고에 대해 센터의 과실이 없는 경우 책임을 지지 않습니다.
② 개인 소지품 분실에 대해 센터는 책임을 지지 않습니다.
③ 회원은 자신의 건강 상태를 정확히 고지하여야 하며, 허위 고지로 인한 문제는 회원 본인이 책임집니다.

제6조 (회원 자격 박탈)
다음 각 호에 해당하는 경우 센터는 회원 자격을 박탈할 수 있습니다.
① 타인에게 폭언·폭행 등 위해를 가한 경우
② 센터 시설물을 고의로 파손한 경우
③ 본 약관을 위반한 경우`;

const PRIVACY_TEXT = `수집하는 개인정보 항목
- 필수항목: 성명, 연락처, 성별, 생년월일
- 선택항목: 이메일 주소, 건강 정보

개인정보의 수집 및 이용 목적
① 피트니스 서비스 제공 및 회원 관리
② 결제 및 환불 처리
③ 고객 상담 및 민원 처리

개인정보의 보유 및 이용 기간
- 회원 탈퇴 시 또는 이용 목적 달성 후 즉시 파기
- 관련 법령에 따라 보존 의무가 있는 경우 해당 기간 보관

귀하는 개인정보 제공에 동의하지 않을 권리가 있습니다.
단, 동의 거부 시 정상적인 서비스 이용이 제한될 수 있습니다.`;

function SignaturePad({ onSign, signatureData }: { onSign: (d: string) => void; signatureData: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#1a1a2e";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, []);

  const getPos = (e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    const sx = canvas.width / rect.width, sy = canvas.height / rect.height;
    if ("touches" in e) {
      const t = e.touches[0];
      return { x: (t.clientX - rect.left) * sx, y: (t.clientY - rect.top) * sy };
    }
    return { x: ((e as React.MouseEvent).clientX - rect.left) * sx, y: ((e as React.MouseEvent).clientY - rect.top) * sy };
  };

  const startDraw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const canvas = canvasRef.current; if (!canvas) return;
    isDrawingRef.current = true;
    const ctx = canvas.getContext("2d")!;
    const { x, y } = getPos(e, canvas);
    ctx.beginPath(); ctx.moveTo(x, y);
  }, []);

  const draw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (!isDrawingRef.current) return;
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const { x, y } = getPos(e, canvas);
    ctx.lineTo(x, y); ctx.stroke();
  }, []);

  const endDraw = useCallback(() => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    const canvas = canvasRef.current; if (!canvas) return;
    onSign(canvas.toDataURL("image/png"));
  }, [onSign]);

  const clearPad = () => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, canvas.width, canvas.height);
    onSign("");
  };

  return (
    <div className="space-y-2">
      <div className="relative border-2 border-dashed border-gray-200 rounded-xl overflow-hidden bg-white">
        <canvas
          ref={canvasRef} width={600} height={200}
          className="w-full touch-none cursor-crosshair" style={{ display: "block" }}
          onMouseDown={startDraw} onMouseMove={draw} onMouseUp={endDraw} onMouseLeave={endDraw}
          onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={endDraw}
        />
        {!signatureData && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="text-gray-300 text-sm">여기에 서명하세요</p>
          </div>
        )}
      </div>
      <div className="flex justify-between items-center">
        <p className="text-xs text-gray-400">손가락 또는 마우스로 서명해 주세요</p>
        <button type="button" onClick={clearPad} className="text-xs text-gray-400 border border-gray-200 rounded-lg px-3 py-1">지우기</button>
      </div>
    </div>
  );
}

function RegistrationModal({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState<"form" | "contract" | "sign" | "confirm">("form");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [period, setPeriod] = useState("3개월");
  const [agreedTerms, setAgreedTerms] = useState(false);
  const [agreedPrivacy, setAgreedPrivacy] = useState(false);
  const [agreedMarketing, setAgreedMarketing] = useState(false);
  const [signatureData, setSignatureData] = useState("");
  const [copied, setCopied] = useState(false);
  const [errMsg, setErrMsg] = useState("");

  const { data: bankData } = trpc.gymPlus.getRegistrationBankAccount.useQuery();
  const bankAccount = bankData?.bankAccount || "계좌번호 등록 중 (데스크 문의)";

  const contractDate = new Date().toLocaleDateString("ko-KR");

  const submitMut = trpc.gymPlus.submitRegistrationRequest.useMutation({
    onSuccess: () => setStep("confirm"),
    onError: (e) => setErrMsg(e.message || "신청 실패. 다시 시도해 주세요."),
  });

  const amount = PERIOD_PRICES[period] ?? 0;

  const handleFormNext = () => {
    if (!name.trim()) { setErrMsg("이름을 입력해주세요."); return; }
    if (phone.replace(/\D/g,"").length < 10) { setErrMsg("전화번호를 정확히 입력해주세요."); return; }
    setErrMsg(""); setStep("contract");
  };

  const handleContractNext = () => {
    if (!agreedTerms || !agreedPrivacy) { setErrMsg("필수 약관에 동의해 주세요."); return; }
    setErrMsg(""); setStep("sign");
  };

  const handleSignSubmit = () => {
    if (!signatureData) { setErrMsg("서명을 완료해 주세요."); return; }
    setErrMsg("");
    submitMut.mutate({
      name: name.trim(), phone,
      membershipPeriod: period as any,
      signatureData,
      agreedMarketing,
      contractDate,
    });
  };

  const copyAccount = () => {
    navigator.clipboard.writeText(bankAccount).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 2000);
    });
  };

  const STEP_LABELS = ["정보입력", "계약서", "서명", "완료"];
  const STEP_IDX = { form: 0, contract: 1, sign: 2, confirm: 3 };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden flex flex-col" style={{ maxHeight: "90vh" }}>
        {/* 헤더 */}
        <div className="bg-[#1D4ED8] px-6 py-4 relative shrink-0">
          <button onClick={onClose} className="absolute top-4 right-4 text-white/70 hover:text-white">
            <X className="w-5 h-5" />
          </button>
          <p style={{ fontFamily: "'Cormorant Garamond', serif", letterSpacing: "0.12em" }} className="text-white text-lg font-semibold">
            ZIANTGYM<span className="opacity-80">+</span>
          </p>
          <p className="text-white/80 text-sm mt-0.5">회원 등록 신청</p>
          {/* 단계 표시 */}
          {step !== "confirm" && (
            <div className="flex gap-1 mt-3">
              {STEP_LABELS.slice(0,3).map((label, i) => (
                <div key={label} className="flex-1 flex flex-col items-center gap-1">
                  <div className={`h-1 w-full rounded-full transition-all ${i <= STEP_IDX[step] ? "bg-white" : "bg-white/30"}`} />
                  <span className={`text-[10px] ${i <= STEP_IDX[step] ? "text-white" : "text-white/40"}`}>{label}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 스크롤 영역 */}
        <div className="flex-1 overflow-y-auto">

        {/* 1단계: 정보 입력 */}
        {step === "form" && (
          <div className="p-6 space-y-5">
            <div className="space-y-1.5">
              <Label className="text-xs text-gray-500">이름</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="홍길동" className="h-11" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-gray-500">연락처</Label>
              <Input type="tel" inputMode="numeric" value={phone} onChange={(e) => setPhone(formatPhone(e.target.value))} placeholder="010-0000-0000" className="h-11" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-gray-500">희망 회원권</Label>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(PERIOD_PRICES).map(([p, price]) => {
                    const original = PERIOD_ORIGINAL[p];
                    const discountRate = original ? Math.round((original - price) / original * 100) : 0;
                    const isSelected = period === p;
                    return (
                      <button key={p} onClick={() => setPeriod(p)}
                        className="rounded-xl border-2 p-3 text-left transition-all relative"
                        style={{ borderColor: isSelected ? "#1D4ED8" : "#e5e7eb", background: isSelected ? "#eff6ff" : "white" }}
                      >
                        {discountRate > 0 && (
                          <span className="absolute top-2 right-2 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-500 text-white">
                            {discountRate}%↓
                          </span>
                        )}
                        <p className="text-sm font-bold" style={{ color: isSelected ? "#1D4ED8" : "#1a2b4b" }}>{p}</p>
                        {original ? (
                          <div className="mt-0.5 space-y-0.5">
                            <p className="text-[10px] text-gray-400 line-through">{original.toLocaleString()}원</p>
                            <p className="text-xs font-semibold text-red-500">{price.toLocaleString()}원</p>
                          </div>
                        ) : (
                          <p className="text-xs text-gray-500 mt-0.5">{price.toLocaleString()}원</p>
                        )}
                      </button>
                    );
                  })}
              </div>
            </div>
            {errMsg && <p className="text-red-500 text-xs text-center">{errMsg}</p>}
            <Button onClick={handleFormNext} className="w-full h-11 bg-[#1D4ED8] hover:bg-[#1a43c0]">다음 — 계약서 확인</Button>
          </div>
        )}

        {/* 2단계: 계약서 동의 */}
        {step === "contract" && (
          <div className="p-6 space-y-4">
            <h3 className="text-sm font-bold text-[#1a2b4b]">이용 약관</h3>
            {/* 이용약관 */}
            <div className="border border-gray-200 rounded-xl">
              <div className="h-36 overflow-y-auto p-3 text-xs text-gray-600 whitespace-pre-wrap leading-relaxed">
                {CONTRACT_TEXT}
              </div>
              <label className="flex items-center gap-2 px-3 py-2.5 border-t border-gray-100 cursor-pointer">
                <input type="checkbox" checked={agreedTerms} onChange={(e) => setAgreedTerms(e.target.checked)} className="w-4 h-4 accent-[#1D4ED8]" />
                <span className="text-xs font-medium text-gray-700">[필수] 이용 약관에 동의합니다</span>
              </label>
            </div>
            {/* 개인정보 */}
            <div className="border border-gray-200 rounded-xl">
              <div className="h-36 overflow-y-auto p-3 text-xs text-gray-600 whitespace-pre-wrap leading-relaxed">
                {PRIVACY_TEXT}
              </div>
              <label className="flex items-center gap-2 px-3 py-2.5 border-t border-gray-100 cursor-pointer">
                <input type="checkbox" checked={agreedPrivacy} onChange={(e) => setAgreedPrivacy(e.target.checked)} className="w-4 h-4 accent-[#1D4ED8]" />
                <span className="text-xs font-medium text-gray-700">[필수] 개인정보 수집 및 이용에 동의합니다</span>
              </label>
            </div>
            {/* 마케팅 선택 */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={agreedMarketing} onChange={(e) => setAgreedMarketing(e.target.checked)} className="w-4 h-4 accent-[#1D4ED8]" />
              <span className="text-xs text-gray-500">[선택] 이벤트·프로모션 정보 수신에 동의합니다</span>
            </label>
            {errMsg && <p className="text-red-500 text-xs text-center">{errMsg}</p>}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => { setStep("form"); setErrMsg(""); }} className="flex-1 h-11">이전</Button>
              <Button onClick={handleContractNext} className="flex-1 h-11 bg-[#1D4ED8] hover:bg-[#1a43c0]">다음 — 서명</Button>
            </div>
          </div>
        )}

        {/* 3단계: 전자서명 */}
        {step === "sign" && (
          <div className="p-6 space-y-4">
            <div>
              <h3 className="text-sm font-bold text-[#1a2b4b]">전자 서명</h3>
              <p className="text-xs text-gray-500 mt-1">아래에 본인 서명을 해 주세요</p>
            </div>
            {/* 계약 요약 */}
            <div className="bg-blue-50 rounded-xl p-3 text-xs space-y-1">
              <div className="flex justify-between"><span className="text-gray-500">이름</span><span className="font-medium">{name}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">연락처</span><span className="font-medium">{phone}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">회원권</span><span className="font-medium">{period} — {amount.toLocaleString()}원</span></div>
              <div className="flex justify-between"><span className="text-gray-500">계약일</span><span className="font-medium">{contractDate}</span></div>
            </div>
            <SignaturePad onSign={setSignatureData} signatureData={signatureData} />
            {errMsg && <p className="text-red-500 text-xs text-center">{errMsg}</p>}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => { setStep("contract"); setErrMsg(""); }} className="flex-1 h-11">이전</Button>
              <Button onClick={handleSignSubmit} disabled={submitMut.isPending} className="flex-1 h-11 bg-[#1D4ED8] hover:bg-[#1a43c0]">
                {submitMut.isPending ? "제출 중..." : "서명 완료"}
              </Button>
            </div>
          </div>
        )}

        {/* 4단계: 완료 + 입금 안내 */}
        {step === "confirm" && (
          <div className="p-6 space-y-5">
            <div className="text-center space-y-1.5">
              <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center mx-auto">
                <Check className="w-7 h-7 text-green-500" />
              </div>
              <h3 className="text-base font-bold text-[#1a2b4b]">계약 서명 완료!</h3>
              <p className="text-sm text-gray-500">아래 계좌로 입금 완료 후<br/>데스크에 알려주시면 계정을 만들어 드립니다.</p>
            </div>
            <div className="bg-blue-50 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">입금 계좌</span>
                <button onClick={copyAccount} className="flex items-center gap-1 text-xs text-[#1D4ED8] font-medium">
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? "복사됨" : "복사"}
                </button>
              </div>
              <p className="text-sm font-bold text-[#1a2b4b]">{bankAccount}</p>
              <div className="border-t border-blue-100 pt-3 flex justify-between items-center">
                <span className="text-xs text-gray-500">입금 금액</span>
                <span className="text-base font-bold text-[#1D4ED8]">{amount.toLocaleString()}원</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-500">입금자명</span>
                <span className="text-sm font-semibold text-[#1D4ED8]">{name}</span>
              </div>
            </div>
            {/* 입금자명 강조 안내 */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800 space-y-1">
              <p className="font-bold">⚠️ 입금 시 반드시 확인해 주세요</p>
              <p>입금자명을 반드시 <span className="font-bold underline">{name}</span>(으)로 해주세요.</p>
              <p className="text-amber-600">다른 이름으로 입금 시 확인이 지연될 수 있습니다.</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 text-xs text-gray-500 text-center">
              입금 확인 후 문자로 안내해 드립니다<br/>문의: 헬스장 데스크
            </div>
            <Button onClick={onClose} variant="outline" className="w-full h-11">닫기</Button>
          </div>
        )}

        </div>{/* /scroll */}
      </div>
    </div>
  );
}

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function useInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;
    if (isStandalone) {
      setIsInstalled(true);
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);

    const installedHandler = () => setIsInstalled(true);
    window.addEventListener("appinstalled", installedHandler);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", installedHandler);
    };
  }, []);

  const install = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") setIsInstalled(true);
    setDeferredPrompt(null);
  };

  return { canInstall: !!deferredPrompt && !isInstalled, install, isInstalled };
}

function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
}

function InstallBanner() {
  const { canInstall, install, isInstalled } = useInstallPrompt();
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem("install-dismissed")) setDismissed(true);
  }, []);

  if (isInstalled || dismissed) return null;

  const handleDismiss = () => {
    setDismissed(true);
    sessionStorage.setItem("install-dismissed", "1");
  };

  // Android / Chrome — 네이티브 설치 프롬프트
  if (canInstall) {
    return (
      <div className="w-full bg-primary/10 border border-primary/20 rounded-xl p-4 mb-6 relative">
        <button onClick={handleDismiss} className="absolute top-2 right-2 text-muted-foreground p-1">
          <X className="w-4 h-4" />
        </button>
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center shrink-0">
            <Download className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="font-semibold text-sm text-foreground">앱 설치하기</p>
            <p className="text-xs text-muted-foreground">홈 화면에 추가하면 더 빠르게 이용할 수 있어요</p>
          </div>
        </div>
        <Button onClick={install} size="sm" className="w-full h-9 text-sm">
          홈 화면에 추가
        </Button>
      </div>
    );
  }

  // iOS — Safari 가이드
  if (isIOS()) {
    return (
      <div className="w-full bg-primary/10 border border-primary/20 rounded-xl p-4 mb-6 relative">
        <button onClick={handleDismiss} className="absolute top-2 right-2 text-muted-foreground p-1">
          <X className="w-4 h-4" />
        </button>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center shrink-0">
            <Download className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="font-semibold text-sm text-foreground">앱처럼 사용하기</p>
            <p className="text-xs text-muted-foreground">홈 화면에 추가하면 앱처럼 사용할 수 있어요</p>
          </div>
        </div>
        {!showIOSGuide ? (
          <Button onClick={() => setShowIOSGuide(true)} variant="outline" size="sm" className="w-full h-9 text-sm mt-1">
            설치 방법 보기
          </Button>
        ) : (
          <div className="mt-3 space-y-2 text-sm text-foreground">
            <p>1. 하단 <span className="inline-flex items-center"><svg className="w-4 h-4 mx-0.5 inline" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 12h16M12 4v16M8 8l4-4 4 4"/></svg></span> (공유) 버튼 탭</p>
            <p>2. <strong>"홈 화면에 추가"</strong> 선택</p>
            <p>3. 우측 상단 <strong>"추가"</strong> 탭</p>
          </div>
        )}
      </div>
    );
  }

  return null;
}

export default function GymPlusLogin() {
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showRegModal, setShowRegModal] = useState(false);
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
    <div className="gymplus-light min-h-screen bg-white flex items-center justify-center p-4" style={{ paddingTop: "env(safe-area-inset-top)" }}>
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

        <InstallBanner />

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
              비밀번호
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

        {/* 구분선 */}
        <div className="flex items-center gap-3 mt-8">
          <div className="flex-1 h-px bg-gray-100" />
          <span className="text-xs text-gray-400">처음 방문하셨나요?</span>
          <div className="flex-1 h-px bg-gray-100" />
        </div>

        {/* 비회원 등록 버튼 */}
        <button
          onClick={() => setShowRegModal(true)}
          className="mt-4 w-full h-11 rounded-xl border-2 border-[#1D4ED8] text-[#1D4ED8] text-sm font-bold hover:bg-blue-50 transition-colors"
        >
          회원 등록 신청
        </button>

        <p className="text-center text-xs text-muted-foreground mt-4">
          계정 문의는 헬스장 데스크에 문의하세요
        </p>
      </div>

      {showRegModal && <RegistrationModal onClose={() => setShowRegModal(false)} />}
    </div>
  );
}
