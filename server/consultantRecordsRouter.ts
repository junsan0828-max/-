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

let _migrated = false;
async function ensureDateColumns() {
  if (_migrated) return;
  await pool.query(`
    ALTER TABLE consultant_records ADD COLUMN IF NOT EXISTS date TEXT;
    ALTER TABLE consultant_records ADD COLUMN IF NOT EXISTS images TEXT DEFAULT '[]';
  `);
  _migrated = true;
}

function parseImages(raw: any): string[] {
  try { return JSON.parse(raw ?? "[]"); } catch { return []; }
}
function parseReasons(raw: any): string[] {
  try { return JSON.parse(raw ?? "[]"); } catch { return []; }
}

export const consultantRecordsRouter = t.router({
  // ── 날짜별 조회 ──────────────────────────────────────────────────────────
  getByDate: protectedProcedure
    .input(z.object({ date: z.string() }))
    .query(async ({ ctx, input }) => {
      await ensureDateColumns();
      const result = await pool.query(
        `SELECT * FROM consultant_records WHERE date = $1 AND "createdBy" = $2 LIMIT 1`,
        [input.date, ctx.user.id]
      );
      const row = result.rows[0];
      if (!row) return null;
      return { ...row, churnReasons: parseReasons(row.churnReasons), images: parseImages(row.images) };
    }),

  // ── 날짜별 저장 ──────────────────────────────────────────────────────────
  saveByDate: protectedProcedure
    .input(z.object({
      date: z.string(),
      blogPosts: z.number().default(0),
      instagramPosts: z.number().default(0),
      youtubeVideos: z.number().default(0),
      offlineEvents: z.number().default(0),
      referralCount: z.number().default(0),
      snsFollowers: z.number().nullable().optional(),
      adSpend: z.number().default(0),
      churnCount: z.number().default(0),
      churnReasons: z.array(z.string()).default([]),
      images: z.array(z.string()).default([]),
      memo: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await ensureDateColumns();
      const [yearStr, monthStr] = input.date.split("-");
      const year = parseInt(yearStr), month = parseInt(monthStr);
      const now = new Date().toISOString();
      const churnReasonsJson = JSON.stringify(input.churnReasons);
      const imagesJson = JSON.stringify(input.images);

      const ex = await pool.query(
        `SELECT id FROM consultant_records WHERE date = $1 AND "createdBy" = $2 LIMIT 1`,
        [input.date, ctx.user.id]
      );

      if (ex.rows[0]) {
        await pool.query(
          `UPDATE consultant_records SET
            "blogPosts"=$1,"instagramPosts"=$2,"youtubeVideos"=$3,
            "offlineEvents"=$4,"referralCount"=$5,"snsFollowers"=$6,
            "adSpend"=$7,"churnCount"=$8,"churnReasons"=$9,
            images=$10,memo=$11,"updatedAt"=$12
           WHERE date=$13 AND "createdBy"=$14`,
          [
            input.blogPosts, input.instagramPosts, input.youtubeVideos,
            input.offlineEvents, input.referralCount, input.snsFollowers ?? null,
            input.adSpend, input.churnCount, churnReasonsJson,
            imagesJson, input.memo ?? null, now,
            input.date, ctx.user.id,
          ]
        );
      } else {
        await pool.query(
          `INSERT INTO consultant_records
            (date, year, month, "createdBy", "blogPosts", "instagramPosts", "youtubeVideos",
             "offlineEvents", "referralCount", "snsFollowers", "adSpend",
             "churnCount", "churnReasons", images, memo, "createdAt", "updatedAt")
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$16)`,
          [
            input.date, year, month, ctx.user.id,
            input.blogPosts, input.instagramPosts, input.youtubeVideos,
            input.offlineEvents, input.referralCount, input.snsFollowers ?? null,
            input.adSpend, input.churnCount, churnReasonsJson,
            imagesJson, input.memo ?? null, now,
          ]
        );
      }
      return { ok: true };
    }),

  // ── 월별 기록 목록 (날짜 목록용) ─────────────────────────────────────────
  listByMonth: protectedProcedure
    .input(z.object({ year: z.number(), month: z.number() }))
    .query(async ({ ctx, input }) => {
      await ensureDateColumns();
      const prefix = `${input.year}-${String(input.month).padStart(2, "0")}`;
      const isAdmin = ["admin", "sub_admin"].includes(ctx.user.role ?? "");

      if (isAdmin) {
        const result = await pool.query(
          `SELECT cr.id, cr.date, cr."createdBy", cr."blogPosts", cr."instagramPosts",
                  cr."youtubeVideos", cr."adSpend", cr."churnCount", cr."updatedAt",
                  u.username as "creatorName"
           FROM consultant_records cr
           LEFT JOIN users u ON u.id = cr."createdBy"
           WHERE cr.date LIKE $1
           ORDER BY cr.date ASC, cr."createdBy" ASC`,
          [`${prefix}%`]
        );
        return result.rows;
      } else {
        const result = await pool.query(
          `SELECT id, date, "blogPosts", "instagramPosts", "youtubeVideos", "adSpend", "churnCount", "updatedAt"
           FROM consultant_records
           WHERE "createdBy" = $1 AND date LIKE $2
           ORDER BY date ASC`,
          [ctx.user.id, `${prefix}%`]
        );
        return result.rows;
      }
    }),

  // ── 하위 호환: 기존 월별 get ──────────────────────────────────────────────
  get: protectedProcedure
    .input(z.object({ year: z.number(), month: z.number() }))
    .query(async ({ ctx, input }) => {
      const result = await pool.query(
        `SELECT * FROM consultant_records WHERE year = $1 AND month = $2 AND "createdBy" = $3 AND (date IS NULL OR date = '') LIMIT 1`,
        [input.year, input.month, ctx.user.id]
      );
      return result.rows[0] ?? null;
    }),

  // ── 하위 호환: 기존 월별 save ─────────────────────────────────────────────
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

  // ── 어드민: 전체 조회 ─────────────────────────────────────────────────────
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
        churnReasons: parseReasons(r.churnReasons),
      }));
    }),

  // ── 어드민: 연간 집계 ─────────────────────────────────────────────────────
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
         GROUP BY month ORDER BY month`,
        [input.year]
      );
      return result.rows as Array<{
        month: number; blogPosts: number; instagramPosts: number; youtubeVideos: number;
        offlineEvents: number; referralCount: number; adSpend: number; churnCount: number;
        snsFollowers: number | null;
      }>;
    }),
});
