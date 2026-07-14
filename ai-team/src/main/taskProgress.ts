// 오늘의 업무 리스트 진행도 저장소 — 제이가 도출한 업무를 대시보드/업무내역/분석내역 상단에
// 항상 띄워두고, 체크해서 진행 상황을 표시할 수 있게 한다. 로컬 JSON (이 PC에서만 유지).
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { TeamTask } from "./orchestrator";

export interface TaskProgressItem extends TeamTask {
  id: string;
  done: boolean;
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

/** 오늘 새로 도출된 업무로 갱신한다. 같은 날 재실행이면 이미 체크해둔 항목은 제목으로 매칭해 유지한다. */
export function updateTaskProgress(tasks: TeamTask[], periodLabel: string): TaskProgressState {
  const today = todayStr();
  const prev = load();
  const prevDone = new Set(prev && prev.date === today ? prev.items.filter((i) => i.done).map((i) => i.title) : []);

  const items: TaskProgressItem[] = tasks.map((t, i) => ({
    ...t,
    id: `${today}-${i}`,
    done: prevDone.has(t.title),
  }));

  const state: TaskProgressState = { date: today, periodLabel, items };
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
