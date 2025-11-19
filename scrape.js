import fs from "fs";
import path from "path";
import { getCompetitorUrls } from "./serpSearch.js";
import { scrapeCompetitor } from "./scrapeCompetitor.js";

const keyword = process.argv[2];

if (!keyword) {
  console.error("❌ キーワードを入力してください");
  process.exit(1);
}

// --- 保存フォルダ ---
const saveDir = "result";
if (!fs.existsSync(saveDir)) {
  fs.mkdirSync(saveDir);
}

// --- ファイル名を安全に変換（スペース → _） ---
const safeKeyword = keyword.replace(/[ \t]/g, "_");
const savePath = path.join(saveDir, `${safeKeyword}.json`);

async function main() {
  console.log(`🔍 キーワード: ${keyword}`);
  console.log("🔍 SerpAPIで競合URL取得中...\n");

  const urls = await getCompetitorUrls(keyword);

  if (urls.length === 0) {
    console.log("⚠ 競合URLが見つかりませんでした");
    fs.writeFileSync(
      savePath,
      JSON.stringify({ keyword, competitors: [] }, null, 2)
    );
    console.log(`📁 空データを保存: ${savePath}`);
    return;
  }

  console.log("📌 スクレイピング対象:", urls);

  const competitors = [];
  for (let url of urls) {
    console.log(`🕷 スクレイピング中: ${url}`);
    try {
      const data = await scrapeCompetitor(url);
      competitors.push(data);
    } catch (err) {
      console.log(`❌ 取得失敗: ${url} => ${err.message}`);
    }
  }

  // --- 保存 ---
  const json = {
    keyword,
    competitors
  };

  fs.writeFileSync(savePath, JSON.stringify(json, null, 2));

  console.log(`\n✅ 競合スクレイピング完了！`);
  console.log(`📁 保存先: ${savePath}`);
}

main();
