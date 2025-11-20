import "dotenv/config";
import sharp from "sharp";
import fetch from "node-fetch";
import fs from "fs";
import path from "path";
import { GoogleGenAI } from "@google/genai";

// ====== 共通：リトライ関数（429対応版・指数バックオフ） ======
async function retry(fn, maxAttempts = 5) {
  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      console.log(`▶ Attempt ${attempt}/${maxAttempts}`);
      return await fn();
    } catch (err) {
      lastError = err;
      const is429 =
        err?.message?.includes("429") ||
        err?.status === 429 ||
        err?.error?.status === "RESOURCE_EXHAUSTED";

      console.error(`❌ Error on attempt ${attempt}:`, err.message);

      if (attempt >= maxAttempts) break;

      // 429 なら強めのバックオフ
      const waitMs = is429
        ? 30000 * Math.pow(2, attempt) // 1s → 2s → 4s → 8s...
        : 10000 * attempt; // 通常エラーは軽い待機

      console.log(`⏳ Waiting ${waitMs}ms before retry...`);
      await new Promise((res) => setTimeout(res, waitMs));
    }
  }

  throw new Error(`❌ Failed after ${maxAttempts} attempts: ${lastError}`);
}

// ====== Gemini（短いキャッチコピー生成） ======
async function generateText(title) {
  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
  });

  const prompt = `
    記事KW：${title}
    アイキャッチ用記事の内容が気になるような文章を作成。
    必ず一つのみ出力してください。
    「、」や「*」,「&」,「!」は使わないでください。
    必ず2行だけ返す。
    30〜40文字、強く分かりやすい。
  `;

  return await retry(async () => {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: prompt,
    });

    return (
      response.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ||
      "魅力を伝える"
    );
  });
}

// ====== 安定背景（Picsum） ======
async function getRandomImage() {
  return await retry(async () => {
    const res = await fetch("https://picsum.photos/2000/1400");
    if (!res.ok) throw new Error("画像取得に失敗しました");
    return Buffer.from(await res.arrayBuffer());
  });
}

function escapeXML(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// ====== SVG（AIテキスト） ======
function createTextSVG(text, width, height) {
  const lines = text.split(/\n/).map(escapeXML);

  return Buffer.from(`
    <svg width="${width}" height="${height}">
      <style>
          text {
            font-family: "Shippori Antique", sans-serif;
            fill: #fff;
            font-size: 40px;
            font-weight: bold;
            text-anchor: middle;
          }
      </style>
      <text x="${width / 2}" y="${height / 2}" dominant-baseline="middle">
        <tspan x="${width / 2}" dy="-30">${lines[0] || ""}</tspan>
        <tspan x="${width / 2}" dy="60">${lines[1] || ""}</tspan>
      </text>
    </svg>
  `);
}

// ====== 背景＋overlay＋テキスト ======
async function generateImage(bg, overlayPath, text, outPath, width, height) {
  await retry(async () => {
    const svg = createTextSVG(text, width, height);

    const overlay = await sharp(overlayPath)
      .resize(width, height, { fit: "cover" })
      .png()
      .toBuffer();

    await sharp(bg)
      .resize(width, height)
      .composite([
        { input: overlay, gravity: "center", blend: "over" },
        { input: svg, gravity: "center" },
      ])
      .png()
      .toFile(outPath);

    console.log(`✔ 生成完了：${outPath}`);
  });
}

// ====== メイン ======
async function main() {
  const kw = process.argv[2] || "自己PR";
  const safeKw = kw.replace(/\s+/g, "_");

  const outDir = path.resolve(".");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);

  console.log("▶ Geminiでテキスト生成中...");
  const text = await generateText(kw);
  console.log("▶ AIテキスト:", text);

  console.log("▶ 背景画像取得中...");
  const bg = await getRandomImage();

  const overlayMarket = "imgs/s_img.png";
  const overlayDig = "imgs/d_img.png";
  const overlayVenture = "imgs/v_img.png";

  const img1 = path.join(outDir, `市場${safeKw}.png`);
  const img2 = path.join(outDir, `Dig${safeKw}.png`);
  const img3 = path.join(outDir, `ベンチャー${safeKw}.png`);

  await generateImage(bg, overlayMarket, text, img1, 720, 480);
  await generateImage(bg, overlayDig, text, img2, 720, 550);
  await generateImage(bg, overlayVenture, text, img3, 720, 550);
}

main();
