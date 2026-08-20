import { initTRPC, TRPCError } from "@trpc/server";
import { z } from "zod";
import { eq, desc, and, like, sql } from "drizzle-orm";
import { getDb, pool } from "./db";
import { members, lockers, accessLogs, ptPackages, branches, kioskBanners, lockerCategories, uniforms, revenueEntries, gymPlusMembers, pointTransactions } from "../drizzle/schema";
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
// 파괴적/설정 작업(락커·배너 삭제 등)은 관리자만
const adminProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });
  if (ctx.user.role !== "admin" && ctx.user.role !== "sub_admin") throw new TRPCError({ code: "FORBIDDEN", message: "관리자만 가능합니다." });
  return next({ ctx: { ...ctx, user: ctx.user } });
});

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

// KST(UTC+9) 기준 날짜 문자열(YYYY-MM-DD). UTC 사용 시 한국 오전(00~09시)에
// 만료 판정/통계가 하루 밀리는 문제를 방지한다.
function kstDate(offsetDays = 0): string {
  return new Date(Date.now() + 9 * 3600000 + offsetDays * 86400000).toISOString().substring(0, 10);
}
function kstMonthPrefix(): string {
  return new Date(Date.now() + 9 * 3600000).toISOString().substring(0, 7);
}

// PostgreSQL REGEXP_REPLACE로 DB에서 직접 전화번호 정규화 비교
async function findMemberByPhone(phoneInput: string) {
  const digits = normalizePhone(phoneInput);

  // 1) 전체 번호 정확히 일치
  const exact = await pool.query(
    `SELECT * FROM members
     WHERE REGEXP_REPLACE(COALESCE(phone, ''), '[^0-9]', '', 'g') = $1
     ORDER BY id LIMIT 1`,
    [digits]
  );
  if (exact.rows[0]) return exact.rows[0];

  // 2) 010 없이 저장된 경우 대비 — 뒷 8자리로 폴백하되, 유일하게 일치할 때만 허용
  //    (뒷 8자리가 같은 다른 회원으로 잘못 체크인되는 것 방지)
  const last8 = digits.slice(-8);
  if (last8.length === 8) {
    const fb = await pool.query(
      `SELECT * FROM members
       WHERE REGEXP_REPLACE(COALESCE(phone, ''), '[^0-9]', '', 'g') = $1
       ORDER BY id LIMIT 2`,
      [last8]
    );
    if (fb.rows.length === 1) return fb.rows[0];
  }
  return null;
}

// 출석번호(전화번호 뒷자리 4자리 + 중복 구분 suffix)로 회원 조회
// 4자리: 해당 뒷자리 회원이 1명이면 그 회원, 여러 명이면 ambiguous
// 5자리: 앞 4자리가 뒷자리, 마지막 1자리가 0부터 시작하는 순번 (가입순 오름차순)
async function findMemberByAttendanceNumber(attendanceNumber: string) {
  const digits = attendanceNumber.replace(/\D/g, "");
  if (digits.length < 4) return { member: null, candidates: [] as any[] };

  const last4 = digits.slice(0, 4);
  const hasSuffix = digits.length >= 5;
  const suffix = hasSuffix ? parseInt(digits[4]) : undefined;

  const result = await pool.query(
    `SELECT * FROM members
     WHERE REGEXP_REPLACE(COALESCE(phone, ''), '[^0-9]', '', 'g') LIKE $1
     ORDER BY id ASC`,
    [`%${last4}`]
  );
  const rows = result.rows;

  if (rows.length === 0) return { member: null, candidates: [] };

  if (suffix === undefined) {
    if (rows.length === 1) return { member: rows[0], candidates: [] };
    // 중복 → 후보 목록 반환
    return { member: null, candidates: rows };
  }

  return { member: rows[suffix] ?? null, candidates: [] };
}

export const accessRouter = t.router({
  // 만료 임박 진단 (인증 불필요 — 개인정보 미포함)
  debugExpiring: publicProcedure.query(async () => {
    const today = kstDate();
    const future = kstDate(30);
    const result = await pool.query(
      `SELECT COUNT(*)::int AS cnt FROM members
       WHERE status = 'active' AND "membershipEnd" IS NOT NULL
         AND "membershipEnd" >= $1 AND "membershipEnd" <= $2`,
      [today, future]
    );
    return { today, future, count: result.rows[0]?.cnt ?? 0, serverTime: new Date().toISOString() };
  }),

  // 키오스크 체크인 (인증 불필요)
  checkIn: publicProcedure
    .input(z.object({
      phone: z.string().optional(),
      attendanceNumber: z.string().optional(),
      memberId: z.number().optional(), // 이름 선택 후 직접 체크인
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      let found: any = null;
      if (input.memberId) {
        // 이름 선택 후 직접 체크인
        const result = await pool.query(`SELECT * FROM members WHERE id = $1 LIMIT 1`, [input.memberId]);
        found = result.rows[0] ?? null;
      } else if (input.attendanceNumber) {
        const { member, candidates } = await findMemberByAttendanceNumber(input.attendanceNumber);
        if (candidates.length > 1) {
          // 중복 → 이름 선택 화면용 후보 반환
          return {
            result: "ambiguous",
            candidates: candidates.map((m: any) => ({ id: m.id, name: m.name })),
            member: null,
            locker: null,
            branchName: null,
          };
        }
        found = member;
      } else if (input.phone) {
        found = await findMemberByPhone(input.phone);
      } else {
        throw new TRPCError({ code: "BAD_REQUEST", message: "전화번호 또는 출석번호를 입력해주세요." });
      }

      const phoneForLog = input.phone ?? input.attendanceNumber ?? String(input.memberId ?? "");

      if (!found) {
        await db.insert(accessLogs).values({
          phone: phoneForLog,
          accessResult: "not_found",
        });
        return { result: "not_found", member: null, locker: null };
      }

      const today = kstDate();

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

      // 운동복 조회 (착용 중)
      const uniformRow = await db
        .select()
        .from(uniforms)
        .where(and(eq(uniforms.memberId, found.id), eq(uniforms.isActive, 1)))
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

      // 포인트 적립 (입장 허용 시만, 하루 1회)
      let earnedPoints = 0;
      let totalPoints = 0;
      if (accessResult === "allowed") {
        const CHECKIN_POINTS = 100;
        const phone4 = normalizePhone(found.phone ?? "").slice(-4);
        const gpRows = await db.select({ id: gymPlusMembers.id, points: gymPlusMembers.points })
          .from(gymPlusMembers)
          .where(eq(gymPlusMembers.memberId, found.id))
          .limit(1);
        let gp = gpRows[0];
        if (!gp && phone4.length === 4) {
          const gpByPhone = await db.select({ id: gymPlusMembers.id, points: gymPlusMembers.points })
            .from(gymPlusMembers)
            .where(like(gymPlusMembers.phone, `%${phone4}`))
            .limit(1);
          gp = gpByPhone[0];
        }
        if (gp) {
          const alreadyEarned = await db.select({ id: pointTransactions.id })
            .from(pointTransactions)
            .where(and(
              eq(pointTransactions.gymPlusMemberId, gp.id),
              eq(pointTransactions.referenceType, "checkin"),
              like(pointTransactions.createdAt, `${today}%`),
            ))
            .limit(1);
          if (alreadyEarned.length === 0) {
            const newBalance = (gp.points ?? 0) + CHECKIN_POINTS;
            await db.update(gymPlusMembers).set({ points: newBalance }).where(eq(gymPlusMembers.id, gp.id));
            await db.insert(pointTransactions).values({
              memberId: found.id,
              gymPlusMemberId: gp.id,
              type: "earn",
              amount: CHECKIN_POINTS,
              balance: newBalance,
              description: "출석 체크인 포인트",
              referenceType: "checkin",
            });
            earnedPoints = CHECKIN_POINTS;
            totalPoints = newBalance;
          } else {
            totalPoints = gp.points ?? 0;
          }
        }
      }

      return {
        result: accessResult,
        branchName,
        earnedPoints,
        totalPoints,
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
        uniform: uniformRow[0]
          ? {
              size: uniformRow[0].size,
              endDate: uniformRow[0].endDate,
            }
          : null,
      };
    }),

  // 오늘 출입 통계
  todayStats: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const today = kstDate();
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

  // ── 회원별 키오스크 출석 횟수 ─────────────────────────────────────────────
  getMemberAccessCount: protectedProcedure
    .input(z.object({ memberId: z.number() }))
    .query(async ({ input }) => {
      const result = await pool.query(
        `SELECT COUNT(*)::int AS count FROM access_logs WHERE "memberId" = $1 AND "accessResult" = 'allowed'`,
        [input.memberId]
      );
      return result.rows[0]?.count ?? 0;
    }),

  // ── 회원별 키오스크 출석 날짜 목록 (월별) ────────────────────────────────────
  getMemberAccessDates: protectedProcedure
    .input(z.object({ memberId: z.number(), yearMonth: z.string() }))
    .query(async ({ input }) => {
      const result = await pool.query(
        `SELECT DISTINCT LEFT("accessedAt", 10) AS date
         FROM access_logs
         WHERE "memberId" = $1 AND "accessResult" = 'allowed' AND "accessedAt" LIKE $2
         ORDER BY date ASC`,
        [input.memberId, `${input.yearMonth}%`]
      );
      return result.rows.map((r: any) => r.date as string);
    }),

  // ── 락커 카테고리 ───────────────────────────────────────────────────────────

  getLockerCategories: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    return db.select().from(lockerCategories).orderBy(lockerCategories.sortOrder, lockerCategories.id);
  }),

  createLockerCategory: adminProcedure
    .input(z.object({
      name: z.string(),
      branchId: z.number().optional(),
      color: z.string().default("#3b82f6"),
      sortOrder: z.number().default(0),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [cat] = await db.insert(lockerCategories).values(input).returning();
      return cat;
    }),

  updateLockerCategory: adminProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().optional(),
      color: z.string().optional(),
      sortOrder: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { id, ...rest } = input;
      const [cat] = await db.update(lockerCategories).set(rest).where(eq(lockerCategories.id, id)).returning();
      return cat;
    }),

  deleteLockerCategory: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      // 해당 카테고리 락커들은 미분류로 초기화
      await db.update(lockers).set({ categoryId: null }).where(eq(lockers.categoryId, input.id));
      await db.delete(lockerCategories).where(eq(lockerCategories.id, input.id));
      return { ok: true };
    }),

  // 락커 카테고리 변경
  setLockerCategory: protectedProcedure
    .input(z.object({ lockerId: z.number(), categoryId: z.number().nullable() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [updated] = await db.update(lockers)
        .set({ categoryId: input.categoryId, updatedAt: new Date().toISOString() })
        .where(eq(lockers.id, input.lockerId))
        .returning();
      return updated;
    }),

  // ── 락커 목록 ────────────────────────────────────────────────────────────────

  // 락커 목록
  getLockers: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    return db.select().from(lockers).orderBy(
      sql`CASE WHEN "lockerNumber" ~ '^[0-9]+$' THEN "lockerNumber"::int ELSE NULL END`,
      lockers.lockerNumber
    );
  }),

  // 락커 생성
  createLocker: protectedProcedure
    .input(
      z.object({
        lockerNumber: z.string(),
        lockerType: z.string().default("personal"),
        branchId: z.number().optional(),
        categoryId: z.number().optional(),
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
          categoryId: input.categoryId,
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
        rentalType: z.string().optional(),
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
          rentalType: input.rentalType ?? "service",
          updatedAt: new Date().toISOString(),
        })
        .where(eq(lockers.id, input.lockerId))
        .returning();
      return updated;
    }),

  // 락커 기간(시작일/만료일) 수정
  updateLockerPeriod: protectedProcedure
    .input(z.object({
      lockerId: z.number(),
      startDate: z.string().nullable().optional(),
      endDate: z.string().nullable().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const setFields: Record<string, any> = { updatedAt: new Date().toISOString() };
      if (input.startDate !== undefined) setFields.startDate = input.startDate;
      if (input.endDate !== undefined) setFields.endDate = input.endDate;
      const [updated] = await db.update(lockers).set(setFields).where(eq(lockers.id, input.lockerId)).returning();
      if (!updated) throw new TRPCError({ code: "NOT_FOUND" });
      return updated;
    }),

  // 락커 번호로 조회 후 회원 자동 연결 (serviceItems 배지 불일치 수정용)
  fixLockerMismatch: protectedProcedure
    .input(z.object({
      memberId: z.number(),
      memberName: z.string(),
      memberPhone: z.string().optional(),
      lockerNumber: z.string(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // lockerNumber로 락커 레코드 검색
      const [locker] = await db.select()
        .from(lockers)
        .where(eq(lockers.lockerNumber, input.lockerNumber))
        .limit(1);

      if (!locker) throw new TRPCError({ code: "NOT_FOUND", message: `락커 번호 ${input.lockerNumber}를 찾을 수 없습니다.` });

      const [updated] = await db.update(lockers).set({
        memberId: input.memberId,
        memberName: input.memberName,
        memberPhone: input.memberPhone ?? null,
        isOccupied: 1,
        updatedAt: new Date().toISOString(),
      }).where(eq(lockers.id, locker.id)).returning();

      if (!updated) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "락커 업데이트가 반영되지 않았습니다." });
      return updated;
    }),

  // 락커 구매 (배정 + 장부 자동 생성)
  purchaseLocker: protectedProcedure
    .input(z.object({
      lockerId: z.number(),
      memberId: z.number(),
      memberName: z.string(),
      memberPhone: z.string().optional(),
      months: z.number(),
      amount: z.number(),
      paymentMethod: z.string().optional(),
      startDate: z.string(),
      endDate: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [updated] = await db.update(lockers).set({
        memberId: input.memberId,
        memberName: input.memberName,
        memberPhone: input.memberPhone,
        isOccupied: 1,
        startDate: input.startDate,
        endDate: input.endDate,
        rentalType: "paid",
        updatedAt: new Date().toISOString(),
      }).where(eq(lockers.id, input.lockerId)).returning();
      await db.insert(revenueEntries).values({
        memberId: input.memberId,
        trainerId: null,
        createdBy: ctx.user.id,
        customerName: input.memberName,
        phone: input.memberPhone ?? null,
        programDetail: `락커 ${input.months}개월`,
        type: "기타",
        subType: "신규",
        amount: input.amount,
        discountAmount: 0,
        paidAmount: input.amount,
        unpaidAmount: 0,
        paymentMethod: input.paymentMethod ?? undefined,
        paymentDate: input.startDate,
        startDate: input.startDate,
      });
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
  deleteLocker: adminProcedure
    .input(z.object({ lockerId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.delete(lockers).where(eq(lockers.id, input.lockerId));
      return { ok: true };
    }),

  // 락커 범위 삭제 (빈 락커만, 번호 기준)
  deleteLockerRange: adminProcedure
    .input(z.object({ from: z.number(), to: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const result = await pool.query(
        `DELETE FROM lockers WHERE "isOccupied" = 0
         AND "lockerNumber" ~ '^[0-9]+$'
         AND "lockerNumber"::int BETWEEN $1 AND $2
         RETURNING id`,
        [input.from, input.to]
      );
      return { deleted: result.rowCount ?? 0 };
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

  // 지점 목록 (출입/락커 필터용)
  getBranches: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    return db.select().from(branches).orderBy(branches.id);
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

  // ── 키오스크 배너 ──────────────────────────────────────────────────────────

  // 배너 목록 조회 (키오스크 — 인증 불필요)
  getBanners: publicProcedure
    .input(z.object({ branchId: z.number().optional() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const rows = await db
        .select()
        .from(kioskBanners)
        .where(eq(kioskBanners.isActive, 1))
        .orderBy(kioskBanners.sortOrder, kioskBanners.id);
      const filtered = input.branchId
        ? rows.filter((b) => b.branchId == null || b.branchId === input.branchId)
        : rows;
      // imageData가 있으면 서버 이미지 URL을 imageUrl로 반환 (imageData 자체는 제외)
      return filtered.map(({ imageData, ...b }) => ({
        ...b,
        imageUrl: imageData ? `/api/banner-image/${b.id}` : b.imageUrl,
      }));
    }),

  // 배너 전체 목록 (관리자용)
  getAllBanners: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const rows = await db.select().from(kioskBanners).orderBy(kioskBanners.sortOrder, kioskBanners.id);
    return rows.map(({ imageData, ...b }) => ({
      ...b,
      imageUrl: imageData ? `/api/banner-image/${b.id}` : b.imageUrl,
      hasUploadedImage: !!imageData,
    }));
  }),

  // 배너 생성
  createBanner: adminProcedure
    .input(z.object({
      title: z.string(),
      body: z.string().optional(),
      imageUrl: z.string().optional(),
      bgColor: z.string().default("#1a3a6e"),
      textColor: z.string().default("#ffffff"),
      sortOrder: z.number().default(0),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      textAlign: z.string().default("center"),
      textVAlign: z.string().default("center"),
      titleFontSize: z.number().default(22),
      bodyFontSize: z.number().default(15),
      branchId: z.number().nullable().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [banner] = await db.insert(kioskBanners).values({
        title: input.title,
        body: input.body,
        imageUrl: input.imageUrl,
        bgColor: input.bgColor,
        textColor: input.textColor,
        isActive: 1,
        sortOrder: input.sortOrder,
        startDate: input.startDate,
        endDate: input.endDate,
        textAlign: input.textAlign,
        textVAlign: input.textVAlign,
        titleFontSize: input.titleFontSize,
        bodyFontSize: input.bodyFontSize,
        branchId: input.branchId ?? null,
      }).returning();
      return banner;
    }),

  // 배너 이미지 업로드 (base64, 관리자용)
  uploadBannerImage: adminProcedure
    .input(z.object({ id: z.number(), imageData: z.string() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.update(kioskBanners).set({ imageData: input.imageData }).where(eq(kioskBanners.id, input.id));
      return { ok: true, imageUrl: `/api/banner-image/${input.id}` };
    }),

  // 배너 이미지 삭제 (imageData 제거, 관리자용)
  clearBannerImage: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.update(kioskBanners).set({ imageData: null }).where(eq(kioskBanners.id, input.id));
      return { ok: true };
    }),

  // 배너 수정
  updateBanner: adminProcedure
    .input(z.object({
      id: z.number(),
      title: z.string().optional(),
      body: z.string().optional(),
      imageUrl: z.string().optional().nullable(),
      bgColor: z.string().optional(),
      textColor: z.string().optional(),
      isActive: z.boolean().optional(),
      sortOrder: z.number().optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      textAlign: z.string().optional(),
      textVAlign: z.string().optional(),
      titleFontSize: z.number().optional(),
      bodyFontSize: z.number().optional(),
      branchId: z.number().nullable().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { id, isActive, ...rest } = input;
      const [updated] = await db.update(kioskBanners).set({
        ...rest,
        ...(isActive !== undefined ? { isActive: isActive ? 1 : 0 } : {}),
      }).where(eq(kioskBanners.id, id)).returning();
      return updated;
    }),

  // 배너 삭제
  deleteBanner: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.delete(kioskBanners).where(eq(kioskBanners.id, input.id));
      return { ok: true };
    }),

  // ─── 운동복 관리 ────────────────────────────────────────────────────────────

  getUniforms: protectedProcedure
    .input(z.object({ branchId: z.number().optional(), activeOnly: z.boolean().optional() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const rows = await db.select().from(uniforms).orderBy(desc(uniforms.createdAt));
      return rows.filter(r => {
        if (input.branchId && r.branchId !== input.branchId) return false;
        if (input.activeOnly && r.isActive !== 1) return false;
        return true;
      });
    }),

  createUniform: protectedProcedure
    .input(z.object({
      branchId: z.number().optional(),
      memberId: z.number().optional(),
      memberName: z.string().optional(),
      memberPhone: z.string().optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      memo: z.string().optional(),
      memberType: z.string().optional(),
      rentalType: z.string().optional(),
      isPaid: z.number().optional(),
      paymentAmount: z.number().optional(),
      paymentMethod: z.string().optional(),
      paymentDate: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.execute(sql`ALTER TABLE uniforms ADD COLUMN IF NOT EXISTS "paymentDate" TEXT`);
      const now = new Date().toISOString();

      // memberId 없는 신규 등록이면 members 테이블에 자동 생성
      let resolvedMemberId = input.memberId ?? null;
      if (!resolvedMemberId && input.memberName) {
        const [newMember] = await db.insert(members).values({
          name: input.memberName,
          phone: input.memberPhone ?? undefined,
          status: "active",
          grade: "basic",
          membershipStart: input.startDate ?? undefined,
          createdAt: now,
          updatedAt: now,
        }).returning({ id: members.id });
        resolvedMemberId = newMember?.id ?? null;
      } else if (resolvedMemberId) {
        // 기존 정지 회원 → 신규 구매 시 활성으로 전환
        await db.update(members).set({ status: "active", updatedAt: now })
          .where(and(eq(members.id, resolvedMemberId), eq(members.status, "paused")));
      }

      const [row] = await db.insert(uniforms).values({
        ...input,
        memberId: resolvedMemberId ?? undefined,
        isActive: 1, createdAt: now, updatedAt: now,
      }).returning();

      // 결제 대여 시 장부 자동 연동
      if (input.rentalType === "paid" && input.isPaid === 1 && input.paymentAmount && input.paymentAmount > 0) {
        const resolvedPaymentDate = input.paymentDate ?? now.substring(0, 10);
        await db.insert(revenueEntries).values({
          memberId: resolvedMemberId,
          trainerId: null,
          createdBy: ctx.user.id,
          customerName: input.memberName ?? null,
          phone: input.memberPhone ?? null,
          programDetail: "운동복",
          type: "기타",
          subType: "신규",
          amount: input.paymentAmount,
          discountAmount: 0,
          paidAmount: input.paymentAmount,
          unpaidAmount: 0,
          paymentMethod: input.paymentMethod ?? undefined,
          paymentDate: resolvedPaymentDate,
          startDate: input.startDate ?? null,
          memo: input.memo ?? null,
        });
      }

      return row;
    }),

  updateUniform: protectedProcedure
    .input(z.object({
      id: z.number(),
      memberName: z.string().optional(),
      memberPhone: z.string().optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      memo: z.string().optional(),
      memberType: z.string().optional(),
      rentalType: z.string().optional(),
      isPaid: z.number().optional(),
      paymentAmount: z.number().optional(),
      isActive: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { id, ...data } = input;
      const [row] = await db.update(uniforms).set({ ...data, updatedAt: new Date().toISOString() }).where(eq(uniforms.id, id)).returning();
      return row;
    }),

  deleteUniform: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.delete(uniforms).where(eq(uniforms.id, input.id));
      return { ok: true };
    }),

  // 회원별 프로그램 조회 (락커·운동복·헬스권)
  getMemberPrograms: protectedProcedure
    .input(z.object({ memberId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const memberName = await pool.query<{ name: string }>(
        `SELECT name FROM members WHERE id = $1 LIMIT 1`,
        [input.memberId]
      ).then(r => r.rows[0]?.name ?? null);

      const [memberLockers, memberUniforms, healthRevenues] = await Promise.all([
        pool.query(
          `SELECT * FROM lockers
           WHERE "memberId" = $1
              OR ("memberName" IS NOT NULL AND "memberName" = $2)
           ORDER BY "createdAt" ASC`,
          [input.memberId, memberName]
        ).then(r => r.rows as (typeof lockers.$inferSelect)[]),
        db.select().from(uniforms).where(eq(uniforms.memberId, input.memberId)),
        pool.query(
          `SELECT r.id, r.type, r."subType", r.amount, r."paidAmount", r."unpaidAmount", r."paymentDate",
                  r.memo, r."programDetail", r."startDate", r."serviceSessions",
                  r."serviceHealthDuration", r."createdAt", r."serviceItems", r.duration,
                  r."memberId", r."customerName", COALESCE(r."pauseDays", 0) AS "pauseDays",
                  CASE WHEN r."startDate" IS NOT NULL AND r.duration IS NOT NULL AND r.duration > 0
                       THEN (r."startDate"::date + (r.duration || ' months')::interval + (COALESCE(r."pauseDays", 0) || ' days')::interval)::date::text
                       ELSE NULL
                  END AS "endDate"
           FROM revenue_entries r
           WHERE r."memberId" = $1
              OR (r."customerName" IS NOT NULL AND r."customerName" = (SELECT name FROM members WHERE id = $1 LIMIT 1))
           ORDER BY r."createdAt" DESC`,
          [input.memberId]
        ).then(result => {
          console.log(`[getMemberPrograms] memberId=${input.memberId} → ${result.rows.length}건`);
          return result;
        }).catch(err => {
          console.error(`[getMemberPrograms ERROR] memberId=${input.memberId}:`, err.message);
          return { rows: [] as any[] };
        }),
      ]);
      return {
        lockers: memberLockers,
        uniforms: memberUniforms,
        healthRevenues: healthRevenues.rows as Array<{
          id: number; type: string; subType: string; amount: number;
          paidAmount: number; unpaidAmount: number; paymentDate: string;
          memo: string | null; programDetail: string | null;
          startDate: string | null; endDate: string | null;
          serviceSessions: number | null; serviceHealthDuration: number | null;
          createdAt: string; serviceItems: string | null; duration: number | null;
        }>,
      };
    }),

  // 활성 헬스 회원권 목록 (서비스 관리 - 헬스권 탭)
  getActiveMemberships: protectedProcedure
    .query(async () => {
      const today = kstDate();
      const result = await pool.query(
        `SELECT id, name, phone, "membershipStart", "membershipEnd"
         FROM members
         WHERE status = 'active' AND "membershipEnd" IS NOT NULL AND "membershipEnd" >= $1
         ORDER BY "membershipEnd" ASC`,
        [today]
      );
      return result.rows as Array<{
        id: number; name: string; phone: string | null;
        membershipStart: string | null; membershipEnd: string | null;
      }>;
    }),

  // 활성 PT 패키지 목록 (서비스 관리 - PT권 탭)
  getActivePtPackages: protectedProcedure
    .query(async () => {
      const today = kstDate();
      const result = await pool.query(
        `SELECT p.id, p."memberId", m.name as "memberName", m.phone as "memberPhone",
                p."packageName", p."totalSessions", p."usedSessions",
                p."startDate", p."expiryDate", p.status, p."paymentAmount"
         FROM pt_packages p
         JOIN members m ON m.id = p."memberId"
         WHERE p.status = 'active' AND (p."expiryDate" IS NULL OR p."expiryDate" >= $1)
         ORDER BY p."expiryDate" ASC NULLS LAST`,
        [today]
      );
      return result.rows as Array<{
        id: number; memberId: number; memberName: string; memberPhone: string | null;
        packageName: string | null; totalSessions: number; usedSessions: number;
        startDate: string | null; expiryDate: string | null; status: string;
        paymentAmount: number | null;
      }>;
    }),

  // 서비스 락커 (rentalType = 'service', 현재 점유 중)
  getServiceLockers: protectedProcedure
    .query(async () => {
      const today = kstDate();
      const result = await pool.query(
        `SELECT id, "lockerNumber", "lockerType", "memberId", "memberName", "memberPhone",
                "startDate", "endDate", memo, "branchId", "categoryId"
         FROM lockers
         WHERE "isOccupied" = 1
           AND ("rentalType" = 'service' OR "rentalType" IS NULL)
           AND ("endDate" IS NULL OR "endDate" >= $1)
         ORDER BY "endDate" ASC NULLS LAST`,
        [today]
      );
      return result.rows as Array<{
        id: number; lockerNumber: string; lockerType: string;
        memberId: number | null; memberName: string | null; memberPhone: string | null;
        startDate: string | null; endDate: string | null; memo: string | null;
        branchId: number | null; categoryId: number | null;
      }>;
    }),

  // 서비스 헬스권 (PT 등록 시 서비스로 제공된 헬스 기간, serviceHealthDuration > 0)
  getServiceHealthMemberships: protectedProcedure
    .query(async () => {
      const today = kstDate();
      const result = await pool.query(
        `SELECT r.id, r."memberId", r."customerName" as "memberName", r.phone as "memberPhone",
                r."startDate", r."serviceHealthDuration",
                (r."startDate"::date + (r."serviceHealthDuration" || ' days')::interval)::date AS "endDate"
         FROM revenue_entries r
         WHERE r."serviceHealthDuration" > 0
           AND r.type = 'PT'
           AND r."startDate" IS NOT NULL
           AND (r."startDate"::date + (r."serviceHealthDuration" || ' months')::interval)::date >= $1::date
         ORDER BY (r."startDate"::date + (r."serviceHealthDuration" || ' months')::interval)::date ASC`,
        [today]
      );
      return result.rows as Array<{
        id: number; memberId: number | null; memberName: string | null; memberPhone: string | null;
        startDate: string; serviceHealthDuration: number; endDate: string;
      }>;
    }),

  // 관리자용 전체 회원 통계
  getAdminMemberStats: protectedProcedure
    .query(async () => {
      const today = kstDate();
      const in30 = kstDate(30);
      const result = await pool.query(`
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE status = 'active')::int AS active,
          COUNT(*) FILTER (WHERE status != 'active')::int AS inactive,
          COUNT(*) FILTER (WHERE status = 'active' AND "membershipEnd" >= $1 AND "membershipEnd" <= $2)::int AS expiring30,
          COUNT(*) FILTER (WHERE status = 'active' AND "membershipEnd" < $1)::int AS expired_but_active,
          (SELECT COUNT(*)::int FROM pt_packages WHERE status = 'active') AS active_pt_packages,
          (SELECT COALESCE(SUM("unpaidAmount"),0)::int FROM pt_packages WHERE "unpaidAmount" > 0) AS total_unpaid,
          COUNT(*) FILTER (WHERE gender = '남')::int AS male,
          COUNT(*) FILTER (WHERE gender = '여')::int AS female
        FROM members
      `, [today, in30]);
      return result.rows[0] as {
        total: number; active: number; inactive: number; expiring30: number;
        expired_but_active: number; active_pt_packages: number; total_unpaid: number;
        male: number; female: number;
      };
    }),

  // 관리자용 만료 임박 회원 목록 (N일 이내 또는 특정 월)
  getAdminExpiringMembers: protectedProcedure
    .input(z.object({ days: z.number().default(30), month: z.string().optional() }))
    .query(async ({ input }) => {
      try {
        let today: string, future: string;
        if (input.month) {
          const [y, m] = input.month.split("-").map(Number);
          today = `${input.month}-01`;
          future = `${input.month}-${String(new Date(y, m, 0).getDate()).padStart(2, "0")}`;
        } else {
          today = kstDate();
          future = kstDate(input.days);
        }
        const result = await pool.query(
          `SELECT m.id, m.name, m.phone, m."membershipEnd",
                  t."trainerName",
                  (m."membershipEnd"::date - $3::date)::int AS days_left,
                  r.type AS rev_type,
                  r.duration AS rev_duration,
                  r."paidAmount" AS rev_paid,
                  r."programDetail" AS rev_program,
                  r."serviceHealthDuration" AS rev_svc_health
           FROM members m
           LEFT JOIN trainers t ON t.id = m."trainerId"
           LEFT JOIN LATERAL (
             SELECT type, duration, "paidAmount", "programDetail", "serviceHealthDuration"
             FROM revenue_entries
             WHERE "memberId" = m.id
             ORDER BY "paymentDate" DESC, id DESC
             LIMIT 1
           ) r ON true
           WHERE m.status = 'active'
             AND m."membershipEnd" IS NOT NULL
             AND m."membershipEnd" >= $1
             AND m."membershipEnd" <= $2
           ORDER BY m."membershipEnd" ASC`,
          [today, future, today]
        );
        return result.rows as Array<{
          id: number; name: string; phone: string | null; membershipEnd: string;
          trainerName: string | null; days_left: number;
          rev_type: string | null; rev_duration: number | null;
          rev_paid: number | null; rev_program: string | null;
          rev_svc_health: number | null;
        }>;
      } catch (err) {
        console.error("[getAdminExpiringMembers] error:", err);
        throw err;
      }
    }),

  // 시간대별 방문 통계 (이번달 access_logs 기준)
  getAccessHourStats: protectedProcedure
    .query(async () => {
      const prefix = kstMonthPrefix(); // YYYY-MM (KST)
      const result = await pool.query(
        `SELECT
           EXTRACT(HOUR FROM "accessedAt"::timestamptz)::int AS hour,
           COUNT(*)::int AS count
         FROM access_logs
         WHERE "accessedAt" LIKE $1
           AND "accessResult" = 'allowed'
         GROUP BY hour
         ORDER BY hour`,
        [`${prefix}%`]
      );
      return result.rows as Array<{ hour: number; count: number }>;
    }),

  getOpsVisitDashboard: protectedProcedure
    .input(z.object({ branchId: z.number().optional(), month: z.string().optional() }).optional())
    .query(async ({ input }) => {
      const branchId = input?.branchId ?? null;
      const curPrefix = input?.month ?? kstMonthPrefix();
      const today = kstDate();
      const [cy, cm] = curPrefix.split("-").map(Number);
      const daysInMonth = new Date(cy, cm, 0).getDate();
      const monthStart = `${curPrefix}-01`;
      const monthEnd = `${curPrefix}-${String(daysInMonth).padStart(2, "0")}T23:59:59`;
      const isCurrentMonth = curPrefix === kstMonthPrefix();
      const elapsedDays = isCurrentMonth ? parseInt(today.substring(8, 10), 10) : daysInMonth;
      const refEnd = isCurrentMonth ? `${today}T23:59:59` : monthEnd;
      const d7Start = new Date(cy, cm - 1, elapsedDays - 6).toISOString().substring(0, 10);
      const d14Start = new Date(cy, cm - 1, elapsedDays - 13).toISOString().substring(0, 10);
      const d30Start = new Date(cy, cm - 1, elapsedDays - 29).toISOString().substring(0, 10);

      const prevPrefix = cm === 1 ? `${cy - 1}-12` : `${cy}-${String(cm - 1).padStart(2, "0")}`;

      const bCond = branchId ? `AND "branchId" = ${Number(branchId)}` : "";
      const mBCond = branchId ? `AND m."branchId" = ${Number(branchId)}` : "";

      const [
        dailyRes, prevRes, hourlyRes, dailyHourlyRes, dowRes,
        activeRes, v7Res, v14Res, v30Res, freqRes,
      ] = await Promise.all([
        pool.query(
          `SELECT TO_CHAR("accessedAt"::timestamptz AT TIME ZONE 'Asia/Seoul','YYYY-MM-DD') AS day,
                  COUNT(*)::int AS count
           FROM access_logs WHERE "accessedAt" LIKE $1 AND "accessResult"='allowed' ${bCond}
           GROUP BY day ORDER BY day`,
          [`${curPrefix}%`]
        ),
        pool.query(
          `SELECT COUNT(*)::int AS count FROM access_logs
           WHERE "accessedAt" LIKE $1 AND "accessResult"='allowed' ${bCond}`,
          [`${prevPrefix}%`]
        ),
        pool.query(
          `SELECT EXTRACT(HOUR FROM ("accessedAt"::timestamptz AT TIME ZONE 'Asia/Seoul'))::int AS hour,
                  COUNT(*)::int AS count
           FROM access_logs WHERE "accessedAt" LIKE $1 AND "accessResult"='allowed' ${bCond}
           GROUP BY hour ORDER BY hour`,
          [`${curPrefix}%`]
        ),
        pool.query(
          `SELECT TO_CHAR("accessedAt"::timestamptz AT TIME ZONE 'Asia/Seoul','YYYY-MM-DD') AS day,
                  EXTRACT(HOUR FROM ("accessedAt"::timestamptz AT TIME ZONE 'Asia/Seoul'))::int AS hour,
                  COUNT(*)::int AS count
           FROM access_logs WHERE "accessedAt" LIKE $1 AND "accessResult"='allowed' ${bCond}
           GROUP BY day, hour`,
          [`${curPrefix}%`]
        ),
        pool.query(
          `SELECT EXTRACT(ISODOW FROM ("accessedAt"::timestamptz AT TIME ZONE 'Asia/Seoul'))::int AS dow,
                  COUNT(*)::int AS count
           FROM access_logs WHERE "accessedAt" LIKE $1 AND "accessResult"='allowed' ${bCond}
           GROUP BY dow ORDER BY dow`,
          [`${curPrefix}%`]
        ),
        pool.query(
          `SELECT COUNT(*)::int AS count FROM members WHERE status='active' ${branchId ? `AND "branchId"=${Number(branchId)}` : ""}`
        ),
        pool.query(
          `SELECT COUNT(DISTINCT "memberId")::int AS count FROM access_logs
           WHERE "accessedAt">=$1 AND "accessedAt"<=$2 AND "accessResult"='allowed' AND "memberId" IS NOT NULL ${bCond}`,
          [d7Start, refEnd]
        ),
        pool.query(
          `SELECT COUNT(DISTINCT "memberId")::int AS count FROM access_logs
           WHERE "accessedAt">=$1 AND "accessedAt"<=$2 AND "accessResult"='allowed' AND "memberId" IS NOT NULL ${bCond}`,
          [d14Start, refEnd]
        ),
        pool.query(
          `SELECT COUNT(DISTINCT "memberId")::int AS count FROM access_logs
           WHERE "accessedAt">=$1 AND "accessedAt"<=$2 AND "accessResult"='allowed' AND "memberId" IS NOT NULL ${bCond}`,
          [d30Start, refEnd]
        ),
        pool.query(
          `SELECT COUNT(a.id)::int AS visits
           FROM members m
           LEFT JOIN access_logs a ON a."memberId"=m.id
             AND a."accessedAt">=$1 AND a."accessedAt"<=$2 AND a."accessResult"='allowed' ${bCond.replace(/"branchId"/, 'a."branchId"')}
           WHERE m.status='active' ${branchId ? `AND m."branchId"=${Number(branchId)}` : ""}
           GROUP BY m.id`,
          [d30Start, refEnd]
        ),
      ]);

      return {
        dailyVisits: dailyRes.rows as Array<{ day: string; count: number }>,
        prevMonthTotal: (prevRes.rows[0]?.count ?? 0) as number,
        hourlyVisits: hourlyRes.rows as Array<{ hour: number; count: number }>,
        dailyHourly: dailyHourlyRes.rows as Array<{ day: string; hour: number; count: number }>,
        dowVisits: dowRes.rows as Array<{ dow: number; count: number }>,
        activeCount: (activeRes.rows[0]?.count ?? 0) as number,
        visited7: (v7Res.rows[0]?.count ?? 0) as number,
        visited14: (v14Res.rows[0]?.count ?? 0) as number,
        visited30: (v30Res.rows[0]?.count ?? 0) as number,
        memberFrequency: freqRes.rows as Array<{ visits: number }>,
        currentMonth: curPrefix,
        today,
      };
    }),

  getUtilizationMembers: protectedProcedure
    .input(z.object({
      type: z.enum(["visited7", "visited14", "visited30", "notVisited14", "notVisited30"]),
      branchId: z.number().optional(),
      month: z.string().optional(),
    }))
    .query(async ({ input }) => {
      const curPrefix = input.month ?? kstMonthPrefix();
      const today = kstDate();
      const [cy, cm] = curPrefix.split("-").map(Number);
      const daysInMonth = new Date(cy, cm, 0).getDate();
      const isCurrentMonth = curPrefix === kstMonthPrefix();
      const elapsedDays = isCurrentMonth ? parseInt(today.substring(8, 10), 10) : daysInMonth;
      const refEnd = isCurrentMonth ? `${today}T23:59:59` : `${curPrefix}-${String(daysInMonth).padStart(2, "0")}T23:59:59`;

      const daysMap: Record<string, number> = { visited7: 7, visited14: 14, visited30: 30, notVisited14: 14, notVisited30: 30 };
      const n = daysMap[input.type];
      const startDate = new Date(cy, cm - 1, elapsedDays - (n - 1)).toISOString().substring(0, 10);

      const branchId = input.branchId ?? null;
      const bCond = branchId ? `AND a."branchId" = ${Number(branchId)}` : "";
      const mBCond = branchId ? `AND m."branchId" = ${Number(branchId)}` : "";

      if (input.type.startsWith("visited")) {
        const result = await pool.query(
          `SELECT m.id, m.name, m.phone, MAX(a."accessedAt") AS last_visit
           FROM access_logs a
           JOIN members m ON m.id = a."memberId"
           WHERE a."accessedAt">=$1 AND a."accessedAt"<=$2
             AND a."accessResult"='allowed' AND m.status='active' ${mBCond} ${bCond}
           GROUP BY m.id, m.name, m.phone
           ORDER BY m.name`,
          [startDate, refEnd]
        );
        return result.rows as Array<{ id: number; name: string; phone: string | null; last_visit: string | null }>;
      } else {
        const result = await pool.query(
          `SELECT m.id, m.name, m.phone,
             (SELECT MAX("accessedAt") FROM access_logs WHERE "memberId"=m.id AND "accessResult"='allowed') AS last_visit
           FROM members m
           WHERE m.status='active' ${mBCond}
             AND m.id NOT IN (
               SELECT DISTINCT "memberId" FROM access_logs
               WHERE "accessedAt">=$1 AND "accessedAt"<=$2
                 AND "accessResult"='allowed' AND "memberId" IS NOT NULL ${bCond}
             )
           ORDER BY last_visit ASC NULLS FIRST`,
          [startDate, refEnd]
        );
        return result.rows as Array<{ id: number; name: string; phone: string | null; last_visit: string | null }>;
      }
    }),
});
