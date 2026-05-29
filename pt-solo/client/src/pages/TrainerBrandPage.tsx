import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Instagram, Youtube, MessageCircle, Calendar, ChevronRight, ArrowLeft, CheckCircle, Award, Dumbbell, PlaySquare, ChevronDown, Star, GraduationCap, Trophy } from "lucide-react";

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
const CAREER_CAT_META: Record<string, { label: string; color: string; dot: string }> = {
  cert:   { label: "자격증", color: "text-blue-600",   dot: "bg-blue-500" },
  career: { label: "경력",   color: "text-emerald-600", dot: "bg-emerald-500" },
  edu:    { label: "학력",   color: "text-violet-600",  dot: "bg-violet-500" },
  award:  { label: "수상",   color: "text-amber-600",   dot: "bg-amber-500" },
};

interface BrandBlock { id: string; type: string; visible: boolean; data: any; }
interface Props { username: string; }

export default function TrainerBrandPage({ username }: Props) {
  const { data: trainer, isLoading, error } = trpc.brand.getPublicProfile.useQuery({ username });
  const [showBooking, setShowBooking] = useState(false);
  const [showAllCareer, setShowAllCareer] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", interestType: "", message: "" });
  const [submitted, setSubmitted] = useState(false);

  const submitMutation = trpc.brand.submitBooking.useMutation({ onSuccess: () => setSubmitted(true) });

  if (isLoading) return (
    <div className="min-h-screen bg-[#f5f5f7] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (error || !trainer) return (
    <div className="min-h-screen bg-[#f5f5f7] flex flex-col items-center justify-center gap-3 p-6">
      <p className="text-gray-500 text-sm">페이지를 찾을 수 없습니다.</p>
      <a href="/" className="text-blue-500 text-sm underline">핏스텝 홈으로</a>
    </div>
  );

  let blocks: BrandBlock[] = [];
  if (trainer.brandBlocks) {
    try { blocks = JSON.parse(trainer.brandBlocks); } catch { blocks = []; }
  }
  if (blocks.length === 0) {
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
  const bgImage: string | undefined = introBlock?.data?.bgImage;
  const trainerTitle: string = introBlock?.data?.title || JOB_LABELS[trainer.jobType] || "";
  const tagline: string = introBlock?.data?.tagline || introBlock?.data?.bio || "";

  // ── 블록 렌더러 ──────────────────────────────────────────────────────────────
  function renderBlock(block: BrandBlock) {
    const d = block.data;

    // 소개 블록 — bio는 tagline으로 hero에 표시하므로 여기선 생략
    if (block.type === "intro") return null;

    if (block.type === "specialties") {
      const items: string[] = (d.items ?? []).slice(0, 5);
      if (items.length === 0) return null;
      return (
        <section key={block.id} className="bg-white rounded-3xl p-6 shadow-sm">
          <h2 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-4">전문 분야</h2>
          <div className="flex flex-wrap gap-2">
            {items.map((s, i) => (
              <span key={i}
                className="px-4 py-2 rounded-full text-sm font-semibold border"
                style={{ borderColor: primaryColor, color: primaryColor, backgroundColor: `${primaryColor}0f` }}>
                {s}
              </span>
            ))}
          </div>
        </section>
      );
    }

    if (block.type === "career") {
      const items: { text: string; category: string }[] = d.items ?? [];
      if (items.length === 0) return null;

      const DISPLAY_LIMIT = 4;
      const displayed = showAllCareer ? items : items.slice(0, DISPLAY_LIMIT);
      const hasMore = items.length > DISPLAY_LIMIT;

      return (
        <section key={block.id} className="bg-white rounded-3xl p-6 shadow-sm">
          <h2 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-5 flex items-center gap-1.5">
            <Award className="h-3.5 w-3.5" /> 경력 · 자격증
          </h2>
          <div className="space-y-0">
            {displayed.map((item, i) => {
              const meta = CAREER_CAT_META[item.category] ?? { label: item.category, color: "text-gray-500", dot: "bg-gray-400" };
              const isLast = i === displayed.length - 1;
              return (
                <div key={i} className="flex gap-4">
                  <div className="flex flex-col items-center pt-1">
                    <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${meta.dot}`} />
                    {!isLast && <div className="w-px flex-1 bg-gray-100 mt-1.5 mb-0" />}
                  </div>
                  <div className={`${isLast ? "pb-0" : "pb-5"}`}>
                    <span className={`text-[10px] font-bold uppercase tracking-wide ${meta.color}`}>{meta.label}</span>
                    <p className="text-sm text-gray-800 mt-0.5 leading-snug">{item.text}</p>
                  </div>
                </div>
              );
            })}
          </div>
          {hasMore && (
            <button
              onClick={() => setShowAllCareer(v => !v)}
              className="mt-4 flex items-center gap-1 text-xs font-semibold text-gray-400 hover:text-gray-600 transition-colors">
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showAllCareer ? "rotate-180" : ""}`} />
              {showAllCareer ? "접기" : `${items.length - DISPLAY_LIMIT}개 더 보기`}
            </button>
          )}
        </section>
      );
    }

    if (block.type === "programs") {
      const items: { name: string; desc: string }[] = d.items ?? [];
      if (items.length === 0) return null;
      return (
        <section key={block.id} className="bg-white rounded-3xl p-6 shadow-sm">
          <h2 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-1.5">
            <Dumbbell className="h-3.5 w-3.5" /> 프로그램 소개
          </h2>
          <div className="space-y-3">
            {items.map((item, i) => (
              <div key={i} className="border border-gray-100 rounded-2xl p-4 hover:border-gray-200 transition-colors">
                <p className="font-bold text-sm text-gray-900">{item.name}</p>
                {item.desc && <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">{item.desc}</p>}
                {bookingBlock && (
                  <button onClick={() => setShowBooking(true)}
                    className="mt-3 text-xs font-semibold px-3 py-1.5 rounded-full transition-colors"
                    style={{ color: primaryColor, backgroundColor: `${primaryColor}14` }}>
                    상담 문의 →
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      );
    }

    if (block.type === "sns") {
      const links = [
        { key: "instagram", icon: Instagram, label: "Instagram", href: d.instagram, bg: "bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400" },
        { key: "youtube",   icon: Youtube,   label: "YouTube",   href: d.youtube,   bg: "bg-red-500" },
        { key: "kakao",     icon: MessageCircle, label: "KakaoTalk", href: d.kakao, bg: "bg-yellow-400" },
      ].filter(l => l.href);
      if (links.length === 0) return null;
      return (
        <section key={block.id} className="bg-white rounded-3xl p-6 shadow-sm">
          <h2 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-4">SNS</h2>
          <div className="flex gap-3">
            {links.map(({ key, icon: Icon, label, href, bg }) => (
              <a key={key} href={href} target="_blank" rel="noreferrer"
                className={`w-12 h-12 rounded-2xl flex items-center justify-center ${bg} shadow-sm hover:opacity-90 transition-opacity`}>
                <Icon className="h-5 w-5 text-white" />
              </a>
            ))}
          </div>
        </section>
      );
    }

    if (block.type === "video" && d.youtubeUrl) {
      const videoId = d.youtubeUrl.match(/(?:v=|youtu\.be\/)([^&\s]+)/)?.[1];
      return (
        <section key={block.id} className="bg-white rounded-3xl overflow-hidden shadow-sm">
          {videoId ? (
            <iframe src={`https://www.youtube.com/embed/${videoId}`} className="w-full aspect-video" allowFullScreen title="운동 영상" />
          ) : (
            <a href={d.youtubeUrl} target="_blank" rel="noreferrer" className="flex items-center gap-3 p-5">
              <PlaySquare className="h-5 w-5 text-red-500" />
              <span className="text-sm text-gray-700">운동 영상 보기</span>
            </a>
          )}
          {d.description && <div className="px-5 py-3 border-t border-gray-100"><p className="text-xs text-gray-500">{d.description}</p></div>}
        </section>
      );
    }

    return null;
  }

  // ── 메인 렌더 ────────────────────────────────────────────────────────────────
  const heroOverlay = bgImage
    ? "linear-gradient(to right, rgba(0,0,0,0.78) 0%, rgba(0,0,0,0.55) 55%, rgba(0,0,0,0.2) 100%)"
    : `linear-gradient(135deg, ${primaryColor}f0 0%, ${primaryColor}cc 100%)`;

  return (
    <div className="min-h-screen bg-[#f5f5f7]">

      {/* ── Hero ── */}
      <section
        className="relative overflow-hidden"
        style={{
          minHeight: "52vh",
          ...(bgImage
            ? { backgroundImage: `url(${bgImage})`, backgroundSize: "cover", backgroundPosition: "center right" }
            : { background: `${primaryColor}` }),
        }}>
        <div className="absolute inset-0" style={{ background: heroOverlay }} />
        <div className="relative max-w-lg mx-auto px-6 pt-14 pb-10 flex flex-col justify-end h-full" style={{ minHeight: "52vh" }}>
          {trainerTitle && (
            <p className="text-white/70 text-xs font-semibold tracking-widest uppercase mb-2">{trainerTitle}</p>
          )}
          <h1 className="text-3xl font-bold text-white tracking-tight leading-tight">{trainer.trainerName}</h1>
          {tagline && (
            <p className="text-white/80 text-sm mt-2 leading-relaxed max-w-xs">{tagline}</p>
          )}
          {(trainer.jobType || trainer.activityArea) && !trainerTitle && (
            <p className="text-white/60 text-xs mt-1">
              {JOB_LABELS[trainer.jobType] || trainer.jobType}
              {trainer.activityArea && ` · ${trainer.activityArea}`}
            </p>
          )}
          {bookingBlock && (
            <button onClick={() => setShowBooking(true)}
              className="mt-5 self-start flex items-center gap-2 px-5 py-3 rounded-2xl font-bold text-sm shadow-lg active:scale-95 transition-all"
              style={{ backgroundColor: "white", color: primaryColor }}>
              <Calendar className="h-4 w-4" />
              상담 예약하기
              <ChevronRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </section>

      {/* ── 콘텐츠 ── */}
      <div className="max-w-lg mx-auto px-4 py-5 space-y-3 pb-32">
        {visibleBlocks.filter(b => b.type !== "booking").map(block => renderBlock(block))}
        <p className="text-center text-xs text-gray-400 pt-4">
          Powered by <a href="/" className="font-semibold text-gray-500">FIT STEP</a>
        </p>
      </div>

      {/* ── 하단 고정 CTA ── */}
      {bookingBlock && (
        <div className="fixed bottom-0 left-0 right-0 z-30 px-4 pb-6 pt-3"
          style={{ background: "linear-gradient(to top, #f5f5f7 70%, transparent)" }}>
          <button onClick={() => setShowBooking(true)}
            className="w-full max-w-lg mx-auto flex items-center justify-center gap-2 py-4 rounded-2xl font-bold text-base text-white shadow-xl active:scale-[0.98] transition-all"
            style={{ backgroundColor: primaryColor, display: "flex" }}>
            <Calendar className="h-5 w-5" />
            상담 예약하기
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      )}

      {/* ── 예약 폼 모달 ── */}
      {showBooking && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end justify-center">
          <div className="bg-white w-full max-w-lg rounded-t-3xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            {submitted ? (
              <div className="py-10 text-center space-y-3">
                <CheckCircle className="h-14 w-14 mx-auto" style={{ color: primaryColor }} />
                <p className="text-lg font-bold text-gray-900">예약 신청 완료!</p>
                <p className="text-sm text-gray-500">{trainer.trainerName} 트레이너가 곧 연락드립니다.</p>
                <button onClick={() => { setShowBooking(false); setSubmitted(false); setForm({ name: "", phone: "", interestType: "", message: "" }); }}
                  className="w-full py-3 rounded-2xl text-white font-semibold text-sm" style={{ backgroundColor: primaryColor }}>닫기</button>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between pb-1">
                  <h3 className="text-base font-bold text-gray-900">상담 예약</h3>
                  <button onClick={() => setShowBooking(false)} className="text-gray-400 hover:text-gray-600 p-1 transition-colors">
                    <ArrowLeft className="h-5 w-5" />
                  </button>
                </div>
                {bookingBlock?.data?.message && (
                  <p className="text-sm text-gray-500 bg-gray-50 rounded-2xl p-4 leading-relaxed">{bookingBlock.data.message}</p>
                )}
                <div className="space-y-3">
                  {[
                    { label: "이름 *", key: "name", placeholder: "홍길동", type: "text" },
                    { label: "연락처 *", key: "phone", placeholder: "010-0000-0000", type: "tel" },
                  ].map(({ label, key, placeholder, type }) => (
                    <div key={key}>
                      <label className="text-xs text-gray-500 font-semibold">{label}</label>
                      <input type={type} value={(form as any)[key]}
                        onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
                        placeholder={placeholder}
                        className="w-full mt-1.5 border border-gray-200 rounded-2xl px-4 py-3 text-sm outline-none focus:border-blue-400 transition-colors" />
                    </div>
                  ))}
                  <div>
                    <label className="text-xs text-gray-500 font-semibold">관심 프로그램</label>
                    <select value={form.interestType} onChange={e => setForm(p => ({ ...p, interestType: e.target.value }))}
                      className="w-full mt-1.5 border border-gray-200 rounded-2xl px-4 py-3 text-sm outline-none focus:border-blue-400 bg-white transition-colors">
                      <option value="">선택</option>
                      <option value="PT">PT (퍼스널 트레이닝)</option>
                      <option value="필라테스">필라테스</option>
                      <option value="기타">기타</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 font-semibold">남기실 말씀</label>
                    <textarea value={form.message} onChange={e => setForm(p => ({ ...p, message: e.target.value }))}
                      placeholder="문의 내용이나 희망 시간대를 적어주세요..." rows={3}
                      className="w-full mt-1.5 border border-gray-200 rounded-2xl px-4 py-3 text-sm outline-none focus:border-blue-400 resize-none transition-colors" />
                  </div>
                </div>
                <button disabled={!form.name || !form.phone || submitMutation.isPending}
                  onClick={() => submitMutation.mutate({ trainerId: trainer.trainerId, ...form })}
                  className="w-full py-4 rounded-2xl text-white font-bold text-sm disabled:opacity-40 transition-opacity"
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
