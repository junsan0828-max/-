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
import { pushDailyReport, pushPayrollReport, pushMonthlyReport, pushJournalEntry } from "./notion";
import { pushDailyBriefingKakao, pushKakaoText } from "./kakao";
import { buildIndex, backupSpreadsheets } from "./drive/archive";
import { runPayroll, writePayrollSheet } from "./payroll";
import { runMonthlyOverview, saveMonthlyOverview, loadMonthlyOverview, buildMonthlyKakaoText, previousYearMonth } from "./repo";
import { runJournal } from "./journal";
import { runIfkJob } from "./ifk";
import { runBlogEventJob } from "./blogEvent";
import { runAutoMessageJob } from "./autoMessage";
import { processPendingPointClaims } from "./pointClaims";
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

    // 업무관리/업무 로그 기록 제외 (2026-08-18 대표 지시) — 보고서 저장까지만 하고
    // "업무관리"/"업무 로그" 데이터베이스에는 더 이상 쓰지 않는다.

    // 카카오톡 브리핑 발송 (2026-08-17 재개: 자이언트짐 AI 알림 앱으로 "나에게 보내기" 연동 완료)
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

// 리포 AI: 매달 1일, 전월 월간 총 데이터(전월 대비 매출 등 핵심 지표)를 노션 "월간 보고"에
// 기록하고 카카오톡으로 요약을 보낸다 (2026-08-18 대표 지시 — 지점별 전략 에세이는 더 이상 안 씀).
async function runRepoJob(reason: string) {
  send("log", `리포가 월간 보고 작성을 시작했어요 (${reason})`);
  agentState("repo", "working");
  try {
    const result = await runMonthlyOverview();
    saveMonthlyOverview(result);
    send("repo", result);
    send("log", `월간 보고 작성 완료 (${result.yearMonth})`);
    agentState("repo", "done", `${result.yearMonth} 월간 보고 완료!`);
    if (result.dataNotes.some((n) => n.includes("지출"))) {
      addManualTask({
        title: `${result.yearMonth} 지출 입력 필요 (운영 시스템)`,
        assigneeRole: "대표",
        priority: "high",
        reason: "지출 미입력 상태라 순이익 수치가 부정확함. 운영 시스템에 해당 월 지출을 입력해야 함.",
        mode: "manual",
      });
      send("task-progress", getTaskProgress());
    }
    const notion = await pushMonthlyReport(result);
    send("log", notion.ok ? "노션에 월간 보고 저장 완료" : `노션 저장 안 함: ${notion.error}`);
    const kakao = await pushKakaoText(buildMonthlyKakaoText(result));
    send("log", kakao.ok ? "카카오톡으로 월간 보고 발송 완료" : `카카오톡 발송 안 함: ${kakao.error}`);
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

async function runBlogEventJobWrapper(reason: string) {
  send("log", `블로그 인증 이벤트 확인을 시작했어요 (${reason})`);
  try {
    const result = await runBlogEventJob();
    if (result.skipped) {
      send("log", `블로그 이벤트 건너뜀: ${result.error}`);
      return;
    }
    if (!result.ok) {
      send("log", `블로그 이벤트 등록 실패: ${result.error}`);
      return;
    }
    send("log", `블로그 인증 이벤트 등록 완료 — "${result.post?.title}"`);
  } catch (err: any) {
    send("log", `블로그 이벤트 오류: ${err?.message ?? err}`);
  }
}

async function runAutoMessageJobWrapper(reason: string) {
  send("log", `자동 문자(만료 D-10/D-5·관리상담 D+1) 발송을 시작했어요 (${reason})`);
  try {
    const result = await runAutoMessageJob();
    if (!result.ok) {
      send("log", `자동 문자 발송 실패: ${result.error}`);
      return;
    }
    const line = (result.summary ?? [])
      .map((s) => `${s.category} 대상${s.targeted}/발송${s.sent}/실패${s.failed}`)
      .join(", ");
    send("log", `자동 문자 발송 완료 — ${line}`);
  } catch (err: any) {
    send("log", `자동 문자 발송 오류: ${err?.message ?? err}`);
  }
}

async function runPointClaimsJobWrapper() {
  try {
    const results = await processPendingPointClaims();
    const approved = results.filter((r) => r.approved);
    if (approved.length > 0) {
      send("log", `포인트 자동 적립 ${approved.length}건 완료`);
    }
  } catch (err: any) {
    send("log", `포인트 자동 적립 확인 오류: ${err?.message ?? err}`);
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
        { label: "월간 보고 지금 실행", click: () => runRepoJob("트레이 수동") },
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
  ipcMain.handle("get-repo-report", () => loadMonthlyOverview(previousYearMonth()));
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
    const cachedRepo = loadMonthlyOverview(previousYearMonth());
    if (cachedRepo) {
      send("repo", cachedRepo);
      // 지출 미입력이 해결 안 된 채로 남아있으면 고쳐질 때까지 매일 다시 오늘의 업무에 띄운다.
      if (cachedRepo.dataNotes.some((n) => n.includes("지출"))) {
        addManualTask({
          title: `${cachedRepo.yearMonth} 지출 입력 필요 (운영 시스템)`,
          assigneeRole: "대표",
          priority: "high",
          reason: "지출 미입력 상태라 순이익 수치가 부정확함. 운영 시스템에 해당 월 지출을 입력해야 함.",
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

  // 피트니스경영신문(IFK) 기사 등록대기: 매시 정각 (기본값) — 마감 시각에 기사가 안 써져 있어도
  // 다음 정각에 재시도하고, 밀린 기사는 매시 하나씩 순서대로 소진한다.
  const ifkSpec = process.env.IFK_CRON || "0 * * * *";
  if (cron.validate(ifkSpec)) {
    cron.schedule(ifkSpec, () => runIfkJobWrapper("매시 정각 예약"));
  }

  // 블로그 인증 이벤트: 3시간마다 새 글 확인 (기본값). 새 글이 없으면 그냥 건너뜀.
  const blogEventSpec = process.env.BLOG_EVENT_CRON || "0 */3 * * *";
  if (cron.validate(blogEventSpec)) {
    cron.schedule(blogEventSpec, () => runBlogEventJobWrapper("3시간마다 예약"));
  }

  // 자동 문자: 매일 13시(기본값) — 헬스권 만료 D-10/D-5 안내 + 관리상담 D+1 후속 안내.
  // 실제 예약발송은 13시 클라우드 루틴이 담당하고, 이건 데스크톱 앱이 열려 있을 때의 보조 실행이다.
  // auto_message_log(카테고리·대상·기준일 단위 성공기록)로 중복발송을 막기 때문에 둘 다 돌아도 안전하다.
  const autoMessageSpec = process.env.AUTO_MESSAGE_CRON || "0 13 * * *";
  if (cron.validate(autoMessageSpec)) {
    cron.schedule(autoMessageSpec, () => runAutoMessageJobWrapper("매일 13시 예약"));
  }

  // 포인트 적립 신청 자동 승인: 1분마다 확인 (기본값). 대기 중인 신청이 없으면 그냥 건너뜀.
  // 매번 브라우저를 새로 설치하는 클라우드 예약작업과 달리, 상주 중인 이 앱에서만 돈다
  // (3분 이내 인식이라는 요건상 클라우드 왕복(체크아웃+설치)으로는 속도를 맞출 수 없음).
  const pointClaimsSpec = process.env.POINT_CLAIMS_CRON || "*/1 * * * *";
  if (cron.validate(pointClaimsSpec)) {
    cron.schedule(pointClaimsSpec, () => runPointClaimsJobWrapper());
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
