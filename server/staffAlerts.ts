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

export const VAPID_PUBLIC = "BK_eYZuRk27SeTqaVTc1Ui5eK8fYjm_6CfLZfQK4L8eqhnqxhqA38lplk5Ez4064IN_3ag-kSTQkLxiuRn91-8E";
export const VAPID_PRIVATE = "Q-8EMtpbLdJf3VQqrfE4A8ZyBrtvVxfw4dp9h_31Ahc";
const VAPID = { subject: "mailto:admin@ziantgym.com", publicKey: VAPID_PUBLIC, privateKey: VAPID_PRIVATE };

const BRANCH_LABEL: Record<number, string> = { 1: "1호점", 2: "2호점" };
const CONSULT_LABEL: Record<string, string> = { new: "신규 상담", renew: "재등록 상담", pt: "PT 상담" };
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
];

type PushPayload = { title: string; body: string; url: string; tag?: string; requireInteraction?: boolean };

/** 역할·지점 기준 수신자에게 푸시. userIds를 주면 그 사람에게만. 보낸 기기 수를 돌려준다. */
export async function sendStaffPush(branchNo: number | null, payload: PushPayload, userIds?: number[]): Promise<number> {
  const subs = userIds
    ? await pool.query(`SELECT endpoint, p256dh, auth FROM ops_push_subscriptions WHERE "userId" = ANY($1)`, [userIds])
    : await pool.query(
      `SELECT s.endpoint, s.p256dh, s.auth
         FROM ops_push_subscriptions s
         JOIN users u ON u.id = s."userId"
         LEFT JOIN trainers t ON t."userId" = u.id
        WHERE u.role IN ('admin', 'sub_admin', 'consultant')
           OR (u.role = 'trainer' AND ($1::int IS NULL OR t."branchId" = $1
               OR EXISTS (SELECT 1 FROM trainer_branches tb WHERE tb."trainerId" = t.id AND tb."branchId" = $1)))`,
      [branchNo]);
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
      const sent = await sendStaffPush(branchNo, {
        title: `🔔 ${branchPrefix(branchNo)}직원 호출`, body: "키오스크 앞에서 회원님이 기다리고 있어요.",
        url: "/", tag: `staff-call-${callId}`, requireInteraction: true,
      });
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
      const b = req.body ?? {};
      const branchNo = parseBranch(b.branchNo);
      const consultType = ["new", "renew", "pt"].includes(b.consultType) ? b.consultType as string : "new";
      const digits = String(b.phone ?? "").replace(/\D/g, "");
      if (digits.length < 9) return res.status(400).json({ error: "연락처를 확인해 주세요." });
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
      const sent = await sendStaffPush(branchNo, {
        title: `📝 ${branchPrefix(branchNo)}${label} 접수`,
        body: [who, fmtPhone(digits), purpose].filter(Boolean).join(" · "),
        url: member ? `/members/${member.id}` : "/leads",
        tag: `consult-${digits}`,
      });
      return res.json({ ok: true, leadId, leadCreated, memberId: member?.id ?? null, sent });
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

  test: staffProcedure.mutation(async ({ ctx }) => {
    const sent = await sendStaffPush(null, { title: "✅ 알림 테스트", body: "이 기기에서 키오스크 호출·상담 알림을 받습니다.", url: "/", tag: "test" }, [ctx.user.id]);
    return { sent };
  }),

  /** 관리자: 알림 받는 직원 현황 */
  subscribers: staffProcedure.query(async ({ ctx }) => {
    if (ctx.user.role !== "admin" && ctx.user.role !== "sub_admin") throw new TRPCError({ code: "FORBIDDEN" });
    const r = await pool.query(
      `SELECT u.username, u.role, t."trainerName", COUNT(s.id)::int AS devices
         FROM users u LEFT JOIN trainers t ON t."userId" = u.id
         LEFT JOIN ops_push_subscriptions s ON s."userId" = u.id
        WHERE u.role IN ('admin', 'sub_admin', 'consultant', 'trainer')
        GROUP BY u.id, u.username, u.role, t."trainerName" ORDER BY u.role, u.username`);
    return r.rows as { username: string; role: string; trainerName: string | null; devices: number }[];
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
