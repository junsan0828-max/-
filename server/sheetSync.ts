import { db } from "./db";
import { sheetSyncConfig, sheetPendingMembers } from "../drizzle/schema";

export function sheetUrlToCsvUrl(url: string): string {
  const idMatch = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (!idMatch) throw new Error("올바른 구글시트 URL이 아닙니다.");
  const sheetId = idMatch[1];
  const gidMatch = url.match(/[#&?]gid=([0-9]+)/);
  const gid = gidMatch ? gidMatch[1] : "0";
  return `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
}

export async function fetchSheetCsv(sheetUrl: string): Promise<string> {
  const idMatch = sheetUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (!idMatch) throw new Error("올바른 구글시트 URL이 아닙니다.");
  const sheetId = idMatch[1];
  const gidMatch = sheetUrl.match(/[#&?]gid=([0-9]+)/);
  const gid = gidMatch ? gidMatch[1] : "0";

  const candidates = [
    `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&gid=${gid}`,
    `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`,
    `https://docs.google.com/spreadsheets/d/${sheetId}/pub?output=csv&gid=${gid}`,
  ];

  const headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/csv, text/plain, */*",
  };

  for (const url of candidates) {
    try {
      const res = await fetch(url, { headers, redirect: "follow" });
      const text = await res.text();
      if (!text.trimStart().startsWith("<!") && text.trim().length > 0) {
        return text;
      }
    } catch {
      continue;
    }
  }

  throw new Error("시트에 접근할 수 없습니다.");
}

export function parseCSV(text: string): string[][] {
  return text
    .split(/\r?\n/)
    .filter((l) => l.trim())
    .map((line) => {
      const cells: string[] = [];
      let cur = "";
      let inQ = false;
      for (let i = 0; i < line.length; i++) {
        if (line[i] === '"') {
          if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
          else inQ = !inQ;
        } else if (line[i] === "," && !inQ) {
          cells.push(cur.trim()); cur = "";
        } else {
          cur += line[i];
        }
      }
      cells.push(cur.trim());
      return cells;
    });
}

export async function syncSheetNow(): Promise<{ newMembers: number; message: string }> {
  const configs = await db.select().from(sheetSyncConfig).limit(1);
  const config = configs[0];
  if (!config || !config.enabled) return { newMembers: 0, message: "동기화 비활성화됨" };

  let text: string;
  try {
    text = await fetchSheetCsv(config.sheetUrl);
  } catch {
    return { newMembers: 0, message: "네트워크 오류" };
  }

  if (text.trimStart().startsWith("<!")) {
    return { newMembers: 0, message: "시트에 접근할 수 없습니다." };
  }

  const allRows = parseCSV(text);
  if (allRows.length < 2) return { newMembers: 0, message: "데이터 없음" };

  const offset = config.columnOffset ?? 1;
  const headers = allRows[0].slice(offset);
  const dataRows = allRows.slice(1).filter((r) => r.slice(offset).some((c) => c.trim()));
  const newRows = dataRows.slice(config.lastSyncedCount);

  if (!newRows.length) return { newMembers: 0, message: "새 데이터 없음" };

  // 컬럼 자동 매핑 (저장된 매핑 없으면 헤더명으로 자동 추론)
  const AUTO_GUESS: Record<string, string> = {
    이름: "name", 성명: "name",
    연락처: "phone", 전화번호: "phone", 휴대폰: "phone", 핸드폰: "phone",
    이메일: "email",
    생년월일: "birthDate", 생일: "birthDate",
    성별: "gender",
    등급: "grade",
    상태: "status",
    시작일: "membershipStart", 등록일: "membershipStart", 가입일: "membershipStart", 회원권시작: "membershipStart",
    만료일: "membershipEnd", 종료일: "membershipEnd", 회원권만료: "membershipEnd",
    특이사항: "profileNote", 메모: "profileNote", 비고: "profileNote",
    패키지: "ptProgram", PT프로그램: "ptProgram", 프로그램: "ptProgram",
    횟수: "ptSessions", PT횟수: "ptSessions", 세션: "ptSessions", 등록횟수: "ptSessions",
    결제금액: "paymentAmount", 금액: "paymentAmount",
    미수금: "unpaidAmount",
    결제방법: "paymentMethod",
  };

  let savedMapping = JSON.parse(config.mappingJson) as Record<string, string>;
  // 저장된 매핑이 비어있으면 헤더 자동 추론
  if (Object.keys(savedMapping).length === 0) {
    savedMapping = {};
    for (const h of headers) {
      const key = h.trim().replace(/\s/g, "");
      savedMapping[h] = AUTO_GUESS[h] ?? AUTO_GUESS[key] ?? "skip";
    }
  }
  const fi: Record<string, number> = {};
  for (const [col, field] of Object.entries(savedMapping)) {
    if (field === "skip") continue;
    const idx = headers.indexOf(col);
    if (idx !== -1) fi[field] = idx;
  }

  const getField = (row: string[], field: string): string | undefined => {
    const sliced = row.slice(offset);
    return fi[field] !== undefined ? sliced[fi[field]]?.trim() || undefined : undefined;
  };

  let count = 0;
  for (let i = 0; i < newRows.length; i++) {
    const row = newRows[i];
    const name = getField(row, "name");
    if (!name) continue;

    const ptSessionsRaw = getField(row, "ptSessions");
    const ptSessions = ptSessionsRaw ? parseInt(ptSessionsRaw.replace(/[^0-9]/g, "")) || null : null;
    const paymentRaw = getField(row, "paymentAmount");
    const paymentAmount = paymentRaw ? parseInt(paymentRaw.replace(/[^0-9]/g, "")) || null : null;
    const unpaidRaw = getField(row, "unpaidAmount");
    const unpaidAmount = unpaidRaw ? parseInt(unpaidRaw.replace(/[^0-9]/g, "")) || null : null;

    await db.insert(sheetPendingMembers).values({
      name,
      phone: getField(row, "phone") ?? null,
      email: getField(row, "email") ?? null,
      birthDate: getField(row, "birthDate") ?? null,
      gender: getField(row, "gender") ?? null,
      grade: getField(row, "grade") ?? null,
      membershipStart: getField(row, "membershipStart") ?? null,
      membershipEnd: getField(row, "membershipEnd") ?? null,
      profileNote: getField(row, "profileNote") ?? null,
      ptProgram: getField(row, "ptProgram") ?? null,
      ptSessions,
      paymentAmount,
      unpaidAmount,
      paymentMethod: getField(row, "paymentMethod") ?? null,
      sheetRowIndex: config.lastSyncedCount + i + 1,
    });
    count++;
  }

  await db
    .update(sheetSyncConfig)
    .set({ lastSyncedCount: config.lastSyncedCount + newRows.length, syncedAt: new Date().toISOString() });

  return { newMembers: count, message: `${count}명 신규 등록` };
}
