// 캐릭터 상태 + 결과 렌더링. preload가 노출한 window.jay 사용.
const jayEl = document.getElementById("jay");
const stateLabel = document.getElementById("stateLabel");
const headline = document.getElementById("headline");
const tasksEl = document.getElementById("tasks");
const reportEl = document.getElementById("report");
const runBtn = document.getElementById("runBtn");
const logEl = document.getElementById("log");

const STATE_TEXT = {
  idle: "대기 중",
  thinking: "분석 중… 🤔",
  reporting: "보고 정리 중… 📊",
};

function setState(state) {
  jayEl.className = "character " + state;
  stateLabel.textContent = STATE_TEXT[state] || state;
  runBtn.disabled = state === "thinking" || state === "reporting";
}

const PRIORITY_KO = { high: "긴급", normal: "보통", low: "낮음" };
const MODE_KO = { auto: "완전자동", semi: "반자동", manual: "수동" };

function renderResult(r) {
  headline.textContent = r.headline || "";
  tasksEl.innerHTML = "";
  if (!r.tasks || r.tasks.length === 0) {
    tasksEl.innerHTML = '<li class="empty">도출된 업무가 없어요.</li>';
  } else {
    for (const t of r.tasks) {
      const li = document.createElement("li");
      li.innerHTML =
        `<span class="pill ${t.priority}">${PRIORITY_KO[t.priority] || t.priority}</span>` +
        `<span class="pill mode">${MODE_KO[t.mode] || t.mode}</span>` +
        `<b>${t.title}</b>` +
        `<div class="meta">담당: ${t.assigneeRole} · ${t.reason}</div>`;
      tasksEl.appendChild(li);
    }
  }
  reportEl.textContent = r.report || "";
}

window.jay.onState(setState);
window.jay.onResult(renderResult);
window.jay.onLog((line) => {
  logEl.textContent = line;
});

runBtn.addEventListener("click", () => window.jay.runNow());
