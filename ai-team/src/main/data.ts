// 데이터 수집: ZIANTGYM+ DB(Neon/Postgres)에서 총괄 AI가 분석할 지표를 모은다.
// DATABASE_URL 이 없으면 샘플 데이터로 동작해 앱이 항상 켜지게 한다.
// Neon 공식 서버리스 드라이버의 순수 HTTP 쿼리 함수(neon()) 사용 — 일반 pg(TCP 5432)는
// 클라우드 예약실행 환경에서 포트가 막혀 있고, 같은 드라이버의 WebSocket 기반 Pool도
// 이 환경의 아웃바운드 프록시가 WebSocket 업그레이드를 막아 실패하는 것으로 확인됨
// ("Received network error or non-101 status code"). neon()은 일반 HTTPS 요청 하나로
// 쿼리하기 때문에 노션 API 호출과 동일하게 문제없이 통과함.
import { neon } from "@neondatabase/serverless";

export interface MemberListItem {
  name: string;
  phone: string | null;
  membershipEnd: string;
  branchId: number | null;
  daysUntilExpiry: number; // 오늘 기준 만료까지 남은 일수 (recentlyExpired는 음수)
}

export interface BranchSummary {
  branchId: number; // 1, 2 (전체 통합은 GymContext 최상위 필드로 따로 존재)
  branchName: string;
  active: number;
  contractAmount: number; // 이번달 계약액(할인 전, amount) 합계
  monthRevenue: number; // 이번달 실입금(paidAmount) 합계
  unpaidTotal: number; // 전체 미수금(전 기간)
  expiringSoonCount: number;
  recentlyExpiredCount: number;
  newCount: number; // 이번달 신규 건수
  reRegisterCount: number; // 이번달 재등록 건수
}

export interface GymContext {
  source: "db" | "sample";
  asOf: string; // YYYY-MM-DD
  meta: {
    asOfTimestamp: string; // ISO, 데이터를 실제로 조회한 시각
    dbConnected: boolean; // DATABASE_URL 조회 성공 여부 (false면 source="sample")
    queryError?: string; // dbConnected=false일 때 원인
  };
  members: {
    total: number;
    active: number;
    expiringSoon: MemberListItem[]; // 30일 내 만료
    recentlyExpired: MemberListItem[]; // 최근 14일 만료(이탈위험)
    expiringBuckets: { within7: number; within14: number; within30: number }; // expiringSoon을 만료까지 남은 기간으로 분류
  };
  funnel: {
    // 고객 생애 흐름: 유입 → 상담 → 등록 (leads.status 기준)
    pending: number; // 유입/미상담
    consulted: number; // 상담 완료
    registered: number; // 등록 전환
    dropped: number; // 이탈
    consultRate: number; // 상담 전환율 %
    registerRate: number; // 상담→등록 전환율 %
  };
  money: {
    // "이번달" 매출 구성요소 — 지부장 협의 결과 반영(2026-07-31): 계약액/실입금/환불/미수금을 구분해서 제공.
    contractAmount: number; // 이번달 계약액(할인 전) 합계
    monthRevenue: number; // 이번달 실제 입금액(paidAmount) 합계 — 기존 필드명 유지(하위호환)
    refundAmount: number; // 이번달 환불·취소액 합계
    unpaidThisMonth: number; // 이번달 발생분 중 미수금
    netRevenueThisMonth: number; // 이번달 최종 실현 매출 = monthRevenue - refundAmount
    reRegisterCount: number; // 이번달 재등록 건수
    newCount: number; // 이번달 신규 건수
    unpaidTotal: number; // 전체 미수금(전 기간 누적, 이번달 매출과는 별개 지표)
    unpaidMembers: { name: string; phone: string | null; unpaid: number; branchId: number | null }[];
  };
  expense: {
    thisMonthTotal: number; // 이번달 지출 합계(expense_entries)
    byCategory: { category: string; amount: number }[];
    netProfitThisMonth: number; // monthRevenue - thisMonthTotal (단순 현금 기준, 정밀 회계 아님)
  };
  channels: { channel: string; leads: number; registered: number; rate: number }[]; // 채널별 리드->등록 전환율
  byBranch: BranchSummary[]; // [1호점, 2호점] — 지부장 협의 결과 반영(2026-07-31)
}

function ymd(d: Date) {
  return d.toISOString().slice(0, 10);
}

function daysBetween(fromYmd: string, toYmd: string): number {
  const a = new Date(fromYmd + "T00:00:00Z").getTime();
  const b = new Date(toYmd + "T00:00:00Z").getTime();
  return Math.round((b - a) / 864e5);
}

function bucketExpiring(list: MemberListItem[]) {
  return {
    within7: list.filter((m) => m.daysUntilExpiry <= 7).length,
    within14: list.filter((m) => m.daysUntilExpiry > 7 && m.daysUntilExpiry <= 14).length,
    within30: list.filter((m) => m.daysUntilExpiry > 14).length,
  };
}

const BRANCH_NAMES: Record<number, string> = { 1: "1호점", 2: "2호점" };

function sampleContext(): GymContext {
  const today = ymd(new Date());
  const expiringSoon: MemberListItem[] = [
    { name: "김서연", phone: "010-1234-5678", membershipEnd: today, branchId: 1, daysUntilExpiry: 3 },
    { name: "박준호", phone: "010-2222-3333", membershipEnd: today, branchId: 1, daysUntilExpiry: 10 },
    { name: "이민지", phone: "010-4444-5555", membershipEnd: today, branchId: 2, daysUntilExpiry: 20 },
  ];
  const recentlyExpired: MemberListItem[] = [
    { name: "정우성", phone: "010-7777-8888", membershipEnd: today, branchId: 1, daysUntilExpiry: -3 },
  ];
  return {
    source: "sample",
    asOf: today,
    meta: { asOfTimestamp: new Date().toISOString(), dbConnected: false },
    members: {
      total: 214,
      active: 168,
      expiringSoon,
      recentlyExpired,
      expiringBuckets: bucketExpiring(expiringSoon),
    },
    funnel: { pending: 12, consulted: 20, registered: 9, dropped: 5, consultRate: 63, registerRate: 45 },
    money: {
      contractAmount: 18400000,
      monthRevenue: 18400000,
      refundAmount: 0,
      unpaidThisMonth: 0,
      netRevenueThisMonth: 18400000,
      reRegisterCount: 7,
      newCount: 11,
      unpaidTotal: 1350000,
      unpaidMembers: [{ name: "최유진", phone: "010-9999-0000", unpaid: 1350000, branchId: 1 }],
    },
    expense: { thisMonthTotal: 0, byCategory: [], netProfitThisMonth: 18400000 },
    channels: [
      { channel: "네이버 플레이스", leads: 14, registered: 8, rate: 57 },
      { channel: "인스타그램", leads: 9, registered: 2, rate: 22 },
      { channel: "지인 소개", leads: 6, registered: 5, rate: 83 },
      { channel: "당근", leads: 4, registered: 1, rate: 25 },
    ],
    byBranch: [
      { branchId: 1, branchName: "1호점", active: 130, contractAmount: 13800000, monthRevenue: 13000000, unpaidTotal: 1350000, expiringSoonCount: 2, recentlyExpiredCount: 1, newCount: 7, reRegisterCount: 4 },
      { branchId: 2, branchName: "2호점", active: 38, contractAmount: 5600000, monthRevenue: 5400000, unpaidTotal: 0, expiringSoonCount: 1, recentlyExpiredCount: 0, newCount: 4, reRegisterCount: 3 },
    ],
  };
}

export async function gatherContext(): Promise<GymContext> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    const ctx = sampleContext();
    ctx.meta.queryError = "DATABASE_URL 미설정";
    return ctx;
  }

  const sql = neon(url);

  const now = new Date();
  const today = ymd(now);
  const in30 = ymd(new Date(now.getTime() + 30 * 864e5));
  const ago14 = ymd(new Date(now.getTime() - 14 * 864e5));
  const monthPrefix = today.slice(0, 7);
  const monthStart = `${monthPrefix}-01`;

  type MemberRow = { name: string; phone: string | null; membershipEnd: string; branchId: number | null };
  type LeadRow = { status: string; channelId: number | null };
  type RevenueRow = {
    subType: string;
    branchId: number | null;
    amount: number;
    paidAmount: number;
    unpaidAmount: number;
    refundAmount: number;
    customerName: string | null;
    phone: string | null;
    paymentDate: string;
  };
  type ChannelRow = { id: number; name: string };
  type ExpenseRow = { branchId: number | null; category: string; amount: number };

  let raw: {
    mCountRows: { c: string }[];
    mActiveRows: { c: string }[];
    mActiveByBranch: { branchId: number | null; c: string }[];
    expiring: MemberRow[];
    expired: MemberRow[];
    leadsRows: LeadRow[];
    revRows: RevenueRow[];
    channelRows: ChannelRow[];
    expenseRows: ExpenseRow[];
  };

  try {
    const [
      mCountRows,
      mActiveRows,
      mActiveByBranch,
      expiring,
      expired,
      leadsRows,
      revRows,
      channelRows,
      expenseRows,
    ] = (await Promise.all([
      sql.query(`SELECT COUNT(*) c FROM members`),
      sql.query(`SELECT COUNT(*) c FROM members WHERE status = 'active'`),
      sql.query(`SELECT "branchId", COUNT(*) c FROM members WHERE status = 'active' GROUP BY "branchId"`),
      sql.query(
        `SELECT "branchId", name, phone, "membershipEnd" FROM members
         WHERE "membershipEnd" IS NOT NULL AND "membershipEnd" >= $1 AND "membershipEnd" <= $2
         ORDER BY "membershipEnd" ASC LIMIT 60`,
        [today, in30]
      ),
      sql.query(
        `SELECT "branchId", name, phone, "membershipEnd" FROM members
         WHERE "membershipEnd" IS NOT NULL AND "membershipEnd" >= $1 AND "membershipEnd" < $2
         ORDER BY "membershipEnd" DESC LIMIT 60`,
        [ago14, today]
      ),
      sql.query(`SELECT status, "channelId" FROM leads`),
      sql.query(
        `SELECT "subType", "branchId", amount, "paidAmount", "unpaidAmount", "refundAmount", "customerName", phone, "paymentDate"
         FROM revenue_entries`
      ),
      sql.query(`SELECT id, name FROM channels`),
      sql.query(
        `SELECT "branchId", category, SUM(amount) amount FROM expense_entries
         WHERE "expenseDate" >= $1 GROUP BY "branchId", category`,
        [monthStart]
      ),
    ])) as [
      { c: string }[],
      { c: string }[],
      { branchId: number | null; c: string }[],
      MemberRow[],
      MemberRow[],
      LeadRow[],
      RevenueRow[],
      ChannelRow[],
      { branchId: number | null; category: string; amount: string }[]
    ];
    raw = {
      mCountRows,
      mActiveRows,
      mActiveByBranch,
      expiring,
      expired,
      leadsRows,
      revRows,
      channelRows,
      expenseRows: expenseRows.map((r) => ({ ...r, amount: Number(r.amount ?? 0) })),
    };
  } catch (err) {
    const ctx = sampleContext();
    ctx.meta.queryError = err instanceof Error ? err.message : String(err);
    return ctx;
  }

  const { mCountRows, mActiveRows, mActiveByBranch, leadsRows, revRows, channelRows, expenseRows } = raw;

  const withDays = (rows: MemberRow[]): MemberListItem[] =>
    rows.map((r) => ({
      name: r.name,
      phone: r.phone,
      membershipEnd: r.membershipEnd,
      branchId: r.branchId,
      daysUntilExpiry: daysBetween(today, r.membershipEnd),
    }));
  const expiringSoon = withDays(raw.expiring);
  const recentlyExpired = withDays(raw.expired);

  const statusCount = (s: string) => leadsRows.filter((r) => r.status === s).length;
  const pending = statusCount("pending");
  const consulted = statusCount("consulted");
  const registered = statusCount("registered");
  const dropped = statusCount("dropped");
  const totalLeads = leadsRows.length || 1;

  const monthRev = revRows.filter((r) => (r.paymentDate || "").startsWith(monthPrefix));
  const unpaidRows = revRows.filter((r) => Number(r.unpaidAmount) > 0);

  const channelStats = channelRows
    .map((ch) => {
      const chLeads = leadsRows.filter((l) => l.channelId === ch.id);
      const chRegistered = chLeads.filter((l) => l.status === "registered").length;
      return {
        channel: ch.name,
        leads: chLeads.length,
        registered: chRegistered,
        rate: chLeads.length > 0 ? Math.round((chRegistered / chLeads.length) * 100) : 0,
      };
    })
    .filter((c) => c.leads > 0)
    .sort((a, b) => b.leads - a.leads);

  const contractAmount = monthRev.reduce((s, r) => s + Number(r.amount || 0), 0);
  const monthRevenue = monthRev.reduce((s, r) => s + Number(r.paidAmount || 0), 0);
  const refundAmount = monthRev.reduce((s, r) => s + Number(r.refundAmount || 0), 0);
  const unpaidThisMonth = monthRev.reduce((s, r) => s + Number(r.unpaidAmount || 0), 0);
  const expenseThisMonthTotal = expenseRows.reduce((s, r) => s + r.amount, 0);
  const expenseByCategory = Array.from(
    expenseRows.reduce((acc, r) => {
      acc.set(r.category, (acc.get(r.category) ?? 0) + r.amount);
      return acc;
    }, new Map<string, number>())
  ).map(([category, amount]) => ({ category, amount }));

  const activeByBranch = new Map(mActiveByBranch.map((r) => [r.branchId, Number(r.c)]));
  const byBranch: BranchSummary[] = [1, 2].map((branchId) => ({
    branchId,
    branchName: BRANCH_NAMES[branchId],
    active: activeByBranch.get(branchId) ?? 0,
    contractAmount: monthRev.filter((r) => r.branchId === branchId).reduce((s, r) => s + Number(r.amount || 0), 0),
    monthRevenue: monthRev.filter((r) => r.branchId === branchId).reduce((s, r) => s + Number(r.paidAmount || 0), 0),
    unpaidTotal: unpaidRows
      .filter((r) => r.branchId === branchId)
      .reduce((s, r) => s + Number(r.unpaidAmount || 0), 0),
    expiringSoonCount: expiringSoon.filter((m) => m.branchId === branchId).length,
    recentlyExpiredCount: recentlyExpired.filter((m) => m.branchId === branchId).length,
    newCount: monthRev.filter((r) => r.branchId === branchId && r.subType === "신규").length,
    reRegisterCount: monthRev.filter((r) => r.branchId === branchId && r.subType === "재등록").length,
  }));

  return {
    source: "db",
    asOf: today,
    meta: { asOfTimestamp: new Date().toISOString(), dbConnected: true },
    members: {
      total: Number(mCountRows[0]?.c ?? 0),
      active: Number(mActiveRows[0]?.c ?? 0),
      expiringSoon,
      recentlyExpired,
      expiringBuckets: bucketExpiring(expiringSoon),
    },
    funnel: {
      pending,
      consulted,
      registered,
      dropped,
      consultRate: Math.round(((consulted + registered) / totalLeads) * 100),
      registerRate: consulted + registered > 0 ? Math.round((registered / (consulted + registered)) * 100) : 0,
    },
    money: {
      contractAmount,
      monthRevenue,
      refundAmount,
      unpaidThisMonth,
      netRevenueThisMonth: monthRevenue - refundAmount,
      reRegisterCount: monthRev.filter((r) => r.subType === "재등록").length,
      newCount: monthRev.filter((r) => r.subType === "신규").length,
      unpaidTotal: unpaidRows.reduce((s, r) => s + Number(r.unpaidAmount || 0), 0),
      unpaidMembers: unpaidRows
        .map((r) => ({ name: r.customerName ?? "이름없음", phone: r.phone, unpaid: Number(r.unpaidAmount), branchId: r.branchId }))
        .sort((a, b) => b.unpaid - a.unpaid)
        .slice(0, 20),
    },
    expense: {
      thisMonthTotal: expenseThisMonthTotal,
      byCategory: expenseByCategory,
      netProfitThisMonth: monthRevenue - expenseThisMonthTotal,
    },
    channels: channelStats,
    byBranch,
  };
}
