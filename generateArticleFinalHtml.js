// generateArticleFinalHtml.js
import fs from "fs";

function exists(path) {
  return fs.existsSync(path);
}

async function main() {
  const keyword = process.argv[2];

  if (!keyword) {
    console.log("使用例: node generateArticleFinalHtml.js \"es 大切にしている価値観\"");
    return;
  }

  const safeKw = keyword.replace(/\s+/g, "_");
  const structureFile = `structure_${safeKw}.json`;

  if (!exists(structureFile)) {
    console.log(`❌ 構成案ファイルがありません: ${structureFile}`);
    return;
  }

  const structure = JSON.parse(fs.readFileSync(structureFile, "utf-8"));
  const h2Count = structure.structure.length;

  console.log(`📘 h2 ブロック数：${h2Count} 個`);
  console.log(`📎 各 final HTML を統合します…`);

  let finalHtmlParts = [];

  for (let i = 0; i < h2Count; i++) {
    const finalFile = `article_section_${safeKw}_${i}_final.html`;

    console.log(`\n🔍 チェック中: ${finalFile}`);

    if (!exists(finalFile)) {
      console.log(`❌ final HTML がありません → ${finalFile}`);
      console.log(`⚠️ 全文統合不可のため終了します`);
      return;
    }

    console.log(`📄 読み込み → OK`);
    const blockHtml = fs.readFileSync(finalFile, "utf-8");
    finalHtmlParts.push(blockHtml);
  }

  // 🔥 全部つなげた HTML を作成
  const fullHtml = `

${finalHtmlParts.join("\n\n")}

  `.trim();

  const outputName = `${safeKw}.html`;
  fs.writeFileSync(outputName, fullHtml);

  console.log(`\n==============================`);
  console.log(`🎉 最終HTMLを統合しました → ${outputName}`);
  console.log(`==============================`);
}

main();
