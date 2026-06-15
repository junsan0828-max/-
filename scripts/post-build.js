import fs from "fs";
import path from "path";

const distDir = path.resolve("dist");
const mainHtml = fs.readFileSync(path.join(distDir, "index.html"), "utf8");

const routes = [
  {
    dir: "posture",
    title: "FIT STEP 체형 분석 라인 드로잉",
    description: "사진 위에 선을 그어 체형을 분석하세요. 수평·수직·각도선으로 자세 분석 후 PNG로 저장.",
    url: "https://noble-unity-production-8100.up.railway.app/posture",
  },
  {
    dir: "admin",
    title: "어드민 대시보드 · FIT STEP",
    description: "FIT STEP 서비스 관리자 페이지",
    url: "https://noble-unity-production-8100.up.railway.app/admin",
  },
];

for (const { dir, title, description, url } of routes) {
  const outDir = path.join(distDir, dir);
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  let html = mainHtml
    .replace(/<title>.*?<\/title>/, `<title>${title}</title>`)
    .replace(/<meta name="description"[^>]*>/, `<meta name="description" content="${description}" />`)
    .replace(/<meta property="og:title"[^>]*>/, `<meta property="og:title" content="${title}" />`)
    .replace(/<meta property="og:description"[^>]*>/, `<meta property="og:description" content="${description}" />`)
    .replace(/<meta property="og:url"[^>]*>/, `<meta property="og:url" content="${url}" />`)
    .replace(/<meta name="twitter:title"[^>]*>/, `<meta name="twitter:title" content="${title}" />`)
    .replace(/<meta name="twitter:description"[^>]*>/, `<meta name="twitter:description" content="${description}" />`);

  fs.writeFileSync(path.join(outDir, "index.html"), html);
  console.log(`✓ dist/${dir}/index.html`);
}
