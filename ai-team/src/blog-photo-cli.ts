// 직접 촬영한 사진을 규칙대로 저장한다.
//  원본만 보관 :  npm run blog-photo -- --file "C:\사진\a.jpg"
//  승인 등록   :  npm run blog-photo -- --file "C:\사진\모자이크완료.png" --approved --scene "렛풀다운 자세를 손으로 잡아주는 지도 모습"
//  (폴더째)    :  npm run blog-photo -- --file "C:\사진\폴더" --approved --scene "..."
import "dotenv/config";
import { savePhotos } from "./main/blogPhotos";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const file = arg("file");
if (!file) {
  console.log('사용법: npm run blog-photo -- --file "경로" [--approved --scene "장면 설명"]');
  process.exit(1);
}
const results = savePhotos([file], { scene: arg("scene"), approved: process.argv.includes("--approved") });
for (const r of results) {
  console.log(`${r.status === "error" ? "❌" : "✅"} ${r.source}\n   ${r.note}`);
  if (r.original) console.log(`   원본: ${r.original}`);
  if (r.approvedFile) console.log(`   승인: ${r.approvedFile}`);
}
