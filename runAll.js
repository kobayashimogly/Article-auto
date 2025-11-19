// runAll.js
import { execSync } from "child_process";

function safeExec(cmd) {
  console.log(`\n▶️ 実行: ${cmd}`);
  return execSync(cmd, { encoding: "utf-8", maxBuffer: 1024 * 1024 * 200 });
}

async function main() {
  const keyword = process.argv[2];

  if (!keyword) {
    console.log("使用例: node runAll.js \"es 大切にしている価値観\"");
    return;
  }

  console.log(`
========================================
🚀 全自動 SEO記事生成フルパイプライン開始
========================================
`);

  // ① 競合スクレイピング（SerpAPI）
  safeExec(`node scrapeAll.js "${keyword}"`);

  // ② 構成案生成（JSONループ修正込み）
  safeExec(`node generateStructureLoop.js "${keyword}"`);

  // ③ 本文生成（全h2）＋自動修正ループ
  safeExec(`node generateArticleFull.js "${keyword}"`);

  // ④ HTML変換 + 下線挿入（全ブロック）
  safeExec(`node generateHtmlFull.js "${keyword}"`);

  // ⑤ HTML統合（最終記事）
  safeExec(`node generateArticleFinalHtml.js "${keyword}"`);

  // ⑦ アイキャッチ
  safeExec(`node index.js "${keyword}"`);

  // ⑦ 完了メール送信
  safeExec(`node notifyComplete.js "${keyword}"`);

  // ⑥ 不要ファイル削除（残すのは ${kw}.html のみ）
  safeExec(`node deleteTempFiles.js "${keyword}"`);


  console.log(`
========================================
🎉 全工程完了！
最終ファイル: ${keyword.replace(/\s+/g, "_")}.html
========================================
`);
}

main();
