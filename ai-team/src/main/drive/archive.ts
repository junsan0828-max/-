// 구글 드라이브 파일을 카테고리별로 분류해 보기 쉬운 인덱스를 만들고,
// 재무·회원 관련 스프레드시트는 로컬에 스냅샷으로 백업해 AI팀(제이·데이터·루나)이
// 드라이브 API를 매번 호출하지 않고도 참고할 수 있게 한다.
import { google } from "googleapis";
import { writeFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { getAuthorizedClient } from "./auth";
import { readAllTabs, DriveFile } from "./drive";

const OUTPUT_DIR = join(__dirname, "..", "..", "..", "output", "drive-backup");
const SNAPSHOT_DIR = join(OUTPUT_DIR, "snapshots");
const ORGANIZE_ROOT_FOLDER = "AI팀 자동분류";
const FOLDER_MIME = "application/vnd.google-apps.folder";

export type DriveCategory = "재무·매출" | "회원 데이터" | "마케팅" | "인사·계약" | "교육 자료" | "운영 문서" | "기타";

/** "기타"는 헬스장과 무관한 개인 파일이 대부분이라 실제 드라이브 정리 대상에서 제외한다. */
const ORGANIZE_CATEGORIES: DriveCategory[] = ["재무·매출", "회원 데이터", "마케팅", "인사·계약", "교육 자료", "운영 문서"];

const CATEGORY_RULES: [DriveCategory, RegExp][] = [
  ["재무·매출", /매출|재무|손익|결산|정산|비용|예산|성과 데이터표|경영 대시보드/],
  ["회원 데이터", /회원|고객|명부|리드/],
  ["마케팅", /마케팅|광고|콘텐츠|블로그|캠페인|SNS|인스타|유튜브/i],
  ["인사·계약", /계약서|급여|직급|인사|근로|페이롤/],
  ["교육 자료", /교육|매뉴얼|가이드|과정|트레이닝/],
  ["운영 문서", /운영|보고서|일지|체크리스트|자이언트짐|ZTM|피트니스|가맹점/i],
];

function classify(name: string): DriveCategory {
  for (const [cat, re] of CATEGORY_RULES) {
    if (re.test(name)) return cat;
  }
  return "기타";
}

async function getDrive() {
  const auth = await getAuthorizedClient();
  return google.drive({ version: "v3", auth });
}

/** 접근 가능한 드라이브 파일 전체 목록 (페이지네이션 처리). */
export async function listAllFiles(): Promise<(DriveFile & { webViewLink?: string })[]> {
  const drive = await getDrive();
  const files: (DriveFile & { webViewLink?: string })[] = [];
  let pageToken: string | undefined;
  do {
    const res = await drive.files.list({
      q: "trashed = false",
      fields: "nextPageToken, files(id, name, mimeType, modifiedTime, webViewLink)",
      pageSize: 1000,
      pageToken,
    });
    files.push(...((res.data.files ?? []) as (DriveFile & { webViewLink?: string })[]));
    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken);
  return files;
}

export interface DriveIndexEntry {
  id: string;
  name: string;
  mimeType: string;
  category: DriveCategory;
  modifiedTime?: string;
  webViewLink?: string;
}

export interface DriveIndex {
  generatedAt: string;
  totalFiles: number;
  byCategory: Partial<Record<DriveCategory, DriveIndexEntry[]>>;
}

/** 드라이브 파일을 분류해서 카테고리별 인덱스를 만들고 JSON + 마크다운으로 저장한다. */
export async function buildIndex(): Promise<DriveIndex> {
  const files = await listAllFiles();
  const folderMime = "application/vnd.google-apps.folder";
  const byCategory: Partial<Record<DriveCategory, DriveIndexEntry[]>> = {};

  for (const f of files) {
    if (f.mimeType === folderMime) continue; // 폴더 자체는 인덱스에서 제외, 파일만 분류
    const category = classify(f.name);
    const entry: DriveIndexEntry = {
      id: f.id,
      name: f.name,
      mimeType: f.mimeType,
      category,
      modifiedTime: f.modifiedTime,
      webViewLink: f.webViewLink,
    };
    (byCategory[category] ??= []).push(entry);
  }

  for (const entries of Object.values(byCategory)) {
    entries?.sort((a, b) => (b.modifiedTime ?? "").localeCompare(a.modifiedTime ?? ""));
  }

  const index: DriveIndex = {
    generatedAt: new Date().toISOString(),
    totalFiles: files.filter((f) => f.mimeType !== folderMime).length,
    byCategory,
  };

  mkdirSync(OUTPUT_DIR, { recursive: true });
  writeFileSync(join(OUTPUT_DIR, "index.json"), JSON.stringify(index, null, 2), "utf-8");
  writeFileSync(join(OUTPUT_DIR, "index.md"), renderIndexMarkdown(index), "utf-8");
  return index;
}

function renderIndexMarkdown(index: DriveIndex): string {
  const lines: string[] = [
    `# 구글 드라이브 자료 정리`,
    `${new Date(index.generatedAt).toLocaleString("ko-KR")} 기준, 총 ${index.totalFiles}개 파일`,
    "",
  ];
  for (const [category, entries] of Object.entries(index.byCategory)) {
    lines.push(`## ${category} (${entries?.length ?? 0}개)`);
    for (const e of entries ?? []) {
      const link = e.webViewLink ? `[열기](${e.webViewLink})` : "";
      lines.push(`- ${e.name} ${link}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

/** 구글 API 분당 쿼터 초과(429)일 때만 잠시 쉬었다가 재시도한다. */
async function withRetry<T>(fn: () => Promise<T>, retries = 4, baseDelayMs = 5000): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      const isQuota = err?.code === 429 || /Quota exceeded/i.test(err?.message ?? "");
      if (!isQuota || attempt >= retries) throw err;
      await new Promise((r) => setTimeout(r, baseDelayMs * (attempt + 1)));
    }
  }
}

function safeFileName(name: string, id: string): string {
  return `${name.replace(/[\\/:*?"<>|]/g, "_")}__${id}.json`;
}

/** 이전에 백업한 스냅샷의 원본 수정 시각을 읽는다 (없으면 undefined). */
function previousSourceModifiedTime(path: string): string | undefined {
  if (!existsSync(path)) return undefined;
  try {
    return JSON.parse(readFileSync(path, "utf-8")).sourceModifiedTime;
  } catch {
    return undefined;
  }
}

/**
 * "재무·매출" / "회원 데이터"로 분류된 스프레드시트의 실제 내용을 로컬에 스냅샷으로 백업한다.
 * 드라이브에서 수정되지 않은 파일은 다시 받지 않아 매일 자동 실행해도 API 호출이 쌓이지 않는다.
 */
export async function backupSpreadsheets(index: DriveIndex): Promise<{ backed: number; skipped: number; unchanged: number }> {
  const spreadsheetMime = "application/vnd.google-apps.spreadsheet";
  const targets = [...(index.byCategory["재무·매출"] ?? []), ...(index.byCategory["회원 데이터"] ?? [])].filter(
    (e) => e.mimeType === spreadsheetMime
  );

  mkdirSync(SNAPSHOT_DIR, { recursive: true });

  let backed = 0;
  let skipped = 0;
  let unchanged = 0;

  for (const file of targets) {
    const path = join(SNAPSHOT_DIR, safeFileName(file.name, file.id));
    if (previousSourceModifiedTime(path) === file.modifiedTime) {
      unchanged++;
      continue;
    }
    try {
      const sheets = await withRetry(() => readAllTabs(file.id));
      writeFileSync(
        path,
        JSON.stringify(
          { id: file.id, name: file.name, sourceModifiedTime: file.modifiedTime, backedUpAt: new Date().toISOString(), sheets },
          null,
          2
        ),
        "utf-8"
      );
      backed++;
    } catch (err) {
      console.error(`백업 실패: ${file.name} — ${err instanceof Error ? err.message : err}`);
      skipped++;
    }
    // 스프레드시트 사이에 짧게 쉬어 분당 쿼터 초과를 예방한다.
    await new Promise((r) => setTimeout(r, 500));
  }
  return { backed, skipped, unchanged };
}

/** 이름의 폴더를 찾고, 없으면 만든다 (parentId 생략 시 내 드라이브 최상위 기준). */
export async function findOrCreateFolder(name: string, parentId?: string): Promise<string> {
  const drive = await getDrive();
  const escaped = name.replace(/'/g, "\\'");
  const q =
    `name = '${escaped}' and mimeType = '${FOLDER_MIME}' and trashed = false` +
    (parentId ? ` and '${parentId}' in parents` : "");
  const found = await drive.files.list({ q, fields: "files(id)" });
  const existingId = found.data.files?.[0]?.id;
  if (existingId) return existingId;

  const created = await drive.files.create({
    requestBody: { name, mimeType: FOLDER_MIME, parents: parentId ? [parentId] : undefined },
    fields: "id",
  });
  if (!created.data.id) throw new Error(`폴더 생성 실패: ${name}`);
  return created.data.id;
}

/**
 * 분류된 파일을 카테고리 폴더 안에 "바로가기(shortcut)"로 넣는다. 원본 파일은 원래 있던
 * 위치에 그대로 두고 전혀 건드리지 않는다 (개인 구글 계정은 파일 하나가 폴더 여러 개에
 * 동시에 속하는 걸 허용하지 않아, 실제로 옮기면 기존 정리 구조가 깨진다).
 * "기타"로 분류된 개인/무관 파일은 대상에서 제외한다.
 */
export async function organizeDriveFolders(index: DriveIndex): Promise<{ added: number; alreadyIn: number; failed: number }> {
  const drive = await getDrive();
  const rootId = await findOrCreateFolder(ORGANIZE_ROOT_FOLDER);
  const shortcutMime = "application/vnd.google-apps.shortcut";

  let added = 0;
  let alreadyIn = 0;
  let failed = 0;

  for (const category of ORGANIZE_CATEGORIES) {
    const entries = index.byCategory[category] ?? [];
    if (entries.length === 0) continue;
    const folderId = await findOrCreateFolder(category, rootId);

    // 이 폴더에 이미 만들어둔 바로가기 목록 (재실행 시 중복 생성 방지)
    const existing = await drive.files.list({
      q: `'${folderId}' in parents and mimeType = '${shortcutMime}' and trashed = false`,
      fields: "files(shortcutDetails)",
      pageSize: 1000,
    });
    const existingTargets = new Set(
      (existing.data.files ?? []).map((f) => f.shortcutDetails?.targetId).filter((id): id is string => !!id)
    );

    for (const entry of entries) {
      if (existingTargets.has(entry.id)) {
        alreadyIn++;
        continue;
      }
      try {
        await drive.files.create({
          requestBody: {
            name: entry.name,
            mimeType: shortcutMime,
            parents: [folderId],
            shortcutDetails: { targetId: entry.id },
          },
          fields: "id",
        });
        added++;
      } catch (err) {
        console.error(`정리 실패: ${entry.name} — ${err instanceof Error ? err.message : err}`);
        failed++;
      }
      await new Promise((r) => setTimeout(r, 300));
    }
  }

  return { added, alreadyIn, failed };
}
