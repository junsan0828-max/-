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

const AD_CHANNELS = ["검색광고", "파워링크", "플레이스", "당근", "블로그"] as const;
const AD_CHANNELS_WITH_INQUIRY = ["플레이스", "당근", "블로그"] as const;
const INSPECTION_AREAS = ["유산소 기구", "3층 소도구존", "2층 웨이트기구", "PT/케어존", "탈의실", "2층 거울", "3층 거울", "현장 이슈"] as const;
const CONTENT_PLATFORMS = ["플레이스", "당근", "블로그"] as const;

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
    CREATE TABLE IF NOT EXISTS ad_data_entries (
      id SERIAL PRIMARY KEY,
      date TEXT NOT NULL,
      channel TEXT NOT NULL,
      impressions INTEGER DEFAULT 0,
      clicks INTEGER DEFAULT 0,
      visits INTEGER DEFAULT 0,
      inquiries INTEGER DEFAULT 0,
      notes TEXT,
      "createdBy" INTEGER NOT NULL,
      "createdAt" TEXT NOT NULL,
      "updatedAt" TEXT NOT NULL,
      CONSTRAINT ad_unique_date_channel_user UNIQUE (date, channel, "createdBy")
    );
    CREATE TABLE IF NOT EXISTS center_inspection_entries (
      id SERIAL PRIMARY KEY,
      date TEXT NOT NULL,
      area TEXT NOT NULL,
      "facilityStatus" TEXT NOT NULL DEFAULT '정상',
      "hygieneStatus" TEXT NOT NULL DEFAULT '양호',
      "issueNote" TEXT,
      "assignee" TEXT,
      "actionStatus" TEXT,
      "actionDate" TEXT,
      "createdBy" INTEGER NOT NULL,
      "createdAt" TEXT NOT NULL,
      "updatedAt" TEXT NOT NULL,
      CONSTRAINT ci_unique_date_area_user UNIQUE (date, area, "createdBy")
    );
    CREATE TABLE IF NOT EXISTS content_entries (
      id SERIAL PRIMARY KEY,
      date TEXT NOT NULL,
      platform TEXT NOT NULL,
      published BOOLEAN DEFAULT false,
      "publishCount" INTEGER DEFAULT 0,
      topic TEXT,
      "publishDate" TEXT,
      assignee TEXT,
      completed BOOLEAN DEFAULT false,
      "autoStatus" TEXT,
      "createdBy" INTEGER NOT NULL,
      "createdAt" TEXT NOT NULL,
      "updatedAt" TEXT NOT NULL,
      CONSTRAINT ce_unique_date_platform_user UNIQUE (date, platform, "createdBy")
    );
  `);
  _tablesReady = true;
  await pool.query(`ALTER TABLE consultant_data_fields ADD COLUMN IF NOT EXISTS description TEXT`);
  await pool.query(`ALTER TABLE consultant_data_fields ADD COLUMN IF NOT EXISTS assignee TEXT`);
}

export const consultantDataRouter = t.router({
  // ── 담당자 후보 목록 (트레이너 이름) ─────────────────────────────────────
  listStaff: protectedProcedure.query(async () => {
    const result = await pool.query(
      `SELECT id, "trainerName" as name FROM trainers ORDER BY "trainerName" ASC`
    );
    return result.rows as { id: number; name: string }[];
  }),

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
      assignee: z.string().optional(),
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
      if (input.assignee !== undefined) { sets.push(`assignee = $${params.length + 1}`); params.push(input.assignee); }
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

  // ── 광고 데이터: 특정 날짜 조회 ─────────────────────────────────────────
  getAdEntries: protectedProcedure
    .input(z.object({ date: z.string() }))
    .query(async ({ ctx, input }) => {
      await ensureTables();
      const result = await pool.query(
        `SELECT * FROM ad_data_entries WHERE date = $1 AND "createdBy" = $2 ORDER BY channel ASC`,
        [input.date, ctx.user.id]
      );
      return result.rows as Array<{
        id: number; date: string; channel: string;
        impressions: number; clicks: number; visits: number; inquiries: number;
        notes: string | null; createdBy: number;
      }>;
    }),

  // ── 광고 데이터: 저장 (배치 upsert) ──────────────────────────────────────
  saveAdEntries: protectedProcedure
    .input(z.object({
      date: z.string(),
      entries: z.array(z.object({
        channel: z.string(),
        impressions: z.number().min(0),
        clicks: z.number().min(0),
        visits: z.number().min(0),
        inquiries: z.number().min(0),
        notes: z.string().optional(),
      })),
    }))
    .mutation(async ({ ctx, input }) => {
      await ensureTables();
      const now = new Date().toISOString();
      for (const e of input.entries) {
        await pool.query(
          `INSERT INTO ad_data_entries (date, channel, impressions, clicks, visits, inquiries, notes, "createdBy", "createdAt", "updatedAt")
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)
           ON CONFLICT ON CONSTRAINT ad_unique_date_channel_user
           DO UPDATE SET impressions = $3, clicks = $4, visits = $5, inquiries = $6, notes = $7, "updatedAt" = $9`,
          [input.date, e.channel, e.impressions, e.clicks, e.visits, e.inquiries, e.notes ?? null, ctx.user.id, now]
        );
      }
      return { ok: true };
    }),

  // ── 광고 데이터: 월별 기록 있는 날짜 목록 ────────────────────────────────
  getAdDatesWithData: protectedProcedure
    .input(z.object({ year: z.number(), month: z.number() }))
    .query(async ({ ctx, input }) => {
      await ensureTables();
      const prefix = `${input.year}-${String(input.month).padStart(2, "0")}`;
      const result = await pool.query(
        `SELECT DISTINCT date FROM ad_data_entries WHERE "createdBy" = $1 AND date LIKE $2`,
        [ctx.user.id, `${prefix}%`]
      );
      return result.rows.map((r: any) => r.date as string);
    }),

  // ── 센터 점검: 특정 날짜 조회 ──────────────────────────────────────────
  getInspectionEntries: protectedProcedure
    .input(z.object({ date: z.string() }))
    .query(async ({ ctx, input }) => {
      await ensureTables();
      const result = await pool.query(
        `SELECT * FROM center_inspection_entries WHERE date = $1 AND "createdBy" = $2 ORDER BY id ASC`,
        [input.date, ctx.user.id]
      );
      return result.rows as Array<{
        id: number; date: string; area: string;
        facilityStatus: string; hygieneStatus: string;
        issueNote: string | null; assignee: string | null;
        actionStatus: string | null; actionDate: string | null;
      }>;
    }),

  // ── 센터 점검: 저장 (배치 upsert) ──────────────────────────────────────
  saveInspectionEntries: protectedProcedure
    .input(z.object({
      date: z.string(),
      entries: z.array(z.object({
        area: z.string(),
        facilityStatus: z.enum(["정상", "주의", "이상"]),
        hygieneStatus: z.enum(["양호", "청소 필요", "즉시 조치 필요"]),
        issueNote: z.string().optional(),
        assignee: z.string().optional(),
        actionStatus: z.enum(["미처리", "진행", "완료"]).optional(),
        actionDate: z.string().optional(),
      })),
    }))
    .mutation(async ({ ctx, input }) => {
      await ensureTables();
      const now = new Date().toISOString();
      for (const e of input.entries) {
        await pool.query(
          `INSERT INTO center_inspection_entries (date, area, "facilityStatus", "hygieneStatus", "issueNote", "assignee", "actionStatus", "actionDate", "createdBy", "createdAt", "updatedAt")
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10)
           ON CONFLICT ON CONSTRAINT ci_unique_date_area_user
           DO UPDATE SET "facilityStatus" = $3, "hygieneStatus" = $4, "issueNote" = $5, "assignee" = $6, "actionStatus" = $7, "actionDate" = $8, "updatedAt" = $10`,
          [input.date, e.area, e.facilityStatus, e.hygieneStatus, e.issueNote ?? null, e.assignee ?? null, e.actionStatus ?? null, e.actionDate ?? null, ctx.user.id, now]
        );
      }
      return { ok: true };
    }),

  // ── 센터 점검: 월별 기록 있는 날짜 목록 ────────────────────────────────
  getInspectionDatesWithData: protectedProcedure
    .input(z.object({ year: z.number(), month: z.number() }))
    .query(async ({ ctx, input }) => {
      await ensureTables();
      const prefix = `${input.year}-${String(input.month).padStart(2, "0")}`;
      const result = await pool.query(
        `SELECT DISTINCT date FROM center_inspection_entries WHERE "createdBy" = $1 AND date LIKE $2`,
        [ctx.user.id, `${prefix}%`]
      );
      return result.rows.map((r: any) => r.date as string);
    }),

  // ── 콘텐츠: 특정 날짜 조회 ─────────────────────────────────────────────
  getContentEntries: protectedProcedure
    .input(z.object({ date: z.string() }))
    .query(async ({ ctx, input }) => {
      await ensureTables();
      const result = await pool.query(
        `SELECT * FROM content_entries WHERE date = $1 AND "createdBy" = $2 ORDER BY id ASC`,
        [input.date, ctx.user.id]
      );
      return result.rows as Array<{
        id: number; date: string; platform: string;
        published: boolean; publishCount: number; topic: string | null;
        publishDate: string | null; assignee: string | null;
        completed: boolean; autoStatus: string | null;
      }>;
    }),

  // ── 콘텐츠: 저장 (배치 upsert) ─────────────────────────────────────────
  saveContentEntries: protectedProcedure
    .input(z.object({
      date: z.string(),
      entries: z.array(z.object({
        platform: z.string(),
        published: z.boolean(),
        publishCount: z.number().min(0),
        topic: z.string().optional(),
        publishDate: z.string().optional(),
        assignee: z.string().optional(),
        completed: z.boolean(),
        autoStatus: z.enum(["정상", "오류"]).optional(),
      })),
    }))
    .mutation(async ({ ctx, input }) => {
      await ensureTables();
      const now = new Date().toISOString();
      for (const e of input.entries) {
        await pool.query(
          `INSERT INTO content_entries (date, platform, published, "publishCount", topic, "publishDate", assignee, completed, "autoStatus", "createdBy", "createdAt", "updatedAt")
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $11)
           ON CONFLICT ON CONSTRAINT ce_unique_date_platform_user
           DO UPDATE SET published = $3, "publishCount" = $4, topic = $5, "publishDate" = $6, assignee = $7, completed = $8, "autoStatus" = $9, "updatedAt" = $11`,
          [input.date, e.platform, e.published, e.publishCount, e.topic ?? null, e.publishDate ?? null, e.assignee ?? null, e.completed, e.autoStatus ?? null, ctx.user.id, now]
        );
      }
      return { ok: true };
    }),

  // ── 콘텐츠: 월별 기록 있는 날짜 목록 ───────────────────────────────────
  getContentDatesWithData: protectedProcedure
    .input(z.object({ year: z.number(), month: z.number() }))
    .query(async ({ ctx, input }) => {
      await ensureTables();
      const prefix = `${input.year}-${String(input.month).padStart(2, "0")}`;
      const result = await pool.query(
        `SELECT DISTINCT date FROM content_entries WHERE "createdBy" = $1 AND date LIKE $2`,
        [ctx.user.id, `${prefix}%`]
      );
      return result.rows.map((r: any) => r.date as string);
    }),

  // ── 광고 데이터: 기간별 요약 ──────────────────────────────────────────────
  getAdSummary: protectedProcedure
    .input(z.object({ startDate: z.string(), endDate: z.string() }))
    .query(async ({ input }) => {
      await ensureTables();
      const result = await pool.query(
        `SELECT channel, SUM(impressions)::int as impressions, SUM(clicks)::int as clicks, SUM(visits)::int as visits, SUM(inquiries)::int as inquiries
         FROM ad_data_entries
         WHERE date >= $1 AND date <= $2
         GROUP BY channel ORDER BY channel`,
        [input.startDate, input.endDate]
      );
      return result.rows as Array<{ channel: string; impressions: number; clicks: number; visits: number; inquiries: number }>;
    }),

  // ── 콘텐츠: 기간별 요약 ──────────────────────────────────────────────────
  getContentSummary: protectedProcedure
    .input(z.object({ startDate: z.string(), endDate: z.string() }))
    .query(async ({ input }) => {
      await ensureTables();
      const result = await pool.query(
        `SELECT platform, COUNT(*) FILTER (WHERE published = true)::int as "publishedDays", SUM("publishCount")::int as "totalPublished", COUNT(*) FILTER (WHERE completed = true)::int as "completedDays", COUNT(*)::int as "totalDays"
         FROM content_entries
         WHERE date >= $1 AND date <= $2
         GROUP BY platform ORDER BY platform`,
        [input.startDate, input.endDate]
      );
      return result.rows as Array<{ platform: string; publishedDays: number; totalPublished: number; completedDays: number; totalDays: number }>;
    }),

  // ── 센터 점검: 기간별 요약 ──────────────────────────────────────────────────
  getInspectionSummary: protectedProcedure
    .input(z.object({ startDate: z.string(), endDate: z.string() }))
    .query(async ({ input }) => {
      await ensureTables();
      const [latestRes, issueRes, daysRes] = await Promise.all([
        pool.query(
          `SELECT DISTINCT ON (area) area, "facilityStatus", "hygieneStatus", "issueNote", assignee, "actionStatus", "actionDate", date
           FROM center_inspection_entries
           WHERE date >= $1 AND date <= $2
           ORDER BY area, date DESC`,
          [input.startDate, input.endDate]
        ),
        pool.query(
          `SELECT COUNT(*)::int as count FROM center_inspection_entries
           WHERE date >= $1 AND date <= $2 AND ("facilityStatus" != '정상' OR "hygieneStatus" != '양호')`,
          [input.startDate, input.endDate]
        ),
        pool.query(
          `SELECT COUNT(DISTINCT date)::int as count FROM center_inspection_entries
           WHERE date >= $1 AND date <= $2`,
          [input.startDate, input.endDate]
        ),
      ]);
      return {
        latestByArea: latestRes.rows as Array<{
          area: string; facilityStatus: string; hygieneStatus: string;
          issueNote: string | null; assignee: string | null;
          actionStatus: string | null; actionDate: string | null; date: string;
        }>,
        issueCount: (issueRes.rows[0] as any).count as number,
        totalDays: (daysRes.rows[0] as any).count as number,
      };
    }),

  // ── 센터 점검: 미조치 항목 목록 ──────────────────────────────────────────────
  getInspectionPending: protectedProcedure
    .input(z.object({ startDate: z.string(), endDate: z.string() }))
    .query(async ({ input }) => {
      await ensureTables();
      const res = await pool.query(
        `SELECT DISTINCT ON (area) area, "facilityStatus", "hygieneStatus", "issueNote", assignee, "actionStatus", date
         FROM center_inspection_entries
         WHERE date >= $1 AND date <= $2
           AND ("facilityStatus" != '정상' OR "hygieneStatus" != '양호')
           AND (COALESCE("actionStatus", '미처리') != '완료')
         ORDER BY area, date DESC`,
        [input.startDate, input.endDate]
      );
      return res.rows as Array<{
        area: string; facilityStatus: string; hygieneStatus: string;
        issueNote: string | null; assignee: string | null;
        actionStatus: string | null; date: string;
      }>;
    }),

  // ── 센터 점검: 일별 이상 건수 추이 ──────────────────────────────────────────
  getInspectionTrend: protectedProcedure
    .input(z.object({ startDate: z.string(), endDate: z.string() }))
    .query(async ({ input }) => {
      await ensureTables();
      const res = await pool.query(
        `SELECT date,
                COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE "facilityStatus" != '정상' OR "hygieneStatus" != '양호')::int AS issues
         FROM center_inspection_entries
         WHERE date >= $1 AND date <= $2
         GROUP BY date
         ORDER BY date`,
        [input.startDate, input.endDate]
      );
      return res.rows as Array<{ date: string; total: number; issues: number }>;
    }),

  // ── 센터 점검: 구역별 이상 빈도 통계 ──────────────────────────────────────────
  getInspectionAreaStats: protectedProcedure
    .input(z.object({ startDate: z.string(), endDate: z.string() }))
    .query(async ({ input }) => {
      await ensureTables();
      const res = await pool.query(
        `SELECT area,
                COUNT(*)::int AS total_checks,
                COUNT(*) FILTER (WHERE "facilityStatus" != '정상')::int AS facility_issues,
                COUNT(*) FILTER (WHERE "hygieneStatus" != '양호')::int AS hygiene_issues,
                COUNT(*) FILTER (WHERE "facilityStatus" != '정상' OR "hygieneStatus" != '양호')::int AS total_issues
         FROM center_inspection_entries
         WHERE date >= $1 AND date <= $2
         GROUP BY area
         ORDER BY total_issues DESC, area`,
        [input.startDate, input.endDate]
      );
      return res.rows as Array<{
        area: string; total_checks: number;
        facility_issues: number; hygiene_issues: number; total_issues: number;
      }>;
    }),
});
