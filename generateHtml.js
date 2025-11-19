// generateHtml.js
import fs from "fs";

// ====================================================
// 最新の article_section ファイルを取得
// ====================================================
function getLatestSectionFile(keyword, index) {
  const files = fs.readdirSync(".");
  const base = `article_section_${keyword}_${index}`;

  const matched = files.filter(
    (f) => f.startsWith(base) && f.endsWith(".json")
  );

  if (matched.length === 0) return null;

  matched.sort((a, b) => {
    const getLoop = (name) => {
      const m = name.match(/_loop(\d+)\.json$/);
      return m ? parseInt(m[1]) : 0;
    };
    return getLoop(a) - getLoop(b);
  });

  return matched[matched.length - 1];
}

// ====================================================
// 「。」ごとに <p></p> に分割
// ====================================================
function toParagraphs(text) {
  return text
    .split(/。+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0)
    .map((t) => `<p>${t}。</p>`)
    .join("\n");
}

// ====================================================
// HTML 生成
// ====================================================
function createHtmlFromSection(json) {
  const { h2, intro, h3 } = json;

  let html = "";

  // h2
  html += `<h2>${h2}</h2>\n`;

  // intro（段落化）
  html += `${toParagraphs(intro)}\n\n`;

  // h3ブロック
  h3.forEach((block) => {
    html += `<h3>${block.title}</h3>\n`;
    html += `${toParagraphs(block.content)}\n\n`;
  });

  return html;
}

// ====================================================
// main
// ====================================================
async function main() {
  const keyword = process.argv[2];
  const index = Number(process.argv[3]);

  if (!keyword || Number.isNaN(index)) {
    console.log(
      "使用例: node generateHtml.js \"es 大切にしている価値観\" 0"
    );
    return;
  }

  const safeKw = keyword.replace(/\s+/g, "_");

  const latestFile = getLatestSectionFile(safeKw, index);
  if (!latestFile) {
    console.log(`❌ 生成済みの本文JSONがありません: index=${index}`);
    return;
  }

  console.log(`📄 読み込み: ${latestFile}`);

  const json = JSON.parse(fs.readFileSync(latestFile, "utf-8"));

  const html = createHtmlFromSection(json);

  const outFile = `article_section_${safeKw}_${index}.html`;
  fs.writeFileSync(outFile, html);

  console.log(`✅ HTML生成 → ${outFile}`);
}

main();
