import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Instagram, Youtube, MessageCircle, Calendar, ChevronRight, ArrowLeft, CheckCircle, Award, Dumbbell, PlaySquare, ChevronDown, Star, GraduationCap, Trophy, ChevronLeft, Check, Clock, X } from "lucide-react";

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
const CAREER_CAT_META: Record<string, { label: string }> = {
  cert:   { label: "자격증" },
  career: { label: "경력"   },
  edu:    { label: "학력"   },
  award:  { label: "수상"   },
};

interface BrandBlock { id: string; type: string; visible: boolean; data: any; }
interface Props { username: string; }

// ── 간편 예약 폼 (슬롯 미설정 시 폴백) ──────────────────────────────────────
function SimpleBookingForm({ bookingBlock, primaryColor, form, setForm, isPending, onSubmit }: {
  bookingBlock: any; primaryColor: string;
  form: { name: string; phone: string; interestType: string; message: string };
  setForm: (f: any) => void; isPending: boolean; onSubmit: () => void;
}) {
  const programs: string[] = bookingBlock?.data?.programs ?? ["PT (퍼스널 트레이닝)", "필라테스", "기타"];
  return (
    <div className="space-y-4">
      {programs.length > 0 && (
        <div className="space-y-2">
          <label className="text-xs font-semibold text-gray-500">관심 프로그램</label>
          <div className="flex flex-wrap gap-2">
            {programs.map((p: string) => (
              <button key={p} type="button"
                onClick={() => setForm((f: any) => ({ ...f, interestType: f.interestType === p ? "" : p }))}
                className="px-4 py-2 rounded-full text-sm font-semibold border-2 transition-all"
                style={form.interestType === p
                  ? { backgroundColor: primaryColor, borderColor: primaryColor, color: "white" }
                  : { borderColor: `${primaryColor}40`, color: "#555" }}>
                {p}
              </button>
            ))}
          </div>
        </div>
      )}
      {[
        { label: "이름 *", key: "name", placeholder: "홍길동", type: "text" },
        { label: "연락처 *", key: "phone", placeholder: "010-0000-0000", type: "tel" },
      ].map(({ label, key, placeholder, type }) => (
        <div key={key}>
          <label className="text-xs text-gray-500 font-semibold">{label}</label>
          <input type={type} value={(form as any)[key]}
            onChange={e => setForm((p: any) => ({ ...p, [key]: e.target.value }))}
            placeholder={placeholder}
            className="w-full mt-1.5 border border-gray-200 rounded-2xl px-4 py-3 text-sm outline-none focus:border-blue-400 transition-colors" />
        </div>
      ))}
      <div>
        <label className="text-xs text-gray-500 font-semibold">남기실 말씀</label>
        <textarea value={form.message} onChange={e => setForm((p: any) => ({ ...p, message: e.target.value }))}
          placeholder="궁금한 점을 남겨주세요..." rows={2}
          className="w-full mt-1.5 border border-gray-200 rounded-2xl px-4 py-3 text-sm outline-none focus:border-blue-400 resize-none transition-colors" />
      </div>
      <button disabled={!form.name || !form.phone || isPending} onClick={onSubmit}
        className="w-full py-4 rounded-2xl text-white font-bold text-sm disabled:opacity-40 transition-opacity"
        style={{ backgroundColor: primaryColor }}>
        {isPending ? "신청 중..." : "예약 신청"}
      </button>
    </div>
  );
}

// ── 월 캘린더 컴포넌트 ──────────────────────────────────────────────────────
function BookingCalendar({ trainerId, primaryColor, onSelect }: {
  trainerId: number; primaryColor: string; onSelect: (date: string) => void;
}) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const monthStr = `${year}-${String(month).padStart(2, "0")}`;
  const { data: availableDates = [] } = trpc.booking.getAvailableDates.useQuery({ trainerId, month: monthStr });
  const availableSet = new Set(availableDates.map((d: any) => d.date));

  const firstDay = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const todayStr = today.toISOString().slice(0, 10);

  function prevMonth() { if (month === 1) { setMonth(12); setYear(y => y - 1); } else setMonth(m => m - 1); }
  function nextMonth() { if (month === 12) { setMonth(1); setYear(y => y + 1); } else setMonth(m => m + 1); }

  const canGoPrev = year > today.getFullYear() || (year === today.getFullYear() && month > today.getMonth() + 1);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <button onClick={prevMonth} disabled={!canGoPrev} className="p-2 rounded-full hover:bg-gray-100 disabled:opacity-30">
          <ChevronLeft className="h-5 w-5 text-gray-600" />
        </button>
        <p className="font-bold text-gray-900">{year}년 {month}월</p>
        <button onClick={nextMonth} className="p-2 rounded-full hover:bg-gray-100">
          <ChevronRight className="h-5 w-5 text-gray-600" />
        </button>
      </div>
      <div className="grid grid-cols-7 text-center">
        {["일", "월", "화", "수", "목", "금", "토"].map(d => (
          <p key={d} className="text-[11px] font-semibold text-gray-400 py-1">{d}</p>
        ))}
        {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`} />)}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const dateStr = `${monthStr}-${String(day).padStart(2, "0")}`;
          const isPast = dateStr < todayStr;
          const hasSlot = availableSet.has(dateStr);
          return (
            <button key={day} disabled={isPast || !hasSlot}
              onClick={() => onSelect(dateStr)}
              className={`relative flex flex-col items-center justify-center py-2 rounded-xl transition-colors
                ${isPast ? "opacity-25 cursor-not-allowed" : hasSlot ? "hover:bg-gray-100 cursor-pointer" : "opacity-40 cursor-not-allowed"}`}>
              <span className={`text-sm font-semibold ${dateStr === todayStr ? "text-blue-500" : "text-gray-800"}`}>{day}</span>
              {hasSlot && !isPast && (
                <span className="w-1.5 h-1.5 rounded-full mt-0.5" style={{ backgroundColor: primaryColor }} />
              )}
            </button>
          );
        })}
      </div>
      <p className="text-center text-[10px] text-gray-400">• 예약 가능한 날짜</p>
    </div>
  );
}

// ── 시간 선택 컴포넌트 ──────────────────────────────────────────────────────
function TimeSlotPicker({ trainerId, date, primaryColor, onSelect }: {
  trainerId: number; date: string; primaryColor: string; onSelect: (slot: { id: number; time: string }) => void;
}) {
  const { data: slots = [] } = trpc.booking.getAvailableSlots.useQuery({ trainerId, date });
  const groups = [
    { label: "오전", slots: slots.filter((s: any) => s.time < "12:00") },
    { label: "오후", slots: slots.filter((s: any) => s.time >= "12:00" && s.time < "18:00") },
    { label: "저녁", slots: slots.filter((s: any) => s.time >= "18:00") },
  ].filter(g => g.slots.length > 0);

  const [selected, setSelected] = useState<number | null>(null);

  if (slots.length === 0) return (
    <div className="py-8 text-center text-sm text-gray-400">이 날짜에 예약 가능한 시간이 없습니다.</div>
  );

  return (
    <div className="space-y-4">
      {groups.map(g => (
        <div key={g.label}>
          <p className="text-xs font-semibold text-gray-400 mb-2">{g.label}</p>
          <div className="grid grid-cols-3 gap-2">
            {g.slots.map((slot: any) => {
              const booked = slot.isBooked === 1 || slot.isBooked === true;
              const sel = selected === slot.id;
              return (
                <button key={slot.id} disabled={booked}
                  onClick={() => { setSelected(slot.id); onSelect({ id: slot.id, time: slot.time }); }}
                  className={`relative py-3 rounded-xl text-sm font-semibold border-2 transition-all
                    ${booked ? "bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed" :
                      sel ? "text-white border-transparent" :
                      "bg-white border-gray-200 text-gray-800 hover:border-opacity-100"}`}
                  style={sel ? { backgroundColor: primaryColor, borderColor: primaryColor } :
                         !booked ? { borderColor: `${primaryColor}50` } : {}}>
                  {sel && <Check className="h-3 w-3 absolute top-1 right-1" />}
                  {slot.time}
                  {booked && <span className="block text-[9px] text-gray-400 font-normal">마감</span>}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── 인라인 달력 (날짜 선택 상태 부모 관리) ─────────────────────────────────
function InlineBookingCalendar({ trainerId, primaryColor, selectedDate, onSelect }: {
  trainerId: number; primaryColor: string; selectedDate: string; onSelect: (date: string) => void;
}) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const monthStr = `${year}-${String(month).padStart(2, "0")}`;
  const { data: availableDates = [] } = trpc.booking.getAvailableDates.useQuery({ trainerId, month: monthStr });
  const availableSet = new Set(availableDates.map((d: any) => d.date));

  const firstDay = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const todayStr = today.toISOString().slice(0, 10);

  function prevMonth() { if (month === 1) { setMonth(12); setYear(y => y - 1); } else setMonth(m => m - 1); }
  function nextMonth() { if (month === 12) { setMonth(1); setYear(y => y + 1); } else setMonth(m => m + 1); }
  const canGoPrev = year > today.getFullYear() || (year === today.getFullYear() && month > today.getMonth() + 1);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-1">
        <button onClick={prevMonth} disabled={!canGoPrev} className="p-2 rounded-full hover:bg-gray-100 disabled:opacity-30 transition-colors">
          <ChevronLeft className="h-5 w-5 text-gray-600" />
        </button>
        <p className="font-bold text-gray-900 text-sm">{year}년 {month}월</p>
        <button onClick={nextMonth} className="p-2 rounded-full hover:bg-gray-100 transition-colors">
          <ChevronRight className="h-5 w-5 text-gray-600" />
        </button>
      </div>
      <div className="grid grid-cols-7 text-center">
        {["일", "월", "화", "수", "목", "금", "토"].map(d => (
          <p key={d} className="text-[11px] font-semibold text-gray-400 py-1">{d}</p>
        ))}
        {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`} />)}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const dateStr = `${monthStr}-${String(day).padStart(2, "0")}`;
          const isPast = dateStr < todayStr;
          const hasSlot = availableSet.has(dateStr);
          const isSelected = dateStr === selectedDate;
          return (
            <button key={day} disabled={isPast || !hasSlot}
              onClick={() => onSelect(dateStr)}
              className={`relative flex flex-col items-center justify-center py-1.5 rounded-xl transition-all
                ${isPast ? "opacity-25 cursor-not-allowed" : hasSlot ? "cursor-pointer" : "opacity-30 cursor-not-allowed"}`}>
              <span className={`w-8 h-8 flex items-center justify-center rounded-full text-sm font-semibold transition-all
                ${isSelected ? "text-white" : dateStr === todayStr ? "text-blue-500" : "text-gray-800"}
                ${isSelected ? "" : hasSlot && !isPast ? "hover:bg-gray-100" : ""}`}
                style={isSelected ? { backgroundColor: primaryColor } : {}}>
                {day}
              </span>
              {hasSlot && !isPast && !isSelected && (
                <span className="w-1 h-1 rounded-full mt-0.5" style={{ backgroundColor: primaryColor }} />
              )}
              {isSelected && <span className="w-1 h-1 rounded-full mt-0.5 opacity-0" />}
            </button>
          );
        })}
      </div>
      <p className="text-center text-[10px] text-gray-400 pt-1">• 예약 가능한 날짜</p>
    </div>
  );
}

// ── 인라인 시간 선택 (선택 상태 부모 관리) ──────────────────────────────────
function InlineTimeSlotPicker({ trainerId, date, primaryColor, selectedSlotId, onSelect }: {
  trainerId: number; date: string; primaryColor: string;
  selectedSlotId: number | null; onSelect: (slot: { id: number; time: string }) => void;
}) {
  const { data: slots = [], isLoading } = trpc.booking.getAvailableSlots.useQuery({ trainerId, date });
  const groups = [
    { label: "오전", slots: slots.filter((s: any) => s.time < "12:00") },
    { label: "오후", slots: slots.filter((s: any) => s.time >= "12:00" && s.time < "18:00") },
    { label: "저녁", slots: slots.filter((s: any) => s.time >= "18:00") },
  ].filter(g => g.slots.length > 0);

  if (isLoading) return <div className="py-6 text-center text-sm text-gray-400 animate-pulse">시간 불러오는 중...</div>;
  if (slots.length === 0) return (
    <div className="py-6 text-center text-sm text-gray-400">이 날짜에 예약 가능한 시간이 없습니다.</div>
  );

  return (
    <div className="space-y-4">
      {groups.map(g => (
        <div key={g.label}>
          <p className="text-xs font-semibold text-gray-400 mb-2">{g.label}</p>
          <div className="grid grid-cols-4 gap-2">
            {g.slots.map((slot: any) => {
              const booked = slot.isBooked === 1 || slot.isBooked === true;
              const sel = selectedSlotId === slot.id;
              return (
                <button key={slot.id} disabled={booked}
                  onClick={() => onSelect({ id: slot.id, time: slot.time })}
                  className={`relative py-2.5 rounded-xl text-xs font-semibold border-2 transition-all
                    ${booked ? "bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed" :
                      sel ? "text-white border-transparent" :
                      "bg-white text-gray-800 hover:bg-gray-50"}`}
                  style={sel ? { backgroundColor: primaryColor, borderColor: primaryColor } :
                         !booked ? { borderColor: `${primaryColor}50` } : {}}>
                  {sel && <Check className="h-3 w-3 absolute top-1 right-1" />}
                  {slot.time}
                  {booked && <span className="block text-[9px] text-gray-400 font-normal">마감</span>}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function TrainerBrandPage({ username }: Props) {
  const { data: trainer, isLoading, error } = trpc.brand.getPublicProfile.useQuery({ username });
  const [showBooking, setShowBooking] = useState(false);
  const [showAllCareer, setShowAllCareer] = useState(false);
  // 3단계 예약 상태
  const [bookingStep, setBookingStep] = useState(0); // 0=날짜 1=시간 2=확인
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedSlot, setSelectedSlot] = useState<{ id: number; time: string } | null>(null);
  const [form, setForm] = useState({ name: "", phone: "", interestType: "", message: "" });
  const [submitted, setSubmitted] = useState(false);

  // 슬롯 존재 여부 확인 (현재 월)
  const today = new Date();
  const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  const nextMonthDate = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  const nextMonth = `${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth() + 1).padStart(2, "0")}`;

  const { data: availableDatesCheck, isLoading: slotsLoading } = trpc.booking.getAvailableDates.useQuery(
    { trainerId: trainer?.trainerId ?? 0, month: currentMonth },
    { enabled: !!trainer?.trainerId }
  );
  const { data: nextMonthDatesCheck, isLoading: nextSlotsLoading } = trpc.booking.getAvailableDates.useQuery(
    { trainerId: trainer?.trainerId ?? 0, month: nextMonth },
    { enabled: !!trainer?.trainerId }
  );
  // 현재 월 + 다음 월 모두 슬롯이 없을 때만 간편 폼
  const simpleMode = !slotsLoading && !nextSlotsLoading &&
    (availableDatesCheck?.length ?? 0) === 0 &&
    (nextMonthDatesCheck?.length ?? 0) === 0;

  const submitWithSlotMutation = trpc.booking.submitWithSlot.useMutation({ onSuccess: () => setSubmitted(true) });
  const submitMutation = trpc.brand.submitBooking.useMutation({ onSuccess: () => setSubmitted(true) });

  function resetBooking() {
    setBookingStep(0); setSelectedDate(""); setSelectedSlot(null);
    setForm({ name: "", phone: "", interestType: "", message: "" });
    setSubmitted(false);
  }

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
  const profileImage: string | undefined = introBlock?.data?.profileImage;
  const trainerTitle: string = introBlock?.data?.title || JOB_LABELS[trainer.jobType] || "";
  const tagline: string = introBlock?.data?.tagline || introBlock?.data?.bio || "";

  // ── 블록 렌더러 ──────────────────────────────────────────────────────────────
  function renderBlock(block: BrandBlock) {
    const d = block.data;

    // 소개 블록 — bio는 tagline으로 hero에 표시하므로 여기선 생략
    if (block.type === "intro") return null;

    if (block.type === "specialties") {
      const items: string[] = (d.items ?? []).slice(0, 5);
      const targetItems: string[] = d.targetItems ?? [];
      if (items.length === 0 && targetItems.length === 0) return null;
      return (
        <section key={block.id} className="bg-white rounded-3xl p-6 shadow-sm space-y-5">
          {items.length > 0 && (
            <div>
              <h2 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3">전문 분야</h2>
              <div className="flex flex-wrap gap-2">
                {items.map((s, i) => (
                  <span key={i}
                    className="px-4 py-2 rounded-full text-sm font-semibold border"
                    style={{ borderColor: primaryColor, color: primaryColor, backgroundColor: `${primaryColor}0f` }}>
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}
          {targetItems.length > 0 && (
            <div>
              <h2 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3">이런 분께 추천</h2>
              <div className="flex flex-wrap gap-2">
                {targetItems.map((s, i) => (
                  <span key={i} className="px-3 py-1.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}
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
              const meta = CAREER_CAT_META[item.category] ?? { label: item.category };
              const isLast = i === displayed.length - 1;
              return (
                <div key={i} className="flex gap-4">
                  <div className="flex flex-col items-center pt-1">
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: primaryColor }} />
                    {!isLast && <div className="w-px flex-1 bg-gray-100 mt-1.5 mb-0" />}
                  </div>
                  <div className={`${isLast ? "pb-0" : "pb-5"}`}>
                    <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: primaryColor }}>{meta.label}</span>
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
          {profileImage && (
            <img src={profileImage} alt={trainer.trainerName}
              className="w-16 h-16 rounded-full object-cover border-3 border-white/80 shadow-lg mb-3"
              style={{ border: "3px solid rgba(255,255,255,0.8)" }} />
          )}
          {trainerTitle && (
            <p className="text-white/70 text-xs font-semibold tracking-widest uppercase mb-1.5">{trainerTitle}</p>
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
          <button onClick={() => { setShowBooking(true); setBookingStep(0); }}
            className="w-full max-w-lg mx-auto flex items-center justify-center gap-2 py-4 rounded-2xl font-bold text-base text-white shadow-xl active:scale-[0.98] transition-all"
            style={{ backgroundColor: primaryColor, display: "flex" }}>
            <Calendar className="h-5 w-5" />
            {bookingBlock?.data?.buttonText || "상담 예약하기"}
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      )}

      {/* ── 예약 모달 (네이버 스타일 단일 스크롤) ── */}
      {showBooking && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end justify-center">
          <div className="bg-white w-full max-w-lg rounded-t-3xl max-h-[94vh] overflow-y-auto">
            {/* 헤더 */}
            <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-4 flex items-center justify-between z-10">
              <button onClick={() => { setShowBooking(false); resetBooking(); }}
                className="p-1.5 rounded-full hover:bg-gray-100 transition-colors">
                <X className="h-5 w-5 text-gray-500" />
              </button>
              <p className="font-bold text-gray-900 text-sm">{bookingBlock?.data?.buttonText || "상담 예약하기"}</p>
              <div className="w-8" />
            </div>

            <div className="px-5 pb-10 space-y-6 pt-5">
              {submitted ? (
                /* ── 완료 화면 ── */
                <div className="py-10 text-center space-y-4">
                  <div className="w-16 h-16 rounded-full mx-auto flex items-center justify-center" style={{ backgroundColor: `${primaryColor}20` }}>
                    <CheckCircle className="h-8 w-8" style={{ color: primaryColor }} />
                  </div>
                  <div>
                    <p className="text-lg font-bold text-gray-900">예약 완료!</p>
                    <p className="text-sm text-gray-500 mt-1">{trainer.trainerName} 트레이너가 곧 연락드립니다.</p>
                  </div>
                  {selectedDate && selectedSlot && (
                    <div className="bg-gray-50 rounded-2xl p-4 text-sm space-y-1">
                      <p className="text-gray-600">📅 {selectedDate}</p>
                      <p className="text-gray-600">🕐 {selectedSlot.time}</p>
                      {form.interestType && <p className="text-gray-600">📋 {form.interestType}</p>}
                    </div>
                  )}
                  <button onClick={() => { setShowBooking(false); resetBooking(); }}
                    className="w-full py-3.5 rounded-2xl text-white font-semibold text-sm" style={{ backgroundColor: primaryColor }}>
                    닫기
                  </button>
                </div>
              ) : simpleMode ? (
                /* ── 간편 폼 (슬롯 없을 때) ── */
                <>
                  {bookingBlock?.data?.guideText && (
                    <p className="text-xs text-gray-500 bg-gray-50 rounded-2xl px-4 py-3 leading-relaxed">{bookingBlock.data.guideText}</p>
                  )}
                  <SimpleBookingForm
                    bookingBlock={bookingBlock} primaryColor={primaryColor}
                    form={form} setForm={setForm}
                    isPending={submitMutation.isPending}
                    onSubmit={() => submitMutation.mutate({
                      trainerId: trainer.trainerId,
                      name: form.name, phone: form.phone,
                      interestType: form.interestType || undefined,
                      message: form.message || undefined,
                    })}
                  />
                </>
              ) : (
                /* ── 달력 + 시간 + 폼 단일 스크롤 ── */
                <>
                  {bookingBlock?.data?.guideText && (
                    <p className="text-xs text-gray-500 bg-gray-50 rounded-2xl px-4 py-3 leading-relaxed">{bookingBlock.data.guideText}</p>
                  )}

                  {/* 1. 달력 */}
                  <div>
                    <p className="text-sm font-bold text-gray-800 mb-3">날짜를 선택해 주세요</p>
                    <InlineBookingCalendar
                      trainerId={trainer.trainerId}
                      primaryColor={primaryColor}
                      selectedDate={selectedDate}
                      onSelect={date => { setSelectedDate(date); setSelectedSlot(null); }}
                    />
                  </div>

                  {/* 2. 시간 (날짜 선택 후) */}
                  {selectedDate && (
                    <div>
                      <p className="text-sm font-bold text-gray-800 mb-3">
                        시간을 선택해 주세요
                        <span className="text-xs text-gray-400 font-normal ml-2">{selectedDate}</span>
                      </p>
                      <InlineTimeSlotPicker
                        trainerId={trainer.trainerId}
                        date={selectedDate}
                        primaryColor={primaryColor}
                        selectedSlotId={selectedSlot?.id ?? null}
                        onSelect={slot => setSelectedSlot(slot)}
                      />
                    </div>
                  )}

                  {/* 3. 예약자 정보 (시간 선택 후) */}
                  {selectedSlot && (
                    <div className="space-y-4 pt-2 border-t border-gray-100">
                      <div className="flex gap-2 flex-wrap">
                        <span className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-full font-semibold text-white" style={{ backgroundColor: primaryColor }}>
                          📅 {selectedDate}
                        </span>
                        <span className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-full font-semibold text-white" style={{ backgroundColor: primaryColor }}>
                          🕐 {selectedSlot.time}
                        </span>
                      </div>

                      {(bookingBlock?.data?.programs ?? []).length > 0 && (
                        <div className="space-y-2">
                          <label className="text-xs font-semibold text-gray-500">관심 프로그램</label>
                          <div className="flex flex-wrap gap-2">
                            {(bookingBlock?.data?.programs ?? []).map((p: string) => (
                              <button key={p} type="button"
                                onClick={() => setForm(f => ({ ...f, interestType: f.interestType === p ? "" : p }))}
                                className="px-3 py-1.5 rounded-full text-xs font-semibold border-2 transition-all"
                                style={form.interestType === p
                                  ? { backgroundColor: primaryColor, borderColor: primaryColor, color: "white" }
                                  : { borderColor: `${primaryColor}40`, color: "#555" }}>
                                {p}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {[
                        { label: "이름 *", key: "name", placeholder: "홍길동", type: "text" },
                        { label: "연락처 *", key: "phone", placeholder: "010-0000-0000", type: "tel" },
                      ].map(({ label, key, placeholder, type }) => (
                        <div key={key}>
                          <label className="text-xs text-gray-500 font-semibold">{label}</label>
                          <input type={type} value={(form as any)[key]}
                            onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
                            placeholder={placeholder}
                            className="w-full mt-1.5 border border-gray-200 rounded-2xl px-4 py-3 text-sm outline-none focus:border-gray-400 transition-colors" />
                        </div>
                      ))}
                      <div>
                        <label className="text-xs text-gray-500 font-semibold">남기실 말씀</label>
                        <textarea value={form.message} onChange={e => setForm(p => ({ ...p, message: e.target.value }))}
                          placeholder="궁금한 점을 남겨주세요..." rows={2}
                          className="w-full mt-1.5 border border-gray-200 rounded-2xl px-4 py-3 text-sm outline-none focus:border-gray-400 resize-none transition-colors" />
                      </div>
                      <button
                        disabled={!form.name || !form.phone || submitWithSlotMutation.isPending}
                        onClick={() => submitWithSlotMutation.mutate({
                          trainerId: trainer.trainerId,
                          slotId: selectedSlot.id,
                          reservedDate: selectedDate,
                          reservedTime: selectedSlot.time,
                          name: form.name, phone: form.phone,
                          interestType: form.interestType || undefined,
                          message: form.message || undefined,
                        })}
                        className="w-full py-4 rounded-2xl text-white font-bold text-sm disabled:opacity-40 transition-opacity"
                        style={{ backgroundColor: primaryColor }}>
                        {submitWithSlotMutation.isPending ? "예약 중..." : "예약 신청"}
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
