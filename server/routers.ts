import { gymRouter } from "./gymRouters";
import { accessRouter } from "./accessRouter";
import { transferRouter } from "./transferRouter";
import { consultantRecordsRouter } from "./consultantRecordsRouter";
import { consultantDataRouter } from "./consultantDataRouter";
import { dataHealthRouter } from "./dataHealthRouter";
import { initTRPC, TRPCError } from "@trpc/server";
import { z } from "zod";
import { eq, and, or, desc, asc, sql, lte, gte, gt, isNull, inArray } from "drizzle-orm";
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
  revenueEntries,
  lockers,
  uniforms,
  ptEventPrograms,
  leads,
  channels,
} from "../drizzle/schema";
import { randomUUID } from "crypto";
import { sheetUrlToCsvUrl, parseCSV, syncSheetNow, fetchSheetCsv } from "./sheetSync";
import { sendDailyBriefing, sendWeeklyBriefing, sendMonthlyBriefing } from "./notionBriefing";
import {
  sheetSyncConfig,
  sheetPendingMembers,
  trainingManuals,
  gymPlusMembers,
  gymPlusVideoCategories,
  gymPlusVideos,
  gymPlusEvents,
  gymPlusWorkoutLogs,
  gymPlusMessages,
  gymPlusPushSubscriptions,
  gymPlusMembershipRenewals,
  gymPlusRegistrationRequests,
  bodyAnalysisReservations,
} from "../drizzle/schema";
import webpush from "web-push";

const VAPID_PUBLIC = "BK_eYZuRk27SeTqaVTc1Ui5eK8fYjm_6CfLZfQK4L8eqhnqxhqA38lplk5Ez4064IN_3ag-kSTQkLxiuRn91-8E";
const VAPID_PRIVATE = "Q-8EMtpbLdJf3VQqrfE4A8ZyBrtvVxfw4dp9h_31Ahc";

webpush.setVapidDetails("mailto:admin@ziantgym.com", VAPID_PUBLIC, VAPID_PRIVATE);
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

// 전화번호를 숫자만 비교(하이픈/공백 유무 무관)해 회원 중복확인이 놓치지 않도록 한다.
// (gymRouters.ts의 samePhone과 동일한 목적 — 표기만 다른 같은 회원을 다른 사람으로 오인해
// 중복 회원이 생기는 사고 방지)
function samePhone(col: any, phone: string) {
  return sql`REGEXP_REPLACE(COALESCE(${col}, ''), '[^0-9]', '', 'g') = REGEXP_REPLACE(${phone}, '[^0-9]', '', 'g')`;
}

// KST(UTC+9) 기준 날짜 문자열(YYYY-MM-DD). UTC 기준으로 계산하면 한국 오전(00~09시)에
// 만료/이탈 판정이 하루 밀리는 문제가 생긴다.
function kstDate(offsetDays = 0): string {
  return new Date(Date.now() + 9 * 3600000 + offsetDays * 86400000).toISOString().substring(0, 10);
}

// 트레이너의 "담당 회원"은 PT 회원만이다. 헬스권/락커/운동복만 있는 회원은 담당 트레이너
// 개념이 없으므로(일반 회원관리에서만 관리) 트레이너 화면 목록에서 제외한다.
// PT 이력이 한 번이라도 있으면(완료된 패키지 포함) 담당 회원으로 본다.
const hasPtPackage = sql`EXISTS (SELECT 1 FROM pt_packages p WHERE p."memberId" = ${members.id})`;

// 카드/현금영수증/지역화폐는 부가세 10% 제외, 계좌이체/이체는 그대로, 혼합은 이체분+카드분(VAT제외) 합산
function calcPricePerSession(paymentAmount: number | undefined, sessions: number | undefined, paymentMethod?: string, transferAmount?: number, cardAmount?: number): number | undefined {
  if (!paymentAmount || !sessions || sessions <= 0) return undefined;
  if (paymentMethod === "혼합" && transferAmount != null && cardAmount != null) {
    const base = transferAmount + Math.round(cardAmount / 1.1);
    return Math.round(base / sessions);
  }
  const base = (paymentMethod === "이체" || paymentMethod === "계좌이체") ? paymentAmount : Math.round(paymentAmount / 1.1);
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

    const { role, trainerId } = ctx.user;
    if (role === "trainer" && !trainerId) throw new TRPCError({ code: "FORBIDDEN" });

    // 운동복 매출 중 memberId 없는 것 소급 처리 (운동복 대여 등 구형 포함)
    const orphanUniforms = await db.select().from(revenueEntries)
      .where(and(sql`${revenueEntries.programDetail} LIKE '%운동복%'`, isNull(revenueEntries.memberId)));
    for (const entry of orphanUniforms) {
      if (!entry.customerName) continue;
      const now = new Date().toISOString();
      // 같은 이름 기존 회원 먼저 탐색
      const existing = await pool.query(
        `SELECT id FROM members WHERE name = $1 ORDER BY "createdAt" DESC LIMIT 1`,
        [entry.customerName]
      );
      let targetMemberId: number | null = null;
      if (existing.rows.length > 0) {
        targetMemberId = existing.rows[0].id;
        // 정지 회원이면 활성으로 전환
        await db.update(members).set({ status: "active", updatedAt: now }).where(and(eq(members.id, targetMemberId!), or(eq(members.status, "paused"), eq(members.status, "inactive"))));
      } else {
        const [newMember] = await db.insert(members).values({
          name: entry.customerName,
          phone: entry.phone ?? undefined,
          status: "active",
          grade: "basic",
          membershipStart: entry.startDate ?? undefined,
          createdAt: now,
          updatedAt: now,
        }).returning({ id: members.id });
        targetMemberId = newMember?.id ?? null;
      }
      if (targetMemberId) {
        await db.update(revenueEntries).set({ memberId: targetMemberId }).where(eq(revenueEntries.id, entry.id));
        await db.execute(sql`UPDATE uniforms SET "memberId" = ${targetMemberId} WHERE "memberName" = ${entry.customerName} AND "memberId" IS NULL`);
      }
    }

    // 운동복 구매로 연결된 정지 회원도 활성으로 전환
    await pool.query(`
      UPDATE members m SET status = 'active', "updatedAt" = NOW()::text
      WHERE m.status IN ('paused', 'inactive')
        AND EXISTS (
          SELECT 1 FROM revenue_entries r
          WHERE r."memberId" = m.id
            AND r."programDetail" LIKE '%운동복%'
            AND r."subType" = '신규'
        )
    `);

    const whereClause = undefined; // 트레이너·컨설턴트 모두 전체 회원 공유

    // 회원 + 서비스 데이터를 병렬 조회해 통합 반환
    const [memberRows, lockerRows, serviceRevs] = await Promise.all([
      db.select().from(members).where(whereClause).orderBy(desc(members.createdAt)),
      db.select({ memberId: lockers.memberId, lockerNumber: lockers.lockerNumber })
        .from(lockers).where(sql`${lockers.memberId} IS NOT NULL`),
      db.select({ memberId: revenueEntries.memberId, programDetail: revenueEntries.programDetail, serviceItems: revenueEntries.serviceItems })
        .from(revenueEntries).where(sql`${revenueEntries.memberId} IS NOT NULL`),
    ]);

    const lockerMap = new Map<number, string>();
    for (const l of lockerRows) {
      if (l.memberId) lockerMap.set(l.memberId, l.lockerNumber ?? "");
    }
    const uniformSet = new Set<number>();
    for (const e of serviceRevs) {
      if (!e.memberId) continue;
      const d = (e.programDetail ?? "").toLowerCase();
      const si = (e.serviceItems ?? "").toLowerCase();
      if (d.includes("운동복") || d.includes("유니폼") || d.includes("uniform") || si.includes("운동복")) {
        uniformSet.add(e.memberId);
      }
      if (si.includes("락커") && !lockerMap.has(e.memberId)) {
        const match = (e.serviceItems ?? "").match(/락커\(([^)]+)\)/);
        lockerMap.set(e.memberId, match ? match[1] : "서비스");
      }
    }

    return memberRows.map(m => ({
      ...m,
      lockerNumber: lockerMap.get(m.id) ?? null,
      hasUniform: uniformSet.has(m.id),
    }));
  }),

  listAll: protectedProcedure
    .input(z.object({ branchId: z.number().optional() }).optional())
    .query(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    if (ctx.user.role !== "admin" && ctx.user.role !== "sub_admin")
      throw new TRPCError({ code: "FORBIDDEN" });

    // 기존 헬스 매출 중 memberId 없는 것 → 기존 회원 연결 (중복 생성 방지)
    const orphanHealth = await db.select().from(revenueEntries)
      .where(and(eq(revenueEntries.type, "헬스"), isNull(revenueEntries.memberId)));
    for (const entry of orphanHealth) {
      if (!entry.customerName) continue;
      const cond = entry.phone
        ? and(eq(members.name, entry.customerName), samePhone(members.phone, entry.phone))
        : eq(members.name, entry.customerName);
      const existing = await db.select({ id: members.id }).from(members).where(cond)
        .orderBy(sql`"membershipEnd" DESC NULLS LAST`).limit(1);
      if (existing[0]) {
        await db.update(revenueEntries).set({ memberId: existing[0].id }).where(eq(revenueEntries.id, entry.id));
      } else {
        const now = new Date().toISOString();
        let membershipEnd: string | undefined;
        if (entry.startDate && entry.duration) {
          const end = new Date(entry.startDate);
          end.setMonth(end.getMonth() + entry.duration);
          membershipEnd = end.toISOString().substring(0, 10);
        }
        const [newMember] = await db.insert(members).values({
          trainerId: entry.trainerId ?? null,
          branchId: entry.branchId ?? null,
          name: entry.customerName,
          phone: entry.phone ?? undefined,
          status: "active",
          grade: "basic",
          membershipStart: entry.startDate ?? undefined,
          membershipEnd: membershipEnd ?? undefined,
          createdAt: now,
          updatedAt: now,
        }).returning({ id: members.id });
        if (newMember) {
          await db.update(revenueEntries).set({ memberId: newMember.id }).where(eq(revenueEntries.id, entry.id));
        }
      }
    }

    const whereClause = input?.branchId ? eq(members.branchId, input.branchId) : undefined;

    const [rows, pkgs, ptRevs, lockerRows, etcRevs] = await Promise.all([
      db.select({
        id: members.id,
        name: members.name,
        phone: members.phone,
        status: members.status,
        grade: members.grade,
        gender: members.gender,
        birthDate: members.birthDate,
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
        id: ptPackages.id,
        memberId: ptPackages.memberId,
        packageName: ptPackages.packageName,
        totalSessions: ptPackages.totalSessions,
        usedSessions: ptPackages.usedSessions,
        trainerId: ptPackages.trainerId,
      }).from(ptPackages),
      db.select({ memberId: revenueEntries.memberId }).from(revenueEntries)
        .where(and(eq(revenueEntries.type, "PT"), sql`${revenueEntries.memberId} IS NOT NULL`)),
      db.select({ memberId: lockers.memberId, lockerNumber: lockers.lockerNumber }).from(lockers)
        .where(sql`${lockers.memberId} IS NOT NULL`),
      db.select({ memberId: revenueEntries.memberId, programDetail: revenueEntries.programDetail, serviceItems: revenueEntries.serviceItems }).from(revenueEntries)
        .where(sql`${revenueEntries.memberId} IS NOT NULL`),
    ]);

    const pkgMap = new Map<number, { id: number; packageName: string; totalSessions: number; usedSessions: number }[]>();
    const pkgTrainerMap = new Map<number, number>();
    for (const p of pkgs) {
      if (!pkgMap.has(p.memberId)) pkgMap.set(p.memberId, []);
      pkgMap.get(p.memberId)!.push({ id: p.id, packageName: p.packageName ?? "", totalSessions: p.totalSessions, usedSessions: p.usedSessions });
      if (p.trainerId && !pkgTrainerMap.has(p.memberId)) pkgTrainerMap.set(p.memberId, p.trainerId);
    }
    const ptRevSet = new Set(ptRevs.map((r) => r.memberId).filter(Boolean) as number[]);

    // 락커 배정 map (lockers 테이블 + serviceItems)
    const lockerMap = new Map<number, string>();
    for (const l of lockerRows) {
      if (l.memberId) lockerMap.set(l.memberId, l.lockerNumber ?? "");
    }
    // 운동복 대여 여부 (programDetail + serviceItems 모두 체크)
    const uniformSet = new Set<number>();
    for (const e of etcRevs) {
      if (!e.memberId) continue;
      const d = (e.programDetail ?? "").toLowerCase();
      const si = (e.serviceItems ?? "").toLowerCase();
      if (d.includes("운동복") || d.includes("유니폼") || d.includes("uniform") || si.includes("운동복")) {
        uniformSet.add(e.memberId);
      }
      // serviceItems에 락커 포함 시 lockerMap에도 추가
      if (si.includes("락커") && !lockerMap.has(e.memberId)) {
        const match = (e.serviceItems ?? "").match(/락커\(([^)]+)\)/);
        lockerMap.set(e.memberId, match ? match[1] : "서비스");
      }
    }

    // PT 패키지 트레이너 ID → 이름 변환
    const ptTrainerIds = Array.from(new Set(pkgTrainerMap.values()));
    const ptTrainerNameMap = new Map<number, string>();
    if (ptTrainerIds.length > 0) {
      const ptTrainerRows = await db.select({ id: trainers.id, trainerName: trainers.trainerName })
        .from(trainers).where(sql`${trainers.id} = ANY(ARRAY[${sql.join(ptTrainerIds.map(id => sql`${id}`), sql`, `)}]::int[])`);
      for (const t of ptTrainerRows) ptTrainerNameMap.set(t.id, t.trainerName);
    }

    return rows.map((r) => {
      const ptTid = pkgTrainerMap.get(r.id);
      const ptTrainerName = ptTid ? (ptTrainerNameMap.get(ptTid) ?? null) : null;
      return {
        ...r,
        trainerName: ptTrainerName ?? r.trainerName,
        packages: pkgMap.get(r.id) ?? [],
        hasPtRevenue: ptRevSet.has(r.id),
        lockerNumber: lockerMap.get(r.id) ?? null,
        hasUniform: uniformSet.has(r.id),
      };
    });
  }),

  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [result, lockerRows, serviceRevs, uniformRows] = await Promise.all([
        db.select().from(members).where(eq(members.id, input.id)).limit(1),
        db.select({ memberId: lockers.memberId, lockerNumber: lockers.lockerNumber })
          .from(lockers).where(and(eq(lockers.memberId, input.id), sql`${lockers.memberId} IS NOT NULL`)),
        db.select({ memberId: revenueEntries.memberId, programDetail: revenueEntries.programDetail, serviceItems: revenueEntries.serviceItems })
          .from(revenueEntries).where(eq(revenueEntries.memberId, input.id)),
        db.select({ id: uniforms.id }).from(uniforms).where(eq(uniforms.memberId, input.id)).limit(1),
      ]);
      if (!result[0]) throw new TRPCError({ code: "NOT_FOUND" });

      // 락커 번호 (lockers 테이블 또는 serviceItems)
      let lockerNumber: string | null = lockerRows[0]?.lockerNumber ?? null;
      let hasUniform = uniformRows.length > 0;
      for (const e of serviceRevs) {
        const si = (e.serviceItems ?? "").toLowerCase();
        const d = (e.programDetail ?? "").toLowerCase();
        if (d.includes("운동복") || d.includes("유니폼") || d.includes("uniform") || si.includes("운동복")) {
          hasUniform = true;
        }
        if (!lockerNumber && si.includes("락커")) {
          const match = (e.serviceItems ?? "").match(/락커\(([^)]+)\)/);
          lockerNumber = match ? match[1] : "서비스";
        }
      }

      // 상담 담당자 이름 조회 (trainers.trainerName 우선)
      let consultantName: string | null = null;
      if (result[0].consultantId) {
        const [c] = await db.select({ trainerName: trainers.trainerName }).from(trainers).where(eq(trainers.userId, result[0].consultantId)).limit(1);
        consultantName = c?.trainerName ?? null;
      }

      return { ...result[0], lockerNumber, hasUniform, consultantName };
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
        status: z.enum(["active", "paused", "inactive"]).default("active"),
        membershipStart: z.string().optional(),
        membershipEnd: z.string().optional(),
        profileNote: z.string().optional(),
        visitRoute: z.string().optional(),
        ptProgram: z.string().optional(),
        ptSessions: z.string().optional(),
        serviceSessions: z.number().min(0).default(0).optional(),
        serviceSessionPrice: z.number().min(0).optional(),
        serviceSamePrice: z.number().optional(),
        eventId: z.number().optional(),   // 적용 이벤트 (성과 추적)
        paymentAmount: z.number().optional(),
        discountAmount: z.number().optional(),
        unpaidAmount: z.number().optional(),
        paymentMethod: z.enum(["카드", "현금", "현금영수증", "계좌이체", "이체", "지역화폐", "분할결제", "혼합"]).optional(),
        paymentDate: z.string().optional(),
        paymentMemo: z.string().optional(),
        adminTrainerId: z.number().optional(),
        branchId: z.number().optional(),
        primaryType: z.enum(["PT", "헬스", "다이어트", "기타"]).optional(),
        subType: z.enum(["신규", "재등록"]).default("신규"),
        signatureDataUrl: z.string().optional(),
        serviceItems: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // 담당 트레이너(trainerId) 결정.
      // ⚠ 상담 담당자 ≠ 담당 트레이너 (CLAUDE.md 데이터 무결성 원칙 6).
      // 폼에서 고른 트레이너가 항상 우선한다. 로그인한 사람이 트레이너라는 이유로 본인을
      // 담당으로 박으면, 상담만 진행한 트레이너의 회원 목록에 남의 회원이 들어간다.
      // PT 세션이 없는 등록(헬스/기타)은 담당 트레이너 개념이 없으므로 비워 둔다.
      const hasPtSessions = !!input.ptSessions && parseInt(String(input.ptSessions)) > 0;
      let trainerId: number | null = input.adminTrainerId ?? null;
      if (!trainerId && hasPtSessions && ctx.user.role === "trainer") {
        trainerId = ctx.user.trainerId ?? null;
      }
      if (!hasPtSessions) trainerId = null;

      const {
        ptProgram,
        ptSessions,
        serviceSessions,
        serviceSessionPrice,
        serviceSamePrice,
        eventId,
        paymentAmount,
        discountAmount: inputDiscountAmount,
        unpaidAmount,
        paymentMethod,
        paymentDate,
        paymentMemo,
        adminTrainerId: _,
        subType,
        serviceItems,
        ...memberData
      } = input;

      // 이름+전화번호(숫자만 비교) 일치하는 기존 회원이 있으면 새로 만들지 않고 재사용한다.
      // 이 중복확인이 없어서, 같은 회원이 "신규 회원 등록"과 "재등록" 화면을 각각 거치면
      // 서로 다른 memberId로 갈라져 매출에 동일 인물이 두 번(신규+재등록) 잡히는 사고가 있었다.
      let memberId: number;
      const dup = memberData.phone
        ? await db.select({ id: members.id }).from(members)
            .where(and(eq(members.name, memberData.name), samePhone(members.phone, memberData.phone)))
            .limit(1)
        : [];
      if (dup[0]) {
        // 기존 회원 재사용: grade/status 등은 zod 기본값(basic/active)이 항상 채워져 있어
        // 그대로 spread하면 기존 값(예: vip, paused)을 덮어써버린다. 재등록 맥락에서 실제로
        // 갱신할 의미가 있는 필드만 선택적으로 반영한다.
        memberId = dup[0].id;
        const upd: Record<string, any> = { updatedAt: new Date().toISOString() };
        if (memberData.membershipStart) upd.membershipStart = memberData.membershipStart;
        if (memberData.membershipEnd) upd.membershipEnd = memberData.membershipEnd;
        if (memberData.profileNote !== undefined) upd.profileNote = memberData.profileNote;
        if (memberData.visitRoute !== undefined) upd.visitRoute = memberData.visitRoute;
        if (trainerId != null) upd.trainerId = trainerId;
        await db.update(members).set(upd).where(eq(members.id, memberId));
      } else {
        const [insertResult] = await db.insert(members).values({
          ...memberData,
          ...(trainerId != null ? { trainerId } : {}),
        }).returning({ id: members.id });
        memberId = insertResult.id;
      }

      if (ptSessions) {
        const sessionCount = parseInt(ptSessions);
        const svcSessions = serviceSessions ?? 0;
        const packageName = ptProgram || undefined;
        const pricePerSession = calcPricePerSession(paymentAmount, sessionCount, paymentMethod);

        await db.insert(ptPackages).values({
          memberId,
          trainerId,
          totalSessions: sessionCount + svcSessions,
          serviceSessions: svcSessions,
          serviceSessionPrice: serviceSessionPrice ?? undefined,
          serviceSamePrice: serviceSamePrice ?? undefined,
          eventId: eventId ?? undefined,
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

      // 매출 자동 연동 (결제 금액이 있거나 서비스 항목이 있을 때)
      if (paymentAmount || serviceItems) {
        const effectiveAmount = paymentAmount ?? 0;
        const sessionCount = ptSessions ? parseInt(ptSessions) : undefined;
        const discAmt = inputDiscountAmount ?? 0;
        const paid = Math.max(0, effectiveAmount - discAmt - (unpaidAmount ?? 0));
        const today = new Date().toISOString().substring(0, 10);
        const revenueType = input.primaryType ?? (sessionCount ? "PT" : ptProgram?.startsWith("헬스") ? "헬스" : "기타");
        // 헬스 기간 계산 (membershipStart → membershipEnd diff)
        let healthDuration: number | undefined;
        if (revenueType === "헬스" && memberData.membershipStart && memberData.membershipEnd) {
          const s = new Date(memberData.membershipStart);
          const e = new Date(memberData.membershipEnd);
          const diff = (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth());
          if (diff > 0) healthDuration = diff;
        }
        // 중복 방지: 같은 회원 + 같은 날짜 + 같은 금액 + 같은 subType 이미 존재하면 skip
        const dupDate = paymentDate ?? today;
        const existing = await db.select({ id: revenueEntries.id }).from(revenueEntries)
          .where(and(
            eq(revenueEntries.memberId, memberId),
            eq(revenueEntries.paymentDate, dupDate),
            eq(revenueEntries.amount, effectiveAmount),
            eq(revenueEntries.subType, subType ?? "신규"),
          )).limit(1);
        if (existing.length > 0) {
          // 중복 항목 존재 — 새 항목 저장 생략
        } else {
        await db.insert(revenueEntries).values({
          memberId,
          trainerId,
          createdBy: ctx.user.id,
          customerName: memberData.name,
          phone: memberData.phone,
          programDetail: ptProgram || (sessionCount ? `PT ${sessionCount}회` : undefined),
          sessions: sessionCount,
          duration: healthDuration,
          type: revenueType,
          subType,
          eventId: eventId ?? undefined,
          amount: effectiveAmount,
          discountAmount: discAmt,
          paidAmount: paid,
          unpaidAmount: unpaidAmount ?? 0,
          paymentMethod,
          paymentDate: paymentDate ?? today,
          startDate: memberData.membershipStart,
          memo: paymentMemo,
          serviceItems: serviceItems || undefined,
        });
        } // end else (no duplicate)
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
        status: z.enum(["active", "paused", "inactive"]).optional(),
        membershipStart: z.string().nullable().optional(),
        membershipEnd: z.string().nullable().optional(),
        profileNote: z.string().optional(),
        visitRoute: z.string().optional(),
        trainerId: z.number().nullable().optional(),
        signatureDataUrl: z.string().optional(),
        // 재등록 결제 정보 (장부 자동 연동용)
        ptProgram: z.string().optional(),
        ptSessions: z.union([z.string(), z.number()]).optional(),
        paymentAmount: z.number().optional(),
        unpaidAmount: z.number().optional(),
        paymentMethod: z.enum(["카드", "현금", "현금영수증", "계좌이체", "이체", "지역화폐", "분할결제", "혼합"]).optional(),
        paymentDate: z.string().optional(),
        paymentMemo: z.string().optional(),
        subType: z.enum(["신규", "재등록"]).optional(),
        serviceItems: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const {
        id,
        ptProgram, ptSessions, paymentAmount, unpaidAmount,
        paymentMethod, paymentDate, paymentMemo, subType, serviceItems,
        ...memberData
      } = input;

      await db.update(members).set(memberData).where(eq(members.id, id));

      // 담당 트레이너 변경 시 진행 중인(active) PT 패키지도 함께 옮긴다.
      // ptPackages.trainerId는 members.trainerId와 별도 필드라 여기서 안 맞춰주면, 회원 카드는
      // 새 트레이너로 보이는데 PT 관리 목록(ptPackages.trainerId 기준 필터)에는 여전히 안 뜨는
      // 사고가 난다. 완료/환불된 과거 패키지는 정산 소급 방지를 위해 건드리지 않는다.
      if (memberData.trainerId !== undefined) {
        await db.update(ptPackages)
          .set({ trainerId: memberData.trainerId })
          .where(and(eq(ptPackages.memberId, id), eq(ptPackages.status, "active")));
      }

      // 장부 자동 연동 — paymentAmount가 있거나 serviceItems가 있는 경우
      if ((paymentAmount != null || serviceItems) && subType) {
        const effectiveAmount = paymentAmount ?? 0;
        const sessionCount = ptSessions ? parseInt(String(ptSessions)) : undefined;
        const paid = Math.max(0, effectiveAmount - (unpaidAmount ?? 0));
        const today = new Date().toISOString().substring(0, 10);
        const revenueType = sessionCount ? "PT" : "헬스";
        const [member] = await db.select().from(members).where(eq(members.id, id));
        // 헬스권 기간 계산: ptProgram 텍스트 "헬스 N개월" 파싱 → duration 컬럼에 저장
        let healthDuration: number | undefined;
        if (revenueType === "헬스" && ptProgram) {
          const m2 = /헬스 (\d+)개월/.exec(ptProgram);
          if (m2) healthDuration = parseInt(m2[1]);
        }
        // 중복 방지: 같은 회원 + 같은 날짜 + 같은 금액 + 같은 subType 이미 존재하면 skip
        const dupDate2 = paymentDate ?? today;
        const existing2 = await db.select({ id: revenueEntries.id }).from(revenueEntries)
          .where(and(
            eq(revenueEntries.memberId, id),
            eq(revenueEntries.paymentDate, dupDate2),
            eq(revenueEntries.amount, effectiveAmount),
            eq(revenueEntries.subType, subType),
          )).limit(1);
        if (existing2.length === 0) {
        await db.insert(revenueEntries).values({
          memberId: id,
          trainerId: member?.trainerId ?? null,
          createdBy: ctx.user.id,
          customerName: member?.name ?? memberData.name,
          phone: member?.phone ?? memberData.phone,
          programDetail: ptProgram || (sessionCount ? `PT ${sessionCount}회` : undefined),
          sessions: sessionCount,
          duration: healthDuration,
          type: revenueType,
          subType: subType ?? "재등록",
          amount: effectiveAmount,
          discountAmount: 0,
          paidAmount: paid,
          unpaidAmount: unpaidAmount ?? 0,
          paymentMethod,
          paymentDate: paymentDate ?? today,
          startDate: memberData.membershipStart,
          memo: paymentMemo,
          serviceItems: serviceItems || undefined,
        });
        } // end dedup check
      }

      // PT 패키지 자동 생성 — 세션 수가 있고 등록/이전 처리인 경우
      if (ptSessions && subType) {
        const sessionCount = parseInt(String(ptSessions));
        if (sessionCount > 0) {
          const [member] = await db.select({ trainerId: members.trainerId }).from(members).where(eq(members.id, id)).limit(1);
          const pricePerSession = calcPricePerSession(paymentAmount ?? undefined, sessionCount, paymentMethod);

          // 중복 방지: 같은 세션수의 활성 패키지가 이미 있으면 새로 만들지 않고 그 패키지를 갱신한다.
          // 예전에는 무조건 insert여서, 회원정보 수정 화면에서 PT 결제 정보를 넣고 저장할 때마다
          // 시작일도 없는 유령 패키지가 하나씩 늘어나는 사고가 있었다(김용근 사례: 잔여 20/20회·
          // 기간 없음·미수금만 달린 복제 패키지).
          const dupPkgs = await db.select({ id: ptPackages.id })
            .from(ptPackages)
            .where(and(
              eq(ptPackages.memberId, id),
              eq(ptPackages.totalSessions, sessionCount),
              eq(ptPackages.status, "active"),
            ))
            .orderBy(desc(ptPackages.createdAt))
            .limit(1);

          const pkgFields = {
            packageName: ptProgram || undefined,
            ...(memberData.membershipStart ? { startDate: memberData.membershipStart } : {}),
            pricePerSession: pricePerSession ?? undefined,
            paymentAmount: paymentAmount ?? undefined,
            unpaidAmount: unpaidAmount ?? undefined,
            paymentMethod: paymentMethod ?? undefined,
            paymentDate: paymentDate ?? undefined,
            paymentMemo: paymentMemo ?? undefined,
            updatedAt: new Date().toISOString(),
          };

          if (dupPkgs[0]) {
            await db.update(ptPackages).set(pkgFields).where(eq(ptPackages.id, dupPkgs[0].id));
          } else {
            await db.insert(ptPackages).values({
              memberId: id,
              trainerId: member?.trainerId ?? null,
              totalSessions: sessionCount,
              usedSessions: 0,
              ...pkgFields,
              startDate: memberData.membershipStart ?? undefined,
              status: "active",
              createdAt: new Date().toISOString(),
            });
          }
        }
      }

      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user?.role !== "admin" && ctx.user?.role !== "sub_admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "관리자만 회원을 삭제할 수 있습니다." });
      }
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // 관련 데이터 cascade 삭제 (세션 로그·패키지·매출·출석 등)
      // 매출도 함께 삭제한다 — 오등록/중복 회원을 완전히 지우는 용도이므로, 매출만 고아로
      // 남아 정산·대시보드 합계에 계속 잡히는 사고를 막는다.
      await db.delete(ptSessionLogs).where(eq(ptSessionLogs.memberId, input.id));
      await db.delete(ptPackages).where(eq(ptPackages.memberId, input.id));
      await db.delete(revenueEntries).where(eq(revenueEntries.memberId, input.id));
      // 배정된 락커는 비우고(락커 자체는 자산이므로 삭제 대신 해제), 운동복 대여는 반납 처리
      await db.update(lockers)
        .set({ memberId: null, memberName: null, memberPhone: null, isOccupied: 0, startDate: null, endDate: null, rentalType: null, updatedAt: new Date().toISOString() })
        .where(eq(lockers.memberId, input.id));
      await db.update(uniforms)
        .set({ isActive: 0, updatedAt: new Date().toISOString() })
        .where(eq(uniforms.memberId, input.id));
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
        .where(and(eq(members.trainerId, trainerId), eq(members.status, "active"), hasPtPackage));

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

  // 이번달 마감 임박 회원 (잔여 세션 ≤ threshold, 기본 5회).
  // 회원별로 "가장 최근 시작한 패키지"만 기준으로 판단한다 — 그래야 이미 새 패키지를
  // 구매한(재등록 완료한) 회원의 예전 패키지가 여전히 active 상태로 남아 "재등록 물어봐야 할
  // 사람"으로 계속 잡히는 걸 막을 수 있다. status를 3가지로 나눈다:
  //   재등록완료 = 이 패키지보다 나중에 시작한 패키지가 이미 있음 (더 물어볼 필요 없음)
  //   이탈       = 새 패키지 없이 잔여 0(or 만료일 경과)로 끝남 (이미 이탈)
  //   마감임박   = 새 패키지 없이 잔여 낮음, 아직 만료 전 (지금 확인 필요한 대상)
  getMonthExpiring: protectedProcedure
    .input(z.object({ threshold: z.number().default(5), trainerId: z.number().optional() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      let tid: number | undefined;
      if (input.trainerId !== undefined) {
        if (ctx.user?.role !== "admin" && ctx.user?.role !== "sub_admin")
          throw new TRPCError({ code: "FORBIDDEN" });
        tid = input.trainerId;
      } else {
        tid = ctx.user.trainerId;
        if (!tid) throw new TRPCError({ code: "FORBIDDEN" });
      }

      const activeMembers = await db.select({ id: members.id, name: members.name, phone: members.phone, renewalIntent: members.renewalIntent })
        .from(members)
        .where(and(eq(members.trainerId, tid), eq(members.status, "active")));
      if (activeMembers.length === 0) return [];
      const memberIds = activeMembers.map(m => m.id);

      const allPkgs = await db.select({
        id: ptPackages.id,
        memberId: ptPackages.memberId,
        totalSessions: ptPackages.totalSessions,
        usedSessions: ptPackages.usedSessions,
        packageName: ptPackages.packageName,
        status: ptPackages.status,
        startDate: ptPackages.startDate,
        expiryDate: ptPackages.expiryDate,
      }).from(ptPackages).where(inArray(ptPackages.memberId, memberIds));

      const today = kstDate();
      const result: any[] = [];
      for (const m of activeMembers) {
        const pkgs = allPkgs.filter(p => p.memberId === m.id)
          .sort((a, b) => (b.startDate ?? "").localeCompare(a.startDate ?? "") || b.id - a.id);
        const latest = pkgs[0];
        if (!latest) continue;
        const remaining = (latest.totalSessions ?? 0) - (latest.usedSessions ?? 0);
        if (remaining > input.threshold && latest.status === "active") continue; // 아직 여유 있음

        const hasNewer = pkgs.some(p => p.id !== latest.id && (p.startDate ?? "") > (latest.startDate ?? ""));
        if (hasNewer) continue; // 이미 다음 패키지를 구매함 — 더 물어볼 필요 없어 목록에서 제외

        const expired = (latest.expiryDate && latest.expiryDate < today) || remaining <= 0 || latest.status === "completed";
        result.push({
          id: m.id, name: m.name, phone: m.phone, renewalIntent: m.renewalIntent,
          totalSessions: latest.totalSessions, usedSessions: latest.usedSessions,
          packageName: latest.packageName, remaining,
          renewalStatus: expired ? "이탈" : "마감임박",
        });
      }
      return result.sort((a, b) => a.remaining - b.remaining);
    }),

  // 다음달 이월 예상 회원: 이번달 만료 예정(또는 이미 만료)인 진행중 패키지인데 세션이 많이
  // 남아 있는 경우 — 출석이 뜸해서 진도가 밀려 다음달로 넘어갈 가능성이 큰 회원.
  // "마감임박"(잔여 적음, 곧 끝남)과는 반대 신호라 별도로 분리한다.
  getRolloverToNextMonth: protectedProcedure
    .input(z.object({ trainerId: z.number().optional(), minRemaining: z.number().default(3) }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      let tid: number | undefined;
      if (input.trainerId !== undefined) {
        if (ctx.user?.role !== "admin" && ctx.user?.role !== "sub_admin")
          throw new TRPCError({ code: "FORBIDDEN" });
        tid = input.trainerId;
      } else {
        tid = ctx.user.trainerId;
        if (!tid) throw new TRPCError({ code: "FORBIDDEN" });
      }

      const today = kstDate();
      const monthEnd = `${today.substring(0, 7)}-31`; // 문자열 비교라 31로 둬도 그 달 안이면 안전

      const activeMembers = await db.select({ id: members.id, name: members.name, phone: members.phone })
        .from(members)
        .where(and(eq(members.trainerId, tid), eq(members.status, "active")));
      if (activeMembers.length === 0) return [];
      const memberIds = activeMembers.map(m => m.id);

      const pkgs = await db.select({
        id: ptPackages.id, memberId: ptPackages.memberId,
        totalSessions: ptPackages.totalSessions, usedSessions: ptPackages.usedSessions,
        packageName: ptPackages.packageName, expiryDate: ptPackages.expiryDate,
      }).from(ptPackages)
        .where(and(inArray(ptPackages.memberId, memberIds), eq(ptPackages.status, "active")));

      const candidates = pkgs.filter(p =>
        p.expiryDate && p.expiryDate <= monthEnd &&
        ((p.totalSessions ?? 0) - (p.usedSessions ?? 0)) >= input.minRemaining
      );
      if (candidates.length === 0) return [];

      const logRows = await db.select({ memberId: ptSessionLogs.memberId, sessionDate: ptSessionLogs.sessionDate })
        .from(ptSessionLogs)
        .where(inArray(ptSessionLogs.memberId, candidates.map(c => c.memberId)))
        .orderBy(desc(ptSessionLogs.sessionDate));
      const lastSessionByMember = new Map<number, string>();
      for (const l of logRows) {
        if (!lastSessionByMember.has(l.memberId) && l.sessionDate) lastSessionByMember.set(l.memberId, l.sessionDate);
      }
      const memberMap = new Map(activeMembers.map(m => [m.id, m]));

      return candidates.map(p => {
        const mem = memberMap.get(p.memberId);
        return {
          id: p.memberId,
          name: mem?.name ?? "-",
          phone: mem?.phone ?? null,
          packageName: p.packageName,
          remaining: (p.totalSessions ?? 0) - (p.usedSessions ?? 0),
          expiryDate: p.expiryDate,
          lastSessionDate: lastSessionByMember.get(p.memberId) ?? null,
        };
      }).sort((a, b) => b.remaining - a.remaining);
    }),

  // 재등록 의향 설정
  setRenewalIntent: protectedProcedure
    .input(z.object({ memberId: z.number(), intent: z.enum(["재등록예정", "이탈예정"]).nullable() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const member = await db.select({ trainerId: members.trainerId }).from(members).where(eq(members.id, input.memberId)).limit(1);
      const memberTrainerId = member[0]?.trainerId;
      const isAdmin = ctx.user?.role === "admin" || ctx.user?.role === "sub_admin";
      if (!isAdmin && memberTrainerId !== ctx.user.trainerId)
        throw new TRPCError({ code: "FORBIDDEN" });

      await db.update(members)
        .set({ renewalIntent: input.intent ?? null })
        .where(eq(members.id, input.memberId));
      return { success: true };
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

      // PT 재등록 이력: 패키지를 결제일(없으면 시작일·생성일) 순으로 정렬해 등록 타임라인 구성.
      // 등록 간 공백(일수)으로 "쉬었다가 재등록"과 "끊기지 않고 이어서 재등록"을 구분할 수 있게 한다.
      const sortedPkgs = [...pkgs].sort((a, b) => {
        const da = a.paymentDate ?? a.startDate ?? a.createdAt ?? "";
        const db_ = b.paymentDate ?? b.startDate ?? b.createdAt ?? "";
        return da.localeCompare(db_);
      });
      const history = sortedPkgs.map((p, i) => {
        const date = p.paymentDate ?? p.startDate ?? (p.createdAt ? p.createdAt.substring(0, 10) : null);
        const prev = i > 0 ? sortedPkgs[i - 1] : null;
        const prevEnd = prev?.expiryDate ?? null;
        const gapDays = prevEnd && date
          ? Math.round((new Date(date).getTime() - new Date(prevEnd).getTime()) / 86400000)
          : null;
        return {
          id: p.id,
          seq: i + 1,
          date,
          packageName: p.packageName,
          totalSessions: p.totalSessions,
          paymentAmount: p.paymentAmount,
          status: p.status,
          gapDaysFromPrevExpiry: gapDays,
        };
      });

      return { totalSessions, cancelCount, noshowCount, lastSessionDate, reregistered, reregistrationCount, totalChecks: checks.length, history };
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
      availableBranches: (r.trainerId != null ? tbMap.get(r.trainerId) ?? [] : []).map(bid => ({
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

  bulkCreate: protectedProcedure
    .input(z.object({
      rows: z.array(z.object({
        name: z.string().min(1),
        phone: z.string().optional(),
        gender: z.enum(["male", "female", "other"]).optional(),
        birthDate: z.string().optional(),
        status: z.enum(["active", "paused", "inactive"]).default("active"),
        membershipStart: z.string().optional(),
        membershipEnd: z.string().optional(),
        profileNote: z.string().optional(),
        branchId: z.number().optional(),
        ptPackages: z.array(z.object({
          packageName: z.string().optional(),
          totalSessions: z.number().int().min(1),
          startDate: z.string().optional(),
          expiryDate: z.string().optional(),
        })).optional(),
      })),
      branchId: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      if (ctx.user.role !== "admin" && ctx.user.role !== "sub_admin")
        throw new TRPCError({ code: "FORBIDDEN" });

      let created = 0;
      let updated = 0;
      const now = new Date().toISOString();

      const existing = await db.select({
        id: members.id, name: members.name, phone: members.phone,
        membershipEnd: members.membershipEnd,
      }).from(members);
      const existingMap = new Map<string, { id: number; membershipEnd: string | null }>();
      for (const m of existing) {
        if (m.phone?.trim()) {
          existingMap.set(`${m.name.trim()}||${m.phone.trim()}`, { id: m.id, membershipEnd: m.membershipEnd ?? null });
        }
      }

      for (const row of input.rows) {
        const key = row.phone?.trim() ? `${row.name.trim()}||${row.phone.trim()}` : null;
        let memberId: number | null = null;

        if (key && existingMap.has(key)) {
          // 기존 회원: 날짜·특이사항 업데이트 (더 늦은 종료일 우선)
          const ex = existingMap.get(key)!;
          memberId = ex.id;
          const updateFields: Record<string, any> = { updatedAt: now };
          if (row.membershipEnd && (!ex.membershipEnd || row.membershipEnd > ex.membershipEnd)) {
            updateFields.membershipEnd = row.membershipEnd;
          }
          if (row.membershipStart) updateFields.membershipStart = row.membershipStart;
          if (row.profileNote) updateFields.profileNote = row.profileNote;
          if (row.branchId) updateFields.branchId = row.branchId;
          if (row.gender) updateFields.gender = row.gender;
          if (row.birthDate) updateFields.birthDate = row.birthDate;
          await db.update(members).set(updateFields).where(eq(members.id, memberId));
          updated++;
        } else {
          const [ins] = await db.insert(members).values({
            name: row.name.trim(),
            phone: row.phone?.trim() || undefined,
            gender: row.gender,
            birthDate: row.birthDate,
            status: row.status ?? "active",
            grade: "basic",
            membershipStart: row.membershipStart,
            membershipEnd: row.membershipEnd,
            profileNote: row.profileNote,
            branchId: input.branchId ?? row.branchId ?? null,
            createdAt: now,
            updatedAt: now,
          }).returning({ id: members.id });
          memberId = ins.id;
          created++;
          if (key) existingMap.set(key, { id: memberId, membershipEnd: row.membershipEnd ?? null });
        }

        if (memberId && row.ptPackages?.length) {
          // 동일한 패키지명+횟수 중복 방지
          const existingPkgs = await db.select({ packageName: ptPackages.packageName, totalSessions: ptPackages.totalSessions })
            .from(ptPackages).where(eq(ptPackages.memberId, memberId));
          for (const pkg of row.ptPackages) {
            const isDup = existingPkgs.some(
              ep => ep.packageName === (pkg.packageName ?? null) && ep.totalSessions === pkg.totalSessions
            );
            if (!isDup) {
              await db.insert(ptPackages).values({
                memberId,
                trainerId: null,
                totalSessions: pkg.totalSessions,
                serviceSessions: 0,
                usedSessions: 0,
                packageName: pkg.packageName,
                startDate: pkg.startDate,
                expiryDate: pkg.expiryDate,
              });
            }
          }
        }
      }

      return { created, updated };
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

    const { role, trainerId } = ctx.user;

    const baseSelect = {
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
    };

    const q = db.select(baseSelect).from(ptPackages).innerJoin(members, eq(ptPackages.memberId, members.id));

    if (role === "trainer") {
      if (!trainerId) throw new TRPCError({ code: "FORBIDDEN" });
      return q.where(eq(ptPackages.trainerId, trainerId)).orderBy(desc(ptPackages.createdAt));
    }

    // admin, sub_admin, consultant: 전체 패키지 반환
    return q.orderBy(desc(ptPackages.createdAt));
  }),

  // 미수금 있는 PT 패키지 목록 (admin/sub_admin용)
  listUnpaid: protectedProcedure
    .input(z.object({ branchId: z.number().optional() }).optional())
    .query(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    return db
      .select({
        id: ptPackages.id,
        memberName: members.name,
        packageName: ptPackages.packageName,
        unpaidAmount: ptPackages.unpaidAmount,
        trainerName: trainers.trainerName,
      })
      .from(ptPackages)
      .innerJoin(members, eq(ptPackages.memberId, members.id))
      .leftJoin(trainers, eq(ptPackages.trainerId, trainers.id))
      .where(
        and(
          sql`${ptPackages.unpaidAmount} IS NOT NULL`,
          gt(ptPackages.unpaidAmount, 0),
          ...(input?.branchId ? [eq(members.branchId, input.branchId)] : [])
        )
      )
      .orderBy(desc(ptPackages.unpaidAmount));
  }),

  // 기존 회원에게 PT 패키지 추가
  addPackage: protectedProcedure
    .input(
      z.object({
        memberId: z.number(),
        ptProgram: z.string().optional(),
        totalSessions: z.number().min(1),
        serviceSessions: z.number().min(0).default(0).optional(),
        serviceSessionPrice: z.number().min(0).optional(),
        startDate: z.string().optional(),
        expiryDate: z.string().optional(),
        paymentAmount: z.number().optional(),
        unpaidAmount: z.number().optional(),
        paymentMethod: z.enum(["카드", "현금", "현금영수증", "계좌이체", "이체", "지역화폐", "분할결제", "혼합"]).optional(),
        transferAmount: z.number().optional(),
        cardAmount: z.number().optional(),
        paymentDate: z.string().optional(),
        paymentMemo: z.string().optional(),
        eventId: z.number().optional(),   // 적용 이벤트 (성과 추적)
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
      const svcSessions = input.serviceSessions ?? 0;
      // 단가는 서비스 횟수 제외한 결제 횟수 기준으로 계산
      const pricePerSession = calcPricePerSession(input.paymentAmount, input.totalSessions, input.paymentMethod, input.transferAmount, input.cardAmount);
      const actualTotalSessions = input.totalSessions + svcSessions;

      await db.insert(ptPackages).values({
        memberId: input.memberId,
        trainerId,
        totalSessions: input.totalSessions,
        usedSessions: 0,
        packageName,
        startDate: input.startDate,
        expiryDate: input.expiryDate,
        pricePerSession,
        serviceSessionPrice: input.serviceSessionPrice ?? undefined,
        serviceSessions: svcSessions,
        paymentAmount: input.paymentAmount,
        unpaidAmount: input.unpaidAmount,
        paymentMethod: input.paymentMethod,
        transferAmount: input.transferAmount ?? undefined,
        cardAmount: input.cardAmount ?? undefined,
        paymentDate: input.paymentDate,
        paymentMemo: input.paymentMemo,
        eventId: input.eventId ?? undefined,
      });

      // PT 패키지 생성 시 members.trainerId가 비어있으면 동기화
      if (trainerId) {
        await db.update(members)
          .set({ trainerId })
          .where(and(eq(members.id, input.memberId), isNull(members.trainerId)));
      }

      // 결제금액이 있으면 매출 항목 자동 생성
      if (input.paymentAmount) {
        const today = new Date().toISOString().substring(0, 10);
        const memberForRevenue = await db.select({ name: members.name, phone: members.phone, branchId: members.branchId }).from(members).where(eq(members.id, input.memberId)).limit(1);
        const mInfo = memberForRevenue[0];
        const paid = Math.max(0, input.paymentAmount - (input.unpaidAmount ?? 0));
        await db.insert(revenueEntries).values({
          memberId: input.memberId,
          trainerId,
          createdBy: ctx.user.id,
          branchId: mInfo?.branchId ?? undefined,
          customerName: mInfo?.name,
          phone: mInfo?.phone,
          programDetail: input.ptProgram,
          sessions: input.totalSessions,
          type: "PT",
          subType: "재등록",
          eventId: input.eventId ?? undefined,
          amount: input.paymentAmount,
          discountAmount: 0,
          paidAmount: paid,
          unpaidAmount: input.unpaidAmount ?? 0,
          paymentMethod: input.paymentMethod,
          paymentDate: input.paymentDate ?? today,
          startDate: input.startDate,
          memo: input.paymentMemo,
        });
      }

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
      isDraft: z.boolean().optional(),
      overrideTrainerId: z.number().optional(), // admin이 대신 기록할 때
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const isStaff = ctx.user.role === "admin" || ctx.user.role === "sub_admin";
      let trainerId: number | null = ctx.user.trainerId ?? null;

      if (isStaff) {
        // admin: overrideTrainerId 또는 회원의 담당 트레이너 사용
        if (input.overrideTrainerId) {
          trainerId = input.overrideTrainerId;
        } else {
          const [mem] = await db.select({ trainerId: members.trainerId }).from(members).where(eq(members.id, input.memberId)).limit(1);
          trainerId = mem?.trainerId ?? null;
        }
      } else if (!trainerId) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      // 회원명 스냅샷 (회원 삭제 후에도 정산 내역에 이름 표시)
      const [memberRow] = await db.select({ name: members.name }).from(members).where(eq(members.id, input.memberId)).limit(1);
      const memberNameSnapshot = memberRow?.name ?? null;

      // packageId 자동 연결: 회원의 활성 패키지 중 단가 정보가 있는 것을 우선 선택
      // (연결 누락 시 정산 단가가 0원이 되는 문제 방지)
      // "기타"는 1회성 부가항목(운동복/락커 등과 유사한 잡항목)일 뿐 실제 PT 프로그램이 아니므로
      // 실제 프로그램 패키지가 있으면 절대 우선순위에서 밀려나야 한다 (아니면 저단가 기타 항목이
      // 이후 모든 세션의 단가를 잘못 끌어내리는 사고가 발생한다).
      const memberPkgs = await db.select({
        id: ptPackages.id, pricePerSession: ptPackages.pricePerSession,
        paymentAmount: ptPackages.paymentAmount, status: ptPackages.status,
        packageName: ptPackages.packageName,
      }).from(ptPackages)
        .where(eq(ptPackages.memberId, input.memberId))
        .orderBy(desc(ptPackages.createdAt));
      const priced = (p: any) => (p.pricePerSession ?? 0) > 0 || (p.paymentAmount ?? 0) > 0;
      const isRealProgram = (p: any) => p.packageName !== "기타";
      const resolvedPackageId =
        memberPkgs.find(p => p.status === "active" && priced(p) && isRealProgram(p))?.id ??
        memberPkgs.find(p => p.status === "active" && priced(p))?.id ??
        memberPkgs.find(p => p.status === "active")?.id ??
        memberPkgs.find(p => priced(p) && isRealProgram(p))?.id ??
        memberPkgs.find(p => priced(p))?.id ??
        memberPkgs[0]?.id ??
        null;

      const { overrideTrainerId: _, isDraft, ...logFields } = input;
      const targetDate = input.sessionDate ?? kstDate();

      // 같은 날 이미 세션 로그가 있으면 UPDATE (출석 체크로 자동 생성된 로그 포함)
      const [existingForDate] = await db.select({ id: ptSessionLogs.id })
        .from(ptSessionLogs)
        .where(and(eq(ptSessionLogs.memberId, input.memberId), eq(ptSessionLogs.sessionDate, targetDate)))
        .limit(1);

      if (existingForDate) {
        const [row] = await db.update(ptSessionLogs)
          .set({
            goal: logFields.goal, bodyPart: logFields.bodyPart,
            exercisesJson: logFields.exercisesJson, feedback: logFields.feedback,
            notes: logFields.notes,
            packageId: resolvedPackageId ?? undefined,
            memberName: memberNameSnapshot,
            trainerId: trainerId ?? 0,
            isDraft: isDraft ? 1 : 0,
          })
          .where(eq(ptSessionLogs.id, existingForDate.id))
          .returning();
        return row;
      }

      const [row] = await db.insert(ptSessionLogs).values({
        ...logFields,
        sessionDate: targetDate,
        packageId: resolvedPackageId ?? undefined,
        memberName: memberNameSnapshot,
        trainerId: trainerId ?? 0,
        isDraft: isDraft ? 1 : 0,
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
      isDraft: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { id, isDraft, ...fields } = input;
      await db.update(ptSessionLogs).set({
        ...fields,
        ...(isDraft !== undefined ? { isDraft: isDraft ? 1 : 0 } : {}),
      }).where(eq(ptSessionLogs.id, id));
      return { success: true };
    }),

  // 트레이닝 일지 삭제
  deleteLog: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // 패키지 연결된 세션 로그라면 usedSessions 복구
      const [log] = await db
        .select({ packageId: ptSessionLogs.packageId, isDraft: ptSessionLogs.isDraft })
        .from(ptSessionLogs)
        .where(eq(ptSessionLogs.id, input.id))
        .limit(1);

      await db.delete(ptSessionLogs).where(eq(ptSessionLogs.id, input.id));

      if (log?.packageId && !log.isDraft) {
        const [pkg] = await db
          .select({ usedSessions: ptPackages.usedSessions, totalSessions: ptPackages.totalSessions })
          .from(ptPackages)
          .where(eq(ptPackages.id, log.packageId))
          .limit(1);
        if (pkg) {
          const newUsed = Math.max(0, pkg.usedSessions - 1);
          await db
            .update(ptPackages)
            .set({ usedSessions: newUsed, status: newUsed < pkg.totalSessions ? "active" : "completed" })
            .where(eq(ptPackages.id, log.packageId));
        }
      }

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

      // Determine if this is a service session (beyond paid sessions, or entire package is service)
      const isFullServicePkg = pkg.packageName === "서비스세션" || (pkg.serviceSessions ?? 0) >= pkg.totalSessions;
      const paidSessions = isFullServicePkg ? 0 : pkg.totalSessions - (pkg.serviceSessions ?? 0);
      const isServiceSession = isFullServicePkg || pkg.usedSessions >= paidSessions ? 1 : 0;

      const targetDate = input.sessionDate ?? kstDate();

      // 같은 날 같은 회원 세션 중복 방지
      const [dupCheck] = await db
        .select({ id: ptSessionLogs.id })
        .from(ptSessionLogs)
        .where(
          and(
            eq(ptSessionLogs.memberId, input.memberId),
            eq(ptSessionLogs.trainerId, trainerId),
            eq(ptSessionLogs.sessionDate, targetDate),
          )
        )
        .limit(1);
      if (dupCheck) {
        // 이미 세션 로그 있으면 내용만 업데이트 (중복 차감 없음)
        await db.update(ptSessionLogs)
          .set({ notes: input.notes, bodyPart: input.bodyPart, exercisesJson: input.exercisesJson, goal: input.goal, feedback: input.feedback })
          .where(eq(ptSessionLogs.id, dupCheck.id));
        return { success: true, remaining: pkg.totalSessions - pkg.usedSessions };
      }

      await db
        .update(ptPackages)
        .set({ usedSessions: newUsed, status: newStatus as any })
        .where(eq(ptPackages.id, resolvedPackageId!));

      const [useMemRow] = await db.select({ name: members.name }).from(members).where(eq(members.id, input.memberId)).limit(1);
      await db.insert(ptSessionLogs).values({
        memberId: input.memberId,
        memberName: useMemRow?.name ?? null,
        trainerId,
        packageId: resolvedPackageId,
        sessionDate: targetDate,
        notes: input.notes,
        bodyPart: input.bodyPart,
        exercisesJson: input.exercisesJson,
        goal: input.goal,
        feedback: input.feedback,
        isServiceSession,
      });

      // 회원권 시작일이 비어있으면 첫 수업일로 자동 설정
      const memberRow = await db.select({ membershipStart: members.membershipStart }).from(members).where(eq(members.id, input.memberId)).limit(1);
      if (memberRow[0] && !memberRow[0].membershipStart) {
        await db.update(members).set({ membershipStart: targetDate }).where(eq(members.id, input.memberId));
      }

      return { success: true, remaining: newUsed < pkg.totalSessions ? pkg.totalSessions - newUsed : 0 };
    }),

  // 세션 로그 목록 (회원별) — 날짜 미정(draft) 먼저, 이후 날짜 역순
  sessionLogs: protectedProcedure
    .input(z.object({ memberId: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      return db
        .select()
        .from(ptSessionLogs)
        .where(eq(ptSessionLogs.memberId, input.memberId))
        .orderBy(desc(ptSessionLogs.isDraft), desc(ptSessionLogs.sessionDate));
    }),

  // 세션 날짜순 재정렬 (sessionNumber 재할당)
  reorderSessionsByDate: protectedProcedure
    .input(z.object({ packageId: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const logs = await db.select().from(ptSessionLogs)
        .where(eq(ptSessionLogs.packageId, input.packageId))
        .orderBy(asc(ptSessionLogs.sessionDate));
      for (let i = 0; i < logs.length; i++) {
        await db.update(ptSessionLogs)
          .set({ sessionNumber: i + 1 })
          .where(eq(ptSessionLogs.id, logs[i].id));
      }
      return { reordered: logs.length };
    }),

  shareLog: protectedProcedure
    .input(z.object({ id: z.number(), share: z.boolean() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // 1) ptSessionLogs 플래그 업데이트
      await db.update(ptSessionLogs)
        .set({
          sharedToMember: input.share ? 1 : 0,
          sharedAt: input.share ? new Date().toISOString() : null,
        })
        .where(eq(ptSessionLogs.id, input.id));

      // 2) ZIANTGYM+ gym_plus_workout_logs 동기화
      let gymPlusSynced = false;
      let gymPlusSyncError: string | undefined;

      try {
        if (input.share) {
          const logRows = await db.execute(
            sql`SELECT s.*, m.phone FROM pt_session_logs s LEFT JOIN members m ON s."memberId" = m.id WHERE s.id = ${input.id} LIMIT 1`
          );
          const log = (logRows as any).rows?.[0] ?? (logRows as any)[0];

          if (!log) {
            gymPlusSyncError = "세션 기록을 찾을 수 없습니다.";
          } else {
            const normalizedPhone = log.phone ? String(log.phone).replace(/\D/g, '') : null;
            const gmRows = await db.execute(
              sql`SELECT id FROM gym_plus_members WHERE "memberId" = ${log.memberId} OR (${normalizedPhone}::text IS NOT NULL AND (REGEXP_REPLACE(COALESCE(phone,''), '[^0-9]', '', 'g') = ${normalizedPhone}::text OR username = ${normalizedPhone}::text)) LIMIT 1`
            );
            const gm = (gmRows as any).rows?.[0] ?? (gmRows as any)[0];

            if (!gm) {
              gymPlusSyncError = `짐플러스 계정을 찾을 수 없습니다. (전화번호: ${log.phone ?? "없음"})`;
              console.warn("[shareLog] gymPlus member not found for memberId:", log.memberId, "phone:", log.phone);
            } else {
              await db.execute(
                sql`DELETE FROM gym_plus_workout_logs WHERE "gymPlusMemberId" = ${gm.id} AND notes LIKE ${'%__src:' + input.id + '%'}`
              );
              const title = log.bodyPart ? `[트레이닝] ${log.bodyPart}` : "트레이닝 기록";
              const notes = ([log.notes, log.goal, log.feedback].filter(Boolean).join("\n") || "") + `\n__src:${input.id}`;
              const logDate = log.sessionDate ?? new Date().toISOString().slice(0, 10);
              // bodyPart "가슴,어깨" → bodyPartsJson ["가슴","어깨"]
              const bodyPartsJson = log.bodyPart
                ? JSON.stringify(String(log.bodyPart).split(",").map((s: string) => s.trim()).filter(Boolean))
                : null;
              await db.execute(
                sql`INSERT INTO gym_plus_workout_logs ("gymPlusMemberId", "logDate", title, "exercisesJson", "bodyPartsJson", notes, "createdAt") VALUES (${gm.id}, ${logDate}, ${title}, ${log.exercisesJson}, ${bodyPartsJson}, ${notes}, ${new Date().toISOString()})`
              );
              gymPlusSynced = true;
            }
          }
        } else {
          await db.execute(
            sql`DELETE FROM gym_plus_workout_logs WHERE notes LIKE ${'%__src:' + input.id + '%'}`
          );
          gymPlusSynced = true;
        }
      } catch (e: any) {
        gymPlusSyncError = e?.message ?? "짐플러스 동기화 중 오류가 발생했습니다.";
        console.error("[shareLog] gymPlus sync error:", e);
      }

      return { success: true, gymPlusSynced, gymPlusSyncError };
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

      const pkgResult = await db
        .select()
        .from(ptPackages)
        .where(eq(ptPackages.id, input.packageId))
        .limit(1);

      const pkg = pkgResult[0];
      if (!pkg) throw new TRPCError({ code: "NOT_FOUND", message: "패키지를 찾을 수 없습니다." });

      // 관리자이거나 본인이 담당한 패키지만 수정 가능
      const isAdmin = ctx.user.role === "admin" || ctx.user.role === "sub_admin";
      if (!isAdmin && (!ctx.user.trainerId || pkg.trainerId !== ctx.user.trainerId))
        throw new TRPCError({ code: "FORBIDDEN", message: "본인 담당 회원만 수정할 수 있습니다." });

      await db
        .update(ptPackages)
        .set({ unpaidAmount: input.unpaidAmount })
        .where(eq(ptPackages.id, input.packageId));

      // 연결된 원본 매출의 미수금도 같이 맞춘다 — 미수금 KPI/목록은 revenue_entries 기준이라
      // 패키지만 고치면 화면상 미수금이 안 줄어드는 불일치가 생긴다(김용근 사례).
      // revenueEntryId가 비어 있는 패키지(gym.register 경로)도 있으므로 같은 회원의 미수금
      // 매출로 폴백한다 — 안 그러면 이 화면에서 0으로 고쳐도 목록에 그대로 남는다.
      let targetRevId: number | null = pkg.revenueEntryId ?? null;
      if (!targetRevId) {
        const candidates = await db.select({ id: revenueEntries.id, startDate: revenueEntries.startDate })
          .from(revenueEntries)
          .where(and(
            eq(revenueEntries.memberId, pkg.memberId),
            gt(revenueEntries.unpaidAmount, 0),
            sql`COALESCE(${revenueEntries.subType},'') <> '미수금'`,
          ))
          .orderBy(desc(revenueEntries.unpaidAmount));
        targetRevId = (candidates.find(c => pkg.startDate && c.startDate === pkg.startDate) ?? candidates[0])?.id ?? null;
      }
      if (targetRevId) {
        await db.update(revenueEntries)
          .set({ unpaidAmount: input.unpaidAmount, updatedAt: new Date().toISOString() })
          .where(eq(revenueEntries.id, targetRevId));
      }

      return { success: true };
    }),

  // 미수금 수납 처리 — 실제로 돈을 받은 날짜와 함께 매출로 기록한다.
  // updatePayment(단순 금액 변경)과 달리, 수납액을 오늘(또는 지정일) 매출로 새로 남기고
  // 원본 매출의 미수금도 같이 줄여서 "미수금 총액" KPI와 "오늘/이번달 매출"이 둘 다 정확하게
  // 맞도록 한다. 원본 매출의 결제일자(최초 계약일)는 건드리지 않는다.
  collectUnpaidPayment: protectedProcedure
    .input(
      z.object({
        packageId: z.number(),
        collectedAmount: z.number().min(1),
        paymentDate: z.string(),
        paymentMethod: z.enum(["카드", "현금", "현금영수증", "계좌이체", "이체", "지역화폐", "분할결제"]).optional(),
        memo: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const pkg = (await db.select().from(ptPackages).where(eq(ptPackages.id, input.packageId)).limit(1))[0];
      if (!pkg) throw new TRPCError({ code: "NOT_FOUND", message: "패키지를 찾을 수 없습니다." });

      const isAdmin = ctx.user.role === "admin" || ctx.user.role === "sub_admin";
      if (!isAdmin && (!ctx.user.trainerId || pkg.trainerId !== ctx.user.trainerId))
        throw new TRPCError({ code: "FORBIDDEN", message: "본인 담당 회원만 수정할 수 있습니다." });

      const currentUnpaid = pkg.unpaidAmount ?? 0;
      if (input.collectedAmount > currentUnpaid) {
        throw new TRPCError({ code: "BAD_REQUEST", message: `현재 미수금(${currentUnpaid.toLocaleString()}원)보다 많이 받을 수 없습니다.` });
      }
      const newUnpaid = currentUnpaid - input.collectedAmount;

      await db.update(ptPackages).set({ unpaidAmount: newUnpaid }).where(eq(ptPackages.id, input.packageId));

      // 원본 매출의 미수금도 같이 줄인다 — "전체 미수금" KPI/목록이 revenue_entries 기준이라
      // 패키지만 고치면 화면상 미수금이 그대로 남는다.
      // ⚠ gym.register 경로로 만들어진 패키지는 revenueEntryId가 비어 있다. 그래서 이 링크만
      // 믿으면 원본을 못 찾아 미수금이 안 줄어드는 사고가 난다(안종현 사례). 링크가 없으면
      // 같은 회원의 미수금이 남아있는 매출을 찾아 처리한다(시작일 일치 건 우선).
      let origRevenue: typeof revenueEntries.$inferSelect | undefined;
      if (pkg.revenueEntryId) {
        [origRevenue] = await db.select().from(revenueEntries).where(eq(revenueEntries.id, pkg.revenueEntryId)).limit(1);
      }
      if (!origRevenue) {
        const candidates = await db.select().from(revenueEntries)
          .where(and(
            eq(revenueEntries.memberId, pkg.memberId),
            gt(revenueEntries.unpaidAmount, 0),
            sql`COALESCE(${revenueEntries.subType},'') <> '미수금'`,
          ))
          .orderBy(desc(revenueEntries.unpaidAmount));
        origRevenue = candidates.find(c => pkg.startDate && c.startDate === pkg.startDate) ?? candidates[0];
      }
      if (origRevenue) {
        const origNewUnpaid = Math.max(0, (origRevenue.unpaidAmount ?? 0) - input.collectedAmount);
        await db.update(revenueEntries).set({ unpaidAmount: origNewUnpaid, updatedAt: new Date().toISOString() }).where(eq(revenueEntries.id, origRevenue.id));
      }

      const [member] = await db.select({ name: members.name, phone: members.phone }).from(members).where(eq(members.id, pkg.memberId)).limit(1);

      await db.insert(revenueEntries).values({
        memberId: pkg.memberId,
        trainerId: pkg.trainerId,
        createdBy: ctx.user.id,
        customerName: member?.name ?? "",
        phone: member?.phone ?? null,
        programDetail: `${pkg.packageName ?? "PT"} 미수금 수납`,
        type: "PT",
        subType: "미수금",
        amount: input.collectedAmount,
        discountAmount: 0,
        paidAmount: input.collectedAmount,
        unpaidAmount: 0,
        paymentMethod: input.paymentMethod ?? undefined,
        paymentDate: input.paymentDate,
        // 어느 등록 건에 대한 입금인지 연결 — 등록관리에서 원본 카드 안에 이력으로 표시된다.
        relatedEntryId: origRevenue?.id ?? null,
        memo: input.memo ?? null,
      });

      return { success: true, newUnpaid };
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
      paymentMethod: z.enum(["현금영수증", "이체", "지역화폐", "카드", "혼합"]).optional(),
      transferAmount: z.number().optional(),
      cardAmount: z.number().optional(),
      paymentDate: z.string().optional(),
      paymentMemo: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { packageId, ...fields } = input;

      // 동기화가 필요한 필드 변경 시 항상 기존 패키지를 조회
      const pkg = (await db.select().from(ptPackages).where(eq(ptPackages.id, packageId)).limit(1))[0];

      // 관리자·컨설턴트이거나 본인이 담당한 패키지만 수정 가능
      const isAdmin = ctx.user.role === "admin" || ctx.user.role === "sub_admin" || ctx.user.role === "consultant";
      if (pkg && !isAdmin && (!ctx.user.trainerId || pkg.trainerId !== ctx.user.trainerId))
        throw new TRPCError({ code: "FORBIDDEN", message: "본인 담당 회원만 수정할 수 있습니다." });

      const total = fields.totalSessions ?? pkg?.totalSessions ?? 1;
      const used = fields.usedSessions ?? pkg?.usedSessions ?? 0;
      const autoStatus = used >= total ? "completed" : "active";

      // paymentAmount 또는 totalSessions 변경 시 pricePerSession 재계산
      const newPaymentAmount = fields.paymentAmount ?? pkg?.paymentAmount ?? undefined;
      const newTotalSessions = fields.totalSessions ?? pkg?.totalSessions ?? undefined;
      const newPaymentMethod = fields.paymentMethod ?? pkg?.paymentMethod ?? undefined;
      const newTransferAmount = fields.transferAmount ?? pkg?.transferAmount ?? undefined;
      const newCardAmount = fields.cardAmount ?? pkg?.cardAmount ?? undefined;
      const recalcPrice = (fields.paymentAmount !== undefined || fields.totalSessions !== undefined || fields.paymentMethod !== undefined || fields.transferAmount !== undefined || fields.cardAmount !== undefined)
        ? calcPricePerSession(newPaymentAmount ?? undefined, newTotalSessions ?? undefined, newPaymentMethod ?? undefined, newTransferAmount, newCardAmount)
        : undefined;

      await db.update(ptPackages).set({
        ...fields,
        ...(recalcPrice !== undefined ? { pricePerSession: recalcPrice } : {}),
        ...(pkg ? { status: autoStatus } : {}),
      }).where(eq(ptPackages.id, packageId));

      // ── revenue_entries 전체 필드 동기화 ─────────────────────────────────────
      if (pkg) {
        const newAmount   = fields.paymentAmount ?? pkg.paymentAmount ?? 0;
        const newUnpaid   = fields.unpaidAmount  ?? pkg.unpaidAmount  ?? 0;
        const newPaid     = Math.max(0, newAmount - newUnpaid);
        const paymentDate = fields.paymentDate   ?? pkg.paymentDate   ?? new Date().toISOString().substring(0, 10);
        const paymentMethod = fields.paymentMethod ?? pkg.paymentMethod ?? undefined;
        const sessions    = fields.totalSessions ?? pkg.totalSessions;
        const programDetail = fields.packageName ?? pkg.packageName ?? undefined;
        const startDate   = fields.startDate     ?? pkg.startDate     ?? undefined;
        const memo        = fields.paymentMemo   ?? pkg.paymentMemo   ?? undefined;

        const existingRev = await db.select({ id: revenueEntries.id })
          .from(revenueEntries)
          .where(and(eq(revenueEntries.memberId, pkg.memberId), eq(revenueEntries.type, "PT")))
          .orderBy(desc(revenueEntries.createdAt)).limit(1);

        if (existingRev.length > 0) {
          await db.update(revenueEntries).set({
            amount:        newAmount,
            paidAmount:    newPaid,
            unpaidAmount:  newUnpaid,
            paymentMethod,
            paymentDate,
            sessions,
            programDetail,
            startDate,
            memo,
            updatedAt: new Date().toISOString(),
          }).where(eq(revenueEntries.id, existingRev[0].id));
        } else if (newAmount > 0) {
          const memberRow = await db.select({ name: members.name, phone: members.phone, branchId: members.branchId, trainerId: members.trainerId })
            .from(members).where(eq(members.id, pkg.memberId)).limit(1);
          const m = memberRow[0];
          await db.insert(revenueEntries).values({
            memberId:     pkg.memberId,
            trainerId:    pkg.trainerId ?? m?.trainerId ?? undefined,
            createdBy:    ctx.user.id,
            branchId:     m?.branchId ?? undefined,
            customerName: m?.name,
            phone:        m?.phone,
            programDetail,
            sessions,
            type:         "PT",
            subType:      "재등록",
            amount:       newAmount,
            discountAmount: 0,
            paidAmount:   newPaid,
            unpaidAmount: newUnpaid,
            paymentMethod,
            paymentDate,
            startDate,
            memo,
          });
        }

        // ── members 날짜 동기화 ──────────────────────────────────────────────
        const memberUpdate: Record<string, string> = {};
        if (fields.startDate !== undefined) memberUpdate.membershipStart = fields.startDate;
        if (fields.expiryDate !== undefined) {
          memberUpdate.membershipEnd = fields.expiryDate;
        } else if (fields.totalSessions !== undefined || fields.startDate !== undefined) {
          const baseDate = fields.startDate ?? pkg.startDate;
          const totalSess = fields.totalSessions ?? pkg.totalSessions;
          if (baseDate && totalSess) {
            const weeks = Math.round(totalSess / 2);
            const d = new Date(baseDate);
            d.setDate(d.getDate() + weeks * 7);
            memberUpdate.membershipEnd = d.toISOString().substring(0, 10);
          }
        }
        if (Object.keys(memberUpdate).length > 0) {
          await db.update(members)
            .set({ ...memberUpdate, updatedAt: new Date().toISOString() })
            .where(eq(members.id, pkg.memberId));
        }
      }

      return { success: true };
    }),

  // 패키지 상태 변경 (진행/정지/완료/만료/환불)
  updateStatus: protectedProcedure
    .input(z.object({ packageId: z.number(), status: z.enum(["active", "paused", "completed", "expired", "refunded"]) }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [pkg] = await db.select({
        trainerId: ptPackages.trainerId, memberId: ptPackages.memberId,
        paymentAmount: ptPackages.paymentAmount, packageName: ptPackages.packageName,
        status: ptPackages.status,
      }).from(ptPackages).where(eq(ptPackages.id, input.packageId)).limit(1);
      if (!pkg) throw new TRPCError({ code: "NOT_FOUND" });
      const isAdmin = ctx.user.role === "admin" || ctx.user.role === "sub_admin";
      if (!isAdmin && (!ctx.user.trainerId || pkg.trainerId !== ctx.user.trainerId))
        throw new TRPCError({ code: "FORBIDDEN", message: "본인 담당 회원만 변경할 수 있습니다." });
      await db.update(ptPackages).set({ status: input.status, updatedAt: new Date().toISOString() }).where(eq(ptPackages.id, input.packageId));

      if (input.status === "refunded" && pkg.status === "active" && pkg.memberId) {
        const { pool } = await import("./db");
        const [mem] = await db.select({ name: members.name, phone: members.phone, branchId: members.branchId, membershipEnd: members.membershipEnd })
          .from(members).where(eq(members.id, pkg.memberId)).limit(1);

        let refundAmt = pkg.paymentAmount ?? 0;
        let memo = `${pkg.packageName || "PT"} 환불`;
        const tableExists = await pool.query(
          `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'refund_contracts' LIMIT 1`
        ).then(r => r.rows.length > 0).catch(() => false);
        const contractRow = tableExists ? await pool.query(
          `SELECT "refundAmount", "penaltyAmount", "taxAmount", "serviceItems", token, status
           FROM refund_contracts
           WHERE "memberId" = $1 AND ("packageId" = $2 OR "packageId" IS NULL)
           ORDER BY "createdAt" DESC LIMIT 1`,
          [pkg.memberId, input.packageId]
        ).catch(() => ({ rows: [] })) : { rows: [] };
        if (contractRow.rows.length > 0) {
          const rc = contractRow.rows[0];
          refundAmt = rc.refundAmount || refundAmt;
          const parts: string[] = [];
          if (rc.penaltyAmount > 0) parts.push(`위약금 ${rc.penaltyAmount.toLocaleString()}원`);
          if (rc.taxAmount > 0) parts.push(`부가세 ${rc.taxAmount.toLocaleString()}원`);
          const svcItems = (() => { try { return JSON.parse(rc.serviceItems || "[]"); } catch { return []; } })();
          for (const si of svcItems) { if (si.amount > 0) parts.push(`${si.label} ${si.amount.toLocaleString()}원`); }
          memo = `${pkg.packageName || "PT"} 환불` + (parts.length ? ` (공제: ${parts.join(", ")})` : "");
          if (rc.status === "pending") {
            await pool.query(`UPDATE refund_contracts SET status = 'completed' WHERE token = $1`, [rc.token]);
          }
        }

        if (refundAmt > 0) {
          const existingRefund = await db.select({ id: revenueEntries.id }).from(revenueEntries)
            .where(and(
              eq(revenueEntries.memberId, pkg.memberId),
              eq(revenueEntries.subType, "환불"),
              sql`"paidAmount" < 0`,
            )).limit(1);
          if (existingRefund.length === 0) {
            await db.insert(revenueEntries).values({
              memberId: pkg.memberId, trainerId: pkg.trainerId,
              branchId: mem?.branchId ?? null, createdBy: ctx.user.id,
              customerName: mem?.name ?? "", phone: mem?.phone ?? null,
              programDetail: `${pkg.packageName || "PT"} 환불`,
              type: "PT", subType: "환불",
              amount: refundAmt, discountAmount: 0,
              paidAmount: -refundAmt, unpaidAmount: 0, refundAmount: refundAmt,
              paymentDate: kstDate(), memo,
            });
          }
        }
        const remainActive = await db.select({ id: ptPackages.id }).from(ptPackages)
          .where(and(eq(ptPackages.memberId, pkg.memberId), eq(ptPackages.status, "active"))).limit(1);
        if (remainActive.length === 0) {
          const today = kstDate();
          if (!mem?.membershipEnd || mem.membershipEnd <= today) {
            await db.update(members).set({ status: "ended", updatedAt: new Date().toISOString() })
              .where(eq(members.id, pkg.memberId));
          }
        }
      }
      return { success: true };
    }),

  deletePackage: protectedProcedure
    .input(z.object({ packageId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { pool } = await import("./db");
      const pkgRow = await pool.query<{ trainerId: number | null; revenueEntryId: number | null }>(
        `SELECT "trainerId", "revenueEntryId" FROM pt_packages WHERE id = $1 LIMIT 1`,
        [input.packageId]
      );
      if (pkgRow.rows.length === 0) throw new TRPCError({ code: "NOT_FOUND" });
      const pkg = pkgRow.rows[0];
      const isAdmin = ctx.user.role === "admin" || ctx.user.role === "sub_admin";
      if (!isAdmin && (!ctx.user.trainerId || pkg.trainerId !== ctx.user.trainerId))
        throw new TRPCError({ code: "FORBIDDEN", message: "본인 담당 회원만 삭제할 수 있습니다." });
      await db.delete(ptPackages).where(eq(ptPackages.id, input.packageId));
      if (pkg.revenueEntryId) {
        await db.delete(revenueEntries).where(eq(revenueEntries.id, pkg.revenueEntryId));
      }
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

  // 회원 전체 정지 (PT + 헬스 + 락커 + 운동복) - 종료일 포함
  pauseMemberAll: protectedProcedure
    .input(z.object({
      memberId: z.number(),
      pauseStart: z.string(),
      pauseEnd: z.string(),
      reason: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const now = new Date().toISOString();

      const startDate = new Date(input.pauseStart);
      const endDate = new Date(input.pauseEnd);
      const pauseDays = Math.max(0, Math.ceil((endDate.getTime() - startDate.getTime()) / 86400000));

      // 1. 회원 상태 정지
      await db.update(members).set({ status: "paused", updatedAt: now }).where(eq(members.id, input.memberId));

      // 2. 진행 중인 PT 패키지 정지 + 정지 기록 추가 (start+end 모두)
      const activePkgs = await db.select({ id: ptPackages.id })
        .from(ptPackages)
        .where(and(eq(ptPackages.memberId, input.memberId), eq(ptPackages.status, "active")));
      for (const pkg of activePkgs) {
        await db.update(ptPackages).set({ status: "paused" }).where(eq(ptPackages.id, pkg.id));
        await db.insert(ptPauses).values({
          packageId: pkg.id,
          memberId: input.memberId,
          pauseStart: input.pauseStart,
          pauseEnd: input.pauseEnd,
          reason: input.reason ?? null,
        });
      }

      if (pauseDays > 0) {
        // 3. 헬스권 기간 연장 (pauseDays 누적)
        await pool.query(
          `UPDATE revenue_entries
           SET "pauseDays" = COALESCE("pauseDays", 0) + $1
           WHERE "memberId" = $2 AND type = '헬스'`,
          [pauseDays, input.memberId]
        );
        // 4. 락커 만료일 연장
        await pool.query(
          `UPDATE lockers
           SET "endDate" = ("endDate"::date + ($1 || ' days')::interval)::date::text
           WHERE "memberId" = $2 AND "endDate" IS NOT NULL`,
          [pauseDays, input.memberId]
        );
        // 5. 운동복 만료일 연장
        await pool.query(
          `UPDATE uniforms
           SET "endDate" = ("endDate"::date + ($1 || ' days')::interval)::date::text
           WHERE "memberId" = $2 AND "endDate" IS NOT NULL`,
          [pauseDays, input.memberId]
        );
      }

      return { ok: true, pauseDays };
    }),

  // 회원 전체 활성화 (PT 패키지 재활성화)
  activateMemberAll: protectedProcedure
    .input(z.object({ memberId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const now = new Date().toISOString();

      // 1. 회원 상태 활성화
      await db.update(members).set({ status: "active", updatedAt: now }).where(eq(members.id, input.memberId));

      // 2. 정지된 PT 패키지 재활성화
      await db.update(ptPackages).set({ status: "active" })
        .where(and(eq(ptPackages.memberId, input.memberId), eq(ptPackages.status, "paused")));

      return { ok: true };
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
      .where(and(eq(members.trainerId, trainerId), hasPtPackage))
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

      const today = kstDate();

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

    const trainerList = await db.select().from(trainers).orderBy(trainers.trainerName);
    return Promise.all(trainerList.map(async (t) => {
      const [memberCountResult, settingsResult] = await Promise.all([
        db.select({ count: sql`COUNT(*)` }).from(members).where(eq(members.trainerId, t.id)),
        db.select({ settlementRate: trainerSettings.settlementRate }).from(trainerSettings).where(eq(trainerSettings.trainerId, t.id)).limit(1),
      ]);
      return {
        ...t,
        memberCount: Number((memberCountResult[0] as any)?.count ?? 0),
        settlementRate: settingsResult[0]?.settlementRate ?? 50,
      };
    }));
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
      db.select({ count: sql<number>`COUNT(*)` }).from(members).where(and(eq(members.trainerId, trainerId), hasPtPackage)),
      db.select({ count: sql<number>`COUNT(*)` }).from(ptSessionLogs).where(eq(ptSessionLogs.trainerId, trainerId)),
      db.select({ count: sql<number>`COUNT(*)` }).from(attendanceChecks).where(and(eq(attendanceChecks.trainerId, trainerId), eq(attendanceChecks.status, "noshow"))),
      db.execute(sql`
        SELECT COUNT(DISTINCT "memberId")::int AS count FROM pt_packages
        WHERE "trainerId" = ${trainerId}
          AND "totalSessions" > 0 AND "usedSessions" >= "totalSessions"
          AND "memberId" NOT IN (
            SELECT "memberId" FROM pt_packages
            WHERE "trainerId" = ${trainerId} AND "usedSessions" < "totalSessions"
          )
      `),
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
    const totalChurned = Number(((churnedResult as any).rows ?? churnedResult)[0]?.count ?? 0);
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

      // 트레이너 본인 userId + 회원별 상담 담당자(consultantId) 조회
      const [trainerRow] = await db.select({ userId: trainers.userId }).from(trainers).where(eq(trainers.id, input.trainerId)).limit(1);
      const trainerUserId = trainerRow?.userId ?? null;

      // 신규 vs 재등록 구분: 이번달 이전에 패키지가 있으면 재등록
      const memberIds = [...new Set(monthPackages.map(p => p.memberId))];
      const memberConsultant = new Map<number, number | null>();
      if (memberIds.length > 0) {
        const mrows = await db.select({ id: members.id, consultantId: members.consultantId })
          .from(members).where(inArray(members.id, memberIds));
        for (const mr of mrows) memberConsultant.set(mr.id, mr.consultantId ?? null);
      }

      let reregCount = 0;
      let newCount = 0;
      let revenue = 0;
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
          const isNewMember = prior.length === 0;
          if (!isNewMember) {
            reregCount += pkgsThisMonth.length;
          } else {
            newCount += 1;
            reregCount += pkgsThisMonth.length - 1;
          }
          // 매출 귀속: 신규배정 패키지는 상담 담당자 = 트레이너 본인일 때만 이 트레이너 매출로 인정.
          // (상담 담당자가 다른 사람이면 그 신규 등록 매출은 트레이너 매출에서 제외)
          const consultantId = memberConsultant.get(memberId) ?? null;
          const consultantIsTrainer = consultantId == null || (trainerUserId != null && consultantId === trainerUserId);
          for (const p of pkgsThisMonth) {
            const isNewAssignPkg = isNewMember && p.id === earliest.id;
            if (isNewAssignPkg && !consultantIsTrainer) continue; // 다른 상담 담당자의 신규배정 → 제외
            revenue += p.paymentAmount ?? 0;
          }
        }));
      }

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
    .input(z.object({ trainerId: z.number(), yearMonth: z.string(), dateFilter: z.string().optional(), branchId: z.number().optional() }))
    .query(async ({ ctx, input }) => {
      if (ctx.user?.role !== "admin" && ctx.user?.trainerId !== input.trainerId) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [settingsRow, gymSettingsRow] = await Promise.all([
        db.select({ settlementRate: trainerSettings.settlementRate })
          .from(trainerSettings)
          .where(eq(trainerSettings.trainerId, input.trainerId))
          .limit(1),
        db.execute(sql`SELECT "servicePtUnitPrice" FROM gym_settings WHERE id = 1 LIMIT 1`),
      ]);
      const settlementRate = settingsRow[0]?.settlementRate ?? 50;
      const defaultSvcPrice = Number(((gymSettingsRow as any).rows ?? gymSettingsRow)[0]?.servicePtUnitPrice ?? 0);

      const [sessionLogs, attRows] = await Promise.all([
        db.select({
          id: ptSessionLogs.id,
          memberId: ptSessionLogs.memberId,
          memberNameSnapshot: ptSessionLogs.memberName,
          sessionDate: ptSessionLogs.sessionDate,
          pricePerSession: ptPackages.pricePerSession,
          paymentAmount: ptPackages.paymentAmount,
          totalSessions: ptPackages.totalSessions,
          paymentMethod: ptPackages.paymentMethod,
          packageName: ptPackages.packageName,
          memberNameJoined: members.name,
          isServiceSession: ptSessionLogs.isServiceSession,
          serviceSessionPrice: ptPackages.serviceSessionPrice,
          serviceSamePrice: ptPackages.serviceSamePrice,
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
              ...(input.branchId ? [eq(members.branchId, input.branchId)] : []),
            )
          )
          .orderBy(desc(ptSessionLogs.sessionDate)),
        db.select({
          memberId: attendanceChecks.memberId,
          checkDate: attendanceChecks.checkDate,
          memberName: members.name,
          memberBranchId: members.branchId,
        })
          .from(attendanceChecks)
          .leftJoin(members, eq(attendanceChecks.memberId, members.id))
          .where(
            and(
              eq(attendanceChecks.trainerId, input.trainerId),
              eq(attendanceChecks.status, "attended"),
              input.dateFilter
                ? eq(attendanceChecks.checkDate, input.dateFilter)
                : and(
                    gte(attendanceChecks.checkDate, `${input.yearMonth}-01`),
                    lte(attendanceChecks.checkDate, `${input.yearMonth}-31`),
                  ),
              ...(input.branchId ? [eq(members.branchId, input.branchId)] : []),
            )
          ),
      ]);

      // 회원별 세션 카운트: 출석체크 있는 회원 → 출석만 카운트, 없는 회원 → 세션기록 카운트
      const membersWithAtt = new Set<number>();
      for (const a of attRows) membersWithAtt.add(a.memberId);

      const sessionByKey = new Map<string, typeof sessionLogs[number]>();
      for (const l of sessionLogs) {
        const key = `${l.memberId}|${l.sessionDate}`;
        if (!sessionByKey.has(key)) sessionByKey.set(key, l);
      }

      const resultEntries: (typeof sessionLogs[number])[] = [];
      for (const a of attRows) {
        const sessionLog = sessionByKey.get(`${a.memberId}|${a.checkDate}`);
        resultEntries.push(sessionLog ?? {
          id: -a.memberId,
          memberId: a.memberId,
          memberNameSnapshot: a.memberName,
          sessionDate: a.checkDate,
          pricePerSession: null,
          paymentAmount: null,
          totalSessions: null,
          paymentMethod: null,
          packageName: null,
          memberNameJoined: a.memberName,
          isServiceSession: 0,
          serviceSessionPrice: null,
          serviceSamePrice: null,
        });
      }
      const addedLogKeys = new Set<string>();
      for (const l of sessionLogs) {
        if (membersWithAtt.has(l.memberId)) continue;
        const key = `${l.memberId}|${l.sessionDate}`;
        if (addedLogKeys.has(key)) continue;
        addedLogKeys.add(key);
        resultEntries.push(l);
      }

      const logs = resultEntries
        .sort((a, b) => (b.sessionDate ?? "").localeCompare(a.sessionDate ?? ""));

      // 단가 폴백 1: 회원의 모든 패키지에서 가격/패키지명 조회
      const allLogMemberIds = [...new Set(logs.map(l => l.memberId))];
      const memberPkgMap: Record<number, { pricePerSession: number | null; paymentAmount: number | null; totalSessions: number | null; packageName: string | null; paymentMethod: string | null }> = {};
      if (allLogMemberIds.length > 0) {
        const fallbackPkgs = await db.select({
          memberId: ptPackages.memberId,
          pricePerSession: ptPackages.pricePerSession,
          paymentAmount: ptPackages.paymentAmount,
          totalSessions: ptPackages.totalSessions,
          packageName: ptPackages.packageName,
          paymentMethod: ptPackages.paymentMethod,
        }).from(ptPackages).where(and(inArray(ptPackages.memberId, allLogMemberIds), inArray(ptPackages.status, ["active", "completed"]))).orderBy(desc(ptPackages.createdAt)); // 완료 패키지도 단가 폴백 대상에 포함 (완료 후 활성 패키지가 없어 정산 0원이 되는 사고 방지 — 원칙 8)
        // 단가 있는 활성 패키지를 우선 폴백으로 (없으면 최신 활성). "기타"는 실제 PT 프로그램이
        // 아닌 1회성 부가항목이므로 다른 단가있는 패키지가 있으면 후순위로 둔다.
        const isPriced = (p: any) => (p.pricePerSession ?? 0) > 0 || (p.paymentAmount ?? 0) > 0;
        const isRealProgram = (p: any) => p.packageName !== "기타";
        for (const p of fallbackPkgs) {
          const cur = memberPkgMap[p.memberId];
          if (!cur) { memberPkgMap[p.memberId] = p; continue; }
          const curBetter = isPriced(cur) && isRealProgram(cur);
          const pBetter = isPriced(p) && isRealProgram(p);
          if (pBetter && !curBetter) memberPkgMap[p.memberId] = p;
          else if (!curBetter && isPriced(p) && !isPriced(cur)) memberPkgMap[p.memberId] = p;
        }
      }

      // 단가 폴백 2: revenue_entries에서 실결제액 / 총세션 계산
      const memberRevenueMap: Record<number, number> = {};
      if (allLogMemberIds.length > 0) {
        const revRows = await db.select({
          memberId: revenueEntries.memberId,
          paidAmount: revenueEntries.paidAmount,
          sessions: revenueEntries.sessions,
        }).from(revenueEntries).where(
          and(inArray(revenueEntries.memberId, allLogMemberIds), eq(revenueEntries.trainerId, input.trainerId))
        );
        const totals: Record<number, { paid: number; sessions: number }> = {};
        for (const r of revRows) {
          if (!r.memberId) continue;
          if (!totals[r.memberId]) totals[r.memberId] = { paid: 0, sessions: 0 };
          totals[r.memberId].paid += r.paidAmount ?? 0;
          totals[r.memberId].sessions += r.sessions ?? 0;
        }
        for (const [mid, t] of Object.entries(totals)) {
          if (t.sessions > 0) memberRevenueMap[Number(mid)] = Math.round(t.paid / t.sessions);
        }
      }

      const calcPrice = (l: { memberId: number; pricePerSession: number | null; paymentAmount: number | null; totalSessions: number | null; paymentMethod?: string | null; isServiceSession?: number | null; serviceSessionPrice?: number | null; serviceSamePrice?: number | null; packageName?: string | null }) => {
        // 서비스 세션인 경우: serviceSamePrice=1이면 정규 회당 단가로 정산, 아니면 serviceSessionPrice 사용
        const isSvc = l.isServiceSession === 1 || l.packageName === "서비스세션";
        if (isSvc && l.serviceSamePrice !== 1) {
          return l.serviceSessionPrice ?? defaultSvcPrice;
        }
        // 혼합 결제는 저장된 pricePerSession 직접 사용
        if (l.paymentMethod === "혼합") return l.pricePerSession ?? 0;
        // paymentAmount 기준 계산 우선 (pricePerSession은 갱신 안 됐을 수 있음)
        if (l.paymentAmount && l.totalSessions && l.totalSessions > 0)
          return Math.round(calcPricePerSession(l.paymentAmount, l.totalSessions, l.paymentMethod ?? undefined) ?? 0);
        if (l.pricePerSession) return l.pricePerSession;
        const fb = memberPkgMap[l.memberId];
        if (fb?.paymentMethod === "혼합") return fb.pricePerSession ?? 0;
        if (fb?.paymentAmount && fb?.totalSessions && fb.totalSessions > 0)
          return Math.round(calcPricePerSession(fb.paymentAmount, fb.totalSessions, fb.paymentMethod ?? undefined) ?? 0);
        if (fb?.pricePerSession) return fb.pricePerSession;
        return memberRevenueMap[l.memberId] ?? 0;
      };

      const logsWithPrice = logs
        .filter(l => l.memberNameSnapshot != null || l.memberNameJoined != null)  // 탈퇴회원 제외
        .map(l => ({
          ...l,
          effectivePrice: calcPrice(l),
          packageName: l.packageName ?? memberPkgMap[l.memberId]?.packageName ?? null,
          memberName: l.memberNameJoined ?? l.memberNameSnapshot ?? "",
        }));
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

    const kstToday = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
    const kstDateStr = `${kstToday.getFullYear()}-${String(kstToday.getMonth() + 1).padStart(2, "0")}-${String(kstToday.getDate()).padStart(2, "0")}`;

    const result = await Promise.all(
      trainerList.map(async (trainer) => {
        const [trainerMembers, settings, trainerBranchList] = await Promise.all([
          db.select({ status: members.status, membershipEnd: members.membershipEnd }).from(members).where(eq(members.trainerId, trainer.id)),
          db.select({ settlementRate: trainerSettings.settlementRate }).from(trainerSettings).where(eq(trainerSettings.trainerId, trainer.id)).limit(1),
          db.select({ branchId: trainerBranches.branchId, branchName: branches.name })
            .from(trainerBranches)
            .leftJoin(branches, eq(trainerBranches.branchId, branches.id))
            .where(eq(trainerBranches.trainerId, trainer.id)),
        ]);
        const totalCount = trainerMembers.filter(m => m.status !== "ended").length;
        const activeCount = trainerMembers.filter(m => m.status === "active" && (!m.membershipEnd || m.membershipEnd >= kstDateStr)).length;
        const pausedCount = trainerMembers.filter(m => m.status === "paused").length;
        const expiredCount = trainerMembers.filter(m => {
          if (m.status === "ended") return false;
          if (m.status === "paused") return false;
          if (m.status === "inactive") return true;
          return m.membershipEnd != null && m.membershipEnd < kstDateStr;
        }).length;
        return {
          ...trainer,
          memberCount: totalCount,
          activeCount,
          pausedCount,
          expiredCount,
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

      if ((p as any).membershipType === "헬스" && p.membershipStart) {
        const today = new Date().toISOString().substring(0, 10);
        await db.insert(revenueEntries).values({
          type: "헬스",
          subType: "이전",
          memberId: newMember.id,
          customerName: p.name,
          phone: p.phone ?? null,
          amount: p.paymentAmount ?? 0,
          paidAmount: p.paymentAmount ?? 0,
          unpaidAmount: p.unpaidAmount ?? 0,
          discountAmount: 0,
          refundAmount: 0,
          paymentMethod: (p.paymentMethod as any) ?? null,
          paymentDate: today,
          startDate: p.membershipStart ?? null,
          trainerId: input.trainerId,
          createdBy: ctx.user!.id,
          updatedAt: new Date().toISOString(),
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

  // 트레이너 미배정 실제 회원 목록 (members 테이블에서 trainerId NULL)
  listUnassignedMembers: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user?.role !== "admin" && ctx.user?.role !== "sub_admin")
      throw new TRPCError({ code: "FORBIDDEN" });
    const db = await getDb();
    if (!db) return [];

    const rows = await db
      .select({
        id: members.id,
        name: members.name,
        phone: members.phone,
        status: members.status,
        createdAt: members.createdAt,
      })
      .from(members)
      .where(isNull(members.trainerId))
      .orderBy(desc(members.createdAt));

    const withPt = await Promise.all(rows.map(async (m) => {
      const pkgs = await db
        .select({ totalSessions: ptPackages.totalSessions, usedSessions: ptPackages.usedSessions })
        .from(ptPackages)
        .where(and(eq(ptPackages.memberId, m.id), eq(ptPackages.status, "active")));
      const remainingPt = pkgs.reduce((s, p) => s + (p.totalSessions - p.usedSessions), 0);
      return { ...m, remainingPt };
    }));

    // PT 계약(활성 패키지)이 있는 회원만 표시
    return withPt.filter((m) => m.remainingPt > 0);
  }),

  // 지점 미배정 회원 목록 (members.branchId NULL)
  listUnassignedBranchMembers: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user?.role !== "admin" && ctx.user?.role !== "sub_admin")
      throw new TRPCError({ code: "FORBIDDEN" });
    const db = await getDb();
    if (!db) return [];

    return db
      .select({
        id: members.id,
        name: members.name,
        phone: members.phone,
        status: members.status,
        trainerId: members.trainerId,
        trainerName: trainers.trainerName,
        createdAt: members.createdAt,
      })
      .from(members)
      .leftJoin(trainers, eq(members.trainerId, trainers.id))
      .where(isNull(members.branchId))
      .orderBy(desc(members.createdAt));
  }),

  // 회원에 지점 배정 (members.branchId 업데이트)
  assignBranchToMember: protectedProcedure
    .input(z.object({ memberId: z.number(), branchId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user?.role !== "admin" && ctx.user?.role !== "sub_admin")
        throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      await db.update(members)
        .set({ branchId: input.branchId })
        .where(eq(members.id, input.memberId));
      return { success: true };
    }),

  // 트레이너 미배정 매출 건 목록 (revenue_entries.trainerId NULL)
  listUnassignedRevenue: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user?.role !== "admin" && ctx.user?.role !== "sub_admin")
      throw new TRPCError({ code: "FORBIDDEN" });
    const db = await getDb();
    if (!db) return [];

    return db
      .select({
        id: revenueEntries.id,
        customerName: revenueEntries.customerName,
        phone: revenueEntries.phone,
        type: revenueEntries.type,
        subType: revenueEntries.subType,
        programDetail: revenueEntries.programDetail,
        paidAmount: revenueEntries.paidAmount,
        paymentDate: revenueEntries.paymentDate,
        sessions: revenueEntries.sessions,
      })
      .from(revenueEntries)
      .where(and(isNull(revenueEntries.trainerId), eq(revenueEntries.type, "PT")))
      .orderBy(desc(revenueEntries.paymentDate));
  }),

  // 매출 건에 트레이너 배정
  assignTrainerToRevenue: protectedProcedure
    .input(z.object({ revenueId: z.number(), trainerId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user?.role !== "admin" && ctx.user?.role !== "sub_admin")
        throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // 매출 상세 조회
      const [rev] = await db.select().from(revenueEntries).where(eq(revenueEntries.id, input.revenueId)).limit(1);
      if (!rev) throw new TRPCError({ code: "NOT_FOUND" });

      // 매출에 트레이너 배정
      await db.update(revenueEntries)
        .set({ trainerId: input.trainerId })
        .where(eq(revenueEntries.id, input.revenueId));

      if (rev.memberId) {
        // 회원에도 트레이너 배정
        await db.update(members)
          .set({ trainerId: input.trainerId })
          .where(eq(members.id, rev.memberId));

        // PT 패키지가 없으면 매출 정보로 생성
        const existingPkgs = await db.select({ id: ptPackages.id }).from(ptPackages)
          .where(eq(ptPackages.memberId, rev.memberId));

        if (existingPkgs.length === 0 && rev.sessions) {
          const svcSessions = (rev as any).serviceSessions ?? 0;
          await db.insert(ptPackages).values({
            memberId: rev.memberId,
            trainerId: input.trainerId,
            totalSessions: rev.sessions + svcSessions,
            serviceSessions: svcSessions,
            usedSessions: 0,
            packageName: rev.programDetail ?? null,
            startDate: rev.startDate ?? rev.paymentDate,
            status: "active",
            price: rev.amount,
            paymentAmount: rev.paidAmount,
            unpaidAmount: rev.unpaidAmount,
            paymentMethod: rev.paymentMethod ?? null,
            paymentDate: rev.paymentDate,
          });
        } else if (existingPkgs.length > 0) {
          // 기존 패키지에 trainerId만 업데이트
          await db.update(ptPackages)
            .set({ trainerId: input.trainerId })
            .where(and(eq(ptPackages.memberId, rev.memberId), isNull(ptPackages.trainerId)));
        }
      }

      return { success: true };
    }),

  // 미배정 회원에 트레이너 배정
  assignTrainerToMember: protectedProcedure
    .input(z.object({ memberId: z.number(), trainerId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user?.role !== "admin" && ctx.user?.role !== "sub_admin")
        throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      await db.update(members)
        .set({ trainerId: input.trainerId })
        .where(eq(members.id, input.memberId));

      // PT 패키지도 trainerId 업데이트 (진행 중인 패키지만 — 완료/환불된 과거 패키지는
      // 정산 소급 방지를 위해 건드리지 않는다. 예전엔 trainerId가 NULL일 때만 채워서,
      // 이미 다른 트레이너로 값이 들어있던 패키지는 재배정해도 안 옮겨지는 사고가 있었다.)
      await db.update(ptPackages)
        .set({ trainerId: input.trainerId })
        .where(and(eq(ptPackages.memberId, input.memberId), eq(ptPackages.status, "active")));

      return { success: true };
    }),

  // 지점 미배정 매출 목록 (revenue_entries.branchId NULL)
  listUnassignedBranchRevenue: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user?.role !== "admin" && ctx.user?.role !== "sub_admin")
      throw new TRPCError({ code: "FORBIDDEN" });
    const db = await getDb();
    if (!db) return [];
    return db
      .select({
        id: revenueEntries.id,
        customerName: revenueEntries.customerName,
        type: revenueEntries.type,
        subType: revenueEntries.subType,
        amount: revenueEntries.amount,
        paidAmount: revenueEntries.paidAmount,
        paymentDate: revenueEntries.paymentDate,
        trainerName: trainers.trainerName,
      })
      .from(revenueEntries)
      .leftJoin(trainers, eq(revenueEntries.trainerId, trainers.id))
      .where(isNull(revenueEntries.branchId))
      .orderBy(desc(revenueEntries.paymentDate))
      .limit(100);
  }),

  // 매출 건에 지점 배정
  assignBranchToRevenue: protectedProcedure
    .input(z.object({ revenueId: z.number(), branchId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user?.role !== "admin" && ctx.user?.role !== "sub_admin")
        throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.update(revenueEntries).set({ branchId: input.branchId }).where(eq(revenueEntries.id, input.revenueId));
      return { success: true };
    }),

  bulkAssignBranchToRevenue: protectedProcedure
    .input(z.object({ revenueIds: z.array(z.number()), branchId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user?.role !== "admin" && ctx.user?.role !== "sub_admin")
        throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.update(revenueEntries).set({ branchId: input.branchId }).where(inArray(revenueEntries.id, input.revenueIds));
      return { count: input.revenueIds.length };
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
          memberId: ptSessionLogs.memberId,
          pricePerSession: ptPackages.pricePerSession,
          paymentAmount: ptPackages.paymentAmount,
          totalSessions: ptPackages.totalSessions,
          paymentMethod: ptPackages.paymentMethod,
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

      // packageId 없는 세션은 회원 패키지로 단가 폴백
      const noPackageMemberIds2 = [...new Set(
        monthLogs.filter(l => !l.pricePerSession && !l.paymentAmount).map(l => l.memberId)
      )];
      const memberPkgMap2: Record<number, { pricePerSession: number | null; paymentAmount: number | null; totalSessions: number | null; paymentMethod: string | null }> = {};
      if (noPackageMemberIds2.length > 0) {
        const fallbackPkgs = await db.select({
          memberId: ptPackages.memberId,
          pricePerSession: ptPackages.pricePerSession,
          paymentAmount: ptPackages.paymentAmount,
          totalSessions: ptPackages.totalSessions,
          paymentMethod: ptPackages.paymentMethod,
        }).from(ptPackages).where(inArray(ptPackages.memberId, noPackageMemberIds2)).orderBy(desc(ptPackages.createdAt));
        for (const p of fallbackPkgs) {
          if (!memberPkgMap2[p.memberId]) memberPkgMap2[p.memberId] = p;
        }
      }

      const calcPrice = (l: { memberId: number; pricePerSession: number | null; paymentAmount: number | null; totalSessions: number | null; paymentMethod?: string | null }) => {
        if (l.paymentMethod === "혼합") return l.pricePerSession ?? 0;
        if (l.paymentAmount && l.totalSessions && l.totalSessions > 0)
          return Math.round(calcPricePerSession(l.paymentAmount, l.totalSessions, l.paymentMethod ?? undefined) ?? 0);
        if (l.pricePerSession) return l.pricePerSession;
        const fb = memberPkgMap2[l.memberId];
        if (fb?.paymentMethod === "혼합") return fb.pricePerSession ?? 0;
        if (fb?.paymentAmount && fb?.totalSessions && fb.totalSessions > 0)
          return Math.round(calcPricePerSession(fb.paymentAmount, fb.totalSessions) ?? 0);
        if (fb?.pricePerSession) return fb.pricePerSession;
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
    .input(z.object({ yearMonth: z.string(), branchId: z.number().optional() }))
    .query(async ({ ctx, input }) => {
      if (ctx.user?.role !== "admin" && ctx.user?.role !== "sub_admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = getDb();
      const today = kstDate();
      const gsRow = await db.execute(sql`SELECT "servicePtUnitPrice" FROM gym_settings WHERE id = 1 LIMIT 1`);
      const defaultSvcPrice = Number(((gsRow as any).rows ?? gsRow)[0]?.servicePtUnitPrice ?? 0);
      const monthStart = `${input.yearMonth}-01`;
      const monthEnd = new Date(
        parseInt(input.yearMonth.split("-")[0]),
        parseInt(input.yearMonth.split("-")[1]),
        1
      ).toISOString().split("T")[0];

      const trainerList = await db.select().from(trainers).orderBy(trainers.trainerName);

      const trainerRows = await Promise.all(trainerList.map(async (trainer) => {
        const [settings, logs, attRows] = await Promise.all([
          db.select({ settlementRate: trainerSettings.settlementRate })
            .from(trainerSettings)
            .where(eq(trainerSettings.trainerId, trainer.id))
            .limit(1),
          db.select({
            memberId: ptSessionLogs.memberId,
            sessionDate: ptSessionLogs.sessionDate,
            pricePerSession: ptPackages.pricePerSession,
            paymentAmount: ptPackages.paymentAmount,
            totalSessions: ptPackages.totalSessions,
            paymentMethod: ptPackages.paymentMethod,
            packageName: ptPackages.packageName,
            isServiceSession: ptSessionLogs.isServiceSession,
            serviceSessionPrice: ptPackages.serviceSessionPrice,
            serviceSamePrice: ptPackages.serviceSamePrice,
            memberBranchId: members.branchId,
          })
            .from(ptSessionLogs)
            .leftJoin(ptPackages, eq(ptSessionLogs.packageId, ptPackages.id))
            .leftJoin(members, eq(ptSessionLogs.memberId, members.id))
            .where(and(
              eq(ptSessionLogs.trainerId, trainer.id),
              sql`${ptSessionLogs.sessionDate} >= ${monthStart}`,
              sql`${ptSessionLogs.sessionDate} < ${monthEnd}`,
            )),
          db.select({
            memberId: attendanceChecks.memberId,
            checkDate: attendanceChecks.checkDate,
            memberBranchId: members.branchId,
          })
            .from(attendanceChecks)
            .leftJoin(members, eq(attendanceChecks.memberId, members.id))
            .where(and(
              eq(attendanceChecks.trainerId, trainer.id),
              eq(attendanceChecks.status, "attended"),
              sql`${attendanceChecks.checkDate} >= ${monthStart}`,
              sql`${attendanceChecks.checkDate} < ${monthEnd}`,
            )),
        ]);

        // 회원별 세션 카운트: 출석체크 있는 회원 → 출석만 카운트, 없는 회원 → 세션기록 카운트
        const membersWithAtt = new Set<number>();
        for (const a of attRows) membersWithAtt.add(a.memberId);

        const sessionByKey = new Map<string, typeof logs[number]>();
        for (const l of logs) {
          const key = `${l.memberId}|${l.sessionDate}`;
          if (!sessionByKey.has(key)) sessionByKey.set(key, l);
        }

        const resultEntries: (typeof logs[number])[] = [];
        for (const a of attRows) {
          const sessionLog = sessionByKey.get(`${a.memberId}|${a.checkDate}`);
          resultEntries.push(sessionLog ?? {
            memberId: a.memberId,
            sessionDate: a.checkDate,
            pricePerSession: null,
            paymentAmount: null,
            totalSessions: null,
            paymentMethod: null,
            packageName: null,
            isServiceSession: 0,
            serviceSessionPrice: null,
            serviceSamePrice: null,
            memberBranchId: a.memberBranchId,
          });
        }
        const addedLogKeys = new Set<string>();
        for (const l of logs) {
          if (membersWithAtt.has(l.memberId)) continue;
          const key = `${l.memberId}|${l.sessionDate}`;
          if (addedLogKeys.has(key)) continue;
          addedLogKeys.add(key);
          resultEntries.push(l);
        }

        const filteredLogs = input.branchId
          ? resultEntries.filter(l => l.memberBranchId === input.branchId)
          : resultEntries;

        // packageId 없는 세션은 회원 패키지로 단가 폴백
        const allLogMemberIds = [...new Set(filteredLogs.map(l => l.memberId))];
        const memberPkgMap: Record<number, { pricePerSession: number | null; paymentAmount: number | null; totalSessions: number | null; paymentMethod: string | null }> = {};
        if (allLogMemberIds.length > 0) {
          const fallbackPkgs = await db.select({
            memberId: ptPackages.memberId,
            pricePerSession: ptPackages.pricePerSession,
            paymentAmount: ptPackages.paymentAmount,
            totalSessions: ptPackages.totalSessions,
            paymentMethod: ptPackages.paymentMethod,
            packageName: ptPackages.packageName,
          }).from(ptPackages).where(and(inArray(ptPackages.memberId, allLogMemberIds), inArray(ptPackages.status, ["active", "completed"]))).orderBy(desc(ptPackages.createdAt)); // 완료 패키지도 단가 폴백 대상에 포함 (완료 후 활성 패키지가 없어 정산 0원이 되는 사고 방지 — 원칙 8)
          // "기타"는 실제 PT 프로그램이 아닌 1회성 부가항목이므로 다른 단가있는 패키지가 있으면 후순위로 둔다.
          const isPricedPkg = (p: any) => (p.pricePerSession ?? 0) > 0 || (p.paymentAmount ?? 0) > 0;
          const isRealProgramPkg = (p: any) => p.packageName !== "기타";
          for (const p of fallbackPkgs) {
            const cur = memberPkgMap[p.memberId];
            if (!cur) { memberPkgMap[p.memberId] = p; continue; }
            const curBetter = isPricedPkg(cur) && isRealProgramPkg(cur);
            const pBetter = isPricedPkg(p) && isRealProgramPkg(p);
            if (pBetter && !curBetter) memberPkgMap[p.memberId] = p;
            else if (!curBetter && isPricedPkg(p) && !isPricedPkg(cur)) memberPkgMap[p.memberId] = p;
          }
        }

        // 패키지에도 금액 없으면 revenue_entries에서 회당 단가 계산
        const memberRevenueMap: Record<number, number> = {};
        if (allLogMemberIds.length > 0) {
          const revRows = await db.select({
            memberId: revenueEntries.memberId,
            paidAmount: revenueEntries.paidAmount,
            sessions: revenueEntries.sessions,
          }).from(revenueEntries).where(
            and(inArray(revenueEntries.memberId, allLogMemberIds), eq(revenueEntries.trainerId, trainer.id))
          );
          // 회원별로 총 paidAmount / 총 sessions → 회당 단가
          const totals: Record<number, { paid: number; sessions: number }> = {};
          for (const r of revRows) {
            if (!r.memberId) continue;
            if (!totals[r.memberId]) totals[r.memberId] = { paid: 0, sessions: 0 };
            totals[r.memberId].paid += r.paidAmount ?? 0;
            totals[r.memberId].sessions += r.sessions ?? 0;
          }
          for (const [mid, t] of Object.entries(totals)) {
            if (t.sessions > 0) memberRevenueMap[Number(mid)] = Math.round(t.paid / t.sessions);
          }
        }

        const rate = settings[0]?.settlementRate ?? 50;
        // ⚠️ 월별 정산 상세(getMonthlySettlement)와 동일한 계산식을 사용해야 두 화면 금액이 일치한다.
        const calcPrice = (l: { memberId: number; pricePerSession: number | null; paymentAmount: number | null; totalSessions: number | null; paymentMethod?: string | null; packageName?: string | null; isServiceSession?: number | null; serviceSessionPrice?: number | null; serviceSamePrice?: number | null }) => {
          // 서비스 세션: serviceSamePrice=1이면 정규 단가로, 아니면 serviceSessionPrice 사용
          const isSvc = l.isServiceSession === 1 || l.packageName === "서비스세션";
          if (isSvc && l.serviceSamePrice !== 1) return l.serviceSessionPrice ?? defaultSvcPrice;
          if (l.paymentMethod === "혼합") return l.pricePerSession ?? 0;
          // 결제금액 기준 계산 우선 (pricePerSession은 갱신 안 됐을 수 있음)
          if (l.paymentAmount && l.totalSessions && l.totalSessions > 0)
            return Math.round(calcPricePerSession(l.paymentAmount, l.totalSessions, l.paymentMethod ?? undefined) ?? 0);
          if (l.pricePerSession) return l.pricePerSession;
          const fb = memberPkgMap[l.memberId];
          if (fb?.paymentMethod === "혼합") return fb.pricePerSession ?? 0;
          if (fb?.paymentAmount && fb?.totalSessions && fb.totalSessions > 0)
            return Math.round(calcPricePerSession(fb.paymentAmount, fb.totalSessions, fb.paymentMethod ?? undefined) ?? 0);
          if (fb?.pricePerSession) return fb.pricePerSession;
          // 최후 폴백: revenue_entries 기반 회당 단가
          return memberRevenueMap[l.memberId] ?? 0;
        };
        const sessionCount = filteredLogs.length;
        const revenue = filteredLogs.reduce((s, l) => s + calcPrice(l), 0);
        const avgPrice = sessionCount > 0 ? Math.round(revenue / sessionCount) : 0;
        const settlement = Math.round(revenue * rate / 100);
        const afterTax = Math.round(settlement * (1 - 0.033));

        // 회원별 수업 횟수·단가 집계 (유료/서비스 분리)
        const memberMap: Record<number, { name: string; sessions: number; totalPrice: number; svcSessions: number; svcTotalPrice: number }> = {};
        for (const l of filteredLogs) {
          if (!memberMap[l.memberId]) memberMap[l.memberId] = { name: "", sessions: 0, totalPrice: 0, svcSessions: 0, svcTotalPrice: 0 };
          const isSvc = l.isServiceSession === 1 || l.packageName === "서비스세션";
          if (isSvc) {
            memberMap[l.memberId].svcSessions++;
            memberMap[l.memberId].svcTotalPrice += calcPrice(l);
          } else {
            memberMap[l.memberId].sessions++;
            memberMap[l.memberId].totalPrice += calcPrice(l);
          }
        }
        const memberIds = Object.keys(memberMap).map(Number);
        // 회원별 패키지 정보 (활성/누적 분리)
        type PkgSummary = {
          activeTotal: number; activeUsed: number; activeService: number;
          cumTotal: number; cumUsed: number; cumService: number;
          activeName: string | null;
        };
        const pkgInfo: Record<number, PkgSummary> = {};
        if (memberIds.length > 0) {
          const mRows = await db.select({ id: members.id, name: members.name })
            .from(members).where(inArray(members.id, memberIds));
          for (const m of mRows) {
            if (memberMap[m.id]) memberMap[m.id].name = m.name ?? `회원#${m.id}`;
          }
          const pkgRows = await db.select({
            memberId: ptPackages.memberId,
            totalSessions: ptPackages.totalSessions,
            usedSessions: ptPackages.usedSessions,
            serviceSessions: ptPackages.serviceSessions,
            status: ptPackages.status,
            packageName: ptPackages.packageName,
          }).from(ptPackages).where(and(
            inArray(ptPackages.memberId, memberIds),
            eq(ptPackages.trainerId, trainer.id),
          )).orderBy(desc(ptPackages.createdAt));
          const activeSet = new Set<number>();
          for (const p of pkgRows) {
            if (!pkgInfo[p.memberId]) pkgInfo[p.memberId] = {
              activeTotal: 0, activeUsed: 0, activeService: 0,
              cumTotal: 0, cumUsed: 0, cumService: 0,
              activeName: null,
            };
            const info = pkgInfo[p.memberId];
            info.cumTotal += p.totalSessions ?? 0;
            info.cumUsed += p.usedSessions ?? 0;
            info.cumService += p.serviceSessions ?? 0;
            if (p.status === "active" && !activeSet.has(p.memberId)) {
              activeSet.add(p.memberId);
              info.activeTotal = p.totalSessions ?? 0;
              info.activeUsed = p.usedSessions ?? 0;
              info.activeService = p.serviceSessions ?? 0;
              info.activeName = p.packageName ?? null;
            }
          }
        }
        const memberDetails = Object.entries(memberMap)
          .map(([id, v]) => {
            const nid = Number(id);
            const pkg = pkgInfo[nid];
            return {
              memberId: nid,
              name: v.name || `회원#${id}`,
              sessions: v.sessions,
              avgPrice: v.sessions > 0 ? Math.round(v.totalPrice / v.sessions) : 0,
              totalPrice: v.totalPrice,
              svcSessions: v.svcSessions,
              svcAvgPrice: v.svcSessions > 0 ? Math.round(v.svcTotalPrice / v.svcSessions) : 0,
              svcTotalPrice: v.svcTotalPrice,
              activeTotal: pkg?.activeTotal ?? 0,
              activeUsed: pkg?.activeUsed ?? 0,
              activeService: pkg?.activeService ?? 0,
              activeName: pkg?.activeName ?? null,
              cumTotal: pkg?.cumTotal ?? 0,
              cumUsed: pkg?.cumUsed ?? 0,
              cumService: pkg?.cumService ?? 0,
            };
          })
          .sort((a, b) => b.avgPrice - a.avgPrice);

        // 신규/재등록/헬스 등록 매출
        // trainerId, consultantId, 또는 배정된 회원(members.trainerId)의 매출 모두 포함
        const trainerUserId = trainer.userId;
        const assignedMemberIds = (await db.select({ id: members.id })
          .from(members).where(eq(members.trainerId, trainer.id))).map(m => m.id);

        const regRevRows = await db.select({
          memberId: revenueEntries.memberId,
          type: revenueEntries.type,
          subType: revenueEntries.subType,
          paidAmount: revenueEntries.paidAmount,
          consultantId: revenueEntries.consultantId,
          trainerId: revenueEntries.trainerId,
          channelId: revenueEntries.channelId,
          branchId: revenueEntries.branchId,
        }).from(revenueEntries).where(and(
          sql`(${revenueEntries.type} = 'PT' OR ${revenueEntries.type} = '헬스' OR ${revenueEntries.type} = '다이어트')`,
          sql`(
            ${revenueEntries.trainerId} = ${trainer.id}
            OR ${revenueEntries.consultantId} = ${trainerUserId}
            ${assignedMemberIds.length > 0
              ? sql`OR ${revenueEntries.memberId} IN (${sql.join(assignedMemberIds.map(id => sql`${id}`), sql`, `)})`
              : sql``
            }
          )`,
          sql`${revenueEntries.paymentDate} >= ${monthStart}`,
          sql`${revenueEntries.paymentDate} < ${monthEnd}`,
          ...(input.branchId ? [sql`${revenueEntries.branchId} = ${input.branchId}`] : []),
        ));
        const revMemberIds = [...new Set(regRevRows.map(r => r.memberId).filter(Boolean))] as number[];
        const revMemberNames: Record<number, string> = {};
        if (revMemberIds.length > 0) {
          const nm = await db.select({ id: members.id, name: members.name })
            .from(members).where(inArray(members.id, revMemberIds));
          for (const m of nm) revMemberNames[m.id] = m.name ?? `회원#${m.id}`;
        }
        // 유입경로 이름 조회
        const chIds = [...new Set(regRevRows.map(r => r.channelId).filter(Boolean))] as number[];
        const channelNames: Record<number, string> = {};
        if (chIds.length > 0) {
          const chRows = await db.select({ id: channels.id, name: channels.name })
            .from(channels).where(inArray(channels.id, chIds));
          for (const ch of chRows) channelNames[ch.id] = ch.name;
        }
        let newRevenue = 0, reRegRevenue = 0, healthRevenue = 0, otherRevenue = 0;
        const newMembers: { name: string; amount: number; channel: string }[] = [];
        const reRegMembers: { name: string; amount: number }[] = [];
        const healthMembers: { name: string; amount: number }[] = [];
        for (const r of regRevRows) {
          const amt = r.paidAmount ?? 0;
          const mName = r.memberId ? (revMemberNames[r.memberId] ?? `회원#${r.memberId}`) : "미지정";
          const chName = r.channelId ? (channelNames[r.channelId] ?? "") : "";

          if (r.type === "헬스" || r.type === "다이어트") {
            healthRevenue += amt;
            healthMembers.push({ name: mName, amount: amt });
            continue;
          }
          if (r.subType === "신규") {
            if (r.consultantId === trainerUserId) {
              newRevenue += amt;
              newMembers.push({ name: mName, amount: amt, channel: chName });
            }
          } else if (r.subType === "재등록") {
            reRegRevenue += amt;
            reRegMembers.push({ name: mName, amount: amt });
          } else if (r.subType !== "신규배정") {
            otherRevenue += amt;
          }
        }

        // 재등록률: 이달 패키지 완료/만료 회원 중 재등록한 비율
        const expiredPkgRows = await db.select({
          memberId: ptPackages.memberId,
        }).from(ptPackages).where(and(
          eq(ptPackages.trainerId, trainer.id),
          sql`(
            (${ptPackages.status} = 'completed' AND ${ptPackages.updatedAt} >= ${monthStart} AND ${ptPackages.updatedAt} < ${monthEnd})
            OR (${ptPackages.status} = 'active' AND ${ptPackages.expiryDate} IS NOT NULL AND ${ptPackages.expiryDate} >= ${monthStart} AND ${ptPackages.expiryDate} < ${monthEnd} AND ${ptPackages.expiryDate} < ${today})
          )`,
        ));
        const expiredMemberIds = [...new Set(expiredPkgRows.map(r => r.memberId))];
        const reRegMemberIds = expiredMemberIds.length > 0
          ? [...new Set((await db.select({ memberId: revenueEntries.memberId })
              .from(revenueEntries).where(and(
                inArray(revenueEntries.memberId, expiredMemberIds),
                eq(revenueEntries.type, "PT"),
                eq(revenueEntries.subType, "재등록"),
              ))).map(r => r.memberId))]
          : [];
        const reRegCount = reRegMemberIds.length;
        const totalExpiredCount = expiredMemberIds.length;
        const reRegRate = totalExpiredCount > 0 ? Math.round((reRegCount / totalExpiredCount) * 100) : 0;

        return {
          trainerId: trainer.id,
          trainerName: trainer.trainerName,
          sessionCount,
          revenue,
          avgPrice,
          settlementRate: rate,
          settlement,
          afterTax,
          memberDetails,
          newRevenue,
          reRegRevenue,
          healthRevenue,
          otherRevenue,
          newMembers,
          reRegMembers,
          healthMembers,
          reRegRate,
          reRegCount,
          totalExpiredCount,
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
      if (ctx.user?.role !== "admin" && ctx.user?.role !== "sub_admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const rawList = await db
        .select()
        .from(members)
        .where(eq(members.trainerId, input.trainerId))
        .orderBy(asc(members.name));

      if (rawList.length === 0) return [];

      const memberIds = rawList.map(m => m.id);

      // PT 패키지 및 누적 결제 일괄 조회
      const [pkgRows, payRows] = await Promise.all([
        db.execute(sql`
          SELECT "memberId",
                 COALESCE(SUM("totalSessions"),0)::int AS ts,
                 COALESCE(SUM("usedSessions"),0)::int  AS us,
                 COALESCE(SUM("unpaidAmount"),0)::int  AS unpaid
          FROM pt_packages
          WHERE "memberId" IN (${sql.join(memberIds.map(id => sql`${id}`), sql`,`)})
            AND status = 'active'
          GROUP BY "memberId"
        `),
        db.execute(sql`
          SELECT "memberId",
                 COALESCE(SUM("paidAmount"),0)::bigint AS total
          FROM revenue_entries
          WHERE "memberId" IN (${sql.join(memberIds.map(id => sql`${id}`), sql`,`)})
          GROUP BY "memberId"
        `),
      ]);

      const pkgMap = new Map(
        ((pkgRows as any).rows ?? pkgRows).map((r: any) => [Number(r.memberId), r])
      );
      const payMap = new Map(
        ((payRows as any).rows ?? payRows).map((r: any) => [Number(r.memberId), Number(r.total)])
      );

      // 누적결제 기준 등급 자동승급/강등 (예외 차단)
      try {
        const now = new Date().toISOString();
        const vvipIds     = rawList.filter(m => (payMap.get(m.id) ?? 0) >= 5000000 && m.grade !== "vvip").map(m => m.id);
        const vipIds      = rawList.filter(m => { const t = payMap.get(m.id) ?? 0; return t >= 3000000 && t < 5000000 && m.grade !== "vip" && m.grade !== "vvip"; }).map(m => m.id);
        const downgradeIds = rawList.filter(m => (payMap.get(m.id) ?? 0) < 3000000 && (m.grade === "vip" || m.grade === "vvip")).map(m => m.id);
        if (vvipIds.length > 0)     await db.execute(sql`UPDATE members SET grade='vvip', "updatedAt"=${now} WHERE id IN (${sql.join(vvipIds.map(id => sql`${id}`), sql`,`)})`);
        if (vipIds.length  > 0)     await db.execute(sql`UPDATE members SET grade='vip',  "updatedAt"=${now} WHERE id IN (${sql.join(vipIds.map(id => sql`${id}`), sql`,`)})`);
        if (downgradeIds.length > 0) await db.execute(sql`UPDATE members SET grade='basic',"updatedAt"=${now} WHERE id IN (${sql.join(downgradeIds.map(id => sql`${id}`), sql`,`)})`);
      } catch (_) { /* 등급 변경 실패 시 목록 조회는 계속 */ }

      return rawList.map(m => {
        const pkg          = pkgMap.get(m.id) as any;
        const totalPayment = payMap.get(m.id) ?? 0;
        const remainingPt  = pkg ? Number(pkg.ts) - Number(pkg.us) : 0;
        const hasUnpaid    = pkg ? Number(pkg.unpaid) > 0 : false;
        // 항상 실제 누적결제 기준으로 등급 결정 (DB grade 무시)
        const grade        = totalPayment >= 5000000 ? "vvip" : totalPayment >= 3000000 ? "vip" : (m.grade === "vip" || m.grade === "vvip" ? "basic" : (m.grade ?? "basic"));
        return { ...m, grade, remainingPt, hasUnpaid, totalPayment };
      });
    }),

  // 관리자: 전체 트레이너 마감 임박 회원 요약.
  // getMonthExpiring과 동일한 기준(회원별 최신 패키지만 판단, 이미 재등록한 회원은 제외)을
  // 써야 이 요약 숫자와 트레이너 상세의 실제 목록 건수가 어긋나지 않는다.
  getTrainersExpiringSummary: protectedProcedure
    .query(async ({ ctx }) => {
      if (ctx.user?.role !== "admin" && ctx.user?.role !== "sub_admin")
        throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const threshold = 5;
      const today = kstDate();

      const allActiveMembers = await db.select({ id: members.id, trainerId: members.trainerId, renewalIntent: members.renewalIntent })
        .from(members)
        .where(eq(members.status, "active"));
      const memberIds = allActiveMembers.map(m => m.id);
      const allPkgs = memberIds.length > 0 ? await db.select({
        id: ptPackages.id,
        memberId: ptPackages.memberId,
        totalSessions: ptPackages.totalSessions,
        usedSessions: ptPackages.usedSessions,
        status: ptPackages.status,
        startDate: ptPackages.startDate,
        expiryDate: ptPackages.expiryDate,
      }).from(ptPackages).where(inArray(ptPackages.memberId, memberIds)) : [];

      const todayD = new Date(today + "T00:00:00");
      const nextMonthStart = new Date(todayD.getFullYear(), todayD.getMonth() + 1, 1);
      const nextMonthEnd = new Date(todayD.getFullYear(), todayD.getMonth() + 2, 0);
      const nmStart = nextMonthStart.toISOString().substring(0, 10);
      const nmEnd = nextMonthEnd.toISOString().substring(0, 10);

      const byTrainer: Record<number, { total: number; rereg: number; churn: number }> = {};
      const byTrainerNext: Record<number, number> = {};
      for (const m of allActiveMembers) {
        if (!m.trainerId) continue;
        const pkgs = allPkgs.filter(p => p.memberId === m.id)
          .sort((a, b) => (b.startDate ?? "").localeCompare(a.startDate ?? "") || b.id - a.id);
        const latest = pkgs[0];
        if (!latest) continue;
        const remaining = (latest.totalSessions ?? 0) - (latest.usedSessions ?? 0);
        const hasNewer = pkgs.some(p => p.id !== latest.id && (p.startDate ?? "") > (latest.startDate ?? ""));
        if (hasNewer) continue;

        if (remaining <= threshold || latest.status !== "active") {
          if (!byTrainer[m.trainerId]) byTrainer[m.trainerId] = { total: 0, rereg: 0, churn: 0 };
          byTrainer[m.trainerId].total++;
          if (m.renewalIntent === "재등록예정") byTrainer[m.trainerId].rereg++;
          if (m.renewalIntent === "이탈예정") byTrainer[m.trainerId].churn++;
        } else if (latest.expiryDate && latest.expiryDate >= nmStart && latest.expiryDate <= nmEnd) {
          byTrainerNext[m.trainerId] = (byTrainerNext[m.trainerId] ?? 0) + 1;
        }
      }

      const trainerList = await db.select({ id: trainers.id }).from(trainers);
      const summary = trainerList.map(({ id: tid }) => ({
        trainerId: tid,
        total: byTrainer[tid]?.total ?? 0,
        rereg: byTrainer[tid]?.rereg ?? 0,
        churn: byTrainer[tid]?.churn ?? 0,
        nextMonth: byTrainerNext[tid] ?? 0,
      }));

      return Object.fromEntries(summary.map(s => [s.trainerId, s]));
    }),

  mergeDuplicateMembers: protectedProcedure
    .mutation(async ({ ctx }) => {
      if (ctx.user?.role !== "admin" && ctx.user?.role !== "sub_admin")
        throw new TRPCError({ code: "FORBIDDEN" });

      const { pool } = await import("./db");
      const results: { name: string; keepId: number; delId: number; status: "success" | "failed"; error?: string }[] = [];

      const dupResult = await pool.query(`
        SELECT trim(name) AS name, array_agg(id ORDER BY id ASC) AS ids
        FROM members
        WHERE length(regexp_replace(COALESCE(phone,''), '[^0-9]', '', 'g')) >= 7
        GROUP BY trim(name), regexp_replace(COALESCE(phone,''), '[^0-9]', '', 'g')
        HAVING COUNT(*) > 1
      `);

      for (const row of dupResult.rows) {
        const keepId: number = row.ids[0];
        const deleteIds: number[] = row.ids.slice(1);
        for (const delId of deleteIds) {
          try {
            await pool.query(`DELETE FROM attendances WHERE "memberId" = $1 AND "attendDate" IN (SELECT "attendDate" FROM attendances WHERE "memberId" = $2)`, [delId, keepId]);
            await pool.query(`UPDATE attendances SET "memberId" = $1 WHERE "memberId" = $2`, [keepId, delId]);
            await pool.query(`DELETE FROM attendance_checks WHERE "memberId" = $1 AND "checkDate" IN (SELECT "checkDate" FROM attendance_checks WHERE "memberId" = $2)`, [delId, keepId]);
            await pool.query(`UPDATE attendance_checks SET "memberId" = $1 WHERE "memberId" = $2`, [keepId, delId]);
            const hasParQ = await pool.query(`SELECT id FROM par_q WHERE "memberId" = $1 LIMIT 1`, [keepId]);
            if (hasParQ.rows.length > 0) {
              await pool.query(`DELETE FROM par_q WHERE "memberId" = $1`, [delId]);
            } else {
              await pool.query(`UPDATE par_q SET "memberId" = $1 WHERE "memberId" = $2`, [keepId, delId]);
            }
            const gymPlusCheck = await pool.query(`SELECT to_regclass('gym_plus_members') IS NOT NULL AS exists`);
            if (gymPlusCheck.rows[0]?.exists) {
              const gymPlusDelRow = await pool.query(`SELECT id FROM gym_plus_members WHERE "memberId" = $1 LIMIT 1`, [delId]);
              if (gymPlusDelRow.rows.length > 0) {
                const gid = gymPlusDelRow.rows[0].id;
                const gymPlusKeepRow = await pool.query(`SELECT id FROM gym_plus_members WHERE "memberId" = $1 LIMIT 1`, [keepId]);
                if (gymPlusKeepRow.rows.length > 0) {
                  for (const childTbl of ['gym_plus_messages', 'gym_plus_workout_logs', 'gym_plus_push_subscriptions']) {
                    const tblExists = await pool.query(`SELECT to_regclass($1) IS NOT NULL AS exists`, [childTbl]);
                    if (tblExists.rows[0]?.exists) {
                      await pool.query(`DELETE FROM "${childTbl}" WHERE "gymPlusMemberId" = $1`, [gid]);
                    }
                  }
                  await pool.query(`DELETE FROM gym_plus_members WHERE id = $1`, [gid]);
                } else {
                  await pool.query(`UPDATE gym_plus_members SET "memberId" = $1 WHERE id = $2`, [keepId, gid]);
                }
              }
            }
            for (const [tbl, col] of [
              ["pt_packages","memberId"],["pt_pauses","memberId"],["schedules","memberId"],
              ["pt_session_logs","memberId"],["workout_memos","memberId"],["report_tokens","memberId"],
              ["health_reports","memberId"],["pt_reports","memberId"],["payments","memberId"],
              ["revenue_entries","memberId"],["lockers","memberId"],["uniforms","memberId"],["access_logs","memberId"],
            ] as const) {
              await pool.query(`UPDATE "${tbl}" SET "${col}" = $1 WHERE "${col}" = $2`, [keepId, delId]);
            }
            await pool.query(`UPDATE leads SET "registeredMemberId" = $1 WHERE "registeredMemberId" = $2`, [keepId, delId]);
            await pool.query(`UPDATE transfer_contracts SET "transferorMemberId" = $1 WHERE "transferorMemberId" = $2`, [keepId, delId]);
            await pool.query(`UPDATE transfer_contracts SET "transfereeMemberId" = $1 WHERE "transfereeMemberId" = $2`, [keepId, delId]);
            await pool.query(`DELETE FROM members WHERE id = $1`, [delId]);
            results.push({ name: row.name, keepId, delId, status: "success" });
          } catch (e: any) {
            results.push({ name: row.name, keepId, delId, status: "failed", error: e?.message ?? String(e) });
          }
        }
      }
      return { total: dupResult.rows.length, results };
    }),

  // 관리자: 전체 트레이너 활동 통계 비교 (월별)
  getTrainerActivityStats: protectedProcedure
    .input(z.object({ yearMonth: z.string() }))
    .query(async ({ ctx, input }) => {
      if (ctx.user?.role !== "admin" && ctx.user?.role !== "sub_admin")
        throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [y, m] = input.yearMonth.split("-").map(Number);
      const monthStart = `${input.yearMonth}-01`;
      const monthEnd = new Date(y, m, 1).toISOString().split("T")[0];
      const today = kstDate();

      const trainerList = await db
        .select({ id: trainers.id, trainerName: trainers.trainerName, createdAt: trainers.createdAt })
        .from(trainers)
        .orderBy(trainers.trainerName);

      const stats = await Promise.all(trainerList.map(async (trainer) => {
        const tid = trainer.id;

        const videoCountSql = sql`
          SELECT COUNT(*)::int AS c FROM pt_session_logs s,
          LATERAL jsonb_array_elements(CASE WHEN s."exercisesJson" IS NOT NULL AND s."exercisesJson" <> '' THEN s."exercisesJson"::jsonb ELSE '[]'::jsonb END) AS ex
          WHERE s."trainerId" = ${tid} AND ex->>'videoUrl' IS NOT NULL AND ex->>'videoUrl' <> ''`;

        const [
          totalMembersRes, totalSessionsRes, totalNoShowRes, totalChurnedRes, remainingPtRes,
          monthSessionsRes, monthNoShowRes, todaySessionsRes,
          pkgCountByMember,
          totalMemosRes, monthMemosRes, todayMemosRes,
          totalVideosRes, monthVideosRes, todayVideosRes,
        ] = await Promise.all([
          db.select({ c: sql<number>`COUNT(*)` }).from(members).where(and(eq(members.trainerId, tid), hasPtPackage)),
          db.execute(sql`SELECT COUNT(*)::int AS c FROM (
            SELECT "memberId", "sessionDate" FROM pt_session_logs WHERE "trainerId" = ${tid}
              AND "memberId" NOT IN (SELECT DISTINCT "memberId" FROM attendance_checks WHERE "trainerId" = ${tid} AND status = 'attended')
            UNION ALL
            SELECT "memberId", "checkDate" FROM attendance_checks WHERE "trainerId" = ${tid} AND status = 'attended'
          ) combined`),
          db.select({ c: sql<number>`COUNT(*)` }).from(attendanceChecks).where(and(eq(attendanceChecks.trainerId, tid), eq(attendanceChecks.status, "noshow"))),
          db.execute(sql`
            SELECT COUNT(DISTINCT "memberId")::int AS c FROM pt_packages
            WHERE "trainerId" = ${tid}
              AND "totalSessions" > 0 AND "usedSessions" >= "totalSessions"
              AND "memberId" NOT IN (
                SELECT "memberId" FROM pt_packages
                WHERE "trainerId" = ${tid} AND "usedSessions" < "totalSessions"
              )
          `),
          db.select({ total: sql<number>`COALESCE(SUM(${ptPackages.totalSessions} - ${ptPackages.usedSessions}), 0)` })
            .from(ptPackages).where(and(eq(ptPackages.trainerId, tid), eq(ptPackages.status, "active"))),
          db.execute(sql`SELECT COUNT(*)::int AS c FROM (
            SELECT "memberId", "sessionDate" FROM pt_session_logs WHERE "trainerId" = ${tid} AND "sessionDate" >= ${monthStart} AND "sessionDate" < ${monthEnd}
              AND "memberId" NOT IN (SELECT DISTINCT "memberId" FROM attendance_checks WHERE "trainerId" = ${tid} AND status = 'attended' AND "checkDate" >= ${monthStart} AND "checkDate" < ${monthEnd})
            UNION ALL
            SELECT "memberId", "checkDate" FROM attendance_checks WHERE "trainerId" = ${tid} AND status = 'attended' AND "checkDate" >= ${monthStart} AND "checkDate" < ${monthEnd}
          ) combined`),
          db.select({ c: sql<number>`COUNT(*)` }).from(attendanceChecks).where(and(
            eq(attendanceChecks.trainerId, tid), eq(attendanceChecks.status, "noshow"),
            sql`${attendanceChecks.checkDate} >= ${monthStart}`,
            sql`${attendanceChecks.checkDate} < ${monthEnd}`,
          )),
          db.execute(sql`SELECT COUNT(*)::int AS c FROM (
            SELECT "memberId", "sessionDate" FROM pt_session_logs WHERE "trainerId" = ${tid} AND "sessionDate" = ${today}
              AND "memberId" NOT IN (SELECT DISTINCT "memberId" FROM attendance_checks WHERE "trainerId" = ${tid} AND status = 'attended' AND "checkDate" = ${today})
            UNION ALL
            SELECT "memberId", "checkDate" FROM attendance_checks WHERE "trainerId" = ${tid} AND status = 'attended' AND "checkDate" = ${today}
          ) combined`),
          db.select({ memberId: ptPackages.memberId, count: sql<number>`COUNT(*)` })
            .from(ptPackages).where(eq(ptPackages.trainerId, tid)).groupBy(ptPackages.memberId),
          db.select({ c: sql<number>`COUNT(*)` }).from(workoutMemos).where(eq(workoutMemos.trainerId, tid)),
          db.select({ c: sql<number>`COUNT(*)` }).from(workoutMemos).where(and(
            eq(workoutMemos.trainerId, tid),
            sql`${workoutMemos.memoDate} >= ${monthStart}`,
            sql`${workoutMemos.memoDate} < ${monthEnd}`,
          )),
          db.select({ c: sql<number>`COUNT(*)` }).from(workoutMemos).where(and(
            eq(workoutMemos.trainerId, tid),
            sql`${workoutMemos.memoDate} = ${today}`,
          )),
          db.execute(videoCountSql),
          db.execute(sql`
            SELECT COUNT(*)::int AS c FROM pt_session_logs s,
            LATERAL jsonb_array_elements(CASE WHEN s."exercisesJson" IS NOT NULL AND s."exercisesJson" <> '' THEN s."exercisesJson"::jsonb ELSE '[]'::jsonb END) AS ex
            WHERE s."trainerId" = ${tid} AND ex->>'videoUrl' IS NOT NULL AND ex->>'videoUrl' <> ''
            AND s."sessionDate" >= ${monthStart} AND s."sessionDate" < ${monthEnd}`),
          db.execute(sql`
            SELECT COUNT(*)::int AS c FROM pt_session_logs s,
            LATERAL jsonb_array_elements(CASE WHEN s."exercisesJson" IS NOT NULL AND s."exercisesJson" <> '' THEN s."exercisesJson"::jsonb ELSE '[]'::jsonb END) AS ex
            WHERE s."trainerId" = ${tid} AND ex->>'videoUrl' IS NOT NULL AND ex->>'videoUrl' <> ''
            AND s."sessionDate" = ${today}`),
        ]);

        const totalRereg = pkgCountByMember.reduce((s, r) => s + Math.max(0, Number(r.count) - 1), 0);
        const reregMemberCount = pkgCountByMember.filter(r => Number(r.count) > 1).length;
        const totalMembers = Number(totalMembersRes[0]?.c ?? 0);
        const totalSessionsNum = Number(((totalSessionsRes as any).rows ?? totalSessionsRes)[0]?.c ?? 0);

        const trainerCreatedAt = trainer.createdAt;
        const monthsActive = trainerCreatedAt
          ? Math.max(1, Math.round((Date.now() - new Date(trainerCreatedAt).getTime()) / (1000 * 60 * 60 * 24 * 30.5)))
          : 1;

        return {
          trainerId: tid,
          trainerName: trainer.trainerName,
          totalMembers,
          totalSessions: totalSessionsNum,
          totalNoShow: Number(totalNoShowRes[0]?.c ?? 0),
          totalChurned: Number(((totalChurnedRes as any).rows ?? totalChurnedRes)[0]?.c ?? 0),
          remainingPt: Number(remainingPtRes[0]?.total ?? 0),
          totalRereg,
          reregRate: totalMembers > 0 ? Math.round((reregMemberCount / totalMembers) * 1000) / 10 : 0,
          monthSessions: Number(((monthSessionsRes as any).rows ?? monthSessionsRes)[0]?.c ?? 0),
          monthNoShow: Number(monthNoShowRes[0]?.c ?? 0),
          todaySessions: Number(((todaySessionsRes as any).rows ?? todaySessionsRes)[0]?.c ?? 0),
          avgMonthlyPt: Math.round((totalSessionsNum / monthsActive) * 10) / 10,
          totalMemos: Number(totalMemosRes[0]?.c ?? 0),
          monthMemos: Number(monthMemosRes[0]?.c ?? 0),
          todayMemos: Number(todayMemosRes[0]?.c ?? 0),
          totalVideos: Number((totalVideosRes.rows ?? totalVideosRes)[0]?.c ?? 0),
          monthVideos: Number((monthVideosRes.rows ?? monthVideosRes)[0]?.c ?? 0),
          todayVideos: Number((todayVideosRes.rows ?? todayVideosRes)[0]?.c ?? 0),
        };
      }));

      return stats;
    }),

  getTrainerPeriodReport: protectedProcedure
    .input(z.object({
      year: z.number(),
      period: z.enum(["H1", "H2", "annual"]),
    }))
    .query(async ({ ctx, input }) => {
      if (ctx.user?.role !== "admin" && ctx.user?.role !== "sub_admin")
        throw new TRPCError({ code: "FORBIDDEN" });
      const db = getDb();
      const { year, period } = input;

      const periodStart = period === "H2" ? `${year}-07-01` : `${year}-01-01`;
      const periodEnd = period === "H1" ? `${year}-07-01` : `${year + 1}-01-01`;
      const monthCount = period === "annual" ? 12 : 6;
      const startMonth = period === "H2" ? 7 : 1;

      const trainerList = await db.select({ id: trainers.id, trainerName: trainers.trainerName })
        .from(trainers).orderBy(trainers.trainerName);

      const today = kstDate();

      // 실제 경과 개월 수 (현재 진행 중인 기간이면 경과월만, 과거 기간이면 전체 monthCount)
      const elapsedMonths = (() => {
        const periodStart = `${year}-${String(startMonth).padStart(2, "0")}-01`;
        const periodEnd = period === "annual"
          ? `${year}-12-31`
          : period === "H1" ? `${year}-06-30` : `${year}-12-31`;
        if (today > periodEnd) return monthCount; // 지난 기간: 전체
        if (today < periodStart) return 1;         // 미래 기간: 최소 1
        const [ty, tm] = today.split("-").map(Number);
        return Math.min(monthCount, Math.max(1, (ty - year) * 12 + (tm - startMonth) + 1));
      })();

      const trainerRows = await Promise.all(trainerList.map(async (trainer) => {
        const tid = trainer.id;
        const trainerUserId = (await db.select({ userId: trainers.userId }).from(trainers).where(eq(trainers.id, tid)).limit(1))[0]?.userId;
        const assignedMemberIds = (await db.select({ id: members.id }).from(members).where(eq(members.trainerId, tid))).map(m => m.id);

        const revOwnerFilter = sql`(
          r."trainerId" = ${tid}
          OR r."consultantId" = ${trainerUserId}
          ${assignedMemberIds.length > 0
            ? sql`OR r."memberId" IN (${sql.join(assignedMemberIds.map(id => sql`${id}`), sql`, `)})`
            : sql``
          }
        )`;

        const [sessionsRes, noShowRes, completedPkgRes, revRows, monthlySessionsRes, monthlyReregRes] = await Promise.all([
          db.execute(sql`SELECT COUNT(*)::int AS c FROM (
            SELECT "memberId", "sessionDate" FROM pt_session_logs WHERE "trainerId" = ${tid} AND "sessionDate" >= ${periodStart} AND "sessionDate" < ${periodEnd}
              AND "memberId" NOT IN (SELECT DISTINCT "memberId" FROM attendance_checks WHERE "trainerId" = ${tid} AND status = 'attended' AND "checkDate" >= ${periodStart} AND "checkDate" < ${periodEnd})
            UNION ALL
            SELECT "memberId", "checkDate" FROM attendance_checks WHERE "trainerId" = ${tid} AND status = 'attended' AND "checkDate" >= ${periodStart} AND "checkDate" < ${periodEnd}
          ) combined`),
          db.select({ c: sql<number>`COUNT(*)::int` }).from(attendanceChecks).where(and(
            eq(attendanceChecks.trainerId, tid),
            eq(attendanceChecks.status, "noshow"),
            sql`${attendanceChecks.checkDate} >= ${periodStart}`,
            sql`${attendanceChecks.checkDate} < ${periodEnd}`,
          )),
          // 종료: 이 기간에 PT 세션을 모두 소진한 회원 (잔여 0회)
          // 만료일 경과는 종료 아님 — 세션 0회 소진만 종료로 판정
          // 조건1: 세션 소진으로 status='completed' (useSession 시 자동 설정)
          // 조건2: status='active'지만 usedSessions >= totalSessions (status 미갱신 안전망)
          db.execute(sql`
            SELECT DISTINCT "memberId" FROM pt_packages
            WHERE "trainerId" = ${tid}
              AND "totalSessions" > 0
              AND "usedSessions" >= "totalSessions"
              AND "updatedAt" >= ${periodStart} AND "updatedAt" < ${periodEnd}
          `),
          db.execute(sql`
            SELECT r."subType", r."memberId", r."consultantId", r."trainerId"
            FROM revenue_entries r
            WHERE ${revOwnerFilter}
              AND r."paymentDate" >= ${periodStart} AND r."paymentDate" < ${periodEnd}
              AND r."subType" IN ('신규', '신규배정', '재등록')
          `),
          db.execute(sql`
            SELECT m, COUNT(*)::int AS c FROM (
              SELECT EXTRACT(MONTH FROM "sessionDate"::date)::int AS m, "memberId", "sessionDate" AS d FROM pt_session_logs WHERE "trainerId" = ${tid} AND "sessionDate" >= ${periodStart} AND "sessionDate" < ${periodEnd}
                AND "memberId" NOT IN (SELECT DISTINCT "memberId" FROM attendance_checks WHERE "trainerId" = ${tid} AND status = 'attended' AND "checkDate" >= ${periodStart} AND "checkDate" < ${periodEnd})
              UNION ALL
              SELECT EXTRACT(MONTH FROM "checkDate"::date)::int AS m, "memberId", "checkDate" AS d FROM attendance_checks WHERE "trainerId" = ${tid} AND status = 'attended' AND "checkDate" >= ${periodStart} AND "checkDate" < ${periodEnd}
            ) combined GROUP BY m ORDER BY m
          `),
          db.execute(sql`
            SELECT EXTRACT(MONTH FROM r."paymentDate"::date)::int AS m, COUNT(*)::int AS c
            FROM revenue_entries r
            WHERE r."subType" = '재등록'
              AND ${revOwnerFilter}
              AND r."paymentDate" >= ${periodStart} AND r."paymentDate" < ${periodEnd}
            GROUP BY m ORDER BY m
          `),
        ]);

        const revResultRows: any[] = (revRows as any).rows ?? revRows;
        const assignedMemberIdSet = new Set(assignedMemberIds);
        const newMemberIds = new Set<number>();
        const reregMemberIds = new Set<number>();
        let reregCount = 0;
        for (const r of revResultRows) {
          if (r.subType === "신규" || r.subType === "신규배정") {
            // PT 신규 배정만 카운트 (헬스 제외)
            // 신규 등록 시 hasPt=false 이면 revenue entry의 trainerId=null이므로
            // trainerId 직접 비교 OR assignedMemberIds(현재 배정된 PT 회원) 포함 여부로 판단
            if (r.subType === "신규") {
              const isDirectPt = Number(r.trainerId) === tid;
              const isAssignedPt = r.memberId != null && assignedMemberIdSet.has(Number(r.memberId));
              if (!isDirectPt && !isAssignedPt) continue;
            }
            if (r.memberId) newMemberIds.add(r.memberId);
          } else if (r.subType === "재등록") {
            reregCount++;
            if (r.memberId) reregMemberIds.add(r.memberId);
          }
        }

        const sessions = ((sessionsRes as any).rows ?? sessionsRes)[0]?.c ?? 0;
        const noShows = noShowRes[0]?.c ?? 0;
        // 기간 내 종료된 회원 ID 목록
        const expiredMemberIds = new Set<number>(
          ((completedPkgRes as any).rows ?? completedPkgRes).map((r: any) => Number(r.memberId)).filter(Boolean)
        );
        const completed = expiredMemberIds.size;
        const newMembers = newMemberIds.size;
        const reregMembers = reregMemberIds.size;

        // 재등록률: 종료된 회원이 이 기간에 재등록했는지 직접 확인
        // revOwnerFilter에 의존하지 않음 (재등록 시 hasPt=false → trainerId=null 문제 우회)
        let reregAfterExpired = 0;
        if (completed > 0) {
          const expiredList = Array.from(expiredMemberIds);
          const reregCheckRes = await db.execute(sql`
            SELECT DISTINCT "memberId" FROM revenue_entries
            WHERE "memberId" IN (${sql.join(expiredList.map(id => sql`${id}`), sql`, `)})
              AND "paymentDate" >= ${periodStart} AND "paymentDate" < ${periodEnd}
              AND "subType" = '재등록'
          `);
          const reregSet = new Set<number>(
            ((reregCheckRes as any).rows ?? reregCheckRes).map((r: any) => Number(r.memberId)).filter(Boolean)
          );
          reregAfterExpired = expiredList.filter(id => reregSet.has(id)).length;
        }

        // 재등록률 = 재등록 회원 ÷ (신규 배정 + 재등록 회원)
        // 이번 기간 전체 PT 거래 중 재등록 비율. H1 종료 후 H2 재등록도 포함.
        const reregRate = (newMembers + reregMembers) > 0
          ? Math.round((reregMembers / (newMembers + reregMembers)) * 100)
          : null;

        const monthlyMap: Record<number, { sessions: number; rereg: number }> = {};
        for (let i = 0; i < monthCount; i++) {
          monthlyMap[startMonth + i] = { sessions: 0, rereg: 0 };
        }
        for (const r of ((monthlySessionsRes as any).rows ?? monthlySessionsRes)) {
          if (monthlyMap[r.m]) monthlyMap[r.m].sessions = r.c;
        }
        for (const r of ((monthlyReregRes as any).rows ?? monthlyReregRes)) {
          if (monthlyMap[r.m]) monthlyMap[r.m].rereg = r.c;
        }

        return {
          trainerId: tid,
          trainerName: trainer.trainerName,
          sessions,
          avgMonthly: Math.round((sessions / elapsedMonths) * 10) / 10,
          noShows,
          completed,
          newMembers,
          reregCount,
          reregMembers,
          reregAfterExpired,
          reregRate,
          monthly: Object.entries(monthlyMap).map(([m, v]) => ({
            month: Number(m),
            sessions: v.sessions,
            rereg: v.rereg,
          })),
        };
      }));

      const total = {
        sessions: trainerRows.reduce((s, t) => s + t.sessions, 0),
        noShows: trainerRows.reduce((s, t) => s + t.noShows, 0),
        completed: trainerRows.reduce((s, t) => s + t.completed, 0),
        newMembers: trainerRows.reduce((s, t) => s + t.newMembers, 0),
        reregCount: trainerRows.reduce((s, t) => s + t.reregCount, 0),
        reregMembers: trainerRows.reduce((s, t) => s + t.reregMembers, 0),
        reregAfterExpired: trainerRows.reduce((s, t) => s + t.reregAfterExpired, 0),
      };
      const totalReregRate = (total.newMembers + total.reregMembers) > 0
        ? Math.round((total.reregMembers / (total.newMembers + total.reregMembers)) * 100)
        : null;

      return { year, period, trainers: trainerRows, total: { ...total, reregRate: totalReregRate } };
    }),

  resyncAllSharedLogs: protectedProcedure.mutation(async ({ ctx }) => {
    if (ctx.user?.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    // 같은 DB. COALESCE 서브쿼리로 순서대로 매칭:
    // 1) memberId 직접 링크
    // 2) 전화번호 정규화 매칭 (양쪽 모두 비어있으면 제외)
    // 3) 이름 매칭 (세션 스냅샷 이름)
    // 4) 이름 매칭 (현재 회원 이름)
    const sharedLogs = await db.execute(sql`
      SELECT
        s.id, s."memberId", s."memberName", s."sessionDate",
        s.notes, s.goal, s.feedback, s."bodyPart", s."exercisesJson",
        m.phone AS memberPhone, m.name AS memberNameReal,
        COALESCE(
          (SELECT id FROM gym_plus_members
           WHERE "memberId" = s."memberId" LIMIT 1),
          (SELECT id FROM gym_plus_members
           WHERE m.phone IS NOT NULL AND m.phone != ''
             AND REGEXP_REPLACE(COALESCE(phone,''), '[^0-9]', '', 'g')
                 = REGEXP_REPLACE(m.phone, '[^0-9]', '', 'g')
           LIMIT 1),
          (SELECT id FROM gym_plus_members
           WHERE s."memberName" IS NOT NULL
             AND name = s."memberName" LIMIT 1),
          (SELECT id FROM gym_plus_members
           WHERE m.name IS NOT NULL
             AND name = m.name LIMIT 1)
        ) AS "gymPlusMemberId"
      FROM pt_session_logs s
      LEFT JOIN members m ON m.id = s."memberId"
      WHERE s."sharedToMember" = 1
    `);
    const rows: any[] = (sharedLogs as any).rows ?? (sharedLogs as any);

    let synced = 0, skipped = 0;
    const failedItems: { memberName: string; sessionDate: string; reason: string }[] = [];

    for (const log of rows) {
      try {
        // 이미 존재하면 건너뜀
        const existCheck = await db.execute(
          sql`SELECT id FROM gym_plus_workout_logs WHERE notes LIKE ${'%__src:' + log.id + '%'} LIMIT 1`
        );
        if (((existCheck as any).rows ?? (existCheck as any))[0]) { skipped++; continue; }

        const gm = log.gymPlusMemberId ? { id: log.gymPlusMemberId } : null;

        if (!gm) {
          failedItems.push({
            memberName: log.memberName ?? log.memberNameReal ?? "알 수 없음",
            sessionDate: log.sessionDate,
            reason: `짐플러스 미가입 (전화: ${log.memberPhone ?? "없음"})`,
          });
          continue;
        }

        // 짐플러스 계정에 memberId 링크 없으면 자동 연결
        await db.execute(
          sql`UPDATE gym_plus_members SET "memberId" = ${log.memberId} WHERE id = ${gm.id} AND "memberId" IS NULL`
        );

        const title = log.bodyPart ? `[트레이닝] ${log.bodyPart}` : "트레이닝 기록";
        const notes = ([log.notes, log.goal, log.feedback].filter(Boolean).join("\n") || "") + `\n__src:${log.id}`;
        const logDate = log.sessionDate ?? new Date().toISOString().slice(0, 10);
        await db.execute(
          sql`INSERT INTO gym_plus_workout_logs ("gymPlusMemberId", "logDate", title, "exercisesJson", notes, "createdAt") VALUES (${gm.id}, ${logDate}, ${title}, ${log.exercisesJson}, ${notes}, ${new Date().toISOString()})`
        );
        synced++;
      } catch (e: any) {
        failedItems.push({
          memberName: log.memberName ?? "알 수 없음",
          sessionDate: log.sessionDate,
          reason: e?.message ?? "오류",
        });
      }
    }

    return { success: true, total: rows.length, synced, skipped, failed: failedItems.length, failedItems };
  }),

  // 정산 단가 이상치 탐지 (관리자) — 박경숙 사고(매출↔패키지 결제금액 불일치, 세션당 단가 이상저가)
  // 같은 케이스를 대표가 우연히 발견하기 전에 시스템이 먼저 찾아 리포트로 보여준다.
  // 자동 수정은 하지 않는다(데이터 무결성 원칙: 확인 후 수동 처리).
  pricingAnomalies: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user?.role !== "admin" && ctx.user?.role !== "sub_admin") throw new TRPCError({ code: "FORBIDDEN" });

    const pkgs = await pool.query<{
      id: number; memberId: number | null; memberName: string | null;
      trainerId: number | null; trainerName: string | null;
      packageName: string | null; totalSessions: number | null;
      paymentAmount: number | null; pricePerSession: number | null;
      paymentDate: string | null; revenueEntryId: number | null;
      revenueAmount: number | null; revenuePaidAmount: number | null;
    }>(`
      SELECT p.id, p."memberId", m.name AS "memberName",
             p."trainerId", t."trainerName",
             p."packageName", p."totalSessions", p."paymentAmount", p."pricePerSession",
             p."paymentDate", p."revenueEntryId", COALESCE(p."unpaidAmount", 0) AS "pkgUnpaid",
             r.amount AS "revenueAmount", r."paidAmount" AS "revenuePaidAmount"
      FROM pt_packages p
      LEFT JOIN members m ON m.id = p."memberId"
      LEFT JOIN trainers t ON t.id = p."trainerId"
      LEFT JOIN revenue_entries r ON r.id = p."revenueEntryId"
      WHERE p.status = 'active'
        AND COALESCE(p."totalSessions", 0) > 0
        AND m.id IS NOT NULL
    `);

    // 정상 단가 분포의 중앙값을 기준으로 삼는다 (트레이너/프로그램마다 가격이 달라 절대값 기준은 부정확).
    const prices = pkgs.rows.map(r => r.pricePerSession ?? 0).filter(n => n > 0).sort((a, b) => a - b);
    const median = prices.length > 0 ? prices[Math.floor(prices.length / 2)] : 0;
    const lowThreshold = median > 0 ? median * 0.4 : 0;

    // 미수금 수납분 합산 맵: revenueEntryId → 수납 총액
    const revIds = pkgs.rows.map(r => r.revenueEntryId).filter(Boolean) as number[];
    const unpaidMap = new Map<number, number>();
    if (revIds.length > 0) {
      const unpaidRes = await pool.query<{ relatedEntryId: number; total: number }>(
        `SELECT "relatedEntryId", SUM(COALESCE("paidAmount", 0)) as total
         FROM revenue_entries
         WHERE "subType" = '미수금' AND "relatedEntryId" = ANY($1)
         GROUP BY "relatedEntryId"`,
        [revIds]
      );
      for (const r of unpaidRes.rows) unpaidMap.set(r.relatedEntryId, Number(r.total));
    }

    const anomalies = pkgs.rows.map(r => {
      const reasons: string[] = [];
      if (lowThreshold > 0 && (r.pricePerSession ?? 0) > 0 && (r.pricePerSession ?? 0) < lowThreshold) {
        reasons.push(`세션당 단가 ${(r.pricePerSession ?? 0).toLocaleString()}원 (전체 중앙값 ${median.toLocaleString()}원의 40% 미만)`);
      }
      if (r.revenueEntryId && r.revenueAmount != null && !((r as any).pkgUnpaid > 0)) {
        const revenuePaid = r.revenuePaidAmount ?? r.revenueAmount;
        const unpaidCollected = unpaidMap.get(r.revenueEntryId) ?? 0;
        const totalReceived = revenuePaid + unpaidCollected;
        if (Math.abs((r.paymentAmount ?? 0) - totalReceived) > 1000) {
          reasons.push(`매출 결제금액(${totalReceived.toLocaleString()}원)과 패키지 결제금액(${(r.paymentAmount ?? 0).toLocaleString()}원) 불일치`);
        }
      }
      return reasons.length > 0 ? { ...r, reasons } : null;
    }).filter((r): r is NonNullable<typeof r> => r !== null);

    // 장부 이상 감지. 실결제(paidAmount)가 정가(amount)보다 "큰" 것은 정상이다 —
    // 이체가 아닌 결제는 부가세 10%가 붙고, 락커·운동복 같은 서비스 항목이 같은 건에 합산되기
    // 때문(예: 최지훈 204,000→224,400은 정확히 ×1.1 부가세, 궁연화 216,000→276,000은 서비스 합산).
    // 따라서 "실결제가 받았어야 할 금액보다 적게 기록된 경우"(매출 누락 위험)와 "미수금이 정가보다
    // 큰 경우"(명백한 데이터 오류)만 이상으로 잡는다. 반올림 오차(±100원)는 무시.
    // ⚠ 미수금을 나중에 수납하면 그 금액은 수납일자로 별도 행(subType='미수금')에 남고 원본
    // 행의 paidAmount는 최초 입금액 그대로다. 그래서 수납액을 합산하지 않으면 전액 받은 건이
    // "적게 기록됨"으로 잘못 잡힌다(안종현·김용근 사례). 아래에서 수납분을 더해 비교한다.
    const mismatchRes = await pool.query<{
      id: number; customerName: string | null; paymentDate: string | null; type: string;
      amount: number; discount: number; unpaid: number; paid: number;
    }>(`
      SELECT r.id, r."customerName", r."paymentDate", r.type,
             COALESCE(r.amount,0) AS amount, COALESCE(r."discountAmount",0) AS discount,
             COALESCE(r."unpaidAmount",0) AS unpaid, COALESCE(r."paidAmount",0) AS paid
      FROM revenue_entries r
      WHERE COALESCE(r."subType",'') NOT IN ('환불','이전','미수금')
        AND (
          COALESCE(r."unpaidAmount",0) > COALESCE(r.amount,0)
          OR COALESCE(r."paidAmount",0)
             + COALESCE((SELECT SUM(COALESCE(c."paidAmount",0)) FROM revenue_entries c
                         WHERE c."subType" = '미수금'
                           AND (c."relatedEntryId" = r.id
                                OR (c."relatedEntryId" IS NULL AND c."memberId" = r."memberId"))),0)
             < (COALESCE(r.amount,0) - COALESCE(r."discountAmount",0) - COALESCE(r."unpaidAmount",0)) - 100
        )
      ORDER BY r."paymentDate" DESC NULLS LAST
      LIMIT 30
    `);

    return { median, checkedCount: pkgs.rows.length, anomalies, revenueMismatches: mismatchRes.rows };
  }),

  // 노션 브리핑 즉시 테스트 발송 (관리자) — 08:00 KST 자동 스케줄과 별개로 설정 확인용
  sendNotionBriefingNow: protectedProcedure
    .input(z.object({ period: z.enum(["daily", "weekly", "monthly"]) }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user?.role !== "admin" && ctx.user?.role !== "sub_admin") throw new TRPCError({ code: "FORBIDDEN" });
      if (!process.env.NOTION_API_TOKEN || !process.env.NOTION_BRIEFING_PAGE_ID) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "NOTION_API_TOKEN 또는 NOTION_BRIEFING_PAGE_ID가 설정되지 않았습니다." });
      }
      if (input.period === "daily") await sendDailyBriefing();
      else if (input.period === "weekly") await sendWeeklyBriefing();
      else await sendMonthlyBriefing();
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
            sql`${members.createdAt} < ${m.end}`,
            hasPtPackage
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
      const isAdmin = ctx.user.role === "admin" || ctx.user.role === "sub_admin";

      const hasActivePt = sql`EXISTS (SELECT 1 FROM pt_packages p WHERE p."memberId" = ${members.id} AND p.status = 'active')`;
      const hasActivePtWithTrainer = trainerId
        ? sql`EXISTS (SELECT 1 FROM pt_packages p WHERE p."memberId" = ${members.id} AND p."trainerId" = ${trainerId} AND p.status = 'active')`
        : sql`false`;

      // 관리자: 활성 PT 있는 전체 활성 회원 / 트레이너: 담당 회원
      const memberList = await db
        .select({ id: members.id, name: members.name, status: members.status })
        .from(members)
        .where(and(
          eq(members.status, "active"),
          isAdmin
            ? hasActivePt
            : trainerId
              ? or(and(eq(members.trainerId, trainerId), hasActivePt), hasActivePtWithTrainer)
              : sql`false`
        ))
        .orderBy(members.name);

      const checks = await db
        .select()
        .from(attendanceChecks)
        .where(
          isAdmin && !trainerId
            ? eq(attendanceChecks.checkDate, input.date)
            : and(eq(attendanceChecks.trainerId, trainerId!), eq(attendanceChecks.checkDate, input.date))
        );

      // 잔여 PT 횟수 조회
      const memberIds = memberList.map(m => m.id);
      const pkgs = memberIds.length > 0
        ? await db.select({ memberId: ptPackages.memberId, totalSessions: ptPackages.totalSessions, usedSessions: ptPackages.usedSessions, status: ptPackages.status })
            .from(ptPackages)
            .where(and(inArray(ptPackages.memberId, memberIds), eq(ptPackages.status, "active")))
        : [];

      const remainMap = new Map<number, number>();
      for (const p of pkgs) {
        const remain = p.totalSessions - p.usedSessions;
        if (remain > 0) remainMap.set(p.memberId, (remainMap.get(p.memberId) ?? 0) + remain);
      }

      const checkMap = new Map(checks.map((c) => [c.memberId, c]));

      return memberList.map((m) => ({ ...m, check: checkMap.get(m.id) ?? null, remainingSessions: remainMap.get(m.id) ?? null }));
    }),

  recentSummary: protectedProcedure.query(async ({ ctx }) => {
    const db = getDb();
    const trainerId = ctx.user.trainerId;
    if (!trainerId) return [];

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
      markPtSession: z.boolean().optional().default(false),
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
      let trainerId = ctx.user.trainerId;

      // admin/sub_admin: 회원 담당 트레이너 → 없으면 활성 PT 패키지 트레이너 순서로 fallback
      if (!trainerId && (ctx.user.role === "admin" || ctx.user.role === "sub_admin")) {
        const memberRow = await db.select({ trainerId: members.trainerId }).from(members).where(eq(members.id, input.memberId)).limit(1);
        trainerId = memberRow[0]?.trainerId ?? undefined;
        if (!trainerId) {
          const pkgRow = await db.select({ trainerId: ptPackages.trainerId })
            .from(ptPackages)
            .where(and(eq(ptPackages.memberId, input.memberId), eq(ptPackages.status, "active")))
            .orderBy(desc(ptPackages.id))
            .limit(1);
          trainerId = pkgRow[0]?.trainerId ?? undefined;
        }
      }
      if (!trainerId) throw new TRPCError({ code: "FORBIDDEN", message: "담당 트레이너를 찾을 수 없습니다." });

      const { memberId, checkDate, ...fields } = input;
      const existing = await db
        .select({ id: attendanceChecks.id, status: attendanceChecks.status })
        .from(attendanceChecks)
        .where(and(eq(attendanceChecks.memberId, memberId), eq(attendanceChecks.checkDate, checkDate)))
        .limit(1);

      const wasAttended = existing[0]?.status === "attended";
      const willAttend = input.status === "attended";
      const isNew = !existing[0];

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

      // PT 세션 소비: markPtSession=true 이고 attended 일 때만
      if (input.markPtSession && willAttend) {
        const [existingLog] = await db.select({ id: ptSessionLogs.id })
          .from(ptSessionLogs)
          .where(and(eq(ptSessionLogs.memberId, memberId), eq(ptSessionLogs.sessionDate, checkDate)))
          .limit(1);
        if (!existingLog) {
          const [activePkg] = await db.select()
            .from(ptPackages)
            .where(and(eq(ptPackages.memberId, memberId), eq(ptPackages.status, "active")))
            .orderBy(
              sql`CASE WHEN "startDate" IS NULL OR "startDate" <= CURRENT_DATE::text THEN 0 ELSE 1 END`,
              asc(ptPackages.startDate),
              asc(ptPackages.id),
            )
            .limit(1);
          if (activePkg && activePkg.usedSessions < activePkg.totalSessions) {
            const newUsed = activePkg.usedSessions + 1;
            const newStatus = newUsed >= activePkg.totalSessions ? "completed" : "active";
            await db.update(ptPackages)
              .set({ usedSessions: newUsed, status: newStatus as any })
              .where(eq(ptPackages.id, activePkg.id));
            const [memRow] = await db.select({ name: members.name }).from(members).where(eq(members.id, memberId)).limit(1);
            await db.insert(ptSessionLogs).values({
              memberId,
              memberName: memRow?.name ?? null,
              trainerId,
              packageId: activePkg.id,
              sessionDate: checkDate,
            });
          }
        }
      }

      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ memberId: z.number(), date: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const role = ctx.user.role;
      if (!ctx.user.trainerId && role !== "admin" && role !== "sub_admin")
        throw new TRPCError({ code: "FORBIDDEN" });
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
      // admin/sub_admin은 trainerId 대신 userId를 음수로 사용 (충돌 방지)
      const trainerId = ctx.user.trainerId ?? (-(ctx.user.id));
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
      const trainerId = ctx.user.trainerId ?? (-(ctx.user.id));
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

// ─── 교육 매뉴얼 라우터 ───────────────────────────────────────────────────────
const trainingManualRouter = t.router({
  list: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    const rows = await db.select().from(trainingManuals).orderBy(desc(trainingManuals.createdAt));
    return rows.map(r => ({ ...r, exercises: JSON.parse(r.exercises) as unknown[] }));
  }),

  get: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const [row] = await db.select().from(trainingManuals).where(eq(trainingManuals.id, input.id)).limit(1);
    if (!row) throw new TRPCError({ code: "NOT_FOUND" });
    return { ...row, exercises: JSON.parse(row.exercises) as unknown[] };
  }),

  create: protectedProcedure
    .input(z.object({
      title: z.string().min(1),
      manualDate: z.string(),
      description: z.string().optional(),
      exercises: z.array(z.object({
        title: z.string(),
        description: z.string().optional(),
        exercises: z.array(z.object({
          name: z.string(),
          videoUrl: z.string().optional(),
          supplementary: z.array(z.object({ name: z.string(), videoUrl: z.string().optional() })).optional(),
        })),
      })),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const now = new Date().toISOString();
      const [row] = await db.insert(trainingManuals).values({
        title: input.title,
        manualDate: input.manualDate,
        description: input.description ?? "",
        exercises: JSON.stringify(input.exercises),
        createdBy: ctx.user!.id,
        createdAt: now,
        updatedAt: now,
      }).returning({ id: trainingManuals.id });
      return { id: row.id };
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      title: z.string().min(1),
      manualDate: z.string(),
      description: z.string().optional(),
      exercises: z.array(z.object({
        title: z.string(),
        description: z.string().optional(),
        exercises: z.array(z.object({
          name: z.string(),
          videoUrl: z.string().optional(),
          supplementary: z.array(z.object({ name: z.string(), videoUrl: z.string().optional() })).optional(),
        })),
      })),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.update(trainingManuals).set({
        title: input.title,
        manualDate: input.manualDate,
        description: input.description ?? "",
        exercises: JSON.stringify(input.exercises),
        updatedAt: new Date().toISOString(),
      }).where(eq(trainingManuals.id, input.id));
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.delete(trainingManuals).where(eq(trainingManuals.id, input.id));
      return { success: true };
    }),
});

// ─── ZIANTGYM+ 회원앱 ─────────────────────────────────────────────────────────

const gymPlusProtected = t.procedure.use(({ ctx, next }) => {
  const gymMemberId = (ctx.req.session as any).gymPlusMemberId as number | undefined;
  if (!gymMemberId) throw new TRPCError({ code: "UNAUTHORIZED" });
  return next({ ctx: { ...ctx, gymPlusMemberId: gymMemberId } });
});

// 자이언트짐++ 관리자 전용(처리): 통합운영 관리자(admin/sub_admin) 세션이거나,
// gymPlus.adminLogin으로 인증된 세션(session.gymPlusAdmin)만 통과. 예전엔 인증이 전혀
// 없어(t.procedure) 누구나 재등록 승인/거절·회원삭제가 가능했다.
// 주의: 로그인 자체가 안 된 경우만 UNAUTHORIZED(클라이언트가 이걸 "세션 만료"로 보고
// 강제 로그아웃시킨다 — main.tsx 전역 핸들러). 로그인은 됐지만 권한이 부족한 경우는
// FORBIDDEN이어야 한다. 예전에 이걸 구분 안 해서, 트레이너 계정이 상담관리에 들어가
// (권한 없는 이 API를 배너용으로 호출하다가) 멀쩡한 세션인데 로그아웃되는 사고가 있었다.
const adminOnlyGymPlus = t.procedure.use(({ ctx, next }) => {
  if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });
  const role = ctx.user.role;
  const isStaffAdmin = role === "admin" || role === "sub_admin";
  const isGymPlusAdmin = !!(ctx.req.session as any)?.gymPlusAdmin;
  if (!isStaffAdmin && !isGymPlusAdmin) throw new TRPCError({ code: "FORBIDDEN" });
  return next({ ctx });
});

// 재등록 조회/처리(대시보드·상담관리 배너 포함): 관리자 + 컨설턴트 + 트레이너.
// 트레이너는 "본인 담당 회원"의 신청만 볼 수 있고 처리할 수 있다(아래 각 procedure에서
// 소유권 검사) — 재등록 승인은 회원권 연장 + 매출 생성이 걸린 재무 작업이라
// 프로젝트 규칙(관리자이거나 본인 담당일 때만)을 따른다.
const gymPlusRenewalView = t.procedure.use(({ ctx, next }) => {
  const role = ctx.user?.role;
  const isGymPlusAdmin = !!(ctx.req.session as any)?.gymPlusAdmin;
  if (!ctx.user && !isGymPlusAdmin) throw new TRPCError({ code: "UNAUTHORIZED" });
  const ok = role === "admin" || role === "sub_admin" || role === "consultant" || role === "trainer" || isGymPlusAdmin;
  if (!ok) throw new TRPCError({ code: "FORBIDDEN" });
  return next({ ctx });
});

// 재등록 승인/거절: 위와 동일한 대상. 전체 권한이 없는 트레이너는 각 procedure에서
// 해당 신청이 본인 담당 회원인지 확인한 뒤에만 처리된다.
function isFullRenewalAdmin(ctx: Context): boolean {
  const role = ctx.user?.role;
  return role === "admin" || role === "sub_admin" || !!(ctx.req.session as any)?.gymPlusAdmin;
}

// 이 재등록 신청이 요청자(트레이너)의 담당 회원인지 확인. 관리자는 항상 통과.
async function assertCanHandleRenewal(ctx: Context, db: any, gymPlusMemberId: number) {
  if (isFullRenewalAdmin(ctx)) return;
  const trainerId = ctx.user?.trainerId;
  if (!trainerId) throw new TRPCError({ code: "FORBIDDEN", message: "재등록을 처리할 권한이 없습니다." });
  const [gp] = await db.select({ memberId: gymPlusMembers.memberId, name: gymPlusMembers.name, phone: gymPlusMembers.phone })
    .from(gymPlusMembers).where(eq(gymPlusMembers.id, gymPlusMemberId)).limit(1);
  if (!gp) throw new TRPCError({ code: "NOT_FOUND" });
  let ownerTrainerId: number | null = null;
  if (gp.memberId) {
    const [m] = await db.select({ trainerId: members.trainerId }).from(members).where(eq(members.id, gp.memberId)).limit(1);
    ownerTrainerId = m?.trainerId ?? null;
  } else if (gp.name && gp.phone) {
    const [m] = await db.select({ trainerId: members.trainerId }).from(members)
      .where(and(eq(members.name, gp.name), samePhone(members.phone, gp.phone))).limit(1);
    ownerTrainerId = m?.trainerId ?? null;
  }
  if (ownerTrainerId !== trainerId)
    throw new TRPCError({ code: "FORBIDDEN", message: "본인 담당 회원의 재등록만 처리할 수 있습니다." });
}

const gymPlusRouter = t.router({
  // 관리자 로그인 (기존 admin 계정으로 인증) — 성공 시 세션에 gymPlusAdmin 플래그를 남겨
  // 이후 admin_* API가 서버에서 실제로 인증을 검증할 수 있게 한다(예전엔 클라이언트 게이트뿐).
  adminLogin: publicProcedure
    .input(z.object({ username: z.string(), password: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [user] = await db.select().from(users)
        .where(eq(users.username, input.username)).limit(1);
      if (!user) throw new TRPCError({ code: "UNAUTHORIZED", message: "아이디 또는 비밀번호가 잘못되었습니다." });
      if (user.role !== "admin" && user.role !== "sub_admin")
        throw new TRPCError({ code: "FORBIDDEN", message: "관리자 계정만 접근할 수 있습니다." });
      const valid = await bcrypt.compare(input.password, user.password);
      if (!valid) throw new TRPCError({ code: "UNAUTHORIZED", message: "아이디 또는 비밀번호가 잘못되었습니다." });
      (ctx.req.session as any).gymPlusAdmin = { username: user.username, role: user.role };
      return { success: true, username: user.username, role: user.role };
    }),

  // 현재 자이언트짐++ 관리자 세션 확인 (없으면 null). 클라이언트가 로그인 게이트 표시 판단에 사용.
  adminMe: publicProcedure.query(({ ctx }) => {
    const gp = (ctx.req.session as any)?.gymPlusAdmin;
    const role = ctx.user?.role;
    if (gp) return gp as { username: string; role: string };
    // 통합운영 관리자 세션도 자이언트짐++ 관리자로 인정
    if (role === "admin" || role === "sub_admin") return { username: ctx.user!.username, role };
    return null;
  }),

  // 자이언트짐++ 관리자 로그아웃 (세션 플래그 제거)
  adminLogout: publicProcedure.mutation(({ ctx }) => {
    delete (ctx.req.session as any).gymPlusAdmin;
    return { success: true };
  }),

  memberLogin: publicProcedure
    .input(z.object({ username: z.string(), password: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // 입력 전화번호 숫자만 추출
      const inputDigits = input.username.replace(/\D/g, "");

      // 모든 짐플러스 회원 가져와서 JS에서 전화번호 숫자 비교
      const allMembers = await db.select().from(gymPlusMembers);
      const member = allMembers.find(m => m.username.replace(/\D/g, "") === inputDigits);

      if (member) {
        if (!member.isActive) throw new TRPCError({ code: "FORBIDDEN", message: "비활성화된 계정입니다." });
        // 비밀번호는 항상 전화번호 뒷자리 4자리
        const phoneDigits = (member.phone ?? member.username).replace(/\D/g, "");
        const last4 = phoneDigits.slice(-4);
        if (input.password !== last4) throw new TRPCError({ code: "UNAUTHORIZED", message: "비밀번호가 잘못되었습니다. 전화번호 뒷자리 4자리를 입력하세요." });

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
      memberId: gymPlusMembers.memberId,
    }).from(gymPlusMembers).where(eq(gymPlusMembers.id, gymMemberId)).limit(1);
    const row = result[0];
    if (!row) return null;
    // gym_plus_members의 만료일이 없으면 연결된 메인 회원 데이터에서 가져옴
    if (!row.membershipEnd && row.memberId) {
      const mainRow = await db.select({ membershipEnd: members.membershipEnd })
        .from(members).where(eq(members.id, row.memberId)).limit(1);
      if (mainRow[0]?.membershipEnd) row.membershipEnd = mainRow[0].membershipEnd;
    }
    return row;
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

  // ── 메시지 관련 ─────────────────────────────────────────────────────────────

  // 관리자/트레이너 → 특정 회원에게 메시지 전송
  sendMessage: t.procedure
    .input(z.object({ gymPlusMemberId: z.number(), title: z.string(), content: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // 세션에서 발신자 이름 확인
      const adminUser = (ctx.req.session as any).user as AuthUser | undefined;
      if (!adminUser) throw new TRPCError({ code: "UNAUTHORIZED" });

      // 트레이너이면 트레이너 이름 사용
      let senderName = adminUser.username;
      if (adminUser.trainerId) {
        const [tr] = await db.select({ trainerName: trainers.trainerName }).from(trainers).where(eq(trainers.id, adminUser.trainerId)).limit(1);
        if (tr?.trainerName) senderName = tr.trainerName;
      }

      const [msg] = await db.insert(gymPlusMessages).values({
        gymPlusMemberId: input.gymPlusMemberId,
        senderName,
        title: input.title,
        content: input.content,
        createdAt: new Date().toISOString(),
      }).returning();

      // 해당 회원 푸시 구독 조회 후 전송
      const subs = await db.select().from(gymPlusPushSubscriptions).where(eq(gymPlusPushSubscriptions.gymPlusMemberId, input.gymPlusMemberId));
      const payload = JSON.stringify({ title: `${senderName}: ${input.title}`, body: input.content, url: "/gym-plus/messages" });
      for (const sub of subs) {
        try {
          await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload);
        } catch (e: any) {
          if (e.statusCode === 410 || e.statusCode === 404) {
            await db.delete(gymPlusPushSubscriptions).where(eq(gymPlusPushSubscriptions.id, sub.id));
          }
        }
      }
      return { success: true, id: msg.id };
    }),

  // 회원 메시지 목록 조회
  listMessages: publicProcedure.query(async ({ ctx }) => {
    const gymMemberId = (ctx.req.session as any).gymPlusMemberId as number | undefined;
    if (!gymMemberId) throw new TRPCError({ code: "UNAUTHORIZED" });
    const db = await getDb();
    if (!db) return [];
    return db.select().from(gymPlusMessages)
      .where(eq(gymPlusMessages.gymPlusMemberId, gymMemberId))
      .orderBy(desc(gymPlusMessages.createdAt));
  }),

  // 메시지 읽음 처리
  markMessageRead: publicProcedure
    .input(z.object({ messageId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const gymMemberId = (ctx.req.session as any).gymPlusMemberId as number | undefined;
      if (!gymMemberId) throw new TRPCError({ code: "UNAUTHORIZED" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.update(gymPlusMessages).set({ isRead: 1 }).where(and(eq(gymPlusMessages.id, input.messageId), eq(gymPlusMessages.gymPlusMemberId, gymMemberId)));
      return { success: true };
    }),

  // 읽지 않은 메시지 수
  unreadMessageCount: publicProcedure.query(async ({ ctx }) => {
    const gymMemberId = (ctx.req.session as any).gymPlusMemberId as number | undefined;
    if (!gymMemberId) return 0;
    const db = await getDb();
    if (!db) return 0;
    const [r] = await db.select({ count: sql<number>`count(*)` }).from(gymPlusMessages)
      .where(and(eq(gymPlusMessages.gymPlusMemberId, gymMemberId), eq(gymPlusMessages.isRead, 0)));
    return Number(r?.count ?? 0);
  }),

  // 푸시 구독 저장
  savePushSubscription: publicProcedure
    .input(z.object({ endpoint: z.string(), p256dh: z.string(), auth: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const gymMemberId = (ctx.req.session as any).gymPlusMemberId as number | undefined;
      if (!gymMemberId) throw new TRPCError({ code: "UNAUTHORIZED" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      // 이미 같은 endpoint 있으면 업데이트
      const [existing] = await db.select({ id: gymPlusPushSubscriptions.id }).from(gymPlusPushSubscriptions)
        .where(and(eq(gymPlusPushSubscriptions.gymPlusMemberId, gymMemberId), eq(gymPlusPushSubscriptions.endpoint, input.endpoint)));
      if (existing) {
        await db.update(gymPlusPushSubscriptions).set({ p256dh: input.p256dh, auth: input.auth }).where(eq(gymPlusPushSubscriptions.id, existing.id));
      } else {
        await db.insert(gymPlusPushSubscriptions).values({ gymPlusMemberId: gymMemberId, ...input, createdAt: new Date().toISOString() });
      }
      return { success: true };
    }),

  // 관리자용 전체 회원에게 일괄 메시지
  admin_sendBulkMessage: adminOnlyGymPlus
    .input(z.object({ gymPlusMemberIds: z.array(z.number()), title: z.string(), content: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const adminUser = (ctx.req.session as any).user as AuthUser | undefined;
      const senderName = adminUser?.username ?? "관리자";
      const now = new Date().toISOString();
      for (const memberId of input.gymPlusMemberIds) {
        await db.insert(gymPlusMessages).values({ gymPlusMemberId: memberId, senderName, title: input.title, content: input.content, createdAt: now });
        const subs = await db.select().from(gymPlusPushSubscriptions).where(eq(gymPlusPushSubscriptions.gymPlusMemberId, memberId));
        const payload = JSON.stringify({ title: `${senderName}: ${input.title}`, body: input.content, url: "/gym-plus/messages" });
        for (const sub of subs) {
          try { await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload); } catch {}
        }
      }
      return { count: input.gymPlusMemberIds.length };
    }),

  // 관리자용 VAPID 공개키 조회
  getVapidPublicKey: publicProcedure.query(() => VAPID_PUBLIC),

  // ── 재등록 신청 ─────────────────────────────────────────────────────────────

  // 회원: 재등록 신청 (앱에서 결제금액·기간·결제방법·유형을 담아 보내면 승인 화면에 자동 표시)
  requestRenewal: t.procedure
    .input(z.object({
      gymPlusMemberId: z.number(),
      memo: z.string().optional(),
      requestedAmount: z.number().min(0).optional(),
      requestedMonths: z.number().min(0).optional(),
      paymentMethod: z.string().optional(),
      membershipType: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      // 이미 pending 신청이 있으면 중복 불가
      const existing = await db.select().from(gymPlusMembershipRenewals)
        .where(and(eq(gymPlusMembershipRenewals.gymPlusMemberId, input.gymPlusMemberId), eq(gymPlusMembershipRenewals.status, "pending")))
        .limit(1);
      if (existing.length > 0) throw new TRPCError({ code: "BAD_REQUEST", message: "이미 처리 대기 중인 재등록 신청이 있습니다." });
      await db.insert(gymPlusMembershipRenewals).values({
        gymPlusMemberId: input.gymPlusMemberId,
        status: "pending",
        memo: input.memo,
        requestedAmount: input.requestedAmount,
        requestedMonths: input.requestedMonths,
        paymentMethod: input.paymentMethod,
        membershipType: input.membershipType,
        requestedAt: new Date().toISOString(),
      });
      return { success: true };
    }),

  // 회원: 내 재등록 신청 목록
  myRenewals: t.procedure
    .input(z.object({ gymPlusMemberId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      return db.select().from(gymPlusMembershipRenewals)
        .where(eq(gymPlusMembershipRenewals.gymPlusMemberId, input.gymPlusMemberId))
        .orderBy(desc(gymPlusMembershipRenewals.requestedAt));
    }),

  // 관리자/컨설턴트/트레이너: 재등록 신청 목록 (대시보드·상담관리 배너 조회 포함).
  // 트레이너는 본인 담당 회원의 신청만 보인다.
  admin_listRenewals: gymPlusRenewalView
    .input(z.object({ status: z.enum(["pending", "approved", "rejected", "all"]).default("pending") }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const rows = await db.select({
        renewal: gymPlusMembershipRenewals,
        memberName: gymPlusMembers.name,
        memberPhone: gymPlusMembers.phone,
        membershipEnd: gymPlusMembers.membershipEnd,
        linkedMemberId: gymPlusMembers.memberId,
      })
        .from(gymPlusMembershipRenewals)
        .leftJoin(gymPlusMembers, eq(gymPlusMembershipRenewals.gymPlusMemberId, gymPlusMembers.id))
        .where(input.status === "all" ? undefined : eq(gymPlusMembershipRenewals.status, input.status))
        .orderBy(desc(gymPlusMembershipRenewals.requestedAt));

      if (isFullRenewalAdmin(ctx) || ctx.user?.role === "consultant") return rows;

      // 트레이너: 본인 담당 회원 건만 남긴다 (memberId 연결 우선, 없으면 이름+전화 매칭)
      const trainerId = ctx.user?.trainerId;
      if (!trainerId) return [];
      const myMembers = await db.select({ id: members.id, name: members.name, phone: members.phone })
        .from(members).where(eq(members.trainerId, trainerId));
      const myIds = new Set(myMembers.map(m => m.id));
      const myKeys = new Set(myMembers.map(m => `${m.name}|${(m.phone ?? "").replace(/\D/g, "")}`));
      return rows.filter(r =>
        (r.linkedMemberId != null && myIds.has(r.linkedMemberId)) ||
        myKeys.has(`${r.memberName}|${(r.memberPhone ?? "").replace(/\D/g, "")}`)
      );
    }),

  // 관리자/담당 트레이너: 재등록 승인 — 앱 회원 만료일 연장 + (연결된) 통합운영 회원 만료일 연장 +
  // 결제금액이 입력되면 재등록 매출(revenue_entries)까지 기록해 등록관리·정산에 반영한다.
  admin_approveRenewal: gymPlusRenewalView
    .input(z.object({
      id: z.number(),
      newMembershipEnd: z.string(),
      adminNote: z.string().optional(),
      // 결제 정보(관리자가 입금 확인 후 입력). 없으면 매출은 만들지 않고 만료일만 연장.
      paidAmount: z.number().min(0).optional(),
      paymentMethod: z.string().optional(),
      paymentDate: z.string().optional(),
      type: z.enum(["헬스", "PT", "다이어트", "기타"]).optional(),
      programDetail: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const renewal = await db.select().from(gymPlusMembershipRenewals).where(eq(gymPlusMembershipRenewals.id, input.id)).limit(1);
      if (!renewal[0]) throw new TRPCError({ code: "NOT_FOUND" });
      await assertCanHandleRenewal(ctx, db, renewal[0].gymPlusMemberId);

      await db.update(gymPlusMembershipRenewals).set({
        status: "approved",
        newMembershipEnd: input.newMembershipEnd,
        adminNote: input.adminNote,
        processedAt: new Date().toISOString(),
      }).where(eq(gymPlusMembershipRenewals.id, input.id));

      // 앱 회원 만료일 연장
      const [gpMember] = await db.select().from(gymPlusMembers).where(eq(gymPlusMembers.id, renewal[0].gymPlusMemberId)).limit(1);
      await db.update(gymPlusMembers).set({ membershipEnd: input.newMembershipEnd })
        .where(eq(gymPlusMembers.id, renewal[0].gymPlusMemberId));

      // 연결된 통합운영 회원(members) 찾기: gymPlusMembers.memberId 우선, 없으면 이름+전화(숫자)로.
      let linkedMemberId: number | null = gpMember?.memberId ?? null;
      if (!linkedMemberId && gpMember?.name && gpMember?.phone) {
        const [m] = await db.select({ id: members.id }).from(members)
          .where(and(eq(members.name, gpMember.name), samePhone(members.phone, gpMember.phone))).limit(1);
        if (m) {
          linkedMemberId = m.id;
          // 다음부터 바로 연결되도록 gymPlusMembers.memberId도 채워둔다
          await db.update(gymPlusMembers).set({ memberId: m.id }).where(eq(gymPlusMembers.id, gpMember.id));
        }
      }
      // 통합운영 회원 만료일도 연장 (연장이 뒤로 가는 경우만 갱신 — 되돌리기 방지)
      if (linkedMemberId) {
        await db.update(members).set({ membershipEnd: input.newMembershipEnd, updatedAt: new Date().toISOString() })
          .where(eq(members.id, linkedMemberId));
      }

      // 결제금액이 입력되면 재등록 매출 기록
      if (input.paidAmount != null && input.paidAmount > 0) {
        const today = new Date().toISOString().substring(0, 10);
        await db.insert(revenueEntries).values({
          memberId: linkedMemberId ?? undefined,
          createdBy: ctx.user?.id ?? null,
          customerName: gpMember?.name ?? "",
          phone: gpMember?.phone ?? null,
          programDetail: input.programDetail ?? "앱 재등록",
          type: input.type ?? "헬스",
          subType: "재등록",
          amount: input.paidAmount,
          discountAmount: 0,
          paidAmount: input.paidAmount,
          unpaidAmount: 0,
          paymentMethod: input.paymentMethod ?? undefined,
          paymentDate: input.paymentDate ?? today,
          startDate: input.paymentDate ?? today,
          memo: "자이언트짐++ 앱 재등록 승인",
        });
      }

      return { success: true, linkedMemberId, revenueCreated: (input.paidAmount ?? 0) > 0 };
    }),

  // 관리자/담당 트레이너: 재등록 거절
  admin_rejectRenewal: gymPlusRenewalView
    .input(z.object({ id: z.number(), adminNote: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [target] = await db.select({ gymPlusMemberId: gymPlusMembershipRenewals.gymPlusMemberId })
        .from(gymPlusMembershipRenewals).where(eq(gymPlusMembershipRenewals.id, input.id)).limit(1);
      if (!target) throw new TRPCError({ code: "NOT_FOUND" });
      await assertCanHandleRenewal(ctx, db, target.gymPlusMemberId);
      await db.update(gymPlusMembershipRenewals).set({
        status: "rejected",
        adminNote: input.adminNote,
        processedAt: new Date().toISOString(),
      }).where(eq(gymPlusMembershipRenewals.id, input.id));
      return { success: true };
    }),

  // 온라인 등록 신청 목록
  admin_listRegistrationRequests: protectedProcedure
    .input(z.object({ status: z.enum(["pending", "approved", "rejected", "all"]).default("all") }))
    .query(async ({ ctx, input }) => {
      if (ctx.user?.role !== "admin" && ctx.user?.role !== "sub_admin")
        throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const rows = await db.select().from(gymPlusRegistrationRequests)
        .orderBy(desc(gymPlusRegistrationRequests.id));
      return input.status === "all"
        ? rows
        : rows.filter(r => r.status === input.status);
    }),

  // 온라인 등록 신청 승인/거절
  admin_updateRegistrationRequest: protectedProcedure
    .input(z.object({
      id: z.number(),
      status: z.enum(["approved", "rejected"]),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user?.role !== "admin" && ctx.user?.role !== "sub_admin")
        throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.update(gymPlusRegistrationRequests)
        .set({ status: input.status })
        .where(eq(gymPlusRegistrationRequests.id, input.id));
      return { success: true };
    }),
});
// ─── Event Programs ────────────────────────────────────────────────────────────
const eventProgramsRouter = t.router({
  list: protectedProcedure
    .input(z.object({ type: z.enum(["PT", "헬스", "all"]).default("all"), activeOnly: z.boolean().default(false) }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const today = new Date().toISOString().slice(0, 10);
      const typeFilter = input.type !== "all" ? sql`AND type = ${input.type}` : sql``;
      // activeOnly: isActive=1 AND (startDate <= today OR startDate IS NULL) AND (endDate >= today OR endDate IS NULL)
      const activeFilter = input.activeOnly
        ? sql`AND "isActive" = 1 AND (("startDate" IS NULL OR "startDate" <= ${today}) AND ("endDate" IS NULL OR "endDate" >= ${today}))`
        : sql``;
      const rows = await db.execute(
        sql`SELECT * FROM pt_event_programs WHERE 1=1 ${typeFilter} ${activeFilter} ORDER BY "isActive" DESC, "createdAt" DESC`
      );
      return ((rows as any).rows ?? (rows as any)) as Array<{
        id: number; type: string; name: string; sessions: number;
        applicableSessions: string | null;
        serviceSessions: number; pricePerSession: number; serviceSessionPrice: number;
        serviceSamePrice: number;
        discountType: string | null; discountValue: number;
        serviceHealthDays: number; freeUniform: number; freeLocker: number;
        isActive: number; startDate: string | null; endDate: string | null; createdAt: string;
      }>;
    }),

  upsert: protectedProcedure
    .input(z.object({
      id: z.number().optional(),
      type: z.enum(["PT", "헬스"]),
      name: z.string().min(1),
      applicableSessions: z.string().optional().default(""), // 콤마 구분 세션 목록, 예: "10,20,30"
      sessions: z.number().optional(),                       // 하위호환용
      pricePerSession: z.number().optional(),                // 하위호환용
      serviceSessions: z.number().min(0).default(0),
      serviceSessionPrice: z.number().min(0).default(0),
      serviceSamePrice: z.number().default(0),
      // 혜택 필드
      discountType: z.enum(["amount", "percent"]).nullable().optional(),
      discountValue: z.number().min(0).default(0),
      serviceHealthDays: z.number().min(0).default(0),
      freeUniform: z.number().default(0),
      freeLocker: z.number().default(0),
      isActive: z.number().default(1),
      startDate: z.string().nullable().optional(),
      endDate: z.string().nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user?.role !== "admin" && ctx.user?.role !== "sub_admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      // applicableSessions: 새 형식. 없으면 구 sessions 값으로 폴백
      const resolvedApplicable = input.applicableSessions || (input.sessions ? String(input.sessions) : "");
      const firstSession = parseInt(resolvedApplicable.split(",")[0]) || input.sessions || 0;
      const resolvedPrice = input.pricePerSession ?? 0;
      if (input.id) {
        await db.execute(sql`
          UPDATE pt_event_programs SET
            type = ${input.type}, name = ${input.name},
            sessions = ${firstSession}, "applicableSessions" = ${resolvedApplicable},
            "serviceSessions" = ${input.serviceSessions}, "pricePerSession" = ${resolvedPrice},
            "serviceSessionPrice" = ${input.serviceSessionPrice}, "serviceSamePrice" = ${input.serviceSamePrice},
            "discountType" = ${input.discountType ?? null}, "discountValue" = ${input.discountValue},
            "serviceHealthDays" = ${input.serviceHealthDays}, "freeUniform" = ${input.freeUniform}, "freeLocker" = ${input.freeLocker},
            "isActive" = ${input.isActive},
            "startDate" = ${input.startDate ?? null}, "endDate" = ${input.endDate ?? null}
          WHERE id = ${input.id}
        `);
      } else {
        await db.execute(sql`
          INSERT INTO pt_event_programs (type, name, sessions, "applicableSessions", "serviceSessions", "pricePerSession", "serviceSessionPrice", "serviceSamePrice", "discountType", "discountValue", "serviceHealthDays", "freeUniform", "freeLocker", "isActive", "startDate", "endDate", "createdAt")
          VALUES (${input.type}, ${input.name}, ${firstSession}, ${resolvedApplicable}, ${input.serviceSessions}, ${resolvedPrice}, ${input.serviceSessionPrice}, ${input.serviceSamePrice}, ${input.discountType ?? null}, ${input.discountValue}, ${input.serviceHealthDays}, ${input.freeUniform}, ${input.freeLocker}, ${input.isActive}, ${input.startDate ?? null}, ${input.endDate ?? null}, NOW()::text)
        `);
      }
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user?.role !== "admin" && ctx.user?.role !== "sub_admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.execute(sql`DELETE FROM pt_event_programs WHERE id = ${input.id}`);
      return { success: true };
    }),

  // 이벤트별 성과 (참여자 수 · 매출 합계) — eventId가 연결된 매출/패키지 기준
  performance: protectedProcedure.query(async () => {
    try {
      const result = await pool.query(`
        SELECT e.id,
               COUNT(DISTINCT r."memberId")                 AS participants,
               COUNT(r.id)                                  AS registrations,
               COALESCE(SUM(r."paidAmount"), 0)             AS revenue
        FROM pt_event_programs e
        LEFT JOIN revenue_entries r
          ON r."eventId" = e.id AND COALESCE(r."subType",'') <> '환불'
        GROUP BY e.id
      `);
      const map: Record<number, { participants: number; registrations: number; revenue: number }> = {};
      for (const row of result.rows) {
        map[row.id] = {
          participants: parseInt(row.participants ?? "0"),
          registrations: parseInt(row.registrations ?? "0"),
          revenue: parseInt(row.revenue ?? "0"),
        };
      }
      return map;
    } catch { return {}; }
  }),
});

// ─── Landing Router ───────────────────────────────────────────────────────────
const landingRouter = t.router({
  submitInquiry: publicProcedure
    .input(z.object({
      name: z.string(),
      phone: z.string(),
      purpose: z.string().optional(),
      message: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await pool.query(
        `INSERT INTO landing_inquiries (name, phone, purpose, message, "createdAt") VALUES ($1, $2, $3, $4, $5)`,
        [input.name, input.phone, input.purpose || null, input.message || null, new Date().toISOString()]
      );
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

  getSettings: publicProcedure.query(async () => {
    try {
      const result = await pool.query(`SELECT key, value FROM landing_settings`);
      const settings: Record<string, string> = {};
      for (const row of result.rows) { settings[row.key] = row.value; }
      return settings;
    } catch { return {} as Record<string, string>; }
  }),

  saveSettings: protectedProcedure
    .input(z.record(z.string()))
    .mutation(async ({ input, ctx }) => {
      if (ctx.user.role !== "admin" && ctx.user.role !== "sub_admin")
        throw new TRPCError({ code: "FORBIDDEN" });
      const now = new Date().toISOString();
      for (const [key, value] of Object.entries(input)) {
        await pool.query(
          `INSERT INTO landing_settings (key, value, "updatedAt") VALUES ($1, $2, $3)
           ON CONFLICT (key) DO UPDATE SET value = $2, "updatedAt" = $3`,
          [key, value, now]
        );
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
          `INSERT INTO landing_page_stats (event, session_id, duration_sec, "createdAt") VALUES ($1, $2, $3, $4)`,
          [input.event, input.session_id ?? null, input.duration_sec ?? null, new Date().toISOString()]
        );
      } catch { /* 테이블 없으면 무시 */ }
      return { success: true };
    }),

  getPageStats: protectedProcedure.query(async () => {
    try {
      // "createdAt"은 UTC로 저장되므로 +9시간(KST) 보정 후 날짜를 비교/그룹핑한다.
      // 안 그러면 한국시간 오전(00~09시)에 "오늘" 집계가 어제로 밀려 0으로 보인다.
      const [todayRes, naverRes, analysisRes, dailyRes] = await Promise.all([
        pool.query(`SELECT COUNT(*) as cnt FROM landing_page_stats WHERE event = 'page_view' AND ("createdAt"::timestamp + interval '9 hours')::date = (NOW() + interval '9 hours')::date`),
        pool.query(`SELECT COUNT(*) as cnt FROM landing_page_stats WHERE event = 'naver_click' AND ("createdAt"::timestamp + interval '9 hours')::date = (NOW() + interval '9 hours')::date`),
        pool.query(`SELECT COUNT(*) as cnt FROM body_analysis_reservations WHERE ("createdAt"::timestamp + interval '9 hours')::date = (NOW() + interval '9 hours')::date`),
        pool.query(`
          SELECT ("createdAt"::timestamp + interval '9 hours')::date as date,
            COUNT(CASE WHEN event='page_view' THEN 1 END) as views,
            COUNT(CASE WHEN event='naver_click' THEN 1 END) as naver_clicks,
            COUNT(CASE WHEN event='body_analysis_complete' THEN 1 END) as conversions
          FROM landing_page_stats
          WHERE "createdAt"::timestamp >= NOW() - INTERVAL '14 days'
          GROUP BY ("createdAt"::timestamp + interval '9 hours')::date ORDER BY date ASC
        `),
      ]);
      return {
        todayViews: parseInt(todayRes.rows[0]?.cnt ?? "0"),
        naverClicks: parseInt(naverRes.rows[0]?.cnt ?? "0"),
        analysisComplete: parseInt(analysisRes.rows[0]?.cnt ?? "0"),
        daily: dailyRes.rows,
      };
    } catch (e) { console.error("getPageStats error:", e); return { todayViews: 0, naverClicks: 0, analysisComplete: 0, daily: [] }; }
  }),

  // 월간/연간 랜딩페이지 통계 (month 있으면 해당 월, 없으면 해당 연도 전체). KST 기준 집계.
  // 순 방문자(중복 제거) + 신규/재방문 구분. 신규 = 그 기간에 처음 방문한 세션,
  // 재방문 = 이전에도 방문한 적 있는 세션. (세션ID가 재방문 시 유지될 때만 정확)
  getPageStatsByPeriod: protectedProcedure
    .input(z.object({ year: z.number(), month: z.number().optional() }))
    .query(async ({ input }) => {
      try {
        const fmt = input.month != null ? "'YYYY-MM'" : "'YYYY'";
        const prefix = input.month != null
          ? `${input.year}-${String(input.month).padStart(2, "0")}`
          : `${input.year}`;
        const [visitorRes, otherRes] = await Promise.all([
          // 순 방문자 + 신규/재방문: 이 기간에 방문한 세션을, 그 세션의 "최초 방문 시점"이
          // 이 기간 안인지(신규) 밖인지(재방문)로 나눈다.
          pool.query(`
            WITH sf AS (
              SELECT session_id, MIN("createdAt"::timestamp) AS first_ts
              FROM landing_page_stats
              WHERE event='page_view' AND session_id IS NOT NULL
              GROUP BY session_id
            ),
            period AS (
              SELECT DISTINCT session_id
              FROM landing_page_stats
              WHERE event='page_view' AND session_id IS NOT NULL
                AND to_char("createdAt"::timestamp + interval '9 hours', ${fmt}) = $1
            )
            SELECT
              COUNT(*) AS views,
              COUNT(*) FILTER (WHERE to_char(sf.first_ts + interval '9 hours', ${fmt}) = $1) AS new_visitors,
              COUNT(*) FILTER (WHERE to_char(sf.first_ts + interval '9 hours', ${fmt}) <> $1) AS returning_visitors
            FROM period p JOIN sf ON p.session_id = sf.session_id
          `, [prefix]),
          pool.query(`
            SELECT
              COUNT(CASE WHEN event='naver_click' THEN 1 END) as naver_clicks,
              COUNT(CASE WHEN event='body_analysis_complete' THEN 1 END) as conversions
            FROM landing_page_stats
            WHERE to_char("createdAt"::timestamp + interval '9 hours', ${fmt}) = $1
          `, [prefix]),
        ]);
        const v = visitorRes.rows[0];
        const o = otherRes.rows[0];
        return {
          views: parseInt(v?.views ?? "0"),
          newVisitors: parseInt(v?.new_visitors ?? "0"),
          returningVisitors: parseInt(v?.returning_visitors ?? "0"),
          naverClicks: parseInt(o?.naver_clicks ?? "0"),
          analysisComplete: parseInt(o?.conversions ?? "0"),
        };
      } catch (e) { console.error("getPageStatsByPeriod error:", e); return { views: 0, newVisitors: 0, returningVisitors: 0, naverClicks: 0, analysisComplete: 0 }; }
    }),

  getPageStatsByRange: protectedProcedure
    .input(z.object({ startDate: z.string(), endDate: z.string() }))
    .query(async ({ input }) => {
      try {
        const [visitorRes, otherRes] = await Promise.all([
          pool.query(`
            WITH sf AS (
              SELECT session_id, MIN("createdAt"::timestamp) AS first_ts
              FROM landing_page_stats
              WHERE event='page_view' AND session_id IS NOT NULL
              GROUP BY session_id
            ),
            period AS (
              SELECT DISTINCT session_id
              FROM landing_page_stats
              WHERE event='page_view' AND session_id IS NOT NULL
                AND ("createdAt"::timestamp + interval '9 hours')::date BETWEEN $1::date AND $2::date
            )
            SELECT
              COUNT(*) AS views,
              COUNT(*) FILTER (WHERE (sf.first_ts + interval '9 hours')::date BETWEEN $1::date AND $2::date) AS new_visitors,
              COUNT(*) FILTER (WHERE (sf.first_ts + interval '9 hours')::date < $1::date) AS returning_visitors
            FROM period p JOIN sf ON p.session_id = sf.session_id
          `, [input.startDate, input.endDate]),
          pool.query(`
            SELECT
              COUNT(CASE WHEN event='naver_click' THEN 1 END) as naver_clicks,
              COUNT(CASE WHEN event='body_analysis_complete' THEN 1 END) as conversions
            FROM landing_page_stats
            WHERE ("createdAt"::timestamp + interval '9 hours')::date BETWEEN $1::date AND $2::date
          `, [input.startDate, input.endDate]),
        ]);
        const v = visitorRes.rows[0];
        const o = otherRes.rows[0];
        return {
          views: parseInt(v?.views ?? "0"),
          newVisitors: parseInt(v?.new_visitors ?? "0"),
          returningVisitors: parseInt(v?.returning_visitors ?? "0"),
          naverClicks: parseInt(o?.naver_clicks ?? "0"),
          analysisComplete: parseInt(o?.conversions ?? "0"),
        };
      } catch (e) { console.error("getPageStatsByRange error:", e); return { views: 0, newVisitors: 0, returningVisitors: 0, naverClicks: 0, analysisComplete: 0 }; }
    }),
});

// ─── 무료 체형분석 예약 라우터 ────────────────────────────────────────────────
const bodyAnalysisRouter = t.router({
  // 공개 예약 신청 (인증 불필요)
  create: publicProcedure
    .input(z.object({
      name: z.string().min(1),
      phone: z.string().min(1),
      birthDate: z.string().optional(),
      gender: z.string().optional(),
      height: z.string().optional(),
      purpose: z.string().optional(),
      experience: z.string().optional(),
      concern: z.string().optional(),
      privacyAgreed: z.boolean(),
      marketingAgreed: z.boolean().default(false),
      marketingChannels: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const now = new Date().toISOString();

      // 1. 체형분석 예약 저장
      const [row] = await db.insert(bodyAnalysisReservations).values({
        name: input.name,
        phone: input.phone,
        birthDate: input.birthDate ?? null,
        gender: input.gender ?? null,
        height: input.height ?? null,
        purpose: input.purpose ?? null,
        experience: input.experience ?? null,
        concern: input.concern ?? null,
        privacyAgreed: input.privacyAgreed ? 1 : 0,
        marketingAgreed: input.marketingAgreed ? 1 : 0,
        marketingChannels: input.marketingChannels ?? null,
        status: "pending",
        createdAt: now,
      }).returning({ id: bodyAnalysisReservations.id });

      // 2. 상담관리(leads)에 카드 자동 생성
      const ageGroup = (() => {
        if (!input.birthDate) return null;
        const year = parseInt(input.birthDate.slice(0, 4));
        if (isNaN(year)) return null;
        const age = new Date().getFullYear() - year;
        if (age < 20) return "10대";
        if (age < 30) return "20대";
        if (age < 40) return "30대";
        if (age < 50) return "40대";
        if (age < 60) return "50대";
        return "60대 이상";
      })();

      const memoLines: string[] = [];
      if (input.height) memoLines.push(`키: ${input.height}cm`);
      if (input.experience) memoLines.push(`운동경험: ${input.experience}`);
      if (input.concern) memoLines.push(`고민: ${input.concern}`);
      memoLines.push(`[체형분석예약 #${row?.id ?? "?"}]`);

      await db.insert(leads).values({
        name: input.name,
        phone: input.phone,
        gender: input.gender ?? null,
        ageGroup,
        consultationType: "온라인예약",
        consultationSubTypes: "체형분석예약",
        exercisePurpose: input.purpose ?? null,
        memo: memoLines.join(" / "),
        status: "pending",
        createdAt: now,
        updatedAt: now,
      });

      return { success: true, id: row?.id };
    }),

  // 예약 목록 조회 (관리자)
  list: protectedProcedure
    .input(z.object({ status: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      if (ctx.user.role !== "admin" && ctx.user.role !== "sub_admin")
        throw new TRPCError({ code: "FORBIDDEN" });
      const rows = await db.select().from(bodyAnalysisReservations)
        .orderBy(desc(bodyAnalysisReservations.id));
      if (input.status && input.status !== "all") {
        return rows.filter((r) => r.status === input.status);
      }
      return rows;
    }),

  // 상태 변경 (관리자)
  updateStatus: protectedProcedure
    .input(z.object({ id: z.number(), status: z.enum(["pending", "contacted", "completed"]), note: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      if (ctx.user.role !== "admin" && ctx.user.role !== "sub_admin")
        throw new TRPCError({ code: "FORBIDDEN" });
      await db.update(bodyAnalysisReservations)
        .set({ status: input.status, note: input.note ?? null })
        .where(eq(bodyAnalysisReservations.id, input.id));
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
  access: accessRouter,
  trainingManual: trainingManualRouter,
  gymPlus: gymPlusRouter,
  transfer: transferRouter,
  eventPrograms: eventProgramsRouter,
  landing: landingRouter,
  consultantRecords: consultantRecordsRouter,
  consultantData: consultantDataRouter,
  bodyAnalysis: bodyAnalysisRouter,
  dataHealth: dataHealthRouter,
});

export type AppRouter = typeof appRouter;
