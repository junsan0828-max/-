// 급여 정산 AI — 매달 9일, 전월 트레이너 수업 정산 + 기본급을 계산해
// 구글 드라이브 급여 시트에 기록하고 대표에게 보고한다.
// 수업 정산 계산은 자이언트짐 운영관리시스템(server/routers.ts getMonthlySettlement)과 동일한 로직을 그대로 따른다.
// Neon 공식 서버리스 드라이버의 HTTP 쿼리 함수(neon()) 사용 — 일반 pg(TCP 5432)는 클라우드
// 예약실행 환경에서 막혀있고, WebSocket 기반 Pool도 그 환경 아웃바운드 프록시가 막는 것으로
// 확인됨(자세한 내용은 data.ts 주석/메모리 참고). 순수 HTTPS 요청이라 문제없이 통과함.
import { neon } from "@neondatabase/serverless";
import { findOrCreateFolder } from "./drive/archive";
import { findFileInFolder, createSpreadsheet, ensureSheetTab, writeValues, searchFiles, readAllTabs } from "./drive/drive";

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

export async function runPayroll(yearMonth: string = previousYearMonth()): Promise<PayrollResult> {
  const sql = neon(process.env.DATABASE_URL!);
  {
    const trainerRows = (await sql.query(
      `SELECT id, "trainerName" FROM trainers WHERE "trainerName" = ANY($1)`,
      [TRAINER_ORDER]
    )) as { id: number; trainerName: string }[];
    const byName = new Map(trainerRows.map((t) => [t.trainerName, t]));
    const orderedTrainers = TRAINER_ORDER.map((name) => byName.get(name)).filter(
      (t): t is { id: number; trainerName: string } => !!t
    );

    const monthStart = `${yearMonth}-01`;
    const [y, m] = yearMonth.split("-").map(Number);
    // 순수 날짜 문자열 계산만 사용한다. new Date(y, m, 1).toISOString()는 로컬 타임존을 UTC로
    // 변환하는 과정에서 KST(UTC+9) 기준 하루가 밀려 monthEnd가 "다음 달 1일"이 아니라 "이번 달
    // 마지막 날"이 되어버렸고, 그 결과 매달 말일(예: 6월 30일) 수업이 정산에서 통째로 빠졌었다.
    const nextMonth = m === 12 ? 1 : m + 1;
    const nextYear = m === 12 ? y + 1 : y;
    const monthEnd = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`;

    const issues: SettlementIssue[] = [];
    const trainers: TrainerSettlement[] = [];

    for (const trainer of orderedTrainers) {
      const rateRow = (await sql.query(
        `SELECT "settlementRate" FROM trainer_settings WHERE "trainerId" = $1 LIMIT 1`,
        [trainer.id]
      )) as { settlementRate: number }[];
      const settlementRate = rateRow[0]?.settlementRate ?? 50;

      const logs = (await sql.query(
        `SELECT l.id, l."sessionDate", l."memberId", mem.name as "memberName",
                pkg."pricePerSession", pkg."paymentAmount", pkg."totalSessions"
         FROM pt_session_logs l
         LEFT JOIN pt_packages pkg ON l."packageId" = pkg.id
         LEFT JOIN members mem ON l."memberId" = mem.id
         WHERE l."trainerId" = $1 AND l."sessionDate" >= $2 AND l."sessionDate" < $3`,
        [trainer.id, monthStart, monthEnd]
      )) as {
        id: number;
        sessionDate: string;
        memberId: number;
        memberName: string | null;
        pricePerSession: number | null;
        paymentAmount: number | null;
        totalSessions: number | null;
      }[];

      const withPrice = logs.map((l) => ({
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

/**
 * 지영이 채팅에서 급여 정산 질문에 답할 때 참고할 데이터를 모은다.
 * 운영시스템(자이언트짐+ DB)에서 실시간 계산 → 구글 드라이브에 이미 기록된 급여 시트 순으로
 * 시도한다. 하나가 실패해도(연동 안 됨 등) 나머지로 계속 진행하고, 실패 이유를 그대로 남겨
 * AI가 "데이터를 공유해달라"고 되묻는 대신 실패 사실을 정확히 전달하게 한다.
 */
export async function getPayrollChatContext(yearMonth: string = previousYearMonth()): Promise<string> {
  const parts: string[] = [];

  try {
    const result = await runPayroll(yearMonth);
    const lines = result.trainers.map(
      (t) =>
        `- ${t.trainerName}: 세션 ${t.sessionCount}건, 수업정산(세후) ${t.afterTax.toLocaleString()}원, ` +
        `기본급(세후) ${t.basePayAfterTax.toLocaleString()}원, 총 지급액 ${t.totalPay.toLocaleString()}원`
    );
    parts.push(
      `[운영시스템(자이언트짐+) 실시간 조회 — ${yearMonth} 정산]\n` +
        (lines.length ? lines.join("\n") : "해당 월 세션 기록 없음") +
        (result.issues.length ? `\n주의(오류 ${result.issues.length}건): ${result.issues.map((i) => i.detail).join(" / ")}` : "")
    );
  } catch (err: any) {
    parts.push(`[운영시스템 조회 실패] ${err?.message ?? err}`);
  }

  try {
    const year = yearMonth.slice(0, 4);
    const found = await searchFiles(`${year}년 직원 급여`);
    const file = found.find((f) => f.name === `${year}년 직원 급여`);
    if (file) {
      const tabs = await readAllTabs(file.id);
      const tab = tabs[yearMonth];
      if (tab && tab.length > 0) {
        parts.push(`[구글 드라이브 "${year}년 직원 급여" 시트 — ${yearMonth} 탭]\n` + tab.map((row) => row.join(" | ")).join("\n"));
      }
    }
  } catch (err: any) {
    parts.push(`[구글 드라이브 조회 실패] ${err?.message ?? err}`);
  }

  return parts.join("\n\n") || "운영시스템/구글 드라이브 모두 이번 달 정산 데이터를 찾지 못했습니다.";
}
