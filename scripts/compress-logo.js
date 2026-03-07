// 临时脚本：压缩 logo.png 至 200KB 以下（仅用 PNG，WebP 在真机上兼容性差）
const fs = require("fs");
const path = require("path");

async function main() {
  let sharp;
  try {
    sharp = require("sharp");
  } catch {
    console.log("正在安装 sharp...");
    require("child_process").execSync("npm install sharp --no-save", {
      stdio: "inherit",
      cwd: path.join(__dirname, ".."),
    });
    sharp = require("sharp");
  }

  const src = path.join(__dirname, "../miniprogram/images/logo.png");
  const imgDir = path.join(__dirname, "../miniprogram/images");

  const meta = await sharp(src).metadata();
  const targetBytes = 200 * 1024;

  // 仅用 PNG：WebP 在微信小程序真机（尤其安卓）上常显示空白
  const tmpPath = path.join(imgDir, "logo.png.tmp");
  let w = meta.width;
  for (let i = 0; i < 6; i++) {
    await sharp(src)
      .resize(w, null, { withoutEnlargement: true })
      .png({ compressionLevel: 9 })
      .toFile(tmpPath);
    const size = fs.statSync(tmpPath).size;
    if (size <= targetBytes) {
      fs.renameSync(tmpPath, src);
      console.log(`PNG 压缩完成: ${Math.round(w)}px -> ${(size / 1024).toFixed(1)} KB`);
      return;
    }
    w = Math.floor(w * 0.8);
  }
  if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
  console.log("未能压缩到 200KB 以下，请手动使用 TinyPNG 等工具");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
