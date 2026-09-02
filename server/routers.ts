import { gymRouter } from "./gymRouters";
import { sendPointClaimNotification, sendRequestNotification } from "./email";
import webpush from "web-push";

// VAPID 설정 (Railway 환경변수 우선, fallback은 빌드 시 생성된 키)
const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY || "BK0ZTd_UQHIaELB4FB0JphGm4UWlwIAwsfOdF3DNnAn_DGQNfwVm3I2HMi2VQxuHHUZhCwup7h1frg8Ue2XKMl8";
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY || "P6P5QkLgcevRCu79kmk4AhUIlaxvrqKosPHB5NCkHv4";
webpush.setVapidDetails("mailto:admin@ziantgym.com", VAPID_PUBLIC, VAPID_PRIVATE);
import Anthropic from "@anthropic-ai/sdk";
import { initTRPC, TRPCError } from "@trpc/server";
import { z } from "zod";
import { eq, and, desc, sql, lte, gte, gt, isNull, or } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { getDb, getDashboardStats, pool } from "./db";
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
  gymPlusMemberHealth,
  gymPlusMembershipRenewals,
  gymPlusDailyDiets,
  gymPlusDietFoods,
  gymPlusProducts,
  gymPlusPointLogs,
  gymPlusPurchaseRequests,
  gymPlusPointClaims,
  gymPlusPointChargeRequests,
  gymPlusPointExtensionRequests,
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
      // 키오스크는 전화번호로 members를 찾아(LIMIT 1) 그 행에 출입을 기록한다. 같은 사람이
      // 중복 등록되어 있으면 키오스크가 쓴 행과 지금 열어본 행이 달라 출입 기록이 안 보인다.
      // 동일 전화번호를 가진 모든 회원 행의 기록을 함께 조회해 이런 누락을 막는다.
      const ids = new Set<number>([input.memberId]);
      const [self] = await pool.query(
        `SELECT phone FROM members WHERE id = $1 LIMIT 1`, [input.memberId]
      ).then(r => r.rows as { phone: string | null }[]);
      const digits = self?.phone?.replace(/\D/g, "");
      if (digits && digits.length >= 9) {
        const dupes = await pool.query(
          `SELECT id FROM members WHERE REGEXP_REPLACE(COALESCE(phone,''), '[^0-9]', '', 'g') = $1`,
          [digits]
        );
        for (const row of dupes.rows) ids.add(row.id);
      }

      const result = await pool.query(
        `SELECT * FROM attendance_checks WHERE "memberId" = ANY($1::int[])
         ORDER BY "checkDate" DESC`,
        [Array.from(ids)]
      );
      return result.rows;
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

      const isNewRecord = !existing[0];
      if (existing[0]) {
        await db.update(attendanceChecks)
          .set({ ...fields, updatedAt: sql`now()::text` })
          .where(eq(attendanceChecks.id, existing[0].id));
      } else {
        await db.insert(attendanceChecks).values({ memberId, trainerId, checkDate, ...fields });
      }

      // 신규 출석 체크 + attended 상태일 때 → 연결된 짐플러스 회원에게 포인트 적립
      if (isNewRecord && input.status === "attended") {
        try {
          const settingRes = await pool.query(`SELECT value FROM gym_plus_settings WHERE key = 'checkin_point_amount'`);
          const pointAmount = parseInt(settingRes.rows[0]?.value ?? "0");
          if (pointAmount > 0) {
            const gmRow = await db.select({ id: gymPlusMembers.id, points: gymPlusMembers.points })
              .from(gymPlusMembers).where(eq(gymPlusMembers.memberId, memberId)).limit(1);
            if (gmRow[0]) {
              const newBalance = (gmRow[0].points ?? 0) + pointAmount;
              await db.update(gymPlusMembers).set({ points: newBalance }).where(eq(gymPlusMembers.id, gmRow[0].id));
              await pool.query(
                `INSERT INTO gym_plus_point_logs ("gymPlusMemberId", type, amount, "balanceAfter", reason, "createdAt")
                 VALUES ($1, 'earn', $2, $3, $4, now()::text)`,
                [gmRow[0].id, pointAmount, newBalance, `출입 체크인 (${checkDate})`]
              );
            }
          }
        } catch (e) {
          console.error("checkin point error:", e);
        }
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

// 포인트 회원권 연장 단가 (1,000P = 1일)
const POINTS_PER_EXTENSION_DAY = 1000;
// 포인트를 실제로 "쓸" 수 있으려면(회원권 연장, 상품 구매) 이 이상 모아야 한다.
// 소액 포인트를 조금씩 계속 쓰며 재등록·정상 구매를 미루는 것을 막기 위함.
const MIN_POINTS_TO_USE = 3000;
// 상품 구매 시 포인트는 이 단위로만 사용할 수 있다 (분할결제 시 나머지는 현금/이체/카드).
const POINT_USE_STEP = 50;

// 신청 알림 메일에 넣을 회원 연락처 조회 (실패해도 알림만 영향받도록 예외를 삼킨다)
async function gymPlusMemberContact(gymPlusMemberId: number) {
  try {
    const db = await getDb();
    if (!db) return { name: "-", phone: "-" };
    const [m] = await db
      .select({ name: gymPlusMembers.name, phone: gymPlusMembers.phone, username: gymPlusMembers.username })
      .from(gymPlusMembers).where(eq(gymPlusMembers.id, gymPlusMemberId)).limit(1);
    return { name: m?.name ?? "-", phone: m?.phone || m?.username || "-" };
  } catch {
    return { name: "-", phone: "-" };
  }
}

// 비회원 온라인 등록 가격표 — 금액은 서버가 단독으로 결정한다.
// client/src/pages/gym-plus/GymPlusLogin.tsx의 PERIOD_PRICES와 동일하게 유지할 것.
const REGISTRATION_PRICES: Record<string, number> = {
  "1개월": 80000,
  "3개월": 159000,
  "6개월": 216000,
  "12개월": 312000,
};

// ─── 미션 회차 계산용 날짜 유틸 ────────────────────────────────────────────────
// 회원권/프로그램 날짜는 모두 KST 달력 기준의 'YYYY-MM-DD' 문자열이다.
// Date의 로컬 타임존이나 setMonth의 월말 넘침(1/31 +1개월 = 3/3)에 의존하지 않도록
// 연·월·일 숫자만으로 계산한다.
const MISSION_MAX_PERIOD = 3; // 12주 = 1~3회차 보상
type Ymd = { y: number; m: number; d: number }; // m: 0-11

function parseYmd(s: string | null | undefined): Ymd | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s ?? "");
  if (!m) return null;
  return { y: Number(m[1]), m: Number(m[2]) - 1, d: Number(m[3]) };
}

function fmtYmd({ y, m, d }: Ymd) {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

// 월 더하기 — 대상 월에 해당 일자가 없으면 말일로 맞춘다(1/31 +1개월 = 2/28).
function addMonthsYmd({ y, m, d }: Ymd, add: number): Ymd {
  const abs = m + add;
  const ny = y + Math.floor(abs / 12);
  const nm = ((abs % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(ny, nm + 1, 0)).getUTCDate();
  return { y: ny, m: nm, d: Math.min(d, lastDay) };
}

// KST 자정을 UTC 시각으로 (KST = UTC+9)
function ymdToUtc({ y, m, d }: Ymd) {
  return Date.UTC(y, m, d) - 9 * 60 * 60 * 1000;
}

function addMonthsKst(anchor: Ymd, add: number) {
  return new Date(ymdToUtc(addMonthsYmd(anchor, add)));
}

function kstYmd(at: Date): Ymd {
  const k = new Date(at.getTime() + 9 * 60 * 60 * 1000);
  return { y: k.getUTCFullYear(), m: k.getUTCMonth(), d: k.getUTCDate() };
}

const gymPlusProtected = t.procedure.use(({ ctx, next }) => {
  const gymMemberId = (ctx.req.session as any).gymPlusMemberId as number | undefined;
  if (!gymMemberId) throw new TRPCError({ code: "UNAUTHORIZED" });
  return next({ ctx: { ...ctx, gymPlusMemberId: gymMemberId } });
});

const adminOnlyGymPlus = t.procedure.use(({ ctx, next }) => {
  if (!ctx.user || (ctx.user.role !== "admin" && ctx.user.role !== "sub_admin"))
    throw new TRPCError({ code: "FORBIDDEN" });
  return next({ ctx: { ...ctx, user: ctx.user } });
});

// 짐플러스 로그인 무차별 대입 방지: 계정당 연속 실패 5회 시 1분 잠금
const loginAttempts = new Map<string, { count: number; lockedUntil: number }>();
const LOGIN_MAX_ATTEMPTS = 5;
const LOGIN_LOCKOUT_MS = 60 * 1000;

const gymPlusRouter = t.router({
  memberLogin: publicProcedure
    .input(z.object({ username: z.string(), password: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // 입력 전화번호 숫자만 추출
      const inputDigits = input.username.replace(/\D/g, "");

      const now = Date.now();
      const attempt = loginAttempts.get(inputDigits);
      if (attempt && attempt.lockedUntil > now) {
        const waitSec = Math.ceil((attempt.lockedUntil - now) / 1000);
        throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: `로그인 시도가 너무 많습니다. ${waitSec}초 후 다시 시도하세요.` });
      }

      // 모든 짐플러스 회원 가져와서 JS에서 전화번호 숫자 비교
      const allMembers = await db.select().from(gymPlusMembers);
      const member = allMembers.find(m => m.username.replace(/\D/g, "") === inputDigits);

      if (member) {
        if (!member.isActive) throw new TRPCError({ code: "FORBIDDEN", message: "비활성화된 계정입니다." });
        // 비밀번호는 항상 전화번호 뒷자리 4자리
        const phoneDigits = (member.phone ?? member.username).replace(/\D/g, "");
        const last4 = phoneDigits.slice(-4);
        if (input.password !== last4) {
          const prev = loginAttempts.get(inputDigits);
          const count = (prev && prev.lockedUntil <= now ? prev.count : 0) + 1;
          loginAttempts.set(inputDigits, {
            count,
            lockedUntil: count >= LOGIN_MAX_ATTEMPTS ? now + LOGIN_LOCKOUT_MS : 0,
          });
          throw new TRPCError({ code: "UNAUTHORIZED", message: "비밀번호가 잘못되었습니다." });
        }
        loginAttempts.delete(inputDigits);

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

  submitRegistrationRequest: publicProcedure
    .input(z.object({
      name: z.string().min(1),
      phone: z.string().min(1),
      membershipPeriod: z.enum(["1개월", "3개월", "6개월", "12개월"]),
      signatureData: z.string().optional(),
      agreedMarketing: z.boolean().optional(),
      contractDate: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      // 공개 엔드포인트라 클라이언트가 보낸 금액을 신뢰하지 않는다.
      // 위조된 금액이 데스크/CRM에 그대로 보이면 오입금·분쟁으로 이어진다.
      const amount = REGISTRATION_PRICES[input.membershipPeriod];

      await pool.query(
        `INSERT INTO gym_plus_registration_requests
          (name, phone, "membershipPeriod", amount, status, "signatureData", "agreedMarketing", "contractDate", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, 'pending', $5, $6, $7, now()::text, now()::text)`,
        [
          input.name, input.phone, input.membershipPeriod, amount,
          input.signatureData ?? "",
          input.agreedMarketing ? 1 : 0,
          input.contractDate ?? new Date().toLocaleDateString("ko-KR"),
        ]
      );

      // 통합운영시스템 상담 CRM에 카드 자동 생성 (fire-and-forget)
      fetch("https://remarkable-tenderness-production.up.railway.app/api/booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: input.name,
          phone: input.phone,
          purpose: `[짐+ 온라인등록] ${input.membershipPeriod} / ${amount.toLocaleString()}원 계좌이체 대기`,
          privacyAgreed: true,
          marketingAgreed: Boolean(input.agreedMarketing),
        }),
      }).catch(() => {});

      return { success: true };
    }),

  getRegistrationBankAccount: publicProcedure.query(() => {
    return { bankAccount: "카카오뱅크 3333-05-2664409 이준산" };
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
      points: gymPlusMembers.points, memberId: gymPlusMembers.memberId,
      programName: gymPlusMembers.programName,
    }).from(gymPlusMembers).where(eq(gymPlusMembers.id, gymMemberId)).limit(1);
    const me = result[0];
    if (!me) return null;

    // 회원권 만료일의 원본(源本)은 통합관리 members 테이블이다. 짐+ 복사본은
    // 계정 생성 시점 값이라 데스크 재등록 후 갱신되지 않으므로, 연결된 회원의
    // 실제 만료일을 우선 사용한다 (memberId 우선, 없으면 전화번호로 매칭).
    let main: { membershipStart: string | null; membershipEnd: string | null } | undefined;
    if (me.memberId) {
      const [row] = await db.select({ membershipStart: members.membershipStart, membershipEnd: members.membershipEnd })
        .from(members).where(eq(members.id, me.memberId)).limit(1);
      main = row;
    } else if (me.phone) {
      const digits = me.phone.replace(/\D/g, "");
      if (digits.length >= 4) {
        const [row] = await db.select({ membershipStart: members.membershipStart, membershipEnd: members.membershipEnd })
          .from(members)
          .where(sql`REGEXP_REPLACE(COALESCE(${members.phone},''), '[^0-9]', '', 'g') = ${digits}`)
          .limit(1);
        main = row;
      }
    }

    return {
      ...me,
      membershipStart: main?.membershipStart ?? me.membershipStart,
      membershipEnd: main?.membershipEnd ?? me.membershipEnd,
    };
  }),

  listVideoCategories: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    return db.select().from(gymPlusVideoCategories).orderBy(gymPlusVideoCategories.sortOrder);
  }),

  listCategories: publicProcedure.query(async () => {
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
      bodyPartsJson: z.string().optional(),
      conditionScore: z.number().optional(),
      sleepHours: z.string().optional(),
      energyLevel: z.string().optional(),
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

  // 출석 체크인 (컨디션 + 운동부위 + 주제 + 강도 저장 + 추천 영상 반환)
  checkIn: gymPlusProtected
    .input(z.object({
      conditionScore: z.number().min(1).max(5),
      sleepHours: z.string(),
      energyLevel: z.string(),
      bodyPartsJson: z.string().optional(),  // JSON array
      workoutTheme: z.string().optional(),   // JSON array
      intensity: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const today = new Date().toISOString().slice(0, 10);

      const saveData = {
        conditionScore: input.conditionScore,
        sleepHours: input.sleepHours,
        energyLevel: input.energyLevel,
        bodyPartsJson: input.bodyPartsJson,
        workoutTheme: input.workoutTheme,
        intensity: input.intensity,
      };

      const existing = await db.select({ id: gymPlusWorkoutLogs.id })
        .from(gymPlusWorkoutLogs)
        .where(and(
          eq(gymPlusWorkoutLogs.gymPlusMemberId, ctx.gymPlusMemberId),
          eq(gymPlusWorkoutLogs.logDate, today),
          sql`${gymPlusWorkoutLogs.title} = '출석체크'`
        )).limit(1);

      if (existing[0]) {
        await db.update(gymPlusWorkoutLogs).set(saveData)
          .where(eq(gymPlusWorkoutLogs.id, existing[0].id));
      } else {
        await db.insert(gymPlusWorkoutLogs).values({
          gymPlusMemberId: ctx.gymPlusMemberId,
          logDate: today,
          title: "출석체크",
          ...saveData,
        });
      }

      // 추천 영상: 운동 부위 → 강도(level) → 랜덤 순으로 필터링
      const themes: string[] = input.workoutTheme ? JSON.parse(input.workoutTheme) : [];
      const bodyParts: string[] = input.bodyPartsJson ? JSON.parse(input.bodyPartsJson) : [];

      const levelMap: Record<string, string> = { "높음": "advanced", "보통": "intermediate", "낮음": "beginner" };
      const level = input.intensity ? levelMap[input.intensity] : null;

      let videos: any[] = [];

      // 1차: 부위 매칭 영상
      if (bodyParts.length > 0) {
        for (const part of bodyParts) {
          const found = await db.select().from(gymPlusVideos)
            .where(and(eq(gymPlusVideos.isPublished, 1), sql`${gymPlusVideos.bodyPart} ILIKE ${'%' + part + '%'}`))
            .limit(3);
          videos.push(...found);
        }
      }

      // 2차: 주제별 키워드 매칭
      if (videos.length < 3 && themes.length > 0) {
        for (const theme of themes) {
          const keyword = theme === "유산소 위주" ? "유산소" : theme === "스트레칭 위주" ? "스트레칭" : null;
          if (keyword) {
            const found = await db.select().from(gymPlusVideos)
              .where(and(eq(gymPlusVideos.isPublished, 1), sql`(${gymPlusVideos.bodyPart} ILIKE ${'%' + keyword + '%'} OR ${gymPlusVideos.title} ILIKE ${'%' + keyword + '%'})`))
              .limit(3);
            videos.push(...found);
          }
        }
      }

      // 3차: 강도(level) 기반
      if (videos.length < 3 && level) {
        const found = await db.select().from(gymPlusVideos)
          .where(and(eq(gymPlusVideos.isPublished, 1), eq(gymPlusVideos.level, level)))
          .orderBy(sql`RANDOM()`).limit(3);
        videos.push(...found);
      }

      // 4차: 그래도 부족하면 랜덤
      if (videos.length < 3) {
        const found = await db.select().from(gymPlusVideos)
          .where(eq(gymPlusVideos.isPublished, 1))
          .orderBy(sql`RANDOM()`).limit(3);
        videos.push(...found);
      }

      // 중복 제거 후 최대 3개
      const seen = new Set<number>();
      const unique = videos.filter(v => { if (seen.has(v.id)) return false; seen.add(v.id); return true; }).slice(0, 3);

      return { success: true, recommendedVideos: unique };
    }),

  // 오늘의 추천 운동 (체크인 기반)
  getTodayRecommendations: gymPlusProtected.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return null;
    const today = new Date().toISOString().slice(0, 10);
    const [checkIn] = await db.select().from(gymPlusWorkoutLogs)
      .where(and(
        eq(gymPlusWorkoutLogs.gymPlusMemberId, ctx.gymPlusMemberId),
        eq(gymPlusWorkoutLogs.logDate, today),
        sql`${gymPlusWorkoutLogs.title} = '출석체크'`
      )).limit(1);
    if (!checkIn) return null;

    const bodyParts: string[] = checkIn.bodyPartsJson ? JSON.parse(checkIn.bodyPartsJson) : [];
    const themes: string[] = checkIn.workoutTheme ? JSON.parse(checkIn.workoutTheme) : [];
    const levelMap: Record<string, string> = { "높음": "advanced", "보통": "intermediate", "낮음": "beginner" };
    const level = checkIn.intensity ? levelMap[checkIn.intensity] : null;

    // 항상 3종목을 채운다. 단계마다 바로 중복을 걸러야 하며(마지막에 한꺼번에 걸러내면
    // 중복이 개수를 부풀려 실제로는 3개 미만이 나온다), 마지막 랜덤 보충은 이미 고른 영상을 제외한다.
    const TARGET = 3;
    const picked: any[] = [];
    const seen = new Set<number>();
    const add = (rows: any[]) => {
      for (const v of rows) {
        if (picked.length >= TARGET) return;
        if (seen.has(v.id)) continue;
        seen.add(v.id);
        picked.push(v);
      }
    };

    if (bodyParts.length > 0) {
      for (const part of bodyParts) {
        if (picked.length >= TARGET) break;
        add(await db.select().from(gymPlusVideos)
          .where(and(eq(gymPlusVideos.isPublished, 1), sql`${gymPlusVideos.bodyPart} ILIKE ${'%' + part + '%'}`))
          .orderBy(sql`RANDOM()`).limit(TARGET));
      }
    }
    if (picked.length < TARGET && themes.length > 0) {
      for (const theme of themes) {
        if (picked.length >= TARGET) break;
        const keyword = theme === "유산소 위주" ? "유산소" : theme === "스트레칭 위주" ? "스트레칭" : null;
        if (!keyword) continue;
        add(await db.select().from(gymPlusVideos)
          .where(and(eq(gymPlusVideos.isPublished, 1), sql`(${gymPlusVideos.bodyPart} ILIKE ${'%' + keyword + '%'} OR ${gymPlusVideos.title} ILIKE ${'%' + keyword + '%'})`))
          .orderBy(sql`RANDOM()`).limit(TARGET));
      }
    }
    if (picked.length < TARGET && level) {
      add(await db.select().from(gymPlusVideos)
        .where(and(eq(gymPlusVideos.isPublished, 1), eq(gymPlusVideos.level, level)))
        .orderBy(sql`RANDOM()`).limit(TARGET));
    }
    if (picked.length < TARGET) {
      const excluded = Array.from(seen);
      add(await db.select().from(gymPlusVideos)
        .where(excluded.length > 0
          ? and(eq(gymPlusVideos.isPublished, 1), sql`${gymPlusVideos.id} <> ALL(${excluded}::int[])`)
          : eq(gymPlusVideos.isPublished, 1))
        .orderBy(sql`RANDOM()`).limit(TARGET));
    }

    return { checkIn, recommendedVideos: picked };
  }),

  analyzeWorkoutPattern: gymPlusProtected.query(async ({ ctx }) => {
    const db = getDb();
    const memberId = ctx.gymPlusMemberId;

    // 최근 60일 운동 기록 가져오기
    const since = new Date();
    since.setDate(since.getDate() - 60);
    const sinceStr = since.toISOString().slice(0, 10);

    const logs = await db.select().from(gymPlusWorkoutLogs)
      .where(and(
        eq(gymPlusWorkoutLogs.gymPlusMemberId, memberId),
        sql`${gymPlusWorkoutLogs.logDate} >= ${sinceStr}`,
        sql`${gymPlusWorkoutLogs.title} NOT IN ('출석체크','준비운동','유산소운동')`,
      ))
      .orderBy(desc(gymPlusWorkoutLogs.logDate));

    if (logs.length === 0) {
      return { analysis: null, stats: null, isAI: false };
    }

    // 통계 계산
    const totalWorkouts = logs.length;
    const totalMinutes = logs.reduce((s, l) => s + (l.durationMinutes ?? 0), 0);
    const totalCalories = logs.reduce((s, l) => s + (l.caloriesBurned ?? 0), 0);

    const bodyPartCount: Record<string, number> = {};
    let totalVolume = 0;
    for (const log of logs) {
      try {
        const parts: string[] = log.bodyPartsJson ? JSON.parse(log.bodyPartsJson) : [];
        parts.forEach(p => { bodyPartCount[p] = (bodyPartCount[p] ?? 0) + 1; });
      } catch {}
      try {
        const exs: any[] = log.exercisesJson ? JSON.parse(log.exercisesJson) : [];
        for (const ex of exs) {
          if (Array.isArray(ex.sets)) {
            for (const s of ex.sets) {
              totalVolume += (parseFloat(s.reps) || 0) * (parseFloat(s.weight) || 0);
            }
          }
        }
      } catch {}
    }

    const topParts = Object.entries(bodyPartCount).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const allParts = ["전신", "상체", "하체", "등", "어깨", "가슴", "복부", "허리", "코어", "엉덩이", "대퇴 후면", "대퇴 전면", "하퇴", "이두", "삼두"];
    const missingParts = allParts.filter(p => !bodyPartCount[p]);

    const stats = {
      totalWorkouts,
      totalMinutes,
      totalCalories,
      totalVolume: Math.round(totalVolume),
      topParts,
      missingParts,
      avgMinutesPerWorkout: totalWorkouts > 0 ? Math.round(totalMinutes / totalWorkouts) : 0,
      avgCaloriesPerWorkout: totalWorkouts > 0 ? Math.round(totalCalories / totalWorkouts) : 0,
    };

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return { analysis: null, stats, isAI: false };
    }

    const dataContext = `
최근 60일 운동 데이터:
- 총 운동 횟수: ${totalWorkouts}회
- 총 운동 시간: ${totalMinutes}분 (평균 ${stats.avgMinutesPerWorkout}분/회)
- 총 소모 칼로리: ${totalCalories}kcal (평균 ${stats.avgCaloriesPerWorkout}kcal/회)
- 총 운동 볼륨: ${stats.totalVolume.toLocaleString()}kg
- 자주 훈련한 부위: ${topParts.map(([p, c]) => `${p}(${c}회)`).join(", ") || "없음"}
- 훈련하지 않은 부위: ${missingParts.join(", ") || "없음"}
`;

    try {
      const client = new Anthropic({ apiKey });
      const message = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 800,
        messages: [{
          role: "user",
          content: `당신은 개인 트레이닝 전문 AI 코치입니다. 아래 회원의 운동 데이터를 분석하여 한국어로 짧고 실용적인 피드백을 제공해주세요.

${dataContext}

다음 3가지 항목을 각각 2~3문장으로 분석해주세요:

1. **운동 패턴 요약**: 운동 빈도, 강도, 일관성에 대한 평가
2. **부위 불균형 분석**: 과도하게 훈련된 부위와 부족한 부위 지적
3. **이번 주 추천**: 구체적인 운동 부위와 방향 제안

친근하고 동기부여가 되는 톤으로 작성해주세요.`,
        }],
      });
      const text = message.content[0].type === "text" ? message.content[0].text : "";
      return { analysis: text, stats, isAI: true };
    } catch {
      return { analysis: null, stats, isAI: false };
    }
  }),

  updateWorkoutLog: gymPlusProtected
    .input(z.object({
      id: z.number(),
      logDate: z.string().optional(),
      title: z.string().optional(),
      exercisesJson: z.string().optional(),
      bodyPartsJson: z.string().optional(),
      conditionScore: z.number().optional(),
      sleepHours: z.string().optional(),
      energyLevel: z.string().optional(),
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

  getHealth: gymPlusProtected.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const [row] = await db.select().from(gymPlusMemberHealth)
      .where(eq(gymPlusMemberHealth.gymPlusMemberId, ctx.gymPlusMemberId)).limit(1);
    return row ?? null;
  }),

  upsertHealth: gymPlusProtected
    .input(z.object({
      height: z.string().optional(),
      weight: z.string().optional(),
      birthYear: z.string().optional(),
      gender: z.string().optional(),
      parq1: z.string().optional(),
      parq2: z.string().optional(),
      parq3: z.string().optional(),
      parq4: z.string().optional(),
      parq5: z.string().optional(),
      parq6: z.string().optional(),
      parq7: z.string().optional(),
      parqSubmittedAt: z.string().optional(),
      bodyAnalysisRequested: z.number().optional(),
      bodyAnalysisRequestedAt: z.string().optional(),
      gymRulesAgreed: z.number().optional(),
      appGuideConfirmed: z.number().optional(),
      parqJson: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const existing = await db.select({ id: gymPlusMemberHealth.id })
        .from(gymPlusMemberHealth)
        .where(eq(gymPlusMemberHealth.gymPlusMemberId, ctx.gymPlusMemberId)).limit(1);
      if (existing[0]) {
        await db.update(gymPlusMemberHealth)
          .set({ ...input, updatedAt: new Date().toISOString() })
          .where(eq(gymPlusMemberHealth.gymPlusMemberId, ctx.gymPlusMemberId));
      } else {
        await db.insert(gymPlusMemberHealth)
          .values({ gymPlusMemberId: ctx.gymPlusMemberId, ...input });
      }
      return { success: true };
    }),

  requestRenewal: gymPlusProtected
    .input(z.object({
      requestedPeriod: z.string(),
      bonusDays: z.number().default(0),
      memberName: z.string().optional(),
      memberPhone: z.string().optional(),
      notes: z.string().optional(),
      agreedToTerms: z.number().default(0),
      agreedPrivacy: z.number().default(0),
      agreedMarketing: z.number().default(0),
      trainerName: z.string().optional(),
      contractDate: z.string().optional(),
      signatureData: z.string().optional(),
      // 통합운영 연동: 승인 시 관리자가 다시 입력하지 않도록 앱 입력값 전달 (모두 선택값)
      requestedAmount: z.number().optional(),
      requestedMonths: z.number().optional(),
      paymentMethod: z.string().optional(),
      membershipType: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // 현재 회원 정보 조회
      const [gymMember] = await db
        .select({ membershipEnd: gymPlusMembers.membershipEnd })
        .from(gymPlusMembers).where(eq(gymPlusMembers.id, ctx.gymPlusMemberId)).limit(1);

      // 신청 기록만 저장 (status=pending, 날짜 변경 없음 — 관리자 승인 후 반영)
      await db.insert(gymPlusMembershipRenewals).values({
        gymPlusMemberId: ctx.gymPlusMemberId,
        currentMembershipEnd: gymMember?.membershipEnd ?? null,
        ...input,
        status: "pending",
      });

      const renewalContact = await gymPlusMemberContact(ctx.gymPlusMemberId);
      sendRequestNotification({
        kind: "재등록",
        memberName: input.memberName || renewalContact.name,
        memberPhone: input.memberPhone || renewalContact.phone,
        rows: [
          { label: "재등록 기간", value: input.requestedPeriod },
          ...(input.requestedAmount != null
            ? [{ label: "결제 금액", value: `${input.requestedAmount.toLocaleString("ko-KR")}원`, highlight: true }]
            : []),
          ...(input.paymentMethod ? [{ label: "결제 방법", value: input.paymentMethod }] : []),
          { label: "현재 만료일", value: gymMember?.membershipEnd ?? "-" },
          ...(input.bonusDays ? [{ label: "보너스", value: `+${input.bonusDays}일` }] : []),
        ],
        actionHint: "결제를 확인한 후 관리자 페이지에서 승인하면 회원권 만료일이 자동 연장됩니다.",
      }).catch(() => {});

      return { success: true };
    }),

  listMyRenewals: gymPlusProtected.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    return db.select().from(gymPlusMembershipRenewals)
      .where(eq(gymPlusMembershipRenewals.gymPlusMemberId, ctx.gymPlusMemberId))
      .orderBy(desc(gymPlusMembershipRenewals.createdAt));
  }),

  // 관리자: 재등록 신청 목록 조회
  adminListRenewals: protectedProcedure
    .input(z.object({ status: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      if (ctx.user?.role !== "admin" && ctx.user?.role !== "sub_admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const rows = await db
        .select({
          id: gymPlusMembershipRenewals.id,
          gymPlusMemberId: gymPlusMembershipRenewals.gymPlusMemberId,
          memberName: gymPlusMembershipRenewals.memberName,
          memberPhone: gymPlusMembershipRenewals.memberPhone,
          requestedPeriod: gymPlusMembershipRenewals.requestedPeriod,
          bonusDays: gymPlusMembershipRenewals.bonusDays,
          currentMembershipEnd: gymPlusMembershipRenewals.currentMembershipEnd,
          notes: gymPlusMembershipRenewals.notes,
          requestedAmount: gymPlusMembershipRenewals.requestedAmount,
          requestedMonths: gymPlusMembershipRenewals.requestedMonths,
          paymentMethod: gymPlusMembershipRenewals.paymentMethod,
          membershipType: gymPlusMembershipRenewals.membershipType,
          agreedMarketing: gymPlusMembershipRenewals.agreedMarketing,
          contractDate: gymPlusMembershipRenewals.contractDate,
          signatureData: gymPlusMembershipRenewals.signatureData,
          status: gymPlusMembershipRenewals.status,
          createdAt: gymPlusMembershipRenewals.createdAt,
        })
        .from(gymPlusMembershipRenewals)
        .where(input.status ? eq(gymPlusMembershipRenewals.status, input.status) : undefined)
        .orderBy(desc(gymPlusMembershipRenewals.createdAt));
      return rows;
    }),

  // 관리자: 재등록 신청 승인/거절
  adminApproveRenewal: protectedProcedure
    .input(z.object({
      renewalId: z.number(),
      action: z.enum(["approved", "rejected"]),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user?.role !== "admin" && ctx.user?.role !== "sub_admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [renewal] = await db.select().from(gymPlusMembershipRenewals)
        .where(eq(gymPlusMembershipRenewals.id, input.renewalId)).limit(1);
      if (!renewal) throw new TRPCError({ code: "NOT_FOUND", message: "신청 내역을 찾을 수 없습니다." });
      if (renewal.status !== "pending") throw new TRPCError({ code: "BAD_REQUEST", message: "이미 처리된 신청입니다." });

      // 상태 업데이트
      await db.update(gymPlusMembershipRenewals)
        .set({ status: input.action })
        .where(eq(gymPlusMembershipRenewals.id, input.renewalId));

      if (input.action === "approved") {
        const periodMonths: Record<string, number> = { "1개월": 1, "3개월": 3, "6개월": 6, "12개월": 12 };
        const addMonths = periodMonths[renewal.requestedPeriod] ?? 1;
        const [gymMember] = await db.select({ membershipEnd: gymPlusMembers.membershipEnd, memberId: gymPlusMembers.memberId, phone: gymPlusMembers.phone, username: gymPlusMembers.username })
          .from(gymPlusMembers).where(eq(gymPlusMembers.id, renewal.gymPlusMemberId)).limit(1);

        // 만료일의 원본은 통합관리 members 테이블이다. 짐+ 복사본은 오래된 값일 수
        // 있으므로 원본 만료일을 조회해 연장 기준으로 삼는다 (memberId 우선, 없으면 전화번호).
        const phone = gymMember?.phone || gymMember?.username;
        let mainMember: { id: number; membershipEnd: string | null } | undefined;
        if (gymMember?.memberId) {
          [mainMember] = await db.select({ id: members.id, membershipEnd: members.membershipEnd })
            .from(members).where(eq(members.id, gymMember.memberId)).limit(1);
        } else if (phone) {
          const digits = phone.replace(/\D/g, "");
          if (digits.length >= 4) {
            [mainMember] = await db.select({ id: members.id, membershipEnd: members.membershipEnd })
              .from(members)
              .where(sql`REGEXP_REPLACE(COALESCE(${members.phone},''), '[^0-9]', '', 'g') = ${digits}`)
              .limit(1);
          }
        }

        // 연장 기준일: 원본 만료일과 짐+ 복사본 중 더 늦은 유효일, 둘 다 과거면 오늘.
        // toISOString의 UTC 변환으로 날짜가 하루 밀리지 않도록 연/월/일을 직접 계산한다.
        const candidates = [mainMember?.membershipEnd, gymMember?.membershipEnd]
          .filter((d): d is string => !!d)
          .map((d) => new Date(`${d.slice(0, 10)}T00:00:00Z`))
          .filter((d) => !isNaN(d.getTime()));
        const todayUtc = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00Z");
        const baseMs = Math.max(todayUtc.getTime(), ...candidates.map((d) => d.getTime()));
        const base = new Date(baseMs);
        // 월 단위 가산 시 말일 오버플로우(예: 1/31 + 1개월 → 3/3) 방지
        const targetMonthDay = base.getUTCDate();
        base.setUTCMonth(base.getUTCMonth() + addMonths);
        if (base.getUTCDate() < targetMonthDay) base.setUTCDate(0); // 넘친 만큼 해당 월 말일로 보정
        base.setUTCDate(base.getUTCDate() + (renewal.bonusDays ?? 0));
        const newEnd = base.toISOString().slice(0, 10);

        // gymPlusMembers 복사본 및 원본 members 동시 갱신
        await db.update(gymPlusMembers)
          .set({ membershipEnd: newEnd, updatedAt: new Date().toISOString() })
          .where(eq(gymPlusMembers.id, renewal.gymPlusMemberId));

        if (mainMember) {
          await db.update(members)
            .set({ membershipEnd: newEnd, updatedAt: new Date().toISOString() })
            .where(eq(members.id, mainMember.id));
        }

        return { success: true, newMembershipEnd: newEnd };
      }

      return { success: true };
    }),

  generateDietPlan: gymPlusProtected
    .input(z.object({
      activityLevel: z.string(),
      targetCalories: z.number(),
      includeFoods: z.string().default(""),
      excludeFoods: z.string().default(""),
      planDate: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Load food DB from database
      const ALL_FOODS = await db.select().from(gymPlusDietFoods);
      // Fallback to a minimal set if DB is empty (before seed)
      const DIET_FOODS = ALL_FOODS.length > 0 ? ALL_FOODS : [
        // 아침
        { category: "아침", name: "닭가슴살 + 계란", amount: "닭가슴살 100g + 계란 1개", calories: 220, carbs: 2, protein: 38, fat: 7 },
        { category: "아침", name: "닭가슴살 샐러드", amount: "닭가슴살 100g + 야채 80g", calories: 250, carbs: 10, protein: 30, fat: 10 },
        { category: "아침", name: "연어 샐러드", amount: "연어 120g + 야채 80g", calories: 320, carbs: 8, protein: 28, fat: 18 },
        { category: "아침", name: "그릭요거트 + 견과류", amount: "요거트 120g + 견과 20g", calories: 280, carbs: 20, protein: 18, fat: 14 },
        { category: "아침", name: "그릭요거트 + 베리믹스", amount: "요거트 120g + 베리 60g", calories: 230, carbs: 25, protein: 15, fat: 5 },
        { category: "아침", name: "삶은 계란 2개", amount: "계란 2개", calories: 140, carbs: 2, protein: 12, fat: 10 },
        { category: "아침", name: "스크램블 에그 + 토마토", amount: "계란 2개 + 토마토 80g", calories: 200, carbs: 6, protein: 14, fat: 12 },
        { category: "아침", name: "에그마요 토스트 라이트", amount: "식빵 1개 + 에그마요 40g", calories: 270, carbs: 28, protein: 14, fat: 10 },
        { category: "아침", name: "두부 샐러드", amount: "두부 120g + 야채 80g", calories: 210, carbs: 10, protein: 18, fat: 10 },
        { category: "아침", name: "스모크 닭가슴살 + 야채", amount: "닭가슴살 100g + 야채 70g", calories: 180, carbs: 5, protein: 28, fat: 4 },
        { category: "아침", name: "프로틴 쉐이크 + 아몬드", amount: "쉐이크 300ml + 아몬드 10g", calories: 290, carbs: 18, protein: 25, fat: 12 },
        { category: "아침", name: "견과류 + 플레인 요거트", amount: "요거트 120g + 견과 20g", calories: 270, carbs: 17, protein: 13, fat: 15 },
        { category: "아침", name: "참치샐러드 라이트", amount: "참치 70g + 야채 100g", calories: 210, carbs: 8, protein: 25, fat: 7 },
        { category: "아침", name: "계란국 + 밥", amount: "국 200ml + 밥 100g", calories: 250, carbs: 34, protein: 12, fat: 6 },
        { category: "아침", name: "두유 + 닭가슴살", amount: "두유 200ml + 닭가슴살 80g", calories: 250, carbs: 15, protein: 30, fat: 5 },
        { category: "아침", name: "코티지치즈 + 블루베리", amount: "치즈 100g + 블루베리 50g", calories: 190, carbs: 20, protein: 14, fat: 5 },
        { category: "아침", name: "에그 프리타타", amount: "프리타타 180g", calories: 240, carbs: 8, protein: 18, fat: 14 },
        // 점심
        { category: "점심", name: "단백질 파스타 + 닭가슴살", amount: "두부면 150g + 닭가슴살 100g", calories: 410, carbs: 28, protein: 40, fat: 7 },
        { category: "점심", name: "현미밥 + 닭가슴살구이", amount: "현미밥 150g + 닭가슴살 120g", calories: 430, carbs: 45, protein: 42, fat: 5 },
        { category: "점심", name: "대구 + 고구마", amount: "대구 120g + 고구마 150g", calories: 400, carbs: 40, protein: 36, fat: 5 },
        { category: "점심", name: "두부면 + 닭가슴살", amount: "두부면 150g + 닭가슴살 120g", calories: 380, carbs: 18, protein: 40, fat: 7 },
        { category: "점심", name: "닭다리살 에어프라이 + 현미밥", amount: "닭다리살 130g + 현미밥 150g", calories: 510, carbs: 48, protein: 42, fat: 12 },
        { category: "점심", name: "참치스테이크 + 현미밥", amount: "참치스테이크 130g + 현미밥 150g", calories: 480, carbs: 52, protein: 40, fat: 8 },
        { category: "점심", name: "연어구이 + 샐러드", amount: "연어 150g + 야채 100g", calories: 420, carbs: 10, protein: 38, fat: 22 },
        { category: "점심", name: "닭안심 도시락", amount: "닭안심 150g + 잡곡밥 150g", calories: 450, carbs: 50, protein: 40, fat: 6 },
        { category: "점심", name: "고등어조림 + 현미밥", amount: "고등어 100g + 현미밥 150g", calories: 470, carbs: 48, protein: 32, fat: 14 },
        { category: "점심", name: "새우볶음 + 현미밥", amount: "새우 150g + 현미밥 150g", calories: 420, carbs: 46, protein: 36, fat: 5 },
        { category: "점심", name: "콩나물국밥 라이트", amount: "국밥 1그릇 (절반)", calories: 390, carbs: 55, protein: 20, fat: 6 },
        { category: "점심", name: "닭가슴살 + 현미밥", amount: "닭가슴살 130g + 현미밥 150g", calories: 440, carbs: 47, protein: 44, fat: 5 },
        // 저녁
        { category: "저녁", name: "토마토 + 계란 2개", amount: "토마토 1개 + 계란 2개", calories: 180, carbs: 8, protein: 14, fat: 10 },
        { category: "저녁", name: "단백질쉐이크 + 고구마", amount: "쉐이크 300ml + 고구마 100g", calories: 310, carbs: 35, protein: 25, fat: 5 },
        { category: "저녁", name: "두부면 야채볶음", amount: "두부면 200g + 야채 100g", calories: 280, carbs: 15, protein: 22, fat: 8 },
        { category: "저녁", name: "닭안심찜 + 샐러드", amount: "닭안심 150g + 야채 100g", calories: 260, carbs: 8, protein: 40, fat: 5 },
        { category: "저녁", name: "달걀국 + 계란", amount: "달걀국 300ml + 계란 2개", calories: 200, carbs: 5, protein: 18, fat: 12 },
        { category: "저녁", name: "칠면조가슴살 + 샐러드", amount: "칠면조 130g + 야채 100g", calories: 240, carbs: 8, protein: 38, fat: 5 },
        { category: "저녁", name: "요거트 + 견과류", amount: "요거트 200g + 견과 15g", calories: 250, carbs: 20, protein: 15, fat: 12 },
        { category: "저녁", name: "두부구이 + 야채", amount: "두부 150g + 야채 100g", calories: 220, carbs: 10, protein: 20, fat: 10 },
        { category: "저녁", name: "연어포케", amount: "연어 100g + 야채 100g", calories: 330, carbs: 14, protein: 28, fat: 18 },
        { category: "저녁", name: "닭가슴살 야채볶음", amount: "닭가슴살 120g + 야채 120g", calories: 260, carbs: 12, protein: 36, fat: 6 },
        { category: "저녁", name: "고등어구이 + 야채", amount: "고등어 100g + 야채 80g", calories: 290, carbs: 5, protein: 25, fat: 18 },
        { category: "저녁", name: "닭다리살 + 샐러드", amount: "닭다리살 저지방 120g + 야채 100g", calories: 300, carbs: 8, protein: 40, fat: 10 },
        // 간식
        { category: "건강 간식", name: "바나나 1개", amount: "바나나 120g", calories: 110, carbs: 28, protein: 1, fat: 0 },
        { category: "건강 간식", name: "사과 1개", amount: "사과 200g", calories: 100, carbs: 26, protein: 1, fat: 0 },
        { category: "건강 간식", name: "아몬드 한줌", amount: "아몬드 25g", calories: 150, carbs: 5, protein: 5, fat: 13 },
        { category: "건강 간식", name: "프로틴바", amount: "프로틴바 1개", calories: 200, carbs: 20, protein: 20, fat: 5 },
        { category: "건강 간식", name: "그릭요거트", amount: "그릭요거트 150g", calories: 130, carbs: 8, protein: 18, fat: 3 },
        { category: "건강 간식", name: "삶은 계란 1개", amount: "계란 1개", calories: 70, carbs: 1, protein: 6, fat: 5 },
        { category: "건강 간식", name: "고구마 1개", amount: "고구마 150g", calories: 140, carbs: 32, protein: 2, fat: 0 },
        { category: "건강 간식", name: "견과류 믹스", amount: "견과류 20g", calories: 120, carbs: 5, protein: 3, fat: 10 },
        { category: "건강 간식", name: "두유 1팩", amount: "두유 200ml", calories: 100, carbs: 10, protein: 7, fat: 3 },
        { category: "건강 간식", name: "방울토마토", amount: "방울토마토 200g", calories: 60, carbs: 13, protein: 2, fat: 0 },
        { category: "건강 간식", name: "오이 + 허무스", amount: "오이 100g + 허무스 30g", calories: 120, carbs: 10, protein: 5, fat: 6 },
        { category: "건강 간식", name: "단호박찜", amount: "단호박 150g", calories: 120, carbs: 28, protein: 2, fat: 0 },
      ];

      const includeList = input.includeFoods.split(",").map((s: string) => s.trim()).filter(Boolean);
      const excludeList = input.excludeFoods.split(",").map((s: string) => s.trim()).filter(Boolean);
      const parts = input.planDate.split("-");
      const daySeed = (parseInt(parts[2] ?? "1") * 3 + parseInt(parts[1] ?? "1") * 7 + parseInt(parts[0] ?? "1")) % 47;

      function pickMeals(category: string, budgetRatio: number, offset: number, seed: number) {
        const target = input.targetCalories * budgetRatio;
        let pool = DIET_FOODS.filter(f =>
          f.category === category &&
          !excludeList.some((ex: string) => f.name.includes(ex))
        );
        if (pool.length === 0) pool = DIET_FOODS.filter(f => f.category === category);
        const preferred = includeList.length > 0
          ? pool.filter(f => includeList.some((inc: string) => f.name.includes(inc) || f.amount.includes(inc)))
          : [];
        const source = preferred.length > 0 ? preferred : pool;

        const picked: typeof source = [];
        let remaining = target;
        const used = new Set<string>();
        let pickIdx = 0;

        while (remaining > 30 && picked.length < 4) {
          const available = source.filter(f => !used.has(f.name));
          if (available.length === 0) break;
          const sorted = [...available].sort((a, b) => Math.abs(a.calories - remaining) - Math.abs(b.calories - remaining));
          const topN = Math.min(3, sorted.length);
          const idx = (seed * 7 + offset * 13 + pickIdx * 11) % topN;
          const pick = sorted[idx];
          picked.push(pick);
          used.add(pick.name);
          remaining -= pick.calories;
          pickIdx++;
          if (remaining < target * 0.1) break;
        }

        return picked.length > 0 ? picked : [source[(seed + offset) % source.length]];
      }

      const todayMeals = {
        breakfast: pickMeals("아침", 0.30, 0, daySeed),
        lunch: pickMeals("점심", 0.35, 1, daySeed),
        dinner: pickMeals("저녁", 0.25, 2, daySeed),
        snack: pickMeals("건강 간식", 0.10, 3, daySeed),
      };
      const tomorrowSeed = (daySeed + 11) % 47;
      const tomorrowMeals = {
        breakfast: pickMeals("아침", 0.30, 0, tomorrowSeed),
        lunch: pickMeals("점심", 0.35, 1, tomorrowSeed),
        dinner: pickMeals("저녁", 0.25, 2, tomorrowSeed),
        snack: pickMeals("건강 간식", 0.10, 3, tomorrowSeed),
      };

      // Replace existing plan for today
      await db.delete(gymPlusDailyDiets).where(
        and(
          eq(gymPlusDailyDiets.gymPlusMemberId, ctx.gymPlusMemberId),
          eq(gymPlusDailyDiets.planDate, input.planDate)
        )
      );
      await db.insert(gymPlusDailyDiets).values({
        gymPlusMemberId: ctx.gymPlusMemberId,
        planDate: input.planDate,
        activityLevel: input.activityLevel,
        targetCalories: input.targetCalories,
        includeFoods: input.includeFoods,
        excludeFoods: input.excludeFoods,
        todayMeals: JSON.stringify(todayMeals),
        tomorrowMeals: JSON.stringify(tomorrowMeals),
        completedMeals: "{}",
      });
      return { todayMeals, tomorrowMeals };
    }),

  getTodayDietPlan: gymPlusProtected
    .input(z.object({ planDate: z.string() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [plan] = await db.select().from(gymPlusDailyDiets)
        .where(and(
          eq(gymPlusDailyDiets.gymPlusMemberId, ctx.gymPlusMemberId),
          eq(gymPlusDailyDiets.planDate, input.planDate)
        )).limit(1);
      if (!plan) return null;
      return {
        ...plan,
        todayMeals: JSON.parse(plan.todayMeals) as any,
        tomorrowMeals: JSON.parse(plan.tomorrowMeals) as any,
        completedMeals: JSON.parse(plan.completedMeals) as Record<string, boolean>,
      };
    }),

  toggleDietCompletion: gymPlusProtected
    .input(z.object({
      planDate: z.string(),
      mealKey: z.string(),
      completed: z.boolean(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [plan] = await db.select({ id: gymPlusDailyDiets.id, completedMeals: gymPlusDailyDiets.completedMeals })
        .from(gymPlusDailyDiets)
        .where(and(
          eq(gymPlusDailyDiets.gymPlusMemberId, ctx.gymPlusMemberId),
          eq(gymPlusDailyDiets.planDate, input.planDate)
        )).limit(1);
      if (!plan) throw new TRPCError({ code: "NOT_FOUND" });
      const completed = JSON.parse(plan.completedMeals) as Record<string, boolean>;
      completed[input.mealKey] = input.completed;
      await db.update(gymPlusDailyDiets)
        .set({ completedMeals: JSON.stringify(completed), updatedAt: new Date().toISOString() })
        .where(eq(gymPlusDailyDiets.id, plan.id));
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

  // members 테이블 전체를 gym_plus_members로 동기화 (전화번호 기준, 중복 스킵)
  // 동기화 대상 목록 조회 (members 테이블 전체 + 짐+ 계정 여부)
  admin_listMembersForSync: adminOnlyGymPlus.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const allMembers = await db.select({
      id: members.id, name: members.name, phone: members.phone,
      email: members.email, membershipEnd: members.membershipEnd, status: members.status,
    }).from(members).orderBy(members.name);
    const gymPlusList = await db.select({ username: gymPlusMembers.username }).from(gymPlusMembers);
    const existingUsernames = new Set(gymPlusList.map(g => g.username));
    return allMembers.map(m => ({
      ...m,
      alreadySynced: m.phone ? existingUsernames.has(m.phone.replace(/\D/g, "")) : false,
    }));
  }),

  // 선택한 회원 IDs만 동기화
  admin_syncSelectedMembers: adminOnlyGymPlus
    .input(z.object({ memberIds: z.array(z.number()) }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const selected = await db.select({
        id: members.id, name: members.name, phone: members.phone,
        email: members.email, membershipEnd: members.membershipEnd,
      }).from(members);
      const targets = selected.filter(m => input.memberIds.includes(m.id));

      let created = 0, skipped = 0;
      for (const m of targets) {
        if (!m.phone) { skipped++; continue; }
        const digits = m.phone.replace(/\D/g, "");
        if (digits.length < 4) { skipped++; continue; }
        const username = digits;
        const existing = await db.select({ id: gymPlusMembers.id })
          .from(gymPlusMembers).where(eq(gymPlusMembers.username, username)).limit(1);
        if (existing[0]) { skipped++; continue; }
        const last4 = digits.slice(-4);
        const hashed = await bcrypt.hash(last4, 10);
        await db.insert(gymPlusMembers).values({
          username, password: hashed, name: m.name, phone: m.phone,
          email: m.email ?? undefined, memberId: m.id,
          membershipEnd: m.membershipEnd ?? undefined, membershipType: "general", isActive: 1,
        });
        created++;
      }
      return { created, skipped };
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
      recommendedSets: z.number().optional(),
      recommendedReps: z.string().optional(),
      restSeconds: z.number().optional(),
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
      recommendedSets: z.number().optional(),
      recommendedReps: z.string().optional(),
      restSeconds: z.number().optional(),
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
      linkUrl: z.string().optional(),
      eventType: z.enum(["notice", "event", "promotion", "points", "schedule"]).default("notice"),
      pointAmount: z.number().int().min(0).default(0),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      isPublished: z.number().default(1),
      isPinned: z.number().default(0),
      sendPush: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { sendPush, ...eventData } = input;
      const [row] = await db.insert(gymPlusEvents).values(eventData).returning();

      // 푸시 발송
      if (sendPush && input.isPublished) {
        try {
          const subs = await pool.query(`SELECT endpoint, p256dh, auth FROM push_subscriptions`);
          const payload = JSON.stringify({
            title: `ZIANTGYM+ ${input.eventType === "notice" ? "공지" : input.eventType === "schedule" ? "스케줄" : "이벤트"}`,
            body: input.title,
            url: `/gym-plus/events/${row.id}`,
          });
          const results = await Promise.allSettled(
            subs.rows.map((s: any) =>
              webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload)
            )
          );
          // 만료된 구독 삭제
          const expired = subs.rows.filter((_: any, i: number) => {
            const r = results[i];
            return r.status === "rejected" && (r.reason as any)?.statusCode === 410;
          });
          if (expired.length) {
            await Promise.allSettled(expired.map((s: any) =>
              pool.query(`DELETE FROM push_subscriptions WHERE endpoint = $1`, [s.endpoint])
            ));
          }
        } catch (e) {
          console.error("push send error:", e);
        }
      }

      return row;
    }),

  admin_updateEvent: adminOnlyGymPlus
    .input(z.object({
      id: z.number(),
      title: z.string().optional(),
      content: z.string().optional(),
      imageUrl: z.string().optional(),
      linkUrl: z.string().optional(),
      eventType: z.enum(["notice", "event", "promotion", "points", "schedule"]).optional(),
      pointAmount: z.number().int().min(0).optional(),
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

  // ─── 포인트 적립 신청 ──────────────────────────────────────────────────────

  claimEventPoints: gymPlusProtected
    .input(z.object({ eventId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [event] = await db.select().from(gymPlusEvents)
        .where(eq(gymPlusEvents.id, input.eventId)).limit(1);
      if (!event || event.eventType !== "points")
        throw new TRPCError({ code: "BAD_REQUEST", message: "포인트 이벤트가 아닙니다." });

      // 중복 신청 방지 (pending 또는 approved 상태)
      const existing = await db.select().from(gymPlusPointClaims)
        .where(and(
          eq(gymPlusPointClaims.gymPlusMemberId, ctx.gymPlusMemberId),
          eq(gymPlusPointClaims.eventId, input.eventId),
        )).limit(1);
      if (existing[0] && existing[0].status !== "rejected")
        throw new TRPCError({ code: "BAD_REQUEST", message: "이미 신청한 이벤트입니다." });

      await db.insert(gymPlusPointClaims).values({
        gymPlusMemberId: ctx.gymPlusMemberId,
        eventId: input.eventId,
        eventTitle: event.title,
        pointAmount: event.pointAmount ?? 0,
        status: "pending",
      });

      // 이메일 알림 (실패해도 신청은 성공 처리)
      const [member] = await db.select({ name: gymPlusMembers.name, phone: gymPlusMembers.phone })
        .from(gymPlusMembers).where(eq(gymPlusMembers.id, ctx.gymPlusMemberId)).limit(1);
      sendPointClaimNotification({
        memberName: member?.name ?? "-",
        memberPhone: member?.phone ?? "-",
        eventTitle: event.title,
        pointAmount: event.pointAmount ?? 0,
        claimedAt: new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" }),
      }).catch(() => {});

      return { success: true };
    }),

  getMyPointClaims: gymPlusProtected.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(gymPlusPointClaims)
      .where(eq(gymPlusPointClaims.gymPlusMemberId, ctx.gymPlusMemberId))
      .orderBy(desc(gymPlusPointClaims.createdAt));
  }),

  admin_listPointClaims: adminOnlyGymPlus.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    return db.select({
      id: gymPlusPointClaims.id,
      gymPlusMemberId: gymPlusPointClaims.gymPlusMemberId,
      eventId: gymPlusPointClaims.eventId,
      eventTitle: gymPlusPointClaims.eventTitle,
      pointAmount: gymPlusPointClaims.pointAmount,
      status: gymPlusPointClaims.status,
      createdAt: gymPlusPointClaims.createdAt,
      memberName: gymPlusMembers.name,
      memberPhone: gymPlusMembers.phone,
    }).from(gymPlusPointClaims)
      .leftJoin(gymPlusMembers, eq(gymPlusPointClaims.gymPlusMemberId, gymPlusMembers.id))
      .orderBy(desc(gymPlusPointClaims.createdAt));
  }),

  admin_resolvePointClaim: adminOnlyGymPlus
    .input(z.object({ id: z.number(), approve: z.boolean() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [claim] = await db.select().from(gymPlusPointClaims)
        .where(eq(gymPlusPointClaims.id, input.id)).limit(1);
      if (!claim) throw new TRPCError({ code: "NOT_FOUND" });
      if (claim.status !== "pending")
        throw new TRPCError({ code: "BAD_REQUEST", message: "이미 처리된 신청입니다." });

      const newStatus = input.approve ? "approved" : "rejected";
      await db.update(gymPlusPointClaims).set({ status: newStatus })
        .where(eq(gymPlusPointClaims.id, input.id));

      if (input.approve && claim.pointAmount > 0) {
        const [member] = await db.select({ points: gymPlusMembers.points })
          .from(gymPlusMembers).where(eq(gymPlusMembers.id, claim.gymPlusMemberId)).limit(1);
        const newBalance = (member?.points ?? 0) + claim.pointAmount;
        await db.update(gymPlusMembers).set({ points: newBalance })
          .where(eq(gymPlusMembers.id, claim.gymPlusMemberId));
        await db.insert(gymPlusPointLogs).values({
          gymPlusMemberId: claim.gymPlusMemberId,
          type: "charge",
          amount: claim.pointAmount,
          balanceAfter: newBalance,
          reason: `이벤트 적립: ${claim.eventTitle}`,
          relatedId: claim.id,
        });
      }
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
        exercisesJson: gymPlusWorkoutLogs.exercisesJson,
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

  // 운동기록 상세 조회 (exercisesJson 포함)
  admin_getWorkoutLog: adminOnlyGymPlus
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [row] = await db.select().from(gymPlusWorkoutLogs)
        .where(eq(gymPlusWorkoutLogs.id, input.id)).limit(1);
      if (!row) throw new TRPCError({ code: "NOT_FOUND" });
      return row;
    }),

  // 운동기록 수정 (어드민)
  admin_updateWorkoutLog: adminOnlyGymPlus
    .input(z.object({
      id: z.number(),
      title: z.string().optional(),
      exercisesJson: z.string().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { id, ...data } = input;
      await db.update(gymPlusWorkoutLogs).set(data)
        .where(eq(gymPlusWorkoutLogs.id, id));
      return { success: true };
    }),

  // ─── 상품 관리 ────────────────────────────────────────────────────────────────

  listProducts: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(gymPlusProducts)
      .where(eq(gymPlusProducts.isActive, 1))
      .orderBy(gymPlusProducts.sortOrder, gymPlusProducts.id);
  }),

  admin_listProducts: adminOnlyGymPlus.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    return db.select().from(gymPlusProducts).orderBy(gymPlusProducts.sortOrder, gymPlusProducts.id);
  }),

  admin_createProduct: adminOnlyGymPlus
    .input(z.object({
      name: z.string().min(1),
      description: z.string().optional(),
      price: z.number().int().min(0),
      originalPrice: z.number().int().min(0).optional(),
      pointPrice: z.number().int().min(0).optional(),
      category: z.string().default("membership"),
      imageUrl: z.string().optional(),
      badgeText: z.string().optional(),
      isActive: z.number().int().default(1),
      sortOrder: z.number().int().default(0),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [row] = await db.insert(gymPlusProducts).values(input).returning();
      return row;
    }),

  admin_updateProduct: adminOnlyGymPlus
    .input(z.object({
      id: z.number(),
      name: z.string().optional(),
      description: z.string().optional(),
      price: z.number().int().min(0).optional(),
      originalPrice: z.number().int().min(0).optional(),
      pointPrice: z.number().int().min(0).nullable().optional(),
      category: z.string().optional(),
      imageUrl: z.string().optional(),
      badgeText: z.string().optional(),
      isActive: z.number().int().optional(),
      sortOrder: z.number().int().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { id, ...data } = input;
      await db.update(gymPlusProducts).set(data).where(eq(gymPlusProducts.id, id));
      return { success: true };
    }),

  admin_deleteProduct: adminOnlyGymPlus
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.delete(gymPlusProducts).where(eq(gymPlusProducts.id, input.id));
      return { success: true };
    }),

  // ─── 포인트 ────────────────────────────────────────────────────────────────

  getPointLogs: gymPlusProtected.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(gymPlusPointLogs)
      .where(eq(gymPlusPointLogs.gymPlusMemberId, ctx.gymPlusMemberId))
      .orderBy(desc(gymPlusPointLogs.createdAt))
      .limit(50);
  }),

  getPointTransactions: gymPlusProtected.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];
    const [gm] = await db.select({ memberId: gymPlusMembers.memberId })
      .from(gymPlusMembers).where(eq(gymPlusMembers.id, ctx.gymPlusMemberId)).limit(1);

    const res = await pool.query(
      `(SELECT id, type, amount, reason AS description, "createdAt"
        FROM gym_plus_point_logs WHERE "gymPlusMemberId" = $1)
       UNION ALL
       (SELECT id + 1000000, type, amount, description, "createdAt"
        FROM point_transactions WHERE "memberId" = $2)
       ORDER BY "createdAt" DESC LIMIT 50`,
      [ctx.gymPlusMemberId, gm?.memberId ?? -1]
    );
    return (res.rows as { id: number; type: string; amount: number; description: string | null; createdAt: string }[])
      .map(r => ({
        ...r,
        type: r.type === "charge" || r.type === "earn" || r.type === "refund" ? "earn" : "use",
        amount: Math.abs(r.amount),
      }));
  }),

  admin_chargePoints: adminOnlyGymPlus
    .input(z.object({
      gymPlusMemberId: z.number(),
      amount: z.number().int(),
      reason: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [member] = await db.select({ points: gymPlusMembers.points })
        .from(gymPlusMembers).where(eq(gymPlusMembers.id, input.gymPlusMemberId)).limit(1);
      if (!member) throw new TRPCError({ code: "NOT_FOUND" });
      const newBalance = (member.points ?? 0) + input.amount;
      await db.update(gymPlusMembers).set({ points: newBalance })
        .where(eq(gymPlusMembers.id, input.gymPlusMemberId));
      await db.insert(gymPlusPointLogs).values({
        gymPlusMemberId: input.gymPlusMemberId,
        type: input.amount >= 0 ? "charge" : "spend",
        amount: input.amount,
        balanceAfter: newBalance,
        reason: input.reason,
      });
      return { balance: newBalance };
    }),

  // ─── 포인트 충전 신청 ────────────────────────────────────────────────────────

  // 현금으로 포인트를 직접 충전하는 기능은 폐지했다. 포인트는 출석·블로그 댓글·영수증
  // 리뷰·친구 추천으로만 적립되어야 하며, 현금 충전을 허용하면 "충전→회원권 연장"처럼
  // 실제 상품 가격보다 싸게 우회 구매하는 경로가 생긴다. 엔드포인트는 기존 신청 이력
  // 조회(getMyPointChargeRequests, admin_listPointChargeRequests)를 위해 남겨두되
  // 새 신청만 막는다.
  // 현금으로 포인트를 직접 충전하는 기능은 폐지했다. 포인트는 출석·블로그 댓글·영수증
  // 리뷰·친구 추천으로만 적립되어야 하며, 현금 충전을 허용하면 "충전→회원권 연장"처럼
  // 실제 상품 가격보다 싸게 우회 구매하는 경로가 생긴다. 엔드포인트 자체는 기존 신청
  // 이력 조회(getMyPointChargeRequests, admin_listPointChargeRequests)를 위해 남겨두되
  // 새 신청만 거부한다.
  requestPointCharge: gymPlusProtected
    .input(z.object({
      requestedAmount: z.number().int().min(1000).max(1000000),
      paymentMethod: z.string(),
      note: z.string().optional(),
    }))
    .mutation(async () => {
      throw new TRPCError({ code: "FORBIDDEN", message: "포인트 현금 충전은 더 이상 지원하지 않습니다. 포인트는 출석·블로그 댓글·리뷰·추천으로 적립해주세요." });
    }),

  getMyPointChargeRequests: gymPlusProtected.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(gymPlusPointChargeRequests)
      .where(eq(gymPlusPointChargeRequests.gymPlusMemberId, ctx.gymPlusMemberId))
      .orderBy(desc(gymPlusPointChargeRequests.createdAt))
      .limit(30);
  }),

  admin_listPointChargeRequests: adminOnlyGymPlus
    .input(z.object({ status: z.string().optional() }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const rows = await db.select({
        id: gymPlusPointChargeRequests.id,
        gymPlusMemberId: gymPlusPointChargeRequests.gymPlusMemberId,
        requestedAmount: gymPlusPointChargeRequests.requestedAmount,
        paymentMethod: gymPlusPointChargeRequests.paymentMethod,
        note: gymPlusPointChargeRequests.note,
        status: gymPlusPointChargeRequests.status,
        createdAt: gymPlusPointChargeRequests.createdAt,
        memberName: gymPlusMembers.name,
        memberPhone: gymPlusMembers.phone,
      }).from(gymPlusPointChargeRequests)
        .leftJoin(gymPlusMembers, eq(gymPlusPointChargeRequests.gymPlusMemberId, gymPlusMembers.id))
        .where(input?.status ? eq(gymPlusPointChargeRequests.status, input.status) : undefined)
        .orderBy(desc(gymPlusPointChargeRequests.createdAt));
      return rows;
    }),

  admin_approvePointChargeRequest: adminOnlyGymPlus
    .input(z.object({
      id: z.number(),
      action: z.enum(["approved", "rejected"]),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [reqRow] = await db.select().from(gymPlusPointChargeRequests)
        .where(eq(gymPlusPointChargeRequests.id, input.id)).limit(1);
      if (!reqRow) throw new TRPCError({ code: "NOT_FOUND", message: "신청 내역을 찾을 수 없습니다." });
      if (reqRow.status !== "pending") throw new TRPCError({ code: "BAD_REQUEST", message: "이미 처리된 신청입니다." });

      await db.update(gymPlusPointChargeRequests).set({ status: input.action })
        .where(eq(gymPlusPointChargeRequests.id, input.id));

      if (input.action === "approved") {
        const [member] = await db.select({ points: gymPlusMembers.points })
          .from(gymPlusMembers).where(eq(gymPlusMembers.id, reqRow.gymPlusMemberId)).limit(1);
        if (!member) throw new TRPCError({ code: "NOT_FOUND", message: "회원을 찾을 수 없습니다." });
        const newBalance = (member.points ?? 0) + reqRow.requestedAmount;
        await db.update(gymPlusMembers).set({ points: newBalance })
          .where(eq(gymPlusMembers.id, reqRow.gymPlusMemberId));
        await db.insert(gymPlusPointLogs).values({
          gymPlusMemberId: reqRow.gymPlusMemberId,
          type: "charge",
          amount: reqRow.requestedAmount,
          balanceAfter: newBalance,
          reason: `포인트 충전 신청 승인 (${reqRow.paymentMethod})`,
        });
        return { success: true, balance: newBalance };
      }

      return { success: true };
    }),

  // ─── 포인트 회원권 연장 신청 ─────────────────────────────────────────────────

  requestPointExtension: gymPlusProtected
    .input(z.object({ days: z.number().int().min(1).max(30) }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const cost = input.days * POINTS_PER_EXTENSION_DAY;
      const [member] = await db.select({ points: gymPlusMembers.points })
        .from(gymPlusMembers).where(eq(gymPlusMembers.id, ctx.gymPlusMemberId)).limit(1);
      if (!member) throw new TRPCError({ code: "NOT_FOUND", message: "회원을 찾을 수 없습니다." });
      const balance = member.points ?? 0;
      // 소액 포인트로 만료 직전에 하루씩 연장하며 재등록을 미루는 것을 막기 위해
      // 최소 보유 포인트 기준(5,000P)을 둔다 — 이 기준 미만이면 재등록으로 유도한다.
      if (balance < MIN_POINTS_TO_USE)
        throw new TRPCError({ code: "BAD_REQUEST", message: `회원권 연장은 보유 포인트 ${MIN_POINTS_TO_USE.toLocaleString("ko-KR")}P 이상부터 이용할 수 있습니다.` });
      if (balance < cost)
        throw new TRPCError({ code: "BAD_REQUEST", message: "포인트가 부족합니다." });

      // 승인 전에 다른 곳에 써버리지 못하도록 신청 시점에 차감(선점)한다. 거절되면 환불.
      const newBalance = balance - cost;
      await db.update(gymPlusMembers).set({ points: newBalance })
        .where(eq(gymPlusMembers.id, ctx.gymPlusMemberId));

      const [row] = await db.insert(gymPlusPointExtensionRequests).values({
        gymPlusMemberId: ctx.gymPlusMemberId,
        requestedDays: input.days,
        pointsUsed: cost,
        status: "pending",
      }).returning();

      await db.insert(gymPlusPointLogs).values({
        gymPlusMemberId: ctx.gymPlusMemberId,
        type: "spend",
        amount: -cost,
        balanceAfter: newBalance,
        reason: `회원권 ${input.days}일 연장 신청`,
        relatedId: row.id,
      });

      const [gmForTx] = await db.select({ memberId: gymPlusMembers.memberId })
        .from(gymPlusMembers).where(eq(gymPlusMembers.id, ctx.gymPlusMemberId)).limit(1);
      if (gmForTx?.memberId) {
        await pool.query(
          `INSERT INTO point_transactions ("memberId", type, amount, description, "createdAt") VALUES ($1, 'use', $2, $3, now()::text)`,
          [gmForTx.memberId, cost, `회원권 ${input.days}일 연장`]
        );
      }

      const extContact = await gymPlusMemberContact(ctx.gymPlusMemberId);
      sendRequestNotification({
        kind: "회원권 연장(포인트)",
        memberName: extContact.name,
        memberPhone: extContact.phone,
        rows: [
          { label: "연장 기간", value: `${input.days}일`, highlight: true },
          { label: "차감 포인트", value: `${cost.toLocaleString("ko-KR")}P (차감 완료)` },
          { label: "남은 포인트", value: `${newBalance.toLocaleString("ko-KR")}P` },
        ],
        actionHint: `승인 후 회원권 만료일을 ${input.days}일 직접 연장해 주세요. 거절하면 포인트는 자동 반환됩니다.`,
      }).catch(() => {});

      return { success: true, pointsUsed: cost, balance: newBalance };
    }),

  getMyPointExtensionRequests: gymPlusProtected.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(gymPlusPointExtensionRequests)
      .where(eq(gymPlusPointExtensionRequests.gymPlusMemberId, ctx.gymPlusMemberId))
      .orderBy(desc(gymPlusPointExtensionRequests.createdAt))
      .limit(30);
  }),

  admin_listPointExtensionRequests: adminOnlyGymPlus
    .input(z.object({ status: z.string().optional() }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      return db.select({
        id: gymPlusPointExtensionRequests.id,
        gymPlusMemberId: gymPlusPointExtensionRequests.gymPlusMemberId,
        requestedDays: gymPlusPointExtensionRequests.requestedDays,
        pointsUsed: gymPlusPointExtensionRequests.pointsUsed,
        status: gymPlusPointExtensionRequests.status,
        createdAt: gymPlusPointExtensionRequests.createdAt,
        memberName: gymPlusMembers.name,
        memberPhone: gymPlusMembers.phone,
        membershipEnd: gymPlusMembers.membershipEnd,
      }).from(gymPlusPointExtensionRequests)
        .leftJoin(gymPlusMembers, eq(gymPlusPointExtensionRequests.gymPlusMemberId, gymPlusMembers.id))
        .where(input?.status ? eq(gymPlusPointExtensionRequests.status, input.status) : undefined)
        .orderBy(desc(gymPlusPointExtensionRequests.createdAt));
    }),

  admin_approvePointExtensionRequest: adminOnlyGymPlus
    .input(z.object({ id: z.number(), action: z.enum(["approved", "rejected"]) }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [reqRow] = await db.select().from(gymPlusPointExtensionRequests)
        .where(eq(gymPlusPointExtensionRequests.id, input.id)).limit(1);
      if (!reqRow) throw new TRPCError({ code: "NOT_FOUND", message: "신청 내역을 찾을 수 없습니다." });
      if (reqRow.status !== "pending") throw new TRPCError({ code: "BAD_REQUEST", message: "이미 처리된 신청입니다." });

      await db.update(gymPlusPointExtensionRequests).set({ status: input.action })
        .where(eq(gymPlusPointExtensionRequests.id, input.id));

      if (input.action === "rejected") {
        // 신청 시 선점 차감했던 포인트를 되돌려준다
        const [member] = await db.select({ points: gymPlusMembers.points })
          .from(gymPlusMembers).where(eq(gymPlusMembers.id, reqRow.gymPlusMemberId)).limit(1);
        const newBalance = (member?.points ?? 0) + reqRow.pointsUsed;
        await db.update(gymPlusMembers).set({ points: newBalance })
          .where(eq(gymPlusMembers.id, reqRow.gymPlusMemberId));
        await db.insert(gymPlusPointLogs).values({
          gymPlusMemberId: reqRow.gymPlusMemberId,
          type: "charge",
          amount: reqRow.pointsUsed,
          balanceAfter: newBalance,
          reason: `회원권 ${reqRow.requestedDays}일 연장 신청 거절 · 포인트 반환`,
          relatedId: reqRow.id,
        });

        const [gmRefundTx] = await db.select({ memberId: gymPlusMembers.memberId })
          .from(gymPlusMembers).where(eq(gymPlusMembers.id, reqRow.gymPlusMemberId)).limit(1);
        if (gmRefundTx?.memberId) {
          await pool.query(
            `INSERT INTO point_transactions ("memberId", type, amount, description, "createdAt") VALUES ($1, 'earn', $2, $3, now()::text)`,
            [gmRefundTx.memberId, reqRow.pointsUsed, `회원권 연장 거절 · 포인트 반환`]
          );
        }

        return { success: true, refunded: reqRow.pointsUsed };
      }

      // 승인: 만료일 갱신은 통합운영시스템과 규칙 합의 후 연결한다(현재는 수동 처리).
      // 포인트 차감은 신청 시점에 이미 완료된 상태.
      return { success: true, manualExtensionDays: reqRow.requestedDays };
    }),

  // ─── 출입 포인트 설정 ────────────────────────────────────────────────────────

  getCheckinPointSetting: adminOnlyGymPlus.query(async () => {
    const res = await pool.query(`SELECT key, value FROM gym_plus_settings WHERE key IN ('checkin_point_amount', 'kiosk_show_points')`);
    const rows = res.rows as { key: string; value: string }[];
    const amountRow = rows.find(r => r.key === "checkin_point_amount");
    const showRow = rows.find(r => r.key === "kiosk_show_points");
    const val = parseInt(amountRow?.value ?? "100");
    return { amount: isNaN(val) ? 100 : val, kioskShowPoints: showRow?.value !== "false" };
  }),

  setCheckinPointSetting: adminOnlyGymPlus
    .input(z.object({ amount: z.number().int().min(0).max(10000) }))
    .mutation(async ({ input }) => {
      await pool.query(
        `INSERT INTO gym_plus_settings (key, value, "updatedAt") VALUES ('checkin_point_amount', $1, now()::text)
         ON CONFLICT (key) DO UPDATE SET value = $1, "updatedAt" = now()::text`,
        [String(input.amount)]
      );
      return { success: true };
    }),

  setKioskShowPoints: adminOnlyGymPlus
    .input(z.object({ enabled: z.boolean(), branchId: z.number().optional() }))
    .mutation(async ({ input }) => {
      const key = input.branchId ? `kiosk_show_points_branch_${input.branchId}` : "kiosk_show_points";
      await pool.query(
        `INSERT INTO gym_plus_settings (key, value, "updatedAt") VALUES ($1, $2, now()::text)
         ON CONFLICT (key) DO UPDATE SET value = $2, "updatedAt" = now()::text`,
        [key, String(input.enabled)]
      );
      return { success: true };
    }),

  getKioskShowPointsByBranch: adminOnlyGymPlus.query(async () => {
    const res = await pool.query(
      `SELECT key, value FROM gym_plus_settings WHERE key LIKE 'kiosk_show_points%'`
    );
    const rows = res.rows as { key: string; value: string }[];
    const global = rows.find(r => r.key === "kiosk_show_points")?.value !== "false";
    const branches: Record<number, boolean> = {};
    for (const r of rows) {
      const m = r.key.match(/^kiosk_show_points_branch_(\d+)$/);
      if (m) branches[parseInt(m[1])] = r.value !== "false";
    }
    return { global, branches };
  }),

  // ─── 키오스크 공지사항 관리 ───────────────────────────────────────────────────

  getKioskNotices: adminOnlyGymPlus.query(async () => {
    const res = await pool.query(`SELECT value FROM gym_plus_settings WHERE key = 'kiosk_notices'`);
    const raw = res.rows[0]?.value;
    if (!raw) return [];
    try { return JSON.parse(raw) as string[]; } catch { return []; }
  }),

  setKioskNotices: adminOnlyGymPlus
    .input(z.object({ notices: z.array(z.string().max(100)).max(5) }))
    .mutation(async ({ input }) => {
      await pool.query(
        `INSERT INTO gym_plus_settings (key, value, "updatedAt") VALUES ('kiosk_notices', $1, now()::text)
         ON CONFLICT (key) DO UPDATE SET value = $1, "updatedAt" = now()::text`,
        [JSON.stringify(input.notices)]
      );
      return { success: true };
    }),

  // ─── 푸시 구독 ────────────────────────────────────────────────────────────────
  getPushVapidKey: gymPlusProtected.query(() => ({ publicKey: VAPID_PUBLIC })),

  subscribePush: gymPlusProtected
    .input(z.object({
      endpoint: z.string(),
      p256dh: z.string(),
      auth: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      await pool.query(
        `INSERT INTO push_subscriptions ("gymPlusMemberId", endpoint, p256dh, auth, "createdAt")
         VALUES ($1, $2, $3, $4, now()::text)
         ON CONFLICT (endpoint) DO UPDATE SET p256dh = $3, auth = $4`,
        [ctx.gymPlusMemberId, input.endpoint, input.p256dh, input.auth]
      );
      return { success: true };
    }),

  unsubscribePush: gymPlusProtected
    .input(z.object({ endpoint: z.string() }))
    .mutation(async ({ input }) => {
      await pool.query(`DELETE FROM push_subscriptions WHERE endpoint = $1`, [input.endpoint]);
      return { success: true };
    }),

  // ─── 구매신청 ────────────────────────────────────────────────────────────────

  requestPurchase: gymPlusProtected
    .input(z.object({
      productId: z.number(),
      paymentMethod: z.string(), // 포인트로 다 못 채운 나머지를 결제할 방법: "cash" | "transfer" | "card" (전액 포인트면 사용 안 함)
      pointsToUse: z.number().int().min(0).optional(),
      note: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [product] = await db.select().from(gymPlusProducts)
        .where(eq(gymPlusProducts.id, input.productId)).limit(1);
      if (!product) throw new TRPCError({ code: "NOT_FOUND", message: "상품을 찾을 수 없습니다." });

      const pointsToUse = input.pointsToUse ?? 0;

      if (pointsToUse > 0) {
        if (pointsToUse < MIN_POINTS_TO_USE)
          throw new TRPCError({ code: "BAD_REQUEST", message: `포인트는 최소 ${MIN_POINTS_TO_USE.toLocaleString("ko-KR")}P부터 사용할 수 있습니다.` });
        if (pointsToUse % POINT_USE_STEP !== 0)
          throw new TRPCError({ code: "BAD_REQUEST", message: `포인트는 ${POINT_USE_STEP}P 단위로 사용할 수 있습니다.` });
        // 관리자가 pointPrice를 직접 지정하지 않은 상품은 원화 가격을 그대로 포인트 가격(1P=1원)으로 쓴다.
        // 단, 3,000원 미만 상품은 포인트 사용 대상에서 제외한다 — 현금 충전이 막혀 있어 차익거래 위험은 없다.
        const fullPointCost = product.pointPrice ?? (product.price >= MIN_POINTS_TO_USE ? product.price : null);
        if (fullPointCost == null)
          throw new TRPCError({ code: "BAD_REQUEST", message: `${MIN_POINTS_TO_USE.toLocaleString("ko-KR")}원 미만 상품은 포인트로 구매할 수 없습니다.` });
        if (pointsToUse > product.price)
          throw new TRPCError({ code: "BAD_REQUEST", message: "포인트 사용액이 상품 금액을 초과할 수 없습니다." });

        const [member] = await db.select({ points: gymPlusMembers.points })
          .from(gymPlusMembers).where(eq(gymPlusMembers.id, ctx.gymPlusMemberId)).limit(1);
        const balance = member?.points ?? 0;
        if (balance < pointsToUse)
          throw new TRPCError({ code: "BAD_REQUEST", message: "포인트가 부족합니다." });

        // 포인트가 상품의 포인트 가격(할인가 포함)을 다 채우면 전액 포인트 결제로 처리한다.
        const isFullyPoints = pointsToUse >= fullPointCost;
        const pointsUsed = isFullyPoints ? fullPointCost : pointsToUse;
        const remainder = isFullyPoints ? 0 : product.price - pointsToUse;
        if (remainder > 0 && !["cash", "transfer", "card"].includes(input.paymentMethod))
          throw new TRPCError({ code: "BAD_REQUEST", message: "포인트로 부족한 금액을 결제할 방법을 선택해 주세요." });

        const newBalance = balance - pointsUsed;
        await db.update(gymPlusMembers).set({ points: newBalance })
          .where(eq(gymPlusMembers.id, ctx.gymPlusMemberId));
        const [req] = await db.insert(gymPlusPurchaseRequests).values({
          gymPlusMemberId: ctx.gymPlusMemberId,
          productId: product.id,
          productName: product.name,
          price: product.price,
          paymentMethod: remainder > 0 ? input.paymentMethod : "points",
          pointsUsed,
          status: remainder > 0 ? "pending" : "approved",
          note: input.note,
        }).returning();
        await db.insert(gymPlusPointLogs).values({
          gymPlusMemberId: ctx.gymPlusMemberId,
          type: "spend",
          amount: -pointsUsed,
          balanceAfter: newBalance,
          reason: `${product.name} 구매${remainder > 0 ? " (분할결제)" : ""}`,
          relatedId: req.id,
        });

        const [gmPurchaseTx] = await db.select({ memberId: gymPlusMembers.memberId })
          .from(gymPlusMembers).where(eq(gymPlusMembers.id, ctx.gymPlusMemberId)).limit(1);
        if (gmPurchaseTx?.memberId) {
          await pool.query(
            `INSERT INTO point_transactions ("memberId", type, amount, description, "createdAt") VALUES ($1, 'use', $2, $3, now()::text)`,
            [gmPurchaseTx.memberId, pointsUsed, `${product.name} 구매`]
          );
        }

        if (remainder > 0) {
          const splitContact = await gymPlusMemberContact(ctx.gymPlusMemberId);
          sendRequestNotification({
            kind: "상품 구매 (분할결제)",
            memberName: splitContact.name,
            memberPhone: splitContact.phone,
            rows: [
              { label: "상품", value: product.name, highlight: true },
              { label: "포인트 사용", value: `${pointsUsed.toLocaleString("ko-KR")}P` },
              { label: "남은 결제액", value: `${remainder.toLocaleString("ko-KR")}원 (${input.paymentMethod})` },
              ...(input.note ? [{ label: "메모", value: input.note }] : []),
            ],
            actionHint: "남은 금액 결제를 확인한 후 관리자 페이지에서 승인하고 상품을 전달해 주세요.",
          }).catch(() => {});
        }

        return { success: true, status: remainder > 0 ? "pending" : "approved", pointsUsed, remainder };
      }

      // 현장/이체/카드 결제 → pending 신청
      await db.insert(gymPlusPurchaseRequests).values({
        gymPlusMemberId: ctx.gymPlusMemberId,
        productId: product.id,
        productName: product.name,
        price: product.price,
        paymentMethod: input.paymentMethod,
        pointsUsed: 0,
        status: "pending",
        note: input.note,
      });

      const purchaseContact = await gymPlusMemberContact(ctx.gymPlusMemberId);
      sendRequestNotification({
        kind: "상품 구매",
        memberName: purchaseContact.name,
        memberPhone: purchaseContact.phone,
        rows: [
          { label: "상품", value: product.name, highlight: true },
          { label: "금액", value: `${product.price.toLocaleString("ko-KR")}원` },
          { label: "결제 방법", value: input.paymentMethod },
          ...(input.note ? [{ label: "메모", value: input.note }] : []),
        ],
        actionHint: "결제를 확인한 후 관리자 페이지에서 승인하고 상품을 전달해 주세요.",
      }).catch(() => {});

      return { success: true, status: "pending", pointsUsed: 0, remainder: product.price };
    }),

  getMyPurchases: gymPlusProtected.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(gymPlusPurchaseRequests)
      .where(eq(gymPlusPurchaseRequests.gymPlusMemberId, ctx.gymPlusMemberId))
      .orderBy(desc(gymPlusPurchaseRequests.createdAt))
      .limit(30);
  }),

  admin_listPurchaseRequests: adminOnlyGymPlus
    .input(z.object({ status: z.string().optional() }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const rows = await db.select({
        id: gymPlusPurchaseRequests.id,
        gymPlusMemberId: gymPlusPurchaseRequests.gymPlusMemberId,
        productId: gymPlusPurchaseRequests.productId,
        productName: gymPlusPurchaseRequests.productName,
        price: gymPlusPurchaseRequests.price,
        paymentMethod: gymPlusPurchaseRequests.paymentMethod,
        pointsUsed: gymPlusPurchaseRequests.pointsUsed,
        status: gymPlusPurchaseRequests.status,
        note: gymPlusPurchaseRequests.note,
        createdAt: gymPlusPurchaseRequests.createdAt,
        memberName: gymPlusMembers.name,
        memberPhone: gymPlusMembers.phone,
      }).from(gymPlusPurchaseRequests)
        .leftJoin(gymPlusMembers, eq(gymPlusPurchaseRequests.gymPlusMemberId, gymPlusMembers.id))
        .orderBy(desc(gymPlusPurchaseRequests.createdAt));
      if (input?.status) return rows.filter(r => r.status === input.status);
      return rows;
    }),

  admin_updatePurchaseRequest: adminOnlyGymPlus
    .input(z.object({ id: z.number(), status: z.string() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [existing] = await db.select().from(gymPlusPurchaseRequests)
        .where(eq(gymPlusPurchaseRequests.id, input.id)).limit(1);
      if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "신청 내역을 찾을 수 없습니다." });

      // 분할결제(포인트 일부 + 현금 등)로 신청한 건이 반려되면, 신청 시점에 이미 차감된
      // 포인트를 돌려준다. 전액 포인트 결제 건은 즉시 "approved"로 처리되어 반려 대상이 아니다.
      if (input.status === "rejected" && existing.status === "pending" && existing.pointsUsed > 0) {
        const [member] = await db.select({ points: gymPlusMembers.points })
          .from(gymPlusMembers).where(eq(gymPlusMembers.id, existing.gymPlusMemberId)).limit(1);
        const newBalance = (member?.points ?? 0) + existing.pointsUsed;
        await db.update(gymPlusMembers).set({ points: newBalance })
          .where(eq(gymPlusMembers.id, existing.gymPlusMemberId));
        await db.insert(gymPlusPointLogs).values({
          gymPlusMemberId: existing.gymPlusMemberId,
          type: "charge",
          amount: existing.pointsUsed,
          balanceAfter: newBalance,
          reason: `${existing.productName} 구매 반려 · 포인트 반환`,
          relatedId: existing.id,
        });

        const [gmPurchaseRefund] = await db.select({ memberId: gymPlusMembers.memberId })
          .from(gymPlusMembers).where(eq(gymPlusMembers.id, existing.gymPlusMemberId)).limit(1);
        if (gmPurchaseRefund?.memberId) {
          await pool.query(
            `INSERT INTO point_transactions ("memberId", type, amount, description, "createdAt") VALUES ($1, 'earn', $2, $3, now()::text)`,
            [gmPurchaseRefund.memberId, existing.pointsUsed, `${existing.productName} 구매 반려 · 포인트 반환`]
          );
        }
      }

      await db.update(gymPlusPurchaseRequests).set({ status: input.status })
        .where(eq(gymPlusPurchaseRequests.id, input.id));
      return { success: true };
    }),

  // PT 회원만 조회 (memberId가 있고 PT 패키지 보유)
  admin_listPtMembers: adminOnlyGymPlus.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    // gymPlusMembers 중 memberId가 있는 회원
    const linked = await db.select({
      id: gymPlusMembers.id,
      name: gymPlusMembers.name,
      phone: gymPlusMembers.phone,
      memberId: gymPlusMembers.memberId,
      membershipEnd: gymPlusMembers.membershipEnd,
    }).from(gymPlusMembers).where(sql`${gymPlusMembers.memberId} IS NOT NULL`);

    // 해당 memberId에 PT 패키지가 있는지 확인
    const ptResult = [];
    for (const m of linked) {
      if (!m.memberId) continue;
      const pkg = await db.select({ id: ptPackages.id }).from(ptPackages)
        .where(and(eq(ptPackages.memberId, m.memberId), eq(ptPackages.status, "active"))).limit(1);
      if (pkg[0]) ptResult.push(m);
    }
    return ptResult;
  }),

  getHealthReport: gymPlusProtected.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    // 운동 기록 횟수 (앱 출석체크 로그는 운동 기록이 아니므로 제외 — 앱의 다른 화면과 동일 기준)
    const workoutCountResult = await pool.query(
      `SELECT COUNT(*) as count FROM gym_plus_workout_logs
       WHERE "gymPlusMemberId" = $1 AND title NOT IN ('출석체크','준비운동','유산소운동')`,
      [ctx.gymPlusMemberId]
    );
    const workoutCount = parseInt(workoutCountResult.rows[0]?.count ?? "0", 10);

    // 최근 운동 기록 (최근 5개)
    // 이 테이블의 날짜 컬럼은 logDate이고 totalSets 컬럼은 없다. 세트 수는 exercisesJson에서 계산한다.
    const recentWorkoutRows = await pool.query(
      `SELECT "logDate", "workoutTheme", "exercisesJson" FROM gym_plus_workout_logs
       WHERE "gymPlusMemberId" = $1 AND title NOT IN ('출석체크','준비운동','유산소운동')
       ORDER BY "logDate" DESC LIMIT 5`,
      [ctx.gymPlusMemberId]
    );
    const recentWorkouts = recentWorkoutRows.rows.map((r: any) => {
      let totalSets: number | null = null;
      try {
        const exercises = r.exercisesJson ? JSON.parse(r.exercisesJson) : [];
        if (Array.isArray(exercises)) {
          const n = exercises.reduce(
            (sum: number, e: any) => sum + (Array.isArray(e?.sets) ? e.sets.length : 0), 0);
          if (n > 0) totalSets = n;
        }
      } catch { /* 형식이 깨진 기록은 세트 수 없이 표시 */ }

      // workoutTheme은 JSON 배열 문자열로 저장되므로 사람이 읽을 수 있게 변환
      let theme: string | null = r.workoutTheme ?? null;
      try {
        const parsed = r.workoutTheme ? JSON.parse(r.workoutTheme) : null;
        if (Array.isArray(parsed)) theme = parsed.join(", ") || null;
      } catch { /* 평문이면 그대로 사용 */ }

      return { workoutDate: r.logDate, totalSets, workoutTheme: theme };
    });

    // 출입 횟수 조회용 members.id 후보 수집.
    // 키오스크는 항상 전화번호로 members를 찾아 attendance_checks를 기록하므로, 전화번호로
    // 다시 찾은 id를 우선 신뢰한다. gym_plus_members.memberId는 계정 생성 시점에 한 번 연결된
    // 값이라 이후 어긋나 있을 수 있어(오래된/잘못된 연결) 참고용 후보로만 함께 사용한다.
    const [gymMember] = await db.select({ memberId: gymPlusMembers.memberId, phone: gymPlusMembers.phone, username: gymPlusMembers.username })
      .from(gymPlusMembers).where(eq(gymPlusMembers.id, ctx.gymPlusMemberId)).limit(1);

    const candidateIds = new Set<number>();
    if (gymMember?.memberId) candidateIds.add(gymMember.memberId);
    const phone = gymMember?.phone || gymMember?.username;
    const digits = phone?.replace(/\D/g, "");
    if (digits && digits.length >= 4) {
      const phoneMatches = await pool.query(
        `SELECT id FROM members WHERE REGEXP_REPLACE(COALESCE(phone,''), '[^0-9]', '', 'g') = $1`,
        [digits]
      );
      for (const row of phoneMatches.rows) candidateIds.add(row.id);
    }

    let attendanceCount = 0;
    let recentAttendances: { checkDate: string; checkTime: string | null; status: string }[] = [];

    if (candidateIds.size > 0) {
      const ids = Array.from(candidateIds);
      const acResult = await pool.query(
        `SELECT COUNT(*) as count FROM attendance_checks WHERE "memberId" = ANY($1::int[]) AND status = 'attended'`,
        [ids]
      );
      attendanceCount = parseInt(acResult.rows[0]?.count ?? "0", 10);

      const recentAcResult = await pool.query(
        `SELECT "checkDate", "checkTime", status FROM attendance_checks WHERE "memberId" = ANY($1::int[]) ORDER BY "checkDate" DESC, "checkTime" DESC LIMIT 5`,
        [ids]
      );
      recentAttendances = recentAcResult.rows;

      // 통합운영시스템 키오스크는 출입을 access_logs에 기록한다(attendance_checks가 아님).
      // 같은 DB를 쓰는 경우 그 출입도 합산해야 회원이 실제 출입 횟수를 볼 수 있다.
      // access_logs가 없는 환경에서는 조용히 건너뛴다.
      try {
        const alCount = await pool.query(
          `SELECT COUNT(*) as count FROM access_logs
           WHERE "memberId" = ANY($1::int[]) AND "accessResult" = 'allowed'`,
          [ids]
        );
        attendanceCount += parseInt(alCount.rows[0]?.count ?? "0", 10);

        const alRecent = await pool.query(
          `SELECT LEFT("accessedAt", 10) as "checkDate",
                  SUBSTRING("accessedAt" FROM 12 FOR 5) as "checkTime",
                  'attended' as status
           FROM access_logs
           WHERE "memberId" = ANY($1::int[]) AND "accessResult" = 'allowed'
           ORDER BY "accessedAt" DESC LIMIT 5`,
          [ids]
        );
        recentAttendances = [...recentAttendances, ...alRecent.rows]
          .sort((a, b) => (b.checkDate ?? "").localeCompare(a.checkDate ?? ""))
          .slice(0, 5);
      } catch { /* access_logs 미존재(별도 DB) — 무시 */ }
    }

    return {
      workoutCount,
      attendanceCount,
      recentWorkouts,
      recentAttendances,
    };
  }),

  // ─── 비회원 등록 신청 관리 ──────────────────────────────────────────────────
  admin_listRegistrationRequests: adminOnlyGymPlus.query(async () => {
    const res = await pool.query(
      `SELECT * FROM gym_plus_registration_requests ORDER BY "createdAt" DESC`
    );
    return res.rows;
  }),

  admin_updateRegistrationRequest: adminOnlyGymPlus
    .input(z.object({
      id: z.number().int(),
      status: z.enum(["pending", "approved", "rejected"]),
      memo: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      await pool.query(
        `UPDATE gym_plus_registration_requests SET status = $1, memo = COALESCE($2, memo), "updatedAt" = now()::text WHERE id = $3`,
        [input.status, input.memo ?? null, input.id]
      );
      return { success: true };
    }),

  // ─── 미션 시스템 (회원 앱) ────────────────────────────────────────────────────
  getMissionStatus: gymPlusProtected.query(async ({ ctx }) => {
    const memberId = ctx.gymPlusMemberId;
    const memberRes = await pool.query(
      `SELECT "programName", "programStartDate", "membershipEnd" FROM gym_plus_members WHERE id = $1`,
      [memberId]
    );
    const member = memberRes.rows[0];
    if (!member?.programName) return { programName: null, programStartDate: null, weightLogs: [], rewards: [] };

    const logsRes = await pool.query(
      `SELECT id, weight::float AS weight, note, "loggedAt" FROM gym_plus_weight_logs WHERE "gymPlusMemberId" = $1 ORDER BY "loggedAt" DESC LIMIT 100`,
      [memberId]
    );
    const rewardsRes = await pool.query(
      `SELECT id, "periodKey", "rewardMonths", "awardedAt" FROM gym_plus_mission_rewards WHERE "gymPlusMemberId" = $1 AND "programName" = $2 ORDER BY "periodKey" ASC`,
      [memberId, member.programName]
    );
    return {
      programName: member.programName as string,
      programStartDate: member.programStartDate as string,
      membershipEnd: member.membershipEnd as string,
      weightLogs: logsRes.rows,
      rewards: rewardsRes.rows,
    };
  }),

  logWeight: gymPlusProtected
    .input(z.object({ weight: z.number().min(20).max(300), note: z.string().max(100).optional() }))
    .mutation(async ({ ctx, input }) => {
      const memberId = ctx.gymPlusMemberId;
      const now = new Date();

      await pool.query(
        `INSERT INTO gym_plus_weight_logs ("gymPlusMemberId", weight, note, "loggedAt") VALUES ($1, $2, $3, $4)`,
        [memberId, input.weight, input.note || '', now.toISOString()]
      );

      const memberRes = await pool.query(
        `SELECT "programName", "programStartDate", "membershipEnd", "memberId" FROM gym_plus_members WHERE id = $1`,
        [memberId]
      );
      const member = memberRes.rows[0];
      if (!member?.programName || !member?.programStartDate) return { rewarded: false };

      // 회차는 달력월이 아니라 '프로그램 시작일 기준'으로 끊는다.
      // 달력월로 끊으면 월중 등록자의 회차가 어긋나고, 타임존 경계에서
      // 하루 차이 기록이 서로 다른 달로 분류돼 부당 보상이 발생할 수 있다.
      const anchor = parseYmd(member.programStartDate);
      if (!anchor) return { rewarded: false };

      // 회차 i 구간 = [시작일 + i개월, 시작일 + (i+1)개월)
      // 0회차는 기준 체중 측정 구간이라 보상이 없고, 1~3회차에서만 보상한다.
      const boundary = (i: number) => addMonthsKst(anchor, i).getTime();
      const t = now.getTime();
      let period = -1;
      for (let i = 0; i <= MISSION_MAX_PERIOD; i++) {
        if (t >= boundary(i) && t < boundary(i + 1)) { period = i; break; }
      }
      // 기준 구간(0회차)이거나 프로그램 종료 후면 보상 없음
      if (period < 1) return { rewarded: false };

      const periodKey = `M${period}`;

      // 직전 회차의 마지막 체중과 비교
      const prevLogRes = await pool.query(
        `SELECT weight::float AS weight FROM gym_plus_weight_logs
         WHERE "gymPlusMemberId" = $1 AND "loggedAt" >= $2 AND "loggedAt" < $3
         ORDER BY "loggedAt" DESC LIMIT 1`,
        [memberId, new Date(boundary(period - 1)).toISOString(), new Date(boundary(period)).toISOString()]
      );
      if (!prevLogRes.rows[0]) return { rewarded: false };

      if (prevLogRes.rows[0].weight - input.weight < 1.0) return { rewarded: false };

      // 1kg 이상 감량 → 보상 지급.
      // 유니크 인덱스 + ON CONFLICT로 동시 요청 시 이중 지급을 막고,
      // 실제로 삽입된 경우에만 회원권을 연장한다.
      const inserted = await pool.query(
        `INSERT INTO gym_plus_mission_rewards ("gymPlusMemberId", "programName", "periodKey", "rewardMonths")
         VALUES ($1, $2, $3, 1)
         ON CONFLICT ("gymPlusMemberId", "programName", "periodKey") DO NOTHING`,
        [memberId, member.programName, periodKey]
      );
      if (inserted.rowCount === 0) return { rewarded: false };

      // 회원권 만료일의 원본은 통합관리 members 테이블이다(memberMe 참고).
      // 연결된 회원이 있으면 그 값을 기준으로 연장하고 양쪽 모두 갱신해야 앱에 반영된다.
      let baseEndStr: string | null = member.membershipEnd ?? null;
      if (member.memberId) {
        const mainRes = await pool.query(
          `SELECT "membershipEnd" FROM members WHERE id = $1`, [member.memberId]
        );
        baseEndStr = mainRes.rows[0]?.membershipEnd ?? baseEndStr;
      }

      // 이미 만료됐거나 값이 없으면 오늘 기준으로 연장한다.
      const baseYmd = parseYmd(baseEndStr ?? "");
      const todayYmd = kstYmd(now);
      const from = baseYmd && ymdToUtc(baseYmd) > ymdToUtc(todayYmd) ? baseYmd : todayYmd;
      const newEndStr = fmtYmd(addMonthsYmd(from, 1));

      await pool.query(
        `UPDATE gym_plus_members SET "membershipEnd" = $1 WHERE id = $2`,
        [newEndStr, memberId]
      );
      if (member.memberId) {
        await pool.query(
          `UPDATE members SET "membershipEnd" = $1 WHERE id = $2`,
          [newEndStr, member.memberId]
        );
      }

      return { rewarded: true, period, extensionUntil: newEndStr };
    }),

  // ─── 미션 시스템 (관리자) ──────────────────────────────────────────────────────
  admin_setMemberProgram: adminOnlyGymPlus
    .input(z.object({
      memberId: z.number().int(),
      programName: z.string().nullable(),
      programStartDate: z.string().nullable(),
    }))
    .mutation(async ({ input }) => {
      await pool.query(
        `UPDATE gym_plus_members SET "programName" = $1, "programStartDate" = $2 WHERE id = $3`,
        [input.programName, input.programStartDate, input.memberId]
      );
      return { success: true };
    }),

  admin_listMissionProgress: adminOnlyGymPlus.query(async () => {
    const res = await pool.query(
      `SELECT m.id, m.name, m.phone, m."programName", m."programStartDate", m."membershipEnd",
              (SELECT weight::float FROM gym_plus_weight_logs WHERE "gymPlusMemberId" = m.id ORDER BY "loggedAt" DESC LIMIT 1) AS "latestWeight",
              (SELECT "loggedAt" FROM gym_plus_weight_logs WHERE "gymPlusMemberId" = m.id ORDER BY "loggedAt" DESC LIMIT 1) AS "latestLogDate",
              (SELECT COUNT(*)::int FROM gym_plus_mission_rewards WHERE "gymPlusMemberId" = m.id AND "programName" = m."programName") AS "rewardCount"
       FROM gym_plus_members m
       WHERE m."programName" IS NOT NULL AND m."programName" != ''
       ORDER BY m."programStartDate" DESC`
    );
    return res.rows;
  }),

});

// ─── Landing ──────────────────────────────────────────────────────────────────
const landingRouter = t.router({
  submitInquiry: publicProcedure
    .input(z.object({
      name: z.string(),
      phone: z.string(),
      birthdate: z.string().optional(),
      gender: z.string().optional(),
      height: z.string().optional(),
      exercisePurpose: z.string().optional(),
      exerciseExperience: z.string().optional(),
      concern: z.string().optional(),
      agreedPrivacy: z.number().default(0),
      agreedMarketing: z.number().default(0),
      marketingChannels: z.string().optional(),
      purpose: z.string().optional(),
      message: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await pool.query(
        `INSERT INTO landing_inquiries
          (name, phone, birthdate, gender, height, "exercisePurpose", "exerciseExperience",
           concern, "agreedPrivacy", "agreedMarketing", "marketingChannels", purpose, message, "createdAt")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
        [
          input.name, input.phone,
          input.birthdate || null, input.gender || null, input.height || null,
          input.exercisePurpose || null, input.exerciseExperience || null,
          input.concern || null, input.agreedPrivacy, input.agreedMarketing,
          input.marketingChannels || null,
          input.purpose || null, input.message || null,
          new Date().toISOString(),
        ]
      );

      // 통합운영시스템 상담 CRM에 카드 자동 생성 (fire-and-forget)
      fetch("https://remarkable-tenderness-production.up.railway.app/api/booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: input.name,
          phone: input.phone,
          birthDate: input.birthdate ?? undefined,
          gender: input.gender ?? undefined,
          height: input.height ?? undefined,
          purpose: input.exercisePurpose ?? input.purpose ?? undefined,
          experience: input.exerciseExperience ?? undefined,
          concern: input.concern ?? undefined,
          privacyAgreed: Boolean(input.agreedPrivacy),
          marketingAgreed: Boolean(input.agreedMarketing),
          marketingChannels: input.marketingChannels ?? undefined,
        }),
      }).catch(() => {});

      return { success: true };
    }),

  getEvents: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    try {
      const result = await pool.query(`SELECT * FROM landing_events WHERE active = 1 ORDER BY id DESC`);
      return result.rows;
    } catch {
      return [];
    }
  }),

  getReviews: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    try {
      const result = await pool.query(`SELECT * FROM landing_reviews WHERE active = 1 ORDER BY id DESC`);
      return result.rows;
    } catch {
      return [];
    }
  }),

  listInquiries: protectedProcedure.query(async () => {
    const result = await pool.query(`SELECT * FROM landing_inquiries ORDER BY "createdAt" DESC`);
    return result.rows;
  }),

  updateInquiryStatus: protectedProcedure
    .input(z.object({ id: z.number(), status: z.string() }))
    .mutation(async ({ input }) => {
      await pool.query(`UPDATE landing_inquiries SET status = $1 WHERE id = $2`, [input.status, input.id]);
      return { success: true };
    }),

  upsertEvent: protectedProcedure
    .input(z.object({ id: z.number().optional(), icon: z.string(), title: z.string(), description: z.string(), active: z.number().default(1) }))
    .mutation(async ({ input }) => {
      if (input.id) {
        await pool.query(`UPDATE landing_events SET icon=$1, title=$2, description=$3, active=$4 WHERE id=$5`,
          [input.icon, input.title, input.description, input.active, input.id]);
      } else {
        await pool.query(`INSERT INTO landing_events (icon, title, description, active, "createdAt") VALUES ($1,$2,$3,$4,$5)`,
          [input.icon, input.title, input.description, input.active, new Date().toISOString()]);
      }
      return { success: true };
    }),

  upsertReview: protectedProcedure
    .input(z.object({ id: z.number().optional(), reviewer: z.string(), rating: z.number(), content: z.string(), active: z.number().default(1) }))
    .mutation(async ({ input }) => {
      if (input.id) {
        await pool.query(`UPDATE landing_reviews SET reviewer=$1, rating=$2, content=$3, active=$4 WHERE id=$5`,
          [input.reviewer, input.rating, input.content, input.active, input.id]);
      } else {
        await pool.query(`INSERT INTO landing_reviews (reviewer, rating, content, active, "createdAt") VALUES ($1,$2,$3,$4,$5)`,
          [input.reviewer, input.rating, input.content, input.active, new Date().toISOString()]);
      }
      return { success: true };
    }),

  trackEvent: publicProcedure
    .input(z.object({
      event: z.enum(["page_view", "page_exit", "naver_click", "body_analysis_complete"]),
      session_id: z.string().optional(),
      duration_sec: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      try {
        await pool.query(
          `INSERT INTO landing_page_stats (event, session_id, duration_sec, "createdAt") VALUES ($1,$2,$3,$4)`,
          [input.event, input.session_id || null, input.duration_sec || null, new Date().toISOString()]
        );
      } catch {}
      return { success: true };
    }),

  getPageStats: protectedProcedure.query(async () => {
    try {
      const [todayR, totalR, naverR, analysisR, dailyR] = await Promise.all([
        pool.query(`SELECT COUNT(*) as cnt FROM landing_page_stats WHERE event='page_view' AND "createdAt" >= now()::date::text`),
        pool.query(`SELECT COUNT(DISTINCT session_id) as cnt FROM landing_page_stats WHERE event='page_view'`),
        pool.query(`SELECT COUNT(*) as cnt FROM landing_page_stats WHERE event='naver_click'`),
        pool.query(`SELECT COUNT(*) as cnt FROM landing_page_stats WHERE event='body_analysis_complete'`),
        pool.query(`
          SELECT DATE("createdAt") as date, COUNT(*) as views,
            SUM(CASE WHEN event='naver_click' THEN 1 ELSE 0 END) as naver_clicks,
            SUM(CASE WHEN event='body_analysis_complete' THEN 1 ELSE 0 END) as conversions
          FROM landing_page_stats
          WHERE "createdAt" >= (now() - INTERVAL '14 days')::date::text
          GROUP BY DATE("createdAt") ORDER BY date ASC
        `),
      ]);
      return {
        todayViews: Number(todayR.rows[0]?.cnt || 0),
        totalSessions: Number(totalR.rows[0]?.cnt || 0),
        naverClicks: Number(naverR.rows[0]?.cnt || 0),
        analysisComplete: Number(analysisR.rows[0]?.cnt || 0),
        daily: dailyR.rows,
      };
    } catch {
      return { todayViews: 0, totalSessions: 0, naverClicks: 0, analysisComplete: 0, daily: [] };
    }
  }),
});

// ─── Kiosk ────────────────────────────────────────────────────────────────────
const kioskRouter = t.router({
  getNotices: publicProcedure.query(async () => {
    const res = await pool.query(
      `SELECT value FROM gym_plus_settings WHERE key = 'kiosk_notices'`
    );
    const raw = res.rows[0]?.value;
    if (!raw) return [];
    try { return JSON.parse(raw) as string[]; } catch { return []; }
  }),

  checkIn: publicProcedure
    .input(z.object({ phone: z.string().min(9) }))
    .mutation(async ({ input }) => {
      // 전화번호로 회원 찾기 (숫자만 비교)
      const digits = input.phone.replace(/\D/g, "");
      // 같은 전화번호로 중복 등록된 회원이 있을 수 있다. 정렬 없이 LIMIT 1을 쓰면 매번 다른 행이
      // 뽑혀 출입 기록·포인트가 여러 행으로 흩어지므로, 만료일이 가장 나중인(=현재 유효한) 행을 고정 선택한다.
      const all = await pool.query(
        `SELECT id, name, phone, "membershipEnd", "branchId" FROM members
         WHERE REGEXP_REPLACE(COALESCE(phone,''), '[^0-9]', '', 'g') = $1 AND status = 'active'
         ORDER BY "membershipEnd" DESC NULLS LAST, id DESC
         LIMIT 1`,
        [digits]
      );
      if (!all.rows[0]) throw new TRPCError({ code: "NOT_FOUND", message: "등록된 회원을 찾을 수 없습니다." });

      const member = all.rows[0] as { id: number; name: string; phone: string; membershipEnd: string | null; branchId: number | null };

      // 지점별 포인트 표시 설정 확인
      let showPoints = true;
      if (member.branchId) {
        const branchRes = await pool.query(
          `SELECT value FROM gym_plus_settings WHERE key = $1`,
          [`kiosk_show_points_branch_${member.branchId}`]
        );
        if (branchRes.rows[0]) {
          showPoints = branchRes.rows[0].value !== "false";
        } else {
          const globalRes = await pool.query(`SELECT value FROM gym_plus_settings WHERE key = 'kiosk_show_points'`);
          showPoints = globalRes.rows[0]?.value !== "false";
        }
      } else {
        const globalRes = await pool.query(`SELECT value FROM gym_plus_settings WHERE key = 'kiosk_show_points'`);
        showPoints = globalRes.rows[0]?.value !== "false";
      }
      // KST(UTC+9) 기준 날짜·시각 사용 — UTC로 계산하면 자정~오전9시 구간에 날짜가 하루 앞서서 포인트 중복 적립 가능
      const kstNow = new Date(Date.now() + 9 * 60 * 60 * 1000);
      const today = kstNow.toISOString().slice(0, 10);

      // 이용권 만료 확인
      if (member.membershipEnd && member.membershipEnd < today) {
        throw new TRPCError({ code: "FORBIDDEN", message: "이용권이 만료되었습니다. 데스크에 문의해주세요." });
      }
      const checkTime = `${String(kstNow.getUTCHours()).padStart(2,"0")}:${String(kstNow.getUTCMinutes()).padStart(2,"0")}`;

      // 오늘 이미 출입했는지 확인
      const existing = await pool.query(
        `SELECT id FROM attendance_checks WHERE "memberId" = $1 AND "checkDate" = $2 LIMIT 1`,
        [member.id, today]
      );

      if (existing.rows[0]) {
        // 이미 출입한 경우에도 운동복 정보 조회
        let uniformEndAlready: string | null = null;
        try {
          const ur = await pool.query(
            `SELECT ("startDate"::date + (duration || ' months')::interval)::date::text as end_date
             FROM revenue_entries
             WHERE "memberId" = $1 AND type = '기타' AND "programDetail" ILIKE '%운동복%'
               AND "startDate" IS NOT NULL AND duration IS NOT NULL
             ORDER BY "paymentDate" DESC LIMIT 1`,
            [member.id]
          );
          const ed = ur.rows[0]?.end_date as string | undefined;
          if (ed && ed >= today) uniformEndAlready = ed;
        } catch (e) {
          console.error("kiosk uniform check error (already):", e);
        }
        let totalPointsAlready = 0;
        try {
          const gmAlready = await pool.query(`SELECT points FROM gym_plus_members WHERE "memberId" = $1 LIMIT 1`, [member.id]);
          totalPointsAlready = gmAlready.rows[0]?.points ?? 0;
        } catch {}
        return { name: member.name, alreadyCheckedIn: true, pointsEarned: 0, totalPoints: totalPointsAlready, showPoints, uniformEnd: uniformEndAlready };
      }

      // 키오스크 출입 기록 (trainerId=0: 시스템/키오스크)
      await pool.query(
        `INSERT INTO attendance_checks ("memberId", "trainerId", "checkDate", "checkTime", status, "createdAt", "updatedAt")
         VALUES ($1, 0, $2, $3, 'attended', now()::text, now()::text)`,
        [member.id, today, checkTime]
      );

      // 포인트 적립
      let pointsEarned = 0;
      try {
        const settingRes = await pool.query(`SELECT value FROM gym_plus_settings WHERE key = 'checkin_point_amount'`);
        const pointAmount = parseInt(settingRes.rows[0]?.value ?? "0");
        if (pointAmount > 0) {
          const gmRow = await pool.query(
            `SELECT id, points FROM gym_plus_members WHERE "memberId" = $1 LIMIT 1`,
            [member.id]
          );
          if (gmRow.rows[0]) {
            const gm = gmRow.rows[0] as { id: number; points: number };
            const newBalance = (gm.points ?? 0) + pointAmount;
            await pool.query(`UPDATE gym_plus_members SET points = $1 WHERE id = $2`, [newBalance, gm.id]);
            await pool.query(
              `INSERT INTO gym_plus_point_logs ("gymPlusMemberId", type, amount, "balanceAfter", reason, "createdAt")
               VALUES ($1, 'earn', $2, $3, $4, now()::text)`,
              [gm.id, pointAmount, newBalance, `키오스크 출입 (${today})`]
            );
            pointsEarned = pointAmount;
          }
        }
      } catch (e) {
        console.error("kiosk point error:", e);
      }

      // 운동복 서비스 기간 조회 (revenue_entries type='기타', programDetail LIKE '%운동복%')
      let uniformEnd: string | null = null;
      try {
        const uniformRes = await pool.query(
          `SELECT "startDate", duration
           FROM revenue_entries
           WHERE "memberId" = $1
             AND type = '기타'
             AND "programDetail" ILIKE '%운동복%'
             AND "startDate" IS NOT NULL
             AND duration IS NOT NULL
           ORDER BY "paymentDate" DESC
           LIMIT 1`,
          [member.id]
        );
        if (uniformRes.rows[0]) {
          const { startDate, duration } = uniformRes.rows[0] as { startDate: string; duration: number };
          const endRes = await pool.query(
            `SELECT ($1::date + ($2 || ' months')::interval)::date::text as end_date`,
            [startDate, duration]
          );
          const endDate = endRes.rows[0]?.end_date as string | undefined;
          if (endDate && endDate >= today) {
            uniformEnd = endDate;
          }
        }
      } catch (e) {
        console.error("kiosk uniform check error:", e);
      }

      let totalPoints = 0;
      try {
        const gmTotal = await pool.query(`SELECT points FROM gym_plus_members WHERE "memberId" = $1 LIMIT 1`, [member.id]);
        totalPoints = gmTotal.rows[0]?.points ?? 0;
      } catch {}
      return { name: member.name, alreadyCheckedIn: false, pointsEarned, totalPoints, showPoints, uniformEnd };
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
  landing: landingRouter,
  kiosk: kioskRouter,
});

export type AppRouter = typeof appRouter;
