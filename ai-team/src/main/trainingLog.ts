// 트레이닝 일지에 영상 링크 첨부 — 유튜브 업로드 후 결과 링크를 회원의 운동 메모에 기록한다.
// 실수로 엉뚱한 회원에게 기록되지 않도록, 이름이 애매하면(0건/2건 이상) 실행하지 않고 후보를 보여준다.
import { Pool } from "pg";

export interface PersonMatch {
  id: number;
  name: string;
}

export interface AttachResult {
  ok: boolean;
  error?: string;
  candidates?: PersonMatch[]; // 이름이 애매할 때 후보 목록
}

function getPool(): Pool {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL이 설정되어 있지 않습니다.");
  return new Pool({ connectionString: url, ssl: url.includes("localhost") ? false : { rejectUnauthorized: false } });
}

async function findOneByName(
  pool: Pool,
  table: "members" | "trainers",
  nameColumn: string,
  name: string
): Promise<{ match?: PersonMatch; candidates: PersonMatch[] }> {
  const res = await pool.query<{ id: number; name: string }>(
    `SELECT id, "${nameColumn}" AS name FROM ${table} WHERE "${nameColumn}" ILIKE $1 ORDER BY id LIMIT 10`,
    [`%${name}%`]
  );
  if (res.rows.length === 1) return { match: res.rows[0], candidates: res.rows };
  return { match: undefined, candidates: res.rows };
}

/** 회원 이름 + 트레이너 이름으로 대상을 찾아, 애매하지 않으면 운동 메모에 링크를 기록한다. */
export async function attachVideoToTrainingLog(input: {
  memberName: string;
  trainerName: string;
  note: string;
  videoUrl: string;
}): Promise<AttachResult> {
  const pool = getPool();
  try {
    const memberResult = await findOneByName(pool, "members", "name", input.memberName);
    if (!memberResult.match) {
      return {
        ok: false,
        error:
          memberResult.candidates.length === 0
            ? `회원 "${input.memberName}"을(를) 찾지 못했습니다.`
            : `회원 이름이 여러 명과 일치해요. 정확한 이름을 알려주세요.`,
        candidates: memberResult.candidates,
      };
    }

    const trainerResult = await findOneByName(pool, "trainers", "trainerName", input.trainerName);
    if (!trainerResult.match) {
      return {
        ok: false,
        error:
          trainerResult.candidates.length === 0
            ? `트레이너 "${input.trainerName}"을(를) 찾지 못했습니다.`
            : `트레이너 이름이 여러 명과 일치해요. 정확한 이름을 알려주세요.`,
        candidates: trainerResult.candidates,
      };
    }

    const today = new Date().toISOString().slice(0, 10);
    const content = `${input.note}\n\n📹 영상: ${input.videoUrl}`;

    await pool.query(
      `INSERT INTO workout_memos ("memberId", "trainerId", "memoDate", content, "createdAt")
       VALUES ($1, $2, $3, $4, now()::text)`,
      [memberResult.match.id, trainerResult.match.id, today, content]
    );

    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  } finally {
    await pool.end();
  }
}
