import fs from "fs";
import path from "path";

// 最新の competitors_*.json を探す
function getLatestScrapedFile() {
  const files = fs.readdirSync("./");

  const candidates = files.filter(f => f.startsWith("competitors_") && f.endsWith(".json"));

  if (candidates.length === 0) return null;

  return candidates.sort().reverse()[0];
}

// kw をファイル名にして保存
export function renameToKwJson(keyword) {
  const latest = getLatestScrapedFile();
  if (!latest) {
    console.log("❌ competitors_*.json が見つかりません");
    return null;
  }

  const safeKw = keyword.replace(/\s+/g, "_");
  const newName = `${safeKw}.json`;

  fs.renameSync(latest, newName);

  console.log(`✅ リネーム完了 → ${newName}`);
  return newName;
}

