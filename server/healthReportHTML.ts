export interface LifestyleCategory {
  items: string[];
  count: number;
  riskLevel: "normal" | "caution" | "warning" | "critical";
  riskKo: string;
}

export interface ReportData {
  generatedAt: string;
  isAI: boolean;
  member: { name: string; age?: number; gender?: string };
  health: {
    height?: string; weight?: string; bmi?: string;
    occupation?: string; workEnvironment?: string; exerciseExperience?: string;
    goals: string[];
    systolicBp?: string; diastolicBp?: string;
    waistCircumference?: string;
    totalCholesterol?: string; hdlCholesterol?: string;
    ldlCholesterol?: string; triglycerides?: string;
    fastingBloodSugar?: string; postMealBloodSugar?: string;
    hba1c?: string; boneDensity?: string;
    chronicDiseases?: string; musculoskeletalIssues?: string;
    posturalIssues?: string;
  };
  lifestyle: {
    diet: LifestyleCategory;
    alcohol: LifestyleCategory;
    sleep: LifestyleCategory;
    activity: LifestyleCategory;
  };
  training: {
    totalSessions: number;
    topBodyParts: string[];
    goals: string[];
    avgCondition: number | null;
    avgPain: number | null;
    checksCount: number;
  };
}

const RISK_STYLE: Record<string, { bg: string; color: string; border: string; icon: string }> = {
  normal:   { bg: "#dcfce7", color: "#15803d", border: "#86efac", icon: "✅" },
  caution:  { bg: "#fef9c3", color: "#a16207", border: "#fde68a", icon: "⚠️" },
  warning:  { bg: "#ffedd5", color: "#c2410c", border: "#fdba74", icon: "🔶" },
  critical: { bg: "#fee2e2", color: "#b91c1c", border: "#fca5a5", icon: "🚨" },
};

function badge(level: string, text: string) {
  const s = RISK_STYLE[level] ?? RISK_STYLE.normal;
  return `<span style="display:inline-flex;align-items:center;gap:4px;background:${s.bg};color:${s.color};border:1px solid ${s.border};padding:3px 12px;border-radius:20px;font-size:12px;font-weight:700">${s.icon} ${text}</span>`;
}

function val(v: string | undefined, unit = "") {
  if (!v || v === "이상없음" || v === "-") return `<span style="color:#94a3b8">${v === "이상없음" ? "이상없음" : "-"}</span>`;
  return `<strong>${v}</strong>${unit ? `<span style="color:#94a3b8;font-size:12px;margin-left:2px">${unit}</span>` : ""}`;
}

function row(label: string, value: string) {
  return `<tr><th style="background:#f8fafc;padding:10px 14px;text-align:left;font-weight:600;color:#64748b;border-bottom:1px solid #e2e8f0;width:40%;font-size:13px">${label}</th><td style="padding:10px 14px;border-bottom:1px solid #f1f5f9;color:#334155;font-size:13px">${value}</td></tr>`;
}

function lifestyleCard(title: string, cat: LifestyleCategory) {
  const s = RISK_STYLE[cat.riskLevel];
  const itemsHtml = cat.items.length === 0
    ? `<div style="color:#94a3b8;font-size:12px;margin-top:8px">해당 없음</div>`
    : `<ul style="list-style:none;margin-top:8px">${cat.items.map(i =>
        `<li style="font-size:12px;color:#334155;padding:3px 0;display:flex;align-items:flex-start;gap:5px"><span style="color:#ef4444;flex-shrink:0;margin-top:1px">✓</span><span>${i}</span></li>`
      ).join("")}</ul>`;
  return `<div style="border:1px solid ${s.border};border-radius:10px;padding:14px;background:${s.bg}08">
    <div style="display:flex;justify-content:space-between;align-items:center">
      <span style="font-size:13px;font-weight:700;color:#1e293b">${title}</span>
      ${badge(cat.riskLevel, cat.riskKo)}
    </div>
    <div style="font-size:11px;color:#64748b;margin-top:4px">${cat.count}/4 항목 해당</div>
    ${itemsHtml}
  </div>`;
}

function aiTextToHTML(text: string): string {
  return text
    .split(/(\*\*[^*]+\*\*)/)
    .map(part =>
      part.startsWith("**") && part.endsWith("**")
        ? `<div style="font-size:15px;font-weight:700;color:#1a56db;margin-top:18px;margin-bottom:6px">${part.slice(2, -2)}</div>`
        : `<span>${part}</span>`
    )
    .join("");
}

export function generateHealthReportHTML(data: ReportData, aiText: string): string {
  const { member, health, lifestyle, training } = data;
  const bmiNote = health.bmi ? ` (BMI ${health.bmi})` : "";
  const overallRisk = [lifestyle.diet.riskLevel, lifestyle.alcohol.riskLevel, lifestyle.sleep.riskLevel, lifestyle.activity.riskLevel];
  const criticalCount = overallRisk.filter(r => r === "critical").length;
  const warningCount = overallRisk.filter(r => r === "warning" || r === "critical").length;
  const summaryRisk = criticalCount >= 2 ? "critical" : warningCount >= 2 ? "warning" : overallRisk.includes("caution") ? "caution" : "normal";
  const summaryText = { normal: "전반적으로 양호", caution: "일부 관리 필요", warning: "개선 필요", critical: "즉각 관리 필요" }[summaryRisk];

  const hasHealthData = health.height || health.weight || health.systolicBp;
  const hasMeasurements = health.systolicBp || health.waistCircumference || health.fastingBloodSugar || health.hba1c;

  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>건강 보고서 · ${member.name}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Noto Sans KR',-apple-system,sans-serif;background:#f0f4f8;color:#1a202c;line-height:1.6}
.page{max-width:820px;margin:0 auto;padding:24px}
table{width:100%;border-collapse:collapse}
@media print{body{background:#fff}.page{padding:0}.no-print{display:none}section{break-inside:avoid}}
</style>
</head>
<body>
<div class="page">

<!-- ── 헤더 ── -->
<div style="background:linear-gradient(135deg,#1a56db 0%,#0284c7 100%);color:#fff;border-radius:16px;padding:28px 32px;margin-bottom:20px;display:flex;justify-content:space-between;align-items:flex-start">
  <div>
    <div style="font-size:12px;opacity:.75;margin-bottom:6px;letter-spacing:1px">ZIANTGYM · 건강 보고서</div>
    <div style="font-size:26px;font-weight:700">${member.name} 회원님</div>
    ${member.age ? `<div style="margin-top:6px;font-size:14px;opacity:.85">${member.age}세${member.gender === "male" ? " · 남성" : member.gender === "female" ? " · 여성" : ""}</div>` : ""}
  </div>
  <div style="text-align:right">
    <div style="font-size:11px;opacity:.7">보고서 생성일</div>
    <div style="font-size:15px;font-weight:600;margin-top:4px">${data.generatedAt}</div>
    <div style="margin-top:10px;background:rgba(255,255,255,.2);padding:5px 12px;border-radius:20px;font-size:11px;display:inline-block">${data.isAI ? "✨ AI 분석" : "자동 분석"}</div>
  </div>
</div>

<!-- ── 종합 위험도 요약 ── -->
<div style="background:#fff;border-radius:12px;padding:20px 24px;margin-bottom:16px;box-shadow:0 1px 3px rgba(0,0,0,.07);display:flex;align-items:center;gap:20px">
  <div style="flex:1">
    <div style="font-size:13px;color:#64748b;margin-bottom:6px;font-weight:600">종합 생활습관 위험도</div>
    ${badge(summaryRisk, summaryText)}
  </div>
  <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;flex:3">
    ${[
      ["식단", lifestyle.diet],
      ["음주", lifestyle.alcohol],
      ["수면", lifestyle.sleep],
      ["활동", lifestyle.activity],
    ].map(([label, cat]) => {
      const c = cat as LifestyleCategory;
      const s = RISK_STYLE[c.riskLevel];
      return `<div style="text-align:center;padding:10px 6px;border:1px solid ${s.border};border-radius:8px;background:${s.bg}20">
        <div style="font-size:11px;color:#64748b;margin-bottom:4px">${label}</div>
        <div style="font-size:13px;font-weight:700;color:${s.color}">${c.riskKo.replace("건강관리 필요","관리필요").replace("빠른 건강관리 필요","빠른관리").replace("건강 필수 심각 수준","심각")}</div>
        <div style="font-size:10px;color:#94a3b8;margin-top:2px">${c.count}/4</div>
      </div>`;
    }).join("")}
  </div>
</div>

<!-- ── 기본 건강 정보 ── -->
${hasHealthData ? `
<div style="background:#fff;border-radius:12px;padding:24px;margin-bottom:16px;box-shadow:0 1px 3px rgba(0,0,0,.07)">
  <div style="font-size:15px;font-weight:700;color:#1a56db;border-bottom:2px solid #e8f0fe;padding-bottom:10px;margin-bottom:16px">📋 기본 건강 정보</div>
  <table>
    ${health.height || health.weight ? row("신체 정보", `${health.height ? `키 ${health.height}cm` : ""}${health.height && health.weight ? " · " : ""}${health.weight ? `체중 ${health.weight}kg` : ""}${bmiNote}`) : ""}
    ${health.occupation ? row("직업", health.occupation) : ""}
    ${health.workEnvironment ? row("근무 환경", health.workEnvironment) : ""}
    ${health.exerciseExperience ? row("운동 경험", health.exerciseExperience) : ""}
    ${health.goals.length > 0 ? row("운동 목적", health.goals.map(g => `<span style="display:inline-block;background:#eff6ff;color:#1a56db;border:1px solid #bfdbfe;padding:2px 10px;border-radius:20px;font-size:12px;margin:2px">${g}</span>`).join("")) : ""}
    ${health.chronicDiseases && health.chronicDiseases !== "없음" && health.chronicDiseases !== "해당 사항 없음" ? row("병원 진단", `<span style="color:#dc2626;font-weight:600">${health.chronicDiseases.split(",").join(", ")}</span>`) : ""}
  </table>
</div>` : ""}

<!-- ── 생활습관 분석 ── -->
<div style="background:#fff;border-radius:12px;padding:24px;margin-bottom:16px;box-shadow:0 1px 3px rgba(0,0,0,.07)">
  <div style="font-size:15px;font-weight:700;color:#1a56db;border-bottom:2px solid #e8f0fe;padding-bottom:10px;margin-bottom:16px">🏃 생활습관 분석</div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
    ${lifestyleCard("식단", lifestyle.diet)}
    ${lifestyleCard("음주", lifestyle.alcohol)}
    ${lifestyleCard("수면", lifestyle.sleep)}
    ${lifestyleCard("활동량", lifestyle.activity)}
  </div>
</div>

<!-- ── 건강 수치 ── -->
${hasMeasurements ? `
<div style="background:#fff;border-radius:12px;padding:24px;margin-bottom:16px;box-shadow:0 1px 3px rgba(0,0,0,.07)">
  <div style="font-size:15px;font-weight:700;color:#1a56db;border-bottom:2px solid #e8f0fe;padding-bottom:10px;margin-bottom:16px">🩺 건강 수치</div>
  <table>
    ${health.systolicBp ? row("혈압", health.systolicBp === "이상없음" ? val("이상없음") : `${val(health.systolicBp)} / ${val(health.diastolicBp)} <span style="color:#94a3b8;font-size:12px">mmHg (정상 120/80)</span>`) : ""}
    ${health.waistCircumference ? row("허리둘레", `${val(health.waistCircumference, "cm")} <span style="color:#94a3b8;font-size:12px">(남 85 / 여 80 이하 정상)</span>`) : ""}
    ${health.totalCholesterol ? row("총콜레스테롤", `${val(health.totalCholesterol, "mg/dL")} <span style="color:#94a3b8;font-size:12px">(200 이하 정상)</span>`) : ""}
    ${health.hdlCholesterol ? row("HDL콜레스테롤", `${val(health.hdlCholesterol, "mg/dL")} <span style="color:#94a3b8;font-size:12px">(60 이상 정상)</span>`) : ""}
    ${health.ldlCholesterol ? row("LDL콜레스테롤", `${val(health.ldlCholesterol, "mg/dL")} <span style="color:#94a3b8;font-size:12px">(100 이하 정상)</span>`) : ""}
    ${health.triglycerides ? row("중성지방", `${val(health.triglycerides, "mg/dL")} <span style="color:#94a3b8;font-size:12px">(150 이하 정상)</span>`) : ""}
    ${health.fastingBloodSugar ? row("공복혈당", `${val(health.fastingBloodSugar, "mg/dL")} <span style="color:#94a3b8;font-size:12px">(100 이하 정상)</span>`) : ""}
    ${health.postMealBloodSugar ? row("식후2시간 혈당", `${val(health.postMealBloodSugar, "mg/dL")} <span style="color:#94a3b8;font-size:12px">(140 이하 정상)</span>`) : ""}
    ${health.hba1c ? row("당화혈색소(HbA1c)", `${val(health.hba1c, "%")} <span style="color:#94a3b8;font-size:12px">(5.7% 이하 정상)</span>`) : ""}
    ${health.boneDensity ? row("골밀도 T-score", `${val(health.boneDensity)} <span style="color:#94a3b8;font-size:12px">(-1.0 이상 정상)</span>`) : ""}
  </table>
</div>` : ""}

<!-- ── 트레이닝 통계 ── -->
<div style="background:#fff;border-radius:12px;padding:24px;margin-bottom:16px;box-shadow:0 1px 3px rgba(0,0,0,.07)">
  <div style="font-size:15px;font-weight:700;color:#1a56db;border-bottom:2px solid #e8f0fe;padding-bottom:10px;margin-bottom:16px">💪 트레이닝 통계</div>
  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:16px">
    ${[
      ["총 수업", `${training.totalSessions}회`],
      ["컨디션 평균", training.avgCondition != null ? `${training.avgCondition}/10` : "-"],
      ["통증 평균", training.avgPain != null ? `${training.avgPain}/10` : "-"],
    ].map(([l, v]) => `<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px;text-align:center">
      <div style="font-size:11px;color:#94a3b8;margin-bottom:4px">${l}</div>
      <div style="font-size:20px;font-weight:700;color:#1a56db">${v}</div>
    </div>`).join("")}
  </div>
  ${training.topBodyParts.length > 0 ? `
  <div>
    <div style="font-size:12px;color:#64748b;font-weight:600;margin-bottom:8px">주요 운동 부위</div>
    <div>${training.topBodyParts.map(p => `<span style="display:inline-block;background:#eff6ff;color:#1a56db;border:1px solid #bfdbfe;padding:3px 12px;border-radius:20px;font-size:12px;margin:2px">${p}</span>`).join("")}</div>
  </div>` : ""}
  ${training.goals.length > 0 ? `
  <div style="margin-top:12px">
    <div style="font-size:12px;color:#64748b;font-weight:600;margin-bottom:8px">최근 훈련 목표</div>
    <div style="font-size:13px;color:#334155">${training.goals.join(" · ")}</div>
  </div>` : ""}
</div>

<!-- ── AI 분석 ── -->
<div style="background:linear-gradient(135deg,#eff6ff 0%,#f0fdf4 100%);border:1px solid #bfdbfe;border-radius:12px;padding:24px;margin-bottom:16px">
  <div style="display:inline-flex;align-items:center;gap:6px;background:#1a56db;color:#fff;padding:5px 14px;border-radius:20px;font-size:12px;font-weight:600;margin-bottom:16px">${data.isAI ? "✨ AI 분석 결과" : "📄 자동 생성 보고서"}</div>
  <div style="font-size:14px;line-height:1.9;color:#334155">${aiTextToHTML(aiText)}</div>
</div>

<!-- ── 프린트 버튼 (화면 전용) ── -->
<div class="no-print" style="text-align:center;margin-bottom:24px">
  <button onclick="window.print()" style="background:#1a56db;color:#fff;border:none;padding:12px 32px;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit">🖨️ PDF로 인쇄</button>
</div>

<!-- ── 푸터 ── -->
<div style="text-align:center;font-size:11px;color:#94a3b8;padding:16px">
  본 보고서는 ${data.generatedAt}에 ZIANTGYM에서 생성되었습니다.
</div>

</div>
</body>
</html>`;
}
