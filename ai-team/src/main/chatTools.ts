// 채팅(명령창)에서 팀원이 실제로 실행할 수 있는 도구 — 구글 드라이브 / 노션 / 유튜브에 한해서만 진짜
// 작업을 수행한다 (카카오톡 발송·네이버 블로그 게시처럼 아직 연동 안 된 채널은 여전히 초안까지만).
// 삭제·휴지통 이동 같은 파괴적 동작은 도구로 노출하지 않는다.
import { searchFiles, readSpreadsheet, writeValues, createSpreadsheet, ensureSheetTab } from "./drive/drive";
import { findOrCreateFolder } from "./drive/archive";
import { createNotionPage } from "./notion";
import { uploadVideo } from "./youtube/upload";
import { generateVideoMetadata } from "./youtube/metadata";
import { findPaperCandidates, resolvePmcid, fetchFullText, draftFromPaper } from "./paperBlog";

export const CHAT_TOOLS = [
  {
    name: "drive_search_files",
    description: "이름으로 구글 드라이브 파일(스프레드시트·문서 등)을 검색해 id/이름/수정시각을 돌려준다.",
    input_schema: {
      type: "object",
      properties: { query: { type: "string", description: "파일 이름에 포함된 검색어" } },
      required: ["query"],
    },
  },
  {
    name: "drive_read_spreadsheet",
    description: "구글 스프레드시트의 내용을 2차원 배열로 읽는다. sheetName 생략 시 첫 번째 탭.",
    input_schema: {
      type: "object",
      properties: {
        spreadsheetId: { type: "string" },
        sheetName: { type: "string" },
      },
      required: ["spreadsheetId"],
    },
  },
  {
    name: "drive_write_spreadsheet",
    description:
      "구글 스프레드시트의 지정한 범위에 값을 쓴다. range는 'Sheet1!A1' 형식. 기존 값은 덮어쓴다(삭제 아님, 값 교체).",
    input_schema: {
      type: "object",
      properties: {
        spreadsheetId: { type: "string" },
        range: { type: "string", description: "예: 'Sheet1!A1'" },
        values: {
          type: "array",
          items: { type: "array", items: { type: "string" } },
          description: "2차원 배열. 각 안쪽 배열이 한 행.",
        },
      },
      required: ["spreadsheetId", "range", "values"],
    },
  },
  {
    name: "drive_create_spreadsheet",
    description: "새 구글 스프레드시트를 만든다. folderName을 주면 그 폴더(없으면 새로 생성) 안에 만든다.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string" },
        folderName: { type: "string", description: "생략하면 '자이언트짐' 폴더 아래에 만든다." },
      },
      required: ["name"],
    },
  },
  {
    name: "drive_ensure_sheet_tab",
    description: "스프레드시트에 지정한 이름의 탭(시트)이 없으면 새로 만든다. 이미 있으면 아무것도 안 한다.",
    input_schema: {
      type: "object",
      properties: { spreadsheetId: { type: "string" }, tabName: { type: "string" } },
      required: ["spreadsheetId", "tabName"],
    },
  },
  {
    name: "notion_create_page",
    description: "설정된 노션 데이터베이스에 제목+본문으로 새 페이지를 만든다.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string" },
        content: { type: "string", description: "페이지 본문 (줄바꿈으로 문단 구분, '#'로 시작하면 제목, '-'로 시작하면 목록)" },
      },
      required: ["title", "content"],
    },
  },
  {
    name: "youtube_upload",
    description:
      "로컬 영상 파일을 실제로 유튜브에 업로드한다. title을 안 주면 topicHint로 제목/설명/태그를 자동 생성한다. " +
      "안전을 위해 privacyStatus를 명시하지 않으면 비공개(private)로 올라간다 — 공개로 올리려면 사장님이 명확히 요청했을 때만 'public'을 지정한다.",
    input_schema: {
      type: "object",
      properties: {
        filePath: { type: "string", description: "업로드할 영상 파일의 로컬 경로" },
        topicHint: { type: "string", description: "제목/설명 자동 생성을 위한 영상 주제 힌트 (title 생략 시 사용)" },
        title: { type: "string" },
        description: { type: "string" },
        tags: { type: "array", items: { type: "string" } },
        privacyStatus: { type: "string", enum: ["private", "unlisted", "public"] },
      },
      required: ["filePath"],
    },
  },
  {
    name: "paper_find_candidates",
    description:
      "블로그 글감용 논문 후보를 찾는다 (루나의 논문 리뷰 블로그 업무). 최근 5년, 제목에 체계적 문헌고찰/메타분석, 무료 본문이 있는 논문만 최대 5편을 돌려준다. " +
      "주제는 한국어로 줘도 된다. 사장님이 후보 중 하나를 고르기 전에는 초안 도구를 호출하지 않는다.",
    input_schema: {
      type: "object",
      properties: { topic: { type: "string", description: "논문 주제 (예: 요통에 대한 코어 안정화 운동)" } },
      required: ["topic"],
    },
  },
  {
    name: "paper_blog_draft",
    description:
      "사장님이 고른 논문(pmcid / pmid / doi 중 하나, 또는 pdfPath)으로 논문 리뷰 블로그 글 초안을 만들어 '바탕화면/블로그 초안' 폴더에 저장한다. " +
      "1~3분 걸린다. 발행/에디터 입력은 하지 않는다. 결과의 검증 메모(논문 숫자 모순, 읽지 못한 부분)를 반드시 사장님께 함께 알린다.",
    input_schema: {
      type: "object",
      properties: {
        pmcid: { type: "string" },
        pmid: { type: "string" },
        doi: { type: "string" },
        pdfPath: { type: "string", description: "사장님이 준 PDF 파일의 로컬 경로" },
      },
    },
  },
];

export async function executeChatTool(name: string, input: any): Promise<string> {
  switch (name) {
    case "drive_search_files": {
      const files = await searchFiles(String(input.query ?? ""));
      return JSON.stringify(files.map((f) => ({ id: f.id, name: f.name, mimeType: f.mimeType, modifiedTime: f.modifiedTime })));
    }
    case "drive_read_spreadsheet": {
      const rows = await readSpreadsheet(String(input.spreadsheetId), input.sheetName ? String(input.sheetName) : undefined);
      return JSON.stringify(rows);
    }
    case "drive_write_spreadsheet": {
      await writeValues(String(input.spreadsheetId), String(input.range), input.values);
      return "작성 완료";
    }
    case "drive_create_spreadsheet": {
      const folderId = await findOrCreateFolder(input.folderName ? String(input.folderName) : "자이언트짐");
      const id = await createSpreadsheet(String(input.name), folderId);
      return JSON.stringify({ id, url: `https://docs.google.com/spreadsheets/d/${id}/edit` });
    }
    case "drive_ensure_sheet_tab": {
      await ensureSheetTab(String(input.spreadsheetId), String(input.tabName));
      return "탭 준비 완료";
    }
    case "notion_create_page": {
      const result = await createNotionPage(String(input.title), String(input.content));
      return JSON.stringify(result);
    }
    case "youtube_upload": {
      const meta = input.title
        ? { title: String(input.title), description: String(input.description ?? ""), tags: input.tags ?? [] }
        : await generateVideoMetadata(String(input.topicHint ?? input.filePath));
      const result = await uploadVideo({
        filePath: String(input.filePath),
        title: meta.title,
        description: meta.description,
        tags: meta.tags,
        privacyStatus: input.privacyStatus,
      });
      return JSON.stringify(result);
    }
    case "paper_find_candidates": {
      const { query, items } = await findPaperCandidates(String(input.topic ?? ""));
      return JSON.stringify({
        searchQuery: query,
        note: items.length ? "후보 중 하나를 사장님이 고르면 paper_blog_draft로 초안을 만든다." : "후보 없음 — 주제를 바꾸거나 논문(PDF/PMID/DOI)을 직접 받는다.",
        candidates: items.map((c, i) => ({ no: i + 1, title: c.title, authors: c.authors.split(",").slice(0, 3).join(","), journal: c.journal, year: c.year, cited: c.cited, pmcid: c.pmcid, pmid: c.pmid, doi: c.doi })),
      });
    }
    case "paper_blog_draft": {
      if (input.pdfPath) {
        const r = await draftFromPaper({ pdf: String(input.pdfPath) }, String(input.pdfPath).split(/[\\/]/).pop() ?? "pdf");
        return JSON.stringify({ savedTo: r.file, head: r.preview });
      }
      const pmcid = await resolvePmcid({ pmcid: input.pmcid, pmid: input.pmid, doi: input.doi });
      const { text, meta } = await fetchFullText(pmcid);
      const r = await draftFromPaper({ text, meta }, pmcid);
      return JSON.stringify({ savedTo: r.file, head: r.preview });
    }
    default:
      return `알 수 없는 도구: ${name}`;
  }
}
