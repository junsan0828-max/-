import { initTRPC, TRPCError } from "@trpc/server";
import { z } from "zod";
import { eq, desc } from "drizzle-orm";
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
본 계약은 양도인과 양수인의 전자서명이 완료된 시점에 효력이 발생합니다.`;

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

  // 양도양수 계약서 생성
  createTransfer: protectedProcedure
    .input(z.object({
      transferorMemberId: z.number(),
      itemType: z.enum(["pt_package", "membership", "uniform", "locker"]),
      itemId: z.number().optional(),
      itemDescription: z.string().min(1),
      transfereeMemberId: z.number().optional(),
      transfereeName: z.string().optional(),
      transfereePhone: z.string().optional(),
      transfereeBirthDate: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // 양도인 정보 조회
      const transferorRows = await db
        .select({ name: members.name, phone: members.phone })
        .from(members)
        .where(eq(members.id, input.transferorMemberId))
        .limit(1);

      if (!transferorRows[0]) {
        throw new TRPCError({ code: "NOT_FOUND", message: "양도인 회원을 찾을 수 없습니다." });
      }

      const transferor = transferorRows[0];

      // 현재 약관 스냅샷
      const termsRows = await db.select({ content: transferTerms.content }).from(transferTerms).limit(1);
      const termsSnapshot = termsRows[0]?.content ?? DEFAULT_TERMS;

      const token = randomUUID();
      const now = new Date().toISOString();

      const [contract] = await db
        .insert(transferContracts)
        .values({
          token,
          status: "pending_transferor",
          transferorMemberId: input.transferorMemberId,
          transferorName: transferor.name,
          transferorPhone: transferor.phone ?? null,
          transfereeMemberId: input.transfereeMemberId ?? null,
          transfereeName: input.transfereeName ?? null,
          transfereePhone: input.transfereePhone ?? null,
          transfereeBirthDate: input.transfereeBirthDate ?? null,
          itemType: input.itemType,
          itemId: input.itemId ?? null,
          itemDescription: input.itemDescription,
          termsSnapshot,
          createdAt: now,
        })
        .returning();

      return {
        id: contract.id,
        token: contract.token,
        contractUrl: `/transfer/${contract.token}`,
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

  // 서명 제출
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

        // Get transferor's branchId to assign to the new transferee member
        const transferorResult = await pool.query(
          'SELECT "branchId", "trainerId" FROM members WHERE id = $1',
          [contract.transferorMemberId]
        );
        const transferorMember = transferorResult.rows[0];

        if (transferorMember) {
          let transfereeMemberId: number | null = contract.transfereeMemberId ?? null;

          // Create a member record for the transferee if one doesn't exist yet
          if (!transfereeMemberId) {
            // branchId가 NULL이면 trainer_branches에서 조회
            let branchId = transferorMember.branchId;
            if (!branchId && transferorMember.trainerId) {
              const tbResult = await pool.query(
                'SELECT "branchId" FROM trainer_branches WHERE "trainerId" = $1 LIMIT 1',
                [transferorMember.trainerId]
              );
              branchId = tbResult.rows[0]?.branchId ?? null;
            }

            const memberResult = await pool.query(
              `INSERT INTO members ("branchId", "trainerId", name, phone, "birthDate", status, memo, "createdAt", "updatedAt")
               VALUES ($1, $2, $3, $4, $5, 'active', $6, $7, $7)
               RETURNING id`,
              [
                branchId,
                transferorMember.trainerId ?? null,
                input.signerName,
                contract.transfereePhone ?? null,
                contract.transfereeBirthDate ?? null,
                `양도양수 계약으로 등록 (계약서 ID: ${contract.id})`,
                now,
              ]
            );
            if (memberResult.rows[0]) {
              transfereeMemberId = memberResult.rows[0].id as number;
              await pool.query(
                'UPDATE transfer_contracts SET "transfereeMemberId" = $1 WHERE token = $2',
                [transfereeMemberId, input.token]
              );
            }
          }

          // Transfer the item to the new transferee member
          if (transfereeMemberId && contract.itemId) {
            if (contract.itemType === "pt_package") {
              await pool.query('UPDATE pt_packages SET "memberId" = $1 WHERE id = $2', [transfereeMemberId, contract.itemId]);
            } else if (contract.itemType === "membership") {
              await pool.query('UPDATE memberships SET "memberId" = $1 WHERE id = $2', [transfereeMemberId, contract.itemId]);
            } else if (contract.itemType === "locker") {
              await pool.query(
                'UPDATE lockers SET "memberId" = $1, "memberName" = $2 WHERE id = $3',
                [transfereeMemberId, input.signerName, contract.itemId]
              );
            } else if (contract.itemType === "uniform") {
              await pool.query(
                'UPDATE uniforms SET "memberId" = $1, "memberName" = $2 WHERE id = $3',
                [transfereeMemberId, input.signerName, contract.itemId]
              );
            }
          }
        }
      }

      return { success: true };
    }),

  // 관리자 진단용: 모든 양도양수 계약 조회
  debugContracts: protectedProcedure.query(async () => {
    const result = await pool.query(
      `SELECT id, status, "transferorName", "transferorMemberId",
              "transfereeName", "transfereeMemberId", "transfereePhone",
              "completedAt", "createdAt"
       FROM transfer_contracts ORDER BY "createdAt" DESC LIMIT 50`
    );
    return result.rows;
  }),

  // 완료된 계약 중 양수인 회원 미생성 건 즉시 보정 (회원관리 페이지 로드 시 호출)
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
        const transferorResult = await pool.query(
          'SELECT "branchId", "trainerId" FROM members WHERE id = $1',
          [contract.transferorMemberId]
        );
        const tm = transferorResult.rows[0];

        // 양도인 회원 없으면 첫 번째 지점으로 폴백
        let branchId = tm?.branchId ?? null;
        let trainerId = tm?.trainerId ?? null;
        if (!branchId) {
          const tbr = await pool.query('SELECT "branchId" FROM trainer_branches LIMIT 1');
          branchId = tbr.rows[0]?.branchId ?? null;
        }
        if (!trainerId && branchId) {
          const trr = await pool.query('SELECT "trainerId" FROM trainer_branches WHERE "branchId" = $1 LIMIT 1', [branchId]);
          trainerId = trr.rows[0]?.trainerId ?? null;
        }

        const now = new Date().toISOString();
        const mr = await pool.query(
          `INSERT INTO members ("branchId", "trainerId", name, phone, "birthDate", status, memo, "createdAt", "updatedAt")
           VALUES ($1,$2,$3,$4,$5,'active',$6,$7,$7) RETURNING id`,
          [branchId, trainerId, contract.transfereeName, contract.transfereePhone ?? null,
           contract.transfereeBirthDate ?? null,
           `양도양수 계약으로 등록 (계약서 ID: ${contract.id})`, now]
        );
        if (mr.rows[0]) {
          const tid = mr.rows[0].id;
          await pool.query('UPDATE transfer_contracts SET "transfereeMemberId" = $1 WHERE id = $2', [tid, contract.id]);
          if (contract.itemId) {
            if (contract.itemType === "pt_package") await pool.query('UPDATE pt_packages SET "memberId" = $1 WHERE id = $2', [tid, contract.itemId]);
            else if (contract.itemType === "membership") await pool.query('UPDATE memberships SET "memberId" = $1 WHERE id = $2', [tid, contract.itemId]);
            else if (contract.itemType === "locker") await pool.query('UPDATE lockers SET "memberId" = $1, "memberName" = $2 WHERE id = $3', [tid, contract.transfereeName, contract.itemId]);
            else if (contract.itemType === "uniform") await pool.query('UPDATE uniforms SET "memberId" = $1, "memberName" = $2 WHERE id = $3', [tid, contract.transfereeName, contract.itemId]);
          }
          fixed.push(contract.transfereeName);
        } else {
          errors.push(`${contract.transfereeName}: INSERT 결과 없음`);
        }
      } catch (e: any) {
        errors.push(`${contract.transfereeName}: ${e.message}`);
      }
    }
    return { fixed, errors };
  }),

  // 내 양도양수 목록 (회원별)
  getMyTransfers: protectedProcedure
    .input(z.object({ memberId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const rows = await pool.query(
        `SELECT id, token, status, "transferorMemberId", "transferorName", "transfereeMemberId",
                "transfereeName", "itemType", "itemDescription", "createdAt", "completedAt",
                "transferorSignedAt", "transfereeSignedAt"
         FROM transfer_contracts
         WHERE "transferorMemberId" = $1 OR "transfereeMemberId" = $1
         ORDER BY "createdAt" DESC`,
        [input.memberId]
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
});
