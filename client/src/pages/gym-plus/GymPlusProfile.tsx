import { useState, useRef, useEffect, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader } from "@/components/ui/dialog";
import { toast } from "sonner";
import GymPlusHealthSurvey from "./GymPlusHealthSurvey";

const PERIOD_PRICES: Record<string, number> = {
  "1개월": 80000,
  "3개월": 159000,
  "6개월": 216000,
  "12개월": 312000,
};

const membershipTypeLabel: Record<string, string> = {
  general: "일반회원",
  premium: "프리미엄",
  vip: "VIP",
};

const membershipTypeBadge: Record<string, string> = {
  general: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  premium: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
  vip: "bg-purple-500/10 text-purple-400 border-purple-500/30",
};

const GOAL_OPTIONS = ["선택 안함", "체중감량", "근력증가", "다이어트", "체형교정", "건강관리", "재활/부상회복", "스포츠퍼포먼스", "스트레스해소", "기타"];

const BODY_PARTS = [
  "목관절", "흉추", "요추", "골반/천골",
  "어깨(RT)", "어깨(LT)", "팔꿈치(RT)", "팔꿈치(LT)",
  "손목/손(RT)", "손목/손(LT)", "고관절(RT)", "고관절(LT)",
  "무릎(RT)", "무릎(LT)",
];

const POSTURE_ROWS_FRONT = [
  "목", "어깨", "쇄골/흉골", "흉부", "상완(팔)",
  "전완/팔꿈치", "손목/손", "복부(상)", "복부(하)/요추",
  "골반", "고관절", "허벅지", "무릎", "발목/발",
];

const POSTURE_ROWS_BACK = [
  "후두부/목", "어깨/승모", "흉추(상)", "흉추(하)/견갑", "상완(팔)",
  "전완/팔꿈치", "손목/손", "등(상)", "등(하)/요추",
  "골반/천골", "고관절", "허벅지(후)", "무릎(후)/종아리", "발목/발",
];

const DIAGNOSES = ["해당없음", "대사증후군", "고혈압", "당뇨", "당뇨병2형", "고지혈증", "비만", "골다공증", "근감소증"];

const LIFESTYLE = {
  diet: ["A. 식사불규칙", "B. 단백질부족", "C. 폭식/과식", "D. 야식"],
  drinking: ["A. 주3회이상", "B. 과음", "C. 스트레스음주", "D. 회식컨디션저하"],
  sleep: ["A. 자주깸", "B. 피로", "C. 잠드는데30분이상", "D. 6시간미만"],
  activity: ["A. 5000보미만", "B. 앉아있는시간6시간이상", "C. 주2회미만운동", "D. 기본활동숨참"],
};

type ParqData = {
  birthYear: string; birthMonth: string; birthDay: string;
  height: string; weight: string;
  occupation: string; workEnvironment: string; exerciseExperience: string;
  goal1: string; goal2: string; goal3: string;
  dietHabits: string[]; drinkingHabits: string[]; sleepHabits: string[]; activityHabits: string[];
  diagnoses: string[];
  systolicBP: string; diastolicBP: string; waistCircumference: string;
  totalCholesterol: string; hdl: string; ldl: string; triglycerides: string;
  fastingGlucose: string; postMealGlucose: string; hba1c: string; boneDensity: string;
  imbalanceAreas: string[]; acuteInjuryAreas: string[]; chronicPainAreas: string[];
  postureFrontRT: string[]; postureFrontLT: string[];
  postureBackRT: string[]; postureBackLT: string[];
};

const defaultParqData: ParqData = {
  birthYear: "", birthMonth: "", birthDay: "", height: "", weight: "",
  occupation: "", workEnvironment: "", exerciseExperience: "",
  goal1: "선택 안함", goal2: "선택 안함", goal3: "선택 안함",
  dietHabits: [], drinkingHabits: [], sleepHabits: [], activityHabits: [],
  diagnoses: [],
  systolicBP: "", diastolicBP: "", waistCircumference: "",
  totalCholesterol: "", hdl: "", ldl: "", triglycerides: "",
  fastingGlucose: "", postMealGlucose: "", hba1c: "", boneDensity: "",
  imbalanceAreas: [], acuteInjuryAreas: [], chronicPainAreas: [],
  postureFrontRT: [], postureFrontLT: [],
  postureBackRT: [], postureBackLT: [],
};

function toggleArr(arr: string[], item: string): string[] {
  return arr.includes(item) ? arr.filter(i => i !== item) : [...arr, item];
}

function daysUntil(dateStr: string | null | undefined) {
  if (!dateStr) return null;
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
}

function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return "-";
  return dateStr.slice(0, 10).replace(/-/g, ".");
}

function MissionCard({
  icon, title, description, done, locked, onPress,
}: {
  icon: string; title: string; description: string;
  done: boolean; locked?: boolean; onPress: () => void;
}) {
  return (
    <button
      onClick={onPress}
      disabled={locked}
      className={`w-full flex items-center gap-3 p-4 rounded-xl border text-left transition-colors ${
        done
          ? "border-green-500/40 bg-green-500/10"
          : locked
          ? "border-border/40 bg-muted/20 opacity-50 cursor-not-allowed"
          : "border-border bg-card hover:border-primary/50"
      }`}
    >
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0 ${done ? "bg-green-500/20" : "bg-muted"}`}>{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm">{title}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
      <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${done ? "bg-green-500/20 text-green-400" : "bg-muted text-muted-foreground"}`}>
        {done ? "완료" : "미완료"}
      </span>
    </button>
  );
}

function ToggleChip({ label, checked, onToggle }: { label: string; checked: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
        checked ? "border-primary/50 bg-primary/15 text-primary" : "border-border text-muted-foreground hover:border-primary/30"
      }`}
    >
      {label}
    </button>
  );
}

function SignaturePad({ onSign, signatureData }: { onSign: (data: string) => void; signatureData: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#1a1a2e";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, []);

  const getPos = (e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ("touches" in e) {
      const t = e.touches[0];
      return { x: (t.clientX - rect.left) * scaleX, y: (t.clientY - rect.top) * scaleY };
    }
    return { x: ((e as React.MouseEvent).clientX - rect.left) * scaleX, y: ((e as React.MouseEvent).clientY - rect.top) * scaleY };
  };

  const startDraw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    isDrawingRef.current = true;
    const ctx = canvas.getContext("2d")!;
    const { x, y } = getPos(e, canvas);
    ctx.beginPath();
    ctx.moveTo(x, y);
  }, []);

  const draw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (!isDrawingRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const { x, y } = getPos(e, canvas);
    ctx.lineTo(x, y);
    ctx.stroke();
  }, []);

  const endDraw = useCallback(() => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    const canvas = canvasRef.current;
    if (!canvas) return;
    onSign(canvas.toDataURL("image/png"));
  }, [onSign]);

  const clearPad = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    onSign("");
  };

  return (
    <div className="space-y-2">
      <div className="relative border-2 border-dashed border-border rounded-xl overflow-hidden bg-white">
        <canvas
          ref={canvasRef}
          width={600}
          height={200}
          className="w-full touch-none cursor-crosshair"
          style={{ display: "block" }}
          onMouseDown={startDraw}
          onMouseMove={draw}
          onMouseUp={endDraw}
          onMouseLeave={endDraw}
          onTouchStart={startDraw}
          onTouchMove={draw}
          onTouchEnd={endDraw}
        />
        {!signatureData && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="text-gray-300 text-sm">여기에 서명하세요</p>
          </div>
        )}
      </div>
      <div className="flex justify-between items-center">
        <p className="text-[10px] text-muted-foreground">손가락 또는 마우스로 서명해 주세요</p>
        <button type="button" onClick={clearPad} className="text-xs text-muted-foreground border border-border rounded-lg px-3 py-1 hover:border-red-500/50 hover:text-red-400 transition-colors">
          지우기
        </button>
      </div>
    </div>
  );
}

const PRODUCT_CATEGORIES = [
  { value: "all", label: "전체" },
  { value: "membership", label: "회원권" },
  { value: "pt", label: "PT" },
  { value: "supplement", label: "보충제" },
  { value: "goods", label: "용품" },
  { value: "other", label: "기타" },
];

const PAYMENT_METHODS = [
  { value: "points", label: "포인트 결제", icon: "◈" },
  { value: "cash", label: "현장 현금", icon: "₩" },
  { value: "transfer", label: "계좌이체", icon: "→" },
  { value: "card", label: "카드결제", icon: "▣" },
];

export default function GymPlusProfile() {
  const utils = trpc.useUtils();
  const { data: member } = trpc.gymPlus.memberMe.useQuery();
  const { data: health, refetch: refetchHealth } = trpc.gymPlus.getHealth.useQuery();
  const { data: products } = trpc.gymPlus.listProducts.useQuery();
  const [activeTab, setActiveTab] = useState<"service" | "info">("service");
  const [productCategory, setProductCategory] = useState("all");
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [paymentMethod, setPaymentMethod] = useState("points");
  const [purchaseNote, setPurchaseNote] = useState("");
  const [showChargeModal, setShowChargeModal] = useState(false);
  const [showPurchaseDone, setShowPurchaseDone] = useState<{ status: string; productName: string } | null>(null);

  const requestPurchase = trpc.gymPlus.requestPurchase.useMutation({
    onSuccess: (res) => {
      utils.gymPlus.memberMe.invalidate();
      setShowPurchaseDone({ status: res.status, productName: selectedProduct?.name ?? "" });
      setSelectedProduct(null);
      setPurchaseNote("");
    },
    onError: (e) => toast.error(e.message),
  });

  const [profileForm, setProfileForm] = useState({ name: "", phone: "", email: "" });
  const [profileEditing, setProfileEditing] = useState(false);
  const [profileMsg, setProfileMsg] = useState("");

  const [pwForm, setPwForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [pwMsg, setPwMsg] = useState("");
  const [pwExpanded, setPwExpanded] = useState(false);

  // 미션 모달 상태
  const [showGymRules, setShowGymRules] = useState(false);
  const [gymRulesChecked, setGymRulesChecked] = useState(false);
  const [showAppGuide, setShowAppGuide] = useState(false);
  const [showParq, setShowParq] = useState(false);
  const [parqData, setParqData] = useState<ParqData>(defaultParqData);
  const pendingHealthAction = useRef<"gymRules" | "appGuide" | "parq" | null>(null);

  // 재등록 신청 모달
  const [showRenewal, setShowRenewal] = useState(false);
  const [renewalStep, setRenewalStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [signatureData, setSignatureData] = useState<string>("");
  const [renewalForm, setRenewalForm] = useState({
    requestedPeriod: "1개월",
    memberName: "",
    memberPhone: "",
    notes: "",
    agreedToTerms: false,
    agreedPrivacy: false,
    agreedMarketing: false,
    paymentMethod: "",
  });
  const [contractDate, setContractDate] = useState("");

  const requestRenewal = trpc.gymPlus.requestRenewal.useMutation({
    onSuccess: () => {
      utils.gymPlus.memberMe.invalidate();
      setRenewalStep(5);
    },
    onError: (e) => toast.error(e.message || "신청 실패"),
  });

  const upsertHealth = trpc.gymPlus.upsertHealth.useMutation({
    onSuccess: () => {
      refetchHealth();
      const action = pendingHealthAction.current;
      pendingHealthAction.current = null;
      if (action === "gymRules") { setShowGymRules(false); toast.success("센터 이용규정 동의가 완료되었습니다."); }
      else if (action === "appGuide") { setShowAppGuide(false); toast.success("이용방법 안내 확인이 완료되었습니다."); }
      else if (action === "parq") { setShowParq(false); toast.success("PAR-Q 건강설문이 완료되었습니다."); }
    },
    onError: (e) => {
      pendingHealthAction.current = null;
      toast.error(e.message || "저장에 실패했습니다. 다시 시도해 주세요.");
    },
  });

  const updateProfile = trpc.gymPlus.updateProfile.useMutation({
    onSuccess: () => {
      utils.gymPlus.memberMe.invalidate();
      setProfileEditing(false);
      setProfileMsg("정보가 저장되었습니다.");
      setTimeout(() => setProfileMsg(""), 3000);
    },
    onError: (e) => setProfileMsg(e.message || "저장 실패"),
  });

  const changePassword = trpc.gymPlus.changePassword.useMutation({
    onSuccess: () => {
      setPwForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setPwMsg("비밀번호가 변경되었습니다.");
      setPwExpanded(false);
      setTimeout(() => setPwMsg(""), 3000);
    },
    onError: (e) => setPwMsg(e.message || "변경 실패"),
  });

  const startEdit = () => {
    setProfileForm({ name: member?.name ?? "", phone: member?.phone ?? "", email: member?.email ?? "" });
    setProfileEditing(true);
    setProfileMsg("");
  };

  const submitProfile = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfile.mutate({ name: profileForm.name || undefined, phone: profileForm.phone || undefined, email: profileForm.email || undefined });
  };

  const submitPassword = (e: React.FormEvent) => {
    e.preventDefault();
    setPwMsg("");
    if (pwForm.newPassword !== pwForm.confirmPassword) { setPwMsg("새 비밀번호가 일치하지 않습니다."); return; }
    changePassword.mutate({ currentPassword: pwForm.currentPassword, newPassword: pwForm.newPassword });
  };

  function getRenewalBonus(days: number | null): { days: number; label: string; desc: string; color: string } {
    if (days === null) return { days: 0, label: "", desc: "", color: "" };
    if (days >= 30) return { days: 14, label: "2주 서비스 혜택", desc: "만료 1개월 전 등록 시", color: "text-green-400" };
    if (days >= 5) return { days: 7, label: "7일 서비스 혜택", desc: "만료 1개월 이내 등록 시", color: "text-blue-400" };
    if (days >= 0) return { days: 3, label: "3일 서비스 혜택", desc: "만료 5일 전 등록 시", color: "text-yellow-400" };
    return { days: 0, label: "", desc: "만료된 회원권", color: "text-red-400" };
  }

  const openRenewal = () => {
    setRenewalForm(p => ({
      ...p,
      memberName: member?.name ?? "",
      memberPhone: member?.phone ?? "",
      agreedToTerms: false,
      agreedPrivacy: false,
      agreedMarketing: false,
      paymentMethod: "",
    }));
    setContractDate(new Date().toLocaleDateString("ko-KR"));
    setSignatureData("");
    setRenewalStep(1);
    setShowRenewal(true);
  };

  const closeRenewal = () => {
    setShowRenewal(false);
    setRenewalStep(1);
    setSignatureData("");
  };

  const submitRenewal = () => {
    if (!signatureData) { toast.error("서명을 완료해 주세요."); return; }
    const bonus = getRenewalBonus(daysLeft);
    const notesWithPayment = [
      renewalForm.paymentMethod ? `결제방법: ${renewalForm.paymentMethod}` : "",
      renewalForm.notes,
    ].filter(Boolean).join("\n");
    requestRenewal.mutate({
      requestedPeriod: renewalForm.requestedPeriod,
      bonusDays: bonus.days,
      memberName: renewalForm.memberName || undefined,
      memberPhone: renewalForm.memberPhone || undefined,
      notes: notesWithPayment || undefined,
      agreedToTerms: 1,
      agreedPrivacy: 1,
      agreedMarketing: renewalForm.agreedMarketing ? 1 : 0,
      trainerName: "본인계약",
      contractDate,
      signatureData,
    });
  };

  const openContractPrint = () => {
    const p = new URLSearchParams({
      name: renewalForm.memberName,
      phone: renewalForm.memberPhone,
      date: contractDate,
      marketing: renewalForm.agreedMarketing ? "1" : "0",
    });
    window.open(`/contract-print?${p.toString()}`, "_blank");
  };

  const shareViaKakao = () => {
    const p = new URLSearchParams({
      name: renewalForm.memberName,
      phone: renewalForm.memberPhone,
      date: contractDate,
      marketing: renewalForm.agreedMarketing ? "1" : "0",
    });
    const url = `${window.location.origin}/contract-print?${p.toString()}`;
    if (navigator.share) {
      navigator.share({ title: `${renewalForm.memberName} 님 자이언트짐 재등록 계약서`, url }).catch(() => {});
    } else {
      window.open(url, "_blank");
    }
  };

  // 미션 핸들러
  const submitGymRules = () => {
    if (!gymRulesChecked) { toast.error("이용규정에 동의해 주세요."); return; }
    pendingHealthAction.current = "gymRules";
    upsertHealth.mutate({ gymRulesAgreed: 1 });
  };

  const submitAppGuide = () => {
    pendingHealthAction.current = "appGuide";
    upsertHealth.mutate({ appGuideConfirmed: 1 });
  };

  const openParq = () => {
    if (health?.parqJson) {
      try { setParqData(JSON.parse(health.parqJson)); } catch { setParqData(defaultParqData); }
    } else {
      setParqData(defaultParqData);
    }
    setShowParq(true);
  };

  const submitParq = () => {
    pendingHealthAction.current = "parq";
    upsertHealth.mutate({ parqJson: JSON.stringify(parqData) });
  };

  const setPD = (key: keyof ParqData, value: any) => setParqData(p => ({ ...p, [key]: value }));

  // 미션 완료 여부
  const mission1Done = !!(health?.gymRulesAgreed);
  const mission2Done = !!(health?.appGuideConfirmed);
  const mission3Done = !!(health?.parqJson);
  const allMissionsDone = mission1Done && mission2Done && mission3Done;

  const daysLeft = daysUntil(member?.membershipEnd);

  return (
    <div className="space-y-0">
      {/* 헤더 + 탭 */}
      <div className="bg-white border-b border-gray-100 px-4 pt-4 pb-0">
        <h1 className="font-bold text-lg text-[#1a2b4b] mb-3">인포데스크</h1>
        <div className="flex gap-0">
          {(["service", "info"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2.5 text-[13px] font-semibold transition-colors border-b-2 ${
                activeTab === tab
                  ? "border-[#1D4ED8] text-[#1D4ED8]"
                  : "border-transparent text-gray-400"
              }`}
            >
              {tab === "service" ? "서비스 상품" : "내정보"}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 space-y-4">

      {/* ── 서비스 상품 탭 ── */}
      {activeTab === "service" && (<>

      {/* 포인트 카드 */}
      <div className="bg-gradient-to-br from-[#1D4ED8] to-[#2563EB] rounded-2xl p-5 text-white">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[11px] text-white/60 tracking-widest uppercase font-medium">MY POINTS</p>
            <p className="text-[36px] font-black leading-tight mt-1">
              {(member?.points ?? 0).toLocaleString("ko-KR")}
              <span className="text-lg font-semibold ml-1">P</span>
            </p>
            <p className="text-[11px] text-white/60 mt-1">{member?.name ?? "-"} 님의 보유 포인트</p>
          </div>
          <button
            onClick={() => setShowChargeModal(true)}
            className="mt-1 bg-white/20 hover:bg-white/30 transition-colors text-white text-xs font-bold px-3 py-2 rounded-xl"
          >
            충전 신청
          </button>
        </div>
      </div>

      {/* 카테고리 필터 */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
        {PRODUCT_CATEGORIES.map(cat => (
          <button
            key={cat.value}
            onClick={() => setProductCategory(cat.value)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
              productCategory === cat.value
                ? "bg-[#1D4ED8] text-white"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* 상품 목록 */}
      {(() => {
        const filtered = (products ?? []).filter(p =>
          productCategory === "all" || p.category === productCategory
        );
        if (filtered.length === 0) return (
          <div className="text-center py-10 text-muted-foreground text-sm">등록된 상품이 없습니다</div>
        );
        return (
          <div className="space-y-3">
            {filtered.map((p) => (
              <button
                key={p.id}
                onClick={() => { setSelectedProduct(p); setPaymentMethod("points"); setPurchaseNote(""); }}
                className="w-full border border-border rounded-2xl overflow-hidden bg-card text-left hover:border-primary/40 hover:shadow-md transition-all"
              >
                {p.imageUrl && (
                  <img src={p.imageUrl} alt={p.name} className="w-full h-36 object-cover" />
                )}
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-foreground">{p.name}</span>
                        {p.badgeText && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                            {p.badgeText}
                          </span>
                        )}
                      </div>
                      {p.description && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{p.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-baseline justify-between mt-3">
                    <div className="flex items-baseline gap-2">
                      <span className="text-lg font-black text-foreground">{p.price.toLocaleString("ko-KR")}원</span>
                      {p.originalPrice && p.originalPrice > p.price && (
                        <>
                          <span className="text-xs text-muted-foreground line-through">{p.originalPrice.toLocaleString("ko-KR")}원</span>
                          <span className="text-xs font-semibold text-red-400">
                            {Math.round((1 - p.price / p.originalPrice) * 100)}% OFF
                          </span>
                        </>
                      )}
                    </div>
                    <span className="text-xs text-primary font-semibold">구매 →</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        );
      })()}

      {/* 구매 모달 */}
      {selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSelectedProduct(null)} />
          <div className="relative bg-background rounded-t-3xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-5 space-y-5">
              {/* 상품 정보 */}
              <div className="flex items-start gap-3 pb-4 border-b border-border">
                {selectedProduct.imageUrl && (
                  <img src={selectedProduct.imageUrl} alt={selectedProduct.name} className="w-16 h-16 rounded-xl object-cover flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-base text-foreground">{selectedProduct.name}</span>
                    {selectedProduct.badgeText && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary">{selectedProduct.badgeText}</span>
                    )}
                  </div>
                  {selectedProduct.description && (
                    <p className="text-xs text-muted-foreground mt-1">{selectedProduct.description}</p>
                  )}
                  <div className="flex items-baseline gap-2 mt-2">
                    <span className="text-xl font-black text-foreground">{selectedProduct.price.toLocaleString("ko-KR")}원</span>
                    {selectedProduct.originalPrice && selectedProduct.originalPrice > selectedProduct.price && (
                      <span className="text-xs text-muted-foreground line-through">{selectedProduct.originalPrice.toLocaleString("ko-KR")}원</span>
                    )}
                  </div>
                </div>
              </div>

              {/* 결제 수단 선택 */}
              <div>
                <p className="text-xs font-semibold text-foreground mb-3">결제 수단</p>
                <div className="grid grid-cols-2 gap-2">
                  {PAYMENT_METHODS.map(pm => (
                    <button
                      key={pm.value}
                      onClick={() => setPaymentMethod(pm.value)}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        paymentMethod === pm.value
                          ? "border-primary bg-primary/5"
                          : "border-border bg-card"
                      }`}
                    >
                      <span className="text-base">{pm.icon}</span>
                      <p className="text-xs font-semibold mt-1 text-foreground">{pm.label}</p>
                      {pm.value === "points" && (
                        <p className={`text-[10px] mt-0.5 ${
                          (member?.points ?? 0) >= selectedProduct.price
                            ? "text-green-500"
                            : "text-red-400"
                        }`}>
                          보유 {(member?.points ?? 0).toLocaleString("ko-KR")}P
                          {(member?.points ?? 0) < selectedProduct.price && " (부족)"}
                        </p>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* 포인트 결제 안내 */}
              {paymentMethod === "points" && (
                <div className={`rounded-xl p-3 text-sm ${
                  (member?.points ?? 0) >= selectedProduct.price
                    ? "bg-green-500/10 border border-green-500/20"
                    : "bg-red-500/10 border border-red-500/20"
                }`}>
                  {(member?.points ?? 0) >= selectedProduct.price ? (
                    <p className="text-green-600 text-xs font-medium">
                      결제 후 잔여 포인트: {((member?.points ?? 0) - selectedProduct.price).toLocaleString("ko-KR")}P
                    </p>
                  ) : (
                    <p className="text-red-400 text-xs font-medium">
                      포인트가 {(selectedProduct.price - (member?.points ?? 0)).toLocaleString("ko-KR")}P 부족합니다
                    </p>
                  )}
                </div>
              )}

              {/* 현장결제 안내 */}
              {paymentMethod !== "points" && (
                <div className="bg-muted/50 rounded-xl p-3">
                  <p className="text-xs text-muted-foreground">신청 후 센터 직원에게 결제 방법을 안내받으세요.</p>
                </div>
              )}

              {/* 메모 */}
              <div>
                <p className="text-xs font-semibold text-foreground mb-1.5">요청사항 (선택)</p>
                <textarea
                  value={purchaseNote}
                  onChange={e => setPurchaseNote(e.target.value)}
                  placeholder="특이사항을 입력해주세요"
                  rows={2}
                  className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              {/* 버튼 */}
              <div className="flex gap-2 pb-2">
                <button
                  onClick={() => setSelectedProduct(null)}
                  className="flex-1 py-3 rounded-xl border border-border text-sm font-semibold text-muted-foreground"
                >
                  취소
                </button>
                <button
                  onClick={() => requestPurchase.mutate({ productId: selectedProduct.id, paymentMethod, note: purchaseNote || undefined })}
                  disabled={requestPurchase.isPending || (paymentMethod === "points" && (member?.points ?? 0) < selectedProduct.price)}
                  className="flex-1 py-3 rounded-xl bg-[#1D4ED8] text-white text-sm font-bold disabled:opacity-50"
                >
                  {requestPurchase.isPending ? "처리 중..." : paymentMethod === "points" ? "포인트로 결제" : "구매 신청"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 구매 완료 모달 */}
      {showPurchaseDone && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowPurchaseDone(null)} />
          <div className="relative bg-background rounded-2xl w-80 p-6 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto">
              <span className="text-3xl">✓</span>
            </div>
            <div>
              <p className="font-bold text-base text-foreground">
                {showPurchaseDone.status === "approved" ? "결제 완료" : "구매 신청 완료"}
              </p>
              <p className="text-sm text-muted-foreground mt-1">{showPurchaseDone.productName}</p>
              {showPurchaseDone.status === "pending" && (
                <p className="text-xs text-muted-foreground mt-2">센터에서 확인 후 처리됩니다.</p>
              )}
            </div>
            <button
              onClick={() => setShowPurchaseDone(null)}
              className="w-full py-3 rounded-xl bg-[#1D4ED8] text-white text-sm font-bold"
            >
              확인
            </button>
          </div>
        </div>
      )}

      {/* 포인트 충전 신청 모달 */}
      {showChargeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowChargeModal(false)} />
          <div className="relative bg-background rounded-2xl w-80 p-5 space-y-4">
            <p className="font-bold text-base text-foreground">포인트 충전 안내</p>
            <div className="bg-muted/50 rounded-xl p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">현재 보유 포인트</span>
                <span className="font-bold">{(member?.points ?? 0).toLocaleString("ko-KR")}P</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              포인트 충전은 센터 직원에게 문의하거나 카운터에서 직접 충전 가능합니다.<br />
              충전된 포인트로 상품을 구매하실 수 있습니다.
            </p>
            <button
              onClick={() => setShowChargeModal(false)}
              className="w-full py-3 rounded-xl bg-[#1D4ED8] text-white text-sm font-bold"
            >
              확인
            </button>
          </div>
        </div>
      )}

      </>)}

      {/* ── 내정보 탭 ── */}
      {activeTab === "info" && (<>

      {/* 회원권 카드 */}
      <div className="bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 rounded-2xl p-5 space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-muted-foreground text-xs">회원명</p>
            <p className="font-bold text-xl mt-0.5">{member?.name ?? "-"}</p>
          </div>
          {member?.membershipType && (
            <span className={`text-xs px-3 py-1 rounded-full border font-semibold ${membershipTypeBadge[member.membershipType] ?? ""}`}>
              {membershipTypeLabel[member.membershipType] ?? member.membershipType}
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-background/50 rounded-xl p-3">
            <p className="text-[10px] text-muted-foreground">회원권 시작</p>
            <p className="font-semibold text-sm mt-0.5">{formatDate(member?.membershipStart)}</p>
          </div>
          <div className="bg-background/50 rounded-xl p-3">
            <p className="text-[10px] text-muted-foreground">회원권 만료</p>
            <p className="font-semibold text-sm mt-0.5">{formatDate(member?.membershipEnd)}</p>
          </div>
        </div>
        {daysLeft !== null && (() => {
          const bonus = getRenewalBonus(daysLeft);
          return (
            <button
              onClick={openRenewal}
              className={`w-full rounded-xl p-3 text-center transition-colors hover:opacity-80 ${
                daysLeft <= 0 ? "bg-red-500/20 border border-red-500/30" :
                daysLeft <= 7 ? "bg-orange-500/20 border border-orange-500/30" :
                "bg-green-500/10 border border-green-500/20"
              }`}
            >
              <p className="text-xs text-muted-foreground">회원권 남은 기간</p>
              <p className={`font-black text-2xl mt-0.5 ${
                daysLeft <= 0 ? "text-red-400" : daysLeft <= 7 ? "text-orange-400" : "text-green-400"
              }`}>
                {daysLeft > 0 ? `D-${daysLeft}` : daysLeft === 0 ? "오늘 만료" : "만료됨"}
              </p>
              {bonus.days > 0 && (
                <div className="mt-2 pt-2 border-t border-white/10">
                  <p className={`text-xs font-semibold ${bonus.color}`}>지금 재등록하면 {bonus.label}!</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{bonus.desc} · 탭하여 재등록 신청</p>
                </div>
              )}
              {bonus.days === 0 && daysLeft <= 0 && (
                <p className="text-xs text-muted-foreground mt-1.5">탭하여 재등록 신청</p>
              )}
            </button>
          );
        })()}
      </div>

      {/* 추천 운동 활성화 미션 */}
      <div className="bg-card border border-border rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-sm">추천 운동 활성화 미션</h2>
            <p className="text-xs text-muted-foreground mt-0.5">3가지 미션을 완료하면 맞춤 추천 운동이 활성화됩니다</p>
          </div>
          <span className={`text-xs px-2 py-0.5 rounded-full ${allMissionsDone ? "bg-green-500/20 text-green-400" : "bg-muted text-muted-foreground"}`}>
            {[mission1Done, mission2Done, mission3Done].filter(Boolean).length}/3
          </span>
        </div>

        {allMissionsDone && (
          <div className="bg-green-500/10 border border-green-500/30 rounded-xl px-3 py-2 text-center">
            <p className="text-xs text-green-600 font-semibold">모든 미션 완료 · 추천 운동이 활성화됩니다</p>
          </div>
        )}

        <div className="space-y-2">
          <MissionCard
            icon="①"
            title="센터 이용규정 안내 동의"
            description={mission1Done ? "이용규정 동의 완료" : "자이언트짐+ 센터 이용규정을 확인하고 동의하세요"}
            done={mission1Done}
            onPress={() => setShowGymRules(true)}
          />
          <MissionCard
            icon="②"
            title="자이언트짐+ 이용방법 안내 확인"
            description={mission2Done ? "이용방법 안내 확인 완료" : "앱 사용법 및 센터 이용 안내를 확인하세요"}
            done={mission2Done}
            onPress={() => setShowAppGuide(true)}
          />
          <MissionCard
            icon="③"
            title="PAR-Q 완료"
            description={mission3Done ? "사전 건강설문 완료" : "운동 시작 전 건강 상태를 알려주세요"}
            done={mission3Done}
            onPress={openParq}
          />
        </div>
      </div>

      {/* 회원정보 편집 */}
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-sm">회원 정보</h2>
          {!profileEditing && <button onClick={startEdit} className="text-xs text-primary">수정</button>}
        </div>
        {profileEditing ? (
          <form onSubmit={submitProfile} className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">이름</Label>
              <Input value={profileForm.name} onChange={(e) => setProfileForm((p) => ({ ...p, name: e.target.value }))} placeholder="이름" className="bg-input border-border h-9 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">연락처</Label>
              <Input value={profileForm.phone} onChange={(e) => setProfileForm((p) => ({ ...p, phone: e.target.value }))} placeholder="010-0000-0000" className="bg-input border-border h-9 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">이메일</Label>
              <Input value={profileForm.email} onChange={(e) => setProfileForm((p) => ({ ...p, email: e.target.value }))} placeholder="email@example.com" className="bg-input border-border h-9 text-sm" />
            </div>
            <div className="flex gap-2">
              <Button type="submit" size="sm" className="flex-1" disabled={updateProfile.isPending}>{updateProfile.isPending ? "저장 중..." : "저장"}</Button>
              <Button type="button" size="sm" variant="outline" className="flex-1" onClick={() => { setProfileEditing(false); setProfileMsg(""); }}>취소</Button>
            </div>
          </form>
        ) : (
          <div className="space-y-2">
            {[
              { label: "아이디", value: member?.username },
              { label: "이름", value: member?.name ?? "-" },
              { label: "연락처", value: member?.phone ?? "-" },
              { label: "이메일", value: member?.email ?? "-" },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
                <span className="text-xs text-muted-foreground">{item.label}</span>
                <span className="text-xs font-medium">{item.value}</span>
              </div>
            ))}
          </div>
        )}
        {profileMsg && <p className={`text-xs mt-2 ${profileMsg.includes("저장") ? "text-green-400" : "text-red-400"}`}>{profileMsg}</p>}
      </div>

      {/* 비밀번호 변경 */}
      <div className="bg-card border border-border rounded-xl p-4">
        <button className="w-full flex items-center justify-between" onClick={() => { setPwExpanded((v) => !v); setPwMsg(""); }}>
          <h2 className="font-semibold text-sm">비밀번호 변경</h2>
          <span className="text-xs text-muted-foreground">{pwExpanded ? "▲" : "▼"}</span>
        </button>
        {pwExpanded && (
          <form onSubmit={submitPassword} className="mt-3 space-y-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">현재 비밀번호</Label>
              <Input type="password" value={pwForm.currentPassword} onChange={(e) => setPwForm((p) => ({ ...p, currentPassword: e.target.value }))} placeholder="현재 비밀번호" className="bg-input border-border h-9 text-sm" autoComplete="current-password" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">새 비밀번호</Label>
              <Input type="password" value={pwForm.newPassword} onChange={(e) => setPwForm((p) => ({ ...p, newPassword: e.target.value }))} placeholder="6자 이상" className="bg-input border-border h-9 text-sm" autoComplete="new-password" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">새 비밀번호 확인</Label>
              <Input type="password" value={pwForm.confirmPassword} onChange={(e) => setPwForm((p) => ({ ...p, confirmPassword: e.target.value }))} placeholder="비밀번호 재입력" className="bg-input border-border h-9 text-sm" autoComplete="new-password" />
            </div>
            <Button type="submit" size="sm" className="w-full" disabled={changePassword.isPending}>{changePassword.isPending ? "변경 중..." : "비밀번호 변경"}</Button>
          </form>
        )}
        {pwMsg && <p className={`text-xs mt-2 ${pwMsg.includes("변경") ? "text-green-400" : "text-red-400"}`}>{pwMsg}</p>}
      </div>

      </>)}

      </div>{/* /p-4 */}

      {/* 센터 이용규정 모달 */}
      {showGymRules && (
        <Dialog open onOpenChange={(o) => { if (!o) setShowGymRules(false); }}>
          <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <h2 className="font-bold text-base">센터 이용규정 안내</h2>
              <p className="text-xs text-muted-foreground">아래 이용규정을 확인하고 동의해 주세요</p>
            </DialogHeader>
            <div className="space-y-4 pt-1">
              <div className="bg-muted/20 border border-border rounded-xl p-4 text-[11px] text-muted-foreground leading-relaxed max-h-72 overflow-y-auto whitespace-pre-wrap">{`제1조 (목적)
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
① PT 이용권은 계약 시작일로부터 효력이 발생합니다.
② 이용권의 환불은 관련 법령 및 센터 환불 규정에 따릅니다.
③ 회원 개인 사정으로 인한 중도 해지 시 잔여 횟수에 따라 환불이 이루어집니다.
④ 부상·질병 등 불가피한 사유가 있을 경우 이용 정지 신청이 가능합니다.

제5조 (면책 조항)
① 센터는 회원이 센터 내에서 발생한 사고에 대해 센터의 과실이 없는 경우 책임을 지지 않습니다.
② 개인 소지품 분실에 대해 센터는 책임을 지지 않습니다.
③ 회원은 자신의 건강 상태를 정확히 고지하여야 하며, 허위 고지로 인한 문제는 회원 본인이 책임집니다.

제6조 (회원 자격 박탈)
다음 각 호에 해당하는 경우 센터는 회원 자격을 박탈할 수 있습니다.
① 타인에게 폭언·폭행 등 위해를 가한 경우
② 센터 시설물을 고의로 파손한 경우
③ 본 약관을 위반한 경우`}</div>

              <button
                type="button"
                onClick={() => setGymRulesChecked(v => !v)}
                className="flex items-center gap-3 w-full p-3 rounded-xl border border-border hover:border-primary/50 transition-colors"
              >
                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${gymRulesChecked ? "bg-primary border-primary" : "border-border"}`}>
                  {gymRulesChecked && <span className="text-[10px] text-primary-foreground font-bold">✓</span>}
                </div>
                <span className={`text-sm font-medium ${gymRulesChecked ? "text-foreground" : "text-muted-foreground"}`}>위 이용규정을 모두 읽었으며 동의합니다</span>
              </button>

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1 h-10" onClick={() => setShowGymRules(false)}>닫기</Button>
                <Button className="flex-1 h-10" disabled={!gymRulesChecked || upsertHealth.isPending} onClick={submitGymRules}>
                  {upsertHealth.isPending ? "처리 중..." : "동의 완료"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* 자이언트짐+ 이용방법 안내 모달 */}
      {showAppGuide && (
        <Dialog open onOpenChange={(o) => { if (!o) setShowAppGuide(false); }}>
          <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <h2 className="font-bold text-base">자이언트짐+ 이용방법 안내</h2>
              <p className="text-xs text-muted-foreground">앱 사용법 및 센터 이용 방법을 확인해 주세요</p>
            </DialogHeader>
            <div className="space-y-4 pt-1">

              <div className="space-y-3">
                {[
                  {
                    icon: "01",
                    title: "트레이닝 일지 확인",
                    desc: "트레이너가 전송한 운동 프로그램을 '운동' 탭에서 확인하세요. 운동 시작 버튼을 눌러 실시간으로 세트/횟수/무게를 기록할 수 있습니다.",
                  },
                  {
                    icon: "▶️",
                    title: "운동 시작하기",
                    desc: "트레이닝 일지에서 '▶ 운동 시작' 버튼을 탭하면 운동 타이머와 세트 기록 화면이 열립니다. 각 세트 완료 후 체크하고 운동을 기록하세요.",
                  },
                  {
                    icon: "02",
                    title: "운동 기록 관리",
                    desc: "완료된 운동은 자동으로 기록되며, 날짜별로 이력을 확인할 수 있습니다. 체중·컨디션·수면 정보도 함께 기록해 보세요.",
                  },
                  {
                    icon: "03",
                    title: "추천 운동 활성화",
                    desc: "3가지 미션(이용규정 동의, 이용방법 확인, PAR-Q)을 완료하면 맞춤형 추천 운동이 활성화됩니다.",
                  },
                  {
                    icon: "04",
                    title: "센터 출입 확인",
                    desc: "센터 방문 시 QR코드 또는 앱을 통해 출입을 확인할 수 있습니다.",
                  },
                  {
                    icon: "05",
                    title: "회원권 재등록",
                    desc: "'내 정보' 탭에서 회원권 만료일을 확인하고 온라인으로 재등록 신청을 할 수 있습니다. 만료 전 재등록 시 추가 혜택이 있습니다.",
                  },
                ].map(item => (
                  <div key={item.title} className="flex gap-3 p-3 rounded-xl bg-muted/20 border border-border">
                    <span className="text-xl flex-shrink-0">{item.icon}</span>
                    <div>
                      <p className="text-sm font-semibold">{item.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="bg-primary/10 border border-primary/20 rounded-xl p-3">
                <p className="text-xs text-primary font-semibold">문의 및 도움말</p>
                <p className="text-xs text-muted-foreground mt-0.5">앱 사용 중 궁금한 점은 센터 담당 트레이너에게 문의해 주세요.</p>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1 h-10" onClick={() => setShowAppGuide(false)}>닫기</Button>
                <Button className="flex-1 h-10" disabled={upsertHealth.isPending} onClick={submitAppGuide}>
                  {upsertHealth.isPending ? "처리 중..." : "확인 완료"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* PAR-Q 건강 설문 — 새 모바일 친화형 위저드 */}
      {showParq && (
        <GymPlusHealthSurvey
          initialData={health}
          onComplete={() => {
            setShowParq(false);
            utils.gymPlus.getHealth.invalidate();
            toast.success('건강 설문이 저장되었습니다.');
          }}
        />
      )}

      {/* 회원권 재등록 신청 모달 (5단계) */}
      {showRenewal && (() => {
        const bonus = getRenewalBonus(daysLeft);
        const allRequired = renewalForm.agreedToTerms && renewalForm.agreedPrivacy;
        return (
          <Dialog open onOpenChange={(o) => { if (!o) closeRenewal(); }}>
            <DialogContent className="max-w-sm max-h-[92vh] overflow-y-auto">

              {/* 단계 1: 기본 정보 */}
              {renewalStep === 1 && (
                <>
                  <DialogHeader>
                    <h2 className="font-bold text-base">재등록 신청</h2>
                    <p className="text-xs text-muted-foreground">아래 내용을 확인하고 재등록을 신청하세요</p>
                  </DialogHeader>
                  <div className="space-y-4 pt-1">
                    <div className="bg-muted/30 rounded-xl p-3 space-y-1.5 text-xs">
                      <div className="flex justify-between"><span className="text-muted-foreground">회원명</span><span className="font-medium">{member?.name}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">현재 만료일</span><span className="font-medium">{formatDate(member?.membershipEnd)}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">남은 기간</span><span className={`font-bold ${daysLeft !== null && daysLeft <= 7 ? "text-orange-400" : "text-foreground"}`}>{daysLeft !== null ? (daysLeft > 0 ? `D-${daysLeft}` : "만료") : "-"}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">담당자</span><span className="font-medium">본인계약</span></div>
                    </div>

                    {bonus.days > 0 && (
                      <div className={`rounded-xl p-3 border ${bonus.color === "text-green-400" ? "bg-green-500/10 border-green-500/30" : bonus.color === "text-blue-400" ? "bg-blue-500/10 border-blue-500/30" : "bg-yellow-500/10 border-yellow-500/30"}`}>
                        <p className={`text-xs font-semibold ${bonus.color}`}>{bonus.label} 적용!</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{bonus.desc} — 재등록 기간에 {bonus.days}일이 추가됩니다</p>
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">재등록 기간 선택</Label>
                      <div className="grid grid-cols-2 gap-2">
                        {["1개월", "3개월", "6개월", "12개월"].map(p => (
                          <button key={p} type="button"
                            className={`py-2.5 rounded-xl border text-sm font-medium transition-colors flex flex-col items-center gap-0.5 ${renewalForm.requestedPeriod === p ? "bg-primary/20 border-primary text-primary" : "border-border text-muted-foreground"}`}
                            onClick={() => setRenewalForm(f => ({ ...f, requestedPeriod: p }))}
                          >
                            <span>{p}</span>
                            <span className="text-xs font-normal">{PERIOD_PRICES[p]?.toLocaleString()}원</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">이름</Label>
                      <Input value={renewalForm.memberName} onChange={(e) => setRenewalForm(f => ({ ...f, memberName: e.target.value }))} placeholder="이름" className="bg-input border-border h-9 text-sm" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">연락처</Label>
                      <Input value={renewalForm.memberPhone} onChange={(e) => setRenewalForm(f => ({ ...f, memberPhone: e.target.value }))} placeholder="010-0000-0000" className="bg-input border-border h-9 text-sm" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">특이사항 (선택)</Label>
                      <textarea
                        value={renewalForm.notes}
                        onChange={(e) => setRenewalForm(f => ({ ...f, notes: e.target.value }))}
                        placeholder="요청사항이나 특이사항을 입력하세요"
                        className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm resize-none h-16"
                      />
                    </div>

                    <div className="flex gap-2 pt-1">
                      <Button variant="outline" className="flex-1 h-9" onClick={closeRenewal}>취소</Button>
                      <Button className="flex-1 h-9" onClick={() => setRenewalStep(2)}>다음 →</Button>
                    </div>
                  </div>
                </>
              )}

              {/* 단계 2: 결제 방법 선택 */}
              {renewalStep === 2 && (
                <>
                  <DialogHeader>
                    <h2 className="font-bold text-base">💳 결제 방법 선택</h2>
                    <p className="text-xs text-muted-foreground">결제 금액 및 방법을 확인해 주세요</p>
                  </DialogHeader>
                  <div className="space-y-4 pt-1">
                    <div className="bg-primary/10 border border-primary/20 rounded-xl p-4 text-center">
                      <p className="text-xs text-muted-foreground mb-1">{renewalForm.requestedPeriod} 이용권</p>
                      <p className="text-2xl font-bold text-primary">{PERIOD_PRICES[renewalForm.requestedPeriod]?.toLocaleString()}원</p>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">결제 방법을 선택해 주세요</Label>

                      <button type="button"
                        onClick={() => setRenewalForm(f => ({ ...f, paymentMethod: "계좌이체" }))}
                        className={`w-full p-3 rounded-xl border text-left transition-colors ${renewalForm.paymentMethod === "계좌이체" ? "border-primary/50 bg-primary/10" : "border-border bg-card"}`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-xl">🏦</span>
                          <div className="flex-1">
                            <p className="text-sm font-semibold">계좌이체</p>
                            <p className="text-xs text-muted-foreground">카카오뱅크 3333-05-2664409</p>
                            <p className="text-xs text-muted-foreground">예금주: (자이언트짐)</p>
                          </div>
                          {renewalForm.paymentMethod === "계좌이체" && <span className="text-primary text-sm font-bold">✓</span>}
                        </div>
                      </button>

                      {renewalForm.paymentMethod === "계좌이체" && (
                        <button type="button"
                          onClick={() => { navigator.clipboard.writeText("333305266409"); toast.success("계좌번호가 복사되었습니다"); }}
                          className="w-full py-2 rounded-lg bg-yellow-400/20 border border-yellow-400/30 text-yellow-500 text-xs font-semibold"
                        >
                          계좌번호 복사하기
                        </button>
                      )}

                      <button type="button"
                        onClick={() => setRenewalForm(f => ({ ...f, paymentMethod: "카드" }))}
                        className={`w-full p-3 rounded-xl border text-left transition-colors ${renewalForm.paymentMethod === "카드" ? "border-primary/50 bg-primary/10" : "border-border bg-card"}`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-xl">💳</span>
                          <div className="flex-1">
                            <p className="text-sm font-semibold">카드 결제</p>
                            <p className="text-xs text-muted-foreground">센터 방문 시 결제 가능합니다</p>
                          </div>
                          {renewalForm.paymentMethod === "카드" && <span className="text-primary text-sm font-bold">✓</span>}
                        </div>
                      </button>

                      <button type="button"
                        onClick={() => setRenewalForm(f => ({ ...f, paymentMethod: "지역화폐" }))}
                        className={`w-full p-3 rounded-xl border text-left transition-colors ${renewalForm.paymentMethod === "지역화폐" ? "border-primary/50 bg-primary/10" : "border-border bg-card"}`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-xl">🏪</span>
                          <div className="flex-1">
                            <p className="text-sm font-semibold">지역화폐</p>
                            <p className="text-xs text-muted-foreground">센터 방문 시 결제 가능합니다</p>
                          </div>
                          {renewalForm.paymentMethod === "지역화폐" && <span className="text-primary text-sm font-bold">✓</span>}
                        </div>
                      </button>
                    </div>

                    <div className="flex gap-2 pt-1">
                      <Button variant="outline" className="flex-1 h-9" onClick={() => setRenewalStep(1)}>← 이전</Button>
                      <Button className="flex-1 h-9" disabled={!renewalForm.paymentMethod} onClick={() => setRenewalStep(3)}>
                        다음 →
                      </Button>
                    </div>
                  </div>
                </>
              )}

              {/* 단계 3: 약관 동의 */}
              {renewalStep === 3 && (
                <>
                  <DialogHeader>
                    <h2 className="font-bold text-base">📄 약관 동의</h2>
                    <p className="text-xs text-muted-foreground">아래 약관을 읽고 동의해 주세요</p>
                  </DialogHeader>
                  <div className="space-y-4 pt-1">

                    <button
                      type="button"
                      className={`w-full flex items-center gap-2 p-3 rounded-xl border transition-colors ${allRequired && renewalForm.agreedMarketing ? "border-primary/50 bg-primary/5" : "border-border"}`}
                      onClick={() => {
                        const next = !(allRequired && renewalForm.agreedMarketing);
                        setRenewalForm(f => ({ ...f, agreedToTerms: next, agreedPrivacy: next, agreedMarketing: next }));
                      }}
                    >
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${allRequired && renewalForm.agreedMarketing ? "bg-primary border-primary" : "border-border"}`}>
                        {allRequired && renewalForm.agreedMarketing && <span className="text-[10px] text-primary-foreground font-bold">✓</span>}
                      </div>
                      <span className="text-sm font-semibold">전체 동의</span>
                    </button>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold">센터 이용약관 <span className="text-red-400">(필수)</span></span>
                      </div>
                      <div className="bg-muted/20 border border-border rounded-lg p-3 h-28 overflow-y-auto text-[10px] text-muted-foreground leading-relaxed whitespace-pre-wrap">{`제1조 (목적)\n본 약관은 자이언트짐(이하 "센터")이 제공하는 피트니스 서비스 이용에 관한 제반 사항을 규정함을 목적으로 합니다.\n\n제2조 (회원의 의무)\n① 회원은 센터의 시설 및 기구를 타인에게 피해가 가지 않도록 올바르게 사용하여야 합니다.\n② 회원은 센터 내에서 타인을 방해하거나 불쾌감을 주는 행위를 하여서는 안 됩니다.\n③ 운동 후 사용한 기구는 반드시 제자리에 정리하여야 합니다.\n④ 센터 내 음식물 반입은 허용되지 않으며, 음료는 개인 물병만 허용합니다.\n\n제3조 (이용 시간 및 시설)\n① 센터의 운영 시간은 별도 공지에 따릅니다.\n② 회원은 운영 시간 내에만 센터를 이용할 수 있습니다.\n\n제4조 (이용권 및 환불)\n① PT 이용권은 계약 시작일로부터 효력이 발생합니다.\n② 이용권의 환불은 관련 법령 및 센터 환불 규정에 따릅니다.\n③ 회원 개인 사정으로 인한 중도 해지 시 잔여 횟수에 따라 환불이 이루어집니다.\n④ 부상·질병 등 불가피한 사유가 있을 경우 이용 정지 신청이 가능합니다.\n\n제5조 (면책 조항)\n① 센터는 회원이 센터 내에서 발생한 사고에 대해 센터의 과실이 없는 경우 책임을 지지 않습니다.\n② 개인 소지품 분실에 대해 센터는 책임을 지지 않습니다.`}</div>
                      <button type="button" className="flex items-center gap-2 text-sm" onClick={() => setRenewalForm(f => ({ ...f, agreedToTerms: !f.agreedToTerms }))}>
                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${renewalForm.agreedToTerms ? "bg-primary border-primary" : "border-border"}`}>
                          {renewalForm.agreedToTerms && <span className="text-[10px] text-primary-foreground font-bold">✓</span>}
                        </div>
                        <span className={`text-xs ${renewalForm.agreedToTerms ? "text-foreground" : "text-muted-foreground"}`}>위 이용약관에 동의합니다 (필수)</span>
                      </button>
                    </div>

                    <div className="space-y-2">
                      <span className="text-xs font-semibold">개인정보 수집·이용 동의 <span className="text-red-400">(필수)</span></span>
                      <div className="bg-muted/20 border border-border rounded-lg p-3 h-28 overflow-y-auto text-[10px] text-muted-foreground leading-relaxed whitespace-pre-wrap">{`수집하는 개인정보 항목\n- 필수항목: 성명, 연락처, 성별, 생년월일\n- 선택항목: 이메일 주소, 건강 정보(운동 목적, 부상 이력 등)\n\n개인정보의 수집 및 이용 목적\n① 피트니스 서비스 제공 및 회원 관리\n② PT 프로그램 안내 및 일정 관리\n③ 결제 및 환불 처리\n④ 고객 상담 및 민원 처리\n⑤ 서비스 개선을 위한 통계 분석\n\n개인정보의 보유 및 이용 기간\n- 회원 탈퇴 시 또는 이용 목적 달성 후 즉시 파기\n- 단, 관련 법령에 따라 보존 의무가 있는 경우 해당 기간 보관\n\n개인정보의 제3자 제공\n- 원칙적으로 외부에 제공하지 않으며, 법령의 규정에 의한 경우 또는 이용자가 사전에 동의한 경우에 한해 제공합니다.\n\n귀하는 개인정보 제공에 동의하지 않을 권리가 있습니다.`}</div>
                      <button type="button" className="flex items-center gap-2 text-sm" onClick={() => setRenewalForm(f => ({ ...f, agreedPrivacy: !f.agreedPrivacy }))}>
                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${renewalForm.agreedPrivacy ? "bg-primary border-primary" : "border-border"}`}>
                          {renewalForm.agreedPrivacy && <span className="text-[10px] text-primary-foreground font-bold">✓</span>}
                        </div>
                        <span className={`text-xs ${renewalForm.agreedPrivacy ? "text-foreground" : "text-muted-foreground"}`}>개인정보 수집·이용에 동의합니다 (필수)</span>
                      </button>
                    </div>

                    <div className="space-y-2">
                      <span className="text-xs font-semibold">광고성 정보 수신 동의 <span className="text-muted-foreground">(선택)</span></span>
                      <div className="bg-muted/20 border border-border rounded-lg p-3 h-20 overflow-y-auto text-[10px] text-muted-foreground leading-relaxed whitespace-pre-wrap">{`이용 목적: 신규 프로그램 및 이벤트 안내, 할인 혜택 및 프로모션 정보 제공\n광고성 정보 발송 채널: 문자메시지(SMS/MMS), 카카오 알림톡, 이메일\n보유 및 이용 기간: 동의일로부터 회원 탈퇴 또는 수신 거부 시까지\n수신 거부 안내: 언제든지 센터에 수신 거부 의사를 표시할 수 있으며, 수신 거부 후에도 서비스 이용에는 제한이 없습니다.`}</div>
                      <button type="button" className="flex items-center gap-2 text-sm" onClick={() => setRenewalForm(f => ({ ...f, agreedMarketing: !f.agreedMarketing }))}>
                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${renewalForm.agreedMarketing ? "bg-primary border-primary" : "border-border"}`}>
                          {renewalForm.agreedMarketing && <span className="text-[10px] text-primary-foreground font-bold">✓</span>}
                        </div>
                        <span className={`text-xs ${renewalForm.agreedMarketing ? "text-foreground" : "text-muted-foreground"}`}>광고성 정보 수신에 동의합니다 (선택)</span>
                      </button>
                    </div>

                    <div className="flex gap-2 pt-1">
                      <Button variant="outline" className="flex-1 h-9" onClick={() => setRenewalStep(2)}>← 이전</Button>
                      <Button
                        className="flex-1 h-9"
                        disabled={!allRequired}
                        onClick={() => { if (allRequired) setRenewalStep(4); }}
                      >
                        다음 →
                      </Button>
                    </div>
                  </div>
                </>
              )}

              {/* 단계 4: 서명 */}
              {renewalStep === 4 && (
                <>
                  <DialogHeader>
                    <h2 className="font-bold text-base">✍️ 본인 서명</h2>
                    <p className="text-xs text-muted-foreground">아래 서명란에 손가락으로 서명해 주세요</p>
                  </DialogHeader>
                  <div className="space-y-4 pt-1">
                    <SignaturePad onSign={setSignatureData} signatureData={signatureData} />
                    <div className="flex gap-2 pt-1">
                      <Button variant="outline" className="flex-1 h-9" onClick={() => { setSignatureData(""); setRenewalStep(3); }}>← 이전</Button>
                      <Button
                        className="flex-1 h-9"
                        onClick={submitRenewal}
                        disabled={requestRenewal.isPending || !signatureData}
                      >
                        {requestRenewal.isPending ? "신청 중..." : "재등록 신청"}
                      </Button>
                    </div>
                  </div>
                </>
              )}

              {/* 단계 5: 완료 */}
              {renewalStep === 5 && (
                <>
                  <DialogHeader>
                    <h2 className="font-bold text-base">재등록 신청 완료</h2>
                  </DialogHeader>
                  <div className="space-y-4 pt-1">
                    <div className="bg-green-500/10 border border-green-500/30 rounded-2xl p-4 space-y-2 text-xs">
                      <p className="font-semibold text-green-400 text-sm">신청이 접수되었습니다</p>
                      <p className="text-muted-foreground">트레이너가 확인 후 최종 처리해 드립니다.</p>
                    </div>

                    <div className="bg-muted/30 rounded-xl p-3 space-y-1.5 text-xs">
                      <div className="flex justify-between"><span className="text-muted-foreground">회원명</span><span className="font-medium">{renewalForm.memberName}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">재등록 기간</span><span className="font-medium">{renewalForm.requestedPeriod}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">계약일</span><span className="font-medium">{contractDate}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">담당자</span><span className="font-medium">본인계약</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">마케팅 수신</span><span className={renewalForm.agreedMarketing ? "text-green-400 font-medium" : "text-muted-foreground"}>{renewalForm.agreedMarketing ? "동의" : "미동의"}</span></div>
                      {renewalForm.paymentMethod && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">결제 방법</span>
                          <span className="font-medium">{renewalForm.paymentMethod}</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">결제 금액</span>
                        <span className="font-bold text-primary">{PERIOD_PRICES[renewalForm.requestedPeriod]?.toLocaleString()}원</span>
                      </div>
                    </div>

                    {signatureData && (
                      <div className="space-y-1">
                        <p className="text-[10px] text-muted-foreground">서명</p>
                        <div className="border border-border rounded-xl p-2 bg-white">
                          <img src={signatureData} alt="서명" className="w-full h-16 object-contain" />
                        </div>
                      </div>
                    )}

                    <div className="space-y-2">
                      <button
                        type="button"
                        className="w-full py-3 rounded-xl border border-border bg-card text-sm font-medium flex items-center justify-center gap-2 hover:border-primary/50 transition-colors"
                        onClick={openContractPrint}
                      >
                        🖨️ 계약서 PDF 보기 / 인쇄
                      </button>
                      <button
                        type="button"
                        className="w-full py-3 rounded-xl bg-yellow-400 text-yellow-900 text-sm font-semibold flex items-center justify-center gap-2 hover:bg-yellow-300 transition-colors"
                        onClick={shareViaKakao}
                      >
                        💬 카카오톡으로 계약서 공유
                      </button>
                    </div>

                    <Button className="w-full h-9" onClick={closeRenewal}>확인</Button>
                  </div>
                </>
              )}

            </DialogContent>
          </Dialog>
        );
      })()}

    </div>
  );
}
