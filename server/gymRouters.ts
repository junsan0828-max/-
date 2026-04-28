import { initTRPC, TRPCError } from "@trpc/server";
import { z } from "zod";
import { eq, and, desc, sql, like, gte, lte, inArray } from "drizzle-orm";
import Anthropic from "@anthropic-ai/sdk";
import { getDb } from "./db";
import {
  channels,
  leads,
  revenueEntries,
  expenseEntries,
  revenueTargets,
  trainers,
  members,
  branches,
  users,
} from "../drizzle/schema";
import type { AuthUser } from "./auth";
import type { Request, Response } from "express";

interface Context {
  user?: AuthUser;
  req: Request;
  res: Response;
}

const t = initTRPC.context<Context>().create();
const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });
  return next({ ctx: { ...ctx, user: ctx.user } });
});

// ─── Channels ────────────────────────────────────────────────────────────────
const channelsRouter = t.router({
  list: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    return db.select().from(channels).orderBy(channels.name);
  }),

  create: protectedProcedure
    .input(z.object({ name: z.string().min(1), type: z.string(), description: z.string().optional() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [row] = await db.insert(channels).values(input).returning();
      return row;
    }),

  update: protectedProcedure
    .input(z.object({ id: z.number(), name: z.string().optional(), type: z.string().optional(), description: z.string().optional(), isActive: z.number().optional() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { id, ...data } = input;
      const [row] = await db.update(channels).set(data).where(eq(channels.id, id)).returning();
      return row;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.delete(channels).where(eq(channels.id, input.id));
      return { success: true };
    }),
});

// ─── Leads (CRM) ─────────────────────────────────────────────────────────────
const leadsRouter = t.router({
  list: protectedProcedure
    .input(z.object({
      year: z.number().optional(),
      month: z.number().optional(),
      status: z.string().optional(),
      channelId: z.number().optional(),
    }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const consultantAlias = db.select({ id: users.id, username: users.username }).from(users).as("consultant");
      const rows = await db.select({
        lead: leads,
        channelName: channels.name,
        trainerName: trainers.trainerName,
        consultantName: consultantAlias.username,
      })
        .from(leads)
        .leftJoin(channels, eq(leads.channelId, channels.id))
        .leftJoin(trainers, eq(leads.assignedTrainerId, trainers.id))
        .leftJoin(consultantAlias, eq(leads.assignedConsultantId, consultantAlias.id))
        .orderBy(desc(leads.createdAt));

      let result = rows;
      if (input?.year && input?.month) {
        const prefix = `${input.year}-${String(input.month).padStart(2, "0")}`;
        result = result.filter(r => r.lead.createdAt.startsWith(prefix));
      } else if (input?.year) {
        result = result.filter(r => r.lead.createdAt.startsWith(String(input.year)));
      }
      if (input?.status) result = result.filter(r => r.lead.status === input.status);
      if (input?.channelId) result = result.filter(r => r.lead.channelId === input.channelId);

      return result;
    }),

  create: protectedProcedure
    .input(z.object({
      name: z.string().min(1),
      phone: z.string().optional(),
      email: z.string().optional(),
      gender: z.string().optional(),
      ageGroup: z.string().optional(),
      channelId: z.number().optional(),
      branchId: z.number().optional(),
      status: z.string().default("pending"),
      assignedTrainerId: z.number().optional(),
      assignedConsultantId: z.number().optional(),
      consultationDate: z.string().optional(),
      consultationType: z.string().optional(),
      consultationSubTypes: z.string().optional(),
      consultationNote: z.string().optional(),
      interestType: z.string().optional(),
      exercisePurpose: z.string().optional(),
      memo: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [row] = await db.insert(leads).values({
        ...input,
        updatedAt: new Date().toISOString(),
      }).returning();
      return row;
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().optional(),
      phone: z.string().optional(),
      email: z.string().optional(),
      gender: z.string().optional(),
      ageGroup: z.string().optional(),
      channelId: z.number().optional(),
      branchId: z.number().optional(),
      status: z.string().optional(),
      assignedTrainerId: z.number().optional(),
      assignedConsultantId: z.number().optional(),
      consultationDate: z.string().optional(),
      consultationType: z.string().optional(),
      consultationSubTypes: z.string().optional(),
      consultationNote: z.string().optional(),
      registeredMemberId: z.number().optional(),
      interestType: z.string().optional(),
      exercisePurpose: z.string().optional(),
      memo: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { id, ...data } = input;
      const [row] = await db.update(leads).set({ ...data, updatedAt: new Date().toISOString() }).where(eq(leads.id, id)).returning();
      return row;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.delete(leads).where(eq(leads.id, input.id));
      return { success: true };
    }),

  stats: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    const allLeads = await db.select().from(leads);
    const total = allLeads.length;
    const pending = allLeads.filter(l => l.status === "pending").length;
    const consulted = allLeads.filter(l => l.status === "consulted").length;
    const registered = allLeads.filter(l => l.status === "registered").length;
    const dropped = allLeads.filter(l => l.status === "dropped").length;
    const conversionRate = total > 0 ? Math.round((registered / total) * 100) : 0;

    // 채널별 리드 수
    const byChannel: Record<number, { name: string; count: number; registered: number }> = {};
    const channelList = await db.select().from(channels);
    for (const ch of channelList) {
      const chLeads = allLeads.filter(l => l.channelId === ch.id);
      byChannel[ch.id] = { name: ch.name, count: chLeads.length, registered: chLeads.filter(l => l.status === "registered").length };
    }

    return { total, pending, consulted, registered, dropped, conversionRate, byChannel };
  }),
});

// ─── Revenue Entries (매출 장부) ──────────────────────────────────────────────
const revenueRouter = t.router({
  list: protectedProcedure
    .input(z.object({
      year: z.number().optional(),
      month: z.number().optional(),
      trainerId: z.number().optional(),
      branchId: z.number().optional(),
      type: z.string().optional(),
      subType: z.string().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const rows = await db.select({
        entry: revenueEntries,
        trainerName: trainers.trainerName,
        memberName: members.name,
        channelName: channels.name,
        branchName: branches.name,
      })
        .from(revenueEntries)
        .leftJoin(trainers, eq(revenueEntries.trainerId, trainers.id))
        .leftJoin(members, eq(revenueEntries.memberId, members.id))
        .leftJoin(channels, eq(revenueEntries.channelId, channels.id))
        .leftJoin(branches, eq(revenueEntries.branchId, branches.id))
        .orderBy(desc(revenueEntries.paymentDate));

      let result = rows;

      // 컨설턴트: 자신이 입력한 오늘 항목만 조회
      if (ctx.user?.role === "consultant") {
        const today = new Date().toISOString().substring(0, 10);
        result = result.filter(r => r.entry.createdBy === ctx.user!.id && r.entry.paymentDate === today);
        return result;
      }

      if (input?.year && input?.month) {
        const prefix = `${input.year}-${String(input.month).padStart(2, "0")}`;
        result = result.filter(r => r.entry.paymentDate.startsWith(prefix));
      } else if (input?.year) {
        result = result.filter(r => r.entry.paymentDate.startsWith(String(input.year)));
      }
      if (input?.trainerId) result = result.filter(r => r.entry.trainerId === input.trainerId);
      if (input?.branchId) result = result.filter(r => r.entry.branchId === input.branchId);
      if (input?.type) result = result.filter(r => r.entry.type === input.type);
      if (input?.subType) result = result.filter(r => r.entry.subType === input.subType);

      return result;
    }),

  create: protectedProcedure
    .input(z.object({
      customerName: z.string().optional(),
      phone: z.string().optional(),
      programDetail: z.string().optional(),
      sessions: z.number().optional(),
      duration: z.number().optional(),
      memberId: z.number().optional(),
      leadId: z.number().optional(),
      trainerId: z.number().optional(),
      branchId: z.number().optional(),
      channelId: z.number().optional(),
      type: z.enum(["PT", "헬스", "기타"]),
      subType: z.enum(["신규", "재등록"]),
      amount: z.number().min(0),
      discountAmount: z.number().min(0).default(0),
      paidAmount: z.number().min(0),
      unpaidAmount: z.number().min(0).default(0),
      refundAmount: z.number().min(0).default(0),
      paymentMethod: z.string().optional(),
      paymentDate: z.string(),
      startDate: z.string().optional(),
      installments: z.number().min(1).default(1),
      memo: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [row] = await db.insert(revenueEntries).values({
        ...input,
        createdBy: ctx.user!.id,
        updatedAt: new Date().toISOString(),
      }).returning();

      // 리드가 있으면 상태 registered로 업데이트
      if (input.leadId) {
        await db.update(leads).set({ status: "registered", updatedAt: new Date().toISOString() }).where(eq(leads.id, input.leadId));
      }

      return row;
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      customerName: z.string().optional(),
      phone: z.string().optional(),
      programDetail: z.string().optional(),
      sessions: z.number().optional(),
      duration: z.number().optional(),
      memberId: z.number().optional(),
      trainerId: z.number().optional(),
      branchId: z.number().optional(),
      channelId: z.number().optional(),
      type: z.string().optional(),
      subType: z.string().optional(),
      amount: z.number().optional(),
      discountAmount: z.number().optional(),
      paidAmount: z.number().optional(),
      unpaidAmount: z.number().optional(),
      refundAmount: z.number().optional(),
      paymentMethod: z.string().optional(),
      paymentDate: z.string().optional(),
      startDate: z.string().optional(),
      installments: z.number().optional(),
      memo: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { id, ...data } = input;

      // 컨설턴트: 자신이 입력한 항목만 수정 가능
      if (ctx.user?.role === "consultant") {
        const existing = await db.select().from(revenueEntries).where(eq(revenueEntries.id, id)).limit(1);
        if (!existing[0] || existing[0].createdBy !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "본인이 입력한 매출만 수정할 수 있습니다." });
        }
      }

      const [row] = await db.update(revenueEntries).set({ ...data, updatedAt: new Date().toISOString() }).where(eq(revenueEntries.id, id)).returning();
      return row;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // 컨설턴트는 삭제 불가
      if (ctx.user?.role === "consultant") {
        throw new TRPCError({ code: "FORBIDDEN", message: "삭제 권한이 없습니다." });
      }

      await db.delete(revenueEntries).where(eq(revenueEntries.id, input.id));
      return { success: true };
    }),

  monthlySummary: protectedProcedure
    .input(z.object({ year: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const allEntries = await db.select().from(revenueEntries).where(like(revenueEntries.paymentDate, `${input.year}%`));

      const monthly: Record<number, { month: number; total: number; paid: number; unpaid: number; pt: number; health: number; newSales: number; renewal: number; count: number }> = {};
      for (let m = 1; m <= 12; m++) {
        monthly[m] = { month: m, total: 0, paid: 0, unpaid: 0, pt: 0, health: 0, newSales: 0, renewal: 0, count: 0 };
      }

      for (const entry of allEntries) {
        const month = parseInt(entry.paymentDate.substring(5, 7));
        if (!monthly[month]) continue;
        monthly[month].total += entry.amount;
        monthly[month].paid += entry.paidAmount;
        monthly[month].unpaid += entry.unpaidAmount;
        monthly[month].count += 1;
        if (entry.type === "PT") monthly[month].pt += entry.paidAmount;
        if (entry.type === "헬스") monthly[month].health += entry.paidAmount;
        if (entry.subType === "신규") monthly[month].newSales += entry.paidAmount;
        if (entry.subType === "재등록") monthly[month].renewal += entry.paidAmount;
      }

      return Object.values(monthly);
    }),

  trainerSummary: protectedProcedure
    .input(z.object({ year: z.number(), month: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const prefix = `${input.year}-${String(input.month).padStart(2, "0")}`;
      const rows = await db.select({
        entry: revenueEntries,
        trainerName: trainers.trainerName,
      })
        .from(revenueEntries)
        .leftJoin(trainers, eq(revenueEntries.trainerId, trainers.id))
        .where(like(revenueEntries.paymentDate, `${prefix}%`));

      const byTrainer: Record<number, { trainerId: number; trainerName: string; total: number; pt: number; health: number; newSales: number; renewal: number; count: number }> = {};
      for (const row of rows) {
        const tid = row.entry.trainerId ?? 0;
        if (!byTrainer[tid]) {
          byTrainer[tid] = { trainerId: tid, trainerName: row.trainerName ?? "미배정", total: 0, pt: 0, health: 0, newSales: 0, renewal: 0, count: 0 };
        }
        byTrainer[tid].total += row.entry.paidAmount;
        byTrainer[tid].count += 1;
        if (row.entry.type === "PT") byTrainer[tid].pt += row.entry.paidAmount;
        if (row.entry.type === "헬스") byTrainer[tid].health += row.entry.paidAmount;
        if (row.entry.subType === "신규") byTrainer[tid].newSales += row.entry.paidAmount;
        if (row.entry.subType === "재등록") byTrainer[tid].renewal += row.entry.paidAmount;
      }

      return Object.values(byTrainer).sort((a, b) => b.total - a.total);
    }),

  channelSummary: protectedProcedure
    .input(z.object({ year: z.number(), month: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const prefix = `${input.year}-${String(input.month).padStart(2, "0")}`;
      const rows = await db.select({
        entry: revenueEntries,
        channelName: channels.name,
      })
        .from(revenueEntries)
        .leftJoin(channels, eq(revenueEntries.channelId, channels.id))
        .where(like(revenueEntries.paymentDate, `${prefix}%`));

      const byChannel: Record<string, { channelId: number | null; channelName: string; total: number; count: number }> = {};
      for (const row of rows) {
        const key = String(row.entry.channelId ?? "none");
        if (!byChannel[key]) {
          byChannel[key] = { channelId: row.entry.channelId, channelName: row.channelName ?? "채널 미상", total: 0, count: 0 };
        }
        byChannel[key].total += row.entry.paidAmount;
        byChannel[key].count += 1;
      }

      return Object.values(byChannel).sort((a, b) => b.total - a.total);
    }),

  targets: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    return db.select().from(revenueTargets).orderBy(revenueTargets.year, revenueTargets.month);
  }),

  setTarget: protectedProcedure
    .input(z.object({ year: z.number(), month: z.number(), targetAmount: z.number(), branchId: z.number().optional() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const existing = await db.select().from(revenueTargets)
        .where(and(eq(revenueTargets.year, input.year), eq(revenueTargets.month, input.month)))
        .limit(1);

      if (existing[0]) {
        const [row] = await db.update(revenueTargets).set({ targetAmount: input.targetAmount }).where(eq(revenueTargets.id, existing[0].id)).returning();
        return row;
      } else {
        const [row] = await db.insert(revenueTargets).values(input).returning();
        return row;
      }
    }),
});

// ─── Expense Entries (지출 장부) ──────────────────────────────────────────────
const expenseRouter = t.router({
  list: protectedProcedure
    .input(z.object({ year: z.number().optional(), month: z.number().optional(), category: z.string().optional() }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const rows = await db.select({
        entry: expenseEntries,
        branchName: branches.name,
      })
        .from(expenseEntries)
        .leftJoin(branches, eq(expenseEntries.branchId, branches.id))
        .orderBy(desc(expenseEntries.expenseDate));

      let result = rows;
      if (input?.year && input?.month) {
        const prefix = `${input.year}-${String(input.month).padStart(2, "0")}`;
        result = result.filter(r => r.entry.expenseDate.startsWith(prefix));
      }
      if (input?.category) result = result.filter(r => r.entry.category === input.category);

      return result;
    }),

  create: protectedProcedure
    .input(z.object({
      branchId: z.number().optional(),
      category: z.string(),
      subCategory: z.string().optional(),
      amount: z.number().min(0),
      paymentMethod: z.string().optional(),
      vendor: z.string().optional(),
      expenseDate: z.string(),
      memo: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [row] = await db.insert(expenseEntries).values(input).returning();
      return row;
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      category: z.string().optional(),
      subCategory: z.string().optional(),
      amount: z.number().optional(),
      paymentMethod: z.string().optional(),
      vendor: z.string().optional(),
      expenseDate: z.string().optional(),
      memo: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { id, ...data } = input;
      const [row] = await db.update(expenseEntries).set(data).where(eq(expenseEntries.id, id)).returning();
      return row;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.delete(expenseEntries).where(eq(expenseEntries.id, input.id));
      return { success: true };
    }),

  categorySummary: protectedProcedure
    .input(z.object({ year: z.number(), month: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const prefix = `${input.year}-${String(input.month).padStart(2, "0")}`;
      const rows = await db.select().from(expenseEntries).where(like(expenseEntries.expenseDate, `${prefix}%`));

      const byCategory: Record<string, number> = {};
      for (const row of rows) {
        byCategory[row.category] = (byCategory[row.category] ?? 0) + row.amount;
      }

      return Object.entries(byCategory).map(([category, total]) => ({ category, total })).sort((a, b) => b.total - a.total);
    }),
});

// ─── KPI Dashboard ───────────────────────────────────────────────────────────
const kpiRouter = t.router({
  overview: protectedProcedure
    .input(z.object({ year: z.number(), month: z.number() }))
    .query(async ({ ctx, input }) => {
      if (ctx.user?.role === "consultant") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const today = new Date().toISOString().substring(0, 10);
      const prefix = `${input.year}-${String(input.month).padStart(2, "0")}`;

      const [allRevenue, allExpenses, allLeads, allTargets] = await Promise.all([
        db.select().from(revenueEntries),
        db.select().from(expenseEntries),
        db.select().from(leads),
        db.select().from(revenueTargets),
      ]);

      // 오늘 매출
      const todayRevenue = allRevenue.filter(r => r.paymentDate === today).reduce((s, r) => s + r.paidAmount, 0);

      // 이번달 매출
      const monthRevenue = allRevenue.filter(r => r.paymentDate.startsWith(prefix));
      const monthTotal = monthRevenue.reduce((s, r) => s + r.paidAmount, 0);
      const monthNewSales = monthRevenue.filter(r => r.subType === "신규").reduce((s, r) => s + r.paidAmount, 0);
      const monthRenewal = monthRevenue.filter(r => r.subType === "재등록").reduce((s, r) => s + r.paidAmount, 0);
      const monthPT = monthRevenue.filter(r => r.type === "PT").reduce((s, r) => s + r.paidAmount, 0);
      const monthHealth = monthRevenue.filter(r => r.type === "헬스").reduce((s, r) => s + r.paidAmount, 0);

      // 이번달 지출
      const monthExpenses = allExpenses.filter(e => e.expenseDate.startsWith(prefix)).reduce((s, e) => s + e.amount, 0);

      // 미수금 (전체)
      const totalUnpaid = allRevenue.reduce((s, r) => s + r.unpaidAmount, 0);

      // 환불
      const monthRefund = monthRevenue.reduce((s, r) => s + r.refundAmount, 0);

      // 목표
      const target = allTargets.find(t => t.year === input.year && t.month === input.month);
      const targetAmount = target?.targetAmount ?? 0;
      const achieveRate = targetAmount > 0 ? Math.round((monthTotal / targetAmount) * 100) : 0;

      // 리드 전환율 (이번달 등록 리드 / 전체 이번달 리드)
      const monthLeads = allLeads.filter(l => l.createdAt.startsWith(prefix));
      const conversionRate = monthLeads.length > 0
        ? Math.round((monthLeads.filter(l => l.status === "registered").length / monthLeads.length) * 100)
        : 0;

      // 재등록률 (이번달 재등록 건수 / 전체 이번달 건수)
      const renewalRate = monthRevenue.length > 0
        ? Math.round((monthRevenue.filter(r => r.subType === "재등록").length / monthRevenue.length) * 100)
        : 0;

      // 전월 대비
      const prevMonth = input.month === 1 ? 12 : input.month - 1;
      const prevYear = input.month === 1 ? input.year - 1 : input.year;
      const prevPrefix = `${prevYear}-${String(prevMonth).padStart(2, "0")}`;
      const prevMonthTotal = allRevenue.filter(r => r.paymentDate.startsWith(prevPrefix)).reduce((s, r) => s + r.paidAmount, 0);
      const momGrowth = prevMonthTotal > 0 ? Math.round(((monthTotal - prevMonthTotal) / prevMonthTotal) * 100) : 0;

      return {
        todayRevenue,
        monthTotal,
        monthNewSales,
        monthRenewal,
        monthPT,
        monthHealth,
        monthExpenses,
        monthProfit: monthTotal - monthExpenses,
        totalUnpaid,
        monthRefund,
        targetAmount,
        achieveRate,
        conversionRate,
        renewalRate,
        momGrowth,
        prevMonthTotal,
      };
    }),

  recentActivity: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    const [recentRevenue, recentLeads] = await Promise.all([
      db.select({ entry: revenueEntries, trainerName: trainers.trainerName, memberName: members.name })
        .from(revenueEntries)
        .leftJoin(trainers, eq(revenueEntries.trainerId, trainers.id))
        .leftJoin(members, eq(revenueEntries.memberId, members.id))
        .orderBy(desc(revenueEntries.createdAt))
        .limit(10),
      db.select({ lead: leads, channelName: channels.name })
        .from(leads)
        .leftJoin(channels, eq(leads.channelId, channels.id))
        .orderBy(desc(leads.createdAt))
        .limit(10),
    ]);

    return { recentRevenue, recentLeads };
  }),
});

// ─── AI Analysis ─────────────────────────────────────────────────────────────
const aiRouter = t.router({
  analyze: protectedProcedure
    .input(z.object({ year: z.number(), month: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const prefix = `${input.year}-${String(input.month).padStart(2, "0")}`;
      const prevMonth = input.month === 1 ? 12 : input.month - 1;
      const prevYear = input.month === 1 ? input.year - 1 : input.year;
      const prevPrefix = `${prevYear}-${String(prevMonth).padStart(2, "0")}`;

      const [allRevenue, allExpenses, allLeads, allChannels, allTrainers] = await Promise.all([
        db.select().from(revenueEntries),
        db.select().from(expenseEntries),
        db.select().from(leads),
        db.select().from(channels),
        db.select().from(trainers),
      ]);

      const monthRevenue = allRevenue.filter(r => r.paymentDate.startsWith(prefix));
      const prevRevenue = allRevenue.filter(r => r.paymentDate.startsWith(prevPrefix));
      const monthExpenses = allExpenses.filter(e => e.expenseDate.startsWith(prefix));

      const monthTotal = monthRevenue.reduce((s, r) => s + r.paidAmount, 0);
      const prevTotal = prevRevenue.reduce((s, r) => s + r.paidAmount, 0);
      const totalUnpaid = allRevenue.reduce((s, r) => s + r.unpaidAmount, 0);

      // 대분류별 지출
      const EXPENSE_CATEGORIES = ["고정관리비", "유동관리비", "인건비", "운영비"];
      const expenseByCat = EXPENSE_CATEGORIES.map(cat => {
        const items = monthExpenses.filter(e => e.category === cat);
        const total = items.reduce((s, e) => s + e.amount, 0);
        const subBreakdown = items.reduce((acc: Record<string, number>, e) => {
          const key = e.subCategory ?? e.category;
          acc[key] = (acc[key] ?? 0) + e.amount;
          return acc;
        }, {});
        return { cat, total, subBreakdown };
      }).filter(c => c.total > 0);

      // 채널별 매출
      const channelStats = allChannels.map(ch => {
        const chRevenue = monthRevenue.filter(r => r.channelId === ch.id);
        return { channel: ch.name, count: chRevenue.length, total: chRevenue.reduce((s, r) => s + r.paidAmount, 0) };
      }).filter(c => c.count > 0).sort((a, b) => b.total - a.total);

      // 트레이너별 매출
      const trainerStats = allTrainers.map(tr => {
        const trRevenue = monthRevenue.filter(r => r.trainerId === tr.id);
        return { trainer: tr.trainerName, count: trRevenue.length, total: trRevenue.reduce((s, r) => s + r.paidAmount, 0) };
      }).filter(t => t.count > 0).sort((a, b) => b.total - a.total);

      // 리드 전환율
      const monthLeads = allLeads.filter(l => l.createdAt.startsWith(prefix));
      const conversionRate = monthLeads.length > 0
        ? Math.round((monthLeads.filter(l => l.status === "registered").length / monthLeads.length) * 100) : 0;

      const dataContext = `
자이언트짐 ${input.year}년 ${input.month}월 운영 데이터 요약:

📊 매출 현황:
- 이번달 매출: ${monthTotal.toLocaleString()}원
- 전월 매출: ${prevTotal.toLocaleString()}원
- 전월 대비: ${prevTotal > 0 ? ((monthTotal - prevTotal) / prevTotal * 100).toFixed(1) : 0}%
- 신규 매출: ${monthRevenue.filter(r => r.subType === "신규").reduce((s, r) => s + r.paidAmount, 0).toLocaleString()}원
- 재등록 매출: ${monthRevenue.filter(r => r.subType === "재등록").reduce((s, r) => s + r.paidAmount, 0).toLocaleString()}원
- PT 매출: ${monthRevenue.filter(r => r.type === "PT").reduce((s, r) => s + r.paidAmount, 0).toLocaleString()}원
- 헬스 매출: ${monthRevenue.filter(r => r.type === "헬스").reduce((s, r) => s + r.paidAmount, 0).toLocaleString()}원
- 순이익(매출-지출): ${(monthTotal - monthExpenses.reduce((s, e) => s + e.amount, 0)).toLocaleString()}원
- 전체 미수금: ${totalUnpaid.toLocaleString()}원

💸 지출 현황 (총 ${monthExpenses.reduce((s, e) => s + e.amount, 0).toLocaleString()}원):
${expenseByCat.length > 0 ? expenseByCat.map(c => {
  const subs = Object.entries(c.subBreakdown).map(([k, v]) => `${k} ${(v as number).toLocaleString()}원`).join(", ");
  return `- ${c.cat}: ${c.total.toLocaleString()}원 (${subs})`;
}).join("\n") : "- 지출 데이터 없음"}

📣 채널별 매출: ${channelStats.map(c => `${c.channel} ${c.total.toLocaleString()}원(${c.count}건)`).join(", ") || "데이터 없음"}

👥 트레이너별 매출: ${trainerStats.map(t => `${t.trainer} ${t.total.toLocaleString()}원(${t.count}건)`).join(", ") || "데이터 없음"}

🎯 리드 & 전환:
- 이번달 리드: ${monthLeads.length}건
- 상담→등록 전환율: ${conversionRate}%
- 재등록률: ${monthRevenue.length > 0 ? Math.round(monthRevenue.filter(r => r.subType === "재등록").length / monthRevenue.length * 100) : 0}%
`;

      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        return {
          analysis: generateFallbackAnalysis({ monthTotal, prevTotal, totalUnpaid, conversionRate, channelStats, trainerStats, monthRevenue }),
          isAI: false,
        };
      }

      try {
        const client = new Anthropic({ apiKey });
        const message = await client.messages.create({
          model: "claude-sonnet-4-6",
          max_tokens: 1024,
          messages: [{
            role: "user",
            content: `당신은 피트니스 센터 운영 전문 AI 컨설턴트입니다. 아래 데이터를 분석하여 한국어로 실용적인 운영 인사이트를 제공해주세요.

${dataContext}

다음 항목을 분석해주세요 (각 항목 2-3문장):
1. **매출 구조 요약**: 이번달 매출의 핵심 특징
2. **지출 분석**: 대분류별 지출 비중과 절감 가능 항목
3. **수익성**: 순이익 및 매출 대비 지출 비율 평가
4. **주요 이슈**: 미수금, 재등록률, 전환율 등 개선 필요 사항
5. **채널 & 트레이너 효율**: 효과적인 채널과 트레이너 성과
6. **다음 행동 제안**: 구체적인 액션 아이템 3가지

간결하고 실용적으로 작성해주세요.`,
          }],
        });
        const text = message.content[0].type === "text" ? message.content[0].text : "";
        return { analysis: text, isAI: true };
      } catch (err) {
        return {
          analysis: generateFallbackAnalysis({ monthTotal, prevTotal, totalUnpaid, conversionRate, channelStats, trainerStats, monthRevenue }),
          isAI: false,
        };
      }
    }),
});

function generateFallbackAnalysis(data: {
  monthTotal: number;
  prevTotal: number;
  totalUnpaid: number;
  conversionRate: number;
  channelStats: { channel: string; total: number; count: number }[];
  trainerStats: { trainer: string; total: number; count: number }[];
  monthRevenue: { subType: string; paidAmount: number }[];
}) {
  const mom = data.prevTotal > 0 ? ((data.monthTotal - data.prevTotal) / data.prevTotal * 100).toFixed(1) : "0";
  const renewal = data.monthRevenue.filter(r => r.subType === "재등록").length;
  const renewalRate = data.monthRevenue.length > 0 ? Math.round(renewal / data.monthRevenue.length * 100) : 0;
  const topChannel = data.channelStats[0];
  const topTrainer = data.trainerStats[0];

  return `**매출 구조 요약**
이번달 총 매출은 ${data.monthTotal.toLocaleString()}원으로 전월 대비 ${parseFloat(mom) >= 0 ? "+" : ""}${mom}% 변동했습니다. 재등록 비중은 ${renewalRate}%이며 신규 유입이 ${100 - renewalRate}%를 차지합니다.

**주요 이슈**
${data.totalUnpaid > 0 ? `전체 미수금이 ${data.totalUnpaid.toLocaleString()}원으로 즉시 수금 관리가 필요합니다.` : "현재 미수금 이슈는 없습니다."} 상담→등록 전환율이 ${data.conversionRate}%${data.conversionRate < 30 ? "로 낮은 수준입니다. 상담 스크립트 개선이 필요합니다." : "로 양호한 수준입니다."}

**채널 효율**
${topChannel ? `${topChannel.channel}이 가장 높은 매출(${topChannel.total.toLocaleString()}원, ${topChannel.count}건)을 기록 중입니다. 해당 채널의 예산을 확대하는 것을 검토하세요.` : "채널 데이터가 부족합니다. 매출 입력 시 채널을 반드시 기록해주세요."}

**트레이너 성과**
${topTrainer ? `${topTrainer.trainer} 트레이너가 ${topTrainer.total.toLocaleString()}원으로 최고 성과를 기록했습니다.` : "트레이너별 매출 데이터를 입력해주세요."} 트레이너별 성과 차이가 있다면 우수 트레이너의 상담 기법을 공유하세요.

**다음 행동 제안**
1. ${data.totalUnpaid > 0 ? `미수금 ${data.totalUnpaid.toLocaleString()}원에 대한 수금 연락 즉시 진행` : "이번달 목표 대비 달성률을 확인하고 부족분 채우기"}
2. ${renewalRate < 30 ? "재등록률 향상을 위해 만료 30일 전 회원 대상 재등록 혜택 안내" : "높은 재등록률을 유지하면서 신규 리드 확보에 집중"}
3. ${data.conversionRate < 40 ? "상담 전환율 개선: 무료 체험 세션 도입 또는 상담 후 24시간 이내 팔로우업 연락" : "전환율이 좋은 채널에 마케팅 예산 집중 투자"}`;
}

// ─── Gym Router ───────────────────────────────────────────────────────────────
export const gymRouter = t.router({
  channels: channelsRouter,
  leads: leadsRouter,
  revenue: revenueRouter,
  expenses: expenseRouter,
  kpi: kpiRouter,
  ai: aiRouter,
});

export type GymRouter = typeof gymRouter;
