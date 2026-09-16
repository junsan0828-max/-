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
                  <div className="flex items-center gap-1.5">
                    <p className="text-xs font-medium text-gray-700">{s.sessionDate.replace(/-/g, ".")}</p>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${
                      (s as any).workoutType === "cardio"
                        ? "bg-green-50 text-green-600"
                        : "bg-blue-50 text-blue-600"
                    }`}>
                      {(s as any).workoutType === "cardio" ? "유산소" : "영상"}
                    </span>
                  </div>
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
                    <span className="text-[10px] text-yellow-500">진행 중</span>
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

const MISSION_GUIDE = [
  {
    icon: "🏃", period: "매월 1~7일", title: "출석 미션",
    desc: "매월 1~7일 사이에 수업을 4일 이상 참여하면 자동 달성됩니다.\n3층 키오스크에서 [영상 운동]을 선택해 체크인·체크아웃하고, 30분 이상 참여해야 출석으로 인정됩니다.",
  },
  {
    icon: "💧", period: "매월 8~14일", title: "유산소 미션",
    desc: "매월 8~14일 사이에 유산소 운동을 2회 이상 완료하면 자동 달성됩니다.\n3층 키오스크에서 [유산소 운동]을 선택해 체크인·체크아웃하고, 30분 이상 유산소 운동(러닝머신·자전거 등)을 해야 인정됩니다.",
  },
  {
    icon: "🥗", period: "매월 15~24일", title: "식단 미션",
    desc: "매월 15~24일 사이에 단백질 위주 식단 사진을 카카오채널로 전송하면 트레이너가 확인 후 승인합니다.\n닭가슴살·계란·두부 등 단백질 식품이 포함된 식사 사진을 찍어 전송해 주세요.",
  },
  {
    icon: "📊", period: "매월 25~말일", title: "인바디 미션",
    desc: "매월 25일~말일 사이에 데스크에서 인바디를 측정하고, 현재 체중을 앱에 입력한 뒤 인바디 결과지 사진을 카카오채널로 전송하세요.\n시작 체중 대비 감량 기준을 달성하면 헬스권이 1개월 자동 연장됩니다. (최대 9개월)",
  },
];

function MissionGuideCard() {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-2xl overflow-hidden border border-amber-200 bg-amber-50 shadow-sm">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full px-4 py-3 flex items-center justify-between text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-base">📋</span>
          <span className="text-sm font-bold text-amber-800">미션 안내</span>
          <span className="text-[10px] text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full">매달 4가지 미션</span>
        </div>
        <span className="text-amber-500 text-xs">{open ? "접기 ▲" : "펼치기 ▼"}</span>
      </button>
      {open && (
        <div className="border-t border-amber-200 divide-y divide-amber-100">
          {MISSION_GUIDE.map((g) => (
            <div key={g.title} className="px-4 py-3 flex gap-3">
              <span className="text-xl shrink-0 mt-0.5">{g.icon}</span>
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="text-xs font-bold text-amber-900">{g.title}</p>
                  <span className="text-[10px] text-amber-600">{g.period}</span>
                </div>
                {g.desc.split("\n").map((line, i) => (
                  <p key={i} className={`text-xs text-amber-700 leading-relaxed ${i > 0 ? "mt-1" : ""}`}>{line}</p>
                ))}
              </div>
            </div>
          ))}
          <div className="px-4 py-3">
            <p className="text-[11px] text-amber-600 leading-relaxed">
              💡 <strong>다이어트 페이백</strong>: 12주 프로그램 종료 후, 매달 25~말일 인바디 체크에서 기준 체중 이하 유지 시 헬스권 1개월 자동 연장 (최대 9개월)
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function MissionTab() {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.gymPlus.getWeeklyMissions.useQuery();
  const [activePeriodKey, setActivePeriodKey] = useState<string | null>(null);
  const [weightInput, setWeightInput] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [resultMsg, setResultMsg] = useState<{ periodKey: string; status: string; rewarded?: boolean; extensionUntil?: string; syncFailed?: boolean } | null>(null);

  const logWeightMutation = trpc.gymPlus.logWeight.useMutation({
    onSuccess: () => {
      utils.gymPlus.getMissionStatus.invalidate();
      utils.gymPlus.getDietProgramReport.invalidate();
    },
    onError: (err) => {
      setErrorMsg(err.message || "체중 저장에 실패했습니다. 잠시 후 다시 시도해 주세요.");
    },
  });

  const submitMutation = trpc.gymPlus.submitWeeklyMission.useMutation({
    onSuccess: (res) => {
      setActivePeriodKey(null);
      setWeightInput("");
      setErrorMsg(null);
      setResultMsg({ periodKey: res.periodKey, status: res.status });
      utils.gymPlus.getWeeklyMissions.invalidate();
    },
    onError: (err) => {
      setErrorMsg(err.message || "미션 제출에 실패했습니다. 잠시 후 다시 시도해 주세요.");
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
    setErrorMsg(null);
    if (missionType === "inbody") {
      const w = parseFloat(weightInput);
      if (isNaN(w) || w < 20 || w > 300) {
        setErrorMsg("체중을 20~300kg 사이로 입력해 주세요.");
        return;
      }
      let weightRes;
      try {
        weightRes = await logWeightMutation.mutateAsync({ weight: w, note: `${periodKey} 인바디` });
      } catch {
        return; // onError에서 메시지 표시. 저장 실패 시 미션 제출로 넘어가지 않는다.
      }
      submitMutation.mutate({ missionType: missionType as any });
      window.open(KAKAO_CHAT_URL, "_blank");
      if (weightRes?.rewarded && "extensionUntil" in weightRes) {
        setResultMsg({
          periodKey, status: "pending", rewarded: true,
          extensionUntil: weightRes.extensionUntil as string,
          syncFailed: "syncFailed" in weightRes ? Boolean(weightRes.syncFailed) : false,
        });
      }
    } else if (missionType === "attendance" || missionType === "cardio") {
      submitMutation.mutate({ missionType: missionType as any });
    } else {
      // diet: 카카오채널로 인증 사진 전송 안내
      submitMutation.mutate({ missionType: missionType as any });
      window.open(KAKAO_CHAT_URL, "_blank");
    }
  }

  const currentWindow = data.currentWindow;

  return (
    <div className="p-4 space-y-4 pb-8">
      {/* 미션 안내 */}
      <MissionGuideCard />

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
                   currentWindow.submission.status === "pending" ? "기록완료" : "미달성"}
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
                <div className="pt-3 space-y-1.5">
                  <p className="text-xs font-semibold text-gray-700">📋 출석 미션 인증 방법</p>
                  <p className="text-xs text-gray-600">① <strong>매월 1~7일</strong> 사이에 헬스장 <strong>3층 키오스크</strong>에서 <strong>[영상 운동]</strong>을 선택하세요.</p>
                  <p className="text-xs text-gray-600">② 체크인 후 수업이 끝나면 다시 체크인하여 종료해 주세요. <strong>30분 이상</strong>이어야 출석으로 인정됩니다.</p>
                  <p className="text-xs text-gray-600">③ 아래 버튼을 누르면 이번 달 출석 횟수를 <strong>자동으로 확인</strong>해 달성 여부를 알려드립니다. (4일 이상 시 달성)</p>
                </div>
              )}
              {currentWindow.type === "cardio" && (
                <div className="pt-3 space-y-1.5">
                  <p className="text-xs font-semibold text-gray-700">📋 유산소 미션 인증 방법</p>
                  <p className="text-xs text-gray-600">① <strong>매월 8~14일</strong> 사이에 헬스장 <strong>3층 키오스크</strong>에서 <strong>[유산소 운동]</strong>을 선택하세요.</p>
                  <p className="text-xs text-gray-600">② 러닝머신·자전거 등 유산소 운동 후 다시 체크인하여 종료해 주세요. <strong>30분 이상</strong>이어야 인정됩니다.</p>
                  <p className="text-xs text-gray-600">③ 아래 버튼을 누르면 이번 달 유산소 운동 횟수를 자동으로 확인합니다. (2회 이상 시 달성)</p>
                </div>
              )}
              {currentWindow.type === "diet" && (
                <div className="pt-3 space-y-1.5">
                  <p className="text-xs font-semibold text-gray-700">📋 식단 미션 인증 방법</p>
                  <p className="text-xs text-gray-600">① 이번 달 15~24일 사이에 단백질 위주 식단 사진을 찍어두세요.</p>
                  <p className="text-xs text-gray-600">② 아래 버튼을 눌러 <strong>카카오채널</strong>로 이동한 뒤, 식단 사진을 전송해 주세요.</p>
                  <p className="text-xs text-gray-600">③ 담당 트레이너 확인 후 미션이 승인됩니다.</p>
                  <p className="text-[11px] text-amber-600">⚠️ 사진 전송 없이는 미션이 승인되지 않습니다.</p>
                </div>
              )}
              {currentWindow.type === "inbody" && (
                <div className="pt-3 space-y-2">
                  <p className="text-xs font-semibold text-gray-700">📋 인바디 미션 인증 방법</p>
                  <p className="text-xs text-gray-600">① <strong>매월 25일~말일</strong> 사이에 데스크에서 인바디를 측정하고 결과지 사진을 찍어두세요.</p>
                  <p className="text-xs text-gray-600">② 아래에 현재 체중을 입력하세요.</p>
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
                  <p className="text-xs text-gray-600">③ 버튼을 누르면 체중이 저장되고 카카오채널로 이동합니다. 인바디 결과지 사진을 전송해 주세요.</p>
                  <p className="text-[11px] text-amber-600">💡 시작 체중 대비 감량 기준 달성 시 헬스권 1개월이 자동 연장됩니다.</p>
                </div>
              )}
              <button
                onClick={() => handleSubmit(currentWindow.type, currentWindow.periodKey)}
                disabled={submitMutation.isPending || logWeightMutation.isPending ||
                  (currentWindow.type === "inbody" && (!weightInput || parseFloat(weightInput) < 20))}
                className="w-full py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50"
                style={{
                  background: currentWindow.type === "attendance" || currentWindow.type === "cardio" ? "hsl(221 83% 44%)" : "#FEE500",
                  color: currentWindow.type === "attendance" || currentWindow.type === "cardio" ? "white" : "#3A1D1D",
                }}
              >
                {(submitMutation.isPending || logWeightMutation.isPending) ? "처리 중..." :
                  currentWindow.type === "attendance" ? "출석 확인하기" :
                  currentWindow.type === "cardio" ? "유산소 기록 확인하기" :
                  currentWindow.type === "inbody" ? "체중 저장 + 카카오 인증 💬" :
                  "카카오로 식단 인증하기 💬"}
              </button>
            </div>
          )}
        </div>
      )}

      {errorMsg && (
        <div className="rounded-2xl p-4 text-sm font-medium bg-red-50 text-red-700 border border-red-200 flex items-start gap-2">
          <span className="shrink-0">⚠️</span>
          <div className="flex-1">
            <p>{errorMsg}</p>
            <p className="text-[11px] text-red-500 mt-1">문제가 계속되면 데스크에 문의해 주세요.</p>
          </div>
          <button onClick={() => setErrorMsg(null)} className="shrink-0 text-red-400 text-xs">닫기</button>
        </div>
      )}

      {resultMsg && (
        <div className={`rounded-2xl p-4 text-sm font-medium space-y-1 ${
          resultMsg.status === "approved" ? "bg-green-50 text-green-700 border border-green-200" :
          resultMsg.status === "rejected" ? "bg-red-50 text-red-700 border border-red-200" :
          "bg-blue-50 text-blue-700 border border-blue-200"
        }`}>
          {resultMsg.status === "approved" && <p>✅ 미션 달성! 수고하셨습니다.</p>}
          {resultMsg.status === "rejected" && (
            activePeriodKey?.includes("cardio")
              ? <p>❌ 이번 달 8~14일 유산소운동 기록이 2회 미만입니다. 운동탭에서 유산소운동을 기록해 주세요.</p>
              : <p>❌ 출석 4일 미만입니다. 다음 달에 다시 도전해 주세요.</p>
          )}
          {resultMsg.status === "pending" && <p>📋 카카오채널로 인증사진을 보내주세요. 확인 후 승인됩니다.</p>}
          {resultMsg.rewarded && resultMsg.extensionUntil && (
            <p className="font-bold">🎉 감량 달성! 헬스권이 {resultMsg.extensionUntil}까지 1개월 연장되었습니다.</p>
          )}
          {resultMsg.rewarded && resultMsg.syncFailed && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 mt-1">
              ⚠️ 회원 정보 연결이 확인되지 않아 데스크 확인이 필요합니다. 방문 시 직원에게 알려주세요.
            </p>
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
              else if (sub?.status === "pending") { statusColor = "#f59e0b"; statusLabel = "기록완료"; }
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
