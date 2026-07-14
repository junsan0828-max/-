// 오늘의 업무 리스트 진행도 저장소 — 제이가 도출한 업무를 대시보드/업무내역/분석내역 상단에
// 항상 띄워두고, 체크해서 진행 상황을 표시할 수 있게 한다. 로컬 JSON (이 PC에서만 유지).
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { TeamTask } from "./orchestrator";

export interface TaskProgressItem extends TeamTask {
  id: string;
  done: boolean;
  source?: "jay" | "manual"; // manual = 제이의 일일 분석이 아니라 다른 트리거(월간 리포트 등)가 추가한 업무
}
export interface TaskProgressState {
  date: string; // YYYY-MM-DD (KST 기준, 이 목록이 만들어진 날)
  periodLabel: string; // "어제" | "지난주(월~일)" 등 브리핑이 다루는 기간
  items: TaskProgressItem[];
}

const STORE_PATH = join(__dirname, "..", "..", "output", "task-progress.json");

function todayStr(): string {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" }); // YYYY-MM-DD
}

function load(): TaskProgressState | null {
  if (!existsSync(STORE_PATH)) return null;
  try {
    return JSON.parse(readFileSync(STORE_PATH, "utf-8"));
  } catch {
    return null;
  }
}

function save(state: TaskProgressState) {
  mkdirSync(join(__dirname, "..", "..", "output"), { recursive: true });
  writeFileSync(STORE_PATH, JSON.stringify(state, null, 2), "utf-8");
}

/** 제이가 오늘 새로 도출한 업무로 갱신한다. 같은 날 재실행이면 이미 체크해둔 항목은 제목으로 매칭해 유지하고,
 * 다른 트리거(월간 리포트 등)가 추가해둔 manual 업무는 건드리지 않는다. */
export function updateTaskProgress(tasks: TeamTask[], periodLabel: string): TaskProgressState {
  const today = todayStr();
  const prev = load();
  const sameDay = prev && prev.date === today;
  const prevDone = new Set(sameDay ? prev!.items.filter((i) => i.done).map((i) => i.title) : []);
  const keptManual = sameDay ? prev!.items.filter((i) => i.source === "manual") : [];

  const items: TaskProgressItem[] = [
    ...tasks.map((t, i) => ({
      ...t,
      id: `${today}-jay-${i}`,
      done: prevDone.has(t.title),
      source: "jay" as const,
    })),
    ...keptManual,
  ];

  const state: TaskProgressState = { date: today, periodLabel, items };
  save(state);
  return state;
}

/** 제이의 일일 분석과 무관하게, 다른 트리거(월간 리포트 등)가 오늘의 업무에 항목을 하나 추가한다.
 * 같은 제목이 오늘 이미 있으면 중복 추가하지 않는다. */
export function addManualTask(task: TeamTask): TaskProgressState {
  const today = todayStr();
  const prev = load();
  const state: TaskProgressState =
    prev && prev.date === today ? prev : { date: today, periodLabel: prev?.periodLabel ?? "", items: [] };

  if (!state.items.some((i) => i.source === "manual" && i.title === task.title)) {
    state.items.push({ ...task, id: `${today}-manual-${state.items.length}`, done: false, source: "manual" });
  }
  save(state);
  return state;
}

export function getTaskProgress(): TaskProgressState | null {
  return load();
}

export function toggleTaskProgress(id: string): TaskProgressState | null {
  const state = load();
  if (!state) return null;
  const item = state.items.find((i) => i.id === id);
  if (item) item.done = !item.done;
  save(state);
  return state;
}
