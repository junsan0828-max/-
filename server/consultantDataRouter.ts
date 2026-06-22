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

let _tablesReady = false;
async function ensureTables() {
  if (_tablesReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS consultant_data_fields (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      unit TEXT DEFAULT '건',
      section TEXT NOT NULL DEFAULT 'daily',
      "sortOrder" INTEGER DEFAULT 0,
      "isActive" BOOLEAN DEFAULT true,
      "createdAt" TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS consultant_data_entries (
      id SERIAL PRIMARY KEY,
      "fieldId" INTEGER NOT NULL,
      date TEXT NOT NULL,
      value TEXT NOT NULL DEFAULT '0',
      "createdBy" INTEGER NOT NULL,
      "createdAt" TEXT NOT NULL,
      "updatedAt" TEXT NOT NULL,
      CONSTRAINT cde_unique_field_date_user UNIQUE ("fieldId", date, "createdBy")
    );
  `);
  _tablesReady = true;
  await pool.query(`ALTER TABLE consultant_data_fields ADD COLUMN IF NOT EXISTS description TEXT`);
}

export const consultantDataRouter = t.router({
  // ── 항목 목록 ────────────────────────────────────────────────────────────
  listFields: protectedProcedure
    .input(z.object({ section: z.enum(["daily", "weekly"]).optional() }))
    .query(async ({ ctx, input }) => {
      await ensureTables();
      const isAdmin = ["admin", "sub_admin"].includes(ctx.user.role ?? "");
      const conditions: string[] = [];
      const params: any[] = [];
      if (!isAdmin) { conditions.push(`"isActive" = true`); }
      if (input.section) { conditions.push(`section = $${params.length + 1}`); params.push(input.section); }
      const where = conditions.length ? ` WHERE ${conditions.join(" AND ")}` : "";
      const result = await pool.query(
        `SELECT * FROM consultant_data_fields${where} ORDER BY "sortOrder" ASC, id ASC`,
        params
      );
      return result.rows;
    }),

  // ── 항목 추가 (어드민) ───────────────────────────────────────────────────
  createField: protectedProcedure
    .input(z.object({
      name: z.string().min(1),
      unit: z.string().default("건"),
      section: z.enum(["daily", "weekly"]),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!["admin", "sub_admin"].includes(ctx.user.role ?? ""))
        throw new TRPCError({ code: "FORBIDDEN" });
      await ensureTables();
      const maxRes = await pool.query(
        `SELECT COALESCE(MAX("sortOrder"), -1) as mx FROM consultant_data_fields WHERE section = $1`,
        [input.section]
      );
      const sortOrder = Number(maxRes.rows[0]?.mx ?? -1) + 1;
      const result = await pool.query(
        `INSERT INTO consultant_data_fields (name, unit, section, "sortOrder", "isActive", "createdAt")
         VALUES ($1, $2, $3, $4, true, $5) RETURNING *`,
        [input.name, input.unit, input.section, sortOrder, new Date().toISOString()]
      );
      return result.rows[0];
    }),

  // ── 항목 수정 (어드민) ───────────────────────────────────────────────────
  updateField: protectedProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().min(1).optional(),
      unit: z.string().optional(),
      isActive: z.boolean().optional(),
      description: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!["admin", "sub_admin"].includes(ctx.user.role ?? ""))
        throw new TRPCError({ code: "FORBIDDEN" });
      await ensureTables();
      const sets: string[] = [];
      const params: any[] = [];
      if (input.name !== undefined) { sets.push(`name = $${params.length + 1}`); params.push(input.name); }
      if (input.unit !== undefined) { sets.push(`unit = $${params.length + 1}`); params.push(input.unit); }
      if (input.isActive !== undefined) { sets.push(`"isActive" = $${params.length + 1}`); params.push(input.isActive); }
      if (input.description !== undefined) { sets.push(`description = $${params.length + 1}`); params.push(input.description); }
      if (!sets.length) return { ok: true };
      params.push(input.id);
      await pool.query(`UPDATE consultant_data_fields SET ${sets.join(", ")} WHERE id = $${params.length}`, params);
      return { ok: true };
    }),

  // ── 항목 삭제 (어드민) ───────────────────────────────────────────────────
  deleteField: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (!["admin", "sub_admin"].includes(ctx.user.role ?? ""))
        throw new TRPCError({ code: "FORBIDDEN" });
      await ensureTables();
      await pool.query(`DELETE FROM consultant_data_entries WHERE "fieldId" = $1`, [input.id]);
      await pool.query(`DELETE FROM consultant_data_fields WHERE id = $1`, [input.id]);
      return { ok: true };
    }),

  // ── 특정 날짜/주 엔트리 조회 ─────────────────────────────────────────────
  getEntries: protectedProcedure
    .input(z.object({ date: z.string(), section: z.enum(["daily", "weekly"]) }))
    .query(async ({ ctx, input }) => {
      await ensureTables();
      const result = await pool.query(
        `SELECT e."fieldId", e.value, f.name, f.unit
         FROM consultant_data_entries e
         JOIN consultant_data_fields f ON f.id = e."fieldId"
         WHERE e.date = $1 AND e."createdBy" = $2 AND f.section = $3
         ORDER BY f."sortOrder" ASC`,
        [input.date, ctx.user.id, input.section]
      );
      return result.rows as Array<{ fieldId: number; value: string; name: string; unit: string }>;
    }),

  // ── 저장 (배치 upsert) ───────────────────────────────────────────────────
  saveEntries: protectedProcedure
    .input(z.object({
      date: z.string(),
      entries: z.array(z.object({ fieldId: z.number(), value: z.string() })),
    }))
    .mutation(async ({ ctx, input }) => {
      await ensureTables();
      const now = new Date().toISOString();
      for (const entry of input.entries) {
        await pool.query(
          `INSERT INTO consultant_data_entries ("fieldId", date, value, "createdBy", "createdAt", "updatedAt")
           VALUES ($1, $2, $3, $4, $5, $5)
           ON CONFLICT ON CONSTRAINT cde_unique_field_date_user
           DO UPDATE SET value = $3, "updatedAt" = $5`,
          [entry.fieldId, input.date, entry.value, ctx.user.id, now]
        );
      }
      return { ok: true };
    }),

  // ── 월별 기록 있는 날짜/주 목록 ──────────────────────────────────────────
  getDatesWithData: protectedProcedure
    .input(z.object({ year: z.number(), month: z.number(), section: z.enum(["daily", "weekly"]) }))
    .query(async ({ ctx, input }) => {
      await ensureTables();
      const prefix = `${input.year}-${String(input.month).padStart(2, "0")}`;
      const result = await pool.query(
        `SELECT DISTINCT e.date
         FROM consultant_data_entries e
         JOIN consultant_data_fields f ON f.id = e."fieldId"
         WHERE e."createdBy" = $1 AND e.date LIKE $2 AND f.section = $3`,
        [ctx.user.id, `${prefix}%`, input.section]
      );
      return result.rows.map((r: any) => r.date as string);
    }),
});
