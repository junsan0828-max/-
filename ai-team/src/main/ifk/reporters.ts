// IFK 기자검색에 등록된 계정 목록을 순서대로 로테이션한다.
// 로컬 JSON 파일에 마지막으로 쓴 인덱스만 저장 (store.ts와 같은 패턴, 이 PC 안에서만 유지).
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";

export interface IfkReporter {
  name: string;
  email: string;
}

// 2026-07-16 기준, IFK 관리자 "기자검색" 팝업에 등록되어 있던 계정 목록 (표시 순서 그대로).
export const IFK_REPORTERS: IfkReporter[] = [
  { name: "이준산", email: "junsan0828@gmail.com" },
  { name: "김나연", email: "nayeon081760@gmail.com" },
  { name: "김현석", email: "easy113@naver.com" },
  { name: "이다연", email: "dreamfitt@naver.com" },
  { name: "최성길", email: "dreamfitt@naver.com" },
  { name: "민문무", email: "minmunmu@naver.com" },
];

const STATE_PATH = join(__dirname, "..", "..", "..", "output", "ifk-reporter-rotation.json");

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

/** 다음 순서의 기자를 반환하고, 로테이션 상태를 한 칸 진행시킨다. */
export function nextReporter(): IfkReporter {
  const nextIndex = (loadLastIndex() + 1) % IFK_REPORTERS.length;
  saveLastIndex(nextIndex);
  return IFK_REPORTERS[nextIndex];
}
