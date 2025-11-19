// generateHtmlLoop.js
import "dotenv/config";
import { GoogleGenAI } from "@google/genai";
import fs from "fs";
import { execSync } from "child_process";
import { load } from "cheerio";

// =====================================================
// ✨ Gemini API：503エラー指数バックオフつきリトライ
// =====================================================
async function safeGenerateContent(ai, request, maxRetries = 6) {
  let delay = 1200; // 初期待ち時間（1.2秒）

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await ai.models.generateContent(request);

    } catch (err) {
      const code = err?.error?.code;
      const status = err?.error?.status;
      const isOverload =
        code === 503 ||
        status === "UNAVAILABLE" ||
        (err?.message && err.message.includes("overloaded"));

      // 503以外は即 throw
      if (!isOverload) {
        throw err;
      }

      if (i === maxRetries - 1) {
        console.error("❌ 503: 最大リトライ回数に到達しました");
        throw err;
      }

      console.warn(
        `⚠️ Gemini過負荷 (503)。${delay}ms 待って再試行... (${i + 1}/${maxRetries})`
      );

      await new Promise((resolve) => setTimeout(resolve, delay));
      delay *= 2; // 指数バックオフ
    }
  }
}

// =====================================================
// JSON・コードブロック除去
// =====================================================
function extractHtml(text) {
  let cleaned = text
    .replace(/^```html\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```/g, "")
    .trim();

  const idx = cleaned.search(/<h2|<html/i);
  if (idx === -1) return cleaned;

  return cleaned.slice(idx).trim();
}

// =====================================================
// DOMベース HTMLバリデーション
// =====================================================
function validateHtmlSection(html) {
  const $ = load(html);
  const errors = [];

  // 禁止記号
  const forbidden = ["”", "“", "「", "」", "*"];
  forbidden.forEach((sym) => {
    if (html.includes(sym)) errors.push(`禁止記号を使用しています: ${sym}`);
  });

  // pタグ終了チェック
  $("p").each((i, el) => {
    const text = $.html(el).trim();
    if (!text.endsWith("</p>")) {
      errors.push(`pタグが正しく閉じられていません (index ${i})`);
    }
  });

  // ================================
  // ① h2/h3 タグ内部の yellow を禁止
  // ================================
  $("h2").each((i, el) => {
    if ($(el).html().includes('<span class="yellow">')) {
      errors.push(`h2タグ内に yellow が入っています。見出しタグ内ではなく、本文に yellowを書いてください。 index=${i}`);
    }
  });
  $("h3").each((i, el) => {
    if ($(el).html().includes('<span class="yellow">')) {
      errors.push(`h3タグ内に yellow が入っています。見出しタグ内ではなく、本文に yellowを書いてください。 index=${i}`);
    }
  });

  // 共通関数：見出しの本文範囲の yellow を数える
  function countYellowBetween(startEl) {
    let node = $(startEl).next();
    let yellowCount = 0;

    while (node.length && !node.is("h2") && !node.is("h3")) {
      if (node.is("p")) {
        const count = (node.html().match(/<span class="yellow">/g) || [])
          .length;
        yellowCount += count;
      }
      node = node.next();
    }
    return yellowCount;
  }

  // ================================
  // ② h2-intro: yellowは 1〜2個
  // ================================
  $("h2").each((i, h2El) => {
    const yellowCount = countYellowBetween(h2El);
    if (yellowCount < 1 || yellowCount > 2) {
      errors.push(
        `h2-intro に yellow下線が 1〜2個ではありません。しっかり指示に従ってください。（${yellowCount} 個）index=${i}`
      );
    }
  });

  // ================================
  // ③ h3本文: yellowは 1〜2個
  // ================================
  $("h3").each((i, h3El) => {
    const yellowCount = countYellowBetween(h3El);
    if (yellowCount < 1 || yellowCount > 2) {
      errors.push(
        `h3本文に yellow下線が 1〜2個ではありません。しっかり指示に従ってください。（${yellowCount} 個） index=${i}`
      );
    }
  });

  return { ok: errors.length === 0, errors };
}

// =====================================================
// Gemini 実行（★API化・async化）
// =====================================================
async function runGemini(prompt, outputFile) {
  // プロンプト保存（デバッグ用）
  const promptFile = outputFile.replace(".html", "_prompt.txt");
  fs.writeFileSync(promptFile, prompt);

  console.log(`🚀 Gemini修正実行中...`);

  // APIクライアント初期化
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  try {
    const response = await safeGenerateContent(ai, {
      model: "gemini-2.5-flash",
      contents: prompt,
      // HTML生成なのでJSONモードはOFF。通常のテキストとして受け取る。
    });

    let result = response.candidates?.[0]?.content?.parts?.[0]?.text || "";
    
    // クリーニング
    result = extractHtml(result);

    fs.writeFileSync(outputFile, result);
    console.log(`✅ ファイル保存: ${outputFile}`);
    
  } catch (e) {
    console.error("❌ Gemini API Error:", e);
    throw e;
  }
}

// =====================================================
// 修正プロンプト作成
// =====================================================
function createFixPrompt(originalHtml, errors) {
  return `
あなたは日本最大規模の就活メディアの編集長です。
以下のHTMLを、指定ルールに完全準拠するよう修正してください。

# 絶対ルール
- 必ずHTMLのみを出力（説明文禁止、コードブロック禁止）
- <p> は文ごとに閉じる（「。」ごとに1文）
- h2とh3の見出しタグ内には絶対に置かないでください。
- h2とh3の見出しタグは絶対に変更しないでください。
- h2のintro と h3本文の両方に <span class="yellow">…</span> を入れる
- 各 h2-intro, h3本文につき yellow下線は 1〜2個
- 自然な名詞 or フレーズに下線（25文字以内）
- タグ構造を壊さない
- 禁止記号（” “ 「 」 *）を絶対に入れない
- 丁寧語・就活文体で自然な文章にする

# 修正すべきエラー
${errors.map((e) => `- ${e}`).join("\n")}

# 修正対象HTML
${originalHtml}

# 指示
上記のHTMLを、すべてのルールに従って修正し、HTMLのみを返してください。
`;
}

// =====================================================
// main
// =====================================================
async function main() {
  const keyword = process.argv[2];
  const index = Number(process.argv[3]);

  if (!keyword || Number.isNaN(index)) {
    console.log('使用例: node generateHtmlLoop.js "es 大切にしている価値観" 0');
    return;
  }

  const safeKw = keyword.replace(/\s+/g, "_");
  const htmlFile = `article_section_${safeKw}_${index}.html`;

  if (!fs.existsSync(htmlFile)) {
    console.log(`❌ HTMLファイルが見つかりません: ${htmlFile}`);
    return;
  }

  let current = fs.readFileSync(htmlFile, "utf-8");

  const MAX = 10;

  for (let i = 1; i <= MAX; i++) {
    console.log(`\n===== HTMLチェック ${i} 回目 =====`);

    const check = validateHtmlSection(current);

    if (check.ok) {
      const final = `article_section_${safeKw}_${index}_final.html`;
      fs.writeFileSync(final, current);
      console.log(`🎉 HTML セクション完成 → ${final}`);
      return;
    }

    console.log("❌ エラー:", check.errors);

    const prompt = createFixPrompt(current, check.errors);
    const newFile = `article_section_${safeKw}_${index}_loop${i}.html`;

    await runGemini(prompt, newFile);

    // 生成されたファイルを読み込んで次回のチェックへ
    if (fs.existsSync(newFile)) {
        current = fs.readFileSync(newFile, "utf-8");
    } else {
        console.error("❌ 生成ファイルが見つかりませんでした。中断します。");
        break;
    }
  }

  console.log("❌ 規定回数修正してもパスしませんでした。手動修正が必要です。");
}

main();
