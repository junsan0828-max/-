// 루나의 논문 리뷰 블로그 초안.
//  후보 찾기 :  npm run blog-paper -- --topic "요통과 코어 안정화 운동"
//  초안 만들기:  npm run blog-paper -- --pmcid PMC1234567
//                npm run blog-paper -- --pmid 12345678
//                npm run blog-paper -- --doi 10.1186/xxxx
//                npm run blog-paper -- --pdf "C:\논문\paper.pdf"
// 에디터 입력/발행은 하지 않는다.
import "dotenv/config";
import { findPaperCandidates, resolvePmcid, fetchFullText, draftFromPaper } from "./main/paperBlog";
import { fillBlogEditor } from "./main/blogEditor";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const topic = arg("topic");
  const pdf = arg("pdf");
  const ref = { pmcid: arg("pmcid"), pmid: arg("pmid"), doi: arg("doi") };

  if (process.argv.includes("--fill")) {
    const i = process.argv.indexOf("--fill");
    const given = process.argv[i + 1] && !process.argv[i + 1].startsWith("--") ? process.argv[i + 1] : undefined;
    console.log("✍️ 블로그 에디터에 채웁니다 (발행/예약/저장은 하지 않습니다)\n");
    const r = await fillBlogEditor(given);
    console.log(`✅ 완료: ${r.title}\n   초안: ${r.draftFile}\n   이미지 ${r.images}장, 장소 ${r.places}곳`);
    r.notes.forEach((n) => console.log("   · " + n));
    return;
  }

  if (topic) {
    console.log(`🔎 루나가 논문 후보를 찾습니다: "${topic}"\n`);
    const { query, items } = await findPaperCandidates(topic);
    console.log(`검색어: ${query}\n(최근 5년 · 체계적 문헌고찰/메타분석 · 무료 본문)\n`);
    if (!items.length) return console.log("후보가 없습니다. 주제를 바꾸거나 논문을 직접 주세요.");
    items.forEach((c, i) => {
      console.log(`[${i + 1}] ${c.title}`);
      console.log(`    ${c.authors.split(",").slice(0, 3).join(",")} 외 · ${c.journal} · ${c.year} · 인용 ${c.cited}회`);
      console.log(`    ${c.pmcid}${c.pmid ? " · PMID " + c.pmid : ""}${c.doi ? " · DOI " + c.doi : ""}\n`);
    });
    console.log('마음에 드는 논문을 고른 뒤: npm run blog-paper -- --pmcid <PMCID>');
    return;
  }

  if (pdf) {
    console.log(`📄 PDF로 초안 작성: ${pdf}\n(시간이 걸립니다)\n`);
    const r = await draftFromPaper({ pdf }, pdf.split(/[\\/]/).pop() ?? "pdf");
    console.log(`✅ 초안 저장: ${r.file}`);
    return;
  }

  if (ref.pmcid || ref.pmid || ref.doi) {
    const pmcid = await resolvePmcid(ref);
    console.log(`📄 ${pmcid} 본문을 읽고 초안을 씁니다 (구독 사용, 1~3분)\n`);
    const { text, meta } = await fetchFullText(pmcid);
    const r = await draftFromPaper({ text, meta }, pmcid);
    console.log(`✅ 초안 저장: ${r.file}\n`);
    console.log(r.preview + " ...");
    return;
  }

  console.log('사용법:\n  --topic "주제"   논문 후보 찾기\n  --pmcid/--pmid/--doi <값>   논문으로 초안 만들기\n  --pdf "경로"   PDF로 초안 만들기');
}

main().catch((err) => {
  console.error("❌", err instanceof Error ? err.message : err);
  process.exit(1);
});
