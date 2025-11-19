// notifyComplete.js
import fs from "fs";
import nodemailer from "nodemailer";
import path from "path";

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

  console.log(`📤 Gmail SMTP で送信準備 → ${finalHtml}`);

  // ===== 画像パス（3つ） =====
  const imgMarket = `市場${safeKw}.png`;
  const imgDig = `Dig${safeKw}.png`;
  const imgVenture = `ベンチャー${safeKw}.png`;

  // 添付ファイルリストに追加
  const attachments = [
    {
      filename: `${safeKw}.html`,
      path: `./${safeKw}.html`,
    },
  ];

  // ===== 画像が存在する場合のみ添付 =====
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

  // ===== GitHub Actions の Secrets を使用 =====
const user = process.env.GMAIL_USER;
const pass = process.env.GMAIL_APP_PASSWORD;
if (!user || !pass) {
console.error("❌ GMAIL_USER または GMAIL_APP_PASSWORD が設定されていません（GitHub Secrets を確認）");
return;
}

  // Gmail SMTP
  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user, pass }
  });

  const mailOptions = {
    from: user,
    to: "g-1000017355-609894@mail.talknote.com",
    subject: `【記事通知】${keyword}`,
    text: `　／\n🗣️記事生成が完了しました！\n　＼\n\nキーワード: ${keyword}\n\n画像3枚とHTMLを添付しています。`,
    attachments,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log("🎉 Talknote へメール送信成功！");
  } catch (err) {
    console.error("❌ メール送信エラー:", err);
  }
}

main();
