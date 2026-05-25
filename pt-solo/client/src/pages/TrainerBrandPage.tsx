import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Instagram, Youtube, MessageCircle, MapPin, Calendar, ChevronRight, ArrowLeft, CheckCircle } from "lucide-react";

const JOB_LABELS: Record<string, string> = {
  personal_trainer: "퍼스널 트레이너",
  pilates: "필라테스 강사",
  trainee: "트레이너 수련생",
  studio_owner: "스튜디오 원장",
  freelancer: "프리랜서 트레이너",
  student: "체육 전공생",
};

const CAREER_LABELS: Record<string, string> = {
  "1": "경력 1년 미만",
  "1-3": "경력 1~3년",
  "3-5": "경력 3~5년",
  "5+": "경력 5년 이상",
};

interface Props { username: string; }

export default function TrainerBrandPage({ username }: Props) {
  const { data: trainer, isLoading, error } = trpc.brand.getPublicProfile.useQuery({ username });
  const [showBooking, setShowBooking] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", interestType: "", message: "" });
  const [submitted, setSubmitted] = useState(false);

  const submitMutation = trpc.brand.submitBooking.useMutation({
    onSuccess: () => setSubmitted(true),
  });

  const primaryColor = trainer?.brandColor || "#1a00ff";

  if (isLoading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (error || !trainer) return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-3 p-6">
      <p className="text-gray-500 text-sm">페이지를 찾을 수 없습니다.</p>
      <a href="/" className="text-blue-500 text-sm underline">핏스텝 홈으로</a>
    </div>
  );

  const specialties = trainer.brandSpecialties ? trainer.brandSpecialties.split(",").map((s: string) => s.trim()).filter(Boolean) : [];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <div className="relative" style={{ background: `linear-gradient(135deg, ${primaryColor}dd, ${primaryColor})` }}>
        <div className="max-w-sm mx-auto px-6 pt-16 pb-12 text-center">
          {trainer.profileImage ? (
            <img src={trainer.profileImage} alt={trainer.trainerName} className="w-24 h-24 rounded-full object-cover mx-auto mb-4 border-4 border-white shadow-lg" />
          ) : (
            <div className="w-24 h-24 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-4 border-4 border-white shadow-lg">
              <span className="text-3xl font-bold text-white">{trainer.trainerName?.[0]}</span>
            </div>
          )}
          <h1 className="text-2xl font-bold text-white mb-1">{trainer.trainerName}</h1>
          <p className="text-white/80 text-sm mb-2">
            {JOB_LABELS[trainer.jobType] || trainer.jobType}
            {trainer.careerRange && ` · ${CAREER_LABELS[trainer.careerRange] || trainer.careerRange}`}
          </p>
          {trainer.activityArea && (
            <div className="flex items-center justify-center gap-1 text-white/70 text-xs">
              <MapPin className="h-3 w-3" />
              <span>{trainer.activityArea}</span>
            </div>
          )}
          {/* 소셜 링크 */}
          <div className="flex items-center justify-center gap-4 mt-4">
            {trainer.brandInstagram && (
              <a href={trainer.brandInstagram} target="_blank" rel="noreferrer" className="w-9 h-9 bg-white/20 rounded-full flex items-center justify-center hover:bg-white/30 transition-colors">
                <Instagram className="h-4 w-4 text-white" />
              </a>
            )}
            {trainer.brandKakao && (
              <a href={trainer.brandKakao} target="_blank" rel="noreferrer" className="w-9 h-9 bg-white/20 rounded-full flex items-center justify-center hover:bg-white/30 transition-colors">
                <MessageCircle className="h-4 w-4 text-white" />
              </a>
            )}
            {trainer.brandYoutube && (
              <a href={trainer.brandYoutube} target="_blank" rel="noreferrer" className="w-9 h-9 bg-white/20 rounded-full flex items-center justify-center hover:bg-white/30 transition-colors">
                <Youtube className="h-4 w-4 text-white" />
              </a>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-sm mx-auto px-4 py-6 space-y-4">
        {/* 소개 */}
        {trainer.brandBio && (
          <div className="bg-white rounded-2xl p-5 shadow-sm">
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">소개</h2>
            <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap">{trainer.brandBio}</p>
          </div>
        )}

        {/* 전문 분야 */}
        {specialties.length > 0 && (
          <div className="bg-white rounded-2xl p-5 shadow-sm">
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">전문 분야</h2>
            <div className="flex flex-wrap gap-2">
              {specialties.map((s: string, i: number) => (
                <span key={i} className="px-3 py-1 rounded-full text-sm font-medium text-white" style={{ backgroundColor: primaryColor }}>
                  {s}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* 상담 예약 버튼 */}
        {trainer.bookingEnabled ? (
          <button
            onClick={() => setShowBooking(true)}
            className="w-full py-4 rounded-2xl text-white font-bold text-base shadow-md active:opacity-90 transition-opacity flex items-center justify-center gap-2"
            style={{ backgroundColor: primaryColor }}
          >
            <Calendar className="h-5 w-5" />
            상담 예약하기
            <ChevronRight className="h-5 w-5" />
          </button>
        ) : null}

        {/* 핏스텝 워터마크 */}
        <p className="text-center text-xs text-gray-400 pt-2">
          Powered by{" "}
          <a href="/" className="font-semibold text-gray-500">FIT STEP</a>
        </p>
      </div>

      {/* 예약 폼 오버레이 */}
      {showBooking && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end justify-center">
          <div className="bg-white w-full max-w-sm rounded-t-3xl p-6 space-y-4">
            {submitted ? (
              <div className="py-8 text-center space-y-3">
                <CheckCircle className="h-12 w-12 mx-auto" style={{ color: primaryColor }} />
                <p className="text-lg font-bold text-gray-800">예약 신청 완료!</p>
                <p className="text-sm text-gray-500">{trainer.trainerName} 트레이너가 곧 연락드립니다.</p>
                <button onClick={() => { setShowBooking(false); setSubmitted(false); setForm({ name: "", phone: "", interestType: "", message: "" }); }}
                  className="w-full py-3 rounded-xl text-white font-medium" style={{ backgroundColor: primaryColor }}>
                  닫기
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-gray-800">상담 예약</h3>
                  <button onClick={() => setShowBooking(false)} className="text-gray-400 p-1">
                    <ArrowLeft className="h-5 w-5" />
                  </button>
                </div>
                {trainer.bookingMessage && (
                  <p className="text-sm text-gray-500 bg-gray-50 rounded-xl p-3">{trainer.bookingMessage}</p>
                )}
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-gray-500 font-medium">이름 *</label>
                    <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                      placeholder="홍길동" className="w-full mt-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-400" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 font-medium">연락처 *</label>
                    <input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
                      placeholder="010-0000-0000" className="w-full mt-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-400" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 font-medium">관심 프로그램</label>
                    <select value={form.interestType} onChange={e => setForm(p => ({ ...p, interestType: e.target.value }))}
                      className="w-full mt-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-400 bg-white">
                      <option value="">선택</option>
                      <option value="PT">PT (퍼스널 트레이닝)</option>
                      <option value="필라테스">필라테스</option>
                      <option value="기타">기타</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 font-medium">남기실 말씀</label>
                    <textarea value={form.message} onChange={e => setForm(p => ({ ...p, message: e.target.value }))}
                      placeholder="문의 내용이나 희망 시간대를 적어주세요..." rows={3}
                      className="w-full mt-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-400 resize-none" />
                  </div>
                </div>
                <button
                  disabled={!form.name || !form.phone || submitMutation.isPending}
                  onClick={() => submitMutation.mutate({ trainerId: trainer.trainerId, ...form })}
                  className="w-full py-3.5 rounded-xl text-white font-bold disabled:opacity-50"
                  style={{ backgroundColor: primaryColor }}
                >
                  {submitMutation.isPending ? "신청 중..." : "예약 신청"}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
