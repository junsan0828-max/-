// 영상 업로드 + 트레이닝 일지 기록을 한 번에. 회원/트레이너 이름이 애매하면 후보만 보여주고 멈춘다.
// 실행: npm run attach-log -- "영상경로.mp4" "회원이름" "트레이너이름" "메모"
import "dotenv/config";
import { generateVideoMetadata } from "./main/youtube/metadata";
import { uploadVideo } from "./main/youtube/upload";
import { attachVideoToTrainingLog } from "./main/trainingLog";

async function main() {
  const [filePath, memberName, trainerName, ...noteParts] = process.argv.slice(2);
  const note = noteParts.join(" ") || `${memberName} 회원 운동 영상`;

  if (!filePath || !memberName || !trainerName) {
    console.error('사용법: npm run attach-log -- "영상경로.mp4" "회원이름" "트레이너이름" "메모(선택)"');
    process.exit(1);
  }

  console.log(`✍️  제목/설명 작성 중...`);
  const meta = await generateVideoMetadata(note);
  console.log(`   제목: ${meta.title}`);

  console.log(`\n📤 유튜브 업로드 중... (${filePath})`);
  const upload = await uploadVideo({ filePath, title: meta.title, description: meta.description, tags: meta.tags });
  if (!upload.ok) {
    console.error(`❌ 업로드 실패: ${upload.error}`);
    process.exit(1);
  }
  console.log(`✅ 업로드 완료: ${upload.url}`);

  console.log(`\n📓 "${memberName}" 회원의 트레이닝 일지에 기록 중... (담당: ${trainerName})`);
  const attach = await attachVideoToTrainingLog({ memberName, trainerName, note, videoUrl: upload.url! });

  if (attach.ok) {
    console.log(`✅ 트레이닝 일지에 기록 완료!`);
  } else {
    console.error(`⚠️  일지 기록 실패: ${attach.error}`);
    if (attach.candidates && attach.candidates.length > 0) {
      console.log("   후보 목록:");
      attach.candidates.forEach((c) => console.log(`   - [${c.id}] ${c.name}`));
    }
    console.log(`\n   (영상 업로드는 성공했으니 링크는 저장해두세요: ${upload.url})`);
    process.exit(1);
  }
}

main();
