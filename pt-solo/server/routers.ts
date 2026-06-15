import { initTRPC, TRPCError } from "@trpc/server";
import { z } from "zod";
import { eq, and, desc, sql, gt, gte, lte, isNull } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { getDb, getDashboardStats, pool } from "./db";
import { sendVerificationEmail, sendBookingNotificationEmail } from "./email";
import {
  users,
  trainers,
  trainerSettings,
  members,
  ptPackages,
  ptPauses,
  attendances,
  ptSessionLogs,
  payments,
  workoutMemos,
  parQ,
  attendanceChecks,
  reportTokens,
  schedules,
  channels,
  leads,
  fitStepPlusMembers,
  fitStepPlusVideoCategories,
  fitStepPlusVideos,
  fitStepPlusEvents,
  fitStepPlusWorkoutLogs,
  fitStepPlusAttendance,
} from "../drizzle/schema";
import { randomUUID } from "crypto";
import type { AuthUser } from "./auth";
import type { Request, Response } from "express";

interface Context {
  user?: AuthUser;
  req: Request;
  res: Response;
}

// 자동 포인트 지급 헬퍼
async function giveAutoPoints(trainerId: number, event: string, memo: string) {
  try {
    const rule = await pool.query<{ amount: number; isEnabled: number }>(
      `SELECT amount, "isEnabled" FROM point_auto_rules WHERE event=$1 LIMIT 1`,
      [event]
    );
    if (!rule.rows[0] || !rule.rows[0].isEnabled || rule.rows[0].amount <= 0) return;
    await pool.query(
      `INSERT INTO fit_point_logs ("trainerId", amount, type, memo, status) VALUES ($1,$2,'auto_reward',$3,'completed')`,
      [trainerId, rule.rows[0].amount, memo]
    );
  } catch { /* 포인트 지급 실패는 조용히 무시 */ }
}

// 포인트 차감 헬퍼 — 잔액 부족 시 TRPCError 발생
const TRIAL_DAYS = 30;
async function spendPoints(trainerId: number, feature: string, memo: string) {
  // 무료 체험 기간 중에는 포인트 차감 없음
  const trialRow = await pool.query<{ workshopTrialStartedAt: string | null }>(
    `SELECT "workshopTrialStartedAt" FROM trainer_settings WHERE "trainerId"=$1`,
    [trainerId]
  );
  const trialStartedAt = trialRow.rows[0]?.workshopTrialStartedAt;
  if (trialStartedAt) {
    const daysSince = Math.floor((Date.now() - new Date(trialStartedAt).getTime()) / 86400000);
    if (daysSince <= TRIAL_DAYS) return;
  }

  const ruleRow = await pool.query<{ cost: number; isEnabled: number }>(
    `SELECT cost, "isEnabled" FROM feature_cost_rules WHERE feature=$1`, [feature]
  );
  const cost = ruleRow.rows[0]?.cost ?? 50;
  const isEnabled = ruleRow.rows[0]?.isEnabled ?? 1;
  if (!isEnabled) return; // 규칙 비활성화 시 차감 안 함
  const bal = await pool.query<{ balance: string }>(
    `SELECT COALESCE(SUM(amount),0) AS balance FROM fit_point_logs WHERE "trainerId"=$1 AND status='completed' AND ("expiresAt" IS NULL OR "expiresAt" > CURRENT_DATE::text)`,
    [trainerId]
  );
  const balance = Number(bal.rows[0]?.balance ?? 0);
  if (balance < cost) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `포인트가 부족합니다. (필요: ${cost}P, 보유: ${balance}P)`,
    });
  }
  await pool.query(
    `INSERT INTO fit_point_logs ("trainerId", amount, type, memo, status) VALUES ($1,$2,'feature_use',$3,'completed')`,
    [trainerId, -cost, memo]
  );
}


const DEFAULT_TERMS_OF_SERVICE = `이용 약관

제1조 (목적)
본 약관은 퍼스널 트레이닝 서비스 이용에 관한 기본적인 사항을 규정함을 목적으로 합니다.

제2조 (서비스 내용)
트레이너는 회원에게 개인 맞춤형 운동 지도, 식이 상담, 체력 측정 및 평가 등의 서비스를 제공합니다.

제3조 (계약 기간 및 횟수)
본 계약은 회원권 등록일로부터 약정된 횟수 또는 기간 동안 유효합니다.

제4조 (결제 및 환불)
① 회원권 요금은 계약 체결 시 선납을 원칙으로 합니다.
② 환불은 소비자보호법 및 체육시설법에 따라 처리됩니다.
③ 이용 횟수에 따른 잔여 횟수는 일할 계산하여 환불합니다.

제5조 (회원의 의무)
① 회원은 정해진 시간에 성실히 참여하여야 합니다.
② 무단 결석 시 사전 연락 없이 진행된 수업은 소진한 것으로 간주합니다.
③ 건강 상태 변화 시 즉시 트레이너에게 고지하여야 합니다.

제6조 (손해배상)
회원의 부주의로 인한 부상 및 사고에 대해 트레이너는 책임을 지지 않습니다.`;

const DEFAULT_PRIVACY_POLICY = `개인정보 수집·이용 동의서

1. 수집하는 개인정보 항목
   - 필수: 성명, 생년월일, 연락처
   - 선택: 신체 정보(키, 몸무게, 체지방률), 건강 상태, 운동 목적

2. 개인정보의 수집·이용 목적
   - 퍼스널 트레이닝 서비스 제공
   - 운동 프로그램 설계 및 건강 관리
   - 회원 관리 및 상담

3. 개인정보의 보유 및 이용 기간
   - 서비스 이용 계약 종료 후 1년까지 보관
   - 단, 관련 법령에 따라 일정 기간 보관이 필요한 경우 해당 기간 보관

4. 동의 거부 권리
   귀하는 개인정보 수집·이용에 동의를 거부할 권리가 있습니다.
   단, 필수 항목 거부 시 서비스 이용이 제한될 수 있습니다.`;

const DEFAULT_MARKETING_CONSENT = `광고성 정보 수신 동의서

1. 전송자: 담당 트레이너
2. 전송 매체: SMS, 카카오톡, 이메일 등

3. 전송 내용
   - 운동 관련 정보 및 건강 팁
   - 이벤트, 프로모션, 할인 안내
   - 신규 프로그램 및 서비스 안내

4. 수신 동의 철회
   수신을 원하지 않으실 경우 언제든지 트레이너에게 연락하여
   수신 거부 의사를 전달하실 수 있습니다.

※ 광고성 정보 수신 동의는 선택 사항이며, 동의하지 않으셔도
   퍼스널 트레이닝 서비스 이용에는 제한이 없습니다.`;

const t = initTRPC.context<Context>().create();

const publicProcedure = t.procedure;
const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });
  return next({ ctx: { ...ctx, user: ctx.user } });
});

// 카드/현금영수증/지역화폐는 부가세 10% 제외, 이체는 그대로
function calcPricePerSession(paymentAmount: number | undefined, sessions: number | undefined, paymentMethod?: string): number | undefined {
  if (!paymentAmount || !sessions || sessions <= 0) return undefined;
  const base = paymentMethod === "이체" ? paymentAmount : Math.round(paymentAmount / 1.1);
  return Math.round(base / sessions);
}

// ─── Auth ────────────────────────────────────────────────────────────────────

const authRouter = t.router({
  login: publicProcedure
    .input(z.object({ username: z.string(), password: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();

      const userResult = await db
        .select()
        .from(users)
        .where(eq(users.username, input.username))
        .limit(1);

      const user = userResult[0];
      if (!user)
        throw new TRPCError({ code: "UNAUTHORIZED", message: "아이디 또는 비밀번호가 잘못되었습니다." });

      const valid = await bcrypt.compare(input.password, user.password);
      if (!valid)
        throw new TRPCError({ code: "UNAUTHORIZED", message: "아이디 또는 비밀번호가 잘못되었습니다." });

      if (user.position === "pending")
        throw new TRPCError({ code: "FORBIDDEN", message: "가입 승인 대기 중입니다. 관리자 승인 후 로그인할 수 있습니다." });
      if (user.position === "rejected")
        throw new TRPCError({ code: "FORBIDDEN", message: "가입이 거절되었습니다. 관리자에게 문의하세요." });

      const trainerResult = await db
        .select({ id: trainers.id })
        .from(trainers)
        .where(eq(trainers.userId, user.id))
        .limit(1);
      const trainerId = trainerResult[0]?.id;

      await db.update(users).set({ lastLoginAt: new Date().toISOString() }).where(eq(users.id, user.id));

      const authUser: AuthUser = {
        id: user.id,
        username: user.username,
        role: (user.role as "trainer" | "admin") ?? "trainer",
        position: user.position,
        trainerId,
      };
      ctx.req.session.user = authUser;
      return authUser;
    }),

  logout: protectedProcedure.mutation(async ({ ctx }) => {
    ctx.req.session.destroy(() => {});
    return { success: true };
  }),

  me: publicProcedure.query(async ({ ctx }) => {
    if (!ctx.user) return null;
    const db = getDb();
    const row = await db.select({ plan: sql<string>`"plan"` }).from(users).where(eq(users.id, ctx.user.id)).limit(1);
    // jobType은 트레이너 사이드바 표시에 사용
    let jobType: string | null = null;
    if (ctx.user.trainerId) {
      const tRow = await pool.query<{ jobType: string | null }>(
        `SELECT "jobType" FROM trainers WHERE id=$1 LIMIT 1`, [ctx.user.trainerId]
      );
      jobType = tRow.rows[0]?.jobType ?? null;
    }
    return { ...ctx.user, plan: row[0]?.plan ?? "free", jobType };
  }),

  sendVerificationCode: publicProcedure
    .input(z.object({ email: z.string().email() }))
    .mutation(async () => {
      const code = String(Math.floor(100000 + Math.random() * 900000));
      const expiresAt = Date.now() + 10 * 60 * 1000;
      await pool.query(`DELETE FROM verification_codes WHERE email = $1`, [""]);
      await pool.query(`INSERT INTO verification_codes (email, code, "expiresAt") VALUES ($1, $2, $3)`, ["", code, expiresAt]);

      const emailConfigured = !!process.env.RESEND_API_KEY;
      return { smtpConfigured: emailConfigured, devCode: emailConfigured ? undefined : code };
    }),

  sendEmailCode: publicProcedure
    .input(z.object({ email: z.string().email() }))
    .mutation(async ({ input }) => {
      await pool.query(`DELETE FROM verification_codes WHERE email = $1`, [input.email]);
      const code = String(Math.floor(100000 + Math.random() * 900000));
      const expiresAt = Date.now() + 10 * 60 * 1000;
      await pool.query(`INSERT INTO verification_codes (email, code, "expiresAt") VALUES ($1, $2, $3)`, [input.email, code, expiresAt]);

      const emailConfigured = !!process.env.RESEND_API_KEY;
      if (emailConfigured) {
        const sent = await sendVerificationEmail(input.email, code);
        if (sent) return { sent: true, devCode: null as string | null };
        console.error("이메일 발송 실패 - devCode로 폴백");
      }
      return { sent: false, devCode: code as string | null };
    }),

  verifyEmailCode: publicProcedure
    .input(z.object({ email: z.string().email(), code: z.string().length(6) }))
    .mutation(async ({ input }) => {
      const result = await pool.query<{ code: string; expiresAt: string }>(
        `SELECT code, "expiresAt" FROM verification_codes WHERE email = $1 ORDER BY id DESC LIMIT 1`, [input.email]
      );
      const row = result.rows[0];
      if (!row) throw new TRPCError({ code: "BAD_REQUEST", message: "인증 코드를 먼저 요청해주세요." });
      if (Date.now() > Number(row.expiresAt)) throw new TRPCError({ code: "BAD_REQUEST", message: "인증 코드가 만료되었습니다. 다시 요청해주세요." });
      if (row.code !== input.code) throw new TRPCError({ code: "BAD_REQUEST", message: "인증 코드가 올바르지 않습니다." });
      await pool.query(`DELETE FROM verification_codes WHERE email = $1`, [input.email]);
      return { verified: true };
    }),

  register: publicProcedure
    .input(z.object({
      username: z.string().min(3).max(50),
      password: z.string().min(6),
      trainerName: z.string().min(1),
      phone: z.string().optional(),
      email: z.string().email().optional().or(z.literal("")),
      referralCode: z.string().optional(), // 초대 코드
    }))
    .mutation(async ({ input }) => {
      const db = getDb();

      const existing = await db.select({ id: users.id }).from(users).where(eq(users.username, input.username)).limit(1);
      if (existing[0]) throw new TRPCError({ code: "CONFLICT", message: "이미 사용 중인 아이디입니다." });

      // 초대 코드 유효성 확인
      let referredBy: string | undefined;
      if (input.referralCode) {
        const referrer = await pool.query(`SELECT id FROM users WHERE "referralCode"=$1`, [input.referralCode.toUpperCase()]);
        if (referrer.rows.length > 0) referredBy = input.referralCode.toUpperCase();
      }

      const hashed = await bcrypt.hash(input.password, 10);
      const myCode = Math.random().toString(36).slice(2, 10).toUpperCase();
      const [userRow] = await db.insert(users).values({ username: input.username, password: hashed, role: "trainer", position: "pending" }).returning({ id: users.id });
      await pool.query(`UPDATE users SET "referralCode"=$1, "referredBy"=$2 WHERE id=$3`, [myCode, referredBy ?? null, userRow.id]);
      const [trainerRow] = await db.insert(trainers).values({ userId: userRow.id, trainerName: input.trainerName, phone: input.phone, email: input.email || undefined }).returning({ id: trainers.id });
      await db.insert(trainerSettings).values({ trainerId: trainerRow.id, settlementRate: 50 });

      return { success: true, message: "가입 신청이 완료되었습니다. 관리자 승인 후 로그인할 수 있습니다." };
    }),
});

// ─── Members ─────────────────────────────────────────────────────────────────

const membersRouter = t.router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const db = getDb();
    const trainerId = ctx.user.trainerId;
    if (!trainerId) throw new TRPCError({ code: "FORBIDDEN" });

    return db
      .select()
      .from(members)
      .where(eq(members.trainerId, trainerId))
      .orderBy(desc(members.createdAt));
  }),

  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const result = await db.select().from(members).where(eq(members.id, input.id)).limit(1);
      if (!result[0]) throw new TRPCError({ code: "NOT_FOUND" });
      return result[0];
    }),

  getExpiring: protectedProcedure
    .input(z.object({ days: z.number().default(7) }))
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const trainerId = ctx.user.trainerId;
      if (!trainerId) throw new TRPCError({ code: "FORBIDDEN" });

      const today = new Date().toISOString().split("T")[0];
      const future = new Date(Date.now() + input.days * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

      return db
        .select()
        .from(members)
        .where(and(
          eq(members.trainerId, trainerId),
          eq(members.status, "active"),
          sql`${members.membershipEnd} IS NOT NULL`,
          sql`${members.membershipEnd} >= ${today}`,
          sql`${members.membershipEnd} <= ${future}`,
        ))
        .orderBy(members.membershipEnd);
    }),

  getWithUnpaid: protectedProcedure.query(async ({ ctx }) => {
    const db = getDb();
    const trainerId = ctx.user.trainerId;
    if (!trainerId) throw new TRPCError({ code: "FORBIDDEN" });

    return db
      .select({
        id: members.id,
        name: members.name,
        phone: members.phone,
        unpaidAmount: ptPackages.unpaidAmount,
        packageName: ptPackages.packageName,
      })
      .from(members)
      .innerJoin(ptPackages, eq(members.id, ptPackages.memberId))
      .where(and(
        eq(members.trainerId, trainerId),
        sql`${ptPackages.unpaidAmount} IS NOT NULL`,
        gt(ptPackages.unpaidAmount, 0),
      ))
      .orderBy(desc(ptPackages.unpaidAmount));
  }),

  create: protectedProcedure
    .input(z.object({
      name: z.string().min(1),
      phone: z.string().optional(),
      email: z.string().email().optional(),
      birthDate: z.string().optional(),
      gender: z.enum(["male", "female", "other"]).optional(),
      grade: z.enum(["basic", "premium", "vip"]).default("basic"),
      status: z.enum(["active", "paused"]).default("active"),
      membershipStart: z.string().optional(),
      membershipEnd: z.string().optional(),
      profileNote: z.string().optional(),
      visitRoute: z.string().optional(),
      ptProgram: z.string().optional(),
      ptSessions: z.string().optional(),
      paymentAmount: z.number().optional(),
      unpaidAmount: z.number().optional(),
      paymentMethod: z.enum(["현금영수증", "이체", "지역화폐", "카드"]).optional(),
      paymentDate: z.string().optional(),
      paymentMemo: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const trainerId = ctx.user.trainerId;
      if (!trainerId) throw new TRPCError({ code: "FORBIDDEN" });

      const { ptProgram, ptSessions, paymentAmount, unpaidAmount, paymentMethod, paymentDate, paymentMemo, ...memberData } = input;

      const [planRow] = await db.select({ plan: sql<string>`"plan"` }).from(users).where(eq(users.id, ctx.user.id)).limit(1);
      const memberPlan = planRow?.plan ?? "free";
      const limitRows = await pool.query<{ key: string; value: string }>(
        `SELECT key, value FROM plan_settings WHERE key IN ('member_limit_free','member_limit_pro','member_limit_elite')`
      );
      const limitMap: Record<string, number> = { free: 7, pro: 15, elite: 35 };
      for (const r of limitRows.rows) { limitMap[r.key.replace("member_limit_", "")] = parseInt(r.value); }
      const memberLimit = limitMap[memberPlan] ?? 7;
      const [cnt] = await db.select({ count: sql<number>`COUNT(*)` }).from(members).where(eq(members.trainerId, trainerId));
      if (Number(cnt?.count ?? 0) >= memberLimit) throw new TRPCError({ code: "FORBIDDEN", message: `${memberPlan.toUpperCase()} 플랜은 유효회원을 최대 ${memberLimit}명까지 등록할 수 있습니다.` });

      const [insertResult] = await db.insert(members).values({ ...memberData, trainerId }).returning({ id: members.id });
      const memberId = insertResult.id;

      if (ptSessions) {
        const sessionCount = parseInt(ptSessions);
        const pricePerSession = calcPricePerSession(paymentAmount, sessionCount, paymentMethod);
        await db.insert(ptPackages).values({
          memberId,
          trainerId,
          totalSessions: sessionCount,
          usedSessions: 0,
          packageName: ptProgram || undefined,
          startDate: memberData.membershipStart,
          expiryDate: memberData.membershipEnd,
          pricePerSession,
          paymentAmount,
          unpaidAmount,
          paymentMethod,
          paymentDate,
          paymentMemo,
        });
      }

      return { id: memberId };
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().min(1).optional(),
      phone: z.string().optional(),
      email: z.string().email().optional(),
      birthDate: z.string().optional(),
      gender: z.enum(["male", "female", "other"]).optional(),
      grade: z.enum(["basic", "premium", "vip"]).optional(),
      status: z.enum(["active", "paused"]).optional(),
      membershipStart: z.string().optional(),
      membershipEnd: z.string().optional(),
      profileNote: z.string().optional(),
      visitRoute: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const { id, ...data } = input;
      await db.update(members).set(data).where(eq(members.id, id));
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      await db.delete(members).where(eq(members.id, input.id));
      return { success: true };
    }),

  getPayments: protectedProcedure
    .input(z.object({ memberId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = getDb();
      return db.select().from(payments).where(eq(payments.memberId, input.memberId)).orderBy(desc(payments.createdAt));
    }),

  getLowSessions: protectedProcedure
    .input(z.object({ threshold: z.number().default(5) }))
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const trainerId = ctx.user.trainerId;
      if (!trainerId) throw new TRPCError({ code: "FORBIDDEN" });

      const rows = await db
        .select({
          id: members.id,
          name: members.name,
          phone: members.phone,
          packageName: ptPackages.packageName,
          totalSessions: ptPackages.totalSessions,
          usedSessions: ptPackages.usedSessions,
        })
        .from(members)
        .innerJoin(ptPackages, and(eq(ptPackages.memberId, members.id), eq(ptPackages.status, "active")))
        .where(and(eq(members.trainerId, trainerId), eq(members.status, "active")))
        .orderBy(members.name);

      return rows.filter(r => (r.totalSessions - r.usedSessions) <= input.threshold);
    }),

  getLongAbsent: protectedProcedure
    .input(z.object({ days: z.number().default(14) }))
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const trainerId = ctx.user.trainerId;
      if (!trainerId) throw new TRPCError({ code: "FORBIDDEN" });

      const cutoff = new Date(Date.now() - input.days * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

      const allMembers = await db
        .select({ id: members.id, name: members.name, phone: members.phone })
        .from(members)
        .where(and(eq(members.trainerId, trainerId), eq(members.status, "active")));

      const result = await Promise.all(
        allMembers.map(async (m) => {
          const last = await db
            .select({ attendDate: attendances.attendDate })
            .from(attendances)
            .where(and(eq(attendances.memberId, m.id), eq(attendances.status, "attended")))
            .orderBy(desc(attendances.attendDate))
            .limit(1);
          return { ...m, lastAttendDate: last[0]?.attendDate ?? null };
        })
      );

      return result.filter(m => !m.lastAttendDate || m.lastAttendDate < cutoff);
    }),

  getStats: protectedProcedure
    .input(z.object({ memberId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const [pkgs, sessionLogsAll, checks] = await Promise.all([
        db.select().from(ptPackages).where(eq(ptPackages.memberId, input.memberId)),
        db.select().from(ptSessionLogs).where(eq(ptSessionLogs.memberId, input.memberId)).orderBy(desc(ptSessionLogs.sessionDate)),
        db.select().from(attendanceChecks).where(eq(attendanceChecks.memberId, input.memberId)),
      ]);

      const totalSessions = pkgs.reduce((s, p) => s + (p.usedSessions ?? 0), 0);
      const cancelCount = checks.filter((c) => c.status === "cancelled").length;
      const noshowCount = checks.filter((c) => c.status === "noshow").length;
      const lastSessionDate = sessionLogsAll[0]?.sessionDate ?? null;
      const pkgCount = pkgs.length;
      const reregistrationCount = Math.max(0, pkgCount - 1);

      return { totalSessions, cancelCount, noshowCount, lastSessionDate, reregistered: pkgCount > 1, reregistrationCount, totalChecks: checks.length };
    }),

  bulkExtend: protectedProcedure
    .input(z.object({ memberIds: z.array(z.number()).min(1), days: z.number().min(1).max(3650) }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const trainerId = ctx.user.trainerId;
      if (!trainerId) throw new TRPCError({ code: "FORBIDDEN" });

      let updated = 0;
      for (const memberId of input.memberIds) {
        const rows = await db.select({ membershipEnd: members.membershipEnd }).from(members).where(eq(members.id, memberId)).limit(1);
        const current = rows[0];
        if (!current) continue;

        const base = current.membershipEnd ? new Date(current.membershipEnd) : new Date();
        if (isNaN(base.getTime())) continue;

        base.setDate(base.getDate() + input.days);
        await db.update(members).set({ membershipEnd: base.toISOString().split("T")[0] }).where(eq(members.id, memberId));
        updated++;
      }

      return { updated };
    }),
});

// ─── PT Packages ─────────────────────────────────────────────────────────────

const ptRouter = t.router({
  listByMember: protectedProcedure
    .input(z.object({ memberId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = getDb();
      return db.select().from(ptPackages).where(eq(ptPackages.memberId, input.memberId)).orderBy(desc(ptPackages.createdAt));
    }),

  list: protectedProcedure.query(async ({ ctx }) => {
    const db = getDb();
    const trainerId = ctx.user.trainerId;
    if (!trainerId) throw new TRPCError({ code: "FORBIDDEN" });

    return db
      .select({
        id: ptPackages.id,
        memberId: ptPackages.memberId,
        memberName: members.name,
        memberPhone: members.phone,
        trainerId: ptPackages.trainerId,
        totalSessions: ptPackages.totalSessions,
        usedSessions: ptPackages.usedSessions,
        packageName: ptPackages.packageName,
        startDate: ptPackages.startDate,
        expiryDate: ptPackages.expiryDate,
        status: ptPackages.status,
        price: ptPackages.price,
        pricePerSession: ptPackages.pricePerSession,
        paymentAmount: ptPackages.paymentAmount,
        unpaidAmount: ptPackages.unpaidAmount,
        paymentMethod: ptPackages.paymentMethod,
        paymentMemo: ptPackages.paymentMemo,
        createdAt: ptPackages.createdAt,
        updatedAt: ptPackages.updatedAt,
      })
      .from(ptPackages)
      .innerJoin(members, eq(ptPackages.memberId, members.id))
      .where(eq(ptPackages.trainerId, trainerId))
      .orderBy(desc(ptPackages.createdAt));
  }),

  addPackage: protectedProcedure
    .input(z.object({
      memberId: z.number(),
      ptProgram: z.string().optional(),
      totalSessions: z.number().min(1),
      startDate: z.string().optional(),
      expiryDate: z.string().optional(),
      paymentAmount: z.number().optional(),
      unpaidAmount: z.number().optional(),
      paymentMethod: z.enum(["현금영수증", "이체", "지역화폐", "카드"]).optional(),
      paymentDate: z.string().optional(),
      paymentMemo: z.string().optional(),
      withContract: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const trainerId = ctx.user.trainerId;
      if (!trainerId) throw new TRPCError({ code: "FORBIDDEN" });

      const pricePerSession = calcPricePerSession(input.paymentAmount, input.totalSessions, input.paymentMethod);

      const existingPkgs = await db.select({ id: ptPackages.id }).from(ptPackages).where(eq(ptPackages.memberId, input.memberId)).limit(1);
      const isRenewal = existingPkgs.length > 0;

      await db.insert(ptPackages).values({
        memberId: input.memberId,
        trainerId,
        totalSessions: input.totalSessions,
        usedSessions: 0,
        packageName: input.ptProgram || undefined,
        startDate: input.startDate,
        expiryDate: input.expiryDate,
        pricePerSession,
        paymentAmount: input.paymentAmount,
        unpaidAmount: input.unpaidAmount,
        paymentMethod: input.paymentMethod,
        paymentDate: input.paymentDate,
        paymentMemo: input.paymentMemo,
      });

      if (isRenewal && trainerId) giveAutoPoints(trainerId, "renewal_complete", "재등록 완료");
      if (input.withContract) await spendPoints(trainerId, "reregistration", "재등록 계약");

      const memberInfo = await db.select({ membershipEnd: members.membershipEnd, membershipStart: members.membershipStart }).from(members).where(eq(members.id, input.memberId)).limit(1);
      if (memberInfo[0] && !memberInfo[0].membershipEnd) {
        const months = Math.ceil(input.totalSessions / 10);
        const base = input.startDate || memberInfo[0].membershipStart || new Date().toISOString().substring(0, 10);
        const d = new Date(base);
        d.setMonth(d.getMonth() + months);
        await db.update(members).set({ membershipEnd: d.toISOString().substring(0, 10) }).where(eq(members.id, input.memberId));
      }

      return { success: true };
    }),

  createLog: protectedProcedure
    .input(z.object({
      memberId: z.number(),
      sessionDate: z.string(),
      goal: z.string().optional(),
      bodyPart: z.string().optional(),
      exercisesJson: z.string().optional(),
      feedback: z.string().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const trainerId = ctx.user.trainerId;
      if (!trainerId) throw new TRPCError({ code: "FORBIDDEN" });
      const [row] = await db.insert(ptSessionLogs).values({
        memberId: input.memberId,
        trainerId,
        packageId: undefined,
        sessionDate: input.sessionDate,
        goal: input.goal,
        bodyPart: input.bodyPart,
        exercisesJson: input.exercisesJson,
        feedback: input.feedback,
        notes: input.notes,
      }).returning();
      giveAutoPoints(trainerId, "session_log", "수업 일지 작성");
      return row;
    }),

  updateLog: protectedProcedure
    .input(z.object({
      id: z.number(),
      sessionDate: z.string().optional(),
      goal: z.string().optional(),
      bodyPart: z.string().optional(),
      exercisesJson: z.string().optional(),
      feedback: z.string().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const { id, ...fields } = input;
      await db.update(ptSessionLogs).set(fields).where(eq(ptSessionLogs.id, id));
      return { success: true };
    }),

  deleteLog: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      await db.delete(ptSessionLogs).where(eq(ptSessionLogs.id, input.id));
      return { success: true };
    }),

  useSession: protectedProcedure
    .input(z.object({
      packageId: z.number().optional(),
      memberId: z.number(),
      sessionDate: z.string().optional(),
      notes: z.string().optional(),
      bodyPart: z.string().optional(),
      exercisesJson: z.string().optional(),
      goal: z.string().optional(),
      feedback: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const trainerId = ctx.user.trainerId;
      if (!trainerId) throw new TRPCError({ code: "FORBIDDEN" });

      let resolvedPackageId = input.packageId;
      if (!resolvedPackageId) {
        const activePkgs = await db
          .select({ id: ptPackages.id })
          .from(ptPackages)
          .where(and(eq(ptPackages.memberId, input.memberId), eq(ptPackages.status, "active")))
          .limit(1);
        if (!activePkgs[0]) throw new TRPCError({ code: "BAD_REQUEST", message: "활성 PT 패키지가 없습니다." });
        resolvedPackageId = activePkgs[0].id;
      }

      const pkgResult = await db.select().from(ptPackages).where(eq(ptPackages.id, resolvedPackageId!)).limit(1);
      const pkg = pkgResult[0];
      if (!pkg) throw new TRPCError({ code: "NOT_FOUND", message: "패키지를 찾을 수 없습니다." });
      if (pkg.usedSessions >= pkg.totalSessions)
        throw new TRPCError({ code: "BAD_REQUEST", message: "잔여 세션이 없습니다." });

      const newUsed = pkg.usedSessions + 1;
      const newStatus = newUsed >= pkg.totalSessions ? "completed" : "active";

      await db.update(ptPackages).set({ usedSessions: newUsed, status: newStatus as any }).where(eq(ptPackages.id, resolvedPackageId!));

      const today = new Date().toISOString().split("T")[0];
      await db.insert(ptSessionLogs).values({
        memberId: input.memberId,
        trainerId,
        packageId: resolvedPackageId,
        sessionDate: input.sessionDate ?? today,
        notes: input.notes,
        bodyPart: input.bodyPart,
        exercisesJson: input.exercisesJson,
        goal: input.goal,
        feedback: input.feedback,
      });

      const memberRow = await db.select({ membershipStart: members.membershipStart }).from(members).where(eq(members.id, input.memberId)).limit(1);
      if (memberRow[0] && !memberRow[0].membershipStart) {
        await db.update(members).set({ membershipStart: input.sessionDate ?? today }).where(eq(members.id, input.memberId));
      }

      return { success: true, remaining: newUsed < pkg.totalSessions ? pkg.totalSessions - newUsed : 0 };
    }),

  sessionLogs: protectedProcedure
    .input(z.object({ memberId: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      return db.select().from(ptSessionLogs).where(eq(ptSessionLogs.memberId, input.memberId)).orderBy(desc(ptSessionLogs.sessionDate));
    }),

  updatePayment: protectedProcedure
    .input(z.object({ packageId: z.number(), unpaidAmount: z.number().min(0) }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      await db.update(ptPackages).set({ unpaidAmount: input.unpaidAmount }).where(eq(ptPackages.id, input.packageId));
      return { success: true };
    }),

  updatePackage: protectedProcedure
    .input(z.object({
      packageId: z.number(),
      packageName: z.string().optional(),
      totalSessions: z.number().min(1).optional(),
      usedSessions: z.number().min(0).optional(),
      startDate: z.string().optional(),
      expiryDate: z.string().optional(),
      paymentAmount: z.number().min(0).optional(),
      unpaidAmount: z.number().min(0).optional(),
      paymentMethod: z.enum(["현금영수증", "이체", "지역화폐", "카드"]).optional(),
      paymentDate: z.string().optional(),
      paymentMemo: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const { packageId, ...fields } = input;

      const pkg = (fields.totalSessions !== undefined || fields.usedSessions !== undefined)
        ? (await db.select().from(ptPackages).where(eq(ptPackages.id, packageId)).limit(1))[0]
        : null;

      const total = fields.totalSessions ?? pkg?.totalSessions ?? 1;
      const used = fields.usedSessions ?? pkg?.usedSessions ?? 0;
      const autoStatus = used >= total ? "completed" : "active";

      await db.update(ptPackages).set({ ...fields, ...(pkg ? { status: autoStatus } : {}) }).where(eq(ptPackages.id, packageId));
      return { success: true };
    }),

  updateStatus: protectedProcedure
    .input(z.object({ packageId: z.number(), status: z.enum(["active", "paused", "completed", "expired", "refunded"]) }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      await db.update(ptPackages).set({ status: input.status }).where(eq(ptPackages.id, input.packageId));
      return { success: true };
    }),

  addPause: protectedProcedure
    .input(z.object({ packageId: z.number(), memberId: z.number(), pauseStart: z.string(), pauseEnd: z.string().optional(), reason: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      await db.insert(ptPauses).values({ packageId: input.packageId, memberId: input.memberId, pauseStart: input.pauseStart, pauseEnd: input.pauseEnd ?? null, reason: input.reason ?? null });
      return { success: true };
    }),

  listPauses: protectedProcedure
    .input(z.object({ memberId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = getDb();
      return db.select().from(ptPauses).where(eq(ptPauses.memberId, input.memberId)).orderBy(desc(ptPauses.pauseStart));
    }),

  removePause: protectedProcedure
    .input(z.object({ pauseId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      await db.delete(ptPauses).where(eq(ptPauses.id, input.pauseId));
      return { success: true };
    }),

  updatePaymentDate: protectedProcedure
    .input(z.object({ packageId: z.number(), paymentDate: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      await db.update(ptPackages).set({ paymentDate: input.paymentDate }).where(eq(ptPackages.id, input.packageId));
      return { success: true };
    }),

  memberSessionStats: protectedProcedure.query(async ({ ctx }) => {
    const db = getDb();
    const trainerId = ctx.user.trainerId;
    if (!trainerId) throw new TRPCError({ code: "FORBIDDEN" });
    return db
      .select({
        memberId: members.id,
        memberName: members.name,
        totalSessions: sql<number>`COUNT(${ptSessionLogs.id})`,
      })
      .from(members)
      .leftJoin(ptSessionLogs, eq(ptSessionLogs.memberId, members.id))
      .where(eq(members.trainerId, trainerId))
      .groupBy(members.id, members.name)
      .orderBy(desc(sql<number>`COUNT(${ptSessionLogs.id})`));
  }),
});

// ─── Schedules ────────────────────────────────────────────────────────────────

const schedulesRouter = t.router({
  listByMember: protectedProcedure
    .input(z.object({ memberId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = getDb();
      return db.select().from(schedules).where(eq(schedules.memberId, input.memberId)).orderBy(schedules.scheduledDate);
    }),

  create: protectedProcedure
    .input(z.object({ memberId: z.number(), scheduledDate: z.string(), scheduledTime: z.string().optional(), notes: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const trainerId = ctx.user.trainerId;
      if (!trainerId) throw new TRPCError({ code: "FORBIDDEN" });
      await db.insert(schedules).values({ memberId: input.memberId, trainerId, scheduledDate: input.scheduledDate, scheduledTime: input.scheduledTime ?? null, notes: input.notes ?? null });
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ scheduleId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      await db.delete(schedules).where(eq(schedules.id, input.scheduleId));
      return { success: true };
    }),

  updateStatus: protectedProcedure
    .input(z.object({ scheduleId: z.number(), status: z.enum(["pending", "done", "cancelled"]) }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      await db.update(schedules).set({ status: input.status }).where(eq(schedules.id, input.scheduleId));
      return { success: true };
    }),
});

// ─── Attendances ─────────────────────────────────────────────────────────────

const attendancesRouter = t.router({
  listByMember: protectedProcedure
    .input(z.object({ memberId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = getDb();
      return db.select().from(attendances).where(eq(attendances.memberId, input.memberId)).orderBy(desc(attendances.attendDate));
    }),

  create: protectedProcedure
    .input(z.object({
      memberId: z.number(),
      attendDate: z.string(),
      status: z.enum(["attended", "absent", "noshow"]).default("attended"),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const trainerId = ctx.user.trainerId;
      if (!trainerId) throw new TRPCError({ code: "FORBIDDEN" });
      await db.insert(attendances).values({ ...input, trainerId });
      return { success: true };
    }),

  checkIn: protectedProcedure
    .input(z.object({ memberId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const trainerId = ctx.user.trainerId;
      if (!trainerId) throw new TRPCError({ code: "FORBIDDEN" });

      const today = new Date().toISOString().split("T")[0];
      const existing = await db
        .select({ id: attendances.id })
        .from(attendances)
        .where(and(eq(attendances.memberId, input.memberId), eq(attendances.trainerId, trainerId), sql`${attendances.attendDate} = ${today}`))
        .limit(1);

      if (existing[0]) throw new TRPCError({ code: "CONFLICT", message: "오늘 이미 출석 체크되었습니다." });

      await db.insert(attendances).values({ memberId: input.memberId, trainerId, attendDate: today, status: "attended" });
      return { success: true };
    }),
});

// ─── Trainers (본인 프로필/설정만) ────────────────────────────────────────────

const trainersRouter = t.router({
  getMyProfile: protectedProcedure.query(async ({ ctx }) => {
    const db = getDb();
    if (!ctx.user.trainerId) throw new TRPCError({ code: "FORBIDDEN" });
    const [trainer, settings] = await Promise.all([
      db.select().from(trainers).where(eq(trainers.id, ctx.user.trainerId)).limit(1),
      db.select({ settlementRate: trainerSettings.settlementRate }).from(trainerSettings).where(eq(trainerSettings.trainerId, ctx.user.trainerId!)).limit(1),
    ]);
    if (!trainer[0]) throw new TRPCError({ code: "NOT_FOUND" });
    const row = await pool.query<{
      employmentType: string | null; workplaceName: string | null;
      workYears: number | null; specialties: string | null; profileBonusGranted: number;
      jobType: string | null; careerRange: string | null; activityArea: string | null; profileImage: string | null;
      journalType: string | null;
    }>(`SELECT "employmentType","workplaceName","workYears","specialties","profileBonusGranted","jobType","careerRange","activityArea","profileImage","educationNeeds","onboardingSurveyDone","journalType" FROM trainers WHERE id=$1`, [ctx.user.trainerId]);
    const ext = row.rows[0] ?? { employmentType: null, workplaceName: null, workYears: null, specialties: null, profileBonusGranted: 0, jobType: null, careerRange: null, activityArea: null, profileImage: null, educationNeeds: null, onboardingSurveyDone: 0, journalType: null };
    return { ...trainer[0], settlementRate: settings[0]?.settlementRate ?? 50, ...ext };
  }),

  updateMyProfile: protectedProcedure
    .input(z.object({ trainerName: z.string().min(1), phone: z.string().optional(), email: z.string().email().optional().or(z.literal("")) }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      if (!ctx.user.trainerId) throw new TRPCError({ code: "FORBIDDEN" });
      await db.update(trainers).set({ trainerName: input.trainerName, phone: input.phone, email: input.email || undefined }).where(eq(trainers.id, ctx.user.trainerId));
      return { success: true };
    }),

  updateExtendedProfile: protectedProcedure
    .input(z.object({
      jobType: z.string().optional(),
      careerRange: z.string().optional(),
      activityArea: z.string().optional(),
      profileImage: z.string().optional(),
      educationNeeds: z.string().optional(),
      journalType: z.enum(["weight", "pilates"]).optional(),
      // legacy fields kept for backward compat
      employmentType: z.enum(["freelancer", "employed"]).optional(),
      workplaceName: z.string().optional(),
      workYears: z.number().int().min(0).max(50).optional(),
      specialties: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user.trainerId) throw new TRPCError({ code: "FORBIDDEN" });
      await pool.query(
        `UPDATE trainers SET "jobType"=$1,"careerRange"=$2,"activityArea"=$3,"profileImage"=$4,"employmentType"=$5,"workplaceName"=$6,"workYears"=$7,"specialties"=$8,"educationNeeds"=$9,"journalType"=COALESCE($10,"journalType",'weight') WHERE id=$11`,
        [
          input.jobType ?? null, input.careerRange ?? null, input.activityArea ?? null, input.profileImage ?? null,
          input.employmentType ?? null, input.workplaceName ?? null, input.workYears ?? null, input.specialties ?? null,
          input.educationNeeds ?? null, input.journalType ?? null,
          ctx.user.trainerId,
        ]
      );
      // 프로필 완성 보너스 자동 지급 (최초 1회)
      const check = await pool.query<{ profileBonusGranted: number }>(
        `SELECT "profileBonusGranted" FROM trainers WHERE id=$1`, [ctx.user.trainerId]
      );
      const bonusGranted = check.rows[0]?.profileBonusGranted ?? 0;
      const isComplete = !!(input.jobType && input.careerRange && input.activityArea);
      if (isComplete && bonusGranted === 0) {
        const rule = await pool.query<{ amount: number; isEnabled: number }>(
          `SELECT amount, "isEnabled" FROM point_auto_rules WHERE event='profile_complete'`
        );
        const ruleRow = rule.rows[0];
        if (ruleRow && ruleRow.isEnabled) {
          await pool.query(
            `INSERT INTO fit_point_logs ("trainerId", amount, type, memo, status) VALUES ($1,$2,'profile_bonus','트레이너 프로필 완성 보너스','completed')`,
            [ctx.user.trainerId, ruleRow.amount]
          );
        }
        await pool.query(`UPDATE trainers SET "profileBonusGranted"=1 WHERE id=$1`, [ctx.user.trainerId]);
        return { success: true, bonusGranted: !!(ruleRow && ruleRow.isEnabled), bonusAmount: ruleRow?.amount ?? 0 };
      }
      return { success: true, bonusGranted: false };
    }),

  getMyReferralInfo: protectedProcedure.query(async ({ ctx }) => {
    const codeRow = await pool.query<{ referralCode: string | null }>(`SELECT "referralCode" FROM users WHERE id=$1`, [ctx.user.id]);
    const code = codeRow.rows[0]?.referralCode ?? null;
    if (!code) return { referralCode: null, totalInvited: 0, approvedInvited: 0 };
    const totalRow = await pool.query<{ count: string }>(`SELECT COUNT(*) FROM users WHERE "referredBy"=$1`, [code]);
    const approvedRow = await pool.query<{ count: string }>(`SELECT COUNT(*) FROM users WHERE "referredBy"=$1 AND (position IS NULL OR position NOT IN ('pending','rejected'))`, [code]);
    return {
      referralCode: code,
      totalInvited: Number(totalRow.rows[0]?.count ?? 0),
      approvedInvited: Number(approvedRow.rows[0]?.count ?? 0),
    };
  }),

  changePassword: protectedProcedure
    .input(z.object({ currentPassword: z.string(), newPassword: z.string().min(6) }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const userResult = await db.select().from(users).where(eq(users.id, ctx.user.id)).limit(1);
      if (!userResult[0]) throw new TRPCError({ code: "NOT_FOUND" });

      const valid = await bcrypt.compare(input.currentPassword, userResult[0].password);
      if (!valid) throw new TRPCError({ code: "UNAUTHORIZED", message: "현재 비밀번호가 올바르지 않습니다." });

      const hashed = await bcrypt.hash(input.newPassword, 10);
      await db.update(users).set({ password: hashed }).where(eq(users.id, ctx.user.id));
      return { success: true };
    }),

  updateSettlementRate: protectedProcedure
    .input(z.object({ settlementRate: z.number().min(0).max(100) }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      if (!ctx.user.trainerId) throw new TRPCError({ code: "FORBIDDEN" });
      const existing = await db.select({ id: trainerSettings.id }).from(trainerSettings).where(eq(trainerSettings.trainerId, ctx.user.trainerId)).limit(1);
      if (existing[0]) {
        await db.update(trainerSettings).set({ settlementRate: input.settlementRate }).where(eq(trainerSettings.trainerId, ctx.user.trainerId));
      } else {
        await db.insert(trainerSettings).values({ trainerId: ctx.user.trainerId, settlementRate: input.settlementRate });
      }
      return { success: true };
    }),

  getContractTerms: protectedProcedure.query(async ({ ctx }) => {
    const db = getDb();
    if (!ctx.user.trainerId) throw new TRPCError({ code: "FORBIDDEN" });
    const row = await db.select({
      termsOfService: sql<string>`"termsOfService"`,
      privacyPolicy: sql<string>`"privacyPolicy"`,
      marketingConsent: sql<string>`"marketingConsent"`,
    }).from(trainerSettings).where(eq(trainerSettings.trainerId, ctx.user.trainerId)).limit(1);
    const data = row[0] ?? { termsOfService: null, privacyPolicy: null, marketingConsent: null };
    return {
      termsOfService: data.termsOfService ?? DEFAULT_TERMS_OF_SERVICE,
      privacyPolicy: data.privacyPolicy ?? DEFAULT_PRIVACY_POLICY,
      marketingConsent: data.marketingConsent ?? DEFAULT_MARKETING_CONSENT,
    };
  }),

  updateContractTerms: protectedProcedure
    .input(z.object({
      termsOfService: z.string().optional(),
      privacyPolicy: z.string().optional(),
      marketingConsent: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      if (!ctx.user.trainerId) throw new TRPCError({ code: "FORBIDDEN" });
      const existing = await db.select({ id: trainerSettings.id }).from(trainerSettings).where(eq(trainerSettings.trainerId, ctx.user.trainerId)).limit(1);
      const data = { termsOfService: input.termsOfService, privacyPolicy: input.privacyPolicy, marketingConsent: input.marketingConsent };
      if (existing[0]) {
        await db.update(trainerSettings).set(data).where(eq(trainerSettings.trainerId, ctx.user.trainerId));
      } else {
        await db.insert(trainerSettings).values({ trainerId: ctx.user.trainerId, settlementRate: 50, ...data });
      }
      return { success: true };
    }),

  getMyStats: protectedProcedure.query(async ({ ctx }) => {
    const db = getDb();
    const trainerId = ctx.user.trainerId;
    if (!trainerId) throw new TRPCError({ code: "FORBIDDEN" });

    const [totalMembersResult, totalSessionsResult, noShowResult, remainingPtResult, trainerResult] = await Promise.all([
      db.select({ count: sql<number>`COUNT(*)` }).from(members).where(eq(members.trainerId, trainerId)),
      db.select({ count: sql<number>`COUNT(*)` }).from(ptSessionLogs).where(eq(ptSessionLogs.trainerId, trainerId)),
      db.select({ count: sql<number>`COUNT(*)` }).from(attendanceChecks).where(and(eq(attendanceChecks.trainerId, trainerId), eq(attendanceChecks.status, "noshow"))),
      db.select({ total: sql<number>`COALESCE(SUM(${ptPackages.totalSessions} - ${ptPackages.usedSessions}), 0)` }).from(ptPackages).where(and(eq(ptPackages.trainerId, trainerId), eq(ptPackages.status, "active"))),
      db.select({ createdAt: trainers.createdAt }).from(trainers).where(eq(trainers.id, trainerId)).limit(1),
    ]);

    const pkgCountByMember = await db
      .select({ memberId: ptPackages.memberId, count: sql<number>`COUNT(*)` })
      .from(ptPackages)
      .where(eq(ptPackages.trainerId, trainerId))
      .groupBy(ptPackages.memberId);

    const totalRereg = pkgCountByMember.reduce((s, r) => s + Math.max(0, Number(r.count) - 1), 0);
    const reregMemberCount = pkgCountByMember.filter(r => Number(r.count) > 1).length;

    const trainerCreatedAt = trainerResult[0]?.createdAt;
    const monthsActive = trainerCreatedAt
      ? Math.max(1, Math.round((Date.now() - new Date(trainerCreatedAt).getTime()) / (1000 * 60 * 60 * 24 * 30.5)))
      : 1;

    const totalMembers = Number(totalMembersResult[0]?.count ?? 0);
    const totalSessions = Number(totalSessionsResult[0]?.count ?? 0);
    const totalNoShow = Number(noShowResult[0]?.count ?? 0);
    const remainingPt = Number(remainingPtResult[0]?.total ?? 0);

    return {
      totalMembers,
      totalSessions,
      totalRereg,
      totalNoShow,
      remainingPt,
      avgMonthlyRereg: Math.round((totalRereg / monthsActive) * 10) / 10,
      avgMonthlyNewMembers: Math.round((totalMembers / monthsActive) * 10) / 10,
      avgMonthlyPt: Math.round((totalSessions / monthsActive) * 10) / 10,
      reregRate: totalMembers > 0 ? Math.round((reregMemberCount / totalMembers) * 1000) / 10 : 0,
    };
  }),

  getMonthlySettlement: protectedProcedure
    .input(z.object({ yearMonth: z.string(), dateFilter: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const trainerId = ctx.user.trainerId;
      if (!trainerId) throw new TRPCError({ code: "FORBIDDEN" });

      const settingsRow = await db.select({ settlementRate: trainerSettings.settlementRate }).from(trainerSettings).where(eq(trainerSettings.trainerId, trainerId)).limit(1);
      const settlementRate = settingsRow[0]?.settlementRate ?? 50;

      const logs = await db
        .select({
          id: ptSessionLogs.id,
          sessionDate: ptSessionLogs.sessionDate,
          pricePerSession: ptPackages.pricePerSession,
          paymentAmount: ptPackages.paymentAmount,
          totalSessions: ptPackages.totalSessions,
          packageName: ptPackages.packageName,
          memberName: members.name,
        })
        .from(ptSessionLogs)
        .leftJoin(ptPackages, eq(ptSessionLogs.packageId, ptPackages.id))
        .leftJoin(members, eq(ptSessionLogs.memberId, members.id))
        .where(and(
          eq(ptSessionLogs.trainerId, trainerId),
          input.dateFilter
            ? eq(ptSessionLogs.sessionDate, input.dateFilter)
            : and(
                gte(ptSessionLogs.sessionDate, `${input.yearMonth}-01`),
                lte(ptSessionLogs.sessionDate, `${input.yearMonth}-31`),
              ),
        ))
        .orderBy(desc(ptSessionLogs.sessionDate));

      const calcPrice = (l: { pricePerSession: number | null; paymentAmount: number | null; totalSessions: number | null }) => {
        if (l.pricePerSession) return l.pricePerSession;
        if (l.paymentAmount && l.totalSessions && l.totalSessions > 0) return Math.round(l.paymentAmount / l.totalSessions);
        return 0;
      };

      const logsWithPrice = logs.map(l => ({ ...l, effectivePrice: calcPrice(l) }));
      const sessionCount = logsWithPrice.length;
      const revenue = logsWithPrice.reduce((s, l) => s + l.effectivePrice, 0);
      const settlementAmount = Math.round(revenue * settlementRate / 100);
      const afterTax = Math.round(settlementAmount * (1 - 0.033));

      const [noShowResult, newPkgsResult] = await Promise.all([
        db.select({ count: sql<number>`COUNT(*)` })
          .from(attendanceChecks)
          .where(and(
            eq(attendanceChecks.trainerId, trainerId),
            eq(attendanceChecks.status, "noshow"),
            gte(attendanceChecks.checkDate, `${input.yearMonth}-01`),
            lte(attendanceChecks.checkDate, `${input.yearMonth}-31`),
          )),
        db.select({ memberId: ptPackages.memberId, count: sql<number>`COUNT(*)` })
          .from(ptPackages)
          .where(and(
            eq(ptPackages.trainerId, trainerId),
            gte(ptPackages.startDate, `${input.yearMonth}-01`),
            lte(ptPackages.startDate, `${input.yearMonth}-31`),
          ))
          .groupBy(ptPackages.memberId),
      ]);

      const noShow = Number(noShowResult[0]?.count ?? 0);
      const totalNewPkgs = newPkgsResult.length;
      const newMemberIds = new Set(newPkgsResult.map(r => r.memberId));
      const existingMemberPkgsBefore = await db.select({ memberId: ptPackages.memberId })
        .from(ptPackages)
        .where(and(
          eq(ptPackages.trainerId, trainerId),
          lte(ptPackages.startDate, `${input.yearMonth}-01`),
        ));
      const existingMemberIds = new Set(existingMemberPkgsBefore.map(r => r.memberId));
      const newMembers = [...newMemberIds].filter(id => !existingMemberIds.has(id)).length;
      const rereg = totalNewPkgs - newMembers;

      return { sessionCount, revenue, settlementAmount, afterTax, settlementRate, logs: logsWithPrice, noShow, newMembers, rereg };
    }),

  submitOnboardingSurvey: protectedProcedure
    .input(z.object({
      answers: z.record(z.string(), z.array(z.string())),
      trainerName: z.string().optional(),
      phone: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user.trainerId) throw new TRPCError({ code: "FORBIDDEN" });
      // 이미 완료한 경우 중복 처리 방지
      const existing = await pool.query<{ onboardingSurveyDone: number }>(
        `SELECT "onboardingSurveyDone" FROM trainers WHERE id=$1`, [ctx.user.trainerId]
      );
      if (existing.rows[0]?.onboardingSurveyDone === 1) return { ok: true, pointsGranted: false };

      const updates: string[] = [`"onboardingSurveyData"=$1`, `"onboardingSurveyDone"=1`];
      const values: any[] = [JSON.stringify(input.answers), ctx.user.trainerId];
      if (input.trainerName) {
        values.splice(values.length - 1, 0, input.trainerName);
        updates.push(`"trainerName"=$${values.length - 1}`);
      }
      if (input.phone) {
        values.splice(values.length - 1, 0, input.phone);
        updates.push(`"phone"=$${values.length - 1}`);
      }
      await pool.query(
        `UPDATE trainers SET ${updates.join(", ")} WHERE id=$${values.length}`,
        values
      );
      // 설문 완료 300P 지급
      await pool.query(
        `INSERT INTO fit_point_logs ("trainerId", amount, type, memo, status) VALUES ($1,300,'survey_bonus','성장 설문 완료 보너스','completed')`,
        [ctx.user.trainerId]
      );
      return { ok: true, pointsGranted: true };
    }),

  getGuideDismissed: protectedProcedure.query(async ({ ctx }) => {
    const trainerId = ctx.user.trainerId;
    if (!trainerId) return [];
    const result = await pool.query<{ guideDismissed: string }>(
      `SELECT "guideDismissed" FROM trainer_settings WHERE "trainerId" = $1 LIMIT 1`,
      [trainerId]
    );
    const raw = result.rows[0]?.guideDismissed ?? "";
    return raw ? raw.split(",").filter(Boolean) : [];
  }),

  dismissGuide: protectedProcedure
    .input(z.object({ key: z.string().min(1).max(200) }))
    .mutation(async ({ ctx, input }) => {
      const trainerId = ctx.user.trainerId;
      if (!trainerId) return;
      const existing = await pool.query<{ guideDismissed: string }>(
        `SELECT "guideDismissed" FROM trainer_settings WHERE "trainerId" = $1 LIMIT 1`,
        [trainerId]
      );
      const current = existing.rows[0]?.guideDismissed ?? "";
      const keys = new Set(current.split(",").filter(Boolean));
      keys.add(input.key);
      await pool.query(
        `UPDATE trainer_settings SET "guideDismissed" = $1 WHERE "trainerId" = $2`,
        [Array.from(keys).join(","), trainerId]
      );
      return { success: true };
    }),
});

// ─── Dashboard ────────────────────────────────────────────────────────────────

const dashboardRouter = t.router({
  getStats: protectedProcedure.query(({ ctx }) => {
    const trainerId = ctx.user.trainerId;
    if (!trainerId) throw new TRPCError({ code: "FORBIDDEN" });
    return getDashboardStats(trainerId);
  }),

  getMonthlyChart: protectedProcedure.query(async ({ ctx }) => {
    const trainerId = ctx.user.trainerId;
    if (!trainerId) throw new TRPCError({ code: "FORBIDDEN" });
    const db = getDb();

    const months: { label: string; start: string; end: string }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setDate(1);
      d.setMonth(d.getMonth() - i);
      const start = d.toISOString().split("T")[0];
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 1).toISOString().split("T")[0];
      months.push({ label: `${d.getMonth() + 1}월`, start, end });
    }

    return Promise.all(months.map(async (m) => {
      const [attendCount, newMembers, renewals] = await Promise.all([
        db.select({ count: sql<number>`COUNT(*)` }).from(attendances).where(and(eq(attendances.trainerId, trainerId), eq(attendances.status, "attended"), sql`${attendances.attendDate} >= ${m.start}`, sql`${attendances.attendDate} < ${m.end}`)),
        db.select({ count: sql<number>`COUNT(*)` }).from(members).where(and(eq(members.trainerId, trainerId), sql`${members.createdAt} >= ${m.start}`, sql`${members.createdAt} < ${m.end}`)),
        // 해당 월에 생성된 패키지 중, 회원 가입일이 해당 월 이전인 경우 = 재등록
        pool.query<{ count: string }>(
          `SELECT COUNT(*) AS count FROM pt_packages p
           INNER JOIN members mem ON mem.id = p."memberId"
           WHERE p."trainerId"=$1
             AND p."createdAt" >= $2 AND p."createdAt" < $3
             AND mem."createdAt" < $2`,
          [trainerId, m.start, m.end]
        ),
      ]);
      return {
        month: m.label,
        출석: Number(attendCount[0]?.count ?? 0),
        신규회원: Number(newMembers[0]?.count ?? 0),
        재등록: Number(renewals.rows[0]?.count ?? 0),
      };
    }));
  }),

  getMonthlyRevenue: protectedProcedure.query(async ({ ctx }) => {
    const trainerId = ctx.user.trainerId;
    if (!trainerId) throw new TRPCError({ code: "FORBIDDEN" });
    const db = getDb();

    const settingResult = await db.select({ settlementRate: trainerSettings.settlementRate }).from(trainerSettings).where(eq(trainerSettings.trainerId, trainerId)).limit(1);
    const rate = (settingResult[0]?.settlementRate ?? 50) / 100;

    const months: { label: string; start: string; end: string }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setDate(1);
      d.setMonth(d.getMonth() - i);
      const start = d.toISOString().split("T")[0];
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 1).toISOString().split("T")[0];
      months.push({ label: `${d.getMonth() + 1}월`, start, end });
    }

    return Promise.all(months.map(async (m) => {
      const res = await db
        .select({ total: sql<number>`COALESCE(SUM(${ptPackages.pricePerSession}),0)` })
        .from(ptSessionLogs)
        .leftJoin(ptPackages, eq(ptSessionLogs.packageId, ptPackages.id))
        .where(and(eq(ptSessionLogs.trainerId, trainerId), sql`${ptSessionLogs.sessionDate} >= ${m.start}`, sql`${ptSessionLogs.sessionDate} < ${m.end}`));
      const revenue = Number(res[0]?.total ?? 0);
      return { month: m.label, 매출: revenue, 정산: Math.round(revenue * rate) };
    }));
  }),
});

// ─── Workout Memos ────────────────────────────────────────────────────────────

const workoutMemosRouter = t.router({
  listByMember: protectedProcedure
    .input(z.object({ memberId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = getDb();
      return db.select().from(workoutMemos).where(eq(workoutMemos.memberId, input.memberId)).orderBy(desc(workoutMemos.memoDate));
    }),

  create: protectedProcedure
    .input(z.object({ memberId: z.number(), memoDate: z.string(), content: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const trainerId = ctx.user.trainerId;
      if (!trainerId) throw new TRPCError({ code: "FORBIDDEN" });
      const [row] = await db.insert(workoutMemos).values({ memberId: input.memberId, trainerId, memoDate: input.memoDate, content: input.content }).returning();
      return row;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      await db.delete(workoutMemos).where(eq(workoutMemos.id, input.id));
      return { success: true };
    }),

  update: protectedProcedure
    .input(z.object({ id: z.number(), content: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      await db.update(workoutMemos).set({ content: input.content }).where(eq(workoutMemos.id, input.id));
      return { success: true };
    }),
});

// ─── Attendance Checks ────────────────────────────────────────────────────────

const attendanceChecksRouter = t.router({
  listByDate: protectedProcedure
    .input(z.object({ date: z.string() }))
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const trainerId = ctx.user.trainerId;
      if (!trainerId) throw new TRPCError({ code: "FORBIDDEN" });

      const memberList = await db
        .select({ id: members.id, name: members.name, status: members.status })
        .from(members)
        .where(and(eq(members.trainerId, trainerId), eq(members.status, "active")))
        .orderBy(members.name);

      const checks = await db
        .select()
        .from(attendanceChecks)
        .where(and(eq(attendanceChecks.trainerId, trainerId), eq(attendanceChecks.checkDate, input.date)));

      const pkgRows = await db
        .select({ memberId: ptPackages.memberId, totalSessions: ptPackages.totalSessions, usedSessions: ptPackages.usedSessions })
        .from(ptPackages)
        .where(and(eq(ptPackages.trainerId, trainerId), eq(ptPackages.status, "active")));

      const pkgMap = new Map<number, { remaining: number; total: number }>();
      for (const p of pkgRows) {
        const prev = pkgMap.get(p.memberId);
        const remaining = (p.totalSessions ?? 0) - (p.usedSessions ?? 0);
        if (!prev) pkgMap.set(p.memberId, { remaining, total: p.totalSessions ?? 0 });
        else pkgMap.set(p.memberId, { remaining: prev.remaining + remaining, total: prev.total + (p.totalSessions ?? 0) });
      }

      const checkMap = new Map(checks.map((c) => [c.memberId, c]));
      return memberList.map((m) => ({
        ...m,
        check: checkMap.get(m.id) ?? null,
        remaining: pkgMap.get(m.id)?.remaining ?? null,
        totalSessions: pkgMap.get(m.id)?.total ?? null,
      }));
    }),

  recentSummary: protectedProcedure.query(async ({ ctx }) => {
    const db = getDb();
    const trainerId = ctx.user.trainerId;
    if (!trainerId) throw new TRPCError({ code: "FORBIDDEN" });

    const rows = await db
      .select({ checkDate: attendanceChecks.checkDate })
      .from(attendanceChecks)
      .where(and(eq(attendanceChecks.trainerId, trainerId), eq(attendanceChecks.status, "attended")))
      .orderBy(desc(attendanceChecks.checkDate));

    const grouped: Record<string, number> = {};
    for (const r of rows) grouped[r.checkDate] = (grouped[r.checkDate] ?? 0) + 1;
    return Object.entries(grouped).map(([date, count]) => ({ date, count })).slice(0, 10);
  }),

  listByMember: protectedProcedure
    .input(z.object({ memberId: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      return db.select().from(attendanceChecks).where(eq(attendanceChecks.memberId, input.memberId)).orderBy(desc(attendanceChecks.checkDate));
    }),

  getByMemberDate: protectedProcedure
    .input(z.object({ memberId: z.number(), date: z.string() }))
    .query(async ({ input }) => {
      const db = getDb();
      const rows = await db.select().from(attendanceChecks).where(and(eq(attendanceChecks.memberId, input.memberId), eq(attendanceChecks.checkDate, input.date))).limit(1);
      return rows[0] ?? null;
    }),

  upsert: protectedProcedure
    .input(z.object({
      memberId: z.number(),
      checkDate: z.string(),
      checkTime: z.string().optional(),
      status: z.enum(["attended", "noshow", "cancelled"]).default("attended"),
      conditionScore: z.number().min(1).max(5).optional(),
      sleepHours: z.string().optional(),
      energyLevel: z.string().optional(),
      diet: z.string().optional(),
      painLevel: z.number().min(0).max(10).optional(),
      painArea: z.string().optional(),
      painSide: z.string().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const trainerId = ctx.user.trainerId;
      if (!trainerId) throw new TRPCError({ code: "FORBIDDEN" });

      const { memberId, checkDate, ...fields } = input;
      const existing = await db.select({ id: attendanceChecks.id }).from(attendanceChecks).where(and(eq(attendanceChecks.memberId, memberId), eq(attendanceChecks.checkDate, checkDate))).limit(1);
      const isNew = !existing[0];

      if (existing[0]) {
        await db.update(attendanceChecks).set({ ...fields, updatedAt: sql`now()::text` }).where(eq(attendanceChecks.id, existing[0].id));
      } else {
        await db.insert(attendanceChecks).values({ memberId, trainerId, checkDate, ...fields });
      }

      const existingAtt = await db.select({ id: attendances.id }).from(attendances).where(and(eq(attendances.memberId, memberId), eq(attendances.attendDate, checkDate))).limit(1);
      const attStatus = input.status === "attended" ? "attended" : input.status === "noshow" ? "noshow" : "absent";
      if (existingAtt[0]) {
        await db.update(attendances).set({ status: attStatus }).where(eq(attendances.id, existingAtt[0].id));
      } else {
        await db.insert(attendances).values({ memberId, trainerId, attendDate: checkDate, status: attStatus });
      }

      if (isNew && input.status === "attended") giveAutoPoints(trainerId, "attendance_check", "회원 출석 체크");
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ memberId: z.number(), date: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const trainerId = ctx.user.trainerId;
      if (!trainerId) throw new TRPCError({ code: "FORBIDDEN" });
      await db.delete(attendanceChecks).where(and(eq(attendanceChecks.memberId, input.memberId), eq(attendanceChecks.checkDate, input.date)));
      await db.delete(attendances).where(and(eq(attendances.memberId, input.memberId), eq(attendances.attendDate, input.date)));
      return { success: true };
    }),
});

// ─── PAR-Q ────────────────────────────────────────────────────────────────────

const parQSchema = z.object({
  memberId: z.number(),
  height: z.string().optional(), weight: z.string().optional(), muscleMass: z.string().optional(),
  bodyFatPercent: z.string().optional(), bodyFatKg: z.string().optional(), waistCircumference: z.string().optional(),
  systolicBp: z.string().optional(), diastolicBp: z.string().optional(), totalCholesterol: z.string().optional(),
  hdlCholesterol: z.string().optional(), ldlCholesterol: z.string().optional(), triglycerides: z.string().optional(),
  fastingBloodSugar: z.string().optional(), postMealBloodSugar: z.string().optional(),
  hba1c: z.string().optional(), boneDensity: z.string().optional(),
  occupation: z.string().optional(), workEnvironment: z.string().optional(),
  exerciseExperience: z.string().optional(), visitRoute: z.string().optional(),
  goal1: z.string().optional(), goal2: z.string().optional(), goal3: z.string().optional(),
  dietIssues: z.string().optional(), alcoholIssues: z.string().optional(),
  sleepIssues: z.string().optional(), activityIssues: z.string().optional(),
  chronicDiseases: z.string().optional(), musculoskeletalIssues: z.string().optional(),
  posturalIssues: z.string().optional(),
});

const parQRouter = t.router({
  get: protectedProcedure
    .input(z.object({ memberId: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      const rows = await db.select().from(parQ).where(eq(parQ.memberId, input.memberId)).limit(1);
      return rows[0] ?? null;
    }),

  upsert: protectedProcedure
    .input(parQSchema)
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const { memberId, ...fields } = input;
      const existing = await db.select({ id: parQ.id }).from(parQ).where(eq(parQ.memberId, memberId)).limit(1);
      const isNew = !existing[0];
      if (existing[0]) {
        await db.update(parQ).set({ ...fields, updatedAt: sql`now()::text` }).where(eq(parQ.memberId, memberId));
      } else {
        await db.insert(parQ).values({ memberId, ...fields });
      }
      const trainerId = ctx.user.trainerId;
      if (isNew && trainerId) giveAutoPoints(trainerId, "parq_submit", "PAR-Q 최초 작성");
      return { success: true };
    }),
});

// ─── Reports ─────────────────────────────────────────────────────────────────

const reportsRouter = t.router({
  generate: protectedProcedure
    .input(z.object({ memberId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const trainerId = ctx.user.trainerId;
      if (!trainerId) throw new TRPCError({ code: "FORBIDDEN" });

      const existing = await db.select().from(reportTokens).where(and(eq(reportTokens.memberId, input.memberId), eq(reportTokens.trainerId, trainerId))).limit(1);
      if (existing[0]) return { token: existing[0].token };

      const token = randomUUID().replace(/-/g, "");
      await db.insert(reportTokens).values({ token, memberId: input.memberId, trainerId });
      return { token };
    }),

  regenerate: protectedProcedure
    .input(z.object({ memberId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const trainerId = ctx.user.trainerId;
      if (!trainerId) throw new TRPCError({ code: "FORBIDDEN" });

      await db.delete(reportTokens).where(and(eq(reportTokens.memberId, input.memberId), eq(reportTokens.trainerId, trainerId)));
      const token = randomUUID().replace(/-/g, "");
      await db.insert(reportTokens).values({ token, memberId: input.memberId, trainerId });
      return { token };
    }),

  getPublic: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ input }) => {
      const db = getDb();
      const tokenRows = await db.select().from(reportTokens).where(eq(reportTokens.token, input.token)).limit(1);
      if (!tokenRows[0]) throw new TRPCError({ code: "NOT_FOUND", message: "유효하지 않은 링크입니다." });

      const memberId = tokenRows[0].memberId;
      const reportTrainerId = tokenRows[0].trainerId;
      const [memberRows, checks, memos, packages, attendanceList, sessionLogs] = await Promise.all([
        db.select().from(members).where(eq(members.id, memberId)).limit(1),
        db.select().from(attendanceChecks).where(eq(attendanceChecks.memberId, memberId)).orderBy(desc(attendanceChecks.checkDate)),
        db.select().from(workoutMemos).where(eq(workoutMemos.memberId, memberId)).orderBy(desc(workoutMemos.memoDate)),
        db.select().from(ptPackages).where(eq(ptPackages.memberId, memberId)).orderBy(desc(ptPackages.createdAt)),
        db.select().from(attendances).where(eq(attendances.memberId, memberId)).orderBy(desc(attendances.attendDate)),
        db.select().from(ptSessionLogs).where(eq(ptSessionLogs.memberId, memberId)).orderBy(desc(ptSessionLogs.sessionDate)),
      ]);

      if (!memberRows[0]) throw new TRPCError({ code: "NOT_FOUND" });

      const trainerRow = await pool.query<any>(
        `SELECT "trainerName","profileImage","brandColor","brandMessage","activityArea","jobType" FROM trainers WHERE id=$1`,
        [reportTrainerId]
      );
      const trainerInfo = trainerRow.rows[0] ?? null;

      return {
        member: memberRows[0],
        conditionChecks: checks,
        workoutMemos: memos,
        ptPackages: packages,
        attendances: attendanceList,
        sessionLogs,
        trainerInfo,
        generatedAt: new Date().toISOString(),
      };
    }),
});

// ─── Notices & Banner ────────────────────────────────────────────────────────

const noticesRouter = t.router({
  list: publicProcedure.query(async () => {
    const result = await pool.query<{ id: number; title: string; content: string; isPinned: boolean; isActive: boolean; createdAt: string }>(
      `SELECT id, title, content, "isPinned", "isActive", "createdAt" FROM notices WHERE "isActive" = true ORDER BY "isPinned" DESC, "createdAt" DESC`
    );
    return result.rows;
  }),

  listAll: publicProcedure.query(async () => {
    const result = await pool.query<{ id: number; title: string; content: string; isPinned: boolean; isActive: boolean; createdAt: string }>(
      `SELECT id, title, content, "isPinned", "isActive", "createdAt" FROM notices ORDER BY "isPinned" DESC, "createdAt" DESC`
    );
    return result.rows;
  }),

  create: publicProcedure
    .input(z.object({ title: z.string().min(1), content: z.string().min(1), isPinned: z.boolean().default(false) }))
    .mutation(async ({ input }) => {
      await pool.query(`INSERT INTO notices (title, content, "isPinned") VALUES ($1, $2, $3)`, [input.title, input.content, input.isPinned]);
      return { success: true };
    }),

  update: publicProcedure
    .input(z.object({ id: z.number(), title: z.string().min(1), content: z.string().min(1), isPinned: z.boolean(), isActive: z.boolean() }))
    .mutation(async ({ input }) => {
      await pool.query(`UPDATE notices SET title=$1, content=$2, "isPinned"=$3, "isActive"=$4, "updatedAt"=now()::text WHERE id=$5`,
        [input.title, input.content, input.isPinned, input.isActive, input.id]);
      return { success: true };
    }),

  delete: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await pool.query(`DELETE FROM notices WHERE id=$1`, [input.id]);
      return { success: true };
    }),
});

const bannerRouter = t.router({
  get: publicProcedure.query(async () => {
    const result = await pool.query<{ id: number; text: string; subText: string | null; link: string | null; bgColor: string; isActive: boolean }>(
      `SELECT id, text, "subText", link, "bgColor", "isActive" FROM banners ORDER BY id DESC LIMIT 1`
    );
    return result.rows[0] ?? null;
  }),

  upsert: publicProcedure
    .input(z.object({ text: z.string().min(1), subText: z.string().optional(), link: z.string().optional(), bgColor: z.string().default("#6366f1"), isActive: z.boolean() }))
    .mutation(async ({ input }) => {
      const existing = await pool.query(`SELECT id FROM banners LIMIT 1`);
      if (existing.rows[0]) {
        await pool.query(`UPDATE banners SET text=$1, "subText"=$2, link=$3, "bgColor"=$4, "isActive"=$5, "updatedAt"=now()::text WHERE id=$6`,
          [input.text, input.subText ?? null, input.link ?? null, input.bgColor, input.isActive, existing.rows[0].id]);
      } else {
        await pool.query(`INSERT INTO banners (text, "subText", link, "bgColor", "isActive") VALUES ($1,$2,$3,$4,$5)`,
          [input.text, input.subText ?? null, input.link ?? null, input.bgColor, input.isActive]);
      }
      return { success: true };
    }),
});

const TAB_KEYS = ["all", "dashboard", "pt", "attendance", "leads", "profile"] as const;
type TabKey = typeof TAB_KEYS[number];

type TabBannerRow = { id: number; tabKey: string; text: string; subText: string | null; link: string | null; bgColor: string; isActive: number; imageUrl: string | null; bannerHeight: string; textSize: string; textAlign: string };

const TAB_BANNER_SELECT = `SELECT id, "tabKey", text, "subText", link, "bgColor", "isActive", "imageUrl", "bannerHeight", "textSize", "textAlign" FROM tab_banners`;

const tabBannerRouter = t.router({
  getByTab: publicProcedure
    .input(z.object({ tabKey: z.string() }))
    .query(async ({ input }) => {
      const specific = await pool.query<TabBannerRow>(
        `${TAB_BANNER_SELECT} WHERE "tabKey"=$1 AND "isActive"=1`,
        [input.tabKey]
      );
      if (specific.rows[0]) return specific.rows[0];
      const all = await pool.query<TabBannerRow>(
        `${TAB_BANNER_SELECT} WHERE "tabKey"='all' AND "isActive"=1`
      );
      return all.rows[0] ?? null;
    }),

  listAll: protectedProcedure.query(async () => {
    const result = await pool.query<TabBannerRow>(
      `${TAB_BANNER_SELECT} ORDER BY id ASC`
    );
    return result.rows;
  }),

  upsert: protectedProcedure
    .input(z.object({
      tabKey: z.string(),
      text: z.string(),
      subText: z.string().optional(),
      link: z.string().optional(),
      bgColor: z.string().default("#6366f1"),
      isActive: z.boolean(),
      imageUrl: z.string().optional(),
      bannerHeight: z.string().default("medium"),
      textSize: z.string().default("medium"),
      textAlign: z.string().default("left"),
    }))
    .mutation(async ({ input }) => {
      const existing = await pool.query(`SELECT id FROM tab_banners WHERE "tabKey"=$1`, [input.tabKey]);
      if (existing.rows[0]) {
        await pool.query(
          `UPDATE tab_banners SET text=$1, "subText"=$2, link=$3, "bgColor"=$4, "isActive"=$5, "imageUrl"=$6, "bannerHeight"=$7, "textSize"=$8, "textAlign"=$9, "updatedAt"=now()::text WHERE "tabKey"=$10`,
          [input.text, input.subText ?? null, input.link ?? null, input.bgColor, input.isActive ? 1 : 0, input.imageUrl ?? null, input.bannerHeight, input.textSize, input.textAlign, input.tabKey]
        );
      } else {
        await pool.query(
          `INSERT INTO tab_banners ("tabKey", text, "subText", link, "bgColor", "isActive", "imageUrl", "bannerHeight", "textSize", "textAlign") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [input.tabKey, input.text, input.subText ?? null, input.link ?? null, input.bgColor, input.isActive ? 1 : 0, input.imageUrl ?? null, input.bannerHeight, input.textSize, input.textAlign]
        );
      }
      return { success: true };
    }),
});

// ─── E-Contract ───────────────────────────────────────────────────────────────

const eContractRouter = t.router({
  create: protectedProcedure
    .input(z.object({
      memberName: z.string().optional(),
      memberPhone: z.string().optional(),
      memberBirth: z.string().optional(),
      programName: z.string().optional(),
      programFormat: z.string().optional(),
      programSessions: z.number().optional(),
      listPrice: z.number().optional(),
      discountAmount: z.number().optional(),
      programPrice: z.number().optional(),
      unpaidAmount: z.number().optional(),
      paymentDate: z.string().optional(),
      programStartDate: z.string().optional(),
      programEndDate: z.string().optional(),
      trainerMemo: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const trainerId = (ctx.user as any).trainerId;
      if (!trainerId) throw new TRPCError({ code: "UNAUTHORIZED" });
      const token = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
      await pool.query(
        `INSERT INTO e_contracts ("trainerId", token, "memberName", "memberPhone", "memberBirth",
          "programName", "programFormat", "programSessions", "listPrice", "discountAmount",
          "programPrice", "unpaidAmount", "paymentDate", "programStartDate", "programEndDate", "trainerMemo")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
        [trainerId, token,
         input.memberName ?? null, input.memberPhone ?? null, input.memberBirth ?? null,
         input.programName ?? null, input.programFormat ?? null, input.programSessions ?? null,
         input.listPrice ?? null, input.discountAmount ?? null,
         input.programPrice ?? null, input.unpaidAmount ?? null,
         input.paymentDate ?? null, input.programStartDate ?? null,
         input.programEndDate ?? null, input.trainerMemo ?? null]
      );
      return { token };
    }),

  createRefund: protectedProcedure
    .input(z.object({
      memberName: z.string().optional(),
      memberPhone: z.string().optional(),
      programName: z.string().optional(),
      programPrice: z.number().optional(),
      programSessions: z.number().optional(),
      usedSessions: z.number().optional(),
      refundAmount: z.number().optional(),
      refundReason: z.string().optional(),
      paymentMethod: z.string().optional(),
      vatAmount: z.number().optional(),
      penaltyAmount: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const trainerId = (ctx.user as any).trainerId;
      if (!trainerId) throw new TRPCError({ code: "UNAUTHORIZED" });
      const token = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
      const extra = JSON.stringify({
        usedSessions: input.usedSessions ?? null,
        refundAmount: input.refundAmount ?? null,
        refundReason: input.refundReason ?? null,
        paymentMethod: input.paymentMethod ?? null,
        vatAmount: input.vatAmount ?? null,
        penaltyAmount: input.penaltyAmount ?? null,
      });
      await pool.query(
        `INSERT INTO e_contracts ("trainerId", token, "memberName", "memberPhone",
          "programName", "programPrice", "programSessions", "contractType", "extraData")
         VALUES ($1,$2,$3,$4,$5,$6,$7,'refund',$8)`,
        [trainerId, token, input.memberName ?? null, input.memberPhone ?? null,
         input.programName ?? null, input.programPrice ?? null, input.programSessions ?? null, extra]
      );
      return { token };
    }),

  updateRefund: protectedProcedure
    .input(z.object({
      id: z.number(),
      memberName: z.string().optional(),
      memberPhone: z.string().optional(),
      programName: z.string().optional(),
      programPrice: z.number().optional(),
      programSessions: z.number().optional(),
      usedSessions: z.number().optional(),
      refundAmount: z.number().optional(),
      refundReason: z.string().optional(),
      paymentMethod: z.string().optional(),
      vatAmount: z.number().optional(),
      penaltyAmount: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const trainerId = (ctx.user as any).trainerId;
      const { id, memberName, memberPhone, programName, programPrice, programSessions, ...extraFields } = input;
      const extra = JSON.stringify({
        usedSessions: extraFields.usedSessions ?? null,
        refundAmount: extraFields.refundAmount ?? null,
        refundReason: extraFields.refundReason ?? null,
        paymentMethod: extraFields.paymentMethod ?? null,
        vatAmount: extraFields.vatAmount ?? null,
        penaltyAmount: extraFields.penaltyAmount ?? null,
      });
      await pool.query(
        `UPDATE e_contracts SET "memberName"=$1, "memberPhone"=$2, "programName"=$3,
          "programPrice"=$4, "programSessions"=$5, "extraData"=$6
         WHERE id=$7 AND "trainerId"=$8`,
        [memberName ?? null, memberPhone ?? null, programName ?? null,
         programPrice ?? null, programSessions ?? null, extra, id, trainerId]
      );
      return { success: true };
    }),

  createTransfer: protectedProcedure
    .input(z.object({
      transferorName: z.string().optional(),
      transferorPhone: z.string().optional(),
      programName: z.string().optional(),
      totalSessions: z.number().optional(),
      usedSessions: z.number().optional(),
      remainingSessions: z.number().optional(),
      transferDate: z.string().optional(),
      trainerMemo: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const trainerId = (ctx.user as any).trainerId;
      if (!trainerId) throw new TRPCError({ code: "UNAUTHORIZED" });
      const token = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
      const extra = JSON.stringify({
        transferorName: input.transferorName ?? null,
        transferorPhone: input.transferorPhone ?? null,
        totalSessions: input.totalSessions ?? null,
        usedSessions: input.usedSessions ?? null,
        remainingSessions: input.remainingSessions ?? null,
        transferDate: input.transferDate ?? null,
      });
      await pool.query(
        `INSERT INTO e_contracts ("trainerId", token, "programName", "trainerMemo",
          "contractType", "extraData")
         VALUES ($1,$2,$3,$4,'transfer',$5)`,
        [trainerId, token, input.programName ?? null, input.trainerMemo ?? null, extra]
      );
      return { token };
    }),

  updateTransfer: protectedProcedure
    .input(z.object({
      id: z.number(),
      transferorName: z.string().optional(),
      transferorPhone: z.string().optional(),
      programName: z.string().optional(),
      totalSessions: z.number().optional(),
      usedSessions: z.number().optional(),
      remainingSessions: z.number().optional(),
      transferDate: z.string().optional(),
      trainerMemo: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const trainerId = (ctx.user as any).trainerId;
      const { id, programName, trainerMemo, ...extraFields } = input;
      const extra = JSON.stringify({
        transferorName: extraFields.transferorName ?? null,
        transferorPhone: extraFields.transferorPhone ?? null,
        totalSessions: extraFields.totalSessions ?? null,
        usedSessions: extraFields.usedSessions ?? null,
        remainingSessions: extraFields.remainingSessions ?? null,
        transferDate: extraFields.transferDate ?? null,
      });
      await pool.query(
        `UPDATE e_contracts SET "programName"=$1, "trainerMemo"=$2, "extraData"=$3
         WHERE id=$4 AND "trainerId"=$5`,
        [programName ?? null, trainerMemo ?? null, extra, id, trainerId]
      );
      return { success: true };
    }),

  list: protectedProcedure.query(async ({ ctx }) => {
    const trainerId = (ctx.user as any).trainerId;
    if (!trainerId) throw new TRPCError({ code: "UNAUTHORIZED" });
    const rows = await pool.query<any>(
      `SELECT id, token, "memberName", "memberPhone", "memberBirth", "programName", "programFormat",
              "listPrice", "discountAmount", "programPrice", "unpaidAmount", "paymentDate",
              "programSessions", "programStartDate", "programEndDate", "trainerMemo",
              status, "signedAt", "signerName", "agreedMarketing", "createdAt", "contractType", "extraData"
       FROM e_contracts WHERE "trainerId"=$1 ORDER BY id DESC LIMIT 100`,
      [trainerId]
    );
    return rows.rows;
  }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const trainerId = (ctx.user as any).trainerId;
      await pool.query(`DELETE FROM e_contracts WHERE id=$1 AND "trainerId"=$2`, [input.id, trainerId]);
      return { success: true };
    }),

  // 공개 조회 (인증 없음)
  getPublic: t.procedure
    .input(z.object({ token: z.string() }))
    .query(async ({ input }) => {
      const row = await pool.query<any>(
        `SELECT ec.*, ts."termsOfService", ts."privacyPolicy", ts."marketingConsent",
                t."trainerName", t."profileImage"
         FROM e_contracts ec
         LEFT JOIN trainers t ON t.id = ec."trainerId"
         LEFT JOIN trainer_settings ts ON ts."trainerId" = ec."trainerId"
         WHERE ec.token=$1`,
        [input.token]
      );
      if (!row.rows[0]) throw new TRPCError({ code: "NOT_FOUND" });
      const r = row.rows[0];
      const cType = r.contractType ?? 'standard';
      // transferor_signed 상태 중 transfer 아닌 경우는 비정상
      if (r.status === 'transferor_signed' && cType !== 'transfer') {
        throw new TRPCError({ code: "BAD_REQUEST", message: "already_signed" });
      }
      const extra = (() => { try { return JSON.parse(r.extraData || '{}'); } catch { return {}; } })();
      return {
        token: r.token,
        status: r.status as string,
        contractType: cType as string,
        extraData: extra,
        memberName: r.memberName,
        memberPhone: r.memberPhone,
        memberBirth: r.memberBirth,
        programName: r.programName,
        programFormat: r.programFormat,
        listPrice: r.listPrice,
        discountAmount: r.discountAmount,
        programPrice: r.programPrice,
        unpaidAmount: r.unpaidAmount,
        paymentDate: r.paymentDate,
        programSessions: r.programSessions,
        programStartDate: r.programStartDate,
        programEndDate: r.programEndDate,
        trainerName: r.trainerName,
        trainerMemo: r.trainerMemo,
        transferorSignerName: r.transferorSignerName ?? null,
        transferorSignaturePng: r.transferorSignaturePng ?? null,
        signerName: r.signerName ?? null,
        signaturePng: r.signaturePng ?? null,
        signedAt: r.signedAt ?? null,
        termsOfService: r.termsOfService ?? DEFAULT_TERMS_OF_SERVICE,
        privacyPolicy: r.privacyPolicy ?? DEFAULT_PRIVACY_POLICY,
        marketingConsent: r.marketingConsent ?? DEFAULT_MARKETING_CONSENT,
      };
    }),

  // 서명 제출 (인증 없음)
  submit: t.procedure
    .input(z.object({
      token: z.string(),
      memberName: z.string().optional(),
      memberPhone: z.string().optional(),
      memberBirth: z.string().optional(),
      agreedTerms: z.boolean().optional(),
      agreedPrivacy: z.boolean().optional(),
      agreedMarketing: z.boolean().optional(),
      signerName: z.string().min(1),
      signaturePng: z.string().min(10),
      bankName: z.string().optional(),
      accountNumber: z.string().optional(),
      accountHolder: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const check = await pool.query(
        `SELECT id, status, "contractType" FROM e_contracts WHERE token=$1`, [input.token]
      );
      if (!check.rows[0]) throw new TRPCError({ code: "NOT_FOUND" });
      const cType = check.rows[0].contractType ?? 'standard';
      const status = check.rows[0].status;

      // 양도양수계약서 2단계 처리
      if (cType === 'transfer') {
        if (status === 'pending') {
          // 1단계: 양도인 서명
          await pool.query(
            `UPDATE e_contracts SET status='transferor_signed',
              "transferorSignerName"=$2, "transferorSignaturePng"=$3, "transferorSignedAt"=now()::text
             WHERE token=$1`,
            [input.token, input.signerName, input.signaturePng]
          );
          return { success: true, step: 'transferor_signed' };
        } else if (status === 'transferor_signed') {
          // 2단계: 양수인 서명
          await pool.query(
            `UPDATE e_contracts SET status='signed',
              "memberName"=$2, "memberPhone"=$3,
              "signerName"=$4, "signaturePng"=$5, "signedAt"=now()::text
             WHERE token=$1`,
            [input.token, input.memberName ?? null, input.memberPhone ?? null,
             input.signerName, input.signaturePng]
          );
          return { success: true, step: 'signed' };
        } else {
          throw new TRPCError({ code: "BAD_REQUEST", message: "already_signed" });
        }
      }

      // 일반 / 환불 계약서
      if (status === 'signed') throw new TRPCError({ code: "BAD_REQUEST", message: "already_signed" });
      const isStandard = cType === 'standard';
      if (isStandard && (!input.agreedTerms || !input.agreedPrivacy)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "필수 동의가 필요합니다." });
      }

      // 환불 계약서: 고객이 입력한 계좌 정보를 extraData에 병합
      if (cType === 'refund' && (input.bankName || input.accountNumber || input.accountHolder)) {
        const existingRow = await pool.query(`SELECT "extraData" FROM e_contracts WHERE token=$1`, [input.token]);
        const existingExtra = (() => { try { return JSON.parse(existingRow.rows[0]?.extraData || '{}'); } catch { return {}; } })();
        const mergedExtra = JSON.stringify({
          ...existingExtra,
          bankName: input.bankName ?? existingExtra.bankName ?? null,
          accountNumber: input.accountNumber ?? existingExtra.accountNumber ?? null,
          accountHolder: input.accountHolder ?? existingExtra.accountHolder ?? null,
        });
        await pool.query(
          `UPDATE e_contracts SET status='signed', "memberName"=$2, "memberPhone"=$3,
            "signerName"=$4, "signaturePng"=$5, "signedAt"=now()::text, "extraData"=$6 WHERE token=$1`,
          [input.token, input.memberName ?? null, input.memberPhone ?? null, input.signerName, input.signaturePng, mergedExtra]
        );
        return { success: true, step: 'signed' };
      }

      await pool.query(
        `UPDATE e_contracts SET status='signed', "memberName"=$2, "memberPhone"=$3, "memberBirth"=$4,
          "agreedTerms"=$5, "agreedPrivacy"=$6, "agreedMarketing"=$7,
          "signerName"=$8, "signaturePng"=$9, "signedAt"=now()::text WHERE token=$1`,
        [input.token, input.memberName ?? null, input.memberPhone ?? null, input.memberBirth ?? null,
         input.agreedTerms ? 1 : 0, input.agreedPrivacy ? 1 : 0, input.agreedMarketing ? 1 : 0,
         input.signerName, input.signaturePng]
      );
      return { success: true, step: 'signed' };
    }),

  // 서명된 계약 상세 (트레이너 전용)
  getDetail: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const trainerId = (ctx.user as any).trainerId;
      const row = await pool.query<any>(
        `SELECT * FROM e_contracts WHERE id=$1 AND "trainerId"=$2`, [input.id, trainerId]
      );
      if (!row.rows[0]) throw new TRPCError({ code: "NOT_FOUND" });
      return row.rows[0];
    }),

  // 계약 내용 수정 (트레이너 전용, 서명 전에만 가능)
  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      memberName: z.string().optional(),
      memberPhone: z.string().optional(),
      memberBirth: z.string().optional(),
      programName: z.string().optional(),
      programFormat: z.string().optional(),
      programSessions: z.number().optional(),
      listPrice: z.number().optional(),
      discountAmount: z.number().optional(),
      programPrice: z.number().optional(),
      unpaidAmount: z.number().optional(),
      paymentDate: z.string().optional(),
      programStartDate: z.string().optional(),
      programEndDate: z.string().optional(),
      trainerMemo: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const trainerId = (ctx.user as any).trainerId;
      const { id, ...fields } = input;
      await pool.query(
        `UPDATE e_contracts SET
          "memberName"=$1, "memberPhone"=$2, "memberBirth"=$3,
          "programName"=$4, "programFormat"=$5, "programSessions"=$6,
          "listPrice"=$7, "discountAmount"=$8, "programPrice"=$9, "unpaidAmount"=$10,
          "paymentDate"=$11, "programStartDate"=$12, "programEndDate"=$13, "trainerMemo"=$14
         WHERE id=$15 AND "trainerId"=$16`,
        [
          fields.memberName ?? null, fields.memberPhone ?? null, fields.memberBirth ?? null,
          fields.programName ?? null, fields.programFormat ?? null,
          fields.programSessions ?? null,
          fields.listPrice ?? null, fields.discountAmount ?? null,
          fields.programPrice ?? null, fields.unpaidAmount ?? null,
          fields.paymentDate ?? null, fields.programStartDate ?? null,
          fields.programEndDate ?? null, fields.trainerMemo ?? null,
          id, trainerId,
        ]
      );
      return { success: true };
    }),
});

// ─── Admin ────────────────────────────────────────────────────────────────────

const adminProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.user || ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
  return next({ ctx: { ...ctx, user: ctx.user } });
});

const adminRouter = t.router({
  getSaasStats: adminProcedure.query(async () => {
    const db = getDb();
    const [trainerCount, memberCount, sessionCount] = await Promise.all([
      db.select({ count: sql<number>`COUNT(*)` }).from(trainers),
      db.select({ count: sql<number>`COUNT(*)` }).from(members),
      db.select({ count: sql<number>`COUNT(*)` }).from(ptSessionLogs),
    ]);
    return {
      totalTrainers: Number(trainerCount[0]?.count ?? 0),
      totalMembers: Number(memberCount[0]?.count ?? 0),
      totalSessions: Number(sessionCount[0]?.count ?? 0),
    };
  }),

  listTrainers: adminProcedure.query(async () => {
    const db = getDb();
    const trainerList = await db
      .select({
        id: trainers.id,
        trainerName: trainers.trainerName,
        phone: trainers.phone,
        email: trainers.email,
        createdAt: trainers.createdAt,
        username: users.username,
        lastLoginAt: users.lastLoginAt,
        userId: trainers.userId,
        plan: sql<string>`users."plan"`,
      })
      .from(trainers)
      .leftJoin(users, eq(trainers.userId, users.id))
      .orderBy(desc(trainers.createdAt));

    const withStats = await Promise.all(trainerList.map(async (tr) => {
      const [mc, sc, ac, settingsRow, refRow] = await Promise.all([
        db.select({ count: sql<number>`COUNT(*)` }).from(members).where(eq(members.trainerId, tr.id)),
        db.select({ count: sql<number>`COUNT(*)` }).from(ptSessionLogs).where(eq(ptSessionLogs.trainerId, tr.id)),
        db.select({ count: sql<number>`COUNT(*)` }).from(attendanceChecks).where(eq(attendanceChecks.trainerId, tr.id)),
        db.select({ subscriptionStatus: trainerSettings.settlementRate, adminMemo: sql<string>`"adminMemo"`, subscriptionEndDate: sql<string>`"subscriptionEndDate"`, subStatus: sql<string>`"subscriptionStatus"` })
          .from(trainerSettings).where(eq(trainerSettings.trainerId, tr.id)).limit(1),
        pool.query<{ count: string }>(
          `SELECT COUNT(*) FROM users WHERE "referredBy"=(SELECT "referralCode" FROM users WHERE id=$1)`,
          [tr.userId]
        ),
      ]);
      const lastSession = await db.select({ date: ptSessionLogs.sessionDate }).from(ptSessionLogs).where(eq(ptSessionLogs.trainerId, tr.id)).orderBy(desc(ptSessionLogs.sessionDate)).limit(1);
      return {
        ...tr,
        memberCount: Number(mc[0]?.count ?? 0),
        sessionCount: Number(sc[0]?.count ?? 0),
        attendanceCount: Number(ac[0]?.count ?? 0),
        referralCount: Number(refRow.rows[0]?.count ?? 0),
        lastActivityDate: lastSession[0]?.date ?? null,
        subscriptionStatus: (settingsRow[0] as any)?.subStatus ?? "trial",
        subscriptionEndDate: (settingsRow[0] as any)?.subscriptionEndDate ?? null,
        adminMemo: (settingsRow[0] as any)?.adminMemo ?? null,
      };
    }));
    return withStats;
  }),

  getTrainer: adminProcedure
    .input(z.object({ trainerId: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      const [tr] = await db
        .select({ id: trainers.id, trainerName: trainers.trainerName, phone: trainers.phone, email: trainers.email, createdAt: trainers.createdAt, username: users.username, lastLoginAt: users.lastLoginAt, userId: trainers.userId, position: users.position, plan: sql<string>`users."plan"` })
        .from(trainers).leftJoin(users, eq(trainers.userId, users.id)).where(eq(trainers.id, input.trainerId)).limit(1);
      if (!tr) throw new TRPCError({ code: "NOT_FOUND" });

      const [mc, sc, ac, settingsRow] = await Promise.all([
        db.select({ count: sql<number>`COUNT(*)` }).from(members).where(eq(members.trainerId, tr.id)),
        db.select({ count: sql<number>`COUNT(*)` }).from(ptSessionLogs).where(eq(ptSessionLogs.trainerId, tr.id)),
        db.select({ count: sql<number>`COUNT(*)` }).from(attendanceChecks).where(eq(attendanceChecks.trainerId, tr.id)),
        db.select({ subStatus: sql<string>`"subscriptionStatus"`, adminMemo: sql<string>`"adminMemo"`, subscriptionEndDate: sql<string>`"subscriptionEndDate"` })
          .from(trainerSettings).where(eq(trainerSettings.trainerId, tr.id)).limit(1),
      ]);
      const lastSession = await db.select({ date: ptSessionLogs.sessionDate }).from(ptSessionLogs).where(eq(ptSessionLogs.trainerId, tr.id)).orderBy(desc(ptSessionLogs.sessionDate)).limit(1);

      return {
        ...tr,
        memberCount: Number(mc[0]?.count ?? 0),
        sessionCount: Number(sc[0]?.count ?? 0),
        attendanceCount: Number(ac[0]?.count ?? 0),
        lastActivityDate: lastSession[0]?.date ?? null,
        subscriptionStatus: (settingsRow[0] as any)?.subStatus ?? "trial",
        subscriptionEndDate: (settingsRow[0] as any)?.subscriptionEndDate ?? null,
        adminMemo: (settingsRow[0] as any)?.adminMemo ?? null,
      };
    }),

  updateTrainer: adminProcedure
    .input(z.object({
      trainerId: z.number(),
      trainerName: z.string().optional(),
      phone: z.string().optional().nullable(),
      email: z.string().optional().nullable(),
      subscriptionStatus: z.enum(["trial", "active", "expired", "suspended"]).optional(),
      subscriptionEndDate: z.string().optional().nullable(),
      adminMemo: z.string().optional().nullable(),
      plan: z.enum(["free", "pro", "elite"]).optional(),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const { trainerId, plan, trainerName, phone, email, ...fields } = input;
      // trainers 테이블 업데이트
      const trainerFields: Record<string, any> = {};
      if (trainerName !== undefined) trainerFields.trainerName = trainerName;
      if (phone !== undefined) trainerFields.phone = phone;
      if (email !== undefined) trainerFields.email = email;
      if (Object.keys(trainerFields).length > 0) {
        await db.update(trainers).set(trainerFields).where(eq(trainers.id, trainerId));
      }
      const setParts: Record<string, any> = {};
      if (fields.subscriptionStatus !== undefined) setParts['"subscriptionStatus"'] = fields.subscriptionStatus;
      if (fields.subscriptionEndDate !== undefined) setParts['"subscriptionEndDate"'] = fields.subscriptionEndDate;
      if (fields.adminMemo !== undefined) setParts['"adminMemo"'] = fields.adminMemo;
      if (Object.keys(setParts).length > 0) {
        const cols = Object.keys(setParts).map((k, i) => `${k} = $${i + 2}`).join(", ");
        const vals = Object.values(setParts);
        await pool.query(`UPDATE trainer_settings SET ${cols} WHERE "trainerId" = $1`, [trainerId, ...vals]);
      }
      if (plan !== undefined) {
        await pool.query(`UPDATE users SET "plan" = $1 WHERE id = (SELECT "userId" FROM trainers WHERE id = $2)`, [plan, trainerId]);
      }
      return { success: true };
    }),

  toggleUserActive: adminProcedure
    .input(z.object({ userId: z.number(), active: z.boolean() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.update(users).set({ position: input.active ? null : "suspended" }).where(eq(users.id, input.userId));
      return { success: true };
    }),

  deleteTrainer: adminProcedure
    .input(z.object({ userId: z.number().optional(), trainerId: z.number().optional() }))
    .mutation(async ({ input }) => {
      // trainerId 직접 전달 또는 userId로 조회 (고아 레코드 처리 포함)
      let trainerId = input.trainerId;
      if (!trainerId && input.userId) {
        const trainerRow = await pool.query<{ id: number }>(
          `SELECT id FROM trainers WHERE "userId" = $1 LIMIT 1`, [input.userId]
        );
        trainerId = trainerRow.rows[0]?.id;
      }
      if (trainerId) {
        // FIT STEP+ 관련
        await pool.query(`DELETE FROM fit_step_plus_attendance WHERE "trainerId" = $1`, [trainerId]);
        const fspMembers = await pool.query<{ id: number }>(`SELECT id FROM fit_step_plus_members WHERE "trainerId" = $1`, [trainerId]);
        for (const m of fspMembers.rows) {
          await pool.query(`DELETE FROM fit_step_plus_workout_logs WHERE "fitStepPlusMemberId" = $1`, [m.id]);
        }
        await pool.query(`DELETE FROM fit_step_plus_members WHERE "trainerId" = $1`, [trainerId]);
        await pool.query(`DELETE FROM fit_step_plus_videos WHERE "trainerId" = $1`, [trainerId]);
        await pool.query(`DELETE FROM fit_step_plus_video_categories WHERE "trainerId" = $1`, [trainerId]);
        await pool.query(`DELETE FROM fit_step_plus_events WHERE "trainerId" = $1`, [trainerId]);
        // 트레이너 데이터
        await pool.query(`DELETE FROM fit_point_logs WHERE "trainerId" = $1`, [trainerId]);
        await pool.query(`DELETE FROM workout_templates WHERE "trainerId" = $1`, [trainerId]);
        await pool.query(`DELETE FROM report_tokens WHERE "trainerId" = $1`, [trainerId]);
        await pool.query(`DELETE FROM attendance_checks WHERE "trainerId" = $1`, [trainerId]);
        await pool.query(`DELETE FROM attendances WHERE "trainerId" = $1`, [trainerId]);
        await pool.query(`DELETE FROM schedules WHERE "trainerId" = $1`, [trainerId]);
        await pool.query(`DELETE FROM workout_memos WHERE "trainerId" = $1`, [trainerId]);
        await pool.query(`DELETE FROM payments WHERE "trainerId" = $1`, [trainerId]);
        await pool.query(`DELETE FROM pt_session_logs WHERE "trainerId" = $1`, [trainerId]);
        // pt_pauses는 packageId 기준이므로 pt_packages 삭제 전에 처리
        const pkgs = await pool.query<{ id: number }>(`SELECT id FROM pt_packages WHERE "trainerId" = $1`, [trainerId]);
        for (const pkg of pkgs.rows) {
          await pool.query(`DELETE FROM pt_pauses WHERE "packageId" = $1`, [pkg.id]);
        }
        await pool.query(`DELETE FROM pt_packages WHERE "trainerId" = $1`, [trainerId]);
        // 회원의 par_q 삭제 후 회원 삭제
        const memberRows = await pool.query<{ id: number }>(`SELECT id FROM members WHERE "trainerId" = $1`, [trainerId]);
        for (const mem of memberRows.rows) {
          await pool.query(`DELETE FROM par_q WHERE "memberId" = $1`, [mem.id]);
        }
        await pool.query(`DELETE FROM members WHERE "trainerId" = $1`, [trainerId]);
        await pool.query(`DELETE FROM leads WHERE "trainerId" = $1`, [trainerId]);
        await pool.query(`DELETE FROM trainer_settings WHERE "trainerId" = $1`, [trainerId]);
        await pool.query(`DELETE FROM trainers WHERE id = $1`, [trainerId]);
      }
      if (input.userId) {
        await pool.query(`DELETE FROM users WHERE id = $1`, [input.userId]);
      }
      return { success: true };
    }),

  grantPoints: adminProcedure
    .input(z.object({ trainerId: z.number(), amount: z.number(), memo: z.string().optional(), expiresAt: z.string().optional() }))
    .mutation(async ({ input }) => {
      await pool.query(
        `INSERT INTO fit_point_logs ("trainerId", amount, type, memo, status, "expiresAt") VALUES ($1,$2,'admin_grant',$3,'completed',$4)`,
        [input.trainerId, input.amount, input.memo ?? null, input.expiresAt ?? null]
      );
      return { success: true };
    }),

  getTrainerPoints: adminProcedure
    .input(z.object({ trainerId: z.number() }))
    .query(async ({ input }) => {
      const bal = await pool.query<{ balance: string }>(
        `SELECT COALESCE(SUM(amount),0) AS balance FROM fit_point_logs WHERE "trainerId"=$1 AND status='completed' AND ("expiresAt" IS NULL OR "expiresAt" > CURRENT_DATE::text)`,
        [input.trainerId]
      );
      const logs = await pool.query<{ id: number; amount: number; type: string; memo: string | null; status: string; createdAt: string; expiresAt: string | null }>(
        `SELECT id, amount, type, memo, status, "createdAt", "expiresAt" FROM fit_point_logs WHERE "trainerId"=$1 ORDER BY id DESC LIMIT 30`,
        [input.trainerId]
      );
      return { balance: Number(bal.rows[0]?.balance ?? 0), logs: logs.rows };
    }),

  approveChargeRequest: adminProcedure
    .input(z.object({ logId: z.number(), approve: z.boolean() }))
    .mutation(async ({ input }) => {
      const status = input.approve ? "completed" : "rejected";
      await pool.query(`UPDATE fit_point_logs SET status=$1 WHERE id=$2`, [status, input.logId]);
      return { success: true };
    }),

  // ── 가입 관리 ──
  getRegistrations: adminProcedure.query(async () => {
    const result = await pool.query<{
      userId: number; trainerId: number; username: string; trainerName: string;
      phone: string | null; email: string | null; position: string | null; createdAt: string;
    }>(`
      SELECT u.id AS "userId", t.id AS "trainerId", u.username, t."trainerName",
             t.phone, t.email, u.position, t."createdAt"
      FROM users u
      JOIN trainers t ON t."userId" = u.id
      WHERE u.position IN ('pending','rejected') OR (u.role='trainer' AND u.position IS NULL)
      ORDER BY
        CASE u.position WHEN 'pending' THEN 0 WHEN NULL THEN 1 ELSE 2 END,
        t."createdAt" DESC
    `);
    return result.rows;
  }),

  approveRegistration: adminProcedure
    .input(z.object({ userId: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.update(users).set({ position: null }).where(eq(users.id, input.userId));

      // 초대 보너스 지급 (승인 시 1회)
      try {
        const refRow = await pool.query<{ referredBy: string | null }>(`SELECT "referredBy" FROM users WHERE id=$1`, [input.userId]);
        const referredBy = refRow.rows[0]?.referredBy;
        const newTrainerRow = await pool.query<{ id: number }>(`SELECT id FROM trainers WHERE "userId"=$1`, [input.userId]);
        const newTrainerId = newTrainerRow.rows[0]?.id;
        if (referredBy && newTrainerId) {
          // 이미 지급 여부 확인
          const alreadyGranted = await pool.query(`SELECT id FROM fit_point_logs WHERE "trainerId"=$1 AND type='referral_bonus'`, [newTrainerId]);
          if (alreadyGranted.rows.length === 0) {
            // 피초대자(새 트레이너)에게 500P
            await pool.query(`INSERT INTO fit_point_logs ("trainerId",amount,type,memo,status) VALUES($1,500,'referral_bonus','친구 초대 수락 보너스','completed')`, [newTrainerId]);
            // 초대자: 최대 3명까지만 지급
            const referrerRow = await pool.query<{ id: number }>(`SELECT t.id FROM trainers t JOIN users u ON u.id=t."userId" WHERE u."referralCode"=$1`, [referredBy]);
            const referrerId = referrerRow.rows[0]?.id;
            if (referrerId) {
              const referrerGrantCount = await pool.query<{ count: string }>(`SELECT COUNT(*) FROM fit_point_logs WHERE "trainerId"=$1 AND type='referral_bonus' AND memo='친구 초대 보너스'`, [referrerId]);
              if (Number(referrerGrantCount.rows[0]?.count ?? 0) < 3) {
                await pool.query(`INSERT INTO fit_point_logs ("trainerId",amount,type,memo,status) VALUES($1,500,'referral_bonus','친구 초대 보너스','completed')`, [referrerId]);
              }
            }
          }
        }
      } catch (e) {
        console.warn("초대 보너스 지급 실패:", e);
      }

      return { success: true };
    }),

  rejectRegistration: adminProcedure
    .input(z.object({ userId: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.update(users).set({ position: "rejected" }).where(eq(users.id, input.userId));
      return { success: true };
    }),

  // ── 포인트 관리 ──
  listTrainersWithPoints: adminProcedure.query(async () => {
    const result = await pool.query<{
      trainerId: number; trainerName: string; username: string;
      balance: string; pendingAmount: string;
    }>(`
      SELECT t.id AS "trainerId", t."trainerName", u.username,
        COALESCE(SUM(CASE WHEN l.status='completed' AND (l."expiresAt" IS NULL OR l."expiresAt" > CURRENT_DATE::text) THEN l.amount ELSE 0 END),0) AS balance,
        COALESCE(SUM(CASE WHEN l.status='pending' THEN l.amount ELSE 0 END),0) AS "pendingAmount"
      FROM trainers t
      JOIN users u ON u.id = t."userId"
      LEFT JOIN fit_point_logs l ON l."trainerId" = t.id
      GROUP BY t.id, t."trainerName", u.username
      ORDER BY t."trainerName"
    `);
    return result.rows.map(r => ({ ...r, balance: Number(r.balance), pendingAmount: Number(r.pendingAmount) }));
  }),

  getAutoRules: adminProcedure.query(async () => {
    const result = await pool.query<{
      id: number; event: string; label: string; description: string | null;
      amount: number; isEnabled: number; updatedAt: string;
    }>(`SELECT * FROM point_auto_rules ORDER BY id`);
    return result.rows;
  }),

  updateAutoRule: adminProcedure
    .input(z.object({
      event: z.string(),
      label: z.string().min(1).optional(),
      description: z.string().optional(),
      amount: z.number().int().min(0),
      isEnabled: z.boolean(),
    }))
    .mutation(async ({ input }) => {
      await pool.query(
        `UPDATE point_auto_rules SET amount=$1, "isEnabled"=$2, label=COALESCE($3,label), description=COALESCE($4,description), "updatedAt"=now()::text WHERE event=$5`,
        [input.amount, input.isEnabled ? 1 : 0, input.label ?? null, input.description ?? null, input.event]
      );
      return { success: true };
    }),

  createAutoRule: adminProcedure
    .input(z.object({
      label: z.string().min(1),
      description: z.string().optional(),
      amount: z.number().int().min(0),
    }))
    .mutation(async ({ input }) => {
      const event = `custom_${Date.now()}`;
      await pool.query(
        `INSERT INTO point_auto_rules (event, label, description, amount, "isEnabled") VALUES ($1,$2,$3,$4,1)`,
        [event, input.label, input.description ?? null, input.amount]
      );
      return { success: true };
    }),

  deleteAutoRule: adminProcedure
    .input(z.object({ event: z.string() }))
    .mutation(async ({ input }) => {
      await pool.query(`DELETE FROM point_auto_rules WHERE event=$1`, [input.event]);
      return { success: true };
    }),

  getFeatureCostRules: adminProcedure.query(async () => {
    const rows = await pool.query<{ feature: string; label: string; cost: number; isEnabled: number }>(
      `SELECT feature, label, cost, "isEnabled" FROM feature_cost_rules ORDER BY feature`
    );
    return rows.rows;
  }),

  updateFeatureCostRule: adminProcedure
    .input(z.object({ feature: z.string(), cost: z.number().int().min(0), isEnabled: z.boolean() }))
    .mutation(async ({ input }) => {
      await pool.query(
        `UPDATE feature_cost_rules SET cost=$1, "isEnabled"=$2, "updatedAt"=now()::text WHERE feature=$3`,
        [input.cost, input.isEnabled ? 1 : 0, input.feature]
      );
      return { success: true };
    }),

  // ── 작업실 기능 사용 현황 ─────────────────────────────────────────────────
  getWorkshopAllStats: adminProcedure.query(async () => {
    const rows = await pool.query<any>(`
      SELECT
        t.id,
        t."trainerName",
        u.username,
        COALESCE(u.plan, 'free') AS plan,
        t."brandIsPublic",
        t."brandBio",
        t."brandColor",
        t."bookingEnabled",
        COALESCE(fsp.cnt, 0)::int AS fsp_count,
        fsp.last_added AS fsp_last_added,
        COALESCE(wt.cnt, 0)::int AS template_count,
        COALESCE(sq.cnt, 0)::int AS survey_question_count,
        COALESCE(sr.cnt, 0)::int AS survey_response_count,
        COALESCE(cb.cnt, 0)::int AS booking_count,
        COALESCE(cb.pending_cnt, 0)::int AS booking_pending,
        cb.last_booking,
        CASE WHEN ts."termsOfService" IS NOT NULL THEN true ELSE false END AS has_custom_terms,
        ts."workshopTrialStartedAt",
        CASE WHEN wu_access.id IS NOT NULL THEN true ELSE false END AS workshop_activated
      FROM trainers t
      LEFT JOIN users u ON u.id = t."userId"
      LEFT JOIN workshop_unlocks wu_access ON t.id = wu_access."trainerId" AND wu_access.feature = 'workshop_access'
      LEFT JOIN (
        SELECT "trainerId", COUNT(*) AS cnt, MAX("createdAt") AS last_added
        FROM fit_step_plus_members GROUP BY "trainerId"
      ) fsp ON t.id = fsp."trainerId"
      LEFT JOIN (
        SELECT "trainerId", COUNT(*) AS cnt FROM workout_templates GROUP BY "trainerId"
      ) wt ON t.id = wt."trainerId"
      LEFT JOIN (
        SELECT "trainerId", COUNT(*) AS cnt FROM custom_survey_questions GROUP BY "trainerId"
      ) sq ON t.id = sq."trainerId"
      LEFT JOIN (
        SELECT "trainerId", COUNT(*) AS cnt FROM custom_survey_responses GROUP BY "trainerId"
      ) sr ON t.id = sr."trainerId"
      LEFT JOIN (
        SELECT "trainerId", COUNT(*) AS cnt,
          SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END)::int AS pending_cnt,
          MAX("createdAt") AS last_booking
        FROM consultation_bookings GROUP BY "trainerId"
      ) cb ON t.id = cb."trainerId"
      LEFT JOIN trainer_settings ts ON t.id = ts."trainerId"
      ORDER BY t."trainerName"
    `);
    return rows.rows;
  }),

  getTrainerFspDetail: adminProcedure
    .input(z.object({ trainerId: z.number() }))
    .query(async ({ input }) => {
      const rows = await pool.query<any>(
        `SELECT id, name, phone, username, "membershipType", "membershipStart", "membershipEnd", "createdAt"
         FROM fit_step_plus_members WHERE "trainerId"=$1 ORDER BY "createdAt" DESC`,
        [input.trainerId]
      );
      return rows.rows;
    }),

  getTrainerBookingsDetail: adminProcedure
    .input(z.object({ trainerId: z.number() }))
    .query(async ({ input }) => {
      const rows = await pool.query<any>(
        `SELECT id, name, phone, "interestType", message, status, "createdAt"
         FROM consultation_bookings WHERE "trainerId"=$1 ORDER BY id DESC LIMIT 50`,
        [input.trainerId]
      );
      return rows.rows;
    }),

  getTrainerTemplatesDetail: adminProcedure
    .input(z.object({ trainerId: z.number() }))
    .query(async ({ input }) => {
      const rows = await pool.query<any>(
        `SELECT id, name, "bodyPart", description, "exercisesJson", "createdAt"
         FROM workout_templates WHERE "trainerId"=$1 ORDER BY id DESC`,
        [input.trainerId]
      );
      return rows.rows;
    }),

  getTrainerSurveyDetail: adminProcedure
    .input(z.object({ trainerId: z.number() }))
    .query(async ({ input }) => {
      const [qRows, rRows] = await Promise.all([
        pool.query<any>(`SELECT * FROM custom_survey_questions WHERE "trainerId"=$1 ORDER BY "sortOrder", id`, [input.trainerId]),
        pool.query<any>(`SELECT * FROM custom_survey_responses WHERE "trainerId"=$1 ORDER BY id DESC LIMIT 30`, [input.trainerId]),
      ]);
      return { questions: qRows.rows, responses: rRows.rows };
    }),

  getTrainerContractDetail: adminProcedure
    .input(z.object({ trainerId: z.number() }))
    .query(async ({ input }) => {
      const row = await pool.query<any>(
        `SELECT "termsOfService", "privacyPolicy", "marketingConsent" FROM trainer_settings WHERE "trainerId"=$1`,
        [input.trainerId]
      );
      return row.rows[0] ?? null;
    }),

  getTrainerMembersDetail: adminProcedure
    .input(z.object({ trainerId: z.number() }))
    .query(async ({ input }) => {
      const rows = await pool.query<any>(
        `SELECT m.id, m.name, m.phone, m.gender, m.status, m."membershipStart", m."membershipEnd", m."createdAt",
                COALESCE(p.total, 0) AS "totalSessions", COALESCE(p.used, 0) AS "usedSessions",
                COALESCE(p.total - p.used, 0) AS "remainingSessions"
         FROM members m
         LEFT JOIN LATERAL (
           SELECT SUM("totalSessions") AS total, SUM("usedSessions") AS used
           FROM pt_packages WHERE "memberId" = m.id AND status = 'active'
         ) p ON true
         WHERE m."trainerId" = $1
         ORDER BY m."createdAt" DESC`,
        [input.trainerId]
      );
      return rows.rows;
    }),

  getTrainerSessionsDetail: adminProcedure
    .input(z.object({ trainerId: z.number() }))
    .query(async ({ input }) => {
      const rows = await pool.query<any>(
        `SELECT sl.id, sl."sessionDate", sl."bodyPart", sl.feedback, sl."createdAt",
                m.name AS "memberName"
         FROM pt_session_logs sl
         LEFT JOIN members m ON m.id = sl."memberId"
         WHERE sl."trainerId" = $1
         ORDER BY sl."sessionDate" DESC, sl."createdAt" DESC
         LIMIT 100`,
        [input.trainerId]
      );
      return rows.rows;
    }),

  getTrainerAttendancesDetail: adminProcedure
    .input(z.object({ trainerId: z.number() }))
    .query(async ({ input }) => {
      const rows = await pool.query<any>(
        `SELECT ac.id, ac."checkDate", ac."conditionScore", ac."sleepHours", ac."energyLevel",
                ac."painLevel", ac."painArea", ac."createdAt",
                m.name AS "memberName"
         FROM attendance_checks ac
         LEFT JOIN members m ON m.id = ac."memberId"
         WHERE ac."trainerId" = $1
         ORDER BY ac."checkDate" DESC, ac."createdAt" DESC
         LIMIT 100`,
        [input.trainerId]
      );
      return rows.rows;
    }),

  listSurveyResponses: adminProcedure.query(async () => {
    const rows = await pool.query<{
      id: number; trainerName: string | null; phone: string | null; email: string | null;
      createdAt: string; onboardingSurveyData: string | null; onboardingSurveyDone: number;
    }>(
      `SELECT t.id, t."trainerName", t.phone, t.email, t."createdAt",
              t."onboardingSurveyData", t."onboardingSurveyDone"
       FROM trainers t
       WHERE t."onboardingSurveyDone" = 1
       ORDER BY t."createdAt" DESC`
    );
    return rows.rows.map(r => ({
      ...r,
      answers: r.onboardingSurveyData ? JSON.parse(r.onboardingSurveyData) as Record<string, string[]> : {},
    }));
  }),

  // ── 작업실 관리 콘솔 ─────────────────────────────────────────────────────────
  getWorkshopConsole: adminProcedure.query(async () => {
    const rows = await pool.query<any>(`
      SELECT
        t.id, t."trainerName", u.username, COALESCE(u.plan, 'free') AS plan,
        t."brandIsPublic", t."brandBio", t."brandColor", t."bookingEnabled",
        COALESCE(fsp.cnt, 0)::int AS fsp_count,
        COALESCE(wt.cnt, 0)::int AS template_count,
        COALESCE(sq.cnt, 0)::int AS survey_question_count,
        COALESCE(sr.cnt, 0)::int AS survey_response_count,
        COALESCE(cb.cnt, 0)::int AS booking_count,
        CASE WHEN ts."termsOfService" IS NOT NULL THEN true ELSE false END AS has_custom_terms,
        ts."workshopTrialStartedAt",
        CASE WHEN wu.id IS NOT NULL THEN true ELSE false END AS workshop_activated,
        COALESCE(pts.balance, 0)::int AS points_balance
      FROM trainers t
      LEFT JOIN users u ON u.id = t."userId"
      LEFT JOIN workshop_unlocks wu ON t.id = wu."trainerId" AND wu.feature = 'workshop_access'
      LEFT JOIN (SELECT "trainerId", COUNT(*) cnt FROM fit_step_plus_members GROUP BY "trainerId") fsp ON t.id = fsp."trainerId"
      LEFT JOIN (SELECT "trainerId", COUNT(*) cnt FROM workout_templates GROUP BY "trainerId") wt ON t.id = wt."trainerId"
      LEFT JOIN (SELECT "trainerId", COUNT(*) cnt FROM custom_survey_questions GROUP BY "trainerId") sq ON t.id = sq."trainerId"
      LEFT JOIN (SELECT "trainerId", COUNT(*) cnt FROM custom_survey_responses GROUP BY "trainerId") sr ON t.id = sr."trainerId"
      LEFT JOIN (SELECT "trainerId", COUNT(*) cnt FROM consultation_bookings GROUP BY "trainerId") cb ON t.id = cb."trainerId"
      LEFT JOIN trainer_settings ts ON t.id = ts."trainerId"
      LEFT JOIN (
        SELECT "trainerId", SUM(amount) balance FROM fit_point_logs
        WHERE status='completed' AND ("expiresAt" IS NULL OR "expiresAt" > CURRENT_DATE::text)
        GROUP BY "trainerId"
      ) pts ON t.id = pts."trainerId"
      ORDER BY t."trainerName"
    `);
    const now = new Date();
    const TRIAL_DAYS = 30, GRACE_DAYS = 2;
    const trainers = rows.rows.map((r: any) => {
      let wsStatus = 'unopened', daysRemaining: number | null = null;
      if (r.workshop_activated) {
        wsStatus = 'active';
      } else if (r.workshopTrialStartedAt) {
        const started = new Date(r.workshopTrialStartedAt);
        const daysSince = Math.floor((now.getTime() - started.getTime()) / (1000 * 60 * 60 * 24));
        if (daysSince <= TRIAL_DAYS) { wsStatus = 'trial'; daysRemaining = TRIAL_DAYS - daysSince; }
        else if (daysSince <= TRIAL_DAYS + GRACE_DAYS) { wsStatus = 'grace'; daysRemaining = TRIAL_DAYS + GRACE_DAYS - daysSince; }
        else wsStatus = 'locked';
      }
      return { ...r, wsStatus, daysRemaining };
    });
    const cfgRows = await pool.query<any>(`SELECT * FROM workshop_feature_config`);
    const revenueRow = await pool.query<{ total: string }>(
      `SELECT COALESCE(SUM(ABS(amount)), 0) AS total FROM fit_point_logs WHERE type='workshop_unlock' AND amount < 0 AND status='completed'`
    );
    return {
      trainers,
      featureConfigs: cfgRows.rows as { featureId: string; status: string; adminNote: string | null }[],
      unlockRevenue: Number(revenueRow.rows[0]?.total ?? 0),
      summary: {
        total: trainers.length,
        unopened: trainers.filter((t: any) => t.wsStatus === 'unopened').length,
        trial: trainers.filter((t: any) => t.wsStatus === 'trial').length,
        grace: trainers.filter((t: any) => t.wsStatus === 'grace').length,
        locked: trainers.filter((t: any) => t.wsStatus === 'locked').length,
        active: trainers.filter((t: any) => t.wsStatus === 'active').length,
      }
    };
  }),

  getWorkshopPointLog: adminProcedure.query(async () => {
    const rows = await pool.query<any>(`
      SELECT l.id, l."trainerId", l.amount, l.type, l.memo, l.status, l."createdAt",
             t."trainerName"
      FROM fit_point_logs l
      LEFT JOIN trainers t ON l."trainerId" = t.id
      WHERE l.type = 'workshop_unlock' OR (l.type = 'admin_grant' AND l.memo LIKE '%작업실%')
      ORDER BY l.id DESC LIMIT 300
    `);
    return rows.rows;
  }),

  updateWorkshopFeatureConfig: adminProcedure
    .input(z.object({
      featureId: z.string(),
      status: z.enum(["active", "coming_soon", "addon_fsp", "addon_premium", "hidden"]),
      adminNote: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const note = input.adminNote ?? null;
      const upd = await pool.query(
        `UPDATE workshop_feature_config SET status=$2, "adminNote"=$3, "updatedAt"=now()::text WHERE "featureId"=$1`,
        [input.featureId, input.status, note]
      );
      if ((upd.rowCount ?? 0) === 0) {
        await pool.query(
          `INSERT INTO workshop_feature_config ("featureId", status, "adminNote", "updatedAt") VALUES ($1, $2, $3, now()::text)`,
          [input.featureId, input.status, note]
        );
      }
      // DB에서 SELECT해서 실제 저장값 검증 후 반환
      const verified = await pool.query<{ status: string }>(
        `SELECT status FROM workshop_feature_config WHERE "featureId"=$1`,
        [input.featureId]
      );
      const savedStatus = verified.rows[0]?.status;
      if (!savedStatus) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "저장 확인 실패" });
      if (savedStatus !== input.status) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `DB 저장 불일치: 요청=${input.status}, 실제=${savedStatus}` });
      return { success: true, featureId: input.featureId, savedStatus };
    }),

  bulkUpdateWorkshopFeatureConfig: adminProcedure
    .input(z.object({
      featureIds: z.array(z.string()).min(1),
      status: z.enum(["active", "coming_soon"]),
    }))
    .mutation(async ({ input }) => {
      for (const featureId of input.featureIds) {
        const upd = await pool.query(
          `UPDATE workshop_feature_config SET status=$2, "updatedAt"=now()::text WHERE "featureId"=$1`,
          [featureId, input.status]
        );
        if ((upd.rowCount ?? 0) === 0) {
          await pool.query(
            `INSERT INTO workshop_feature_config ("featureId", status, "updatedAt") VALUES ($1, $2, now()::text)`,
            [featureId, input.status]
          );
        }
      }
      return { success: true, updated: input.featureIds.length };
    }),

  grantWorkshopAccess: adminProcedure
    .input(z.object({ trainerId: z.number(), memo: z.string().optional() }))
    .mutation(async ({ input }) => {
      await pool.query(`
        INSERT INTO workshop_unlocks ("trainerId", feature, "pointsSpent")
        VALUES ($1, 'workshop_access', 0)
        ON CONFLICT ("trainerId", feature) DO NOTHING
      `, [input.trainerId]);
      await pool.query(
        `INSERT INTO fit_point_logs ("trainerId", amount, type, memo, status) VALUES ($1, 0, 'admin_grant', $2, 'completed')`,
        [input.trainerId, input.memo ?? '관리자 수동 작업실 활성화']
      );
      return { success: true };
    }),

  revokeWorkshopAccess: adminProcedure
    .input(z.object({ trainerId: z.number() }))
    .mutation(async ({ input }) => {
      await pool.query(`DELETE FROM workshop_unlocks WHERE "trainerId"=$1 AND feature='workshop_access'`, [input.trainerId]);
      return { success: true };
    }),
});

// ─── Channels Router ──────────────────────────────────────────────────────────

const channelsRouter = t.router({
  list: protectedProcedure.query(async () => {
    const db = getDb();
    return db.select().from(channels).where(eq(channels.isActive, 1)).orderBy(channels.name);
  }),
  create: protectedProcedure
    .input(z.object({ name: z.string(), type: z.string().optional(), description: z.string().optional() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const [row] = await db.insert(channels).values({ name: input.name, type: input.type ?? "online", description: input.description }).returning();
      return row;
    }),
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.update(channels).set({ isActive: 0 }).where(eq(channels.id, input.id));
    }),
});

// ─── Leads Router ─────────────────────────────────────────────────────────────

const leadsRouter = t.router({
  list: protectedProcedure
    .input(z.object({ year: z.number().optional(), month: z.number().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const trainerId = ctx.user.trainerId;
      if (!trainerId) throw new TRPCError({ code: "FORBIDDEN" });
      const db = getDb();
      const rows = await db
        .select({ lead: leads, channelName: channels.name })
        .from(leads)
        .leftJoin(channels, eq(leads.channelId, channels.id))
        .where(eq(leads.trainerId, trainerId))
        .orderBy(desc(leads.createdAt));
      if (!input?.year || !input?.month) return rows;
      const prefix = `${input.year}-${String(input.month).padStart(2, "0")}`;
      return rows.filter(r => r.lead.createdAt.startsWith(prefix));
    }),
  create: protectedProcedure
    .input(z.object({
      name: z.string(),
      phone: z.string().optional(),
      gender: z.string().optional(),
      ageGroup: z.string().optional(),
      channelId: z.number().optional(),
      status: z.string().optional(),
      consultationDate: z.string().optional(),
      consultationType: z.string().optional(),
      consultationSubTypes: z.string().optional(),
      consultationNote: z.string().optional(),
      interestType: z.string().optional(),
      exercisePurpose: z.string().optional(),
      memo: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const trainerId = ctx.user.trainerId;
      if (!trainerId) throw new TRPCError({ code: "FORBIDDEN" });
      const db = getDb();
      const [row] = await db.insert(leads).values({ ...input, trainerId, status: input.status ?? "pending" }).returning();
      return row;
    }),
  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().optional(),
      phone: z.string().optional(),
      gender: z.string().optional(),
      ageGroup: z.string().optional(),
      channelId: z.number().optional(),
      status: z.string().optional(),
      consultationDate: z.string().optional(),
      consultationType: z.string().optional(),
      consultationSubTypes: z.string().optional(),
      consultationNote: z.string().optional(),
      interestType: z.string().optional(),
      exercisePurpose: z.string().optional(),
      memo: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const trainerId = ctx.user.trainerId;
      if (!trainerId) throw new TRPCError({ code: "FORBIDDEN" });
      const db = getDb();
      const { id, ...data } = input;
      // 상담 완료 전환 여부 확인
      let wasCompleted = false;
      if (data.status === "completed") {
        const prev = await db.select({ status: leads.status }).from(leads).where(eq(leads.id, id)).limit(1);
        wasCompleted = prev[0]?.status !== "completed";
      }
      const [row] = await db.update(leads).set({ ...data, updatedAt: new Date().toISOString() }).where(and(eq(leads.id, id), eq(leads.trainerId, trainerId))).returning();
      if (wasCompleted) giveAutoPoints(trainerId, "lead_complete", "신규 상담 완료");
      return row;
    }),
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const trainerId = ctx.user.trainerId;
      if (!trainerId) throw new TRPCError({ code: "FORBIDDEN" });
      const db = getDb();
      await db.delete(leads).where(and(eq(leads.id, input.id), eq(leads.trainerId, trainerId)));
    }),
  register: protectedProcedure
    .input(z.object({
      leadId: z.number(),
      name: z.string(),
      phone: z.string().optional(),
      gender: z.string().optional(),
      programType: z.string().optional(),
      programFormat: z.string().optional(),
      programCustom: z.string().optional(),
      sessions: z.number().optional(),
      amount: z.number(),
      discountAmount: z.number(),
      paidAmount: z.number(),
      unpaidAmount: z.number(),
      paymentMethod: z.string().optional(),
      paymentDate: z.string(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      visitRoute: z.string().optional(),
      memo: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const trainerId = ctx.user.trainerId;
      if (!trainerId) throw new TRPCError({ code: "FORBIDDEN" });
      const db = getDb();

      const [planRow] = await db.select({ plan: sql<string>`"plan"` }).from(users).where(eq(users.id, ctx.user.id)).limit(1);
      const plan = planRow?.plan ?? "free";
      const cLimitRows = await pool.query<{ key: string; value: string }>(
        `SELECT key, value FROM plan_settings WHERE key IN ('member_limit_free','member_limit_pro','member_limit_elite')`
      );
      const cLimitMap: Record<string, number> = { free: 7, pro: 15, elite: 35 };
      for (const r of cLimitRows.rows) { cLimitMap[r.key.replace("member_limit_", "")] = parseInt(r.value); }
      const contractLimit = cLimitMap[plan] ?? 7;
      const [totalCnt] = await db.select({ count: sql<number>`COUNT(*)` }).from(members).where(eq(members.trainerId, trainerId));
      if (Number(totalCnt?.count ?? 0) >= contractLimit) throw new TRPCError({ code: "FORBIDDEN", message: `${plan.toUpperCase()} 플랜은 유효회원을 최대 ${contractLimit}명까지 등록할 수 있습니다.` });

      const [member] = await db.insert(members).values({
        trainerId, name: input.name, phone: input.phone, gender: input.gender,
        status: "active", membershipStart: input.startDate, membershipEnd: input.endDate,
        visitRoute: input.visitRoute,
      }).returning();
      if (input.sessions && input.programType) {
        const baseName = input.programType === "기타" ? (input.programCustom || "기타") : input.programType;
        const programName = input.programFormat ? `${baseName} ${input.programFormat}` : baseName;
        await db.insert(ptPackages).values({
          memberId: member.id, trainerId, totalSessions: input.sessions, usedSessions: 0,
          packageName: programName, startDate: input.startDate, expiryDate: input.endDate, status: "active",
          paymentAmount: input.paidAmount, unpaidAmount: input.unpaidAmount,
          paymentMethod: input.paymentMethod, paymentDate: input.paymentDate, paymentMemo: input.memo,
        });
      }
      if (input.paidAmount > 0) {
        await db.insert(payments).values({
          memberId: member.id, trainerId, amount: input.paidAmount,
          paymentDate: input.paymentDate, paymentMethod: input.paymentMethod, memo: input.memo,
        });
      }
      await db.update(leads).set({ status: "registered", registeredMemberId: member.id, updatedAt: new Date().toISOString() })
        .where(and(eq(leads.id, input.leadId), eq(leads.trainerId, trainerId)));
      return { memberId: member.id };
    }),
});

// ─── Training Log Router ───────────────────────────────────────────────────────

const trainingLogRouter = t.router({
  listAll: protectedProcedure
    .input(z.object({ memberId: z.number().optional(), month: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const trainerId = ctx.user.trainerId;
      if (!trainerId) throw new TRPCError({ code: "FORBIDDEN" });
      const db = getDb();
      const rows = await db
        .select({
          id: ptSessionLogs.id,
          memberId: ptSessionLogs.memberId,
          memberName: members.name,
          sessionDate: ptSessionLogs.sessionDate,
          notes: ptSessionLogs.notes,
          bodyPart: ptSessionLogs.bodyPart,
          exercisesJson: ptSessionLogs.exercisesJson,
          goal: ptSessionLogs.goal,
          feedback: ptSessionLogs.feedback,
          createdAt: ptSessionLogs.createdAt,
        })
        .from(ptSessionLogs)
        .leftJoin(members, eq(ptSessionLogs.memberId, members.id))
        .where(eq(ptSessionLogs.trainerId, trainerId))
        .orderBy(desc(ptSessionLogs.sessionDate));
      if (input?.memberId) return rows.filter(r => r.memberId === input.memberId);
      if (input?.month) return rows.filter(r => r.sessionDate.startsWith(input.month!));
      return rows;
    }),
});

// ─── FIT POINT Router ────────────────────────────────────────────────────────

const fitPointsRouter = t.router({
  getAutoRules: protectedProcedure.query(async () => {
    const result = await pool.query<{ event: string; amount: number }>(
      `SELECT event, amount FROM point_auto_rules WHERE "isEnabled"=1`
    );
    return Object.fromEntries(result.rows.map(r => [r.event, r.amount])) as Record<string, number>;
  }),

  // 기능별 포인트 차감 규칙 (트레이너도 조회 가능 — UI 표시용)
  getFeatureCosts: protectedProcedure.query(async () => {
    const rows = await pool.query<{ feature: string; cost: number; isEnabled: number }>(
      `SELECT feature, cost, "isEnabled" FROM feature_cost_rules`
    );
    return Object.fromEntries(
      rows.rows.map(r => [r.feature, { cost: r.cost, enabled: !!r.isEnabled }])
    ) as Record<string, { cost: number; enabled: boolean }>;
  }),

  getBalance: protectedProcedure.query(async ({ ctx }) => {
    const trainerId = ctx.user.trainerId;
    if (!trainerId) throw new TRPCError({ code: "FORBIDDEN" });
    const planRow = await pool.query<{ plan: string }>(
      `SELECT COALESCE(u."plan",'free') AS plan FROM users u WHERE u.id=$1`,
      [ctx.user.id]
    );
    const plan = planRow.rows[0]?.plan ?? "free";
    const dailyPoint = plan === "elite" ? 1000 : plan === "pro" ? 500 : 300;
    const totalResult = await pool.query<{ balance: string }>(
      `SELECT COALESCE(SUM(amount),0) AS balance FROM fit_point_logs WHERE "trainerId"=$1 AND status='completed' AND ("expiresAt" IS NULL OR "expiresAt" > CURRENT_DATE::text)`,
      [trainerId]
    );
    const earnedResult = await pool.query<{ balance: string }>(
      `SELECT COALESCE(SUM(amount),0) AS balance FROM fit_point_logs WHERE "trainerId"=$1 AND status='completed' AND type != 'daily_reset' AND ("expiresAt" IS NULL OR "expiresAt" > CURRENT_DATE::text)`,
      [trainerId]
    );
    const total = Number(totalResult.rows[0]?.balance ?? 0);
    const earned = Number(earnedResult.rows[0]?.balance ?? 0);
    const free = Math.min(dailyPoint, Math.max(0, total - earned));
    return { balance: total, earnedBalance: Math.max(0, earned), freeBalance: free, dailyPoint };
  }),

  getHistory: protectedProcedure.query(async ({ ctx }) => {
    const trainerId = ctx.user.trainerId;
    if (!trainerId) throw new TRPCError({ code: "FORBIDDEN" });
    const result = await pool.query<{ id: number; amount: number; type: string; memo: string | null; status: string; createdAt: string }>(
      `SELECT id, amount, type, memo, status, "createdAt" FROM fit_point_logs WHERE "trainerId"=$1 ORDER BY id DESC`,
      [trainerId]
    );
    return result.rows;
  }),

  requestCharge: protectedProcedure
    .input(z.object({ amount: z.number().min(1), memo: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const trainerId = ctx.user.trainerId;
      if (!trainerId) throw new TRPCError({ code: "FORBIDDEN" });
      await pool.query(
        `INSERT INTO fit_point_logs ("trainerId", amount, type, memo, status) VALUES ($1,$2,'charge_request',$3,'pending')`,
        [trainerId, input.amount, input.memo ?? null]
      );
      return { success: true };
    }),

  spendFeature: protectedProcedure
    .input(z.object({
      feature: z.enum([
        "new_contract",    // 신규 전자계약
        "contract_pdf",    // 계약서 PDF 전달
        "health_report",   // 건강 리포트 공유
        "stats_report",    // 통계 리포트 생성
        "branding_share",  // 브랜딩 페이지 공유
        "exercise_report", // 회원 운동 리포트 공유
      ]),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role === "admin") return { success: true }; // 관리자는 포인트 차감 없음
      const trainerId = ctx.user.trainerId;
      if (!trainerId) throw new TRPCError({ code: "FORBIDDEN" });
      const memoMap: Record<string, string> = {
        new_contract:    "신규 전자계약",
        contract_pdf:    "계약서 PDF 전달",
        health_report:   "건강 리포트 공유",
        stats_report:    "통계 리포트 생성",
        branding_share:  "브랜딩 페이지 공유",
        exercise_report: "회원 운동 리포트 공유",
      };
      await spendPoints(trainerId, input.feature, memoMap[input.feature]);
      return { success: true };
    }),
});

// ─── FIT STEP+ 회원앱 (트레이너별 격리) ──────────────────────────────────────

const fitStepPlusProtected = t.procedure.use(({ ctx, next }) => {
  const memberId = (ctx.req.session as any).fitStepPlusMemberId as number | undefined;
  const isAdmin = ctx.user?.role === "admin";
  if (!memberId && !isAdmin) throw new TRPCError({ code: "UNAUTHORIZED" });
  return next({ ctx: { ...ctx, fitStepPlusMemberId: memberId ?? 0 } });
});

const fitStepPlusRouter = t.router({
  // ── 회원 로그인/세션 ──
  memberLogin: publicProcedure
    .input(z.object({ username: z.string(), password: z.string(), trainerId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const normalizePhone = (p: string) => p.replace(/\D/g, "");
      const inputPhone = normalizePhone(input.username);
      const result = await getDb().select().from(members)
        .where(eq(members.trainerId, input.trainerId)).limit(200);
      const member = result.find(m => m.phone && normalizePhone(m.phone) === inputPhone);
      if (!member) throw new TRPCError({ code: "UNAUTHORIZED", message: "등록된 휴대폰 번호가 아닙니다." });
      const digits = normalizePhone(member.phone ?? "");
      const last4 = digits.slice(-4);
      if (input.password !== last4) throw new TRPCError({ code: "UNAUTHORIZED", message: "비밀번호가 틀렸습니다. (휴대폰 뒷자리 4자리)" });
      (ctx.req.session as any).fitStepPlusMemberId = member.id;
      await new Promise<void>((resolve, reject) => ctx.req.session.save((err) => err ? reject(err) : resolve()));
      return { id: member.id, username: member.phone ?? "", name: member.name, membershipType: "general" };
    }),

  memberLogout: publicProcedure.mutation(async ({ ctx }) => {
    delete (ctx.req.session as any).fitStepPlusMemberId;
    await new Promise<void>((resolve, reject) => ctx.req.session.save((err) => err ? reject(err) : resolve()));
    return { success: true };
  }),

  memberMe: publicProcedure.query(async ({ ctx }) => {
    const memberId = (ctx.req.session as any).fitStepPlusMemberId as number | undefined;
    if (!memberId) return null;
    const result = await getDb().select({
      id: members.id, trainerId: members.trainerId,
      name: members.name, phone: members.phone, email: members.email,
      membershipStart: members.membershipStart, membershipEnd: members.membershipEnd,
    }).from(members).where(eq(members.id, memberId)).limit(1);
    if (!result[0]) return null;
    return { ...result[0], username: result[0].phone ?? "", membershipType: "general" as const };
  }),

  // ── 공개 콘텐츠 (trainerId로 필터) ──
  listVideoCategories: publicProcedure
    .input(z.object({ trainerId: z.number() }))
    .query(async ({ input }) => {
      return getDb().select().from(fitStepPlusVideoCategories)
        .where(eq(fitStepPlusVideoCategories.trainerId, input.trainerId))
        .orderBy(fitStepPlusVideoCategories.sortOrder);
    }),

  listVideos: publicProcedure
    .input(z.object({ trainerId: z.number(), categoryId: z.number().optional(), level: z.string().optional() }))
    .query(async ({ input }) => {
      const conditions: any[] = [eq(fitStepPlusVideos.trainerId, input.trainerId), eq(fitStepPlusVideos.isPublished, 1)];
      if (input.categoryId) conditions.push(eq(fitStepPlusVideos.categoryId, input.categoryId));
      if (input.level) conditions.push(eq(fitStepPlusVideos.level, input.level));
      return getDb().select().from(fitStepPlusVideos).where(and(...conditions))
        .orderBy(fitStepPlusVideos.sortOrder, desc(fitStepPlusVideos.createdAt));
    }),

  getVideo: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const result = await getDb().select().from(fitStepPlusVideos)
        .where(and(eq(fitStepPlusVideos.id, input.id), eq(fitStepPlusVideos.isPublished, 1))).limit(1);
      if (!result[0]) throw new TRPCError({ code: "NOT_FOUND" });
      return result[0];
    }),

  listEvents: publicProcedure
    .input(z.object({ trainerId: z.number(), eventType: z.string().optional() }))
    .query(async ({ input }) => {
      const conditions: any[] = [eq(fitStepPlusEvents.trainerId, input.trainerId), eq(fitStepPlusEvents.isPublished, 1)];
      if (input.eventType) conditions.push(eq(fitStepPlusEvents.eventType, input.eventType));
      return getDb().select().from(fitStepPlusEvents).where(and(...conditions))
        .orderBy(desc(fitStepPlusEvents.isPinned), desc(fitStepPlusEvents.createdAt));
    }),

  getEvent: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const result = await getDb().select().from(fitStepPlusEvents)
        .where(and(eq(fitStepPlusEvents.id, input.id), eq(fitStepPlusEvents.isPublished, 1))).limit(1);
      if (!result[0]) throw new TRPCError({ code: "NOT_FOUND" });
      return result[0];
    }),

  // ── 회원 전용 (세션 인증) ──
  listWorkoutLogs: fitStepPlusProtected
    .input(z.object({ month: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      let logs = await getDb().select().from(fitStepPlusWorkoutLogs)
        .where(eq(fitStepPlusWorkoutLogs.fitStepPlusMemberId, (ctx as any).fitStepPlusMemberId))
        .orderBy(desc(fitStepPlusWorkoutLogs.logDate));
      if (input?.month) logs = logs.filter(l => l.logDate.startsWith(input.month!));
      return logs;
    }),

  createWorkoutLog: fitStepPlusProtected
    .input(z.object({
      logDate: z.string(), title: z.string().optional(), exercisesJson: z.string().optional(),
      durationMinutes: z.number().optional(), caloriesBurned: z.number().optional(),
      bodyWeight: z.string().optional(), notes: z.string().optional(), mood: z.string().optional(),
      intensity: z.string().optional(), totalVolume: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const [row] = await getDb().insert(fitStepPlusWorkoutLogs).values({
        fitStepPlusMemberId: (ctx as any).fitStepPlusMemberId,
        title: input.title ?? "운동 기록", ...input,
      }).returning();
      return row;
    }),

  updateWorkoutLog: fitStepPlusProtected
    .input(z.object({
      id: z.number(), logDate: z.string().optional(), title: z.string().optional(),
      exercisesJson: z.string().optional(), durationMinutes: z.number().optional(),
      caloriesBurned: z.number().optional(), bodyWeight: z.string().optional(),
      notes: z.string().optional(), mood: z.string().optional(),
      intensity: z.string().optional(), totalVolume: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const existing = await getDb().select({ fitStepPlusMemberId: fitStepPlusWorkoutLogs.fitStepPlusMemberId })
        .from(fitStepPlusWorkoutLogs).where(eq(fitStepPlusWorkoutLogs.id, id)).limit(1);
      if (!existing[0] || existing[0].fitStepPlusMemberId !== (ctx as any).fitStepPlusMemberId)
        throw new TRPCError({ code: "FORBIDDEN" });
      const [row] = await getDb().update(fitStepPlusWorkoutLogs).set(data).where(eq(fitStepPlusWorkoutLogs.id, id)).returning();
      return row;
    }),

  deleteWorkoutLog: fitStepPlusProtected
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await getDb().select({ fitStepPlusMemberId: fitStepPlusWorkoutLogs.fitStepPlusMemberId })
        .from(fitStepPlusWorkoutLogs).where(eq(fitStepPlusWorkoutLogs.id, input.id)).limit(1);
      if (!existing[0] || existing[0].fitStepPlusMemberId !== (ctx as any).fitStepPlusMemberId)
        throw new TRPCError({ code: "FORBIDDEN" });
      await getDb().delete(fitStepPlusWorkoutLogs).where(eq(fitStepPlusWorkoutLogs.id, input.id));
      return { success: true };
    }),

  updateProfile: fitStepPlusProtected
    .input(z.object({ name: z.string().min(1).optional(), phone: z.string().optional(), email: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      await getDb().update(members).set({ ...input, updatedAt: new Date().toISOString() })
        .where(eq(members.id, (ctx as any).fitStepPlusMemberId));
      return { success: true };
    }),

  changePassword: fitStepPlusProtected
    .input(z.object({ currentPassword: z.string().min(1), newPassword: z.string().min(4) }))
    .mutation(async () => {
      throw new TRPCError({ code: "BAD_REQUEST", message: "비밀번호는 휴대폰 뒷자리 4자리로 고정됩니다." });
    }),

  // ── 트레이너 관리 (본인 trainerId 기준) ──
  trainer_listMembers: protectedProcedure.query(async ({ ctx }) => {
    const trainerId = ctx.user.trainerId;
    if (!trainerId) throw new TRPCError({ code: "FORBIDDEN" });
    return getDb().select({
      id: fitStepPlusMembers.id, name: fitStepPlusMembers.name, phone: fitStepPlusMembers.phone,
      username: fitStepPlusMembers.username, membershipType: fitStepPlusMembers.membershipType,
      membershipStart: fitStepPlusMembers.membershipStart, membershipEnd: fitStepPlusMembers.membershipEnd,
      createdAt: fitStepPlusMembers.createdAt,
    }).from(fitStepPlusMembers).where(eq(fitStepPlusMembers.trainerId, trainerId))
      .orderBy(desc(fitStepPlusMembers.createdAt));
  }),

  trainer_createMember: protectedProcedure
    .input(z.object({
      username: z.string().min(3), password: z.string().min(6), name: z.string().min(1),
      phone: z.string().optional(), email: z.string().optional(),
      membershipType: z.enum(["general", "premium", "vip"]).default("general"),
      membershipStart: z.string().optional(), membershipEnd: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const trainerId = ctx.user.trainerId;
      if (!trainerId) throw new TRPCError({ code: "FORBIDDEN" });
      const existing = await getDb().select({ id: fitStepPlusMembers.id }).from(fitStepPlusMembers)
        .where(and(eq(fitStepPlusMembers.trainerId, trainerId), eq(fitStepPlusMembers.username, input.username))).limit(1);
      if (existing[0]) throw new TRPCError({ code: "CONFLICT", message: "이미 사용 중인 아이디입니다." });
      // 플랜별 FIT STEP+ 회원 수 제한
      const trainerPlanRow = await pool.query<{ plan: string }>(
        `SELECT COALESCE(u."plan",'free') AS plan FROM users u JOIN trainers t ON t."userId"=u.id WHERE t.id=$1`, [trainerId]
      );
      const trainerPlan = trainerPlanRow.rows[0]?.plan ?? "free";
      const planKey = `fsp_limit_${trainerPlan}`;
      const limitRow = await pool.query<{ value: string }>(
        `SELECT value FROM plan_settings WHERE key=$1`, [planKey]
      );
      const fspLimit = parseInt(limitRow.rows[0]?.value ?? (trainerPlan === "elite" ? "30" : trainerPlan === "pro" ? "15" : "5"));
      const countRow = await pool.query<{ cnt: string }>(
        `SELECT COUNT(*)::text AS cnt FROM fit_step_plus_members WHERE "trainerId"=$1`, [trainerId]
      );
      if (parseInt(countRow.rows[0].cnt) >= fspLimit) {
        throw new TRPCError({ code: "FORBIDDEN", message: `FIT STEP+ 회원은 최대 ${fspLimit}명까지 등록할 수 있습니다. (${trainerPlan.toUpperCase()} 플랜)` });
      }
      const hashed = await bcrypt.hash(input.password, 10);
      const [row] = await getDb().insert(fitStepPlusMembers).values({ ...input, trainerId, password: hashed }).returning();
      const { password: _, ...safe } = row;
      return safe;
    }),

  trainer_updateMember: protectedProcedure
    .input(z.object({
      id: z.number(), name: z.string().optional(), phone: z.string().optional(),
      membershipType: z.enum(["general", "premium", "vip"]).optional(),
      membershipStart: z.string().optional(), membershipEnd: z.string().optional(),
      isActive: z.number().optional(), password: z.string().min(6).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const trainerId = ctx.user.trainerId;
      if (!trainerId) throw new TRPCError({ code: "FORBIDDEN" });
      const { id, password, ...rest } = input;
      const updateData: any = { ...rest, updatedAt: new Date().toISOString() };
      if (password) updateData.password = await bcrypt.hash(password, 10);
      await getDb().update(fitStepPlusMembers).set(updateData)
        .where(and(eq(fitStepPlusMembers.id, id), eq(fitStepPlusMembers.trainerId, trainerId)));
      return { success: true };
    }),

  trainer_deleteMember: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const trainerId = ctx.user.trainerId;
      if (!trainerId) throw new TRPCError({ code: "FORBIDDEN" });
      await getDb().delete(fitStepPlusWorkoutLogs).where(eq(fitStepPlusWorkoutLogs.fitStepPlusMemberId, input.id));
      await getDb().delete(fitStepPlusMembers)
        .where(and(eq(fitStepPlusMembers.id, input.id), eq(fitStepPlusMembers.trainerId, trainerId)));
      return { success: true };
    }),

  trainer_checkMemberFSP: protectedProcedure
    .input(z.object({ memberId: z.number() }))
    .query(async ({ ctx, input }) => {
      const trainerId = ctx.user.trainerId;
      if (!trainerId) return { registered: false };
      const row = await getDb().select({ id: fitStepPlusMembers.id })
        .from(fitStepPlusMembers)
        .where(and(eq(fitStepPlusMembers.trainerId, trainerId), eq(fitStepPlusMembers.memberId, input.memberId)))
        .limit(1);
      return { registered: row.length > 0 };
    }),

  trainer_sendSessionToMember: protectedProcedure
    .input(z.object({ sessionLogId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user.trainerId) throw new TRPCError({ code: "FORBIDDEN" });
      // PT 일지 조회
      const logRow = await getDb().select().from(ptSessionLogs)
        .where(and(eq(ptSessionLogs.id, input.sessionLogId), eq(ptSessionLogs.trainerId, ctx.user.trainerId)))
        .limit(1);
      if (!logRow[0]) throw new TRPCError({ code: "NOT_FOUND" });
      const log = logRow[0];
      // 해당 member의 FIT STEP+ 회원 ID 찾기 (members 테이블 id = fitStepPlusMembers id)
      const fspMember = await pool.query<{ id: number }>(
        `SELECT id FROM members WHERE id=$1 AND "trainerId"=$2 LIMIT 1`,
        [log.memberId, ctx.user.trainerId]
      );
      if (!fspMember.rows[0]) throw new TRPCError({ code: "NOT_FOUND", message: "회원을 찾을 수 없습니다." });
      const fitStepPlusMemberId = fspMember.rows[0].id;
      // 이미 전송된 기록인지 확인
      const already = await pool.query(
        `SELECT id FROM fit_step_plus_workout_logs WHERE "fitStepPlusMemberId"=$1 AND "logDate"=$2 AND notes LIKE '%[트레이너 전송]%' LIMIT 1`,
        [fitStepPlusMemberId, log.sessionDate]
      );
      if (already.rows.length > 0) throw new TRPCError({ code: "CONFLICT", message: "이미 전송된 일지입니다." });
      // 부위 태그 → 제목 생성
      const bodyPartTitle = log.bodyPart ? `${log.bodyPart} 트레이닝` : "PT 트레이닝";
      const notesWithTag = [log.notes, "[트레이너 전송]"].filter(Boolean).join("\n");
      await getDb().insert(fitStepPlusWorkoutLogs).values({
        fitStepPlusMemberId,
        logDate: log.sessionDate,
        title: bodyPartTitle,
        exercisesJson: log.exercisesJson ?? undefined,
        notes: notesWithTag,
      });
      return { success: true };
    }),

  trainer_listWorkoutLogs: protectedProcedure
    .input(z.object({ memberId: z.number().optional(), month: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const trainerId = ctx.user.trainerId;
      if (!trainerId) throw new TRPCError({ code: "FORBIDDEN" });
      const rows = await getDb()
        .select({
          id: fitStepPlusWorkoutLogs.id,
          memberId: fitStepPlusMembers.id,
          memberName: fitStepPlusMembers.name,
          logDate: fitStepPlusWorkoutLogs.logDate,
          title: fitStepPlusWorkoutLogs.title,
          exercisesJson: fitStepPlusWorkoutLogs.exercisesJson,
          durationMinutes: fitStepPlusWorkoutLogs.durationMinutes,
          notes: fitStepPlusWorkoutLogs.notes,
          mood: fitStepPlusWorkoutLogs.mood,
          createdAt: fitStepPlusWorkoutLogs.createdAt,
        })
        .from(fitStepPlusWorkoutLogs)
        .innerJoin(fitStepPlusMembers, eq(fitStepPlusWorkoutLogs.fitStepPlusMemberId, fitStepPlusMembers.id))
        .where(eq(fitStepPlusMembers.trainerId, trainerId))
        .orderBy(desc(fitStepPlusWorkoutLogs.logDate), desc(fitStepPlusWorkoutLogs.createdAt));
      if (input?.memberId) return rows.filter(r => r.memberId === input.memberId);
      if (input?.month) return rows.filter(r => r.logDate.startsWith(input.month!));
      return rows;
    }),

  trainer_listVideos: protectedProcedure.query(async ({ ctx }) => {
    const trainerId = ctx.user.trainerId;
    if (!trainerId) throw new TRPCError({ code: "FORBIDDEN" });
    return getDb().select().from(fitStepPlusVideos).where(eq(fitStepPlusVideos.trainerId, trainerId))
      .orderBy(fitStepPlusVideos.sortOrder, desc(fitStepPlusVideos.createdAt));
  }),

  trainer_createVideo: protectedProcedure
    .input(z.object({
      categoryId: z.number().optional(), title: z.string().min(1),
      description: z.string().optional(), videoUrl: z.string().min(1),
      thumbnailUrl: z.string().optional(), duration: z.number().optional(),
      level: z.enum(["beginner", "intermediate", "advanced"]).default("beginner"),
      bodyPart: z.string().optional(), isPublished: z.number().default(1), sortOrder: z.number().default(0),
    }))
    .mutation(async ({ ctx, input }) => {
      const trainerId = ctx.user.trainerId;
      if (!trainerId) throw new TRPCError({ code: "FORBIDDEN" });
      const [row] = await getDb().insert(fitStepPlusVideos).values({ ...input, trainerId }).returning();
      return row;
    }),

  trainer_updateVideo: protectedProcedure
    .input(z.object({
      id: z.number(), categoryId: z.number().optional(), title: z.string().optional(),
      description: z.string().optional(), videoUrl: z.string().optional(),
      thumbnailUrl: z.string().optional(), duration: z.number().optional(),
      level: z.enum(["beginner", "intermediate", "advanced"]).optional(),
      bodyPart: z.string().optional(), isPublished: z.number().optional(), sortOrder: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const trainerId = ctx.user.trainerId;
      if (!trainerId) throw new TRPCError({ code: "FORBIDDEN" });
      const { id, ...data } = input;
      await getDb().update(fitStepPlusVideos).set(data)
        .where(and(eq(fitStepPlusVideos.id, id), eq(fitStepPlusVideos.trainerId, trainerId)));
      return { success: true };
    }),

  trainer_deleteVideo: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const trainerId = ctx.user.trainerId;
      if (!trainerId) throw new TRPCError({ code: "FORBIDDEN" });
      await getDb().delete(fitStepPlusVideos)
        .where(and(eq(fitStepPlusVideos.id, input.id), eq(fitStepPlusVideos.trainerId, trainerId)));
      return { success: true };
    }),

  trainer_listCategories: protectedProcedure.query(async ({ ctx }) => {
    const trainerId = ctx.user.trainerId;
    if (!trainerId) throw new TRPCError({ code: "FORBIDDEN" });
    return getDb().select().from(fitStepPlusVideoCategories)
      .where(eq(fitStepPlusVideoCategories.trainerId, trainerId))
      .orderBy(fitStepPlusVideoCategories.sortOrder);
  }),

  trainer_createCategory: protectedProcedure
    .input(z.object({ name: z.string().min(1), sortOrder: z.number().default(0) }))
    .mutation(async ({ ctx, input }) => {
      const trainerId = ctx.user.trainerId;
      if (!trainerId) throw new TRPCError({ code: "FORBIDDEN" });
      const [row] = await getDb().insert(fitStepPlusVideoCategories).values({ ...input, trainerId }).returning();
      return row;
    }),

  trainer_deleteCategory: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const trainerId = ctx.user.trainerId;
      if (!trainerId) throw new TRPCError({ code: "FORBIDDEN" });
      await getDb().delete(fitStepPlusVideoCategories)
        .where(and(eq(fitStepPlusVideoCategories.id, input.id), eq(fitStepPlusVideoCategories.trainerId, trainerId)));
      return { success: true };
    }),

  trainer_listEvents: protectedProcedure.query(async ({ ctx }) => {
    const trainerId = ctx.user.trainerId;
    if (!trainerId) throw new TRPCError({ code: "FORBIDDEN" });
    return getDb().select().from(fitStepPlusEvents).where(eq(fitStepPlusEvents.trainerId, trainerId))
      .orderBy(desc(fitStepPlusEvents.createdAt));
  }),

  trainer_createEvent: protectedProcedure
    .input(z.object({
      title: z.string().min(1), content: z.string().min(1), imageUrl: z.string().optional(),
      eventType: z.enum(["notice", "event", "promotion"]).default("notice"),
      startDate: z.string().optional(), endDate: z.string().optional(),
      isPublished: z.number().default(1), isPinned: z.number().default(0),
    }))
    .mutation(async ({ ctx, input }) => {
      const trainerId = ctx.user.trainerId;
      if (!trainerId) throw new TRPCError({ code: "FORBIDDEN" });
      const [row] = await getDb().insert(fitStepPlusEvents).values({ ...input, trainerId }).returning();
      return row;
    }),

  trainer_updateEvent: protectedProcedure
    .input(z.object({
      id: z.number(), title: z.string().optional(), content: z.string().optional(),
      imageUrl: z.string().optional(), eventType: z.enum(["notice", "event", "promotion"]).optional(),
      startDate: z.string().optional(), endDate: z.string().optional(),
      isPublished: z.number().optional(), isPinned: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const trainerId = ctx.user.trainerId;
      if (!trainerId) throw new TRPCError({ code: "FORBIDDEN" });
      const { id, ...data } = input;
      await getDb().update(fitStepPlusEvents).set(data)
        .where(and(eq(fitStepPlusEvents.id, id), eq(fitStepPlusEvents.trainerId, trainerId)));
      return { success: true };
    }),

  trainer_deleteEvent: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const trainerId = ctx.user.trainerId;
      if (!trainerId) throw new TRPCError({ code: "FORBIDDEN" });
      await getDb().delete(fitStepPlusEvents)
        .where(and(eq(fitStepPlusEvents.id, input.id), eq(fitStepPlusEvents.trainerId, trainerId)));
      return { success: true };
    }),

  // ── 회원 출석 체크인 ──
  member_checkIn: fitStepPlusProtected
    .input(z.object({
      conditionScore: z.number().min(1).max(5).optional(),
      sleepHours: z.string().optional(),
      energyLevel: z.string().optional(),
      bodyParts: z.array(z.string()).optional(),
      workoutTheme: z.array(z.string()).optional(),
      intensity: z.number().min(1).max(5).optional(),
    }).optional().default({}))
    .mutation(async ({ ctx, input }) => {
      const memberId = (ctx as any).fitStepPlusMemberId as number;
      const today = new Date().toISOString().slice(0, 10);
      try {
        const result = await pool.query(
          `INSERT INTO fit_step_plus_attendance
            ("fitStepPlusMemberId","trainerId","attendDate","conditionScore","sleepHours","energyLevel","bodyParts","workoutTheme","intensity","createdAt")
           SELECT $1,"trainerId",$2,$3,$4,$5,$6,$7,$8,now()::text FROM fit_step_plus_members WHERE id=$1
           RETURNING id`,
          [
            memberId, today,
            input.conditionScore ?? null, input.sleepHours ?? null, input.energyLevel ?? null,
            input.bodyParts?.length ? JSON.stringify(input.bodyParts) : null,
            input.workoutTheme?.length ? JSON.stringify(input.workoutTheme) : null,
            input.intensity ?? null,
          ]
        );
        if (result.rows.length === 0) throw new TRPCError({ code: "NOT_FOUND", message: "회원 정보를 찾을 수 없습니다." });
      } catch (e: any) {
        if (e.code === "23505") throw new TRPCError({ code: "CONFLICT", message: "오늘 이미 출석 체크했습니다." });
        throw e;
      }
      return { success: true, date: today };
    }),

  member_getAttendance: fitStepPlusProtected
    .input(z.object({ month: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const memberId = (ctx as any).fitStepPlusMemberId as number;
      const month = input.month ?? new Date().toISOString().slice(0, 7);
      const rows = await pool.query<{ attendDate: string }>(
        `SELECT "attendDate" FROM fit_step_plus_attendance WHERE "fitStepPlusMemberId"=$1 AND "attendDate" LIKE $2 ORDER BY "attendDate" DESC`,
        [memberId, `${month}%`]
      );
      return rows.rows.map((r) => r.attendDate);
    }),

  // ── 트레이너: 출석 현황 조회 ──
  trainer_listAttendance: protectedProcedure
    .input(z.object({ date: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const trainerId = ctx.user.trainerId;
      if (!trainerId) throw new TRPCError({ code: "FORBIDDEN" });
      const date = input.date ?? new Date().toISOString().slice(0, 10);
      const rows = await pool.query<{ id: number; name: string; attendDate: string }>(
        `SELECT a.id, m.name, a."attendDate" FROM fit_step_plus_attendance a JOIN fit_step_plus_members m ON a."fitStepPlusMemberId"=m.id WHERE a."trainerId"=$1 AND a."attendDate"=$2 ORDER BY a."createdAt" DESC`,
        [trainerId, date]
      );
      return rows.rows;
    }),

  // ── 어드민 현황 조회 ──
  admin_overview: adminProcedure.query(async () => {
    const memberCounts = await getDb().select({
      trainerId: fitStepPlusMembers.trainerId,
      count: sql<number>`COUNT(*)`,
    }).from(fitStepPlusMembers).groupBy(fitStepPlusMembers.trainerId);
    return { memberCounts };
  }),

  // 어드민 작업실 현황: 트레이너별 작업실 오픈/브랜드페이지/FSP 현황
  admin_workshopStats: adminProcedure.query(async () => {
    const rows = await pool.query<{
      trainerId: number;
      workshopOpen: string;
      brandIsPublic: number;
      fspCount: string;
    }>(`
      SELECT
        t.id AS "trainerId",
        CASE WHEN wu.id IS NOT NULL THEN 'true' ELSE 'false' END AS "workshopOpen",
        COALESCE(t."brandIsPublic", 0) AS "brandIsPublic",
        COALESCE(fsp.cnt, 0)::text AS "fspCount"
      FROM trainers t
      LEFT JOIN workshop_unlocks wu
        ON wu."trainerId" = t.id AND wu.feature = 'workshop_access'
      LEFT JOIN (
        SELECT "trainerId", COUNT(*) AS cnt FROM fit_step_plus_members GROUP BY "trainerId"
      ) fsp ON fsp."trainerId" = t.id
      ORDER BY t."trainerName"
    `);
    return rows.rows.map(r => ({
      trainerId: r.trainerId,
      workshopOpen: r.workshopOpen === "true",
      brandIsPublic: Number(r.brandIsPublic) === 1,
      fspCount: Number(r.fspCount),
    }));
  }),

  // ── 플랜별 일반 회원 수 제한 조회 ──
  admin_getMemberLimits: adminProcedure.query(async () => {
    const rows = await pool.query<{ key: string; value: string }>(
      `SELECT key, value FROM plan_settings WHERE key IN ('member_limit_free','member_limit_pro','member_limit_elite')`
    );
    const map: Record<string, number> = { free: 7, pro: 15, elite: 35 };
    for (const r of rows.rows) { map[r.key.replace("member_limit_", "")] = parseInt(r.value); }
    return map;
  }),

  // ── 플랜별 일반 회원 수 제한 업데이트 ──
  admin_updateMemberLimits: adminProcedure
    .input(z.object({
      free: z.number().int().min(1).max(9999),
      pro: z.number().int().min(1).max(9999),
      elite: z.number().int().min(1).max(9999),
    }))
    .mutation(async ({ input }) => {
      for (const [plan, val] of [["free", input.free], ["pro", input.pro], ["elite", input.elite]] as const) {
        await pool.query(
          `INSERT INTO plan_settings (key, value, "updatedAt") VALUES ($1,$2,now()::text)
           ON CONFLICT (key) DO UPDATE SET value=$2, "updatedAt"=now()::text`,
          [`member_limit_${plan}`, String(val)]
        );
      }
      return { success: true };
    }),

  // ── 플랜별 FIT STEP+ 회원 수 제한 조회 ──
  admin_getPlanLimits: adminProcedure.query(async () => {
    const rows = await pool.query<{ key: string; value: string }>(
      `SELECT key, value FROM plan_settings WHERE key IN ('fsp_limit_free','fsp_limit_pro','fsp_limit_elite')`
    );
    const map: Record<string, number> = { free: 5, pro: 15, elite: 30 };
    for (const r of rows.rows) {
      const plan = r.key.replace("fsp_limit_", "");
      map[plan] = parseInt(r.value);
    }
    return map;
  }),

  // ── 플랜별 FIT STEP+ 회원 수 제한 업데이트 ──
  admin_updatePlanLimits: adminProcedure
    .input(z.object({
      free: z.number().int().min(1).max(500),
      pro: z.number().int().min(1).max(500),
      elite: z.number().int().min(1).max(500),
    }))
    .mutation(async ({ input }) => {
      for (const [plan, val] of [["free", input.free], ["pro", input.pro], ["elite", input.elite]] as const) {
        await pool.query(
          `INSERT INTO plan_settings (key, value, "updatedAt") VALUES ($1,$2,now()::text)
           ON CONFLICT (key) DO UPDATE SET value=$2, "updatedAt"=now()::text`,
          [`fsp_limit_${plan}`, String(val)]
        );
      }
      return { success: true };
    }),

  // ── 플랜별 구독료 조회 ──
  admin_getPlanPrices: adminProcedure.query(async () => {
    const rows = await pool.query<{ key: string; value: string }>(
      `SELECT key, value FROM plan_settings WHERE key IN ('plan_price_free','plan_price_pro','plan_price_elite')`
    );
    const map: Record<string, number> = { free: 0, pro: 29000, elite: 59000 };
    for (const r of rows.rows) { map[r.key.replace("plan_price_", "")] = parseInt(r.value); }
    return map;
  }),

  // ── 플랜별 구독료 업데이트 ──
  admin_updatePlanPrices: adminProcedure
    .input(z.object({
      free: z.number().int().min(0).max(9999999),
      pro: z.number().int().min(0).max(9999999),
      elite: z.number().int().min(0).max(9999999),
    }))
    .mutation(async ({ input }) => {
      for (const [plan, val] of [["free", input.free], ["pro", input.pro], ["elite", input.elite]] as const) {
        await pool.query(
          `INSERT INTO plan_settings (key, value, "updatedAt") VALUES ($1,$2,now()::text)
           ON CONFLICT (key) DO UPDATE SET value=$2, "updatedAt"=now()::text`,
          [`plan_price_${plan}`, String(val)]
        );
      }
      return { success: true };
    }),

  // ── 플랜별 할인율 조회 ──
  admin_getPlanDiscounts: adminProcedure.query(async () => {
    const rows = await pool.query<{ key: string; value: string }>(
      `SELECT key, value FROM plan_settings WHERE key IN ('plan_discount_free','plan_discount_pro','plan_discount_elite')`
    );
    const map: Record<string, number> = { free: 0, pro: 0, elite: 0 };
    for (const r of rows.rows) { map[r.key.replace("plan_discount_", "")] = parseInt(r.value); }
    return map;
  }),

  // ── 플랜별 할인율 업데이트 ──
  admin_updatePlanDiscounts: adminProcedure
    .input(z.object({
      free: z.number().int().min(0).max(100),
      pro: z.number().int().min(0).max(100),
      elite: z.number().int().min(0).max(100),
    }))
    .mutation(async ({ input }) => {
      for (const [plan, val] of [["free", input.free], ["pro", input.pro], ["elite", input.elite]] as const) {
        await pool.query(
          `INSERT INTO plan_settings (key, value, "updatedAt") VALUES ($1,$2,now()::text)
           ON CONFLICT (key) DO UPDATE SET value=$2, "updatedAt"=now()::text`,
          [`plan_discount_${plan}`, String(val)]
        );
      }
      return { success: true };
    }),

  // ── 트레이너용 플랜 정보 조회 (가격+할인율) ──
  trainer_getPublicPlanInfo: protectedProcedure.query(async () => {
    const rows = await pool.query<{ key: string; value: string }>(
      `SELECT key, value FROM plan_settings WHERE key LIKE 'plan_price_%' OR key LIKE 'plan_discount_%'`
    );
    const prices: Record<string, number> = { free: 0, pro: 29000, elite: 59000 };
    const discounts: Record<string, number> = { free: 0, pro: 0, elite: 0 };
    for (const r of rows.rows) {
      if (r.key.startsWith("plan_price_")) prices[r.key.replace("plan_price_", "")] = parseInt(r.value);
      if (r.key.startsWith("plan_discount_")) discounts[r.key.replace("plan_discount_", "")] = parseInt(r.value);
    }
    return { prices, discounts };
  }),

  // ── 포인트로 플랜 즉시 구매 ──
  trainer_purchasePlanWithPoints: protectedProcedure
    .input(z.object({
      plan: z.enum(["pro", "elite"]),
      amount: z.number().int().min(0),
    }))
    .mutation(async ({ ctx, input }) => {
      const trainerId = ctx.user.trainerId;
      if (!trainerId) throw new TRPCError({ code: "FORBIDDEN" });
      if (input.amount > 0) {
        const balRow = await pool.query<{ balance: string }>(
          `SELECT COALESCE(SUM(amount),0) AS balance FROM fit_point_logs WHERE "trainerId"=$1 AND status='completed' AND ("expiresAt" IS NULL OR "expiresAt" > CURRENT_DATE::text)`,
          [trainerId]
        );
        const balance = Number(balRow.rows[0]?.balance ?? 0);
        if (balance < input.amount) {
          throw new TRPCError({ code: "FORBIDDEN", message: `포인트가 부족합니다. (필요: ${input.amount.toLocaleString()}P, 보유: ${balance.toLocaleString()}P)` });
        }
        await pool.query(
          `INSERT INTO fit_point_logs ("trainerId", amount, type, memo, status) VALUES ($1,$2,'usage',$3,'completed')`,
          [trainerId, -input.amount, `${input.plan.toUpperCase()} 플랜 구독 결제`]
        );
      }
      await pool.query(`UPDATE users SET plan=$1 WHERE id=$2`, [input.plan, ctx.user.id]);
      return { success: true };
    }),

  // ── 플랜 구매 신청 (포인트 일부 + 계좌이체) ──
  trainer_submitPlanPurchase: protectedProcedure
    .input(z.object({
      plan: z.enum(["pro", "elite"]),
      totalAmount: z.number().int().min(0),
      pointsUsed: z.number().int().min(0),
      bankAmount: z.number().int().min(0),
      depositor: z.string().max(50).default(""),
    }))
    .mutation(async ({ ctx, input }) => {
      const trainerId = ctx.user.trainerId;
      if (!trainerId) throw new TRPCError({ code: "FORBIDDEN" });
      // 포인트 사용분 즉시 차감
      if (input.pointsUsed > 0) {
        const balRow = await pool.query<{ balance: string }>(
          `SELECT COALESCE(SUM(amount),0) AS balance FROM fit_point_logs WHERE "trainerId"=$1 AND status='completed' AND ("expiresAt" IS NULL OR "expiresAt" > CURRENT_DATE::text)`,
          [trainerId]
        );
        const balance = Number(balRow.rows[0]?.balance ?? 0);
        const actualPoints = Math.min(input.pointsUsed, balance);
        if (actualPoints > 0) {
          await pool.query(
            `INSERT INTO fit_point_logs ("trainerId", amount, type, memo, status) VALUES ($1,$2,'usage',$3,'completed')`,
            [trainerId, -actualPoints, `${input.plan.toUpperCase()} 플랜 포인트 적용`]
          );
        }
      }
      // 잔여금 없으면 즉시 플랜 업그레이드
      if (input.bankAmount <= 0) {
        await pool.query(`UPDATE users SET plan=$1 WHERE id=$2`, [input.plan, ctx.user.id]);
        return { success: true, instant: true };
      }
      // 잔여금 계좌이체 신청 생성
      await pool.query(
        `INSERT INTO plan_purchase_requests ("trainerId", plan, amount, "pointsUsed", depositor, status, "createdAt")
         VALUES ($1,$2,$3,$4,$5,'pending',now()::text)`,
        [trainerId, input.plan, input.bankAmount, input.pointsUsed, input.depositor]
      );
      return { success: true, instant: false };
    }),

  // ── 관리자: 플랜 구매 신청 목록 ──
  admin_listPlanPurchaseRequests: adminProcedure
    .input(z.object({ trainerId: z.number().optional() }))
    .query(async ({ input }) => {
      const rows = await pool.query<{
        id: number; trainerId: number; plan: string; amount: number;
        pointsUsed: number; depositor: string; status: string; createdAt: string; trainerName: string;
      }>(
        `SELECT r.id, r."trainerId", r.plan, r.amount, COALESCE(r."pointsUsed",0) AS "pointsUsed", r.depositor, r.status, r."createdAt", t."trainerName"
         FROM plan_purchase_requests r JOIN trainers t ON t.id=r."trainerId"
         ${input.trainerId ? `WHERE r."trainerId"=$1` : "WHERE r.status='pending'"}
         ORDER BY r."createdAt" DESC`,
        input.trainerId ? [input.trainerId] : []
      );
      return rows.rows;
    }),

  // ── 관리자: 플랜 구매 승인 ──
  admin_approvePlanPurchase: adminProcedure
    .input(z.object({ requestId: z.number(), trainerId: z.number(), plan: z.enum(["pro", "elite"]) }))
    .mutation(async ({ input }) => {
      await pool.query(`UPDATE plan_purchase_requests SET status='approved' WHERE id=$1`, [input.requestId]);
      const userRow = await pool.query<{ userId: number }>(
        `SELECT "userId" FROM trainers WHERE id=$1`, [input.trainerId]
      );
      if (userRow.rows[0]) {
        await pool.query(`UPDATE users SET plan=$1 WHERE id=$2`, [input.plan, userRow.rows[0].userId]);
      }
      return { success: true };
    }),

  // ── 관리자: 플랜 구매 거절 ──
  admin_rejectPlanPurchase: adminProcedure
    .input(z.object({ requestId: z.number() }))
    .mutation(async ({ input }) => {
      await pool.query(`UPDATE plan_purchase_requests SET status='rejected' WHERE id=$1`, [input.requestId]);
      return { success: true };
    }),
});

const expensesRouter = t.router({
  list: protectedProcedure
    .input(z.object({ yearMonth: z.string(), dateFilter: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const trainerId = ctx.user.trainerId;
      if (!trainerId) throw new TRPCError({ code: "FORBIDDEN" });
      const { yearMonth, dateFilter } = input;
      const dateCondition = dateFilter
        ? `AND "expenseDate" = $2`
        : `AND "expenseDate" LIKE $2`;
      const dateParam = dateFilter ? dateFilter : `${yearMonth}%`;
      const result = await pool.query<{ id: number; amount: number; category: string; memo: string | null; expenseDate: string; createdAt: string }>(
        `SELECT id, amount, category, memo, "expenseDate", "createdAt" FROM expenses WHERE "trainerId"=$1 ${dateCondition} ORDER BY "expenseDate" DESC, id DESC`,
        [trainerId, dateParam]
      );
      const rows = result.rows;
      const total = rows.reduce((s, r) => s + r.amount, 0);
      return { expenses: rows, total, count: rows.length };
    }),

  create: protectedProcedure
    .input(z.object({
      amount: z.number().min(1),
      category: z.string().default("기타"),
      memo: z.string().optional(),
      expenseDate: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const trainerId = ctx.user.trainerId;
      if (!trainerId) throw new TRPCError({ code: "FORBIDDEN" });
      await pool.query(
        `INSERT INTO expenses ("trainerId", amount, category, memo, "expenseDate") VALUES ($1,$2,$3,$4,$5)`,
        [trainerId, input.amount, input.category, input.memo ?? null, input.expenseDate]
      );
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const trainerId = ctx.user.trainerId;
      if (!trainerId) throw new TRPCError({ code: "FORBIDDEN" });
      await pool.query(`DELETE FROM expenses WHERE id=$1 AND "trainerId"=$2`, [input.id, trainerId]);
      return { success: true };
    }),
});

// ─── App Router ───────────────────────────────────────────────────────────────

// ── 운동 프로그램 템플릿 ───────────────────────────────────────────────────
// ── 작업실 잠금해제 ────────────────────────────────────────────────────────
const WORKSHOP_FEATURES: Record<string, { label: string; points: number }> = {
  workshop_access:  { label: "작업실 오픈",             points: 0 },
};

const WORKSHOP_TRIAL_DAYS = 30;
const WORKSHOP_GRACE_DAYS = 2;

const ELITE_TRIAL_DAYS = 30;

const workshopRouter = t.router({
  // 작업실 상태 조회 (미오픈 / 체험중 / 유예 / 잠금 / 활성화)
  getStatus: protectedProcedure.query(async ({ ctx }) => {
    const trainerId = ctx.user.trainerId;
    const cfgRows = await pool.query<{ featureId: string; status: string }>(`SELECT "featureId", status FROM workshop_feature_config`);
    const featureConfigs: Record<string, string> = {};
    for (const row of cfgRows.rows) featureConfigs[row.featureId] = row.status;

    if (!trainerId) return { status: "active", daysRemaining: null as number | null, trialStartedAt: null as string | null, featureConfigs, removedFeatures: [] as string[], eliteTrial: null as null | { status: "active"|"expired"; daysRemaining: number; extensionRequested: boolean } };

    const settingsRow = await pool.query<{ workshopTrialStartedAt: string | null; removedFeatures: string | null }>(
      `SELECT "workshopTrialStartedAt", "removedFeatures" FROM trainer_settings WHERE "trainerId"=$1`,
      [trainerId]
    );
    const row0 = settingsRow.rows[0];
    const removedFeatures = (row0?.removedFeatures ?? "").split(",").filter(Boolean);

    // 코인 활성화 여부 확인
    const activated = await pool.query(
      `SELECT id FROM workshop_unlocks WHERE "trainerId"=$1 AND feature='workshop_access'`,
      [trainerId]
    );
    if (activated.rows.length > 0) {
      return { status: "active", daysRemaining: null as number | null, trialStartedAt: null as string | null, featureConfigs, removedFeatures, eliteTrial: null };
    }

    const trialStartedAt = row0?.workshopTrialStartedAt ?? null;
    if (!trialStartedAt) return { status: "unopened", daysRemaining: null as number | null, trialStartedAt: null as string | null, featureConfigs, removedFeatures, eliteTrial: null };

    const started = new Date(trialStartedAt);
    const daysSince = Math.floor((Date.now() - started.getTime()) / (1000 * 60 * 60 * 24));
    const trialDaysRemaining = Math.max(0, WORKSHOP_TRIAL_DAYS - daysSince);

    // 체험 기간 중에는 전체 기능(엘리트 포함) 활성화
    const eliteTrial: null | { status: "active"|"expired"; daysRemaining: number; extensionRequested: boolean } =
      trialDaysRemaining > 0
        ? { status: "active", daysRemaining: trialDaysRemaining, extensionRequested: false }
        : null;

    if (daysSince <= WORKSHOP_TRIAL_DAYS) {
      return { status: "trial", daysRemaining: trialDaysRemaining, trialStartedAt, featureConfigs, removedFeatures, eliteTrial };
    }
    if (daysSince <= WORKSHOP_TRIAL_DAYS + WORKSHOP_GRACE_DAYS) {
      return { status: "grace", daysRemaining: WORKSHOP_TRIAL_DAYS + WORKSHOP_GRACE_DAYS - daysSince, trialStartedAt, featureConfigs, removedFeatures, eliteTrial: null };
    }
    return { status: "locked", daysRemaining: 0, trialStartedAt, featureConfigs, removedFeatures, eliteTrial: null };
  }),

  // (기존 호환성 유지용 - 더 이상 별도 elite trial 없음)
  startEliteTrial: protectedProcedure.mutation(async () => {
    throw new TRPCError({ code: "BAD_REQUEST", message: "전체 기능 체험은 작업실 무료 체험으로 통합되었습니다." });
  }),

  requestEliteExtension: protectedProcedure.mutation(async () => {
    return { success: true };
  }),

  // 무료 체험 시작
  startTrial: protectedProcedure.mutation(async ({ ctx }) => {
    const trainerId = ctx.user.trainerId;
    if (!trainerId) throw new TRPCError({ code: "FORBIDDEN" });

    const existing = await pool.query(
      `SELECT "workshopTrialStartedAt" FROM trainer_settings WHERE "trainerId"=$1`,
      [trainerId]
    );
    if (existing.rows[0]?.workshopTrialStartedAt) {
      throw new TRPCError({ code: "CONFLICT", message: "이미 무료 체험이 시작되었습니다." });
    }
    const activated = await pool.query(
      `SELECT id FROM workshop_unlocks WHERE "trainerId"=$1 AND feature='workshop_access'`,
      [trainerId]
    );
    if (activated.rows.length > 0) {
      throw new TRPCError({ code: "CONFLICT", message: "이미 작업실이 활성화되어 있습니다." });
    }

    await pool.query(
      `INSERT INTO trainer_settings ("trainerId", "workshopTrialStartedAt")
       VALUES ($1, NOW()::text)
       ON CONFLICT ("trainerId") DO UPDATE SET "workshopTrialStartedAt" = NOW()::text`,
      [trainerId]
    );
    return { started: true };
  }),

  // 내 잠금해제 목록
  listUnlocks: protectedProcedure.query(async ({ ctx }) => {
    const trainerId = ctx.user.trainerId;
    // 어드민은 모든 기능 잠금해제 상태로 반환
    if (!trainerId) {
      return Object.entries(WORKSHOP_FEATURES).map(([key, meta]) => ({
        key, label: meta.label, points: meta.points, unlocked: true,
      }));
    }
    const rows = await pool.query<{ feature: string }>(
      `SELECT feature FROM workshop_unlocks WHERE "trainerId"=$1`, [trainerId]
    );
    const unlocked = new Set(rows.rows.map(r => r.feature));
    return Object.entries(WORKSHOP_FEATURES).map(([key, meta]) => ({
      key,
      label: meta.label,
      points: meta.points,
      unlocked: unlocked.has(key),
    }));
  }),

  // 포인트로 기능 잠금해제
  unlock: protectedProcedure.input(z.object({ feature: z.string() })).mutation(async ({ ctx, input }) => {
    const trainerId = ctx.user.trainerId;
    if (!trainerId) throw new TRPCError({ code: "FORBIDDEN" });
    const meta = WORKSHOP_FEATURES[input.feature];
    if (!meta) throw new TRPCError({ code: "BAD_REQUEST", message: "존재하지 않는 기능입니다." });

    // 이미 잠금해제됐는지 확인
    const existing = await pool.query(
      `SELECT id FROM workshop_unlocks WHERE "trainerId"=$1 AND feature=$2`, [trainerId, input.feature]
    );
    if (existing.rows.length > 0) throw new TRPCError({ code: "CONFLICT", message: "이미 잠금해제된 기능입니다." });

    if (meta.points > 0) {
      // 포인트 잔액 확인
      const balRow = await pool.query<{ balance: string }>(
        `SELECT COALESCE(SUM(amount),0) AS balance FROM fit_point_logs WHERE "trainerId"=$1 AND status='completed'`, [trainerId]
      );
      const balance = Number(balRow.rows[0]?.balance ?? 0);
      if (balance < meta.points) throw new TRPCError({ code: "FORBIDDEN", message: `포인트가 부족합니다. (필요: ${meta.points}P, 보유: ${balance}P)` });

      // 포인트 차감
      await pool.query(
        `INSERT INTO fit_point_logs ("trainerId", amount, type, memo, status) VALUES ($1,$2,'workshop_unlock',$3,'completed')`,
        [trainerId, -meta.points, `작업실 기능 잠금해제: ${meta.label}`]
      );
    }

    // 잠금해제 기록
    await pool.query(
      `INSERT INTO workshop_unlocks ("trainerId", feature, "pointsSpent") VALUES ($1,$2,$3)`,
      [trainerId, input.feature, meta.points]
    );
    return { success: true };
  }),

  remove: protectedProcedure
    .input(z.object({ feature: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const trainerId = ctx.user.trainerId;
      if (!trainerId) throw new TRPCError({ code: "FORBIDDEN" });
      const cur = await pool.query<{ removedFeatures: string }>(
        `SELECT COALESCE("removedFeatures",'') AS "removedFeatures" FROM trainer_settings WHERE "trainerId"=$1`, [trainerId]
      );
      const existing = cur.rows[0]?.removedFeatures ?? "";
      const list = existing.split(",").filter(Boolean);
      if (!list.includes(input.feature)) {
        const updated = [...list, input.feature].join(",");
        await pool.query(
          `INSERT INTO trainer_settings ("trainerId","removedFeatures") VALUES ($1,$2)
           ON CONFLICT ("trainerId") DO UPDATE SET "removedFeatures"=$2`,
          [trainerId, updated]
        );
      }
      return { success: true };
    }),

  restore: protectedProcedure
    .input(z.object({ feature: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const trainerId = ctx.user.trainerId;
      if (!trainerId) throw new TRPCError({ code: "FORBIDDEN" });
      const cur = await pool.query<{ removedFeatures: string }>(
        `SELECT COALESCE("removedFeatures",'') AS "removedFeatures" FROM trainer_settings WHERE "trainerId"=$1`, [trainerId]
      );
      const existing = cur.rows[0]?.removedFeatures ?? "";
      const updated = existing.split(",").filter(f => f && f !== input.feature).join(",");
      await pool.query(
        `INSERT INTO trainer_settings ("trainerId","removedFeatures") VALUES ($1,$2)
         ON CONFLICT ("trainerId") DO UPDATE SET "removedFeatures"=$2`,
        [trainerId, updated]
      );
      return { success: true };
    }),
});

const workoutTemplatesRouter = t.router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const trainerId = ctx.user.trainerId;
    if (!trainerId) throw new TRPCError({ code: "FORBIDDEN" });
    const rows = await pool.query<any>(`SELECT * FROM workout_templates WHERE "trainerId"=$1 ORDER BY id DESC`, [trainerId]);
    return rows.rows;
  }),
  create: protectedProcedure.input(z.object({
    name: z.string().min(1),
    description: z.string().optional(),
    bodyPart: z.string().optional(),
    exercisesJson: z.string().optional(),
  })).mutation(async ({ ctx, input }) => {
    const trainerId = ctx.user.trainerId;
    if (!trainerId) throw new TRPCError({ code: "FORBIDDEN" });
    const row = await pool.query<{ id: number }>(
      `INSERT INTO workout_templates ("trainerId", name, description, "bodyPart", "exercisesJson") VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      [trainerId, input.name, input.description ?? null, input.bodyPart ?? null, input.exercisesJson ?? null]
    );
    return { id: row.rows[0].id };
  }),
  delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
    const trainerId = ctx.user.trainerId;
    if (!trainerId) throw new TRPCError({ code: "FORBIDDEN" });
    await pool.query(`DELETE FROM workout_templates WHERE id=$1 AND "trainerId"=$2`, [input.id, trainerId]);
    return { success: true };
  }),
});

// ── 맞춤 상담 설문 ────────────────────────────────────────────────────────
const surveyRouter = t.router({
  listQuestions: protectedProcedure.query(async ({ ctx }) => {
    const trainerId = ctx.user.trainerId;
    if (!trainerId) throw new TRPCError({ code: "FORBIDDEN" });
    const rows = await pool.query<any>(`SELECT * FROM custom_survey_questions WHERE "trainerId"=$1 ORDER BY "sortOrder", id`, [trainerId]);
    return rows.rows;
  }),
  createQuestion: protectedProcedure.input(z.object({
    question: z.string().min(1),
    type: z.enum(["text", "choice", "scale"]),
    options: z.string().optional(),
    isRequired: z.number().optional(),
    sortOrder: z.number().optional(),
  })).mutation(async ({ ctx, input }) => {
    const trainerId = ctx.user.trainerId;
    if (!trainerId) throw new TRPCError({ code: "FORBIDDEN" });
    await pool.query(
      `INSERT INTO custom_survey_questions ("trainerId", question, type, options, "isRequired", "sortOrder") VALUES ($1,$2,$3,$4,$5,$6)`,
      [trainerId, input.question, input.type, input.options ?? null, input.isRequired ?? 0, input.sortOrder ?? 0]
    );
    return { success: true };
  }),
  deleteQuestion: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
    const trainerId = ctx.user.trainerId;
    if (!trainerId) throw new TRPCError({ code: "FORBIDDEN" });
    await pool.query(`DELETE FROM custom_survey_questions WHERE id=$1 AND "trainerId"=$2`, [input.id, trainerId]);
    return { success: true };
  }),
  getPublic: t.procedure.input(z.object({ trainerId: z.number().int() })).query(async ({ input }) => {
    const trainerRow = await pool.query<any>(`SELECT id, "trainerName", "profileImage", "brandColor" FROM trainers WHERE id=$1`, [input.trainerId]);
    const trainer = trainerRow.rows[0];
    if (!trainer) throw new TRPCError({ code: "NOT_FOUND" });
    const qRows = await pool.query<any>(`SELECT * FROM custom_survey_questions WHERE "trainerId"=$1 ORDER BY "sortOrder", id`, [trainer.id]);
    return { trainer, questions: qRows.rows };
  }),
  submit: t.procedure.input(z.object({
    trainerId: z.number().int(),
    respondentName: z.string().min(1),
    respondentPhone: z.string().optional(),
    answers: z.record(z.string()),
  })).mutation(async ({ input }) => {
    const trainerRow = await pool.query<{ id: number }>(`SELECT id FROM trainers WHERE id=$1`, [input.trainerId]);
    if (!trainerRow.rows[0]) throw new TRPCError({ code: "NOT_FOUND" });
    const trainerId = trainerRow.rows[0].id;
    await pool.query(
      `INSERT INTO custom_survey_responses ("trainerId", "respondentName", "respondentPhone", answers) VALUES ($1,$2,$3,$4)`,
      [trainerId, input.respondentName, input.respondentPhone ?? null, JSON.stringify(input.answers)]
    );
    const today = new Date().toISOString().slice(0, 10);
    await pool.query(
      `INSERT INTO leads ("trainerId", name, phone, status, "consultationDate", "consultationNote") VALUES ($1,$2,$3,'pending',$4,'맞춤 설문 응답')`,
      [trainerId, input.respondentName, input.respondentPhone ?? "", today]
    );
    return { success: true };
  }),
  listResponses: protectedProcedure.query(async ({ ctx }) => {
    const trainerId = ctx.user.trainerId;
    if (!trainerId) throw new TRPCError({ code: "FORBIDDEN" });
    const rows = await pool.query<any>(`SELECT * FROM custom_survey_responses WHERE "trainerId"=$1 ORDER BY id DESC LIMIT 50`, [trainerId]);
    return rows.rows;
  }),
});

// ── 수업 예약 ──────────────────────────────────────────────────────────────
const bookingRouter = t.router({
  // 트레이너: 슬롯 목록 (월 기준)
  getSlots: protectedProcedure
    .input(z.object({ month: z.string() })) // "2025-06"
    .query(async ({ ctx, input }) => {
      const tid = (ctx.user as any).trainerId;
      const rows = await pool.query<any>(
        `SELECT * FROM booking_slots WHERE "trainerId"=$1 AND date LIKE $2 ORDER BY date, time`,
        [tid, `${input.month}%`]
      );
      return rows.rows;
    }),

  addSlot: protectedProcedure
    .input(z.object({ date: z.string(), times: z.array(z.string()) }))
    .mutation(async ({ ctx, input }) => {
      const tid = (ctx.user as any).trainerId;
      for (const time of input.times) {
        await pool.query(
          `INSERT INTO booking_slots ("trainerId", date, time) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
          [tid, input.date, time]
        );
      }
      return { success: true };
    }),

  deleteSlot: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const tid = (ctx.user as any).trainerId;
      await pool.query(`DELETE FROM booking_slots WHERE id=$1 AND "trainerId"=$2 AND "isBooked"=0`, [input.id, tid]);
      return { success: true };
    }),

  // 반복 일정
  getRecurring: protectedProcedure.query(async ({ ctx }) => {
    const tid = (ctx.user as any).trainerId;
    const rows = await pool.query<any>(`SELECT * FROM booking_recurring WHERE "trainerId"=$1 ORDER BY "dayOfWeek"`, [tid]);
    return rows.rows.map((r: any) => ({ ...r, times: JSON.parse(r.times || "[]") }));
  }),

  saveRecurring: protectedProcedure
    .input(z.array(z.object({ dayOfWeek: z.number(), times: z.array(z.string()) })))
    .mutation(async ({ ctx, input }) => {
      const tid = (ctx.user as any).trainerId;
      await pool.query(`DELETE FROM booking_recurring WHERE "trainerId"=$1`, [tid]);
      for (const r of input) {
        if (r.times.length > 0) {
          await pool.query(
            `INSERT INTO booking_recurring ("trainerId", "dayOfWeek", times) VALUES ($1,$2,$3)`,
            [tid, r.dayOfWeek, JSON.stringify(r.times)]
          );
        }
      }
      return { success: true };
    }),

  // 반복 일정 → 슬롯 생성 (앞으로 N주)
  generateFromRecurring: protectedProcedure
    .input(z.object({ weeks: z.number().min(1).max(12) }))
    .mutation(async ({ ctx, input }) => {
      const tid = (ctx.user as any).trainerId;
      const recurring = await pool.query<any>(`SELECT * FROM booking_recurring WHERE "trainerId"=$1 AND active=1`, [tid]);
      const blackouts = await pool.query<any>(`SELECT date FROM booking_blackouts WHERE "trainerId"=$1`, [tid]);
      const blackoutSet = new Set(blackouts.rows.map((r: any) => r.date));
      let created = 0;
      const today = new Date(); today.setHours(0, 0, 0, 0);
      for (let w = 0; w < input.weeks; w++) {
        for (let d = 0; d < 7; d++) {
          const dt = new Date(today); dt.setDate(today.getDate() + w * 7 + d);
          const dow = dt.getDay();
          const dateStr = dt.toISOString().slice(0, 10);
          if (blackoutSet.has(dateStr)) continue;
          const rec = recurring.rows.find((r: any) => r.dayOfWeek === dow);
          if (!rec) continue;
          const times: string[] = JSON.parse(rec.times || "[]");
          for (const time of times) {
            const exists = await pool.query(`SELECT id FROM booking_slots WHERE "trainerId"=$1 AND date=$2 AND time=$3`, [tid, dateStr, time]);
            if (exists.rows.length === 0) {
              await pool.query(`INSERT INTO booking_slots ("trainerId", date, time) VALUES ($1,$2,$3)`, [tid, dateStr, time]);
              created++;
            }
          }
        }
      }
      return { created };
    }),

  // 휴무일
  getBlackouts: protectedProcedure.query(async ({ ctx }) => {
    const tid = (ctx.user as any).trainerId;
    const rows = await pool.query<any>(`SELECT * FROM booking_blackouts WHERE "trainerId"=$1 ORDER BY date`, [tid]);
    return rows.rows;
  }),
  addBlackout: protectedProcedure.input(z.object({ date: z.string() })).mutation(async ({ ctx, input }) => {
    const tid = (ctx.user as any).trainerId;
    await pool.query(`INSERT INTO booking_blackouts ("trainerId", date) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [tid, input.date]);
    return { success: true };
  }),
  deleteBlackout: protectedProcedure.input(z.object({ date: z.string() })).mutation(async ({ ctx, input }) => {
    const tid = (ctx.user as any).trainerId;
    await pool.query(`DELETE FROM booking_blackouts WHERE "trainerId"=$1 AND date=$2`, [tid, input.date]);
    return { success: true };
  }),

  // 예약 목록 (트레이너)
  listBookings: protectedProcedure.query(async ({ ctx }) => {
    const tid = (ctx.user as any).trainerId;
    const rows = await pool.query<any>(
      `SELECT * FROM consultation_bookings WHERE "trainerId"=$1 ORDER BY id DESC LIMIT 100`, [tid]
    );
    return rows.rows;
  }),

  updateStatus: protectedProcedure
    .input(z.object({ id: z.number(), status: z.enum(["pending", "confirmed", "visited", "cancelled", "noshow"]) }))
    .mutation(async ({ ctx, input }) => {
      const tid = (ctx.user as any).trainerId;
      await pool.query(`UPDATE consultation_bookings SET status=$1 WHERE id=$2 AND "trainerId"=$3`, [input.status, input.id, tid]);
      return { success: true };
    }),

  // ── 공개 API (회원용) ──
  getAvailableDates: t.procedure
    .input(z.object({ trainerId: z.number(), month: z.string() }))
    .query(async ({ input }) => {
      const rows = await pool.query<any>(
        `SELECT date, COUNT(*) as total, SUM("isBooked"::int) as booked
         FROM booking_slots WHERE "trainerId"=$1 AND date LIKE $2
         GROUP BY date ORDER BY date`,
        [input.trainerId, `${input.month}%`]
      );
      const blackouts = await pool.query<any>(
        `SELECT date FROM booking_blackouts WHERE "trainerId"=$1 AND date LIKE $2`,
        [input.trainerId, `${input.month}%`]
      );
      const blackoutSet = new Set(blackouts.rows.map((r: any) => r.date));
      return rows.rows
        .filter((r: any) => !blackoutSet.has(r.date) && Number(r.total) > Number(r.booked))
        .map((r: any) => ({ date: r.date, available: Number(r.total) - Number(r.booked) }));
    }),

  getAvailableSlots: t.procedure
    .input(z.object({ trainerId: z.number(), date: z.string() }))
    .query(async ({ input }) => {
      const blackout = await pool.query(`SELECT id FROM booking_blackouts WHERE "trainerId"=$1 AND date=$2`, [input.trainerId, input.date]);
      if (blackout.rows.length > 0) return [];
      const rows = await pool.query<any>(
        `SELECT id, time, "isBooked" FROM booking_slots WHERE "trainerId"=$1 AND date=$2 ORDER BY time`,
        [input.trainerId, input.date]
      );
      return rows.rows;
    }),

  submitWithSlot: t.procedure
    .input(z.object({
      trainerId: z.number(),
      slotId: z.number(),
      name: z.string().min(1),
      phone: z.string().min(1),
      interestType: z.string().optional(),
      message: z.string().optional(),
      reservedDate: z.string(),
      reservedTime: z.string(),
    }))
    .mutation(async ({ input }) => {
      // 슬롯 잠금 확인
      const slot = await pool.query<any>(`SELECT * FROM booking_slots WHERE id=$1 AND "trainerId"=$2 FOR UPDATE`, [input.slotId, input.trainerId]);
      if (!slot.rows[0]) throw new TRPCError({ code: "NOT_FOUND", message: "슬롯을 찾을 수 없습니다." });
      if (slot.rows[0].isBooked) throw new TRPCError({ code: "CONFLICT", message: "이미 예약된 시간입니다." });
      await pool.query(`UPDATE booking_slots SET "isBooked"=1 WHERE id=$1`, [input.slotId]);
      const result = await pool.query<any>(
        `INSERT INTO consultation_bookings ("trainerId", name, phone, "interestType", message, status, "slotId", "reservedDate", "reservedTime")
         VALUES ($1,$2,$3,$4,$5,'confirmed',$6,$7,$8) RETURNING id`,
        [input.trainerId, input.name, input.phone, input.interestType ?? null, input.message ?? null, input.slotId, input.reservedDate, input.reservedTime]
      );
      // 이메일 알림 (fire-and-forget)
      const trainerRow = await pool.query<any>(`SELECT email, "trainerName" FROM trainers WHERE id=$1`, [input.trainerId]);
      const tr = trainerRow.rows[0];
      if (tr?.email) {
        sendBookingNotificationEmail(tr.email, tr.trainerName ?? "", {
          name: input.name, phone: input.phone,
          interestType: input.interestType,
          message: `${input.reservedDate} ${input.reservedTime}${input.message ? ` / ${input.message}` : ""}`,
        });
      }
      return { success: true, bookingId: result.rows[0].id };
    }),
});

// ── 브랜드 페이지 ──────────────────────────────────────────────────────────
const brandRouter = t.router({
  // 내 브랜드 설정 조회
  getMyBrand: protectedProcedure.query(async ({ ctx }) => {
    const trainerId = ctx.user.trainerId;
    if (!trainerId) throw new TRPCError({ code: "FORBIDDEN" });
    const row = await pool.query<any>(
      `SELECT t."brandBio",t."brandSpecialties",t."brandColor",t."brandInstagram",t."brandKakao",t."brandYoutube",t."brandIsPublic",t."bookingEnabled",t."bookingMessage",t."brandMessage",t."trainerName",t."profileImage",t."activityArea",t."jobType",t."careerRange",t."brandBlocks",u.username
       FROM trainers t JOIN users u ON t."userId"=u.id WHERE t.id=$1`,
      [trainerId]
    );
    return row.rows[0] ?? {};
  }),

  // 브랜드 설정 저장
  updateMyBrand: protectedProcedure.input(z.object({
    brandBio: z.string().optional(),
    brandSpecialties: z.string().optional(),
    brandColor: z.string().optional(),
    brandInstagram: z.string().optional(),
    brandKakao: z.string().optional(),
    brandYoutube: z.string().optional(),
    brandIsPublic: z.number().optional(),
    bookingEnabled: z.number().optional(),
    bookingMessage: z.string().optional(),
    brandMessage: z.string().optional(),
    brandBlocks: z.string().optional(),
    profileImage: z.string().optional(),
  })).mutation(async ({ ctx, input }) => {
    const trainerId = ctx.user.trainerId;
    if (!trainerId) throw new TRPCError({ code: "FORBIDDEN" });
    const fields = Object.entries(input).filter(([, v]) => v !== undefined);
    if (fields.length === 0) return;
    const sets = fields.map(([k], i) => `"${k}"=$${i + 1}`).join(", ");
    const vals = fields.map(([, v]) => v);
    await pool.query(`UPDATE trainers SET ${sets} WHERE id=$${vals.length + 1}`, [...vals, trainerId]);
    return { success: true };
  }),

  // 공개 브랜드 페이지 조회 (username 기준, 로그인 불필요)
  getPublicProfile: t.procedure.input(z.object({ username: z.string() })).query(async ({ input }) => {
    let row: any;
    const numericId = parseInt(input.username);
    if (!isNaN(numericId)) {
      row = await pool.query<any>(
        `SELECT t.id AS "trainerId", t."trainerName", t."profileImage", t."activityArea", t."jobType", t."careerRange",
                t."brandBio", t."brandSpecialties", t."brandColor", t."brandInstagram", t."brandKakao", t."brandYoutube",
                t."brandIsPublic", t."bookingEnabled", t."bookingMessage", t."brandBlocks"
         FROM trainers t WHERE t.id=$1`,
        [numericId]
      );
    } else {
      // username으로 조회 (기존 한글 링크 후방호환)
      const decoded = decodeURIComponent(input.username);
      const userRow = await pool.query<{ id: number }>(`SELECT id FROM users WHERE username=$1`, [decoded]);
      if (!userRow.rows[0]) throw new TRPCError({ code: "NOT_FOUND" });
      row = await pool.query<any>(
        `SELECT t.id AS "trainerId", t."trainerName", t."profileImage", t."activityArea", t."jobType", t."careerRange",
                t."brandBio", t."brandSpecialties", t."brandColor", t."brandInstagram", t."brandKakao", t."brandYoutube",
                t."brandIsPublic", t."bookingEnabled", t."bookingMessage", t."brandBlocks"
         FROM trainers t WHERE t."userId"=$1`,
        [userRow.rows[0].id]
      );
    }
    const trainer = row.rows[0];
    if (!trainer || !trainer.brandIsPublic) throw new TRPCError({ code: "NOT_FOUND", message: "공개된 페이지가 없습니다." });

    // 트레이너가 brand_page 기능을 제거했는지 확인
    const settingsRow = await pool.query<{ removedFeatures: string | null }>(
      `SELECT "removedFeatures" FROM trainer_settings WHERE "trainerId"=$1`,
      [trainer.trainerId]
    );
    const removedFeatures = (settingsRow.rows[0]?.removedFeatures ?? "").split(",").filter(Boolean);
    if (removedFeatures.includes("brand_page")) {
      throw new TRPCError({ code: "NOT_FOUND", message: "공개된 페이지가 없습니다." });
    }

    return trainer;
  }),

  // 공개 상담 예약 제출
  submitBooking: t.procedure.input(z.object({
    trainerId: z.number(),
    name: z.string().min(1),
    phone: z.string().min(1),
    interestType: z.string().optional(),
    message: z.string().optional(),
  })).mutation(async ({ input }) => {
    await pool.query(
      `INSERT INTO consultation_bookings ("trainerId", name, phone, "interestType", message) VALUES ($1,$2,$3,$4,$5)`,
      [input.trainerId, input.name, input.phone, input.interestType ?? null, input.message ?? null]
    );
    // 리드에도 자동 등록
    const today = new Date().toISOString().slice(0, 10);
    await pool.query(
      `INSERT INTO leads ("trainerId", name, phone, status, "consultationDate", "interestType", "consultationNote")
       VALUES ($1,$2,$3,'pending',$4,$5,'브랜드 페이지 예약 신청')`,
      [input.trainerId, input.name, input.phone, today, input.interestType ?? null]
    );
    // 트레이너 이메일 조회 후 알림 발송 (실패해도 예약은 정상 처리)
    const trainerRow = await pool.query<{ email: string | null; trainerName: string | null }>(
      `SELECT t.email, t."trainerName" FROM trainers t WHERE t.id=$1`,
      [input.trainerId]
    );
    const trainerEmail = trainerRow.rows[0]?.email;
    const trainerName = trainerRow.rows[0]?.trainerName ?? "트레이너";
    if (trainerEmail) {
      sendBookingNotificationEmail(trainerEmail, trainerName, {
        name: input.name,
        phone: input.phone,
        interestType: input.interestType,
        message: input.message,
      });
    }
    return { success: true };
  }),

  // 내 예약 목록 조회
  listBookings: protectedProcedure.query(async ({ ctx }) => {
    const trainerId = ctx.user.trainerId;
    if (!trainerId) throw new TRPCError({ code: "FORBIDDEN" });
    const rows = await pool.query<any>(
      `SELECT * FROM consultation_bookings WHERE "trainerId"=$1 ORDER BY id DESC LIMIT 50`,
      [trainerId]
    );
    return rows.rows;
  }),

  // 예약 상태 변경
  updateBookingStatus: protectedProcedure.input(z.object({
    bookingId: z.number(),
    status: z.enum(["pending", "confirmed", "cancelled"]),
  })).mutation(async ({ ctx, input }) => {
    const trainerId = ctx.user.trainerId;
    if (!trainerId) throw new TRPCError({ code: "FORBIDDEN" });
    await pool.query(`UPDATE consultation_bookings SET status=$1 WHERE id=$2 AND "trainerId"=$3`, [input.status, input.bookingId, trainerId]);
    return { success: true };
  }),
});

// ── 성장 아카데미 ──────────────────────────────────────────────────────────────
const academyRouter = t.router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const isAdmin = ctx.user.role === "admin";
    const trainerId = ctx.user.trainerId;
    const whereClause = isAdmin ? `` : `WHERE "isPublished"=1`;
    const courses = await pool.query<any>(
      `SELECT * FROM academy_courses ${whereClause} ORDER BY id DESC`
    );
    if (isAdmin) return courses.rows.map((c: any) => ({ ...c, completed: false }));
    // 완료 여부 포함
    const completions = trainerId
      ? await pool.query<{ courseId: number }>(
          `SELECT "courseId" FROM academy_completions WHERE "trainerId"=$1`, [trainerId]
        )
      : { rows: [] as { courseId: number }[] };
    const completedSet = new Set(completions.rows.map(r => r.courseId));
    return courses.rows.map((c: any) => ({ ...c, completed: completedSet.has(c.id) }));
  }),

  create: adminProcedure
    .input(z.object({
      title: z.string().min(1),
      description: z.string().optional(),
      videoUrl: z.string().optional(),
      thumbnailUrl: z.string().optional(),
      duration: z.string().optional(),
      timerSeconds: z.number().int().min(0).default(0),
      courseType: z.enum(["online", "offline"]).default("online"),
      pointReward: z.number().int().min(0).default(0),
      isPublished: z.number().int().min(0).max(1).default(0),
    }))
    .mutation(async ({ ctx, input }) => {
      const row = await pool.query<any>(
        `INSERT INTO academy_courses (title, description, "videoUrl", "thumbnailUrl", duration, "timerSeconds", "courseType", "pointReward", "isPublished", "createdBy")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
        [input.title, input.description ?? null, input.videoUrl ?? null, input.thumbnailUrl ?? null,
         input.duration ?? null, input.timerSeconds, input.courseType, input.pointReward, input.isPublished, ctx.user.id]
      );
      return row.rows[0];
    }),

  update: adminProcedure
    .input(z.object({
      id: z.number(),
      title: z.string().min(1).optional(),
      description: z.string().optional(),
      videoUrl: z.string().optional(),
      thumbnailUrl: z.string().optional(),
      duration: z.string().optional(),
      timerSeconds: z.number().int().min(0).optional(),
      courseType: z.enum(["online", "offline"]).optional(),
      pointReward: z.number().int().min(0).optional(),
      isPublished: z.number().int().min(0).max(1).optional(),
    }))
    .mutation(async ({ input }) => {
      const { id, ...fields } = input;
      const sets: string[] = [`"updatedAt"=now()::text`];
      const vals: any[] = [];
      let i = 1;
      if (fields.title !== undefined) { sets.push(`title=$${i++}`); vals.push(fields.title); }
      if (fields.description !== undefined) { sets.push(`description=$${i++}`); vals.push(fields.description); }
      if (fields.videoUrl !== undefined) { sets.push(`"videoUrl"=$${i++}`); vals.push(fields.videoUrl); }
      if (fields.thumbnailUrl !== undefined) { sets.push(`"thumbnailUrl"=$${i++}`); vals.push(fields.thumbnailUrl); }
      if (fields.duration !== undefined) { sets.push(`duration=$${i++}`); vals.push(fields.duration); }
      if (fields.timerSeconds !== undefined) { sets.push(`"timerSeconds"=$${i++}`); vals.push(fields.timerSeconds); }
      if (fields.courseType !== undefined) { sets.push(`"courseType"=$${i++}`); vals.push(fields.courseType); }
      if (fields.pointReward !== undefined) { sets.push(`"pointReward"=$${i++}`); vals.push(fields.pointReward); }
      if (fields.isPublished !== undefined) { sets.push(`"isPublished"=$${i++}`); vals.push(fields.isPublished); }
      vals.push(id);
      const row = await pool.query<any>(
        `UPDATE academy_courses SET ${sets.join(",")} WHERE id=$${i} RETURNING *`, vals
      );
      return row.rows[0];
    }),

  delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await pool.query(`DELETE FROM academy_completions WHERE "courseId"=$1`, [input.id]);
      await pool.query(`DELETE FROM academy_courses WHERE id=$1`, [input.id]);
      return { ok: true };
    }),

  complete: protectedProcedure
    .input(z.object({ courseId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const trainerId = ctx.user.trainerId;
      if (!trainerId) throw new TRPCError({ code: "FORBIDDEN" });
      // 이미 완료했는지 확인
      const existing = await pool.query<{ id: number }>(
        `SELECT id FROM academy_completions WHERE "courseId"=$1 AND "trainerId"=$2 LIMIT 1`,
        [input.courseId, trainerId]
      );
      if (existing.rows.length > 0) throw new TRPCError({ code: "CONFLICT", message: "이미 완료한 강의입니다." });
      // 포인트 확인
      const course = await pool.query<{ pointReward: number; isPublished: number }>(
        `SELECT "pointReward", "isPublished" FROM academy_courses WHERE id=$1 LIMIT 1`, [input.courseId]
      );
      if (!course.rows[0] || !course.rows[0].isPublished) throw new TRPCError({ code: "NOT_FOUND" });
      const reward = course.rows[0].pointReward;
      // 완료 기록
      await pool.query(
        `INSERT INTO academy_completions ("courseId","trainerId") VALUES ($1,$2)`,
        [input.courseId, trainerId]
      );
      // 포인트 지급
      if (reward > 0) {
        await pool.query(
          `INSERT INTO fit_point_logs ("trainerId", amount, type, memo, status) VALUES ($1,$2,'academy_complete',$3,'completed')`,
          [trainerId, reward, `아카데미 강의 완료 보상`]
        );
      }
      return { ok: true, pointReward: reward };
    }),
});

const trainerFeedbackRouter = t.router({
  submit: protectedProcedure
    .input(z.object({
      category: z.enum(["bug", "task", "improvement", "question"]),
      title: z.string().min(1).max(100),
      content: z.string().min(1).max(2000),
    }))
    .mutation(async ({ ctx, input }) => {
      const trainerId = ctx.user.trainerId;
      if (!trainerId) throw new TRPCError({ code: "FORBIDDEN" });
      const trainerRow = await pool.query<{ name: string; username: string }>(
        `SELECT t."trainerName" AS name, u.username FROM trainers t JOIN users u ON t."userId" = u.id WHERE t.id = $1 LIMIT 1`,
        [trainerId]
      );
      const trainerName = trainerRow.rows[0]?.name ?? "unknown";
      const username = trainerRow.rows[0]?.username ?? "unknown";
      await pool.query(
        `INSERT INTO trainer_feedbacks ("trainerId", "trainerName", username, category, title, content) VALUES ($1,$2,$3,$4,$5,$6)`,
        [trainerId, trainerName, username, input.category, input.title, input.content]
      );
      return { success: true };
    }),

  myList: protectedProcedure.query(async ({ ctx }) => {
    const trainerId = ctx.user.trainerId;
    if (!trainerId) throw new TRPCError({ code: "FORBIDDEN" });
    const result = await pool.query<{ id: number; category: string; title: string; content: string; status: string; adminNote: string | null; createdAt: string }>(
      `SELECT id, category, title, content, status, "adminNote", "createdAt" FROM trainer_feedbacks WHERE "trainerId"=$1 ORDER BY "createdAt" DESC`,
      [trainerId]
    );
    return result.rows;
  }),

  adminList: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
    const result = await pool.query<{ id: number; trainerId: number; trainerName: string; username: string; category: string; title: string; content: string; status: string; adminNote: string | null; createdAt: string; updatedAt: string }>(
      `SELECT id, "trainerId", "trainerName", username, category, title, content, status, "adminNote", "createdAt", "updatedAt" FROM trainer_feedbacks ORDER BY "createdAt" DESC`
    );
    return result.rows;
  }),

  updateStatus: protectedProcedure
    .input(z.object({ id: z.number(), status: z.enum(["pending", "in_progress", "done", "rejected"]), adminNote: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      await pool.query(
        `UPDATE trainer_feedbacks SET status=$1, "adminNote"=$2, "updatedAt"=now()::text WHERE id=$3`,
        [input.status, input.adminNote ?? null, input.id]
      );
      return { success: true };
    }),
});

export const appRouter = t.router({
  auth: authRouter,
  members: membersRouter,
  pt: ptRouter,
  attendances: attendancesRouter,
  trainers: trainersRouter,
  dashboard: dashboardRouter,
  workoutMemos: workoutMemosRouter,
  parQ: parQRouter,
  attendanceChecks: attendanceChecksRouter,
  reports: reportsRouter,
  schedules: schedulesRouter,
  admin: adminRouter,
  notices: noticesRouter,
  banner: bannerRouter,
  tabBanner: tabBannerRouter,
  channels: channelsRouter,
  leads: leadsRouter,
  trainingLog: trainingLogRouter,
  fitPoints: fitPointsRouter,
  expenses: expensesRouter,
  fitStepPlus: fitStepPlusRouter,
  brand: brandRouter,
  workoutTemplates: workoutTemplatesRouter,
  survey: surveyRouter,
  workshop: workshopRouter,
  academy: academyRouter,
  eContract: eContractRouter,
  booking: bookingRouter,
  trainerFeedback: trainerFeedbackRouter,
});

export type AppRouter = typeof appRouter;
