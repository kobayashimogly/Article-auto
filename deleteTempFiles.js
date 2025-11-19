// deleteTempFiles.js
import fs from "fs";

function main() {
  const keyword = process.argv[2];

  if (!keyword) {
    console.log("使用例: node deleteTempFiles.js \"es 大切にしている価値観\"");
    return;
  }

  const safeKw = keyword.replace(/\s+/g, "_");
  const keepFile = `${safeKw}.html`;

  // 🔒 削除してはいけない大事なファイル
  const PROTECTED = [
    "package.json",
    "package-lock.json",
    keepFile
  ];

  console.log(`🧹 不要ファイル削除を開始`);
  console.log(`⚠️ 残すファイル → ${keepFile}`);
  console.log("");

  const files = fs.readdirSync(".");

  // 🔥 削除対象は: .html / .json / .txt だけど、PROTECTED は除外
  const targets = files.filter((f) =>
    (f.endsWith(".html") || f.endsWith(".json") || f.endsWith(".png") || f.endsWith(".txt")) &&
    !PROTECTED.includes(f)
  );

  if (targets.length === 0) {
    console.log("✨ 削除対象ファイルはありません");
    return;
  }

  targets.forEach((file) => {
    fs.unlinkSync(file);
    console.log(`🗑️ 削除 → ${file}`);
  });

  console.log("\n==============================");
  console.log("🎉 不要ファイル削除が完了しました！");
  console.log("==============================");
}

main();
