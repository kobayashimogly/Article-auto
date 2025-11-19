// validateArticleSection.js
import fs from "fs";

// 禁止記号
const NG_CHARS = ["”", "“", "「", "」", "*", "\""];

// 丁寧語チェック
function endsWithPolite(text) {
    return /(です|ます|しょう|さい)[。．\.!\?！？」]*$/.test(text.trim());
  }
  

// 文字数カウント（タグは除外）
function countChars(text) {
  return text.replace(/<[^>]*>/g, "").length;
}

// 例文セクション判定
function isExampleSection(title) {
  return /例文|サンプル|例/.test(title);
}

export function validateArticleSection(jsonFile) {
  const raw = fs.readFileSync(jsonFile, "utf-8");
  let data;

  try {
    data = JSON.parse(raw);
  } catch (e) {
    return { ok: false, errors: ["JSONが壊れています"] };
  }

  const errors = [];

  // ================================
  // h2チェック
  // ================================
  if (!data.h2 || typeof data.h2 !== "string") {
    errors.push("h2 がありません");
  }

  // ================================
  // introチェック
  // ================================
  if (!data.intro) {
    errors.push("intro がありません");
  } else {
    const introLen = countChars(data.intro);
    if (introLen < 150 || introLen > 200) {
      errors.push(`introが文字数外です（${introLen}文字）`);
    }
    if (!endsWithPolite(data.intro)) {
      errors.push("introが丁寧語で終わっていません。です。ます。で終えてください。");
    }
    NG_CHARS.forEach(ch => {
      if (data.intro.includes(ch)) {
        errors.push(`introに禁止記号が含まれています：${ch}`);
      }
    });
  }

  // ================================
  // h3 がある場合のみチェック
  // ================================
  if (Array.isArray(data.h3)) {
    data.h3.forEach((block, i) => {
      if (!block.title) {
        errors.push(`h3[${i}] タイトルがありません`);
        return;
      }
      if (!block.content) {
        errors.push(`h3[${i}] content がありません`);
        return;
      }

      const len = countChars(block.content);
      const isExample = isExampleSection(block.title);

      if (isExample) {
        if (len < 300 || len > 400) {
          errors.push(`h3[${i}]（例文系）の文字数が範囲外：${len}文字`);
        }
      } else {
        if (len < 250 || len > 350) {
          errors.push(`h3[${i}] の文字数が範囲外：${len}文字`);
        }
      }

      if (!endsWithPolite(block.content)) {
        errors.push(`h3[${i}] 本文が丁寧語で終わっていません。です。ます。で終えてください。`);
      }

      NG_CHARS.forEach(ch => {
        if (block.content.includes(ch)) {
          errors.push(`h3[${i}] 本文に禁止記号：${ch}`);
        }
      });
    });
  }
  // h3 が無い場合 → OK（本文無しの h2 もあり得るため）
  // 何もしない

  return {
    ok: errors.length === 0,
    errors
  };
}

