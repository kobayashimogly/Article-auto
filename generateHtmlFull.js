// generateHtmlFull.js
import fs from "fs";
import { execSync } from "child_process";

function safeExec(cmd) {
  return execSync(cmd, {
    encoding: "utf-8",
    maxBuffer: 1024 * 1024 * 100,
  });
}

function exists(f) {
  return fs.existsSync(f);
}

// ========================================================
// 最新のHTMLファイルを探す（loop番号順）
// ========================================================
function getLatestHtml(keyword, index) {
  const files = fs.readdirSync(".");
  const base = `article_section_${keyword}_${index}`;

  const matched = files.filter((f) =>
    f.startsWith(base) && f.endsWith(".html")
  );
  if (matched.length === 0) return null;

  matched.sort((a, b) => {
    const getLoop = (name) => {
      const m = name.match(/_loop(\d+)\.html$/);
      return m ? parseInt(m[1]) : 0;
    };
    return getLoop(a) - getLoop(b);
  });

  return matched[matched.length - 1];
}

// ========================================================
// main
// ========================================================
async function main() {
  const keyword = process.argv[2];

  if (!keyword) {
    console.log("使用例: node generateHtmlFull.js \"es 大切にしている価値観\"");
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
  console.log("HTML最終生成ループを開始します…");

  // ======================================================
  // 各ブロック処理
  // ======================================================
  for (let i = 0; i < h2Count; i++) {
    console.log(`\n============================`);
    console.log(`   📍 HTML h2ブロック ${i} 開始`);
    console.log(`============================`);

    const finalFile = `article_section_${safeKw}_${i}_final.html`;

    // ====================================================
    // ① final があれば完全スキップ！
    // ====================================================
    if (exists(finalFile)) {
      console.log(`🎉 final が存在 → ${finalFile}`);
      console.log(`⏩ スキップして次のブロックへ`);
      continue;
    }

    // ====================================================
    // ② 最新のHTMLを探す
    // ====================================================
    let latestHtml = getLatestHtml(safeKw, i);

    if (latestHtml) {
      console.log(`📄 既存HTML検出 → ${latestHtml}`);
      console.log(`🔍 generateHtmlLoop.js による検証＆修正開始`);

      safeExec(`node generateHtmlLoop.js "${keyword}" ${i}`);

      console.log(`🎉 HTMLブロック ${i} 完了！（final 生成済み）`);
      continue;
    }

    // ====================================================
    // ③ HTMLがひとつもない場合 → generateHtml.js から
    // ====================================================
    const baseHtml = `article_section_${safeKw}_${i}.html`;

    if (!exists(baseHtml)) {
      console.log(`⚠️ HTMLファイルがありません → ${baseHtml}`);
      console.log(`✏️ generateHtml.js で初回作成します`);
      safeExec(`node generateHtml.js "${keyword}" ${i}`);
    }

    console.log(`🔧 初回HTMLの修正ループ → generateHtmlLoop.js`);
    safeExec(`node generateHtmlLoop.js "${keyword}" ${i}`);

    console.log(`🎉 HTMLブロック ${i} 完了！`);
  }

  console.log(`\n============================`);
  console.log(`🎊 全HTMLブロックが final 化されました！！`);
  console.log(`============================`);
}

main();
