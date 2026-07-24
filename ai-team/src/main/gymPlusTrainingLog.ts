// 유튜브 숏츠 제목("날짜 회원이름 운동이름")에서 회원/운동을 뽑아 짐플러스 트레이닝 일지
// (gym_plus_workout_logs)에 반영한다. 트레이너가 회원관리 화면에서 "회원 전송"을 눌렀을 때
// 만들어지는 것과 동일한 형식으로 기록해, 회원 앱에 자동으로 반영되게 한다.
// 클라우드에서도 동작해야 해서 pg Pool이 아니라 neon() HTTP 방식을 쓴다.
import { neon } from "@neondatabase/serverless";

export interface GymPlusAttachResult {
  ok: boolean;
  error?: string;
  candidates?: { id: number; name: string }[];
}

export interface ParsedShortTitle {
  memberName: string;
  exerciseName: string;
}

// 운동 이름 → 부위 매핑. 모르는 이름은 "전신"으로 처리(완전히 막히지 않게).
const BODY_PART_KEYWORDS: [RegExp, string][] = [
  [/스쿼트|런지|레그|다리|하체|힙|고관절|발차기|카프|종아리|어덕션|외전|내전/i, "하체"],
  [/벤치|체스트|가슴/i, "가슴"],
  [/렛풀|풀다운|로우|등|백|광배/i, "등"],
  [/숄더|어깨|삼각근/i, "어깨"],
  [/바이셉|트라이셉|암컬|팔|이두|삼두|덤벨컬|오버헤드|익스텐션|컬/i, "팔"],
  [/코어|복근|플랭크|크런치|골반/i, "코어"],
  [/전신|버피|점프|유산소|밸런스/i, "전신"],
];

export function inferBodyPart(exerciseName: string): string {
  for (const [pattern, part] of BODY_PART_KEYWORDS) {
    if (pattern.test(exerciseName)) return part;
  }
  return "전신";
}

/** "2026년 7월 23일 이지영 스쿼트" 같은 제목에서 날짜를 떼고 회원이름/운동이름을 뽑는다.
 * 운동이름이 없으면(제목에 이름만 있으면) 회원이름을 운동이름 자리에도 그대로 쓴다. */
export function parseShortTitle(title: string): ParsedShortTitle | null {
  const withoutDate = title.replace(/\d{4}년\s*\d{1,2}월\s*\d{1,2}일/, "").trim();
  const parts = withoutDate.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return null;
  const [memberName, ...rest] = parts;
  return { memberName, exerciseName: rest.join(" ") || memberName };
}

async function findOneGymPlusMemberByName(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sql: any,
  name: string
): Promise<{ id: number; name: string }[]> {
  return (await sql.query(`SELECT id, name FROM gym_plus_members WHERE name ILIKE $1 ORDER BY id LIMIT 10`, [
    `%${name}%`,
  ])) as { id: number; name: string }[];
}

/** 영상을 회원의 짐플러스 트레이닝 일지에 반영한다. 같은 날짜에 이미 일지가 있으면 운동종목을
 * 이어붙이고, 없으면 새로 만든다. 같은 영상 링크가 이미 들어있으면 건너뛴다(중복 방지). */
export async function attachVideoToGymPlusLog(input: {
  memberName: string;
  exerciseName: string;
  videoUrl: string;
  logDate: string; // YYYY-MM-DD
}): Promise<GymPlusAttachResult> {
  const url = process.env.DATABASE_URL;
  if (!url) return { ok: false, error: "DATABASE_URL이 설정되어 있지 않습니다." };
  const sql = neon(url);

  const candidates = await findOneGymPlusMemberByName(sql, input.memberName);
  if (candidates.length !== 1) {
    return {
      ok: false,
      error:
        candidates.length === 0
          ? `회원 "${input.memberName}"을(를) 짐플러스에서 찾지 못했습니다.`
          : `회원 이름이 여러 명과 일치합니다.`,
      candidates,
    };
  }
  const member = candidates[0];
  const bodyPart = inferBodyPart(input.exerciseName);

  type LogRow = { id: number; exercisesJson: string | null; bodyPartsJson: string | null };
  const existing = (await sql.query(
    `SELECT id, "exercisesJson", "bodyPartsJson" FROM gym_plus_workout_logs
     WHERE "gymPlusMemberId" = $1 AND "logDate" = $2 ORDER BY id DESC LIMIT 1`,
    [member.id, input.logDate]
  )) as LogRow[];

  if (existing.length > 0) {
    const row = existing[0];
    const exercises: { name: string; sets: unknown[]; videoUrl: string }[] = row.exercisesJson
      ? JSON.parse(row.exercisesJson)
      : [];
    if (exercises.some((e) => e.videoUrl === input.videoUrl)) {
      return { ok: true }; // 이미 반영됨
    }
    exercises.push({ name: input.exerciseName, sets: [], videoUrl: input.videoUrl });
    const bodyParts: string[] = row.bodyPartsJson ? JSON.parse(row.bodyPartsJson) : [];
    if (!bodyParts.includes(bodyPart)) bodyParts.push(bodyPart);

    await sql.query(
      `UPDATE gym_plus_workout_logs
       SET "exercisesJson" = $1, "bodyPartsJson" = $2, title = $3, "updatedAt" = (now())::text
       WHERE id = $4`,
      [JSON.stringify(exercises), JSON.stringify(bodyParts), `[트레이닝] ${bodyParts.join(",")}`, row.id]
    );
    return { ok: true };
  }

  const exercisesJson = JSON.stringify([{ name: input.exerciseName, sets: [], videoUrl: input.videoUrl }]);
  const bodyPartsJson = JSON.stringify([bodyPart]);
  await sql.query(
    `INSERT INTO gym_plus_workout_logs ("gymPlusMemberId", "logDate", title, "exercisesJson", "bodyPartsJson")
     VALUES ($1, $2, $3, $4, $5)`,
    [member.id, input.logDate, `[트레이닝] ${bodyPart}`, exercisesJson, bodyPartsJson]
  );
  return { ok: true };
}
