import { initTRPC, TRPCError } from "@trpc/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import { getDb, pool } from "./db";
import { transferContracts, transferTerms, members } from "../drizzle/schema";
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

const DEFAULT_TERMS = `자이언트짐 양도양수 표준약관

제1조 (목적)
본 계약은 양도인이 보유한 헬스장 이용권(회원권, PT권 등)을 양수인에게 양도함에 있어 필요한 사항을 규정함을 목적으로 합니다.

제2조 (양도양수 대상)
양도인이 자이언트짐에서 보유한 이용권(헬스 회원권, PT 패키지, 운동복, 락커 등)을 양수인에게 이전합니다.

제3조 (양도조건)
① 양도인은 양수인에게 잔여 이용권을 현 상태 그대로 양도합니다.
② 양도 후 양도인의 이용권은 소멸되며, 양도인은 해당 이용권에 대한 일체의 권리를 상실합니다.
③ 양수인은 양도받은 이용권의 잔여 기간 및 횟수를 그대로 승계합니다.

제4조 (환불 불가)
양도 완료 후에는 환불이 불가능하며, 양도인과 양수인 모두 이에 동의합니다.

제5조 (개인정보 동의)
양도인 및 양수인은 본 계약과 관련하여 자이언트짐이 개인정보를 수집·이용하는 것에 동의합니다.

제6조 (효력 발생)
본 계약은 관리자가 완료 처리한 시점에 효력이 발생합니다.`;

// ── 양도 실행 핵심 함수 ────────────────────────────────────────────────────────
// 모든 활성 항목(PT 패키지·헬스기간·락커·운동복)을 양도자→양수자로 이전한다.
// 순수 데이터 이전만 담당; 계약서 status 업데이트는 호출부에서 처리한다.
async function doFullTransfer(
  transferorMemberId: number,
  transfereeMemberId: number,
  transferorName: string,
  transfereeName: string,
  now: string
): Promise<string[]> {
  const transferred: string[] = [];

  // 1. 활성 PT 패키지 전체 이전 (양도수령 패키지는 재이전 불가)
  const activePkgs = (await pool.query(
    `SELECT * FROM pt_packages WHERE "memberId" = $1 AND status = 'active' AND "transferredFromMemberId" IS NULL`,
    [transferorMemberId]
  )).rows;

  for (const pkg of activePkgs) {
    const remaining = Math.max(0, (pkg.totalSessions ?? 0) - (pkg.usedSessions ?? 0));
    const pricePerSess = pkg.pricePerSession
      ?? (pkg.paymentAmount && pkg.totalSessions ? Math.round(pkg.paymentAmount / pkg.totalSessions) : null);

    // 양수자에게 새 패키지 생성 (transferredFromMemberId로 출처 기록, 우선 사용을 위해 startDate=now)
    await pool.query(
      `INSERT INTO pt_packages
         ("memberId", "trainerId", "packageName", "totalSessions", "usedSessions",
          "paymentAmount", "pricePerSession", "startDate", "paymentMethod",
          "serviceSessions", "serviceSessionPrice", "serviceSamePrice",
          status, "transferredFromMemberId", "createdAt", "updatedAt")
       VALUES ($1,$2,$3,$4,0,$5,$6,$7,$8,$9,$10,$11,'active',$12,$13,$13)`,
      [
        transfereeMemberId, pkg.trainerId,
        `[양도수령] ${pkg.packageName ?? 'PT 패키지'}`,
        remaining,
        pricePerSess != null ? pricePerSess * remaining : null,
        pricePerSess,
        now.substring(0, 10),
        pkg.paymentMethod ?? '계좌이체',
        pkg.serviceSessions ?? 0,
        pkg.serviceSessionPrice ?? 0,
        pkg.serviceSamePrice ?? 0,
        transferorMemberId,
        now,
      ]
    );

    // 원본 패키지 양도완료 표시 (기록 보존)
    await pool.query(
      `UPDATE pt_packages SET status = 'transferred', "packageName" = $1, "updatedAt" = $2 WHERE id = $3`,
      [`[양도완료→${transfereeName}] ${pkg.packageName ?? 'PT 패키지'}`, now, pkg.id]
    );

    transferred.push(`PT: ${pkg.packageName ?? 'PT 패키지'} 잔여 ${remaining}회`);
  }

  // 2. 헬스 기간 이전 (양수자가 기존 헬스 기간이 없거나 더 늦게 끝나는 경우에만 덮어씀)
  const transferorMemberRow = (await pool.query(
    `SELECT "membershipStart", "membershipEnd" FROM members WHERE id = $1`,
    [transferorMemberId]
  )).rows[0];

  if (transferorMemberRow?.membershipEnd) {
    const transfereeRow = (await pool.query(
      `SELECT "membershipEnd" FROM members WHERE id = $1`,
      [transfereeMemberId]
    )).rows[0];
    const shouldCopy = !transfereeRow?.membershipEnd
      || transferorMemberRow.membershipEnd > transfereeRow.membershipEnd;

    if (shouldCopy) {
      await pool.query(
        `UPDATE members SET "membershipStart" = $1, "membershipEnd" = $2, "updatedAt" = $3 WHERE id = $4`,
        [transferorMemberRow.membershipStart, transferorMemberRow.membershipEnd, now, transfereeMemberId]
      );
      transferred.push(`헬스권: ~${transferorMemberRow.membershipEnd}`);
    }
  }

  // 3. 락커 이전
  const lockerResult = await pool.query(
    `UPDATE lockers SET "memberId" = $1, "memberName" = $2, "updatedAt" = $3
     WHERE "memberId" = $4 RETURNING "lockerNumber"`,
    [transfereeMemberId, transfereeName, now, transferorMemberId]
  );
  if ((lockerResult.rowCount ?? 0) > 0) {
    transferred.push(`락커: ${lockerResult.rows.map((r: any) => r.lockerNumber).join(', ')}`);
  }

  // 4. 착용 중인 운동복 이전
  const uniformResult = await pool.query(
    `UPDATE uniforms SET "memberId" = $1, "memberName" = $2, "updatedAt" = $3
     WHERE "memberId" = $4 AND "isActive" = 1 RETURNING id`,
    [transfereeMemberId, transfereeName, now, transferorMemberId]
  );
  if ((uniformResult.rowCount ?? 0) > 0) {
    transferred.push(`운동복 ${uniformResult.rowCount}벌`);
  }

  // 5. 양도자 → 양도마감 처리
  await pool.query(
    `UPDATE members SET status = '양도마감', "updatedAt" = $1 WHERE id = $2`,
    [now, transferorMemberId]
  );

  return transferred;
}

// ── 양수자 확보 (기존 회원 조회 or 신규 생성) ──────────────────────────────────
async function resolveTransferee(params: {
  transfereeMemberId?: number | null;
  transfereeName?: string | null;
  transfereePhone?: string | null;
  transfereeBirthDate?: string | null;
  transferorMemberId: number;
  contractId: number;
  now: string;
}): Promise<{ transfereeMemberId: number; transfereeName: string }> {
  const { now, contractId } = params;

  // 1. 이미 회원 ID가 있으면 바로 이름 조회
  if (params.transfereeMemberId) {
    const row = (await pool.query(`SELECT name FROM members WHERE id = $1`, [params.transfereeMemberId])).rows[0];
    return {
      transfereeMemberId: params.transfereeMemberId,
      transfereeName: row?.name ?? params.transfereeName ?? "양수인",
    };
  }

  // 2. 전화번호로 기존 회원 검색
  if (params.transfereePhone) {
    const digitsOnly = params.transfereePhone.replace(/\D/g, "");
    const existing = (await pool.query(
      `SELECT id, name FROM members WHERE regexp_replace(phone, '[^0-9]', '', 'g') = $1 LIMIT 1`,
      [digitsOnly]
    )).rows[0];
    if (existing) {
      await pool.query(
        `UPDATE transfer_contracts SET "transfereeMemberId" = $1 WHERE id = $2`,
        [existing.id, contractId]
      );
      return { transfereeMemberId: existing.id, transfereeName: existing.name };
    }
  }

  // 3. 신규 회원 생성
  const transferorRow = (await pool.query(
    `SELECT "branchId", "trainerId" FROM members WHERE id = $1`,
    [params.transferorMemberId]
  )).rows[0];

  let branchId = transferorRow?.branchId ?? null;
  if (!branchId && transferorRow?.trainerId) {
    const tb = (await pool.query(
      `SELECT "branchId" FROM trainer_branches WHERE "trainerId" = $1 LIMIT 1`,
      [transferorRow.trainerId]
    )).rows[0];
    branchId = tb?.branchId ?? null;
  }
  if (!branchId) {
    const fb = (await pool.query(`SELECT "branchId" FROM trainer_branches LIMIT 1`)).rows[0];
    branchId = fb?.branchId ?? null;
  }

  const newName = params.transfereeName ?? "양수인";
  const mr = (await pool.query(
    `INSERT INTO members ("branchId", "trainerId", name, phone, "birthDate", status, "profileNote", "createdAt", "updatedAt")
     VALUES ($1,$2,$3,$4,$5,'active',$6,$7,$7) RETURNING id`,
    [
      branchId, transferorRow?.trainerId ?? null, newName,
      params.transfereePhone ?? null, params.transfereeBirthDate ?? null,
      `양도양수 계약으로 등록 (계약서 ID: ${contractId})`, now,
    ]
  )).rows[0];

  if (!mr) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "양수인 회원 생성 실패" });

  await pool.query(
    `UPDATE transfer_contracts SET "transfereeMemberId" = $1 WHERE id = $2`,
    [mr.id, contractId]
  );

  return { transfereeMemberId: mr.id, transfereeName: newName };
}

export const transferRouter = t.router({
  // 약관 조회 (없으면 기본값 반환)
  getTerms: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    const rows = await db.select().from(transferTerms).limit(1);
    if (rows[0]) return rows[0];
    return { id: 0, content: DEFAULT_TERMS, updatedAt: new Date().toISOString() };
  }),

  // 약관 수정
  updateTerms: protectedProcedure
    .input(z.object({ content: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const now = new Date().toISOString();
      const existing = await db.select({ id: transferTerms.id }).from(transferTerms).limit(1);
      if (existing[0]) {
        const [updated] = await db
          .update(transferTerms)
          .set({ content: input.content, updatedAt: now })
          .where(eq(transferTerms.id, existing[0].id))
          .returning();
        return updated;
      } else {
        const [inserted] = await db
          .insert(transferTerms)
          .values({ content: input.content, updatedAt: now })
          .returning();
        return inserted;
      }
    }),

  // 양도양수 계약 생성 → 즉시 전체 이전 완료 (서명 불필요)
  createTransfer: protectedProcedure
    .input(z.object({
      transferorMemberId: z.number(),
      itemType: z.enum(["pt_package", "membership", "uniform", "locker"]).optional(),
      itemId: z.number().optional(),
      itemDescription: z.string().optional(),
      transfereeMemberId: z.number().optional(),
      transfereeName: z.string().optional(),
      transfereePhone: z.string().optional(),
      transfereeBirthDate: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const transferorRows = await db
        .select({ name: members.name, phone: members.phone })
        .from(members)
        .where(eq(members.id, input.transferorMemberId))
        .limit(1);

      if (!transferorRows[0]) {
        throw new TRPCError({ code: "NOT_FOUND", message: "양도인 회원을 찾을 수 없습니다." });
      }
      const transferor = transferorRows[0];

      const termsRows = await db.select({ content: transferTerms.content }).from(transferTerms).limit(1);
      const termsSnapshot = termsRows[0]?.content ?? DEFAULT_TERMS;

      const token = randomUUID();
      const now = new Date().toISOString();

      // 양수자 확보
      const { transfereeMemberId, transfereeName } = await resolveTransferee({
        transfereeMemberId: input.transfereeMemberId,
        transfereeName: input.transfereeName,
        transfereePhone: input.transfereePhone,
        transfereeBirthDate: input.transfereeBirthDate,
        transferorMemberId: input.transferorMemberId,
        contractId: 0, // 계약서 생성 전 임시; INSERT 후 업데이트
        now,
      });

      // 계약서 기록 (완료 상태로 바로 저장)
      const [contract] = await db
        .insert(transferContracts)
        .values({
          token,
          status: "completed",
          transferorMemberId: input.transferorMemberId,
          transferorName: transferor.name,
          transferorPhone: transferor.phone ?? null,
          transfereeMemberId,
          transfereeName,
          transfereePhone: input.transfereePhone ?? null,
          transfereeBirthDate: input.transfereeBirthDate ?? null,
          itemType: input.itemType ?? "pt_package",
          itemId: input.itemId ?? null,
          itemDescription: input.itemDescription ?? "전체 항목 양도",
          termsSnapshot,
          createdAt: now,
          completedAt: now,
        })
        .returning();

      // 전체 항목 이전 실행
      const transferred = await doFullTransfer(
        input.transferorMemberId,
        transfereeMemberId,
        transferor.name,
        transfereeName,
        now
      );

      return {
        id: contract.id,
        token: contract.token,
        transferred,
        transfereeMemberId,
        transfereeName,
      };
    }),

  // 계약서 조회 (토큰 기반, 서명 제외)
  getContract: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ input }) => {
      const result = await pool.query(
        'SELECT * FROM transfer_contracts WHERE token = $1',
        [input.token]
      );
      const contract = result.rows[0];
      if (!contract) throw new TRPCError({ code: "NOT_FOUND", message: "계약서를 찾을 수 없습니다." });

      const { transferorSignature, transfereeSignature, ...safe } = contract;
      return {
        ...safe,
        transferorSigned: !!transferorSignature,
        transfereeSigned: !!transfereeSignature,
      };
    }),

  // 서명 제출 (하위 호환 유지 — 기존 pending 계약서용)
  signContract: publicProcedure
    .input(z.object({
      token: z.string(),
      role: z.enum(["transferor", "transferee"]),
      signerName: z.string().min(1),
      signerPhone: z.string().optional(),
      signature: z.string().min(1),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const rows = await db
        .select()
        .from(transferContracts)
        .where(eq(transferContracts.token, input.token))
        .limit(1);

      const contract = rows[0];
      if (!contract) throw new TRPCError({ code: "NOT_FOUND", message: "계약서를 찾을 수 없습니다." });

      const now = new Date().toISOString();

      if (input.role === "transferor") {
        if (contract.status !== "pending_transferor") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "양도인 서명 단계가 아닙니다." });
        }
        await db
          .update(transferContracts)
          .set({
            transferorSignature: input.signature,
            transferorSignedAt: now,
            transferorName: input.signerName,
            status: "pending_transferee",
          })
          .where(eq(transferContracts.token, input.token));
      } else {
        if (contract.status !== "pending_transferee") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "양수인 서명 단계가 아닙니다." });
        }
        await db
          .update(transferContracts)
          .set({
            transfereeSignature: input.signature,
            transfereeSignedAt: now,
            transfereeName: input.signerName,
            ...(input.signerPhone ? { transfereePhone: input.signerPhone } : {}),
            status: "completed",
            completedAt: now,
          })
          .where(eq(transferContracts.token, input.token));

        const { transfereeMemberId, transfereeName } = await resolveTransferee({
          transfereeMemberId: contract.transfereeMemberId ?? null,
          transfereeName: input.signerName,
          transfereePhone: input.signerPhone ?? contract.transfereePhone,
          transfereeBirthDate: contract.transfereeBirthDate,
          transferorMemberId: contract.transferorMemberId,
          contractId: contract.id,
          now,
        });

        await doFullTransfer(
          contract.transferorMemberId,
          transfereeMemberId,
          contract.transferorName ?? "양도인",
          transfereeName,
          now
        );
      }

      return { success: true };
    }),

  // 관리자 강제 완료 (pending 상태 기존 계약서용)
  adminCompleteTransfer: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const contract = (await pool.query(
        `SELECT * FROM transfer_contracts WHERE id = $1`,
        [input.id]
      )).rows[0];
      if (!contract) throw new TRPCError({ code: "NOT_FOUND", message: "계약서를 찾을 수 없습니다." });
      if (contract.status === "completed") throw new TRPCError({ code: "BAD_REQUEST", message: "이미 완료된 계약서입니다." });
      if (contract.status === "cancelled") throw new TRPCError({ code: "BAD_REQUEST", message: "취소된 계약서입니다." });

      const now = new Date().toISOString();

      const { transfereeMemberId, transfereeName } = await resolveTransferee({
        transfereeMemberId: contract.transfereeMemberId,
        transfereeName: contract.transfereeName,
        transfereePhone: contract.transfereePhone,
        transfereeBirthDate: contract.transfereeBirthDate,
        transferorMemberId: contract.transferorMemberId,
        contractId: contract.id,
        now,
      });

      const transferred = await doFullTransfer(
        contract.transferorMemberId,
        transfereeMemberId,
        contract.transferorName ?? "양도인",
        transfereeName,
        now
      );

      await pool.query(
        `UPDATE transfer_contracts SET status = 'completed', "completedAt" = $1, "transfereeMemberId" = $2 WHERE id = $3`,
        [now, transfereeMemberId, contract.id]
      );

      return { success: true, transferred, transfereeMemberId };
    }),

  // 내 양도양수 목록 (회원별)
  getMyTransfers: protectedProcedure
    .input(z.object({ memberId: z.number() }))
    .query(async ({ input }) => {
      const memberRow = (await pool.query(
        `SELECT phone FROM members WHERE id = $1`,
        [input.memberId]
      )).rows[0];
      const digitsOnly = (memberRow?.phone ?? "").replace(/\D/g, "");

      const rows = await pool.query(
        `SELECT id, token, status, "transferorMemberId", "transferorName", "transfereeMemberId",
                "transfereeName", "itemType", "itemDescription", "createdAt", "completedAt",
                "transferorSignedAt", "transfereeSignedAt"
         FROM transfer_contracts
         WHERE "transferorMemberId" = $1
            OR "transfereeMemberId" = $1
            OR ("transfereeMemberId" IS NULL AND $2 != '' AND regexp_replace("transfereePhone", '[^0-9]', '', 'g') = $2)
         ORDER BY "createdAt" DESC`,
        [input.memberId, digitsOnly]
      );

      return rows.rows;
    }),

  // 양도 취소
  cancelTransfer: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const rows = await db
        .select({ id: transferContracts.id, status: transferContracts.status })
        .from(transferContracts)
        .where(eq(transferContracts.id, input.id))
        .limit(1);

      if (!rows[0]) throw new TRPCError({ code: "NOT_FOUND", message: "계약서를 찾을 수 없습니다." });
      if (rows[0].status === "completed") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "완료된 계약서는 취소할 수 없습니다." });
      }

      await db
        .update(transferContracts)
        .set({ status: "cancelled" })
        .where(eq(transferContracts.id, input.id));

      return { success: true };
    }),

  // 완료된 계약 중 양수인 회원 미생성 건 즉시 보정 (하위 호환)
  fixMissingTransferees: protectedProcedure.mutation(async () => {
    const fixed: string[] = [];
    const errors: string[] = [];
    const completedContracts = await pool.query(
      `SELECT id, "transferorMemberId", "transfereeMemberId", "transfereeName",
              "transfereePhone", "transfereeBirthDate", "itemType", "itemId", "completedAt"
       FROM transfer_contracts
       WHERE status = 'completed' AND "transfereeMemberId" IS NULL AND "transfereeName" IS NOT NULL`
    );
    for (const contract of completedContracts.rows) {
      try {
        const now = new Date().toISOString();
        const { transfereeMemberId } = await resolveTransferee({
          transfereeMemberId: null,
          transfereeName: contract.transfereeName,
          transfereePhone: contract.transfereePhone,
          transfereeBirthDate: contract.transfereeBirthDate,
          transferorMemberId: contract.transferorMemberId,
          contractId: contract.id,
          now,
        });
        fixed.push(`${contract.transfereeName} → memberId ${transfereeMemberId}`);
      } catch (e: any) {
        errors.push(`${contract.transfereeName}: ${e.message}`);
      }
    }
    // 이미 완료된 계약의 양도인들도 "양도마감" 처리
    await pool.query(
      `UPDATE members SET status = '양도마감', "updatedAt" = NOW()::text
       WHERE id IN (
         SELECT DISTINCT "transferorMemberId" FROM transfer_contracts WHERE status = 'completed' AND "transferorMemberId" IS NOT NULL
       ) AND status NOT IN ('양도마감', 'ended')`
    );

    return { fixed, errors };
  }),
});
