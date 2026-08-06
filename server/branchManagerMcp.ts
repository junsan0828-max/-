import type { Request, Response, NextFunction, Router } from "express";
import express from "express";
import { createPublicKey, verify as verifySignature } from "crypto";
import { pool } from "./db";

const WINDOW_MS = 60_000;
const configuredRateLimit = Number(process.env.AI_BRANCH_MANAGER_RATE_LIMIT_PER_MINUTE);
const MAX_REQUESTS_PER_MINUTE =
  Number.isInteger(configuredRateLimit) && configuredRateLimit > 0 ? configuredRateLimit : 30;
const requestBuckets = new Map<string, { count: number; resetAt: number }>();

const MCP_RESOURCE_URL = (process.env.AI_BRANCH_MANAGER_RESOURCE_URL || "https://remarkable-tenderness-production.up.railway.app/mcp/branch-manager").replace(/\/$/, "");
const AUTH0_ISSUER = (process.env.AI_BRANCH_MANAGER_AUTH0_ISSUER || "").replace(/\/$/, "");
const OAUTH_AUDIENCE = process.env.AI_BRANCH_MANAGER_OAUTH_AUDIENCE || MCP_RESOURCE_URL;
const OAUTH_SCOPE = process.env.AI_BRANCH_MANAGER_OAUTH_SCOPE || "branch-manager:read";
const RESOURCE_METADATA_URL = new URL("/.well-known/oauth-protected-resource", MCP_RESOURCE_URL).toString();
const JWKS_CACHE_MS = 15 * 60_000;
type Jwk = Record<string, unknown> & { kid?: string; use?: string };
let jwksCache: { keys: Jwk[]; expiresAt: number } | null = null;

type JsonRpcRequest = { jsonrpc?: string; id?: string | number | null; method?: string; params?: any };
type ToolDef = { name: string; description: string; inputSchema: Record<string, unknown> };
type JwtPayload = { iss?: string; aud?: string | string[]; exp?: number; nbf?: number; scope?: string; permissions?: string[]; sub?: string };

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

function exposedTools() {
  return tools.map(tool => ({
    ...tool,
    securitySchemes: [{ type: "oauth2", scopes: [OAUTH_SCOPE] }],
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  }));
}

export function getBranchManagerProtectedResourceMetadata() {
  return {
    resource: MCP_RESOURCE_URL,
    authorization_servers: AUTH0_ISSUER ? [AUTH0_ISSUER] : [],
    scopes_supported: [OAUTH_SCOPE],
    bearer_methods_supported: ["header"],
  };
}

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

function withMetadata<T>(data: T, startDate: string, endDate: string, branchId: number | null, sourceTables: string[]) {
  return {
    generatedAt: new Date().toISOString(),
    period: { startDate, endDate },
    branchId,
    sourceTables,
    data,
  };
}

async function callTool(name: string, params: any) {
  const { startDate, endDate, branchId, limit } = validateDateRange(params);
  if (name === "get_operational_kpi_summary") {
    const branch = branchClause("r", branchId, 3);
    const [revenue, members, leads] = await Promise.all([
      selectOnly(`SELECT COALESCE(SUM("paidAmount"),0)::int AS "paidAmount", COALESCE(SUM("unpaidAmount"),0)::int AS "unpaidAmount", COUNT(*)::int AS count, COUNT(*) FILTER (WHERE "subType"='신규')::int AS "newCount", COUNT(*) FILTER (WHERE "subType"='재등록')::int AS "renewalCount" FROM revenue_entries r WHERE r."paymentDate" BETWEEN $1 AND $2 AND r."subType" IS DISTINCT FROM '이전'${branch}`, branchId ? [startDate, endDate, branchId] : [startDate, endDate]),
      selectOnly(`SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE status='active')::int AS active, COUNT(*) FILTER (WHERE "membershipEnd" BETWEEN $1 AND $2)::int AS expiring FROM members m WHERE 1=1${branchClause("m", branchId, 3)}`, branchId ? [startDate, endDate, branchId] : [startDate, endDate]),
      selectOnly(`SELECT status, COUNT(*)::int AS count FROM leads l WHERE l."createdAt"::date BETWEEN $1 AND $2${branchClause("l", branchId, 3)} GROUP BY status ORDER BY status`, branchId ? [startDate, endDate, branchId] : [startDate, endDate]),
    ]);
    return withMetadata({ revenue: revenue[0], members: members[0], leadsByStatus: leads }, startDate, endDate, branchId, ["revenue_entries", "members", "leads"]);
  }
  if (name === "list_expiring_health_memberships") {
    const rows = await selectOnly(`SELECT m.id, m.name, m.status, m."membershipStart", m."membershipEnd", t."trainerName", b.name AS "branchName" FROM members m LEFT JOIN trainers t ON t.id=m."trainerId" LEFT JOIN branches b ON b.id=m."branchId" WHERE m.status='active' AND m."membershipEnd" BETWEEN $1 AND $2${branchClause("m", branchId, 3)} ORDER BY m."membershipEnd" ASC LIMIT $${branchId ? 4 : 3}`, branchId ? [startDate, endDate, branchId, limit] : [startDate, endDate, limit]);
    return withMetadata(rows.map((r: any) => ({ ...r, name: maskName(r.name) })), startDate, endDate, branchId, ["members", "trainers", "branches"]);
  }
  if (name === "get_staff_performance") {
    const rows = await selectOnly(`
      WITH staff AS (
        SELECT 'trainer'::text AS "staffType", t.id AS "staffId", t."trainerName" AS "staffName"
        FROM trainers t
        UNION ALL
        SELECT 'user'::text AS "staffType", u.id AS "staffId", u.username AS "staffName"
        FROM users u
        WHERE u.role <> 'trainer' OR NOT EXISTS (SELECT 1 FROM trainers t WHERE t."userId"=u.id)
      ), revenue_by_staff AS (
        SELECT 'trainer'::text AS "staffType", r."trainerId" AS "staffId", COUNT(*)::int AS "salesCount", COALESCE(SUM(r."paidAmount"),0)::int AS "paidAmount", COALESCE(SUM(r.sessions),0)::int AS sessions
        FROM revenue_entries r
        WHERE r."trainerId" IS NOT NULL AND r."paymentDate" BETWEEN $1 AND $2 AND r."subType" IS DISTINCT FROM '이전'${branchClause("r", branchId, 3)}
        GROUP BY r."trainerId"
        UNION ALL
        SELECT 'user'::text AS "staffType", r."consultantId" AS "staffId", COUNT(*)::int AS "salesCount", COALESCE(SUM(r."paidAmount"),0)::int AS "paidAmount", COALESCE(SUM(r.sessions),0)::int AS sessions
        FROM revenue_entries r
        WHERE r."consultantId" IS NOT NULL AND r."paymentDate" BETWEEN $1 AND $2 AND r."subType" IS DISTINCT FROM '이전'${branchClause("r", branchId, 3)}
        GROUP BY r."consultantId"
      ), leads_by_staff AS (
        SELECT 'trainer'::text AS "staffType", l."assignedTrainerId" AS "staffId", COUNT(*)::int AS "leadCount"
        FROM leads l
        WHERE l."assignedTrainerId" IS NOT NULL AND l."createdAt"::date BETWEEN $1 AND $2${branchClause("l", branchId, 3)}
        GROUP BY l."assignedTrainerId"
        UNION ALL
        SELECT 'user'::text AS "staffType", l."assignedConsultantId" AS "staffId", COUNT(*)::int AS "leadCount"
        FROM leads l
        WHERE l."assignedConsultantId" IS NOT NULL AND l."createdAt"::date BETWEEN $1 AND $2${branchClause("l", branchId, 3)}
        GROUP BY l."assignedConsultantId"
      ), sessions_by_staff AS (
        SELECT 'trainer'::text AS "staffType", psl."trainerId" AS "staffId", COUNT(*)::int AS "ptSessionCount"
        FROM pt_session_logs psl
        JOIN members m ON m.id=psl."memberId"
        WHERE psl."sessionDate" BETWEEN $1 AND $2${branchClause("m", branchId, 3)}
        GROUP BY psl."trainerId"
      )
      SELECT s."staffType", s."staffId", s."staffName",
        COALESCE(r."salesCount",0)::int AS "salesCount",
        COALESCE(r."paidAmount",0)::int AS "paidAmount",
        COALESCE(r.sessions,0)::int AS sessions,
        COALESCE(l."leadCount",0)::int AS "leadCount",
        COALESCE(ps."ptSessionCount",0)::int AS "ptSessionCount"
      FROM staff s
      LEFT JOIN revenue_by_staff r ON r."staffType"=s."staffType" AND r."staffId"=s."staffId"
      LEFT JOIN leads_by_staff l ON l."staffType"=s."staffType" AND l."staffId"=s."staffId"
      LEFT JOIN sessions_by_staff ps ON ps."staffType"=s."staffType" AND ps."staffId"=s."staffId"
      ORDER BY "paidAmount" DESC, s."staffName" ASC
    `, branchId ? [startDate, endDate, branchId] : [startDate, endDate]);
    return withMetadata(rows, startDate, endDate, branchId, ["users", "trainers", "revenue_entries", "leads", "pt_session_logs", "members"]);
  }
  if (name === "list_follow_up_candidates") {
    const rows = await selectOnly(`SELECT 'lead' AS type, id, name, status, "consultationDate" AS "targetDate" FROM leads l WHERE status IN ('pending','consulted') AND COALESCE("consultationDate", "createdAt"::date::text) BETWEEN $1 AND $2${branchClause("l", branchId, 3)} UNION ALL SELECT 'membership_expiry' AS type, id, name, status, "membershipEnd" AS "targetDate" FROM members m WHERE "membershipEnd" BETWEEN $1 AND $2 AND status='active'${branchClause("m", branchId, 3)} ORDER BY "targetDate" ASC LIMIT $${branchId ? 4 : 3}`, branchId ? [startDate, endDate, branchId, limit] : [startDate, endDate, limit]);
    return withMetadata(rows.map((r: any) => ({ ...r, name: maskName(r.name), note: "후보 조회 전용이며 발송 확정/자동 메시지 기능은 포함하지 않습니다." })), startDate, endDate, branchId, ["leads", "members"]);
  }
  if (name === "check_data_quality") {
    const rows = await selectOnly(`SELECT issue, COUNT(*)::int AS count FROM (SELECT 'member_date_reversed' issue FROM members m WHERE "membershipStart" IS NOT NULL AND "membershipEnd" IS NOT NULL AND "membershipStart" > "membershipEnd"${branchClause("m", branchId, 3)} UNION ALL SELECT 'revenue_amount_mismatch' issue FROM revenue_entries r WHERE ("paidAmount" + "unpaidAmount" + "discountAmount" - "refundAmount") <> amount AND r."subType" IS DISTINCT FROM '환불' AND r."subType" IS DISTINCT FROM '이전' AND r."subType" IS DISTINCT FROM '미수금' AND "paymentDate" BETWEEN $1 AND $2${branchClause("r", branchId, 3)} UNION ALL SELECT 'missing_member_branch' issue FROM members m WHERE "branchId" IS NULL${branchClause("m", branchId, 3)} UNION ALL SELECT 'active_pt_overused' issue FROM pt_packages p JOIN members m ON m.id=p."memberId" WHERE p.status='active' AND p."usedSessions" > (p."totalSessions" + COALESCE(p."serviceSessions",0))${branchId ? ' AND m."branchId" = $3' : ''}) q GROUP BY issue ORDER BY count DESC LIMIT $${branchId ? 4 : 3}`, branchId ? [startDate, endDate, branchId, limit] : [startDate, endDate, limit]);
    return withMetadata(rows, startDate, endDate, branchId, ["members", "revenue_entries", "pt_packages"]);
  }
  throw new Error("알 수 없는 도구입니다.");
}

function unauthorized(res: Response, message = "Unauthorized") {
  res.setHeader("WWW-Authenticate", `Bearer resource_metadata="${RESOURCE_METADATA_URL}", scope="${OAUTH_SCOPE}"`);
  return res.status(401).json({ error: message });
}

function decodeBase64UrlJson<T>(value: string): T {
  return JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as T;
}

async function getJwks(): Promise<Jwk[]> {
  const now = Date.now();
  if (jwksCache && jwksCache.expiresAt > now) return jwksCache.keys;
  if (!AUTH0_ISSUER) throw new Error("OAuth issuer is not configured");
  const response = await fetch(`${AUTH0_ISSUER}/.well-known/jwks.json`, { headers: { accept: "application/json" } });
  if (!response.ok) throw new Error("Unable to load OAuth signing keys");
  const body = await response.json() as { keys?: Jwk[] };
  if (!Array.isArray(body.keys) || body.keys.length === 0) throw new Error("OAuth signing keys are unavailable");
  jwksCache = { keys: body.keys, expiresAt: now + JWKS_CACHE_MS };
  return body.keys;
}

async function verifyOAuthToken(token: string): Promise<JwtPayload> {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Invalid token format");
  const header = decodeBase64UrlJson<{ alg?: string; kid?: string }>(parts[0]);
  const payload = decodeBase64UrlJson<JwtPayload>(parts[1]);
  if (header.alg !== "RS256" || !header.kid) throw new Error("Unsupported token algorithm");
  const keys = await getJwks();
  const jwk = keys.find(key => key.kid === header.kid && (!key.use || key.use === "sig"));
  if (!jwk) throw new Error("Unknown signing key");
  const publicKey = createPublicKey({ key: jwk as any, format: "jwk" });
  const signed = Buffer.from(`${parts[0]}.${parts[1]}`);
  const signature = Buffer.from(parts[2], "base64url");
  if (!verifySignature("RSA-SHA256", signed, publicKey, signature)) throw new Error("Invalid token signature");

  const now = Math.floor(Date.now() / 1000);
  if (payload.iss !== `${AUTH0_ISSUER}/`) throw new Error("Invalid token issuer");
  const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!audiences.includes(OAUTH_AUDIENCE)) throw new Error("Invalid token audience");
  if (!payload.exp || payload.exp <= now) throw new Error("Expired token");
  if (payload.nbf && payload.nbf > now + 30) throw new Error("Token is not active");
  const granted = new Set([...(payload.scope || "").split(/\s+/).filter(Boolean), ...(payload.permissions || [])]);
  if (!granted.has(OAUTH_SCOPE)) throw new Error("Missing read scope");
  return payload;
}

async function authenticate(req: Request, res: Response): Promise<boolean> {
  const provided = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!provided) {
    unauthorized(res);
    return false;
  }

  const legacyToken = process.env.AI_BRANCH_MANAGER_TOKEN;
  if (legacyToken && legacyToken.length >= 32 && provided === legacyToken) return true;

  try {
    await verifyOAuthToken(provided);
    return true;
  } catch (error) {
    console.warn("Branch manager OAuth rejected:", error instanceof Error ? error.message : error);
    unauthorized(res);
    return false;
  }
}

function rateLimit(req: Request, res: Response, next: NextFunction) {
  const key = req.ip || "unknown";
  const now = Date.now();
  for (const [bucketKey, bucket] of requestBuckets) {
    if (bucket.resetAt <= now) requestBuckets.delete(bucketKey);
  }
  const bucket = requestBuckets.get(key);
  if (!bucket) requestBuckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
  else if (bucket.count >= MAX_REQUESTS_PER_MINUTE) return res.status(429).json({ error: "Too Many Requests" });
  else bucket.count += 1;
  next();
}

export function createBranchManagerMcpRouter(): Router {
  const router = express.Router();
  router.use(rateLimit);
  router.get("/", (_req, res) => res.json({ name: "branch-manager", tools: tools.map(t => t.name), readOnly: true, authentication: "oauth2" }));
  router.post("/", async (req, res) => {
    const body = req.body as JsonRpcRequest;
    try {
      if (body.method === "initialize") return res.json({ jsonrpc: "2.0", id: body.id, result: { protocolVersion: "2024-11-05", capabilities: { tools: {} }, serverInfo: { name: "branch-manager", version: "1.1.0" } } });
      if (body.method === "tools/list") return res.json({ jsonrpc: "2.0", id: body.id, result: { tools: exposedTools() } });
      if (body.method === "tools/call") {
        if (!(await authenticate(req, res))) return;
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
