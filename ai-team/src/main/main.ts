import { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage } from "electron";
import { join } from "node:path";
import { readFileSync } from "node:fs";
import * as dotenv from "dotenv";
import cron from "node-cron";
import { runOrchestrator, saveResult, loadTodaysResult, OrchestratorResult } from "./orchestrator";
import { generateMemberMessages } from "./mina";
import { analyzeFunnel } from "./dataAgent";
import { generateContentIdeas } from "./luna";
import { markContacted } from "./store";
import { sendSms } from "./aligo";
import { runCommand } from "./commander";
import { pushDailyReport, pushPayrollReport, pushRepoReport, pushJournalEntry } from "./notion";
import { pushDailyBriefingKakao } from "./kakao";
import { buildIndex, backupSpreadsheets } from "./drive/archive";
import { runPayroll, writePayrollSheet } from "./payroll";
import { runRepo, saveRepoResult, loadRepoResult, previousYearMonth } from "./repo";
import { runJournal } from "./journal";
import { runIfkJob } from "./ifk";
import { getRecentCommands } from "./commandLog";
import { updateTaskProgress, getTaskProgress, toggleTaskProgress, addManualTask } from "./taskProgress";

dotenv.config({ path: join(__dirname, "..", "..", ".env") });

let win: BrowserWindow | null = null;
let tray: Tray | null = null;
let running = false;

function send(channel: string, payload?: unknown) {
  win?.webContents.send(channel, payload);
}

function createWindow() {
  win = new BrowserWindow({
    width: 1040,
    height: 800,
    minWidth: 860,
    minHeight: 600,
    title: "자이언트짐 AI 운영팀",
    webPreferences: {
      preload: join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  // 렌더러는 정적 파일이라 소스 폴더에서 직접 로드 (tsc 빌드 대상 아님)
  win.loadFile(join(__dirname, "..", "..", "src", "renderer", "index.html"));
}

// 사무실 미니 애니메이션용: 특정 팀원의 상태(working/done)와 말풍선 문구를 렌더러로 보낸다.
function agentState(agent: string, state: "working" | "done", bubble?: string) {
  send("agent-state", { agent, state, bubble });
}

// 총괄 AI 1회 실행: 상태를 캐릭터 UI로 흘려보낸다.
async function runJay(reason: string): Promise<OrchestratorResult | null> {
  if (running) return null;
  running = true;
  send("state", "thinking");
  send("log", `제이가 분석을 시작했어요 (${reason})`);
  agentState("jay", "working");
  try {
    const result = await runOrchestrator();
    send("state", "reporting");
    saveResult(result);
    updateTaskProgress(result.tasks, result.periodLabel);
    send("result", result);
    send("task-progress", getTaskProgress());
    send("log", `분석 완료: 업무 ${result.tasks.length}건 도출`);
    agentState("jay", "done", `업무 ${result.tasks.length}건 도출!`);

    // 미나: 재등록/이탈위험/미수금 대상 회원에게 보낼 문자 초안 생성 (반자동, 발송은 하지 않음)
    agentState("mina", "working");
    const mina = await generateMemberMessages(result.context);
    send("mina", mina);
    send("log", `미나가 문자 초안 ${mina.messages.length}건 작성`);
    agentState("mina", "done", `문자 ${mina.messages.length}건 작성!`);

    // 데이터: 퍼널 병목·채널 효율 진단
    agentState("data", "working");
    const funnel = await analyzeFunnel(result.context);
    send("funnel", funnel);
    send("log", "데이터가 퍼널 분석을 마쳤어요");
    agentState("data", "done", "퍼널 분석 완료!");

    // 루나: 이번 주 콘텐츠 초안 (블로그/인스타, 반자동 - 발행은 하지 않음)
    agentState("luna", "working");
    const content = await generateContentIdeas(result.context, funnel);
    send("content", content);
    send("log", `루나가 콘텐츠 초안 ${content.ideas.length}건 작성`);
    agentState("luna", "done", `콘텐츠 ${content.ideas.length}건 작성!`);

    // Notion: 오늘의 브리핑을 기록 (설정된 경우에만, 실패해도 앱 동작에는 영향 없음)
    const notion = await pushDailyReport(result, mina, funnel, content);
    send("log", notion.ok ? "노션에 브리핑 저장 완료" : `노션 저장 안 함: ${notion.error}`);

    // 카카오톡: "나에게 보내기"로 브리핑 발송 (설정된 경우에만, 실패해도 앱 동작에는 영향 없음)
    const kakao = await pushDailyBriefingKakao(result, mina, funnel, content);
    send("log", kakao.ok ? "카카오톡으로 브리핑 발송 완료" : `카카오톡 발송 안 함: ${kakao.error}`);

    // 드라이브: 재무·회원 스프레드시트를 로컬에 백업 (인증 안 돼 있으면 조용히 건너뜀)
    try {
      const index = await buildIndex();
      const backup = await backupSpreadsheets(index);
      send("log", `드라이브 백업 완료 (신규/갱신 ${backup.backed}개)`);
    } catch (err: any) {
      send("log", `드라이브 백업 안 함: ${err?.message ?? err}`);
    }

    return result;
  } catch (err: any) {
    send("state", "idle");
    send("log", `오류: ${err?.message ?? err}`);
    return null;
  } finally {
    running = false;
    setTimeout(() => send("state", "idle"), 4000);
  }
}

// 급여 정산 AI: 매월 9일, 전월 트레이너 정산 오류 점검 → 문제없으면 구글 시트 작성 → 대표에게 보고.
async function runPayrollJob(reason: string) {
  send("log", `지영이 급여 정산을 시작했어요 (${reason})`);
  agentState("jiyoung", "working");
  try {
    const result = await runPayroll();
    if (result.issues.length > 0) {
      send("log", `급여 정산 중단 — 오류 ${result.issues.length}건 발견`);
      agentState("jiyoung", "done", `오류 ${result.issues.length}건 발견, 정산 중단`);
      await pushPayrollReport(result);
      return;
    }
    const { url } = await writePayrollSheet(result);
    send("log", `급여 정산 완료 — 구글 시트 작성 완료 (${result.yearMonth})`);
    agentState("jiyoung", "done", `${result.yearMonth} 정산 완료!`);
    await pushPayrollReport(result, url);
  } catch (err: any) {
    send("log", `급여 정산 오류: ${err?.message ?? err}`);
    agentState("jiyoung", "done", "오류 발생");
  }
}

// 리포 AI: 매달 1일, 전월 지점별(1호점/2호점) + 통합 전략 리포트를 만들어 노션에 보고.
async function runRepoJob(reason: string) {
  send("log", `리포가 월간 전략 리포트 작성을 시작했어요 (${reason})`);
  agentState("repo", "working");
  try {
    const result = await runRepo();
    saveRepoResult(result);
    send("repo", result);
    send("log", `리포 작성 완료 (${result.yearMonth})`);
    agentState("repo", "done", `${result.yearMonth} 전략 리포트 완료!`);
    if (result.expenseMissing) {
      addManualTask({
        title: `${result.yearMonth} 지출 입력 필요 (운영 시스템)`,
        assigneeRole: "대표",
        priority: "high",
        reason: "지출 미입력 상태라 리포 AI의 순이익 분석이 부정확함. 운영 시스템에 해당 월 지출을 입력해야 함.",
        mode: "manual",
      });
      send("task-progress", getTaskProgress());
    }
    const notion = await pushRepoReport(result);
    send("log", notion.ok ? "노션에 전략 리포트 저장 완료" : `노션 저장 안 함: ${notion.error}`);
  } catch (err: any) {
    send("log", `리포 오류: ${err?.message ?? err}`);
    agentState("repo", "done", "오류 발생");
  }
}

// 사업 일지: 매일 밤, 그날 앱에서 진행된 일 + 데이터를 묶어 노션 "사업 일지"에 기록.
async function runJournalJob(reason: string) {
  send("log", `제이가 오늘의 사업 일지를 정리하고 있어요 (${reason})`);
  agentState("jay", "working");
  try {
    const entry = await runJournal();
    send("log", "사업 일지 정리 완료");
    agentState("jay", "done", "오늘의 사업 일지 완료!");
    const notion = await pushJournalEntry(entry);
    send("log", notion.ok ? "노션에 사업 일지 저장 완료" : `노션 저장 안 함: ${notion.error}`);
  } catch (err: any) {
    send("log", `사업 일지 오류: ${err?.message ?? err}`);
    agentState("jay", "done", "오류 발생");
  }
}

async function runIfkJobWrapper(reason: string) {
  send("log", `피트니스경영신문 기사 등록대기를 시작했어요 (${reason})`);
  try {
    const result = await runIfkJob();
    if (result.skipped) {
      send("log", `IFK 기사 건너뜀: ${result.error}`);
      return;
    }
    if (!result.ok) {
      send("log", `IFK 기사 등록대기 실패: ${result.error}`);
      return;
    }
    send("log", `IFK 기사 등록대기 완료 — "${result.title}" (작성자: ${result.reporterName})`);
  } catch (err: any) {
    send("log", `IFK 기사 오류: ${err?.message ?? err}`);
  }
}

function setupTray() {
  try {
    const iconPath = join(__dirname, "..", "..", "assets", "tray-icon.png");
    tray = new Tray(nativeImage.createFromPath(iconPath));
    tray.setToolTip("자이언트짐 AI 운영팀");
    tray.setContextMenu(
      Menu.buildFromTemplate([
        { label: "창 열기", click: () => (win ? win.show() : createWindow()) },
        { label: "지금 분석", click: () => runJay("트레이 수동") },
        { label: "급여 정산 지금 실행", click: () => runPayrollJob("트레이 수동") },
        { label: "전략 리포트 지금 실행", click: () => runRepoJob("트레이 수동") },
        { label: "사업 일지 지금 작성", click: () => runJournalJob("트레이 수동") },
        { type: "separator" },
        { label: "종료", click: () => app.quit() },
      ])
    );
  } catch {
    // 트레이 아이콘 미지원 환경은 무시
  }
}

app.whenReady().then(() => {
  createWindow();
  setupTray();

  ipcMain.handle("run-now", () => runJay("수동 실행"));
  ipcMain.handle("mark-contacted", (_e, category: string, name: string, phone: string | null) => {
    markContacted(category, name, phone);
    return { success: true };
  });
  ipcMain.handle(
    "send-sms",
    async (_e, target: { category: string; name: string; phone: string | null; message: string }) => {
      if (!target.phone) return { ok: false, error: "받는 사람 번호가 없습니다." };
      const result = await sendSms(target.phone, target.message);
      if (result.ok) markContacted(target.category, target.name, target.phone);
      return result;
    }
  );
  ipcMain.handle("get-command-history", (_e, agentId: string) => getRecentCommands(agentId, 20));
  ipcMain.handle("get-repo-report", () => loadRepoResult(previousYearMonth()));
  ipcMain.handle("run-repo-now", () => runRepoJob("수동 실행"));
  ipcMain.handle("run-journal-now", () => runJournalJob("수동 실행"));
  ipcMain.handle("get-task-progress", () => getTaskProgress());
  ipcMain.handle("toggle-task-progress", (_e, id: string) => toggleTaskProgress(id));
  ipcMain.handle("get-team-roles", () => {
    const team = JSON.parse(readFileSync(join(__dirname, "..", "..", "config", "team.json"), "utf-8"));
    const order = ["jay", "mina", "data", "luna", "repo", "jiyoung"];
    const byId: Record<string, { name: string; role: string; emoji: string }> = {
      jay: { name: team.orchestrator.name, role: team.orchestrator.role, emoji: team.orchestrator.emoji },
    };
    for (const m of team.team) byId[m.id] = { name: m.name, role: m.role, emoji: m.emoji };
    return order.filter((id) => byId[id]).map((id) => byId[id]);
  });
  ipcMain.handle("run-command", async (_e, instruction: string, agentId?: string) => {
    const agent = agentId || "jay";
    send("command-state", "thinking");
    agentState(agent, "working");
    const result = await runCommand(instruction, agentId);
    send("command-state", "idle");
    agentState(agent, "done", "답변 완료!");
    return result;
  });

  // 시작 시 자동 분석 — 오늘 이미 분석한 결과가 있으면(같은 날 앱을 여러 번 켜도) API를 다시 부르지 않고
  // 저장된 결과만 화면에 띄운다. 크레딧 절약을 위함 (매일 예약 분석은 아래 cron이 그대로 처리한다).
  win?.webContents.once("did-finish-load", () => {
    const cachedRepo = loadRepoResult(previousYearMonth());
    if (cachedRepo) {
      send("repo", cachedRepo);
      // 지출 미입력이 해결 안 된 채로 남아있으면 고쳐질 때까지 매일 다시 오늘의 업무에 띄운다.
      if (cachedRepo.expenseMissing) {
        addManualTask({
          title: `${cachedRepo.yearMonth} 지출 입력 필요 (운영 시스템)`,
          assigneeRole: "대표",
          priority: "high",
          reason: "지출 미입력 상태라 리포 AI의 순이익 분석이 부정확함. 운영 시스템에 해당 월 지출을 입력해야 함.",
          mode: "manual",
        });
      }
    }

    const cached = loadTodaysResult();
    if (cached) {
      send("log", `오늘(${cached.periodLabel} 브리핑) 이미 분석을 마쳐서 재실행하지 않았어요.`);
      send("result", cached);
      send("task-progress", getTaskProgress());
      return;
    }
    runJay("앱 시작");
  });

  // 매일 정해진 시간 자동 분석 (기본 09:00)
  const spec = process.env.DAILY_CRON || "0 9 * * *";
  if (cron.validate(spec)) {
    cron.schedule(spec, () => runJay("매일 예약"));
  }

  // 급여 정산 AI: 매월 9일 09:00 (기본값), 전월 급여 정산
  const payrollSpec = process.env.PAYROLL_CRON || "0 9 9 * *";
  if (cron.validate(payrollSpec)) {
    cron.schedule(payrollSpec, () => runPayrollJob("매월 9일 예약"));
  }

  // 리포 AI: 매월 1일 09:00 (기본값), 전월 지점별 전략 리포트
  const repoSpec = process.env.REPO_CRON || "0 9 1 * *";
  if (cron.validate(repoSpec)) {
    cron.schedule(repoSpec, () => runRepoJob("매월 1일 예약"));
  }

  // 사업 일지: 매일 밤 22:00 (기본값), 그날 하루 마감 정리
  const journalSpec = process.env.JOURNAL_CRON || "0 22 * * *";
  if (cron.validate(journalSpec)) {
    cron.schedule(journalSpec, () => runJournalJob("매일 22시 예약"));
  }

  // 피트니스경영신문(IFK) 기사 등록대기: 매일 11:00 (기본값)
  const ifkSpec = process.env.IFK_CRON || "0 11 * * *";
  if (cron.validate(ifkSpec)) {
    cron.schedule(ifkSpec, () => runIfkJobWrapper("매일 11시 예약"));
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// 트레이 상주: 창을 닫아도 백그라운드에서 24시간 유지.
// 핸들러를 등록하고 app.quit()을 호출하지 않으면 자동 종료가 막힌다.
app.on("window-all-closed", () => {
  // 의도적으로 종료하지 않음 (트레이에서 종료 선택)
});
