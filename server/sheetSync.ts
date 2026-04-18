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

export async function fetchSheetCsv(csvUrl: string): Promise<string> {
  const res = await fetch(csvUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; ZIANTGYM/1.0)",
      "Accept": "text/csv, text/plain, */*",
    },
    redirect: "follow",
  });
  return res.text();
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
    const csvUrl = sheetUrlToCsvUrl(config.sheetUrl);
    text = await fetchSheetCsv(csvUrl);
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

  const mapping = JSON.parse(config.mappingJson) as Record<string, string>;
  const fi: Record<string, number> = {};
  for (const [col, field] of Object.entries(mapping)) {
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
