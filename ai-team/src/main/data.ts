// 데이터 수집: ZIANTGYM+ DB(Neon/Postgres)에서 총괄 AI가 분석할 지표를 모은다.
// DATABASE_URL 이 없으면 샘플 데이터로 동작해 앱이 항상 켜지게 한다.
import { Pool } from "pg";

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
  };
}

export async function gatherContext(): Promise<GymContext> {
  const url = process.env.DATABASE_URL;
  if (!url) return sampleContext();

  const pool = new Pool({
    connectionString: url,
    ssl: url.includes("localhost") ? false : { rejectUnauthorized: false },
  });

  try {
    const now = new Date();
    const today = ymd(now);
    const in30 = ymd(new Date(now.getTime() + 30 * 864e5));
    const ago14 = ymd(new Date(now.getTime() - 14 * 864e5));
    const monthPrefix = today.slice(0, 7);

    const [mCount, mActive, expiring, expired, leadsRows, revRows] = await Promise.all([
      pool.query<{ c: string }>(`SELECT COUNT(*) c FROM members`),
      pool.query<{ c: string }>(`SELECT COUNT(*) c FROM members WHERE status = 'active'`),
      pool.query<{ name: string; phone: string | null; membershipEnd: string }>(
        `SELECT name, phone, "membershipEnd" FROM members
         WHERE "membershipEnd" IS NOT NULL AND "membershipEnd" >= $1 AND "membershipEnd" <= $2
         ORDER BY "membershipEnd" ASC LIMIT 30`,
        [today, in30]
      ),
      pool.query<{ name: string; phone: string | null; membershipEnd: string }>(
        `SELECT name, phone, "membershipEnd" FROM members
         WHERE "membershipEnd" IS NOT NULL AND "membershipEnd" >= $1 AND "membershipEnd" < $2
         ORDER BY "membershipEnd" DESC LIMIT 30`,
        [ago14, today]
      ),
      pool.query<{ status: string }>(`SELECT status FROM leads`),
      pool.query<{ subType: string; paidAmount: number; unpaidAmount: number; customerName: string | null; phone: string | null; paymentDate: string }>(
        `SELECT "subType", "paidAmount", "unpaidAmount", "customerName", phone, "paymentDate" FROM revenue_entries`
      ),
    ]);

    const statusCount = (s: string) => leadsRows.rows.filter((r) => r.status === s).length;
    const pending = statusCount("pending");
    const consulted = statusCount("consulted");
    const registered = statusCount("registered");
    const dropped = statusCount("dropped");
    const totalLeads = leadsRows.rows.length || 1;

    const monthRev = revRows.rows.filter((r) => (r.paymentDate || "").startsWith(monthPrefix));
    const unpaidRows = revRows.rows.filter((r) => Number(r.unpaidAmount) > 0);

    return {
      source: "db",
      asOf: today,
      members: {
        total: Number(mCount.rows[0]?.c ?? 0),
        active: Number(mActive.rows[0]?.c ?? 0),
        expiringSoon: expiring.rows,
        recentlyExpired: expired.rows,
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
    };
  } finally {
    await pool.end();
  }
}
