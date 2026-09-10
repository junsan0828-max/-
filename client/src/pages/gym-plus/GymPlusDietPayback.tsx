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

// ─── 미션 탭 (매월 날짜 구간 미션) ──────────────────────────────────────────────

const MISSION_TYPE_ICON: Record<string, string> = {
  attendance: "🏃",
  cardio: "💧",
  diet: "🥗",
  inbody: "📊",
};

const MISSION_DATE_LABEL: Record<string, string> = {
  attendance: "매월 1~7일",
  cardio: "매월 8~14일",
  diet: "매월 15~24일",
  inbody: "매월 25~말일",
};

function MissionTab() {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.gymPlus.getWeeklyMissions.useQuery();
  const [activePeriodKey, setActivePeriodKey] = useState<string | null>(null);
  const [weightInput, setWeightInput] = useState("");
  const [resultMsg, setResultMsg] = useState<{ periodKey: string; status: string; rewarded?: boolean; extensionUntil?: string } | null>(null);

  const logWeightMutation = trpc.gymPlus.logWeight.useMutation({
    onSuccess: () => {
      utils.gymPlus.getMissionStatus.invalidate();
      utils.gymPlus.getDietProgramReport.invalidate();
    },
  });

  const submitMutation = trpc.gymPlus.submitWeeklyMission.useMutation({
    onSuccess: (res) => {
      setActivePeriodKey(null);
      setWeightInput("");
      setResultMsg({ periodKey: res.periodKey, status: res.status });
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

  async function handleSubmit(missionType: string, periodKey: string) {
    if (missionType === "inbody") {
      const w = parseFloat(weightInput);
      if (isNaN(w) || w < 20 || w > 300) return;
      const weightRes = await logWeightMutation.mutateAsync({ weight: w, note: `${periodKey} 인바디` });
      submitMutation.mutate({ missionType: missionType as any });
      window.open(KAKAO_CHAT_URL, "_blank");
      if (weightRes?.rewarded && "extensionUntil" in weightRes) {
        setResultMsg({ periodKey, status: "pending", rewarded: true, extensionUntil: weightRes.extensionUntil as string });
      }
    } else if (missionType === "attendance") {
      submitMutation.mutate({ missionType: "attendance" });
    } else {
      submitMutation.mutate({ missionType: missionType as any });
      window.open(KAKAO_CHAT_URL, "_blank");
    }
  }

  const currentWindow = data.currentWindow;

  return (
    <div className="p-4 space-y-4 pb-8">
      {/* 현재 미션 배너 */}
      {currentWindow && (
        <div className="rounded-2xl overflow-hidden shadow-sm border border-[#1D4ED8]/20"
          style={{ background: "linear-gradient(135deg, hsl(221 83% 96%), hsl(221 83% 90%))" }}>
          <div className="px-4 py-2.5 border-b border-[#1D4ED8]/10 flex items-center justify-between">
            <span className="text-xs font-bold text-[#1D4ED8]">이번 달 진행 중</span>
            <span className="text-[10px] text-gray-500">{MISSION_DATE_LABEL[currentWindow.type]}</span>
          </div>
          <div className="px-4 py-3 flex items-center gap-3">
            <span className="text-2xl">{MISSION_TYPE_ICON[currentWindow.type]}</span>
            <div className="flex-1">
              <p className="text-sm font-bold text-[#1a2b4b]">{currentWindow.label}</p>
              {currentWindow.submission ? (
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                  currentWindow.submission.status === "approved" ? "bg-green-100 text-green-700" :
                  currentWindow.submission.status === "pending" ? "bg-amber-100 text-amber-700" :
                  "bg-red-100 text-red-700"
                }`}>
                  {currentWindow.submission.status === "approved" ? "달성 완료 ✓" :
                   currentWindow.submission.status === "pending" ? "검토 중" : "미달성"}
                </span>
              ) : (
                <span className="text-[10px] text-blue-500 font-medium">인증 대기 중</span>
              )}
            </div>
            {!currentWindow.submission && (
              <button
                onClick={() => setActivePeriodKey(activePeriodKey === currentWindow.periodKey ? null : currentWindow.periodKey)}
                className="shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold text-white"
                style={{ background: "hsl(221 83% 44%)" }}
              >
                인증하기
              </button>
            )}
          </div>

          {activePeriodKey === currentWindow.periodKey && !currentWindow.submission && (
            <div className="px-4 pb-4 space-y-2 border-t border-[#1D4ED8]/10">
              {currentWindow.type === "attendance" && (
                <p className="text-xs text-gray-500 pt-3">이번 달 1~7일 수업 출석 기록을 자동 확인합니다. (4일 이상 출석 시 달성)</p>
              )}
              {currentWindow.type === "inbody" && (
                <div className="pt-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="number" step="0.1" min="20" max="300"
                      value={weightInput}
                      onChange={(e) => setWeightInput(e.target.value)}
                      placeholder="이번 달 체중 (kg)"
                      className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                    />
                    <span className="text-sm text-gray-500 font-medium">kg</span>
                  </div>
                  <p className="text-[11px] text-gray-500">입력 후 카카오채널에 인바디 사진도 함께 보내주세요.</p>
                </div>
              )}
              {(currentWindow.type === "cardio" || currentWindow.type === "diet") && (
                <p className="text-xs text-gray-500 pt-3">버튼을 누르면 카카오채널이 열립니다. 인증 사진을 보내주세요.</p>
              )}
              <button
                onClick={() => handleSubmit(currentWindow.type, currentWindow.periodKey)}
                disabled={submitMutation.isPending || logWeightMutation.isPending ||
                  (currentWindow.type === "inbody" && (!weightInput || parseFloat(weightInput) < 20))}
                className="w-full py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50"
                style={{
                  background: currentWindow.type === "attendance" ? "hsl(221 83% 44%)" : "#FEE500",
                  color: currentWindow.type === "attendance" ? "white" : "#3A1D1D",
                }}
              >
                {(submitMutation.isPending || logWeightMutation.isPending) ? "처리 중..." :
                  currentWindow.type === "attendance" ? "출석 확인하기" :
                  currentWindow.type === "inbody" ? "체중 저장 + 카카오 인증 💬" :
                  "카카오로 인증하기 💬"}
              </button>
            </div>
          )}
        </div>
      )}

      {resultMsg && (
        <div className={`rounded-2xl p-4 text-sm font-medium space-y-1 ${
          resultMsg.status === "approved" ? "bg-green-50 text-green-700 border border-green-200" :
          resultMsg.status === "rejected" ? "bg-red-50 text-red-700 border border-red-200" :
          "bg-blue-50 text-blue-700 border border-blue-200"
        }`}>
          {resultMsg.status === "approved" && <p>✅ 미션 달성! 수고하셨습니다.</p>}
          {resultMsg.status === "rejected" && <p>❌ 출석 4일 미만입니다. 다음 달에 다시 도전해 주세요.</p>}
          {resultMsg.status === "pending" && <p>📋 카카오채널로 인증사진을 보내주세요. 확인 후 승인됩니다.</p>}
          {resultMsg.rewarded && resultMsg.extensionUntil && (
            <p className="font-bold">🎉 감량 달성! 헬스권이 {resultMsg.extensionUntil}까지 1개월 연장되었습니다.</p>
          )}
        </div>
      )}

      {/* 월별 미션 이력 */}
      <div className="space-y-3">
        {[...(data.months ?? [])].reverse().map((month) => (
          <div key={month.yearMonth} className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="px-4 py-2.5 border-b border-gray-50 bg-gray-50/50">
              <p className="text-xs font-bold text-gray-600">{month.displayLabel}</p>
            </div>
            {month.missions.map((mission) => {
              const sub = mission.submission;
              let statusColor = "#d1d5db"; let statusLabel = "미제출";
              if (mission.isCurrentWindow) { statusColor = "hsl(221 83% 44%)"; statusLabel = "진행 중"; }
              else if (!mission.isPast && !mission.isCurrentWindow) { statusColor = "#d1d5db"; statusLabel = "예정"; }
              if (sub?.status === "approved") { statusColor = "#22c55e"; statusLabel = "달성"; }
              else if (sub?.status === "pending") { statusColor = "#f59e0b"; statusLabel = "검토 중"; }
              else if (sub?.status === "rejected") { statusColor = "#ef4444"; statusLabel = "미달성"; }

              return (
                <div key={mission.periodKey} className="px-4 py-3 flex items-center gap-3 border-b border-gray-50 last:border-0">
                  <span className="text-lg">{MISSION_TYPE_ICON[mission.type]}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-700">{mission.label}</p>
                    <p className="text-[10px] text-gray-400">{MISSION_DATE_LABEL[mission.type]}</p>
                  </div>
                  <span className="text-xs font-semibold shrink-0" style={{ color: statusColor }}>{statusLabel}</span>
                </div>
              );
            })}
          </div>
        ))}
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
