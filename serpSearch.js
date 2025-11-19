// serpSearch.js
import { GoogleSearch } from "google-search-results-nodejs";
import dotenv from "dotenv";
dotenv.config();

const NG_DOMAINS = [
    "job.rikunabi.com",
    "www.onecareer.jp",
    "job.mynavi.jp",
    "tenshoku.mynavi.jp",
    "shingakunet.com",
    "www.aoki-style.com",
    "shinsotsu.mynavi-agent.jp",
    "rookie.levtech.jp",
    "sugowish.com",
    "shigoto.mhlw.go.jp",
    "求人ボックス.com",
    "manabi.benesse.ne.jp",
];

function isNgDomain(url) {
  return NG_DOMAINS.some(ng => url.includes(ng));
}

// --- SerpAPIでGoogle検索結果を取る ---
export async function getCompetitorUrls(keyword) {
  // const search = new GoogleSearch(process.env.SERP_API_KEY);
  const apiKey = process.env.SERPAPI_KEY;
if (!apiKey) {
console.error("❌ SERPAPI_KEY が設定されていません");
return [];
}
const search = new GoogleSearch(apiKey);

  return new Promise((resolve) => {
    search.json(
      {
        q: keyword,
        hl: "ja",
        num: 10,    // 上位10件 → NG以外のみ採用
        gl: "jp",
        engine: "google",
      },
      (data) => {
        if (!data.organic_results) {
          console.log("❌ SERPデータ取得失敗");
          resolve([]);
          return;
        }

        const links = data.organic_results
          .map(r => r.link)
          .filter(url => url && url.startsWith("http"));

        console.log("🔍 SerpAPI 抽出結果:", links);

        // ❗ NGドメインを除外
        const filtered = links.filter(url => !isNgDomain(url));

        console.log("🚫 NG除外後のURL:", filtered);

        // 上位3件だけ返す
        resolve(filtered.slice(0, 3));
      }
    );
  });
}
