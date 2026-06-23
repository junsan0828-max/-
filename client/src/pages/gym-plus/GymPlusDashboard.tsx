import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";

const membershipTypeLabel: Record<string, string> = {
  general: "일반회원",
  premium: "프리미엄",
  vip: "VIP",
};

function daysUntil(dateStr: string | null | undefined) {
  if (!dateStr) return null;
  const diff = Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
  return diff;
}

function getRenewalBonus(days: number | null) {
  if (days === null) return null;
  if (days >= 30) return { label: "재등록 시 2주 무료", desc: "만료 1개월 전 등록", color: "text-green-600" };
  if (days >= 5) return { label: "재등록 시 7일 무료", desc: "만료 1개월 이내 등록", color: "text-[#1D4ED8]" };
  if (days >= 0) return { label: "재등록 시 3일 무료", desc: "만료 5일 전 등록", color: "text-orange-500" };
  return null;
}

export default function GymPlusDashboard() {
  const [, navigate] = useLocation();
  const { data: member } = trpc.gymPlus.memberMe.useQuery();
  const { data: events } = trpc.gymPlus.listEvents.useQuery({});
  const { data: logs } = trpc.gymPlus.listWorkoutLogs.useQuery({});

  const today = new Date().toISOString().slice(0, 10);
  const todayCheckedIn = logs?.some((l) => l.logDate === today && l.title === "출석체크");
  const daysLeft = daysUntil(member?.membershipEnd);
  const bonus = getRenewalBonus(daysLeft);

  const notices = (events ?? []).filter(e => e.eventType === "notice");
  const eventItems = (events ?? []).filter(e => e.eventType !== "notice");
  const displayItems = [
    ...notices.map(e => ({ ...e, _isNotice: true })),
    ...eventItems.map(e => ({ ...e, _isNotice: false })),
  ].slice(0, 6);

  const membershipColor =
    daysLeft === null ? "border-gray-100 bg-white" :
    daysLeft <= 0 ? "border-red-200 bg-red-50" :
    daysLeft <= 7 ? "border-orange-200 bg-orange-50" :
    "border-blue-100 bg-[#EEF4FF]";

  const dayTextColor =
    daysLeft === null ? "text-gray-400" :
    daysLeft <= 0 ? "text-red-500" :
    daysLeft <= 7 ? "text-orange-500" :
    "text-[#1D4ED8]";

  const memberType = member?.membershipType ?? "general";

  return (
    <div className="p-4 space-y-6 pb-8">

      {/* 1. 환영 인사 */}
      <div className="pt-1 flex items-start justify-between">
        <div>
          <p className="text-[13px] text-gray-400 font-light tracking-wide">안녕하세요</p>
          <p className="text-[26px] font-extrabold text-[#1a2b4b] leading-tight mt-0.5">{member?.name ?? "회원"}님</p>
        </div>
        {member?.membershipType && (
          <span className="mt-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full bg-[#1D4ED8]/10 text-[#1D4ED8] tracking-wide">
            {membershipTypeLabel[memberType] ?? memberType}
          </span>
        )}
      </div>

      {/* 2. 회원권 D-day */}
      {daysLeft !== null && (
        <button
          onClick={() => navigate("/gym-plus/profile")}
          className={`w-full rounded-2xl border p-5 text-left transition-all hover:shadow-md ${membershipColor}`}
        >
          <div className="flex items-end justify-between gap-2">
            <div>
              <p className="text-[11px] text-gray-400 font-medium tracking-widest uppercase mb-2">Membership</p>
              {daysLeft > 0 ? (
                <p className={`font-black leading-none ${dayTextColor}`} style={{ fontSize: "2.75rem" }}>
                  D-{daysLeft}
                </p>
              ) : daysLeft === 0 ? (
                <p className={`font-black leading-none ${dayTextColor}`} style={{ fontSize: "2.75rem" }}>
                  D-day
                </p>
              ) : (
                <p className="text-[22px] font-bold text-red-500 leading-snug tracking-tight">
                  만료됨
                </p>
              )}
              {member?.membershipEnd && (
                <p className="text-[11px] text-gray-400 mt-2">
                  {member.membershipEnd} 만료
                </p>
              )}
            </div>
            {bonus ? (
              <div className="text-right pb-0.5">
                <p className={`text-[11px] font-bold leading-snug ${bonus.color}`}>{bonus.label}</p>
                <p className="text-[10px] text-gray-400 mt-1">{bonus.desc}</p>
                <p className="text-[11px] text-[#1D4ED8] font-semibold mt-2">재등록 →</p>
              </div>
            ) : (
              <p className="text-[11px] text-gray-400 pb-0.5">내 정보 보기 →</p>
            )}
          </div>
        </button>
      )}

      {/* 3. 공지 & 이벤트 (최대 6개) */}
      {displayItems.length > 0 && (
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <p className="text-[13px] font-bold text-[#1a2b4b] tracking-tight">공지 & 이벤트</p>
            <button className="text-[12px] text-[#1D4ED8] font-medium" onClick={() => navigate("/gym-plus/events")}>
              전체보기 →
            </button>
          </div>
          <div className="space-y-2">
            {displayItems.map((e) => (
              <button
                key={e.id}
                onClick={() => navigate(`/gym-plus/events/${e.id}`)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all hover:shadow-sm ${
                  e._isNotice
                    ? "bg-[#EEF4FF] border-blue-100"
                    : "bg-white border-gray-100 shadow-[0_1px_4px_rgba(0,0,0,0.05)]"
                }`}
              >
                <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 tracking-wide ${
                  e._isNotice
                    ? "bg-[#1D4ED8] text-white"
                    : e.eventType === "promotion"
                    ? "bg-orange-400 text-white"
                    : e.eventType === "points"
                    ? "bg-purple-500 text-white"
                    : "bg-gray-200 text-gray-600"
                }`}>
                  {e._isNotice ? "공지" : e.eventType === "promotion" ? "프로모션" : e.eventType === "points" ? "포인트" : "이벤트"}
                </span>
                <p className="text-[13px] font-medium text-[#1a2b4b] line-clamp-1 flex-1">{e.title}</p>
                <svg viewBox="0 0 24 24" fill="none" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5 text-gray-300 flex-shrink-0">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                </svg>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 4. 퀵 메뉴 2x2 그리드 */}
      <div className="space-y-2.5">
        <p className="text-[13px] font-bold text-[#1a2b4b] tracking-tight">메뉴</p>
        <div className="grid grid-cols-2 gap-3">

          {/* 운동영상 */}
          <button
            className="group bg-white border border-gray-100 rounded-2xl p-4 shadow-sm flex flex-col gap-3 hover:border-blue-200 hover:shadow-md transition-all text-left"
            onClick={() => navigate("/gym-plus/videos")}
          >
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#1D4ED8] to-[#2563EB] flex items-center justify-center shadow-sm">
              <svg viewBox="0 0 24 24" fill="none" strokeWidth={2} stroke="white" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.91 11.672a.375.375 0 0 1 0 .656l-5.603 3.113a.375.375 0 0 1-.557-.328V8.887c0-.286.307-.466.557-.328l5.603 3.113Z" />
              </svg>
            </div>
            <div>
              <p className="text-[13px] font-bold text-[#1a2b4b]">운동영상</p>
              {todayCheckedIn ? (
                <div className="flex items-center gap-1 mt-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                  <p className="text-[11px] text-green-600 font-medium">출석 완료</p>
                </div>
              ) : (
                <p className="text-[11px] text-[#1D4ED8] font-medium mt-1">출석하기 →</p>
              )}
            </div>
          </button>

          {/* 운동기록 */}
          <button
            className="group bg-white border border-gray-100 rounded-2xl p-4 shadow-sm flex flex-col gap-3 hover:border-blue-200 hover:shadow-md transition-all text-left"
            onClick={() => navigate("/gym-plus/workout")}
          >
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-violet-500 to-violet-600 flex items-center justify-center shadow-sm">
              <svg viewBox="0 0 24 24" fill="none" strokeWidth={2} stroke="white" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="m3.75 13.5 10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z" />
              </svg>
            </div>
            <div>
              <p className="text-[13px] font-bold text-[#1a2b4b]">운동기록</p>
              <p className="text-[11px] text-gray-400 mt-1">기록 보기 →</p>
            </div>
          </button>

          {/* 식단관리 */}
          <button
            className="group bg-white border border-gray-100 rounded-2xl p-4 shadow-sm flex flex-col gap-3 hover:border-blue-200 hover:shadow-md transition-all text-left"
            onClick={() => navigate("/gym-plus/diet")}
          >
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-sm">
              <svg viewBox="0 0 24 24" fill="none" strokeWidth={2} stroke="white" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" />
              </svg>
            </div>
            <div>
              <p className="text-[13px] font-bold text-[#1a2b4b]">식단관리</p>
              <p className="text-[11px] text-gray-400 mt-1">오늘 식단 →</p>
            </div>
          </button>

          {/* 내정보 */}
          <button
            className="group bg-white border border-gray-100 rounded-2xl p-4 shadow-sm flex flex-col gap-3 hover:border-blue-200 hover:shadow-md transition-all text-left"
            onClick={() => navigate("/gym-plus/profile")}
          >
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-slate-500 to-slate-600 flex items-center justify-center shadow-sm">
              <svg viewBox="0 0 24 24" fill="none" strokeWidth={2} stroke="white" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
              </svg>
            </div>
            <div>
              <p className="text-[13px] font-bold text-[#1a2b4b]">내정보</p>
              <p className="text-[11px] text-gray-400 mt-1">프로필 보기 →</p>
            </div>
          </button>

        </div>
      </div>

    </div>
  );
}
