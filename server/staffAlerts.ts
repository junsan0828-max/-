// 직원 알림 (키오스크 직원 호출 · 상담 접수 → 운영시스템 직원 웹푸시)
//
// 구조 (A안, 2026-11-04 대표 승인):
//  - 키오스크(자이언트짐++ ziantgym.com)는 아래 공개 API만 호출한다. 수신자·카드 생성 규칙은 통합운영이 정한다.
//      POST /api/kiosk/staff-call   { branchNo: 1|2, message? }
//      POST /api/kiosk/consult      { branchNo, consultType: "new"|"renew"|"pt", name?, phone, purpose?, kioskRequestId? }
//  - 직원은 운영시스템에 로그인한 기기에서 "알림 받기"로 구독한다 (ops_push_subscriptions, 이 서버 VAPID 키).
//  - 수신자 = 역할 기준: 관리자·부관리자·FC 전원 + 해당 지점 소속 트레이너.
//  - 호출 기록은 staff_call_log(자이언트짐++와 공유, createdAt은 KST 시각 문자열 관례)에 남기고
//    운영시스템 화면 상단 배너에서 "확인" 처리한다.
import express from "express";
import webpush from "web-push";
import { initTRPC, TRPCError } from "@trpc/server";
import { z } from "zod";
import { pool } from "./db";
import type { AuthUser } from "./auth";
import type { Request } from "express";

// 웹푸시 VAPID 키. 예전 하드코딩 키는 P-256 곡선 위의 점이 아니라 FCM이 전부 403으로 거부했다(2026-11-04 발견).
// 환경변수(OPS_VAPID_PUBLIC_KEY / OPS_VAPID_PRIVATE_KEY)가 있으면 우선. 바꾸면 기존 구독은 모두 다시 받아야 한다.
export const VAPID_PUBLIC = process.env.OPS_VAPID_PUBLIC_KEY || "BL5SUgn_dXfHLEX3bIh7mnv9FwV5u-A8jkAvH8rLEWABwkTS8K_On6ziKorm8IdR571epMIuT1R1UpKK3ehhK-A";
export const VAPID_PRIVATE = process.env.OPS_VAPID_PRIVATE_KEY || "YBgwoKIvKQPhjvbrAur6b3bOAoAs6oC3I4k_T2YcDmA";
const VAPID = { subject: "mailto:admin@ziantgym.com", publicKey: VAPID_PUBLIC, privateKey: VAPID_PRIVATE };

const BRANCH_LABEL: Record<number, string> = { 1: "1호점", 2: "2호점" };
const CONSULT_LABEL: Record<string, string> = { new: "신규 상담", renew: "재등록 상담", pt: "PT 상담", callback: "연락 요청" };
const STAFF_ROLES = ["admin", "sub_admin", "consultant", "trainer"];

// staff_call_log 관례(자이언트짐++와 동일): KST 시각을 ISO 문자열로 저장
const kstIso = (offsetMs = 0) => new Date(Date.now() + 9 * 3600_000 + offsetMs).toISOString();
const branchPrefix = (b?: number | null) => (b && BRANCH_LABEL[b] ? `[${BRANCH_LABEL[b]}] ` : "");
const fmtPhone = (d: string) => (d.length === 11 ? `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}` : d);

export const STAFF_ALERT_MIGRATIONS = [
  `CREATE TABLE IF NOT EXISTS ops_push_subscriptions (
    id SERIAL PRIMARY KEY,
    "userId" INTEGER NOT NULL,
    endpoint TEXT NOT NULL UNIQUE,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    "userAgent" TEXT,
    "createdAt" TEXT NOT NULL DEFAULT now()::text
  )`,
  // 자이언트짐++가 만든 테이블이지만, 이 서버가 먼저 떠도 동작하도록 동일 정의로 보장
  `CREATE TABLE IF NOT EXISTS staff_call_log (
    id SERIAL PRIMARY KEY,
    message TEXT NOT NULL DEFAULT '직원 호출',
    status TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TEXT NOT NULL DEFAULT now()::text,
    "acknowledgedAt" TEXT
  )`,
  `ALTER TABLE staff_call_log ADD COLUMN IF NOT EXISTS "branchNo" INTEGER`,
  `ALTER TABLE staff_call_log ADD COLUMN IF NOT EXISTS "acknowledgedBy" INTEGER`,
  // 푸시 발송 표시 (API·폴러 중 먼저 잡은 쪽만 보낸다 → 중복 알림 방지)
  `ALTER TABLE staff_call_log ADD COLUMN IF NOT EXISTS "opsNotifiedAt" TEXT`,
  `ALTER TABLE staff_call_log ADD COLUMN IF NOT EXISTS "renotifyCount" INTEGER NOT NULL DEFAULT 0`,
  `CREATE TABLE IF NOT EXISTS kiosk_consult_requests (
    id SERIAL PRIMARY KEY, "consultType" TEXT NOT NULL, name TEXT, phone TEXT NOT NULL, purpose TEXT,
    status TEXT NOT NULL DEFAULT 'pending', "staffNote" TEXT, "createdAt" TEXT NOT NULL DEFAULT now()::text, "processedAt" TEXT
  )`,
  `ALTER TABLE kiosk_consult_requests ADD COLUMN IF NOT EXISTS "branchNo" INTEGER`,
  `ALTER TABLE kiosk_consult_requests ADD COLUMN IF NOT EXISTS "opsHandledAt" TEXT`,
  // 직원별 알림 설정 (관리자 설정 > 키오스크 알림). 행이 없으면 기본값(역할 기준·항상)
  `CREATE TABLE IF NOT EXISTS staff_alert_prefs (
    "userId" INTEGER PRIMARY KEY,
    enabled INTEGER NOT NULL DEFAULT 1,
    "staffCall" INTEGER NOT NULL DEFAULT 1,
    consult INTEGER NOT NULL DEFAULT 1,
    branches TEXT,
    schedule TEXT,
    "updatedAt" TEXT NOT NULL DEFAULT now()::text
  )`,
];

type PushPayload = { title: string; body: string; url: string; tag?: string; requireInteraction?: boolean };

export type AlertKind = "staffCall" | "consult" | "test";
/** 요일별 근무시간. 0=월 … 6=일. null이면 항상 받음 */
export type DaySchedule = { on: boolean; start: string; end: string };

type PrefRow = {
  userId: number; username: string; role: string; trainerName: string | null; trainerBranches: number[];
  enabled: boolean; staffCall: boolean; consult: boolean; branches: number[] | null; schedule: DaySchedule[] | null; hasPref: boolean;
};

async function loadPrefs(): Promise<PrefRow[]> {
  const r = await pool.query(
    `SELECT u.id, u.username, u.role, t."trainerName",
            ARRAY_REMOVE(ARRAY(SELECT tb."branchId" FROM trainer_branches tb WHERE tb."trainerId" = t.id) || t."branchId", NULL) AS tb,
            p."userId" AS "prefUser", p.enabled, p."staffCall", p.consult, p.branches, p.schedule
       FROM users u
       LEFT JOIN trainers t ON t."userId" = u.id
       LEFT JOIN staff_alert_prefs p ON p."userId" = u.id
      WHERE u.role IN ('admin', 'sub_admin', 'consultant', 'trainer')
      ORDER BY CASE u.role WHEN 'admin' THEN 0 WHEN 'sub_admin' THEN 1 WHEN 'consultant' THEN 2 ELSE 3 END, u.username`);
  const parse = <T,>(v: string | null): T | null => { if (!v) return null; try { return JSON.parse(v) as T; } catch { return null; } };
  return r.rows.map((x: any) => ({
    userId: x.id, username: x.username, role: x.role, trainerName: x.trainerName,
    trainerBranches: [...new Set<number>((x.tb ?? []).map(Number))],
    hasPref: x.prefUser != null,
    enabled: x.prefUser == null ? true : x.enabled === 1,
    staffCall: x.prefUser == null ? true : x.staffCall === 1,
    consult: x.prefUser == null ? true : x.consult === 1,
    branches: parse<number[]>(x.branches),
    schedule: parse<DaySchedule[]>(x.schedule),
  }));
}

/** 받을 지점: 직접 지정했으면 그것, 아니면 역할 기준(트레이너=소속 지점, 그 외=전 지점) */
function effectiveBranches(p: PrefRow): number[] | null {
  if (p.branches && p.branches.length) return p.branches;
  if (p.role === "trainer") return p.trainerBranches.length ? p.trainerBranches : [];
  return null; // 전 지점
}

/** KST 지금이 근무시간인가 (자정 넘는 시간대 지원: 22:00~02:00) */
export function onDutyNow(schedule: DaySchedule[] | null, now = new Date()): boolean {
  if (!schedule || schedule.length !== 7) return true;
  const k = new Date(now.getTime() + 9 * 3600_000);
  const dow = (k.getUTCDay() + 6) % 7;
  const hm = `${String(k.getUTCHours()).padStart(2, "0")}:${String(k.getUTCMinutes()).padStart(2, "0")}`;
  const today = schedule[dow];
  if (today?.on) {
    if (today.start <= today.end ? (hm >= today.start && hm < today.end) : hm >= today.start) return true;
  }
  const yest = schedule[(dow + 6) % 7]; // 어제 시작해 자정을 넘긴 근무
  return !!(yest?.on && yest.start > yest.end && hm < yest.end);
}

function receives(p: PrefRow, kind: AlertKind, branchNo: number | null): boolean {
  if (kind === "test") return true;
  if (!p.enabled || !p[kind]) return false;
  const br = effectiveBranches(p);
  if (branchNo != null && br !== null && !br.includes(branchNo)) return false;
  return onDutyNow(p.schedule);
}

/** 설정(켜짐·종류·지점·근무시간)에 맞는 수신자에게 푸시. userIds를 주면 그 사람에게만(테스트용). 보낸 기기 수를 돌려준다. */
export async function sendStaffPush(branchNo: number | null, payload: PushPayload, userIds?: number[], kind: AlertKind = "staffCall"): Promise<number> {
  const targets = userIds ?? (await loadPrefs()).filter(p => receives(p, kind, branchNo)).map(p => p.userId);
  if (!targets.length) return 0;
  const subs = await pool.query(`SELECT endpoint, p256dh, auth FROM ops_push_subscriptions WHERE "userId" = ANY($1)`, [targets]);
  const body = JSON.stringify(payload);
  let sent = 0;
  await Promise.all(subs.rows.map(async (s: any) => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, body, { vapidDetails: VAPID, TTL: 600 });
      sent++;
    } catch (e: any) {
      // 만료·해지된 구독만 정리 (그 외 오류는 일시적일 수 있으니 남긴다)
      if (e?.statusCode === 410 || e?.statusCode === 404) {
        await pool.query(`DELETE FROM ops_push_subscriptions WHERE endpoint = $1`, [s.endpoint]).catch(() => {});
      } else {
        console.error("[staff push]", e?.statusCode, e?.body ?? e?.message);
      }
    }
  }));
  return sent;
}

/** 직원 호출 푸시 — 먼저 표시를 잡은 쪽만 보낸다(API·폴러 중복 방지, 멱등) */
async function notifyStaffCall(callId: number, branchNo: number | null): Promise<number> {
  const claim = await pool.query(
    `UPDATE staff_call_log SET "opsNotifiedAt" = $1 WHERE id = $2 AND "opsNotifiedAt" IS NULL RETURNING id`, [kstIso(), callId]);
  if (claim.rowCount === 0) return 0;
  return sendStaffPush(branchNo, {
    title: `🔔 ${branchPrefix(branchNo)}직원 호출`, body: "키오스크 앞에서 회원님이 기다리고 있어요.",
    url: "/", tag: `staff-call-${callId}`, requireInteraction: true,
  }, undefined, "staffCall");
}

type ConsultInput = { branchNo?: unknown; consultType?: any; phone?: unknown; name?: unknown; purpose?: unknown; kioskRequestId?: unknown };

/** 키오스크 상담 접수 처리: (신규면) 상담 CRM 카드 + 직원 푸시. kioskRequestId가 있으면 그 요청은 한 번만 처리한다. */
async function handleConsult(b: ConsultInput): Promise<{ error: string } | { leadId: number | null; leadCreated: boolean; memberId: number | null; sent: number; already?: boolean }> {
  const reqId = Number(b.kioskRequestId) || null;
  if (reqId) {
    const claim = await pool.query(
      `UPDATE kiosk_consult_requests SET "opsHandledAt" = $1 WHERE id = $2 AND "opsHandledAt" IS NULL RETURNING id`, [kstIso(), reqId]);
    if (claim.rowCount === 0) {
      const exists = await pool.query(`SELECT 1 FROM kiosk_consult_requests WHERE id = $1`, [reqId]);
      if (exists.rowCount) return { leadId: null, leadCreated: false, memberId: null, sent: 0, already: true };
    }
  }
  const branchNo = parseBranch(b.branchNo);
  // callback = 직원 호출 후 아무도 안 와서 연락처를 남긴 경우 (2026-11-09)
  const consultType = ["new", "renew", "pt", "callback"].includes(b.consultType) ? b.consultType as string : "new";
  const digits = String(b.phone ?? "").replace(/\D/g, "");
  if (digits.length < 9) return { error: "연락처를 확인해 주세요." };
  const name = String(b.name ?? "").trim().slice(0, 50) || null;
  const purpose = String(b.purpose ?? "").trim().slice(0, 200) || null;
  const label = CONSULT_LABEL[consultType];
  const now = new Date().toISOString();

  // 기존 회원 여부 (재등록 상담·기존회원 PT 상담 대비)
  const m = await pool.query(
    `SELECT m.id, m.name, t."trainerName" FROM members m LEFT JOIN trainers t ON t.id = m."trainerId"
      WHERE REGEXP_REPLACE(COALESCE(m.phone, ''), '[^0-9]', '', 'g') = $1
      ORDER BY m."membershipEnd" DESC NULLS LAST LIMIT 1`, [digits]);
  const member = m.rows[0] as { id: number; name: string; trainerName: string | null } | undefined;

  // 상담 CRM 카드: 기존 회원이 아니면 생성. 같은 번호 카드가 30일 안에 있으면 새로 만들지 않는다(중복 방지는 생성 시점에서).
  let leadId: number | null = null;
  let leadCreated = false;
  if (!member) {
    const dup = await pool.query(
      `SELECT id FROM leads WHERE REGEXP_REPLACE(COALESCE(phone, ''), '[^0-9]', '', 'g') = $1 AND "createdAt" >= $2 ORDER BY id DESC LIMIT 1`,
      [digits, new Date(Date.now() - 30 * 86400_000).toISOString()]);
    if (dup.rows[0]) {
      leadId = dup.rows[0].id;
    } else {
      const memo = [`[키오스크 ${BRANCH_LABEL[branchNo ?? 0] ?? ""} ${label}]`, b.kioskRequestId ? `#${b.kioskRequestId}` : ""].join(" ").trim();
      const ins = await pool.query(
        `INSERT INTO leads (name, phone, "branchId", status, "consultationType", "consultationSubTypes", "interestType", "exercisePurpose", memo, "createdAt", "updatedAt")
         VALUES ($1, $2, $3, 'pending', '키오스크', $4, $5, $6, $7, $8, $8) RETURNING id`,
        [name ?? "키오스크 방문", fmtPhone(digits), branchNo, label.replace(" ", ""), consultType === "pt" ? "PT" : null, purpose, memo, now]);
      leadId = ins.rows[0].id;
      leadCreated = true;
    }
  }

  const who = member ? `${member.name} 회원${member.trainerName ? ` (담당 ${member.trainerName})` : ""}` : (name ?? "방문객");
  const isCallback = consultType === "callback";
  const sent = await sendStaffPush(branchNo, isCallback ? {
    // 직원 호출에 아무도 못 간 상황 → 호출 받는 직원에게, 확인할 때까지 남는 알림으로
    title: `📞 ${branchPrefix(branchNo)}연락 요청 — 직원 호출 후 미응대`,
    body: [who, fmtPhone(digits), purpose].filter(Boolean).join(" · ") + " · 바로 전화 주세요",
    url: member ? `/members/${member.id}` : "/leads",
    tag: `callback-${digits}`, requireInteraction: true,
  } : {
    title: `📝 ${branchPrefix(branchNo)}${label} 접수`,
    body: [who, fmtPhone(digits), purpose].filter(Boolean).join(" · "),
    url: member ? `/members/${member.id}` : "/leads",
    tag: `consult-${digits}`,
  }, undefined, isCallback ? "staffCall" : "consult");
  return { leadId, leadCreated, memberId: member?.id ?? null, sent };
}

/**
 * 자이언트짐++가 아직 API를 부르지 않고 공유 테이블에 직접 쓰는 경우를 위한 수거기.
 * 최근 5분 안에 생긴, 아직 처리 표시가 없는 호출·상담만 처리한다 → 재시작해도 옛 건을 다시 보내지 않는다(멱등).
 */
const RENOTIFY_EVERY_MS = 60_000;
const RENOTIFY_MAX = 3;

export function startKioskPoller() {
  const tick = async () => {
    try {
      const since = kstIso(-5 * 60_000);
      const calls = await pool.query(
        `SELECT id, "branchNo" FROM staff_call_log WHERE "opsNotifiedAt" IS NULL AND status = 'pending' AND "createdAt" >= $1 ORDER BY id`, [since]);
      for (const c of calls.rows) await notifyStaffCall(c.id, c.branchNo ?? null);

      // 아무도 [제가 갈게요]를 안 누르면 1분마다 다시 울린다 (최대 3번). 휴대폰 '알림 반복' 설정과 무관하게 동작.
      const due = await pool.query(
        `SELECT id, "branchNo", "renotifyCount", "opsNotifiedAt" FROM staff_call_log
          WHERE status = 'pending' AND "opsNotifiedAt" IS NOT NULL AND "renotifyCount" < $1
            AND "opsNotifiedAt" <= $2 AND "createdAt" >= $3 ORDER BY id`,
        [RENOTIFY_MAX, kstIso(-RENOTIFY_EVERY_MS), kstIso(-10 * 60_000)]);
      for (const c of due.rows) {
        const claim = await pool.query(
          `UPDATE staff_call_log SET "opsNotifiedAt" = $1, "renotifyCount" = "renotifyCount" + 1
            WHERE id = $2 AND status = 'pending' AND "opsNotifiedAt" = $3 RETURNING "renotifyCount"`,
          [kstIso(), c.id, c.opsNotifiedAt]);
        if (!claim.rowCount) continue;
        const n = claim.rows[0].renotifyCount;
        await sendStaffPush(c.branchNo ?? null, {
          title: `🔔 ${branchPrefix(c.branchNo)}직원 호출 (다시 알림 ${n})`, body: "아직 아무도 확인하지 않았어요. 키오스크로 가 주세요.",
          url: "/", tag: `staff-call-${c.id}-r${n}`, requireInteraction: true,
        }, undefined, "staffCall");
      }
      const reqs = await pool.query(
        `SELECT id, "consultType", name, phone, purpose, "branchNo" FROM kiosk_consult_requests
          WHERE "opsHandledAt" IS NULL AND "createdAt" >= $1 ORDER BY id`, [since]);
      for (const r of reqs.rows) {
        await handleConsult({ branchNo: r.branchNo, consultType: r.consultType, phone: r.phone, name: r.name, purpose: r.purpose, kioskRequestId: r.id });
      }
    } catch (e) {
      console.error("[kiosk poller]", (e as Error).message);
    }
  };
  // DB가 쉴 수 있게(Neon 절전) 새벽 1~5시(KST)엔 돌지 않고, 그 외엔 15초마다 (2026-11-06)
  setInterval(() => {
    const h = new Date(Date.now() + 9 * 3600_000).getUTCHours();
    if (h >= 1 && h < 5) return;
    tick();
  }, 15_000);
}

// ─── 공개 API (키오스크 → 통합운영) ─────────────────────────────────────────────
const hits = new Map<string, number[]>();
function rateLimited(ip: string, max = 20, windowMs = 60_000) {
  const now = Date.now();
  const arr = (hits.get(ip) ?? []).filter(t => now - t < windowMs);
  arr.push(now);
  hits.set(ip, arr);
  return arr.length > max;
}
function checkKey(req: express.Request) {
  const key = process.env.KIOSK_API_KEY;
  return !key || req.get("x-kiosk-key") === key;
}
const parseBranch = (v: unknown) => (Number(v) === 1 || Number(v) === 2 ? Number(v) : null);

export function registerKioskRoutes(app: express.Express) {
  app.get("/api/kiosk/ping", (_req, res) => res.json({ status: "ok", version: "staff-alerts-v1" }));

  app.post("/api/kiosk/staff-call", async (req, res) => {
    if (!checkKey(req)) return res.status(401).json({ error: "unauthorized" });
    if (rateLimited(req.ip ?? "?")) return res.status(429).json({ error: "too many requests" });
    try {
      const branchNo = parseBranch(req.body?.branchNo);
      const message = branchPrefix(branchNo) + String(req.body?.message || "키오스크에서 직원을 호출했습니다.").slice(0, 200);
      // 같은 지점에서 1분 안에 연달아 누르면 새 호출을 만들지 않는다 (알림 폭주 방지)
      const recent = await pool.query(
        `SELECT id FROM staff_call_log WHERE status = 'pending' AND "branchNo" IS NOT DISTINCT FROM $1 AND "createdAt" >= $2 ORDER BY id DESC LIMIT 1`,
        [branchNo, kstIso(-60_000)]);
      if (recent.rows[0]) return res.json({ ok: true, callId: recent.rows[0].id, deduped: true });
      const ins = await pool.query(
        `INSERT INTO staff_call_log (message, status, "createdAt", "branchNo") VALUES ($1, 'pending', $2, $3) RETURNING id`,
        [message, kstIso(), branchNo]);
      const callId = ins.rows[0].id;
      const sent = await notifyStaffCall(callId, branchNo);
      return res.json({ ok: true, callId, sent });
    } catch (e) {
      console.error("/api/kiosk/staff-call", e);
      return res.status(500).json({ error: "서버 오류" });
    }
  });

  app.post("/api/kiosk/consult", async (req, res) => {
    if (!checkKey(req)) return res.status(401).json({ error: "unauthorized" });
    if (rateLimited(req.ip ?? "?")) return res.status(429).json({ error: "too many requests" });
    try {
      const r = await handleConsult(req.body ?? {});
      if ("error" in r) return res.status(400).json(r);
      return res.json({ ok: true, ...r });
    } catch (e) {
      console.error("/api/kiosk/consult", e);
      return res.status(500).json({ error: "서버 오류" });
    }
  });
}

// ─── 운영시스템 직원용 tRPC ─────────────────────────────────────────────────────
const t = initTRPC.context<{ user: AuthUser; req: Request }>().create();
const staffProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });
  if (!STAFF_ROLES.includes(ctx.user.role)) throw new TRPCError({ code: "FORBIDDEN" });
  return next({ ctx: { ...ctx, user: ctx.user } });
});

const adminProcedure = staffProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "관리자만 설정할 수 있습니다." });
  return next();
});

const TEST_DELAY_MS = 5000;
async function countDevices(userIds: number[]): Promise<number> {
  if (!userIds.length) return 0;
  const r = await pool.query(`SELECT COUNT(*)::int AS n FROM ops_push_subscriptions WHERE "userId" = ANY($1)`, [userIds]);
  return r.rows[0]?.n ?? 0;
}

async function myBranchIds(user: AuthUser): Promise<number[] | null> {
  if (user.role !== "trainer" || !user.trainerId) return null; // null = 전 지점
  const r = await pool.query(
    `SELECT "branchId" FROM trainer_branches WHERE "trainerId" = $1
     UNION SELECT "branchId" FROM trainers WHERE id = $1 AND "branchId" IS NOT NULL`, [user.trainerId]);
  const ids = r.rows.map((x: any) => Number(x.branchId));
  return ids.length ? ids : null;
}

export const staffAlertsRouter = t.router({
  vapidKey: staffProcedure.query(() => VAPID_PUBLIC),

  subscribe: staffProcedure
    .input(z.object({ endpoint: z.string().url(), p256dh: z.string(), auth: z.string(), userAgent: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      // 같은 기기를 다른 계정으로 로그인하면 마지막 로그인 계정으로 옮긴다
      await pool.query(
        `INSERT INTO ops_push_subscriptions ("userId", endpoint, p256dh, auth, "userAgent")
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (endpoint) DO UPDATE SET "userId" = $1, p256dh = $3, auth = $4, "userAgent" = $5`,
        [ctx.user.id, input.endpoint, input.p256dh, input.auth, input.userAgent?.slice(0, 300) ?? null]);
      return { ok: true };
    }),

  unsubscribe: staffProcedure
    .input(z.object({ endpoint: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await pool.query(`DELETE FROM ops_push_subscriptions WHERE endpoint = $1 AND "userId" = $2`, [input.endpoint, ctx.user.id]);
      return { ok: true };
    }),

  /** 내 알림 대상 여부 (관리자가 '알림 받기'를 켠 직원은 기기 알림 켜기가 필수) */
  myStatus: staffProcedure.query(async ({ ctx }) => {
    const p = (await loadPrefs()).find(x => x.userId === ctx.user.id);
    return { required: !!p?.enabled, onDuty: !!p && p.enabled && onDutyNow(p.schedule), scheduleSet: !!p?.schedule };
  }),

  test: staffProcedure.mutation(async ({ ctx }) => {
    // 5초 뒤 발송: 홈 화면으로 나가 있어야 알림창 소리를 제대로 확인할 수 있다(보고 있는 화면의 알림은 무음일 수 있음)
    const devices = await countDevices([ctx.user.id]);
    setTimeout(() => {
      sendStaffPush(null, { title: "✅ 알림 테스트", body: "이 기기에서 키오스크 호출·상담 알림을 받습니다.", url: "/", tag: `test-${Date.now()}` }, [ctx.user.id], "test").catch(() => {});
    }, TEST_DELAY_MS);
    return { sent: devices, delaySec: TEST_DELAY_MS / 1000 };
  }),

  // ─── 관리자 설정 > 키오스크 알림 ───
  adminList: adminProcedure.query(async () => {
    const prefs = await loadPrefs();
    const dev = await pool.query(`SELECT "userId", COUNT(*)::int AS n, MAX("createdAt") AS last FROM ops_push_subscriptions GROUP BY "userId"`);
    const devMap = new Map(dev.rows.map((d: any) => [Number(d.userId), d]));
    return prefs.map(p => ({
      ...p,
      defaultBranches: p.role === "trainer" ? p.trainerBranches : null,
      devices: (devMap.get(p.userId) as any)?.n ?? 0,
      onDuty: p.enabled && onDutyNow(p.schedule),
    }));
  }),

  adminSave: adminProcedure
    .input(z.object({
      userId: z.number(),
      enabled: z.boolean(), staffCall: z.boolean(), consult: z.boolean(),
      branches: z.array(z.number().int()).nullable(),
      schedule: z.array(z.object({ on: z.boolean(), start: z.string().regex(/^\d{2}:\d{2}$/), end: z.string().regex(/^\d{2}:\d{2}$/) })).length(7).nullable(),
    }))
    .mutation(async ({ input }) => {
      await pool.query(
        `INSERT INTO staff_alert_prefs ("userId", enabled, "staffCall", consult, branches, schedule, "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, now()::text)
         ON CONFLICT ("userId") DO UPDATE SET enabled = $2, "staffCall" = $3, consult = $4, branches = $5, schedule = $6, "updatedAt" = now()::text`,
        [input.userId, input.enabled ? 1 : 0, input.staffCall ? 1 : 0, input.consult ? 1 : 0,
          input.branches && input.branches.length ? JSON.stringify(input.branches) : null,
          input.schedule ? JSON.stringify(input.schedule) : null]);
      return { ok: true };
    }),

  /** 테스트 알림: userId 지정 시 그 사람, 없으면 알림 켠 전 직원 (근무시간 무시) */
  adminTest: adminProcedure
    .input(z.object({ userId: z.number().optional() }))
    .mutation(async ({ input }) => {
      const ids = input.userId ? [input.userId] : (await loadPrefs()).filter(p => p.enabled).map(p => p.userId);
      const devices = await countDevices(ids);
      setTimeout(() => {
        sendStaffPush(null, { title: "✅ 알림 테스트 (관리자)", body: "키오스크 호출·상담 알림이 이 기기로 옵니다.", url: "/", tag: `test-${Date.now()}` }, ids, "test").catch(() => {});
      }, TEST_DELAY_MS);
      return { sent: devices, delaySec: TEST_DELAY_MS / 1000 };
    }),

  /** 최근 호출 기록 + 응답 시간 */
  callLog: adminProcedure.query(async () => {
    const r = await pool.query(
      `SELECT c.id, c.message, c.status, c."createdAt", c."acknowledgedAt", c."branchNo", u.username AS "ackBy", t."trainerName" AS "ackName"
         FROM staff_call_log c
         LEFT JOIN users u ON u.id = c."acknowledgedBy"
         LEFT JOIN trainers t ON t."userId" = u.id
        WHERE c.message NOT LIKE '%[테스트]%'
        ORDER BY c.id DESC LIMIT 30`);
    return r.rows.map((x: any) => ({
      id: x.id as number, message: x.message as string, status: x.status as string, branchNo: x.branchNo as number | null,
      createdAt: String(x.createdAt).slice(0, 16).replace("T", " "),
      ackBy: (x.ackName ?? x.ackBy) as string | null,
      responseMin: x.acknowledgedAt && x.ackBy ? Math.max(0, Math.round((Date.parse(x.acknowledgedAt) - Date.parse(x.createdAt)) / 60_000)) : null,
    }));
  }),

  /** 최근 2시간 미확인 호출 (트레이너는 자기 지점만) */
  pendingCalls: staffProcedure.query(async ({ ctx }) => {
    const branches = await myBranchIds(ctx.user);
    const r = await pool.query(
      `SELECT id, message, "createdAt", "branchNo" FROM staff_call_log
        WHERE status = 'pending' AND "createdAt" >= $1
          AND ($2::int[] IS NULL OR "branchNo" IS NULL OR "branchNo" = ANY($2))
        ORDER BY id DESC LIMIT 5`,
      [kstIso(-2 * 3600_000), branches]);
    // createdAt은 KST 시각 문자열 → 경과 분 계산
    const nowKst = Date.parse(kstIso());
    return r.rows.map((x: any) => ({
      id: x.id as number, message: x.message as string, branchNo: x.branchNo as number | null,
      minutesAgo: Math.max(0, Math.round((nowKst - Date.parse(x.createdAt)) / 60_000)),
    }));
  }),

  acknowledge: staffProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const r = await pool.query(
        `UPDATE staff_call_log SET status = 'acknowledged', "acknowledgedAt" = $1, "acknowledgedBy" = $2
          WHERE id = $3 AND status = 'pending' RETURNING id`,
        [kstIso(), ctx.user.id, input.id]);
      return { ok: true, already: r.rowCount === 0 };
    }),
});
