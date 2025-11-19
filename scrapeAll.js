// scrapeAll.js
import { getCompetitorUrls } from "./serpSearch.js";
import { scrapeCompetitor } from "./scrapeCompetitor.js";
import fs from "fs";

async function main() {
  const keyword = process.argv[2];
  if (!keyword) {
    console.log("kwを指定： node scrapeAll.js 'es 大切にしている価値観'");
    return;
  }

  const urls = await getCompetitorUrls(keyword);

  const result = [];
  for (const url of urls) {
    console.log("📥 スクレイピング中 →", url);
    const data = await scrapeCompetitor(url);
    result.push(data);
  }

  fs.writeFileSync(
    `competitors_${Date.now()}.json`,
    JSON.stringify({ keyword, competitors: result }, null, 2)
  );

  console.log("✅ すべて保存完了！");
}

main();

