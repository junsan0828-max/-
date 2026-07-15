// 구글 드라이브 연동 — 드라이브에 저장된 파일(주로 매출/분석 스프레드시트)을 읽어
// AI팀(제이·데이터·루나)이 분석에 활용할 수 있게 한다. 읽기 전용.
import { google } from "googleapis";
import { getAuthorizedClient } from "./auth";

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
}

async function getDrive() {
  const auth = await getAuthorizedClient();
  return google.drive({ version: "v3", auth });
}

async function getSheets() {
  const auth = await getAuthorizedClient();
  return google.sheets({ version: "v4", auth });
}

/** 이름으로 드라이브 파일을 검색한다 (내 드라이브 + 공유받은 파일 포함). */
export async function searchFiles(query: string): Promise<DriveFile[]> {
  const drive = await getDrive();
  const res = await drive.files.list({
    q: `name contains '${query.replace(/'/g, "\\'")}' and trashed = false`,
    fields: "files(id, name, mimeType, modifiedTime)",
    pageSize: 20,
    orderBy: "modifiedTime desc",
  });
  return (res.data.files ?? []) as DriveFile[];
}

/** 폴더 안의 파일 목록. folderId 생략 시 내 드라이브에서 접근 가능한 전체 파일. */
export async function listFiles(folderId?: string): Promise<DriveFile[]> {
  const drive = await getDrive();
  const q = folderId ? `'${folderId}' in parents and trashed = false` : `trashed = false`;
  const res = await drive.files.list({
    q,
    fields: "files(id, name, mimeType, modifiedTime)",
    pageSize: 100,
    orderBy: "modifiedTime desc",
  });
  return (res.data.files ?? []) as DriveFile[];
}

/** 구글 스프레드시트를 2차원 문자열 배열로 읽는다. sheetName 생략 시 첫 번째 시트 전체. */
export async function readSpreadsheet(spreadsheetId: string, sheetName?: string): Promise<string[][]> {
  const sheets = await getSheets();
  const range = sheetName ? sheetName : (await sheets.spreadsheets.get({ spreadsheetId })).data.sheets?.[0]?.properties?.title;
  if (!range) return [];
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range });
  return (res.data.values ?? []) as string[][];
}

/** 스프레드시트 안의 시트(탭) 이름 목록. */
export async function listSheetTabs(spreadsheetId: string): Promise<string[]> {
  const sheets = await getSheets();
  const res = await sheets.spreadsheets.get({ spreadsheetId });
  return (res.data.sheets ?? []).map((s) => s.properties?.title ?? "").filter(Boolean);
}

/** 스프레드시트의 모든 탭을 한 번의 배치 요청으로 읽는다 (탭마다 따로 호출하는 것보다 API 쿼터를 훨씬 덜 쓴다). */
export async function readAllTabs(spreadsheetId: string): Promise<Record<string, string[][]>> {
  const sheets = await getSheets();
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const titles = (meta.data.sheets ?? []).map((s) => s.properties?.title).filter((t): t is string => !!t);
  if (titles.length === 0) return {};

  const res = await sheets.spreadsheets.values.batchGet({ spreadsheetId, ranges: titles });
  const result: Record<string, string[][]> = {};
  (res.data.valueRanges ?? []).forEach((vr, i) => {
    result[titles[i]] = (vr.values ?? []) as string[][];
  });
  return result;
}

/** 구글 문서(Docs)를 텍스트로 내보낸다. */
export async function readDocText(fileId: string): Promise<string> {
  const drive = await getDrive();
  const res = await drive.files.export({ fileId, mimeType: "text/plain" }, { responseType: "text" });
  return res.data as string;
}

/** 폴더 안에서 이름이 정확히 일치하는 파일을 찾는다 (없으면 undefined). */
export async function findFileInFolder(name: string, parentFolderId: string): Promise<string | undefined> {
  const drive = await getDrive();
  const q = `name = '${name.replace(/'/g, "\\'")}' and '${parentFolderId}' in parents and trashed = false`;
  const res = await drive.files.list({ q, fields: "files(id)" });
  return res.data.files?.[0]?.id ?? undefined;
}

/** 지정한 폴더 안에 새 구글 스프레드시트를 만든다. */
export async function createSpreadsheet(name: string, parentFolderId: string): Promise<string> {
  const drive = await getDrive();
  const res = await drive.files.create({
    requestBody: { name, mimeType: "application/vnd.google-apps.spreadsheet", parents: [parentFolderId] },
    fields: "id",
  });
  if (!res.data.id) throw new Error(`스프레드시트 생성 실패: ${name}`);
  return res.data.id;
}

/** 시트(탭)가 없으면 만든다. */
export async function ensureSheetTab(spreadsheetId: string, tabName: string): Promise<void> {
  const sheets = await getSheets();
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const exists = (meta.data.sheets ?? []).some((s) => s.properties?.title === tabName);
  if (exists) return;
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: { requests: [{ addSheet: { properties: { title: tabName } } }] },
  });
}

/** 지정한 범위(예: "시트이름!A1")부터 2차원 배열 값을 써넣는다. */
export async function writeValues(spreadsheetId: string, range: string, values: (string | number)[][]): Promise<void> {
  const sheets = await getSheets();
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range,
    valueInputOption: "USER_ENTERED",
    requestBody: { values },
  });
}
