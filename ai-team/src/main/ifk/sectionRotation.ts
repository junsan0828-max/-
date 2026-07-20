// 2차섹션(NEWS / 업계소식)을 기사마다 번갈아 사용한다. (reporters.ts와 같은 로컬 상태 저장 패턴)
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";

export const SECTION_NEWS = "20140925150956_9506"; // 2차섹션 = NEWS
export const SECTION_INDUSTRY_NEWS = "20140925151000_1727"; // 2차섹션 = 업계소식

const ROTATION = [SECTION_NEWS, SECTION_INDUSTRY_NEWS];

const STATE_PATH = join(__dirname, "..", "..", "..", "output", "ifk-section-rotation.json");

function loadLastIndex(): number {
  if (!existsSync(STATE_PATH)) return -1;
  try {
    return JSON.parse(readFileSync(STATE_PATH, "utf-8")).lastIndex ?? -1;
  } catch {
    return -1;
  }
}

function saveLastIndex(index: number) {
  mkdirSync(join(__dirname, "..", "..", "..", "output"), { recursive: true });
  writeFileSync(STATE_PATH, JSON.stringify({ lastIndex: index }, null, 2), "utf-8");
}

/** NEWS ↔ 업계소식을 순번대로 반환하고, 로테이션 상태를 한 칸 진행시킨다. */
export function nextSecondarySection(): string {
  const nextIndex = (loadLastIndex() + 1) % ROTATION.length;
  saveLastIndex(nextIndex);
  return ROTATION[nextIndex];
}
