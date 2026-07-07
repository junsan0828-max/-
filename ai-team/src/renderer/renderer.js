// 캐릭터 상태 + 결과 렌더링. preload가 노출한 window.jay 사용.
const officeScene = document.getElementById("officeScene");
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
  stateLabel.textContent = STATE_TEXT[state] || state;
  runBtn.disabled = state === "thinking" || state === "reporting";
  officeScene.classList.remove("mood-idle", "mood-thinking", "mood-reporting");
  officeScene.classList.add("mood-" + state);
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

// AI 팀 사무실 — 팀원별로 생김새가 다른 SVG 캐릭터 + 책상
const CHAR_DEFS = {
  jay: {
    name: "제이",
    role: "총괄실장",
    skin: "#ffd9a0",
    hair: "#2b2b3d",
    outfit: "#7c5cff",
    style: "part",
    accessory: "tie",
    lead: true,
  },
  mina: {
    name: "미나",
    role: "회원관리",
    skin: "#ffdfb8",
    hair: "#8a4b2b",
    outfit: "#ff6f91",
    style: "long",
    accessory: "headset",
  },
  data: {
    name: "데이터",
    role: "퍼널분석",
    skin: "#ffe0c2",
    hair: "#3a3a3a",
    outfit: "#2fb6a6",
    style: "short",
    accessory: "glasses",
  },
  luna: {
    name: "루나",
    role: "마케팅",
    skin: "#ffdcc9",
    hair: "#c65bff",
    outfit: "#ffb648",
    style: "spiky",
    accessory: "beret",
  },
};
const EYE_INK = "#26294d";

function hairMarkup(style, hair) {
  switch (style) {
    case "part":
      return `<path class="hair" d="M20 48 Q28 6 60 6 Q92 6 100 48 Q92 22 76 20 Q70 34 60 34 Q50 34 46 21 Q30 22 20 48 Z" fill="${hair}"/>`;
    case "long":
      return `<path class="hair" d="M20 50 Q17 8 60 6 Q103 8 100 50 Q100 96 89 102 Q94 56 80 40 Q60 29 40 40 Q26 56 31 102 Q20 96 20 50 Z" fill="${hair}"/>`;
    case "short":
      return `<path class="hair" d="M20 44 Q23 10 60 10 Q97 10 100 44 Q96 24 60 22 Q24 24 20 44 Z" fill="${hair}"/>`;
    case "spiky":
      return `<path class="hair" d="M18 44 L27 12 L38 33 L49 6 L60 30 L71 6 L82 33 L93 12 L102 44 Q90 24 60 24 Q30 24 18 44 Z" fill="${hair}"/>`;
    default:
      return "";
  }
}

function accessoryMarkup(kind, outfit) {
  switch (kind) {
    case "tie":
      return (
        `<path d="M48 90 L60 100 L72 90 L66 132 L60 138 L54 132 Z" fill="#f4f5ff"/>` +
        `<path class="tie" d="M56 96 L64 96 L61 106 L67 132 L60 137 L53 132 L59 106 Z" fill="${EYE_INK}"/>`
      );
    case "headset":
      return (
        `<path d="M23 48 Q23 14 60 14 Q97 14 97 48" fill="none" stroke="${EYE_INK}" stroke-width="3"/>` +
        `<circle cx="23" cy="52" r="5" fill="${EYE_INK}"/>` +
        `<path d="M23 57 Q18 70 33 74" fill="none" stroke="${EYE_INK}" stroke-width="2.5"/>` +
        `<circle cx="34" cy="75" r="3" fill="${EYE_INK}"/>`
      );
    case "glasses":
      return (
        `<rect x="35" y="49" width="21" height="15" rx="4" fill="none" stroke="${EYE_INK}" stroke-width="3"/>` +
        `<rect x="64" y="49" width="21" height="15" rx="4" fill="none" stroke="${EYE_INK}" stroke-width="3"/>` +
        `<line x1="56" y1="55" x2="64" y2="55" stroke="${EYE_INK}" stroke-width="3"/>`
      );
    case "beret":
      return `<ellipse cx="72" cy="12" rx="23" ry="10" fill="${outfit}" transform="rotate(-12 72 12)"/><circle cx="91" cy="6" r="3" fill="${outfit}"/>`;
    default:
      return "";
  }
}

function charInnerSVG(def) {
  return (
    `<path class="shoulders" d="M12 118 Q60 90 108 118 L108 132 L12 132 Z" fill="${def.outfit}"/>` +
    `<circle class="head" cx="60" cy="58" r="38" fill="${def.skin}"/>` +
    hairMarkup(def.style, def.hair) +
    `<circle class="eye" cx="47" cy="58" r="4.5" fill="${EYE_INK}"/>` +
    `<circle class="eye" cx="73" cy="58" r="4.5" fill="${EYE_INK}"/>` +
    `<path class="mouth" d="M46 74 Q60 84 74 74" fill="none" stroke="${EYE_INK}" stroke-width="3" stroke-linecap="round"/>` +
    accessoryMarkup(def.accessory, def.outfit)
  );
}

let bubbleTimers = {};

Object.entries(CHAR_DEFS).forEach(([id, def]) => {
  const desk = document.createElement("div");
  desk.className = "desk" + (def.lead ? " lead" : "");
  desk.id = `desk-${id}`;
  desk.innerHTML =
    `<div class="bubble" id="bubble-${id}"></div>` +
    `<div class="char" id="char-${id}"><svg viewBox="0 0 120 132" width="${def.lead ? 96 : 80}" height="${def.lead ? 106 : 88}">${charInnerSVG(def)}</svg></div>` +
    `<div class="monitor"><div class="screen"></div></div>` +
    `<div class="name">${def.name}<span class="role">${def.role}</span></div>`;
  officeScene.appendChild(desk);
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
