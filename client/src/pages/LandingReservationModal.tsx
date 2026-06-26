import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";

const EXERCISE_PURPOSES = ["다이어트", "근력 증가", "체형 교정", "통증 개선", "건강 관리", "기타"];
const EXERCISE_EXPERIENCES = ["처음 운동", "1년 미만", "1년 이상"];
const MARKETING_CHANNELS = ["문자(SMS)", "카카오톡", "전화"];

type Form = {
  name: string;
  phone: string;
  birthdate: string;
  gender: string;
  height: string;
  exercisePurpose: string;
  exerciseExperience: string;
  concern: string;
  agreedPrivacy: boolean;
  agreedMarketing: boolean;
  marketingChannels: string[];
};

const defaultForm: Form = {
  name: "", phone: "", birthdate: "", gender: "",
  height: "", exercisePurpose: "", exerciseExperience: "",
  concern: "", agreedPrivacy: false, agreedMarketing: false, marketingChannels: [],
};

export default function LandingReservationModal({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState<Form>(defaultForm);
  const [done, setDone] = useState(false);

  // 모달 열릴 때 스크롤 막기
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  const [submitting, setSubmitting] = useState(false);

  const submitMutation = trpc.landing.submitInquiry.useMutation();

  const canSubmit =
    form.name.trim() &&
    form.phone.trim() &&
    form.birthdate.trim() &&
    form.gender &&
    form.height.trim() &&
    form.exercisePurpose &&
    form.exerciseExperience &&
    form.agreedPrivacy;

  async function handleSubmit() {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    try {
      // 자이언트짐++ 내부 저장
      submitMutation.mutate({
        name: form.name.trim(),
        phone: form.phone.trim(),
        birthdate: form.birthdate.trim(),
        gender: form.gender,
        height: form.height.trim(),
        exercisePurpose: form.exercisePurpose,
        exerciseExperience: form.exerciseExperience,
        concern: form.concern.trim() || undefined,
        agreedPrivacy: 1,
        agreedMarketing: form.agreedMarketing ? 1 : 0,
        marketingChannels: form.marketingChannels.length > 0 ? form.marketingChannels.join(", ") : undefined,
      });
      // 통합운영시스템 상담관리 카드 자동 생성
      const res = await fetch("https://remarkable-tenderness-production.up.railway.app/api/booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          phone: form.phone.trim(),
          birthDate: form.birthdate.trim(),
          gender: form.gender,
          height: form.height.trim(),
          purpose: form.exercisePurpose,
          experience: form.exerciseExperience,
          concern: form.concern.trim() || undefined,
          privacyAgreed: true,
          marketingAgreed: form.agreedMarketing,
          marketingChannels: form.marketingChannels.length > 0 ? form.marketingChannels.join(", ") : undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        console.error("CRM sync failed:", res.status, err);
      }
      setDone(true);
    } catch (e) {
      console.error("Booking submit error:", e);
      setDone(true);
    } finally {
      setSubmitting(false);
    }
  }

  function toggleChannel(ch: string) {
    setForm(p => ({
      ...p,
      marketingChannels: p.marketingChannels.includes(ch)
        ? p.marketingChannels.filter(c => c !== ch)
        : [...p.marketingChannels, ch],
    }));
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center">
      {/* 배경 오버레이 */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* 모달 */}
      <div className="relative bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl max-h-[92vh] flex flex-col shadow-2xl">
        {/* 헤더 */}
        <div className="flex items-start justify-between px-5 pt-5 pb-4 border-b border-gray-100 flex-shrink-0">
          <div>
            <p className="text-[11px] text-gray-400 tracking-[0.2em] uppercase font-medium">ZIANTGYM</p>
            <h2 className="text-[18px] font-bold text-[#0B1D3A] mt-0.5">무료 체형분석 예약</h2>
            <p className="text-[12px] text-gray-400 mt-1 leading-relaxed">
              정확한 상담을 위해 기본 정보를 입력해주세요.<br />
              담당자가 확인 후 방문 일정을 안내드립니다.
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-700 transition-colors flex-shrink-0 mt-0.5"
          >
            <svg viewBox="0 0 24 24" fill="none" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 콘텐츠 */}
        <div className="overflow-y-auto flex-1 px-5 py-5">
          {done ? (
            /* 완료 화면 */
            <div className="py-8 text-center space-y-5">
              <div className="w-16 h-16 rounded-full bg-[#0B1D3A]/5 flex items-center justify-center mx-auto">
                <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.5} stroke="#0B1D3A" className="w-8 h-8">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
              </div>
              <div>
                <p className="text-[17px] font-bold text-[#0B1D3A]">예약이 완료되었습니다</p>
                <p className="text-[13px] text-gray-500 mt-2 leading-relaxed">
                  담당자가 순차적으로 연락드려<br />
                  방문 일정을 확정해드립니다.
                </p>
              </div>
              <div className="bg-gray-50 rounded-xl p-4 text-left space-y-1.5">
                <p className="text-[11px] text-gray-400">※ 체형분석은 사전 예약제로 운영됩니다.</p>
                <p className="text-[11px] text-gray-400">※ 방문 시 인바디 측정을 함께 진행합니다.</p>
              </div>
              <button
                onClick={onClose}
                className="w-full py-3.5 bg-[#0B1D3A] text-white text-[13px] font-semibold tracking-wide"
              >
                확인
              </button>
            </div>
          ) : (
            <div className="space-y-5">
              {/* 예약 정보 */}
              <div className="space-y-4">

                {/* 이름 */}
                <Field label="이름" required>
                  <input
                    type="text"
                    value={form.name}
                    onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                    placeholder="홍길동"
                    className="w-full border border-gray-200 px-3.5 py-3 text-[14px] text-[#0B1D3A] focus:outline-none focus:border-[#0B1D3A] transition-colors"
                  />
                </Field>

                {/* 연락처 */}
                <Field label="연락처" required>
                  <input
                    type="tel"
                    inputMode="numeric"
                    value={form.phone}
                    onChange={e => setForm(p => ({ ...p, phone: e.target.value.replace(/[^0-9-]/g, "") }))}
                    placeholder="010-0000-0000"
                    className="w-full border border-gray-200 px-3.5 py-3 text-[14px] text-[#0B1D3A] focus:outline-none focus:border-[#0B1D3A] transition-colors"
                  />
                </Field>

                {/* 생년월일 */}
                <Field label="생년월일" required>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={form.birthdate}
                    onChange={e => setForm(p => ({ ...p, birthdate: e.target.value.replace(/[^0-9]/g, "") }))}
                    placeholder="19900101"
                    maxLength={8}
                    className="w-full border border-gray-200 px-3.5 py-3 text-[14px] text-[#0B1D3A] focus:outline-none focus:border-[#0B1D3A] transition-colors"
                  />
                </Field>

                {/* 성별 */}
                <Field label="성별" required>
                  <div className="flex gap-3">
                    {[{ val: "남성", label: "남성" }, { val: "여성", label: "여성" }].map(g => (
                      <button
                        key={g.val}
                        type="button"
                        onClick={() => setForm(p => ({ ...p, gender: g.val }))}
                        className={`flex-1 py-3 text-[13px] font-medium border transition-colors ${
                          form.gender === g.val
                            ? "border-[#0B1D3A] bg-[#0B1D3A] text-white"
                            : "border-gray-200 text-gray-500 hover:border-gray-400"
                        }`}
                      >
                        {g.label}
                      </button>
                    ))}
                  </div>
                </Field>

                {/* 키 */}
                <Field label="키(cm)" required>
                  <div className="relative">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={form.height}
                      onChange={e => setForm(p => ({ ...p, height: e.target.value.replace(/[^0-9]/g, "") }))}
                      placeholder="170"
                      className="w-full border border-gray-200 px-3.5 py-3 text-[14px] text-[#0B1D3A] focus:outline-none focus:border-[#0B1D3A] transition-colors pr-10"
                    />
                    <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[13px] text-gray-400">cm</span>
                  </div>
                </Field>

                {/* 운동 목적 */}
                <Field label="운동 목적" required>
                  <div className="grid grid-cols-3 gap-2">
                    {EXERCISE_PURPOSES.map(p => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setForm(f => ({ ...f, exercisePurpose: p }))}
                        className={`py-2.5 text-[12px] font-medium border transition-colors ${
                          form.exercisePurpose === p
                            ? "border-[#0B1D3A] bg-[#0B1D3A] text-white"
                            : "border-gray-200 text-gray-500 hover:border-gray-400"
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </Field>

                {/* 운동 경험 */}
                <Field label="운동 경험" required>
                  <div className="flex gap-2">
                    {EXERCISE_EXPERIENCES.map(e => (
                      <button
                        key={e}
                        type="button"
                        onClick={() => setForm(f => ({ ...f, exerciseExperience: e }))}
                        className={`flex-1 py-2.5 text-[12px] font-medium border transition-colors ${
                          form.exerciseExperience === e
                            ? "border-[#0B1D3A] bg-[#0B1D3A] text-white"
                            : "border-gray-200 text-gray-500 hover:border-gray-400"
                        }`}
                      >
                        {e}
                      </button>
                    ))}
                  </div>
                </Field>

                {/* 고민 (선택) */}
                <Field label="현재 가장 고민되는 부위 또는 목표" optional>
                  <textarea
                    value={form.concern}
                    onChange={e => setForm(p => ({ ...p, concern: e.target.value }))}
                    placeholder="예: 허리 통증, 뱃살 감량, 어깨 교정 등"
                    rows={2}
                    className="w-full border border-gray-200 px-3.5 py-3 text-[14px] text-[#0B1D3A] focus:outline-none focus:border-[#0B1D3A] transition-colors resize-none"
                  />
                </Field>
              </div>

              {/* 구분선 */}
              <div className="border-t border-gray-100" />

              {/* 동의 항목 */}
              <div className="space-y-4">

                {/* 필수 동의 */}
                <div className="space-y-3">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <div
                      onClick={() => setForm(p => ({ ...p, agreedPrivacy: !p.agreedPrivacy }))}
                      className={`w-5 h-5 flex-shrink-0 border-2 flex items-center justify-center mt-0.5 transition-colors cursor-pointer ${
                        form.agreedPrivacy ? "bg-[#0B1D3A] border-[#0B1D3A]" : "border-gray-300"
                      }`}
                    >
                      {form.agreedPrivacy && (
                        <svg viewBox="0 0 24 24" fill="none" strokeWidth={2.5} stroke="white" className="w-3 h-3">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                        </svg>
                      )}
                    </div>
                    <div>
                      <p className="text-[13px] font-semibold text-[#0B1D3A]">
                        <span className="text-red-500 mr-1">(필수)</span>
                        개인정보 수집 및 이용에 동의합니다.
                      </p>
                    </div>
                  </label>

                  <div className="bg-gray-50 rounded-lg p-3.5 ml-8 space-y-1.5">
                    <p className="text-[11px] text-gray-500 font-semibold mb-2">개인정보 수집 및 이용 안내</p>
                    {[
                      "수집항목 : 이름, 연락처, 생년월일, 성별, 키, 운동 목적, 운동 경험, 상담 내용",
                      "이용목적 : 무료 체형분석 예약 접수, 상담 진행, 방문 일정 안내",
                      "보유기간 : 상담 종료 후 최대 1년 또는 관련 법령에 따른 기간",
                    ].map((t, i) => (
                      <p key={i} className="text-[11px] text-gray-400">• {t}</p>
                    ))}
                    <p className="text-[11px] text-gray-400 mt-2">※ 동의하지 않을 경우 예약이 제한될 수 있습니다.</p>
                  </div>
                </div>

                {/* 구분선 */}
                <div className="border-t border-gray-100" />

                {/* 선택 동의 */}
                <div className="space-y-3">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <div
                      onClick={() => setForm(p => ({ ...p, agreedMarketing: !p.agreedMarketing }))}
                      className={`w-5 h-5 flex-shrink-0 border-2 flex items-center justify-center mt-0.5 transition-colors cursor-pointer ${
                        form.agreedMarketing ? "bg-[#0B1D3A] border-[#0B1D3A]" : "border-gray-300"
                      }`}
                    >
                      {form.agreedMarketing && (
                        <svg viewBox="0 0 24 24" fill="none" strokeWidth={2.5} stroke="white" className="w-3 h-3">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                        </svg>
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="text-[13px] font-semibold text-[#0B1D3A]">
                        <span className="text-gray-400 mr-1">(선택)</span>
                        이벤트 및 할인 혜택, 맞춤 운동 정보 수신에 동의합니다.
                      </p>
                    </div>
                  </label>

                  {form.agreedMarketing && (
                    <div className="ml-8 space-y-2">
                      <p className="text-[11px] text-gray-500 font-medium">수신 채널</p>
                      <div className="flex gap-2">
                        {MARKETING_CHANNELS.map(ch => (
                          <button
                            key={ch}
                            type="button"
                            onClick={() => toggleChannel(ch)}
                            className={`px-3 py-2 text-[11px] font-medium border transition-colors ${
                              form.marketingChannels.includes(ch)
                                ? "border-[#0B1D3A] bg-[#0B1D3A] text-white"
                                : "border-gray-200 text-gray-500"
                            }`}
                          >
                            {ch}
                          </button>
                        ))}
                      </div>
                      <p className="text-[11px] text-gray-400">※ 언제든지 수신 거부가 가능합니다.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 하단 버튼 (완료 전에만) */}
        {!done && (
          <div className="flex-shrink-0 px-5 py-4 border-t border-gray-100">
            <button
              onClick={handleSubmit}
              disabled={!canSubmit || submitting}
              className={`w-full py-4 text-[13px] font-semibold tracking-[0.1em] uppercase transition-all ${
                canSubmit && !submitting
                  ? "bg-[#0B1D3A] text-white hover:bg-[#162d5a]"
                  : "bg-gray-100 text-gray-400 cursor-not-allowed"
              }`}
            >
              {submitting ? "예약 중..." : "무료 체형분석 예약하기"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, required, optional, children }: {
  label: string;
  required?: boolean;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-[12px] font-semibold text-[#0B1D3A] tracking-wide">
        {label}
        {required && <span className="text-red-400 ml-1">*</span>}
        {optional && <span className="text-gray-400 ml-1 font-normal">(선택)</span>}
      </p>
      {children}
    </div>
  );
}
