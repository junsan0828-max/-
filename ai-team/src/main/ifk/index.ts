// 피트니스경영신문(ifk.co.kr/nad) 기사 자동 등록대기 — 매시 정각,
// 노션에 준비된 미게시 기사(작성일이 오늘 이하인 것 중 가장 오래된 1건)를 IFK 관리자
// "뉴스등록" 폼에 채워 등록대기 상태로 올린다. 마감 시각에 기사가 아직 안 써져 있어도
// 다음 정각에 다시 확인하고, 밀린 기사가 여러 건이면 매시 하나씩 순서대로 소진한다.
// (실제 게시는 사람이 IFK 관리자 "등록대기 뉴스관리"에서 최종 확인 후 등록)
import { getNextPendingArticle, getArticleByNumber, markPosted, IfkArticle } from "./notionSource";
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

/** 매시 정각 자동 실행: 작성일이 오늘 이하인 미게시 기사 중 가장 오래된 1건을 올린다. */
export async function runIfkJob(): Promise<IfkJobResult> {
  const article = await getNextPendingArticle();
  if (!article) {
    return { ok: false, skipped: true, error: "게시 대기 중인 기사가 노션에 없습니다 (작성일 도래 + 미게시 기준)." };
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
