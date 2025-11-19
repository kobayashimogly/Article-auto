// ============================
// 「10選」など数字チェック
// ============================
function checkNumberConsistency(block) {
    const title = block.title;
  
    // 例: 10選, 5個, 7つ, 3点
    const match = title.match(/(\d+)(選|個|つ|点)/);
    if (!match) return null;
  
    const required = Number(match[1]);
    const actual = block.children.length;
  
    if (actual < required) {
      return `「${title}」は最低 ${required} 個のh3が必要ですが、実際は ${actual} 個です。`;
    }
    return null;
  }
  
  // ============================
  // 構成案チェック本体
  // ============================
  export function validateStructure(structure, keyword) {
    const errors = [];
  
    // ① h2 数チェック
    if (structure.length < 7) {
      errors.push(`h2 が 7個未満です。（現在 ${structure.length} 個）`);
    }
  
    // ② h3 数チェック
    const h3Count = structure.reduce((sum, block) => sum + block.children.length, 0);
    if (h3Count < 16) {
      errors.push(`h3 が 16個未満です。（現在 ${h3Count} 個）`);
    }
  
    // ③ 最初のh2にキーワードが含まれる
    const firstTitle = structure[0]?.title ?? "";
    const kwWords = keyword.split(/\s+/);
  
    const containsKw = kwWords.some(k =>
      firstTitle.slice(0, 15).includes(k)
    );
  
    if (!containsKw) {
      errors.push("最初の h2 タイトルの前半にキーワードが含まれていません。");
    }
  
    // ④ 「10選」など数字ルール
    structure.forEach((block) => {
      const err = checkNumberConsistency(block);
      if (err) errors.push(err);
    });
  
    return errors;
  }
  