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
  {
    dir: "contract",
    title: "FIT STEP 전자 회원 계약서",
    description: "FIT STEP 헬스장 회원 계약서. 계약 내역·약관·서명을 포함한 전자 계약서를 인쇄하거나 공유하세요.",
    url: "https://noble-unity-production-8100.up.railway.app/contract",
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

// serve.json: 라우트별 HTML 매핑 (SPA 모드 대신 명시적 rewrite)
const serveConfig = {
  rewrites: [
    { source: "/posture",  destination: "/posture/index.html" },
    { source: "/admin",    destination: "/admin/index.html" },
    { source: "/contract", destination: "/contract/index.html" },
    { source: "/**",       destination: "/index.html" },
  ],
};
fs.writeFileSync(path.join(distDir, "serve.json"), JSON.stringify(serveConfig, null, 2));
console.log("✓ dist/serve.json");
