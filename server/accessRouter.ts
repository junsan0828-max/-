import { initTRPC, TRPCError } from "@trpc/server";
import { z } from "zod";
import { eq, desc, and, like } from "drizzle-orm";
import { getDb, pool } from "./db";
import { members, lockers, accessLogs, ptPackages, branches } from "../drizzle/schema";
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

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

// PostgreSQL REGEXP_REPLACE로 DB에서 직접 전화번호 정규화 비교
async function findMemberByPhone(phoneInput: string) {
  const digits = normalizePhone(phoneInput);
  const last8 = digits.slice(-8); // 010 없이 저장된 경우 대비

  const result = await pool.query(
    `SELECT * FROM members
     WHERE REGEXP_REPLACE(COALESCE(phone, ''), '[^0-9]', '', 'g') = $1
        OR REGEXP_REPLACE(COALESCE(phone, ''), '[^0-9]', '', 'g') = $2
     ORDER BY id LIMIT 1`,
    [digits, last8]
  );
  return result.rows[0] ?? null;
}

export const accessRouter = t.router({
  // 키오스크 체크인 (인증 불필요)
  checkIn: publicProcedure
    .input(z.object({ phone: z.string().optional(), memberNumber: z.string().optional() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      let found: any = null;
      if (input.memberNumber) {
        const result = await pool.query(
          `SELECT * FROM members WHERE "memberNumber" = $1 LIMIT 1`,
          [input.memberNumber]
        );
        found = result.rows[0] ?? null;
      } else if (input.phone) {
        found = await findMemberByPhone(input.phone);
      }

      const phoneForLog = input.phone ?? input.memberNumber ?? "";

      if (!found) {
        await db.insert(accessLogs).values({
          phone: phoneForLog,
          accessResult: "not_found",
        });
        return { result: "not_found", member: null, locker: null };
      }

      const today = new Date().toISOString().substring(0, 10);

      // 헬스 회원권 확인
      const hasGymMembership =
        !!found.membershipEnd && found.membershipEnd >= today;

      // 유효 PT 패키지 확인
      const activePT = await db
        .select()
        .from(ptPackages)
        .where(
          and(
            eq(ptPackages.memberId, found.id),
            eq(ptPackages.status, "active")
          )
        );
      const validPT = activePT.filter(
        (p: any) => !p.expiryDate || p.expiryDate >= today
      );
      const hasPT = validPT.length > 0;

      let accessResult: string;
      let membershipType: string | null = null;

      if (found.status !== "active") {
        accessResult = "blocked";
      } else if (hasGymMembership || hasPT) {
        accessResult = "allowed";
        if (hasGymMembership) membershipType = "헬스";
        if (hasPT) membershipType = membershipType ? `${membershipType}+PT` : "PT";
      } else {
        accessResult = "expired";
      }

      // 락커 조회
      const lockerRow = await db
        .select()
        .from(lockers)
        .where(and(eq(lockers.memberId, found.id), eq(lockers.isOccupied, 1)))
        .limit(1);

      // 지점명 조회
      let branchName: string | null = null;
      if (found.branchId) {
        const [branch] = await db.select().from(branches).where(eq(branches.id, found.branchId));
        branchName = branch?.name ?? null;
      }

      // 출입 로그 기록
      await db.insert(accessLogs).values({
        memberId: found.id,
        memberName: found.name,
        phone: phoneForLog,
        branchId: found.branchId ?? null,
        accessResult,
        membershipType,
        membershipEnd: found.membershipEnd ?? null,
        lockerNumber: lockerRow[0]?.lockerNumber ?? null,
      });

      return {
        result: accessResult,
        branchName,
        member: {
          id: found.id,
          name: found.name,
          phone: found.phone,
          membershipStart: found.membershipStart,
          membershipEnd: found.membershipEnd,
          membershipType,
          ptPackage:
            validPT.length > 0
              ? {
                  name: validPT[0].packageName,
                  expiryDate: validPT[0].expiryDate,
                  remainingSessions:
                    (validPT[0].totalSessions ?? 0) -
                    (validPT[0].usedSessions ?? 0),
                }
              : null,
        },
        locker: lockerRow[0]
          ? {
              lockerNumber: lockerRow[0].lockerNumber,
              type: lockerRow[0].lockerType,
              endDate: lockerRow[0].endDate,
            }
          : null,
      };
    }),

  // 오늘 출입 통계
  todayStats: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const today = new Date().toISOString().substring(0, 10);
    const logs = await db
      .select()
      .from(accessLogs)
      .where(like(accessLogs.accessedAt, `${today}%`));
    return {
      total: logs.length,
      allowed: logs.filter((l) => l.accessResult === "allowed").length,
      denied: logs.filter((l) => l.accessResult !== "allowed").length,
    };
  }),

  // 출입 로그 조회
  getAccessLogs: protectedProcedure
    .input(
      z.object({
        page: z.number().default(1),
        limit: z.number().default(100),
        date: z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      if (input.date) {
        return db
          .select()
          .from(accessLogs)
          .where(like(accessLogs.accessedAt, `${input.date}%`))
          .orderBy(desc(accessLogs.accessedAt))
          .limit(input.limit);
      }
      return db
        .select()
        .from(accessLogs)
        .orderBy(desc(accessLogs.accessedAt))
        .limit(input.limit)
        .offset((input.page - 1) * input.limit);
    }),

  // 락커 목록
  getLockers: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    return db.select().from(lockers).orderBy(lockers.lockerNumber);
  }),

  // 락커 생성
  createLocker: protectedProcedure
    .input(
      z.object({
        lockerNumber: z.string(),
        lockerType: z.string().default("personal"),
        branchId: z.number().optional(),
        memo: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [locker] = await db
        .insert(lockers)
        .values({
          lockerNumber: input.lockerNumber,
          lockerType: input.lockerType,
          branchId: input.branchId,
          memo: input.memo,
          isOccupied: 0,
        })
        .returning();
      return locker;
    }),

  // 락커 배정
  assignLocker: protectedProcedure
    .input(
      z.object({
        lockerId: z.number(),
        memberId: z.number(),
        memberName: z.string(),
        memberPhone: z.string().optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [updated] = await db
        .update(lockers)
        .set({
          memberId: input.memberId,
          memberName: input.memberName,
          memberPhone: input.memberPhone,
          isOccupied: 1,
          startDate: input.startDate,
          endDate: input.endDate,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(lockers.id, input.lockerId))
        .returning();
      return updated;
    }),

  // 락커 반납
  releaseLocker: protectedProcedure
    .input(z.object({ lockerId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [updated] = await db
        .update(lockers)
        .set({
          memberId: null,
          memberName: null,
          memberPhone: null,
          isOccupied: 0,
          startDate: null,
          endDate: null,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(lockers.id, input.lockerId))
        .returning();
      return updated;
    }),

  // 락커 삭제
  deleteLocker: protectedProcedure
    .input(z.object({ lockerId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.delete(lockers).where(eq(lockers.id, input.lockerId));
      return { ok: true };
    }),

  // 락커 메모 수정
  updateLockerMemo: protectedProcedure
    .input(z.object({ lockerId: z.number(), memo: z.string() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [updated] = await db
        .update(lockers)
        .set({ memo: input.memo, updatedAt: new Date().toISOString() })
        .where(eq(lockers.id, input.lockerId))
        .returning();
      return updated;
    }),

  // 회원 목록 (락커 배정용)
  getMembersForLocker: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    return db
      .select({
        id: members.id,
        name: members.name,
        phone: members.phone,
      })
      .from(members)
      .where(eq(members.status, "active"))
      .orderBy(members.name);
  }),
});
