// generateArticleSection.js
import "dotenv/config";
import { GoogleGenAI } from "@google/genai";
import fs from "fs";
import { execSync } from "child_process";

// =====================================================
// ✨ Gemini API：503エラー指数バックオフつきリトライ
// =====================================================
async function safeGenerateContent(ai, request, maxRetries = 6) {
  let delay = 3000;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await ai.models.generateContent(request);

    } catch (err) {
      const code = err?.error?.code;
      const status = err?.error?.status;
      const is503 =
        code === 503 ||
        status === "UNAVAILABLE" ||
        (err?.message && err.message.includes("overloaded"));

      if (!is503) throw err;

      if (i === maxRetries - 1) {
        console.error("❌ 初回生成が503で最大リトライに到達");
        throw err;
      }

      console.warn(
        `⚠️ 初回生成 503 → ${delay}ms 待機して再試行 (${i+1}/${maxRetries})`
      );

      await new Promise(res => setTimeout(res, delay));
      delay *= 2;
    }
  }
}

// ====================================================
// ✨ JSONコードブロック削除
// ====================================================
function extractJson(text) {
  // コードブロック除去
  let cleaned = text.replace(/```json/gi, "").replace(/```/g, "");

  // ★ 追加：最初の { より前のゴミをすべて削除
  const firstBrace = cleaned.indexOf("{");
  if (firstBrace > 0) {
    cleaned = cleaned.slice(firstBrace);
  }

  // 最後の } を探す
  const lastBrace = cleaned.lastIndexOf("}");
  if (lastBrace === -1) return null;

  const jsonString = cleaned.slice(0, lastBrace + 1).trim();

  return jsonString;
}

// ====================================================
// ✨ 本文生成プロンプト生成
// ====================================================
export function createPrompt(keyword, h2block) {
  const { title, intro, children } = h2block;

  const h3Titles = children.map((c) => c.title);

  const template = `
あなたは日本最大規模の就活メディアの編集長です。
以下の h2〜h3 の構成に基づき、本文をJSON形式で作成してください。

# 重要ルール（絶対に守る）
- JSONのみで出力する
- メタ発言・説明文・前置き禁止
- 「”」「*」「“」「」」などの記号を絶対に使わない
- 文体は丁寧語
- ES・就活向けの記事文体で書く
- 具体性・深掘りを最重視する

# 文字数ルール（厳密）
- h2 intro：150〜200字
- h3 本文：250〜350字
- 例文セクション（h3タイトルに例文・例・サンプルが含まれる場合）は300〜400字

# 出力形式（JSONのみ）
{
  "h2": "",
  "intro": "",
  "h3": [
    {
      "title": "",
      "content": ""
    }
  ]
}

# h2
${title}

# h2 intro（これを150〜200字で書く）
※ 構成案の intro は参考程度。あなたは最適化して書き直して良い
※ h3の誘導分として書いて欲しい！

# h3タイトル一覧
${h3Titles.join("\n")}

必ず上記形式のJSONのみで書く。
  `;

  return template;
}

// ====================================================
// ✨ Gemini 実行（★ここをAPI化）
// ====================================================
export async function runGemini(prompt, keyword, index) {
    // プロンプト確認用に保存（デバッグ用に残しておきます）
    const promptFile = `article_prompt_${keyword}_${index}.txt`;
    fs.writeFileSync(promptFile, prompt);
  
    const outputFile = `article_section_${keyword}_${index}.json`;
    console.log(`🚀 Section${index} 本文生成中...`);
  
    // 1. APIクライアント初期化
    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
    });
  
    try {
      // 2. APIリクエスト
      const response = await safeGenerateContent(ai, {
        model: "gemini-2.5-flash", // 必要に応じて gemini-1.5-pro などに変更
        contents: prompt,
        config: {
          responseMimeType: "application/json", // JSON出力を強制
        },
      });
  
      // 3. 結果取得
      let result = response.candidates?.[0]?.content?.parts?.[0]?.text || "";
  
      // 4. 整形（extractJsonを通すことでより確実になります）
      result = extractJson(result);
      
      if (!result) throw new Error("JSON抽出に失敗（AI出力が壊れています）");
  
      fs.writeFileSync(outputFile, result);
      console.log(`✅ Section${index} 生成 → ${outputFile}`);
  
      return outputFile;
  
    } catch (error) {
      console.error(`❌ Error in Section${index}:`, error);
      throw error; // エラーを呼び出し元に伝える
    }
  }
