// 직접 촬영한 사진을 규칙대로 저장한다.
//  자동 모자이크 :  npm run blog-photo -- --file "C:\사진\a.jpg" --mosaic
//                   → 원본 보관 + 사진_모자이크확인 폴더에 결과. 눈으로 확인한 뒤 아래로 승인 등록.
//  원본만 보관   :  npm run blog-photo -- --file "C:\사진\a.jpg"
//  승인 등록     :  npm run blog-photo -- --file "C:\...\사진_모자이크확인\원본_..._모자이크.jpg" --approved --scene "렛풀다운 자세를 손으로 잡아주는 지도 모습"
//  (폴더째도 가능)
import "dotenv/config";
import { savePhotos, mosaicPhoto } from "./main/blogPhotos";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const file = arg("file");
if (!file) {
  console.log('사용법: npm run blog-photo -- --file "경로" [--mosaic | --approved --scene "장면 설명"]');
  process.exit(1);
}

if (process.argv.includes("--mosaic")) {
  const r = mosaicPhoto(file);
  const icon = r.status === "error" ? "❌" : r.status === "no_face" ? "⚠️" : "✅";
  console.log(`${icon} ${r.source}\n   ${r.note}`);
  if (r.original) console.log(`   원본: ${r.original}`);
  if (r.output) {
    console.log(`   모자이크 결과(확인용): ${r.output}`);
    console.log(`   문제없으면: npm run blog-photo -- --file "${r.output}" --approved --scene "장면 설명"`);
  }
  process.exit(r.status === "error" ? 1 : 0);
}

const results = savePhotos([file], { scene: arg("scene"), approved: process.argv.includes("--approved") });
for (const r of results) {
  console.log(`${r.status === "error" ? "❌" : "✅"} ${r.source}\n   ${r.note}`);
  if (r.original) console.log(`   원본: ${r.original}`);
  if (r.approvedFile) console.log(`   승인: ${r.approvedFile}`);
}
