// generateArticleSectionLoop.js
import fs from "fs";
import { execSync } from "child_process";
import { validateArticleSection } from "../validateArticleSection.js";
import { createPrompt as createSectionPrompt } from "../generateArticleSection.js";
import { runGemini as runInitialGenerate } from "../generateArticleSection.js";

// ====================================================
// ✨ JSONコードブロック除去
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
// ✨ 修正プロンプト作成（A方式）
// ====================================================
function createFixPrompt(keyword, originalJson, errors) {
  const template = `
あなたは日本最大規模の就活メディア編集長です。
以下の本文JSONがあります。このJSONの問題点を修正して、必ずルールを満たす新しいJSONを生成してください。

# 絶対ルール
- JSONのみ出力する
- 説明文・メタ発言禁止
- 禁止記号（” “ 「 」 * "）は使わない
- 丁寧語で終わる
- 文字数ルールを必ず守る
  - intro：150〜200字
  - h3本文：250〜350字
  - 例文系：300〜400字
- タグは不要（HTML化は後）
- 構造

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

# エラー
${errors.map((e) => `- ${e}`).join("\n")}

# 元JSON
${JSON.stringify(originalJson, null, 2)}

# 指示
全エラーを修正した新しいJSONのみ出力。
  `;
  return template;
}

// ====================================================
// ✨ Gemini（修正生成）
// ====================================================
function runGemini(prompt, keyword, index, iteration) {
  const promptFile = `article_fix_prompt_${keyword}_${index}_${iteration}.txt`;
  fs.writeFileSync(promptFile, prompt);

  const outputFile = `article_section_${keyword}_${index}_loop${iteration}.json`;

  const cmd = `cat "${promptFile}" | gemini -m "gemini-2.5-flash"`;

  console.log(`🚀 Gemini修正実行中...（${iteration}回目）`);

  let result = execSync(cmd, {
    encoding: "utf-8",
    maxBuffer: 1024 * 1024 * 20,
  });

  result = extractJson(result);
  if (!result) throw new Error("JSON抽出に失敗（AI出力が壊れています）");
  fs.writeFileSync(outputFile, result);

  return outputFile;
}

// ====================================================
// main
// ====================================================
async function main() {
  const keyword = process.argv[2];
  const index = Number(process.argv[3]);

  if (!keyword || Number.isNaN(index)) {
    console.log(
      "使用例: node generateArticleSectionLoop.js 'es 大切にしている価値観' 0"
    );
    return;
  }

  const safeKw = keyword.replace(/\s+/g, "_");
  const structureFile = `structure_${safeKw}.json`;

  if (!fs.existsSync(structureFile)) {
    console.log(`❌ 構成案ファイルがありません: ${structureFile}`);
    return;
  }

  // ⭐⭐⭐ 初回生成が無い場合 → 自動生成する ⭐⭐⭐
  let currentFile = `article_section_${safeKw}_${index}.json`;

  if (!fs.existsSync(currentFile)) {
    console.log(
      `📝 初回生成が無いため、generateArticleSection.js を実行します`
    );

    const structure = JSON.parse(fs.readFileSync(structureFile, "utf-8"));
    const h2block = structure.structure[index];

    const prompt = createSectionPrompt(keyword, h2block);

    // ★ 戻り値（生成ファイル名）を受け取る！！
    currentFile = runInitialGenerate(prompt, safeKw, index);

    console.log(`📄 初回生成完了 → ${currentFile}`);
  }

  // ⭐⭐⭐ ここから修正ループ ⭐⭐⭐
  const MAX = 8;

  for (let i = 1; i <= MAX; i++) {
    console.log(`\n===== 🔍 ${i}回目チェック開始 =====`);
    const validation = validateArticleSection(currentFile);

    if (validation.ok) {
      console.log(`🎉 合格！ -> ${currentFile}`);
      return;
    }

    console.log("❌ エラー内容：");
    console.log(validation.errors);

    const original = JSON.parse(fs.readFileSync(currentFile, "utf-8"));

    const fixPrompt = createFixPrompt(keyword, original, validation.errors);

    const newFile = runGemini(fixPrompt, safeKw, index, i);

    currentFile = newFile;
  }

  console.log(
    "❌ 5回ループしても合格しませんでした。手動チェックをお願いします。"
  );
}

main();
