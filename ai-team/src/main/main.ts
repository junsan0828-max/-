import { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage } from "electron";
import { join } from "node:path";
import * as dotenv from "dotenv";
import cron from "node-cron";
import { runOrchestrator, saveResult, OrchestratorResult } from "./orchestrator";
import { generateMemberMessages } from "./mina";
import { analyzeFunnel } from "./dataAgent";
import { generateContentIdeas } from "./luna";
import { markContacted } from "./store";
import { runCommand } from "./commander";
import { pushDailyReport } from "./notion";

dotenv.config({ path: join(__dirname, "..", "..", ".env") });

let win: BrowserWindow | null = null;
let tray: Tray | null = null;
let running = false;

function send(channel: string, payload?: unknown) {
  win?.webContents.send(channel, payload);
}

function createWindow() {
  win = new BrowserWindow({
    width: 420,
    height: 640,
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
    send("result", result);
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

function setupTray() {
  try {
    tray = new Tray(nativeImage.createEmpty());
    tray.setToolTip("자이언트짐 AI 운영팀");
    tray.setContextMenu(
      Menu.buildFromTemplate([
        { label: "창 열기", click: () => (win ? win.show() : createWindow()) },
        { label: "지금 분석", click: () => runJay("트레이 수동") },
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
  ipcMain.handle("run-command", async (_e, instruction: string) => {
    send("command-state", "thinking");
    const result = await runCommand(instruction);
    send("command-state", "idle");
    return result;
  });

  // 시작 시 1회 자동 분석
  win?.webContents.once("did-finish-load", () => runJay("앱 시작"));

  // 매일 정해진 시간 자동 분석 (기본 09:00)
  const spec = process.env.DAILY_CRON || "0 9 * * *";
  if (cron.validate(spec)) {
    cron.schedule(spec, () => runJay("매일 예약"));
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
