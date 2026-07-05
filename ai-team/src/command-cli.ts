// 명령창 단독 테스트. 실행: npm run command -- "이번달 매출 얼마야?"
import "dotenv/config";
import { runCommand } from "./main/commander";

async function main() {
  const instruction = process.argv.slice(2).join(" ").trim();
  if (!instruction) {
    console.error('사용법: npm run command -- "지시 내용"');
    process.exit(1);
  }
  console.log(`🧑‍💼 제이에게 지시: "${instruction}"\n`);
  const result = await runCommand(instruction);
  console.log(result.reply);
}

main();
