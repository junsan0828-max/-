import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";

const EXERCISE_PURPOSES = ["다이어트", "근력 증가", "체형 교정", "통증 개선", "건강 관리", "기타"];
const TIME_SLOTS = ["오전 (08–12시)", "오후 (12–17시)", "저녁 (17–21시)", "야간 (21–23시)"];
const BRANCHES = [
  { label: "1호점", url: "https://naver.me/GALzXokD" },
  { label: "2호점", url: "https://naver.me/51upjb7H" },
];

export default function LandingTrialModal({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [exercisePurpose, setExercisePurpose] = useState("");
  const [timeSlot, setTimeSlot] = useState("");
  const [branch, setBranch] = useState("1호점");
  const [done, setDone] = useState(false);

  const submit = trpc.landing.submitInquiry.useMutation();

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  const canSubmit = name.trim() && phone.length >= 10 && exercisePurpose && timeSlot;

  const handleSubmit = async () => {
    try {
      await submit.mutateAsync({
        name: name.trim(),
        phone,
        exercisePurpose,
        concern: `희망시간대: ${timeSlot}`,
        agreedPrivacy: true,
      });
    } catch {
      // 저장 실패해도 네이버 연결은 진행
    }
    const naverUrl = BRANCHES.find((b) => b.label === branch)?.url ?? BRANCHES[0].url;
    window.open(naverUrl, "_blank");
    setDone(true);
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl max-h-[92vh] overflow-y-auto">
        {/* 헤더 */}
        <div className="sticky top-0 bg-white z-10 flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100">
          <div>
            <p className="text-[10px] tracking-[0.3em] uppercase text-gray-300 mb-0.5">Trial Reservation</p>
            <h2 className="text-base font-bold text-[#0B1D3A]">1만원 체험 예약</h2>
          </div>
          <button onClick={onClose} className="p-2 text-gray-300 hover:text-gray-600 transition-colors">
            <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {!done ? (
          <div className="px-6 py-6 space-y-6">
            {/* 이름 */}
            <div>
              <label className="block text-xs font-medium text-[#0B1D3A] mb-2">
                이름 <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="홍길동"
                className="w-full px-4 py-3 border border-gray-200 text-sm text-[#0B1D3A] placeholder-gray-300 focus:outline-none focus:border-[#0B1D3A] transition-colors"
              />
            </div>

            {/* 연락처 */}
            <div>
              <label className="block text-xs font-medium text-[#0B1D3A] mb-2">
                연락처 <span className="text-red-400">*</span>
              </label>
              <input
                type="tel"
                inputMode="numeric"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                placeholder="01012345678"
                maxLength={11}
                className="w-full px-4 py-3 border border-gray-200 text-sm text-[#0B1D3A] placeholder-gray-300 focus:outline-none focus:border-[#0B1D3A] transition-colors"
              />
            </div>

            {/* 지점 선택 */}
            <div>
              <label className="block text-xs font-medium text-[#0B1D3A] mb-2">
                지점 선택 <span className="text-red-400">*</span>
              </label>
              <div className="flex gap-2">
                {BRANCHES.map((b) => (
                  <button
                    key={b.label}
                    onClick={() => setBranch(b.label)}
                    className={`flex-1 py-3 text-sm font-medium border transition-colors ${
                      branch === b.label
                        ? "bg-[#0B1D3A] text-white border-[#0B1D3A]"
                        : "bg-white text-gray-400 border-gray-200 hover:border-gray-400"
                    }`}
                  >
                    {b.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 운동목적 */}
            <div>
              <label className="block text-xs font-medium text-[#0B1D3A] mb-2">
                운동목적 <span className="text-red-400">*</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {EXERCISE_PURPOSES.map((p) => (
                  <button
                    key={p}
                    onClick={() => setExercisePurpose(p)}
                    className={`px-4 py-2 text-xs border transition-colors ${
                      exercisePurpose === p
                        ? "bg-[#0B1D3A] text-white border-[#0B1D3A]"
                        : "bg-white text-gray-400 border-gray-200 hover:border-gray-400"
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {/* 희망 시간대 */}
            <div>
              <label className="block text-xs font-medium text-[#0B1D3A] mb-2">
                희망 시간대 <span className="text-red-400">*</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                {TIME_SLOTS.map((t) => (
                  <button
                    key={t}
                    onClick={() => setTimeSlot(t)}
                    className={`py-3 text-xs border transition-colors ${
                      timeSlot === t
                        ? "bg-[#0B1D3A] text-white border-[#0B1D3A]"
                        : "bg-white text-gray-400 border-gray-200 hover:border-gray-400"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-2 pb-2">
              <p className="text-[11px] text-gray-300 leading-relaxed mb-4">
                입력하신 정보는 예약 확인 목적으로만 사용됩니다.<br />
                아래 버튼을 누르면 네이버 플레이스 예약 페이지로 이동합니다.
              </p>
              <button
                onClick={handleSubmit}
                disabled={!canSubmit || submit.isPending}
                className="w-full py-4 bg-[#0B1D3A] text-white text-sm font-semibold tracking-wide disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
              >
                {submit.isPending ? "처리 중..." : "네이버 예약 페이지로 이동 →"}
              </button>
            </div>
          </div>
        ) : (
          <div className="px-6 py-12 flex flex-col items-center text-center">
            <div className="w-14 h-14 rounded-full bg-[#0B1D3A]/8 flex items-center justify-center mb-5">
              <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.5} stroke="#0B1D3A" className="w-7 h-7">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-[#0B1D3A] mb-2">네이버 예약 페이지가 열렸습니다</h3>
            <p className="text-sm text-gray-400 font-light leading-relaxed mb-8">
              정보를 입력하셨습니다.<br />
              열린 네이버 페이지에서 예약을 완료해주세요.
            </p>
            <button
              onClick={onClose}
              className="w-full py-3.5 bg-[#0B1D3A] text-white text-sm font-medium"
            >
              닫기
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
