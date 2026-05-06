import { initTRPC, TRPCError } from "@trpc/server";
import { z } from "zod";
import { eq, and, desc, sql, gt, gte, lte, isNull } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { getDb, getDashboardStats } from "./db";
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
        role: "trainer",
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

  me: publicProcedure.query(({ ctx }) => {
    return ctx.user ?? null;
  }),

  register: publicProcedure
    .input(z.object({
      username: z.string().min(3).max(50),
      password: z.string().min(6),
      trainerName: z.string().min(1),
      phone: z.string().optional(),
      email: z.string().email().optional().or(z.literal("")),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();

      const existing = await db.select({ id: users.id }).from(users).where(eq(users.username, input.username)).limit(1);
      if (existing[0]) throw new TRPCError({ code: "CONFLICT", message: "이미 사용 중인 아이디입니다." });

      const hashed = await bcrypt.hash(input.password, 10);
      const [userRow] = await db.insert(users).values({ username: input.username, password: hashed, role: "trainer" }).returning({ id: users.id });
      const [trainerRow] = await db.insert(trainers).values({ userId: userRow.id, trainerName: input.trainerName, phone: input.phone, email: input.email || undefined }).returning({ id: trainers.id });
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
    return { ...trainer[0], settlementRate: settings[0]?.settlementRate ?? 50 };
  }),

  updateMyProfile: protectedProcedure
    .input(z.object({ trainerName: z.string().min(1), phone: z.string().optional(), email: z.string().email().optional().or(z.literal("")) }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      if (!ctx.user.trainerId) throw new TRPCError({ code: "FORBIDDEN" });
      await db.update(trainers).set({ trainerName: input.trainerName, phone: input.phone, email: input.email || undefined }).where(eq(trainers.id, ctx.user.trainerId));
      return { success: true };
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

      const checkMap = new Map(checks.map((c) => [c.memberId, c]));
      return memberList.map((m) => ({ ...m, check: checkMap.get(m.id) ?? null }));
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
      })
      .from(trainers)
      .leftJoin(users, eq(trainers.userId, users.id))
      .orderBy(desc(trainers.createdAt));

    const withStats = await Promise.all(trainerList.map(async (t) => {
      const [mc, sc] = await Promise.all([
        db.select({ count: sql<number>`COUNT(*)` }).from(members).where(eq(members.trainerId, t.id)),
        db.select({ count: sql<number>`COUNT(*)` }).from(ptSessionLogs).where(eq(ptSessionLogs.trainerId, t.id)),
      ]);
      return {
        ...t,
        memberCount: Number(mc[0]?.count ?? 0),
        sessionCount: Number(sc[0]?.count ?? 0),
      };
    }));
    return withStats;
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
});

export type AppRouter = typeof appRouter;
