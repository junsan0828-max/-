// Notion 연동 — 제이의 일일 브리핑을 Notion 데이터베이스에 자동 기록.
// 집 PC 화면 앞에 있지 않아도 휴대폰 Notion 앱으로 언제든 확인 가능하게 한다.
// 공식 Notion API 사용 (내부 통합 토큰 방식, OAuth 아님 - 개인/팀 용도로 충분).
import { OrchestratorResult, TeamTask } from "./orchestrator";
import { MinaResult } from "./mina";
import { FunnelResult } from "./dataAgent";
import { ContentResult } from "./luna";
import { PayrollResult } from "./payroll";
import { RepoResult, MonthlyOverviewResult } from "./repo";
import { JournalEntry } from "./journal";
import { GymContext } from "./data";
import { ShortVideo } from "./youtube/shorts";
import { VerificationResult } from "./verify";

const NOTION_VERSION = "2022-06-28";

export interface NotionPushResult {
  ok: boolean;
  url?: string;
  error?: string;
}

function isConfigured() {
  return !!(process.env.NOTION_API_KEY && process.env.NOTION_DATABASE_ID);
}

async function notionFetch(path: string, init: RequestInit) {
  const res = await fetch(`https://api.notion.com/v1${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${process.env.NOTION_API_KEY}`,
      "Notion-Version": NOTION_VERSION,
      "content-type": "application/json",
      ...(init.headers || {}),
    },
  });
  const data: any = await res.json();
  if (!res.ok) throw new Error(data?.message || `Notion API 오류 (${res.status})`);
  return data;
}

/** 데이터베이스의 title 속성 이름을 찾는다 (사용자가 임의로 지었을 수 있어 동적으로 탐지). */
async function findTitleProperty(databaseId: string): Promise<string> {
  const db = await notionFetch(`/databases/${databaseId}`, { method: "GET" });
  const entry = Object.entries<any>(db.properties).find(([, v]) => v.type === "title");
  if (!entry) throw new Error("데이터베이스에서 제목(title) 속성을 찾지 못했습니다.");
  return entry[0];
}

function paragraph(text: string) {
  return { object: "block", type: "paragraph", paragraph: { rich_text: [{ text: { content: text.slice(0, 2000) } }] } };
}
function heading(text: string) {
  return { object: "block", type: "heading_3", heading_3: { rich_text: [{ text: { content: text.slice(0, 2000) } }] } };
}
function bullet(text: string) {
  return { object: "block", type: "bulleted_list_item", bulleted_list_item: { rich_text: [{ text: { content: text.slice(0, 2000) } }] } };
}
type Block = ReturnType<typeof heading> | ReturnType<typeof paragraph> | ReturnType<typeof bullet>;

/** 100개 넘는 블록을 페이지 생성 후 여러 번에 나눠 이어붙인다 (Notion API는 요청당 최대 100블록). */
async function appendRemainingBlocks(pageId: string, blocks: unknown[]) {
  for (let i = 0; i < blocks.length; i += 100) {
    await notionFetch(`/blocks/${pageId}/children`, {
      method: "PATCH",
      body: JSON.stringify({ children: blocks.slice(i, i + 100) }),
    });
  }
}

function reportToBlocks(report: string) {
  return report
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => {
      const trimmed = line.trim();
      if (trimmed.startsWith("#")) return heading(trimmed.replace(/^#+\s*/, ""));
      if (trimmed.startsWith("-") || trimmed.startsWith("*")) return bullet(trimmed.replace(/^[-*]\s*/, ""));
      return paragraph(trimmed);
    });
}

export async function pushDailyReport(
  result: OrchestratorResult,
  mina?: MinaResult,
  funnel?: FunnelResult,
  content?: ContentResult
): Promise<NotionPushResult> {
  if (!isConfigured()) {
    return { ok: false, error: "Notion 미설정 (.env에 NOTION_API_KEY/NOTION_DATABASE_ID 필요)" };
  }

  try {
    const databaseId = process.env.NOTION_DATABASE_ID!;
    const titleProp = await findTitleProperty(databaseId);
    const dateStr = new Date(result.generatedAt).toLocaleDateString("ko-KR");
    const periodLabel = result.periodLabel || "어제";
    // 2026-08-20 대표 지시: 단순 회원 연락·상담·수납 확인(assigneeRole="회원관리")은 mode가
    // "manual"이어도 대표가 아니라 직원 처리 — 가격·정책·결제·인사·대외발송만 대표 처리로 표시한다.
    const ownerLabel = (t: TeamTask): string => {
      if (t.mode === "auto") return "AI 처리";
      if (t.mode === "semi") return "AI 처리(확인 필요)";
      return t.assigneeRole === "회원관리" ? "직원 처리" : "사장님 처리";
    };

    // "업무보고" 테이블(제목/오늘 업무/분석 리포트)에 표에서 바로 보이도록 요약을 채운다.
    // 전체 상세 내용은 아래 children 블록으로 페이지 본문에 그대로 남긴다.
    const truncate = (text: string, max = 1900) =>
      text.length > max ? text.slice(0, max) + "\n…(전체 내용은 페이지 본문 참고)" : text;
    const todayTasksSummary = truncate(
      [result.headline, "", ...result.tasks.map((t) => `[${t.priority}] ${t.title} — ${t.reason}`)].join("\n")
    );
    const analysisReportSummary = truncate(result.report);

    const c = result.context;
    const children = [
      heading(`🧑‍💼 제이 - ${periodLabel} 브리핑 헤드라인`),
      paragraph(result.headline),
      heading("📡 데이터 기준"),
      paragraph(
        c.meta.dbConnected
          ? `실데이터 · 원천: members/revenue_entries/attendances 등(ZIANTGYM+ DB, Neon) · 조회시각 ${new Date(c.meta.asOfTimestamp).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })} (Asia/Seoul)`
          : `⚠️ 샘플 데이터 사용 중 — DB 연결 실패 (${c.meta.queryError ?? "사유 미상"})`
      ),
      heading("🏢 지점별 요약 (전체 / 1호점 / 2호점)"),
      paragraph(
        `전체 — 활성 ${c.members.active} · 이번달 실입금 ${c.money.monthRevenue.toLocaleString()}원 · 미수금 ${c.money.unpaidTotal.toLocaleString()}원`
      ),
      ...c.byBranch.map((b) =>
        bullet(
          `${b.branchName} — 활성 ${b.active} · 계약액 ${b.contractAmount.toLocaleString()}원 · 실입금 ${b.monthRevenue.toLocaleString()}원 · 미수금 ${b.unpaidTotal.toLocaleString()}원 · 만료예정 ${b.expiringSoonCount}명 · 신규 ${b.newCount}건 · 재등록 ${b.reRegisterCount}건`
        )
      ),
      heading("💰 매출·비용 상세 (이번달 누계 — 전일 실적과는 별개)"),
      bullet(`계약액(할인전) ${c.money.contractAmount.toLocaleString()}원`),
      bullet(`실제 입금액 ${c.money.monthRevenue.toLocaleString()}원`),
      bullet(`환불·취소액 ${c.money.refundAmount.toLocaleString()}원`),
      bullet(`최종 실현 매출(입금-환불) ${c.money.netRevenueThisMonth.toLocaleString()}원`),
      bullet(`이번달 미수금 ${c.money.unpaidThisMonth.toLocaleString()}원 (전체 누적 미수금 ${c.money.unpaidTotal.toLocaleString()}원)`),
      bullet(
        `이번달 지출입력액 ${c.expense.thisMonthTotal.toLocaleString()}원 / 확인된 현금흐름(실입금-지출입력액) ${c.expense.netProfitThisMonth.toLocaleString()}원 — 인건비·임대료 등 비용이 다 입력됐는지 확인 안 됨, "순이익" 아님`
      ),
      heading("📅 만료 관리 — D-10·D-5 자동 문자로만 운영 (별도 일괄 연락 없음)"),
      bullet(`30일 내 만료 예정 ${c.members.expiringSoon.length}명 (참고용 — 실제 문자는 D-10·D-5 시점에 자동 발송)`),
      heading("오늘 처리해야 할 업무 (AI 처리 / 직원 처리 / 사장님 처리 구분)"),
      ...result.tasks.map((t) => bullet(`[${t.priority}] ${t.title} — ${t.reason} (담당: ${t.assigneeRole} · ${ownerLabel(t)})`)),
      heading(`${periodLabel} 분석`),
      ...reportToBlocks(result.report),
    ];

    if (mina && mina.messages.length > 0) {
      // 회원 이름·전화번호(개인정보)는 올리지 않는다. 건수만 요약해서 기록.
      const byCategory = mina.messages.reduce<Record<string, number>>((acc, m) => {
        acc[m.category] = (acc[m.category] ?? 0) + 1;
        return acc;
      }, {});
      children.push(heading(`🙋‍♀️ 미나 - 문자 대상 ${mina.messages.length}건`));
      children.push(
        ...Object.entries(byCategory).map(([cat, count]) => bullet(`${cat}: ${count}건 (상세는 앱에서 확인)`))
      );
    }
    if (funnel) {
      children.push(heading("📊 데이터 - 퍼널 진단"));
      children.push(...reportToBlocks(funnel.insight));
    }
    if (content && content.ideas.length > 0) {
      children.push(heading("🎨 루나 - 콘텐츠 초안"));
      children.push(...content.ideas.map((i) => bullet(`[${i.platform}] ${i.title}`)));
    }

    const pageProps = {
      [titleProp]: { title: [{ text: { content: `자이언트짐 AI 브리핑 - ${dateStr} (${periodLabel})` } }] },
      "오늘 업무": { rich_text: [{ text: { content: todayTasksSummary } }] },
      "분석 리포트": { rich_text: [{ text: { content: analysisReportSummary } }] },
    };
    const childBatch = children.slice(0, 100); // Notion API 한 번 요청당 최대 100 블록

    // 같은 날짜 브리핑은 1개만 유지한다(2026-08-20 대표 지시) — 오늘 실행이 이미 있으면 새 페이지를
    // 만들지 않고 기존 페이지의 속성·본문을 통째로 갱신한다(중복 페이지가 쌓이던 문제 수정).
    const existingId = await findTodaysBriefingPageId(databaseId, titleProp, dateStr);
    if (existingId) {
      const existingChildren = await notionFetch(`/blocks/${existingId}/children?page_size=100`, { method: "GET" });
      for (const block of existingChildren.results ?? []) {
        await notionFetch(`/blocks/${block.id}`, { method: "DELETE" }).catch(() => {});
      }
      await notionFetch(`/pages/${existingId}`, { method: "PATCH", body: JSON.stringify({ properties: pageProps }) });
      await notionFetch(`/blocks/${existingId}/children`, { method: "PATCH", body: JSON.stringify({ children: childBatch }) });
      return { ok: true, url: `https://app.notion.com/p/${existingId.replace(/-/g, "")}` };
    }

    const page = await notionFetch("/pages", {
      method: "POST",
      body: JSON.stringify({ parent: { database_id: databaseId }, properties: pageProps, children: childBatch }),
    });

    return { ok: true, url: page.url };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/** 오늘 날짜가 제목에 들어간 브리핑 페이지가 이미 있으면 그 페이지 id를 돌려준다(같은 날 재실행 시
 * 새 페이지를 또 만들지 않기 위함, 2026-08-20 대표 지시). */
async function findTodaysBriefingPageId(databaseId: string, titleProp: string, dateStr: string): Promise<string | null> {
  const data = await notionFetch(`/databases/${databaseId}/query`, {
    method: "POST",
    body: JSON.stringify({
      filter: { property: titleProp, title: { contains: dateStr } },
      page_size: 10,
    }),
  });
  for (const page of data.results ?? []) {
    const richTitle = page.properties?.[titleProp]?.title as { plain_text: string }[] | undefined;
    const title = richTitle?.map((t) => t.plain_text).join("") ?? "";
    if (title.includes(`자이언트짐 AI 브리핑 - ${dateStr}`)) return page.id;
  }
  return null;
}

/** 급여 정산 AI의 결과를 보고한다. 오류가 있으면 정산 중단 보고, 없으면 완료 보고. */
export async function pushPayrollReport(result: PayrollResult, sheetUrl?: string): Promise<NotionPushResult> {
  if (!isConfigured()) {
    return { ok: false, error: "Notion 미설정 (.env에 NOTION_API_KEY/NOTION_DATABASE_ID 필요)" };
  }

  try {
    const databaseId = process.env.NOTION_DATABASE_ID!;
    const titleProp = await findTitleProperty(databaseId);
    const hasIssues = result.issues.length > 0;

    const children = hasIssues
      ? [
          heading(`🚨 ${result.yearMonth} 급여 정산 진행 중 — 오류 발견`),
          paragraph(`오류 ${result.issues.length}건이 발견되어 정산을 중단했습니다. 수정 후 다시 정산할 수 있습니다.`),
          ...result.issues.map((i) => bullet(`[${i.trainerName}] ${i.detail}`)),
          heading("자동 점검 불가 항목 (참고용, 별도 확인 필요)"),
          ...result.uncheckable.map((u) => bullet(u)),
        ]
      : [
          heading(`✅ ${result.yearMonth} 급여 정산 완료`),
          paragraph("단가 오류: 없음 / 중복 정산 의심: 없음"),
          heading(`💸 전체 이체 필요액: ${result.totalTransferAmount.toLocaleString()}원`),
          heading("🏢 지점별 소계"),
          ...result.branches.map((b) =>
            bullet(
              `${b.branchName} — 수업 ${b.sessionCount}건, 수업정산(세후) ${b.sessionSettlementAfterTax.toLocaleString()}원 + 기본급(세후) ${b.basePayAfterTax.toLocaleString()}원 = 소계 ${b.subtotal.toLocaleString()}원`
            )
          ),
          heading("트레이너별 지급액"),
          ...result.trainers.map((t) =>
            bullet(
              `${t.trainerName} [${t.primaryBranchName}] — 수업정산 ${t.afterTax.toLocaleString()}원 + 기본급(세후) ${t.basePayAfterTax.toLocaleString()}원 = 총 ${t.totalPay.toLocaleString()}원`
            )
          ),
          ...(result.branchNotes.length > 0
            ? [heading("⚠️ 지점 배분 확인 필요 (금액은 정확함, 귀속 지점만 확인)"), ...result.branchNotes.map((n) => bullet(n))]
            : []),
          ...(sheetUrl ? [paragraph(`구글 시트: ${sheetUrl}`)] : []),
          heading("자동 점검 불가 항목 (참고용, 별도 확인 필요)"),
          ...result.uncheckable.map((u) => bullet(u)),
        ];

    const page = await notionFetch("/pages", {
      method: "POST",
      body: JSON.stringify({
        parent: { database_id: databaseId },
        properties: {
          [titleProp]: { title: [{ text: { content: `급여 정산 - ${result.yearMonth}` } }] },
        },
        children: children.slice(0, 100),
      }),
    });

    return { ok: true, url: page.url };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/** 채팅에서 팀원이 사장님 지시로 노션에 실제로 페이지를 만들 때 쓴다 (자유 형식 제목+본문). */
export async function createNotionPage(title: string, content: string): Promise<NotionPushResult> {
  if (!isConfigured()) {
    return { ok: false, error: "Notion 미설정 (.env에 NOTION_API_KEY/NOTION_DATABASE_ID 필요)" };
  }

  try {
    const databaseId = process.env.NOTION_DATABASE_ID!;
    const titleProp = await findTitleProperty(databaseId);

    const page = await notionFetch("/pages", {
      method: "POST",
      body: JSON.stringify({
        parent: { database_id: databaseId },
        properties: {
          [titleProp]: { title: [{ text: { content: title.slice(0, 200) } }] },
        },
        children: reportToBlocks(content).slice(0, 100),
      }),
    });

    return { ok: true, url: page.url };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/** 리포 AI의 월간 전략 리포트(지점별 + 통합)를 노션에 기록한다. */
export async function pushRepoReport(result: RepoResult): Promise<NotionPushResult> {
  if (!isConfigured()) {
    return { ok: false, error: "Notion 미설정 (.env에 NOTION_API_KEY/NOTION_DATABASE_ID 필요)" };
  }

  try {
    const databaseId = process.env.NOTION_DATABASE_ID!;
    const titleProp = await findTitleProperty(databaseId);

    const children: Block[] = [
      heading(`🗒️ 리포 - ${result.yearMonth} 월간 전략 리포트`),
      ...(result.dataNotes.length > 0
        ? [heading("데이터 참고사항"), ...result.dataNotes.map((n) => bullet(n))]
        : []),
    ];
    for (const b of result.branches) {
      children.push(
        heading(`[${b.branchName}] 월 운영 전략`),
        ...reportToBlocks(b.operationsReport),
        heading(`[${b.branchName}] 회원권 재등록 전략`),
        ...reportToBlocks(b.membershipRenewalReport),
        heading(`[${b.branchName}] PT 재등록 전략`),
        ...reportToBlocks(b.ptRenewalReport)
      );
    }

    const page = await notionFetch("/pages", {
      method: "POST",
      body: JSON.stringify({
        parent: { database_id: databaseId },
        properties: {
          [titleProp]: { title: [{ text: { content: `월간 전략 리포트 - ${result.yearMonth}` } }] },
        },
        children: children.slice(0, 100),
      }),
    });
    if (children.length > 100) await appendRemainingBlocks(page.id, children.slice(100));

    return { ok: true, url: page.url };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

const won = (n: number) => `${n.toLocaleString()}원`;

/** 월간 총 데이터 리포트(2026-08-18 대표 지시 — 지점별 전략 대신 전월 대비 매출부터 전체 핵심
 * 지표를 숫자로) 를 노션 "업무보고" DB에 "월간 보고"로 기록한다. */
export async function pushMonthlyReport(result: MonthlyOverviewResult): Promise<NotionPushResult> {
  if (!isConfigured()) {
    return { ok: false, error: "Notion 미설정 (.env에 NOTION_API_KEY/NOTION_DATABASE_ID 필요)" };
  }

  try {
    const databaseId = process.env.NOTION_DATABASE_ID!;
    const titleProp = await findTitleProperty(databaseId);
    const r = result;
    const pctText = r.revenue.diffPct === null ? "(전월 데이터 없음)" : `(${r.revenue.diffPct >= 0 ? "+" : ""}${r.revenue.diffPct}%)`;

    const children: Block[] = [
      heading(`🗒️ ${r.yearMonth} 월간 보고`),
      heading("매출·손익"),
      bullet(`이번 달 매출 ${won(r.revenue.thisMonth)} / 전월 ${won(r.revenue.prevMonth)} / 증감 ${r.revenue.diff >= 0 ? "+" : ""}${won(r.revenue.diff)} ${pctText}`),
      bullet(`이번 달 지출 ${won(r.expense.thisMonth)} / 전월 ${won(r.expense.prevMonth)}`),
      bullet(`순이익 ${won(r.netProfit.thisMonth)} / 전월 ${won(r.netProfit.prevMonth)} (단순 현금 기준)`),
      bullet(`지점별 이번 달 매출: ${r.byBranchRevenue.map((b) => `${b.branchName} ${won(b.amount)}`).join(", ") || "데이터 없음"}`),
      heading("신규·재등록"),
      bullet(`헬스(회원권): 신규 ${r.membership.newCount}건, 재등록 ${r.membership.renewCount}건`),
      bullet(`PT: 신규 ${r.pt.newCount}건, 재등록 ${r.pt.renewCount}건`),
      heading("회원 현황"),
      bullet(`활성 회원 ${r.activeMembers}명`),
      bullet(`30일 내 만료 예정 ${r.expiringSoonCount}명, 최근 14일 내 만료(이탈위험) ${r.recentlyExpiredCount}명`),
      bullet(`PT 패키지 소진 임박(잔여 2회 이하 또는 30일 내 만료) ${r.ptEndingSoonCount}명`),
      bullet(`전체 누적 미수금 ${won(r.unpaidTotal)}`),
      heading("출석"),
      bullet(`이번 달 총 방문 ${r.attendance.thisMonth}회 / 전월 ${r.attendance.prevMonth}회`),
      ...(r.dataNotes.length > 0 ? [heading("데이터 참고사항"), ...r.dataNotes.map((n) => bullet(n))] : []),
    ];

    const page = await notionFetch("/pages", {
      method: "POST",
      body: JSON.stringify({
        parent: { database_id: databaseId },
        properties: {
          [titleProp]: { title: [{ text: { content: `월간 보고 - ${r.yearMonth}` } }] },
        },
        children: children.slice(0, 100),
      }),
    });
    if (children.length > 100) await appendRemainingBlocks(page.id, children.slice(100));

    return { ok: true, url: page.url };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/** 사업 일지를 노션 "사업 일지" 데이터베이스에 하루 한 페이지로 기록한다.
 * 별도 데이터베이스(NOTION_JOURNAL_DATABASE_ID)를 쓴다 — 브리핑/급여/리포용 DB와는 분리. */
export async function pushJournalEntry(entry: JournalEntry): Promise<NotionPushResult> {
  const databaseId = process.env.NOTION_JOURNAL_DATABASE_ID;
  if (!databaseId) {
    return { ok: false, error: "노션 사업 일지 미설정 (.env에 NOTION_JOURNAL_DATABASE_ID 필요)" };
  }

  try {
    const richText = (text: string) => ({ rich_text: [{ text: { content: text.slice(0, 2000) } }] });
    const page = await notionFetch("/pages", {
      method: "POST",
      body: JSON.stringify({
        parent: { database_id: databaseId },
        properties: {
          "제목": { title: [{ text: { content: `${entry.dateLabel} 사업 일지` } }] },
          "날짜": { date: { start: entry.dateLabel } },
          "진행한 일": richText(entry.progress),
          "성과": richText(entry.achievements),
          "현황": richText(entry.status),
          "보완할 점": richText(entry.improvements),
          "내일 할 일": richText(entry.tomorrow),
        },
      }),
    });

    return { ok: true, url: page.url };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// 업무관리/업무 로그 — 브리핑 본문에 업무를 나열하는 것만으로는 "완료"로 치지 않는다.
// 실데이터 기반 상위 업무를 노션 "업무관리" DB에 개별 업무로 만들고, 실행 결과를 "업무 로그"에 남긴다.
// mode(auto/semi/manual)에 따라 담당구분·진행상태를 정한다 — 실행하지 않은 업무는 절대 "완료"로 기록하지 않는다
// (auto=이미 자동 실행됨=완료, semi/manual=AI가 초안/제안만 한 상태이고 실제 처리는 사람 몫=시작 전).
// 2026-08-20 대표 지시: 단순 회원 연락·상담·수납 확인(assigneeRole="회원관리")은 mode가 "manual"로
// 잘못 와도 대표 업무로 배정하지 않는다 — 그런 실무는 직원 몫이라 "운영팀 업무"로 보낸다. 가격·정책·
// 결제·인사·대외발송처럼 대표만 결정할 수 있는 업무만 "대표 업무"로 남긴다.
function taskModeToCategory(mode: TeamTask["mode"], assigneeRole: string): { assigneeCategory: string; status: string } {
  if (mode === "auto") return { assigneeCategory: "자동화 업무", status: "완료" };
  if (mode === "semi") return { assigneeCategory: "AI 업무", status: "시작 전" };
  if (assigneeRole === "회원관리") return { assigneeCategory: "운영팀 업무", status: "시작 전" };
  return { assigneeCategory: "대표 업무", status: "시작 전" };
}

function priorityToKo(p: TeamTask["priority"]): string {
  return { high: "긴급", normal: "보통", low: "낮음" }[p];
}

// 회원 이름·전화번호(개인정보)는 올리지 않는다 — 건수만 요약해서 기록 (pushDailyReport와 동일한 원칙).
function buildTargetSummary(task: TeamTask, context: GymContext): string {
  if (task.assigneeRole === "회원관리") {
    const parts: string[] = [];
    if (context.members.expiringSoon.length > 0) parts.push(`만료예정 ${context.members.expiringSoon.length}명`);
    if (context.money.unpaidMembers.length > 0) parts.push(`미수금 ${context.money.unpaidMembers.length}명`);
    return parts.length > 0 ? `${parts.join(" / ")} (개인정보 보호를 위해 명단은 앱 내에서 확인)` : "대상자 없음";
  }
  if (task.assigneeRole === "퍼널분석") {
    return context.funnel.pending > 0 ? `미상담 리드 ${context.funnel.pending}건 (앱 내에서 확인)` : "대상자 없음";
  }
  return "특정 대상자 없음 (전사/운영 단위 업무)";
}

export interface TaskRecordResult {
  ok: boolean;
  createdUrls: string[];
  error?: string;
}

// 지부장 협의 결과(2026-07-31): "매일 새 업무를 만들기 전에 전날 업무의 결과를 먼저 확인해 달라"는
// 요청 반영. 기존엔 업무명 완전일치로만 중복을 판단했는데, 제목에 회원 수 같은 숫자가 매일 바뀌어서
// ("만료 예정 30명" → "만료 예정 29명") 사실상 매일 새 업무가 계속 쌓이기만 했다. 숫자를 지운 형태로
// 비교해서, 아직 안 끝난(완료 아님) 같은 종류 업무가 있으면 새로 만들지 않고 근거데이터·마감일만 갱신한다.
function normalizeTaskKey(title: string): string {
  return title.replace(/\d+/g, "").trim();
}

async function findOpenTaskPageId(databaseId: string, normalizedTitle: string): Promise<string | null> {
  const data = await notionFetch(`/databases/${databaseId}/query`, {
    method: "POST",
    body: JSON.stringify({
      filter: { property: "진행상태", status: { does_not_equal: "완료" } },
      page_size: 100,
    }),
  });
  for (const page of data.results ?? []) {
    const richTitle = page.properties?.["업무명"]?.title as { plain_text: string }[] | undefined;
    const title = richTitle?.map((t) => t.plain_text).join("") ?? "";
    if (normalizeTaskKey(title) === normalizedTitle) return page.id;
  }
  return null;
}

/** 브리핑에서 나온 업무 중 우선순위 상위 N개(기본 5개)를 "업무관리" DB에 개별 업무로 만든다.
 * 같은 종류의 업무가 이미 미완료 상태로 있으면 새로 만들지 않고 근거데이터·마감일만 갱신한다. */
export async function createTaskRecords(
  tasks: TeamTask[],
  context: GymContext,
  reportUrl: string | null,
  maxCount = 5
): Promise<TaskRecordResult> {
  const databaseId = process.env.NOTION_TASKS_DATABASE_ID;
  if (!databaseId) return { ok: false, createdUrls: [], error: "미설정 (.env에 NOTION_TASKS_DATABASE_ID 필요)" };

  const weight: Record<TeamTask["priority"], number> = { high: 0, normal: 1, low: 2 };
  const top = [...tasks].sort((a, b) => weight[a.priority] - weight[b.priority]).slice(0, maxCount);
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });

  const createdUrls: string[] = [];
  try {
    for (const t of top) {
      const { assigneeCategory, status } = taskModeToCategory(t.mode, t.assigneeRole);
      const normalized = normalizeTaskKey(t.title);
      const existingId = await findOpenTaskPageId(databaseId, normalized);

      if (existingId) {
        await notionFetch(`/pages/${existingId}`, {
          method: "PATCH",
          body: JSON.stringify({
            properties: {
              "마감일": { date: { start: today } },
              "근거데이터": { rich_text: [{ text: { content: t.reason.slice(0, 1900) } }] },
              "대상자목록": { rich_text: [{ text: { content: buildTargetSummary(t, context) } }] },
            },
          }),
        });
        createdUrls.push(`https://app.notion.com/p/${existingId.replace(/-/g, "")}`);
        continue;
      }

      const page = await notionFetch("/pages", {
        method: "POST",
        body: JSON.stringify({
          parent: { database_id: databaseId },
          properties: {
            "업무명": { title: [{ text: { content: t.title.slice(0, 200) } }] },
            "지점": { select: { name: "전체" } },
            "담당구분": { select: { name: assigneeCategory } },
            "우선순위": { select: { name: priorityToKo(t.priority) } },
            "진행상태": { status: { name: status } },
            "생성일": { date: { start: today } },
            "마감일": { date: { start: today } },
            "근거데이터": { rich_text: [{ text: { content: t.reason.slice(0, 1900) } }] },
            "대상자목록": { rich_text: [{ text: { content: buildTargetSummary(t, context) } }] },
            ...(reportUrl ? { "관련보고서": { url: reportUrl } } : {}),
          },
        }),
      });
      createdUrls.push(page.url);
    }
    return { ok: true, createdUrls };
  } catch (err) {
    return { ok: false, createdUrls, error: err instanceof Error ? err.message : String(err) };
  }
}

function extractPageId(url: string): string {
  const raw = url.split("-").pop()?.split("?")[0] ?? "";
  const clean = raw.replace(/[^a-f0-9]/gi, "");
  if (clean.length !== 32) return raw;
  return `${clean.slice(0, 8)}-${clean.slice(8, 12)}-${clean.slice(12, 16)}-${clean.slice(16, 20)}-${clean.slice(20)}`;
}

export interface ExecutionLogInput {
  performedBy: string; // 수행자, 예: "제이(총괄 AI) - npm run brain"
  createdTaskUrls: string[]; // 업무관리에 실제로 생성된 업무 페이지 URL들
  outcome: "전체 성공" | "보고서만 생성" | "업무 생성 실패" | "로그 저장만";
  incompleteReason?: string;
}

/** 실행 결과(시각/수행자/생성한 업무/처리결과/미완료사유)를 "업무 로그" DB에 남긴다. */
export async function logTaskExecution(input: ExecutionLogInput): Promise<NotionPushResult> {
  const databaseId = process.env.NOTION_TASK_LOG_DATABASE_ID;
  if (!databaseId) return { ok: false, error: "미설정 (.env에 NOTION_TASK_LOG_DATABASE_ID 필요)" };

  try {
    const nowIso = new Date().toISOString();
    const nowKstLabel = new Date().toLocaleString("sv-SE", { timeZone: "Asia/Seoul" });
    const page = await notionFetch("/pages", {
      method: "POST",
      body: JSON.stringify({
        parent: { database_id: databaseId },
        properties: {
          "제목": { title: [{ text: { content: `실행 로그 - ${nowKstLabel}` } }] },
          "실행시각": { date: { start: nowIso } },
          "수행자": { rich_text: [{ text: { content: input.performedBy } }] },
          "처리결과": { select: { name: input.outcome } },
          ...(input.incompleteReason
            ? { "미완료사유": { rich_text: [{ text: { content: input.incompleteReason.slice(0, 1900) } }] } }
            : {}),
          ...(input.createdTaskUrls.length > 0
            ? { "생성한업무": { relation: input.createdTaskUrls.map((url) => ({ id: extractPageId(url) })) } }
            : {}),
        },
      }),
    });
    return { ok: true, url: page.url };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export interface YoutubeShortsPushResult {
  ok: boolean;
  addedCount: number;
  skippedExisting: number;
  error?: string;
}

/** "유튜브 숏츠 목록" DB에 이미 기록된 영상 링크 전체(페이지네이션 포함). 유튜브 쪽을 훑기
 * 전에 먼저 이걸 가져와 넘기면, 채널에 영상이 아무리 많아도 새로 올라온 것만 조회하게 된다. */
export async function getKnownYoutubeShortUrls(): Promise<Set<string>> {
  const databaseId = process.env.NOTION_YOUTUBE_SHORTS_DATABASE_ID;
  if (!databaseId) return new Set();

  const urls = new Set<string>();
  let cursor: string | undefined;
  do {
    const data = await notionFetch(`/databases/${databaseId}/query`, {
      method: "POST",
      body: JSON.stringify({ page_size: 100, ...(cursor ? { start_cursor: cursor } : {}) }),
    });
    for (const p of data.results ?? []) {
      const url = p.properties?.["링크"]?.url;
      if (url) urls.add(url);
    }
    cursor = data.has_more ? data.next_cursor : undefined;
  } while (cursor);
  return urls;
}

// 트레이너 개인 계정이 아니라 체육관 공식 채널인 경우, 노션 트레이너 속성에 사람 이름 대신 이렇게 표시한다.
const ACCOUNT_TRAINER_LABEL: Record<string, string> = {
  ziantgym: "자이언트짐 공식",
};

/** 유튜브 숏츠 목록을 "유튜브 숏츠 목록" DB에 적는다. 이미 있는 링크는 건너뛴다(중복 방지, 안전망). */
export async function pushYoutubeShorts(shorts: ShortVideo[]): Promise<YoutubeShortsPushResult> {
  const databaseId = process.env.NOTION_YOUTUBE_SHORTS_DATABASE_ID;
  if (!databaseId) return { ok: false, addedCount: 0, skippedExisting: 0, error: "미설정 (.env에 NOTION_YOUTUBE_SHORTS_DATABASE_ID 필요)" };

  try {
    const existingUrls = await getKnownYoutubeShortUrls();

    let addedCount = 0;
    let skippedExisting = 0;
    for (const s of shorts) {
      if (existingUrls.has(s.url)) {
        skippedExisting++;
        continue;
      }
      await notionFetch("/pages", {
        method: "POST",
        body: JSON.stringify({
          parent: { database_id: databaseId },
          properties: {
            "제목": { title: [{ text: { content: s.title.slice(0, 200) } }] },
            "링크": { url: s.url },
            "트레이너": { select: { name: ACCOUNT_TRAINER_LABEL[s.accountId] ?? s.accountId } },
            ...(s.publishedAt ? { "게시일": { date: { start: s.publishedAt.slice(0, 10) } } } : {}),
          },
        }),
      });
      addedCount++;
    }

    return { ok: true, addedCount, skippedExisting };
  } catch (err) {
    return { ok: false, addedCount: 0, skippedExisting: 0, error: err instanceof Error ? err.message : String(err) };
  }
}

/** 유튜브 숏츠 목록에서 해당 링크 항목의 "트레이닝일지연동" 체크박스를 갱신한다. */
export async function markTrainingLogSynced(url: string, synced: boolean): Promise<void> {
  const databaseId = process.env.NOTION_YOUTUBE_SHORTS_DATABASE_ID;
  if (!databaseId) return;
  const data = await notionFetch(`/databases/${databaseId}/query`, {
    method: "POST",
    body: JSON.stringify({
      filter: { property: "링크", url: { equals: url } },
      page_size: 1,
    }),
  });
  const page = data.results?.[0];
  if (!page) return;
  await notionFetch(`/pages/${page.id}`, {
    method: "PATCH",
    body: JSON.stringify({ properties: { "트레이닝일지연동": { checkbox: synced } } }),
  });
}

export function isNotionEnabled(): boolean {
  return isConfigured();
}

// ─── 온라인 지부장 2차 검증(DB 실대조) → 자이언트짐 협의실 ────────────────────
// "협의실 확인" 클라우드 루틴이 하루 4번(00·02·04·13시 KST) 이 함수를 호출해, 그날의
// "제이 교류｜YYYY-MM-DD 자정 인계" 페이지에 실DB 대조 결과를 남긴다. 페이지가 없으면 새로 만든다.
const CONSULT_ROOM_DATABASE_ID = "14175314d008427b8fba48c6c62f4da7";

function branchLabel(branchId: number | null): string {
  return branchId === 1 ? "1호점" : branchId === 2 ? "2호점" : "지점미상";
}

function buildVerificationBlocks(result: VerificationResult): Block[] {
  const kstTime = new Date(result.asOfTimestamp).toLocaleTimeString("ko-KR", { timeZone: "Asia/Seoul", hour12: false });
  const blocks: Block[] = [
    heading(`🔍 온라인 지부장 실대조 검증 · ${result.asOfDate} ${kstTime} KST`),
    paragraph(
      "출처: Neon Postgres 실조회(gatherContext + revenue_entries + members), 실행: verify.ts runVerification(). 사람이 쓴 서술이 아니라 매 실행마다 DB에서 직접 계산한 원본 데이터입니다(증감 계산 없음)."
    ),
  ];

  for (const s of result.scopes) {
    blocks.push(
      bullet(
        `[${s.scope}] 활성 ${s.activeNow}명 · 계약액 ${s.contractAmount.toLocaleString()}원 · 실입금 ${s.monthRevenue.toLocaleString()}원 · 환불 ${s.refundAmount.toLocaleString()}원 · 신규 ${s.newCount}건 · 재등록 ${s.reRegisterCount}건 (이번달 누계)`
      )
    );
  }

  blocks.push(paragraph(result.activeMethodNote));

  blocks.push(heading(`오늘(${result.asOfDate}) 실제 거래 내역 (revenue_entries 직접 조회)`));
  if (result.todayTransactions.length === 0) {
    blocks.push(paragraph("오늘 거래 없음"));
  } else {
    for (const t of result.todayTransactions) {
      blocks.push(
        bullet(
          `${t.subType} · ${branchLabel(t.branchId)} · ${t.customerName ?? "이름없음"} · 계약 ${t.amount.toLocaleString()}원 / 실입금 ${t.paidAmount.toLocaleString()}원${t.refundAmount ? ` / 환불 ${t.refundAmount.toLocaleString()}원` : ""}${t.unpaidAmount ? ` / 미수 ${t.unpaidAmount.toLocaleString()}원` : ""}`
        )
      );
    }
  }

  blocks.push(heading(`헬스권 만료 10일 이내 (${result.expiringWithin10.length}명, 실명단)`));
  if (result.expiringWithin10.length === 0) {
    blocks.push(paragraph("대상 없음"));
  } else {
    for (const m of result.expiringWithin10) {
      blocks.push(bullet(`${m.name} · ${branchLabel(m.branchId)} · 만료 ${m.membershipEnd} (D-${m.daysLeft}) · ${m.phone ?? "연락처 누락"}`));
    }
  }

  blocks.push(heading(`현재 미수금 (${result.unpaidMembersNow.length}명)`));
  if (result.unpaidMembersNow.length === 0) {
    blocks.push(paragraph("미수금 없음"));
  } else {
    for (const u of result.unpaidMembersNow) {
      blocks.push(bullet(`${u.name} · ${branchLabel(u.branchId)} · ${u.unpaid.toLocaleString()}원 · ${u.phone ?? "연락처 누락"}`));
    }
  }

  return blocks;
}

/** 협의실 DB에서 오늘자 "제이 교류｜YYYY-MM-DD 자정 인계" 페이지를 찾아 검증 블록을 이어붙이고,
 * 없으면 새로 만든다. 상태는 "확인 중"(대표 확인 전)으로 시작한다. */
export async function pushVerificationToConsultRoom(result: VerificationResult): Promise<NotionPushResult> {
  if (!process.env.NOTION_API_KEY) {
    return { ok: false, error: "Notion 미설정 (.env에 NOTION_API_KEY 필요)" };
  }
  const databaseId = process.env.NOTION_CONSULT_ROOM_DATABASE_ID || CONSULT_ROOM_DATABASE_ID;
  const title = `제이 교류｜${result.asOfDate} 자정 인계`;

  try {
    const query = await notionFetch(`/databases/${databaseId}/query`, {
      method: "POST",
      body: JSON.stringify({
        filter: { property: "협의 안건", title: { starts_with: title } },
        page_size: 1,
      }),
    });

    const verifyBlocks = buildVerificationBlocks(result);

    if (query.results?.length > 0) {
      const pageId = query.results[0].id;
      await appendRemainingBlocks(pageId, verifyBlocks);
      return { ok: true, url: query.results[0].url };
    }

    const page = await notionFetch("/pages", {
      method: "POST",
      body: JSON.stringify({
        parent: { database_id: databaseId },
        properties: {
          "협의 안건": { title: [{ text: { content: title } }] },
          "지점": { select: { name: "전체" } },
          "구분": { select: { name: "오류·검증" } },
          "담당": { select: { name: "온라인 지부장" } },
          "상태": { select: { name: "확인 중" } },
          "우선순위": { select: { name: "보통" } },
          "등록일": { date: { start: result.asOfDate } },
        },
        children: verifyBlocks.slice(0, 100),
      }),
    });
    if (verifyBlocks.length > 100) await appendRemainingBlocks(page.id, verifyBlocks.slice(100));
    return { ok: true, url: page.url };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
