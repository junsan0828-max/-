// 컨설턴트 "데이터 기록 > 광고" 탭(client/src/pages/ConsultantDataRecord.tsx — 아직 별도 브랜치
// claude/gym-management-system-OnTMC에만 있지만, DB 테이블(ad_data_entries)은 이미 프로덕션에
// 배포돼 fcmanager 계정이 실사용 중)에 파워링크·플레이스 데이터를 매주 금요일에 자동으로
// 채워 넣는다. 대표 지시(2026-09-03): 검색광고 요약행/당근/블로그는 건드리지 않고, 파워링크·
// 플레이스만, 매주 금요일에만 자동화 — 나머지 요일과 나머지 채널은 fcmanager가 계속 손으로 입력.
import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import { getNaverAdsAccounts, fetchRangeSummary } from "./naverAds";
import { todayStr } from "./autoMessage";

// ad_data_entries.createdBy — 이 값으로 입력된 행만 컨설턴트 화면에 "내 기록"으로 보인다.
// fcmanager(컨설턴트 계정, user id 13)가 지금 매일 손으로 입력 중인 바로 그 계정이다
// (2026-09-03 DB 조회로 확인). 다른 계정으로 쓰면 "마케팅 > 광고 채널 성과"의 getAdSummary가
// createdBy 구분 없이 그냥 SUM하기 때문에 숫자가 이중집계된다 — 반드시 같은 계정을 써야 한다.
const CONSULTANT_USER_ID = 13;

const TARGET_CHANNELS = ["파워링크", "플레이스"] as const;

async function ensureAdDataTable(sql: NeonQueryFunction<false, false>) {
  await sql.query(`
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
    )
  `);
}

export interface AdDataSyncResult {
  ok: boolean;
  error?: string;
  date?: string;
  written?: { channel: string; impressions: number; clicks: number }[];
}

// 오늘(금요일) 두 지점(ziantgym1+dreamfitt) 네이버 검색광고 API에서 파워링크·플레이스 노출·클릭을
// 합산해 컨설턴트 데이터 기록에 upsert한다. visits/inquiries/notes는 사람이 입력하는 값이라
// 건드리지 않는다(최초 생성 시에만 0/NULL로 시작, 이후 갱신은 impressions/clicks만 갱신).
export async function runAdDataSyncJob(): Promise<AdDataSyncResult> {
  const url = process.env.DATABASE_URL;
  if (!url) return { ok: false, error: "DATABASE_URL이 설정되어 있지 않습니다." };
  const accounts = getNaverAdsAccounts();
  if (accounts.length === 0) return { ok: false, error: "등록된 네이버 검색광고 계정이 없습니다." };

  const sql = neon(url);
  await ensureAdDataTable(sql);

  const today = todayStr();
  const totals: Record<(typeof TARGET_CHANNELS)[number], { impressions: number; clicks: number }> = {
    파워링크: { impressions: 0, clicks: 0 },
    플레이스: { impressions: 0, clicks: 0 },
  };

  for (const account of accounts) {
    const summary = await fetchRangeSummary(account, today, today);
    for (const channel of TARGET_CHANNELS) {
      const bucket = summary.byType[channel];
      if (!bucket) continue;
      totals[channel].impressions += bucket.impressions;
      totals[channel].clicks += bucket.clicks;
    }
  }

  const now = new Date().toISOString();
  const written: NonNullable<AdDataSyncResult["written"]> = [];
  for (const channel of TARGET_CHANNELS) {
    const { impressions, clicks } = totals[channel];
    await sql.query(
      `INSERT INTO ad_data_entries (date, channel, impressions, clicks, visits, inquiries, "createdBy", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, 0, 0, $5, $6, $6)
       ON CONFLICT ON CONSTRAINT ad_unique_date_channel_user
       DO UPDATE SET impressions = $3, clicks = $4, "updatedAt" = $6`,
      [today, channel, impressions, clicks, CONSULTANT_USER_ID, now]
    );
    written.push({ channel, impressions, clicks });
  }

  return { ok: true, date: today, written };
}
