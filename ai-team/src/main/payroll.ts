// 급여 정산 AI — 매달 9일, 전월 트레이너 수업 정산 + 기본급을 계산해
// 구글 드라이브 급여 시트에 기록하고 대표에게 보고한다.
// 수업 정산 계산은 자이언트짐 운영관리시스템(server/routers.ts getMonthlySettlement)과 동일한 로직을 그대로 따른다.
import { Pool } from "pg";
import { findOrCreateFolder } from "./drive/archive";
import { findFileInFolder, createSpreadsheet, ensureSheetTab, writeValues } from "./drive/drive";

// 이준산은 대표 본인이라 급여 정산 대상에서 제외한다.
const TRAINER_ORDER = ["최성길", "김현석", "김나연", "민문무"];

/** 기본급이 있는 트레이너만 기재. 나머지는 기본급 0원(없음)으로 처리. */
const BASE_PAY: Record<string, number> = {
  최성길: 1_500_000,
  김현석: 1_000_000,
  민문무: 1_200_000,
};

const WITHHOLDING_RATE = 0.033; // 3.3% 사업소득 원천징수

export interface TrainerSettlement {
  trainerId: number;
  trainerName: string;
  sessionCount: number;
  revenue: number;
  settlementRate: number;
  settlementAmount: number; // 3.3% 공제 전 수업 정산액
  afterTax: number; // 3.3% 공제 후 수업 정산액 (급여 시트 "수업 정산" 칸에 쓰는 값)
  basePay: number;
  basePayWithholding: number;
  basePayAfterTax: number;
  totalPay: number;
}

export interface SettlementIssue {
  trainerName: string;
  type: "zero_price" | "duplicate";
  detail: string;
}

export interface PayrollResult {
  yearMonth: string;
  issues: SettlementIssue[];
  trainers: TrainerSettlement[];
  /** 데이터 자체가 없어 이번 실행에서 자동 점검하지 못한 항목 (참고용, 사람이 별도 확인 필요) */
  uncheckable: string[];
}

const UNCHECKABLE_ITEMS = [
  "취소 수업 포함 여부 (세션 기록에 취소 상태값 없음)",
  "삭제된 수업 포함 여부 (삭제 이력이 남지 않는 구조)",
  "회원 변경 후 단가 미적용 여부 (변경 이력 테이블 없음)",
  "트레이너 변경 오류 여부 (변경 이력 테이블 없음)",
];

/** 오늘 기준 "전월" (YYYY-MM). 7월에 실행하면 6월을 반환. */
export function previousYearMonth(date = new Date()): string {
  const d = new Date(date.getFullYear(), date.getMonth() - 1, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function getPool() {
  return new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
}

export async function runPayroll(yearMonth: string = previousYearMonth()): Promise<PayrollResult> {
  const pool = getPool();
  try {
    const trainerRows = await pool.query<{ id: number; trainerName: string }>(
      `SELECT id, "trainerName" FROM trainers WHERE "trainerName" = ANY($1)`,
      [TRAINER_ORDER]
    );
    const byName = new Map(trainerRows.rows.map((t) => [t.trainerName, t]));
    const orderedTrainers = TRAINER_ORDER.map((name) => byName.get(name)).filter(
      (t): t is { id: number; trainerName: string } => !!t
    );

    const monthStart = `${yearMonth}-01`;
    const [y, m] = yearMonth.split("-").map(Number);
    const monthEnd = new Date(y, m, 1).toISOString().slice(0, 10);

    const issues: SettlementIssue[] = [];
    const trainers: TrainerSettlement[] = [];

    for (const trainer of orderedTrainers) {
      const rateRow = await pool.query<{ settlementRate: number }>(
        `SELECT "settlementRate" FROM trainer_settings WHERE "trainerId" = $1 LIMIT 1`,
        [trainer.id]
      );
      const settlementRate = rateRow.rows[0]?.settlementRate ?? 50;

      const logs = await pool.query<{
        id: number;
        sessionDate: string;
        memberId: number;
        memberName: string | null;
        pricePerSession: number | null;
        paymentAmount: number | null;
        totalSessions: number | null;
      }>(
        `SELECT l.id, l."sessionDate", l."memberId", mem.name as "memberName",
                pkg."pricePerSession", pkg."paymentAmount", pkg."totalSessions"
         FROM pt_session_logs l
         LEFT JOIN pt_packages pkg ON l."packageId" = pkg.id
         LEFT JOIN members mem ON l."memberId" = mem.id
         WHERE l."trainerId" = $1 AND l."sessionDate" >= $2 AND l."sessionDate" < $3`,
        [trainer.id, monthStart, monthEnd]
      );

      const withPrice = logs.rows.map((l) => ({
        ...l,
        effectivePrice: l.pricePerSession
          ? l.pricePerSession
          : l.paymentAmount && l.totalSessions
          ? Math.round(l.paymentAmount / l.totalSessions)
          : 0,
      }));

      for (const l of withPrice.filter((l) => l.effectivePrice === 0)) {
        issues.push({
          trainerName: trainer.trainerName,
          type: "zero_price",
          detail: `${l.sessionDate} ${l.memberName ?? "이름없음"} — 단가 0원 (패키지 단가 정보 없음)`,
        });
      }

      const byMemberDate = new Map<string, number>();
      for (const l of withPrice) {
        const key = `${l.memberId}|${l.sessionDate}`;
        byMemberDate.set(key, (byMemberDate.get(key) ?? 0) + 1);
      }
      for (const [key, count] of byMemberDate) {
        if (count <= 1) continue;
        const [, sessionDate] = key.split("|");
        const memberName = withPrice.find((l) => `${l.memberId}|${l.sessionDate}` === key)?.memberName ?? "이름없음";
        issues.push({
          trainerName: trainer.trainerName,
          type: "duplicate",
          detail: `${sessionDate} ${memberName} — 같은 날짜에 세션 ${count}건 (중복 정산 의심)`,
        });
      }

      const revenue = withPrice.reduce((s, l) => s + l.effectivePrice, 0);
      const settlementAmount = Math.round((revenue * settlementRate) / 100);
      const afterTax = Math.round(settlementAmount * (1 - WITHHOLDING_RATE));
      const basePay = BASE_PAY[trainer.trainerName] ?? 0;
      const basePayAfterTax = Math.round(basePay * (1 - WITHHOLDING_RATE));

      trainers.push({
        trainerId: trainer.id,
        trainerName: trainer.trainerName,
        sessionCount: withPrice.length,
        revenue,
        settlementRate,
        settlementAmount,
        afterTax,
        basePay,
        basePayWithholding: basePay - basePayAfterTax,
        basePayAfterTax,
        totalPay: afterTax + basePayAfterTax,
      });
    }

    return { yearMonth, issues, trainers, uncheckable: UNCHECKABLE_ITEMS };
  } finally {
    await pool.end();
  }
}

/**
 * 오류가 없을 때만 호출한다. 구글 드라이브 "자이언트짐 > 직원 급여" 폴더에
 * "YYYY년 직원 급여" 파일(연도별로 하나)을 만들고, "YYYY-MM" 탭에 정산 결과를 써넣는다.
 */
export async function writePayrollSheet(result: PayrollResult): Promise<{ url: string }> {
  const rootId = await findOrCreateFolder("자이언트짐");
  const folderId = await findOrCreateFolder("직원 급여", rootId);

  const year = result.yearMonth.slice(0, 4);
  const fileName = `${year}년 직원 급여`;
  let fileId = await findFileInFolder(fileName, folderId);
  if (!fileId) {
    fileId = await createSpreadsheet(fileName, folderId);
  }

  await ensureSheetTab(fileId, result.yearMonth);

  const header = ["트레이너", "수업 정산", "기본급", "기본급 3.3% 공제", "지급 기본급", "총 지급액", "비고"];
  const rows = result.trainers.map((t) => [
    t.trainerName,
    t.afterTax,
    t.basePay,
    t.basePayWithholding,
    t.basePayAfterTax,
    t.totalPay,
    t.basePay === 0 ? "기본급 없음" : "",
  ]);
  await writeValues(fileId, `'${result.yearMonth}'!A1`, [header, ...rows]);

  return { url: `https://docs.google.com/spreadsheets/d/${fileId}/edit` };
}
