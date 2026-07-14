// 캐릭터 상태 + 결과 렌더링. preload가 노출한 window.jay 사용.
const tasksEl = document.getElementById("tasks");
const reportEl = document.getElementById("report");
const logEl = document.getElementById("log");

// 상단: 팀원별 주요 담당 업무를 한눈에 볼 수 있는 요약 줄 (모든 탭에서 항상 보임)
const teamRolesEl = document.getElementById("teamRoles");
window.jay.getTeamRoles().then((roles) => {
  if (!roles || roles.length === 0) return;
  teamRolesEl.innerHTML = roles
    .map((r) => `<span class="team-role-item"><b>${r.emoji || ""} ${r.name}</b> ${r.role}</span>`)
    .join("");
});

// 상단: 오늘의 업무 리스트 (대시보드/업무내역/분석내역 어디서든 항상 보임). AI가 처리 가능한 업무(자동/반자동)와
// 사장님이 직접 해야 하는 업무(수동)를 구분해서 보여주고, 체크박스로 진행도를 남긴다.
const dailyTasksPeriodEl = document.getElementById("dailyTasksPeriod");
const dailyTasksProgressEl = document.getElementById("dailyTasksProgress");
const dailyTasksListEl = document.getElementById("dailyTasksList");
const TASK_OWNER = { auto: "AI 처리", semi: "AI 처리(확인 필요)", manual: "사장님 처리" };

function renderDailyTasks(state) {
  if (!state || !state.items || state.items.length === 0) {
    dailyTasksPeriodEl.textContent = "";
    dailyTasksProgressEl.textContent = "";
    dailyTasksListEl.innerHTML = '<li class="empty">아직 도출된 업무가 없어요.</li>';
    return;
  }
  dailyTasksPeriodEl.textContent = state.periodLabel ? `(${state.periodLabel} 기준)` : "";
  const doneCount = state.items.filter((i) => i.done).length;
  dailyTasksProgressEl.textContent = `${doneCount}/${state.items.length} 완료`;

  dailyTasksListEl.innerHTML = "";
  state.items.forEach((item) => {
    const li = document.createElement("li");
    li.className = item.done ? "done" : "";
    li.innerHTML =
      `<label>` +
      `<input type="checkbox" data-id="${item.id}" ${item.done ? "checked" : ""} />` +
      `<span class="pill ${item.priority}">${PRIORITY_KO[item.priority] || item.priority}</span>` +
      `<span class="pill owner-${item.mode}">${TASK_OWNER[item.mode] || item.mode}</span>` +
      `<b>${escapeHtml(item.title)}</b>` +
      `<div class="meta">담당: ${escapeHtml(item.assigneeRole)} · ${escapeHtml(item.reason)}</div>` +
      `</label>`;
    dailyTasksListEl.appendChild(li);
  });
}

dailyTasksListEl.addEventListener("change", async (e) => {
  const checkbox = e.target.closest('input[type="checkbox"]');
  if (!checkbox) return;
  const state = await window.jay.toggleTaskProgress(checkbox.dataset.id);
  renderDailyTasks(state);
});

window.jay.getTaskProgress().then(renderDailyTasks);
window.jay.onTaskProgress(renderDailyTasks);

const PRIORITY_KO = { high: "긴급", normal: "보통", low: "낮음" };
const MODE_KO = { auto: "완전자동", semi: "반자동", manual: "수동" };

function renderResult(r) {
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
      `<div class="msg-error" data-idx="${i}"></div>` +
      `<button class="copy-btn" data-idx="${i}">복사</button>` +
      `<button class="done-btn" data-idx="${i}">연락 완료 ✓</button>` +
      `<button class="send-btn" data-idx="${i}" ${m.phone ? "" : "disabled"}>승인·발송</button>`;
    messagesEl.appendChild(li);
  });
  messagesEl.querySelectorAll(".send-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const idx = Number(btn.getAttribute("data-idx"));
      const m = mina.messages[idx];
      const li = btn.closest("li");
      const errorEl = li.querySelector(".msg-error");
      btn.disabled = true;
      btn.textContent = "발송 중...";
      errorEl.textContent = "";
      const result = await window.jay.sendSms(m);
      if (result.ok) {
        li.style.opacity = "0.4";
        btn.textContent = "발송 완료 ✓";
        li.querySelector(".done-btn").disabled = true;
      } else {
        btn.disabled = false;
        btn.textContent = "승인·발송";
        errorEl.textContent = `발송 실패: ${result.error}`;
      }
    });
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

const repoYearMonthEl = document.getElementById("repoYearMonth");
const repoBranchTabsEl = document.getElementById("repoBranchTabs");
const repoDataNotesEl = document.getElementById("repoDataNotes");
const repoBodyEl = document.getElementById("repoBody");
let currentRepo = null;
let selectedRepoBranch = null;

function reportSection(title, text) {
  const wrap = document.createElement("div");
  const h3 = document.createElement("h3");
  h3.textContent = title;
  const pre = document.createElement("pre");
  pre.className = "report";
  pre.textContent = text || "내용 없음";
  wrap.appendChild(h3);
  wrap.appendChild(pre);
  return wrap;
}

function renderRepoBody() {
  repoBodyEl.innerHTML = "";
  if (!currentRepo || currentRepo.branches.length === 0) {
    repoBodyEl.innerHTML = '<p class="empty">아직 없어요. 매달 1일에 자동으로 만들어져요.</p>';
    return;
  }
  const b = currentRepo.branches.find((x) => x.branchName === selectedRepoBranch) || currentRepo.branches[0];
  repoBodyEl.appendChild(reportSection("월 운영 전략", b.operationsReport));
  repoBodyEl.appendChild(reportSection("회원권 재등록 전략", b.membershipRenewalReport));
  repoBodyEl.appendChild(reportSection("PT 재등록 전략", b.ptRenewalReport));
}

function renderRepo(repo) {
  currentRepo = repo;
  repoYearMonthEl.textContent = repo.yearMonth ? `(${repo.yearMonth})` : "";
  repoBranchTabsEl.innerHTML = "";
  repo.branches.forEach((b, i) => {
    const btn = document.createElement("button");
    btn.textContent = b.branchName;
    btn.classList.toggle("active", i === 0);
    btn.addEventListener("click", () => {
      selectedRepoBranch = b.branchName;
      repoBranchTabsEl.querySelectorAll("button").forEach((x) => x.classList.remove("active"));
      btn.classList.add("active");
      renderRepoBody();
    });
    repoBranchTabsEl.appendChild(btn);
  });
  selectedRepoBranch = repo.branches[0]?.branchName;
  repoDataNotesEl.innerHTML = "";
  (repo.dataNotes || []).forEach((n) => {
    const div = document.createElement("div");
    div.className = "repo-note";
    div.textContent = `⚠️ ${n}`;
    repoDataNotesEl.appendChild(div);
  });
  renderRepoBody();
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
  { id: "jiyoung", name: "지영", home: 71, homeY: 82, deskEmpty: DESK_BACK, ...officeSprites("jiyoung") },
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

// 업무 중이 아니고 돌아다니고 있을 때는 실제로 하는 일이 없으니 "대기 중"이라고 정직하게 표시한다.
// (제이가 실제로 업무를 배정하면 main.ts의 agentState("working")가 따로 와서 진짜 진행 상황 말풍선으로 바뀐다.)
function scheduleAmbientBubble(member) {
  const delay = 6000 + Math.random() * 7000;
  setTimeout(() => {
    const st = roam[member.id];
    if (st && st.mode === "roam") {
      showBubble(member.id, "대기 중", 2600);
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
const agentPicker = document.getElementById("agentPicker");
const realPhoto = document.getElementById("realPhoto");
const realPhotoImg = document.getElementById("realPhotoImg");
const realPhotoName = document.getElementById("realPhotoName");
const replyEmpty = document.getElementById("replyEmpty");
const replyBody = document.getElementById("replyBody");
const replyMeta = document.getElementById("replyMeta");
const replyText = document.getElementById("replyText");

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// 개별 지시 대상 팀원 선택 UI. 고르면 사무실 이미지 오른쪽에 그 직원의 실제 이미지가 뜬다.
const COMMAND_TARGETS = [
  { id: "jay", name: "제이" },
  { id: "mina", name: "미나" },
  { id: "data", name: "데이터" },
  { id: "luna", name: "루나" },
  { id: "jiyoung", name: "지영" },
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
  replyEmpty.classList.add("hidden");
  replyBody.classList.remove("hidden");
  replyMeta.textContent = `${target.name}가 확인하고 있어요…`;
  replyText.textContent = "";
  try {
    const result = await window.jay.runCommand(instruction, selectedAgent);
    replyMeta.textContent = `${target.name}의 답변`;
    replyText.textContent = result.reply;
    if (historyAgent === selectedAgent && !document.getElementById("tab-history").classList.contains("hidden")) {
      loadHistory();
    }
  } catch (err) {
    replyMeta.textContent = "오류";
    replyText.textContent = "오류가 발생했어요: " + (err?.message || err);
  } finally {
    commandBtn.disabled = false;
  }
}

commandBtn.addEventListener("click", submitCommand);
commandInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    submitCommand();
  }
});
window.jay.onCommandState((state) => {
  commandBtn.disabled = state === "thinking";
});

window.jay.onResult(renderResult);
window.jay.onMina(renderMina);
window.jay.onFunnel(renderFunnel);
window.jay.onContent(renderContent);
window.jay.onRepo(renderRepo);
window.jay.getRepoReport().then((r) => {
  if (r) renderRepo(r);
});
window.jay.onAgentState(setAgentState);
window.jay.onLog((line) => {
  logEl.textContent = line;
});

// 상단 탭: 대시보드(기본 화면) / 업무 내역 / 분석 내역
const tabButtons = document.querySelectorAll(".tab-btn");
const tabContents = {
  dashboard: document.getElementById("tab-dashboard"),
  history: document.getElementById("tab-history"),
  analysis: document.getElementById("tab-analysis"),
};
function showMainTab(name) {
  tabButtons.forEach((b) => b.classList.toggle("active", b.dataset.tab === name));
  Object.entries(tabContents).forEach(([key, el]) => el.classList.toggle("hidden", key !== name));
  if (name === "history") renderHistoryTab();
}
tabButtons.forEach((b) => b.addEventListener("click", () => showMainTab(b.dataset.tab)));

// 업무 내역: 팀원별(제이/미나/데이터/루나/지영) 지시 이력을 따로 보여준다.
const historyAgentTabs = document.getElementById("historyAgentTabs");
const historyList = document.getElementById("historyList");
let historyAgent = "jay";

COMMAND_TARGETS.forEach((t) => {
  const btn = document.createElement("button");
  btn.textContent = t.name;
  btn.dataset.agent = t.id;
  btn.addEventListener("click", () => {
    historyAgent = t.id;
    historyAgentTabs.querySelectorAll("button").forEach((b) => b.classList.toggle("active", b.dataset.agent === historyAgent));
    loadHistory();
  });
  historyAgentTabs.appendChild(btn);
});
historyAgentTabs.querySelector(`button[data-agent="${historyAgent}"]`)?.classList.add("active");

function renderHistoryTab() {
  loadHistory();
}

async function loadHistory() {
  historyList.innerHTML = '<li class="empty">불러오는 중…</li>';
  const entries = await window.jay.getCommandHistory(historyAgent);
  if (!entries || entries.length === 0) {
    historyList.innerHTML = '<li class="empty">아직 지시 이력이 없어요.</li>';
    return;
  }
  historyList.innerHTML = "";
  [...entries]
    .reverse()
    .forEach((e) => {
      const li = document.createElement("li");
      const time = new Date(e.at).toLocaleString("ko-KR", {
        month: "numeric",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
      li.innerHTML =
        `<div class="history-time">${time}</div>` +
        `<div class="history-instruction">${escapeHtml(e.instruction)}</div>` +
        `<div class="history-reply">${escapeHtml(e.reply)}</div>`;
      historyList.appendChild(li);
    });
}
