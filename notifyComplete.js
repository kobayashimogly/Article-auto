// notifyComplete.js
import fs from "fs";
import nodemailer from "nodemailer";
import path from "path";
import { GoogleGenAI } from "@google/genai";
import "dotenv/config";

async function generateSeoTitles(keyword, structureFile) {
  // structure_◯◯.json が存在するか確認
  if (!fs.existsSync(structureFile)) {
    console.warn(`⚠ 構造化ファイルが見つかりません: ${structureFile}`);
    return ["タイトル案1（ファイルなし）", "タイトル案2", "タイトル案3"];
  }

  // JSON を読み込み
  const structureData = JSON.parse(fs.readFileSync(structureFile, "utf-8"));

  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
  });

  const prompt = `
あなたはSEO専門の編集者です。

以下の構造化データ（記事の骨組み）をもとに、
検索流入を最大化できる魅力的なSEO向けタイトル案を3つ作成してください。

【キーワード】
${keyword}

【構造化データ】
${JSON.stringify(structureData, null, 2)}

■ 制約条件
- タイトルのみで出力してください
- 例文などある場合は【例文◯◯選】などを前半に入れたい！
- 必ずキーワード "${keyword}" 空白を消してタイトルの前半に含める
- 太文字などは使わないでください
- 一つのタイトルで40〜55文字程度
- 読み手のベネフィットが明確
- 箇条書きで3つだけ出力

出力例：
1. 〜〜〜
2. 〜〜〜
3. 〜〜〜
  `;

  const res = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
  });

  const text = res.candidates?.[0]?.content?.parts?.[0]?.text || "";
  const titles = text
    .split("\n")
    .map((t) => t.replace(/^\d+\.\s*/, "").trim())
    .filter((t) => t.length > 0)
    .slice(0, 3);

  return titles;
}

async function main() {
  const keyword = process.argv[2];
  if (!keyword) {
    console.log("使用例: node notifyComplete.js \"es 大切にしている価値観\"");
    return;
  }

  const safeKw = keyword.replace(/\s+/g, "_");
  const finalHtml = `${safeKw}.html`;

  if (!fs.existsSync(finalHtml)) {
    console.error(`❌ 最終HTMLが見つかりません: ${finalHtml}`);
    return;
  }

  // ▼▼▼ 新機能：SEOタイトル案生成 ▼▼▼
  const structureFile = `structure_${safeKw}.json`;
  console.log(`🔍 AIがSEOタイトル案を生成中… → ${structureFile}`);
  const seoTitles = await generateSeoTitles(keyword, structureFile);

  console.log("✔ SEOタイトル案:");
  seoTitles.forEach((t) => console.log(" - " + t));
  // ▲▲▲ ここまで追加 ▲▲▲

  console.log(`📤 Gmail SMTP で送信準備 → ${finalHtml}`);

  // ===== 画像パス（3つ） =====
  const imgMarket = `市場${safeKw}.png`;
  const imgDig = `Dig${safeKw}.png`;
  const imgVenture = `ベンチャー${safeKw}.png`;

  // 添付ファイルリスト
  const attachments = [
    {
      filename: `${safeKw}.html`,
      path: `./${safeKw}.html`,
    },
  ];

  [imgMarket, imgDig, imgVenture].forEach((img) => {
    if (fs.existsSync(img)) {
      attachments.push({
        filename: img,
        path: path.resolve(img),
      });
      console.log(`📎 添付 → ${img}`);
    } else {
      console.warn(`⚠ 画像が見つかりません → ${img}`);
    }
  });

  // ===== Gmail Secrets =====
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) {
    console.error("❌ GMAIL_USER または GMAIL_APP_PASSWORD が設定されていません（GitHub Secrets を確認）");
    return;
  }

  // ===== Gmail SMTP =====
  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user, pass },
  });

  // ▼▼▼ メール本文にSEOタイトル案を追加 ▼▼▼
  const seoText = seoTitles.map((t, i) => `${i + 1}. ${t}`).join("\n");

  const mailOptions = {
    from: user,
    to: "g-1000017355-609894@mail.talknote.com",
    subject: `【記事通知】${keyword}`,
    text: `
　／
🗣️ 記事生成が完了しました！
　＼

キーワード：${keyword}

▼ SEOタイトル案
${seoText}

※ 画像3枚とHTMLファイルを添付しています。
    `,
    attachments,
  };
  // ▲▲▲ ここまで追加 ▲▲▲

  try {
    await transporter.sendMail(mailOptions);
    console.log("🎉 Talknote へメール送信成功！");
  } catch (err) {
    console.error("❌ メール送信エラー:", err);
  }
}

main();
