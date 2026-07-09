// 캐릭터 상태 + 결과 렌더링. preload가 노출한 window.jay 사용.
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

// AI 팀 사무실: 업무 중일 때만 자기 자리(책상)에 앉고, 업무가 없으면 사무실을 돌아다닌다
// (누가 놀고 있는지 한눈에 보여서 그 사람에게 새 업무를 시킬 수 있게). 앉은 모습(-seated)은 인물+책상+
// 의자가 합쳐진 그림이지만, 뒷줄(미나/제이)과 앞줄(루나/데이터)이 각각 완전히 같은 책상·의자 원본을 쓴
// 상태로 인물만 합성해 뒀기 때문에 같은 줄끼리는 책상 디자인이 항상 동일하다. 걷는/서있는 모습은 기존
// 정면 스프라이트를 쓴다.
function officeSprites(id) {
  const p = (name) => `../../assets/office/${name}.png`;
  return {
    sit: p(`${id}-seated`),
    stand: p(`${id}-stand`),
    walkL: [p(`${id}-walkL1`), p(`${id}-walkL2`)],
    walkR: [p(`${id}-walkR1`), p(`${id}-walkR2`)],
  };
}
// 자리는 배경 그림(background.jpg)에서 실제 바닥(창가/유리 회의실/우측 카펫을 피한 안쪽 마름모 영역)
// 안에 %로 잡는다. office-room은 CSS에서 배경 원화와 동일한 비율(900:502)로 고정되어 있어
// 창 크기가 바뀌어도 이 좌표가 가리키는 실제 지점이 달라지지 않는다.
// homeY는 배경(2.5D 원근)에서의 안쪽(작게)~앞쪽(크게) 위치, depthScale로 안쪽일수록 작게 그려 원근감을 낸다.
// 2줄 마주보기 배치: 뒷줄(미나/제이)과 앞줄(루나/데이터)이 서로 마주본다.
// (미나-루나, 제이-데이터가 각각 같은 열에서 짝을 이뤄 마주본다.)
// deskEmpty: 자리를 비우고 돌아다닐 때 그 자리에 보이는 빈 책상 그림. -seated 합성에 쓰인 것과 같은
// 책상 원본이라 자리를 비우든 앉아있든 같은 줄은 항상 같은 책상으로 보인다.
const DESK_BACK = "../../assets/office/back-desk.png";
const DESK_FRONT = "../../assets/office/front-desk.png";
const OFFICE_TEAM = [
  { id: "mina", name: "미나", home: 64, homeY: 73, deskEmpty: DESK_BACK, ...officeSprites("mina") },
  { id: "jay", name: "제이", home: 57, homeY: 65, deskEmpty: DESK_BACK, ...officeSprites("jay") },
  { id: "luna", name: "루나", home: 50, homeY: 73, deskEmpty: DESK_FRONT, ...officeSprites("luna") },
  { id: "data", name: "데이터", home: 57, homeY: 79, deskEmpty: DESK_FRONT, ...officeSprites("data") },
];
const DEPTH_Y_MIN = 48;
const DEPTH_Y_MAX = 92;
function depthScale(y) {
  const t = Math.max(0, Math.min(1, (y - DEPTH_Y_MIN) / (DEPTH_Y_MAX - DEPTH_Y_MIN)));
  return 0.62 + t * 0.5;
}
// office-room의 실제 렌더 폭 대비 배율. 배경 원화 기준 폭(900px)보다 창이 커지거나 작아지면
// 캐릭터 크기도 같은 비율로 커지고 작아져야 배경과 스케일이 어긋나지 않는다.
let officeScale = 1;
function updateOfficeScale() {
  const w = officeRoom.clientWidth;
  if (w > 0) officeScale = w / 900;
}
function placeRoamer(el, x, y, extraTransform) {
  el.style.left = `${x}%`;
  el.style.top = `${y}%`;
  const s = depthScale(y) * officeScale;
  el.style.transform = `translate(-50%, -100%) scale(${s})${extraTransform ? " " + extraTransform : ""}`;
  el.style.zIndex = String(Math.round(y * 10));
}
// 업무 중이 아닐 때도 일하는 느낌이 나도록 주기적으로 띄우는 상태 말풍선 (역할별).
const STATUS_PHRASES = {
  jay: ["보고서 작성 중", "일정 확인 중", "AI 분석 진행 중", "검토 요청할게요"],
  mina: ["고객 응대 중", "문자 초안 작성 중", "회원 상담 중"],
  data: ["데이터 분석 중", "퍼널 리포트 작성 중", "지표 확인 중"],
  luna: ["콘텐츠 초안 작성 중", "블로그 글감 정리 중", "인스타 시안 검토 중"],
};

const officeRoom = document.getElementById("officeRoom");
let bubbleTimers = {};
let paceTimers = {};
// id -> { x, y, dir, yDir, xMin, xMax, yMin, yMax, speed, ySpeed, home, homeY, mode }
// mode: "roam"(업무 없음, 사무실을 돌아다님) | "returning"(업무 배정돼 자리로 돌아가는 중) | "sitting"(업무 중, 자리에 앉음)
const roam = {};

updateOfficeScale();
window.addEventListener("resize", () => {
  updateOfficeScale();
  OFFICE_TEAM.forEach((member) => {
    const roamer = document.getElementById(`roamer-${member.id}`);
    const anchor = document.getElementById(`deskanchor-${member.id}`);
    const st = roam[member.id];
    if (roamer && st) placeRoamer(roamer, st.x, st.y);
    if (anchor) placeRoamer(anchor, member.home, member.homeY);
  });
});

OFFICE_TEAM.forEach((member, i) => {
  const anchor = document.createElement("img");
  anchor.className = "desk-anchor";
  anchor.id = `deskanchor-${member.id}`;
  anchor.src = member.deskEmpty;
  anchor.alt = "";
  placeRoamer(anchor, member.home, member.homeY);
  officeRoom.appendChild(anchor);

  const roamer = document.createElement("div");
  roamer.className = "roamer";
  roamer.id = `roamer-${member.id}`;
  roamer.innerHTML =
    `<div class="bubble" id="bubble-${member.id}"></div>` +
    `<div class="confetti" id="confetti-${member.id}"></div>` +
    `<img class="avatar" id="avatar-${member.id}" src="${member.stand}" alt="${member.name}" />` +
    `<div class="name">${member.name}</div>`;
  placeRoamer(roamer, member.home, member.homeY);
  officeRoom.appendChild(roamer);

  roam[member.id] = {
    x: member.home,
    y: member.homeY,
    dir: i % 2 === 0 ? 1 : -1,
    yDir: i % 2 === 0 ? 1 : -1,
    xMin: 33,
    xMax: 58,
    yMin: DEPTH_Y_MIN,
    yMax: DEPTH_Y_MAX,
    speed: 0.5 + Math.random() * 0.22,
    ySpeed: 0.22 + Math.random() * 0.12,
    home: member.home,
    homeY: member.homeY,
    mode: "roam",
  };
  setTimeout(() => startPacing(member), i * 180);
  scheduleAmbientBubble(member);
});

const CONFETTI_COLORS = ["#ff6f9c", "#4fc3f7", "#6be3a3", "#ffd166", "#7c5cff"];

function spawnConfetti(agent) {
  const el = document.getElementById(`confetti-${agent}`);
  if (!el) return;
  el.innerHTML = "";
  for (let i = 0; i < 10; i++) {
    const span = document.createElement("span");
    const angle = Math.random() * Math.PI * 2;
    const dist = 18 + Math.random() * 18;
    span.style.setProperty("--dx", `${Math.cos(angle) * dist}px`);
    span.style.setProperty("--dy", `${Math.sin(angle) * dist - 10}px`);
    span.style.setProperty("--rot", `${Math.random() * 360}deg`);
    span.style.background = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
    span.style.animationDelay = `${Math.random() * 0.1}s`;
    el.appendChild(span);
  }
}

function showBubble(agent, text, ms) {
  const bubbleEl = document.getElementById(`bubble-${agent}`);
  if (!bubbleEl) return;
  bubbleEl.textContent = text;
  bubbleEl.classList.add("show");
  clearTimeout(bubbleTimers[agent]);
  bubbleTimers[agent] = setTimeout(() => bubbleEl.classList.remove("show"), ms);
}

// 업무 중이 아니고 돌아다니고 있을 때만 "일하는 느낌"의 상태 문구를 가끔 띄운다
// (업무 중엔 실제 진행 상황 말풍선이 따로 오므로 겹치지 않게 한다).
function scheduleAmbientBubble(member) {
  const delay = 6000 + Math.random() * 7000;
  setTimeout(() => {
    const st = roam[member.id];
    if (st && st.mode === "roam") {
      const phrases = STATUS_PHRASES[member.id];
      showBubble(member.id, phrases[Math.floor(Math.random() * phrases.length)], 2600);
    }
    scheduleAmbientBubble(member);
  }, delay);
}

// office-room 안전 바닥 영역을 돌아다니다가(업무 없음=idle), 업무가 배정되면 자기 책상(home)으로
// 걸어와 앉는다. 이렇게 "누가 걸어다니고 있는지"로 노는 사람을 한눈에 파악할 수 있게 한다.
function startPacing(member) {
  const img = document.getElementById(`avatar-${member.id}`);
  const roamer = document.getElementById(`roamer-${member.id}`);
  const anchor = document.getElementById(`deskanchor-${member.id}`);
  if (!img || !roamer) return;
  let frame = 0;
  clearInterval(paceTimers[member.id]);
  paceTimers[member.id] = setInterval(() => {
    const st = roam[member.id];
    if (!st) return;
    if (st.mode === "sitting") return;

    frame = 1 - frame;
    if (st.mode === "returning") {
      const distX = st.home - st.x;
      const distY = st.homeY - st.y;
      const arrived = Math.abs(distX) <= st.speed && Math.abs(distY) <= st.ySpeed;
      if (arrived) {
        st.x = st.home; st.y = st.homeY;
        placeRoamer(roamer, st.x, st.y);
        st.mode = "sitting";
        img.src = member.sit;
        img.classList.add("seated");
        if (anchor) anchor.classList.add("hide");
        return;
      }
      st.dir = distX > 0.3 ? 1 : distX < -0.3 ? -1 : st.dir;
      st.y += Math.sign(distY) * Math.min(Math.abs(distY), st.ySpeed);
    } else {
      if (st.x >= st.xMax) { st.x = st.xMax; st.dir = -1; }
      if (st.x <= st.xMin) { st.x = st.xMin; st.dir = 1; }
      if (st.y >= st.yMax) { st.y = st.yMax; st.yDir = -1; }
      if (st.y <= st.yMin) { st.y = st.yMin; st.yDir = 1; }
      st.y += st.yDir * st.ySpeed;
    }

    const frames = st.dir === 1 ? member.walkR : member.walkL;
    img.src = frames[frame];
    st.x += st.dir * st.speed;
    placeRoamer(roamer, st.x, st.y);
  }, 300 + Math.random() * 60);
}

function setAgentState({ agent, state, bubble }) {
  const roamer = document.getElementById(`roamer-${agent}`);
  const anchor = document.getElementById(`deskanchor-${agent}`);
  const member = OFFICE_TEAM.find((m) => m.id === agent);
  const st = roam[agent];
  if (!roamer || !member || !st) return;
  const avatar = document.getElementById(`avatar-${agent}`);

  roamer.classList.remove("working", "done");
  if (state === "working" || state === "done") {
    st.mode = st.x === st.home && st.y === st.homeY ? "sitting" : "returning";
    if (st.mode === "sitting") {
      avatar.src = member.sit;
      avatar.classList.add("seated");
      if (anchor) anchor.classList.add("hide");
    }
    roamer.classList.add(state);
  } else {
    st.mode = "roam";
    avatar.classList.remove("seated");
    if (anchor) anchor.classList.remove("hide");
  }
  if (state === "done") spawnConfetti(agent);
  if (bubble) showBubble(agent, bubble, 4000);

  // done 상태(업무 완료)는 항상 bubble과 함께 온다 (main.ts 참고). 그 표시 시간(4초) 후
  // 다시 자리를 비우고 돌아다니게 해서 "이 사람은 지금 자유롭다"는 걸 보여준다.
  if (state === "done") {
    clearTimeout(bubbleTimers[`${agent}_revert`]);
    bubbleTimers[`${agent}_revert`] = setTimeout(() => {
      roamer.classList.remove("done");
      st.mode = "roam";
      avatar.classList.remove("seated");
      if (anchor) anchor.classList.remove("hide");
    }, 4000);
  }
}

const commandInput = document.getElementById("commandInput");
const commandBtn = document.getElementById("commandBtn");
const commandReply = document.getElementById("commandReply");
const commanderTitle = document.getElementById("commanderTitle");
const agentPicker = document.getElementById("agentPicker");
const realPhoto = document.getElementById("realPhoto");
const realPhotoImg = document.getElementById("realPhotoImg");
const realPhotoName = document.getElementById("realPhotoName");

// 개별 지시 대상 팀원 선택 UI. 고르면 사무실 이미지 오른쪽에 그 직원의 실제 이미지가 뜬다.
const COMMAND_TARGETS = [
  { id: "jay", name: "제이" },
  { id: "mina", name: "미나" },
  { id: "data", name: "데이터" },
  { id: "luna", name: "루나" },
];
let selectedAgent = "jay";

function renderRealPhoto(agentId) {
  const target = COMMAND_TARGETS.find((t) => t.id === agentId) || COMMAND_TARGETS[0];
  realPhotoImg.src = `../../assets/office/real/${agentId}.jpg`;
  realPhotoName.textContent = target.name;
  realPhoto.classList.add("show");
}

function selectAgent(agentId) {
  selectedAgent = agentId;
  const target = COMMAND_TARGETS.find((t) => t.id === agentId) || COMMAND_TARGETS[0];
  commanderTitle.innerHTML =
    `${target.name}에게 직접 지시하기 <span class="sub">(질문·초안 요청. 발송·게시 등 실행은 안 함)</span>`;
  agentPicker.querySelectorAll("button").forEach((b) => b.classList.toggle("active", b.dataset.agent === agentId));
  renderRealPhoto(agentId);
}

COMMAND_TARGETS.forEach((t) => {
  const btn = document.createElement("button");
  btn.textContent = t.name;
  btn.dataset.agent = t.id;
  btn.addEventListener("click", () => selectAgent(t.id));
  agentPicker.appendChild(btn);
});
selectAgent("jay");

async function submitCommand() {
  const instruction = commandInput.value.trim();
  if (!instruction) return;
  commandBtn.disabled = true;
  const target = COMMAND_TARGETS.find((t) => t.id === selectedAgent);
  commandReply.textContent = `${target.name}가 확인하고 있어요…`;
  try {
    const result = await window.jay.runCommand(instruction, selectedAgent);
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
