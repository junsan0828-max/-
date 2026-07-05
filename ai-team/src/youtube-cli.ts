// 유튜브 업로드 단독 테스트. 실행: npm run youtube -- "영상경로.mp4" "영상 주제"
import "dotenv/config";
import { generateVideoMetadata } from "./main/youtube/metadata";
import { uploadVideo } from "./main/youtube/upload";

async function main() {
  const [filePath, ...rest] = process.argv.slice(2);
  const topicHint = rest.join(" ").trim();

  if (!filePath) {
    console.error('사용법: npm run youtube -- "영상경로.mp4" "영상 주제 (선택)"');
    process.exit(1);
  }

  console.log(`✍️  제목/설명 작성 중... (${topicHint || "주제 미지정"})`);
  const meta = await generateVideoMetadata(topicHint || filePath.split(/[\\/]/).pop() || "운동 영상");
  console.log(`   제목: ${meta.title}`);
  console.log(`   태그: ${meta.tags.join(", ")}`);

  console.log(`\n📤 업로드 중... (${filePath})`);
  const result = await uploadVideo({
    filePath,
    title: meta.title,
    description: meta.description,
    tags: meta.tags,
  });

  if (result.ok) {
    console.log(`\n✅ 업로드 완료: ${result.url}`);
  } else {
    console.error(`\n❌ 업로드 실패: ${result.error}`);
    process.exit(1);
  }
}

main();
