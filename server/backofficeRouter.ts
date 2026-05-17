import { initTRPC, TRPCError } from "@trpc/server";
import { z } from "zod";
import { eq, and, or, desc, like, isNull } from "drizzle-orm";
import { getDb, pool } from "./db";
import { members, ptPackages, lockers, accessLogs, branches } from "../drizzle/schema";
import type { AuthUser } from "./auth";
import type { Request, Response } from "express";

interface Context { user?: AuthUser; req: Request; res: Response; }

const t = initTRPC.context<Context>().create();
const proc = t.procedure.use(({ ctx, next }) => {
  if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });
  const allowed = ["admin", "sub_admin", "access"];
  if (!allowed.includes(ctx.user.role)) throw new TRPCError({ code: "FORBIDDEN" });
  return next({ ctx: { ...ctx, user: ctx.user } });
});

export const backofficeRouter = t.router({
  // ── 지점 목록 ──────────────────────────────────────────────────────────────
  getBranches: proc.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    return db.select().from(branches).orderBy(branches.id);
  }),

  // ── 회원 검색 ──────────────────────────────────────────────────────────────
  searchMembers: proc
    .input(z.object({ q: z.string().default(""), page: z.number().default(1), branchId: z.number().nullable().optional() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const limit = 30;
      const offset = (input.page - 1) * limit;
      const q = `%${input.q}%`;
      const searchCond = input.q ? or(like(members.name, q), like(members.phone, q)) : undefined;
      const branchCond = input.branchId != null ? eq(members.branchId, input.branchId) : undefined;
      const whereCond = searchCond && branchCond ? and(searchCond, branchCond) : searchCond ?? branchCond;
      const rows = await db.select().from(members)
        .where(whereCond)
        .orderBy(desc(members.createdAt))
        .limit(limit).offset(offset);
      return rows;
    }),

  // ── 회원 상세 ──────────────────────────────────────────────────────────────
  getMember: proc
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [member] = await db.select().from(members).where(eq(members.id, input.id));
      if (!member) throw new TRPCError({ code: "NOT_FOUND" });
      const packages = await db.select().from(ptPackages)
        .where(eq(ptPackages.memberId, input.id))
        .orderBy(desc(ptPackages.createdAt));
      const locker = await db.select().from(lockers)
        .where(and(eq(lockers.memberId, input.id), eq(lockers.isOccupied, 1)))
        .limit(1);
      return { member, packages, locker: locker[0] ?? null };
    }),

  // ── 회원 정보 수정 ─────────────────────────────────────────────────────────
  updateMember: proc
    .input(z.object({
      id: z.number(),
      name: z.string().optional(),
      phone: z.string().optional(),
      status: z.string().optional(),
      membershipStart: z.string().nullable().optional(),
      membershipEnd: z.string().nullable().optional(),
      memo: z.string().nullable().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { id, ...data } = input;
      const [updated] = await db.update(members)
        .set({ ...data, updatedAt: new Date().toISOString() })
        .where(eq(members.id, id)).returning();
      return updated;
    }),

  // ── PT 패키지 추가 ─────────────────────────────────────────────────────────
  addPtPackage: proc
    .input(z.object({
      memberId: z.number(),
      packageName: z.string(),
      totalSessions: z.number(),
      expiryDate: z.string().optional(),
      price: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [pkg] = await db.insert(ptPackages).values({
        memberId: input.memberId,
        trainerId: 1,
        packageName: input.packageName,
        totalSessions: input.totalSessions,
        usedSessions: 0,
        expiryDate: input.expiryDate,
        price: input.price,
        status: "active",
      }).returning();
      return pkg;
    }),

  // ── PT 패키지 수정 ─────────────────────────────────────────────────────────
  updatePtPackage: proc
    .input(z.object({
      id: z.number(),
      status: z.string().optional(),
      expiryDate: z.string().nullable().optional(),
      usedSessions: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { id, ...data } = input;
      const [updated] = await db.update(ptPackages)
        .set({ ...data, updatedAt: new Date().toISOString() })
        .where(eq(ptPackages.id, id)).returning();
      return updated;
    }),

  // ── 락커 전체 목록 ─────────────────────────────────────────────────────────
  getLockers: proc
    .input(z.object({ branchId: z.number().nullable().optional() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const whereCond = input.branchId != null ? eq(lockers.branchId, input.branchId) : undefined;
      return db.select().from(lockers).where(whereCond).orderBy(lockers.lockerNumber);
    }),

  createLocker: proc
    .input(z.object({ lockerNumber: z.string(), lockerType: z.string().default("personal"), branchId: z.number().optional(), memo: z.string().optional() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [l] = await db.insert(lockers).values({ ...input, isOccupied: 0 }).returning();
      return l;
    }),

  assignLocker: proc
    .input(z.object({ lockerId: z.number(), memberId: z.number(), memberName: z.string(), memberPhone: z.string().optional(), startDate: z.string().optional(), endDate: z.string().optional() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [l] = await db.update(lockers).set({ memberId: input.memberId, memberName: input.memberName, memberPhone: input.memberPhone, isOccupied: 1, startDate: input.startDate, endDate: input.endDate, updatedAt: new Date().toISOString() }).where(eq(lockers.id, input.lockerId)).returning();
      return l;
    }),

  releaseLocker: proc
    .input(z.object({ lockerId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [l] = await db.update(lockers).set({ memberId: null, memberName: null, memberPhone: null, isOccupied: 0, startDate: null, endDate: null, updatedAt: new Date().toISOString() }).where(eq(lockers.id, input.lockerId)).returning();
      return l;
    }),

  deleteLocker: proc
    .input(z.object({ lockerId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.delete(lockers).where(eq(lockers.id, input.lockerId));
      return { ok: true };
    }),

  // ── 오늘 출입 로그 ─────────────────────────────────────────────────────────
  todayLogs: proc
    .input(z.object({ branchId: z.number().nullable().optional() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const today = new Date().toISOString().substring(0, 10);
      const dateCond = like(accessLogs.accessedAt, `${today}%`);
      const whereCond = input.branchId != null ? and(dateCond, eq(accessLogs.branchId, input.branchId)) : dateCond;
      return db.select().from(accessLogs).where(whereCond).orderBy(desc(accessLogs.accessedAt)).limit(100);
    }),
});
