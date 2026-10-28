/**
 * PNG 아이콘 생성 스크립트
 * 실행: node scripts/generate-icons.js
 * 필요: npm install sharp -g  또는  npx sharp-cli
 */
const sharp = require("sharp");
const path = require("path");
const fs = require("fs");

const svgPath = path.join(__dirname, "../client/public/icon-512.svg");
const outDir = path.join(__dirname, "../client/public/icons");

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];

async function generate() {
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const svgBuffer = fs.readFileSync(svgPath);
  for (const size of sizes) {
    const outPath = path.join(outDir, `icon-${size}.png`);
    await sharp(svgBuffer)
      .resize(size, size)
      .png()
      .toFile(outPath);
    console.log(`✅ icon-${size}.png 생성`);
  }
  console.log("🎉 아이콘 생성 완료!");
}

generate().catch(console.error);
