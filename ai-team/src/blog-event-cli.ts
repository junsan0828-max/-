// 블로그 인증 이벤트 자동 게시 단독 테스트.
// 실행:
//   npm run blog-event    (새 블로그 글이 있으면 자이언트짐+ 이벤트로 등록, 없으면 건너뜀)
import "dotenv/config";
import { runBlogEventJob } from "./main/blogEvent";

async function main() {
  console.log("=== 블로그 인증 이벤트 등록 시작 ===\n");
  const result = await runBlogEventJob();

  if (result.skipped) {
    console.log(`⏭️  건너뜀: ${result.error} (${result.post?.title ?? ""})`);
    return;
  }
  if (!result.ok) {
    console.log(`❌ 실패: ${result.error}`);
    process.exit(1);
  }
  console.log(`✅ 이벤트 등록 완료: "${result.post?.title}"`);
  console.log(`   링크: ${result.post?.link}`);
}

main().catch((err) => {
  console.error("❌", err instanceof Error ? err.message : err);
  process.exit(1);
});
