// 데이터 수집: ZIANTGYM+ DB(Neon/Postgres)에서 총괄 AI가 분석할 지표를 모은다.
// DATABASE_URL 이 없으면 샘플 데이터로 동작해 앱이 항상 켜지게 한다.
// Neon 공식 서버리스 드라이버의 순수 HTTP 쿼리 함수(neon()) 사용 — 일반 pg(TCP 5432)는
// 클라우드 예약실행 환경에서 포트가 막혀 있고, 같은 드라이버의 WebSocket 기반 Pool도
// 이 환경의 아웃바운드 프록시가 WebSocket 업그레이드를 막아 실패하는 것으로 확인됨
// ("Received network error or non-101 status code"). neon()은 일반 HTTPS 요청 하나로
// 쿼리하기 때문에 노션 API 호출과 동일하게 문제없이 통과함.
import { neon } from "@neondatabase/serverless";

export interface GymContext {
  source: "db" | "sample";
  asOf: string; // YYYY-MM-DD
  members: {
    total: number;
    active: number;
    expiringSoon: { name: string; phone: string | null; membershipEnd: string }[]; // 30일 내 만료
    recentlyExpired: { name: string; phone: string | null; membershipEnd: string }[]; // 최근 14일 만료(이탈위험)
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
    monthRevenue: number; // 이번달 결제액
    reRegisterCount: number; // 이번달 재등록 건수
    newCount: number; // 이번달 신규 건수
    unpaidTotal: number; // 전체 미수금
    unpaidMembers: { name: string; phone: string | null; unpaid: number }[];
  };
  channels: { channel: string; leads: number; registered: number; rate: number }[]; // 채널별 리드->등록 전환율
}

function ymd(d: Date) {
  return d.toISOString().slice(0, 10);
}

function sampleContext(): GymContext {
  const today = ymd(new Date());
  return {
    source: "sample",
    asOf: today,
    members: {
      total: 214,
      active: 168,
      expiringSoon: [
        { name: "김서연", phone: "010-1234-5678", membershipEnd: today },
        { name: "박준호", phone: "010-2222-3333", membershipEnd: today },
        { name: "이민지", phone: "010-4444-5555", membershipEnd: today },
      ],
      recentlyExpired: [{ name: "정우성", phone: "010-7777-8888", membershipEnd: today }],
    },
    funnel: { pending: 12, consulted: 20, registered: 9, dropped: 5, consultRate: 63, registerRate: 45 },
    money: {
      monthRevenue: 18400000,
      reRegisterCount: 7,
      newCount: 11,
      unpaidTotal: 1350000,
      unpaidMembers: [{ name: "최유진", phone: "010-9999-0000", unpaid: 1350000 }],
    },
    channels: [
      { channel: "네이버 플레이스", leads: 14, registered: 8, rate: 57 },
      { channel: "인스타그램", leads: 9, registered: 2, rate: 22 },
      { channel: "지인 소개", leads: 6, registered: 5, rate: 83 },
      { channel: "당근", leads: 4, registered: 1, rate: 25 },
    ],
  };
}

export async function gatherContext(): Promise<GymContext> {
  const url = process.env.DATABASE_URL;
  if (!url) return sampleContext();

  const sql = neon(url);

  const now = new Date();
  const today = ymd(now);
  const in30 = ymd(new Date(now.getTime() + 30 * 864e5));
  const ago14 = ymd(new Date(now.getTime() - 14 * 864e5));
  const monthPrefix = today.slice(0, 7);

  type MemberRow = { name: string; phone: string | null; membershipEnd: string };
  type LeadRow = { status: string; channelId: number | null };
  type RevenueRow = { subType: string; paidAmount: number; unpaidAmount: number; customerName: string | null; phone: string | null; paymentDate: string };
  type ChannelRow = { id: number; name: string };

  const [mCountRows, mActiveRows, expiring, expired, leadsRows, revRows, channelRows] = (await Promise.all([
    sql.query(`SELECT COUNT(*) c FROM members`),
    sql.query(`SELECT COUNT(*) c FROM members WHERE status = 'active'`),
    sql.query(
      `SELECT name, phone, "membershipEnd" FROM members
       WHERE "membershipEnd" IS NOT NULL AND "membershipEnd" >= $1 AND "membershipEnd" <= $2
       ORDER BY "membershipEnd" ASC LIMIT 30`,
      [today, in30]
    ),
    sql.query(
      `SELECT name, phone, "membershipEnd" FROM members
       WHERE "membershipEnd" IS NOT NULL AND "membershipEnd" >= $1 AND "membershipEnd" < $2
       ORDER BY "membershipEnd" DESC LIMIT 30`,
      [ago14, today]
    ),
    sql.query(`SELECT status, "channelId" FROM leads`),
    sql.query(`SELECT "subType", "paidAmount", "unpaidAmount", "customerName", phone, "paymentDate" FROM revenue_entries`),
    sql.query(`SELECT id, name FROM channels`),
  ])) as [{ c: string }[], { c: string }[], MemberRow[], MemberRow[], LeadRow[], RevenueRow[], ChannelRow[]];

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

  return {
    source: "db",
    asOf: today,
    members: {
      total: Number(mCountRows[0]?.c ?? 0),
      active: Number(mActiveRows[0]?.c ?? 0),
      expiringSoon: expiring,
      recentlyExpired: expired,
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
      monthRevenue: monthRev.reduce((s, r) => s + Number(r.paidAmount || 0), 0),
      reRegisterCount: monthRev.filter((r) => r.subType === "재등록").length,
      newCount: monthRev.filter((r) => r.subType === "신규").length,
      unpaidTotal: unpaidRows.reduce((s, r) => s + Number(r.unpaidAmount || 0), 0),
      unpaidMembers: unpaidRows
        .map((r) => ({ name: r.customerName ?? "이름없음", phone: r.phone, unpaid: Number(r.unpaidAmount) }))
        .sort((a, b) => b.unpaid - a.unpaid)
        .slice(0, 20),
    },
    channels: channelStats,
  };
}
