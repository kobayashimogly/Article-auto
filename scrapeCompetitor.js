// scrapeCompetitor.js
import { chromium } from "playwright";

export async function scrapeCompetitor(url) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto(url, {
    waitUntil: "domcontentloaded",
    timeout: 40000
  });

  // --- 見出し省略を完全無効化する（超重要） ---
  await page.addStyleTag({
    content: `
      * {
        max-width: none !important;
        overflow: visible !important;
        text-overflow: clip !important;
        white-space: normal !important;
      }
    `
  });

  // --- タイトル ---
  const title = await page.title();

  // --- H1〜H4抽出（ellipsis対策完全版） ---
  const headers = await page.$$eval("h1, h2, h3, h4", els =>
    els.map(e => {
      // 1. title属性
      const titleAttr = e.getAttribute("title");

      // 2. data-* にフルテキストが入っていないか（neo-career / offerbox）
      const dataText = Object.values(e.dataset || {}).join(" ").trim();

      // 3. childNodesから全テキストを抽出（span内部に完全な文章があるケース）
      const fullText = Array.from(e.childNodes)
        .map(n => n.textContent || "")
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();

      // 4. fallback: textContent
      const rawText = e.textContent
        .replace(/\s+/g, " ")
        .trim();

      return {
        level: e.tagName.toLowerCase(),
        text:
          (titleAttr && titleAttr.trim()) ||
          (dataText && dataText) ||
          (fullText && fullText) ||
          rawText
      };
    })
  );

  // --- 本文抽出（不要タグ除去） ---
  const content = await page.evaluate(() => {
    const selectorsToRemove = [
      "script", "style", "iframe", "nav",
      "header", "footer", ".footer", ".header",
      "#footer", "#header",
      ".ads", "[class*='advert']", "[id*='advert']",
      "noscript"
    ];

    selectorsToRemove.forEach(sel => {
      document.querySelectorAll(sel).forEach(el => el.remove());
    });

    return document.body.innerText.replace(/\s+/g, " ").trim();
  });

  await browser.close();

  return {
    url,
    title,
    headers,
    content
  };
}
