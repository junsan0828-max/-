import { useState } from "react";
import { trpc } from "@/lib/trpc";

function formatDate(iso: string) {
  if (!iso) return "-";
  return iso.slice(0, 10).replace(/-/g, ".");
}

function formatWeight(w: number | null) {
  if (w === null || w === undefined) return "-";
  return w.toFixed(1) + " kg";
}

function getMonthProgress(programStartDate: string) {
  if (!programStartDate) return [];
  const start = new Date(programStartDate);
  const now = new Date();
  const months = [];
  for (let i = 0; i < 3; i++) {
    const monthStart = new Date(start.getFullYear(), start.getMonth() + i, start.getDate());
    const monthEnd = new Date(start.getFullYear(), start.getMonth() + i + 1, start.getDate());
    const periodKey = new Date(start.getFullYear(), start.getMonth() + i, 15).toISOString().slice(0, 7);
    const status: "future" | "active" | "past" =
      now < monthStart ? "future" : now >= monthEnd ? "past" : "active";
    months.push({ index: i + 1, monthStart, monthEnd, periodKey, status });
  }
  return months;
}

export default function GymPlusMissions() {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.gymPlus.getMissionStatus.useQuery();
  const [weightInput, setWeightInput] = useState("");
  const [noteInput, setNoteInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [rewardMsg, setRewardMsg] = useState<string | null>(null);

  const logWeightMutation = trpc.gymPlus.logWeight.useMutation({
    onSuccess: (result) => {
      setWeightInput("");
      setNoteInput("");
      setSubmitting(false);
      utils.gymPlus.getMissionStatus.invalidate();
      if (result.rewarded && "extensionUntil" in result) {
        setRewardMsg(`🎉 축하합니다! 1개월 감량 달성! 헬스권이 ${result.extensionUntil}까지 연장되었습니다.`);
      } else {
        setRewardMsg(null);
      }
    },
    onError: () => setSubmitting(false),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <p className="text-gray-400 text-sm">로딩 중...</p>
      </div>
    );
  }

  if (!data?.programName) {
    return (
      <div className="p-5">
        <div className="bg-white rounded-2xl p-8 text-center shadow-sm">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.5} stroke="#9ca3af" className="w-8 h-8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 0 1 3 3h-15a3 3 0 0 1 3-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 0 1-.982-3.172M9.497 14.25a7.454 7.454 0 0 0 .981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 0 0 7.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 0 0 2.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 0 1 2.916.52 6.003 6.003 0 0 1-5.395 4.972m0 0a6.726 6.726 0 0 1-2.749 1.35m0 0a6.772 6.772 0 0 1-3.044 0" />
            </svg>
          </div>
          <p className="text-gray-700 font-semibold mb-1">현재 참여 중인 프로그램이 없습니다</p>
          <p className="text-gray-400 text-sm">담당 트레이너에게 문의해주세요.</p>
        </div>
      </div>
    );
  }

  const monthProgress = getMonthProgress(data.programStartDate!);
  const rewardKeys = new Set((data.rewards ?? []).map((r: any) => r.periodKey));
  const latestLog = data.weightLogs?.[0];
  const startLog = data.weightLogs?.[data.weightLogs.length - 1];
  const totalLoss = startLog && latestLog ? parseFloat((startLog.weight - latestLog.weight).toFixed(1)) : null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const w = parseFloat(weightInput);
    if (isNaN(w) || w < 20 || w > 300) return;
    setSubmitting(true);
    setRewardMsg(null);
    logWeightMutation.mutate({ weight: w, note: noteInput });
  };

  return (
    <div className="p-4 space-y-4 pb-8">
      {/* 프로그램 배너 */}
      <div
        className="rounded-2xl p-5 text-white"
        style={{ background: "linear-gradient(135deg, hsl(221 83% 44%), hsl(221 83% 30%))" }}
      >
        <p className="text-xs font-medium opacity-75 mb-1">참여 프로그램</p>
        <p className="text-lg font-bold mb-3">{data.programName}</p>
        <div className="flex items-center gap-4 text-sm">
          <div>
            <p className="opacity-70 text-xs">시작일</p>
            <p className="font-semibold">{formatDate(data.programStartDate!)}</p>
          </div>
          {totalLoss !== null && totalLoss > 0 && (
            <div>
              <p className="opacity-70 text-xs">총 감량</p>
              <p className="font-semibold text-green-300">-{totalLoss} kg</p>
            </div>
          )}
          <div className="ml-auto">
            <p className="opacity-70 text-xs">현재 체중</p>
            <p className="font-semibold">{latestLog ? formatWeight(latestLog.weight) : "미기록"}</p>
          </div>
        </div>
      </div>

      {/* 월별 미션 현황 */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-50">
          <p className="text-sm font-bold text-gray-800">월별 미션 달성 현황</p>
          <p className="text-xs text-gray-400 mt-0.5">매월 1kg 감량 시 헬스권 1개월 연장</p>
        </div>
        {monthProgress.map((m) => {
          const rewarded = rewardKeys.has(m.periodKey);
          const statusColor =
            m.status === "future" ? "#d1d5db" :
            m.status === "active" ? "hsl(221 83% 44%)" : "#6b7280";
          return (
            <div key={m.index} className="px-5 py-4 flex items-center gap-4 border-b border-gray-50 last:border-0">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
                style={{ background: rewarded ? "#22c55e" : m.status === "active" ? "hsl(221 83% 44%)" : "#e5e7eb", color: m.status === "future" ? "#9ca3af" : "white" }}
              >
                {rewarded ? (
                  <svg viewBox="0 0 24 24" fill="none" strokeWidth={2.5} stroke="white" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                  </svg>
                ) : (
                  m.index
                )}
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold" style={{ color: statusColor }}>
                  {m.index}개월차
                  {m.status === "active" && <span className="ml-2 text-xs bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full">진행 중</span>}
                </p>
                <p className="text-xs text-gray-400">
                  {formatDate(m.monthStart.toISOString())} ~ {formatDate(m.monthEnd.toISOString())}
                </p>
              </div>
              <div className="text-right">
                {rewarded ? (
                  <span className="text-xs text-green-600 font-semibold">+1개월 달성 🎉</span>
                ) : m.status === "past" ? (
                  <span className="text-xs text-gray-400">미달성</span>
                ) : m.status === "active" ? (
                  <span className="text-xs text-blue-500">체중 기록 필요</span>
                ) : (
                  <span className="text-xs text-gray-300">-</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 보상 안내 */}
      {rewardMsg && (
        <div className="bg-green-50 border border-green-200 rounded-2xl p-4 text-sm text-green-700 font-medium">
          {rewardMsg}
        </div>
      )}

      {/* 체중 기록 폼 */}
      <div className="bg-white rounded-2xl shadow-sm p-5">
        <p className="text-sm font-bold text-gray-800 mb-3">오늘 체중 기록</p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="flex items-center gap-2">
            <input
              type="number"
              step="0.1"
              min="20"
              max="300"
              value={weightInput}
              onChange={(e) => setWeightInput(e.target.value)}
              placeholder="체중 입력 (kg)"
              className="flex-1 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
              required
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
            type="submit"
            disabled={submitting || !weightInput}
            className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-opacity disabled:opacity-50"
            style={{ background: "hsl(221 83% 44%)" }}
          >
            {submitting ? "저장 중..." : "체중 기록하기"}
          </button>
        </form>
      </div>

      {/* 체중 기록 히스토리 */}
      {(data.weightLogs?.length ?? 0) > 0 && (
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-50">
            <p className="text-sm font-bold text-gray-800">체중 기록 내역</p>
          </div>
          <div className="divide-y divide-gray-50">
            {data.weightLogs!.map((log: any) => (
              <div key={log.id} className="px-5 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-800">{formatWeight(log.weight)}</p>
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
