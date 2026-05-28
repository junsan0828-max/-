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
  trainerBranches,
  users,
  tasks,
  notices,
  noticeReads,
  parQ,
  ptSessionLogs,
  attendanceChecks,
  healthReports,
  ptReports,
  ptPackages,
} from "../drizzle/schema";
import type { ReportData } from "./healthReportHTML";
import { generatePTReportHTML } from "./ptReportHTML";
import type { PTReportData, ExerciseStat } from "./ptReportHTML";
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
    .mutation(async ({ ctx, input }) => {
      if (ctx.user?.role === "sub_admin") throw new TRPCError({ code: "FORBIDDEN", message: "부관리자는 삭제 권한이 없습니다." });
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
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // 관리상담 → 상담완료 자동 전환: 상담일 기준 7일 경과 시
      const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().substring(0, 10);
      await db.update(leads)
        .set({ status: "consulted", updatedAt: new Date().toISOString() })
        .where(and(eq(leads.status, "followup"), lte(leads.consultationDate, cutoff)));

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

      // 트레이너: 본인이 담당하거나 상담담당인 리드만 조회
      if (ctx.user?.role === "trainer") {
        result = result.filter(r =>
          r.lead.assignedTrainerId === ctx.user!.trainerId ||
          r.lead.assignedConsultantId === ctx.user!.id
        );
      }
      if (input?.year && input?.month) {
        const prefix = `${input.year}-${String(input.month).padStart(2, "0")}`;
        result = result.filter(r => (r.lead.consultationDate ?? r.lead.createdAt).startsWith(prefix));
      } else if (input?.year) {
        result = result.filter(r => (r.lead.consultationDate ?? r.lead.createdAt).startsWith(String(input.year)));
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
      signatureDataUrl: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      // 트레이너: 본인을 상담담당으로 자동 설정
      const autoFields = ctx.user?.role === "trainer" ? {
        assignedConsultantId: input.assignedConsultantId ?? ctx.user.id,
        assignedTrainerId: input.assignedTrainerId ?? ctx.user.trainerId ?? undefined,
      } : {};
      const [row] = await db.insert(leads).values({
        ...input,
        ...autoFields,
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
      signatureDataUrl: z.string().optional(),
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
    .mutation(async ({ ctx, input }) => {
      if (ctx.user?.role === "sub_admin") throw new TRPCError({ code: "FORBIDDEN", message: "부관리자는 삭제 권한이 없습니다." });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.delete(leads).where(eq(leads.id, input.id));
      return { success: true };
    }),

  getByMemberId: protectedProcedure
    .input(z.object({ memberId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;
      const [row] = await db.select({
        consultationNote: leads.consultationNote,
        memo: leads.memo,
      }).from(leads).where(eq(leads.registeredMemberId, input.memberId)).limit(1);
      return row ?? null;
    }),

  stats: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    const allLeads = await db.select().from(leads);
    const total = allLeads.length;
    const consulted = allLeads.filter(l => l.status === "consulted").length;
    const followup = allLeads.filter(l => l.status === "followup").length;
    const registered = allLeads.filter(l => l.status === "registered").length;
    const conversionRate = total > 0 ? Math.round((registered / total) * 100) : 0;

    // 채널별 리드 수
    const byChannel: Record<number, { name: string; count: number; registered: number }> = {};
    const channelList = await db.select().from(channels);
    for (const ch of channelList) {
      const chLeads = allLeads.filter(l => l.channelId === ch.id);
      byChannel[ch.id] = { name: ch.name, count: chLeads.length, registered: chLeads.filter(l => l.status === "registered").length };
    }

    return { total, consulted, followup, registered, conversionRate, byChannel };
  }),

  statsByMonth: protectedProcedure
    .input(z.object({ year: z.number(), month: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const prefix = `${input.year}-${String(input.month).padStart(2, "0")}`;
      const allLeads = await db.select().from(leads);
      const monthLeads = allLeads.filter(l => (l.consultationDate ?? "").startsWith(prefix));

      const total = monthLeads.length;
      const consulted = monthLeads.filter(l => l.status === "consulted").length;
      const followup = monthLeads.filter(l => l.status === "followup").length;
      const registered = monthLeads.filter(l => l.status === "registered").length;
      const conversionRate = total > 0 ? Math.round((registered / total) * 100) : 0;

      const channelList = await db.select().from(channels);
      const byChannel: Record<number, { name: string; count: number; registered: number }> = {};
      for (const ch of channelList) {
        const chLeads = monthLeads.filter(l => l.channelId === ch.id);
        if (chLeads.length > 0)
          byChannel[ch.id] = { name: ch.name, count: chLeads.length, registered: chLeads.filter(l => l.status === "registered").length };
      }

      return { total, consulted, followup, registered, conversionRate, byChannel };
    }),

  backfillMemberData: protectedProcedure.mutation(async ({ ctx }) => {
    if (ctx.user?.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    // 리드와 연결된 회원 목록 조회
    const linkedLeads = await db.select({
      leadGender: leads.gender,
      leadChannelId: leads.channelId,
      memberId: leads.registeredMemberId,
    }).from(leads).where(sql`"registeredMemberId" IS NOT NULL`);

    const channelList = await db.select({ id: channels.id, name: channels.name }).from(channels);
    const channelMap = new Map(channelList.map(c => [c.id, c.name]));

    let updated = 0;
    for (const row of linkedLeads) {
      if (!row.memberId) continue;
      const [mem] = await db.select({ gender: members.gender, visitRoute: members.visitRoute })
        .from(members).where(eq(members.id, row.memberId)).limit(1);
      if (!mem) continue;

      const updates: Record<string, string | undefined> = {};
      if (!mem.gender && row.leadGender) updates.gender = row.leadGender;
      if (!mem.visitRoute && row.leadChannelId) updates.visitRoute = channelMap.get(row.leadChannelId) ?? undefined;

      if (Object.keys(updates).length > 0) {
        await db.update(members).set({ ...updates, updatedAt: new Date().toISOString() }).where(eq(members.id, row.memberId));
        updated++;
      }
    }

    return { total: linkedLeads.length, updated };
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
        consultantName: users.username,
      })
        .from(revenueEntries)
        .leftJoin(trainers, eq(revenueEntries.trainerId, trainers.id))
        .leftJoin(members, eq(revenueEntries.memberId, members.id))
        .leftJoin(channels, eq(revenueEntries.channelId, channels.id))
        .leftJoin(branches, eq(revenueEntries.branchId, branches.id))
        .leftJoin(users, eq(revenueEntries.consultantId, users.id))
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
      serviceSessions: z.number().min(0).default(0).optional(),
      duration: z.number().optional(),
      serviceHealthDuration: z.number().optional(),
      memberId: z.number().optional(),
      leadId: z.number().optional(),
      trainerId: z.number().optional(),
      consultantId: z.number().optional(),
      branchId: z.number().optional(),
      channelId: z.number().optional(),
      type: z.enum(["PT", "헬스", "기타"]),
      subType: z.enum(["신규", "재등록", "이전"]),
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
      // 트레이너: trainerId, consultantId 자동 설정
      const trainerAutoFields = ctx.user?.role === "trainer" ? {
        trainerId: input.trainerId ?? ctx.user.trainerId ?? undefined,
        consultantId: input.consultantId ?? ctx.user.id,
      } : {};
      const resolvedTrainerId = (trainerAutoFields as any).trainerId ?? input.trainerId ?? undefined;

      // branchId 미지정 시 트레이너 소속 지점으로 자동 할당
      let resolvedBranchId = input.branchId ?? undefined;
      if (!resolvedBranchId && resolvedTrainerId) {
        const [tr] = await db.select({ branchId: trainers.branchId }).from(trainers).where(eq(trainers.id, resolvedTrainerId)).limit(1);
        if (tr?.branchId) resolvedBranchId = tr.branchId;
      }

      const [row] = await db.insert(revenueEntries).values({
        ...input,
        ...trainerAutoFields,
        branchId: resolvedBranchId ?? null,
        createdBy: ctx.user!.id,
        updatedAt: new Date().toISOString(),
      }).returning();

      // 리드가 있으면 상태 registered로 업데이트
      if (input.leadId) {
        await db.update(leads).set({ status: "registered", updatedAt: new Date().toISOString() }).where(eq(leads.id, input.leadId));
      }

      // 리드에서 성별 + 유입경로(채널명) 조회
      let leadGender: string | undefined;
      let leadVisitRoute: string | undefined;
      if (input.leadId) {
        const [leadInfo] = await db.select({ gender: leads.gender, channelId: leads.channelId })
          .from(leads).where(eq(leads.id, input.leadId)).limit(1);
        if (leadInfo?.gender) leadGender = leadInfo.gender;
        if (leadInfo?.channelId) {
          const [ch] = await db.select({ name: channels.name }).from(channels).where(eq(channels.id, leadInfo.channelId)).limit(1);
          if (ch?.name) leadVisitRoute = ch.name;
        }
      }

      // PT 등록 시 회원 자동 생성
      if (input.type === "PT" && resolvedTrainerId && input.customerName && !input.memberId && input.subType !== "이전") {
        const now = new Date().toISOString();
        const [newMember] = await db.insert(members).values({
          trainerId: resolvedTrainerId,
          branchId: resolvedBranchId ?? null,
          name: input.customerName,
          phone: input.phone ?? undefined,
          gender: leadGender ?? undefined,
          visitRoute: leadVisitRoute ?? undefined,
          status: "active",
          grade: "basic",
          membershipStart: input.startDate ?? undefined,
          createdAt: now,
          updatedAt: now,
        }).returning({ id: members.id });
        if (newMember) {
          await db.update(revenueEntries).set({ memberId: newMember.id }).where(eq(revenueEntries.id, row.id));
          row.memberId = newMember.id;
          if (input.leadId) {
            await db.update(leads).set({ registeredMemberId: newMember.id }).where(eq(leads.id, input.leadId));
          }
        }
      }

      // 헬스 등록 시 회원 자동 생성
      if (input.type === "헬스" && input.customerName && !input.memberId && input.subType !== "이전") {
        const now = new Date().toISOString();
        let membershipEnd: string | undefined;
        if (input.startDate && input.duration) {
          const end = new Date(input.startDate);
          end.setMonth(end.getMonth() + input.duration);
          membershipEnd = end.toISOString().substring(0, 10);
        }
        const [newMember] = await db.insert(members).values({
          trainerId: resolvedTrainerId ?? null,
          branchId: resolvedBranchId ?? null,
          name: input.customerName,
          phone: input.phone ?? undefined,
          gender: leadGender ?? undefined,
          visitRoute: leadVisitRoute ?? undefined,
          status: "active",
          grade: "basic",
          membershipStart: input.startDate ?? undefined,
          membershipEnd: membershipEnd ?? undefined,
          createdAt: now,
          updatedAt: now,
        }).returning({ id: members.id });
        if (newMember) {
          await db.update(revenueEntries).set({ memberId: newMember.id }).where(eq(revenueEntries.id, row.id));
          row.memberId = newMember.id;
          if (input.leadId) {
            await db.update(leads).set({ registeredMemberId: newMember.id }).where(eq(leads.id, input.leadId));
          }
        }
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
      serviceHealthDuration: z.number().optional(),
      memberId: z.number().optional(),
      trainerId: z.number().optional(),
      consultantId: z.number().optional(),
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

      const existing = await db.select().from(revenueEntries).where(eq(revenueEntries.id, id)).limit(1);

      // 컨설턴트: 자신이 입력한 항목만 수정 가능
      if (ctx.user?.role === "consultant") {
        if (!existing[0] || existing[0].createdBy !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "본인이 입력한 매출만 수정할 수 있습니다." });
        }
      }

      // 트레이너가 새로 배정될 때 회원 자동 생성
      if (data.trainerId && !existing[0]?.trainerId && !existing[0]?.memberId && existing[0]?.customerName) {
        const now = new Date().toISOString();
        const [newMember] = await db.insert(members).values({
          trainerId: data.trainerId,
          name: existing[0].customerName,
          phone: existing[0].phone ?? undefined,
          status: "active",
          grade: "basic",
          createdAt: now,
          updatedAt: now,
        }).returning({ id: members.id });
        if (newMember) (data as any).memberId = newMember.id;
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
    .input(z.object({ year: z.number(), branchId: z.number().optional() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const rawEntries = await db.select().from(revenueEntries).where(like(revenueEntries.paymentDate, `${input.year}%`));
      const allEntries = input.branchId
        ? rawEntries.filter(r => r.branchId === input.branchId)
        : rawEntries;

      const monthly: Record<number, { month: number; total: number; paid: number; unpaid: number; pt: number; health: number; newSales: number; renewal: number; count: number }> = {};
      for (let m = 1; m <= 12; m++) {
        monthly[m] = { month: m, total: 0, paid: 0, unpaid: 0, pt: 0, health: 0, newSales: 0, renewal: 0, count: 0 };
      }

      for (const entry of allEntries) {
        const month = parseInt(entry.paymentDate.substring(5, 7));
        if (!monthly[month]) continue;
        if (entry.subType === "이전") continue;
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
    .input(z.object({ year: z.number(), month: z.number(), branchId: z.number().optional() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const prefix = `${input.year}-${String(input.month).padStart(2, "0")}`;
      const allRows = await db.select({
        entry: revenueEntries,
        trainerName: trainers.trainerName,
      })
        .from(revenueEntries)
        .leftJoin(trainers, eq(revenueEntries.trainerId, trainers.id))
        .where(like(revenueEntries.paymentDate, `${prefix}%`));

      const rows = input.branchId ? allRows.filter(r => r.entry.branchId === input.branchId) : allRows;

      const byTrainer: Record<number, { trainerId: number; trainerName: string; total: number; pt: number; health: number; newSales: number; renewal: number; count: number }> = {};
      for (const row of rows) {
        const tid = row.entry.trainerId ?? 0;
        if (!byTrainer[tid]) {
          byTrainer[tid] = { trainerId: tid, trainerName: row.trainerName ?? "미배정", total: 0, pt: 0, health: 0, newSales: 0, renewal: 0, count: 0 };
        }
        if (row.entry.subType === "이전") continue;
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
    .input(z.object({ year: z.number(), month: z.number(), branchId: z.number().optional() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const prefix = `${input.year}-${String(input.month).padStart(2, "0")}`;
      const allRows = await db.select({
        entry: revenueEntries,
        channelName: channels.name,
      })
        .from(revenueEntries)
        .leftJoin(channels, eq(revenueEntries.channelId, channels.id))
        .where(like(revenueEntries.paymentDate, `${prefix}%`));

      const rows = input.branchId ? allRows.filter(r => r.entry.branchId === input.branchId) : allRows;

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

  channelAnnual: protectedProcedure
    .input(z.object({ year: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const prefix = `${input.year}-`;
      const rows = await db.select({ entry: revenueEntries, channelName: channels.name })
        .from(revenueEntries)
        .leftJoin(channels, eq(revenueEntries.channelId, channels.id))
        .where(like(revenueEntries.paymentDate, `${prefix}%`));

      const allLeads = await db.select().from(leads);
      const channelList = await db.select().from(channels);

      // 채널별 월별 매출/건수/리드
      type MonthData = { revenue: number; count: number; leads: number; registered: number };
      const result: Record<string, { name: string; months: Record<number, MonthData> }> = {};

      for (const ch of channelList) {
        result[ch.name] = { name: ch.name, months: {} };
        for (let m = 1; m <= 12; m++) result[ch.name].months[m] = { revenue: 0, count: 0, leads: 0, registered: 0 };
      }

      for (const row of rows) {
        const chName = row.channelName ?? "채널 미상";
        const m = parseInt(row.entry.paymentDate?.substring(5, 7) ?? "0");
        if (!m) continue;
        if (!result[chName]) { result[chName] = { name: chName, months: {} }; for (let i = 1; i <= 12; i++) result[chName].months[i] = { revenue: 0, count: 0, leads: 0, registered: 0 }; }
        result[chName].months[m].revenue += row.entry.paidAmount;
        result[chName].months[m].count += 1;
      }

      // 리드 통계
      for (const lead of allLeads) {
        const d = lead.consultationDate ?? "";
        if (!d.startsWith(prefix)) continue;
        const m = parseInt(d.substring(5, 7));
        const ch = channelList.find(c => c.id === lead.channelId);
        const chName = ch?.name ?? "채널 미상";
        if (!result[chName]) { result[chName] = { name: chName, months: {} }; for (let i = 1; i <= 12; i++) result[chName].months[i] = { revenue: 0, count: 0, leads: 0, registered: 0 }; }
        result[chName].months[m].leads += 1;
        if (lead.status === "registered") result[chName].months[m].registered += 1;
      }

      // 연간 합계
      const channels_out = Object.values(result).filter(ch => {
        return Object.values(ch.months).some(m => m.revenue > 0 || m.leads > 0);
      }).map(ch => ({
        name: ch.name,
        months: ch.months,
        totalRevenue: Object.values(ch.months).reduce((s, m) => s + m.revenue, 0),
        totalLeads: Object.values(ch.months).reduce((s, m) => s + m.leads, 0),
        totalRegistered: Object.values(ch.months).reduce((s, m) => s + m.registered, 0),
      })).sort((a, b) => b.totalRevenue - a.totalRevenue);

      // 월별 합계
      const monthTotals: Record<number, { revenue: number; leads: number; registered: number }> = {};
      for (let m = 1; m <= 12; m++) {
        monthTotals[m] = { revenue: 0, leads: 0, registered: 0 };
        for (const ch of channels_out) {
          monthTotals[m].revenue += ch.months[m].revenue;
          monthTotals[m].leads += ch.months[m].leads;
          monthTotals[m].registered += ch.months[m].registered;
        }
      }

      return { channels: channels_out, monthTotals };
    }),

  byLead: protectedProcedure
    .input(z.object({ leadId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const rows = await db.select({ entry: revenueEntries })
        .from(revenueEntries)
        .where(eq(revenueEntries.leadId, input.leadId))
        .orderBy(desc(revenueEntries.paymentDate))
        .limit(1);
      return rows[0]?.entry ?? null;
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

  // 이달 PT 프로그램별 통계 (이벤트피티 포함)
  programStats: protectedProcedure
    .input(z.object({ year: z.number(), month: z.number(), branchId: z.number().optional() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const prefix = `${input.year}-${String(input.month).padStart(2, "0")}`;
      const allEntries = await db.select().from(revenueEntries).where(like(revenueEntries.paymentDate, `${prefix}%`));
      const entries = allEntries.filter(e => e.type === "PT" && e.subType !== "이전"
        && (!input.branchId || e.branchId === input.branchId));

      const byProgram: Record<string, { name: string; count: number; revenue: number; newCount: number; renewalCount: number }> = {};
      for (const e of entries) {
        const key = e.programDetail ?? "기타PT";
        if (!byProgram[key]) byProgram[key] = { name: key, count: 0, revenue: 0, newCount: 0, renewalCount: 0 };
        byProgram[key].count++;
        byProgram[key].revenue += e.paidAmount;
        if (e.subType === "신규") byProgram[key].newCount++;
        if (e.subType === "재등록") byProgram[key].renewalCount++;
      }
      return Object.values(byProgram).sort((a, b) => b.revenue - a.revenue);
    }),

  // 연간 월별 PT 프로그램별 추이
  programAnnual: protectedProcedure
    .input(z.object({ year: z.number(), branchId: z.number().optional() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const allEntries = await db.select().from(revenueEntries)
        .where(like(revenueEntries.paymentDate, `${input.year}%`));
      const entries = allEntries.filter(e => e.type === "PT" && e.subType !== "이전"
        && (!input.branchId || e.branchId === input.branchId));

      const programs = new Set<string>();
      const monthly: Record<number, Record<string, { count: number; revenue: number }>> = {};
      for (let m = 1; m <= 12; m++) monthly[m] = {};

      for (const e of entries) {
        const m = parseInt(e.paymentDate.substring(5, 7));
        const prog = e.programDetail ?? "기타PT";
        programs.add(prog);
        if (!monthly[m][prog]) monthly[m][prog] = { count: 0, revenue: 0 };
        monthly[m][prog].count++;
        monthly[m][prog].revenue += e.paidAmount;
      }

      const programList = Array.from(programs);
      const monthlyData = Array.from({ length: 12 }, (_, i) => {
        const m = i + 1;
        const row: Record<string, any> = { month: m, label: `${m}월` };
        for (const prog of programList) {
          row[prog + "_count"] = monthly[m][prog]?.count ?? 0;
          row[prog + "_revenue"] = monthly[m][prog]?.revenue ?? 0;
        }
        return row;
      });

      return { programs: programList, monthlyData };
    }),
});

// ─── Expense Entries (지출 장부) ──────────────────────────────────────────────
const expenseRouter = t.router({
  list: protectedProcedure
    .input(z.object({ year: z.number().optional(), month: z.number().optional(), category: z.string().optional(), branchId: z.number().optional() }).optional())
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
      if (input?.branchId) result = result.filter(r => r.entry.branchId === input.branchId);

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
    .input(z.object({ year: z.number(), month: z.number(), branchId: z.number().optional() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const prefix = `${input.year}-${String(input.month).padStart(2, "0")}`;
      let rows = await db.select().from(expenseEntries).where(like(expenseEntries.expenseDate, `${prefix}%`));
      if (input.branchId) rows = rows.filter(r => r.branchId === input.branchId);

      const byCategory: Record<string, number> = {};
      for (const row of rows) {
        byCategory[row.category] = (byCategory[row.category] ?? 0) + row.amount;
      }

      return Object.entries(byCategory).map(([category, total]) => ({ category, total })).sort((a, b) => b.total - a.total);
    }),
});

// ─── KPI Dashboard ───────────────────────────────────────────────────────────
const kpiRouter = t.router({
  financialDetail: protectedProcedure
    .input(z.object({ year: z.number(), branchId: z.number().optional() }))
    .query(async ({ ctx, input }) => {
      if (ctx.user?.role === "consultant") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [allRevenueRaw2, allExpensesRaw2] = await Promise.all([
        db.select().from(revenueEntries),
        db.select().from(expenseEntries),
      ]);

      const allRevenue = input.branchId
        ? allRevenueRaw2.filter(r => r.branchId === input.branchId)
        : allRevenueRaw2;
      const allExpenses = input.branchId
        ? allExpensesRaw2.filter(e => e.branchId === input.branchId)
        : allExpensesRaw2;

      const computeMonth = (m: number) => {
        const prefix = `${input.year}-${String(m).padStart(2, "0")}`;
        const rev = allRevenue.filter(r => r.paymentDate.startsWith(prefix) && r.subType !== "이전");
        const exp = allExpenses.filter(e => e.expenseDate.startsWith(prefix));

        const ptNew      = rev.filter(r => r.type === "PT"    && r.subType === "신규").reduce((s, r) => s + r.paidAmount, 0);
        const ptRenewal  = rev.filter(r => r.type === "PT"    && r.subType === "재등록").reduce((s, r) => s + r.paidAmount, 0);
        const hlNew      = rev.filter(r => r.type === "헬스"  && r.subType === "신규").reduce((s, r) => s + r.paidAmount, 0);
        const hlRenewal  = rev.filter(r => r.type === "헬스"  && r.subType === "재등록").reduce((s, r) => s + r.paidAmount, 0);
        const other      = rev.filter(r => r.type !== "PT"    && r.type !== "헬스").reduce((s, r) => s + r.paidAmount, 0);
        const refund     = rev.reduce((s, r) => s + r.refundAmount, 0);

        const gs  = rev.reduce((s, r) => s + r.paidAmount, 0);
        const vat = Math.round(gs / 11); // 부가세 (GS에 포함된 10% VAT)
        const ns  = gs - vat;

        const fc  = exp.filter(e => e.category === "고정관리비").reduce((s, e) => s + e.amount, 0);
        const vc  = exp.filter(e => e.category === "인건비" || e.category === "유동관리비").reduce((s, e) => s + e.amount, 0);
        const cac = exp.filter(e => e.subCategory === "마케팅비").reduce((s, e) => s + e.amount, 0);
        const totalExp = exp.reduce((s, e) => s + e.amount, 0);

        const gp  = ns - vc;
        const op  = gp - fc;
        const np  = op - cac;

        const ptCnt = rev.filter(r => r.type === "PT").length;
        const hlCnt = rev.filter(r => r.type === "헬스").length;

        const card     = rev.filter(r => r.paymentMethod === "카드").reduce((s, r) => s + r.paidAmount, 0);
        const transfer = rev.filter(r => r.paymentMethod === "이체" || r.paymentMethod === "계좌이체").reduce((s, r) => s + r.paidAmount, 0);
        const cash     = rev.filter(r => r.paymentMethod === "현금" || r.paymentMethod === "현금영수증").reduce((s, r) => s + r.paidAmount, 0);
        const local    = rev.filter(r => r.paymentMethod === "지역화폐").reduce((s, r) => s + r.paidAmount, 0);

        return {
          month: m, gs, ns, vat, refund,
          ptNew, ptRenewal, hlNew, hlRenewal, other,
          gp, op, np, totalExp,
          opm: ns > 0 ? Math.round((op / ns) * 1000) / 10 : 0,
          npm: ns > 0 ? Math.round((np / ns) * 1000) / 10 : 0,
          fc, vc, cac,
          ptCnt, hlCnt, totalCnt: ptCnt + hlCnt,
          ptUnit: ptCnt > 0 ? Math.round((ptNew + ptRenewal) / ptCnt) : 0,
          hlUnit: hlCnt > 0 ? Math.round((hlNew + hlRenewal) / hlCnt) : 0,
          card, transfer, cash, local,
        };
      };

      const monthlyData = Array.from({ length: 12 }, (_, i) => computeMonth(i + 1));

      // 연간 합계
      const total = monthlyData.reduce((acc, m) => ({
        gs: acc.gs + m.gs, ns: acc.ns + m.ns, vat: acc.vat + m.vat, refund: acc.refund + m.refund,
        ptNew: acc.ptNew + m.ptNew, ptRenewal: acc.ptRenewal + m.ptRenewal,
        hlNew: acc.hlNew + m.hlNew, hlRenewal: acc.hlRenewal + m.hlRenewal, other: acc.other + m.other,
        gp: acc.gp + m.gp, op: acc.op + m.op, np: acc.np + m.np, totalExp: acc.totalExp + m.totalExp,
        fc: acc.fc + m.fc, vc: acc.vc + m.vc, cac: acc.cac + m.cac,
        ptCnt: acc.ptCnt + m.ptCnt, hlCnt: acc.hlCnt + m.hlCnt, totalCnt: acc.totalCnt + m.totalCnt,
        card: acc.card + m.card, transfer: acc.transfer + m.transfer, cash: acc.cash + m.cash, local: acc.local + m.local,
      }), { gs:0,ns:0,vat:0,refund:0,ptNew:0,ptRenewal:0,hlNew:0,hlRenewal:0,other:0,gp:0,op:0,np:0,totalExp:0,fc:0,vc:0,cac:0,ptCnt:0,hlCnt:0,totalCnt:0,card:0,transfer:0,cash:0,local:0 });

      return { monthlyData, total, year: input.year };
    }),

  overview: protectedProcedure
    .input(z.object({ year: z.number(), month: z.number(), branchId: z.number().optional() }))
    .query(async ({ ctx, input }) => {
      if (ctx.user?.role === "consultant") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const today = new Date().toISOString().substring(0, 10);
      const prefix = `${input.year}-${String(input.month).padStart(2, "0")}`;

      // 지점 필터: 명시적 branchId 매칭 + branchId 없는 항목은 트레이너 소속 지점으로 판단
      const [allRevenueRaw, allExpensesRaw, allLeads, allTargets] = await Promise.all([
        db.select().from(revenueEntries),
        db.select().from(expenseEntries),
        db.select().from(leads),
        db.select().from(revenueTargets),
      ]);

      const allRevenue = input.branchId
        ? allRevenueRaw.filter(r => r.branchId === input.branchId)
        : allRevenueRaw;

      const allExpenses = input.branchId
        ? allExpensesRaw.filter(e => e.branchId === input.branchId)
        : allExpensesRaw;

      // 오늘 매출 (이전 제외)
      const todayRevenue = allRevenue.filter(r => r.paymentDate === today && r.subType !== "이전").reduce((s, r) => s + r.paidAmount, 0);

      // 이번달 매출 (이전 제외)
      const monthRevenue = allRevenue.filter(r => r.paymentDate.startsWith(prefix) && r.subType !== "이전");
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
      const prevMonthTotal = allRevenue.filter(r => r.paymentDate.startsWith(prevPrefix) && r.subType !== "이전").reduce((s, r) => s + r.paidAmount, 0);
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

  trainerMatch: protectedProcedure
    .input(z.object({ memberId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // ── 회원 기본 정보
      const [member] = await db.select().from(members).where(eq(members.id, input.memberId));
      if (!member) throw new TRPCError({ code: "NOT_FOUND" });

      // ── 연결된 리드 (상담 내용, 운동목적, 운동가능시간)
      const [lead] = await db.select({
        consultationNote: leads.consultationNote,
        memo: leads.memo,
        exercisePurpose: leads.exercisePurpose,
        interestType: leads.interestType,
      }).from(leads).where(eq(leads.registeredMemberId, input.memberId)).limit(1);

      // ── 나이 계산
      const age = member.birthDate
        ? Math.floor((Date.now() - new Date(member.birthDate).getTime()) / (1000 * 60 * 60 * 24 * 365.25))
        : null;

      // ── 트레이너 목록
      const trainerList = await db.select({ id: trainers.id, trainerName: trainers.trainerName })
        .from(trainers).orderBy(trainers.trainerName);

      // ── 트레이너별 통계 수집
      const now = new Date();
      const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

      const trainerStats = await Promise.all(trainerList.map(async (trainer) => {
        const tid = trainer.id;

        const [memberCountRes, pkgRows, monthLogsRes, allLogsRes] = await Promise.all([
          db.select({ c: sql<number>`COUNT(*)` }).from(members).where(and(eq(members.trainerId, tid), eq(members.status, "active"))),
          db.select({ memberId: ptPackages.memberId, count: sql<number>`COUNT(*)`, packageName: ptPackages.packageName })
            .from(ptPackages).where(eq(ptPackages.trainerId, tid)).groupBy(ptPackages.memberId, ptPackages.packageName),
          db.select({ c: sql<number>`COUNT(*)` }).from(ptSessionLogs).where(and(
            eq(ptSessionLogs.trainerId, tid),
            sql`${ptSessionLogs.sessionDate} >= ${monthStart}`,
          )),
          db.select({ sessionDate: ptSessionLogs.sessionDate }).from(ptSessionLogs)
            .where(eq(ptSessionLogs.trainerId, tid)).orderBy(desc(ptSessionLogs.sessionDate)).limit(60),
        ]);

        // 재등록률
        const reregMemberCount = pkgRows.filter(r => Number(r.count) > 1).length;
        const totalMemberCount = new Set(pkgRows.map(r => r.memberId)).size;
        const reregRate = totalMemberCount > 0 ? Math.round((reregMemberCount / totalMemberCount) * 100) : 0;

        // 주요 프로그램 (전문 분야)
        const programCounts: Record<string, number> = {};
        for (const p of pkgRows) {
          const name = p.packageName ?? "기타";
          programCounts[name] = (programCounts[name] ?? 0) + 1;
        }
        const topPrograms = Object.entries(programCounts).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([n]) => n);

        // 활동 요일 패턴 (최근 세션)
        const dayCounts: Record<string, number> = { 월: 0, 화: 0, 수: 0, 목: 0, 금: 0, 토: 0, 일: 0 };
        const dayNames = ["일", "월", "화", "수", "목", "금", "토"];
        for (const log of allLogsRes) {
          const day = dayNames[new Date(log.sessionDate).getDay()];
          dayCounts[day]++;
        }
        const activeDays = Object.entries(dayCounts).filter(([, c]) => c > 0).sort((a, b) => b[1] - a[1]).map(([d]) => d).join("");

        return {
          trainerName: trainer.trainerName,
          activeMembers: Number(memberCountRes[0]?.c ?? 0),
          monthSessions: Number(monthLogsRes[0]?.c ?? 0),
          reregRate,
          topPrograms,
          activeDays,
        };
      }));

      // ── AI 프롬프트 구성
      const structuredInfo = [
        `이름: ${member.name}`,
        age ? `나이: ${age}세` : null,
        member.gender ? `성별: ${member.gender}` : null,
        lead?.interestType ? `관심 프로그램: ${lead.interestType}` : null,
        lead?.exercisePurpose ? `운동 목적: ${lead.exercisePurpose}` : null,
        member.profileNote ? `회원 특이사항: ${member.profileNote}` : null,
      ].filter(Boolean).join("\n");

      // 상담 내용·등록 진행 내용은 별도로 강조 (키워드가 많이 담겨있음)
      const freeTextSection = [
        lead?.consultationNote ? `[상담 내용 원문]\n${lead.consultationNote}` : null,
        lead?.memo ? `[등록 진행 내용 원문]\n${lead.memo}` : null,
      ].filter(Boolean).join("\n\n");

      const trainerContext = trainerStats.map(t =>
        `[${t.trainerName}]\n- 현재 담당 회원: ${t.activeMembers}명\n- 이번달 수업: ${t.monthSessions}회\n- 재등록률: ${t.reregRate}%\n- 주요 프로그램: ${t.topPrograms.join(", ") || "정보없음"}\n- 주요 활동 요일: ${t.activeDays || "정보없음"}`
      ).join("\n\n");

      const prompt = `당신은 피트니스 센터 트레이너 매칭 전문 AI입니다.

## 회원 기본 정보
${structuredInfo}

## 상담 기록 (운동 가능 시간·성향·상황 등 핵심 키워드 포함)
${freeTextSection || "상담 기록 없음"}

## 트레이너 현황
${trainerContext}

---

### 분석 지침
상담 기록 원문에는 회원이 말한 다음 정보가 섞여 있을 수 있습니다. 반드시 원문을 꼼꼼히 읽고 키워드를 추출하세요:
- 운동 가능 요일 (예: 평일만, 주말 포함, 월·수·금 등)
- 운동 가능 시간대 (예: 오전 10시 이후, 저녁 7시 이후, 점심 시간 등)
- 회원 성향/성격 (예: 동기부여 필요, 혼자 잘함, 꼼꼼한 설명 선호 등)
- 건강 상태/주의사항 (예: 허리 통증, 무릎 불편, 임산부 등)
- 운동 경험 수준 (초보/중급/고급)
- 특별 요청사항

### 출력 형식
**[STEP 1: 회원 분석 요약]**
상담 기록에서 추출한 핵심 키워드를 3~5줄로 정리

**[STEP 2: 트레이너 매칭 추천]**
1순위~3순위 트레이너를 추천하고, 각각:
- **N순위. 트레이너명** - 추천 이유 (상담 내용 키워드와 연결하여 설명)
- 예상 시너지
- 주의사항 (있다면)

**[종합 의견]** 1~2문장`;

      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        // Fallback: 재등록률 기반 단순 추천
        const sorted = [...trainerStats].sort((a, b) => b.reregRate - a.reregRate);
        const fallback = sorted.slice(0, 3).map((t, i) =>
          `**${i + 1}. ${t.trainerName}** - 재등록률 ${t.reregRate}%, 담당 ${t.activeMembers}명`
        ).join("\n");
        return { analysis: `## AI 매칭 추천 (기본 분석)\n\n${fallback}\n\n*ANTHROPIC_API_KEY 미설정으로 기본 분석이 제공됩니다.*`, isAI: false, trainerStats };
      }

      try {
        const client = new Anthropic({ apiKey });
        const message = await client.messages.create({
          model: "claude-sonnet-4-6",
          max_tokens: 1024,
          messages: [{ role: "user", content: prompt }],
        });
        const text = message.content[0].type === "text" ? message.content[0].text : "";
        return { analysis: text, isAI: true, trainerStats };
      } catch {
        const sorted = [...trainerStats].sort((a, b) => b.reregRate - a.reregRate);
        const fallback = sorted.slice(0, 3).map((t, i) =>
          `**${i + 1}. ${t.trainerName}** - 재등록률 ${t.reregRate}%, 담당 ${t.activeMembers}명`
        ).join("\n");
        return { analysis: `## AI 매칭 추천 (기본 분석)\n\n${fallback}`, isAI: false, trainerStats };
      }
    }),

  generateMemberReport: protectedProcedure
    .input(z.object({ memberId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [member] = await db.select().from(members).where(eq(members.id, input.memberId));
      if (!member) throw new TRPCError({ code: "NOT_FOUND" });

      const [health] = await db.select().from(parQ).where(eq(parQ.memberId, input.memberId));
      const logs = await db.select().from(ptSessionLogs)
        .where(eq(ptSessionLogs.memberId, input.memberId))
        .orderBy(desc(ptSessionLogs.sessionDate)).limit(60);
      const checks = await db.select().from(attendanceChecks)
        .where(eq(attendanceChecks.memberId, input.memberId))
        .orderBy(desc(attendanceChecks.checkDate)).limit(60);

      // ── 트레이닝 통계
      const bodyPartCounts: Record<string, number> = {};
      const goalSet: string[] = [];
      const recentFeedback: string[] = [];
      for (const log of logs) {
        if (log.bodyPart) log.bodyPart.split(",").map(p => p.trim()).filter(Boolean).forEach(p => { bodyPartCounts[p] = (bodyPartCounts[p] || 0) + 1; });
        if (log.goal && !goalSet.includes(log.goal)) goalSet.push(log.goal);
        if (log.feedback && recentFeedback.length < 3) recentFeedback.push(log.feedback);
      }
      const topBodyParts = Object.entries(bodyPartCounts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([p, c]) => `${p}(${c}회)`);
      const condScores = checks.filter(c => c.conditionScore != null).map(c => c.conditionScore!);
      const avgCondition = condScores.length > 0 ? Math.round(condScores.reduce((a, b) => a + b, 0) / condScores.length * 10) / 10 : null;
      const painLevels = checks.filter(c => c.painLevel != null).map(c => c.painLevel!);
      const avgPain = painLevels.length > 0 ? Math.round(painLevels.reduce((a, b) => a + b, 0) / painLevels.length * 10) / 10 : null;

      // ── 생활습관 위험도 계산 (A/B/C/D 문자 저장)
      const DIET_TEXT = [
        "하루 식사 시간이 일정하지 않거나 끼니를 자주 거른다",
        "하루 단백질 섭취량이 부족하거나 식단 구성이 한쪽으로 치우친다",
        "스트레스나 감정 변화로 인해 폭식 또는 과식을 경험한다",
        "저녁 9시 이후 야식 또는 고칼로리 간식을 자주 섭취한다",
      ];
      const ALCOHOL_TEXT = [
        "주 3회 이상 음주하거나 1회 음주량이 평균 3잔 이상이다",
        "한 번 술을 마시면 마무리가 잘 안 되어 과음하는 경우가 있다",
        "스트레스 해소를 술에 의존하는 편이다",
        "회식·약속 등으로 인해 운동 다음 날 컨디션이 떨어지는 경우가 잦다",
      ];
      const SLEEP_TEXT = [
        "밤에 자주 깨거나(2회 이상) 수면 중단이 반복된다",
        "아침에 일어나도 개운하지 않고 지속적으로 피곤하다",
        "잠드는 데 30분 이상 걸리거나 누워도 쉽게 잠들지 못한다",
        "수면 시간이 일정하지 않거나 6시간 미만으로 자는 날이 많다",
      ];
      const ACTIVITY_TEXT = [
        "하루 활동량(걸음 수)이 5,000보 미만인 날이 많다",
        "하루 중 앉아 있는 시간이 6시간 이상으로 길다",
        "주 2회 이상 규칙적인 운동을 하지 않는다",
        "계단 오르기 등 기본 활동에서도 숨이 차거나 피로를 느낀다",
      ];
      const mapLetters = (raw: string | null | undefined, texts: string[]) => {
        const letters = (raw ?? "").split(",").filter(Boolean);
        return letters.map(l => texts[["A","B","C","D"].indexOf(l)]).filter(Boolean);
      };
      const riskLevel = (count: number): "normal"|"caution"|"warning"|"critical" =>
        count === 0 ? "normal" : count === 1 ? "caution" : count === 2 ? "warning" : "critical";
      const riskKo = (level: string) => ({ normal:"양호", caution:"건강관리 필요", warning:"빠른 건강관리 필요", critical:"건강 필수 심각 수준" }[level] ?? level);

      const dietItems = mapLetters(health?.dietIssues, DIET_TEXT);
      const alcoholItems = mapLetters(health?.alcoholIssues, ALCOHOL_TEXT);
      const sleepItems = mapLetters(health?.sleepIssues, SLEEP_TEXT);
      const activityItems = mapLetters(health?.activityIssues, ACTIVITY_TEXT);

      // ── BMI 계산
      let bmi: string | undefined;
      if (health?.height && health?.weight) {
        const h = parseFloat(health.height) / 100;
        const w = parseFloat(health.weight);
        if (h > 0 && w > 0) bmi = (w / (h * h)).toFixed(1);
      }

      // ── 나이 계산
      let age: number | undefined;
      if (member.birthDate) {
        const bd = new Date(member.birthDate);
        const today = new Date();
        age = today.getFullYear() - bd.getFullYear() - (today < new Date(today.getFullYear(), bd.getMonth(), bd.getDate()) ? 1 : 0);
      }

      const goals = [health?.goal1, health?.goal2, health?.goal3].filter(Boolean) as string[];

      // ── ReportData 구조 생성
      const reportData: ReportData = {
        generatedAt: new Date().toLocaleDateString("ko-KR"),
        isAI: false,
        member: { name: member.name, age, gender: member.gender ?? undefined },
        health: {
          height: health?.height ?? undefined,
          weight: health?.weight ?? undefined,
          bmi,
          occupation: health?.occupation ?? undefined,
          workEnvironment: health?.workEnvironment ?? undefined,
          exerciseExperience: health?.exerciseExperience ?? undefined,
          goals,
          systolicBp: health?.systolicBp ?? undefined,
          diastolicBp: health?.diastolicBp ?? undefined,
          waistCircumference: health?.waistCircumference ?? undefined,
          totalCholesterol: health?.totalCholesterol ?? undefined,
          hdlCholesterol: health?.hdlCholesterol ?? undefined,
          ldlCholesterol: health?.ldlCholesterol ?? undefined,
          triglycerides: health?.triglycerides ?? undefined,
          fastingBloodSugar: health?.fastingBloodSugar ?? undefined,
          postMealBloodSugar: health?.postMealBloodSugar ?? undefined,
          hba1c: health?.hba1c ?? undefined,
          boneDensity: health?.boneDensity ?? undefined,
          chronicDiseases: health?.chronicDiseases ?? undefined,
          musculoskeletalIssues: health?.musculoskeletalIssues ?? undefined,
          posturalIssues: health?.posturalIssues ?? undefined,
        },
        lifestyle: {
          diet: { items: dietItems, count: dietItems.length, riskLevel: riskLevel(dietItems.length), riskKo: riskKo(riskLevel(dietItems.length)) },
          alcohol: { items: alcoholItems, count: alcoholItems.length, riskLevel: riskLevel(alcoholItems.length), riskKo: riskKo(riskLevel(alcoholItems.length)) },
          sleep: { items: sleepItems, count: sleepItems.length, riskLevel: riskLevel(sleepItems.length), riskKo: riskKo(riskLevel(sleepItems.length)) },
          activity: { items: activityItems, count: activityItems.length, riskLevel: riskLevel(activityItems.length), riskKo: riskKo(riskLevel(activityItems.length)) },
        },
        training: { totalSessions: logs.length, topBodyParts, goals: goalSet.slice(0, 3), avgCondition, avgPain, checksCount: checks.length },
      };

      // ── AI 프롬프트 (위험도 포함)
      const lifestyleContext = `
생활습관 위험도 분석:
- 식단 (${dietItems.length}/4): ${riskKo(riskLevel(dietItems.length))}${dietItems.length > 0 ? "\n  해당 항목: " + dietItems.join(" / ") : ""}
- 음주 (${alcoholItems.length}/4): ${riskKo(riskLevel(alcoholItems.length))}${alcoholItems.length > 0 ? "\n  해당 항목: " + alcoholItems.join(" / ") : ""}
- 수면 (${sleepItems.length}/4): ${riskKo(riskLevel(sleepItems.length))}${sleepItems.length > 0 ? "\n  해당 항목: " + sleepItems.join(" / ") : ""}
- 활동 (${activityItems.length}/4): ${riskKo(riskLevel(activityItems.length))}${activityItems.length > 0 ? "\n  해당 항목: " + activityItems.join(" / ") : ""}`;

      const dataCtx = `회원명: ${member.name}${age ? ` (${age}세)` : ""}
${health ? `신체: 키 ${health.height || "-"}cm / 체중 ${health.weight || "-"}kg${bmi ? ` / BMI ${bmi}` : ""}
직업: ${health.occupation || "-"} / 근무환경: ${health.workEnvironment || "-"}
운동경험: ${health.exerciseExperience || "-"}
운동 목적: ${goals.join(", ") || "미기재"}
병원 진단: ${health.chronicDiseases || "없음"}
근골격계: ${health.musculoskeletalIssues || "없음"}

건강 수치:
혈압: ${health.systolicBp || "미입력"} / 공복혈당: ${health.fastingBloodSugar || "미입력"} / HbA1c: ${health.hba1c || "미입력"}` : "PAR-Q 미입력"}

${lifestyleContext}

트레이닝: 총 ${logs.length}회 수업 / 주요 부위: ${topBodyParts.join(", ") || "없음"}
컨디션 평균: ${avgCondition != null ? `${avgCondition}/10` : "없음"} / 통증 평균: ${avgPain != null ? `${avgPain}/10` : "없음"}`;

      const prompt = `당신은 개인 트레이닝 전문 건강 상담사입니다. 회원 건강 보고서를 한국어로 작성해주세요.

${dataCtx}

[위험도 기준: 0항목=양호, 1항목=건강관리 필요, 2항목=빠른 건강관리 필요, 3-4항목=건강 필수 심각 수준]

각 섹션을 2-4문장으로 작성하되, 위험도 수준을 명시하고 해당 항목이 운동과 건강에 미치는 영향을 구체적으로 설명하세요:

**1. 건강 상태 요약**
현재 건강 수치와 기저질환 상태. 특이 수치가 있으면 그 의미를 설명하고, 없으면 양호하다고 언급.

**2. 생활습관 평가**
각 카테고리(식단/음주/수면/활동)별 위험도와 구체적 개선 필요 내용. 각 위험도가 운동 효과에 미치는 영향 포함.

**3. 트레이닝 패턴 분석**
수업 횟수, 주요 운동 부위 분포의 강점과 보완점. 컨디션/통증 데이터 해석 포함.

**4. 맞춤 권장사항**
이 회원의 위험도와 목표에 맞는 구체적 개선 사항 3가지. 실행 가능한 액션으로 작성.`;

      // ── DB 저장 및 토큰 생성
      const token = Math.random().toString(36).slice(2) + Date.now().toString(36);

      const apiKey = process.env.ANTHROPIC_API_KEY;
      let aiText = buildFallbackMemberReport(member.name, reportData.lifestyle, reportData.training);
      let isAI = false;

      if (apiKey) {
        try {
          const client = new Anthropic({ apiKey });
          const message = await client.messages.create({
            model: "claude-sonnet-4-6",
            max_tokens: 2000,
            messages: [{ role: "user", content: prompt }],
          });
          aiText = message.content[0].type === "text" ? message.content[0].text : aiText;
          isAI = true;
        } catch { /* fallback */ }
      }

      reportData.isAI = isAI;

      // 기존 보고서 삭제 후 새로 저장
      await db.delete(healthReports).where(eq(healthReports.memberId, input.memberId));
      await db.insert(healthReports).values({
        token,
        memberId: input.memberId,
        generatedBy: ctx.user!.id,
        reportData: JSON.stringify(reportData),
        aiText,
        isAI: isAI ? 1 : 0,
      });

      const reportUrl = `/api/health-report/${token}`;
      const stats = { totalSessions: logs.length, topBodyParts, goals: goalSet.slice(0, 3), avgCondition, avgPain, checksCount: checks.length };
      return { report: aiText, isAI, stats, token, reportUrl };
    }),

  getPTReports: protectedProcedure
    .input(z.object({ packageId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(ptReports)
        .where(eq(ptReports.packageId, input.packageId))
        .orderBy(ptReports.reportIndex);
    }),

  generatePTProgressReport: protectedProcedure
    .input(z.object({
      packageId: z.number(),
      memberId: z.number(),
      milestoneSession: z.number(),
      fromSession: z.number(),
      reportIndex: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [pkg] = await db.select().from(ptPackages).where(eq(ptPackages.id, input.packageId));
      if (!pkg) throw new TRPCError({ code: "NOT_FOUND" });

      const [member] = await db.select().from(members).where(eq(members.id, input.memberId));
      if (!member) throw new TRPCError({ code: "NOT_FOUND" });

      // 담당 트레이너명
      let trainerName: string | undefined;
      if (pkg.trainerId) {
        const [tr] = await db.select().from(trainers).where(eq(trainers.id, pkg.trainerId));
        trainerName = tr?.trainerName ?? undefined;
      }

      // 이 패키지의 세션 로그 전체 (날짜순)
      const allLogs = await db.select().from(ptSessionLogs)
        .where(eq(ptSessionLogs.packageId, input.packageId))
        .orderBy(ptSessionLogs.sessionDate);

      // 이번 구간 로그 (fromSession~milestoneSession, 0-indexed slice)
      const periodLogs = allLogs.slice(input.fromSession - 1, input.milestoneSession);
      // 이전 구간 로그 (있을 경우)
      const prevLogs = input.fromSession > 1 ? allLogs.slice(0, input.fromSession - 1) : [];

      const fromDate = periodLogs[0]?.sessionDate;
      const toDate = periodLogs[periodLogs.length - 1]?.sessionDate;

      // 날짜 범위로 컨디션 체크 가져오기
      const periodChecks = fromDate && toDate
        ? await db.select().from(attendanceChecks)
            .where(and(
              eq(attendanceChecks.memberId, input.memberId),
              gte(attendanceChecks.checkDate, fromDate),
              lte(attendanceChecks.checkDate, toDate),
            ))
        : [];

      const prevChecks = prevLogs.length > 0 && prevLogs[0].sessionDate && prevLogs[prevLogs.length - 1].sessionDate
        ? await db.select().from(attendanceChecks)
            .where(and(
              eq(attendanceChecks.memberId, input.memberId),
              gte(attendanceChecks.checkDate, prevLogs[0].sessionDate!),
              lte(attendanceChecks.checkDate, prevLogs[prevLogs.length - 1].sessionDate!),
            ))
        : [];

      // 통계 계산 helper
      const avg = (arr: number[]) => arr.length > 0 ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length * 10) / 10 : null;

      const calcStats = (logs: typeof allLogs, checks: typeof periodChecks) => ({
        sessionCount: logs.length,
        avgCondition: avg(checks.filter(c => c.conditionScore != null).map(c => c.conditionScore!)),
        avgSleep: avg(checks.filter(c => c.sleepHours != null).map(c => parseFloat(c.sleepHours ?? "0")).filter(n => n > 0)),
        avgPain: avg(checks.filter(c => c.painLevel != null).map(c => c.painLevel!)),
        attendanceRate: logs.length > 0 ? Math.round(logs.length / (input.milestoneSession - input.fromSession + 1) * 100) : 0,
      });

      const periodSt = calcStats(periodLogs, periodChecks);
      const prevSt = prevLogs.length > 0 ? calcStats(prevLogs, prevChecks) : null;

      // 운동 종목별 집계
      const exerciseMap: Record<string, { entries: { weight: number; reps: number; sets: number; date: string }[] }> = {};
      for (const log of periodLogs) {
        if (!log.exercisesJson) continue;
        try {
          const exs: Array<{ name: string; sets: Array<{ weight: string; reps: string }> }> = JSON.parse(log.exercisesJson);
          for (const ex of exs) {
            if (!ex.name) continue;
            const validSets = ex.sets.filter(s => s.weight && s.reps);
            if (validSets.length === 0) continue;
            const maxW = Math.max(...validSets.map(s => parseFloat(s.weight) || 0));
            const avgReps = Math.round(validSets.map(s => parseInt(s.reps) || 0).reduce((a, b) => a + b, 0) / validSets.length);
            if (!exerciseMap[ex.name]) exerciseMap[ex.name] = { entries: [] };
            exerciseMap[ex.name].entries.push({ weight: maxW, reps: avgReps, sets: validSets.length, date: log.sessionDate });
          }
        } catch { /* skip */ }
      }

      const exercises: ExerciseStat[] = Object.entries(exerciseMap)
        .map(([name, { entries }]) => {
          const sorted = entries.sort((a, b) => a.date.localeCompare(b.date));
          const first = sorted[0] ?? null;
          const last = sorted[sorted.length - 1] ?? null;
          let trend: ExerciseStat["trend"] = "insufficient";
          let changePercent: number | undefined;
          if (sorted.length >= 2 && first && last) {
            const weightChange = last.weight - first.weight;
            if (first.weight > 0) {
              changePercent = Math.round(Math.abs(weightChange) / first.weight * 100);
              trend = changePercent < 3 ? "stable" : weightChange > 0 ? "up" : "down";
            } else {
              trend = last.sets > first.sets || last.reps > first.reps ? "up" : "stable";
            }
          }
          return { name, sessions: sorted.length, first: first ? { weight: first.weight, reps: first.reps, sets: first.sets } : null, last: last ? { weight: last.weight, reps: last.reps, sets: last.sets } : null, trend, changePercent };
        })
        .sort((a, b) => b.sessions - a.sessions)
        .slice(0, 12);

      // 부위, 피드백, 통증 부위
      const bodyPartMap: Record<string, number> = {};
      for (const log of periodLogs) {
        if (log.bodyPart) log.bodyPart.split(",").map(p => p.trim()).filter(Boolean).forEach(p => { bodyPartMap[p] = (bodyPartMap[p] || 0) + 1; });
      }
      const bodyParts = Object.entries(bodyPartMap).sort((a, b) => b[1] - a[1]).map(([p, c]) => `${p}(${c}회)`).slice(0, 6);
      const feedbacks = periodLogs.filter(l => l.feedback).map(l => l.feedback!).slice(0, 3);
      const painAreas = [...new Set(periodChecks.filter(c => c.painArea).map(c => c.painArea!))].slice(0, 5);

      // PAR-Q
      const [health] = await db.select().from(parQ).where(eq(parQ.memberId, input.memberId));
      const ptGoal = [health?.goal1, health?.goal2, health?.goal3].filter(Boolean).join(", ");

      // ReportData 구조
      const reportData: PTReportData = {
        generatedAt: new Date().toLocaleDateString("ko-KR"),
        isAI: false,
        member: { name: member.name, trainerName },
        program: {
          packageName: pkg.packageName || "PT 프로그램",
          totalSessions: pkg.totalSessions,
          usedSessions: pkg.usedSessions,
          startDate: pkg.startDate ?? undefined,
          reportIndex: input.reportIndex,
          milestoneSession: input.milestoneSession,
          fromSession: input.fromSession,
          goal: ptGoal || undefined,
        },
        periodStats: { ...periodSt, fromDate, toDate },
        prevStats: prevSt,
        exercises,
        bodyParts,
        feedbacks,
        painAreas,
      };

      // AI 프롬프트
      const exSummary = exercises.slice(0, 6).map(e =>
        `- ${e.name}: 초기 ${e.first ? `${e.first.weight}kg×${e.first.reps}회×${e.first.sets}세트` : "기록없음"} → 현재 ${e.last ? `${e.last.weight}kg×${e.last.reps}회×${e.last.sets}세트` : "기록없음"} (${e.trend === "up" ? `↑ 향상 ${e.changePercent ?? ""}%` : e.trend === "down" ? "↓ 감소" : "→ 유지"})`
      ).join("\n");

      const prompt = `당신은 개인 트레이닝 전문 코치입니다. 회원에게 전달할 PT 변화 리포트를 한국어로 작성해주세요.

[회원 정보]
- 회원명: ${member.name}
- 담당 트레이너: ${trainerName ?? "미확인"}
- 계약 PT: ${pkg.totalSessions}회 / ${pkg.packageName || "PT"}
- 현재 진행 회차: ${pkg.usedSessions}회차
- 리포트 구간: ${input.fromSession}~${input.milestoneSession}회차 (보고서 ${input.reportIndex})
- 운동 목적: ${ptGoal || "미기재"}

[이번 구간 데이터]
- 실제 수업: ${periodSt.sessionCount}회
- 출석률: ${periodSt.attendanceRate}%
- 컨디션 평균: ${periodSt.avgCondition != null ? `${periodSt.avgCondition}/10` : "기록부족"}${prevSt?.avgCondition != null ? ` (이전 ${prevSt.avgCondition}/10)` : ""}
- 통증 평균: ${periodSt.avgPain != null ? `${periodSt.avgPain}/10` : "기록부족"}${prevSt?.avgPain != null ? ` (이전 ${prevSt.avgPain}/10)` : ""}
- 수면 평균: ${periodSt.avgSleep != null ? `${periodSt.avgSleep}h` : "기록부족"}
- 통증 부위: ${painAreas.join(", ") || "없음"}
- 주요 운동 부위: ${bodyParts.join(", ") || "없음"}

[운동 수행 변화]
${exSummary || "운동 기록 부족"}

[트레이너 피드백 (최근)]
${feedbacks.join(" / ") || "없음"}

[주의사항]
1. 의학적 진단이나 치료 확정 표현은 사용하지 않는다
2. "개선되는 경향", "관리 필요", "추가 확인 필요" 같은 안전한 표현 사용
3. 데이터 부족 시 "기록 부족으로 정확한 판단은 제한적입니다"라고 표현
4. 회원이 이해하기 쉬운 문장으로 작성
5. 긍정적 변화 → 보완점 → 다음 계획 순서
6. 전문적이지만 따뜻한 톤

다음 순서로 보고서를 작성하세요:

**1. 건강리포트 종합 요약**
이번 구간의 변화를 5~7줄로 요약. 좋아진 점 3가지 / 관리 필요한 점 2~3가지 / 운동 지속이 필요한 이유를 데이터 기반으로.

**2. 생활습관 변화 분석**
수면 / 컨디션 / 통증 항목별로 현재 상태, 변화, 운동 결과에 미친 영향, 개선 방향. 데이터 없는 항목은 "기록 부족으로 정확한 판단은 제한적입니다".

**3. 운동 수행 변화 분석**
주요 종목별 수행 능력 변화. 출석률 평가. 회원이 성과를 느낄 수 있도록 쉽게 설명.

**4. 트레이너 코멘트**
잘한 점 / 보완이 필요한 점 / 생활습관에서 바꿔야 할 점.

**5. 다음 운동 계획**
핵심 목표 / 추천 운동 방향 / 운동 강도 / 생활습관 목표.

**6. 회원 전달 메시지**
회원에게 직접 전달하는 따뜻한 문장. 4~6줄. 꾸준함·변화·다음 목표 포함. 과장된 표현 금지.`;

      const apiKey = process.env.ANTHROPIC_API_KEY;
      let aiText = buildFallbackPTReport(member.name, reportData);
      let isAI = false;

      if (apiKey) {
        try {
          const client = new Anthropic({ apiKey });
          const message = await client.messages.create({
            model: "claude-sonnet-4-6",
            max_tokens: 2500,
            messages: [{ role: "user", content: prompt }],
          });
          aiText = message.content[0].type === "text" ? message.content[0].text : aiText;
          isAI = true;
        } catch { /* fallback */ }
      }

      reportData.isAI = isAI;
      const token = Math.random().toString(36).slice(2) + Date.now().toString(36);

      // 같은 packageId+reportIndex 기존 보고서 삭제 후 저장
      await db.delete(ptReports).where(and(eq(ptReports.packageId, input.packageId), eq(ptReports.reportIndex, input.reportIndex)));
      await db.insert(ptReports).values({
        token, packageId: input.packageId, memberId: input.memberId,
        generatedBy: ctx.user!.id, reportIndex: input.reportIndex,
        milestoneSession: input.milestoneSession, fromSession: input.fromSession,
        reportData: JSON.stringify(reportData), aiText, isAI: isAI ? 1 : 0,
      });

      return { token, reportUrl: `/api/pt-report/${token}`, isAI, reportIndex: input.reportIndex };
    }),
});

function buildFallbackMemberReport(
  name: string,
  lifestyle: ReportData["lifestyle"],
  training: ReportData["training"],
) {
  const ls = lifestyle;
  const criticals = [ls.diet, ls.alcohol, ls.sleep, ls.activity].filter(c => c.riskLevel === "critical").length;
  const warnings = [ls.diet, ls.alcohol, ls.sleep, ls.activity].filter(c => c.riskLevel !== "normal").length;
  return `**1. 건강 상태 요약**\n${name} 회원의 건강 데이터 기반 보고서입니다. PAR-Q 건강검사 수치 데이터를 입력하시면 더 정밀한 평가가 가능합니다.\n\n**2. 생활습관 평가**\n식단 ${ls.diet.riskKo} · 음주 ${ls.alcohol.riskKo} · 수면 ${ls.sleep.riskKo} · 활동 ${ls.activity.riskKo}. ${criticals > 0 ? `${criticals}개 영역이 심각 수준으로 즉각적인 관리가 필요합니다.` : warnings > 0 ? `${warnings}개 영역에서 개선이 필요합니다.` : "전반적으로 양호합니다."}\n\n**3. 트레이닝 패턴 분석**\n총 ${training.totalSessions}회 수업을 진행했습니다. ${training.topBodyParts.length > 0 ? `주요 운동 부위: ${training.topBodyParts.join(", ")}` : "운동 부위 기록을 꾸준히 작성해 주세요."}\n\n**4. 맞춤 권장사항**\n1) 생활습관 위험 항목 개선 우선 실천 2) 규칙적인 수업 참석 및 컨디션 체크 기록 3) PAR-Q 건강검사 수치 업데이트로 맞춤 프로그램 설계`;
}

function buildFallbackPTReport(name: string, data: PTReportData): string {
  const ex = data.exercises.slice(0, 3).map(e =>
    `${e.name}(${e.trend === "up" ? "향상" : e.trend === "down" ? "하락" : "유지"})`
  ).join(", ");
  return `**1. 이번 구간 종합 평가**\n${name} 회원의 ${data.program.reportIndex}차 PT 변화 리포트입니다. ${data.periodStats.sessionCount}회 수업에 참여했으며 출석률 ${data.periodStats.attendanceRate}%를 기록했습니다.\n\n**2. 운동 수행 변화 분석**\n주요 운동: ${ex || "기록 없음"}. 꾸준한 세션 참여로 기초 체력 향상에 집중했습니다.\n\n**3. 컨디션 및 생활습관 변화**\n${data.periodStats.avgCondition != null ? `평균 컨디션 ${data.periodStats.avgCondition}/10.` : "컨디션 기록을 꾸준히 작성해 주세요."} ${data.periodStats.avgSleep != null ? `평균 수면 ${data.periodStats.avgSleep}h.` : ""}\n\n**4. 잘한 점 / 보완이 필요한 점**\n꾸준한 출석과 성실한 운동 참여가 긍정적입니다. 식단 및 수면 관리를 함께 실천하면 더 빠른 변화를 기대할 수 있습니다.\n\n**5. 다음 운동 계획**\n현재 운동 강도와 패턴을 유지하면서 단계적으로 부하를 높여가는 방향으로 진행합니다.\n\n**6. 회원 전달 메시지**\n${name} 회원님, 꾸준하게 운동에 참여해 주셔서 감사합니다. 작은 변화들이 쌓여 큰 결과로 이어집니다. 앞으로도 함께 목표를 향해 나아가겠습니다.`;
}

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

// ─── Work (나의 업무) ──────────────────────────────────────────────────────────

function getWeekStart(today: string) {
  const d = new Date(today);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().substring(0, 10);
}

const tasksWorkRouter = t.router({
  list: protectedProcedure
    .input(z.object({ assigneeId: z.number().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const isAdmin = ctx.user!.role === "admin" || ctx.user!.role === "sub_admin";
      const userId = ctx.user!.id;
      const today = new Date().toISOString().substring(0, 10);
      const weekStart = getWeekStart(today);
      const thisMonth = today.substring(0, 7);

      const rows = await db.select({ task: tasks, assigneeName: users.username })
        .from(tasks)
        .leftJoin(users, eq(tasks.assigneeId, users.id))
        .orderBy(tasks.priority, tasks.createdAt);

      let filtered = rows;
      if (!isAdmin) {
        filtered = filtered.filter(r => r.task.assigneeId === userId);
      } else if (input?.assigneeId) {
        filtered = filtered.filter(r => r.task.assigneeId === input.assigneeId);
      }

      return filtered.map(row => {
        const tk = row.task;
        let effectiveStatus = tk.status;
        if (tk.isRecurring === 1 && tk.completedAt) {
          let stillDone = false;
          if (tk.taskType === "daily") stillDone = tk.completedAt.startsWith(today);
          else if (tk.taskType === "weekly") stillDone = tk.completedAt >= weekStart;
          else if (tk.taskType === "monthly") stillDone = tk.completedAt.startsWith(thisMonth);
          effectiveStatus = stillDone ? "done" : "pending";
        }
        return { ...row, effectiveStatus };
      });
    }),

  listStaff: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    return db.select({ id: users.id, username: users.username, role: users.role })
      .from(users)
      .orderBy(users.role, users.username);
  }),

  create: protectedProcedure
    .input(z.object({
      title: z.string().min(1),
      description: z.string().optional(),
      category: z.string().default("기타"),
      priority: z.string().default("normal"),
      taskType: z.string().default("daily"),
      assigneeId: z.number(),
      taskDate: z.string().optional(),
      dayOfWeek: z.number().optional(),
      dayOfMonth: z.number().optional(),
      dueTime: z.string().optional(),
      isRecurring: z.number().default(0),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [row] = await db.insert(tasks).values({ ...input, assignedById: ctx.user!.id, updatedAt: new Date().toISOString() }).returning();
      return row;
    }),

  createForGroup: protectedProcedure
    .input(z.object({
      title: z.string().min(1),
      description: z.string().optional(),
      category: z.string().default("기타"),
      priority: z.string().default("normal"),
      taskType: z.string().default("daily"),
      assigneeGroup: z.enum(["all", "trainer", "consultant"]),
      taskDate: z.string().optional(),
      dueTime: z.string().optional(),
      isRecurring: z.number().default(0),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // 대상 그룹에 해당하는 유저(admin 제외) 조회
      const targetUsers = await db.select({ id: users.id })
        .from(users)
        .where(input.assigneeGroup === "all"
          ? sql`role IN ('trainer','consultant')`
          : eq(users.role, input.assigneeGroup)
        );

      if (targetUsers.length === 0) throw new TRPCError({ code: "NOT_FOUND", message: "대상 직원이 없습니다" });

      const { assigneeGroup, ...rest } = input;
      const rows = await db.insert(tasks).values(
        targetUsers.map(u => ({ ...rest, assigneeId: u.id, assignedById: ctx.user!.id, updatedAt: new Date().toISOString() }))
      ).returning();

      return { count: rows.length };
    }),

  complete: protectedProcedure
    .input(z.object({ id: z.number(), memo: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [row] = await db.update(tasks).set({
        status: "done", completedAt: new Date().toISOString(), completedMemo: input.memo ?? null, updatedAt: new Date().toISOString(),
      }).where(eq(tasks.id, input.id)).returning();
      return row;
    }),

  uncomplete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [row] = await db.update(tasks).set({
        status: "pending", completedAt: null, completedMemo: null, updatedAt: new Date().toISOString(),
      }).where(eq(tasks.id, input.id)).returning();
      return row;
    }),

  updateStatus: protectedProcedure
    .input(z.object({ id: z.number(), status: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [row] = await db.update(tasks).set({ status: input.status, updatedAt: new Date().toISOString() }).where(eq(tasks.id, input.id)).returning();
      return row;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.delete(tasks).where(eq(tasks.id, input.id));
      return { success: true };
    }),

  staffOverview: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const today = new Date().toISOString().substring(0, 10);
    const weekStart = getWeekStart(today);
    const allRows = await db.select({ task: tasks, assigneeName: users.username })
      .from(tasks).leftJoin(users, eq(tasks.assigneeId, users.id));
    const byStaff: Record<number, { name: string; todayTotal: number; todayDone: number; delayed: number }> = {};
    for (const row of allRows) {
      const tk = row.task;
      const isToday = tk.taskType === "daily" && (tk.isRecurring === 1 || tk.taskDate === today);
      if (!isToday) continue;
      if (!byStaff[tk.assigneeId]) byStaff[tk.assigneeId] = { name: row.assigneeName ?? "Unknown", todayTotal: 0, todayDone: 0, delayed: 0 };
      byStaff[tk.assigneeId].todayTotal++;
      const done = tk.isRecurring === 1 ? (tk.completedAt?.startsWith(today) ?? false) : tk.status === "done";
      if (done) byStaff[tk.assigneeId].todayDone++;
      if (tk.status === "delayed") byStaff[tk.assigneeId].delayed++;
    }
    return Object.entries(byStaff).map(([id, s]) => ({
      assigneeId: Number(id), ...s,
      rate: s.todayTotal > 0 ? Math.round((s.todayDone / s.todayTotal) * 100) : 0,
    }));
  }),
});

const noticesWorkRouter = t.router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const role = ctx.user!.role;
    const userId = ctx.user!.id;
    const allNotices = await db.select({ notice: notices, authorName: users.username })
      .from(notices).leftJoin(users, eq(notices.authorId, users.id)).orderBy(desc(notices.createdAt));
    const reads = await db.select().from(noticeReads).where(eq(noticeReads.userId, userId));
    const readIds = new Set(reads.map(r => r.noticeId));
    return allNotices
      .filter(row => role === "admin" || role === "sub_admin" || row.notice.targetRole === "all" || row.notice.targetRole === role)
      .map(row => ({ ...row, isRead: readIds.has(row.notice.id) }));
  }),

  create: protectedProcedure
    .input(z.object({ title: z.string().min(1), content: z.string().min(1), targetRole: z.string().default("all"), priority: z.string().default("normal") }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user!.role !== "admin" && ctx.user!.role !== "sub_admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [row] = await db.insert(notices).values({ ...input, authorId: ctx.user!.id }).returning();
      return row;
    }),

  markRead: protectedProcedure
    .input(z.object({ noticeId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const existing = await db.select().from(noticeReads)
        .where(and(eq(noticeReads.noticeId, input.noticeId), eq(noticeReads.userId, ctx.user!.id))).limit(1);
      if (existing.length === 0) {
        await db.insert(noticeReads).values({ noticeId: input.noticeId, userId: ctx.user!.id, readAt: new Date().toISOString() });
      }
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user!.role !== "admin" && ctx.user!.role !== "sub_admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.delete(notices).where(eq(notices.id, input.id));
      return { success: true };
    }),

  readStatus: protectedProcedure
    .input(z.object({ noticeId: z.number() }))
    .query(async ({ ctx, input }) => {
      if (ctx.user!.role !== "admin" && ctx.user!.role !== "sub_admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // 이 공지의 대상(targetRole) 확인
      const [notice] = await db.select().from(notices).where(eq(notices.id, input.noticeId));
      if (!notice) return { readers: [], nonReaders: [] };

      // 대상 role에 해당하는 모든 유저 (admin 제외)
      const allUsers = await db.select({ id: users.id, username: users.username, role: users.role })
        .from(users)
        .where(notice.targetRole === "all"
          ? sql`role IN ('trainer','consultant')`
          : eq(users.role, notice.targetRole)
        );

      // 읽은 유저
      const reads = await db.select({ read: noticeReads, username: users.username })
        .from(noticeReads).leftJoin(users, eq(noticeReads.userId, users.id))
        .where(eq(noticeReads.noticeId, input.noticeId));

      const readUserIds = new Set(reads.map(r => r.read.userId));

      const readers = reads.map(r => ({
        userId: r.read.userId,
        username: r.username ?? "알 수 없음",
        readAt: r.read.readAt,
      }));

      const nonReaders = allUsers
        .filter(u => !readUserIds.has(u.id))
        .map(u => ({ userId: u.id, username: u.username, role: u.role }));

      return { readers, nonReaders };
    }),
});

const workRouter = t.router({ tasks: tasksWorkRouter, notices: noticesWorkRouter });

// ─── Gym Router ───────────────────────────────────────────────────────────────
const staffRouter = t.router({
  listConsultants: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    return db.select({ id: users.id, username: users.username })
      .from(users)
      .where(eq(users.role, "consultant"))
      .orderBy(users.username);
  }),
  listBranches: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    return db.select().from(branches).orderBy(branches.name);
  }),
});

export const gymRouter = t.router({
  channels: channelsRouter,
  leads: leadsRouter,
  revenue: revenueRouter,
  expenses: expenseRouter,
  kpi: kpiRouter,
  ai: aiRouter,
  work: workRouter,
  staff: staffRouter,
});

export type GymRouter = typeof gymRouter;
