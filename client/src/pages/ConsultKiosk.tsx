import { useState, useEffect, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc";

type MainType = "consult" | "payment" | "info";
type ConsultType = "new" | "renew" | "pt";
type Stage =
  | "main_select"
  | "consult_type"
  | "consult_check"
  | "consult_status"
  | "consult_input"
  | "consult_done"
  | "payment_wait"
  | "info_display"
  | "event_display"
  | "register_input"
  | "register_done"
  | "staff_calling"
  | "staff_called"
  | "not_found"
  | "error";

function useCountdown(durationMs: number, active: boolean, onDone: () => void) {
  const [remaining, setRemaining] = useState(durationMs);
  const startedAt = useRef<number | null>(null);
  const raf = useRef<number | null>(null);
  const cancel = useCallback(() => {
    if (raf.current) cancelAnimationFrame(raf.current);
  }, []);
  useEffect(() => {
    if (!active) { setRemaining(durationMs); startedAt.current = null; return; }
    startedAt.current = performance.now();
    const tick = () => {
      const elapsed = performance.now() - (startedAt.current ?? 0);
      const left = Math.max(0, durationMs - elapsed);
      setRemaining(left);
      if (left > 0) raf.current = requestAnimationFrame(tick);
      else onDone();
    };
    raf.current = requestAnimationFrame(tick);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [active, durationMs]);
  return { remaining, progress: 1 - remaining / durationMs, cancel };
}

// 메인 화면 상단 디지털 시계 (1초마다 이 컴포넌트만 다시 그림)
function KioskClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  const day = ["일", "월", "화", "수", "목", "금", "토"][now.getDay()];
  return (
    <div className="inline-flex flex-col items-center rounded-3xl bg-slate-900 px-8 py-4 mb-6 shadow-lg">
      <p className="text-slate-300 text-base font-semibold tracking-wide">
        {now.getFullYear()}. {now.getMonth() + 1}. {now.getDate()}. ({day})
      </p>
      <p className="text-white font-black text-6xl leading-none tabular-nums tracking-tight mt-1.5">
        {hh}<span className={now.getSeconds() % 2 ? "opacity-30" : ""}>:</span>{mm}
        <span className="text-[#60A5FA] text-3xl ml-2 align-top">{ss}</span>
      </p>
    </div>
  );
}

function AutoCloseBar({ durationMs, active, onClose }: { durationMs: number; active: boolean; onClose: () => void }) {
  const { remaining, progress } = useCountdown(durationMs, active, onClose);
  const secs = Math.ceil(remaining / 1000);
  return (
    <div className="space-y-2 w-full">
      <div className="h-0.5 w-full bg-slate-200 rounded-full overflow-hidden">
        <div className="h-full rounded-full bg-[#60A5FA] transition-none" style={{ width: `${(1 - progress) * 100}%` }} />
      </div>
      <p className="text-slate-400 text-xs text-center">{secs}초 후 자동으로 닫힙니다</p>
    </div>
  );
}

const CONSULT_TYPES: { key: ConsultType; label: string; desc: string }[] = [
  { key: "new", label: "신규 상담", desc: "처음 방문하신 분" },
  { key: "renew", label: "재등록 상담", desc: "기존 회원 재등록" },
  { key: "pt", label: "PT 상담", desc: "퍼스널 트레이닝 문의" },
];

const PURPOSE_OPTIONS: Record<ConsultType, string[]> = {
  new: ["체중 감량", "근력 향상", "체형 교정", "건강 관리", "재활/통증"],
  renew: ["헬스 재등록", "PT 재등록", "헬스 + PT"],
  pt: ["체중 감량", "근력 향상", "체형 교정", "재활/통증", "777 맞춤 PT"],
};

// 지점별 헬스 이용권 가격 (랜딩페이지 가격과 동일하게 유지)
const MEMBERSHIP_PRICES: Record<number, [string, string][]> = {
  1: [["1개월", "80,000원"], ["3개월", "159,000원"], ["6개월", "226,000원"], ["12개월", "322,000원"]],
  2: [["1개월", "60,000원"], ["3개월", "120,000원"], ["6개월", "180,000원"], ["12개월", "300,000원"]],
};

const IDLE_RESET_MS = 60_000;
const UPDATE_CHECK_MS = 2 * 60_000;

// 한 줄 고정 (줄바꿈되면 안내 박스 규격이 깨짐)
function CardPayNotice() {
  return (
    <div className="rounded-2xl border-2 border-amber-400 bg-amber-50 px-3 py-3.5 flex items-center justify-center gap-2">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-5 h-5 text-amber-600 flex-shrink-0">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Z" />
      </svg>
      <p className="text-amber-800 font-bold text-[clamp(0.6875rem,3.3vw,0.875rem)] whitespace-nowrap">
        카드 결제는 옆 <span className="text-amber-900 underline underline-offset-2">카드 전용 키오스크</span>를 이용해 주세요
      </p>
    </div>
  );
}

const VAT_NOTE ="* 카드 및 시루 결제 시 부가세 10%";

// 이벤트 안내 카드 — 누르면 해당 이벤트로 등록 신청 화면으로 이동 (branch 없으면 전 지점 공통)
type KioskEvent = { id: string; branch?: number; title: string; benefit: string; product: "membership" | "pt777"; period?: string };
const KIOSK_EVENTS: KioskEvent[] = [
  { id: "b1-6m", branch: 1, title: "6개월 등록 시", benefit: "1개월 무료 추가 (총 7개월)", product: "membership", period: "6개월" },
  { id: "b1-12m", branch: 1, title: "12개월 등록 시", benefit: "운동복 증정", product: "membership", period: "12개월" },
  { id: "b2-any", branch: 2, title: "등록 시", benefit: "운동복 + 락커 서비스 제공", product: "membership" },
  { id: "pt777", title: "777 맞춤 PT", benefit: "맞춤 PT 17회 · 헬스 이용권 2개월 · 락커 서비스", product: "pt777" },
];
const PT777_PRICE = "777,000원";

function PhoneKeypad({ phone, onKey }: { phone: string; onKey: (key: string) => void }) {
  return (
    <>
      <div className="mb-5">
        <label className="text-slate-500 text-xs tracking-widest uppercase mb-2 block">전화번호</label>
        <div className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3.5 text-slate-900 text-xl font-mono tracking-widest min-h-[3.5rem]">
          {phone || <span className="text-slate-400 text-base font-normal">숫자를 입력해 주세요</span>}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 mb-6">
        {["1","2","3","4","5","6","7","8","9","←","0","지우기"].map((key) => (
          <button
            key={key}
            onClick={() => onKey(key)}
            className={`py-3 rounded-xl text-lg font-bold transition-colors ${
              key === "지우기"
                ? "text-red-500 bg-red-50 border border-red-200 text-sm"
                : key === "←"
                ? "text-slate-600 bg-white border border-slate-200"
                : "text-slate-900 bg-white border border-slate-200 active:bg-slate-100"
            }`}
          >
            {key}
          </button>
        ))}
      </div>
    </>
  );
}

const BRANCH_EVENT_ROWS: Record<number, string[]> = {
  1: ["6개월 등록 → 1개월 추가", "12개월 등록 → 운동복 증정", "12월 31일까지"],
  2: ["등록 시 → 운동복 + 락커 서비스 제공", "12월 31일까지"],
};

function infoItems(branchNo = 1) {
  return [
    { title: "헬스 이용권", rows: MEMBERSHIP_PRICES[branchNo].map(([p, v]) => `${p} ${v}`) },
    { title: "연말 이벤트", rows: BRANCH_EVENT_ROWS[branchNo] },
    { title: "777 맞춤 PT", rows: ["17회 맞춤 지도", "헬스 이용권 2개월 포함", "락커 서비스 포함", "777,000원"] },
    { title: "운영 시간", rows: BRANCH_INFO[branchNo].hours },
  ];
}

const FAQ_PER_PAGE = 5;

const BANK_NAME = "카카오뱅크";
const ACCOUNT_HOLDER = "이준산";

const HOLIDAY_NOTE = "공휴일 탄력 운영 (사전 공지)";

// 지점 정보 (랜딩페이지 BRANCH와 동일하게 유지)
const BRANCH_INFO: Record<number, { hours: string[]; address: string; phone: string; account: string }> = {
  1: { hours: ["평일 08:00 – 23:00", "토요일 10:00 – 17:00", "일요일 휴무", HOLIDAY_NOTE], address: "경기도 시흥시 함송로 29번길 5, 다나빌딩 2/3층", phone: "0507-1482-3349", account: "3333-05-2664409" },
  2: { hours: ["평일 07:30 – 23:00", "토요일 10:00 – 17:00", "일요일 휴무", HOLIDAY_NOTE], address: "경기도 시흥시 중심상가로 181, 삼화빌딩 4층", phone: "0507-1457-4003", account: "79420-21-15290" },
};

// 자주 묻는 질문 — 시스템(랜딩·짐플러스 앱)에 이미 안내 중인 내용만 사용
function faqItems(branchNo = 1) {
  const b = BRANCH_INFO[branchNo];
  return [
    { q: "운영 시간이 어떻게 되나요?", a: `${b.hours.filter((h) => h !== HOLIDAY_NOTE).join(" · ")}입니다. 공휴일은 탄력적으로 운영하며, 사전에 공지해 드립니다.` },
    { q: "처음인데 어떻게 시작하나요?", a: "자이언트짐은 운동 시작 전 모든 회원에게 체형분석을 실시합니다. 홈 화면의 '상담 신청'을 눌러 주시면 직원이 안내해 드립니다." },
    { q: "등록하고 첫 방문인데 어떻게 하나요?", a: "센터에 오시면 데스크에 있는 출석 체크를 먼저 해 주세요. 그다음 운동복과 운동화로 갈아입고 이용하시면 됩니다." },
    { q: "헬스 이용권에는 무엇이 포함되나요?", a: "체형분석, 체성분 측정, 운동 상담이 포함됩니다." },
    { q: "결제는 어떻게 하나요?", a: `카드, 시루, 계좌이체로 결제할 수 있습니다. 카드 결제는 옆에 있는 카드 전용 키오스크를 이용해 주세요. 계좌이체는 ${BANK_NAME} ${b.account} (예금주 ${ACCOUNT_HOLDER})로 보내 주세요. 카드와 시루 결제 시 부가세 10%가 추가됩니다.` },
    { q: "회원권 정지·양도·해지는 어떻게 하나요?", a: "ZIANTGYM+ 앱의 내 정보에서 신청할 수 있습니다. 정지하면 정지한 기간만큼 만료일이 자동으로 연장됩니다." },
    { q: "해지하면 환불되나요?", a: "계약금액의 10%를 위약금으로 공제한 뒤 남은 기간만큼 비례해 환불해 드립니다. 환불은 영업일 기준 3~5일 걸립니다." },
    { q: "777 맞춤 PT는 무엇인가요?", a: "연 1회 한정 프로그램으로, 맞춤 PT 17회와 헬스 이용권 2개월, 락커 서비스가 포함된 777,000원 상품입니다." },
    { q: "위치와 연락처를 알려주세요.", a: `${BRANCH_LABEL[branchNo]} · ${b.address} · Tel. ${b.phone}` },
  ];
}

// 지점별 키오스크 주소: /consult-kiosk?branch=1, /consult-kiosk?branch=2
const BRANCH_LABEL: Record<number, string> = { 1: "1호점 (정왕점)", 2: "2호점 (시흥점)" };

function readBranchNo(): number | undefined {
  const n = Number(new URLSearchParams(window.location.search).get("branch"));
  return BRANCH_LABEL[n] ? n : undefined;
}

export default function ConsultKiosk() {
  const [branchNo] = useState(readBranchNo);
  const [stage, setStage] = useState<Stage>("main_select");
  const [consultType, setConsultType] = useState<ConsultType>("new");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [purpose, setPurpose] = useState("");
  const [memberName, setMemberName] = useState("");
  const [showConsultModal, setShowConsultModal] = useState(false);
  const [waitType, setWaitType] = useState<"wait" | "callback">("wait");
  const [selectedEvent, setSelectedEvent] = useState<KioskEvent | null>(null);
  const [regPeriod, setRegPeriod] = useState("");
  const [infoTab, setInfoTab] = useState<"info" | "faq">("info");
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [faqPage, setFaqPage] = useState(0);

  const phoneRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  const submitMut = trpc.kiosk.submitConsult.useMutation({
    onSuccess: (data) => {
      if (data.memberName) setMemberName(data.memberName);
      setStage("consult_done");
    },
    onError: (err) => {
      if (err.data?.code === "NOT_FOUND") setStage("not_found");
      else setStage("error");
    },
  });

  // 대형 세로형 키오스크에서도 화면을 채우도록 rem 기준 크기를 화면에 맞춰 키움 (휴대폰은 기본 16px 유지)
  useEffect(() => {
    const html = document.documentElement;
    const prev = html.style.fontSize;
    html.style.fontSize = "clamp(16px, min(3.4vw, 1.9vh), 48px)";
    return () => { html.style.fontSize = prev; };
  }, []);

  // 새 버전이 배포되면 홈 화면에서 30초 이상 아무도 쓰지 않을 때 자동 새로고침 (손님 사용 중에는 절대 안 함)
  const idleOnHomeRef = useRef({ stage, showConsultModal });
  idleOnHomeRef.current = { stage, showConsultModal };
  useEffect(() => {
    const current = document.querySelector('script[src*="/assets/index-"]')?.getAttribute("src");
    if (!current) return;
    let lastTouch = Date.now();
    const touch = () => { lastTouch = Date.now(); };
    window.addEventListener("pointerdown", touch, true);
    window.addEventListener("keydown", touch, true);
    let updateReady = false;
    const check = async () => {
      if (!updateReady) {
        try {
          const html = await (await fetch("/", { cache: "no-store" })).text();
          const latest = html.match(/\/assets\/index-[^"']+\.js/)?.[0];
          updateReady = !!latest && latest !== current;
        } catch {
          return;
        }
      }
      const { stage: s, showConsultModal: modal } = idleOnHomeRef.current;
      if (updateReady && s === "main_select" && !modal && Date.now() - lastTouch > 30_000) window.location.reload();
    };
    const timer = setInterval(check, UPDATE_CHECK_MS);
    return () => {
      clearInterval(timer);
      window.removeEventListener("pointerdown", touch, true);
      window.removeEventListener("keydown", touch, true);
    };
  }, []);

  // 키오스크 화면이 꺼지지 않도록 화면 켜짐 유지 요청 (탭 전환·최소화 후 돌아오거나 OS가 해제하면 다시 요청)
  useEffect(() => {
    if (!("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let pending = false;
    let disposed = false;
    const acquire = async () => {
      if (disposed || pending || document.visibilityState !== "visible" || (lock && !lock.released)) return;
      pending = true;
      try {
        const l = await navigator.wakeLock.request("screen");
        if (disposed) l.release().catch(() => {});
        else lock = l;
      } catch {
        // 절전 모드·권한 정책 등으로 거부되면 다음 터치 때 재시도
      } finally {
        pending = false;
      }
    };
    acquire();
    document.addEventListener("visibilitychange", acquire);
    window.addEventListener("pointerdown", acquire);
    return () => {
      disposed = true;
      document.removeEventListener("visibilitychange", acquire);
      window.removeEventListener("pointerdown", acquire);
      lock?.release().catch(() => {});
    };
  }, []);

  const registerMut = trpc.kiosk.submitRegistration.useMutation({
    onSuccess: () => setStage("register_done"),
    onError: () => setStage("error"),
  });

  const callStaffMut = trpc.kiosk.callStaff.useMutation({
    onSuccess: () => setStage("staff_called"),
    onError: () => setStage("staff_called"), // 실패해도 완료로 보여줌
  });

  const doReset = useCallback(() => {
    setStage("main_select");
    setShowConsultModal(false);
    setWaitType("wait");
    setSelectedEvent(null); setRegPeriod("");
    setInfoTab("info"); setOpenFaq(null); setFaqPage(0);
    setName(""); setPhone(""); setPurpose(""); setMemberName("");
  }, []);

  // 홈이 아닌 화면에서 1분간 터치·입력이 없으면 입력값을 지우고 홈으로 (다음 손님에게 개인정보 노출 방지)
  useEffect(() => {
    if (stage === "main_select" && !showConsultModal) return;
    let timer = setTimeout(doReset, IDLE_RESET_MS);
    const bump = () => { clearTimeout(timer); timer = setTimeout(doReset, IDLE_RESET_MS); };
    const events = ["pointerdown", "keydown", "input", "wheel"];
    events.forEach((e) => window.addEventListener(e, bump, true));
    return () => {
      clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, bump, true));
    };
  }, [stage, showConsultModal, doReset]);

  useEffect(() => {
    if (stage === "consult_input") {
      setTimeout(() => {
        if (consultType === "renew") phoneRef.current?.focus();
        else nameRef.current?.focus();
      }, 100);
    }
    if (stage === "consult_check") {
      const t = setTimeout(() => setStage("consult_status"), 1800);
      return () => clearTimeout(t);
    }
  }, [stage, consultType]);

  const handlePhoneKey = (key: string) => {
    if (key === "←") setPhone((p) => p.slice(0, -1));
    else if (key === "지우기") setPhone("");
    else if (phone.length < 11) setPhone((p) => p + key);
  };

  const handleSubmit = () => {
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 9) return;
    const resolvedPurpose = purpose || (consultType === "new" ? (waitType === "callback" ? "연락 요청" : "기다리기") : undefined);
    submitMut.mutate({ consultType, name: name || undefined, phone: digits, purpose: resolvedPurpose, branchNo });
  };

  const startRegistration = (ev: KioskEvent) => {
    setSelectedEvent(ev);
    setRegPeriod(ev.period ?? "");
    setName(""); setPhone("");
    setStage("register_input");
  };

  const handleRegister = () => {
    if (!selectedEvent) return;
    registerMut.mutate({
      branchNo,
      eventId: selectedEvent.id,
      eventTitle: `${selectedEvent.title} ${selectedEvent.benefit}`,
      product: selectedEvent.product,
      period: selectedEvent.product === "membership" ? (regPeriod as "1개월" | "3개월" | "6개월" | "12개월") : undefined,
      name: name.trim(),
      phone: phone.replace(/\D/g, ""),
    });
  };

  const handleCallStaff = () => {
    setStage("staff_calling");
    callStaffMut.mutate({ message: "키오스크에서 직원을 호출했습니다.", branchNo });
  };

  return (
    <div className="min-h-screen bg-[#F8F9FB] text-slate-900 flex flex-col items-center justify-center px-6 py-8 select-none">
      {/* 헤더 (메인 화면에서만 — 입력 화면이 한 화면에 들어오도록) */}
      {stage === "main_select" && <div className="mb-8 text-center">
        <KioskClock />
        <p className="text-[min(1.875rem,7vw)] whitespace-nowrap font-black tracking-tight text-slate-900">
          맞춤운동센터 <span className="text-[#1D4ED8]">자이언트짐</span>
        </p>
        <p className="text-slate-600 text-2xl font-bold mt-2">무엇을 도와드릴까요?</p>
        {branchNo
          ? <p className="text-slate-400 text-xs mt-2">{BRANCH_LABEL[branchNo]}</p>
          : <p className="text-amber-600 text-xs mt-2">지점 미설정 · 주소 끝에 ?branch=1 또는 ?branch=2</p>}
      </div>}

      {/* ── 메인 선택 ── */}
      {stage === "main_select" && (
        <div className="w-full max-w-sm space-y-3">
          {/* 상담 신청 */}
          <button
            onClick={() => setShowConsultModal(true)}
            className="w-full flex items-center gap-5 p-5 rounded-2xl border border-[#1D4ED8]/40 bg-[#1D4ED8]/10 active:bg-[#1D4ED8]/20 transition-colors text-left"
          >
            <div className="w-12 h-12 rounded-xl bg-[#1D4ED8]/20 flex items-center justify-center flex-shrink-0">
              <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6 text-[#2563EB]" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 0 1-.825-.242m9.345-8.334a2.126 2.126 0 0 0-.476-.095 48.64 48.64 0 0 0-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0 0 11.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-slate-900 font-bold text-lg">상담 신청</p>
              <p className="text-slate-500 text-sm mt-0.5">신규 · 재등록 · PT 상담</p>
            </div>
            <svg viewBox="0 0 24 24" fill="none" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-slate-400 flex-shrink-0">
              <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
            </svg>
          </button>

          {/* 등록 결제 */}
          <button
            onClick={() => setStage("payment_wait")}
            className="w-full flex items-center gap-5 p-5 rounded-2xl border border-[#059669]/40 bg-[#059669]/10 active:bg-[#059669]/20 transition-colors text-left"
          >
            <div className="w-12 h-12 rounded-xl bg-[#059669]/20 flex items-center justify-center flex-shrink-0">
              <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6 text-[#059669]" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Z" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-slate-900 font-bold text-lg">등록 결제</p>
              <p className="text-slate-500 text-sm mt-0.5">회원권 등록 및 결제</p>
            </div>
            <svg viewBox="0 0 24 24" fill="none" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-slate-400 flex-shrink-0">
              <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
            </svg>
          </button>

          {/* 안내 설명 */}
          <button
            onClick={() => setStage("info_display")}
            className="w-full flex items-center gap-5 p-5 rounded-2xl border border-slate-200 bg-white shadow-sm active:bg-slate-100 transition-colors text-left"
          >
            <div className="w-12 h-12 rounded-xl bg-white flex items-center justify-center flex-shrink-0">
              <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6 text-slate-500" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-slate-900 font-bold text-lg">안내 설명</p>
              <p className="text-slate-500 text-sm mt-0.5">이용권 가격 · 이벤트 · 운영시간</p>
            </div>
            <svg viewBox="0 0 24 24" fill="none" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-slate-400 flex-shrink-0">
              <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
            </svg>
          </button>

          {/* 이벤트 안내 */}
          <button
            onClick={() => setStage("event_display")}
            className="w-full flex items-center gap-5 p-5 rounded-2xl border border-purple-500/30 bg-purple-500/8 active:bg-purple-500/15 transition-colors text-left"
          >
            <div className="w-12 h-12 rounded-xl bg-purple-500/15 flex items-center justify-center flex-shrink-0">
              <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6 text-purple-600" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456Z" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-slate-900 font-bold text-lg">이벤트 안내</p>
              <p className="text-slate-500 text-sm mt-0.5">현재 진행 중인 이벤트</p>
            </div>
            <svg viewBox="0 0 24 24" fill="none" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-slate-400 flex-shrink-0">
              <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
            </svg>
          </button>

          {/* 직원 부르기 */}
          <button
            onClick={handleCallStaff}
            className="w-full flex items-center justify-center gap-3 p-5 rounded-2xl border border-dashed border-amber-500/40 bg-amber-500/5 active:bg-amber-500/10 transition-colors mt-2"
          >
            <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5 text-amber-600" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
            </svg>
            <p className="text-amber-600 font-bold text-base">직원 부르기</p>
          </button>
        </div>
      )}

      {/* ── 체크 중 (신규) ── */}
      {stage === "consult_check" && (
        <div className="w-full max-w-sm text-center space-y-6">
          <div className="w-16 h-16 rounded-full bg-[#1D4ED8]/10 flex items-center justify-center mx-auto">
            <svg className="w-8 h-8 text-[#2563EB] animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
              <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
          </div>
          <div>
            <p className="text-slate-900 font-bold text-xl mb-2">빠른 상담을 위해</p>
            <p className="text-[#2563EB] font-bold text-xl">체크 중입니다...</p>
          </div>
        </div>
      )}

      {/* ── 상담 상태 안내 (신규) ── */}
      {stage === "consult_status" && (
        <div className="w-full max-w-sm space-y-5">
          <button onClick={doReset} className="flex items-center gap-1 text-slate-400 text-sm hover:text-slate-700 transition-colors">
            <svg viewBox="0 0 24 24" fill="none" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
            </svg>
            돌아가기
          </button>
          {/* 상태 카드 */}
          <div className="rounded-2xl border border-amber-500/25 bg-amber-500/[0.07] px-5 py-5 flex gap-4 items-start">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 flex items-center justify-center flex-shrink-0 mt-0.5">
              <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5 text-amber-600" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
            </div>
            <div>
              <p className="text-amber-700 font-bold text-sm mb-1">현재 선생님이 수업 중이세요</p>
              <p className="text-slate-600 text-sm leading-relaxed">
                정보를 남겨주시면 수업 후 바로 연락드립니다.<br />
                수업은 <span className="text-slate-900 font-semibold">매 시간 50분</span>에 종료됩니다.
              </p>
            </div>
          </div>

          <p className="text-slate-500 text-sm text-center">어떻게 하시겠어요?</p>

          {/* 기다리기 */}
          <button
            onClick={() => { setWaitType("wait"); setStage("consult_input"); }}
            className="w-full flex items-center gap-4 p-5 rounded-2xl border border-[#1D4ED8]/35 bg-[#1D4ED8]/8 active:bg-[#1D4ED8]/18 transition-colors text-left"
          >
            <div className="w-11 h-11 rounded-xl bg-[#1D4ED8]/18 flex items-center justify-center flex-shrink-0">
              <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5 text-[#2563EB]" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-slate-900 font-bold text-base">기다리기</p>
              <p className="text-slate-500 text-sm mt-0.5">잠시 기다린 후 상담 받기</p>
            </div>
            <svg viewBox="0 0 24 24" fill="none" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-slate-400 flex-shrink-0">
              <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
            </svg>
          </button>

          {/* 연락 받기 */}
          <button
            onClick={() => { setWaitType("callback"); setStage("consult_input"); }}
            className="w-full flex items-center gap-4 p-5 rounded-2xl border border-[#059669]/30 bg-[#059669]/7 active:bg-[#059669]/15 transition-colors text-left"
          >
            <div className="w-11 h-11 rounded-xl bg-[#059669]/15 flex items-center justify-center flex-shrink-0">
              <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5 text-[#059669]" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-slate-900 font-bold text-base">연락 받기</p>
              <p className="text-slate-500 text-sm mt-0.5">번호 남기면 선생님이 연락드려요</p>
            </div>
            <svg viewBox="0 0 24 24" fill="none" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-slate-400 flex-shrink-0">
              <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
            </svg>
          </button>
        </div>
      )}

      {/* ── 상담 유형 선택 (기존 회원) ── */}
      {stage === "consult_type" && (
        <div className="w-full max-w-sm">
          <button onClick={doReset} className="flex items-center gap-1 text-slate-400 text-sm mb-8 hover:text-slate-700 transition-colors">
            <svg viewBox="0 0 24 24" fill="none" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
            </svg>
            돌아가기
          </button>
          <h2 className="text-xl font-bold text-slate-900 mb-8">어떤 상담을 원하시나요?</h2>
          <div className="space-y-3">
            {CONSULT_TYPES.filter(t => t.key !== "new").map((t) => (
              <button
                key={t.key}
                onClick={() => { setConsultType(t.key); setStage("consult_input"); }}
                className="w-full flex items-center justify-between p-5 rounded-2xl border border-[#1D4ED8]/30 bg-[#1D4ED8]/8 active:bg-[#1D4ED8]/20 transition-colors"
              >
                <div className="text-left">
                  <p className="text-slate-900 font-bold">{t.label}</p>
                  <p className="text-slate-500 text-sm mt-0.5">{t.desc}</p>
                </div>
                <svg viewBox="0 0 24 24" fill="none" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-slate-400">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                </svg>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── 상담 정보 입력 ── */}
      {stage === "consult_input" && (
        <div className="w-full max-w-sm">
          <button
            onClick={() => setStage(consultType === "new" ? "consult_status" : "consult_type")}
            className="flex items-center gap-1 text-slate-400 text-sm mb-8 hover:text-slate-700 transition-colors"
          >
            <svg viewBox="0 0 24 24" fill="none" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
            </svg>
            돌아가기
          </button>

          <p className="text-[#2563EB] text-xs font-bold tracking-widest uppercase mb-1">
            {consultType === "new" ? "신규 상담" : CONSULT_TYPES.find(t => t.key === consultType)?.label}
          </p>
          {consultType === "new" && (
            <p className="text-slate-500 text-sm mb-5">
              {waitType === "callback" ? "연락처를 남겨주시면 선생님이 연락드립니다." : "정보를 남겨주시면 수업 후 바로 안내해 드립니다."}
            </p>
          )}

          {consultType !== "renew" && (
            <div className="mb-5">
              <label className="text-slate-500 text-xs tracking-widest uppercase mb-2 block">이름</label>
              <input
                ref={nameRef}
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="성함을 입력해 주세요"
                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3.5 text-slate-900 text-base placeholder-slate-400 focus:outline-none focus:border-blue-300"
              />
            </div>
          )}

          <div className="mb-5">
            <label className="text-slate-500 text-xs tracking-widest uppercase mb-2 block">목적 (선택)</label>
            <div className="flex flex-wrap gap-2">
              {PURPOSE_OPTIONS[consultType].map((opt) => (
                <button
                  key={opt}
                  onClick={() => setPurpose(purpose === opt ? "" : opt)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border ${
                    purpose === opt
                      ? "bg-[#1D4ED8] border-[#1D4ED8] text-white"
                      : "text-slate-500 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          <input ref={phoneRef} type="tel" className="sr-only" readOnly value={phone} />
          <PhoneKeypad phone={phone} onKey={handlePhoneKey} />

          <button
            onClick={handleSubmit}
            disabled={phone.replace(/\D/g, "").length < 9 || submitMut.isPending}
            className="w-full py-4 rounded-xl font-bold text-white bg-[#1D4ED8] hover:bg-[#1a44c2] disabled:opacity-30 transition-colors"
          >
            {submitMut.isPending ? "접수 중..." : waitType === "callback" && consultType === "new" ? "연락처 남기기" : "상담 접수하기"}
          </button>
        </div>
      )}

      {/* ── 상담 완료 ── */}
      {stage === "consult_done" && (
        <div className="w-full max-w-sm text-center space-y-6">
          <div className="w-16 h-16 rounded-full bg-[#60A5FA]/15 flex items-center justify-center mx-auto">
            <svg viewBox="0 0 40 40" fill="none" className="w-10 h-10 text-[#2563EB]" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 20 L17 27 L30 13" />
            </svg>
          </div>
          <div>
            <p className="text-slate-900 font-bold text-2xl mb-2">
              {memberName ? `${memberName}님, ` : ""}접수 완료!
            </p>
            <p className="text-slate-500 text-sm leading-relaxed">
              잠시만 기다려 주시면<br />직원이 안내해 드립니다.
            </p>
          </div>
          <AutoCloseBar durationMs={8000} active={stage === "consult_done"} onClose={doReset} />
        </div>
      )}

      {/* ── 등록 결제 대기 ── */}
      {stage === "payment_wait" && (
        <div className="w-full max-w-sm text-center space-y-6">
          <div className="w-16 h-16 rounded-full bg-[#059669]/15 flex items-center justify-center mx-auto">
            <svg viewBox="0 0 40 40" fill="none" className="w-10 h-10 text-[#059669]" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 20h30M5 13h30M10 27h5M18 27h5M26 27h5" />
              <rect x="3" y="9" width="34" height="22" rx="3" strokeWidth={1.5} />
            </svg>
          </div>
          <div>
            <p className="text-slate-900 font-bold text-2xl mb-3">등록 결제</p>
            <p className="text-slate-500 text-sm leading-relaxed">
              직원이 곧 안내해 드립니다.<br />잠시만 기다려 주세요.
            </p>
          </div>
          <CardPayNotice />
          <div className="rounded-2xl border border-[#059669]/20 bg-[#059669]/8 px-5 py-4 text-left space-y-2">
            <p className="text-slate-500 text-xs tracking-widest uppercase mb-3">이용권 안내</p>
            {MEMBERSHIP_PRICES[branchNo ?? 1].map(([period, price]) => (
              <div key={period} className="flex justify-between">
                <span className="text-slate-600 text-sm">{period}</span>
                <span className="text-slate-900 font-semibold text-sm">{price}</span>
              </div>
            ))}
            <p className="text-slate-500 text-xs pt-2">{VAT_NOTE}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 text-left">
            <p className="text-slate-500 text-xs tracking-widest uppercase mb-2">계좌이체</p>
            <p className="text-slate-900 font-bold text-lg tracking-wide">{BANK_NAME} {BRANCH_INFO[branchNo ?? 1].account}</p>
            <p className="text-slate-500 text-sm mt-0.5">예금주 {ACCOUNT_HOLDER}</p>
          </div>
          <button onClick={doReset} className="w-full py-3.5 rounded-xl border border-slate-200 text-slate-500 text-sm">
            처음으로 →
          </button>
          <AutoCloseBar durationMs={30000} active={stage === "payment_wait"} onClose={doReset} />
        </div>
      )}

      {/* ── 안내 설명 ── */}
      {stage === "info_display" && (
        <div className="w-full max-w-sm space-y-4">
          <div className="flex bg-white border border-slate-200 rounded-xl p-1 gap-1">
            {([["info", "요금 · 운영 안내"], ["faq", "자주 묻는 질문"]] as const).map(([key, label]) => (
              <button
                key={key}
                onClick={() => { setInfoTab(key); setOpenFaq(null); setFaqPage(0); }}
                className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-colors ${infoTab === key ? "bg-[#1D4ED8] text-white" : "text-slate-500"}`}
              >
                {label}
              </button>
            ))}
          </div>

          {infoTab === "faq" && (() => {
            const all = faqItems(branchNo);
            const pages = Math.ceil(all.length / FAQ_PER_PAGE);
            const start = faqPage * FAQ_PER_PAGE;
            return (
            <div className="space-y-2">
              {all.slice(start, start + FAQ_PER_PAGE).map((f, j) => { const i = start + j; return (
                <button
                  key={f.q}
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full text-left rounded-2xl border border-slate-200 bg-white shadow-sm px-5 py-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-slate-900 font-bold text-sm"><span className="text-[#2563EB] mr-1.5">Q.</span>{f.q}</p>
                    <svg viewBox="0 0 24 24" fill="none" strokeWidth={2} stroke="currentColor" className={`w-4 h-4 text-slate-400 flex-shrink-0 transition-transform ${openFaq === i ? "rotate-180" : ""}`}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                    </svg>
                  </div>
                  {openFaq === i && <p className="text-slate-600 text-sm leading-relaxed mt-3">{f.a}</p>}
                </button>
              ); })}
              {pages > 1 && (
                <div className="flex justify-center gap-2 pt-2">
                  {Array.from({ length: pages }, (_, n) => (
                    <button
                      key={n}
                      onClick={() => { setFaqPage(n); setOpenFaq(null); }}
                      className={`w-11 h-11 rounded-xl text-base font-bold border transition-colors ${faqPage === n ? "bg-[#1D4ED8] border-[#1D4ED8] text-white" : "bg-white border-slate-200 text-slate-500"}`}
                    >
                      {n + 1}
                    </button>
                  ))}
                </div>
              )}
            </div>
            );
          })()}

          {infoTab === "info" && infoItems(branchNo).map((item) => (
            <div key={item.title} className="rounded-2xl border border-slate-200 bg-white shadow-sm px-5 py-4">
              <p className="text-slate-500 text-[0.625rem] tracking-widest uppercase mb-3">{item.title}</p>
              <div className="space-y-1.5">
                {item.rows.map((row) => (
                  <p key={row} className="text-slate-600 text-sm">{row}</p>
                ))}
                {item.title === "헬스 이용권" && <p className="text-slate-500 text-xs pt-1">{VAT_NOTE}</p>}
              </div>
            </div>
          ))}
          <button onClick={doReset} className="w-full py-4 rounded-xl bg-white border border-slate-200 text-slate-600 font-bold mt-2">
            처음으로 →
          </button>
        </div>
      )}

      {/* ── 이벤트 안내 ── */}
      {stage === "event_display" && (
        <div className="w-full max-w-sm space-y-3">
          <div className="text-center mb-2">
            <p className="text-purple-600 text-xs font-bold tracking-widest uppercase">12월 31일까지</p>
            <p className="text-slate-900 font-bold text-lg mt-1">진행 중인 이벤트</p>
          </div>

          {KIOSK_EVENTS.filter((ev) => !ev.branch || !branchNo || ev.branch === branchNo).map((ev) => {
            const pt = ev.product === "pt777";
            return (
              <button
                key={ev.id}
                onClick={() => startRegistration(ev)}
                className={`w-full text-left rounded-2xl border px-5 py-5 transition-colors ${pt ? "border-[#60A5FA]/30 bg-[#1D4ED8]/[0.07] active:bg-[#1D4ED8]/15" : "border-purple-500/25 bg-purple-500/[0.06] active:bg-purple-500/15"}`}
              >
                <p className={`text-[0.625rem] tracking-widest uppercase mb-2 ${pt ? "text-[#2563EB]" : "text-purple-600"}`}>
                  {pt ? "연 1회 한정 특별 프로그램" : BRANCH_LABEL[ev.branch!]}
                </p>
                <p className="text-slate-900 font-bold text-base">{ev.title}</p>
                <p className="text-slate-600 text-sm mt-0.5">→ {ev.benefit}</p>
                {pt && <p className="text-[#2563EB] font-bold text-base mt-2">{PT777_PRICE}</p>}
                <p className={`text-sm font-bold mt-3 ${pt ? "text-[#2563EB]" : "text-purple-600"}`}>이 이벤트로 등록하기 →</p>
              </button>
            );
          })}

          <button onClick={doReset} className="w-full py-4 rounded-xl bg-white border border-slate-200 text-slate-600 font-bold">
            처음으로 →
          </button>
        </div>
      )}

      {/* ── 이벤트 등록 신청 ── */}
      {stage === "register_input" && selectedEvent && (() => {
        const prices = MEMBERSHIP_PRICES[branchNo ?? 1];
        const periods = selectedEvent.period ? prices.filter(([p]) => p === selectedEvent.period) : prices;
        const needPeriod = selectedEvent.product === "membership";
        const ready = name.trim().length > 0 && phone.length >= 9 && (!needPeriod || !!regPeriod);
        return (
          <div className="w-full max-w-sm">
            <button onClick={() => setStage("event_display")} className="flex items-center gap-1 text-slate-400 text-sm mb-4 hover:text-slate-700 transition-colors">
              <svg viewBox="0 0 24 24" fill="none" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
              </svg>
              돌아가기
            </button>

            <p className="text-purple-600 text-xs font-bold tracking-widest uppercase mb-1">이벤트 등록 신청</p>
            <p className="text-slate-900 font-bold text-base">{selectedEvent.title}</p>
            <p className="text-slate-500 text-sm mb-4">→ {selectedEvent.benefit}</p>

            {needPeriod ? (
              <div className="mb-4">
                <label className="text-slate-500 text-xs tracking-widest uppercase mb-2 block">기간</label>
                <div className={`grid gap-2 ${periods.length > 1 ? "grid-cols-4" : "grid-cols-1"}`}>
                  {periods.map(([p, price]) => (
                    <button
                      key={p}
                      onClick={() => setRegPeriod(p)}
                      className={`rounded-xl border px-1 py-2.5 text-center transition-colors ${regPeriod === p ? "bg-[#1D4ED8] border-[#1D4ED8] text-white" : "bg-white border-slate-200 text-slate-900"}`}
                    >
                      <p className="text-sm font-bold">{p}</p>
                      <p className={`text-xs ${regPeriod === p ? "text-white/80" : "text-slate-500"}`}>{price}</p>
                    </button>
                  ))}
                </div>
                <p className="text-slate-500 text-xs mt-2">{VAT_NOTE}</p>
              </div>
            ) : (
              <div className="mb-4 rounded-xl border border-slate-200 bg-white px-4 py-3 flex justify-between items-center">
                <span className="text-slate-600 text-sm">결제 금액</span>
                <span className="text-slate-900 font-bold">{PT777_PRICE}</span>
              </div>
            )}

            <div className="mb-4">
              <label className="text-slate-500 text-xs tracking-widest uppercase mb-2 block">이름</label>
              <input
                type="text"
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="성함을 입력해 주세요"
                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-slate-900 text-base placeholder-slate-400 focus:outline-none focus:border-blue-300"
              />
            </div>

            <PhoneKeypad phone={phone} onKey={handlePhoneKey} />

            <button
              onClick={handleRegister}
              disabled={!ready || registerMut.isPending}
              className="w-full py-4 rounded-xl font-bold text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-30 transition-colors"
            >
              {registerMut.isPending ? "접수 중..." : "등록 신청하기"}
            </button>
          </div>
        );
      })()}

      {/* ── 등록 신청 완료 ── */}
      {stage === "register_done" && (
        <div className="w-full max-w-sm text-center space-y-6">
          <div className="w-16 h-16 rounded-full bg-purple-500/15 flex items-center justify-center mx-auto">
            <svg viewBox="0 0 40 40" fill="none" className="w-10 h-10 text-purple-600" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 20 L17 27 L30 13" />
            </svg>
          </div>
          <div>
            <p className="text-slate-900 font-bold text-2xl mb-2">{name.trim() ? `${name.trim()}님, ` : ""}등록 신청 완료!</p>
            <p className="text-slate-500 text-sm leading-relaxed">
              직원이 곧 결제와 등록을<br />도와드립니다. 잠시만 기다려 주세요.
            </p>
          </div>
          <CardPayNotice />
          <AutoCloseBar durationMs={10000} active={stage === "register_done"} onClose={doReset} />
        </div>
      )}

      {/* ── 직원 호출 중 ── */}
      {stage === "staff_calling" && (
        <div className="w-full max-w-sm text-center space-y-6">
          <div className="w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center mx-auto animate-pulse">
            <svg viewBox="0 0 40 40" fill="none" className="w-10 h-10 text-amber-600" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M24.76 28.47a39.7 39.7 0 0 0 9.07-2.18A14.94 14.94 0 0 1 30 16.25V15A10 10 0 0 0 10 15v1.25a14.94 14.94 0 0 1-3.85 10.03 39.85 39.85 0 0 0 9.08 2.19m9.53 0a40.4 40.4 0 0 1-9.53 0m9.53 0a5 5 0 0 1-9.53 0" />
            </svg>
          </div>
          <p className="text-slate-900 font-bold text-xl">호출 중...</p>
        </div>
      )}

      {/* ── 직원 호출 완료 ── */}
      {stage === "staff_called" && (
        <div className="w-full max-w-sm text-center space-y-6">
          <div className="w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center mx-auto">
            <svg viewBox="0 0 40 40" fill="none" className="w-10 h-10 text-amber-600" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M24.76 28.47a39.7 39.7 0 0 0 9.07-2.18A14.94 14.94 0 0 1 30 16.25V15A10 10 0 0 0 10 15v1.25a14.94 14.94 0 0 1-3.85 10.03 39.85 39.85 0 0 0 9.08 2.19m9.53 0a40.4 40.4 0 0 1-9.53 0m9.53 0a5 5 0 0 1-9.53 0" />
            </svg>
          </div>
          <div>
            <p className="text-slate-900 font-bold text-2xl mb-2">직원을 호출했습니다!</p>
            <p className="text-slate-500 text-sm leading-relaxed">
              잠시만 기다려 주시면<br />직원이 곧 찾아옵니다.
            </p>
          </div>
          <AutoCloseBar durationMs={7000} active={stage === "staff_called"} onClose={doReset} />
        </div>
      )}

      {/* ── 회원 없음 ── */}
      {stage === "not_found" && (
        <div className="w-full max-w-sm text-center space-y-6">
          <div className="w-16 h-16 rounded-full bg-yellow-400/10 flex items-center justify-center mx-auto">
            <svg viewBox="0 0 40 40" fill="none" className="w-10 h-10 text-yellow-600" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M20 12v10M20 27v2" />
              <path strokeLinecap="round" d="M5 34 L20 8 L35 34 Z" />
            </svg>
          </div>
          <div>
            <p className="text-slate-900 font-bold text-xl mb-2">회원 정보를 찾을 수 없어요</p>
            <p className="text-slate-500 text-sm">직원에게 직접 문의해 주세요.</p>
          </div>
          <button onClick={doReset} className="w-full py-4 rounded-xl border border-slate-200 text-slate-600 font-bold">다시 시도</button>
          <AutoCloseBar durationMs={7000} active={stage === "not_found"} onClose={doReset} />
        </div>
      )}

      {/* ── 오류 ── */}
      {stage === "error" && (
        <div className="w-full max-w-sm text-center space-y-6">
          <div className="w-16 h-16 rounded-full bg-red-400/10 flex items-center justify-center mx-auto">
            <svg viewBox="0 0 40 40" fill="none" className="w-10 h-10 text-red-500" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" d="M13 13 L27 27 M27 13 L13 27" />
            </svg>
          </div>
          <div>
            <p className="text-slate-900 font-bold text-xl mb-2">오류가 발생했어요</p>
            <p className="text-slate-500 text-sm">직원에게 문의해 주세요.</p>
          </div>
          <button onClick={doReset} className="w-full py-4 rounded-xl border border-slate-200 text-slate-600 font-bold">처음으로</button>
          <AutoCloseBar durationMs={7000} active={stage === "error"} onClose={doReset} />
        </div>
      )}

      {/* ── 상담 신청 모달 ── */}
      {showConsultModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-6"
          onClick={() => setShowConsultModal(false)}
        >
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <div
            className="relative w-full max-w-sm bg-white border border-slate-200 rounded-3xl p-7 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 닫기 버튼 */}
            <button
              onClick={() => setShowConsultModal(false)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white hover:bg-slate-200 flex items-center justify-center transition-colors"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4 text-slate-500">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>

            <p className="text-slate-500 text-[0.6875rem] tracking-[0.4em] uppercase mb-2">상담 신청</p>
            <h3 className="text-slate-900 font-bold text-2xl mb-2">회원이신가요?</h3>
            <p className="text-slate-500 text-sm mb-8">해당하는 항목을 선택해 주세요.</p>

            <div className="space-y-3">
              {/* 처음 이신가요? */}
              <button
                onClick={() => {
                  setConsultType("new");
                  setShowConsultModal(false);
                  setStage("consult_check");
                }}
                className="w-full flex items-center gap-4 p-5 rounded-2xl border border-[#1D4ED8]/40 bg-[#1D4ED8]/10 active:bg-[#1D4ED8]/20 transition-colors text-left"
              >
                <div className="w-11 h-11 rounded-xl bg-[#1D4ED8]/20 flex items-center justify-center flex-shrink-0">
                  <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5 text-[#2563EB]" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="text-slate-900 font-bold text-base">처음 이신가요?</p>
                  <p className="text-slate-500 text-sm mt-0.5">신규 회원 상담</p>
                </div>
                <svg viewBox="0 0 24 24" fill="none" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-slate-400 flex-shrink-0">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                </svg>
              </button>

              {/* 기존 회원입니다 */}
              <button
                onClick={() => {
                  setShowConsultModal(false);
                  setStage("consult_type");
                }}
                className="w-full flex items-center gap-4 p-5 rounded-2xl border border-[#059669]/30 bg-[#059669]/8 active:bg-[#059669]/15 transition-colors text-left"
              >
                <div className="w-11 h-11 rounded-xl bg-[#059669]/15 flex items-center justify-center flex-shrink-0">
                  <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5 text-[#059669]" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="text-slate-900 font-bold text-base">기존 회원입니다</p>
                  <p className="text-slate-500 text-sm mt-0.5">재등록 · PT 상담</p>
                </div>
                <svg viewBox="0 0 24 24" fill="none" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-slate-400 flex-shrink-0">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
