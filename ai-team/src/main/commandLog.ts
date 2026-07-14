// 팀원별 지시 이력 저장소 — "최근에 뭐 시켰지", "그거 다시 해줘" 같은 요청에 답할 수 있도록
// 사장님이 각 팀원에게 내린 지시와 그 답변을 로컬에 남긴다. 로컬 JSON 파일 (이 PC에서만 유지).
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";

export interface CommandLogEntry {
  agentId: string;
  instruction: string;
  reply: string;
  at: string; // ISO
}

const LOG_PATH = join(__dirname, "..", "..", "output", "command-log.json");
const MAX_PER_AGENT = 20;

function loadAll(): CommandLogEntry[] {
  if (!existsSync(LOG_PATH)) return [];
  try {
    return JSON.parse(readFileSync(LOG_PATH, "utf-8"));
  } catch {
    return [];
  }
}

function saveAll(entries: CommandLogEntry[]) {
  mkdirSync(join(__dirname, "..", "..", "output"), { recursive: true });
  writeFileSync(LOG_PATH, JSON.stringify(entries, null, 2), "utf-8");
}

/** 지시 하나를 기록한다. 같은 팀원 기록이 너무 쌓이면 오래된 것부터 정리한다. */
export function appendCommandLog(agentId: string, instruction: string, reply: string) {
  const entries = loadAll();
  entries.push({ agentId, instruction, reply, at: new Date().toISOString() });

  const forAgent = entries.filter((e) => e.agentId === agentId);
  if (forAgent.length > MAX_PER_AGENT) {
    const dropCount = forAgent.length - MAX_PER_AGENT;
    const toDrop = new Set(forAgent.slice(0, dropCount));
    const kept = entries.filter((e) => !toDrop.has(e));
    saveAll(kept);
    return;
  }
  saveAll(entries);
}

/** 특정 팀원이 최근 받은 지시 이력을 오래된 순으로 돌려준다(최신이 마지막). */
export function getRecentCommands(agentId: string, limit = 8): CommandLogEntry[] {
  const forAgent = loadAll().filter((e) => e.agentId === agentId);
  return forAgent.slice(-limit);
}
