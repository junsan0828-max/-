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
  {
    dir: "sequence",
    title: "FIT STEP 시퀀스 메이커",
    description: "수업 시퀀스(운동 루틴)를 만들고 링크·PDF로 공유하세요. 운동 순서·세트·횟수·영상을 담은 전문가용 시퀀스 도구.",
    url: "https://noble-unity-production-8100.up.railway.app/sequence",
  },
  {
    dir: "before-after",
    title: "FIT STEP 비포·애프터 메이커",
    description: "비포·애프터 사진 2장과 문구를 넣으면 센터 홍보용 체형 변화 이미지를 만들어 줍니다.",
    url: "https://noble-unity-production-8100.up.railway.app/before-after",
  },
  {
    dir: "motion",
    title: "FIT STEP 모션 메카닉",
    description: "카메라로 운동 횟수를 자동으로 셉니다. 타임 어택 게임과 센터 월간 랭킹을 지원합니다.",
    url: "https://noble-unity-production-8100.up.railway.app/motion",
  },
  {
    dir: "motion-pro",
    title: "FIT STEP 모션 메카닉 전문가용",
    description: "트레이너용 측정 도구입니다. 관절별 가동범위·좌우 차이 측정과 자세 분석(상체·하체·전신·보행)을 지원합니다.",
    url: "https://noble-unity-production-8100.up.railway.app/motion-pro",
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

// 컨설팅 신청 구글 시트(Apps Script 웹 앱). 공개돼도 되는 쓰기 전용 주소.
const DEFAULT_SHEET_URL = "https://script.google.com/macros/s/AKfycbzj_BXjn1g0inRd8mC7Q59IS-xKHm77aOQf-v-x-2_QI_Pp2-C3Vix3rZ2Snfpd-BVb/exec";

// 1블록 랜딩페이지: 정적 HTML에 Supabase 접속 정보를 빌드 시점에 주입.
// serve의 "/**" rewrite가 모든 경로를 index.html로 보내므로 /academy는 main.tsx가 이 파일을 불러와 표시한다.
// .html 확장자는 cleanUrls 리다이렉트 대상이라 .htm으로 둔다.
{
  const outDir = path.join(distDir, "academy");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const landing = fs.readFileSync(path.resolve("landing/academy.html"), "utf8")
    .replace('"__SB_URL__"', JSON.stringify(process.env.VITE_SUPABASE_URL || ""))
    .replace('"__SB_KEY__"', JSON.stringify(process.env.VITE_SUPABASE_ANON_KEY || ""))
    .split('"__SHEET_URL__"').join(JSON.stringify(process.env.CONSULT_SHEET_URL || DEFAULT_SHEET_URL));
  fs.writeFileSync(path.join(outDir, "page.htm"), landing);
  console.log("✓ dist/academy/page.htm");
}

// serve.json
//
// 라우트별 rewrite를 두지 않습니다. serve가 /motion 요청에 dist/motion/index.html을
// 알아서 찾아 주므로, 위에서 만든 라우트별 HTML(제목·공유 미리보기 포함)이 그대로 쓰입니다.
//
// 예전에는 라우트별 rewrite와 함께 "/**" → "/index.html" 전체 매칭을 뒀는데,
// serve는 rewrite를 재귀로 적용해서 /motion → /motion/index.html → (다시 "/**"에 걸려)
// → /index.html 로 덮어써졌습니다. 그래서 모든 라우트가 기본 HTML을 받아
// 공유 미리보기 제목·설명이 전부 "FIT STEP 트레이닝 도구"로 나왔습니다.
//
// /academy만 예외입니다. dist/academy 에는 index.html 없이 page.htm만 있고,
// main.tsx가 그 파일을 받아서 그려야 하므로 기본 HTML로 넘겨 줍니다.
const serveConfig = {
  rewrites: [
    { source: "/academy",  destination: "/index.html" },
    { source: "/academy/", destination: "/index.html" },
  ],
  directoryListing: false,
};
fs.writeFileSync(path.join(distDir, "serve.json"), JSON.stringify(serveConfig, null, 2));
console.log("✓ dist/serve.json");
