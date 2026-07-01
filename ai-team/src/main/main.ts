import { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage } from "electron";
import { join } from "node:path";
import * as dotenv from "dotenv";
import cron from "node-cron";
import { runOrchestrator, saveResult, OrchestratorResult } from "./orchestrator";

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

// 총괄 AI 1회 실행: 상태를 캐릭터 UI로 흘려보낸다.
async function runJay(reason: string): Promise<OrchestratorResult | null> {
  if (running) return null;
  running = true;
  send("state", "thinking");
  send("log", `제이가 분석을 시작했어요 (${reason})`);
  try {
    const result = await runOrchestrator();
    send("state", "reporting");
    saveResult(result);
    send("result", result);
    send("log", `분석 완료: 업무 ${result.tasks.length}건 도출`);
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
