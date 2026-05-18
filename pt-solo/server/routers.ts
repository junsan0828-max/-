import { initTRPC, TRPCError } from "@trpc/server";
import { z } from "zod";
import { eq, and, desc, sql, gt, gte, lte, isNull } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { getDb, getDashboardStats, pool } from "./db";
import { sendVerificationEmail } from "./email";
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
} from "../drizzle/schema";
import { randomUUID } from "crypto";
import type { AuthUser } from "./auth";
import type { Request, Response } from "express";

interface Context {
  user?: AuthUser;
  req: Request;
  res: Response;
}

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
    return { ...ctx.user, plan: row[0]?.plan ?? "free" };
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
      email: z.string().email(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();

      const existing = await db.select({ id: users.id }).from(users).where(eq(users.username, input.username)).limit(1);
      if (existing[0]) throw new TRPCError({ code: "CONFLICT", message: "이미 사용 중인 아이디입니다." });

      const hashed = await bcrypt.hash(input.password, 10);
      const [userRow] = await db.insert(users).values({ username: input.username, password: hashed, role: "trainer" }).returning({ id: users.id });
      const [trainerRow] = await db.insert(trainers).values({ userId: userRow.id, trainerName: input.trainerName, phone: input.phone, email: input.email }).returning({ id: trainers.id });
      await db.insert(trainerSettings).values({ trainerId: trainerRow.id, settlementRate: 50 });

      const authUser: AuthUser = { id: userRow.id, username: input.username, role: "trainer", trainerId: trainerRow.id };
      ctx.req.session.user = authUser;
      return authUser;
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
      if ((planRow?.plan ?? "free") === "free") {
        const [cnt] = await db.select({ count: sql<number>`COUNT(*)` }).from(members).where(eq(members.trainerId, trainerId));
        if (Number(cnt?.count ?? 0) >= 20) throw new TRPCError({ code: "FORBIDDEN", message: "FREE 플랜은 회원을 최대 20명까지 등록할 수 있습니다." });
      }

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
    }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const trainerId = ctx.user.trainerId;
      if (!trainerId) throw new TRPCError({ code: "FORBIDDEN" });

      const pricePerSession = calcPricePerSession(input.paymentAmount, input.totalSessions, input.paymentMethod);

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
    }>(`SELECT "employmentType","workplaceName","workYears","specialties","profileBonusGranted" FROM trainers WHERE id=$1`, [ctx.user.trainerId]);
    const ext = row.rows[0] ?? { employmentType: null, workplaceName: null, workYears: null, specialties: null, profileBonusGranted: 0 };
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
      employmentType: z.enum(["freelancer", "employed"]).optional(),
      workplaceName: z.string().optional(),
      workYears: z.number().int().min(0).max(50).optional(),
      specialties: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user.trainerId) throw new TRPCError({ code: "FORBIDDEN" });
      await pool.query(
        `UPDATE trainers SET "employmentType"=$1,"workplaceName"=$2,"workYears"=$3,"specialties"=$4 WHERE id=$5`,
        [input.employmentType ?? null, input.workplaceName ?? null, input.workYears ?? null, input.specialties ?? null, ctx.user.trainerId]
      );
      // 프로필 완성 보너스 자동 지급 (최초 1회)
      const check = await pool.query<{ profileBonusGranted: number }>(
        `SELECT "profileBonusGranted" FROM trainers WHERE id=$1`, [ctx.user.trainerId]
      );
      const bonusGranted = check.rows[0]?.profileBonusGranted ?? 0;
      const isComplete = !!(input.employmentType && input.workplaceName && input.workYears !== undefined && input.specialties);
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
    return row[0] ?? { termsOfService: null, privacyPolicy: null, marketingConsent: null };
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
      const [attendCount, newMembers] = await Promise.all([
        db.select({ count: sql<number>`COUNT(*)` }).from(attendances).where(and(eq(attendances.trainerId, trainerId), eq(attendances.status, "attended"), sql`${attendances.attendDate} >= ${m.start}`, sql`${attendances.attendDate} < ${m.end}`)),
        db.select({ count: sql<number>`COUNT(*)` }).from(members).where(and(eq(members.trainerId, trainerId), sql`${members.createdAt} >= ${m.start}`, sql`${members.createdAt} < ${m.end}`)),
      ]);
      return { month: m.label, 출석: Number(attendCount[0]?.count ?? 0), 신규회원: Number(newMembers[0]?.count ?? 0) };
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
    .mutation(async ({ input }) => {
      const db = getDb();
      const { memberId, ...fields } = input;
      const existing = await db.select({ id: parQ.id }).from(parQ).where(eq(parQ.memberId, memberId)).limit(1);
      if (existing[0]) {
        await db.update(parQ).set({ ...fields, updatedAt: sql`now()::text` }).where(eq(parQ.memberId, memberId));
      } else {
        await db.insert(parQ).values({ memberId, ...fields });
      }
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
      const [memberRows, checks, memos, packages, attendanceList, sessionLogs] = await Promise.all([
        db.select().from(members).where(eq(members.id, memberId)).limit(1),
        db.select().from(attendanceChecks).where(eq(attendanceChecks.memberId, memberId)).orderBy(desc(attendanceChecks.checkDate)),
        db.select().from(workoutMemos).where(eq(workoutMemos.memberId, memberId)).orderBy(desc(workoutMemos.memoDate)),
        db.select().from(ptPackages).where(eq(ptPackages.memberId, memberId)).orderBy(desc(ptPackages.createdAt)),
        db.select().from(attendances).where(eq(attendances.memberId, memberId)).orderBy(desc(attendances.attendDate)),
        db.select().from(ptSessionLogs).where(eq(ptSessionLogs.memberId, memberId)).orderBy(desc(ptSessionLogs.sessionDate)),
      ]);

      if (!memberRows[0]) throw new TRPCError({ code: "NOT_FOUND" });

      return {
        member: memberRows[0],
        conditionChecks: checks,
        workoutMemos: memos,
        ptPackages: packages,
        attendances: attendanceList,
        sessionLogs,
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

type TabBannerRow = { id: number; tabKey: string; text: string; subText: string | null; link: string | null; bgColor: string; isActive: number; imageUrl: string | null; bannerHeight: string };

const TAB_BANNER_SELECT = `SELECT id, "tabKey", text, "subText", link, "bgColor", "isActive", "imageUrl", "bannerHeight" FROM tab_banners`;

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
    }))
    .mutation(async ({ input }) => {
      const existing = await pool.query(`SELECT id FROM tab_banners WHERE "tabKey"=$1`, [input.tabKey]);
      if (existing.rows[0]) {
        await pool.query(
          `UPDATE tab_banners SET text=$1, "subText"=$2, link=$3, "bgColor"=$4, "isActive"=$5, "imageUrl"=$6, "bannerHeight"=$7, "updatedAt"=now()::text WHERE "tabKey"=$8`,
          [input.text, input.subText ?? null, input.link ?? null, input.bgColor, input.isActive ? 1 : 0, input.imageUrl ?? null, input.bannerHeight, input.tabKey]
        );
      } else {
        await pool.query(
          `INSERT INTO tab_banners ("tabKey", text, "subText", link, "bgColor", "isActive", "imageUrl", "bannerHeight") VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [input.tabKey, input.text, input.subText ?? null, input.link ?? null, input.bgColor, input.isActive ? 1 : 0, input.imageUrl ?? null, input.bannerHeight]
        );
      }
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
      const [mc, sc, ac, settingsRow] = await Promise.all([
        db.select({ count: sql<number>`COUNT(*)` }).from(members).where(eq(members.trainerId, tr.id)),
        db.select({ count: sql<number>`COUNT(*)` }).from(ptSessionLogs).where(eq(ptSessionLogs.trainerId, tr.id)),
        db.select({ count: sql<number>`COUNT(*)` }).from(attendanceChecks).where(eq(attendanceChecks.trainerId, tr.id)),
        db.select({ subscriptionStatus: trainerSettings.settlementRate, adminMemo: sql<string>`"adminMemo"`, subscriptionEndDate: sql<string>`"subscriptionEndDate"`, subStatus: sql<string>`"subscriptionStatus"` })
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
      subscriptionStatus: z.enum(["trial", "active", "expired", "suspended"]).optional(),
      subscriptionEndDate: z.string().optional().nullable(),
      adminMemo: z.string().optional().nullable(),
      plan: z.enum(["free", "light", "pro"]).optional(),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const { trainerId, plan, ...fields } = input;
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

  grantPoints: adminProcedure
    .input(z.object({ trainerId: z.number(), amount: z.number(), memo: z.string().optional() }))
    .mutation(async ({ input }) => {
      await pool.query(
        `INSERT INTO fit_point_logs ("trainerId", amount, type, memo, status) VALUES ($1,$2,'admin_grant',$3,'completed')`,
        [input.trainerId, input.amount, input.memo ?? null]
      );
      return { success: true };
    }),

  getTrainerPoints: adminProcedure
    .input(z.object({ trainerId: z.number() }))
    .query(async ({ input }) => {
      const bal = await pool.query<{ balance: string }>(
        `SELECT COALESCE(SUM(amount),0) AS balance FROM fit_point_logs WHERE "trainerId"=$1 AND status='completed'`,
        [input.trainerId]
      );
      const logs = await pool.query<{ id: number; amount: number; type: string; memo: string | null; status: string; createdAt: string }>(
        `SELECT id, amount, type, memo, status, "createdAt" FROM fit_point_logs WHERE "trainerId"=$1 ORDER BY id DESC LIMIT 30`,
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

  // ── 포인트 관리 ──
  listTrainersWithPoints: adminProcedure.query(async () => {
    const result = await pool.query<{
      trainerId: number; trainerName: string; username: string;
      balance: string; pendingAmount: string;
    }>(`
      SELECT t.id AS "trainerId", t."trainerName", u.username,
        COALESCE(SUM(CASE WHEN l.status='completed' THEN l.amount ELSE 0 END),0) AS balance,
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
    .input(z.object({ event: z.string(), amount: z.number().int().min(0), isEnabled: z.boolean() }))
    .mutation(async ({ input }) => {
      await pool.query(
        `UPDATE point_auto_rules SET amount=$1, "isEnabled"=$2, "updatedAt"=now()::text WHERE event=$3`,
        [input.amount, input.isEnabled ? 1 : 0, input.event]
      );
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
      const [row] = await db.update(leads).set({ ...data, updatedAt: new Date().toISOString() }).where(and(eq(leads.id, id), eq(leads.trainerId, trainerId))).returning();
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
      itemTypes: z.array(z.string()),
      programKey: z.string().optional(),
      programCustom: z.string().optional(),
      sessions: z.number().optional(),
      duration: z.number().optional(),
      subType: z.string().optional(),
      amount: z.number(),
      discountAmount: z.number(),
      paidAmount: z.number(),
      unpaidAmount: z.number(),
      paymentMethod: z.string().optional(),
      paymentDate: z.string(),
      startDate: z.string().optional(),
      memo: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const trainerId = ctx.user.trainerId;
      if (!trainerId) throw new TRPCError({ code: "FORBIDDEN" });
      const db = getDb();

      const [planRow] = await db.select({ plan: sql<string>`"plan"` }).from(users).where(eq(users.id, ctx.user.id)).limit(1);
      const plan = planRow?.plan ?? "free";
      if (plan === "free") {
        const [totalCnt] = await db.select({ count: sql<number>`COUNT(*)` }).from(members).where(eq(members.trainerId, trainerId));
        if (Number(totalCnt?.count ?? 0) >= 20) throw new TRPCError({ code: "FORBIDDEN", message: "FREE 플랜은 회원을 최대 20명까지 등록할 수 있습니다." });
        const now = new Date();
        const monthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
        const [monthlyCnt] = await db.select({ count: sql<number>`COUNT(*)` }).from(members)
          .where(and(eq(members.trainerId, trainerId), gte(members.createdAt, monthPrefix + "-01"), lte(members.createdAt, monthPrefix + "-31T23:59:59")));
        if (Number(monthlyCnt?.count ?? 0) >= 5) throw new TRPCError({ code: "FORBIDDEN", message: "FREE 플랜은 온라인 계약서를 월 5회까지 작성할 수 있습니다." });
      }

      const [member] = await db.insert(members).values({
        trainerId, name: input.name, phone: input.phone, gender: input.gender,
        status: "active", membershipStart: input.startDate,
      }).returning();
      if (input.sessions && input.itemTypes.includes("PT")) {
        const programName = input.programKey === "기타" ? (input.programCustom || "기타PT") : (input.programKey || "PT");
        await db.insert(ptPackages).values({
          memberId: member.id, trainerId, totalSessions: input.sessions, usedSessions: 0,
          packageName: programName, startDate: input.startDate, status: "active",
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
  getBalance: protectedProcedure.query(async ({ ctx }) => {
    const trainerId = ctx.user.trainerId;
    if (!trainerId) throw new TRPCError({ code: "FORBIDDEN" });
    const result = await pool.query<{ balance: string }>(
      `SELECT COALESCE(SUM(amount),0) AS balance FROM fit_point_logs WHERE "trainerId"=$1 AND status='completed'`,
      [trainerId]
    );
    return { balance: Number(result.rows[0]?.balance ?? 0) };
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
});

// ─── FIT STEP+ 회원앱 (트레이너별 격리) ──────────────────────────────────────

const fitStepPlusProtected = t.procedure.use(({ ctx, next }) => {
  const memberId = (ctx.req.session as any).fitStepPlusMemberId as number | undefined;
  if (!memberId) throw new TRPCError({ code: "UNAUTHORIZED" });
  return next({ ctx: { ...ctx, fitStepPlusMemberId: memberId } });
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

  // ── 어드민 현황 조회 ──
  admin_overview: adminProcedure.query(async () => {
    const memberCounts = await getDb().select({
      trainerId: members.trainerId,
      count: sql<number>`COUNT(*)`,
    }).from(members).groupBy(members.trainerId);
    return { memberCounts };
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
});

export type AppRouter = typeof appRouter;
