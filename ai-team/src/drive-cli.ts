// 구글 드라이브 연동 단독 테스트.
// 실행:
//   npm run drive -- search 매출
//   npm run drive -- sheet <스프레드시트ID> [시트이름]
//   npm run drive -- index    (파일 분류 정리)
//   npm run drive -- backup   (분류 + 재무·회원 스프레드시트 로컬 백업)
import "dotenv/config";
import { searchFiles, readSpreadsheet, listSheetTabs } from "./main/drive/drive";
import { buildIndex, backupSpreadsheets } from "./main/drive/archive";

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);

  if (cmd === "search") {
    const query = rest.join(" ").trim();
    if (!query) {
      console.error('사용법: npm run drive -- search <검색어>');
      process.exit(1);
    }
    console.log(`🔍 "${query}" 검색 중...`);
    const files = await searchFiles(query);
    if (files.length === 0) {
      console.log("검색 결과 없음.");
      return;
    }
    for (const f of files) {
      console.log(`- ${f.name}  [${f.mimeType}]  id=${f.id}`);
    }
    return;
  }

  if (cmd === "sheet") {
    const [spreadsheetId, sheetName] = rest;
    if (!spreadsheetId) {
      console.error("사용법: npm run drive -- sheet <스프레드시트ID> [시트이름]");
      process.exit(1);
    }
    if (!sheetName) {
      const tabs = await listSheetTabs(spreadsheetId);
      console.log(`시트 탭 목록: ${tabs.join(", ")}`);
    }
    const rows = await readSpreadsheet(spreadsheetId, sheetName);
    console.log(`총 ${rows.length}행`);
    for (const row of rows.slice(0, 20)) {
      console.log(row.join(" | "));
    }
    return;
  }

  if (cmd === "index") {
    console.log("📂 드라이브 파일 분류 중...");
    const index = await buildIndex();
    console.log(`총 ${index.totalFiles}개 파일 분류 완료.`);
    for (const [cat, entries] of Object.entries(index.byCategory)) {
      console.log(`- ${cat}: ${entries?.length ?? 0}개`);
    }
    console.log(`\n저장 위치: output/drive-backup/index.md (보기 쉬운 정리본), index.json`);
    return;
  }

  if (cmd === "backup") {
    console.log("📂 드라이브 파일 분류 중...");
    const index = await buildIndex();
    console.log("💾 재무·회원 스프레드시트 백업 중... (변경된 파일만)");
    const { backed, skipped, unchanged } = await backupSpreadsheets(index);
    console.log(`백업 완료: 신규/갱신 ${backed}개, 변경없음 ${unchanged}개, 실패 ${skipped}개`);
    console.log(`저장 위치: output/drive-backup/snapshots/`);
    return;
  }

  console.error(
    "사용법:\n  npm run drive -- search <검색어>\n  npm run drive -- sheet <스프레드시트ID> [시트이름]\n  npm run drive -- index\n  npm run drive -- backup"
  );
  process.exit(1);
}

main().catch((err) => {
  console.error("❌", err instanceof Error ? err.message : err);
  process.exit(1);
});
