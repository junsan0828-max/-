import { gymRouter } from "./gymRouters";
import { initTRPC, TRPCError } from "@trpc/server";
import { z } from "zod";
import { eq, and, desc, sql, lte, gte, gt, isNull, or } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { getDb, getDashboardStats } from "./db";
import {
  users,
  trainers,
  trainerSettings,
  members,
  ptPackages,
  attendances,
  ptSessionLogs,
  payments,
  workoutMemos,
  parQ,
  attendanceChecks,
  reportTokens,
  ptPauses,
  schedules,
  branches,
  trainerBranches,
} from "../drizzle/schema";
import { randomUUID } from "crypto";
import { sheetUrlToCsvUrl, parseCSV, syncSheetNow, fetchSheetCsv } from "./sheetSync";
import {
  sheetSyncConfig,
  sheetPendingMembers,
  gymPlusMembers,
  gymPlusVideoCategories,
  gymPlusVideos,
  gymPlusEvents,
  gymPlusWorkoutLogs,
} from "../drizzle/schema";
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

// ─── Auth ────────────────────────────────────────────────────────────────────

// 카드/현금영수증/지역화폐는 부가세 10% 제외, 이체는 그대로
function calcPricePerSession(paymentAmount: number | undefined, sessions: number | undefined, paymentMethod?: string): number | undefined {
  if (!paymentAmount || !sessions || sessions <= 0) return undefined;
  const base = paymentMethod === "이체" ? paymentAmount : Math.round(paymentAmount / 1.1);
  return Math.round(base / sessions);
}
const authRouter = t.router({
  login: publicProcedure
    .input(z.object({ username: z.string(), password: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const userResult = await db
        .select()
        .from(users)
        .where(eq(users.username, input.username))
        .limit(1);

      const user = userResult[0];
      if (!user)
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "아이디 또는 비밀번호가 잘못되었습니다.",
        });

      const valid = await bcrypt.compare(input.password, user.password);
      if (!valid)
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "아이디 또는 비밀번호가 잘못되었습니다.",
        });

      let trainerId: number | undefined;
      if (user.role === "trainer") {
        const trainerResult = await db
          .select({ id: trainers.id })
          .from(trainers)
          .where(eq(trainers.userId, user.id))
          .limit(1);
        trainerId = trainerResult[0]?.id;
      }

      await db.update(users).set({ lastLoginAt: new Date().toISOString() }).where(eq(users.id, user.id));

      const authUser: AuthUser = {
        id: user.id,
        username: user.username,
        role: user.role as AuthUser["role"],
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
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const existing = await db.select({ id: users.id }).from(users).where(eq(users.username, input.username)).limit(1);
      if (existing[0]) throw new TRPCError({ code: "CONFLICT", message: "이미 사용 중인 아이디입니다." });

      const hashed = await bcrypt.hash(input.password, 10);
      const [userRow] = await db.insert(users).values({ username: input.username, password: hashed, role: "trainer" }).returning({ id: users.id });
      const [trainerRow] = await db.insert(trainers).values({ userId: userRow.id, trainerName: input.trainerName, phone: input.phone, email: input.email || undefined }).returning({ id: trainers.id });
      await db.insert(trainerSettings).values({ trainerId: trainerRow.id, settlementRate: 50 });

      const authUser = { id: userRow.id, username: input.username, role: "trainer" as const, trainerId: trainerRow.id };
      ctx.req.session.user = authUser;
      return authUser;
    }),
});

// ─── Members ─────────────────────────────────────────────────────────────────
const membersRouter = t.router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    const trainerId = ctx.user.trainerId;
    if (!trainerId) throw new TRPCError({ code: "FORBIDDEN" });

    return db
      .select()
      .from(members)
      .where(eq(members.trainerId, trainerId))
      .orderBy(desc(members.createdAt));
  }),

  listAll: protectedProcedure
    .input(z.object({ branchId: z.number().optional() }).optional())
    .query(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    if (ctx.user.role !== "admin" && ctx.user.role !== "sub_admin")
      throw new TRPCError({ code: "FORBIDDEN" });

    const whereClause = input?.branchId ? eq(members.branchId, input.branchId) : undefined;

    const [rows, pkgs] = await Promise.all([
      db.select({
        id: members.id,
        name: members.name,
        phone: members.phone,
        status: members.status,
        grade: members.grade,
        membershipStart: members.membershipStart,
        membershipEnd: members.membershipEnd,
        profileNote: members.profileNote,
        trainerId: members.trainerId,
        branchId: members.branchId,
        trainerName: trainers.trainerName,
        createdAt: members.createdAt,
      }).from(members).leftJoin(trainers, eq(members.trainerId, trainers.id))
        .where(whereClause)
        .orderBy(desc(members.createdAt)),
      db.select({
        memberId: ptPackages.memberId,
        packageName: ptPackages.packageName,
        totalSessions: ptPackages.totalSessions,
      }).from(ptPackages),
    ]);

    const pkgMap = new Map<number, { packageName: string; totalSessions: number }[]>();
    for (const p of pkgs) {
      if (!pkgMap.has(p.memberId)) pkgMap.set(p.memberId, []);
      pkgMap.get(p.memberId)!.push({ packageName: p.packageName ?? "", totalSessions: p.totalSessions });
    }

    return rows.map((r) => ({ ...r, packages: pkgMap.get(r.id) ?? [] }));
  }),

  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const result = await db
        .select()
        .from(members)
        .where(eq(members.id, input.id))
        .limit(1);
      if (!result[0]) throw new TRPCError({ code: "NOT_FOUND" });
      return result[0];
    }),

  // N일 내 만료 예정 회원
  getExpiring: protectedProcedure
    .input(z.object({ days: z.number().default(7) }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const trainerId = ctx.user.trainerId;
      if (!trainerId) throw new TRPCError({ code: "FORBIDDEN" });

      const today = new Date().toISOString().split("T")[0];
      const future = new Date(Date.now() + input.days * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];

      return db
        .select()
        .from(members)
        .where(
          and(
            eq(members.trainerId, trainerId),
            eq(members.status, "active"),
            sql`${members.membershipEnd} IS NOT NULL`,
            sql`${members.membershipEnd} >= ${today}`,
            sql`${members.membershipEnd} <= ${future}`
          )
        )
        .orderBy(members.membershipEnd);
    }),

  // 미수금 있는 회원
  getWithUnpaid: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

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
      .where(
        and(
          eq(members.trainerId, trainerId),
          sql`${ptPackages.unpaidAmount} IS NOT NULL`,
          gt(ptPackages.unpaidAmount, 0)
        )
      )
      .orderBy(desc(ptPackages.unpaidAmount));
  }),

  create: protectedProcedure
    .input(
      z.object({
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
        adminTrainerId: z.number().optional(), // 관리자가 직접 담당 트레이너 지정
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // 관리자는 adminTrainerId 필수, 트레이너는 본인 ID 사용
      const trainerId = ctx.user.role === "admin"
        ? input.adminTrainerId ?? (() => { throw new TRPCError({ code: "BAD_REQUEST", message: "담당 트레이너를 선택해주세요." }); })()
        : ctx.user.trainerId ?? (() => { throw new TRPCError({ code: "FORBIDDEN" }); })();

      const {
        ptProgram,
        ptSessions,
        paymentAmount,
        unpaidAmount,
        paymentMethod,
        paymentDate,
        paymentMemo,
        adminTrainerId: _,
        ...memberData
      } = input;

      const [insertResult] = await db.insert(members).values({
        ...memberData,
        trainerId,
      }).returning({ id: members.id });
      const memberId = insertResult.id;

      if (ptSessions) {
        const sessionCount = parseInt(ptSessions);
        const packageName = ptProgram || undefined;
        const pricePerSession = calcPricePerSession(paymentAmount, sessionCount, paymentMethod);

        await db.insert(ptPackages).values({
          memberId,
          trainerId,
          totalSessions: sessionCount,
          usedSessions: 0,
          packageName,
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
    .input(
      z.object({
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
        trainerId: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const { id, ...data } = input;
      await db.update(members).set(data).where(eq(members.id, id));
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      await db.delete(members).where(eq(members.id, input.id));
      return { success: true };
    }),

  getPayments: protectedProcedure
    .input(z.object({ memberId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      return db
        .select()
        .from(payments)
        .where(eq(payments.memberId, input.memberId))
        .orderBy(desc(payments.createdAt));
    }),

  // PT 잔여 횟수 5회 이하 회원 (재등록 안내)
  getLowSessions: protectedProcedure
    .input(z.object({ threshold: z.number().default(5) }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

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

  // 장기 미출석 회원 (2주 이상)
  getLongAbsent: protectedProcedure
    .input(z.object({ days: z.number().default(14) }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

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
          const lastDate = last[0]?.attendDate ?? null;
          return { ...m, lastAttendDate: lastDate };
        })
      );

      return result.filter(m => !m.lastAttendDate || m.lastAttendDate < cutoff);
    }),

  // 회원 통계 (수업수/취소/노쇼/재등록 등)
  getStats: protectedProcedure
    .input(z.object({ memberId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

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
      const reregistered = pkgCount > 1;
      const reregistrationCount = Math.max(0, pkgCount - 1);

      return { totalSessions, cancelCount, noshowCount, lastSessionDate, reregistered, reregistrationCount, totalChecks: checks.length };
    }),

  // 일괄 만료일 연장
  bulkExtend: protectedProcedure
    .input(z.object({ memberIds: z.array(z.number()).min(1), days: z.number().min(1).max(3650) }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const trainerId = ctx.user.trainerId;
      if (!trainerId && ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });

      let updated = 0;
      for (const memberId of input.memberIds) {
        const rows = await db.select({ membershipEnd: members.membershipEnd })
          .from(members).where(eq(members.id, memberId)).limit(1);
        const current = rows[0];
        if (!current) continue;

        const base = current.membershipEnd
          ? new Date(current.membershipEnd)
          : new Date();
        if (isNaN(base.getTime())) continue;

        base.setDate(base.getDate() + input.days);
        const newEnd = base.toISOString().split("T")[0];
        await db.update(members).set({ membershipEnd: newEnd }).where(eq(members.id, memberId));
        updated++;
      }

      return { updated };
    }),

  // 미분류 회원 목록 (branchId=NULL이고 트레이너가 다중지점인 경우)
  listUnclassified: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    if (ctx.user.role !== "admin" && ctx.user.role !== "sub_admin")
      throw new TRPCError({ code: "FORBIDDEN" });

    const allTB = await db.select().from(trainerBranches);
    const tbMap = new Map<number, number[]>();
    for (const row of allTB) {
      if (!tbMap.has(row.trainerId)) tbMap.set(row.trainerId, []);
      tbMap.get(row.trainerId)!.push(row.branchId);
    }
    // 다중 지점 트레이너 ID 목록
    const multiTrainerIds = Array.from(tbMap.entries())
      .filter(([, bids]) => bids.length > 1)
      .map(([tid]) => tid);

    if (multiTrainerIds.length === 0) return [];

    const rows = await db.select({
      id: members.id,
      name: members.name,
      phone: members.phone,
      status: members.status,
      branchId: members.branchId,
      trainerId: members.trainerId,
      trainerName: trainers.trainerName,
    })
      .from(members)
      .leftJoin(trainers, eq(members.trainerId, trainers.id))
      .where(and(
        sql`${members.trainerId} = ANY(ARRAY[${sql.join(multiTrainerIds.map(id => sql`${id}`), sql`, `)}]::int[])`,
        isNull(members.branchId)
      ))
      .orderBy(trainers.trainerName, members.name);

    const branchList = await db.select().from(branches);

    return rows.map(r => ({
      ...r,
      availableBranches: (tbMap.get(r.trainerId) ?? []).map(bid => ({
        id: bid,
        name: branchList.find(b => b.id === bid)?.name ?? String(bid),
      })),
    }));
  }),

  assignBranch: protectedProcedure
    .input(z.object({ memberId: z.number(), branchId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      if (ctx.user.role !== "admin" && ctx.user.role !== "sub_admin")
        throw new TRPCError({ code: "FORBIDDEN" });
      await db.update(members).set({ branchId: input.branchId }).where(eq(members.id, input.memberId));
      return { ok: true };
    }),
});

// ─── PT Packages ─────────────────────────────────────────────────────────────
const ptRouter = t.router({
  listByMember: protectedProcedure
    .input(z.object({ memberId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      return db
        .select()
        .from(ptPackages)
        .where(eq(ptPackages.memberId, input.memberId))
        .orderBy(desc(ptPackages.createdAt));
    }),

  // 회원 이름 포함 전체 PT 패키지 목록
  list: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

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

  // 기존 회원에게 PT 패키지 추가
  addPackage: protectedProcedure
    .input(
      z.object({
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
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      let trainerId = ctx.user.trainerId;

      // admin/sub_admin: 회원의 담당 트레이너 ID 사용
      if (!trainerId && (ctx.user.role === "admin" || ctx.user.role === "sub_admin")) {
        const memberRow = await db.select({ trainerId: members.trainerId }).from(members).where(eq(members.id, input.memberId)).limit(1);
        trainerId = memberRow[0]?.trainerId ?? undefined;
        if (!trainerId) throw new TRPCError({ code: "BAD_REQUEST", message: "회원에게 배정된 트레이너가 없습니다." });
      }

      if (!trainerId) throw new TRPCError({ code: "FORBIDDEN" });

      const packageName = input.ptProgram || undefined;
      const pricePerSession = calcPricePerSession(input.paymentAmount, input.totalSessions, input.paymentMethod);

      await db.insert(ptPackages).values({
        memberId: input.memberId,
        trainerId,
        totalSessions: input.totalSessions,
        usedSessions: 0,
        packageName,
        startDate: input.startDate,
        expiryDate: input.expiryDate,
        pricePerSession,
        paymentAmount: input.paymentAmount,
        unpaidAmount: input.unpaidAmount,
        paymentMethod: input.paymentMethod,
        paymentDate: input.paymentDate,
        paymentMemo: input.paymentMemo,
      });

      // 회원권 만료일이 비어있으면 세션 수 기준으로 자동 계산 (10회=1개월)
      const memberInfo = await db.select({ membershipEnd: members.membershipEnd, membershipStart: members.membershipStart }).from(members).where(eq(members.id, input.memberId)).limit(1);
      if (memberInfo[0] && !memberInfo[0].membershipEnd) {
        const months = Math.ceil(input.totalSessions / 10);
        const base = input.startDate || memberInfo[0].membershipStart || new Date().toISOString().substring(0, 10);
        const d = new Date(base);
        d.setMonth(d.getMonth() + months);
        const newEnd = d.toISOString().substring(0, 10);
        await db.update(members).set({ membershipEnd: newEnd }).where(eq(members.id, input.memberId));
      }

      return { success: true };
    }),

  // 트레이닝 일지 단독 생성 (세션 차감 없음)
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
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
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

  // 트레이닝 일지 수정
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
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { id, ...fields } = input;
      await db.update(ptSessionLogs).set(fields).where(eq(ptSessionLogs.id, id));
      return { success: true };
    }),

  // 트레이닝 일지 삭제
  deleteLog: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.delete(ptSessionLogs).where(eq(ptSessionLogs.id, input.id));
      return { success: true };
    }),

  // PT 세션 1회 사용 기록
  useSession: protectedProcedure
    .input(
      z.object({
        packageId: z.number().optional(),
        memberId: z.number(),
        sessionDate: z.string().optional(),
        notes: z.string().optional(),
        bodyPart: z.string().optional(),
        exercisesJson: z.string().optional(),
        goal: z.string().optional(),
        feedback: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const trainerId = ctx.user.trainerId;
      if (!trainerId) throw new TRPCError({ code: "FORBIDDEN" });

      // packageId 미입력 시 활성 패키지 자동 탐색
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

      // 패키지 조회
      const pkgResult = await db
        .select()
        .from(ptPackages)
        .where(eq(ptPackages.id, resolvedPackageId!))
        .limit(1);

      const pkg = pkgResult[0];
      if (!pkg) throw new TRPCError({ code: "NOT_FOUND", message: "패키지를 찾을 수 없습니다." });
      if (pkg.usedSessions >= pkg.totalSessions)
        throw new TRPCError({ code: "BAD_REQUEST", message: "잔여 세션이 없습니다." });

      const newUsed = pkg.usedSessions + 1;
      const newStatus = newUsed >= pkg.totalSessions ? "completed" : "active";

      await db
        .update(ptPackages)
        .set({ usedSessions: newUsed, status: newStatus as any })
        .where(eq(ptPackages.id, resolvedPackageId!));

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

      // 회원권 시작일이 비어있으면 첫 수업일로 자동 설정
      const memberRow = await db.select({ membershipStart: members.membershipStart }).from(members).where(eq(members.id, input.memberId)).limit(1);
      if (memberRow[0] && !memberRow[0].membershipStart) {
        await db.update(members).set({ membershipStart: input.sessionDate ?? today }).where(eq(members.id, input.memberId));
      }

      return { success: true, remaining: newUsed < pkg.totalSessions ? pkg.totalSessions - newUsed : 0 };
    }),

  // 세션 로그 목록 (회원별)
  sessionLogs: protectedProcedure
    .input(z.object({ memberId: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      return db
        .select()
        .from(ptSessionLogs)
        .where(eq(ptSessionLogs.memberId, input.memberId))
        .orderBy(desc(ptSessionLogs.sessionDate));
    }),

  // 미수금 업데이트 (결제 완료 처리)
  updatePayment: protectedProcedure
    .input(
      z.object({
        packageId: z.number(),
        unpaidAmount: z.number().min(0),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const trainerId = ctx.user.trainerId;
      if (!trainerId) throw new TRPCError({ code: "FORBIDDEN" });

      const pkgResult = await db
        .select()
        .from(ptPackages)
        .where(eq(ptPackages.id, input.packageId))
        .limit(1);

      const pkg = pkgResult[0];
      if (!pkg) throw new TRPCError({ code: "NOT_FOUND", message: "패키지를 찾을 수 없습니다." });

      await db
        .update(ptPackages)
        .set({ unpaidAmount: input.unpaidAmount })
        .where(eq(ptPackages.id, input.packageId));

      return { success: true };
    }),

  // PT 패키지 전체 정보 수정
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
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { packageId, ...fields } = input;

      // usedSessions 변경 시 status 자동 조정
      const pkg = fields.totalSessions !== undefined || fields.usedSessions !== undefined
        ? (await db.select().from(ptPackages).where(eq(ptPackages.id, packageId)).limit(1))[0]
        : null;

      const total = fields.totalSessions ?? pkg?.totalSessions ?? 1;
      const used = fields.usedSessions ?? pkg?.usedSessions ?? 0;
      const autoStatus = used >= total ? "completed" : "active";

      await db.update(ptPackages).set({
        ...fields,
        ...(pkg ? { status: autoStatus } : {}),
      }).where(eq(ptPackages.id, packageId));
      return { success: true };
    }),

  // 패키지 상태 변경 (진행/정지/완료/만료/환불)
  updateStatus: protectedProcedure
    .input(z.object({ packageId: z.number(), status: z.enum(["active", "paused", "completed", "expired", "refunded"]) }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.update(ptPackages).set({ status: input.status }).where(eq(ptPackages.id, input.packageId));
      return { success: true };
    }),

  // 정지 내역 추가
  addPause: protectedProcedure
    .input(z.object({ packageId: z.number(), memberId: z.number(), pauseStart: z.string(), pauseEnd: z.string().optional(), reason: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.insert(ptPauses).values({ packageId: input.packageId, memberId: input.memberId, pauseStart: input.pauseStart, pauseEnd: input.pauseEnd ?? null, reason: input.reason ?? null });
      return { success: true };
    }),

  // 정지 내역 목록
  listPauses: protectedProcedure
    .input(z.object({ memberId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      return db.select().from(ptPauses).where(eq(ptPauses.memberId, input.memberId)).orderBy(desc(ptPauses.pauseStart));
    }),

  // 정지 내역 삭제
  removePause: protectedProcedure
    .input(z.object({ pauseId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.delete(ptPauses).where(eq(ptPauses.id, input.pauseId));
      return { success: true };
    }),

  // 결제일 업데이트
  updatePaymentDate: protectedProcedure
    .input(z.object({ packageId: z.number(), paymentDate: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.update(ptPackages).set({ paymentDate: input.paymentDate }).where(eq(ptPackages.id, input.packageId));
      return { success: true };
    }),

  // 회원별 총 PT 세션 횟수
  memberSessionStats: protectedProcedure.query(async ({ ctx }) => {
    const db = getDb();
    const trainerId = ctx.user.trainerId;
    if (!trainerId) throw new TRPCError({ code: "FORBIDDEN" });
    const rows = await db
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
    return rows;
  }),
});

// ─── Schedules ────────────────────────────────────────────────────────────────
const schedulesRouter = t.router({
  listByMember: protectedProcedure
    .input(z.object({ memberId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      return db.select().from(schedules).where(eq(schedules.memberId, input.memberId)).orderBy(schedules.scheduledDate);
    }),

  create: protectedProcedure
    .input(z.object({ memberId: z.number(), scheduledDate: z.string(), scheduledTime: z.string().optional(), notes: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const trainerId = ctx.user.trainerId;
      if (!trainerId) throw new TRPCError({ code: "FORBIDDEN" });
      await db.insert(schedules).values({ memberId: input.memberId, trainerId, scheduledDate: input.scheduledDate, scheduledTime: input.scheduledTime ?? null, notes: input.notes ?? null });
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ scheduleId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.delete(schedules).where(eq(schedules.id, input.scheduleId));
      return { success: true };
    }),

  updateStatus: protectedProcedure
    .input(z.object({ scheduleId: z.number(), status: z.enum(["pending", "done", "cancelled"]) }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.update(schedules).set({ status: input.status }).where(eq(schedules.id, input.scheduleId));
      return { success: true };
    }),
});

// ─── Attendances ─────────────────────────────────────────────────────────────
const attendancesRouter = t.router({
  listByMember: protectedProcedure
    .input(z.object({ memberId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      return db
        .select()
        .from(attendances)
        .where(eq(attendances.memberId, input.memberId))
        .orderBy(desc(attendances.attendDate));
    }),

  create: protectedProcedure
    .input(
      z.object({
        memberId: z.number(),
        attendDate: z.string(),
        status: z.enum(["attended", "absent", "noshow"]).default("attended"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const trainerId = ctx.user.trainerId;
      if (!trainerId) throw new TRPCError({ code: "FORBIDDEN" });

      await db.insert(attendances).values({ ...input, trainerId });
      return { success: true };
    }),

  // 오늘 출석 체크 (중복 방지)
  checkIn: protectedProcedure
    .input(z.object({ memberId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const trainerId = ctx.user.trainerId;
      if (!trainerId) throw new TRPCError({ code: "FORBIDDEN" });

      const today = new Date().toISOString().split("T")[0];

      // 오늘 출석 여부 확인
      const existing = await db
        .select({ id: attendances.id })
        .from(attendances)
        .where(
          and(
            eq(attendances.memberId, input.memberId),
            eq(attendances.trainerId, trainerId),
            sql`${attendances.attendDate} = ${today}`
          )
        )
        .limit(1);

      if (existing[0]) {
        throw new TRPCError({ code: "CONFLICT", message: "오늘 이미 출석 체크되었습니다." });
      }

      await db.insert(attendances).values({
        memberId: input.memberId,
        trainerId,
        attendDate: today,
        status: "attended",
      });

      return { success: true };
    }),
});

// ─── Trainers ─────────────────────────────────────────────────────────────────
const trainersRouter = t.router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    return db.select().from(trainers).orderBy(trainers.trainerName);
  }),

  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const trainerResult = await db
        .select()
        .from(trainers)
        .where(eq(trainers.id, input.id))
        .limit(1);

      if (!trainerResult[0]) throw new TRPCError({ code: "NOT_FOUND" });

      const settingsResult = await db
        .select()
        .from(trainerSettings)
        .where(eq(trainerSettings.trainerId, input.id))
        .limit(1);

      // 담당 회원 수
      const memberCountResult = await db
        .select({ count: sql`COUNT(*)` })
        .from(members)
        .where(eq(members.trainerId, input.id));
      const memberCount = Number((memberCountResult[0] as any)?.count ?? 0);

      const userResult = await db
        .select({ username: users.username })
        .from(users)
        .where(eq(users.id, trainerResult[0].userId))
        .limit(1);

      return {
        ...trainerResult[0],
        username: userResult[0]?.username ?? "",
        settlementRate: settingsResult[0]?.settlementRate ?? 50,
        memberCount,
      };
    }),

  updateSettlementRate: protectedProcedure
    .input(
      z.object({
        trainerId: z.number(),
        settlementRate: z.number().min(0).max(100),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.user?.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const existing = await db
        .select({ id: trainerSettings.id })
        .from(trainerSettings)
        .where(eq(trainerSettings.trainerId, input.trainerId))
        .limit(1);

      if (existing[0]) {
        await db
          .update(trainerSettings)
          .set({ settlementRate: input.settlementRate })
          .where(eq(trainerSettings.trainerId, input.trainerId));
      } else {
        await db.insert(trainerSettings).values({
          trainerId: input.trainerId,
          settlementRate: input.settlementRate,
        });
      }

      return { success: true };
    }),

  // 트레이너 비밀번호 초기화 (관리자)
  resetPassword: protectedProcedure
    .input(z.object({ trainerId: z.number(), newPassword: z.string().min(6) }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user?.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const trainerRow = await db
        .select({ userId: trainers.userId })
        .from(trainers)
        .where(eq(trainers.id, input.trainerId))
        .limit(1);
      if (!trainerRow[0]) throw new TRPCError({ code: "NOT_FOUND" });

      const hashed = await bcrypt.hash(input.newPassword, 10);
      await db.update(users).set({ password: hashed }).where(eq(users.id, trainerRow[0].userId));
      return { success: true };
    }),

  // 트레이너 정보 수정 (관리자)
  updateInfo: protectedProcedure
    .input(
      z.object({
        trainerId: z.number(),
        trainerName: z.string().min(1),
        phone: z.string().optional(),
        email: z.string().email().optional().or(z.literal("")),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.user?.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const { trainerId, ...data } = input;
      await db
        .update(trainers)
        .set({ trainerName: data.trainerName, phone: data.phone, email: data.email || undefined })
        .where(eq(trainers.id, trainerId));

      return { success: true };
    }),

  // 내 프로필 조회 (트레이너 본인)
  getMyProfile: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    if (!ctx.user.trainerId) throw new TRPCError({ code: "FORBIDDEN" });

    const [trainer, settings] = await Promise.all([
      db.select().from(trainers).where(eq(trainers.id, ctx.user.trainerId)).limit(1),
      db.select({ settlementRate: trainerSettings.settlementRate }).from(trainerSettings).where(eq(trainerSettings.trainerId, ctx.user.trainerId!)).limit(1),
    ]);
    if (!trainer[0]) throw new TRPCError({ code: "NOT_FOUND" });
    return { ...trainer[0], settlementRate: settings[0]?.settlementRate ?? 50 };
  }),

  // 내 프로필 수정 (트레이너 본인)
  updateMyProfile: protectedProcedure
    .input(z.object({ trainerName: z.string().min(1), phone: z.string().optional(), email: z.string().email().optional().or(z.literal("")) }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      if (!ctx.user.trainerId) throw new TRPCError({ code: "FORBIDDEN" });

      await db.update(trainers).set({ trainerName: input.trainerName, phone: input.phone, email: input.email || undefined }).where(eq(trainers.id, ctx.user.trainerId));
      return { success: true };
    }),

  // 비밀번호 변경
  changePassword: protectedProcedure
    .input(z.object({ currentPassword: z.string(), newPassword: z.string().min(6) }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const userResult = await db.select().from(users).where(eq(users.id, ctx.user.id)).limit(1);
      if (!userResult[0]) throw new TRPCError({ code: "NOT_FOUND" });

      const valid = await bcrypt.compare(input.currentPassword, userResult[0].password);
      if (!valid) throw new TRPCError({ code: "UNAUTHORIZED", message: "현재 비밀번호가 올바르지 않습니다." });

      const hashed = await bcrypt.hash(input.newPassword, 10);
      await db.update(users).set({ password: hashed }).where(eq(users.id, ctx.user.id));
      return { success: true };
    }),

  // 트레이너 통계 (본인 또는 관리자가 특정 트레이너 조회)
  getMyStats: protectedProcedure
    .input(z.object({ trainerId: z.number().optional() }).optional())
    .query(async ({ ctx, input }) => {
    const trainerId = input?.trainerId ?? ctx.user.trainerId;
    if (!trainerId) throw new TRPCError({ code: "FORBIDDEN" });
    if (input?.trainerId && ctx.user.role !== "admin" && ctx.user.trainerId !== input.trainerId)
      throw new TRPCError({ code: "FORBIDDEN" });
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    const [
      totalMembersResult,
      totalSessionsResult,
      noShowResult,
      churnedResult,
      remainingPtResult,
      trainerResult,
    ] = await Promise.all([
      db.select({ count: sql<number>`COUNT(*)` }).from(members).where(eq(members.trainerId, trainerId)),
      db.select({ count: sql<number>`COUNT(*)` }).from(ptSessionLogs).where(eq(ptSessionLogs.trainerId, trainerId)),
      db.select({ count: sql<number>`COUNT(*)` }).from(attendanceChecks).where(and(eq(attendanceChecks.trainerId, trainerId), eq(attendanceChecks.status, "noshow"))),
      db.select({ count: sql<number>`COUNT(*)` }).from(members).where(and(eq(members.trainerId, trainerId), eq(members.status, "inactive"))),
      db.select({ total: sql<number>`COALESCE(SUM(${ptPackages.totalSessions} - ${ptPackages.usedSessions}), 0)` })
        .from(ptPackages)
        .where(and(eq(ptPackages.trainerId, trainerId), eq(ptPackages.status, "active"))),
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
    const totalChurned = Number(churnedResult[0]?.count ?? 0);
    const remainingPt = Number(remainingPtResult[0]?.total ?? 0);

    return {
      totalMembers,
      totalSessions,
      totalRereg,
      totalNoShow,
      totalChurned,
      remainingPt,
      avgMonthlyRereg: Math.round((totalRereg / monthsActive) * 10) / 10,
      avgMonthlyNewMembers: Math.round((totalMembers / monthsActive) * 10) / 10,
      avgMonthlyPt: Math.round((totalSessions / monthsActive) * 10) / 10,
      avgMonthlyNoShow: Math.round((totalNoShow / monthsActive) * 10) / 10,
      reregRate: totalMembers > 0 ? Math.round((reregMemberCount / totalMembers) * 1000) / 10 : 0,
    };
  }),

  // 월별 상세 통계 (관리자 또는 본인)
  getMonthlyStats: protectedProcedure
    .input(z.object({ trainerId: z.number(), yearMonth: z.string() }))
    .query(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin" && ctx.user.trainerId !== input.trainerId)
        throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const monthStart = `${input.yearMonth}-01`;
      const [y, m] = input.yearMonth.split("-").map(Number);
      const monthEnd = new Date(y, m, 1).toISOString().split("T")[0];

      const [sessionsResult, noShowResult, monthPackages] = await Promise.all([
        db.select({ count: sql<number>`COUNT(*)` })
          .from(ptSessionLogs)
          .where(and(
            eq(ptSessionLogs.trainerId, input.trainerId),
            sql`${ptSessionLogs.sessionDate} >= ${monthStart}`,
            sql`${ptSessionLogs.sessionDate} < ${monthEnd}`,
          )),
        db.select({ count: sql<number>`COUNT(*)` })
          .from(attendanceChecks)
          .where(and(
            eq(attendanceChecks.trainerId, input.trainerId),
            eq(attendanceChecks.status, "noshow"),
            sql`${attendanceChecks.checkDate} >= ${monthStart}`,
            sql`${attendanceChecks.checkDate} < ${monthEnd}`,
          )),
        db.select({ id: ptPackages.id, memberId: ptPackages.memberId, paymentAmount: ptPackages.paymentAmount, createdAt: ptPackages.createdAt })
          .from(ptPackages)
          .where(and(
            eq(ptPackages.trainerId, input.trainerId),
            sql`${ptPackages.createdAt} >= ${monthStart}`,
            sql`${ptPackages.createdAt} < ${monthEnd}`,
          )),
      ]);

      // 신규 vs 재등록 구분: 이번달 이전에 패키지가 있으면 재등록
      const memberIds = [...new Set(monthPackages.map(p => p.memberId))];
      let reregCount = 0;
      let newCount = 0;
      if (memberIds.length > 0) {
        await Promise.all(memberIds.map(async (memberId) => {
          const pkgsThisMonth = monthPackages.filter(p => p.memberId === memberId);
          const earliest = pkgsThisMonth.reduce((a, b) => a.createdAt < b.createdAt ? a : b);
          const prior = await db.select({ id: ptPackages.id })
            .from(ptPackages)
            .where(and(
              eq(ptPackages.trainerId, input.trainerId),
              eq(ptPackages.memberId, memberId),
              sql`${ptPackages.createdAt} < ${earliest.createdAt}`,
            ))
            .limit(1);
          if (prior.length > 0) {
            reregCount += pkgsThisMonth.length;
          } else {
            newCount += 1;
            reregCount += pkgsThisMonth.length - 1;
          }
        }));
      }

      const revenue = monthPackages.reduce((s, p) => s + (p.paymentAmount ?? 0), 0);

      return {
        sessions: Number(sessionsResult[0]?.count ?? 0),
        noShow: Number(noShowResult[0]?.count ?? 0),
        newMembers: newCount,
        rereg: reregCount,
        revenue,
      };
    }),

  // 월별 정산 조회
  getMonthlySettlement: protectedProcedure
    .input(z.object({ trainerId: z.number(), yearMonth: z.string(), dateFilter: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      if (ctx.user?.role !== "admin" && ctx.user?.trainerId !== input.trainerId) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const settingsRow = await db
        .select({ settlementRate: trainerSettings.settlementRate })
        .from(trainerSettings)
        .where(eq(trainerSettings.trainerId, input.trainerId))
        .limit(1);
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
        .where(
          and(
            eq(ptSessionLogs.trainerId, input.trainerId),
            input.dateFilter
              ? eq(ptSessionLogs.sessionDate, input.dateFilter)
              : and(
                  gte(ptSessionLogs.sessionDate, `${input.yearMonth}-01`),
                  lte(ptSessionLogs.sessionDate, `${input.yearMonth}-31`),
                ),
          )
        )
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

      return { sessionCount, revenue, settlementAmount, afterTax, settlementRate, logs: logsWithPrice };
    }),
});

// ─── Admin ────────────────────────────────────────────────────────────────────
const adminRouter = t.router({
  // 트레이너 목록 (회원 수 포함)
  listTrainers: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user?.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });

    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    const trainerList = await db
      .select({
        id: trainers.id,
        userId: trainers.userId,
        trainerName: trainers.trainerName,
        phone: trainers.phone,
        email: trainers.email,
        branchId: trainers.branchId,
        branchName: branches.name,
        createdAt: trainers.createdAt,
        lastLoginAt: users.lastLoginAt,
        position: users.position,
      })
      .from(trainers)
      .leftJoin(users, eq(trainers.userId, users.id))
      .leftJoin(branches, eq(trainers.branchId, branches.id))
      .orderBy(trainers.trainerName);

    const result = await Promise.all(
      trainerList.map(async (trainer) => {
        const [memberCount, settings, trainerBranchList] = await Promise.all([
          db.select({ count: sql`COUNT(*)` }).from(members).where(eq(members.trainerId, trainer.id)),
          db.select({ settlementRate: trainerSettings.settlementRate }).from(trainerSettings).where(eq(trainerSettings.trainerId, trainer.id)).limit(1),
          db.select({ branchId: trainerBranches.branchId, branchName: branches.name })
            .from(trainerBranches)
            .leftJoin(branches, eq(trainerBranches.branchId, branches.id))
            .where(eq(trainerBranches.trainerId, trainer.id)),
        ]);
        return {
          ...trainer,
          memberCount: Number((memberCount[0] as any)?.count ?? 0),
          settlementRate: settings[0]?.settlementRate ?? 50,
          assignedBranches: trainerBranchList.map((b) => ({ branchId: b.branchId, branchName: b.branchName ?? "" })),
        };
      })
    );

    return result;
  }),

  // 트레이너 계정 생성
  createTrainer: protectedProcedure
    .input(
      z.object({
        username: z.string().min(3).max(50),
        password: z.string().min(6),
        trainerName: z.string().min(1),
        phone: z.string().optional(),
        email: z.string().email().optional(),
        settlementRate: z.number().min(0).max(100).default(50),
        branchId: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.user?.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // 중복 아이디 확인
      const existing = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.username, input.username))
        .limit(1);

      if (existing[0]) {
        throw new TRPCError({ code: "CONFLICT", message: "이미 사용 중인 아이디입니다." });
      }

      const hashed = await bcrypt.hash(input.password, 10);

      // 유저 생성
      const [userInsert] = await db.insert(users).values({
        username: input.username,
        password: hashed,
        role: "trainer",
      }).returning({ id: users.id });
      const userId = userInsert.id;

      // 트레이너 프로필 생성
      const [trainerInsert] = await db.insert(trainers).values({
        userId,
        trainerName: input.trainerName,
        phone: input.phone,
        email: input.email,
        branchId: input.branchId ?? null,
      }).returning({ id: trainers.id });
      const trainerId = trainerInsert.id;

      // 트레이너 설정 생성
      await db.insert(trainerSettings).values({
        trainerId,
        settlementRate: input.settlementRate,
      });

      return { success: true, trainerId };
    }),

  // 컨설턴트 계정 생성
  createConsultant: protectedProcedure
    .input(z.object({ username: z.string().min(3), password: z.string().min(6), displayName: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user?.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const existing = await db.select({ id: users.id }).from(users).where(eq(users.username, input.username)).limit(1);
      if (existing[0]) throw new TRPCError({ code: "CONFLICT", message: "이미 사용 중인 아이디입니다." });

      const hashed = await bcrypt.hash(input.password, 10);
      const [userInsert] = await db.insert(users).values({ username: input.username, password: hashed, role: "consultant" }).returning({ id: users.id });
      return { success: true, userId: userInsert.id };
    }),

  // 부관리자 계정 생성
  createSubAdmin: protectedProcedure
    .input(z.object({ username: z.string().min(3), password: z.string().min(6) }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user?.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const existing = await db.select({ id: users.id }).from(users).where(eq(users.username, input.username)).limit(1);
      if (existing[0]) throw new TRPCError({ code: "CONFLICT", message: "이미 사용 중인 아이디입니다." });

      const hashed = await bcrypt.hash(input.password, 10);
      const [row] = await db.insert(users).values({ username: input.username, password: hashed, role: "sub_admin" }).returning({ id: users.id });
      return { success: true, userId: row.id };
    }),

  // 부관리자 목록
  listSubAdmins: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user?.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    return db.select({ id: users.id, username: users.username, position: users.position, createdAt: users.createdAt })
      .from(users).where(eq(users.role, "sub_admin")).orderBy(users.username);
  }),

  // 부관리자 삭제
  deleteSubAdmin: protectedProcedure
    .input(z.object({ userId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user?.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.delete(users).where(eq(users.id, input.userId));
      return { success: true };
    }),

  // 직책 설정 (관리자 전용)
  updatePosition: protectedProcedure
    .input(z.object({ userId: z.number(), position: z.string().nullable() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user?.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.update(users).set({ position: input.position, updatedAt: new Date().toISOString() }).where(eq(users.id, input.userId));
      return { success: true };
    }),

  // 컨설턴트 목록
  listConsultants: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user?.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    return db.select({ id: users.id, username: users.username, position: users.position, createdAt: users.createdAt })
      .from(users).where(eq(users.role, "consultant")).orderBy(users.username);
  }),

  // 트레이너 삭제
  deleteTrainer: protectedProcedure
    .input(z.object({ trainerId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user?.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const trainerResult = await db.select({ userId: trainers.userId }).from(trainers).where(eq(trainers.id, input.trainerId)).limit(1);
      if (!trainerResult[0]) throw new TRPCError({ code: "NOT_FOUND" });

      await db.delete(trainerSettings).where(eq(trainerSettings.trainerId, input.trainerId));
      await db.delete(trainers).where(eq(trainers.id, input.trainerId));
      await db.delete(users).where(eq(users.id, trainerResult[0].userId));

      return { success: true };
    }),

  // 지점 목록
  listBranches: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user?.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    return db.select().from(branches).orderBy(branches.name);
  }),

  // 지점별 회원 목록
  listMembersByBranch: protectedProcedure
    .input(z.object({ branchId: z.number() }))
    .query(async ({ ctx, input }) => {
      if (ctx.user?.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const branchTrainers = await db
        .select({ trainerId: trainerBranches.trainerId })
        .from(trainerBranches)
        .where(eq(trainerBranches.branchId, input.branchId));

      if (branchTrainers.length === 0) return [];

      const ids = branchTrainers.map((t) => t.trainerId);
      const memberList = await db
        .select({
          id: members.id,
          name: members.name,
          phone: members.phone,
          status: members.status,
          trainerId: members.trainerId,
          trainerName: trainers.trainerName,
        })
        .from(members)
        .leftJoin(trainers, eq(members.trainerId, trainers.id))
        .where(sql`${members.trainerId} = ANY(ARRAY[${sql.join(ids.map((id) => sql`${id}`), sql`, `)}]::int[])`)
        .orderBy(trainers.trainerName, members.name);

      return memberList;
    }),

  // 지점 생성
  createBranch: protectedProcedure
    .input(z.object({ name: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user?.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [branch] = await db.insert(branches).values({ name: input.name }).returning();
      return branch;
    }),

  // 트레이너 지점 할당 (다중 지점 지원)
  updateTrainerBranches: protectedProcedure
    .input(z.object({ trainerId: z.number(), branchIds: z.array(z.number()) }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user?.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.delete(trainerBranches).where(eq(trainerBranches.trainerId, input.trainerId));
      if (input.branchIds.length > 0) {
        await db.insert(trainerBranches).values(input.branchIds.map((branchId) => ({ trainerId: input.trainerId, branchId })));
      }
      return { success: true };
    }),

  // 구글시트 미리보기 (columnOffset: B열=1)
  previewSheet: protectedProcedure
    .input(z.object({ sheetUrl: z.string(), columnOffset: z.number().default(1) }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user?.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      let text: string;
      try {
        text = await fetchSheetCsv(input.sheetUrl);
      } catch (e: any) {
        throw new TRPCError({ code: "BAD_REQUEST", message: e?.message ?? "시트를 불러올 수 없습니다." });
      }
      const rows = parseCSV(text);
      if (rows.length < 2) throw new TRPCError({ code: "BAD_REQUEST", message: "데이터가 없습니다." });
      const offset = input.columnOffset ?? 1;
      const headers = rows[0].slice(offset);
      const sampleRows = rows.slice(1, 4).map((r) => r.slice(offset));
      return { headers, sampleRows, totalRows: rows.length - 1 };
    }),

  // 구글시트에서 회원 일괄 등록
  importFromSheet: protectedProcedure
    .input(
      z.object({
        sheetUrl: z.string(),
        trainerId: z.number(),
        mapping: z.record(z.string()),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.user?.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const text = await fetchSheetCsv(input.sheetUrl);
      const rows = parseCSV(text);
      if (rows.length < 2) throw new TRPCError({ code: "BAD_REQUEST", message: "데이터가 없습니다." });

      const headers = rows[0];
      const dataRows = rows.slice(1);

      // 컬럼명 → 행 인덱스 매핑
      const fi: Record<string, number> = {};
      for (const [col, field] of Object.entries(input.mapping)) {
        if (field === "skip") continue;
        const idx = headers.indexOf(col);
        if (idx !== -1) fi[field] = idx;
      }

      const get = (row: string[], field: string) =>
        fi[field] !== undefined ? row[fi[field]] || undefined : undefined;

      let imported = 0;
      let skipped = 0;

      for (const row of dataRows) {
        const name = get(row, "name");
        if (!name) { skipped++; continue; }

        const [newMember] = await db.insert(members).values({
          trainerId: input.trainerId,
          name,
          phone: get(row, "phone") ?? null,
          email: get(row, "email") ?? null,
          birthDate: get(row, "birthDate") ?? null,
          gender: (get(row, "gender") as any) ?? null,
          grade: (get(row, "grade") as any) ?? "basic",
          status: (get(row, "status") as any) ?? "active",
          membershipStart: get(row, "membershipStart") ?? null,
          membershipEnd: get(row, "membershipEnd") ?? null,
          profileNote: get(row, "profileNote") ?? null,
        }).returning({ id: members.id });

        const ptSessionsRaw = get(row, "ptSessions");
        if (ptSessionsRaw) {
          const totalSessions = parseInt(ptSessionsRaw.replace(/[^0-9]/g, "")) || 0;
          if (totalSessions > 0) {
            const paymentRaw = get(row, "paymentAmount");
            const unpaidRaw = get(row, "unpaidAmount");
            const paymentAmount = paymentRaw ? parseInt(paymentRaw.replace(/[^0-9]/g, "")) : undefined;
            const unpaidAmount = unpaidRaw ? parseInt(unpaidRaw.replace(/[^0-9]/g, "")) : undefined;
            const pricePerSession = paymentAmount && totalSessions ? Math.round(paymentAmount / totalSessions) : undefined;
            await db.insert(ptPackages).values({
              memberId: newMember.id,
              trainerId: input.trainerId,
              totalSessions,
              usedSessions: 0,
              packageName: get(row, "ptProgram") ?? null,
              pricePerSession,
              paymentAmount,
              unpaidAmount,
              paymentMethod: (get(row, "paymentMethod") as any) ?? null,
            });
          }
        }
        imported++;
      }

      return { imported, skipped };
    }),

  // 시트 동기화 설정 저장
  saveSyncConfig: protectedProcedure
    .input(z.object({
      sheetUrl: z.string(),
      columnOffset: z.number().default(1),
      mapping: z.record(z.string()),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user?.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const existing = await db.select({ id: sheetSyncConfig.id }).from(sheetSyncConfig).limit(1);
      if (existing[0]) {
        await db.update(sheetSyncConfig).set({
          sheetUrl: input.sheetUrl,
          columnOffset: input.columnOffset,
          mappingJson: JSON.stringify(input.mapping),
          enabled: 1,
        });
      } else {
        await db.insert(sheetSyncConfig).values({
          sheetUrl: input.sheetUrl,
          columnOffset: input.columnOffset,
          mappingJson: JSON.stringify(input.mapping),
          enabled: 1,
        });
      }
      return { success: true };
    }),

  // 동기화 설정 조회
  getSyncConfig: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user?.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
    const db = await getDb();
    if (!db) return null;
    const rows = await db.select().from(sheetSyncConfig).limit(1);
    if (!rows[0]) return null;
    return { ...rows[0], mapping: JSON.parse(rows[0].mappingJson) as Record<string, string> };
  }),

  // 수동 동기화
  syncNow: protectedProcedure.mutation(async ({ ctx }) => {
    if (ctx.user?.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
    return await syncSheetNow();
  }),

  // 미배정 회원 목록
  listPending: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user?.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
    const db = await getDb();
    if (!db) return [];
    return db.select().from(sheetPendingMembers).orderBy(desc(sheetPendingMembers.importedAt));
  }),

  // 미배정 회원 → 트레이너 배정 후 정식 등록
  assignPending: protectedProcedure
    .input(z.object({ pendingId: z.number(), trainerId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user?.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const rows = await db.select().from(sheetPendingMembers).where(eq(sheetPendingMembers.id, input.pendingId)).limit(1);
      if (!rows[0]) throw new TRPCError({ code: "NOT_FOUND" });
      const p = rows[0];

      const [newMember] = await db.insert(members).values({
        trainerId: input.trainerId,
        name: p.name,
        phone: p.phone ?? null,
        email: p.email ?? null,
        birthDate: p.birthDate ?? null,
        gender: (p.gender as any) ?? null,
        grade: (p.grade as any) ?? "basic",
        status: "active",
        membershipStart: p.membershipStart ?? null,
        membershipEnd: p.membershipEnd ?? null,
        profileNote: p.profileNote ?? null,
      }).returning({ id: members.id });

      if (p.ptSessions && p.ptSessions > 0) {
        const pricePerSession = p.paymentAmount && p.ptSessions ? Math.round(p.paymentAmount / p.ptSessions) : undefined;
        await db.insert(ptPackages).values({
          memberId: newMember.id,
          trainerId: input.trainerId,
          totalSessions: p.ptSessions,
          usedSessions: 0,
          packageName: p.ptProgram ?? null,
          pricePerSession,
          paymentAmount: p.paymentAmount ?? null,
          unpaidAmount: p.unpaidAmount ?? null,
          paymentMethod: (p.paymentMethod as any) ?? null,
        });
      }

      await db.delete(sheetPendingMembers).where(eq(sheetPendingMembers.id, input.pendingId));
      return { memberId: newMember.id };
    }),

  // 미배정 회원 삭제 (무시 처리)
  deletePending: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user?.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.delete(sheetPendingMembers).where(eq(sheetPendingMembers.id, input.id));
      return { success: true };
    }),

  // 관리자 전체 통계
  getStats: protectedProcedure
    .input(z.object({ branchId: z.number().optional() }).optional())
    .query(async ({ ctx, input }) => {
    if (ctx.user?.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    const today = new Date();
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split("T")[0];
    const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 1).toISOString().split("T")[0];

    // branchId 필터: junction 테이블로 해당 지점 소속 trainerIds 조회
    let filteredTrainerIds: number[] | null = null;
    if (input?.branchId) {
      const rows = await db.select({ trainerId: trainerBranches.trainerId }).from(trainerBranches).where(eq(trainerBranches.branchId, input.branchId));
      filteredTrainerIds = rows.map((r) => r.trainerId);
    }
    const trainerIdFilter = filteredTrainerIds ? sql`${trainers.id} = ANY(ARRAY[${sql.join(filteredTrainerIds.map((id) => sql`${id}`), sql`, `)}]::int[])` : undefined;

    const [totalTrainersResult, totalMembersResult, activeMembersResult] = await Promise.all([
      db.select({ count: sql<number>`COUNT(*)` }).from(trainers).where(trainerIdFilter),
      db.select({ count: sql<number>`COUNT(*)` }).from(members).leftJoin(trainers, eq(members.trainerId, trainers.id)).where(trainerIdFilter),
      db.select({ count: sql<number>`COUNT(*)` }).from(members).leftJoin(trainers, eq(members.trainerId, trainers.id))
        .where(trainerIdFilter ? and(eq(members.status, "active"), trainerIdFilter) : eq(members.status, "active")),
    ]);

    // 트레이너별 상세 통계
    const trainerList = await db.select().from(trainers).where(trainerIdFilter).orderBy(trainers.trainerName);
    const trainerStats = await Promise.all(trainerList.map(async (trainer) => {
      const [memberCnt, settings, monthPackages, monthLogs] = await Promise.all([
        db.select({ count: sql<number>`COUNT(*)` }).from(members).where(eq(members.trainerId, trainer.id)),
        db.select({ settlementRate: trainerSettings.settlementRate }).from(trainerSettings).where(eq(trainerSettings.trainerId, trainer.id)).limit(1),
        // 매출: 이번달 등록된 패키지 결제금액 합산
        db.select({ paymentAmount: ptPackages.paymentAmount })
          .from(ptPackages)
          .where(and(
            eq(ptPackages.trainerId, trainer.id),
            sql`${ptPackages.createdAt} >= ${monthStart}`,
            sql`${ptPackages.createdAt} < ${monthEnd}`,
          )),
        // 정산: 이번달 진행된 세션 × 회당단가
        db.select({
          pricePerSession: ptPackages.pricePerSession,
          paymentAmount: ptPackages.paymentAmount,
          totalSessions: ptPackages.totalSessions,
        })
          .from(ptSessionLogs)
          .leftJoin(ptPackages, eq(ptSessionLogs.packageId, ptPackages.id))
          .where(and(
            eq(ptSessionLogs.trainerId, trainer.id),
            sql`${ptSessionLogs.sessionDate} >= ${monthStart}`,
            sql`${ptSessionLogs.sessionDate} < ${monthEnd}`,
          )),
      ]);
      const rate = settings[0]?.settlementRate ?? 50;
      const revenue = monthPackages.reduce((s, p) => s + (p.paymentAmount ?? 0), 0);
      const calcPrice = (l: { pricePerSession: number | null; paymentAmount: number | null; totalSessions: number | null }) => {
        if (l.pricePerSession) return l.pricePerSession;
        if (l.paymentAmount && l.totalSessions && l.totalSessions > 0) return Math.round(l.paymentAmount / l.totalSessions);
        return 0;
      };
      const sessionRevenue = monthLogs.reduce((s, l) => s + calcPrice(l), 0);
      return {
        id: trainer.id,
        trainerName: trainer.trainerName,
        phone: trainer.phone,
        memberCount: Number(memberCnt[0]?.count ?? 0),
        settlementRate: rate,
        monthlyRevenue: revenue,
        monthlySettlement: Math.round(sessionRevenue * rate / 100),
      };
    }));

    const totalMonthlyRevenue = trainerStats.reduce((s, t) => s + t.monthlyRevenue, 0);
    const totalMonthlySettlement = trainerStats.reduce((s, t) => s + t.monthlySettlement, 0);

    return {
      totalTrainers: Number(totalTrainersResult[0]?.count ?? 0),
      totalMembers: Number(totalMembersResult[0]?.count ?? 0),
      activeMembers: Number(activeMembersResult[0]?.count ?? 0),
      totalMonthlyRevenue,
      totalMonthlySettlement,
      trainerStats,
    };
  }),

  // 최근 6개월 트레이너별 월간 매출 차트 데이터
  getMonthlyChart: protectedProcedure
    .input(z.object({ branchId: z.number().optional() }).optional())
    .query(async ({ ctx, input }) => {
    if (ctx.user?.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    let filteredTrainerIdsForChart: number[] | null = null;
    if (input?.branchId) {
      const rows = await db.select({ trainerId: trainerBranches.trainerId }).from(trainerBranches).where(eq(trainerBranches.branchId, input.branchId));
      filteredTrainerIdsForChart = rows.map((r) => r.trainerId);
    }
    const chartTrainerFilter = filteredTrainerIdsForChart
      ? sql`${trainers.id} = ANY(ARRAY[${sql.join(filteredTrainerIdsForChart.map((id) => sql`${id}`), sql`, `)}]::int[])`
      : undefined;
    const trainerList = await db.select({ id: trainers.id, trainerName: trainers.trainerName }).from(trainers).where(chartTrainerFilter).orderBy(trainers.trainerName);

    // 최근 6개월 범위 생성
    const months: { label: string; start: string; end: string }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setDate(1);
      d.setMonth(d.getMonth() - i);
      const start = d.toISOString().split("T")[0];
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 1).toISOString().split("T")[0];
      const label = `${d.getMonth() + 1}월`;
      months.push({ label, start, end });
    }

    // 월별 데이터 조합 (ptPackages.paymentAmount 기준)
    const rows = await Promise.all(
      months.map(async (m) => {
        const entry: Record<string, string | number> = { month: m.label };
        await Promise.all(
          trainerList.map(async (trainer) => {
            const res = await db
              .select({ total: sql<number>`COALESCE(SUM(COALESCE(${ptPackages.paymentAmount},0)),0)` })
              .from(ptPackages)
              .where(and(
                eq(ptPackages.trainerId, trainer.id),
                sql`${ptPackages.createdAt} >= ${m.start}`,
                sql`${ptPackages.createdAt} < ${m.end}`
              ));
            entry[trainer.trainerName] = Number(res[0]?.total ?? 0);
          })
        );
        return entry;
      })
    );

    return { rows, trainerNames: trainerList.map(t => t.trainerName) };
  }),

  // 정산 비율 수정 (관리자)
  updateSettlementRate: protectedProcedure
    .input(z.object({ trainerId: z.number(), settlementRate: z.number().min(0).max(100) }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user?.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.update(trainerSettings).set({ settlementRate: input.settlementRate }).where(eq(trainerSettings.trainerId, input.trainerId));
      return { success: true };
    }),

  // 정산 리포트 (관리자)
  getSettlementReport: protectedProcedure
    .input(z.object({ yearMonth: z.string() }))
    .query(async ({ ctx, input }) => {
      if (ctx.user?.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = getDb();
      const monthStart = `${input.yearMonth}-01`;
      const monthEnd = new Date(
        parseInt(input.yearMonth.split("-")[0]),
        parseInt(input.yearMonth.split("-")[1]),
        1
      ).toISOString().split("T")[0];

      const trainerList = await db.select().from(trainers).orderBy(trainers.trainerName);

      const trainerRows = await Promise.all(trainerList.map(async (trainer) => {
        const [settings, logs] = await Promise.all([
          db.select({ settlementRate: trainerSettings.settlementRate })
            .from(trainerSettings)
            .where(eq(trainerSettings.trainerId, trainer.id))
            .limit(1),
          db.select({
            pricePerSession: ptPackages.pricePerSession,
            paymentAmount: ptPackages.paymentAmount,
            totalSessions: ptPackages.totalSessions,
          })
            .from(ptSessionLogs)
            .leftJoin(ptPackages, eq(ptSessionLogs.packageId, ptPackages.id))
            .where(and(
              eq(ptSessionLogs.trainerId, trainer.id),
              sql`${ptSessionLogs.sessionDate} >= ${monthStart}`,
              sql`${ptSessionLogs.sessionDate} < ${monthEnd}`,
            )),
        ]);

        const rate = settings[0]?.settlementRate ?? 50;
        const calcPrice = (l: { pricePerSession: number | null; paymentAmount: number | null; totalSessions: number | null }) => {
          if (l.pricePerSession) return l.pricePerSession;
          if (l.paymentAmount && l.totalSessions && l.totalSessions > 0) return Math.round(l.paymentAmount / l.totalSessions);
          return 0;
        };
        const sessionCount = logs.length;
        const revenue = logs.reduce((s, l) => s + calcPrice(l), 0);
        const avgPrice = sessionCount > 0 ? Math.round(revenue / sessionCount) : 0;
        const settlement = Math.round(revenue * rate / 100);
        const afterTax = Math.round(settlement * (1 - 0.033));

        return {
          trainerId: trainer.id,
          trainerName: trainer.trainerName,
          sessionCount,
          revenue,
          avgPrice,
          settlementRate: rate,
          settlement,
          afterTax,
        };
      }));

      const totalSessions = trainerRows.reduce((s, t) => s + t.sessionCount, 0);
      const totalRevenue = trainerRows.reduce((s, t) => s + t.revenue, 0);
      const totalAvgPrice = totalSessions > 0 ? Math.round(totalRevenue / totalSessions) : 0;
      const totalSettlement = trainerRows.reduce((s, t) => s + t.settlement, 0);
      const totalAfterTax = trainerRows.reduce((s, t) => s + t.afterTax, 0);

      return {
        yearMonth: input.yearMonth,
        trainers: trainerRows,
        total: { sessionCount: totalSessions, revenue: totalRevenue, avgPrice: totalAvgPrice, settlement: totalSettlement, afterTax: totalAfterTax },
      };
    }),

  // 관리자: 특정 트레이너의 회원 목록 + PT 잔여 횟수
  getMembersByTrainer: protectedProcedure
    .input(z.object({ trainerId: z.number() }))
    .query(async ({ ctx, input }) => {
      if (ctx.user?.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const memberList = await db
        .select()
        .from(members)
        .where(eq(members.trainerId, input.trainerId))
        .orderBy(desc(members.createdAt));

      const withPt = await Promise.all(memberList.map(async (m) => {
        const pkgs = await db
          .select({ totalSessions: ptPackages.totalSessions, usedSessions: ptPackages.usedSessions, unpaidAmount: ptPackages.unpaidAmount })
          .from(ptPackages)
          .where(and(eq(ptPackages.memberId, m.id), eq(ptPackages.status, "active")));
        const remainingPt = pkgs.reduce((s, p) => s + (p.totalSessions - p.usedSessions), 0);
        const hasUnpaid = pkgs.some(p => p.unpaidAmount && p.unpaidAmount > 0);
        return { ...m, remainingPt, hasUnpaid };
      }));

      return withPt;
    }),
});

// ─── Dashboard ────────────────────────────────────────────────────────────────
const dashboardRouter = t.router({
  getStats: protectedProcedure.query(({ ctx }) => {
    const trainerId = ctx.user.trainerId;
    if (!trainerId) throw new TRPCError({ code: "FORBIDDEN" });
    return getDashboardStats(trainerId);
  }),

  // 최근 6개월 월별 회원 수 / 출석 수 추이
  getMonthlyChart: protectedProcedure.query(async ({ ctx }) => {
    const trainerId = ctx.user.trainerId;
    if (!trainerId) throw new TRPCError({ code: "FORBIDDEN" });
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    const months: { label: string; start: string; end: string }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setDate(1);
      d.setMonth(d.getMonth() - i);
      const start = d.toISOString().split("T")[0];
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 1).toISOString().split("T")[0];
      months.push({ label: `${d.getMonth() + 1}월`, start, end });
    }

    const rows = await Promise.all(months.map(async (m) => {
      const [attendCount, newMembers] = await Promise.all([
        db.select({ count: sql<number>`COUNT(*)` })
          .from(attendances)
          .where(and(
            eq(attendances.trainerId, trainerId),
            eq(attendances.status, "attended"),
            sql`${attendances.attendDate} >= ${m.start}`,
            sql`${attendances.attendDate} < ${m.end}`
          )),
        db.select({ count: sql<number>`COUNT(*)` })
          .from(members)
          .where(and(
            eq(members.trainerId, trainerId),
            sql`${members.createdAt} >= ${m.start}`,
            sql`${members.createdAt} < ${m.end}`
          )),
      ]);
      return {
        month: m.label,
        출석: Number(attendCount[0]?.count ?? 0),
        신규회원: Number(newMembers[0]?.count ?? 0),
      };
    }));

    return rows;
  }),

  // 최근 6개월 월별 매출/정산 추이 (트레이너용)
  getMonthlyRevenue: protectedProcedure.query(async ({ ctx }) => {
    const trainerId = ctx.user.trainerId;
    if (!trainerId) throw new TRPCError({ code: "FORBIDDEN" });
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    const settingResult = await db
      .select({ settlementRate: trainerSettings.settlementRate })
      .from(trainerSettings)
      .where(eq(trainerSettings.trainerId, trainerId))
      .limit(1);
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

    const rows = await Promise.all(months.map(async (m) => {
      const res = await db
        .select({ total: sql<number>`COALESCE(SUM(${ptPackages.pricePerSession}),0)` })
        .from(ptSessionLogs)
        .leftJoin(ptPackages, eq(ptSessionLogs.packageId, ptPackages.id))
        .where(and(
          eq(ptSessionLogs.trainerId, trainerId),
          sql`${ptSessionLogs.sessionDate} >= ${m.start}`,
          sql`${ptSessionLogs.sessionDate} < ${m.end}`
        ));
      const revenue = Number(res[0]?.total ?? 0);
      return {
        month: m.label,
        매출: revenue,
        정산: Math.round(revenue * rate),
      };
    }));

    return rows;
  }),
});

// ─── Workout Memos ────────────────────────────────────────────────────────────
const workoutMemosRouter = t.router({
  listByMember: protectedProcedure
    .input(z.object({ memberId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      return db
        .select()
        .from(workoutMemos)
        .where(eq(workoutMemos.memberId, input.memberId))
        .orderBy(desc(workoutMemos.memoDate));
    }),

  create: protectedProcedure
    .input(z.object({
      memberId: z.number(),
      memoDate: z.string(),
      content: z.string().min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const trainerId = ctx.user.trainerId;
      if (!trainerId) throw new TRPCError({ code: "FORBIDDEN" });

      const [row] = await db.insert(workoutMemos).values({
        memberId: input.memberId,
        trainerId,
        memoDate: input.memoDate,
        content: input.content,
      }).returning();
      return row;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      await db.delete(workoutMemos).where(eq(workoutMemos.id, input.id));
      return { success: true };
    }),

  update: protectedProcedure
    .input(z.object({ id: z.number(), content: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

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
    for (const r of rows) {
      grouped[r.checkDate] = (grouped[r.checkDate] ?? 0) + 1;
    }
    return Object.entries(grouped)
      .map(([date, count]) => ({ date, count }))
      .slice(0, 10);
  }),

  listByMember: protectedProcedure
    .input(z.object({ memberId: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      return db
        .select()
        .from(attendanceChecks)
        .where(eq(attendanceChecks.memberId, input.memberId))
        .orderBy(desc(attendanceChecks.checkDate));
    }),

  getByMemberDate: protectedProcedure
    .input(z.object({ memberId: z.number(), date: z.string() }))
    .query(async ({ input }) => {
      const db = getDb();
      const rows = await db
        .select()
        .from(attendanceChecks)
        .where(and(eq(attendanceChecks.memberId, input.memberId), eq(attendanceChecks.checkDate, input.date)))
        .limit(1);
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
      const existing = await db
        .select({ id: attendanceChecks.id })
        .from(attendanceChecks)
        .where(and(eq(attendanceChecks.memberId, memberId), eq(attendanceChecks.checkDate, checkDate)))
        .limit(1);

      if (existing[0]) {
        await db.update(attendanceChecks)
          .set({ ...fields, updatedAt: sql`now()::text` })
          .where(eq(attendanceChecks.id, existing[0].id));
      } else {
        await db.insert(attendanceChecks).values({ memberId, trainerId, checkDate, ...fields });
      }

      // attendances 테이블도 동기화
      const today = checkDate;
      const existingAtt = await db
        .select({ id: attendances.id })
        .from(attendances)
        .where(and(eq(attendances.memberId, memberId), eq(attendances.attendDate, today)))
        .limit(1);
      const attStatus = input.status === "attended" ? "attended" : input.status === "noshow" ? "noshow" : "absent";
      if (existingAtt[0]) {
        await db.update(attendances).set({ status: attStatus }).where(eq(attendances.id, existingAtt[0].id));
      } else {
        await db.insert(attendances).values({ memberId, trainerId, attendDate: today, status: attStatus });
      }

      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ memberId: z.number(), date: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const trainerId = ctx.user.trainerId;
      if (!trainerId) throw new TRPCError({ code: "FORBIDDEN" });
      await db.delete(attendanceChecks).where(
        and(eq(attendanceChecks.memberId, input.memberId), eq(attendanceChecks.checkDate, input.date))
      );
      await db.delete(attendances).where(
        and(eq(attendances.memberId, input.memberId), eq(attendances.attendDate, input.date))
      );
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
  // 공유 토큰 발급 (기존 토큰 재사용)
  generate: protectedProcedure
    .input(z.object({ memberId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const trainerId = ctx.user.trainerId;
      if (!trainerId) throw new TRPCError({ code: "FORBIDDEN" });

      const existing = await db
        .select()
        .from(reportTokens)
        .where(
          and(
            eq(reportTokens.memberId, input.memberId),
            eq(reportTokens.trainerId, trainerId)
          )
        )
        .limit(1);

      if (existing[0]) return { token: existing[0].token };

      const token = randomUUID().replace(/-/g, "");
      await db.insert(reportTokens).values({ token, memberId: input.memberId, trainerId });
      return { token };
    }),

  // 토큰 재발급 (기존 토큰 삭제 후 신규 생성)
  regenerate: protectedProcedure
    .input(z.object({ memberId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const trainerId = ctx.user.trainerId;
      if (!trainerId) throw new TRPCError({ code: "FORBIDDEN" });

      await db.delete(reportTokens).where(
        and(
          eq(reportTokens.memberId, input.memberId),
          eq(reportTokens.trainerId, trainerId)
        )
      );

      const token = randomUUID().replace(/-/g, "");
      await db.insert(reportTokens).values({ token, memberId: input.memberId, trainerId });
      return { token };
    }),

  // 공개 보고서 조회 (토큰으로, 인증 불필요)
  getPublic: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ input }) => {
      const db = getDb();

      const tokenRows = await db
        .select()
        .from(reportTokens)
        .where(eq(reportTokens.token, input.token))
        .limit(1);

      if (!tokenRows[0])
        throw new TRPCError({ code: "NOT_FOUND", message: "유효하지 않은 링크입니다." });

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

// ─── ZIANTGYM+ 회원앱 ─────────────────────────────────────────────────────────

const gymPlusProtected = t.procedure.use(({ ctx, next }) => {
  const gymMemberId = (ctx.req.session as any).gymPlusMemberId as number | undefined;
  if (!gymMemberId) throw new TRPCError({ code: "UNAUTHORIZED" });
  return next({ ctx: { ...ctx, gymPlusMemberId: gymMemberId } });
});

const adminOnlyGymPlus = t.procedure;

const gymPlusRouter = t.router({
  memberLogin: publicProcedure
    .input(z.object({ username: z.string(), password: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // 전화번호 형식 정규화: 입력값과 저장값 모두 숫자만 추출해서 비교
      const digitsOnly = input.username.replace(/\D/g, "");

      // 짐플러스 회원 테이블 확인 (저장된 username의 비숫자 제거 후 비교)
      const result = await db.select().from(gymPlusMembers)
        .where(sql`REPLACE(REPLACE(REPLACE(${gymPlusMembers.username}, '-', ''), ' ', ''), '+', '') = ${digitsOnly}`)
        .limit(1);
      const member = result[0];

      if (member) {
        if (!member.isActive) throw new TRPCError({ code: "FORBIDDEN", message: "비활성화된 계정입니다." });
        // 비밀번호는 항상 전화번호 뒷자리 4자리로 검증
        const phoneDigits = (member.phone ?? member.username).replace(/\D/g, "");
        const last4 = phoneDigits.slice(-4);
        if (input.password !== last4) throw new TRPCError({ code: "UNAUTHORIZED", message: "아이디 또는 비밀번호가 잘못되었습니다." });

        // admin 계정이면 통합관리 세션도 설정
        const userRow = await db.select().from(users).where(eq(users.username, input.username)).limit(1);
        if (userRow[0]?.role === "admin") {
          const authUser = { id: userRow[0].id, username: userRow[0].username, role: userRow[0].role as any, trainerId: undefined };
          (ctx.req.session as any).user = authUser;
          await new Promise<void>((resolve, reject) => ctx.req.session.save((err) => err ? reject(err) : resolve()));
          return { id: member.id, username: member.username, name: member.name, isAdmin: true };
        }

        (ctx.req.session as any).gymPlusMemberId = member.id;
        await new Promise<void>((resolve, reject) => ctx.req.session.save((err) => err ? reject(err) : resolve()));
        return { id: member.id, username: member.username, name: member.name, membershipType: member.membershipType };
      }

      // 짐플러스 회원 없으면 users 테이블 확인 (admin만)
      const userRow = await db.select().from(users).where(eq(users.username, input.username)).limit(1);
      if (!userRow[0]) throw new TRPCError({ code: "UNAUTHORIZED", message: "아이디 또는 비밀번호가 잘못되었습니다." });
      const valid = await bcrypt.compare(input.password, userRow[0].password);
      if (!valid) throw new TRPCError({ code: "UNAUTHORIZED", message: "아이디 또는 비밀번호가 잘못되었습니다." });
      if (userRow[0].role !== "admin") throw new TRPCError({ code: "UNAUTHORIZED", message: "아이디 또는 비밀번호가 잘못되었습니다." });

      const authUser = { id: userRow[0].id, username: userRow[0].username, role: userRow[0].role as any, trainerId: undefined };
      (ctx.req.session as any).user = authUser;
      await new Promise<void>((resolve, reject) => ctx.req.session.save((err) => err ? reject(err) : resolve()));
      return { id: userRow[0].id, username: userRow[0].username, name: userRow[0].username, isAdmin: true };
    }),

  memberLogout: publicProcedure.mutation(async ({ ctx }) => {
    delete (ctx.req.session as any).gymPlusMemberId;
    await new Promise<void>((resolve, reject) => ctx.req.session.save((err) => err ? reject(err) : resolve()));
    return { success: true };
  }),

  memberMe: publicProcedure.query(async ({ ctx }) => {
    const gymMemberId = (ctx.req.session as any).gymPlusMemberId as number | undefined;
    if (!gymMemberId) return null;
    const db = await getDb();
    if (!db) return null;
    const result = await db.select({
      id: gymPlusMembers.id, username: gymPlusMembers.username,
      name: gymPlusMembers.name, phone: gymPlusMembers.phone, email: gymPlusMembers.email,
      membershipType: gymPlusMembers.membershipType,
      membershipStart: gymPlusMembers.membershipStart, membershipEnd: gymPlusMembers.membershipEnd,
    }).from(gymPlusMembers).where(eq(gymPlusMembers.id, gymMemberId)).limit(1);
    return result[0] ?? null;
  }),

  listVideoCategories: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    return db.select().from(gymPlusVideoCategories).orderBy(gymPlusVideoCategories.sortOrder);
  }),

  listVideos: publicProcedure
    .input(z.object({ categoryId: z.number().optional(), level: z.string().optional() }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const conditions = [eq(gymPlusVideos.isPublished, 1)];
      if (input?.categoryId) conditions.push(eq(gymPlusVideos.categoryId, input.categoryId));
      if (input?.level) conditions.push(eq(gymPlusVideos.level, input.level));
      return db.select().from(gymPlusVideos)
        .where(and(...conditions))
        .orderBy(gymPlusVideos.sortOrder, desc(gymPlusVideos.createdAt));
    }),

  getVideo: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const result = await db.select().from(gymPlusVideos)
        .where(and(eq(gymPlusVideos.id, input.id), eq(gymPlusVideos.isPublished, 1))).limit(1);
      if (!result[0]) throw new TRPCError({ code: "NOT_FOUND" });
      return result[0];
    }),

  listEvents: publicProcedure
    .input(z.object({ eventType: z.string().optional() }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const conditions = [eq(gymPlusEvents.isPublished, 1)];
      if (input?.eventType) conditions.push(eq(gymPlusEvents.eventType, input.eventType));
      return db.select().from(gymPlusEvents)
        .where(and(...conditions))
        .orderBy(desc(gymPlusEvents.isPinned), desc(gymPlusEvents.createdAt));
    }),

  getEvent: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const result = await db.select().from(gymPlusEvents)
        .where(and(eq(gymPlusEvents.id, input.id), eq(gymPlusEvents.isPublished, 1))).limit(1);
      if (!result[0]) throw new TRPCError({ code: "NOT_FOUND" });
      return result[0];
    }),

  listWorkoutLogs: gymPlusProtected
    .input(z.object({ month: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      let logs = await db.select().from(gymPlusWorkoutLogs)
        .where(eq(gymPlusWorkoutLogs.gymPlusMemberId, ctx.gymPlusMemberId))
        .orderBy(desc(gymPlusWorkoutLogs.logDate));
      if (input?.month) logs = logs.filter(l => l.logDate.startsWith(input.month!));
      return logs;
    }),

  createWorkoutLog: gymPlusProtected
    .input(z.object({
      logDate: z.string(),
      title: z.string().optional(),
      exercisesJson: z.string().optional(),
      durationMinutes: z.number().optional(),
      caloriesBurned: z.number().optional(),
      bodyWeight: z.string().optional(),
      notes: z.string().optional(),
      mood: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [row] = await db.insert(gymPlusWorkoutLogs).values({ gymPlusMemberId: ctx.gymPlusMemberId, title: input.title ?? "운동 기록", ...input }).returning();
      return row;
    }),

  updateWorkoutLog: gymPlusProtected
    .input(z.object({
      id: z.number(),
      logDate: z.string().optional(),
      title: z.string().optional(),
      exercisesJson: z.string().optional(),
      durationMinutes: z.number().optional(),
      caloriesBurned: z.number().optional(),
      bodyWeight: z.string().optional(),
      notes: z.string().optional(),
      mood: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { id, ...data } = input;
      const existing = await db.select({ gymPlusMemberId: gymPlusWorkoutLogs.gymPlusMemberId })
        .from(gymPlusWorkoutLogs).where(eq(gymPlusWorkoutLogs.id, id)).limit(1);
      if (!existing[0] || existing[0].gymPlusMemberId !== ctx.gymPlusMemberId)
        throw new TRPCError({ code: "FORBIDDEN" });
      const [row] = await db.update(gymPlusWorkoutLogs).set(data).where(eq(gymPlusWorkoutLogs.id, id)).returning();
      return row;
    }),

  deleteWorkoutLog: gymPlusProtected
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const existing = await db.select({ gymPlusMemberId: gymPlusWorkoutLogs.gymPlusMemberId })
        .from(gymPlusWorkoutLogs).where(eq(gymPlusWorkoutLogs.id, input.id)).limit(1);
      if (!existing[0] || existing[0].gymPlusMemberId !== ctx.gymPlusMemberId)
        throw new TRPCError({ code: "FORBIDDEN" });
      await db.delete(gymPlusWorkoutLogs).where(eq(gymPlusWorkoutLogs.id, input.id));
      return { success: true };
    }),

  updateProfile: gymPlusProtected
    .input(z.object({ name: z.string().min(1).optional(), phone: z.string().optional(), email: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.update(gymPlusMembers).set({ ...input, updatedAt: new Date().toISOString() })
        .where(eq(gymPlusMembers.id, ctx.gymPlusMemberId));
      return { success: true };
    }),

  changePassword: gymPlusProtected
    .input(z.object({ currentPassword: z.string().min(1), newPassword: z.string().min(6) }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [member] = await db.select({ password: gymPlusMembers.password })
        .from(gymPlusMembers).where(eq(gymPlusMembers.id, ctx.gymPlusMemberId)).limit(1);
      if (!member) throw new TRPCError({ code: "NOT_FOUND" });
      const ok = await bcrypt.compare(input.currentPassword, member.password);
      if (!ok) throw new TRPCError({ code: "BAD_REQUEST", message: "현재 비밀번호가 틀렸습니다." });
      const hashed = await bcrypt.hash(input.newPassword, 10);
      await db.update(gymPlusMembers).set({ password: hashed, updatedAt: new Date().toISOString() })
        .where(eq(gymPlusMembers.id, ctx.gymPlusMemberId));
      return { success: true };
    }),

  // 통합관리 시스템 회원 목록 + 짐플러스 계정 연결 여부
  admin_listMainMembers: adminOnlyGymPlus.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const mainMembers = await db.select({
      id: members.id,
      name: members.name,
      phone: members.phone,
      email: members.email,
      membershipStart: members.membershipStart,
      membershipEnd: members.membershipEnd,
      status: members.status,
    }).from(members).orderBy(members.name);

    const gymPlusList = await db.select({
      id: gymPlusMembers.id,
      memberId: gymPlusMembers.memberId,
      username: gymPlusMembers.username,
      membershipType: gymPlusMembers.membershipType,
      isActive: gymPlusMembers.isActive,
    }).from(gymPlusMembers);

    const gymPlusByMemberId = new Map(gymPlusList.filter(g => g.memberId).map(g => [g.memberId!, g]));

    return mainMembers.map(m => ({
      ...m,
      gymPlus: gymPlusByMemberId.get(m.id) ?? null,
    }));
  }),

  // 통합 회원에게 짐플러스 계정 생성 (memberId로 연결)
  admin_createLinkedMember: adminOnlyGymPlus
    .input(z.object({
      memberId: z.number(),
      membershipType: z.enum(["general", "premium", "vip"]).default("general"),
      membershipStart: z.string().optional(),
      membershipEnd: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const mainMember = await db.select().from(members).where(eq(members.id, input.memberId)).limit(1);
      if (!mainMember[0]) throw new TRPCError({ code: "NOT_FOUND" });
      if (!mainMember[0].phone) throw new TRPCError({ code: "BAD_REQUEST", message: "전화번호가 없는 회원입니다. 통합관리에서 전화번호를 먼저 등록해주세요." });

      // username = digits-only phone, password = last 4 digits
      const phone = mainMember[0].phone;
      const digitsOnly = phone.replace(/\D/g, "");
      const last4 = digitsOnly.slice(-4);
      const username = digitsOnly; // always store as digits-only e.g. 01077051640

      const existing = await db.select({ id: gymPlusMembers.id })
        .from(gymPlusMembers).where(eq(gymPlusMembers.username, username)).limit(1);
      if (existing[0]) throw new TRPCError({ code: "CONFLICT", message: "이미 짐플러스 계정이 존재합니다." });

      const hashed = await bcrypt.hash(last4, 10);
      const [row] = await db.insert(gymPlusMembers).values({
        username,
        password: hashed,
        name: mainMember[0].name,
        phone,
        email: mainMember[0].email ?? undefined,
        memberId: input.memberId,
        membershipType: input.membershipType,
        membershipStart: input.membershipStart ?? mainMember[0].membershipStart ?? undefined,
        membershipEnd: input.membershipEnd ?? mainMember[0].membershipEnd ?? undefined,
      }).returning();
      const { password: _, ...safe } = row;
      return safe;
    }),

  admin_listMembers: adminOnlyGymPlus.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    return db.select({
      id: gymPlusMembers.id, username: gymPlusMembers.username,
      name: gymPlusMembers.name, phone: gymPlusMembers.phone, email: gymPlusMembers.email,
      membershipType: gymPlusMembers.membershipType,
      membershipStart: gymPlusMembers.membershipStart, membershipEnd: gymPlusMembers.membershipEnd,
      isActive: gymPlusMembers.isActive, createdAt: gymPlusMembers.createdAt,
    }).from(gymPlusMembers).orderBy(desc(gymPlusMembers.createdAt));
  }),

  admin_createMember: adminOnlyGymPlus
    .input(z.object({
      username: z.string().min(3),
      password: z.string().min(6),
      name: z.string().min(1),
      phone: z.string().optional(),
      email: z.string().optional(),
      membershipType: z.enum(["general", "premium", "vip"]).default("general"),
      membershipStart: z.string().optional(),
      membershipEnd: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const existing = await db.select({ id: gymPlusMembers.id })
        .from(gymPlusMembers).where(eq(gymPlusMembers.username, input.username)).limit(1);
      if (existing[0]) throw new TRPCError({ code: "CONFLICT", message: "이미 사용 중인 아이디입니다." });
      const hashed = await bcrypt.hash(input.password, 10);
      const [row] = await db.insert(gymPlusMembers).values({ ...input, password: hashed }).returning();
      const { password: _, ...safe } = row;
      return safe;
    }),

  admin_updateMember: adminOnlyGymPlus
    .input(z.object({
      id: z.number(),
      name: z.string().optional(),
      phone: z.string().optional(),
      email: z.string().optional(),
      membershipType: z.enum(["general", "premium", "vip"]).optional(),
      membershipStart: z.string().optional(),
      membershipEnd: z.string().optional(),
      isActive: z.number().optional(),
      password: z.string().min(6).optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { id, password, ...rest } = input;
      const updateData: any = { ...rest, updatedAt: new Date().toISOString() };
      if (password) updateData.password = await bcrypt.hash(password, 10);
      await db.update(gymPlusMembers).set(updateData).where(eq(gymPlusMembers.id, id));
      return { success: true };
    }),

  admin_deleteMember: adminOnlyGymPlus
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.delete(gymPlusWorkoutLogs).where(eq(gymPlusWorkoutLogs.gymPlusMemberId, input.id));
      await db.delete(gymPlusMembers).where(eq(gymPlusMembers.id, input.id));
      return { success: true };
    }),

  admin_resetPassword: adminOnlyGymPlus
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const member = await db.select({ id: gymPlusMembers.id, phone: gymPlusMembers.phone })
        .from(gymPlusMembers).where(eq(gymPlusMembers.id, input.id)).limit(1);
      if (!member[0]) throw new TRPCError({ code: "NOT_FOUND" });
      if (!member[0].phone) throw new TRPCError({ code: "BAD_REQUEST", message: "전화번호가 없습니다." });
      const last4 = member[0].phone.replace(/\D/g, "").slice(-4);
      const hashed = await bcrypt.hash(last4, 10);
      await db.update(gymPlusMembers).set({ password: hashed, updatedAt: new Date().toISOString() })
        .where(eq(gymPlusMembers.id, input.id));
      return { success: true };
    }),

  admin_listVideos: adminOnlyGymPlus.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    return db.select().from(gymPlusVideos).orderBy(gymPlusVideos.sortOrder, desc(gymPlusVideos.createdAt));
  }),

  admin_createVideo: adminOnlyGymPlus
    .input(z.object({
      categoryId: z.number().optional(),
      title: z.string().min(1),
      description: z.string().optional(),
      videoUrl: z.string().min(1),
      thumbnailUrl: z.string().optional(),
      duration: z.number().optional(),
      level: z.enum(["beginner", "intermediate", "advanced"]).default("beginner"),
      bodyPart: z.string().optional(),
      isPublished: z.number().default(1),
      sortOrder: z.number().default(0),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [row] = await db.insert(gymPlusVideos).values(input).returning();
      return row;
    }),

  admin_updateVideo: adminOnlyGymPlus
    .input(z.object({
      id: z.number(),
      categoryId: z.number().optional(),
      title: z.string().optional(),
      description: z.string().optional(),
      videoUrl: z.string().optional(),
      thumbnailUrl: z.string().optional(),
      duration: z.number().optional(),
      level: z.enum(["beginner", "intermediate", "advanced"]).optional(),
      bodyPart: z.string().optional(),
      isPublished: z.number().optional(),
      sortOrder: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { id, ...data } = input;
      await db.update(gymPlusVideos).set(data).where(eq(gymPlusVideos.id, id));
      return { success: true };
    }),

  admin_deleteVideo: adminOnlyGymPlus
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.delete(gymPlusVideos).where(eq(gymPlusVideos.id, input.id));
      return { success: true };
    }),

  admin_listCategories: adminOnlyGymPlus.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    return db.select().from(gymPlusVideoCategories).orderBy(gymPlusVideoCategories.sortOrder);
  }),

  admin_createCategory: adminOnlyGymPlus
    .input(z.object({ name: z.string().min(1), sortOrder: z.number().default(0) }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [row] = await db.insert(gymPlusVideoCategories).values(input).returning();
      return row;
    }),

  admin_deleteCategory: adminOnlyGymPlus
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.delete(gymPlusVideoCategories).where(eq(gymPlusVideoCategories.id, input.id));
      return { success: true };
    }),

  admin_listEvents: adminOnlyGymPlus.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    return db.select().from(gymPlusEvents).orderBy(desc(gymPlusEvents.createdAt));
  }),

  admin_createEvent: adminOnlyGymPlus
    .input(z.object({
      title: z.string().min(1),
      content: z.string().min(1),
      imageUrl: z.string().optional(),
      eventType: z.enum(["notice", "event", "promotion"]).default("notice"),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      isPublished: z.number().default(1),
      isPinned: z.number().default(0),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [row] = await db.insert(gymPlusEvents).values(input).returning();
      return row;
    }),

  admin_updateEvent: adminOnlyGymPlus
    .input(z.object({
      id: z.number(),
      title: z.string().optional(),
      content: z.string().optional(),
      imageUrl: z.string().optional(),
      eventType: z.enum(["notice", "event", "promotion"]).optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      isPublished: z.number().optional(),
      isPinned: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { id, ...data } = input;
      await db.update(gymPlusEvents).set(data).where(eq(gymPlusEvents.id, id));
      return { success: true };
    }),

  admin_deleteEvent: adminOnlyGymPlus
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.delete(gymPlusEvents).where(eq(gymPlusEvents.id, input.id));
      return { success: true };
    }),

  admin_listWorkoutLogs: adminOnlyGymPlus
    .input(z.object({ gymPlusMemberId: z.number().optional() }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const query = db.select({
        id: gymPlusWorkoutLogs.id,
        gymPlusMemberId: gymPlusWorkoutLogs.gymPlusMemberId,
        logDate: gymPlusWorkoutLogs.logDate,
        title: gymPlusWorkoutLogs.title,
        durationMinutes: gymPlusWorkoutLogs.durationMinutes,
        caloriesBurned: gymPlusWorkoutLogs.caloriesBurned,
        bodyWeight: gymPlusWorkoutLogs.bodyWeight,
        mood: gymPlusWorkoutLogs.mood,
        createdAt: gymPlusWorkoutLogs.createdAt,
        memberName: gymPlusMembers.name,
      }).from(gymPlusWorkoutLogs)
        .leftJoin(gymPlusMembers, eq(gymPlusWorkoutLogs.gymPlusMemberId, gymPlusMembers.id));
      if (input?.gymPlusMemberId) {
        return query.where(eq(gymPlusWorkoutLogs.gymPlusMemberId, input.gymPlusMemberId))
          .orderBy(desc(gymPlusWorkoutLogs.createdAt));
      }
      return query.orderBy(desc(gymPlusWorkoutLogs.createdAt));
    }),

  admin_deleteWorkoutLog: adminOnlyGymPlus
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.delete(gymPlusWorkoutLogs).where(eq(gymPlusWorkoutLogs.id, input.id));
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
  admin: adminRouter,
  dashboard: dashboardRouter,
  workoutMemos: workoutMemosRouter,
  parQ: parQRouter,
  attendanceChecks: attendanceChecksRouter,
  reports: reportsRouter,
  schedules: schedulesRouter,
  gym: gymRouter,
  gymPlus: gymPlusRouter,
});

export type AppRouter = typeof appRouter;
