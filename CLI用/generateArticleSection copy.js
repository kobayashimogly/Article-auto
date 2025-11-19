// generateArticleSection.js
import fs from "fs";
import { execSync } from "child_process";

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
// ✨ Gemini 実行
// ====================================================
export function runGemini(prompt, keyword, index) {
  const promptFile = `article_prompt_${keyword}_${index}.txt`;
  fs.writeFileSync(promptFile, prompt);

  const outputFile = `article_section_${keyword}_${index}.json`;

  const cmd = `cat "${promptFile}" | gemini -m "gemini-2.5-flash"`;

  console.log(`🚀 Section${index} 本文生成中...`);

  let result = execSync(cmd, {
    encoding: "utf-8",
    maxBuffer: 1024 * 1024 * 10,
  });

  result = extractJson(result);
  if (!result) throw new Error("JSON抽出に失敗（AI出力が壊れています）");

  fs.writeFileSync(outputFile, result);
  console.log(`✅ Section${index} 生成 → ${outputFile}`);

  return outputFile;
}
