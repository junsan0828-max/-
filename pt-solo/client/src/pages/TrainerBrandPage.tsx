import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Instagram, Youtube, MessageCircle, Calendar, ChevronRight, ArrowLeft, CheckCircle, Award, Dumbbell, PlaySquare, Star, ExternalLink } from "lucide-react";

const JOB_LABELS: Record<string, string> = {
  personal_trainer: "퍼스널 트레이너",
  pilates: "필라테스 강사",
  trainee: "트레이너 수련생",
  studio_owner: "스튜디오 원장",
  freelancer: "프리랜서 트레이너",
  student: "체육 전공생",
};
const CAREER_LABELS: Record<string, string> = {
  "1": "경력 1년 미만", "1-3": "경력 1~3년", "3-5": "경력 3~5년", "5+": "경력 5년 이상",
};
const CAREER_CAT_LABELS: Record<string, string> = { cert: "자격증", career: "경력", edu: "학력", award: "수상" };

interface BrandBlock { id: string; type: string; visible: boolean; data: any; }

interface Props { username: string; }

export default function TrainerBrandPage({ username }: Props) {
  const { data: trainer, isLoading, error } = trpc.brand.getPublicProfile.useQuery({ username });
  const [showBooking, setShowBooking] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", interestType: "", message: "" });
  const [submitted, setSubmitted] = useState(false);

  const submitMutation = trpc.brand.submitBooking.useMutation({
    onSuccess: () => setSubmitted(true),
  });

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

  // Parse blocks — fall back to legacy fields if no brandBlocks
  let blocks: BrandBlock[] = [];
  if (trainer.brandBlocks) {
    try { blocks = JSON.parse(trainer.brandBlocks); } catch { blocks = []; }
  }

  if (blocks.length === 0) {
    // Legacy mode: reconstruct blocks from old columns
    const spc = trainer.brandSpecialties ? trainer.brandSpecialties.split(",").map((s: string) => s.trim()).filter(Boolean) : [];
    blocks = [
      { id: "intro", type: "intro", visible: true, data: { bio: trainer.brandBio, color: trainer.brandColor } },
      ...(spc.length > 0 ? [{ id: "spc", type: "specialties", visible: true, data: { items: spc } }] : []),
      ...((trainer.brandInstagram || trainer.brandKakao || trainer.brandYoutube) ? [{ id: "sns", type: "sns", visible: true, data: { instagram: trainer.brandInstagram, kakao: trainer.brandKakao, youtube: trainer.brandYoutube } }] : []),
      ...(trainer.bookingEnabled ? [{ id: "bk", type: "booking", visible: true, data: { enabled: true, message: trainer.bookingMessage } }] : []),
    ];
  }

  const visibleBlocks = blocks.filter(b => b.visible);
  const introBlock = visibleBlocks.find(b => b.type === "intro");
  const primaryColor: string = introBlock?.data?.color ?? trainer.brandColor ?? "#1a00ff";
  const bookingBlock = visibleBlocks.find(b => b.type === "booking" && b.data?.enabled);

  function renderBlock(block: BrandBlock) {
    const d = block.data;

    if (block.type === "intro") return (
      <div key={block.id} className="bg-white rounded-2xl p-5 shadow-sm space-y-2">
        {d.bio && <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap">{d.bio}</p>}
      </div>
    );

    if (block.type === "specialties") {
      const items: string[] = d.items ?? [];
      if (items.length === 0) return null;
      return (
        <div key={block.id} className="bg-white rounded-2xl p-5 shadow-sm">
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">전문 분야</h2>
          <div className="flex flex-wrap gap-2">
            {items.map((s, i) => (
              <span key={i} className="px-3 py-1 rounded-full text-sm font-medium text-white" style={{ backgroundColor: primaryColor }}>
                {s}
              </span>
            ))}
          </div>
        </div>
      );
    }

    if (block.type === "career") {
      const items: { text: string; category: string }[] = d.items ?? [];
      if (items.length === 0) return null;
      const grouped: Record<string, string[]> = {};
      items.forEach(i => { if (!grouped[i.category]) grouped[i.category] = []; grouped[i.category].push(i.text); });
      return (
        <div key={block.id} className="bg-white rounded-2xl p-5 shadow-sm">
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <Award className="h-3.5 w-3.5" /> 경력 · 자격증
          </h2>
          <div className="space-y-3">
            {Object.entries(grouped).map(([cat, texts]) => (
              <div key={cat}>
                <p className="text-[10px] font-bold text-gray-400 uppercase mb-1.5">{CAREER_CAT_LABELS[cat] ?? cat}</p>
                {texts.map((text, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm text-gray-700">
                    <span className="text-gray-300 mt-1">•</span>
                    <span>{text}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (block.type === "sns") {
      const links = [
        { key: "instagram", icon: Instagram, label: "Instagram", href: d.instagram },
        { key: "youtube",   icon: Youtube,   label: "YouTube",   href: d.youtube   },
        { key: "kakao",     icon: MessageCircle, label: "KakaoTalk", href: d.kakao },
      ].filter(l => l.href);
      if (links.length === 0) return null;
      return (
        <div key={block.id} className="bg-white rounded-2xl p-5 shadow-sm">
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">SNS</h2>
          <div className="space-y-2">
            {links.map(({ key, icon: Icon, label, href }) => (
              <a key={key} href={href} target="_blank" rel="noreferrer"
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-gray-100 hover:border-gray-200 transition-colors">
                <Icon className="h-4 w-4 text-gray-500" />
                <span className="text-sm text-gray-700">{label}</span>
                <ExternalLink className="h-3.5 w-3.5 text-gray-400 ml-auto" />
              </a>
            ))}
          </div>
        </div>
      );
    }

    if (block.type === "programs") {
      const items: { name: string; desc: string }[] = d.items ?? [];
      if (items.length === 0) return null;
      return (
        <div key={block.id} className="bg-white rounded-2xl p-5 shadow-sm">
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <Dumbbell className="h-3.5 w-3.5" /> 프로그램
          </h2>
          <div className="space-y-3">
            {items.map((item, i) => (
              <div key={i} className="border border-gray-100 rounded-xl p-4">
                <p className="font-semibold text-sm text-gray-800">{item.name}</p>
                {item.desc && <p className="text-xs text-gray-500 mt-1 leading-relaxed">{item.desc}</p>}
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (block.type === "video" && d.youtubeUrl) {
      const videoId = d.youtubeUrl.match(/(?:v=|youtu\.be\/)([^&\s]+)/)?.[1];
      return (
        <div key={block.id} className="bg-white rounded-2xl overflow-hidden shadow-sm">
          {videoId ? (
            <iframe
              src={`https://www.youtube.com/embed/${videoId}`}
              className="w-full aspect-video"
              allowFullScreen
              title="운동 영상"
            />
          ) : (
            <a href={d.youtubeUrl} target="_blank" rel="noreferrer"
              className="flex items-center gap-3 p-5">
              <PlaySquare className="h-5 w-5 text-red-500" />
              <span className="text-sm text-gray-700">운동 영상 보기</span>
            </a>
          )}
          {d.description && (
            <div className="px-5 py-3 border-t border-gray-100">
              <p className="text-xs text-gray-500">{d.description}</p>
            </div>
          )}
        </div>
      );
    }

    return null;
  }

  const bgImage: string | undefined = introBlock?.data?.bgImage;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 히어로 헤더 */}
      <div className="relative overflow-hidden"
        style={bgImage
          ? { backgroundImage: `url(${bgImage})`, backgroundSize: "cover", backgroundPosition: "center" }
          : { background: `linear-gradient(135deg, ${primaryColor}dd, ${primaryColor})` }
        }>
        {bgImage && <div className="absolute inset-0 bg-black/40" />}
        <div className="relative max-w-sm mx-auto px-6 pt-16 pb-12 text-center">
          <div className="w-24 h-24 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-4 border-4 border-white shadow-lg">
            <span className="text-3xl font-bold text-white">{trainer.trainerName?.[0]}</span>
          </div>
          <h1 className="text-2xl font-bold text-white mb-1">{trainer.trainerName}</h1>
          <p className="text-white/80 text-sm mb-2">
            {JOB_LABELS[trainer.jobType] || trainer.jobType}
            {trainer.careerRange && ` · ${CAREER_LABELS[trainer.careerRange] || trainer.careerRange}`}
          </p>
          {trainer.activityArea && (
            <p className="text-white/60 text-xs">{trainer.activityArea}</p>
          )}
          {/* SNS 아이콘 (헤더에도 표시) */}
          {(() => {
            const snsBlock = visibleBlocks.find(b => b.type === "sns");
            const snsData = snsBlock?.data ?? {};
            const links = [
              { href: snsData.instagram, icon: Instagram },
              { href: snsData.kakao, icon: MessageCircle },
              { href: snsData.youtube, icon: Youtube },
            ].filter(l => l.href);
            if (links.length === 0) return null;
            return (
              <div className="flex items-center justify-center gap-3 mt-4">
                {links.map(({ href, icon: Icon }, i) => (
                  <a key={i} href={href} target="_blank" rel="noreferrer"
                    className="w-9 h-9 bg-white/20 rounded-full flex items-center justify-center hover:bg-white/30 transition-colors">
                    <Icon className="h-4 w-4 text-white" />
                  </a>
                ))}
              </div>
            );
          })()}
        </div>
      </div>

      <div className="max-w-sm mx-auto px-4 py-6 space-y-4">
        {/* 상담 예약 CTA (booking 블록 있을 때 상단에도 배치) */}
        {bookingBlock && (
          <button onClick={() => setShowBooking(true)}
            className="w-full py-4 rounded-2xl text-white font-bold text-base shadow-md active:opacity-90 transition-opacity flex items-center justify-center gap-2"
            style={{ backgroundColor: primaryColor }}>
            <Calendar className="h-5 w-5" />
            상담 예약하기
            <ChevronRight className="h-5 w-5" />
          </button>
        )}

        {/* 블록 렌더링 (intro는 bio가 있을 때만, booking은 CTA로 이미 표시) */}
        {visibleBlocks.filter(b => b.type !== "booking").map(block => renderBlock(block))}

        <p className="text-center text-xs text-gray-400 pt-2">
          Powered by <a href="/" className="font-semibold text-gray-500">FIT STEP</a>
        </p>
      </div>

      {/* 예약 폼 오버레이 */}
      {showBooking && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end justify-center">
          <div className="bg-white w-full max-w-sm rounded-t-3xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            {submitted ? (
              <div className="py-8 text-center space-y-3">
                <CheckCircle className="h-12 w-12 mx-auto" style={{ color: primaryColor }} />
                <p className="text-lg font-bold text-gray-800">예약 신청 완료!</p>
                <p className="text-sm text-gray-500">{trainer.trainerName} 트레이너가 곧 연락드립니다.</p>
                <button onClick={() => { setShowBooking(false); setSubmitted(false); setForm({ name: "", phone: "", interestType: "", message: "" }); }}
                  className="w-full py-3 rounded-xl text-white font-medium" style={{ backgroundColor: primaryColor }}>닫기</button>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-gray-800">상담 예약</h3>
                  <button onClick={() => setShowBooking(false)} className="text-gray-400 p-1">
                    <ArrowLeft className="h-5 w-5" />
                  </button>
                </div>
                {bookingBlock?.data?.message && (
                  <p className="text-sm text-gray-500 bg-gray-50 rounded-xl p-3">{bookingBlock.data.message}</p>
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
                <button disabled={!form.name || !form.phone || submitMutation.isPending}
                  onClick={() => submitMutation.mutate({ trainerId: trainer.trainerId, ...form })}
                  className="w-full py-3.5 rounded-xl text-white font-bold disabled:opacity-50"
                  style={{ backgroundColor: primaryColor }}>
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
