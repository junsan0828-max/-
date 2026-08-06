import { getAuthorizedClient, listConnectedAccountIds } from "./src/main/youtube/auth";

async function main() {
  const target = process.argv[2];
  const accounts = target ? [target] : listConnectedAccountIds();
  console.log(`재인증 대상: ${accounts.join(", ")}\n`);

  for (const id of accounts) {
    console.log(`--- [${id}] 인증 중... (브라우저가 열립니다) ---`);
    try {
      await getAuthorizedClient(id);
      console.log(`✅ [${id}] 완료!\n`);
    } catch (e: any) {
      console.log(`❌ [${id}] 실패: ${e.message}\n`);
    }
  }
}

main();
