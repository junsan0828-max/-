import { useState } from "react";
import { trpc } from "@/lib/trpc";

function formatDate(s: string) {
  return s ? s.slice(0, 10).replace(/-/g, ".") : "-";
}

function formatLocalDate(d: Date) {
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

function addMonths(y: number, m: number, d: number, add: number) {
  const abs = m + add;
  const ny = y + Math.floor(abs / 12);
  const nm = ((abs % 12) + 12) % 12;
  const lastDay = new Date(ny, nm + 1, 0).getDate();
  return new Date(ny, nm, Math.min(d, lastDay));
}

function getMonthProgress(programStartDate: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(programStartDate ?? "");
  if (!match) return [];
  const [, y, mo, d] = match.map(Number);
  const now = new Date();
  return [1, 2, 3].map((i) => {
    const periodStart = addMonths(y, mo - 1, d, i);
    const periodEnd = addMonths(y, mo - 1, d, i + 1);
    const status: "future" | "active" | "past" =
      now < periodStart ? "future" : now >= periodEnd ? "past" : "active";
    return { index: i, monthStart: periodStart, monthEnd: periodEnd, periodKey: `M${i}`, status };
  });
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

// ─── 미션 탭 ─────────────────────────────────────────────────────────────────

function MissionTab() {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.gymPlus.getMissionStatus.useQuery();
  const [weightInput, setWeightInput] = useState("");
  const [noteInput, setNoteInput] = useState("");
  const [rewardMsg, setRewardMsg] = useState<string | null>(null);

  const logWeightMutation = trpc.gymPlus.logWeight.useMutation({
    onSuccess: (result) => {
      setWeightInput("");
      setNoteInput("");
      utils.gymPlus.getMissionStatus.invalidate();
      utils.gymPlus.getDietProgramReport.invalidate();
      if (result.rewarded && "extensionUntil" in result) {
        setRewardMsg(`🎉 1개월 감량 달성! 헬스권이 ${result.extensionUntil}까지 연장되었습니다.`);
      } else {
        setRewardMsg(null);
      }
    },
  });

  if (isLoading) return <div className="p-5 text-center text-gray-400 text-sm">로딩 중...</div>;

  if (!data?.programName) {
    return (
      <div className="p-5 text-center">
        <p className="text-gray-400 text-sm">참여 중인 프로그램이 없습니다.</p>
      </div>
    );
  }

  const monthProgress = getMonthProgress(data.programStartDate!);
  const rewardKeys = new Set((data.rewards ?? []).map((r: any) => r.periodKey));
  const latestLog = data.weightLogs?.[0];
  const startLog = data.weightLogs?.[data.weightLogs.length - 1];
  const totalLoss = startLog && latestLog ? parseFloat((startLog.weight - latestLog.weight).toFixed(1)) : null;

  return (
    <div className="p-4 space-y-4 pb-8">
      {/* 현재 체중 요약 */}
      <div className="bg-white rounded-2xl shadow-sm p-4 flex gap-4">
        <div className="flex-1 text-center">
          <p className="text-xs text-gray-400">시작 체중</p>
          <p className="text-lg font-black text-gray-700">{startLog ? `${startLog.weight.toFixed(1)} kg` : "미기록"}</p>
        </div>
        <div className="w-px bg-gray-100" />
        <div className="flex-1 text-center">
          <p className="text-xs text-gray-400">현재 체중</p>
          <p className="text-lg font-black text-gray-700">{latestLog ? `${latestLog.weight.toFixed(1)} kg` : "미기록"}</p>
        </div>
        {totalLoss !== null && totalLoss > 0 && (
          <>
            <div className="w-px bg-gray-100" />
            <div className="flex-1 text-center">
              <p className="text-xs text-gray-400">총 감량</p>
              <p className="text-lg font-black text-green-600">-{totalLoss} kg</p>
            </div>
          </>
        )}
      </div>

      {/* 월별 미션 */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-50">
          <p className="text-sm font-bold text-gray-800">월별 미션</p>
          <p className="text-xs text-gray-400 mt-0.5">직전 달 대비 1kg 감량 시 헬스권 1개월 연장</p>
        </div>
        {monthProgress.map((m) => {
          const rewarded = rewardKeys.has(m.periodKey);
          return (
            <div key={m.index} className="px-4 py-3.5 flex items-center gap-3 border-b border-gray-50 last:border-0">
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
                style={{
                  background: rewarded ? "#22c55e" : m.status === "active" ? "hsl(221 83% 44%)" : "#e5e7eb",
                  color: m.status === "future" ? "#9ca3af" : "white",
                }}
              >
                {rewarded ? (
                  <svg viewBox="0 0 24 24" fill="none" strokeWidth={2.5} stroke="white" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                  </svg>
                ) : m.index}
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold" style={{ color: m.status === "future" ? "#d1d5db" : m.status === "active" ? "hsl(221 83% 44%)" : "#6b7280" }}>
                  {m.index}개월차
                  {m.status === "active" && <span className="ml-2 text-[10px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full">진행 중</span>}
                </p>
                <p className="text-[10px] text-gray-400">{formatLocalDate(m.monthStart)} ~ {formatLocalDate(m.monthEnd)}</p>
              </div>
              <span className={`text-xs font-medium ${rewarded ? "text-green-600" : m.status === "past" ? "text-gray-400" : m.status === "active" ? "text-blue-500" : "text-gray-300"}`}>
                {rewarded ? "+1개월 🎉" : m.status === "past" ? "미달성" : m.status === "active" ? "기록 필요" : "—"}
              </span>
            </div>
          );
        })}
      </div>

      {rewardMsg && (
        <div className="bg-green-50 border border-green-200 rounded-2xl p-4 text-sm text-green-700 font-medium">{rewardMsg}</div>
      )}

      {/* 체중 기록 */}
      <div className="bg-white rounded-2xl shadow-sm p-4">
        <p className="text-sm font-bold text-gray-800 mb-3">체중 기록</p>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <input
              type="number" step="0.1" min="20" max="300"
              value={weightInput}
              onChange={(e) => setWeightInput(e.target.value)}
              placeholder="체중 입력 (kg)"
              className="flex-1 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
            <span className="text-sm text-gray-500 font-medium">kg</span>
          </div>
          <input
            type="text"
            value={noteInput}
            onChange={(e) => setNoteInput(e.target.value)}
            placeholder="메모 (선택)"
            maxLength={100}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
          />
          <button
            onClick={() => {
              const w = parseFloat(weightInput);
              if (!isNaN(w) && w >= 20 && w <= 300) {
                logWeightMutation.mutate({ weight: w, note: noteInput });
              }
            }}
            disabled={logWeightMutation.isPending || !weightInput}
            className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-opacity disabled:opacity-50"
            style={{ background: "hsl(221 83% 44%)" }}
          >
            {logWeightMutation.isPending ? "저장 중..." : "체중 기록하기"}
          </button>
        </div>
      </div>

      {/* 체중 이력 */}
      {(data.weightLogs?.length ?? 0) > 0 && (
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-50">
            <p className="text-sm font-bold text-gray-800">체중 기록 내역</p>
          </div>
          <div className="divide-y divide-gray-50">
            {data.weightLogs!.map((log: any) => (
              <div key={log.id} className="px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-800">{log.weight.toFixed(1)} kg</p>
                  {log.note && <p className="text-xs text-gray-400">{log.note}</p>}
                </div>
                <p className="text-xs text-gray-400">{formatDate(log.loggedAt)}</p>
              </div>
            ))}
          </div>
        </div>
      )}
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
