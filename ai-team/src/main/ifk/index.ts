// 피트니스경영신문(ifk.co.kr/nad) 기사 자동 등록대기 — 매일 11시,
// 노션에 준비된 오늘자 기사를 IFK 관리자 "뉴스등록" 폼에 채워 등록대기 상태로 올린다.
// (실제 게시는 사람이 IFK 관리자 "등록대기 뉴스관리"에서 최종 확인 후 등록)
import { getTodaysArticle, getArticleByNumber, markPosted, IfkArticle } from "./notionSource";
import { nextReporter } from "./reporters";
import { submitIfkArticleAsPending } from "./submit";

export interface IfkJobResult {
  ok: boolean;
  skipped?: boolean;
  title?: string;
  reporterName?: string;
  error?: string;
}

async function submitAndMark(article: IfkArticle): Promise<IfkJobResult> {
  const reporter = nextReporter();
  const result = await submitIfkArticleAsPending(article, reporter);
  if (!result.ok) {
    return { ok: false, title: article.title, reporterName: reporter.name, error: result.error };
  }
  await markPosted(article.pageId);
  return { ok: true, title: article.title, reporterName: reporter.name };
}

/** 매일 11시 자동 실행: 오늘(작성일=오늘) 작성된 미게시 기사를 올린다. */
export async function runIfkJob(): Promise<IfkJobResult> {
  const article = await getTodaysArticle();
  if (!article) {
    return { ok: false, skipped: true, error: "오늘 작성일로 등록된 미게시 기사가 노션에 없습니다." };
  }
  return submitAndMark(article);
}

/** 수동 재실행: 번호를 지정해서 (게시완료 여부와 무관하게) 강제로 다시 올린다.
 * 내용을 수정한 뒤 다시 올리고 싶을 때 사용. */
export async function runIfkJobForNumber(number: number): Promise<IfkJobResult> {
  const article = await getArticleByNumber(number);
  if (!article) {
    return { ok: false, skipped: true, error: `번호 ${number}에 해당하는 기사를 노션에서 찾지 못했습니다.` };
  }
  return submitAndMark(article);
}
