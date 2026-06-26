import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { X, ChevronRight, Check } from "lucide-react";

const PURPOSES = ["다이어트", "근력 증가", "체형 교정", "통증 개선", "건강 관리", "기타"];
const EXPERIENCES = ["처음 운동", "1년 미만", "1년 이상"];
const MARKETING_CHANNELS = ["문자(SMS)", "카카오톡", "전화"];

type FormState = {
  name: string;
  phone: string;
  birthDate: string;
  gender: string;
  height: string;
  purposes: string[];
  experience: string;
  concern: string;
  privacyAgreed: boolean;
  marketingAgreed: boolean;
  marketingChannels: string[];
};

const INITIAL_FORM: FormState = {
  name: "",
  phone: "",
  birthDate: "",
  gender: "",
  height: "",
  purposes: [],
  experience: "",
  concern: "",
  privacyAgreed: false,
  marketingAgreed: false,
  marketingChannels: [],
};

function ReservationModal({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const mutation = trpc.bodyAnalysis.create.useMutation({
    onSuccess: () => setDone(true),
    onError: (e) => setError(e.message),
  });

  const isValid =
    form.name.trim() &&
    form.phone.trim() &&
    form.birthDate.trim() &&
    form.gender &&
    form.height.trim() &&
    form.purposes.length > 0 &&
    form.experience &&
    form.privacyAgreed;

  function togglePurpose(p: string) {
    setForm((f) => ({
      ...f,
      purposes: f.purposes.includes(p) ? f.purposes.filter((x) => x !== p) : [...f.purposes, p],
    }));
  }

  function toggleChannel(c: string) {
    setForm((f) => ({
      ...f,
      marketingChannels: f.marketingChannels.includes(c) ? f.marketingChannels.filter((x) => x !== c) : [...f.marketingChannels, c],
    }));
  }

  function handleSubmit() {
    if (!isValid) return;
    setError("");
    mutation.mutate({
      name: form.name.trim(),
      phone: form.phone.trim(),
      birthDate: form.birthDate.trim(),
      gender: form.gender,
      height: form.height.trim(),
      purpose: form.purposes.join(","),
      experience: form.experience,
      concern: form.concern.trim() || undefined,
      privacyAgreed: form.privacyAgreed,
      marketingAgreed: form.marketingAgreed,
      marketingChannels: form.marketingChannels.length > 0 ? form.marketingChannels.join(",") : undefined,
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-white flex flex-col rounded-t-2xl"
        style={{ maxHeight: "92svh" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
          <h2 className="text-base font-bold text-[#0f1929]">무료 체형분석 예약</h2>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-100 transition-colors">
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* 본문 */}
        <div className="overflow-y-auto flex-1 px-5 py-5 space-y-5">
          {done ? (
            <div className="py-10 flex flex-col items-center gap-4 text-center">
              <div className="w-14 h-14 bg-[#1a2a4a] rounded-full flex items-center justify-center">
                <Check className="h-7 w-7 text-white" />
              </div>
              <h3 className="text-lg font-bold text-[#0f1929]">예약이 완료되었습니다.</h3>
              <p className="text-sm text-gray-500 leading-relaxed">
                담당자가 순차적으로 연락드려<br />방문 일정을 확정해드립니다.
              </p>
              <div className="w-full bg-gray-50 rounded-xl p-4 text-left space-y-1.5 mt-2">
                <p className="text-xs text-gray-500">※ 체형분석은 사전 예약제로 운영됩니다.</p>
                <p className="text-xs text-gray-500">※ 방문 시 인바디 측정을 함께 진행합니다.</p>
              </div>
              <button
                onClick={onClose}
                className="w-full mt-2 py-3.5 rounded-xl font-semibold text-sm text-white"
                style={{ backgroundColor: "#1a2a4a" }}
              >
                확인
              </button>
            </div>
          ) : (
            <>
              <p className="text-sm text-gray-500 leading-relaxed">
                정확한 상담을 위해 기본 정보를 입력해주세요.<br />
                담당자가 확인 후 방문 일정을 안내드립니다.
              </p>

              <div className="h-px bg-gray-100" />

              {/* 이름 */}
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-[#0f1929]">이름 <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  placeholder="이름을 입력하세요"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm outline-none focus:border-[#1a2a4a] transition-colors"
                />
              </div>

              {/* 연락처 */}
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-[#0f1929]">연락처 <span className="text-red-500">*</span></label>
                <input
                  type="tel"
                  inputMode="numeric"
                  placeholder="숫자만 입력 (예: 01012345678)"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value.replace(/\D/g, "") }))}
                  className="w-full border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm outline-none focus:border-[#1a2a4a] transition-colors"
                />
              </div>

              {/* 생년월일 */}
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-[#0f1929]">생년월일 <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="예: 19900101"
                  value={form.birthDate}
                  onChange={(e) => setForm((f) => ({ ...f, birthDate: e.target.value.replace(/\D/g, "") }))}
                  maxLength={8}
                  className="w-full border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm outline-none focus:border-[#1a2a4a] transition-colors"
                />
              </div>

              {/* 성별 */}
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-[#0f1929]">성별 <span className="text-red-500">*</span></label>
                <div className="flex gap-3">
                  {[["male", "남성"], ["female", "여성"]].map(([val, label]) => (
                    <button
                      key={val}
                      onClick={() => setForm((f) => ({ ...f, gender: val }))}
                      className={`flex-1 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                        form.gender === val
                          ? "bg-[#1a2a4a] text-white border-[#1a2a4a]"
                          : "border-gray-200 text-gray-600 hover:border-[#1a2a4a]"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 키 */}
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-[#0f1929]">키(cm) <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="예: 170"
                  value={form.height}
                  onChange={(e) => setForm((f) => ({ ...f, height: e.target.value.replace(/\D/g, "") }))}
                  className="w-full border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm outline-none focus:border-[#1a2a4a] transition-colors"
                />
              </div>

              {/* 운동 목적 */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-[#0f1929]">운동 목적 <span className="text-red-500">*</span></label>
                <div className="flex flex-wrap gap-2">
                  {PURPOSES.map((p) => (
                    <button
                      key={p}
                      onClick={() => togglePurpose(p)}
                      className={`px-3.5 py-1.5 rounded-full border text-sm font-medium transition-colors ${
                        form.purposes.includes(p)
                          ? "bg-[#1a2a4a] text-white border-[#1a2a4a]"
                          : "border-gray-200 text-gray-600 hover:border-[#1a2a4a]"
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              {/* 운동 경험 */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-[#0f1929]">운동 경험 <span className="text-red-500">*</span></label>
                <div className="flex gap-2 flex-wrap">
                  {EXPERIENCES.map((e) => (
                    <button
                      key={e}
                      onClick={() => setForm((f) => ({ ...f, experience: e }))}
                      className={`px-3.5 py-1.5 rounded-full border text-sm font-medium transition-colors ${
                        form.experience === e
                          ? "bg-[#1a2a4a] text-white border-[#1a2a4a]"
                          : "border-gray-200 text-gray-600 hover:border-[#1a2a4a]"
                      }`}
                    >
                      {e}
                    </button>
                  ))}
                </div>
              </div>

              {/* 고민 부위 */}
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-[#0f1929]">현재 가장 고민되는 부위 또는 목표 <span className="text-xs font-normal text-gray-400">(선택)</span></label>
                <textarea
                  rows={3}
                  placeholder="예: 허리 통증, 뱃살 감량 등"
                  value={form.concern}
                  onChange={(e) => setForm((f) => ({ ...f, concern: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm outline-none focus:border-[#1a2a4a] resize-none transition-colors"
                />
              </div>

              <div className="h-px bg-gray-100" />

              {/* 개인정보 동의 */}
              <div className="space-y-3">
                <button
                  onClick={() => setForm((f) => ({ ...f, privacyAgreed: !f.privacyAgreed }))}
                  className="flex items-start gap-3 w-full text-left"
                >
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                    form.privacyAgreed ? "bg-[#1a2a4a] border-[#1a2a4a]" : "border-gray-300"
                  }`}>
                    {form.privacyAgreed && <Check className="h-3 w-3 text-white" />}
                  </div>
                  <span className="text-sm font-semibold text-[#0f1929]">
                    (필수) 개인정보 수집 및 이용에 동의합니다.
                  </span>
                </button>
                <div className="bg-gray-50 rounded-xl p-4 space-y-1.5 text-xs text-gray-500 leading-relaxed">
                  <p className="font-semibold text-gray-600">개인정보 수집 및 이용 안내</p>
                  <p>• 수집항목 : 이름, 연락처, 생년월일, 성별, 키, 운동 목적, 운동 경험, 상담 내용</p>
                  <p>• 이용목적 : 무료 체형분석 예약 접수, 상담 진행, 방문 일정 안내</p>
                  <p>• 보유기간 : 상담 종료 후 최대 1년 또는 관련 법령에 따른 기간</p>
                  <p className="text-gray-400">※ 동의하지 않을 경우 예약이 제한될 수 있습니다.</p>
                </div>
              </div>

              {/* 마케팅 동의 */}
              <div className="space-y-3">
                <button
                  onClick={() => setForm((f) => ({ ...f, marketingAgreed: !f.marketingAgreed }))}
                  className="flex items-start gap-3 w-full text-left"
                >
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                    form.marketingAgreed ? "bg-[#1a2a4a] border-[#1a2a4a]" : "border-gray-300"
                  }`}>
                    {form.marketingAgreed && <Check className="h-3 w-3 text-white" />}
                  </div>
                  <span className="text-sm font-semibold text-[#0f1929]">
                    (선택) 이벤트 및 할인 혜택, 맞춤 운동 정보 수신에 동의합니다.
                  </span>
                </button>

                {form.marketingAgreed && (
                  <div className="space-y-2 pl-8">
                    <p className="text-xs text-gray-500 font-medium">수신 채널</p>
                    <div className="flex gap-2 flex-wrap">
                      {MARKETING_CHANNELS.map((c) => (
                        <button
                          key={c}
                          onClick={() => toggleChannel(c)}
                          className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-colors ${
                            form.marketingChannels.includes(c)
                              ? "bg-[#1a2a4a] text-white border-[#1a2a4a]"
                              : "border-gray-200 text-gray-600"
                          }`}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-gray-400">※ 언제든지 수신 거부가 가능합니다.</p>
                  </div>
                )}
              </div>

              {error && <p className="text-sm text-red-500 text-center">{error}</p>}

              {/* 제출 버튼 */}
              <button
                onClick={handleSubmit}
                disabled={!isValid || mutation.isPending}
                className="w-full py-4 rounded-xl font-bold text-sm transition-all"
                style={{
                  backgroundColor: isValid ? "#1a2a4a" : "#d1d5db",
                  color: isValid ? "#ffffff" : "#9ca3af",
                }}
              >
                {mutation.isPending ? "예약 중..." : "무료 체형분석 예약하기"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function BodyAnalysisLanding() {
  const [modalOpen, setModalOpen] = useState(false);

  const openModal = () => setModalOpen(true);
  const closeModal = () => setModalOpen(false);

  return (
    <div className="min-h-screen bg-white text-[#0f1929]" style={{ fontFamily: "'Pretendard', 'Apple SD Gothic Neo', sans-serif" }}>
      {/* 네비게이션 */}
      <header className="fixed top-0 left-0 right-0 z-40 bg-white border-b border-gray-100">
        <div className="max-w-lg mx-auto px-5 h-14 flex items-center justify-between">
          <span className="text-base font-bold tracking-widest text-[#0f1929]">ZIANTGYM</span>
          <button className="flex flex-col gap-1.5 p-1">
            <span className="w-5 h-0.5 bg-[#0f1929]" />
            <span className="w-5 h-0.5 bg-[#0f1929]" />
            <span className="w-4 h-0.5 bg-[#0f1929]" />
          </button>
        </div>
      </header>

      <div className="pt-14 pb-20">
        {/* 히어로 섹션 */}
        <section
          className="relative min-h-screen flex flex-col justify-center px-6"
          style={{
            background: "linear-gradient(to bottom, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0.3) 100%)",
            backgroundImage: "url('/hero-bg.jpg')",
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative z-10 max-w-lg mx-auto w-full pt-8">
            <p className="text-xs text-white/60 tracking-[0.2em] mb-4">경기도 시흥시 정왕동 · 맞춤운동센터</p>
            <h1 className="text-3xl font-bold text-white leading-tight mb-3">
              내 몸에 맞는<br />운동을<br />시작합니다.
            </h1>
            <p className="text-sm text-white/70 mb-8">체형 분석부터 운동 방향 설정까지.<br />자이언트짐</p>
            <button
              onClick={openModal}
              className="inline-flex items-center gap-2 px-6 py-3.5 text-sm font-semibold text-[#0f1929] bg-white rounded-sm"
            >
              무료 체형분석 예약
            </button>
          </div>
        </section>

        {/* 분석 시스템 소개 */}
        <section className="px-6 py-14 max-w-lg mx-auto">
          <p className="text-[10px] tracking-[0.3em] text-gray-400 mb-6">ANALYSIS SYSTEM</p>
          <h2 className="text-2xl font-bold text-[#0f1929] leading-snug mb-4">
            운동 전,<br />내 몸을<br />먼저 파악합니다.
          </h2>
          <p className="text-sm text-gray-500 leading-relaxed mb-8">
            자이언트짐은 모든 회원에게 운동 시작 전 체형분석을 실시합니다.
            분석 없이 시작하는 운동은 방향을 잃은 운동입니다.
          </p>
          <button
            onClick={openModal}
            className="w-full py-3.5 text-sm font-bold text-white rounded-sm"
            style={{ backgroundColor: "#1a2a4a" }}
          >
            무료 체형분석 예약
          </button>
        </section>

        {/* 프로세스 단계 */}
        <section className="bg-white px-6 py-10 max-w-lg mx-auto">
          <h3 className="text-lg font-bold text-[#0f1929] mb-2">확인해보세요.</h3>
          <p className="text-sm text-gray-400 mb-8">무료 체형분석 및 상담을 통해 운동 방향을 먼저 결정합니다. 회원권 등록은 그 다음입니다.</p>
          <div className="space-y-0 divide-y divide-gray-100">
            {[
              ["01", "무료 체형분석 예약", true],
              ["02", "센터 방문", false],
              ["03", "체형 · 근골격 분석", false],
              ["04", "운동 방향 설정", false],
              ["05", "헬스 또는 PT 등록", false],
              ["06", "짐플러스 관리 시작", false],
            ].map(([num, label, active]) => (
              <div key={num as string} className="flex items-center justify-between py-4">
                <div className="flex items-center gap-4">
                  <span className={`text-xs ${active ? "text-[#0f1929] font-bold" : "text-gray-300"}`}>{num}</span>
                  <span className={`text-sm ${active ? "font-bold text-[#0f1929]" : "text-gray-400"}`}>{label}</span>
                </div>
                {active && <span className="text-xs text-gray-400 tracking-widest">START</span>}
              </div>
            ))}
          </div>
        </section>

        {/* 체형 평가 특징 */}
        <section className="bg-gray-50 px-6 py-12 max-w-lg mx-auto">
          {[
            { num: "01", title: "체형 평가", desc: "자세 분석, 체형 불균형, 움직임 패턴을 평가합니다. 운동 전 반드시 확인해야 할 현재 몸 상태입니다." },
            { num: "02", title: "근골격 분석", desc: "관절 가동 범위, 근력 불균형, 자세 문제를 정밀 분석합니다." },
            { num: "03", title: "운동 방향 설계", desc: "분석 결과를 바탕으로 개인에게 최적화된 운동 방향을 설계합니다." },
          ].map((item) => (
            <div key={item.num} className="mb-8 last:mb-0">
              <div className="flex items-start gap-4">
                <span className="text-xs text-gray-300 font-medium shrink-0 mt-0.5">{item.num}</span>
                <div>
                  <p className="text-sm font-bold text-[#0f1929] mb-1">{item.title}</p>
                  <p className="text-sm text-gray-500 leading-relaxed">{item.desc}</p>
                </div>
              </div>
            </div>
          ))}
        </section>

        {/* 프로그램 요금 */}
        <section className="bg-[#1a2a4a] px-6 py-14 max-w-lg mx-auto">
          <p className="text-[10px] tracking-[0.3em] text-white/40 mb-4">PROGRAM</p>
          <h2 className="text-xl font-bold text-white mb-8">헬스 회원권</h2>
          <div className="space-y-0 divide-y divide-white/10 mb-8">
            {[["1개월", "80,000원"], ["3개월", "220,000원"], ["6개월", "400,000원"], ["12개월", "720,000원"]].map(([period, price]) => (
              <div key={period} className="flex items-center justify-between py-3.5">
                <span className="text-sm text-white/70">{period}</span>
                <span className="text-sm font-semibold text-white">{price}</span>
              </div>
            ))}
          </div>
          <h2 className="text-xl font-bold text-white mb-4 mt-8">PT 프로그램</h2>
          <div className="space-y-0 divide-y divide-white/10 mb-10">
            {[["10회권", "500,000원"], ["20회권", "960,000원"]].map(([count, price]) => (
              <div key={count} className="flex items-center justify-between py-3.5">
                <span className="text-sm text-white/70">{count}</span>
                <span className="text-sm font-semibold text-white">{price}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-white/40 text-center mb-6">모든 프로그램은 무료 체형분석 후 결정합니다</p>
          <button
            onClick={openModal}
            className="w-full py-3.5 text-sm font-bold text-[#0f1929] bg-white rounded-sm"
          >
            무료 체형분석 예약
          </button>
        </section>
      </div>

      {/* 하단 고정 탭 */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-[#1a2a4a] flex" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        <button
          onClick={openModal}
          className="flex-1 py-4 text-sm font-semibold text-white text-center"
        >
          무료 체형분석 예약
        </button>
        <div className="w-px bg-white/20" />
        <a
          href="tel:031-000-0000"
          className="flex-1 py-4 text-sm font-semibold text-white/70 text-center"
        >
          상담 신청
        </a>
      </div>

      {/* 예약 모달 */}
      {modalOpen && <ReservationModal onClose={closeModal} />}
    </div>
  );
}
