export interface ExerciseStat {
  name: string;
  sessions: number;
  first: { weight: number; reps: number; sets: number } | null;
  last: { weight: number; reps: number; sets: number } | null;
  trend: "up" | "down" | "stable" | "insufficient";
  changePercent?: number;
}

export interface PTReportData {
  generatedAt: string;
  isAI: boolean;
  member: { name: string; trainerName?: string };
  program: {
    packageName: string;
    totalSessions: number;
    usedSessions: number;
    startDate?: string;
    reportIndex: number;
    milestoneSession: number;
    fromSession: number;
    goal?: string;
  };
  periodStats: {
    sessionCount: number;
    fromDate?: string;
    toDate?: string;
    avgCondition: number | null;
    avgSleep: number | null;
    avgPain: number | null;
    attendanceRate: number;
  };
  prevStats: {
    avgCondition: number | null;
    avgPain: number | null;
    avgSleep: number | null;
    sessionCount: number;
  } | null;
  exercises: ExerciseStat[];
  bodyParts: string[];
  feedbacks: string[];
  painAreas: string[];
}

function trendArrow(t: ExerciseStat["trend"], pct?: number) {
  if (t === "insufficient") return `<span style="color:#94a3b8">기록부족</span>`;
  if (t === "up") return `<span style="color:#16a34a;font-weight:700">↑${pct ? ` ${pct}%` : ""}</span>`;
  if (t === "down") return `<span style="color:#dc2626;font-weight:700">↓${pct ? ` ${pct}%` : ""}</span>`;
  return `<span style="color:#64748b">→ 유지</span>`;
}

function delta(now: number | null, prev: number | null, unit = "", lowerBetter = false) {
  if (now == null) return `<span style="color:#94a3b8">-</span>`;
  if (prev == null) return `<strong>${now}${unit}</strong>`;
  const d = now - prev;
  if (Math.abs(d) < 0.05) return `<strong>${now}${unit}</strong> <span style="color:#64748b;font-size:11px">→ 유지</span>`;
  const better = lowerBetter ? d < 0 : d > 0;
  const color = better ? "#16a34a" : "#dc2626";
  const sign = d > 0 ? "+" : "";
  return `<strong>${now}${unit}</strong> <span style="color:${color};font-size:11px">${sign}${d.toFixed(1)}${unit}</span>`;
}

function sectionTitle(text: string) {
  return `<div style="font-size:15px;font-weight:700;color:#1a56db;border-bottom:2px solid #e8f0fe;padding-bottom:10px;margin-bottom:16px">${text}</div>`;
}

function aiBlock(text: string): string {
  return text
    .split(/(\*\*[^*]+\*\*)/)
    .map(part =>
      part.startsWith("**") && part.endsWith("**")
        ? `<div style="font-size:15px;font-weight:700;color:#1a56db;margin-top:20px;margin-bottom:8px;padding-left:8px;border-left:3px solid #1a56db">${part.slice(2, -2)}</div>`
        : `<p style="font-size:14px;color:#334155;line-height:1.85;margin-bottom:6px">${part.trim()}</p>`
    )
    .join("");
}

export function generatePTReportHTML(data: PTReportData, aiText: string): string {
  const { member, program, periodStats, prevStats, exercises, bodyParts, feedbacks } = data;
  const reportLabel = `보고서 ${program.reportIndex} (${program.fromSession}회차 ~ ${program.milestoneSession}회차)`;
  const overallProg = Math.round((program.usedSessions / program.totalSessions) * 100);

  // Exercise table
  const topExercises = exercises.slice(0, 10);

  const exRows = topExercises.map(ex => {
    const firstStr = ex.first ? `${ex.first.weight}kg × ${ex.first.reps}회 × ${ex.first.sets}세트` : "-";
    const lastStr = ex.last ? `${ex.last.weight}kg × ${ex.last.reps}회 × ${ex.last.sets}세트` : "-";
    return `<tr>
      <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;font-weight:600;color:#1e293b">${ex.name}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;color:#64748b;font-size:13px">${firstStr}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;font-size:13px">${lastStr}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;text-align:center">${trendArrow(ex.trend, ex.changePercent)}</td>
    </tr>`;
  }).join("");

  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>PT 변화 리포트 · ${member.name} · ${reportLabel}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Noto Sans KR',-apple-system,sans-serif;background:#f0f4f8;color:#1a202c;line-height:1.6}
.page{max-width:860px;margin:0 auto;padding:24px}
table{width:100%;border-collapse:collapse}
th{background:#f8fafc;padding:10px 12px;text-align:left;font-weight:600;color:#64748b;border-bottom:1px solid #e2e8f0;font-size:13px}
.card{background:#fff;border-radius:14px;padding:24px;margin-bottom:20px;box-shadow:0 1px 4px rgba(0,0,0,.07)}
@media print{body{background:#fff}.page{padding:0}.no-print{display:none}.card{box-shadow:none;break-inside:avoid}}
</style>
</head>
<body>
<div class="page">

<!-- ── 헤더 ── -->
<div style="background:linear-gradient(135deg,#1a56db 0%,#0369a1 100%);color:#fff;border-radius:16px;padding:28px 32px;margin-bottom:20px">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px">
    <div>
      <div style="font-size:11px;opacity:.7;letter-spacing:1px;margin-bottom:6px">ZIANTGYM · PT 변화 리포트</div>
      <div style="font-size:26px;font-weight:700">${member.name} 회원님</div>
      <div style="margin-top:6px;font-size:14px;opacity:.85">${program.packageName}${member.trainerName ? ` · 담당 ${member.trainerName} 트레이너` : ""}</div>
      <div style="margin-top:4px;font-size:13px;opacity:.75">${reportLabel}</div>
    </div>
    <div style="text-align:right">
      <div style="font-size:11px;opacity:.7">생성일</div>
      <div style="font-size:15px;font-weight:600;margin-top:4px">${data.generatedAt}</div>
      <div style="margin-top:10px;background:rgba(255,255,255,.2);padding:5px 14px;border-radius:20px;font-size:11px;display:inline-block">${data.isAI ? "✨ AI 분석" : "자동 분석"}</div>
    </div>
  </div>
  <!-- 진행률 -->
  <div style="margin-top:20px">
    <div style="display:flex;justify-content:space-between;font-size:12px;opacity:.8;margin-bottom:6px">
      <span>전체 진행률</span>
      <span>${program.usedSessions} / ${program.totalSessions}회 (${overallProg}%)</span>
    </div>
    <div style="background:rgba(255,255,255,.25);border-radius:6px;height:8px">
      <div style="background:#fff;height:8px;border-radius:6px;width:${overallProg}%"></div>
    </div>
    <div style="display:flex;justify-content:space-between;font-size:11px;opacity:.6;margin-top:4px">
      <span>${periodStats.fromDate ?? ""}</span>
      <span>${periodStats.toDate ?? ""}</span>
    </div>
  </div>
</div>

<!-- ── 핵심 지표 ── -->
<div class="card">
  ${sectionTitle("📊 이번 구간 핵심 지표")}
  <div style="overflow-x:auto">
    <table>
      <thead><tr>
        <th>항목</th>
        <th>이번 구간</th>
        ${prevStats ? "<th>이전 대비</th>" : ""}
        <th>참고</th>
      </tr></thead>
      <tbody>
        <tr>
          <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;font-weight:600">출석률</td>
          <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9"><strong>${periodStats.sessionCount}회 / ${program.milestoneSession - program.fromSession + 1}회 예정</strong></td>
          ${prevStats ? `<td style="padding:10px 12px;border-bottom:1px solid #f1f5f9"><span style="color:#64748b;font-size:12px">이전 ${prevStats.sessionCount}회</span></td>` : ""}
          <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;font-size:12px;color:#94a3b8">${periodStats.attendanceRate >= 90 ? "🌟 우수" : periodStats.attendanceRate >= 75 ? "✅ 양호" : "⚠️ 관리필요"}</td>
        </tr>
        <tr>
          <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;font-weight:600">컨디션 평균</td>
          <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9">${delta(periodStats.avgCondition, prevStats?.avgCondition ?? null, "/10")}</td>
          ${prevStats ? `<td style="padding:10px 12px;border-bottom:1px solid #f1f5f9"><span style="color:#64748b;font-size:12px">${prevStats.avgCondition != null ? `이전 ${prevStats.avgCondition}/10` : "-"}</span></td>` : ""}
          <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;font-size:12px;color:#94a3b8">7 이상 양호</td>
        </tr>
        <tr>
          <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;font-weight:600">통증 평균</td>
          <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9">${delta(periodStats.avgPain, prevStats?.avgPain ?? null, "/10", true)}</td>
          ${prevStats ? `<td style="padding:10px 12px;border-bottom:1px solid #f1f5f9"><span style="color:#64748b;font-size:12px">${prevStats.avgPain != null ? `이전 ${prevStats.avgPain}/10` : "-"}</span></td>` : ""}
          <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;font-size:12px;color:#94a3b8">낮을수록 좋음</td>
        </tr>
        <tr>
          <td style="padding:10px 12px;border-bottom:none;font-weight:600">수면 평균</td>
          <td style="padding:10px 12px;border-bottom:none">${delta(periodStats.avgSleep, prevStats?.avgSleep ?? null, "h")}</td>
          ${prevStats ? `<td style="padding:10px 12px;border-bottom:none"><span style="color:#64748b;font-size:12px">${prevStats.avgSleep != null ? `이전 ${prevStats.avgSleep}h` : "-"}</span></td>` : ""}
          <td style="padding:10px 12px;border-bottom:none;font-size:12px;color:#94a3b8">7h 이상 권장</td>
        </tr>
      </tbody>
    </table>
  </div>
  ${data.painAreas.length > 0 ? `
  <div style="margin-top:14px;padding:10px 14px;background:#fff7ed;border:1px solid #fed7aa;border-radius:8px">
    <span style="font-size:12px;color:#c2410c;font-weight:600">⚠️ 주요 불편 부위: </span>
    <span style="font-size:12px;color:#92400e">${data.painAreas.join(", ")}</span>
  </div>` : ""}
</div>

<!-- ── 운동 수행 변화 ── -->
${topExercises.length > 0 ? `
<div class="card">
  ${sectionTitle("💪 운동 수행 변화 (주요 종목)")}
  <div style="overflow-x:auto">
    <table>
      <thead><tr>
        <th>운동 종목</th>
        <th>초기 기록</th>
        <th>현재 기록</th>
        <th style="text-align:center">변화</th>
      </tr></thead>
      <tbody>${exRows}</tbody>
    </table>
  </div>
  ${bodyParts.length > 0 ? `
  <div style="margin-top:14px">
    <div style="font-size:12px;color:#64748b;font-weight:600;margin-bottom:8px">주요 운동 부위</div>
    <div>${bodyParts.map(p => `<span style="display:inline-block;background:#eff6ff;color:#1a56db;border:1px solid #bfdbfe;padding:3px 12px;border-radius:20px;font-size:12px;margin:2px">${p}</span>`).join("")}</div>
  </div>` : ""}
</div>` : ""}

<!-- ── AI 분석 ── -->
<div class="card" style="background:linear-gradient(135deg,#eff6ff 0%,#f0fdf4 100%);border:1px solid #bfdbfe">
  <div style="display:inline-flex;align-items:center;gap:6px;background:#1a56db;color:#fff;padding:5px 14px;border-radius:20px;font-size:12px;font-weight:600;margin-bottom:20px">${data.isAI ? "✨ AI 전문 분석" : "📄 자동 생성 보고서"}</div>
  <div>${aiBlock(aiText)}</div>
</div>

<!-- ── 프린트 버튼 ── -->
<div class="no-print" style="text-align:center;margin-bottom:24px">
  <button onclick="window.print()" style="background:#1a56db;color:#fff;border:none;padding:12px 32px;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit">🖨️ PDF로 저장</button>
</div>

<!-- ── 푸터 ── -->
<div style="text-align:center;font-size:11px;color:#94a3b8;padding:16px">
  ${member.name} 회원님 · ${program.packageName} · ${reportLabel}<br>
  본 리포트는 ${data.generatedAt} ZIANTGYM에서 생성되었습니다.
</div>

</div>
</body>
</html>`;
}
