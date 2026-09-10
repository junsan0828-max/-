import { useState } from "react";
import { trpc } from "@/lib/trpc";

const KAKAO_CHAT_URL = "http://pf.kakao.com/_ZZxais/chat";

function formatDate(s: string) {
  return s ? s.slice(0, 10).replace(/-/g, ".") : "-";
}

// ─── 현황 탭 ─────────────────────────────────────────────────────────────────

function StatusTab() {
  const { data: report } = trpc.gymPlus.getDietProgramReport.useQuery();
  const { data: sessions, isLoading } = trpc.gymPlus.getDietSessions.useQuery();

  if (!report) {
    return (
      <div className="p-5 text-center">
        <p className="text-gray-400 text-sm">프로그램 정보가 없습니다.</p>
      </div>
    );
  }

  const participated = (sessions ?? []).filter(s => s.participated === 1);

  return (
    <div className="p-4 space-y-4 pb-8">
      {/* 프로그램 배너 */}
      <div
        className="rounded-2xl p-5 text-white"
        style={{ background: "linear-gradient(135deg, hsl(221 83% 44%), hsl(221 83% 30%))" }}
      >
        <div className="flex items-center gap-2 mb-2">
          <p className="text-xs font-medium opacity-75">참여 프로그램</p>
          {report.isCompleted && (
            <span className="text-[10px] bg-white/20 text-white px-2 py-0.5 rounded-full">완료</span>
          )}
        </div>
        <p className="text-lg font-bold mb-3">{report.programName}</p>
        <div className="flex gap-4 text-sm">
          <div>
            <p className="opacity-70 text-xs">시작일</p>
            <p className="font-semibold">{formatDate(report.programStart)}</p>
          </div>
          <div>
            <p className="opacity-70 text-xs">종료일</p>
            <p className="font-semibold">{formatDate(report.programEnd)}</p>
          </div>
          {report.weightChange !== null && report.weightChange > 0 && (
            <div className="ml-auto">
              <p className="opacity-70 text-xs">총 감량</p>
              <p className="font-semibold text-green-300">-{report.weightChange} kg</p>
            </div>
          )}
        </div>
      </div>

      {/* KPI 3칸 */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-2xl p-3 text-center shadow-sm">
          <p className="text-2xl font-black text-blue-600">{report.totalSessions}</p>
          <p className="text-[10px] text-gray-400 mt-0.5">수업 참여</p>
        </div>
        <div className="bg-white rounded-2xl p-3 text-center shadow-sm">
          <p className={`text-2xl font-black ${report.weightChange && report.weightChange > 0 ? "text-green-600" : "text-gray-300"}`}>
            {report.weightChange !== null && report.weightChange > 0 ? `-${report.weightChange}kg` : "—"}
          </p>
          <p className="text-[10px] text-gray-400 mt-0.5">체중 감량</p>
        </div>
        <div className="bg-white rounded-2xl p-3 text-center shadow-sm">
          <p className="text-2xl font-black text-purple-600">{report.rewards.length}</p>
          <p className="text-[10px] text-gray-400 mt-0.5">리워드</p>
        </div>
      </div>

      {/* 12주 완료 배너 */}
      {report.isCompleted && report.weightChange !== null && report.weightChange >= 1 && (
        <div className="bg-gradient-to-r from-green-500 to-emerald-500 rounded-2xl px-4 py-3 text-center">
          <p className="text-white font-bold text-sm">🏆 12주 완료 · {report.weightChange}kg 감량 달성!</p>
          <p className="text-green-100 text-xs mt-0.5">수고하셨습니다. 건강한 습관이 완성됐어요!</p>
        </div>
      )}

      {/* 수업 이력 */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-50">
          <p className="text-sm font-bold text-gray-800">수업 참여 이력</p>
        </div>
        {isLoading ? (
          <p className="p-4 text-center text-xs text-gray-400">불러오는 중...</p>
        ) : (sessions ?? []).length === 0 ? (
          <p className="p-4 text-center text-xs text-gray-400">수업 이력이 없습니다</p>
        ) : (
          <div className="divide-y divide-gray-50">
            {(sessions ?? []).map((s, i) => (
              <div key={i} className="px-4 py-3 flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${s.participated === 1 ? "bg-green-500" : "bg-gray-300"}`} />
                <div className="flex-1">
                  <p className="text-xs font-medium text-gray-700">{s.sessionDate.replace(/-/g, ".")}</p>
                  <p className="text-[10px] text-gray-400">
                    {s.checkinTime}{s.checkoutTime ? ` → ${s.checkoutTime}` : " (미종료)"}
                  </p>
                </div>
                <div className="text-right">
                  {s.participated === 1 ? (
                    <span className="text-[10px] text-green-600 font-medium">
                      {s.elapsedMin !== null ? `${s.elapsedMin}분 인정` : "인정"}
                    </span>
                  ) : s.checkoutTime ? (
                    <span className="text-[10px] text-gray-400">
                      {s.elapsedMin !== null ? `${s.elapsedMin}분 미인정` : "미인정"}
                    </span>
                  ) : (
                    <span className="text-[10px] text-yellow-500">수업 중</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── 미션 탭 (12주 주차별 미션) ───────────────────────────────────────────────

const MISSION_TYPE_ICON: Record<string, string> = {
  attendance: "🏃",
  cardio: "💧",
  diet: "🥗",
  inbody: "📊",
};

function MissionTab() {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.gymPlus.getWeeklyMissions.useQuery();
  const [activeWeek, setActiveWeek] = useState<number | null>(null);
  const [weightInput, setWeightInput] = useState("");
  const [resultMsg, setResultMsg] = useState<{ week: number; status: string; rewarded?: boolean; rewardMonths?: number; extensionUntil?: string } | null>(null);

  const logWeightMutation = trpc.gymPlus.logWeight.useMutation({
    onSuccess: (res) => {
      utils.gymPlus.getMissionStatus.invalidate();
      utils.gymPlus.getDietProgramReport.invalidate();
      return res;
    },
  });

  const submitMutation = trpc.gymPlus.submitWeeklyMission.useMutation({
    onSuccess: (res) => {
      setActiveWeek(null);
      setWeightInput("");
      setResultMsg({ week: res.weekNumber, status: res.status });
      utils.gymPlus.getWeeklyMissions.invalidate();
    },
  });

  if (isLoading) return <div className="p-5 text-center text-gray-400 text-sm">로딩 중...</div>;
  if (!data) {
    return (
      <div className="p-5 text-center">
        <p className="text-gray-400 text-sm">참여 중인 프로그램이 없습니다.</p>
      </div>
    );
  }

  const { weeks, currentWeek } = data;
  const completedCount = weeks.filter(w => w.submission?.status === "approved").length;

  async function handleSubmit(week: (typeof weeks)[0]) {
    if (week.missionType === "attendance") {
      submitMutation.mutate({ weekNumber: week.weekNumber });
    } else if (week.missionType === "inbody") {
      const w = parseFloat(weightInput);
      if (isNaN(w) || w < 20 || w > 300) return;
      // 체중 먼저 저장 → 리워드 체크
      const weightRes = await logWeightMutation.mutateAsync({ weight: w, note: `${week.weekNumber}주차 인바디` });
      submitMutation.mutate({ weekNumber: week.weekNumber });
      window.open(KAKAO_CHAT_URL, "_blank");
      if (weightRes?.rewarded && "extensionUntil" in weightRes) {
        setResultMsg({ week: week.weekNumber, status: "pending", rewarded: true, rewardMonths: (weightRes as any).rewardMonths, extensionUntil: weightRes.extensionUntil as string });
      }
    } else {
      submitMutation.mutate({ weekNumber: week.weekNumber });
      window.open(KAKAO_CHAT_URL, "_blank");
    }
  }

  return (
    <div className="p-4 space-y-4 pb-8">
      {/* 진행률 요약 */}
      <div
        className="rounded-2xl p-4 text-white"
        style={{ background: "linear-gradient(135deg, hsl(221 83% 44%), hsl(221 83% 28%))" }}
      >
        <p className="text-xs opacity-75 mb-1">12주 미션 진행률</p>
        <div className="flex items-end gap-2 mb-3">
          <p className="text-3xl font-black">{completedCount}</p>
          <p className="text-sm opacity-75 mb-1">/ 12 완료</p>
        </div>
        <div className="w-full bg-white/20 rounded-full h-2">
          <div
            className="bg-white rounded-full h-2 transition-all"
            style={{ width: `${(completedCount / 12) * 100}%` }}
          />
        </div>
        {currentWeek > 0 && currentWeek <= 12 && (
          <p className="text-xs opacity-75 mt-2">현재 {currentWeek}주차 진행 중</p>
        )}
      </div>

      {resultMsg && (
        <div className={`rounded-2xl p-4 text-sm font-medium space-y-1 ${resultMsg.status === "approved" ? "bg-green-50 text-green-700 border border-green-200" : resultMsg.status === "rejected" ? "bg-red-50 text-red-700 border border-red-200" : "bg-blue-50 text-blue-700 border border-blue-200"}`}>
          {resultMsg.status === "approved" && <p>✅ 미션 달성! 수고하셨습니다.</p>}
          {resultMsg.status === "rejected" && <p>❌ 미션 조건 미달성입니다. (출석 4일 미만)</p>}
          {resultMsg.status === "pending" && <p>📋 카카오채널로 인증사진을 보내주세요. 확인 후 승인됩니다.</p>}
          {resultMsg.rewarded && resultMsg.extensionUntil && (
            <p className="text-green-700 font-bold">
              🎉 감량 달성! 헬스권이 {resultMsg.extensionUntil}까지 1개월 연장되었습니다.
            </p>
          )}
        </div>
      )}

      {/* 주차별 미션 목록 */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-50">
          <p className="text-sm font-bold text-gray-800">주차별 미션</p>
        </div>
        {weeks.map((week) => {
          const sub = week.submission;
          const isExpanded = activeWeek === week.weekNumber;
          const canSubmit = !sub && (week.isCurrentWeek || week.isPast) && !week.isFuture;

          let statusColor = "#d1d5db";
          let statusLabel = "—";
          if (week.isFuture) { statusColor = "#d1d5db"; statusLabel = "대기"; }
          else if (!sub) { statusColor = week.isCurrentWeek ? "hsl(221 83% 44%)" : "#9ca3af"; statusLabel = week.isCurrentWeek ? "진행 중" : "미제출"; }
          else if (sub.status === "approved") { statusColor = "#22c55e"; statusLabel = "달성"; }
          else if (sub.status === "pending") { statusColor = "#f59e0b"; statusLabel = "검토 중"; }
          else if (sub.status === "rejected") { statusColor = "#ef4444"; statusLabel = "미달성"; }

          return (
            <div key={week.weekNumber} className="border-b border-gray-50 last:border-0">
              <button
                className="w-full px-4 py-3.5 flex items-center gap-3 text-left"
                onClick={() => canSubmit && setActiveWeek(isExpanded ? null : week.weekNumber)}
              >
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-sm shrink-0"
                  style={{
                    background: sub?.status === "approved" ? "#22c55e" : week.isCurrentWeek ? "hsl(221 83% 44%)" : week.isFuture ? "#f3f4f6" : "#f3f4f6",
                    color: (sub?.status === "approved" || week.isCurrentWeek) ? "white" : week.isFuture ? "#d1d5db" : "#6b7280",
                  }}
                >
                  {sub?.status === "approved" ? (
                    <svg viewBox="0 0 24 24" fill="none" strokeWidth={2.5} stroke="white" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                  ) : (
                    <span className="text-xs">{week.weekNumber}</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm">{MISSION_TYPE_ICON[week.missionType]}</span>
                    <p className={`text-sm font-medium truncate ${week.isFuture ? "text-gray-300" : "text-gray-800"}`}>
                      {week.weekNumber}주차
                      {week.isCurrentWeek && <span className="ml-1.5 text-[10px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full font-semibold">NOW</span>}
                    </p>
                  </div>
                  <p className={`text-[11px] mt-0.5 ${week.isFuture ? "text-gray-300" : "text-gray-500"}`}>{week.label}</p>
                </div>
                <span className="text-xs font-medium shrink-0" style={{ color: statusColor }}>
                  {statusLabel}
                </span>
              </button>

              {isExpanded && canSubmit && (
                <div className="px-4 pb-4 space-y-2 border-t border-gray-50">
                  {week.missionType === "attendance" && (
                    <p className="text-xs text-gray-500 pt-3">이번 주 수업 출석 기록을 자동으로 확인합니다. (4일 이상 출석 시 달성)</p>
                  )}
                  {week.missionType === "inbody" && (
                    <div className="pt-3 space-y-2">
                      <p className="text-xs font-semibold text-gray-700">인바디 체중 입력</p>
                      <div className="flex items-center gap-2">
                        <input
                          type="number" step="0.1" min="20" max="300"
                          value={weightInput}
                          onChange={(e) => setWeightInput(e.target.value)}
                          placeholder="측정 체중 (kg)"
                          className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                        />
                        <span className="text-sm text-gray-500 font-medium">kg</span>
                      </div>
                      <div className="flex items-start gap-2 bg-yellow-50 rounded-xl p-3">
                        <span className="text-sm">💬</span>
                        <p className="text-[11px] text-gray-600">체중 입력 후 버튼을 누르면 카카오채널이 열립니다. 인바디 사진도 함께 보내주세요.</p>
                      </div>
                    </div>
                  )}
                  {(week.missionType === "cardio" || week.missionType === "diet") && (
                    <div className="pt-3 flex items-start gap-2 bg-yellow-50 rounded-xl p-3">
                      <span className="text-base">💬</span>
                      <div>
                        <p className="text-xs font-semibold text-gray-700">카카오채널로 인증하기</p>
                        <p className="text-[11px] text-gray-500 mt-0.5">버튼을 누르면 카카오채널이 열립니다. 인증 사진을 보내주세요.</p>
                      </div>
                    </div>
                  )}
                  <button
                    onClick={() => handleSubmit(week)}
                    disabled={submitMutation.isPending || logWeightMutation.isPending || (week.missionType === "inbody" && (!weightInput || parseFloat(weightInput) < 20))}
                    className="w-full py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 transition-opacity"
                    style={{
                      background: week.missionType === "attendance" ? "hsl(221 83% 44%)" : "#FEE500",
                      color: week.missionType === "attendance" ? "white" : "#3A1D1D",
                    }}
                  >
                    {(submitMutation.isPending || logWeightMutation.isPending) ? "처리 중..." :
                      week.missionType === "attendance" ? "출석 확인하기" :
                      week.missionType === "inbody" ? "체중 저장 + 카카오 인증 💬" :
                      "카카오로 인증하기 💬"}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── 메인 페이지 ──────────────────────────────────────────────────────────────

type Tab = "status" | "mission";

export default function GymPlusDietPayback() {
  const [tab, setTab] = useState<Tab>("status");
  const { data: me } = trpc.gymPlus.memberMe.useQuery();

  if (!me?.programName) {
    return (
      <div className="p-5 text-center">
        <div className="bg-white rounded-2xl p-8 shadow-sm space-y-3">
          <p className="text-gray-700 font-semibold">다이어트페이백 프로그램 미등록</p>
          <p className="text-gray-400 text-sm">담당 트레이너에게 문의해 주세요.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#f8f9fc]">
      {/* 탭 헤더 */}
      <div className="flex bg-white border-b border-gray-100 sticky top-0 z-10">
        {([
          { key: "status", label: "현황" },
          { key: "mission", label: "미션" },
        ] as { key: Tab; label: string }[]).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              tab === t.key ? "text-[#1D4ED8] border-b-2 border-[#1D4ED8]" : "text-gray-400"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {tab === "status" && <StatusTab />}
        {tab === "mission" && <MissionTab />}
      </div>
    </div>
  );
}
