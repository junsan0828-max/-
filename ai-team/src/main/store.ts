// 처리 완료 기록 저장소 — "이미 연락한 회원을 다시 보여주지 않기" 위한 상태.
// 로컬 JSON 파일에 저장 (이 PC 안에서만 유지, git에는 포함하지 않음).
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";

interface ContactedEntry {
  key: string; // `${category}:${phone ?? name}`
  contactedAt: string; // ISO
}

const STORE_PATH = join(__dirname, "..", "..", "output", "contacted.json");

function loadAll(): ContactedEntry[] {
  if (!existsSync(STORE_PATH)) return [];
  try {
    return JSON.parse(readFileSync(STORE_PATH, "utf-8"));
  } catch {
    return [];
  }
}

function saveAll(entries: ContactedEntry[]) {
  mkdirSync(join(__dirname, "..", "..", "output"), { recursive: true });
  writeFileSync(STORE_PATH, JSON.stringify(entries, null, 2), "utf-8");
}

function keyOf(category: string, name: string, phone: string | null) {
  return `${category}:${phone || name}`;
}

/** 방금 연락 완료 처리한 대상을 기록한다. */
export function markContacted(category: string, name: string, phone: string | null) {
  const entries = loadAll();
  const key = keyOf(category, name, phone);
  const filtered = entries.filter((e) => e.key !== key);
  filtered.push({ key, contactedAt: new Date().toISOString() });
  saveAll(filtered);
}

/** 최근 N일 내 이미 처리한 (category, name, phone) 조합인지 확인한다. */
export function isRecentlyContacted(category: string, name: string, phone: string | null, days = 7): boolean {
  const key = keyOf(category, name, phone);
  const cutoff = Date.now() - days * 864e5;
  return loadAll().some((e) => e.key === key && new Date(e.contactedAt).getTime() >= cutoff);
}
