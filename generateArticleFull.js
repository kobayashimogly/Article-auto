// generateArticleFull.js
import fs from "fs";
import { execSync } from "child_process";
import { validateArticleSection } from "./validateArticleSection.js";

function getLatestSectionFile(keyword, index) {
    const files = fs.readdirSync(".");
    const base = `article_section_${keyword}_${index}`;
  
    // 対象ファイルをすべて抽出
    const matched = files.filter((f) =>
      f.startsWith(base) && f.endsWith(".json")
    );
  
    if (matched.length === 0) return null;
  
    // loop番号順にソート（無印は loop0 として扱う）
    matched.sort((a, b) => {
      const getLoop = (name) => {
        const m = name.match(/_loop(\d+)\.json$/);
        return m ? parseInt(m[1]) : 0;
      };
      return getLoop(a) - getLoop(b);
    });
  
    return matched[matched.length - 1]; // 最新ファイル
  }

const safeExec = (cmd) =>
  execSync(cmd, { encoding: "utf-8", maxBuffer: 1024 * 1024 * 50 });

function exists(f) {
  return fs.existsSync(f);
}

// ====================================================
// main
// ====================================================
async function main() {
  const keyword = process.argv[2];
  if (!keyword) {
    console.log("使用例: node generateArticleFull.js \"es 大切にしている価値観\"");
    return;
  }

  const safeKw = keyword.replace(/\s+/g, "_");
  const structureFile = `structure_${safeKw}.json`;

  if (!exists(structureFile)) {
    console.log(`❌ 構成ファイルがありません: ${structureFile}`);
    return;
  }

  const structure = JSON.parse(fs.readFileSync(structureFile, "utf-8"));
  const h2Count = structure.structure.length;

  console.log(`📘 h2 ブロック数：${h2Count} 個`);

  // ============================================
  // 1つずつ本文生成 → 修正ループを実行
  // ============================================
  for (let i = 0; i < h2Count; i++) {
    console.log(`\n============================`);
    console.log(`   📍 h2ブロック ${i} 開始`);
    console.log(`============================`);

    const articleFile = `article_section_${safeKw}_${i}.json`;

    // ------------------------------------------
    // すでにファイルがあるか？
    // ------------------------------------------
    // 最新のセクションファイルを取得
    const latestFile = getLatestSectionFile(safeKw, i);
    
    if (latestFile) {
      console.log(`📄 最新の既存ファイル → ${latestFile}`);
      console.log(`🔍 バリデーションチェック中…`);
    
      const check = validateArticleSection(latestFile);
    
      if (check.ok) {
        console.log(`🎉 すでに合格 → ${latestFile}`);
        continue; // 次の h2 へ
      }
  
      console.log(`⚠️ NG → 修正ループを開始します`);
      safeExec(`node generateArticleSectionLoop.js "${keyword}" ${i}`);
      console.log(`🎉 修正完了 → h2 ${i}`);
      continue;
    }


    // ------------------------------------------
    // ファイルが無い → 初回生成からスタート
    // ------------------------------------------
    console.log(`✏️ 初回生成 → generateArticleSection.js`);
    safeExec(`node generateArticleSection.js "${keyword}" ${i}`);

    console.log(`🔧 修正ループ開始 → generateArticleSectionLoop.js`);
    safeExec(`node generateArticleSectionLoop.js "${keyword}" ${i}`);

    console.log(`🎉 h2ブロック ${i} 完了！`);
  }

  console.log(`\n============================`);
  console.log(`🎊 全ブロックの本文生成が完了しました！！`);
  console.log(`============================`);
}

main();
