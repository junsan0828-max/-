import type { Request, Response, NextFunction, Router } from "express";
import express from "express";
import { pool } from "./db";

const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_MINUTE = Number(process.env.AI_BRANCH_MANAGER_RATE_LIMIT_PER_MINUTE || 30);
const requestBuckets = new Map<string, { count: number; resetAt: number }>();

type JsonRpcRequest = { jsonrpc?: string; id?: string | number | null; method?: string; params?: any };

type ToolDef = { name: string; description: string; inputSchema: Record<string, unknown> };

const dateSchema = { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" };
const branchSchema = { type: "integer", minimum: 1 };
const limitSchema = { type: "integer", minimum: 1, maximum: 100, default: 50 };

const tools: ToolDef[] = [
  { name: "get_operational_kpi_summary", description: "지정 기간의 운영 KPI 요약(매출, 신규/재등록, 활성 회원, 상담 상태)을 읽기 전용으로 조회합니다.", inputSchema: { type: "object", properties: { startDate: dateSchema, endDate: dateSchema, branchId: branchSchema }, required: ["startDate", "endDate"], additionalProperties: false } },
  { name: "list_expiring_health_memberships", description: "헬스권 만료 예정 후보를 조회합니다. 회원명은 마스킹되며 연락처/이메일/건강정보는 반환하지 않습니다.", inputSchema: { type: "object", properties: { startDate: dateSchema, endDate: dateSchema, branchId: branchSchema, limit: limitSchema }, required: ["startDate", "endDate"], additionalProperties: false } },
  { name: "get_staff_performance", description: "직원별 매출·상담·수업 성과를 조회합니다.", inputSchema: { type: "object", properties: { startDate: dateSchema, endDate: dateSchema, branchId: branchSchema }, required: ["startDate", "endDate"], additionalProperties: false } },
  { name: "list_follow_up_candidates", description: "후속조치가 필요한 상담/만료 후보를 조회합니다. 발송 확정 대상으로 자동 처리하지 않습니다.", inputSchema: { type: "object", properties: { startDate: dateSchema, endDate: dateSchema, branchId: branchSchema, limit: limitSchema }, required: ["startDate", "endDate"], additionalProperties: false } },
  { name: "check_data_quality", description: "데이터 누락·모순(날짜 역전, 금액 모순, 누락된 담당/지점 등)을 점검합니다.", inputSchema: { type: "object", properties: { startDate: dateSchema, endDate: dateSchema, branchId: branchSchema, limit: limitSchema }, required: ["startDate", "endDate"], additionalProperties: false } },
];

function maskName(name: string | null | undefined): string {
  if (!name) return "-";
  const chars = [...name.trim()];
  if (chars.length <= 1) return "*";
  if (chars.length === 2) return `${chars[0]}*`;
  return `${chars[0]}${"*".repeat(chars.length - 2)}${chars[chars.length - 1]}`;
}

function validateDateRange(params: any): { startDate: string; endDate: string; branchId: number | null; limit: number } {
  const allowedKeys = new Set(["startDate", "endDate", "branchId", "limit"]);
  for (const key of Object.keys(params ?? {})) {
    if (!allowedKeys.has(key)) throw new Error(`허용되지 않은 파라미터입니다: ${key}`);
  }
  const startDate = String(params?.startDate ?? "");
  const endDate = String(params?.endDate ?? "");
  const valid = /^\d{4}-\d{2}-\d{2}$/;
  if (!valid.test(startDate) || !valid.test(endDate)) throw new Error("날짜는 YYYY-MM-DD 형식이어야 합니다.");
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start.toISOString().slice(0, 10) !== startDate || end.toISOString().slice(0, 10) !== endDate) throw new Error("실제 달력 날짜만 허용됩니다.");
  if (start > end) throw new Error("시작일은 종료일보다 늦을 수 없습니다.");
  const branchId = params?.branchId == null ? null : Number(params.branchId);
  if (branchId !== null && (!Number.isInteger(branchId) || branchId < 1)) throw new Error("branchId는 양의 정수여야 합니다.");
  const limit = params?.limit == null ? 50 : Number(params.limit);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new Error("limit은 1~100 사이의 정수여야 합니다.");
  return { startDate, endDate, branchId, limit };
}

async function selectOnly<T extends Record<string, any> = any>(text: string, values: unknown[] = []): Promise<T[]> {
  if (!/^\s*(select|with)\b/i.test(text) || /\b(insert|update|delete|alter|drop|create|truncate|grant|revoke|call)\b/i.test(text)) throw new Error("MCP 조회는 SELECT만 허용됩니다.");
  const result = await pool.query<T>(text, values);
  return result.rows;
}

function branchClause(alias: string, branchId: number | null, nextParam: number): string {
  return branchId ? ` AND ${alias}."branchId" = $${nextParam}` : "";
}

async function callTool(name: string, params: any) {
  const { startDate, endDate, branchId, limit } = validateDateRange(params);
  if (name === "get_operational_kpi_summary") {
    const branch = branchClause("r", branchId, 3);
    const [revenue, members, leads] = await Promise.all([
      selectOnly(`SELECT COALESCE(SUM("paidAmount"),0)::int AS "paidAmount", COALESCE(SUM("unpaidAmount"),0)::int AS "unpaidAmount", COUNT(*)::int AS count, COUNT(*) FILTER (WHERE "subType"='신규')::int AS "newCount", COUNT(*) FILTER (WHERE "subType"='재등록')::int AS "renewalCount" FROM revenue_entries r WHERE r."paymentDate" BETWEEN $1 AND $2${branch}`, branchId ? [startDate, endDate, branchId] : [startDate, endDate]),
      selectOnly(`SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE status='active')::int AS active, COUNT(*) FILTER (WHERE "membershipEnd" BETWEEN $1 AND $2)::int AS expiring FROM members m WHERE 1=1${branchClause("m", branchId, 3)}`, branchId ? [startDate, endDate, branchId] : [startDate, endDate]),
      selectOnly(`SELECT status, COUNT(*)::int AS count FROM leads l WHERE l."createdAt"::date BETWEEN $1 AND $2${branchClause("l", branchId, 3)} GROUP BY status ORDER BY status`, branchId ? [startDate, endDate, branchId] : [startDate, endDate]),
    ]);
    return { period: { startDate, endDate }, branchId, revenue: revenue[0], members: members[0], leadsByStatus: leads };
  }
  if (name === "list_expiring_health_memberships") {
    const rows = await selectOnly(`SELECT m.id, m.name, m.status, m."membershipStart", m."membershipEnd", m."renewalIntent", t."trainerName", b.name AS "branchName" FROM members m LEFT JOIN trainers t ON t.id=m."trainerId" LEFT JOIN branches b ON b.id=m."branchId" WHERE m."membershipEnd" BETWEEN $1 AND $2${branchClause("m", branchId, 3)} ORDER BY m."membershipEnd" ASC LIMIT $${branchId ? 4 : 3}`, branchId ? [startDate, endDate, branchId, limit] : [startDate, endDate, limit]);
    return rows.map((r: any) => ({ ...r, name: maskName(r.name) }));
  }
  if (name === "get_staff_performance") {
    return selectOnly(`SELECT COALESCE(t.id, u.id) AS "staffId", COALESCE(t."trainerName", u.username, '미지정') AS "staffName", COUNT(r.id)::int AS "salesCount", COALESCE(SUM(r."paidAmount"),0)::int AS "paidAmount", COALESCE(SUM(r.sessions),0)::int AS sessions, COUNT(DISTINCT l.id)::int AS "leadCount", COUNT(DISTINCT psl.id)::int AS "ptSessionCount" FROM users u FULL JOIN trainers t ON t."userId"=u.id LEFT JOIN revenue_entries r ON (r."trainerId"=t.id OR r."consultantId"=u.id) AND r."paymentDate" BETWEEN $1 AND $2${branchId ? ' AND r."branchId" = $3' : ''} LEFT JOIN leads l ON (l."assignedTrainerId"=t.id OR l."assignedConsultantId"=u.id) AND l."createdAt"::date BETWEEN $1 AND $2${branchId ? ' AND l."branchId" = $3' : ''} LEFT JOIN pt_session_logs psl ON psl."trainerId"=t.id AND psl."sessionDate" BETWEEN $1 AND $2 GROUP BY COALESCE(t.id, u.id), COALESCE(t."trainerName", u.username, '미지정') ORDER BY "paidAmount" DESC`, branchId ? [startDate, endDate, branchId] : [startDate, endDate]);
  }
  if (name === "list_follow_up_candidates") {
    const rows = await selectOnly(`SELECT 'lead' AS type, id, name, status, "consultationDate" AS "targetDate", memo FROM leads l WHERE status IN ('pending','consulted') AND COALESCE("consultationDate", "createdAt"::date::text) BETWEEN $1 AND $2${branchClause("l", branchId, 3)} UNION ALL SELECT 'membership_expiry' AS type, id, name, status, "membershipEnd" AS "targetDate", "renewalIntent" AS memo FROM members m WHERE "membershipEnd" BETWEEN $1 AND $2 AND status='active'${branchClause("m", branchId, 3)} ORDER BY "targetDate" ASC LIMIT $${branchId ? 4 : 3}`, branchId ? [startDate, endDate, branchId, limit] : [startDate, endDate, limit]);
    return rows.map((r: any) => ({ ...r, name: maskName(r.name), note: "후보 조회 전용이며 발송 확정/자동 메시지 기능은 포함하지 않습니다." }));
  }
  if (name === "check_data_quality") {
    return selectOnly(`SELECT issue, COUNT(*)::int AS count FROM (SELECT 'member_date_reversed' issue FROM members m WHERE "membershipStart" IS NOT NULL AND "membershipEnd" IS NOT NULL AND "membershipStart" > "membershipEnd"${branchClause("m", branchId, 3)} UNION ALL SELECT 'revenue_amount_mismatch' issue FROM revenue_entries r WHERE ("paidAmount" + "unpaidAmount" + "discountAmount" - "refundAmount") <> amount AND "paymentDate" BETWEEN $1 AND $2${branchClause("r", branchId, 3)} UNION ALL SELECT 'missing_member_branch' issue FROM members m WHERE "branchId" IS NULL${branchClause("m", branchId, 3)} UNION ALL SELECT 'active_pt_overused' issue FROM pt_packages p JOIN members m ON m.id=p."memberId" WHERE p.status='active' AND p."usedSessions" > (p."totalSessions" + COALESCE(p."serviceSessions",0))${branchId ? ' AND m."branchId" = $3' : ''}) q GROUP BY issue ORDER BY count DESC LIMIT $${branchId ? 4 : 3}`, branchId ? [startDate, endDate, branchId, limit] : [startDate, endDate, limit]);
  }
  throw new Error("알 수 없는 도구입니다.");
}

function authenticate(req: Request, res: Response, next: NextFunction) {
  const token = process.env.AI_BRANCH_MANAGER_TOKEN;
  const provided = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token || token.length < 32 || provided !== token) return res.status(401).json({ error: "Unauthorized" });
  next();
}

function rateLimit(req: Request, res: Response, next: NextFunction) {
  const key = req.ip || "unknown";
  const now = Date.now();
  const bucket = requestBuckets.get(key);
  if (!bucket || bucket.resetAt <= now) requestBuckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
  else if (bucket.count >= MAX_REQUESTS_PER_MINUTE) return res.status(429).json({ error: "Too Many Requests" });
  else bucket.count += 1;
  next();
}

export function createBranchManagerMcpRouter(): Router {
  const router = express.Router();
  router.use(authenticate, rateLimit);
  router.get("/", (_req, res) => res.json({ name: "branch-manager", tools: tools.map(t => t.name), readOnly: true }));
  router.post("/", async (req, res) => {
    const body = req.body as JsonRpcRequest;
    try {
      if (body.method === "initialize") return res.json({ jsonrpc: "2.0", id: body.id, result: { protocolVersion: "2024-11-05", capabilities: { tools: {} }, serverInfo: { name: "branch-manager", version: "1.0.0" } } });
      if (body.method === "tools/list") return res.json({ jsonrpc: "2.0", id: body.id, result: { tools } });
      if (body.method === "tools/call") {
        const result = await callTool(body.params?.name, body.params?.arguments ?? {});
        return res.json({ jsonrpc: "2.0", id: body.id, result: { content: [{ type: "text", text: JSON.stringify(result) }] } });
      }
      return res.status(404).json({ jsonrpc: "2.0", id: body.id ?? null, error: { code: -32601, message: "Method not found" } });
    } catch (e: any) {
      return res.status(400).json({ jsonrpc: "2.0", id: body.id ?? null, error: { code: -32602, message: e?.message || "Invalid request" } });
    }
  });
  return router;
}
