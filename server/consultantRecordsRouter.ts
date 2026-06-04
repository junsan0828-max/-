import { initTRPC, TRPCError } from "@trpc/server";
import { z } from "zod";
import { pool } from "./db";
import type { AuthUser } from "./auth";
import type { Request } from "express";

const t = initTRPC.context<{ user: AuthUser; req: Request }>().create();
const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });
  return next({ ctx: { ...ctx, user: ctx.user } });
});

export const consultantRecordsRouter = t.router({
  // 특정 연월 기록 조회 (없으면 null)
  get: protectedProcedure
    .input(z.object({ year: z.number(), month: z.number() }))
    .query(async ({ ctx, input }) => {
      const result = await pool.query(
        `SELECT * FROM consultant_records WHERE year = $1 AND month = $2 AND "createdBy" = $3 LIMIT 1`,
        [input.year, input.month, ctx.user.id]
      );
      return result.rows[0] ?? null;
    }),

  // 저장 (upsert)
  save: protectedProcedure
    .input(z.object({
      year: z.number(),
      month: z.number(),
      branchId: z.number().nullable().optional(),
      blogPosts: z.number().default(0),
      instagramPosts: z.number().default(0),
      youtubeVideos: z.number().default(0),
      offlineEvents: z.number().default(0),
      referralCount: z.number().default(0),
      snsFollowers: z.number().nullable().optional(),
      adSpend: z.number().default(0),
      churnCount: z.number().default(0),
      churnReasons: z.array(z.string()).default([]),
      memo: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const now = new Date().toISOString();
      const churnReasonsJson = JSON.stringify(input.churnReasons);
      await pool.query(
        `INSERT INTO consultant_records
           (year, month, "branchId", "createdBy", "blogPosts", "instagramPosts", "youtubeVideos",
            "offlineEvents", "referralCount", "snsFollowers", "adSpend",
            "churnCount", "churnReasons", memo, "createdAt", "updatedAt")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$15)
         ON CONFLICT (year, month, "branchId", "createdBy")
         DO UPDATE SET
           "blogPosts"=$5, "instagramPosts"=$6, "youtubeVideos"=$7,
           "offlineEvents"=$8, "referralCount"=$9, "snsFollowers"=$10,
           "adSpend"=$11, "churnCount"=$12, "churnReasons"=$13, memo=$14, "updatedAt"=$15`,
        [
          input.year, input.month, input.branchId ?? null, ctx.user.id,
          input.blogPosts, input.instagramPosts, input.youtubeVideos,
          input.offlineEvents, input.referralCount, input.snsFollowers ?? null, input.adSpend,
          input.churnCount, churnReasonsJson, input.memo ?? null, now,
        ]
      );
      return { ok: true };
    }),

  // 어드민용: 전체 기록 조회 (연월 기준)
  listAll: protectedProcedure
    .input(z.object({ year: z.number(), month: z.number() }))
    .query(async ({ ctx, input }) => {
      if (!["admin", "sub_admin"].includes(ctx.user.role ?? ""))
        throw new TRPCError({ code: "FORBIDDEN" });
      const result = await pool.query(
        `SELECT cr.*, u.username as "creatorName"
         FROM consultant_records cr
         LEFT JOIN users u ON u.id = cr."createdBy"
         WHERE cr.year = $1 AND cr.month = $2
         ORDER BY cr."createdAt" ASC`,
        [input.year, input.month]
      );
      return result.rows.map((r: any) => ({
        ...r,
        churnReasons: (() => { try { return JSON.parse(r.churnReasons ?? "[]"); } catch { return []; } })(),
      }));
    }),

  // 어드민용: 연간 월별 집계
  annualSummary: protectedProcedure
    .input(z.object({ year: z.number() }))
    .query(async ({ ctx, input }) => {
      if (!["admin", "sub_admin"].includes(ctx.user.role ?? ""))
        throw new TRPCError({ code: "FORBIDDEN" });
      const result = await pool.query(
        `SELECT month,
           SUM("blogPosts")::int AS "blogPosts",
           SUM("instagramPosts")::int AS "instagramPosts",
           SUM("youtubeVideos")::int AS "youtubeVideos",
           SUM("offlineEvents")::int AS "offlineEvents",
           SUM("referralCount")::int AS "referralCount",
           SUM("adSpend")::int AS "adSpend",
           SUM("churnCount")::int AS "churnCount",
           MAX("snsFollowers") AS "snsFollowers"
         FROM consultant_records
         WHERE year = $1
         GROUP BY month
         ORDER BY month`,
        [input.year]
      );
      return result.rows as Array<{
        month: number; blogPosts: number; instagramPosts: number; youtubeVideos: number;
        offlineEvents: number; referralCount: number; adSpend: number; churnCount: number;
        snsFollowers: number | null;
      }>;
    }),
});
