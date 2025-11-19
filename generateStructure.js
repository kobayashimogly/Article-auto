import fs from "fs";
import { execSync } from "child_process";
import { renameToKwJson } from "./renameScraped.js";

// ====================================================
// ✨ JSONコードブロック削除関数（追加部分）
// ====================================================
function cleanJsonCodeBlock(text) {
  return text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```/g, "")
    .trim();
}

// ====================================================
// ① キーワードを入力して kw.json にリネーム
// ====================================================
async function prepareInput(keyword) {
  const jsonFile = renameToKwJson(keyword);
  if (!jsonFile) process.exit(1);

  const rawData = fs.readFileSync(jsonFile, "utf-8");
  const data = JSON.parse(rawData);

  const input = {
    keyword: data.keyword,
    competitors: data.competitors.map((c) => ({
      url: c.url,
      title: c.title,
      headers: c.headers,
      content: c.content.slice(0, 5000),
    })),
  };

  const inputFile = `input_${keyword.replace(/\s+/g, "_")}.json`;
  fs.writeFileSync(inputFile, JSON.stringify(input, null, 2));

  console.log(`📥 構成案AI用の入力JSON生成 → ${inputFile}`);
  return inputFile;
}

// ====================================================
// ② Gemini CLI プロンプト生成
// ====================================================
function createPrompt(keyword, inputFile) {
  const template = `
あなたは日本最大規模の就活メディアの編集長です。
以下は「${keyword}」で検索した競合3サイトの情報です。
これを基にSEOで勝てる構成案を作成してください。

# 絶対ルール
- JSON形式のみを出力する
- 純粋な JSON のみ出力してください。
- 説明文・挨拶・前置き・補足・メタ発言（「承知しました」など）を一切書かない
- JSON以外の文字を書いたら失敗とする
- h2の1つ目のタイトル前半にキーワードを必ず含める
- h2には100〜150字のintroを必ず付ける
- h3には本文を書かない
- h2に「10選」など数字がある場合、その数と同じの数のh3を必ず作る

# 構成案ルール
- h2は7個以上
- h3は16個以上
- 見出しタグと見出し文のみで大丈夫です！
- 最初のh2の前半に keyword を入れる
- JSON形式で返す
- 必ず日本語で回答してください。
- 以下形式のみで出力

{
  "keyword": "${keyword}",
  "structure": [
    {
      "type": "h2",
      "title": "",
      "intro": "",
      "children": [
        { "type": "h3", "title": "" }
      ]
    }
  ]
}

# 競合データ
${fs.readFileSync(inputFile, "utf-8")}
  `;

  const promptFile = `prompt_${keyword.replace(/\s+/g, "_")}.txt`;
  fs.writeFileSync(promptFile, template);

  console.log(`📝 プロンプト生成 → ${promptFile}`);
  return promptFile;
}

// ====================================================
// ③ Gemini CLI を実行（出力を cleanJsonCodeBlock で加工）
// ====================================================
function runGemini(promptFile, keyword) {
  const promptText = fs.readFileSync(promptFile, "utf-8");

  const outputFile = `structure_${keyword.replace(/\s+/g, "_")}.json`;

  const cmd = `cat "${promptFile}" | gemini -m "gemini-2.5-flash"`;

  console.log("🚀 Gemini CLI 実行中...");

  let result = execSync(cmd, {
    encoding: "utf-8",
    maxBuffer: 1024 * 1024 * 10,
  });

  // ✨ ここで JSON コードブロックを除去
  result = cleanJsonCodeBlock(result);

  fs.writeFileSync(outputFile, result);

  console.log(`✅ 構成案生成 → ${outputFile}`);
  return outputFile;
}
// ====================================================
// ③ 🔸API版
// ====================================================
// import { GoogleGenAI } from "@google/genai";
// import { GoogleGenerativeAI } from "@google/generative-ai";

// async function runGemini(promptFile, keyword) {
//   // const ai = new GoogleGenAI({
//   //   apiKey: process.env.GEMINI_API_KEY,
//   // });

//   const ai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
//   const model = ai.getGenerativeModel({ model: "gemini-2.5-flash" });
  
//   const promptText = fs.readFileSync(promptFile, "utf-8");
//   const outputFile = `structure_${keyword.replace(/\s+/g, "_")}.json`;
  
//   console.log("🚀 Gemini API 実行中...");
  
//   // const response = await ai.models.generateContent({
//     //   model: "gemini-2.0-flash",
//     //   contents: promptText,
//     // });
    
//     const response = await model.generateContent(promptText);
    
//   let result =
//     response.candidates?.[0]?.content?.parts?.[0]?.text || "";

//   // JSONコードブロック除去
//   result = cleanJsonCodeBlock(result);

//   fs.writeFileSync(outputFile, result);

//   console.log(`✅ 構成案生成 → ${outputFile}`);
//   return outputFile;
// }

// ====================================================
// main
// ====================================================
async function main() {
  const keyword = process.argv[2];
  if (!keyword) {
    console.log(
      "kw指定して： node generateStructure.js 'es 大切にしている価値観'"
    );
    return;
  }

  const inputFile = await prepareInput(keyword);
  const promptFile = createPrompt(keyword, inputFile);
  runGemini(promptFile, keyword);
}

main();
