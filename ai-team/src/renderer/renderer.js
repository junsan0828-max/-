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

const messagesEl = document.getElementById("messages");
const CATEGORY_ICON = { 만료임박: "⏰", 이탈위험: "🚪", 미수금: "💰" };

function renderMina(mina) {
  messagesEl.innerHTML = "";
  if (!mina.messages || mina.messages.length === 0) {
    messagesEl.innerHTML = '<li class="empty">지금은 연락할 대상이 없어요.</li>';
    return;
  }
  mina.messages.forEach((m, i) => {
    const li = document.createElement("li");
    li.setAttribute("data-key", i);
    li.innerHTML =
      `<div class="msg-head"><span class="msg-name">${CATEGORY_ICON[m.category] || ""} ${m.name}</span>` +
      `<span class="msg-phone">${m.phone || "번호 없음"}</span></div>` +
      `<div class="msg-body">${m.message}</div>` +
      `<button class="copy-btn" data-idx="${i}">복사</button>` +
      `<button class="done-btn" data-idx="${i}">연락 완료 ✓</button>`;
    messagesEl.appendChild(li);
  });
  messagesEl.querySelectorAll(".copy-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = Number(btn.getAttribute("data-idx"));
      window.jay.copyText(mina.messages[idx].message);
      btn.textContent = "복사됨!";
      btn.classList.add("copied");
      setTimeout(() => {
        btn.textContent = "복사";
        btn.classList.remove("copied");
      }, 1500);
    });
  });
  messagesEl.querySelectorAll(".done-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const idx = Number(btn.getAttribute("data-idx"));
      const m = mina.messages[idx];
      await window.jay.markContacted(m.category, m.name, m.phone);
      const li = btn.closest("li");
      li.style.opacity = "0.4";
      btn.textContent = "완료됨 (7일간 안 보임)";
      btn.disabled = true;
    });
  });
}

const funnelEl = document.getElementById("funnelInsight");
function renderFunnel(funnel) {
  funnelEl.textContent = funnel.insight || "분석 결과가 없어요.";
}

const contentEl = document.getElementById("content");
const PLATFORM_ICON = { 블로그: "📝", 인스타그램: "📸" };
function renderContent(content) {
  contentEl.innerHTML = "";
  if (!content.ideas || content.ideas.length === 0) {
    contentEl.innerHTML = '<li class="empty">아직 없어요.</li>';
    return;
  }
  content.ideas.forEach((idea, i) => {
    const li = document.createElement("li");
    li.innerHTML =
      `<div class="msg-head"><span class="msg-name">${PLATFORM_ICON[idea.platform] || ""} [${idea.platform}] ${idea.title}</span></div>` +
      `<div class="msg-body">${idea.draft}</div>` +
      `<button class="copy-btn" data-idx="${i}">복사</button>`;
    contentEl.appendChild(li);
  });
  contentEl.querySelectorAll(".copy-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = Number(btn.getAttribute("data-idx"));
      window.jay.copyText(content.ideas[idx].draft);
      btn.textContent = "복사됨!";
      btn.classList.add("copied");
      setTimeout(() => {
        btn.textContent = "복사";
        btn.classList.remove("copied");
      }, 1500);
    });
  });
}

// AI 팀 사무실 미니 애니메이션
const OFFICE_TEAM = [
  { id: "jay", name: "제이", emoji: "🧑‍💼" },
  { id: "mina", name: "미나", emoji: "🙋‍♀️" },
  { id: "data", name: "데이터", emoji: "📊" },
  { id: "luna", name: "루나", emoji: "🎨" },
];
const officeRoom = document.getElementById("officeRoom");
let bubbleTimers = {};

OFFICE_TEAM.forEach((member) => {
  const desk = document.createElement("div");
  desk.className = "desk";
  desk.id = `desk-${member.id}`;
  desk.innerHTML =
    `<div class="bubble" id="bubble-${member.id}"></div>` +
    `<div class="avatar">${member.emoji}</div>` +
    `<div class="desk-surface"></div>` +
    `<div class="name">${member.name}</div>`;
  officeRoom.appendChild(desk);
});

function setAgentState({ agent, state, bubble }) {
  const desk = document.getElementById(`desk-${agent}`);
  if (!desk) return;
  desk.classList.remove("working", "done");
  if (state === "working" || state === "done") desk.classList.add(state);

  if (bubble) {
    const bubbleEl = document.getElementById(`bubble-${agent}`);
    bubbleEl.textContent = bubble;
    bubbleEl.classList.add("show");
    clearTimeout(bubbleTimers[agent]);
    bubbleTimers[agent] = setTimeout(() => {
      bubbleEl.classList.remove("show");
      desk.classList.remove("done");
    }, 4000);
  }
}

const commandInput = document.getElementById("commandInput");
const commandBtn = document.getElementById("commandBtn");
const commandReply = document.getElementById("commandReply");

async function submitCommand() {
  const instruction = commandInput.value.trim();
  if (!instruction) return;
  commandBtn.disabled = true;
  commandReply.textContent = "제이가 확인하고 있어요…";
  try {
    const result = await window.jay.runCommand(instruction);
    commandReply.textContent = result.reply;
  } catch (err) {
    commandReply.textContent = "오류가 발생했어요: " + (err?.message || err);
  } finally {
    commandBtn.disabled = false;
  }
}

commandBtn.addEventListener("click", submitCommand);
commandInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submitCommand();
});
window.jay.onCommandState((state) => {
  commandBtn.disabled = state === "thinking";
});

window.jay.onState(setState);
window.jay.onResult(renderResult);
window.jay.onMina(renderMina);
window.jay.onFunnel(renderFunnel);
window.jay.onContent(renderContent);
window.jay.onAgentState(setAgentState);
window.jay.onLog((line) => {
  logEl.textContent = line;
});

runBtn.addEventListener("click", () => window.jay.runNow());
