import { pool } from "./db";

// KST(UTC+9) 기준 날짜/시간. UTC 기준으로 계산하면 한국 오전(00~09시)에 "오늘" 판정이
// 하루 밀리는 문제가 생긴다 (다른 파일들과 동일한 관례).
function kstDate(offsetDays = 0): string {
  return new Date(Date.now() + 9 * 3600000 + offsetDays * 86400000).toISOString().substring(0, 10);
}
function kstNow(): Date {
  return new Date(Date.now() + 9 * 3600000);
}
function fmtWon(n: number): string {
  return `${Math.round(n).toLocaleString()}원`;
}
function monthRange(yearMonth: string) {
  const [y, m] = yearMonth.split("-").map(Number);
  const start = `${yearMonth}-01`;
  const endDate = new Date(y, m, 1);
  const end = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, "0")}-01`;
  return { start, end };
}

const NOTION_API = "https://api.notion.com/v1";

function notionHeaders() {
  return {
    Authorization: `Bearer ${process.env.NOTION_API_TOKEN}`,
    "Notion-Version": "2022-06-28",
    "Content-Type": "application/json",
  };
}

function heading(text: string) {
  return { object: "block", type: "heading_2", heading_2: { rich_text: [{ type: "text", text: { content: text } }] } };
}
function bullet(text: string) {
  return { object: "block", type: "bulleted_list_item", bulleted_list_item: { rich_text: [{ type: "text", text: { content: text } }] } };
}
function divider() {
  return { object: "block", type: "divider", divider: {} };
}

async function createNotionPage(title: string, blocks: any[]): Promise<boolean> {
  const token = process.env.NOTION_API_TOKEN;
  const parentId = process.env.NOTION_BRIEFING_PAGE_ID;
  if (!token || !parentId) {
    console.log("⏭️ 노션 브리핑 스킵: NOTION_API_TOKEN 또는 NOTION_BRIEFING_PAGE_ID 미설정");
    return false;
  }
  try {
    const res = await fetch(`${NOTION_API}/pages`, {
      method: "POST",
      headers: notionHeaders(),
      body: JSON.stringify({
        parent: { page_id: parentId },
        properties: { title: { title: [{ text: { content: title } }] } },
        // Notion 페이지 생성 시 children은 최대 100블록 — 브리핑 분량상 여유 있음
        children: blocks,
      }),
    });
    if (!res.ok) {
      console.error("노션 브리핑 전송 실패:", res.status, await res.text());
      return false;
    }
    console.log(`📤 노션 브리핑 전송 완료: ${title}`);
    return true;
  } catch (e) {
    console.error("노션 브리핑 전송 오류:", e);
    return false;
  }
}

// ── 지표 수집 (기존 KPI 라우터들과 동일한 계산 기준을 그대로 따른다 — 화면에 보이는
//    숫자와 브리핑 숫자가 어긋나지 않도록) ────────────────────────────────────────
async function getRevenueTotals(startDate: string, endDate: string) {
  const r = await pool.query<{ total: string; ptTotal: string; healthTotal: string; newTotal: string; renewalTotal: string; cnt: string }>(
    `SELECT
       COALESCE(SUM("paidAmount"),0) AS total,
       COALESCE(SUM("paidAmount") FILTER (WHERE type = 'PT'), 0) AS "ptTotal",
       COALESCE(SUM("paidAmount") FILTER (WHERE type = '헬스'), 0) AS "healthTotal",
       COALESCE(SUM("paidAmount") FILTER (WHERE "subType" = '신규'), 0) AS "newTotal",
       COALESCE(SUM("paidAmount") FILTER (WHERE "subType" = '재등록'), 0) AS "renewalTotal",
       COUNT(*) AS cnt
     FROM revenue_entries
     WHERE "paymentDate" >= $1 AND "paymentDate" < $2 AND COALESCE("subType",'') <> '이전'`,
    [startDate, endDate]
  );
  const row = r.rows[0];
  return {
    total: Number(row?.total ?? 0),
    ptTotal: Number(row?.ptTotal ?? 0),
    healthTotal: Number(row?.healthTotal ?? 0),
    newTotal: Number(row?.newTotal ?? 0),
    renewalTotal: Number(row?.renewalTotal ?? 0),
    cnt: Number(row?.cnt ?? 0),
  };
}

async function getMemberCounts(asOfDate: string, monthStart: string) {
  const r = await pool.query<{ active: string; newThisMonth: string; expired: string }>(
    `SELECT
       (SELECT COUNT(*) FROM members WHERE "createdAt" < $1 AND "membershipEnd" IS NOT NULL AND "membershipEnd" >= $1) AS active,
       (SELECT COUNT(*) FROM members WHERE "createdAt" >= $2) AS "newThisMonth",
       (SELECT COUNT(*) FROM members WHERE "membershipEnd" >= $2 AND "membershipEnd" < $1) AS expired
    `,
    [asOfDate, monthStart]
  );
  const row = r.rows[0];
  return {
    active: Number(row?.active ?? 0),
    newThisMonth: Number(row?.newThisMonth ?? 0),
    expired: Number(row?.expired ?? 0),
  };
}

async function getUnpaidTotal() {
  const r = await pool.query<{ total: string }>(`SELECT COALESCE(SUM("unpaidAmount"),0) AS total FROM revenue_entries`);
  return Number(r.rows[0]?.total ?? 0);
}

async function getPricingAnomalyCount() {
  const r = await pool.query<{ id: number; pricePerSession: number | null }>(`
    SELECT id, "pricePerSession" FROM pt_packages
    WHERE status = 'active' AND COALESCE("totalSessions",0) > 0
  `);
  const prices = r.rows.map((row) => row.pricePerSession ?? 0).filter((n) => n > 0).sort((a, b) => a - b);
  const median = prices.length > 0 ? prices[Math.floor(prices.length / 2)] : 0;
  const threshold = median * 0.4;
  if (threshold <= 0) return 0;
  return r.rows.filter((row) => (row.pricePerSession ?? 0) > 0 && (row.pricePerSession ?? 0) < threshold).length;
}

// ── 일간 브리핑 ──────────────────────────────────────────────────────────────
export async function sendDailyBriefing() {
  const today = kstDate();
  const monthPrefix = today.substring(0, 7);
  const { start, end } = monthRange(monthPrefix);

  const [todayTotals, monthTotals, unpaid, anomalyCount] = await Promise.all([
    getRevenueTotals(today, kstDate(1)),
    getRevenueTotals(start, end),
    getUnpaidTotal(),
    getPricingAnomalyCount(),
  ]);

  const blocks = [
    heading("💰 오늘 매출"),
    bullet(`오늘(${today}) 매출: ${fmtWon(todayTotals.total)} (${todayTotals.cnt}건)`),
    bullet(`이번달 누적 매출: ${fmtWon(monthTotals.total)}`),
    divider(),
    heading("📋 요약"),
    bullet(`전체 미수금: ${fmtWon(unpaid)}`),
    bullet(anomalyCount > 0 ? `⚠️ 정산 단가 이상 항목 ${anomalyCount}건 — KPI 대시보드에서 확인 필요` : "정산 단가 이상 항목 없음"),
  ];

  await createNotionPage(`일일 브리핑 ${today}`, blocks);
}

// ── 주간 브리핑 ──────────────────────────────────────────────────────────────
export async function sendWeeklyBriefing() {
  const today = kstDate();
  const weekStart = kstDate(-6); // 최근 7일(오늘 포함)
  const prevWeekStart = kstDate(-13);
  const prevWeekEnd = kstDate(-7);

  const [thisWeek, prevWeek, unpaid, anomalyCount] = await Promise.all([
    getRevenueTotals(weekStart, kstDate(1)),
    getRevenueTotals(prevWeekStart, prevWeekEnd),
    getUnpaidTotal(),
    getPricingAnomalyCount(),
  ]);

  const growth = prevWeek.total > 0 ? Math.round(((thisWeek.total - prevWeek.total) / prevWeek.total) * 100) : null;

  const blocks = [
    heading("📅 최근 7일 매출"),
    bullet(`${weekStart} ~ ${today}: ${fmtWon(thisWeek.total)} (${thisWeek.cnt}건)`),
    bullet(`신규: ${fmtWon(thisWeek.newTotal)} · 재등록: ${fmtWon(thisWeek.renewalTotal)}`),
    bullet(`PT: ${fmtWon(thisWeek.ptTotal)} · 헬스: ${fmtWon(thisWeek.healthTotal)}`),
    bullet(growth != null ? `전주 대비: ${growth >= 0 ? "+" : ""}${growth}%` : "전주 대비 비교 불가(전주 매출 0원)"),
    divider(),
    heading("📋 요약"),
    bullet(`전체 미수금: ${fmtWon(unpaid)}`),
    bullet(anomalyCount > 0 ? `⚠️ 정산 단가 이상 항목 ${anomalyCount}건` : "정산 단가 이상 항목 없음"),
  ];

  await createNotionPage(`주간 브리핑 ${weekStart} ~ ${today}`, blocks);
}

// ── 월간 브리핑 ──────────────────────────────────────────────────────────────
export async function sendMonthlyBriefing() {
  const today = kstDate();
  const monthPrefix = today.substring(0, 7);
  const { start, end } = monthRange(monthPrefix);

  const prevDate = new Date(start);
  prevDate.setMonth(prevDate.getMonth() - 1);
  const prevPrefix = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, "0")}`;
  const prevRange = monthRange(prevPrefix);

  const [monthTotals, prevMonthTotals, memberCounts, unpaid, anomalyCount] = await Promise.all([
    getRevenueTotals(start, end),
    getRevenueTotals(prevRange.start, prevRange.end),
    getMemberCounts(today, start),
    getUnpaidTotal(),
    getPricingAnomalyCount(),
  ]);

  const growth = prevMonthTotals.total > 0
    ? Math.round(((monthTotals.total - prevMonthTotals.total) / prevMonthTotals.total) * 100)
    : null;

  const blocks = [
    heading(`📆 ${monthPrefix} 월간 매출`),
    bullet(`총 매출: ${fmtWon(monthTotals.total)} (${monthTotals.cnt}건)`),
    bullet(`신규: ${fmtWon(monthTotals.newTotal)} · 재등록: ${fmtWon(monthTotals.renewalTotal)}`),
    bullet(`PT: ${fmtWon(monthTotals.ptTotal)} · 헬스: ${fmtWon(monthTotals.healthTotal)}`),
    bullet(growth != null ? `전월 대비: ${growth >= 0 ? "+" : ""}${growth}%` : "전월 대비 비교 불가(전월 매출 0원)"),
    divider(),
    heading("👥 회원 현황"),
    bullet(`활성 회원: ${memberCounts.active}명`),
    bullet(`이번달 신규 가입: ${memberCounts.newThisMonth}명`),
    bullet(`이번달 만료: ${memberCounts.expired}명`),
    divider(),
    heading("📋 요약"),
    bullet(`전체 미수금: ${fmtWon(unpaid)}`),
    bullet(anomalyCount > 0 ? `⚠️ 정산 단가 이상 항목 ${anomalyCount}건` : "정산 단가 이상 항목 없음"),
  ];

  await createNotionPage(`월간 브리핑 ${monthPrefix}`, blocks);
}

// ── 스케줄러 (매분 확인, 별도 패키지 없이 setInterval 사용) ──────────────────────
let schedulerStarted = false;
let lastDailyKey = "";
let lastWeeklyKey = "";
let lastMonthlyKey = "";

// 매일 오전 8시(KST) 발송. 서버가 그 순간 꺼져있어도 다음 날 다시 조건이 맞으므로
// 최소 하루 지연 정도로 자연히 따라잡는다(재시도 로직 없이도 무해).
export function startNotionBriefingScheduler() {
  if (schedulerStarted) return;
  if (!process.env.NOTION_API_TOKEN || !process.env.NOTION_BRIEFING_PAGE_ID) {
    console.log("⏭️ 노션 브리핑 스케줄러 비활성화 (NOTION_API_TOKEN/NOTION_BRIEFING_PAGE_ID 미설정)");
    return;
  }
  schedulerStarted = true;
  console.log("🔔 노션 브리핑 스케줄러 시작 (매일 08:00 KST)");

  setInterval(async () => {
    const now = kstNow();
    const hour = now.getUTCHours(); // kstNow()가 이미 +9h 보정된 시각이므로 getUTC*로 읽는다
    const minute = now.getUTCMinutes();
    if (hour !== 8 || minute !== 0) return;

    const dateKey = kstDate();
    if (lastDailyKey !== dateKey) {
      lastDailyKey = dateKey;
      sendDailyBriefing().catch((e) => console.error("일일 브리핑 오류:", e));
    }

    const dow = now.getUTCDay(); // 0=일 ... 1=월
    if (dow === 1 && lastWeeklyKey !== dateKey) {
      lastWeeklyKey = dateKey;
      sendWeeklyBriefing().catch((e) => console.error("주간 브리핑 오류:", e));
    }

    if (now.getUTCDate() === 1 && lastMonthlyKey !== dateKey) {
      lastMonthlyKey = dateKey;
      sendMonthlyBriefing().catch((e) => console.error("월간 브리핑 오류:", e));
    }
  }, 60000);
}
