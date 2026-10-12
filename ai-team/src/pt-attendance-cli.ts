// PT 출석 체크 단독 실행.
// 실행:
//   npm run pt-attend -- "회원명" "YYYY-MM-DD"
//   npm run pt-attend -- --memberId 123 "YYYY-MM-DD"   (동명이인 있을 때 특정 회원으로 지정)
import "dotenv/config";
import { getSql, checkPtAttendanceByName, checkPtAttendanceForMember, branchLabel } from "./main/ptAttendance";

async function main() {
  const args = process.argv.slice(2);
  const memberIdFlagIdx = args.indexOf("--memberId");
  const sql = getSql();

  let result;
  let name = "";
  if (memberIdFlagIdx !== -1) {
    const memberId = Number(args[memberIdFlagIdx + 1]);
    const sessionDate = args.filter((a, i) => i !== memberIdFlagIdx && i !== memberIdFlagIdx + 1)[0];
    const rows = (await sql.query(
      `SELECT id, name, "branchId", "trainerId" FROM members WHERE id = $1`,
      [memberId]
    )) as { id: number; name: string; branchId: number | null; trainerId: number | null }[];
    if (rows.length === 0) {
      console.log(`❌ memberId ${memberId} 회원을 찾을 수 없습니다.`);
      process.exit(1);
    }
    name = rows[0].name;
    result = await checkPtAttendanceForMember(sql, rows[0], sessionDate);
  } else {
    name = args[0];
    const sessionDate = args[1];
    if (!name || !sessionDate) {
      console.log("사용법: npm run pt-attend -- \"회원명\" \"YYYY-MM-DD\"");
      process.exit(1);
    }
    result = await checkPtAttendanceByName(sql, name, sessionDate);
  }

  if (!result.ok) {
    if (result.needsDisambiguation) {
      console.log(`❌ "${name}" 동명이인 ${result.needsDisambiguation.length}명 — memberId로 다시 지정해주세요:`);
      for (const m of result.needsDisambiguation) {
        console.log(`  memberId ${m.id} · ${m.name} · ${branchLabel(m.branchId)}`);
      }
    } else {
      console.log(`❌ ${result.error}`);
    }
    process.exit(1);
  }

  console.log(
    `✅ ${result.member?.name} 회원님 PT 출석 기록 완료 — ${result.packageName ?? "패키지"} ${result.usedSessions}/${result.totalSessions}회 사용 (담당 트레이너 id ${result.trainerId})`
  );
}

main().catch((err) => {
  console.error("❌", err instanceof Error ? err.message : err);
  process.exit(1);
});
