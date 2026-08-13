// 13시 자동 문자 발송 — 헬스권 만료 D-10/D-5 안내, 관리상담(전날 상담) D+1 후속 안내.
// 문구·대상·중복방지 규칙은 노션 협의실에서 대표가 2026-08-11 확정한 스펙을 그대로 따른다.
// 클라우드 예약실행에서도 동작해야 해서 pg Pool이 아니라 neon() HTTP 방식을 쓴다(다른 잡들과 동일).
import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import { sendSms } from "./aligo";

type Category = "expiry_d10" | "expiry_d5" | "consult_followup";

const BRANCH_NAMES: Record<number, string> = { 1: "1호점", 2: "2호점" };
const GYM_PLUS_URL = "https://ziantgym.com/gym-plus";

export interface AutoMessageResult {
  ok: boolean;
  error?: string;
  summary?: {
    category: Category;
    targeted: number;
    sent: number;
    failed: number;
    skippedInvalidPhone: number;
  }[];
  details?: { category: Category; name: string | null; phone: string | null; result: "sent" | "failed" | "skipped"; error?: string }[];
}

function todayStr(): string {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00+09:00`);
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
}

function formatKoreanDate(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return `${y}년 ${m}월 ${d}일`;
}

function branchGreeting(branchId: number | null): string {
  const name = branchId != null ? BRANCH_NAMES[branchId] : null;
  return name ? `자이언트짐 ${name}입니다` : `자이언트짐입니다`;
}

// 알리고 발송 가능한 한국 휴대폰 번호인지 확인 (연락처 누락·형식 오류는 발송하지 않고 기록만 남긴다).
function normalizePhone(phone: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/[^0-9]/g, "");
  return /^01[016789]\d{7,8}$/.test(digits) ? digits : null;
}

async function ensureLogTable(sql: NeonQueryFunction<false, false>) {
  await sql.query(`
    CREATE TABLE IF NOT EXISTS auto_message_log (
      id SERIAL PRIMARY KEY,
      category TEXT NOT NULL,
      member_id INTEGER,
      lead_id INTEGER,
      reference_date TEXT NOT NULL,
      name TEXT,
      phone TEXT,
      branch_id INTEGER,
      sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      success BOOLEAN NOT NULL,
      error TEXT
    )
  `);
}

async function alreadySent(
  sql: NeonQueryFunction<false, false>,
  category: Category,
  idCol: "member_id" | "lead_id",
  id: number,
  referenceDate: string
): Promise<boolean> {
  const rows = (await sql.query(
    `SELECT 1 FROM auto_message_log WHERE category = $1 AND ${idCol} = $2 AND reference_date = $3 AND success = true LIMIT 1`,
    [category, id, referenceDate]
  )) as unknown[];
  return rows.length > 0;
}

async function logAttempt(
  sql: NeonQueryFunction<false, false>,
  row: {
    category: Category;
    memberId?: number | null;
    leadId?: number | null;
    referenceDate: string;
    name: string | null;
    phone: string | null;
    branchId: number | null;
    success: boolean;
    error?: string;
  }
) {
  await sql.query(
    `INSERT INTO auto_message_log (category, member_id, lead_id, reference_date, name, phone, branch_id, success, error)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      row.category,
      row.memberId ?? null,
      row.leadId ?? null,
      row.referenceDate,
      row.name,
      row.phone,
      row.branchId,
      row.success,
      row.error ?? null,
    ]
  );
}

type MemberRow = { id: number; name: string; phone: string | null; branchId: number | null; membershipEnd: string };

// D-10 / D-5 만료 대상: 활성회원 + 정확히 해당 D일 만료 + 환불·양도 진행 이력 없는 회원.
// "재등록해서 만료일이 밀린 회원"은 오늘 시점 membershipEnd가 더 이상 이 날짜와 일치하지 않으므로
// 매일 13시에 다시 조회하는 것만으로 자연히 제외된다(별도 재등록 여부 추적 불필요).
async function findExpiryCandidates(sql: NeonQueryFunction<false, false>, targetDate: string): Promise<MemberRow[]> {
  return (await sql.query(
    `SELECT m.id, m.name, m.phone, m."branchId" AS "branchId", m."membershipEnd" AS "membershipEnd"
     FROM members m
     WHERE m.status = 'active'
       AND m."membershipEnd" = $1
       AND NOT EXISTS (
         SELECT 1 FROM refund_contracts r WHERE r."memberId" = m.id AND r.status IN ('completed', 'pending')
       )
       AND NOT EXISTS (
         SELECT 1 FROM transfer_contracts t
         WHERE t."transferorMemberId" = m.id OR t."transfereeMemberId" = m.id
       )`,
    [targetDate]
  )) as MemberRow[];
}

type LeadRow = { id: number; name: string | null; phone: string | null; branchId: number | null };

// 관리상담 D+1: 어제 상담완료(consulted) 상태로 남아있고 아직 등록하지 않은 리드.
// status='registered'/'dropped'는 쿼리에서 자동 제외(= 이미 등록했거나 상담 취소된 건 제외).
async function findConsultFollowupCandidates(sql: NeonQueryFunction<false, false>, consultDate: string): Promise<LeadRow[]> {
  return (await sql.query(
    `SELECT id, name, phone, "branchId" AS "branchId"
     FROM leads
     WHERE status = 'consulted' AND "consultationDate" = $1`,
    [consultDate]
  )) as LeadRow[];
}

function expiryD10Message(name: string, branchId: number | null, endDate: string): string {
  return `안녕하세요, ${branchGreeting(branchId)}.

${name} 회원님의 헬스 이용권이 ${formatKoreanDate(endDate)}에 종료될 예정입니다.

현재 재등록 시 등록 조건에 따라 1주부터 최대 1개월까지 추가 이용 혜택을 받으실 수 있습니다. 계속 이용을 원하시거나 회원권 관련 궁금한 점이 있으시면 편하게 답장해 주세요.

운동영상, 운동기록, 맞춤식단 및 이벤트 안내는 자이언트짐+ 회원전용 앱에서도 확인하실 수 있습니다.

${GYM_PLUS_URL}

감사합니다.`;
}

function expiryD5Message(name: string, branchId: number | null, endDate: string): string {
  return `안녕하세요, ${branchGreeting(branchId)}.

${name} 회원님의 헬스 이용권이 ${formatKoreanDate(endDate)}에 종료될 예정으로 다시 한번 안내드립니다.

계속 이용하실 예정이라면 등록 조건에 따라 1주부터 최대 1개월까지 추가 이용 혜택을 받으실 수 있습니다. 재등록을 원하시거나 이용 일정 조정이 필요하시면 편하게 답장해 주세요.

자이언트짐+ 회원전용 앱
${GYM_PLUS_URL}

감사합니다.`;
}

function consultFollowupMessage(name: string | null, branchId: number | null): string {
  const greeting = `안녕하세요, ${branchGreeting(branchId)}.`;
  if (name) {
    return `${greeting}

어제 상담 도와드렸던 ${name}님께 안내드립니다. 상담받으신 프로그램이나 이용 방법과 관련해 추가로 궁금한 점이 있으시면 편하게 답장해 주세요.

등록을 원하시는 경우에도 희망하시는 시작일이나 방문 가능 시간을 남겨주시면 확인 후 안내해 드리겠습니다.

감사합니다.`;
  }
  return `${greeting}

어제 상담받으신 내용과 관련해 안내드립니다. 프로그램이나 이용 방법에 대해 추가로 궁금한 점이 있으시면 편하게 답장해 주세요.

등록을 원하시는 경우 희망하시는 시작일이나 방문 가능 시간을 남겨주시면 확인 후 안내해 드리겠습니다.

감사합니다.`;
}

export async function runAutoMessageJob(): Promise<AutoMessageResult> {
  const url = process.env.DATABASE_URL;
  if (!url) return { ok: false, error: "DATABASE_URL이 설정되어 있지 않습니다." };
  const sql = neon(url);
  await ensureLogTable(sql);

  const today = todayStr();
  const d10Target = addDays(today, 10);
  const d5Target = addDays(today, 5);
  const yesterday = addDays(today, -1);

  const summary: AutoMessageResult["summary"] = [];
  const details: AutoMessageResult["details"] = [];

  // --- 헬스권 만료 D-10 / D-5 ---
  for (const [category, targetDate, buildMessage] of [
    ["expiry_d10", d10Target, expiryD10Message],
    ["expiry_d5", d5Target, expiryD5Message],
  ] as const) {
    const candidates = await findExpiryCandidates(sql, targetDate);
    let sent = 0;
    let failed = 0;
    let skippedInvalidPhone = 0;

    for (const m of candidates) {
      if (await alreadySent(sql, category, "member_id", m.id, targetDate)) continue;

      const phone = normalizePhone(m.phone);
      if (!phone) {
        skippedInvalidPhone++;
        await logAttempt(sql, {
          category,
          memberId: m.id,
          referenceDate: targetDate,
          name: m.name,
          phone: m.phone,
          branchId: m.branchId,
          success: false,
          error: "연락처 누락·확인 필요",
        });
        details.push({ category, name: m.name, phone: m.phone, result: "skipped", error: "연락처 누락·확인 필요" });
        continue;
      }

      const message = buildMessage(m.name, m.branchId, targetDate);
      const result = await sendSms(phone, message);
      if (result.ok) sent++;
      else failed++;
      await logAttempt(sql, {
        category,
        memberId: m.id,
        referenceDate: targetDate,
        name: m.name,
        phone,
        branchId: m.branchId,
        success: result.ok,
        error: result.error,
      });
      details.push({ category, name: m.name, phone, result: result.ok ? "sent" : "failed", error: result.error });
    }

    summary.push({ category, targeted: candidates.length, sent, failed, skippedInvalidPhone });
  }

  // --- 관리상담 D+1 후속 안내 ---
  {
    const category: Category = "consult_followup";
    const candidates = await findConsultFollowupCandidates(sql, yesterday);
    let sent = 0;
    let failed = 0;
    let skippedInvalidPhone = 0;

    for (const l of candidates) {
      if (await alreadySent(sql, category, "lead_id", l.id, yesterday)) continue;

      const phone = normalizePhone(l.phone);
      if (!phone) {
        skippedInvalidPhone++;
        await logAttempt(sql, {
          category,
          leadId: l.id,
          referenceDate: yesterday,
          name: l.name,
          phone: l.phone,
          branchId: l.branchId,
          success: false,
          error: "연락처 누락·확인 필요",
        });
        details.push({ category, name: l.name, phone: l.phone, result: "skipped", error: "연락처 누락·확인 필요" });
        continue;
      }

      const message = consultFollowupMessage(l.name, l.branchId);
      const result = await sendSms(phone, message);
      if (result.ok) sent++;
      else failed++;
      await logAttempt(sql, {
        category,
        leadId: l.id,
        referenceDate: yesterday,
        name: l.name,
        phone,
        branchId: l.branchId,
        success: result.ok,
        error: result.error,
      });
      details.push({ category, name: l.name, phone, result: result.ok ? "sent" : "failed", error: result.error });
    }

    summary.push({ category, targeted: candidates.length, sent, failed, skippedInvalidPhone });
  }

  return { ok: true, summary, details };
}
