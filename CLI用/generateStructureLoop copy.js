import fs from "fs";
import { execSync } from "child_process";
import { renameToKwJson } from "../renameScraped.js";
import { validateStructure } from "../validateStructure.js";

// ====================================================
// ✨ JSONコードブロック削除関数（generateStructure.js と完全同じ）
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

  console.log(`📥 input 生成 → ${inputFile}`);
  return inputFile;
}

// ====================================================
// ② プロンプト生成（初回 or 修正指示付き）
// ====================================================
function createPrompt(keyword, inputFile, previousJson = null, errors = []) {
  let fixText = "";

  if (previousJson && errors.length > 0) {
    fixText = `
# 修正すべきエラー一覧
${errors.map((e) => "- " + e).join("\n")}

# 前回の構成案（改善対象）
${JSON.stringify(previousJson, null, 2)}
`;
  }

  const template = `
あなたは日本最大規模の就活メディアの編集長です。
以下は「${keyword}」で検索した競合3サイトの情報です。
これを基にSEOで勝てる構成案を作成してください。

${fixText}

# 絶対ルール
- JSON形式のみを出力する
- JSON以外の文字を書いたら失敗とする
- 説明文/挨拶/前置きは禁止
- h2の1つ目のタイトル前半にキーワードを必ず含める
- h2には100〜150字のintroを付ける
- h2が「10選」など数字を含む場合、その数のh3を必ず作る

# 構成案ルール
- h2は7個以上
- h3は16個以上
- 見出しタグと見出し文のみ
- 日本語の JSON で回答する
- 以下形式で返す

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
// ③ Gemini 実行（generateStructure.js と完全同じ）
// ====================================================
function runGemini(promptFile, keyword, index) {
  const outputFile = `structure_${keyword.replace(/\s+/g, "_")}_${index}.json`;

  const cmd = `cat "${promptFile}" | gemini -m "gemini-2.5-flash"`;

  console.log(`🚀 Gemini 実行 (attempt ${index})...`);

  let result = execSync(cmd, {
    encoding: "utf-8",
    maxBuffer: 1024 * 1024 * 10,
  });

  // JSONコードブロック削除
  result = cleanJsonCodeBlock(result);

  fs.writeFileSync(outputFile, result);

  console.log(`✅ 構成案生成 → ${outputFile}`);
  return outputFile;
}

// ====================================================
// main（生成 → チェック → 修正指示付き再生成のループ）
// ====================================================
async function main() {
  const keyword = process.argv[2];
  if (!keyword) {
    console.log(
      "kw指定して： node generateStructureLoop.js 'es 大切にしている価値観'"
    );
    return;
  }

  const inputFile = await prepareInput(keyword);

  let previousJson = null;

  const MAX_LOOP = 5;

  for (let i = 1; i <= MAX_LOOP; i++) {
    console.log(`\n============================`);
    console.log(`🔥 第${i}回 生成 & チェック`);
    console.log(`============================\n`);

    const promptFile = createPrompt(
      keyword,
      inputFile,
      previousJson,
      previousJson?.errors || []
    );
    const outputFile = runGemini(promptFile, keyword, i);

    const raw = fs.readFileSync(outputFile, "utf-8");

    let json;
    try {
      json = JSON.parse(raw);
    } catch {
      console.log("❌ JSONパース失敗 → 次ループ");
      previousJson = { errors: ["JSONパースエラー"] };
      continue;
    }

    const errors = validateStructure(json.structure, keyword);

    if (errors.length === 0) {
      const final = `structure_${keyword.replace(/\s+/g, "_")}.json`;
      fs.writeFileSync(final, JSON.stringify(json, null, 2));
      console.log(`🎉 完成！！ → ${final}`);
      return;
    }

    console.log("⚠️ エラー → 再生成します");
    console.log(errors);

    previousJson = { ...json, errors };
  }

  console.log("❌ 5回改善しても条件を満たしませんでした。");
}

main();
