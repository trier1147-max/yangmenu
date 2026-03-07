// 临时脚本：压缩 logo.png 至 200KB 以下（转为 WebP 或缩小 PNG）
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

  // 方案1：转 WebP（微信小程序支持，体积更小）
  const webpPath = path.join(imgDir, "logo.webp");
  for (let q = 85; q >= 55; q -= 10) {
    await sharp(src).webp({ quality: q }).toFile(webpPath);
    const size = fs.statSync(webpPath).size;
    if (size <= targetBytes) {
      console.log(`WebP quality=${q} -> ${(size / 1024).toFixed(1)} KB`);
      return { useWebp: true };
    }
  }
  if (fs.existsSync(webpPath)) fs.unlinkSync(webpPath);

  // 方案2：缩小 PNG 尺寸 + 高压缩
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
      return { useWebp: false };
    }
    w = Math.floor(w * 0.8);
  }
  if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
  console.log("未能压缩到 200KB 以下，请手动使用 TinyPNG 等工具");
  return { useWebp: false };
}

const logoPng = path.join(__dirname, "../miniprogram/images/logo.png");

main()
  .then((result) => {
    if (result?.useWebp && fs.existsSync(logoPng)) {
      const wxmlPath = path.join(__dirname, "../miniprogram/pages/index/index.wxml");
      let wxml = fs.readFileSync(wxmlPath, "utf8");
      wxml = wxml.replace(/\/images\/logo\.png/g, "/images/logo.webp");
      fs.writeFileSync(wxmlPath, wxml);
      fs.unlinkSync(logoPng);
      console.log("已更新 index.wxml 使用 logo.webp，已删除原 logo.png");
    }
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
