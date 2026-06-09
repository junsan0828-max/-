import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { ChevronLeft, ChevronRight, Check, CheckCircle, Calendar, X } from "lucide-react";

interface Props { username: string; }

// ── 인라인 달력 ────────────────────────────────────────────────────────────────
function InlineCalendar({ trainerId, primaryColor, selectedDate, onSelect }: {
  trainerId: number; primaryColor: string; selectedDate: string;
  onSelect: (date: string) => void;
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

  const canGoPrev = year > today.getFullYear() || (year === today.getFullYear() && month > today.getMonth() + 1);
  function prevMonth() { if (month === 1) { setMonth(12); setYear(y => y - 1); } else setMonth(m => m - 1); }
  function nextMonth() { if (month === 12) { setMonth(1); setYear(y => y + 1); } else setMonth(m => m + 1); }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-1">
        <button onClick={prevMonth} disabled={!canGoPrev} className="p-2 rounded-full hover:bg-gray-100 disabled:opacity-30">
          <ChevronLeft className="h-5 w-5 text-gray-600" />
        </button>
        <p className="font-bold text-gray-900 text-sm">{year}년 {month}월</p>
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
          const isSelected = dateStr === selectedDate;
          return (
            <button key={day} disabled={isPast || !hasSlot} onClick={() => onSelect(dateStr)}
              className={`flex flex-col items-center justify-center py-1.5 rounded-xl transition-all
                ${isPast ? "opacity-25 cursor-not-allowed" : hasSlot ? "cursor-pointer" : "opacity-30 cursor-not-allowed"}`}>
              <span className={`w-8 h-8 flex items-center justify-center rounded-full text-sm font-semibold
                ${isSelected ? "text-white" : dateStr === todayStr ? "text-blue-500" : "text-gray-800"}
                ${!isSelected && hasSlot && !isPast ? "hover:bg-gray-100" : ""}`}
                style={isSelected ? { backgroundColor: primaryColor } : {}}>
                {day}
              </span>
              {hasSlot && !isPast && (
                <span className="w-1 h-1 rounded-full mt-0.5" style={{ backgroundColor: isSelected ? "transparent" : primaryColor }} />
              )}
            </button>
          );
        })}
      </div>
      <p className="text-center text-[10px] text-gray-400 pt-1">• 예약 가능한 날짜</p>
    </div>
  );
}

// ── 시간 선택 ──────────────────────────────────────────────────────────────────
function TimeSlots({ trainerId, date, primaryColor, selectedSlotId, onSelect }: {
  trainerId: number; date: string; primaryColor: string;
  selectedSlotId: number | null; onSelect: (slot: { id: number; time: string }) => void;
}) {
  const { data: slots = [], isLoading } = trpc.booking.getAvailableSlots.useQuery({ trainerId, date });
  const groups = [
    { label: "오전", slots: slots.filter((s: any) => s.time < "12:00") },
    { label: "오후", slots: slots.filter((s: any) => s.time >= "12:00" && s.time < "18:00") },
    { label: "저녁", slots: slots.filter((s: any) => s.time >= "18:00") },
  ].filter(g => g.slots.length > 0);

  if (isLoading) return <p className="text-sm text-gray-400 text-center py-4 animate-pulse">시간 불러오는 중...</p>;
  if (slots.length === 0) return <p className="text-sm text-gray-400 text-center py-4">이 날짜에 예약 가능한 시간이 없습니다.</p>;

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
                <button key={slot.id} disabled={booked} onClick={() => onSelect({ id: slot.id, time: slot.time })}
                  className={`relative py-2.5 rounded-xl text-xs font-semibold border-2 transition-all
                    ${booked ? "bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed" :
                      sel ? "text-white border-transparent" : "bg-white text-gray-800"}`}
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

// ── 메인 페이지 ────────────────────────────────────────────────────────────────
export default function ClassBookingPage({ username }: Props) {
  const { data: trainer, isLoading, error } = trpc.brand.getPublicProfile.useQuery({ username });
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedSlot, setSelectedSlot] = useState<{ id: number; time: string } | null>(null);
  const [form, setForm] = useState({ name: "", phone: "", interestType: "", message: "" });
  const [submitted, setSubmitted] = useState(false);

  const submitMutation = trpc.booking.submitWithSlot.useMutation({ onSuccess: () => setSubmitted(true) });

  let blocks: any[] = [];
  if (trainer?.brandBlocks) {
    try { blocks = JSON.parse(trainer.brandBlocks); } catch { blocks = []; }
  }
  const introBlock = blocks.find((b: any) => b.type === "intro");
  const primaryColor: string = introBlock?.data?.color ?? trainer?.brandColor ?? "#1a00ff";
  const programs: string[] = blocks.find((b: any) => b.type === "booking")?.data?.programs ?? [];

  if (isLoading) return (
    <div className="min-h-screen bg-[#f5f5f7] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: `${primaryColor} transparent transparent transparent` }} />
    </div>
  );

  if (error || !trainer) return (
    <div className="min-h-screen bg-[#f5f5f7] flex flex-col items-center justify-center gap-3 p-6">
      <p className="text-gray-500 text-sm">페이지를 찾을 수 없습니다.</p>
      <a href="/" className="text-blue-500 text-sm underline">핏스텝 홈으로</a>
    </div>
  );

  if (submitted) {
    return (
      <div className="min-h-screen bg-[#f5f5f7] flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl p-8 max-w-sm w-full text-center space-y-4 shadow-sm">
          <div className="w-16 h-16 rounded-full mx-auto flex items-center justify-center" style={{ backgroundColor: `${primaryColor}20` }}>
            <CheckCircle className="h-8 w-8" style={{ color: primaryColor }} />
          </div>
          <div>
            <p className="text-lg font-bold text-gray-900">예약 완료!</p>
            <p className="text-sm text-gray-500 mt-1">{trainer.trainerName} STEPER가 곧 확인 후 연락드립니다.</p>
          </div>
          <div className="bg-gray-50 rounded-2xl p-4 text-sm space-y-1 text-left">
            <p className="text-gray-600">📅 {selectedDate}</p>
            <p className="text-gray-600">🕐 {selectedSlot?.time}</p>
            {form.interestType && <p className="text-gray-600">📋 {form.interestType}</p>}
            <p className="text-gray-600">👤 {form.name}</p>
          </div>
          <a href={`/p/${username}`}
            className="block w-full py-3 rounded-2xl text-white font-semibold text-sm"
            style={{ backgroundColor: primaryColor }}>
            STEPER 페이지로
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f5f7]">
      {/* 헤더 */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center gap-3">
          <a href={`/p/${username}`} className="p-1.5 rounded-full hover:bg-gray-100 transition-colors">
            <X className="h-5 w-5 text-gray-500" />
          </a>
          <div>
            <p className="font-bold text-gray-900 text-sm">{trainer.trainerName} STEPER</p>
            <p className="text-xs text-gray-400">수업 예약</p>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-5 space-y-5 pb-16">
        {/* 날짜 선택 */}
        <div className="bg-white rounded-3xl p-5 shadow-sm">
          <p className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
            <Calendar className="h-4 w-4" style={{ color: primaryColor }} />
            날짜를 선택해 주세요
          </p>
          <InlineCalendar
            trainerId={trainer.trainerId}
            primaryColor={primaryColor}
            selectedDate={selectedDate}
            onSelect={date => { setSelectedDate(date); setSelectedSlot(null); }}
          />
        </div>

        {/* 시간 선택 */}
        {selectedDate && (
          <div className="bg-white rounded-3xl p-5 shadow-sm">
            <p className="text-sm font-bold text-gray-800 mb-4">
              시간을 선택해 주세요
              <span className="text-xs text-gray-400 font-normal ml-2">{selectedDate}</span>
            </p>
            <TimeSlots
              trainerId={trainer.trainerId}
              date={selectedDate}
              primaryColor={primaryColor}
              selectedSlotId={selectedSlot?.id ?? null}
              onSelect={slot => setSelectedSlot(slot)}
            />
          </div>
        )}

        {/* 예약자 정보 */}
        {selectedSlot && (
          <div className="bg-white rounded-3xl p-5 shadow-sm space-y-4">
            <p className="text-sm font-bold text-gray-800">예약자 정보</p>

            {/* 선택 요약 */}
            <div className="flex gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-full font-semibold text-white"
                style={{ backgroundColor: primaryColor }}>📅 {selectedDate}</span>
              <span className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-full font-semibold text-white"
                style={{ backgroundColor: primaryColor }}>🕐 {selectedSlot.time}</span>
            </div>

            {/* 프로그램 선택 */}
            {programs.length > 0 && (
              <div className="space-y-2">
                <label className="text-xs font-semibold text-gray-500">수업 종류</label>
                <div className="flex flex-wrap gap-2">
                  {programs.map((p: string) => (
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

            {/* 이름 / 연락처 */}
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
                placeholder="궁금한 점이나 요청 사항을 남겨주세요..." rows={2}
                className="w-full mt-1.5 border border-gray-200 rounded-2xl px-4 py-3 text-sm outline-none focus:border-gray-400 resize-none transition-colors" />
            </div>

            <button
              disabled={!form.name || !form.phone || submitMutation.isPending}
              onClick={() => submitMutation.mutate({
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
              {submitMutation.isPending ? "예약 중..." : "수업 예약하기"}
            </button>
          </div>
        )}

        <p className="text-center text-xs text-gray-400">
          Powered by <a href="/" className="font-semibold text-gray-500">FIT STEP</a>
        </p>
      </div>
    </div>
  );
}
